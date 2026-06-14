import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
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
import { formatExpectedPremiumManwon } from "@shared/expectedPremium";
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
}: CustomerListDesktopWorkspaceProps) {
  const showSelection = canReclaimCustomer || canBulkChangeAssignee;

  const gridClassName = showSelection
    ? "grid grid-cols-[2.5rem_minmax(220px,1.35fr)_minmax(200px,1.15fr)_minmax(180px,1fr)_minmax(120px,0.75fr)_auto] items-start gap-4 px-4 py-3"
    : "grid grid-cols-[minmax(220px,1.35fr)_minmax(200px,1.15fr)_minmax(180px,1fr)_minmax(120px,0.75fr)_auto] items-start gap-4 px-4 py-3";

  return (
    <Card className="overflow-hidden border-border shadow-sm">
      <CardContent className="p-0">
        <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
          <div className={gridClassName}>
            {showSelection ? (
              <div className="flex items-center justify-center pt-0.5">
                <Checkbox
                  checked={allVisibleSelectableSelected}
                  disabled={selectableFilteredIds.length === 0}
                  onCheckedChange={checked =>
                    onToggleAllVisibleSelectable(checked === true)
                  }
                  aria-label="화면에 보이는 고객 전체 선택"
                />
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              고객 / 상태
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              다음 조치
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              최근 활동
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              담당자
            </p>
            <p className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              const recommendation = recommendationByCustomerId.get(customer.id);
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
                  className={`${gridClassName} cursor-pointer transition-colors hover:bg-muted/25`}
                  onClick={() => onNavigate(`/customers/${customer.id}`)}
                >
                  {showSelection ? (
                    <div
                      className="flex items-start justify-center pt-1"
                      onClick={e => e.stopPropagation()}
                    >
                      <Checkbox
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

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold text-foreground">
                        {customer.name}
                      </span>
                      <StatusBadge status={customer.consultStatus} />
                      {customer.priority ? (
                        <PriorityBadge priority={customer.priority} />
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
                        <span
                          key={badge.label}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {actionTitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${execution.gradeClassName}`}
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

                  <div className="min-w-0 space-y-1.5">
                    <p className="text-sm leading-snug text-foreground">
                      {recentActivity}
                    </p>
                    {customer.expectedPremium != null ? (
                      <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                        예상 {formatExpectedPremiumManwon(customer.expectedPremium)}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0">
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
                    onClick={e => e.stopPropagation()}
                  >
                    {customer.phone ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        asChild
                        title="전화"
                      >
                        <a
                          href={`tel:${customer.phone}`}
                          onClick={e => e.stopPropagation()}
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground"
                        disabled
                        title="연락처 없음"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title="상담기록"
                      onClick={e => {
                        e.stopPropagation();
                        onNavigate(`/customers/${customer.id}?action=consult`);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title="후속 등록"
                      onClick={e => {
                        e.stopPropagation();
                        onNavigate(`/customers/${customer.id}?action=followup`);
                      }}
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title="상세 보기"
                      onClick={e => {
                        e.stopPropagation();
                        onNavigate(`/customers/${customer.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canDeactivateCustomer || isCustomerReclaimable(customer) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            title="더보기"
                          >
                            <MoreHorizontal className="h-4 w-4" />
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
                              onClick={e => onOpenReclaimCustomer(customer.id, e)}
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
