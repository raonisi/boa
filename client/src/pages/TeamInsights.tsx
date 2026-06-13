import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import InsightCards from "@/components/team-insights/InsightCards";
import InsightTable from "@/components/team-insights/InsightTable";
import TopRiskUsers from "@/components/team-insights/TopRiskUsers";
import DashboardLayout from "@/components/DashboardLayout";

export default function TeamInsights() {
  const { data, isLoading, error } = trpc.adminTeamInsights.summary.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">데이터를 분석하고 있습니다...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold text-slate-900">
              데이터를 불러오지 못했습니다
            </h2>
            <p className="text-sm text-slate-500">{error.message}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            팀원 관리 대시보드
          </h1>
          <p className="text-muted-foreground">
            팀원들의 고객 관리 현황과 우선 조치 필요 사항을 확인합니다.
          </p>
        </div>

        <InsightCards summary={data.summary} />

        {data.topRiskUsers.length > 0 && (
          <TopRiskUsers users={data.topRiskUsers} />
        )}

        <Card>
          <CardHeader>
            <CardTitle>팀원별 상세 현황</CardTitle>
            <CardDescription>
              모든 팀원의 활동 지표와 리스크 점수를 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InsightTable metrics={data.userMetrics} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
