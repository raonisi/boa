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
  ChevronDown,
  Database,
  ExternalLink,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const QUALITY_LEVEL_BADGES: Record<string, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  needs_improvement: "border-amber-200 bg-amber-50 text-amber-900",
  caution: "border-orange-200 bg-orange-50 text-orange-900",
  critical: "border-rose-200 bg-rose-50 text-rose-900",
};

const SEVERITY_BADGES: Record<string, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-600",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  high: "border-rose-200 bg-rose-50 text-rose-900",
};

function KpiCard({
  title,
  value,
  suffix = "",
}: {
  title: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[#1f3b57]">
        {value}
        {suffix ? (
          <span className="ml-1 text-sm font-medium text-slate-500">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function formatManagedDate(value: string | null) {
  if (!value) return "관리 이력 없음";
  return new Date(value).toLocaleDateString("ko-KR");
}

export default function CustomerDataQualityDashboard() {
  const { user } = useAuth();
  const [issueType, setIssueType] = useState("all");
  const [qualityLevel, setQualityLevel] = useState("all");
  const [assignedUserId, setAssignedUserId] = useState("all");
  const [teamId, setTeamId] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "quality_score_asc" | "last_managed_asc" | "issue_count_desc"
  >("quality_score_asc");
  const [detailsOpen, setDetailsOpen] = useState(true);

  const { data: filterOptions } =
    trpc.customerDataQuality.filterOptions.useQuery();
  const queryInput = useMemo(
    () => ({
      issueType: issueType !== "all" ? issueType : undefined,
      qualityLevel:
        qualityLevel !== "all"
          ? (qualityLevel as
              | "good"
              | "needs_improvement"
              | "caution"
              | "critical")
          : undefined,
      assignedUserId:
        assignedUserId !== "all" ? Number(assignedUserId) : undefined,
      teamId: teamId !== "all" ? Number(teamId) : undefined,
      search: search.trim() || undefined,
      sortBy,
      limit: 25,
      offset: 0,
    }),
    [assignedUserId, issueType, qualityLevel, search, sortBy, teamId]
  );

  const { data, isLoading, isFetching, isError, refetch } =
    trpc.customerDataQuality.dashboard.useQuery(queryInput);

  const pageTitle = filterOptions?.memberViewLabel ?? "고객 데이터 점검";
  const isMember = user?.role === "member";

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">고객 데이터를 점검하고 있습니다...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout>
        <ErrorState
          title="데이터를 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요."
          onRetry={() => refetch()}
        />
      </DashboardLayout>
    );
  }

  if (!data) return null;

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-8">
        <Card className="border-slate-200/80 bg-gradient-to-br from-[#f8f6f1] via-white to-[#eef4f1] shadow-sm">
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
                  Data Quality
                </p>
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1f3b57]/10 bg-[#1f3b57] text-white">
                    <Database className="h-5 w-5" />
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight text-[#1f3b57]">
                    {pageTitle}
                  </h1>
                </div>
                <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                  {isMember
                    ? "본인 담당 고객 중 보완이 필요한 항목을 확인합니다. 고객정보는 자동으로 수정하지 않으며, 고객 상세·후속관리·고객 병합 화면에서 직접 처리해 주세요."
                    : "고객 DB가 늘어날수록 발생하는 입력 누락, 관리 공백, 중복 가능성, 장기 미관리 고객을 한눈에 점검합니다. 자동 수정·자동 삭제·자동 병합은 하지 않습니다."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="border-[#1f3b57]/15 bg-white text-[#1f3b57]"
                  >
                    {getRoleLabel(user?.role)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-800"
                  >
                    사용 가능
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-600"
                  >
                    일반
                  </Badge>
                </div>
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
                점검 새로고침
              </Button>
            </div>

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-full justify-between px-0 text-sm text-slate-600 hover:bg-transparent"
                >
                  운영 안내
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      detailsOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="rounded-xl border border-teal-200/70 bg-teal-50/70 p-3 text-xs leading-relaxed text-teal-900">
                <p>고객정보를 자동으로 수정하지 않습니다.</p>
                <p>
                  보완이 필요한 고객을 확인한 뒤, 기존 고객 상세·후속관리·고객
                  병합 화면에서 직접 처리해 주세요.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="전체 고객" value={data.summary.customerCount} />
          <KpiCard
            title="품질 문제 고객"
            value={data.summary.issueCustomerCount}
          />
          <KpiCard
            title="평균 품질 점수"
            value={data.summary.averageQualityScore}
            suffix="점"
          />
          <KpiCard
            title="우선 정리 필요"
            value={data.summary.criticalCustomerCount}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <KpiCard
            title="전화번호 누락"
            value={data.summary.missingPhoneCount}
          />
          <KpiCard
            title="담당자 없음"
            value={data.summary.unassignedCustomerCount}
          />
          <KpiCard title="후속관리 없음" value={data.summary.noFollowUpCount} />
          <KpiCard
            title="장기 미관리"
            value={data.summary.longUnmanagedCount}
          />
        </div>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">필터</CardTitle>
            <CardDescription>
              문제 유형, 품질 등급, 담당자 기준으로 점검 범위를 좁힐 수
              있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label>문제 유형</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger className="min-h-10">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {filterOptions?.issueTypes.map(item => (
                    <SelectItem key={item.type} value={item.type}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>품질 등급</Label>
              <Select value={qualityLevel} onValueChange={setQualityLevel}>
                <SelectTrigger className="min-h-10">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {filterOptions?.qualityLevels.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filterOptions?.canViewAssigneeBreakdown ? (
              <div className="space-y-2">
                <Label>담당자</Label>
                <Select
                  value={assignedUserId}
                  onValueChange={setAssignedUserId}
                >
                  <SelectTrigger className="min-h-10">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {filterOptions.assignees.map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {filterOptions?.canViewAssigneeBreakdown &&
            (filterOptions.teams.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <Label>팀</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger className="min-h-10">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {filterOptions.teams.map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>검색</Label>
              <Input
                className="min-h-10"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="고객명, 담당자, 문제 유형"
              />
            </div>
            <div className="space-y-2">
              <Label>정렬</Label>
              <Select
                value={sortBy}
                onValueChange={value => setSortBy(value as typeof sortBy)}
              >
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality_score_asc">
                    품질 점수 낮은 순
                  </SelectItem>
                  <SelectItem value="last_managed_asc">
                    최근 관리 오래된 순
                  </SelectItem>
                  <SelectItem value="issue_count_desc">문제 많은 순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.issueTypes.map(issue => (
            <button
              key={issue.type}
              type="button"
              className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:border-[#1f3b57]/20"
              onClick={() => setIssueType(issue.type)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#1f3b57]">{issue.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {issue.description}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0", SEVERITY_BADGES[issue.severity])}
                >
                  {issue.count}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                {issue.recommendedAction}
              </p>
            </button>
          ))}
        </div>

        {data.scope.canViewAssigneeBreakdown && data.assignees.length > 0 ? (
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                담당자별 품질 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-hidden">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>담당자</TableHead>
                      <TableHead>전체</TableHead>
                      <TableHead>문제 고객</TableHead>
                      <TableHead>평균 점수</TableHead>
                      <TableHead>우선 정리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assignees.map(assignee => (
                      <TableRow key={assignee.userId}>
                        <TableCell>{assignee.name}</TableCell>
                        <TableCell>{assignee.customerCount}</TableCell>
                        <TableCell>{assignee.issueCustomerCount}</TableCell>
                        <TableCell>{assignee.averageQualityScore}</TableCell>
                        <TableCell>{assignee.priorityIssueCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {data.assignees.map(assignee => (
                  <div
                    key={assignee.userId}
                    className="rounded-2xl border border-slate-200/80 p-4"
                  >
                    <p className="font-semibold text-[#1f3b57]">
                      {assignee.name}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <span>전체 {assignee.customerCount}</span>
                      <span>문제 {assignee.issueCustomerCount}</span>
                      <span>평균 {assignee.averageQualityScore}점</span>
                      <span>우선 {assignee.priorityIssueCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              고객별 품질 이슈
            </CardTitle>
            <CardDescription>
              전화번호, 생년월일, 보험료 등 민감 정보는 기본 목록에 표시하지
              않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.customers.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="현재 선택한 조건에 해당하는 데이터 품질 이슈가 없습니다."
                description="고객 DB가 안정적으로 관리되고 있습니다."
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>고객명</TableHead>
                        <TableHead>담당자</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>문제 유형</TableHead>
                        <TableHead>점수</TableHead>
                        <TableHead>마지막 관리</TableHead>
                        <TableHead>추천 조치</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.customers.map(customer => (
                        <TableRow key={customer.customerId}>
                          <TableCell className="font-medium">
                            {customer.customerDisplayName}
                          </TableCell>
                          <TableCell>{customer.assignedUserName}</TableCell>
                          <TableCell>{customer.status}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {customer.issueLabels.map(label => (
                                <Badge
                                  key={label}
                                  variant="outline"
                                  className="text-[11px]"
                                >
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                QUALITY_LEVEL_BADGES[customer.qualityLevel]
                              }
                            >
                              {customer.qualityScore}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatManagedDate(customer.lastManagedAt)}
                          </TableCell>
                          <TableCell className="max-w-xs text-xs text-slate-600">
                            {customer.recommendedAction}
                          </TableCell>
                          <TableCell>
                            <Link href={customer.links.customerDetail}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-10"
                              >
                                점검하기
                                <ExternalLink className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {data.customers.map(customer => (
                    <div
                      key={customer.customerId}
                      className="rounded-2xl border border-slate-200/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1f3b57]">
                            {customer.customerDisplayName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {customer.assignedUserName} · {customer.status}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            QUALITY_LEVEL_BADGES[customer.qualityLevel]
                          }
                        >
                          {customer.qualityScore}점
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {customer.issueLabels.map(label => (
                          <Badge
                            key={label}
                            variant="outline"
                            className="text-[11px]"
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-slate-600">
                        {customer.recommendedAction}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        마지막 관리: {formatManagedDate(customer.lastManagedAt)}
                      </p>
                      <Link href={customer.links.customerDetail}>
                        <Button className="mt-3 min-h-10 w-full">
                          점검하기
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
