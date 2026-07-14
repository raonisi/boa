import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useIsMobile } from "@/hooks/useMobile";
import { FileText, Plus, Search, WalletCards, XCircle } from "lucide-react";
import { useState } from "react";
import {
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ContractListStatus = "loading" | "error" | "empty" | "no-result" | "ready";

export function getContractListStatus({
  isLoading,
  isError,
  totalCount,
  filteredCount,
  hasActiveFilters,
}: {
  isLoading: boolean;
  isError: boolean;
  totalCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
}): ContractListStatus {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (totalCount === 0 && hasActiveFilters) return "no-result";
  if (totalCount === 0) return "empty";
  if (filteredCount === 0 && hasActiveFilters) return "no-result";
  return "ready";
}

export default function ContractList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine">("all");
  const [requestContractId, setRequestContractId] = useState<number | null>(
    null
  );
  const [requestReason, setRequestReason] = useState("");
  const [requestMemo, setRequestMemo] = useState("");
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();
  const {
    data: contracts,
    isLoading: isContractsLoading,
    isError: isContractsError,
    refetch: refetchContracts,
  } = trpc.contracts.list.useQuery(
    user?.role === "branch_admin" ? { scope: scopeFilter } : undefined
  );

  const deactivateMutation = trpc.contracts.deactivate.useMutation({
    onSuccess: () => {
      toast.success("계약을 삭제했습니다.");
      utils.contracts.list.invalidate();
      utils.contracts.lifecycleByCustomer.invalidate();
      utils.performance.stats.invalidate();
      utils.customers.list.invalidate();
      utils.customers.segmentCounts.invalidate();
    },
    onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
  });

  const requestDeleteMutation =
    trpc.deleteRequests.createContractDeleteRequest.useMutation({
      onSuccess: () => {
        toast.success("삭제 요청이 관리자에게 전달되었습니다.");
        setRequestContractId(null);
        setRequestReason("");
        setRequestMemo("");
        utils.deleteRequests.listMyRequests.invalidate();
        utils.contracts.lifecycleByCustomer.invalidate();
      },
      onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
    });

  const canDeactivate = user?.role === "branch_admin";
  const canRequestDelete =
    user?.role === "sub_branch_admin" ||
    user?.role === "team_leader" ||
    user?.role === "member";
  const normalizedSearch = search.trim();

  const filtered = (contracts ?? []).filter(c => {
    const matchSearch =
      !normalizedSearch ||
      (c.productName ?? "").includes(normalizedSearch) ||
      (c.company ?? "").includes(normalizedSearch);
    const matchStatus =
      statusFilter === "all" || c.contractStatus === statusFilter;
    const matchPayment =
      paymentFilter === "all" || c.paymentStatus === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    statusFilter !== "all" ||
    paymentFilter !== "all" ||
    (user?.role === "branch_admin" && scopeFilter !== "all");
  const contractListStatus = getContractListStatus({
    isLoading: isContractsLoading,
    isError: isContractsError,
    totalCount: contracts?.length ?? 0,
    filteredCount: filtered.length,
    hasActiveFilters,
  });

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setScopeFilter("all");
  };

  const stateContent =
    contractListStatus === "loading" ? (
      <EmptyState
        variant="loading"
        title="계약 정보를 불러오는 중입니다."
        description="권한 범위 안의 계약 데이터를 확인하고 있습니다."
      />
    ) : contractListStatus === "error" ? (
      <ErrorState
        title="계약 정보를 불러오지 못했습니다."
        description="네트워크 또는 권한 상태를 확인한 뒤 다시 시도해 주세요."
        retryLabel="다시 시도"
        onRetry={() => refetchContracts()}
      />
    ) : contractListStatus === "empty" ? (
      <EmptyState
        icon={Plus}
        title="등록된 계약이 없습니다."
        description="고객 상세에서 계약을 등록하거나, 고객 DB에서 계약을 추가할 고객을 선택해 주세요."
        actionLabel="계약 등록"
        onAction={() => setLocation("/customers")}
      />
    ) : contractListStatus === "no-result" ? (
      <EmptyState
        icon={Search}
        title="조건에 맞는 계약이 없습니다."
        description="검색어와 필터를 조정하거나 초기화해 보세요."
        actionLabel="필터 초기화"
        onAction={resetFilters}
      />
    ) : null;

  const totalPremium = filtered
    .filter(c => c.contractStatus === "유지")
    .reduce((sum, c) => sum + (c.monthlyPremium ?? 0), 0);

  const handleDeactivate = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(
        "이 계약을 삭제하시겠습니까?\n완전 삭제가 아니라 비활성 처리됩니다.\n삭제된 계약은 기본 계약 목록과 실적 집계에서 제외됩니다.\n이 작업은 활동 로그에 기록됩니다."
      )
    ) {
      deactivateMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
                계약 업무
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                계약관리
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {user?.role === "sub_branch_admin"
                  ? "부지점장 산하 계약관리"
                  : user?.role === "team_leader"
                    ? "본인 팀 계약관리"
                    : user?.role === "member"
                      ? "내 계약관리"
                      : "전체 계약관리"}
                {" · "}
                {filtered.length}건
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[280px]">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5" /> 표시 계약
                </div>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  {filtered.length}건
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <WalletCards className="h-3.5 w-3.5" /> 월납보험료
                </div>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  {totalPremium.toLocaleString()}원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="보험사 또는 상품명 검색"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:w-36">
                  <SelectValue placeholder="계약상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {["청약", "승낙", "철회", "유지", "해지"].map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:w-36">
                  <SelectValue placeholder="결제상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {["정상", "미납", "실효", "해지"].map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {user?.role === "branch_admin" && (
                <Select
                  value={scopeFilter}
                  onValueChange={value =>
                    setScopeFilter(value as "all" | "mine")
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl sm:w-36">
                    <SelectValue placeholder="계약 범위" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 계약</SelectItem>
                    <SelectItem value="mine">내 계약</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {stateContent ? (
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="px-4 py-8 sm:px-6">
              <div className="mx-auto max-w-md">{stateContent}</div>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <div className="space-y-3">
            {filtered.map(c => (
              <Card
                key={c.id}
                className="cursor-pointer border-slate-200/80 bg-white/95 shadow-sm transition active:bg-slate-50"
                onClick={() => setLocation(`/customers/${c.customerId}`)}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {c.productName ?? "-"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.company ?? "-"} · {c.productGroup ?? "-"}
                      </p>
                    </div>
                    <StatusBadge status={c.contractStatus ?? "청약"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">고객</p>
                      <p className="font-medium">
                        {c.customerId ? `고객 #${c.customerId}` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">담당자</p>
                      <p className="font-medium">
                        {c.agentId ? `담당자 #${c.agentId}` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">계약일</p>
                      <p className="font-medium">
                        {c.contractDate
                          ? new Date(c.contractDate).toLocaleDateString("ko-KR")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">월납보험료</p>
                      <p className="font-semibold text-slate-950">
                        {c.monthlyPremium
                          ? `${c.monthlyPremium.toLocaleString()}원`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">결제상태</p>
                      <StatusBadge status={c.paymentStatus ?? "정상"} />
                    </div>
                    <div>
                      <p className="text-muted-foreground">상태</p>
                      <StatusBadge status={c.contractStatus ?? "청약"} />
                    </div>
                  </div>
                  {(canDeactivate || canRequestDelete) && (
                    <div
                      className="flex flex-wrap justify-end gap-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() =>
                          setLocation(`/customers/${c.customerId}`)
                        }
                      >
                        상세 보기
                      </Button>
                      {canDeactivate ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 text-destructive"
                          onClick={e => handleDeactivate(c.id, e)}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> 계약 삭제
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          onClick={() => setRequestContractId(c.id)}
                        >
                          삭제 요청
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead>보험사</TableHead>
                      <TableHead>상품명</TableHead>
                      <TableHead>상품군</TableHead>
                      <TableHead>계약일</TableHead>
                      <TableHead className="text-right">월납보험료</TableHead>
                      <TableHead>결제상태</TableHead>
                      <TableHead>계약상태</TableHead>
                      <TableHead>메모</TableHead>
                      {(canDeactivate || canRequestDelete) && (
                        <TableHead className="w-24" />
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer transition-colors hover:bg-slate-50"
                        onClick={() =>
                          setLocation(`/customers/${c.customerId}`)
                        }
                      >
                        <TableCell>{c.company ?? "-"}</TableCell>
                        <TableCell className="font-medium">
                          {c.productName ?? "-"}
                        </TableCell>
                        <TableCell>{c.productGroup ?? "-"}</TableCell>
                        <TableCell className="text-xs">
                          {c.contractDate
                            ? new Date(c.contractDate).toLocaleDateString(
                                "ko-KR"
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-950">
                          {c.monthlyPremium
                            ? `${c.monthlyPremium.toLocaleString()}원`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.paymentStatus ?? "정상"} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.contractStatus ?? "청약"} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                          {c.memo ?? "-"}
                        </TableCell>
                        {(canDeactivate || canRequestDelete) && (
                          <TableCell>
                            {canDeactivate ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={e => handleDeactivate(c.id, e)}
                                aria-label="계약 삭제"
                              >
                                <XCircle
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={e => {
                                  e.stopPropagation();
                                  setRequestContractId(c.id);
                                }}
                              >
                                삭제 요청
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={requestContractId !== null}
        onOpenChange={open => {
          if (!open) setRequestContractId(null);
        }}
      >
        <DialogContent className="flex max-h-[min(85dvh,40rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>계약 삭제 요청</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">
              이 계약의 삭제를 관리자에게 요청합니다. 승인되면 해당 계약은
              비활성 처리되며, 실적 집계에서 제외됩니다.
            </p>
            <div>
              <Label>요청 사유 *</Label>
              <Select value={requestReason} onValueChange={setRequestReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="사유 선택" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "중복 입력",
                    "오입력",
                    "계약 취소",
                    "테스트 입력",
                    "기타",
                  ].map(reason => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>상세 메모</Label>
              <Textarea
                value={requestMemo}
                onChange={e => setRequestMemo(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
            <Button
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={() => setRequestContractId(null)}
            >
              취소
            </Button>
            <Button
              className="min-h-11 sm:min-h-9"
              disabled={!requestReason || requestDeleteMutation.isPending}
              onClick={() =>
                requestContractId &&
                requestDeleteMutation.mutate({
                  contractId: requestContractId,
                  requestReason,
                  requestMemo: requestMemo || undefined,
                })
              }
            >
              삭제 요청 보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
