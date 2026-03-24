import type { ScreenerFilters as Filters } from '../../hooks/useScreener';

interface ScreenerFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onSubmit: () => void;
}

const SECTORS = [
  '', 'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Communication Services', 'Industrials', 'Consumer Defensive', 'Energy',
  'Basic Materials', 'Real Estate', 'Utilities',
];

export function ScreenerFilters({ filters, onChange, onSubmit }: ScreenerFiltersProps) {
  function set(key: keyof Filters, value: string) {
    const num = value === '' ? undefined : Number(value);
    onChange({ ...filters, [key]: key === 'sector' ? (value || undefined) : num });
  }

  const inputClass = "w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-slate-400">Sector</label>
        <select
          value={filters.sector || ''}
          onChange={(e) => onChange({ ...filters, sector: e.target.value || undefined })}
          className={inputClass}
        >
          <option value="">All</option>
          {SECTORS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Min Mkt Cap</label>
          <input type="number" placeholder="1B" value={filters.marketCapMin || ''} onChange={(e) => set('marketCapMin', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Max Mkt Cap</label>
          <input type="number" placeholder="100B" value={filters.marketCapMax || ''} onChange={(e) => set('marketCapMax', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Min Price</label>
          <input type="number" placeholder="10" value={filters.priceMin || ''} onChange={(e) => set('priceMin', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Max Price</label>
          <input type="number" placeholder="500" value={filters.priceMax || ''} onChange={(e) => set('priceMax', e.target.value)} className={inputClass} />
        </div>
      </div>

      <button
        onClick={onSubmit}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        Screen Stocks
      </button>
    </div>
  );
}
