import { useState } from 'react';
import { GitCompareArrows, Search, TrendingUp, TrendingDown, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatPrice, formatPercent } from '../lib/utils';
import { usePeers } from '../hooks/usePeers';
import { usePrices } from '../hooks/usePrices';
import { useMetrics } from '../hooks/useMetrics';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'TSLA', 'JPM', 'AMZN'];

const COLORS = ['text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-purple-400', 'text-pink-400'];

// Metric keys to display from peers data
const PEER_METRIC_KEYS = [
  { key: 'pe_ratio', label: 'P/E', format: 'x', higherIsBetter: false },
  { key: 'ps_ratio', label: 'P/S', format: 'x', higherIsBetter: false },
  { key: 'pb_ratio', label: 'P/B', format: 'x', higherIsBetter: false },
  { key: 'ev_ebitda', label: 'EV/EBITDA', format: 'x', higherIsBetter: false },
  { key: 'gross_margin', label: 'Gross Margin', format: '%', higherIsBetter: true },
  { key: 'operating_margin', label: 'Op Margin', format: '%', higherIsBetter: true },
  { key: 'net_margin', label: 'Net Margin', format: '%', higherIsBetter: true },
  { key: 'roe', label: 'ROE', format: '%', higherIsBetter: true },
  { key: 'roa', label: 'ROA', format: '%', higherIsBetter: true },
  { key: 'revenue_growth', label: 'Rev Growth', format: '%', higherIsBetter: true },
  { key: 'eps_growth', label: 'EPS Growth', format: '%', higherIsBetter: true },
  { key: 'debt_equity', label: 'D/E', format: 'x', higherIsBetter: false },
  { key: 'current_ratio', label: 'Current Ratio', format: 'x', higherIsBetter: true },
] as const;

function fmtVal(val: number | undefined, format: string): string {
  if (val == null || !isFinite(val)) return '—';
  if (format === '%') return `${val > 0 ? '' : ''}${val.toFixed(1)}%`;
  if (format === 'x') return `${val.toFixed(1)}x`;
  return val.toFixed(2);
}

// PeerCard component removed — currently unused, can be restored if needed

