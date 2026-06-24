import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { useIsMobile } from "@/hooks/useMobile";
import { canAccessClaimGuidanceManagement } from "@/lib/claimGuidancePermissions";
import {
  CLAIM_CUSTOMER_ACTION_STATUS_LABELS,
  CLAIM_GUIDANCE_STATUS_BADGE_CLASSES,
  CLAIM_GUIDANCE_STATUS_LABELS,
  CLAIM_GUIDANCE_TYPE_LABELS,
} from "@/lib/claimGuidanceLabels";
import { formatUserWithRole } from "@/lib/userRole";
import { trpc } from "@/lib/trpc";
import type {
  ClaimCustomerActionStatus,
  ClaimGuidanceStatus,
  ClaimGuidanceType,
} from "@shared/claimGuidance";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import { ClipboardList, Loader2, RefreshCcw } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "wouter";

function KpiCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[#1f3b57]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        기록된 청구 안내 상태
      </p>
    </div>
  );
}

export default function ClaimGuidanceManagement() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nextFrom, setNextFrom] = useState("");
  const [nextTo, setNextTo] = useState("");

  const canAccess = canAccessClaimGuidanceManagement(user);

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = trpc.claimGuidance.summary.useQuery(undefined, { enabled: canAccess });

  const {
    data: cases,
    isLoading: isListLoading,
    refetch: refetchList,
  } = trpc.claimGuidance.list.useQuery(
    {
      guidanceType:
        typeFilter === "all" ? undefined : (typeFilter as ClaimGuidanceType),
      guidanceStatus:
        statusFilter === "all"
          ? undefined
          : (statusFilter as ClaimGuidanceStatus),
      customerActionStatus:
        actionFilter === "all"
          ? undefined
          : (actionFilter as ClaimCustomerActionStatus),
      limit: 200,
    },
    { enabled: canAccess }
  );

  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: canAccess && user?.role !== "member",
  });
  const { data: teams } = trpc.users.teams.useQuery(undefined, {
    enabled: canAccess && user?.role !== "member",
  });

  const customerIds = useMemo(
    () => Array.from(new Set((cases ?? []).map(row => row.customerId))),
    [cases]
  );
  const { lookup } = useCustomerLookup(customerIds);

  const agentById = useMemo(
    () => new Map((users ?? []).map(entry => [entry.id, entry])),
    [users]
  );

  const filteredRows = useMemo(() => {
    return (cases ?? []).filter(row => {
      const customer = lookup[row.customerId];
      const agentId = customer?.agentId ?? null;
      const teamId = agentId ? agentById.get(agentId)?.teamId : null;

      if (agentFilter !== "all" && String(agentId) !== agentFilter)
        return false;
      if (teamFilter !== "all" && String(teamId ?? "") !== teamFilter) {
        return false;
      }

      const updatedAt = new Date(row.updatedAt).getTime();
      if (dateFrom && updatedAt < new Date(dateFrom).getTime()) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (updatedAt > end.getTime()) return false;
      }

      if (row.nextFollowUpAt) {
        const nextAt = new Date(row.nextFollowUpAt).getTime();
        if (nextFrom && nextAt < new Date(nextFrom).getTime()) return false;
        if (nextTo) {
          const end = new Date(nextTo);
          end.setHours(23, 59, 59, 999);
          if (nextAt > end.getTime()) return false;
        }
      } else if (nextFrom || nextTo) {
        return false;
      }

      return true;
    });
  }, [
    cases,
    lookup,
    agentFilter,
    teamFilter,
    dateFrom,
    dateTo,
    nextFrom,
    nextTo,
    agentById,
  ]);

  const agentStats = useMemo(() => {
    const stats = new Map<
      number,
      { total: number; open: number; name: string }
    >();
    for (const row of filteredRows) {
      const customer = lookup[row.customerId];
      const agentId = customer?.agentId;
      if (!agentId) continue;
      const current = stats.get(agentId) ?? {
        total: 0,
        open: 0,
        name: formatUserWithRole(
          agentById.get(agentId) ?? { name: `#${agentId}` }
        ),
      };
      current.total += 1;
      if (
        row.guidanceStatus !== "completed" &&
        row.guidanceStatus !== "closed" &&
        row.guidanceStatus !== "not_applicable"
      ) {
        current.open += 1;
      }
      stats.set(agentId, current);
    }
    return Array.from(stats.values()).sort((a, b) => b.total - a.total);
  }, [filteredRows, lookup, agentById]);

  const waitingCustomer = summary?.byGuidanceStatus?.waiting_customer ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1f3b57]">
              <ClipboardList className="h-6 w-6 text-teal-600" />
              청구 안내 관리
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              기록된 청구 안내 상태 기준으로 진행 현황을 확인합니다. 청구 대행
              기능이 아닙니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchSummary();
              void refetchList();
            }}
          >
            <RefreshCcw className="mr-1 h-4 w-4" />
            새로고침
          </Button>
        </div>

        {isSummaryLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            요약 불러오는 중...
          </div>
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            <KpiCard title="전체" value={summary.total} />
            <KpiCard title="안내 필요" value={summary.guidanceNeeded} />
            <KpiCard title="고객 준비 중" value={waitingCustomer} />
            <KpiCard
              title="추가 안내 필요"
              value={summary.additionalGuidanceNeeded}
            />
            <KpiCard title="완료" value={summary.completed} />
            <KpiCard title="종료" value={summary.closed} />
            <KpiCard title="다음 확인 예정" value={summary.followUpScheduled} />
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">필터</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">안내 유형</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(CLAIM_GUIDANCE_TYPE_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">청구 안내 상태</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(CLAIM_GUIDANCE_STATUS_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">고객 준비 상태</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(CLAIM_CUSTOMER_ACTION_STATUS_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            {user?.role !== "member" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">담당자</Label>
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {(users ?? []).map(entry => (
                        <SelectItem key={entry.id} value={String(entry.id)}>
                          {formatUserWithRole(entry)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">팀</Label>
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {(teams ?? []).map(team => (
                        <SelectItem key={team.id} value={String(team.id)}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">수정 기간 시작</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">수정 기간 종료</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">다음 확인일 시작</Label>
              <Input
                type="date"
                value={nextFrom}
                onChange={e => setNextFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">다음 확인일 종료</Label>
              <Input
                type="date"
                value={nextTo}
                onChange={e => setNextTo(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {user?.role !== "member" && agentStats.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                담당자별 청구 안내 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {agentStats.map(entry => (
                <div
                  key={entry.name}
                  className="rounded-xl border border-slate-200/80 p-3 text-sm"
                >
                  <p className="font-medium">{entry.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    전체 {entry.total}건 · 진행 {entry.open}건
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 청구 안내</CardTitle>
          </CardHeader>
          <CardContent>
            {isListLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                목록 불러오는 중...
              </div>
            ) : filteredRows.length === 0 ? (
              <EmptyState title="표시할 청구 안내가 없습니다" />
            ) : isMobile ? (
              <div className="grid gap-3">
                {filteredRows.map(row => {
                  const customer = lookup[row.customerId];
                  return (
                    <div
                      key={row.id}
                      className="rounded-xl border border-slate-200/80 p-4 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLAIM_GUIDANCE_STATUS_BADGE_CLASSES[row.guidanceStatus]}`}
                        >
                          {CLAIM_GUIDANCE_STATUS_LABELS[row.guidanceStatus]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {CLAIM_GUIDANCE_TYPE_LABELS[row.guidanceType]}
                        </span>
                      </div>
                      <p className="mt-2 font-medium">
                        {customer?.name ?? `[#${row.customerId}]`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        고객 준비{" "}
                        {
                          CLAIM_CUSTOMER_ACTION_STATUS_LABELS[
                            row.customerActionStatus
                          ]
                        }
                      </p>
                      {row.nextFollowUpAt ? (
                        <p className="text-xs text-muted-foreground">
                          다음 확인{" "}
                          {formatKstLocalDateTime(String(row.nextFollowUpAt))}
                        </p>
                      ) : null}
                      {row.memo ? (
                        <p className="mt-2 line-clamp-2 text-slate-700">
                          {row.memo}
                        </p>
                      ) : null}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-3 min-h-10"
                      >
                        <Link href={`/customers/${row.customerId}`}>
                          고객 상세
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>고객</TableHead>
                    <TableHead>안내 유형</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>고객 준비</TableHead>
                    <TableHead>다음 확인일</TableHead>
                    <TableHead>메모</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(row => {
                    const customer = lookup[row.customerId];
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/customers/${row.customerId}`}
                            className="font-medium text-[#1f3b57] hover:underline"
                          >
                            {customer?.name ?? `#${row.customerId}`}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {CLAIM_GUIDANCE_TYPE_LABELS[row.guidanceType]}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLAIM_GUIDANCE_STATUS_BADGE_CLASSES[row.guidanceStatus]}`}
                          >
                            {CLAIM_GUIDANCE_STATUS_LABELS[row.guidanceStatus]}
                          </span>
                        </TableCell>
                        <TableCell>
                          {
                            CLAIM_CUSTOMER_ACTION_STATUS_LABELS[
                              row.customerActionStatus
                            ]
                          }
                        </TableCell>
                        <TableCell>
                          {row.nextFollowUpAt
                            ? formatKstLocalDateTime(
                                String(row.nextFollowUpAt)
                              ).slice(0, 16)
                            : "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {row.memo ?? "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
