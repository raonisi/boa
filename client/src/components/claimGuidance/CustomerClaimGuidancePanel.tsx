import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canManageClaimGuidance } from "@/lib/claimGuidancePermissions";
import {
  CLAIM_CUSTOMER_ACTION_STATUS_LABELS,
  CLAIM_CUSTOMER_ACTION_STATUS_OPTIONS,
  CLAIM_DOCUMENT_GUIDE_STATUS_LABELS,
  CLAIM_DOCUMENT_GUIDE_STATUS_OPTIONS,
  CLAIM_GUIDANCE_CLOSED_REASON_OPTIONS,
  CLAIM_GUIDANCE_SENSITIVE_MEMO_NOTICE,
  CLAIM_GUIDANCE_STATUS_BADGE_CLASSES,
  CLAIM_GUIDANCE_STATUS_LABELS,
  CLAIM_GUIDANCE_STATUS_OPTIONS,
  CLAIM_GUIDANCE_TYPE_LABELS,
  CLAIM_GUIDANCE_TYPE_OPTIONS,
} from "@/lib/claimGuidanceLabels";
import { trpc } from "@/lib/trpc";
import type {
  ClaimCustomerActionStatus,
  ClaimDocumentGuideStatus,
  ClaimGuidanceClosedReason,
  ClaimGuidanceStatus,
  ClaimGuidanceType,
} from "@shared/claimGuidance";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import { ClipboardList, Edit2, FileCheck2, Plus, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { toast } from "sonner";

type ClaimGuidanceRow = {
  id: number;
  customerId: number;
  contractId: number | null;
  guidanceType: ClaimGuidanceType;
  guidanceStatus: ClaimGuidanceStatus;
  documentGuideStatus: ClaimDocumentGuideStatus;
  customerActionStatus: ClaimCustomerActionStatus;
  followUpId: number | null;
  nextFollowUpAt: Date | string | null;
  closedAt: Date | string | null;
  closedReason: ClaimGuidanceClosedReason | null;
  memo: string | null;
  updatedAt: Date | string;
};

type CustomerClaimGuidancePanelProps = {
  customerId: number;
  pageCustomer: {
    id: number;
    agentId?: number | null;
  };
  user: {
    id: number;
    role?: string | null;
    accountStatus?: string | null;
  } | null;
};

function toDatetimeLocalValue(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value: string) {
  if (!value.trim()) return undefined;
  return new Date(value).toISOString();
}

export function CustomerClaimGuidancePanel({
  customerId,
  pageCustomer,
  user,
}: CustomerClaimGuidancePanelProps) {
  const utils = trpc.useUtils();
  const canManage = canManageClaimGuidance(user, pageCustomer);

  const { data: cases, isLoading } = trpc.claimGuidance.listByCustomer.useQuery(
    { customerId }
  );
  const { data: contracts } = trpc.contracts.listByCustomer.useQuery({
    customerId,
  });
  const { data: followUps } = trpc.followUps.listByCustomer.useQuery({
    customerId,
  });

  const rows = (cases ?? []) as ClaimGuidanceRow[];

  const contractLabel = useMemo(() => {
    const map = new Map<number, string>();
    for (const contract of contracts ?? []) {
      const parts = [
        contract.productName || "상품 미입력",
        contract.contractDate
          ? String(contract.contractDate).slice(0, 10)
          : null,
      ].filter(Boolean);
      map.set(contract.id, parts.join(" · "));
    }
    return map;
  }, [contracts]);

  const followUpLabel = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of followUps ?? []) {
      const date = item.nextContactDate
        ? formatKstLocalDateTime(String(item.nextContactDate)).slice(0, 16)
        : "일정 없음";
      map.set(item.id, `${item.reason} · ${date}`);
    }
    return map;
  }, [followUps]);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ClaimGuidanceRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<ClaimGuidanceRow | null>(
    null
  );
  const [closeTarget, setCloseTarget] = useState<ClaimGuidanceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClaimGuidanceRow | null>(
    null
  );

  const [guidanceType, setGuidanceType] =
    useState<ClaimGuidanceType>("process_guidance");
  const [guidanceStatus, setGuidanceStatus] =
    useState<ClaimGuidanceStatus>("guidance_needed");
  const [documentGuideStatus, setDocumentGuideStatus] =
    useState<ClaimDocumentGuideStatus>("not_started");
  const [customerActionStatus, setCustomerActionStatus] =
    useState<ClaimCustomerActionStatus>("no_action");
  const [contractId, setContractId] = useState<string>("none");
  const [followUpId, setFollowUpId] = useState<string>("none");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [memo, setMemo] = useState("");
  const [closedReason, setClosedReason] =
    useState<ClaimGuidanceClosedReason>("customer_completed");

  const invalidate = async () => {
    await utils.claimGuidance.listByCustomer.invalidate({ customerId });
    await utils.claimGuidance.summary.invalidate();
  };

  const createMutation = trpc.claimGuidance.create.useMutation({
    onSuccess: async () => {
      toast.success("청구 안내가 등록되었습니다.");
      setShowCreate(false);
      resetForm();
      await invalidate();
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const updateMutation = trpc.claimGuidance.update.useMutation({
    onSuccess: async () => {
      toast.success("청구 안내가 수정되었습니다.");
      setEditTarget(null);
      await invalidate();
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const changeStatusMutation = trpc.claimGuidance.changeStatus.useMutation({
    onSuccess: async () => {
      toast.success("청구 안내 상태가 변경되었습니다.");
      setStatusTarget(null);
      await invalidate();
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const closeMutation = trpc.claimGuidance.close.useMutation({
    onSuccess: async () => {
      toast.success("청구 안내가 종료 처리되었습니다.");
      setCloseTarget(null);
      await invalidate();
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const deleteMutation = trpc.claimGuidance.delete.useMutation({
    onSuccess: async () => {
      toast.success("청구 안내를 비활성화했습니다.");
      setDeleteTarget(null);
      await invalidate();
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  function resetForm() {
    setGuidanceType("process_guidance");
    setGuidanceStatus("guidance_needed");
    setDocumentGuideStatus("not_started");
    setCustomerActionStatus("no_action");
    setContractId("none");
    setFollowUpId("none");
    setNextFollowUpAt("");
    setMemo("");
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit(row: ClaimGuidanceRow) {
    setGuidanceType(row.guidanceType);
    setGuidanceStatus(row.guidanceStatus);
    setDocumentGuideStatus(row.documentGuideStatus);
    setCustomerActionStatus(row.customerActionStatus);
    setContractId(row.contractId ? String(row.contractId) : "none");
    setFollowUpId(row.followUpId ? String(row.followUpId) : "none");
    setNextFollowUpAt(toDatetimeLocalValue(row.nextFollowUpAt));
    setMemo(row.memo ?? "");
    setEditTarget(row);
  }

  function openStatusChange(row: ClaimGuidanceRow) {
    setGuidanceStatus(row.guidanceStatus);
    setDocumentGuideStatus(row.documentGuideStatus);
    setCustomerActionStatus(row.customerActionStatus);
    setStatusTarget(row);
  }

  function submitCreate() {
    createMutation.mutate({
      customerId,
      guidanceType,
      guidanceStatus,
      documentGuideStatus,
      customerActionStatus,
      contractId: contractId === "none" ? undefined : Number(contractId),
      followUpId: followUpId === "none" ? undefined : Number(followUpId),
      nextFollowUpAt: fromDatetimeLocalValue(nextFollowUpAt),
      memo: memo.trim() || undefined,
    });
  }

  function submitEdit() {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      guidanceType,
      documentGuideStatus,
      customerActionStatus,
      contractId: contractId === "none" ? null : Number(contractId),
      followUpId: followUpId === "none" ? null : Number(followUpId),
      nextFollowUpAt: nextFollowUpAt
        ? fromDatetimeLocalValue(nextFollowUpAt)
        : null,
      memo: memo.trim() ? memo.trim() : null,
    });
  }

  function submitStatusChange() {
    if (!statusTarget) return;
    changeStatusMutation.mutate({
      id: statusTarget.id,
      guidanceStatus,
      documentGuideStatus,
      customerActionStatus,
    });
  }

  function renderFormFields() {
    return (
      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>안내 유형</Label>
          <Select
            value={guidanceType}
            onValueChange={value => setGuidanceType(value as ClaimGuidanceType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLAIM_GUIDANCE_TYPE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showCreate ? (
          <>
            <div className="space-y-1">
              <Label>청구 안내 상태</Label>
              <Select
                value={guidanceStatus}
                onValueChange={value =>
                  setGuidanceStatus(value as ClaimGuidanceStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_GUIDANCE_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
        <div className="space-y-1">
          <Label>필요서류 안내</Label>
          <Select
            value={documentGuideStatus}
            onValueChange={value =>
              setDocumentGuideStatus(value as ClaimDocumentGuideStatus)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLAIM_DOCUMENT_GUIDE_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>고객 준비 상태</Label>
          <Select
            value={customerActionStatus}
            onValueChange={value =>
              setCustomerActionStatus(value as ClaimCustomerActionStatus)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLAIM_CUSTOMER_ACTION_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>연결 계약 (선택)</Label>
          <Select value={contractId} onValueChange={setContractId}>
            <SelectTrigger>
              <SelectValue placeholder="없음" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">없음</SelectItem>
              {(contracts ?? []).map(contract => (
                <SelectItem key={contract.id} value={String(contract.id)}>
                  {contractLabel.get(contract.id) ?? `계약 #${contract.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>연결 후속관리 (선택)</Label>
          <Select value={followUpId} onValueChange={setFollowUpId}>
            <SelectTrigger>
              <SelectValue placeholder="없음" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">없음</SelectItem>
              {(followUps ?? [])
                .filter(item => !item.deletedAt)
                .map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {followUpLabel.get(item.id) ?? `후속 #${item.id}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>다음 확인일 (선택)</Label>
          <Input
            type="datetime-local"
            value={nextFollowUpAt}
            onChange={event => setNextFollowUpAt(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>짧은 메모</Label>
          <Textarea
            value={memo}
            onChange={event => setMemo(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="업무 메모만 입력"
          />
          <p className="text-xs text-amber-700">
            {CLAIM_GUIDANCE_SENSITIVE_MEMO_NOTICE}
          </p>
        </div>
      </div>
    );
  }

  const renderCard = (row: ClaimGuidanceRow) => {
    const isClosed = row.guidanceStatus === "closed" || Boolean(row.closedAt);
    const showCloseButton =
      canManage && !isClosed && row.guidanceStatus !== "completed";

    return (
      <Card key={row.id} className="border-border/80 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLAIM_GUIDANCE_STATUS_BADGE_CLASSES[row.guidanceStatus]}`}
                >
                  {CLAIM_GUIDANCE_STATUS_LABELS[row.guidanceStatus]}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {CLAIM_GUIDANCE_TYPE_LABELS[row.guidanceType]}
                </span>
              </div>
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">필요서류 안내</span>{" "}
                  {CLAIM_DOCUMENT_GUIDE_STATUS_LABELS[row.documentGuideStatus]}
                </p>
                <p>
                  <span className="text-muted-foreground">고객 준비 상태</span>{" "}
                  {
                    CLAIM_CUSTOMER_ACTION_STATUS_LABELS[
                      row.customerActionStatus
                    ]
                  }
                </p>
                {row.contractId ? (
                  <p>
                    <span className="text-muted-foreground">연결 계약</span>{" "}
                    {contractLabel.get(row.contractId) ??
                      `계약 #${row.contractId}`}
                  </p>
                ) : null}
                {row.followUpId ? (
                  <p>
                    <span className="text-muted-foreground">연결 후속관리</span>{" "}
                    {followUpLabel.get(row.followUpId) ?? `#${row.followUpId}`}
                  </p>
                ) : null}
                {row.nextFollowUpAt ? (
                  <p>
                    <span className="text-muted-foreground">다음 확인일</span>{" "}
                    {formatKstLocalDateTime(String(row.nextFollowUpAt))}
                  </p>
                ) : null}
                {isClosed ? (
                  <p className="text-xs text-muted-foreground">
                    종료{" "}
                    {row.closedAt
                      ? formatKstLocalDateTime(String(row.closedAt))
                      : ""}
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                최근 업데이트 {formatKstLocalDateTime(String(row.updatedAt))}
              </p>
              {row.memo ? (
                <p className="line-clamp-2 text-sm text-slate-700">
                  {row.memo}
                </p>
              ) : null}
            </div>
            {canManage ? (
              <div className="flex shrink-0 flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={() => openStatusChange(row)}
                  disabled={isClosed}
                >
                  상태 변경
                </Button>
                {showCloseButton ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => {
                      setClosedReason("customer_completed");
                      setCloseTarget(row);
                    }}
                  >
                    <FileCheck2 className="mr-1 h-4 w-4" />
                    종료 처리
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={() => openEdit(row)}
                >
                  <Edit2 className="mr-1 h-4 w-4" />
                  수정
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 text-rose-700"
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  비활성화
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <ClipboardList className="h-4 w-4 text-teal-600" />
            청구 안내
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            보험금 청구 대행이 아닌, 청구 관련 안내 진행 상태를 기록합니다.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10"
            onClick={openCreate}
          >
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            청구 안내를 불러오는 중입니다...
          </CardContent>
        </Card>
      ) : rows.length > 0 ? (
        <div className="grid gap-3">{rows.map(renderCard)}</div>
      ) : (
        <EmptyState
          title="등록된 청구 안내가 없습니다"
          description="청구 절차·필요서류 안내 등 진행 상태를 추가하세요."
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>청구 안내 추가</DialogTitle>
            <DialogDescription>
              현재 고객 기준으로 청구 안내 상태를 기록합니다.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={submitCreate}
              disabled={createMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={() => setEditTarget(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>청구 안내 수정</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={submitEdit}
              disabled={updateMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        onOpenChange={() => setStatusTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>청구 안내 상태 변경</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>청구 안내 상태</Label>
              <Select
                value={guidanceStatus}
                onValueChange={value =>
                  setGuidanceStatus(value as ClaimGuidanceStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_GUIDANCE_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>필요서류 안내</Label>
              <Select
                value={documentGuideStatus}
                onValueChange={value =>
                  setDocumentGuideStatus(value as ClaimDocumentGuideStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_DOCUMENT_GUIDE_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>고객 준비 상태</Label>
              <Select
                value={customerActionStatus}
                onValueChange={value =>
                  setCustomerActionStatus(value as ClaimCustomerActionStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_CUSTOMER_ACTION_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={submitStatusChange}
              disabled={changeStatusMutation.isPending}
            >
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(closeTarget)}
        onOpenChange={() => setCloseTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>청구 안내 종료</DialogTitle>
            <DialogDescription>
              종료 사유를 선택하면 상태가 종료로 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>종료 사유</Label>
            <Select
              value={closedReason}
              onValueChange={value =>
                setClosedReason(value as ClaimGuidanceClosedReason)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_GUIDANCE_CLOSED_REASON_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={() =>
                closeTarget &&
                closeMutation.mutate({
                  id: closeTarget.id,
                  closedReason,
                })
              }
              disabled={closeMutation.isPending}
            >
              종료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>청구 안내 비활성화</DialogTitle>
            <DialogDescription>
              목록에서 숨기며, 기록은 soft delete로 보존됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })
              }
              disabled={deleteMutation.isPending}
            >
              비활성화
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
