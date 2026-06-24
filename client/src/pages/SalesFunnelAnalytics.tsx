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
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatUserWithRole, getRoleLabel } from "@/lib/userRole";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Filter,
  LineChart,
  RefreshCcw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

type Period = "today" | "last7" | "month" | "lastMonth" | "custom";
type OrganizationType = "all" | "sub_branch" | "team" | "user";
type OwnershipScope = "managed" | "mine" | "member";
type PerformanceBasis = "new_contract" | "monthly_premium";

const periodLabels: Record<Period, string> = {
  today: "오늘",
  last7: "최근 7일",
  month: "이번 달",
  lastMonth: "지난달",
  custom: "직접 선택",
};

const organizationLabels: Record<OrganizationType, string> = {
  all: "전체",
  sub_branch: "부지점",
  team: "팀",
  user: "개인",
};

const funnelColors = [
  "#0f172a",
  "#64748b",
  "#0f766e",
  "#b45309",
  "#047857",
  "#1d4ed8",
  "#0f3f32",
];

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function formatWon(value: number | null | undefined) {
  return `${formatNumber(value)}원`;
}

function formatRate(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "navy",
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof BarChart3;
  tone?: "navy" | "green" | "amber" | "red";
}) {
  const toneClass = {
    navy: "bg-slate-950 text-white",
    green: "bg-[#0f3f32] text-white",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-50 text-red-700",
  }[tone];

  return (
    <Card className="border-slate-200/80 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">{title}</p>
            <p className="mt-1 truncate text-2xl font-bold tabular-nums text-slate-950">
              {value}
            </p>
          </div>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              toneClass
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function FunnelStageCard({ stage, index }: { stage: any; index: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
          <p className="mt-1 text-xs text-slate-500">{stage.helper}</p>
        </div>
        <Badge className="border-transparent bg-white text-slate-700 shadow-sm">
          {stage.conversionRate == null
            ? "기준"
            : formatRate(stage.conversionRate)}
        </Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold tabular-nums text-slate-950">
          {stage.amount != null
            ? formatWon(stage.amount)
            : `${formatNumber(stage.count)}건`}
        </p>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(8, Math.min(100, Number(stage.conversionRate ?? 100)))}%`,
              backgroundColor: funnelColors[index % funnelColors.length],
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function SalesFunnelAnalytics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [organizationType, setOrganizationType] =
    useState<OrganizationType>("all");
  const [subBranchAdminId, setSubBranchAdminId] = useState("all");
  const [teamId, setTeamId] = useState("all");
  const [targetUserId, setTargetUserId] = useState("all");
  const [ownershipScope, setOwnershipScope] =
    useState<OwnershipScope>("managed");
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [performanceBasis, setPerformanceBasis] =
    useState<PerformanceBasis>("monthly_premium");

  const { data: filterOptions, isLoading: filterLoading } =
    trpc.salesReports.filterOptions.useQuery();
  const isMember = user?.role === "member";
  const effectiveOwnershipScope = isMember ? "mine" : ownershipScope;
  const selectedMember = (filterOptions?.users ?? []).find(
    item => String(item.id) === selectedMemberId
  );
  const needsMemberSelection =
    !isMember &&
    effectiveOwnershipScope === "member" &&
    selectedMemberId === "all";
  const ownershipScopeHelper =
    effectiveOwnershipScope === "member"
      ? selectedMember
        ? `${formatUserWithRole(selectedMember)}의 담당 고객 기준으로 집계합니다.`
        : "확인할 조직원을 선택하세요."
      : effectiveOwnershipScope === "mine"
        ? "내가 담당자인 고객만 기준으로 집계합니다."
        : "권한 범위 내 산하 고객까지 포함한 파이프라인입니다.";

  const reportInput = useMemo(
    () => ({
      period,
      dateFrom: period === "custom" && dateFrom ? dateFrom : undefined,
      dateTo: period === "custom" && dateTo ? dateTo : undefined,
      organizationType: isMember ? ("all" as const) : organizationType,
      subBranchAdminId:
        !isMember &&
        organizationType === "sub_branch" &&
        subBranchAdminId !== "all"
          ? Number(subBranchAdminId)
          : undefined,
      teamId:
        !isMember && organizationType === "team" && teamId !== "all"
          ? Number(teamId)
          : undefined,
      userId:
        !isMember && organizationType === "user" && targetUserId !== "all"
          ? Number(targetUserId)
          : undefined,
      ownershipScope: effectiveOwnershipScope,
      selectedUserId:
        !isMember &&
        effectiveOwnershipScope === "member" &&
        selectedMemberId !== "all"
          ? Number(selectedMemberId)
          : undefined,
      performanceBasis,
    }),
    [
      dateFrom,
      dateTo,
      effectiveOwnershipScope,
      isMember,
      organizationType,
      performanceBasis,
      period,
      selectedMemberId,
      subBranchAdminId,
      targetUserId,
      teamId,
    ]
  );

  const { data, isLoading, isFetching, isError, refetch } =
    trpc.salesReports.summary.useQuery(reportInput, {
      enabled: !needsMemberSelection,
      placeholderData: prev => prev,
    });

  const stages = data?.funnel.stages ?? [];
  const ranking = data?.ranking ?? [];
  const performance = data?.performance;
  const hasData = Boolean(data && !data.empty);
  const selectedOrgLabel =
    organizationType === "all"
      ? "전체 조직"
      : organizationType === "sub_branch"
        ? subBranchAdminId === "all"
          ? "부지점 전체"
          : (filterOptions?.subBranches?.find(
              item => String(item.id) === subBranchAdminId
            )?.name ?? "부지점 선택")
        : organizationType === "team"
          ? teamId === "all"
            ? "팀 전체"
            : (filterOptions?.teams?.find(item => String(item.id) === teamId)
                ?.name ?? "팀 선택")
          : targetUserId === "all"
            ? "개인 전체"
            : formatUserWithRole(
                filterOptions?.users?.find(
                  item => String(item.id) === targetUserId
                ) ?? { name: "개인 선택", role: "member" }
              );
  const selectedScopeLabel = isMember
    ? "내 담당 고객"
    : effectiveOwnershipScope === "managed"
      ? "산하 전체"
      : effectiveOwnershipScope === "mine"
        ? "내 담당 고객"
        : selectedMember
          ? `조직원별: ${formatUserWithRole(selectedMember)}`
          : "조직원별: 선택 필요";
  const rankingPolicyLabel = data?.scope.canViewRanking
    ? "구성원 비교 표시"
    : effectiveOwnershipScope === "member"
      ? "선택 조직원 단일 범위라 랭킹 숨김"
      : "내 담당 고객 단일 범위라 랭킹 숨김";
  const bottleneckChecklist = data?.bottleneck
    ? [
        `${data.bottleneck.customerSegment} 고객군을 먼저 확인`,
        data.bottleneck.action,
        "이번 주 상담/후속관리 일정으로 전환 여부 점검",
      ]
    : [];

  const conversionRows = [
    {
      label: "DB 대비 상담 전환율",
      value: performance?.dbToConsultRate ?? 0,
      helper: "보유 DB 중 상담으로 진입한 비율",
    },
    {
      label: "상담 대비 계약 전환율",
      value: performance?.consultToContractRate ?? 0,
      helper: "상담 진행 고객 중 계약이 발생한 비율",
    },
    {
      label: "후속관리 완료율",
      value: performance?.followUpCompletionRate ?? 0,
      helper: "기간 내 생성/예정 후속관리 대비 완료율",
    },
    {
      label: "후속관리 완료 대비 계약",
      value: performance?.followUpCompleteToContractRate ?? 0,
      helper: "후속 완료 흐름이 계약으로 이어진 비율",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-5 pb-8">
        <Card className="overflow-hidden border-slate-200/80 bg-slate-950 text-white shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100">
                  신규 로드맵 PR5
                </Badge>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    영업 퍼널·성과 리포트
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                    DB 보유부터 상담, 후속관리, 계약, 월납보험료 실적까지 한
                    흐름으로 보고 현재 병목과 이번 달 개선 지점을 확인합니다.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[420px]">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-slate-400">기간</p>
                  <p className="mt-1 font-semibold text-white">
                    {periodLabels[period]}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-slate-400">범위</p>
                  <p className="mt-1 font-semibold text-white">
                    {data?.scope.label ?? "조회 중"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-slate-400">기준</p>
                  <p className="mt-1 font-semibold text-white">
                    {performanceBasis === "monthly_premium"
                      ? "월납보험료"
                      : "신규 계약"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-slate-400">권한</p>
                  <p className="mt-1 font-semibold text-white">
                    {getRoleLabel(user?.role)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-[#0f3f32]" />
              리포트 필터
            </CardTitle>
            <CardDescription>
              서버에서 권한 범위를 다시 검증한 뒤 리포트를 계산합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-[1.1fr_1.2fr_1.1fr_1fr_auto]">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">기간</Label>
              <Select
                value={period}
                onValueChange={value => setPeriod(value as Period)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(periodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isMember && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">조직</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={organizationType}
                    onValueChange={value => {
                      setOrganizationType(value as OrganizationType);
                      setSubBranchAdminId("all");
                      setTeamId("all");
                      setTargetUserId("all");
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(organizationLabels).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  {organizationType === "sub_branch" && (
                    <Select
                      value={subBranchAdminId}
                      onValueChange={setSubBranchAdminId}
                      disabled={filterLoading}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                        <SelectValue placeholder="부지점" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">부지점 선택</SelectItem>
                        {(filterOptions?.subBranches ?? []).map(item => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {organizationType === "team" && (
                    <Select
                      value={teamId}
                      onValueChange={setTeamId}
                      disabled={filterLoading}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                        <SelectValue placeholder="팀" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">팀 선택</SelectItem>
                        {(filterOptions?.teams ?? []).map(item => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {organizationType === "user" && (
                    <Select
                      value={targetUserId}
                      onValueChange={setTargetUserId}
                      disabled={filterLoading}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                        <SelectValue placeholder="개인" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">개인 선택</SelectItem>
                        {(filterOptions?.users ?? []).map(item => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {formatUserWithRole(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {organizationType === "all" && (
                    <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                      전체 범위
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-slate-500">파이프라인 범위</Label>
              {isMember ? (
                <div className="flex h-11 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
                  내 담당 고객 고정
                </div>
              ) : (
                <div className="grid min-h-11 grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(
                    [
                      ["managed", "산하 전체"],
                      ["mine", "내 담당 고객"],
                      ["member", "조직원별"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "rounded-lg px-2 py-2 text-sm font-semibold transition",
                        effectiveOwnershipScope === value
                          ? "bg-slate-950 text-white shadow-sm"
                          : "text-slate-600 hover:bg-white"
                      )}
                      onClick={() => {
                        setOwnershipScope(value);
                        if (value !== "member") setSelectedMemberId("all");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {!isMember && effectiveOwnershipScope === "member" && (
                <Select
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  disabled={filterLoading}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                    <SelectValue placeholder="조직원 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">조직원 선택</SelectItem>
                    {(filterOptions?.users ?? []).map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {formatUserWithRole(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs leading-relaxed text-slate-500">
                {ownershipScopeHelper}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-500">성과 기준</Label>
              <div className="grid grid-cols-1 gap-2">
                <Select
                  value={performanceBasis}
                  onValueChange={value =>
                    setPerformanceBasis(value as PerformanceBasis)
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly_premium">월납보험료</SelectItem>
                    <SelectItem value="new_contract">신규 계약</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                onClick={() => refetch()}
                disabled={isFetching || needsMemberSelection}
              >
                <RefreshCcw
                  className={cn("h-4 w-4", isFetching && "animate-spin")}
                />
                새로고침
              </Button>
            </div>

            {period === "custom" && (
              <div className="grid gap-3 lg:col-span-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">시작일</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={event => setDateFrom(event.target.value)}
                    className="h-11 rounded-xl bg-slate-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">종료일</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={event => setDateTo(event.target.value)}
                    className="h-11 rounded-xl bg-slate-50"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold text-slate-500">
                현재 조회 범위
              </p>
              <p className="mt-1 text-sm font-bold text-slate-950">
                {selectedScopeLabel}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {ownershipScopeHelper}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold text-slate-500">조직 필터</p>
              <p className="mt-1 text-sm font-bold text-slate-950">
                {isMember ? "본인 담당 고객" : selectedOrgLabel}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                서버에서 역할별 권한 범위를 다시 검증한 뒤 집계합니다.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold text-slate-500">
                랭킹 표시 정책
              </p>
              <p className="mt-1 text-sm font-bold text-slate-950">
                {rankingPolicyLabel}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                단일 담당자 범위에서는 비교보다 해당 파이프라인 병목을 우선
                표시합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {isError && (
          <ErrorState
            title="리포트를 불러오지 못했습니다."
            description="필터 범위 또는 권한을 확인한 뒤 다시 시도해 주세요."
            onRetry={() => refetch()}
          />
        )}

        {!isError && needsMemberSelection && (
          <EmptyState
            icon={Users}
            title="확인할 조직원을 선택하세요."
            description="조직원별 보기는 선택한 조직원이 담당자인 고객만 기준으로 파이프라인을 집계합니다."
          />
        )}

        {!isError && !needsMemberSelection && isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        )}

        {!isError && !needsMemberSelection && data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="신규 계약"
                value={`${formatNumber(performance?.newContractCount)}건`}
                helper="기간 내 신규 계약 등록"
                icon={ClipboardList}
                tone="navy"
              />
              <StatCard
                title="월납보험료 실적"
                value={formatWon(performance?.monthlyPremiumTotal)}
                helper="기간 내 신규 계약 월납 합계"
                icon={WalletCards}
                tone="green"
              />
              <StatCard
                title="상담기록 수"
                value={`${formatNumber(performance?.consultationCount)}건`}
                helper="기간 내 상담기록 등록"
                icon={Users}
                tone="amber"
              />
              <StatCard
                title="목표 대비 달성률"
                value={formatRate(performance?.goalAchievementRate)}
                helper="선택한 성과 기준 기준"
                icon={Target}
                tone={
                  (performance?.goalAchievementRate ?? 0) < 50 ? "red" : "green"
                }
              />
              <StatCard
                title="후속관리 생성"
                value={`${formatNumber(performance?.followUpCreatedCount)}건`}
                helper="기간 내 새 후속관리"
                icon={CalendarDays}
                tone="navy"
              />
              <StatCard
                title="후속관리 완료"
                value={`${formatNumber(performance?.followUpCompletedCount)}건`}
                helper={`완료율 ${formatRate(performance?.followUpCompletionRate)}`}
                icon={CheckCircle2}
                tone="green"
              />
              <StatCard
                title="미처리 후속관리"
                value={`${formatNumber(performance?.pendingFollowUpCount)}건`}
                helper="오늘 처리 흐름에서 확인 필요"
                icon={AlertTriangle}
                tone={
                  (performance?.pendingFollowUpCount ?? 0) > 0 ? "red" : "green"
                }
              />
              <StatCard
                title="장기 미관리 고객"
                value={`${formatNumber(performance?.longUnmanagedCustomerCount)}명`}
                helper="기존 기준 점검 연락 대상"
                icon={TrendingDown}
                tone={
                  (performance?.longUnmanagedCustomerCount ?? 0) > 0
                    ? "amber"
                    : "green"
                }
              />
            </div>

            {!hasData && (
              <EmptyState
                icon={LineChart}
                title={
                  effectiveOwnershipScope === "mine"
                    ? "내 담당 고객 파이프라인 데이터가 없습니다."
                    : "표시할 영업 흐름 데이터가 없습니다."
                }
                description={
                  effectiveOwnershipScope === "mine"
                    ? "내가 담당자인 고객 중 선택한 기간에 상담, 후속관리, 계약 데이터가 아직 없습니다. 고객을 배정받거나 직접 등록하면 이곳에 표시됩니다."
                    : "선택한 기간 또는 조직 범위에 상담, 후속관리, 계약 데이터가 아직 없습니다. 기간을 넓히거나 필터를 초기화해 보세요."
                }
              />
            )}

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <Card className="border-slate-200/80 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-[#0f3f32]" />
                    영업 퍼널
                  </CardTitle>
                  <CardDescription>
                    {formatDateLabel(data.period.dateFrom)} ~{" "}
                    {formatDateLabel(data.period.dateTo)} 기준 단계별 건수와
                    전환 흐름입니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="hidden h-[360px] lg:block">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stages}
                        layout="vertical"
                        margin={{ top: 8, right: 46, left: 28, bottom: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal
                          className="stroke-slate-200"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          dataKey="label"
                          type="category"
                          width={112}
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(15,23,42,0.05)" }}
                          contentStyle={{
                            borderRadius: 12,
                            borderColor: "#e2e8f0",
                          }}
                          formatter={(value, _name, props) => {
                            const row = props.payload as any;
                            return [
                              row.amount != null
                                ? formatWon(row.amount)
                                : `${formatNumber(Number(value))}건`,
                              row.label,
                            ];
                          }}
                        />
                        <Bar
                          dataKey="count"
                          radius={[0, 10, 10, 0]}
                          barSize={28}
                        >
                          {stages.map((entry, index) => (
                            <Cell
                              key={entry.key}
                              fill={funnelColors[index % funnelColors.length]}
                            />
                          ))}
                          <LabelList
                            dataKey="count"
                            position="right"
                            formatter={(value: unknown) =>
                              `${formatNumber(Number(value))}건`
                            }
                            style={{
                              fill: "#334155",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid gap-3 lg:hidden">
                    {stages.map((stage, index) => (
                      <FunnelStageCard
                        key={stage.key}
                        stage={stage}
                        index={index}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-[#0f3f32]" />
                    전환율 분석
                  </CardTitle>
                  <CardDescription>
                    0분모 구간은 0%로 안전하게 표시합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {conversionRows.map(row => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {row.label}
                        </p>
                        <Badge
                          className={cn(
                            "border-transparent",
                            row.value < 40
                              ? "bg-red-50 text-red-700"
                              : row.value < 70
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          {formatRate(row.value)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.helper}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-slate-200/80 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    병목 진단
                  </CardTitle>
                  <CardDescription>
                    가장 낮은 전환 구간을 기준으로 우선 개선 지점을 제안합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-amber-950">
                          {data.bottleneck.title}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-amber-900">
                          {data.bottleneck.priority}
                        </p>
                      </div>
                      <Badge className="bg-white text-amber-800">
                        {formatRate(data.bottleneck.rate)}
                      </Badge>
                    </div>
                    <div className="mt-4 rounded-xl bg-white/75 p-3 text-sm text-amber-950">
                      <p className="font-semibold">추천 행동</p>
                      <p className="mt-1 text-amber-900">
                        {data.bottleneck.action}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {bottleneckChecklist.map((item, index) => (
                        <div
                          key={item}
                          className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-amber-950"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-950">
                            {index + 1}
                          </span>
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-amber-800">
                      확인할 고객군: {data.bottleneck.customerSegment}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(data.bottleneck.allCandidates ?? []).map((item: any) => (
                      <div
                        key={item.key}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="text-xs font-semibold text-slate-500">
                          {item.title}
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-950">
                          {formatRate(item.rate)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-[#0f3f32]" />
                    팀원 성과 비교
                  </CardTitle>
                  <CardDescription>
                    {data.scope.canViewRanking
                      ? "권한 범위 내 구성원별 개선 필요 항목을 함께 표시합니다."
                      : effectiveOwnershipScope === "member"
                        ? "조직원별 보기에서는 팀원 비교를 표시하지 않습니다."
                        : "내 담당 고객 보기에서는 구성원 비교를 표시하지 않습니다."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!data.scope.canViewRanking ? (
                    <EmptyState
                      title={
                        effectiveOwnershipScope === "member"
                          ? "선택한 조직원 기준입니다."
                          : "내 담당 고객 기준입니다."
                      }
                      description={
                        effectiveOwnershipScope === "member"
                          ? "조직원별 보기에서는 팀원 비교 대신 선택한 조직원의 담당 고객 파이프라인만 표시합니다."
                          : "내 담당 고객 보기에서는 팀원 비교 대신 본인 파이프라인 지표만 표시합니다."
                      }
                    />
                  ) : ranking.length === 0 ? (
                    <EmptyState
                      title="비교할 구성원이 없습니다."
                      description="조직 필터를 넓히거나 기간을 변경해 주세요."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs text-slate-500">
                          <tr className="border-b border-slate-200">
                            <th className="px-3 py-2 font-semibold">구성원</th>
                            <th className="px-3 py-2 font-semibold">
                              신규 계약
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              월납 실적
                            </th>
                            <th className="px-3 py-2 font-semibold">상담</th>
                            <th className="px-3 py-2 font-semibold">
                              후속 완료율
                            </th>
                            <th className="px-3 py-2 font-semibold">
                              개선 필요
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ranking
                            .slice(0, 10)
                            .map((row: any, index: number) => (
                              <tr
                                key={row.userId}
                                className="border-b border-slate-100 last:border-0"
                              >
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                                      {index + 1}
                                    </span>
                                    <div>
                                      <p className="font-semibold text-slate-950">
                                        {row.name}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {getRoleLabel(row.role)}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 font-semibold tabular-nums">
                                  {formatNumber(row.newContractCount)}건
                                </td>
                                <td className="px-3 py-3 font-semibold tabular-nums">
                                  {formatWon(row.monthlyPremiumTotal)}
                                </td>
                                <td className="px-3 py-3 tabular-nums">
                                  {formatNumber(row.consultationCount)}건
                                </td>
                                <td className="px-3 py-3 tabular-nums">
                                  {formatRate(row.followUpCompletionRate)}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(row.improvementAreas?.length
                                      ? row.improvementAreas
                                      : ["현재 특이 병목 없음"]
                                    )
                                      .slice(0, 2)
                                      .map((item: string) => (
                                        <Badge
                                          key={item}
                                          variant="outline"
                                          className="bg-white text-slate-600"
                                        >
                                          {item}
                                        </Badge>
                                      ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
