import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899","#6b7280"];

function StatCard({ title, value, suffix = "", highlight = false }: {
  title: string; value: number | string | undefined; suffix?: string; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={`text-2xl font-bold mt-1 ${highlight ? "text-primary" : ""}`}>
          {value ?? 0}{suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Performance() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [agentIdFilter, setAgentIdFilter] = useState<string>("all");
  const [teamIdFilter, setTeamIdFilter] = useState<string>("all");
  const [productGroupFilter, setProductGroupFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM 형식

  const { data: users } = trpc.users.list.useQuery();
  const { data: teams } = trpc.users.teams.useQuery();

  // 월 선택 시 dateFrom/dateTo 자동 변환
  const effectiveDateFrom = monthFilter ? `${monthFilter}-01` : (dateFrom || undefined);
  const effectiveDateTo = monthFilter ? (() => {
    const [y, m] = monthFilter.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${monthFilter}-${String(lastDay).padStart(2, "0")}`;
  })() : (dateTo || undefined);

  const statsInput = useMemo(() => ({
    dateFrom: effectiveDateFrom,
    dateTo: effectiveDateTo,
    agentIdFilter: agentIdFilter !== "all" ? Number(agentIdFilter) : undefined,
    teamIdFilter: teamIdFilter !== "all" ? Number(teamIdFilter) : undefined,
    productGroup: productGroupFilter || undefined,
    company: companyFilter || undefined,
    region: regionFilter || undefined,
    source: sourceFilter || undefined,
  }), [effectiveDateFrom, effectiveDateTo, agentIdFilter, teamIdFilter, productGroupFilter, companyFilter, regionFilter, sourceFilter]);

  const { data: stats } = trpc.performance.stats.useQuery(statsInput);

  const barData = [
    { name: "미상담", value: stats?.uncontacted ?? 0 },
    { name: "부재", value: stats?.absent ?? 0 },
    { name: "통화완료", value: stats?.called ?? 0 },
    { name: "상담예정", value: stats?.scheduled ?? 0 },
    { name: "설계중", value: stats?.designing ?? 0 },
    { name: "계약", value: stats?.contracted ?? 0 },
  ];

  const pieData = [
    { name: "유지계약", value: stats?.activeContracts ?? 0 },
    { name: "해지·실효", value: stats?.canceledContracts ?? 0 },
  ];

  const rateData = [
    { name: "상담률", value: stats?.consultRate ?? 0 },
    { name: "계약률", value: stats?.contractRate ?? 0 },
    { name: "부재율", value: stats?.absentRate ?? 0 },
    { name: "보류·거절", value: stats?.heldRejectedRate ?? 0 },
  ];

  const roleTitle = user?.role === "branch_admin" ? "전체" : (user?.role === "sub_branch_admin" || user?.role === "team_leader") ? "팀" : "내";
  const agents = (users ?? []).filter((u) => (u as any).accountStatus === "active");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">실적관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{roleTitle} 실적 현황</p>
        </div>

        {/* 필터 */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">월 선택</Label>
                <Input type="month" value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setDateFrom(""); setDateTo(""); }} className="h-8 mt-1" />
              </div>
              <div>
                <Label className="text-xs">시작일</Label>
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setMonthFilter(""); }} className="h-8 mt-1" />
              </div>
              <div>
                <Label className="text-xs">종료일</Label>
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setMonthFilter(""); }} className="h-8 mt-1" />
              </div>
              {(user?.role === "branch_admin" || user?.role === "sub_branch_admin" || user?.role === "team_leader") && (
                <>
                  {user?.role === "branch_admin" && (
                    <div>
                      <Label className="text-xs">팀</Label>
                      <Select value={teamIdFilter} onValueChange={setTeamIdFilter}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="전체 팀" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체 팀</SelectItem>
                          {(teams ?? []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">팀원</Label>
                    <Select value={agentIdFilter} onValueChange={setAgentIdFilter}>
                      <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="전체 팀원" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 팀원</SelectItem>
                        {agents.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div><Label className="text-xs">상품군</Label><Input value={productGroupFilter} onChange={(e) => setProductGroupFilter(e.target.value)} className="h-8 mt-1" placeholder="예: 종신, 실손" /></div>
              <div><Label className="text-xs">보험사</Label><Input value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="h-8 mt-1" placeholder="예: 삼성생명" /></div>
              <div><Label className="text-xs">지역</Label><Input value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="h-8 mt-1" placeholder="예: 서울" /></div>
              <div><Label className="text-xs">유입경로</Label><Input value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-8 mt-1" placeholder="예: 지인소개" /></div>
            </div>
          </CardContent>
        </Card>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="배정 DB 수" value={stats?.assigned} highlight />
          <StatCard title="계약건수" value={stats?.contracted} highlight />
          <StatCard title="월납보험료 합계" value={stats?.monthlyPremiumSum?.toLocaleString()} suffix="원" highlight />
          <StatCard title="유지계약 수" value={stats?.activeContracts} highlight />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="미상담 수" value={stats?.uncontacted} />
          <StatCard title="부재 수" value={stats?.absent} />
          <StatCard title="통화완료 수" value={stats?.called} />
          <StatCard title="상담예정 수" value={stats?.scheduled} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="설계중 수" value={stats?.designing} />
          <StatCard title="해지·실효 수" value={stats?.canceledContracts} />
          <StatCard title="상담률" value={stats?.consultRate} suffix="%" />
          <StatCard title="계약률" value={stats?.contractRate} suffix="%" />
        </div>

        {/* 차트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">상담상태별 현황</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="건수" radius={[4, 4, 0, 0]}>
                    {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">계약 유지/해지 현황</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? "#10b981" : "#ef4444"} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">비율 지표 (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rateData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="value" name="비율" radius={[0, 4, 4, 0]}>
                  {rateData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
