import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, TrendingUp, TrendingDown, Search, Building2, Users, Briefcase } from 'lucide-react';
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

interface OwnershipData {
  ticker: string;
  insiderPct: number;
  institutionalPct: number;
  retailPct: number;
  insiderShares: number;
  institutionalShares: number;
  totalShares: number;
  insiderBuys: number;
  insiderSells: number;
  topInsiders: { name: string; title: string; shares: number; change: number; date: string }[];
  topInstitutions: { name: string; shares: number; pct: number; change: number }[];
}

function genOwnership(ticker: string): OwnershipData {
  const s = seed(ticker + '_own');
  const insiderPct = 1 + pseudo(s, 0) * 15;
  const institutionalPct = 50 + pseudo(s, 1) * 35;
  const retailPct = 100 - insiderPct - institutionalPct;
  const totalShares = Math.floor(1e9 + pseudo(s, 2) * 15e9);
  const insiderShares = Math.floor(totalShares * insiderPct / 100);
  const institutionalShares = Math.floor(totalShares * institutionalPct / 100);

  const INSIDER_NAMES = ['Tim Cook', 'Satya Nadella', 'Jensen Huang', 'Andy Jassy', 'Mark Zuckerberg', 'Jamie Dimon', 'Elon Musk', 'Sundar Pichai'];
  const TITLES = ['CEO', 'CFO', 'COO', 'CTO', 'VP Engineering', 'General Counsel', 'Board Director', 'EVP Sales'];
  const INST_NAMES = ['Vanguard Group', 'BlackRock', 'State Street', 'Fidelity', 'Capital Group', 'T. Rowe Price', 'JP Morgan AM', 'Morgan Stanley IM', 'Goldman Sachs AM', 'Wellington Mgmt'];

  const topInsiders = Array.from({ length: 8 }, (_, i) => ({
    name: INSIDER_NAMES[(seed(ticker) + i) % INSIDER_NAMES.length],
    title: TITLES[i % TITLES.length],
    shares: Math.floor(10000 + pseudo(s, 10 + i * 3) * 5000000),
    change: +(pseudo(s, 11 + i * 3) - 0.4).toFixed(2) * 100,
    date: `2025-${String(1 + Math.floor(pseudo(s, 12 + i * 3) * 3)).padStart(2, '0')}-${String(1 + Math.floor(pseudo(s, 13 + i * 3) * 28)).padStart(2, '0')}`,
  }));

  const topInstitutions = INST_NAMES.map((name, i) => ({
    name,
    shares: Math.floor(50e6 + pseudo(s, 40 + i * 3) * 500e6),
    pct: +(1 + pseudo(s, 41 + i * 3) * 8).toFixed(2),
    change: +((pseudo(s, 42 + i * 3) - 0.4) * 15).toFixed(1),
  })).sort((a, b) => b.shares - a.shares);

  const insiderBuys = topInsiders.filter(x => x.change > 0).length;
  const insiderSells = topInsiders.filter(x => x.change <= 0).length;

  return {
    ticker, insiderPct: +insiderPct.toFixed(1), institutionalPct: +institutionalPct.toFixed(1),
    retailPct: +retailPct.toFixed(1), insiderShares, institutionalShares, totalShares,
    insiderBuys, insiderSells, topInsiders, topInstitutions,
  };
}

const TOP_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH', 'BRK.B', 'JNJ', 'WMT', 'MA', 'PG', 'HD'];
const NAMES: Record<string, string> = {
  AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon', NVDA: 'NVIDIA',
  META: 'Meta', TSLA: 'Tesla', JPM: 'JPMorgan', V: 'Visa', UNH: 'UnitedHealth',
  'BRK.B': 'Berkshire', JNJ: 'J&J', WMT: 'Walmart', MA: 'Mastercard', PG: 'P&G', HD: 'Home Depot',
};

