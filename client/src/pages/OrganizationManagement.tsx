import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getRoleLabel, getUserStatusLabel } from "@/lib/userRole";
import { ChevronDown, GitBranch, Network, RefreshCw, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
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

function relationBadge(node: OrgNode, parent?: OrgNode | null) {
  if (node.role === "branch_admin") return null;
  if (node.accountStatus !== "active") {
    return { label: "비활성 조직원", className: "border-slate-200 bg-slate-100 text-slate-500" };
  }
  if (!parent) {
    return { label: "미배정", className: "border-orange-200 bg-orange-50 text-orange-700" };
  }
  if (parent.role === "branch_admin" && node.role === "team_leader") {
    return { label: "직할 팀장", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (parent.role === "branch_admin" && node.role === "member") {
    return { label: "직할 팀원", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (parent.role === "sub_branch_admin" && node.role === "team_leader") {
    return { label: "산하 팀장", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (parent.role === "sub_branch_admin" && node.role === "member") {
    return { label: "직할 팀원", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (parent.role === "team_leader" && node.role === "member") {
    return { label: "팀 소속", className: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  }
  return null;
}

function userLabel(node?: Pick<OrgNode, "id" | "name" | "role"> | null) {
  if (!node) return "미배정";
  return `${node.name ?? `사용자 #${node.id}`}(${getRoleLabel(node.role)})`;
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

function OrgSection({
  title,
  description,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-2xl border border-slate-200 bg-slate-50/60">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-950">{title}</p>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">{count.toLocaleString()}명</Badge>
          </div>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 px-3 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
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

  const { roots, childrenByParent, nodeById, branchRoot, branchDirectNodes, subBranchNodes, unassignedNodes } = useMemo(() => {
    const byParent = new Map<number | null, OrgNode[]>();
    const byId = new Map<number, OrgNode>();
    for (const node of nodes ?? []) {
      byId.set(node.id, node);
      const key = node.parentUserId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), node]);
    }
    const rootItems = (nodes ?? []).filter((node) => node.role === "branch_admin" || node.parentUserId === null);
    const branch = (nodes ?? []).find((node) => node.role === "branch_admin") ?? null;
    const branchChildren = branch ? (byParent.get(branch.id) ?? []).filter((node) => node.role !== "sub_branch_admin") : [];
    const subBranches = (nodes ?? []).filter((node) => node.role === "sub_branch_admin");
    const unassigned = (nodes ?? []).filter((node) => node.role !== "branch_admin" && node.role !== "sub_branch_admin" && node.accountStatus === "active" && node.parentUserId === null);
    return {
      roots: rootItems,
      childrenByParent: byParent,
      nodeById: byId,
      branchRoot: branch,
      branchDirectNodes: branchChildren,
      subBranchNodes: subBranches,
      unassignedNodes: unassigned,
    };
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

  const applyParentChange = (parentUserId = newParentId === "none" ? null : Number(newParentId)) => {
    if (!selectedUser) return;
    updateParentMutation.mutate({
      userId: selectedUser.id,
      parentUserId,
    });
  };

  const renderNode = (node: OrgNode, depth = 0, showChildren = true) => {
    const children = childrenByParent.get(node.id) ?? [];
    const parent = node.parentUserId ? nodeById.get(node.parentUserId) : null;
    const relation = relationBadge(node, parent);
    const muted = node.accountStatus !== "active";

    return (
      <div key={node.id} className={depth > 0 ? "ml-3 border-l border-slate-200 pl-3" : ""}>
        <Card className={`mb-3 rounded-2xl border shadow-sm ${node.role === "branch_admin" ? "border-slate-800 bg-slate-950 text-white" : muted ? "border-slate-200 bg-slate-50 opacity-80" : "border-slate-200 bg-white"}`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={roleBadgeClass(node.role)}>{getRoleLabel(node.role)}</Badge>
                  <Badge variant="outline" className={statusBadgeClass(node.accountStatus)}>{getUserStatusLabel(node.accountStatus)}</Badge>
                  {relation ? <Badge variant="outline" className={relation.className}>{relation.label}</Badge> : null}
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
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {node.parentUserId !== null ? (
                  <Button type="button" variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => { setSelectedUser(node); setNewParentId("none"); }}>
                    산하 해제
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(node)}>
                  상위자 변경
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
        {showChildren && children.length > 0 ? (
          <div className="space-y-1">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderTreeContent = () => {
    if (treeQuery.isLoading) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          조직 구조를 불러오는 중입니다.
        </div>
      );
    }
    if (!nodes || roots.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          표시할 조직 구조가 없습니다.
        </div>
      );
    }
    if (isBranchAdmin && branchRoot) {
      return (
        <div className="space-y-3">
          {renderNode(branchRoot, 0, false)}
          <OrgSection title="지점장 직할" description="지점장 바로 아래에 배치된 팀장과 팀원입니다." count={branchDirectNodes.length}>
            {branchDirectNodes.length > 0 ? branchDirectNodes.map((node) => renderNode(node)) : <p className="p-3 text-sm text-slate-500">직할 조직원이 없습니다.</p>}
          </OrgSection>
          <OrgSection title="부지점장 조직" description="부지점장별 산하 팀장과 직할 팀원을 확인합니다." count={subBranchNodes.length}>
            {subBranchNodes.length > 0 ? subBranchNodes.map((node) => renderNode(node)) : <p className="p-3 text-sm text-slate-500">부지점장 조직이 없습니다.</p>}
          </OrgSection>
          <OrgSection title="미배정 사용자" description="상위자가 없고 fallback 소속도 없는 활성 사용자입니다." count={unassignedNodes.length} defaultOpen={unassignedNodes.length > 0}>
            {unassignedNodes.length > 0 ? unassignedNodes.map((node) => renderNode(node)) : <p className="p-3 text-sm text-slate-500">미배정 사용자가 없습니다.</p>}
          </OrgSection>
        </div>
      );
    }
    return <div className="space-y-2">{roots.map((node) => renderNode(node))}</div>;
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
      <div className="space-y-6 pb-24 md:pb-8">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-200">
                <Network className="h-5 w-5" />
                <span className="text-sm font-semibold">조직 구조 관리</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold">산하 구조와 고객 배분 가능 범위를 관리합니다</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                지점장 직할, 부지점장 산하, 팀장 산하 구조를 확인합니다. 조직 변경은 기존 고객 담당자를 바꾸지 않고 조회 범위와 DB 배분 범위에만 영향을 줍니다.
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
            <CardContent>{renderTreeContent()}</CardContent>
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
              <p>산하 조회 범위와 DB 배분 가능 범위만 조직 트리 기준으로 다시 계산합니다.</p>
              <p>비활성/퇴사자 사용자는 신규 조직 배정 대상에서 제외됩니다.</p>
              <p>순환 구조와 자기 자신을 상위자로 지정하는 변경은 서버에서 차단합니다.</p>
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
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {selectedUser.parentUserId !== null ? (
                  <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => applyParentChange(null)} disabled={updateParentMutation.isPending}>
                    산하 해제
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>취소</Button>
                <Button type="button" onClick={() => applyParentChange()} disabled={updateParentMutation.isPending}>
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
