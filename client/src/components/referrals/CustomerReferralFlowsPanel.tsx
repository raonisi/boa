import { StatusBadge } from "@/components/StatusBadge";
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
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { canManageReferralFlow } from "@/lib/referralFlowPermissions";
import {
  INTRODUCTION_METHOD_LABELS,
  REFERRAL_RESULT_BADGE_CLASSES,
  REFERRAL_RESULT_STATUS_LABELS,
  REFERRAL_SENSITIVE_MEMO_NOTICE,
  REFERRAL_SOURCE_TYPE_LABELS,
  REFERRAL_STAGE_BADGE_CLASSES,
  REFERRAL_STAGE_LABELS,
  REFERRAL_STAGE_OPTIONS,
  REFERRAL_THANK_YOU_BADGE_CLASSES,
  THANK_YOU_STATUS_LABELS,
} from "@/lib/referralFlowLabels";
import { formatUserWithRole } from "@/lib/userRole";
import { trpc } from "@/lib/trpc";
import {
  INTRODUCTION_METHODS,
  REFERRAL_SOURCE_TYPES,
  REFERRAL_STAGES,
  THANK_YOU_STATUSES,
  type IntroductionMethod,
  type ReferralSourceType,
  type ReferralStage,
  type ThankYouStatus,
} from "@shared/customerReferrals";
import { REFERRAL_ELIGIBLE_RELATIONSHIP_TYPES } from "@shared/customerReferrals";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import {
  CheckCircle2,
  Edit2,
  GitBranch,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toastUserFacingError, USER_FACING_ERRORS } from "@/lib/userFacingMessages";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ReferralRow = {
  id: number;
  relationshipId: number;
  referrerCustomerId: number;
  referredCustomerId: number;
  referralStage: ReferralStage;
  referralSourceType: ReferralSourceType;
  introductionMethod: IntroductionMethod | null;
  thankYouStatus: ThankYouStatus;
  thankYouCompletedAt: Date | string | null;
  resultStatus: string;
  memo: string | null;
  updatedAt: Date | string;
};

