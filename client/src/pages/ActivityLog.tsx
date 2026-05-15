import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Activity, Archive, Calendar, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const actionLabels: Record<string, string> = {
  USER_LOGIN: "로그인",
  LOGIN_BLOCKED: "로그인 차단",
  USER_CREATED: "사용자 생성",
  USER_OAUTH_LINKED: "OAuth 연동",
  USER_OAUTH_LINK_CONFLICT: "OAuth 충돌",
  USER_ROLE_CHANGED: "권한 변경",
  USER_DEACTIVATED: "사용자 비활성화",
  USER_TEAM_CHANGED: "팀 변경",
  TEAM_CREATED: "팀 생성",
  TEAM_UPDATED: "팀 수정",
  TEAM_DEACTIVATED: "팀 비활성화",
  TEAM_LEADER_ASSIGNED: "팀장 배정",
  MEMBER_ASSIGNED_TO_TEAM: "팀원 배정",
  USER_MOVED_TO_ANOTHER_TEAM: "팀 이동",
  USER_MOVED_TO_ANOTHER_SUB_BRANCH: "부지점 이동",
  CUSTOMER_CREATED: "고객 등록",
  CUSTOMER_UPDATED: "고객 수정",
  CUSTOMER_ASSIGNED: "고객 배정",
  CUSTOMER_REASSIGNED: "고객 재배정",
  CUSTOMER_TRANSFERRED: "고객 이관",
  CUSTOMER_DEACTIVATED: "고객 비활성화",
  ASSIGNMENT_HISTORY_CREATED: "배정 이력",
  CUSTOMER_BULK_IMPORT_PREVIEWED: "일괄 업로드 미리보기",
  CUSTOMER_BULK_IMPORTED: "일괄 업로드",
  CUSTOMER_BULK_IMPORT_FAILED: "일괄 업로드 실패",
  DATA_IMPORT: "데이터 가져오기",
  DATA_DOWNLOAD: "데이터 내보내기",
  CONSULTATION_CREATED: "상담기록 추가",
  CONSULTATION_UPDATED: "상담기록 수정",
  CONTRACT_CREATED: "계약 등록",
  CONTRACT_UPDATED: "계약 수정",
  CONTRACT_OWNER_CHANGED: "계약 담당 변경",
  CONTRACT_DEACTIVATED: "계약 비활성화",
  SCHEDULE_CREATED: "일정 등록",
  SCHEDULE_UPDATED: "일정 수정",
  SCHEDULE_DELETED: "일정 삭제",
  DB_ASSIGNED_TO_SUB_BRANCH_ADMIN: "DB 부지점 배정",
  DB_ASSIGNED_BY_BRANCH_ADMIN: "DB 지점장 배정",
  DB_ASSIGNED_BY_SUB_BRANCH_ADMIN: "DB 부지점장 배정",
  MASTER_DATA_UPDATED: "마스터 데이터 수정",
};

const actionColors: Record<string, string> = {
  USER_LOGIN: "text-slate-600",
  LOGIN_BLOCKED: "text-red-600",
  USER_ROLE_CHANGED: "text-purple-600",
  USER_TEAM_CHANGED: "text-purple-600",
  USER_DEACTIVATED: "text-red-500",
  CUSTOMER_CREATED: "text-green-600",
  CUSTOMER_ASSIGNED: "text-blue-600",
  CUSTOMER_UPDATED: "text-blue-600",
  CUSTOMER_DEACTIVATED: "text-red-500",
  CUSTOMER_BULK_IMPORTED: "text-teal-600",
  CONSULTATION_CREATED: "text-indigo-600",
  CONTRACT_CREATED: "text-emerald-600",
  CONTRACT_UPDATED: "text-emerald-600",
  CONTRACT_DEACTIVATED: "text-red-500",
  SCHEDULE_CREATED: "text-orange-600",
  SCHEDULE_UPDATED: "text-orange-600",
  SCHEDULE_DELETED: "text-red-600",
  DATA_DOWNLOAD: "text-amber-600",
};

const actionOptions = Object.entries(actionLabels).map(([value, label]) => ({ value, label }));

function formatDateForInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ActivityLog() {
  const { user } = useAuth();
  const isAdmin = user?.role === "branch_admin";

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("logs");

  const { data: logs } = trpc.logs.list.useQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo ? new Date(new Date(dateTo).getTime() + 86400000 - 1).toISOString() : undefined,
    action: actionFilter !== "all" ? actionFilter : undefined,
    limit: 1000,
  });
  const { data: users } = trpc.users.list.useQuery();
  const { data: monthlySummary } = trpc.logs.monthlySummary.useQuery(undefined, { enabled: isAdmin });

  const getUserName = (userId: number) => users?.find((u) => u.id === userId)?.name ?? `#${userId}`;

  const filtered = (logs ?? []).filter((l) => {
    if (!search) return true;
    const label = actionLabels[l.action] ?? l.action;
    const userName = getUserName(l.userId);
    return label.includes(search) || userName.includes(search) || (l.details ?? "").includes(search);
  });

  const handleExportCsv = () => {
    if (!logs || logs.length === 0) {
      toast.error("내보낼 로그가 없습니다.");
      return;
    }
    const header = ["일시", "사용자ID", "사용자", "작업코드", "작업", "대상유형", "대상ID", "상세"];
    const rows = logs.map((l) => [
      new Date(l.createdAt).toLocaleString("ko-KR"),
      String(l.userId),
      getUserName(l.userId),
      l.action,
      actionLabels[l.action] ?? l.action,
      l.targetType ?? "",
      l.targetId ? String(l.targetId) : "",
      (l.details ?? "").replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const suffix = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : `_${formatDateForInput(new Date())}`;
    link.download = `활동로그${suffix}.csv`;
    link.click();
    toast.success(`${logs.length}건의 로그를 내보냈습니다.`);
  };

  const monthlySummaryGrouped = useMemo(() => {
    if (!monthlySummary) return [];
    return monthlySummary.map((m) => {
      const topActions = Object.entries(m.actions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      return { ...m, topActions };
    });
  }, [monthlySummary]);

  const handleSetMonthFilter = (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    const from = new Date(year, mon - 1, 1);
    const lastDay = new Date(year, mon, 0);
    setDateFrom(formatDateForInput(from));
    setDateTo(formatDateForInput(lastDay));
    setActiveTab("logs");
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Activity Log</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">활동 로그</h1>
            <p className="mt-1 text-sm text-slate-500">시스템 내 주요 변경 사항 기록 · 날짜별 조회 및 월별 아카이브 내보내기</p>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto flex-wrap rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger value="logs">로그 조회</TabsTrigger>
            {isAdmin && <TabsTrigger value="archive">월별 아카이브</TabsTrigger>}
          </TabsList>

          <TabsContent value="logs" className="space-y-4 mt-4">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="작업, 사용자, 상세내용 검색"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-10 rounded-xl bg-slate-50 pl-8"
                      />
                    </div>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                      <SelectTrigger className="md:w-52 rounded-xl">
                        <SelectValue placeholder="작업 유형" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 작업</SelectItem>
                        {actionOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2 items-end">
                    <div className="flex items-center gap-2 flex-1">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-10 rounded-xl bg-slate-50"
                        placeholder="시작일"
                      />
                      <span className="text-sm text-muted-foreground">~</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-10 rounded-xl bg-slate-50"
                        placeholder="종료일"
                      />
                    </div>
                    <div className="flex gap-2">
                      {(dateFrom || dateTo || actionFilter !== "all") && (
                        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setActionFilter("all"); setSearch(""); }}>
                          필터 초기화
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
                          <Download className="h-3.5 w-3.5" />CSV 내보내기
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead>시각</TableHead>
                        <TableHead>사용자</TableHead>
                        <TableHead>작업</TableHead>
                        <TableHead>대상</TableHead>
                        <TableHead>상세</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Activity className="h-8 w-8 opacity-30" />
                              <p className="text-sm">활동 로그가 없습니다.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("ko-KR")}
                            </TableCell>
                            <TableCell className="font-medium text-sm">{getUserName(log.userId)}</TableCell>
                            <TableCell>
                              <span className={`text-sm font-medium ${actionColors[log.action] ?? "text-foreground"}`}>
                                {actionLabels[log.action] ?? log.action}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.targetType ? `${log.targetType}${log.targetId ? ` #${log.targetId}` : ""}` : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                              {log.details ?? "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filtered.length > 0 && (
                  <div className="px-4 py-2.5 border-t bg-slate-50/50 text-xs text-muted-foreground">
                    총 {filtered.length}건 표시
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="archive" className="space-y-4 mt-4">
              <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    월별 로그 아카이브
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    월별 로그 통계를 확인하고, 특정 월의 로그를 CSV로 내보내어 아카이브할 수 있습니다.
                  </p>
                  <div className="overflow-x-auto border rounded-md">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead>월</TableHead>
                          <TableHead className="text-right">총 건수</TableHead>
                          <TableHead>주요 작업</TableHead>
                          <TableHead className="text-right">관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlySummaryGrouped.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              월별 로그 데이터가 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          monthlySummaryGrouped.map((m) => (
                            <TableRow key={m.month}>
                              <TableCell className="font-medium">{m.month}</TableCell>
                              <TableCell className="text-right tabular-nums">{m.total.toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  {m.topActions.map(([action, count]) => (
                                    <span key={action} className="inline-flex items-center gap-1 text-xs bg-slate-100 rounded px-1.5 py-0.5">
                                      <span className="text-muted-foreground">{actionLabels[action] ?? action}</span>
                                      <span className="font-medium tabular-nums">{count}</span>
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() => handleSetMonthFilter(m.month)}
                                >
                                  <Search className="h-3 w-3" />조회
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
