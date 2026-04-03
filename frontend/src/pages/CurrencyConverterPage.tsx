import { useState, useMemo } from 'react';
import { ArrowLeftRight, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: 'US' },
  { code: 'EUR', name: 'Euro', symbol: '\u20AC', flag: 'EU' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3', flag: 'GB' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '\u00A5', flag: 'JP' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: 'CH' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: 'CA' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: 'AU' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '\u00A5', flag: 'CN' },
  { code: 'INR', name: 'Indian Rupee', symbol: '\u20B9', flag: 'IN' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: 'BR' },
  { code: 'KRW', name: 'South Korean Won', symbol: '\u20A9', flag: 'KR' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', flag: 'MX' },
];

// Base rates vs USD
const BASE_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CHF: 0.88, CAD: 1.36,
  AUD: 1.53, CNY: 7.24, INR: 83.1, BRL: 4.97, KRW: 1315, MXN: 17.15,
};

function getRate(from: string, to: string): number {
  if (from === to) return 1;
  const fromUSD = BASE_RATES[from];
  const toUSD = BASE_RATES[to];
  return toUSD / fromUSD;
}

interface CrossRate {
  from: string;
  to: string;
  rate: number;
  change24h: number;
  change7d: number;
  change30d: number;
}

function genCrossRates(): CrossRate[] {
  const majors = ['EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
  const pairs: CrossRate[] = [];
  for (const from of ['USD', ...majors]) {
    for (const to of ['USD', ...majors]) {
      if (from === to) continue;
      if (from !== 'USD' && to !== 'USD') continue;
      const s = seed(from + to + '_fx');
      pairs.push({
        from, to,
        rate: +getRate(from, to).toFixed(4),
        change24h: +((pseudo(s, 0) - 0.5) * 1.5).toFixed(2),
        change7d: +((pseudo(s, 1) - 0.5) * 3).toFixed(2),
        change30d: +((pseudo(s, 2) - 0.5) * 5).toFixed(2),
      });
    }
  }
  return pairs;
}

export function CurrencyConverterPage() {
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('1000');

  const rate = useMemo(() => getRate(fromCurrency, toCurrency), [fromCurrency, toCurrency]);
  const converted = useMemo(() => {
    const num = parseFloat(amount);
    return isNaN(num) ? 0 : num * rate;
  }, [amount, rate]);

  const crossRates = useMemo(() => genCrossRates(), []);

  const swap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  // Cross rate matrix
  const matrixCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];

  // Historical mock
  const historical = useMemo(() => {
    const s = seed(fromCurrency + toCurrency + '_hist');
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(2025, 2, 20 - i);
      const baseRate = rate;
      const variation = (pseudo(s, i) - 0.5) * rate * 0.03;
      return { date: d.toISOString().slice(0, 10), rate: +(baseRate + variation).toFixed(4) };
    });
  }, [fromCurrency, toCurrency, rate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-6 w-6 text-lime-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Currency Converter</h1>
          <p className="text-sm text-slate-400">FX rates, cross-rate matrix, and historical data</p>
        </div>
      </div>

      {/* Converter */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex-1 w-full">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">From</label>
            <div className="flex gap-2">
              <select value={fromCurrency} onChange={e => setFromCurrency(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
              <input value={amount} onChange={e => setAmount(e.target.value)}
                type="number" className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none" />
            </div>
          </div>

          <button onClick={swap} className="mt-4 sm:mt-5 rounded-full border border-slate-600 p-2 text-slate-400 hover:text-white hover:border-lime-500 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>

          <div className="flex-1 w-full">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">To</label>
            <div className="flex gap-2">
              <select value={toCurrency} onChange={e => setToCurrency(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
              <div className="flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-lime-400 font-bold">
                {converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-slate-400">
          1 {fromCurrency} = <span className="font-bold text-white">{rate.toFixed(4)}</span> {toCurrency}
          <span className="mx-2 text-slate-600">|</span>
          1 {toCurrency} = <span className="font-bold text-white">{(1 / rate).toFixed(4)}</span> {fromCurrency}
        </div>
      </div>

      {/* Quick convert amounts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[100, 500, 1000, 10000].map(amt => {
          const result = amt * rate;
          return (
            <div key={amt} className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-center">
              <div className="text-xs text-slate-400">{amt.toLocaleString()} {fromCurrency}</div>
              <div className="mt-1 text-sm font-bold text-lime-400">
                {result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCurrency}
              </div>
            </div>
          );
        })}
      </div>

      {/* Major pairs */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Major Currency Pairs</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Pair</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">24h</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">7d</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {crossRates.filter(r => r.from === 'USD').map(r => (
                <tr key={r.to} className="bg-slate-800 hover:bg-slate-750 cursor-pointer"
                  onClick={() => { setFromCurrency(r.from); setToCurrency(r.to); }}>
                  <td className="px-3 py-2 text-xs font-bold text-white">{r.from}/{r.to}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{r.rate}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', r.change24h >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {r.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {r.change24h >= 0 ? '+' : ''}{r.change24h}%
                    </span>
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', r.change7d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {r.change7d >= 0 ? '+' : ''}{r.change7d}%
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', r.change30d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {r.change30d >= 0 ? '+' : ''}{r.change30d}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cross rate matrix */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Cross Rate Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-400" />
                {matrixCurrencies.map(c => (
                  <th key={c} className="px-2 py-1.5 text-center text-xs font-medium text-slate-400">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixCurrencies.map(from => (
                <tr key={from} className="border-t border-slate-700/50">
                  <td className="px-2 py-1.5 text-xs font-medium text-slate-300">{from}</td>
                  {matrixCurrencies.map(to => {
                    const r = getRate(from, to);
                    const isSame = from === to;
                    return (
                      <td key={to} className={cn('px-2 py-1.5 text-center text-[10px]',
                        isSame ? 'text-slate-600' : 'text-slate-300 cursor-pointer hover:text-lime-400')}
                        onClick={() => { if (!isSame) { setFromCurrency(from); setToCurrency(to); } }}>
                        {isSame ? '—' : r < 10 ? r.toFixed(4) : r < 1000 ? r.toFixed(2) : r.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical rates */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">{fromCurrency}/{toCurrency} — 14-Day History</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {historical.map((h, i) => {
                const prev = historical[i + 1];
                const change = prev ? ((h.rate - prev.rate) / prev.rate) * 100 : 0;
                return (
                  <tr key={h.date} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs text-slate-400">{h.date}</td>
                    <td className="px-3 py-2 text-right text-xs text-white font-medium">{h.rate}</td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {i < historical.length - 1 ? `${change >= 0 ? '+' : ''}${change.toFixed(3)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
