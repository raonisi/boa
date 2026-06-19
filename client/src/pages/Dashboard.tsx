import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { PerformanceGoalSummaryCard } from "@/components/dashboard/PerformanceGoalSummaryCard";
import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import { TodayWorkSection } from "@/components/dashboard/TodayWorkSection";
import { ReferralSummaryStrip } from "@/components/referrals/ReferralSummaryStrip";
import { WorkRhythmSummaryCard } from "@/components/dashboard/WorkRhythmSummaryCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowUp,
  FileText,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";

function formatWon(value: number | undefined) {
  return `${(value ?? 0).toLocaleString()}원`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = trpc.performance.stats.useQuery();
  const {
    data: myBranchAdminStats,
    isLoading: isMyStatsLoading,
    isError: isMyStatsError,
    refetch: refetchMyStats,
  } = trpc.performance.stats.useQuery(
    { scope: "mine" },
    { enabled: user?.role === "branch_admin" }
  );
  const {
    data: customers,
    isLoading: isCustomersLoading,
    isError: isCustomersError,
    refetch: refetchCustomers,
  } = trpc.customers.list.useQuery(
    {},
    { enabled: user?.role === "branch_admin" }
  );
  const {
    data: myBranchAdminCustomers,
    isLoading: isMyCustomersLoading,
    isError: isMyCustomersError,
    refetch: refetchMyCustomers,
  } = trpc.customers.list.useQuery(
    { scope: "mine" },
    { enabled: user?.role === "branch_admin" }
  );

  const roleTitle =
    user?.role === "branch_admin"
      ? "지점장"
      : user?.role === "sub_branch_admin"
        ? "부지점장"
        : user?.role === "team_leader"
          ? "팀장"
          : "팀원";

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 520);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TodayWorkSection
          userName={user?.name}
          role={user?.role}
          roleTitle={roleTitle}
        />

        <ReferralSummaryStrip user={user} />

        {user?.role === "branch_admin" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PremiumStatCard
              title="내 DB"
              value={myBranchAdminCustomers?.length ?? 0}
              icon={Users}
              tone="blue"
              helper="지점장 직접 담당"
              isLoading={isMyCustomersLoading}
              isError={isMyCustomersError}
              onRetry={() => void refetchMyCustomers()}
            />
            <PremiumStatCard
              title="내 신규 계약"
              value={
                myBranchAdminStats?.newContractCount ??
                myBranchAdminStats?.contractCount ??
                myBranchAdminStats?.contracted ??
                0
              }
              icon={FileText}
              tone="green"
              helper="내 담당 기준"
              isLoading={isMyStatsLoading}
              isError={isMyStatsError}
              onRetry={() => void refetchMyStats()}
            />
            <PremiumStatCard
              title="내 월납보험료 실적"
              value={formatWon(
                myBranchAdminStats?.monthlyPremiumTotal ??
                  myBranchAdminStats?.monthlyPremiumSum
              )}
              icon={WalletCards}
              tone="gold"
              helper="내 담당 기준"
              isLoading={isMyStatsLoading}
              isError={isMyStatsError}
              onRetry={() => void refetchMyStats()}
            />
            <PremiumStatCard
              title="전체 DB"
              value={customers?.length ?? 0}
              icon={Users}
              tone="navy"
              helper="지점 전체 권한"
              isLoading={isCustomersLoading}
              isError={isCustomersError}
              onRetry={() => void refetchCustomers()}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PremiumStatCard
            title="배정 DB"
            value={stats?.assigned}
            icon={Users}
            tone="navy"
            helper="권한 범위 기준"
            isLoading={isStatsLoading}
            isError={isStatsError}
            onRetry={() => void refetchStats()}
          />
          <PremiumStatCard
            title="미상담"
            value={stats?.uncontacted}
            icon={AlertCircle}
            tone="orange"
            helper="초기 접촉 필요"
            isLoading={isStatsLoading}
            isError={isStatsError}
            onRetry={() => void refetchStats()}
          />
          <PremiumStatCard
            title="신규 계약"
            value={
              stats?.newContractCount ??
              stats?.contractCount ??
              stats?.contracted
            }
            icon={FileText}
            tone="green"
            helper="신규 영업 성과"
            isLoading={isStatsLoading}
            isError={isStatsError}
            onRetry={() => void refetchStats()}
          />
          <PremiumStatCard
            title="월납보험료 실적"
            value={formatWon(
              stats?.monthlyPremiumTotal ?? stats?.monthlyPremiumSum
            )}
            icon={TrendingUp}
            tone="blue"
            helper="입력 계약 기준"
            isLoading={isStatsLoading}
            isError={isStatsError}
            onRetry={() => void refetchStats()}
          />
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
