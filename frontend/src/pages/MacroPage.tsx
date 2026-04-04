import { Map, TrendingUp, TrendingDown, Globe, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEconomics } from '../hooks/useEconomics';
import type { FredSeries } from '../lib/types';

// Category display names and ordering
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
  all: 'All Indicators',
};

const CATEGORY_ORDER = ['gdp', 'inflation', 'employment', 'rates', 'consumer', 'manufacturing', 'housing', 'money', 'treasury'];

function formatValue(s: FredSeries): string {
  const v = s.value;
  if (v === null || v === undefined || v === '') return '—';
  const num = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(num)) return String(v);

  const title = s.title.toLowerCase();
  const id = s.id.toLowerCase();

  if (id.includes('m2') || id.includes('m1') || id.includes('base') || title.includes('money supply')) {
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(1)}T`;
    return `$${num.toFixed(0)}B`;
  }
  if (title.includes('housing starts') || title.includes('permits')) {
    return `${num.toFixed(0)}K`;
  }
  if (Math.abs(num) >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(num) < 0.01) return num.toFixed(4);
  if (Math.abs(num) < 1) return num.toFixed(3);
  if (Math.abs(num) < 10) return num.toFixed(2);
  return num.toFixed(1);
}

function valueUnit(s: FredSeries): string {
  const title = s.title.toLowerCase();
  const id = s.id.toLowerCase();
  if (id.includes('rate') || title.includes('rate') || title.includes('cpi') || title.includes('pce') ||
      title.includes('inflation') || title.includes('gdp') || title.includes('growth') ||
      title.includes('unemployment') || title.includes('participation')) {
    return '%';
  }
  return '';
}

function IndicatorCard({ series }: { series: FredSeries }) {
  const displayVal = formatValue(series);
  const unit = valueUnit(series);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate" title={series.title}>{series.title}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-bold text-white">{displayVal}{unit}</span>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        {series.date ? `As of ${series.date}` : 'Latest'}
      </div>
    </div>
  );
}

function CategorySection({ name, series }: { name: string; series: FredSeries[] }) {
  const label = CATEGORY_LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <BarChart3 className="h-4 w-4 text-slate-400" />
        {label}
        <span className="text-xs font-normal text-slate-500">({series.length} indicators)</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {series.map(s => (
          <IndicatorCard key={s.id} series={s} />
        ))}
      </div>
    </div>
  );
}

export function MacroPage() {
  const { data, isLoading, isError } = useEconomics('all');

  // Group series by category (category name stored in s.frequency by hook transform)
  const grouped: Record<string, FredSeries[]> = {};
  if (data?.series) {
    for (const s of data.series) {
      const cat = s.frequency || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }
  }

  const orderedCategories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]?.length > 0),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c) && grouped[c]?.length > 0),
  ];

  // Summary stats for top cards
  const allSeries = data?.series ?? [];
  const gdpSeries = allSeries.find(s => s.id === 'GDP' || s.title.toLowerCase().includes('gross domestic'));
  const cpiSeries = allSeries.find(s => s.id === 'CPIAUCSL' || s.title.toLowerCase().includes('consumer price index'));
  const unempSeries = allSeries.find(s => s.id === 'UNRATE' || s.title.toLowerCase().includes('unemployment rate'));
  const fedFundsSeries = allSeries.find(s => s.id === 'FEDFUNDS' || s.title.toLowerCase().includes('federal funds'));

  const summaryCards = [
    { label: 'Fed Funds Rate', series: fedFundsSeries, color: 'text-blue-400' },
    { label: 'CPI Inflation', series: cpiSeries, color: 'text-orange-400' },
    { label: 'Unemployment', series: unempSeries, color: 'text-red-400' },
    { label: 'GDP', series: gdpSeries, color: 'text-emerald-400' },
  ].filter(c => c.series);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Map className="h-6 w-6 text-violet-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Macro Dashboard</h1>
          <p className="text-sm text-slate-400">Live FRED economic indicators grouped by category</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading macroeconomic data…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          Failed to load macro data. Please try again.
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* Key summary cards */}
          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {summaryCards.map(({ label, series, color }) => (
                <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
                  <div className={cn('mt-1 text-2xl font-bold', color)}>
                    {formatValue(series!)}{valueUnit(series!)}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {series!.date ? `As of ${series!.date}` : 'Latest'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Global summary table */}
          {allSeries.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Globe className="h-4 w-4 text-slate-400" /> All Indicators
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Indicator</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Category</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {allSeries.slice(0, 60).map(s => {
                      const num = typeof s.value === 'number' ? s.value : parseFloat(String(s.value));
                      const isPositive = !isNaN(num) && num > 0;
                      const catName = CATEGORY_LABELS[s.frequency] || s.frequency;
                      return (
                        <tr key={s.id} className="bg-slate-800 hover:bg-slate-750">
                          <td className="px-3 py-2 text-xs font-medium text-white">{s.title}</td>
                          <td className="px-3 py-2 text-xs text-slate-400 capitalize">{catName}</td>
                          <td className="px-3 py-2 text-right text-xs font-medium">
                            <span className={cn('flex items-center justify-end gap-0.5', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                              {!isNaN(num) && (isPositive
                                ? <TrendingUp className="h-3 w-3" />
                                : <TrendingDown className="h-3 w-3" />)}
                              {formatValue(s)}{valueUnit(s)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-500">{s.date || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {allSeries.length > 60 && (
                <p className="mt-2 text-center text-xs text-slate-500">Showing 60 of {allSeries.length} indicators</p>
              )}
            </div>
          )}

          {/* Category sections */}
          {orderedCategories.map(cat => (
            <CategorySection key={cat} name={cat} series={grouped[cat]} />
          ))}

          {allSeries.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 py-12 text-center text-sm text-slate-500">
              No macro data available.
            </div>
          )}
        </>
      )}
    </div>
  );
}
