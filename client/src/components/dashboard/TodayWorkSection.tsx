import { getStatusLabel, StatusBadge } from "@/components/StatusBadge";
import { MobileTaskSheet } from "@/components/dashboard/MobileTaskSheet";
import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { classifyNotificationPriority, sortNotificationsForQueue } from "@/lib/notificationPriority";
import { trpc } from "@/lib/trpc";
import { formatKstLocalDateTime, getKstLocalDateTimeAfter } from "@shared/timePolicy";
import { AlertCircle, Bell, BellDot, CalendarDays, CheckCircle2, Clock3, FileText, LayoutGrid, Phone, Target, TrendingUp, Users } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useRef, useState } from "react";
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

const dashboardNotificationTypeLabels: Record<string, string> = {
  contract_90: "계약 90일 알림",
  contract_180: "계약 180일 알림",
  contract_365: "계약 365일 알림",
  birthday: "생일 알림",
  uncontacted_3days: "3일 미상담",
  long_unmanaged_90: "90일 장기 미관리",
  reconsult: "재상담 알림",
  unpaid_lapse: "미납/실효 알림",
  schedule_1day: "일정 1일 전",
  schedule_today: "오늘 일정",
  schedule_1hour: "일정 1시간 전",
  schedule_incomplete: "미완료 일정",
  customer_assigned: "고객 배정",
  today_follow_up: "오늘 연락 대상",
  schedule_30min: "일정 30분 전",
  contract_delete_request: "계약 삭제 요청",
  general: "일반 알림",
};

function getDashboardNotificationTypeLabel(type?: string | null) {
  if (!type) return "알림";
  return dashboardNotificationTypeLabels[type] ?? "기타 알림";
}

