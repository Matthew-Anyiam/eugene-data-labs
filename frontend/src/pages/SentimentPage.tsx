import { useState, useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, Activity, BarChart3, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Deterministic pseudo-random helpers ─────────────────────────────

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

// ─── Types ───────────────────────────────────────────────────────────

type TimePeriod = 'today' | 'week' | 'month';
type Signal = 'bullish' | 'bearish' | 'neutral';

interface SentimentIndicator {
  name: string;
  description: string;
  value: number;
  signal: Signal;
}

interface SocialTicker {
  ticker: string;
  mentions: number;
  sentiment: number;
  bullish: number;
  bearish: number;
  change: number;
}

interface SectorSentiment {
  sector: string;
  bullish: number;
  bearish: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const PERIODS: { key: TimePeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

const INDICATOR_NAMES = [
  { name: 'Market Momentum', desc: 'S&P 500 vs 125-day MA' },
  { name: 'Stock Price Strength', desc: 'New Highs vs New Lows' },
  { name: 'Stock Price Breadth', desc: 'Advance/Decline Volume' },
  { name: 'Put/Call Ratio', desc: 'Options market sentiment' },
  { name: 'Market Volatility', desc: 'VIX level relative to mean' },
  { name: 'Safe Haven Demand', desc: 'Bonds vs Stocks return' },
  { name: 'Junk Bond Demand', desc: 'Yield spread vs investment grade' },
];

const SOCIAL_TICKERS = [
  'AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT',
  'META', 'GOOG', 'AMD', 'PLTR', 'GME',
];

const SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Industrials', 'Energy', 'Materials', 'Real Estate',
  'Utilities', 'Communication Services', 'Consumer Staples',
];

// ─── Helpers ─────────────────────────────────────────────────────────

function getFearGreedZone(value: number): { label: string; color: string; bg: string } {
  if (value < 25) return { label: 'Extreme Fear', color: 'text-red-400', bg: 'bg-red-500' };
  if (value < 45) return { label: 'Fear', color: 'text-orange-400', bg: 'bg-orange-500' };
  if (value < 55) return { label: 'Neutral', color: 'text-slate-400', bg: 'bg-slate-500' };
  if (value < 75) return { label: 'Greed', color: 'text-green-400', bg: 'bg-green-500' };
  return { label: 'Extreme Greed', color: 'text-emerald-400', bg: 'bg-emerald-500' };
}

function getSignalFromValue(v: number): Signal {
  if (v < 35) return 'bearish';
  if (v > 65) return 'bullish';
  return 'neutral';
}

function signalColor(s: Signal): string {
  if (s === 'bullish') return 'text-green-400';
  if (s === 'bearish') return 'text-red-400';
  return 'text-slate-400';
}

function signalBarColor(s: Signal): string {
  if (s === 'bullish') return 'bg-green-500';
  if (s === 'bearish') return 'bg-red-500';
  return 'bg-slate-500';
}

function sentimentBarColor(v: number): string {
  if (v > 50) return 'bg-green-500';
  if (v > 20) return 'bg-green-600';
  if (v > -20) return 'bg-slate-500';
  if (v > -50) return 'bg-red-600';
  return 'bg-red-500';
}

function vixContext(v: number): { label: string; color: string } {
  if (v < 15) return { label: 'Low', color: 'text-green-400' };
  if (v < 20) return { label: 'Normal', color: 'text-slate-300' };
  if (v < 30) return { label: 'Elevated', color: 'text-orange-400' };
  return { label: 'High', color: 'text-red-400' };
}

// ─── Data generation ─────────────────────────────────────────────────

function generateData(period: TimePeriod) {
  const s = seed(`sentiment-${period}`);

  // Fear & Greed index
  const fearGreedValue = Math.round(pseudo(s, 0) * 100);
  const fearGreedWeekAgo = Math.round(pseudo(s, 100) * 100);
  const fearGreedMonthAgo = Math.round(pseudo(s, 200) * 100);

  // 7 sentiment indicators
  const indicators: SentimentIndicator[] = INDICATOR_NAMES.map((item, i) => {
    const value = Math.round(pseudo(s, 10 + i) * 100);
    return {
      name: item.name,
      description: item.desc,
      value,
      signal: getSignalFromValue(value),
    };
  });

  // Social tickers
  const socialTickers: SocialTicker[] = SOCIAL_TICKERS.map((ticker, i) => {
    const ts = seed(`${ticker}-${period}`);
    const sentiment = Math.round((pseudo(ts, i) * 200) - 100);
    const bullish = Math.round(50 + pseudo(ts, i + 10) * 40);
    return {
      ticker,
      mentions: Math.round(pseudo(ts, i + 20) * 50000) + 1000,
      sentiment,
      bullish,
      bearish: 100 - bullish,
      change: Math.round((pseudo(ts, i + 30) * 40) - 20),
    };
  });

  // VIX
  const vixValue = +(12 + pseudo(s, 50) * 25).toFixed(2);
  const vixChange = +((pseudo(s, 51) * 6) - 3).toFixed(2);

  // Sector sentiment
  const sectors: SectorSentiment[] = SECTORS.map((sector, i) => {
    const bullish = Math.round(30 + pseudo(s, 60 + i) * 50);
    return { sector, bullish, bearish: 100 - bullish };
  });

  return { fearGreedValue, fearGreedWeekAgo, fearGreedMonthAgo, indicators, socialTickers, vixValue, vixChange, sectors };
}

// ─── Components ──────────────────────────────────────────────────────

function FearGreedGauge({ value, weekAgo, monthAgo }: { value: number; weekAgo: number; monthAgo: number }) {
  const zone = getFearGreedZone(value);
  const rotation = -90 + (value / 100) * 180;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
        <Activity className="h-5 w-5 text-amber-400" />
        Fear &amp; Greed Index
      </h2>
      <div className="flex flex-col items-center gap-4">
        {/* Gauge */}
        <div className="relative h-40 w-64">
          <svg viewBox="0 0 200 110" className="w-full h-full">
            {/* Background arc segments */}
            <path d="M 20 100 A 80 80 0 0 1 56 36" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
            <path d="M 56 36 A 80 80 0 0 1 82 22" fill="none" stroke="#f97316" strokeWidth="12" strokeLinecap="round" />
            <path d="M 82 22 A 80 80 0 0 1 118 22" fill="none" stroke="#64748b" strokeWidth="12" strokeLinecap="round" />
            <path d="M 118 22 A 80 80 0 0 1 144 36" fill="none" stroke="#4ade80" strokeWidth="12" strokeLinecap="round" />
            <path d="M 144 36 A 80 80 0 0 1 180 100" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" />
            {/* Needle */}
            <g transform={`rotate(${rotation}, 100, 100)`}>
              <line x1="100" y1="100" x2="100" y2="30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="100" cy="100" r="5" fill="white" />
            </g>
          </svg>
        </div>
        {/* Value */}
        <div className="text-center">
          <div className="text-5xl font-bold text-white">{value}</div>
          <div className={cn('text-lg font-semibold mt-1', zone.color)}>{zone.label}</div>
        </div>
        {/* Previous values */}
        <div className="flex gap-8 text-sm text-slate-400 mt-2">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide mb-1">1 Week Ago</div>
            <div className={cn('font-semibold', getFearGreedZone(weekAgo).color)}>{weekAgo}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide mb-1">1 Month Ago</div>
            <div className={cn('font-semibold', getFearGreedZone(monthAgo).color)}>{monthAgo}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IndicatorCard({ indicator }: { indicator: SentimentIndicator }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-white">{indicator.name}</div>
          <div className="text-xs text-slate-500">{indicator.description}</div>
        </div>
        <span className={cn('text-xs font-semibold uppercase px-2 py-0.5 rounded', signalColor(indicator.signal))}>
          {indicator.signal}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-xl font-bold text-white">{indicator.value}</div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', signalBarColor(indicator.signal))}
              style={{ width: `${indicator.value}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialSentimentTable({ tickers }: { tickers: SocialTicker[] }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-blue-400" />
        Social Sentiment — Trending Tickers
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
              <th className="text-left py-2 pr-4">Ticker</th>
              <th className="text-right py-2 px-3">Mentions</th>
              <th className="text-right py-2 px-3">Sentiment</th>
              <th className="text-right py-2 px-3">Bullish %</th>
              <th className="text-right py-2 px-3">Bearish %</th>
              <th className="text-right py-2 px-3">Change</th>
              <th className="py-2 pl-3 w-32">Bar</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((t) => {
              const barWidth = Math.abs(t.sentiment);
              const barOffset = t.sentiment >= 0 ? 50 : 50 - barWidth;
              return (
                <tr key={t.ticker} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 pr-4 font-semibold text-amber-400">{t.ticker}</td>
                  <td className="py-2 px-3 text-right text-slate-300">{t.mentions.toLocaleString()}</td>
                  <td className={cn('py-2 px-3 text-right font-semibold', t.sentiment > 0 ? 'text-green-400' : t.sentiment < 0 ? 'text-red-400' : 'text-slate-400')}>
                    {t.sentiment > 0 ? '+' : ''}{t.sentiment}
                  </td>
                  <td className="py-2 px-3 text-right text-green-400">{t.bullish}%</td>
                  <td className="py-2 px-3 text-right text-red-400">{t.bearish}%</td>
                  <td className={cn('py-2 px-3 text-right font-medium', t.change > 0 ? 'text-green-400' : t.change < 0 ? 'text-red-400' : 'text-slate-400')}>
                    {t.change > 0 ? '+' : ''}{t.change}
                  </td>
                  <td className="py-2 pl-3">
                    <div className="relative h-3 w-full rounded bg-slate-700 overflow-hidden">
                      <div className="absolute top-0 h-full w-px bg-slate-500" style={{ left: '50%' }} />
                      <div
                        className={cn('absolute top-0 h-full rounded', sentimentBarColor(t.sentiment))}
                        style={{ left: `${barOffset}%`, width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VixPanel({ value, change }: { value: number; change: number }) {
  const ctx = vixContext(value);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-purple-400" />
        VIX — Volatility Index
      </h2>
      <div className="flex items-end gap-6">
        <div>
          <div className="text-4xl font-bold text-white">{value}</div>
          <div className={cn('text-sm font-medium mt-1 flex items-center gap-1', change >= 0 ? 'text-red-400' : 'text-green-400')}>
            {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {change >= 0 ? '+' : ''}{change}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Historical Context</div>
          <div className={cn('text-sm font-semibold', ctx.color)}>{ctx.label}</div>
          <div className="mt-2 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={cn('h-full rounded-full', value < 20 ? 'bg-green-500' : value < 30 ? 'bg-orange-500' : 'bg-red-500')}
              style={{ width: `${Math.min((value / 50) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>0</span>
            <span>15</span>
            <span>20</span>
            <span>30</span>
            <span>50+</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectorHeatmap({ sectors }: { sectors: SectorSentiment[] }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-cyan-400" />
        Sector Sentiment Heatmap
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sectors.map((s) => {
          const hue = s.bullish >= 60 ? 'bg-green-900/50 border-green-700/50' :
                      s.bullish >= 50 ? 'bg-slate-800 border-slate-600' :
                      'bg-red-900/50 border-red-700/50';
          return (
            <div key={s.sector} className={cn('rounded-lg border p-3 text-center', hue)}>
              <div className="text-xs text-slate-400 mb-1 truncate" title={s.sector}>{s.sector}</div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-green-400 font-semibold">{s.bullish}%</span>
                <span className="text-slate-600">/</span>
                <span className="text-red-400 font-semibold">{s.bearish}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden flex">
                <div className="h-full bg-green-500 rounded-l-full" style={{ width: `${s.bullish}%` }} />
                <div className="h-full bg-red-500 rounded-r-full" style={{ width: `${s.bearish}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export function SentimentPage() {
  const [period, setPeriod] = useState<TimePeriod>('today');

  const data = useMemo(() => generateData(period), [period]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Market Sentiment</h1>
          </div>
          <p className="text-slate-400">
            Composite fear &amp; greed indicators, social sentiment, and sector-level market mood.
          </p>
        </div>

        {/* Time period toggle */}
        <div className="mb-6 flex gap-1 rounded-lg bg-slate-800 p-1 w-fit border border-slate-700">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                period === p.key
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Fear & Greed + VIX row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <FearGreedGauge
            value={data.fearGreedValue}
            weekAgo={data.fearGreedWeekAgo}
            monthAgo={data.fearGreedMonthAgo}
          />
          <VixPanel value={data.vixValue} change={data.vixChange} />
        </div>

        {/* Sentiment indicators grid */}
        <div className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Index Components
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.indicators.map((ind) => (
              <IndicatorCard key={ind.name} indicator={ind} />
            ))}
          </div>
        </div>

        {/* Social sentiment */}
        <div className="mb-6">
          <SocialSentimentTable tickers={data.socialTickers} />
        </div>

        {/* Sector heatmap */}
        <SectorHeatmap sectors={data.sectors} />
      </div>
    </div>
  );
}
