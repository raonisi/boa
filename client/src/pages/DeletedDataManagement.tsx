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

const deleteRequestStatusLabels: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

const permanentTargetTypeLabels: Record<NonNullable<PermanentTarget>["type"], string> = {
  team: "팀",
  customer: "고객",
  contract: "계약",
};

const permanentBlockerLabels: Record<string, string> = {
  users: "사용자",
  customers: "고객",
  contracts: "계약",
  consultations: "상담기록",
  statusHistory: "상태 이력",
  consentLogs: "동의 이력",
  assignmentHistory: "배정 이력",
  deleteRequests: "삭제 요청",
  notifications: "알림",
  reminders: "리마인더",
  contractHistory: "계약 이력",
  schedules: "일정",
};

export default function DeletedDataManagement() {
  const utils = trpc.useUtils();
  const [permanentTarget, setPermanentTarget] = useState<PermanentTarget>(null);
  const [confirmText, setConfirmText] = useState("");
  const [permanentReason, setPermanentReason] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>(null);
  const [reviewComment, setReviewComment] = useState("");

  const { data: teams } = trpc.deletedData.listTeams.useQuery();
  const { data: customers } = trpc.deletedData.listCustomers.useQuery();
  const { data: contracts } = trpc.deletedData.listContracts.useQuery();
  const { data: requests } = trpc.deleteRequests.listAllRequestsForAdmin.useQuery({ status: "pending" });
  const { data: permanentPreview, isLoading: permanentPreviewLoading } = trpc.deletedData.permanentDeletePreview.useQuery(
    { type: permanentTarget?.type as "customer" | "contract", id: permanentTarget?.id ?? 0 },
    { enabled: permanentTarget?.type === "customer" || permanentTarget?.type === "contract" },
  );

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
    setPermanentReason("");
  };

  const closeReview = () => {
    setReviewTarget(null);
    setReviewComment("");
  };

  const runPermanentDelete = () => {
    if (!permanentTarget) return;
    const payload = { id: permanentTarget.id, confirmText, reason: permanentReason.trim() };
    if (permanentTarget.type === "team") permanentTeam.mutate(payload);
    if (permanentTarget.type === "customer") permanentCustomer.mutate(payload);
    if (permanentTarget.type === "contract") permanentContract.mutate(payload);
  };

  const permanentPending = permanentTeam.isPending || permanentCustomer.isPending || permanentContract.isPending;
  const permanentRequiresReason = permanentTarget?.type === "customer" || permanentTarget?.type === "contract";
  const permanentCanSubmit = confirmText === "완전삭제"
    && (!permanentRequiresReason || permanentReason.trim().length > 0)
    && !permanentPending
    && !permanentPreviewLoading
    && (permanentTarget?.type === "team" || permanentPreview?.canDelete !== false);

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
                        <TableCell>{deleteRequestStatusLabels[request.status] ?? "기타 상태"}</TableCell>
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

      <Dialog open={!!permanentTarget} onOpenChange={(open) => { if (!open && !permanentPending) closePermanent(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader><DialogTitle>완전삭제 최종 확인</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">이 작업은 되돌릴 수 없습니다.</p>
              <p className="mt-1">완전삭제 후에는 복구할 수 없습니다. 활동 로그는 감사 목적으로 보존됩니다.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">삭제 대상</p>
              <p className="mt-1 text-slate-700">
                {permanentTarget ? permanentTargetTypeLabels[permanentTarget.type] : "-"} #{permanentTarget?.id}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-950">{permanentTarget?.name}</p>
            </div>
            {(permanentTarget?.type === "customer" || permanentTarget?.type === "contract") && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">연결 데이터 확인</p>
                {permanentPreviewLoading ? (
                  <p className="mt-1">연결 데이터를 확인하는 중입니다.</p>
                ) : permanentPreview ? (
                  <>
                    <p className="mt-1">연결 데이터 {permanentPreview.linkedCount}건</p>
                    {Object.entries(permanentPreview.blockers ?? {}).filter(([, count]) => Number(count) > 0).length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(permanentPreview.blockers ?? {})
                          .filter(([, count]) => Number(count) > 0)
                          .map(([key, count]) => (
                            <span key={key} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                              {permanentBlockerLabels[key] ?? key} {Number(count)}건
                            </span>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs">서버 blocker 기준으로 연결 운영 이력이 없습니다.</p>
                    )}
                    {!permanentPreview.canDelete && (
                      <p className="mt-2 text-xs font-semibold text-red-700">
                        연결 운영 이력이 있어 완전삭제가 차단됩니다. 비활성 상태로 보존하세요.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1">연결 데이터 확인 정보를 불러오지 못했습니다.</p>
                )}
              </div>
            )}
            {permanentRequiresReason && (
              <div>
                <Label>완전삭제 사유 *</Label>
                <Textarea
                  value={permanentReason}
                  onChange={(e) => setPermanentReason(e.target.value)}
                  className="mt-1"
                  placeholder="운영 기준에 따라 완전삭제 사유를 입력하세요."
                  disabled={permanentPending}
                />
              </div>
            )}
            <div>
              <Label>진행하려면 아래에 "완전삭제"를 입력하세요.</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1" disabled={permanentPending} />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closePermanent} disabled={permanentPending}>취소</Button>
              <Button variant="destructive" disabled={!permanentCanSubmit} onClick={runPermanentDelete}>
                {permanentPending ? "완전삭제 중..." : "완전삭제"}
              </Button>
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
