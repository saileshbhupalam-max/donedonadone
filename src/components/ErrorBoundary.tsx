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

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
          <h1 className="text-4xl tracking-tight">
            <span className="font-serif">Dana</span>
            <span className="font-sans font-light">Done</span>
          </h1>
          <div className="text-center space-y-2 max-w-sm">
            <p className="text-lg font-medium text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{ERROR_STATES.generic}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={this.handleReset}>Try Again</Button>
            <Button variant="outline" onClick={() => { window.location.href = "/home"; }}>
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
