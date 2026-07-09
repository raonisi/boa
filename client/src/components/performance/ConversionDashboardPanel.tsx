import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

type ConversionPeriodPreset = "month" | "last7" | "last30" | "custom";

type ConversionDashboardInput = {
  dateFrom?: string;
  dateTo?: string;
  agentIdFilter?: number;
  teamIdFilter?: number;
};

const PERIOD_OPTIONS: Array<{ value: ConversionPeriodPreset; label: string }> = [
  { value: "month", label: "이번 달" },
  { value: "last7", label: "최근 7일" },
  { value: "last30", label: "최근 30일" },
  { value: "custom", label: "직접 기간" },
];

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString();
}

function formatWon(value: number | null | undefined) {
  return `${formatNumber(value)}원`;
}

function formatRate(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <span className="rounded-2xl bg-white p-2 text-[#b99b5f] shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

export function ConversionDashboardPanel({
  input,
}: {
  input: ConversionDashboardInput;
}) {
  const [preset, setPreset] = useState<ConversionPeriodPreset>("month");
  const queryInput = useMemo(
    () => ({
      ...input,
      preset: input.dateFrom || input.dateTo ? "custom" : preset,
    }),
    [input, preset]
  );

  const summaryQuery = trpc.conversionDashboard.summary.useQuery(queryInput);
  const funnelQuery = trpc.conversionDashboard.funnel.useQuery(queryInput);
  const byAgentQuery = trpc.conversionDashboard.byAgent.useQuery(queryInput);
  const staleQuery = trpc.conversionDashboard.staleDb.useQuery(queryInput);

  const isLoading =
    summaryQuery.isLoading ||
    funnelQuery.isLoading ||
    byAgentQuery.isLoading ||
    staleQuery.isLoading;
  const isError =
    summaryQuery.isError ||
    funnelQuery.isError ||
    byAgentQuery.isError ||
    staleQuery.isError;
  const summary = summaryQuery.data?.summary;
  const funnel = funnelQuery.data?.funnel ?? [];
  const rows = byAgentQuery.data?.rows ?? [];
  const staleDb = staleQuery.data?.staleDb;
  const period = summaryQuery.data?.period;

  return (
    <div className="space-y-4" data-testid="conversion-dashboard-panel">
      <Card className="border-slate-200/80 bg-white/95 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f3f32]">
                DB Conversion
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                DB 전환율 대시보드
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                배분 DB가 상담 진행과 계약 고객으로 전환되는 흐름을 숫자 중심으로 확인합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  type="button"
                  variant={queryInput.preset === option.value ? "default" : "outline"}
                  size="sm"
                  className="min-h-11 rounded-xl md:min-h-9"
                  onClick={() => setPreset(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          {period && (
            <p className="mt-3 text-xs text-slate-500">
              집계 기간: {period.dateFrom} ~ {period.dateTo}
            </p>
          )}

          {isLoading ? (
            <LoadingState
              title="전환율 지표를 불러오는 중입니다."
              description="권한 범위 안의 배분 DB와 계약 지표만 집계하고 있습니다."
              compact
            />
          ) : isError ? (
            <ErrorState
              title="전환율 지표를 불러오지 못했습니다."
              description="잠시 후 다시 시도해 주세요."
              retryLabel="새로고침"
              onRetry={() => {
                void summaryQuery.refetch();
                void funnelQuery.refetch();
                void byAgentQuery.refetch();
                void staleQuery.refetch();
              }}
              compact
            />
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <SummaryCard
                  label="배분 DB"
                  value={`${formatNumber(summary?.assignedDbCount)}건`}
                  helper="기간 내 담당자에게 배정된 DB"
                  icon={Database}
                />
                <SummaryCard
                  label="상담 진행"
                  value={`${formatNumber(summary?.progressedDbCount)}건`}
                  helper={`DB→상담 ${formatRate(summary?.dbToConsultRate)}`}
                  icon={Users}
                />
                <SummaryCard
                  label="계약 고객"
                  value={`${formatNumber(summary?.contractedCustomerCount)}명`}
                  helper={`DB→계약 ${formatRate(summary?.dbToContractRate)}`}
                  icon={TrendingUp}
                />
                <SummaryCard
                  label="신규 계약"
                  value={`${formatNumber(summary?.newContractCount)}건`}
                  helper={`상담→계약 ${formatRate(summary?.consultToContractRate)}`}
                  icon={BarChart3}
                />
                <SummaryCard
                  label="월납보험료"
                  value={formatWon(summary?.monthlyPremiumTotal)}
                  helper="기간 내 삭제되지 않은 계약 합계"
                  icon={WalletCards}
                />
                <SummaryCard
                  label="DB당 월납보험료"
                  value={formatWon(summary?.premiumPerAssignedDb)}
                  helper={
                    summary?.averageDaysToContract == null
                      ? "평균 소요일 없음"
                      : `평균 ${summary.averageDaysToContract}일 소요`
                  }
                  icon={Clock}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isLoading && !isError && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">전환 퍼널</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {funnel.map(item => (
                  <div
                    key={item.key}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">
                      {formatNumber(item.count)}
                      <span className="ml-1 text-sm font-normal text-slate-500">
                        건
                      </span>
                    </p>
                    <p className="mt-2 text-xs font-medium text-[#0f3f32]">
                      배분 대비 {formatRate(item.rateFromAssigned)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-[#b99b5f]" />
                  위험 DB 요약
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {[
                  ["미접촉 DB", staleDb?.uncontactedDbCount],
                  ["14일 미전환", staleDb?.stale14Count],
                  ["30일 미전환", staleDb?.stale30Count],
                  ["후속 지연", staleDb?.overdueFollowUpCount],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                  >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-bold text-slate-950">
                      {formatNumber(value as number | undefined)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">담당자별 전환율</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    선택한 기간에 집계할 배분 DB가 없습니다.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    기간 또는 담당자 필터를 조정해 다시 확인해 주세요.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="py-2 pr-3 font-medium">담당자</th>
                        <th className="py-2 pr-3 font-medium">역할</th>
                        <th className="py-2 pr-3 font-medium">배분 DB</th>
                        <th className="py-2 pr-3 font-medium">상담 진행</th>
                        <th className="py-2 pr-3 font-medium">계약 고객</th>
                        <th className="py-2 pr-3 font-medium">DB→상담</th>
                        <th className="py-2 pr-3 font-medium">DB→계약</th>
                        <th className="py-2 pr-3 font-medium">상담→계약</th>
                        <th className="py-2 pr-3 font-medium">신규 계약</th>
                        <th className="py-2 pr-3 font-medium">월납보험료</th>
                        <th className="py-2 pr-3 font-medium">DB당 보험료</th>
                        <th className="py-2 pr-3 font-medium">미접촉</th>
                        <th className="py-2 pr-3 font-medium">장기 미전환</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map(row => (
                        <tr key={row.agentId} className="text-slate-700">
                          <td className="py-3 pr-3 font-semibold text-slate-950">
                            {row.agentName}
                          </td>
                          <td className="py-3 pr-3">{row.role}</td>
                          <td className="py-3 pr-3">
                            {formatNumber(row.assignedDbCount)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatNumber(row.progressedDbCount)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatNumber(row.contractedCustomerCount)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatRate(row.dbToConsultRate)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatRate(row.dbToContractRate)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatRate(row.consultToContractRate)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatNumber(row.newContractCount)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatWon(row.monthlyPremiumTotal)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatWon(row.premiumPerAssignedDb)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatNumber(row.uncontactedDbCount)}
                          </td>
                          <td className="py-3 pr-3">
                            {formatNumber(row.stale14Count)} /{" "}
                            {formatNumber(row.stale30Count)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
