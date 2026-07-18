import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getKstDayRange } from "@shared/timePolicy";
import { managerAnalyticsProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import {
  createActivityLog,
  getAllContracts,
  getAllTeams,
  getAllUsers,
  getConsultationsByCustomer,
  getCustomers,
  getFollowUps,
  getNotificationsFiltered,
  getPerformanceGoalDashboard,
  getSchedules,
  getUsersByTeamId,
} from "./db";
import { buildFirstContactSlaInsights } from "./sla";
import { buildTeamCompletionInsights } from "./teamCompletion";
import { getHierarchyScopeUserIds } from "./routers";
import {
  classifyOperationRiskActionLevel,
  compareOperationRiskActionLevel,
} from "@shared/operationRiskActionLevel";

type AppUser = {
  id: number;
  name: string | null;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
};

const managementReportInputSchema = z.object({
  reportType: z.enum(["daily", "weekly", "monthly", "team", "sub_branch"]),
  periodType: z.enum(["today", "week", "month", "custom"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  targetTeamId: z.number().optional(),
  targetSubBranchId: z.number().optional(),
  targetUserId: z.number().optional(),
});

type ManagementReportInput = z.infer<typeof managementReportInputSchema>;

const REPORT_TYPE_LABELS: Record<ManagementReportInput["reportType"], string> =
  {
    daily: "일일 운영 보고서",
    weekly: "주간 운영 보고서",
    monthly: "월간 관리 보고서",
    team: "팀장 보고서",
    sub_branch: "부지점 보고서",
  };

const PHONE_PATTERN = /01[016789]-?\d{3,4}-?\d{4}/;
const SENSITIVE_PATTERNS = [
  PHONE_PATTERN,
  /\d{6}-\d{7}/,
  /생년월일/,
  /월납보험료\s*[:：]?\s*[\d,]+/,
  /보험료\s*[:：]?\s*[\d,]+/,
  /질병/,
];

function toDayStart(date: Date) {
  return getKstDayRange(date).start;
}

function toDayEnd(date: Date) {
  return getKstDayRange(date).end;
}

function isDateInRange(value: unknown, dateFrom: Date, dateTo: Date) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value as string);
  return !Number.isNaN(date.getTime()) && date >= dateFrom && date <= dateTo;
}

function resolveManagementPeriod(input: ManagementReportInput) {
  const periodType =
    input.periodType ??
    (input.reportType === "daily"
      ? "today"
      : input.reportType === "weekly"
        ? "week"
        : input.reportType === "monthly"
          ? "month"
          : "week");
  const now = new Date();

  if (periodType === "custom") {
    const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
    const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
    if (
      !dateFrom ||
      Number.isNaN(dateFrom.getTime()) ||
      !dateTo ||
      Number.isNaN(dateTo.getTime())
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "기간이 올바르지 않습니다.",
      });
    }
    return {
      periodType,
      dateFrom: toDayStart(dateFrom),
      dateTo: toDayEnd(dateTo),
    };
  }

  if (periodType === "today") {
    const { start, end } = getKstDayRange(now);
    return { periodType, dateFrom: start, dateTo: end };
  }

  if (periodType === "month") {
    return {
      periodType,
      dateFrom: new Date(now.getFullYear(), now.getMonth(), 1),
      dateTo: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      ),
    };
  }

  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + mondayOffset
  );
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6,
    23,
    59,
    59,
    999
  );
  return { periodType, dateFrom: weekStart, dateTo: weekEnd };
}

