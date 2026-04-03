import { useState, useMemo } from 'react';
import { Network, Search, ArrowRight, Building2, TrendingUp, TrendingDown } from 'lucide-react';
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

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

interface SupplierCustomer {
  name: string;
  ticker?: string;
  type: 'Supplier' | 'Customer';
  revPct: number;
  relationship: 'Critical' | 'Major' | 'Minor';
  country: string;
  sector: string;
  riskScore: number;
  trend: number;
}

const SUPPLIERS_DB: Record<string, string[]> = {
  AAPL: ['TSMC', 'Foxconn', 'Samsung Display', 'Qualcomm', 'Broadcom', 'Texas Instruments', 'Corning', 'Murata Manufacturing'],
  MSFT: ['Intel', 'AMD', 'Samsung', 'Seagate', 'Western Digital', 'Flex', 'Celestica', 'Jabil'],
  GOOGL: ['TSMC', 'Samsung', 'Intel', 'Micron', 'SK Hynix', 'Broadcom', 'Arista Networks', 'Juniper'],
  AMZN: ['Intel', 'AMD', 'NVIDIA', 'Kyndryl', 'Flex', 'UPS', 'FedEx', 'USPS'],
  NVDA: ['TSMC', 'Samsung', 'SK Hynix', 'Micron', 'ASE Group', 'Amkor', 'Lam Research', 'ASML'],
  META: ['TSMC', 'Samsung', 'Intel', 'Qualcomm', 'Broadcom', 'Arista Networks', 'Dell', 'HP'],
  TSLA: ['Panasonic', 'CATL', 'LG Energy', 'Samsung SDI', 'BYD', 'Bosch', 'Continental', 'Aptiv'],
  JPM: ['FIS', 'Fiserv', 'IBM', 'Accenture', 'Infosys', 'TCS', 'Cognizant', 'Wipro'],
};

const CUSTOMERS_DB: Record<string, string[]> = {
  AAPL: ['Best Buy', 'Verizon', 'AT&T', 'T-Mobile', 'Amazon', 'Walmart', 'Target', 'Costco'],
  MSFT: ['US Government', 'Amazon', 'Accenture', 'Deloitte', 'SAP', 'Salesforce', 'HP', 'Dell'],
  GOOGL: ['Samsung', 'Apple', 'Amazon', 'P&G', 'Unilever', 'Disney', 'Comcast', 'AT&T'],
  AMZN: ['Consumer Direct', 'AWS Enterprise', 'US Government', 'Netflix', 'Airbnb', 'Slack', 'Lyft', 'Pinterest'],
  NVDA: ['Microsoft', 'Amazon', 'Google', 'Meta', 'Tesla', 'Baidu', 'Alibaba', 'Oracle'],
  META: ['SMB Advertisers', 'P&G', 'Unilever', 'Disney', 'Amazon', 'Samsung', 'Coca-Cola', 'Nike'],
  TSLA: ['Consumer Direct', 'Fleet Sales', 'Hertz', 'Enterprise', 'Uber', 'Government', 'Utilities', 'Solar City'],
  JPM: ['Institutional Investors', 'Corporate Clients', 'Retail Banking', 'Wealth Mgmt', 'Trading Desks', 'Government', 'Insurance', 'Pension Funds'],
};

const COUNTRIES = ['USA', 'Taiwan', 'South Korea', 'Japan', 'China', 'Germany', 'India', 'UK'];
const SECTORS = ['Semiconductors', 'Electronics', 'Software', 'Services', 'Manufacturing', 'Logistics', 'Financial', 'Energy'];

function genSupplyChain(ticker: string): SupplierCustomer[] {
  const s = seed(ticker + '_sc');
  const suppliers = (SUPPLIERS_DB[ticker] || SUPPLIERS_DB['AAPL']).map((name, i) => {
    const revPct = 1 + pseudo(s, i * 5) * 25;
    const riskScore = Math.floor(1 + pseudo(s, i * 5 + 1) * 10);
    const relationship = revPct > 15 ? 'Critical' : revPct > 8 ? 'Major' : 'Minor';
    return {
      name, type: 'Supplier' as const, revPct: +revPct.toFixed(1), relationship,
      country: COUNTRIES[Math.floor(pseudo(s, i * 5 + 2) * COUNTRIES.length)],
      sector: SECTORS[Math.floor(pseudo(s, i * 5 + 3) * SECTORS.length)],
      riskScore, trend: +((pseudo(s, i * 5 + 4) - 0.5) * 20).toFixed(1),
    };
  });

  const customers = (CUSTOMERS_DB[ticker] || CUSTOMERS_DB['AAPL']).map((name, i) => {
    const revPct = 2 + pseudo(s, 50 + i * 5) * 20;
    const riskScore = Math.floor(1 + pseudo(s, 50 + i * 5 + 1) * 10);
    const relationship = revPct > 15 ? 'Critical' : revPct > 8 ? 'Major' : 'Minor';
    return {
      name, type: 'Customer' as const, revPct: +revPct.toFixed(1), relationship,
      country: COUNTRIES[Math.floor(pseudo(s, 50 + i * 5 + 2) * COUNTRIES.length)],
      sector: SECTORS[Math.floor(pseudo(s, 50 + i * 5 + 3) * SECTORS.length)],
      riskScore, trend: +((pseudo(s, 50 + i * 5 + 4) - 0.5) * 20).toFixed(1),
    };
  });

  return [...suppliers, ...customers].sort((a, b) => b.revPct - a.revPct);
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-400',
  Major: 'bg-amber-500/20 text-amber-400',
  Minor: 'bg-slate-500/20 text-slate-400',
};

