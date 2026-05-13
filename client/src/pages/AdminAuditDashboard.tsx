import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { useState } from "react";

const riskLabels: Record<string, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
  normal: "일반",
};

const riskClasses: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-orange-100 text-orange-700",
  low: "bg-blue-100 text-blue-700",
  normal: "bg-gray-100 text-gray-600",
};

export default function AdminAuditDashboard() {
  const [datePreset, setDatePreset] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [category, setCategory] = useState<string>("all");
  const [targetType, setTargetType] = useState<string>("all");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);

  const { data: summary } = trpc.adminAudit.summary.useQuery();
  const { data: logs } = trpc.adminAudit.logSearch.useQuery({
    datePreset,
    category: category === "all" ? undefined : category as any,
    targetType: targetType === "all" ? undefined : targetType,
    action: action.trim() || undefined,
    search: search.trim() || undefined,
    riskOnly,
    limit: 50,
  });

  const cards = [
    ["activeUsers", "active 사용자", "현재"],
    ["inactiveUsers", "inactive 사용자", "현재"],
    ["resignedUsers", "resigned 사용자", "현재"],
    ["activeCustomers", "active 고객", "현재"],
    ["softDeletedCustomers", "soft deleted 고객", "현재"],
    ["activeContracts", "active 계약", "현재"],
    ["softDeletedContracts", "soft deleted 계약", "현재"],
    ["unreadNotifications", "미확인 알림", "현재"],
    ["todayCustomers", "오늘 등록 고객", "오늘"],
    ["todayContracts", "오늘 계약", "오늘"],
    ["recentDownloads", "다운로드", "최근 7일"],
    ["recentDeleteRestore", "삭제/복구/완전삭제", "최근 7일"],
    ["recentLoginBlocked", "로그인 차단", "최근 7일"],
    ["recentSecurityActions", "OAuth/강제 로그아웃", "최근 7일"],
  ] as const;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Operations Audit</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">운영 점검</h1>
            <p className="mt-1 text-sm text-slate-500">
              시스템 운영 상태와 위험 작업 이력을 확인합니다. 고객 연락처, 메모, 토큰, 비밀값은 표시하지 않습니다.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([key, label, period]) => (
            <Card key={key} className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{period}</p>
                <p className="mt-1 text-sm font-medium">{label}</p>
                <p className="mt-2 text-2xl font-bold">{summary?.cards?.[key] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-500" /> 최근 위험 작업
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead>발생일시</TableHead>
                    <TableHead>action</TableHead>
                    <TableHead>대상</TableHead>
                    <TableHead>사유/요약</TableHead>
                    <TableHead>위험도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary?.recentRiskEvents ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        최근 위험 작업이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary?.recentRiskEvents.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{entry.action}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.targetType ?? "-"}{entry.targetId ? ` #${entry.targetId}` : ""}
                        </TableCell>
                        <TableCell className="max-w-sm truncate text-xs text-muted-foreground">
                          {entry.reason ?? entry.summary ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={riskClasses[entry.riskLevel]}>{riskLabels[entry.riskLevel]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> 활동 로그 고급 필터
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-6">
              <Select value={datePreset} onValueChange={(value) => setDatePreset(value as any)}>
                <SelectTrigger className="h-9 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">오늘</SelectItem>
                  <SelectItem value="7d">최근 7일</SelectItem>
                  <SelectItem value="30d">최근 30일</SelectItem>
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 rounded-xl bg-slate-50"><SelectValue placeholder="분류" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 분류</SelectItem>
                  <SelectItem value="download">다운로드</SelectItem>
                  <SelectItem value="delete">삭제/복구</SelectItem>
                  <SelectItem value="security">보안 이벤트</SelectItem>
                  <SelectItem value="customer">고객</SelectItem>
                  <SelectItem value="contract">계약</SelectItem>
                  <SelectItem value="user">사용자</SelectItem>
                </SelectContent>
              </Select>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger className="h-9 rounded-xl bg-slate-50"><SelectValue placeholder="targetType" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 대상</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="customer">customer</SelectItem>
                  <SelectItem value="contract">contract</SelectItem>
                  <SelectItem value="team">team</SelectItem>
                  <SelectItem value="customers">customers</SelectItem>
                  <SelectItem value="contracts">contracts</SelectItem>
                </SelectContent>
              </Select>
              <Input value={action} onChange={(e) => setAction(e.target.value)} className="h-9 rounded-xl bg-slate-50" placeholder="action" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 rounded-xl bg-slate-50" placeholder="검색어" />
              <Button variant={riskOnly ? "default" : "outline"} onClick={() => setRiskOnly((value) => !value)} className="h-9">
                위험 작업만
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead>시각</TableHead>
                    <TableHead>작업자</TableHead>
                    <TableHead>action</TableHead>
                    <TableHead>대상</TableHead>
                    <TableHead>요약</TableHead>
                    <TableHead>위험도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs?.items ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        조건에 맞는 로그가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs?.items.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("ko-KR")}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{entry.actor?.name ?? "-"}</div>
                          <div className="text-muted-foreground">{entry.actor?.email ?? "-"}</div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{entry.action}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.targetType ?? "-"}{entry.targetId ? ` #${entry.targetId}` : ""}</TableCell>
                        <TableCell className="max-w-sm truncate text-xs text-muted-foreground">{entry.reason ?? entry.summary ?? "-"}</TableCell>
                        <TableCell><Badge className={riskClasses[entry.riskLevel]}>{riskLabels[entry.riskLevel]}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">표시 {logs?.items.length ?? 0}건 / 전체 {logs?.total ?? 0}건</p>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-green-50/60 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p>
              다운로드 사유는 데이터 다운로드 화면에서 필수 입력이며, DATA_DOWNLOAD 로그 metadata에 저장됩니다.
              사유에는 민감정보를 입력하지 않도록 안내합니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
