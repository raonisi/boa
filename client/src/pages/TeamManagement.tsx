import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function TeamManagement() {
  const utils = trpc.useUtils();
  const { data: teams } = trpc.users.teams.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const [showCreateTeam, setShowCreateTeam] = useState(false);
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

  const updateTeamMutation = trpc.users.updateTeam.useMutation({
    onSuccess: () => { toast.success("팀이 변경되었습니다."); utils.users.list.invalidate(); },
    onError: () => toast.error("변경에 실패했습니다."),
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success("권한이 변경되었습니다."); utils.users.list.invalidate(); },
  });

  const managers = (users ?? []).filter((u) => u.role === "manager" || u.role === "admin");
  const activeUsers = (users ?? []).filter((u) => u.role !== "inactive");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">팀 관리</h1>
            <p className="text-sm text-muted-foreground mt-0.5">팀 생성, 팀장 지정, 팀원 배치를 관리합니다.</p>
          </div>
          <Button size="sm" onClick={() => setShowCreateTeam(true)}>
            <Plus className="h-4 w-4 mr-1" /> 팀 생성
          </Button>
        </div>

        {/* 팀 목록 */}
        {(teams ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">등록된 팀이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(teams ?? []).map((team) => {
              const teamMembers = (users ?? []).filter((u) => u.teamId === team.id);
              const teamManager = (users ?? []).find((u) => u.id === team.managerId);
              return (
                <Card key={team.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {team.name}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        팀장: {teamManager?.name ?? "미지정"} · 팀원 {teamMembers.length}명
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이름</TableHead>
                          <TableHead>이메일</TableHead>
                          <TableHead>역할</TableHead>
                          <TableHead>팀 변경</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">
                              팀원이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamMembers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.name ?? "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{u.email ?? "-"}</TableCell>
                              <TableCell>
                                <Select
                                  value={u.role}
                                  onValueChange={(v) => updateRoleMutation.mutate({ userId: u.id, role: v as any })}
                                >
                                  <SelectTrigger className="h-7 text-xs w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">관리자</SelectItem>
                                    <SelectItem value="manager">팀장</SelectItem>
                                    <SelectItem value="agent">팀원</SelectItem>
                                    <SelectItem value="inactive">퇴사자</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={String(u.teamId ?? "none")}
                                  onValueChange={(v) => updateTeamMutation.mutate({ userId: u.id, teamId: v === "none" ? null : Number(v) })}
                                >
                                  <SelectTrigger className="h-7 text-xs w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">팀 없음</SelectItem>
                                    {(teams ?? []).map((t) => (
                                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 미배정 팀원 */}
        {(() => {
          const unassigned = (users ?? []).filter((u) => !u.teamId && u.role !== "inactive");
          if (unassigned.length === 0) return null;
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">팀 미배정 사용자 ({unassigned.length}명)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>팀 배정</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassigned.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.role === "manager" ? "팀장" : u.role === "admin" ? "관리자" : "팀원"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value="none"
                            onValueChange={(v) => updateTeamMutation.mutate({ userId: u.id, teamId: v === "none" ? null : Number(v) })}
                          >
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue placeholder="팀 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">팀 없음</SelectItem>
                              {(teams ?? []).map((t) => (
                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* 팀 생성 모달 */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>팀 생성</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">팀 이름 *</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="h-9 mt-1" placeholder="예: 1팀, 영업팀" />
            </div>
            <div>
              <Label className="text-xs">팀장 지정</Label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="팀장 선택 (선택)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미지정</SelectItem>
                  {managers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateTeam(false)}>취소</Button>
              <Button
                size="sm"
                disabled={!teamName || createTeamMutation.isPending}
                onClick={() => createTeamMutation.mutate({
                  name: teamName,
                  managerId: selectedManager !== "none" ? Number(selectedManager) : undefined,
                })}
              >
                {createTeamMutation.isPending ? "생성 중..." : "생성"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
