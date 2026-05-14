import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BarChart2, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const STAGE_COLORS = ["#0f172a", "#b45309", "#0369a1", "#047857", "#a16207"];

function pct(prev: number, next: number): string | null {
  if (prev <= 0) return null;
  const v = (next / prev) * 100;
  if (!Number.isFinite(v)) return null;
  return `${v.toFixed(1)}%`;
}

export default function SalesFunnelAnalytics() {
  const [teamId, setTeamId] = useState<string>("all");
  const [agentId, setAgentId] = useState<string>("all");

  const { data: filterOptions, isLoading: filterLoading } = trpc.analytics.funnelFilterOptions.useQuery();

  const teamIdNum = teamId === "all" ? undefined : Number(teamId);
  const agentIdNum = agentId === "all" ? undefined : Number(agentId);

  const { data, isLoading, isFetching } = trpc.analytics.salesFunnel.useQuery(
    {
      teamId: teamIdNum ?? null,
      agentId: agentIdNum ?? null,
    },
    { placeholderData: (prev) => prev }
  );

  const agentsForTeam = useMemo(() => {
    const agents = filterOptions?.agents ?? [];
    if (teamId === "all") return agents;
    const tid = Number(teamId);
    return agents.filter((a) => a.teamId === tid);
  }, [filterOptions?.agents, teamId]);

  useEffect(() => {
    if (agentId === "all") return;
    const allowed = new Set(agentsForTeam.map((a) => String(a.id)));
    if (!allowed.has(agentId)) setAgentId("all");
  }, [agentsForTeam, agentId]);

  const chartRows = useMemo(() => {
    if (!data) return [];
    const { totalAssigned, taCumulative, apCumulative, pcCumulative, contracted } = data;
    return [
      { key: "total", label: "총 배정 DB", shortLabel: "배정", count: totalAssigned, fill: STAGE_COLORS[0] },
      { key: "ta", label: "TA (전화연결) 이상", shortLabel: "TA+", count: taCumulative, fill: STAGE_COLORS[1] },
      { key: "ap", label: "AP (대면상담) 이상", shortLabel: "AP+", count: apCumulative, fill: STAGE_COLORS[2] },
      { key: "pc", label: "PC (가입설계) 이상", shortLabel: "PC+", count: pcCumulative, fill: STAGE_COLORS[3] },
      { key: "done", label: "청약완료", shortLabel: "청약", count: contracted, fill: STAGE_COLORS[4] },
    ];
  }, [data]);

  const conversionRows = useMemo(() => {
    if (!data) return [];
    const d = data;
    return [
      { label: "총 배정 → TA 이상", value: pct(d.totalAssigned, d.taCumulative) },
      { label: "TA 이상 → AP 이상", value: pct(d.taCumulative, d.apCumulative) },
      { label: "AP 이상 → PC 이상", value: pct(d.apCumulative, d.pcCumulative) },
      { label: "PC 이상 → 청약완료", value: pct(d.pcCumulative, d.contracted) },
    ];
  }, [data]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.2)] sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
              <BarChart2 className="h-3.5 w-3.5" />
              Sales funnel monitor
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">영업 분석</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              담당자가 배정된 활성 고객만 대상으로, DB의 <span className="font-semibold text-white">상담 상태(consultStatus)</span>를
              누적 단계별로 집계합니다. 서버에서 역할·조직 범위를 검증합니다.
            </p>
          </div>
          <div className="flex max-w-md items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/90" />
            <span>필터를 바꾸면 집계 범위만 좁혀지며, 목록 전체를 불러오지 않아 부하를 줄입니다.</span>
          </div>
        </div>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">범위 선택</CardTitle>
            <CardDescription>산하 팀·담당자 기준으로 퍼널 데이터를 좁혀 볼 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">팀</Label>
              <Select value={teamId} onValueChange={(v) => { setTeamId(v); setAgentId("all"); }} disabled={filterLoading}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue placeholder="팀 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 팀</SelectItem>
                  {(filterOptions?.teams ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">담당 팀원</Label>
              <Select value={agentId} onValueChange={setAgentId} disabled={filterLoading}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 담당자</SelectItem>
                  {agentsForTeam.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {(a.name ?? `사용자 ${a.id}`) + (a.teamId != null ? ` · 팀 #${a.teamId}` : "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">단계별 인원 (누적)</CardTitle>
              <CardDescription>Recharts 막대 차트 — 단계가 깊어질수록 포함 범위가 좁아집니다.</CardDescription>
            </CardHeader>
            <CardContent className="h-[min(420px,70vh)] min-h-[280px] w-full pt-2">
              {isLoading && !data ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">불러오는 중…</div>
              ) : (
                <div className={cn("relative h-full w-full", isFetching && "opacity-70 transition-opacity")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal className="stroke-slate-200" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="shortLabel"
                        width={56}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip
                        cursor={{ fill: "rgba(15,23,42,0.04)" }}
                        contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                        formatter={(value: unknown) => {
                          const n = typeof value === "number" ? value : Number(value);
                          return [`${Number.isFinite(n) ? n.toLocaleString() : "0"}명`, "인원"];
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={28}>
                        {chartRows.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="right"
                          formatter={(v: unknown) => `${Number(v).toLocaleString()}명`}
                          style={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">단계 간 전환율</CardTitle>
              <CardDescription>이전 단계 대비 다음 단계(누적) 비율입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversionRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <span className="text-xs font-medium text-slate-600 sm:text-sm">{row.label}</span>
                  <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-sm font-bold tabular-nums text-amber-200">
                    {row.value ?? "—"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
