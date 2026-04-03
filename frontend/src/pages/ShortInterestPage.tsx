import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, TrendingUp, TrendingDown, Flame, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

const QUICK_TICKERS = ['GME', 'AMC', 'TSLA', 'NVDA', 'AAPL', 'BBBY', 'RIVN', 'PLTR'];

const ALL_TICKERS = [
  'GME', 'AMC', 'BBBY', 'RIVN', 'PLTR', 'TSLA', 'NVDA', 'AAPL', 'CVNA', 'UPST',
  'BYND', 'FFIE', 'MULN', 'LCID', 'SPCE', 'WISH', 'CLOV', 'SOFI', 'OPEN', 'LAZR',
  'MARA', 'RIOT', 'WKHS', 'GOEV', 'SKLZ',
];

const COMPANY_NAMES: Record<string, string> = {
  GME: 'GameStop Corp', AMC: 'AMC Entertainment', BBBY: 'Bed Bath & Beyond',
  RIVN: 'Rivian Automotive', PLTR: 'Palantir Technologies', TSLA: 'Tesla Inc',
  NVDA: 'NVIDIA Corp', AAPL: 'Apple Inc', CVNA: 'Carvana Co', UPST: 'Upstart Holdings',
  BYND: 'Beyond Meat', FFIE: 'Faraday Future', MULN: 'Mullen Automotive',
  LCID: 'Lucid Group', SPCE: 'Virgin Galactic', WISH: 'ContextLogic',
  CLOV: 'Clover Health', SOFI: 'SoFi Technologies', OPEN: 'Opendoor Technologies',
  LAZR: 'Luminar Technologies', MARA: 'Marathon Digital', RIOT: 'Riot Platforms',
  WKHS: 'Workhorse Group', GOEV: 'Canoo Inc', SKLZ: 'Skillz Inc',
};

const SECTORS = [
  'Consumer Discretionary', 'Technology', 'Healthcare', 'Financials',
  'Energy', 'Industrials', 'Communication Services', 'Real Estate',
];

type SortKey = 'shortPctFloat' | 'daysToCover' | 'costToBorrow' | 'squeezeScore';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

function fmtShares(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

interface StockData {
  ticker: string;
  name: string;
  shortPctFloat: number;
  shortPctOutstanding: number;
  sharesShort: number;
  daysToCover: number;
  changePct: number;
  costToBorrow: number;
  utilization: number;
  squeezeScore: number;
  sector: string;
  history: number[];
}

function generateStock(ticker: string): StockData {
  const s = seed(ticker);
  const shortPctFloat = 5 + pseudo(s, 1) * 55;
  const sharesShort = Math.floor(1e6 + pseudo(s, 2) * 99e6);
  const daysToCover = 0.5 + pseudo(s, 3) * 14;
  const changePct = (pseudo(s, 4) - 0.45) * 30;
  const costToBorrow = 1 + pseudo(s, 5) * 80;
  const utilization = 30 + pseudo(s, 6) * 70;
  const shortPctOutstanding = shortPctFloat * (0.4 + pseudo(s, 7) * 0.4);

  const highShort = shortPctFloat > 25 ? 30 : shortPctFloat > 15 ? 15 : 0;
  const lowDays = daysToCover < 3 ? 25 : daysToCover < 6 ? 10 : 0;
  const highBorrow = costToBorrow > 40 ? 25 : costToBorrow > 20 ? 10 : 0;
  const rising = changePct > 5 ? 20 : changePct > 0 ? 10 : 0;
  const squeezeScore = Math.min(100, Math.floor(highShort + lowDays + highBorrow + rising));

  const history: number[] = [];
  for (let i = 0; i < 6; i++) {
    history.push(sharesShort * (0.7 + pseudo(s, 10 + i) * 0.6));
  }

  return {
    ticker, name: COMPANY_NAMES[ticker] ?? ticker,
    shortPctFloat, shortPctOutstanding, sharesShort, daysToCover,
    changePct, costToBorrow, utilization, squeezeScore,
    sector: SECTORS[Math.floor(pseudo(s, 20) * SECTORS.length)],
    history,
  };
}

function squeezeColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-green-400';
}

