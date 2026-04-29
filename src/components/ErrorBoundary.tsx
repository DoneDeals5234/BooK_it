import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">⚠️ App Error</h1>
            <p className="text-muted-foreground mb-4">The app encountered an error. Please refresh the page.</p>
            <details className="mb-4 text-left bg-muted p-3 rounded text-xs overflow-auto max-h-48">
              <summary className="cursor-pointer font-semibold mb-2">Error Details</summary>
              <pre className="whitespace-pre-wrap break-words">{this.state.error?.message || 'Unknown error'}</pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
