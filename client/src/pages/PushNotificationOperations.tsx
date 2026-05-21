import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCircle2, CircleSlash, RefreshCw, Send, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  sent: "성공",
  failed: "실패",
  skipped: "스킵",
  skipped_no_token: "토큰 없음",
  skipped_disabled: "설정 꺼짐",
  skipped_quiet_hours: "조용한 시간",
  skipped_missing_config: "설정 누락",
  duplicate_skipped: "중복 차단",
  invalid_token_deactivated: "토큰 비활성",
};

const statusClasses: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-slate-100 text-slate-700",
  skipped_no_token: "bg-amber-100 text-amber-700",
  skipped_disabled: "bg-slate-100 text-slate-700",
  skipped_quiet_hours: "bg-indigo-100 text-indigo-700",
  skipped_missing_config: "bg-orange-100 text-orange-700",
  duplicate_skipped: "bg-blue-100 text-blue-700",
  invalid_token_deactivated: "bg-red-100 text-red-700",
};

const typeLabels: Record<string, string> = {
  today_follow_up: "오늘 연락 대상",
  schedule_30min: "일정 30분 전",
  schedule_reminder: "일정 알림",
  schedule_incomplete: "일정 미완료",
  customer_birthday: "고객 기념일",
  contract_90: "계약 90일 점검",
  contract_180: "계약 180일 점검",
  contract_365: "계약 365일 점검",
  long_unmanaged_90: "장기 미관리 고객",
  contract_delete_request: "계약 삭제 요청",
  test: "테스트",
};

const sourceTypeLabels: Record<string, string> = {
  notification: "알림",
  schedule: "일정",
  follow_up: "후속관리",
  contract: "계약",
  customer: "고객",
  test: "테스트",
};

export default function PushNotificationOperations() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sourceType, setSourceType] = useState("");
  const { data: summary, isLoading: summaryLoading } = trpc.pushNotifications.operationSummary.useQuery();
  const { data: logs, isLoading: logsLoading } = trpc.pushNotifications.logs.useQuery({
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
    sourceType: sourceType.trim() || undefined,
    limit: 100,
  });
  const testMutation = trpc.pushNotifications.sendTestToMe.useMutation({
    onSuccess: (result) => {
      toast.success(result.sentCount > 0 ? "테스트 푸시를 발송했습니다." : "테스트 푸시가 스킵되었습니다.");
      utils.pushNotifications.operationSummary.invalidate();
      utils.pushNotifications.logs.invalidate();
    },
    onError: () => toast.error("테스트 푸시 발송에 실패했습니다."),
  });

  const cards = [
    { title: "오늘 로그", value: summary?.total ?? 0, icon: BellRing, className: "text-slate-700" },
    { title: "성공", value: summary?.sent ?? 0, icon: CheckCircle2, className: "text-emerald-600" },
    { title: "실패", value: summary?.failed ?? 0, icon: XCircle, className: "text-red-600" },
    { title: "스킵", value: summary?.skipped ?? 0, icon: CircleSlash, className: "text-amber-600" },
    { title: "비활성 토큰", value: summary?.inactiveTokens ?? 0, icon: ShieldAlert, className: "text-slate-600" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Push Operations</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950">푸시 알림 운영</h1>
                <p className="mt-1 text-sm text-slate-500">
                  발송 성공, 실패, 설정 꺼짐, 조용한 시간, 중복 차단 상태를 확인합니다. 토큰 원문과 고객정보는 표시하지 않습니다.
                </p>
              </div>
              <Button onClick={() => testMutation.mutate({ force: false })} disabled={testMutation.isPending}>
                <Send className="mr-2 h-4 w-4" /> 내 기기로 테스트
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <Card key={card.title} className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-slate-500">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{summaryLoading ? "-" : card.value}</p>
                </div>
                <card.icon className={`h-5 w-5 ${card.className}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-slate-700" /> 최근 발송 로그
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  <SelectItem value="today_follow_up">오늘 연락 대상</SelectItem>
                  <SelectItem value="schedule_30min">일정 30분 전</SelectItem>
                  <SelectItem value="schedule_reminder">일정 알림</SelectItem>
                  <SelectItem value="schedule_incomplete">일정 미완료</SelectItem>
                  <SelectItem value="customer_birthday">고객 기념일</SelectItem>
                  <SelectItem value="contract_90">계약 90일 점검</SelectItem>
                  <SelectItem value="contract_180">계약 180일 점검</SelectItem>
                  <SelectItem value="contract_365">계약 365일 점검</SelectItem>
                  <SelectItem value="long_unmanaged_90">장기 미관리 고객</SelectItem>
                  <SelectItem value="contract_delete_request">계약 삭제 요청</SelectItem>
                  <SelectItem value="test">테스트</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={sourceType} onChange={(event) => setSourceType(event.target.value)} placeholder="소스 유형" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>발송일시</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>소스</TableHead>
                    <TableHead>오류 코드</TableHead>
                    <TableHead>발송 시각</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">발송 로그를 불러오는 중입니다.</TableCell></TableRow>
                  ) : (logs ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">표시할 푸시 발송 로그가 없습니다.</TableCell></TableRow>
                  ) : (
                    (logs ?? []).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("ko-KR")}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{typeLabels[log.type] ?? "기타 알림"}</TableCell>
                        <TableCell>
                          <Badge className={statusClasses[log.status] ?? "bg-slate-100 text-slate-700"}>{statusLabels[log.status] ?? "기타 상태"}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{log.userName ?? `#${log.userId}`}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {log.sourceType ? sourceTypeLabels[log.sourceType] ?? "기타 소스" : "-"}{log.sourceId ? ` #${log.sourceId}` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{log.errorCode ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{log.sentAt ? new Date(log.sentAt).toLocaleString("ko-KR") : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
