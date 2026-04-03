import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, TrendingDown, BarChart3, Target } from 'lucide-react';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePrices } from '../hooks/usePrices';
import { cn, formatPrice, formatPercent } from '../lib/utils';

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

interface PositionData {
  ticker: string;
  shares: number;
  avgCost: number;
  price: number;
  change_percent: number;
}

interface PositionPriceFetcherProps {
  ticker: string;
  shares: number;
  avgCost: number;
  onData: (ticker: string, data: PositionData) => void;
}

// ─── Child component for per-ticker price fetching ───────────────────

function PositionPriceFetcher({ ticker, shares, avgCost, onData }: PositionPriceFetcherProps) {
  const { data: prices } = usePrices(ticker);
  useEffect(() => {
    if (prices) {
      onData(ticker, {
        ticker,
        shares,
        avgCost,
        price: prices.price,
        change_percent: prices.change_percent,
      });
    }
  }, [prices, ticker, shares, avgCost, onData]);
  return null;
}

// ─── Stress test scenarios ───────────────────────────────────────────

const STRESS_SCENARIOS = [
  { name: 'Market Crash', description: 'Broad market decline of -20%', factor: -0.20, icon: TrendingDown },
  { name: 'Interest Rate +200bp', description: 'Rates rise 2%, growth stocks hit', factor: -0.12, icon: AlertTriangle },
  { name: 'Tech Selloff', description: 'Technology sector drops -15%', factor: -0.15, icon: BarChart3 },
  { name: 'Oil Spike +50%', description: 'Energy surge, consumer drag', factor: -0.08, icon: AlertTriangle },
  { name: 'Inflation Surge', description: 'CPI jumps, real returns erode', factor: -0.10, icon: TrendingDown },
] as const;

// ─── Drawdown periods (mock) ─────────────────────────────────────────

const DRAWDOWN_PERIODS = [
  { label: 'Jan', depth: -2.1 },
  { label: 'Feb', depth: -5.4 },
  { label: 'Mar', depth: -8.7 },
  { label: 'Apr', depth: -6.2 },
  { label: 'May', depth: -3.1 },
  { label: 'Jun', depth: -1.5 },
  { label: 'Jul', depth: -0.8 },
  { label: 'Aug', depth: -4.3 },
  { label: 'Sep', depth: -7.9 },
  { label: 'Oct', depth: -11.2 },
  { label: 'Nov', depth: -6.5 },
  { label: 'Dec', depth: -3.8 },
];

// ─── Main page component ────────────────────────────────────────────

