import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Inbox,
  Loader2,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";
import React from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "empty" | "error" | "forbidden" | "loading";
  className?: string;
}

const variantConfig = {
  empty: {
    icon: Inbox,
    iconTone: "bg-muted/70 text-muted-foreground",
    border: "border-dashed border-border/70",
    surface: "bg-muted/20",
  },
  error: {
    icon: AlertCircle,
    iconTone: "bg-destructive/10 text-destructive",
    border: "border-destructive/20",
    surface: "bg-destructive/[0.03]",
  },
  forbidden: {
    icon: LockKeyhole,
    iconTone: "bg-boa-amber/16 text-amber-800 dark:text-amber-200",
    border: "border-boa-amber/25",
    surface: "bg-boa-amber/[0.04]",
  },
  loading: {
    icon: Loader2,
    iconTone: "bg-primary/10 text-primary",
    border: "border-primary/15",
    surface: "bg-primary/[0.03]",
  },
} as const;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  variant = "empty",
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const StateIcon = Icon ?? config.icon;
  const defaultAction =
    actionLabel && onAction ? (
      <Button type="button" onClick={onAction} size="default">
        {actionLabel}
      </Button>
    ) : null;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      aria-busy={variant === "loading" ? true : undefined}
      aria-label={variant === "loading" ? "불러오는 중" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-10 text-center",
        "max-w-full overflow-hidden",
        config.border,
        config.surface,
        className
      )}
    >
      {StateIcon && (
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            config.iconTone
          )}
        >
          <StateIcon
            className={cn("h-6 w-6", variant === "loading" && "animate-spin")}
            aria-hidden="true"
          />
        </div>
      )}
      <div className="space-y-1.5 max-w-sm">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {(action || defaultAction) && (
        <div className="mt-1 flex min-h-11 flex-wrap items-center justify-center gap-2">
          {action ?? defaultAction}
        </div>
      )}
    </div>
  );
}

export function LoadingState({
  title = "불러오는 중…",
  description = "잠시만 기다려 주세요.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <EmptyState
      variant="loading"
      title={title}
      description={description}
      className={className}
    />
  );
}

/** Inline numeric placeholder — avoids showing 0 or "-" while loading. */
export function LoadingMetric({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="불러오는 중"
      className={cn(
        "inline-block animate-pulse rounded-md bg-muted/70 align-middle",
        className
      )}
    />
  );
}

export function renderMetricValue(
  value: number,
  { isLoading, isError }: { isLoading: boolean; isError: boolean }
) {
  if (isLoading) return <LoadingMetric className="h-7 w-12" />;
  if (isError) return "—";
  return value;
}

export function ErrorState({
  title = "정보를 불러오지 못했습니다.",
  description = "잠시 후 다시 시도해 주세요.",
  retryLabel = "다시 시도",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      variant="error"
      title={title}
      description={description}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      className={className}
    />
  );
}

export function ForbiddenInlineState({
  title = "접근 권한이 없습니다.",
  description = "권한 범위 안에서 확인할 수 있는 정보만 표시됩니다. 필요한 경우 관리자에게 문의해 주세요.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      variant="forbidden"
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
