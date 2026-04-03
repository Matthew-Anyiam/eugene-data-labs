import { useState, useMemo } from 'react';
import { Banknote, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const COUNTRIES = [
  { name: 'United States', code: 'US', gdp: 25500, debtGDP: 123 },
  { name: 'Japan', code: 'JP', gdp: 4200, debtGDP: 264 },
  { name: 'China', code: 'CN', gdp: 17900, debtGDP: 77 },
  { name: 'United Kingdom', code: 'UK', gdp: 3100, debtGDP: 101 },
  { name: 'France', code: 'FR', gdp: 2800, debtGDP: 112 },
  { name: 'Italy', code: 'IT', gdp: 2000, debtGDP: 144 },
  { name: 'Germany', code: 'DE', gdp: 4100, debtGDP: 66 },
  { name: 'Canada', code: 'CA', gdp: 2100, debtGDP: 107 },
  { name: 'Brazil', code: 'BR', gdp: 1900, debtGDP: 87 },
  { name: 'India', code: 'IN', gdp: 3500, debtGDP: 83 },
];

interface CorporateDebt {
  company: string;
  ticker: string;
  totalDebt: number;
  netDebt: number;
  debtEquity: number;
  interestCoverage: number;
  maturityProfile: { year: number; amount: number }[];
  rating: string;
  ratingChange: 'Upgrade' | 'Downgrade' | 'Stable';
}

const RATINGS = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB'];

function genCorporateDebt(): CorporateDebt[] {
  const companies = [
    { company: 'Apple', ticker: 'AAPL' }, { company: 'Microsoft', ticker: 'MSFT' },
    { company: 'Amazon', ticker: 'AMZN' }, { company: 'AT&T', ticker: 'T' },
    { company: 'Verizon', ticker: 'VZ' }, { company: 'JPMorgan', ticker: 'JPM' },
    { company: 'Ford Motor', ticker: 'F' }, { company: 'General Motors', ticker: 'GM' },
    { company: 'Boeing', ticker: 'BA' }, { company: 'Walt Disney', ticker: 'DIS' },
    { company: 'Comcast', ticker: 'CMCSA' }, { company: 'Tesla', ticker: 'TSLA' },
  ];

  return companies.map((c, i) => {
    const s = seed(c.ticker + '_debt');
    const totalDebt = 10 + pseudo(s, 0) * 190;
    const netDebt = totalDebt * (0.3 + pseudo(s, 1) * 0.6);
    const debtEquity = 0.2 + pseudo(s, 2) * 3;
    const interestCoverage = 2 + pseudo(s, 3) * 20;
    const rating = RATINGS[Math.floor(pseudo(s, 4) * RATINGS.length)];
    const ratingR = pseudo(s, 5);
    const ratingChange = ratingR > 0.7 ? 'Upgrade' : ratingR > 0.3 ? 'Stable' : 'Downgrade';
    const maturityProfile = Array.from({ length: 5 }, (_, j) => ({
      year: 2025 + j,
      amount: +(2 + pseudo(s, 10 + j) * totalDebt * 0.3).toFixed(1),
    }));

    return {
      ...c, totalDebt: +totalDebt.toFixed(1), netDebt: +netDebt.toFixed(1),
      debtEquity: +debtEquity.toFixed(2), interestCoverage: +interestCoverage.toFixed(1),
      maturityProfile, rating, ratingChange: ratingChange as CorporateDebt['ratingChange'],
    };
  }).sort((a, b) => b.totalDebt - a.totalDebt);
}

type Tab = 'sovereign' | 'corporate';

export function DebtMonitorPage() {
  const [tab, setTab] = useState<Tab>('sovereign');

  const corporateDebt = useMemo(() => genCorporateDebt(), []);

  const totalSovereignDebt = COUNTRIES.reduce((s, c) => s + c.gdp * c.debtGDP / 100, 0);
  const totalCorporateDebt = corporateDebt.reduce((s, c) => s + c.totalDebt, 0);
  const avgDebtGDP = COUNTRIES.reduce((s, c) => s + c.debtGDP, 0) / COUNTRIES.length;
  const highRisk = COUNTRIES.filter(c => c.debtGDP > 100).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Banknote className="h-6 w-6 text-rose-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Debt Monitor</h1>
          <p className="text-sm text-slate-400">Government and corporate debt tracking, maturity profiles</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Global Sovereign Debt', value: `$${(totalSovereignDebt / 1000).toFixed(1)}T`, color: 'text-white' },
          { label: 'Avg Debt/GDP', value: `${avgDebtGDP.toFixed(0)}%`, color: avgDebtGDP > 80 ? 'text-red-400' : 'text-amber-400' },
          { label: 'High Risk Nations', value: `${highRisk}/${COUNTRIES.length}`, color: 'text-red-400' },
          { label: 'Corp Debt Tracked', value: `$${totalCorporateDebt.toFixed(0)}B`, color: 'text-white' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {(['sovereign', 'corporate'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', tab === t ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'sovereign' && (
        <>
          {/* Debt/GDP bars */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">Debt-to-GDP Ratio by Country</h3>
            <div className="space-y-3">
              {[...COUNTRIES].sort((a, b) => b.debtGDP - a.debtGDP).map(c => {
                const width = Math.min(100, (c.debtGDP / 270) * 100);
                const color = c.debtGDP > 150 ? 'bg-red-500/60' : c.debtGDP > 100 ? 'bg-amber-500/60' : 'bg-emerald-500/60';
                const textColor = c.debtGDP > 150 ? 'text-red-400' : c.debtGDP > 100 ? 'text-amber-400' : 'text-emerald-400';
                return (
                  <div key={c.code} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-slate-300">{c.name}</span>
                    <div className="flex-1 h-4 rounded-full bg-slate-700">
                      <div className={cn('h-4 rounded-full', color)} style={{ width: `${width}%` }} />
                    </div>
                    <span className={cn('w-14 text-right text-xs font-bold', textColor)}>{c.debtGDP}%</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500/60" /> &lt;100%</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500/60" /> 100-150%</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500/60" /> &gt;150%</span>
            </div>
          </div>

          {/* Sovereign table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Country</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">GDP ($B)</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Debt/GDP</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Est. Debt ($T)</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {COUNTRIES.map(c => {
                  const debt = c.gdp * c.debtGDP / 100 / 1000;
                  const risk = c.debtGDP > 150 ? 'High' : c.debtGDP > 100 ? 'Medium' : 'Low';
                  const riskColor = risk === 'High' ? 'bg-red-500/20 text-red-400' : risk === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400';
                  return (
                    <tr key={c.code} className="bg-slate-800 hover:bg-slate-750">
                      <td className="px-3 py-2 text-xs font-medium text-white">{c.name}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-300">${c.gdp.toLocaleString()}B</td>
                      <td className={cn('px-3 py-2 text-right text-xs font-bold', c.debtGDP > 100 ? 'text-red-400' : 'text-emerald-400')}>{c.debtGDP}%</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-300">${debt.toFixed(1)}T</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', riskColor)}>{risk}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'corporate' && (
        <>
          {/* Maturity wall */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Corporate Debt Maturity Wall</h3>
            <div className="flex items-end gap-3" style={{ height: '160px' }}>
              {[2025, 2026, 2027, 2028, 2029].map(year => {
                const total = corporateDebt.reduce((s, c) => {
                  const m = c.maturityProfile.find(mp => mp.year === year);
                  return s + (m?.amount || 0);
                }, 0);
                const maxTotal = 200;
                const height = (total / maxTotal) * 140;
                return (
                  <div key={year} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400">${total.toFixed(0)}B</span>
                    <div className="w-full rounded-t bg-rose-500/40" style={{ height: `${Math.max(8, height)}px` }} />
                    <span className="text-[10px] text-slate-500">{year}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Corporate table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Total Debt</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Net Debt</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">D/E</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Int. Coverage</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Rating</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Outlook</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {corporateDebt.map(c => (
                  <tr key={c.ticker} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs font-medium text-white">{c.company}</td>
                    <td className="px-3 py-2 font-mono text-xs font-bold text-rose-400">{c.ticker}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">${c.totalDebt}B</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">${c.netDebt}B</td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', c.debtEquity > 2 ? 'text-red-400' : c.debtEquity > 1 ? 'text-amber-400' : 'text-emerald-400')}>
                      {c.debtEquity}x
                    </td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', c.interestCoverage < 5 ? 'text-red-400' : 'text-emerald-400')}>
                      {c.interestCoverage}x
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-bold text-white">{c.rating}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn('flex items-center justify-center gap-0.5 text-[10px] font-bold',
                        c.ratingChange === 'Upgrade' ? 'text-emerald-400' : c.ratingChange === 'Downgrade' ? 'text-red-400' : 'text-slate-400')}>
                        {c.ratingChange === 'Upgrade' ? <TrendingUp className="h-3 w-3" /> : c.ratingChange === 'Downgrade' ? <TrendingDown className="h-3 w-3" /> : null}
                        {c.ratingChange}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Companies with interest coverage below 5x and D/E above 2x may face refinancing risk in rising rate environments.
          </div>
        </>
      )}
    </div>
  );
}
