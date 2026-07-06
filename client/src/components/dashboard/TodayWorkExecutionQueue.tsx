import { Button } from "@/components/ui/button";
import { buildCustomerDetailPath } from "@/lib/customerDetailActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import type { DashboardMobileTask } from "@/components/dashboard/MobileTaskSheet";
import { cn } from "@/lib/utils";
import {
  countTodayWorkItemsByFilter,
  filterTodayWorkItems,
  type TodayWorkItem,
  type TodayWorkQueueFilter,
} from "@/lib/todayWorkExecution";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Phone,
} from "lucide-react";
import React from "react";
import type { ElementType } from "react";

const FILTER_LABELS: Record<TodayWorkQueueFilter, string> = {
  all: "전체",
  schedule: "오늘 일정",
  followup: "후속관리",
  notification: "알림",
};

const TYPE_ICONS: Record<TodayWorkItem["type"], ElementType> = {
  schedule: CalendarDays,
  followup: Phone,
  notification: Bell,
  customer: ClipboardList,
};

function priorityTone(label: string) {
  if (label.includes("지연") || label.includes("긴급")) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200";
  }
  if (label.includes("미완료") || label.includes("곧")) {
    return "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200";
  }
  if (label.includes("오늘")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";
  }
  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200";
}

function formatDueLabel(item: TodayWorkItem) {
  if (item.type === "notification" || item.type === "customer") {
    return "확인 필요";
  }
  const formatted = formatKstLocalDateTime(item.dueAt, { seconds: false });
  return formatted.replace("T", " ").slice(0, 16);
}

export type TodayWorkExecutionQueueProps = {
  items: TodayWorkItem[];
  filter: TodayWorkQueueFilter;
  onFilterChange: (filter: TodayWorkQueueFilter) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectItem: (item: TodayWorkItem) => void;
  onPrimaryAction: (item: TodayWorkItem) => void;
  onNavigate: (path: string) => void;
  busyItemKey?: string | null;
  limit?: number;
  className?: string;
  compact?: boolean;
};