// Sub-component: a single row in the peer table
function PeerMetricRow({
  metricKey,
  label,
  format,
  higherIsBetter,
  peers,
  primaryTicker,
}: {
  metricKey: string;
  label: string;
  format: string;
  higherIsBetter: boolean;
  peers: Array<{ ticker: string; metrics: Record<string, { value: number; percentile: number }> }>;
  primaryTicker: string;
}) {
  void primaryTicker; // used for future highlighting
  const values = peers.map(p => p.metrics[metricKey]?.value);
  const validValues = values.filter((v): v is number => v != null && isFinite(v));
  const best = validValues.length > 0
    ? (higherIsBetter ? Math.max(...validValues) : Math.min(...validValues))
    : null;

  return (
    <tr className="border-b border-slate-700/50 bg-slate-800 hover:bg-slate-750">
      <td className="px-3 py-2 text-xs font-medium text-slate-400 w-36">{label}</td>
      {peers.map((peer, _i) => {
        const metric = peer.metrics[metricKey];
        const val = metric?.value;
        const pct = metric?.percentile;
        const isBest = val != null && val === best;
        const isGrowth = format === '%' && (metricKey.includes('growth') || metricKey.includes('margin') || metricKey.includes('roe') || metricKey.includes('roa'));
        return (
          <td
            key={peer.ticker}
            className={cn(
              'px-3 py-2 text-right text-xs',
              isBest ? 'font-bold text-white' : 'text-slate-300'
            )}
          >
            {isBest && <span className="mr-1 text-emerald-400">★</span>}
            <span className={isGrowth && val != null ? (val >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}>
              {val != null ? fmtVal(val, format) : '—'}
            </span>
            {pct != null && (
              <span className="ml-1 text-[9px] text-slate-600">p{Math.round(pct)}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export function PeerAnalysisPage() {
  const [primaryTicker, setPrimaryTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');

  const { data: peersResult, isLoading: peersLoading, error: peersError } = usePeers(primaryTicker, 8);
  const { data: primaryPrices, isLoading: primaryPricesLoading } = usePrices(primaryTicker);
  const { data: primaryMetrics, isLoading: primaryMetricsLoading } = useMetrics(primaryTicker);

  // Tickers selected for detailed side-by-side comparison (primary + up to 4 peers)
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);

  const peersData = peersResult?.data;
  const allPeerTickers = peersData?.peers.map(p => p.ticker) ?? [];

  // Auto-select first 3 peers when data arrives and selection is empty
  const effectivePeers = selectedPeers.length > 0
    ? selectedPeers
    : allPeerTickers.slice(0, 3);

  const addPeer = (t: string) => {
    const upper = t.toUpperCase();
    if (upper && !effectivePeers.includes(upper) && effectivePeers.length < 4) {
      setSelectedPeers([...effectivePeers, upper]);
    }
    setTickerInput('');
  };

  const removePeer = (t: string) => {
    setSelectedPeers(effectivePeers.filter(p => p !== t));
  };

  const isLoading = peersLoading || primaryPricesLoading || primaryMetricsLoading;
  const hasError = peersError;

  const primaryLatestMetrics = primaryMetrics?.data?.periods?.[0]?.metrics;

  // Build primary row for the comparison table
  const primaryPeerRow = peersData
    ? {
        ticker: primaryTicker,
        name: peersData.company_name,
        metrics: (() => {
          const m: Record<string, { value: number; percentile: number }> = {};
          if (primaryLatestMetrics) {
            const val = primaryLatestMetrics.valuation ?? {};
            const prof = primaryLatestMetrics.profitability ?? {};
            const grow = primaryLatestMetrics.growth ?? {};
            const liq = primaryLatestMetrics.liquidity ?? {};
            const lev = primaryLatestMetrics.leverage ?? {};
            const allFlat: Record<string, number> = { ...val, ...prof, ...grow, ...liq, ...lev };
            for (const [k, v] of Object.entries(allFlat)) {
              m[k] = { value: v, percentile: 50 }; // percentile not available for primary in this view
            }
          }
          return m;
        })(),
      }
    : null;

  // Rows for comparison: primary + selected peers from peersData
  const comparisonRows = [
    ...(primaryPeerRow ? [primaryPeerRow] : []),
    ...(peersData?.peers.filter(p => effectivePeers.includes(p.ticker)) ?? []),
  ];

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitCompareArrows className="h-6 w-6 text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Peer Analysis</h1>
          <p className="text-sm text-slate-400">Side-by-side comparison of fundamentals, margins, and performance</p>
        </div>
      </div>

      {/* Primary ticker selector */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Primary Ticker</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={e => {
                if (e.key === 'Enter' && tickerInput) {
                  setPrimaryTicker(tickerInput.trim().toUpperCase());
                  setSelectedPeers([]);
                  setTickerInput('');
                }
              }}
              placeholder="Ticker..."
              className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {QUICK_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => { setPrimaryTicker(t); setSelectedPeers([]); }}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium',
                primaryTicker === t ? 'bg-blue-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading peer data for {primaryTicker}...
        </div>
      )}

      {/* Error */}
      {hasError && !isLoading && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
          Failed to load peer data for {primaryTicker}.
        </div>
      )}

      {!isLoading && !hasError && peersData && (
        <>
          {/* Primary company summary */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <Link to={`/company/${primaryTicker}`} className="font-mono text-lg font-bold text-blue-400 hover:underline">
                  {primaryTicker}
                </Link>
                <p className="text-sm text-slate-300">{peersData.company_name}</p>
                <p className="text-xs text-slate-500">{peersData.sector}</p>
              </div>
              {primaryPrices && (
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-white">{formatPrice(primaryPrices.price)}</span>
                  <span className={cn('text-sm font-medium', primaryPrices.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {primaryPrices.change >= 0 ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
                    {primaryPrices.change >= 0 ? '+' : ''}{primaryPrices.change.toFixed(2)} ({formatPercent(primaryPrices.change_percent)})
                  </span>
                  <span className="text-xs text-slate-500">
                    Cap: {primaryPrices.market_cap >= 1e12 ? `$${(primaryPrices.market_cap / 1e12).toFixed(1)}T` : `$${(primaryPrices.market_cap / 1e9).toFixed(0)}B`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Peers overview cards */}
          {peersData.peers.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Peers ({peersData.peers.length} found)
                </p>
                <p className="text-[10px] text-slate-600">Click to add/remove from comparison table below</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {peersData.peers.map((peer) => {
                  const isSelected = effectivePeers.includes(peer.ticker);
                  return (
                    <button
                      key={peer.ticker}
                      onClick={() => isSelected ? removePeer(peer.ticker) : addPeer(peer.ticker)}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition',
                        isSelected
                          ? 'border-blue-500/40 bg-blue-500/15'
                          : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/company/${peer.ticker}`}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-xs font-bold text-slate-200 hover:underline"
                        >
                          {peer.ticker}
                        </Link>
                        {isSelected && <span className="text-[9px] text-blue-400">✓ comparing</span>}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">{peer.name}</div>
                      {peer.metrics['pe_ratio'] != null && (
                        <div className="mt-1 text-[10px] text-slate-400">
                          P/E: {fmtVal(peer.metrics['pe_ratio'].value, 'x')}
                          <span className="ml-1 text-[9px] text-slate-600">p{Math.round(peer.metrics['pe_ratio'].percentile)}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Side-by-side comparison table */}
          {comparisonRows.length > 1 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Side-by-Side Comparison
                  <span className="ml-2 text-xs font-normal text-slate-500">★ = best in class</span>
                </h2>
                <div className="flex gap-2">
                  {comparisonRows.map((row, i) => (
                    <div key={row.ticker} className="flex items-center gap-1">
                      <span className={cn('font-mono text-xs font-bold', COLORS[i % COLORS.length])}>{row.ticker}</span>
                      {i > 0 && (
                        <button
                          onClick={() => removePeer(row.ticker)}
                          className="text-slate-600 hover:text-slate-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-36">Metric</th>
                      {comparisonRows.map((row, i) => (
                        <th key={row.ticker} className={cn('px-3 py-2 text-right text-xs font-bold', COLORS[i % COLORS.length])}>
                          {row.ticker}
                          {i === 0 && <span className="ml-1 text-[9px] font-normal text-slate-500">(primary)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PEER_METRIC_KEYS.map(m => (
                      <PeerMetricRow
                        key={m.key}
                        metricKey={m.key}
                        label={m.label}
                        format={m.format}
                        higherIsBetter={m.higherIsBetter}
                        peers={comparisonRows}
                        primaryTicker={primaryTicker}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">
                p = percentile rank within {peersData.sector} sector. ★ = best metric among compared companies.
              </p>
            </div>
          )}

          {/* Percentile rankings visualization */}
          {peersData.peers.length > 0 && (() => {
            const marginKeys = ['gross_margin', 'operating_margin', 'net_margin'];
            const marginLabels: Record<string, string> = {
              gross_margin: 'Gross Margin',
              operating_margin: 'Operating Margin',
              net_margin: 'Net Margin',
            };
            return (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white">Percentile Rankings (Sector)</h3>
                <div className="space-y-4">
                  {marginKeys.map(key => (
                    <div key={key}>
                      <p className="mb-2 text-xs text-slate-500">{marginLabels[key]}</p>
                      <div className="space-y-1.5">
                        {/* Primary */}
                        {primaryPeerRow?.metrics[key] && (
                          <div className="flex items-center gap-2">
                            <span className="w-14 font-mono text-[10px] font-bold text-blue-400">{primaryTicker}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-700">
                              <div
                                className="h-2 rounded-full bg-blue-500 opacity-70"
                                style={{ width: `${Math.min(100, Math.max(0, primaryPeerRow.metrics[key].percentile))}%` }}
                              />
                            </div>
                            <span className="w-16 text-right text-[10px] text-slate-400">
                              {fmtVal(primaryPeerRow.metrics[key].value, '%')}
                              <span className="ml-1 text-slate-600">p{Math.round(primaryPeerRow.metrics[key].percentile)}</span>
                            </span>
                          </div>
                        )}
                        {/* Peers */}
                        {peersData.peers.filter(p => effectivePeers.includes(p.ticker)).map((peer, i) => {
                          const m = peer.metrics[key];
                          if (!m) return null;
                          const bgColors = ['bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];
                          const textColors = ['text-emerald-400', 'text-amber-400', 'text-purple-400', 'text-pink-400'];
                          return (
                            <div key={peer.ticker} className="flex items-center gap-2">
                              <span className={cn('w-14 font-mono text-[10px] font-bold', textColors[i % textColors.length])}>
                                {peer.ticker}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-slate-700">
                                <div
                                  className={cn('h-2 rounded-full opacity-70', bgColors[i % bgColors.length])}
                                  style={{ width: `${Math.min(100, Math.max(0, m.percentile))}%` }}
                                />
                              </div>
                              <span className="w-16 text-right text-[10px] text-slate-400">
                                {fmtVal(m.value, '%')}
                                <span className="ml-1 text-slate-600">p{Math.round(m.percentile)}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* No peers found */}
          {peersData.peers.length === 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-center text-sm text-slate-500">
              No peer data available for {primaryTicker}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
