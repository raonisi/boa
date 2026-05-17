import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getRoleLabel, getTargetTypeLabel } from "@/lib/userRole";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  ClipboardList,
  Database,
  Download,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  Users,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type Period = "today" | "7d" | "30d" | "month" | "custom";
type AuditPeriod = "today" | "7d" | "30d" | "custom";
type RiskLevel = "normal" | "caution" | "warning" | "danger";
type OperationRiskTab = "summary" | "actions" | "logs" | "status";

const validTabs: OperationRiskTab[] = ["summary", "actions", "logs", "status"];

const levelLabels: Record<RiskLevel, string> = {
  normal: "정상",
  caution: "주의",
  warning: "경고",
  danger: "위험",
};

const levelClasses: Record<RiskLevel, string> = {
  normal: "bg-emerald-100 text-emerald-700 border-emerald-200",
  caution: "bg-amber-100 text-amber-800 border-amber-200",
  warning: "bg-orange-100 text-orange-800 border-orange-200",
  danger: "bg-red-100 text-red-700 border-red-200",
};

const eventLevelLabels: Record<string, string> = {
  high: "위험",
  medium: "경고",
  low: "주의",
  normal: "일반",
};

const eventLevelClasses: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-orange-100 text-orange-800",
  low: "bg-amber-100 text-amber-800",
  normal: "bg-slate-100 text-slate-600",
};

const categoryIcons = {
  download: Download,
  deletion: Trash2,
  account: UserRoundCog,
  handoff: UsersRound,
  push: BellRing,
  unresolved: ClipboardList,
} as const;

const actionLabels: Record<string, string> = {
  DATA_DOWNLOAD: "데이터 다운로드",
  DATA_DOWNLOAD_FAILED: "다운로드 실패",
  DELETE_REQUEST_CREATED: "삭제 요청 생성",
  DELETE_REQUEST_APPROVED: "삭제 요청 승인",
  DELETE_REQUEST_REJECTED: "삭제 요청 반려",
  DELETE_REQUEST_CANCELLED: "삭제 요청 취소",
  CONTRACT_DEACTIVATED_BY_REQUEST: "계약 삭제 처리",
  CUSTOMER_DEACTIVATED: "고객 삭제",
  CONTRACT_DEACTIVATED: "계약 삭제",
  TEAM_DEACTIVATED: "팀 비활성화",
  CUSTOMER_RESTORED: "고객 복구",
  CONTRACT_RESTORED: "계약 복구",
  TEAM_RESTORED: "팀 복구",
  CUSTOMER_PERMANENTLY_DELETED: "고객 완전삭제",
  CONTRACT_PERMANENTLY_DELETED: "계약 완전삭제",
  TEAM_PERMANENTLY_DELETED: "팀 완전삭제",
  USER_FORCE_LOGOUT: "강제 로그아웃",
  ALL_USERS_FORCE_LOGOUT: "전체 로그아웃",
  USER_OAUTH_RESET: "OAuth 초기화",
  LOGIN_BLOCKED: "로그인 차단",
  USER_ROLE_CHANGED: "권한 변경",
  USER_STATUS_CHANGED: "계정 상태 변경",
  CUSTOMER_ASSIGNEE_BULK_CHANGED: "담당자 일괄 변경",
  CUSTOMER_ASSIGNEE_CHANGED_BY_BULK: "담당자 변경",
  AGENT_CHANGED: "담당자 변경",
  CUSTOMER_MERGE_BLOCKED: "고객 병합 차단",
  CUSTOMER_MERGE_PREVIEWED: "고객 병합 미리보기",
};

const auditCategoryLabels: Record<string, string> = {
  all: "전체 분류",
  download: "다운로드",
  delete: "삭제/복구",
  security: "보안 이벤트",
  customer: "고객",
  contract: "계약",
  user: "사용자",
};

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getActionLabel(action: string) {
  return actionLabels[action] ?? action.replaceAll("_", " ");
}

