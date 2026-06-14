import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  FileQuestion,
  Inbox,
  Loader2,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";
import React from "react";

export type StateTone = "neutral" | "info" | "warning" | "danger" | "success";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: React.ReactNode;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: "empty" | "error" | "forbidden" | "loading";
  tone?: StateTone;
  compact?: boolean;
  fullPage?: boolean;
  className?: string;
}

const toneConfig: Record<
  StateTone,
  { icon: LucideIcon; iconTone: string; border: string; surface: string }
> = {
  neutral: {
    icon: Inbox,
    iconTone: "bg-muted/70 text-muted-foreground",
    border: "border-dashed border-border/70",
    surface: "bg-muted/20",
  },
  info: {
    icon: Loader2,
    iconTone: "bg-primary/10 text-primary",
    border: "border-primary/15",
    surface: "bg-primary/[0.03]",
  },
  warning: {
    icon: LockKeyhole,
    iconTone: "bg-boa-amber/16 text-amber-800 dark:text-amber-200",
    border: "border-boa-amber/25",
    surface: "bg-boa-amber/[0.04]",
  },
  danger: {
    icon: AlertCircle,
    iconTone: "bg-destructive/10 text-destructive",
    border: "border-destructive/20",
    surface: "bg-destructive/[0.03]",
  },
  success: {
    icon: Inbox,
    iconTone: "bg-boa-green/12 text-boa-green",
    border: "border-boa-green/20",
    surface: "bg-boa-green/[0.04]",
  },
};

const variantToneMap: Record<
  NonNullable<EmptyStateProps["variant"]>,
  StateTone
> = {
  empty: "neutral",
  error: "danger",
  forbidden: "warning",
  loading: "info",
};

function resolveTone(
  variant: NonNullable<EmptyStateProps["variant"]>,
  tone?: StateTone
): StateTone {
  return tone ?? variantToneMap[variant];
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  secondaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = "empty",
  tone,
  compact = false,
  fullPage = false,
  className,
}: EmptyStateProps) {
  const resolvedTone = resolveTone(variant, tone);
  const config = toneConfig[resolvedTone];
  const StateIcon = Icon ?? config.icon;
  const defaultAction =
    actionLabel && onAction ? (
      <Button type="button" onClick={onAction} size={compact ? "sm" : "default"}>
        {actionLabel}
      </Button>
    ) : null;
  const defaultSecondaryAction =
    secondaryActionLabel && onSecondaryAction ? (
      <Button
        type="button"
        variant="outline"
        onClick={onSecondaryAction}
        size={compact ? "sm" : "default"}
      >
        {secondaryActionLabel}
      </Button>
    ) : null;

  const content = (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      aria-busy={variant === "loading" ? true : undefined}
      aria-label={variant === "loading" ? "불러오는 중" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border text-center",
        "max-w-full overflow-hidden",
        compact ? "px-4 py-6" : "px-6 py-10",
        config.border,
        config.surface,
        className
      )}
    >
      {StateIcon && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full",
            compact ? "h-10 w-10" : "h-12 w-12",
            config.iconTone
          )}
        >
          <StateIcon
            className={cn(
              compact ? "h-5 w-5" : "h-6 w-6",
              variant === "loading" && "animate-spin"
            )}
            aria-hidden="true"
          />
        </div>
      )}
      <div className={cn("space-y-1.5", compact ? "max-w-xs" : "max-w-sm")}>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(action || defaultAction || secondaryAction || defaultSecondaryAction) && (
        <div className="mt-1 flex min-h-11 flex-wrap items-center justify-center gap-2">
          {action ?? defaultAction}
          {secondaryAction ?? defaultSecondaryAction}
        </div>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">{content}</div>
      </div>
    );
  }

  return content;
}

/** Card-framed state panel for admin/ops surfaces. */
export function BoaStateCard({
  className,
  ...props
}: EmptyStateProps & { className?: string }) {
  return (
    <EmptyState
      {...props}
      className={cn("border-solid bg-card shadow-sm", className)}
    />
  );
}

export function LoadingState({
  title = "정보를 불러오고 있습니다.",
  description = "잠시만 기다려 주세요.",
  className,
  compact,
  fullPage,
}: {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
  fullPage?: boolean;
}) {
  return (
    <EmptyState
      variant="loading"
      title={title}
      description={description}
      className={className}
      compact={compact}
      fullPage={fullPage}
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
  compact,
  fullPage,
}: {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
  fullPage?: boolean;
}) {
  return (
    <EmptyState
      variant="error"
      title={title}
      description={description}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      className={className}
      compact={compact}
      fullPage={fullPage}
    />
  );
}

export function ForbiddenInlineState({
  title = "권한이 필요한 화면입니다.",
  description = "접근 권한을 확인해 주세요. 필요한 경우 관리자에게 문의해 주세요.",
  action,
  className,
  compact,
  fullPage,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  fullPage?: boolean;
}) {
  return (
    <EmptyState
      variant="forbidden"
      title={title}
      description={description}
      action={action}
      className={className}
      compact={compact}
      fullPage={fullPage}
    />
  );
}

export function NotFoundState({
  title = "요청한 화면을 찾을 수 없습니다.",
  description = "이전 화면으로 돌아가 주세요.",
  actionLabel = "이전 화면",
  onAction,
  className,
  fullPage = true,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  fullPage?: boolean;
}) {
  return (
    <EmptyState
      icon={FileQuestion}
      tone="neutral"
      title={title}
      description={description}
      actionLabel={onAction ? actionLabel : undefined}
      onAction={onAction}
      fullPage={fullPage}
      className={className}
    />
  );
}

/** Stable aliases for the BOA state design system. */
export const BoaEmptyState = EmptyState;
export const BoaLoadingState = LoadingState;
export const BoaErrorState = ErrorState;
export const BoaForbiddenState = ForbiddenInlineState;
export const BoaInlineState = EmptyState;
