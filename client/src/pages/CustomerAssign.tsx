import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CustomerAssignCustomerList,
  type CustomerAssignRow,
} from "@/components/customers/CustomerAssignCustomerList";
import { CustomerAssignMobileActionBar } from "@/components/customers/CustomerAssignMobileActionBar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/useMobile";
import {
  formatDbAssignmentSuccessMessage,
  WORKFLOW_COPY,
} from "@/lib/assignmentWorkflowCopy";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole } from "@/lib/userRole";
import { UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  getUserFacingErrorMessage,
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { toast } from "sonner";

type CustomerRow = CustomerAssignRow;

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

function useResetSelectionOnFilterChange(
  setSelected: Dispatch<SetStateAction<number[]>>,
  filters: { search: string; statusFilter: string; sourceFilter: string }
) {
  const filterMountRef = useRef(true);
  useEffect(() => {
    if (filterMountRef.current) {
      filterMountRef.current = false;
      return;
    }
    setSelected(prev => {
      if (prev.length === 0) return prev;
      toast.message("검색·필터 조건이 바뀌어 선택이 초기화되었습니다.", {
        duration: 2500,
      });
      return [];
    });
  }, [filters.search, filters.statusFilter, filters.sourceFilter, setSelected]);
}

function AssignToSubBranch() {
  const isMobile = useIsMobile();
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

  useResetSelectionOnFilterChange(setSelectedCustomers, {
    search,
    statusFilter,
    sourceFilter,
  });

  const assignToSubBranchMutation =
    trpc.customers.assignToSubBranch.useMutation({
      onSuccess: () => {
        refetch();
        utils.customers.list.invalidate();
      },
      onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
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
          reason: getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed),
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
            className={isMobile ? "hidden" : undefined}
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
      <CustomerAssignCustomerList
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
        workflowKind="dbDistribution"
        listBottomPadding={isMobile && selectedCustomers.length > 0}
      />
      <CustomerAssignMobileActionBar
        selectedCount={selectedVisibleCount}
        canExecute={Boolean(selectedSubBranchAdmin)}
        workflowKind="dbDistribution"
        actionLabel={
          selectedVisibleCount > 0
            ? `${selectedVisibleCount}명 배분`
            : "배분하기"
        }
        helperText={
          selectedTarget
            ? formatUserWithRole(selectedTarget)
            : "부지점장을 먼저 선택하세요"
        }
        pending={assignToSubBranchMutation.isPending}
        onExecute={() => setConfirmOpen(true)}
        onClearSelection={() => setSelectedCustomers([])}
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
  const isMobile = useIsMobile();
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

  useResetSelectionOnFilterChange(setSelectedCustomers, {
    search,
    statusFilter,
    sourceFilter,
  });

  const assignMutation = trpc.customers.assign.useMutation({
    onSuccess: () => {
      refetchCustomers();
      utils.customers.list.invalidate();
    },
    onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
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
          reason: getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed),
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
            className={isMobile ? "hidden" : undefined}
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
      <CustomerAssignCustomerList
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
        workflowKind="dbAssignment"
        listBottomPadding={isMobile && selectedCustomers.length > 0}
      />
      <CustomerAssignMobileActionBar
        selectedCount={selectedVisibleCount}
        canExecute={Boolean(selectedAgent)}
        workflowKind="dbAssignment"
        actionLabel={
          selectedVisibleCount > 0
            ? `${selectedVisibleCount}명 배정`
            : "배정하기"
        }
        helperText={
          selectedAgentUser
            ? formatUserWithRole(selectedAgentUser)
            : "담당자를 먼저 선택하세요"
        }
        pending={assignMutation.isPending}
        onExecute={() => setConfirmOpen(true)}
        onClearSelection={() => setSelectedCustomers([])}
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
