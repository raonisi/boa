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

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.performance.stats.useQuery();
  const { data: notifications } = trpc.notifications.list.useQuery();
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery({});

  const unreadNotifs = notifications?.filter((n) => !n.isRead) ?? [];
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
