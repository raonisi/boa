import { TRPCError } from "@trpc/server";
import {
  getAllContracts,
  getAllTeams,
  getAllUsers,
  getCustomers,
  getFollowUps,
  getLatestConsultationDatesByCustomerIds,
  getSchedules,
  getUsersByTeamId,
} from "./db";
import { getHierarchyScopeUserIds } from "./routers";

export const EXCESSIVE_TAG_THRESHOLD = 8;
export const LONG_UNMANAGED_DAYS = 90;

export const QUALITY_SCORE_PENALTIES = {
  missing_phone: 25,
  missing_birth_date: 10,
  missing_status: 15,
  unassigned: 30,
  no_follow_up: 15,
  long_unmanaged: 20,
  duplicate_candidate: 15,
  excessive_tags: 5,
  contract_without_consultation: 15,
  delayed_followup_or_schedule: 10,
} as const;

export type QualityIssueType = keyof typeof QUALITY_SCORE_PENALTIES;

export type QualityLevel =
  | "good"
  | "needs_improvement"
  | "caution"
  | "critical";

export const QUALITY_LEVEL_LABELS: Record<QualityLevel, string> = {
  good: "양호",
  needs_improvement: "보완 필요",
  caution: "주의",
  critical: "우선 정리 필요",
};

export const ISSUE_TYPE_META: Record<
  QualityIssueType,
  {
    label: string;
    severity: "low" | "medium" | "high";
    description: string;
    recommendedAction: string;
  }
> = {
  missing_phone: {
    label: "전화번호 누락",
    severity: "high",
    description: "연락 가능한 대표 번호가 없는 고객입니다.",
    recommendedAction: "고객 상세에서 연락처를 확인해 보완하세요.",
  },
  missing_birth_date: {
    label: "생년월일 누락",
    severity: "medium",
    description: "생일 케어와 연령 기준 관리가 어려운 고객입니다.",
    recommendedAction:
      "생일 케어와 연령 기준 관리를 위해 생년월일을 확인하세요.",
  },
  missing_status: {
    label: "상담상태 미입력",
    severity: "medium",
    description: "고객 진행 단계가 불명확한 고객입니다.",
    recommendedAction: "고객의 현재 상담 단계를 선택하세요.",
  },
  unassigned: {
    label: "담당자 없음",
    severity: "high",
    description: "담당자가 없거나 비활성 담당자인 고객입니다.",
    recommendedAction: "관리자에게 담당자 배정을 요청하세요.",
  },
  no_follow_up: {
    label: "후속관리 없음",
    severity: "medium",
    description: "상담기록은 있으나 다음 연락 또는 후속관리 계획이 없습니다.",
    recommendedAction: "다음 연락일을 등록하세요.",
  },
  long_unmanaged: {
    label: "장기 미관리",
    severity: "high",
    description: "최근 90일 이상 관리 이력이 없는 고객입니다.",
    recommendedAction: "상담기록 또는 후속관리를 남기세요.",
  },
  duplicate_candidate: {
    label: "중복 가능",
    severity: "medium",
    description: "이름, 전화번호, 생년월일 등 일부 기준이 유사한 고객입니다.",
    recommendedAction: "고객 병합 화면에서 중복 여부를 확인하세요.",
  },
  excessive_tags: {
    label: "태그 과다",
    severity: "low",
    description: "태그가 과도하게 많아 검색·분류 품질을 떨어뜨릴 수 있습니다.",
    recommendedAction: "고객 상세에서 핵심 태그만 남기도록 정리하세요.",
  },
  contract_without_consultation: {
    label: "계약·상담기록 불일치",
    severity: "medium",
    description: "계약은 있으나 상담기록이 없는 고객입니다.",
    recommendedAction: "고객 상세에서 상담기록을 확인·보완하세요.",
  },
  delayed_followup_or_schedule: {
    label: "일정·후속관리 지연",
    severity: "medium",
    description: "미완료 일정 또는 지연 후속관리가 있는 고객입니다.",
    recommendedAction: "후속관리 또는 일정을 확인해 처리하세요.",
  },
};

