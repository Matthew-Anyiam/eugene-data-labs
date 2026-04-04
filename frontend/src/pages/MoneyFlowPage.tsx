import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useOHLCV } from '../hooks/useOHLCV';
import { cn } from '../lib/utils';
import type { OHLCVBar } from '../lib/types';

// ─── Money flow indicators ────────────────────────────────────────────

/**
 * Chaikin Money Flow over `period` bars.
 * CMF = SUM(MFV, n) / SUM(Volume, n)
 * Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
 * Money Flow Volume = MFM × Volume
 */
function computeCMF(bars: OHLCVBar[], period = 20): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(bars.length - period);
  let sumMFV = 0, sumVol = 0;
  for (const bar of slice) {
    const hl = bar.high - bar.low;
    if (hl === 0) continue;
    const mfm = ((bar.close - bar.low) - (bar.high - bar.close)) / hl;
    sumMFV += mfm * bar.volume;
    sumVol += bar.volume;
  }
  if (sumVol === 0) return null;
  return sumMFV / sumVol;
}

/**
 * On-Balance Volume (cumulative):
 * OBV[i] = OBV[i-1] + volume  if close > prev_close
 *         = OBV[i-1] - volume  if close < prev_close
 *         = OBV[i-1]           otherwise
 */
function computeOBV(bars: OHLCVBar[]): number[] {
  if (bars.length === 0) return [];
  const obv: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) {
      obv.push(obv[i - 1] + bars[i].volume);
    } else if (bars[i].close < bars[i - 1].close) {
      obv.push(obv[i - 1] - bars[i].volume);
    } else {
      obv.push(obv[i - 1]);
    }
  }
  return obv;
}

/**
 * Accumulation/Distribution Line:
 * CLV = ((Close - Low) - (High - Close)) / (High - Low)
 * AD[i] = AD[i-1] + CLV × Volume
 */
function computeADLine(bars: OHLCVBar[]): number[] {
  if (bars.length === 0) return [];
  const ad: number[] = [];
  let running = 0;
  for (const bar of bars) {
    const hl = bar.high - bar.low;
    const clv = hl === 0 ? 0 : ((bar.close - bar.low) - (bar.high - bar.close)) / hl;
    running += clv * bar.volume;
    ad.push(running);
  }
  return ad;
}

// ─── Constants ────────────────────────────────────────────────────────

const DEFAULT_TICKER = 'AAPL';
const QUICK_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'JPM', 'SPY', 'QQQ'];
const CMF_PERIOD = 20;

// ─── Mini OBV/AD sparkline ────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 200, H = 40;
  if (values.length < 2) return <div className="h-10 w-full rounded bg-slate-800" />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = W / (values.length - 1);

  const points = values
    .map((v, i) => `${i * step},${H - ((v - min) / range) * H}`)
    .join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 40 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ─── CMF mini bar ────────────────────────────────────────────────────

