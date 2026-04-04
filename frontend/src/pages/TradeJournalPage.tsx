import { useState, useMemo, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Download, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { cn, formatPrice } from '../lib/utils';

const STORAGE_KEY = 'eugene_trade_journal';
const STRATEGIES = ['Momentum', 'Value', 'Swing', 'Scalp', 'Earnings Play', 'Other'];

interface Trade {
  id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  date: string;
  strategy: string;
  notes: string;
}

function loadTrades(): Trade[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveTrades(trades: Trade[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function pnl(t: Trade): number | null {
  if (t.exitPrice === null) return null;
  const diff = t.side === 'buy' ? t.exitPrice - t.entryPrice : t.entryPrice - t.exitPrice;
  return diff * t.quantity;
}
function pnlPct(t: Trade): number | null {
  if (t.exitPrice === null) return null;
  const diff = t.side === 'buy' ? t.exitPrice - t.entryPrice : t.entryPrice - t.exitPrice;
  return (diff / t.entryPrice) * 100;
}

export function TradeJournalPage() {
  const [trades, setTrades] = useState<Trade[]>(loadTrades);
  const [showForm, setShowForm] = useState(false);
  const [filterStrategy, setFilterStrategy] = useState('All');
  const [filterSide, setFilterSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'ticker' | 'pnl' | 'pnlPct'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  // Form state
  const [fTicker, setFTicker] = useState('');
  const [fSide, setFSide] = useState<'buy' | 'sell'>('buy');
  const [fQty, setFQty] = useState('');
  const [fEntry, setFEntry] = useState('');
  const [fExit, setFExit] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fStrategy, setFStrategy] = useState('Momentum');
  const [fNotes, setFNotes] = useState('');

  const update = useCallback((newTrades: Trade[]) => {
    setTrades(newTrades);
    saveTrades(newTrades);
  }, []);

  const addTrade = () => {
    const ticker = fTicker.trim().toUpperCase();
    if (!ticker || !fQty || !fEntry) return;
    const trade: Trade = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ticker,
      side: fSide,
      quantity: parseFloat(fQty),
      entryPrice: parseFloat(fEntry),
      exitPrice: fExit ? parseFloat(fExit) : null,
      date: fDate,
      strategy: fStrategy,
      notes: fNotes,
    };
    update([trade, ...trades]);
    setFTicker(''); setFQty(''); setFEntry(''); setFExit(''); setFNotes('');
    setShowForm(false);
  };

  const removeTrade = (id: string) => update(trades.filter(t => t.id !== id));

  const filtered = useMemo(() => {
    let list = [...trades];
    if (filterStrategy !== 'All') list = list.filter(t => t.strategy === filterStrategy);
    if (filterSide !== 'all') list = list.filter(t => t.side === filterSide);
    if (filterStatus === 'open') list = list.filter(t => t.exitPrice === null);
    if (filterStatus === 'closed') list = list.filter(t => t.exitPrice !== null);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortBy === 'ticker') cmp = a.ticker.localeCompare(b.ticker);
      else if (sortBy === 'pnl') cmp = (pnl(a) ?? -Infinity) - (pnl(b) ?? -Infinity);
      else if (sortBy === 'pnlPct') cmp = (pnlPct(a) ?? -Infinity) - (pnlPct(b) ?? -Infinity);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [trades, filterStrategy, filterSide, filterStatus, sortBy, sortDir]);

  const closed = trades.filter(t => t.exitPrice !== null);
  const wins = closed.filter(t => (pnl(t) ?? 0) > 0);
  const totalPnl = closed.reduce((s, t) => s + (pnl(t) ?? 0), 0);
  const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const best = closed.reduce((b, t) => (pnl(t) ?? 0) > (pnl(b) ?? 0) ? t : b, closed[0]);
  const worst = closed.reduce((w, t) => (pnl(t) ?? 0) < (pnl(w) ?? 0) ? t : w, closed[0]);
  const grossWins = wins.reduce((s, t) => s + (pnl(t) ?? 0), 0);
  const grossLosses = Math.abs(closed.filter(t => (pnl(t) ?? 0) < 0).reduce((s, t) => s + (pnl(t) ?? 0), 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  const strategyStats = useMemo(() => {
    const map: Record<string, { count: number; wins: number; totalPnl: number }> = {};
    closed.forEach(t => {
      const s = t.strategy;
      if (!map[s]) map[s] = { count: 0, wins: 0, totalPnl: 0 };
      map[s].count++;
      const p = pnl(t) ?? 0;
      map[s].totalPnl += p;
      if (p > 0) map[s].wins++;
    });
    return map;
  }, [closed]);

  const monthlyPnl = useMemo(() => {
    const months: Record<string, number> = {};
    closed.forEach(t => {
      const m = t.date.slice(0, 7);
      months[m] = (months[m] || 0) + (pnl(t) ?? 0);
    });
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [closed]);
  const maxAbsMonth = Math.max(...monthlyPnl.map(([, v]) => Math.abs(v)), 1);

  const exportCSV = () => {
    const headers = 'Date,Ticker,Side,Quantity,Entry,Exit,P&L,P&L%,Strategy,Notes\n';
    const rows = trades.map(t => {
      const p = pnl(t); const pp = pnlPct(t);
      return `${t.date},${t.ticker},${t.side},${t.quantity},${t.entryPrice},${t.exitPrice ?? ''},${p?.toFixed(2) ?? ''},${pp?.toFixed(2) ?? ''},${t.strategy},"${t.notes.replace(/"/g, '""')}"`;
    }).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'trade_journal.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const sortHeader = (key: typeof sortBy, label: string) => (
    <button onClick={() => { if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortDir('desc'); } }}
      className={cn('text-xs font-medium', sortBy === key ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300')}>
      {label} {sortBy === key && (sortDir === 'desc' ? '↓' : '↑')}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Trade Journal</h1>
            <p className="text-sm text-slate-400">Log trades, track performance, analyze strategies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
            <Plus className="h-3.5 w-3.5" /> Add Trade
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">New Trade</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input value={fTicker} onChange={e => setFTicker(e.target.value.toUpperCase())} placeholder="Ticker" className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
            <div className="flex gap-1">
              {(['buy', 'sell'] as const).map(s => (
                <button key={s} onClick={() => setFSide(s)} className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-medium', fSide === s ? (s === 'buy' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'border border-slate-600 bg-slate-900 text-slate-400')}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
            <input value={fQty} onChange={e => setFQty(e.target.value)} placeholder="Quantity" type="number" className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
            <input value={fEntry} onChange={e => setFEntry(e.target.value)} placeholder="Entry Price" type="number" step="0.01" className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
            <input value={fExit} onChange={e => setFExit(e.target.value)} placeholder="Exit Price (optional)" type="number" step="0.01" className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
            <input value={fDate} onChange={e => setFDate(e.target.value)} type="date" className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
            <select value={fStrategy} onChange={e => setFStrategy(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
              {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={addTrade} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">Save</button>
          </div>
          <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Total Trades', value: trades.length.toString() },
          { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Avg P&L', value: formatPrice(avgPnl), color: avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Total P&L', value: formatPrice(totalPnl), color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Best Trade', value: best ? `${formatPrice(pnl(best) ?? 0)}` : '—', color: 'text-emerald-400' },
          { label: 'Worst Trade', value: worst ? `${formatPrice(pnl(worst) ?? 0)}` : '—', color: 'text-red-400' },
          { label: 'Profit Factor', value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2), color: profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color || 'text-white')}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">
          <option value="All">All Strategies</option>
          {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-1">
          {(['all', 'buy', 'sell'] as const).map(s => (
            <button key={s} onClick={() => setFilterSide(s)} className={cn('rounded-md px-2 py-1 text-xs', filterSide === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}>
              {s === 'all' ? 'All Sides' : s.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'open', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={cn('rounded-md px-2 py-1 text-xs', filterStatus === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}>
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trades table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No trades yet. Click &quot;Add Trade&quot; to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2">{sortHeader('date', 'Date')}</th>
                <th className="px-3 py-2">{sortHeader('ticker', 'Ticker')}</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-400">Side</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-400">Qty</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-400">Entry</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-400">Exit</th>
                <th className="px-3 py-2">{sortHeader('pnl', 'P&L')}</th>
                <th className="px-3 py-2">{sortHeader('pnlPct', 'P&L %')}</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-400">Strategy</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-400">Notes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map(t => {
                const p = pnl(t); const pp = pnlPct(t);
                return (
                  <tr key={t.id} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs text-slate-300">{t.date}</td>
                    <td className="px-3 py-2 font-mono text-xs font-bold text-white">{t.ticker}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', t.side === 'buy' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400')}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">{t.quantity}</td>
                    <td className="px-3 py-2 text-xs text-slate-300">{formatPrice(t.entryPrice)}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.exitPrice !== null ? <span className="text-slate-300">{formatPrice(t.exitPrice)}</span> : <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">OPEN</span>}
                    </td>
                    <td className={cn('px-3 py-2 text-xs font-medium', p !== null ? (p >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500')}>
                      {p !== null ? formatPrice(p) : '—'}
                    </td>
                    <td className={cn('px-3 py-2 text-xs', pp !== null ? (pp >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500')}>
                      {pp !== null ? `${pp >= 0 ? '+' : ''}${pp.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">{t.strategy}</span>
                    </td>
                    <td className="max-w-[120px] px-3 py-2">
                      {t.notes && (
                        <button onClick={() => setExpandedNote(expandedNote === t.id ? null : t.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300">
                          {expandedNote === t.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {expandedNote === t.id ? t.notes : t.notes.slice(0, 20) + (t.notes.length > 20 ? '...' : '')}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeTrade(t.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Strategy breakdown + Monthly P&L */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.keys(strategyStats).length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Strategy Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(strategyStats).map(([name, stats]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2">
                  <span className="text-xs font-medium text-slate-300">{name}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">{stats.count} trades</span>
                    <span className={stats.wins / stats.count >= 0.5 ? 'text-emerald-400' : 'text-red-400'}>
                      {((stats.wins / stats.count) * 100).toFixed(0)}% win
                    </span>
                    <span className={cn('font-medium', stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatPrice(stats.totalPnl)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {monthlyPnl.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Monthly P&L</h3>
            <div className="space-y-2">
              {monthlyPnl.map(([month, val]) => (
                <div key={month} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-slate-400">{month}</span>
                  <div className="flex-1">
                    <div className="flex h-5 items-center">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-700" />
                        <div
                          className={cn('absolute top-0.5 h-4 rounded', val >= 0 ? 'left-1/2 bg-emerald-500/60' : 'bg-red-500/60')}
                          style={{
                            width: `${(Math.abs(val) / maxAbsMonth) * 50}%`,
                            ...(val < 0 ? { right: '50%' } : {}),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <span className={cn('w-20 text-right text-xs font-medium', val >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {formatPrice(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
