import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { adminPage, adminPanel } from "@/lib/adminDesignTokens";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BellRing,
  CheckCircle2,
  CircleSlash,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
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
  sent: "bg-boa-green/12 text-boa-green",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground",
  skipped_no_token: "bg-boa-amber/16 text-amber-800",
  skipped_disabled: "bg-muted text-muted-foreground",
  skipped_quiet_hours: "bg-primary/10 text-boa-navy",
  skipped_missing_config: "bg-boa-amber/16 text-amber-800",
  duplicate_skipped: "bg-muted text-muted-foreground",
  invalid_token_deactivated: "bg-destructive/10 text-destructive",
};

function PushLogCard({ log }: { log: PushLogListItem }) {
  return (
    <Card className="border-border/80 md:hidden">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {pushTypeLabels[log.type] ?? "기타 알림"}
          </span>
          <Badge
            className={
              statusClasses[log.status] ?? "bg-muted/60 text-foreground"
            }
          >
            {pushStatusLabels[log.status] ?? "기타 상태"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(log.createdAt).toLocaleString("ko-KR")}
        </p>
        <p className="text-sm text-foreground">
          대상: {formatPushLogUserLabel(log)}
        </p>
        <p className="text-xs text-muted-foreground">
          소스:{" "}
          {log.sourceType
            ? (pushSourceTypeLabels[log.sourceType] ?? "기타 소스")
            : "-"}
          {log.sourceId ? ` #${log.sourceId}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">오류: {log.errorCode ?? "-"}</p>
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
    [status, type, sourceType, dateFrom, dateTo]
  );

  const summaryInput = useMemo(
    () => ({
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
    }),
    [dateFrom, dateTo]
  );

  const { data: summary, isLoading: summaryLoading } =
    trpc.pushNotifications.operationSummary.useQuery(summaryInput);
  const {
    data: logs,
    isLoading: logsLoading,
    isError: logsError,
  } = trpc.pushNotifications.logs.useQuery(logsQueryInput);

  const testMutation = trpc.pushNotifications.sendTestToMe.useMutation({
    onSuccess: result => {
      toast.success(
        result.sentCount > 0
          ? "테스트 푸시를 발송했습니다."
          : "테스트 푸시가 스킵되었습니다."
      );
      utils.pushNotifications.operationSummary.invalidate();
      utils.pushNotifications.logs.invalidate();
    },
    onError: () => toast.error("테스트 푸시 발송에 실패했습니다."),
  });

  const cards = [
    {
      title: "조회 로그",
      value: summary?.total ?? 0,
      icon: BellRing,
      className: "text-foreground",
    },
    {
      title: "성공",
      value: summary?.sent ?? 0,
      icon: CheckCircle2,
      className: "text-boa-green",
    },
    {
      title: "실패",
      value: summary?.failed ?? 0,
      icon: XCircle,
      className: "text-destructive",
    },
    {
      title: "스킵",
      value: summary?.skipped ?? 0,
      icon: CircleSlash,
      className: "text-amber-800",
    },
    {
      title: "비활성 토큰",
      value: summary?.inactiveTokens ?? 0,
      icon: ShieldAlert,
      className: "text-muted-foreground",
    },
  ];

  const logRows = (logs ?? []) as PushLogListItem[];
  const actionIssueCount =
    (summary?.failed ?? 0) +
    (summary?.skipped ?? 0) +
    (summary?.inactiveTokens ?? 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className={adminPage.card}>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className={adminPage.eyebrow}>알림 운영</p>
                <h1 className={cn("mt-1", adminPage.title)}>푸시 알림 운영</h1>
                <p className={cn("mt-1", adminPage.subtitle)}>
                  지점장 전용 화면입니다. 기기 식별 정보 원문과 고객 민감정보는
                  표시하지 않으며, 알림 제목·본문에도 민감정보가 포함되지
                  않아야 합니다.
                </p>
              </div>
              <Button
                onClick={() => testMutation.mutate({ force: false })}
                disabled={testMutation.isPending}
                className="min-h-12 sm:min-h-10"
              >
                <Send className="mr-2 h-4 w-4" /> 내 기기로 테스트
              </Button>
            </div>
          </CardContent>
        </Card>

        {summaryLoading ? (
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="p-5">
              <EmptyState
                variant="loading"
                title="운영 정보를 불러오는 중입니다."
                description="푸시 발송 상태와 최근 로그를 확인하고 있습니다."
                className="border-0 bg-transparent py-4"
              />
            </CardContent>
          </Card>
        ) : actionIssueCount > 0 ? (
          <Card className={cn("shadow-sm", adminPanel.warningSoft)}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-amber-800" />
                조치가 필요한 항목
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pb-5 sm:grid-cols-3">
              {(summary?.failed ?? 0) > 0 ? (
                <div className="rounded-xl border border-destructive/25 bg-card p-4">
                  <p className="text-xs text-muted-foreground">발송 실패</p>
                  <p className="mt-1 text-2xl font-bold text-destructive">
                    {summary?.failed}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    실패 로그를 확인하고 현장 알림 누락 여부를 점검해 주세요.
                  </p>
                </div>
              ) : null}
              {(summary?.skipped ?? 0) > 0 ? (
                <div className="rounded-xl border border-amber-200/70 bg-white p-4">
                  <p className="text-xs text-muted-foreground">발송 생략</p>
                  <p className="mt-1 text-2xl font-bold text-amber-800">
                    {summary?.skipped}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    토큰 없음, 조용한 시간, 설정 누락 등으로 생략된 건입니다.
                  </p>
                </div>
              ) : null}
              {(summary?.inactiveTokens ?? 0) > 0 ? (
                <div className="rounded-xl border border-border bg-white p-4">
                  <p className="text-xs text-muted-foreground">비활성 기기</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {summary?.inactiveTokens}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    비활성·퇴사 계정의 기기 등록 상태를 확인해 주세요.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-boa-green/20 bg-boa-green/8 shadow-sm">
            <CardContent className="p-4 text-sm text-boa-green">
              처리할 Push 운영 항목이 없습니다. 최근 발송 상태가 안정적입니다.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map(card => (
            <Card
              key={card.title}
              className="border-border/80 bg-card shadow-sm"
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {summaryLoading ? "-" : card.value}
                  </p>
                </div>
                <card.icon className={`h-5 w-5 ${card.className}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-foreground" /> 최근 발송 로그
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                aria-label="시작일"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                aria-label="종료일"
              />
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  {Object.entries(pushTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {Object.entries(pushStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={sourceType}
                onChange={e => setSourceType(e.target.value)}
                placeholder="소스 유형"
              />
            </div>

            <div className="space-y-3 md:hidden">
              {logsLoading ? (
                <EmptyState
                  variant="loading"
                  title="운영 정보를 불러오는 중입니다."
                  description="발송 로그를 확인하고 있습니다."
                  className="border-0 bg-transparent py-8"
                />
              ) : logsError ? (
                <ErrorState
                  title="정보를 다시 불러오지 못했습니다."
                  description="잠시 후 다시 시도해 주세요."
                  retryLabel="다시 시도"
                  onRetry={() => utils.pushNotifications.logs.invalidate()}
                  className="border-0 bg-transparent py-8"
                />
              ) : logRows.length === 0 ? (
                <EmptyState
                  title="처리할 Push 운영 항목이 없습니다."
                  description="현재 조건에 맞는 발송 로그가 없습니다."
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                logRows.map(log => <PushLogCard key={log.id} log={log} />)
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
              <Table>
                <TableHeader className="bg-muted/50">
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
                    <TableRow>
                      <TableCell colSpan={7} className="py-8">
                        <EmptyState
                          variant="loading"
                          title="운영 정보를 불러오는 중입니다."
                          description="발송 로그를 확인하고 있습니다."
                          className="mx-auto max-w-md border-0 bg-transparent py-0"
                        />
                      </TableCell>
                    </TableRow>
                  ) : logsError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8">
                        <ErrorState
                          title="정보를 다시 불러오지 못했습니다."
                          description="잠시 후 다시 시도해 주세요."
                          retryLabel="다시 시도"
                          onRetry={() => utils.pushNotifications.logs.invalidate()}
                          className="mx-auto max-w-md border-0 bg-transparent py-0"
                        />
                      </TableCell>
                    </TableRow>
                  ) : logRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8">
                        <EmptyState
                          title="처리할 Push 운영 항목이 없습니다."
                          description="현재 조건에 맞는 발송 로그가 없습니다."
                          className="mx-auto max-w-md border-0 bg-transparent py-0"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    logRows.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {pushTypeLabels[log.type] ?? "기타 알림"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              statusClasses[log.status] ??
                              "bg-muted/60 text-foreground"
                            }
                          >
                            {pushStatusLabels[log.status] ?? "기타 상태"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatPushLogUserLabel(log)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {log.sourceType
                            ? (pushSourceTypeLabels[log.sourceType] ??
                              "기타 소스")
                            : "-"}
                          {log.sourceId ? ` #${log.sourceId}` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.errorCode ?? "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {log.sentAt
                            ? new Date(log.sentAt).toLocaleString("ko-KR")
                            : "-"}
                        </TableCell>
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