function squeezeBg(score: number): string {
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function ShortInterestPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('shortPctFloat');

  const allStocks = useMemo(() => ALL_TICKERS.map(generateStock), []);

  const sorted = useMemo(() => {
    const copy = [...allStocks];
    copy.sort((a, b) => b[sortKey] - a[sortKey]);
    return copy;
  }, [allStocks, sortKey]);

  const selectedData = useMemo(
    () => (selected ? generateStock(selected) : null),
    [selected],
  );

  const sectorBreakdown = useMemo(() => {
    const map: Record<string, { count: number; avgShort: number }> = {};
    for (const s of allStocks) {
      if (!map[s.sector]) map[s.sector] = { count: 0, avgShort: 0 };
      map[s.sector].count += 1;
      map[s.sector].avgShort += s.shortPctFloat;
    }
    return Object.entries(map)
      .map(([sector, d]) => ({ sector, count: d.count, avgShort: d.avgShort / d.count }))
      .sort((a, b) => b.avgShort - a.avgShort);
  }, [allStocks]);

  const handleSearch = () => {
    const t = search.trim().toUpperCase();
    if (t) setSelected(t);
  };

  const periods = ['T-5', 'T-4', 'T-3', 'T-2', 'T-1', 'Current'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowDownUp className="h-6 w-6 text-red-400" />
          Short Interest
        </h1>
        <p className="text-slate-400 mt-1">
          Track short selling activity, days to cover, cost to borrow, and squeeze potential across the market.
        </p>
      </div>

      {/* Search + Quick Tickers */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter ticker symbol..."
            className="flex-1 bg-slate-900 border border-slate-600 text-white rounded px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium"
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => setSelected(t)}
              className={cn(
                'px-3 py-1 rounded text-xs font-mono border transition-colors',
                selected === t
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Ticker Detail */}
      {selectedData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Key Metrics */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              {selectedData.ticker} — Short Interest Detail
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Shares Short" value={fmtShares(selectedData.sharesShort)} />
              <Metric label="Days to Cover" value={selectedData.daysToCover.toFixed(1)} />
              <Metric label="Short % of Float" value={`${selectedData.shortPctFloat.toFixed(1)}%`} />
              <Metric label="Short % of Outstanding" value={`${selectedData.shortPctOutstanding.toFixed(1)}%`} />
              <Metric
                label="Change (2-week)"
                value={`${selectedData.changePct >= 0 ? '+' : ''}${selectedData.changePct.toFixed(1)}%`}
                icon={selectedData.changePct >= 0
                  ? <TrendingUp className="h-3 w-3 text-red-400" />
                  : <TrendingDown className="h-3 w-3 text-green-400" />}
              />
              <Metric label="Cost to Borrow" value={`${selectedData.costToBorrow.toFixed(1)}%`} />
              <Metric label="Utilization" value={`${selectedData.utilization.toFixed(1)}%`} />
            </div>
          </div>

          {/* Squeeze Signals */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              Squeeze Signals — {selectedData.ticker}
            </h2>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 text-sm">Squeeze Score</span>
                <span className={cn('text-xl font-bold', squeezeColor(selectedData.squeezeScore))}>
                  {selectedData.squeezeScore}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', squeezeBg(selectedData.squeezeScore))}
                  style={{ width: `${selectedData.squeezeScore}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Low</span><span>Medium</span><span>High</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <Factor label="High Short %" active={selectedData.shortPctFloat > 25} detail={`${selectedData.shortPctFloat.toFixed(1)}% of float`} />
              <Factor label="Low Days to Cover" active={selectedData.daysToCover < 3} detail={`${selectedData.daysToCover.toFixed(1)} days`} />
              <Factor label="High Cost to Borrow" active={selectedData.costToBorrow > 40} detail={`${selectedData.costToBorrow.toFixed(1)}% fee`} />
              <Factor label="Rising Price" active={selectedData.changePct > 5} detail={`${selectedData.changePct >= 0 ? '+' : ''}${selectedData.changePct.toFixed(1)}% change`} />
            </div>
          </div>

          {/* Short Interest Trends */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white mb-3">
              Short Interest Trend — {selectedData.ticker} (Last 6 Reports)
            </h2>
            <div className="flex items-end gap-2 h-32">
              {selectedData.history.map((val, i) => {
                const max = Math.max(...selectedData.history);
                const pct = max > 0 ? (val / max) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400">{fmtShares(val)}</span>
                    <div className="w-full flex items-end" style={{ height: '80px' }}>
                      <div
                        className={cn('w-full rounded-t', i === 5 ? 'bg-blue-500' : 'bg-slate-600')}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">{periods[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sort / Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400">Sort by:</span>
        {([
          ['shortPctFloat', 'Short % Float'],
          ['daysToCover', 'Days to Cover'],
          ['costToBorrow', 'Cost to Borrow'],
          ['squeezeScore', 'Squeeze Score'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium border transition-colors',
              sortKey === key
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Most Shorted Stocks Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">Most Shorted Stocks</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-700">
                <th className="text-left px-4 py-2 w-10">#</th>
                <th className="text-left px-4 py-2">Ticker</th>
                <th className="text-left px-4 py-2">Company</th>
                <th className="text-right px-4 py-2">Short % Float</th>
                <th className="text-right px-4 py-2">Days to Cover</th>
                <th className="text-right px-4 py-2">2W Change</th>
                <th className="text-right px-4 py-2">Cost to Borrow</th>
                <th className="text-center px-4 py-2">Squeeze</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock, idx) => (
                <tr
                  key={stock.ticker}
                  className={cn(
                    'border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors',
                    selected === stock.ticker && 'bg-slate-700/40',
                  )}
                  onClick={() => setSelected(stock.ticker)}
                >
                  <td className="px-4 py-2 text-slate-500 font-mono">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/company/${stock.ticker}`}
                      className="text-blue-400 hover:text-blue-300 font-mono font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {stock.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-300">{stock.name}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${Math.min(100, stock.shortPctFloat * 1.67)}%` }}
                        />
                      </div>
                      <span className="text-white font-mono w-14 text-right">
                        {stock.shortPctFloat.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300 font-mono">
                    {stock.daysToCover.toFixed(1)}
                  </td>
                  <td className={cn(
                    'px-4 py-2 text-right font-mono',
                    stock.changePct >= 0 ? 'text-red-400' : 'text-green-400',
                  )}>
                    {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300 font-mono">
                    {stock.costToBorrow.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-center">
                    {stock.squeezeScore >= 60 ? (
                      <span className="text-orange-400" title={`Score: ${stock.squeezeScore}`}>
                        <Flame className="h-4 w-4 inline" />
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs font-mono">{stock.squeezeScore}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector Breakdown */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Short Interest by Sector</h2>
        <div className="space-y-2">
          {sectorBreakdown.map((s) => {
            const maxAvg = Math.max(...sectorBreakdown.map((x) => x.avgShort));
            const pct = maxAvg > 0 ? (s.avgShort / maxAvg) * 100 : 0;
            return (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="text-slate-400 text-xs w-44 shrink-0">{s.sector}</span>
                <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                  <div className="h-full bg-red-500/60 rounded" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-white text-xs font-mono w-16 text-right">
                  {s.avgShort.toFixed(1)}%
                </span>
                <span className="text-slate-500 text-xs w-16 text-right">
                  {s.count} stock{s.count !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded p-2">
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-white font-mono text-sm flex items-center gap-1">
        {icon}
        {value}
      </div>
    </div>
  );
}

function Factor({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-1.5 rounded',
      active ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-900 border border-slate-700',
    )}>
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full', active ? 'bg-red-400' : 'bg-slate-600')} />
        <span className={cn(active ? 'text-red-300' : 'text-slate-500')}>{label}</span>
      </div>
      <span className={cn('font-mono text-xs', active ? 'text-red-400' : 'text-slate-600')}>
        {detail}
      </span>
    </div>
  );
}
