import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { usePrices } from '../hooks/usePrices';
import { cn, formatPrice } from '../lib/utils';

/* ── deterministic PRNG ─────────────────────────────────── */
function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

/* ── types ───────────────────────────────────────────────── */
interface OptionLeg {
  last: number;
  change: number;
  bid: number;
  ask: number;
  volume: number;
  oi: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface Strike {
  strike: number;
  call: OptionLeg;
  put: OptionLeg;
}

/* ── quick-select tickers ────────────────────────────────── */
const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'SPY', 'QQQ'];

/* ── mock expiration generator ───────────────────────────── */
function getExpirations(): string[] {
  const base = new Date('2026-04-03');
  const exps: string[] = [];
  // next 2 weekly, then 4 monthly
  for (let w = 0; w < 2; w++) {
    const d = new Date(base);
    d.setDate(d.getDate() + (w + 1) * 7);
    exps.push(d.toISOString().slice(0, 10));
  }
  for (let m = 1; m <= 4; m++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + m);
    // third Friday
    d.setDate(1);
    const dow = d.getDay();
    const fri = dow <= 5 ? 5 - dow : 6;
    d.setDate(1 + fri + 14);
    exps.push(d.toISOString().slice(0, 10));
  }
  return exps;
}

/* ── data generation ─────────────────────────────────────── */
function generateChain(ticker: string, basePrice: number, expDate: string): Strike[] {
  const s = seed(ticker + expDate);
  const increment = basePrice > 100 ? 5 : 2.5;
  const numStrikes = 17;
  const center = Math.round(basePrice / increment) * increment;
  const startStrike = center - Math.floor(numStrikes / 2) * increment;

  // days to expiration
  const dte = Math.max(1, Math.round((new Date(expDate).getTime() - new Date('2026-04-03').getTime()) / 86400000));
  const t = dte / 365;

  const strikes: Strike[] = [];
  for (let idx = 0; idx < numStrikes; idx++) {
    const strike = startStrike + idx * increment;
    const moneyness = (basePrice - strike) / basePrice;
    const r = pseudo(s, idx * 100);

    // simplified pricing
    const sqrtT = Math.sqrt(t);
    const baseIV = 0.25 + pseudo(s, idx * 7) * 0.15;
    const callIV = baseIV + Math.max(0, -moneyness) * 0.3;
    const putIV = baseIV + Math.max(0, moneyness) * 0.3;

    const callIntrinsic = Math.max(0, basePrice - strike);
    const putIntrinsic = Math.max(0, strike - basePrice);
    const callTimeVal = basePrice * callIV * sqrtT * 0.4 * Math.exp(-Math.abs(moneyness) * 3);
    const putTimeVal = basePrice * putIV * sqrtT * 0.4 * Math.exp(-Math.abs(moneyness) * 3);

    const callLast = Math.max(0.01, callIntrinsic + callTimeVal);
    const putLast = Math.max(0.01, putIntrinsic + putTimeVal);

    // delta approximation
    const callDelta = Math.min(0.99, Math.max(0.01, 0.5 + moneyness * 3));
    const putDelta = callDelta - 1;

    const gamma = Math.max(0.001, 0.05 * Math.exp(-moneyness * moneyness * 20));
    const callTheta = -(callLast * callIV) / (2 * sqrtT * 365) * (0.8 + r * 0.4);
    const putTheta = -(putLast * putIV) / (2 * sqrtT * 365) * (0.8 + r * 0.4);
    const vegaVal = basePrice * sqrtT * gamma * 100;

    const spread = Math.max(0.01, callLast * 0.03);

    const callVol = Math.round(500 + pseudo(s, idx * 13) * 8000);
    const putVol = Math.round(400 + pseudo(s, idx * 17) * 6000);

    strikes.push({
      strike: Math.round(strike * 100) / 100,
      call: {
        last: round2(callLast),
        change: round2((pseudo(s, idx * 3) - 0.45) * callLast * 0.15),
        bid: round2(Math.max(0, callLast - spread)),
        ask: round2(callLast + spread),
        volume: callVol,
        oi: Math.round(callVol * (2 + pseudo(s, idx * 19) * 8)),
        iv: round2(callIV * 100),
        delta: round4(callDelta),
        gamma: round4(gamma),
        theta: round4(callTheta),
        vega: round4(vegaVal),
        rho: round4(callDelta * strike * t * 0.01),
      },
      put: {
        last: round2(putLast),
        change: round2((pseudo(s, idx * 5) - 0.5) * putLast * 0.15),
        bid: round2(Math.max(0, putLast - spread)),
        ask: round2(putLast + spread),
        volume: putVol,
        oi: Math.round(putVol * (2 + pseudo(s, idx * 23) * 8)),
        iv: round2(putIV * 100),
        delta: round4(putDelta),
        gamma: round4(gamma),
        theta: round4(putTheta),
        vega: round4(vegaVal),
        rho: round4(putDelta * strike * t * 0.01),
      },
    });
  }
  return strikes;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }

