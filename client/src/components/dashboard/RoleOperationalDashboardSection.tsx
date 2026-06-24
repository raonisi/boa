import { PremiumStatCard } from "@/components/dashboard/PremiumStatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { getRoleLabel } from "@/lib/userRole";
import {
  getManagerQuickLinks,
  getMemberQuickActions,
  getOperationalCardsForRole,
  getScopeLabel,
  pickTeamSupportAssignees,
  resolveOperationalCardPath,
  type TodayWorkCardMetrics,
} from "@/lib/roleOperationalDashboard";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  Clock3,
  Phone,
  Target,
  Users,
} from "lucide-react";
import type { ElementType } from "react";
import { useMemo } from "react";
import { useLocation } from "wouter";

const cardIcons: Record<string, ElementType> = {
  "today-contact": Phone,
  "overdue-followup": Clock3,
  "today-schedule": CalendarDays,
  notifications: Bell,
  "long-unmanaged": AlertCircle,
  "incomplete-schedule": CalendarDays,
  "priority-contact": Target,
};

type RoleOperationalDashboardSectionProps = {
  role?: string | null;
};

export function RoleOperationalDashboardSection({
  role,
}: RoleOperationalDashboardSectionProps) {
  const [, setLocation] = useLocation();
  const cards = getOperationalCardsForRole(role);
  const isManager = role === "sub_branch_admin" || role === "team_leader";
  const showSection = role === "member" || isManager;

  const {
    data: todayWork,
    isLoading,
    isError,
    refetch,
  } = trpc.dashboard.todayWork.useQuery({}, { enabled: showSection });

  const { data: recommendationSummary } =
    trpc.recommendations.dashboardSummary.useQuery(
      {},
      {
        enabled:
          showSection && cards.some(card => card.id === "priority-contact"),
      }
    );

  const {
    data: teamInsights,
    isLoading: isTeamLoading,
    isError: isTeamError,
    refetch: refetchTeam,
  } = trpc.adminTeamInsights.summary.useQuery(undefined, {
    enabled: isManager,
  });

  const metrics: TodayWorkCardMetrics = todayWork?.cards ?? {};
  const scopeLabel = getScopeLabel(role);
  const supportAssignees = useMemo(
    () => pickTeamSupportAssignees(teamInsights?.userMetrics ?? []),
    [teamInsights?.userMetrics]
  );

  if (!showSection || cards.length === 0) {
    return null;
  }

  if (isError) {
    return (
      <ErrorState
        title="운영 요약을 불러오지 못했습니다."
        description="잠시 후 다시 시도해 주세요."
        onRetry={() => void refetch()}
        fullPage={false}
        className="border-dashed bg-muted/20"
      />
    );
  }

  return (
    <section className="space-y-4" aria-label="역할별 운영 요약">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {role === "member" ? "내 실행 현황" : "조직 실행 현황"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {scopeLabel} 기준으로 오늘 처리할 업무를 확인합니다. 숫자와 연결
            화면의 범위는 동일합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(card => (
          <PremiumStatCard
            key={card.id}
            title={card.title}
            value={
              card.id === "priority-contact"
                ? (recommendationSummary?.priorityContactCount ?? 0)
                : (metrics[card.metricKey] ?? 0)
            }
            icon={cardIcons[card.id] ?? Users}
            tone={card.tone}
            helper={`${card.scopeLabel} · ${card.description}`}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
            onClick={() => setLocation(resolveOperationalCardPath(card.link))}
          />
        ))}
      </div>

      {isManager ? (
        <Card className="crm-dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/70 pb-3">
            <CardTitle className="text-base font-semibold tracking-tight">
              담당자별 지원이 필요한 업무
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={() => setLocation("/team-insights")}
            >
              상세 보기
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {isTeamError ? (
              <ErrorState
                title="담당자 현황을 불러오지 못했습니다."
                description="잠시 후 다시 시도해 주세요."
                onRetry={() => void refetchTeam()}
                compact
                className="border-0 bg-transparent"
              />
            ) : isTeamLoading ? (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            ) : supportAssignees.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {scopeLabel} 범위에서 즉시 지원이 필요한 담당자가 없습니다.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {supportAssignees.map(assignee => (
                  <button
                    key={assignee.userId}
                    type="button"
                    onClick={() => setLocation("/team-insights")}
                    className="crm-dashboard-action min-h-14 rounded-lg border border-border/80 bg-card p-3 text-left shadow-sm"
                  >
                    <p className="truncate text-sm font-semibold text-foreground">
                      {assignee.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getRoleLabel(assignee.roleLabel)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-foreground">
                      미처리 후속 {assignee.overdueFollowUpCount}건 · 오늘 연락{" "}
                      {assignee.todayFollowUpCount}건
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      확인 필요 업무 {assignee.openWorkCount}건
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {getManagerQuickLinks(role).map(link => (
                <Button
                  key={link.path}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => setLocation(link.path)}
                >
                  {link.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {role === "member" ? (
        <div className="hidden flex-wrap gap-2 md:flex">
          {getMemberQuickActions().map(action => (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setLocation(action.path)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
