import { useState } from 'react';
import { CreditCard, Search, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatPrice, formatPercent } from '../lib/utils';
import { useMetrics } from '../hooks/useMetrics';
import { usePrices } from '../hooks/usePrices';
import { usePeers } from '../hooks/usePeers';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

function fmtMultiple(val: number | undefined): string {
  if (val == null || !isFinite(val)) return '—';
  return `${val.toFixed(1)}x`;
}

function fmtPct(val: number | undefined): string {
  if (val == null || !isFinite(val)) return '—';
  return `${val.toFixed(1)}%`;
}

function fmtNum(val: number | undefined, decimals = 2): string {
  if (val == null || !isFinite(val)) return '—';
  return val.toFixed(decimals);
}

export function ValuationPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');

  const { data: metricsResult, isLoading: metricsLoading, error: metricsError } = useMetrics(ticker);
  const { data: prices, isLoading: pricesLoading, error: pricesError } = usePrices(ticker);
  const { data: peersResult, isLoading: peersLoading } = usePeers(ticker, 6);

  const isLoading = metricsLoading || pricesLoading;
  const hasError = metricsError || pricesError;

  const selectTicker = (t: string) => {
    setTicker(t.toUpperCase());
    setTickerInput('');
  };

  // Pull latest period metrics
  const latestPeriod = metricsResult?.data?.periods?.[0];
  const valuation = latestPeriod?.metrics?.valuation ?? {};
  const profitability = latestPeriod?.metrics?.profitability ?? {};
  const perShare = latestPeriod?.metrics?.per_share ?? {};
  const growth = latestPeriod?.metrics?.growth ?? {};

  const peersData = peersResult?.data;

  // Key valuation multiples
  const valuationMetrics = [
    { label: 'P/E', key: 'pe_ratio', value: valuation['pe_ratio'] },
    { label: 'Forward P/E', key: 'forward_pe', value: valuation['forward_pe'] },
    { label: 'PEG', key: 'peg_ratio', value: valuation['peg_ratio'] },
    { label: 'P/S', key: 'ps_ratio', value: valuation['ps_ratio'] },
    { label: 'P/B', key: 'pb_ratio', value: valuation['pb_ratio'] },
    { label: 'EV/EBITDA', key: 'ev_ebitda', value: valuation['ev_ebitda'] },
    { label: 'EV/Revenue', key: 'ev_revenue', value: valuation['ev_revenue'] },
    { label: 'FCF Yield', key: 'fcf_yield', value: valuation['fcf_yield'], isPct: true },
  ];

  const profitabilityMetrics = [
    { label: 'Gross Margin', value: profitability['gross_margin'] },
    { label: 'Operating Margin', value: profitability['operating_margin'] },
    { label: 'Net Margin', value: profitability['net_margin'] },
    { label: 'ROE', value: profitability['roe'] },
    { label: 'ROA', value: profitability['roa'] },
    { label: 'ROIC', value: profitability['roic'] },
  ];

  const perShareMetrics = [
    { label: 'EPS', value: perShare['eps'] },
    { label: 'Book Value/Share', value: perShare['book_value_per_share'] },
    { label: 'FCF/Share', value: perShare['fcf_per_share'] },
    { label: 'Div/Share', value: perShare['dividends_per_share'] },
  ];

  const growthMetrics = [
    { label: 'Revenue Growth', value: growth['revenue_growth'] },
    { label: 'EPS Growth', value: growth['eps_growth'] },
    { label: 'FCF Growth', value: growth['fcf_growth'] },
  ];

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-pink-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Valuation</h1>
          <p className="text-sm text-slate-400">Multiples, profitability metrics, and peer comparison</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..."
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-pink-500 focus:outline-none"
          />
        </div>
        {QUICK_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium',
              ticker === t ? 'bg-pink-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading valuation data for {ticker}...
        </div>
      )}

      {/* Error */}
      {hasError && !isLoading && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
          Failed to load data for {ticker}. Check the ticker and try again.
        </div>
      )}

      {/* Content */}
      {!isLoading && !hasError && (
        <>
          {/* Price summary */}
          {prices && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">Current Price</div>
                <div className="mt-2 text-3xl font-bold text-white">{formatPrice(prices.price)}</div>
                <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', prices.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {prices.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {prices.change >= 0 ? '+' : ''}{prices.change.toFixed(2)} ({formatPercent(prices.change_percent)})
                </div>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">Market Cap</div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {prices.market_cap >= 1e12
                    ? `$${(prices.market_cap / 1e12).toFixed(2)}T`
                    : prices.market_cap >= 1e9
                    ? `$${(prices.market_cap / 1e9).toFixed(1)}B`
                    : `$${(prices.market_cap / 1e6).toFixed(0)}M`}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Vol: {(prices.volume / 1e6).toFixed(1)}M
                </div>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">52-Week Range</div>
                <div className="mt-2 text-sm font-bold text-white">
                  {formatPrice(prices.year_low)} – {formatPrice(prices.year_high)}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-700">
                  <div
                    className="h-1.5 rounded-full bg-pink-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((prices.price - prices.year_low) / (prices.year_high - prices.year_low)) * 100))}%`
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>Low</span><span>High</span>
                </div>
              </div>
            </div>
          )}

          {/* Valuation multiples */}
          {latestPeriod && (
            <>
              <div>
                <h2 className="mb-3 text-sm font-semibold text-white">
                  Valuation Multiples
                  <span className="ml-2 text-xs font-normal text-slate-500">Period: {latestPeriod.period_end}</span>
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {valuationMetrics.map(m => (
                    <div key={m.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</div>
                      <div className="mt-1 text-lg font-bold text-white">
                        {m.isPct ? fmtPct(m.value) : fmtMultiple(m.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Profitability */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-white">Profitability</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {profitabilityMetrics.map(m => (
                    <div key={m.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</div>
                      <div className={cn('mt-1 text-lg font-bold', m.value != null && m.value > 0 ? 'text-emerald-400' : m.value != null && m.value < 0 ? 'text-red-400' : 'text-white')}>
                        {fmtPct(m.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per Share + Growth */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-white">Per Share Metrics</h2>
                  <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-4">
                    {perShareMetrics.map(m => (
                      <div key={m.label} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{m.label}</span>
                        <span className="font-medium text-white">{m.value != null ? `$${fmtNum(m.value)}` : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-white">Growth Rates</h2>
                  <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-4">
                    {growthMetrics.map(m => (
                      <div key={m.label} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{m.label}</span>
                        <span className={cn('font-medium', m.value != null && m.value > 0 ? 'text-emerald-400' : m.value != null && m.value < 0 ? 'text-red-400' : 'text-white')}>
                          {m.value != null ? `${m.value > 0 ? '+' : ''}${fmtPct(m.value)}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* No metrics fallback */}
          {!latestPeriod && !metricsLoading && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-center text-sm text-slate-500">
              No metrics data available for {ticker}.
            </div>
          )}

          {/* Peer Comparison */}
          {peersData && peersData.peers.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Peer Comparison
                <span className="ml-2 text-xs font-normal text-slate-500">{peersData.sector}</span>
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Name</th>
                      {['pe_ratio', 'ps_ratio', 'pb_ratio', 'ev_ebitda'].map(key => {
                        const labels: Record<string, string> = { pe_ratio: 'P/E', ps_ratio: 'P/S', pb_ratio: 'P/B', ev_ebitda: 'EV/EBITDA' };
                        return (
                          <th key={key} className="px-3 py-2 text-right text-xs font-medium text-slate-400">
                            {labels[key]}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {/* Current company row */}
                    <tr className="bg-pink-500/10">
                      <td className="px-3 py-2">
                        <Link to={`/company/${ticker}`} className="font-mono text-xs font-bold text-pink-400 hover:underline">
                          {ticker}
                        </Link>
                        <span className="ml-1 text-[10px] text-slate-500">(current)</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-300">{peersData.company_name}</td>
                      {['pe_ratio', 'ps_ratio', 'pb_ratio', 'ev_ebitda'].map(key => (
                        <td key={key} className="px-3 py-2 text-right text-xs font-bold text-white">
                          {fmtMultiple(valuation[key])}
                        </td>
                      ))}
                    </tr>
                    {/* Peer rows */}
                    {peersData.peers.map(peer => (
                      <tr key={peer.ticker} className="bg-slate-800 hover:bg-slate-750">
                        <td className="px-3 py-2 font-mono text-xs font-bold text-slate-300">
                          <Link to={`/company/${peer.ticker}`} className="hover:underline">{peer.ticker}</Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400">{peer.name}</td>
                        {['pe_ratio', 'ps_ratio', 'pb_ratio', 'ev_ebitda'].map(key => {
                          const peerVal = peer.metrics[key];
                          const myVal = valuation[key];
                          const isLower = peerVal != null && myVal != null && peerVal.value < myVal;
                          return (
                            <td key={key} className={cn('px-3 py-2 text-right text-xs', peerVal != null ? (isLower ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500')}>
                              {peerVal != null ? fmtMultiple(peerVal.value) : '—'}
                              {peerVal != null && (
                                <span className="ml-1 text-[9px] text-slate-500">
                                  p{Math.round(peerVal.percentile)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">p = percentile rank within sector. Green = lower multiple than {ticker}.</p>
            </div>
          )}

          {/* Peers loading */}
          {peersLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading peer data...
            </div>
          )}
        </>
      )}
    </div>
  );
}
