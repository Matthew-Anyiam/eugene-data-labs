import { useState } from 'react';
import {
  Network,
  Loader2,
  AlertCircle,
  Anchor,
  ArrowRightLeft,
  Route,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePortStatus, useTradeFlows, useRouteRisk } from '../hooks/useSupplyChain';
import type { Port, TradeFlow, Chokepoint } from '../hooks/useSupplyChain';

type Tab = 'ports' | 'trade' | 'routes';

const TABS: { key: Tab; label: string; icon: typeof Anchor }[] = [
  { key: 'ports', label: 'Ports', icon: Anchor },
  { key: 'trade', label: 'Trade Flows', icon: ArrowRightLeft },
  { key: 'routes', label: 'Chokepoints', icon: Route },
];

const FLOW_OPTIONS = [
  { value: 'X', label: 'Exports' },
  { value: 'M', label: 'Imports' },
];

const REPORTER_OPTIONS = ['US', 'CN', 'DE', 'JP', 'GB', 'FR', 'KR', 'IN'];

function riskColor(score: number): string {
  if (score >= 7) return 'text-red-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-emerald-400';
}

function statusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('disrupt') || s.includes('closed')) return 'bg-red-500/20 text-red-400';
  if (s.includes('congest') || s.includes('delay') || s.includes('elevated')) return 'bg-amber-500/20 text-amber-400';
  return 'bg-emerald-500/20 text-emerald-400';
}

function fmtUSD(v: number): string {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + v.toLocaleString();
}

/* ── Ports Tab ─────────────────────────────────────── */
function PortsTab() {
  const [country, setCountry] = useState<string>('');
  const { data, isLoading, error } = usePortStatus(country || undefined);

  return (
    <div className="space-y-4">
      {/* Country filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400">Filter by country:</label>
        <input
          value={country}
          onChange={e => setCountry(e.target.value.toUpperCase())}
          placeholder="e.g. US, CN, SG"
          className="w-32 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
        />
        {country && (
          <button onClick={() => setCountry('')} className="text-xs text-slate-500 hover:text-white">
            Clear
          </button>
        )}
      </div>

      {/* Summary strip */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Ports', value: data.count, color: 'text-white' },
            { label: 'Operational', value: data.operational, color: 'text-emerald-400' },
            { label: 'Congested', value: data.congested, color: 'text-amber-400' },
            { label: 'Disrupted', value: data.disrupted, color: 'text-red-400' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
              <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
          <span className="ml-2 text-sm text-slate-400">Loading port data…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load port data: {(error as Error).message}
        </div>
      )}

      {data && data.ports.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Port</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Country</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Type</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Risk Score</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Risk Factors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.ports.map((port: Port) => (
                <tr key={port.port_code} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2">
                    <div className="text-xs font-semibold text-white">{port.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">{port.port_code}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{port.country}</td>
                  <td className="px-3 py-2 text-xs text-slate-400 capitalize">{port.type}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold capitalize', statusBadge(port.status))}>
                      {port.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn('text-xs font-bold', riskColor(port.risk_score))}>
                      {port.risk_score}/10
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(port.risk_factors || []).slice(0, 3).map((f, i) => (
                        <span key={i} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{f}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.ports.length === 0 && !isLoading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-sm text-slate-500">
          No ports found{country ? ` for country "${country}"` : ''}.
        </div>
      )}
    </div>
  );
}

/* ── Trade Flows Tab ───────────────────────────────── */
function TradeTab() {
  const [reporter, setReporter] = useState('US');
  const [flow, setFlow] = useState('X');
  const { data, isLoading, error } = useTradeFlows(reporter, undefined, flow);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Reporter:</label>
          <select
            value={reporter}
            onChange={e => setReporter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
          >
            {REPORTER_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {FLOW_OPTIONS.map(f => (
            <button
              key={f.value}
              onClick={() => setFlow(f.value)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', flow === f.value ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white')}
            >
              {f.label}
            </button>
          ))}
        </div>
        {data && (
          <span className="text-xs text-slate-500">{data.count} records</span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
          <span className="ml-2 text-sm text-slate-400">Loading trade flows…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load trade data: {(error as Error).message}
        </div>
      )}

      {data && data.records.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Reporter</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Partner</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Commodity</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Flow</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value (USD)</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Quantity</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.records.map((rec: TradeFlow, i: number) => (
                <tr key={i} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs font-medium text-white">{rec.reporter}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{rec.partner}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-slate-300">{rec.commodity}</div>
                    <div className="text-[10px] font-mono text-slate-600">{rec.commodity_code}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold',
                      rec.flow === 'X' || rec.flow.toLowerCase() === 'export'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-blue-500/20 text-blue-400')}>
                      {rec.flow === 'X' ? 'Export' : rec.flow === 'M' ? 'Import' : rec.flow}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-white">{fmtUSD(rec.value_usd)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">
                    {rec.quantity?.toLocaleString()} {rec.unit}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-500">{rec.year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.records.length === 0 && !isLoading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-sm text-slate-500">
          No trade flow records found.
        </div>
      )}
    </div>
  );
}

/* ── Routes / Chokepoints Tab ──────────────────────── */
function RoutesTab() {
  const { data, isLoading, error } = useRouteRisk();

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Chokepoints', value: data.count, color: 'text-white' },
            { label: 'Avg Risk Score', value: data.avg_risk?.toFixed(1) + '/10', color: data.avg_risk >= 6 ? 'text-red-400' : 'text-amber-400' },
            { label: 'High Risk', value: data.high_risk_count, color: 'text-red-400' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
              <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
          <span className="ml-2 text-sm text-slate-400">Loading route data…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load route data: {(error as Error).message}
        </div>
      )}

      {data && data.chokepoints.length > 0 && (
        <div className="space-y-3">
          {data.chokepoints.map((cp: Chokepoint) => (
            <div key={cp.name} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{cp.name}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold capitalize', statusBadge(cp.status))}>
                      {cp.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {cp.lat.toFixed(2)}°, {cp.lng.toFixed(2)}°
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(cp.risk_factors || []).map((f, i) => (
                      <span key={i} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{f}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-lg font-bold', riskColor(cp.risk_score))}>{cp.risk_score}/10</div>
                  <div className="text-[10px] text-slate-500">Risk Score</div>
                  <div className="mt-2 text-sm font-semibold text-sky-400">{cp.trade_share_pct?.toFixed(1)}%</div>
                  <div className="text-[10px] text-slate-500">Trade Share</div>
                </div>
              </div>
              {/* Trade share bar */}
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={cn('h-2 rounded-full', cp.risk_score >= 7 ? 'bg-red-500' : cp.risk_score >= 4 ? 'bg-amber-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, cp.trade_share_pct || 0)}%` }}
                  />
                </div>
                <div className="mt-0.5 text-[10px] text-slate-600">Trade share of global maritime traffic</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.chokepoints.length === 0 && !isLoading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-sm text-slate-500">
          No chokepoint data available.
        </div>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */
export function SupplyChainPage() {
  const [tab, setTab] = useState<Tab>('ports');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Network className="h-6 w-6 text-sky-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Supply Chain</h1>
          <p className="text-sm text-slate-400">Global port status, trade flows, and maritime chokepoint risk</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
                tab === t.key ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'ports' && <PortsTab />}
      {tab === 'trade' && <TradeTab />}
      {tab === 'routes' && <RoutesTab />}
    </div>
  );
}
