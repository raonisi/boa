import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { getRoleLabel, getUserStatusLabel } from "@/lib/userRole";
import { Building2, Edit2, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toastUserFacingError, USER_FACING_ERRORS } from "@/lib/userFacingMessages";
import {
  getTeamMemberRoleBadgeClasses,
  getTeamUnassignedRoleBadgeClasses,
} from "@/lib/orgGoalPresentation";
import { toast } from "sonner";

export default function TeamManagement() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">팀 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            조직 구조, 팀 생성, 팀원 배치를 관리합니다.
          </p>
        </div>
        <Tabs defaultValue="hierarchy">
          <TabsList>
            <TabsTrigger value="hierarchy">
              <Building2 className="h-4 w-4 mr-1.5" /> 조직 계층 구조
            </TabsTrigger>
            <TabsTrigger value="teams">
              <Users className="h-4 w-4 mr-1.5" /> 팀 관리
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hierarchy" className="mt-4">
            <OrgHierarchyView />
          </TabsContent>
          <TabsContent value="teams" className="mt-4">
            <TeamListView />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── 조직 계층 구조 뷰 ────────────────────────────────────────────────────────
function OrgHierarchyView() {
  const utils = trpc.useUtils();
  const { data: users } = trpc.users.list.useQuery();
  const { data: teams } = trpc.users.teams.useQuery();

  const subBranchAdmins = (users ?? []).filter(
    u => u.role === "sub_branch_admin" && (u as any).accountStatus === "active"
  );
  const activeUsers = (users ?? []).filter(
    u => (u as any).accountStatus === "active"
  );

  // 미배정 사용자 (subBranchAdminId 없음, branch_admin 제외)
  const unassignedUsers = activeUsers.filter(
    u =>
      u.role !== "branch_admin" &&
      u.role !== "sub_branch_admin" &&
      !(u as any).subBranchAdminId
  );

  const updateSubBranchMutation = trpc.users.updateSubBranchAdmin.useMutation({
    onSuccess: () => {
      toast.success("부지점장 산하가 변경되었습니다.");
      utils.users.list.invalidate();
    },
    onError: () => toast.error("변경에 실패했습니다."),
  });

  const updateTeamMutation = trpc.users.updateTeam.useMutation({
    onSuccess: () => {
      toast.success("팀이 변경되었습니다.");
      utils.users.list.invalidate();
    },
    onError: () => toast.error("변경에 실패했습니다."),
  });

  const updateTeamInfoMutation = trpc.users.updateTeamInfo.useMutation({
    onSuccess: () => {
      toast.success("팀 정보가 변경되었습니다.");
      utils.users.teams.invalidate();
      utils.users.list.invalidate();
    },
    onError: () => toast.error("변경에 실패했습니다."),
  });

  const handleSubBranchChange = (
    userId: number,
    currentTeamId: number | null,
    newSubBranchAdminId: string
  ) => {
    const newId =
      newSubBranchAdminId === "none" ? null : Number(newSubBranchAdminId);
    // 조건 2: teamId가 있으면 해당 팀의 subBranchAdminId와 일치해야 함
    if (currentTeamId && newId !== null) {
      const team = (teams ?? []).find(t => t.id === currentTeamId);
      if (team && (team as any).subBranchAdminId !== newId) {
        // 팀 소속이 있는 경우 팀도 함께 변경 필요 → 팀 해제 후 미배정 처리
        if (
          !confirm(
            `이 사용자는 현재 팀(${team.name})에 소속되어 있습니다.\n부지점장 산하를 변경하려면 팀 소속이 해제됩니다.\n계속하시겠습니까?`
          )
        )
          return;
        updateTeamMutation.mutate({ userId, teamId: null });
      }
    }
    updateSubBranchMutation.mutate({ userId, subBranchAdminId: newId });
  };

  return (
    <div className="space-y-4">
      {/* 부지점장별 계층 */}
      {subBranchAdmins.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>등록된 부지점장이 없습니다.</p>
            <p className="text-xs mt-1">
              사용자 관리에서 역할을 부지점장으로 변경해주세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        subBranchAdmins.map(sba => {
          const sbaTeams = (teams ?? []).filter(
            t => (t as any).subBranchAdminId === sba.id
          );
          const sbaUsers = activeUsers.filter(
            u =>
              (u as any).subBranchAdminId === sba.id &&
              u.role !== "sub_branch_admin"
          );
          const unassignedInSba = sbaUsers.filter(u => !u.teamId);

          return (
            <Card key={sba.id} className="border-blue-200">
              <CardHeader className="pb-2 bg-blue-50/50 rounded-t-lg">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-blue-700">{sba.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    (부지점장) · 팀 {sbaTeams.length}개 · 팀원 {sbaUsers.length}
                    명
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {/* 팀별 계층 */}
                {sbaTeams.map(team => {
                  const teamManager = activeUsers.find(
                    u => u.id === team.managerId
                  );
                  const teamMembers = activeUsers.filter(
                    u => u.teamId === team.id
                  );
                  return (
                    <div
                      key={team.id}
                      className="border rounded-lg p-3 bg-white"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="text-sm font-semibold text-indigo-700">
                          {team.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          팀장: {teamManager?.name ?? "미지정"} ·{" "}
                          {teamMembers.length}명
                        </span>
                        {/* 팀 부지점장 변경 */}
                        <div className="ml-auto">
                          <Select
                            value={String(
                              (team as any).subBranchAdminId ?? "none"
                            )}
                            onValueChange={v =>
                              updateTeamInfoMutation.mutate({
                                id: team.id,
                                subBranchAdminId:
                                  v === "none" ? null : Number(v),
                              })
                            }
                          >
                            <SelectTrigger className="h-6 text-xs w-28">
                              <SelectValue placeholder="부지점장" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">미배정</SelectItem>
                              {subBranchAdmins.map(s => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {teamMembers.length === 0 ? (
                        <p className="text-xs text-muted-foreground pl-5">
                          팀원이 없습니다.
                        </p>
                      ) : (
                        <div className="space-y-1 pl-5">
                          {teamMembers.map(u => (
                            <div
                              key={u.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className={getTeamMemberRoleBadgeClasses(u.role)}>
                                {getRoleLabel(u.role)}
                              </span>
                              <span className="font-medium">{u.name}</span>
                              {/* 팀원 부지점장 변경 */}
                              <div className="ml-auto">
                                <Select
                                  value={String(
                                    (u as any).subBranchAdminId ?? "none"
                                  )}
                                  onValueChange={v =>
                                    handleSubBranchChange(u.id, u.teamId, v)
                                  }
                                >
                                  <SelectTrigger className="h-7 min-h-7 w-24 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">미배정</SelectItem>
                                    {subBranchAdmins.map(s => (
                                      <SelectItem
                                        key={s.id}
                                        value={String(s.id)}
                                      >
                                        {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 팀 미배정 팀원 (부지점장 산하지만 팀 없음) */}
                {unassignedInSba.length > 0 && (
                  <div className="border border-dashed rounded-lg p-3 bg-orange-50/50">
                    <p className="text-xs text-orange-600 font-medium mb-2">
                      팀 미배정 ({unassignedInSba.length}명)
                    </p>
                    <div className="space-y-1 pl-2">
                      {unassignedInSba.map(u => (
                        <div
                          key={u.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className={getTeamUnassignedRoleBadgeClasses()}>
                            {getRoleLabel(u.role)}
                          </span>
                          <span className="font-medium">{u.name}</span>
                          <Select
                            value={String(u.teamId ?? "none")}
                            onValueChange={v =>
                              updateTeamMutation.mutate({
                                userId: u.id,
                                teamId: v === "none" ? null : Number(v),
                              })
                            }
                          >
                            <SelectTrigger className="ml-auto h-7 min-h-7 w-24 text-xs">
                              <SelectValue placeholder="팀 배정" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">팀 없음</SelectItem>
                              {sbaTeams.map(t => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* 미배정 섹션 */}
      {unassignedUsers.length > 0 && (
        <Card className="border-gray-300">
          <CardHeader className="pb-2 bg-gray-50 rounded-t-lg">
            <CardTitle className="text-sm text-gray-600">
              부지점장 미배정 ({unassignedUsers.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="space-y-2">
              {unassignedUsers.map(u => (
                <div key={u.id} className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                    {getRoleLabel(u.role)}
                  </span>
                  <span className="font-medium">{u.name}</span>
                  <div className="ml-auto flex gap-2">
                    {/* 부지점장 배치 */}
                    <Select
                      value="none"
                      onValueChange={v => {
                        if (v !== "none")
                          updateSubBranchMutation.mutate({
                            userId: u.id,
                            subBranchAdminId: Number(v),
                          });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue placeholder="부지점장 배치" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">부지점장 선택</SelectItem>
                        {subBranchAdmins.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── 팀 관리 뷰 (기존 기능 유지) ─────────────────────────────────────────────
function TeamListView() {
  const utils = trpc.useUtils();
  const { data: teams } = trpc.users.teams.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [editTeam, setEditTeam] = useState<any>(null);
  const [teamName, setTeamName] = useState("");
  const [selectedManager, setSelectedManager] = useState<string>("none");

  const createTeamMutation = trpc.users.createTeam.useMutation({
    onSuccess: () => {
      toast.success("팀이 생성되었습니다.");
      setShowCreateTeam(false);
      setTeamName("");
      setSelectedManager("none");
      utils.users.teams.invalidate();
    },
    onError: () => toast.error("팀 생성에 실패했습니다."),
  });

  const updateTeamMutation = trpc.users.updateTeamInfo.useMutation({
    onSuccess: () => {
      toast.success("팀 정보가 변경되었습니다.");
      setEditTeam(null);
      utils.users.teams.invalidate();
      utils.users.list.invalidate();
    },
    onError: () => toast.error("변경에 실패했습니다."),
  });

  const deactivateTeamMutation = trpc.users.deactivateTeam.useMutation({
    onSuccess: () => {
      toast.success("팀이 삭제(비활성 처리)되었습니다.");
      utils.users.teams.invalidate();
      utils.users.list.invalidate();
    },
    onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed, "admin"),
  });

  const updateUserTeamMutation = trpc.users.updateTeam.useMutation({
    onSuccess: () => {
      toast.success("팀이 변경되었습니다.");
      utils.users.list.invalidate();
    },
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("권한이 변경되었습니다.");
      utils.users.list.invalidate();
    },
  });

  const activeUsers = (users ?? []).filter(
    u => (u as any).accountStatus === "active"
  );
  const subBranchAdmins = activeUsers.filter(
    u => u.role === "sub_branch_admin"
  );
  const managers = activeUsers.filter(
    u => u.role === "team_leader" || u.role === "branch_admin"
  );

  const handleDeactivateTeam = (team: any) => {
    if (
      confirm(
        "이 팀을 삭제하시겠습니까?\n소속 팀원 또는 고객이 남아 있으면 삭제할 수 없습니다.\n삭제된 팀은 기본 목록에서 숨김 처리되며, 활동 로그에 기록됩니다."
      )
    ) {
      deactivateTeamMutation.mutate({ id: team.id });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreateTeam(true)}>
          <Plus className="h-4 w-4 mr-1" /> 팀 생성
        </Button>
      </div>

      {(teams ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">등록된 팀이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(teams ?? []).map(team => {
            const teamMembers = activeUsers.filter(u => u.teamId === team.id);
            const teamManager = activeUsers.find(u => u.id === team.managerId);
            const sba = activeUsers.find(
              u => u.id === (team as any).subBranchAdminId
            );
            return (
              <Card key={team.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {team.name}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      팀장: {teamManager?.name ?? "미지정"} · 부지점장:{" "}
                      {sba?.name ?? "미배정"} · 팀원 {teamMembers.length}명
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-auto"
                      onClick={() => setEditTeam(team)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeactivateTeam(team)}
                      title="팀 삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left p-3">이름</th>
                        <th className="text-left p-3">역할</th>
                        <th className="text-left p-3">계정 상태</th>
                        <th className="text-left p-3">팀 변경</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {teamMembers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-center text-muted-foreground py-4 text-sm"
                          >
                            팀원이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        teamMembers.map(u => (
                          <tr key={u.id}>
                            <td className="p-3 font-medium">{u.name ?? "-"}</td>
                            <td className="p-3">
                              <Select
                                value={u.role}
                                onValueChange={v =>
                                  updateRoleMutation.mutate({
                                    userId: u.id,
                                    role: v as any,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="branch_admin">
                                    지점장
                                  </SelectItem>
                                  <SelectItem value="sub_branch_admin">
                                    부지점장
                                  </SelectItem>
                                  <SelectItem value="team_leader">
                                    팀장
                                  </SelectItem>
                                  <SelectItem value="member">팀원</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${(u as any).accountStatus === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                              >
                                {getUserStatusLabel((u as any).accountStatus)}
                              </span>
                            </td>
                            <td className="p-3">
                              <Select
                                value={String(u.teamId ?? "none")}
                                onValueChange={v =>
                                  updateUserTeamMutation.mutate({
                                    userId: u.id,
                                    teamId: v === "none" ? null : Number(v),
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">팀 없음</SelectItem>
                                  {(teams ?? []).map(t => (
                                    <SelectItem key={t.id} value={String(t.id)}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 미배정 팀원 */}
      {(() => {
        const unassigned = activeUsers.filter(
          u =>
            !u.teamId &&
            u.role !== "branch_admin" &&
            u.role !== "sub_branch_admin"
        );
        if (unassigned.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                팀 미배정 사용자 ({unassigned.length}명)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-3">이름</th>
                    <th className="text-left p-3">역할</th>
                    <th className="text-left p-3">팀 배정</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unassigned.map(u => (
                    <tr key={u.id}>
                      <td className="p-3 font-medium">{u.name ?? "-"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {getRoleLabel(u.role)}
                      </td>
                      <td className="p-3">
                        <Select
                          value="none"
                          onValueChange={v =>
                            updateUserTeamMutation.mutate({
                              userId: u.id,
                              teamId: v === "none" ? null : Number(v),
                            })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue placeholder="팀 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">팀 없음</SelectItem>
                            {(teams ?? []).map(t => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })()}

      {/* 팀 생성 모달 */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>팀 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">팀 이름 *</Label>
              <Input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                className="h-9 mt-1"
                placeholder="예: 1팀, 영업팀"
              />
            </div>
            <div>
              <Label className="text-xs">팀장 지정</Label>
              <Select
                value={selectedManager}
                onValueChange={setSelectedManager}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="팀장 선택 (선택)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미지정</SelectItem>
                  {managers.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateTeam(false)}
              >
                취소
              </Button>
              <Button
                size="sm"
                disabled={!teamName || createTeamMutation.isPending}
                onClick={() =>
                  createTeamMutation.mutate({
                    name: teamName,
                    managerId:
                      selectedManager !== "none"
                        ? Number(selectedManager)
                        : undefined,
                  })
                }
              >
                {createTeamMutation.isPending ? "생성 중..." : "생성"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 팀 수정 모달 */}
      {editTeam && (
        <EditTeamModal
          team={editTeam}
          users={activeUsers}
          subBranchAdmins={subBranchAdmins}
          teams={teams ?? []}
          onClose={() => setEditTeam(null)}
          onSubmit={data =>
            updateTeamMutation.mutate({ id: editTeam.id, ...data })
          }
          loading={updateTeamMutation.isPending}
        />
      )}
    </div>
  );
}

function EditTeamModal({
  team,
  users,
  subBranchAdmins,
  teams,
  onClose,
  onSubmit,
  loading,
}: {
  team: any;
  users: any[];
  subBranchAdmins: any[];
  teams: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: team.name ?? "",
    description: team.description ?? "",
    managerId: String(team.managerId ?? "none"),
    subBranchAdminId: String((team as any).subBranchAdminId ?? "none"),
    isActive: team.isActive !== false,
  });

  const managers = users.filter(
    u => u.role === "team_leader" || u.role === "branch_admin"
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>팀 수정 - {team.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">팀 이름</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="h-9 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">팀 설명</Label>
            <Input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="h-9 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">팀장 변경</Label>
            <Select
              value={form.managerId}
              onValueChange={v => setForm({ ...form, managerId: v })}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미지정</SelectItem>
                {managers.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">소속 부지점장</Label>
            <Select
              value={form.subBranchAdminId}
              onValueChange={v => setForm({ ...form, subBranchAdminId: v })}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미배정</SelectItem>
                {subBranchAdmins.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
            />
            <label htmlFor="isActive" className="text-sm cursor-pointer">
              팀 활성화
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              size="sm"
              disabled={loading}
              onClick={() =>
                onSubmit({
                  name: form.name,
                  description: form.description || undefined,
                  managerId:
                    form.managerId !== "none" ? Number(form.managerId) : null,
                  subBranchAdminId:
                    form.subBranchAdminId !== "none"
                      ? Number(form.subBranchAdminId)
                      : null,
                  isActive: form.isActive,
                })
              }
            >
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
