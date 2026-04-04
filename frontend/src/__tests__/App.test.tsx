import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

// Mock fetch for any components that call APIs on mount
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
));

// Mock matchMedia for useDarkMode hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver for any lazy-loading components
vi.stubGlobal('IntersectionObserver', vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})));

// Mock ResizeObserver for recharts
vi.stubGlobal('ResizeObserver', vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})));

// Mock EventSource for LiveTicker
vi.stubGlobal('EventSource', vi.fn(() => ({
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onopen: null,
  onmessage: null,
  onerror: null,
})));

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    // App should render something — either auth loading spinner or the login page
    expect(container.firstChild).toBeTruthy();
  });

  it('shows auth loading or login when not authenticated', async () => {
    // Clear any stored auth tokens
    localStorage.removeItem('eugene_token');
    localStorage.removeItem('eugene_user');

    const { container } = render(<App />);

    // Should render either the auth loading spinner or the login redirect
    await waitFor(() => {
      // Either we see the loading spinner or the page has rendered content
      const hasContent = container.textContent && container.textContent.length > 0;
      expect(hasContent).toBe(true);
    }, { timeout: 3000 });
  });

  it('renders the Eugene Intelligence brand', async () => {
    render(<App />);

    await waitFor(() => {
      const brandElements = screen.queryAllByText(/eugene intelligence/i);
      expect(brandElements.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  });
});
