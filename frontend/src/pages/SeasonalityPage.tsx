import { useState, useMemo } from 'react';
import { CalendarDays, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface SeasonalData {
  monthlyReturns: { month: string; avgReturn: number; winRate: number; best: number; worst: number; years: { year: number; ret: number }[] }[];
  quarterlyReturns: { quarter: string; avgReturn: number; winRate: number }[];
  weekdayReturns: { day: string; avgReturn: number; winRate: number }[];
  bestMonth: string;
  worstMonth: string;
  sellInMayEffect: number;
  santaRally: number;
  januaryEffect: number;
}

function genSeasonal(ticker: string): SeasonalData {
  const s = seed(ticker + '_seasonal');

  const monthlyReturns = MONTHS.map((month, mi) => {
    const years = YEARS.map((year, yi) => {
      const ret = (pseudo(s, mi * 20 + yi) - 0.45) * 12;
      return { year, ret: +ret.toFixed(2) };
    });
    const avg = years.reduce((sum, y) => sum + y.ret, 0) / years.length;
    const wins = years.filter(y => y.ret > 0).length;
    return {
      month,
      avgReturn: +avg.toFixed(2),
      winRate: +((wins / years.length) * 100).toFixed(0),
      best: +Math.max(...years.map(y => y.ret)).toFixed(2),
      worst: +Math.min(...years.map(y => y.ret)).toFixed(2),
      years,
    };
  });

  const quarterlyReturns = ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, qi) => {
    const qMonths = monthlyReturns.slice(qi * 3, qi * 3 + 3);
    const avg = qMonths.reduce((sum, m) => sum + m.avgReturn, 0);
    const winRate = Math.round(qMonths.reduce((sum, m) => sum + m.winRate, 0) / 3);
    return { quarter, avgReturn: +avg.toFixed(2), winRate };
  });

  const weekdayReturns = WEEKDAYS.map((day, di) => ({
    day,
    avgReturn: +((pseudo(s, 200 + di) - 0.45) * 0.3).toFixed(3),
    winRate: +(45 + pseudo(s, 210 + di) * 15).toFixed(0),
  }));

  const sortedByAvg = [...monthlyReturns].sort((a, b) => b.avgReturn - a.avgReturn);

  const novDec = (monthlyReturns[10].avgReturn + monthlyReturns[11].avgReturn) / 2;
  const mayOct = monthlyReturns.slice(4, 10).reduce((s, m) => s + m.avgReturn, 0) / 6;

  return {
    monthlyReturns, quarterlyReturns, weekdayReturns,
    bestMonth: sortedByAvg[0].month,
    worstMonth: sortedByAvg[sortedByAvg.length - 1].month,
    sellInMayEffect: +mayOct.toFixed(2),
    santaRally: +novDec.toFixed(2),
    januaryEffect: monthlyReturns[0].avgReturn,
  };
}

