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
import { canManageRetentionRisk } from "@/lib/retentionRiskPermissions";
import {
  CUSTOMER_SENTIMENT_LABELS,
  CUSTOMER_SENTIMENT_OPTIONS,
  RESOLUTION_RESULT_LABELS,
  RESOLUTION_RESULT_OPTIONS,
  RESPONSE_STRATEGY_LABELS,
  RESPONSE_STRATEGY_OPTIONS,
  RETENTION_RISK_LEVEL_BADGE_CLASSES,
  RETENTION_RISK_LEVEL_LABELS,
  RETENTION_RISK_LEVEL_OPTIONS,
  RETENTION_RISK_REASON_LABELS,
  RETENTION_RISK_REASON_OPTIONS,
  RETENTION_RISK_SENSITIVE_MEMO_NOTICE,
  RETENTION_STATUS_BADGE_CLASSES,
  RETENTION_STATUS_LABELS,
  RETENTION_STATUS_OPTIONS,
} from "@/lib/retentionRiskLabels";
import { trpc } from "@/lib/trpc";
import type {
  CustomerSentiment,
  ResolutionResult,
  ResponseStrategy,
  RetentionRiskLevel,
  RetentionRiskReason,
  RetentionStatus,
} from "@shared/retentionRisk";
import { TERMINAL_RETENTION_STATUSES } from "@shared/retentionRisk";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import { Edit2, FileCheck2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

type RetentionRiskRow = {
  id: number;
  customerId: number;
  contractId: number | null;
  riskReason: RetentionRiskReason;
  riskLevel: RetentionRiskLevel;
  retentionStatus: RetentionStatus;
  responseStrategy: ResponseStrategy;
  customerSentiment: CustomerSentiment;
  financialPressureLevel: string | null;
  competitorMentioned: boolean;
  followUpId: number | null;
  nextFollowUpAt: Date | string | null;
  resolvedAt: Date | string | null;
  resolutionResult: ResolutionResult | null;
  memo: string | null;
  updatedAt: Date | string;
};

type CustomerRetentionRiskPanelProps = {
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

function isTerminalRow(row: RetentionRiskRow) {
  return (
    TERMINAL_RETENTION_STATUSES.includes(row.retentionStatus) ||
    Boolean(row.resolvedAt)
  );
}

export function CustomerRetentionRiskPanel({
  customerId,
  pageCustomer,
  user,
}: CustomerRetentionRiskPanelProps) {
  const utils = trpc.useUtils();
  const canManage = canManageRetentionRisk(user, pageCustomer);

  const { data: cases, isLoading } =
    trpc.retentionRisk.listByCustomer.useQuery({ customerId });
  const { data: contracts } = trpc.contracts.listByCustomer.useQuery({
    customerId,
  });
  const { data: followUps } = trpc.followUps.listByCustomer.useQuery({
    customerId,
  });

  const rows = (cases ?? []) as RetentionRiskRow[];

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
  const [editTarget, setEditTarget] = useState<RetentionRiskRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<RetentionRiskRow | null>(
    null
  );
  const [resolveTarget, setResolveTarget] = useState<RetentionRiskRow | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<RetentionRiskRow | null>(
    null
  );

  const [riskReason, setRiskReason] =
    useState<RetentionRiskReason>("premium_burden");
  const [riskLevel, setRiskLevel] = useState<RetentionRiskLevel>("medium");
  const [retentionStatus, setRetentionStatus] =
    useState<RetentionStatus>("detected");
  const [responseStrategy, setResponseStrategy] =
    useState<ResponseStrategy>("wait_and_followup");
  const [customerSentiment, setCustomerSentiment] =
    useState<CustomerSentiment>("undecided");
  const [contractId, setContractId] = useState<string>("none");
  const [followUpId, setFollowUpId] = useState<string>("none");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [memo, setMemo] = useState("");
  const [resolutionResult, setResolutionResult] =
    useState<ResolutionResult>("retained");

  const invalidate = async () => {
    await utils.retentionRisk.listByCustomer.invalidate({ customerId });
    await utils.retentionRisk.summary.invalidate();
  };

  const createMutation = trpc.retentionRisk.create.useMutation({
    onSuccess: async () => {
      toast.success("해지위험 관리가 등록되었습니다.");
      setShowCreate(false);
      resetForm();
      await invalidate();
    },
    onError: error => toast.error(error.message || "등록에 실패했습니다."),
  });

  const updateMutation = trpc.retentionRisk.update.useMutation({
    onSuccess: async () => {
      toast.success("해지위험 관리가 수정되었습니다.");
      setEditTarget(null);
      await invalidate();
    },
    onError: error => toast.error(error.message || "수정에 실패했습니다."),
  });

  const changeLevelMutation = trpc.retentionRisk.changeRiskLevel.useMutation({
    onError: error =>
      toast.error(error.message || "위험 단계 변경에 실패했습니다."),
  });

  const changeStatusMutation =
    trpc.retentionRisk.changeRetentionStatus.useMutation({
      onError: error =>
        toast.error(error.message || "관리 상태 변경에 실패했습니다."),
    });

  const resolveMutation = trpc.retentionRisk.resolve.useMutation({
    onSuccess: async () => {
      toast.success("해지위험 관리가 종료 처리되었습니다.");
      setResolveTarget(null);
      await invalidate();
    },
    onError: error => toast.error(error.message || "종료 처리에 실패했습니다."),
  });

  const deleteMutation = trpc.retentionRisk.delete.useMutation({
    onSuccess: async () => {
      toast.success("해지위험 관리가 비활성화되었습니다.");
      setDeleteTarget(null);
      await invalidate();
    },
    onError: error => toast.error(error.message || "삭제에 실패했습니다."),
  });

  function resetForm() {
    setRiskReason("premium_burden");
    setRiskLevel("medium");
    setRetentionStatus("detected");
    setResponseStrategy("wait_and_followup");
    setCustomerSentiment("undecided");
    setContractId("none");
    setFollowUpId("none");
    setNextFollowUpAt("");
    setMemo("");
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit(row: RetentionRiskRow) {
    setRiskReason(row.riskReason);
    setRiskLevel(row.riskLevel);
    setRetentionStatus(row.retentionStatus);
    setResponseStrategy(row.responseStrategy);
    setCustomerSentiment(row.customerSentiment);
    setContractId(row.contractId ? String(row.contractId) : "none");
    setFollowUpId(row.followUpId ? String(row.followUpId) : "none");
    setNextFollowUpAt(toDatetimeLocalValue(row.nextFollowUpAt));
    setMemo(row.memo ?? "");
    setEditTarget(row);
  }

  function openStatusChange(row: RetentionRiskRow) {
    setRiskLevel(row.riskLevel);
    setRetentionStatus(row.retentionStatus);
    setResponseStrategy(row.responseStrategy);
    setCustomerSentiment(row.customerSentiment);
    setStatusTarget(row);
  }

  async function submitStatusChange() {
    if (!statusTarget) return;
    try {
      if (riskLevel !== statusTarget.riskLevel) {
        await changeLevelMutation.mutateAsync({
          id: statusTarget.id,
          riskLevel,
        });
      }
      if (
        retentionStatus !== statusTarget.retentionStatus ||
        responseStrategy !== statusTarget.responseStrategy ||
        customerSentiment !== statusTarget.customerSentiment
      ) {
        await changeStatusMutation.mutateAsync({
          id: statusTarget.id,
          retentionStatus,
          responseStrategy,
          customerSentiment,
        });
      }
      toast.success("해지위험 상태가 변경되었습니다.");
      setStatusTarget(null);
      await invalidate();
    } catch {
      // errors handled by mutations
    }
  }

  function submitCreate() {
    createMutation.mutate({
      customerId,
      riskReason,
      riskLevel,
      retentionStatus,
      responseStrategy,
      customerSentiment,
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
      riskReason,
      responseStrategy,
      customerSentiment,
      contractId: contractId === "none" ? null : Number(contractId),
      followUpId: followUpId === "none" ? null : Number(followUpId),
      nextFollowUpAt: nextFollowUpAt
        ? fromDatetimeLocalValue(nextFollowUpAt)
        : null,
      memo: memo.trim() ? memo.trim() : null,
    });
  }

  function renderFormFields(includeStatusFields: boolean) {
    return (
      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>해지 고민 사유</Label>
          <Select
            value={riskReason}
            onValueChange={value =>
              setRiskReason(value as RetentionRiskReason)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RETENTION_RISK_REASON_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {includeStatusFields ? (
          <>
            <div className="space-y-1">
              <Label>위험 단계</Label>
              <Select
                value={riskLevel}
                onValueChange={value =>
                  setRiskLevel(value as RetentionRiskLevel)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_RISK_LEVEL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>관리 상태</Label>
              <Select
                value={retentionStatus}
                onValueChange={value =>
                  setRetentionStatus(value as RetentionStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_STATUS_OPTIONS.map(option => (
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
          <Label>대응 방향</Label>
          <Select
            value={responseStrategy}
            onValueChange={value =>
              setResponseStrategy(value as ResponseStrategy)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESPONSE_STRATEGY_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>고객 반응</Label>
          <Select
            value={customerSentiment}
            onValueChange={value =>
              setCustomerSentiment(value as CustomerSentiment)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_SENTIMENT_OPTIONS.map(option => (
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
            rows={2}
            maxLength={500}
            placeholder="업무 메모만 입력"
          />
          <p className="text-xs text-amber-700">
            {RETENTION_RISK_SENSITIVE_MEMO_NOTICE}
          </p>
        </div>
      </div>
    );
  }

  const renderCard = (row: RetentionRiskRow) => {
    const terminal = isTerminalRow(row);

    return (
      <Card key={row.id} className="border-border/80 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RETENTION_STATUS_BADGE_CLASSES[row.retentionStatus]}`}
                >
                  {RETENTION_STATUS_LABELS[row.retentionStatus]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RETENTION_RISK_LEVEL_BADGE_CLASSES[row.riskLevel]}`}
                >
                  위험 {RETENTION_RISK_LEVEL_LABELS[row.riskLevel]}
                </span>
              </div>
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">해지 고민 사유</span>{" "}
                  {RETENTION_RISK_REASON_LABELS[row.riskReason]}
                </p>
                <p>
                  <span className="text-muted-foreground">고객 반응</span>{" "}
                  {CUSTOMER_SENTIMENT_LABELS[row.customerSentiment]}
                </p>
                <p>
                  <span className="text-muted-foreground">대응 방향</span>{" "}
                  {RESPONSE_STRATEGY_LABELS[row.responseStrategy]}
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
                    <span className="text-muted-foreground">
                      연결 후속관리
                    </span>{" "}
                    {followUpLabel.get(row.followUpId) ?? `#${row.followUpId}`}
                  </p>
                ) : null}
                {row.nextFollowUpAt ? (
                  <p>
                    <span className="text-muted-foreground">다음 확인일</span>{" "}
                    {formatKstLocalDateTime(String(row.nextFollowUpAt))}
                  </p>
                ) : null}
                {terminal && row.resolutionResult ? (
                  <p>
                    <span className="text-muted-foreground">종료 결과</span>{" "}
                    {RESOLUTION_RESULT_LABELS[row.resolutionResult]}
                  </p>
                ) : null}
                {terminal && row.resolvedAt ? (
                  <p className="text-xs text-muted-foreground">
                    종료{" "}
                    {formatKstLocalDateTime(String(row.resolvedAt))}
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                최근 업데이트 {formatKstLocalDateTime(String(row.updatedAt))}
              </p>
              {row.memo ? (
                <p className="line-clamp-2 text-sm text-slate-700">{row.memo}</p>
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
                  disabled={terminal}
                >
                  상태 변경
                </Button>
                {!terminal ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => {
                      setResolutionResult("retained");
                      setResolveTarget(row);
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
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            해지위험 관리
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            고객이 고민한 이유를 정리하고, 보장 공백과 비용 부담을 함께
            확인합니다. 고객 선택권을 존중하며 필요한 설명을 남깁니다.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            메모에는 질병명, 주민등록번호, 계약번호 원문, 보험료 원문 등
            민감정보와 압박 표현을 남기지 마세요.
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
            해지위험 관리를 불러오는 중입니다...
          </CardContent>
        </Card>
      ) : rows.length > 0 ? (
        <div className="grid gap-3">{rows.map(renderCard)}</div>
      ) : (
        <EmptyState
          title="등록된 해지위험 관리가 없습니다"
          description="해지·감액·납입 중단 등 고민 사유와 대응 이력을 추가하세요."
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>해지위험 관리 추가</DialogTitle>
            <DialogDescription>
              현재 고객 기준으로 해지위험 상태와 대응 방향을 기록합니다.
              다음 확인일을 놓치지 않도록 관리합니다.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields(true)}
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

      <Dialog open={Boolean(editTarget)} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>해지위험 관리 수정</DialogTitle>
          </DialogHeader>
          {renderFormFields(false)}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
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

      <Dialog open={Boolean(statusTarget)} onOpenChange={() => setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>해지위험 상태 변경</DialogTitle>
            <DialogDescription>
              위험 단계와 관리 상태를 기록합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>위험 단계</Label>
              <Select
                value={riskLevel}
                onValueChange={value =>
                  setRiskLevel(value as RetentionRiskLevel)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_RISK_LEVEL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>관리 상태</Label>
              <Select
                value={retentionStatus}
                onValueChange={value =>
                  setRetentionStatus(value as RetentionStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>대응 방향</Label>
              <Select
                value={responseStrategy}
                onValueChange={value =>
                  setResponseStrategy(value as ResponseStrategy)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_STRATEGY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>고객 반응</Label>
              <Select
                value={customerSentiment}
                onValueChange={value =>
                  setCustomerSentiment(value as CustomerSentiment)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_SENTIMENT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => void submitStatusChange()}
              disabled={
                changeLevelMutation.isPending || changeStatusMutation.isPending
              }
            >
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resolveTarget)} onOpenChange={() => setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>해지위험 종료 처리</DialogTitle>
            <DialogDescription>
              고객과의 상담 결과를 기록합니다. 고객 선택을 존중하는 결과를
              선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>종료 결과</Label>
            <Select
              value={resolutionResult}
              onValueChange={value =>
                setResolutionResult(value as ResolutionResult)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTION_RESULT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResolveTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() =>
                resolveTarget &&
                resolveMutation.mutate({
                  id: resolveTarget.id,
                  resolutionResult,
                })
              }
              disabled={resolveMutation.isPending}
            >
              종료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>해지위험 관리 비활성화</DialogTitle>
            <DialogDescription>
              목록에서 숨기며, 기록은 soft delete로 보존됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
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
