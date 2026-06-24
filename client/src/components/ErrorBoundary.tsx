import { cn } from "@/lib/utils";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import React from "react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export function ErrorFallback({ error: _error }: { error?: Error | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-lg flex-col items-center rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle size={28} aria-hidden="true" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground">
          문제가 발생했습니다.
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          잠시 후 다시 시도해 주세요. 문제가 반복되면 관리자에게 문의해 주세요.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold",
              "bg-primary text-primary-foreground shadow-sm transition-colors hover:opacity-90"
            )}
          >
            <RotateCcw size={16} aria-hidden="true" />
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold",
              "border-border bg-background text-foreground transition-colors hover:bg-muted/70"
            )}
          >
            <Home size={16} aria-hidden="true" />
            홈으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<Props, State> {
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

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
