import { useState, useMemo } from 'react';
import { MessageCircle, TrendingUp, TrendingDown, Search, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'GME', 'AMC', 'PLTR', 'SOFI', 'RIVN', 'NIO', 'AMD', 'COIN', 'SNAP', 'HOOD', 'MARA', 'BB', 'NOK'];

const PLATFORMS = ['All', 'Reddit', 'Twitter/X', 'StockTwits', 'YouTube'] as const;
type Platform = (typeof PLATFORMS)[number];

interface SocialData {
  ticker: string;
  mentions24h: number;
  mentionChange: number;
  sentiment: number; // -1 to 1
  sentimentLabel: 'Bullish' | 'Bearish' | 'Neutral';
  reddit: number;
  twitter: number;
  stocktwits: number;
  youtube: number;
  topPost: string;
  priceChange: number;
  volume: number;
  sparkline: number[];
}

const POST_TEMPLATES = [
  'Why I\'m loading up on $TICKER',
  '$TICKER to the moon! DD inside',
  'Bearish case for $TICKER - be careful',
  '$TICKER earnings play - here\'s my thesis',
  'Is $TICKER undervalued at these levels?',
  '$TICKER short squeeze incoming?',
  'Technical analysis: $TICKER breakout imminent',
  '$TICKER institutional buying detected',
];

function genSocialData(): SocialData[] {
  return TICKERS.map(ticker => {
    const s = seed(ticker + '_social');
    const mentions24h = Math.floor(100 + pseudo(s, 0) * 9900);
    const sentiment = +(pseudo(s, 1) * 2 - 1).toFixed(2);
    const reddit = Math.floor(mentions24h * (0.3 + pseudo(s, 10) * 0.4));
    const twitter = Math.floor(mentions24h * (0.2 + pseudo(s, 11) * 0.3));
    const stocktwits = Math.floor(mentions24h * (0.1 + pseudo(s, 12) * 0.2));
    const youtube = mentions24h - reddit - twitter - stocktwits;
    const sparkline = Array.from({ length: 24 }, (_, i) => Math.floor(50 + pseudo(s, 20 + i) * 400));
    const postIdx = Math.floor(pseudo(s, 30) * POST_TEMPLATES.length);

    return {
      ticker,
      mentions24h,
      mentionChange: +((pseudo(s, 2) - 0.3) * 200).toFixed(1),
      sentiment,
      sentimentLabel: sentiment > 0.2 ? 'Bullish' : sentiment < -0.2 ? 'Bearish' : 'Neutral',
      reddit,
      twitter,
      stocktwits,
      youtube: Math.max(0, youtube),
      topPost: POST_TEMPLATES[postIdx].replace('$TICKER', ticker),
      priceChange: +((pseudo(s, 3) - 0.4) * 10).toFixed(2),
      volume: +(1 + pseudo(s, 4) * 99).toFixed(1),
      sparkline,
    };
  }).sort((a, b) => b.mentions24h - a.mentions24h);
}

function SentimentBadge({ label }: { label: SocialData['sentimentLabel'] }) {
  const styles = {
    Bullish: 'bg-emerald-900/40 text-emerald-400',
    Bearish: 'bg-red-900/40 text-red-400',
    Neutral: 'bg-slate-700 text-slate-300',
  };
  const icons = {
    Bullish: <ThumbsUp className="h-3 w-3" />,
    Bearish: <ThumbsDown className="h-3 w-3" />,
    Neutral: <Minus className="h-3 w-3" />,
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', styles[label])}>
      {icons[label]} {label}
    </span>
  );
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 80;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={positive ? '#34d399' : '#f87171'} strokeWidth="1.5" />
    </svg>
  );
}

