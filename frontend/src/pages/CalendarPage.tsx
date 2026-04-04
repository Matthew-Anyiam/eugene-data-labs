import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, List, LayoutGrid, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventType = 'earnings' | 'economic' | 'ipo' | 'dividend' | 'fed';
type Importance = 'high' | 'medium' | 'low';
type ViewMode = 'calendar' | 'list';

interface MarketEvent {
  id: number;
  type: EventType;
  date: string;          // ISO date yyyy-mm-dd
  importance: Importance;
  title: string;
  meta: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return ISO date string offset from a reference Monday */
function isoDate(refMonday: Date, dayOffset: number): string {
  const d = new Date(refMonday);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

/** Get the Monday of the week containing `date` */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${friday.toLocaleDateString('en-US', opts)}, ${monday.getFullYear()}`;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ---------------------------------------------------------------------------
// Event styling config
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<EventType, { label: string; bg: string; text: string; dot: string }> = {
  earnings:  { label: 'Earnings',    bg: 'bg-purple-900/40', text: 'text-purple-300', dot: 'bg-purple-400' },
  economic:  { label: 'Economic',    bg: 'bg-blue-900/40',   text: 'text-blue-300',   dot: 'bg-blue-400' },
  ipo:       { label: 'IPO',         bg: 'bg-green-900/40',  text: 'text-green-300',  dot: 'bg-green-400' },
  dividend:  { label: 'Dividend',    bg: 'bg-amber-900/40',  text: 'text-amber-300',  dot: 'bg-amber-400' },
  fed:       { label: 'Fed / CB',    bg: 'bg-red-900/40',    text: 'text-red-300',    dot: 'bg-red-400' },
};

const IMPORTANCE_DOT: Record<Importance, string> = {
  high:   'bg-red-400',
  medium: 'bg-yellow-400',
  low:    'bg-slate-500',
};

// ---------------------------------------------------------------------------
// Deterministic mock data
// ---------------------------------------------------------------------------

function buildMockEvents(thisMonday: Date): MarketEvent[] {
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  let id = 1;

  const events: MarketEvent[] = [
    // ---- Week 1 Earnings (5) ----
    { id: id++, type: 'earnings', date: isoDate(thisMonday, 0), importance: 'high',   title: 'Apple Inc.', meta: { ticker: 'AAPL', timing: 'AMC', eps: '$1.58' } },
    { id: id++, type: 'earnings', date: isoDate(thisMonday, 0), importance: 'high',   title: 'Microsoft Corp.', meta: { ticker: 'MSFT', timing: 'AMC', eps: '$2.82' } },
    { id: id++, type: 'earnings', date: isoDate(thisMonday, 1), importance: 'high',   title: 'Alphabet Inc.', meta: { ticker: 'GOOGL', timing: 'AMC', eps: '$1.89' } },
    { id: id++, type: 'earnings', date: isoDate(thisMonday, 2), importance: 'medium', title: 'Meta Platforms', meta: { ticker: 'META', timing: 'BMO', eps: '$5.25' } },
    { id: id++, type: 'earnings', date: isoDate(thisMonday, 3), importance: 'high',   title: 'Amazon.com Inc.', meta: { ticker: 'AMZN', timing: 'AMC', eps: '$1.14' } },

    // ---- Week 2 Earnings (5) ----
    { id: id++, type: 'earnings', date: isoDate(nextMonday, 0), importance: 'high',   title: 'NVIDIA Corp.', meta: { ticker: 'NVDA', timing: 'AMC', eps: '$0.82' } },
    { id: id++, type: 'earnings', date: isoDate(nextMonday, 1), importance: 'medium', title: 'Tesla Inc.', meta: { ticker: 'TSLA', timing: 'AMC', eps: '$0.73' } },
    { id: id++, type: 'earnings', date: isoDate(nextMonday, 2), importance: 'medium', title: 'Netflix Inc.', meta: { ticker: 'NFLX', timing: 'BMO', eps: '$4.52' } },
    { id: id++, type: 'earnings', date: isoDate(nextMonday, 3), importance: 'medium', title: 'JPMorgan Chase', meta: { ticker: 'JPM', timing: 'BMO', eps: '$4.11' } },
    { id: id++, type: 'earnings', date: isoDate(nextMonday, 4), importance: 'low',    title: 'Intel Corp.', meta: { ticker: 'INTC', timing: 'AMC', eps: '$0.13' } },

    // ---- Week 1 Economic (4) ----
    { id: id++, type: 'economic', date: isoDate(thisMonday, 0), importance: 'high',   title: 'CPI (MoM)', meta: { previous: '0.4%', forecast: '0.3%' } },
    { id: id++, type: 'economic', date: isoDate(thisMonday, 1), importance: 'high',   title: 'Core CPI (YoY)', meta: { previous: '3.8%', forecast: '3.7%' } },
    { id: id++, type: 'economic', date: isoDate(thisMonday, 3), importance: 'medium', title: 'Initial Jobless Claims', meta: { previous: '217K', forecast: '215K' } },
    { id: id++, type: 'economic', date: isoDate(thisMonday, 4), importance: 'medium', title: 'PPI (MoM)', meta: { previous: '0.3%', forecast: '0.2%' } },

    // ---- Week 2 Economic (4) ----
    { id: id++, type: 'economic', date: isoDate(nextMonday, 0), importance: 'high',   title: 'FOMC Minutes', meta: { previous: '—', forecast: '—' } },
    { id: id++, type: 'economic', date: isoDate(nextMonday, 2), importance: 'high',   title: 'GDP (QoQ)', meta: { previous: '3.3%', forecast: '2.8%' } },
    { id: id++, type: 'economic', date: isoDate(nextMonday, 3), importance: 'medium', title: 'Initial Jobless Claims', meta: { previous: '215K', forecast: '220K' } },
    { id: id++, type: 'economic', date: isoDate(nextMonday, 4), importance: 'low',    title: 'Michigan Consumer Sentiment', meta: { previous: '79.4', forecast: '78.9' } },

    // ---- IPO (4) ----
    { id: id++, type: 'ipo', date: isoDate(thisMonday, 2), importance: 'high',   title: 'Nextera Robotics', meta: { range: '$18 – $21' } },
    { id: id++, type: 'ipo', date: isoDate(thisMonday, 4), importance: 'medium', title: 'Quantum Cloud Inc.', meta: { range: '$14 – $16' } },
    { id: id++, type: 'ipo', date: isoDate(nextMonday, 1), importance: 'medium', title: 'BioGenX Therapeutics', meta: { range: '$22 – $25' } },
    { id: id++, type: 'ipo', date: isoDate(nextMonday, 3), importance: 'low',    title: 'SolarEdge Storage', meta: { range: '$10 – $12' } },

    // ---- Dividend (6) ----
    { id: id++, type: 'dividend', date: isoDate(thisMonday, 0), importance: 'low',    title: 'Coca-Cola Co.', meta: { ticker: 'KO', amount: '$0.485', yield: '3.1%' } },
    { id: id++, type: 'dividend', date: isoDate(thisMonday, 2), importance: 'low',    title: 'Procter & Gamble', meta: { ticker: 'PG', amount: '$1.006', yield: '2.4%' } },
    { id: id++, type: 'dividend', date: isoDate(thisMonday, 4), importance: 'low',    title: 'Johnson & Johnson', meta: { ticker: 'JNJ', amount: '$1.24', yield: '2.9%' } },
    { id: id++, type: 'dividend', date: isoDate(nextMonday, 0), importance: 'low',    title: 'PepsiCo Inc.', meta: { ticker: 'PEP', amount: '$1.355', yield: '2.7%' } },
    { id: id++, type: 'dividend', date: isoDate(nextMonday, 2), importance: 'low',    title: 'Exxon Mobil', meta: { ticker: 'XOM', amount: '$0.95', yield: '3.4%' } },
    { id: id++, type: 'dividend', date: isoDate(nextMonday, 4), importance: 'low',    title: 'Chevron Corp.', meta: { ticker: 'CVX', amount: '$1.63', yield: '4.0%' } },

    // ---- Fed / Central Bank (3) ----
    { id: id++, type: 'fed', date: isoDate(thisMonday, 1), importance: 'high',   title: 'Fed Rate Decision', meta: { meeting: 'FOMC', expected: 'Hold at 5.25-5.50%' } },
    { id: id++, type: 'fed', date: isoDate(nextMonday, 0), importance: 'medium', title: 'ECB Rate Decision', meta: { meeting: 'Governing Council', expected: 'Hold at 4.50%' } },
    { id: id++, type: 'fed', date: isoDate(nextMonday, 3), importance: 'medium', title: 'BOE Rate Decision', meta: { meeting: 'MPC Meeting', expected: 'Hold at 5.25%' } },
  ];

  return events;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImportanceDot({ level }: { level: Importance }) {
  return (
    <span
      className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', IMPORTANCE_DOT[level])}
      title={`${level} importance`}
    />
  );
}

function EventBadge({ type }: { type: EventType }) {
  const cfg = EVENT_CONFIG[type];
  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

function EventCard({ event }: { event: MarketEvent }) {
  const cfg = EVENT_CONFIG[event.type];
  return (
    <div className={cn('rounded-md border px-3 py-2 text-sm space-y-1', cfg.bg, 'border-slate-700/60')}>
      <div className="flex items-center gap-1.5">
        <ImportanceDot level={event.importance} />
        <EventBadge type={event.type} />
      </div>
      <p className="font-medium text-white truncate">{event.title}</p>
      {event.type === 'earnings' && (
        <p className="text-xs text-slate-400">
          {event.meta.ticker} &middot; {event.meta.timing} &middot; Est. {event.meta.eps}
        </p>
      )}
      {event.type === 'economic' && (
        <p className="text-xs text-slate-400">
          Prev {event.meta.previous} &middot; Fcst {event.meta.forecast}
        </p>
      )}
      {event.type === 'ipo' && (
        <p className="text-xs text-slate-400">Range {event.meta.range}</p>
      )}
      {event.type === 'dividend' && (
        <p className="text-xs text-slate-400">
          {event.meta.ticker} &middot; {event.meta.amount} &middot; {event.meta.yield}
        </p>
      )}
      {event.type === 'fed' && (
        <p className="text-xs text-slate-400">
          {event.meta.meeting} &middot; {event.meta.expected}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [filters, setFilters] = useState<Record<EventType, boolean>>({
    earnings: true,
    economic: true,
    ipo: true,
    dividend: true,
    fed: true,
  });

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const baseMonday = useMemo(() => getMonday(new Date()), []);

  const currentMonday = useMemo(() => {
    const m = new Date(baseMonday);
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [baseMonday, weekOffset]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [currentMonday]);

  const allEvents = useMemo(() => buildMockEvents(baseMonday), [baseMonday]);

  const visibleEvents = useMemo(
    () => allEvents.filter((e) => filters[e.type]),
    [allEvents, filters],
  );

  const weekEvents = useMemo(
    () => visibleEvents.filter((e) => weekDates.includes(e.date)),
    [visibleEvents, weekDates],
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, MarketEvent[]> = {};
    for (const date of weekDates) map[date] = [];
    for (const ev of weekEvents) {
      if (map[ev.date]) map[ev.date].push(ev);
    }
    return map;
  }, [weekDates, weekEvents]);

  const listEvents = useMemo(
    () => [...weekEvents].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
    [weekEvents],
  );

  const toggleFilter = (type: EventType) =>
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Calendar className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Market Calendar</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Consolidated view of earnings, economic releases, IPOs, dividends, and central bank events.
        </p>
      </div>

      {/* Toolbar: filters + view toggle + navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-slate-400" />
          {(Object.keys(EVENT_CONFIG) as EventType[]).map((type) => {
            const cfg = EVENT_CONFIG[type];
            return (
              <label
                key={type}
                className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={filters[type]}
                  onChange={() => toggleFilter(type)}
                  className="accent-blue-500 h-3.5 w-3.5 rounded"
                />
                <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                <span className="text-slate-300">{cfg.label}</span>
              </label>
            );
          })}
        </div>

        {/* View toggle + week nav */}
        <div className="flex items-center gap-3">
          {/* View mode */}
          <div className="flex rounded-md border border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'calendar'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white',
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors min-w-[180px] text-center"
            >
              {formatWeekLabel(currentMonday)}
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid view */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-5 gap-3">
          {weekDates.map((date, idx) => {
            const isToday = date === todayStr;
            const dayEvents = eventsByDate[date] ?? [];
            const dayDate = new Date(date + 'T00:00:00');
            return (
              <div
                key={date}
                className={cn(
                  'rounded-lg border min-h-[320px] flex flex-col',
                  isToday ? 'border-blue-500/60 bg-slate-800/80' : 'border-slate-700 bg-slate-800/40',
                )}
              >
                {/* Day header */}
                <div
                  className={cn(
                    'px-3 py-2 border-b text-sm font-medium flex items-center justify-between',
                    isToday ? 'border-blue-500/40 text-blue-300' : 'border-slate-700 text-slate-300',
                  )}
                >
                  <span>
                    {DAY_NAMES[idx]}{' '}
                    <span className={isToday ? 'text-blue-400' : 'text-slate-500'}>
                      {dayDate.getDate()}
                    </span>
                  </span>
                  {dayEvents.length > 0 && (
                    <span
                      className={cn(
                        'text-[10px] font-bold rounded-full px-1.5 py-0.5',
                        isToday
                          ? 'bg-blue-500/30 text-blue-300'
                          : 'bg-slate-700 text-slate-400',
                      )}
                    >
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Events */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {dayEvents.length === 0 && (
                    <p className="text-xs text-slate-600 text-center mt-8">No events</p>
                  )}
                  {dayEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 divide-y divide-slate-700/60">
          {listEvents.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-12">No events this week.</p>
          )}
          {listEvents.map((ev) => {
            const evDate = new Date(ev.date + 'T00:00:00');
            return (
              <div key={ev.id} className="flex items-start gap-4 px-4 py-3">
                {/* Date column */}
                <div className="w-24 shrink-0 text-xs text-slate-400 pt-0.5">
                  {evDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <ImportanceDot level={ev.importance} />
                    <EventBadge type={ev.type} />
                    <span className="font-medium text-white text-sm truncate">{ev.title}</span>
                  </div>
                  {ev.type === 'earnings' && (
                    <p className="text-xs text-slate-400">
                      {ev.meta.ticker} &middot; {ev.meta.timing} &middot; Est. {ev.meta.eps}
                    </p>
                  )}
                  {ev.type === 'economic' && (
                    <p className="text-xs text-slate-400">
                      Prev {ev.meta.previous} &middot; Fcst {ev.meta.forecast}
                    </p>
                  )}
                  {ev.type === 'ipo' && (
                    <p className="text-xs text-slate-400">Range {ev.meta.range}</p>
                  )}
                  {ev.type === 'dividend' && (
                    <p className="text-xs text-slate-400">
                      {ev.meta.ticker} &middot; {ev.meta.amount} &middot; {ev.meta.yield}
                    </p>
                  )}
                  {ev.type === 'fed' && (
                    <p className="text-xs text-slate-400">
                      {ev.meta.meeting} &middot; {ev.meta.expected}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500 pt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> Low
        </span>
      </div>
    </div>
  );
}
