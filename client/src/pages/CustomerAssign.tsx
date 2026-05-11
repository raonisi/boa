import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function CustomerAssign() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);

  const { data: unassigned, refetch } = trpc.customers.list.useQuery({ unassigned: true });
  const { data: users } = trpc.users.list.useQuery();
  const assignMutation = trpc.customers.assign.useMutation({
    onSuccess: () => {
      toast.success("배정이 완료되었습니다.");
      setSelectedCustomers([]);
      refetch();
    },
    onError: () => toast.error("배정에 실패했습니다."),
  });

  const agents = users?.filter((u) => u.role === "agent" || u.role === "manager") ?? [];

  const toggleSelect = (id: number) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = () => {
    if (!selectedAgent || selectedCustomers.length === 0) {
      toast.error("담당자와 고객을 선택하세요.");
      return;
    }
    Promise.all(
      selectedCustomers.map((cid) =>
        assignMutation.mutateAsync({ customerId: cid, agentId: Number(selectedAgent) })
      )
    ).then(() => {
      toast.success(`${selectedCustomers.length}명 배정 완료`);
      setSelectedCustomers([]);
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">DB 배정</h1>
          <p className="text-sm text-muted-foreground mt-0.5">미배정 고객 DB를 담당 설계사에게 배정합니다.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">배정 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">담당 설계사 선택</label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="담당자를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name} ({a.role === "manager" ? "팀장" : "팀원"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAssign}
                disabled={!selectedAgent || selectedCustomers.length === 0 || assignMutation.isPending}
                className="h-9"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                {selectedCustomers.length > 0 ? `${selectedCustomers.length}명 배정` : "배정하기"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">미배정 고객 목록 ({unassigned?.length ?? 0}명)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCustomers(unassigned?.map((c) => c.id) ?? []);
                          } else {
                            setSelectedCustomers([]);
                          }
                        }}
                        checked={selectedCustomers.length === (unassigned?.length ?? 0) && selectedCustomers.length > 0}
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
                  {(unassigned ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        미배정 고객이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (unassigned ?? []).map((c) => (
                      <TableRow key={c.id} className={selectedCustomers.includes(c.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedCustomers.includes(c.id)}
                            onChange={() => toggleSelect(c.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.phone ?? "-"}</TableCell>
                        <TableCell>{c.region ?? "-"}</TableCell>
                        <TableCell>{c.source ?? "-"}</TableCell>
                        <TableCell><StatusBadge status={c.consultStatus} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