export function OwnershipPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [tab, setTab] = useState<'overview' | 'insiders' | 'institutions'>('overview');

  const data = useMemo(() => genOwnership(selectedTicker), [selectedTicker]);

  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

  const overviewData = useMemo(() => TOP_STOCKS.map(ticker => {
    const d = genOwnership(ticker);
    return { ticker, name: NAMES[ticker] || ticker, ...d };
  }), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-violet-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Ownership Structure</h1>
          <p className="text-sm text-slate-400">Insider, institutional, and retail ownership breakdown</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Ownership pie visual */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Insider', pct: data.insiderPct, color: 'bg-amber-500', textColor: 'text-amber-400', icon: <Users className="h-4 w-4" />, shares: data.insiderShares },
          { label: 'Institutional', pct: data.institutionalPct, color: 'bg-blue-500', textColor: 'text-blue-400', icon: <Building2 className="h-4 w-4" />, shares: data.institutionalShares },
          { label: 'Retail / Other', pct: data.retailPct, color: 'bg-emerald-500', textColor: 'text-emerald-400', icon: <Briefcase className="h-4 w-4" />, shares: data.totalShares - data.insiderShares - data.institutionalShares },
        ].map(seg => (
          <div key={seg.label} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-center gap-2 text-slate-400">
              {seg.icon}
              <span className="text-xs uppercase tracking-wider">{seg.label}</span>
            </div>
            <div className={cn('mt-2 text-2xl font-bold', seg.textColor)}>{seg.pct}%</div>
            <div className="mt-1 text-xs text-slate-500">{(seg.shares / 1e6).toFixed(1)}M shares</div>
            <div className="mt-3 h-2 rounded-full bg-slate-700">
              <div className={cn('h-2 rounded-full', seg.color)} style={{ width: `${seg.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Stacked bar */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Ownership Breakdown</h3>
        <div className="flex h-6 overflow-hidden rounded-full">
          <div className="bg-amber-500/70 transition-all" style={{ width: `${data.insiderPct}%` }} />
          <div className="bg-blue-500/70 transition-all" style={{ width: `${data.institutionalPct}%` }} />
          <div className="bg-emerald-500/70 transition-all" style={{ width: `${data.retailPct}%` }} />
        </div>
        <div className="mt-2 flex gap-4 text-xs">
          <span className="text-amber-400">■ Insider {data.insiderPct}%</span>
          <span className="text-blue-400">■ Institutional {data.institutionalPct}%</span>
          <span className="text-emerald-400">■ Retail {data.retailPct}%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {(['overview', 'insiders', 'institutions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Insider %</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Institutional %</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Retail %</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Total Shares</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {overviewData.map(o => (
                <tr key={o.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2">
                    <Link to={`/company/${o.ticker}`} className="font-mono text-xs font-bold text-violet-400 hover:underline">{o.ticker}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{o.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-amber-400">{o.insiderPct}%</td>
                  <td className="px-3 py-2 text-right text-xs text-blue-400">{o.institutionalPct}%</td>
                  <td className="px-3 py-2 text-right text-xs text-emerald-400">{o.retailPct}%</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{(o.totalShares / 1e9).toFixed(1)}B</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'insiders' && (
        <div>
          <div className="mb-3 flex items-center gap-4">
            <span className="text-xs text-emerald-400">Buys: {data.insiderBuys}</span>
            <span className="text-xs text-red-400">Sells: {data.insiderSells}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Title</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shares</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Change</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.topInsiders.map((ins, i) => (
                  <tr key={i} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs font-medium text-white">{ins.name}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{ins.title}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">{(ins.shares / 1e3).toFixed(0)}K</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', ins.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {ins.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {ins.change >= 0 ? '+' : ''}{ins.change.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">{ins.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'institutions' && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Institution</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shares</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">% Outstanding</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.topInstitutions.map((inst, i) => (
                <tr key={i} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs font-medium text-white">{inst.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{(inst.shares / 1e6).toFixed(1)}M</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{inst.pct}%</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn('text-xs font-medium', inst.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {inst.change >= 0 ? '+' : ''}{inst.change}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
