import { useState, useMemo } from 'react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { OHLCVBar } from '../../lib/types';
import { formatPrice } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface PriceChartProps {
  bars: OHLCVBar[];
}

const RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: Infinity },
] as const;

type RangeLabel = typeof RANGES[number]['label'];

function filterByRange(bars: OHLCVBar[], days: number): OHLCVBar[] {
  if (days === Infinity) return bars;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return bars.filter((b) => b.date.slice(0, 10) >= cutoffStr);
}

export function PriceChart({ bars }: PriceChartProps) {
  const [range, setRange] = useState<RangeLabel>('1Y');

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.label === range)!.days;
    const filtered = filterByRange(bars, days);
    return [...filtered].reverse().map((b) => ({
      date: b.date.slice(0, 10),
      price: b.close,
      volume: b.volume,
    }));
  }, [bars, range]);

  // Compute price change for gradient color
  const priceUp = data.length >= 2 ? data[data.length - 1].price >= data[0].price : true;
  const color = priceUp ? '#10b981' : '#ef4444'; // emerald-500 / red-500

  // Volume max for scaling
  const maxVol = useMemo(() => Math.max(...data.map((d) => d.volume || 0), 1), [data]);

  return (
    <div className="space-y-2">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Price history</h3>
        <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                range === r.label
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                if (range === '1W' || range === '1M') {
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }
                return `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
              }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              yAxisId="price"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}`}
              domain={['auto', 'auto']}
              width={55}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              tick={false}
              tickLine={false}
              axisLine={false}
              domain={[0, maxVol * 4]}
              width={0}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: 'none',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '12px',
                padding: '8px 12px',
              }}
              formatter={(value, name) => {
                const v = Number(value);
                if (name === 'price') return [formatPrice(v), 'Price'];
                if (name === 'volume') return [v?.toLocaleString() ?? '—', 'Volume'];
                return [String(v), String(name)];
              }}
              labelFormatter={(label) => label}
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#94a3b8"
              fillOpacity={0.15}
              radius={[1, 1, 0, 0]}
              isAnimationActive={false}
            />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={2}
              fill="url(#priceGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Price change summary */}
      {data.length >= 2 && (
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>
            Open: <span className="font-medium text-slate-600 dark:text-slate-300">{formatPrice(data[0].price)}</span>
          </span>
          <span>
            Close: <span className="font-medium text-slate-600 dark:text-slate-300">{formatPrice(data[data.length - 1].price)}</span>
          </span>
          <span>
            Change:{' '}
            <span className={cn('font-medium', priceUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {priceUp ? '+' : ''}{((data[data.length - 1].price - data[0].price) / data[0].price * 100).toFixed(2)}%
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
