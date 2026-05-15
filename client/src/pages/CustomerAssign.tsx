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
import { useState } from "react";
import { toast } from "sonner";

export default function CustomerAssign() {
  const { user } = useAuth();
  const isBranchAdmin = user?.role === "branch_admin";
  const isSubBranchAdmin = user?.role === "sub_branch_admin";

  return (
    <DashboardLayout>
      {isBranchAdmin && <BranchAdminAssign />}
      {isSubBranchAdmin && <SubBranchAdminAssign />}
    </DashboardLayout>
  );
}

// ─── 지점장 화면 ──────────────────────────────────────────────────────────────
function BranchAdminAssign() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">DB 배정 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">고객 DB를 부지점장에게 배분하거나 팀원에게 직접 배정합니다.</p>
      </div>
      <Tabs defaultValue="to_agent">
        <TabsList>
          <TabsTrigger value="to_agent">
            <UserPlus className="h-4 w-4 mr-1.5" /> 팀원에게 직접 배정
          </TabsTrigger>
          <TabsTrigger value="to_sub_branch">
            <Users className="h-4 w-4 mr-1.5" /> 부지점장에게 배분
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

// ─── 팀원에게 직접 배정 ───────────────────────────────────────────────────────
function AssignToAgent() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const { data: unassigned, refetch } = trpc.customers.list.useQuery({ unassigned: true });
  const { data: allUsers } = trpc.users.list.useQuery();
  const agents = (allUsers ?? []).filter((u) => (u as any).accountStatus === "active" && (u.role === "team_leader" || u.role === "member" || (u.role === "branch_admin" && u.id === user?.id)));

  const assignMutation = trpc.customers.assign.useMutation({
    onSuccess: () => { refetch(); utils.customers.list.invalidate(); },
    onError: (err) => toast.error(err.message || "배정에 실패했습니다."),
  });

  const handleAssign = async () => {
    if (!selectedAgent || selectedCustomers.length === 0) { toast.error("담당자와 고객을 선택하세요."); return; }
    let count = 0;
    for (const cid of selectedCustomers) {
      try { await assignMutation.mutateAsync({ customerId: cid, agentId: Number(selectedAgent) }); count++; } catch {}
    }
    toast.success(`${count}명 배정 완료`);
    setSelectedCustomers([]); setSelectedAgent("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">배정 설정</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="담당 설계사 선택" /></SelectTrigger>
            <SelectContent>
              {agents.map((a) => <SelectItem key={a.id} value={String(a.id)}>{formatUserWithRole(a)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!selectedAgent || selectedCustomers.length === 0 || assignMutation.isPending} onClick={handleAssign}>
            <UserPlus className="h-4 w-4 mr-1" />{selectedCustomers.length > 0 ? `${selectedCustomers.length}명 배정` : "배정하기"}
          </Button>
        </CardContent>
      </Card>
      <CustomerTable customers={unassigned ?? []} selected={selectedCustomers} onToggle={(id) => setSelectedCustomers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} onToggleAll={() => setSelectedCustomers(selectedCustomers.length === (unassigned?.length ?? 0) ? [] : (unassigned?.map((c) => c.id) ?? []))} title={`미배정 고객 목록 (${unassigned?.length ?? 0}명)`} />
    </div>
  );
}

// ─── 부지점장에게 배분 (지점장 전용) ─────────────────────────────────────────
function AssignToSubBranch() {
  const utils = trpc.useUtils();
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [selectedSubBranchAdmin, setSelectedSubBranchAdmin] = useState<string>("");

  const { data: unassigned, refetch } = trpc.customers.list.useQuery({ unassigned: true, assignmentStatus: "unassigned" });
  const { data: allUsers } = trpc.users.list.useQuery();
  const subBranchAdmins = (allUsers ?? []).filter((u) => u.role === "sub_branch_admin" && (u as any).accountStatus === "active");

  const assignToSubBranchMutation = trpc.customers.assignToSubBranch.useMutation({
    onSuccess: () => { refetch(); utils.customers.list.invalidate(); },
    onError: (err) => toast.error(err.message || "배분에 실패했습니다."),
  });

  const handleAssign = async () => {
    if (!selectedSubBranchAdmin || selectedCustomers.length === 0) { toast.error("부지점장과 고객을 선택하세요."); return; }
    let count = 0;
    for (const cid of selectedCustomers) {
      try { await assignToSubBranchMutation.mutateAsync({ customerId: cid, subBranchAdminId: Number(selectedSubBranchAdmin) }); count++; } catch {}
    }
    toast.success(`${count}명 배분 완료`);
    setSelectedCustomers([]); setSelectedSubBranchAdmin("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">배분 설정</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap items-center">
          <Select value={selectedSubBranchAdmin} onValueChange={setSelectedSubBranchAdmin}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="부지점장 선택" /></SelectTrigger>
            <SelectContent>
              {subBranchAdmins.length === 0
                ? <SelectItem value="none" disabled>부지점장 없음</SelectItem>
                : subBranchAdmins.map((u) => <SelectItem key={u.id} value={String(u.id)}>{formatUserWithRole(u)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!selectedSubBranchAdmin || selectedCustomers.length === 0 || assignToSubBranchMutation.isPending} onClick={handleAssign}>
            <Users className="h-4 w-4 mr-1" />{selectedCustomers.length > 0 ? `${selectedCustomers.length}명 배분` : "배분하기"}
          </Button>
          {subBranchAdmins.length === 0 && <p className="text-xs text-muted-foreground">사용자 관리에서 부지점장을 지정해주세요.</p>}
        </CardContent>
      </Card>
      <CustomerTable customers={unassigned ?? []} selected={selectedCustomers} onToggle={(id) => setSelectedCustomers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} onToggleAll={() => setSelectedCustomers(selectedCustomers.length === (unassigned?.length ?? 0) ? [] : (unassigned?.map((c) => c.id) ?? []))} title={`미배분 고객 목록 (${unassigned?.length ?? 0}명)`} />
    </div>
  );
}

// ─── 부지점장 화면 ────────────────────────────────────────────────────────────
function SubBranchAdminAssign() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const { data: myDb, refetch } = trpc.customers.list.useQuery({});
  const assignedToMe = (myDb ?? []).filter((c) => (c as any).assignmentStatus === "assigned_to_sub_branch");

  const { data: allUsers } = trpc.users.list.useQuery();
  const myTeamMembers = (allUsers ?? []).filter((u) =>
    (u as any).accountStatus === "active" &&
    (u.role === "team_leader" || u.role === "member") &&
    (u as any).subBranchAdminId === user?.id
  );

  const assignMutation = trpc.customers.assign.useMutation({
    onSuccess: () => { refetch(); utils.customers.list.invalidate(); },
    onError: (err) => toast.error(err.message || "배정에 실패했습니다."),
  });

  const handleAssign = async () => {
    if (!selectedAgent || selectedCustomers.length === 0) { toast.error("담당자와 고객을 선택하세요."); return; }
    let count = 0;
    for (const cid of selectedCustomers) {
      try { await assignMutation.mutateAsync({ customerId: cid, agentId: Number(selectedAgent) }); count++; } catch {}
    }
    toast.success(`${count}명 배정 완료`);
    setSelectedCustomers([]); setSelectedAgent("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">DB 배정</h1>
        <p className="text-sm text-muted-foreground mt-0.5">배분받은 DB를 산하 팀장·팀원에게 배정합니다.</p>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">배정 설정</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="담당자 선택" /></SelectTrigger>
            <SelectContent>
              {myTeamMembers.length === 0
                ? <SelectItem value="none" disabled>산하 팀원 없음</SelectItem>
                : myTeamMembers.map((u) => <SelectItem key={u.id} value={String(u.id)}>{formatUserWithRole(u)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!selectedAgent || selectedCustomers.length === 0 || assignMutation.isPending} onClick={handleAssign}>
            <UserPlus className="h-4 w-4 mr-1" />{selectedCustomers.length > 0 ? `${selectedCustomers.length}명 배정` : "배정하기"}
          </Button>
        </CardContent>
      </Card>
      <CustomerTable customers={assignedToMe} selected={selectedCustomers} onToggle={(id) => setSelectedCustomers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} onToggleAll={() => setSelectedCustomers(selectedCustomers.length === assignedToMe.length ? [] : assignedToMe.map((c) => c.id))} title={`배분받은 미배정 DB (${assignedToMe.length}명)`} />
    </div>
  );
}

// ─── 공통 고객 테이블 ─────────────────────────────────────────────────────────
function CustomerTable({ customers, selected, onToggle, onToggleAll, title }: {
  customers: any[]; selected: number[]; onToggle: (id: number) => void; onToggleAll: () => void; title: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
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
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">데이터가 없습니다.</TableCell></TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id} className={selected.includes(c.id) ? "bg-primary/5" : ""}>
                    <TableCell><input type="checkbox" checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} /></TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone ?? "-"}</TableCell>
                    <TableCell>{c.region ?? "-"}</TableCell>
                    <TableCell>{c.source ?? "-"}</TableCell>
                    <TableCell><StatusBadge status={c.consultStatus} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("ko-KR")}</TableCell>
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
