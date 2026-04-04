import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { eugeneApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { OHLCVData, OHLCVBar } from '../lib/types';

// ─── Math helpers ─────────────────────────────────────────────────────

/**
 * Return the close price N trading days back (from the end of bars).
 * Returns null if not enough bars.
 */
function closeDaysAgo(bars: OHLCVBar[], days: number): number | null {
  if (bars.length <= days) return null;
  return bars[bars.length - 1 - days].close;
}

function pctReturn(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return (to - from) / from;
}

// Approximate trading-day counts
const PERIODS = [
  { label: '1W', days: 5 },
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
] as const;

type PeriodLabel = (typeof PERIODS)[number]['label'];

// ─── Constants ────────────────────────────────────────────────────────

const DEFAULT_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM',
];

const SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', GOOGL: 'Communication',
  AMZN: 'Consumer Disc.', META: 'Communication', TSLA: 'Consumer Disc.', JPM: 'Financials',
  V: 'Financials', JNJ: 'Healthcare', WMT: 'Consumer Staples', XOM: 'Energy',
  UNH: 'Healthcare', MA: 'Financials', PG: 'Consumer Staples', HD: 'Consumer Disc.',
  KO: 'Consumer Staples', PFE: 'Healthcare', LLY: 'Healthcare', NFLX: 'Communication',
  AMD: 'Technology', CRM: 'Technology', DIS: 'Communication', GS: 'Financials',
  MS: 'Financials', COST: 'Consumer Staples', AVGO: 'Technology', ORCL: 'Technology',
  ADBE: 'Technology', INTC: 'Technology', SPY: 'ETF', QQQ: 'ETF', IWM: 'ETF', TLT: 'Bond',
};

// ─── Per-ticker hook ──────────────────────────────────────────────────

function useTickerOHLCV(ticker: string) {
  return useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => eugeneApi<OHLCVData>(`/v1/sec/${ticker}/ohlcv`),
    enabled: !!ticker,
    staleTime: 60 * 1000,
  });
}

// ─── Return cell ──────────────────────────────────────────────────────

