import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, TrendingUp, TrendingDown, ArrowRight, Target } from 'lucide-react';
import { cn, formatPrice } from '../lib/utils';

/* ---------- deterministic helpers ---------- */

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

/* ---------- static data ---------- */

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'JPM'] as const;

const ANALYST_FIRMS = [
  'Goldman Sachs', 'Morgan Stanley', 'JP Morgan', 'Bank of America',
  'Citigroup', 'Wells Fargo', 'Barclays', 'Deutsche Bank',
  'UBS', 'Credit Suisse', 'RBC Capital', 'Jefferies',
  'Piper Sandler', 'Wedbush', 'Raymond James', 'Bernstein',
  'Oppenheimer', 'Needham', 'Canaccord', 'Cowen',
] as const;

const ANALYST_NAMES = [
  'David Kostin', 'Mike Wilson', 'Marko Kolanovic', 'Savita Subramanian',
  'Andrew Sheets', 'Chris Harvey', 'Ajay Rajadhyaksha', 'Michael Hartnett',
  'Maneesh Deshpande', 'Dan Ives', 'Gene Munster', 'Mark Lipacis',
  'Toni Sacconaghi', 'Brian White', 'Timothy Arcuri', 'Samik Chatterjee',
  'Erik Woodring', 'Matt Bryson', 'Pierre Ferragu', 'Angelo Zino',
] as const;

const ACTIONS = ['Initiates', 'Upgrades', 'Downgrades', 'Reiterates', 'Maintains'] as const;
const RATINGS = ['Buy', 'Outperform', 'Hold', 'Underperform', 'Sell'] as const;

type Action = (typeof ACTIONS)[number];
type Rating = (typeof RATINGS)[number];
type SortKey = 'consensus' | 'upside' | 'analysts';

const STOCK_UNIVERSE = [
  { ticker: 'AAPL', name: 'Apple Inc.', price: 228.40 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 432.80 },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 175.30 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 142.50 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 178.50 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 198.60 },
  { ticker: 'META', name: 'Meta Platforms', price: 612.00 },
  { ticker: 'JPM', name: 'JPMorgan Chase', price: 245.80 },
  { ticker: 'V', name: 'Visa Inc.', price: 318.40 },
  { ticker: 'UNH', name: 'UnitedHealth Group', price: 542.30 },
  { ticker: 'CRM', name: 'Salesforce Inc.', price: 298.70 },
  { ticker: 'AVGO', name: 'Broadcom Inc.', price: 186.40 },
  { ticker: 'LLY', name: 'Eli Lilly & Co.', price: 812.50 },
  { ticker: 'MA', name: 'Mastercard Inc.', price: 502.10 },
  { ticker: 'HD', name: 'Home Depot Inc.', price: 384.20 },
  { ticker: 'PG', name: 'Procter & Gamble', price: 168.90 },
  { ticker: 'XOM', name: 'Exxon Mobil Corp.', price: 118.30 },
  { ticker: 'COST', name: 'Costco Wholesale', price: 912.40 },
  { ticker: 'NFLX', name: 'Netflix Inc.', price: 628.10 },
  { ticker: 'AMD', name: 'AMD Inc.', price: 164.70 },
];

/* ---------- data generators ---------- */

