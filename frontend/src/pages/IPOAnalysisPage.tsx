import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rocket, Loader2, ExternalLink, Calendar, Search, Info } from 'lucide-react';
import { eugeneApi } from '../lib/api';
import type { EugeneResponse, FilingsData } from '../lib/types';
import { cn } from '../lib/utils';

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'NFLX'];

export function IPOAnalysisPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [input, setInput] = useState('');

  const { data, isLoading, isError, error } = useQuery<EugeneResponse<FilingsData>>({
    queryKey: ['ipo-filings', ticker],
    queryFn: () =>
      eugeneApi<EugeneResponse<FilingsData>>(
        `/v1/sec/${encodeURIComponent(ticker)}?extract=filings&form=S-1&limit=20`
      ),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });

  const filings = data?.data?.filings ?? [];
  const s1Filings = filings.filter(
    (f) => f.form === 'S-1' || f.form === 'S-1/A' || f.form === 'S-1A'
  );
  const companyName = data?.resolved?.company ?? ticker;

  const handleSearch = () => {
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setInput(''); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Rocket className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">IPO Analysis</h1>
          <p className="text-sm text-slate-400">
            Browse S-1 and S-1/A registration filings by ticker
          </p>
        </div>
      </div>

      {/* Full IPO calendar banner */}
      <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
        <Calendar className="h-5 w-5 flex-shrink-0 text-indigo-400" />
        <div>
          <span className="text-sm font-semibold text-indigo-300">Full IPO Calendar Coming Soon</span>
          <p className="text-xs text-indigo-400/80 mt-0.5">
            Upcoming IPO dates, price ranges, lock-up expirations, and first-day performance
            tracking will be available shortly.
          </p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Enter ticker..."
            className="w-36 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Search
        </button>
        <div className="flex flex-wrap gap-1">
          {DEFAULT_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => setTicker(t)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium',
                ticker === t
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Status / loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading S-1 filings for {ticker}…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-400">
          Failed to load filings: {(error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Summary card */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Company</div>
              <div className="mt-1 truncate text-lg font-bold text-white">{companyName}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Ticker</div>
              <div className="mt-1 font-mono text-lg font-bold text-indigo-400">{ticker}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">S-1 / S-1A Filings</div>
              <div className="mt-1 text-lg font-bold text-white">{s1Filings.length}</div>
            </div>
          </div>

          {s1Filings.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800 p-6 text-sm text-slate-400">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              <div>
                <p className="font-medium text-slate-300">No S-1 filings found for {ticker}</p>
                <p className="mt-1 text-xs text-slate-500">
                  This company may not have filed an S-1 registration statement, or the filing may
                  predate our data window. Try a recently-IPO'd company or a SPAC.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Form</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Filed</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Accession</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {s1Filings.map((f, i) => (
                    <tr key={f.accession ?? i} className="bg-slate-800 hover:bg-slate-700/40">
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 font-mono text-[10px] font-bold',
                            f.form === 'S-1'
                              ? 'bg-indigo-900/50 text-indigo-300'
                              : 'bg-slate-700 text-slate-300'
                          )}
                        >
                          {f.form}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{f.filed_date}</td>
                      <td className="max-w-xs px-3 py-2 text-xs text-slate-300">
                        {f.description || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                        {f.accession}
                      </td>
                      <td className="px-3 py-2">
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            <ExternalLink className="h-3 w-3" />
                            EDGAR
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All filings fallback view if no S-1 found but there are other filings */}
          {s1Filings.length === 0 && filings.length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p className="mb-3 text-xs text-slate-500">
                Showing all {filings.length} filings returned (none are S-1 form type):
              </p>
              <div className="space-y-1">
                {filings.slice(0, 10).map((f, i) => (
                  <div
                    key={f.accession ?? i}
                    className="flex items-center justify-between rounded-lg bg-slate-700/30 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-slate-400">{f.form}</span>
                    <span className="text-xs text-slate-500">{f.filed_date}</span>
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
