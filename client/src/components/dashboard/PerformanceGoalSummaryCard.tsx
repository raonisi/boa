import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ChevronRight, Target } from "lucide-react";
import { useLocation } from "wouter";

export function PerformanceGoalSummaryCard() {
  const [, setLocation] = useLocation();
  const { data } = trpc.performanceGoals.dashboard.useQuery({});
  const firstGoal = data?.items?.[0];

  if (!firstGoal) {
    return (
      <Card className="crm-dashboard-card">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">이번 달 목표</p>
            <p className="mt-1 text-xs text-muted-foreground">
              설정된 목표가 없습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/performance/goals")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            목표관리 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="crm-dashboard-card border-primary/12">
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-sidebar-primary/40 bg-sidebar-primary/12 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                목표 대비 성과
              </p>
              <p className="text-xs text-muted-foreground">
                {firstGoal.targetLabel}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="boa-soft-card crm-dashboard-action p-3">
              <p className="text-xs text-muted-foreground">신규 계약 달성률</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">
                {firstGoal.achievementRate.contractCount ?? "-"}%
              </p>
            </div>
            <div className="boa-soft-card crm-dashboard-action p-3">
              <p className="text-xs text-muted-foreground">월납 달성률</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">
                {firstGoal.achievementRate.monthlyPremium ?? "-"}%
              </p>
            </div>
            <div className="boa-soft-card crm-dashboard-action p-3">
              <p className="text-xs text-muted-foreground">부족 신규 계약</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">
                {firstGoal.remaining.contractCount}건
              </p>
            </div>
            <div className="boa-soft-card crm-dashboard-action p-3">
              <p className="text-xs text-muted-foreground">남은 기간</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">
                {firstGoal.remainingDays}일
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/performance/goals")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            자세히 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