async function resolveManagementReportScope(
  user: AppUser,
  input: ManagementReportInput
) {
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
  const hierarchyIds =
    user.role === "branch_admin"
      ? activeUsers.map(item => item.id)
      : ((await getHierarchyScopeUserIds(user)) ?? [user.id]).filter(id =>
          activeUsers.some(item => item.id === id)
        );
  const hierarchySet = new Set(hierarchyIds);

  const subBranchById = new Map(
    activeUsers
      .filter(item => item.role === "sub_branch_admin")
      .map(item => [item.id, item.name ?? `부지점 #${item.id}`])
  );

  if (input.targetUserId !== undefined) {
    if (!hierarchySet.has(input.targetUserId)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 사용자입니다.",
      });
    }
    const target = activeUsers.find(item => item.id === input.targetUserId);
    return {
      scopeType: "user" as const,
      label: target?.name ?? `사용자 #${input.targetUserId}`,
      userIds: [input.targetUserId],
      targetTeamId: target?.teamId ?? null,
      targetSubBranchId: target?.subBranchAdminId ?? null,
      activeUsers,
      activeTeams,
      subBranchById,
    };
  }

  if (
    input.reportType === "sub_branch" ||
    input.targetSubBranchId !== undefined
  ) {
    const subBranchAdminId =
      input.targetSubBranchId ??
      (user.role === "sub_branch_admin" ? user.id : undefined);
    if (!subBranchAdminId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "부지점 범위를 선택해 주세요.",
      });
    }
    if (user.role !== "branch_admin" && subBranchAdminId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 부지점입니다.",
      });
    }
    const userIds = activeUsers
      .filter(
        item =>
          item.id === subBranchAdminId ||
          item.subBranchAdminId === subBranchAdminId
      )
      .map(item => item.id)
      .filter(id => hierarchySet.has(id));
    return {
      scopeType: "sub_branch" as const,
      label:
        subBranchById.get(subBranchAdminId) ?? `부지점 #${subBranchAdminId}`,
      userIds,
      targetTeamId: null,
      targetSubBranchId: subBranchAdminId,
      activeUsers,
      activeTeams,
      subBranchById,
    };
  }

  if (input.reportType === "team" || input.targetTeamId !== undefined) {
    const teamId =
      input.targetTeamId ??
      (user.role === "team_leader" ? (user.teamId ?? undefined) : undefined);
    if (!teamId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "팀 범위를 선택해 주세요.",
      });
    }
    const team = activeTeams.find(item => item.id === teamId);
    if (!team) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "조회할 수 없는 팀입니다.",
      });
    }
    if (user.role === "team_leader" && user.teamId !== teamId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 팀입니다.",
      });
    }
    if (user.role === "sub_branch_admin" && team.subBranchAdminId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 팀입니다.",
      });
    }
    const teamMembers = await getUsersByTeamId(teamId);
    const teamUserIds = new Set([
      ...teamMembers.map(member => member.id),
      ...(team.managerId ? [team.managerId] : []),
    ]);
    const userIds = activeUsers
      .filter(item => teamUserIds.has(item.id) || item.teamId === teamId)
      .map(item => item.id)
      .filter(id => hierarchySet.has(id));
    return {
      scopeType: "team" as const,
      label: team.name ?? `팀 #${teamId}`,
      userIds,
      targetTeamId: teamId,
      targetSubBranchId: team.subBranchAdminId ?? null,
      activeUsers,
      activeTeams,
      subBranchById,
    };
  }

  const userIds = activeUsers
    .filter(item => hierarchySet.has(item.id) && item.role !== "branch_admin")
    .map(item => item.id);

  return {
    scopeType:
      user.role === "branch_admin"
        ? ("all" as const)
        : user.role === "sub_branch_admin"
          ? ("sub_branch" as const)
          : ("team" as const),
    label:
      user.role === "branch_admin"
        ? "전체 조직"
        : user.role === "sub_branch_admin"
          ? "산하 조직"
          : "산하 팀",
    userIds,
    targetTeamId: user.role === "team_leader" ? user.teamId : null,
    targetSubBranchId: user.role === "sub_branch_admin" ? user.id : null,
    activeUsers,
    activeTeams,
    subBranchById,
  };
}

function isFinishedScheduleStatus(status: string) {
  return ["완료", "취소", "노쇼"].includes(status);
}

function isOpenFollowUpStatus(status: string) {
  return status === "scheduled" || status === "postponed";
}

function isUnreadNotification(notification: {
  isRead: boolean;
  processStatus?: string | null;
}) {
  return !notification.isRead || notification.processStatus === "미확인";
}

function getContractDateValue(contract: any) {
  return contract.contractDate ?? contract.createdAt;
}

