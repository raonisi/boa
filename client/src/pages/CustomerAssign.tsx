import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole } from "@/lib/userRole";
import { UserPlus, Users } from "lucide-react";
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
        title="DB 배정 관리"
        description="고객 DB를 부지점장에게 배분하거나 팀장·팀원에게 직접 배정합니다."
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
  const { data: unassigned, refetch } = trpc.customers.list.useQuery({ unassigned: true });
  const { data: allUsers } = trpc.users.list.useQuery();

  const agents = useMemo(
    () =>
      ((allUsers ?? []) as UserRow[]).filter(
        (candidate) =>
          candidate.accountStatus === "active" &&
          (candidate.role === "team_leader" ||
            candidate.role === "member" ||
            (candidate.role === "branch_admin" && candidate.id === user?.id)),
      ),
    [allUsers, user?.id],
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
      helperText={(selectedAgent) =>
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
  const [selectedSubBranchAdmin, setSelectedSubBranchAdmin] = useState<string>("");

  const { data: unassigned, refetch } = trpc.customers.list.useQuery({ unassigned: true, assignmentStatus: "unassigned" });
  const { data: allUsers } = trpc.users.list.useQuery();
  const subBranchAdmins = ((allUsers ?? []) as UserRow[]).filter(
    (candidate) => candidate.role === "sub_branch_admin" && candidate.accountStatus === "active",
  );

  const assignToSubBranchMutation = trpc.customers.assignToSubBranch.useMutation({
    onSuccess: () => {
      refetch();
      utils.customers.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "배분에 실패했습니다."),
  });

  const handleAssign = async () => {
    if (!selectedSubBranchAdmin || selectedCustomers.length === 0) {
      toast.error("부지점장과 고객을 선택하세요.");
      return;
    }

    let count = 0;
    for (const customerId of selectedCustomers) {
      try {
        await assignToSubBranchMutation.mutateAsync({ customerId, subBranchAdminId: Number(selectedSubBranchAdmin) });
        count += 1;
      } catch {
        // Individual failures are surfaced by the mutation toast.
      }
    }

    if (count > 0) {
      toast.success(`${count}명 배분 완료`);
      setSelectedCustomers([]);
      setSelectedSubBranchAdmin("");
    } else {
      toast.error("배분된 고객이 없습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">배분 설정</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={selectedSubBranchAdmin} onValueChange={setSelectedSubBranchAdmin}>
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue placeholder="부지점장 선택" />
            </SelectTrigger>
            <SelectContent>
              {subBranchAdmins.length === 0 ? (
                <SelectItem value="none" disabled>
                  부지점장 없음
                </SelectItem>
              ) : (
                subBranchAdmins.map((subBranchAdmin) => (
                  <SelectItem key={subBranchAdmin.id} value={String(subBranchAdmin.id)}>
                    {formatUserWithRole(subBranchAdmin)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selectedSubBranchAdmin || selectedCustomers.length === 0 || assignToSubBranchMutation.isPending}
            onClick={handleAssign}
          >
            <Users className="mr-1 h-4 w-4" />
            {selectedCustomers.length > 0 ? `${selectedCustomers.length}명 배분` : "배분하기"}
          </Button>
          {subBranchAdmins.length === 0 && (
            <p className="basis-full text-xs text-muted-foreground">사용자 관리에서 부지점장을 먼저 지정해주세요.</p>
          )}
        </CardContent>
      </Card>
      <CustomerTable
        customers={(unassigned ?? []) as CustomerRow[]}
        selected={selectedCustomers}
        onToggle={(id) => setSelectedCustomers((prev) => toggleId(prev, id))}
        onToggleAll={() =>
          setSelectedCustomers(selectedCustomers.length === (unassigned?.length ?? 0) ? [] : (unassigned?.map((customer) => customer.id) ?? []))
        }
        title={`미배분 고객 목록 (${unassigned?.length ?? 0}명)`}
        emptyTitle="미배분 고객 DB가 없습니다."
        emptyDescription="신규 고객 DB가 생기면 부지점장에게 배분할 수 있습니다."
      />
    </div>
  );
}

function SubBranchAdminAssign() {
  const { user } = useAuth();
  const { data: myDb, refetch } = trpc.customers.list.useQuery({});
  const { data: allUsers } = trpc.users.list.useQuery();

  const assignedToMe = ((myDb ?? []) as CustomerRow[]).filter((customer) => customer.assignmentStatus === "assigned_to_sub_branch");
  const myTeamMembers = ((allUsers ?? []) as UserRow[]).filter(
    (candidate) =>
      candidate.accountStatus === "active" &&
      (candidate.role === "team_leader" || candidate.role === "member") &&
      candidate.subBranchAdminId === user?.id,
  );

  return (
    <div className="space-y-4">
      <PageHeader title="DB 배정" description="배분받은 DB를 산하 팀장·팀원에게 배정합니다." />
      <AssignmentPanel
        customers={assignedToMe}
        agents={myTeamMembers}
        title={`배분받은 미배정 DB (${assignedToMe.length}명)`}
        refetchCustomers={refetch}
        emptyAgentText="산하 조직원이 없습니다."
        selectPlaceholder="담당자 선택"
        emptyCustomerTitle="배분받은 미배정 DB가 없습니다."
        emptyCustomerDescription="지점장에게 DB를 배분받으면 이곳에서 산하 팀장·팀원에게 배정할 수 있습니다."
        helperText={(selectedAgent) =>
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
    (candidate) => candidate.accountStatus === "active" && candidate.role === "member" && candidate.teamId === user?.teamId,
  );

  return (
    <div className="space-y-4">
      <PageHeader title="DB 배정" description="본인 팀 고객 DB를 산하 팀원에게 배정합니다." />
      <AssignmentPanel
        customers={(teamCustomers ?? []) as CustomerRow[]}
        agents={teamMembers}
        title={`팀 고객 DB (${teamCustomers?.length ?? 0}명)`}
        refetchCustomers={refetch}
        emptyAgentText="산하 팀원이 없습니다."
        selectPlaceholder="산하 팀원 선택"
        emptyCustomerTitle="배정 가능한 팀 고객 DB가 없습니다."
        emptyCustomerDescription="본인 팀 권한 범위의 고객 DB가 생기면 이곳에서 산하 팀원에게 배정할 수 있습니다."
        helperText={() => "팀원에게 DB를 배정하면 해당 팀원이 고객 담당자로 자동 지정됩니다."}
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
  const selectedAgentUser = agents.find((agent) => String(agent.id) === selectedAgent);

  const assignMutation = trpc.customers.assign.useMutation({
    onSuccess: () => {
      refetchCustomers();
      utils.customers.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "배정에 실패했습니다."),
  });

  const handleAssign = async () => {
    if (!selectedAgent || selectedCustomers.length === 0) {
      toast.error("담당자와 고객을 선택하세요.");
      return;
    }

    let count = 0;
    for (const customerId of selectedCustomers) {
      try {
        await assignMutation.mutateAsync({ customerId, agentId: Number(selectedAgent) });
        count += 1;
      } catch {
        // Individual failures are surfaced by the mutation toast.
      }
    }

    if (count > 0) {
      toast.success(`${count}명 배정 완료`);
      setSelectedCustomers([]);
      setSelectedAgent("");
    } else {
      toast.error("배정된 고객이 없습니다. 다시 시도해 주세요.");
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
                agents.map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {formatUserWithRole(agent)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!selectedAgent || selectedCustomers.length === 0 || assignMutation.isPending} onClick={handleAssign}>
            <UserPlus className="mr-1 h-4 w-4" />
            {selectedCustomers.length > 0 ? `${selectedCustomers.length}명 배정` : "배정하기"}
          </Button>
          {selectedAgentUser && <p className="basis-full text-xs text-muted-foreground">{helperText(selectedAgentUser)}</p>}
        </CardContent>
      </Card>
      <CustomerTable
        customers={customers}
        selected={selectedCustomers}
        onToggle={(id) => setSelectedCustomers((prev) => toggleId(prev, id))}
        onToggleAll={() => setSelectedCustomers(selectedCustomers.length === customers.length ? [] : customers.map((customer) => customer.id))}
        title={title}
        emptyTitle={emptyCustomerTitle}
        emptyDescription={emptyCustomerDescription}
      />
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function toggleId(selected: number[], id: number) {
  return selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id];
}

function CustomerTable({
  customers,
  selected,
  onToggle,
  onToggleAll,
  title,
  emptyTitle,
  emptyDescription,
}: {
  customers: CustomerRow[];
  selected: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" onChange={onToggleAll} checked={selected.length === customers.length && customers.length > 0} />
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
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{emptyTitle}</p>
                      <p className="text-xs">{emptyDescription}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id} className={selected.includes(customer.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <input type="checkbox" checked={selected.includes(customer.id)} onChange={() => onToggle(customer.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone ?? "-"}</TableCell>
                    <TableCell>{customer.region ?? "-"}</TableCell>
                    <TableCell>{customer.source ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={customer.consultStatus ?? "-"} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(customer.createdAt).toLocaleDateString("ko-KR")}</TableCell>
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