export function RiskPage() {
  const { positions } = usePortfolio();
  const [priceMap, setPriceMap] = useState<Record<string, PositionData>>({});

  const handlePriceData = useCallback((ticker: string, data: PositionData) => {
    setPriceMap((prev) => {
      if (
        prev[ticker] &&
        prev[ticker].price === data.price &&
        prev[ticker].shares === data.shares
      ) {
        return prev;
      }
      return { ...prev, [ticker]: data };
    });
  }, []);

  const positionsList = useMemo(
    () => Object.values(priceMap).filter((p) => positions.some((pos) => pos.ticker === p.ticker)),
    [priceMap, positions],
  );

  const totalValue = useMemo(
    () => positionsList.reduce((sum, p) => sum + p.shares * p.price, 0),
    [positionsList],
  );

  const riskMetrics = useMemo(() => {
    if (positionsList.length === 0) return null;
    const tickers = positionsList.map((p) => p.ticker).sort();
    const combined = tickers.join(',');
    const s = seed(combined);

    const volatility = 0.12 + pseudo(s, 1) * 0.18; // 12-30%
    const var95 = totalValue * volatility * 1.645 / Math.sqrt(252);
    const sharpe = 0.4 + pseudo(s, 2) * 1.4; // 0.4-1.8
    const maxDrawdown = -(0.08 + pseudo(s, 3) * 0.25); // -8% to -33%
    const beta = 0.6 + pseudo(s, 4) * 0.8; // 0.6-1.4

    return { volatility, var95, sharpe, maxDrawdown, beta };
  }, [positionsList, totalValue]);

  const correlationData = useMemo(() => {
    if (positionsList.length < 2) return null;
    const tickers = positionsList.map((p) => p.ticker).sort();
    const matrix: number[][] = [];
    for (let i = 0; i < tickers.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < tickers.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const pairSeed = seed(tickers[i] + tickers[j]);
          matrix[i][j] = -0.2 + pseudo(pairSeed, 7) * 1.1; // -0.2 to 0.9
          matrix[i][j] = Math.min(Math.max(matrix[i][j], -0.3), 0.95);
        }
      }
    }
    // Ensure symmetry
    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const avg = (matrix[i][j] + matrix[j][i]) / 2;
        matrix[i][j] = avg;
        matrix[j][i] = avg;
      }
    }
    return { tickers, matrix };
  }, [positionsList]);

  const riskContributions = useMemo(() => {
    if (positionsList.length === 0 || totalValue === 0) return [];
    return positionsList
      .map((p) => {
        const weight = (p.shares * p.price) / totalValue;
        const tickerVol = 0.15 + pseudo(seed(p.ticker), 5) * 0.25;
        const contribution = weight * tickerVol;
        return { ticker: p.ticker, weight, volatility: tickerVol, contribution };
      })
      .sort((a, b) => b.contribution - a.contribution);
  }, [positionsList, totalValue]);

  const diversificationScore = useMemo(() => {
    if (positionsList.length === 0) return 0;
    let score = Math.min(positionsList.length * 12, 50); // up to 50 for count
    if (correlationData) {
      const { matrix } = correlationData;
      let avgCorr = 0;
      let pairs = 0;
      for (let i = 0; i < matrix.length; i++) {
        for (let j = i + 1; j < matrix.length; j++) {
          avgCorr += Math.abs(matrix[i][j]);
          pairs++;
        }
      }
      if (pairs > 0) {
        avgCorr /= pairs;
        score += Math.round((1 - avgCorr) * 50); // up to 50 for low correlation
      }
    }
    return Math.min(score, 100);
  }, [positionsList, correlationData]);

  // ─── Empty state ───────────────────────────────────────────────────

  if (positions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-7 w-7 text-rose-500" />
            Risk Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Analyze portfolio risk, correlation, and stress scenarios
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-12 text-center dark:border-slate-700">
          <Shield className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700" />
          <h3 className="mt-4 text-lg font-semibold">No portfolio positions</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add positions to your portfolio to see risk analytics.
          </p>
          <Link
            to="/portfolio"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            Go to Portfolio
          </Link>
        </div>
      </div>
    );
  }

  const maxContribution = riskContributions.length > 0 ? riskContributions[0].contribution : 1;

  return (
    <div className="space-y-6">
      {/* Price fetchers */}
      {positions.map((pos) => (
        <PositionPriceFetcher
          key={pos.ticker}
          ticker={pos.ticker}
          shares={pos.shares}
          avgCost={pos.avgCost}
          onData={handlePriceData}
        />
      ))}

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-7 w-7 text-rose-500" />
          Risk Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Analyze portfolio risk, correlation, and stress scenarios
        </p>
      </div>

      {/* Overview cards */}
      {riskMetrics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Portfolio Value" value={formatPrice(totalValue)} />
          <MetricCard label="Daily VaR (95%)" value={formatPrice(riskMetrics.var95)} variant="danger" />
          <MetricCard label="Sharpe Ratio" value={riskMetrics.sharpe.toFixed(2)} variant={riskMetrics.sharpe > 1 ? 'success' : 'warning'} />
          <MetricCard label="Max Drawdown" value={formatPercent(riskMetrics.maxDrawdown * 100)} variant="danger" />
          <MetricCard label="Beta (vs S&P)" value={riskMetrics.beta.toFixed(2)} variant={riskMetrics.beta > 1.2 ? 'warning' : 'neutral'} />
          <MetricCard label="Volatility (Ann.)" value={formatPercent(riskMetrics.volatility * 100)} variant={riskMetrics.volatility > 0.2 ? 'warning' : 'neutral'} />
        </div>
      )}

      {/* Two-column layout: correlation + risk contribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Correlation matrix */}
        {correlationData && (
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Target className="h-4 w-4" />
              Correlation Matrix
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-1" />
                    {correlationData.tickers.map((t) => (
                      <th key={t} className="p-1 text-center font-mono text-slate-400">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlationData.tickers.map((rowTicker, i) => (
                    <tr key={rowTicker}>
                      <td className="p-1 text-right font-mono text-slate-400">{rowTicker}</td>
                      {correlationData.matrix[i].map((val, j) => (
                        <td
                          key={j}
                          className="p-1 text-center font-mono"
                          style={{
                            backgroundColor: corrColor(val),
                            color: Math.abs(val) > 0.6 ? '#fff' : '#94a3b8',
                          }}
                        >
                          {val.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              Green = low correlation (diversified) / Red = high correlation
            </p>
          </div>
        )}

        {/* Risk contribution breakdown */}
        {riskContributions.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <BarChart3 className="h-4 w-4" />
              Risk Contribution
            </h2>
            <div className="space-y-2">
              {riskContributions.map((rc) => (
                <div key={rc.ticker} className="flex items-center gap-3">
                  <span className="w-14 text-right font-mono text-xs text-slate-300">{rc.ticker}</span>
                  <div className="flex-1">
                    <div className="h-5 rounded bg-slate-700/50">
                      <div
                        className="flex h-5 items-center rounded bg-rose-600/70 px-2 text-xs text-white"
                        style={{ width: `${Math.max((rc.contribution / maxContribution) * 100, 8)}%` }}
                      >
                        {(rc.contribution * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <span className="w-20 text-right text-xs text-slate-500">
                    wt {(rc.weight * 100).toFixed(1)}% / vol {(rc.volatility * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drawdown chart */}
      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <TrendingDown className="h-4 w-4" />
          Historical Drawdown
        </h2>
        <div className="flex items-end gap-1" style={{ height: 160 }}>
          {DRAWDOWN_PERIODS.map((period) => {
            const maxDepth = 12; // scale factor
            const barHeight = (Math.abs(period.depth) / maxDepth) * 100;
            return (
              <div key={period.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500">{period.depth.toFixed(1)}%</span>
                <div className="w-full flex-1 flex flex-col justify-end">
                  <div
                    className={cn(
                      'w-full rounded-t',
                      Math.abs(period.depth) > 8 ? 'bg-rose-600' : Math.abs(period.depth) > 4 ? 'bg-amber-600' : 'bg-emerald-600',
                    )}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{period.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom row: stress tests + diversification score */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stress test scenarios */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <AlertTriangle className="h-4 w-4" />
            Stress Test Scenarios
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs text-slate-500">
                <th className="pb-2 text-left font-medium">Scenario</th>
                <th className="pb-2 text-left font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Impact</th>
                <th className="pb-2 text-right font-medium">Est. Loss</th>
              </tr>
            </thead>
            <tbody>
              {STRESS_SCENARIOS.map((scenario) => {
                const loss = totalValue * scenario.factor;
                const Icon = scenario.icon;
                return (
                  <tr key={scenario.name} className="border-b border-slate-700/50">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-medium text-slate-200">{scenario.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-400">{scenario.description}</td>
                    <td className="py-2.5 text-right font-mono text-rose-400">
                      {formatPercent(scenario.factor * 100)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-rose-400">
                      {formatPrice(Math.abs(loss))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Diversification score gauge */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Target className="h-4 w-4" />
            Diversification Score
          </h2>
          <div className="flex flex-col items-center py-4">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="10"
                />
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke={diversificationScore >= 70 ? '#22c55e' : diversificationScore >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={`${(diversificationScore / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{diversificationScore}</span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
            </div>
            <p className={cn(
              'mt-3 text-sm font-medium',
              diversificationScore >= 70 ? 'text-emerald-400' : diversificationScore >= 40 ? 'text-amber-400' : 'text-rose-400',
            )}>
              {diversificationScore >= 70 ? 'Well Diversified' : diversificationScore >= 40 ? 'Moderate' : 'Concentrated'}
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              Based on {positionsList.length} holding{positionsList.length !== 1 ? 's' : ''} and inter-asset correlation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const colorMap = {
    neutral: 'text-white',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn('mt-1 text-lg font-bold', colorMap[variant])}>{value}</p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function corrColor(val: number): string {
  if (val >= 0.7) return 'rgba(239, 68, 68, 0.5)';   // red - high correlation
  if (val >= 0.4) return 'rgba(245, 158, 11, 0.3)';   // amber
  if (val >= 0.1) return 'rgba(100, 116, 139, 0.2)';   // neutral
  return 'rgba(34, 197, 94, 0.3)';                      // green - low/negative correlation
}
