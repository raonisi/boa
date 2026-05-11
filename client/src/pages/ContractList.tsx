import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Search, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ContractList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const utils = trpc.useUtils();
  const { data: contracts } = trpc.contracts.list.useQuery();

  const deactivateMutation = trpc.contracts.deactivate.useMutation({
    onSuccess: () => { toast.success("계약이 비활성 처리되었습니다."); utils.contracts.list.invalidate(); },
    onError: () => toast.error("비활성 처리에 실패했습니다."),
  });

  const canDeactivate = user?.role === "branch_admin" || user?.role === "sub_branch_admin" || user?.role === "team_leader";

  const filtered = (contracts ?? []).filter((c) => {
    const matchSearch = !search || (c.productName ?? "").includes(search) || (c.company ?? "").includes(search);
    const matchStatus = statusFilter === "all" || c.contractStatus === statusFilter;
    const matchPayment = paymentFilter === "all" || c.paymentStatus === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  const totalPremium = filtered
    .filter((c) => c.contractStatus === "유지")
    .reduce((sum, c) => sum + (c.monthlyPremium ?? 0), 0);

  const handleDeactivate = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("이 계약을 비활성 처리하시겠습니까? 데이터는 보존됩니다.")) {
      deactivateMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">계약관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.role === "sub_branch_admin" ? "부지점장 산하 계약관리" :
             user?.role === "team_leader" ? "본인 팀 계약관리" :
             user?.role === "member" ? "내 계약관리" : "전체 계약관리"}
            {" · "}{filtered.length}건 · 유지계약 월납보험료 합계: {totalPremium.toLocaleString()}월
          </p>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="보험사 또는 상품명 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32 h-9"><SelectValue placeholder="계약상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {["청약","성립","철회","유지","해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-32 h-9"><SelectValue placeholder="납입상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {["정상","미납","실효","해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>보험사</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead>상품군</TableHead>
                    <TableHead>계약일</TableHead>
                    <TableHead className="text-right">월보험료</TableHead>
                    <TableHead>납입상태</TableHead>
                    <TableHead>계약상태</TableHead>
                    <TableHead>메모</TableHead>
                    {canDeactivate && <TableHead className="w-16"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canDeactivate ? 9 : 8} className="text-center text-muted-foreground py-8">계약 데이터가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/customers/${c.customerId}`)}>
                        <TableCell>{c.company ?? "-"}</TableCell>
                        <TableCell className="font-medium">{c.productName ?? "-"}</TableCell>
                        <TableCell>{c.productGroup ?? "-"}</TableCell>
                        <TableCell className="text-xs">{c.contractDate ? new Date(c.contractDate).toLocaleDateString("ko-KR") : "-"}</TableCell>
                        <TableCell className="text-right">{c.monthlyPremium ? `${c.monthlyPremium.toLocaleString()}원` : "-"}</TableCell>
                        <TableCell><StatusBadge status={c.paymentStatus ?? "정상"} /></TableCell>
                        <TableCell><StatusBadge status={c.contractStatus ?? "청약"} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-32 truncate">{c.memo ?? "-"}</TableCell>
                        {canDeactivate && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDeactivate(c.id, e)}
                              title="계약 비활성 처리"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
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
