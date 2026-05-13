import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Building2, GitBranch, Network, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type OrgNode = {
  id: number;
  name: string | null;
  role: string;
  accountStatus: string;
  parentUserId: number | null;
  explicitParentUserId: number | null;
  directReportCount: number;
  descendantCount: number;
  customerCount: number;
};

const roleLabels: Record<string, string> = {
  branch_admin: "지점장",
  sub_branch_admin: "부지점장",
  team_leader: "팀장",
  member: "팀원",
};

const statusLabels: Record<string, string> = {
  active: "재직",
  inactive: "비활성",
  resigned: "퇴사",
};

function roleBadgeClass(role: string) {
  if (role === "branch_admin") return "border-slate-700 bg-slate-900 text-amber-200";
  if (role === "sub_branch_admin") return "border-blue-200 bg-blue-50 text-blue-700";
  if (role === "team_leader") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function statusBadgeClass(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "inactive") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-red-200 bg-red-50 text-red-700";
}

function userLabel(node?: Pick<OrgNode, "id" | "name" | "role" | "accountStatus"> | null) {
  if (!node) return "미배정";
  return `${node.name ?? `사용자 #${node.id}`}(${roleLabels[node.role] ?? node.role})`;
}

function canBeParentFor(targetRole: string, parentRole: string) {
  if (targetRole === "sub_branch_admin") return parentRole === "branch_admin";
  if (targetRole === "team_leader") return parentRole === "branch_admin" || parentRole === "sub_branch_admin";
  if (targetRole === "member") return parentRole === "branch_admin" || parentRole === "sub_branch_admin" || parentRole === "team_leader";
  return false;
}

function descendantIds(nodeId: number, childrenByParent: Map<number | null, OrgNode[]>) {
  const result = new Set<number>();
  const walk = (parentId: number) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (result.has(child.id)) continue;
      result.add(child.id);
      walk(child.id);
    }
  };
  walk(nodeId);
  return result;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

