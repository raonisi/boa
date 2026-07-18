import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  AlertCircle,
  Bell,
  CalendarCheck,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { ErrorState } from "@/components/ui/empty-state";
import { USER_FACING_ERRORS } from "@/lib/userFacingMessages";
import { OPERATION_RISK_ACTION_LEVEL_LABELS } from "@shared/operationRiskActionLevel";

export default function TeamCompletionDashboard() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "this_month">(
    "30d"
  );

  const dates = useMemo(() => {
    const now = new Date();
    const to = new Date().toISOString();
    let from = new Date();
    if (period === "today") {
      from.setHours(0, 0, 0, 0);
    } else if (period === "7d") {
      from.setDate(now.getDate() - 7);
    } else if (period === "30d") {
      from.setDate(now.getDate() - 30);
    } else if (period === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { dateFrom: from.toISOString(), dateTo: to };
  }, [period]);

  const { data, isLoading, error } =
    trpc.adminTeamInsights.notificationFollowUpDashboard.useQuery({
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
    });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">
              팀원 업무 처리 데이터를 분석하고 있습니다...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <ErrorState
          title="데이터를 불러오지 못했습니다"
          description={USER_FACING_ERRORS.loadFailed}
          fullPage
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              팀원별 알림 처리율·후속관리 완료율 대시보드
            </h1>
            <p className="text-muted-foreground">
              권한 범위 내 팀원들의 업무 누락과 지연 패턴을 조기에 발견하고
              코칭합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-32 bg-white">
                <SelectValue placeholder="기간 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="7d">최근 7일</SelectItem>
                <SelectItem value="30d">최근 30일</SelectItem>
                <SelectItem value="this_month">이번 달</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">알림 처리율</CardTitle>
              <Bell className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.summary.notificationCompletionRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                총 {data.summary.notificationCount}건 중{" "}
                {data.summary.completedNotificationCount}건 완료 (미확인{" "}
                {data.summary.unreadNotificationCount}건)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                후속관리 완료율
              </CardTitle>
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.summary.followUpCompletionRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                유효 대상 {data.summary.followUpCount}건 중{" "}
                {data.summary.completedFollowUpCount}건 완료
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                지연 후속관리
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {data.summary.overdueFollowUpCount}건
              </div>
              <p className="text-xs text-muted-foreground">
                기한이 지난 미완료 후속관리
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                처리 필요 팀원
              </CardTitle>
              <Users className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {data.summary.actionRequiredUserCount}명
              </div>
              <p className="text-xs text-muted-foreground">
                지연 후속관리 또는 처리 필요 알림이 있는 구성원
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> 확인 필요 구성원
            </CardTitle>
            <CardDescription className="text-destructive/80">
              실제 미처리 건수를 기준으로 관리자의 확인이 필요한 구성원
              목록입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.attentionUsers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 우선
                코칭이 필요한 팀원이 없습니다.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {data.attentionUsers.map(user => (
                  <div
                    key={user.userId}
                    className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {user.name}
                      </span>
                      <Badge variant="secondary">
                        {OPERATION_RISK_ACTION_LEVEL_LABELS[user.actionLevel]}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      {user.teamName}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {user.reasons.map((reason, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-destructive/80 flex items-start gap-1"
                        >
                          <span className="mt-0.5">•</span>{" "}
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 w-full text-xs text-primary hover:bg-primary/10"
                      onClick={() => setLocation(`/team-insights`)}
                    >
                      팀원 상세 보기
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>팀원별 알림 처리율</CardTitle>
              <CardDescription>
                알림 미확인 및 처리 필요 알림 현황
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto px-6 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>팀원</TableHead>
                      <TableHead className="text-right">전체</TableHead>
                      <TableHead className="text-right">미확인</TableHead>
                      <TableHead className="text-right text-destructive">
                        24h+ 미확인
                      </TableHead>
                      <TableHead className="text-right">처리율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map(u => (
                      <TableRow key={u.userId}>
                        <TableCell>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.teamName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {u.metrics.notificationCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {u.metrics.unreadNotificationCount}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${u.metrics.unreadOver24hCount > 0 ? "text-destructive" : ""}`}
                        >
                          {u.metrics.unreadOver24hCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${u.metrics.notificationCompletionRate < 50 ? "text-destructive" : "text-emerald-600"}`}
                          >
                            {u.metrics.notificationCompletionRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.users.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-6"
                        >
                          조회된 팀원이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>팀원별 후속관리 완료율</CardTitle>
              <CardDescription>
                예정된 후속관리 지연 및 누락 현황
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto px-6 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>팀원</TableHead>
                      <TableHead className="text-right">대상</TableHead>
                      <TableHead className="text-right">완료</TableHead>
                      <TableHead className="text-right text-amber-600">
                        지연
                      </TableHead>
                      <TableHead className="text-right text-destructive">
                        3일+ 지연
                      </TableHead>
                      <TableHead className="text-right">완료율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map(u => (
                      <TableRow key={u.userId}>
                        <TableCell>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.teamName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {u.metrics.validFollowUpCount}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {u.metrics.completedFollowUpCount}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${u.metrics.overdueFollowUpCount > 0 ? "text-amber-600" : ""}`}
                        >
                          {u.metrics.overdueFollowUpCount}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${u.metrics.overdueOver3DaysCount > 0 ? "text-destructive" : ""}`}
                        >
                          {u.metrics.overdueOver3DaysCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${u.metrics.followUpCompletionRate < 50 ? "text-destructive" : "text-emerald-600"}`}
                          >
                            {u.metrics.followUpCompletionRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.users.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-6"
                        >
                          조회된 팀원이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
