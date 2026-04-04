/**
 * Platform detection for Eugene Intelligence.
 * Detects whether running in Tauri desktop, PWA, or web browser.
 */

export type Platform = 'desktop' | 'pwa' | 'web';

export function getPlatform(): Platform {
  // Tauri injects __TAURI_INTERNALS__ into the window
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return 'desktop';
  }

  // PWA detection: standalone display mode
  if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
    return 'pwa';
  }

  // iOS PWA
  if (typeof navigator !== 'undefined' && (navigator as any).standalone === true) {
    return 'pwa';
  }

  return 'web';
}

export function isDesktop(): boolean {
  return getPlatform() === 'desktop';
}

export function isPWA(): boolean {
  return getPlatform() === 'pwa';
}

export function isWeb(): boolean {
  return getPlatform() === 'web';
}

/**
 * Get the API base URL based on platform.
 * Desktop app needs absolute URL to backend; web uses relative proxy.
 */
export function getApiBaseUrl(): string {
  if (isDesktop()) {
    return import.meta.env.VITE_API_URL || 'http://localhost:8000';
  }
  return import.meta.env.VITE_API_URL || '';
}
