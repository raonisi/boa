import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDbAssignmentSuccessMessage,
  WORKFLOW_COPY,
} from "@/lib/assignmentWorkflowCopy";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole } from "@/lib/userRole";
import { Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CustomerRow = {
  id: number;
  name: string;
  phone?: string | null;
  region?: string | null;
  source?: string | null;
  consultStatus?: string | null;
  createdAt: string | Date;
  assignmentStatus?: string | null;
};

type UserRow = {
  id: number;
  name?: string | null;
  role?: string | null;
  accountStatus?: string | null;
  teamId?: number | null;
  subBranchAdminId?: number | null;
};

type AssignmentResultItem = {
  customerId: number;
  customerName: string;
  status: "success" | "failed";
  reason?: string;
};

type AssignmentResult = {
  requestedCount: number;
  successCount: number;
  failedCount: number;
  items: AssignmentResultItem[];
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function filterCustomers(
  customers: CustomerRow[],
  filters: { search: string; status: string; source: string }
) {
  const search = normalizeText(filters.search);
  return customers.filter(customer => {
    const searchTarget =
      `${customer.name ?? ""} ${customer.phone ?? ""} ${customer.region ?? ""} ${customer.source ?? ""}`.toLowerCase();
    const matchesSearch = !search || searchTarget.includes(search);
    const matchesStatus =
      filters.status === "all" ||
      String(customer.consultStatus ?? "") === filters.status;
    const matchesSource =
      filters.source === "all" ||
      String(customer.source ?? "") === filters.source;
    return matchesSearch && matchesStatus && matchesSource;
  });
}

function uniqueValues(
  customers: CustomerRow[],
  key: "consultStatus" | "source"
) {
  return Array.from(
    new Set(
      customers
        .map(customer => String(customer[key] ?? "").trim())
        .filter(Boolean)
    )
  );
}

function assignmentResultFromItems(
  items: AssignmentResultItem[]
): AssignmentResult {
  return {
    requestedCount: items.length,
    successCount: items.filter(item => item.status === "success").length,
    failedCount: items.filter(item => item.status === "failed").length,
    items,
  };
}

export default function CustomerAssign() {
  const { user } = useAuth();
  const isBranchAdmin = user?.role === "branch_admin";
  const isSubBranchAdmin = user?.role === "sub_branch_admin";
  const isTeamLeader = user?.role === "team_leader";

  return (
    <DashboardLayout>
      {isBranchAdmin && <BranchAdminAssign />}
      {isSubBranchAdmin && <SubBranchAdminAssign />}
      {isTeamLeader && <TeamLeaderAssign />}
      {!isBranchAdmin && !isSubBranchAdmin && !isTeamLeader && (
        <Card>
          <CardHeader>
            <CardTitle>DB 배정 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            DB 배정은 지점장, 부지점장, 팀장만 사용할 수 있습니다.
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

function BranchAdminAssign() {
  return (
    <div className="space-y-4">
      <PageHeader
        title={WORKFLOW_COPY.dbAssignment.title}
        description={`${WORKFLOW_COPY.dbAssignment.description} 지점장은 부지점장에게 배분하거나 조직원에게 직접 배정할 수 있습니다.`}
      />
      <Tabs defaultValue="to_agent">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="to_agent">
            <UserPlus className="mr-1.5 h-4 w-4" /> 조직원에게 직접 배정
          </TabsTrigger>
          <TabsTrigger value="to_sub_branch">
            <Users className="mr-1.5 h-4 w-4" /> 부지점장에게 배분
          </TabsTrigger>
        </TabsList>
        <TabsContent value="to_agent" className="mt-4">
          <AssignToAgent />
        </TabsContent>
        <TabsContent value="to_sub_branch" className="mt-4">
          <AssignToSubBranch />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AssignToAgent() {
  const { user } = useAuth();
  const { data: unassigned, refetch } = trpc.customers.list.useQuery({
    unassigned: true,
  });
  const { data: allUsers } = trpc.users.list.useQuery();

  const agents = useMemo(
    () =>
      ((allUsers ?? []) as UserRow[]).filter(
        candidate =>
          candidate.accountStatus === "active" &&
          (candidate.role === "team_leader" ||
            candidate.role === "member" ||
            (candidate.role === "branch_admin" && candidate.id === user?.id))
      ),
    [allUsers, user?.id]
  );

  return (
    <AssignmentPanel
      customers={(unassigned ?? []) as CustomerRow[]}
      agents={agents}
      title={`미배정 고객 목록 (${unassigned?.length ?? 0}명)`}
      refetchCustomers={refetch}
      emptyAgentText="배정 가능한 조직원이 없습니다."
      selectPlaceholder="담당 조직원 선택"
      emptyCustomerTitle="미배정 고객 DB가 없습니다."
      emptyCustomerDescription="신규 고객을 등록하거나 회수한 DB가 생기면 이곳에서 조직원에게 배정할 수 있습니다."
      helperText={selectedAgent =>
        selectedAgent.role === "member"
          ? "팀원에게 DB를 배정하면 해당 팀원이 고객 담당자로 자동 지정됩니다."
          : "부지점장 또는 팀장에게 DB를 배정하면 담당자는 자동 변경되지 않습니다. 이후 산하 조직원에게 다시 배정할 수 있습니다."
      }
    />
  );
}

function AssignToSubBranch() {
  const utils = trpc.useUtils();
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [selectedSubBranchAdmin, setSelectedSubBranchAdmin] =
    useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<AssignmentResult | null>(null);

  const { data: unassigned, refetch } = trpc.customers.list.useQuery({
    unassigned: true,
    assignmentStatus: "unassigned",
  });
  const { data: allUsers } = trpc.users.list.useQuery();
  const subBranchAdmins = ((allUsers ?? []) as UserRow[]).filter(
    candidate =>
      candidate.role === "sub_branch_admin" &&
      candidate.accountStatus === "active"
  );
  const customers = (unassigned ?? []) as CustomerRow[];
  const filteredCustomers = useMemo(
    () =>
      filterCustomers(customers, {
        search,
        status: statusFilter,
        source: sourceFilter,
      }),
    [customers, search, sourceFilter, statusFilter]
  );
  const visibleCustomerIds = filteredCustomers.map(customer => customer.id);
  const selectedVisibleCount = selectedCustomers.filter(id =>
    visibleCustomerIds.includes(id)
  ).length;
  const selectedTarget = subBranchAdmins.find(
    candidate => String(candidate.id) === selectedSubBranchAdmin
  );

  const assignToSubBranchMutation =
    trpc.customers.assignToSubBranch.useMutation({
      onSuccess: () => {
        refetch();
        utils.customers.list.invalidate();
      },
      onError: err => toast.error(err.message || "배분에 실패했습니다."),
    });

  const handleAssign = async () => {
    if (!selectedSubBranchAdmin || selectedCustomers.length === 0) {
      toast.error("부지점장과 고객을 선택하세요.");
      return;
    }

    const items: AssignmentResultItem[] = [];
    for (const customerId of selectedCustomers) {
      const customer = customers.find(item => item.id === customerId);
      try {
        await assignToSubBranchMutation.mutateAsync({
          customerId,
          subBranchAdminId: Number(selectedSubBranchAdmin),
        });
        items.push({
          customerId,
          customerName: customer?.name ?? `#${customerId}`,
          status: "success",
        });
      } catch (error: any) {
        items.push({
          customerId,
          customerName: customer?.name ?? `#${customerId}`,
          status: "failed",
          reason: error?.message ?? "배분 실패",
        });
      }
    }

    const nextResult = assignmentResultFromItems(items);
    setResult(nextResult);
    setConfirmOpen(false);
    if (nextResult.successCount > 0) {
      toast.success(
        formatDbAssignmentSuccessMessage({
          successCount: nextResult.successCount,
          targetLabel: selectedTarget
            ? formatUserWithRole(selectedTarget)
            : "선택한 부지점장",
          failedCount: nextResult.failedCount,
        })
      );
      setSelectedCustomers([]);
      setSelectedSubBranchAdmin("");
    } else {
      toast.error("배분된 고객이 없습니다. 실패 항목을 확인해 주세요.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">배분 설정</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedSubBranchAdmin}
            onValueChange={setSelectedSubBranchAdmin}
          >
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue placeholder="부지점장 선택" />
            </SelectTrigger>
            <SelectContent>
              {subBranchAdmins.length === 0 ? (
                <SelectItem value="none" disabled>
                  부지점장 없음
                </SelectItem>
              ) : (
                subBranchAdmins.map(subBranchAdmin => (
                  <SelectItem
                    key={subBranchAdmin.id}
                    value={String(subBranchAdmin.id)}
                  >
                    {formatUserWithRole(subBranchAdmin)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={
              !selectedSubBranchAdmin ||
              selectedCustomers.length === 0 ||
              assignToSubBranchMutation.isPending
            }
            onClick={() => setConfirmOpen(true)}
          >
            <Users className="mr-1 h-4 w-4" />
            {selectedCustomers.length > 0
              ? `${selectedCustomers.length}명 배분`
              : "배분하기"}
          </Button>
          {subBranchAdmins.length === 0 && (
            <p className="basis-full text-xs text-muted-foreground">
              사용자 관리에서 부지점장을 먼저 지정해주세요.
            </p>
          )}
        </CardContent>
      </Card>
      <AssignmentResultCard
        result={result}
        onRetryFailed={ids => setSelectedCustomers(ids)}
      />
      <CustomerTable
        customers={filteredCustomers}
        totalCount={customers.length}
        selected={selectedCustomers}
        onToggle={id => setSelectedCustomers(prev => toggleId(prev, id))}
        onToggleAll={() =>
          setSelectedCustomers(
            selectedVisibleCount === visibleCustomerIds.length
              ? selectedCustomers.filter(id => !visibleCustomerIds.includes(id))
              : Array.from(
                  new Set([...selectedCustomers, ...visibleCustomerIds])
                )
          )
        }
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        statusOptions={uniqueValues(customers, "consultStatus")}
        sourceOptions={uniqueValues(customers, "source")}
        title={`미배분 고객 목록 (${unassigned?.length ?? 0}명)`}
        emptyTitle="미배분 고객 DB가 없습니다."
        emptyDescription="신규 고객 DB가 생기면 부지점장에게 배분할 수 있습니다."
      />
      <AssignmentConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={WORKFLOW_COPY.dbDistribution.confirmTitle}
        description={WORKFLOW_COPY.dbDistribution.confirmDescription}
        selectedCount={selectedCustomers.length}
        targetLabel={selectedTarget ? formatUserWithRole(selectedTarget) : "-"}
        currentAssigneeLabel={WORKFLOW_COPY.dbAssignment.unassignedLabel}
        postAssigneeNote="배분 후 부지점장이 산하 조직원에게 다시 배정할 수 있습니다."
        confirmButtonLabel={WORKFLOW_COPY.dbDistribution.confirmButton}
        loading={assignToSubBranchMutation.isPending}
        onConfirm={handleAssign}
      />
    </div>
  );
}

function SubBranchAdminAssign() {
  const { user } = useAuth();
  const { data: myDb, refetch } = trpc.customers.list.useQuery({});
  const { data: allUsers } = trpc.users.list.useQuery();

  const assignedToMe = ((myDb ?? []) as CustomerRow[]).filter(
    customer => customer.assignmentStatus === "assigned_to_sub_branch"
  );
  const myTeamMembers = ((allUsers ?? []) as UserRow[]).filter(
    candidate =>
      candidate.accountStatus === "active" &&
      (candidate.role === "team_leader" || candidate.role === "member") &&
      candidate.subBranchAdminId === user?.id
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={WORKFLOW_COPY.dbAssignment.title}
        description={`${WORKFLOW_COPY.dbAssignment.description} 배분받은 DB를 산하 팀장·팀원에게 배정합니다.`}
      />
      <AssignmentPanel
        customers={assignedToMe}
        agents={myTeamMembers}
        title={`배분받은 미배정 DB (${assignedToMe.length}명)`}
        refetchCustomers={refetch}
        emptyAgentText="산하 조직원이 없습니다."
        selectPlaceholder="담당자 선택"
        emptyCustomerTitle="배분받은 미배정 DB가 없습니다."
        emptyCustomerDescription="지점장에게 DB를 배분받으면 이곳에서 산하 팀장·팀원에게 배정할 수 있습니다."
        helperText={selectedAgent =>
          selectedAgent.role === "member"
            ? "팀원에게 DB를 배정하면 해당 팀원이 고객 담당자로 자동 지정됩니다."
            : "팀장에게 DB를 배정하면 담당자는 자동 변경되지 않습니다. 이후 산하 팀원에게 다시 배정할 수 있습니다."
        }
      />
    </div>
  );
}

function TeamLeaderAssign() {
  const { user } = useAuth();
  const { data: teamCustomers, refetch } = trpc.customers.list.useQuery({});
  const { data: allUsers } = trpc.users.list.useQuery();

  const teamMembers = ((allUsers ?? []) as UserRow[]).filter(
    candidate =>
      candidate.accountStatus === "active" &&
      candidate.role === "member" &&
      candidate.teamId === user?.teamId
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={WORKFLOW_COPY.dbAssignment.title}
        description={`${WORKFLOW_COPY.dbAssignment.description} 본인 팀 고객 DB를 산하 팀원에게 배정합니다.`}
      />
      <AssignmentPanel
        customers={(teamCustomers ?? []) as CustomerRow[]}
        agents={teamMembers}
        title={`팀 고객 DB (${teamCustomers?.length ?? 0}명)`}
        refetchCustomers={refetch}
        emptyAgentText="산하 팀원이 없습니다."
        selectPlaceholder="산하 팀원 선택"
        emptyCustomerTitle="배정 가능한 팀 고객 DB가 없습니다."
        emptyCustomerDescription="본인 팀 권한 범위의 고객 DB가 생기면 이곳에서 산하 팀원에게 배정할 수 있습니다."
        helperText={() =>
          "팀원에게 DB를 배정하면 해당 팀원이 고객 담당자로 자동 지정됩니다."
        }
      />
    </div>
  );
}

function AssignmentPanel({
  customers,
  agents,
  title,
  refetchCustomers,
  emptyAgentText,
  selectPlaceholder,
  emptyCustomerTitle,
  emptyCustomerDescription,
  helperText,
}: {
  customers: CustomerRow[];
  agents: UserRow[];
  title: string;
  refetchCustomers: () => void;
  emptyAgentText: string;
  selectPlaceholder: string;
  emptyCustomerTitle: string;
  emptyCustomerDescription: string;
  helperText: (selectedAgent: UserRow) => string;
}) {
  const utils = trpc.useUtils();
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const selectedAgentUser = agents.find(
    agent => String(agent.id) === selectedAgent
  );
  const filteredCustomers = useMemo(
    () =>
      filterCustomers(customers, {
        search,
        status: statusFilter,
        source: sourceFilter,
      }),
    [customers, search, sourceFilter, statusFilter]
  );
  const visibleCustomerIds = filteredCustomers.map(customer => customer.id);
  const selectedVisibleCount = selectedCustomers.filter(id =>
    visibleCustomerIds.includes(id)
  ).length;

  const assignMutation = trpc.customers.assign.useMutation({
    onSuccess: () => {
      refetchCustomers();
      utils.customers.list.invalidate();
    },
    onError: err => toast.error(err.message || "배정에 실패했습니다."),
  });

  const handleAssign = async () => {
    if (!selectedAgent || selectedCustomers.length === 0) {
      toast.error("담당자와 고객을 선택하세요.");
      return;
    }

    const items: AssignmentResultItem[] = [];
    for (const customerId of selectedCustomers) {
      const customer = customers.find(item => item.id === customerId);
      try {
        await assignMutation.mutateAsync({
          customerId,
          agentId: Number(selectedAgent),
        });
        items.push({
          customerId,
          customerName: customer?.name ?? `#${customerId}`,
          status: "success",
        });
      } catch (error: any) {
        items.push({
          customerId,
          customerName: customer?.name ?? `#${customerId}`,
          status: "failed",
          reason: error?.message ?? "배정 실패",
        });
      }
    }

    const nextResult = assignmentResultFromItems(items);
    setResult(nextResult);
    setConfirmOpen(false);
    if (nextResult.successCount > 0) {
      toast.success(
        formatDbAssignmentSuccessMessage({
          successCount: nextResult.successCount,
          targetLabel: selectedAgentUser
            ? formatUserWithRole(selectedAgentUser)
            : "선택한 담당자",
          failedCount: nextResult.failedCount,
        })
      );
      setSelectedCustomers([]);
      setSelectedAgent("");
    } else {
      toast.error("배정된 고객이 없습니다. 실패 항목을 확인해 주세요.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">배정 설정</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue placeholder={selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 ? (
                <SelectItem value="none" disabled>
                  {emptyAgentText}
                </SelectItem>
              ) : (
                agents.map(agent => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {formatUserWithRole(agent)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={
              !selectedAgent ||
              selectedCustomers.length === 0 ||
              assignMutation.isPending
            }
            onClick={() => setConfirmOpen(true)}
          >
            <UserPlus className="mr-1 h-4 w-4" />
            {selectedCustomers.length > 0
              ? `${selectedCustomers.length}명 배정`
              : "배정하기"}
          </Button>
          {selectedAgentUser && (
            <p className="basis-full text-xs text-muted-foreground">
              {helperText(selectedAgentUser)}
            </p>
          )}
        </CardContent>
      </Card>
      <AssignmentResultCard
        result={result}
        onRetryFailed={ids => setSelectedCustomers(ids)}
      />
      <CustomerTable
        customers={filteredCustomers}
        totalCount={customers.length}
        selected={selectedCustomers}
        onToggle={id => setSelectedCustomers(prev => toggleId(prev, id))}
        onToggleAll={() =>
          setSelectedCustomers(
            selectedVisibleCount === visibleCustomerIds.length
              ? selectedCustomers.filter(id => !visibleCustomerIds.includes(id))
              : Array.from(
                  new Set([...selectedCustomers, ...visibleCustomerIds])
                )
          )
        }
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        statusOptions={uniqueValues(customers, "consultStatus")}
        sourceOptions={uniqueValues(customers, "source")}
        title={title}
        emptyTitle={emptyCustomerTitle}
        emptyDescription={emptyCustomerDescription}
      />
      <AssignmentConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={WORKFLOW_COPY.dbAssignment.confirmTitle}
        description={WORKFLOW_COPY.dbAssignment.confirmDescription}
        selectedCount={selectedCustomers.length}
        targetLabel={
          selectedAgentUser ? formatUserWithRole(selectedAgentUser) : "-"
        }
        currentAssigneeLabel={WORKFLOW_COPY.dbAssignment.unassignedLabel}
        postAssigneeNote={WORKFLOW_COPY.dbAssignment.postAssigneeNote}
        confirmButtonLabel={WORKFLOW_COPY.dbAssignment.confirmButton}
        loading={assignMutation.isPending}
        onConfirm={handleAssign}
      />
    </div>
  );
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function toggleId(selected: number[], id: number) {
  return selected.includes(id)
    ? selected.filter(selectedId => selectedId !== id)
    : [...selected, id];
}

function AssignmentResultCard({
  result,
  onRetryFailed,
}: {
  result: AssignmentResult | null;
  onRetryFailed: (ids: number[]) => void;
}) {
  if (!result) return null;
  const failedItems = result.items.filter(item => item.status === "failed");
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <p className="text-xs text-muted-foreground">처리 대상</p>
            <p className="mt-1 text-lg font-bold">{result.requestedCount}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="text-xs">성공</p>
            <p className="mt-1 text-lg font-bold">{result.successCount}</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="text-xs">실패/제외</p>
            <p className="mt-1 text-lg font-bold">{result.failedCount}</p>
          </div>
        </div>
        {failedItems.length > 0 && (
          <div className="rounded-lg border border-amber-100 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-amber-900">실패 항목</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onRetryFailed(failedItems.map(item => item.customerId))
                }
              >
                실패 항목 다시 선택
              </Button>
            </div>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-amber-900">
              {failedItems.map(item => (
                <p key={item.customerId}>
                  {item.customerName}: {item.reason ?? "처리 실패"}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssignmentConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  selectedCount,
  targetLabel,
  currentAssigneeLabel,
  postAssigneeNote,
  confirmButtonLabel,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  selectedCount: number;
  targetLabel: string;
  currentAssigneeLabel: string;
  postAssigneeNote: string;
  confirmButtonLabel: string;
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85dvh,40rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl border bg-slate-50 p-3 text-sm">
          <p>
            선택 고객: <span className="font-semibold">{selectedCount}건</span>
          </p>
          <p>
            {WORKFLOW_COPY.dbAssignment.currentAssigneeLabel}:{" "}
            <span className="font-semibold">{currentAssigneeLabel}</span>
          </p>
          <p>
            배정 대상: <span className="font-semibold">{targetLabel}</span>
          </p>
          <p>
            배정 후 책임자: <span className="font-semibold">{targetLabel}</span>
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {postAssigneeNote}
          </p>
          <p className="text-xs text-muted-foreground">
            일부 고객은 권한 또는 상태 문제로 실패할 수 있으며, 완료 후 결과를
            표시합니다.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {WORKFLOW_COPY.dbAssignment.cancelButton}
          </Button>
          <Button onClick={onConfirm} disabled={loading || selectedCount === 0}>
            {loading ? "처리 중..." : confirmButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerTable({
  customers,
  totalCount,
  selected,
  onToggle,
  onToggleAll,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  statusOptions,
  sourceOptions,
  title,
  emptyTitle,
  emptyDescription,
}: {
  customers: CustomerRow[];
  totalCount: number;
  selected: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  statusOptions: string[];
  sourceOptions: string[];
  title: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => onSearchChange(event.target.value)}
              className="h-9 pl-9"
              placeholder="고객명, 연락처, 지역, 유입경로 검색"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="상담상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">상담상태 전체</SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="유입경로" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">유입경로 전체</SelectItem>
              {sourceOptions.map(source => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span>전체 {totalCount}건</span>
          <span>필터 결과 {customers.length}건</span>
          <span>선택 {selected.length}건</span>
          {selected.length > 0 && (
            <span className="font-medium text-emerald-700">
              총 {selected.length}건이 배정 대상입니다.
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    onChange={onToggleAll}
                    checked={
                      customers.length > 0 &&
                      customers.every(customer =>
                        selected.includes(customer.id)
                      )
                    }
                  />
                </TableHead>
                <TableHead>이름</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>지역</TableHead>
                <TableHead>유입경로</TableHead>
                <TableHead>상담상태</TableHead>
                <TableHead>등록일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {emptyTitle}
                      </p>
                      <p className="text-xs">{emptyDescription}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map(customer => (
                  <TableRow
                    key={customer.id}
                    className={
                      selected.includes(customer.id) ? "bg-primary/5" : ""
                    }
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(customer.id)}
                        onChange={() => onToggle(customer.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell>{customer.phone ?? "-"}</TableCell>
                    <TableCell>{customer.region ?? "-"}</TableCell>
                    <TableCell>{customer.source ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={customer.consultStatus ?? "-"} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