export type CustomerDataQualityInput = {
  assignedUserId?: number;
  teamId?: number;
  subBranchId?: number;
  issueType?: string;
  qualityLevel?: QualityLevel;
  search?: string;
  sortBy?: "quality_score_asc" | "last_managed_asc" | "issue_count_desc";
  limit?: number;
  offset?: number;
};

type AppUser = {
  id: number;
  name: string | null;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
};

export function maskCustomerDisplayName(name: string) {
  if (!name) return "";
  if (name.length === 2) return `${name[0]}*`;
  if (name.length > 2)
    return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}`;
  return name;
}

function parseCustomerTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return value
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }
}

function normalizePhone(phone?: string | null) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function isOpenFollowUpStatus(status: string) {
  return status === "scheduled" || status === "postponed";
}

function isFinishedScheduleStatus(status: string) {
  return ["완료", "취소", "노쇼"].includes(status);
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function getQualityLevel(score: number): QualityLevel {
  if (score >= 90) return "good";
  if (score >= 70) return "needs_improvement";
  if (score >= 50) return "caution";
  return "critical";
}

export function calculateQualityScore(issueTypes: QualityIssueType[]) {
  const penalty = issueTypes.reduce(
    (sum, type) => sum + QUALITY_SCORE_PENALTIES[type],
    0
  );
  return Math.max(0, 100 - penalty);
}

export function buildDuplicateCandidateSet(
  customers: Array<{
    id: number;
    phone?: string | null;
    name?: string | null;
    birthDate?: string | Date | null;
  }>
) {
  const duplicates = new Set<number>();
  const byPhone = new Map<string, number[]>();
  const byNameBirth = new Map<string, number[]>();

  for (const customer of customers) {
    const phone = normalizePhone(customer.phone);
    if (phone.length >= 8) {
      const ids = byPhone.get(phone) ?? [];
      ids.push(customer.id);
      byPhone.set(phone, ids);
    }
    if (customer.name && customer.birthDate) {
      const birth = String(customer.birthDate).slice(0, 10);
      const key = `${customer.name}|${birth}`;
      const ids = byNameBirth.get(key) ?? [];
      ids.push(customer.id);
      byNameBirth.set(key, ids);
    }
  }

  const groups = byPhone.values();
  const nameBirthGroups = byNameBirth.values();
  for (const ids of Array.from(groups).concat(Array.from(nameBirthGroups))) {
    if (ids.length > 1) ids.forEach((id: number) => duplicates.add(id));
  }
  return duplicates;
}

type CustomerIssueContext = {
  now: Date;
  activeAgentIds: Set<number>;
  duplicateCandidateIds: Set<number>;
  consultationDates: Map<number, Date>;
  followUpsByCustomer: Map<number, any[]>;
  schedulesByCustomer: Map<number, any[]>;
  contractsByCustomer: Map<number, any[]>;
};

export function detectCustomerIssueTypes(
  customer: any,
  context: CustomerIssueContext
): QualityIssueType[] {
  const issues: QualityIssueType[] = [];
  const phone = normalizePhone(customer.phone);
  if (!phone) issues.push("missing_phone");
  if (!customer.birthDate) issues.push("missing_birth_date");

  const hasConsultation = context.consultationDates.has(customer.id);
  if (customer.consultStatus === "미상담" && !hasConsultation)
    issues.push("missing_status");

  const agentId = customer.agentId ?? null;
  if (!agentId || !context.activeAgentIds.has(agentId))
    issues.push("unassigned");

  const customerFollowUps = context.followUpsByCustomer.get(customer.id) ?? [];
  if (hasConsultation && customerFollowUps.length === 0)
    issues.push("no_follow_up");

  const customerContracts = context.contractsByCustomer.get(customer.id) ?? [];
  if (customerContracts.length > 0 && !hasConsultation)
    issues.push("contract_without_consultation");

  const managementDates: Date[] = [];
  const latestConsultation = context.consultationDates.get(customer.id);
  if (latestConsultation) managementDates.push(latestConsultation);
  customerFollowUps.forEach(followUp => {
    if (followUp.completedAt)
      managementDates.push(new Date(followUp.completedAt));
    else managementDates.push(new Date(followUp.createdAt));
  });
  const customerSchedules = context.schedulesByCustomer.get(customer.id) ?? [];
  customerSchedules.forEach(schedule => {
    if (schedule.completedAt)
      managementDates.push(new Date(schedule.completedAt));
    else if (schedule.startTime)
      managementDates.push(new Date(schedule.startTime));
  });
  if (managementDates.length === 0 && customer.updatedAt)
    managementDates.push(new Date(customer.updatedAt));
  const lastManagedAt =
    managementDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  if (
    !lastManagedAt ||
    daysBetween(lastManagedAt, context.now) >= LONG_UNMANAGED_DAYS
  ) {
    issues.push("long_unmanaged");
  }

  if (context.duplicateCandidateIds.has(customer.id))
    issues.push("duplicate_candidate");

  const tags = parseCustomerTags(customer.customerTags);
  if (tags.length >= EXCESSIVE_TAG_THRESHOLD) issues.push("excessive_tags");

  const overdueFollowUp = customerFollowUps.some(
    followUp =>
      isOpenFollowUpStatus(String(followUp.status)) &&
      new Date(followUp.nextContactDate).getTime() < context.now.getTime()
  );
  const overdueSchedule = customerSchedules.some(
    schedule =>
      !isFinishedScheduleStatus(String(schedule.status)) &&
      schedule.startTime &&
      new Date(schedule.startTime).getTime() < context.now.getTime()
  );
  if (overdueFollowUp || overdueSchedule)
    issues.push("delayed_followup_or_schedule");

  return issues;
}

function getRecommendedAction(issueTypes: QualityIssueType[]) {
  if (issueTypes.length === 0) return "현재 관리 기준을 유지하세요.";
  const priority: QualityIssueType[] = [
    "unassigned",
    "missing_phone",
    "long_unmanaged",
    "delayed_followup_or_schedule",
    "no_follow_up",
    "missing_status",
    "duplicate_candidate",
    "contract_without_consultation",
    "missing_birth_date",
    "excessive_tags",
  ];
  const primary =
    priority.find(type => issueTypes.includes(type)) ?? issueTypes[0];
  return ISSUE_TYPE_META[primary].recommendedAction;
}

function getLastManagedAt(customer: any, context: CustomerIssueContext) {
  const dates: Date[] = [];
  const latestConsultation = context.consultationDates.get(customer.id);
  if (latestConsultation) dates.push(latestConsultation);
  (context.followUpsByCustomer.get(customer.id) ?? []).forEach(followUp => {
    if (followUp.completedAt) dates.push(new Date(followUp.completedAt));
    else dates.push(new Date(followUp.createdAt));
  });
  (context.schedulesByCustomer.get(customer.id) ?? []).forEach(schedule => {
    if (schedule.completedAt) dates.push(new Date(schedule.completedAt));
    else if (schedule.startTime) dates.push(new Date(schedule.startTime));
  });
  if (dates.length === 0 && customer.updatedAt)
    dates.push(new Date(customer.updatedAt));
  return dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

async function getScopedAgentIds(user: AppUser) {
  const allUsers = (await getAllUsers()) as any[];
  const activeUsers = allUsers.filter(item => item.accountStatus === "active");
  if (user.role === "branch_admin") return activeUsers.map(item => item.id);
  if (user.role === "member") return [user.id];
  return ((await getHierarchyScopeUserIds(user)) ?? [user.id]).filter(id =>
    activeUsers.some(item => item.id === id)
  );
}

async function getScopedSchedules(user: AppUser, agentIds: number[]) {
  if (user.role === "branch_admin") return getSchedules({});
  if (agentIds.length === 0) return [];
  if (user.role === "member") return getSchedules({ userId: user.id });
  return getSchedules({ userIds: agentIds });
}

async function resolveScope(user: AppUser, input: CustomerDataQualityInput) {
  const [allUsers, allTeams] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
  ]);
  const activeUsers = (allUsers as any[]).filter(
    item => item.accountStatus === "active"
  );
  const activeTeams = (allTeams as any[]).filter(
    team => team.isActive !== false && !team.deletedAt
  );
  const scopedAgentIds = await getScopedAgentIds(user);
  const scopedAgentSet = new Set(scopedAgentIds);

  let agentIds = [...scopedAgentIds];

  if (input.assignedUserId !== undefined) {
    if (!scopedAgentSet.has(input.assignedUserId)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 담당자입니다.",
      });
    }
    agentIds = [input.assignedUserId];
  }

  if (input.teamId !== undefined) {
    const team = activeTeams.find(item => item.id === input.teamId);
    if (!team)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "팀을 찾을 수 없습니다.",
      });
    if (user.role === "team_leader" && user.teamId !== input.teamId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 팀만 조회할 수 있습니다.",
      });
    }
    if (user.role === "sub_branch_admin" && team.subBranchAdminId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "산하 팀만 조회할 수 있습니다.",
      });
    }
    if (user.role === "member") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "팀 단위 품질 현황은 관리자만 조회할 수 있습니다.",
      });
    }
    const teamMembers = await getUsersByTeamId(input.teamId);
    const teamUserIds = teamMembers
      .map(member => member.id)
      .filter(id => scopedAgentSet.has(id));
    agentIds = teamUserIds.length > 0 ? teamUserIds : [-1];
  }

  if (input.subBranchId !== undefined) {
    if (user.role === "member" || user.role === "team_leader") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "부지점 단위 품질 현황은 상위 관리자만 조회할 수 있습니다.",
      });
    }
    if (user.role === "sub_branch_admin" && user.id !== input.subBranchId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 산하 부지점만 조회할 수 있습니다.",
      });
    }
    const subBranchUsers = activeUsers.filter(
      item =>
        item.subBranchAdminId === input.subBranchId ||
        item.id === input.subBranchId
    );
    agentIds = subBranchUsers
      .map(item => item.id)
      .filter(id => scopedAgentSet.has(id));
    if (agentIds.length === 0) agentIds = [-1];
  }

  const customerQuery =
    user.role === "branch_admin" && agentIds.length === scopedAgentIds.length
      ? {}
      : { agentIds };

  return {
    activeUsers,
    activeTeams,
    agentIds,
    customerQuery,
    canViewAssigneeBreakdown: user.role !== "member",
  };
}

export async function buildCustomerDataQualityFilterOptions(user: AppUser) {
  const [allUsers, allTeams] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
  ]);
  const activeUsers = (allUsers as any[]).filter(
    item => item.accountStatus === "active"
  );
  const activeTeams = (allTeams as any[]).filter(
    team => team.isActive !== false && !team.deletedAt
  );
  const scopedAgentIds = new Set(await getScopedAgentIds(user));

  const assignees = activeUsers
    .filter(item => scopedAgentIds.has(item.id) && item.role !== "branch_admin")
    .map(item => ({
      id: item.id,
      name: item.name ?? `사용자 #${item.id}`,
      role: item.role,
      teamId: item.teamId ?? null,
      subBranchAdminId: item.subBranchAdminId ?? null,
    }));

  const teams =
    user.role === "branch_admin"
      ? activeTeams
      : activeTeams.filter(team => {
          if (user.role === "sub_branch_admin")
            return team.subBranchAdminId === user.id;
          if (user.role === "team_leader") return team.id === user.teamId;
          return false;
        });

  const subBranches =
    user.role === "branch_admin"
      ? activeUsers
          .filter(item => item.role === "sub_branch_admin")
          .map(item => ({
            id: item.id,
            name: item.name ?? `부지점 #${item.id}`,
          }))
      : user.role === "sub_branch_admin"
        ? [{ id: user.id, name: user.name ?? `부지점 #${user.id}` }]
        : [];

  return {
    issueTypes: Object.entries(ISSUE_TYPE_META).map(([type, meta]) => ({
      type,
      label: meta.label,
      severity: meta.severity,
    })),
    qualityLevels: Object.entries(QUALITY_LEVEL_LABELS).map(
      ([value, label]) => ({ value, label })
    ),
    assignees,
    teams: teams.map(team => ({
      id: team.id,
      name: team.name ?? `팀 #${team.id}`,
    })),
    subBranches,
    canViewAssigneeBreakdown: user.role !== "member",
    memberViewLabel:
      user.role === "member" ? "내 고객 데이터 보완" : "고객 데이터 품질 점검",
  };
}

