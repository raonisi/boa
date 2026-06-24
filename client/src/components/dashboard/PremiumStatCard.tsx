import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingMetric } from "@/components/ui/empty-state";
import type { ElementType } from "react";

export type PremiumStatCardTone =
  | "navy"
  | "gold"
  | "green"
  | "orange"
  | "red"
  | "blue";

export interface PremiumStatCardProps {
  title: string;
  value: number | string | undefined;
  icon: ElementType;
  tone?: PremiumStatCardTone;
  helper?: string;
  suffix?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onClick?: () => void;
}

function formatNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return "0";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

export function PremiumStatCard({
  title,
  value,
  icon: Icon,
  tone = "navy",
  helper,
  suffix = "",
  isLoading = false,
  isError = false,
  onRetry,
  onClick,
}: PremiumStatCardProps) {
  const toneClass = {
    navy: "border border-primary/35 bg-primary/[0.07] text-primary",
    gold: "border border-ring/45 bg-ring/[0.09] text-foreground",
    green:
      "border border-emerald-600/30 bg-emerald-600/[0.08] text-emerald-800 dark:text-emerald-200",
    orange:
      "border border-orange-500/30 bg-orange-500/[0.08] text-orange-800 dark:text-orange-200",
    red: "border border-red-500/30 bg-red-500/[0.08] text-red-800 dark:text-red-200",
    blue: "border border-primary/25 bg-primary/[0.06] text-primary",
  }[tone];

  return (
    <Card
      className={`crm-dashboard-card overflow-hidden ${onClick ? "cursor-pointer transition hover:shadow-md" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {isLoading ? (
                <LoadingMetric className="h-8 w-16" />
              ) : isError ? (
                <span className="text-base font-semibold text-destructive">
                  불러오기 실패
                </span>
              ) : (
                <>
                  {formatNumber(value)}
                  {suffix ? (
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">
                      {suffix}
                    </span>
                  ) : null}
                </>
              )}
            </div>
            {isError ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  0건으로 표시하지 않습니다
                </p>
                {onRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 min-h-8"
                    onClick={onRetry}
                  >
                    다시 시도
                  </Button>
                ) : null}
              </div>
            ) : helper ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {helper}
              </p>
            ) : null}
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg shadow-none ${toneClass}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
