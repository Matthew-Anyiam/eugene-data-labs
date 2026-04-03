import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ',
  'WMT', 'XOM', 'UNH', 'MA', 'PG', 'HD', 'KO', 'PFE', 'LLY', 'NFLX',
  'AMD', 'CRM', 'DIS', 'GS', 'MS', 'COST', 'AVGO', 'ORCL', 'ADBE', 'INTC',
];

const SECTORS = ['Technology', 'Healthcare', 'Financials', 'Consumer Disc.', 'Industrials', 'Energy', 'Consumer Staples', 'Utilities', 'Materials', 'Real Estate', 'Communication'];
const SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Communication', AMZN: 'Consumer Disc.',
  NVDA: 'Technology', META: 'Communication', TSLA: 'Consumer Disc.', JPM: 'Financials',
  V: 'Financials', JNJ: 'Healthcare', WMT: 'Consumer Staples', XOM: 'Energy',
  UNH: 'Healthcare', MA: 'Financials', PG: 'Consumer Staples', HD: 'Consumer Disc.',
  KO: 'Consumer Staples', PFE: 'Healthcare', LLY: 'Healthcare', NFLX: 'Communication',
  AMD: 'Technology', CRM: 'Technology', DIS: 'Communication', GS: 'Financials',
  MS: 'Financials', COST: 'Consumer Staples', AVGO: 'Technology', ORCL: 'Technology',
  ADBE: 'Technology', INTC: 'Technology',
};

type Timeframe = '1W' | '1M' | '3M' | '6M' | '1Y';

interface RSData {
  ticker: string;
  sector: string;
  rsRating: number; // 1-99
  rsRank: number;
  priceChange: Record<Timeframe, number>;
  rs50d: number;
  rs200d: number;
  newHigh52w: boolean;
  distFromHigh: number;
  trend: 'up' | 'down' | 'flat';
}

function genRSData(): RSData[] {
  return TICKERS.map(ticker => {
    const s = seed(ticker + '_rs');
    const rsRating = Math.floor(1 + pseudo(s, 0) * 98);
    return {
      ticker,
      sector: SECTOR_MAP[ticker] || 'Technology',
      rsRating,
      rsRank: 0,
      priceChange: {
        '1W': +((pseudo(s, 1) - 0.45) * 8).toFixed(2),
        '1M': +((pseudo(s, 2) - 0.4) * 15).toFixed(2),
        '3M': +((pseudo(s, 3) - 0.35) * 25).toFixed(2),
        '6M': +((pseudo(s, 4) - 0.3) * 40).toFixed(2),
        '1Y': +((pseudo(s, 5) - 0.25) * 60).toFixed(2),
      },
      rs50d: +(50 + pseudo(s, 6) * 49).toFixed(0),
      rs200d: +(40 + pseudo(s, 7) * 59).toFixed(0),
      newHigh52w: pseudo(s, 8) > 0.7,
      distFromHigh: +(-pseudo(s, 9) * 30).toFixed(1),
      trend: pseudo(s, 10) > 0.6 ? 'up' : pseudo(s, 10) < 0.3 ? 'down' : 'flat',
    };
  }).sort((a, b) => b.rsRating - a.rsRating).map((d, i) => ({ ...d, rsRank: i + 1 }));
}

function genSectorRS() {
  return SECTORS.map(sector => {
    const s = seed(sector + '_srs');
    return {
      sector,
      rs: Math.floor(1 + pseudo(s, 0) * 98),
      change1m: +((pseudo(s, 1) - 0.4) * 15).toFixed(2),
      change3m: +((pseudo(s, 2) - 0.35) * 25).toFixed(2),
    };
  }).sort((a, b) => b.rs - a.rs);
}

