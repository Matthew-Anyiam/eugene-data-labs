import { useState } from 'react';
import {
  useNewsFeed,
  useNewsSentiment,
  useNewsBrief,
  useSanctionsScreen,
  useRegulatoryChanges,
} from '../hooks/useWorld';
import { useActiveDisasters, useActiveConflicts } from '../hooks/useDisasters';
import { usePortStatus, useRouteRisk } from '../hooks/useSupplyChain';
import { useAirportStatus, useAirspaceStatus } from '../hooks/useFlights';
import type { NewsArticle, RegulatoryChange } from '../hooks/useWorld';
import type { Disaster } from '../hooks/useDisasters';
import type { Port, Chokepoint } from '../hooks/useSupplyChain';
import type { Airport } from '../hooks/useFlights';
import {
  Globe, Newspaper, Shield, Search, TrendingUp, TrendingDown,
  Minus, CheckCircle, XCircle, Loader2, ExternalLink,
  Clock, FileText, Zap, BarChart3, AlertTriangle, Swords,
  Anchor, Plane,
} from 'lucide-react';

const NEWS_TOPICS = [
  { key: 'geopolitics', label: 'Geopolitics' },
  { key: 'trade', label: 'Trade' },
  { key: 'energy', label: 'Energy' },
  { key: 'tech', label: 'Technology' },
  { key: 'finance', label: 'Finance' },
  { key: 'climate', label: 'Climate' },
];

const SENTIMENT_COLORS: Record<string, string> = {
  very_positive: 'text-green-500',
  positive: 'text-green-500',
  neutral: 'text-slate-400',
  negative: 'text-red-500',
  very_negative: 'text-red-500',
};

const RISK_COLORS: Record<string, string> = {
  clear: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  critical: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200',
};