function EmptyState({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">
      <div>{children}</div>
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="crm-dashboard-card">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-2 px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

export function TodayWorkSection({ userName, role, roleTitle }: TodayWorkSectionProps) {
  const [, setLocation] = useLocation();
  const [queuePriorityFilter, setQueuePriorityFilter] = useState<"all" | "urgent" | "today" | "general">("all");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [postponeMode, setPostponeMode] = useState<"quick" | "custom">("quick");
  const [customPostponeDate, setCustomPostponeDate] = useState("");
  const [busyTaskKey, setBusyTaskKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"cancelFollowUp" | null>(null);
  const busyTaskKeyRef = useRef<string | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading, isError, refetch } = trpc.dashboard.todayWork.useQuery({});
  const {
    data: recommendationSummary,
    isError: isRecommendationError,
    refetch: refetchRecommendationSummary,
  } = trpc.recommendations.dashboardSummary.useQuery({});
  const refreshTodayWork = () => {
    utils.dashboard.todayWork.invalidate();
    utils.notifications.list.invalidate();
    utils.notifications.unreadCount.invalidate();
    utils.followUps.listToday.invalidate();
    utils.followUps.listOverdue.invalidate();
    utils.schedules.list.invalidate();
    utils.customers.list.invalidate();
  };
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      refreshTodayWork();
    },
    onError: () => toast.error("알림 읽음 처리에 실패했습니다."),
  });
  const completeMutation = trpc.notifications.updateProcessStatus.useMutation({
    onSuccess: () => {
      refreshTodayWork();
    },
    onError: () => toast.error("알림 상태 변경에 실패했습니다."),
  });
  const followUpCompleteMutation = trpc.followUps.complete.useMutation({ onSuccess: refreshTodayWork });
  const followUpPostponeMutation = trpc.followUps.postpone.useMutation({ onSuccess: refreshTodayWork });
  const followUpCancelMutation = trpc.followUps.cancel.useMutation({ onSuccess: refreshTodayWork });
  const scheduleUpdateMutation = trpc.schedules.update.useMutation({ onSuccess: refreshTodayWork });
  const customerUpdateMutation = trpc.customers.update.useMutation({ onSuccess: refreshTodayWork });
  const retryTodayWork = () => {
    void refetch();
  };
  const retryRecommendationSummary = () => {
    void refetchRecommendationSummary();
  };
  const cards = data?.cards;
  const topContacts = recommendationSummary?.topContacts ?? [];
  const rolePriorityText =
    role === "branch_admin"
      ? "지점 전체 미처리 업무와 리스크를 먼저 정리합니다."
      : role === "sub_branch_admin"
        ? "산하 조직의 미처리 업무와 오늘 실행 건을 먼저 정리합니다."
        : role === "team_leader"
          ? "팀의 오늘 연락, 미완료 일정, 누락 위험을 먼저 정리합니다."
          : "내 고객의 오늘 연락과 후속관리부터 바로 처리합니다.";
  const fieldQueueBase = [
    {
      key: "notifications",
      title: "미확인 알림",
      count: isError ? "-" : cards?.pendingNotificationCount ?? 0,
      hint: "즉시 확인이 필요한 알림",
      actionLabel: "알림센터",
      onClick: () => setLocation("/notifications"),
      tone: "border-blue-200 bg-blue-50/55 dark:border-blue-900/40 dark:bg-blue-950/20",
    },
    {
      key: "overdueFollowUps",
      title: "미처리 후속",
      count: isError ? "-" : cards?.overdueFollowUpCount ?? 0,
      hint: "기한이 지난 재연락 업무",
      actionLabel: "후속관리 열기",
      onClick: () => setLocation("/customers"),
      tone: "border-red-200 bg-red-50/55 dark:border-red-900/40 dark:bg-red-950/20",
    },
    {
      key: "todayContacts",
      title: "오늘 연락 대상",
      count: isError ? "-" : cards?.todayFollowUpCount ?? 0,
      hint: "이전에 약속한 연락 업무",
      actionLabel: "고객 DB",
      onClick: () => setLocation("/customers"),
      tone: "border-emerald-200 bg-emerald-50/55 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    },
    {
      key: "schedules",
      title: "오늘 일정",
      count: isError ? "-" : cards?.todayScheduleCount ?? 0,
      hint: "오늘 진행할 상담·계약 일정",
      actionLabel: "일정 캘린더",
      onClick: () => setLocation("/calendar"),
      tone: "border-amber-200 bg-amber-50/55 dark:border-amber-900/40 dark:bg-amber-950/20",
    },
  ];
  const fieldQueue =
    role === "member"
      ? ["todayContacts", "overdueFollowUps", "schedules", "notifications"].map((key) => fieldQueueBase.find((item) => item.key === key)!)
      : fieldQueueBase;
  const pendingNotifications = data?.pendingNotifications ?? [];
  const priorityCounts = {
    urgent: pendingNotifications.filter((n) => classifyNotificationPriority(n) === "urgent").length,
    today: pendingNotifications.filter((n) => classifyNotificationPriority(n) === "today").length,
    general: pendingNotifications.filter((n) => classifyNotificationPriority(n) === "general").length,
  };
  const filteredPendingNotifications = pendingNotifications.filter((notification) =>
    queuePriorityFilter === "all" ? true : classifyNotificationPriority(notification) === queuePriorityFilter
  );
  const sortedPendingNotifications = sortNotificationsForQueue(filteredPendingNotifications);
  const commandItems = [
    { label: "미확인 알림", value: cards?.pendingNotificationCount ?? 0, path: "/notifications", tone: "text-red-700" },
    { label: "미처리 후속", value: cards?.overdueFollowUpCount ?? 0, path: "/customers", tone: "text-red-700" },
    { label: "오늘 연락", value: cards?.todayFollowUpCount ?? 0, path: "/customers", tone: "text-emerald-700" },
    { label: "오늘 일정", value: cards?.todayScheduleCount ?? 0, path: "/calendar", tone: "text-amber-700" },
  ];
  const priorityWorkItems = [
    {
      label: "긴급 알림 처리",
      value: priorityCounts.urgent,
      helper: "미확인 알림 중 긴급 분류",
      path: "/notifications",
      tone: "border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200",
    },
    {
      label: "미처리 후속 완료",
      value: cards?.overdueFollowUpCount ?? 0,
      helper: "기한이 지난 재연락",
      path: "/customers",
      tone: "border-orange-200 bg-orange-50/70 text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200",
    },
    {
      label: "오늘 연락 실행",
      value: cards?.todayFollowUpCount ?? 0,
      helper: "오늘 도래한 후속관리",
      path: "/customers",
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
      label: "장기 미관리 점검",
      value: cards?.longUnmanagedCustomerCount ?? 0,
      helper: "누락 위험 고객",
      path: "/customers",
      tone: "border-slate-200 bg-slate-50/80 text-slate-800 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-200",
    },
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const hasImmediateWork = commandItems.some((item) => item.value > 0);
  const primaryCommandPath =
    (cards?.pendingNotificationCount ?? 0) > 0 ? "/notifications" :
    (cards?.overdueFollowUpCount ?? 0) > 0 || (cards?.todayFollowUpCount ?? 0) > 0 ? "/customers" :
    (cards?.todayScheduleCount ?? 0) > 0 ? "/calendar" :
    "/calendar";
  const primaryCommandLabel =
    (cards?.pendingNotificationCount ?? 0) > 0 ? "알림 처리하기" :
    (cards?.overdueFollowUpCount ?? 0) > 0 || (cards?.todayFollowUpCount ?? 0) > 0 ? "고객 처리하기" :
    (cards?.todayScheduleCount ?? 0) > 0 ? "오늘 일정 보기" :
    "일정 등록하기";
  const mobileFollowUpTasks = [
    ...(data?.overdueFollowUps ?? []).map((item) => ({ ...item, taskType: "followUp", priorityLabel: "기한 경과" })),
    ...(data?.todayFollowUps ?? []).map((item) => ({ ...item, taskType: "followUp", priorityLabel: "오늘 연락" })),
  ].filter((item, index, rows) => rows.findIndex((row) => row.id === item.id) === index).slice(0, 4);
  const mobileScheduleTasks = [
    ...(data?.incompleteSchedules ?? []).map((item) => ({ ...item, taskType: "schedule", priorityLabel: "미완료" })),
    ...(data?.todaySchedules ?? []).map((item) => ({ ...item, taskType: "schedule", priorityLabel: "오늘 일정" })),
  ].filter((item, index, rows) => rows.findIndex((row) => row.id === item.id) === index).slice(0, 4);
  const mobileNotificationTasks = (data?.pendingNotifications ?? []).slice(0, 4).map((item) => ({ ...item, taskType: "notification", priorityLabel: "미확인" }));
  const mobileLongUnmanagedTasks = (data?.longUnmanagedCustomers ?? []).filter(Boolean).slice(0, 3).map((item) => ({ ...item, taskType: "customer", priorityLabel: "장기 미관리" }));
  const hasMobileTasks = mobileFollowUpTasks.length + mobileScheduleTasks.length + mobileNotificationTasks.length + mobileLongUnmanagedTasks.length > 0;
  const isTaskBusy = Boolean(busyTaskKey) || followUpCompleteMutation.isPending || followUpPostponeMutation.isPending || followUpCancelMutation.isPending || scheduleUpdateMutation.isPending || markReadMutation.isPending || completeMutation.isPending || customerUpdateMutation.isPending;
  const closeTaskSheet = () => {
    setSelectedTask(null);
    setPostponeMode("quick");
    setCustomPostponeDate("");
    setBusyTaskKey(null);
    busyTaskKeyRef.current = null;
    setConfirmAction(null);
  };
  const postponedDate = (days: number) => {
    if (days === 0) {
      return getKstLocalDateTimeAfter(new Date(), { hours: 2 });
    }
    return getKstLocalDateTimeAfter(new Date(), { days, defaultHour: 10 });
  };
  const runTask = async (taskKey: string, work: () => Promise<unknown>, message: string) => {
    if (busyTaskKeyRef.current) return;
    busyTaskKeyRef.current = taskKey;
    setBusyTaskKey(taskKey);
    try {
      await work();
      toast.success(message);
      closeTaskSheet();
    } catch (error: any) {
      toast.error(error?.message || "다시 시도해 주세요.");
      setBusyTaskKey(null);
      busyTaskKeyRef.current = null;
    }
  };
  const taskTitle = selectedTask
    ? selectedTask.taskType === "followUp"
      ? selectedTask.customerName ?? `고객 #${selectedTask.customerId}`
      : selectedTask.taskType === "schedule"
        ? selectedTask.title
        : selectedTask.taskType === "notification"
          ? selectedTask.title
          : selectedTask.name
    : "";

  const mobileTaskPriorityTone = (task: any) => {
    if (task.taskType === "followUp" && task.priorityLabel === "기한 경과") {
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200";
    }
    if (task.taskType === "followUp") {
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200";
    }
    if (task.taskType === "schedule" && task.priorityLabel === "미완료") {
      return "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200";
    }
    if (task.taskType === "schedule") {
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";
    }
    if (task.taskType === "notification") {
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200";
    }
    if (task.taskType === "customer") {
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200";
    }
    return "border-border bg-muted text-muted-foreground";
  };

  const renderMobileTaskButton = (task: any) => {
    const title = task.taskType === "followUp"
      ? task.customerName ?? `고객 #${task.customerId}`
      : task.taskType === "schedule"
        ? task.title
        : task.taskType === "notification"
          ? task.title
          : task.name;
    const description = task.taskType === "followUp"
      ? `${task.nextAction ?? "연락"} · ${task.reason ?? "후속관리"}`
      : task.taskType === "schedule"
        ? `${formatKstLocalDateTime(task.startTime, { seconds: false }).slice(11, 16)} · ${task.type}`
        : task.taskType === "notification"
          ? `${task.type}${task.customerName ? ` · ${task.customerName}` : ""}`
          : `${task.consultStatus ?? "고객"} · 기존 기준 점검`;
    return (
      <button
        key={`${task.taskType}-${task.id}`}
        type="button"
        onClick={() => setSelectedTask(task)}
        className="crm-dashboard-action min-h-12 w-full rounded-lg border border-border bg-card p-3.5 text-left shadow-sm active:bg-muted/50"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${mobileTaskPriorityTone(task)}`}>{task.priorityLabel}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>
      </button>
    );
  };

  return (
    <section className="space-y-5">
      <Card className="crm-dashboard-card overflow-hidden border-primary/15">
        <div className="crm-masthead-rule" />
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_1.6fr_auto] xl:items-center">
            <div>
              <Badge variant="outline" className="border-sidebar-primary/45 bg-sidebar-primary/10 font-semibold text-foreground">
                오늘의 지휘센터 · {roleTitle}
              </Badge>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {userName ?? "담당자"}님, 지금 처리할 업무부터 보세요.
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {rolePriorityText} 오늘 연락할 고객, 미처리 업무, 일정, 알림을 한 번에 확인하세요.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {commandItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setLocation(item.path)}
                  className="crm-dashboard-action min-h-12 rounded-lg border border-border/80 bg-muted/30 p-3 text-left shadow-sm"
                >
                  <p className="text-[11px] font-medium text-muted-foreground">{item.label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${item.tone}`}>{isLoading || isError ? "-" : item.value}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button type="button" onClick={() => setLocation(primaryCommandPath)} className="min-h-12 gap-2 rounded-lg md:min-h-10">
                <BellDot className="h-4 w-4" />
                {hasImmediateWork ? primaryCommandLabel : "일정 등록하기"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation("/sales-pipeline")} className="min-h-12 gap-2 rounded-lg md:min-h-10">
                <LayoutGrid className="h-4 w-4" />
                파이프라인
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:col-span-3">
              {priorityWorkItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setLocation(item.path)}
                  className={`crm-dashboard-action min-h-12 rounded-lg border p-3 text-left shadow-sm ${item.tone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.label}</p>
                      <p className="mt-1 text-xs opacity-80">{item.helper}</p>
                    </div>
                    <p className="shrink-0 text-2xl font-bold tabular-nums tracking-tight">{isLoading || isError ? "-" : item.value}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="hidden gap-3 md:grid md:grid-cols-4 xl:grid-cols-7">
        <PremiumStatCard title="오늘 연락 대상" value={isLoading || isError ? "-" : cards?.todayFollowUpCount} icon={Phone} tone="gold" helper="후속 연락 예정" />
        <PremiumStatCard title="미처리 후속관리" value={isLoading || isError ? "-" : cards?.overdueFollowUpCount} icon={Clock3} tone="red" helper="기한 경과" />
        <PremiumStatCard title="오늘 상담 예정" value={isLoading || isError ? "-" : cards?.todayScheduleCount} icon={CalendarDays} tone="blue" helper="오늘 진행할 일정" />
        <PremiumStatCard title="미완료 일정" value={isLoading || isError ? "-" : cards?.incompleteScheduleCount} icon={AlertCircle} tone="orange" helper="처리 필요 일정" />
        <PremiumStatCard title="미확인 알림" value={isLoading || isError ? "-" : cards?.pendingNotificationCount} icon={Bell} tone="red" helper="확인 대기" />
        <PremiumStatCard title="이번 달 신규 계약" value={isLoading || isError ? "-" : cards?.monthlyContractCount} icon={FileText} tone="green" helper="신규 영업 성과" />
        <PremiumStatCard title="월납보험료 실적" value={isLoading || isError ? "-" : formatWon(cards?.monthlyPremiumSum)} icon={TrendingUp} tone="navy" helper="입력 계약 기준" />
      </div>

      <Card className="crm-dashboard-card md:hidden">
        <CardHeader className="flex-row items-center justify-between gap-2 border-b border-border/60 pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight">오늘 업무 요약</CardTitle>
          <button type="button" onClick={() => setLocation("/notifications")} className="text-xs font-semibold text-primary hover:underline">
            바로 처리
          </button>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "미처리 후속", value: cards?.overdueFollowUpCount ?? 0, path: "/customers" },
              { label: "오늘 연락", value: cards?.todayFollowUpCount ?? 0, path: "/customers" },
              { label: "오늘 일정", value: cards?.todayScheduleCount ?? 0, path: "/calendar" },
              { label: "미확인", value: cards?.pendingNotificationCount ?? 0, path: "/notifications" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setLocation(item.path)}
                className="min-h-12 rounded-lg border border-border bg-muted/25 px-3 py-2 text-left"
              >
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">{isLoading || isError ? "-" : item.value}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="crm-dashboard-card md:hidden">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            3터치 빠른 처리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : isError ? (
            <ErrorState
              title="오늘 업무를 불러오지 못했습니다."
              description="업무 수치를 0건으로 표시하지 않고 있습니다. 잠시 후 다시 시도해 주세요."
              retryLabel="다시 시도"
              onRetry={retryTodayWork}
              className="border-0 bg-transparent py-6"
            />
          ) : !hasMobileTasks ? (
            <EmptyState action={<Button type="button" size="sm" variant="outline" className="min-h-12" onClick={() => setLocation("/calendar")}>일정 등록</Button>}>
              처리할 업무가 없습니다.
            </EmptyState>
          ) : (
            <>
              {mobileFollowUpTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">미처리 후속관리</p>
                  {mobileFollowUpTasks.map(renderMobileTaskButton)}
                </div>
              )}
              {mobileScheduleTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">오늘 일정</p>
                  {mobileScheduleTasks.map(renderMobileTaskButton)}
                </div>
              )}
              {mobileNotificationTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">미확인 알림</p>
                  {mobileNotificationTasks.map(renderMobileTaskButton)}
                </div>
              )}
              {mobileLongUnmanagedTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">장기 미관리 고객</p>
                  {mobileLongUnmanagedTasks.map(renderMobileTaskButton)}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
        onFollowUpComplete={(task) => runTask(`followup-complete-${task.id}`, () => followUpCompleteMutation.mutateAsync({ id: task.id }), "처리했습니다.")}
        onFollowUpCancel={(task) => runTask(`followup-cancel-${task.id}`, () => followUpCancelMutation.mutateAsync({ id: task.id }), "처리했습니다.")}
        onFollowUpQuickPostpone={(task, days) => runTask(`followup-postpone-${task.id}`, () => followUpPostponeMutation.mutateAsync({ id: task.id, nextContactDate: postponedDate(days), reason: task.reason }), "연기했습니다.")}
        onFollowUpCustomPostpone={(task) => runTask(`followup-custom-${task.id}`, () => followUpPostponeMutation.mutateAsync({ id: task.id, nextContactDate: customPostponeDate, reason: task.reason }), "연기했습니다.")}
        onScheduleComplete={(task) => runTask(`schedule-complete-${task.id}`, () => scheduleUpdateMutation.mutateAsync({ id: task.id, status: "완료" }), "처리했습니다.")}
        onNotificationConfirm={(task) => runTask(`notification-read-${task.id}`, async () => {
          await completeMutation.mutateAsync({ id: task.id, processStatus: "확인" });
          await markReadMutation.mutateAsync({ id: task.id });
        }, "처리했습니다.")}
        onNotificationComplete={(task) => runTask(`notification-complete-${task.id}`, async () => {
          await completeMutation.mutateAsync({ id: task.id, processStatus: "처리완료" });
          await markReadMutation.mutateAsync({ id: task.id });
        }, "처리했습니다.")}
        onCustomerContactDone={(task) => runTask(`customer-status-${task.id}`, () => customerUpdateMutation.mutateAsync({ id: task.id, consultStatus: "통화완료" }), "처리했습니다.")}
        onCustomerAbsent={(task) => runTask(`customer-absent-${task.id}`, () => customerUpdateMutation.mutateAsync({ id: task.id, consultStatus: "부재" }), "처리했습니다.")}
      />

      <Card className="crm-dashboard-card">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
              <BellDot className="h-4 w-4" />
            </span>
            현장 즉시 처리 큐
          </CardTitle>
          <button type="button" onClick={() => setLocation("/notifications")} className="text-xs font-semibold text-primary hover:underline">
            전체 보기
          </button>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5">
          <div className="grid gap-2 md:grid-cols-4">
            {isError ? (
              <div className="md:col-span-4">
                <ErrorState
                  title="현장 처리 업무를 불러오지 못했습니다."
                  description="알림, 후속관리, 일정 수치를 0건으로 표시하지 않고 있습니다."
                  retryLabel="다시 시도"
                  onRetry={retryTodayWork}
                  className="py-6"
                />
              </div>
            ) : fieldQueue.map((item) => (
              <div key={item.title} className={`crm-dashboard-action rounded-lg border p-3 shadow-sm ${item.tone}`}>
                <p className="text-xs text-muted-foreground">{item.title}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">{item.count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                <button type="button" onClick={item.onClick} className="mt-2 text-xs font-semibold text-primary hover:underline">
                  {item.actionLabel}
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={queuePriorityFilter === "all"}
              onClick={() => setQueuePriorityFilter("all")}
              className={`crm-priority-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                queuePriorityFilter === "all"
                  ? "bg-primary/15 text-primary crm-priority-chip-active"
                  : "crm-priority-neutral"
              }`}
            >
              전체 {pendingNotifications.length}건
            </button>
            <button
              type="button"
              aria-pressed={queuePriorityFilter === "urgent"}
              onClick={() => setQueuePriorityFilter("urgent")}
              className={`crm-priority-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                queuePriorityFilter === "urgent"
                  ? "crm-priority-urgent crm-priority-chip-active"
                  : "crm-priority-neutral"
              }`}
            >
              긴급 {priorityCounts.urgent}건
            </button>
            <button
              type="button"
              aria-pressed={queuePriorityFilter === "today"}
              onClick={() => setQueuePriorityFilter("today")}
              className={`crm-priority-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                queuePriorityFilter === "today"
                  ? "crm-priority-today crm-priority-chip-active"
                  : "crm-priority-neutral"
              }`}
            >
              오늘 처리 {priorityCounts.today}건
            </button>
            <button
              type="button"
              aria-pressed={queuePriorityFilter === "general"}
              onClick={() => setQueuePriorityFilter("general")}
              className={`crm-priority-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                queuePriorityFilter === "general"
                  ? "crm-priority-general crm-priority-chip-active"
                  : "crm-priority-neutral"
              }`}
            >
              일반 {priorityCounts.general}건
            </button>
          </div>
          {isError ? (
            <ErrorState
              title="알림 업무를 불러오지 못했습니다."
              description="미확인 알림을 0건으로 표시하지 않고 있습니다. 다시 시도해 주세요."
              retryLabel="다시 시도"
              onRetry={retryTodayWork}
              className="py-6"
            />
          ) : sortedPendingNotifications.length === 0 ? (
            <EmptyState
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/notifications")}>
                  알림센터에서 전체 확인
                </Button>
              }
            >
              {queuePriorityFilter === "all" ? "즉시 처리할 미확인 알림이 없습니다. 오늘 일정과 후속관리만 확인하면 됩니다." : "선택한 우선순위 알림이 없습니다. 다른 우선순위 큐를 확인해보세요."}
            </EmptyState>
          ) : (
            sortedPendingNotifications.slice(0, 3).map((notification) => {
              const priority = classifyNotificationPriority(notification);
              return (
                <div key={notification.id} className="crm-dashboard-card rounded-xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{notification.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      priority === "urgent"
                        ? "crm-priority-urgent"
                        : priority === "today"
                          ? "crm-priority-today"
                          : "crm-priority-general"
                    }`}>
                      {priority === "urgent" ? "긴급" : priority === "today" ? "오늘 처리" : "일반"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={markReadMutation.isPending}
                        onClick={() => markReadMutation.mutate({ id: notification.id })}
                      >
                        읽음
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={completeMutation.isPending}
                        onClick={() => completeMutation.mutate({ id: notification.id, processStatus: "처리완료" })}
                      >
                        처리완료
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {notification.customerName ? `${notification.customerName} · ` : ""}
                    {getDashboardNotificationTypeLabel(notification.type)}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="crm-dashboard-card overflow-hidden border-l-[3px] border-l-sidebar-primary">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ring/40 bg-ring/[0.08] text-foreground">
                <Target className="h-4 w-4" />
              </span>
              오늘 우선 연락 고객
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">후속관리, 우선순위, 경고 기준으로 먼저 볼 고객을 정리했습니다.</p>
          </div>
          <div className="hidden grid-cols-3 gap-2 text-xs sm:grid">
            <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-center">
              <p className="text-muted-foreground">추천</p>
              <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">{isRecommendationError ? "-" : recommendationSummary?.priorityContactCount ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-center">
              <p className="text-muted-foreground">긴급</p>
              <p className="text-lg font-bold tabular-nums tracking-tight text-red-600 dark:text-red-400">{isRecommendationError ? "-" : recommendationSummary?.highUrgencyCount ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-center">
              <p className="text-muted-foreground">경고</p>
              <p className="text-lg font-bold tabular-nums tracking-tight text-amber-800 dark:text-amber-300">{isRecommendationError ? "-" : recommendationSummary?.warningCount ?? 0}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isRecommendationError ? (
            <ErrorState
              title="우선 연락 고객을 불러오지 못했습니다."
              description="추천 고객이 없는 상태와 구분해 표시하고 있습니다."
              retryLabel="다시 시도"
              onRetry={retryRecommendationSummary}
              className="py-6"
            />
          ) : topContacts.length === 0 ? (
            <EmptyState
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/customers")}>
                  고객 DB에서 확인하기
                </Button>
              }
            >
              오늘 우선 연락 추천 고객이 없습니다. 고객 DB에서 미상담 또는 장기 미관리 고객을 확인하세요.
            </EmptyState>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {topContacts.slice(0, 5).map((contact) => (
                <div key={contact.customerId} className="crm-dashboard-action rounded-lg border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{contact.customerName}</span>
                    <Badge className={contact.urgency === "high" ? "border-0 bg-red-100 text-red-700" : contact.urgency === "medium" ? "border-0 bg-amber-100 text-amber-700" : "border-0 bg-slate-100 text-slate-600"}>
                      {contact.urgency === "high" ? "높음" : contact.urgency === "medium" ? "중간" : "낮음"}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{contact.reasons.slice(0, 2).join(" · ") || contact.recommendedAction}</p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setLocation(`/customers/${contact.customerId}`)}>
                      상세
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setLocation(`/customers/${contact.customerId}?action=consult`)}>
                      상담
                    </Button>
                    <Button type="button" size="sm" className="h-8 px-2 text-xs" onClick={() => setLocation(`/customers/${contact.customerId}?action=followup`)}>
                      후속
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SectionCard title="오늘의 일정" icon={CalendarDays} action={<button type="button" onClick={() => setLocation("/calendar")} className="text-xs font-semibold text-primary hover:underline">전체 보기</button>}>
          {isError ? (
            <ErrorState
              title="오늘 일정을 불러오지 못했습니다."
              description="일정이 없는 상태와 구분해 표시하고 있습니다."
              retryLabel="다시 시도"
              onRetry={retryTodayWork}
              className="py-6"
            />
          ) : (data?.todaySchedules ?? []).length === 0 ? (
            <EmptyState
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/calendar")}>
                  일정 캘린더 열기
                </Button>
              }
            >
              오늘 예정된 일정이 없습니다. 상담 예약이나 후속관리 일정을 등록해보세요.
            </EmptyState>
          ) : data?.todaySchedules.slice(0, 5).map((schedule) => (
            <button key={schedule.id} type="button" onClick={() => setLocation("/calendar")} className="crm-dashboard-action w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{schedule.title}</span>
                <StatusBadge status={schedule.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatKstLocalDateTime(schedule.startTime, { seconds: false }).slice(11, 16)} · {schedule.type}
              </p>
            </button>
          ))}
        </SectionCard>

        <SectionCard title="중요 알림" icon={Bell} action={<button type="button" onClick={() => setLocation("/notifications")} className="text-xs font-semibold text-primary hover:underline">알림센터</button>}>
          {isError ? (
            <ErrorState
              title="중요 알림을 불러오지 못했습니다."
              description="알림이 없는 상태와 구분해 표시하고 있습니다."
              retryLabel="다시 시도"
              onRetry={retryTodayWork}
              className="py-6"
            />
          ) : (data?.pendingNotifications ?? []).length === 0 ? (
            <EmptyState
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/notifications")}>
                  알림센터로 이동
                </Button>
              }
            >
              미확인 알림이 없습니다. 일정 알림은 설정한 시각에 표시됩니다.
            </EmptyState>
          ) : data?.pendingNotifications.slice(0, 5).map((notification) => (
            <button key={notification.id} type="button" onClick={() => setLocation("/notifications")} className="crm-dashboard-action w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{notification.title}</span>
                <span className="text-[11px] text-muted-foreground">{getStatusLabel(notification.processStatus)}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {notification.customerName ? `${notification.customerName} · ` : ""}{getDashboardNotificationTypeLabel(notification.type)}
              </p>
            </button>
          ))}
        </SectionCard>

        <SectionCard title="장기 미관리 고객" icon={Users}>
          {isError ? (
            <ErrorState
              title="장기 미관리 고객을 불러오지 못했습니다."
              description="고객이 없는 상태와 구분해 표시하고 있습니다."
              retryLabel="다시 시도"
              onRetry={retryTodayWork}
              className="py-6"
            />
          ) : (data?.longUnmanagedCustomers ?? []).filter(Boolean).length === 0 ? (
            <EmptyState
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/customers")}>
                  고객 DB 보기
                </Button>
              }
            >
              장기 미관리 고객이 없습니다.
            </EmptyState>
          ) : data?.longUnmanagedCustomers.filter(Boolean).slice(0, 5).map((customer) => (
            <button key={customer.id} type="button" onClick={() => setLocation(`/customers/${customer.id}`)} className="crm-dashboard-action w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{customer.name}</span>
                <StatusBadge status={customer.consultStatus} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">알림 생성일 {new Date(customer.createdAt).toLocaleDateString("ko-KR")}</p>
            </button>
          ))}
        </SectionCard>

        <SectionCard title="오늘 연락 대상" icon={Phone}>
          {isError ? (
            <ErrorState
              title="오늘 연락 대상을 불러오지 못했습니다."
              description="연락 대상이 없는 상태와 구분해 표시하고 있습니다."
              retryLabel="다시 시도"
              onRetry={retryTodayWork}
              className="py-6"
            />
          ) : (data?.todayFollowUps ?? []).length === 0 ? (
            <EmptyState
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/customers")}>
                  고객 목록에서 후속관리 확인
                </Button>
              }
            >
              오늘 연락할 고객이 없습니다.
            </EmptyState>
          ) : data?.todayFollowUps.slice(0, 5).map((followUp) => (
            <button key={followUp.id} type="button" onClick={() => setLocation(`/customers/${followUp.customerId}`)} className="crm-dashboard-action w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{followUp.customerName ?? `고객 #${followUp.customerId}`}</span>
                <span className="text-[11px] text-muted-foreground">{followUp.nextAction}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{followUp.reason}</p>
            </button>
          ))}
        </SectionCard>
      </div>
    </section>
  );
}