function getFollowUpCompletedValue(followUp: any) {
  return followUp.completedAt ?? followUp.updatedAt;
}

function isNewContractMetricTarget(contract: any) {
  return (
    contract.contractStatus !== "철회" &&
    contract.contractStatus !== "해지" &&
    contract.paymentStatus !== "실효" &&
    contract.paymentStatus !== "해지"
  );
}

function deriveUserActionLevel(metrics: {
  overdueFollowUpCount: number;
  unreadNotificationCount: number;
  unconsultedDbCount: number;
  incompleteScheduleCount: number;
  longUnmanagedCustomerCount: number;
}) {
  return classifyOperationRiskActionLevel({
    actionRequiredCount:
      metrics.overdueFollowUpCount +
      metrics.unconsultedDbCount +
      metrics.incompleteScheduleCount +
      metrics.longUnmanagedCustomerCount,
  });
}

function buildCoachingPoint(metrics: {
  overdueFollowUpCount: number;
  unreadNotificationCount: number;
  unconsultedDbCount: number;
  incompleteScheduleCount: number;
  longUnmanagedCustomerCount: number;
  followUpCompletionRate: number | null;
}) {
  if (metrics.overdueFollowUpCount >= 3)
    return "지연 후속관리를 오늘 중 우선 확인해 주세요.";
  if (metrics.unconsultedDbCount >= 3)
    return "미상담 DB를 먼저 연락 순서로 정리해 주세요.";
  if (metrics.incompleteScheduleCount >= 2)
    return "미완료 일정을 완료 또는 재조정해 주세요.";
  if (metrics.unreadNotificationCount >= 5)
    return "미확인 알림을 차례로 처리해 주세요.";
  if (metrics.longUnmanagedCustomerCount >= 3)
    return "장기 미관리 고객 관리 계획을 점검해 주세요.";
  if (
    metrics.followUpCompletionRate !== null &&
    metrics.followUpCompletionRate < 60
  )
    return "후속관리 완료율을 높이기 위한 일일 점검을 권장합니다.";
  return "현재 흐름을 유지하되, 오늘 예정 업무를 먼저 마무리해 주세요.";
}

function sanitizeSummaryText(text: string) {
  let sanitized = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[민감정보 제외]");
  }
  return sanitized;
}

function buildNarrativeSummary(params: {
  reportType: ManagementReportInput["reportType"];
  scopeLabel: string;
  periodLabel: string;
  summary: {
    followUpCompletionRate: number | null;
    overdueFollowUpCount: number;
    incompleteScheduleCount: number;
    unreadNotificationCount: number;
    longUnmanagedCustomerCount: number;
    goalAchievementRate: number | null;
  };
  topUserName?: string | null;
}) {
  const parts: string[] = [];
  parts.push(
    `${params.periodLabel} ${REPORT_TYPE_LABELS[params.reportType]} 기준으로 ${params.scopeLabel} 운영 현황을 정리했습니다.`
  );
  if (params.summary.followUpCompletionRate !== null) {
    parts.push(
      `전체 후속관리 완료율은 ${params.summary.followUpCompletionRate}%입니다.`
    );
  }
  if (params.topUserName) {
    parts.push(`우선 확인이 필요한 담당자는 ${params.topUserName}입니다.`);
  }
  if (params.summary.overdueFollowUpCount > 0) {
    parts.push(
      `지연 후속관리 ${params.summary.overdueFollowUpCount}건이 남아 있습니다.`
    );
  }
  if (params.summary.incompleteScheduleCount > 0) {
    parts.push(
      `미완료 일정 ${params.summary.incompleteScheduleCount}건을 확인해 주세요.`
    );
  }
  if (params.summary.longUnmanagedCustomerCount > 0) {
    parts.push(
      `장기 미관리 고객 ${params.summary.longUnmanagedCustomerCount}명의 관리 계획을 점검해 주세요.`
    );
  }
  if (params.summary.goalAchievementRate !== null) {
    parts.push(
      `목표 달성률은 ${params.summary.goalAchievementRate}% 수준입니다.`
    );
  }
  parts.push(
    "우선 확인할 항목은 지연 후속관리, 미완료 일정, 장기 미관리 고객입니다."
  );
  return sanitizeSummaryText(parts.join(" "));
}

