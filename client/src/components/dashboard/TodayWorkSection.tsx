import {
  MobileTaskSheet,
  type ConfirmAction,
} from "@/components/dashboard/MobileTaskSheet";
import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import {
  TodayWorkExecutionQueue,
  toDashboardMobileTask,
} from "@/components/dashboard/TodayWorkExecutionQueue";
import { buildCustomerListPresetPath } from "@/components/customers/customerListUrlPresets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, renderMetricValue } from "@/components/ui/empty-state";
import { buildCustomerDetailPath } from "@/lib/customerDetailActions";
import {
  getDashboardQuickActionsForRole,
  getScopeLabel,
  type DashboardQuickActionIcon,
} from "@/lib/roleOperationalDashboard";
import {
  buildTodayWorkItems,
  type TodayWorkItem,
  type TodayWorkQueueFilter,
} from "@/lib/todayWorkExecution";
import { trpc } from "@/lib/trpc";
import {
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { getKstLocalDateTimeAfter } from "@shared/timePolicy";
import {
  CalendarPlus,
  CheckSquare2,
  ClipboardCheck,
  FileText,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import type { ElementType } from "react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export interface TodayWorkSectionProps {
  userName?: string | null;
  role?: string;
  roleTitle: string;
}

function formatWon(value: number | undefined) {
  return `${(value ?? 0).toLocaleString()}원`;
}

const quickActionIcons: Record<DashboardQuickActionIcon, ElementType> = {
  customers: Search,
  followup: ClipboardCheck,
  calendar: CalendarPlus,
  contracts: FileText,
  assignment: UserCog,
  approvals: CheckSquare2,
  risk: ShieldAlert,
  team: UsersRound,
};

function EmptyState({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground">
      <div>{children}</div>
      {action ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export function TodayWorkSection({
  userName,
  role,
  roleTitle,
}: TodayWorkSectionProps) {
  const [, setLocation] = useLocation();
  const [executionQueueFilter, setExecutionQueueFilter] =
    useState<TodayWorkQueueFilter>("all");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [postponeMode, setPostponeMode] = useState<"quick" | "custom">("quick");
  const [customPostponeDate, setCustomPostponeDate] = useState("");
  const [busyTaskKey, setBusyTaskKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingDesktopCompletion, setPendingDesktopCompletion] = useState<{
    key: string;
    title: string;
    description: string;
    confirmLabel: string;
    execute: () => Promise<unknown>;
    successMessage: string;
  } | null>(null);
  const busyTaskKeyRef = useRef<string | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading, isError, refetch } =
    trpc.dashboard.todayWork.useQuery({});
  const recommendationSummary =
    trpc.recommendations.dashboardSummary.useQuery({});
  const segmentCounts = trpc.customers.segmentCounts.useQuery({});

  const refreshTodayWork = () => {
    utils.dashboard.todayWork.invalidate();
    utils.notifications.list.invalidate();
    utils.notifications.unreadCount.invalidate();
    utils.notifications.myUnreadCount.invalidate();
    utils.followUps.listToday.invalidate();
    utils.followUps.listOverdue.invalidate();
    utils.schedules.list.invalidate();
    utils.customers.list.invalidate();
  };
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: refreshTodayWork,
    onError: () => toast.error("알림 읽음 처리에 실패했습니다."),
  });
  const completeMutation = trpc.notifications.updateProcessStatus.useMutation({
    onSuccess: refreshTodayWork,
    onError: () => toast.error("알림 상태 변경에 실패했습니다."),
  });
  const followUpCompleteMutation = trpc.followUps.complete.useMutation({
    onSuccess: refreshTodayWork,
  });
  const followUpPostponeMutation = trpc.followUps.postpone.useMutation({
    onSuccess: refreshTodayWork,
  });
  const followUpCancelMutation = trpc.followUps.cancel.useMutation({
    onSuccess: refreshTodayWork,
  });
  const scheduleUpdateMutation = trpc.schedules.update.useMutation({
    onSuccess: refreshTodayWork,
  });
  const customerUpdateMutation = trpc.customers.update.useMutation({
    onSuccess: refreshTodayWork,
  });

  const cards = data?.cards;
  const todayWorkItems = useMemo(
    () => buildTodayWorkItems(data ?? undefined),
    [data]
  );
  const topContacts = recommendationSummary.data?.topContacts ?? [];
  const scopeLabel = getScopeLabel(role);
  const quickActions = getDashboardQuickActionsForRole(role);
  const customerPresetPaths = {
    todayFollowUp: buildCustomerListPresetPath("today-follow-up"),
    overdueFollowUp: buildCustomerListPresetPath("overdue-follow-up"),
    longUnmanaged: buildCustomerListPresetPath("long-unmanaged"),
    priorityContact: buildCustomerListPresetPath("priority-contact"),
  };
  const rolePriorityText =
    role === "branch_admin"
      ? "지점 전체 미처리 업무와 승인 대기를 먼저 정리합니다."
      : role === "sub_branch_admin"
        ? "산하 조직의 지연 업무와 오늘 실행 건을 먼저 정리합니다."
        : role === "team_leader"
          ? "팀의 오늘 연락과 지원이 필요한 업무를 먼저 정리합니다."
          : "내 고객의 오늘 연락과 후속관리부터 바로 처리합니다.";

  const priorityWorkItems = [
    {
      label: "기한 경과 후속",
      value: cards?.overdueFollowUpCount ?? 0,
      helper: "약속일이 지난 재연락 업무",
      path: customerPresetPaths.overdueFollowUp,
      tone: "border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200",
    },
    {
      label: "오늘 연락 실행",
      value: cards?.todayFollowUpCount ?? 0,
      helper: "오늘 도래한 후속관리",
      path: customerPresetPaths.todayFollowUp,
      tone: "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200",
    },
    {
      label: "오늘 일정 확인",
      value: cards?.todayScheduleCount ?? 0,
      helper: "상담·계약 일정",
      path: "/calendar",
      tone: "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200",
    },
    {
      label: "확인 대기 알림",
      value: cards?.pendingNotificationCount ?? 0,
      helper: "읽지 않은 업무 알림",
      path: "/notifications",
      tone: "border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200",
    },
    {
      label: "장기 미관리 점검",
      value: cards?.longUnmanagedCustomerCount ?? 0,
      helper: "누락 위험 고객",
      path: customerPresetPaths.longUnmanaged,
      tone: "border-slate-200 bg-slate-50/80 text-slate-800 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-200",
    },
  ]
    .filter(item => item.value > 0)
    .slice(0, 3);

  const kpiItems = [
    {
      id: "all-customers",
      title: "권한 범위 고객",
      value: segmentCounts.data?.all,
      icon: Users,
      tone: "navy" as const,
      helper: `${scopeLabel} 전체`,
      path: "/customers",
      isLoading: segmentCounts.isLoading,
      isError: segmentCounts.isError,
      retry: () => void segmentCounts.refetch(),
    },
    {
      id: "contracted-customers",
      title: "계약 고객",
      value: segmentCounts.data?.contracted,
      icon: FileText,
      tone: "green" as const,
      helper: "활성 계약 기준",
      path: "/customers?segment=contracted",
      isLoading: segmentCounts.isLoading,
      isError: segmentCounts.isError,
      retry: () => void segmentCounts.refetch(),
    },
    {
      id: "database-customers",
      title: "배분 DB",
      value: segmentCounts.data?.database,
      icon: UserCog,
      tone: "blue" as const,
      helper: "계약 전 영업 대상",
      path: "/customers?segment=database",
      isLoading: segmentCounts.isLoading,
      isError: segmentCounts.isError,
      retry: () => void segmentCounts.refetch(),
    },
    {
      id: "monthly-contracts",
      title: "이번 달 신규 계약",
      value: cards?.monthlyContractCount,
      icon: Target,
      tone: "gold" as const,
      helper: "실제 계약일 기준",
      path: "/contracts",
      isLoading,
      isError,
      retry: () => void refetch(),
    },
    {
      id: "monthly-premium",
      title: "이번 달 월납보험료",
      value: formatWon(cards?.monthlyPremiumSum),
      icon: TrendingUp,
      tone: "orange" as const,
      helper: "활성 계약 합계",
      path: "/performance",
      isLoading,
      isError,
      retry: () => void refetch(),
    },
  ];

  const isTaskBusy =
    Boolean(busyTaskKey) ||
    followUpCompleteMutation.isPending ||
    followUpPostponeMutation.isPending ||
    followUpCancelMutation.isPending ||
    scheduleUpdateMutation.isPending ||
    markReadMutation.isPending ||
    completeMutation.isPending ||
    customerUpdateMutation.isPending;

  const closeTaskSheet = () => {
    setSelectedTask(null);
    setPostponeMode("quick");
    setCustomPostponeDate("");
    setBusyTaskKey(null);
    busyTaskKeyRef.current = null;
    setConfirmAction(null);
  };
  const postponedDate = (days: number) =>
    days === 0
      ? getKstLocalDateTimeAfter(new Date(), { hours: 2 })
      : getKstLocalDateTimeAfter(new Date(), { days, defaultHour: 10 });
  const runTask = async (
    taskKey: string,
    work: () => Promise<unknown>,
    message: string
  ) => {
    if (busyTaskKeyRef.current) return;
    busyTaskKeyRef.current = taskKey;
    setBusyTaskKey(taskKey);
    try {
      await work();
      toast.success(message);
      closeTaskSheet();
    } catch (error: any) {
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed);
      setBusyTaskKey(null);
      busyTaskKeyRef.current = null;
    }
  };
  const requestDesktopCompletion = (config: {
    key: string;
    title: string;
    description: string;
    confirmLabel: string;
    execute: () => Promise<unknown>;
    successMessage: string;
  }) => setPendingDesktopCompletion(config);

  const handleExecutionPrimaryAction = (item: TodayWorkItem) => {
    if (item.type === "followup") {
      requestDesktopCompletion({
        key: item.key,
        title: "후속관리를 완료할까요?",
        description: "완료하면 오늘 할 일 목록에서 제외됩니다.",
        confirmLabel: "완료로 변경",
        execute: () => followUpCompleteMutation.mutateAsync({ id: item.id }),
        successMessage: "후속관리를 완료했습니다.",
      });
      return;
    }
    if (item.type === "schedule") {
      requestDesktopCompletion({
        key: item.key,
        title: "일정을 완료할까요?",
        description: "완료 처리 후 일정 상태가 변경됩니다.",
        confirmLabel: "완료로 변경",
        execute: () =>
          scheduleUpdateMutation.mutateAsync({ id: item.id, status: "완료" }),
        successMessage: "일정을 완료했습니다.",
      });
      return;
    }
    if (item.type === "notification") {
      void runTask(
        item.key,
        () => markReadMutation.mutateAsync({ id: item.id }),
        "알림을 확인했습니다."
      );
      return;
    }
    requestDesktopCompletion({
      key: item.key,
      title: "연락완료로 기록할까요?",
      description: "고객 상담 상태가 연락완료로 변경됩니다.",
      confirmLabel: "연락완료로 기록",
      execute: () =>
        customerUpdateMutation.mutateAsync({
          id: item.id,
          consultStatus: "통화완료",
        }),
      successMessage: "연락 완료로 기록했습니다.",
    });
  };
  const openExecutionItem = (item: TodayWorkItem) => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSelectedTask(toDashboardMobileTask(item));
      return;
    }
    setLocation(item.route);
  };
  const taskTitle = selectedTask
    ? selectedTask.taskType === "followUp"
      ? (selectedTask.customerName ?? `고객 #${selectedTask.customerId}`)
      : selectedTask.taskType === "schedule"
        ? selectedTask.title
        : selectedTask.taskType === "notification"
          ? selectedTask.title
          : selectedTask.name
    : "";

  return (
    <section className="space-y-5" aria-labelledby="dashboard-cockpit-title">
      <Card
        className="crm-dashboard-card overflow-hidden border-primary/15"
        data-testid="dashboard-action-cockpit"
      >
        <div className="crm-masthead-rule" />
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.35fr] lg:items-end">
            <div>
              <Badge
                variant="outline"
                className="border-sidebar-primary/45 bg-sidebar-primary/10 font-semibold text-foreground"
              >
                오늘 업무 · {roleTitle}
              </Badge>
              <h1
                id="dashboard-cockpit-title"
                className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                {userName ?? "담당자"}님, 다음 행동부터 시작하세요.
              </h1>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {rolePriorityText}
              </p>
            </div>

            <div data-testid="dashboard-priority-actions">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                오늘의 우선 행동
              </p>
              {isLoading ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-live="polite">
                  {[0, 1, 2].map(item => (
                    <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : isError ? (
                <ErrorState
                  title="오늘 업무를 불러오지 못했습니다."
                  description="다른 영역은 계속 사용할 수 있습니다."
                  retryLabel="다시 시도"
                  onRetry={() => void refetch()}
                  compact
                  className="py-3"
                />
              ) : priorityWorkItems.length === 0 ? (
                <div className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    지금 바로 처리할 지연 업무가 없습니다.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10 shrink-0"
                    onClick={() => setLocation("/calendar?action=quick-create")}
                  >
                    일정 등록
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {priorityWorkItems.map((item, index) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setLocation(item.path)}
                      className={`crm-dashboard-action min-h-16 rounded-lg border p-3 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${index === 2 ? "hidden sm:block" : ""} ${item.tone}`}
                      aria-label={`${item.label} ${item.value}건, ${item.helper}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{item.label}</p>
                          <p className="mt-1 truncate text-xs opacity-80">{item.helper}</p>
                        </div>
                        <span className="shrink-0 text-xl font-bold tabular-nums tracking-tight">
                          {item.value}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/70 pt-3" data-testid="dashboard-quick-actions">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                빠른 실행
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {scopeLabel} 권한에 맞는 기능만 표시됩니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {quickActions.map((action, index) => {
                const Icon = quickActionIcons[action.icon];
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setLocation(action.path)}
                    className={`crm-dashboard-action min-h-14 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${index === 4 ? "hidden sm:flex" : "flex"}`}
                    aria-label={`${action.label}: ${action.hint}`}
                    data-testid={`dashboard-quick-action-${action.id}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {action.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {action.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:hidden" data-testid="dashboard-mobile-kpis">
            {kpiItems.slice(0, 2).map(item => (
              <button
                key={item.id}
                type="button"
                className="min-h-16 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setLocation(item.path)}
                aria-label={`${item.title} ${item.value ?? 0}건 보기`}
              >
                <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-foreground">
                  {item.isLoading || item.isError
                    ? renderMetricValue(0, {
                        isLoading: item.isLoading,
                        isError: item.isError,
                      })
                    : (item.value ?? 0)}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div
        className="hidden gap-3 md:grid md:grid-cols-3 xl:grid-cols-5"
        data-testid="dashboard-core-kpis"
      >
        {kpiItems.map(item => (
          <PremiumStatCard
            key={item.id}
            title={item.title}
            value={item.value}
            icon={item.icon}
            tone={item.tone}
            helper={item.helper}
            isLoading={item.isLoading}
            isError={item.isError}
            onRetry={item.retry}
            onClick={() => setLocation(item.path)}
          />
        ))}
      </div>

      <TodayWorkExecutionQueue
        items={todayWorkItems}
        filter={executionQueueFilter}
        onFilterChange={setExecutionQueueFilter}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onSelectItem={openExecutionItem}
        onPrimaryAction={handleExecutionPrimaryAction}
        onNavigate={setLocation}
        busyItemKey={busyTaskKey}
        limit={5}
      />

      <MobileTaskSheet
        selectedTask={selectedTask}
        taskTitle={taskTitle}
        isTaskBusy={isTaskBusy}
        postponeMode={postponeMode}
        customPostponeDate={customPostponeDate}
        confirmAction={confirmAction}
        onClose={closeTaskSheet}
        onNavigate={setLocation}
        onPostponeModeChange={setPostponeMode}
        onCustomPostponeDateChange={setCustomPostponeDate}
        onConfirmActionChange={setConfirmAction}
        onFollowUpComplete={task =>
          runTask(
            `followup-complete-${task.id}`,
            () => followUpCompleteMutation.mutateAsync({ id: task.id }),
            "처리했습니다."
          )
        }
        onFollowUpCancel={task =>
          runTask(
            `followup-cancel-${task.id}`,
            () => followUpCancelMutation.mutateAsync({ id: task.id }),
            "처리했습니다."
          )
        }
        onFollowUpQuickPostpone={(task, days) =>
          runTask(
            `followup-postpone-${task.id}`,
            () =>
              followUpPostponeMutation.mutateAsync({
                id: task.id,
                nextContactDate: postponedDate(days),
                reason: task.reason,
              }),
            "연기했습니다."
          )
        }
        onFollowUpCustomPostpone={task =>
          runTask(
            `followup-custom-${task.id}`,
            () =>
              followUpPostponeMutation.mutateAsync({
                id: task.id,
                nextContactDate: customPostponeDate,
                reason: task.reason,
              }),
            "연기했습니다."
          )
        }
        onScheduleComplete={task =>
          runTask(
            `schedule-complete-${task.id}`,
            () =>
              scheduleUpdateMutation.mutateAsync({
                id: task.id,
                status: "완료",
              }),
            "처리했습니다."
          )
        }
        onNotificationConfirm={task =>
          runTask(
            `notification-read-${task.id}`,
            async () => {
              await completeMutation.mutateAsync({
                id: task.id,
                processStatus: "확인",
              });
              await markReadMutation.mutateAsync({ id: task.id });
            },
            "처리했습니다."
          )
        }
        onNotificationComplete={task =>
          runTask(
            `notification-complete-${task.id}`,
            async () => {
              await completeMutation.mutateAsync({
                id: task.id,
                processStatus: "처리완료",
              });
              await markReadMutation.mutateAsync({ id: task.id });
            },
            "처리했습니다."
          )
        }
        onCustomerContactDone={task =>
          runTask(
            `customer-status-${task.id}`,
            () =>
              customerUpdateMutation.mutateAsync({
                id: task.id,
                consultStatus: "통화완료",
              }),
            "처리했습니다."
          )
        }
        onCustomerAbsent={task =>
          runTask(
            `customer-absent-${task.id}`,
            () =>
              customerUpdateMutation.mutateAsync({
                id: task.id,
                consultStatus: "부재",
              }),
            "처리했습니다."
          )
        }
      />

      <Card className="crm-dashboard-card" data-testid="dashboard-priority-contacts">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <CardTitle className="text-base font-semibold tracking-tight">
              우선 연락 고객
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              기존 추천 기준에서 상위 3명만 표시합니다.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10"
            onClick={() => setLocation(customerPresetPaths.priorityContact)}
          >
            전체 보기
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
          {recommendationSummary.isError ? (
            <ErrorState
              title="우선 연락 고객을 불러오지 못했습니다."
              description="다른 업무는 계속 처리할 수 있습니다."
              retryLabel="다시 시도"
              onRetry={() => void recommendationSummary.refetch()}
              className="py-5"
            />
          ) : topContacts.length === 0 ? (
            <EmptyState
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(customerPresetPaths.priorityContact)}
                >
                  고객 목록 확인
                </Button>
              }
            >
              지금 우선 연락으로 분류된 고객이 없습니다.
            </EmptyState>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {topContacts.slice(0, 3).map(contact => (
                <div
                  key={contact.customerId}
                  className="rounded-lg border border-border/80 bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {contact.customerName}
                    </p>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {contact.urgency === "high"
                        ? "긴급"
                        : contact.urgency === "medium"
                          ? "확인"
                          : "일반"}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {contact.reasons.slice(0, 2).join(" · ") ||
                      contact.recommendedAction}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      onClick={() =>
                        setLocation(buildCustomerDetailPath(contact.customerId))
                      }
                    >
                      고객 보기
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10"
                      onClick={() =>
                        setLocation(
                          buildCustomerDetailPath(
                            contact.customerId,
                            "quick-followup"
                          )
                        )
                      }
                    >
                      후속 등록
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingDesktopCompletion)}
        onOpenChange={open => {
          if (!open) setPendingDesktopCompletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDesktopCompletion?.title ?? "업무를 완료할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDesktopCompletion?.description ??
                "완료 후 목록에서 제외됩니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTaskBusy}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isTaskBusy}
              onClick={event => {
                event.preventDefault();
                if (!pendingDesktopCompletion) return;
                void runTask(
                  pendingDesktopCompletion.key,
                  pendingDesktopCompletion.execute,
                  pendingDesktopCompletion.successMessage
                ).finally(() => setPendingDesktopCompletion(null));
              }}
            >
              {isTaskBusy
                ? "처리 중..."
                : (pendingDesktopCompletion?.confirmLabel ?? "확정")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
