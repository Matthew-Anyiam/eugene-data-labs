import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileBarChart, Download, FileText, Building2, Briefcase,
  BarChart3, Clock, Loader2, CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePrices } from '../hooks/usePrices';
import { useMetrics } from '../hooks/useMetrics';
import { useProfile } from '../hooks/useProfile';
import { downloadCSV, downloadJSON } from '../lib/export';
import { cn } from '../lib/utils';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'company' | 'portfolio' | 'market';
  fields: string[];
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'company-tearsheet',
    name: 'Company Tearsheet',
    description: 'One-page summary with profile, price, key metrics, and valuation ratios',
    icon: <Building2 className="h-5 w-5 text-blue-500" />,
    category: 'company',
    fields: ['profile', 'price', 'metrics', 'valuation'],
  },
  {
    id: 'financial-snapshot',
    name: 'Financial Snapshot',
    description: 'P&L highlights, balance sheet ratios, and cash flow summary',
    icon: <BarChart3 className="h-5 w-5 text-emerald-500" />,
    category: 'company',
    fields: ['income_statement', 'balance_sheet', 'cash_flow', 'ratios'],
  },
  {
    id: 'portfolio-summary',
    name: 'Portfolio Summary',
    description: 'All positions with current prices, P&L, allocation weights',
    icon: <Briefcase className="h-5 w-5 text-violet-500" />,
    category: 'portfolio',
    fields: ['positions', 'prices', 'allocation', 'performance'],
  },
  {
    id: 'watchlist-report',
    name: 'Watchlist Report',
    description: 'Current watchlist tickers with prices, changes, and key metrics',
    icon: <FileText className="h-5 w-5 text-amber-500" />,
    category: 'market',
    fields: ['watchlist', 'prices', 'metrics'],
  },
];

interface GeneratedReport {
  id: string;
  templateId: string;
  templateName: string;
  ticker?: string;
  generatedAt: number;
  format: 'csv' | 'json';
  status: 'pending' | 'ready' | 'error';
}

