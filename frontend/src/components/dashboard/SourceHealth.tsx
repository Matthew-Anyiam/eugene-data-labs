import { useEffect, useState } from 'react';
import {
  Activity, CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { eugeneApi } from '../../lib/api';
import { cn } from '../../lib/utils';

interface SourceStatus {
  name: string;
  category: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  success_count: number;
  error_count: number;
  avg_latency_ms: number;
  last_success?: string;
  last_error?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  healthy: { icon: CheckCircle, color: 'text-emerald-500', label: 'Healthy' },
  degraded: { icon: AlertTriangle, color: 'text-amber-500', label: 'Degraded' },
  down: { icon: XCircle, color: 'text-red-500', label: 'Down' },
  unknown: { icon: Activity, color: 'text-slate-400', label: 'Unknown' },
};

export function SourceHealth() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<'ok' | 'error' | 'checking'>('checking');

  const fetchHealth = async () => {
    setApiStatus('checking');
    try {
      // Check API health
      const health = await eugeneApi<{ status: string }>('/v1/health');
      setApiStatus(health?.status === 'ok' ? 'ok' : 'error');
    } catch {
      setApiStatus('error');
    }

    try {
      const data = await eugeneApi<{ sources?: SourceStatus[] }>('/v1/world/health');
      if (data?.sources) {
        setSources(data.sources);
      }
    } catch {
      // Source health endpoint may not exist — that's fine
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60 * 1000); // Every minute
    return () => clearInterval(interval);
  }, []);

  // Default sources if API doesn't return them
  const displaySources: SourceStatus[] = sources.length > 0 ? sources : [
    { name: 'SEC EDGAR', category: 'financial', status: 'unknown', success_count: 0, error_count: 0, avg_latency_ms: 0 },
    { name: 'FRED', category: 'economic', status: 'unknown', success_count: 0, error_count: 0, avg_latency_ms: 0 },
    { name: 'USGS', category: 'disaster', status: 'unknown', success_count: 0, error_count: 0, avg_latency_ms: 0 },
    { name: 'GDELT', category: 'news', status: 'unknown', success_count: 0, error_count: 0, avg_latency_ms: 0 },
    { name: 'Yahoo Finance', category: 'market', status: 'unknown', success_count: 0, error_count: 0, avg_latency_ms: 0 },
  ];

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Activity className="h-4 w-4 text-emerald-500" />
          Source Health
        </h3>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="p-3">
        {/* API Status */}
        <div className="mb-3 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Eugene API</span>
          <div className="flex items-center gap-1.5">
            {apiStatus === 'checking' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            ) : apiStatus === 'ok' ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className="text-[11px] font-medium text-slate-500">
              {apiStatus === 'checking' ? 'Checking...' : apiStatus === 'ok' ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Source list */}
        <div className="space-y-1">
          {displaySources.map((source) => {
            const config = STATUS_CONFIG[source.status] || STATUS_CONFIG.unknown;
            const StatusIcon = config.icon;
            const errorRate = source.success_count + source.error_count > 0
              ? (source.error_count / (source.success_count + source.error_count) * 100).toFixed(0)
              : '—';

            return (
              <div
                key={source.name}
                className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/30"
              >
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn('h-3.5 w-3.5', config.color)} />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {source.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  {source.avg_latency_ms > 0 && (
                    <span className="font-mono">{source.avg_latency_ms.toFixed(0)}ms</span>
                  )}
                  {errorRate !== '—' && (
                    <span className={cn('font-mono', parseInt(errorRate) > 20 ? 'text-red-400' : '')}>
                      {errorRate}% err
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
