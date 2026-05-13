import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Check, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PermanentTarget = {
  type: "team" | "customer" | "contract";
  id: number;
  name: string;
} | null;

type ReviewTarget = {
  id: number;
  action: "approve" | "reject";
} | null;

function fmtDate(value: unknown) {
  if (!value) return "-";
  return new Date(value as string | Date).toLocaleString("ko-KR");
}

export default function DeletedDataManagement() {
  const utils = trpc.useUtils();
  const [permanentTarget, setPermanentTarget] = useState<PermanentTarget>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>(null);
  const [reviewComment, setReviewComment] = useState("");

  const { data: teams } = trpc.deletedData.listTeams.useQuery();
  const { data: customers } = trpc.deletedData.listCustomers.useQuery();
  const { data: contracts } = trpc.deletedData.listContracts.useQuery();
  const { data: requests } = trpc.deleteRequests.listAllRequestsForAdmin.useQuery({ status: "pending" });

  const invalidateAll = () => {
    utils.deletedData.listTeams.invalidate();
    utils.deletedData.listCustomers.invalidate();
    utils.deletedData.listContracts.invalidate();
    utils.deleteRequests.listAllRequestsForAdmin.invalidate();
    utils.contracts.list.invalidate();
    utils.performance.stats.invalidate();
  };

  const restoreTeam = trpc.deletedData.restoreTeam.useMutation({ onSuccess: () => { toast.success("팀을 복구했습니다."); invalidateAll(); } });
  const restoreCustomer = trpc.deletedData.restoreCustomer.useMutation({ onSuccess: () => { toast.success("고객을 복구했습니다."); invalidateAll(); } });
  const restoreContract = trpc.deletedData.restoreContract.useMutation({ onSuccess: () => { toast.success("계약을 복구했습니다."); invalidateAll(); } });
  const permanentTeam = trpc.deletedData.permanentDeleteTeam.useMutation({ onSuccess: () => { toast.success("팀을 완전삭제했습니다."); closePermanent(); invalidateAll(); }, onError: (e) => toast.error(e.message) });
  const permanentCustomer = trpc.deletedData.permanentDeleteCustomer.useMutation({ onSuccess: () => { toast.success("고객을 완전삭제했습니다."); closePermanent(); invalidateAll(); }, onError: (e) => toast.error(e.message) });
  const permanentContract = trpc.deletedData.permanentDeleteContract.useMutation({ onSuccess: () => { toast.success("계약을 완전삭제했습니다."); closePermanent(); invalidateAll(); }, onError: (e) => toast.error(e.message) });
  const approveRequest = trpc.deleteRequests.approve.useMutation({ onSuccess: () => { toast.success("삭제 요청을 승인했습니다."); closeReview(); invalidateAll(); }, onError: (e) => toast.error(e.message) });
  const rejectRequest = trpc.deleteRequests.reject.useMutation({ onSuccess: () => { toast.success("삭제 요청을 반려했습니다."); closeReview(); invalidateAll(); }, onError: (e) => toast.error(e.message) });

  const closePermanent = () => {
    setPermanentTarget(null);
    setConfirmText("");
  };

  const closeReview = () => {
    setReviewTarget(null);
    setReviewComment("");
  };

  const runPermanentDelete = () => {
    if (!permanentTarget) return;
    const payload = { id: permanentTarget.id, confirmText };
    if (permanentTarget.type === "team") permanentTeam.mutate(payload);
    if (permanentTarget.type === "customer") permanentCustomer.mutate(payload);
    if (permanentTarget.type === "contract") permanentContract.mutate(payload);
  };

  const runReview = () => {
    if (!reviewTarget) return;
    if (reviewTarget.action === "approve") {
      approveRequest.mutate({ id: reviewTarget.id, reviewComment: reviewComment || undefined });
    } else {
      rejectRequest.mutate({ id: reviewTarget.id, reviewComment });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Deleted Data</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">삭제 데이터 관리</h1>
            <p className="mt-1 text-sm text-slate-500">
              비활성 처리된 팀, 고객, 계약을 복구하거나 조건을 만족할 때만 완전삭제합니다.
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-red-50/60 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>완전삭제는 복구할 수 없는 위험 작업입니다. confirmText 검증과 서버 권한 검증은 기존 정책을 그대로 사용합니다.</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList className="h-auto flex-wrap rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger value="requests">삭제 요청</TabsTrigger>
            <TabsTrigger value="teams">삭제된 팀</TabsTrigger>
            <TabsTrigger value="customers">삭제된 고객</TabsTrigger>
            <TabsTrigger value="contracts">삭제된 계약</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">계약 삭제 요청</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead>요청일</TableHead>
                      <TableHead>요청자</TableHead>
                      <TableHead>고객</TableHead>
                      <TableHead>계약</TableHead>
                      <TableHead>월보험료</TableHead>
                      <TableHead>요청 사유</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">처리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(requests ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">대기 중인 요청이 없습니다.</TableCell></TableRow>
                    ) : (requests ?? []).map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="text-xs">{fmtDate(request.createdAt)}</TableCell>
                        <TableCell>{request.requester?.name ?? request.requestedBy}</TableCell>
                        <TableCell>{request.customer?.name ?? request.customerId}</TableCell>
                        <TableCell>{request.contract?.productName ?? request.targetId}</TableCell>
                        <TableCell>{request.contract?.monthlyPremium?.toLocaleString() ?? "-"}</TableCell>
                        <TableCell>{request.requestReason}</TableCell>
                        <TableCell>{request.status}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setReviewTarget({ id: request.id, action: "approve" })}><Check className="h-3.5 w-3.5 mr-1" />승인</Button>
                          <Button size="sm" variant="outline" onClick={() => setReviewTarget({ id: request.id, action: "reject" })}><X className="h-3.5 w-3.5 mr-1" />반려</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams">
            <DeletedTable
              rows={(teams ?? []).map((team) => ({ id: team.id, name: team.name, deletedAt: team.deletedAt, createdAt: team.createdAt }))}
              emptyText="삭제된 팀이 없습니다."
              onRestore={(id) => restoreTeam.mutate({ id })}
              onPermanent={(row) => setPermanentTarget({ type: "team", id: row.id, name: row.name })}
            />
          </TabsContent>

          <TabsContent value="customers">
            <DeletedTable
              rows={(customers ?? []).map((customer) => ({ id: customer.id, name: customer.name, deletedAt: customer.deletedAt, createdAt: customer.createdAt }))}
              emptyText="삭제된 고객이 없습니다."
              onRestore={(id) => restoreCustomer.mutate({ id })}
              onPermanent={(row) => setPermanentTarget({ type: "customer", id: row.id, name: row.name })}
            />
          </TabsContent>

          <TabsContent value="contracts">
            <DeletedTable
              rows={(contracts ?? []).map((contract) => ({ id: contract.id, name: contract.productName ?? `계약 #${contract.id}`, deletedAt: contract.deletedAt, createdAt: contract.createdAt }))}
              emptyText="삭제된 계약이 없습니다."
              onRestore={(id) => restoreContract.mutate({ id })}
              onPermanent={(row) => setPermanentTarget({ type: "contract", id: row.id, name: row.name })}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!permanentTarget} onOpenChange={(open) => { if (!open) closePermanent(); }}>
          <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>완전삭제 확인</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              이 작업은 복구할 수 없습니다. 활동 로그는 감사 목적으로 보존됩니다.
              연결된 데이터가 남아 있으면 완전삭제가 차단됩니다.
            </p>
            <p className="text-sm font-medium">{permanentTarget?.name}</p>
            <div>
              <Label>정말 완전삭제하시려면 "완전삭제"를 입력하세요.</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closePermanent}>취소</Button>
              <Button variant="destructive" disabled={confirmText !== "완전삭제"} onClick={runPermanentDelete}>완전삭제</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) closeReview(); }}>
          <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{reviewTarget?.action === "approve" ? "계약 삭제 요청 승인" : "계약 삭제 요청 반려"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {reviewTarget?.action === "approve"
                ? "승인 시 해당 계약은 비활성 처리되며, 계약 목록과 실적 집계에서 제외됩니다."
                : "반려 사유를 입력하면 요청자에게 반려 상태로 표시됩니다."}
            </p>
            <div>
              <Label>{reviewTarget?.action === "approve" ? "승인 메모" : "반려 사유 *"}</Label>
              <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeReview}>취소</Button>
              <Button onClick={runReview} disabled={reviewTarget?.action === "reject" && !reviewComment.trim()}>
                {reviewTarget?.action === "approve" ? "승인 후 비활성 처리" : "반려"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function DeletedTable({
  rows,
  emptyText,
  onRestore,
  onPermanent,
}: {
  rows: Array<{ id: number; name: string; deletedAt: unknown; createdAt: unknown }>;
  emptyText: string;
  onRestore: (id: number) => void;
  onPermanent: (row: { id: number; name: string }) => void;
}) {
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>삭제일</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{emptyText}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{fmtDate(row.deletedAt)}</TableCell>
                <TableCell>{fmtDate(row.createdAt)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => onRestore(row.id)}><RotateCcw className="h-3.5 w-3.5 mr-1" />복구</Button>
                  <Button size="sm" variant="outline" className="border-red-200 text-destructive hover:bg-red-50" onClick={() => onPermanent(row)}><Trash2 className="h-3.5 w-3.5 mr-1" />완전삭제</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
