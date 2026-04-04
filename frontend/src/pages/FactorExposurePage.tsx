import { useState, useMemo } from 'react';
import { Sliders, Loader2 } from 'lucide-react';
import { useOHLCV } from '../hooks/useOHLCV';
import { useMetrics } from '../hooks/useMetrics';
import { cn } from '../lib/utils';
import type { OHLCVBar } from '../lib/types';

// ─── Math helpers ─────────────────────────────────────────────────────

function dailyReturns(bars: OHLCVBar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].close > 0) {
      out.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
    }
  }
  return out;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function annualizedVolatility(returns: number[]): number {
  return stddev(returns) * Math.sqrt(252);
}

function momentumReturn(bars: OHLCVBar[], days: number): number | null {
  if (bars.length <= days) return null;
  const from = bars[bars.length - 1 - days].close;
  const to = bars[bars.length - 1].close;
  if (from === 0) return null;
  return (to - from) / from;
}

/**
 * Normalize a raw metric value into a -1..+1 score where 0 = neutral.
 * Direction: higher = better (e.g., ROE), unless inverted (e.g., P/E).
 */
function scoreFromRatio(value: number | undefined, low: number, high: number, invert = false): number | null {
  if (value == null || !isFinite(value)) return null;
  const clamped = Math.max(low, Math.min(high, value));
  const normalized = (clamped - low) / (high - low); // 0..1
  const score = normalized * 2 - 1; // -1..+1
  return invert ? -score : score;
}

// ─── Factor configuration ─────────────────────────────────────────────

