import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import { TodayWorkSection } from "@/components/dashboard/TodayWorkSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowUp, BarChart3, ChevronRight, FileText, Target, TrendingUp, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function formatWon(value: number | undefined) {
  return `${(value ?? 0).toLocaleString()}원`;
}

function PerformanceGoalSummaryCard() {
  const [, setLocation] = useLocation();
  const { data } = trpc.performanceGoals.dashboard.useQuery({});
  const firstGoal = data?.items?.[0];

  if (!firstGoal) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">이번 달 목표</p>
            <p className="mt-1 text-xs text-muted-foreground">설정된 목표가 없습니다.</p>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            목표관리 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/12 shadow-sm">
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-sidebar-primary/40 bg-sidebar-primary/12 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">목표 대비 성과</p>
              <p className="text-xs text-muted-foreground">{firstGoal.targetLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">신규 계약 달성률</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.achievementRate.contractCount ?? "-"}%</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">월납 달성률</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.achievementRate.monthlyPremium ?? "-"}%</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">부족 신규 계약</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.remaining.contractCount}건</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">남은 기간</p>
              <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{firstGoal.remainingDays}일</p>
            </div>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            자세히 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkRhythmSummaryCard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.workRhythm.summary.useQuery({ period: "week" });

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <BarChart3 className="h-4 w-4" />
          </span>
          업무 리듬 리포트
        </CardTitle>
        <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs font-semibold text-primary hover:underline">
          목표관리
        </button>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">이번 주 상담기록</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.consultationCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">후속관리 완료율</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{data?.followUpCompletionRate ?? "-"}%</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">미처리 후속관리</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.overdueFollowUpCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">오늘 필요 상담</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.recommendedTodayActions?.suggestedConsultationCount ?? 0}</p>
          </div>
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">목표까지 부족 신규 계약</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{data?.remaining?.contractCount ?? 0}건</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">목표까지 부족 월납보험료</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{formatWon(data?.remaining?.monthlyPremium)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">일평균 필요 신규 계약</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{data?.dailyRequired?.contractCount ?? 0}건</p>
          </div>
        </div>
        {(data?.insights ?? []).length > 0 ? (
          <div className="space-y-1 rounded-lg border border-border/80 bg-muted/35 p-3 text-xs text-foreground">
            {data?.insights.slice(0, 3).map((item) => <p key={item}>· {item}</p>)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { data: stats } = trpc.performance.stats.useQuery();
  const { data: myBranchAdminStats } = trpc.performance.stats.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });
  const { data: customers } = trpc.customers.list.useQuery({}, { enabled: user?.role === "branch_admin" });
  const { data: myBranchAdminCustomers } = trpc.customers.list.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });

  const roleTitle =
    user?.role === "branch_admin" ? "지점장" :
    user?.role === "sub_branch_admin" ? "부지점장" :
    user?.role === "team_leader" ? "팀장" : "팀원";

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 520);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TodayWorkSection userName={user?.name} role={user?.role} roleTitle={roleTitle} />

        {user?.role === "branch_admin" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PremiumStatCard title="내 DB" value={myBranchAdminCustomers?.length ?? 0} icon={Users} tone="blue" helper="지점장 직접 담당" />
            <PremiumStatCard title="내 신규 계약" value={myBranchAdminStats?.newContractCount ?? myBranchAdminStats?.contractCount ?? myBranchAdminStats?.contracted ?? 0} icon={FileText} tone="green" helper="내 담당 기준" />
            <PremiumStatCard title="내 월납보험료 실적" value={formatWon(myBranchAdminStats?.monthlyPremiumTotal ?? myBranchAdminStats?.monthlyPremiumSum)} icon={WalletCards} tone="gold" helper="내 담당 기준" />
            <PremiumStatCard title="전체 DB" value={customers?.length ?? 0} icon={Users} tone="navy" helper="지점 전체 권한" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PremiumStatCard title="배정 DB" value={stats?.assigned} icon={Users} tone="navy" helper="권한 범위 기준" />
          <PremiumStatCard title="미상담" value={stats?.uncontacted} icon={AlertCircle} tone="orange" helper="초기 접촉 필요" />
          <PremiumStatCard title="신규 계약" value={stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted} icon={FileText} tone="green" helper="신규 영업 성과" />
          <PremiumStatCard title="월납보험료 실적" value={formatWon(stats?.monthlyPremiumTotal ?? stats?.monthlyPremiumSum)} icon={TrendingUp} tone="blue" helper="입력 계약 기준" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <PerformanceGoalSummaryCard />
          <WorkRhythmSummaryCard />
        </div>
        {showBackToTop ? (
        <div className="fixed bottom-24 right-4 z-40 md:hidden">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-12 min-h-12 w-12 rounded-full border border-border shadow-md"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="맨 위로"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