export async function buildCustomerDataQualityDashboard(
  user: AppUser,
  input: CustomerDataQualityInput = {}
) {
  const scope = await resolveScope(user, input);
  const [customerList, contractList, scheduleList, followUpList] =
    await Promise.all([
      getCustomers(scope.customerQuery),
      getAllContracts(
        scope.customerQuery.agentIds ? { agentIds: scope.agentIds } : {}
      ),
      getScopedSchedules(user, scope.agentIds),
      getFollowUps(
        scope.customerQuery.agentIds ? { agentIds: scope.agentIds } : {}
      ),
    ]);

  const activeCustomers = customerList.filter(
    (customer: any) => customer.isActive !== false && !customer.deletedAt
  );
  const customerIds = activeCustomers.map((customer: any) => customer.id);
  const consultationRows =
    await getLatestConsultationDatesByCustomerIds(customerIds);
  const consultationDates = new Map<number, Date>(
    consultationRows.map(row => [row.customerId, new Date(row.latestCreatedAt)])
  );

  const activeAgentIds = new Set(
    scope.activeUsers
      .filter(item => item.accountStatus === "active")
      .map(item => item.id)
  );
  const duplicateCandidateIds = buildDuplicateCandidateSet(activeCustomers);
  const now = new Date();

  const followUpsByCustomer = new Map<number, any[]>();
  for (const followUp of followUpList.filter((item: any) => !item.deletedAt)) {
    const rows = followUpsByCustomer.get(followUp.customerId) ?? [];
    rows.push(followUp);
    followUpsByCustomer.set(followUp.customerId, rows);
  }

  const schedulesByCustomer = new Map<number, any[]>();
  for (const schedule of scheduleList.filter(
    (item: any) =>
      item.isActive !== false && !item.deletedAt && item.customerId != null
  )) {
    const customerId = Number(schedule.customerId);
    const rows = schedulesByCustomer.get(customerId) ?? [];
    rows.push(schedule);
    schedulesByCustomer.set(customerId, rows);
  }

  const contractsByCustomer = new Map<number, any[]>();
  for (const contract of contractList.filter(
    (item: any) => item.isActive !== false && !item.deletedAt
  )) {
    const rows = contractsByCustomer.get(contract.customerId) ?? [];
    rows.push(contract);
    contractsByCustomer.set(contract.customerId, rows);
  }

  const context: CustomerIssueContext = {
    now,
    activeAgentIds,
    duplicateCandidateIds,
    consultationDates,
    followUpsByCustomer,
    schedulesByCustomer,
    contractsByCustomer,
  };

  const userById = new Map(scope.activeUsers.map(item => [item.id, item]));
  const teamById = new Map(scope.activeTeams.map(team => [team.id, team]));

  const analyzedCustomers = activeCustomers.map((customer: any) => {
    const issueTypes = detectCustomerIssueTypes(customer, context);
    const qualityScore = calculateQualityScore(issueTypes);
    const qualityLevel = getQualityLevel(qualityScore);
    const assignedUser = customer.agentId
      ? userById.get(customer.agentId)
      : undefined;
    const lastManagedAt = getLastManagedAt(customer, context);
    return {
      customerId: customer.id,
      customerDisplayName: maskCustomerDisplayName(customer.name ?? ""),
      assignedUserId: customer.agentId ?? null,
      assignedUserName:
        assignedUser?.name ??
        (customer.agentId ? `담당자 #${customer.agentId}` : "미배정"),
      status: customer.consultStatus,
      qualityScore,
      qualityLevel,
      qualityLevelLabel: QUALITY_LEVEL_LABELS[qualityLevel],
      issueTypes,
      issueLabels: issueTypes.map(type => ISSUE_TYPE_META[type].label),
      lastManagedAt: lastManagedAt?.toISOString() ?? null,
      recommendedAction: getRecommendedAction(issueTypes),
      links: {
        customerDetail: `/customers/${customer.id}`,
        customerList: "/customers",
        followUp: `/customers/${customer.id}`,
        merge: "/customers/merge",
        assign: "/customers/assign",
      },
    };
  });

  const issueCustomers = analyzedCustomers.filter(
    customer => customer.issueTypes.length > 0
  );
  const cleanCustomers = analyzedCustomers.filter(
    customer => customer.issueTypes.length === 0
  );

  const summary = {
    customerCount: analyzedCustomers.length,
    cleanCustomerCount: cleanCustomers.length,
    issueCustomerCount: issueCustomers.length,
    averageQualityScore:
      analyzedCustomers.length > 0
        ? Math.round(
            analyzedCustomers.reduce(
              (sum, customer) => sum + customer.qualityScore,
              0
            ) / analyzedCustomers.length
          )
        : 100,
    missingPhoneCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("missing_phone")
    ).length,
    missingBirthDateCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("missing_birth_date")
    ).length,
    missingStatusCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("missing_status")
    ).length,
    unassignedCustomerCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("unassigned")
    ).length,
    noFollowUpCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("no_follow_up")
    ).length,
    longUnmanagedCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("long_unmanaged")
    ).length,
    duplicateCandidateCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("duplicate_candidate")
    ).length,
    excessiveTagCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("excessive_tags")
    ).length,
    contractWithoutConsultationCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("contract_without_consultation")
    ).length,
    delayedFollowUpOrScheduleCount: issueCustomers.filter(customer =>
      customer.issueTypes.includes("delayed_followup_or_schedule")
    ).length,
    criticalCustomerCount: analyzedCustomers.filter(
      customer => customer.qualityLevel === "critical"
    ).length,
  };

  const issueTypes = (Object.keys(ISSUE_TYPE_META) as QualityIssueType[]).map(
    type => ({
      type,
      label: ISSUE_TYPE_META[type].label,
      count: issueCustomers.filter(customer =>
        customer.issueTypes.includes(type)
      ).length,
      severity: ISSUE_TYPE_META[type].severity,
      description: ISSUE_TYPE_META[type].description,
      recommendedAction: ISSUE_TYPE_META[type].recommendedAction,
    })
  );

  const assigneeMap = new Map<
    number,
    {
      userId: number;
      name: string;
      role: string;
      teamName: string | null;
      subBranchName: string | null;
      customerCount: number;
      issueCustomerCount: number;
      qualityScoreTotal: number;
      missingPhoneCount: number;
      missingStatusCount: number;
      noFollowUpCount: number;
      longUnmanagedCount: number;
      duplicateCandidateCount: number;
      priorityIssueCount: number;
    }
  >();

  for (const customer of analyzedCustomers) {
    const agentId = customer.assignedUserId;
    if (!agentId || !scope.canViewAssigneeBreakdown) continue;
    const agent = userById.get(agentId);
    const team = agent?.teamId ? teamById.get(agent.teamId) : undefined;
    const subBranch = agent?.subBranchAdminId
      ? userById.get(agent.subBranchAdminId)
      : undefined;
    const current = assigneeMap.get(agentId) ?? {
      userId: agentId,
      name: agent?.name ?? `담당자 #${agentId}`,
      role: agent?.role ?? "member",
      teamName: team?.name ?? null,
      subBranchName: subBranch?.name ?? null,
      customerCount: 0,
      issueCustomerCount: 0,
      qualityScoreTotal: 0,
      missingPhoneCount: 0,
      missingStatusCount: 0,
      noFollowUpCount: 0,
      longUnmanagedCount: 0,
      duplicateCandidateCount: 0,
      priorityIssueCount: 0,
    };
    current.customerCount += 1;
    current.qualityScoreTotal += customer.qualityScore;
    if (customer.issueTypes.length > 0) current.issueCustomerCount += 1;
    if (customer.issueTypes.includes("missing_phone"))
      current.missingPhoneCount += 1;
    if (customer.issueTypes.includes("missing_status"))
      current.missingStatusCount += 1;
    if (customer.issueTypes.includes("no_follow_up"))
      current.noFollowUpCount += 1;
    if (customer.issueTypes.includes("long_unmanaged"))
      current.longUnmanagedCount += 1;
    if (customer.issueTypes.includes("duplicate_candidate"))
      current.duplicateCandidateCount += 1;
    if (
      customer.qualityLevel === "critical" ||
      customer.qualityLevel === "caution"
    )
      current.priorityIssueCount += 1;
    assigneeMap.set(agentId, current);
  }

  const assignees = Array.from(assigneeMap.values())
    .map(assignee => ({
      ...assignee,
      averageQualityScore:
        assignee.customerCount > 0
          ? Math.round(assignee.qualityScoreTotal / assignee.customerCount)
          : 100,
    }))
    .sort(
      (a, b) =>
        b.priorityIssueCount - a.priorityIssueCount ||
        a.averageQualityScore - b.averageQualityScore
    );

  let filteredCustomers = [...issueCustomers];
  if (input.issueType) {
    filteredCustomers = filteredCustomers.filter(customer =>
      customer.issueTypes.includes(input.issueType as QualityIssueType)
    );
  }
  if (input.qualityLevel) {
    filteredCustomers = filteredCustomers.filter(
      customer => customer.qualityLevel === input.qualityLevel
    );
  }
  if (input.search?.trim()) {
    const normalized = input.search.trim().toLowerCase();
    filteredCustomers = filteredCustomers.filter(
      customer =>
        customer.customerDisplayName.toLowerCase().includes(normalized) ||
        customer.assignedUserName.toLowerCase().includes(normalized) ||
        customer.issueLabels.some(label =>
          label.toLowerCase().includes(normalized)
        )
    );
  }

  filteredCustomers.sort((a, b) => {
    if (input.sortBy === "last_managed_asc") {
      const aTime = a.lastManagedAt ? new Date(a.lastManagedAt).getTime() : 0;
      const bTime = b.lastManagedAt ? new Date(b.lastManagedAt).getTime() : 0;
      return aTime - bTime;
    }
    if (input.sortBy === "issue_count_desc") {
      return (
        b.issueTypes.length - a.issueTypes.length ||
        a.qualityScore - b.qualityScore
      );
    }
    return (
      a.qualityScore - b.qualityScore ||
      (a.lastManagedAt ? new Date(a.lastManagedAt).getTime() : 0) -
        (b.lastManagedAt ? new Date(b.lastManagedAt).getTime() : 0)
    );
  });

  const total = filteredCustomers.length;
  const paginatedCustomers = filteredCustomers.slice(
    input.offset ?? 0,
    (input.offset ?? 0) + (input.limit ?? 25)
  );

  return {
    scope: {
      role: user.role,
      userId: user.id,
      teamId: user.teamId ?? null,
      subBranchAdminId: user.subBranchAdminId ?? null,
      canViewAssigneeBreakdown: scope.canViewAssigneeBreakdown,
    },
    summary,
    issueTypes,
    assignees,
    customers: paginatedCustomers,
    pagination: {
      total,
      limit: input.limit ?? 25,
      offset: input.offset ?? 0,
    },
  };
}