function CMFBar({ value }: { value: number }) {
  const pct = Math.abs(value) * 100; // |CMF| × 100%
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 h-4 rounded bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-px h-full bg-slate-600" />
        </div>
        <div
          className={cn('absolute top-0 h-full rounded-sm', value >= 0 ? 'bg-emerald-500/60 left-1/2' : 'bg-rose-500/60')}
          style={{
            width: `${Math.min(pct, 50)}%`,
            ...(value < 0 ? { left: `${50 - Math.min(pct, 50)}%` } : {}),
          }}
        />
      </div>
      <span className={cn('w-14 text-right text-xs font-mono font-medium', value >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
        {value >= 0 ? '+' : ''}{value.toFixed(4)}
      </span>
    </div>
  );
}

// ─── Interpretation badge ─────────────────────────────────────────────

function SignalBadge({ signal }: { signal: 'Accumulation' | 'Distribution' | 'Neutral' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
      signal === 'Accumulation' ? 'bg-emerald-900/40 text-emerald-400' :
      signal === 'Distribution' ? 'bg-rose-900/40 text-rose-400' :
      'bg-slate-700 text-slate-300',
    )}>
      {signal === 'Accumulation' && <TrendingUp className="h-3 w-3" />}
      {signal === 'Distribution' && <TrendingDown className="h-3 w-3" />}
      {signal}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export function MoneyFlowPage() {
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [inputValue, setInputValue] = useState(DEFAULT_TICKER);

  const { data: ohlcv, isLoading, isError } = useOHLCV(ticker);

  const computed = useMemo(() => {
    const bars = ohlcv?.bars ?? [];
    if (bars.length < 5) return null;

    const cmf = computeCMF(bars, CMF_PERIOD);
    const obvSeries = computeOBV(bars);
    const adSeries = computeADLine(bars);

    const obvCurrent = obvSeries[obvSeries.length - 1] ?? 0;
    const obvPrev = obvSeries.length > 5 ? obvSeries[obvSeries.length - 6] : obvSeries[0];
    const obvChange = obvPrev !== 0 ? (obvCurrent - obvPrev) / Math.abs(obvPrev) : 0;

    const adCurrent = adSeries[adSeries.length - 1] ?? 0;
    const adPrev = adSeries.length > 5 ? adSeries[adSeries.length - 6] : adSeries[0];
    const adChange = adPrev !== 0 ? (adCurrent - adPrev) / Math.abs(adPrev) : 0;

    const signal: 'Accumulation' | 'Distribution' | 'Neutral' =
      cmf != null && cmf > 0.05
        ? 'Accumulation'
        : cmf != null && cmf < -0.05
        ? 'Distribution'
        : 'Neutral';

    // Rolling 20-bar CMF series for the mini chart
    const cmfSeries: number[] = [];
    for (let i = CMF_PERIOD; i <= bars.length; i++) {
      const val = computeCMF(bars.slice(0, i), CMF_PERIOD);
      if (val != null) cmfSeries.push(val);
    }

    return {
      cmf,
      obvSeries,
      obvCurrent,
      obvChange,
      adSeries,
      adCurrent,
      adChange,
      signal,
      cmfSeries,
      bars,
      count: bars.length,
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
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Money Flow</h1>
          <p className="text-sm text-slate-400">
            CMF (20), OBV, and A/D Line computed from OHLCV — no seeds
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
            Load
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
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading OHLCV data for {ticker}…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/20 p-4 text-sm text-rose-400">
          Failed to load data for {ticker}. Check the symbol and try again.
        </div>
      )}

      {!isLoading && !isError && ohlcv && !computed && (
        <div className="rounded-lg border border-slate-700 p-4 text-sm text-slate-400">
          Not enough bars to compute indicators (got {ohlcv.bars.length}, need at least {CMF_PERIOD}).
        </div>
      )}

      {computed && (
        <>
          {/* Signal banner */}
          <div className={cn(
            'rounded-xl border p-4',
            computed.signal === 'Accumulation' ? 'border-emerald-700/50 bg-emerald-950/20' :
            computed.signal === 'Distribution' ? 'border-rose-700/50 bg-rose-950/20' :
            'border-slate-700 bg-slate-800/30',
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Money Flow Signal — {ticker}</div>
                <SignalBadge signal={computed.signal} />
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{computed.count} bars loaded</div>
                <div>CMF period: {CMF_PERIOD}</div>
              </div>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* CMF */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 uppercase tracking-wider">CMF ({CMF_PERIOD})</span>
                <SignalBadge signal={computed.signal} />
              </div>
              <div className={cn('text-3xl font-bold font-mono', computed.cmf != null && computed.cmf >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {computed.cmf != null ? `${computed.cmf >= 0 ? '+' : ''}${computed.cmf.toFixed(4)}` : '—'}
              </div>
              <CMFBar value={computed.cmf ?? 0} />
              <p className="text-[10px] text-slate-500">
                Range −1 to +1. Above +0.05 = buying pressure. Below −0.05 = selling pressure.
              </p>
            </div>

            {/* OBV */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">On-Balance Volume</div>
              <div className={cn('text-2xl font-bold font-mono', computed.obvChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {computed.obvCurrent >= 0 ? '+' : ''}{(computed.obvCurrent / 1_000_000).toFixed(2)}M
              </div>
              <div className={cn('text-sm font-medium', computed.obvChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                5-bar change: {computed.obvChange >= 0 ? '+' : ''}{(computed.obvChange * 100).toFixed(2)}%
              </div>
              <Sparkline values={computed.obvSeries} color={computed.obvChange >= 0 ? '#34d399' : '#f87171'} />
              <p className="text-[10px] text-slate-500">
                Rising OBV with rising price = confirmed trend. Divergence = warning.
              </p>
            </div>

            {/* A/D Line */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Accumulation/Distribution</div>
              <div className={cn('text-2xl font-bold font-mono', computed.adChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {computed.adCurrent >= 0 ? '+' : ''}{(computed.adCurrent / 1_000_000).toFixed(2)}M
              </div>
              <div className={cn('text-sm font-medium', computed.adChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                5-bar change: {computed.adChange >= 0 ? '+' : ''}{(computed.adChange * 100).toFixed(2)}%
              </div>
              <Sparkline values={computed.adSeries} color={computed.adChange >= 0 ? '#818cf8' : '#f87171'} />
              <p className="text-[10px] text-slate-500">
                Close relative to range weighted by volume. Positive = closing near high.
              </p>
            </div>
          </div>

          {/* CMF rolling chart */}
          {computed.cmfSeries.length > 3 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">Rolling CMF ({CMF_PERIOD}) History</h3>
              <RollingCMFChart series={computed.cmfSeries} />
              <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                <span>Oldest</span>
                <span className={cn('font-mono', computed.cmf != null && computed.cmf >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  Current: {computed.cmf != null ? `${computed.cmf >= 0 ? '+' : ''}${computed.cmf.toFixed(4)}` : '—'}
                </span>
                <span>Latest</span>
              </div>
            </div>
          )}

          {/* Interpretation */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">Interpretation</h3>
            <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-400">
              <div>
                <span className="text-slate-300 font-medium block mb-0.5">CMF</span>
                {computed.cmf == null
                  ? 'Insufficient data.'
                  : computed.cmf > 0.1
                  ? 'Strong buying pressure — institutions likely accumulating.'
                  : computed.cmf > 0.05
                  ? 'Mild buying pressure. Monitor for continuation.'
                  : computed.cmf < -0.1
                  ? 'Strong selling pressure — distribution in progress.'
                  : computed.cmf < -0.05
                  ? 'Mild selling pressure. Watch for breakdown.'
                  : 'Neutral — no dominant flow direction.'}
              </div>
              <div>
                <span className="text-slate-300 font-medium block mb-0.5">OBV Trend</span>
                {computed.obvChange > 0.02
                  ? 'OBV rising — volume confirming price strength.'
                  : computed.obvChange < -0.02
                  ? 'OBV falling — volume suggests underlying weakness.'
                  : 'OBV flat — inconclusive volume direction.'}
              </div>
              <div>
                <span className="text-slate-300 font-medium block mb-0.5">A/D Line</span>
                {computed.adChange > 0.02
                  ? 'A/D rising — stock consistently closing near highs on higher volume.'
                  : computed.adChange < -0.02
                  ? 'A/D falling — closing near lows. Bearish money flow.'
                  : 'A/D flat — balanced closes within daily range.'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Rolling CMF chart ────────────────────────────────────────────────

function RollingCMFChart({ series }: { series: number[] }) {
  const W = 400, H = 80;
  const step = W / Math.max(series.length - 1, 1);
  const maxAbs = Math.max(...series.map(Math.abs), 0.01);

  const posPoints = series
    .map((v, i) => `${i * step},${H / 2 - (v / maxAbs) * (H / 2)}`)
    .join(' ');

  // Separate positive and negative fills
  const posPoly = series
    .map((v, i) => [i * step, H / 2 - Math.max(v, 0) / maxAbs * (H / 2)])
    .flatMap(([x, y]) => [`${x},${y}`]);

  const negPoly = series
    .map((v, i) => [i * step, H / 2 - Math.min(v, 0) / maxAbs * (H / 2)])
    .flatMap(([x, y]) => [`${x},${y}`]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 80 }}>
      {/* Zero line */}
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#475569" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      {/* Positive fill */}
      <polygon
        points={[`0,${H / 2}`, ...posPoly, `${(series.length - 1) * step},${H / 2}`].join(' ')}
        fill="rgba(52,211,153,0.2)"
      />
      {/* Negative fill */}
      <polygon
        points={[`0,${H / 2}`, ...negPoly, `${(series.length - 1) * step},${H / 2}`].join(' ')}
        fill="rgba(248,113,113,0.2)"
      />
      {/* Line */}
      <polyline
        points={posPoints}
        fill="none"
        stroke="#818cf8"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
