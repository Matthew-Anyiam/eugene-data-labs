import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, Plus, X, Save, Download, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useScreener } from '../hooks/useScreener';
import type { ScreenerFilters } from '../hooks/useScreener';
import type { ScreenerResult } from '../lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Communication Services',
  'Industrials',
  'Consumer Defensive',
  'Energy',
  'Utilities',
  'Real Estate',
  'Basic Materials',
];

const COUNTRIES = ['US', 'GB', 'DE', 'JP', 'CN', 'CA', 'AU', 'FR', 'IN', 'BR'];

const STORAGE_KEY = 'eugene_screener_presets_v2';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  sector: string;
  country: string;
  marketCapMin: string;
  marketCapMax: string;
  priceMin: string;
  priceMax: string;
  volumeMin: string;
  betaMin: string;
  betaMax: string;
}

interface SavedPreset {
  name: string;
  form: FormState;
}

const DEFAULT_FORM: FormState = {
  sector: '',
  country: '',
  marketCapMin: '',
  marketCapMax: '',
  priceMin: '',
  priceMax: '',
  volumeMin: '',
  betaMin: '',
  betaMax: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadPresets(): SavedPreset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function formToFilters(f: FormState): ScreenerFilters {
  return {
    sector: f.sector || undefined,
    country: f.country || undefined,
    marketCapMin: f.marketCapMin ? Number(f.marketCapMin) : undefined,
    marketCapMax: f.marketCapMax ? Number(f.marketCapMax) : undefined,
    priceMin: f.priceMin ? Number(f.priceMin) : undefined,
    priceMax: f.priceMax ? Number(f.priceMax) : undefined,
    volumeMin: f.volumeMin ? Number(f.volumeMin) : undefined,
    betaMin: f.betaMin ? Number(f.betaMin) : undefined,
    betaMax: f.betaMax ? Number(f.betaMax) : undefined,
    limit: 100,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScreenerBuilderPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [activeFilters, setActiveFilters] = useState<ScreenerFilters>({});
  const [hasRun, setHasRun] = useState(false);

  const [presets, setPresets] = useState<SavedPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const [sortKey, setSortKey] = useState<keyof ScreenerResult>('market_cap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isFetching, error } = useScreener(activeFilters, hasRun);

  const results: ScreenerResult[] = data?.results ?? [];

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'desc' ? bv - av : av - bv;
      }
      return sortDir === 'desc'
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
  }, [results, sortKey, sortDir]);

  function handleField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleRun() {
    setActiveFilters(formToFilters(form));
    setHasRun(true);
  }

  function handleReset() {
    setForm(DEFAULT_FORM);
    setActiveFilters({});
    setHasRun(false);
  }

  function handleSort(key: keyof ScreenerResult) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const updated = [...presets, { name, form }];
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPresetName('');
    setShowSaveInput(false);
  }

  function loadPreset(p: SavedPreset) {
    setForm(p.form);
    setHasRun(false);
  }

  function deletePreset(idx: number) {
    const updated = presets.filter((_, i) => i !== idx);
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function exportCSV() {
    if (!sorted.length) return;
    const cols: (keyof ScreenerResult)[] = [
      'ticker', 'name', 'sector', 'industry', 'country', 'price', 'market_cap', 'beta', 'volume', 'exchange',
    ];
    const header = cols.join(',');
    const rows = sorted.map((r) => cols.map((c) => r[c] ?? '').join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'screener_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500';

  const thBtn = (key: keyof ScreenerResult) => (
    <button
      onClick={() => handleSort(key)}
      className={cn(
        'text-xs font-medium',
        sortKey === key
          ? 'text-blue-500'
          : 'text-slate-400 hover:text-slate-300',
      )}
    >
      {key === 'market_cap' ? 'Mkt Cap' : key === 'ticker' ? 'Ticker' : key.charAt(0).toUpperCase() + key.slice(1)}
      {sortKey === key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-6 w-6 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Screener Builder</h1>
            <p className="text-sm text-slate-400">
              Filter stocks by sector, market cap, price, volume, beta, country
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={!sorted.length}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setShowSaveInput((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            <Save className="h-3.5 w-3.5" /> Save Preset
          </button>
        </div>
      </div>

      {/* Save preset input */}
      {showSaveInput && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 p-3">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && savePreset()}
            placeholder="Preset name..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={savePreset}
            disabled={!presetName.trim()}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-40"
          >
            Save
          </button>
          <button onClick={() => setShowSaveInput(false)} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Saved presets */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Presets:</span>
          {presets.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1"
            >
              <button
                onClick={() => loadPreset(p)}
                className="text-xs text-slate-300 hover:text-white"
              >
                {p.name}
              </button>
              <button onClick={() => deletePreset(i)} className="text-slate-500 hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter form */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Filters</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Sector */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Sector</label>
            <select
              value={form.sector}
              onChange={(e) => handleField('sector', e.target.value)}
              className={inputCls}
            >
              <option value="">Any sector</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Country</label>
            <select
              value={form.country}
              onChange={(e) => handleField('country', e.target.value)}
              className={inputCls}
            >
              <option value="">Any country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Market cap range */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Market Cap (USD)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={form.marketCapMin}
                onChange={(e) => handleField('marketCapMin', e.target.value)}
                placeholder="Min"
                className={cn(inputCls, 'flex-1')}
              />
              <input
                type="number"
                value={form.marketCapMax}
                onChange={(e) => handleField('marketCapMax', e.target.value)}
                placeholder="Max"
                className={cn(inputCls, 'flex-1')}
              />
            </div>
          </div>

          {/* Price range */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Price ($)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={form.priceMin}
                onChange={(e) => handleField('priceMin', e.target.value)}
                placeholder="Min"
                className={cn(inputCls, 'flex-1')}
              />
              <input
                type="number"
                value={form.priceMax}
                onChange={(e) => handleField('priceMax', e.target.value)}
                placeholder="Max"
                className={cn(inputCls, 'flex-1')}
              />
            </div>
          </div>

          {/* Volume min */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Min Volume (shares)
            </label>
            <input
              type="number"
              value={form.volumeMin}
              onChange={(e) => handleField('volumeMin', e.target.value)}
              placeholder="e.g. 500000"
              className={inputCls}
            />
          </div>

          {/* Beta range */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Beta</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={form.betaMin}
                onChange={(e) => handleField('betaMin', e.target.value)}
                placeholder="Min"
                className={cn(inputCls, 'flex-1')}
              />
              <input
                type="number"
                step="0.1"
                value={form.betaMax}
                onChange={(e) => handleField('betaMax', e.target.value)}
                placeholder="Max"
                className={cn(inputCls, 'flex-1')}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isFetching ? 'Searching...' : 'Run Screener'}
          </button>
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Screener request failed.'}
        </div>
      )}

      {/* Note from API */}
      {data?.note && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/10 px-4 py-3 text-xs text-amber-400">
          {data.note}
        </div>
      )}

      {/* Results */}
      {hasRun && (
        <div className="rounded-xl border border-slate-700">
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-4 py-2">
            <span className="text-sm font-medium text-white">
              {isFetching ? 'Loading...' : `${sorted.length} results`}
            </span>
            {data?.source && (
              <span className="text-xs text-slate-500">source: {data.source}</span>
            )}
          </div>

          {isFetching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            </div>
          )}

          {!isFetching && sorted.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500">
              No results matched your filters.
            </div>
          )}

          {!isFetching && sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-800/30">
                  <tr>
                    <th className="px-3 py-2 text-left">{thBtn('ticker')}</th>
                    <th className="px-3 py-2 text-left">
                      <span className="text-xs font-medium text-slate-400">Name</span>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <span className="text-xs font-medium text-slate-400">Sector</span>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <span className="text-xs font-medium text-slate-400">Country</span>
                    </th>
                    <th className="px-3 py-2 text-right">{thBtn('price')}</th>
                    <th className="px-3 py-2 text-right">{thBtn('market_cap')}</th>
                    <th className="px-3 py-2 text-right">{thBtn('beta')}</th>
                    <th className="px-3 py-2 text-right">{thBtn('volume')}</th>
                    <th className="px-3 py-2 text-left">
                      <span className="text-xs font-medium text-slate-400">Exchange</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sorted.map((s) => (
                    <tr key={s.ticker} className="bg-slate-800 hover:bg-slate-700/50">
                      <td className="px-3 py-2">
                        <Link
                          to={`/company/${s.ticker}`}
                          className="font-mono text-xs font-bold text-violet-400 hover:underline"
                        >
                          {s.ticker}
                        </Link>
                      </td>
                      <td
                        className="max-w-[140px] truncate px-3 py-2 text-xs text-slate-300"
                        title={s.name}
                      >
                        {s.name}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                          {s.sector}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{s.country}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-white">
                        ${s.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                        {s.market_cap >= 1e9
                          ? `$${(s.market_cap / 1e9).toFixed(1)}B`
                          : s.market_cap >= 1e6
                            ? `$${(s.market_cap / 1e6).toFixed(0)}M`
                            : `$${s.market_cap?.toLocaleString() ?? '—'}`}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                        {s.beta != null ? s.beta.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                        {s.volume >= 1e6
                          ? `${(s.volume / 1e6).toFixed(1)}M`
                          : s.volume >= 1e3
                            ? `${(s.volume / 1e3).toFixed(0)}K`
                            : s.volume?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{s.exchange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
