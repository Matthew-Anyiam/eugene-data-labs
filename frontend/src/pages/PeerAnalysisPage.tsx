import { useState, useMemo } from 'react';
import { GitCompareArrows, Search, TrendingUp, TrendingDown, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const ALL_TICKERS = [
  { ticker: 'AAPL', name: 'Apple', sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { ticker: 'GOOGL', name: 'Alphabet', sector: 'Technology' },
  { ticker: 'AMZN', name: 'Amazon', sector: 'Consumer' },
  { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
  { ticker: 'META', name: 'Meta', sector: 'Technology' },
  { ticker: 'TSLA', name: 'Tesla', sector: 'Consumer' },
  { ticker: 'JPM', name: 'JPMorgan', sector: 'Financials' },
  { ticker: 'V', name: 'Visa', sector: 'Financials' },
  { ticker: 'UNH', name: 'UnitedHealth', sector: 'Healthcare' },
  { ticker: 'HD', name: 'Home Depot', sector: 'Consumer' },
  { ticker: 'PG', name: 'P&G', sector: 'Consumer Staples' },
  { ticker: 'JNJ', name: 'J&J', sector: 'Healthcare' },
  { ticker: 'BAC', name: 'BofA', sector: 'Financials' },
  { ticker: 'XOM', name: 'Exxon', sector: 'Energy' },
  { ticker: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples' },
];

interface PeerMetrics {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  pe: number;
  ps: number;
  pb: number;
  evEbitda: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roa: number;
  debtEquity: number;
  currentRatio: number;
  revenueGrowth: number;
  epsGrowth: number;
  divYield: number;
  beta: number;
  ytd: number;
  oneYear: number;
}

const METRICS = [
  { key: 'pe', label: 'P/E', format: 'x', higher: false },
  { key: 'ps', label: 'P/S', format: 'x', higher: false },
  { key: 'pb', label: 'P/B', format: 'x', higher: false },
  { key: 'evEbitda', label: 'EV/EBITDA', format: 'x', higher: false },
  { key: 'grossMargin', label: 'Gross Margin', format: '%', higher: true },
  { key: 'operatingMargin', label: 'Op Margin', format: '%', higher: true },
  { key: 'netMargin', label: 'Net Margin', format: '%', higher: true },
  { key: 'roe', label: 'ROE', format: '%', higher: true },
  { key: 'roa', label: 'ROA', format: '%', higher: true },
  { key: 'debtEquity', label: 'D/E', format: 'x', higher: false },
  { key: 'currentRatio', label: 'Current Ratio', format: 'x', higher: true },
  { key: 'revenueGrowth', label: 'Rev Growth', format: '%', higher: true },
  { key: 'epsGrowth', label: 'EPS Growth', format: '%', higher: true },
  { key: 'divYield', label: 'Div Yield', format: '%', higher: true },
  { key: 'beta', label: 'Beta', format: '', higher: false },
  { key: 'ytd', label: 'YTD', format: '%', higher: true },
  { key: 'oneYear', label: '1Y Return', format: '%', higher: true },
] as const;

function genPeerData(ticker: string): PeerMetrics {
  const s = seed(ticker + '_peer');
  const info = ALL_TICKERS.find(t => t.ticker === ticker) || { ticker, name: ticker, sector: 'Unknown' };
  return {
    ...info,
    marketCap: +(50 + pseudo(s, 0) * 3000).toFixed(0),
    pe: +(8 + pseudo(s, 1) * 50).toFixed(1),
    ps: +(1 + pseudo(s, 2) * 20).toFixed(1),
    pb: +(1 + pseudo(s, 3) * 15).toFixed(1),
    evEbitda: +(5 + pseudo(s, 4) * 30).toFixed(1),
    grossMargin: +(20 + pseudo(s, 5) * 60).toFixed(1),
    operatingMargin: +(5 + pseudo(s, 6) * 40).toFixed(1),
    netMargin: +(3 + pseudo(s, 7) * 30).toFixed(1),
    roe: +(5 + pseudo(s, 8) * 40).toFixed(1),
    roa: +(2 + pseudo(s, 9) * 20).toFixed(1),
    debtEquity: +(0.1 + pseudo(s, 10) * 3).toFixed(2),
    currentRatio: +(0.5 + pseudo(s, 11) * 3).toFixed(2),
    revenueGrowth: +((pseudo(s, 12) - 0.3) * 40).toFixed(1),
    epsGrowth: +((pseudo(s, 13) - 0.3) * 50).toFixed(1),
    divYield: +(pseudo(s, 14) * 4).toFixed(2),
    beta: +(0.5 + pseudo(s, 15) * 1.5).toFixed(2),
    ytd: +((pseudo(s, 16) - 0.4) * 40).toFixed(1),
    oneYear: +((pseudo(s, 17) - 0.35) * 60).toFixed(1),
  };
}

const COLORS = ['text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-purple-400', 'text-pink-400'];
const BG_COLORS = ['bg-blue-500/10', 'bg-emerald-500/10', 'bg-amber-500/10', 'bg-purple-500/10', 'bg-pink-500/10'];

export function PeerAnalysisPage() {
  const [selected, setSelected] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL']);
  const [tickerInput, setTickerInput] = useState('');

  const peers = useMemo(() => selected.map(t => genPeerData(t)), [selected]);

  const addTicker = (t: string) => {
    const upper = t.toUpperCase();
    if (upper && !selected.includes(upper) && selected.length < 5) {
      setSelected([...selected, upper]);
    }
    setTickerInput('');
  };

  const removeTicker = (t: string) => {
    if (selected.length > 1) setSelected(selected.filter(s => s !== t));
  };

  const getBest = (key: string, higher: boolean) => {
    const vals = peers.map(p => ({ ticker: p.ticker, val: p[key as keyof PeerMetrics] as number }));
    vals.sort((a, b) => higher ? b.val - a.val : a.val - b.val);
    return vals[0]?.ticker;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitCompareArrows className="h-6 w-6 text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Peer Analysis</h1>
          <p className="text-sm text-slate-400">Side-by-side comparison of fundamentals, margins, and performance</p>
        </div>
      </div>

      {/* Selected tickers + add */}
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((t, i) => (
          <div key={t} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5', BG_COLORS[i % BG_COLORS.length])}>
            <Link to={`/company/${t}`} className={cn('font-mono text-xs font-bold hover:underline', COLORS[i % COLORS.length])}>{t}</Link>
            {selected.length > 1 && (
              <button onClick={() => removeTicker(t)} className="text-slate-500 hover:text-white"><X className="h-3 w-3" /></button>
            )}
          </div>
        ))}
        {selected.length < 5 && (
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
              <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter' && tickerInput) addTicker(tickerInput); }}
                placeholder="Add ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-7 pr-2 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="flex gap-1">
              {ALL_TICKERS.filter(t => !selected.includes(t.ticker)).slice(0, 4).map(t => (
                <button key={t.ticker} onClick={() => addTicker(t.ticker)}
                  className="flex items-center gap-0.5 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white">
                  <Plus className="h-2.5 w-2.5" /> {t.ticker}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Company headers */}
      <div className={cn('grid gap-3', `grid-cols-${Math.min(selected.length, 5)}`)}>
        {peers.map((p, i) => (
          <div key={p.ticker} className={cn('rounded-xl border border-slate-700 bg-slate-800 p-3', BG_COLORS[i % BG_COLORS.length])}>
            <Link to={`/company/${p.ticker}`} className={cn('font-mono text-sm font-bold hover:underline', COLORS[i % COLORS.length])}>{p.ticker}</Link>
            <div className="text-xs text-slate-400">{p.name}</div>
            <div className="mt-1 text-[10px] text-slate-500">{p.sector} | ${p.marketCap}B</div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-36">Metric</th>
              {peers.map((p, i) => (
                <th key={p.ticker} className={cn('px-3 py-2 text-right text-xs font-bold', COLORS[i % COLORS.length])}>{p.ticker}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {METRICS.map(m => {
              const best = getBest(m.key, m.higher);
              return (
                <tr key={m.key} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs font-medium text-slate-400">{m.label}</td>
                  {peers.map((p, i) => {
                    const val = p[m.key as keyof PeerMetrics] as number;
                    const isBest = p.ticker === best;
                    const isGrowth = m.format === '%' && (m.key === 'revenueGrowth' || m.key === 'epsGrowth' || m.key === 'ytd' || m.key === 'oneYear');
                    return (
                      <td key={p.ticker} className={cn('px-3 py-2 text-right text-xs', isBest ? 'font-bold text-white' : 'text-slate-300')}>
                        {isBest && <span className="mr-1 text-emerald-400">*</span>}
                        <span className={isGrowth ? (val >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}>
                          {isGrowth && val >= 0 ? '+' : ''}{val}{m.format}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visual margin comparison */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Margin Comparison</h3>
        {['grossMargin', 'operatingMargin', 'netMargin'].map(key => {
          const label = key === 'grossMargin' ? 'Gross' : key === 'operatingMargin' ? 'Operating' : 'Net';
          return (
            <div key={key} className="mb-3">
              <div className="mb-1 text-xs text-slate-500">{label} Margin</div>
              <div className="space-y-1">
                {peers.map((p, i) => {
                  const val = p[key as keyof PeerMetrics] as number;
                  return (
                    <div key={p.ticker} className="flex items-center gap-2">
                      <span className={cn('w-12 font-mono text-[10px] font-bold', COLORS[i % COLORS.length])}>{p.ticker}</span>
                      <div className="flex-1 h-3 rounded-full bg-slate-700">
                        <div className={cn('h-3 rounded-full opacity-60', i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-emerald-500' : i === 2 ? 'bg-amber-500' : i === 3 ? 'bg-purple-500' : 'bg-pink-500')}
                          style={{ width: `${Math.min(100, val)}%` }} />
                      </div>
                      <span className="w-10 text-right text-[10px] text-slate-300">{val}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Performance comparison */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Return Comparison</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {['ytd', 'oneYear'].map(key => {
            const label = key === 'ytd' ? 'Year-to-Date' : '1-Year Return';
            return (
              <div key={key}>
                <div className="mb-2 text-xs text-slate-500">{label}</div>
                <div className="space-y-2">
                  {peers.map((p, i) => {
                    const val = p[key as keyof PeerMetrics] as number;
                    return (
                      <div key={p.ticker} className="flex items-center justify-between">
                        <span className={cn('font-mono text-xs font-bold', COLORS[i % COLORS.length])}>{p.ticker}</span>
                        <span className={cn('flex items-center gap-0.5 text-xs font-medium', val >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {val >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {val >= 0 ? '+' : ''}{val}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-slate-600 text-center">* indicates best-in-class for each metric among selected peers</div>
    </div>
  );
}
