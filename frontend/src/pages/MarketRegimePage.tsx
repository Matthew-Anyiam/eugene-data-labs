import { useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Shield, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEconomics } from '../../hooks/useEconomics';
import { useNewsSentiment } from '../../hooks/useNewsSentiment';

interface FredSeries {
  id: string;
  title: string;
  value: number;
  date: string;
  frequency: string;
}

interface FredCategory {
  category: string;
  series: FredSeries[];
}

interface SentimentResult {
  sentiment_score: number;
  positive_percentage: number;
  negative_percentage: number;
  articles_analyzed: number;
  trend: string;
}

type Regime = 'Bull' | 'Bear' | 'Recovery' | 'Distribution';
type VolRegime = 'Low Vol' | 'Normal' | 'High Vol' | 'Crisis';

const REGIME_STYLES: Record<Regime, { bg: string; text: string; border: string }> = {
  Bull: {
    bg: 'bg-emerald-900/30',
    text: 'text-emerald-400',
    border: 'border-emerald-700/50',
  },
  Bear: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-700/50' },
  Recovery: {
    bg: 'bg-amber-900/30',
    text: 'text-amber-400',
    border: 'border-amber-700/50',
  },
  Distribution: {
    bg: 'bg-purple-900/30',
    text: 'text-purple-400',
    border: 'border-purple-700/50',
  },
};

const VOL_COLOR: Record<VolRegime, string> = {
  'Low Vol': 'text-emerald-400',
  Normal: 'text-slate-300',
  'High Vol': 'text-amber-400',
  Crisis: 'text-red-400',
};

// Known FRED series IDs and their interpretive context
const KNOWN_SERIES: Record<
  string,
  { label: string; bullishAbove?: number; bullishBelow?: number; description: string }
> = {
  CPIAUCSL: {
    label: 'CPI (YoY)',
    description: 'Consumer Price Index — inflation signal',
    bullishBelow: 3,
  },
  UNRATE: {
    label: 'Unemployment Rate',
    description: 'U-3 unemployment rate',
    bullishBelow: 5,
  },
  GDP: { label: 'Real GDP', description: 'Quarterly real GDP', bullishAbove: 0 },
  FEDFUNDS: {
    label: 'Fed Funds Rate',
    description: 'Effective federal funds rate',
    bullishBelow: 3.5,
  },
  T10Y2Y: {
    label: 'Yield Curve (10Y-2Y)',
    description: 'Treasury yield spread — inversion signals recession',
    bullishAbove: 0,
  },
  UMCSENT: {
    label: 'Consumer Sentiment',
    description: 'Univ. of Michigan consumer sentiment',
    bullishAbove: 80,
  },
  NAPM: {
    label: 'ISM Manufacturing',
    description: 'Manufacturing PMI',
    bullishAbove: 50,
  },
  VIXCLS: {
    label: 'VIX',
    description: 'CBOE Volatility Index',
    bullishBelow: 20,
  },
};

function getSignal(
  series: FredSeries,
): { signal: 'bullish' | 'bearish' | 'neutral'; label: string; description: string } {
  const meta = KNOWN_SERIES[series.id];
  const label = meta?.label ?? series.title;
  const description = meta?.description ?? series.title;
  if (!meta) return { signal: 'neutral', label, description };

  if (meta.bullishAbove !== undefined) {
    return {
      signal:
        series.value > meta.bullishAbove
          ? 'bullish'
          : series.value < meta.bullishAbove * 0.9
            ? 'bearish'
            : 'neutral',
      label,
      description,
    };
  }
  if (meta.bullishBelow !== undefined) {
    return {
      signal:
        series.value < meta.bullishBelow
          ? 'bullish'
          : series.value > meta.bullishBelow * 1.2
            ? 'bearish'
            : 'neutral',
      label,
      description,
    };
  }
  return { signal: 'neutral', label, description };
}

function deriveRegime(
  bullish: number,
  total: number,
  sentimentScore: number,
): { regime: Regime; confidence: number } {
  const bullRatio = total > 0 ? bullish / total : 0;
  const sentBoost = sentimentScore > 0.2 ? 0.1 : sentimentScore < -0.2 ? -0.1 : 0;
  const score = bullRatio + sentBoost;

  const regime: Regime =
    score >= 0.65 ? 'Bull' : score >= 0.45 ? 'Recovery' : score >= 0.25 ? 'Distribution' : 'Bear';
  const confidence = Math.round(Math.min(95, Math.max(40, score * 100 + 20)));
  return { regime, confidence };
}

function deriveVolRegime(series: FredSeries[]): VolRegime {
  const vix = series.find((s) => s.id === 'VIXCLS');
  if (!vix) return 'Normal';
  if (vix.value < 15) return 'Low Vol';
  if (vix.value < 20) return 'Normal';
  if (vix.value < 30) return 'High Vol';
  return 'Crisis';
}

