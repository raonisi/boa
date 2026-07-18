import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { PerformanceGoalSummaryCard } from "@/components/dashboard/PerformanceGoalSummaryCard";
import { RoleOperationalDashboardSection } from "@/components/dashboard/RoleOperationalDashboardSection";
import { TodayWorkSection } from "@/components/dashboard/TodayWorkSection";
import { WorkRhythmSummaryCard } from "@/components/dashboard/WorkRhythmSummaryCard";
import { ClaimGuidanceSummaryStrip } from "@/components/claimGuidance/ClaimGuidanceSummaryStrip";
import { ReferralSummaryStrip } from "@/components/referrals/ReferralSummaryStrip";
import { RetentionRiskSummaryStrip } from "@/components/retentionRisk/RetentionRiskSummaryStrip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  CalendarCheck2,
  FileClock,
} from "lucide-react";
import type { ElementType } from "react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type AdminAttentionItem = {
  id: string;
  title: string;
  description: string;
  value: number;
  path: string;
  icon: ElementType;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

function AdminAttentionSection({ role }: { role?: string | null }) {
  const [, setLocation] = useLocation();
  const enabled = role === "branch_admin";
  const scheduleRequests = trpc.scheduleChangeRequests.summary.useQuery(
    undefined,
    { enabled }
  );
  const contractDeleteRequests =
    trpc.deleteRequests.listAllRequestsForAdmin.useQuery(
      { status: "pending" },
      { enabled }
    );
  const operationRisk = trpc.operationRisk.summary.useQuery(
    { period: "7d" },
    { enabled }
  );

  if (!enabled) return null;

  const items: AdminAttentionItem[] = [
    {
      id: "schedule-approvals",
      title: "일정 변경 승인",
      description: "생성·수정·삭제 요청 검토",
      value: scheduleRequests.data?.pending ?? 0,
      path: "/schedule-change-requests",
      icon: CalendarCheck2,
      isLoading: scheduleRequests.isLoading,
      isError: scheduleRequests.isError,
      onRetry: () => void scheduleRequests.refetch(),
    },
    {
      id: "contract-delete-approvals",
      title: "계약 삭제 승인",
      description: "처리 대기 중인 계약 요청",
      value: contractDeleteRequests.data?.length ?? 0,
      path: "/contracts",
      icon: FileClock,
      isLoading: contractDeleteRequests.isLoading,
      isError: contractDeleteRequests.isError,
      onRetry: () => void contractDeleteRequests.refetch(),
    },
    {
      id: "operation-risk",
      title: "운영 위험 신호",
      description: "최근 7일 확인이 필요한 항목",
      value:
        operationRisk.data?.riskCards?.filter(
          item => item.actionLevel !== "informational"
        ).length ?? 0,
      path: "/operation-risk",
      icon: AlertTriangle,
      isLoading: operationRisk.isLoading,
      isError: operationRisk.isError,
      onRetry: () => void operationRisk.refetch(),
    },
  ];

  return (
    <section
      className="space-y-3"
      aria-labelledby="dashboard-admin-attention-title"
      data-testid="dashboard-admin-attention"
    >
      <div>
        <h2
          id="dashboard-admin-attention-title"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          지점 운영 확인
        </h2>
        <p className="text-sm text-muted-foreground">
          지점장 승인이 필요한 업무와 운영 위험만 모았습니다.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.id} className="crm-dashboard-card">
              <CardContent className="flex min-h-32 flex-col justify-between gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  {item.isLoading ? (
                    <span
                      className="h-8 w-12 animate-pulse rounded bg-muted"
                      aria-label={`${item.title} 불러오는 중`}
                    />
                  ) : item.isError ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={item.onRetry}
                    >
                      다시 시도
                    </Button>
                  ) : (
                    <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                      {item.value.toLocaleString()}
                      <span className="ml-1 text-xs font-semibold text-muted-foreground">
                        건
                      </span>
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-10 gap-1"
                    onClick={() => setLocation(item.path)}
                  >
                    검토
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [showBackToTop, setShowBackToTop] = useState(false);

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
      <div className="space-y-7">
        <TodayWorkSection
          userName={user?.name}
          role={user?.role}
          roleTitle={roleTitle}
        />

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <PerformanceGoalSummaryCard />
          <WorkRhythmSummaryCard />
        </div>

        <AdminAttentionSection role={user?.role} />
        <RoleOperationalDashboardSection role={user?.role} />

        <section className="space-y-3" aria-labelledby="dashboard-more-title">
          <div>
            <h2
              id="dashboard-more-title"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              추가 현황
            </h2>
            <p className="text-sm text-muted-foreground">
              소개·청구·계약 유지 업무는 필요할 때 상세 화면에서 확인합니다.
            </p>
          </div>
          <div className="space-y-3">
            <ReferralSummaryStrip user={user} />
            <ClaimGuidanceSummaryStrip user={user} />
            <RetentionRiskSummaryStrip user={user} />
          </div>
        </section>

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
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
