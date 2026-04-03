import { useState, useMemo } from 'react';
import { Rocket, TrendingUp, TrendingDown, Calendar, Lock, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

type Tab = 'recent' | 'upcoming' | 'lockups' | 'performance';

interface IPOEntry {
  company: string;
  ticker: string;
  date: string;
  ipoPrice: number;
  openPrice: number;
  currentPrice: number;
  firstDayReturn: number;
  returnSinceIPO: number;
  marketCap: number;
  sector: string;
  exchange: string;
  lockupExpiry: string;
  lockupDaysLeft: number;
  raised: number;
}

const COMPANIES = [
  { company: 'Nextera Robotics', ticker: 'NXTR', sector: 'Technology' },
  { company: 'Helios BioSciences', ticker: 'HBIO', sector: 'Healthcare' },
  { company: 'ArcLight Energy', ticker: 'ARCL', sector: 'Energy' },
  { company: 'QuantumLeap AI', ticker: 'QLAI', sector: 'Technology' },
  { company: 'Verde Agriculture', ticker: 'VRDE', sector: 'Consumer Staples' },
  { company: 'Pinnacle Fintech', ticker: 'PNFT', sector: 'Financials' },
  { company: 'Aether Cloud', ticker: 'AETR', sector: 'Technology' },
  { company: 'OceanDeep Mining', ticker: 'ODPX', sector: 'Materials' },
  { company: 'SkyBridge Logistics', ticker: 'SKBL', sector: 'Industrials' },
  { company: 'CryptoVault Inc', ticker: 'CVLT', sector: 'Financials' },
  { company: 'NeuralPath Health', ticker: 'NRPH', sector: 'Healthcare' },
  { company: 'SolarWave Tech', ticker: 'SWAV', sector: 'Technology' },
  { company: 'DataSphere Analytics', ticker: 'DSPH', sector: 'Technology' },
  { company: 'EcoMobility Corp', ticker: 'ECMB', sector: 'Consumer Discretionary' },
  { company: 'Atlas Semiconductor', ticker: 'ATLS', sector: 'Technology' },
  { company: 'Meridian Defense', ticker: 'MRDN', sector: 'Industrials' },
];

function genIPOs(): IPOEntry[] {
  return COMPANIES.map((c, idx) => {
    const s = seed(c.ticker + '_ipo');
    const ipoPrice = +(10 + pseudo(s, 0) * 40).toFixed(2);
    const firstDayReturn = +((pseudo(s, 1) - 0.3) * 80).toFixed(2);
    const openPrice = +(ipoPrice * (1 + firstDayReturn / 100)).toFixed(2);
    const returnSinceIPO = +((pseudo(s, 2) - 0.35) * 120).toFixed(2);
    const currentPrice = +(ipoPrice * (1 + returnSinceIPO / 100)).toFixed(2);
    const daysAgo = Math.floor(pseudo(s, 3) * 300);
    const lockupDays = 90 + Math.floor(pseudo(s, 4) * 90);

    const ipoDate = new Date(2026, 3, 3);
    ipoDate.setDate(ipoDate.getDate() - daysAgo);
    const lockupDate = new Date(ipoDate);
    lockupDate.setDate(lockupDate.getDate() + lockupDays);
    const lockupDaysLeft = Math.max(0, Math.floor((lockupDate.getTime() - Date.now()) / 86400000));

    return {
      ...c,
      date: ipoDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      ipoPrice,
      openPrice: Math.max(1, openPrice),
      currentPrice: Math.max(1, currentPrice),
      firstDayReturn,
      returnSinceIPO,
      marketCap: +(0.5 + pseudo(s, 5) * 49.5).toFixed(1),
      exchange: pseudo(s, 6) > 0.5 ? 'NASDAQ' : 'NYSE',
      lockupExpiry: lockupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lockupDaysLeft,
      raised: +(50 + pseudo(s, 7) * 950).toFixed(0),
    };
  });
}

export function IPOAnalysisPage() {
  const [tab, setTab] = useState<Tab>('recent');

  const ipos = useMemo(() => genIPOs(), []);

  const avgFirstDay = ipos.reduce((s, i) => s + i.firstDayReturn, 0) / ipos.length;
  const avgReturnSince = ipos.reduce((s, i) => s + i.returnSinceIPO, 0) / ipos.length;
  const totalRaised = ipos.reduce((s, i) => s + i.raised, 0);
  const upcomingLockups = ipos.filter(i => i.lockupDaysLeft > 0 && i.lockupDaysLeft <= 30).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Rocket className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">IPO Analysis</h1>
          <p className="text-sm text-slate-400">IPO performance, lock-up expirations, and first-day returns</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Avg First-Day Return</div>
          <div className={cn('mt-1 text-2xl font-bold', avgFirstDay >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {avgFirstDay >= 0 ? '+' : ''}{avgFirstDay.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Avg Return Since IPO</div>
          <div className={cn('mt-1 text-2xl font-bold', avgReturnSince >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {avgReturnSince >= 0 ? '+' : ''}{avgReturnSince.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Capital Raised</div>
          <div className="mt-1 text-2xl font-bold text-white">${(totalRaised / 1000).toFixed(1)}B</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="flex items-center gap-1 text-xs text-slate-500 uppercase tracking-wider">
            <Lock className="h-3 w-3" /> Lockups Expiring (30d)
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{upcomingLockups}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {([['recent', 'Recent IPOs'], ['upcoming', 'Performance Ranking'], ['lockups', 'Lock-up Expiry'], ['performance', 'Sector Breakdown']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium', tab === key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'recent' && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">IPO Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Open</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Current</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">1st Day</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Since IPO</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Exchange</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {ipos.map(ipo => (
                <tr key={ipo.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs text-white font-medium">{ipo.company}</td>
                  <td className="px-3 py-2 text-xs text-indigo-400 font-mono">{ipo.ticker}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{ipo.date}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${ipo.ipoPrice}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${ipo.openPrice}</td>
                  <td className="px-3 py-2 text-right text-xs text-white font-medium">${ipo.currentPrice}</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', ipo.firstDayReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {ipo.firstDayReturn >= 0 ? '+' : ''}{ipo.firstDayReturn}%
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', ipo.returnSinceIPO >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {ipo.returnSinceIPO >= 0 ? '+' : ''}{ipo.returnSinceIPO}%
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{ipo.exchange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...ipos].sort((a, b) => b.returnSinceIPO - a.returnSinceIPO).map((ipo, i) => (
            <div key={ipo.ticker} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">#{i + 1}</span>
                  <span className="text-sm font-bold text-white">{ipo.ticker}</span>
                  <span className="text-xs text-slate-400">{ipo.company}</span>
                </div>
                <span className={cn('text-sm font-bold', ipo.returnSinceIPO >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {ipo.returnSinceIPO >= 0 ? '+' : ''}{ipo.returnSinceIPO}%
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>IPO: ${ipo.ipoPrice}</span>
                <span>Now: ${ipo.currentPrice}</span>
                <span>MCap: ${ipo.marketCap}B</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'lockups' && (
        <div className="space-y-3">
          {[...ipos].sort((a, b) => a.lockupDaysLeft - b.lockupDaysLeft).map(ipo => (
            <div key={ipo.ticker} className={cn(
              'rounded-xl border bg-slate-800 p-4',
              ipo.lockupDaysLeft <= 7 ? 'border-red-700/50' : ipo.lockupDaysLeft <= 30 ? 'border-amber-700/50' : 'border-slate-700'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className={cn('h-4 w-4', ipo.lockupDaysLeft <= 7 ? 'text-red-400' : ipo.lockupDaysLeft <= 30 ? 'text-amber-400' : 'text-slate-500')} />
                  <div>
                    <span className="text-sm font-bold text-white">{ipo.ticker}</span>
                    <span className="ml-2 text-xs text-slate-400">{ipo.company}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('text-sm font-bold', ipo.lockupDaysLeft <= 7 ? 'text-red-400' : ipo.lockupDaysLeft <= 30 ? 'text-amber-400' : 'text-slate-300')}>
                    {ipo.lockupDaysLeft === 0 ? 'Expired' : `${ipo.lockupDaysLeft} days`}
                  </div>
                  <div className="text-[10px] text-slate-500">{ipo.lockupExpiry}</div>
                </div>
              </div>
              <div className="mt-2">
                <div className="h-2 rounded-full bg-slate-700">
                  <div className={cn('h-2 rounded-full', ipo.lockupDaysLeft <= 7 ? 'bg-red-500/60' : ipo.lockupDaysLeft <= 30 ? 'bg-amber-500/60' : 'bg-emerald-500/60')}
                    style={{ width: `${Math.max(2, 100 - (ipo.lockupDaysLeft / 180) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'performance' && (() => {
        const sectors = [...new Set(ipos.map(i => i.sector))];
        return (
          <div className="space-y-4">
            {sectors.map(sector => {
              const sectorIPOs = ipos.filter(i => i.sector === sector);
              const avgReturn = sectorIPOs.reduce((s, i) => s + i.returnSinceIPO, 0) / sectorIPOs.length;
              return (
                <div key={sector} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{sector}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{sectorIPOs.length} IPOs</span>
                      <span className={cn('text-xs font-medium', avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        Avg: {avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sectorIPOs.map(ipo => (
                      <div key={ipo.ticker} className={cn(
                        'rounded-lg border px-2 py-1',
                        ipo.returnSinceIPO >= 0 ? 'border-emerald-700/50 bg-emerald-900/20' : 'border-red-700/50 bg-red-900/20'
                      )}>
                        <span className="text-xs font-mono text-white">{ipo.ticker}</span>
                        <span className={cn('ml-1 text-[10px] font-medium', ipo.returnSinceIPO >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {ipo.returnSinceIPO >= 0 ? '+' : ''}{ipo.returnSinceIPO}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