export function SocialSentimentPage() {
  const [platform, setPlatform] = useState<Platform>('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'mentions' | 'sentiment' | 'change'>('mentions');

  const data = useMemo(() => genSocialData(), []);

  const filtered = data
    .filter(d => !search || d.ticker.includes(search.toUpperCase()))
    .sort((a, b) => {
      if (sortBy === 'mentions') return b.mentions24h - a.mentions24h;
      if (sortBy === 'sentiment') return b.sentiment - a.sentiment;
      return b.mentionChange - a.mentionChange;
    });

  const totalMentions = data.reduce((s, d) => s + d.mentions24h, 0);
  const avgSentiment = data.reduce((s, d) => s + d.sentiment, 0) / data.length;
  const topMover = [...data].sort((a, b) => b.mentionChange - a.mentionChange)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Social Sentiment</h1>
          <p className="text-sm text-slate-400">Track social media mentions and sentiment across platforms</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Mentions (24h)</div>
          <div className="mt-1 text-2xl font-bold text-white">{totalMentions.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Avg Sentiment</div>
          <div className={cn('mt-1 text-2xl font-bold', avgSentiment >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {avgSentiment >= 0 ? '+' : ''}{avgSentiment.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Most Mentioned</div>
          <div className="mt-1 text-2xl font-bold text-indigo-400">{data[0]?.ticker}</div>
          <div className="text-xs text-slate-500">{data[0]?.mentions24h.toLocaleString()} mentions</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Top Trending</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{topMover?.ticker}</div>
          <div className="text-xs text-emerald-400">+{topMover?.mentionChange}% mentions</div>
        </div>
      </div>

      {/* Sentiment gauge visual */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Sentiment Distribution</h3>
        <div className="flex items-center gap-4">
          {(['Bullish', 'Neutral', 'Bearish'] as const).map(label => {
            const count = data.filter(d => d.sentimentLabel === label).length;
            const pct = (count / data.length * 100).toFixed(0);
            const color = label === 'Bullish' ? 'bg-emerald-500' : label === 'Bearish' ? 'bg-red-500' : 'bg-slate-500';
            return (
              <div key={label} className="flex-1">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-medium">{count} ({pct}%)</span>
                </div>
                <div className="h-3 rounded-full bg-slate-700">
                  <div className={cn('h-3 rounded-full opacity-60', color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Search ticker..." className="w-36 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', platform === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {([['mentions', 'Most Mentioned'], ['change', 'Trending'], ['sentiment', 'Sentiment']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key as any)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', sortBy === key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticker cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0, 12).map((d, i) => (
          <div key={d.ticker} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{d.ticker}</span>
                <span className="text-[10px] text-slate-500">#{i + 1}</span>
              </div>
              <SentimentBadge label={d.sentimentLabel} />
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-lg font-bold text-white">{d.mentions24h.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">mentions 24h</div>
              </div>
              <div className="text-right">
                <span className={cn('text-xs font-medium', d.mentionChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.mentionChange >= 0 ? '+' : ''}{d.mentionChange}%
                </span>
                <div className="text-[10px] text-slate-500">vs yesterday</div>
              </div>
            </div>

            <div className="mt-2">
              <MiniSparkline data={d.sparkline} positive={d.mentionChange >= 0} />
            </div>

            {/* Platform breakdown */}
            <div className="mt-2 flex gap-2 text-[10px]">
              <span className="text-orange-400">Reddit: {d.reddit}</span>
              <span className="text-blue-400">X: {d.twitter}</span>
              <span className="text-green-400">ST: {d.stocktwits}</span>
              <span className="text-red-400">YT: {d.youtube}</span>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-700 pt-2">
              <span className={cn('flex items-center gap-0.5 text-xs font-medium', d.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {d.priceChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {d.priceChange >= 0 ? '+' : ''}{d.priceChange}%
              </span>
              <span className="text-[10px] text-slate-500">Vol: {d.volume}M</span>
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Mentions</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Change</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Sentiment</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Score</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price Chg</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Top Post</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map((d, i) => (
              <tr key={d.ticker} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                <td className="px-3 py-2 text-xs font-bold text-indigo-400">{d.ticker}</td>
                <td className="px-3 py-2 text-right text-xs text-white font-medium">{d.mentions24h.toLocaleString()}</td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', d.mentionChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.mentionChange >= 0 ? '+' : ''}{d.mentionChange}%
                </td>
                <td className="px-3 py-2 text-center"><SentimentBadge label={d.sentimentLabel} /></td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', d.sentiment >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.sentiment >= 0 ? '+' : ''}{d.sentiment}
                </td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', d.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.priceChange >= 0 ? '+' : ''}{d.priceChange}%
                </td>
                <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">{d.topPost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
