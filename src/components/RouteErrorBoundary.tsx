import React from "react";
import { Button } from "@/components/ui/button";
import { ERROR_STATES } from "@/lib/personality";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Route-level error boundary that catches rendering errors in individual pages.
 * Unlike the top-level ErrorBoundary in main.tsx, this one wraps each route
 * so a single page failure doesn't blank the entire app.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/home";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
          <div className="text-center space-y-2 max-w-sm">
            <p className="text-lg font-medium text-foreground">
              Something went wrong
            </p>
            <p className="text-sm text-muted-foreground">
              {ERROR_STATES.generic}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={this.handleRetry}>Try Again</Button>
            <Button variant="outline" onClick={this.handleGoHome}>
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
