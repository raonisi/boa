import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
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
import { formatUserWithRole } from "@/lib/userRole";
import {
  BarChart3,
  FilePlus2,
  Filter,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ec4899",
  "#6b7280",
];

function StatCard({
  title,
  value,
  suffix = "",
  highlight = false,
  helper,
  icon: Icon,
}: {
  title: string;
  value: number | string | undefined;
  suffix?: string;
  highlight?: boolean;
  helper?: string;
  icon?: React.ElementType;
}) {
  return (
    <Card
      className={`overflow-hidden border-slate-200/80 bg-white/95 shadow-sm ${highlight ? "ring-1 ring-[#d9c99f]" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {value ?? 0}
              {suffix && (
                <span className="ml-1 text-sm font-normal text-slate-500">
                  {suffix}
                </span>
              )}
            </p>
          </div>
          {Icon && (
            <span className="rounded-2xl bg-slate-50 p-2 text-[#b99b5f]">
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
      </CardContent>
    </Card>
  );
}

export default function Performance() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const now = new Date();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [agentIdFilter, setAgentIdFilter] = useState<string>("all");
  const [teamIdFilter, setTeamIdFilter] = useState<string>("all");
  const [productGroupFilter, setProductGroupFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM 형식
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine">("all");

  const { data: users } = trpc.users.list.useQuery();
  const { data: teams } = trpc.users.teams.useQuery();

  // 월 선택 시 dateFrom/dateTo 자동 변환
  const effectiveDateFrom = monthFilter
    ? `${monthFilter}-01`
    : dateFrom || undefined;
  const effectiveDateTo = monthFilter
    ? (() => {
        const [y, m] = monthFilter.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        return `${monthFilter}-${String(lastDay).padStart(2, "0")}`;
      })()
    : dateTo || undefined;

  const statsInput = useMemo(
    () => ({
      dateFrom: effectiveDateFrom,
      dateTo: effectiveDateTo,
      agentIdFilter:
        agentIdFilter !== "all" ? Number(agentIdFilter) : undefined,
      teamIdFilter: teamIdFilter !== "all" ? Number(teamIdFilter) : undefined,
      productGroup: productGroupFilter || undefined,
      company: companyFilter || undefined,
      region: regionFilter || undefined,
      source: sourceFilter || undefined,
      scope: user?.role === "branch_admin" ? scopeFilter : undefined,
    }),
    [
      effectiveDateFrom,
      effectiveDateTo,
      agentIdFilter,
      teamIdFilter,
      productGroupFilter,
      companyFilter,
      regionFilter,
      sourceFilter,
      scopeFilter,
      user?.role,
    ]
  );

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = trpc.performance.stats.useQuery(statsInput);
  const { data: goalDashboard } = trpc.performanceGoals.dashboard.useQuery({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const { data: workRhythm } = trpc.workRhythm.summary.useQuery({
    period: "month",
  });

  const barData = [
    { name: "미상담", value: stats?.uncontacted ?? 0 },
    { name: "부재", value: stats?.absent ?? 0 },
    { name: "통화완료", value: stats?.called ?? 0 },
    { name: "상담예정", value: stats?.scheduled ?? 0 },
    { name: "설계중", value: stats?.designing ?? 0 },
    {
      name: "신규 계약",
      value:
        stats?.newContractCount ??
        stats?.contractCount ??
        stats?.contracted ??
        0,
    },
  ];

  const rateData = [
    { name: "상담률", value: stats?.consultRate ?? 0 },
    { name: "계약률", value: stats?.contractRate ?? 0 },
    { name: "부재율", value: stats?.absentRate ?? 0 },
    { name: "보류·거절", value: stats?.heldRejectedRate ?? 0 },
  ];

  const roleTitle =
    user?.role === "branch_admin"
      ? "전체"
      : user?.role === "sub_branch_admin" || user?.role === "team_leader"
        ? "팀"
        : "내";
  const agents = (users ?? []).filter(
    u => (u as any).accountStatus === "active"
  );
  const monthlyPremium =
    stats?.monthlyPremiumTotal ?? stats?.monthlyPremiumSum ?? 0;
  const newContracts =
    stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted ?? 0;
  const firstGoal = (goalDashboard?.items ?? [])[0] as any;
  const premiumShortfall =
    firstGoal?.remaining?.monthlyPremium ??
    workRhythm?.remaining?.monthlyPremium ??
    0;
  const contractShortfall =
    firstGoal?.remaining?.contractCount ??
    workRhythm?.remaining?.contractCount ??
    0;
  const goalRate =
    firstGoal?.achievementRate?.monthlyPremium ??
    goalDashboard?.summary?.averagePremiumRate ??
    0;
  const remainingDays =
    firstGoal?.remainingDays ??
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() -
      now.getDate() +
      1;
  const hasPerformanceData = Boolean(
    newContracts || monthlyPremium || stats?.consultRate || stats?.assigned
  );
  const hasFilterInput =
    Boolean(monthFilter) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    agentIdFilter !== "all" ||
    teamIdFilter !== "all" ||
    Boolean(productGroupFilter.trim()) ||
    Boolean(companyFilter.trim()) ||
    Boolean(regionFilter.trim()) ||
    Boolean(sourceFilter.trim()) ||
    (user?.role === "branch_admin" && scopeFilter !== "all");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
              Performance
            </p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-950">실적관리</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {roleTitle} 범위의 신규 계약과 월납보험료 실적을 확인합니다.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                계약 유지 상태는 GA 본사 전산 기준으로 확인
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f3f32]">
                  Monthly Report
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  이번 달 성과 요약
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  신규 계약, 월납 실적, 목표 부족분, 오늘 필요한 행동량을 한
                  번에 확인합니다.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                이번 달 남은 기간 {remainingDays}일
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  label: "신규 계약",
                  value: `${newContracts.toLocaleString()}건`,
                  helper: "이번 달 신규 성과",
                },
                {
                  label: "월납보험료 실적",
                  value: `${monthlyPremium.toLocaleString()}원`,
                  helper: "월납 기준 합계",
                },
                {
                  label: "목표 달성률",
                  value: `${goalRate ?? 0}%`,
                  helper: "목표 대비 진행",
                },
                {
                  label: "목표까지 부족분",
                  value: `${Number(premiumShortfall ?? 0).toLocaleString()}원`,
                  helper: `신규 계약 ${contractShortfall ?? 0}건 부족`,
                },
                {
                  label: "오늘 필요한 행동량",
                  value: `${workRhythm?.recommendedTodayActions?.suggestedConsultationCount ?? 0}건`,
                  helper: "상담/후속 권장",
                },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                >
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {item.helper}
                  </p>
                </div>
              ))}
            </div>
            {isStatsLoading ? (
              <LoadingState
                title="실적 정보를 불러오는 중입니다."
                description="선택한 조건의 실적을 계산하고 있습니다."
                compact
              />
            ) : isStatsError ? (
              <ErrorState
                title="실적 정보를 불러오지 못했습니다."
                description="잠시 후 다시 시도해 주세요."
                retryLabel="새로고침"
                onRetry={() => refetchStats()}
                compact
              />
            ) : !hasPerformanceData ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {hasFilterInput
                    ? "선택한 기간의 실적 데이터가 없습니다."
                    : "등록된 실적 데이터가 없습니다."}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {hasFilterInput
                    ? "기간 또는 필터를 조정한 뒤 다시 확인해 주세요."
                    : "신규 계약 또는 상담기록을 등록하면 실적 흐름이 표시됩니다."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="min-h-12 md:min-h-8"
                    onClick={() => setLocation("/contracts")}
                  >
                    <FilePlus2 className="h-4 w-4 mr-1" /> 계약 등록
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-12 md:min-h-8"
                    onClick={() => setLocation("/customers")}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" /> 상담 기록 확인
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 필터 */}
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Filter className="h-4 w-4 text-[#b99b5f]" /> 실적 필터
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <Label className="text-xs">월 선택</Label>
                <Input
                  type="month"
                  value={monthFilter}
                  onChange={e => {
                    setMonthFilter(e.target.value);
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                />
              </div>
              <div>
                <Label className="text-xs">시작일</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => {
                    setDateFrom(e.target.value);
                    setMonthFilter("");
                  }}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                />
              </div>
              <div>
                <Label className="text-xs">종료일</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => {
                    setDateTo(e.target.value);
                    setMonthFilter("");
                  }}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                />
              </div>
              {(user?.role === "branch_admin" ||
                user?.role === "sub_branch_admin" ||
                user?.role === "team_leader") && (
                <>
                  {user?.role === "branch_admin" && (
                    <div>
                      <Label className="text-xs">실적 범위</Label>
                      <Select
                        value={scopeFilter}
                        onValueChange={value => {
                          setScopeFilter(value as "all" | "mine");
                          if (value === "mine") setAgentIdFilter("all");
                        }}
                      >
                        <SelectTrigger className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                          <SelectValue placeholder="실적 범위" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체 실적</SelectItem>
                          <SelectItem value="mine">내 실적</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {user?.role === "branch_admin" && (
                    <div>
                      <Label className="text-xs">팀</Label>
                      <Select
                        value={teamIdFilter}
                        onValueChange={setTeamIdFilter}
                      >
                        <SelectTrigger className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                          <SelectValue placeholder="전체 팀" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체 팀</SelectItem>
                          {(teams ?? []).map(t => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">팀원</Label>
                    <Select
                      value={agentIdFilter}
                      onValueChange={setAgentIdFilter}
                    >
                      <SelectTrigger className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                        <SelectValue placeholder="전체 팀원" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 팀원</SelectItem>
                        {agents.map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {formatUserWithRole(u)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs">상품군</Label>
                <Input
                  value={productGroupFilter}
                  onChange={e => setProductGroupFilter(e.target.value)}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                  placeholder="예: 종신, 실손"
                />
              </div>
              <div>
                <Label className="text-xs">보험사</Label>
                <Input
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                  placeholder="예: 삼성생명"
                />
              </div>
              <div>
                <Label className="text-xs">지역</Label>
                <Input
                  value={regionFilter}
                  onChange={e => setRegionFilter(e.target.value)}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                  placeholder="예: 서울"
                />
              </div>
              <div>
                <Label className="text-xs">유입경로</Label>
                <Input
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                  placeholder="예: 지인소개"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard
            title="배정 DB"
            value={stats?.assigned}
            highlight
            icon={Users}
          />
          <StatCard
            title="신규 계약"
            value={newContracts}
            highlight
            icon={Target}
            helper="신규 영업 성과 기준"
          />
          <StatCard
            title="월납보험료 실적"
            value={monthlyPremium.toLocaleString()}
            suffix="원"
            highlight
            icon={WalletCards}
          />
          <StatCard
            title="신규 계약률"
            value={stats?.contractRate}
            suffix="%"
            highlight
            icon={TrendingUp}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard title="미상담 수" value={stats?.uncontacted} />
          <StatCard title="부재 수" value={stats?.absent} />
          <StatCard title="통화완료 수" value={stats?.called} />
          <StatCard title="상담예정 수" value={stats?.scheduled} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard title="설계중 수" value={stats?.designing} />
          <StatCard title="계약 유지 기준" value="GA 본사 전산 확인" />
          <StatCard title="상담률" value={stats?.consultRate} suffix="%" />
          <StatCard title="계약률" value={stats?.contractRate} suffix="%" />
        </div>

        {/* 차트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-[#b99b5f]" /> 상담상태별 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={barData}
                  margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="건수" radius={[4, 4, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                신규 계약 / 월납보험료 실적 요약
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground">신규 계약</p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  {newContracts}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground">월납보험료 실적</p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  {monthlyPremium.toLocaleString()}원
                </p>
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                계약 유지 상태는 GA 본사 전산 기준으로 확인하고, BOA CRM은 신규
                영업 성과와 월납보험료 실적을 중심으로 표시합니다.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">비율 지표 (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={rateData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={60}
                />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="value" name="비율" radius={[0, 4, 4, 0]}>
                  {rateData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
