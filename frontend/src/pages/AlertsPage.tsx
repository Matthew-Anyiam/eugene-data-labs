import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Plus, X, Trash2, CheckCheck, ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, FileText, Clock, AlertTriangle,
  BellRing, BellOff,
} from 'lucide-react';
import { useAlerts, type AlertCondition } from '../hooks/useAlerts';
import { usePrices } from '../hooks/usePrices';
import { formatPrice, cn } from '../lib/utils';

const CONDITION_OPTIONS: { value: AlertCondition; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'above', label: 'Price Above', icon: <ArrowUp className="h-4 w-4 text-emerald-500" />, description: 'Trigger when price exceeds threshold' },
  { value: 'below', label: 'Price Below', icon: <ArrowDown className="h-4 w-4 text-red-500" />, description: 'Trigger when price drops below threshold' },
  { value: 'change_up', label: 'Day Up %', icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, description: 'Trigger on positive daily change' },
  { value: 'change_down', label: 'Day Down %', icon: <TrendingDown className="h-4 w-4 text-red-500" />, description: 'Trigger on negative daily change' },
  { value: 'new_filing', label: 'New Filing', icon: <FileText className="h-4 w-4 text-blue-500" />, description: 'Trigger on new SEC filing' },
];

export function AlertsPage() {
  const {
    alerts,
    addAlert,
    removeAlert,
    markRead,
    markAllRead,
    clearTriggered,
    unreadCount,
    activeCount,
  } = useAlerts();
  const [showForm, setShowForm] = useState(false);

  const triggered = alerts.filter((a) => a.triggered);
  const active = alerts.filter((a) => !a.triggered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-7 w-7 text-amber-500" />
            Alerts
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {activeCount} active alert{activeCount !== 1 ? 's' : ''}
            {unreadCount > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                · {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark All Read
            </button>
          )}
          {triggered.length > 0 && (
            <button
              onClick={clearTriggered}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear History
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-500"
          >
            <Plus className="h-3.5 w-3.5" />
            New Alert
          </button>
        </div>
      </div>

      {/* Create alert form */}
      {showForm && (
        <CreateAlertForm
          onAdd={(ticker, condition, value) => {
            addAlert(ticker, condition, value);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Triggered notifications */}
      {triggered.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <BellRing className="h-4 w-4 text-amber-500" />
            Notifications ({triggered.length})
          </h2>
          <div className="space-y-2">
            {triggered.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  alert.read
                    ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    : 'border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-900/10'
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  alert.read ? 'bg-slate-100 dark:bg-slate-800' : 'bg-amber-100 dark:bg-amber-900/30'
                )}>
                  <ConditionIcon condition={alert.condition} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm',
                    alert.read ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-900 dark:text-white'
                  )}>
                    {alert.label}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    <Clock className="mr-0.5 inline h-3 w-3" />
                    {alert.triggeredAt ? timeAgo(alert.triggeredAt) : 'Just now'}
                  </p>
                </div>
                <Link
                  to={`/company/${alert.ticker}`}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-mono font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {alert.ticker}
                </Link>
                {!alert.read && (
                  <button
                    onClick={() => markRead(alert.id)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    title="Mark as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active alerts */}
      {active.length > 0 ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <BellOff className="h-4 w-4 text-slate-400" />
            Active Alerts ({active.length})
          </h2>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 dark:border-slate-800">
                    <th className="px-4 py-2.5 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2.5 text-left font-medium">Condition</th>
                    <th className="px-4 py-2.5 text-right font-medium">Threshold</th>
                    <th className="px-4 py-2.5 text-right font-medium">Current</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Created</th>
                    <th className="px-4 py-2.5 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} onRemove={() => removeAlert(alert.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !showForm && triggered.length === 0 ? (
        <EmptyAlerts onAdd={() => setShowForm(true)} />
      ) : null}

      {/* Alert checker — silently evaluates alerts in background */}
      <AlertChecker />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────

function EmptyAlerts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-12 text-center dark:border-slate-700">
      <Bell className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700" />
      <h3 className="mt-3 font-medium text-slate-600 dark:text-slate-400">No alerts set</h3>
      <p className="mt-1 text-sm text-slate-400">
        Create price alerts to get notified when conditions are met
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
      >
        <Plus className="h-4 w-4" />
        Create Alert
      </button>
    </div>
  );
}

// ─── Create alert form ───────────────────────────────────────────────

function CreateAlertForm({
  onAdd,
  onCancel,
}: {
  onAdd: (ticker: string, condition: AlertCondition, value: number) => void;
  onCancel: () => void;
}) {
  const [ticker, setTicker] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [value, setValue] = useState('');

  const needsValue = condition !== 'new_filing';
  const valid = ticker.trim().length > 0 && (!needsValue || parseFloat(value) > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onAdd(ticker, condition, needsValue ? parseFloat(value) : 0);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/50 dark:bg-amber-900/10"
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">New Alert</h3>

      {/* Condition selector */}
      <div className="mb-3 flex flex-wrap gap-2">
        {CONDITION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCondition(opt.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              condition === opt.value
                ? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        {CONDITION_OPTIONS.find((o) => o.value === condition)?.description}
      </p>

      {/* Inputs */}
      <div className="flex items-end gap-3">
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-slate-500">Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            maxLength={10}
            autoFocus
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm placeholder:text-slate-300 focus:border-amber-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        {needsValue && (
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {condition === 'above' || condition === 'below' ? 'Price ($)' : 'Change (%)'}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={condition === 'above' || condition === 'below' ? '150.00' : '5.0'}
              min="0"
              step={condition === 'above' || condition === 'below' ? '0.01' : '0.1'}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm tabular-nums placeholder:text-slate-300 focus:border-amber-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={!valid}
          className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-40"
        >
          Create
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

// ─── Alert row with live price ───────────────────────────────────────

function AlertRow({ alert, onRemove }: { alert: any; onRemove: () => void }) {
  const { data, isLoading } = usePrices(alert.ticker);
  const price = data?.price ?? 0;
  const changePct = data?.change_percent ?? 0;

  // Determine proximity to trigger
  let proximity = '';
  let proximityColor = 'text-slate-400';
  if (price > 0 && (alert.condition === 'above' || alert.condition === 'below')) {
    const diff = alert.condition === 'above'
      ? ((alert.value - price) / price) * 100
      : ((price - alert.value) / price) * 100;
    if (diff <= 2) {
      proximity = 'Close!';
      proximityColor = 'text-amber-600 dark:text-amber-400';
    } else if (diff <= 5) {
      proximity = 'Near';
      proximityColor = 'text-amber-500';
    } else {
      proximity = `${diff.toFixed(1)}% away`;
    }
  } else if (alert.condition === 'change_up' || alert.condition === 'change_down') {
    const absPct = Math.abs(changePct);
    if (absPct >= alert.value * 0.8) {
      proximity = 'Close!';
      proximityColor = 'text-amber-600 dark:text-amber-400';
    } else {
      proximity = `${absPct.toFixed(1)}% / ${alert.value.toFixed(1)}%`;
    }
  } else if (alert.condition === 'new_filing') {
    proximity = 'Monitoring';
  }

  const conditionLabel = CONDITION_OPTIONS.find((o) => o.value === alert.condition);

  return (
    <tr className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800/50 dark:hover:bg-slate-800/20">
      <td className="px-4 py-2.5">
        <Link
          to={`/company/${alert.ticker}`}
          className="font-mono font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
        >
          {alert.ticker}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          {conditionLabel?.icon}
          {conditionLabel?.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
        {alert.condition === 'new_filing'
          ? '—'
          : alert.condition === 'above' || alert.condition === 'below'
            ? formatPrice(alert.value)
            : `${alert.value.toFixed(1)}%`}
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
      <td className="px-4 py-2.5">
        <span className={cn('text-xs font-medium', proximityColor)}>
          {proximity}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-xs text-slate-400 tabular-nums">
        {timeAgo(alert.createdAt)}
      </td>
      <td className="px-4 py-2.5 text-center">
        <button
          onClick={onRemove}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Remove alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Alert checker (background price evaluation) ─────────────────────

function AlertChecker() {
  const { alerts, triggerAlert } = useAlerts();
  const activeAlerts = alerts.filter((a) => !a.triggered);

  // Get unique tickers from active alerts
  const tickers = [...new Set(activeAlerts.map((a) => a.ticker))];

  return (
    <>
      {tickers.map((ticker) => (
        <AlertTickerChecker
          key={ticker}
          ticker={ticker}
          alerts={activeAlerts.filter((a) => a.ticker === ticker)}
          onTrigger={triggerAlert}
        />
      ))}
    </>
  );
}

function AlertTickerChecker({
  ticker,
  alerts,
  onTrigger,
}: {
  ticker: string;
  alerts: any[];
  onTrigger: (id: string) => void;
}) {
  const { data } = usePrices(ticker);

  useEffect(() => {
    if (!data?.price) return;

    for (const alert of alerts) {
      let shouldTrigger = false;

      switch (alert.condition) {
        case 'above':
          shouldTrigger = data.price >= alert.value;
          break;
        case 'below':
          shouldTrigger = data.price <= alert.value;
          break;
        case 'change_up':
          shouldTrigger = (data.change_percent ?? 0) >= alert.value;
          break;
        case 'change_down':
          shouldTrigger = (data.change_percent ?? 0) <= -alert.value;
          break;
        // new_filing alerts would need filing data — skip for now
      }

      if (shouldTrigger) {
        onTrigger(alert.id);
      }
    }
  }, [data, alerts, onTrigger]);

  return null;
}

// ─── Condition icon ──────────────────────────────────────────────────

function ConditionIcon({ condition }: { condition: AlertCondition }) {
  switch (condition) {
    case 'above':
      return <ArrowUp className="h-4 w-4 text-emerald-500" />;
    case 'below':
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    case 'change_up':
      return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    case 'change_down':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'new_filing':
      return <FileText className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
}

// ─── Time formatting ─────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
