import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export function ErrorFallback({
  error,
  onReset,
}: {
  error?: Error | null;
  onReset?: () => void;
}) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
          <AlertTriangle className="h-6 w-6 text-indigo-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-white">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          An unexpected error occurred. Please try again or return to the dashboard.
        </p>
        {isDev && error?.message && (
          <pre className="mb-6 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-left font-mono text-xs text-red-400 ring-1 ring-slate-800">
            {error.message}
            {error.stack && (
              <>
                {'\n\n'}
                {error.stack}
              </>
            )}
          </pre>
        )}
        <div className="flex items-center justify-center gap-3">
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </button>
          )}
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800"
          >
            <Home className="h-3.5 w-3.5" />
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }
    return this.props.children;
  }
}