export function TodayWorkExecutionQueue({
  items,
  filter,
  onFilterChange,
  isLoading,
  isError,
  onRetry,
  onSelectItem,
  onPrimaryAction,
  onNavigate,
  busyItemKey,
  limit = 5,
  className,
  compact = false,
}: TodayWorkExecutionQueueProps) {
  const counts = countTodayWorkItemsByFilter(items);
  const visibleItems = filterTodayWorkItems(items, filter).slice(0, limit);

  return (
    <Card
      className={cn("crm-dashboard-card", className)}
      data-testid="dashboard-mobile-followup-queue"
    >
      <CardHeader className="flex-col items-stretch gap-3 border-b border-border/70 pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">
            {compact ? "먼저 처리할 일" : "오늘 업무 실행"}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            일정·후속관리·알림을 우선순위대로 정리했습니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
          {(Object.keys(FILTER_LABELS) as TodayWorkQueueFilter[]).map(key => (
            <button
              key={key}
              type="button"
              aria-label={`오늘 업무 필터: ${FILTER_LABELS[key]} ${counts[key]}건`}
              aria-pressed={filter === key}
              onClick={() => onFilterChange(key)}
              className={cn(
                "min-h-11 rounded-full border px-3 py-2 text-xs font-semibold transition-colors sm:min-h-9 sm:py-1.5",
                filter === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground"
              )}
            >
              {FILTER_LABELS[key]} {counts[key]}건
            </button>
          ))}
        </div>
        {!isLoading && !isError ? (
          <div
            className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/20 p-2 min-[380px]:grid-cols-3 sm:hidden"
            data-testid="mobile-followup-summary"
          >
            <button
              type="button"
              className="min-h-11 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-semibold text-amber-900"
              data-testid="mobile-followup-pending-chip"
              onClick={() => onFilterChange("followup")}
            >
              미처리 후속 {counts.followup}건
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-xs font-semibold text-blue-900"
              data-testid="mobile-followup-today-chip"
              onClick={() => onFilterChange("schedule")}
            >
              오늘 일정 {counts.schedule}건
            </button>
            <span
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              data-testid="mobile-followup-recent-chip"
            >
              최근 후속 {counts.followup > 0 ? "확인 필요" : "없음"}
            </span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-5 sm:px-5">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(index => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl bg-muted"
              />
            ))}
            <p className="text-center text-xs text-muted-foreground">
              오늘 업무를 불러오고 있습니다.
            </p>
          </div>
        ) : isError ? (
          <ErrorState
            title="오늘 업무를 불러오지 못했습니다."
            description="잠시 후 다시 시도해 주세요."
            retryLabel="다시 시도"
            onRetry={onRetry}
            className="py-6"
          />
        ) : visibleItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">
            {filter === "all"
              ? "오늘 처리할 업무가 없습니다. 모두 확인했습니다."
              : filter === "notification"
                ? "오늘은 확인할 알림이 없습니다."
                : filter === "followup"
                  ? "확인할 후속이 없습니다."
                  : "오늘 예정된 일정이 없습니다."}
          </div>
        ) : (
          visibleItems.map(item => {
            const Icon = TYPE_ICONS[item.type];
            const isBusy = busyItemKey === item.key;
            return (
              <div
                key={item.key}
                data-testid={
                  item.type === "followup"
                    ? "mobile-followup-workflow-card"
                    : undefined
                }
                className="crm-dashboard-card rounded-xl border border-border/80 p-3 shadow-sm sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                      <Icon className="h-4 w-4 text-foreground" />
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="line-clamp-2 text-left text-sm font-semibold leading-5 text-foreground hover:underline"
                      >
                        {item.title}
                      </button>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDueLabel(item)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
                      priorityTone(item.priorityLabel)
                    )}
                  >
                    {item.priorityLabel}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    className="col-span-2 min-h-11 justify-center sm:col-span-1 sm:min-h-10"
                    disabled={isBusy}
                    onClick={() => onPrimaryAction(item)}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    {isBusy ? "처리 중..." : item.primaryActionLabel}
                  </Button>
                  {item.customerId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11 justify-center sm:min-h-10"
                      data-testid={
                        item.type === "followup"
                          ? "mobile-followup-action"
                          : undefined
                      }
                      onClick={() =>
                        onNavigate(
                          buildCustomerDetailPath(
                            item.customerId!,
                            item.type === "followup"
                              ? "quick-followup"
                              : item.type === "customer"
                                ? "consult"
                                : undefined
                          )
                        )
                      }
                    >
                      고객상세 보기
                    </Button>
                  ) : null}
                  {item.type === "followup" && item.customerId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11 justify-center sm:min-h-10"
                      data-testid="mobile-followup-calendar-action"
                      onClick={() =>
                        onNavigate(
                          `/calendar?customerId=${item.customerId}&action=quick-create`
                        )
                      }
                    >
                      일정 보기
                    </Button>
                  ) : null}
                  {item.type === "schedule" && item.customerId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11 justify-center sm:min-h-10"
                      onClick={() =>
                        onNavigate(
                          buildCustomerDetailPath(
                            item.customerId!,
                            "quick-followup"
                          )
                        )
                      }
                    >
                      후속 등록
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-11 justify-center sm:min-h-10"
                    onClick={() => onNavigate(item.route)}
                  >
                    바로 처리
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function toDashboardMobileTask(
  item: TodayWorkItem
): DashboardMobileTask {
  return {
    ...item.source,
    id: item.id,
    taskType: item.taskType,
    priorityLabel: item.priorityLabel,
    customerId: item.customerId ?? item.source.customerId,
    customerName: item.customerName ?? item.source.customerName,
    title: item.title,
    name: item.title,
  } as DashboardMobileTask;
}
