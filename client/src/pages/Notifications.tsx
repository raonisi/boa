import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getPageRowSelectionLabel,
  getPageSelectAllLabel,
} from "@/lib/checkboxA11yLabels";
import { classifyNotificationPriority } from "@/lib/notificationPriority";
import { trpc } from "@/lib/trpc";
import {
  getUserFacingErrorMessage,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { MOBILE_STATE_UX } from "@/lib/stateUxCopy";
import {
  getNotificationActionCopy,
  resolveNotificationTarget,
  type NotificationActionCenterItem,
  type NotificationCategory,
} from "@shared/notificationActionCenter";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Settings,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  contract_90: "계약 90일 점검",
  contract_180: "계약 180일 점검",
  contract_365: "계약 365일 점검",
  birthday: "생일 알림",
  uncontacted_3days: "3일 미상담",
  long_unmanaged_90: "90일 장기 미관리",
  reconsult: "재상담 알림",
  unpaid_lapse: "미납·실효 알림",
  schedule_1day: "일정 하루 전",
  schedule_today: "일정 당일",
  schedule_1hour: "일정 1시간 전",
  schedule_incomplete: "미완료 일정",
  customer_assigned: "고객 DB 배정",
  general: "일반",
};

const processStatusColors: Record<string, string> = {
  미확인: "border-l-primary bg-primary/5",
  확인: "border-l-blue-400 bg-blue-50/60 dark:bg-blue-950/30",
  처리완료:
    "border-l-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/25 opacity-70",
  보류: "border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/25",
};

type ProcessStatus = "미확인" | "확인" | "처리완료" | "보류";
type PriorityFilter = "all" | "urgent" | "today" | "general" | "done";
type ActionFilter = "all" | "required" | "informational";
type BulkCompleteConfirmation = {
  ids: number[];
  action: "complete" | "todayComplete";
};

export function createBulkCompleteConfirmation(
  ids: number[],
  action: "complete" | "todayComplete" = "complete"
): BulkCompleteConfirmation | null {
  if (ids.length === 0) return null;
  return { ids, action };
}

export function getBulkSelectionCheckboxState(input: {
  allVisibleSelected: boolean;
  selectedVisibleCount: number;
}): boolean | "indeterminate" {
  if (input.allVisibleSelected) return true;
  if (input.selectedVisibleCount > 0) return "indeterminate";
  return false;
}

const titleMap: Record<string, string> = {
  branch_admin: "전체 알림 관리",
  sub_branch_admin: "본인 산하 알림 관리",
  team_leader: "본인 팀 알림 관리",
  member: "내 알림",
};

const LIMIT = 50;

type NotificationUrlState = {
  priority: PriorityFilter;
  category: NotificationCategory;
  action: ActionFilter;
  processStatus: string;
  read: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  offset: number;
};

const notificationCategories: NotificationCategory[] = [
  "all",
  "schedule",
  "customer_follow_up",
  "approval_admin",
  "system",
];

export function parseNotificationUrlState(
  location: string
): NotificationUrlState {
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const priority = params.get("priority") as PriorityFilter | null;
  const category = params.get("category") as NotificationCategory | null;
  const action = params.get("action") as ActionFilter | null;
  const processStatus = params.get("status") ?? "all";
  const read = params.get("read") ?? "all";
  const type = params.get("type") ?? "all";
  const offsetValue = Number(params.get("offset") ?? 0);
  return {
    priority: ["all", "urgent", "today", "general", "done"].includes(
      priority ?? ""
    )
      ? (priority as PriorityFilter)
      : "all",
    category: notificationCategories.includes(category ?? "all")
      ? (category ?? "all")
      : "all",
    action: ["all", "required", "informational"].includes(action ?? "")
      ? (action as ActionFilter)
      : "all",
    processStatus: ["미확인", "확인", "처리완료", "보류"].includes(
      processStatus
    )
      ? processStatus
      : "all",
    read: ["all", "unread", "read"].includes(read) ? read : "all",
    type: type in typeLabels ? type : "all",
    dateFrom: params.get("from") ?? "",
    dateTo: params.get("to") ?? "",
    offset: Number.isInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0,
  };
}

export function buildNotificationUrlState(state: NotificationUrlState) {
  const params = new URLSearchParams();
  if (state.category !== "all") params.set("category", state.category);
  if (state.action !== "all") params.set("action", state.action);
  if (state.priority !== "all") params.set("priority", state.priority);
  if (state.processStatus !== "all") params.set("status", state.processStatus);
  if (state.read !== "all") params.set("read", state.read);
  if (state.type !== "all") params.set("type", state.type);
  if (state.dateFrom) params.set("from", state.dateFrom);
  if (state.dateTo) params.set("to", state.dateTo);
  if (state.offset > 0) params.set("offset", String(state.offset));
  const query = params.toString();
  return query ? `/notifications?${query}` : "/notifications";
}

function priorityLabel(priority: "urgent" | "today" | "general" | "done") {
  return priority === "urgent"
    ? "긴급"
    : priority === "today"
      ? "오늘 처리"
      : priority === "done"
        ? "알림 정리"
        : "일반";
}

