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
  Target,
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
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{title}</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">
              {value ?? 0}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
          <div className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 부지점장 전용 대시보드 ───────────────────────────────────────────────────
function formatWon(value: number | undefined) {
  return `${(value ?? 0).toLocaleString()}원`;
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground py-2">{children}</p>;
}

function TodayWorkSection() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.todayWork.useQuery({});
  const { data: recommendationSummary } = trpc.recommendations.dashboardSummary.useQuery({});
  const cards = data?.cards;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">오늘 할 일</h2>
        <p className="text-xs text-muted-foreground mt-1">권한 범위 안의 일정, 알림, 장기 미관리 고객, 이번 달 계약 현황입니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <StatCard title="오늘 상담 예정" value={isLoading ? "-" : cards?.todayScheduleCount} icon={CalendarDays} />
        <StatCard title="미완료 일정" value={isLoading ? "-" : cards?.incompleteScheduleCount} icon={AlertCircle} color="text-orange-500" />
        <StatCard title="미확인 알림" value={isLoading ? "-" : cards?.pendingNotificationCount} icon={Bell} color="text-red-500" />
        <StatCard title="장기 미관리 고객" value={isLoading ? "-" : cards?.longUnmanagedCustomerCount} icon={Users} color="text-amber-600" />
        <StatCard title="오늘 연락 대상" value={isLoading ? "-" : cards?.todayFollowUpCount} icon={Phone} color="text-sky-600" />
        <StatCard title="미처리 후속관리" value={isLoading ? "-" : cards?.overdueFollowUpCount} icon={AlertCircle} color="text-red-600" />
        <StatCard title="이번 달 계약" value={isLoading ? "-" : cards?.monthlyContractCount} icon={FileText} color="text-green-600" />
        <StatCard title="이번 달 월납보험료" value={isLoading ? "-" : formatWon(cards?.monthlyPremiumSum)} icon={TrendingUp} color="text-blue-600" />
      </div>
      <Card className="border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">오늘 우선 연락 고객</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md bg-muted p-2">
              <p className="text-muted-foreground">추천 고객</p>
              <p className="text-lg font-semibold">{recommendationSummary?.priorityContactCount ?? 0}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-muted-foreground">긴급</p>
              <p className="text-lg font-semibold text-red-600">{recommendationSummary?.highUrgencyCount ?? 0}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-muted-foreground">경고</p>
              <p className="text-lg font-semibold text-amber-600">{recommendationSummary?.warningCount ?? 0}</p>
            </div>
          </div>
          {(recommendationSummary?.topContacts ?? []).length === 0 ? (
            <EmptyLine>오늘 우선 연락 추천 고객이 없습니다.</EmptyLine>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {recommendationSummary?.topContacts.map((contact) => (
                <button key={contact.customerId} type="button" onClick={() => setLocation(`/customers/${contact.customerId}`)} className="rounded-md border p-2 text-left hover:bg-accent">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{contact.customerName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${contact.urgency === "high" ? "bg-red-100 text-red-700" : contact.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                      {contact.urgency}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{contact.reasons.slice(0, 2).join(" · ") || contact.recommendedAction}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">오늘 일정</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.todaySchedules ?? []).length === 0 ? (
              <EmptyLine>오늘 예정된 상담이 없습니다.</EmptyLine>
            ) : data?.todaySchedules.map((schedule) => (
              <button key={schedule.id} type="button" onClick={() => setLocation("/calendar")} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{schedule.title}</span>
                  <StatusBadge status={schedule.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(schedule.startTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {schedule.type}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">미확인 알림</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.pendingNotifications ?? []).length === 0 ? (
              <EmptyLine>미확인 알림이 없습니다.</EmptyLine>
            ) : data?.pendingNotifications.map((notification) => (
              <button key={notification.id} type="button" onClick={() => setLocation("/notifications")} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{notification.title}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{notification.processStatus}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {notification.customerName ? `${notification.customerName} · ` : ""}{notification.type}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">장기 미관리 고객</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.longUnmanagedCustomers ?? []).length === 0 ? (
              <EmptyLine>장기 미관리 고객이 없습니다.</EmptyLine>
            ) : data?.longUnmanagedCustomers.filter((customer) => customer !== null).map((customer) => (
              <button key={customer.id} type="button" onClick={() => setLocation(`/customers/${customer.id}`)} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{customer.name}</span>
                  <StatusBadge status={customer.consultStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">알림 생성일 {new Date(customer.createdAt).toLocaleDateString("ko-KR")}</p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">오늘 연락 대상</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.todayFollowUps ?? []).length === 0 ? (
              <EmptyLine>오늘 연락할 고객이 없습니다.</EmptyLine>
            ) : data?.todayFollowUps.map((followUp) => (
              <button key={followUp.id} type="button" onClick={() => setLocation(`/customers/${followUp.customerId}`)} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{followUp.customerName ?? `고객 #${followUp.customerId}`}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{followUp.nextAction}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{followUp.reason}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function PerformanceGoalSummaryCard() {
  const [, setLocation] = useLocation();
  const { data } = trpc.performanceGoals.dashboard.useQuery({});
  const firstGoal = data?.items?.[0];

  if (!firstGoal) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">이번 달 목표</p>
            <p className="mt-1 text-xs text-muted-foreground">설정된 목표가 없습니다.</p>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs text-primary hover:underline">
            목표관리 보기
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">이번 달 목표 대비 성과</p>
              <p className="text-xs text-muted-foreground">{firstGoal.targetLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">신규 계약 달성률</p>
              <p className="font-semibold">{firstGoal.achievementRate.contractCount ?? "-"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">월납 달성률</p>
              <p className="font-semibold">{firstGoal.achievementRate.monthlyPremium ?? "-"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">부족 신규 계약</p>
              <p className="font-semibold">{firstGoal.remaining.contractCount}건</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">남은 기간</p>
              <p className="font-semibold">{firstGoal.remainingDays}일</p>
            </div>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs text-primary hover:underline">
            자세히 보기
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkRhythmSummaryCard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.workRhythm.summary.useQuery({ period: "week" });

  return (
    <Card className="border-sky-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">업무 리듬 리포트</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">이번 주 상담기록</p>
            <p className="text-lg font-semibold">{isLoading ? "-" : data?.consultationCount ?? 0}</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">후속관리 완료율</p>
            <p className="text-lg font-semibold">{data?.followUpCompletionRate ?? "-"}%</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">미처리 후속관리</p>
            <p className="text-lg font-semibold">{isLoading ? "-" : data?.overdueFollowUpCount ?? 0}</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">오늘 필요 상담</p>
            <p className="text-lg font-semibold">{isLoading ? "-" : data?.recommendedTodayActions?.suggestedConsultationCount ?? 0}</p>
          </div>
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">목표까지 부족 신규 계약</p>
            <p className="mt-1 font-semibold">{data?.remaining?.contractCount ?? 0}건</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">목표까지 부족 월납보험료</p>
            <p className="mt-1 font-semibold">{(data?.remaining?.monthlyPremium ?? 0).toLocaleString()}원</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">일평균 필요 신규 계약</p>
            <p className="mt-1 font-semibold">{data?.dailyRequired?.contractCount ?? 0}건</p>
          </div>
        </div>
        {(data?.insights ?? []).length > 0 ? (
          <div className="space-y-1 rounded-md bg-sky-50 p-3 text-xs text-sky-800">
            {data?.insights.slice(0, 3).map((item) => <p key={item}>• {item}</p>)}
          </div>
        ) : null}
        <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs text-primary hover:underline">
          목표관리에서 자세히 보기
        </button>
      </CardContent>
    </Card>
  );
}

function SubBranchAdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.performance.stats.useQuery();
  const { data: myBranchAdminStats } = trpc.performance.stats.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });
  const { data: notifResult } = trpc.notifications.list.useQuery({});
  const notifications = notifResult?.items ?? [];
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery({});
  const { data: myBranchAdminCustomers } = trpc.customers.list.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });
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
        <TodayWorkSection />
        <PerformanceGoalSummaryCard />
        <WorkRhythmSummaryCard />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="배분받은 전체 DB" value={allDb.length} icon={Users} />
          <StatCard title="미배정 DB" value={assignedToSubBranch.length} icon={Users} color="text-orange-500" />
          <StatCard title="배정 완료 DB" value={assignedToAgent.length} icon={Users} color="text-green-600" />
          <StatCard title="산하 신규 계약" value={stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted} icon={FileText} color="text-blue-600" />
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
  const { data: myBranchAdminStats } = trpc.performance.stats.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });
  const { data: notifResult } = trpc.notifications.list.useQuery({});
  const notifications = notifResult?.items ?? [];
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery({});
  const { data: myBranchAdminCustomers } = trpc.customers.list.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });

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

        <TodayWorkSection />
        <PerformanceGoalSummaryCard />
        <WorkRhythmSummaryCard />

        {user?.role === "branch_admin" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="내 DB" value={myBranchAdminCustomers?.length ?? 0} icon={Users} color="text-sky-600" />
            <StatCard title="내 신규 계약" value={myBranchAdminStats?.newContractCount ?? myBranchAdminStats?.contractCount ?? myBranchAdminStats?.contracted ?? 0} icon={FileText} color="text-green-600" />
            <StatCard title="내 월납보험료 실적" value={(myBranchAdminStats?.monthlyPremiumTotal ?? myBranchAdminStats?.monthlyPremiumSum)?.toLocaleString() ?? 0} icon={TrendingUp} suffix="원" color="text-blue-600" />
            <StatCard title="전체 DB" value={customers?.length ?? 0} icon={Users} />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="배정 DB" value={stats?.assigned} icon={Users} />
          <StatCard title="미상담" value={stats?.uncontacted} icon={AlertCircle} color="text-orange-500" />
          <StatCard title="신규 계약" value={stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted} icon={FileText} color="text-green-600" />
          <StatCard title="월납보험료 실적" value={(stats?.monthlyPremiumTotal ?? stats?.monthlyPremiumSum)?.toLocaleString()} icon={TrendingUp} suffix="원" color="text-blue-600" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="상담률" value={stats?.consultRate} icon={Phone} suffix="%" />
          <StatCard title="계약률" value={stats?.contractRate} icon={BarChart3} suffix="%" color="text-green-600" />
          <StatCard title="부재율" value={stats?.absentRate} icon={AlertCircle} suffix="%" color="text-orange-500" />
          <StatCard title="신규 계약률" value={stats?.contractRate} icon={BarChart3} suffix="%" color="text-green-600" />
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
                { label: "신규 계약", value: stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted },
                { label: "보류", value: undefined },
                { label: "거절", value: undefined },
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
