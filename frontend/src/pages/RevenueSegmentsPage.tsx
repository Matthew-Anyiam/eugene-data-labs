import { useState, useMemo } from 'react';
import { PieChart, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

const SEGMENTS_DB: Record<string, string[]> = {
  AAPL: ['iPhone', 'Services', 'Mac', 'iPad', 'Wearables'],
  MSFT: ['Intelligent Cloud', 'Productivity & Business', 'Personal Computing'],
  GOOGL: ['Google Search', 'YouTube', 'Google Cloud', 'Network', 'Other Bets'],
  AMZN: ['AWS', 'Online Stores', 'Third-Party Sellers', 'Advertising', 'Subscriptions', 'Physical Stores'],
  NVDA: ['Data Center', 'Gaming', 'Professional Visualization', 'Automotive', 'OEM & Other'],
  META: ['Family of Apps', 'Reality Labs'],
  TSLA: ['Automotive Sales', 'Automotive Leasing', 'Energy & Storage', 'Services'],
  JPM: ['Consumer & Community', 'Corporate & Investment', 'Commercial Banking', 'Asset & Wealth Mgmt'],
};

const REGIONS = ['Americas', 'Europe', 'Asia Pacific', 'Greater China', 'Rest of World'];
const SEGMENT_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500'];
const SEGMENT_TEXT = ['text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-purple-400', 'text-pink-400', 'text-cyan-400'];

interface SegmentData {
  name: string;
  revenue: number;
  pct: number;
  growth: number;
  margin: number;
  history: { year: number; revenue: number }[];
}

interface GeoData {
  region: string;
  revenue: number;
  pct: number;
  growth: number;
}

function genSegments(ticker: string): { segments: SegmentData[]; geo: GeoData[]; totalRevenue: number } {
  const s = seed(ticker + '_seg');
  const segs = SEGMENTS_DB[ticker] || ['Product A', 'Product B', 'Services', 'Other'];
  const totalRevenue = 20 + pseudo(s, 0) * 380;

  // Generate segment proportions
  const rawWeights = segs.map((_, i) => 0.5 + pseudo(s, 10 + i) * 3);
  const totalWeight = rawWeights.reduce((a, b) => a + b, 0);

  const segments: SegmentData[] = segs.map((name, i) => {
    const pct = (rawWeights[i] / totalWeight) * 100;
    const revenue = totalRevenue * pct / 100;
    const growth = (pseudo(s, 30 + i) - 0.3) * 40;
    const margin = 10 + pseudo(s, 50 + i) * 50;
    const history = Array.from({ length: 5 }, (_, j) => ({
      year: 2021 + j,
      revenue: +(revenue * Math.pow(1 / (1 + growth / 100), 4 - j)).toFixed(1),
    }));

    return { name, revenue: +revenue.toFixed(1), pct: +pct.toFixed(1), growth: +growth.toFixed(1), margin: +margin.toFixed(1), history };
  }).sort((a, b) => b.revenue - a.revenue);

  const geoRawWeights = REGIONS.map((_, i) => 0.5 + pseudo(s, 70 + i) * 3);
  const geoTotal = geoRawWeights.reduce((a, b) => a + b, 0);
  const geo: GeoData[] = REGIONS.map((region, i) => {
    const pct = (geoRawWeights[i] / geoTotal) * 100;
    return {
      region, revenue: +(totalRevenue * pct / 100).toFixed(1),
      pct: +pct.toFixed(1), growth: +((pseudo(s, 90 + i) - 0.3) * 25).toFixed(1),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return { segments, geo, totalRevenue: +totalRevenue.toFixed(1) };
}

export function RevenueSegmentsPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [view, setView] = useState<'segments' | 'geography'>('segments');

  const data = useMemo(() => genSegments(selectedTicker), [selectedTicker]);
  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

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
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Total revenue */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider">Total Annual Revenue</div>
        <div className="mt-1 text-3xl font-bold text-white">${data.totalRevenue}B</div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {(['segments', 'geography'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', view === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
            {v === 'segments' ? 'Business Segments' : 'Geography'}
          </button>
        ))}
      </div>

      {view === 'segments' && (
        <>
          {/* Stacked bar */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Revenue Mix</h3>
            <div className="flex h-8 overflow-hidden rounded-full">
              {data.segments.map((seg, i) => (
                <div key={seg.name} className={cn('transition-all', SEGMENT_COLORS[i % SEGMENT_COLORS.length], 'opacity-60')}
                  style={{ width: `${seg.pct}%` }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {data.segments.map((seg, i) => (
                <span key={seg.name} className="flex items-center gap-1.5 text-xs">
                  <span className={cn('h-2.5 w-2.5 rounded-sm', SEGMENT_COLORS[i % SEGMENT_COLORS.length])} />
                  <span className="text-slate-300">{seg.name}</span>
                  <span className="text-slate-500">{seg.pct}%</span>
                </span>
              ))}
            </div>
          </div>

          {/* Segment cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.segments.map((seg, i) => (
              <div key={seg.name} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-semibold', SEGMENT_TEXT[i % SEGMENT_TEXT.length])}>{seg.name}</span>
                  <span className="text-xs text-slate-500">{seg.pct}%</span>
                </div>
                <div className="mt-2 text-xl font-bold text-white">${seg.revenue}B</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={cn('flex items-center gap-0.5 text-xs font-medium', seg.growth >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {seg.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {seg.growth >= 0 ? '+' : ''}{seg.growth}% YoY
                  </span>
                  <span className="text-xs text-slate-500">{seg.margin}% margin</span>
                </div>
                {/* Mini history */}
                <div className="mt-3 flex items-end gap-1" style={{ height: '40px' }}>
                  {seg.history.map(h => {
                    const max = Math.max(...seg.history.map(x => x.revenue));
                    const height = max > 0 ? (h.revenue / max) * 35 : 0;
                    return (
                      <div key={h.year} className="flex flex-1 flex-col items-center gap-0.5">
                        <div className={cn('w-full rounded-t opacity-40', SEGMENT_COLORS[i % SEGMENT_COLORS.length])} style={{ height: `${Math.max(2, height)}px` }} />
                        <span className="text-[7px] text-slate-600">{h.year}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Segment table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Segment</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Revenue</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">% of Total</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Growth</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.segments.map((seg, i) => (
                  <tr key={seg.name} className="bg-slate-800 hover:bg-slate-750">
                    <td className={cn('px-3 py-2 text-xs font-medium', SEGMENT_TEXT[i % SEGMENT_TEXT.length])}>{seg.name}</td>
                    <td className="px-3 py-2 text-right text-xs text-white font-medium">${seg.revenue}B</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">{seg.pct}%</td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', seg.growth >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {seg.growth >= 0 ? '+' : ''}{seg.growth}%
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">{seg.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'geography' && (
        <>
          {/* Geo bar */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Revenue by Region</h3>
            <div className="space-y-3">
              {data.geo.map((g, i) => (
                <div key={g.region}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className={cn('font-medium', SEGMENT_TEXT[i % SEGMENT_TEXT.length])}>{g.region}</span>
                    <span className="text-slate-400">${g.revenue}B ({g.pct}%)</span>
                  </div>
                  <div className="h-4 rounded-full bg-slate-700">
                    <div className={cn('h-4 rounded-full opacity-60', SEGMENT_COLORS[i % SEGMENT_COLORS.length])} style={{ width: `${g.pct}%` }} />
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
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.geo.map(g => (
                  <tr key={g.region} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs font-medium text-white">{g.region}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">${g.revenue}B</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">{g.pct}%</td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', g.growth >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {g.growth >= 0 ? '+' : ''}{g.growth}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