function getBasePrice(ticker: string): number {
  const prices: Record<string, number> = {
    AAPL: 178.50, MSFT: 415.20, TSLA: 172.80, NVDA: 880.40,
    GOOGL: 155.30, AMZN: 185.60, SPY: 520.75, QQQ: 445.30,
  };
  if (prices[ticker]) return prices[ticker];
  const s = seed(ticker);
  return round2(20 + pseudo(s, 1) * 400);
}

/* ── column headers ──────────────────────────────────────── */
const COL_HEADERS = ['Last', 'Chg', 'Bid', 'Ask', 'Vol', 'OI', 'IV'];

/* ── component ───────────────────────────────────────────── */
export function OptionsPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [input, setInput] = useState('AAPL');
  const [expIdx, setExpIdx] = useState(0);
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [nearMoney, setNearMoney] = useState(false);
  const [straddle, setStraddle] = useState(false);

  const { data: priceData } = usePrices(ticker);
  const expirations = useMemo(getExpirations, []);

  const basePrice = priceData?.price ?? getBasePrice(ticker);

  const chain = useMemo(
    () => generateChain(ticker, basePrice, expirations[expIdx]),
    [ticker, basePrice, expirations, expIdx],
  );

  const filtered = useMemo(() => {
    if (!nearMoney) return chain;
    const centerIdx = chain.reduce((best, s, i, arr) =>
      Math.abs(s.strike - basePrice) < Math.abs(arr[best].strike - basePrice) ? i : best, 0);
    return chain.slice(Math.max(0, centerIdx - 5), centerIdx + 6);
  }, [chain, nearMoney, basePrice]);

  const totalCallVol = chain.reduce((a, s) => a + s.call.volume, 0);
  const totalPutVol = chain.reduce((a, s) => a + s.put.volume, 0);
  const pcRatio = totalCallVol > 0 ? round2(totalPutVol / totalCallVol) : 0;
  const maxPainStrike = chain.reduce((best, s) =>
    (s.call.oi + s.put.oi) > (best.call.oi + best.put.oi) ? s : best, chain[0]).strike;
  const avgIV = round2(chain.reduce((a, s) => a + s.call.iv + s.put.iv, 0) / (chain.length * 2));

  const selected = selectedStrike !== null
    ? chain.find(s => s.strike === selectedStrike) ?? null
    : null;

  function handleSearch() {
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setExpIdx(0); setSelectedStrike(null); }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Options Chain</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Real-time options pricing, greeks, and volume analysis
        </p>
      </div>

      {/* Ticker input + quick select */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex">
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ticker..."
            className="w-28 rounded-l-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="rounded-r-lg border border-l-0 border-slate-700 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Go
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInput(t); setExpIdx(0); setSelectedStrike(null); }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                t === ticker
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Link to={`/company/${ticker}`} className="ml-auto text-xs text-blue-400 hover:text-blue-300">
          View {ticker} profile &rarr;
        </Link>
      </div>

      {/* Price banner */}
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-xl font-bold text-white">{ticker}</span>
        <span className="text-lg text-white">{formatPrice(basePrice)}</span>
        {priceData && (
          <span className={cn('text-sm font-medium', priceData.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {priceData.change >= 0 ? '+' : ''}{priceData.change.toFixed(2)} ({priceData.change_percent.toFixed(2)}%)
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Call Volume', value: totalCallVol.toLocaleString() },
          { label: 'Put Volume', value: totalPutVol.toLocaleString() },
          { label: 'P/C Ratio', value: pcRatio.toFixed(2) },
          { label: 'Max Pain', value: formatPrice(maxPainStrike) },
          { label: 'Avg IV', value: `${avgIV.toFixed(1)}%` },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className="mt-1 text-lg font-semibold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Expiration tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Expiry:</span>
        {expirations.map((exp, i) => (
          <button
            key={exp}
            onClick={() => { setExpIdx(i); setSelectedStrike(null); }}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition',
              i === expIdx
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700',
            )}
          >
            {exp}
          </button>
        ))}
      </div>

      {/* Controls: strike filter + straddle toggle */}
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => setNearMoney(v => !v)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium border transition',
            nearMoney
              ? 'border-blue-500 bg-blue-600/20 text-blue-300'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white',
          )}
        >
          {nearMoney ? 'Near Money (±5)' : 'All Strikes'}
        </button>
        <button
          onClick={() => setStraddle(v => !v)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium border transition',
            straddle
              ? 'border-blue-500 bg-blue-600/20 text-blue-300'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white',
          )}
        >
          {straddle ? 'Straddle View' : 'Standard View'}
        </button>
      </div>

      {/* Options chain table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              {!straddle && (
                <>
                  <th colSpan={7} className="border-r border-slate-700 px-2 py-2 text-center font-semibold text-emerald-400">
                    <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> CALLS</span>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-white">Strike</th>
                  <th colSpan={7} className="border-l border-slate-700 px-2 py-2 text-center font-semibold text-red-400">
                    <span className="inline-flex items-center gap-1"><TrendingDown className="h-3 w-3" /> PUTS</span>
                  </th>
                </>
              )}
              {straddle && (
                <>
                  <th className="px-3 py-2 text-center font-semibold text-white">Strike</th>
                  <th colSpan={7} className="border-l border-slate-700 px-2 py-2 text-center font-semibold text-emerald-400">
                    <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> CALL</span>
                  </th>
                  <th colSpan={7} className="border-l border-slate-700 px-2 py-2 text-center font-semibold text-red-400">
                    <span className="inline-flex items-center gap-1"><TrendingDown className="h-3 w-3" /> PUT</span>
                  </th>
                  <th className="border-l border-slate-700 px-3 py-2 text-center font-semibold text-yellow-400">Straddle</th>
                </>
              )}
            </tr>
            <tr className="border-b border-slate-700 bg-slate-800/50 text-slate-400">
              {!straddle && (
                <>
                  {COL_HEADERS.map(h => <th key={'c' + h} className="px-2 py-1.5 text-right font-medium">{h}</th>)}
                  <th className="border-x border-slate-700 px-3 py-1.5 text-center font-medium">$</th>
                  {COL_HEADERS.map(h => <th key={'p' + h} className="px-2 py-1.5 text-right font-medium">{h}</th>)}
                </>
              )}
              {straddle && (
                <>
                  <th className="px-3 py-1.5 text-center font-medium">$</th>
                  {COL_HEADERS.map(h => <th key={'c' + h} className="border-l-0 px-2 py-1.5 text-right font-medium">{h}</th>)}
                  {COL_HEADERS.map(h => <th key={'p' + h} className="px-2 py-1.5 text-right font-medium">{h}</th>)}
                  <th className="border-l border-slate-700 px-3 py-1.5 text-center font-medium">Cost</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => {
              const callITM = row.strike < basePrice;
              const putITM = row.strike > basePrice;
              const isAtm = Math.abs(row.strike - basePrice) < (basePrice > 100 ? 2.5 : 1.25);
              const isSelected = row.strike === selectedStrike;

              return (
                <tr
                  key={row.strike}
                  onClick={() => setSelectedStrike(row.strike === selectedStrike ? null : row.strike)}
                  className={cn(
                    'cursor-pointer border-b border-slate-700/50 transition hover:bg-slate-700/40',
                    isSelected && 'bg-blue-900/30',
                    isAtm && 'bg-yellow-900/10',
                  )}
                >
                  {!straddle && (
                    <>
                      {renderLeg(row.call, callITM)}
                      <td className={cn(
                        'border-x border-slate-700 px-3 py-1.5 text-center font-bold',
                        isAtm ? 'text-yellow-400' : 'text-white',
                      )}>
                        {row.strike.toFixed(2)}
                      </td>
                      {renderLeg(row.put, putITM)}
                    </>
                  )}
                  {straddle && (
                    <>
                      <td className={cn(
                        'px-3 py-1.5 text-center font-bold',
                        isAtm ? 'text-yellow-400' : 'text-white',
                      )}>
                        {row.strike.toFixed(2)}
                      </td>
                      {renderLeg(row.call, callITM)}
                      {renderLeg(row.put, putITM)}
                      <td className="border-l border-slate-700 px-3 py-1.5 text-center font-medium text-yellow-300">
                        {(row.call.last + row.put.last).toFixed(2)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Greeks panel */}
      {selected && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">
            Greeks for {ticker} {formatPrice(selected.strike)} Strike &mdash; {expirations[expIdx]}
          </h3>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-emerald-400">Call</div>
              <GreeksGrid leg={selected.call} />
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-red-400">Put</div>
              <GreeksGrid leg={selected.put} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── sub-components ──────────────────────────────────────── */

function renderLeg(leg: OptionLeg, itm: boolean) {
  return (
    <>
      <td className={cn('px-2 py-1.5 text-right tabular-nums', itm ? 'bg-blue-900/20 text-white' : 'text-slate-300')}>
        {leg.last.toFixed(2)}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums', leg.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
        {leg.change >= 0 ? '+' : ''}{leg.change.toFixed(2)}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums', itm ? 'bg-blue-900/20 text-slate-300' : 'text-slate-400')}>
        {leg.bid.toFixed(2)}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums', itm ? 'bg-blue-900/20 text-slate-300' : 'text-slate-400')}>
        {leg.ask.toFixed(2)}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums', itm ? 'bg-blue-900/20 text-slate-400' : 'text-slate-500')}>
        {leg.volume.toLocaleString()}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums', itm ? 'bg-blue-900/20 text-slate-400' : 'text-slate-500')}>
        {leg.oi.toLocaleString()}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums', itm ? 'bg-blue-900/20 text-slate-400' : 'text-slate-500')}>
        {leg.iv.toFixed(1)}%
      </td>
    </>
  );
}

function GreeksGrid({ leg }: { leg: OptionLeg }) {
  const greeks = [
    { label: 'Delta', value: leg.delta.toFixed(4) },
    { label: 'Gamma', value: leg.gamma.toFixed(4) },
    { label: 'Theta', value: leg.theta.toFixed(4) },
    { label: 'Vega', value: leg.vega.toFixed(4) },
    { label: 'Rho', value: leg.rho.toFixed(4) },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {greeks.map(g => (
        <div key={g.label} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-center">
          <div className="text-[10px] text-slate-500">{g.label}</div>
          <div className="text-xs font-mono tabular-nums text-white">{g.value}</div>
        </div>
      ))}
    </div>
  );
}
