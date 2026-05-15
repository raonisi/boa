import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { classifyNotificationPriority, sortNotificationsForQueue } from "@/lib/notificationPriority";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell, BellOff, CheckCheck, ChevronLeft, ChevronRight, Filter, Settings, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
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
  customer_assigned: "고객 배정",
  general: "일반",
};

const processStatusColors: Record<string, string> = {
  "미확인": "border-l-primary bg-primary/5",
  "확인": "border-l-blue-400 bg-blue-50/60 dark:bg-blue-950/30",
  "처리완료": "border-l-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/25 opacity-70",
  "보류": "border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/25",
};

type ProcessStatus = "미확인" | "확인" | "처리완료" | "보류";
type PriorityFilter = "all" | "urgent" | "today" | "general";

const titleMap: Record<string, string> = {
  branch_admin: "전체 알림 관리",
  sub_branch_admin: "본인 산하 알림 관리",
  team_leader: "본인 팀 알림 관리",
  member: "내 알림",
};

const LIMIT = 50;

function priorityLabel(priority: "urgent" | "today" | "general") {
  return priority === "urgent" ? "긴급" : priority === "today" ? "오늘 처리" : "일반";
}

function priorityCardClass(priority: PriorityFilter, active: boolean) {
  if (priority === "urgent") return active ? "border-red-300 bg-red-50 text-red-800" : "border-red-100 bg-white hover:bg-red-50/60";
  if (priority === "today") return active ? "border-amber-300 bg-amber-50 text-amber-800" : "border-amber-100 bg-white hover:bg-amber-50/60";
  return active ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-200 bg-white hover:bg-slate-50";
}

