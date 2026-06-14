import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { adminPage } from "@/lib/adminDesignTokens";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { redactAuditDisplayText } from "@/lib/auditRedaction";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getTargetTypeLabel, localizeKnownEnumText } from "@/lib/userRole";
import { Activity, Search, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";

type QuickFilterId =
  | "high_risk"
  | "download"
  | "delete_restore"
  | "role_change"
  | "user_mgmt"
  | "today"
  | "last_7d";

const QUICK_FILTERS: Array<{
  id: QuickFilterId;
  label: string;
  apply: () => Partial<{
    categoryFilter: string;
    riskFilter: string;
    periodFilter: string;
    search: string;
  }>;
}> = [
  {
    id: "high_risk",
    label: "고위험 작업",
    apply: () => ({ riskFilter: "risk", categoryFilter: "all", periodFilter: "30" }),
  },
  {
    id: "download",
    label: "다운로드",
    apply: () => ({ categoryFilter: "download", riskFilter: "all", periodFilter: "30" }),
  },
  {
    id: "delete_restore",
    label: "삭제/복원",
    apply: () => ({ categoryFilter: "delete", riskFilter: "all", periodFilter: "30" }),
  },
  {
    id: "role_change",
    label: "권한 변경",
    apply: () => ({ search: "권한", categoryFilter: "user", riskFilter: "all", periodFilter: "30" }),
  },
  {
    id: "user_mgmt",
    label: "사용자 관리",
    apply: () => ({ categoryFilter: "user", riskFilter: "all", periodFilter: "30", search: "" }),
  },
  {
    id: "today",
    label: "오늘",
    apply: () => ({ periodFilter: "1", categoryFilter: "all", riskFilter: "all", search: "" }),
  },
  {
    id: "last_7d",
    label: "최근 7일",
    apply: () => ({ periodFilter: "7", categoryFilter: "all", riskFilter: "all", search: "" }),
  },
];

const actionLabels: Record<string, string> = {
  USER_LOGIN: "로그인",
  USER_LOGOUT: "로그아웃",
  USER_FORCE_LOGOUT: "강제 로그아웃",
  USER_OAUTH_RESET: "OAuth 초기화",
  USER_ROLE_CHANGED: "권한 변경",
  USER_TEAM_CHANGED: "팀 변경",
  TEAM_CREATED: "팀 생성",
  CUSTOMER_VIEWED: "고객 조회",
  CUSTOMER_CREATED: "고객 등록",
  CUSTOMER_UPDATED: "고객 정보 수정",
  CUSTOMER_ASSIGNED: "고객 배정",
  CUSTOMER_DEACTIVATED: "고객 삭제",
  CUSTOMER_RESTORED: "고객 복구",
  CONSULTATION_CREATED: "상담기록 추가",
  CONSULTATION_UPDATED: "상담기록 수정",
  CONTRACT_CREATED: "계약 등록",
  CONTRACT_UPDATED: "계약 수정",
  CONTRACT_DELETED: "계약 삭제",
  CONTRACT_RESTORED: "계약 복구",
  DATA_DOWNLOAD: "데이터 다운로드",
  SCHEDULE_CREATED: "일정 등록",
  SCHEDULE_UPDATED: "일정 수정",
  SCHEDULE_DELETED: "일정 삭제",
  SCHEDULE_COMPLETED: "일정 완료",
  SCHEDULE_CANCELLED: "일정 취소",
};

const riskyPatterns = [
  "DOWNLOAD",
  "DELETE",
  "DELETED",
  "RESTORE",
  "RESTORED",
  "PURGE",
  "PERMANENT",
  "FORCE_LOGOUT",
  "OAUTH_RESET",
];

function actionLabel(action: string) {
  return actionLabels[action] ?? "기타 작업";
}

function isRiskAction(action: string) {
  return riskyPatterns.some(pattern => action.includes(pattern));
}

function isRoleChangeAction(action: string) {
  return action.includes("ROLE_CHANGED") || action.includes("STATUS_CHANGED");
}

function actionCategory(action: string) {
  if (action.includes("DOWNLOAD")) return "download";
  if (
    action.includes("DELETE") ||
    action.includes("RESTORE") ||
    action.includes("PURGE")
  )
    return "delete";
  if (
    action.includes("USER") ||
    action.includes("OAUTH") ||
    action.includes("LOGIN")
  )
    return "user";
  if (action.includes("CUSTOMER")) return "customer";
  if (action.includes("CONTRACT")) return "contract";
  if (action.includes("SCHEDULE")) return "schedule";
  return "other";
}

function extractReason(details?: string | null) {
  if (!details) return "";
  try {
    const parsed = JSON.parse(details);
    return parsed?.metadata?.reason ?? parsed?.reason ?? "";
  } catch {
    const match = details.match(/reason["'=:\s]+([^,}\n]+)/i);
    return match?.[1]?.replaceAll('"', "").trim() ?? "";
  }
}

export function safeLogSummary(log: any) {
  const reason = extractReason(log.details);
  if (reason) return `사유: ${redactAuditDisplayText(reason, 160)}`;
  return redactAuditDisplayText(localizeKnownEnumText(log.details), 180);
}

export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("30");
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterId | null>(
    null
  );
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const {
    data: logs,
    isLoading: isLogsLoading,
    isError: isLogsError,
    refetch: refetchLogs,
  } = trpc.logs.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const getUserName = (userId: number) =>
    users?.find(u => u.id === userId)?.name ?? `#${userId}`;
  const userOptions = useMemo(
    () =>
      Array.from(new Set((logs ?? []).map(log => log.userId))).filter(Boolean),
    [logs]
  );

  const filtered = (logs ?? []).filter(log => {
    const label = actionLabel(log.action);
    const userName = getUserName(log.userId);
    const reason = extractReason(log.details);
    const createdAt = new Date(log.createdAt);
    const withinPeriod =
      periodFilter === "all" ||
      createdAt >=
        new Date(Date.now() - Number(periodFilter) * 24 * 60 * 60 * 1000);
    const safeDetails = redactAuditDisplayText(log.details);
    const matchSearch =
      !search ||
      label.includes(search) ||
      log.action.includes(search) ||
      userName.includes(search) ||
      safeDetails.includes(search) ||
      reason.includes(search);
    const matchUser = userFilter === "all" || String(log.userId) === userFilter;
    const matchCategory =
      categoryFilter === "all" || actionCategory(log.action) === categoryFilter;
    const matchRoleChange =
      activeQuickFilter !== "role_change" || isRoleChangeAction(log.action);
    const matchRisk =
      riskFilter === "all" ||
      (riskFilter === "risk"
        ? isRiskAction(log.action)
        : !isRiskAction(log.action));
    return (
      withinPeriod &&
      matchSearch &&
      matchUser &&
      matchCategory &&
      matchRoleChange &&
      matchRisk
    );
  });

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (activeQuickFilter) {
      chips.push(
        QUICK_FILTERS.find(item => item.id === activeQuickFilter)?.label ?? ""
      );
    }
    if (search) chips.push(`검색: ${search}`);
    if (userFilter !== "all") chips.push(`사용자: ${getUserName(Number(userFilter))}`);
    if (categoryFilter !== "all" && activeQuickFilter !== "download" && activeQuickFilter !== "delete_restore" && activeQuickFilter !== "user_mgmt") {
      const categoryLabels: Record<string, string> = {
        customer: "고객",
        contract: "계약",
        schedule: "일정",
        download: "다운로드",
        delete: "삭제/복구",
        user: "사용자/보안",
      };
      chips.push(categoryLabels[categoryFilter] ?? categoryFilter);
    }
    if (riskFilter === "risk" && activeQuickFilter !== "high_risk") {
      chips.push("위험 작업");
    }
    if (periodFilter === "1") chips.push("오늘");
    else if (periodFilter === "7" && activeQuickFilter !== "last_7d") {
      chips.push("최근 7일");
    } else if (periodFilter === "30") chips.push("최근 30일");
    else if (periodFilter === "90") chips.push("최근 90일");
    else if (periodFilter === "all") chips.push("전체 기간");
    return chips.filter(Boolean);
  }, [
    activeQuickFilter,
    categoryFilter,
    getUserName,
    periodFilter,
    riskFilter,
    search,
    userFilter,
  ]);

  const applyQuickFilter = (filterId: QuickFilterId) => {
    const preset = QUICK_FILTERS.find(item => item.id === filterId);
    if (!preset) return;
    const next = preset.apply();
    setActiveQuickFilter(filterId);
    if (next.categoryFilter !== undefined) setCategoryFilter(next.categoryFilter);
    if (next.riskFilter !== undefined) setRiskFilter(next.riskFilter);
    if (next.periodFilter !== undefined) setPeriodFilter(next.periodFilter);
    if (next.search !== undefined) setSearch(next.search);
  };

  const resetFilters = () => {
    setSearch("");
    setUserFilter("all");
    setCategoryFilter("all");
    setRiskFilter("all");
    setPeriodFilter("30");
    setActiveQuickFilter(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className={adminPage.card}>
          <CardContent className="p-5">
            <p className={adminPage.eyebrow}>보안/감사</p>
            <h1 className={cn("mt-1", adminPage.title)}>활동 로그</h1>
            <p className={cn("mt-1", adminPage.subtitle)}>
              위험 작업을 빠르게 찾고, 작업명·위험도·사유 중심으로 감사 이력을
              확인합니다. 권한 범위 안에서만 조회할 수 있습니다.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">빠른 필터</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_FILTERS.map(filter => (
                  <Button
                    key={filter.id}
                    type="button"
                    size="sm"
                    variant={activeQuickFilter === filter.id ? "default" : "outline"}
                    className={cn(
                      "min-h-9 rounded-full",
                      activeQuickFilter === filter.id &&
                        "bg-boa-navy text-primary-foreground hover:bg-boa-navy/90"
                    )}
                    onClick={() => applyQuickFilter(filter.id)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            {activeFilterChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  적용 중
                </span>
                {activeFilterChips.map(chip => (
                  <Badge
                    key={chip}
                    variant="secondary"
                    className="rounded-full bg-white text-foreground"
                  >
                    {chip}
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 gap-1 px-2 text-xs"
                  onClick={resetFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  필터 초기화
                </Button>
              </div>
            ) : null}
            <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-5">
              <Label className="md:col-span-2">검색어</Label>
              <Label>사용자</Label>
              <Label>작업 유형</Label>
              <Label>위험도</Label>
              <Label>기간</Label>
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-4 h-4 w-4 text-muted-foreground md:left-2.5 md:top-2.5" />
                <Input
                  placeholder="작업, 사용자, 사유, 상세 검색"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setActiveQuickFilter(null);
                  }}
                  className="min-h-12 rounded-xl bg-muted/50 pl-9 md:h-10 md:min-h-10 md:pl-8"
                />
              </div>
              <Select
                value={userFilter}
                onValueChange={value => {
                  setUserFilter(value);
                  setActiveQuickFilter(null);
                }}
              >
                <SelectTrigger className="min-h-12 rounded-xl bg-muted/50 md:h-10 md:min-h-10">
                  <SelectValue placeholder="사용자" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 사용자</SelectItem>
                  {userOptions.map(userId => (
                    <SelectItem key={userId} value={String(userId)}>
                      {getUserName(userId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={categoryFilter}
                onValueChange={value => {
                  setCategoryFilter(value);
                  setActiveQuickFilter(null);
                }}
              >
                <SelectTrigger className="min-h-12 rounded-xl bg-muted/50 md:h-10 md:min-h-10">
                  <SelectValue placeholder="작업 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 작업</SelectItem>
                  <SelectItem value="customer">고객</SelectItem>
                  <SelectItem value="contract">계약</SelectItem>
                  <SelectItem value="schedule">일정</SelectItem>
                  <SelectItem value="download">다운로드</SelectItem>
                  <SelectItem value="delete">삭제/복구</SelectItem>
                  <SelectItem value="user">사용자/보안</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={riskFilter}
                onValueChange={value => {
                  setRiskFilter(value);
                  setActiveQuickFilter(null);
                }}
              >
                <SelectTrigger className="min-h-12 rounded-xl bg-muted/50 md:h-10 md:min-h-10">
                  <SelectValue placeholder="위험도" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 위험도</SelectItem>
                  <SelectItem value="risk">위험 작업</SelectItem>
                  <SelectItem value="normal">일반 작업</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={periodFilter}
                onValueChange={value => {
                  setPeriodFilter(value);
                  setActiveQuickFilter(null);
                }}
              >
                <SelectTrigger className="min-h-12 rounded-xl bg-muted/50 md:h-10 md:min-h-10">
                  <SelectValue placeholder="기간" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">오늘</SelectItem>
                  <SelectItem value="7">최근 7일</SelectItem>
                  <SelectItem value="30">최근 30일</SelectItem>
                  <SelectItem value="90">최근 90일</SelectItem>
                  <SelectItem value="all">전체 기간</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                표시 {isLogsLoading || isLogsError ? "-" : filtered.length}건 /
                전체 {isLogsLoading || isLogsError ? "-" : (logs ?? []).length}
                건
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-12 justify-start px-0 text-xs sm:min-h-8 sm:px-2"
                onClick={resetFilters}
              >
                필터 초기화
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
          <CardContent className="p-0">
            <div className="space-y-3 p-4 md:hidden">
              {isLogsLoading ? (
                <EmptyState
                  variant="loading"
                  title="활동 로그를 불러오는 중입니다."
                  description="권한 범위 안의 감사 기록을 확인하고 있습니다."
                  className="border-0 bg-transparent py-6"
                />
              ) : isLogsError ? (
                <ErrorState
                  title="활동 로그를 불러오지 못했습니다."
                  description="로그가 없는 상태와 구분해 표시하고 있습니다. 잠시 후 다시 시도해 주세요."
                  retryLabel="다시 시도"
                  onRetry={() => void refetchLogs()}
                  className="border-0 bg-transparent py-6"
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="표시할 활동 로그가 없습니다."
                  description="조건을 조금 넓혀 다시 확인해 주세요."
                  className="border-0 bg-transparent py-4"
                />
              ) : (
                filtered.map(log => {
                  const risky = isRiskAction(log.action);
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "rounded-2xl border border-border bg-white p-4 shadow-sm",
                        risky && "border-l-4 border-l-boa-amber bg-boa-amber/10"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                            {actionLabel(log.action)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("ko-KR")}
                          </p>
                        </div>
                        {risky && (
                          <Badge className="shrink-0 bg-boa-amber/16 text-amber-900">
                            <ShieldAlert className="h-3 w-3" /> 고위험
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                        <div className="rounded-xl bg-muted/50 p-3">
                          사용자: {getUserName(log.userId)}
                        </div>
                        <div className="rounded-xl bg-muted/50 p-3">
                          대상:{" "}
                          {log.targetType
                            ? `${getTargetTypeLabel(log.targetType)}${log.targetId ? ` #${log.targetId}` : ""}`
                            : "-"}
                        </div>
                        <div className="rounded-xl bg-muted/50 p-3">
                          <p className="font-medium text-foreground">
                            사유/요약
                          </p>
                          <p className="mt-1 line-clamp-3 leading-5">
                            {safeLogSummary(log)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 min-h-12 w-full"
                        onClick={() => setSelectedLog(log)}
                      >
                        상세보기
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>시각</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>작업</TableHead>
                    <TableHead>대상</TableHead>
                    <TableHead>사유/요약</TableHead>
                    <TableHead className="w-24">상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLogsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <EmptyState
                          variant="loading"
                          title="활동 로그를 불러오는 중입니다."
                          description="권한 범위 안의 감사 기록을 확인하고 있습니다."
                          className="mx-auto max-w-md border-0 bg-transparent py-0"
                        />
                      </TableCell>
                    </TableRow>
                  ) : isLogsError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <ErrorState
                          title="활동 로그를 불러오지 못했습니다."
                          description="로그가 없는 상태와 구분해 표시하고 있습니다. 잠시 후 다시 시도해 주세요."
                          retryLabel="다시 시도"
                          onRetry={() => void refetchLogs()}
                          className="mx-auto max-w-md border-0 bg-transparent py-0"
                        />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <EmptyState
                          icon={Activity}
                          title="표시할 활동 로그가 없습니다."
                          description="조건을 조금 넓혀 다시 확인해 주세요."
                          className="mx-auto max-w-md border-0 bg-transparent py-0"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(log => {
                      const risky = isRiskAction(log.action);
                      return (
                        <TableRow
                          key={log.id}
                          className={risky ? "border-l-4 border-l-boa-amber bg-boa-amber/8" : ""}
                        >
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("ko-KR")}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {getUserName(log.userId)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-foreground">
                                {actionLabel(log.action)}
                              </span>
                              {risky && (
                                <Badge className="bg-boa-amber/16 text-amber-900">
                                  <ShieldAlert className="h-3 w-3" /> 고위험
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.targetType
                              ? `${getTargetTypeLabel(log.targetType)}${log.targetId ? ` #${log.targetId}` : ""}`
                              : "-"}
                          </TableCell>
                          <TableCell className="max-w-[18rem] text-xs text-muted-foreground">
                            <span className="line-clamp-2 break-words">
                              {safeLogSummary(log)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              상세보기
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={Boolean(selectedLog)}
          onOpenChange={open => {
            if (!open) setSelectedLog(null);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>활동 로그 상세</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-3 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">작업</p>
                    <p className="font-medium">
                      {actionLabel(selectedLog.action)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">사용자</p>
                    <p className="font-medium">
                      {getUserName(selectedLog.userId)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">시각</p>
                    <p>
                      {new Date(selectedLog.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">대상</p>
                    <p>
                      {selectedLog.targetType
                        ? `${getTargetTypeLabel(selectedLog.targetType)}${selectedLog.targetId ? ` #${selectedLog.targetId}` : ""}`
                        : "-"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">안전 요약</p>
                  <p className="mt-1 rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground">
                    {safeLogSummary(selectedLog)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    원문 세부정보(민감정보 제거 후)
                  </p>
                  <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-foreground p-3 text-xs text-primary-foreground whitespace-pre-wrap">
                    {redactAuditDisplayText(
                      localizeKnownEnumText(selectedLog.details),
                      2000
                    )}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
