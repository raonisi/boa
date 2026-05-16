import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
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
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type Period = "today" | "7d" | "30d" | "month" | "custom";
type RiskLevel = "normal" | "caution" | "warning" | "danger";

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
  TEAM_DEACTIVATED: "팀 비활성",
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
  CUSTOMER_ASSIGNEE_BULK_CHANGED: "담당자 일괄 변경",
  CUSTOMER_ASSIGNEE_CHANGED_BY_BULK: "담당자 변경",
  AGENT_CHANGED: "담당자 변경",
  CUSTOMER_MERGE_BLOCKED: "고객 병합 차단",
  CUSTOMER_MERGE_PREVIEWED: "고객 병합 미리보기",
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

export default function OperationRiskCenter() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const reportInput = useMemo(() => ({
    period,
    dateFrom: period === "custom" && dateFrom ? dateFrom : undefined,
    dateTo: period === "custom" && dateTo ? dateTo : undefined,
  }), [dateFrom, dateTo, period]);

  const { data, isLoading, isFetching, isError, error, refetch } = trpc.operationRisk.summary.useQuery(reportInput, {
    placeholderData: (previous) => previous,
  });

  const overallLevel = (data?.overall.level ?? "normal") as RiskLevel;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Operation Risk Center</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">신규 로드맵 PR6. 운영 리스크 센터</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                branch_admin 전용 화면입니다. 데이터 다운로드, 삭제·복구, 계정·권한, 인수인계, 푸시 실패, 미처리 업무를 기존 로그와 운영 데이터로만 점검합니다.
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
                <p className="mt-1 text-xs text-slate-500">0점에 가까울수록 안정적이며, 70점 이상은 즉시 확인 권장입니다.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data?.riskCards ?? []).map((card) => {
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">다운로드 리스크</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              <Metric label="총 다운로드" value={data?.downloadRisk.total} />
              <Metric label="반복 사용자" value={data?.downloadRisk.repeatedUserCount} />
              <Metric label="사유 확인" value={data?.downloadRisk.shortReasonCount} />
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">인수인계 리스크</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              <Metric label="잔여 업무" value={data?.handoffRisk.unresolvedCount} />
              <Metric label="담당 고객" value={data?.handoffRisk.inactiveCustomerCount} />
              <Metric label="후속/일정" value={(data?.handoffRisk.inactiveFollowUpCount ?? 0) + (data?.handoffRisk.inactiveScheduleCount ?? 0)} />
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">푸시 알림 리스크</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center">
              <Metric label="실패" value={data?.pushRisk.failed} />
              <Metric label="skip" value={data?.pushRisk.skipped} />
              <Metric label="비활성 토큰" value={data?.pushRisk.inactiveTokens} />
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              최근 고위험 activity_logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                  {(data?.recentRiskEvents ?? []).length === 0 ? (
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
                    data?.recentRiskEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(event.createdAt)}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-slate-900">{getActionLabel(event.action)}</div>
                          <div className="text-slate-400">{event.action}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-slate-900">{event.actor?.name ?? "-"}</div>
                          <div className="text-slate-400">{event.actor?.role ?? "-"}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{event.targetType ?? "-"}{event.targetId ? ` #${event.targetId}` : ""}</TableCell>
                        <TableCell className="max-w-sm truncate text-xs text-slate-500">{event.reason ?? event.summary ?? "-"}</TableCell>
                        <TableCell><Badge className={eventLevelClasses[event.riskLevel] ?? eventLevelClasses.normal}>{eventLevelLabels[event.riskLevel] ?? "일반"}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(data?.guides ?? []).map((guide) => (
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

        <Card className="border-emerald-100 bg-emerald-50/60 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              이번 PR6는 탐지와 가시화만 제공합니다. 자동 제재, 자동 권한 변경, 자동 인수인계, 다운로드/export 확장, push 발송 정책 변경은 포함하지 않습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
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
