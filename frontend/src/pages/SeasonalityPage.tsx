import { useState, useMemo } from 'react';
import { CalendarDays, Search, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import { eugeneApi } from '../lib/api';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface OhlcvBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MonthlyReturn {
  month: string;
  monthIndex: number;
  avgReturn: number;
  winRate: number;
  best: number;
  worst: number;
  years: { year: number; ret: number }[];
}

function computeMonthlyReturns(bars: OhlcvBar[]): MonthlyReturn[] {
  // Group bars by year-month
  const monthly = new Map<string, OhlcvBar[]>();
  for (const bar of bars) {
    const key = bar.date.slice(0, 7); // YYYY-MM
    if (!monthly.has(key)) monthly.set(key, []);
    monthly.get(key)!.push(bar);
  }

  // For each month key derive the monthly return = (last close / first open - 1) * 100
  const monthReturns: { year: number; monthIndex: number; ret: number }[] = [];
  for (const [key, dayBars] of monthly.entries()) {
    const sorted = [...dayBars].sort((a, b) => a.date.localeCompare(b.date));
    const firstOpen = sorted[0].open;
    const lastClose = sorted[sorted.length - 1].close;
    if (!firstOpen || !lastClose) continue;
    const ret = ((lastClose - firstOpen) / firstOpen) * 100;
    const year = parseInt(key.slice(0, 4), 10);
    const monthIndex = parseInt(key.slice(5, 7), 10) - 1; // 0-based
    monthReturns.push({ year, monthIndex, ret });
  }

  return MONTHS.map((month, mi) => {
    const forMonth = monthReturns.filter((r) => r.monthIndex === mi);
    if (!forMonth.length) {
      return { month, monthIndex: mi, avgReturn: 0, winRate: 0, best: 0, worst: 0, years: [] };
    }
    const avg = forMonth.reduce((s, r) => s + r.ret, 0) / forMonth.length;
    const wins = forMonth.filter((r) => r.ret > 0).length;
    const rets = forMonth.map((r) => r.ret);
    return {
      month,
      monthIndex: mi,
      avgReturn: parseFloat(avg.toFixed(2)),
      winRate: parseFloat(((wins / forMonth.length) * 100).toFixed(0)),
      best: parseFloat(Math.max(...rets).toFixed(2)),
      worst: parseFloat(Math.min(...rets).toFixed(2)),
      years: forMonth.map((r) => ({ year: r.year, ret: parseFloat(r.ret.toFixed(2)) })),
    };
  });
}

export function SeasonalityPage() {
  const [selectedTicker, setSelectedTicker] = useState('SPY');
  const [tickerInput, setTickerInput] = useState('');
  const [view, setView] = useState<'monthly' | 'quarterly' | 'heatmap'>('monthly');

  const {
    data: rawBars,
    isLoading,
    isError,
  } = useQuery<OhlcvBar[]>({
    queryKey: ['ohlcv-seasonality', selectedTicker],
    queryFn: () =>
      eugeneApi(`/v1/sec/${selectedTicker}/ohlcv`, { interval: 'daily' }),
    enabled: !!selectedTicker,
  });

  const bars: OhlcvBar[] = rawBars ?? [];

  const monthlyReturns = useMemo(() => computeMonthlyReturns(bars), [bars]);

  const quarterlyReturns = useMemo(() => {
    return ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, qi) => {
      const qMonths = monthlyReturns.slice(qi * 3, qi * 3 + 3);
      const avg = qMonths.reduce((s, m) => s + m.avgReturn, 0);
      const winRate = qMonths.length
        ? Math.round(qMonths.reduce((s, m) => s + m.winRate, 0) / qMonths.length)
        : 0;
      return { quarter, avgReturn: parseFloat(avg.toFixed(2)), winRate };
    });
  }, [monthlyReturns]);

  const allYears = useMemo(() => {
    const ys = new Set<number>();
    for (const m of monthlyReturns) for (const y of m.years) ys.add(y.year);
    return Array.from(ys).sort();
  }, [monthlyReturns]);

  const sortedByAvg = useMemo(
    () => [...monthlyReturns].sort((a, b) => b.avgReturn - a.avgReturn),
    [monthlyReturns],
  );

  const bestMonth = sortedByAvg[0]?.month ?? '—';
  const worstMonth = sortedByAvg[sortedByAvg.length - 1]?.month ?? '—';
  const januaryEffect = monthlyReturns[0]?.avgReturn ?? 0;
  const mayOctAvg = monthlyReturns.length
    ? monthlyReturns.slice(4, 10).reduce((s, m) => s + m.avgReturn, 0) / 6
    : 0;
  const santaRallyAvg = monthlyReturns.length
    ? (monthlyReturns[10]?.avgReturn + monthlyReturns[11]?.avgReturn) / 2
    : 0;

  const maxAbsReturn = Math.max(...monthlyReturns.map((m) => Math.abs(m.avgReturn)), 0.01);

  const selectTicker = (t: string) => {
    setSelectedTicker(t.toUpperCase());
    setTickerInput('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-teal-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Seasonality</h1>
          <p className="text-sm text-slate-400">
            Monthly return patterns, seasonal strength, and calendar effects
          </p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput);
            }}
            placeholder="Ticker…"
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
          />
        </div>
        {DEFAULT_TICKERS.map((t) => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium',
              selectedTicker === t
                ? 'bg-teal-600 text-white'
                : 'border border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
          <span className="ml-3 text-slate-400">Loading OHLCV data for {selectedTicker}…</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center py-16">
          <span className="text-red-400">
            Failed to load OHLCV data for {selectedTicker}. Please try again.
          </span>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Best Month', value: bestMonth, color: 'text-emerald-400' },
              { label: 'Worst Month', value: worstMonth, color: 'text-red-400' },
              {
                label: 'January Effect',
                value: `${januaryEffect >= 0 ? '+' : ''}${januaryEffect}%`,
                color: januaryEffect >= 0 ? 'text-emerald-400' : 'text-red-400',
              },
              {
                label: 'May–Oct Avg',
                value: `${mayOctAvg >= 0 ? '+' : ''}${mayOctAvg.toFixed(2)}%`,
                color: mayOctAvg >= 0 ? 'text-emerald-400' : 'text-red-400',
              },
              {
                label: 'Santa Rally',
                value: `${santaRallyAvg >= 0 ? '+' : ''}${santaRallyAvg.toFixed(2)}%`,
                color: santaRallyAvg >= 0 ? 'text-emerald-400' : 'text-red-400',
              },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
                <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* View tabs */}
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
            {(['monthly', 'quarterly', 'heatmap'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-xs font-medium capitalize',
                  view === v ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Monthly bar chart */}
          {view === 'monthly' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white">
                  Average Monthly Returns — {selectedTicker}
                  {allYears.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({allYears[0]}–{allYears[allYears.length - 1]})
                    </span>
                  )}
                </h3>
                <div className="flex items-end gap-1" style={{ height: '180px' }}>
                  {monthlyReturns.map((m) => {
                    const absHeight =
                      maxAbsReturn > 0 ? (Math.abs(m.avgReturn) / maxAbsReturn) * 80 : 0;
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                        <span
                          className={cn(
                            'text-[9px] font-medium',
                            m.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400',
                          )}
                        >
                          {m.avgReturn >= 0 ? '+' : ''}
                          {m.avgReturn}%
                        </span>
                        <div
                          className="flex flex-col items-center"
                          style={{
                            height: '120px',
                            justifyContent: m.avgReturn >= 0 ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div
                            className={cn(
                              'w-full rounded',
                              m.avgReturn >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50',
                            )}
                            style={{ height: `${Math.max(4, absHeight)}px` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-500">{m.month}</span>
                        <span className="text-[8px] text-slate-600">{m.winRate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">
                        Month
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">
                        Avg Return
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">
                        Win Rate
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">
                        Best
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">
                        Worst
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {monthlyReturns.map((m) => (
                      <tr key={m.month} className="bg-slate-800 hover:bg-slate-750">
                        <td className="px-3 py-2 text-xs font-medium text-white">{m.month}</td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={cn(
                              'flex items-center justify-end gap-0.5 text-xs font-medium',
                              m.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400',
                            )}
                          >
                            {m.avgReturn >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {m.avgReturn >= 0 ? '+' : ''}
                            {m.avgReturn}%
                          </span>
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right text-xs font-medium',
                            m.winRate >= 60
                              ? 'text-emerald-400'
                              : m.winRate >= 50
                                ? 'text-slate-300'
                                : 'text-red-400',
                          )}
                        >
                          {m.winRate}%
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-emerald-400">
                          +{m.best}%
                        </td>
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
              {quarterlyReturns.map((q) => (
                <div key={q.quarter} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="text-lg font-bold text-white">{q.quarter}</div>
                  <div
                    className={cn(
                      'mt-2 text-2xl font-bold',
                      q.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {q.avgReturn >= 0 ? '+' : ''}
                    {q.avgReturn}%
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>Win Rate</span>
                      <span>{q.winRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          q.winRate >= 60
                            ? 'bg-emerald-500'
                            : q.winRate >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500',
                        )}
                        style={{ width: `${q.winRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Heatmap */}
          {view === 'heatmap' && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Year × Month Return Heatmap — {selectedTicker}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-400">
                        Year
                      </th>
                      {MONTHS.map((m) => (
                        <th
                          key={m}
                          className="px-2 py-1.5 text-center text-xs font-medium text-slate-400"
                        >
                          {m}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-slate-400">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allYears.map((year) => {
                      const yearReturns = monthlyReturns.map((m) => {
                        const yd = m.years.find((y) => y.year === year);
                        return yd ? yd.ret : null;
                      });
                      const defined = yearReturns.filter((r) => r !== null) as number[];
                      const total = defined.reduce((s, r) => s + r, 0);
                      return (
                        <tr key={year} className="border-t border-slate-700/50">
                          <td className="px-2 py-1.5 text-xs font-medium text-slate-300">{year}</td>
                          {yearReturns.map((ret, i) => {
                            if (ret === null) {
                              return (
                                <td key={i} className="px-2 py-1.5 text-center text-[10px] text-slate-700">
                                  —
                                </td>
                              );
                            }
                            const intensity = Math.min(1, Math.abs(ret) / 8);
                            const bg =
                              ret >= 0
                                ? `rgba(16, 185, 129, ${intensity * 0.4})`
                                : `rgba(239, 68, 68, ${intensity * 0.4})`;
                            return (
                              <td
                                key={i}
                                className="px-2 py-1.5 text-center text-[10px] font-medium"
                                style={{
                                  backgroundColor: bg,
                                  color: ret >= 0 ? '#6ee7b7' : '#fca5a5',
                                }}
                              >
                                {ret >= 0 ? '+' : ''}
                                {ret.toFixed(1)}
                              </td>
                            );
                          })}
                          <td
                            className="px-2 py-1.5 text-center text-xs font-bold"
                            style={{ color: total >= 0 ? '#6ee7b7' : '#fca5a5' }}
                          >
                            {total >= 0 ? '+' : ''}
                            {total.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-slate-600">
                      <td className="px-2 py-1.5 text-xs font-bold text-white">Avg</td>
                      {monthlyReturns.map((m, i) => (
                        <td
                          key={i}
                          className={cn(
                            'px-2 py-1.5 text-center text-[10px] font-bold',
                            m.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400',
                          )}
                        >
                          {m.avgReturn >= 0 ? '+' : ''}
                          {m.avgReturn}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center text-xs font-bold text-teal-400">
                        {monthlyReturns.reduce((s, m) => s + m.avgReturn, 0).toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
