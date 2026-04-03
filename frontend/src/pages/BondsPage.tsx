import { useState, useMemo } from 'react';
import { Banknote, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

type BondCategory = 'treasuries' | 'corporate' | 'municipal' | 'international';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const MATURITIES = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'] as const;

const BASE_YIELDS: Record<string, number> = {
  '1M': 5.32, '3M': 5.28, '6M': 5.18, '1Y': 4.92, '2Y': 4.71,
  '3Y': 4.48, '5Y': 4.32, '7Y': 4.38, '10Y': 4.42, '20Y': 4.68, '30Y': 4.56,
};

interface TreasuryRate {
  maturity: string;
  yield_: number;
  dailyChg: number;
  weekChg: number;
  monthChg: number;
}

interface CorporateBond {
  issuer: string;
  coupon: number;
  maturity: string;
  rating: string;
  yield_: number;
  spread: number;
  price: number;
}

interface MuniBond {
  issuer: string;
  coupon: number;
  maturity: string;
  rating: string;
  yield_: number;
  taxEquivYield: number;
  price: number;
}

interface CreditSpread {
  label: string;
  category: string;
  spread: number;
  change: number;
}

const TABS: { label: string; value: BondCategory }[] = [
  { label: 'Treasuries', value: 'treasuries' },
  { label: 'Corporate', value: 'corporate' },
  { label: 'Municipal', value: 'municipal' },
  { label: 'International', value: 'international' },
];

function generateTreasuryRates(): TreasuryRate[] {
  return MATURITIES.map((m) => {
    const s = seed(m);
    return {
      maturity: m,
      yield_: BASE_YIELDS[m],
      dailyChg: +(pseudo(s, 1) * 0.12 - 0.06).toFixed(3),
      weekChg: +(pseudo(s, 2) * 0.24 - 0.12).toFixed(3),
      monthChg: +(pseudo(s, 3) * 0.40 - 0.20).toFixed(3),
    };
  });
}

function generateCorporateBonds(): CorporateBond[] {
  const issuers = [
    { name: 'Apple Inc', rating: 'AA+' }, { name: 'Microsoft Corp', rating: 'AAA' },
    { name: 'JPMorgan Chase', rating: 'A+' }, { name: 'Amazon.com', rating: 'AA' },
    { name: 'Goldman Sachs', rating: 'A+' }, { name: 'Meta Platforms', rating: 'A' },
    { name: 'Bank of America', rating: 'A-' }, { name: 'Tesla Inc', rating: 'BBB' },
    { name: 'Ford Motor Co', rating: 'BBB-' }, { name: 'AT&T Inc', rating: 'BBB' },
    { name: 'Verizon Comms', rating: 'BBB+' }, { name: 'Comcast Corp', rating: 'A-' },
  ];
  return issuers.map((iss, idx) => {
    const s = seed(iss.name);
    const coupon = +(3.5 + pseudo(s, 1) * 3.5).toFixed(3);
    const yield_ = +(coupon + pseudo(s, 2) * 0.8 - 0.3).toFixed(3);
    const spread = Math.round(50 + pseudo(s, 3) * 250);
    const price = +(100 + (coupon - yield_) * (3 + idx * 0.5)).toFixed(2);
    const yr = 2026 + Math.floor(pseudo(s, 4) * 10);
    const mo = 1 + Math.floor(pseudo(s, 5) * 12);
    return {
      issuer: iss.name, coupon, maturity: `${mo.toString().padStart(2, '0')}/${yr}`,
      rating: iss.rating, yield_, spread, price,
    };
  });
}

function generateMuniBonds(): MuniBond[] {
  const issuers = [
    'State of California', 'New York City GO', 'Texas Water Dev Board',
    'Illinois Tollway Auth', 'Florida Board of Ed', 'Massachusetts GO',
    'Washington State GO', 'Pennsylvania Turnpike',
  ];
  const TAX_RATE = 0.37;
  return issuers.map((name) => {
    const s = seed(name);
    const coupon = +(2.5 + pseudo(s, 1) * 2.5).toFixed(3);
    const yield_ = +(coupon + pseudo(s, 2) * 0.4 - 0.15).toFixed(3);
    const price = +(100 + (coupon - yield_) * 5).toFixed(2);
    const yr = 2028 + Math.floor(pseudo(s, 3) * 15);
    const mo = 1 + Math.floor(pseudo(s, 4) * 12);
    const ratings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A'];
    const rating = ratings[Math.floor(pseudo(s, 5) * ratings.length)];
    return {
      issuer: name, coupon, maturity: `${mo.toString().padStart(2, '0')}/${yr}`,
      rating, yield_, taxEquivYield: +(yield_ / (1 - TAX_RATE)).toFixed(3), price,
    };
  });
}

function generateCreditSpreads(): CreditSpread[] {
  return [
    { label: 'IG Corporate', category: 'Investment Grade', spread: 112, change: -3 },
    { label: 'HY Corporate', category: 'High Yield', spread: 342, change: 8 },
    { label: 'AAA Spread', category: 'AAA', spread: 48, change: -1 },
    { label: 'BBB Spread', category: 'BBB', spread: 158, change: 5 },
  ];
}

function ChangeIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-slate-400">0{suffix}</span>;
  const positive = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', positive ? 'text-red-400' : 'text-emerald-400')}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{value.toFixed(3)}{suffix}
    </span>
  );
}

