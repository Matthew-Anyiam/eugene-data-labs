import { useState, useCallback, useEffect } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'signal';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  action?: { label: string; path: string };
  ttl?: number; // auto-dismiss after ms
}

const STORAGE_KEY = 'eugene_notifications';
const MAX_NOTIFICATIONS = 50;

let nextId = 1;

function loadNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // storage full or unavailable
  }
}

// Cross-component sync
const listeners = new Set<() => void>();
function emitChange() {
  listeners.forEach((fn) => fn());
}

// Global toast queue for ephemeral toasts
type ToastCallback = (n: Notification) => void;
const toastListeners = new Set<ToastCallback>();

export function onToast(cb: ToastCallback) {
  toastListeners.add(cb);
  return () => { toastListeners.delete(cb); };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);

  useEffect(() => {
    const handler = () => setNotifications(loadNotifications());
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const push = useCallback((
    type: NotificationType,
    title: string,
    message?: string,
    action?: { label: string; path: string },
    ttl?: number,
  ) => {
    const notification: Notification = {
      id: `n-${Date.now()}-${nextId++}`,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      action,
      ttl,
    };

    setNotifications((prev) => {
      const next = [notification, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(next);
      emitChange();
      return next;
    });

    // Fire toast
    toastListeners.forEach((cb) => cb(notification));

    return notification.id;
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => n.id === id ? { ...n, read: true } : n);
      saveNotifications(next);
      emitChange();
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(next);
      emitChange();
      return next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveNotifications(next);
      emitChange();
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
    emitChange();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    push,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
  };
}
