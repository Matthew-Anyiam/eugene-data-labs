import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface PageErrorBoundaryProps {
  children: ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[PageErrorBoundary]', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="flex items-center justify-center px-4 py-24">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10">
              <AlertTriangle className="h-5 w-5 text-indigo-400" />
            </div>
            <h2 className="mb-1 text-base font-semibold text-slate-200">
              This page encountered an error
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Something went wrong while rendering this page.
            </p>
            {isDev && this.state.error?.message && (
              <pre className="mx-auto mb-4 max-h-28 max-w-lg overflow-auto rounded-lg bg-slate-900 p-3 text-left font-mono text-xs text-red-400 ring-1 ring-slate-800">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
