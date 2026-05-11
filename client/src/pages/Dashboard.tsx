import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CalendarDays,
  FileText,
  Phone,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";

function StatCard({
  title,
  value,
  icon: Icon,
  color = "text-primary",
  suffix = "",
}: {
  title: string;
  value: number | string | undefined;
  icon: React.ElementType;
  color?: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {value ?? 0}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 부지점장 전용 대시보드 ───────────────────────────────────────────────────
function SubBranchAdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.performance.stats.useQuery();
  const { data: notifResult } = trpc.notifications.list.useQuery({});
  const notifications = notifResult?.items ?? [];
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery({});
  const { data: allUsers } = trpc.users.list.useQuery();

  const today = new Date();
  const unreadNotifs = notifications.filter((n: any) => !n.isRead);
  const todaySchedules = (schedules ?? []).filter((s) => new Date(s.startTime).toDateString() === today.toDateString());
  const allDb = customers ?? [];
  const assignedToSubBranch = allDb.filter((c) => (c as any).assignmentStatus === "assigned_to_sub_branch");
  const assignedToAgent = allDb.filter((c) => (c as any).assignmentStatus === "assigned_to_agent");
  const myTeamMembers = (allUsers ?? []).filter((u) =>
    (u as any).accountStatus === "active" &&
    (u.role === "team_leader" || u.role === "member") &&
    (u as any).subBranchAdminId === user?.id
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.name} (부지점장) · {today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="배분받은 전체 DB" value={allDb.length} icon={Users} />
          <StatCard title="미배정 DB" value={assignedToSubBranch.length} icon={Users} color="text-orange-500" />
          <StatCard title="배정 완료 DB" value={assignedToAgent.length} icon={Users} color="text-green-600" />
          <StatCard title="산하 계약건수" value={stats?.contracted} icon={FileText} color="text-blue-600" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="월납보험료 합계" value={stats?.monthlyPremiumSum?.toLocaleString()} icon={TrendingUp} suffix="원" color="text-blue-600" />
          <StatCard title="오늘 일정" value={todaySchedules.length} icon={CalendarDays} />
          <StatCard title="미읽은 알림" value={unreadNotifs.length} icon={Bell} color="text-red-500" />
          <StatCard title="미상담 DB" value={allDb.filter((c) => c.consultStatus === "미상담").length} icon={Phone} color="text-orange-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">산하 팀원별 고객 현황</CardTitle></CardHeader>
            <CardContent className="p-0">
              {myTeamMembers.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">산하 팀원이 없습니다.</div>
              ) : (
                <table className="w-full text-sm"><thead className="border-b"><tr className="text-xs text-muted-foreground"><th className="text-left p-3">이름</th><th className="text-left p-3">역할</th><th className="text-right p-3">배정 고객</th><th className="text-right p-3">미상담</th></tr></thead>
                <tbody className="divide-y">{myTeamMembers.map((u) => { const mc = allDb.filter((c) => c.agentId === u.id); return (<tr key={u.id}><td className="p-3 font-medium">{u.name}</td><td className="p-3 text-xs text-muted-foreground">{u.role === "team_leader" ? "팀장" : "팀원"}</td><td className="p-3 text-right">{mc.length}</td><td className="p-3 text-right text-orange-600">{mc.filter((c) => c.consultStatus === "미상담").length}</td></tr>); })}</tbody></table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">미배정 DB 목록</CardTitle></CardHeader>
            <CardContent className="p-0">
              {assignedToSubBranch.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">미배정 DB가 없습니다.</div>
              ) : (
                <div className="divide-y max-h-48 overflow-y-auto">
                  {assignedToSubBranch.slice(0, 8).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/customers/${c.id}`)}
                    ><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-muted-foreground">{c.region ?? "-"}</p></div><StatusBadge status={c.consultStatus} /></div>
                  ))}
                  {assignedToSubBranch.length > 8 && <div className="p-3 text-center text-xs text-muted-foreground">+{assignedToSubBranch.length - 8}명 더 있음</div>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "sub_branch_admin") return <SubBranchAdminDashboard />;

  const [, setLocation] = useLocation();
  const { data: stats } = trpc.performance.stats.useQuery();
  const { data: notifResult } = trpc.notifications.list.useQuery({});
  const notifications = notifResult?.items ?? [];
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery({});

  const unreadNotifs = notifications.filter((n: any) => !n.isRead);
  const todaySchedules = schedules?.filter((s) => {
    const d = new Date(s.startTime);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }) ?? [];

  const recentCustomers = customers?.slice(0, 5) ?? [];

  const roleTitle =
    user?.role === "branch_admin" ? "관리자" : user?.role === "team_leader" ? "팀장" : "팀원";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.name} ({roleTitle}) · {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="배정 DB" value={stats?.assigned} icon={Users} />
          <StatCard title="미상담" value={stats?.uncontacted} icon={AlertCircle} color="text-orange-500" />
          <StatCard title="계약건수" value={stats?.contracted} icon={FileText} color="text-green-600" />
          <StatCard title="월납보험료" value={stats?.monthlyPremiumSum?.toLocaleString()} icon={TrendingUp} suffix="원" color="text-blue-600" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="상담률" value={stats?.consultRate} icon={Phone} suffix="%" />
          <StatCard title="계약률" value={stats?.contractRate} icon={BarChart3} suffix="%" color="text-green-600" />
          <StatCard title="부재율" value={stats?.absentRate} icon={AlertCircle} suffix="%" color="text-orange-500" />
          <StatCard title="유지계약" value={stats?.activeContracts} icon={FileText} color="text-emerald-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 오늘 일정 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                오늘 일정 ({todaySchedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todaySchedules.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">오늘 일정이 없습니다.</p>
              ) : (
                todaySchedules.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{s.title}</span>
                    <StatusBadge status={s.status} />
                  </div>
                ))
              )}
              <button
                onClick={() => setLocation("/calendar")}
                className="text-xs text-primary hover:underline mt-1"
              >
                전체 보기 →
              </button>
            </CardContent>
          </Card>

          {/* 미읽은 알림 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" />
                미읽은 알림 ({unreadNotifs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unreadNotifs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">새 알림이 없습니다.</p>
              ) : (
                unreadNotifs.slice(0, 5).map((n) => (
                  <div key={n.id} className="text-xs border-l-2 border-primary pl-2 py-0.5">
                    <p className="font-medium text-foreground">{n.title}</p>
                    <p className="text-muted-foreground truncate">{n.message}</p>
                  </div>
                ))
              )}
              <button
                onClick={() => setLocation("/notifications")}
                className="text-xs text-primary hover:underline mt-1"
              >
                전체 보기 →
              </button>
            </CardContent>
          </Card>

          {/* 최근 고객 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                최근 고객
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentCustomers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">배정된 고객이 없습니다.</p>
              ) : (
                recentCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5"
                    onClick={() => setLocation(`/customers/${c.id}`)}
                  >
                    <span className="font-medium">{c.name}</span>
                    <StatusBadge status={c.consultStatus} />
                  </div>
                ))
              )}
              <button
                onClick={() => setLocation("/customers")}
                className="text-xs text-primary hover:underline mt-1"
              >
                전체 보기 →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* 상태별 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">상담 현황 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
              {[
                { label: "미상담", value: stats?.uncontacted },
                { label: "부재", value: stats?.absent },
                { label: "통화완료", value: stats?.called },
                { label: "상담예정", value: stats?.scheduled },
                { label: "설계중", value: stats?.designing },
                { label: "계약", value: stats?.contracted },
                { label: "보류", value: undefined },
                { label: "거절", value: undefined },
                { label: "유지", value: stats?.activeContracts },
                { label: "해지·실효", value: stats?.canceledContracts },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 rounded-lg bg-muted">
                  <p className="text-lg font-bold">{item.value ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
