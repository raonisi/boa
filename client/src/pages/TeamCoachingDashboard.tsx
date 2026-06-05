import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isBefore, startOfToday } from "date-fns";
import { Loader2, Plus, ArrowRight, ClipboardList, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CoachingNoteDialog } from "@/components/CoachingNoteDialog";
import { TeamMemberCoachingTimeline } from "@/components/TeamMemberCoachingTimeline";
import { useAuth } from "@/_core/hooks/useAuth";
import { ForbiddenState } from "@/components/ForbiddenState";
import { getRoleLabel } from "@/lib/userRole";

export default function TeamCoachingDashboard() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: summary, isLoading: isSummaryLoading } = trpc.teamCoaching.summary.useQuery();
  const { data: usersData, isLoading: isUsersLoading } = trpc.users.list.useQuery();
  const { data: notes, isLoading: isNotesLoading } = trpc.teamCoaching.list.useQuery({
    status: "open",
  });

  const isLoading = isSummaryLoading || isUsersLoading || isNotesLoading;

  const usersMap = useMemo(() => {
    if (!usersData) return new Map();
    const map = new Map();
    usersData.forEach((u: any) => map.set(u.id, u));
    return map;
  }, [usersData]);

  // Aggregate stats per user based on notes
  const userStats = useMemo(() => {
    if (!notes || !usersData) return [];
    
    const statsMap = new Map();
    usersData.forEach((u: any) => {
      statsMap.set(u.id, {
        user: u,
        openCount: 0,
        highPriorityCount: 0,
        overdueReviewCount: 0,
        lastCoachedAt: null as Date | null,
      });
    });

    const today = startOfToday();

    notes.forEach((note: any) => {
      if (statsMap.has(note.targetUserId)) {
        const stat = statsMap.get(note.targetUserId);
        stat.openCount++;
        if (note.priority === "high") stat.highPriorityCount++;
        if (note.nextReviewAt && isBefore(new Date(note.nextReviewAt), today)) {
          stat.overdueReviewCount++;
        }
        const noteDate = new Date(note.createdAt);
        if (!stat.lastCoachedAt || isBefore(stat.lastCoachedAt, noteDate)) {
          stat.lastCoachedAt = noteDate;
        }
      }
    });

    return Array.from(statsMap.values()).filter(s => s.openCount > 0).sort((a, b) => b.highPriorityCount - a.highPriorityCount || b.openCount - a.openCount);
  }, [notes, usersData]);

  if (user?.role === "member") {
    return <ForbiddenState description="이 화면은 관리자 권한으로만 사용할 수 있습니다." />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedUser) {
    const targetUser = usersMap.get(selectedUser);
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => setSelectedUser(null)}>
            &larr; 돌아가기
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{targetUser?.name} 코칭 타임라인</h2>
            <p className="text-muted-foreground">{getRoleLabel(targetUser?.role || "member")}</p>
          </div>
        </div>
        <TeamMemberCoachingTimeline targetUserId={selectedUser} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">팀원 코칭 관리</h1>
          <p className="text-muted-foreground">팀원의 행동 습관 개선과 성장을 위한 코칭을 기록하고 관리합니다.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> 코칭 노트 작성
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오픈된 코칭 항목</CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.openNotes || 0}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">집중 코칭 (High)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.highPriority || 0}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">확인일 도래/지연</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.dueForReview || 0}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 주 작성됨</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.thisWeekNotes || 0}건</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>진행 중인 코칭 현황</CardTitle>
          <CardDescription>현재 코칭 항목이 열려있는 팀원 목록입니다. 완료된 코칭은 상세 타임라인에서 확인할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>팀원명</TableHead>
                  <TableHead>오픈 코칭</TableHead>
                  <TableHead>High Priority</TableHead>
                  <TableHead>확인일 지연</TableHead>
                  <TableHead>최근 코칭일</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      진행 중인 코칭 항목이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  userStats.map((stat) => (
                    <TableRow key={stat.user.id}>
                      <TableCell>
                        <div className="font-medium">{stat.user.name}</div>
                        <div className="text-xs text-muted-foreground">{getRoleLabel(stat.user.role)}</div>
                      </TableCell>
                      <TableCell>{stat.openCount}건</TableCell>
                      <TableCell>
                        {stat.highPriorityCount > 0 ? (
                          <Badge variant="destructive">{stat.highPriorityCount}건</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {stat.overdueReviewCount > 0 ? (
                          <span className="text-red-500 font-medium">{stat.overdueReviewCount}건</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{stat.lastCoachedAt ? format(stat.lastCoachedAt, "yyyy-MM-dd") : "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUser(stat.user.id)}>
                          상세 보기 <ArrowRight className="ml-2 h-4 w-4" />
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

      {isDialogOpen && (
        <CoachingNoteDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      )}
    </div>
  );
}
