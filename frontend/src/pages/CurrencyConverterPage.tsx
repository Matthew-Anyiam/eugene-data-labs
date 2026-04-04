import { useState, useMemo } from 'react';
import { ArrowLeftRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEconomics } from '../hooks/useEconomics';
import type { FredSeries } from '../lib/types';

// ─── FRED FX series IDs → pair metadata ──────────────────────────────────────
// FRED exchange rate conventions:
//   DEXUSEU  USD per EUR  → multiply to convert USD→EUR:  EUR = USD / rate
//   DEXUSUK  USD per GBP  → same
//   DEXJPUS  JPY per USD  → multiply to get JPY from USD
//   DEXCHUS  CNY per USD  → multiply to get CNY from USD
//   DEXCAUS  CAD per USD
//   DEXUSAL  AUD per USD  (USD per AUD inverted)
//   DEXSZUS  CHF per USD  (inverted)
//   DEXINUS  INR per USD
//   DEXBZUS  BRL per USD
//   DEXKOUS  KRW per USD
//   DEXMXUS  MXN per USD

interface FXMeta {
  fredId: string;
  from: string;   // USD base unless noted
  to: string;
  fromName: string;
  toName: string;
  // Whether the FRED series is already "USD per foreign" (true) vs "foreign per USD" (false)
  usdPerForeign: boolean;
}

const FX_META: FXMeta[] = [
  { fredId: 'DEXUSEU', from: 'USD', to: 'EUR', fromName: 'US Dollar', toName: 'Euro', usdPerForeign: true },
  { fredId: 'DEXUSUK', from: 'USD', to: 'GBP', fromName: 'US Dollar', toName: 'British Pound', usdPerForeign: true },
  { fredId: 'DEXJPUS', from: 'USD', to: 'JPY', fromName: 'US Dollar', toName: 'Japanese Yen', usdPerForeign: false },
  { fredId: 'DEXCHUS', from: 'USD', to: 'CNY', fromName: 'US Dollar', toName: 'Chinese Yuan', usdPerForeign: false },
  { fredId: 'DEXCAUS', from: 'USD', to: 'CAD', fromName: 'US Dollar', toName: 'Canadian Dollar', usdPerForeign: false },
  { fredId: 'DEXUSAL', from: 'USD', to: 'AUD', fromName: 'US Dollar', toName: 'Australian Dollar', usdPerForeign: false },
  { fredId: 'DEXSZUS', from: 'USD', to: 'CHF', fromName: 'US Dollar', toName: 'Swiss Franc', usdPerForeign: false },
  { fredId: 'DEXINUS', from: 'USD', to: 'INR', fromName: 'US Dollar', toName: 'Indian Rupee', usdPerForeign: false },
  { fredId: 'DEXBZUS', from: 'USD', to: 'BRL', fromName: 'US Dollar', toName: 'Brazilian Real', usdPerForeign: false },
  { fredId: 'DEXKOUS', from: 'USD', to: 'KRW', fromName: 'US Dollar', toName: 'South Korean Won', usdPerForeign: false },
  { fredId: 'DEXMXUS', from: 'USD', to: 'MXN', fromName: 'US Dollar', toName: 'Mexican Peso', usdPerForeign: false },
];

// ─── Fallback rates (hardcoded) ───────────────────────────────────────────────