export function SupplyChainPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Supplier' | 'Customer'>('all');

  const chain = useMemo(() => genSupplyChain(selectedTicker), [selectedTicker]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return chain;
    return chain.filter(c => c.type === filterType);
  }, [chain, filterType]);

  const suppliers = chain.filter(c => c.type === 'Supplier');
  const customers = chain.filter(c => c.type === 'Customer');
  const criticalCount = chain.filter(c => c.relationship === 'Critical').length;
  const avgRisk = chain.reduce((s, c) => s + c.riskScore, 0) / chain.length;
  const countryDist = chain.reduce((acc, c) => { acc[c.country] = (acc[c.country] || 0) + 1; return acc; }, {} as Record<string, number>);
  const topCountries = Object.entries(countryDist).sort((a, b) => b[1] - a[1]);

  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Network className="h-6 w-6 text-sky-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Supply Chain</h1>
          <p className="text-sm text-slate-400">Vendor/customer relationships, dependencies, and risk analysis</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-sky-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Suppliers', value: suppliers.length.toString(), color: 'text-blue-400' },
          { label: 'Customers', value: customers.length.toString(), color: 'text-emerald-400' },
          { label: 'Critical Links', value: criticalCount.toString(), color: 'text-red-400' },
          { label: 'Avg Risk Score', value: avgRisk.toFixed(1) + '/10', color: avgRisk > 6 ? 'text-red-400' : 'text-amber-400' },
          { label: 'Countries', value: topCountries.length.toString(), color: 'text-white' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Visual flow */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Supply Chain Flow</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="text-center text-xs font-medium text-blue-400 mb-2">Suppliers</div>
            {suppliers.slice(0, 5).map(s => (
              <div key={s.name} className="flex items-center justify-between rounded-lg bg-blue-500/10 px-3 py-1.5">
                <span className="text-[11px] text-slate-300">{s.name}</span>
                <span className="text-[10px] text-blue-400">{s.revPct}%</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="h-5 w-5 text-slate-600" />
            <div className="rounded-xl border-2 border-sky-500/50 bg-sky-500/10 px-4 py-3 text-center">
              <Building2 className="mx-auto h-5 w-5 text-sky-400" />
              <div className="mt-1 font-mono text-sm font-bold text-sky-400">{selectedTicker}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="text-center text-xs font-medium text-emerald-400 mb-2">Customers</div>
            {customers.slice(0, 5).map(c => (
              <div key={c.name} className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-1.5">
                <span className="text-[11px] text-slate-300">{c.name}</span>
                <span className="text-[10px] text-emerald-400">{c.revPct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Geographic distribution */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Geographic Distribution</h3>
        <div className="space-y-2">
          {topCountries.map(([country, count]) => (
            <div key={country} className="flex items-center gap-3">
              <span className="w-24 text-xs text-slate-300">{country}</span>
              <div className="flex-1 h-3 rounded-full bg-slate-700">
                <div className="h-3 rounded-full bg-sky-500/50" style={{ width: `${(count / chain.length) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-400">{count} ({((count / chain.length) * 100).toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {(['all', 'Supplier', 'Customer'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', filterType === f ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white')}>
            {f === 'all' ? 'All' : f + 's'}
          </button>
        ))}
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Entity</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Type</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Relationship</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev %</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Country</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Risk</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map((c, i) => (
              <tr key={i} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs font-medium text-white">{c.name}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold',
                    c.type === 'Supplier' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400')}>
                    {c.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', RELATIONSHIP_COLORS[c.relationship])}>
                    {c.relationship}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{c.revPct}%</td>
                <td className="px-3 py-2 text-xs text-slate-400">{c.country}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{c.sector}</td>
                <td className="px-3 py-2 text-right">
                  <span className={cn('text-xs font-medium', c.riskScore > 7 ? 'text-red-400' : c.riskScore > 4 ? 'text-amber-400' : 'text-emerald-400')}>
                    {c.riskScore}/10
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', c.trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {c.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {c.trend >= 0 ? '+' : ''}{c.trend}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
