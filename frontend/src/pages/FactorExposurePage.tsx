import { useState, useMemo } from 'react';
import { Sliders, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'XOM'];

const FACTORS = ['Value', 'Momentum', 'Quality', 'Size', 'Low Volatility', 'Growth'] as const;
const FACTOR_COLORS = {
  Value: { bar: 'bg-blue-500', text: 'text-blue-400' },
  Momentum: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
  Quality: { bar: 'bg-purple-500', text: 'text-purple-400' },
  Size: { bar: 'bg-amber-500', text: 'text-amber-400' },
  'Low Volatility': { bar: 'bg-cyan-500', text: 'text-cyan-400' },
  Growth: { bar: 'bg-pink-500', text: 'text-pink-400' },
};

interface FactorData {
  factor: string;
  score: number; // -1 to 1
  percentile: number;
  contribution: number; // % of return attributed
}

interface TickerFactors {
  ticker: string;
  factors: FactorData[];
  overallScore: number;
  alpha: number;
  beta: number;
  rSquared: number;
}

function genFactorData(ticker: string): TickerFactors {
  const s = seed(ticker + '_factor');
  const factors: FactorData[] = FACTORS.map((factor, i) => ({
    factor,
    score: +((pseudo(s, i * 10) * 2 - 1)).toFixed(2),
    percentile: Math.floor(pseudo(s, i * 10 + 1) * 100),
    contribution: +((pseudo(s, i * 10 + 2) - 0.3) * 8).toFixed(2),
  }));

  return {
    ticker,
    factors,
    overallScore: +(factors.reduce((s, f) => s + f.score, 0) / factors.length).toFixed(2),
    alpha: +((pseudo(s, 70) - 0.3) * 10).toFixed(2),
    beta: +(0.5 + pseudo(s, 71) * 1.5).toFixed(2),
    rSquared: +(0.5 + pseudo(s, 72) * 0.49).toFixed(2),
  };
}

const FACTOR_RETURNS = FACTORS.map((f, i) => {
  const s = seed(f + '_ret');
  return {
    factor: f,
    ytd: +((pseudo(s, 0) - 0.3) * 20).toFixed(2),
    m1: +((pseudo(s, 1) - 0.4) * 8).toFixed(2),
    m3: +((pseudo(s, 2) - 0.35) * 15).toFixed(2),
    y1: +((pseudo(s, 3) - 0.3) * 25).toFixed(2),
  };
});

export function FactorExposurePage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [view, setView] = useState<'exposure' | 'returns' | 'matrix'>('exposure');

  const data = useMemo(() => genFactorData(selectedTicker), [selectedTicker]);
  const allData = useMemo(() => TICKERS.map(t => genFactorData(t)), []);
  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sliders className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Factor Exposure</h1>
          <p className="text-sm text-slate-400">Multi-factor risk decomposition and attribution</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Overall Factor Score</div>
          <div className={cn('mt-1 text-2xl font-bold', data.overallScore >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {data.overallScore >= 0 ? '+' : ''}{data.overallScore}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Alpha</div>
          <div className={cn('mt-1 text-2xl font-bold', data.alpha >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {data.alpha >= 0 ? '+' : ''}{data.alpha}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Beta</div>
          <div className="mt-1 text-2xl font-bold text-white">{data.beta}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">R-Squared</div>
          <div className="mt-1 text-2xl font-bold text-white">{data.rSquared}</div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {(['exposure', 'returns', 'matrix'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', view === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
            {v === 'exposure' ? 'Factor Exposure' : v === 'returns' ? 'Factor Returns' : 'Cross-Stock Matrix'}
          </button>
        ))}
      </div>

      {view === 'exposure' && (
        <>
          {/* Factor bars */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">{selectedTicker} Factor Exposure</h3>
            <div className="space-y-4">
              {data.factors.map(f => {
                const colors = FACTOR_COLORS[f.factor as keyof typeof FACTOR_COLORS];
                const barWidth = Math.abs(f.score) * 50;
                return (
                  <div key={f.factor}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={cn('text-xs font-medium', colors.text)}>{f.factor}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500">P{f.percentile}</span>
                        <span className={cn('text-xs font-medium', f.score >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {f.score >= 0 ? '+' : ''}{f.score}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="flex h-5 w-full items-center">
                        {f.score < 0 ? (
                          <div className="flex w-full">
                            <div className="flex w-1/2 justify-end">
                              <div className={cn('h-5 rounded-l opacity-60', colors.bar)} style={{ width: `${barWidth}%` }} />
                            </div>
                            <div className="w-px bg-slate-600" />
                            <div className="w-1/2" />
                          </div>
                        ) : (
                          <div className="flex w-full">
                            <div className="w-1/2" />
                            <div className="w-px bg-slate-600" />
                            <div className="w-1/2">
                              <div className={cn('h-5 rounded-r opacity-60', colors.bar)} style={{ width: `${barWidth}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attribution table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Factor</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Score</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Percentile</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Return Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.factors.map(f => {
                  const colors = FACTOR_COLORS[f.factor as keyof typeof FACTOR_COLORS];
                  return (
                    <tr key={f.factor} className="bg-slate-800 hover:bg-slate-750">
                      <td className={cn('px-3 py-2 text-xs font-medium', colors.text)}>{f.factor}</td>
                      <td className={cn('px-3 py-2 text-right text-xs font-medium', f.score >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {f.score >= 0 ? '+' : ''}{f.score}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-300">{f.percentile}th</td>
                      <td className={cn('px-3 py-2 text-right text-xs font-medium', f.contribution >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {f.contribution >= 0 ? '+' : ''}{f.contribution}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'returns' && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Factor</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">1M</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">3M</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">YTD</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">1Y</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {FACTOR_RETURNS.map(fr => {
                const colors = FACTOR_COLORS[fr.factor as keyof typeof FACTOR_COLORS];
                return (
                  <tr key={fr.factor} className="bg-slate-800 hover:bg-slate-750">
                    <td className={cn('px-3 py-2 text-xs font-medium', colors.text)}>{fr.factor}</td>
                    {[fr.m1, fr.m3, fr.ytd, fr.y1].map((v, i) => (
                      <td key={i} className={cn('px-3 py-2 text-right text-xs font-medium', v >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {v >= 0 ? '+' : ''}{v}%
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'matrix' && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                {FACTORS.map(f => (
                  <th key={f} className="px-2 py-2 text-center text-[10px] font-medium text-slate-400">{f}</th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Overall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {allData.map(td => (
                <tr key={td.ticker} className={cn('bg-slate-800 hover:bg-slate-750', td.ticker === selectedTicker && 'bg-slate-700/50')}>
                  <td className="px-2 py-2 text-xs font-bold text-indigo-400">{td.ticker}</td>
                  {td.factors.map(f => {
                    const intensity = Math.abs(f.score);
                    const bg = f.score >= 0
                      ? `rgba(52, 211, 153, ${intensity * 0.3})`
                      : `rgba(248, 113, 113, ${intensity * 0.3})`;
                    return (
                      <td key={f.factor} className="px-2 py-2 text-center text-[11px] font-medium" style={{ backgroundColor: bg }}>
                        <span className={f.score >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {f.score >= 0 ? '+' : ''}{f.score}
                        </span>
                      </td>
                    );
                  })}
                  <td className={cn('px-2 py-2 text-center text-xs font-bold', td.overallScore >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {td.overallScore >= 0 ? '+' : ''}{td.overallScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
