import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getRoleLabel } from "@/lib/userRole";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ClipboardCopy,
  FileText,
  Loader2,
  RefreshCcw,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const REPORT_TYPE_LABELS: Record<string, string> = {
  daily: "일일 운영 보고서",
  weekly: "주간 운영 보고서",
  monthly: "월간 관리 보고서",
  team: "팀장 보고서",
  sub_branch: "부지점 보고서",
};

const RISK_LABELS: Record<string, string> = {
  normal: "정상",
  low: "주의",
  medium: "점검 필요",
  high: "우선 확인",
};

function KpiCard({
  title,
  value,
  suffix = "",
}: {
  title: string;
  value: number | string | null | undefined;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[#1f3b57]">
        {value ?? 0}
        {suffix ? (
          <span className="ml-1 text-sm font-medium text-slate-500">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
  }
}

export default function ManagementReports() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState("weekly");
  const [periodType, setPeriodType] = useState("week");
  const [targetTeamId, setTargetTeamId] = useState<string>("all");
  const [targetSubBranchId, setTargetSubBranchId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(true);

  const { data: filterOptions } =
    trpc.managementReports.filterOptions.useQuery();

  const queryInput = useMemo(
    () => ({
      reportType: reportType as
        | "daily"
        | "weekly"
        | "monthly"
        | "team"
        | "sub_branch",
      periodType: periodType as "today" | "week" | "month" | "custom",
      dateFrom: periodType === "custom" ? dateFrom || undefined : undefined,
      dateTo: periodType === "custom" ? dateTo || undefined : undefined,
      targetTeamId: targetTeamId !== "all" ? Number(targetTeamId) : undefined,
      targetSubBranchId:
        targetSubBranchId !== "all" ? Number(targetSubBranchId) : undefined,
    }),
    [dateFrom, dateTo, periodType, reportType, targetSubBranchId, targetTeamId]
  );

  const { data, isLoading, isFetching, isError, refetch } =
    trpc.managementReports.generate.useQuery(queryInput, {
      enabled: periodType !== "custom" || Boolean(dateFrom && dateTo),
    });

  const showSubBranchFilter =
    (filterOptions?.subBranches.length ?? 0) > 0 &&
    (reportType === "sub_branch" || user?.role === "branch_admin");
  const showTeamFilter =
    (filterOptions?.teams.length ?? 0) > 0 &&
    (reportType === "team" || user?.role !== "team_leader");

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-8">
        <Card className="border-slate-200/80 bg-gradient-to-br from-[#f8f6f1] via-white to-[#eef4f1] shadow-sm">
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
                  Management Reports
                </p>
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1f3b57]/10 bg-[#1f3b57] text-white">
                    <FileText className="h-5 w-5" />
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight text-[#1f3b57]">
                    관리자 보고서
                  </h1>
                </div>
                <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                  팀장·부지점장 단위 운영 현황을 요약해 코칭과 업무 누락 방지에
                  활용합니다. 고객 개인정보는 포함하지 않습니다.
                </p>
                <Badge
                  variant="outline"
                  className="border-[#1f3b57]/15 bg-white text-[#1f3b57]"
                >
                  {getRoleLabel(user?.role)}
                </Badge>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 shrink-0"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
                보고서 새로고침
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">보고서 유형</Label>
                <Select
                  value={reportType}
                  onValueChange={value => {
                    setReportType(value);
                    if (value === "daily") setPeriodType("today");
                    else if (value === "weekly") setPeriodType("week");
                    else if (value === "monthly") setPeriodType("month");
                  }}
                >
                  <SelectTrigger className="min-h-10 rounded-xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(filterOptions?.reportTypes ?? ["weekly"]).map(type => (
                      <SelectItem key={type} value={type}>
                        {REPORT_TYPE_LABELS[type] ?? type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">기간</Label>
                <Select value={periodType} onValueChange={setPeriodType}>
                  <SelectTrigger className="min-h-10 rounded-xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">오늘</SelectItem>
                    <SelectItem value="week">이번 주</SelectItem>
                    <SelectItem value="month">이번 달</SelectItem>
                    <SelectItem value="custom">직접 선택</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {showSubBranchFilter ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">부지점</Label>
                  <Select
                    value={targetSubBranchId}
                    onValueChange={setTargetSubBranchId}
                  >
                    <SelectTrigger className="min-h-10 rounded-xl bg-white">
                      <SelectValue placeholder="부지점 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 부지점</SelectItem>
                      {filterOptions?.subBranches.map(item => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {showTeamFilter ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">팀</Label>
                  <Select value={targetTeamId} onValueChange={setTargetTeamId}>
                    <SelectTrigger className="min-h-10 rounded-xl bg-white">
                      <SelectValue placeholder="팀 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 팀</SelectItem>
                      {filterOptions?.teams.map(item => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {periodType === "custom" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">시작일</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={event => setDateFrom(event.target.value)}
                    className="min-h-10 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">종료일</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={event => setDateTo(event.target.value)}
                    className="min-h-10 rounded-xl bg-white"
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map(item => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-white/80"
              />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="보고서를 생성하지 못했습니다"
            description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            onRetry={() => refetch()}
          />
        ) : data?.empty ? (
          <EmptyState
            title="선택한 기간에 보고서로 표시할 데이터가 없습니다."
            description="기간이나 조직 범위를 변경해 다시 생성해 주세요."
          />
        ) : data ? (
          <>
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-[#1f3b57]">
                  {REPORT_TYPE_LABELS[data.reportMeta.reportType]}
                </CardTitle>
                <CardDescription>
                  {data.reportMeta.scope.label} ·{" "}
                  {new Date(data.reportMeta.dateFrom).toLocaleDateString(
                    "ko-KR"
                  )}{" "}
                  ~{" "}
                  {new Date(data.reportMeta.dateTo).toLocaleDateString("ko-KR")}
                  {" · "}생성:{" "}
                  {new Date(data.reportMeta.generatedAt).toLocaleString(
                    "ko-KR"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  title="활성 담당자"
                  value={data.summary.activeUserCount}
                  suffix="명"
                />
                <KpiCard
                  title="담당 고객"
                  value={data.summary.customerCount}
                  suffix="명"
                />
                <KpiCard
                  title="상담기록"
                  value={data.summary.consultationCount}
                  suffix="건"
                />
                <KpiCard
                  title="후속관리 완료율"
                  value={data.summary.followUpCompletionRate}
                  suffix="%"
                />
                <KpiCard
                  title="지연 후속관리"
                  value={data.summary.overdueFollowUpCount}
                  suffix="건"
                />
                <KpiCard
                  title="미완료 일정"
                  value={data.summary.incompleteScheduleCount}
                  suffix="건"
                />
                <KpiCard
                  title="미확인 알림"
                  value={data.summary.unreadNotificationCount}
                  suffix="건"
                />
                <KpiCard
                  title="신규 계약"
                  value={data.summary.newContractCount}
                  suffix="건"
                />
                <KpiCard
                  title="장기 미관리 고객"
                  value={data.summary.longUnmanagedCustomerCount}
                  suffix="명"
                />
                <KpiCard
                  title="목표 달성률"
                  value={data.summary.goalAchievementRate}
                  suffix="%"
                />
              </CardContent>
            </Card>

            {data.topIssues.length > 0 ? (
              <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-[#1f3b57]">
                    <AlertTriangle className="h-4 w-4" />
                    우선 조치 항목
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {data.topIssues.map(issue => (
                    <div
                      key={issue.type}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">
                          {issue.label}
                        </p>
                        <Badge variant="outline">{issue.count}건</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {issue.recommendation}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#1f3b57]">
                  <Users className="h-4 w-4" />
                  팀원별 현황
                </CardTitle>
                <CardDescription>
                  코칭과 운영 점검을 위한 집계 지표입니다. 고객 개인정보는
                  포함하지 않습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>역할</TableHead>
                        <TableHead>소속</TableHead>
                        <TableHead className="text-right">상담</TableHead>
                        <TableHead className="text-right">
                          후속 완료율
                        </TableHead>
                        <TableHead className="text-right">지연 후속</TableHead>
                        <TableHead className="text-right">
                          미완료 일정
                        </TableHead>
                        <TableHead className="text-right">
                          미확인 알림
                        </TableHead>
                        <TableHead className="text-right">신규 계약</TableHead>
                        <TableHead>위험도</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.map(row => (
                        <TableRow key={row.userId}>
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell>{getRoleLabel(row.role)}</TableCell>
                          <TableCell>{row.teamName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.metrics.consultationCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.metrics.followUpCompletionRate ?? "-"}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.metrics.overdueFollowUpCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.metrics.incompleteScheduleCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.metrics.unreadNotificationCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.metrics.newContractCount}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {RISK_LABELS[row.riskLevel] ?? row.riskLevel}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {data.users.map(row => (
                    <div
                      key={row.userId}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {row.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {getRoleLabel(row.role)} · {row.teamName}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {RISK_LABELS[row.riskLevel] ?? row.riskLevel}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2">
                          상담 {row.metrics.consultationCount}건
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          후속 {row.metrics.followUpCompletionRate ?? "-"}%
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          지연 {row.metrics.overdueFollowUpCount}건
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          일정 {row.metrics.incompleteScheduleCount}건
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          알림 {row.metrics.unreadNotificationCount}건
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          계약 {row.metrics.newContractCount}건
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {row.coachingPoint}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
              <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full min-h-10 items-start justify-between gap-3 text-left"
                    >
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg text-[#1f3b57]">
                          <BarChart3 className="h-4 w-4" />
                          자동 요약
                        </CardTitle>
                        <CardDescription className="mt-1">
                          관리자 코칭용 해석 문장과 공유용 요약입니다.
                        </CardDescription>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform",
                          summaryOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm leading-relaxed text-slate-700">
                      {data.narrativeSummary}
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">
                          복사용 요약
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-10"
                          onClick={() =>
                            copyText(
                              data.copyableSummary,
                              "복사용 요약을 복사했습니다."
                            )
                          }
                        >
                          <ClipboardCopy className="mr-2 h-4 w-4" />
                          복사
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                        {data.copyableSummary}
                      </pre>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
