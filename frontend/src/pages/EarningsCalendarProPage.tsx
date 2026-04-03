import { useState, useMemo } from 'react';
import { CalendarDays, TrendingUp, TrendingDown, Filter, Clock } from 'lucide-react';
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

const STOCKS = [
  { ticker: 'AAPL', name: 'Apple', sector: 'Technology', cap: 3000 },
  { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', cap: 2800 },
  { ticker: 'GOOGL', name: 'Alphabet', sector: 'Technology', cap: 1800 },
  { ticker: 'AMZN', name: 'Amazon', sector: 'Consumer', cap: 1700 },
  { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', cap: 2200 },
  { ticker: 'META', name: 'Meta', sector: 'Technology', cap: 1200 },
  { ticker: 'TSLA', name: 'Tesla', sector: 'Consumer', cap: 800 },
  { ticker: 'JPM', name: 'JPMorgan', sector: 'Financials', cap: 550 },
  { ticker: 'V', name: 'Visa', sector: 'Financials', cap: 530 },
  { ticker: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', cap: 480 },
  { ticker: 'NFLX', name: 'Netflix', sector: 'Technology', cap: 280 },
  { ticker: 'AMD', name: 'AMD', sector: 'Technology', cap: 240 },
  { ticker: 'CRM', name: 'Salesforce', sector: 'Technology', cap: 250 },
  { ticker: 'DIS', name: 'Disney', sector: 'Consumer', cap: 190 },
  { ticker: 'BA', name: 'Boeing', sector: 'Industrial', cap: 130 },
  { ticker: 'GS', name: 'Goldman Sachs', sector: 'Financials', cap: 150 },
  { ticker: 'COST', name: 'Costco', sector: 'Consumer', cap: 340 },
  { ticker: 'HD', name: 'Home Depot', sector: 'Consumer', cap: 350 },
  { ticker: 'WMT', name: 'Walmart', sector: 'Consumer', cap: 430 },
  { ticker: 'INTC', name: 'Intel', sector: 'Technology', cap: 110 },
  { ticker: 'QCOM', name: 'Qualcomm', sector: 'Technology', cap: 180 },
  { ticker: 'ADBE', name: 'Adobe', sector: 'Technology', cap: 220 },
  { ticker: 'PG', name: 'P&G', sector: 'Consumer Staples', cap: 380 },
  { ticker: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples', cap: 260 },
];

interface EarningsEntry {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  reportDate: string;
  reportTime: 'BMO' | 'AMC';
  epsConsensus: number;
  epsWhisper: number;
  whisperDelta: number;
  revConsensus: number;
  historicalBeatRate: number;
  avgSurprise: number;
  avgMoveOnBeat: number;
  avgMoveOnMiss: number;
  impliedMove: number;
  lastQSurprise: number;
  analystCount: number;
  confidence: 'High' | 'Medium' | 'Low';
}

function genEarnings(): EarningsEntry[] {
  return STOCKS.map(stock => {
    const s = seed(stock.ticker + '_epro');
    const epsConsensus = 0.5 + pseudo(s, 0) * 5;
    const whisperDelta = (pseudo(s, 1) - 0.4) * 0.5;
    const epsWhisper = epsConsensus + whisperDelta;
    const revConsensus = 5 + pseudo(s, 2) * 80;
    const beatRate = 50 + pseudo(s, 3) * 40;
    const avgSurprise = (pseudo(s, 4) - 0.3) * 15;
    const avgBeatMove = 1 + pseudo(s, 5) * 8;
    const avgMissMove = -(1 + pseudo(s, 6) * 10);
    const impliedMove = 2 + pseudo(s, 7) * 8;
    const lastQSurprise = (pseudo(s, 8) - 0.4) * 20;
    const dayOfMonth = 1 + Math.floor(pseudo(s, 9) * 28);
    const month = 1 + Math.floor(pseudo(s, 10) * 3);
    const time = pseudo(s, 11) > 0.5 ? 'BMO' : 'AMC';
    const analystCount = 5 + Math.floor(pseudo(s, 12) * 40);
    const conf = beatRate > 75 ? 'High' : beatRate > 60 ? 'Medium' : 'Low';

    return {
      ticker: stock.ticker, name: stock.name, sector: stock.sector, marketCap: stock.cap,
      reportDate: `2025-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`,
      reportTime: time as 'BMO' | 'AMC',
      epsConsensus: +epsConsensus.toFixed(2), epsWhisper: +epsWhisper.toFixed(2),
      whisperDelta: +whisperDelta.toFixed(2), revConsensus: +revConsensus.toFixed(1),
      historicalBeatRate: +beatRate.toFixed(0), avgSurprise: +avgSurprise.toFixed(1),
      avgMoveOnBeat: +avgBeatMove.toFixed(1), avgMoveOnMiss: +avgMissMove.toFixed(1),
      impliedMove: +impliedMove.toFixed(1), lastQSurprise: +lastQSurprise.toFixed(1),
      analystCount, confidence: conf,
    };
  }).sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}

const CONF_COLORS: Record<string, string> = {
  High: 'bg-emerald-500/20 text-emerald-400',
  Medium: 'bg-amber-500/20 text-amber-400',
  Low: 'bg-red-500/20 text-red-400',
};

export function EarningsCalendarProPage() {
  const [timeFilter, setTimeFilter] = useState<'all' | 'BMO' | 'AMC'>('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'reportDate' | 'impliedMove' | 'historicalBeatRate'>('reportDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const allEarnings = useMemo(() => genEarnings(), []);
  const sectors = useMemo(() => [...new Set(allEarnings.map(e => e.sector))], [allEarnings]);

  const filtered = useMemo(() => {
    let list = [...allEarnings];
    if (timeFilter !== 'all') list = list.filter(e => e.reportTime === timeFilter);
    if (sectorFilter !== 'all') list = list.filter(e => e.sector === sectorFilter);
    list.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [allEarnings, timeFilter, sectorFilter, sortBy, sortDir]);

  const avgBeatRate = allEarnings.reduce((s, e) => s + e.historicalBeatRate, 0) / allEarnings.length;
  const avgImplied = allEarnings.reduce((s, e) => s + e.impliedMove, 0) / allEarnings.length;
  const whisperBullish = allEarnings.filter(e => e.whisperDelta > 0).length;
  const highConfidence = allEarnings.filter(e => e.confidence === 'High').length;

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir(key === 'reportDate' ? 'asc' : 'desc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-orange-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Calendar Pro</h1>
          <p className="text-sm text-slate-400">Whisper numbers, implied moves, historical accuracy</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {(['all', 'BMO', 'AMC'] as const).map(f => (
            <button key={f} onClick={() => setTimeFilter(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', timeFilter === f ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f === 'all' ? 'All' : f === 'BMO' ? 'Before Open' : 'After Close'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white">
            <option value="all">All Sectors</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Avg Beat Rate', value: `${avgBeatRate.toFixed(0)}%`, color: 'text-emerald-400' },
          { label: 'Avg Implied Move', value: `${avgImplied.toFixed(1)}%`, color: 'text-amber-400' },
          { label: 'Whisper Bullish', value: `${whisperBullish}/${allEarnings.length}`, color: whisperBullish > allEarnings.length / 2 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'High Confidence', value: `${highConfidence}`, color: 'text-orange-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-2 py-2 text-left">
                <button onClick={() => toggleSort('reportDate')} className={cn('text-xs font-medium', sortBy === 'reportDate' ? 'text-orange-400' : 'text-slate-400')}>
                  Date {sortBy === 'reportDate' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-slate-400">Company</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Time</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">EPS Est</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Whisper</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Rev Est</th>
              <th className="px-2 py-2 text-right">
                <button onClick={() => toggleSort('historicalBeatRate')} className={cn('text-xs font-medium', sortBy === 'historicalBeatRate' ? 'text-orange-400' : 'text-slate-400')}>
                  Beat Rate {sortBy === 'historicalBeatRate' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Avg Surprise</th>
              <th className="px-2 py-2 text-right">
                <button onClick={() => toggleSort('impliedMove')} className={cn('text-xs font-medium', sortBy === 'impliedMove' ? 'text-orange-400' : 'text-slate-400')}>
                  Implied {sortBy === 'impliedMove' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Beat/Miss</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(e => (
              <tr key={e.ticker} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-2 py-2 text-xs text-slate-400">{e.reportDate}</td>
                <td className="px-2 py-2">
                  <Link to={`/company/${e.ticker}`} className="font-mono text-xs font-bold text-orange-400 hover:underline">{e.ticker}</Link>
                </td>
                <td className="px-2 py-2 text-xs text-slate-300">{e.name}</td>
                <td className="px-2 py-2 text-center">
                  <span className={cn('flex items-center justify-center gap-0.5 text-[10px] font-medium', e.reportTime === 'BMO' ? 'text-amber-400' : 'text-blue-400')}>
                    <Clock className="h-3 w-3" /> {e.reportTime}
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-xs text-slate-300">${e.epsConsensus}</td>
                <td className="px-2 py-2 text-right">
                  <div className="text-xs text-white font-medium">${e.epsWhisper}</div>
                  <div className={cn('text-[9px]', e.whisperDelta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {e.whisperDelta >= 0 ? '+' : ''}{e.whisperDelta}
                  </div>
                </td>
                <td className="px-2 py-2 text-right text-xs text-slate-300">${e.revConsensus}B</td>
                <td className={cn('px-2 py-2 text-right text-xs font-bold', e.historicalBeatRate >= 75 ? 'text-emerald-400' : e.historicalBeatRate >= 60 ? 'text-amber-400' : 'text-red-400')}>
                  {e.historicalBeatRate}%
                </td>
                <td className={cn('px-2 py-2 text-right text-xs font-medium', e.avgSurprise >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {e.avgSurprise >= 0 ? '+' : ''}{e.avgSurprise}%
                </td>
                <td className="px-2 py-2 text-right text-xs text-amber-400 font-medium">±{e.impliedMove}%</td>
                <td className="px-2 py-2 text-right text-[10px]">
                  <span className="text-emerald-400">+{e.avgMoveOnBeat}%</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-red-400">{e.avgMoveOnMiss}%</span>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', CONF_COLORS[e.confidence])}>{e.confidence}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-[10px] text-slate-500 space-y-1">
        <div><strong className="text-slate-400">Whisper:</strong> Unofficial EPS expectation from buy-side analysts, often more accurate than consensus</div>
        <div><strong className="text-slate-400">Implied Move:</strong> Expected post-earnings price move priced into options (straddle)</div>
        <div><strong className="text-slate-400">Beat Rate:</strong> Historical % of quarters where company beat consensus EPS</div>
        <div><strong className="text-slate-400">BMO/AMC:</strong> Before Market Open / After Market Close</div>
      </div>
    </div>
  );
}
