import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole } from "@/lib/userRole";
import { Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const targetTypeLabels: Record<string, string> = {
  branch: "지점",
  sub_branch: "부지점",
  team: "팀",
  user: "개인",
};

function formatWon(value: number | undefined | null) {
  return `${Number(value ?? 0).toLocaleString()}원`;
}

export default function PerformanceGoals() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targetType, setTargetType] = useState<"branch" | "sub_branch" | "team" | "user">("branch");
  const [targetId, setTargetId] = useState<string>("none");
  const [contractCountGoal, setContractCountGoal] = useState(0);
  const [monthlyPremiumGoal, setMonthlyPremiumGoal] = useState(0);

  const { data: dashboard } = trpc.performanceGoals.dashboard.useQuery({ year, month });
  const { data: workRhythm } = trpc.workRhythm.summary.useQuery({ period: "month" });
  const { data: users } = trpc.users.list.useQuery(undefined, { enabled: user?.role === "branch_admin" });
  const { data: teams } = trpc.users.teams.useQuery(undefined, { enabled: user?.role === "branch_admin" });

  const targetOptions = useMemo(() => {
    if (targetType === "branch") return [];
    if (targetType === "team") return (teams ?? []).map((team: any) => ({ id: team.id, label: team.name }));
    if (targetType === "sub_branch") return (users ?? [])
      .filter((item: any) => item.role === "sub_branch_admin" && item.accountStatus === "active")
      .map((item: any) => ({ id: item.id, label: formatUserWithRole(item) }));
    return (users ?? [])
      .filter((item: any) => (item.role === "branch_admin" || item.role === "team_leader" || item.role === "member") && item.accountStatus === "active")
      .map((item: any) => ({ id: item.id, label: formatUserWithRole(item) }));
  }, [targetType, teams, users]);

  const createMutation = trpc.performanceGoals.create.useMutation({
    onSuccess: () => {
      toast.success("목표가 생성되었습니다.");
      utils.performanceGoals.dashboard.invalidate();
      setContractCountGoal(0);
      setMonthlyPremiumGoal(0);
    },
    onError: (error) => toast.error(error.message),
  });
  const deactivateMutation = trpc.performanceGoals.deactivate.useMutation({
    onSuccess: () => {
      toast.success("목표가 비활성 처리되었습니다.");
      utils.performanceGoals.dashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const items = dashboard?.items ?? [];
  const firstGoal = items[0];

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">목표관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            월간 계약 건수와 월납보험료 목표를 설정하고, 권한 범위 안에서 목표 대비 성과를 확인합니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">목표 수</p>
              <p className="mt-1 text-2xl font-bold">{dashboard?.summary?.totalGoals ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">계약 평균 달성률</p>
              <p className="mt-1 text-2xl font-bold">{dashboard?.summary?.averageContractRate ?? "-"}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">월납 평균 달성률</p>
              <p className="mt-1 text-2xl font-bold">{dashboard?.summary?.averagePremiumRate ?? "-"}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">달성 / 진행</p>
              <p className="mt-1 text-2xl font-bold">{dashboard?.summary?.achievedGoals ?? 0} / {dashboard?.summary?.pendingGoals ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {firstGoal && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" /> 이번 달 핵심 목표
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">대상</p>
                <p className="font-medium">{firstGoal.targetLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">계약</p>
                <p className="font-medium">{firstGoal.actual.contractCount} / {firstGoal.goal.contractCountGoal}건</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">월납보험료</p>
                <p className="font-medium">{formatWon(firstGoal.actual.monthlyPremium)} / {formatWon(firstGoal.goal.monthlyPremiumGoal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">오늘 필요한 목표</p>
                <p className="font-medium">{firstGoal.dailyRequired.contractCount}건 · {formatWon(firstGoal.dailyRequired.monthlyPremium)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-sky-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">업무 리듬 리포트</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">상담기록</p>
              <p className="font-medium">{workRhythm?.consultationCount ?? 0}건</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">후속관리 완료율</p>
              <p className="font-medium">{workRhythm?.followUpCompletionRate ?? "-"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A등급 관리율</p>
              <p className="font-medium">{workRhythm?.priorityAManagementRate ?? "-"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">오늘 필요 상담</p>
              <p className="font-medium">{workRhythm?.recommendedTodayActions?.suggestedConsultationCount ?? 0}명</p>
            </div>
            <div className="md:col-span-4 grid gap-2 text-xs md:grid-cols-3">
              <div className="rounded-md bg-muted p-2">
                <p className="text-muted-foreground">부족 계약 수</p>
                <p className="mt-1 font-semibold">{workRhythm?.remaining?.contractCount ?? 0}건</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="text-muted-foreground">부족 월납보험료</p>
                <p className="mt-1 font-semibold">{formatWon(workRhythm?.remaining?.monthlyPremium)}</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="text-muted-foreground">일평균 필요 월납보험료</p>
                <p className="mt-1 font-semibold">{formatWon(workRhythm?.dailyRequired?.monthlyPremium)}</p>
              </div>
            </div>
            {(workRhythm?.insights ?? []).length > 0 && (
              <div className="md:col-span-4 rounded-md bg-sky-50 p-3 text-xs text-sky-800">
                {workRhythm?.insights.map((item) => <p key={item}>• {item}</p>)}
              </div>
            )}
          </CardContent>
        </Card>

        {user?.role === "branch_admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" /> 목표 추가
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-6">
              <div>
                <Label className="text-xs">연도</Label>
                <Input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">월</Label>
                <Input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">대상 유형</Label>
                <Select value={targetType} onValueChange={(value) => { setTargetType(value as any); setTargetId("none"); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branch">지점</SelectItem>
                    <SelectItem value="sub_branch">부지점</SelectItem>
                    <SelectItem value="team">팀</SelectItem>
                    <SelectItem value="user">개인</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {targetType !== "branch" && (
                <div>
                  <Label className="text-xs">대상</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="대상 선택" /></SelectTrigger>
                    <SelectContent>
                      {targetOptions.map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">계약 건수 목표</Label>
                <Input type="number" min={0} value={contractCountGoal} onChange={(event) => setContractCountGoal(Number(event.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">월납보험료 목표</Label>
                <Input type="number" min={0} value={monthlyPremiumGoal} onChange={(event) => setMonthlyPremiumGoal(Number(event.target.value))} className="mt-1" />
              </div>
              <div className="md:col-span-6 flex justify-end">
                <Button
                  disabled={createMutation.isPending || (targetType !== "branch" && targetId === "none")}
                  onClick={() => createMutation.mutate({
                    year,
                    month,
                    targetType,
                    targetId: targetType === "branch" ? null : Number(targetId),
                    contractCountGoal,
                    monthlyPremiumGoal,
                  })}
                >
                  목표 저장
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{year}년 {month}월 목표 대비 성과</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대상</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>계약</TableHead>
                  <TableHead>계약 달성률</TableHead>
                  <TableHead>월납보험료</TableHead>
                  <TableHead>월납 달성률</TableHead>
                  <TableHead>부족분</TableHead>
                  <TableHead>남은 기간</TableHead>
                  {user?.role === "branch_admin" && <TableHead>작업</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={user?.role === "branch_admin" ? 9 : 8} className="py-8 text-center text-sm text-muted-foreground">
                      설정된 목표가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : items.map((item: any) => (
                  <TableRow key={item.goal.id}>
                    <TableCell className="font-medium">{item.targetLabel}</TableCell>
                    <TableCell>{targetTypeLabels[item.goal.targetType] ?? item.goal.targetType}</TableCell>
                    <TableCell>{item.actual.contractCount} / {item.goal.contractCountGoal}건</TableCell>
                    <TableCell>{item.achievementRate.contractCount ?? "-"}%</TableCell>
                    <TableCell>{formatWon(item.actual.monthlyPremium)} / {formatWon(item.goal.monthlyPremiumGoal)}</TableCell>
                    <TableCell>{item.achievementRate.monthlyPremium ?? "-"}%</TableCell>
                    <TableCell>{item.remaining.contractCount}건 · {formatWon(item.remaining.monthlyPremium)}</TableCell>
                    <TableCell>{item.remainingDays}일</TableCell>
                    {user?.role === "branch_admin" && (
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => deactivateMutation.mutate({ id: item.goal.id })}>
                          비활성
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
