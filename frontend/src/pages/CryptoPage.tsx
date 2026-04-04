import { useState, useMemo } from 'react';
import {
  Bitcoin, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Loader2, Search,
} from 'lucide-react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useCryptoQuote, useCryptoBars } from '../hooks/useCrypto';
import { formatPrice, formatCurrency } from '../lib/utils';
import { cn } from '../lib/utils';

const TOP_CRYPTOS = [
  { symbol: 'BTCUSD', name: 'Bitcoin', abbr: 'BTC' },
  { symbol: 'ETHUSD', name: 'Ethereum', abbr: 'ETH' },
  { symbol: 'SOLUSD', name: 'Solana', abbr: 'SOL' },
  { symbol: 'BNBUSD', name: 'BNB', abbr: 'BNB' },
  { symbol: 'XRPUSD', name: 'XRP', abbr: 'XRP' },
  { symbol: 'ADAUSD', name: 'Cardano', abbr: 'ADA' },
  { symbol: 'DOGEUSD', name: 'Dogecoin', abbr: 'DOGE' },
  { symbol: 'AVAXUSD', name: 'Avalanche', abbr: 'AVAX' },
  { symbol: 'DOTUSD', name: 'Polkadot', abbr: 'DOT' },
  { symbol: 'LINKUSD', name: 'Chainlink', abbr: 'LINK' },
  { symbol: 'MATICUSD', name: 'Polygon', abbr: 'MATIC' },
  { symbol: 'ATOMUSD', name: 'Cosmos', abbr: 'ATOM' },
];

const INTERVALS = [
  { label: '5m', value: '5min' as const },
  { label: '1H', value: '1hour' as const },
  { label: '1D', value: 'daily' as const },
];