interface RatingDistribution {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface TickerConsensus {
  ticker: string;
  name: string;
  price: number;
  distribution: RatingDistribution;
  totalAnalysts: number;
  avgTarget: number;
  lowTarget: number;
  highTarget: number;
  consensusScore: number;
  consensusLabel: string;
  upside: number;
  recentActions: number;
}

interface RecentRating {
  date: string;
  firm: string;
  analyst: string;
  action: Action;
  rating: Rating;
  oldTarget: number;
  newTarget: number;
}

function generateConsensus(ticker: string, price: number): TickerConsensus {
  const s = seed(ticker);
  const totalAnalysts = 12 + Math.floor(pseudo(s, 0) * 20);
  const strongBuy = Math.max(1, Math.floor(pseudo(s, 1) * totalAnalysts * 0.35));
  const buy = Math.max(1, Math.floor(pseudo(s, 2) * totalAnalysts * 0.30));
  const hold = Math.max(1, Math.floor(pseudo(s, 3) * totalAnalysts * 0.25));
  const remaining = Math.max(0, totalAnalysts - strongBuy - buy - hold);
  const sell = Math.floor(pseudo(s, 4) * remaining);
  const strongSell = remaining - sell;

  const distribution: RatingDistribution = { strongBuy, buy, hold, sell, strongSell };
  const consensusScore =
    (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / totalAnalysts;

  let consensusLabel: string;
  if (consensusScore >= 4.5) consensusLabel = 'Strong Buy';
  else if (consensusScore >= 3.5) consensusLabel = 'Buy';
  else if (consensusScore >= 2.5) consensusLabel = 'Hold';
  else if (consensusScore >= 1.5) consensusLabel = 'Sell';
  else consensusLabel = 'Strong Sell';

  const avgTarget = price * (1 + (pseudo(s, 5) * 0.4 - 0.05));
  const lowTarget = price * (0.75 + pseudo(s, 6) * 0.15);
  const highTarget = price * (1.15 + pseudo(s, 7) * 0.45);
  const upside = ((avgTarget - price) / price) * 100;
  const recentActions = 2 + Math.floor(pseudo(s, 8) * 8);

  const stock = STOCK_UNIVERSE.find((st) => st.ticker === ticker);

  return {
    ticker,
    name: stock?.name ?? ticker,
    price,
    distribution,
    totalAnalysts,
    avgTarget: Math.round(avgTarget * 100) / 100,
    lowTarget: Math.round(lowTarget * 100) / 100,
    highTarget: Math.round(highTarget * 100) / 100,
    consensusScore,
    consensusLabel,
    upside: Math.round(upside * 100) / 100,
    recentActions,
  };
}

function generateRecentRatings(ticker: string): RecentRating[] {
  const s = seed(ticker);
  const ratings: RecentRating[] = [];
  for (let i = 0; i < 15; i++) {
    const firmIdx = Math.floor(pseudo(s, 100 + i) * ANALYST_FIRMS.length);
    const analystIdx = Math.floor(pseudo(s, 200 + i) * ANALYST_NAMES.length);
    const actionIdx = Math.floor(pseudo(s, 300 + i) * ACTIONS.length);
    const ratingIdx = Math.floor(pseudo(s, 400 + i) * RATINGS.length);
    const stock = STOCK_UNIVERSE.find((st) => st.ticker === ticker);
    const base = stock?.price ?? 200;
    const oldTarget = Math.round((base * (0.85 + pseudo(s, 500 + i) * 0.35)) * 100) / 100;
    const newTarget = Math.round((base * (0.90 + pseudo(s, 600 + i) * 0.40)) * 100) / 100;
    const dayOffset = i * 2 + Math.floor(pseudo(s, 700 + i) * 3);
    const date = new Date(2026, 2, 31 - dayOffset);
    ratings.push({
      date: date.toISOString().slice(0, 10),
      firm: ANALYST_FIRMS[firmIdx],
      analyst: ANALYST_NAMES[analystIdx],
      action: ACTIONS[actionIdx],
      rating: RATINGS[ratingIdx],
      oldTarget,
      newTarget,
    });
  }
  return ratings;
}

/* ---------- styling helpers ---------- */

function consensusColor(label: string): string {
  if (label === 'Strong Buy') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
  if (label === 'Buy') return 'text-green-400 bg-green-400/10 border-green-400/30';
  if (label === 'Hold') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
  if (label === 'Sell') return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
  return 'text-red-400 bg-red-400/10 border-red-400/30';
}

function actionColor(action: Action): string {
  if (action === 'Upgrades') return 'text-emerald-400';
  if (action === 'Initiates') return 'text-blue-400';
  if (action === 'Downgrades') return 'text-red-400';
  return 'text-slate-400';
}

const BAR_COLORS = {
  strongBuy: 'bg-emerald-500',
  buy: 'bg-green-500',
  hold: 'bg-yellow-500',
  sell: 'bg-orange-500',
  strongSell: 'bg-red-500',
} as const;

/* ---------- component ---------- */

export function AnalystRatingsPage() {
  const [search, setSearch] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [sortKey, setSortKey] = useState<SortKey>('consensus');

  const consensus = useMemo(
    () => {
      const stock = STOCK_UNIVERSE.find((s) => s.ticker === selectedTicker);
      return stock ? generateConsensus(stock.ticker, stock.price) : null;
    },
    [selectedTicker],
  );

  const recentRatings = useMemo(() => generateRecentRatings(selectedTicker), [selectedTicker]);

  const topRated = useMemo(() => {
    const all = STOCK_UNIVERSE.map((s) => generateConsensus(s.ticker, s.price));
    return [...all].sort((a, b) => {
      if (sortKey === 'consensus') return b.consensusScore - a.consensusScore;
      if (sortKey === 'upside') return b.upside - a.upside;
      return b.totalAnalysts - a.totalAnalysts;
    });
  }, [sortKey]);

  const changeSummary = useMemo(() => {
    let weekUpgrades = 0, weekDowngrades = 0, monthUpgrades = 0, monthDowngrades = 0;
    for (const stock of STOCK_UNIVERSE) {
      const ratings = generateRecentRatings(stock.ticker);
      for (const r of ratings) {
        const d = new Date(r.date);
        const now = new Date(2026, 3, 3);
        const daysDiff = Math.floor((now.getTime() - d.getTime()) / 86400000);
        if (r.action === 'Upgrades') {
          if (daysDiff <= 7) weekUpgrades++;
          if (daysDiff <= 30) monthUpgrades++;
        }
        if (r.action === 'Downgrades') {
          if (daysDiff <= 7) weekDowngrades++;
          if (daysDiff <= 30) monthDowngrades++;
        }
      }
    }
    return { weekUpgrades, weekDowngrades, monthUpgrades, monthDowngrades };
  }, []);

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker);
    setSearch('');
  };

