import { useState, useMemo } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Impact = 'high' | 'medium' | 'low';
type Country = 'US' | 'EU' | 'UK' | 'JP' | 'CN';
type Surprise = 'beat' | 'miss' | 'inline';

interface EconEvent {
  id: number;
  country: Country;
  name: string;
  impact: Impact;
  dayOffset: number; // 0=Mon … 4=Fri
  hour: number;
  minute: number;
  previous: string;
  forecast: string;
  actual: string | null;
  surprise: Surprise | null;
  description: string;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLAG: Record<Country, string> = {
  US: '🇺🇸',
  EU: '🇪🇺',
  UK: '🇬🇧',
  JP: '🇯🇵',
  CN: '🇨🇳',
};

const COUNTRY_TABS: { key: Country | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'US', label: '🇺🇸 US' },
  { key: 'EU', label: '🇪🇺 EU' },
  { key: 'UK', label: '🇬🇧 UK' },
  { key: 'JP', label: '🇯🇵 Japan' },
  { key: 'CN', label: '🇨🇳 China' },
];

const IMPACT_TABS: { key: Impact | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'high', label: 'High Impact' },
  { key: 'medium', label: 'Medium Impact' },
  { key: 'low', label: 'Low Impact' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface EventTemplate {
  country: Country;
  name: string;
  impact: Impact;
  description: string;
  baseValue: string;
  unit: string;
}

const TEMPLATES: EventTemplate[] = [
  { country: 'US', name: 'CPI (YoY)', impact: 'high', description: 'Consumer Price Index measures the change in prices paid by consumers for goods and services. A key inflation gauge watched by the Federal Reserve.', baseValue: '3.2', unit: '%' },
  { country: 'US', name: 'Core CPI (MoM)', impact: 'high', description: 'Core CPI excludes volatile food and energy prices, providing a clearer picture of underlying inflation trends.', baseValue: '0.3', unit: '%' },
  { country: 'US', name: 'PPI (MoM)', impact: 'medium', description: 'Producer Price Index measures wholesale price changes. A leading indicator for consumer inflation.', baseValue: '0.2', unit: '%' },
  { country: 'US', name: 'Non-Farm Payrolls', impact: 'high', description: 'Measures the change in the number of employed people excluding the farming sector. The most important employment indicator.', baseValue: '187', unit: 'K' },
  { country: 'US', name: 'Unemployment Rate', impact: 'high', description: 'Percentage of the total labor force that is unemployed but actively seeking employment.', baseValue: '3.8', unit: '%' },
  { country: 'US', name: 'GDP (QoQ)', impact: 'high', description: 'Gross Domestic Product measures the annualized change in the value of all goods and services produced. The broadest measure of economic activity.', baseValue: '2.1', unit: '%' },
  { country: 'US', name: 'Retail Sales (MoM)', impact: 'high', description: 'Measures the change in the total value of sales at the retail level. The primary gauge of consumer spending.', baseValue: '0.4', unit: '%' },
  { country: 'US', name: 'FOMC Statement', impact: 'high', description: 'The Federal Open Market Committee statement communicates interest rate decisions and economic outlook. Markets closely parse the language for policy signals.', baseValue: '5.25', unit: '%' },
  { country: 'US', name: 'ISM Manufacturing PMI', impact: 'high', description: 'Institute for Supply Management survey of purchasing managers in the manufacturing sector. Above 50 indicates expansion.', baseValue: '49.2', unit: '' },
  { country: 'US', name: 'Consumer Confidence', impact: 'medium', description: 'Conference Board survey measuring consumer optimism about the economy. Higher readings indicate greater willingness to spend.', baseValue: '106.1', unit: '' },
  { country: 'US', name: 'Initial Jobless Claims', impact: 'medium', description: 'Weekly count of new unemployment benefit filings. A timely indicator of labor market health.', baseValue: '215', unit: 'K' },
  { country: 'US', name: 'Housing Starts', impact: 'medium', description: 'Number of new residential construction projects begun. Reflects housing demand and economic sentiment.', baseValue: '1.35', unit: 'M' },
  { country: 'US', name: 'Industrial Production (MoM)', impact: 'medium', description: 'Measures the change in output of factories, mines, and utilities. A key indicator of manufacturing health.', baseValue: '0.1', unit: '%' },
  { country: 'US', name: 'Durable Goods Orders', impact: 'medium', description: 'Measures the change in new orders for long-lasting manufactured goods. A leading indicator of production activity.', baseValue: '-0.5', unit: '%' },
  { country: 'US', name: 'Trade Balance', impact: 'low', description: 'The difference between imports and exports of goods and services. Affects currency valuations and GDP calculations.', baseValue: '-65.2', unit: 'B' },
  { country: 'EU', name: 'ECB Rate Decision', impact: 'high', description: 'European Central Bank interest rate announcement. The primary tool for controlling inflation in the Eurozone.', baseValue: '4.50', unit: '%' },
  { country: 'EU', name: 'GDP (QoQ)', impact: 'high', description: 'Eurozone Gross Domestic Product. Broadest measure of economic output across the 20-member currency bloc.', baseValue: '0.1', unit: '%' },
  { country: 'EU', name: 'CPI (YoY)', impact: 'high', description: 'Eurozone Harmonised Index of Consumer Prices. The ECB targets inflation near 2% over the medium term.', baseValue: '2.9', unit: '%' },
  { country: 'EU', name: 'Manufacturing PMI', impact: 'medium', description: 'Eurozone purchasing managers index for manufacturing. Below 50 signals contraction in the sector.', baseValue: '43.8', unit: '' },
  { country: 'UK', name: 'BOE Rate Decision', impact: 'high', description: 'Bank of England interest rate decision. The MPC votes on rates to maintain price stability and support growth.', baseValue: '5.25', unit: '%' },
  { country: 'UK', name: 'CPI (YoY)', impact: 'high', description: 'UK Consumer Price Index. Inflation remains a key concern for the Bank of England monetary policy committee.', baseValue: '4.0', unit: '%' },
  { country: 'UK', name: 'GDP (MoM)', impact: 'medium', description: 'Monthly UK GDP estimate. Provides a timely measure of economic growth or contraction in the United Kingdom.', baseValue: '0.2', unit: '%' },
  { country: 'UK', name: 'Retail Sales (MoM)', impact: 'medium', description: 'UK retail sales volume measure. Tracks consumer spending activity across the retail sector.', baseValue: '-0.3', unit: '%' },
  { country: 'JP', name: 'BOJ Policy Rate', impact: 'high', description: 'Bank of Japan interest rate decision. Japan has maintained ultra-loose monetary policy with negative rates for years.', baseValue: '-0.10', unit: '%' },
  { country: 'JP', name: 'GDP (QoQ)', impact: 'high', description: 'Japanese Gross Domestic Product. Measures the overall economic output of the world\'s fourth-largest economy.', baseValue: '0.5', unit: '%' },
  { country: 'JP', name: 'Tankan Manufacturing Index', impact: 'medium', description: 'Bank of Japan\'s quarterly survey of business confidence among large manufacturers. Positive values indicate optimism.', baseValue: '9', unit: '' },
  { country: 'JP', name: 'CPI (YoY)', impact: 'medium', description: 'Japan Consumer Price Index. Inflation dynamics in Japan are closely watched for signs of sustained price growth.', baseValue: '2.8', unit: '%' },
  { country: 'CN', name: 'GDP (YoY)', impact: 'high', description: 'Chinese Gross Domestic Product. Growth in the world\'s second-largest economy has global implications for trade and commodities.', baseValue: '4.9', unit: '%' },
  { country: 'CN', name: 'Manufacturing PMI', impact: 'high', description: 'Official Chinese purchasing managers index. A reading above 50 indicates expansion in the manufacturing sector.', baseValue: '50.2', unit: '' },
  { country: 'CN', name: 'Trade Balance', impact: 'medium', description: 'China\'s trade surplus or deficit. As the world\'s largest exporter, shifts in trade balance affect global markets.', baseValue: '82.3', unit: 'B' },
  { country: 'CN', name: 'CPI (YoY)', impact: 'medium', description: 'Chinese consumer inflation measure. Deflation concerns have emerged as a key issue for policymakers.', baseValue: '0.1', unit: '%' },
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(refMonday: Date, dayOffset: number): string {
  const d = new Date(refMonday);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${friday.toLocaleDateString('en-US', opts)}, ${monday.getFullYear()}`;
}

function formatDayHeader(monday: Date, dayOffset: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayOffset);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Event generation
// ---------------------------------------------------------------------------

function generateEvents(monday: Date): EconEvent[] {
  const weekKey = isoDate(monday, 0);
  const s = seed(weekKey);
  const events: EconEvent[] = [];

  // Deterministic schedule: spread templates across the week
  const hours = [8, 8, 9, 9, 10, 10, 11, 13, 14, 14, 15];
  const minutes = [0, 30, 0, 15, 0, 30, 0, 0, 0, 30, 0];

  TEMPLATES.forEach((tpl, idx) => {
    const dayOffset = Math.floor(pseudo(s, idx * 3) * 5);
    const timeIdx = Math.floor(pseudo(s, idx * 7 + 1) * hours.length);
    const hour = hours[timeIdx];
    const minute = minutes[timeIdx];

    const baseNum = parseFloat(tpl.baseValue);
    const variation = (pseudo(s, idx * 11 + 2) - 0.5) * 0.4;
    const prevVal = isNaN(baseNum) ? tpl.baseValue : (baseNum + variation * Math.abs(baseNum || 1)).toFixed(tpl.baseValue.includes('.') ? tpl.baseValue.split('.')[1].length : 0);
    const forecastVariation = (pseudo(s, idx * 13 + 3) - 0.5) * 0.2;
    const forecastVal = isNaN(baseNum) ? tpl.baseValue : (parseFloat(prevVal) + forecastVariation * Math.abs(baseNum || 1)).toFixed(tpl.baseValue.includes('.') ? tpl.baseValue.split('.')[1].length : 0);

    // ~60% of events are "released"
    const isReleased = pseudo(s, idx * 17 + 4) < 0.6;
    let actual: string | null = null;
    let surprise: Surprise | null = null;

    if (isReleased) {
      const actualVariation = (pseudo(s, idx * 19 + 5) - 0.5) * 0.3;
      actual = isNaN(baseNum) ? tpl.baseValue : (parseFloat(forecastVal) + actualVariation * Math.abs(baseNum || 1)).toFixed(tpl.baseValue.includes('.') ? tpl.baseValue.split('.')[1].length : 0);
      const diff = parseFloat(actual) - parseFloat(forecastVal);
      const threshold = Math.abs(parseFloat(forecastVal)) * 0.02 || 0.05;
      if (Math.abs(diff) < threshold) {
        surprise = 'inline';
      } else if (diff > 0) {
        // For unemployment/jobless: higher actual = miss
        const inverseName = tpl.name.toLowerCase().includes('unemployment') || tpl.name.toLowerCase().includes('jobless');
        surprise = inverseName ? 'miss' : 'beat';
      } else {
        const inverseName = tpl.name.toLowerCase().includes('unemployment') || tpl.name.toLowerCase().includes('jobless');
        surprise = inverseName ? 'beat' : 'miss';
      }
    }

    events.push({
      id: idx,
      country: tpl.country,
      name: tpl.name,
      impact: tpl.impact,
      dayOffset,
      hour,
      minute,
      previous: `${prevVal}${tpl.unit}`,
      forecast: `${forecastVal}${tpl.unit}`,
      actual: actual !== null ? `${actual}${tpl.unit}` : null,
      surprise,
      description: tpl.description,
    });
  });

  // Sort by day then time
  events.sort((a, b) => a.dayOffset - b.dayOffset || a.hour - b.hour || a.minute - b.minute);
  return events;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const IMPACT_DOT: Record<Impact, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

const SURPRISE_LABEL: Record<Surprise, { text: string; cls: string }> = {
  beat: { text: 'Beat', cls: 'text-emerald-400' },
  miss: { text: 'Miss', cls: 'text-red-400' },
  inline: { text: 'Inline', cls: 'text-slate-400' },
};

function ImpactDot({ impact }: { impact: Impact }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-2 rounded-full', IMPACT_DOT[impact])} />
      <span className="text-xs capitalize text-slate-400">{impact}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EconCalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [countryFilter, setCountryFilter] = useState<Country | 'ALL'>('ALL');
  const [impactFilter, setImpactFilter] = useState<Impact | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const monday = useMemo(() => {
    const m = getMonday(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const allEvents = useMemo(() => generateEvents(monday), [monday]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (countryFilter !== 'ALL' && e.country !== countryFilter) return false;
      if (impactFilter !== 'ALL' && e.impact !== impactFilter) return false;
      return true;
    });
  }, [allEvents, countryFilter, impactFilter]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<number, EconEvent[]>();
    for (const ev of filteredEvents) {
      const arr = map.get(ev.dayOffset) ?? [];
      arr.push(ev);
      map.set(ev.dayOffset, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filteredEvents]);

  // Find next upcoming unreleased event
  const nextUpcomingId = useMemo(() => {
    const unreleased = allEvents.filter((e) => e.actual === null);
    return unreleased.length > 0 ? unreleased[0].id : null;
  }, [allEvents]);

  // Summary stats
  const summary = useMemo(() => {
    const highImpact = allEvents.filter((e) => e.impact === 'high').slice(0, 5);
    const released = allEvents.filter((e) => e.actual !== null).length;
    const pending = allEvents.length - released;
    const surprises = allEvents.filter((e) => e.surprise !== null);
    let beats = 0;
    let misses = 0;
    for (const e of surprises) {
      if (e.surprise === 'beat') beats++;
      if (e.surprise === 'miss') misses++;
    }
    const lean = beats > misses ? 'Hawkish lean' : beats < misses ? 'Dovish lean' : 'Neutral';
    return { highImpact, released, pending, lean, beats, misses };
  }, [allEvents]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CalendarClock className="h-7 w-7 text-blue-400" />
            <h1 className="text-2xl font-bold">Economic Calendar</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">
            Track upcoming and recent economic data releases across major economies.
            High-impact events can move markets significantly — monitor forecasts, actuals, and surprise direction.
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-slate-200 min-w-[220px] text-center">
              {formatWeekLabel(monday)}
            </span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors text-slate-300"
            >
              This Week
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Country tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1 border border-slate-700">
            {COUNTRY_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCountryFilter(tab.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  countryFilter === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Impact tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1 border border-slate-700">
            <Filter className="h-3.5 w-3.5 text-slate-500 ml-2" />
            {IMPACT_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setImpactFilter(tab.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  impactFilter === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Key events */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Key Events This Week
            </h3>
            <ul className="space-y-1.5">
              {summary.highImpact.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span>{FLAG[e.country]}</span>
                  <span className="text-slate-200 truncate">{e.name}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {DAY_NAMES[e.dayOffset]?.slice(0, 3)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {/* Release status */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Release Status
            </h3>
            <div className="flex items-end gap-6">
              <div>
                <div className="text-3xl font-bold text-emerald-400">{summary.released}</div>
                <div className="text-xs text-slate-500">Released</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-400">{summary.pending}</div>
                <div className="text-xs text-slate-500">Pending</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-300">{allEvents.length}</div>
                <div className="text-xs text-slate-500">Total</div>
              </div>
            </div>
          </div>
          {/* Surprise direction */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Surprise Direction
            </h3>
            <div className="text-xl font-bold mb-1">
              <span className={cn(
                summary.lean === 'Hawkish lean' ? 'text-red-400' :
                summary.lean === 'Dovish lean' ? 'text-emerald-400' : 'text-slate-300'
              )}>
                {summary.lean}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400">{summary.beats} beats</span>
              <span className="text-slate-600">|</span>
              <span className="text-red-400">{summary.misses} misses</span>
            </div>
          </div>
        </div>

        {/* Events table grouped by day */}
        {grouped.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            No events match the current filters.
          </div>
        )}

        {grouped.map(([dayOffset, events]) => (
          <div key={dayOffset} className="mb-6">
            {/* Day header */}
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-sm font-semibold text-slate-300">
                {formatDayHeader(monday, dayOffset)}
              </h2>
              <div className="flex-1 border-t border-slate-700/60" />
              <span className="text-xs text-slate-500">{events.length} events</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left font-medium">Time (EST)</th>
                    <th className="px-4 py-2.5 text-left font-medium w-8" />
                    <th className="px-4 py-2.5 text-left font-medium">Event</th>
                    <th className="px-4 py-2.5 text-left font-medium">Impact</th>
                    <th className="px-4 py-2.5 text-right font-medium">Previous</th>
                    <th className="px-4 py-2.5 text-right font-medium">Forecast</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                    <th className="px-4 py-2.5 text-right font-medium">Surprise</th>
                    <th className="px-4 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => {
                    const isExpanded = expandedId === ev.id;
                    const isNext = ev.id === nextUpcomingId;
                    return (
                      <EventRow
                        key={ev.id}
                        event={ev}
                        isExpanded={isExpanded}
                        isNext={isNext}
                        onToggle={() => setExpandedId(isExpanded ? null : ev.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event row component
// ---------------------------------------------------------------------------

function EventRow({
  event,
  isExpanded,
  isNext,
  onToggle,
}: {
  event: EconEvent;
  isExpanded: boolean;
  isNext: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'border-b border-slate-700/50 cursor-pointer transition-colors',
          isNext ? 'bg-blue-950/30' : 'hover:bg-slate-700/30'
        )}
      >
        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            {isNext && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
            {formatTime(event.hour, event.minute)}
          </span>
        </td>
        <td className="px-2 py-2.5 text-base">{FLAG[event.country]}</td>
        <td className="px-4 py-2.5 font-medium text-slate-100">{event.name}</td>
        <td className="px-4 py-2.5"><ImpactDot impact={event.impact} /></td>
        <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">{event.previous}</td>
        <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{event.forecast}</td>
        <td className={cn(
          'px-4 py-2.5 text-right tabular-nums font-medium',
          event.actual !== null ? 'text-white' : 'text-slate-600'
        )}>
          {event.actual ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-right">
          {event.surprise ? (
            <span className={cn('text-xs font-semibold', SURPRISE_LABEL[event.surprise].cls)}>
              {SURPRISE_LABEL[event.surprise].text}
            </span>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-slate-500">
          <ChevronDown className={cn(
            'h-4 w-4 transition-transform',
            isExpanded && 'rotate-180'
          )} />
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-800/50">
          <td colSpan={9} className="px-6 py-4">
            <div className="max-w-2xl text-sm text-slate-400 leading-relaxed">
              {event.description}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
