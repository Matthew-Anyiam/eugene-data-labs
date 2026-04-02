import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts for power-user navigation.
 *
 * g then d = go to dashboard
 * g then w = go to world
 * g then s = go to screener
 * g then e = go to economics
 * g then o = go to ontology
 * g then p = go to predictions
 * g then . = go to settings
 * ? = show shortcuts help (not yet — could be future)
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger with modifier keys (except for Cmd+K and Cmd+. which are handled elsewhere)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'g' && !gPressed) {
        gPressed = true;
        // Reset after 1 second
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => { gPressed = false; }, 1000);
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimeout);

        const routes: Record<string, string> = {
          d: '/dashboard',
          w: '/world',
          s: '/screener',
          e: '/economics',
          o: '/ontology',
          p: '/predictions',
          '.': '/settings',
        };

        const route = routes[e.key];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      }

      // Single-key shortcuts
      if (e.key === '/') {
        // Focus search — trigger command palette
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(gTimeout);
    };
  }, [navigate]);
}
