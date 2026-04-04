import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GitCompareArrows, Plus, X } from 'lucide-react';
import { usePrices } from '../hooks/usePrices';
import { useMetrics } from '../hooks/useMetrics';
import { formatPrice, formatCurrency, cn } from '../lib/utils';

const MAX_COMPARE = 4;

const POPULAR_COMPARISONS = [
  { label: 'Big Tech', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN'] },
  { label: 'Mega Caps', tickers: ['AAPL', 'NVDA', 'MSFT', 'META'] },
  { label: 'Banks', tickers: ['JPM', 'BAC', 'GS', 'MS'] },
  { label: 'EV / Auto', tickers: ['TSLA', 'F', 'GM', 'RIVN'] },
  { label: 'Streaming', tickers: ['NFLX', 'DIS', 'WBD', 'PARA'] },
  { label: 'Pharma', tickers: ['PFE', 'LLY', 'JNJ', 'UNH'] },
];

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tickersParam = searchParams.get('tickers') || '';
  const tickers = tickersParam ? tickersParam.split(',').filter(Boolean).slice(0, MAX_COMPARE) : [];

  const [inputValue, setInputValue] = useState('');

  const addTicker = (t: string) => {
    const upper = t.trim().toUpperCase();
    if (!upper || tickers.includes(upper) || tickers.length >= MAX_COMPARE) return;
    const next = [...tickers, upper];
    setSearchParams({ tickers: next.join(',') }, { replace: true });
    setInputValue('');
  };

  const removeTicker = (t: string) => {
    const next = tickers.filter((x) => x !== t);
    if (next.length > 0) {
      setSearchParams({ tickers: next.join(',') }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const setTickers = (ts: string[]) => {
    setSearchParams({ tickers: ts.join(',') }, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitCompareArrows className="h-7 w-7 text-indigo-500" />
          Compare Companies
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Side-by-side comparison of up to {MAX_COMPARE} companies
        </p>
      </div>

      {/* Ticker input + chips */}
      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          {tickers.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-800"
            >
              <Link to={`/company/${t}`} className="font-mono hover:text-blue-600 dark:hover:text-blue-400">
                {t}
              </Link>
              <button
                onClick={() => removeTicker(t)}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {tickers.length < MAX_COMPARE && (
            <form
              onSubmit={(e) => { e.preventDefault(); addTicker(inputValue); }}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                placeholder="Add ticker..."
                maxLength={10}
                className="w-28 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-mono placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="rounded-md bg-indigo-600 p-1.5 text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Quick comparisons */}
        {tickers.length === 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-slate-400">Popular comparisons:</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_COMPARISONS.map((pc) => (
                <button
                  key={pc.label}
                  onClick={() => setTickers(pc.tickers)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300"
                >
                  {pc.label}: {pc.tickers.join(', ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comparison content */}
      {tickers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 p-12 text-center dark:border-slate-700">
          <GitCompareArrows className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700" />
          <h3 className="mt-3 font-medium text-slate-600 dark:text-slate-400">Add tickers to compare</h3>
          <p className="mt-1 text-sm text-slate-400">
            Enter tickers above or select a popular comparison
          </p>
        </div>
      ) : tickers.length === 1 ? (
        <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500">Add at least one more ticker to compare</p>
        </div>
      ) : (
        <ComparisonGrid tickers={tickers} />
      )}
    </div>
  );
}

// ─── Comparison grid ──────────────────────────────────────────────────

function ComparisonGrid({ tickers }: { tickers: string[] }) {
  return (
    <div className="space-y-6">
      {/* Price comparison */}
      <PriceComparison tickers={tickers} />

      {/* Metrics comparison */}
      <MetricsComparison tickers={tickers} />
    </div>
  );
}

function PriceComparison({ tickers }: { tickers: string[] }) {
  // We'll render each ticker's data via individual hooks inside a child component
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Price Overview</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Metric</th>
              {tickers.map((t) => (
                <th key={t} className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">
                  <Link to={`/company/${t}`} className="font-mono hover:text-blue-600 dark:hover:text-blue-400">{t}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <PriceRows tickers={tickers} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceRows({ tickers }: { tickers: string[] }) {
  // For each ticker, use hooks at top level (hooks must be called consistently)
  // We'll use a PriceCell component per ticker per row instead
  const rows = [
    { label: 'Price', key: 'price' },
    { label: 'Change', key: 'change' },
    { label: 'Change %', key: 'change_percent' },
    { label: 'Market Cap', key: 'market_cap' },
    { label: 'Volume', key: 'volume' },
    { label: 'Day High', key: 'day_high' },
    { label: 'Day Low', key: 'day_low' },
    { label: '52W High', key: 'year_high' },
    { label: '52W Low', key: 'year_low' },
    { label: '50D Avg', key: 'avg_50' },
    { label: '200D Avg', key: 'avg_200' },
  ] as const;

  return (
    <>
      {rows.map((row) => (
        <tr key={row.key} className="border-b border-slate-50 dark:border-slate-800/50">
          <td className="px-4 py-2 text-xs font-medium text-slate-500">{row.label}</td>
          {tickers.map((t) => (
            <PriceCell key={t} ticker={t} field={row.key} />
          ))}
        </tr>
      ))}
    </>
  );
}

function PriceCell({ ticker, field }: { ticker: string; field: string }) {
  const { data, isLoading } = usePrices(ticker);

  if (isLoading) {
    return (
      <td className="px-4 py-2 text-right">
        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </td>
    );
  }

  if (!data) {
    return <td className="px-4 py-2 text-right text-xs text-slate-400">--</td>;
  }

  const value = (data as any)[field];
  let display = '--';
  let colorClass = '';

  if (field === 'price' || field === 'day_high' || field === 'day_low' || field === 'year_high' || field === 'year_low' || field === 'avg_50' || field === 'avg_200') {
    display = value != null ? formatPrice(value) : '--';
  } else if (field === 'change') {
    if (value != null) {
      display = `${value >= 0 ? '+' : ''}${formatPrice(Math.abs(value))}`;
      colorClass = value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    }
  } else if (field === 'change_percent') {
    if (value != null) {
      display = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
      colorClass = value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    }
  } else if (field === 'market_cap') {
    display = value > 0 ? formatCurrency(value) : '--';
  } else if (field === 'volume') {
    display = value > 0 ? value.toLocaleString() : '--';
  }

  return (
    <td className={cn('px-4 py-2 text-right tabular-nums text-sm font-medium', colorClass)}>
      {display}
    </td>
  );
}

function MetricsComparison({ tickers }: { tickers: string[] }) {
  const METRIC_ROWS: { label: string; category: string; key: string; format?: string }[] = [
    { label: 'P/E Ratio', category: 'valuation', key: 'pe_ratio' },
    { label: 'P/B Ratio', category: 'valuation', key: 'price_to_book' },
    { label: 'EV/EBITDA', category: 'valuation', key: 'ev_to_ebitda' },
    { label: 'EPS (Diluted)', category: 'per_share', key: 'eps_diluted', format: 'dollar' },
    { label: 'Book Value/Share', category: 'per_share', key: 'book_value_per_share', format: 'dollar' },
    { label: 'Gross Margin', category: 'profitability', key: 'gross_margin', format: 'percent' },
    { label: 'Net Margin', category: 'profitability', key: 'net_margin', format: 'percent' },
    { label: 'ROE', category: 'profitability', key: 'return_on_equity', format: 'percent' },
    { label: 'ROA', category: 'profitability', key: 'return_on_assets', format: 'percent' },
    { label: 'Current Ratio', category: 'liquidity', key: 'current_ratio' },
    { label: 'Quick Ratio', category: 'liquidity', key: 'quick_ratio' },
    { label: 'Debt/Equity', category: 'leverage', key: 'debt_to_equity' },
    { label: 'Revenue Growth', category: 'growth', key: 'revenue_growth', format: 'percent' },
    { label: 'Earnings Growth', category: 'growth', key: 'earnings_growth', format: 'percent' },
  ];

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Financial Metrics</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Metric</th>
              {tickers.map((t) => (
                <th key={t} className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">
                  <Link to={`/company/${t}`} className="font-mono hover:text-blue-600 dark:hover:text-blue-400">{t}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-slate-50 dark:border-slate-800/50">
                <td className="px-4 py-2 text-xs font-medium text-slate-500">{row.label}</td>
                {tickers.map((t) => (
                  <MetricCell
                    key={t}
                    ticker={t}
                    category={row.category}
                    metricKey={row.key}
                    format={row.format}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCell({
  ticker,
  category,
  metricKey,
  format,
}: {
  ticker: string;
  category: string;
  metricKey: string;
  format?: string;
}) {
  const { data, isLoading } = useMetrics(ticker);

  if (isLoading) {
    return (
      <td className="px-4 py-2 text-right">
        <div className="ml-auto h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </td>
    );
  }

  const period = data?.data?.periods?.[0];
  const metrics = period?.metrics as any;
  const value = metrics?.[category]?.[metricKey];

  if (value == null) {
    return <td className="px-4 py-2 text-right text-xs text-slate-400">--</td>;
  }

  let display: string;
  let colorClass = '';

  if (format === 'percent') {
    display = `${(value * 100).toFixed(1)}%`;
    if (metricKey.includes('growth')) {
      colorClass = value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    }
  } else if (format === 'dollar') {
    display = `$${value.toFixed(2)}`;
  } else {
    display = value.toFixed(2);
  }

  return (
    <td className={cn('px-4 py-2 text-right tabular-nums text-sm font-medium', colorClass)}>
      {display}
    </td>
  );
}
