import { useState, useMemo } from 'react';
import { CreditCard, Search, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

interface ValuationData {
  ticker: string;
  price: number;
  marketCap: number;
  pe: number;
  forwardPE: number;
  pegRatio: number;
  psRatio: number;
  pbRatio: number;
  evEbitda: number;
  evRevenue: number;
  fcfYield: number;
  divYield: number;
  sectorAvgPE: number;
  sectorAvgPB: number;
  sectorAvgPS: number;
  dcf: { wacc: number; termGrowth: number; fcf: number[]; termValue: number; ev: number; fairValue: number; upside: number };
  peerComps: { ticker: string; name: string; pe: number; ps: number; pb: number; evEbitda: number }[];
}

const NAMES: Record<string, string> = {
  AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon',
  NVDA: 'NVIDIA', META: 'Meta', TSLA: 'Tesla', JPM: 'JPMorgan',
};

const PEERS: Record<string, string[]> = {
  AAPL: ['MSFT', 'GOOGL', 'SAMSUNG', 'DELL', 'HPQ'],
  MSFT: ['AAPL', 'GOOGL', 'CRM', 'ORCL', 'SAP'],
  GOOGL: ['META', 'MSFT', 'AMZN', 'SNAP', 'PINS'],
  AMZN: ['WMT', 'SHOP', 'EBAY', 'BABA', 'TGT'],
  NVDA: ['AMD', 'INTC', 'QCOM', 'AVGO', 'TSM'],
  META: ['GOOGL', 'SNAP', 'PINS', 'TWTR', 'RBLX'],
  TSLA: ['F', 'GM', 'RIVN', 'LCID', 'NIO'],
  JPM: ['BAC', 'GS', 'MS', 'WFC', 'C'],
};

function genValuation(ticker: string): ValuationData {
  const s = seed(ticker + '_val');
  const price = 50 + pseudo(s, 0) * 400;
  const marketCap = 100 + pseudo(s, 1) * 2900;
  const pe = 10 + pseudo(s, 2) * 50;
  const forwardPE = pe * (0.7 + pseudo(s, 3) * 0.4);
  const pegRatio = 0.5 + pseudo(s, 4) * 2.5;
  const psRatio = 2 + pseudo(s, 5) * 20;
  const pbRatio = 1 + pseudo(s, 6) * 15;
  const evEbitda = 8 + pseudo(s, 7) * 30;
  const evRevenue = 2 + pseudo(s, 8) * 15;
  const fcfYield = 1 + pseudo(s, 9) * 6;
  const divYield = pseudo(s, 10) * 3;
  const sectorAvgPE = pe * (0.8 + pseudo(s, 11) * 0.4);
  const sectorAvgPB = pbRatio * (0.7 + pseudo(s, 12) * 0.6);
  const sectorAvgPS = psRatio * (0.7 + pseudo(s, 13) * 0.6);

  const wacc = 8 + pseudo(s, 20) * 4;
  const termGrowth = 2 + pseudo(s, 21) * 1.5;
  const baseFCF = 5 + pseudo(s, 22) * 30;
  const growth = 5 + pseudo(s, 23) * 20;
  const fcf = Array.from({ length: 5 }, (_, i) => +(baseFCF * Math.pow(1 + growth / 100, i + 1)).toFixed(1));
  const termValue = +(fcf[4] * (1 + termGrowth / 100) / (wacc / 100 - termGrowth / 100)).toFixed(1);
  const ev = +(fcf.reduce((sum, f, i) => sum + f / Math.pow(1 + wacc / 100, i + 1), 0) + termValue / Math.pow(1 + wacc / 100, 5)).toFixed(1);
  const fairValue = +(price * (0.7 + pseudo(s, 24) * 0.6)).toFixed(2);
  const upside = +((fairValue - price) / price * 100).toFixed(1);

  const peers = (PEERS[ticker] || ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA']).map((pt, i) => ({
    ticker: pt, name: pt,
    pe: +(10 + pseudo(seed(pt + '_pv'), 0) * 50).toFixed(1),
    ps: +(2 + pseudo(seed(pt + '_pv'), 1) * 20).toFixed(1),
    pb: +(1 + pseudo(seed(pt + '_pv'), 2) * 15).toFixed(1),
    evEbitda: +(8 + pseudo(seed(pt + '_pv'), 3) * 30).toFixed(1),
  }));

  return {
    ticker, price: +price.toFixed(2), marketCap: +marketCap.toFixed(0),
    pe: +pe.toFixed(1), forwardPE: +forwardPE.toFixed(1), pegRatio: +pegRatio.toFixed(2),
    psRatio: +psRatio.toFixed(1), pbRatio: +pbRatio.toFixed(1), evEbitda: +evEbitda.toFixed(1),
    evRevenue: +evRevenue.toFixed(1), fcfYield: +fcfYield.toFixed(1), divYield: +divYield.toFixed(2),
    sectorAvgPE: +sectorAvgPE.toFixed(1), sectorAvgPB: +sectorAvgPB.toFixed(1), sectorAvgPS: +sectorAvgPS.toFixed(1),
    dcf: { wacc: +wacc.toFixed(1), termGrowth: +termGrowth.toFixed(1), fcf, termValue, ev, fairValue, upside },
    peerComps: peers,
  };
}

