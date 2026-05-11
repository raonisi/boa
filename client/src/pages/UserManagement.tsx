import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ShieldCheck, ShieldX, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  admin: "관리자",
  manager: "팀장",
  agent: "팀원",
  inactive: "퇴사자",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  agent: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
};

export default function UserManagement() {
  const utils = trpc.useUtils();
  const { user: currentUser } = useAuth();
  const { data: users } = trpc.users.list.useQuery();
  const { data: teams } = trpc.users.teams.useQuery();
  const [editUser, setEditUser] = useState<any>(null);

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success("권한이 변경되었습니다."); utils.users.list.invalidate(); setEditUser(null); },
    onError: () => toast.error("권한 변경에 실패했습니다."),
  });

  const updateTeamMutation = trpc.users.updateTeam.useMutation({
    onSuccess: () => { toast.success("팀이 변경되었습니다."); utils.users.list.invalidate(); },
  });

  const handleBlock = (userId: number) => {
    if (confirm("이 사용자를 퇴사자로 처리하시겠습니까? 즉시 접근이 차단됩니다.")) {
      updateRoleMutation.mutate({ userId, role: "inactive" });
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
                    <TableHead>권한</TableHead>
                    <TableHead>팀</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead>최근 로그인</TableHead>
                    <TableHead className="w-24">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">사용자가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    (users ?? []).map((u) => {
                      const team = teams?.find((t) => t.id === u.teamId);
                      return (
                        <TableRow key={u.id} className={u.role === "inactive" ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{u.name ?? "-"}</TableCell>
                          <TableCell className="text-xs">{u.email ?? "-"}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColors[u.role]}`}>
                              {roleLabels[u.role]}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(u.teamId ?? "")}
                              onValueChange={(v) => updateTeamMutation.mutate({ userId: u.id, teamId: v ? Number(v) : null })}
                            >
                              <SelectTrigger className="h-7 text-xs w-28">
                                <SelectValue placeholder="팀 없음" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">팀 없음</SelectItem>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditUser(u)}
                                title="권한 변경"
                              >
                                <UserCog className="h-3.5 w-3.5" />
                              </Button>
                              {u.role !== "inactive" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleBlock(u.id)}
                                  title="퇴사 처리"
                                >
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

        {/* 팀 관리 */}
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
              <DialogTitle>권한 변경 - {editUser.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">현재 권한: <strong>{roleLabels[editUser.role]}</strong></p>
                <Select
                  defaultValue={editUser.role}
                  onValueChange={(v) => updateRoleMutation.mutate({ userId: editUser.id, role: v as any })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="manager">팀장</SelectItem>
                    <SelectItem value="agent">팀원</SelectItem>
                    <SelectItem value="inactive">퇴사자 (접근 차단)</SelectItem>
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