const FALLBACK_RATES: Record<string, number> = {
  // USD → foreign unit
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CNY: 7.24,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  INR: 83.1,
  BRL: 4.97,
  KRW: 1315,
  MXN: 17.15,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Given FRED rate value + meta, return: 1 USD = X foreign
function fredToUsdForeign(fredValue: number, meta: FXMeta): number {
  // DEXUSEU/DEXUSUK: FRED gives USD per 1 foreign → invert to get foreign per 1 USD
  if (meta.usdPerForeign) return 1 / fredValue;
  // Everything else: FRED gives foreign per 1 USD directly
  return fredValue;
}

// 1 fromCode → X toCode
function crossRate(
  fromCode: string,
  toCode: string,
  usdRates: Record<string, number>,  // key = foreign code, val = foreign per 1 USD
): number {
  if (fromCode === toCode) return 1;
  if (fromCode === 'USD') return usdRates[toCode] ?? 1;
  if (toCode === 'USD') return 1 / (usdRates[fromCode] ?? 1);
  // Cross: fromCode → USD → toCode
  const fromUsd = usdRates[fromCode] ?? 1;
  const toUsd = usdRates[toCode] ?? 1;
  return toUsd / fromUsd;
}

function formatRate(r: number): string {
  if (r >= 100) return r.toFixed(2);
  if (r >= 1) return r.toFixed(4);
  return r.toFixed(6);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CurrencyConverterPage() {
  const [fromCode, setFromCode] = useState('USD');
  const [toCode, setToCode] = useState('EUR');
  const [amount, setAmount] = useState('1000');

  const { data: econData, isLoading, error } = useEconomics('all');

  // Build a map of foreign_code → rate (foreign per 1 USD) from FRED data
  const usdRates = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};

    // Start with fallbacks
    Object.entries(FALLBACK_RATES).forEach(([code, rate]) => {
      result[code] = rate;
    });

    if (!econData?.series) return result;

    const seriesMap: Record<string, FredSeries> = {};
    econData.series.forEach((s) => {
      seriesMap[s.id] = s;
    });

    FX_META.forEach((meta) => {
      const series = seriesMap[meta.fredId];
      if (!series) return;
      const raw = typeof series.value === 'string' ? parseFloat(series.value) : series.value;
      if (isNaN(raw) || raw <= 0) return;
      result[meta.to] = fredToUsdForeign(raw, meta);
    });

    return result;
  }, [econData]);

  // All currencies we have rates for
  const currencies = useMemo(() => {
    const codes = ['USD', ...Object.keys(usdRates)];
    return codes.map((code) => {
      const meta = FX_META.find((m) => m.to === code);
      return {
        code,
        name: meta ? meta.toName : code === 'USD' ? 'US Dollar' : code,
      };
    });
  }, [usdRates]);

  const rate = useMemo(
    () => crossRate(fromCode, toCode, usdRates),
    [fromCode, toCode, usdRates],
  );

  const converted = useMemo(() => {
    const n = parseFloat(amount);
    return isNaN(n) ? null : n * rate;
  }, [amount, rate]);

  // Which FRED series are available
  const availableFredSeries = useMemo(() => {
    if (!econData?.series) return [];
    return econData.series.filter((s) => FX_META.some((m) => m.fredId === s.id));
  }, [econData]);

  const hasFredData = availableFredSeries.length > 0;

  function swap() {
    setFromCode(toCode);
    setToCode(fromCode);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-6 w-6 text-lime-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Currency Converter</h1>
          <p className="text-sm text-slate-400">
            {hasFredData
              ? 'Rates from FRED (Federal Reserve Economic Data)'
              : 'FX rates — reference data'}
          </p>
        </div>
        {isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-500" />}
      </div>

      {error && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/10 px-4 py-3 text-xs text-amber-400">
          Could not load live FRED data — showing reference rates.
        </div>
      )}

      {/* Converter */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end">
          {/* From */}
          <div className="flex-1 space-y-1">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500">From</label>
            <div className="flex gap-2">
              <select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-32 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Swap */}
          <button
            onClick={swap}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-400 transition-colors hover:border-lime-500 hover:text-lime-400 sm:mb-0.5"
            title="Swap currencies"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* To */}
          <div className="flex-1 space-y-1">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500">To</label>
            <div className="flex gap-2">
              <select
                value={toCode}
                onChange={(e) => setToCode(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <div className="flex w-32 flex-1 items-center rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm font-bold text-lime-400">
                {converted !== null
                  ? converted.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-slate-400">
          1 {fromCode} ={' '}
          <span className="font-bold text-white">{formatRate(rate)}</span> {toCode}
          <span className="mx-2 text-slate-600">·</span>
          1 {toCode} ={' '}
          <span className="font-bold text-white">{formatRate(1 / rate)}</span> {fromCode}
        </div>
      </div>

      {/* Quick convert */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[100, 500, 1000, 10000].map((amt) => (
          <div
            key={amt}
            className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 p-3 text-center transition-colors hover:border-lime-600/50"
            onClick={() => setAmount(String(amt))}
          >
            <div className="text-xs text-slate-400">
              {amt.toLocaleString()} {fromCode}
            </div>
            <div className="mt-1 text-sm font-bold text-lime-400">
              {(amt * rate).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {toCode}
            </div>
          </div>
        ))}
      </div>

      {/* Available FRED FX rates table */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          USD Exchange Rates
          {hasFredData && (
            <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-400">
              FRED live
            </span>
          )}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Pair</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Currency</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">
                  1 USD =
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">
                  1 unit = USD
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">
                  FRED Series
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">
                  As of
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {FX_META.map((meta) => {
                const rateVal = usdRates[meta.to] ?? FALLBACK_RATES[meta.to];
                const fredSeries = availableFredSeries.find((s) => s.id === meta.fredId);
                const isLive = !!fredSeries;
                return (
                  <tr
                    key={meta.fredId}
                    className="cursor-pointer bg-slate-800 hover:bg-slate-700/50"
                    onClick={() => {
                      setFromCode('USD');
                      setToCode(meta.to);
                    }}
                  >
                    <td className="px-3 py-2 text-xs font-bold text-white">
                      USD/{meta.to}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">{meta.toName}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-lime-400">
                      {rateVal != null ? formatRate(rateVal) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                      {rateVal != null ? formatRate(1 / rateVal) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {isLive ? (
                        <span className="font-mono text-slate-400">{meta.fredId}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {fredSeries?.date ?? (
                        <span className="text-slate-600">reference</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cross-rate matrix */}
      {(() => {
        const matrixCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
        return (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Cross-Rate Matrix</h3>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-400" />
                    {matrixCodes.map((c) => (
                      <th
                        key={c}
                        className="px-2 py-1.5 text-center text-xs font-medium text-slate-400"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixCodes.map((fromC) => (
                    <tr key={fromC} className="border-t border-slate-700/50">
                      <td className="px-2 py-1.5 text-xs font-medium text-slate-300">{fromC}</td>
                      {matrixCodes.map((toC) => {
                        const r = crossRate(fromC, toC, usdRates);
                        const isSame = fromC === toC;
                        return (
                          <td
                            key={toC}
                            className={cn(
                              'px-2 py-1.5 text-center text-[10px]',
                              isSame
                                ? 'text-slate-600'
                                : 'cursor-pointer text-slate-300 hover:text-lime-400',
                            )}
                            onClick={() => {
                              if (!isSame) {
                                setFromCode(fromC);
                                setToCode(toC);
                              }
                            }}
                          >
                            {isSame ? '—' : formatRate(r)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
