import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/empty-state";
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
import { trpc } from "@/lib/trpc";
import {
  getUserFacingErrorMessage,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { formatUserWithRole, getRoleLabel } from "@/lib/userRole";
import { Activity, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const targetTypeLabels: Record<string, string> = {
  branch: "지점",
  sub_branch: "부지점",
  team: "팀",
  user: "개인",
};

const personalGoalRoles = [
  "branch_admin",
  "sub_branch_admin",
  "team_leader",
  "member",
] as const;
type PersonalGoalRoleFilter =
  | "all"
  | "self"
  | (typeof personalGoalRoles)[number];

function buildPersonalGoalUserLabel(
  item: {
    id: number;
    name?: string | null;
    role?: string | null;
    teamId?: number | null;
  },
  teamNameById: Map<number, string>,
  currentUserId?: number
) {
  const roleLabel = getRoleLabel(item.role);
  const teamLabel = item.teamId ? teamNameById.get(item.teamId) : null;
  const selfSuffix = item.id === currentUserId ? " · 나" : "";
  return `${item.name ?? `사용자 #${item.id}`} · ${roleLabel}${teamLabel ? ` · ${teamLabel}` : ""}${selfSuffix}`;
}

function formatWon(value: number | undefined | null) {
  return `${Number(value ?? 0).toLocaleString()}원`;
}

function goalStatus(item: any) {
  if (!item)
    return { label: "목표 없음", className: "bg-slate-100 text-slate-600" };
  const contractRate = Number(item?.achievementRate?.contractCount ?? 0);
  const premiumRate = Number(item?.achievementRate?.monthlyPremium ?? 0);
  const bestRate = Math.max(contractRate, premiumRate);
  if (bestRate >= 100)
    return { label: "목표 달성", className: "bg-emerald-100 text-emerald-700" };
  if ((item?.remainingDays ?? 0) <= 5 && bestRate < 80)
    return { label: "미달 위험", className: "bg-red-100 text-red-700" };
  return { label: "진행중", className: "bg-amber-100 text-amber-700" };
}

export default function PerformanceGoals() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targetType, setTargetType] = useState<
    "branch" | "sub_branch" | "team" | "user"
  >("branch");
  const [targetId, setTargetId] = useState<string>("none");
  const [contractCountGoal, setContractCountGoal] = useState(0);
  const [monthlyPremiumGoal, setMonthlyPremiumGoal] = useState(0);
  const [personalTargetSearch, setPersonalTargetSearch] = useState("");
  const [personalTargetRoleFilter, setPersonalTargetRoleFilter] =
    useState<PersonalGoalRoleFilter>("all");

  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    refetch: refetchDashboard,
  } = trpc.performanceGoals.dashboard.useQuery({
    year,
    month,
  });
  const { data: workRhythm } = trpc.workRhythm.summary.useQuery({
    period: "month",
  });
  const { data: users } = trpc.users.list.useQuery(
    { activeOnly: true },
    { enabled: user?.role === "branch_admin" }
  );
  const { data: teams } = trpc.users.teams.useQuery(undefined, {
    enabled: user?.role === "branch_admin",
  });

  const teamNameById = useMemo(
    () =>
      new Map((teams ?? []).map((team: any) => [team.id, team.name] as const)),
    [teams]
  );

  const targetOptions = useMemo(() => {
    if (targetType === "branch") return [];
    if (targetType === "team")
      return (teams ?? []).map((team: any) => ({
        id: team.id,
        label: team.name,
      }));
    if (targetType === "sub_branch")
      return (users ?? [])
        .filter(
          (item: any) =>
            item.role === "sub_branch_admin" && item.accountStatus === "active"
        )
        .map((item: any) => ({ id: item.id, label: formatUserWithRole(item) }));
    const activePersonalUsers = (users ?? []).filter(
      (item: any) =>
        personalGoalRoles.includes(item.role) && item.accountStatus === "active"
    );
    const searchQuery = personalTargetSearch.trim().toLowerCase();
    return activePersonalUsers
      .filter((item: any) => {
        if (personalTargetRoleFilter === "self") return item.id === user?.id;
        if (personalTargetRoleFilter !== "all")
          return item.role === personalTargetRoleFilter;
        return true;
      })
      .filter((item: any) => {
        if (!searchQuery) return true;
        const label = buildPersonalGoalUserLabel(
          item,
          teamNameById,
          user?.id
        ).toLowerCase();
        return label.includes(searchQuery);
      })
      .map((item: any) => ({
        id: item.id,
        label: buildPersonalGoalUserLabel(item, teamNameById, user?.id),
      }));
  }, [
    personalTargetRoleFilter,
    personalTargetSearch,
    targetType,
    teamNameById,
    teams,
    user?.id,
    users,
  ]);

  const createMutation = trpc.performanceGoals.create.useMutation({
    onSuccess: () => {
      toast.success("목표가 생성되었습니다.");
      utils.performanceGoals.dashboard.invalidate();
      setContractCountGoal(0);
      setMonthlyPremiumGoal(0);
    },
    onError: error =>
      toast.error(
        getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed)
      ),
  });
  const deactivateMutation = trpc.performanceGoals.deactivate.useMutation({
    onSuccess: () => {
      toast.success("목표가 비활성 처리되었습니다.");
      utils.performanceGoals.dashboard.invalidate();
    },
    onError: error =>
      toast.error(
        getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed)
      ),
  });

  const items = dashboard?.items ?? [];
  const firstGoal = items[0];
  const firstGoalStatus = goalStatus(firstGoal);

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
              Goals
            </p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-950">목표관리</h1>
                <p className="mt-1 text-sm text-slate-500">
                  월간 신규 계약 목표와 월납보험료 목표를 설정하고 목표 대비
                  실적을 확인합니다.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                신규 계약 + 월납보험료 중심
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">목표 수</p>
              <p className="mt-1 text-2xl font-bold">
                {dashboard?.summary?.totalGoals ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                신규 계약 평균 달성률
              </p>
              <p className="mt-1 text-2xl font-bold">
                {dashboard?.summary?.averageContractRate ?? "-"}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                월납보험료 평균 달성률
              </p>
              <p className="mt-1 text-2xl font-bold">
                {dashboard?.summary?.averagePremiumRate ?? "-"}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">달성 / 진행</p>
              <p className="mt-1 text-2xl font-bold">
                {dashboard?.summary?.achievedGoals ?? 0} /{" "}
                {dashboard?.summary?.pendingGoals ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {isDashboardLoading ? (
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-4">
              <LoadingState
                title="목표 정보를 불러오는 중입니다."
                description="선택한 기간의 목표를 확인하고 있습니다."
                compact
              />
            </CardContent>
          </Card>
        ) : isDashboardError ? (
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-4">
              <ErrorState
                title="목표 정보를 불러오지 못했습니다."
                description="잠시 후 다시 시도해 주세요."
                retryLabel="새로고침"
                onRetry={() => refetchDashboard()}
                compact
              />
            </CardContent>
          </Card>
        ) : null}

        {!isDashboardLoading && !isDashboardError && items.length === 0 && (
          <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="bg-amber-100 text-amber-800">목표 없음</Badge>
                <h2 className="mt-2 text-lg font-bold text-slate-950">
                  이번 달 목표가 설정되지 않았습니다.
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  목표를 설정하면 필요한 상담량과 계약량을 계산할 수 있습니다.
                </p>
              </div>
              {user?.role === "branch_admin" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="min-h-12 md:min-h-8"
                    onClick={() =>
                      setContractCountGoal(Math.max(contractCountGoal, 10))
                    }
                  >
                    신규 계약 목표 설정
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-12 md:min-h-8"
                    onClick={() =>
                      setMonthlyPremiumGoal(
                        Math.max(monthlyPremiumGoal, 1000000)
                      )
                    }
                  >
                    월납보험료 목표 설정
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {firstGoal && (
          <Card className="border-[#d9c99f] bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" /> 이번 달 핵심
                목표
                <Badge className={firstGoalStatus.className}>
                  {firstGoalStatus.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">대상</p>
                <p className="font-medium">{firstGoal.targetLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">신규 계약</p>
                <p className="font-medium">
                  {firstGoal.actual.contractCount} /{" "}
                  {firstGoal.goal.contractCountGoal}건
                </p>
                <p className="text-xs text-muted-foreground">
                  달성률 {firstGoal.achievementRate.contractCount ?? 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">월납보험료 목표</p>
                <p className="font-medium">
                  {formatWon(firstGoal.actual.monthlyPremium)} /{" "}
                  {formatWon(firstGoal.goal.monthlyPremiumGoal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  부족분 {formatWon(firstGoal.remaining.monthlyPremium)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  오늘 필요한 목표
                </p>
                <p className="font-medium">
                  {firstGoal.dailyRequired.contractCount}건 ·{" "}
                  {formatWon(firstGoal.dailyRequired.monthlyPremium)}
                </p>
                <p className="text-xs text-muted-foreground">
                  남은 기간 {firstGoal.remainingDays}일
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-sky-100 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">업무 리듬 리포트</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">상담기록</p>
              <p className="font-medium">
                {workRhythm?.consultationCount ?? 0}건
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">후속관리 완료율</p>
              <p className="font-medium">
                {workRhythm?.followUpCompletionRate ?? "-"}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A등급 관리율</p>
              <p className="font-medium">
                {workRhythm?.priorityAManagementRate ?? "-"}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">오늘 필요 상담</p>
              <p className="font-medium">
                {workRhythm?.recommendedTodayActions
                  ?.suggestedConsultationCount ?? 0}
                명
              </p>
            </div>
            <div className="md:col-span-4 grid gap-2 text-xs md:grid-cols-3">
              <div className="rounded-md bg-muted p-2">
                <p className="text-muted-foreground">부족 신규 계약</p>
                <p className="mt-1 font-semibold">
                  {workRhythm?.remaining?.contractCount ?? 0}건
                </p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="text-muted-foreground">부족 월납보험료</p>
                <p className="mt-1 font-semibold">
                  {formatWon(workRhythm?.remaining?.monthlyPremium)}
                </p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="text-muted-foreground">일평균 필요 월납보험료</p>
                <p className="mt-1 font-semibold">
                  {formatWon(workRhythm?.dailyRequired?.monthlyPremium)}
                </p>
              </div>
            </div>
            {(workRhythm?.insights ?? []).length > 0 && (
              <div className="md:col-span-4 rounded-md bg-sky-50 p-3 text-xs text-sky-800">
                {workRhythm?.insights.map(item => (
                  <p key={item}>• {item}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {user?.role === "branch_admin" && (
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                <Target className="h-4 w-4 text-[#b99b5f]" /> 목표 추가
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-6 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">
                    1. 기간 선택
                  </p>
                  <p className="text-[11px] text-slate-500">
                    월간 운영 기준을 먼저 정합니다.
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">
                    2. 대상 선택
                  </p>
                  <p className="text-[11px] text-slate-500">
                    지점, 팀, 개인 목표를 구분합니다.
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">
                    3. 숫자 입력
                  </p>
                  <p className="text-[11px] text-slate-500">
                    신규 계약과 월납 목표를 함께 설정합니다.
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs">연도</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={event => setYear(Number(event.target.value))}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                />
              </div>
              <div>
                <Label className="text-xs">월</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={event => setMonth(Number(event.target.value))}
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                />
              </div>
              <div>
                <Label className="text-xs">대상 유형</Label>
                <Select
                  value={targetType}
                  onValueChange={value => {
                    setTargetType(value as any);
                    setTargetId("none");
                    setPersonalTargetSearch("");
                    setPersonalTargetRoleFilter("all");
                  }}
                >
                  <SelectTrigger className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branch">지점</SelectItem>
                    <SelectItem value="sub_branch">부지점</SelectItem>
                    <SelectItem value="team">팀</SelectItem>
                    <SelectItem value="user">개인</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {targetType !== "branch" && (
                <div
                  className={
                    targetType === "user" ? "md:col-span-2 space-y-2" : ""
                  }
                >
                  <Label className="text-xs">
                    {targetType === "user" ? "개인 목표 대상자" : "대상"}
                  </Label>
                  {targetType === "user" ? (
                    <>
                      <Input
                        value={personalTargetSearch}
                        onChange={event =>
                          setPersonalTargetSearch(event.target.value)
                        }
                        placeholder="이름, 직책, 팀명 검색"
                        className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                      />
                      <Select
                        value={personalTargetRoleFilter}
                        onValueChange={value =>
                          setPersonalTargetRoleFilter(
                            value as PersonalGoalRoleFilter
                          )
                        }
                      >
                        <SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                          <SelectValue placeholder="직책 필터" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체</SelectItem>
                          <SelectItem value="branch_admin">지점장</SelectItem>
                          <SelectItem value="sub_branch_admin">
                            부지점장
                          </SelectItem>
                          <SelectItem value="team_leader">팀장</SelectItem>
                          <SelectItem value="member">팀원</SelectItem>
                          <SelectItem value="self">나</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : null}
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                      <SelectValue placeholder="대상 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.length === 0 ? (
                        <SelectItem value="none" disabled>
                          선택 가능한 대상이 없습니다
                        </SelectItem>
                      ) : (
                        targetOptions.map(option => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {targetType === "user" ? (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      지점장, 부지점장, 팀장, 팀원, 본인을 개인매출 목표
                      대상으로 선택할 수 있습니다.
                    </p>
                  ) : null}
                </div>
              )}
              <div>
                <Label className="text-xs">신규 계약 목표</Label>
                <Input
                  type="number"
                  min={0}
                  value={contractCountGoal}
                  onChange={event =>
                    setContractCountGoal(Number(event.target.value))
                  }
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                />
              </div>
              <div>
                <Label className="text-xs">월납보험료 목표</Label>
                <Input
                  type="number"
                  min={0}
                  value={monthlyPremiumGoal}
                  onChange={event =>
                    setMonthlyPremiumGoal(Number(event.target.value))
                  }
                  className="mt-1 min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                />
              </div>
              <div className="md:col-span-6 flex justify-end">
                <Button
                  className="min-h-12 w-full md:w-auto md:min-h-10"
                  disabled={
                    createMutation.isPending ||
                    (targetType !== "branch" && targetId === "none")
                  }
                  onClick={() =>
                    createMutation.mutate({
                      year,
                      month,
                      targetType,
                      targetId:
                        targetType === "branch" ? null : Number(targetId),
                      contractCountGoal,
                      monthlyPremiumGoal,
                    })
                  }
                >
                  목표 저장
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Activity className="h-4 w-4 text-[#b99b5f]" /> {year}년 {month}월
              목표 대비 실적
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:hidden">
            {items.length === 0 ? (
              <EmptyState
                title="등록된 목표가 없습니다."
                description="목표를 등록하면 진행률과 부족분을 확인할 수 있습니다."
                compact
              />
            ) : (
              items.map((item: any) => {
                const status = goalStatus(item);
                return (
                  <div
                    key={item.goal.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
                          {item.targetLabel}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {targetTypeLabels[item.goal.targetType] ??
                            item.goal.targetType}
                        </p>
                      </div>
                      <Badge className={`${status.className} shrink-0`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-muted-foreground">
                          신규 계약 달성률
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {item.actual.contractCount} /{" "}
                          {item.goal.contractCountGoal}건 ·{" "}
                          {item.achievementRate.contractCount ?? "-"}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-muted-foreground">
                          월납보험료 달성률
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {formatWon(item.actual.monthlyPremium)} /{" "}
                          {formatWon(item.goal.monthlyPremiumGoal)} ·{" "}
                          {item.achievementRate.monthlyPremium ?? "-"}%
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-slate-100 p-3">
                          <p className="text-muted-foreground">
                            부족 신규 계약
                          </p>
                          <p className="mt-1 font-semibold text-slate-950">
                            {item.remaining.contractCount}건
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 p-3">
                          <p className="text-muted-foreground">남은 기간</p>
                          <p className="mt-1 font-semibold text-slate-950">
                            {item.remainingDays}일
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3 text-xs">
                        <p className="text-muted-foreground">부족 월납보험료</p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {formatWon(item.remaining.monthlyPremium)}
                        </p>
                      </div>
                    </div>
                    {user?.role === "branch_admin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4 min-h-12 w-full"
                        onClick={() =>
                          deactivateMutation.mutate({ id: item.goal.id })
                        }
                      >
                        비활성화
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
          <CardContent className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>대상</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>신규 계약</TableHead>
                  <TableHead>신규 계약 달성률</TableHead>
                  <TableHead>월납보험료 목표</TableHead>
                  <TableHead>월납 달성률</TableHead>
                  <TableHead>부족분</TableHead>
                  <TableHead>남은 기간</TableHead>
                  {user?.role === "branch_admin" && <TableHead>작업</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={user?.role === "branch_admin" ? 9 : 8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      등록된 목표가 없습니다. 목표를 등록하면 진행률을 확인할 수
                      있습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: any) => (
                    <TableRow key={item.goal.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{item.targetLabel}</span>
                          <Badge className={goalStatus(item).className}>
                            {goalStatus(item).label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {targetTypeLabels[item.goal.targetType] ??
                          item.goal.targetType}
                      </TableCell>
                      <TableCell>
                        {item.actual.contractCount} /{" "}
                        {item.goal.contractCountGoal}건
                      </TableCell>
                      <TableCell>
                        {item.achievementRate.contractCount ?? "-"}%
                      </TableCell>
                      <TableCell>
                        {formatWon(item.actual.monthlyPremium)} /{" "}
                        {formatWon(item.goal.monthlyPremiumGoal)}
                      </TableCell>
                      <TableCell>
                        {item.achievementRate.monthlyPremium ?? "-"}%
                      </TableCell>
                      <TableCell>
                        {item.remaining.contractCount}건 ·{" "}
                        {formatWon(item.remaining.monthlyPremium)}
                      </TableCell>
                      <TableCell>{item.remainingDays}일</TableCell>
                      {user?.role === "branch_admin" && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deactivateMutation.mutate({ id: item.goal.id })
                            }
                          >
                            비활성
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
