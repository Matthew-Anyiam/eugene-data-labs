import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, Plus, X, Play, Save, Trash2, Download } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const METRICS = [
  { id: 'market_cap', label: 'Market Cap ($B)', type: 'range', min: 0, max: 3000 },
  { id: 'pe_ratio', label: 'P/E Ratio', type: 'range', min: 0, max: 200 },
  { id: 'dividend_yield', label: 'Dividend Yield (%)', type: 'range', min: 0, max: 15 },
  { id: 'revenue_growth', label: 'Revenue Growth (%)', type: 'range', min: -50, max: 200 },
  { id: 'profit_margin', label: 'Profit Margin (%)', type: 'range', min: -50, max: 80 },
  { id: 'debt_equity', label: 'Debt/Equity', type: 'range', min: 0, max: 10 },
  { id: 'rsi', label: 'RSI (14)', type: 'range', min: 0, max: 100 },
  { id: 'beta', label: 'Beta', type: 'range', min: -1, max: 4 },
  { id: 'volume_avg', label: 'Avg Volume (M)', type: 'range', min: 0, max: 100 },
  { id: 'price', label: 'Price ($)', type: 'range', min: 0, max: 5000 },
  { id: '52w_high_pct', label: '% from 52W High', type: 'range', min: -80, max: 0 },
  { id: 'eps_growth', label: 'EPS Growth (%)', type: 'range', min: -100, max: 500 },
];

const SECTORS = ['Technology', 'Healthcare', 'Financials', 'Consumer Disc.', 'Communication', 'Industrials', 'Consumer Staples', 'Energy', 'Utilities', 'Real Estate', 'Materials'];

const STOCK_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V',
  'JNJ', 'WMT', 'UNH', 'MA', 'PG', 'HD', 'XOM', 'BAC', 'KO', 'PFE',
  'LLY', 'NFLX', 'AMD', 'CRM', 'DIS', 'GS', 'MS', 'INTC', 'IBM', 'CSCO',
  'ORCL', 'ADBE', 'PYPL', 'SQ', 'SHOP', 'ROKU', 'ZM', 'SNAP', 'UBER', 'ABNB',
  'COIN', 'PLTR', 'RIVN', 'LCID', 'SOFI', 'NIO', 'F', 'GM', 'T', 'VZ',
];

const NAMES: Record<string, string> = {
  AAPL: 'Apple Inc', MSFT: 'Microsoft Corp', GOOGL: 'Alphabet Inc', AMZN: 'Amazon.com', NVDA: 'NVIDIA Corp',
  META: 'Meta Platforms', TSLA: 'Tesla Inc', 'BRK.B': 'Berkshire Hathaway', JPM: 'JPMorgan Chase', V: 'Visa Inc',
  JNJ: 'Johnson & Johnson', WMT: 'Walmart Inc', UNH: 'UnitedHealth', MA: 'Mastercard', PG: 'Procter & Gamble',
  HD: 'Home Depot', XOM: 'Exxon Mobil', BAC: 'Bank of America', KO: 'Coca-Cola', PFE: 'Pfizer Inc',
  LLY: 'Eli Lilly', NFLX: 'Netflix Inc', AMD: 'AMD Inc', CRM: 'Salesforce', DIS: 'Walt Disney',
  GS: 'Goldman Sachs', MS: 'Morgan Stanley', INTC: 'Intel Corp', IBM: 'IBM Corp', CSCO: 'Cisco Systems',
  ORCL: 'Oracle Corp', ADBE: 'Adobe Inc', PYPL: 'PayPal', SQ: 'Block Inc', SHOP: 'Shopify',
  ROKU: 'Roku Inc', ZM: 'Zoom Video', SNAP: 'Snap Inc', UBER: 'Uber Tech', ABNB: 'Airbnb Inc',
  COIN: 'Coinbase', PLTR: 'Palantir', RIVN: 'Rivian Auto', LCID: 'Lucid Group', SOFI: 'SoFi Tech',
  NIO: 'NIO Inc', F: 'Ford Motor', GM: 'General Motors', T: 'AT&T Inc', VZ: 'Verizon',
};

