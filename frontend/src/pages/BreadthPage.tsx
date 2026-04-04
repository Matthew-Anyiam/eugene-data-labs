import { useMemo } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useScreener } from '../../hooks/useScreener';

interface ScreenerResult {
  ticker: string;
  name: string;
  market_cap: number;
  price: number;
  sector: string;
  beta: number;
  volume: number;
}

// Market-cap tiers by USD
const CAP_TIERS = [
  { label: 'Mega Cap', min: 200e9 },
  { label: 'Large Cap', min: 10e9 },
  { label: 'Mid Cap', min: 2e9 },
  { label: 'Small Cap', min: 300e6 },
  { label: 'Micro Cap', min: 0 },
] as const;

// Beta buckets
const BETA_BUCKETS = [
  { label: '< 0', min: -Infinity, max: 0 },
  { label: '0–0.5', min: 0, max: 0.5 },
  { label: '0.5–1', min: 0.5, max: 1 },
  { label: '1–1.5', min: 1, max: 1.5 },
  { label: '1.5–2', min: 1.5, max: 2 },
  { label: '> 2', min: 2, max: Infinity },
] as const;

function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function fmtCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

interface SectorBreadth {
  sector: string;
  count: number;
  avgVolume: number;
  totalMarketCap: number;
  avgBeta: number;
}

export function BreadthPage() {
  const { data, isLoading, isError } = useScreener({ limit: 100 });

  const results: ScreenerResult[] = useMemo(() => data?.results ?? [], [data]);

  // Count by sector
  const sectorBreadth = useMemo<SectorBreadth[]>(() => {
    const map = new Map<string, ScreenerResult[]>();
    for (const r of results) {
      const key = r.sector || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .map(([sector, stocks]) => ({
        sector,
        count: stocks.length,
        avgVolume: stocks.reduce((s, x) => s + (x.volume ?? 0), 0) / stocks.length,
        totalMarketCap: stocks.reduce((s, x) => s + (x.market_cap ?? 0), 0),
        avgBeta: stocks.reduce((s, x) => s + (x.beta ?? 0), 0) / stocks.length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [results]);

  // Beta distribution
  const betaDist = useMemo(() => {
    return BETA_BUCKETS.map((b) => ({
      label: b.label,
      count: results.filter((r) => r.beta >= b.min && r.beta < b.max).length,
    }));
  }, [results]);

  const maxBetaCount = Math.max(...betaDist.map((b) => b.count), 1);

  // Market-cap tiers
  const capTiers = useMemo(() => {
    return CAP_TIERS.map((t, i) => {
      const nextMin = i + 1 < CAP_TIERS.length ? CAP_TIERS[i + 1].min : 0;
      const count = results.filter(
        (r) => r.market_cap >= t.min && (i === 0 ? true : r.market_cap < CAP_TIERS[i - 1].min),
      ).length;
      return { label: t.label, count };
    });
  }, [results]);

  const maxCapCount = Math.max(...capTiers.map((t) => t.count), 1);
  const maxSectorCount = Math.max(...sectorBreadth.map((s) => s.count), 1);

  // Aggregate stats
  const totalStocks = results.length;
  const avgVolume = totalStocks
    ? results.reduce((s, r) => s + (r.volume ?? 0), 0) / totalStocks
    : 0;
  const totalMarketCap = results.reduce((s, r) => s + (r.market_cap ?? 0), 0);
  const avgBeta = totalStocks
    ? results.reduce((s, r) => s + (r.beta ?? 0), 0) / totalStocks
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-slate-400">Loading breadth data…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-red-400">Failed to load breadth data. Please try again.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Market Breadth</h1>
          <p className="text-sm text-slate-400">
            Sector distribution, volume analysis, beta profile, and market-cap tiers
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Stocks Analysed', value: totalStocks.toLocaleString(), color: 'text-white' },
          { label: 'Sectors', value: sectorBreadth.length.toString(), color: 'text-cyan-400' },
          { label: 'Avg Volume', value: fmtVol(avgVolume), color: 'text-slate-300' },
          {
            label: 'Avg Beta',
            value: avgBeta.toFixed(2),
            color: avgBeta > 1 ? 'text-amber-400' : 'text-emerald-400',
          },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Count by sector */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Stocks per Sector</h3>
        <div className="space-y-3">
          {sectorBreadth.map((s) => {
            const barPct = (s.count / maxSectorCount) * 100;
            return (
              <div key={s.sector} className="flex items-center gap-2">
                <span className="w-36 truncate text-xs font-medium text-slate-300">{s.sector}</span>
                <div className="flex flex-1 items-center">
                  <div
                    className="h-5 rounded-r bg-cyan-500/40 transition-all"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium text-white">{s.count}</span>
                <span className="w-20 text-right text-[10px] text-slate-500">
                  β {s.avgBeta.toFixed(2)}
                </span>
                <span className="w-20 text-right text-[10px] text-slate-500">
                  {fmtCap(s.totalMarketCap)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Beta distribution */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-4 text-sm font-semibold text-white">Beta Distribution</h3>
          <div className="space-y-3">
            {betaDist.map((b) => {
              const pct = totalStocks ? ((b.count / totalStocks) * 100).toFixed(1) : '0.0';
              const barPct = (b.count / maxBetaCount) * 100;
              return (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="w-14 text-xs text-slate-400">{b.label}</span>
                  <div className="flex flex-1 items-center">
                    <div
                      className="h-4 rounded-r bg-indigo-500/50 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs text-slate-300">
                    {b.count} <span className="text-slate-500">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Market-cap tiers */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-4 text-sm font-semibold text-white">Market-Cap Tiers</h3>
          <div className="space-y-3">
            {capTiers.map((t) => {
              const pct = totalStocks ? ((t.count / totalStocks) * 100).toFixed(1) : '0.0';
              const barPct = (t.count / maxCapCount) * 100;
              return (
                <div key={t.label} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-slate-400">{t.label}</span>
                  <div className="flex flex-1 items-center">
                    <div
                      className="h-4 rounded-r bg-emerald-500/50 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs text-slate-300">
                    {t.count} <span className="text-slate-500">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Avg volume by sector */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Average Volume by Sector</h3>
        <div className="space-y-3">
          {[...sectorBreadth]
            .sort((a, b) => b.avgVolume - a.avgVolume)
            .map((s) => {
              const maxVol = Math.max(...sectorBreadth.map((x) => x.avgVolume), 1);
              const barPct = (s.avgVolume / maxVol) * 100;
              return (
                <div key={s.sector} className="flex items-center gap-2">
                  <span className="w-36 truncate text-xs font-medium text-slate-300">{s.sector}</span>
                  <div className="flex flex-1 items-center">
                    <div
                      className="h-5 rounded-r bg-amber-500/40 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-slate-300">
                    {fmtVol(s.avgVolume)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Sector breadth table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Count</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Market Cap</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Avg Volume</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Avg Beta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sectorBreadth.map((s) => (
              <tr key={s.sector} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs font-medium text-white">{s.sector}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{s.count}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">
                  {fmtCap(s.totalMarketCap)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">
                  {fmtVol(s.avgVolume)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right text-xs font-medium',
                    s.avgBeta > 1.2
                      ? 'text-amber-400'
                      : s.avgBeta < 0.8
                        ? 'text-emerald-400'
                        : 'text-slate-300',
                  )}
                >
                  {s.avgBeta.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
