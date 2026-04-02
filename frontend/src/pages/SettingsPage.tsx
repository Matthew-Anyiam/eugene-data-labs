import { useState, useEffect } from 'react';
import {
  Settings, Key, Bell, Palette, Database, Shield,
  RefreshCw, CheckCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useWatchlist } from '../hooks/useWatchlist';
import { useNotifications } from '../hooks/useNotifications';
import { eugeneApi } from '../lib/api';

const SETTING_TABS = ['General', 'API', 'Notifications', 'Data'] as const;
type SettingTab = typeof SETTING_TABS[number];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingTab>('General');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-7 w-7 text-slate-500" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure your Eugene workspace
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {SETTING_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General' && <GeneralSettings />}
      {tab === 'API' && <APISettings />}
      {tab === 'Notifications' && <NotificationSettings />}
      {tab === 'Data' && <DataSettings />}
    </div>
  );
}

function GeneralSettings() {
  const { dark, toggle } = useDarkMode();
  const { tickers, removeTicker } = useWatchlist();
  const [sidebarDefault, setSidebarDefault] = useState(() => {
    try { return localStorage.getItem('eugene_sidebar') || 'expanded'; }
    catch { return 'expanded'; }
  });

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <SettingSection title="Appearance" icon={Palette}>
        <SettingRow
          label="Theme"
          description="Switch between light and dark mode"
        >
          <button
            onClick={toggle}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {dark ? 'Dark' : 'Light'}
          </button>
        </SettingRow>
        <SettingRow
          label="Sidebar default"
          description="Sidebar state on page load"
        >
          <select
            value={sidebarDefault}
            onChange={(e) => {
              setSidebarDefault(e.target.value);
              localStorage.setItem('eugene_sidebar', e.target.value);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="expanded">Expanded</option>
            <option value="collapsed">Collapsed</option>
          </select>
        </SettingRow>
      </SettingSection>

      {/* Watchlist */}
      <SettingSection title="Watchlist" icon={Shield}>
        <div className="space-y-1">
          {tickers.length === 0 ? (
            <p className="text-sm text-slate-400">No tickers in watchlist</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tickers.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm dark:border-slate-700"
                >
                  <span className="font-mono font-medium">{t}</span>
                  <button
                    onClick={() => removeTicker(t)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </SettingSection>
    </div>
  );
}

function APISettings() {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('eugene_api_key') || ''; }
    catch { return ''; }
  });
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<{ status: string; version?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const saveKey = () => {
    localStorage.setItem('eugene_api_key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const checkHealth = async () => {
    setChecking(true);
    try {
      const data = await eugeneApi<{ status: string; version?: string }>('/v1/health');
      setHealth(data);
    } catch {
      setHealth({ status: 'error' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { checkHealth(); }, []);

  return (
    <div className="space-y-6">
      <SettingSection title="API Configuration" icon={Key}>
        <SettingRow
          label="API Key"
          description="Your Eugene API key for authenticated endpoints"
        >
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="eug_..."
              className="w-64 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              onClick={saveKey}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </SettingRow>
        <SettingRow
          label="API Status"
          description="Check connectivity to Eugene backend"
        >
          <div className="flex items-center gap-2">
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : health ? (
              <div className="flex items-center gap-2">
                {health.status === 'ok' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {health.status === 'ok' ? 'Connected' : 'Unreachable'}
                  {health.version && ` (v${health.version})`}
                </span>
              </div>
            ) : null}
            <button
              onClick={checkHealth}
              disabled={checking}
              className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </SettingRow>
        <SettingRow
          label="Base URL"
          description="API server endpoint"
        >
          <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {import.meta.env.VITE_API_URL || window.location.origin}
          </span>
        </SettingRow>
      </SettingSection>
    </div>
  );
}

function NotificationSettings() {
  const { notifications, unreadCount, clearAll, markAllRead } = useNotifications();
  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    try { return localStorage.getItem('eugene_alerts') !== 'disabled'; }
    catch { return true; }
  });
  const [signalThreshold, setSignalThreshold] = useState(() => {
    try { return localStorage.getItem('eugene_signal_threshold') || '0.5'; }
    catch { return '0.5'; }
  });

  return (
    <div className="space-y-6">
      <SettingSection title="Notification Preferences" icon={Bell}>
        <SettingRow
          label="In-app alerts"
          description="Show toast notifications for convergence alerts"
        >
          <button
            onClick={() => {
              const next = !alertsEnabled;
              setAlertsEnabled(next);
              localStorage.setItem('eugene_alerts', next ? 'enabled' : 'disabled');
            }}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              alertsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                alertsEnabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </SettingRow>
        <SettingRow
          label="Signal threshold"
          description="Minimum magnitude to trigger a notification"
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={signalThreshold}
              onChange={(e) => {
                setSignalThreshold(e.target.value);
                localStorage.setItem('eugene_signal_threshold', e.target.value);
              }}
              className="w-32"
            />
            <span className="w-8 text-right font-mono text-sm text-slate-600 dark:text-slate-400">
              {parseFloat(signalThreshold).toFixed(1)}
            </span>
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Notification History" icon={Bell}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {notifications.length} total, {unreadCount} unread
          </span>
          <div className="flex gap-2">
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Mark all read
            </button>
            <button
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Clear all
            </button>
          </div>
        </div>
        {notifications.length > 0 && (
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
            {notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                  n.read ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue-500'}`} />
                <span className="flex-1 truncate">{n.title}</span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {new Date(n.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </SettingSection>
    </div>
  );
}

function DataSettings() {
  const [cacheSize, setCacheSize] = useState<string>('...');

  useEffect(() => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('eugene_')) {
          total += (localStorage.getItem(key) || '').length;
        }
      }
      setCacheSize(`${(total / 1024).toFixed(1)} KB`);
    } catch {
      setCacheSize('unknown');
    }
  }, []);

  const clearCache = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('eugene_') && key !== 'eugene_watchlist' && key !== 'eugene_api_key') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    setCacheSize('0.0 KB');
  };

  return (
    <div className="space-y-6">
      <SettingSection title="Local Storage" icon={Database}>
        <SettingRow
          label="Cache size"
          description="Data cached locally in your browser (excludes watchlist and API key)"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{cacheSize}</span>
            <button
              onClick={clearCache}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Clear cache
            </button>
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Keyboard Shortcuts" icon={Settings}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Command Palette', '\u2318K'],
            ['Activity Panel', '\u2318.'],
            ['Toggle Sidebar', 'Click logo'],
            ['Toggle Dark Mode', 'Settings or palette'],
          ].map(([label, shortcut]) => (
            <div key={label} className="flex items-center justify-between rounded px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                {shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </SettingSection>
    </div>
  );
}

// Shared setting layout components
function SettingSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
        <Icon className="h-4 w-4 text-slate-500" />
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  );
}
