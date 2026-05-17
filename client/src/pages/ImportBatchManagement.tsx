import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Eye, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const batchStatusLabels: Record<string, string> = {
  active: "활성",
  cancelled: "취소됨",
  partially_cancelled: "일부 취소",
  failed: "실패",
};

const assignmentStatusLabels: Record<string, string> = {
  assigned: "배정됨",
  unassigned: "미배정",
  reclaimed: "회수됨",
};

const customerStatusLabels: Record<string, string> = {
  active: "활성",
  inactive: "비활성",
  deleted: "삭제됨",
};

export default function ImportBatchManagement() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const { data: batches, isLoading } = trpc.imports.listBatches.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status as any,
  });
  const { data: detail } = trpc.imports.getBatchDetail.useQuery(
    { importBatchId: selectedBatchId ?? "" },
    { enabled: !!selectedBatchId },
  );
  const cancelMutation = trpc.imports.cancelBatch.useMutation({
    onSuccess: () => {
      toast.success("업로드 batch가 취소되었습니다.");
      setCancelTarget(null);
      setConfirmText("");
      setReason("");
      utils.imports.listBatches.invalidate();
      utils.imports.getBatchDetail.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const runCancel = () => {
    if (!cancelTarget) return;
    cancelMutation.mutate({ importBatchId: cancelTarget, confirmText, reason: reason || undefined });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">업로드 이력 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            고객 DB 일괄 업로드 이력을 확인하고, 운영 이력이 없는 batch를 soft delete 방식으로 취소합니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">업로드 batch 목록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="파일명 또는 batch ID 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="md:w-52"><SelectValue placeholder="상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="cancelled">취소됨</SelectItem>
                  <SelectItem value="partially_cancelled">일부 취소</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>업로드일</TableHead>
                    <TableHead>업로드자</TableHead>
                    <TableHead>batch ID</TableHead>
                    <TableHead>파일명</TableHead>
                    <TableHead className="text-right">총/성공/실패</TableHead>
                    <TableHead className="text-right">중복</TableHead>
                    <TableHead className="text-right">활성</TableHead>
                    <TableHead className="text-right">취소됨</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8">로딩 중...</TableCell></TableRow>
                  ) : (batches ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">업로드 이력이 없습니다.</TableCell></TableRow>
                  ) : (
                    (batches ?? []).map((batch: any) => (
                      <TableRow key={batch.importBatchId}>
                        <TableCell className="text-xs">{batch.createdAt ? new Date(batch.createdAt).toLocaleString("ko-KR") : "-"}</TableCell>
                        <TableCell>{batch.uploader?.name ?? batch.uploadedBy}</TableCell>
                        <TableCell className="font-mono text-xs">{batch.importBatchId}</TableCell>
                        <TableCell>{batch.fileName ?? "-"}</TableCell>
                        <TableCell className="text-right">{batch.totalRows}/{batch.successRows}/{batch.failedRows}</TableCell>
                        <TableCell className="text-right">{batch.duplicateRows}</TableCell>
                        <TableCell className="text-right">{batch.activeCustomerCount}</TableCell>
                        <TableCell className="text-right">{batch.cancelledCustomerCount}</TableCell>
                        <TableCell>{batchStatusLabels[batch.status] ?? batch.status}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedBatchId(batch.importBatchId)}>
                              <Eye className="h-3.5 w-3.5 mr-1" />상세
                            </Button>
                            <Button size="sm" variant="outline" disabled={batch.status === "cancelled" || batch.activeCustomerCount === 0} onClick={() => setCancelTarget(batch.importBatchId)}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />Batch 취소
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedBatchId} onOpenChange={(open) => !open && setSelectedBatchId(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader><DialogTitle>업로드 batch 상세</DialogTitle></DialogHeader>
            {detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-muted-foreground">batch ID</p><p className="font-mono text-xs">{detail.batch.importBatchId}</p></div>
                  <div><p className="text-muted-foreground">파일명</p><p>{detail.batch.fileName ?? "-"}</p></div>
                  <div><p className="text-muted-foreground">업로드자</p><p>{detail.batch.uploader?.name ?? detail.batch.uploadedBy}</p></div>
                  <div><p className="text-muted-foreground">상태</p><p>{batchStatusLabels[detail.batch.status] ?? detail.batch.status}</p></div>
                </div>
                <div className="overflow-x-auto border rounded-md max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>고객명</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead>상담상태</TableHead>
                        <TableHead>담당자</TableHead>
                        <TableHead>배정상태</TableHead>
                        <TableHead>등록일</TableHead>
                        <TableHead>현재 상태</TableHead>
                        <TableHead>연결 데이터</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.customers.map((customer: any) => (
                        <TableRow key={customer.id}>
                          <TableCell>{customer.name}</TableCell>
                          <TableCell>{customer.maskedPhone ?? "-"}</TableCell>
                          <TableCell>{customer.consultStatus}</TableCell>
                          <TableCell>{customer.agent?.name ?? "-"}</TableCell>
                          <TableCell>{assignmentStatusLabels[customer.assignmentStatus] ?? customer.assignmentStatus}</TableCell>
                          <TableCell className="text-xs">{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("ko-KR") : "-"}</TableCell>
                          <TableCell>{customerStatusLabels[customer.status] ?? customer.status}</TableCell>
                          <TableCell>{customer.hasLinkedData ? "있음" : "없음"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>업로드 Batch 취소</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                이 batch로 업로드된 고객을 비활성 처리합니다. 완전삭제가 아니라 soft delete 처리되며,
                계약, 일정, 상담기록, 알림 등 운영 이력이 연결된 고객이 있으면 취소가 차단됩니다.
                이 작업은 활동 로그에 기록됩니다.
              </p>
              <div>
                <Label>취소 사유</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="선택 입력" className="mt-1" />
              </div>
              <div>
                <Label>확인 문구</Label>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="BATCH취소" className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCancelTarget(null)}>닫기</Button>
                <Button variant="destructive" disabled={confirmText !== "BATCH취소" || cancelMutation.isPending} onClick={runCancel}>
                  Batch 취소
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
