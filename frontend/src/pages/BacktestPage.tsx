import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, ArrowLeft, TrendingUp, TrendingDown, Play } from 'lucide-react';
import { cn, formatPrice, formatPercent, formatCurrency } from '../lib/utils';

type StrategyType = 'buyhold' | 'macross' | 'rsi' | 'dca';
type Period = '1Y' | '3Y' | '5Y' | '10Y';

interface TradeEntry {
  date: string;
  action: 'Buy' | 'Sell';
  price: number;
  shares: number;
  value: number;
}

interface BacktestResult {
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  trades: TradeEntry[];
  finalValue: number;
}

interface ComparisonRow {
  strategy: string;
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
}

const STRATEGIES: { value: StrategyType; label: string }[] = [
  { value: 'buyhold', label: 'Buy & Hold' },
  { value: 'macross', label: 'Moving Average Crossover' },
  { value: 'rsi', label: 'RSI Mean Reversion' },
  { value: 'dca', label: 'Dollar Cost Average' },
];

const PERIODS: Period[] = ['1Y', '3Y', '5Y', '10Y'];

const PRESETS = [
  { label: 'AAPL Buy&Hold 5Y', ticker: 'AAPL', strategy: 'buyhold' as StrategyType, period: '5Y' as Period },
  { label: 'MSFT DCA 3Y', ticker: 'MSFT', strategy: 'dca' as StrategyType, period: '3Y' as Period },
  { label: 'TSLA RSI 1Y', ticker: 'TSLA', strategy: 'rsi' as StrategyType, period: '1Y' as Period },
  { label: 'GOOGL MA Cross 5Y', ticker: 'GOOGL', strategy: 'macross' as StrategyType, period: '5Y' as Period },
];