  const filteredTickers = search.trim()
    ? STOCK_UNIVERSE.filter(
        (s) =>
          s.ticker.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <ThumbsUp className="h-7 w-7 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Analyst Ratings</h1>
        </div>
        <p className="text-slate-400">
          Wall Street consensus ratings, price targets, and recent analyst actions across major equities.
        </p>
      </div>

      {/* Ticker search + quick buttons */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search ticker or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {filteredTickers.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                {filteredTickers.map((s) => (
                  <button
                    key={s.ticker}
                    onClick={() => handleTickerSelect(s.ticker)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-700 text-white text-sm"
                  >
                    <span className="font-medium">{s.ticker}</span>
                    <span className="text-slate-400 ml-2">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => handleTickerSelect(t)}
                className={cn(
                  'px-3 py-1.5 rounded text-sm font-medium border transition-colors',
                  selectedTicker === t
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Consensus overview */}
      {consensus && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {consensus.ticker} Consensus Overview
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Consensus badge + distribution */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    'px-4 py-2 rounded-lg border text-lg font-bold',
                    consensusColor(consensus.consensusLabel),
                  )}
                >
                  {consensus.consensusLabel}
                </span>
                <span className="text-slate-400 text-sm">
                  {consensus.totalAnalysts} analysts
                </span>
              </div>
              <div className="text-sm text-slate-400 mb-1">Rating Distribution</div>
              {/* Stacked bar */}
              <div className="flex h-6 rounded overflow-hidden">
                {(
                  ['strongBuy', 'buy', 'hold', 'sell', 'strongSell'] as const
                ).map((key) => {
                  const count = consensus.distribution[key];
                  const pct = (count / consensus.totalAnalysts) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={key}
                      className={cn('flex items-center justify-center text-xs font-medium text-white', BAR_COLORS[key])}
                      style={{ width: `${pct}%` }}
                      title={`${key}: ${count}`}
                    >
                      {count}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Strong Buy</span>
                <span>Buy</span>
                <span>Hold</span>
                <span>Sell</span>
                <span>Strong Sell</span>
              </div>
            </div>

            {/* Price target vs current */}
            <div className="space-y-3">
              <div className="text-sm text-slate-400">Price Target vs Current</div>
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-xs text-slate-500">Current</div>
                  <div className="text-xl font-bold text-white">{formatPrice(consensus.price)}</div>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-500 mb-1" />
                <div>
                  <div className="text-xs text-slate-500">Avg Target</div>
                  <div className="text-xl font-bold text-blue-400">{formatPrice(consensus.avgTarget)}</div>
                </div>
                <div
                  className={cn(
                    'text-lg font-semibold mb-0.5',
                    consensus.upside >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {consensus.upside >= 0 ? '+' : ''}{consensus.upside.toFixed(1)}%
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm mt-2">
                {consensus.upside >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                <span className="text-slate-400">
                  {consensus.upside >= 0 ? 'Upside' : 'Downside'} potential
                </span>
              </div>
            </div>

            {/* Price target range */}
            <div className="space-y-3">
              <div className="text-sm text-slate-400 flex items-center gap-1">
                <Target className="h-4 w-4" /> Price Target Range
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Low: {formatPrice(consensus.lowTarget)}</span>
                <span>Avg: {formatPrice(consensus.avgTarget)}</span>
                <span>High: {formatPrice(consensus.highTarget)}</span>
              </div>
              <div className="relative h-3 bg-slate-700 rounded-full">
                {/* Current price marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((consensus.price - consensus.lowTarget) / (consensus.highTarget - consensus.lowTarget)) * 100))}%`,
                  }}
                />
                {/* Avg target marker */}
                <div
                  className="absolute top-0 bottom-0 w-2 h-3 rounded bg-blue-500"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((consensus.avgTarget - consensus.lowTarget) / (consensus.highTarget - consensus.lowTarget)) * 100))}%`,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-slate-500/40"
                  style={{
                    left: '0%',
                    width: '100%',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white">Current</span>
                <span className="text-blue-400">Target</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating changes summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-500 mb-1">Upgrades This Week</div>
          <div className="text-2xl font-bold text-emerald-400">{changeSummary.weekUpgrades}</div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-500 mb-1">Downgrades This Week</div>
          <div className="text-2xl font-bold text-red-400">{changeSummary.weekDowngrades}</div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-500 mb-1">Upgrades This Month</div>
          <div className="text-2xl font-bold text-emerald-400">{changeSummary.monthUpgrades}</div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-xs text-slate-500 mb-1">Downgrades This Month</div>
          <div className="text-2xl font-bold text-red-400">{changeSummary.monthDowngrades}</div>
        </div>
      </div>

      {/* Recent ratings table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Recent Ratings — {selectedTicker}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Firm</th>
                <th className="text-left px-4 py-3 font-medium">Analyst</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Rating</th>
                <th className="text-right px-4 py-3 font-medium">Price Target</th>
              </tr>
            </thead>
            <tbody>
              {recentRatings.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-300">{r.date}</td>
                  <td className="px-4 py-3 text-white font-medium">{r.firm}</td>
                  <td className="px-4 py-3 text-slate-300">{r.analyst}</td>
                  <td className={cn('px-4 py-3 font-medium', actionColor(r.action))}>
                    {r.action}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.rating}</td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    <span className="text-slate-500">{formatPrice(r.oldTarget)}</span>
                    <ArrowRight className="inline h-3 w-3 mx-1 text-slate-600" />
                    <span className="text-white font-medium">{formatPrice(r.newTarget)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top rated stocks */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Top Rated Stocks</h2>
          <div className="flex gap-2">
            {([
              ['consensus', 'Consensus'],
              ['upside', 'Upside %'],
              ['analysts', 'Analysts'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium border transition-colors',
                  sortKey === key
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left px-4 py-3 font-medium">Ticker</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Consensus</th>
                <th className="text-right px-4 py-3 font-medium">Analysts</th>
                <th className="text-right px-4 py-3 font-medium">Avg Target</th>
                <th className="text-right px-4 py-3 font-medium">Upside</th>
                <th className="text-right px-4 py-3 font-medium">Recent Actions</th>
              </tr>
            </thead>
            <tbody>
              {topRated.map((s) => (
                <tr
                  key={s.ticker}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/company/${s.ticker}`}
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {s.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white">{s.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        consensusColor(s.consensusLabel),
                      )}
                    >
                      {s.consensusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">{s.totalAnalysts}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatPrice(s.avgTarget)}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-medium',
                      s.upside >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {s.upside >= 0 ? '+' : ''}{s.upside.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">{s.recentActions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
