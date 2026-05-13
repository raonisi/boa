import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
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
  const [requestContractId, setRequestContractId] = useState<number | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestMemo, setRequestMemo] = useState("");
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();
  const { data: contracts } = trpc.contracts.list.useQuery();

  const deactivateMutation = trpc.contracts.deactivate.useMutation({
    onSuccess: () => {
      toast.success("계약이 삭제(비활성 처리)되었습니다.");
      utils.contracts.list.invalidate();
      utils.performance.stats.invalidate();
    },
    onError: (err) => toast.error(err.message || "계약 삭제에 실패했습니다."),
  });

  const requestDeleteMutation = trpc.deleteRequests.createContractDeleteRequest.useMutation({
    onSuccess: () => {
      toast.success("삭제 요청이 관리자에게 전달되었습니다.");
      setRequestContractId(null);
      setRequestReason("");
      setRequestMemo("");
      utils.deleteRequests.listMyRequests.invalidate();
    },
    onError: (err) => toast.error(err.message || "삭제 요청에 실패했습니다."),
  });

  const canDeactivate = user?.role === "branch_admin";
  const canRequestDelete = user?.role === "sub_branch_admin" || user?.role === "team_leader" || user?.role === "member";

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
    if (confirm("이 계약을 삭제하시겠습니까?\n완전 삭제가 아니라 비활성 처리됩니다.\n삭제된 계약은 기본 계약 목록과 실적 집계에서 제외됩니다.\n이 작업은 활동 로그에 기록됩니다.")) {
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
            {" · "}{filtered.length}건 · 유지계약 월보험료 합계: {totalPremium.toLocaleString()}원
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
                  {["청약", "승낙", "철회", "유지", "해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-32 h-9"><SelectValue placeholder="납입상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {["정상", "미납", "실효", "해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isMobile ? (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">계약 데이터가 없습니다.</CardContent></Card>
            ) : (
              filtered.map((c) => (
                <Card key={c.id} className="cursor-pointer active:bg-muted/70" onClick={() => setLocation(`/customers/${c.customerId}`)}>
                  <CardContent className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.productName ?? "-"}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.company ?? "-"} · {c.productGroup ?? "-"}</p>
                      </div>
                      <StatusBadge status={c.contractStatus ?? "청약"} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-muted-foreground">계약일</p><p className="font-medium">{c.contractDate ? new Date(c.contractDate).toLocaleDateString("ko-KR") : "-"}</p></div>
                      <div><p className="text-muted-foreground">월보험료</p><p className="font-medium">{c.monthlyPremium ? `${c.monthlyPremium.toLocaleString()}원` : "-"}</p></div>
                      <div><p className="text-muted-foreground">납입상태</p><StatusBadge status={c.paymentStatus ?? "정상"} /></div>
                      <div><p className="text-muted-foreground">상태</p><StatusBadge status={c.contractStatus ?? "청약"} /></div>
                    </div>
                    {(canDeactivate || canRequestDelete) && (
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        {canDeactivate ? (
                          <Button variant="outline" size="sm" className="min-h-9 text-destructive" onClick={(e) => handleDeactivate(c.id, e)}>
                            <XCircle className="h-4 w-4 mr-1" /> 계약 삭제
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="min-h-9" onClick={() => setRequestContractId(c.id)}>
                            삭제 요청
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
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
                    {(canDeactivate || canRequestDelete) && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canDeactivate || canRequestDelete ? 9 : 8} className="text-center text-muted-foreground py-8">계약 데이터가 없습니다.</TableCell>
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
                        {(canDeactivate || canRequestDelete) && (
                          <TableCell>
                            {canDeactivate ? (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeactivate(c.id, e)} title="계약 삭제">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setRequestContractId(c.id); }}>
                                삭제 요청
                              </Button>
                            )}
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
        )}
      </div>

      <Dialog open={requestContractId !== null} onOpenChange={(open) => { if (!open) setRequestContractId(null); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>계약 삭제 요청</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              이 계약의 삭제를 관리자에게 요청합니다. 승인되면 해당 계약은 비활성 처리되며, 실적 집계에서 제외됩니다.
            </p>
            <div>
              <Label>요청 사유 *</Label>
              <Select value={requestReason} onValueChange={setRequestReason}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="사유 선택" /></SelectTrigger>
                <SelectContent>
                  {["중복 입력", "오입력", "계약 취소", "테스트 입력", "기타"].map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>상세 메모</Label>
              <Textarea value={requestMemo} onChange={(e) => setRequestMemo(e.target.value)} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRequestContractId(null)}>취소</Button>
              <Button disabled={!requestReason || requestDeleteMutation.isPending} onClick={() => requestContractId && requestDeleteMutation.mutate({ contractId: requestContractId, requestReason, requestMemo: requestMemo || undefined })}>
                삭제 요청 보내기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
