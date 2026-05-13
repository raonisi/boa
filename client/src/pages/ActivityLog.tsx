import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Activity, Search } from "lucide-react";
import { useState } from "react";

const actionLabels: Record<string, string> = {
  USER_ROLE_CHANGED: "권한 변경",
  USER_TEAM_CHANGED: "팀 변경",
  TEAM_CREATED: "팀 생성",
  CUSTOMER_CREATED: "고객 등록",
  CUSTOMER_UPDATED: "고객 수정",
  CUSTOMER_ASSIGNED: "고객 배정",
  CONSULTATION_CREATED: "상담기록 추가",
  CONTRACT_CREATED: "계약 등록",
  CONTRACT_UPDATED: "계약 수정",
  SCHEDULE_CREATED: "일정 등록",
  SCHEDULE_UPDATED: "일정 수정",
  SCHEDULE_DELETED: "일정 삭제",
};

const actionColors: Record<string, string> = {
  USER_ROLE_CHANGED: "text-purple-600",
  USER_TEAM_CHANGED: "text-purple-600",
  CUSTOMER_CREATED: "text-green-600",
  CUSTOMER_ASSIGNED: "text-blue-600",
  CUSTOMER_UPDATED: "text-blue-600",
  CONSULTATION_CREATED: "text-indigo-600",
  CONTRACT_CREATED: "text-emerald-600",
  CONTRACT_UPDATED: "text-emerald-600",
  SCHEDULE_CREATED: "text-orange-600",
  SCHEDULE_UPDATED: "text-orange-600",
  SCHEDULE_DELETED: "text-red-600",
};

export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const { data: logs } = trpc.logs.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const getUserName = (userId: number) => users?.find((u) => u.id === userId)?.name ?? `#${userId}`;

  const filtered = (logs ?? []).filter((l) => {
    if (!search) return true;
    const label = actionLabels[l.action] ?? l.action;
    const userName = getUserName(l.userId);
    return label.includes(search) || userName.includes(search) || (l.details ?? "").includes(search);
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Activity Log</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">활동 로그</h1>
            <p className="mt-1 text-sm text-slate-500">시스템 내 주요 변경 사항 기록</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="작업, 사용자, 상세내용 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 max-w-sm rounded-xl bg-slate-50 pl-8"
          />
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
