import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LayoutGrid,
  Phone,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useLocation } from "wouter";

function formatNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return "0";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

function formatWon(value: number | undefined) {
  return `${(value ?? 0).toLocaleString()}원`;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function PremiumStatCard({
  title,
  value,
  icon: Icon,
  tone = "navy",
  helper,
  suffix = "",
}: {
  title: string;
  value: number | string | undefined;
  icon: React.ElementType;
  tone?: "navy" | "gold" | "green" | "orange" | "red" | "blue";
  helper?: string;
  suffix?: string;
}) {
  const toneClass = {
    navy: "bg-slate-950 text-white",
    gold: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-sky-100 text-sky-700",
  }[tone];

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/95">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {formatNumber(value)}
              {suffix ? <span className="ml-1 text-sm font-semibold text-muted-foreground">{suffix}</span> : null}
            </p>
            {helper ? <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p> : null}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200/80 bg-white/95">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-2 px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

function TodayWorkSection() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.todayWork.useQuery({});
  const { data: recommendationSummary } = trpc.recommendations.dashboardSummary.useQuery({});
  const cards = data?.cards;
  const topContacts = recommendationSummary?.topContacts ?? [];

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <PremiumStatCard title="오늘 상담 예정" value={isLoading ? "-" : cards?.todayScheduleCount} icon={CalendarDays} tone="blue" helper="오늘 진행할 일정" />
        <PremiumStatCard title="오늘 연락 대상" value={isLoading ? "-" : cards?.todayFollowUpCount} icon={Phone} tone="gold" helper="후속 연락 예정" />
        <PremiumStatCard title="미완료 일정" value={isLoading ? "-" : cards?.incompleteScheduleCount} icon={AlertCircle} tone="orange" helper="처리 필요 일정" />
        <PremiumStatCard title="미확인 알림" value={isLoading ? "-" : cards?.pendingNotificationCount} icon={Bell} tone="red" helper="확인 대기" />
        <PremiumStatCard title="미처리 후속관리" value={isLoading ? "-" : cards?.overdueFollowUpCount} icon={Clock3} tone="red" helper="기한 경과" />
        <PremiumStatCard title="이번 달 신규 계약" value={isLoading ? "-" : cards?.monthlyContractCount} icon={FileText} tone="green" helper="신규 영업 성과" />
        <PremiumStatCard title="월납보험료 실적" value={isLoading ? "-" : formatWon(cards?.monthlyPremiumSum)} icon={TrendingUp} tone="navy" helper="입력 계약 기준" />
      </div>

      <Card className="border-amber-200/80 bg-gradient-to-br from-white to-amber-50/40">
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Target className="h-4 w-4" />
              </span>
              오늘 우선 연락 고객
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">후속관리, 우선순위, 경고 기준으로 먼저 볼 고객을 정리했습니다.</p>
          </div>
          <div className="hidden grid-cols-3 gap-2 text-xs sm:grid">
            <div className="rounded-xl bg-white/80 px-3 py-2 text-center">
              <p className="text-muted-foreground">추천</p>
              <p className="text-lg font-bold text-slate-950">{recommendationSummary?.priorityContactCount ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 text-center">
              <p className="text-muted-foreground">긴급</p>
              <p className="text-lg font-bold text-red-600">{recommendationSummary?.highUrgencyCount ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 text-center">
              <p className="text-muted-foreground">경고</p>
              <p className="text-lg font-bold text-amber-700">{recommendationSummary?.warningCount ?? 0}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {topContacts.length === 0 ? (
            <EmptyState>오늘 우선 연락 추천 고객이 없습니다.</EmptyState>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {topContacts.slice(0, 5).map((contact) => (
                <button
                  key={contact.customerId}
                  type="button"
                  onClick={() => setLocation(`/customers/${contact.customerId}`)}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-amber-300 hover:bg-amber-50/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-slate-950">{contact.customerName}</span>
                    <Badge className={contact.urgency === "high" ? "border-0 bg-red-100 text-red-700" : contact.urgency === "medium" ? "border-0 bg-amber-100 text-amber-700" : "border-0 bg-slate-100 text-slate-600"}>
                      {contact.urgency === "high" ? "높음" : contact.urgency === "medium" ? "중간" : "낮음"}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {contact.reasons.slice(0, 2).join(" · ") || contact.recommendedAction}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SectionCard title="오늘의 일정" icon={CalendarDays} action={<button type="button" onClick={() => setLocation("/calendar")} className="text-xs font-semibold text-primary">전체 보기</button>}>
          {(data?.todaySchedules ?? []).length === 0 ? (
            <EmptyState>오늘 예정된 일정이 없습니다.</EmptyState>
          ) : data?.todaySchedules.slice(0, 5).map((schedule) => (
            <button key={schedule.id} type="button" onClick={() => setLocation("/calendar")} className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-950">{schedule.title}</span>
                <StatusBadge status={schedule.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(schedule.startTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {schedule.type}
              </p>
            </button>
          ))}
        </SectionCard>

        <SectionCard title="중요 알림" icon={Bell} action={<button type="button" onClick={() => setLocation("/notifications")} className="text-xs font-semibold text-primary">알림센터</button>}>
          {(data?.pendingNotifications ?? []).length === 0 ? (
            <EmptyState>미확인 알림이 없습니다.</EmptyState>
          ) : data?.pendingNotifications.slice(0, 5).map((notification) => (
            <button key={notification.id} type="button" onClick={() => setLocation("/notifications")} className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-950">{notification.title}</span>
                <span className="text-[11px] text-muted-foreground">{notification.processStatus}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {notification.customerName ? `${notification.customerName} · ` : ""}{notification.type}
              </p>
            </button>
          ))}
        </SectionCard>

        <SectionCard title="장기 미관리 고객" icon={Users}>
          {(data?.longUnmanagedCustomers ?? []).filter(Boolean).length === 0 ? (
            <EmptyState>장기 미관리 고객이 없습니다.</EmptyState>
          ) : data?.longUnmanagedCustomers.filter(Boolean).slice(0, 5).map((customer) => (
            <button key={customer.id} type="button" onClick={() => setLocation(`/customers/${customer.id}`)} className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-950">{customer.name}</span>
                <StatusBadge status={customer.consultStatus} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">알림 생성일 {new Date(customer.createdAt).toLocaleDateString("ko-KR")}</p>
            </button>
          ))}
        </SectionCard>

        <SectionCard title="오늘 연락 대상" icon={Phone}>
          {(data?.todayFollowUps ?? []).length === 0 ? (
            <EmptyState>오늘 연락할 고객이 없습니다.</EmptyState>
          ) : data?.todayFollowUps.slice(0, 5).map((followUp) => (
            <button key={followUp.id} type="button" onClick={() => setLocation(`/customers/${followUp.customerId}`)} className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-950">{followUp.customerName ?? `고객 #${followUp.customerId}`}</span>
                <span className="text-[11px] text-muted-foreground">{followUp.nextAction}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{followUp.reason}</p>
            </button>
          ))}
        </SectionCard>
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
      <Card className="border-slate-200/80 bg-white/95">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-950">이번 달 목표</p>
            <p className="mt-1 text-xs text-muted-foreground">설정된 목표가 없습니다.</p>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            목표관리 보기 <ChevronRight className="h-3 w-3" />
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/15 bg-white/95">
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-amber-300">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">목표 대비 성과</p>
              <p className="text-xs text-muted-foreground">{firstGoal.targetLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">신규 계약 달성률</p>
              <p className="mt-1 font-bold text-slate-950">{firstGoal.achievementRate.contractCount ?? "-"}%</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">월납 달성률</p>
              <p className="mt-1 font-bold text-slate-950">{firstGoal.achievementRate.monthlyPremium ?? "-"}%</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">부족 신규 계약</p>
              <p className="mt-1 font-bold text-slate-950">{firstGoal.remaining.contractCount}건</p>
            </div>
            <div className="boa-soft-card p-3">
              <p className="text-xs text-muted-foreground">남은 기간</p>
              <p className="mt-1 font-bold text-slate-950">{firstGoal.remainingDays}일</p>
            </div>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            자세히 보기 <ChevronRight className="h-3 w-3" />
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
    <Card className="border-sky-200/80 bg-white/95">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <BarChart3 className="h-4 w-4" />
          </span>
          업무 리듬 리포트
        </CardTitle>
        <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs font-semibold text-primary">
          목표관리
        </button>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">이번 주 상담기록</p>
            <p className="mt-1 text-xl font-bold">{isLoading ? "-" : data?.consultationCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">후속관리 완료율</p>
            <p className="mt-1 text-xl font-bold">{data?.followUpCompletionRate ?? "-"}%</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">미처리 후속관리</p>
            <p className="mt-1 text-xl font-bold">{isLoading ? "-" : data?.overdueFollowUpCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">오늘 필요 상담</p>
            <p className="mt-1 text-xl font-bold">{isLoading ? "-" : data?.recommendedTodayActions?.suggestedConsultationCount ?? 0}</p>
          </div>
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-muted-foreground">목표까지 부족 신규 계약</p>
            <p className="mt-1 font-bold text-slate-950">{data?.remaining?.contractCount ?? 0}건</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-muted-foreground">목표까지 부족 월납보험료</p>
            <p className="mt-1 font-bold text-slate-950">{formatWon(data?.remaining?.monthlyPremium)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-muted-foreground">일평균 필요 신규 계약</p>
            <p className="mt-1 font-bold text-slate-950">{data?.dailyRequired?.contractCount ?? 0}건</p>
          </div>
        </div>
        {(data?.insights ?? []).length > 0 ? (
          <div className="space-y-1 rounded-2xl bg-sky-50 p-3 text-xs text-sky-800">
            {data?.insights.slice(0, 3).map((item) => <p key={item}>· {item}</p>)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.performance.stats.useQuery();
  const { data: myBranchAdminStats } = trpc.performance.stats.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });
  const { data: notifResult } = trpc.notifications.list.useQuery({});
  const notifications = notifResult?.items ?? [];
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery({});
  const { data: myBranchAdminCustomers } = trpc.customers.list.useQuery({ scope: "mine" }, { enabled: user?.role === "branch_admin" });

  const today = new Date();
  const todaySchedules = schedules?.filter((schedule) => new Date(schedule.startTime).toDateString() === today.toDateString()) ?? [];
  const unreadNotifs = notifications.filter((notification: any) => !notification.isRead);
  const recentCustomers = customers?.slice(0, 5) ?? [];
  const roleTitle =
    user?.role === "branch_admin" ? "지점장" :
    user?.role === "sub_branch_admin" ? "부지점장" :
    user?.role === "team_leader" ? "팀장" : "팀원";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <Badge className="border-0 bg-amber-300/15 text-amber-200">BOA Premium CRM</Badge>
              <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                {user?.name}님, 오늘의 지점 운영 흐름입니다.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                신규 계약, 월납보험료 실적, 일정, 알림, 후속관리까지 권한 범위 안에서 필요한 업무를 빠르게 확인하세요.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs text-slate-300">오늘 날짜</p>
                <p className="mt-2 text-lg font-bold">{today.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs text-slate-300">로그인 역할</p>
                <p className="mt-2 text-lg font-bold">{roleTitle}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLocation("/sales-pipeline")}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            <LayoutGrid className="h-4 w-4 text-amber-600" />
            세일즈 파이프라인
          </button>
        </div>

        <TodayWorkSection />

        {user?.role === "branch_admin" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PremiumStatCard title="내 DB" value={myBranchAdminCustomers?.length ?? 0} icon={Users} tone="blue" helper="지점장 직접 담당" />
            <PremiumStatCard title="내 신규 계약" value={myBranchAdminStats?.newContractCount ?? myBranchAdminStats?.contractCount ?? myBranchAdminStats?.contracted ?? 0} icon={FileText} tone="green" helper="내 담당 기준" />
            <PremiumStatCard title="내 월납보험료 실적" value={formatWon(myBranchAdminStats?.monthlyPremiumTotal ?? myBranchAdminStats?.monthlyPremiumSum)} icon={WalletCards} tone="gold" helper="내 담당 기준" />
            <PremiumStatCard title="전체 DB" value={customers?.length ?? 0} icon={Users} tone="navy" helper="지점 전체 권한" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PremiumStatCard title="배정 DB" value={stats?.assigned} icon={Users} tone="navy" helper="권한 범위 기준" />
          <PremiumStatCard title="미상담" value={stats?.uncontacted} icon={AlertCircle} tone="orange" helper="초기 접촉 필요" />
          <PremiumStatCard title="신규 계약" value={stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted} icon={FileText} tone="green" helper="신규 영업 성과" />
          <PremiumStatCard title="월납보험료 실적" value={formatWon(stats?.monthlyPremiumTotal ?? stats?.monthlyPremiumSum)} icon={TrendingUp} tone="blue" helper="입력 계약 기준" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <PerformanceGoalSummaryCard />
          <WorkRhythmSummaryCard />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="최근 고객" icon={Users} action={<button type="button" onClick={() => setLocation("/customers")} className="text-xs font-semibold text-primary">고객 DB</button>}>
            {recentCustomers.length === 0 ? (
              <EmptyState>표시할 고객이 없습니다.</EmptyState>
            ) : recentCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setLocation(`/customers/${customer.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{customer.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{customer.region ?? "지역 미입력"}</p>
                </div>
                <StatusBadge status={customer.consultStatus} />
              </button>
            ))}
          </SectionCard>

          <SectionCard title="오늘 일정" icon={CalendarDays} action={<button type="button" onClick={() => setLocation("/calendar")} className="text-xs font-semibold text-primary">일정 보기</button>}>
            {todaySchedules.length === 0 ? (
              <EmptyState>오늘 일정이 없습니다.</EmptyState>
            ) : todaySchedules.slice(0, 5).map((schedule) => (
              <div key={schedule.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-950">{schedule.title}</p>
                  <StatusBadge status={schedule.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(schedule.startTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {schedule.type}
                </p>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="중요 알림" icon={Bell} action={<button type="button" onClick={() => setLocation("/notifications")} className="text-xs font-semibold text-primary">알림 보기</button>}>
            {unreadNotifs.length === 0 ? (
              <EmptyState>새 알림이 없습니다.</EmptyState>
            ) : unreadNotifs.slice(0, 5).map((notification) => (
              <div key={notification.id} className="rounded-2xl border-l-4 border-amber-300 bg-amber-50/70 p-3">
                <p className="truncate text-sm font-semibold text-slate-950">{notification.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
              </div>
            ))}
          </SectionCard>
        </div>

        <Card className="border-slate-200/80 bg-white/95">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-base">상담 현황 요약</CardTitle>
            <button
              type="button"
              onClick={() => setLocation("/sales-pipeline")}
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              칸반으로 보기
            </button>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {[
                { label: "미상담", value: stats?.uncontacted },
                { label: "부재", value: stats?.absent },
                { label: "통화완료", value: stats?.called },
                { label: "상담예정", value: stats?.scheduled },
                { label: "설계중", value: stats?.designing },
                { label: "신규 계약", value: stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted },
                { label: "상담률", value: `${stats?.consultRate ?? 0}%` },
                { label: "신규 계약률", value: `${stats?.contractRate ?? 0}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-950">{item.value ?? 0}</p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-300" />
              BOA CRM은 신규 계약과 월납보험료 실적을 중심으로 표시합니다. 계약 유지 상태는 GA 본사 전산 기준으로 확인합니다.
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