export default function OrganizationManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedUser, setSelectedUser] = useState<OrgNode | null>(null);
  const [newParentId, setNewParentId] = useState<string>("none");
  const isBranchAdmin = user?.role === "branch_admin";

  const treeQuery = trpc.users.organizationTree.useQuery(undefined, {
    enabled: user?.role !== "member",
  });

  const updateParentMutation = trpc.users.updateParent.useMutation({
    onSuccess: () => {
      toast.success("조직 상위자가 변경되었습니다.");
      utils.users.organizationTree.invalidate();
      utils.users.list.invalidate();
      setSelectedUser(null);
      setNewParentId("none");
    },
    onError: (err) => toast.error(err.message || "조직 상위자 변경에 실패했습니다."),
  });

  const nodes = (treeQuery.data as any)?.nodes as OrgNode[] | undefined;
  const summary = (treeQuery.data as any)?.summary ?? {};

  const { roots, childrenByParent, nodeById } = useMemo(() => {
    const byParent = new Map<number | null, OrgNode[]>();
    const byId = new Map<number, OrgNode>();
    for (const node of nodes ?? []) {
      byId.set(node.id, node);
      const key = node.parentUserId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), node]);
    }
    const rootItems = (nodes ?? []).filter((node) => node.role === "branch_admin" || node.parentUserId === null);
    return { roots: rootItems, childrenByParent: byParent, nodeById: byId };
  }, [nodes]);

  const parentCandidates = useMemo(() => {
    if (!selectedUser || !nodes) return [];
    const descendants = descendantIds(selectedUser.id, childrenByParent);
    return nodes.filter((node) => (
      node.id !== selectedUser.id &&
      node.accountStatus === "active" &&
      !descendants.has(node.id) &&
      canBeParentFor(selectedUser.role, node.role)
    ));
  }, [childrenByParent, nodes, selectedUser]);

  const openEdit = (node: OrgNode) => {
    setSelectedUser(node);
    setNewParentId(node.parentUserId ? String(node.parentUserId) : "none");
  };

  const applyParentChange = () => {
    if (!selectedUser) return;
    updateParentMutation.mutate({
      userId: selectedUser.id,
      parentUserId: newParentId === "none" ? null : Number(newParentId),
    });
  };

  const renderNode = (node: OrgNode, depth = 0) => {
    const children = childrenByParent.get(node.id) ?? [];
    const parent = node.parentUserId ? nodeById.get(node.parentUserId) : null;
    const isDirect = node.parentUserId === null && node.role !== "branch_admin";
    const isUnassigned = node.parentUserId === null && node.role !== "branch_admin";

    return (
      <div key={node.id} className={depth > 0 ? "ml-3 border-l border-slate-200 pl-3" : ""}>
        <Card className={`mb-3 rounded-2xl border shadow-sm ${node.role === "branch_admin" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={roleBadgeClass(node.role)}>{roleLabels[node.role] ?? node.role}</Badge>
                  <Badge variant="outline" className={statusBadgeClass(node.accountStatus)}>{statusLabels[node.accountStatus] ?? node.accountStatus}</Badge>
                  {isDirect ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">직할</Badge> : null}
                  {isUnassigned ? <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">미배정</Badge> : null}
                </div>
                <h3 className={`mt-2 text-lg font-bold ${node.role === "branch_admin" ? "text-white" : "text-slate-950"}`}>
                  {node.name ?? `사용자 #${node.id}`}
                </h3>
                <p className={`mt-1 text-sm ${node.role === "branch_admin" ? "text-slate-300" : "text-slate-500"}`}>
                  상위: {parent ? userLabel(parent) : node.role === "branch_admin" ? "없음" : "미배정"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-64">
                <div className="rounded-xl bg-slate-50 p-2 text-slate-800">
                  <p className="text-[11px] text-slate-500">직속</p>
                  <p className="text-base font-bold">{node.directReportCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2 text-slate-800">
                  <p className="text-[11px] text-slate-500">산하</p>
                  <p className="text-base font-bold">{node.descendantCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2 text-slate-800">
                  <p className="text-[11px] text-slate-500">고객</p>
                  <p className="text-base font-bold">{node.customerCount}</p>
                </div>
              </div>
            </div>
            {isBranchAdmin && node.role !== "branch_admin" ? (
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(node)}>
                  상위자 변경
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
        {children.length > 0 ? (
          <div className="space-y-1">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (user?.role === "member") {
    return (
      <DashboardLayout>
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-slate-600">조직 구조 관리는 관리자와 리더 권한에서 확인할 수 있습니다.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-200">
                <Network className="h-5 w-5" />
                <span className="text-sm font-semibold">조직 구조 관리</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold">산하 구조와 고객 배분 가능 범위를 관리합니다</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                지점장 직할, 부지점장 산하, 팀장 산하 구조를 한 화면에서 확인합니다. 조직 변경은 기존 고객 담당자를 바꾸지 않고 조회 범위와 DB 배분 범위에만 영향을 줍니다.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => treeQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              새로고침
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard label="부지점장" value={summary.subBranchAdminCount ?? 0} />
          <SummaryCard label="직할 팀장" value={summary.directTeamLeaderCount ?? 0} />
          <SummaryCard label="전체 팀장" value={summary.totalTeamLeaderCount ?? 0} />
          <SummaryCard label="전체 팀원" value={summary.totalMemberCount ?? 0} />
          <SummaryCard label="직할 팀원" value={summary.directMemberCount ?? 0} />
          <SummaryCard label="미배정" value={summary.unassignedCount ?? 0} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-950">
                <GitBranch className="h-5 w-5 text-amber-600" />
                조직 트리
              </CardTitle>
            </CardHeader>
            <CardContent>
              {treeQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  조직 구조를 불러오는 중입니다.
                </div>
              ) : roots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  표시할 조직 구조가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">{roots.map((node) => renderNode(node))}</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-amber-100 bg-amber-50/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-950">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                변경 영향 안내
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>상위자 변경은 고객 담당자를 자동 변경하지 않습니다.</p>
              <p>산하 조회 범위와 DB 배분 가능 범위만 조직 트리 기준으로 다시 계산됩니다.</p>
              <p>inactive/resigned 사용자는 신규 조직 배정 대상에서 제외됩니다.</p>
              <p>순환 구조와 자기 자신을 상위자로 지정하는 변경은 서버에서 차단됩니다.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>상위자 변경</DialogTitle>
          </DialogHeader>
          {selectedUser ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">대상 사용자</p>
                <p className="mt-1 font-bold text-slate-950">{userLabel(selectedUser)}</p>
                <p className="mt-1 text-sm text-slate-500">현재 상위: {selectedUser.parentUserId ? userLabel(nodeById.get(selectedUser.parentUserId)) : "미배정"}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">변경할 상위자</label>
                <Select value={newParentId} onValueChange={setNewParentId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="상위자를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    {parentCandidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={String(candidate.id)}>
                        {userLabel(candidate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                이 변경은 고객 조회 범위와 DB 배분 가능 범위에 영향을 줄 수 있습니다. 기존 고객 담당자와 상담/계약 이력은 변경되지 않습니다.
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>취소</Button>
                <Button type="button" onClick={applyParentChange} disabled={updateParentMutation.isPending}>
                  변경 확정
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