export function RelativeStrengthPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('3M');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'rankings' | 'sectors' | 'leaders'>('rankings');

  const data = useMemo(() => genRSData(), []);
  const sectorRS = useMemo(() => genSectorRS(), []);

  const filtered = data.filter(d => !search || d.ticker.includes(search.toUpperCase()));
  const leaders = data.filter(d => d.rsRating >= 80);
  const laggards = data.filter(d => d.rsRating <= 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Relative Strength</h1>
          <p className="text-sm text-slate-400">Momentum rankings, sector rotation, and RS leaders</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">RS Leaders (80+)</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{leaders.length}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">RS Laggards (20-)</div>
          <div className="mt-1 text-2xl font-bold text-red-400">{laggards.length}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Top Sector</div>
          <div className="mt-1 text-lg font-bold text-white">{sectorRS[0]?.sector}</div>
          <div className="text-xs text-slate-500">RS: {sectorRS[0]?.rs}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">52W Highs</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{data.filter(d => d.newHigh52w).length}</div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['rankings', 'sectors', 'leaders'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', view === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {v === 'leaders' ? 'Leaders & Laggards' : v}
            </button>
          ))}
        </div>
        {view === 'rankings' && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
                placeholder="Filter..." className="w-32 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {(['1W', '1M', '3M', '6M', '1Y'] as Timeframe[]).map(t => (
                <button key={t} onClick={() => setTimeframe(t)}
                  className={cn('rounded-md px-2.5 py-1 text-xs font-medium', timeframe === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {view === 'rankings' && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Rank</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">RS Rating</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">{timeframe} Chg</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">50d RS</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">200d RS</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">From 52W High</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map(d => (
                <tr key={d.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs text-slate-500">{d.rsRank}</td>
                  <td className="px-3 py-2 text-xs font-bold text-indigo-400">{d.ticker}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{d.sector}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      d.rsRating >= 80 ? 'bg-emerald-900/40 text-emerald-400' : d.rsRating <= 20 ? 'bg-red-900/40 text-red-400' : 'bg-slate-700 text-slate-300'
                    )}>
                      {d.rsRating}
                    </span>
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', d.priceChange[timeframe] >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.priceChange[timeframe] >= 0 ? '+' : ''}{d.priceChange[timeframe]}%
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{d.rs50d}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{d.rs200d}</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', d.distFromHigh > -5 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.distFromHigh}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    {d.trend === 'up' && <ArrowUp className="mx-auto h-3.5 w-3.5 text-emerald-400" />}
                    {d.trend === 'down' && <ArrowDown className="mx-auto h-3.5 w-3.5 text-red-400" />}
                    {d.trend === 'flat' && <span className="text-xs text-slate-500">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'sectors' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-4 text-sm font-semibold text-white">Sector Relative Strength</h3>
          <div className="space-y-3">
            {sectorRS.map((s, i) => (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="w-8 text-xs text-slate-500">#{i + 1}</span>
                <span className="w-36 text-xs text-white font-medium truncate">{s.sector}</span>
                <div className="flex-1">
                  <div className="h-6 rounded-full bg-slate-700">
                    <div className={cn('h-6 rounded-full flex items-center justify-end pr-2', s.rs >= 50 ? 'bg-emerald-500/30' : 'bg-red-500/30')}
                      style={{ width: `${s.rs}%` }}>
                      <span className="text-[10px] font-bold text-white">{s.rs}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className={cn('w-14 text-right font-medium', s.change1m >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {s.change1m >= 0 ? '+' : ''}{s.change1m}%
                  </span>
                  <span className={cn('w-14 text-right font-medium', s.change3m >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {s.change3m >= 0 ? '+' : ''}{s.change3m}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'leaders' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-700/50 bg-slate-800 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <TrendingUp className="h-4 w-4" /> RS Leaders (80+)
            </h3>
            <div className="space-y-2">
              {leaders.map(d => (
                <div key={d.ticker} className="flex items-center justify-between rounded-lg bg-emerald-900/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{d.ticker}</span>
                    <span className="text-[10px] text-slate-500">{d.sector}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">{d.rsRating}</span>
                    {d.newHigh52w && <span className="text-[9px] text-amber-400">52W HIGH</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-red-700/50 bg-slate-800 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-400">
              <TrendingDown className="h-4 w-4" /> RS Laggards (20-)
            </h3>
            <div className="space-y-2">
              {laggards.map(d => (
                <div key={d.ticker} className="flex items-center justify-between rounded-lg bg-red-900/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{d.ticker}</span>
                    <span className="text-[10px] text-slate-500">{d.sector}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-400">{d.rsRating}</span>
                    <span className="text-[10px] text-red-400">{d.distFromHigh}%</span>
                  </div>
                </div>
              ))}
              {laggards.length === 0 && <p className="text-xs text-slate-500">No stocks below RS 20</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
