import { useState, useMemo } from 'react';
import {
  PieChart,
  ArrowUpDown,
  Zap,
  Heart,
  Landmark,
  ShoppingCart,
  Radio,
  Factory,
  ShoppingBag,
  Fuel,
  Lightbulb,
  Building,
  Mountain,
  Loader2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatPrice } from '../lib/utils';
import { useScreener } from '../hooks/useScreener';
import type { ScreenerResult } from '../lib/types';

const SECTOR_DEFS: { name: string; icon: React.ElementType }[] = [
  { name: 'Technology', icon: Zap },
  { name: 'Healthcare', icon: Heart },
  { name: 'Financial Services', icon: Landmark },
  { name: 'Consumer Cyclical', icon: ShoppingCart },
  { name: 'Communication Services', icon: Radio },
  { name: 'Industrials', icon: Factory },
  { name: 'Consumer Defensive', icon: ShoppingBag },
  { name: 'Energy', icon: Fuel },
  { name: 'Utilities', icon: Lightbulb },
  { name: 'Real Estate', icon: Building },
  { name: 'Basic Materials', icon: Mountain },
];

function fmtMarketCap(v: number): string {
  if (!v) return '—';
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + v.toLocaleString();
}

function fmtVolume(v: number): string {
  if (!v) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}

function sectorIconColor(sector: string): string {
  const map: Record<string, string> = {
    'Technology': 'text-blue-400',
    'Healthcare': 'text-emerald-400',
    'Financial Services': 'text-amber-400',
    'Consumer Cyclical': 'text-purple-400',
    'Communication Services': 'text-cyan-400',
    'Industrials': 'text-orange-400',
    'Consumer Defensive': 'text-pink-400',
    'Energy': 'text-yellow-400',
    'Utilities': 'text-teal-400',
    'Real Estate': 'text-indigo-400',
    'Basic Materials': 'text-lime-400',
  };
  return map[sector] ?? 'text-slate-400';
}

/* ── Single sector card ─────────────────────────────── */
function SectorCard({
  name,
  icon: Icon,
  onDrillIn,
}: {
  name: string;
  icon: React.ElementType;
  onDrillIn: () => void;
}) {
  const { data, isLoading, error } = useScreener({ sector: name, limit: 10 });
  const results = data?.results ?? [];

  const totalMcap = results.reduce((s, r) => s + (r.market_cap ?? 0), 0);
  const avgBeta = results.length
    ? results.reduce((s, r) => s + (r.beta ?? 0), 0) / results.length
    : 0;
  const topByMcap = [...results].sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0)).slice(0, 3);
  const iconColor = sectorIconColor(name);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-700/60 rounded-lg">
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{name}</h3>
            {isLoading ? (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {data?.count ?? results.length} stocks &middot; MCap {fmtMarketCap(totalMcap)}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onDrillIn}
          className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
        >
          View All
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          Failed to load
        </div>
      )}

      {/* Stats row */}
      {!isLoading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-700/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Avg Beta</div>
            <div className={cn('mt-1 text-sm font-bold', avgBeta > 1.2 ? 'text-amber-400' : 'text-slate-200')}>
              {avgBeta.toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-700/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Stocks</div>
            <div className="mt-1 text-sm font-bold text-slate-200">{data?.count ?? results.length}</div>
          </div>
        </div>
      )}

      {/* Top holdings */}
      {!isLoading && topByMcap.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Top Holdings</div>
          {topByMcap.map(r => (
            <div key={r.ticker} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link to={`/company/${r.ticker}`} className={cn('font-mono text-xs font-bold hover:underline', iconColor)}>
                  {r.ticker}
                </Link>
                <span className="text-xs text-slate-500 truncate max-w-[120px]">{r.name}</span>
              </div>
              <span className="font-mono text-xs text-slate-300">{fmtMarketCap(r.market_cap)}</span>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      )}
    </div>
  );
}

/* ── Drill-in view: sector stock list ───────────────── */
function SectorDrillIn({
  sectorName,
  icon: Icon,
  onBack,
}: {
  sectorName: string;
  icon: React.ElementType;
  onBack: () => void;
}) {
  const [sortKey, setSortKey] = useState<keyof ScreenerResult>('market_cap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error } = useScreener({ sector: sectorName, limit: 50 });
  const results = data?.results ?? [];

  const sorted = useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      const av = (a[sortKey] as number) ?? 0;
      const bv = (b[sortKey] as number) ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return copy;
  }, [results, sortKey, sortDir]);

  const iconColor = sectorIconColor(sectorName);

  const toggleSort = (key: keyof ScreenerResult) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortTh = ({ label, field }: { label: string; field: keyof ScreenerResult }) => (
    <th className="px-3 py-2 text-right">
      <button
        onClick={() => toggleSort(field)}
        className={cn('text-xs font-medium flex items-center justify-end gap-1', sortKey === field ? iconColor : 'text-slate-400 hover:text-white')}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Sectors
      </button>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-700/60 rounded-lg">
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{sectorName}</h2>
          {data && <p className="text-sm text-slate-400">{data.count} stocks</p>}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          <span className="ml-2 text-sm text-slate-400">Loading {sectorName} stocks…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load sector data: {(error as Error).message}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Industry</th>
                <SortTh label="Price" field="price" />
                <SortTh label="Market Cap" field="market_cap" />
                <SortTh label="Volume" field="volume" />
                <SortTh label="Beta" field="beta" />
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Exchange</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sorted.map((r: ScreenerResult) => (
                <tr key={r.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2">
                    <Link to={`/company/${r.ticker}`} className={cn('font-mono text-xs font-bold hover:underline', iconColor)}>
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300 max-w-[180px] truncate">{r.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-[140px] truncate">{r.industry ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono text-slate-200">
                    {r.price ? formatPrice(r.price) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{fmtMarketCap(r.market_cap)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">{fmtVolume(r.volume)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn('text-xs font-medium', (r.beta ?? 0) > 1.2 ? 'text-amber-400' : 'text-slate-300')}>
                      {r.beta?.toFixed(2) ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.exchange ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */
export function SectorsPage() {
  const [drillSector, setDrillSector] = useState<string | null>(null);

  const drillDef = drillSector ? SECTOR_DEFS.find(s => s.name === drillSector) : null;

  if (drillDef) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 space-y-6">
        <SectorDrillIn
          sectorName={drillDef.name}
          icon={drillDef.icon}
          onBack={() => setDrillSector(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PieChart className="h-7 w-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Sector Analysis</h1>
          <p className="text-sm text-slate-400">
            Live sector constituents, market cap, and top holdings
          </p>
        </div>
      </div>

      {/* Sector grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {SECTOR_DEFS.map(sec => (
          <SectorCard
            key={sec.name}
            name={sec.name}
            icon={sec.icon}
            onDrillIn={() => setDrillSector(sec.name)}
          />
        ))}
      </div>
    </div>
  );
}