type CustomerReferralFlowsPanelProps = {
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

export function CustomerReferralFlowsPanel({
  customerId,
  pageCustomer,
  user,
}: CustomerReferralFlowsPanelProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const canManageDefault = canManageReferralFlow(user, pageCustomer, customerId);

  const { data: referrals, isLoading } =
    trpc.customerReferrals.listByCustomer.useQuery({ customerId });
  const { data: relationships } = trpc.customerRelationships.list.useQuery({
    customerId,
  });
  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: Boolean(user?.role && user.role !== "member"),
  });

  const referralRows = (referrals ?? []) as ReferralRow[];
  const customerIds = useMemo(
    () =>
      Array.from(
        new Set(
          referralRows.flatMap(row => [
            row.referrerCustomerId,
            row.referredCustomerId,
          ])
        )
      ),
    [referralRows]
  );
  const { lookup: customerLookup, isLoading: isLookupLoading } =
    useCustomerLookup(customerIds);

  const introducedBy = referralRows.filter(
    row => row.referrerCustomerId === customerId
  );
  const introducedTo = referralRows.filter(
    row => row.referredCustomerId === customerId
  );

  const [createDirection, setCreateDirection] = useState<
    "introduced_by" | "introduced_to"
  >("introduced_by");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ReferralRow | null>(null);
  const [stageTarget, setStageTarget] = useState<ReferralRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReferralRow | null>(null);

  const [search, setSearch] = useState("");
  const [selectedOtherCustomerId, setSelectedOtherCustomerId] = useState<
    number | null
  >(null);
  const [referralSourceType, setReferralSourceType] =
    useState<ReferralSourceType>("customer_referral");
  const [introductionMethod, setIntroductionMethod] =
    useState<IntroductionMethod>("phone");
  const [referralStage, setReferralStage] = useState<ReferralStage>("introduced");
  const [thankYouStatus, setThankYouStatus] =
    useState<ThankYouStatus>("pending");
  const [memo, setMemo] = useState("");
  const [stageValue, setStageValue] = useState<ReferralStage>("introduced");

  const trimmedSearch = search.trim();
  const { data: searchResult, isFetching: isSearching } =
    trpc.customerReferrals.searchCustomers.useQuery(
      {
        anchorCustomerId: customerId,
        search: trimmedSearch,
        limit: 20,
      },
      { enabled: showCreateModal && trimmedSearch.length >= 2 }
    );

  const createMutation = trpc.customerReferrals.create.useMutation({
    onSuccess: async () => {
      toast.success("소개 흐름이 등록되었습니다.");
      setShowCreateModal(false);
      resetCreateForm();
      await utils.customerReferrals.listByCustomer.invalidate({ customerId });
    },
    onError: error => toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const updateMutation = trpc.customerReferrals.update.useMutation({
    onSuccess: async () => {
      toast.success("소개 흐름이 수정되었습니다.");
      setEditTarget(null);
      await utils.customerReferrals.listByCustomer.invalidate({ customerId });
    },
    onError: error => toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const changeStageMutation = trpc.customerReferrals.changeStage.useMutation({
    onSuccess: async () => {
      toast.success("소개 단계가 변경되었습니다.");
      setStageTarget(null);
      await utils.customerReferrals.listByCustomer.invalidate({ customerId });
    },
    onError: error => toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const thankYouMutation = trpc.customerReferrals.completeThankYou.useMutation({
    onSuccess: async () => {
      toast.success("감사 연락이 완료 처리되었습니다.");
      await utils.customerReferrals.listByCustomer.invalidate({ customerId });
    },
    onError: error =>
      toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  const deleteMutation = trpc.customerReferrals.delete.useMutation({
    onSuccess: async () => {
      toast.success("소개 흐름이 삭제되었습니다.");
      setDeleteTarget(null);
      await utils.customerReferrals.listByCustomer.invalidate({ customerId });
    },
    onError: error => toastUserFacingError(error, USER_FACING_ERRORS.saveFailed, "customer"),
  });

  function resetCreateForm() {
    setSearch("");
    setSelectedOtherCustomerId(null);
    setReferralSourceType("customer_referral");
    setIntroductionMethod("phone");
    setReferralStage("introduced");
    setThankYouStatus("pending");
    setMemo("");
  }

  useEffect(() => {
    if (!showCreateModal) resetCreateForm();
  }, [showCreateModal]);

  useEffect(() => {
    if (!editTarget) return;
    setReferralSourceType(editTarget.referralSourceType);
    setIntroductionMethod(editTarget.introductionMethod ?? "phone");
    setThankYouStatus(editTarget.thankYouStatus);
    setMemo(editTarget.memo ?? "");
  }, [editTarget]);

  useEffect(() => {
    if (!stageTarget) return;
    setStageValue(stageTarget.referralStage);
  }, [stageTarget]);

  function resolveRelationshipId(otherCustomerId: number) {
    const match = (relationships ?? []).find(item => {
      if (item.relatedCustomer.id !== otherCustomerId) return false;
      return REFERRAL_ELIGIBLE_RELATIONSHIP_TYPES.includes(
        item.relationshipType as (typeof REFERRAL_ELIGIBLE_RELATIONSHIP_TYPES)[number]
      );
    });
    return match?.id ?? null;
  }

  function openCreate(direction: "introduced_by" | "introduced_to") {
    setCreateDirection(direction);
    resetCreateForm();
    setShowCreateModal(true);
  }

  function submitCreate() {
    if (!selectedOtherCustomerId) {
      toast.error("연결할 고객을 선택해 주세요.");
      return;
    }
    const referrerCustomerId =
      createDirection === "introduced_by"
        ? customerId
        : selectedOtherCustomerId;
    const referredCustomerId =
      createDirection === "introduced_by"
        ? selectedOtherCustomerId
        : customerId;
    const relationshipId = resolveRelationshipId(selectedOtherCustomerId);
    if (!relationshipId) {
      toast.error(
        "먼저 ‘연결 고객’ 탭에서 소개 관계를 등록한 뒤 다시 시도해 주세요."
      );
      return;
    }
    createMutation.mutate({
      relationshipId,
      referrerCustomerId,
      referredCustomerId,
      anchorCustomerId: customerId,
      referralSourceType,
      introductionMethod,
      referralStage,
      thankYouStatus,
      memo: memo.trim() || undefined,
    });
  }

  const agentName = (agentId: number | null | undefined) => {
    if (!agentId) return "미배정";
    const agent = users?.find(entry => entry.id === agentId);
    return agent ? formatUserWithRole(agent) : `#${agentId}`;
  };

  const renderCard = (
    row: ReferralRow,
    otherCustomerId: number,
    section: "introduced_by" | "introduced_to"
  ) => {
    const other = customerLookup[otherCustomerId];
    const canManage = canManageReferralFlow(user, pageCustomer, customerId);
    const showThankYouButton =
      canManage &&
      row.thankYouStatus === "pending" &&
      section === "introduced_by";

    return (
      <Card key={row.id} className="border-border/80 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REFERRAL_STAGE_BADGE_CLASSES[row.referralStage]}`}
                >
                  {REFERRAL_STAGE_LABELS[row.referralStage]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REFERRAL_RESULT_BADGE_CLASSES[row.resultStatus as keyof typeof REFERRAL_RESULT_BADGE_CLASSES] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {REFERRAL_RESULT_STATUS_LABELS[row.resultStatus as keyof typeof REFERRAL_RESULT_STATUS_LABELS] ?? row.resultStatus}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REFERRAL_THANK_YOU_BADGE_CLASSES[row.thankYouStatus]}`}
                >
                  감사 {THANK_YOU_STATUS_LABELS[row.thankYouStatus]}
                </span>
              </div>
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">소개자</span>{" "}
                  <span className="font-medium">
                    {customerLookup[row.referrerCustomerId]?.name ??
                      `#${row.referrerCustomerId}`}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">피소개자</span>{" "}
                  <span className="font-medium">
                    {customerLookup[row.referredCustomerId]?.name ??
                      `#${row.referredCustomerId}`}
                  </span>
                </p>
              </div>
              {other ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={other.consultStatus} />
                  <span className="text-xs text-muted-foreground">
                    담당 {agentName(other.agentId)}
                  </span>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                최근 업데이트 {formatKstLocalDateTime(String(row.updatedAt))}
                {row.thankYouCompletedAt
                  ? ` · 감사 완료 ${formatKstLocalDateTime(String(row.thankYouCompletedAt))}`
                  : ""}
              </p>
              {row.memo ? (
                <p className="line-clamp-2 text-sm text-slate-700">{row.memo}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10"
                onClick={() => setLocation(`/customers/${otherCustomerId}`)}
              >
                <UserRound className="mr-1 h-4 w-4" />
                상세
              </Button>
              {canManage ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => setStageTarget(row)}
                  >
                    단계 변경
                  </Button>
                  {showThankYouButton ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10 text-emerald-700"
                      onClick={() =>
                        thankYouMutation.mutate({
                          id: row.id,
                          anchorCustomerId: customerId,
                        })
                      }
                      disabled={thankYouMutation.isPending}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      감사 완료
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => setEditTarget(row)}
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
                    삭제
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSection = (
    title: string,
    description: string,
    rows: ReferralRow[],
    direction: "introduced_by" | "introduced_to"
  ) => (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {canManageDefault ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10"
            onClick={() => openCreate(direction)}
          >
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map(row =>
            renderCard(
              row,
              direction === "introduced_by"
                ? row.referredCustomerId
                : row.referrerCustomerId,
              direction
            )
          )}
        </div>
      ) : (
        <EmptyState
          title="등록된 소개 흐름이 없습니다"
          description="고객 DB에 피소개자를 등록하고 연결 고객 관계를 만든 뒤 소개 흐름을 추가하세요."
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <GitBranch className="h-4 w-4 text-indigo-600" />
          소개 흐름
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          PR20 연결 고객 관계를 기반으로 소개 단계와 감사 연락을 관리합니다.
        </p>
      </div>

      {isLoading || isLookupLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            소개 흐름을 불러오는 중입니다...
          </CardContent>
        </Card>
      ) : (
        <>
          {renderSection(
            "이 고객이 소개한 고객",
            "현재 고객이 소개자인 흐름입니다.",
            introducedBy,
            "introduced_by"
          )}
          {renderSection(
            "이 고객을 소개한 고객",
            "현재 고객이 피소개자인 흐름입니다.",
            introducedTo,
            "introduced_to"
          )}
        </>
      )}

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>소개 흐름 추가</DialogTitle>
            <DialogDescription>
              {createDirection === "introduced_by"
                ? "이 고객이 소개한 피소개자를 선택하세요."
                : "이 고객을 소개한 소개자를 선택하세요."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>고객 검색</Label>
              <Input
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setSelectedOtherCustomerId(null);
                }}
                placeholder="고객명 2자 이상"
              />
              {searchResult?.items?.length ? (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {searchResult.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                        selectedOtherCustomerId === item.id
                          ? "bg-indigo-50 text-indigo-900"
                          : ""
                      }`}
                      onClick={() => setSelectedOtherCustomerId(item.id)}
                    >
                      <span className="font-medium">{item.name}</span>
                      <StatusBadge status={item.consultStatus} />
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedOtherCustomerId &&
              !resolveRelationshipId(selectedOtherCustomerId) ? (
                <p className="text-xs text-amber-700">
                  선택한 고객과의 연결 관계가 없습니다. ‘연결 고객’ 탭에서
                  소개 관계를 먼저 등록해 주세요.
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>소개 방식</Label>
                <Select
                  value={introductionMethod}
                  onValueChange={value =>
                    setIntroductionMethod(value as IntroductionMethod)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTRODUCTION_METHODS.map(method => (
                      <SelectItem key={method} value={method}>
                        {INTRODUCTION_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>소개 유형</Label>
                <Select
                  value={referralSourceType}
                  onValueChange={value =>
                    setReferralSourceType(value as ReferralSourceType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_SOURCE_TYPES.map(type => (
                      <SelectItem key={type} value={type}>
                        {REFERRAL_SOURCE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>소개 단계</Label>
                <Select
                  value={referralStage}
                  onValueChange={value =>
                    setReferralStage(value as ReferralStage)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_STAGES.map(stage => (
                      <SelectItem key={stage} value={stage}>
                        {REFERRAL_STAGE_LABELS[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>감사 연락</Label>
                <Select
                  value={thankYouStatus}
                  onValueChange={value =>
                    setThankYouStatus(value as ThankYouStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THANK_YOU_STATUSES.map(status => (
                      <SelectItem key={status} value={status}>
                        {THANK_YOU_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea
                value={memo}
                onChange={event => setMemo(event.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-amber-700">{REFERRAL_SENSITIVE_MEMO_NOTICE}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={submitCreate}
              disabled={createMutation.isPending || isSearching}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={open => !open && setEditTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>소개 흐름 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>소개 유형</Label>
                <Select
                  value={referralSourceType}
                  onValueChange={value =>
                    setReferralSourceType(value as ReferralSourceType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_SOURCE_TYPES.map(type => (
                      <SelectItem key={type} value={type}>
                        {REFERRAL_SOURCE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>감사 연락</Label>
                <Select
                  value={thankYouStatus}
                  onValueChange={value =>
                    setThankYouStatus(value as ThankYouStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THANK_YOU_STATUSES.map(status => (
                      <SelectItem key={status} value={status}>
                        {THANK_YOU_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea
                value={memo}
                onChange={event => setMemo(event.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-amber-700">{REFERRAL_SENSITIVE_MEMO_NOTICE}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!editTarget) return;
                updateMutation.mutate({
                  id: editTarget.id,
                  anchorCustomerId: customerId,
                  referralSourceType,
                  thankYouStatus,
                  memo: memo.trim() ? memo.trim() : null,
                });
              }}
              disabled={updateMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(stageTarget)}
        onOpenChange={open => !open && setStageTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>소개 단계 변경</DialogTitle>
          </DialogHeader>
          <Select
            value={stageValue}
            onValueChange={value => setStageValue(value as ReferralStage)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFERRAL_STAGE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStageTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!stageTarget) return;
                changeStageMutation.mutate({
                  id: stageTarget.id,
                  anchorCustomerId: customerId,
                  referralStage: stageValue,
                });
              }}
              disabled={changeStageMutation.isPending}
            >
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>소개 흐름 삭제</DialogTitle>
            <DialogDescription>
              삭제된 소개 흐름은 목록에서 제외되며 이력에는 기록만 남습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate({
                  id: deleteTarget.id,
                  anchorCustomerId: customerId,
                });
              }}
              disabled={deleteMutation.isPending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