export function ValuationPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');

  const data = useMemo(() => genValuation(selectedTicker), [selectedTicker]);
  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

  const premiumDiscount = (val: number, avg: number) => {
    const diff = ((val - avg) / avg) * 100;
    return { diff: +diff.toFixed(0), label: diff > 0 ? 'Premium' : 'Discount', color: diff > 10 ? 'text-red-400' : diff < -10 ? 'text-emerald-400' : 'text-amber-400' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-pink-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Valuation</h1>
          <p className="text-sm text-slate-400">DCF calculator, multiples comparison, and fair value estimates</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-pink-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-pink-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Price + Fair Value */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Current Price</div>
          <div className="mt-2 text-3xl font-bold text-white">${data.price}</div>
          <div className="mt-1 text-xs text-slate-400">Mkt Cap: ${data.marketCap}B</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">DCF Fair Value</div>
          <div className={cn('mt-2 text-3xl font-bold', data.dcf.upside >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            ${data.dcf.fairValue}
          </div>
          <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', data.dcf.upside >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {data.dcf.upside >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {data.dcf.upside >= 0 ? '+' : ''}{data.dcf.upside}% {data.dcf.upside >= 0 ? 'upside' : 'downside'}
          </div>
        </div>
        <div className={cn('rounded-xl border p-4', data.dcf.upside > 10 ? 'border-emerald-500/30 bg-emerald-500/10' : data.dcf.upside < -10 ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10')}>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Verdict</div>
          <div className={cn('mt-2 text-2xl font-bold', data.dcf.upside > 10 ? 'text-emerald-400' : data.dcf.upside < -10 ? 'text-red-400' : 'text-amber-400')}>
            {data.dcf.upside > 10 ? 'Undervalued' : data.dcf.upside < -10 ? 'Overvalued' : 'Fair Value'}
          </div>
          <div className="mt-1 text-xs text-slate-400">Based on DCF model</div>
        </div>
      </div>

      {/* Multiples grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'P/E', value: `${data.pe}x`, vs: premiumDiscount(data.pe, data.sectorAvgPE) },
          { label: 'Forward P/E', value: `${data.forwardPE}x`, vs: null },
          { label: 'PEG', value: `${data.pegRatio}x`, vs: null },
          { label: 'P/S', value: `${data.psRatio}x`, vs: premiumDiscount(data.psRatio, data.sectorAvgPS) },
          { label: 'P/B', value: `${data.pbRatio}x`, vs: premiumDiscount(data.pbRatio, data.sectorAvgPB) },
          { label: 'EV/EBITDA', value: `${data.evEbitda}x`, vs: null },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</div>
            <div className="mt-1 text-lg font-bold text-white">{m.value}</div>
            {m.vs && (
              <div className={cn('mt-1 text-[10px] font-medium', m.vs.color)}>
                {m.vs.diff > 0 ? '+' : ''}{m.vs.diff}% vs sector
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Additional metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'EV/Revenue', value: `${data.evRevenue}x` },
          { label: 'FCF Yield', value: `${data.fcfYield}%`, color: data.fcfYield > 3 ? 'text-emerald-400' : 'text-white' },
          { label: 'Div Yield', value: `${data.divYield}%` },
          { label: 'Sector Avg P/E', value: `${data.sectorAvgPE}x`, color: 'text-slate-400' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</div>
            <div className={cn('mt-1 text-lg font-bold', m.color || 'text-white')}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* DCF Model */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-4 w-4 text-pink-400" />
          <h3 className="text-sm font-semibold text-white">DCF Model</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div>
            <div className="text-[10px] text-slate-500">WACC</div>
            <div className="text-sm font-bold text-white">{data.dcf.wacc}%</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">Terminal Growth</div>
            <div className="text-sm font-bold text-white">{data.dcf.termGrowth}%</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">Enterprise Value</div>
            <div className="text-sm font-bold text-white">${data.dcf.ev}B</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Year</th>
                {data.dcf.fcf.map((_, i) => (
                  <th key={i} className="px-3 py-2 text-right text-xs font-medium text-slate-400">Y{i + 1}</th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Terminal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-xs text-slate-300">FCF ($B)</td>
                {data.dcf.fcf.map((f, i) => (
                  <td key={i} className="px-3 py-2 text-right text-xs text-white">${f}</td>
                ))}
                <td className="px-3 py-2 text-right text-xs text-pink-400">${data.dcf.termValue}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-xs text-slate-300">PV ($B)</td>
                {data.dcf.fcf.map((f, i) => (
                  <td key={i} className="px-3 py-2 text-right text-xs text-slate-400">
                    ${(f / Math.pow(1 + data.dcf.wacc / 100, i + 1)).toFixed(1)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-xs text-slate-400">
                  ${(data.dcf.termValue / Math.pow(1 + data.dcf.wacc / 100, 5)).toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Peer comparison */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Peer Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">P/E</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">P/S</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">P/B</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EV/EBITDA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              <tr className="bg-pink-500/10">
                <td className="px-3 py-2">
                  <Link to={`/company/${data.ticker}`} className="font-mono text-xs font-bold text-pink-400">{data.ticker}</Link>
                  <span className="ml-1 text-[10px] text-slate-500">(current)</span>
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold text-white">{data.pe}x</td>
                <td className="px-3 py-2 text-right text-xs font-bold text-white">{data.psRatio}x</td>
                <td className="px-3 py-2 text-right text-xs font-bold text-white">{data.pbRatio}x</td>
                <td className="px-3 py-2 text-right text-xs font-bold text-white">{data.evEbitda}x</td>
              </tr>
              {data.peerComps.map(p => (
                <tr key={p.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 font-mono text-xs font-bold text-slate-300">{p.ticker}</td>
                  <td className={cn('px-3 py-2 text-right text-xs', p.pe < data.pe ? 'text-emerald-400' : 'text-red-400')}>{p.pe}x</td>
                  <td className={cn('px-3 py-2 text-right text-xs', p.ps < data.psRatio ? 'text-emerald-400' : 'text-red-400')}>{p.ps}x</td>
                  <td className={cn('px-3 py-2 text-right text-xs', p.pb < data.pbRatio ? 'text-emerald-400' : 'text-red-400')}>{p.pb}x</td>
                  <td className={cn('px-3 py-2 text-right text-xs', p.evEbitda < data.evEbitda ? 'text-emerald-400' : 'text-red-400')}>{p.evEbitda}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
