import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, ShieldX, UserCog } from "lucide-react";
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

const loginStatusLabels: Record<string, string> = {
  invited: "초대됨",
  linked: "로그인 완료",
};

const loginStatusColors: Record<string, string> = {
  invited: "bg-yellow-100 text-yellow-700",
  linked: "bg-green-100 text-green-700",
};

export default function UserManagement() {
  const utils = trpc.useUtils();
  const { data: users } = trpc.users.list.useQuery();
  const { data: teams } = trpc.users.teams.useQuery();
  const [editUser, setEditUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

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

  const updateSubBranchMutation = trpc.users.updateSubBranchAdmin.useMutation({
    onSuccess: () => { toast.success("소속 부지점장이 변경되었습니다."); utils.users.list.invalidate(); },
    onError: (err) => toast.error(err.message || "변경에 실패했습니다."),
  });

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => { toast.success("사용자가 추가되었습니다."); utils.users.list.invalidate(); setShowCreate(false); },
    onError: (err) => toast.error(err.message || "사용자 추가에 실패했습니다."),
  });

  const handleBlock = (userId: number) => {
    if (confirm("이 사용자를 퇴사 처리하시겠습니까? 즉시 접근이 차단됩니다.")) {
      updateAccountStatusMutation.mutate({ userId, accountStatus: "inactive" });
    }
  };

  const subBranchAdmins = (users ?? []).filter((u) => u.role === "sub_branch_admin" && (u as any).accountStatus === "active");

  const handleSubBranchChange = (userId: number, currentTeamId: number | null, newSubBranchAdminId: string) => {
    const newId = newSubBranchAdminId === "none" ? null : Number(newSubBranchAdminId);
    if (currentTeamId && newId !== null) {
      const team = (teams ?? []).find((t) => t.id === currentTeamId);
      if (team && (team as any).subBranchAdminId !== newId) {
        if (!confirm(`이 사용자는 현재 팀(${team.name})에 소속되어 있습니다.\n부지점장 산하를 변경하면 팀 소속이 해제됩니다.\n계속하시겠습니까?`)) return;
        updateTeamMutation.mutate({ userId, teamId: null });
      }
    }
    updateSubBranchMutation.mutate({ userId, subBranchAdminId: newId });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">사용자 관리</h1>
            <p className="text-sm text-muted-foreground mt-0.5">총 {users?.length ?? 0}명</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> 사용자 추가
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>계정 상태</TableHead>
                    <TableHead>로그인 상태</TableHead>
                    <TableHead>팀</TableHead>
                    <TableHead>소속 부지점장</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead className="w-16">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">사용자가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    (users ?? []).map((u) => {
                      const team = teams?.find((t) => t.id === u.teamId);
                      const sba = (users ?? []).find((s) => s.id === (u as any).subBranchAdminId);
                      const isInactive = (u as any).accountStatus !== "active";
                      const canAssignSubBranch = u.role === "team_leader" || u.role === "member";
                      const loginStatus = (u as any).loginStatus ?? "linked";
                      return (
                        <TableRow key={u.id} className={isInactive ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{u.name ?? "-"}</TableCell>
                          <TableCell className="text-xs">{u.email ?? "-"}</TableCell>
                          <TableCell className="text-xs">{(u as any).phone ?? "-"}</TableCell>
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${loginStatusColors[loginStatus] ?? "bg-gray-100"}`}>
                              {loginStatusLabels[loginStatus] ?? loginStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(u.teamId ?? "none")}
                              onValueChange={(v) => updateTeamMutation.mutate({ userId: u.id, teamId: v === "none" ? null : Number(v) })}
                            >
                              <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="팀 없음" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">팀 없음</SelectItem>
                                {(teams ?? []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {canAssignSubBranch ? (
                              <Select
                                value={String((u as any).subBranchAdminId ?? "none")}
                                onValueChange={(v) => handleSubBranchChange(u.id, u.teamId, v)}
                              >
                                <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="미배정" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">미배정</SelectItem>
                                  {subBranchAdmins.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">{sba?.name ?? "-"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString("ko-KR")}
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

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">팀 목록</CardTitle></CardHeader>
          <CardContent>
            {(teams ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 팀이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(teams ?? []).map((t) => <Badge key={t.id} variant="secondary">{t.name}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 사용자 추가 모달 */}
      {showCreate && (
        <CreateUserModal
          teams={teams ?? []}
          subBranchAdmins={subBranchAdmins}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createUserMutation.mutate(data)}
          loading={createUserMutation.isPending}
        />
      )}

      {/* 권한 변경 모달 */}
      {editUser && (
        <Dialog open={true} onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>권한/상태 변경 - {editUser.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">역할 변경</p>
                <Select defaultValue={editUser.role} onValueChange={(v) => updateRoleMutation.mutate({ userId: editUser.id, role: v as any })}>
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
                <Select defaultValue={(editUser as any).accountStatus ?? "active"} onValueChange={(v) => updateAccountStatusMutation.mutate({ userId: editUser.id, accountStatus: v as any })}>
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

function CreateUserModal({ teams, subBranchAdmins, onClose, onSubmit, loading }: {
  teams: any[]; subBranchAdmins: any[];
  onClose: () => void; onSubmit: (data: any) => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    memo: "",
    role: "member" as "branch_admin" | "sub_branch_admin" | "team_leader" | "member",
    accountStatus: "active" as "active" | "inactive" | "resigned",
    teamId: "none",
    subBranchAdminId: "none",
  });

  const handleTeamChange = (teamId: string) => {
    const team = teams.find((t) => t.id === Number(teamId));
    const autoSubBranchAdminId = team && (team as any).subBranchAdminId ? String((team as any).subBranchAdminId) : "none";
    setForm({ ...form, teamId, subBranchAdminId: autoSubBranchAdminId });
  };

  const showTeam = form.role === "team_leader" || form.role === "member";
  const showSubBranch = form.role === "team_leader" || form.role === "member";

  const handleSubmit = () => {
    if (!form.name || !form.email) return;
    onSubmit({
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      memo: form.memo || undefined,
      role: form.role,
      accountStatus: form.accountStatus,
      teamId: form.teamId !== "none" ? Number(form.teamId) : null,
      subBranchAdminId: form.subBranchAdminId !== "none" ? Number(form.subBranchAdminId) : null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>사용자 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">이름 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 mt-1" placeholder="홍길동" />
          </div>
          <div>
            <Label className="text-xs">이메일 * (로그인 시 매핑 기준)</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 mt-1" placeholder="user@example.com" />
          </div>
          <div>
            <Label className="text-xs">연락처</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 mt-1" placeholder="010-0000-0000" maxLength={20} />
          </div>
          <div>
            <Label className="text-xs">역할</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any, teamId: "none", subBranchAdminId: "none" })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="branch_admin">지점장</SelectItem>
                <SelectItem value="sub_branch_admin">부지점장</SelectItem>
                <SelectItem value="team_leader">팀장</SelectItem>
                <SelectItem value="member">팀원</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showTeam && (
            <div>
              <Label className="text-xs">소속 팀 (선택)</Label>
              <Select value={form.teamId} onValueChange={handleTeamChange}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="팀 없음" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">팀 없음 (미배정)</SelectItem>
                  {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {showSubBranch && (
            <div>
              <Label className="text-xs">소속 부지점장 {form.teamId !== "none" ? "(팀 선택 시 자동 설정)" : "(선택)"}</Label>
              <Select value={form.subBranchAdminId} onValueChange={(v) => setForm({ ...form, subBranchAdminId: v })} disabled={form.teamId !== "none"}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="미배정" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미배정</SelectItem>
                  {subBranchAdmins.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">메모 (선택)</Label>
            <Textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              className="mt-1 text-sm resize-none"
              rows={2}
              placeholder="내부 메모 (선택)"
            />
            <p className="text-[10px] text-muted-foreground mt-1">⚠️ 메모에는 주민번호, 민감 병력, 금융 비밀번호 등 민감정보를 입력하지 마세요.</p>
          </div>
          <p className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
            ℹ️ 사용자는 이메일로 로그인 시 자동으로 이 계정에 연결됩니다. 로그인 전까지 "초대됨" 상태로 표시됩니다.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={!form.name || !form.email || loading} onClick={handleSubmit}>
              {loading ? "추가 중..." : "사용자 추가"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
