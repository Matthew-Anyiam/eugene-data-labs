import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  AlertTriangle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn, formatPrice, formatPercent } from '../lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Source = 'all' | 'reddit' | 'twitter' | 'stocktwits' | 'discord' | 'tiktok';
type TimeRange = '1h' | '4h' | '24h' | '7d';
type ViewMode = 'grid' | 'list';
type TrendTag = 'viral' | 'rising' | 'new' | 'fading';

interface TrendingStock {
  rank: number;
  ticker: string;
  name: string;
  mentions: number;
  mentionsTrend: number[];
  sentiment: number;
  bullish: number;
  price: number;
  change: number;
  volumeMultiplier: number;
  tag: TrendTag;
  rankChange: number; // positive = moved up, negative = moved down, 0 = new
  platformBreakdown: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOURCES: { key: Source; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reddit', label: 'Reddit (WSB)' },
  { key: 'twitter', label: 'Twitter/X' },
  { key: 'stocktwits', label: 'StockTwits' },
  { key: 'discord', label: 'Discord' },
  { key: 'tiktok', label: 'TikTok' },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '1h', label: '1H' },
  { key: '4h', label: '4H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
];

const TICKERS = [
  'NVDA', 'GME', 'TSLA', 'AAPL', 'AMC', 'PLTR', 'AMD', 'SOFI',
  'AMZN', 'META', 'MSFT', 'RIVN', 'COIN', 'MARA', 'SMCI',
  'ARM', 'GOOGL', 'IONQ', 'RKLB', 'MSTR', 'HOOD', 'LCID',
  'NIO', 'BBBY', 'SPCE',
];

const NAMES: Record<string, string> = {
  NVDA: 'NVIDIA Corp', GME: 'GameStop', TSLA: 'Tesla Inc', AAPL: 'Apple Inc',
  AMC: 'AMC Entertainment', PLTR: 'Palantir', AMD: 'AMD Inc', SOFI: 'SoFi Technologies',
  AMZN: 'Amazon.com', META: 'Meta Platforms', MSFT: 'Microsoft', RIVN: 'Rivian',
  COIN: 'Coinbase', MARA: 'Marathon Digital', SMCI: 'Super Micro Computer',
  ARM: 'Arm Holdings', GOOGL: 'Alphabet Inc', IONQ: 'IonQ Inc', RKLB: 'Rocket Lab',
  MSTR: 'MicroStrategy', HOOD: 'Robinhood', LCID: 'Lucid Group',
  NIO: 'NIO Inc', BBBY: 'Bed Bath & Beyond', SPCE: 'Virgin Galactic',
};

const KEYWORDS = [
  '#YOLO', 'diamond hands', 'to the moon', 'short squeeze', '#AI',
  'earnings beat', 'buy the dip', 'HODL', '#EV', 'breakout',
  'bull flag', 'options flow', '#memestock', 'gamma squeeze', 'FDA approval',
  '#fintwit', 'insider buying', 'dark pool', 'whale alert', 'momentum',
];

const TAG_CONFIG: Record<TrendTag, { emoji: string; label: string; color: string }> = {
  viral: { emoji: '\uD83D\uDD25', label: 'Viral', color: 'text-orange-400' },
  rising: { emoji: '\u2B06\uFE0F', label: 'Rising', color: 'text-green-400' },
  new: { emoji: '\uD83C\uDD95', label: 'New', color: 'text-blue-400' },
  fading: { emoji: '\u2B07\uFE0F', label: 'Fading', color: 'text-slate-500' },
};

/* ------------------------------------------------------------------ */
/*  Deterministic RNG                                                  */
/* ------------------------------------------------------------------ */

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

/* ------------------------------------------------------------------ */
/*  Mock data generator                                                */
/* ------------------------------------------------------------------ */

function generateTrending(source: Source, timeRange: TimeRange): TrendingStock[] {
  const key = `${source}-${timeRange}`;
  const s = seed(key);
  const tags: TrendTag[] = ['viral', 'rising', 'new', 'fading'];

  return TICKERS.map((ticker, idx) => {
    const ts = seed(ticker + key);
    const base = pseudo(ts, 0);
    const mentions = Math.round(200 + base * 48000);
    const trend = Array.from({ length: 8 }, (_, j) =>
      Math.round(mentions * (0.3 + pseudo(ts, j + 10) * 0.7))
    );
    const sentiment = Math.round(pseudo(ts, 1) * 200 - 100);
    const bullish = Math.round(50 + pseudo(ts, 2) * 40 - 10);
    const price = Math.round((20 + pseudo(ts, 3) * 600) * 100) / 100;
    const change = Math.round((pseudo(ts, 4) * 20 - 8) * 100) / 100;
    const volMult = Math.round((0.5 + pseudo(ts, 5) * 6) * 10) / 10;
    const tagIdx = Math.floor(pseudo(s, idx) * 4);
    const rankDelta = idx < 3 ? 0 : Math.round(pseudo(ts, 6) * 10 - 4);
    const platforms: Record<string, number> = {
      reddit: Math.round(mentions * pseudo(ts, 20) * 0.4),
      twitter: Math.round(mentions * pseudo(ts, 21) * 0.35),
      stocktwits: Math.round(mentions * pseudo(ts, 22) * 0.2),
      discord: Math.round(mentions * pseudo(ts, 23) * 0.15),
      tiktok: Math.round(mentions * pseudo(ts, 24) * 0.1),
    };

    return {
      rank: idx + 1,
      ticker,
      name: NAMES[ticker],
      mentions,
      mentionsTrend: trend,
      sentiment,
      bullish: Math.min(95, Math.max(5, bullish)),
      price,
      change,
      volumeMultiplier: volMult,
      tag: tags[tagIdx],
      rankChange: rankDelta,
      platformBreakdown: platforms,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SentimentBar({ value }: { value: number }) {
  const pct = ((value + 100) / 200) * 100;
  const color = value > 30 ? 'bg-green-500' : value > 0 ? 'bg-green-700' : value > -30 ? 'bg-red-700' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs tabular-nums', value > 0 ? 'text-green-400' : 'text-red-400')}>
        {value > 0 ? '+' : ''}{value}
      </span>
    </div>
  );
}

function MiniTrendBars({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px h-4">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-1.5 bg-blue-500/70 rounded-sm"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function RankBadge({ rank, change }: { rank: number; change: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-mono text-slate-300 w-6 text-right">{rank}</span>
      {change > 0 && <TrendingUp className="w-3 h-3 text-green-400" />}
      {change < 0 && <TrendingDown className="w-3 h-3 text-red-400" />}
      {change === 0 && <span className="text-[10px] text-blue-400 font-bold">NEW</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function TrendingPage() {
  const [source, setSource] = useState<Source>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const stocks = useMemo(() => generateTrending(source, timeRange), [source, timeRange]);
  const unusualActivity = useMemo(() => stocks.filter((s) => s.volumeMultiplier >= 3), [stocks]);

  const top5 = stocks.slice(0, 5);
  const selected = stocks.find((s) => s.ticker === selectedTicker) ?? stocks[0];

  /* -- Keyword cloud ------------------------------------------------- */
  const keywordSizes = useMemo(() => {
    const s = seed(`${source}-${timeRange}-kw`);
    return KEYWORDS.map((kw, i) => ({
      text: kw,
      size: 0.75 + pseudo(s, i) * 1.5,
      opacity: 0.5 + pseudo(s, i + 100) * 0.5,
    }));
  }, [source, timeRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            Trending Stocks
          </h1>
          <p className="text-slate-400 mt-1">
            Stocks generating the most buzz across social media and financial forums
          </p>
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 rounded',
              viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded',
              viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Source tabs */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSource(s.key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded font-medium transition-colors',
                source === s.key
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* Time range */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          {TIME_RANGES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeRange(t.key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded font-medium transition-colors',
                timeRange === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unusual activity alerts */}
      {unusualActivity.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
            <AlertTriangle className="w-4 h-4" />
            Unusual Activity Detected
          </div>
          <div className="flex flex-wrap gap-2">
            {unusualActivity.map((s) => (
              <span
                key={s.ticker}
                className="text-xs bg-amber-800/30 text-amber-300 px-2 py-1 rounded border border-amber-700/40"
              >
                {s.ticker} &mdash; {s.volumeMultiplier}x avg volume, {s.mentions.toLocaleString()} mentions
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buzz meter (top 5) */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Buzz Meter &mdash; Top 5
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {top5.map((s, i) => {
            const maxMentions = top5[0].mentions;
            return (
              <button
                key={s.ticker}
                onClick={() => setSelectedTicker(s.ticker)}
                className={cn(
                  'text-left p-3 rounded-lg border transition-colors',
                  selectedTicker === s.ticker || (!selectedTicker && i === 0)
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-sm">{s.ticker}</span>
                  <span className={cn('text-xs', TAG_CONFIG[s.tag].color)}>
                    {TAG_CONFIG[s.tag].emoji}
                  </span>
                </div>
                <div className="text-lg font-mono text-blue-400">{s.mentions.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 mb-1">mentions</div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(s.mentions / maxMentions) * 100}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main table/grid - 2 cols */}
        <div className="lg:col-span-2">
          {viewMode === 'list' ? (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">Ticker</th>
                    <th className="text-left py-2 px-3 font-medium">Mentions</th>
                    <th className="text-left py-2 px-3 font-medium">Sentiment</th>
                    <th className="text-left py-2 px-3 font-medium">Bull/Bear</th>
                    <th className="text-right py-2 px-3 font-medium">Price</th>
                    <th className="text-right py-2 px-3 font-medium">Change</th>
                    <th className="text-right py-2 px-3 font-medium">Vol</th>
                    <th className="text-left py-2 px-3 font-medium">Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => (
                    <tr
                      key={s.ticker}
                      onClick={() => setSelectedTicker(s.ticker)}
                      className={cn(
                        'border-b border-slate-700/50 hover:bg-slate-700/40 cursor-pointer transition-colors',
                        selectedTicker === s.ticker && 'bg-slate-700/60'
                      )}
                    >
                      <td className="py-2 px-3"><RankBadge rank={s.rank} change={s.rankChange} /></td>
                      <td className="py-2 px-3">
                        <Link to={`/company/${s.ticker}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          <span className="font-semibold text-white">{s.ticker}</span>
                        </Link>
                        <div className="text-[11px] text-slate-500 truncate max-w-[120px]">{s.name}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-white tabular-nums">{s.mentions.toLocaleString()}</div>
                        <MiniTrendBars data={s.mentionsTrend} />
                      </td>
                      <td className="py-2 px-3"><SentimentBar value={s.sentiment} /></td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1 text-xs tabular-nums">
                          <span className="text-green-400">{s.bullish}%</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-red-400">{100 - s.bullish}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-white tabular-nums">{formatPrice(s.price)}</td>
                      <td className={cn('py-2 px-3 text-right tabular-nums', s.change >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {formatPercent(s.change)}
                      </td>
                      <td className={cn('py-2 px-3 text-right tabular-nums text-xs', s.volumeMultiplier >= 3 ? 'text-amber-400 font-bold' : 'text-slate-400')}>
                        {s.volumeMultiplier}x
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn('text-xs', TAG_CONFIG[s.tag].color)}>
                          {TAG_CONFIG[s.tag].emoji} {TAG_CONFIG[s.tag].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stocks.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => setSelectedTicker(s.ticker)}
                  className={cn(
                    'text-left bg-slate-800 border rounded-lg p-3 transition-colors',
                    selectedTicker === s.ticker ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <RankBadge rank={s.rank} change={s.rankChange} />
                    <span className={cn('text-xs', TAG_CONFIG[s.tag].color)}>
                      {TAG_CONFIG[s.tag].emoji}
                    </span>
                  </div>
                  <Link to={`/company/${s.ticker}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    <div className="font-bold text-white">{s.ticker}</div>
                  </Link>
                  <div className="text-[11px] text-slate-500 truncate">{s.name}</div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{s.mentions.toLocaleString()} mentions</span>
                    <span className={cn('tabular-nums', s.change >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {formatPercent(s.change)}
                    </span>
                  </div>
                  <div className="mt-1"><MiniTrendBars data={s.mentionsTrend} /></div>
                  <div className="mt-1"><SentimentBar value={s.sentiment} /></div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Platform breakdown */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              Platform Breakdown &mdash; {selected.ticker}
            </h3>
            <div className="space-y-2">
              {Object.entries(selected.platformBreakdown).map(([platform, count]) => {
                const maxP = Math.max(...Object.values(selected.platformBreakdown), 1);
                const pLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
                return (
                  <div key={platform}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-slate-400">{pLabel}</span>
                      <span className="text-white tabular-nums">{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(count / maxP) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sentiment cloud */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Trending Keywords</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {keywordSizes.map((kw) => (
                <span
                  key={kw.text}
                  className="text-blue-400 font-medium whitespace-nowrap"
                  style={{ fontSize: `${kw.size}rem`, opacity: kw.opacity }}
                >
                  {kw.text}
                </span>
              ))}
            </div>
          </div>

          {/* Selected stock detail */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Link to={`/company/${selected.ticker}`} className="hover:underline">
                <span className="font-bold text-white text-lg">{selected.ticker}</span>
              </Link>
              <span className={cn('text-xs px-2 py-0.5 rounded', TAG_CONFIG[selected.tag].color, 'bg-slate-700')}>
                {TAG_CONFIG[selected.tag].emoji} {TAG_CONFIG[selected.tag].label}
              </span>
            </div>
            <div className="text-xs text-slate-500 mb-3">{selected.name}</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Price</div>
                <div className="text-white font-mono">{formatPrice(selected.price)}</div>
              </div>
              <div>
                <div className="text-slate-500">Change</div>
                <div className={cn('font-mono', selected.change >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {formatPercent(selected.change)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Mentions</div>
                <div className="text-white font-mono">{selected.mentions.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-500">Sentiment</div>
                <div className={cn('font-mono', selected.sentiment > 0 ? 'text-green-400' : 'text-red-400')}>
                  {selected.sentiment > 0 ? '+' : ''}{selected.sentiment}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Bullish</div>
                <div className="text-green-400 font-mono">{selected.bullish}%</div>
              </div>
              <div>
                <div className="text-slate-500">Volume</div>
                <div className={cn('font-mono', selected.volumeMultiplier >= 3 ? 'text-amber-400' : 'text-white')}>
                  {selected.volumeMultiplier}x avg
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
