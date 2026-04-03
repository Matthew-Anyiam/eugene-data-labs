import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChartHorizontal, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];
const QUARTERS = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];

function genEstimates(ticker: string) {
  const s = seed(ticker);
  const baseEps = 1 + pseudo(s, 0) * 8;
  const baseRev = 10 + pseudo(s, 1) * 90; // billions

  return QUARTERS.map((q, qi) => {
    const growth = 0.9 + pseudo(s, qi * 5 + 10) * 0.3;
    const eps = baseEps * growth * (1 + qi * 0.03);
    const rev = baseRev * growth * (1 + qi * 0.04);
    const numAnalysts = 15 + Math.floor(pseudo(s, qi * 5 + 11) * 25);
    const epsHigh = eps * (1.05 + pseudo(s, qi * 5 + 12) * 0.1);
    const epsLow = eps * (0.85 + pseudo(s, qi * 5 + 13) * 0.1);
    const isReported = qi < 2;
    const actual = isReported ? eps * (0.95 + pseudo(s, qi * 5 + 14) * 0.12) : null;
    const surprise = actual ? ((actual - eps) / eps) * 100 : null;
    const revActual = isReported ? rev * (0.97 + pseudo(s, qi * 5 + 15) * 0.08) : null;

    return {
      quarter: q, eps: +eps.toFixed(2), epsHigh: +epsHigh.toFixed(2), epsLow: +epsLow.toFixed(2),
      rev: +rev.toFixed(1), numAnalysts, actual: actual ? +actual.toFixed(2) : null,
      surprise: surprise ? +surprise.toFixed(1) : null, revActual: revActual ? +revActual.toFixed(1) : null,
      isReported,
    };
  });
}

const TOP_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH',
  'JNJ', 'WMT', 'PG', 'MA', 'HD', 'XOM', 'BAC', 'KO', 'PFE', 'LLY',
];

const NAMES: Record<string, string> = {
  AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon', NVDA: 'NVIDIA',
  META: 'Meta', TSLA: 'Tesla', JPM: 'JPMorgan', V: 'Visa', UNH: 'UnitedHealth',
  JNJ: 'J&J', WMT: 'Walmart', PG: 'P&G', MA: 'Mastercard', HD: 'Home Depot',
  XOM: 'Exxon', BAC: 'BofA', KO: 'Coca-Cola', PFE: 'Pfizer', LLY: 'Eli Lilly',
};