function ReturnCell({ value }: { value: number | null }) {
  if (value == null) {
    return <td className="px-3 py-2 text-right text-xs text-slate-600">—</td>;
  }
  const pct = value * 100;
  return (
    <td
      className={cn(
        'px-3 py-2 text-right text-xs font-medium font-mono',
        pct >= 10 ? 'text-emerald-300' :
        pct >= 3  ? 'text-emerald-400' :
        pct >= 0  ? 'text-emerald-500' :
        pct >= -3 ? 'text-red-400' :
        pct >= -10 ? 'text-red-500' :
        'text-red-300',
      )}
    >
      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
    </td>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export function RelativeStrengthPage() {
  const [sortPeriod, setSortPeriod] = useState<PeriodLabel>('3M');
  const [tickerInput, setTickerInput] = useState('');
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);

  // Fixed-count hook calls (max 12 tickers shown to keep rules-of-hooks safe)
  const q0  = useTickerOHLCV(tickers[0]  ?? '');
  const q1  = useTickerOHLCV(tickers[1]  ?? '');
  const q2  = useTickerOHLCV(tickers[2]  ?? '');
  const q3  = useTickerOHLCV(tickers[3]  ?? '');
  const q4  = useTickerOHLCV(tickers[4]  ?? '');
  const q5  = useTickerOHLCV(tickers[5]  ?? '');
  const q6  = useTickerOHLCV(tickers[6]  ?? '');
  const q7  = useTickerOHLCV(tickers[7]  ?? '');
  const q8  = useTickerOHLCV(tickers[8]  ?? '');
  const q9  = useTickerOHLCV(tickers[9]  ?? '');
  const q10 = useTickerOHLCV(tickers[10] ?? '');
  const q11 = useTickerOHLCV(tickers[11] ?? '');

  const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11].slice(0, tickers.length);

  const rows = useMemo(() => {
    return tickers
      .map((ticker, i) => {
        const bars = queries[i]?.data?.bars ?? [];
        const lastClose = bars.length > 0 ? bars[bars.length - 1].close : null;
        const returns: Record<PeriodLabel, number | null> = {} as Record<PeriodLabel, number | null>;
        for (const p of PERIODS) {
          const from = closeDaysAgo(bars, p.days);
          returns[p.label] = pctReturn(from, lastClose);
        }
        return {
          ticker,
          sector: SECTOR_MAP[ticker] ?? 'Other',
          returns,
          lastClose,
          isLoading: queries[i]?.isLoading ?? false,
          isError: queries[i]?.isError ?? false,
          hasData: bars.length > 0,
        };
      })
      .filter((r) => !r.isLoading || r.hasData); // show rows once data arrives
  }, [tickers, q0.data, q1.data, q2.data, q3.data, q4.data, q5.data, q6.data, q7.data, q8.data, q9.data, q10.data, q11.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rank by chosen sort period
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a.returns[sortPeriod] ?? -Infinity;
      const bv = b.returns[sortPeriod] ?? -Infinity;
      return bv - av;
    });
  }, [rows, sortPeriod]);

  const loadingCount = queries.filter((q) => q.isLoading).length;

  const addTicker = (e: React.FormEvent) => {
    e.preventDefault();
    const t = tickerInput.trim().toUpperCase();
    if (t && !tickers.includes(t) && tickers.length < 12) {
      setTickers((prev) => [...prev, t]);
    }
    setTickerInput('');
  };

  const removeTicker = (t: string) => {
    setTickers((prev) => prev.filter((x) => x !== t));
  };

  // Summary stats
  const readyRows = sorted.filter((r) => r.hasData);
  const topTicker = readyRows[0];
  const botTicker = readyRows[readyRows.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Relative Strength</h1>
          <p className="text-sm text-slate-400">
            Returns computed from OHLCV close prices — 1W, 1M, 3M, 6M. Ranked by selected period.
          </p>
        </div>
      </div>

      {/* Ticker management + period sort */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={addTicker} className="flex items-center gap-2">
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            placeholder="Add ticker…"
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Add
          </button>
        </form>
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          <span className="pl-2 text-xs text-slate-500">Sort:</span>
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setSortPeriod(p.label)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                sortPeriod === p.label ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {loadingCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading {loadingCount}…
          </div>
        )}
      </div>

      {/* Summary cards */}
      {readyRows.length >= 2 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Top ({sortPeriod})</div>
            <div className="mt-1 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-lg font-bold text-white">{topTicker?.ticker}</span>
              <span className="text-sm font-medium text-emerald-400">
                {topTicker?.returns[sortPeriod] != null
                  ? `+${(topTicker.returns[sortPeriod]! * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Laggard ({sortPeriod})</div>
            <div className="mt-1 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-lg font-bold text-white">{botTicker?.ticker}</span>
              <span className="text-sm font-medium text-red-400">
                {botTicker?.returns[sortPeriod] != null
                  ? `${(botTicker.returns[sortPeriod]! * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Positive ({sortPeriod})</div>
            <div className="mt-1 text-lg font-bold text-white">
              {readyRows.filter((r) => (r.returns[sortPeriod] ?? 0) > 0).length}
              <span className="text-sm text-slate-400"> / {readyRows.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rankings table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Rank</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Last Close</th>
              {PERIODS.map((p) => (
                <th
                  key={p.label}
                  className={cn(
                    'px-3 py-2 text-right text-xs font-medium cursor-pointer select-none transition-colors',
                    sortPeriod === p.label
                      ? 'text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                  onClick={() => setSortPeriod(p.label)}
                >
                  {p.label} {sortPeriod === p.label && '▾'}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Trend</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-400" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {sorted.map((row, idx) => {
              const trend1m = row.returns['1M'];
              const trend3m = row.returns['3M'];
              const trending =
                trend1m != null && trend3m != null
                  ? trend1m > 0 && trend3m > 0
                    ? 'up'
                    : trend1m < 0 && trend3m < 0
                    ? 'down'
                    : 'flat'
                  : 'flat';
              return (
                <tr key={row.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs text-slate-500">{row.hasData ? idx + 1 : '—'}</td>
                  <td className="px-3 py-2 text-xs font-bold text-indigo-400">{row.ticker}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{row.sector}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300 font-mono">
                    {row.isLoading ? (
                      <Loader2 className="ml-auto h-3 w-3 animate-spin text-slate-500" />
                    ) : row.lastClose != null ? (
                      `$${row.lastClose.toFixed(2)}`
                    ) : '—'}
                  </td>
                  {PERIODS.map((p) => (
                    <ReturnCell key={p.label} value={row.returns[p.label]} />
                  ))}
                  <td className="px-3 py-2 text-center">
                    {trending === 'up' && <ArrowUp className="mx-auto h-3.5 w-3.5 text-emerald-400" />}
                    {trending === 'down' && <ArrowDown className="mx-auto h-3.5 w-3.5 text-red-400" />}
                    {trending === 'flat' && <span className="text-xs text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeTicker(row.ticker)}
                      className="text-slate-600 hover:text-red-400 text-xs"
                      title="Remove"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-500">
                  {loadingCount > 0 ? 'Loading data…' : 'Add tickers above to compare returns.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <p className="text-[11px] text-slate-500">
        Returns approximate trading-day periods: 1W ≈ 5 bars, 1M ≈ 21 bars, 3M ≈ 63 bars, 6M ≈ 126 bars from the latest close.
        Null (—) means insufficient history.
      </p>
    </div>
  );
}
