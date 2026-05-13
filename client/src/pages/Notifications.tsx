import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
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
  "확인": "border-l-blue-400 bg-blue-50/50",
  "처리완료": "border-l-green-400 bg-green-50/50 opacity-60",
  "보류": "border-l-yellow-400 bg-yellow-50/50",
};

type ProcessStatus = "미확인" | "확인" | "처리완료" | "보류";

const titleMap: Record<string, string> = {
  branch_admin: "전체 알림 관리",
  sub_branch_admin: "본인 산하 알림 관리",
  team_leader: "본인 팀 알림 관리",
  member: "내 알림",
};

const LIMIT = 50;

export default function Notifications() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // 서버 사이드 필터 상태
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">{titleMap[user?.role ?? ""] ?? "알림센터"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              전체 {totalCount.toLocaleString()}건 · 미읽은 {unreadCount}건
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
                <CheckCheck className="h-4 w-4 mr-1" /> 내 알림 모두 읽음
              </Button>
            )}
          </div>
        </div>

        {/* 서버 사이드 필터 */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={processStatusFilter} onValueChange={handleFilterChange(setProcessStatusFilter)}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-28"><SelectValue placeholder="처리상태" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="미확인">미확인</SelectItem>
              <SelectItem value="확인">확인</SelectItem>
              <SelectItem value="처리완료">처리완료</SelectItem>
              <SelectItem value="보류">보류</SelectItem>
            </SelectContent>
          </Select>
          <Select value={isReadFilter} onValueChange={handleFilterChange(setIsReadFilter)}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-24"><SelectValue placeholder="읽음" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="unread">미읽음</SelectItem>
              <SelectItem value="read">읽음</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-36"><SelectValue placeholder="알림 유형" /></SelectTrigger>
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
            className="h-9 w-full text-xs sm:w-36"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
            className="h-9 w-full text-xs sm:w-36"
          />
        </div>

        {/* 알림 목록 */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BellOff className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">알림이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const processStatus = (n.processStatus as ProcessStatus) ?? "미확인";
              const colorClass = processStatusColors[processStatus] ?? processStatusColors["미확인"];
              return (
                <Card key={n.id} className={`border-l-4 ${colorClass}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-semibold text-primary">{typeLabels[n.type] ?? n.type}</span>
                          <span className="text-xs text-muted-foreground sm:ml-auto">{new Date(n.createdAt).toLocaleString("ko-KR")}</span>
                        </div>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        {n.dueAt && (
                          <p className="text-xs text-primary mt-1">예정일: {new Date(n.dueAt).toLocaleDateString("ko-KR")}</p>
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