interface FilterRule {
  id: string;
  metric: string;
  min: string;
  max: string;
}

interface SavedScreener {
  name: string;
  filters: FilterRule[];
  sector: string;
}

const STORAGE_KEY = 'eugene_screener_builder';

function loadScreeners(): SavedScreener[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export function ScreenerBuilderPage() {
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [sectorFilter, setSectorFilter] = useState('All');
  const [savedScreeners, setSavedScreeners] = useState<SavedScreener[]>(loadScreeners);
  const [screenerName, setScreenerName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [sortBy, setSortBy] = useState<string>('market_cap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const addFilter = () => {
    const id = Date.now().toString(36);
    setFilters([...filters, { id, metric: 'market_cap', min: '', max: '' }]);
  };

  const removeFilter = (id: string) => setFilters(filters.filter(f => f.id !== id));

  const updateFilter = (id: string, field: keyof FilterRule, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const saveScreener = () => {
    if (!screenerName.trim()) return;
    const updated = [...savedScreeners, { name: screenerName, filters, sector: sectorFilter }];
    setSavedScreeners(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setScreenerName('');
    setShowSave(false);
  };

  const loadScreener = (s: SavedScreener) => {
    setFilters(s.filters.map(f => ({ ...f, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) })));
    setSectorFilter(s.sector);
  };

  const deleteScreener = (idx: number) => {
    const updated = savedScreeners.filter((_, i) => i !== idx);
    setSavedScreeners(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // Generate mock data for each stock
  const stockData = useMemo(() => STOCK_UNIVERSE.map(ticker => {
    const s = seed(ticker);
    const sectorIdx = Math.floor(pseudo(s, 0) * SECTORS.length);
    return {
      ticker,
      name: NAMES[ticker] || ticker,
      sector: SECTORS[sectorIdx],
      market_cap: 5 + pseudo(s, 1) * 2995,
      pe_ratio: 5 + pseudo(s, 2) * 95,
      dividend_yield: pseudo(s, 3) * 6,
      revenue_growth: -20 + pseudo(s, 4) * 120,
      profit_margin: -10 + pseudo(s, 5) * 60,
      debt_equity: pseudo(s, 6) * 5,
      rsi: 20 + pseudo(s, 7) * 60,
      beta: 0.3 + pseudo(s, 8) * 2.2,
      volume_avg: 0.5 + pseudo(s, 9) * 50,
      price: 5 + pseudo(s, 10) * 500,
      '52w_high_pct': -(pseudo(s, 11) * 40),
      eps_growth: -30 + pseudo(s, 12) * 200,
    };
  }), []);

  const results = useMemo(() => {
    let list = [...stockData];
    if (sectorFilter !== 'All') list = list.filter(s => s.sector === sectorFilter);
    for (const f of filters) {
      const min = f.min !== '' ? parseFloat(f.min) : -Infinity;
      const max = f.max !== '' ? parseFloat(f.max) : Infinity;
      list = list.filter(s => {
        const val = (s as Record<string, number | string>)[f.metric];
        if (typeof val !== 'number') return true;
        return val >= min && val <= max;
      });
    }
    list.sort((a, b) => {
      const av = (a as Record<string, number | string>)[sortBy];
      const bv = (b as Record<string, number | string>)[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'desc' ? bv - av : av - bv;
      return 0;
    });
    return list;
  }, [stockData, filters, sectorFilter, sortBy, sortDir]);

  const exportCSV = () => {
    const cols = ['ticker', 'name', 'sector', ...METRICS.map(m => m.id)];
    const header = cols.join(',') + '\n';
    const rows = results.map(r => cols.map(c => (r as Record<string, number | string>)[c]).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'screener_results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-6 w-6 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Custom Screener</h1>
            <p className="text-sm text-slate-400">Build multi-criteria stock screeners with custom filters</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={() => setShowSave(!showSave)} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>

      {/* Saved screeners */}
      {savedScreeners.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Saved:</span>
          {savedScreeners.map((s, i) => (
            <div key={i} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1">
              <button onClick={() => loadScreener(s)} className="text-xs text-slate-300 hover:text-white">{s.name}</button>
              <button onClick={() => deleteScreener(i)} className="text-slate-500 hover:text-red-400"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      {showSave && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 p-3">
          <input value={screenerName} onChange={e => setScreenerName(e.target.value)} placeholder="Screener name..." className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none" />
          <button onClick={saveScreener} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-500">Save</button>
        </div>
      )}

      {/* Filter builder */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Filters ({filters.length})</h3>
          <button onClick={addFilter} className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500">
            <Plus className="h-3 w-3" /> Add Filter
          </button>
        </div>

        {/* Sector filter */}
        <div className="mb-3 flex flex-wrap gap-1">
          <span className="mr-1 text-xs text-slate-500">Sector:</span>
          {['All', ...SECTORS].map(s => (
            <button key={s} onClick={() => setSectorFilter(s)}
              className={cn('rounded-md px-2 py-0.5 text-[10px]', sectorFilter === s ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white')}>
              {s}
            </button>
          ))}
        </div>

        {/* Filter rules */}
        <div className="space-y-2">
          {filters.map(f => {
            const metric = METRICS.find(m => m.id === f.metric);
            return (
              <div key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-2">
                <select value={f.metric} onChange={e => updateFilter(f.id, 'metric', e.target.value)}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white">
                  {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <span className="text-xs text-slate-500">between</span>
                <input value={f.min} onChange={e => updateFilter(f.id, 'min', e.target.value)} placeholder={metric ? metric.min.toString() : 'min'} type="number"
                  className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white placeholder:text-slate-600" />
                <span className="text-xs text-slate-500">and</span>
                <input value={f.max} onChange={e => updateFilter(f.id, 'max', e.target.value)} placeholder={metric ? metric.max.toString() : 'max'} type="number"
                  className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white placeholder:text-slate-600" />
                <button onClick={() => removeFilter(f.id)} className="ml-auto text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
          {filters.length === 0 && (
            <div className="py-4 text-center text-xs text-slate-500">No filters added. Click &quot;Add Filter&quot; to start building your screener.</div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="rounded-xl border border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">{results.length} results</span>
            <span className="text-xs text-slate-500">of {STOCK_UNIVERSE.length} stocks</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
                {METRICS.slice(0, 8).map(m => (
                  <th key={m.id} className="px-3 py-2 text-right">
                    <button onClick={() => { if (sortBy === m.id) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(m.id); setSortDir('desc'); } }}
                      className={cn('text-xs font-medium', sortBy === m.id ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300')}>
                      {m.label.split(' ')[0]} {sortBy === m.id && (sortDir === 'desc' ? '↓' : '↑')}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {results.slice(0, 30).map(s => (
                <tr key={s.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2">
                    <Link to={`/company/${s.ticker}`} className="font-mono text-xs font-bold text-emerald-400 hover:underline">{s.ticker}</Link>
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 text-xs text-slate-300" title={s.name}>{s.name}</td>
                  <td className="px-3 py-2"><span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">{s.sector}</span></td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${s.market_cap.toFixed(0)}B</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{s.pe_ratio.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{s.dividend_yield.toFixed(2)}%</td>
                  <td className={cn('px-3 py-2 text-right text-xs', s.revenue_growth >= 0 ? 'text-emerald-400' : 'text-red-400')}>{s.revenue_growth.toFixed(1)}%</td>
                  <td className={cn('px-3 py-2 text-right text-xs', s.profit_margin >= 0 ? 'text-emerald-400' : 'text-red-400')}>{s.profit_margin.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{s.debt_equity.toFixed(2)}</td>
                  <td className={cn('px-3 py-2 text-right text-xs', s.rsi > 70 ? 'text-red-400' : s.rsi < 30 ? 'text-emerald-400' : 'text-slate-300')}>{s.rsi.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{s.beta.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.length > 30 && (
          <div className="border-t border-slate-700 bg-slate-800/50 px-4 py-2 text-xs text-slate-500">
            Showing 30 of {results.length} results
          </div>
        )}
      </div>
    </div>
  );
}
