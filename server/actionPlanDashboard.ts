import type {
  BranchActionPlan,
  DailyActionPlan,
  WeeklyActionPlan,
} from "../drizzle/schema";
import { isSubmittedPlanStatus } from "@shared/actionPlanDirectUpload";

export type DashboardUser = {
  id: number;
  name: string | null;
  role: string;
  teamId?: number | null;
};

export type ManagerDashboardInput = {
  targetMonth: string;
  weekNumber?: number;
  weekLabel?: string;
  todayDate: string;
  teamId?: number;
  role?: string;
  status?: string;
};

export type ManagerDashboardResult = {
  filters: ManagerDashboardInput;
  totals: {
    userCount: number;
    monthlyTargetRevenue: number;
    monthlyActualRevenue: number;
    monthlyAchievementRate: number;
    weeklyTargetRevenue: number;
    weeklyActualRevenue: number;
    weeklyAchievementRate: number;
    newContact: number;
    consultation: number;
    analysis: number;
    proposal: number;
    contract: number;
    introductionRequest: number;
    reconnect: number;
  };
  goalNotRegistered: DashboardUser[];
  todayPlanMissing: DashboardUser[];
  todayResultMissing: DashboardUser[];
  coachingRequestUsers: Array<DashboardUser & { coachingRequest?: string | null }>;
  warningSignals: Array<{
    user: DashboardUser;
    signals: string[];
  }>;
};

function filterUsers(users: DashboardUser[], input: ManagerDashboardInput) {
  return users.filter(u => {
    if (input.teamId != null && u.teamId !== input.teamId) return false;
    if (input.role && u.role !== input.role) return false;
    return true;
  });
}

function isMonthlySubmitted(plan?: BranchActionPlan | null) {
  return plan != null && isSubmittedPlanStatus(plan.status);
}

function isPlanSubmitted(plan?: { status: string } | null) {
  return plan != null && isSubmittedPlanStatus(plan.status);
}

function weekMatches(
  plan: WeeklyActionPlan,
  input: ManagerDashboardInput
): boolean {
  if (input.weekNumber != null && plan.weekNumber === input.weekNumber)
    return true;
  if (input.weekLabel && plan.weekLabel === input.weekLabel) return true;
  if (!input.weekNumber && !input.weekLabel) return true;
  return false;
}

