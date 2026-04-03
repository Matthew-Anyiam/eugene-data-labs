import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react';
import { cn, formatPrice } from '../lib/utils';

type TimeFilter = 'today' | '1W' | '1M';
type TradeSide = 'Buy' | 'Sell' | 'Unknown';
type TradeType = 'Block' | 'Sweep' | 'Cross';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'SPY', 'QQQ'];

const TOP_TICKERS = [
  'AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'SPY', 'QQQ',
  'META', 'AMD', 'NFLX', 'JPM', 'BAC', 'V', 'UNH', 'AVGO', 'CRM', 'INTC', 'DIS', 'PYPL',
];

const EXCHANGES = ['FINRA ADF', 'IEX', 'NASDAQ PSX', 'NYSE Arca', 'BATS BZX', 'EDGX'];
const TRADE_TYPES: TradeType[] = ['Block', 'Sweep', 'Cross'];
const SIDES: TradeSide[] = ['Buy', 'Sell', 'Unknown'];

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

function fmtShares(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDollar(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface BlockTrade {
  time: string;
  size: number;
  price: number;
  value: number;
  type: TradeType;
  side: TradeSide;
  exchange: string;
}

interface TopTicker {
  ticker: string;
  dpVolume: number;
  pctTotal: number;
  sentiment: number;
  blockCount: number;
  unusual: boolean;
}

function generateBlockTrades(ticker: string, timeFilter: TimeFilter): BlockTrade[] {
  const s = seed(ticker + timeFilter);
  const count = timeFilter === 'today' ? 15 : timeFilter === '1W' ? 25 : 30;
  const basePrice = 50 + pseudo(s, 0) * 400;
  const trades: BlockTrade[] = [];
  for (let i = 0; i < count; i++) {
    const p = pseudo(s, i + 1);
    const size = Math.floor(10000 + p * 490000);
    const price = basePrice * (0.97 + pseudo(s, i + 100) * 0.06);
    const hour = 9 + Math.floor(pseudo(s, i + 200) * 7);
    const min = Math.floor(pseudo(s, i + 300) * 60);
    trades.push({
      time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
      size,
      price,
      value: size * price,
      type: TRADE_TYPES[Math.floor(pseudo(s, i + 400) * 3)],
      side: SIDES[Math.floor(pseudo(s, i + 500) * 3)],
      exchange: EXCHANGES[Math.floor(pseudo(s, i + 600) * EXCHANGES.length)],
    });
  }
  return trades.sort((a, b) => b.time.localeCompare(a.time));
}

function generateTopTickers(timeFilter: TimeFilter): TopTicker[] {
  return TOP_TICKERS.map((ticker, idx) => {
    const s = seed(ticker + timeFilter + 'top');
    const dpVolume = Math.floor(1e6 + pseudo(s, idx) * 49e6);
    const pctTotal = 20 + pseudo(s, idx + 10) * 45;
    const sentiment = pseudo(s, idx + 20) * 2 - 1;
    const blockCount = Math.floor(5 + pseudo(s, idx + 30) * 95);
    const unusual = pseudo(s, idx + 40) > 0.7;
    return { ticker, dpVolume, pctTotal, sentiment, blockCount, unusual };
  }).sort((a, b) => b.dpVolume - a.dpVolume);
}

function generateDailyVolumes(ticker: string): { day: string; dp: number; lit: number }[] {
  const s = seed(ticker + 'daily');
  const days: { day: string; dp: number; lit: number }[] = [];
  for (let i = 9; i >= 0; i--) {
    const dp = Math.floor(2e6 + pseudo(s, i) * 18e6);
    const lit = Math.floor(5e6 + pseudo(s, i + 50) * 35e6);
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, dp, lit });
  }
  return days;
}