const FACTOR_META = {
  Value: {
    color: { bar: 'bg-blue-500', text: 'text-blue-400', badge: 'bg-blue-900/30 text-blue-300' },
    desc: 'Low P/E and P/B relative to market. Higher score = cheaper valuation.',
  },
  Momentum: {
    color: { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-900/30 text-emerald-300' },
    desc: '1M and 3M price momentum from OHLCV. Higher score = stronger recent trend.',
  },
  Quality: {
    color: { bar: 'bg-purple-500', text: 'text-purple-400', badge: 'bg-purple-900/30 text-purple-300' },
    desc: 'ROE, net margin, and operating margin. Higher score = higher quality business.',
  },
  Volatility: {
    color: { bar: 'bg-rose-500', text: 'text-rose-400', badge: 'bg-rose-900/30 text-rose-300' },
    desc: 'Annualized return std from OHLCV. Lower volatility = higher factor score.',
  },
} as const;

type FactorName = keyof typeof FACTOR_META;

interface FactorScore {
  name: FactorName;
  score: number | null; // -1 to +1
  components: { label: string; raw: string | null; contribution: number | null }[];
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_TICKER = 'AAPL';
const QUICK_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'JPM', 'JNJ', 'XOM', 'META', 'GOOGL', 'V'];

// ─── Main page ────────────────────────────────────────────────────────

export function FactorExposurePage() {
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [inputValue, setInputValue] = useState(DEFAULT_TICKER);

  const { data: ohlcv, isLoading: ohlcvLoading, isError: ohlcvError } = useOHLCV(ticker);
  const { data: metricsResp, isLoading: metricsLoading, isError: metricsError } = useMetrics(ticker);

  const isLoading = ohlcvLoading || metricsLoading;
  const isError = ohlcvError || metricsError;

  const factors = useMemo((): FactorScore[] => {
    const bars = ohlcv?.bars ?? [];
    const periods = metricsResp?.data?.periods ?? [];
    const latestMetrics = periods[0]?.metrics ?? {};

    const returns = dailyReturns(bars);
    const annVol = returns.length > 5 ? annualizedVolatility(returns) : null;
    const mom1m = momentumReturn(bars, 21);
    const mom3m = momentumReturn(bars, 63);

    // ── Value ──
    const pe = latestMetrics.valuation?.['price_to_earnings'];
    const pb = latestMetrics.valuation?.['price_to_book'];
    const peScore = scoreFromRatio(pe, 5, 60, true);  // lower P/E = better value
    const pbScore = scoreFromRatio(pb, 0.5, 15, true); // lower P/B = better value
    const valueScore = peScore != null && pbScore != null
      ? (peScore + pbScore) / 2
      : peScore ?? pbScore ?? null;

    // ── Momentum ──
    const mom1mScore = mom1m != null ? scoreFromRatio(mom1m * 100, -30, 30) : null;
    const mom3mScore = mom3m != null ? scoreFromRatio(mom3m * 100, -50, 50) : null;
    const momentumScore = mom1mScore != null && mom3mScore != null
      ? mom1mScore * 0.4 + mom3mScore * 0.6
      : mom3mScore ?? mom1mScore ?? null;

    // ── Quality ──
    const roe = latestMetrics.profitability?.['return_on_equity'];
    const netMargin = latestMetrics.profitability?.['net_profit_margin'];
    const opMargin = latestMetrics.profitability?.['operating_margin'];
    const roeScore = scoreFromRatio(roe != null ? roe * 100 : undefined, -10, 50);
    const netMarginScore = scoreFromRatio(netMargin != null ? netMargin * 100 : undefined, -20, 40);
    const opMarginScore = scoreFromRatio(opMargin != null ? opMargin * 100 : undefined, -20, 45);
    const qualityComponents = [roeScore, netMarginScore, opMarginScore].filter((s) => s != null) as number[];
    const qualityScore = qualityComponents.length > 0
      ? qualityComponents.reduce((s, v) => s + v, 0) / qualityComponents.length
      : null;

    // ── Volatility (Low-Vol factor: lower vol = higher score) ──
    const volScore = annVol != null ? scoreFromRatio(annVol * 100, 10, 100, true) : null;

    return [
      {
        name: 'Value',
        score: valueScore,
        components: [
          { label: 'P/E Ratio', raw: pe != null ? pe.toFixed(1) : null, contribution: peScore },
          { label: 'P/B Ratio', raw: pb != null ? pb.toFixed(2) : null, contribution: pbScore },
        ],
      },
      {
        name: 'Momentum',
        score: momentumScore,
        components: [
          { label: '1M Return', raw: mom1m != null ? `${(mom1m * 100).toFixed(2)}%` : null, contribution: mom1mScore },
          { label: '3M Return', raw: mom3m != null ? `${(mom3m * 100).toFixed(2)}%` : null, contribution: mom3mScore },
        ],
      },
      {
        name: 'Quality',
        score: qualityScore,
        components: [
          { label: 'ROE', raw: roe != null ? `${(roe * 100).toFixed(1)}%` : null, contribution: roeScore },
          { label: 'Net Margin', raw: netMargin != null ? `${(netMargin * 100).toFixed(1)}%` : null, contribution: netMarginScore },
          { label: 'Op. Margin', raw: opMargin != null ? `${(opMargin * 100).toFixed(1)}%` : null, contribution: opMarginScore },
        ],
      },
      {
        name: 'Volatility',
        score: volScore,
        components: [
          { label: 'Ann. Volatility', raw: annVol != null ? `${(annVol * 100).toFixed(1)}%` : null, contribution: volScore },
        ],
      },
    ];
  }, [ohlcv, metricsResp]);

  const overallScore = useMemo(() => {
    const valid = factors.filter((f) => f.score != null).map((f) => f.score as number);
    if (valid.length === 0) return null;
    return valid.reduce((s, v) => s + v, 0) / valid.length;
  }, [factors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = inputValue.trim().toUpperCase();
    if (t) setTicker(t);
  };

  const hasData = factors.some((f) => f.score != null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sliders className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Factor Exposure</h1>
          <p className="text-sm text-slate-400">
            Value, Momentum, Quality, and Volatility scores from live metrics + OHLCV
          </p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            placeholder="Ticker…"
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Analyze
          </button>
        </form>
        {QUICK_TICKERS.map((t) => (
          <button
            key={t}
            onClick={() => { setTicker(t); setInputValue(t); }}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              ticker === t ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading data for {ticker}…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/20 p-4 text-sm text-rose-400">
          Failed to load data for {ticker}.
        </div>
      )}

      {!isLoading && !isError && !hasData && (
        <div className="rounded-lg border border-slate-700 p-4 text-sm text-slate-400">
          No factor data could be computed for {ticker}. The symbol may not have sufficient OHLCV or metrics history.
        </div>
      )}

      {hasData && (
        <>
          {/* Overall score card */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Overall Factor Score</div>
                <div className={cn(
                  'mt-1 text-3xl font-bold',
                  overallScore == null ? 'text-slate-500' :
                  overallScore >= 0.3 ? 'text-emerald-400' :
                  overallScore >= -0.3 ? 'text-amber-400' :
                  'text-rose-400',
                )}>
                  {overallScore != null
                    ? `${overallScore >= 0 ? '+' : ''}${overallScore.toFixed(2)}`
                    : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Range: −1.0 (worst) to +1.0 (best) · {factors.filter((f) => f.score != null).length}/{factors.length} factors available
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Ticker</div>
                <div className="text-xl font-bold text-indigo-400">{ticker}</div>
              </div>
            </div>
          </div>

          {/* Factor cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {factors.map((factor) => {
              const meta = FACTOR_META[factor.name];
              const score = factor.score;
              const barWidth = score != null ? Math.abs(score) * 50 : 0;
              const isNeg = score != null && score < 0;

              return (
                <div key={factor.name} className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm font-semibold', meta.color.text)}>{factor.name}</span>
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-bold',
                      meta.color.badge,
                    )}>
                      {score != null ? `${score >= 0 ? '+' : ''}${score.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="h-4 w-full rounded bg-slate-900 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-px h-full bg-slate-600" />
                    </div>
                    {score != null && (
                      <div
                        className={cn('absolute top-0 h-full rounded-sm opacity-70', meta.color.bar)}
                        style={{
                          width: `${barWidth}%`,
                          left: isNeg ? `${50 - barWidth}%` : '50%',
                        }}
                      />
                    )}
                  </div>

                  {/* Component breakdown */}
                  <div className="space-y-1">
                    {factor.components.map((c) => (
                      <div key={c.label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{c.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-300 font-mono">{c.raw ?? '—'}</span>
                          {c.contribution != null && (
                            <span className={cn(
                              'font-mono text-[10px]',
                              c.contribution >= 0 ? 'text-emerald-400' : 'text-rose-400',
                            )}>
                              {c.contribution >= 0 ? '+' : ''}{c.contribution.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed">{meta.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Radar-style summary table */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Factor Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="pb-2 text-left text-xs text-slate-400">Factor</th>
                    <th className="pb-2 text-right text-xs text-slate-400">Score</th>
                    <th className="pb-2 text-right text-xs text-slate-400">Signal</th>
                    <th className="pb-2 pr-2 text-xs text-slate-400 w-48">Strength</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {factors.map((f) => {
                    const meta = FACTOR_META[f.name];
                    const pct = f.score != null ? Math.abs(f.score) * 50 : 0;
                    const signal =
                      f.score == null ? 'N/A' :
                      f.score >= 0.5 ? 'Strong positive' :
                      f.score >= 0.2 ? 'Positive' :
                      f.score >= -0.2 ? 'Neutral' :
                      f.score >= -0.5 ? 'Negative' :
                      'Strong negative';
                    return (
                      <tr key={f.name}>
                        <td className={cn('py-2 text-xs font-medium', meta.color.text)}>{f.name}</td>
                        <td className={cn(
                          'py-2 text-right text-xs font-mono',
                          f.score == null ? 'text-slate-500' :
                          f.score >= 0 ? 'text-emerald-400' : 'text-rose-400',
                        )}>
                          {f.score != null ? `${f.score >= 0 ? '+' : ''}${f.score.toFixed(3)}` : '—'}
                        </td>
                        <td className="py-2 text-right text-xs text-slate-400">{signal}</td>
                        <td className="py-2 pr-2">
                          <div className="h-2.5 w-full rounded-full bg-slate-700 overflow-hidden">
                            {f.score != null && (
                              <div
                                className={cn('h-full rounded-full', meta.color.bar, 'opacity-70')}
                                style={{ width: `${pct * 2}%` }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