export function buildManagerDashboard(
  users: DashboardUser[],
  monthlyPlans: BranchActionPlan[],
  weeklyPlans: WeeklyActionPlan[],
  dailyPlans: DailyActionPlan[],
  input: ManagerDashboardInput
): ManagerDashboardResult {
  const filteredUsers = filterUsers(users, input);
  const userIds = new Set(filteredUsers.map(u => u.id));

  const monthPlans = monthlyPlans.filter(p => userIds.has(p.userId));
  const weekPlans = weeklyPlans.filter(
    p => userIds.has(p.userId) && weekMatches(p, input)
  );
  const weekPlanIds = new Set(weekPlans.map(p => p.id));
  const today = input.todayDate;
  const todayDaily = dailyPlans.filter(
    p =>
      userIds.has(p.userId) &&
      weekPlanIds.has(p.weeklyPlanId) &&
      String(p.planDate).slice(0, 10) === today
  );

  const monthlyTargetRevenue = monthPlans.reduce(
    (s, p) => s + (p.monthlyRevenueTarget ?? p.monthlyPremiumTarget ?? 0),
    0
  );
  const weeklyTargetRevenue = weekPlans.reduce(
    (s, p) => s + (p.weeklyRevenueTarget ?? p.weeklyPremiumTarget ?? 0),
    0
  );
  const weeklyActualRevenue = todayDaily.reduce(
    (s, p) => s + (p.dailyRevenueTarget ?? 0),
    0
  );
  const monthlyActualRevenue = dailyPlans
    .filter(p => userIds.has(p.userId) && isPlanSubmitted(p))
    .reduce((s, p) => s + (p.dailyRevenueTarget ?? 0), 0);

  const activity = {
    newContact: todayDaily.reduce(
      (s, p) => s + (p.actualNewContactCount ?? p.actualCallCount ?? 0),
      0
    ),
    consultation: todayDaily.reduce(
      (s, p) => s + (p.actualConsultationCount ?? 0),
      0
    ),
    analysis: todayDaily.reduce(
      (s, p) => s + (p.actualAnalysisCount ?? 0),
      0
    ),
    proposal: todayDaily.reduce(
      (s, p) => s + (p.actualProposalCount ?? 0),
      0
    ),
    contract: todayDaily.reduce(
      (s, p) => s + (p.actualContractCount ?? 0),
      0
    ),
    introductionRequest: todayDaily.reduce(
      (s, p) => s + (p.actualIntroductionRequestCount ?? 0),
      0
    ),
    reconnect: todayDaily.reduce(
      (s, p) => s + (p.actualReconnectCount ?? p.actualFollowUpCount ?? 0),
      0
    ),
  };

  const goalNotRegistered = filteredUsers.filter(u => {
    const m = monthPlans.find(p => p.userId === u.id);
    return !m || !isMonthlySubmitted(m);
  });

  const todayPlanMissing = filteredUsers.filter(u => {
    const d = todayDaily.find(p => p.userId === u.id);
    return !d || !isPlanSubmitted(d);
  });

  const todayResultMissing = filteredUsers.filter(u => {
    const d = todayDaily.find(p => p.userId === u.id);
    if (!d || !isPlanSubmitted(d)) return true;
    const hasResult =
      (d.actualResultMemo?.trim()?.length ?? 0) > 0 ||
      d.actualNewContactCount > 0 ||
      d.actualConsultationCount > 0 ||
      d.actualAnalysisCount > 0 ||
      d.actualProposalCount > 0 ||
      d.actualContractCount > 0;
    return !hasResult;
  });

  const coachingRequestUsers = weekPlans
    .filter(p => (p.coachingRequest?.trim()?.length ?? 0) > 0)
    .map(p => {
      const user = filteredUsers.find(u => u.id === p.userId)!;
      return { ...user, coachingRequest: p.coachingRequest };
    });

  const warningSignals = filteredUsers
    .map(user => {
      const signals: string[] = [];
      const m = monthPlans.find(p => p.userId === user.id);
      if (!m || !isMonthlySubmitted(m)) signals.push("목표미등록");
      const d = todayDaily.find(p => p.userId === user.id);
      if (!d || !isPlanSubmitted(d)) signals.push("계획누락");
      if (todayResultMissing.some(u => u.id === user.id))
        signals.push("결과누락");
      const w = weekPlans.find(p => p.userId === user.id);
      if ((w?.coachingRequest?.trim()?.length ?? 0) > 0)
        signals.push("코칭요청");
      const lowActivity =
        d &&
        d.actualNewContactCount === 0 &&
        d.actualConsultationCount === 0 &&
        d.actualProposalCount === 0;
      if (lowActivity && isPlanSubmitted(d)) signals.push("활동저조");
      if (signals.length === 0) return null;
      return { user, signals };
    })
    .filter(Boolean) as ManagerDashboardResult["warningSignals"];

  const monthlyAchievementRate =
    monthlyTargetRevenue > 0
      ? Math.round((monthlyActualRevenue / monthlyTargetRevenue) * 100)
      : 0;
  const weeklyAchievementRate =
    weeklyTargetRevenue > 0
      ? Math.round((weeklyActualRevenue / weeklyTargetRevenue) * 100)
      : 0;

  return {
    filters: input,
    totals: {
      userCount: filteredUsers.length,
      monthlyTargetRevenue,
      monthlyActualRevenue,
      monthlyAchievementRate,
      weeklyTargetRevenue,
      weeklyActualRevenue,
      weeklyAchievementRate,
      ...activity,
    },
    goalNotRegistered,
    todayPlanMissing,
    todayResultMissing,
    coachingRequestUsers,
    warningSignals,
  };
}
