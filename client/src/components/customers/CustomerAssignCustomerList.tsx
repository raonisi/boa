import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAssignmentStatusLabel } from "@/components/customers/customerAssignLabels";
import { useIsMobile } from "@/hooks/useMobile";
import { WORKFLOW_COPY } from "@/lib/assignmentWorkflowCopy";
import { cn } from "@/lib/utils";
import { Filter, Search, X } from "lucide-react";
import React, { useState } from "react";

export type CustomerAssignRow = {
  id: number;
  name: string;
  phone?: string | null;
  region?: string | null;
  source?: string | null;
  consultStatus?: string | null;
  createdAt: string | Date;
  assignmentStatus?: string | null;
};

type CustomerAssignCustomerListProps = {
  customers: CustomerAssignRow[];
  totalCount: number;
  selected: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  statusOptions: string[];
  sourceOptions: string[];
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  workflowKind?: "dbAssignment" | "dbDistribution";
  listBottomPadding?: boolean;
};

export function CustomerAssignCustomerList({
  customers,
  totalCount,
  selected,
  onToggle,
  onToggleAll,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  statusOptions,
  sourceOptions,
  title,
  emptyTitle,
  emptyDescription,
  workflowKind = "dbAssignment",
  listBottomPadding = false,
}: CustomerAssignCustomerListProps) {
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    Boolean(search.trim()) || statusFilter !== "all" || sourceFilter !== "all";

  const allVisibleSelected =
    customers.length > 0 &&
    customers.every(customer => selected.includes(customer.id));

  const workflowBadge =
    workflowKind === "dbDistribution" ? "DB 배분 대상" : "DB 배정 대상";

  const filterFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">상담상태</Label>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="min-h-11 h-11">
            <SelectValue placeholder="상담상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">상담상태 전체</SelectItem>
            {statusOptions.map(status => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">유입경로</Label>
        <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
          <SelectTrigger className="min-h-11 h-11">
            <SelectValue placeholder="유입경로" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">유입경로 전체</SelectItem>
            {sourceOptions.map(source => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const summaryBar = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <span>전체 {totalCount}건</span>
      <span>필터 결과 {customers.length}건</span>
      <span>선택 {selected.length}건</span>
      {selected.length > 0 && (
        <span className="font-medium text-emerald-700">
          총 {selected.length}건이 {workflowBadge}입니다.
        </span>
      )}
    </div>
  );

  return (
    <Card className={cn(listBottomPadding && "mb-24 md:mb-0")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div
          className={cn(
            "grid gap-2",
            isMobile
              ? "grid-cols-1"
              : "lg:grid-cols-[minmax(0,1fr)_180px_180px]"
          )}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => onSearchChange(event.target.value)}
              className={cn("pl-9", isMobile ? "min-h-11 h-11" : "h-9")}
              placeholder="고객명, 지역, 유입경로 검색"
            />
          </div>
          {isMobile ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={hasActiveFilters ? "default" : "outline"}
                className="min-h-11 flex-1"
                onClick={() => setShowFilters(true)}
              >
                <Filter className="mr-1.5 h-4 w-4" aria-hidden="true" />
                필터{hasActiveFilters ? " ●" : ""}
              </Button>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 shrink-0"
                  onClick={() => {
                    onSearchChange("");
                    onStatusFilterChange("all");
                    onSourceFilterChange("all");
                  }}
                >
                  초기화
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="상담상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">상담상태 전체</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="유입경로" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">유입경로 전체</SelectItem>
                  {sourceOptions.map(source => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {isMobile && hasActiveFilters ? (
          <div className="flex flex-wrap gap-1.5">
            {search.trim() ? (
              <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                검색: {search.trim()}
              </span>
            ) : null}
            {statusFilter !== "all" ? (
              <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                상담상태: {statusFilter}
              </span>
            ) : null}
            {sourceFilter !== "all" ? (
              <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                유입경로: {sourceFilter}
              </span>
            ) : null}
          </div>
        ) : null}

        {summaryBar}

        {isMobile ? (
          <div className="space-y-3">
            {customers.length === 0 ? (
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                className="border-dashed bg-muted/20 py-8"
              />
            ) : (
              customers.map(customer => {
                const isSelected = selected.includes(customer.id);
                return (
                  <Card
                    key={customer.id}
                    className={cn(
                      "overflow-hidden border-border shadow-sm transition-colors",
                      isSelected ? "border-primary/40 bg-primary/5" : "bg-card"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center -ml-2 -mt-2 sm:m-0 sm:min-h-0 sm:min-w-0" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggle(customer.id)}
                            aria-label="고객 선택"
                            className="mt-0.5 sm:mt-0"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="min-w-0 truncate text-base font-semibold text-foreground">
                              {customer.name}
                            </span>
                            <StatusBadge
                              status={customer.consultStatus ?? "-"}
                            />
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>
                              <span className="font-medium text-foreground">
                                현재 담당:
                              </span>{" "}
                              {formatAssignmentStatusLabel(
                                customer.assignmentStatus
                              )}
                            </p>
                            <p>
                              <span className="font-medium text-foreground">
                                업무:
                              </span>{" "}
                              {workflowBadge}
                            </p>
                            {customer.region ? (
                              <p className="truncate">
                                지역: {customer.region}
                              </p>
                            ) : null}
                            {customer.source ? (
                              <p className="truncate">
                                유입: {customer.source}
                              </p>
                            ) : null}
                            <p>
                              등록일:{" "}
                              {new Date(customer.createdAt).toLocaleDateString(
                                "ko-KR"
                              )}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isSelected ? "선택됨" : "미선택"} ·{" "}
                            {WORKFLOW_COPY.dbAssignment.unassignedLabel} DB
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      onChange={onToggleAll}
                      checked={allVisibleSelected}
                      aria-label="현재 목록 전체 선택"
                    />
                  </TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>유입경로</TableHead>
                  <TableHead>상담상태</TableHead>
                  <TableHead>등록일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {emptyTitle}
                        </p>
                        <p className="text-xs">{emptyDescription}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map(customer => (
                    <TableRow
                      key={customer.id}
                      className={
                        selected.includes(customer.id) ? "bg-primary/5" : ""
                      }
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.includes(customer.id)}
                          onChange={() => onToggle(customer.id)}
                          aria-label="고객 선택"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.phone ?? "-"}</TableCell>
                      <TableCell>{customer.region ?? "-"}</TableCell>
                      <TableCell>{customer.source ?? "-"}</TableCell>
                      <TableCell>
                        <StatusBadge status={customer.consultStatus ?? "-"} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(customer.createdAt).toLocaleDateString(
                          "ko-KR"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Sheet open={isMobile && showFilters} onOpenChange={setShowFilters}>
        <SheetContent
          side="bottom"
          className="max-h-[min(86vh,42rem)] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <SheetHeader>
            <SheetTitle>배정 대상 필터</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-1">
            {filterFields}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => {
                  onSearchChange("");
                  onStatusFilterChange("all");
                  onSourceFilterChange("all");
                }}
              >
                <X className="mr-1 h-4 w-4" aria-hidden="true" />
                초기화
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1"
                onClick={() => setShowFilters(false)}
              >
                적용
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
