import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, Plus, X, Pencil, Check, Download,
  TrendingUp, DollarSign, PieChart,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { usePortfolio, type Position } from '../hooks/usePortfolio';
import { usePrices } from '../hooks/usePrices';
import { formatPrice, formatCurrency, formatPercent, cn } from '../lib/utils';
import { downloadCSV } from '../lib/export';

export function PortfolioPage() {
  const { positions, addPosition, removePosition, updatePosition } = usePortfolio();
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Briefcase className="h-7 w-7 text-violet-500" />
            Portfolio
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track your positions and monitor real-time performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {positions.length > 0 && <ExportButton positions={positions} />}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Position
          </button>
        </div>
      </div>

      {/* Add position form */}
      {showAddForm && (
        <AddPositionForm
          onAdd={(ticker, shares, cost) => {
            addPosition(ticker, shares, cost);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {positions.length === 0 && !showAddForm ? (
        <EmptyPortfolio onAdd={() => setShowAddForm(true)} />
      ) : positions.length > 0 ? (
        <>
          {/* Summary cards */}
          <PortfolioSummary positions={positions} />

          {/* Allocation breakdown */}
          <AllocationBreakdown positions={positions} />

          {/* Positions table */}
          <PositionsTable
            positions={positions}
            onRemove={removePosition}
            onUpdate={updatePosition}
          />
        </>
      ) : null}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────

function EmptyPortfolio({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-12 text-center dark:border-slate-700">
      <Briefcase className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700" />
      <h3 className="mt-3 font-medium text-slate-600 dark:text-slate-400">No positions yet</h3>
      <p className="mt-1 text-sm text-slate-400">
        Add your first position to start tracking your portfolio
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        <Plus className="h-4 w-4" />
        Add Position
      </button>
    </div>
  );
}

// ─── Add position form ───────────────────────────────────────────────

function AddPositionForm({
  onAdd,
  onCancel,
}: {
  onAdd: (ticker: string, shares: number, cost: number) => void;
  onCancel: () => void;
}) {
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    const s = parseFloat(shares);
    const c = parseFloat(cost);
    if (t && s > 0 && c > 0) {
      onAdd(t, s, c);
    }
  };

  const valid = ticker.trim().length > 0 && parseFloat(shares) > 0 && parseFloat(cost) > 0;

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800/50 dark:bg-violet-900/10">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            maxLength={10}
            autoFocus
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm placeholder:text-slate-300 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Shares</label>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="100"
            min="0"
            step="any"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm tabular-nums placeholder:text-slate-300 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Avg Cost ($)</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="150.00"
            min="0"
            step="0.01"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm tabular-nums placeholder:text-slate-300 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <button
          type="submit"
          disabled={!valid}
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Portfolio summary ───────────────────────────────────────────────

function PortfolioSummary({ positions }: { positions: Position[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard positions={positions} metric="total_value" />
      <SummaryCard positions={positions} metric="total_gain" />
      <SummaryCard positions={positions} metric="day_change" />
      <SummaryCard positions={positions} metric="positions_count" />
    </div>
  );
}

function SummaryCard({ positions, metric }: { positions: Position[]; metric: string }) {
  // We need to aggregate price data from individual PositionPriceData components
  // Use a simple approach: render each position's contribution
  const labels: Record<string, { label: string; icon: React.ReactNode }> = {
    total_value: { label: 'Total Value', icon: <DollarSign className="h-4 w-4 text-violet-500" /> },
    total_gain: { label: 'Total Return', icon: <TrendingUp className="h-4 w-4 text-emerald-500" /> },
    day_change: { label: 'Day Change', icon: <ArrowUpRight className="h-4 w-4 text-blue-500" /> },
    positions_count: { label: 'Positions', icon: <PieChart className="h-4 w-4 text-amber-500" /> },
  };

  const { label, icon } = labels[metric] || { label: metric, icon: null };

  if (metric === 'positions_count') {
    return (
      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-500">{icon} {label}</div>
        <p className="mt-1.5 text-xl font-bold tabular-nums">{positions.length}</p>
        <p className="text-[11px] text-slate-400">{positions.length === 1 ? '1 holding' : `${positions.length} holdings`}</p>
      </div>
    );
  }

  return (
    <AggregateSummaryCard
      positions={positions}
      metric={metric}
      label={label}
      icon={icon}
    />
  );
}

function AggregateSummaryCard({
  positions,
  metric,
  label,
  icon,
}: {
  positions: Position[];
  metric: string;
  label: string;
  icon: React.ReactNode;
}) {
  // Each child will report its value up — for simplicity we'll use individual price cells
  // and let each compute its contribution
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center gap-2 text-xs text-slate-500">{icon} {label}</div>
      <AggregateValue positions={positions} metric={metric} />
    </div>
  );
}

function AggregateValue({ positions, metric }: { positions: Position[]; metric: string }) {
  // Collect data from each position's price data
  const values = positions.map((p) => ({
    ticker: p.ticker,
    shares: p.shares,
    avgCost: p.avgCost,
  }));

  return <AggregateValueInner entries={values} metric={metric} />;
}

function AggregateValueInner({
  entries,
  metric,
}: {
  entries: { ticker: string; shares: number; avgCost: number }[];
  metric: string;
}) {
  // We need all prices — use individual hook calls via child component pattern
  // For aggregate, we'll render a hidden PriceAggregator
  return <MultiPriceAggregator entries={entries} metric={metric} />;
}

function MultiPriceAggregator({
  entries,
  metric,
}: {
  entries: { ticker: string; shares: number; avgCost: number }[];
  metric: string;
}) {
  // Collect price data from each entry via the PriceFetcher component
  const [priceMap, setPriceMap] = useState<Record<string, any>>({});

  const handlePrice = useCallback((ticker: string, data: any) => {
    setPriceMap((prev) => {
      if (prev[ticker] === data) return prev;
      return { ...prev, [ticker]: data };
    });
  }, []);

  // Compute aggregate
  let totalValue = 0;
  let totalCostBasis = 0;
  let dayChange = 0;
  let loadedCount = 0;

  for (const entry of entries) {
    const priceData = priceMap[entry.ticker];
    if (priceData?.price) {
      totalValue += priceData.price * entry.shares;
      totalCostBasis += entry.avgCost * entry.shares;
      dayChange += (priceData.change || 0) * entry.shares;
      loadedCount++;
    }
  }

  const totalGain = totalValue - totalCostBasis;
  const totalGainPct = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0;
  const dayChangePct = totalValue > 0 && totalValue !== dayChange ? (dayChange / (totalValue - dayChange)) * 100 : 0;
  const loading = loadedCount < entries.length;

  let display = '--';
  let sub = '';
  let colorClass = '';

  if (metric === 'total_value') {
    display = loading && loadedCount === 0 ? '--' : formatPrice(totalValue);
    sub = `Cost basis: ${formatPrice(totalCostBasis)}`;
  } else if (metric === 'total_gain') {
    if (loading && loadedCount === 0) {
      display = '--';
    } else {
      display = `${totalGain >= 0 ? '+' : ''}${formatPrice(Math.abs(totalGain))}`;
      sub = `${totalGainPct >= 0 ? '+' : ''}${totalGainPct.toFixed(2)}%`;
      colorClass = totalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    }
  } else if (metric === 'day_change') {
    if (loading && loadedCount === 0) {
      display = '--';
    } else {
      display = `${dayChange >= 0 ? '+' : ''}${formatPrice(Math.abs(dayChange))}`;
      sub = `${dayChangePct >= 0 ? '+' : ''}${dayChangePct.toFixed(2)}%`;
      colorClass = dayChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    }
  }

  return (
    <>
      {/* Hidden price fetchers */}
      {entries.map((e) => (
        <PriceFetcher key={e.ticker} ticker={e.ticker} onData={handlePrice} />
      ))}
      <p className={cn('mt-1.5 text-xl font-bold tabular-nums', colorClass)}>
        {loading && loadedCount === 0 ? (
          <span className="inline-block h-6 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        ) : (
          display
        )}
      </p>
      {sub && <p className={cn('text-[11px]', colorClass || 'text-slate-400')}>{sub}</p>}
    </>
  );
}

function PriceFetcher({
  ticker,
  onData,
}: {
  ticker: string;
  onData: (ticker: string, data: any) => void;
}) {
  const { data } = usePrices(ticker);

  // Report data up when it changes
  useMemo(() => {
    if (data) onData(ticker, data);
  }, [data, ticker, onData]);

  return null;
}

// ─── Allocation breakdown ────────────────────────────────────────────

const ALLOC_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-lime-500',
  'bg-orange-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
];

function AllocationBreakdown({ positions }: { positions: Position[] }) {
  const [priceMap, setPriceMap] = useState<Record<string, any>>({});

  const handlePrice = useCallback((ticker: string, data: any) => {
    setPriceMap((prev) => {
      if (prev[ticker] === data) return prev;
      return { ...prev, [ticker]: data };
    });
  }, []);

  // Compute allocations
  const allocations = positions.map((p, i) => {
    const priceData = priceMap[p.ticker];
    const marketValue = priceData?.price ? priceData.price * p.shares : p.avgCost * p.shares;
    return {
      ticker: p.ticker,
      value: marketValue,
      color: ALLOC_COLORS[i % ALLOC_COLORS.length],
    };
  });

  const total = allocations.reduce((s, a) => s + a.value, 0);

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <PieChart className="h-4 w-4 text-violet-500" />
        Allocation
      </h3>

      {/* Hidden price fetchers */}
      {positions.map((p) => (
        <PriceFetcher key={p.ticker} ticker={p.ticker} onData={handlePrice} />
      ))}

      {/* Horizontal bar */}
      <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {allocations.map((a) => {
          const pct = total > 0 ? (a.value / total) * 100 : 0;
          if (pct < 0.5) return null;
          return (
            <div
              key={a.ticker}
              className={cn('transition-all', a.color)}
              style={{ width: `${pct}%` }}
              title={`${a.ticker}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {allocations
          .sort((a, b) => b.value - a.value)
          .map((a) => {
            const pct = total > 0 ? (a.value / total) * 100 : 0;
            return (
              <div key={a.ticker} className="flex items-center gap-1.5 text-xs">
                <div className={cn('h-2.5 w-2.5 rounded-sm', a.color)} />
                <Link
                  to={`/company/${a.ticker}`}
                  className="font-mono font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                >
                  {a.ticker}
                </Link>
                <span className="text-slate-400">{pct.toFixed(1)}%</span>
                <span className="text-slate-300 dark:text-slate-600">
                  {formatCurrency(a.value)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Positions table ─────────────────────────────────────────────────

function PositionsTable({
  positions,
  onRemove,
  onUpdate,
}: {
  positions: Position[];
  onRemove: (ticker: string) => void;
  onUpdate: (ticker: string, shares: number, avgCost: number) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Positions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 dark:border-slate-800">
              <th className="px-4 py-2.5 text-left font-medium">Ticker</th>
              <th className="px-4 py-2.5 text-right font-medium">Shares</th>
              <th className="px-4 py-2.5 text-right font-medium">Avg Cost</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="px-4 py-2.5 text-right font-medium">Mkt Value</th>
              <th className="px-4 py-2.5 text-right font-medium">Day P&L</th>
              <th className="px-4 py-2.5 text-right font-medium">Total P&L</th>
              <th className="px-4 py-2.5 text-right font-medium">Return %</th>
              <th className="px-4 py-2.5 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <PositionRow
                key={p.ticker}
                position={p}
                onRemove={() => onRemove(p.ticker)}
                onUpdate={(shares, avgCost) => onUpdate(p.ticker, shares, avgCost)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PositionRow({
  position,
  onRemove,
  onUpdate,
}: {
  position: Position;
  onRemove: () => void;
  onUpdate: (shares: number, avgCost: number) => void;
}) {
  const { data, isLoading } = usePrices(position.ticker);
  const [editing, setEditing] = useState(false);
  const [editShares, setEditShares] = useState(String(position.shares));
  const [editCost, setEditCost] = useState(String(position.avgCost.toFixed(2)));

  const price = data?.price ?? 0;
  const change = data?.change ?? 0;
  const marketValue = price * position.shares;
  const costBasis = position.avgCost * position.shares;
  const totalPL = marketValue - costBasis;
  const totalPLPct = costBasis > 0 ? (totalPL / costBasis) * 100 : 0;
  const dayPL = change * position.shares;

  const handleSave = () => {
    const s = parseFloat(editShares);
    const c = parseFloat(editCost);
    if (s > 0 && c > 0) {
      onUpdate(s, c);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <tr className="border-b border-slate-100 bg-violet-50/50 dark:border-slate-800/50 dark:bg-violet-900/5">
        <td className="px-4 py-2">
          <span className="font-mono font-medium">{position.ticker}</span>
        </td>
        <td className="px-4 py-2 text-right">
          <input
            type="number"
            value={editShares}
            onChange={(e) => setEditShares(e.target.value)}
            className="w-20 rounded border border-slate-200 bg-white px-2 py-0.5 text-right text-sm tabular-nums focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            min="0"
            step="any"
          />
        </td>
        <td className="px-4 py-2 text-right">
          <input
            type="number"
            value={editCost}
            onChange={(e) => setEditCost(e.target.value)}
            className="w-24 rounded border border-slate-200 bg-white px-2 py-0.5 text-right text-sm tabular-nums focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            min="0"
            step="0.01"
          />
        </td>
        <td colSpan={4} />
        <td />
        <td className="px-4 py-2 text-center">
          <button
            onClick={handleSave}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800/50 dark:hover:bg-slate-800/20">
      <td className="px-4 py-2.5">
        <Link
          to={`/company/${position.ticker}`}
          className="font-mono font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
        >
          {position.ticker}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
        {position.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
        {formatPrice(position.avgCost)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
        {isLoading ? (
          <span className="inline-block h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        ) : price > 0 ? (
          formatPrice(price)
        ) : (
          '--'
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
        {isLoading ? (
          <span className="inline-block h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        ) : price > 0 ? (
          formatCurrency(marketValue)
        ) : (
          '--'
        )}
      </td>
      <td className={cn(
        'px-4 py-2.5 text-right tabular-nums text-sm font-medium',
        dayPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {isLoading ? (
          <span className="inline-block h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        ) : price > 0 ? (
          <span className="flex items-center justify-end gap-0.5">
            {dayPL >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {formatPrice(Math.abs(dayPL))}
          </span>
        ) : '--'}
      </td>
      <td className={cn(
        'px-4 py-2.5 text-right tabular-nums text-sm font-medium',
        totalPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {isLoading ? (
          <span className="inline-block h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        ) : price > 0 ? (
          `${totalPL >= 0 ? '+' : '-'}${formatPrice(Math.abs(totalPL))}`
        ) : '--'}
      </td>
      <td className={cn(
        'px-4 py-2.5 text-right tabular-nums text-sm font-medium',
        totalPLPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {isLoading ? (
          <span className="inline-block h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        ) : price > 0 ? (
          formatPercent(totalPLPct)
        ) : '--'}
      </td>
      <td className="px-4 py-2.5 text-center">
        <button
          onClick={() => {
            setEditShares(String(position.shares));
            setEditCost(String(position.avgCost.toFixed(2)));
            setEditing(true);
          }}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          title="Edit position"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={onRemove}
          className="ml-0.5 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Remove position"
        >
          <X className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ─── Export ───────────────────────────────────────────────────────────

function ExportButton({ positions }: { positions: Position[] }) {
  const handleExport = useCallback(() => {
    downloadCSV(
      positions.map((p) => ({
        ticker: p.ticker,
        shares: p.shares,
        avg_cost: p.avgCost,
        cost_basis: p.shares * p.avgCost,
      })),
      `eugene-portfolio-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'ticker', label: 'Ticker' },
        { key: 'shares', label: 'Shares' },
        { key: 'avg_cost', label: 'Avg Cost' },
        { key: 'cost_basis', label: 'Cost Basis' },
      ],
    );
  }, [positions]);

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    >
      <Download className="h-3.5 w-3.5" />
      Export
    </button>
  );
}