function priorityCardClass(priority: PriorityFilter, active: boolean) {
  if (priority === "urgent")
    return active
      ? "border-red-300 bg-red-50 text-red-800"
      : "border-red-100 bg-white hover:bg-red-50/60";
  if (priority === "today")
    return active
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-amber-100 bg-white hover:bg-amber-50/60";
  if (priority === "done")
    return active
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : "border-emerald-100 bg-white hover:bg-emerald-50/60";
  return active
    ? "border-slate-300 bg-slate-100 text-slate-900"
    : "border-slate-200 bg-white hover:bg-slate-50";
}

export default function Notifications() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const notificationLocation = `${location}${search ? `?${search}` : ""}`;
  const initialUrlState = parseNotificationUrlState(notificationLocation);

  // 서버 사이드 필터 상태
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(
    initialUrlState.priority
  );
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory>(
    initialUrlState.category
  );
  const [actionFilter, setActionFilter] = useState<ActionFilter>(
    initialUrlState.action
  );
  const [processStatusFilter, setProcessStatusFilter] = useState<string>(
    initialUrlState.processStatus
  );
  const [isReadFilter, setIsReadFilter] = useState<string>(
    initialUrlState.read
  );
  const [typeFilter, setTypeFilter] = useState<string>(initialUrlState.type);
  const [dateFrom, setDateFrom] = useState(initialUrlState.dateFrom);
  const [dateTo, setDateTo] = useState(initialUrlState.dateTo);
  const [offset, setOffset] = useState(initialUrlState.offset);
  const [showMarkAllReadDialog, setShowMarkAllReadDialog] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<
    number[]
  >([]);
  const [bulkAction, setBulkAction] = useState<
    "read" | "complete" | "todayComplete" | null
  >(null);
  const [bulkCompleteConfirmation, setBulkCompleteConfirmation] =
    useState<BulkCompleteConfirmation | null>(null);

  useEffect(() => {
    if (!location.startsWith("/notifications")) return;

    const next = parseNotificationUrlState(notificationLocation);
    setPriorityFilter(next.priority);
    setCategoryFilter(next.category);
    setActionFilter(next.action);
    setProcessStatusFilter(next.processStatus);
    setIsReadFilter(next.read);
    setTypeFilter(next.type);
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setOffset(next.offset);
    setSelectedNotificationIds([]);
  }, [location, notificationLocation]);

  useEffect(() => {
    const nextLocation = buildNotificationUrlState({
      priority: priorityFilter,
      category: categoryFilter,
      action: actionFilter,
      processStatus: processStatusFilter,
      read: isReadFilter,
      type: typeFilter,
      dateFrom,
      dateTo,
      offset,
    });
    if (nextLocation !== notificationLocation) {
      setLocation(nextLocation, { replace: true });
    }
    // Filter state is initialized from the URL; subsequent changes own it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actionFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    isReadFilter,
    offset,
    priorityFilter,
    processStatusFilter,
    typeFilter,
  ]);

  const queryInput = {
    processStatus:
      processStatusFilter !== "all" ? processStatusFilter : undefined,
    isRead:
      isReadFilter === "unread"
        ? false
        : isReadFilter === "read"
          ? true
          : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    category: categoryFilter,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    actionRequired:
      actionFilter === "required"
        ? true
        : actionFilter === "informational"
          ? false
          : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: LIMIT,
    offset,
  };

  const {
    data: result,
    isLoading: isNotificationsLoading,
    isError: isNotificationsError,
    refetch: refetchNotifications,
  } = trpc.notifications.list.useQuery(queryInput);
  const notifications: NotificationActionCenterItem[] =
    (result?.items as NotificationActionCenterItem[] | undefined) ?? [];
  const sortedNotifications = notifications;
  const priorityCounts = {
    urgent: result?.counts?.byPriority?.urgent ?? 0,
    today: result?.counts?.byPriority?.today ?? 0,
    general: result?.counts?.byPriority?.general ?? 0,
    done: result?.counts?.byPriority?.done ?? 0,
  };
  const totalCount = result?.totalCount ?? 0;
  const hasMore = result?.hasMore ?? false;
  const totalPages = Math.ceil(totalCount / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const pageVisibleCount = notifications.length;

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      utils.notifications.myUnreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      setShowMarkAllReadDialog(false);
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      utils.notifications.myUnreadCount.invalidate();
      toast.success("내 알림이 모두 읽음 처리되었습니다.");
    },
  });

  const updateStatusMutation =
    trpc.notifications.updateProcessStatus.useMutation({
      onSuccess: () => {
        utils.notifications.list.invalidate();
        utils.notifications.unreadCount.invalidate();
        utils.notifications.myUnreadCount.invalidate();
      },
      onError: () => toast.error("상태 변경에 실패했습니다."),
    });

  const unreadCount = result?.counts?.unread ?? 0;
  const actionQueueCount = result?.counts?.actionRequired ?? 0;
  const completedCount = notifications.filter(
    n => n.processStatus === "처리완료"
  ).length;
  const visibleNotificationIds = sortedNotifications.map(n => n.id);
  const selectedVisibleIds = selectedNotificationIds.filter(id =>
    visibleNotificationIds.includes(id)
  );
  const selectedCount = selectedVisibleIds.length;
  const allVisibleSelected =
    visibleNotificationIds.length > 0 &&
    visibleNotificationIds.every(id => selectedNotificationIds.includes(id));
  const todayProcessingTargets = sortedNotifications.filter(
    n =>
      classifyNotificationPriority(n) === "today" &&
      n.processStatus !== "처리완료"
  );
  const isBulkPending =
    bulkAction !== null ||
    markReadMutation.isPending ||
    updateStatusMutation.isPending;

  const handleMarkAllRead = () => {
    setShowMarkAllReadDialog(true);
  };

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setOffset(0); // 필터 변경 시 첫 페이지로
    setSelectedNotificationIds([]);
  };

  const toggleNotificationSelection = (id: number, checked: boolean) => {
    setSelectedNotificationIds(current =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter(selectedId => selectedId !== id)
    );
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedNotificationIds(current => {
      const hiddenSelection = current.filter(
        id => !visibleNotificationIds.includes(id)
      );
      return checked
        ? [...hiddenSelection, ...visibleNotificationIds]
        : hiddenSelection;
    });
  };

  const handleBulkMarkRead = async () => {
    if (selectedVisibleIds.length === 0) return;
    setBulkAction("read");
    try {
      await Promise.all(
        selectedVisibleIds.map(id => markReadMutation.mutateAsync({ id }))
      );
      setSelectedNotificationIds([]);
      await Promise.all([
        utils.notifications.list.invalidate(),
        utils.notifications.unreadCount.invalidate(),
        utils.notifications.myUnreadCount.invalidate(),
      ]);
      toast.success(`${selectedVisibleIds.length}개 알림을 읽음 처리했습니다.`);
    } catch {
      toast.error("선택 알림 읽음 처리에 실패했습니다.");
    } finally {
      setBulkAction(null);
    }
  };

  const openBulkCompleteConfirmation = (
    ids: number[],
    action: "complete" | "todayComplete" = "complete"
  ) => {
    setBulkCompleteConfirmation(createBulkCompleteConfirmation(ids, action));
  };

  const confirmBulkComplete = async () => {
    if (!bulkCompleteConfirmation) return;
    const { ids, action } = bulkCompleteConfirmation;
    setBulkAction(action);
    try {
      await Promise.all(
        ids.map(id =>
          updateStatusMutation.mutateAsync({ id, processStatus: "처리완료" })
        )
      );
      setSelectedNotificationIds([]);
      await Promise.all([
        utils.notifications.list.invalidate(),
        utils.notifications.unreadCount.invalidate(),
        utils.notifications.myUnreadCount.invalidate(),
      ]);
      toast.success(`${ids.length}개 알림 기록을 정리했습니다.`);
      setBulkCompleteConfirmation(null);
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "선택 알림 기록 정리에 실패했습니다.")
      );
    } finally {
      setBulkAction(null);
    }
  };

  const activeFilterChips = [
    categoryFilter !== "all"
      ? {
          key: "category",
          label: `분류: ${
            categoryFilter === "schedule"
              ? "일정"
              : categoryFilter === "customer_follow_up"
                ? "고객·후속관리"
                : categoryFilter === "approval_admin"
                  ? "승인·관리"
                  : "시스템"
          }`,
          clear: () => {
            setCategoryFilter("all");
            setOffset(0);
          },
        }
      : null,
    actionFilter !== "all"
      ? {
          key: "actionRequired",
          label: actionFilter === "required" ? "처리 필요" : "확인용 알림",
          clear: () => {
            setActionFilter("all");
            setOffset(0);
          },
        }
      : null,
    priorityFilter !== "all"
      ? {
          key: "priority",
          label: `우선순위: ${priorityLabel(priorityFilter)}`,
          clear: () => {
            setPriorityFilter("all");
            setOffset(0);
          },
        }
      : null,
    processStatusFilter !== "all"
      ? {
          key: "processStatus",
          label: `알림 기록 상태: ${processStatusFilter}`,
          clear: () => {
            setProcessStatusFilter("all");
            setOffset(0);
          },
        }
      : null,
    isReadFilter !== "all"
      ? {
          key: "isRead",
          label: isReadFilter === "unread" ? "읽음: 읽지 않음" : "읽음: 읽음",
          clear: () => {
            setIsReadFilter("all");
            setOffset(0);
          },
        }
      : null,
    typeFilter !== "all"
      ? {
          key: "type",
          label: `알림 유형: ${typeLabels[typeFilter] ?? typeFilter}`,
          clear: () => {
            setTypeFilter("all");
            setOffset(0);
          },
        }
      : null,
    dateFrom
      ? {
          key: "dateFrom",
          label: `시작일: ${dateFrom}`,
          clear: () => {
            setDateFrom("");
            setOffset(0);
          },
        }
      : null,
    dateTo
      ? {
          key: "dateTo",
          label: `종료일: ${dateTo}`,
          clear: () => {
            setDateTo("");
            setOffset(0);
          },
        }
      : null,
  ].filter((chip): chip is { key: string; label: string; clear: () => void } =>
    Boolean(chip)
  );
  const hasActiveFilters = activeFilterChips.length > 0;
  const clearFilters = () => {
    setCategoryFilter("all");
    setActionFilter("all");
    setPriorityFilter("all");
    setProcessStatusFilter("all");
    setIsReadFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-2 pb-[max(5rem,env(safe-area-inset-bottom))] sm:space-y-5">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="flex items-start justify-between gap-3 p-3 sm:items-center sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ring">
                오늘 업무 알림
              </p>
              <h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                {titleMap[user?.role ?? ""] ?? "알림센터"}
              </h1>
              <p
                className="mt-1 text-sm text-muted-foreground"
                aria-live="polite"
              >
                처리 필요 {actionQueueCount}건 · 읽지 않음 {unreadCount}건 ·
                현재 페이지 알림 정리 {completedCount}건
              </p>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                전체 {totalCount.toLocaleString()}건 중{" "}
                {pageVisibleCount.toLocaleString()}건을 불러왔습니다. 처리 필요
                여부는 원본 업무의 현재 상태를 기준으로 계산합니다.
              </p>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                미래 일정 알림은 설정한 알림 시간이 되면 표시됩니다.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  className="min-h-10 min-w-10 p-0 sm:min-h-8 sm:w-auto sm:px-3"
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
                  aria-label="내 알림 모두 읽음"
                >
                  <CheckCheck className="h-4 w-4 sm:mr-1" />
                  <span className="sr-only sm:not-sr-only">
                    내 알림 모두 읽음
                  </span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-2 sm:p-3">
              <p className="text-[11px] font-semibold text-muted-foreground sm:text-xs">
                전체 검색 결과
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground sm:text-xl">
                {totalCount.toLocaleString()}건
              </p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                서버 필터 적용 결과
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-2 sm:p-3">
              <p className="text-[11px] font-semibold text-muted-foreground sm:text-xs">
                현재 페이지
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground sm:text-xl">
                {pageVisibleCount.toLocaleString()}건
              </p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                페이지 {currentPage.toLocaleString()} /{" "}
                {Math.max(totalPages, 1).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
            <CardContent className="p-2 sm:p-3">
              <p className="text-[11px] font-semibold text-amber-800 sm:text-xs">
                처리 필요
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-amber-900 sm:text-xl">
                {actionQueueCount.toLocaleString()}건
              </p>
              <p className="mt-0.5 hidden text-xs text-amber-700 sm:block">
                원본 업무가 대기·실패·미완료 상태
              </p>
            </CardContent>
          </Card>
        </div>

        <section
          aria-labelledby="notification-category-heading"
          className="space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm sm:p-3"
        >
          <div>
            <h2
              id="notification-category-heading"
              className="text-sm font-semibold text-foreground"
            >
              업무 분류
            </h2>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              서버 권한 범위와 동일한 조건으로 집계합니다.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
            {[
              ["all", "전체", result?.counts?.all ?? 0],
              [
                "customer_follow_up",
                "고객·후속관리",
                result?.counts?.byCategory?.customer_follow_up ?? 0,
              ],
              ["schedule", "일정", result?.counts?.byCategory?.schedule ?? 0],
              [
                "approval_admin",
                "승인·관리",
                result?.counts?.byCategory?.approval_admin ?? 0,
              ],
              ["system", "시스템", result?.counts?.byCategory?.system ?? 0],
            ].map(([value, label, count]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={categoryFilter === value}
                className={`min-h-11 min-w-28 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-12 sm:min-w-0 ${
                  categoryFilter === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-white text-foreground hover:bg-slate-50"
                }`}
                onClick={() => {
                  setCategoryFilter(value as NotificationCategory);
                  setOffset(0);
                  setSelectedNotificationIds([]);
                }}
              >
                <span className="block">{label}</span>
                <span className="mt-0.5 block text-base tabular-nums">
                  {Number(count).toLocaleString()}건
                </span>
              </button>
            ))}
          </div>
        </section>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full justify-between sm:hidden"
            >
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4" /> 알림 필터
              </span>
              <span className="text-xs text-muted-foreground">
                {hasActiveFilters
                  ? `${activeFilterChips.length}개 적용`
                  : "열기"}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[88dvh] rounded-t-2xl"
            data-testid="notifications-mobile-filter-sheet"
          >
            <SheetHeader>
              <SheetTitle>알림 필터</SheetTitle>
              <SheetDescription>
                처리할 업무와 확인할 알림을 필요한 조건으로 좁혀보세요.
              </SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-1 gap-3 px-4 pb-2">
              <Select
                value={priorityFilter}
                onValueChange={value => {
                  setPriorityFilter(value as PriorityFilter);
                  setOffset(0);
                  setSelectedNotificationIds([]);
                }}
              >
                <SelectTrigger aria-label="알림 우선순위" className="min-h-12">
                  <SelectValue placeholder="우선순위" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 우선순위</SelectItem>
                  <SelectItem value="urgent">긴급</SelectItem>
                  <SelectItem value="today">오늘 처리</SelectItem>
                  <SelectItem value="general">일반</SelectItem>
                  <SelectItem value="done">알림 정리</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={actionFilter}
                onValueChange={value => {
                  setActionFilter(value as ActionFilter);
                  setOffset(0);
                  setSelectedNotificationIds([]);
                }}
              >
                <SelectTrigger
                  aria-label="업무 처리 필요 여부"
                  className="min-h-12"
                >
                  <SelectValue placeholder="업무 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 업무 상태</SelectItem>
                  <SelectItem value="required">처리 필요</SelectItem>
                  <SelectItem value="informational">확인용 알림</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={processStatusFilter}
                onValueChange={handleFilterChange(setProcessStatusFilter)}
              >
                <SelectTrigger aria-label="알림 기록 상태" className="min-h-12">
                  <SelectValue placeholder="알림 기록 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 기록 상태</SelectItem>
                  <SelectItem value="미확인">미확인</SelectItem>
                  <SelectItem value="확인">확인</SelectItem>
                  <SelectItem value="처리완료">처리완료</SelectItem>
                  <SelectItem value="보류">보류</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={isReadFilter}
                onValueChange={handleFilterChange(setIsReadFilter)}
              >
                <SelectTrigger aria-label="알림 읽음 상태" className="min-h-12">
                  <SelectValue placeholder="읽음 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 읽음 상태</SelectItem>
                  <SelectItem value="unread">읽지 않음</SelectItem>
                  <SelectItem value="read">읽음</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={handleFilterChange(setTypeFilter)}
              >
                <SelectTrigger aria-label="알림 유형" className="min-h-12">
                  <SelectValue placeholder="알림 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  aria-label="알림 조회 시작일"
                  value={dateFrom}
                  onChange={event => {
                    setDateFrom(event.target.value);
                    setOffset(0);
                    setSelectedNotificationIds([]);
                  }}
                  className="min-h-12"
                />
                <Input
                  type="date"
                  aria-label="알림 조회 종료일"
                  value={dateTo}
                  onChange={event => {
                    setDateTo(event.target.value);
                    setOffset(0);
                    setSelectedNotificationIds([]);
                  }}
                  className="min-h-12"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  전체 초기화
                </Button>
                <SheetClose asChild>
                  <Button type="button" className="min-h-12">
                    결과 보기
                  </Button>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        {hasActiveFilters && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 sm:hidden"
            aria-label="적용된 알림 필터"
          >
            {activeFilterChips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm"
                aria-label={`${chip.label} 필터 해제`}
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* 서버 사이드 필터 */}
        <Card className="hidden shadow-sm sm:block">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter className="h-4 w-4 text-ring" /> 알림 필터
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Select
                value={priorityFilter}
                onValueChange={v => {
                  setPriorityFilter(v as PriorityFilter);
                  setOffset(0);
                  setSelectedNotificationIds([]);
                }}
              >
                <SelectTrigger
                  aria-label="알림 우선순위"
                  className="min-h-12 w-full rounded-xl bg-muted/40 text-xs sm:h-9 sm:min-h-9 sm:w-32"
                >
                  <SelectValue placeholder="우선순위" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 우선순위</SelectItem>
                  <SelectItem value="urgent">긴급</SelectItem>
                  <SelectItem value="today">오늘 처리</SelectItem>
                  <SelectItem value="general">일반</SelectItem>
                  <SelectItem value="done">알림 정리</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={actionFilter}
                onValueChange={value => {
                  setActionFilter(value as ActionFilter);
                  setOffset(0);
                  setSelectedNotificationIds([]);
                }}
              >
                <SelectTrigger
                  aria-label="업무 처리 필요 여부"
                  className="min-h-12 w-full rounded-xl bg-muted/40 text-xs sm:h-9 sm:min-h-9 sm:w-32"
                >
                  <SelectValue placeholder="업무 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 업무 상태</SelectItem>
                  <SelectItem value="required">처리 필요</SelectItem>
                  <SelectItem value="informational">확인용 알림</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={processStatusFilter}
                onValueChange={handleFilterChange(setProcessStatusFilter)}
              >
                <SelectTrigger
                  aria-label="알림 기록 상태"
                  className="min-h-12 w-full rounded-xl bg-muted/40 text-xs sm:h-9 sm:min-h-9 sm:w-28"
                >
                  <SelectValue placeholder="알림 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="미확인">미확인</SelectItem>
                  <SelectItem value="확인">확인</SelectItem>
                  <SelectItem value="처리완료">처리완료</SelectItem>
                  <SelectItem value="보류">보류</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={isReadFilter}
                onValueChange={handleFilterChange(setIsReadFilter)}
              >
                <SelectTrigger
                  aria-label="알림 읽음 상태"
                  className="min-h-12 w-full rounded-xl bg-muted/40 text-xs sm:h-9 sm:min-h-9 sm:w-24"
                >
                  <SelectValue placeholder="읽음" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="unread">읽지 않음</SelectItem>
                  <SelectItem value="read">읽음</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={handleFilterChange(setTypeFilter)}
              >
                <SelectTrigger
                  aria-label="알림 유형"
                  className="min-h-12 w-full rounded-xl bg-muted/40 text-xs sm:h-9 sm:min-h-9 sm:w-36"
                >
                  <SelectValue placeholder="알림 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                aria-label="알림 조회 시작일"
                value={dateFrom}
                onChange={e => {
                  setDateFrom(e.target.value);
                  setOffset(0);
                  setSelectedNotificationIds([]);
                }}
                className="min-h-12 w-full rounded-xl bg-muted/40 text-xs sm:h-9 sm:min-h-9 sm:w-36"
              />
              <Input
                type="date"
                aria-label="알림 조회 종료일"
                value={dateTo}
                onChange={e => {
                  setDateTo(e.target.value);
                  setOffset(0);
                  setSelectedNotificationIds([]);
                }}
                className="min-h-12 w-full rounded-xl bg-muted/40 text-xs sm:h-9 sm:min-h-9 sm:w-36"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              날짜 선택 (브라우저 기본 달력 형식은 기기 설정을 따릅니다)
            </p>
            {hasActiveFilters && (
              <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600">
                    적용된 필터
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-10 px-3 text-xs"
                    onClick={clearFilters}
                  >
                    필터 전체 해제
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterChips.map(chip => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      aria-label={`${chip.label} 필터 해제`}
                    >
                      <span className="min-w-0 whitespace-normal break-words leading-snug">
                        {chip.label}
                      </span>
                      <X className="h-3 w-3 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <section
          className="space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm sm:p-3"
          data-testid="notifications-priority-section"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">
              알림 우선순위
            </p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              먼저 처리할 알림을 확인하세요
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
            <button
              type="button"
              data-testid="notifications-priority-chip-urgent"
              aria-pressed={priorityFilter === "urgent"}
              className={`min-h-11 min-w-28 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-12 sm:min-w-0 sm:p-3 ${priorityCardClass("urgent", priorityFilter === "urgent")}`}
              onClick={() => {
                setPriorityFilter(
                  priorityFilter === "urgent" ? "all" : "urgent"
                );
                setOffset(0);
                setSelectedNotificationIds([]);
              }}
            >
              <p className="text-xs font-semibold">긴급</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {priorityCounts.urgent}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                기한 임박 업무
              </p>
            </button>
            <button
              type="button"
              data-testid="notifications-priority-chip-today"
              aria-pressed={priorityFilter === "today"}
              className={`min-h-11 min-w-28 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-12 sm:min-w-0 sm:p-3 ${priorityCardClass("today", priorityFilter === "today")}`}
              onClick={() => {
                setPriorityFilter(priorityFilter === "today" ? "all" : "today");
                setOffset(0);
                setSelectedNotificationIds([]);
              }}
            >
              <p className="text-xs font-semibold">오늘</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {priorityCounts.today}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                오늘 확인할 업무
              </p>
            </button>
            <button
              type="button"
              data-testid="notifications-priority-chip-normal"
              aria-pressed={priorityFilter === "general"}
              className={`min-h-11 min-w-28 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-12 sm:min-w-0 sm:p-3 ${priorityCardClass("general", priorityFilter === "general")}`}
              onClick={() => {
                setPriorityFilter(
                  priorityFilter === "general" ? "all" : "general"
                );
                setOffset(0);
                setSelectedNotificationIds([]);
              }}
            >
              <p className="text-xs font-semibold">일반</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {priorityCounts.general}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                정보성 알림
              </p>
            </button>
            <button
              type="button"
              data-testid="notifications-priority-chip-done"
              aria-pressed={priorityFilter === "done"}
              className={`min-h-11 min-w-28 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-12 sm:min-w-0 sm:p-3 ${priorityCardClass("done", priorityFilter === "done")}`}
              onClick={() => {
                setPriorityFilter(priorityFilter === "done" ? "all" : "done");
                setOffset(0);
                setSelectedNotificationIds([]);
              }}
            >
              <p className="text-xs font-semibold">알림 정리</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {priorityCounts.done}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                알림 기록만 정리됨
              </p>
            </button>
          </div>
        </section>

        {/* 알림 목록 */}
        {isNotificationsLoading ? (
          <LoadingState
            title="알림을 불러오는 중입니다."
            description="현재 조건의 알림을 확인하고 있습니다."
            fullPage
          />
        ) : isNotificationsError ? (
          <ErrorState
            title="알림 정보를 불러오지 못했습니다."
            description={MOBILE_STATE_UX.notifications.loadErrorDescription}
            retryLabel="새로고침"
            onRetry={() => refetchNotifications()}
            fullPage
          />
        ) : sortedNotifications.length === 0 ? (
          <div data-testid="notifications-mobile-empty-state">
            <EmptyState
              icon={BellOff}
              title={
                hasActiveFilters
                  ? MOBILE_STATE_UX.notifications.filteredEmptyTitle
                  : isReadFilter === "unread"
                    ? MOBILE_STATE_UX.notifications.unreadEmptyTitle
                    : priorityFilter === "urgent" ||
                        priorityFilter === "today" ||
                        priorityFilter === "done"
                      ? MOBILE_STATE_UX.notifications.actionEmptyTitle
                      : MOBILE_STATE_UX.notifications.emptyTitle
              }
              description={
                hasActiveFilters
                  ? MOBILE_STATE_UX.notifications.filteredEmptyDescription
                  : MOBILE_STATE_UX.notifications.emptyDescription
              }
              action={
                hasActiveFilters ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-12 sm:min-h-8"
                    onClick={clearFilters}
                  >
                    <Filter className="h-4 w-4 mr-1" /> 필터 초기화
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-12 sm:min-h-8"
                    onClick={() => setLocation("/notification-preferences")}
                  >
                    <Settings className="h-4 w-4 mr-1" /> 알림 설정 보기
                  </Button>
                )
              }
              secondaryAction={
                <Button
                  size="sm"
                  className="min-h-12 sm:min-h-8"
                  onClick={() => setLocation("/dashboard")}
                >
                  오늘 업무로 이동
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Card
              className="order-2 border-slate-200 bg-white shadow-sm sm:order-1"
              data-testid="notifications-bulk-actions"
            >
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
                  <Checkbox
                    touchTarget
                    checked={getBulkSelectionCheckboxState({
                      allVisibleSelected,
                      selectedVisibleCount: selectedVisibleIds.length,
                    })}
                    disabled={
                      visibleNotificationIds.length === 0 || isBulkPending
                    }
                    aria-label={getPageSelectAllLabel({
                      surface: "notification",
                    })}
                    onCheckedChange={checked =>
                      toggleVisibleSelection(checked === true)
                    }
                  />
                  현재 목록 전체 선택
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedCount}개 선택됨
                  </span>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <Button
                        data-testid="bulk-complete"
                        variant="outline"
                        size="sm"
                        className="min-h-11 border-blue-200 text-xs text-blue-700 hover:bg-blue-50 sm:min-h-8"
                        disabled={selectedCount === 0 || isBulkPending}
                        onClick={() =>
                          openBulkCompleteConfirmation(selectedVisibleIds)
                        }
                      >
                        선택 알림 기록 정리
                      </Button>
                      <Button
                        data-testid="bulk-today-complete"
                        variant="secondary"
                        size="sm"
                        className="min-h-11 text-xs sm:min-h-8"
                        disabled={
                          todayProcessingTargets.length === 0 || isBulkPending
                        }
                        onClick={() =>
                          openBulkCompleteConfirmation(
                            todayProcessingTargets.map(n => n.id),
                            "todayComplete"
                          )
                        }
                      >
                        오늘 알림 기록 정리
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <Button
                        data-testid="bulk-mark-read"
                        variant="outline"
                        size="sm"
                        className="min-h-11 text-xs sm:min-h-8"
                        disabled={selectedCount === 0 || isBulkPending}
                        onClick={handleBulkMarkRead}
                      >
                        선택 읽음
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 text-xs sm:min-h-8"
                        disabled={selectedCount === 0 || isBulkPending}
                        onClick={() => setSelectedNotificationIds([])}
                      >
                        선택 해제
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {sortedNotifications.map((n, rowIndex) => {
              const processStatus =
                (n.processStatus as ProcessStatus) ?? "미확인";
              const colorClass =
                processStatusColors[processStatus] ??
                processStatusColors["미확인"];
              const priority = classifyNotificationPriority(n);
              const primaryAction = resolveNotificationTarget(n, user?.role);
              const isSelected = selectedNotificationIds.includes(n.id);
              return (
                <Card
                  key={n.id}
                  data-testid="notifications-mobile-notification-card"
                  className={`crm-elevated-card order-1 overflow-hidden rounded-2xl border-l-4 transition-colors sm:order-2 ${colorClass}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div
                        className="-ml-2 -mt-2 flex shrink-0 items-center justify-center sm:m-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <Checkbox
                          touchTarget
                          checked={isSelected}
                          disabled={isBulkPending}
                          className="mt-0.5 sm:mt-0"
                          aria-label={getPageRowSelectionLabel({
                            surface: "notification",
                            rowIndex: rowIndex + 1,
                          })}
                          onCheckedChange={checked =>
                            toggleNotificationSelection(n.id, checked === true)
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mb-2 flex flex-wrap items-start gap-2">
                          <Bell className="h-3.5 w-3.5 shrink-0 text-ring" />
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">
                            {typeLabels[n.type] ?? "기타 알림"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              priority === "urgent"
                                ? "crm-priority-urgent"
                                : priority === "today"
                                  ? "crm-priority-today"
                                  : "crm-priority-general"
                            }`}
                          >
                            {priorityLabel(priority)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${processStatus === "처리완료" ? "bg-emerald-100 text-emerald-700" : processStatus === "미확인" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}
                          >
                            {processStatus}
                          </span>
                          {!n.isRead && (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              읽지 않음
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              n.actionRequired
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {n.actionRequired ? "처리 필요" : "확인용"}
                          </span>
                          <span className="text-xs text-muted-foreground sm:ml-auto">
                            {new Date(n.createdAt).toLocaleString("ko-KR")}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-sm font-medium leading-5">
                          {n.title}
                        </p>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                          {n.message}
                        </p>
                        <p
                          className="mt-2 text-xs font-medium text-muted-foreground"
                          data-testid="notification-source-state"
                        >
                          {getNotificationActionCopy(n)}
                        </p>
                        {n.dueAt && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                              예정일:{" "}
                              {new Date(n.dueAt).toLocaleDateString("ko-KR")}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                              알림 시각:{" "}
                              {new Date(n.dueAt).toLocaleString("ko-KR")}
                            </span>
                          </div>
                        )}
                        {priority === "urgent" && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700">
                            <ShieldAlert className="h-3.5 w-3.5" /> 우선 처리
                            권장
                          </p>
                        )}
                      </div>
                      <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-col sm:gap-1">
                        <Select
                          value={processStatus}
                          onValueChange={v =>
                            updateStatusMutation.mutate({
                              id: n.id,
                              processStatus: v as ProcessStatus,
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`${typeLabels[n.type] ?? "알림"} 알림 기록 상태`}
                            className="min-h-12 w-full text-xs sm:h-7 sm:min-h-7 sm:w-24"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="미확인">미확인</SelectItem>
                            <SelectItem value="확인">확인</SelectItem>
                            <SelectItem value="처리완료">처리완료</SelectItem>
                            <SelectItem value="보류">보류</SelectItem>
                          </SelectContent>
                        </Select>
                        {!n.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-12 text-xs sm:h-7 sm:min-h-7"
                            onClick={() =>
                              markReadMutation.mutate({ id: n.id })
                            }
                          >
                            읽음
                          </Button>
                        )}
                        {processStatus !== "처리완료" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-12 text-xs sm:h-7 sm:min-h-7"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: n.id,
                                processStatus: "처리완료",
                              })
                            }
                          >
                            알림 정리
                          </Button>
                        )}
                        {primaryAction && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-12 text-xs sm:h-7 sm:min-h-7"
                            onClick={() => {
                              if (!n.isRead) {
                                markReadMutation.mutate({ id: n.id });
                              }
                              setLocation(primaryAction.path);
                            }}
                          >
                            {n.actionRequired
                              ? primaryAction.label
                              : "관련 내용 확인"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalCount > LIMIT && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {currentPage} / {totalPages} 페이지 · 전체{" "}
              {totalCount.toLocaleString()}건
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-12 sm:min-h-8"
                disabled={offset === 0}
                onClick={() => {
                  setOffset(Math.max(0, offset - LIMIT));
                  setSelectedNotificationIds([]);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-12 sm:min-h-8"
                disabled={!hasMore}
                onClick={() => {
                  setOffset(offset + LIMIT);
                  setSelectedNotificationIds([]);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={showMarkAllReadDialog}
        onOpenChange={setShowMarkAllReadDialog}
      >
        <DialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCheck className="h-5 w-5 text-emerald-700" /> 알림 읽음 처리
            </DialogTitle>
            <DialogDescription>
              {user?.role === "branch_admin"
                ? "본인 userId 기준의 알림만 모두 읽음 처리합니다. 전체 조직 알림은 개별 처리 정책을 유지합니다."
                : "현재 계정의 미확인 알림을 모두 읽음 처리합니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            읽음 처리는 확인 상태만 변경하며, 처리완료 상태나 알림 노출 정책은
            변경하지 않습니다.
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              className="min-h-12 sm:min-h-10"
              variant="outline"
              onClick={() => setShowMarkAllReadDialog(false)}
            >
              취소
            </Button>
            <Button
              className="min-h-12 sm:min-h-10"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              모두 읽음 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkCompleteConfirmation !== null}
        onOpenChange={open => {
          if (!open && !isBulkPending) setBulkCompleteConfirmation(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCheck className="h-5 w-5 text-emerald-700" /> 알림 기록 정리
              확인
            </DialogTitle>
            <DialogDescription>
              선택한 {bulkCompleteConfirmation?.ids.length ?? 0}개의 알림을 정리
              상태로 변경합니다. 알림은 삭제되지 않으며, 원본 업무의
              완료·승인·실패 상태는 변경되지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              className="min-h-12 sm:min-h-10"
              variant="outline"
              disabled={isBulkPending}
              onClick={() => setBulkCompleteConfirmation(null)}
            >
              취소
            </Button>
            <Button
              className="min-h-12 sm:min-h-10"
              disabled={isBulkPending}
              onClick={confirmBulkComplete}
            >
              {isBulkPending ? "변경 중..." : "알림 기록 정리"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
