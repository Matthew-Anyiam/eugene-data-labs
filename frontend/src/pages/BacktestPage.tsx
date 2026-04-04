import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, ArrowLeft, TrendingUp, TrendingDown, Play, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import { cn, formatCurrency } from '../lib/utils';
import type { OHLCVBar, OHLCVData } from '../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TradeEntry {
  date: string;
  action: 'Buy' | 'Sell';
  price: number;
  shares: number;
  value: number;
}

interface BacktestResult {
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  finalValue: number;
  trades: TradeEntry[];
  equityCurve: { date: string; value: number }[];
}

// ─── SMA helper ───────────────────────────────────────────────────────────────

function computeSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

// ─── Backtest engine ──────────────────────────────────────────────────────────

function runSMABacktest(
  bars: OHLCVBar[],
  smaPeriod: number,
  investment: number,
): BacktestResult {
  if (bars.length < smaPeriod + 2) {
    return { totalReturn: 0, maxDrawdown: 0, winRate: 0, tradeCount: 0, finalValue: investment, trades: [], equityCurve: [] };
  }

  const closes = bars.map((b) => b.close);
  const sma = computeSMA(closes, smaPeriod);

  let cash = investment;
  let shares = 0;
  let inPosition = false;
  let entryPrice = 0;
  let wins = 0;
  let closedTrades = 0;
  let peakValue = investment;
  let maxDrawdown = 0;

  const trades: TradeEntry[] = [];
  const equityCurve: { date: string; value: number }[] = [];

  for (let i = smaPeriod; i < bars.length; i++) {
    const bar = bars[i];
    const smaVal = sma[i];
    if (smaVal === null) continue;

    const prev = bars[i - 1];
    const prevSma = sma[i - 1];

    if (prevSma === null) continue;

    const portfolioValue = cash + shares * bar.close;

    // Buy signal: close crosses above SMA
    if (!inPosition && prev.close <= prevSma && bar.close > smaVal) {
      shares = cash / bar.close;
      cash = 0;
      inPosition = true;
      entryPrice = bar.close;
      trades.push({
        date: bar.date,
        action: 'Buy',
        price: bar.close,
        shares: Math.round(shares * 100) / 100,
        value: Math.round(shares * bar.close * 100) / 100,
      });
    }

    // Sell signal: close crosses below SMA
    if (inPosition && prev.close >= prevSma && bar.close < smaVal) {
      const proceeds = shares * bar.close;
      trades.push({
        date: bar.date,
        action: 'Sell',
        price: bar.close,
        shares: Math.round(shares * 100) / 100,
        value: Math.round(proceeds * 100) / 100,
      });
      if (bar.close > entryPrice) wins++;
      closedTrades++;
      cash = proceeds;
      shares = 0;
      inPosition = false;
    }

    const currentValue = cash + shares * bar.close;
    if (currentValue > peakValue) peakValue = currentValue;
    const drawdown = peakValue > 0 ? (peakValue - currentValue) / peakValue : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    equityCurve.push({ date: bar.date, value: Math.round(currentValue * 100) / 100 });
  }

  // Close open position at last price
  const lastBar = bars[bars.length - 1];
  let finalValue = cash + shares * lastBar.close;
  if (inPosition && shares > 0) {
    // Count as win if profitable
    if (lastBar.close > entryPrice) wins++;
    closedTrades++;
  }
  finalValue = cash + shares * lastBar.close;

  const totalReturn = (finalValue - investment) / investment;
  const winRate = closedTrades > 0 ? wins / closedTrades : 0;

  return {
    totalReturn,
    maxDrawdown,
    winRate,
    tradeCount: trades.length,
    finalValue,
    trades,
    equityCurve,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BacktestPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [smaPeriod, setSmaPeriod] = useState(20);
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [investment, setInvestment] = useState(10000);
  const [submitted, setSubmitted] = useState(false);
  const [runTicker, setRunTicker] = useState('');

  const { data: ohlcvData, isFetching, error } = useQuery<OHLCVData>({
    queryKey: ['ohlcv-backtest', runTicker],
    queryFn: () => eugeneApi<OHLCVData>(`/v1/sec/${runTicker}/ohlcv`, { interval: 'daily' }),
    enabled: !!runTicker && submitted,
    staleTime: 5 * 60 * 1000,
  });

  // Filter bars to date range and run backtest
  const result = useMemo<BacktestResult | null>(() => {
    if (!ohlcvData?.bars?.length) return null;
    const filtered = ohlcvData.bars.filter(
      (b) => b.date >= startDate && b.date <= endDate,
    );
    if (filtered.length < smaPeriod + 5) return null;
    return runSMABacktest(filtered, smaPeriod, investment);
  }, [ohlcvData, startDate, endDate, smaPeriod, investment]);

  function handleRun() {
    if (!ticker.trim()) return;
    setSubmitted(true);
    setRunTicker(ticker.trim().toUpperCase());
  }

  // Equity curve bars normalised to container height
  const equityBars = useMemo(() => {
    if (!result?.equityCurve.length) return [];
    const vals = result.equityCurve.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    // sample down to ~60 bars
    const step = Math.max(1, Math.floor(vals.length / 60));
    return result.equityCurve
      .filter((_, i) => i % step === 0)
      .map((p) => ({ ...p, pct: ((p.value - min) / range) * 100 }));
  }, [result]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            SMA Backtester
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Buy when close crosses above SMA, sell when close crosses below. Live OHLCV data.
        </p>
      </div>

      {/* Config form */}
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Configuration
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Ticker
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ''))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              placeholder="AAPL"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              SMA Period (days)
            </label>
            <input
              type="number"
              value={smaPeriod}
              onChange={(e) => setSmaPeriod(Math.max(2, Math.min(200, Number(e.target.value))))}
              min={2}
              max={200}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Initial Investment ($)
            </label>
            <input
              type="number"
              value={investment}
              onChange={(e) => setInvestment(Math.max(100, Number(e.target.value)))}
              min={100}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={!ticker.trim() || isFetching}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isFetching ? 'Loading data...' : 'Run Backtest'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          Failed to load OHLCV data for <strong>{runTicker}</strong>:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Not enough data */}
      {!isFetching && submitted && ohlcvData && !result && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          Not enough bars in the selected date range for SMA({smaPeriod}). Try a wider range or smaller period.
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Total Return',
                value: `${result.totalReturn >= 0 ? '+' : ''}${(result.totalReturn * 100).toFixed(2)}%`,
                positive: result.totalReturn >= 0,
              },
              {
                label: 'Max Drawdown',
                value: `-${(result.maxDrawdown * 100).toFixed(2)}%`,
                positive: false,
              },
              {
                label: 'Win Rate',
                value: `${(result.winRate * 100).toFixed(1)}%`,
                positive: result.winRate >= 0.5,
              },
              {
                label: 'Trade Count',
                value: String(result.tradeCount),
                positive: true,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p
                  className={cn(
                    'mt-1 text-xl font-bold',
                    card.positive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">Final portfolio: </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {formatCurrency(result.finalValue)}
            </span>
            <span className="ml-2 text-xs text-slate-400">
              from {formatCurrency(investment)} invested
            </span>
          </div>

          {/* Equity curve */}
          {equityBars.length > 0 && (
            <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Equity Curve
              </h2>
              <div className="flex h-24 items-end gap-px">
                {equityBars.map((bar, i) => (
                  <div
                    key={i}
                    title={`${bar.date}: ${formatCurrency(bar.value)}`}
                    className={cn(
                      'flex-1 rounded-sm transition-colors',
                      bar.value >= investment
                        ? 'bg-emerald-500/70'
                        : 'bg-red-500/70',
                    )}
                    style={{ height: `${Math.max(2, bar.pct)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>{equityBars[0]?.date}</span>
                <span>{equityBars[equityBars.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Trade log */}
          {result.trades.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="bg-white px-5 py-3 dark:bg-slate-800/50">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Trade Log ({result.trades.length} trades)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-t border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-2">Date</th>
                      <th className="px-5 py-2">Action</th>
                      <th className="px-5 py-2 text-right">Price</th>
                      <th className="px-5 py-2 text-right">Shares</th>
                      <th className="px-5 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/30">
                    {result.trades.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-5 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {t.date}
                        </td>
                        <td className="px-5 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-medium',
                              t.action === 'Buy'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500 dark:text-red-400',
                            )}
                          >
                            {t.action === 'Buy' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {t.action}
                          </span>
                        </td>
                        <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                          ${t.price.toFixed(2)}
                        </td>
                        <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                          {t.shares}
                        </td>
                        <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                          {formatCurrency(t.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.trades.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50">
              No crossover signals fired in this date range. Try a different SMA period.
            </div>
          )}
        </>
      )}
    </div>
  );
}