export function CryptoPage() {
  const [selected, setSelected] = useState(TOP_CRYPTOS[0]);
  const [interval, setInterval] = useState<'daily' | '1hour' | '5min'>('daily');
  const [searchQuery, setSearchQuery] = useState('');

  const quote = useCryptoQuote(selected.symbol);
  const bars = useCryptoBars(selected.symbol, interval);

  const filteredCryptos = useMemo(() => {
    if (!searchQuery) return TOP_CRYPTOS;
    const q = searchQuery.toLowerCase();
    return TOP_CRYPTOS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.abbr.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bitcoin className="h-7 w-7 text-orange-500" />
            Crypto Markets
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real-time cryptocurrency quotes and charts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar: asset list */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            {/* Search */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter..."
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-300"
              />
            </div>

            {/* List */}
            <div className="max-h-[500px] overflow-y-auto">
              {filteredCryptos.map((crypto) => (
                <CryptoListItem
                  key={crypto.symbol}
                  crypto={crypto}
                  isSelected={selected.symbol === crypto.symbol}
                  onClick={() => setSelected(crypto)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Main: chart + details */}
        <div className="space-y-6 lg:col-span-3">
          {/* Quote header */}
          <QuoteHeader quote={quote.data} crypto={selected} isLoading={quote.isLoading} />

          {/* Chart */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            {/* Interval selector */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Price chart
              </h3>
              <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                {INTERVALS.map((i) => (
                  <button
                    key={i.value}
                    onClick={() => setInterval(i.value)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      interval === i.value
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    )}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            </div>

            {bars.isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : bars.data?.bars && bars.data.bars.length > 0 ? (
              <CryptoChart bars={bars.data.bars} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                No chart data available
              </div>
            )}
          </div>

          {/* Stats grid */}
          {quote.data && !quote.data.error && (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4">
              {[
                { label: 'Market Cap', value: quote.data.market_cap > 0 ? formatCurrency(quote.data.market_cap) : '—' },
                { label: '24h Volume', value: quote.data.volume > 0 ? formatCurrency(quote.data.volume) : '—' },
                { label: 'Day High', value: formatPrice(quote.data.day_high) },
                { label: 'Day Low', value: formatPrice(quote.data.day_low) },
              ].map((item) => (
                <div key={item.label} className="bg-white px-4 py-3 dark:bg-slate-900">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
                  <p className="mt-0.5 font-medium tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Market overview cards */}
          <MarketOverviewGrid />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function CryptoListItem({
  crypto,
  isSelected,
  onClick,
}: {
  crypto: typeof TOP_CRYPTOS[number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const quote = useCryptoQuote(crypto.symbol);
  const isUp = (quote.data?.change_percent ?? 0) >= 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-slate-100 dark:bg-slate-800'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{crypto.abbr}</span>
        <span className="text-xs text-slate-400">{crypto.name}</span>
      </div>
      <div className="text-right">
        {quote.isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
        ) : quote.data && !quote.data.error ? (
          <>
            <p className="text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
              {formatPrice(quote.data.price)}
            </p>
            <p className={cn(
              'text-[10px] font-medium tabular-nums',
              isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}>
              {isUp ? '+' : ''}{quote.data.change_percent?.toFixed(2)}%
            </p>
          </>
        ) : (
          <span className="text-[10px] text-slate-400">--</span>
        )}
      </div>
    </button>
  );
}

function QuoteHeader({
  quote,
  crypto,
  isLoading,
}: {
  quote?: import('../lib/types').CryptoQuote;
  crypto: typeof TOP_CRYPTOS[number];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-400">Loading {crypto.name}...</span>
      </div>
    );
  }

  if (!quote || quote.error) {
    return (
      <div>
        <h2 className="text-xl font-bold">{crypto.name}</h2>
        <p className="text-sm text-slate-400">Quote unavailable</p>
      </div>
    );
  }

  const isUp = quote.change_percent >= 0;

  return (
    <div>
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">{crypto.name}</h2>
        <span className="text-sm font-medium text-slate-400">{crypto.abbr}/USD</span>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums">{formatPrice(quote.price)}</span>
        <span className={cn(
          'flex items-center gap-0.5 text-sm font-medium',
          isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        )}>
          {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {isUp ? '+' : ''}{formatPrice(Math.abs(quote.change))} ({quote.change_percent?.toFixed(2)}%)
        </span>
        {quote.market_cap > 0 && (
          <span className="text-sm text-slate-400">{formatCurrency(quote.market_cap)} mkt cap</span>
        )}
      </div>
    </div>
  );
}

function CryptoChart({ bars }: { bars: import('../lib/types').CryptoBar[] }) {
  const data = useMemo(() => {
    return [...bars].reverse().map((b) => ({
      date: b.date.slice(0, 16),
      price: b.close,
      volume: b.volume,
    }));
  }, [bars]);

  const priceUp = data.length >= 2 ? data[data.length - 1].price >= data[0].price : true;
  const color = priceUp ? '#10b981' : '#ef4444';
  const maxVol = useMemo(() => Math.max(...data.map((d) => d.volume || 0), 1), [data]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
          <defs>
            <linearGradient id="cryptoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            yAxisId="price"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
            domain={['auto', 'auto']}
            width={70}
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
          />
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="#94a3b8"
            fillOpacity={0.12}
            radius={[1, 1, 0, 0]}
            isAnimationActive={false}
          />
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fill="url(#cryptoGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function MarketOverviewGrid() {
  // Show quick-quote cards for top 4 assets
  const btc = useCryptoQuote('BTCUSD');
  const eth = useCryptoQuote('ETHUSD');
  const sol = useCryptoQuote('SOLUSD');
  const xrp = useCryptoQuote('XRPUSD');

  const cards = [
    { name: 'Bitcoin', abbr: 'BTC', data: btc.data, loading: btc.isLoading },
    { name: 'Ethereum', abbr: 'ETH', data: eth.data, loading: eth.isLoading },
    { name: 'Solana', abbr: 'SOL', data: sol.data, loading: sol.isLoading },
    { name: 'XRP', abbr: 'XRP', data: xrp.data, loading: xrp.isLoading },
  ];

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Market overview</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => {
          const isUp = (c.data?.change_percent ?? 0) >= 0;
          return (
            <div
              key={c.abbr}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{c.abbr}</span>
                {!c.loading && c.data && !c.data.error && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-[10px] font-medium',
                    isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isUp ? '+' : ''}{c.data.change_percent?.toFixed(2)}%
                  </span>
                )}
              </div>
              <div className="mt-1">
                {c.loading ? (
                  <div className="h-5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                ) : c.data && !c.data.error ? (
                  <p className="text-lg font-bold tabular-nums">{formatPrice(c.data.price)}</p>
                ) : (
                  <p className="text-sm text-slate-400">--</p>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">{c.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
