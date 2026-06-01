import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackText: string;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[chart-error]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex h-64 w-full items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center"
        >
          <div className="flex flex-col items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            <p>{this.props.fallbackText}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
