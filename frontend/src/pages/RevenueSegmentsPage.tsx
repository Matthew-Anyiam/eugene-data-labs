import { useState, useMemo } from 'react';
import { PieChart, Search, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSegments } from '../hooks/useSegments';

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

const SEGMENT_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500'];
const SEGMENT_TEXT = ['text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-purple-400', 'text-pink-400', 'text-cyan-400'];

function fmtRevenue(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

interface ProcessedSegment {
  name: string;
  revenue: number;
  pct: number;
  growth: number | null;
}

interface ProcessedGeo {
  region: string;
  revenue: number;
  pct: number;
  growth: number | null;
}

export function RevenueSegmentsPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [view, setView] = useState<'segments' | 'geography'>('segments');

  const selectTicker = (t: string) => {
    setSelectedTicker(t.toUpperCase());
    setTickerInput('');
  };

  const { data: rawData, isLoading, isError, error } = useSegments(selectedTicker, 5);

  const periods = rawData?.data?.periods ?? [];

  const latestPeriod = periods[0] ?? null;
  const prevPeriod = periods[1] ?? null;

  const { segments, geo, totalRevenue } = useMemo(() => {
    if (!latestPeriod) return { segments: [] as ProcessedSegment[], geo: [] as ProcessedGeo[], totalRevenue: 0 };

    // --- Business Segments ---
    const bizSegs = latestPeriod.business_segments ?? [];
    const bizTotal = bizSegs.reduce((sum, s) => sum + (s.revenue ?? 0), 0);

    const prevBizMap = new Map<string, number>();
    if (prevPeriod) {
      for (const s of prevPeriod.business_segments ?? []) {
        prevBizMap.set(s.segment_name, s.revenue ?? 0);
      }
    }

    const processedSegments: ProcessedSegment[] = bizSegs
      .map(s => {
        const rev = s.revenue ?? 0;
        const pct = bizTotal > 0 ? (rev / bizTotal) * 100 : 0;
        const prevRev = prevBizMap.get(s.segment_name);
        const growth = prevRev != null && prevRev !== 0 ? ((rev - prevRev) / prevRev) * 100 : null;
        return { name: s.segment_name, revenue: rev, pct, growth };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // --- Geographic Segments ---
    const geoSegs = latestPeriod.geographic_segments ?? [];
    const geoTotal = geoSegs.reduce((sum, g) => sum + (g.revenue ?? 0), 0);

    const prevGeoMap = new Map<string, number>();
    if (prevPeriod) {
      for (const g of prevPeriod.geographic_segments ?? []) {
        prevGeoMap.set(g.region, g.revenue ?? 0);
      }
    }

    const processedGeo: ProcessedGeo[] = geoSegs
      .map(g => {
        const rev = g.revenue ?? 0;
        const pct = geoTotal > 0 ? (rev / geoTotal) * 100 : 0;
        const prevRev = prevGeoMap.get(g.region);
        const growth = prevRev != null && prevRev !== 0 ? ((rev - prevRev) / prevRev) * 100 : null;
        return { region: g.region, revenue: rev, pct, growth };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return { segments: processedSegments, geo: processedGeo, totalRevenue: bizTotal };
  }, [latestPeriod, prevPeriod]);

  // Build per-segment history across all periods (for mini bar charts)
  const segmentHistory = useMemo(() => {
    const map = new Map<string, { period: string; revenue: number }[]>();
    for (const period of [...periods].reverse()) {
      for (const s of period.business_segments ?? []) {
        if (!map.has(s.segment_name)) map.set(s.segment_name, []);
        map.get(s.segment_name)!.push({ period: period.period_end, revenue: s.revenue ?? 0 });
      }
    }
    return map;
  }, [periods]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PieChart className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Revenue Segments</h1>
          <p className="text-sm text-slate-400">Revenue breakdown by business segment and geography</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..."
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        {TICKERS.map(t => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium',
              selectedTicker === t ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-12">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span className="text-sm text-slate-400">Loading segment data for {selectedTicker}…</span>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="rounded-xl border border-red-800/40 bg-red-900/20 p-6 text-center">
          <p className="text-sm font-medium text-red-400">Failed to load segment data</p>
          <p className="mt-1 text-xs text-slate-500">{String((error as Error)?.message ?? 'Unknown error')}</p>
        </div>
      )}

      {/* No data */}
      {!isLoading && !isError && !latestPeriod && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center">
          <p className="text-sm text-slate-400">No segment data available for {selectedTicker}</p>
        </div>
      )}

      {/* Main content — only shown when data is ready */}
      {!isLoading && !isError && latestPeriod && (
        <>
          {/* Total revenue + period label */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Total Revenue</div>
                <div className="mt-1 text-3xl font-bold text-white">{fmtRevenue(totalRevenue)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Period ending</div>
                <div className="mt-0.5 text-sm font-medium text-slate-300">{latestPeriod.period_end}</div>
                {prevPeriod && (
                  <div className="text-xs text-slate-600">vs {prevPeriod.period_end}</div>
                )}
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
            {(['segments', 'geography'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-xs font-medium capitalize',
                  view === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                {v === 'segments' ? 'Business Segments' : 'Geography'}
              </button>
            ))}
          </div>

          {/* ── SEGMENTS VIEW ── */}
          {view === 'segments' && (
            <>
              {segments.length === 0 ? (
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-center text-sm text-slate-400">
                  No business segment data for this period.
                </div>
              ) : (
                <>
                  {/* Stacked bar */}
                  <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-white">Revenue Mix</h3>
                    <div className="flex h-8 overflow-hidden rounded-full">
                      {segments.map((seg, i) => (
                        <div
                          key={seg.name}
                          className={cn('transition-all opacity-70', SEGMENT_COLORS[i % SEGMENT_COLORS.length])}
                          style={{ width: `${seg.pct}%` }}
                          title={`${seg.name}: ${fmtPct(seg.pct)}`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {segments.map((seg, i) => (
                        <span key={seg.name} className="flex items-center gap-1.5 text-xs">
                          <span className={cn('h-2.5 w-2.5 rounded-sm', SEGMENT_COLORS[i % SEGMENT_COLORS.length])} />
                          <span className="text-slate-300">{seg.name}</span>
                          <span className="text-slate-500">{fmtPct(seg.pct)}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Segment cards */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {segments.map((seg, i) => {
                      const history = segmentHistory.get(seg.name) ?? [];
                      const maxRev = history.length > 0 ? Math.max(...history.map(h => h.revenue)) : seg.revenue;

                      return (
                        <div key={seg.name} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                          <div className="flex items-center justify-between">
                            <span className={cn('text-sm font-semibold', SEGMENT_TEXT[i % SEGMENT_TEXT.length])}>
                              {seg.name}
                            </span>
                            <span className="text-xs text-slate-500">{fmtPct(seg.pct)}</span>
                          </div>
                          <div className="mt-2 text-xl font-bold text-white">{fmtRevenue(seg.revenue)}</div>
                          <div className="mt-1 flex items-center justify-between">
                            {seg.growth !== null ? (
                              <span className={cn('flex items-center gap-0.5 text-xs font-medium', seg.growth >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                {seg.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {seg.growth >= 0 ? '+' : ''}{seg.growth.toFixed(1)}% YoY
                              </span>
                            ) : (
                              <span className="text-xs text-slate-600">— YoY</span>
                            )}
                          </div>

                          {/* Mini history bars */}
                          {history.length > 1 && (
                            <div className="mt-3 flex items-end gap-1" style={{ height: '40px' }}>
                              {history.map(h => {
                                const barH = maxRev > 0 ? (h.revenue / maxRev) * 35 : 0;
                                const label = h.period.slice(0, 4);
                                return (
                                  <div key={h.period} className="flex flex-1 flex-col items-center gap-0.5">
                                    <div
                                      className={cn('w-full rounded-t opacity-40', SEGMENT_COLORS[i % SEGMENT_COLORS.length])}
                                      style={{ height: `${Math.max(2, barH)}px` }}
                                    />
                                    <span className="text-[7px] text-slate-600">{label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Segment table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-700 bg-slate-800/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Segment</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Revenue</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">% of Total</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">YoY Growth</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {segments.map((seg, i) => (
                          <tr key={seg.name} className="bg-slate-800 hover:bg-slate-750">
                            <td className={cn('px-3 py-2 text-xs font-medium', SEGMENT_TEXT[i % SEGMENT_TEXT.length])}>
                              {seg.name}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-medium text-white">
                              {fmtRevenue(seg.revenue)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-300">
                              {fmtPct(seg.pct)}
                            </td>
                            <td className={cn(
                              'px-3 py-2 text-right text-xs font-medium',
                              seg.growth === null ? 'text-slate-600' : seg.growth >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                              {seg.growth === null ? '—' : `${seg.growth >= 0 ? '+' : ''}${seg.growth.toFixed(1)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── GEOGRAPHY VIEW ── */}
          {view === 'geography' && (
            <>
              {geo.length === 0 ? (
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-center text-sm text-slate-400">
                  No geographic segment data for this period.
                </div>
              ) : (
                <>
                  {/* Geo bar chart */}
                  <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-white">Revenue by Region</h3>
                    <div className="space-y-3">
                      {geo.map((g, i) => (
                        <div key={g.region}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className={cn('font-medium', SEGMENT_TEXT[i % SEGMENT_TEXT.length])}>
                              {g.region}
                            </span>
                            <span className="text-slate-400">
                              {fmtRevenue(g.revenue)} ({fmtPct(g.pct)})
                            </span>
                          </div>
                          <div className="h-4 rounded-full bg-slate-700">
                            <div
                              className={cn('h-4 rounded-full opacity-60', SEGMENT_COLORS[i % SEGMENT_COLORS.length])}
                              style={{ width: `${g.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Geo table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-700 bg-slate-800/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Region</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Revenue</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">% of Total</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">YoY Growth</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {geo.map((g, i) => (
                          <tr key={g.region} className="bg-slate-800 hover:bg-slate-750">
                            <td className={cn('px-3 py-2 text-xs font-medium', SEGMENT_TEXT[i % SEGMENT_TEXT.length])}>
                              {g.region}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-300">
                              {fmtRevenue(g.revenue)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-300">
                              {fmtPct(g.pct)}
                            </td>
                            <td className={cn(
                              'px-3 py-2 text-right text-xs font-medium',
                              g.growth === null ? 'text-slate-600' : g.growth >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                              {g.growth === null ? '—' : `${g.growth >= 0 ? '+' : ''}${g.growth.toFixed(1)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
