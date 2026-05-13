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

// ?Ä?Ä?Ä Î∂ÄÏßÄ?êÏû• ?ÑÏö© ?Ä?úÎ≥¥???Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
function formatWon(value: number | undefined) {
  return `${(value ?? 0).toLocaleString()}??;
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
        <h2 className="text-lg font-semibold">?§Îäò ????/h2>
        <p className="text-xs text-muted-foreground mt-1">Í∂åÌïú Î≤îÏúÑ ?àÏùò ?ºÏ†ï, ?åÎ¶º, ?•Í∏∞ ÎØ∏Í?Î¶?Í≥†Í∞ù, ?¥Î≤à ??Í≥ÑÏïΩ ?ÑÌô©?ÖÎãà??</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <StatCard title="?§Îäò ?ÅÎã¥ ?àÏ†ï" value={isLoading ? "-" : cards?.todayScheduleCount} icon={CalendarDays} />
        <StatCard title="ÎØ∏ÏôÑÎ£??ºÏ†ï" value={isLoading ? "-" : cards?.incompleteScheduleCount} icon={AlertCircle} color="text-orange-500" />
        <StatCard title="ÎØ∏Ìôï???åÎ¶º" value={isLoading ? "-" : cards?.pendingNotificationCount} icon={Bell} color="text-red-500" />
        <StatCard title="?•Í∏∞ ÎØ∏Í?Î¶?Í≥†Í∞ù" value={isLoading ? "-" : cards?.longUnmanagedCustomerCount} icon={Users} color="text-amber-600" />
        <StatCard title="?§Îäò ?∞ÎùΩ ?Ä?? value={isLoading ? "-" : cards?.todayFollowUpCount} icon={Phone} color="text-sky-600" />
        <StatCard title="ÎØ∏Ï≤òÎ¶??ÑÏÜçÍ¥ÄÎ¶? value={isLoading ? "-" : cards?.overdueFollowUpCount} icon={AlertCircle} color="text-red-600" />
        <StatCard title="?¥Î≤à ??Í≥ÑÏïΩ" value={isLoading ? "-" : cards?.monthlyContractCount} icon={FileText} color="text-green-600" />
        <StatCard title="?¥Î≤à ???îÎÇ©Î≥¥ÌóòÎ£? value={isLoading ? "-" : formatWon(cards?.monthlyPremiumSum)} icon={TrendingUp} color="text-blue-600" />
      </div>
      <Card className="border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">?§Îäò ?∞ÏÑ† ?∞ÎùΩ Í≥†Í∞ù</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md bg-muted p-2">
              <p className="text-muted-foreground">Ï∂îÏ≤ú Í≥†Í∞ù</p>
              <p className="text-lg font-semibold">{recommendationSummary?.priorityContactCount ?? 0}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-muted-foreground">Í∏¥Í∏â</p>
              <p className="text-lg font-semibold text-red-600">{recommendationSummary?.highUrgencyCount ?? 0}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-muted-foreground">Í≤ΩÍ≥†</p>
              <p className="text-lg font-semibold text-amber-600">{recommendationSummary?.warningCount ?? 0}</p>
            </div>
          </div>
          {(recommendationSummary?.topContacts ?? []).length === 0 ? (
            <EmptyLine>?§Îäò ?∞ÏÑ† ?∞ÎùΩ Ï∂îÏ≤ú Í≥†Í∞ù???ÜÏäµ?àÎã§.</EmptyLine>
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
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{contact.reasons.slice(0, 2).join(" ¬∑ ") || contact.recommendedAction}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">?§Îäò ?ºÏ†ï</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.todaySchedules ?? []).length === 0 ? (
              <EmptyLine>?§Îäò ?àÏ†ï???ÅÎã¥???ÜÏäµ?àÎã§.</EmptyLine>
            ) : data?.todaySchedules.map((schedule) => (
              <button key={schedule.id} type="button" onClick={() => setLocation("/calendar")} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{schedule.title}</span>
                  <StatusBadge status={schedule.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(schedule.startTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ¬∑ {schedule.type}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">ÎØ∏Ìôï???åÎ¶º</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.pendingNotifications ?? []).length === 0 ? (
              <EmptyLine>ÎØ∏Ìôï???åÎ¶º???ÜÏäµ?àÎã§.</EmptyLine>
            ) : data?.pendingNotifications.map((notification) => (
              <button key={notification.id} type="button" onClick={() => setLocation("/notifications")} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{notification.title}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{notification.processStatus}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {notification.customerName ? `${notification.customerName} ¬∑ ` : ""}{notification.type}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">?•Í∏∞ ÎØ∏Í?Î¶?Í≥†Í∞ù</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.longUnmanagedCustomers ?? []).length === 0 ? (
              <EmptyLine>?•Í∏∞ ÎØ∏Í?Î¶?Í≥†Í∞ù???ÜÏäµ?àÎã§.</EmptyLine>
            ) : data?.longUnmanagedCustomers.filter((customer) => customer !== null).map((customer) => (
              <button key={customer.id} type="button" onClick={() => setLocation(`/customers/${customer.id}`)} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{customer.name}</span>
                  <StatusBadge status={customer.consultStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">?åÎ¶º ?ùÏÑ±??{new Date(customer.createdAt).toLocaleDateString("ko-KR")}</p>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">?§Îäò ?∞ÎùΩ ?Ä??/CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.todayFollowUps ?? []).length === 0 ? (
              <EmptyLine>?§Îäò ?∞ÎùΩ??Í≥†Í∞ù???ÜÏäµ?àÎã§.</EmptyLine>
            ) : data?.todayFollowUps.map((followUp) => (
              <button key={followUp.id} type="button" onClick={() => setLocation(`/customers/${followUp.customerId}`)} className="min-h-14 w-full rounded-md border p-2 text-left hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{followUp.customerName ?? `Í≥†Í∞ù #${followUp.customerId}`}</span>
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
            <p className="text-sm font-semibold">?¥Î≤à ??Î™©Ìëú</p>
            <p className="mt-1 text-xs text-muted-foreground">?§Ï†ï??Î™©ÌëúÍ∞Ä ?ÜÏäµ?àÎã§.</p>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs text-primary hover:underline">
            Î™©ÌëúÍ¥ÄÎ¶?Î≥¥Í∏∞
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
              <p className="text-sm font-semibold">?¥Î≤à ??Î™©Ìëú ?ÄÎπ??±Í≥º</p>
              <p className="text-xs text-muted-foreground">{firstGoal.targetLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">?†Í∑ú Í≥ÑÏïΩ ?¨ÏÑ±Î•?/p>
              <p className="font-semibold">{firstGoal.achievementRate.contractCount ?? "-"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">?îÎÇ© ?¨ÏÑ±Î•?/p>
              <p className="font-semibold">{firstGoal.achievementRate.monthlyPremium ?? "-"}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Î∂ÄÏ°??†Í∑ú Í≥ÑÏïΩ</p>
              <p className="font-semibold">{firstGoal.remaining.contractCount}Í±?/p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">?®Ï? Í∏∞Í∞Ñ</p>
              <p className="font-semibold">{firstGoal.remainingDays}??/p>
            </div>
          </div>
          <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs text-primary hover:underline">
            ?êÏÑ∏??Î≥¥Í∏∞
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
        <CardTitle className="text-sm">?ÖÎ¨¥ Î¶¨Îì¨ Î¶¨Ìè¨??/CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">?¥Î≤à Ï£??ÅÎã¥Í∏∞Î°ù</p>
            <p className="text-lg font-semibold">{isLoading ? "-" : data?.consultationCount ?? 0}</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">?ÑÏÜçÍ¥ÄÎ¶??ÑÎ£å??/p>
            <p className="text-lg font-semibold">{data?.followUpCompletionRate ?? "-"}%</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">ÎØ∏Ï≤òÎ¶??ÑÏÜçÍ¥ÄÎ¶?/p>
            <p className="text-lg font-semibold">{isLoading ? "-" : data?.overdueFollowUpCount ?? 0}</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-xs text-muted-foreground">?§Îäò ?ÑÏöî ?ÅÎã¥</p>
            <p className="text-lg font-semibold">{isLoading ? "-" : data?.recommendedTodayActions?.suggestedConsultationCount ?? 0}</p>
          </div>
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Î™©ÌëúÍπåÏ? Î∂ÄÏ°??†Í∑ú Í≥ÑÏïΩ</p>
            <p className="mt-1 font-semibold">{data?.remaining?.contractCount ?? 0}Í±?/p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Î™©ÌëúÍπåÏ? Î∂ÄÏ°??îÎÇ©Î≥¥ÌóòÎ£?/p>
            <p className="mt-1 font-semibold">{(data?.remaining?.monthlyPremium ?? 0).toLocaleString()}??/p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">?ºÌèâÍ∑??ÑÏöî ?†Í∑ú Í≥ÑÏïΩ</p>
            <p className="mt-1 font-semibold">{data?.dailyRequired?.contractCount ?? 0}Í±?/p>
          </div>
        </div>
        {(data?.insights ?? []).length > 0 ? (
          <div className="space-y-1 rounded-md bg-sky-50 p-3 text-xs text-sky-800">
            {data?.insights.slice(0, 3).map((item) => <p key={item}>??{item}</p>)}
          </div>
        ) : null}
        <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs text-primary hover:underline">
          Î™©ÌëúÍ¥ÄÎ¶¨Ïóê???êÏÑ∏??Î≥¥Í∏∞
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
          <h1 className="text-2xl font-bold">?Ä?úÎ≥¥??/h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.name} (Î∂ÄÏßÄ?êÏû•) ¬∑ {today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
        </div>
        <TodayWorkSection />
        <PerformanceGoalSummaryCard />
        <WorkRhythmSummaryCard />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Î∞∞Î∂ÑÎ∞õÏ? ?ÑÏ≤¥ DB" value={allDb.length} icon={Users} />
          <StatCard title="ÎØ∏Î∞∞??DB" value={assignedToSubBranch.length} icon={Users} color="text-orange-500" />
          <StatCard title="Î∞∞Ï†ï ?ÑÎ£å DB" value={assignedToAgent.length} icon={Users} color="text-green-600" />
          <StatCard title="?∞Ìïò ?†Í∑ú Í≥ÑÏïΩ" value={stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted} icon={FileText} color="text-blue-600" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="?îÎÇ©Î≥¥ÌóòÎ£??©Í≥Ñ" value={stats?.monthlyPremiumSum?.toLocaleString()} icon={TrendingUp} suffix="?? color="text-blue-600" />
          <StatCard title="?§Îäò ?ºÏ†ï" value={todaySchedules.length} icon={CalendarDays} />
          <StatCard title="ÎØ∏ÏùΩ?Ä ?åÎ¶º" value={unreadNotifs.length} icon={Bell} color="text-red-500" />
          <StatCard title="ÎØ∏ÏÉÅ??DB" value={allDb.filter((c) => c.consultStatus === "ÎØ∏ÏÉÅ??).length} icon={Phone} color="text-orange-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">?∞Ìïò ?Ä?êÎ≥Ñ Í≥†Í∞ù ?ÑÌô©</CardTitle></CardHeader>
            <CardContent className="p-0">
              {myTeamMembers.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">?∞Ìïò ?Ä?êÏù¥ ?ÜÏäµ?àÎã§.</div>
              ) : (
                <table className="w-full text-sm"><thead className="border-b"><tr className="text-xs text-muted-foreground"><th className="text-left p-3">?¥Î¶Ñ</th><th className="text-left p-3">??ï†</th><th className="text-right p-3">Î∞∞Ï†ï Í≥†Í∞ù</th><th className="text-right p-3">ÎØ∏ÏÉÅ??/th></tr></thead>
                <tbody className="divide-y">{myTeamMembers.map((u) => { const mc = allDb.filter((c) => c.agentId === u.id); return (<tr key={u.id}><td className="p-3 font-medium">{u.name}</td><td className="p-3 text-xs text-muted-foreground">{u.role === "team_leader" ? "?Ä?? : "?Ä??}</td><td className="p-3 text-right">{mc.length}</td><td className="p-3 text-right text-orange-600">{mc.filter((c) => c.consultStatus === "ÎØ∏ÏÉÅ??).length}</td></tr>); })}</tbody></table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">ÎØ∏Î∞∞??DB Î™©Î°ù</CardTitle></CardHeader>
            <CardContent className="p-0">
              {assignedToSubBranch.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">ÎØ∏Î∞∞??DBÍ∞Ä ?ÜÏäµ?àÎã§.</div>
              ) : (
                <div className="divide-y max-h-48 overflow-y-auto">
                  {assignedToSubBranch.slice(0, 8).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/customers/${c.id}`)}
                    ><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-muted-foreground">{c.region ?? "-"}</p></div><StatusBadge status={c.consultStatus} /></div>
                  ))}
                  {assignedToSubBranch.length > 8 && <div className="p-3 text-center text-xs text-muted-foreground">+{assignedToSubBranch.length - 8}Î™????àÏùå</div>}
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
    user?.role === "branch_admin" ? "Í¥ÄÎ¶¨Ïûê" : user?.role === "team_leader" ? "?Ä?? : "?Ä??;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">?Ä?úÎ≥¥??/h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.name} ({roleTitle}) ¬∑ {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>

        <TodayWorkSection />
        <PerformanceGoalSummaryCard />
        <WorkRhythmSummaryCard />

        {user?.role === "branch_admin" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="??DB" value={myBranchAdminCustomers?.length ?? 0} icon={Users} color="text-sky-600" />
            <StatCard title="???†Í∑ú Í≥ÑÏïΩ" value={myBranchAdminStats?.newContractCount ?? myBranchAdminStats?.contractCount ?? myBranchAdminStats?.contracted ?? 0} icon={FileText} color="text-green-600" />
            <StatCard title="???îÎÇ©Î≥¥ÌóòÎ£??§Ï†Å" value={(myBranchAdminStats?.monthlyPremiumTotal ?? myBranchAdminStats?.monthlyPremiumSum)?.toLocaleString() ?? 0} icon={TrendingUp} suffix="?? color="text-blue-600" />
            <StatCard title="?ÑÏ≤¥ DB" value={customers?.length ?? 0} icon={Users} />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Î∞∞Ï†ï DB" value={stats?.assigned} icon={Users} />
          <StatCard title="ÎØ∏ÏÉÅ?? value={stats?.uncontacted} icon={AlertCircle} color="text-orange-500" />
          <StatCard title="?†Í∑ú Í≥ÑÏïΩ" value={stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted} icon={FileText} color="text-green-600" />
          <StatCard title="?îÎÇ©Î≥¥ÌóòÎ£??§Ï†Å" value={(stats?.monthlyPremiumTotal ?? stats?.monthlyPremiumSum)?.toLocaleString()} icon={TrendingUp} suffix="?? color="text-blue-600" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="?ÅÎã¥Î•? value={stats?.consultRate} icon={Phone} suffix="%" />
          <StatCard title="Í≥ÑÏïΩÎ•? value={stats?.contractRate} icon={BarChart3} suffix="%" color="text-green-600" />
          <StatCard title="Î∂Ä?¨Ïú®" value={stats?.absentRate} icon={AlertCircle} suffix="%" color="text-orange-500" />
          <StatCard title="?†Í∑ú Í≥ÑÏïΩÎ•? value={stats?.contractRate} icon={BarChart3} suffix="%" color="text-green-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ?§Îäò ?ºÏ†ï */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                ?§Îäò ?ºÏ†ï ({todaySchedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todaySchedules.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">?§Îäò ?ºÏ†ï???ÜÏäµ?àÎã§.</p>
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
                ?ÑÏ≤¥ Î≥¥Í∏∞ ??
              </button>
            </CardContent>
          </Card>

          {/* ÎØ∏ÏùΩ?Ä ?åÎ¶º */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" />
                ÎØ∏ÏùΩ?Ä ?åÎ¶º ({unreadNotifs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unreadNotifs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">???åÎ¶º???ÜÏäµ?àÎã§.</p>
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
                ?ÑÏ≤¥ Î≥¥Í∏∞ ??
              </button>
            </CardContent>
          </Card>

          {/* ÏµúÍ∑º Í≥†Í∞ù */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                ÏµúÍ∑º Í≥†Í∞ù
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentCustomers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Î∞∞Ï†ï??Í≥†Í∞ù???ÜÏäµ?àÎã§.</p>
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
                ?ÑÏ≤¥ Î≥¥Í∏∞ ??
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ?ÅÌÉúÎ≥??ÑÌô© */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">?ÅÎã¥ ?ÑÌô© ?îÏïΩ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
              {[
                { label: "ÎØ∏ÏÉÅ??, value: stats?.uncontacted },
                { label: "Î∂Ä??, value: stats?.absent },
                { label: "?µÌôî?ÑÎ£å", value: stats?.called },
                { label: "?ÅÎã¥?àÏ†ï", value: stats?.scheduled },
                { label: "?§Í≥ÑÏ§?, value: stats?.designing },
                { label: "?†Í∑ú Í≥ÑÏïΩ", value: stats?.newContractCount ?? stats?.contractCount ?? stats?.contracted },
                { label: "Î≥¥Î•ò", value: undefined },
                { label: "Í±∞Ï†à", value: undefined },
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
