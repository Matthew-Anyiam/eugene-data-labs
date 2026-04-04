import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, AlertTriangle, CheckCircle, Info, Zap, AlertOctagon,
} from 'lucide-react';
import { onToast, type Notification, type NotificationType } from '../../hooks/useNotifications';
import { cn } from '../../lib/utils';

const ICON_MAP: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertOctagon,
  signal: Zap,
};

const COLOR_MAP: Record<NotificationType, string> = {
  info: 'border-blue-500 bg-blue-50 dark:bg-blue-950/40',
  success: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
  warning: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40',
  error: 'border-red-500 bg-red-50 dark:bg-red-950/40',
  signal: 'border-violet-500 bg-violet-50 dark:bg-violet-950/40',
};

const ICON_COLOR_MAP: Record<NotificationType, string> = {
  info: 'text-blue-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
  signal: 'text-violet-500',
};

interface Toast extends Notification {
  exiting: boolean;
}

const DEFAULT_TTL = 5000;

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    return onToast((notification) => {
      const toast: Toast = { ...notification, exiting: false };
      setToasts((prev) => [...prev, toast].slice(-5)); // Max 5 visible

      const ttl = notification.ttl ?? DEFAULT_TTL;
      if (ttl > 0) {
        setTimeout(() => {
          setToasts((prev) =>
            prev.map((t) => t.id === toast.id ? { ...t, exiting: true } : t)
          );
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
          }, 300);
        }, ttl);
      }
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => t.id === id ? { ...t, exiting: true } : t)
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" style={{ maxWidth: '380px' }}>
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 shadow-lg transition-all duration-300',
              COLOR_MAP[toast.type],
              toast.exiting
                ? 'translate-x-full opacity-0'
                : 'translate-x-0 opacity-100'
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_COLOR_MAP[toast.type])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {toast.title}
              </p>
              {toast.message && (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {toast.message}
                </p>
              )}
              {toast.action && (
                <button
                  onClick={() => {
                    navigate(toast.action!.path);
                    dismissToast(toast.id);
                  }}
                  className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {toast.action.label} &rarr;
                </button>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
