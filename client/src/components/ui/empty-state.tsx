import { cn } from "@/lib/utils";
import { AlertCircle, Inbox, Loader2, LockKeyhole, type LucideIcon } from "lucide-react";
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
  const StateIcon = Icon ?? {
    empty: Inbox,
    error: AlertCircle,
    forbidden: LockKeyhole,
    loading: Loader2,
  }[variant];
  const tone = {
    empty: "bg-muted/60 text-muted-foreground/70",
    error: "bg-destructive/10 text-destructive",
    forbidden: "bg-amber-500/10 text-amber-700",
    loading: "bg-primary/10 text-primary",
  }[variant];
  const defaultAction = actionLabel && onAction ? (
    <button
      type="button"
      onClick={onAction}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90"
    >
      {actionLabel}
    </button>
  ) : null;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-5 py-9 text-center",
        "max-w-full overflow-hidden",
        className
      )}
    >
      {StateIcon && (
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", tone)}>
          <StateIcon className={cn("h-6 w-6", variant === "loading" && "animate-spin")} />
        </div>
      )}
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {(action || defaultAction) && (
        <div className="mt-2 flex min-h-11 flex-wrap items-center justify-center gap-2">
          {action ?? defaultAction}
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title = "데이터를 불러오지 못했습니다.",
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
  description = "이 화면은 현재 권한으로 사용할 수 없습니다. 필요한 경우 관리자에게 문의해 주세요.",
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
