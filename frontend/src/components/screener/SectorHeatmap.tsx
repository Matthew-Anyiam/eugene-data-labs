import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ScreenerResult } from '../../lib/types';
import { cn } from '../../lib/utils';

interface SectorHeatmapProps {
  results: ScreenerResult[];
}

interface SectorData {
  sector: string;
  count: number;
  totalMarketCap: number;
  avgPrice: number;
  tickers: { ticker: string; name: string; marketCap: number; price: number }[];
}

export function SectorHeatmap({ results }: SectorHeatmapProps) {
  const sectors = useMemo(() => {
    const map = new Map<string, SectorData>();

    results.forEach((r) => {
      const sector = r.sector || 'Unknown';
      const existing = map.get(sector) || {
        sector,
        count: 0,
        totalMarketCap: 0,
        avgPrice: 0,
        tickers: [],
      };
      existing.count++;
      existing.totalMarketCap += r.market_cap || 0;
      existing.tickers.push({
        ticker: r.ticker,
        name: r.name,
        marketCap: r.market_cap,
        price: r.price,
      });
      map.set(sector, existing);
    });

    // Calculate avg price
    map.forEach((s) => {
      s.avgPrice = s.tickers.reduce((sum, t) => sum + (t.price || 0), 0) / s.count;
      // Sort tickers by market cap desc
      s.tickers.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    });

    // Sort sectors by total market cap
    return Array.from(map.values()).sort((a, b) => b.totalMarketCap - a.totalMarketCap);
  }, [results]);

  if (sectors.length === 0) return null;

  // Find max market cap for relative sizing
  const maxCap = Math.max(...sectors.map((s) => s.totalMarketCap), 1);

  // Color palette for sectors
  const SECTOR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Technology: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    'Financial Services': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    Healthcare: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' },
    'Consumer Cyclical': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    'Communication Services': { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
    Industrials: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
    'Consumer Defensive': { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30' },
    Energy: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    Utilities: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    'Real Estate': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
    'Basic Materials': { bg: 'bg-lime-500/20', text: 'text-lime-400', border: 'border-lime-500/30' },
  };

  const defaultColor = { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Sector breakdown</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {sectors.map((sector) => {
          const colors = SECTOR_COLORS[sector.sector] || defaultColor;
          const sizePercent = (sector.totalMarketCap / maxCap) * 100;

          return (
            <div
              key={sector.sector}
              className={cn(
                'rounded-lg border p-3 transition-colors hover:brightness-110',
                colors.bg,
                colors.border,
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-semibold', colors.text)}>
                  {sector.sector}
                </span>
                <span className="text-[10px] text-slate-400">{sector.count}</span>
              </div>

              {/* Top tickers */}
              <div className="mt-2 flex flex-wrap gap-1">
                {sector.tickers.slice(0, 4).map((t) => (
                  <Link
                    key={t.ticker}
                    to={`/company/${t.ticker}`}
                    className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-300 hover:text-white dark:bg-white/5"
                  >
                    {t.ticker}
                  </Link>
                ))}
                {sector.tickers.length > 4 && (
                  <span className="px-1 text-[10px] text-slate-500">
                    +{sector.tickers.length - 4}
                  </span>
                )}
              </div>

              {/* Size bar */}
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/5">
                <div
                  className={cn('h-full rounded-full', colors.bg.replace('/20', '/60'))}
                  style={{ width: `${Math.max(sizePercent, 5)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
