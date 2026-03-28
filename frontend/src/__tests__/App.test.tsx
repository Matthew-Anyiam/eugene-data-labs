import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock react-router-dom's BrowserRouter internals are already in App,
// so we just render it directly.

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

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // App should render the main container
    expect(document.querySelector('main')).toBeInTheDocument();
  });

  it('has header with logo', () => {
    render(<App />);
    // The LogoFull component renders "Eugene Intelligence" text
    const logos = screen.getAllByText('Eugene Intelligence');
    // At least one should be in the header
    expect(logos.length).toBeGreaterThanOrEqual(1);
    // Header element should exist
    expect(document.querySelector('header')).toBeInTheDocument();
  });

  it('has footer', () => {
    render(<App />);
    expect(document.querySelector('footer')).toBeInTheDocument();
  });
});