function buildCopyableSummary(params: {
  reportType: ManagementReportInput["reportType"];
  periodLabel: string;
  summary: {
    overdueFollowUpCount: number;
    incompleteScheduleCount: number;
    unreadNotificationCount: number;
    longUnmanagedCustomerCount: number;
    consultationCount: number;
    newContractCount: number;
    followUpCompletionRate: number | null;
  };
}) {
  const lines = [
    `${params.periodLabel} ${REPORT_TYPE_LABELS[params.reportType]} 요약입니다.`,
    "",
    `• 후속관리 지연: ${params.summary.overdueFollowUpCount}건`,
    `• 미완료 일정: ${params.summary.incompleteScheduleCount}건`,
    `• 미확인 알림: ${params.summary.unreadNotificationCount}건`,
    `• 장기 미관리 고객: ${params.summary.longUnmanagedCustomerCount}명`,
    `• 상담기록: ${params.summary.consultationCount}건`,
    `• 신규 계약: ${params.summary.newContractCount}건`,
    params.summary.followUpCompletionRate !== null
      ? `• 후속관리 완료율: ${params.summary.followUpCompletionRate}%`
      : null,
    "",
    "우선 확인 필요: 지연 후속관리, 미확인 알림, 미상담 DB",
    "각 팀장님은 오늘 중 미처리 항목을 확인해 주세요.",
  ].filter((line): line is string => Boolean(line));
  return sanitizeSummaryText(lines.join("\n"));
}

