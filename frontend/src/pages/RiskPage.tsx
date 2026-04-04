import { useState, useMemo } from 'react';
import { Shield, TrendingDown, BarChart3, AlertTriangle, Target, Loader2 } from 'lucide-react';
import { useOHLCV } from '../hooks/useOHLCV';
import { cn } from '../lib/utils';
import type { OHLCVBar } from '../lib/types';

// ─── Math helpers ────────────────────────────────────────────────────

function dailyReturns(bars: OHLCVBar[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].close > 0) {
      returns.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function annualizedVolatility(returns: number[]): number {
  return stddev(returns) * Math.sqrt(252);
}

function computeMaxDrawdown(bars: OHLCVBar[]): { maxDrawdown: number; drawdownSeries: { date: string; dd: number }[] } {
  if (bars.length === 0) return { maxDrawdown: 0, drawdownSeries: [] };
  let peak = bars[0].close;
  let maxDrawdown = 0;
  const drawdownSeries: { date: string; dd: number }[] = [];
  for (const bar of bars) {
    if (bar.close > peak) peak = bar.close;
    const dd = peak > 0 ? (bar.close - peak) / peak : 0;
    if (dd < maxDrawdown) maxDrawdown = dd;
    drawdownSeries.push({ date: bar.date, dd });
  }
  return { maxDrawdown, drawdownSeries };
}

function sharpeRatio(returns: number[], rfDaily: number): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - rfDaily);
  const m = mean(excess);
  const s = stddev(excess);
  if (s === 0) return 0;
  return (m / s) * Math.sqrt(252);
}

function varAtPercentile(returns: number[], pct: number): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor(pct * sorted.length);
  return sorted[Math.max(idx, 0)];
}

// ─── Constants ───────────────────────────────────────────────────────

const RISK_FREE_RATE = 0.045; // 4.5% annual
const RF_DAILY = RISK_FREE_RATE / 252;

const DEFAULT_TICKER = 'AAPL';
const QUICK_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY', 'QQQ', 'META', 'GOOGL'];

