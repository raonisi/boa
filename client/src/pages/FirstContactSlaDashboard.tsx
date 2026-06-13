import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  AlertCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UserX,
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
import DashboardLayout from "@/components/DashboardLayout";

export default function FirstContactSlaDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } =
    trpc.adminTeamInsights.firstContactSla.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">SLA 데이터를 분석하고 있습니다...</p>
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
            DB 배정 후 첫 연락 SLA 관리
          </h1>
          <p className="text-muted-foreground">
            배정된 고객 DB에 대한 팀원들의 첫 연락 소요 시간과 지연 현황을
            모니터링합니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                첫 연락 완료율
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.summary.completionRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                총 {data.summary.assignedCustomerCount}건 중{" "}
                {data.summary.contactedOnTimeCount +
                  data.summary.contactedLateCount}
                건 완료
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                평균 첫 연락 시간
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.summary.averageFirstContactHours}시간
              </div>
              <p className="text-xs text-muted-foreground">
                배정 시점부터 첫 기록 생성까지
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                SLA 지연 / 미연락
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {data.summary.overdueCount}건
              </div>
              <p className="text-xs text-muted-foreground">
                총 미연락: {data.summary.notContactedCount}건
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                고위험 / 긴급 지연
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {data.summary.highRiskOverdueCount +
                  data.summary.criticalOverdueCount}
                건
              </div>
              <p className="text-xs text-muted-foreground">
                48시간 이상: {data.summary.highRiskOverdueCount}건, 72시간 이상:{" "}
                {data.summary.criticalOverdueCount}건
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>지연 고객 목록</CardTitle>
            <CardDescription>
              SLA 24시간을 초과하여 아직 첫 연락이 진행되지 않은 고객
              목록입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.overdueCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-4" />
                <p className="text-lg font-medium text-slate-900">
                  지연된 고객이 없습니다.
                </p>
                <p className="text-sm text-slate-500">
                  모든 DB 배정건이 SLA 기준 내에 잘 관리되고 있습니다.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>고객명</TableHead>
                      <TableHead>현재 상태</TableHead>
                      <TableHead>지연 단계</TableHead>
                      <TableHead>경과 시간</TableHead>
                      <TableHead>배정 일시</TableHead>
                      <TableHead className="text-right">담당자 관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.overdueCustomers.map(c => (
                      <TableRow key={c.customerId}>
                        <TableCell className="font-medium">
                          {c.displayName}
                        </TableCell>
                        <TableCell>{c.consultStatus}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.riskLevel === "critical"
                                ? "destructive"
                                : c.riskLevel === "high"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={
                              c.riskLevel === "high"
                                ? "bg-amber-500 hover:bg-amber-600"
                                : ""
                            }
                          >
                            {c.riskLevel === "critical"
                              ? "72시간 긴급"
                              : c.riskLevel === "high"
                                ? "48시간 고위험"
                                : "24시간 지연"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-destructive font-semibold">
                          {Math.floor(c.elapsedHours)}시간
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(c.assignedAt).toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className="text-sm cursor-pointer text-primary font-medium hover:underline"
                            onClick={() =>
                              setLocation(`/customers/${c.customerId}`)
                            }
                          >
                            상세 보기
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>팀원별 SLA 상세 현황</CardTitle>
            <CardDescription>
              각 담당자별 배정 DB 수와 연락 소요 시간을 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>담당자</TableHead>
                    <TableHead>소속</TableHead>
                    <TableHead className="text-center">배정 수</TableHead>
                    <TableHead className="text-center">완료율</TableHead>
                    <TableHead className="text-center">평균 시간</TableHead>
                    <TableHead className="text-center">지연(24h)</TableHead>
                    <TableHead className="text-center">고위험(48h)</TableHead>
                    <TableHead className="text-center">긴급(72h)</TableHead>
                    <TableHead className="text-center">위험도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map(u => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.teamName}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {u.metrics.assignedCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {u.metrics.completionRate}%
                      </TableCell>
                      <TableCell className="text-center">
                        {u.metrics.averageFirstContactHours}h
                      </TableCell>
                      <TableCell className="text-center text-amber-600 font-medium">
                        {u.metrics.overdue}
                      </TableCell>
                      <TableCell className="text-center text-orange-600 font-medium">
                        {u.metrics.highRisk}
                      </TableCell>
                      <TableCell className="text-center text-destructive font-medium">
                        {u.metrics.critical}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            u.riskLevel === "critical"
                              ? "destructive"
                              : u.riskLevel === "high"
                                ? "destructive"
                                : "outline"
                          }
                          className={
                            u.riskLevel === "high"
                              ? "bg-amber-500 text-white border-transparent hover:bg-amber-600"
                              : u.riskLevel === "normal"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : ""
                          }
                        >
                          {u.riskLevel === "critical"
                            ? "심각"
                            : u.riskLevel === "high"
                              ? "경고"
                              : u.riskLevel === "warning"
                                ? "주의"
                                : "정상"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
