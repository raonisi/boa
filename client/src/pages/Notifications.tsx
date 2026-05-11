import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, CheckCheck } from "lucide-react";
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
type FilterType = "전체" | ProcessStatus;

export default function Notifications() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<FilterType>("전체");
  const { data: notifications } = trpc.notifications.list.useQuery();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("모두 읽음 처리되었습니다.");
    },
  });
  const updateStatusMutation = trpc.notifications.updateProcessStatus.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
    onError: () => toast.error("상태 변경에 실패했습니다."),
  });

  const filtered = (notifications ?? []).filter((n) => {
    if (filter === "전체") return true;
    return (n as any).processStatus === filter;
  });

  const unreadCount = (notifications ?? []).filter((n) => !(n as any).isRead).length;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">알림센터</h1>
            <p className="text-sm text-muted-foreground mt-0.5">미읽은 알림 {unreadCount}개</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
                <CheckCheck className="h-4 w-4 mr-1" /> 모두 읽음
              </Button>
            )}
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-1 flex-wrap">
          {(["전체", "미확인", "확인", "처리완료", "보류"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
            >
              {f}
              {f !== "전체" && (
                <span className="ml-1 text-[10px]">
                  ({(notifications ?? []).filter((n) => (n as any).processStatus === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 알림 목록 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BellOff className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">알림이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const processStatus = (n as any).processStatus as ProcessStatus ?? "미확인";
              const colorClass = processStatusColors[processStatus] ?? processStatusColors["미확인"];
              return (
                <Card key={n.id} className={`border-l-4 ${colorClass}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-semibold text-primary">{typeLabels[n.type] ?? n.type}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{new Date(n.createdAt).toLocaleString("ko-KR")}</span>
                        </div>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        {n.dueAt && (
                          <p className="text-xs text-primary mt-1">예정일: {new Date(n.dueAt).toLocaleDateString("ko-KR")}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Select
                          value={processStatus}
                          onValueChange={(v) => updateStatusMutation.mutate({ id: n.id, processStatus: v as ProcessStatus })}
                        >
                          <SelectTrigger className="h-7 text-xs w-24">
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
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markReadMutation.mutate({ id: n.id })}>
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
      </div>
    </DashboardLayout>
  );
}
