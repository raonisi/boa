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
  className?: string;
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
  className,
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

  const inlineCurrency = typeof value === "string" && /^[\d,]+원$/.test(value);
  const isCurrency = suffix === "원" || inlineCurrency;
  const formattedValue = inlineCurrency ? value.slice(0, -1) : formatNumber(value);
  const displaySuffix = suffix || (inlineCurrency ? "원" : "");

  return (
    <Card
      className={`crm-dashboard-card overflow-hidden ${onClick ? "cursor-pointer transition hover:shadow-md" : ""} ${className ?? ""}`}
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
      <CardContent className={`p-3.5 sm:p-4 lg:p-5 ${isCurrency ? "@container" : ""}`}>
        <div className={isCurrency ? "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2" : "flex items-start justify-between gap-3"}>
          <div className={isCurrency ? "contents" : "min-w-0"}>
            <p className={`${isCurrency ? "min-w-0 whitespace-normal break-keep" : "truncate"} text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
              {title}
            </p>
            <div data-testid="premium-stat-value" className={`${isCurrency ? "col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1" : "mt-2 whitespace-nowrap"} text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl lg:text-3xl`}>
              {isLoading ? (
                <LoadingMetric className="h-8 w-16" />
              ) : isError ? (
                <span className="text-base font-semibold text-destructive">
                  불러오기 실패
                </span>
              ) : (
                <>
                  <span className={isCurrency && formattedValue.length > 9 ? "whitespace-nowrap @max-[190px]:text-xl" : undefined}>{formattedValue}</span>
                  {displaySuffix ? (
                    <span className={`${isCurrency ? "" : "ml-1"} text-xs font-semibold text-muted-foreground sm:text-sm whitespace-nowrap`}>
                      {displaySuffix}
                    </span>
                  ) : null}
                </>
              )}
            </div>
            {isError ? (
              <div className={`${isCurrency ? "col-span-2" : ""} mt-2 flex flex-wrap items-center gap-2`}>
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
              <p className={`${isCurrency ? "col-span-2" : ""} mt-1 truncate text-xs text-muted-foreground`}>
                {helper}
              </p>
            ) : null}
          </div>
          <div
            className={`${isCurrency ? "col-start-2 row-start-1" : ""} flex h-11 w-11 shrink-0 items-center justify-center rounded-lg shadow-none ${toneClass}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