export function DarkPoolPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [inputValue, setInputValue] = useState('AAPL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

  const blockTrades = useMemo(() => generateBlockTrades(ticker, timeFilter), [ticker, timeFilter]);
  const topTickers = useMemo(() => generateTopTickers(timeFilter), [timeFilter]);
  const dailyVolumes = useMemo(() => generateDailyVolumes(ticker), [ticker]);

  const summary = useMemo(() => {
    const s = seed(ticker + timeFilter);
    const dpVolume = Math.floor(5e6 + pseudo(s, 0) * 45e6);
    const dpPct = 25 + pseudo(s, 1) * 40;
    const blockCount = blockTrades.filter((t) => t.size > 10000).length;
    const avgBlock = blockTrades.length > 0
      ? Math.floor(blockTrades.reduce((sum, t) => sum + t.size, 0) / blockTrades.length)
      : 0;
    const buys = blockTrades.filter((t) => t.side === 'Buy').length;
    const sells = blockTrades.filter((t) => t.side === 'Sell').length;
    const sentiment = buys - sells;
    return { dpVolume, dpPct, blockCount, avgBlock, sentiment, buys, sells };
  }, [ticker, timeFilter, blockTrades]);

  const sentimentData = useMemo(() => {
    const buys = blockTrades.filter((t) => t.side === 'Buy').length;
    const sells = blockTrades.filter((t) => t.side === 'Sell').length;
    const neutral = blockTrades.filter((t) => t.side === 'Unknown').length;
    const total = blockTrades.length || 1;
    return {
      buyPct: (buys / total) * 100,
      sellPct: (sells / total) * 100,
      neutralPct: (neutral / total) * 100,
    };
  }, [blockTrades]);

  const maxDailyTotal = Math.max(...dailyVolumes.map((d) => d.dp + d.lit));

  const handleSubmit = () => {
    const v = inputValue.trim().toUpperCase();
    if (v) setTicker(v);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <EyeOff className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Dark Pool Activity</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Off-exchange and dark pool trading data for institutional order flow analysis.
          Track block trades, sweep orders, and net sentiment across venues.
        </p>
      </div>

      {/* Ticker input + time filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Enter ticker..."
            className="bg-slate-800 border border-slate-700 text-white px-3 py-1.5 rounded text-sm w-32 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded text-sm"
          >
            Go
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInputValue(t); }}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                ticker === t ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {(['today', '1W', '1M'] as TimeFilter[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium',
                timeFilter === tf ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
              )}
            >
              {tf === 'today' ? 'Today' : tf}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Dark Pool Volume', value: fmtShares(summary.dpVolume), sub: ticker },
          { label: 'DP % of Total', value: `${summary.dpPct.toFixed(1)}%`, sub: 'of total volume' },
          { label: 'Block Trades', value: summary.blockCount.toString(), sub: '>10K shares' },
          { label: 'Avg Block Size', value: fmtShares(summary.avgBlock), sub: 'shares/trade' },
          {
            label: 'Net Sentiment',
            value: summary.sentiment > 0 ? 'Bullish' : summary.sentiment < 0 ? 'Bearish' : 'Neutral',
            sub: `${summary.buys}B / ${summary.sells}S`,
            sentimentColor: summary.sentiment > 0 ? 'text-emerald-400' : summary.sentiment < 0 ? 'text-red-400' : 'text-slate-400',
          },
        ].map((card) => (
          <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">{card.label}</p>
            <p className={cn('text-lg font-bold', card.sentimentColor || 'text-white')}>{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Block trades table */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Recent Block Trades - {ticker}</h2>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 sticky top-0">
                <tr className="text-slate-400">
                  <th className="text-left px-3 py-2 font-medium">Time</th>
                  <th className="text-right px-3 py-2 font-medium">Size</th>
                  <th className="text-right px-3 py-2 font-medium">Price</th>
                  <th className="text-right px-3 py-2 font-medium">Value</th>
                  <th className="text-center px-3 py-2 font-medium">Type</th>
                  <th className="text-center px-3 py-2 font-medium">Side</th>
                  <th className="text-left px-3 py-2 font-medium">Exchange</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {blockTrades.map((trade, i) => (
                  <tr key={i} className="hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-slate-300">{trade.time}</td>
                    <td className="px-3 py-2 text-right text-white font-mono">{fmtShares(trade.size)}</td>
                    <td className="px-3 py-2 text-right text-white font-mono">{formatPrice(trade.price)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{fmtDollar(trade.value)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        trade.type === 'Block' && 'bg-blue-500/20 text-blue-400',
                        trade.type === 'Sweep' && 'bg-amber-500/20 text-amber-400',
                        trade.type === 'Cross' && 'bg-purple-500/20 text-purple-400',
                      )}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        'font-medium',
                        trade.side === 'Buy' && 'text-emerald-400',
                        trade.side === 'Sell' && 'text-red-400',
                        trade.side === 'Unknown' && 'text-slate-500',
                      )}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{trade.exchange}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sentiment distribution */}
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Sentiment Distribution - {ticker}</h2>
            <div className="flex h-4 rounded overflow-hidden mb-3">
              <div className="bg-emerald-500" style={{ width: `${sentimentData.buyPct}%` }} />
              <div className="bg-slate-500" style={{ width: `${sentimentData.neutralPct}%` }} />
              <div className="bg-red-500" style={{ width: `${sentimentData.sellPct}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Buy {sentimentData.buyPct.toFixed(0)}%</span>
              </div>
              <span className="text-slate-400">Neutral {sentimentData.neutralPct.toFixed(0)}%</span>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3 w-3 text-red-400" />
                <span className="text-red-400">Sell {sentimentData.sellPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Dark pool volume chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-white mb-3">DP vs Lit Volume (10D) - {ticker}</h2>
            <div className="space-y-1.5">
              {dailyVolumes.map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-[10px]">
                  <span className="w-8 text-slate-500 text-right">{d.day}</span>
                  <div className="flex-1 flex h-3 rounded overflow-hidden bg-slate-700/50">
                    <div
                      className="bg-purple-500"
                      style={{ width: `${(d.dp / maxDailyTotal) * 100}%` }}
                      title={`DP: ${fmtShares(d.dp)}`}
                    />
                    <div
                      className="bg-slate-500"
                      style={{ width: `${(d.lit / maxDailyTotal) * 100}%` }}
                      title={`Lit: ${fmtShares(d.lit)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded bg-purple-500" />
                Dark Pool
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded bg-slate-500" />
                Lit Exchange
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top dark pool tickers */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">Top Dark Pool Tickers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900">
              <tr className="text-slate-400">
                <th className="text-left px-3 py-2 font-medium">Ticker</th>
                <th className="text-right px-3 py-2 font-medium">DP Volume</th>
                <th className="text-right px-3 py-2 font-medium">% of Total</th>
                <th className="text-center px-3 py-2 font-medium">Net Sentiment</th>
                <th className="text-right px-3 py-2 font-medium">Block Count</th>
                <th className="text-center px-3 py-2 font-medium">Unusual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {topTickers.map((row) => (
                <tr key={row.ticker} className="hover:bg-slate-700/30">
                  <td className="px-3 py-2">
                    <Link to={`/company/${row.ticker}`} className="text-purple-400 hover:text-purple-300 font-medium">
                      {row.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right text-white font-mono">{fmtShares(row.dpVolume)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{row.pctTotal.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn(
                      'inline-flex items-center gap-1 font-medium',
                      row.sentiment > 0.2 && 'text-emerald-400',
                      row.sentiment < -0.2 && 'text-red-400',
                      row.sentiment >= -0.2 && row.sentiment <= 0.2 && 'text-slate-400',
                    )}>
                      {row.sentiment > 0.2 ? <TrendingUp className="h-3 w-3" /> : row.sentiment < -0.2 ? <TrendingDown className="h-3 w-3" /> : null}
                      {row.sentiment > 0.2 ? 'Bullish' : row.sentiment < -0.2 ? 'Bearish' : 'Neutral'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{row.blockCount}</td>
                  <td className="px-3 py-2 text-center">
                    {row.unusual && (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-[10px] font-medium">Yes</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
