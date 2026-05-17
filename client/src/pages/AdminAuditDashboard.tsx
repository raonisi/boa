import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { redactAuditDisplayText } from "@/lib/auditRedaction";
import { trpc } from "@/lib/trpc";
import { getTargetTypeLabel } from "@/lib/userRole";
import { Activity, AlertTriangle, Bell, Database, Download, ShieldCheck, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

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

const actionLabels: Record<string, string> = {
  DATA_DOWNLOAD: "데이터 다운로드",
  CUSTOMER_DEACTIVATED: "고객 삭제",
  CUSTOMER_RESTORED: "고객 복구",
  CONTRACT_DELETED: "계약 삭제",
  CONTRACT_RESTORED: "계약 복구",
  ALL_USERS_FORCE_LOGOUT: "전체 사용자 강제 로그아웃",
  USER_FORCE_LOGOUT: "강제 로그아웃",
  USER_OAUTH_RESET: "OAuth 초기화",
  LOGIN_BLOCKED: "로그인 차단",
};

function actionLabel(action: string) {
  return actionLabels[action] ?? "기타 작업";
}

export default function AdminAuditDashboard() {
  const [, setLocation] = useLocation();
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

  const metric = (key: keyof NonNullable<typeof summary>["cards"]) => Number(summary?.cards?.[key] ?? 0);
  const cautionCount = metric("unreadNotifications") + metric("inactiveUsers") + metric("softDeletedCustomers") + metric("softDeletedContracts");
  const riskCount = metric("recentDownloads") + metric("recentDeleteRestore") + metric("recentLoginBlocked") + metric("recentSecurityActions");
  const health = riskCount >= 10 ? { label: "위험", className: "bg-red-100 text-red-700", helper: "위험 작업이 많습니다. 사유 로그 확인이 필요합니다." }
    : cautionCount > 0 || riskCount > 0 ? { label: "주의", className: "bg-amber-100 text-amber-800", helper: "확인할 운영 항목이 있습니다." }
    : { label: "정상", className: "bg-emerald-100 text-emerald-700", helper: "현재 주요 운영 위험이 낮습니다." };
  const cautionCards = [
    { key: "unreadNotifications", label: "미확인 알림", helper: "알림센터에서 처리하세요.", icon: Bell, onClick: () => setLocation("/notifications") },
    { key: "inactiveUsers", label: "비활성 사용자", helper: "계정 상태를 확인하세요.", icon: Users, onClick: () => setLocation("/users") },
    { key: "softDeletedCustomers", label: "삭제 처리 고객", helper: "복구/정리 정책을 확인하세요.", icon: Database, onClick: () => setLocation("/deleted-data") },
    { key: "softDeletedContracts", label: "삭제 처리 계약", helper: "삭제 요청 이력을 확인하세요.", icon: Database, onClick: () => setLocation("/deleted-data") },
  ] as const;
  const riskCards = [
    { key: "recentDownloads", label: "최근 다운로드", helper: "최근 데이터 다운로드가 많으면 사유 로그를 확인하세요.", icon: Download },
    { key: "recentDeleteRestore", label: "삭제·복구·완전삭제", helper: "위험 작업 이력과 승인 흐름을 확인하세요.", icon: Trash2 },
    { key: "recentLoginBlocked", label: "로그인 차단", helper: "계정 상태와 접근 시도를 확인하세요.", icon: ShieldCheck },
    { key: "recentSecurityActions", label: "OAuth/강제 로그아웃", helper: "보안 조치 사유를 확인하세요.", icon: ShieldCheck },
  ] as const;
  const systemCards = [
    { key: "activeUsers", label: "활성 사용자", period: "현재" },
    { key: "resignedUsers", label: "퇴사 사용자", period: "현재" },
    { key: "activeCustomers", label: "활성 고객", period: "현재" },
    { key: "activeContracts", label: "활성 계약", period: "현재" },
    { key: "todayCustomers", label: "오늘 등록 고객", period: "오늘" },
    { key: "todayContracts", label: "오늘 계약", period: "오늘" },
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

        <div className="grid gap-3 xl:grid-cols-[1.05fr_1.95fr]">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">운영 건강도</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    <span className="text-2xl font-bold text-slate-950">{health.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{health.helper}</p>
                </div>
                <Badge className={health.className}>{health.label}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                  <p className="text-xs text-amber-800">주의 필요</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">{cautionCount}</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50/70 p-3">
                  <p className="text-xs text-red-700">위험 작업</p>
                  <p className="mt-1 text-2xl font-bold text-red-800">{riskCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> 주의 필요
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {cautionCards.map((card) => {
                const Icon = card.icon;
                const value = metric(card.key);
                return (
                  <div key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="h-4 w-4 text-slate-600" />
                      {value > 0 && <Badge className="bg-amber-100 text-amber-800">확인 필요</Badge>}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
                    <p className="mt-1 min-h-8 text-xs text-slate-500">{card.helper}</p>
                    <Button type="button" size="sm" variant="outline" className="mt-3 h-8 w-full" onClick={card.onClick}>
                      관련 화면
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-red-600" /> 위험 작업
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {riskCards.map((card) => {
              const Icon = card.icon;
              const value = metric(card.key);
              return (
                <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Icon className={value > 0 ? "h-5 w-5 text-red-600" : "h-5 w-5 text-slate-400"} />
                    <Badge className={value > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                      {value > 0 ? "위험" : "정상"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-slate-700" /> 시스템 상태
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {systemCards.map((card) => (
              <div key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-xs text-slate-500">{card.period}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{metric(card.key)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

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
                    <TableHead>작업</TableHead>
                    <TableHead>대상</TableHead>
                    <TableHead>사유/요약</TableHead>
                    <TableHead>위험도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary?.recentRiskEvents ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        최근 위험 작업이 없습니다. 다운로드, 삭제, 복구, 보안 조치가 발생하면 이곳에 표시됩니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary?.recentRiskEvents.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-slate-900">{actionLabel(entry.action)}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getTargetTypeLabel(entry.targetType)}{entry.targetId ? ` #${entry.targetId}` : ""}
                        </TableCell>
                        <TableCell className="max-w-sm truncate text-xs text-muted-foreground">
                          {redactAuditDisplayText(entry.reason ?? entry.summary ?? "-", 160)}
                        </TableCell>
                        <TableCell>
                          <Badge className={riskClasses[entry.riskLevel] ?? riskClasses.normal}>{riskLabels[entry.riskLevel] ?? riskLabels.normal}</Badge>
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
                <SelectTrigger className="h-9 rounded-xl bg-slate-50"><SelectValue placeholder="대상 유형" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 대상</SelectItem>
                  <SelectItem value="user">사용자</SelectItem>
                  <SelectItem value="customer">고객</SelectItem>
                  <SelectItem value="contract">계약</SelectItem>
                  <SelectItem value="team">팀</SelectItem>
                  <SelectItem value="customers">고객</SelectItem>
                  <SelectItem value="contracts">계약</SelectItem>
                </SelectContent>
              </Select>
              <Input value={action} onChange={(e) => setAction(e.target.value)} className="h-9 rounded-xl bg-slate-50" placeholder="작업 코드" />
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
                    <TableHead>작업</TableHead>
                    <TableHead>대상</TableHead>
                    <TableHead>요약</TableHead>
                    <TableHead>위험도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs?.items ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        조건에 맞는 활동 로그가 없습니다. 필터를 초기화하거나 기간을 넓혀보세요.
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
                        <TableCell className="text-xs">
                          <div className="font-semibold text-slate-900">{actionLabel(entry.action)}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getTargetTypeLabel(entry.targetType)}{entry.targetId ? ` #${entry.targetId}` : ""}</TableCell>
                        <TableCell className="max-w-sm truncate text-xs text-muted-foreground">{redactAuditDisplayText(entry.reason ?? entry.summary ?? "-", 160)}</TableCell>
                        <TableCell><Badge className={riskClasses[entry.riskLevel] ?? riskClasses.normal}>{riskLabels[entry.riskLevel] ?? riskLabels.normal}</Badge></TableCell>
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
