import { useState, useMemo } from 'react';
import {
  CalendarClock,
  ChevronDown,
  Filter,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useEconomics } from '../hooks/useEconomics';
import type { FredSeries } from '../lib/types';

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
  inflation: 'Inflation',
  employment: 'Employment',
  gdp: 'GDP & Growth',
  housing: 'Housing',
  consumer: 'Consumer',
  manufacturing: 'Manufacturing',
  rates: 'Interest Rates',
  money: 'Money Supply',
  treasury: 'Treasury',
};

const CATEGORY_ORDER = ['rates', 'inflation', 'employment', 'gdp', 'consumer', 'manufacturing', 'housing', 'money', 'treasury'];

// Impact classification based on indicator type
function getImpact(series: FredSeries): 'high' | 'medium' | 'low' {
  const id = series.id.toUpperCase();
  const title = series.title.toLowerCase();
  const highImpact = ['FEDFUNDS', 'UNRATE', 'CPIAUCSL', 'CPILFESL', 'GDP', 'PAYEMS', 'PCE', 'PCEPI'];
  if (highImpact.includes(id)) return 'high';
  if (title.includes('gdp') || title.includes('unemployment') || title.includes('inflation') ||
      title.includes('federal funds') || title.includes('payroll')) return 'high';
  if (title.includes('retail') || title.includes('housing') || title.includes('manufacturing') ||
      title.includes('consumer') || title.includes('industrial')) return 'medium';
  return 'low';
}

