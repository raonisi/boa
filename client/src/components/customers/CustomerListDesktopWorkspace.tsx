import {
  StatusBadge,
  PriorityBadge,
  ExecutionBadge,
} from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  buildListExecution,
  executionBadges,
  formatCustomerRecentActivity,
  maskPhone,
  nextExecutionAction,
} from "@/components/customers/customerListExecutionHelpers";
import { formatUserWithRole } from "@/lib/userRole";
import { cn } from "@/lib/utils";
import type { CustomerListSort } from "@/lib/customerListUrlState";
import { formatExpectedPremiumManwon } from "@shared/expectedPremium";
import {
  CUSTOMER_SEGMENT_LABELS,
  type CustomerSegment,
} from "@shared/customerSegment";
import {
  CalendarPlus,
  Eye,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Search,
  Trash2,
  Undo2,
  UserPlus,
  Zap,
} from "lucide-react";

function formatCurrencyNumber(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return amount.toLocaleString("ko-KR");
}

function formatShortDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function customerSegmentTone(segment?: CustomerSegment) {
  if (segment === "contracted")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function customerSegmentLabel(customer: any) {
  const segment = customer.customerSegment as CustomerSegment | undefined;
  return segment ? CUSTOMER_SEGMENT_LABELS[segment] : "계약 없음";
}

type CustomerListDesktopWorkspaceProps = {
  customers: any[];
  recommendationByCustomerId: Map<number, any>;
  agentById: Map<number, any>;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  canCreateCustomer: boolean;
  canDeactivateCustomer: boolean;
  canReclaimCustomer: boolean;
  canBulkChangeAssignee: boolean;
  selectableFilteredIds: number[];
  selectedCustomerIds: number[];
  allVisibleSelectableSelected: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  onCreateCustomer: () => void;
  onNavigate: (path: string) => void;
  onToggleAllVisibleSelectable: (checked: boolean) => void;
  onToggleCustomerSelection: (customerId: number, checked: boolean) => void;
  onOpenReclaimCustomer: (customerId: number, e: React.MouseEvent) => void;
  onDeactivateCustomer: (customerId: number, e: React.MouseEvent) => void;
  onQuickConsult: (customer: any) => void;
  isCustomerReclaimable: (customer: any) => boolean;
  relationFlags?: Record<number, boolean>;
  sortMode: CustomerListSort;
};

export function CustomerListDesktopWorkspace({
  customers,
  recommendationByCustomerId,
  agentById,
  isLoading,
  isError,
  hasActiveFilters,
  canCreateCustomer,
  canDeactivateCustomer,
  canReclaimCustomer,
  canBulkChangeAssignee,
  selectableFilteredIds,
  selectedCustomerIds,
  allVisibleSelectableSelected,
  onRetry,
  onClearFilters,
  onCreateCustomer,
  onNavigate,
  onToggleAllVisibleSelectable,
  onToggleCustomerSelection,
  onOpenReclaimCustomer,
  onDeactivateCustomer,
  onQuickConsult,
  isCustomerReclaimable,
  relationFlags,
  sortMode,
}: CustomerListDesktopWorkspaceProps) {
  const showSelection = canReclaimCustomer || canBulkChangeAssignee;

  const gridClassName = showSelection
    ? "grid grid-cols-[2.5rem_minmax(220px,1.35fr)_minmax(200px,1.15fr)_minmax(180px,1fr)_minmax(120px,0.75fr)_auto] items-start gap-4 px-4 py-3"
    : "grid grid-cols-[minmax(220px,1.35fr)_minmax(200px,1.15fr)_minmax(180px,1fr)_minmax(120px,0.75fr)_auto] items-start gap-4 px-4 py-3";

  return (
    <Card className="overflow-x-auto border-border shadow-sm">
      <CardContent
        className="min-w-[1080px] p-0"
        role="table"
        aria-label="고객 표 보기"
      >
        <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
          <div className={gridClassName} role="row">
            {showSelection ? (
              <div
                className="flex items-center justify-center pt-0.5"
                role="columnheader"
              >
                <Checkbox
                  touchTarget
                  checked={allVisibleSelectableSelected}
                  disabled={selectableFilteredIds.length === 0}
                  onCheckedChange={checked =>
                    onToggleAllVisibleSelectable(checked === true)
                  }
                  aria-label="화면에 보이는 고객 전체 선택"
                />
              </div>
            ) : null}
            <p
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              role="columnheader"
              aria-sort={sortMode === "name" ? "ascending" : "none"}
            >
              고객 / 상태
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" role="columnheader">
              다음 조치
            </p>
            <p
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              role="columnheader"
              aria-sort={sortMode === "recent" ? "descending" : "none"}
            >
              최근 활동
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" role="columnheader">
              담당자
            </p>
            <p className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground" role="columnheader">
              빠른 액션
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 py-14">
            <EmptyState
              variant="loading"
              title="고객 목록을 불러오는 중입니다."
              description="권한 범위 안의 고객 데이터를 확인하고 있습니다."
              className="mx-auto max-w-md border-0 bg-transparent py-0"
            />
          </div>
        ) : isError ? (
          <div className="px-4 py-14">
            <ErrorState
              title="고객 목록을 불러오지 못했습니다."
              description="고객이 없는 상태와 구분해 표시하고 있습니다. 잠시 후 다시 시도해 주세요."
              retryLabel="다시 시도"
              onRetry={onRetry}
              className="mx-auto max-w-md border-0 bg-transparent py-0"
            />
          </div>
        ) : customers.length === 0 ? (
          <div className="px-4 py-14">
            <EmptyState
              icon={hasActiveFilters ? Search : UserPlus}
              title={
                hasActiveFilters
                  ? "현재 필터에 맞는 고객이 없습니다."
                  : "표시할 고객이 없습니다."
              }
              description={
                hasActiveFilters
                  ? "조건을 조금 넓혀 다시 확인해 주세요."
                  : "권한 범위 안에서 확인할 수 있는 고객이 없습니다."
              }
              className="mx-auto max-w-md border-0 bg-transparent py-0"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClearFilters}
                    >
                      필터 초기화
                    </Button>
                  ) : null}
                  {canCreateCustomer ? (
                    <Button type="button" size="sm" onClick={onCreateCustomer}>
                      신규 고객 등록
                    </Button>
                  ) : null}
                </div>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {customers.map(customer => {
              const recommendation = recommendationByCustomerId.get(
                customer.id
              );
              const badges = executionBadges(customer, recommendation);
              const execution = buildListExecution(customer, recommendation);
              const actionTitle =
                execution.actionTitle ||
                nextExecutionAction(customer, recommendation);
              const recentActivity = formatCustomerRecentActivity(
                customer,
                recommendation
              );
              const assigneeLabel = formatUserWithRole(
                agentById.get(customer.agentId ?? 0)
              );

              return (
                <div
                  key={customer.id}
                  data-customer-id={customer.id}
                  role="row"
                  tabIndex={0}
                  aria-label={`${customer.name} 고객 상세 보기`}
                  className={`${gridClassName} cursor-pointer transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset`}
                  onClick={() => onNavigate(`/customers/${customer.id}`)}
                  onKeyDown={event => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onNavigate(`/customers/${customer.id}`);
                  }}
                >
                  {showSelection ? (
                    <div
                      className="-ml-2 -mt-2 flex items-start justify-center sm:m-0"
                      role="cell"
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => e.stopPropagation()}
                    >
                      <Checkbox
                        touchTarget
                        checked={selectedCustomerIds.includes(customer.id)}
                        disabled={!selectableFilteredIds.includes(customer.id)}
                        onCheckedChange={checked =>
                          onToggleCustomerSelection(
                            customer.id,
                            checked === true
                          )
                        }
                        aria-label={`${customer.name} 고객 선택`}
                      />
                    </div>
                  ) : null}

                  <div className="min-w-0 space-y-2" role="cell">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold text-foreground">
                        {customer.name}
                      </span>
                      <StatusBadge status={customer.consultStatus} />
                      <span
                        data-testid="customer-segment-badge"
                        className={cn(
                          "inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                          customerSegmentTone(customer.customerSegment)
                        )}
                      >
                        {customerSegmentLabel(customer)}
                      </span>
                      {customer.priority ? (
                        <PriorityBadge priority={customer.priority} />
                      ) : null}
                      {relationFlags?.[customer.id] ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          연결
                        </span>
                      ) : null}
                    </div>
                    {customer.phone ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {maskPhone(customer.phone)}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      {badges.slice(0, 3).map(badge => (
                        <ExecutionBadge
                          key={badge.label}
                          label={badge.label}
                          urgency={badge.urgency}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-2" role="cell">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {actionTitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${execution.gradeClassName}`}
                      >
                        관리점수 {execution.score}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {execution.grade}
                      </span>
                    </div>
                    {recommendation?.warnings?.[0] ? (
                      <p className="text-xs leading-snug text-destructive">
                        {recommendation.warnings[0].message}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0 space-y-1.5" role="cell">
                    <p className="text-sm leading-snug text-foreground">
                      {recentActivity}
                    </p>
                    {customer.expectedPremium != null ? (
                      <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                        예상{" "}
                        {formatExpectedPremiumManwon(customer.expectedPremium)}
                      </p>
                    ) : null}
                    {customer.customerSegment === "contracted" ? (
                      <p className="text-xs font-semibold tabular-nums text-emerald-700">
                        계약 {customer.contractCount ?? 0}건 · 월납{" "}
                        {formatCurrencyNumber(customer.monthlyPremiumTotal)} ·
                        최근 {formatShortDate(customer.recentContractDate)}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold tabular-nums text-slate-600">
                        배정 DB · 배정일 {formatShortDate(customer.assignedDate)}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0" role="cell">
                    <p className="text-sm font-medium text-foreground">
                      {assigneeLabel}
                    </p>
                    {customer.region ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {customer.region}
                      </p>
                    ) : null}
                  </div>

                  <div
                    className="flex items-center justify-end gap-0.5"
                    role="cell"
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}
                  >
                    {customer.phone ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        asChild
                      >
                        <a
                          href={`tel:${customer.phone}`}
                          aria-label="전화 걸기"
                          onClick={e => e.stopPropagation()}
                        >
                          <Phone className="h-4 w-4" aria-hidden="true" />
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground"
                        disabled
                        aria-label="연락처 없음"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label="상담기록"
                      onClick={e => {
                        e.stopPropagation();
                        onNavigate(`/customers/${customer.id}?action=consult`);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label="후속 등록"
                      onClick={e => {
                        e.stopPropagation();
                        onNavigate(
                          `/customers/${customer.id}?action=quick-followup`
                        );
                      }}
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label="고객 상세 보기"
                      onClick={e => {
                        e.stopPropagation();
                        onNavigate(`/customers/${customer.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {canDeactivateCustomer ||
                    isCustomerReclaimable(customer) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            aria-label="고객 작업 메뉴"
                          >
                            <MoreHorizontal
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onQuickConsult(customer)}
                            className="font-medium text-primary"
                          >
                            <Zap className="mr-2 h-4 w-4" /> 퀵 상담 기록
                          </DropdownMenuItem>
                          {isCustomerReclaimable(customer) ? (
                            <DropdownMenuItem
                              onClick={e =>
                                onOpenReclaimCustomer(customer.id, e)
                              }
                            >
                              <Undo2 className="mr-2 h-4 w-4" /> DB 회수
                            </DropdownMenuItem>
                          ) : null}
                          {canDeactivateCustomer ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={e =>
                                onDeactivateCustomer(customer.id, e)
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> 고객 삭제
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
