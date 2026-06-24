import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { useIsMobile } from "@/hooks/useMobile";
import { canAccessReferralManagement } from "@/lib/referralFlowPermissions";
import {
  REFERRAL_RESULT_STATUS_LABELS,
  REFERRAL_STAGE_BADGE_CLASSES,
  REFERRAL_STAGE_LABELS,
  REFERRAL_THANK_YOU_BADGE_CLASSES,
  THANK_YOU_STATUS_LABELS,
} from "@/lib/referralFlowLabels";
import { formatUserWithRole } from "@/lib/userRole";
import { trpc } from "@/lib/trpc";
import type {
  ReferralResultStatus,
  ReferralStage,
  ThankYouStatus,
} from "@shared/customerReferrals";
import { formatKstLocalDateTime } from "@shared/timePolicy";
import { GitBranch, Loader2, RefreshCcw } from "lucide-react";
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
        기록된 소개 흐름 기준
      </p>
    </div>
  );
}

export default function ReferralManagement() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [thankYouFilter, setThankYouFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const canAccess = canAccessReferralManagement(user);

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = trpc.customerReferrals.summary.useQuery(undefined, {
    enabled: canAccess,
  });

  const {
    data: referrals,
    isLoading: isListLoading,
    isError,
    refetch: refetchList,
  } = trpc.customerReferrals.list.useQuery(
    {
      referralStage:
        stageFilter === "all" ? undefined : (stageFilter as ReferralStage),
      resultStatus:
        resultFilter === "all"
          ? undefined
          : (resultFilter as ReferralResultStatus),
      thankYouStatus:
        thankYouFilter === "all"
          ? undefined
          : (thankYouFilter as ThankYouStatus),
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
    () =>
      Array.from(
        new Set(
          (referrals ?? []).flatMap(row => [
            row.referrerCustomerId,
            row.referredCustomerId,
          ])
        )
      ),
    [referrals]
  );
  const { lookup } = useCustomerLookup(customerIds);

  const agentById = useMemo(
    () => new Map((users ?? []).map(entry => [entry.id, entry])),
    [users]
  );

  const filteredRows = useMemo(() => {
    return (referrals ?? []).filter(row => {
      const referrer = lookup[row.referrerCustomerId];
      const referred = lookup[row.referredCustomerId];
      const agentId = referred?.agentId ?? referrer?.agentId ?? null;
      const teamId = agentId ? agentById.get(agentId)?.teamId : null;

      if (agentFilter !== "all" && String(agentId) !== agentFilter) return false;
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
      return true;
    });
  }, [referrals, lookup, agentFilter, teamFilter, dateFrom, dateTo, agentById]);

  const memberStats = useMemo(() => {
    const stats = new Map<
      number,
      { referrals: number; contracted: number; name: string }
    >();
    for (const row of filteredRows) {
      const referrer = lookup[row.referrerCustomerId];
      const agentId = referrer?.agentId;
      if (!agentId) continue;
      const current = stats.get(agentId) ?? {
        referrals: 0,
        contracted: 0,
        name: agentById.get(agentId)?.name ?? `#${agentId}`,
      };
      current.referrals += 1;
      if (row.resultStatus === "contracted") current.contracted += 1;
      stats.set(agentId, current);
    }
    return Array.from(stats.values()).sort((a, b) => b.referrals - a.referrals);
  }, [filteredRows, lookup, agentById]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1f3b57]">
              <GitBranch className="h-6 w-6 text-indigo-600" />
              소개 관리
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              기록된 소개 흐름 기준으로 진행 상태와 감사 연락을 확인합니다.
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard title="전체 소개" value={summary.total} />
            <KpiCard title="진행 중" value={summary.inProgress} />
            <KpiCard title="계약 완료" value={summary.contracted} />
            <KpiCard
              title="보류/거절"
              value={
                (summary.byResultStatus?.deferred ?? 0) +
                (summary.byResultStatus?.declined ?? 0)
              }
            />
            <KpiCard title="감사 미완료" value={summary.thankYouPending} />
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">필터</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">소개 단계</Label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(REFERRAL_STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">결과 상태</Label>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(REFERRAL_RESULT_STATUS_LABELS).map(
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
              <Label className="text-xs">감사 연락</Label>
              <Select value={thankYouFilter} onValueChange={setThankYouFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(THANK_YOU_STATUS_LABELS).map(
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
              <Label className="text-xs">업데이트 시작일</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">업데이트 종료일</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {user?.role !== "member" && memberStats.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">팀원별 소개 현황</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {memberStats.slice(0, 9).map(stat => (
                <div
                  key={stat.name}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3"
                >
                  <p className="truncate font-medium">{stat.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    소개 {stat.referrals}건 · 계약 {stat.contracted}건
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 소개 흐름</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isError ? (
              <div className="p-6">
                <ErrorState
                  title="목록을 불러오지 못했습니다"
                  onRetry={() => void refetchList()}
                />
              </div>
            ) : isListLoading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                목록 불러오는 중...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="표시할 소개 흐름이 없습니다"
                  description="고객 상세 화면에서 연결 고객 관계를 만든 뒤 소개 흐름을 등록할 수 있습니다."
                />
              </div>
            ) : isMobile ? (
              <div className="divide-y">
                {filteredRows.map(row => {
                  const referrer = lookup[row.referrerCustomerId];
                  const referred = lookup[row.referredCustomerId];
                  return (
                    <div key={row.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REFERRAL_STAGE_BADGE_CLASSES[row.referralStage as ReferralStage]}`}
                        >
                          {REFERRAL_STAGE_LABELS[row.referralStage as ReferralStage]}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REFERRAL_THANK_YOU_BADGE_CLASSES[row.thankYouStatus as ThankYouStatus]}`}
                        >
                          감사 {THANK_YOU_STATUS_LABELS[row.thankYouStatus as ThankYouStatus]}
                        </span>
                      </div>
                      <p className="text-sm">
                        {referrer?.name ?? `#${row.referrerCustomerId}`} →{" "}
                        {referred?.name ?? `#${row.referredCustomerId}`}
                      </p>
                      {referred ? (
                        <StatusBadge status={referred.consultStatus} />
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {formatKstLocalDateTime(String(row.updatedAt))}
                      </p>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/customers/${row.referrerCustomerId}`}>
                            소개자
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/customers/${row.referredCustomerId}`}>
                            피소개자
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>단계</TableHead>
                      <TableHead>소개자</TableHead>
                      <TableHead>피소개자</TableHead>
                      <TableHead>상담상태</TableHead>
                      <TableHead>감사</TableHead>
                      <TableHead>결과</TableHead>
                      <TableHead>업데이트</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map(row => {
                      const referrer = lookup[row.referrerCustomerId];
                      const referred = lookup[row.referredCustomerId];
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REFERRAL_STAGE_BADGE_CLASSES[row.referralStage as ReferralStage]}`}
                            >
                              {REFERRAL_STAGE_LABELS[row.referralStage as ReferralStage]}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/customers/${row.referrerCustomerId}`}
                              className="font-medium text-indigo-700 hover:underline"
                            >
                              {referrer?.name ?? `#${row.referrerCustomerId}`}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/customers/${row.referredCustomerId}`}
                              className="font-medium text-indigo-700 hover:underline"
                            >
                              {referred?.name ?? `#${row.referredCustomerId}`}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {referred ? (
                              <StatusBadge status={referred.consultStatus} />
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {THANK_YOU_STATUS_LABELS[row.thankYouStatus as ThankYouStatus]}
                          </TableCell>
                          <TableCell>
                            {
                              REFERRAL_RESULT_STATUS_LABELS[
                                row.resultStatus as ReferralResultStatus
                              ]
                            }
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatKstLocalDateTime(String(row.updatedAt))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
