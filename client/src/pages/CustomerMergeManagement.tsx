import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  getUserFacingErrorMessage,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { AlertTriangle, GitMerge, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function CustomerMergeManagement() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [targetCustomerId, setTargetCustomerId] = useState<number | null>(null);
  const [sourceCustomerId, setSourceCustomerId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const { data: groups, isLoading } =
    trpc.customerMerge.findDuplicates.useQuery({
      search: search || undefined,
      onlyActive: true,
    });
  const { data: preview } = trpc.customerMerge.preview.useQuery(
    {
      targetCustomerId: targetCustomerId ?? 0,
      sourceCustomerId: sourceCustomerId ?? 0,
    },
    {
      enabled:
        !!targetCustomerId &&
        !!sourceCustomerId &&
        targetCustomerId !== sourceCustomerId,
    }
  );

  const executeMutation = trpc.customerMerge.execute.useMutation({
    onSuccess: result => {
      toast.success("고객 병합이 완료되었습니다.");
      setLocation(`/customers/${result.targetCustomerId}`);
      utils.customerMerge.findDuplicates.invalidate();
      utils.customers.list.invalidate();
    },
    onError: error =>
      toast.error(
        getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed)
      ),
  });

  const resetSelection = () => {
    setTargetCustomerId(null);
    setSourceCustomerId(null);
    setConfirmText("");
    setReason("");
  };

  const selectMerge = (targetId: number, sourceId: number) => {
    setTargetCustomerId(targetId);
    setSourceCustomerId(sourceId);
    setConfirmText("");
    setReason("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
              Customer Merge
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              중복 고객 관리
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              연락처가 같은 활성 고객을 찾고, 상담기록·계약·후속관리 이력을 기준
              고객으로 안전하게 병합합니다.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">중복 후보 검색</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-4 h-4 w-4 text-muted-foreground md:left-2 md:top-2.5" />
              <Input
                className="min-h-12 rounded-xl bg-slate-50 pl-9 md:h-10 md:min-h-10 md:pl-8"
                placeholder="고객명 또는 연락처 검색"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                중복 후보를 확인하는 중입니다.
              </div>
            ) : (groups ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                동일 연락처 기준 중복 후보가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {(groups ?? []).map((group: any) => (
                  <Card
                    key={group.normalizedPhone}
                    className="overflow-hidden border-amber-200 bg-amber-50/40 shadow-sm"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        중복 연락처 후보: {group.maskedPhone}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 md:hidden">
                      {group.candidates.map((customer: any) => (
                        <div
                          key={customer.id}
                          className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#b99b5f]">
                                병합 후보 #{customer.id}
                              </p>
                              <p className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-slate-950">
                                {customer.name}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {customer.maskedPhone ?? "-"}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {customer.consultStatus}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-600">
                            <div className="rounded-xl bg-slate-50 p-3">
                              우선순위: {customer.priority}
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              상담/계약/후속:{" "}
                              {customer.stats?.consultations ?? 0}/
                              {customer.stats?.contracts ?? 0}/
                              {customer.stats?.followUps ?? 0}
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              등록일:{" "}
                              {customer.createdAt
                                ? new Date(
                                    customer.createdAt
                                  ).toLocaleDateString("ko-KR")
                                : "-"}
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-12"
                              onClick={() =>
                                setLocation(`/customers/${customer.id}`)
                              }
                            >
                              상세
                            </Button>
                            <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-2">
                              <p className="mb-2 text-[11px] font-semibold text-amber-800">
                                병합 실행 후보
                              </p>
                              <div className="grid gap-2">
                                {group.candidates
                                  .filter(
                                    (item: any) => item.id !== customer.id
                                  )
                                  .map((source: any) => (
                                    <Button
                                      key={source.id}
                                      size="sm"
                                      variant="outline"
                                      className="min-h-12 w-full border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                                      onClick={() =>
                                        selectMerge(customer.id, source.id)
                                      }
                                    >
                                      <GitMerge className="h-3.5 w-3.5 mr-1" />#
                                      {source.id} 병합
                                    </Button>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                    <CardContent className="hidden overflow-x-auto md:block">
                      <Table>
                        <TableHeader className="bg-white/70">
                          <TableRow>
                            <TableHead>고객</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead>우선순위</TableHead>
                            <TableHead className="text-right">
                              상담/계약/후속
                            </TableHead>
                            <TableHead>등록일</TableHead>
                            <TableHead className="text-right">작업</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.candidates.map((customer: any) => (
                            <TableRow key={customer.id}>
                              <TableCell>
                                <div className="font-medium">
                                  {customer.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {customer.maskedPhone ?? "-"}
                                </div>
                              </TableCell>
                              <TableCell>{customer.consultStatus}</TableCell>
                              <TableCell>{customer.priority}</TableCell>
                              <TableCell className="text-right">
                                {customer.stats?.consultations ?? 0}/
                                {customer.stats?.contracts ?? 0}/
                                {customer.stats?.followUps ?? 0}
                              </TableCell>
                              <TableCell className="text-xs">
                                {customer.createdAt
                                  ? new Date(
                                      customer.createdAt
                                    ).toLocaleDateString("ko-KR")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setLocation(`/customers/${customer.id}`)
                                    }
                                  >
                                    상세
                                  </Button>
                                  {group.candidates
                                    .filter(
                                      (item: any) => item.id !== customer.id
                                    )
                                    .map((source: any) => (
                                      <Button
                                        key={source.id}
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          selectMerge(customer.id, source.id)
                                        }
                                      >
                                        <GitMerge className="h-3.5 w-3.5 mr-1" />
                                        #{source.id} 병합
                                      </Button>
                                    ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!targetCustomerId && !!sourceCustomerId}
          onOpenChange={open => {
            if (!open) resetSelection();
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>고객 병합 미리보기</DialogTitle>
            </DialogHeader>
            {!preview ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                미리보기를 불러오는 중입니다.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <Card className="border-green-100 bg-green-50/60">
                    <CardHeader>
                      <CardTitle className="text-sm">기준 고객</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="font-medium">
                        {preview.targetCustomer.name}
                      </p>
                      <p className="text-muted-foreground">
                        {preview.targetCustomer.maskedPhone ?? "-"}
                      </p>
                      <p>상태: {preview.targetCustomer.consultStatus}</p>
                      <p>우선순위: {preview.targetCustomer.priority}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-100 bg-amber-50/60">
                    <CardHeader>
                      <CardTitle className="text-sm">병합 대상 고객</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="font-medium">
                        {preview.sourceCustomer.name}
                      </p>
                      <p className="text-muted-foreground">
                        {preview.sourceCustomer.maskedPhone ?? "-"}
                      </p>
                      <p>상태: {preview.sourceCustomer.consultStatus}</p>
                      <p>우선순위: {preview.sourceCustomer.priority}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
                  <p className="font-medium mb-2">이관 예정 데이터</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                    <span>상담 {preview.transferCounts.consultations}건</span>
                    <span>계약 {preview.transferCounts.contracts}건</span>
                    <span>후속관리 {preview.transferCounts.followUps}건</span>
                    <span>알림 {preview.transferCounts.notifications}건</span>
                    <span>
                      삭제 요청 {preview.transferCounts.deleteRequests}건
                    </span>
                    <span>
                      상태 이력 {preview.transferCounts.statusHistory}건
                    </span>
                    <span>
                      동의 이력 {preview.transferCounts.consentLogs}건
                    </span>
                    <span>
                      배정 이력 {preview.transferCounts.assignmentHistory}건
                    </span>
                  </div>
                </div>

                {preview.conflicts.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    충돌 가능 필드: {preview.conflicts.join(", ")}. 기준 고객
                    값을 유지하고 빈 값과 태그만 보완합니다.
                  </div>
                )}

                <div className="rounded-2xl border border-red-100 bg-red-50/60 p-3 text-sm text-red-800">
                  이 작업은 두 고객의 상담기록, 계약, 후속관리, 알림, 이력을
                  하나의 기준 고객으로 합칩니다. 병합 대상 고객은 비활성
                  처리되며 활동 로그에 기록됩니다. 진행하려면 “고객병합”을
                  입력하세요.
                </div>

                <div className="space-y-2">
                  <Label>병합 사유</Label>
                  <Textarea
                    className="min-h-24"
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    placeholder="예: 동일 고객 중복 등록 정리"
                  />
                </div>
                <div className="space-y-2">
                  <Label>확인 문구</Label>
                  <Input
                    className="min-h-12 rounded-xl bg-slate-50 md:min-h-9"
                    value={confirmText}
                    onChange={event => setConfirmText(event.target.value)}
                    placeholder="고객병합"
                  />
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50/60 p-3">
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      className="min-h-12 md:min-h-10"
                      onClick={resetSelection}
                    >
                      취소
                    </Button>
                    <Button
                      className="min-h-12 bg-red-700 hover:bg-red-800 md:min-h-10"
                      disabled={
                        confirmText !== "고객병합" || executeMutation.isPending
                      }
                      onClick={() =>
                        targetCustomerId &&
                        sourceCustomerId &&
                        executeMutation.mutate({
                          targetCustomerId,
                          sourceCustomerId,
                          confirmText,
                          reason: reason || undefined,
                        })
                      }
                    >
                      병합 실행
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