function seed(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRandom(s: number): () => number {
  let state = s || 1;
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function periodYears(p: Period): number {
  return parseInt(p.replace('Y', ''), 10);
}

function generateResult(
  ticker: string,
  strategy: StrategyType,
  investment: number,
  period: Period,
): BacktestResult {
  const rand = seededRandom(seed(ticker) + STRATEGIES.findIndex((s) => s.value === strategy) * 7 + periodYears(period));
  const years = periodYears(period);
  const baseReturn = strategy === 'buyhold' ? 0.12 : strategy === 'macross' ? 0.09 : strategy === 'rsi' ? 0.14 : 0.10;
  const noise = (rand() - 0.4) * 0.08;
  const annualReturn = baseReturn + noise;
  const totalReturn = Math.pow(1 + annualReturn, years) - 1;
  const maxDrawdown = -(0.10 + rand() * 0.25);
  const sharpeRatio = 0.5 + rand() * 1.5;
  const winRate = 0.45 + rand() * 0.2;
  const finalValue = investment * (1 + totalReturn);

  const tradeCount = strategy === 'buyhold' ? 2 : strategy === 'dca' ? Math.min(years * 12, 24) : Math.min(years * 4, 20);
  const trades: TradeEntry[] = [];
  let basePrice = 50 + rand() * 250;

  for (let i = 0; i < tradeCount; i++) {
    const monthOffset = Math.floor((i / tradeCount) * years * 12);
    const y = 2026 - years + Math.floor(monthOffset / 12);
    const m = (monthOffset % 12) + 1;
    const d = 1 + Math.floor(rand() * 27);
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const price = basePrice * (1 + (rand() - 0.4) * 0.15);
    basePrice = price;
    const action: 'Buy' | 'Sell' = strategy === 'buyhold'
      ? (i === 0 ? 'Buy' : 'Sell')
      : strategy === 'dca'
        ? 'Buy'
        : i % 2 === 0 ? 'Buy' : 'Sell';
    const shares = Math.round((investment / tradeCount) / price * 100) / 100;
    trades.push({ date, action, price: Math.round(price * 100) / 100, shares, value: Math.round(shares * price * 100) / 100 });
  }

  return { totalReturn, annualReturn, maxDrawdown, sharpeRatio, winRate, trades, finalValue };
}

function generateComparison(ticker: string, investment: number, period: Period): ComparisonRow[] {
  return STRATEGIES.map(({ value, label }) => {
    const r = generateResult(ticker, value, investment, period);
    return {
      strategy: label,
      totalReturn: r.totalReturn,
      annualReturn: r.annualReturn,
      maxDrawdown: r.maxDrawdown,
      sharpeRatio: r.sharpeRatio,
      winRate: r.winRate,
    };
  });
}

export function BacktestPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [strategy, setStrategy] = useState<StrategyType>('buyhold');
  const [investment, setInvestment] = useState(10000);
  const [period, setPeriod] = useState<Period>('5Y');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [comparison, setComparison] = useState<ComparisonRow[] | null>(null);

  function runBacktest() {
    setLoading(true);
    setResult(null);
    setComparison(null);
    setTimeout(() => {
      setResult(generateResult(ticker, strategy, investment, period));
      setComparison(generateComparison(ticker, investment, period));
      setLoading(false);
    }, 600);
  }

  function applyPreset(p: typeof PRESETS[number]) {
    setTicker(p.ticker);
    setStrategy(p.strategy);
    setPeriod(p.period);
    setResult(null);
    setComparison(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Strategy Backtester
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Define a trading strategy and simulate historical performance
        </p>
      </div>

      {/* Presets */}
      <div className="mb-6 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Strategy Builder */}
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Strategy Configuration</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              placeholder="AAPL"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyType)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Initial Investment ($)</label>
            <input
              type="number"
              value={investment}
              onChange={(e) => setInvestment(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              min={0}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Period</label>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-700',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={runBacktest}
          disabled={!ticker || loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {loading ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Total Return', value: formatPercent(result.totalReturn * 100), positive: result.totalReturn >= 0 },
              { label: 'Annual Return', value: formatPercent(result.annualReturn * 100), positive: result.annualReturn >= 0 },
              { label: 'Max Drawdown', value: formatPercent(result.maxDrawdown * 100), positive: false },
              { label: 'Sharpe Ratio', value: result.sharpeRatio.toFixed(2), positive: result.sharpeRatio >= 1 },
              { label: 'Win Rate', value: `${(result.winRate * 100).toFixed(1)}%`, positive: result.winRate >= 0.5 },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className={cn('mt-1 text-lg font-bold', card.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-3 rounded-lg border border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">Final portfolio value: </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(result.finalValue)}</span>
            <span className="ml-2 text-xs text-slate-400">from {formatCurrency(investment)} invested</span>
          </div>

          {/* Trade Log */}
          <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="bg-white px-5 py-3 dark:bg-slate-800/50">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Trade Log</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-t border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-2">Date</th>
                    <th className="px-5 py-2">Action</th>
                    <th className="px-5 py-2 text-right">Price</th>
                    <th className="px-5 py-2 text-right">Shares</th>
                    <th className="px-5 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/30">
                  {result.trades.map((t, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-5 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{t.date}</td>
                      <td className="px-5 py-2">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium', t.action === 'Buy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                          {t.action === 'Buy' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {t.action}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">{formatPrice(t.price)}</td>
                      <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">{t.shares}</td>
                      <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">{formatPrice(t.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Strategy Comparison */}
          {comparison && (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="bg-white px-5 py-3 dark:bg-slate-800/50">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Strategy Comparison — {ticker} {period}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-t border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-2">Strategy</th>
                      <th className="px-5 py-2 text-right">Total Return</th>
                      <th className="px-5 py-2 text-right">Annual Return</th>
                      <th className="px-5 py-2 text-right">Max Drawdown</th>
                      <th className="px-5 py-2 text-right">Sharpe</th>
                      <th className="px-5 py-2 text-right">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/30">
                    {comparison.map((row) => (
                      <tr key={row.strategy} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/60', row.strategy === STRATEGIES.find((s) => s.value === strategy)?.label && 'bg-blue-50/50 dark:bg-blue-950/20')}>
                        <td className="px-5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200">{row.strategy}</td>
                        <td className={cn('px-5 py-2 text-right font-mono text-xs', row.totalReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatPercent(row.totalReturn * 100)}</td>
                        <td className={cn('px-5 py-2 text-right font-mono text-xs', row.annualReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatPercent(row.annualReturn * 100)}</td>
                        <td className="px-5 py-2 text-right font-mono text-xs text-red-500 dark:text-red-400">{formatPercent(row.maxDrawdown * 100)}</td>
                        <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">{row.sharpeRatio.toFixed(2)}</td>
                        <td className="px-5 py-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300">{(row.winRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