function BpsChange({ value }: { value: number }) {
  if (value === 0) return <span className="text-slate-400">0 bps</span>;
  const positive = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', positive ? 'text-red-400' : 'text-emerald-400')}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{value} bps
    </span>
  );
}

export function BondsPage() {
  const [activeTab, setActiveTab] = useState<BondCategory>('treasuries');
  const [taxRate, setTaxRate] = useState(37);

  const rates = useMemo(generateTreasuryRates, []);
  const corporateBonds = useMemo(generateCorporateBonds, []);
  const muniBonds = useMemo(generateMuniBonds, []);
  const creditSpreads = useMemo(generateCreditSpreads, []);

  const ten = rates.find((r) => r.maturity === '10Y')!;
  const two = rates.find((r) => r.maturity === '2Y')!;
  const spread2s10s = +((ten.yield_ - two.yield_) * 100).toFixed(1);
  const isInverted = spread2s10s < 0;

  const summaryCards = [
    { label: '10Y Treasury', value: `${ten.yield_.toFixed(2)}%`, change: ten.dailyChg, isBps: false },
    { label: '2Y Treasury', value: `${two.yield_.toFixed(2)}%`, change: two.dailyChg, isBps: false },
    { label: '2s/10s Spread', value: `${spread2s10s > 0 ? '+' : ''}${spread2s10s} bps`, change: 0, isBps: true, inverted: isInverted },
    { label: 'IG Corp Spread', value: `${creditSpreads[0].spread} bps`, change: creditSpreads[0].change, isBps: true },
    { label: 'HY Corp Spread', value: `${creditSpreads[1].spread} bps`, change: creditSpreads[1].change, isBps: true },
    { label: 'Fed Funds Rate', value: '5.33%', change: 0, isBps: false },
  ];

  const maxYield = Math.max(...rates.map((r) => r.yield_));

  const adjustedMunis = useMemo(() => {
    const rate = taxRate / 100;
    return muniBonds.map((b) => ({
      ...b,
      taxEquivYield: +(b.yield_ / (1 - rate)).toFixed(3),
    }));
  }, [muniBonds, taxRate]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Banknote className="h-8 w-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Bonds &amp; Fixed Income</h1>
          <p className="text-slate-400 text-sm">Treasury yields, credit spreads, and fixed income markets</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              {card.label}
              {'inverted' in card && card.inverted && (
                <AlertTriangle className="h-3 w-3 text-amber-400" />
              )}
            </div>
            <div className={cn('text-lg font-bold', 'inverted' in card && card.inverted && 'text-amber-400')}>
              {card.value}
            </div>
            <div className="text-xs mt-1">
              {card.isBps ? <BpsChange value={card.change} /> : <ChangeIndicator value={card.change} />}
            </div>
          </div>
        ))}
      </div>

      {/* Yield Curve */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">US Treasury Yield Curve</h2>
        <div className="flex items-end gap-2 h-48">
          {rates.map((r, i) => {
            const height = (r.yield_ / maxYield) * 100;
            const prevYield = i > 0 ? rates[i - 1].yield_ : null;
            const inverted = prevYield !== null && r.yield_ < prevYield;
            return (
              <div key={r.maturity} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400">{r.yield_.toFixed(2)}%</span>
                <div className="w-full flex items-end justify-center" style={{ height: '140px' }}>
                  <div
                    className={cn(
                      'w-full max-w-[32px] rounded-t transition-all',
                      inverted ? 'bg-amber-500/80' : 'bg-blue-500/80'
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{r.maturity}</span>
                <span className="text-[9px]">
                  <ChangeIndicator value={r.dailyChg} />
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/80" /> Normal</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/80" /> Inverted</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-1.5 rounded text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Treasuries Tab */}
      {activeTab === 'treasuries' && (
        <div className="space-y-6">
          {/* Rates Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-300">Treasury Rates</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="text-left p-3">Maturity</th>
                    <th className="text-right p-3">Yield</th>
                    <th className="text-right p-3">Daily Chg</th>
                    <th className="text-right p-3">1W Chg</th>
                    <th className="text-right p-3">1M Chg</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.maturity} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3 font-medium">{r.maturity}</td>
                      <td className="p-3 text-right font-mono">{r.yield_.toFixed(3)}%</td>
                      <td className="p-3 text-right"><ChangeIndicator value={r.dailyChg} /></td>
                      <td className="p-3 text-right"><ChangeIndicator value={r.weekChg} /></td>
                      <td className="p-3 text-right"><ChangeIndicator value={r.monthChg} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit Spreads */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-300">Credit Spreads</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700">
              {creditSpreads.map((cs) => (
                <div key={cs.label} className="bg-slate-800 p-4">
                  <div className="text-xs text-slate-400 mb-1">{cs.label}</div>
                  <div className="text-xl font-bold">{cs.spread} <span className="text-sm font-normal text-slate-400">bps</span></div>
                  <div className="text-xs mt-1"><BpsChange value={cs.change} /></div>
                  <div className="text-[10px] text-slate-500 mt-1">{cs.category}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Corporate Tab */}
      {activeTab === 'corporate' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300">Corporate Bonds</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-slate-700">
                  <th className="text-left p-3">Issuer</th>
                  <th className="text-right p-3">Coupon</th>
                  <th className="text-right p-3">Maturity</th>
                  <th className="text-center p-3">Rating</th>
                  <th className="text-right p-3">Yield</th>
                  <th className="text-right p-3">Spread (bps)</th>
                  <th className="text-right p-3">Price</th>
                </tr>
              </thead>
              <tbody>
                {corporateBonds.map((b) => {
                  const ratingColor = b.rating.startsWith('AAA')
                    ? 'text-emerald-400'
                    : b.rating.startsWith('AA')
                      ? 'text-green-400'
                      : b.rating.startsWith('A')
                        ? 'text-blue-400'
                        : 'text-amber-400';
                  return (
                    <tr key={b.issuer} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3 font-medium">{b.issuer}</td>
                      <td className="p-3 text-right font-mono">{b.coupon.toFixed(3)}%</td>
                      <td className="p-3 text-right text-slate-300">{b.maturity}</td>
                      <td className={cn('p-3 text-center font-medium', ratingColor)}>{b.rating}</td>
                      <td className="p-3 text-right font-mono">{b.yield_.toFixed(3)}%</td>
                      <td className="p-3 text-right font-mono">{b.spread}</td>
                      <td className="p-3 text-right font-mono">{b.price.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Municipal Tab */}
      {activeTab === 'municipal' && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm text-slate-400">Federal Tax Rate:</label>
              <input
                type="range"
                min={10}
                max={50}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-40 accent-blue-500"
              />
              <span className="text-sm font-medium w-12">{taxRate}%</span>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-300">Municipal Bonds</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="text-left p-3">Issuer</th>
                    <th className="text-right p-3">Coupon</th>
                    <th className="text-right p-3">Maturity</th>
                    <th className="text-center p-3">Rating</th>
                    <th className="text-right p-3">Yield</th>
                    <th className="text-right p-3">Tax-Equiv Yield</th>
                    <th className="text-right p-3">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustedMunis.map((b) => (
                    <tr key={b.issuer} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3 font-medium">{b.issuer}</td>
                      <td className="p-3 text-right font-mono">{b.coupon.toFixed(3)}%</td>
                      <td className="p-3 text-right text-slate-300">{b.maturity}</td>
                      <td className="p-3 text-center font-medium text-emerald-400">{b.rating}</td>
                      <td className="p-3 text-right font-mono">{b.yield_.toFixed(3)}%</td>
                      <td className="p-3 text-right font-mono text-blue-400">{b.taxEquivYield.toFixed(3)}%</td>
                      <td className="p-3 text-right font-mono">{b.price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* International Tab */}
      {activeTab === 'international' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300">International Government Bonds (10Y)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-slate-700">
                  <th className="text-left p-3">Country</th>
                  <th className="text-right p-3">Yield</th>
                  <th className="text-right p-3">Daily Chg</th>
                  <th className="text-right p-3">Spread vs UST</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { country: 'Germany (Bund)', yield_: 2.42 },
                  { country: 'United Kingdom (Gilt)', yield_: 4.18 },
                  { country: 'Japan (JGB)', yield_: 0.88 },
                  { country: 'France (OAT)', yield_: 2.98 },
                  { country: 'Italy (BTP)', yield_: 3.72 },
                  { country: 'Canada', yield_: 3.48 },
                  { country: 'Australia', yield_: 4.22 },
                  { country: 'Switzerland', yield_: 0.72 },
                ].map((bond) => {
                  const s = seed(bond.country);
                  const dailyChg = +(pseudo(s, 1) * 0.10 - 0.05).toFixed(3);
                  const spreadVsUst = Math.round((bond.yield_ - ten.yield_) * 100);
                  return (
                    <tr key={bond.country} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3 font-medium">{bond.country}</td>
                      <td className="p-3 text-right font-mono">{bond.yield_.toFixed(3)}%</td>
                      <td className="p-3 text-right"><ChangeIndicator value={dailyChg} /></td>
                      <td className="p-3 text-right font-mono">
                        <span className={spreadVsUst < 0 ? 'text-emerald-400' : 'text-slate-300'}>
                          {spreadVsUst > 0 ? '+' : ''}{spreadVsUst} bps
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