export function EstimatesPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [view, setView] = useState<'eps' | 'revenue'>('eps');
  const [expandedStock, setExpandedStock] = useState<string | null>(null);

  const estimates = useMemo(() => genEstimates(selectedTicker), [selectedTicker]);

  const selectTicker = (t: string) => {
    setSelectedTicker(t.toUpperCase());
    setTickerInput('');
  };

  // Estimates overview for top stocks
  const overview = useMemo(() => TOP_STOCKS.map(ticker => {
    const est = genEstimates(ticker);
    const nextQ = est.find(e => !e.isReported);
    const lastReported = [...est].reverse().find(e => e.isReported);
    return { ticker, name: NAMES[ticker] || ticker, nextQ, lastReported };
  }), []);

  const maxEps = Math.max(...estimates.map(e => Math.max(e.epsHigh, e.actual ?? 0)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChartHorizontal className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Estimates</h1>
          <p className="text-sm text-slate-400">Consensus EPS & revenue estimates, surprises, and revisions</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium transition-colors', selectedTicker === t ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-white">{selectedTicker} Estimates</h2>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['eps', 'revenue'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', view === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}>
              {v === 'eps' ? 'EPS' : 'Revenue'}
            </button>
          ))}
        </div>
      </div>

      {/* Estimates chart */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="grid grid-cols-6 gap-2">
          {estimates.map(e => (
            <div key={e.quarter} className="text-center">
              <div className="mb-2 text-[10px] text-slate-500">{e.quarter}</div>
              {view === 'eps' ? (
                <div className="relative mx-auto h-32 w-8">
                  {/* Estimate bar */}
                  <div className="absolute bottom-0 w-full rounded-t bg-indigo-500/40"
                    style={{ height: `${(e.eps / maxEps) * 100}%` }} />
                  {/* Actual bar overlay */}
                  {e.actual !== null && (
                    <div className={cn('absolute bottom-0 w-full rounded-t', (e.surprise ?? 0) >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70')}
                      style={{ height: `${(e.actual / maxEps) * 100}%` }} />
                  )}
                  {/* Range indicators */}
                  <div className="absolute w-full border-t border-dashed border-slate-500"
                    style={{ bottom: `${(e.epsHigh / maxEps) * 100}%` }} />
                  <div className="absolute w-full border-t border-dashed border-slate-600"
                    style={{ bottom: `${(e.epsLow / maxEps) * 100}%` }} />
                </div>
              ) : (
                <div className="relative mx-auto h-32 w-8">
                  <div className="absolute bottom-0 w-full rounded-t bg-indigo-500/40"
                    style={{ height: `${(e.rev / (estimates[estimates.length - 1].rev * 1.2)) * 100}%` }} />
                  {e.revActual !== null && (
                    <div className="absolute bottom-0 w-full rounded-t bg-emerald-500/70"
                      style={{ height: `${(e.revActual / (estimates[estimates.length - 1].rev * 1.2)) * 100}%` }} />
                  )}
                </div>
              )}
              <div className="mt-2">
                <div className="text-xs font-bold text-white">
                  {view === 'eps' ? `$${e.eps}` : `$${e.rev}B`}
                </div>
                {e.isReported && (
                  <div className={cn('text-[10px] font-medium', (e.surprise ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {view === 'eps' ? `Act: $${e.actual}` : `Act: $${e.revActual}B`}
                  </div>
                )}
                {e.surprise !== null && view === 'eps' && (
                  <div className={cn('flex items-center justify-center gap-0.5 text-[9px]', e.surprise >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {e.surprise >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {e.surprise >= 0 ? '+' : ''}{e.surprise}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-indigo-500/40" /> Estimate</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-emerald-500/70" /> Beat</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-red-500/70" /> Miss</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-px border-t border-dashed border-slate-500" style={{ width: 12 }} /> Range</span>
        </div>
      </div>

      {/* Detailed estimates table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Quarter</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Est.</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">High</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Low</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Actual</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Surprise</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Est. ($B)</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Actual</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Analysts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {estimates.map(e => (
              <tr key={e.quarter} className={cn('bg-slate-800', e.isReported ? 'hover:bg-slate-750' : 'bg-slate-800/60')}>
                <td className="px-3 py-2 text-xs font-medium text-white">
                  {e.quarter}
                  {e.isReported && <span className="ml-1 rounded bg-emerald-900/40 px-1 py-0.5 text-[9px] text-emerald-400">REPORTED</span>}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${e.eps}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">${e.epsHigh}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">${e.epsLow}</td>
                <td className="px-3 py-2 text-right text-xs font-medium">
                  {e.actual !== null ? <span className={cn((e.surprise ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>${e.actual}</span> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {e.surprise !== null ? (
                    <span className={cn('font-medium', e.surprise >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {e.surprise >= 0 ? '+' : ''}{e.surprise}%
                    </span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${e.rev}</td>
                <td className="px-3 py-2 text-right text-xs">
                  {e.revActual !== null ? <span className="text-slate-300">${e.revActual}B</span> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-400">{e.numAnalysts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top stocks estimates overview */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Estimates Overview — Top 20 Stocks</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Next Q EPS Est.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Next Q Rev Est.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Analysts</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Last Surprise</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {overview.map(o => (
                <tr key={o.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2">
                    <Link to={`/company/${o.ticker}`} className="font-mono text-xs font-bold text-indigo-400 hover:underline">{o.ticker}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{o.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-white font-medium">{o.nextQ ? `$${o.nextQ.eps}` : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{o.nextQ ? `$${o.nextQ.rev}B` : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">{o.nextQ?.numAnalysts ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {o.lastReported?.surprise !== null && o.lastReported?.surprise !== undefined ? (
                      <span className={cn('font-medium', o.lastReported.surprise >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {o.lastReported.surprise >= 0 ? '+' : ''}{o.lastReported.surprise}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => { setExpandedStock(expandedStock === o.ticker ? null : o.ticker); selectTicker(o.ticker); }}
                      className="text-slate-500 hover:text-white">
                      {expandedStock === o.ticker ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