function getTabFromLocation(location: string): OperationRiskTab {
  const [, queryString] = location.split("?");
  const tab = new URLSearchParams(queryString ?? "").get("tab") as OperationRiskTab | null;
  return tab && validTabs.includes(tab) ? tab : "summary";
}

export default function OperationRiskCenter() {
  const [location, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [auditDatePreset, setAuditDatePreset] = useState<AuditPeriod>("7d");
  const [auditCategory, setAuditCategory] = useState("all");
  const [auditTargetType, setAuditTargetType] = useState("all");
  const [auditAction, setAuditAction] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRiskOnly, setAuditRiskOnly] = useState(false);

  const activeTab = getTabFromLocation(location);
  const reportInput = useMemo(() => ({
    period,
    dateFrom: period === "custom" && dateFrom ? dateFrom : undefined,
    dateTo: period === "custom" && dateTo ? dateTo : undefined,
  }), [dateFrom, dateTo, period]);

  const { data, isLoading, isFetching, isError, error, refetch } = trpc.operationRisk.summary.useQuery(reportInput, {
    placeholderData: (previous) => previous,
  });
  const { data: auditSummary } = trpc.adminAudit.summary.useQuery();
  const { data: auditLogs, isFetching: isAuditFetching } = trpc.adminAudit.logSearch.useQuery({
    datePreset: auditDatePreset,
    category: auditCategory === "all" ? undefined : auditCategory as "download" | "delete" | "security" | "customer" | "contract" | "user",
    targetType: auditTargetType === "all" ? undefined : auditTargetType,
    action: auditAction.trim() || undefined,
    search: auditSearch.trim() || undefined,
    riskOnly: auditRiskOnly,
    limit: 50,
  });

  const overallLevel = (data?.overall.level ?? "normal") as RiskLevel;
  const metric = (key: keyof NonNullable<typeof auditSummary>["cards"]) => Number(auditSummary?.cards?.[key] ?? 0);
  const cautionCount = metric("unreadNotifications") + metric("inactiveUsers") + metric("softDeletedCustomers") + metric("softDeletedContracts");
  const riskCount = metric("recentDownloads") + metric("recentDeleteRestore") + metric("recentLoginBlocked") + metric("recentSecurityActions");

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Operation Risk Center</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">운영 리스크 센터</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                운영 위험을 한곳에서 확인하고 필요한 조치 화면으로 이동합니다. 운영점검의 상세 감사 로그와 운영 상태도 이 화면에서 함께 확인합니다.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              새로고침
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[180px_1fr_1fr_auto] md:items-end">
            <div className="space-y-1">
              <Label>기간</Label>
              <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">오늘</SelectItem>
                  <SelectItem value="7d">최근 7일</SelectItem>
                  <SelectItem value="30d">최근 30일</SelectItem>
                  <SelectItem value="month">이번 달</SelectItem>
                  <SelectItem value="custom">직접 선택</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>시작일</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} disabled={period !== "custom"} className="h-10 rounded-xl bg-slate-50" />
            </div>
            <div className="space-y-1">
              <Label>종료일</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} disabled={period !== "custom"} className="h-10 rounded-xl bg-slate-50" />
            </div>
            <p className="text-xs text-slate-500">{data?.period.label ?? "최근 7일"} 기준</p>
          </CardContent>
        </Card>

        {isError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-5">
              <EmptyState
                icon={ShieldAlert}
                title="운영 리스크 정보를 불러오지 못했습니다."
                description={error?.message ?? "잠시 후 다시 시도해 주세요."}
                action={<Button type="button" onClick={() => refetch()}>다시 시도</Button>}
              />
            </CardContent>
          </Card>
        ) : null}

        <Tabs value={activeTab} onValueChange={(value) => setLocation(`/operation-risk?tab=${value}`)} className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger value="summary">요약</TabsTrigger>
            <TabsTrigger value="actions">조치 필요</TabsTrigger>
            <TabsTrigger value="logs">상세 운영 로그</TabsTrigger>
            <TabsTrigger value="status">운영 상태</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <SummaryTab data={data} isLoading={isLoading} overallLevel={overallLevel} setLocation={setLocation} />
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <ActionsTab data={data} setLocation={setLocation} />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <AuditLogsTab
              auditDatePreset={auditDatePreset}
              auditCategory={auditCategory}
              auditTargetType={auditTargetType}
              auditAction={auditAction}
              auditSearch={auditSearch}
              auditRiskOnly={auditRiskOnly}
              auditLogs={auditLogs}
              isAuditFetching={isAuditFetching}
              onDatePresetChange={setAuditDatePreset}
              onCategoryChange={setAuditCategory}
              onTargetTypeChange={setAuditTargetType}
              onActionChange={setAuditAction}
              onSearchChange={setAuditSearch}
              onRiskOnlyChange={setAuditRiskOnly}
            />
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <StatusTab metric={metric} cautionCount={cautionCount} riskCount={riskCount} setLocation={setLocation} />
          </TabsContent>
        </Tabs>

        <Card className="border-emerald-100 bg-emerald-50/60 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              이 화면은 운영 리스크 탐지와 가시화만 제공합니다. 자동 제재, 자동 권한 변경, 자동 인수인계, 다운로드/export 확장, push 발송 정책 변경은 포함하지 않습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function SummaryTab({ data, isLoading, overallLevel, setLocation }: {
  data: any;
  isLoading: boolean;
  overallLevel: RiskLevel;
  setLocation: (path: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 xl:grid-cols-[1.1fr_1.9fr]">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">종합 리스크 등급</p>
                <div className="mt-2 flex items-center gap-2">
                  <ShieldCheck className={cn("h-6 w-6", overallLevel === "danger" ? "text-red-600" : overallLevel === "warning" ? "text-orange-600" : overallLevel === "caution" ? "text-amber-600" : "text-emerald-700")} />
                  <span className="text-3xl font-bold text-slate-950">{levelLabels[overallLevel]}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{data?.overall.message ?? "운영 리스크 데이터를 계산하고 있습니다."}</p>
              </div>
              <Badge className={cn("border", levelClasses[overallLevel])}>{levelLabels[overallLevel]}</Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">리스크 점수</p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-slate-950">{isLoading ? "-" : data?.overall.score ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">0점에 가까울수록 안정적이며, 70점 이상은 즉시 확인을 권장합니다.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.riskCards ?? []).map((card: any) => {
            const Icon = categoryIcons[card.category as keyof typeof categoryIcons] ?? AlertTriangle;
            const level = card.level as RiskLevel;
            return (
              <Card key={card.category} className="border-slate-200/80 bg-white shadow-sm">
                <CardContent className="flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", level === "danger" ? "bg-red-100 text-red-700" : level === "warning" ? "bg-orange-100 text-orange-700" : level === "caution" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700")}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge className={cn("border", levelClasses[level])}>{levelLabels[level]}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{card.title}</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-3xl font-bold tabular-nums text-slate-950">{formatNumber(card.count)}</p>
                    <p className="text-xs font-semibold text-slate-500">점수 {formatNumber(card.score)}</p>
                  </div>
                  <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-500">{card.description}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-auto" onClick={() => setLocation(card.href)}>
                    {card.actionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {isLoading ? Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
              </CardContent>
            </Card>
          )) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">다운로드 리스크</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <Metric label="총 다운로드" value={data?.downloadRisk.total} />
            <Metric label="반복 사용자" value={data?.downloadRisk.repeatedUserCount} />
            <Metric label="사유 확인" value={data?.downloadRisk.shortReasonCount} />
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">인수인계 리스크</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <Metric label="잔여 업무" value={data?.handoffRisk.unresolvedCount} />
            <Metric label="담당 고객" value={data?.handoffRisk.inactiveCustomerCount} />
            <Metric label="후속/일정" value={(data?.handoffRisk.inactiveFollowUpCount ?? 0) + (data?.handoffRisk.inactiveScheduleCount ?? 0)} />
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">푸시 알림 리스크</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <Metric label="실패" value={data?.pushRisk.failed} />
            <Metric label="skip" value={data?.pushRisk.skipped} />
            <Metric label="비활성 토큰" value={data?.pushRisk.inactiveTokens} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ActionsTab({ data, setLocation }: { data: any; setLocation: (path: string) => void }) {
  return (
    <>
      <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            최근 고위험 작업
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <RiskEventsTable events={data?.recentRiskEvents ?? []} />
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(data?.guides ?? []).map((guide: any) => (
          <Card key={guide.title} className="border-slate-200/80 bg-slate-50/70 shadow-sm">
            <CardContent className="flex h-full flex-col p-4">
              <p className="font-semibold text-slate-950">{guide.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{guide.description}</p>
              <Button type="button" variant="ghost" className="mt-auto justify-start px-0 text-slate-900" onClick={() => setLocation(guide.href)}>
                확인하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function AuditLogsTab(props: {
  auditDatePreset: AuditPeriod;
  auditCategory: string;
  auditTargetType: string;
  auditAction: string;
  auditSearch: string;
  auditRiskOnly: boolean;
  auditLogs: any;
  isAuditFetching: boolean;
  onDatePresetChange: (value: AuditPeriod) => void;
  onCategoryChange: (value: string) => void;
  onTargetTypeChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onRiskOnlyChange: (value: boolean) => void;
}) {
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4" /> 상세 운영 로그
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-6">
          <Select value={props.auditDatePreset} onValueChange={(value) => props.onDatePresetChange(value as AuditPeriod)}>
            <SelectTrigger className="h-9 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">오늘</SelectItem>
              <SelectItem value="7d">최근 7일</SelectItem>
              <SelectItem value="30d">최근 30일</SelectItem>
              <SelectItem value="custom">직접 선택</SelectItem>
            </SelectContent>
          </Select>
          <Select value={props.auditCategory} onValueChange={props.onCategoryChange}>
            <SelectTrigger className="h-9 rounded-xl bg-slate-50"><SelectValue placeholder="분류" /></SelectTrigger>
            <SelectContent>
              {Object.entries(auditCategoryLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={props.auditTargetType} onValueChange={props.onTargetTypeChange}>
            <SelectTrigger className="h-9 rounded-xl bg-slate-50"><SelectValue placeholder="대상" /></SelectTrigger>
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
          <Input value={props.auditAction} onChange={(event) => props.onActionChange(event.target.value)} className="h-9 rounded-xl bg-slate-50" placeholder="작업 코드" />
          <Input value={props.auditSearch} onChange={(event) => props.onSearchChange(event.target.value)} className="h-9 rounded-xl bg-slate-50" placeholder="검색어" />
          <Button variant={props.auditRiskOnly ? "default" : "outline"} onClick={() => props.onRiskOnlyChange(!props.auditRiskOnly)} className="h-9">
            위험 작업만
          </Button>
        </div>
        {props.isAuditFetching ? <p className="text-xs text-slate-500">운영 로그를 갱신하고 있습니다.</p> : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead>시각</TableHead>
                <TableHead>작업자</TableHead>
                <TableHead>작업</TableHead>
                <TableHead>대상</TableHead>
                <TableHead>사유/요약</TableHead>
                <TableHead>위험도</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(props.auditLogs?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    조건에 맞는 운영 로그가 없습니다. 필터를 초기화하거나 기간을 넓혀 보세요.
                  </TableCell>
                </TableRow>
              ) : (
                props.auditLogs?.items.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{entry.actor?.name ?? "-"}</div>
                      <div className="text-muted-foreground">{entry.actor?.email ?? "-"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-slate-900">{getActionLabel(entry.action)}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{getTargetTypeLabel(entry.targetType)}{entry.targetId ? ` #${entry.targetId}` : ""}</TableCell>
                    <TableCell className="max-w-sm truncate text-xs text-muted-foreground">{entry.reason ?? entry.summary ?? "-"}</TableCell>
                    <TableCell><Badge className={eventLevelClasses[entry.riskLevel] ?? eventLevelClasses.normal}>{eventLevelLabels[entry.riskLevel] ?? eventLevelLabels.normal}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">표시 {props.auditLogs?.items.length ?? 0}건 / 전체 {props.auditLogs?.total ?? 0}건</p>
      </CardContent>
    </Card>
  );
}

function StatusTab({ metric, cautionCount, riskCount, setLocation }: {
  metric: (key: any) => number;
  cautionCount: number;
  riskCount: number;
  setLocation: (path: string) => void;
}) {
  const health = riskCount >= 10
    ? { label: "위험", className: "bg-red-100 text-red-700", helper: "위험 작업이 많습니다. 상세 운영 로그와 조치 필요 탭을 확인하세요." }
    : cautionCount > 0 || riskCount > 0
      ? { label: "주의", className: "bg-amber-100 text-amber-800", helper: "확인이 필요한 운영 항목이 있습니다." }
      : { label: "정상", className: "bg-emerald-100 text-emerald-700", helper: "현재 주요 운영 위험이 안정적입니다." };

  const cautionCards = [
    { key: "unreadNotifications", label: "미확인 알림", helper: "알림 센터에서 처리하세요.", icon: Bell, href: "/notifications" },
    { key: "inactiveUsers", label: "비활성 사용자", helper: "계정 상태를 확인하세요.", icon: Users, href: "/users" },
    { key: "softDeletedCustomers", label: "삭제 처리 고객", helper: "복구/정리 정책을 확인하세요.", icon: Database, href: "/deleted-data" },
    { key: "softDeletedContracts", label: "삭제 처리 계약", helper: "삭제 요청 이력을 확인하세요.", icon: Database, href: "/deleted-data" },
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
    <>
      <div className="grid gap-3 xl:grid-cols-[1.05fr_1.95fr]">
        <Card className="border-slate-200/80 bg-white shadow-sm">
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

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" />주의 필요</CardTitle></CardHeader>
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
                  <Button type="button" size="sm" variant="outline" className="mt-3 h-8 w-full" onClick={() => setLocation(card.href)}>
                    관련 화면
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-slate-700" />시스템 상태</CardTitle></CardHeader>
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
    </>
  );
}

function RiskEventsTable({ events }: { events: any[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            <TableHead>발생 시각</TableHead>
            <TableHead>작업</TableHead>
            <TableHead>작업자</TableHead>
            <TableHead>대상</TableHead>
            <TableHead>요약</TableHead>
            <TableHead>등급</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10">
                <EmptyState
                  icon={ShieldCheck}
                  title="최근 고위험 작업 없음"
                  description="다운로드, 삭제·복구, 강제 로그아웃, OAuth 초기화 같은 위험 작업이 발생하면 이곳에 표시됩니다."
                />
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(event.createdAt)}</TableCell>
                <TableCell className="text-xs">
                  <div className="font-semibold text-slate-900">{getActionLabel(event.action)}</div>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium text-slate-900">{event.actor?.name ?? "-"}</div>
                  <div className="text-slate-400">{getRoleLabel(event.actor?.role)}</div>
                </TableCell>
                <TableCell className="text-xs text-slate-500">{getTargetTypeLabel(event.targetType)}{event.targetId ? ` #${event.targetId}` : ""}</TableCell>
                <TableCell className="max-w-sm truncate text-xs text-slate-500">{event.reason ?? event.summary ?? "-"}</TableCell>
                <TableCell><Badge className={eventLevelClasses[event.riskLevel] ?? eventLevelClasses.normal}>{eventLevelLabels[event.riskLevel] ?? "일반"}</Badge></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatNumber(value)}</p>
    </div>
  );
}