export function SeasonalityPage() {
  const [selectedTicker, setSelectedTicker] = useState('SPY');
  const [tickerInput, setTickerInput] = useState('');
  const [view, setView] = useState<'monthly' | 'quarterly' | 'weekday' | 'heatmap'>('monthly');

  const data = useMemo(() => genSeasonal(selectedTicker), [selectedTicker]);

  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

  const maxAbsReturn = Math.max(...data.monthlyReturns.map(m => Math.abs(m.avgReturn)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-teal-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Seasonality</h1>
          <p className="text-sm text-slate-400">Monthly return patterns, seasonal strength, and calendar effects</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-teal-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Best Month', value: data.bestMonth, color: 'text-emerald-400' },
          { label: 'Worst Month', value: data.worstMonth, color: 'text-red-400' },
          { label: 'January Effect', value: `${data.januaryEffect >= 0 ? '+' : ''}${data.januaryEffect}%`, color: data.januaryEffect >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Sell in May', value: `${data.sellInMayEffect >= 0 ? '+' : ''}${data.sellInMayEffect}%`, color: data.sellInMayEffect >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Santa Rally', value: `${data.santaRally >= 0 ? '+' : ''}${data.santaRally}%`, color: data.santaRally >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Data Period', value: `${YEARS[0]}-${YEARS[YEARS.length - 1]}`, color: 'text-white' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {(['monthly', 'quarterly', 'weekday', 'heatmap'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', view === v ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white')}>
            {v}
          </button>
        ))}
      </div>

      {/* Monthly bar chart */}
      {view === 'monthly' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">Average Monthly Returns ({YEARS[0]}-{YEARS[YEARS.length - 1]})</h3>
            <div className="flex items-end gap-2" style={{ height: '180px' }}>
              {data.monthlyReturns.map(m => {
                const absHeight = maxAbsReturn > 0 ? (Math.abs(m.avgReturn) / maxAbsReturn) * 80 : 0;
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <span className={cn('text-[10px] font-medium', m.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {m.avgReturn >= 0 ? '+' : ''}{m.avgReturn}%
                    </span>
                    <div className="flex flex-col items-center" style={{ height: '120px', justifyContent: m.avgReturn >= 0 ? 'flex-end' : 'flex-start' }}>
                      <div className={cn('w-full rounded', m.avgReturn >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50')}
                        style={{ height: `${Math.max(4, absHeight)}px` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{m.month}</span>
                    <span className="text-[9px] text-slate-600">{m.winRate}% win</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Month</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Avg Return</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Win Rate</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Best</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Worst</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.monthlyReturns.map(m => (
                  <tr key={m.month} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs font-medium text-white">{m.month}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', m.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {m.avgReturn >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {m.avgReturn >= 0 ? '+' : ''}{m.avgReturn}%
                      </span>
                    </td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', m.winRate >= 60 ? 'text-emerald-400' : m.winRate >= 50 ? 'text-slate-300' : 'text-red-400')}>
                      {m.winRate}%
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-emerald-400">+{m.best}%</td>
                    <td className="px-3 py-2 text-right text-xs text-red-400">{m.worst}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quarterly */}
      {view === 'quarterly' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.quarterlyReturns.map(q => (
            <div key={q.quarter} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-lg font-bold text-white">{q.quarter}</div>
              <div className={cn('mt-2 text-2xl font-bold', q.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {q.avgReturn >= 0 ? '+' : ''}{q.avgReturn}%
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Win Rate</span>
                  <span>{q.winRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700">
                  <div className={cn('h-2 rounded-full', q.winRate >= 60 ? 'bg-emerald-500' : q.winRate >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${q.winRate}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Weekday */}
      {view === 'weekday' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            {data.weekdayReturns.map(d => (
              <div key={d.day} className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center">
                <div className="text-xs font-medium text-slate-400">{d.day}</div>
                <div className={cn('mt-2 text-xl font-bold', d.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.avgReturn >= 0 ? '+' : ''}{d.avgReturn}%
                </div>
                <div className="mt-2 text-xs text-slate-500">{d.winRate}% positive</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {view === 'heatmap' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Year x Month Return Heatmap</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-400">Year</th>
                  {MONTHS.map(m => (
                    <th key={m} className="px-2 py-1.5 text-center text-xs font-medium text-slate-400">{m}</th>
                  ))}
                  <th className="px-2 py-1.5 text-center text-xs font-medium text-slate-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {YEARS.map(year => {
                  const yearReturns = data.monthlyReturns.map(m => {
                    const yd = m.years.find(y => y.year === year);
                    return yd ? yd.ret : 0;
                  });
                  const total = yearReturns.reduce((s, r) => s + r, 0);
                  return (
                    <tr key={year} className="border-t border-slate-700/50">
                      <td className="px-2 py-1.5 text-xs font-medium text-slate-300">{year}</td>
                      {yearReturns.map((ret, i) => {
                        const intensity = Math.min(1, Math.abs(ret) / 8);
                        const bg = ret >= 0
                          ? `rgba(16, 185, 129, ${intensity * 0.4})`
                          : `rgba(239, 68, 68, ${intensity * 0.4})`;
                        return (
                          <td key={i} className="px-2 py-1.5 text-center text-[10px] font-medium"
                            style={{ backgroundColor: bg, color: ret >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                            {ret >= 0 ? '+' : ''}{ret.toFixed(1)}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center text-xs font-bold"
                        style={{ color: total >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                        {total >= 0 ? '+' : ''}{total.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-600">
                  <td className="px-2 py-1.5 text-xs font-bold text-white">Avg</td>
                  {data.monthlyReturns.map((m, i) => (
                    <td key={i} className={cn('px-2 py-1.5 text-center text-[10px] font-bold', m.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {m.avgReturn >= 0 ? '+' : ''}{m.avgReturn}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center text-xs font-bold text-teal-400">
                    {(data.monthlyReturns.reduce((s, m) => s + m.avgReturn, 0)).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