function formatValue(s: FredSeries): string {
  const v = s.value;
  if (v === null || v === undefined || v === '') return '—';
  const num = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(num)) return String(v);
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K`;
  if (Math.abs(num) < 0.01) return num.toFixed(4);
  if (Math.abs(num) < 10) return num.toFixed(2);
  return num.toFixed(1);
}

function valueUnit(s: FredSeries): string {
  const title = s.title.toLowerCase();
  const id = s.id.toLowerCase();
  if (id.includes('rate') || title.includes('rate') || title.includes('cpi') || title.includes('pce') ||
      title.includes('inflation') || title.includes('gdp') || title.includes('unemployment') ||
      title.includes('participation')) return '%';
  return '';
}

const IMPACT_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

type CategoryFilter = string | 'ALL';
type ImpactFilter = 'high' | 'medium' | 'low' | 'ALL';

interface EnrichedSeries extends FredSeries {
  category: string;
  impact: 'high' | 'medium' | 'low';
}

function ImpactDot({ impact }: { impact: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-2 rounded-full', IMPACT_DOT[impact])} />
      <span className="text-xs capitalize text-slate-400">{impact}</span>
    </span>
  );
}

function SeriesRow({
  series,
  isExpanded,
  onToggle,
}: {
  series: EnrichedSeries;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const displayVal = formatValue(series);
  const unit = valueUnit(series);
  const num = typeof series.value === 'number' ? series.value : parseFloat(String(series.value));

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-slate-700/50 transition-colors hover:bg-slate-700/30"
      >
        <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
          {series.date || '—'}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-100 text-sm">{series.title}</td>
        <td className="px-4 py-2.5">
          <ImpactDot impact={series.impact} />
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-white">
          {displayVal !== '—' ? `${displayVal}${unit}` : '—'}
        </td>
        <td className="px-4 py-2.5 text-right text-xs text-slate-500">
          {!isNaN(num) && isFinite(num) ? (
            <span className={num >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {num >= 0 ? '▲' : '▼'}
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-2.5">
          <ChevronDown
            className={cn('h-4 w-4 text-slate-500 transition-transform', isExpanded && 'rotate-180')}
          />
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-800/50">
          <td colSpan={6} className="px-6 py-3">
            <div className="text-xs text-slate-400">
              <span className="font-medium text-slate-300">Series ID:</span> {series.id}
              {series.units && <> &nbsp;·&nbsp; <span className="font-medium text-slate-300">Units:</span> {series.units}</>}
              {series.frequency && CATEGORY_LABELS[series.frequency] && (
                <> &nbsp;·&nbsp; <span className="font-medium text-slate-300">Category:</span> {CATEGORY_LABELS[series.frequency]}</>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function EconCalendarPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useEconomics('all');

  // Enrich series with category and impact
  const allSeries: EnrichedSeries[] = useMemo(() => {
    if (!data?.series) return [];
    return data.series.map(s => ({
      ...s,
      category: s.frequency || 'other',
      impact: getImpact(s),
    }));
  }, [data]);

  // Build available category tabs from actual data
  const availableCategories = useMemo(() => {
    const cats = new Set(allSeries.map(s => s.category));
    return ['ALL', ...CATEGORY_ORDER.filter(c => cats.has(c)), ...Array.from(cats).filter(c => !CATEGORY_ORDER.includes(c))];
  }, [allSeries]);

  const filtered = useMemo(() => {
    return allSeries.filter(s => {
      if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false;
      if (impactFilter !== 'ALL' && s.impact !== impactFilter) return false;
      return true;
    });
  }, [allSeries, categoryFilter, impactFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedSeries[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    const ordered: [string, EnrichedSeries[]][] = [
      ...CATEGORY_ORDER.filter(c => map.has(c)).map(c => [c, map.get(c)!] as [string, EnrichedSeries[]]),
      ...Array.from(map.entries()).filter(([c]) => !CATEGORY_ORDER.includes(c)),
    ];
    return ordered;
  }, [filtered]);

  // Summary
  const highCount = allSeries.filter(s => s.impact === 'high').length;
  const medCount = allSeries.filter(s => s.impact === 'medium').length;
  const lowCount = allSeries.filter(s => s.impact === 'low').length;
  const highImpactTop = allSeries.filter(s => s.impact === 'high').slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CalendarClock className="h-7 w-7 text-blue-400" />
            <h1 className="text-2xl font-bold">Economic Indicators</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">
            Live FRED economic data releases organized by category and impact level.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading economic indicators…</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className="rounded-xl border border-red-700/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            Failed to load economic data. Please try again.
          </div>
        )}

        {!isLoading && !isError && data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Key Indicators
                </h3>
                <ul className="space-y-1.5">
                  {highImpactTop.map(s => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <span className="text-slate-200 truncate">{s.title}</span>
                      <span className="ml-auto text-xs text-slate-500 shrink-0">
                        {formatValue(s)}{valueUnit(s)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Coverage
                </h3>
                <div className="flex items-end gap-6">
                  <div>
                    <div className="text-3xl font-bold text-red-400">{highCount}</div>
                    <div className="text-xs text-slate-500">High Impact</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-amber-400">{medCount}</div>
                    <div className="text-xs text-slate-500">Medium</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-slate-300">{lowCount}</div>
                    <div className="text-xs text-slate-500">Low</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Categories
                </h3>
                <div className="text-xl font-bold text-white mb-1">{grouped.length}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {grouped.slice(0, 6).map(([cat]) => (
                    <span key={cat} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 capitalize">
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-800 p-1 border border-slate-700">
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      categoryFilter === cat
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700',
                    )}
                  >
                    {cat === 'ALL' ? 'All' : CATEGORY_LABELS[cat] || cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1 border border-slate-700">
                <Filter className="h-3.5 w-3.5 text-slate-500 ml-2" />
                {(['ALL', 'high', 'medium', 'low'] as ImpactFilter[]).map(imp => (
                  <button
                    key={imp}
                    onClick={() => setImpactFilter(imp)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                      impactFilter === imp
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700',
                    )}
                  >
                    {imp === 'ALL' ? 'All Impact' : `${imp.charAt(0).toUpperCase() + imp.slice(1)}`}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                No indicators match the current filters.
              </div>
            )}

            {/* Grouped tables */}
            {grouped.map(([cat, series]) => (
              <div key={cat} className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-sm font-semibold text-slate-300">
                    {CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </h2>
                  <div className="flex-1 border-t border-slate-700/60" />
                  <span className="text-xs text-slate-500">{series.length} indicators</span>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-2.5 text-left font-medium w-28">Date</th>
                        <th className="px-4 py-2.5 text-left font-medium">Indicator</th>
                        <th className="px-4 py-2.5 text-left font-medium w-32">Impact</th>
                        <th className="px-4 py-2.5 text-right font-medium">Value</th>
                        <th className="px-4 py-2.5 text-right font-medium w-16">Dir.</th>
                        <th className="px-4 py-2.5 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {series.map(s => (
                        <SeriesRow
                          key={s.id}
                          series={s}
                          isExpanded={expandedId === s.id}
                          onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