export async function buildManagementReport(
  user: AppUser,
  input: ManagementReportInput
) {
  if (user.role === "member") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "관리자 보고서는 팀장 이상만 생성할 수 있습니다.",
    });
  }

  const period = resolveManagementPeriod(input);
  const scope = await resolveManagementReportScope(user, input);
  const visibleUsers = scope.activeUsers.filter(
    item => scope.userIds.includes(item.id) && item.role !== "branch_admin"
  );
  const visibleUserIds = visibleUsers.map(item => item.id);

  if (visibleUserIds.length === 0) {
    return {
      reportMeta: {
        reportType: input.reportType,
        periodType: period.periodType,
        dateFrom: period.dateFrom.toISOString(),
        dateTo: period.dateTo.toISOString(),
        generatedAt: new Date().toISOString(),
        generatedBy: { id: user.id, name: user.name, role: user.role },
        scope: {
          type: scope.scopeType,
          label: scope.label,
          targetTeamId: scope.targetTeamId,
          targetSubBranchId: scope.targetSubBranchId,
          targetUserId: input.targetUserId ?? null,
        },
      },
      summary: {
        activeUserCount: 0,
        customerCount: 0,
        consultationCount: 0,
        followUpCount: 0,
        completedFollowUpCount: 0,
        overdueFollowUpCount: 0,
        incompleteScheduleCount: 0,
        unreadNotificationCount: 0,
        newContractCount: 0,
        longUnmanagedCustomerCount: 0,
        goalAchievementRate: null,
        followUpCompletionRate: null,
        todayFollowUpCount: 0,
        todayCompletedFollowUpCount: 0,
        newCustomerCount: 0,
        priorityAManagementRate: null,
        firstContactSlaDelayCount: 0,
      },
      topIssues: [],
      users: [],
      narrativeSummary: "선택한 기간에 보고서로 표시할 데이터가 없습니다.",
      copyableSummary: "선택한 기간에 보고서로 표시할 데이터가 없습니다.",
      empty: true,
    };
  }

  const [
    customerList,
    contractList,
    scheduleList,
    notificationResult,
    followUpList,
  ] = await Promise.all([
    getCustomers({ agentIds: visibleUserIds }),
    getAllContracts({ agentIds: visibleUserIds }),
    getSchedules({ userIds: visibleUserIds }),
    getNotificationsFiltered({ userIds: visibleUserIds, limit: 500 }),
    getFollowUps({
      agentIds: visibleUserIds,
      statuses: ["scheduled", "postponed", "completed", "cancelled"],
    }),
  ]);

  const activeCustomers = customerList.filter(
    customer => customer.isActive && !customer.deletedAt
  );
  const activeContracts = contractList.filter(
    contract => contract.isActive && !contract.deletedAt
  );
  const consultationEntries = await Promise.all(
    activeCustomers.map(async customer => ({
      customerId: customer.id,
      agentId: customer.agentId,
      priority: customer.priority,
      consultStatus: customer.consultStatus,
      createdAt: customer.createdAt,
      consultations: await getConsultationsByCustomer(customer.id),
    }))
  );

  const longUnmanagedSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const managedSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const todayStart = toDayStart(new Date());
  const todayEnd = toDayEnd(new Date());

  const users = visibleUsers
    .map(visibleUser => {
      const assignedCustomers = activeCustomers.filter(
        customer => customer.agentId === visibleUser.id
      );
      const userConsultations = consultationEntries
        .filter(entry => entry.agentId === visibleUser.id)
        .flatMap(entry => entry.consultations);
      const consultationsInPeriod = userConsultations.filter(consultation =>
        isDateInRange(consultation.createdAt, period.dateFrom, period.dateTo)
      );
      const userFollowUps = followUpList.filter(
        followUp => followUp.assignedAgentId === visibleUser.id
      );
      const followUpsInPeriod = userFollowUps.filter(followUp =>
        isDateInRange(
          followUp.createdAt ?? followUp.nextContactDate,
          period.dateFrom,
          period.dateTo
        )
      );
      const completedFollowUpsInPeriod = userFollowUps.filter(
        followUp =>
          followUp.status === "completed" &&
          isDateInRange(
            getFollowUpCompletedValue(followUp),
            period.dateFrom,
            period.dateTo
          )
      );
      const overdueFollowUpCount = userFollowUps.filter(
        followUp =>
          isOpenFollowUpStatus(followUp.status) &&
          new Date(followUp.nextContactDate) < todayStart
      ).length;
      const todayFollowUpCount = userFollowUps.filter(
        followUp =>
          isOpenFollowUpStatus(followUp.status) &&
          isDateInRange(followUp.nextContactDate, todayStart, todayEnd)
      ).length;
      const userSchedules = scheduleList.filter(
        schedule =>
          schedule.userId === visibleUser.id &&
          schedule.isActive !== false &&
          !schedule.deletedAt
      );
      const schedulesInPeriod = userSchedules.filter(schedule =>
        isDateInRange(schedule.startTime, period.dateFrom, period.dateTo)
      );
      const incompleteScheduleCount = schedulesInPeriod.filter(
        schedule => !isFinishedScheduleStatus(schedule.status)
      ).length;
      const unreadNotificationCount = notificationResult.items.filter(
        notification =>
          notification.userId === visibleUser.id &&
          isUnreadNotification(notification)
      ).length;
      const newContractCount = activeContracts.filter(
        contract =>
          contract.agentId === visibleUser.id &&
          isDateInRange(
            getContractDateValue(contract),
            period.dateFrom,
            period.dateTo
          ) &&
          isNewContractMetricTarget(contract)
      ).length;
      const unconsultedDbCount = assignedCustomers.filter(
        customer => customer.consultStatus === "미상담"
      ).length;

      let longUnmanagedCustomerCount = 0;
      let priorityAManagedCount = 0;
      let priorityACount = 0;
      assignedCustomers.forEach(customer => {
        const entry = consultationEntries.find(
          item => item.customerId === customer.id
        );
        const latestConsult = entry?.consultations
          .map(consultation => new Date(consultation.createdAt).getTime())
          .filter(time => !Number.isNaN(time))
          .sort((a, b) => b - a)[0];
        if (!latestConsult || new Date(latestConsult) < longUnmanagedSince)
          longUnmanagedCustomerCount += 1;
        if (customer.priority === "A") {
          priorityACount += 1;
          const lastConsultDate = latestConsult
            ? new Date(latestConsult)
            : null;
          const recentFollowUp = userFollowUps.some(
            followUp =>
              followUp.customerId === customer.id &&
              followUp.status === "completed" &&
              getFollowUpCompletedValue(followUp) >= managedSince
          );
          if (
            (lastConsultDate && lastConsultDate >= managedSince) ||
            recentFollowUp
          )
            priorityAManagedCount += 1;
        }
      });

      const followUpCompletionRate =
        followUpsInPeriod.length > 0
          ? Math.round(
              (completedFollowUpsInPeriod.length / followUpsInPeriod.length) *
                100
            )
          : null;
      const team = scope.activeTeams.find(
        item => item.id === visibleUser.teamId
      );
      const metrics = {
        consultationCount: consultationsInPeriod.length,
        followUpCount: followUpsInPeriod.length,
        completedFollowUpCount: completedFollowUpsInPeriod.length,
        followUpCompletionRate,
        overdueFollowUpCount,
        todayFollowUpCount,
        incompleteScheduleCount,
        unreadNotificationCount,
        newContractCount,
        unconsultedDbCount,
        longUnmanagedCustomerCount,
        priorityACount,
        priorityAManagedCount,
        priorityAManagementRate:
          priorityACount > 0
            ? Math.round((priorityAManagedCount / priorityACount) * 100)
            : null,
        newCustomerCount: assignedCustomers.filter(customer =>
          isDateInRange(customer.createdAt, period.dateFrom, period.dateTo)
        ).length,
      };
      const actionLevel = deriveUserActionLevel(metrics);
      return {
        userId: visibleUser.id,
        name: visibleUser.name ?? `사용자 #${visibleUser.id}`,
        role: visibleUser.role,
        teamName: team?.name ?? "미지정",
        subBranchName:
          scope.subBranchById.get(visibleUser.subBranchAdminId ?? -1) ??
          "기본 부지점",
        metrics,
        actionLevel,
        coachingPoint: buildCoachingPoint(metrics),
      };
    })
    .sort((left, right) => {
      const actionOrder = compareOperationRiskActionLevel(
        left.actionLevel,
        right.actionLevel
      );
      if (actionOrder !== 0) return actionOrder;
      for (const key of [
        "overdueFollowUpCount",
        "incompleteScheduleCount",
        "unconsultedDbCount",
        "longUnmanagedCustomerCount",
        "unreadNotificationCount",
      ] as const) {
        const difference = right.metrics[key] - left.metrics[key];
        if (difference !== 0) return difference;
      }
      return left.userId - right.userId;
    });

  const summary = {
    activeUserCount: users.length,
    customerCount: activeCustomers.length,
    consultationCount: users.reduce(
      (sum, item) => sum + item.metrics.consultationCount,
      0
    ),
    followUpCount: users.reduce(
      (sum, item) => sum + item.metrics.followUpCount,
      0
    ),
    completedFollowUpCount: users.reduce(
      (sum, item) => sum + item.metrics.completedFollowUpCount,
      0
    ),
    overdueFollowUpCount: users.reduce(
      (sum, item) => sum + item.metrics.overdueFollowUpCount,
      0
    ),
    incompleteScheduleCount: users.reduce(
      (sum, item) => sum + item.metrics.incompleteScheduleCount,
      0
    ),
    unreadNotificationCount: users.reduce(
      (sum, item) => sum + item.metrics.unreadNotificationCount,
      0
    ),
    newContractCount: users.reduce(
      (sum, item) => sum + item.metrics.newContractCount,
      0
    ),
    longUnmanagedCustomerCount: users.reduce(
      (sum, item) => sum + item.metrics.longUnmanagedCustomerCount,
      0
    ),
    todayFollowUpCount: users.reduce(
      (sum, item) => sum + item.metrics.todayFollowUpCount,
      0
    ),
    todayCompletedFollowUpCount: users.reduce(
      (sum, item) => sum + item.metrics.completedFollowUpCount,
      0
    ),
    newCustomerCount: users.reduce(
      (sum, item) => sum + item.metrics.newCustomerCount,
      0
    ),
    followUpCompletionRate: null as number | null,
    goalAchievementRate: null as number | null,
    priorityAManagementRate: null as number | null,
    firstContactSlaDelayCount: 0,
  };
  summary.followUpCompletionRate =
    summary.followUpCount > 0
      ? Math.round(
          (summary.completedFollowUpCount / summary.followUpCount) * 100
        )
      : null;

  const priorityATotal = users.reduce(
    (sum, item) => sum + item.metrics.priorityACount,
    0
  );
  const priorityAManaged = users.reduce(
    (sum, item) => sum + item.metrics.priorityAManagedCount,
    0
  );
  summary.priorityAManagementRate =
    priorityATotal > 0
      ? Math.round((priorityAManaged / priorityATotal) * 100)
      : null;

  const goalDashboard = await getPerformanceGoalDashboard(
    user as any,
    period.dateTo.getFullYear(),
    period.dateTo.getMonth() + 1
  );
  const goalItem =
    goalDashboard.items?.find((item: any) => {
      if (scope.targetTeamId)
        return (
          item.goal?.targetType === "team" &&
          item.goal?.targetId === scope.targetTeamId
        );
      if (scope.targetSubBranchId)
        return (
          item.goal?.targetType === "sub_branch" &&
          item.goal?.targetId === scope.targetSubBranchId
        );
      if (input.targetUserId)
        return (
          item.goal?.targetType === "user" &&
          item.goal?.targetId === input.targetUserId
        );
      return item.goal?.targetType === "branch";
    }) ?? goalDashboard.items?.[0];
  const contractAchievement = goalItem?.achievementRate?.contractCount;
  const premiumAchievement = goalItem?.achievementRate?.monthlyPremium;
  if (contractAchievement !== undefined && contractAchievement !== null) {
    summary.goalAchievementRate = Math.round(Number(contractAchievement));
  } else if (premiumAchievement !== undefined && premiumAchievement !== null) {
    summary.goalAchievementRate = Math.round(Number(premiumAchievement));
  }

  const slaInsights = await buildFirstContactSlaInsights(
    activeCustomers,
    visibleUsers,
    scope.activeTeams
  );
  summary.firstContactSlaDelayCount =
    (slaInsights?.summary?.overdueCount ?? 0) +
    (slaInsights?.summary?.highRiskOverdueCount ?? 0) +
    (slaInsights?.summary?.criticalOverdueCount ?? 0);

  const completionInsights = await buildTeamCompletionInsights(
    user,
    visibleUsers,
    scope.activeTeams,
    period.dateFrom,
    period.dateTo
  );

  const topIssues = [
    {
      type: "overdue_follow_up",
      label: "지연 후속관리",
      count: summary.overdueFollowUpCount,
      actionLevel: classifyOperationRiskActionLevel({
        actionRequiredCount: summary.overdueFollowUpCount,
      }),
      recommendation: "지연 후속관리를 오늘 중 우선 확인해 주세요.",
    },
    {
      type: "incomplete_schedule",
      label: "미완료 일정",
      count: summary.incompleteScheduleCount,
      actionLevel: classifyOperationRiskActionLevel({
        actionRequiredCount: summary.incompleteScheduleCount,
      }),
      recommendation: "미완료 일정을 완료 또는 재조정해 주세요.",
    },
    {
      type: "unread_notification",
      label: "미확인 알림",
      count: summary.unreadNotificationCount,
      actionLevel: "informational" as const,
      recommendation: "미확인 알림을 차례로 처리해 주세요.",
    },
    {
      type: "long_unmanaged",
      label: "장기 미관리 고객",
      count: summary.longUnmanagedCustomerCount,
      actionLevel: classifyOperationRiskActionLevel({
        actionRequiredCount: summary.longUnmanagedCustomerCount,
      }),
      recommendation: "장기 미관리 고객 관리 계획을 점검해 주세요.",
    },
    {
      type: "unconsulted_db",
      label: "미상담 DB",
      count: users.reduce(
        (sum, item) => sum + item.metrics.unconsultedDbCount,
        0
      ),
      actionLevel: "action_required" as const,
      recommendation: "미상담 DB를 연락 우선순위로 정리해 주세요.",
    },
  ].filter(issue => issue.count > 0);

  const periodLabel =
    period.periodType === "today"
      ? "오늘"
      : period.periodType === "week"
        ? "이번 주"
        : period.periodType === "month"
          ? "이번 달"
          : `${period.dateFrom.toLocaleDateString("ko-KR")} ~ ${period.dateTo.toLocaleDateString("ko-KR")}`;

  const narrativeSummary = buildNarrativeSummary({
    reportType: input.reportType,
    scopeLabel: scope.label,
    periodLabel,
    summary,
    topUserName: users[0]?.name ?? null,
  });
  const copyableSummary = buildCopyableSummary({
    reportType: input.reportType,
    periodLabel,
    summary,
  });

  await createActivityLog({
    userId: user.id,
    action: "MANAGEMENT_REPORT_GENERATED",
    targetType: "management_report",
    details: JSON.stringify({
      reportType: input.reportType,
      periodType: period.periodType,
      scopeType: scope.scopeType,
      targetTeamId: scope.targetTeamId,
      targetSubBranchId: scope.targetSubBranchId,
      targetUserId: input.targetUserId ?? null,
      userCount: users.length,
      completionInsightsUserCount: completionInsights?.users?.length ?? 0,
    }),
  });

  return {
    reportMeta: {
      reportType: input.reportType,
      periodType: period.periodType,
      dateFrom: period.dateFrom.toISOString(),
      dateTo: period.dateTo.toISOString(),
      generatedAt: new Date().toISOString(),
      generatedBy: { id: user.id, name: user.name, role: user.role },
      scope: {
        type: scope.scopeType,
        label: scope.label,
        targetTeamId: scope.targetTeamId,
        targetSubBranchId: scope.targetSubBranchId,
        targetUserId: input.targetUserId ?? null,
      },
    },
    summary,
    topIssues,
    users,
    narrativeSummary,
    copyableSummary,
    empty: users.length === 0,
  };
}

