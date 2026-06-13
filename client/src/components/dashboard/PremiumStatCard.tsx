import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="crm-dashboard-card overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {formatNumber(value)}
              {suffix ? (
                <span className="ml-1 text-sm font-semibold text-muted-foreground">
                  {suffix}
                </span>
              ) : null}
            </p>
            {helper ? (
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
