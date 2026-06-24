import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
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
        title="상담 도구를 불러오고 있습니다."
        description="잠시만 기다려 주세요."
        className="border-dashed bg-muted/20"
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="상담 도구를 불러오지 못했습니다."
        description="잠시 후 다시 시도해 주세요."
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
