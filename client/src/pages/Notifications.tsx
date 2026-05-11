import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, CheckCheck } from "lucide-react";
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
};

export default function Notifications() {
  const utils = trpc.useUtils();
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

  const unread = notifications?.filter((n) => !n.isRead) ?? [];
  const read = notifications?.filter((n) => n.isRead) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">알림센터</h1>
            <p className="text-sm text-muted-foreground mt-0.5">미읽은 알림 {unread.length}개</p>
          </div>
          {unread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              모두 읽음
            </Button>
          )}
        </div>

        {/* 미읽은 알림 */}
        {unread.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">새 알림</p>
            {unread.map((n) => (
              <Card key={n.id} className="border-l-4 border-l-primary bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-primary">
                          {typeLabels[n.type] ?? n.type}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(n.createdAt).toLocaleString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => markReadMutation.mutate({ id: n.id })}
                    >
                      읽음
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 읽은 알림 */}
        {read.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">읽은 알림</p>
            {read.map((n) => (
              <Card key={n.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                          {typeLabels[n.type] ?? n.type}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(n.createdAt).toLocaleString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {(notifications ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BellOff className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">알림이 없습니다.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
