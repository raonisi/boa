import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { getStatusLabel, StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/empty-state";
import { classifyNotificationPriority, sortNotificationsForQueue } from "@/lib/notificationPriority";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowUp,
  BellDot,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LayoutGrid,
  Phone,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function formatNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return "0";
  if (typeof value === "number") return value.toLocaleString();
  return value;
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

function PremiumStatCard({
  title,
  value,
  icon: Icon,
  tone = "navy",
  helper,
  suffix = "",
}: {
  title: string;
  value: number | string | undefined;
  icon: React.ElementType;
  tone?: "navy" | "gold" | "green" | "orange" | "red" | "blue";
  helper?: string;
  suffix?: string;
}) {
  const toneClass = {
    navy: "border border-primary/35 bg-primary/[0.07] text-primary",
    gold: "border border-ring/45 bg-ring/[0.09] text-foreground",
    green: "border border-emerald-600/30 bg-emerald-600/[0.08] text-emerald-800 dark:text-emerald-200",
    orange: "border border-orange-500/30 bg-orange-500/[0.08] text-orange-800 dark:text-orange-200",
    red: "border border-red-500/30 bg-red-500/[0.08] text-red-800 dark:text-red-200",
    blue: "border border-primary/25 bg-primary/[0.06] text-primary",
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {formatNumber(value)}
              {suffix ? <span className="ml-1 text-sm font-semibold text-muted-foreground">{suffix}</span> : null}
            </p>
            {helper ? <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p> : null}
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

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
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

function TodayWorkSection({ userName, role, roleTitle }: { userName?: string | null; role?: string; roleTitle: string }) {
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
    const next = new Date();
    next.setDate(next.getDate() + days);
    if (days === 0) {
      next.setHours(next.getHours() + 2, 0, 0, 0);
    } else {
      next.setHours(10, 0, 0, 0);
    }
    return next.toISOString();
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
        ? `${new Date(task.startTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · ${task.type}`
        : task.taskType === "notification"
          ? `${task.type}${task.customerName ? ` · ${task.customerName}` : ""}`
          : `${task.consultStatus ?? "고객"} · 기존 기준 점검`;
    return (
      <button
        key={`${task.taskType}-${task.id}`}
        type="button"
        onClick={() => setSelectedTask(task)}
        className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm active:bg-muted/50"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{task.priorityLabel}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{description}</p>
      </button>
    );
  };

  return (
    <section className="space-y-5">
      <Card className="overflow-hidden border-primary/15 shadow-sm">
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
                  className="rounded-lg border border-border/80 bg-muted/30 p-3 text-left shadow-sm transition hover:border-sidebar-primary/40 hover:bg-muted/45"
                >
                  <p className="text-[11px] font-medium text-muted-foreground">{item.label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${item.tone}`}>{isLoading || isError ? "-" : item.value}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button type="button" onClick={() => setLocation(primaryCommandPath)} className="min-h-10 gap-2 rounded-lg">
                <BellDot className="h-4 w-4" />
                {hasImmediateWork ? primaryCommandLabel : "일정 등록하기"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation("/sales-pipeline")} className="min-h-10 gap-2 rounded-lg">
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
                  className={`rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}
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

      <Card className="md:hidden shadow-sm">
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

      <Card className="md:hidden shadow-sm">
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
            <EmptyState action={<Button type="button" size="sm" variant="outline" onClick={() => setLocation("/calendar")}>일정 등록</Button>}>
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

      <Sheet open={Boolean(selectedTask)} onOpenChange={(open) => { if (!open) closeTaskSheet(); }}>
        <SheetContent side="bottom" className="max-h-[min(90vh,42rem)] overflow-y-auto overscroll-contain rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">{taskTitle}</SheetTitle>
            <SheetDescription>
              카드 선택 → 빠른 처리 → 저장 흐름으로 고객 상세 이동 없이 업무를 마칩니다.
            </SheetDescription>
          </SheetHeader>
          {selectedTask && (
            <div className="mt-4 space-y-3">
              {selectedTask.taskType === "followUp" && (
                <>
                  {confirmAction === "cancelFollowUp" && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <p className="font-semibold">후속관리를 취소할까요?</p>
                      <p className="mt-1 text-xs">취소된 후속관리는 오늘 할 일에서 제외됩니다.</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" className="bg-white" onClick={() => setConfirmAction(null)} disabled={isTaskBusy}>
                          돌아가기
                        </Button>
                        <Button
                          type="button"
                          className="bg-red-700 text-white hover:bg-red-800"
                          disabled={isTaskBusy}
                          onClick={() => runTask(`followup-cancel-${selectedTask.id}`, () => followUpCancelMutation.mutateAsync({ id: selectedTask.id }), "처리했습니다.")}
                        >
                          취소 확정
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      className="min-h-12"
                      disabled={isTaskBusy}
                      onClick={() => runTask(`followup-complete-${selectedTask.id}`, () => followUpCompleteMutation.mutateAsync({ id: selectedTask.id }), "처리했습니다.")}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" /> 완료
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12"
                      disabled={isTaskBusy}
                      onClick={() => setLocation(`/customers/${selectedTask.customerId}?action=consult`)}
                    >
                      상담기록
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12"
                      disabled={isTaskBusy}
                      onClick={() => setLocation(`/customers/${selectedTask.customerId}`)}
                    >
                      고객상세
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 text-red-700"
                      disabled={isTaskBusy}
                      onClick={() => setConfirmAction("cancelFollowUp")}
                    >
                      <XCircle className="mr-1 h-4 w-4" /> 취소
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/25 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">연기</p>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {[{ label: "오늘", days: 0 }, { label: "내일", days: 1 }, { label: "3일 후", days: 3 }, { label: "1주 후", days: 7 }].map((item) => (
                        <Button
                          key={item.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isTaskBusy}
                          onClick={() => runTask(`followup-postpone-${selectedTask.id}`, () => followUpPostponeMutation.mutateAsync({ id: selectedTask.id, nextContactDate: postponedDate(item.days), reason: selectedTask.reason }), "연기했습니다.")}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label className="text-xs">직접 선택</Label>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input className="min-h-11" type="datetime-local" value={customPostponeDate} onChange={(event) => { setPostponeMode("custom"); setCustomPostponeDate(event.target.value); }} />
                        <Button
                          type="button"
                          className="min-h-11"
                          disabled={isTaskBusy || postponeMode !== "custom" || !customPostponeDate}
                          onClick={() => runTask(`followup-custom-${selectedTask.id}`, () => followUpPostponeMutation.mutateAsync({ id: selectedTask.id, nextContactDate: customPostponeDate, reason: selectedTask.reason }), "연기했습니다.")}
                        >
                          저장
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {selectedTask.taskType === "schedule" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => runTask(`schedule-complete-${selectedTask.id}`, () => scheduleUpdateMutation.mutateAsync({ id: selectedTask.id, status: "완료" }), "처리했습니다.")}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> 완료
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => setLocation("/calendar")}>일정 보기</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => setLocation("/customers")}>상담기록</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={closeTaskSheet}>닫기</Button>
                </div>
              )}
              {selectedTask.taskType === "notification" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => runTask(`notification-read-${selectedTask.id}`, async () => {
                      await completeMutation.mutateAsync({ id: selectedTask.id, processStatus: "확인" });
                      await markReadMutation.mutateAsync({ id: selectedTask.id });
                    }, "처리했습니다.")}
                  >
                    확인
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => runTask(`notification-complete-${selectedTask.id}`, async () => {
                      await completeMutation.mutateAsync({ id: selectedTask.id, processStatus: "처리완료" });
                      await markReadMutation.mutateAsync({ id: selectedTask.id });
                    }, "처리했습니다.")}
                  >
                    처리완료
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => setLocation("/notifications")}>알림센터</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={closeTaskSheet}>닫기</Button>
                </div>
              )}
              {selectedTask.taskType === "customer" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => runTask(`customer-status-${selectedTask.id}`, () => customerUpdateMutation.mutateAsync({ id: selectedTask.id, consultStatus: "통화완료" }), "처리했습니다.")}
                  >
                    연락완료
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => runTask(`customer-absent-${selectedTask.id}`, () => customerUpdateMutation.mutateAsync({ id: selectedTask.id, consultStatus: "부재" }), "처리했습니다.")}
                  >
                    부재
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => setLocation(`/customers/${selectedTask.id}?action=consult`)}>상담기록</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => setLocation(`/customers/${selectedTask.id}`)}>고객상세</Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Card className="shadow-sm">
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
              <div key={item.title} className={`rounded-lg border p-3 shadow-sm ${item.tone}`}>
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
                <div key={notification.id} className="crm-elevated-card p-3">
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

      <Card className="overflow-hidden border-l-[3px] border-l-sidebar-primary shadow-sm">
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
                <div key={contact.customerId} className="rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-sidebar-primary/40 hover:bg-muted/35">
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
            <button key={schedule.id} type="button" onClick={() => setLocation("/calendar")} className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{schedule.title}</span>
                <StatusBadge status={schedule.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(schedule.startTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {schedule.type}
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
            <button key={notification.id} type="button" onClick={() => setLocation("/notifications")} className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:bg-muted/40">
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
            <button key={customer.id} type="button" onClick={() => setLocation(`/customers/${customer.id}`)} className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:bg-muted/40">
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
            <button key={followUp.id} type="button" onClick={() => setLocation(`/customers/${followUp.customerId}`)} className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:bg-muted/40">
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

function PerformanceGoalSummaryCard() {
  const [, setLocation] = useLocation();
  const { data } = trpc.performanceGoals.dashboard.useQuery({});
  const firstGoal = data?.items?.[0];

  if (!firstGoal) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">이번 달 목표</p>
            <p className="mt-1 text-xs text-muted-foreground">설정된 목표가 없습니다.</p>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            목표관리 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/12 shadow-sm">
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-sidebar-primary/40 bg-sidebar-primary/12 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">목표 대비 성과</p>
              <p className="text-xs text-muted-foreground">{firstGoal.targetLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">신규 계약 달성률</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.achievementRate.contractCount ?? "-"}%</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">월납 달성률</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.achievementRate.monthlyPremium ?? "-"}%</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">부족 신규 계약</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.remaining.contractCount}건</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">남은 기간</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.remainingDays}일</p>
            </div>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            자세히 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkRhythmSummaryCard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.workRhythm.summary.useQuery({ period: "week" });

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <BarChart3 className="h-4 w-4" />
          </span>
          업무 리듬 리포트
        </CardTitle>
        <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs font-semibold text-primary hover:underline">
          목표관리
        </button>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">이번 주 상담기록</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.consultationCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">후속관리 완료율</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{data?.followUpCompletionRate ?? "-"}%</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">미처리 후속관리</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.overdueFollowUpCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">오늘 필요 상담</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.recommendedTodayActions?.suggestedConsultationCount ?? 0}</p>
          </div>
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">목표까지 부족 신규 계약</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{data?.remaining?.contractCount ?? 0}건</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">목표까지 부족 월납보험료</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{formatWon(data?.remaining?.monthlyPremium)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">일평균 필요 신규 계약</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{data?.dailyRequired?.contractCount ?? 0}건</p>
          </div>
        </div>
        {(data?.insights ?? []).length > 0 ? (
          <div className="space-y-1 rounded-lg border border-border/80 bg-muted/35 p-3 text-xs text-foreground">
            {data?.insights.slice(0, 3).map((item) => <p key={item}>· {item}</p>)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { data: stats } = trpc.performance.stats.useQuery();
  const { data: myBranchAdminStats } = trpc.performance.stats.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });
  const { data: customers } = trpc.customers.list.useQuery({}, { enabled: user?.role === "branch_admin" });
  const { data: myBranchAdminCustomers } = trpc.customers.list.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });

  const roleTitle =
    user?.role === "branch_admin" ? "지점장" :
    user?.role === "sub_branch_admin" ? "부지점장" :
    user?.role === "team_leader" ? "팀장" : "팀원";

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 520);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TodayWorkSection userName={user?.name} role={user?.role} roleTitle={roleTitle} />

        {user?.role === "branch_admin" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PremiumStatCard title="내 DB" value={myBranchAdminCustomers?.length ?? 0} icon={Users} tone="blue" helper="지점장 직접 담당" />
            <PremiumStatCard title="내 신규 계약" value={myBranchAdminStats?.newContractCount ?? myBranchAdminStats?.contractCount ?? myBranchAdminStats?.contracted ?? 0} icon={FileText} tone="green" helper="내 담당 기준" />
            <PremiumStatCard title="내 월납보험료 실적" value={formatWon(myBranchAdminStats?.monthlyPremiumTotal ?? myBranchAdminStats?.monthlyPremiumSum)} icon={WalletCards} tone="gold" helper="내 담당 기준" />
            <PremiumStatCard title="전체 DB" value={customers?.length ?? 0} icon={Users} tone="navy" helper="지점 전체 권한" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PremiumStatCard title="배정 DB" value={stats?.assigned} icon={Users} tone="navy" helper="권한 범위 기준" />
          <PremiumStatCard title="미상담" value={stats?.uncontacted} icon={AlertCircle} tone="orange" helper="초기 접촉 필요" />
          <PremiumStatCard title="신규 계약" value={stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted} icon={FileText} tone="green" helper="신규 영업 성과" />
          <PremiumStatCard title="월납보험료 실적" value={formatWon(stats?.monthlyPremiumTotal ?? stats?.monthlyPremiumSum)} icon={TrendingUp} tone="blue" helper="입력 계약 기준" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <PerformanceGoalSummaryCard />
          <WorkRhythmSummaryCard />
        </div>
        {showBackToTop ? (
        <div className="fixed bottom-24 right-4 z-40 md:hidden">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 rounded-full border border-border shadow-md"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="맨 위로"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