export function WorldPage() {
  const [activeTab, setActiveTab] = useState<'news' | 'sanctions' | 'regulatory' | 'disasters' | 'conflict' | 'supply_chain' | 'flights'>('news');
  const [newsTopic, setNewsTopic] = useState<string | undefined>();
  const [newsQuery, setNewsQuery] = useState('');
  const [activeNewsQuery, setActiveNewsQuery] = useState('');
  const [sanctionsName, setSanctionsName] = useState('');
  const [activeSanctionsName, setActiveSanctionsName] = useState('');
  const [timespan, setTimespan] = useState('24h');

  const newsFeed = useNewsFeed(activeNewsQuery || undefined, newsTopic, timespan);
  const sentiment = useNewsSentiment(activeNewsQuery || newsTopic || 'world events', '30d');
  const brief = useNewsBrief(activeNewsQuery || undefined, newsTopic, !!(activeNewsQuery || newsTopic));
  const screening = useSanctionsScreen(activeSanctionsName);
  const regulatory = useRegulatoryChanges(7);
  const disasters = useActiveDisasters(7);
  const conflicts = useActiveConflicts();
  const ports = usePortStatus();
  const routes = useRouteRisk();
  const airports = useAirportStatus();
  const airspace = useAirspaceStatus();

  const handleNewsSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveNewsQuery(newsQuery);
    setNewsTopic(undefined);
  };

  const handleSanctionsSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSanctionsName(sanctionsName);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Globe className="h-7 w-7 text-emerald-500" />
          World Intelligence
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Real-time geopolitical signals across news, sanctions, disasters, conflict, supply chains, and flights
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {[
          { key: 'news', label: 'News & Signals', icon: Newspaper },
          { key: 'disasters', label: 'Disasters', icon: AlertTriangle },
          { key: 'conflict', label: 'Conflict', icon: Swords },
          { key: 'supply_chain', label: 'Supply Chain', icon: Anchor },
          { key: 'flights', label: 'Flights', icon: Plane },
          { key: 'sanctions', label: 'Sanctions', icon: Shield },
          { key: 'regulatory', label: 'Regulatory', icon: FileText },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* News Tab */}
      {activeTab === 'news' && (
        <div className="space-y-6">
          {/* Search + topic filters */}
          <div className="space-y-3">
            <form onSubmit={handleNewsSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={newsQuery}
                  onChange={(e) => setNewsQuery(e.target.value)}
                  placeholder="Search news by topic, entity, or keyword..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <select
                value={timespan}
                onChange={(e) => setTimespan(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
              </select>
              <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {NEWS_TOPICS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setNewsTopic(t.key); setActiveNewsQuery(''); }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    newsTopic === t.key
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment + Brief cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Sentiment card */}
            {sentiment.data && (
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                  <BarChart3 className="h-4 w-4" />
                  Sentiment Analysis
                </h3>
                <div className="flex items-center gap-3">
                  {sentiment.data.sentiment.avg_tone > 0 ? (
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  ) : sentiment.data.sentiment.avg_tone < 0 ? (
                    <TrendingDown className="h-8 w-8 text-red-500" />
                  ) : (
                    <Minus className="h-8 w-8 text-slate-400" />
                  )}
                  <div>
                    <p className={`text-lg font-bold capitalize ${SENTIMENT_COLORS[sentiment.data.sentiment.label] || ''}`}>
                      {sentiment.data.sentiment.label.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-400">
                      Tone: {sentiment.data.sentiment.avg_tone} · Trend: {sentiment.data.sentiment.shift_label}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Brief card */}
            {brief.data && (
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                  <Zap className="h-4 w-4" />
                  Intelligence Brief
                </h3>
                {brief.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating brief...
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {brief.data.brief}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Articles */}
          {newsFeed.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          )}

          {newsFeed.data && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">{newsFeed.data.count} articles</p>
              {newsFeed.data.articles.map((article, i) => (
                <ArticleCard key={i} article={article} />
              ))}
            </div>
          )}

          {!newsFeed.isLoading && !newsFeed.data?.articles?.length && !activeNewsQuery && !newsTopic && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
              <Newspaper className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <h3 className="mb-2 text-lg font-semibold">World News Feed</h3>
              <p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
                Search for any topic or select a category to see real-time global news
                with sentiment analysis powered by GDELT.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sanctions Tab */}
      {activeTab === 'sanctions' && (
        <div className="space-y-6">
          <form onSubmit={handleSanctionsSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={sanctionsName}
                onChange={(e) => setSanctionsName(e.target.value)}
                placeholder="Screen entity name against OFAC + UN sanctions lists..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
              Screen
            </button>
          </form>

          {screening.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          )}

          {screening.data && (
            <div className="space-y-4">
              {/* Result header */}
              <div className={`flex items-center gap-3 rounded-lg p-4 ${
                screening.data.is_sanctioned
                  ? 'border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
                  : 'border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30'
              }`}>
                {screening.data.is_sanctioned ? (
                  <XCircle className="h-6 w-6 text-red-500" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
                <div>
                  <p className="font-semibold">
                    {screening.data.is_sanctioned ? 'Potential Match Found' : 'No Matches Found'}
                  </p>
                  <p className="text-sm text-slate-500">
                    Screened "{screening.data.screened_name}" against {screening.data.lists_checked.join(', ').toUpperCase()} lists
                  </p>
                </div>
                <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${RISK_COLORS[screening.data.risk_level] || ''}`}>
                  {screening.data.risk_level}
                </span>
              </div>

              {/* Matches */}
              {screening.data.matches.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-500">{screening.data.match_count} match{screening.data.match_count !== 1 ? 'es' : ''}</p>
                  {screening.data.matches.map((match, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{match.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{(match.match_score * 100).toFixed(0)}% match</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{match.match_type}</span>
                        </div>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-slate-500">
                        <span>{match.authority}</span>
                        <span>Type: {match.entity_type}</span>
                        {match.program && <span>Program: {match.program}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!screening.isLoading && !activeSanctionsName && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
              <Shield className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <h3 className="mb-2 text-lg font-semibold">Sanctions Screening</h3>
              <p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
                Screen any entity name against OFAC SDN and UN Security Council sanctions lists.
                Fuzzy matching detects aliases and name variations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Regulatory Tab */}
      {activeTab === 'regulatory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-500">Recent Sanctions & Regulatory Actions</h3>
            <span className="text-xs text-slate-400">Source: Federal Register</span>
          </div>

          {regulatory.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          )}

          {regulatory.data?.changes.map((change, i) => (
            <RegulatoryCard key={i} change={change} />
          ))}

          {regulatory.data && regulatory.data.changes.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No recent regulatory changes found</p>
          )}
        </div>
      )}

      {/* Disasters Tab */}
      {activeTab === 'disasters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-500">Active Disasters (Last 7 Days)</h3>
            <span className="text-xs text-slate-400">Sources: USGS + GDACS</span>
          </div>

          {/* Signal summary banner */}
          {disasters.data?.signals && disasters.data.signals.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Active signals</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {disasters.data.signals.map((s: string) => (
                  <span key={s} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {disasters.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          )}

          {disasters.data && disasters.data.disasters.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No significant disasters in the last 7 days</p>
          )}

          {disasters.data?.disasters.map((d: Disaster) => {
            const tierColors = {
              critical: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
              high: 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20',
              moderate: 'border-l-yellow-500',
              low: 'border-l-slate-300 dark:border-l-slate-600',
            };
            const tierClass = d.severity_tier ? tierColors[d.severity_tier] || '' : '';
            const alertColors: Record<string, string> = {
              red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
              orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
              yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
              green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
            };
            const dotColors: Record<string, string> = {
              red: 'bg-red-500', orange: 'bg-orange-500', yellow: 'bg-yellow-500', green: 'bg-green-500',
            };

            return (
              <div key={d.id} className={`rounded-lg border border-l-4 border-slate-200 p-4 dark:border-slate-700 ${tierClass}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${dotColors[d.alert_level] || 'bg-green-500'}`} />
                      <p className="font-medium">{d.name}</p>
                      {d.severity_tier && d.severity_tier !== 'low' && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          d.severity_tier === 'critical' ? 'bg-red-600 text-white' :
                          d.severity_tier === 'high' ? 'bg-orange-500 text-white' :
                          'bg-yellow-400 text-yellow-900'
                        }`}>
                          {d.severity_tier}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="capitalize">{d.type.replace('_', ' ')}</span>
                      {d.severity != null && <span>M{typeof d.severity === 'number' ? d.severity.toFixed(1) : d.severity}</span>}
                      {d.details?.depth_km != null && <span>{d.details.depth_km.toFixed(0)} km deep</span>}
                      {d.details?.felt != null && d.details.felt > 0 && <span>{d.details.felt} felt reports</span>}
                      {d.date && <span>{d.date.slice(0, 16).replace('T', ' ')} UTC</span>}
                      <span>{d.source.toUpperCase()}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${alertColors[d.alert_level] || alertColors.green}`}>
                    {d.alert_level || 'green'}
                  </span>
                </div>
                {/* Signals */}
                {d.signals && d.signals.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.signals.map((s: string) => (
                      <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
                {d.details?.country && (
                  <p className="mt-2 text-xs text-slate-400">
                    {d.details.country}
                    {d.details.affected_population && ` · ${Number(d.details.affected_population).toLocaleString()} affected`}
                  </p>
                )}
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                    Details <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict Tab */}
      {activeTab === 'conflict' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-500">Active Armed Conflicts</h3>
            <span className="text-xs text-slate-400">Source: UCDP (Uppsala)</span>
          </div>

          {conflicts.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          )}

          {conflicts.data && conflicts.data.conflicts.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No conflict data available</p>
          )}

          {conflicts.data?.conflicts.map((c: any, i: number) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <p className="font-medium">{c.name}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                {c.territory && <span>Territory: {c.territory}</span>}
                {c.region && <span>Region: {c.region}</span>}
                {c.type && <span>Type: {c.type}</span>}
                {c.intensity_level && (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${
                    c.intensity_level === '2' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    Intensity: {c.intensity_level}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supply Chain Tab */}
      {activeTab === 'supply_chain' && (
        <div className="space-y-6">
          {/* Port Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-500">Global Port Status</h3>
              <span className="text-xs text-slate-400">15 major ports monitored</span>
            </div>

            {ports.isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            )}

            {ports.data && (
              <>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-500">{ports.data.operational} operational</span>
                  <span className="text-amber-500">{ports.data.congested} congested</span>
                  <span className="text-red-500">{ports.data.disrupted} disrupted</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ports.data.ports.map((port: Port) => (
                    <div key={port.port_code} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Anchor className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-sm">{port.name}</span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          port.status === 'operational' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                          port.status === 'congested' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        }`}>
                          {port.status}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                        <span>{port.country} · {port.port_code}</span>
                        <span>Risk: {(port.risk_score * 100).toFixed(0)}%</span>
                      </div>
                      {port.risk_factors.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {port.risk_factors.map((f, i) => (
                            <span key={i} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600 dark:bg-red-900/20 dark:text-red-400">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Chokepoint Risk */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-500">Shipping Chokepoint Risk</h3>
              <span className="text-xs text-slate-400">
                {routes.data ? `Avg risk: ${(routes.data.avg_risk * 100).toFixed(0)}%` : ''}
              </span>
            </div>

            {routes.data?.chokepoints.map((cp: Chokepoint) => (
              <div key={cp.name} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{cp.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{cp.trade_share_pct}% of global trade</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    cp.status === 'high_risk' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                    cp.status === 'elevated' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  }`}>
                    {cp.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flights Tab */}
      {activeTab === 'flights' && (
        <div className="space-y-6">
          {/* Airport Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-500">Airport Status</h3>
              <span className="text-xs text-slate-400">Source: OpenSky Network</span>
            </div>

            {airports.isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            )}

            {airports.data && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {airports.data.airports.map((ap: Airport) => (
                  <div key={ap.icao} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4 text-sky-500" />
                        <span className="font-medium text-sm">{ap.name}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        ap.status === 'normal' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                        ap.status === 'busy' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                        ap.status === 'delays_likely' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {ap.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>{ap.city}, {ap.country} · {ap.icao}</span>
                      <span>{ap.traffic_count} aircraft nearby</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Airspace Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-500">Regional Airspace Status</h3>
            {airspace.data?.regions.map((r) => (
              <div key={r.region} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{r.label}</span>
                    <span className="ml-2 text-xs text-slate-400">{r.traffic_count} aircraft tracked</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.density === 'high' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    r.density === 'moderate' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                    r.density === 'low' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {r.density} density
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500">
        News: GDELT · Disasters: USGS + GDACS + NASA FIRMS · Conflict: UCDP · Supply Chain: UN Comtrade + AIS · Flights: OpenSky · Sanctions: OFAC + UN SC · Regulatory: Federal Register
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const toneColor = article.tone > 2 ? 'text-green-500' : article.tone < -2 ? 'text-red-500' : 'text-slate-400';

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{article.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span>{article.source}</span>
          {article.seendate && (
            <>
              <span>·</span>
              <Clock className="h-3 w-3" />
              <span>{article.seendate.slice(0, 10)}</span>
            </>
          )}
          <span>·</span>
          <span className={toneColor}>tone: {article.tone.toFixed(1)}</span>
        </div>
      </div>
      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
    </a>
  );
}

function RegulatoryCard({ change }: { change: RegulatoryChange }) {
  return (
    <a
      href={change.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium leading-snug">{change.title}</p>
          {change.abstract && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{change.abstract}</p>
          )}
        </div>
        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{change.type}</span>
        <span>{change.publication_date}</span>
        {change.agencies.length > 0 && <span>{change.agencies[0]}</span>}
      </div>
    </a>
  );
}
