import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import { getLoadErrorCopy, getLoadingCopy } from "@/lib/stateUxCopy";
import type { ReactNode } from "react";

type ConsultationToolsListStateProps = {
  isLoading: boolean;
  isError: boolean;
  hasLoaded: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  children: ReactNode;
};

export function ConsultationToolsListState({
  isLoading,
  isError,
  hasLoaded,
  isEmpty,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: ConsultationToolsListStateProps) {
  if (!hasLoaded && isLoading) {
    return (
      <LoadingState
        {...getLoadingCopy("상담 도구")}
        className="border-dashed bg-muted/20"
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        {...getLoadErrorCopy("상담 도구")}
        onRetry={onRetry}
        className="border-dashed bg-muted/20"
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className="border-dashed bg-muted/20"
      />
    );
  }

  return <>{children}</>;
}
