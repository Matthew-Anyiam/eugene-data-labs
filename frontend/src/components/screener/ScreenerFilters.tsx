import type { ScreenerFilters as Filters } from '../../hooks/useScreener';
import { cn } from '../../lib/utils';

interface ScreenerFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Consumer Defensive', 'Energy', 'Industrials', 'Basic Materials',
  'Real Estate', 'Utilities', 'Communication Services',
];

const MARKET_CAP_PRESETS = [
  { label: 'Mega', subtitle: '>200B', min: 200_000_000_000, max: undefined },
  { label: 'Large', subtitle: '10B-200B', min: 10_000_000_000, max: 200_000_000_000 },
  { label: 'Mid', subtitle: '2B-10B', min: 2_000_000_000, max: 10_000_000_000 },
  { label: 'Small', subtitle: '<2B', min: undefined, max: 2_000_000_000 },
] as const;

export function ScreenerFilters({ filters, onChange, onSubmit, onReset }: ScreenerFiltersProps) {
  function setNum(key: keyof Filters, value: string) {
    const num = value === '' ? undefined : Number(value);
    onChange({ ...filters, [key]: num });
  }

  function isCapPresetActive(preset: typeof MARKET_CAP_PRESETS[number]) {
    return filters.marketCapMin === preset.min && filters.marketCapMax === preset.max;
  }

  function toggleCapPreset(preset: typeof MARKET_CAP_PRESETS[number]) {
    if (isCapPresetActive(preset)) {
      onChange({ ...filters, marketCapMin: undefined, marketCapMax: undefined });
    } else {
      onChange({ ...filters, marketCapMin: preset.min, marketCapMax: preset.max });
    }
  }

  const inputClass =
    'w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:focus:border-slate-500';

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      {/* Sector */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Sector
        </label>
        <select
          value={filters.sector || ''}
          onChange={(e) => onChange({ ...filters, sector: e.target.value || undefined })}
          className={inputClass}
        >
          <option value="">All Sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Market Cap Presets */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Market Cap
        </label>
        <div className="grid grid-cols-2 gap-2">
          {MARKET_CAP_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => toggleCapPreset(preset)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-colors',
                isCapPresetActive(preset)
                  ? 'border-blue-500 bg-blue-50 font-medium text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
              )}
            >
              <span className="block font-medium">{preset.label}</span>
              <span className="block text-[10px] opacity-70">{preset.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Price Range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.priceMin ?? ''}
            onChange={(e) => setNum('priceMin', e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.priceMax ?? ''}
            onChange={(e) => setNum('priceMax', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Volume Min */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Min Volume
        </label>
        <input
          type="number"
          placeholder="e.g. 1000000"
          value={filters.volumeMin ?? ''}
          onChange={(e) => setNum('volumeMin', e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onSubmit}
          className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