export const managementReportsRouter = router({
  filterOptions: managerAnalyticsProcedure.query(async ({ ctx }) => {
    const user = ctx.user as AppUser;
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
    const hierarchyIds =
      user.role === "branch_admin"
        ? activeUsers.map(item => item.id)
        : ((await getHierarchyScopeUserIds(user)) ?? [user.id]);
    const hierarchySet = new Set(hierarchyIds);

    const visibleTeams =
      user.role === "branch_admin"
        ? activeTeams
        : activeTeams.filter(team => {
            if (user.role === "sub_branch_admin")
              return team.subBranchAdminId === user.id;
            if (user.role === "team_leader") return team.id === user.teamId;
            return false;
          });

    return {
      reportTypes:
        user.role === "branch_admin"
          ? ["daily", "weekly", "monthly", "team", "sub_branch"]
          : user.role === "sub_branch_admin"
            ? ["daily", "weekly", "monthly", "team", "sub_branch"]
            : ["daily", "weekly", "monthly", "team"],
      subBranches:
        user.role === "branch_admin"
          ? activeUsers
              .filter(item => item.role === "sub_branch_admin")
              .map(item => ({
                id: item.id,
                name: item.name ?? `부지점 #${item.id}`,
              }))
          : user.role === "sub_branch_admin"
            ? [{ id: user.id, name: user.name ?? `부지점 #${user.id}` }]
            : [],
      teams: visibleTeams.map(team => ({
        id: team.id,
        name: team.name ?? `팀 #${team.id}`,
        subBranchAdminId: team.subBranchAdminId ?? null,
      })),
      users: activeUsers
        .filter(
          item => hierarchySet.has(item.id) && item.role !== "branch_admin"
        )
        .map(item => ({
          id: item.id,
          name: item.name ?? `사용자 #${item.id}`,
          role: item.role,
          teamId: item.teamId ?? null,
          subBranchAdminId: item.subBranchAdminId ?? null,
        })),
    };
  }),

  generate: managerAnalyticsProcedure
    .input(managementReportInputSchema)
    .query(async ({ ctx, input }) =>
      buildManagementReport(ctx.user as AppUser, input)
    ),
});
