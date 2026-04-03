import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, TrendingUp, TrendingDown, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const INSTITUTIONS = [
  { name: 'Vanguard Group', aum: 8200 },
  { name: 'BlackRock', aum: 9400 },
  { name: 'State Street', aum: 3800 },
  { name: 'Fidelity Investments', aum: 4500 },
  { name: 'Capital Group', aum: 2600 },
  { name: 'T. Rowe Price', aum: 1400 },
  { name: 'Geode Capital', aum: 900 },
  { name: 'JP Morgan Asset Mgmt', aum: 3100 },
  { name: 'Morgan Stanley IM', aum: 1500 },
  { name: 'Goldman Sachs AM', aum: 2300 },
  { name: 'Wellington Mgmt', aum: 1200 },
  { name: 'Northern Trust', aum: 1100 },
  { name: 'Invesco', aum: 1600 },
  { name: 'Charles Schwab IM', aum: 800 },
  { name: 'Dimensional Fund', aum: 650 },
  { name: 'Citadel Advisors', aum: 620 },
  { name: 'Bridgewater Associates', aum: 150 },
  { name: 'Renaissance Technologies', aum: 130 },
  { name: 'Two Sigma', aum: 67 },
  { name: 'D.E. Shaw', aum: 60 },
];

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

function genHoldings(ticker: string) {
  const s = seed(ticker + '_inst');
  return INSTITUTIONS.map((inst, i) => {
    const shares = Math.floor(50000 + pseudo(s, i * 4) * 500000000);
    const value = shares * (50 + pseudo(s, i * 4 + 1) * 300);
    const pctPortfolio = 0.1 + pseudo(s, i * 4 + 2) * 5;
    const change = (pseudo(s, i * 4 + 3) - 0.4) * 20;
    const prevShares = Math.floor(shares * (1 - change / 100));
    const filingDate = `2025-${String(1 + Math.floor(pseudo(s, i * 4 + 5) * 3)).padStart(2, '0')}-${String(1 + Math.floor(pseudo(s, i * 4 + 6) * 28)).padStart(2, '0')}`;
    return {
      institution: inst.name, aum: inst.aum, shares, value,
      pctPortfolio: +pctPortfolio.toFixed(2), change: +change.toFixed(1),
      prevShares, filingDate,
    };
  }).sort((a, b) => b.value - a.value);
}

const TOP_HELD = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH',
  'BRK.B', 'JNJ', 'WMT', 'MA', 'PG', 'HD', 'XOM', 'BAC', 'KO', 'LLY',
];
const NAMES: Record<string, string> = {
  AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon', NVDA: 'NVIDIA',
  META: 'Meta', TSLA: 'Tesla', JPM: 'JPMorgan', V: 'Visa', UNH: 'UnitedHealth',
  'BRK.B': 'Berkshire', JNJ: 'J&J', WMT: 'Walmart', MA: 'Mastercard', PG: 'P&G',
  HD: 'Home Depot', XOM: 'Exxon', BAC: 'BofA', KO: 'Coca-Cola', LLY: 'Eli Lilly',
};

export function InstitutionalPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [expandedInst, setExpandedInst] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'value' | 'shares' | 'change' | 'pct'>('value');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const holdings = useMemo(() => {
    const list = genHoldings(selectedTicker);
    return list.sort((a, b) => {
      const key = sortBy === 'pct' ? 'pctPortfolio' : sortBy;
      return sortDir === 'desc' ? b[key] - a[key] : a[key] - b[key];
    });
  }, [selectedTicker, sortBy, sortDir]);

  const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const netBuyers = holdings.filter(h => h.change > 0).length;
  const netSellers = holdings.filter(h => h.change < 0).length;
  const avgChange = holdings.reduce((s, h) => s + h.change, 0) / holdings.length;

  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

  const sortHeader = (key: typeof sortBy, label: string) => (
    <button onClick={() => { if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortDir('desc'); } }}
      className={cn('text-xs font-medium', sortBy === key ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300')}>
      {label} {sortBy === key && (sortDir === 'desc' ? '↓' : '↑')}
    </button>
  );

  // Most held overview
  const overviewData = useMemo(() => TOP_HELD.map(ticker => {
    const h = genHoldings(ticker);
    const instCount = h.length;
    const tv = h.reduce((s, x) => s + x.value, 0);
    const avg = h.reduce((s, x) => s + x.change, 0) / h.length;
    return { ticker, name: NAMES[ticker] || ticker, instCount, totalValue: tv, avgChange: +avg.toFixed(1) };
  }), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-orange-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Institutional Holdings</h1>
          <p className="text-sm text-slate-400">13F filings, fund positions, and ownership changes</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-orange-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Institutions', value: holdings.length.toString() },
          { label: 'Total Shares', value: `${(totalShares / 1e6).toFixed(1)}M` },
          { label: 'Total Value', value: `$${(totalValue / 1e9).toFixed(1)}B` },
          { label: 'Net Buyers/Sellers', value: `${netBuyers}/${netSellers}`, color: netBuyers > netSellers ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Avg Position Change', value: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%`, color: avgChange >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color || 'text-white')}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Holdings table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Institution</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">AUM ($B)</th>
              <th className="px-3 py-2 text-right">{sortHeader('shares', 'Shares')}</th>
              <th className="px-3 py-2 text-right">{sortHeader('value', 'Value')}</th>
              <th className="px-3 py-2 text-right">{sortHeader('pct', '% Portfolio')}</th>
              <th className="px-3 py-2 text-right">{sortHeader('change', 'Change')}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Filing Date</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {holdings.map(h => (
              <tr key={h.institution} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs font-medium text-white">{h.institution}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-400">${h.aum}B</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{(h.shares / 1e6).toFixed(2)}M</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${(h.value / 1e9).toFixed(2)}B</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{h.pctPortfolio}%</td>
                <td className="px-3 py-2 text-right">
                  <span className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', h.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {h.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {h.change >= 0 ? '+' : ''}{h.change}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">{h.filingDate}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setExpandedInst(expandedInst === h.institution ? null : h.institution)} className="text-slate-500 hover:text-white">
                    {expandedInst === h.institution ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ownership breakdown */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Buyer vs Seller Activity</h3>
        <div className="flex items-center gap-2">
          <div className="h-4 rounded-l bg-emerald-500/60" style={{ width: `${(netBuyers / holdings.length) * 100}%` }} />
          <div className="h-4 rounded-r bg-red-500/60" style={{ width: `${(netSellers / holdings.length) * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-emerald-400">{netBuyers} Buyers ({((netBuyers / holdings.length) * 100).toFixed(0)}%)</span>
          <span className="text-red-400">{netSellers} Sellers ({((netSellers / holdings.length) * 100).toFixed(0)}%)</span>
        </div>
      </div>

      {/* Most held stocks */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Most Institutionally Held Stocks</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Institutions</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Total Value</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Avg Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {overviewData.map(o => (
                <tr key={o.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2">
                    <Link to={`/company/${o.ticker}`} className="font-mono text-xs font-bold text-orange-400 hover:underline">{o.ticker}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{o.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{o.instCount}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${(o.totalValue / 1e9).toFixed(1)}B</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', o.avgChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {o.avgChange >= 0 ? '+' : ''}{o.avgChange}%
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