export function ReportsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [ticker, setTicker] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([]);
  const [generating, setGenerating] = useState(false);

  const { tickers: watchlist } = useWatchlist();
  const { positions } = usePortfolio();
  const template = REPORT_TEMPLATES.find((t) => t.id === selectedTemplate);

  const needsTicker = template?.category === 'company';
  const canGenerate = selectedTemplate && (!needsTicker || ticker.trim().length > 0);

  const handleGenerate = useCallback(() => {
    if (!template || !canGenerate) return;
    const report: GeneratedReport = {
      id: `rpt_${Date.now()}`,
      templateId: template.id,
      templateName: template.name,
      ticker: needsTicker ? ticker.trim().toUpperCase() : undefined,
      generatedAt: Date.now(),
      format,
      status: 'pending',
    };
    setRecentReports((prev) => [report, ...prev].slice(0, 20));
    setGenerating(true);

    // Simulate generation (actual data download happens via child component)
    setTimeout(() => {
      setRecentReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: 'ready' } : r))
      );
      setGenerating(false);
    }, 500);
  }, [template, canGenerate, needsTicker, ticker, format]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileBarChart className="h-7 w-7 text-indigo-500" />
          Reports
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Generate and download structured financial reports
        </p>
      </div>

      {/* Template selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REPORT_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => {
              setSelectedTemplate(tmpl.id);
              setTicker('');
            }}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 text-left transition-all',
              selectedTemplate === tmpl.id
                ? 'border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-200 dark:border-indigo-600 dark:bg-indigo-900/10 dark:ring-indigo-800'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/30'
            )}
          >
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              selectedTemplate === tmpl.id
                ? 'bg-indigo-100 dark:bg-indigo-900/30'
                : 'bg-slate-100 dark:bg-slate-800'
            )}>
              {tmpl.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tmpl.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tmpl.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {tmpl.fields.map((f) => (
                  <span
                    key={f}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Configuration panel */}
      {selectedTemplate && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-800/50 dark:bg-indigo-900/5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Configure: {template?.name}
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            {needsTicker && (
              <div className="w-32">
                <label className="mb-1 block text-xs font-medium text-slate-500">Ticker</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  maxLength={10}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            )}

            {template?.category === 'portfolio' && positions.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No portfolio positions. <Link to="/portfolio" className="underline">Add some first</Link>.
              </p>
            )}

            {template?.category === 'market' && watchlist.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Watchlist is empty. Add tickers to your watchlist first.
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Format</label>
              <div className="flex gap-1">
                {(['csv', 'json'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-medium uppercase transition-colors',
                      format === f
                        ? 'border-indigo-400 bg-indigo-100 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Data downloaders — render when reports are ready */}
      {recentReports
        .filter((r) => r.status === 'ready')
        .map((r) => (
          <ReportDownloader key={r.id} report={r} />
        ))}

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Recent Reports
          </h2>
          <div className="space-y-2">
            {recentReports.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  r.status === 'ready' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                  r.status === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-slate-100 dark:bg-slate-800'
                )}>
                  {r.status === 'ready' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : r.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {r.templateName}
                    {r.ticker && <span className="ml-1.5 font-mono text-xs text-slate-500">({r.ticker})</span>}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    <Clock className="mr-0.5 inline h-3 w-3" />
                    {new Date(r.generatedAt).toLocaleTimeString()}
                    <span className="ml-2 uppercase">{r.format}</span>
                  </p>
                </div>
                {r.status === 'ready' && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Downloaded
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedTemplate && recentReports.length === 0 && (
        <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
          <FileBarChart className="mx-auto h-10 w-10 text-slate-200 dark:text-slate-700" />
          <p className="mt-2 text-sm text-slate-400">Select a report template above to get started</p>
        </div>
      )}
    </div>
  );
}

// ─── Report downloader — fetches data and triggers download ──────────

function ReportDownloader({ report }: { report: GeneratedReport }) {
  // This component renders invisibly and triggers the download
  switch (report.templateId) {
    case 'company-tearsheet':
    case 'financial-snapshot':
      return report.ticker ? (
        <CompanyReportDownloader ticker={report.ticker} format={report.format} templateId={report.templateId} />
      ) : null;
    case 'portfolio-summary':
      return <PortfolioReportDownloader format={report.format} />;
    case 'watchlist-report':
      return <WatchlistReportDownloader format={report.format} />;
    default:
      return null;
  }
}

function CompanyReportDownloader({
  ticker,
  format,
  templateId,
}: {
  ticker: string;
  format: 'csv' | 'json';
  templateId: string;
}) {
  const { data: priceData } = usePrices(ticker);
  const { data: metricsData } = useMetrics(ticker);
  const { data: profileData } = useProfile(ticker);

  useDownloadOnce(() => {
    if (!priceData) return false;

    const date = new Date().toISOString().slice(0, 10);
    const filename = `eugene-${templateId}-${ticker}-${date}`;

    if (format === 'json') {
      downloadJSON(
        {
          ticker,
          generated_at: new Date().toISOString(),
          template: templateId,
          profile: profileData || null,
          price: priceData || null,
          metrics: metricsData?.data?.periods?.[0]?.metrics || null,
        },
        filename,
      );
    } else {
      const period = metricsData?.data?.periods?.[0]?.metrics as any;
      const rows = [
        {
          ticker,
          price: priceData?.price ?? '',
          change: priceData?.change ?? '',
          change_pct: priceData?.change_percent ?? '',
          market_cap: priceData?.market_cap ?? '',
          pe_ratio: period?.valuation?.pe_ratio ?? '',
          pb_ratio: period?.valuation?.price_to_book ?? '',
          ev_ebitda: period?.valuation?.ev_to_ebitda ?? '',
          eps: period?.per_share?.eps_diluted ?? '',
          roe: period?.profitability?.return_on_equity ?? '',
          roa: period?.profitability?.return_on_assets ?? '',
          gross_margin: period?.profitability?.gross_margin ?? '',
          net_margin: period?.profitability?.net_margin ?? '',
          current_ratio: period?.liquidity?.current_ratio ?? '',
          debt_equity: period?.leverage?.debt_to_equity ?? '',
        },
      ];
      downloadCSV(rows, filename, [
        { key: 'ticker', label: 'Ticker' },
        { key: 'price', label: 'Price' },
        { key: 'change', label: 'Change' },
        { key: 'change_pct', label: 'Change %' },
        { key: 'market_cap', label: 'Market Cap' },
        { key: 'pe_ratio', label: 'P/E' },
        { key: 'pb_ratio', label: 'P/B' },
        { key: 'ev_ebitda', label: 'EV/EBITDA' },
        { key: 'eps', label: 'EPS' },
        { key: 'roe', label: 'ROE' },
        { key: 'roa', label: 'ROA' },
        { key: 'gross_margin', label: 'Gross Margin' },
        { key: 'net_margin', label: 'Net Margin' },
        { key: 'current_ratio', label: 'Current Ratio' },
        { key: 'debt_equity', label: 'Debt/Equity' },
      ]);
    }
    return true;
  }, [priceData, metricsData, profileData]);

  return null;
}

function PortfolioReportDownloader({ format }: { format: 'csv' | 'json' }) {
  const { positions } = usePortfolio();

  useDownloadOnce(() => {
    if (positions.length === 0) return true; // nothing to export

    const date = new Date().toISOString().slice(0, 10);
    const filename = `eugene-portfolio-${date}`;

    if (format === 'json') {
      downloadJSON({ generated_at: new Date().toISOString(), positions }, filename);
    } else {
      downloadCSV(
        positions.map((p) => ({
          ticker: p.ticker,
          shares: p.shares,
          avg_cost: p.avgCost.toFixed(2),
          cost_basis: (p.shares * p.avgCost).toFixed(2),
        })),
        filename,
        [
          { key: 'ticker', label: 'Ticker' },
          { key: 'shares', label: 'Shares' },
          { key: 'avg_cost', label: 'Avg Cost' },
          { key: 'cost_basis', label: 'Cost Basis' },
        ],
      );
    }
    return true;
  }, [positions]);

  return null;
}

function WatchlistReportDownloader({ format }: { format: 'csv' | 'json' }) {
  const { tickers } = useWatchlist();

  useDownloadOnce(() => {
    if (tickers.length === 0) return true;

    const date = new Date().toISOString().slice(0, 10);
    const filename = `eugene-watchlist-${date}`;

    if (format === 'json') {
      downloadJSON({ generated_at: new Date().toISOString(), tickers }, filename);
    } else {
      downloadCSV(
        tickers.map((t) => ({ ticker: t })),
        filename,
        [{ key: 'ticker', label: 'Ticker' }],
      );
    }
    return true;
  }, [tickers]);

  return null;
}

// ─── Utility hook: download once when data is ready ──────────────────

function useDownloadOnce(fn: () => boolean, _deps: any[]) {
  const [done, setDone] = useState(false);

  if (!done) {
    const result = fn();
    if (result) setDone(true);
  }

  return done;
}
