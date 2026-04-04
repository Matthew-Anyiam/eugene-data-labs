import { useState } from 'react';
import { UserCheck, TrendingUp, TrendingDown, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useInsiders } from '../hooks/useInsiders';

const TICKERS = [
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'META', name: 'Meta' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'JPM', name: 'JPMorgan' },
];

function signalColor(signal: string): string {
  const s = signal.toLowerCase();
  if (s.includes('strong buy') || s === 'bullish') return 'bg-emerald-500/20 text-emerald-400';
  if (s.includes('buy')) return 'bg-green-500/20 text-green-400';
  if (s.includes('neutral')) return 'bg-slate-500/20 text-slate-400';
  if (s.includes('strong sell') || s === 'bearish') return 'bg-red-500/20 text-red-400';
  if (s.includes('sell')) return 'bg-orange-500/20 text-orange-400';
  return 'bg-slate-500/20 text-slate-300';
}

function scoreColor(score: number): string {
  if (score >= 60) return 'text-emerald-400';
  if (score >= 20) return 'text-green-400';
  if (score >= -20) return 'text-slate-300';
  if (score >= -60) return 'text-orange-400';
  return 'text-red-400';
}

function formatValue(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/** Half-arc SVG gauge for a score in [-100, 100] */
function SentimentGauge({ score }: { score: number }) {
  const clamped = Math.max(-100, Math.min(100, score));
  // Map [-100,100] -> [180,0] degrees (left = bearish, right = bullish)
  const angleDeg = 180 - ((clamped + 100) / 200) * 180;
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 60;
  const cy = 56;
  const r = 44;
  const nx = cx + r * Math.cos(rad);
  const ny = cy - r * Math.sin(rad);

  const color =
    clamped >= 20
      ? '#34d399' // emerald
      : clamped >= -20
      ? '#94a3b8' // slate
      : '#f87171'; // red

  return (
    <svg viewBox="0 0 120 64" className="w-full max-w-[160px]">
      {/* Background arc */}
      <path d="M 16 56 A 44 44 0 0 1 104 56" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
      {/* Colored fill arc */}
      {clamped !== 0 && (() => {
        void 0; // startAngle and needleRad unused — kept for reference
        // We'll draw from neutral (top = 90deg) to needle position
        const neutralRad = Math.PI / 2; // 90deg
        void rad;
        // Determine sweep
        const large = Math.abs(clamped) > 50 ? 1 : 0;
        const sweep = clamped > 0 ? 1 : 0; // clockwise = towards right = bullish

        // Start from neutral top
        const sx = cx + r * Math.cos(neutralRad);
        const sy = cy - r * Math.sin(neutralRad);

        return (
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${nx} ${ny}`}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.8"
          />
        );
      })()}
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4" fill={color} />
      {/* Labels */}
      <text x="12" y="68" fontSize="7" fill="#64748b">Bear</text>
      <text x="94" y="68" fontSize="7" fill="#64748b">Bull</text>
    </svg>
  );
}

function TickerSentimentCard({
  ticker,
  name,
  isSelected,
  onSelect,
}: {
  ticker: string;
  name: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: result, isLoading, error } = useInsiders(ticker);
  const insidersData = result?.data;
  const sentiment = insidersData?.sentiment;
  const summary = insidersData?.summary;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'rounded-xl border p-4 text-left transition-all',
        isSelected
          ? 'border-green-500 bg-green-900/10'
          : 'border-slate-700 bg-slate-800 hover:border-slate-500',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-sm font-bold text-green-400">{ticker}</div>
          <div className="text-[10px] text-slate-500">{name}</div>
        </div>
        {!isLoading && !error && sentiment && (
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', signalColor(sentiment.signal))}>
            {sentiment.signal}
          </span>
        )}
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
        {error && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
      </div>

      {!isLoading && !error && sentiment ? (
        <>
          <div className="flex justify-center">
            <SentimentGauge score={sentiment.score} />
          </div>
          <div className="mt-2 text-center">
            <span className={cn('text-lg font-bold', scoreColor(sentiment.score))}>
              {sentiment.score >= 0 ? '+' : ''}{sentiment.score.toFixed(0)}
            </span>
          </div>
          <div className="mt-2 flex justify-between text-[10px]">
            <span className="text-emerald-400">{formatValue(sentiment.buy_value)}</span>
            <span className={cn('font-medium', summary?.net_direction?.toLowerCase() === 'buying' ? 'text-emerald-400' : 'text-red-400')}>
              {summary?.net_direction ?? ''}
            </span>
            <span className="text-red-400">{formatValue(sentiment.sell_value)}</span>
          </div>
        </>
      ) : isLoading ? (
        <div className="py-4 text-center text-xs text-slate-500">Loading…</div>
      ) : (
        <div className="py-4 text-center text-xs text-slate-500">No data</div>
      )}
    </button>
  );
}

export function InsiderSentimentPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');

  const { data: result, isLoading, error, refetch } = useInsiders(selectedTicker);
  const insidersData = result?.data;
  const sentiment = insidersData?.sentiment;
  const summary = insidersData?.summary;

  const selectedName = TICKERS.find(t => t.ticker === selectedTicker)?.name ?? selectedTicker;

  // Build detail rows from flattened transactions
  const allTxns = insidersData?.insider_filings.flatMap(f =>
    f.transactions.map(tx => ({ ...tx, owner: f.owner })),
  ) ?? [];

  const totalBuy = summary?.total_purchases ?? allTxns.filter(t => t.direction?.toLowerCase() === 'buy').length;
  const totalSell = summary?.total_sales ?? allTxns.filter(t => t.direction?.toLowerCase() === 'sell').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-green-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Insider Sentiment</h1>
          <p className="text-sm text-slate-400">Insider buy/sell signals from SEC Form 4 filings</p>
        </div>
      </div>

      {/* Ticker grid — each card fetches its own data */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {TICKERS.map(({ ticker, name }) => (
          <TickerSentimentCard
            key={ticker}
            ticker={ticker}
            name={name}
            isSelected={selectedTicker === ticker}
            onSelect={() => setSelectedTicker(ticker)}
          />
        ))}
      </div>

      {/* Selected ticker detail */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {selectedTicker} — {selectedName}
            </h2>
            <p className="text-xs text-slate-500">Detailed insider sentiment breakdown</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading {selectedTicker} sentiment…</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">Failed to load insider sentiment for {selectedTicker}.</span>
          </div>
        )}

        {!isLoading && !error && sentiment && (
          <>
            {/* Main sentiment metrics */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Score + Gauge */}
              <div className="col-span-full sm:col-span-1 lg:col-span-1 flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Sentiment Score</div>
                <SentimentGauge score={sentiment.score} />
                <div className={cn('mt-1 text-2xl font-bold', scoreColor(sentiment.score))}>
                  {sentiment.score >= 0 ? '+' : ''}{sentiment.score.toFixed(0)}
                </div>
                <span className={cn('mt-1 rounded px-2 py-0.5 text-[10px] font-bold', signalColor(sentiment.signal))}>
                  {sentiment.signal}
                </span>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Buy Value</div>
                <div className="mt-1 text-xl font-bold text-emerald-400">{formatValue(sentiment.buy_value)}</div>
                <div className="mt-1 text-xs text-slate-500">{totalBuy} purchase{totalBuy !== 1 ? 's' : ''}</div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Sell Value</div>
                <div className="mt-1 text-xl font-bold text-red-400">{formatValue(sentiment.sell_value)}</div>
                <div className="mt-1 text-xs text-slate-500">{totalSell} sale{totalSell !== 1 ? 's' : ''}</div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Net Value</div>
                <div className={cn('mt-1 text-xl font-bold', (sentiment.net_value ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {sentiment.net_value != null
                    ? `${sentiment.net_value >= 0 ? '+' : ''}${formatValue(Math.abs(sentiment.net_value))}`
                    : '—'}
                </div>
                <div className="mt-1 text-xs text-slate-500">Net flow</div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Net Direction</div>
                <div
                  className={cn(
                    'mt-1 text-xl font-bold',
                    summary?.net_direction?.toLowerCase() === 'buying' ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {summary?.net_direction ?? '—'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {insidersData.count} filing{insidersData.count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Buy vs Sell bar */}
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-2 text-sm font-semibold text-white">Buy vs Sell Value</h3>
              {(sentiment.buy_value + sentiment.sell_value) > 0 ? (
                <>
                  <div className="flex h-6 overflow-hidden rounded-full">
                    <div
                      className="bg-emerald-500/60 transition-all"
                      style={{
                        width: `${(sentiment.buy_value / (sentiment.buy_value + sentiment.sell_value)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500/60 transition-all"
                      style={{
                        width: `${(sentiment.sell_value / (sentiment.buy_value + sentiment.sell_value)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      Buys: {formatValue(sentiment.buy_value)}
                    </span>
                    <span className="flex items-center gap-1 text-red-400">
                      <TrendingDown className="h-3 w-3" />
                      Sells: {formatValue(sentiment.sell_value)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">No value data available.</p>
              )}
            </div>

            {/* Recent filings breakdown */}
            {insidersData.insider_filings.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Filed</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Owner</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Title</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Form</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Txns</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Net Dir.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {insidersData.insider_filings.slice(0, 15).map((filing, i) => {
                      const buys = filing.transactions.filter(t => t.direction?.toLowerCase() === 'buy').length;
                      const sells = filing.transactions.filter(t => t.direction?.toLowerCase() === 'sell').length;
                      const net = buys > sells ? 'Buy' : sells > buys ? 'Sell' : 'Mixed';
                      return (
                        <tr key={i} className="bg-slate-800 hover:bg-slate-750">
                          <td className="px-3 py-2 text-xs text-slate-400">{filing.filed_date}</td>
                          <td className="px-3 py-2 text-xs text-white">{filing.owner.name}</td>
                          <td className="px-3 py-2 text-xs text-slate-400 max-w-[140px] truncate" title={filing.owner.title}>
                            {filing.owner.title || (filing.owner.is_director ? 'Director' : filing.owner.is_officer ? 'Officer' : '—')}
                          </td>
                          <td className="px-3 py-2 text-center text-xs font-mono text-indigo-400">{filing.form}</td>
                          <td className="px-3 py-2 text-right text-xs text-slate-300">{filing.transactions.length}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                net === 'Buy'
                                  ? 'bg-emerald-900/40 text-emerald-400'
                                  : net === 'Sell'
                                  ? 'bg-red-900/40 text-red-400'
                                  : 'bg-slate-700 text-slate-300',
                              )}
                            >
                              {net}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!isLoading && !error && !sentiment && (
          <p className="py-8 text-center text-sm text-slate-500">No sentiment data available for {selectedTicker}.</p>
        )}
      </div>
    </div>
  );
}