export function MarketRegimePage() {
  const { data: economicsData, isLoading: econLoading, isError: econError } =
    useEconomics('all') as { data: FredCategory | undefined; isLoading: boolean; isError: boolean };

  const { data: sentimentData, isLoading: sentLoading, isError: sentError } =
    useNewsSentiment('market economy', '7d') as {
      data: SentimentResult | undefined;
      isLoading: boolean;
      isError: boolean;
    };

  const series: FredSeries[] = economicsData?.series ?? [];
  const sentimentScore = sentimentData?.sentiment_score ?? 0;

  const indicators = useMemo(
    () =>
      series.map((s) => {
        const { signal, label, description } = getSignal(s);
        return { ...s, signal, label, description };
      }),
    [series],
  );

  const bullishCount = indicators.filter((i) => i.signal === 'bullish').length;
  const bearishCount = indicators.filter((i) => i.signal === 'bearish').length;

  const { regime, confidence } = useMemo(
    () => deriveRegime(bullishCount, indicators.length, sentimentScore),
    [bullishCount, indicators.length, sentimentScore],
  );

  const volRegime = useMemo(() => deriveVolRegime(series), [series]);

  const regimeStyle = REGIME_STYLES[regime];

  const isLoading = econLoading || sentLoading;
  const isError = econError || sentError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <span className="ml-3 text-slate-400">Loading macro indicators…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-red-400">Failed to load market regime data. Please try again.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Market Regime</h1>
          <p className="text-sm text-slate-400">
            Regime detection from macro indicators and news sentiment
          </p>
        </div>
      </div>

      {/* Current regime */}
      <div className={cn('rounded-xl border p-6', regimeStyle.border, regimeStyle.bg)}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Current Market Regime
            </div>
            <div className={cn('mt-1 text-3xl font-bold', regimeStyle.text)}>{regime}</div>
            <div className="mt-1 text-xs text-slate-400">
              Based on {indicators.length} macro indicators
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Model Confidence</div>
            <div className={cn('text-2xl font-bold', regimeStyle.text)}>{confidence}%</div>
            <div className={cn('text-xs', VOL_COLOR[volRegime])}>Vol: {volRegime}</div>
          </div>
        </div>
      </div>

      {/* Sentiment row */}
      {sentimentData && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            {
              label: 'News Sentiment',
              value: sentimentData.sentiment_score >= 0
                ? `+${sentimentData.sentiment_score.toFixed(2)}`
                : sentimentData.sentiment_score.toFixed(2),
              color: sentimentData.sentiment_score >= 0 ? 'text-emerald-400' : 'text-red-400',
            },
            {
              label: 'Positive News',
              value: `${sentimentData.positive_percentage.toFixed(1)}%`,
              color: 'text-emerald-400',
            },
            {
              label: 'Negative News',
              value: `${sentimentData.negative_percentage.toFixed(1)}%`,
              color: 'text-red-400',
            },
            {
              label: 'Articles Analysed',
              value: sentimentData.articles_analyzed.toLocaleString(),
              color: 'text-slate-300',
            },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
              <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Signal summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-700/50 bg-slate-800 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Bullish Signals</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">
            {bullishCount} / {indicators.length}
          </div>
        </div>
        <div className="rounded-xl border border-red-700/50 bg-slate-800 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Bearish Signals</div>
          <div className="mt-1 text-2xl font-bold text-red-400">
            {bearishCount} / {indicators.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Neutral Signals</div>
          <div className="mt-1 text-2xl font-bold text-slate-300">
            {indicators.length - bullishCount - bearishCount} / {indicators.length}
          </div>
        </div>
      </div>

      {/* Indicator cards */}
      {indicators.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {indicators.map((ind) => (
            <div
              key={ind.id}
              className={cn(
                'rounded-xl border bg-slate-800 p-4',
                ind.signal === 'bullish'
                  ? 'border-emerald-700/30'
                  : ind.signal === 'bearish'
                    ? 'border-red-700/30'
                    : 'border-slate-700',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white">{ind.label}</span>
                {ind.signal === 'bullish' ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                ) : ind.signal === 'bearish' ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <div
                className={cn(
                  'mt-2 text-xl font-bold',
                  ind.signal === 'bullish'
                    ? 'text-emerald-400'
                    : ind.signal === 'bearish'
                      ? 'text-red-400'
                      : 'text-slate-300',
                )}
              >
                {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
              </div>
              <div className="text-[10px] text-slate-500">{ind.description}</div>
              <div className="mt-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                    ind.signal === 'bullish'
                      ? 'bg-emerald-900/40 text-emerald-400'
                      : ind.signal === 'bearish'
                        ? 'bg-red-900/40 text-red-400'
                        : 'bg-slate-700 text-slate-400',
                  )}
                >
                  {ind.signal}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full indicator table */}
      {indicators.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">
                  Indicator
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Date</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">
                  Signal
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {indicators.map((ind) => (
                <tr key={ind.id} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs font-medium text-white">{ind.label}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right text-xs font-medium',
                      ind.signal === 'bullish'
                        ? 'text-emerald-400'
                        : ind.signal === 'bearish'
                          ? 'text-red-400'
                          : 'text-slate-300',
                    )}
                  >
                    {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-500">{ind.date}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        ind.signal === 'bullish'
                          ? 'bg-emerald-900/40 text-emerald-400'
                          : ind.signal === 'bearish'
                            ? 'bg-red-900/40 text-red-400'
                            : 'bg-slate-700 text-slate-300',
                      )}
                    >
                      {ind.signal}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{ind.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {indicators.length === 0 && !isLoading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center">
          <p className="text-sm text-slate-400">No macro indicators available.</p>
        </div>
      )}
    </div>
  );
}
