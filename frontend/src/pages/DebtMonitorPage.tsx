import { Banknote, Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useEconomics } from '../hooks/useEconomics';
import type { FredSeries } from '../lib/types';
import { cn } from '../lib/utils';

function SeriesCard({ s }: { s: FredSeries }) {
  const val = typeof s.value === 'number' ? s.value : parseFloat(String(s.value));
  const isValid = !isNaN(val);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 truncate">{s.title}</div>
      <div className={cn('mt-1 text-xl font-bold', isValid ? 'text-white' : 'text-slate-600')}>
        {isValid ? `${val.toFixed(2)}%` : 'N/A'}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-600">{s.date}</div>
    </div>
  );
}

function SeriesRow({ s }: { s: FredSeries }) {
  const val = typeof s.value === 'number' ? s.value : parseFloat(String(s.value));
  const isValid = !isNaN(val);
  return (
    <tr className="bg-slate-800 hover:bg-slate-700/40">
      <td className="px-3 py-2 text-xs text-slate-300 max-w-xs truncate">{s.title}</td>
      <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.id}</td>
      <td
        className={cn(
          'px-3 py-2 text-right text-xs font-bold',
          isValid ? 'text-white' : 'text-slate-600'
        )}
      >
        {isValid ? val.toFixed(3) : '—'}
      </td>
      <td className="px-3 py-2 text-right text-xs text-slate-500">{s.date}</td>
    </tr>
  );
}

export function DebtMonitorPage() {
  const ratesQ = useEconomics('rates');
  const treasuryQ = useEconomics('treasury');

  const ratesSeries = ratesQ.data?.series ?? [];
  const treasurySeries = treasuryQ.data?.series ?? [];

  const isLoading = ratesQ.isLoading || treasuryQ.isLoading;
  const isError = ratesQ.isError || treasuryQ.isError;
  const errorMsg =
    (ratesQ.error as Error)?.message ??
    (treasuryQ.error as Error)?.message ??
    'Unknown error';

  // Pull known key series for headline cards
  function findSeries(list: FredSeries[], keywords: string[]): FredSeries | undefined {
    const kw = keywords.map((k) => k.toLowerCase());
    return list.find((s) =>
      kw.some((k) => s.id.toLowerCase().includes(k) || s.title.toLowerCase().includes(k))
    );
  }

  const fedFunds = findSeries(ratesSeries, ['fedfunds', 'federal funds']);
  const t2y = findSeries(treasurySeries, ['dgs2', '2-year', '2 year']);
  const t10y = findSeries(treasurySeries, ['dgs10', '10-year', '10 year']);
  const t30y = findSeries(treasurySeries, ['dgs30', '30-year', '30 year']);

  // Yield curve spread (10Y - 2Y)
  const spread10y2y =
    t10y && t2y
      ? (parseFloat(String(t10y.value)) - parseFloat(String(t2y.value))).toFixed(2)
      : null;
  const isInverted = spread10y2y !== null && parseFloat(spread10y2y) < 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Banknote className="h-6 w-6 text-rose-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Debt Monitor</h1>
          <p className="text-sm text-slate-400">
            Fed Funds rate, treasury yields, and credit indicators from FRED
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading FRED data…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-400">
          Failed to load economics data: {errorMsg}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Key rate headline cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fedFunds && (
              <div className="rounded-xl border border-rose-700/40 bg-slate-800 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">Fed Funds Rate</div>
                <div className="mt-1 text-2xl font-bold text-rose-400">
                  {parseFloat(String(fedFunds.value)).toFixed(2)}%
                </div>
                <div className="mt-0.5 text-[10px] text-slate-600">{fedFunds.date}</div>
              </div>
            )}
            {t2y && (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">2-Year Treasury</div>
                <div className="mt-1 text-2xl font-bold text-amber-400">
                  {parseFloat(String(t2y.value)).toFixed(2)}%
                </div>
                <div className="mt-0.5 text-[10px] text-slate-600">{t2y.date}</div>
              </div>
            )}
            {t10y && (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">10-Year Treasury</div>
                <div className="mt-1 text-2xl font-bold text-blue-400">
                  {parseFloat(String(t10y.value)).toFixed(2)}%
                </div>
                <div className="mt-0.5 text-[10px] text-slate-600">{t10y.date}</div>
              </div>
            )}
            {spread10y2y !== null ? (
              <div
                className={cn(
                  'rounded-xl border p-4',
                  isInverted
                    ? 'border-red-700/40 bg-red-900/10'
                    : 'border-emerald-700/40 bg-emerald-900/10'
                )}
              >
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Yield Curve (10Y-2Y)
                </div>
                <div
                  className={cn(
                    'mt-1 flex items-center gap-1 text-2xl font-bold',
                    isInverted ? 'text-red-400' : 'text-emerald-400'
                  )}
                >
                  {isInverted ? (
                    <TrendingDown className="h-5 w-5" />
                  ) : (
                    <TrendingUp className="h-5 w-5" />
                  )}
                  {spread10y2y}%
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {isInverted ? 'Inverted — recession signal' : 'Normal'}
                </div>
              </div>
            ) : (
              t30y && <SeriesCard s={t30y} />
            )}
          </div>

          {/* Inverted yield curve warning */}
          {isInverted && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
              <p className="text-sm text-red-300">
                The yield curve is currently inverted (10Y below 2Y), which has historically
                preceded recessions. Monitor credit spreads and Fed policy closely.
              </p>
            </div>
          )}

          {/* Rates section */}
          {ratesSeries.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Interest Rates &amp; Credit Indicators
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ratesSeries.slice(0, 6).map((s) => (
                  <SeriesCard key={s.id} s={s} />
                ))}
              </div>
              {ratesSeries.length > 6 && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-700 bg-slate-800/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Series</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">ID</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {ratesSeries.slice(6).map((s) => (
                        <SeriesRow key={s.id} s={s} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Treasury section */}
          {treasurySeries.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Treasury Yields
              </h2>

              {/* Yield curve bar chart */}
              {treasurySeries.length >= 2 && (
                <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Yield Curve
                  </h3>
                  <div className="flex items-end gap-2" style={{ height: '100px' }}>
                    {treasurySeries
                      .filter((s) => {
                        const v = parseFloat(String(s.value));
                        return !isNaN(v) && v > 0;
                      })
                      .slice(0, 10)
                      .map((s) => {
                        const v = parseFloat(String(s.value));
                        const maxVal = Math.max(
                          ...treasurySeries
                            .map((x) => parseFloat(String(x.value)))
                            .filter((x) => !isNaN(x))
                        );
                        const height = (v / maxVal) * 80;
                        return (
                          <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
                            <span className="text-[9px] text-slate-400">{v.toFixed(2)}%</span>
                            <div
                              className="w-full rounded-t bg-blue-500/40"
                              style={{ height: `${Math.max(4, height)}px` }}
                            />
                            <span className="text-[8px] text-slate-500 text-center leading-tight">
                              {s.id.replace('DGS', '').replace('GS', '')}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Series</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">ID</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Yield</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {treasurySeries.map((s) => (
                      <SeriesRow key={s.id} s={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ratesSeries.length === 0 && treasurySeries.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-10 text-center text-sm text-slate-500">
              No FRED data returned for rates or treasury categories.
            </div>
          )}
        </>
      )}
    </div>
  );
}
