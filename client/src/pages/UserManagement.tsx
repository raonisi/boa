import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ShieldX, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  branch_admin: "지점장",
  sub_branch_admin: "부지점장",
  team_leader: "팀장",
  member: "팀원",
};

const roleBadgeColors: Record<string, string> = {
  branch_admin: "bg-purple-100 text-purple-700",
  sub_branch_admin: "bg-blue-100 text-blue-700",
  team_leader: "bg-indigo-100 text-indigo-700",
  member: "bg-green-100 text-green-700",
};

const statusBadgeColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  resigned: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  active: "재직",
  inactive: "비활성",
  resigned: "퇴사",
};

export default function UserManagement() {
  const utils = trpc.useUtils();
  const { data: users } = trpc.users.list.useQuery();
  const { data: teams } = trpc.users.teams.useQuery();
  const [editUser, setEditUser] = useState<any>(null);

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success("권한이 변경되었습니다."); utils.users.list.invalidate(); setEditUser(null); },
    onError: () => toast.error("권한 변경에 실패했습니다."),
  });

  const updateAccountStatusMutation = trpc.users.updateAccountStatus.useMutation({
    onSuccess: () => { toast.success("계정 상태가 변경되었습니다."); utils.users.list.invalidate(); },
    onError: () => toast.error("상태 변경에 실패했습니다."),
  });

  const updateTeamMutation = trpc.users.updateTeam.useMutation({
    onSuccess: () => { toast.success("팀이 변경되었습니다."); utils.users.list.invalidate(); },
  });

  const handleBlock = (userId: number) => {
    if (confirm("이 사용자를 퇴사 처리하시겠습니까? 즉시 접근이 차단됩니다.")) {
      updateAccountStatusMutation.mutate({ userId, accountStatus: "inactive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">사용자 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">총 {users?.length ?? 0}명</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>계정 상태</TableHead>
                    <TableHead>팀</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead>최근 로그인</TableHead>
                    <TableHead className="w-24">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">사용자가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    (users ?? []).map((u) => {
                      const team = teams?.find((t) => t.id === u.teamId);
                      const isInactive = (u as any).accountStatus !== "active";
                      return (
                        <TableRow key={u.id} className={isInactive ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{u.name ?? "-"}</TableCell>
                          <TableCell className="text-xs">{u.email ?? "-"}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColors[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                              {roleLabels[u.role] ?? u.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColors[(u as any).accountStatus] ?? "bg-gray-100"}`}>
                              {statusLabels[(u as any).accountStatus] ?? (u as any).accountStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(u.teamId ?? "none")}
                              onValueChange={(v) => updateTeamMutation.mutate({ userId: u.id, teamId: v === "none" ? null : Number(v) })}
                            >
                              <SelectTrigger className="h-7 text-xs w-28">
                                <SelectValue placeholder="팀 없음" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">팀 없음</SelectItem>
                                {(teams ?? []).map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.lastSignedIn).toLocaleDateString("ko-KR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditUser(u)} title="권한 변경">
                                <UserCog className="h-3.5 w-3.5" />
                              </Button>
                              {(u as any).accountStatus === "active" && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleBlock(u.id)} title="퇴사 처리">
                                  <ShieldX className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
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

        {/* 팀 목록 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">팀 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {(teams ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 팀이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(teams ?? []).map((t) => (
                  <Badge key={t.id} variant="secondary">{t.name}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 권한 변경 모달 */}
      {editUser && (
        <Dialog open={true} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>권한/상태 변경 - {editUser.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">역할 변경</p>
                <Select
                  defaultValue={editUser.role}
                  onValueChange={(v) => updateRoleMutation.mutate({ userId: editUser.id, role: v as any })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branch_admin">지점장</SelectItem>
                    <SelectItem value="sub_branch_admin">부지점장</SelectItem>
                    <SelectItem value="team_leader">팀장</SelectItem>
                    <SelectItem value="member">팀원</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">계정 상태 변경</p>
                <Select
                  defaultValue={(editUser as any).accountStatus ?? "active"}
                  onValueChange={(v) => updateAccountStatusMutation.mutate({ userId: editUser.id, accountStatus: v as any })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">재직 (active)</SelectItem>
                    <SelectItem value="inactive">비활성 (inactive)</SelectItem>
                    <SelectItem value="resigned">퇴사 (resigned)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setEditUser(null)}>닫기</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
