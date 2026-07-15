import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { getRoleLabel } from "@/lib/userRole";
import {
  getManagerQuickLinks,
  getScopeLabel,
  pickTeamSupportAssignees,
} from "@/lib/roleOperationalDashboard";
import { trpc } from "@/lib/trpc";
import { UsersRound } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

type RoleOperationalDashboardSectionProps = {
  role?: string | null;
};

export function RoleOperationalDashboardSection({
  role,
}: RoleOperationalDashboardSectionProps) {
  const [, setLocation] = useLocation();
  const isManager = role === "sub_branch_admin" || role === "team_leader";
  const {
    data: teamInsights,
    isLoading,
    isError,
    refetch,
  } = trpc.adminTeamInsights.summary.useQuery(undefined, {
    enabled: isManager,
  });
  const supportAssignees = useMemo(
    () => pickTeamSupportAssignees(teamInsights?.userMetrics ?? []),
    [teamInsights?.userMetrics]
  );

  if (!isManager) return null;

  const scopeLabel = getScopeLabel(role);

  return (
    <section
      className="space-y-3"
      aria-labelledby="dashboard-team-support-title"
      data-testid="dashboard-manager-support"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="dashboard-team-support-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            팀 지원이 필요한 업무
          </h2>
          <p className="text-sm text-muted-foreground">
            {scopeLabel} 범위에서 지연 업무가 많은 담당자만 먼저 확인합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          onClick={() => setLocation("/team-insights")}
        >
          팀 운영 상세
        </Button>
      </div>

      <Card className="crm-dashboard-card">
        <CardHeader className="flex-row items-center gap-3 border-b border-border/70 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <CardTitle className="text-base font-semibold tracking-tight">
            담당자 지원 우선순위
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {isError ? (
            <ErrorState
              title="담당자 현황을 불러오지 못했습니다."
              description="다른 대시보드 영역은 계속 사용할 수 있습니다."
              onRetry={() => void refetch()}
              compact
              className="border-0 bg-transparent"
            />
          ) : isLoading ? (
            <div className="grid gap-2 sm:grid-cols-3" aria-live="polite">
              {[0, 1, 2].map(item => (
                <div key={item} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : supportAssignees.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              {scopeLabel} 범위에서 즉시 지원이 필요한 담당자가 없습니다.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {supportAssignees.map(assignee => (
                <button
                  key={assignee.userId}
                  type="button"
                  onClick={() => setLocation("/team-insights")}
                  className="crm-dashboard-action min-h-24 rounded-lg border border-border/80 bg-card p-3 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={`${assignee.name} 담당자 지원 업무 ${assignee.openWorkCount}건 보기`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {assignee.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {getRoleLabel(assignee.roleLabel)}
                      </p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
                      {assignee.openWorkCount}건
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    기한 경과 {assignee.overdueFollowUpCount}건 · 오늘 연락 {assignee.todayFollowUpCount}건
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
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
    </section>
  );
}