// ─── Sub-components ──────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  variant = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const colorMap = {
    neutral: 'text-white',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  };
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn('mt-1 text-lg font-bold', colorMap[variant])}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function DrawdownChart({ series }: { series: { date: string; dd: number }[] }) {
  if (series.length === 0) return null;

  // Sample down to ~60 points for display
  const step = Math.max(1, Math.floor(series.length / 60));
  const sampled = series.filter((_, i) => i % step === 0 || i === series.length - 1);
  const minDd = Math.min(...sampled.map((d) => d.dd), -0.001);

  return (
    <svg
      viewBox={`0 0 ${sampled.length} 100`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: 120 }}
    >
      <defs>
        <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polygon
        points={[
          '0,0',
          ...sampled.map((d, i) => `${i},${(d.dd / minDd) * 100}`),
          `${sampled.length - 1},0`,
        ].join(' ')}
        fill="url(#ddGrad)"
      />
      {/* Line */}
      <polyline
        points={sampled.map((d, i) => `${i},${(d.dd / minDd) * 100}`).join(' ')}
        fill="none"
        stroke="#f43f5e"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
      />
      {/* Zero line */}
      <line x1="0" y1="0" x2={sampled.length} y2="0" stroke="#475569" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ─── Main page ───────────────────────────────────────────────────────

export function RiskPage() {
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [inputValue, setInputValue] = useState(DEFAULT_TICKER);

  const { data: ohlcv, isLoading, isError } = useOHLCV(ticker);

  const metrics = useMemo(() => {
    const bars = ohlcv?.bars ?? [];
    if (bars.length < 10) return null;

    const returns = dailyReturns(bars);
    if (returns.length < 5) return null;

    const annVol = annualizedVolatility(returns);
    const sharpe = sharpeRatio(returns, RF_DAILY);
    const { maxDrawdown, drawdownSeries } = computeMaxDrawdown(bars);
    const var5 = varAtPercentile(returns, 0.05); // 5th percentile (VaR 95%)
    const totalReturn = bars.length > 1
      ? (bars[bars.length - 1].close - bars[0].close) / bars[0].close
      : 0;

    // Positive VaR convention: how much you could lose
    const varPct = var5; // negative number

    return {
      annVol,
      sharpe,
      maxDrawdown,
      drawdownSeries,
      varPct,
      returns,
      totalReturn,
      bars,
    };
  }, [ohlcv]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = inputValue.trim().toUpperCase();
    if (t) setTicker(t);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-7 w-7 text-rose-500" />
          Risk Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Volatility, drawdown, Sharpe ratio, and VaR computed from historical OHLCV data
        </p>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            placeholder="Ticker..."
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
          >
            Analyze
          </button>
        </form>
        <div className="flex flex-wrap gap-1">
          {QUICK_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInputValue(t); }}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                ticker === t
                  ? 'bg-rose-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-white',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading OHLCV data for {ticker}…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/20 p-4 text-sm text-rose-400">
          Failed to load data for {ticker}. Check the ticker symbol and try again.
        </div>
      )}

      {!isLoading && !isError && ohlcv && !metrics && (
        <div className="rounded-lg border border-slate-700 p-4 text-sm text-slate-400">
          Not enough bars to compute risk metrics (need at least 10). Got {ohlcv.bars.length}.
        </div>
      )}

      {metrics && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard
              label="Ann. Volatility"
              value={`${(metrics.annVol * 100).toFixed(1)}%`}
              sub="std × √252"
              variant={metrics.annVol > 0.4 ? 'danger' : metrics.annVol > 0.25 ? 'warning' : 'neutral'}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={metrics.sharpe.toFixed(2)}
              sub="rf = 4.5%"
              variant={metrics.sharpe >= 1.5 ? 'success' : metrics.sharpe >= 0.5 ? 'neutral' : 'warning'}
            />
            <MetricCard
              label="Max Drawdown"
              value={`${(metrics.maxDrawdown * 100).toFixed(1)}%`}
              sub="from peak"
              variant="danger"
            />
            <MetricCard
              label="VaR (95%)"
              value={`${(metrics.varPct * 100).toFixed(2)}%`}
              sub="daily, 5th pct"
              variant="danger"
            />
            <MetricCard
              label="Total Return"
              value={`${metrics.totalReturn >= 0 ? '+' : ''}${(metrics.totalReturn * 100).toFixed(1)}%`}
              sub={`${ohlcv?.count ?? metrics.bars.length} bars`}
              variant={metrics.totalReturn >= 0 ? 'success' : 'danger'}
            />
          </div>

          {/* Drawdown chart */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <TrendingDown className="h-4 w-4" />
              Drawdown from Peak — {ticker}
            </h2>
            <DrawdownChart series={metrics.drawdownSeries} />
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
              <span>{metrics.drawdownSeries[0]?.date ?? ''}</span>
              <span>Max: {(metrics.maxDrawdown * 100).toFixed(2)}%</span>
              <span>{metrics.drawdownSeries[metrics.drawdownSeries.length - 1]?.date ?? ''}</span>
            </div>
          </div>

          {/* Return distribution mini-histogram */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <BarChart3 className="h-4 w-4" />
              Daily Return Distribution
            </h2>
            <ReturnHistogram returns={metrics.returns} var5={metrics.varPct} />
          </div>

          {/* Risk summary */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <AlertTriangle className="h-4 w-4" />
              Risk Summary
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <RiskRow label="Annualized Volatility" value={`${(metrics.annVol * 100).toFixed(2)}%`} />
              <RiskRow label="Sharpe Ratio (rf=4.5%)" value={metrics.sharpe.toFixed(3)} />
              <RiskRow label="Maximum Drawdown" value={`${(metrics.maxDrawdown * 100).toFixed(2)}%`} />
              <RiskRow label="VaR 95% (daily)" value={`${(metrics.varPct * 100).toFixed(3)}%`} />
              <RiskRow label="Positive Days" value={`${((metrics.returns.filter((r) => r > 0).length / metrics.returns.length) * 100).toFixed(1)}%`} />
              <RiskRow label="Data Points" value={`${metrics.returns.length} daily returns`} />
            </div>
          </div>

          {/* Interpretation */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Target className="h-4 w-4" />
              Interpretation
            </h2>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>
                <span className="text-slate-300 font-medium">Volatility:</span>{' '}
                {metrics.annVol > 0.4
                  ? 'High — significantly more volatile than a typical large-cap stock.'
                  : metrics.annVol > 0.25
                  ? 'Moderate — above-average risk. Expect larger daily swings.'
                  : 'Low-to-moderate — relatively stable compared to the broad market.'}
              </li>
              <li>
                <span className="text-slate-300 font-medium">Sharpe:</span>{' '}
                {metrics.sharpe >= 1.5
                  ? 'Excellent — strong risk-adjusted return.'
                  : metrics.sharpe >= 1.0
                  ? 'Good — decent compensation for the risk taken.'
                  : metrics.sharpe >= 0
                  ? 'Below average — returns barely exceed the risk-free rate.'
                  : 'Negative — return below the risk-free rate after volatility penalty.'}
              </li>
              <li>
                <span className="text-slate-300 font-medium">VaR 95%:</span>{' '}
                On a typical day, losses should not exceed{' '}
                <span className="text-rose-400 font-medium">{Math.abs(metrics.varPct * 100).toFixed(2)}%</span> with 95% confidence.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Return histogram ─────────────────────────────────────────────────

function ReturnHistogram({ returns, var5 }: { returns: number[]; var5: number }) {
  const BINS = 30;
  if (returns.length === 0) return null;

  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const range = max - min || 0.001;
  const binSize = range / BINS;

  const counts = Array(BINS).fill(0);
  for (const r of returns) {
    const bin = Math.min(Math.floor((r - min) / binSize), BINS - 1);
    counts[bin]++;
  }
  const maxCount = Math.max(...counts);

  return (
    <div>
      <div className="flex items-end gap-0.5" style={{ height: 80 }}>
        {counts.map((count, i) => {
          const binStart = min + i * binSize;
          const isVaR = binStart < var5;
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 rounded-t transition-all"
              style={{
                height: `${height}%`,
                backgroundColor: isVaR ? 'rgba(244,63,94,0.6)' : 'rgba(99,102,241,0.5)',
              }}
              title={`${(binStart * 100).toFixed(2)}%: ${count}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{(min * 100).toFixed(1)}%</span>
        <span className="text-rose-400">VaR 95% tail (red)</span>
        <span>{(max * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function RiskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-700/40 pb-1">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-slate-200 text-xs font-medium font-mono">{value}</span>
    </div>
  );
}