export default function Notifications() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  // 서버 사이드 필터 상태
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [processStatusFilter, setProcessStatusFilter] = useState<string>("all");
  const [isReadFilter, setIsReadFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);

  const queryInput = {
    processStatus: processStatusFilter !== "all" ? processStatusFilter : undefined,
    isRead: isReadFilter === "unread" ? false : isReadFilter === "read" ? true : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: LIMIT,
    offset,
  };

  const { data: result } = trpc.notifications.list.useQuery(queryInput);
  const notifications = result?.items ?? [];
  const filteredNotifications = notifications.filter((n) => priorityFilter === "all" ? true : classifyNotificationPriority(n) === priorityFilter);
  const sortedNotifications = sortNotificationsForQueue(filteredNotifications);
  const priorityCounts = {
    urgent: notifications.filter((n) => classifyNotificationPriority(n) === "urgent").length,
    today: notifications.filter((n) => classifyNotificationPriority(n) === "today").length,
    general: notifications.filter((n) => classifyNotificationPriority(n) === "general").length,
  };
  const totalCount = result?.totalCount ?? 0;
  const hasMore = result?.hasMore ?? false;
  const totalPages = Math.ceil(totalCount / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("내 알림이 모두 읽음 처리되었습니다.");
    },
  });

  const updateStatusMutation = trpc.notifications.updateProcessStatus.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
    onError: () => toast.error("상태 변경에 실패했습니다."),
  });

  const unreadCount = filteredNotifications.filter((n) => !n.isRead).length;
  const actionQueueCount = priorityCounts.urgent + priorityCounts.today;
  const completedCount = notifications.filter((n) => n.processStatus === "처리완료").length;

  const handleMarkAllRead = () => {
    const isBranchAdmin = user?.role === "branch_admin";
    const confirmMsg = isBranchAdmin
      ? "내 알림(본인 userId 기준)만 모두 읽음 처리됩니다.\n전체 조직 알림은 개별 처리해주세요.\n계속하시겠습니까?"
      : "현재 조회 중인 알림을 모두 읽음 처리하시겠습니까?";
    if (confirm(confirmMsg)) {
      markAllReadMutation.mutate();
    }
  };

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setOffset(0); // 필터 변경 시 첫 페이지로
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ring">Notifications</p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">{titleMap[user?.role ?? ""] ?? "알림센터"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                지금 처리할 업무 {actionQueueCount}건 · 미확인 {unreadCount}건 · 처리완료 {completedCount}건
              </p>
              <p className="mt-1 text-xs text-muted-foreground">미래 일정 알림은 설정한 dueAt 시각이 도래한 뒤 표시됩니다.</p>
            </div>
            <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
                <CheckCheck className="h-4 w-4 mr-1" /> 내 알림 모두 읽음
              </Button>
            )}
            </div>
          </CardContent>
        </Card>

        {/* 서버 사이드 필터 */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter className="h-4 w-4 text-ring" /> 알림 필터
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
            <SelectTrigger className="h-9 w-full rounded-xl bg-muted/40 text-xs sm:w-32"><SelectValue placeholder="우선순위" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 우선순위</SelectItem>
              <SelectItem value="urgent">긴급</SelectItem>
              <SelectItem value="today">오늘 처리</SelectItem>
              <SelectItem value="general">일반</SelectItem>
            </SelectContent>
          </Select>
          <Select value={processStatusFilter} onValueChange={handleFilterChange(setProcessStatusFilter)}>
            <SelectTrigger className="h-9 w-full rounded-xl bg-muted/40 text-xs sm:w-28"><SelectValue placeholder="처리상태" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="미확인">미확인</SelectItem>
              <SelectItem value="확인">확인</SelectItem>
              <SelectItem value="처리완료">처리완료</SelectItem>
              <SelectItem value="보류">보류</SelectItem>
            </SelectContent>
          </Select>
          <Select value={isReadFilter} onValueChange={handleFilterChange(setIsReadFilter)}>
            <SelectTrigger className="h-9 w-full rounded-xl bg-muted/40 text-xs sm:w-24"><SelectValue placeholder="읽음" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="unread">미읽음</SelectItem>
              <SelectItem value="read">읽음</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
            <SelectTrigger className="h-9 w-full rounded-xl bg-muted/40 text-xs sm:w-36"><SelectValue placeholder="알림 유형" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              {Object.entries(typeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
            className="h-9 w-full rounded-xl bg-muted/40 text-xs sm:w-36"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
            className="h-9 w-full rounded-xl bg-muted/40 text-xs sm:w-36"
          />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            aria-pressed={priorityFilter === "urgent"}
            className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${priorityCardClass("urgent", priorityFilter === "urgent")}`}
            onClick={() => setPriorityFilter(priorityFilter === "urgent" ? "all" : "urgent")}
          >
            <p className="text-[11px] font-semibold">긴급</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{priorityCounts.urgent}</p>
            <p className="text-[11px] text-muted-foreground">위험·기한 임박 업무</p>
          </button>
          <button
            type="button"
            aria-pressed={priorityFilter === "today"}
            className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${priorityCardClass("today", priorityFilter === "today")}`}
            onClick={() => setPriorityFilter(priorityFilter === "today" ? "all" : "today")}
          >
            <p className="text-[11px] font-semibold">오늘 처리</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{priorityCounts.today}</p>
            <p className="text-[11px] text-muted-foreground">오늘 확인할 업무</p>
          </button>
          <button
            type="button"
            aria-pressed={priorityFilter === "general"}
            className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${priorityCardClass("general", priorityFilter === "general")}`}
            onClick={() => setPriorityFilter(priorityFilter === "general" ? "all" : "general")}
          >
            <p className="text-[11px] font-semibold">일반</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{priorityCounts.general}</p>
            <p className="text-[11px] text-muted-foreground">정보성 알림</p>
          </button>
        </div>

        {/* 알림 목록 */}
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="현재 확인할 알림이 없습니다."
            description="일정 알림은 설정한 시각에 표시됩니다. 조건을 넓히거나 알림 설정을 확인하세요."
            action={
              <Button size="sm" variant="outline" onClick={() => setLocation("/notification-preferences")}>
                <Settings className="h-4 w-4 mr-1" /> 알림 설정 보기
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {sortedNotifications.map((n) => {
              const processStatus = (n.processStatus as ProcessStatus) ?? "미확인";
              const colorClass = processStatusColors[processStatus] ?? processStatusColors["미확인"];
              const priority = classifyNotificationPriority(n);
              return (
                <Card key={n.id} className={`crm-elevated-card border-l-4 transition-colors ${colorClass}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Bell className="h-3.5 w-3.5 shrink-0 text-ring" />
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">{typeLabels[n.type] ?? n.type}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            priority === "urgent"
                              ? "crm-priority-urgent"
                              : priority === "today"
                                ? "crm-priority-today"
                                : "crm-priority-general"
                          }`}>
                            {priorityLabel(priority)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${processStatus === "처리완료" ? "bg-emerald-100 text-emerald-700" : processStatus === "미확인" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{processStatus}</span>
                          {!n.isRead && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">미읽음</span>}
                          <span className="text-xs text-muted-foreground sm:ml-auto">{new Date(n.createdAt).toLocaleString("ko-KR")}</span>
                        </div>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        {n.dueAt && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">예정일: {new Date(n.dueAt).toLocaleDateString("ko-KR")}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">알림 시각: {new Date(n.dueAt).toLocaleString("ko-KR")}</span>
                          </div>
                        )}
                        {priority === "urgent" && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700">
                            <ShieldAlert className="h-3.5 w-3.5" /> 우선 처리 권장
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2 sm:flex-col sm:gap-1">
                        <Select
                          value={processStatus}
                          onValueChange={(v) => updateStatusMutation.mutate({ id: n.id, processStatus: v as ProcessStatus })}
                        >
                          <SelectTrigger className="h-9 w-28 text-xs sm:h-7 sm:w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="미확인">미확인</SelectItem>
                            <SelectItem value="확인">확인</SelectItem>
                            <SelectItem value="처리완료">처리완료</SelectItem>
                            <SelectItem value="보류">보류</SelectItem>
                          </SelectContent>
                        </Select>
                        {!n.isRead && (
                          <Button variant="ghost" size="sm" className="h-9 text-xs sm:h-7" onClick={() => markReadMutation.mutate({ id: n.id })}>
                            읽음
                          </Button>
                        )}
                        {processStatus !== "처리완료" && (
                          <Button variant="outline" size="sm" className="h-9 text-xs sm:h-7" onClick={() => updateStatusMutation.mutate({ id: n.id, processStatus: "처리완료" })}>
                            처리완료
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
              {currentPage} / {totalPages} 페이지 · 전체 {totalCount.toLocaleString()}건
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setOffset(offset + LIMIT)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
