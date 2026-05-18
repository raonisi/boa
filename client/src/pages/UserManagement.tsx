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
import { getRoleLabel, getUserStatusLabel } from "@/lib/userRole";
import { CUSTOMER_BULK_IMPORT_PERMISSION } from "@shared/permissions";
import { KeyRound, LogOut, Plus, ShieldCheck, ShieldX, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const roleBadgeColors: Record<string, string> = {
  branch_admin: "bg-primary/10 text-primary ring-1 ring-primary/15",
  sub_branch_admin: "bg-primary/10 text-primary ring-1 ring-primary/15",
  team_leader: "bg-primary/10 text-primary ring-1 ring-primary/15",
  member: "bg-boa-green/12 text-boa-green ring-1 ring-boa-green/20",
};

const statusBadgeColors: Record<string, string> = {
  active: "bg-boa-green/12 text-boa-green ring-1 ring-boa-green/20",
  inactive: "bg-muted text-muted-foreground ring-1 ring-border/70",
  resigned: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
};

const loginStatusLabels: Record<string, string> = {
  invited: "초대됨",
  linked: "로그인 완료",
};

const loginStatusColors: Record<string, string> = {
  invited: "bg-boa-amber/16 text-amber-800 ring-1 ring-boa-amber/25",
  linked: "bg-boa-green/12 text-boa-green ring-1 ring-boa-green/20",
};

const securityActionLabels: Record<string, string> = {
  USER_LOGIN: "로그인",
  USER_LOGOUT: "로그아웃",
  USER_FORCE_LOGOUT: "사용자 강제 로그아웃",
  ALL_USERS_FORCE_LOGOUT: "전체 사용자 강제 로그아웃",
  USER_OAUTH_RESET: "OAuth 연결 초기화",
  LOGIN_BLOCKED: "로그인 차단",
};

export default function UserManagement() {
  const utils = trpc.useUtils();
  const { data: users } = trpc.users.list.useQuery();
  const { data: teams } = trpc.users.teams.useQuery();
  const [editUser, setEditUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [forceLogoutUser, setForceLogoutUser] = useState<any>(null);
  const [oauthResetUser, setOauthResetUser] = useState<any>(null);
  const [forceLogoutReason, setForceLogoutReason] = useState("");
  const [oauthResetReason, setOauthResetReason] = useState("");
  const [oauthResetConfirm, setOauthResetConfirm] = useState("");
  const [allLogoutOpen, setAllLogoutOpen] = useState(false);
  const [allLogoutReason, setAllLogoutReason] = useState("");
  const [allLogoutConfirm, setAllLogoutConfirm] = useState("");
  const { data: loginHistory } = trpc.adminSecurity.loginHistory.useQuery({ limit: 50 });

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

  const updatePermissionMutation = trpc.users.updatePermission.useMutation({
    onSuccess: () => { toast.success("세부 권한이 변경되었습니다."); utils.users.list.invalidate(); },
    onError: (err) => toast.error(err.message || "세부 권한 변경에 실패했습니다."),
  });

  const toggleBulkImportPermission = (targetUser: any) => {
    const enabled = !(targetUser.permissions ?? []).includes(CUSTOMER_BULK_IMPORT_PERMISSION);
    updatePermissionMutation.mutate({
      userId: targetUser.id,
      permission: CUSTOMER_BULK_IMPORT_PERMISSION,
      enabled,
    });
  };

  const forceLogoutMutation = trpc.adminSecurity.forceLogoutUser.useMutation({
    onSuccess: () => {
      toast.success("사용자 세션을 무효화했습니다.");
      utils.adminSecurity.loginHistory.invalidate();
      setForceLogoutUser(null);
      setForceLogoutReason("");
    },
    onError: (err) => toast.error(err.message || "강제 로그아웃에 실패했습니다."),
  });

  const forceLogoutAllMutation = trpc.adminSecurity.forceLogoutAll.useMutation({
    onSuccess: () => {
      toast.success("전체 사용자 세션을 무효화했습니다.");
      utils.adminSecurity.loginHistory.invalidate();
      setAllLogoutOpen(false);
      setAllLogoutReason("");
      setAllLogoutConfirm("");
    },
    onError: (err) => toast.error(err.message || "전체 로그아웃에 실패했습니다."),
  });

  const resetOAuthMutation = trpc.adminSecurity.resetOAuthLink.useMutation({
    onSuccess: () => {
      toast.success("OAuth 연결을 초기화했습니다.");
      utils.users.list.invalidate();
      utils.adminSecurity.loginHistory.invalidate();
      setOauthResetUser(null);
      setOauthResetReason("");
      setOauthResetConfirm("");
    },
    onError: (err) => toast.error(err.message || "OAuth 초기화에 실패했습니다."),
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
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Users & Security</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">사용자 관리</h1>
            <p className="mt-1 text-sm text-slate-500">총 {users?.length ?? 0}명 · 강제 로그아웃/OAuth 초기화는 활동 로그에 기록됩니다.</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> 사용자 추가
          </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>계정 상태</TableHead>
                    <TableHead>로그인 상태</TableHead>
                    <TableHead>일괄등록</TableHead>
                    <TableHead>팀</TableHead>
                    <TableHead>소속 부지점장</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead className="w-16">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">사용자가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    (users ?? []).map((u) => {
                      const team = teams?.find((t) => t.id === u.teamId);
                      const sba = (users ?? []).find((s) => s.id === (u as any).subBranchAdminId);
                      const isInactive = (u as any).accountStatus !== "active";
                      const canAssignSubBranch = u.role === "team_leader" || u.role === "member";
                      const canManageBulkImport = u.role === "sub_branch_admin" || u.role === "team_leader";
                      const hasBulkImportPermission = ((u as any).permissions ?? []).includes(CUSTOMER_BULK_IMPORT_PERMISSION);
                      const loginStatus = (u as any).loginStatus ?? "linked";
                      return (
                        <TableRow key={u.id} className={isInactive ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{u.name ?? "-"}</TableCell>
                          <TableCell className="text-xs">{u.email ?? "-"}</TableCell>
                          <TableCell className="text-xs">{(u as any).phone ?? "-"}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColors[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                              {getRoleLabel(u.role)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColors[(u as any).accountStatus] ?? "bg-gray-100"}`}>
                              {getUserStatusLabel((u as any).accountStatus)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${loginStatusColors[loginStatus] ?? "bg-gray-100"}`}>
                              {loginStatusLabels[loginStatus] ?? loginStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            {u.role === "branch_admin" ? (
                              <Badge variant="secondary" className="text-xs">기본 허용</Badge>
                            ) : canManageBulkImport ? (
                              <Button
                                variant={hasBulkImportPermission ? "secondary" : "outline"}
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={isInactive || updatePermissionMutation.isPending}
                                onClick={() => toggleBulkImportPermission(u)}
                              >
                                {hasBulkImportPermission ? "허용" : "미허용"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">불가</span>
                            )}
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
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ko-KR") : "-"}
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
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setForceLogoutUser(u)} title="강제 로그아웃">
                                <LogOut className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setOauthResetUser(u)} title="OAuth 초기화">
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
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
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> 보안 관리
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAllLogoutOpen(true)}>
                전체 로그아웃
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Google OAuth 연결 초기화, 세션 무효화, 로그인 보안 이력을 관리합니다. 토큰과 비밀값은 표시하지 않습니다.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시각</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>액션</TableHead>
                    <TableHead>처리자</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(loginHistory ?? []).slice(0, 10).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">로그인 보안 이력이 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    (loginHistory ?? []).slice(0, 10).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{entry.user?.name ?? "-"}</div>
                          <div className="text-muted-foreground">{entry.user?.email ?? "-"}</div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{securityActionLabels[entry.action] ?? "보안 작업"}</TableCell>
                        <TableCell className="text-xs">{entry.actor?.name ?? "-"}</TableCell>
                      </TableRow>
                    ))
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
                    <SelectItem value="active">활성</SelectItem>
                    <SelectItem value="inactive">비활성</SelectItem>
                    <SelectItem value="resigned">퇴사자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setEditUser(null)}>닫기</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {forceLogoutUser && (
        <Dialog open={true} onOpenChange={() => setForceLogoutUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>사용자 강제 로그아웃</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {forceLogoutUser.name} 사용자의 현재 세션을 무효화합니다. 사용자는 다시 Google 로그인을 해야 합니다.
              </p>
              <div>
                <Label className="text-xs">사유 *</Label>
                <Textarea value={forceLogoutReason} onChange={(e) => setForceLogoutReason(e.target.value)} rows={3} className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setForceLogoutUser(null)}>취소</Button>
                <Button
                  size="sm"
                  disabled={!forceLogoutReason.trim() || forceLogoutMutation.isPending}
                  onClick={() => forceLogoutMutation.mutate({ userId: forceLogoutUser.id, reason: forceLogoutReason.trim() })}
                >
                  강제 로그아웃
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {allLogoutOpen && (
        <Dialog open={true} onOpenChange={() => setAllLogoutOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>전체 사용자 강제 로그아웃</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                모든 사용자의 세션을 무효화합니다. 현재 접속 중인 사용자도 다시 로그인해야 할 수 있습니다.
              </p>
              <div>
                <Label className="text-xs">사유 *</Label>
                <Textarea value={allLogoutReason} onChange={(e) => setAllLogoutReason(e.target.value)} rows={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">확인 문구: 전체로그아웃</Label>
                <Input value={allLogoutConfirm} onChange={(e) => setAllLogoutConfirm(e.target.value)} className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAllLogoutOpen(false)}>취소</Button>
                <Button
                  size="sm"
                  disabled={!allLogoutReason.trim() || allLogoutConfirm !== "전체로그아웃" || forceLogoutAllMutation.isPending}
                  onClick={() => forceLogoutAllMutation.mutate({ reason: allLogoutReason.trim(), confirmText: allLogoutConfirm })}
                >
                  전체 로그아웃
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {oauthResetUser && (
        <Dialog open={true} onOpenChange={() => setOauthResetUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>OAuth 연결 초기화</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {oauthResetUser.name} 사용자의 Google 계정 연결을 초기화합니다. 권한과 계정 상태는 변경하지 않습니다.
              </p>
              <div>
                <Label className="text-xs">사유 *</Label>
                <Textarea value={oauthResetReason} onChange={(e) => setOauthResetReason(e.target.value)} rows={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">확인 문구: OAuth초기화</Label>
                <Input value={oauthResetConfirm} onChange={(e) => setOauthResetConfirm(e.target.value)} className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setOauthResetUser(null)}>취소</Button>
                <Button
                  size="sm"
                  disabled={!oauthResetReason.trim() || oauthResetConfirm !== "OAuth초기화" || resetOAuthMutation.isPending}
                  onClick={() => resetOAuthMutation.mutate({ userId: oauthResetUser.id, reason: oauthResetReason.trim(), confirmText: oauthResetConfirm })}
                >
                  OAuth 초기화
                </Button>
              </div>
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
            <Label className="text-xs">계정 상태</Label>
            <Select value={form.accountStatus} onValueChange={(v) => setForm({ ...form, accountStatus: v as any })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
              </SelectContent>
            </Select>
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
