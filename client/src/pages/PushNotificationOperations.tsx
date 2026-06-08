import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCircle2, CircleSlash, RefreshCw, Send, ShieldAlert, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  buildPushLogsQuery,
  formatPushLogUserLabel,
  pushSourceTypeLabels,
  pushStatusLabels,
  pushTypeLabels,
  type PushLogListItem,
} from "./pushNotificationOperationsUtils";

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

function PushLogCard({ log }: { log: PushLogListItem }) {
  return (
    <Card className="border-slate-200/80 md:hidden">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-900">{pushTypeLabels[log.type] ?? "기타 알림"}</span>
          <Badge className={statusClasses[log.status] ?? "bg-slate-100 text-slate-700"}>
            {pushStatusLabels[log.status] ?? "기타 상태"}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("ko-KR")}</p>
        <p className="text-sm text-slate-700">대상: {formatPushLogUserLabel(log)}</p>
        <p className="text-xs text-slate-500">
          소스: {log.sourceType ? pushSourceTypeLabels[log.sourceType] ?? "기타 소스" : "-"}
          {log.sourceId ? ` #${log.sourceId}` : ""}
        </p>
        <p className="text-xs text-slate-500">오류: {log.errorCode ?? "-"}</p>
      </CardContent>
    </Card>
  );
}

export default function PushNotificationOperations() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sourceType, setSourceType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const logsQueryInput = useMemo(
    () => buildPushLogsQuery({ status, type, sourceType, dateFrom, dateTo }),
    [status, type, sourceType, dateFrom, dateTo],
  );

  const summaryInput = useMemo(
    () => ({
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
    }),
    [dateFrom, dateTo],
  );

  const { data: summary, isLoading: summaryLoading } = trpc.pushNotifications.operationSummary.useQuery(summaryInput);
  const { data: logs, isLoading: logsLoading, isError: logsError } = trpc.pushNotifications.logs.useQuery(logsQueryInput);

  const testMutation = trpc.pushNotifications.sendTestToMe.useMutation({
    onSuccess: (result) => {
      toast.success(result.sentCount > 0 ? "테스트 푸시를 발송했습니다." : "테스트 푸시가 스킵되었습니다.");
      utils.pushNotifications.operationSummary.invalidate();
      utils.pushNotifications.logs.invalidate();
    },
    onError: () => toast.error("테스트 푸시 발송에 실패했습니다."),
  });

  const cards = [
    { title: "조회 로그", value: summary?.total ?? 0, icon: BellRing, className: "text-slate-700" },
    { title: "성공", value: summary?.sent ?? 0, icon: CheckCircle2, className: "text-emerald-600" },
    { title: "실패", value: summary?.failed ?? 0, icon: XCircle, className: "text-red-600" },
    { title: "스킵", value: summary?.skipped ?? 0, icon: CircleSlash, className: "text-amber-600" },
    { title: "비활성 토큰", value: summary?.inactiveTokens ?? 0, icon: ShieldAlert, className: "text-slate-600" },
  ];

  const logRows = (logs ?? []) as PushLogListItem[];

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
                  지점장 전용 화면입니다. device token 원문·고객 민감정보는 표시하지 않습니다.
                </p>
              </div>
              <Button onClick={() => testMutation.mutate({ force: false })} disabled={testMutation.isPending} className="min-h-12 sm:min-h-10">
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
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="시작일" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="종료일" />
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="유형" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  {Object.entries(pushTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {Object.entries(pushStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={sourceType} onChange={(e) => setSourceType(e.target.value)} placeholder="소스 유형" />
            </div>

            <div className="space-y-3 md:hidden">
              {logsLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">발송 로그를 불러오는 중입니다.</p>
              ) : logsError ? (
                <p className="py-8 text-center text-sm text-red-600">발송 로그를 불러오지 못했습니다.</p>
              ) : logRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">표시할 푸시 발송 로그가 없습니다.</p>
              ) : (
                logRows.map((log) => <PushLogCard key={log.id} log={log} />)
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-100 md:block">
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
                  ) : logsError ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-red-600">발송 로그를 불러오지 못했습니다.</TableCell></TableRow>
                  ) : logRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">표시할 푸시 발송 로그가 없습니다.</TableCell></TableRow>
                  ) : (
                    logRows.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("ko-KR")}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{pushTypeLabels[log.type] ?? "기타 알림"}</TableCell>
                        <TableCell>
                          <Badge className={statusClasses[log.status] ?? "bg-slate-100 text-slate-700"}>{pushStatusLabels[log.status] ?? "기타 상태"}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatPushLogUserLabel(log)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {log.sourceType ? pushSourceTypeLabels[log.sourceType] ?? "기타 소스" : "-"}{log.sourceId ? ` #${log.sourceId}` : ""}
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
