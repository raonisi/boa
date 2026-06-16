import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { buildFirstContactSlaInsights } from "./sla";
import { buildTeamCompletionInsights } from "./teamCompletion";
import { teamCoachingRouter } from "./teamCoaching";
import {
  getAccessibleSchedules,
  listCalendarSchedules,
} from "./scheduleVisibility";
import {
  onboardingAssignmentsRouter,
  onboardingTemplatesRouter,
} from "./onboarding";
import { managementReportsRouter } from "./managementReports";
import { customerDataQualityRouter } from "./customerDataQualityRouter";
import { actionPlansRouter } from "./actionPlans";
import { googleCalendarRouter } from "./googleCalendar";
import {
  triggerGoogleCalendarDeleteForSchedule,
  triggerGoogleCalendarSyncForFollowUp,
  triggerGoogleCalendarSyncForScheduleId,
} from "./googleCalendarHooks";
import {
  assertCanSelectCalendarCategory,
  logCalendarCategoryActivity,
  resolveCalendarCategoryForSave,
} from "./scheduleCalendarCategory";
import { COOKIE_NAME } from "@shared/const";
import {
  SCHEDULE_CALENDAR_CATEGORIES,
} from "@shared/scheduleCalendarCategory";
import { expectedPremiumStoredWonFromManwonInput } from "@shared/expectedPremium";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  activeUserProcedure,
  branchAdminProcedure,
  customerBulkImportProcedure,
  subBranchAdminOrAboveProcedure,
  teamLeaderOrAboveProcedure,
  managerAnalyticsProcedure,
} from "./_core/procedures";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { hashDeviceToken, maskDeviceToken } from "./deviceTokenUtil";
import {
  assignCustomer,
  assignCustomerDbToTeam,
  assignCustomerToSubBranch,
  reclaimCustomerAssignment,
  transferReclaimedCustomerWork,
  checkPhoneDuplicate,
  createActivityLog,
  createAssignmentHistory,
  createConsentLog,
  createConsultation,
  createConsultationChecklistTemplate,
  createConsultationScript,
  createContract,
  createContractHistoryEntry,
  createCustomer,
  createCustomerHandoffNote,
  createDeleteRequest,
  createFollowUp,
  createImportBatch,
  createMessageTemplate,
  createNotification,
  createPerformanceGoal,
  createSchedule,
  createStatusHistory,
  createTeam,
  completeSchedule,
  deactivateContract,
  deactivateContractWithClient,
  deactivatePerformanceGoal,
  deactivateTeam,
  softDeleteSchedule,
  softDeleteCustomer,
  getActivityLogs,
  getAllContracts,
  getAllTeams,
  getAllUsers,
  getAssignmentHistory,
  getConsentLogs,
  getConsultationById,
  getConsultationChecklistTemplateById,
  getConsultationChecklistTemplates,
  getConsultationCheckResults,
  getConsultationScriptById,
  getConsultationScripts,
  getConsultationsByCustomer,
  getLatestConsultationDatesByCustomerIds,
  getContractById,
  getContractPermanentDeleteBlockers,
  getContractHistory,
  getContractsByCustomer,
  getContractsByCustomerIncludingInactive,
  getCustomerPermanentDeleteBlockers,
  getCustomerById,
  getCustomerHandoffNoteById,
  getCustomerHandoffNotes,
  getCustomerTimeline,
  getCustomers,
  getSalesFunnelAggregates,
  getDeletedContracts,
  getDeletedCustomers,
  getDeletedTeams,
  getDeleteRequestById,
  getDeleteRequests,
  getFollowUpById,
  getFollowUps,
  getCustomersByImportBatch,
  getImportBatchByBatchId,
  getImportBatchCancelBlockers,
  getNotifications,
  getNotificationById,
  getPendingDeleteRequestForTarget,
  getMessageTemplateById,
  getMessageTemplates,
  getActivePerformanceGoal,
  getPerformanceGoalById,
  getPerformanceGoalDashboard,
  getPerformanceStats,
  getSchedules,
  getScheduleById,
  getStatusHistory,
  getTeamPermanentDeleteBlockers,
  getTeamById,
  getUnreadCount,
  getUserById,
  markAllNotificationsRead,
  markNotificationRead,
  updateConsultationChecklistTemplate,
  updateConsultationScript,
  updateConsultation,
  updateContract,
  updateCustomer,
  updateCustomerHandoffNote,
  updateMessageTemplate,
  updateNotificationProcessStatus,
  updatePerformanceGoal,
  updateSchedule,
  updateTeam,
  updateUserAccountStatus,
  updateUserParent,
  updateUserOrganization,
  updateUserRole,
  setUserPermission,
  updateUserSubBranchAdmin,
  updateUserTeam,
  getSettings,
  createSetting,
  toggleSetting,
  updateSetting,
  getUsersBySubBranchAdminId,
  getUsersByTeamId,
  getUserByEmail,
  getAllUsersByEmail,
  createUser,
  deactivateAllUserDeviceTokens,
  deactivateUserDeviceToken,
  executeUserHandoff,
  getHandoffHistories,
  getHandoffPreview,
  invalidateAllUserSessions,
  invalidateUserSessions,
  linkUserOpenId,
  ensureDefaultConsultationChecklists,
  ensureDefaultConsultationScripts,
  ensureDefaultMessageTemplates,
  listImportBatches,
  listPerformanceGoals,
  getAllNotifications,
  getNotificationsFiltered,
  normalizePhone,
  normalizeBulkImportRow,
  runDbTransaction,
  detectForbiddenColumns,
  findUserByNameUnique,
  findDuplicateCustomerGroups,
  findTeamByNameAndSubBranch,
  getCustomerMergePreview,
  validateBulkImportRow,
  mergeCustomers,
  getAllActiveCustomerPhones,
  getPushNotificationOperationSummary,
  getPushNotificationPreference,
  permanentlyDeleteContract,
  permanentlyDeleteCustomer,
  permanentlyDeleteTeam,
  restoreContract,
  restoreCustomer,
  restoreTeam,
  bulkCreateCustomers,
  updateDeleteRequest,
  updateFollowUp,
  updateImportBatch,
  listUserDeviceTokens,
  listPushNotificationLogs,
  updatePushNotificationPreference,
  upsertConsultationCheckResult,
  upsertUserDeviceToken,
  resetUserOAuthLink,
  softDeleteCustomersByImportBatch,
  BulkImportRow,
  BulkImportValidationResult,
} from "./db";
import { CUSTOMER_BULK_IMPORT_PERMISSION } from "@shared/permissions";
import {
  cancelPendingNotifications,
  cancelScheduleIncompleteNotification,
  cancelScheduleTimingNotifications,
  createBirthdayReminder,
  createContractReminders,
  createPaymentStatusReminder,
  createReconsultReminder,
  createScheduleIncompleteReminder,
  createScheduleReminderByOffset,
  createUncontactedReminder,
  refreshLongUnmanagedReminder,
} from "./notifications";
import {
  formatKstLocalDate,
  getKstDayRange,
  isSameKstDate,
  parseKstLocalDateTime,
} from "@shared/timePolicy";
import * as pushNotifications from "./pushNotifications";

/**
 * Domain routers live in this file for now. Split candidates: `customers`, `contracts`,
 * `notifications`, `users`, `settings` under `server/routers/*.ts` — shared helpers stay importable from one module.
 */

/** 고객 소유권 검증 헬퍼 */
async function verifyCustomerAccess(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
    accountStatus: string;
  },
  customerId: number,
  options: { includeInactiveOrDeleted?: boolean } = {}
) {
  const customer = await getCustomerById(customerId);
  if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
  if (!options.includeInactiveOrDeleted && isSoftDeleted(customer))
    throw new TRPCError({ code: "NOT_FOUND" });
  if (user.role === "branch_admin") return customer;
  if (user.role === "sub_branch_admin") {
    if (customer.subBranchAdminId !== user.id)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 산하 고객만 접근 가능합니다.",
      });
    return customer;
  }
  if (user.role === "team_leader") {
    if (customer.assignedTeamId && customer.assignedTeamId === user.teamId)
      return customer;
    const agent = customer.agentId ? await getUserById(customer.agentId) : null;
    if (!agent || agent.teamId !== user.teamId)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 팀 고객만 접근 가능합니다.",
      });
    return customer;
  }
  // member
  if (customer.agentId !== user.id)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 고객만 접근 가능합니다.",
    });
  return customer;
}

async function assertTeamCanBeDeactivated(teamId: number) {
  const team = await getTeamById(teamId);
  if (!team) throw new TRPCError({ code: "NOT_FOUND" });
  if ((team as any).isActive === false || (team as any).deletedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 비활성 처리된 팀입니다.",
    });
  }

  const activeUsers = (await getUsersByTeamId(teamId)).filter(
    (u: any) => u.accountStatus === "active"
  );
  if (activeUsers.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "소속 활성 사용자가 있는 팀은 삭제할 수 없습니다.",
    });
  }

  const activeCustomers = await getCustomers({ teamId });
  if (activeCustomers.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "활성 고객이 남아 있는 팀은 삭제할 수 없습니다.",
    });
  }

  const activeSchedules = await getSchedules({ teamId });
  if (activeSchedules.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "진행 중인 일정이 남아 있는 팀은 삭제할 수 없습니다.",
    });
  }

  return team;
}

async function verifyCustomerDeleteAccess(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
    accountStatus: string;
  },
  customerId: number
) {
  if (user.role !== "branch_admin" && user.role !== "sub_branch_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "고객 삭제는 지점장 또는 부지점장만 가능합니다.",
    });
  }
  const customer = await verifyCustomerAccess(user, customerId);
  if ((customer as any).isActive === false || (customer as any).deletedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 비활성 처리된 고객입니다.",
    });
  }
  const activeContracts = await getContractsByCustomer(customerId);
  if (activeContracts.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "활성 계약이 있는 고객은 삭제할 수 없습니다. 계약을 먼저 비활성 처리해주세요.",
    });
  }
  return customer;
}

async function verifyContractDeleteAccess(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
    accountStatus: string;
  },
  contractId: number
) {
  if (user.role !== "branch_admin" && user.role !== "sub_branch_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "계약 삭제는 지점장 또는 부지점장만 가능합니다.",
    });
  }
  const contract = await getContractById(contractId);
  if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
  if ((contract as any).isActive === false || (contract as any).deletedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 비활성 처리된 계약입니다.",
    });
  }
  await verifyCustomerAccess(user, contract.customerId);
  return contract;
}

async function verifyContractDeleteRequestAccess(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
    accountStatus: string;
  },
  contractId: number
) {
  if (user.role === "branch_admin") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "branch_admin은 삭제 요청 대신 관리자 삭제/승인 기능을 사용하세요.",
    });
  }
  const contract = await getContractById(contractId);
  if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
  if ((contract as any).isActive === false || (contract as any).deletedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 비활성 처리된 계약은 삭제 요청할 수 없습니다.",
    });
  }
  await verifyCustomerAccess(user, contract.customerId);
  return contract;
}

function isSoftDeleted(row: {
  isActive?: boolean | null;
  deletedAt?: Date | null;
}) {
  return row.isActive === false || !!row.deletedAt;
}

const PERMANENT_DELETE_CONFIRM_TEXT = "\uC644\uC804\uC0AD\uC81C";
const PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE =
  "\uD655\uC778 \uBB38\uAD6C\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
const PERMANENT_DELETE_REASON_REQUIRED_MESSAGE =
  "\uC644\uC804\uC0AD\uC81C \uC0AC\uC720\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.";
const TEAM_PERMANENT_DELETE_BLOCKED_MESSAGE =
  "\uC5F0\uACB0\uB41C \uC0AC\uC6A9\uC790, \uACE0\uAC1D, \uC77C\uC815 \uB610\uB294 \uBC30\uC815 \uC774\uB825\uC774 \uC788\uC5B4 \uD300\uC744 \uC644\uC804\uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC6B4\uC601 \uC774\uB825 \uBCF4\uC874\uC744 \uC704\uD574 \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD574\uC8FC\uC138\uC694.";
const CUSTOMER_PERMANENT_DELETE_BLOCKED_MESSAGE =
  "\uC5F0\uACB0\uB41C \uACC4\uC57D, \uC77C\uC815, \uC0C1\uB2F4\uAE30\uB85D, \uC54C\uB9BC \uB610\uB294 \uBC30\uC815 \uC774\uB825\uC774 \uC788\uC5B4 \uACE0\uAC1D\uC744 \uC644\uC804\uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC6B4\uC601 \uC774\uB825 \uBCF4\uC874\uC744 \uC704\uD574 \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD574\uC8FC\uC138\uC694.";
const CONTRACT_PERMANENT_DELETE_BLOCKED_MESSAGE =
  "\uACC4\uC57D \uC774\uB825 \uB610\uB294 \uC54C\uB9BC \uC774\uB825\uC774 \uB0A8\uC544 \uC788\uC5B4 \uC644\uC804\uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uAC10\uC0AC \uCD94\uC801\uC744 \uC704\uD574 \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD574\uC8FC\uC138\uC694.";
const IMPORT_BATCH_CANCEL_CONFIRM_TEXT = "BATCH\uCDE8\uC18C";
const IMPORT_BATCH_ALREADY_CANCELLED_MESSAGE =
  "\uC774\uBBF8 \uCDE8\uC18C\uB41C batch\uC785\uB2C8\uB2E4.";
const IMPORT_BATCH_NO_ACTIVE_CUSTOMERS_MESSAGE =
  "\uCDE8\uC18C\uD560 active \uACE0\uAC1D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
const IMPORT_BATCH_CANCEL_BLOCKED_MESSAGE =
  "\uACC4\uC57D, \uC77C\uC815, \uC0C1\uB2F4\uAE30\uB85D, \uC54C\uB9BC \uB610\uB294 \uBC30\uC815 \uC774\uB825\uC774 \uC5F0\uACB0\uB41C \uACE0\uAC1D\uC774 \uC788\uC5B4 batch \uCDE8\uC18C\uB97C \uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD544\uC694\uD55C \uACE0\uAC1D\uC740 \uAC1C\uBCC4 \uC0AD\uC81C \uC694\uCCAD \uB610\uB294 \uAD00\uB9AC\uC790 \uAC80\uD1A0 \uD6C4 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694.";

const AFTERCARE_CAMPAIGN_TYPES = [
  "contract_30",
  "contract_90",
  "contract_180",
  "contract_365",
  "birthday",
  "long_unmanaged",
  "incomplete_schedule",
  "claim_guide",
] as const;
type AftercareCampaignType = (typeof AFTERCARE_CAMPAIGN_TYPES)[number];

const AFTERCARE_TEMPLATE_SITUATION_MAP: Record<
  AftercareCampaignType,
  string[]
> = {
  contract_30: ["post_contract_care", "general_check"],
  contract_90: ["post_contract_care", "general_check"],
  contract_180: ["post_contract_care", "general_check"],
  contract_365: ["post_contract_care", "general_check"],
  birthday: ["birthday", "general_check"],
  long_unmanaged: ["long_unmanaged", "general_check"],
  incomplete_schedule: ["follow_up_schedule", "general_check"],
  claim_guide: ["document_request", "general_check"],
};

const aftercareCampaignInputSchema = z.object({
  campaignType: z.enum(AFTERCARE_CAMPAIGN_TYPES).optional(),
  periodType: z.enum(["day", "week", "month", "custom"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  scope: z.enum(["all", "mine"]).optional(),
  assignedUserId: z.number().optional(),
  statusFilter: z.enum(["all", "pending", "completed", "overdue"]).optional(),
});

function getAftercareCampaignLabel(type: AftercareCampaignType) {
  const labels: Record<AftercareCampaignType, string> = {
    contract_30: "계약 후 30일 케어",
    contract_90: "계약 90일 점검",
    contract_180: "계약 180일 점검",
    contract_365: "계약 365일 연간 점검",
    birthday: "생일 케어",
    long_unmanaged: "장기 미관리 고객",
    incomplete_schedule: "미완료 일정 후속",
    claim_guide: "보험금 청구 안내",
  };
  return labels[type];
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateOnlyKey(value: Date) {
  return getKstDayRange(value).dateKey;
}

function buildAftercareTargetStatus(params: {
  now: Date;
  dueDate: Date;
  openFollowUp?: { nextContactDate?: Date | null } | null;
  completedFollowUp?: { completedAt?: Date | null } | null;
}) {
  if (params.completedFollowUp) return "completed" as const;
  if (params.openFollowUp) {
    const due = params.openFollowUp.nextContactDate
      ? new Date(params.openFollowUp.nextContactDate)
      : params.dueDate;
    return due.getTime() < params.now.getTime()
      ? ("overdue" as const)
      : ("pending" as const);
  }
  return params.dueDate.getTime() < params.now.getTime()
    ? ("overdue" as const)
    : ("pending" as const);
}

async function buildAftercareCampaignData(
  actor: {
    id: number;
    role: string;
    teamId: number | null;
    accountStatus: string;
  },
  input?: z.infer<typeof aftercareCampaignInputSchema>
) {
  if (input?.scope === "all" && actor.role !== "branch_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "전체 범위는 지점장만 조회할 수 있습니다.",
    });
  }
  if (
    input?.assignedUserId !== undefined &&
    input.assignedUserId !== actor.id &&
    actor.role === "member"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 고객만 조회 가능합니다.",
    });
  }
  if (
    input?.assignedUserId !== undefined &&
    actor.role !== "branch_admin" &&
    actor.role !== "member"
  ) {
    await verifyTargetUserAccess(actor, input.assignedUserId);
  }

  const now = new Date();
  const scopeAgentIds =
    actor.role === "branch_admin"
      ? undefined
      : actor.role === "member"
        ? [actor.id]
        : ((await getHierarchyScopeUserIds(actor)) ?? [actor.id]);

  const [
    customerList,
    contractList,
    followUpList,
    scheduleList,
    allUsers,
    templates,
  ] = await Promise.all([
    actor.role === "branch_admin"
      ? getCustomers({})
      : actor.role === "member"
        ? getCustomers({ agentId: actor.id })
        : getCustomers({ agentIds: scopeAgentIds }),
    actor.role === "branch_admin"
      ? getAllContracts({})
      : actor.role === "member"
        ? getAllContracts({ agentId: actor.id })
        : getAllContracts({ agentIds: scopeAgentIds }),
    actor.role === "branch_admin"
      ? getFollowUps({ statuses: ["scheduled", "postponed", "completed"] })
      : actor.role === "member"
        ? getFollowUps({
            agentId: actor.id,
            statuses: ["scheduled", "postponed", "completed"],
          })
        : getFollowUps({
            agentIds: scopeAgentIds,
            statuses: ["scheduled", "postponed", "completed"],
          }),
    getAccessibleSchedules(actor),
    getAllUsers(),
    getMessageTemplates(false),
  ]);

  const scopedCustomers = input?.assignedUserId
    ? customerList.filter(customer => customer.agentId === input.assignedUserId)
    : customerList;

  const activeUserMap = new Map(
    allUsers
      .filter(user => user.accountStatus === "active")
      .map(user => [user.id, user])
  );

  const contractByCustomer = new Map<number, typeof contractList>();
  for (const contract of contractList) {
    const list = contractByCustomer.get(contract.customerId) ?? [];
    list.push(contract);
    contractByCustomer.set(contract.customerId, list);
  }

  const followUpsByCustomer = new Map<number, typeof followUpList>();
  for (const followUp of followUpList) {
    const list = followUpsByCustomer.get(followUp.customerId) ?? [];
    list.push(followUp);
    followUpsByCustomer.set(followUp.customerId, list);
  }

  const schedulesByCustomer = new Map<number, typeof scheduleList>();
  for (const schedule of scheduleList) {
    if (!schedule.customerId) continue;
    const list = schedulesByCustomer.get(schedule.customerId) ?? [];
    list.push(schedule);
    schedulesByCustomer.set(schedule.customerId, list);
  }

  const consultationDates = await getLatestConsultationDatesByCustomerIds(
    scopedCustomers.map(customer => customer.id)
  );
  const consultationDateByCustomer = new Map(
    consultationDates.map(item => [item.customerId, item.latestCreatedAt])
  );
  const templateIdBySituation = new Map<string, number[]>();
  for (const template of templates) {
    const list = templateIdBySituation.get(template.situation) ?? [];
    list.push(template.id);
    templateIdBySituation.set(template.situation, list);
  }

  function buildTarget(
    type: AftercareCampaignType,
    customer: (typeof scopedCustomers)[number],
    baseDate: Date,
    reason: string,
    recommendedAction: string,
    dueInDays = 3
  ) {
    const campaignFollowUps = (
      followUpsByCustomer.get(customer.id) ?? []
    ).filter(item => !item.deletedAt);
    const openFollowUp = campaignFollowUps.find(
      item => item.status === "scheduled" || item.status === "postponed"
    );
    const completedFollowUp = campaignFollowUps.find(
      item =>
        item.status === "completed" &&
        item.completedAt &&
        new Date(item.completedAt).getTime() >= toDayStart(baseDate).getTime()
    );
    const dueDate = addDays(baseDate, dueInDays);
    const status = buildAftercareTargetStatus({
      now,
      dueDate,
      openFollowUp,
      completedFollowUp,
    });
    const recommendedTemplateIds = AFTERCARE_TEMPLATE_SITUATION_MAP[
      type
    ].flatMap(situation => templateIdBySituation.get(situation) ?? []);
    const assignee = customer.agentId
      ? activeUserMap.get(customer.agentId)
      : undefined;
    const highRisk = status === "overdue" || !assignee;
    return {
      customerId: customer.id,
      customerDisplayName: customer.name,
      assignedUserId: customer.agentId,
      assignedUserName: assignee?.name ?? "미배정",
      reason,
      baseDate,
      dueDate,
      daysFromBase: daysBetween(baseDate, now),
      status,
      recommendedAction,
      recommendedTemplateIds,
      highRisk,
      links: {
        customerDetailPath: `/customers/${customer.id}`,
      },
    };
  }

  function matchesPeriod(date: Date) {
    if (input?.periodType === "custom" && input.dateFrom && input.dateTo) {
      const from = toDayStart(parseKstLocalDateTime(input.dateFrom));
      const to = toDayEnd(parseKstLocalDateTime(input.dateTo));
      return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
    }
    if (input?.periodType === "day")
      return toDateOnlyKey(date) === toDateOnlyKey(now);
    if (input?.periodType === "week") {
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const weekStart = toDayStart(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + mondayOffset
        )
      );
      const weekEnd = toDayEnd(addDays(weekStart, 6));
      return (
        date.getTime() >= weekStart.getTime() &&
        date.getTime() <= weekEnd.getTime()
      );
    }
    if (input?.periodType === "month") {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    }
    return true;
  }

  const results: Record<
    AftercareCampaignType,
    ReturnType<typeof buildTarget>[]
  > = {
    contract_30: [],
    contract_90: [],
    contract_180: [],
    contract_365: [],
    birthday: [],
    long_unmanaged: [],
    incomplete_schedule: [],
    claim_guide: [],
  };

  for (const customer of scopedCustomers) {
    const contracts = (contractByCustomer.get(customer.id) ?? [])
      .filter(contract => !!contract.contractDate)
      .sort(
        (a, b) =>
          new Date(b.contractDate as Date).getTime() -
          new Date(a.contractDate as Date).getTime()
      );
    const latestContract = contracts[0];
    if (latestContract?.contractDate) {
      const contractDate = new Date(latestContract.contractDate);
      const daysFromContract = daysBetween(contractDate, now);
      if (
        daysFromContract >= 25 &&
        daysFromContract <= 35 &&
        matchesPeriod(contractDate)
      ) {
        results.contract_30.push(
          buildTarget(
            "contract_30",
            customer,
            contractDate,
            "계약 후 30일 내외 고객 케어 시점입니다.",
            "보장 내용 확인 및 청구 절차 안내"
          )
        );
      }
      if (
        daysFromContract >= 85 &&
        daysFromContract <= 95 &&
        matchesPeriod(contractDate)
      ) {
        results.contract_90.push(
          buildTarget(
            "contract_90",
            customer,
            contractDate,
            "계약 90일 초기 유지 점검 시점입니다.",
            "초기 유지관리 및 질문 확인"
          )
        );
      }
      if (
        daysFromContract >= 175 &&
        daysFromContract <= 185 &&
        matchesPeriod(contractDate)
      ) {
        results.contract_180.push(
          buildTarget(
            "contract_180",
            customer,
            contractDate,
            "계약 180일 중기 점검 시점입니다.",
            "중기 사후관리와 보장 이해도 점검"
          )
        );
      }
      if (
        daysFromContract >= 350 &&
        daysFromContract <= 380 &&
        matchesPeriod(contractDate)
      ) {
        results.contract_365.push(
          buildTarget(
            "contract_365",
            customer,
            contractDate,
            "계약 1년 연간 점검 시점입니다.",
            "연간 보장 점검과 상황 변화 확인"
          )
        );
      }
    }

    if (customer.birthDate) {
      const birthDate = new Date(customer.birthDate);
      const birthThisYear = new Date(
        now.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
      );
      const thisWeek = Math.abs(daysBetween(now, birthThisYear)) <= 6;
      const thisMonth = birthThisYear.getMonth() === now.getMonth();
      if ((thisWeek || thisMonth) && matchesPeriod(birthThisYear)) {
        results.birthday.push(
          buildTarget(
            "birthday",
            customer,
            birthThisYear,
            "생일 기반 안부 케어 대상입니다.",
            "안부 인사와 관계 관리"
          )
        );
      }
    }

    const latestConsultationAt = consultationDateByCustomer.get(customer.id)
      ? new Date(consultationDateByCustomer.get(customer.id) as Date)
      : undefined;
    const completedFollowUpAt = (followUpsByCustomer.get(customer.id) ?? [])
      .filter(item => item.status === "completed" && item.completedAt)
      .map(item => new Date(item.completedAt as Date))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const completedScheduleAt = (schedulesByCustomer.get(customer.id) ?? [])
      .filter(item => item.status === "완료" && item.completedAt)
      .map(item => new Date(item.completedAt as Date))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const managementStart = customerManagementStartDate(customer);
    const latestManagedAt = [
      latestConsultationAt,
      completedFollowUpAt,
      completedScheduleAt,
      managementStart,
    ]
      .filter((item): item is Date => !!item)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (
      latestManagedAt &&
      daysBetween(latestManagedAt, now) >= 90 &&
      matchesPeriod(latestManagedAt)
    ) {
      results.long_unmanaged.push(
        buildTarget(
          "long_unmanaged",
          customer,
          latestManagedAt,
          "최근 90일 이상 관리 이력이 없습니다.",
          "관리 공백 해소를 위한 재연락"
        )
      );
    }

    const overdueSchedules = (
      schedulesByCustomer.get(customer.id) ?? []
    ).filter(
      item =>
        !["완료", "취소", "노쇼"].includes(item.status) &&
        new Date(item.endTime ?? item.startTime).getTime() < now.getTime()
    );
    if (overdueSchedules.length > 0) {
      const baseDate = new Date(
        overdueSchedules[0].endTime ?? overdueSchedules[0].startTime
      );
      if (matchesPeriod(baseDate)) {
        results.incomplete_schedule.push(
          buildTarget(
            "incomplete_schedule",
            customer,
            baseDate,
            "기한이 지난 미완료 일정이 있습니다.",
            "미완료 일정 후속관리 및 상담기록 연결",
            1
          )
        );
      }
    }

    const tags = parseRecommendationTags(customer.customerTags);
    const claimGuideTarget =
      tags.some(tag =>
        ["청구", "보험금", "claim"].some(keyword => tag.includes(keyword))
      ) ||
      (customer.nextAction?.includes("청구") ?? false) ||
      customer.consultStatus === "해지관리";
    if (claimGuideTarget) {
      const baseDate = latestConsultationAt ?? managementStart;
      if (matchesPeriod(baseDate)) {
        results.claim_guide.push(
          buildTarget(
            "claim_guide",
            customer,
            baseDate,
            "청구 안내가 필요한 고객 상태입니다.",
            "청구 절차 및 필요서류 안내",
            2
          )
        );
      }
    }
  }

  const campaigns = AFTERCARE_CAMPAIGN_TYPES.filter(
    type => !input?.campaignType || input.campaignType === type
  ).map(type => {
    const allTargets = results[type]
      .filter(
        target =>
          !input?.statusFilter ||
          input.statusFilter === "all" ||
          target.status === input.statusFilter
      )
      .sort((a, b) =>
        b.highRisk === a.highRisk
          ? a.dueDate.getTime() - b.dueDate.getTime()
          : Number(b.highRisk) - Number(a.highRisk)
      );

    const assigneeSummaryMap = new Map<
      number,
      {
        userId: number;
        name: string;
        role: string;
        teamName: string;
        targetCount: number;
        completedCount: number;
        pendingCount: number;
      }
    >();
    for (const target of allTargets) {
      if (!target.assignedUserId) continue;
      const user = activeUserMap.get(target.assignedUserId);
      if (!user) continue;
      const existing = assigneeSummaryMap.get(user.id) ?? {
        userId: user.id,
        name: user.name ?? `사용자 ${user.id}`,
        role: user.role,
        teamName: user.teamId ? `팀 ${user.teamId}` : "-",
        targetCount: 0,
        completedCount: 0,
        pendingCount: 0,
      };
      existing.targetCount += 1;
      if (target.status === "completed") existing.completedCount += 1;
      if (target.status === "pending" || target.status === "overdue")
        existing.pendingCount += 1;
      assigneeSummaryMap.set(user.id, existing);
    }

    const summary = {
      targetCount: allTargets.length,
      pendingCount: allTargets.filter(target => target.status === "pending")
        .length,
      completedCount: allTargets.filter(target => target.status === "completed")
        .length,
      overdueCount: allTargets.filter(target => target.status === "overdue")
        .length,
      highRiskCount: allTargets.filter(target => target.highRisk).length,
    };

    return {
      campaignType: type,
      policy: getAftercareCampaignLabel(type),
      summary,
      assigneeSummary: Array.from(assigneeSummaryMap.values()).map(item => ({
        ...item,
        completionRate:
          item.targetCount > 0
            ? Math.round((item.completedCount / item.targetCount) * 100)
            : 0,
      })),
      targets: allTargets,
    };
  });

  return { generatedAt: now, campaigns };
}

async function requireSoftDeletedTeam(teamId: number) {
  const team = await getTeamById(teamId);
  if (!team) throw new TRPCError({ code: "NOT_FOUND" });
  if (!isSoftDeleted(team)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "활성 팀은 복구/완전삭제 대상이 아닙니다.",
    });
  }
  return team;
}

async function requireSoftDeletedCustomer(customerId: number) {
  const customer = await getCustomerById(customerId);
  if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
  if (!isSoftDeleted(customer)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "활성 고객은 복구/완전삭제 대상이 아닙니다.",
    });
  }
  return customer;
}

async function requireSoftDeletedContract(contractId: number) {
  const contract = await getContractById(contractId);
  if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
  if (!isSoftDeleted(contract)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "활성 계약은 복구/완전삭제 대상이 아닙니다.",
    });
  }
  return contract;
}

const permanentDeleteReasonSchema = z
  .string()
  .trim()
  .min(1, PERMANENT_DELETE_REASON_REQUIRED_MESSAGE)
  .max(
    500,
    "\uC644\uC804\uC0AD\uC81C \uC0AC\uC720\uB294 500\uC790 \uC774\uD558\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694."
  );

function sanitizePermanentDeleteReason(reason: string) {
  return reason
    .replace(/\b\d{2,3}[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, "[redacted-phone]")
    .replace(
      /\b(?:token|secret|password|api[_-]?key|database_url)\s*[:=]\s*\S+/gi,
      "[redacted-secret]"
    );
}

async function buildDeleteRequestView(
  request: Awaited<ReturnType<typeof getDeleteRequests>>[number]
) {
  const contract = await getContractById(request.targetId);
  const customer = request.customerId
    ? await getCustomerById(request.customerId)
    : undefined;
  const requester = request.requestedBy
    ? await getUserById(request.requestedBy)
    : undefined;
  return {
    ...request,
    contract,
    customer: customer ? { id: customer.id, name: customer.name } : null,
    requester: requester
      ? {
          id: requester.id,
          name: requester.name,
          role: requester.role,
          teamId: requester.teamId,
          subBranchAdminId: requester.subBranchAdminId,
        }
      : null,
  };
}

async function log(
  userId: number,
  action: string,
  targetType?: string,
  targetId?: number,
  details?: string,
  client?: Parameters<typeof createActivityLog>[1]
) {
  await createActivityLog(
    {
      userId,
      action,
      targetType,
      targetId,
      details: standardizeLogDetails({
        actor: userId,
        targetType,
        targetId,
        details,
      }),
    },
    client
  );
}

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return "[masked-email]";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "[masked-phone]";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskBirthDateForLogs(value: string) {
  const normalized = value.trim();
  const iso = normalized.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
  if (iso) return `${iso[1]}-**-**`;
  const compact = normalized.replace(/\D/g, "");
  if (compact.length === 6) return `${compact.slice(0, 2)}****`;
  if (compact.length === 8) return `${compact.slice(0, 4)}****`;
  return "[masked-birth-date]";
}

function sanitizeLogText(value: string, maxLength = 160) {
  const sanitized = value
    .replace(/\b\d{6}-\d{7}\b/g, match => `${match.slice(0, 6)}-*******`)
    .replace(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/g, "$1-**-**")
    .replace(/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match =>
      maskPhone(match)
    )
    .replace(/\b02[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match => {
      const digits = match.replace(/\D/g, "");
      return `${digits.slice(0, 2)}-***-${digits.slice(-4)}`;
    })
    .replace(
      /\b([A-Z0-9._%+-])([A-Z0-9._%+-]*)(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
      (_match, first, rest, domain) =>
        `${first}${"*".repeat(Math.max(3, String(rest).length))}${domain}`
    )
    .replace(
      /\b(?:token|accessToken|refreshToken|idToken|firebaseToken|deviceToken|fcmToken|secret|clientSecret|password|api[_-]?key|privateKey|DATABASE_URL|JWT_SECRET|authorization|cookie|session|credential|keyFile|googleClientSecret|firebaseAdmin)\s*[:=]\s*[^,\s"}]+/gi,
      "[REDACTED]"
    );
  return sanitized.length > maxLength
    ? `${sanitized.slice(0, maxLength)}...`
    : sanitized;
}

function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (typeof value === "string") return sanitizeLogText(value);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (
      /(password|pass|token|accesstoken|refreshtoken|idtoken|firebasetoken|devicetoken|fcmtoken|secret|clientsecret|apikey|privatekey|serviceaccount|database_url|jwt_secret|authorization|cookie|session|credential|keyfile|googleclientsecret|firebaseadmin|openid)/i.test(
        normalizedKey
      )
    ) {
      result[key] = "[REDACTED]";
    } else if (
      /(ssn|residentnumber|rrn|policy_number|policynumber)/i.test(normalizedKey)
    ) {
      result[key] = "[REDACTED]";
    } else if (
      /birth(date|day)?/i.test(normalizedKey) &&
      typeof raw === "string"
    ) {
      result[key] = maskBirthDateForLogs(raw);
    } else if (
      /phone|contact|mobile|tel/i.test(normalizedKey) &&
      typeof raw === "string"
    ) {
      result[key] = maskPhone(raw);
    } else if (/email/i.test(normalizedKey) && typeof raw === "string") {
      result[key] = maskEmail(raw);
    } else if (/(premium|amount|fee)/i.test(normalizedKey)) {
      result[key] = "금액 정보 변경 [redacted]";
    } else if (
      /(content|body|scriptbody|templatebody|description|memo|message|note|productname|diseasename|illness|medical)/i.test(
        normalizedKey
      )
    ) {
      result[key] = "업무 상세 변경 [redacted]";
    } else if (normalizedKey.includes("email") && typeof raw === "string") {
      result[key] = maskEmail(raw);
    } else if (normalizedKey.includes("phone") && typeof raw === "string") {
      result[key] = maskPhone(raw);
    } else {
      result[key] = sanitizeLogValue(raw);
    }
  }
  return result;
}

function sanitizeActivityLogDetails(details?: string | null) {
  if (!details) return details ?? null;
  try {
    return JSON.stringify(sanitizeLogValue(JSON.parse(details)));
  } catch {
    return sanitizeLogText(details, 240);
  }
}

function sanitizeActivityLogRow<T extends { details?: string | null }>(
  entry: T
): T {
  return {
    ...entry,
    details: sanitizeActivityLogDetails(entry.details),
    ...("ipAddress" in entry
      ? { ipAddress: entry.ipAddress ? "[REDACTED]" : entry.ipAddress }
      : {}),
    ...("userAgent" in entry
      ? {
          userAgent: entry.userAgent
            ? sanitizeLogText(String(entry.userAgent), 80)
            : entry.userAgent,
        }
      : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function standardizeLogDetails(data: {
  actor: number;
  targetId?: number | null;
  targetType?: string;
  details?: string;
}) {
  let parsed: Record<string, unknown> | null = null;
  if (data.details) {
    try {
      parsed = JSON.parse(data.details);
    } catch {
      parsed = { metadata: { note: data.details } };
    }
  }

  const metadataSource = parsed
    ? Object.fromEntries(
        Object.entries(parsed).filter(
          ([key]) =>
            ![
              "actor",
              "targetId",
              "targetUserId",
              "targetType",
              "beforeValue",
              "afterValue",
              "before",
              "after",
            ].includes(key)
        )
      )
    : {};

  return logDetails({
    actor: Number(parsed?.actor ?? data.actor),
    targetId:
      (parsed?.targetId as number | null | undefined) ??
      (parsed?.targetUserId as number | null | undefined) ??
      data.targetId ??
      null,
    targetType: (parsed?.targetType as string | undefined) ?? data.targetType,
    beforeValue: asRecord(parsed?.beforeValue ?? parsed?.before),
    afterValue: asRecord(parsed?.afterValue ?? parsed?.after),
    metadata: asRecord(parsed?.metadata) ?? metadataSource,
  });
}

function logDetails(data: {
  actor: number;
  targetId?: number | null;
  targetType?: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  return JSON.stringify({
    actor: data.actor,
    targetId: data.targetId ?? null,
    targetType: data.targetType ?? null,
    beforeValue: sanitizeLogValue(data.beforeValue ?? null),
    afterValue: sanitizeLogValue(data.afterValue ?? null),
    metadata: sanitizeLogValue(data.metadata ?? {}),
  });
}

const CUSTOMER_PRIORITIES = ["A", "B", "C", "D", "unclassified"] as const;
const CONSULTATION_TYPES = [
  "전화",
  "카톡",
  "문자",
  "방문",
  "소개",
  "보장분석",
  "계약상담",
  "사후관리",
  "기타",
] as const;
const CUSTOMER_NEEDS = [
  "보험료 부담",
  "보장 불안",
  "가족 보장",
  "실손/의료비",
  "암/뇌/심장 보장",
  "운전자보험",
  "해지 고민",
  "리밸런싱",
  "자녀 보장",
  "노후/간병",
  "기타",
] as const;
const CUSTOMER_NEXT_ACTIONS = [
  "재연락",
  "설계안 발송",
  "보장분석 진행",
  "계약 진행",
  "추가 자료 요청",
  "가족과 상의",
  "보류",
  "거절",
  "장기관리",
  "사후관리",
] as const;
const CUSTOMER_TAGS = [
  "가격민감형",
  "보장불안형",
  "가족책임형",
  "무관심형",
  "해지위험",
  "리밸런싱필요",
  "사후관리필요",
  "소개가능성",
  "고액계약가능성",
  "장기관리",
] as const;

const CUSTOMER_RECLAIM_BULK_LIMIT = 100;
const CUSTOMER_BULK_ASSIGNEE_LIMIT = 100;
const customerReclaimReasonSchema = z
  .string()
  .trim()
  .min(1, "DB 회수 사유를 입력해주세요.")
  .max(300, "DB 회수 사유는 300자 이내로 입력해주세요.");
const customerAssigneeChangeReasonSchema = z
  .string()
  .trim()
  .max(300, "담당자 지정 사유는 300자 이내로 입력해주세요.")
  .optional();

const CHECKLIST_PHASES = ["before", "during", "after"] as const;
const CHECKLIST_CATEGORIES = [
  "basic",
  "needs",
  "coverage",
  "premium",
  "family",
  "follow_up",
  "compliance",
] as const;
const TEMPLATE_SITUATIONS = [
  "missed_call",
  "proposal_follow_up",
  "pre_contract_check",
  "post_contract_care",
  "long_unmanaged",
  "birthday",
  "follow_up_schedule",
  "document_request",
  "after_consultation",
  "general_check",
] as const;
const TEMPLATE_CHANNELS = ["kakao", "sms", "both"] as const;
const HANDOFF_NOTE_TYPES = [
  "handoff",
  "caution",
  "approach",
  "avoid",
  "relationship",
  "next_action",
] as const;
const SCRIPT_CATEGORIES = [
  "first_call",
  "missed_call",
  "premium_burden",
  "coverage_concern",
  "family_responsibility",
  "surrender_risk",
  "proposal_follow_up",
  "post_contract_care",
  "long_unmanaged",
  "general_check",
] as const;
const ALLOWED_TEMPLATE_PLACEHOLDERS = new Set([
  "고객명",
  "담당자명",
  "다음연락일",
  "상담주제",
]);
const BANNED_TEMPLATE_PHRASES = [
  "무조건 보장",
  "반드시 가입",
  "지금 안 하면",
  "이 보험이 최고",
  "가장 저렴",
  "확정적으로 유리",
  "병에 걸리면 큰일",
  "안 하면 위험",
  "지금 가입",
  "누구나 받을",
  "무조건 유리",
];

function validateMessageTemplateBody(body: string) {
  if (body.length > 2000)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "템플릿 본문은 2000자 이하로 입력해주세요.",
    });
  const placeholders = Array.from(body.matchAll(/\{([^}]+)\}/g)).map(
    match => match[1]
  );
  const invalid = placeholders.filter(
    placeholder => !ALLOWED_TEMPLATE_PLACEHOLDERS.has(placeholder)
  );
  if (invalid.length > 0)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "허용되지 않은 placeholder가 포함되어 있습니다.",
    });
  if (BANNED_TEMPLATE_PHRASES.some(phrase => body.includes(phrase))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "가입 강요, 공포마케팅, 확정 표현은 사용할 수 없습니다.",
    });
  }
}

function validateScriptBody(body: string) {
  if (body.length > 3000)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "스크립트 본문은 3000자 이하로 입력해주세요.",
    });
  for (const phrase of BANNED_TEMPLATE_PHRASES) {
    if (body.includes(phrase))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "가입 강요, 공포마케팅, 확정 표현은 사용할 수 없습니다.",
      });
  }
}

function validateHandoffNoteBody(body: string) {
  if (body.length > 2000)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "인수인계 메모는 2000자 이하로 입력해주세요.",
    });
}

function renderMessageBody(
  body: string,
  values: Record<string, string | null | undefined>
) {
  return body
    .replace(/\{고객명\}/g, values.customerName ?? "")
    .replace(/\{담당자명\}/g, values.agentName ?? "")
    .replace(/\{다음연락일\}/g, values.nextContactDate ?? "")
    .replace(/\{상담주제\}/g, values.consultationTopic ?? "");
}

const ALL_FORCE_LOGOUT_CONFIRM_TEXT = "\uC804\uCCB4\uB85C\uADF8\uC544\uC6C3";
const OAUTH_RESET_CONFIRM_TEXT = "OAuth\uCD08\uAE30\uD654";
const LOGIN_HISTORY_ACTIONS = new Set([
  "USER_LOGIN",
  "LOGIN_BLOCKED",
  "USER_OAUTH_LINKED",
  "USER_OAUTH_LINK_CONFLICT",
  "USER_OAUTH_RESET",
  "USER_FORCE_LOGOUT",
  "ALL_USERS_FORCE_LOGOUT",
]);

const HIGH_RISK_ACTIONS = new Set([
  "DATA_DOWNLOAD",
  "TEAM_PERMANENTLY_DELETED",
  "CUSTOMER_PERMANENTLY_DELETED",
  "CONTRACT_PERMANENTLY_DELETED",
  "ALL_USERS_FORCE_LOGOUT",
  "USER_OAUTH_RESET",
]);
const MEDIUM_RISK_ACTIONS = new Set([
  "DELETE_REQUEST_APPROVED",
  "CONTRACT_DEACTIVATED_BY_REQUEST",
  "CUSTOMER_DEACTIVATED",
  "CONTRACT_DEACTIVATED",
  "TEAM_DEACTIVATED",
  "CUSTOMER_ASSIGNEE_BULK_CHANGED",
  "CUSTOMER_ASSIGNEE_CHANGED_BY_BULK",
  "CUSTOMER_MERGE_BLOCKED",
  "IMPORT_BATCH_CANCELLED",
  "IMPORT_BATCH_CANCEL_BLOCKED",
  "USER_FORCE_LOGOUT",
  "USER_ROLE_CHANGED",
]);
const LOW_RISK_ACTIONS = new Set([
  "DELETE_REQUEST_CREATED",
  "DELETE_REQUEST_REJECTED",
  "DELETE_REQUEST_CANCELLED",
  "TEAM_RESTORED",
  "CUSTOMER_RESTORED",
  "CONTRACT_RESTORED",
  "PERMANENT_DELETE_BLOCKED",
  "LOGIN_BLOCKED",
]);
const DOWNLOAD_ACTIONS = new Set(["DATA_DOWNLOAD", "DATA_DOWNLOAD_FAILED"]);
const DELETE_AUDIT_ACTIONS = new Set([
  "DELETE_REQUEST_CREATED",
  "DELETE_REQUEST_APPROVED",
  "DELETE_REQUEST_REJECTED",
  "DELETE_REQUEST_CANCELLED",
  "CONTRACT_DEACTIVATED_BY_REQUEST",
  "CUSTOMER_DEACTIVATED",
  "CONTRACT_DEACTIVATED",
  "TEAM_DEACTIVATED",
  "CUSTOMER_DEACTIVATED_BY_BATCH_CANCELLED",
  "TEAM_RESTORED",
  "CUSTOMER_RESTORED",
  "CONTRACT_RESTORED",
  "TEAM_PERMANENTLY_DELETED",
  "CUSTOMER_PERMANENTLY_DELETED",
  "CONTRACT_PERMANENTLY_DELETED",
  "PERMANENT_DELETE_BLOCKED",
  "IMPORT_BATCH_CANCELLED",
  "IMPORT_BATCH_CANCEL_BLOCKED",
]);
const SECURITY_AUDIT_ACTIONS = new Set([
  "USER_LOGIN",
  "LOGIN_BLOCKED",
  "USER_OAUTH_LINKED",
  "USER_OAUTH_LINK_CONFLICT",
  "USER_OAUTH_RESET",
  "USER_FORCE_LOGOUT",
  "ALL_USERS_FORCE_LOGOUT",
  "USER_ROLE_CHANGED",
  "USER_STATUS_CHANGED",
]);
const RISK_ACTIONS = new Set([
  "DATA_DOWNLOAD",
  "TEAM_PERMANENTLY_DELETED",
  "CUSTOMER_PERMANENTLY_DELETED",
  "CONTRACT_PERMANENTLY_DELETED",
  "ALL_USERS_FORCE_LOGOUT",
  "USER_OAUTH_RESET",
  "DELETE_REQUEST_APPROVED",
  "CONTRACT_DEACTIVATED_BY_REQUEST",
  "IMPORT_BATCH_CANCELLED",
  "IMPORT_BATCH_CANCEL_BLOCKED",
  "USER_FORCE_LOGOUT",
  "USER_ROLE_CHANGED",
  "DELETE_REQUEST_CREATED",
  "DELETE_REQUEST_REJECTED",
  "DELETE_REQUEST_CANCELLED",
  "CUSTOMER_DEACTIVATED",
  "CONTRACT_DEACTIVATED",
  "TEAM_DEACTIVATED",
  "CUSTOMER_DEACTIVATED_BY_BATCH_CANCELLED",
  "TEAM_RESTORED",
  "CUSTOMER_RESTORED",
  "CONTRACT_RESTORED",
  "PERMANENT_DELETE_BLOCKED",
  "LOGIN_BLOCKED",
  "CUSTOMER_ASSIGNEE_BULK_CHANGED",
  "CUSTOMER_ASSIGNEE_CHANGED_BY_BULK",
  "AGENT_CHANGED",
  "CUSTOMER_ASSIGNEE_AUTO_SET_BY_DB_ASSIGNMENT",
  "CUSTOMER_MERGE_BLOCKED",
  "CUSTOMER_MERGE_PREVIEWED",
]);

function getRiskLevel(action: string): "high" | "medium" | "low" | "normal" {
  if (HIGH_RISK_ACTIONS.has(action)) return "high";
  if (MEDIUM_RISK_ACTIONS.has(action)) return "medium";
  if (LOW_RISK_ACTIONS.has(action)) return "low";
  return "normal";
}

function safeAuditText(value: unknown, maxLength = 160) {
  if (value === null || value === undefined) return "";
  return sanitizeLogText(String(value), maxLength);
}

function summarizeLogDetails(details?: string | null) {
  if (!details)
    return { reason: null as string | null, summary: null as string | null };
  try {
    const parsed = JSON.parse(details) as Record<string, any>;
    const metadata = parsed.metadata ?? {};
    const reason = metadata.reason ?? parsed.reason ?? null;
    const parts = [
      metadata.type ? `type=${metadata.type}` : null,
      metadata.rowCount !== undefined ? `rows=${metadata.rowCount}` : null,
      metadata.affectedSessionCount !== undefined
        ? `sessions=${metadata.affectedSessionCount}`
        : null,
      metadata.affectedCustomerCount !== undefined
        ? `customers=${metadata.affectedCustomerCount}`
        : null,
      metadata.deleteMode ? `mode=${metadata.deleteMode}` : null,
    ].filter(Boolean);
    return {
      reason: reason ? safeAuditText(reason, 120) : null,
      summary: parts.length > 0 ? parts.join(", ") : null,
    };
  } catch {
    return { reason: null, summary: safeAuditText(details, 120) || null };
  }
}

type OperationRiskLevel = "normal" | "caution" | "warning" | "danger";

type OperationRiskCategory =
  | "download"
  | "deletion"
  | "account"
  | "handoff"
  | "push"
  | "unresolved";

const operationRiskPeriodInput = z
  .object({
    period: z.enum(["today", "7d", "30d", "month", "custom"]).default("7d"),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })
  .optional();

function resolveOperationRiskRange(
  input?: z.infer<typeof operationRiskPeriodInput>
) {
  const now = new Date();
  if (input?.period === "today") {
    return { dateFrom: toDayStart(now), dateTo: toDayEnd(now), label: "오늘" };
  }
  if (input?.period === "30d") {
    return {
      dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      dateTo: now,
      label: "최근 30일",
    };
  }
  if (input?.period === "month") {
    return {
      dateFrom: new Date(now.getFullYear(), now.getMonth(), 1),
      dateTo: toDayEnd(now),
      label: "이번 달",
    };
  }
  if (input?.period === "custom" && input.dateFrom && input.dateTo) {
    return {
      dateFrom: toDayStart(new Date(input.dateFrom)),
      dateTo: toDayEnd(new Date(input.dateTo)),
      label: "직접 선택",
    };
  }
  return {
    dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    dateTo: now,
    label: "최근 7일",
  };
}

function operationRiskLevel(score: number): OperationRiskLevel {
  if (score >= 70) return "danger";
  if (score >= 45) return "warning";
  if (score >= 15) return "caution";
  return "normal";
}

function operationRiskMessage(level: OperationRiskLevel) {
  if (level === "danger") return "즉시 확인이 필요한 운영 리스크가 있습니다.";
  if (level === "warning") return "반복되거나 민감한 운영 이벤트를 확인하세요.";
  if (level === "caution") return "확인 필요한 운영 이벤트가 있습니다.";
  return "최근 고위험 운영 이벤트가 안정적입니다.";
}

function compactRiskItem(params: {
  category: OperationRiskCategory;
  title: string;
  count: number;
  score: number;
  description: string;
  actionLabel: string;
  href: string;
}) {
  const level = operationRiskLevel(params.score);
  return { ...params, score: Math.min(100, Math.max(0, params.score)), level };
}

function countBy<T>(
  items: T[],
  getKey: (item: T) => string | number | null | undefined
) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    if (key === null || key === undefined || key === "") return acc;
    acc[String(key)] = (acc[String(key)] ?? 0) + 1;
    return acc;
  }, {});
}

function getSafeMetadataReason(details?: string | null) {
  return summarizeLogDetails(details).reason;
}

async function buildOperationRiskReport(
  input?: z.infer<typeof operationRiskPeriodInput>
) {
  const range = resolveOperationRiskRange(input);
  const [
    users,
    customers,
    contracts,
    followUps,
    schedules,
    notificationsResult,
    deleteRequests,
    handoffHistories,
    activityLogs,
    pushSummary,
    pushLogs,
  ] = await Promise.all([
    getAllUsers(),
    getCustomers({}),
    getAllContracts({}),
    getFollowUps({
      statuses: ["scheduled", "postponed", "completed", "cancelled"],
    }),
    getSchedules({}),
    getNotificationsFiltered({ limit: 1000 }),
    getDeleteRequests({}),
    getHandoffHistories({ limit: 100 }),
    getActivityLogs(2000),
    getPushNotificationOperationSummary(range.dateFrom, range.dateTo),
    listPushNotificationLogs({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      limit: 100,
    }),
  ]);

  const logsInRange = activityLogs.filter(entry =>
    isWithinDateRange(new Date(entry.createdAt), range.dateFrom, range.dateTo)
  );
  const userById = new Map(users.map(user => [user.id, user]));
  const inactiveUserIds = new Set(
    users
      .filter(
        user =>
          user.accountStatus === "inactive" || user.accountStatus === "resigned"
      )
      .map(user => user.id)
  );
  const now = new Date();
  const staleDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const downloadLogs = logsInRange.filter(entry =>
    DOWNLOAD_ACTIONS.has(entry.action)
  );
  const downloadsByUser = countBy(downloadLogs, entry => entry.userId);
  const repeatedDownloadUsers = Object.values(downloadsByUser).filter(
    count => count >= 3
  ).length;
  const shortDownloadReasons = downloadLogs.filter(entry => {
    const reason = getSafeMetadataReason(entry.details);
    return !reason || reason.trim().length < 5;
  }).length;

  const deletionLogs = logsInRange.filter(entry =>
    DELETE_AUDIT_ACTIONS.has(entry.action)
  );
  const permanentDeleteLogs = deletionLogs.filter(entry =>
    entry.action.includes("PERMANENTLY_DELETED")
  );
  const pendingDeleteRequests = deleteRequests.filter(
    request => request.status === "pending"
  );

  const accountLogs = logsInRange.filter(
    entry =>
      SECURITY_AUDIT_ACTIONS.has(entry.action) ||
      entry.action === "USER_ROLE_CHANGED" ||
      entry.action === "USER_STATUS_CHANGED"
  );
  const criticalAccountLogs = accountLogs.filter(entry =>
    [
      "USER_OAUTH_RESET",
      "USER_FORCE_LOGOUT",
      "ALL_USERS_FORCE_LOGOUT",
      "LOGIN_BLOCKED",
    ].includes(entry.action)
  );

  const inactiveCustomers = customers.filter((customer: any) =>
    inactiveUserIds.has(Number(customer.agentId))
  );
  const inactiveContracts = contracts.filter((contract: any) =>
    inactiveUserIds.has(Number(contract.agentId))
  );
  const inactiveFollowUps = followUps.filter(
    (followUp: any) =>
      inactiveUserIds.has(Number(followUp.assignedAgentId)) &&
      ["scheduled", "postponed"].includes(String(followUp.status))
  );
  const inactiveSchedules = schedules.filter(
    (schedule: any) =>
      inactiveUserIds.has(Number(schedule.userId)) &&
      !["완료", "취소", "completed", "cancelled"].includes(
        String(schedule.status)
      )
  );
  const inactiveNotifications = notificationsResult.items.filter(
    (notification: any) =>
      inactiveUserIds.has(Number(notification.userId)) &&
      (!notification.isRead || notification.processStatus === "미확인")
  );
  const unresolvedHandoffCount =
    inactiveCustomers.length +
    inactiveContracts.length +
    inactiveFollowUps.length +
    inactiveSchedules.length +
    inactiveNotifications.length;

  const failedPushLogs = pushLogs.filter(
    entry =>
      entry.status === "failed" || entry.status === "invalid_token_deactivated"
  );
  const skippedPushLogs = pushLogs.filter(
    entry =>
      String(entry.status).startsWith("skipped") ||
      entry.status === "duplicate_skipped"
  );

  const overdueFollowUps = followUps.filter(
    (followUp: any) =>
      ["scheduled", "postponed"].includes(String(followUp.status)) &&
      followUp.nextContactDate &&
      new Date(followUp.nextContactDate).getTime() < now.getTime()
  );
  const staleSchedules = schedules.filter(
    (schedule: any) =>
      !["완료", "취소", "completed", "cancelled"].includes(
        String(schedule.status)
      ) &&
      schedule.startTime &&
      new Date(schedule.startTime).getTime() < staleDate.getTime()
  );
  const unreadNotifications = notificationsResult.items.filter(
    (notification: any) =>
      !notification.isRead || notification.processStatus === "미확인"
  );
  const unresolvedWorkCount =
    overdueFollowUps.length +
    staleSchedules.length +
    unreadNotifications.length +
    pendingDeleteRequests.length;

  const riskCards = [
    compactRiskItem({
      category: "download",
      title: "데이터 다운로드 리스크",
      count: downloadLogs.length,
      score:
        downloadLogs.length * 4 +
        repeatedDownloadUsers * 14 +
        shortDownloadReasons * 8,
      description:
        repeatedDownloadUsers > 0
          ? "짧은 기간 반복 다운로드 사용자를 확인하세요."
          : "다운로드 사유와 대상 데이터를 점검하세요.",
      actionLabel: "다운로드 로그 확인",
      href: "/logs",
    }),
    compactRiskItem({
      category: "deletion",
      title: "삭제·복구 리스크",
      count: deletionLogs.length + pendingDeleteRequests.length,
      score:
        deletionLogs.length * 5 +
        permanentDeleteLogs.length * 25 +
        pendingDeleteRequests.length * 6,
      description:
        permanentDeleteLogs.length > 0
          ? "완전삭제 이력이 있어 즉시 확인이 필요합니다."
          : "삭제 요청과 복구 흐름을 확인하세요.",
      actionLabel: "삭제 데이터 확인",
      href: "/deleted-data",
    }),
    compactRiskItem({
      category: "account",
      title: "권한·계정 리스크",
      count: accountLogs.length,
      score: accountLogs.length * 5 + criticalAccountLogs.length * 12,
      description:
        criticalAccountLogs.length > 0
          ? "강제 로그아웃 또는 OAuth 초기화 이력을 확인하세요."
          : "계정 상태와 권한 변경 이력을 점검하세요.",
      actionLabel: "사용자 관리",
      href: "/users",
    }),
    compactRiskItem({
      category: "handoff",
      title: "인수인계 리스크",
      count: unresolvedHandoffCount,
      score: Math.min(
        100,
        unresolvedHandoffCount * 6 + handoffHistories.length
      ),
      description:
        unresolvedHandoffCount > 0
          ? "퇴사자/비활성 계정에 남은 업무가 있습니다."
          : "퇴사자 미처리 업무가 안정적입니다.",
      actionLabel: "인수인계 관리",
      href: "/users/handoff",
    }),
    compactRiskItem({
      category: "push",
      title: "푸시 알림 리스크",
      count:
        pushSummary.failed + pushSummary.skipped + pushSummary.inactiveTokens,
      score:
        pushSummary.failed * 10 +
        pushSummary.skipped * 3 +
        pushSummary.inactiveTokens * 4,
      description:
        pushSummary.failed > 0
          ? "푸시 실패와 비활성 토큰을 확인하세요."
          : "푸시 실패 로그가 낮은 수준입니다.",
      actionLabel: "푸시 운영 확인",
      href: "/push-notifications",
    }),
    compactRiskItem({
      category: "unresolved",
      title: "미처리 업무 리스크",
      count: unresolvedWorkCount,
      score: Math.min(
        100,
        overdueFollowUps.length * 3 +
          staleSchedules.length * 6 +
          unreadNotifications.length +
          pendingDeleteRequests.length * 5
      ),
      description:
        overdueFollowUps.length > 0
          ? "미처리 후속관리와 오래된 일정을 우선 확인하세요."
          : "미처리 운영 업무가 안정적입니다.",
      actionLabel: "업무 확인",
      href: "/notifications",
    }),
  ];

  const overallScore = Math.min(
    100,
    Math.round(riskCards.reduce((sum, card) => sum + card.score, 0) / 2)
  );
  const overallLevel = operationRiskLevel(overallScore);

  const recentRiskEvents = logsInRange
    .filter(
      entry =>
        RISK_ACTIONS.has(entry.action) ||
        SECURITY_AUDIT_ACTIONS.has(entry.action)
    )
    .slice(0, 20)
    .map(entry => {
      const actor = userById.get(entry.userId);
      const details = summarizeLogDetails(entry.details);
      return {
        id: entry.id,
        createdAt: entry.createdAt,
        actor: actor
          ? {
              id: actor.id,
              name: actor.name,
              role: actor.role,
              email: actor.email ? maskEmail(actor.email) : null,
            }
          : null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        riskLevel: getRiskLevel(entry.action),
        reason: details.reason,
        summary: details.summary,
      };
    });

  return {
    period: {
      preset: input?.period ?? "7d",
      label: range.label,
      dateFrom: range.dateFrom.toISOString(),
      dateTo: range.dateTo.toISOString(),
    },
    overall: {
      score: overallScore,
      level: overallLevel,
      message: operationRiskMessage(overallLevel),
    },
    riskCards,
    downloadRisk: {
      total: downloadLogs.length,
      repeatedUserCount: repeatedDownloadUsers,
      shortReasonCount: shortDownloadReasons,
      byUser: downloadsByUser,
    },
    deletionRisk: {
      total: deletionLogs.length,
      permanentDeleteCount: permanentDeleteLogs.length,
      pendingDeleteRequestCount: pendingDeleteRequests.length,
    },
    accountRisk: {
      total: accountLogs.length,
      criticalCount: criticalAccountLogs.length,
      inactiveUsers: users.filter(user => user.accountStatus === "inactive")
        .length,
      resignedUsers: users.filter(user => user.accountStatus === "resigned")
        .length,
    },
    handoffRisk: {
      unresolvedCount: unresolvedHandoffCount,
      inactiveCustomerCount: inactiveCustomers.length,
      inactiveContractCount: inactiveContracts.length,
      inactiveFollowUpCount: inactiveFollowUps.length,
      inactiveScheduleCount: inactiveSchedules.length,
      inactiveNotificationCount: inactiveNotifications.length,
      recentHandoffCount: handoffHistories.length,
    },
    pushRisk: {
      total: pushSummary.total,
      sent: pushSummary.sent,
      failed: pushSummary.failed,
      skipped: pushSummary.skipped,
      inactiveTokens: pushSummary.inactiveTokens,
      recentFailures: failedPushLogs.slice(0, 10).map(entry => ({
        id: entry.id,
        type: entry.type,
        userId: entry.userId,
        userName: entry.userName,
        userRole: entry.userRole,
        sourceType: entry.sourceType,
        status: entry.status,
        errorCode: entry.errorCode
          ? safeAuditText(
              String(entry.errorCode).replace(/\s+\S{8,}/g, " [redacted]"),
              80
            )
          : null,
        createdAt: entry.createdAt,
      })),
      skippedCount: skippedPushLogs.length,
    },
    unresolvedWorkRisk: {
      total: unresolvedWorkCount,
      overdueFollowUpCount: overdueFollowUps.length,
      staleScheduleCount: staleSchedules.length,
      unreadNotificationCount: unreadNotifications.length,
      pendingDeleteRequestCount: pendingDeleteRequests.length,
    },
    recentRiskEvents,
    guides: [
      {
        title: "반복 다운로드 확인",
        description: "다운로드 사유와 대상 데이터를 활동 로그에서 확인하세요.",
        href: "/logs",
      },
      {
        title: "퇴사자 미처리 업무 확인",
        description:
          "비활성/퇴사 계정에 남은 고객, 후속관리, 일정은 인수인계 관리에서 정리하세요.",
        href: "/users/handoff",
      },
      {
        title: "푸시 실패 점검",
        description:
          "invalid token과 skipped 로그를 확인해 현장 알림 누락을 줄이세요.",
        href: "/push-notifications",
      },
      {
        title: "삭제 요청 검토",
        description:
          "보류 중인 삭제 요청과 완전삭제 이력은 삭제 데이터 관리에서 확인하세요.",
        href: "/deleted-data",
      },
    ],
  };
}

async function buildScopedOperationRiskSummary(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    accountStatus: string;
  },
  input?: z.infer<typeof operationRiskPeriodInput>
) {
  if (user.role !== "sub_branch_admin" && user.role !== "team_leader") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Scoped operation risk is available to managers only.",
    });
  }

  const range = resolveOperationRiskRange(input);
  const scoped = await getScopedDashboardData(user);
  const now = new Date();
  const staleCustomerDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const staleScheduleDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activeCustomers = scoped.customerList.filter(
    (customer: any) => customer.isActive !== false && !customer.deletedAt
  );
  const overdueFollowUps = scoped.followUpList.filter(
    (followUp: any) =>
      isOpenFollowUpStatus(String(followUp.status)) &&
      followUp.nextContactDate &&
      new Date(followUp.nextContactDate).getTime() < now.getTime()
  );
  const staleSchedules = scoped.scheduleList.filter(
    (schedule: any) =>
      !isFinishedScheduleStatus(String(schedule.status)) &&
      schedule.startTime &&
      new Date(schedule.startTime).getTime() < staleScheduleDate.getTime()
  );
  const unreadNotifications = scoped.notifications.filter((notification: any) =>
    isUnreadNotification(notification)
  );
  const longUnmanagedCustomers = activeCustomers.filter((customer: any) => {
    const candidate =
      customer.lastContactDate ?? customer.updatedAt ?? customer.createdAt;
    return (
      candidate && new Date(candidate).getTime() < staleCustomerDate.getTime()
    );
  });
  const assignmentNeeds = activeCustomers.filter(
    (customer: any) =>
      customer.assignmentStatus === "unassigned" ||
      (!customer.agentId && !customer.subBranchAdminId)
  );

  const cards = [
    compactRiskItem({
      category: "unresolved",
      title: "미처리 후속관리",
      count: overdueFollowUps.length,
      score: Math.min(100, overdueFollowUps.length * 8),
      description:
        "권한 범위 안의 예정/연기 후속관리 중 기한이 지난 항목입니다.",
      actionLabel: "알림에서 확인",
      href: "/notifications",
    }),
    compactRiskItem({
      category: "unresolved",
      title: "오래된 미완료 일정",
      count: staleSchedules.length,
      score: Math.min(100, staleSchedules.length * 10),
      description: "완료 또는 취소되지 않은 오래된 일정입니다.",
      actionLabel: "캘린더 확인",
      href: "/calendar",
    }),
    compactRiskItem({
      category: "unresolved",
      title: "장기 미관리 고객",
      count: longUnmanagedCustomers.length,
      score: Math.min(100, longUnmanagedCustomers.length * 5),
      description: "최근 관리 이력이 오래된 산하 고객입니다.",
      actionLabel: "고객 DB 확인",
      href: "/customers",
    }),
    compactRiskItem({
      category: "unresolved",
      title: "미확인 알림",
      count: unreadNotifications.length,
      score: Math.min(100, unreadNotifications.length * 3),
      description: "읽지 않았거나 처리 완료되지 않은 산하 업무 알림입니다.",
      actionLabel: "알림센터 확인",
      href: "/notifications",
    }),
    compactRiskItem({
      category: "handoff",
      title: "배정/인수인계 확인 필요",
      count: assignmentNeeds.length,
      score: Math.min(100, assignmentNeeds.length * 8),
      description: "권한 범위 안에서 담당자 배정 확인이 필요한 고객입니다.",
      actionLabel: "DB 배정 확인",
      href: "/customers/assign",
    }),
  ];
  const overallScore = Math.min(
    100,
    Math.round(cards.reduce((sum, card) => sum + card.score, 0) / 2)
  );
  const overallLevel = operationRiskLevel(overallScore);

  return {
    scope: {
      role: user.role,
      label:
        user.role === "sub_branch_admin" ? "산하 조직 리스크" : "팀 리스크",
    },
    period: {
      preset: input?.period ?? "7d",
      label: range.label,
      dateFrom: range.dateFrom.toISOString(),
      dateTo: range.dateTo.toISOString(),
    },
    overall: {
      score: overallScore,
      level: overallLevel,
      message: operationRiskMessage(overallLevel),
    },
    cards,
  };
}

function isWithinDateRange(date: Date, from?: Date, to?: Date) {
  const time = date.getTime();
  if (from && time < from.getTime()) return false;
  if (to && time > to.getTime()) return false;
  return true;
}

function encodeCustomerTags(tags?: string[]) {
  if (!tags) return undefined;
  const unique = Array.from(
    new Set(tags.map(tag => tag.trim()).filter(Boolean))
  );
  return JSON.stringify(unique);
}

function decodeCustomerTags(value?: string | null): string[] {
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

async function verifyAgentTarget(
  actor: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
  },
  targetUserId: number
) {
  const target = await assertCanAssignCustomerToUser(
    { ...actor, accountStatus: "active" },
    targetUserId
  );
  if (target.teamId) {
    const team = await getTeamById(target.teamId);
    if (team && (team as any).subBranchAdminId !== target.subBranchAdminId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "대상 사용자의 팀과 부지점장 소속이 일치하지 않습니다.",
      });
    }
  }
  return target;
}

type CustomerCreateAssignee = {
  agentId: number;
  assignedTeamId: number | null;
  subBranchAdminId: number | null;
  assignmentStatus: "assigned_to_agent";
};

function toCustomerCreateAssignee(target: {
  id: number;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
}): CustomerCreateAssignee {
  const assignedTeamId =
    target.role === "team_leader" || target.role === "member"
      ? (target.teamId ?? null)
      : null;
  const subBranchAdminId =
    target.role === "sub_branch_admin"
      ? target.id
      : target.role === "team_leader" || target.role === "member"
        ? (target.subBranchAdminId ?? null)
        : null;
  return {
    agentId: target.id,
    assignedTeamId,
    subBranchAdminId,
    assignmentStatus: "assigned_to_agent",
  };
}

async function resolveCustomerCreateAssignee(
  actor: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
    accountStatus: string;
  },
  requestedAgentId?: number
): Promise<CustomerCreateAssignee> {
  if (actor.role !== "branch_admin") {
    if (requestedAgentId !== undefined && requestedAgentId !== actor.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "고객 직접 등록 시 담당자는 본인만 지정할 수 있습니다.",
      });
    }
    return toCustomerCreateAssignee(actor);
  }

  const targetUserId = requestedAgentId ?? actor.id;
  if (targetUserId === actor.id) return toCustomerCreateAssignee(actor);

  const target = await getUserById(targetUserId);
  if (!target)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "담당자를 찾을 수 없습니다.",
    });
  if (target.accountStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "비활성 계정에는 고객을 배정할 수 없습니다.",
    });
  }
  if (
    target.role !== "branch_admin" &&
    target.role !== "sub_branch_admin" &&
    target.role !== "team_leader" &&
    target.role !== "member"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "고객 담당자로 지정할 수 없는 역할입니다.",
    });
  }
  return toCustomerCreateAssignee(target);
}

async function verifySubBranchAdminTarget(userId: number) {
  const target = await getUserById(userId);
  if (!target)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "대상 부지점장을 찾을 수 없습니다.",
    });
  if (target.accountStatus !== "active" || target.role !== "sub_branch_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "활성 부지점장에게만 배분할 수 있습니다.",
    });
  }
  return target;
}

function assertCustomerReclaimable(
  customer: Awaited<ReturnType<typeof getCustomerById>>
) {
  if (!customer)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  if ((customer as any).isActive === false || (customer as any).deletedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "삭제 또는 비활성 처리된 고객 DB는 회수할 수 없습니다.",
    });
  }
  if (!customer.agentId && customer.assignmentStatus === "unassigned") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 미배정 상태인 고객 DB입니다.",
    });
  }
  return customer;
}

async function reclaimCustomerDb(input: {
  customerId: number;
  reason: string;
  reclaimedBy: number;
  reclaimedAt: string;
  tx: Parameters<typeof reclaimCustomerAssignment>[1];
}) {
  const customer = assertCustomerReclaimable(
    await getCustomerById(input.customerId)
  );
  await reclaimCustomerAssignment(input.customerId, input.tx);
  const transferredWork = await transferReclaimedCustomerWork(
    input.customerId,
    customer.agentId ?? null,
    input.reclaimedBy,
    input.tx
  );
  await createAssignmentHistory(
    {
      customerId: input.customerId,
      previousSubBranchAdminId: customer.subBranchAdminId ?? undefined,
      newSubBranchAdminId: undefined,
      previousTeamId: customer.assignedTeamId ?? undefined,
      newTeamId: undefined,
      previousAgentId: customer.agentId ?? undefined,
      newAgentId: undefined,
      assignedBy: input.reclaimedBy,
      assignmentType: "reassignment",
      assignmentReason: input.reason,
    },
    input.tx
  );
  await log(
    input.reclaimedBy,
    "CUSTOMER_DB_RECLAIMED",
    "customer",
    input.customerId,
    logDetails({
      actor: input.reclaimedBy,
      targetId: input.customerId,
      targetType: "customer",
      metadata: {
        customerId: input.customerId,
        previousAgentId: customer.agentId ?? null,
        reclaimedBy: input.reclaimedBy,
        reason: input.reason,
        reclaimedAt: input.reclaimedAt,
      },
    }),
    input.tx
  );
  return {
    customerId: input.customerId,
    previousAgentId: customer.agentId ?? null,
    transferredWork,
  };
}

function shouldAutoSetAssigneeOnDbAssignment(targetUser: { role: string }) {
  return targetUser.role === "member";
}

function assignmentTypeForActor(actorRole: string) {
  return actorRole === "branch_admin"
    ? "branch_to_agent"
    : actorRole === "sub_branch_admin"
      ? "sub_branch_to_agent"
      : "reassignment";
}

function nextAssignmentScopeForUser(target: {
  id?: number;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
}) {
  return {
    teamId:
      target.role === "team_leader" || target.role === "member"
        ? (target.teamId ?? null)
        : null,
    subBranchAdminId:
      target.role === "sub_branch_admin"
        ? (target.id ?? null)
        : target.role === "team_leader" || target.role === "member"
          ? (target.subBranchAdminId ?? null)
          : null,
  };
}

async function assignCustomerDbWithOwnerPolicy(input: {
  customer: NonNullable<Awaited<ReturnType<typeof getCustomerById>>>;
  targetUser: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
  actor: { id: number; role: string };
  tx: Parameters<typeof assignCustomer>[4];
}) {
  const { customer, targetUser, actor, tx } = input;
  const previousAgentId = customer.agentId ?? null;
  const nextScope = nextAssignmentScopeForUser(targetUser);
  const autoSetAssignee = shouldAutoSetAssigneeOnDbAssignment(targetUser);
  const isBranchAdminSelfAssignment =
    actor.role === "branch_admin" &&
    targetUser.id === actor.id &&
    targetUser.role === "branch_admin";
  const nextAgentId =
    autoSetAssignee || isBranchAdminSelfAssignment
      ? targetUser.id
      : previousAgentId;

  if (autoSetAssignee || isBranchAdminSelfAssignment) {
    await assignCustomer(
      customer.id,
      targetUser.id,
      isBranchAdminSelfAssignment ? undefined : (nextScope.teamId ?? undefined),
      isBranchAdminSelfAssignment
        ? undefined
        : (nextScope.subBranchAdminId ?? undefined),
      tx
    );
  } else {
    await assignCustomerDbToTeam(
      customer.id,
      nextScope.teamId,
      nextScope.subBranchAdminId,
      tx
    );
  }

  await createAssignmentHistory(
    {
      customerId: customer.id,
      previousSubBranchAdminId: customer.subBranchAdminId ?? undefined,
      newSubBranchAdminId:
        autoSetAssignee || isBranchAdminSelfAssignment
          ? (nextScope.subBranchAdminId ?? undefined)
          : (nextScope.subBranchAdminId ?? undefined),
      previousTeamId: customer.assignedTeamId ?? undefined,
      newTeamId:
        autoSetAssignee || isBranchAdminSelfAssignment
          ? (nextScope.teamId ?? undefined)
          : (nextScope.teamId ?? undefined),
      previousAgentId: previousAgentId ?? undefined,
      newAgentId: nextAgentId ?? undefined,
      assignedBy: actor.id,
      assignmentType: assignmentTypeForActor(actor.role),
      assignmentReason: autoSetAssignee
        ? "auto_member_assignment_on_db_assignment"
        : undefined,
    },
    tx
  );

  return {
    previousAgentId,
    nextAgentId,
    nextTeamId: nextScope.teamId,
    nextSubBranchAdminId: nextScope.subBranchAdminId,
    autoSetAssignee,
    isBranchAdminSelfAssignment,
  };
}

const BULK_IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const BULK_IMPORT_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function verifyBulkImportFilePolicy(input: {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}) {
  const fileName = input.fileName?.toLowerCase();
  if (fileName && !fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CSV 또는 XLSX 파일만 업로드할 수 있습니다.",
    });
  }
  if (
    input.fileSize !== undefined &&
    input.fileSize > BULK_IMPORT_MAX_FILE_SIZE_BYTES
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "파일 크기는 5MB 이하만 업로드할 수 있습니다.",
    });
  }
  if (input.mimeType && !BULK_IMPORT_MIME_TYPES.has(input.mimeType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "허용되지 않는 파일 형식입니다. CSV 또는 XLSX 파일만 업로드할 수 있습니다.",
    });
  }
}

async function verifyNotificationAccess(
  user: { id: number; role: string; teamId: number | null },
  notificationId: number
) {
  const notification = await getNotificationById(notificationId);
  if (!notification)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "알림을 찾을 수 없습니다.",
    });
  if (user.role === "branch_admin") return notification;
  if (notification.userId === user.id) return notification;
  if (user.role === "sub_branch_admin") {
    const subordinates = await getUsersBySubBranchAdminId(user.id);
    if (subordinates.some(u => u.id === notification.userId))
      return notification;
  }
  if (user.role === "team_leader" && user.teamId) {
    const teamMembers = await getUsersByTeamId(user.teamId);
    if (teamMembers.some(u => u.id === notification.userId))
      return notification;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "해당 알림을 수정할 권한이 없습니다.",
  });
}

async function verifyTargetUserAccess(
  actor: { id: number; role: string; teamId: number | null },
  targetUserId: number
) {
  const [target, usersList, teamsList] = await Promise.all([
    getUserById(targetUserId),
    getAllUsers(),
    getAllTeams(),
  ]);
  if (!target)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "대상 사용자를 찾을 수 없습니다.",
    });
  if (target.accountStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "비활성 사용자에게는 처리할 수 없습니다.",
    });
  }
  if (actor.role === "branch_admin") return target;
  const scopedUsers = ensureOrgUsers(
    usersList as OrgUser[],
    actor,
    target as OrgUser
  );
  if (actor.role === "sub_branch_admin" || actor.role === "team_leader") {
    const ids = descendantUserIdsFrom(
      actor.id,
      scopedUsers,
      teamsList as OrgTeam[],
      true
    );
    if (ids.includes(target.id)) return target;
  }
  if (actor.role === "member" && target.id === actor.id) return target;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "대상 사용자에 대한 권한이 없습니다.",
  });
}

// ─── App Router ───────────────────────────────────────────────────────────────
async function assertActiveScheduleTarget(userId: number) {
  const target = await getUserById(userId);
  if (!target)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Target user not found.",
    });
  if (target.accountStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot update schedules for inactive users.",
    });
  }
  return target;
}

type MinimalUser = {
  id: number;
  name: string | null;
  email: null;
  role: string;
  parentUserId: number | null;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
  createdAt: null;
};

function toMinimalUser(user: {
  id: number;
  name: string | null;
  role: string;
  parentUserId?: number | null;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
}): MinimalUser {
  return {
    id: user.id,
    name: user.name,
    email: null,
    role: user.role,
    parentUserId: user.parentUserId ?? null,
    teamId: user.teamId,
    subBranchAdminId: user.subBranchAdminId,
    accountStatus: user.accountStatus,
    createdAt: null,
  };
}

type OrgUser = {
  id: number;
  name: string | null;
  role: string;
  accountStatus: string;
  parentUserId?: number | null;
  teamId: number | null;
  subBranchAdminId: number | null;
};

type OrgTeam = {
  id: number;
  managerId?: number | null;
  subBranchAdminId?: number | null;
};

function effectiveParentUserId(
  user: OrgUser,
  usersList: OrgUser[],
  teamsList: OrgTeam[]
): number | null {
  if (user.parentUserId !== undefined && user.parentUserId !== null)
    return user.parentUserId;
  if (user.role === "branch_admin") return null;
  if (user.role === "sub_branch_admin") return null;
  if (user.role === "team_leader") return user.subBranchAdminId ?? null;
  if (user.role === "member") {
    if (user.teamId !== null) {
      const team = teamsList.find(item => item.id === user.teamId);
      if (team?.managerId) return team.managerId;
    }
    if (user.subBranchAdminId !== null) return user.subBranchAdminId;
  }
  return null;
}

function ensureOrgUsers(
  usersList: OrgUser[],
  actor: { id: number; role: string; accountStatus?: string },
  target?: OrgUser
) {
  const byId = new Map<number, OrgUser>();
  for (const user of usersList) byId.set(user.id, user);
  if (!byId.has(actor.id)) {
    byId.set(actor.id, {
      id: actor.id,
      name: null,
      role: actor.role,
      accountStatus: actor.accountStatus ?? "active",
      parentUserId: null,
      teamId: null,
      subBranchAdminId: null,
    });
  }
  if (target && !byId.has(target.id)) byId.set(target.id, target);
  return Array.from(byId.values());
}

function descendantUserIdsFrom(
  rootUserId: number,
  usersList: OrgUser[],
  teamsList: OrgTeam[],
  includeRoot = true
): number[] {
  const result = new Set<number>();
  if (includeRoot) result.add(rootUserId);
  const walk = (parentId: number) => {
    for (const user of usersList) {
      if (user.accountStatus !== "active") continue;
      if (effectiveParentUserId(user, usersList, teamsList) !== parentId)
        continue;
      if (result.has(user.id)) continue;
      result.add(user.id);
      walk(user.id);
    }
  };
  walk(rootUserId);
  return Array.from(result);
}

export async function getHierarchyScopeUserIds(actor: {
  id: number;
  role: string;
  accountStatus: string;
  teamId?: number | null;
  subBranchAdminId?: number | null;
}): Promise<number[] | undefined> {
  if (actor.role === "branch_admin") return undefined;
  const [usersList, teamsList] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
  ]);
  if (actor.role === "sub_branch_admin" || actor.role === "team_leader") {
    const ids = descendantUserIdsFrom(
      actor.id,
      ensureOrgUsers(usersList as OrgUser[], actor),
      teamsList as OrgTeam[],
      true
    );
    if (ids.length > 1) return ids;
    if (actor.role === "team_leader" && actor.teamId) {
      const teamMembers = await getUsersByTeamId(actor.teamId);
      return Array.from(
        new Set([
          actor.id,
          ...teamMembers
            .filter(
              (member: any) =>
                !member.accountStatus || member.accountStatus === "active"
            )
            .map(member => member.id),
        ])
      );
    }
    if (actor.role === "sub_branch_admin") {
      const subordinates = await getUsersBySubBranchAdminId(actor.id);
      return Array.from(
        new Set([
          actor.id,
          ...subordinates
            .filter(
              (member: any) =>
                !member.accountStatus || member.accountStatus === "active"
            )
            .map(member => member.id),
        ])
      );
    }
    return ids;
  }
  return [actor.id];
}

async function assertCanAssignCustomerToUser(
  actor: { id: number; role: string; accountStatus: string },
  targetUserId: number
) {
  const [target, usersList, teamsList] = await Promise.all([
    getUserById(targetUserId),
    getAllUsers(),
    getAllTeams(),
  ]);
  if (!target)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "대상 사용자를 찾을 수 없습니다.",
    });
  if (target.accountStatus !== "active")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "비활성 계정에는 배정할 수 없습니다.",
    });
  if (actor.role === "branch_admin") return target;
  const scopedUsers = ensureOrgUsers(
    usersList as OrgUser[],
    actor,
    target as OrgUser
  );
  if (actor.role === "sub_branch_admin") {
    const ids = descendantUserIdsFrom(
      actor.id,
      scopedUsers,
      teamsList as OrgTeam[],
      false
    );
    if (
      ids.includes(targetUserId) &&
      (target.role === "team_leader" || target.role === "member")
    )
      return target;
  }
  if (actor.role === "team_leader") {
    const ids = descendantUserIdsFrom(
      actor.id,
      scopedUsers,
      teamsList as OrgTeam[],
      false
    );
    if (ids.includes(targetUserId) && target.role === "member") return target;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "산하 조직원에게만 배정할 수 있습니다.",
  });
}

async function buildOrganizationTree(actor: {
  id: number;
  role: string;
  accountStatus: string;
}) {
  const [usersListRaw, teamsListRaw, customersList] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
    getCustomers({}),
  ]);
  const usersList = usersListRaw as OrgUser[];
  const teamsList = teamsListRaw as OrgTeam[];
  const visibleIds =
    actor.role === "branch_admin"
      ? new Set(usersList.map(user => user.id))
      : new Set(descendantUserIdsFrom(actor.id, usersList, teamsList, true));
  const visibleUsers = usersList.filter(user => visibleIds.has(user.id));
  const customerCounts = new Map<number, number>();
  for (const customer of customersList) {
    if (customer.agentId)
      customerCounts.set(
        customer.agentId,
        (customerCounts.get(customer.agentId) ?? 0) + 1
      );
  }
  const nodes = visibleUsers.map(user => ({
    id: user.id,
    name: user.name,
    role: user.role,
    accountStatus: user.accountStatus,
    teamId: user.teamId,
    subBranchAdminId: user.subBranchAdminId,
    parentUserId: effectiveParentUserId(user, usersList, teamsList),
    explicitParentUserId: user.parentUserId ?? null,
    directReportCount: usersList.filter(
      candidate =>
        candidate.accountStatus === "active" &&
        effectiveParentUserId(candidate, usersList, teamsList) === user.id
    ).length,
    descendantCount: Math.max(
      descendantUserIdsFrom(user.id, usersList, teamsList, false).length,
      0
    ),
    customerCount: customerCounts.get(user.id) ?? 0,
  }));
  const summary = {
    subBranchAdminCount: nodes.filter(node => node.role === "sub_branch_admin")
      .length,
    directTeamLeaderCount: nodes.filter(
      node => node.role === "team_leader" && node.parentUserId === null
    ).length,
    totalTeamLeaderCount: nodes.filter(node => node.role === "team_leader")
      .length,
    totalMemberCount: nodes.filter(node => node.role === "member").length,
    directMemberCount: nodes.filter(
      node => node.role === "member" && node.parentUserId === null
    ).length,
    unassignedCount: nodes.filter(
      node =>
        node.role !== "branch_admin" &&
        node.parentUserId === null &&
        node.accountStatus === "active"
    ).length,
  };
  return { nodes, summary };
}

function isAllowedParentForRole(
  targetRole: string,
  parentRole?: string | null
) {
  if (targetRole === "branch_admin") return parentRole == null;
  if (targetRole === "sub_branch_admin") return parentRole === "branch_admin";
  if (targetRole === "team_leader")
    return parentRole === "branch_admin" || parentRole === "sub_branch_admin";
  if (targetRole === "member")
    return (
      parentRole === "branch_admin" ||
      parentRole === "sub_branch_admin" ||
      parentRole === "team_leader"
    );
  return false;
}

async function verifyTeamFilterAccess(
  actor: { id: number; role: string; teamId: number | null },
  teamId: number
) {
  const team = await getTeamById(teamId);
  if (!team)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "팀을 찾을 수 없습니다.",
    });
  if (actor.role === "branch_admin") return team;
  if (
    actor.role === "sub_branch_admin" &&
    (team as any).subBranchAdminId === actor.id
  )
    return team;
  if (
    actor.role === "team_leader" &&
    actor.teamId !== null &&
    actor.teamId === teamId
  )
    return team;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "해당 팀의 실적을 조회할 권한이 없습니다.",
  });
}

async function buildPerformanceScope(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    accountStatus: string;
  },
  input?: {
    agentIdFilter?: number;
    teamIdFilter?: number;
    scope?: "all" | "mine";
  }
) {
  const agentId = input?.agentIdFilter;
  const teamId = input?.teamIdFilter;

  if (input?.scope === "all" && user.role !== "branch_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "전체 범위는 지점장만 조회할 수 있습니다.",
    });
  }

  if (user.role === "branch_admin") {
    if (input?.scope === "mine") return { agentId: user.id, teamId };
    return { agentId, teamId };
  }

  if (agentId !== undefined) {
    const target = await verifyTargetUserAccess(user, agentId);
    if (target.role !== "team_leader" && target.role !== "member") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "팀장 또는 팀원의 실적만 조회할 수 있습니다.",
      });
    }
    if (teamId !== undefined && target.teamId !== teamId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "팀과 담당자 필터가 일치하지 않습니다.",
      });
    }
  }

  if (teamId !== undefined) await verifyTeamFilterAccess(user, teamId);

  if (user.role === "sub_branch_admin") {
    if (agentId !== undefined || teamId !== undefined)
      return { agentId, teamId };
    return { agentIds: await getHierarchyScopeUserIds(user) };
  }
  if (user.role === "team_leader") {
    if (agentId !== undefined || teamId !== undefined)
      return { agentId, teamId };
    return { agentIds: await getHierarchyScopeUserIds(user) };
  }

  if (teamId !== undefined || (agentId !== undefined && agentId !== user.id)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 실적만 조회 가능합니다.",
    });
  }
  return { agentId: user.id };
}

async function buildPhoneDuplicateScope(user: {
  id: number;
  role: string;
  teamId: number | null;
  subBranchAdminId?: number | null;
  accountStatus: string;
}) {
  if (user.role === "branch_admin") return {};
  if (user.role === "sub_branch_admin") return { subBranchAdminId: user.id };
  if (user.role === "team_leader") {
    if (user.teamId) return { teamId: user.teamId };
    return { agentIds: await getHierarchyScopeUserIds(user) };
  }
  return { agentId: user.id };
}

function parseScheduleDateTime(value: string, fieldName: string) {
  const parsed = parseKstLocalDateTime(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${fieldName}이 올바르지 않습니다.`,
    });
  }
  return parsed;
}

function assertScheduleEndAfterStart(startTime: Date, endTime?: Date | null) {
  if (endTime && endTime.getTime() <= startTime.getTime()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "종료 시간은 시작 시간보다 늦어야 합니다.",
    });
  }
}

function reminderFlagsFromOffset(reminderOffsetMinutes: number) {
  return {
    reminderDayBefore: reminderOffsetMinutes === 1440,
    reminderSameDay: reminderOffsetMinutes === 0,
    reminderOneHourBefore: reminderOffsetMinutes === 60,
  };
}

const linkedScheduleInputSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    type: z
      .enum([
        "고객상담",
        "재통화",
        "계약예정",
        "보장분석",
        "해지방어",
        "팀회의",
        "교육",
        "외근",
        "휴무",
        "기타",
      ])
      .optional(),
    startTime: z.string().optional(),
    endTime: z.string().nullable().optional(),
    memo: z.string().max(2000).optional(),
    reminderOffsetMinutes: z
      .union([
        z.literal(-1),
        z.literal(0),
        z.literal(30),
        z.literal(60),
        z.literal(120),
        z.literal(180),
        z.literal(1440),
      ])
      .default(30),
  })
  .optional();

type PreparedLinkedCustomerSchedule = {
  targetUserId: number;
  customerId: number;
  title: string;
  type:
    | "고객상담"
    | "재통화"
    | "계약예정"
    | "보장분석"
    | "해지방어"
    | "팀회의"
    | "교육"
    | "외근"
    | "휴무"
    | "기타";
  startTimeDate: Date;
  endTimeDate?: Date;
  memo?: string;
  reminderOffsetMinutes: -1 | 0 | 30 | 60 | 120 | 180 | 1440;
  reminderFlags: ReturnType<typeof reminderFlagsFromOffset>;
};

async function prepareLinkedCustomerScheduleFromWork(params: {
  actor: {
    id: number;
    role: string;
    teamId: number | null;
    accountStatus: string;
  };
  customer: Awaited<ReturnType<typeof verifyCustomerAccess>>;
  schedule?: z.infer<typeof linkedScheduleInputSchema>;
  fallbackStartTime?: string;
  defaultTitle: string;
  defaultType:
    | "고객상담"
    | "재통화"
    | "계약예정"
    | "보장분석"
    | "해지방어"
    | "팀회의"
    | "교육"
    | "외근"
    | "휴무"
    | "기타";
  defaultMemo?: string;
}): Promise<PreparedLinkedCustomerSchedule | undefined> {
  const {
    actor,
    customer,
    schedule,
    fallbackStartTime,
    defaultTitle,
    defaultType,
    defaultMemo,
  } = params;
  if (!schedule) return undefined;

  const startTime = schedule.startTime || fallbackStartTime;
  if (!startTime) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "캘린더 일정 시작 시간이 필요합니다.",
    });
  }

  const targetUserId = customer.agentId ?? actor.id;
  if (targetUserId !== actor.id) {
    await verifyTargetUserAccess(actor, targetUserId);
  }
  await assertActiveScheduleTarget(targetUserId);

  const startTimeDate = parseScheduleDateTime(startTime, "일정 시작 시간");
  const endTimeDate = schedule.endTime
    ? parseScheduleDateTime(schedule.endTime, "일정 종료 시간")
    : undefined;
  assertScheduleEndAfterStart(startTimeDate, endTimeDate);
  const reminderOffsetMinutes = schedule.reminderOffsetMinutes ?? 30;
  const reminderFlags = reminderFlagsFromOffset(reminderOffsetMinutes);
  const title = schedule.title?.trim() || defaultTitle;

  return {
    targetUserId,
    customerId: customer.id,
    title,
    type: schedule.type ?? defaultType,
    startTimeDate,
    endTimeDate,
    memo: schedule.memo ?? defaultMemo,
    reminderOffsetMinutes,
    reminderFlags,
  };
}

async function createPreparedLinkedCustomerSchedule(
  actorId: number,
  preparedSchedule?: PreparedLinkedCustomerSchedule
) {
  if (!preparedSchedule) return false;

  await createSchedule({
    userId: preparedSchedule.targetUserId,
    customerId: preparedSchedule.customerId,
    title: preparedSchedule.title,
    type: preparedSchedule.type,
    status: "예정",
    startTime: preparedSchedule.startTimeDate,
    endTime: preparedSchedule.endTimeDate,
    memo: preparedSchedule.memo,
    reminderOffsetMinutes: preparedSchedule.reminderOffsetMinutes,
    ...preparedSchedule.reminderFlags,
    createdBy: actorId,
  });
  await log(
    actorId,
    "SCHEDULE_CREATED",
    "schedule",
    undefined,
    `title=${preparedSchedule.title}`
  );

  const allSchedules = await getSchedules({
    userId: preparedSchedule.targetUserId,
  });
  const newSchedule = allSchedules.find(
    s =>
      s.title === preparedSchedule.title &&
      s.startTime.getTime() === preparedSchedule.startTimeDate.getTime()
  );
  if (newSchedule) {
    await cancelScheduleTimingNotifications(
      preparedSchedule.targetUserId,
      newSchedule.id
    );
    if (preparedSchedule.reminderOffsetMinutes >= 0) {
      await createScheduleReminderByOffset(
        newSchedule.id,
        preparedSchedule.targetUserId,
        preparedSchedule.startTimeDate,
        preparedSchedule.title,
        preparedSchedule.reminderOffsetMinutes
      );
    }
    if (preparedSchedule.endTimeDate)
      await createScheduleIncompleteReminder(
        newSchedule.id,
        preparedSchedule.targetUserId,
        preparedSchedule.endTimeDate,
        preparedSchedule.title
      );
  }
  return true;
}

async function getScopedDashboardData(user: {
  id: number;
  role: string;
  teamId: number | null;
  accountStatus: string;
}) {
  if (user.role === "branch_admin") {
    const [
      customerList,
      contractList,
      scheduleList,
      notificationResult,
      followUpList,
    ] = await Promise.all([
      getCustomers({}),
      getAllContracts({}),
      getAccessibleSchedules(user),
      getNotificationsFiltered({ limit: 200 }),
      getFollowUps({ statuses: ["scheduled", "postponed"] }),
    ]);
    return {
      customerList,
      contractList,
      scheduleList,
      notifications: notificationResult.items,
      followUpList,
    };
  }

  if (user.role === "sub_branch_admin") {
    const userIds = (await getHierarchyScopeUserIds(user)) ?? [user.id];
    const [
      customerList,
      contractList,
      scheduleList,
      notificationResult,
      followUpList,
    ] = await Promise.all([
      getCustomers({ agentIds: userIds }),
      getAllContracts({ agentIds: userIds }),
      getAccessibleSchedules(user),
      getNotificationsFiltered({ userIds, limit: 200 }),
      getFollowUps({ agentIds: userIds, statuses: ["scheduled", "postponed"] }),
    ]);
    return {
      customerList,
      contractList,
      scheduleList,
      notifications: notificationResult.items,
      followUpList,
    };
  }

  if (user.role === "team_leader") {
    const userIds = (await getHierarchyScopeUserIds(user)) ?? [user.id];
    const [
      customerList,
      contractList,
      scheduleList,
      notificationResult,
      followUpList,
    ] = await Promise.all([
      getCustomers({ agentIds: userIds }),
      getAllContracts({ agentIds: userIds }),
      getAccessibleSchedules(user),
      getNotificationsFiltered({ userIds, limit: 200 }),
      getFollowUps({ agentIds: userIds, statuses: ["scheduled", "postponed"] }),
    ]);
    return {
      customerList,
      contractList,
      scheduleList,
      notifications: notificationResult.items,
      followUpList,
    };
  }

  const [
    customerList,
    contractList,
    scheduleList,
    notificationResult,
    followUpList,
  ] = await Promise.all([
    getCustomers({ agentId: user.id }),
    getAllContracts({ agentId: user.id }),
    getAccessibleSchedules(user),
    getNotificationsFiltered({ userIds: [user.id], limit: 200 }),
    getFollowUps({ agentId: user.id, statuses: ["scheduled", "postponed"] }),
  ]);
  return {
    customerList,
    contractList,
    scheduleList,
    notifications: notificationResult.items,
    followUpList,
  };
}

function isSameCalendarDay(a: Date, b: Date) {
  return isSameKstDate(a, b);
}

function isFinishedScheduleStatus(status: string) {
  return ["완료", "취소", "노쇼"].includes(status);
}

function isUnreadNotification(notification: {
  isRead: boolean;
  processStatus?: string | null;
}) {
  return !notification.isRead || notification.processStatus === "미확인";
}

function isOpenFollowUpStatus(status: string) {
  return status === "scheduled" || status === "postponed";
}

function toDayStart(date: Date) {
  return getKstDayRange(date).start;
}

function toDayEnd(date: Date) {
  return getKstDayRange(date).end;
}

async function getFollowUpScope(user: {
  id: number;
  role: string;
  teamId: number | null;
  accountStatus: string;
}) {
  if (user.role === "branch_admin") return {};
  if (user.role === "sub_branch_admin" || user.role === "team_leader") {
    return { agentIds: await getHierarchyScopeUserIds(user) };
  }
  return { agentId: user.id };
}

async function verifyFollowUpAccess(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
    accountStatus: string;
  },
  followUpId: number
) {
  const followUp = await getFollowUpById(followUpId);
  if (!followUp || followUp.deletedAt)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "후속관리를 찾을 수 없습니다.",
    });
  await verifyCustomerAccess(user, followUp.customerId);
  return followUp;
}

function parseRecommendationTags(value?: string | null): string[] {
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

function daysBetween(from: Date, to: Date) {
  return Math.floor(
    (toDayStart(to).getTime() - toDayStart(from).getTime()) /
      (24 * 60 * 60 * 1000)
  );
}

function customerManagementStartDate(customer: {
  assignedAt?: Date | string | null;
  createdAt?: Date | string | null;
}) {
  return new Date(customer.assignedAt ?? customer.createdAt ?? Date.now());
}

function recommendationUrgency(score: number): "high" | "medium" | "low" {
  if (score >= 55) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function isDesignOrContractReviewState(customer: {
  consultStatus?: string | null;
  nextAction?: string | null;
}) {
  const text = `${customer.consultStatus ?? ""} ${customer.nextAction ?? ""}`;
  return ["설계", "계약", "검토", "발송", "진행"].some(keyword =>
    text.includes(keyword)
  );
}

function hasRecommendationTag(tags: string[], keywords: string[]) {
  return tags.some(tag => keywords.some(keyword => tag.includes(keyword)));
}

function buildSafeContactReason(type: string) {
  const reasonMap: Record<
    string,
    { title: string; description: string; situation?: string }
  > = {
    overdue_follow_up: {
      title: "후속관리 확인",
      description:
        "지난 상담 이후 확인이 필요한 내용이 있어 후속 연락이 필요합니다.",
      situation: "follow_up_schedule",
    },
    today_follow_up: {
      title: "오늘 연락 예정",
      description:
        "이전에 정한 다음 연락일이 도래해 상담 내용을 이어서 확인할 수 있습니다.",
      situation: "follow_up_schedule",
    },
    priority_a_unmanaged: {
      title: "우선관리 고객 확인",
      description:
        "우선관리 고객으로 분류되어 최근 상담 이후 진행 상황 확인이 필요합니다.",
      situation: "general_check",
    },
    proposal_follow_up: {
      title: "자료 이해 여부 확인",
      description:
        "전달한 자료를 보시고 이해가 어려운 부분이 있는지 확인할 수 있습니다.",
      situation: "proposal_follow_up",
    },
    long_unmanaged: {
      title: "기존 기준 점검",
      description:
        "상황 변화가 있었을 수 있어 기존 보장 기준을 점검할 명분이 있습니다.",
      situation: "general_check",
    },
    post_contract_care: {
      title: "계약 후 사후관리",
      description: "계약 이후 보장 내용과 관리 기준을 다시 안내할 시점입니다.",
      situation: "post_contract_care",
    },
    retention_risk: {
      title: "유지 기준 확인",
      description:
        "해지 전 보장 공백과 유지 기준을 차분히 확인할 필요가 있습니다.",
      situation: "general_check",
    },
    premium_burden: {
      title: "보험료 부담 점검",
      description:
        "보험료 부담을 줄이기 위한 조정 가능성을 점검할 수 있습니다.",
      situation: "general_check",
    },
    family_responsibility: {
      title: "가족 기준 점검",
      description:
        "가족 구성과 책임 범위 기준으로 보장 공백을 확인할 수 있습니다.",
      situation: "general_check",
    },
    unread_notification: {
      title: "알림 내용 확인",
      description:
        "확인하지 않은 알림이 있어 고객 관련 처리 상태를 점검할 수 있습니다.",
      situation: "general_check",
    },
    no_consultation: {
      title: "초기 상담 기록 확인",
      description:
        "등록 후 상담기록이 없어 고객 상황과 상담 방향을 확인할 수 있습니다.",
      situation: "general_check",
    },
  };
  return (
    reasonMap[type] ?? {
      title: "고객 상태 점검",
      description:
        "최근 고객 상태를 기준으로 필요한 내용을 확인할 수 있습니다.",
      situation: "general_check",
    }
  );
}

function getReportRange(input?: {
  period?: "week" | "month" | "custom";
  dateFrom?: string;
  dateTo?: string;
}) {
  const now = new Date();
  if (input?.period === "custom") {
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
      dateFrom: toDayStart(dateFrom),
      dateTo: toDayEnd(dateTo),
      period: "custom" as const,
    };
  }
  if (input?.period === "month") {
    return {
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
      period: "month" as const,
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
  return { dateFrom: weekStart, dateTo: weekEnd, period: "week" as const };
}

function isDateInRange(value: unknown, dateFrom: Date, dateTo: Date) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value as any);
  return !Number.isNaN(date.getTime()) && date >= dateFrom && date <= dateTo;
}

function getContractDateValue(contract: any) {
  return contract.contractDate ?? contract.createdAt;
}

function getFollowUpCreatedValue(followUp: any) {
  return followUp.createdAt ?? followUp.nextContactDate;
}

function getFollowUpCompletedValue(followUp: any) {
  return followUp.completedAt ?? followUp.updatedAt;
}

function daysRemainingFromToday(date = new Date()) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return Math.max(1, daysBetween(date, end) + 1);
}

function goalItemForScope(
  items: any[],
  scope: { targetUserId?: number; teamId?: number; subBranchAdminId?: number }
) {
  if (scope.targetUserId !== undefined)
    return items.find(
      item =>
        item.goal.targetType === "user" &&
        item.goal.targetId === scope.targetUserId
    );
  if (scope.teamId !== undefined)
    return items.find(
      item =>
        item.goal.targetType === "team" && item.goal.targetId === scope.teamId
    );
  if (scope.subBranchAdminId !== undefined)
    return items.find(
      item =>
        item.goal.targetType === "sub_branch" &&
        item.goal.targetId === scope.subBranchAdminId
    );
  return items.find(item => item.goal.targetType === "branch") ?? items[0];
}

const salesReportInputSchema = z.object({
  period: z
    .enum(["today", "last7", "month", "lastMonth", "custom"])
    .default("month"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  organizationType: z
    .enum(["all", "sub_branch", "team", "user"])
    .default("all"),
  subBranchAdminId: z.number().nullable().optional(),
  teamId: z.number().nullable().optional(),
  userId: z.number().nullable().optional(),
  scope: z.enum(["all", "mine"]).default("all"),
  ownershipScope: z.enum(["managed", "mine", "member"]).optional(),
  selectedUserId: z.number().optional(),
  performanceBasis: z
    .enum(["new_contract", "monthly_premium"])
    .default("monthly_premium"),
});

type SalesReportInput = z.infer<typeof salesReportInputSchema>;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function salesReportKstParts(date: Date) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function salesReportParseKstDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return salesReportKstParts(parsed);
}

function salesReportKstDayStart(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
}

function salesReportKstDayEnd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0, -1));
}

function getSalesReportDateRange(input: SalesReportInput) {
  const now = new Date();
  if (input.period === "custom") {
    const dateFrom = input.dateFrom
      ? salesReportParseKstDateParts(input.dateFrom)
      : null;
    const dateTo = input.dateTo
      ? salesReportParseKstDateParts(input.dateTo)
      : null;
    if (!dateFrom || !dateTo) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "기간이 올바르지 않습니다.",
      });
    }
    return {
      dateFrom: salesReportKstDayStart(
        dateFrom.year,
        dateFrom.month,
        dateFrom.day
      ),
      dateTo: salesReportKstDayEnd(dateTo.year, dateTo.month, dateTo.day),
      type: input.period,
    };
  }
  const today = salesReportKstParts(now);
  if (input.period === "today") {
    return {
      dateFrom: salesReportKstDayStart(today.year, today.month, today.day),
      dateTo: salesReportKstDayEnd(today.year, today.month, today.day),
      type: input.period,
    };
  }
  if (input.period === "last7") {
    return {
      dateFrom: salesReportKstDayStart(today.year, today.month, today.day - 6),
      dateTo: salesReportKstDayEnd(today.year, today.month, today.day),
      type: input.period,
    };
  }
  if (input.period === "lastMonth") {
    return {
      dateFrom: salesReportKstDayStart(today.year, today.month - 1, 1),
      dateTo: salesReportKstDayEnd(today.year, today.month, 0),
      type: input.period,
    };
  }
  return {
    dateFrom: salesReportKstDayStart(today.year, today.month, 1),
    dateTo: salesReportKstDayEnd(today.year, today.month + 1, 0),
    type: input.period,
  };
}

function safeReportRate(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  const value = (numerator / denominator) * 100;
  return Number(value.toFixed(1));
}

function isSalesReportContractTarget(contract: any) {
  const contractStatus = String(contract.contractStatus ?? "");
  const paymentStatus = String(contract.paymentStatus ?? "");
  return (
    contract.isActive !== false &&
    !contract.deletedAt &&
    !contractStatus.includes("철회") &&
    !contractStatus.includes("해지") &&
    !paymentStatus.includes("실효") &&
    !paymentStatus.includes("해지")
  );
}

function isSalesReportScheduleCompleted(schedule: any) {
  const status = String(schedule.status ?? "");
  return (
    status === "completed" ||
    status.includes("완료") ||
    Boolean(schedule.completedAt)
  );
}

function isUnconsultedCustomer(customer: any) {
  const status = String(customer.consultStatus ?? "");
  return !status || status.includes("미상담");
}

async function resolveSalesReportScope(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId?: number | null;
    accountStatus: string;
  },
  input: SalesReportInput
) {
  const ownershipScope =
    input.ownershipScope ?? (input.scope === "mine" ? "mine" : "managed");
  const [allUsersRaw, allTeamsRaw] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
  ]);
  const allUsers = allUsersRaw as any[];
  const allTeams = allTeamsRaw as any[];
  const activeUsers = allUsers.filter(item => item.accountStatus === "active");
  const activeUserIds = new Set(activeUsers.map(item => item.id));
  const hierarchyIds =
    user.role === "branch_admin"
      ? activeUsers.map(item => item.id)
      : ((await getHierarchyScopeUserIds(user)) ?? [user.id]).filter(id =>
          activeUserIds.has(id)
        );

  if (ownershipScope === "member") {
    if (input.selectedUserId == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Select a member to view.",
      });
    }
    const target = activeUsers.find(item => item.id === input.selectedUserId);
    if (!target) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selected member is not available.",
      });
    }
    if (!hierarchyIds.includes(target.id)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Selected member is outside your report scope.",
      });
    }
    if (user.role === "member" && target.id !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Members can only view their own report.",
      });
    }
    return {
      userIds: [target.id],
      teamId: target.teamId ?? null,
      subBranchAdminId: target.subBranchAdminId ?? null,
      targetUserId: target.id,
      label: `${target.name ?? `User #${target.id}`} member scope`,
      ownershipScope,
      canViewRanking: false,
      includeAllCustomers: false,
      activeUsers,
      activeTeams: allTeams.filter(
        team => team.isActive !== false && !team.deletedAt
      ),
    };
  }

  if (user.role === "member") {
    if (
      input.organizationType === "user" &&
      input.userId != null &&
      input.userId !== user.id
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 리포트만 조회할 수 있습니다.",
      });
    }
    if (
      input.organizationType !== "all" &&
      !(
        input.organizationType === "user" &&
        (input.userId == null || input.userId === user.id)
      )
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 리포트만 조회할 수 있습니다.",
      });
    }
    return {
      userIds: [user.id],
      teamId: null as number | null,
      subBranchAdminId: null as number | null,
      targetUserId: user.id,
      label: "내 리포트",
      ownershipScope: "mine" as const,
      canViewRanking: false,
      includeAllCustomers: false,
      activeUsers,
      activeTeams: allTeams.filter(
        team => team.isActive !== false && !team.deletedAt
      ),
    };
  }

  if (ownershipScope === "mine") {
    return {
      userIds: [user.id],
      teamId: null as number | null,
      subBranchAdminId: null as number | null,
      targetUserId: user.id,
      label: "내 담당 고객",
      ownershipScope,
      canViewRanking: false,
      includeAllCustomers: false,
      activeUsers,
      activeTeams: allTeams.filter(
        team => team.isActive !== false && !team.deletedAt
      ),
    };
  }

  if (input.organizationType === "user" && input.userId != null) {
    const target = await verifyTargetUserAccess(user, input.userId);
    if (!hierarchyIds.includes(target.id)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 사용자입니다.",
      });
    }
    return {
      userIds: [target.id],
      teamId: target.teamId ?? null,
      subBranchAdminId: target.subBranchAdminId ?? null,
      targetUserId: target.id,
      label: target.name ?? `사용자 #${target.id}`,
      ownershipScope,
      canViewRanking: false,
      includeAllCustomers: false,
      activeUsers,
      activeTeams: allTeams.filter(
        team => team.isActive !== false && !team.deletedAt
      ),
    };
  }

  if (input.organizationType === "team" && input.teamId != null) {
    const team = await verifyTeamFilterAccess(user, input.teamId);
    const teamMembers = (await getUsersByTeamId(input.teamId)).filter(
      (item: any) => item.accountStatus === "active"
    );
    const userIds = teamMembers
      .map((item: any) => item.id)
      .filter((id: number) => hierarchyIds.includes(id));
    if (user.role !== "branch_admin" && userIds.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 팀입니다.",
      });
    }
    return {
      userIds,
      teamId: input.teamId,
      subBranchAdminId: (team as any).subBranchAdminId ?? null,
      targetUserId: null as number | null,
      label: (team as any).name ?? `팀 #${input.teamId}`,
      ownershipScope,
      canViewRanking: userIds.length > 1,
      includeAllCustomers: false,
      activeUsers,
      activeTeams: allTeams.filter(
        item => item.isActive !== false && !item.deletedAt
      ),
    };
  }

  if (input.organizationType === "sub_branch") {
    const subBranchAdminId =
      user.role === "sub_branch_admin" ? user.id : input.subBranchAdminId;
    if (!subBranchAdminId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "부지점 범위를 선택하세요.",
      });
    }
    if (user.role !== "branch_admin" && subBranchAdminId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "조회 범위 밖 부지점입니다.",
      });
    }
    const target = await getUserById(subBranchAdminId);
    if (
      !target ||
      target.accountStatus !== "active" ||
      target.role !== "sub_branch_admin"
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "조회할 수 없는 부지점입니다.",
      });
    }
    const ids = descendantUserIdsFrom(
      subBranchAdminId,
      ensureOrgUsers(activeUsers as OrgUser[], user, target as OrgUser),
      allTeams as OrgTeam[],
      true
    ).filter(id => hierarchyIds.includes(id));
    return {
      userIds: ids,
      teamId: null as number | null,
      subBranchAdminId,
      targetUserId: null as number | null,
      label: target.name ?? `부지점 #${subBranchAdminId}`,
      ownershipScope,
      canViewRanking: ids.length > 1,
      includeAllCustomers: false,
      activeUsers,
      activeTeams: allTeams.filter(
        team => team.isActive !== false && !team.deletedAt
      ),
    };
  }

  const userIds =
    user.role === "branch_admin"
      ? activeUsers.map(item => item.id)
      : hierarchyIds;
  return {
    userIds,
    teamId: null as number | null,
    subBranchAdminId: user.role === "sub_branch_admin" ? user.id : null,
    targetUserId: null as number | null,
    label: user.role === "branch_admin" ? "전체 조직" : "내 산하 조직",
    ownershipScope,
    canViewRanking: user.role !== "member" && userIds.length > 1,
    includeAllCustomers: user.role === "branch_admin",
    activeUsers,
    activeTeams: allTeams.filter(
      team => team.isActive !== false && !team.deletedAt
    ),
  };
}

function filterSalesReportRows<T extends Record<string, any>>(
  rows: T[],
  scope: {
    userIds: number[];
    teamId: number | null;
    subBranchAdminId: number | null;
    includeAllCustomers: boolean;
  },
  ownerField: "agentId" | "assignedAgentId" | "userId",
  includeStructuralScope = false
) {
  if (scope.includeAllCustomers) return rows;
  const userIds = new Set(scope.userIds);
  return rows.filter(row => {
    const ownerId = row[ownerField];
    if (typeof ownerId === "number" && userIds.has(ownerId)) return true;
    if (
      includeStructuralScope &&
      scope.teamId != null &&
      row.assignedTeamId === scope.teamId
    )
      return true;
    if (
      includeStructuralScope &&
      scope.teamId != null &&
      row.teamId === scope.teamId
    )
      return true;
    if (
      includeStructuralScope &&
      scope.subBranchAdminId != null &&
      row.subBranchAdminId === scope.subBranchAdminId
    )
      return true;
    return false;
  });
}

async function buildSalesReport(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId?: number | null;
    accountStatus: string;
  },
  rawInput?: Partial<SalesReportInput>
) {
  const input = salesReportInputSchema.parse(rawInput ?? {});
  const range = getSalesReportDateRange(input);
  const scope = await resolveSalesReportScope(user, input);
  const scoped = await getScopedDashboardData(user);
  const followUpScope = await getFollowUpScope(user);
  const allFollowUps = await getFollowUps({
    ...followUpScope,
    statuses: ["scheduled", "postponed", "completed", "cancelled"],
  });
  const activeCustomers = filterSalesReportRows(
    scoped.customerList.filter(
      (customer: any) => customer.isActive !== false && !customer.deletedAt
    ),
    scope,
    "agentId",
    scope.targetUserId == null
  );
  const activeCustomerIds = new Set(
    activeCustomers.map((customer: any) => customer.id)
  );
  const activeContracts = filterSalesReportRows(
    scoped.contractList.filter(isSalesReportContractTarget),
    scope,
    "agentId"
  ).filter((contract: any) => activeCustomerIds.has(contract.customerId));
  const followUps = filterSalesReportRows(
    allFollowUps.filter((followUp: any) => !followUp.deletedAt),
    scope,
    "assignedAgentId",
    scope.targetUserId == null
  ).filter((followUp: any) => activeCustomerIds.has(followUp.customerId));
  const schedules = filterSalesReportRows(
    scoped.scheduleList.filter(
      (schedule: any) => schedule.isActive !== false && !schedule.deletedAt
    ),
    scope,
    "userId",
    scope.targetUserId == null
  );

  const consultationEntries = await Promise.all(
    activeCustomers.map(async (customer: any) => ({
      customer,
      consultations: (await getConsultationsByCustomer(customer.id)).filter(
        (consultation: any) =>
          consultation.isActive !== false && !consultation.deletedAt
      ),
    }))
  );
  const allConsultations = consultationEntries.flatMap(entry =>
    entry.consultations.map((consultation: any) => ({
      ...consultation,
      customerId: entry.customer.id,
      customerAgentId: entry.customer.agentId,
    }))
  );
  const consultationsInPeriod = allConsultations.filter(consultation =>
    isDateInRange(consultation.createdAt, range.dateFrom, range.dateTo)
  );
  const consultedCustomerIds = new Set(
    allConsultations.map(consultation => consultation.customerId)
  );
  const consultedCustomers = activeCustomers.filter(
    (customer: any) =>
      !isUnconsultedCustomer(customer) || consultedCustomerIds.has(customer.id)
  );
  const unconsultedCustomers = activeCustomers.filter(
    (customer: any) =>
      !consultedCustomers.some((item: any) => item.id === customer.id)
  );
  const followUpsCreated = followUps.filter((followUp: any) =>
    isDateInRange(
      getFollowUpCreatedValue(followUp),
      range.dateFrom,
      range.dateTo
    )
  );
  const followUpsScheduled = followUps.filter(
    (followUp: any) =>
      isOpenFollowUpStatus(followUp.status) &&
      isDateInRange(followUp.nextContactDate, range.dateFrom, range.dateTo)
  );
  const followUpsCompleted = followUps.filter(
    (followUp: any) =>
      followUp.status === "completed" &&
      isDateInRange(
        getFollowUpCompletedValue(followUp),
        range.dateFrom,
        range.dateTo
      )
  );
  const pendingFollowUps = followUps.filter((followUp: any) =>
    isOpenFollowUpStatus(followUp.status)
  );
  const schedulesCompleted = schedules.filter(
    (schedule: any) =>
      isSalesReportScheduleCompleted(schedule) &&
      isDateInRange(
        schedule.completedAt ?? schedule.startTime,
        range.dateFrom,
        range.dateTo
      )
  );
  const contractsInPeriod = activeContracts.filter((contract: any) =>
    isDateInRange(getContractDateValue(contract), range.dateFrom, range.dateTo)
  );
  const monthlyPremiumTotal = contractsInPeriod.reduce(
    (sum: number, contract: any) => sum + Number(contract.monthlyPremium ?? 0),
    0
  );
  const longUnmanagedCustomerCount = activeCustomers.filter((customer: any) => {
    const latestConsultationTime = allConsultations
      .filter(consultation => consultation.customerId === customer.id)
      .map(consultation => new Date(consultation.createdAt).getTime())
      .filter(time => !Number.isNaN(time))
      .sort((a, b) => b - a)[0];
    if (!latestConsultationTime)
      return (
        daysBetween(customerManagementStartDate(customer), range.dateTo) >= 90
      );
    return daysBetween(new Date(latestConsultationTime), range.dateTo) >= 90;
  }).length;

  const dbCount = activeCustomers.length;
  const consultedCount = consultedCustomers.length;
  const contractCustomerIds = new Set(
    contractsInPeriod.map((contract: any) => contract.customerId)
  );
  const contractedCustomerCount = contractCustomerIds.size;
  const dbToConsultRate = safeReportRate(consultedCount, dbCount);
  const consultToContractRate = safeReportRate(
    contractedCustomerCount,
    consultedCount
  );
  const followUpCompletionRate = safeReportRate(
    followUpsCompleted.length,
    followUpsCreated.length || followUpsScheduled.length
  );
  const followUpCompleteToContractRate = safeReportRate(
    contractedCustomerCount,
    followUpsCompleted.length
  );

  const goalDashboard = await getPerformanceGoalDashboard(
    user as any,
    range.dateTo.getFullYear(),
    range.dateTo.getMonth() + 1
  );
  const goalItem = goalItemForScope(goalDashboard.items ?? [], {
    targetUserId: scope.targetUserId ?? undefined,
    teamId: scope.teamId ?? undefined,
    subBranchAdminId: scope.subBranchAdminId ?? undefined,
  });
  const goal = goalItem?.goal ?? null;
  const monthlyPremiumGoal = Number(goal?.monthlyPremiumGoal ?? 0);
  const contractCountGoal = Number(goal?.contractCountGoal ?? 0);
  const goalAchievementRate =
    input.performanceBasis === "new_contract"
      ? safeReportRate(contractsInPeriod.length, contractCountGoal)
      : safeReportRate(monthlyPremiumTotal, monthlyPremiumGoal);

  const ranking = scope.canViewRanking
    ? scope.activeUsers
        .filter(
          (item: any) =>
            item.accountStatus === "active" &&
            item.role !== "branch_admin" &&
            scope.userIds.includes(item.id)
        )
        .map((member: any) => {
          const memberCustomers = activeCustomers.filter(
            (customer: any) => customer.agentId === member.id
          );
          const memberCustomerIds = new Set(
            memberCustomers.map((customer: any) => customer.id)
          );
          const memberConsultations = consultationsInPeriod.filter(
            consultation =>
              memberCustomerIds.has(consultation.customerId) ||
              consultation.agentId === member.id
          );
          const memberContracts = contractsInPeriod.filter(
            (contract: any) => contract.agentId === member.id
          );
          const memberFollowUpsCreated = followUpsCreated.filter(
            (followUp: any) => followUp.assignedAgentId === member.id
          );
          const memberFollowUpsCompleted = followUpsCompleted.filter(
            (followUp: any) => followUp.assignedAgentId === member.id
          );
          const memberPremium = memberContracts.reduce(
            (sum: number, contract: any) =>
              sum + Number(contract.monthlyPremium ?? 0),
            0
          );
          const memberConsultRate = safeReportRate(
            memberConsultations.length,
            memberCustomers.length
          );
          const memberContractRate = safeReportRate(
            memberContracts.length,
            memberConsultations.length
          );
          const memberFollowUpRate = safeReportRate(
            memberFollowUpsCompleted.length,
            memberFollowUpsCreated.length
          );
          const improvementAreas = [
            memberConsultRate < 40 && memberCustomers.length > 0
              ? "DB는 많지만 상담 진행률이 낮음"
              : null,
            memberContractRate < 20 && memberConsultations.length > 0
              ? "상담 수 대비 계약 전환율이 낮음"
              : null,
            memberFollowUpRate < 60 && memberFollowUpsCreated.length > 0
              ? "후속관리 완료율 개선 필요"
              : null,
            pendingFollowUps.filter(
              (followUp: any) => followUp.assignedAgentId === member.id
            ).length > 0
              ? "미처리 후속관리 확인 필요"
              : null,
          ].filter(Boolean) as string[];
          return {
            userId: member.id,
            name: member.name ?? `사용자 #${member.id}`,
            role: member.role,
            teamId: member.teamId ?? null,
            newContractCount: memberContracts.length,
            monthlyPremiumTotal: memberPremium,
            consultationCount: memberConsultations.length,
            followUpCompletionRate: memberFollowUpRate,
            consultToContractRate: memberContractRate,
            pendingFollowUpCount: pendingFollowUps.filter(
              (followUp: any) => followUp.assignedAgentId === member.id
            ).length,
            improvementAreas,
          };
        })
        .sort((a, b) =>
          input.performanceBasis === "new_contract"
            ? b.newContractCount - a.newContractCount
            : b.monthlyPremiumTotal - a.monthlyPremiumTotal
        )
    : [];

  const bottleneckCandidates = [
    {
      key: "db_to_consult",
      rate: dbToConsultRate,
      title: "상담 전환율이 낮습니다.",
      priority: "DB는 충분하지만 상담으로 이어지는 비율을 먼저 확인하세요.",
      action: "오늘 우선 연락할 고객과 미상담 고객을 확인하세요.",
      customerSegment: "미상담 고객",
    },
    {
      key: "follow_up_completion",
      rate: followUpCompletionRate,
      title: "후속관리 완료율이 낮습니다.",
      priority: "후속관리 예정이 완료로 이어지는 흐름이 약합니다.",
      action: "미처리 후속관리와 연기된 후속관리를 먼저 처리하세요.",
      customerSegment: "미처리 후속관리 고객",
    },
    {
      key: "consult_to_contract",
      rate: consultToContractRate,
      title: "상담 대비 계약 전환율이 낮습니다.",
      priority: "상담은 진행되지만 계약으로 이어지는 구간이 병목입니다.",
      action: "설계중/상담예정 고객의 다음 제안 일정을 확인하세요.",
      customerSegment: "상담 진행 고객",
    },
    ...(goal
      ? [
          {
            key: "goal_progress",
            rate: goalAchievementRate,
            title: "월납보험료 실적이 목표 대비 부족합니다.",
            priority:
              "목표 대비 부족분을 기준으로 이번 달 행동량을 조정해야 합니다.",
            action:
              "월납보험료 가능성이 높은 고객군과 계약 제안 대상을 확인하세요.",
            customerSegment: "계약 제안 대상",
          },
        ]
      : []),
    ...(longUnmanagedCustomerCount > 0
      ? [
          {
            key: "long_unmanaged",
            rate: safeReportRate(dbCount - longUnmanagedCustomerCount, dbCount),
            title: "장기 미관리 고객 확인이 필요합니다.",
            priority: "관리 공백 고객이 쌓이면 상담 명분이 약해질 수 있습니다.",
            action:
              "장기 미관리 고객에게 기존 보장 기준 점검 연락을 진행하세요.",
            customerSegment: "장기 미관리 고객",
          },
        ]
      : []),
  ];
  const bottleneck = bottleneckCandidates.sort(
    (a, b) => a.rate - b.rate
  )[0] ?? {
    key: "stable",
    rate: 100,
    title: "현재 큰 병목은 보이지 않습니다.",
    priority: "상담, 후속관리, 계약 흐름이 비교적 안정적입니다.",
    action: "오늘 우선 연락할 고객을 확인하고 현재 리듬을 유지하세요.",
    customerSegment: "오늘 우선 연락 고객",
  };

  return {
    scope: {
      role: user.role,
      userId: user.id,
      label: scope.label,
      ownershipScope: scope.ownershipScope,
      organizationType: input.organizationType,
      targetUserId: scope.targetUserId,
      teamId: scope.teamId,
      subBranchAdminId: scope.subBranchAdminId,
      canViewRanking: scope.canViewRanking,
    },
    period: {
      type: range.type,
      dateFrom: range.dateFrom.toISOString(),
      dateTo: range.dateTo.toISOString(),
    },
    funnel: {
      stages: [
        {
          key: "db",
          label: "DB 보유",
          count: dbCount,
          amount: null,
          conversionRate: null,
          helper: "현재 조회 범위의 활성 고객 DB",
        },
        {
          key: "unconsulted",
          label: "상담 전 / 미상담",
          count: unconsultedCustomers.length,
          amount: null,
          conversionRate: safeReportRate(unconsultedCustomers.length, dbCount),
          helper: "아직 상담 진입 전인 고객",
        },
        {
          key: "consulting",
          label: "상담 진행",
          count: consultedCount,
          amount: null,
          conversionRate: dbToConsultRate,
          helper: "상담 상태 또는 상담기록이 있는 고객",
        },
        {
          key: "follow_scheduled",
          label: "후속관리 예정",
          count: followUpsScheduled.length,
          amount: null,
          conversionRate: safeReportRate(
            followUpsScheduled.length,
            consultedCount
          ),
          helper: "기간 내 예정된 후속관리",
        },
        {
          key: "follow_completed",
          label: "후속관리 완료",
          count: followUpsCompleted.length,
          amount: null,
          conversionRate: followUpCompletionRate,
          helper: "기간 내 완료된 후속관리",
        },
        {
          key: "contract",
          label: "계약 등록",
          count: contractsInPeriod.length,
          amount: null,
          conversionRate: consultToContractRate,
          helper: "기간 내 신규 계약",
        },
        {
          key: "premium",
          label: "월납보험료 실적 발생",
          count: contractsInPeriod.length,
          amount: monthlyPremiumTotal,
          conversionRate: safeReportRate(
            monthlyPremiumTotal,
            monthlyPremiumGoal
          ),
          helper: "기간 내 신규 계약 월납보험료 합계",
        },
      ],
      dbToConsultRate,
      consultToContractRate,
      followUpCompletionRate,
      followUpCompleteToContractRate,
    },
    performance: {
      newContractCount: contractsInPeriod.length,
      monthlyPremiumTotal,
      consultationCount: consultationsInPeriod.length,
      followUpCreatedCount: followUpsCreated.length,
      followUpCompletedCount: followUpsCompleted.length,
      followUpCompletionRate,
      scheduleCompletedCount: schedulesCompleted.length,
      pendingFollowUpCount: pendingFollowUps.length,
      longUnmanagedCustomerCount,
      dbToConsultRate,
      consultToContractRate,
      followUpCompleteToContractRate,
      goalAchievementRate,
      goal: goal
        ? {
            id: goal.id,
            targetType: goal.targetType,
            targetId: goal.targetId,
            contractCountGoal,
            monthlyPremiumGoal,
          }
        : null,
    },
    ranking,
    bottleneck: { ...bottleneck, allCandidates: bottleneckCandidates },
    empty:
      dbCount === 0 &&
      contractsInPeriod.length === 0 &&
      consultationsInPeriod.length === 0,
  };
}

async function buildRecommendationItems(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    accountStatus: string;
  },
  baseDate: Date
) {
  const { customerList, contractList, notifications, followUpList } =
    await getScopedDashboardData(user);
  const activeCustomers = customerList.filter(
    customer => customer.isActive && !customer.deletedAt
  );
  const consultationEntries = await Promise.all(
    activeCustomers.map(async customer => ({
      customerId: customer.id,
      consultations: await getConsultationsByCustomer(customer.id),
    }))
  );
  const consultationsByCustomer = new Map(
    consultationEntries.map(entry => [entry.customerId, entry.consultations])
  );
  const contractsByCustomer = new Map<number, typeof contractList>();
  for (const contract of contractList.filter(
    contract => contract.isActive && !contract.deletedAt
  )) {
    const rows = contractsByCustomer.get(contract.customerId) ?? [];
    rows.push(contract);
    contractsByCustomer.set(contract.customerId, rows);
  }
  const followUpsByCustomer = new Map<number, typeof followUpList>();
  for (const followUp of followUpList.filter(followUp =>
    isOpenFollowUpStatus(followUp.status)
  )) {
    const rows = followUpsByCustomer.get(followUp.customerId) ?? [];
    rows.push(followUp);
    followUpsByCustomer.set(followUp.customerId, rows);
  }
  const unreadNotificationsByCustomer = new Map<number, typeof notifications>();
  for (const notification of notifications.filter(notification =>
    isUnreadNotification(notification)
  )) {
    if (notification.relatedType !== "customer" || !notification.relatedId)
      continue;
    const rows =
      unreadNotificationsByCustomer.get(notification.relatedId) ?? [];
    rows.push(notification);
    unreadNotificationsByCustomer.set(notification.relatedId, rows);
  }

  const todayStart = toDayStart(baseDate);
  const todayEnd = toDayEnd(baseDate);

  return activeCustomers.map(customer => {
    const tags = parseRecommendationTags(customer.customerTags);
    const customerFollowUps = followUpsByCustomer.get(customer.id) ?? [];
    const customerConsultations =
      consultationsByCustomer.get(customer.id) ?? [];
    const customerContracts = contractsByCustomer.get(customer.id) ?? [];
    const unreadNotifications =
      unreadNotificationsByCustomer.get(customer.id) ?? [];
    const latestConsultation = customerConsultations
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    const latestContract = customerContracts
      .slice()
      .sort(
        (a, b) =>
          new Date(b.contractDate ?? b.createdAt).getTime() -
          new Date(a.contractDate ?? a.createdAt).getTime()
      )[0];

    let totalScore = 0;
    const reasons: string[] = [];
    const warnings: Array<{
      warningType: string;
      severity: "high" | "medium" | "low";
      message: string;
      source: string;
    }> = [];
    const contactReasonTypes = new Set<string>();

    const overdueFollowUps = customerFollowUps.filter(
      followUp =>
        new Date(followUp.nextContactDate).getTime() < todayStart.getTime()
    );
    const todayFollowUps = customerFollowUps.filter(followUp => {
      const nextDate = new Date(followUp.nextContactDate);
      return (
        nextDate.getTime() >= todayStart.getTime() &&
        nextDate.getTime() <= todayEnd.getTime()
      );
    });
    if (overdueFollowUps.length > 0) {
      totalScore += 40;
      reasons.push("후속관리 예정일 경과");
      warnings.push({
        warningType: "overdue_follow_up",
        severity: "high",
        message: "후속관리 예정일이 지났습니다.",
        source: "follow_ups",
      });
      contactReasonTypes.add("overdue_follow_up");
    }
    if (todayFollowUps.length > 0) {
      totalScore += 35;
      reasons.push("오늘 연락 예정");
      contactReasonTypes.add("today_follow_up");
    }
    if (customer.priority === "A") {
      totalScore += 25;
      reasons.push("A등급 고객");
    } else if (customer.priority === "B") {
      totalScore += 15;
      reasons.push("B등급 고객");
    }
    if (unreadNotifications.length > 0) {
      totalScore += 10;
      reasons.push("미확인 알림 있음");
      warnings.push({
        warningType: "unread_notification",
        severity: "medium",
        message: "확인하지 않은 알림이 있습니다.",
        source: "notifications",
      });
      contactReasonTypes.add("unread_notification");
    }
    if (hasRecommendationTag(tags, ["해지", "위험"])) {
      totalScore += 25;
      reasons.push("해지위험 태그");
      contactReasonTypes.add("retention_risk");
    }
    if (hasRecommendationTag(tags, ["사후관리", "리밸런싱"])) {
      totalScore += 20;
      reasons.push("관리 필요 태그");
      contactReasonTypes.add("post_contract_care");
    }
    if (hasRecommendationTag(tags, ["가격", "보험료", "부담"]))
      contactReasonTypes.add("premium_burden");
    if (hasRecommendationTag(tags, ["가족", "책임"]))
      contactReasonTypes.add("family_responsibility");
    if (
      customer.nextAction &&
      ["재연락", "설계안", "계약", "보장분석"].some(keyword =>
        customer.nextAction?.includes(keyword)
      )
    ) {
      totalScore += 15;
      reasons.push(`다음 액션: ${customer.nextAction}`);
      if (customer.nextAction.includes("설계안"))
        contactReasonTypes.add("proposal_follow_up");
    }

    const managementStartDate = customerManagementStartDate(customer);
    const managementDays = daysBetween(managementStartDate, baseDate);
    if (managementDays >= 7 && customerConsultations.length === 0) {
      totalScore += 15;
      warnings.push({
        warningType: "no_consultation",
        severity: "medium",
        message: "배정 후 상담기록이 없습니다.",
        source: "consultations",
      });
      contactReasonTypes.add("no_consultation");
    }

    const lastConsultationDate = latestConsultation
      ? new Date(latestConsultation.createdAt)
      : null;
    const daysSinceConsult = lastConsultationDate
      ? daysBetween(lastConsultationDate, baseDate)
      : null;
    if (
      isDesignOrContractReviewState(customer) &&
      ((daysSinceConsult === null && managementDays >= 14) ||
        (daysSinceConsult !== null && daysSinceConsult >= 14))
    ) {
      totalScore += 20;
      reasons.push("설계/계약 검토 장기화");
      warnings.push({
        warningType: "proposal_stalled",
        severity: "medium",
        message: "설계 진행 상태가 장기화되고 있습니다.",
        source: "customers",
      });
      contactReasonTypes.add("proposal_follow_up");
    }
    if (
      customer.priority === "A" &&
      ((daysSinceConsult === null && managementDays >= 7) ||
        (daysSinceConsult !== null && daysSinceConsult >= 7)) &&
      todayFollowUps.length === 0
    ) {
      warnings.push({
        warningType: "priority_a_unmanaged",
        severity: "high",
        message: "A등급 고객 관리가 지연되고 있습니다.",
        source: "customers",
      });
      contactReasonTypes.add("priority_a_unmanaged");
    }
    if (
      (daysSinceConsult === null && managementDays >= 90) ||
      (daysSinceConsult !== null && daysSinceConsult >= 90)
    ) {
      totalScore += 20;
      reasons.push("장기 미관리 가능성");
      warnings.push({
        warningType: "long_unmanaged",
        severity: "medium",
        message: "장기 미관리 고객입니다.",
        source: "consultations",
      });
      contactReasonTypes.add("long_unmanaged");
    }
    if (latestContract?.contractDate) {
      const contractDate = new Date(latestContract.contractDate);
      const daysSinceContract = daysBetween(contractDate, baseDate);
      if (
        (daysSinceContract >= 30 || daysSinceContract >= 90) &&
        (!lastConsultationDate || lastConsultationDate < contractDate)
      ) {
        totalScore += 10;
        reasons.push("계약 후 사후관리 시점");
        warnings.push({
          warningType: "post_contract_unmanaged",
          severity: "medium",
          message: "계약 후 사후관리 확인이 필요합니다.",
          source: "contracts",
        });
        contactReasonTypes.add("post_contract_care");
      }
    }

    const contactReasonTypeList = Array.from(contactReasonTypes);
    const firstContactReasonType = contactReasonTypeList[0] ?? "general_check";
    const contactReason = buildSafeContactReason(firstContactReasonType);
    return {
      customerId: customer.id,
      customerName: customer.name,
      priority: customer.priority,
      tags,
      consultationStatus: customer.consultStatus,
      totalScore,
      urgency: recommendationUrgency(totalScore),
      reasons: reasons.slice(0, 5),
      recommendedAction: contactReason.title,
      contactReason,
      lastConsultationDate: latestConsultation?.createdAt ?? null,
      nextContactDate:
        [...overdueFollowUps, ...todayFollowUps].sort(
          (a, b) =>
            new Date(a.nextContactDate).getTime() -
            new Date(b.nextContactDate).getTime()
        )[0]?.nextContactDate ?? null,
      openFollowUpCount: customerFollowUps.length,
      unreadNotificationCount: unreadNotifications.length,
      warnings,
      contactReasons: contactReasonTypeList.map(type => ({
        reasonType: type,
        ...buildSafeContactReason(type),
      })),
    };
  });
}

async function buildWorkRhythmReport(
  user: {
    id: number;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
    accountStatus: string;
  },
  input?: {
    period?: "week" | "month" | "custom";
    dateFrom?: string;
    dateTo?: string;
    targetUserId?: number;
    teamId?: number;
    subBranchAdminId?: number;
  }
) {
  const range = getReportRange(input);
  const monthStart = new Date(
    range.dateTo.getFullYear(),
    range.dateTo.getMonth(),
    1
  );
  const monthEnd = new Date(
    range.dateTo.getFullYear(),
    range.dateTo.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  const scoped = await getScopedDashboardData(user);
  let customerList = scoped.customerList.filter(
    customer => customer.isActive && !customer.deletedAt
  );
  let contractList = scoped.contractList.filter(
    contract => contract.isActive && !contract.deletedAt
  );
  const followUpScope = await getFollowUpScope(user);
  let followUpList = await getFollowUps({
    ...followUpScope,
    statuses: ["scheduled", "postponed", "completed", "cancelled"],
  });
  const requestedScope: {
    targetUserId?: number;
    teamId?: number;
    subBranchAdminId?: number;
  } = {};

  if (input?.targetUserId !== undefined) {
    const target = await verifyTargetUserAccess(user, input.targetUserId);
    if (target.role !== "team_leader" && target.role !== "member") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "팀장 또는 팀원 리포트만 조회할 수 있습니다.",
      });
    }
    requestedScope.targetUserId = input.targetUserId;
    customerList = customerList.filter(
      customer => customer.agentId === input.targetUserId
    );
    contractList = contractList.filter(
      contract => contract.agentId === input.targetUserId
    );
    followUpList = followUpList.filter(
      followUp => followUp.assignedAgentId === input.targetUserId
    );
  }

  if (input?.teamId !== undefined) {
    await verifyTeamFilterAccess(user, input.teamId);
    requestedScope.teamId = input.teamId;
    customerList = customerList.filter(
      customer => customer.assignedTeamId === input.teamId
    );
    const teamMembers = await getUsersByTeamId(input.teamId);
    const teamUserIds = new Set(teamMembers.map(item => item.id));
    contractList = contractList.filter(contract =>
      teamUserIds.has(contract.agentId ?? -1)
    );
    followUpList = followUpList.filter(
      followUp => followUp.teamId === input.teamId
    );
  }

  if (input?.subBranchAdminId !== undefined) {
    if (
      user.role !== "branch_admin" &&
      !(user.role === "sub_branch_admin" && input.subBranchAdminId === user.id)
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "해당 부지점 리포트를 조회할 권한이 없습니다.",
      });
    }
    requestedScope.subBranchAdminId = input.subBranchAdminId;
    customerList = customerList.filter(
      customer => customer.subBranchAdminId === input.subBranchAdminId
    );
    const subUsers = await getUsersBySubBranchAdminId(input.subBranchAdminId);
    const subUserIds = new Set(subUsers.map(item => item.id));
    contractList = contractList.filter(contract =>
      subUserIds.has(contract.agentId ?? -1)
    );
    followUpList = followUpList.filter(
      followUp => followUp.subBranchAdminId === input.subBranchAdminId
    );
  }

  const consultationEntries = await Promise.all(
    customerList.map(async customer => ({
      customer,
      consultations: await getConsultationsByCustomer(customer.id),
    }))
  );
  const allConsultations = consultationEntries.flatMap(entry =>
    entry.consultations.map(consultation => ({
      ...consultation,
      customerId: entry.customer.id,
    }))
  );
  const consultationsInPeriod = allConsultations.filter(consultation =>
    isDateInRange(consultation.createdAt, range.dateFrom, range.dateTo)
  );
  const followUpsCreated = followUpList.filter(followUp =>
    isDateInRange(
      getFollowUpCreatedValue(followUp),
      range.dateFrom,
      range.dateTo
    )
  );
  const followUpsCompleted = followUpList.filter(
    followUp =>
      followUp.status === "completed" &&
      isDateInRange(
        getFollowUpCompletedValue(followUp),
        range.dateFrom,
        range.dateTo
      )
  );
  const openOverdueFollowUps = followUpList.filter(
    followUp =>
      isOpenFollowUpStatus(followUp.status) &&
      new Date(followUp.nextContactDate) <= toDayEnd(new Date())
  );
  const contractsInPeriod = contractList.filter(contract =>
    isDateInRange(getContractDateValue(contract), range.dateFrom, range.dateTo)
  );
  const monthlyContracts = contractList.filter(contract =>
    isDateInRange(getContractDateValue(contract), monthStart, monthEnd)
  );
  const isNewContractMetricTarget = (contract: any) =>
    contract.contractStatus !== "철회" &&
    contract.contractStatus !== "해지" &&
    contract.paymentStatus !== "실효" &&
    contract.paymentStatus !== "해지";
  const newContractsInPeriod = contractsInPeriod.filter(
    isNewContractMetricTarget
  );
  const monthlyNewContracts = monthlyContracts.filter(
    isNewContractMetricTarget
  );
  const priorityACustomers = customerList.filter(
    customer => customer.priority === "A"
  );
  const managedSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const managedCustomerIds = new Set([
    ...allConsultations
      .filter(consultation =>
        isDateInRange(consultation.createdAt, managedSince, new Date())
      )
      .map(consultation => consultation.customerId),
    ...followUpList
      .filter(
        followUp =>
          followUp.status === "completed" &&
          isDateInRange(
            getFollowUpCompletedValue(followUp),
            managedSince,
            new Date()
          )
      )
      .map(followUp => followUp.customerId),
  ]);
  const priorityAManagedCount = priorityACustomers.filter(customer =>
    managedCustomerIds.has(customer.id)
  ).length;
  const longUnmanagedCustomerCount = customerList.filter(customer => {
    const latestConsult = allConsultations
      .filter(consultation => consultation.customerId === customer.id)
      .map(consultation => new Date(consultation.createdAt).getTime())
      .filter(time => !Number.isNaN(time))
      .sort((a, b) => b - a)[0];
    return (
      !latestConsult || daysBetween(new Date(latestConsult), new Date()) >= 90
    );
  }).length;
  const goalDashboard = await getPerformanceGoalDashboard(
    user as any,
    range.dateTo.getFullYear(),
    range.dateTo.getMonth() + 1
  );
  const goalItem = goalItemForScope(goalDashboard.items, requestedScope);
  const goal = goalItem?.goal ?? null;
  const actualContractCount = monthlyNewContracts.length;
  const actualMonthlyPremium = monthlyContracts.reduce(
    (sum, contract) => sum + Number(contract.monthlyPremium ?? 0),
    0
  );
  const contractCountGoal = Number(goal?.contractCountGoal ?? 0);
  const monthlyPremiumGoal = Number(goal?.monthlyPremiumGoal ?? 0);
  const remainingContractCount = Math.max(
    0,
    contractCountGoal - actualContractCount
  );
  const remainingMonthlyPremium = Math.max(
    0,
    monthlyPremiumGoal - actualMonthlyPremium
  );
  const remainingDays = daysRemainingFromToday();
  const priorityContacts = (
    await buildRecommendationItems(user, new Date())
  ).filter(item =>
    customerList.some(customer => customer.id === item.customerId)
  );
  const followUpCompletionRate =
    followUpsCreated.length > 0
      ? Math.round((followUpsCompleted.length / followUpsCreated.length) * 100)
      : null;
  const insights: string[] = [];
  if (followUpCompletionRate !== null && followUpCompletionRate < 60)
    insights.push("이번 기간 후속관리 완료율이 낮습니다.");
  if (priorityACustomers.length > priorityAManagedCount)
    insights.push("A등급 고객 중 최근 관리 이력이 없는 고객이 있습니다.");
  if (remainingContractCount > 0 || remainingMonthlyPremium > 0)
    insights.push("목표까지 부족한 계약 수 또는 월납보험료가 남아 있습니다.");
  if (priorityContacts.length > 0)
    insights.push("오늘 우선 연락 고객을 먼저 확인해보세요.");

  return {
    scope: {
      role: user.role,
      userId: user.id,
      targetUserId: requestedScope.targetUserId ?? null,
      teamId: requestedScope.teamId ?? null,
      subBranchAdminId: requestedScope.subBranchAdminId ?? null,
    },
    period: {
      type: range.period,
      dateFrom: range.dateFrom.toISOString(),
      dateTo: range.dateTo.toISOString(),
    },
    consultationCount: consultationsInPeriod.length,
    followUpCreatedCount: followUpsCreated.length,
    followUpCompletedCount: followUpsCompleted.length,
    followUpCompletionRate,
    pendingFollowUpCount: followUpList.filter(followUp =>
      isOpenFollowUpStatus(followUp.status)
    ).length,
    overdueFollowUpCount: openOverdueFollowUps.length,
    contractCount: newContractsInPeriod.length,
    newContractCount: newContractsInPeriod.length,
    monthlyPremiumSum: contractsInPeriod.reduce(
      (sum, contract) => sum + Number(contract.monthlyPremium ?? 0),
      0
    ),
    monthlyPremiumTotal: contractsInPeriod.reduce(
      (sum, contract) => sum + Number(contract.monthlyPremium ?? 0),
      0
    ),
    longUnmanagedCustomerCount,
    priorityACustomerCount: priorityACustomers.length,
    priorityAManagedCount,
    priorityAManagementRate:
      priorityACustomers.length > 0
        ? Math.round((priorityAManagedCount / priorityACustomers.length) * 100)
        : null,
    goal: goal
      ? {
          id: goal.id,
          targetType: goal.targetType,
          targetId: goal.targetId,
          contractCountGoal,
          monthlyPremiumGoal,
        }
      : null,
    actual: {
      contractCount: actualContractCount,
      newContractCount: actualContractCount,
      monthlyPremium: actualMonthlyPremium,
      monthlyPremiumTotal: actualMonthlyPremium,
    },
    remaining: {
      contractCount: remainingContractCount,
      monthlyPremium: remainingMonthlyPremium,
    },
    remainingDays,
    dailyRequired: {
      contractCount: Number(
        (remainingContractCount / remainingDays).toFixed(1)
      ),
      monthlyPremium: Math.ceil(remainingMonthlyPremium / remainingDays),
    },
    recommendedTodayActions: {
      priorityContactCount: priorityContacts.length,
      highUrgencyContactCount: priorityContacts.filter(
        item => item.urgency === "high"
      ).length,
      suggestedConsultationCount: Math.max(
        priorityContacts.filter(item => item.urgency === "high").length,
        Math.ceil(remainingContractCount / remainingDays) * 3
      ),
    },
    insights,
  };
}

async function buildAdminTeamInsights(user: {
  id: number;
  role: string;
  teamId: number | null;
  accountStatus: string;
  subBranchAdminId: number | null;
}) {
  if (user.role === "member") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "팀원 관리 대시보드는 관리자만 접근할 수 있습니다.",
    });
  }

  const allUsers = (await getAllUsers()) as any[];
  const activeUsers = allUsers.filter(u => u.accountStatus === "active");

  const scopedUserIds =
    user.role === "branch_admin"
      ? new Set(activeUsers.map(item => item.id))
      : new Set((await getHierarchyScopeUserIds(user)) ?? [user.id]);

  const visibleUsers = activeUsers.filter(
    u => scopedUserIds.has(u.id) && u.role !== "branch_admin"
  );

  const scopedData = await getScopedDashboardData(user);

  const todayStart = toDayStart(new Date());
  const todayEnd = toDayEnd(new Date());
  const managedSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const longUnmanagedSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const consultationEntries = await Promise.all(
    scopedData.customerList.map(async customer => ({
      customerId: customer.id,
      agentId: customer.agentId,
      consultations: await getConsultationsByCustomer(customer.id),
    }))
  );

  const userMetrics = visibleUsers.map(u => {
    // 1. 미상담 DB
    const assignedCustomers = scopedData.customerList.filter(
      c => c.agentId === u.id && c.isActive && !c.deletedAt
    );
    const unconsultedDbCount = assignedCustomers.filter(
      c => c.consultStatus === "미상담"
    ).length;

    // 2. 후속관리 지연
    const userFollowUps = scopedData.followUpList.filter(
      f => f.assignedAgentId === u.id && isOpenFollowUpStatus(f.status)
    );
    const overdueFollowUpsCount = userFollowUps.filter(
      f => new Date(f.nextContactDate) < todayStart
    ).length;
    const todayFollowUpsCount = userFollowUps.filter(
      f =>
        new Date(f.nextContactDate) >= todayStart &&
        new Date(f.nextContactDate) <= todayEnd
    ).length;

    // 3. 오늘 미완료 일정
    const userSchedules = scopedData.scheduleList.filter(
      s => s.userId === u.id
    );
    const todaySchedules = userSchedules.filter(s =>
      isSameCalendarDay(new Date(s.startTime), new Date())
    );
    const incompleteSchedulesCount = todaySchedules.filter(
      s => !isFinishedScheduleStatus(s.status)
    ).length;

    // 4. 장기 미관리 및 A등급 미관리
    let longUnmanagedCount = 0;
    let priorityAUnmanagedCount = 0;
    let postContractUnmanagedCount = 0;

    assignedCustomers.forEach(customer => {
      const entry = consultationEntries.find(e => e.customerId === customer.id);
      const latestConsult = entry?.consultations
        .map(c => new Date(c.createdAt).getTime())
        .filter(time => !Number.isNaN(time))
        .sort((a, b) => b - a)[0];

      const lastConsultDate = latestConsult ? new Date(latestConsult) : null;

      if (!lastConsultDate || lastConsultDate < longUnmanagedSince) {
        longUnmanagedCount++;
      }

      if (customer.priority === "A") {
        if (!lastConsultDate || lastConsultDate < managedSince) {
          const recentCompletedFollowUp = scopedData.followUpList.some(
            f =>
              f.customerId === customer.id &&
              f.status === "completed" &&
              getFollowUpCompletedValue(f) >= managedSince
          );
          if (!recentCompletedFollowUp) {
            priorityAUnmanagedCount++;
          }
        }
      }

      const customerContracts = scopedData.contractList.filter(
        c => c.customerId === customer.id && c.isActive && !c.deletedAt
      );
      if (customerContracts.length > 0) {
        const latestContract = customerContracts.sort(
          (a, b) =>
            new Date(getContractDateValue(b)).getTime() -
            new Date(getContractDateValue(a)).getTime()
        )[0];
        const contractDate = new Date(getContractDateValue(latestContract));
        if (contractDate < thirtyDaysAgo) {
          if (!lastConsultDate || lastConsultDate < contractDate) {
            postContractUnmanagedCount++;
          }
        }
      }
    });

    // 5. 미확인 알림
    const unreadNotificationsCount = scopedData.notifications.filter(
      n => n.userId === u.id && isUnreadNotification(n)
    ).length;

    // 6. 오늘 상담/계약
    const todayConsultationsCount = consultationEntries
      .filter(e => e.agentId === u.id)
      .flatMap(e => e.consultations)
      .filter(c => isSameCalendarDay(new Date(c.createdAt), new Date())).length;

    const todayContractsCount = scopedData.contractList.filter(
      c =>
        c.agentId === u.id &&
        isSameCalendarDay(new Date(getContractDateValue(c)), new Date()) &&
        c.isActive &&
        !c.deletedAt
    ).length;

    const riskScore =
      unconsultedDbCount * 2 +
      overdueFollowUpsCount * 5 +
      incompleteSchedulesCount * 3 +
      longUnmanagedCount * 3 +
      priorityAUnmanagedCount * 5 +
      postContractUnmanagedCount * 4 +
      unreadNotificationsCount * 1;

    return {
      user: {
        id: u.id,
        name: u.name ?? `팀원 ${u.id}`,
        role: u.role,
        teamId: u.teamId,
        subBranchAdminId: u.subBranchAdminId,
      },
      metrics: {
        unconsultedDbCount,
        overdueFollowUpsCount,
        todayFollowUpsCount,
        incompleteSchedulesCount,
        longUnmanagedCount,
        priorityAUnmanagedCount,
        postContractUnmanagedCount,
        unreadNotificationsCount,
        todayConsultationsCount,
        todayContractsCount,
      },
      riskScore,
    };
  });

  const topRiskUsers = [...userMetrics]
    .filter(m => m.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const summary = {
    totalUnconsultedDb: userMetrics.reduce(
      (sum, m) => sum + m.metrics.unconsultedDbCount,
      0
    ),
    totalOverdueFollowUps: userMetrics.reduce(
      (sum, m) => sum + m.metrics.overdueFollowUpsCount,
      0
    ),
    totalTodayFollowUps: userMetrics.reduce(
      (sum, m) => sum + m.metrics.todayFollowUpsCount,
      0
    ),
    totalIncompleteSchedules: userMetrics.reduce(
      (sum, m) => sum + m.metrics.incompleteSchedulesCount,
      0
    ),
    totalPriorityAUnmanaged: userMetrics.reduce(
      (sum, m) => sum + m.metrics.priorityAUnmanagedCount,
      0
    ),
  };

  return {
    summary,
    topRiskUsers,
    userMetrics: userMetrics.sort((a, b) => b.riskScore - a.riskScore),
  };
}

const downloadRequestSchema = z.object({
  reason: z.string().min(5).max(300),
  masked: z.boolean().optional().default(true),
  rawConfirm: z.boolean().optional().default(false),
});

const downloadFieldPreview = {
  customers: [
    { key: "name", label: "이름", sensitive: true },
    { key: "birthDate", label: "생년월일", sensitive: true },
    { key: "phone", label: "연락처", sensitive: true },
    { key: "gender", label: "성별", sensitive: false },
    { key: "region", label: "지역", sensitive: false },
    { key: "source", label: "유입경로", sensitive: false },
    { key: "dbCompany", label: "DB 업체명", sensitive: false },
    { key: "consultStatus", label: "상담상태", sensitive: false },
    { key: "expectedPremium", label: "예상보험료", sensitive: true },
  ],
  contracts: [
    { key: "company", label: "보험사", sensitive: true },
    { key: "productName", label: "상품명", sensitive: true },
    { key: "productGroup", label: "상품군", sensitive: true },
    { key: "contractDate", label: "계약일", sensitive: false },
    { key: "monthlyPremium", label: "월납보험료", sensitive: true },
    { key: "paymentStatus", label: "결제상태", sensitive: false },
    { key: "contractStatus", label: "계약상태", sensitive: false },
  ],
  schedules: [
    { key: "title", label: "일정 제목", sensitive: true },
    { key: "type", label: "일정 유형", sensitive: false },
    { key: "status", label: "상태", sensitive: false },
    { key: "startTime", label: "시작시간", sensitive: false },
    { key: "customerId", label: "고객ID", sensitive: false },
  ],
  performance: [
    { key: "newContractCount", label: "신규 계약", sensitive: false },
    { key: "monthlyPremiumTotal", label: "월납보험료 합계", sensitive: true },
    { key: "consultationCount", label: "상담 수", sensitive: false },
    { key: "goalAchievementRate", label: "목표 달성률", sensitive: false },
  ],
} as const;

type DownloadType = keyof typeof downloadFieldPreview;

function neutralizeSpreadsheetFormula(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  return /^[=+\-@\t\r\n]/.test(raw) ? `'${raw}` : raw;
}

function maskDownloadValue(key: string, raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  const normalizedKey = key.toLowerCase();
  if (/phone|contact|mobile|tel/i.test(normalizedKey))
    return maskPhone(String(raw));
  if (/birth(date|day)?/i.test(normalizedKey))
    return maskBirthDateForLogs(String(raw));
  if (/email/i.test(normalizedKey)) return maskEmail(String(raw));
  if (
    /(name|product|company|premium|amount|fee|memo|note|message|content|description|disease|illness|medical)/i.test(
      normalizedKey
    )
  ) {
    return "[마스킹]";
  }
  return raw;
}

function maskDownloadRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(
    row =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          maskDownloadValue(key, value),
        ])
      ) as T
  );
}

function projectDownloadRows<T extends DownloadType>(
  type: T,
  rows: Record<string, unknown>[],
  masked: boolean
) {
  const fields = downloadFieldPreview[type];
  return rows.map(row =>
    Object.fromEntries(
      fields.map(field => {
        const value = masked
          ? maskDownloadValue(field.key, row[field.key])
          : row[field.key];
        return [field.key, neutralizeSpreadsheetFormula(value)];
      })
    )
  );
}

function assertDownloadMode(input: z.infer<typeof downloadRequestSchema>) {
  if (!input.masked && !input.rawConfirm) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Raw export requires explicit confirmation.",
    });
  }
}

function assertPushSchedulerSecret(inputSecret: string) {
  const expectedSecret = process.env.PUSH_SCHEDULER_SECRET;
  if (!expectedSecret || inputSecret !== expectedSecret) {
    console.warn("[push-scheduler] internal trigger unauthorized", {
      reason: expectedSecret ? "secret_mismatch" : "secret_missing",
    });
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid scheduler secret.",
    });
  }
}

export const appRouter = router({
  system: systemRouter,

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user?.accountStatus === "active" ? opts.ctx.user : null
    ),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  deviceTokens: router({
    register: activeUserProcedure
      .input(
        z.object({
          token: z.string().min(20).max(512),
          platform: z.enum(["android"]).default("android"),
          deviceId: z.string().max(128).optional(),
          appVersion: z.string().max(50).optional(),
          deviceModel: z.string().max(200).optional(),
          osVersion: z.string().max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const tokenHash = hashDeviceToken(input.token);
        const saved = await upsertUserDeviceToken({
          userId: ctx.user.id,
          platform: "android",
          token: input.token,
          deviceId: input.deviceId ?? null,
          appVersion: input.appVersion ?? null,
          deviceModel: input.deviceModel ?? null,
          osVersion: input.osVersion ?? null,
          isActive: true,
          lastSeenAt: new Date(),
        });
        await log(
          ctx.user.id,
          "DEVICE_TOKEN_REGISTERED",
          "user_device_token",
          saved?.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "user_device_token",
            targetId: saved?.id ?? null,
            metadata: {
              platform: "android",
              tokenHash,
              tokenMasked: maskDeviceToken(input.token),
              deviceId: input.deviceId ?? null,
              appVersion: input.appVersion ?? null,
            },
          })
        );
        return {
          success: true,
          id: saved?.id ?? null,
          tokenMasked: maskDeviceToken(input.token),
        };
      }),

    deactivate: activeUserProcedure
      .input(z.object({ token: z.string().min(20).max(512) }))
      .mutation(async ({ ctx, input }) => {
        const affectedCount = await deactivateUserDeviceToken(
          ctx.user.id,
          input.token
        );
        await log(
          ctx.user.id,
          "DEVICE_TOKEN_DEACTIVATED",
          "user_device_token",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "user_device_token",
            metadata: {
              affectedCount,
              tokenHash: hashDeviceToken(input.token),
              tokenMasked: maskDeviceToken(input.token),
            },
          })
        );
        return { success: true, affectedCount };
      }),

    listMine: activeUserProcedure.query(async ({ ctx }) => {
      const items = await listUserDeviceTokens(ctx.user.id);
      return items.map(item => ({
        id: item.id,
        platform: item.platform,
        deviceId: item.deviceId,
        appVersion: item.appVersion,
        deviceModel: item.deviceModel,
        osVersion: item.osVersion,
        isActive: item.isActive,
        lastSeenAt: item.lastSeenAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        revokedAt: item.revokedAt,
        tokenMasked: maskDeviceToken(item.token),
      }));
    }),
  }),

  // ── Users ─────────────────────────────────────────────────────────────────
  pushNotifications: router({
    getPreferences: activeUserProcedure.query(async ({ ctx }) => {
      return getPushNotificationPreference(ctx.user.id);
    }),

    updatePreferences: activeUserProcedure
      .input(
        z.object({
          followUpTodayEnabled: z.boolean().optional(),
          scheduleReminderEnabled: z.boolean().optional(),
          deleteRequestEnabled: z.boolean().optional(),
          testNotificationEnabled: z.boolean().optional(),
          quietHoursEnabled: z.boolean().optional(),
          quietHoursStart: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          quietHoursEnd: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          timezone: z.string().max(64).default("Asia/Seoul").optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return updatePushNotificationPreference(ctx.user.id, input);
      }),

    operationSummary: branchAdminProcedure
      .input(
        z
          .object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) =>
        getPushNotificationOperationSummary(
          input?.dateFrom ? new Date(input.dateFrom) : undefined,
          input?.dateTo ? new Date(input.dateTo) : undefined
        )
      ),

    logs: branchAdminProcedure
      .input(
        z
          .object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            type: z.string().optional(),
            status: z.string().optional(),
            userId: z.number().optional(),
            sourceType: z.string().optional(),
            limit: z.number().min(1).max(200).default(100),
          })
          .optional()
      )
      .query(async ({ input }) =>
        listPushNotificationLogs({
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
          type: input?.type,
          status: input?.status,
          userId: input?.userId,
          sourceType: input?.sourceType,
          limit: input?.limit ?? 100,
        })
      ),

    sendTestToMe: branchAdminProcedure
      .input(z.object({ force: z.boolean().default(false) }).optional())
      .mutation(async ({ ctx, input }) => {
        return pushNotifications.sendPushToUsers(
          [ctx.user.id],
          pushNotifications.SAFE_PUSH_PAYLOADS.test,
          {
            type: "test",
            sourceType: "user",
            sourceId: ctx.user.id,
            dedupeKey: `test:${ctx.user.id}:${Date.now()}`,
            force: input?.force ?? false,
          }
        );
      }),

    sendTodayFollowUpReminders: branchAdminProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        const date = input?.date
          ? parseKstLocalDateTime(input.date)
          : new Date();
        const dateKey = formatKstLocalDate(date);
        const rows = await getFollowUps({
          statuses: ["scheduled", "postponed"],
          dueFrom: toDayStart(date),
          dueTo: toDayEnd(date),
        });
        const results = [];
        for (const row of rows) {
          if (!row.assignedAgentId) continue;
          results.push(
            await pushNotifications.sendPushToUsers(
              [row.assignedAgentId],
              pushNotifications.SAFE_PUSH_PAYLOADS.todayFollowUp,
              {
                type: "today_follow_up",
                sourceType: "follow_up",
                sourceId: row.id,
                dedupeKey: `follow_up:${row.id}:${dateKey}:today`,
                now: date,
              }
            )
          );
        }
        return {
          success: true,
          targetCount: results.length,
          sentCount: results.reduce((sum, item) => sum + item.sentCount, 0),
          skippedCount: results.reduce(
            (sum, item) => sum + item.skippedCount + item.duplicateSkippedCount,
            0
          ),
          failureCount: results.reduce(
            (sum, item) => sum + item.failureCount,
            0
          ),
        };
      }),

    sendSchedulePushReminderEngine: branchAdminProcedure
      .input(
        z
          .object({
            now: z.string().optional(),
            lookbackMinutes: z.number().int().min(1).max(30).optional(),
          })
          .optional()
      )
      .mutation(async ({ input }) => {
        const now = input?.now ? parseKstLocalDateTime(input.now) : new Date();
        return pushNotifications.runSchedulePushReminderEngine({
          now,
          lookbackMinutes: input?.lookbackMinutes,
        });
      }),

    sendBusinessPushReminderEngine: branchAdminProcedure
      .input(z.object({ now: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        const now = input?.now ? parseKstLocalDateTime(input.now) : new Date();
        return pushNotifications.runBusinessPushReminderEngine({ now });
      }),

    /** @deprecated Use sendSchedulePushReminderEngine. */
    sendSchedule30MinuteReminders: branchAdminProcedure
      .input(
        z
          .object({
            now: z.string().optional(),
            lookbackMinutes: z.number().int().min(1).max(30).optional(),
          })
          .optional()
      )
      .mutation(async ({ input }) => {
        const now = input?.now ? parseKstLocalDateTime(input.now) : new Date();
        return pushNotifications.runSchedulePushReminderEngine({
          now,
          lookbackMinutes: input?.lookbackMinutes,
        });
      }),

    runSchedulePushReminderEngineInternal: publicProcedure
      .input(
        z.object({
          secret: z.string().min(12),
          now: z.string().optional(),
          lookbackMinutes: z.number().int().min(1).max(30).optional(),
        })
      )
      .mutation(async ({ input }) => {
        assertPushSchedulerSecret(input.secret);
        const now = input.now ? parseKstLocalDateTime(input.now) : new Date();
        return pushNotifications.runPushReminderEngines({
          now,
          lookbackMinutes: input.lookbackMinutes,
        });
      }),

    runPushReminderEnginesInternal: publicProcedure
      .input(
        z.object({
          secret: z.string().min(12),
          now: z.string().optional(),
          lookbackMinutes: z.number().int().min(1).max(30).optional(),
        })
      )
      .mutation(async ({ input }) => {
        assertPushSchedulerSecret(input.secret);
        const now = input.now ? parseKstLocalDateTime(input.now) : new Date();
        return pushNotifications.runPushReminderEngines({
          now,
          lookbackMinutes: input.lookbackMinutes,
        });
      }),
  }),

  recommendations: router({
    priorityContacts: activeUserProcedure
      .input(
        z
          .object({
            date: z.string().optional(),
            limit: z.number().min(1).max(50).default(10),
            urgency: z.enum(["high", "medium", "low"]).optional(),
            includeWarnings: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const baseDate = input?.date
          ? parseKstLocalDateTime(input.date)
          : new Date();
        const items = await buildRecommendationItems(ctx.user, baseDate);
        return items
          .filter(item => item.totalScore > 0)
          .filter(item => !input?.urgency || item.urgency === input.urgency)
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, input?.limit ?? 10)
          .map(item => ({
            ...item,
            warnings: input?.includeWarnings === false ? [] : item.warnings,
          }));
      }),

    customerWarnings: activeUserProcedure
      .input(
        z
          .object({
            customerId: z.number().optional(),
            warningTypes: z.array(z.string()).optional(),
            limit: z.number().min(1).max(100).default(50),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        if (input?.customerId)
          await verifyCustomerAccess(ctx.user, input.customerId);
        const items = await buildRecommendationItems(ctx.user, new Date());
        return items
          .filter(
            item => !input?.customerId || item.customerId === input.customerId
          )
          .flatMap(item =>
            item.warnings.map(warning => ({
              customerId: item.customerId,
              customerName: item.customerName,
              ...warning,
              detectedAt: new Date(),
            }))
          )
          .filter(
            warning =>
              !input?.warningTypes?.length ||
              input.warningTypes.includes(warning.warningType)
          )
          .slice(0, input?.limit ?? 50);
      }),

    customerContactReasons: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const items = await buildRecommendationItems(ctx.user, new Date());
        const item = items.find(entry => entry.customerId === input.customerId);
        return {
          customerId: input.customerId,
          reasons: item?.contactReasons ?? [
            {
              reasonType: "general_check",
              ...buildSafeContactReason("general_check"),
            },
          ],
          warnings: item?.warnings ?? [],
          recommendedAction: item?.recommendedAction ?? "고객 상태 점검",
          urgency: item?.urgency ?? "low",
        };
      }),

    dashboardSummary: activeUserProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const baseDate = input?.date
          ? parseKstLocalDateTime(input.date)
          : new Date();
        const items = await buildRecommendationItems(ctx.user, baseDate);
        const scored = items.filter(item => item.totalScore > 0);
        return {
          priorityContactCount: scored.length,
          highUrgencyCount: scored.filter(item => item.urgency === "high")
            .length,
          warningCount: scored.reduce(
            (sum, item) => sum + item.warnings.length,
            0
          ),
          topContacts: scored
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 5),
        };
      }),
  }),

  workRhythm: router({
    summary: activeUserProcedure
      .input(
        z
          .object({
            period: z.enum(["week", "month", "custom"]).default("week"),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            targetUserId: z.number().optional(),
            teamId: z.number().optional(),
            subBranchAdminId: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) =>
        buildWorkRhythmReport(ctx.user, input ?? { period: "week" })
      ),
  }),

  adminTeamInsights: router({
    summary: managerAnalyticsProcedure.query(async ({ ctx }) =>
      buildAdminTeamInsights(ctx.user as any)
    ),
    firstContactSla: managerAnalyticsProcedure.query(async ({ ctx }) => {
      const user = ctx.user as any;
      const scopedData = await getScopedDashboardData(user);
      const allUsers = (await getAllUsers()) as any[];
      const activeUsers = allUsers.filter(u => u.accountStatus === "active");
      const scopedUserIds =
        user.role === "branch_admin"
          ? new Set(activeUsers.map(item => item.id))
          : new Set((await getHierarchyScopeUserIds(user)) ?? [user.id]);
      const visibleUsers = activeUsers.filter(
        u => scopedUserIds.has(u.id) && u.role !== "branch_admin"
      );
      const visibleTeams = (await getAllTeams()) as any[];
      return buildFirstContactSlaInsights(
        scopedData.customerList,
        visibleUsers,
        visibleTeams
      );
    }),
    notificationFollowUpDashboard: managerAnalyticsProcedure
      .input(
        z
          .object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const user = ctx.user as any;
        const allUsers = (await getAllUsers()) as any[];
        const activeUsers = allUsers.filter(u => u.accountStatus === "active");
        const scopedUserIds =
          user.role === "branch_admin"
            ? new Set(activeUsers.map(item => item.id))
            : new Set((await getHierarchyScopeUserIds(user)) ?? [user.id]);
        const visibleUsers = activeUsers.filter(
          u => scopedUserIds.has(u.id) && u.role !== "branch_admin"
        );
        const visibleTeams = (await getAllTeams()) as any[];
        const dFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        const dTo = input?.dateTo ? new Date(input.dateTo) : undefined;
        return buildTeamCompletionInsights(
          user,
          visibleUsers,
          visibleTeams,
          dFrom,
          dTo
        );
      }),
  }),

  salesReports: router({
    filterOptions: activeUserProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      const [allUsersRaw, allTeamsRaw] = await Promise.all([
        getAllUsers(),
        getAllTeams(),
      ]);
      const allUsers = allUsersRaw as any[];
      const allTeams = allTeamsRaw as any[];
      const activeTeams = allTeams.filter(
        team => team.isActive !== false && !team.deletedAt
      );
      const activeUsers = allUsers.filter(
        item => item.accountStatus === "active"
      );

      if (user.role === "member") {
        return {
          canViewRanking: false,
          subBranches: [],
          teams: [],
          users: [
            {
              id: user.id,
              name: user.name,
              role: user.role,
              teamId: user.teamId ?? null,
              subBranchAdminId: user.subBranchAdminId ?? null,
            },
          ],
        };
      }

      const scopedUserIds =
        user.role === "branch_admin"
          ? new Set(activeUsers.map(item => item.id))
          : new Set((await getHierarchyScopeUserIds(user)) ?? [user.id]);
      const visibleUsers = activeUsers.filter(item =>
        scopedUserIds.has(item.id)
      );
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
        canViewRanking: true,
        subBranches:
          user.role === "branch_admin"
            ? activeUsers
                .filter(item => item.role === "sub_branch_admin")
                .map(item => ({
                  id: item.id,
                  name: item.name ?? `부지점 #${item.id}`,
                }))
            : [],
        teams: visibleTeams
          .map(team => ({
            id: team.id,
            name: team.name ?? `팀 #${team.id}`,
            subBranchAdminId: team.subBranchAdminId ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "ko")),
        users: visibleUsers
          .filter(item => item.role !== "branch_admin")
          .map(item => ({
            id: item.id,
            name: item.name ?? `사용자 #${item.id}`,
            role: item.role,
            teamId: item.teamId ?? null,
            subBranchAdminId: item.subBranchAdminId ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "ko")),
      };
    }),

    summary: activeUserProcedure
      .input(salesReportInputSchema.optional())
      .query(async ({ ctx, input }) => buildSalesReport(ctx.user, input ?? {})),

    funnelSummary: activeUserProcedure
      .input(salesReportInputSchema.optional())
      .query(async ({ ctx, input }) => {
        const report = await buildSalesReport(ctx.user, input ?? {});
        return {
          scope: report.scope,
          period: report.period,
          funnel: report.funnel,
          empty: report.empty,
        };
      }),

    performanceSummary: activeUserProcedure
      .input(salesReportInputSchema.optional())
      .query(async ({ ctx, input }) => {
        const report = await buildSalesReport(ctx.user, input ?? {});
        return {
          scope: report.scope,
          period: report.period,
          performance: report.performance,
          empty: report.empty,
        };
      }),

    memberRanking: activeUserProcedure
      .input(salesReportInputSchema.optional())
      .query(async ({ ctx, input }) => {
        const report = await buildSalesReport(ctx.user, input ?? {});
        return {
          scope: report.scope,
          period: report.period,
          ranking: report.ranking,
        };
      }),

    bottleneckSummary: activeUserProcedure
      .input(salesReportInputSchema.optional())
      .query(async ({ ctx, input }) => {
        const report = await buildSalesReport(ctx.user, input ?? {});
        return {
          scope: report.scope,
          period: report.period,
          bottleneck: report.bottleneck,
        };
      }),
  }),

  analytics: router({
    funnelFilterOptions: managerAnalyticsProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      const [allUsers, allTeams] = await Promise.all([
        getAllUsers(),
        getAllTeams(),
      ]);
      const teamsOut: { id: number; name: string }[] = [];
      const agentsOut: {
        id: number;
        name: string | null;
        teamId: number | null;
      }[] = [];

      if (user.role === "branch_admin") {
        for (const t of allTeams as any[]) {
          if (t.isActive === false) continue;
          if (t.deletedAt) continue;
          teamsOut.push({ id: t.id, name: t.name ?? `팀 ${t.id}` });
        }
        for (const u of allUsers) {
          if (u.accountStatus !== "active") continue;
          if (u.role === "member" || u.role === "team_leader") {
            agentsOut.push({
              id: u.id,
              name: u.name ?? null,
              teamId: u.teamId ?? null,
            });
          }
        }
      } else if (user.role === "sub_branch_admin") {
        const orgUsers = ensureOrgUsers(allUsers as OrgUser[], user);
        const visible = new Set(
          descendantUserIdsFrom(user.id, orgUsers, allTeams as OrgTeam[], true)
        );
        for (const t of allTeams as any[]) {
          if (t.isActive === false || t.deletedAt) continue;
          if ((t as any).subBranchAdminId !== user.id) continue;
          teamsOut.push({ id: t.id, name: t.name ?? `팀 ${t.id}` });
        }
        for (const u of allUsers) {
          if (!visible.has(u.id)) continue;
          if (u.accountStatus !== "active") continue;
          if (u.role === "member" || u.role === "team_leader") {
            agentsOut.push({
              id: u.id,
              name: u.name ?? null,
              teamId: u.teamId ?? null,
            });
          }
        }
      } else {
        if (!user.teamId) return { teams: [], agents: [] };
        const team = await getTeamById(user.teamId);
        if (
          team &&
          (team as any).isActive !== false &&
          !(team as any).deletedAt
        ) {
          teamsOut.push({
            id: team.id,
            name: (team as any).name ?? `팀 ${team.id}`,
          });
        }
        const members = await getUsersByTeamId(user.teamId);
        const memberIds = new Set(members.map(m => m.id));
        for (const u of allUsers) {
          if (!memberIds.has(u.id)) continue;
          if (u.accountStatus !== "active" || u.role !== "member") continue;
          agentsOut.push({
            id: u.id,
            name: u.name ?? null,
            teamId: user.teamId,
          });
        }
      }

      teamsOut.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      agentsOut.sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "ko")
      );
      return { teams: teamsOut, agents: agentsOut };
    }),

    salesFunnel: managerAnalyticsProcedure
      .input(
        z.object({
          teamId: z.number().nullable().optional(),
          agentId: z.number().nullable().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        let agentIdIn: number[] | undefined =
          user.role === "branch_admin"
            ? undefined
            : ((await getHierarchyScopeUserIds(user)) ?? [user.id]);

        if (input.teamId != null) {
          await verifyTeamFilterAccess(user, input.teamId);
          const teamUsers = await getUsersByTeamId(input.teamId);
          const teamAgentIds = teamUsers.map(u => u.id);
          if (teamAgentIds.length === 0) {
            agentIdIn = [];
          } else if (agentIdIn === undefined) {
            agentIdIn = teamAgentIds;
          } else {
            const allow = new Set(teamAgentIds);
            agentIdIn = agentIdIn.filter(id => allow.has(id));
          }
        }

        if (input.agentId != null) {
          const target = await getUserById(input.agentId);
          if (!target)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "담당자를 찾을 수 없습니다.",
            });
          const inScope =
            user.role === "branch_admin" ||
            (agentIdIn !== undefined && agentIdIn.includes(input.agentId));
          if (!inScope) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "선택한 담당자는 조회 범위에 없습니다.",
            });
          }
          agentIdIn = [input.agentId];
        }

        return getSalesFunnelAggregates(agentIdIn);
      }),
  }),

  users: router({
    list: activeUserProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const all = await getAllUsers();
        if (ctx.user.role === "branch_admin")
          return input?.activeOnly
            ? all.filter(u => u.accountStatus === "active")
            : all;
        // 비활성 사용자 제외 후 반환
        if (
          ctx.user.role === "sub_branch_admin" ||
          ctx.user.role === "team_leader"
        ) {
          const teams = await getAllTeams();
          const ids = new Set(
            descendantUserIdsFrom(
              ctx.user.id,
              all as OrgUser[],
              teams as OrgTeam[],
              true
            )
          );
          return all
            .filter(u => u.accountStatus === "active" && ids.has(u.id))
            .map(toMinimalUser);
        }
        return [toMinimalUser(ctx.user)];
      }),

    updateRole: branchAdminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum([
            "branch_admin",
            "sub_branch_admin",
            "team_leader",
            "member",
          ]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existingForRole = await getUserById(input.userId);
        const previousRole = existingForRole?.role ?? null;
        await updateUserRole(input.userId, input.role);
        await log(
          ctx.user.id,
          "USER_ROLE_CHANGED",
          "user",
          input.userId,
          JSON.stringify({
            actor: ctx.user.id,
            targetUserId: input.userId,
            previousRole,
            newRole: input.role,
            beforeValue: { role: previousRole },
            afterValue: { role: input.role },
          })
        );
        return { success: true };
      }),

    create: branchAdminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          role: z.enum([
            "branch_admin",
            "sub_branch_admin",
            "team_leader",
            "member",
          ]),
          accountStatus: z
            .enum(["active", "inactive", "resigned"])
            .default("active"),
          teamId: z.number().nullable().optional(),
          subBranchAdminId: z.number().nullable().optional(),
          phone: z.string().optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 조건 2: 이메일 중복 검증
        const existing = await getUserByEmail(input.email);
        if (existing)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 등록된 이메일입니다.",
          });
        // 조건 4: 역할별 조직 정합성 검증
        let resolvedSubBranchAdminId = input.subBranchAdminId ?? null;
        const resolvedTeamId = input.teamId ?? null;
        if (resolvedTeamId) {
          const team = await getTeamById(resolvedTeamId);
          if (team)
            resolvedSubBranchAdminId = (team as any).subBranchAdminId ?? null;
        }
        if (["branch_admin", "sub_branch_admin"].includes(input.role)) {
          resolvedSubBranchAdminId = null;
        }
        const newUser = await createUser({
          name: input.name,
          email: input.email,
          role: input.role,
          accountStatus: input.accountStatus,
          loginStatus: "invited",
          teamId: resolvedTeamId,
          subBranchAdminId: resolvedSubBranchAdminId,
          phone: input.phone,
          memo: input.memo,
        });
        if (!newUser)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "사용자 생성에 실패했습니다.",
          });
        await log(
          ctx.user.id,
          "USER_CREATED",
          "user",
          newUser.id,
          JSON.stringify({
            actor: ctx.user.id,
            beforeValue: null,
            afterValue: {
              targetUserId: newUser.id,
              name: input.name,
              email: input.email,
              role: input.role,
              accountStatus: input.accountStatus,
              loginStatus: "invited",
              subBranchAdminId: resolvedSubBranchAdminId,
              teamId: resolvedTeamId,
              phone: input.phone ?? null,
              memo: input.memo ?? null,
            },
          })
        );
        return { success: true, userId: newUser.id };
      }),

    updateAccountStatus: branchAdminProcedure
      .input(
        z.object({
          userId: z.number(),
          accountStatus: z.enum(["active", "inactive", "resigned"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateUserAccountStatus(input.userId, input.accountStatus);
        const action =
          input.accountStatus !== "active" ? "USER_BLOCKED" : "USER_ACTIVATED";
        await log(
          ctx.user.id,
          action,
          "user",
          input.userId,
          `accountStatus=${input.accountStatus}`
        );
        return { success: true };
      }),

    updatePermission: branchAdminProcedure
      .input(
        z.object({
          userId: z.number(),
          permission: z.literal(CUSTOMER_BULK_IMPORT_PERMISSION),
          enabled: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const target = await getUserById(input.userId);
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다.",
          });
        if (
          target.role !== "sub_branch_admin" &&
          target.role !== "team_leader"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "고객 일괄 등록 권한은 부지점장 또는 팀장에게만 부여할 수 있습니다.",
          });
        }
        if (input.enabled && target.accountStatus !== "active") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "비활성/퇴사 계정에는 권한을 부여할 수 없습니다.",
          });
        }

        await setUserPermission(
          input.userId,
          input.permission,
          input.enabled,
          ctx.user.id
        );
        await log(
          ctx.user.id,
          input.enabled ? "USER_PERMISSION_GRANTED" : "USER_PERMISSION_REVOKED",
          "user",
          input.userId,
          JSON.stringify({
            actor: ctx.user.id,
            targetUserId: input.userId,
            permission: input.permission,
            enabled: input.enabled,
          })
        );
        return { success: true };
      }),

    updateTeam: branchAdminProcedure
      .input(z.object({ userId: z.number(), teamId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const existingUserForTeam = await getUserById(input.userId);
        const previousTeamId = existingUserForTeam?.teamId ?? null;
        const previousSubBranchAdminId =
          existingUserForTeam?.subBranchAdminId ?? null;
        await updateUserTeam(input.userId, input.teamId);
        // 새 팀의 subBranchAdminId 조회 (자동 동기화 후)
        const newUserState = await getUserById(input.userId);
        const newSubBranchAdminId = newUserState?.subBranchAdminId ?? null;
        // 로그 분기: 최초 배치 vs 팀 이동
        const teamLogAction =
          previousTeamId === null
            ? "MEMBER_ASSIGNED_TO_TEAM"
            : "USER_MOVED_TO_ANOTHER_TEAM";
        await log(
          ctx.user.id,
          teamLogAction,
          "user",
          input.userId,
          JSON.stringify({
            actor: ctx.user.id,
            targetUserId: input.userId,
            previousTeamId,
            newTeamId: input.teamId,
            previousSubBranchAdminId,
            newSubBranchAdminId,
            beforeValue: {
              teamId: previousTeamId,
              subBranchAdminId: previousSubBranchAdminId,
            },
            afterValue: {
              teamId: input.teamId,
              subBranchAdminId: newSubBranchAdminId,
            },
          })
        );
        // 부지점장 산하가 자동 동기화된 경우 추가 로그
        if (previousSubBranchAdminId !== newSubBranchAdminId) {
          await log(
            ctx.user.id,
            "USER_MOVED_TO_ANOTHER_SUB_BRANCH",
            "user",
            input.userId,
            JSON.stringify({
              actor: ctx.user.id,
              targetUserId: input.userId,
              previousSubBranchAdminId,
              newSubBranchAdminId,
              reason: "team_change_auto_sync",
              previousTeamId,
              newTeamId: input.teamId,
            })
          );
        }
        await log(
          ctx.user.id,
          "USER_TEAM_CHANGED",
          "user",
          input.userId,
          `teamId=${input.teamId}`
        );
        return { success: true };
      }),

    updateSubBranchAdmin: branchAdminProcedure
      .input(
        z.object({
          userId: z.number(),
          subBranchAdminId: z.number().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 조건 6: 서버 레벨 불일치 차단 - teamId가 있으면 해당 팀의 subBranchAdminId와 일치 확인
        const existingUser = await getUserById(input.userId); // 수정 전 먼저 조회 (before 값 정확성)
        if (existingUser?.teamId && input.subBranchAdminId !== null) {
          const team = await getTeamById(existingUser.teamId);
          if (
            team &&
            (team as any).subBranchAdminId !== null &&
            (team as any).subBranchAdminId !== input.subBranchAdminId
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "사용자의 소속 팀과 부지점장 산하 정보가 일치하지 않습니다. 팀 이동과 함께 처리해야 합니다.",
            });
          }
        }
        const previousSubBranchAdminId = existingUser?.subBranchAdminId ?? null;
        await updateUserSubBranchAdmin(input.userId, input.subBranchAdminId);
        await log(
          ctx.user.id,
          "SUB_BRANCH_ADMIN_ASSIGNED",
          "user",
          input.userId,
          JSON.stringify({
            before: { subBranchAdminId: previousSubBranchAdminId },
            after: { subBranchAdminId: input.subBranchAdminId },
          })
        );
        await log(
          ctx.user.id,
          "USER_MOVED_TO_ANOTHER_SUB_BRANCH",
          "user",
          input.userId,
          JSON.stringify({
            actor: ctx.user.id,
            targetUserId: input.userId,
            previousSubBranchAdminId,
            newSubBranchAdminId: input.subBranchAdminId,
          })
        );
        return { success: true };
      }),

    organizationTree: activeUserProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "member")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "조직 관리는 팀장 이상만 접근 가능합니다.",
        });
      return buildOrganizationTree(ctx.user);
    }),

    assignableParents: branchAdminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const [target, allUsers, teams] = await Promise.all([
          getUserById(input.userId),
          getAllUsers(),
          getAllTeams(),
        ]);
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다.",
          });
        if (target.accountStatus !== "active") return [];
        return (allUsers as OrgUser[])
          .filter(
            candidate =>
              candidate.accountStatus === "active" && candidate.id !== target.id
          )
          .filter(candidate =>
            isAllowedParentForRole(target.role, candidate.role)
          )
          .filter(
            candidate =>
              !descendantUserIdsFrom(
                target.id,
                allUsers as OrgUser[],
                teams as OrgTeam[],
                false
              ).includes(candidate.id)
          )
          .map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            role: candidate.role,
            accountStatus: candidate.accountStatus,
          }));
      }),

    updateParent: branchAdminProcedure
      .input(
        z.object({ userId: z.number(), parentUserId: z.number().nullable() })
      )
      .mutation(async ({ ctx, input }) => {
        const [target, parent, allUsers, teams] = await Promise.all([
          getUserById(input.userId),
          input.parentUserId === null
            ? Promise.resolve(null)
            : getUserById(input.parentUserId),
          getAllUsers(),
          getAllTeams(),
        ]);
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다.",
          });
        if (target.accountStatus !== "active")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "비활성/퇴사 사용자는 조직 배정 대상이 아닙니다.",
          });
        if (input.parentUserId === input.userId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "자기 자신을 상위자로 지정할 수 없습니다.",
          });
        if (input.parentUserId !== null && !parent)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "상위 사용자를 찾을 수 없습니다.",
          });
        if (parent && parent.accountStatus !== "active")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "비활성/퇴사 사용자는 상위자로 지정할 수 없습니다.",
          });
        const parentRole = parent?.role ?? null;
        if (!isAllowedParentForRole(target.role, parentRole)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "해당 역할에 허용되지 않는 상위자입니다.",
          });
        }
        if (
          input.parentUserId !== null &&
          descendantUserIdsFrom(
            target.id,
            allUsers as OrgUser[],
            teams as OrgTeam[],
            false
          ).includes(input.parentUserId)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "순환 조직 구조는 만들 수 없습니다.",
          });
        }
        const nextTeamId =
          parent?.role === "team_leader" ? (parent.teamId ?? null) : null;
        const nextSubBranchAdminId =
          parent?.role === "sub_branch_admin"
            ? parent.id
            : parent?.role === "team_leader"
              ? (parent.subBranchAdminId ?? null)
              : null;
        await updateUserOrganization(input.userId, {
          parentUserId: input.parentUserId,
          teamId: nextTeamId,
          subBranchAdminId: nextSubBranchAdminId,
        });
        await log(
          ctx.user.id,
          "USER_ORG_PARENT_CHANGED",
          "user",
          input.userId,
          logDetails({
            actor: ctx.user.id,
            targetType: "user",
            targetId: input.userId,
            beforeValue: {
              parentUserId: (target as any).parentUserId ?? null,
              teamId: target.teamId ?? null,
              subBranchAdminId: target.subBranchAdminId ?? null,
            },
            afterValue: {
              parentUserId: input.parentUserId,
              teamId: nextTeamId,
              subBranchAdminId: nextSubBranchAdminId,
            },
          })
        );
        return { success: true };
      }),

    teams: activeUserProcedure.query(async () => getAllTeams()),

    createTeam: branchAdminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          managerId: z.number().optional(),
          subBranchAdminId: z.number().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createTeam(
          input.name,
          input.managerId,
          input.subBranchAdminId,
          input.description
        );
        await log(
          ctx.user.id,
          "TEAM_CREATED",
          "team",
          undefined,
          `name=${input.name}`
        );
        return { success: true };
      }),

    updateTeamInfo: branchAdminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          managerId: z.number().optional().nullable(),
          subBranchAdminId: z.number().optional().nullable(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const existing = await getTeamById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (data.isActive === false) {
          await assertTeamCanBeDeactivated(id);
        }
        const updateData =
          data.isActive === false ? { ...data, deletedAt: new Date() } : data;
        await updateTeam(id, updateData);

        if (data.isActive === false) {
          await log(
            ctx.user.id,
            "TEAM_DEACTIVATED",
            "team",
            id,
            logDetails({
              actor: ctx.user.id,
              targetId: id,
              targetType: "team",
              beforeValue: {
                isActive: existing?.isActive ?? null,
                deletedAt: (existing as any)?.deletedAt ?? null,
              },
              afterValue: { isActive: false },
              metadata: { deleteMode: "soft" },
            })
          );
        } else if (data.managerId !== undefined) {
          const previousManagerId = existing?.managerId ?? null;
          await log(
            ctx.user.id,
            "TEAM_LEADER_ASSIGNED",
            "team",
            id,
            JSON.stringify({
              actor: ctx.user.id,
              teamId: id,
              previousTeamLeaderId: previousManagerId,
              newTeamLeaderId: data.managerId,
              beforeValue: { managerId: previousManagerId },
              afterValue: { managerId: data.managerId },
            })
          );
        } else {
          await log(
            ctx.user.id,
            "TEAM_UPDATED",
            "team",
            id,
            JSON.stringify({ before: existing, after: data })
          );
        }
        return { success: true };
      }),

    deactivateTeam: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertTeamCanBeDeactivated(input.id);
        await deactivateTeam(input.id);
        await log(
          ctx.user.id,
          "TEAM_DEACTIVATED",
          "team",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "team",
            beforeValue: {
              isActive: existing.isActive,
              deletedAt: (existing as any).deletedAt ?? null,
            },
            afterValue: { isActive: false },
            metadata: { deleteMode: "soft" },
          })
        );
        return { success: true };
      }),
  }),

  // ── Admin Security ────────────────────────────────────────────────────────
  adminSecurity: router({
    forceLogoutUser: branchAdminProcedure
      .input(
        z.object({
          userId: z.number(),
          reason: z.string().min(1).max(500),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const target = await getUserById(input.userId);
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다.",
          });

        const invalidatedAt = new Date();
        const affectedSessionCount = await invalidateUserSessions(
          input.userId,
          invalidatedAt
        );
        const deactivatedDeviceTokenCount = await deactivateAllUserDeviceTokens(
          input.userId
        );
        await log(
          ctx.user.id,
          "USER_FORCE_LOGOUT",
          "user",
          input.userId,
          logDetails({
            actor: ctx.user.id,
            targetId: input.userId,
            targetType: "user",
            beforeValue: {
              sessionInvalidatedAt: target.sessionInvalidatedAt ?? null,
            },
            afterValue: { sessionInvalidatedAt: invalidatedAt },
            metadata: {
              reason: input.reason,
              affectedSessionCount,
              deactivatedDeviceTokenCount,
            },
          })
        );

        return { success: true, affectedSessionCount };
      }),

    forceLogoutAll: branchAdminProcedure
      .input(
        z.object({
          reason: z.string().min(1).max(500),
          confirmText: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== ALL_FORCE_LOGOUT_CONFIRM_TEXT) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "확인 문구가 일치하지 않습니다.",
          });
        }

        const invalidatedAt = new Date();
        const affectedSessionCount =
          await invalidateAllUserSessions(invalidatedAt);
        const users = await getAllUsers();
        let deactivatedDeviceTokenCount = 0;
        for (const user of users) {
          deactivatedDeviceTokenCount += await deactivateAllUserDeviceTokens(
            user.id
          );
        }
        await log(
          ctx.user.id,
          "ALL_USERS_FORCE_LOGOUT",
          "user",
          ctx.user.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "user",
            metadata: {
              reason: input.reason,
              affectedSessionCount,
              deactivatedDeviceTokenCount,
              sessionInvalidatedAt: invalidatedAt,
            },
          })
        );

        return { success: true, affectedSessionCount };
      }),

    resetOAuthLink: branchAdminProcedure
      .input(
        z.object({
          userId: z.number(),
          reason: z.string().min(1).max(500),
          confirmText: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== OAUTH_RESET_CONFIRM_TEXT) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "확인 문구가 일치하지 않습니다.",
          });
        }

        const target = await getUserById(input.userId);
        if (!target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다.",
          });

        const beforeLoginStatus = target.loginStatus ?? null;
        const beforeOpenIdState = target.openId?.startsWith("invited_")
          ? "invited"
          : target.openId
            ? "linked"
            : "empty";
        await resetUserOAuthLink(input.userId);
        await log(
          ctx.user.id,
          "USER_OAUTH_RESET",
          "user",
          input.userId,
          logDetails({
            actor: ctx.user.id,
            targetId: input.userId,
            targetType: "user",
            beforeValue: {
              loginStatus: beforeLoginStatus,
              openIdState: beforeOpenIdState,
            },
            afterValue: {
              loginStatus: "invited",
              openIdState: "invited",
              sessionInvalidated: true,
            },
            metadata: { reason: input.reason, openIdReset: true },
          })
        );

        return { success: true };
      }),

    loginHistory: branchAdminProcedure
      .input(
        z
          .object({
            action: z.string().optional(),
            userId: z.number().optional(),
            search: z.string().optional(),
            limit: z.number().min(1).max(500).default(100),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const entries = await getActivityLogs(1000);
        const users = await getAllUsers();
        const usersById = new Map(users.map(user => [user.id, user]));
        const search = input?.search?.trim().toLowerCase();

        return entries
          .filter(entry => LOGIN_HISTORY_ACTIONS.has(entry.action))
          .filter(entry => !input?.action || entry.action === input.action)
          .filter(
            entry =>
              !input?.userId ||
              entry.userId === input.userId ||
              entry.targetId === input.userId
          )
          .map(entry => {
            const targetUser = usersById.get(entry.targetId ?? entry.userId);
            const actor = usersById.get(entry.userId);
            let details: Record<string, unknown> = {};
            try {
              details = entry.details ? JSON.parse(entry.details) : {};
            } catch {
              details = {};
            }
            return {
              id: entry.id,
              createdAt: entry.createdAt,
              action: entry.action,
              targetId: entry.targetId,
              targetType: entry.targetType,
              user: targetUser
                ? {
                    id: targetUser.id,
                    name: targetUser.name,
                    email: targetUser.email
                      ? maskEmail(targetUser.email)
                      : null,
                    role: targetUser.role,
                    accountStatus: targetUser.accountStatus,
                    loginStatus: targetUser.loginStatus,
                  }
                : null,
              actor: actor
                ? { id: actor.id, name: actor.name, role: actor.role }
                : null,
              details,
            };
          })
          .filter(entry => {
            if (!search) return true;
            return [
              entry.action,
              entry.user?.name ?? "",
              entry.user?.email ?? "",
              entry.actor?.name ?? "",
            ].some(value => value.toLowerCase().includes(search));
          })
          .slice(0, input?.limit ?? 100);
      }),
  }),

  adminHandoff: router({
    listUsers: branchAdminProcedure.query(async ({ ctx }) => {
      const allUsers = await getAllUsers();
      return allUsers
        .filter(user => user.id !== ctx.user.id)
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email ? maskEmail(user.email) : null,
          role: user.role,
          accountStatus: user.accountStatus,
          teamId: user.teamId,
          subBranchAdminId: user.subBranchAdminId,
        }));
    }),

    preview: branchAdminProcedure
      .input(z.object({ sourceUserId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (input.sourceUserId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "본인 계정은 인수인계 대상으로 선택할 수 없습니다.",
          });
        }
        const preview = await getHandoffPreview(input.sourceUserId);
        if (!preview)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다.",
          });
        await log(
          ctx.user.id,
          "USER_HANDOFF_PREVIEWED",
          "user",
          input.sourceUserId,
          logDetails({
            actor: ctx.user.id,
            targetType: "user",
            targetId: input.sourceUserId,
            metadata: { counts: preview.counts },
          })
        );
        return preview;
      }),

    execute: branchAdminProcedure
      .input(
        z.object({
          sourceUserId: z.number(),
          targetUserId: z.number(),
          transferCustomers: z.boolean(),
          transferFollowUps: z.boolean(),
          transferSchedules: z.boolean(),
          transferNotifications: z.boolean(),
          updateSourceAccountStatus: z.enum(["keep", "inactive", "resigned"]),
          forceLogoutSource: z.boolean(),
          resetOAuthSource: z.boolean(),
          reason: z.string().min(5).max(300),
          confirmText: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== "인수인계") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "확인 문구가 일치하지 않습니다.",
          });
        }
        if (input.sourceUserId === input.targetUserId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이관 대상자와 새 담당자가 같습니다.",
          });
        }
        if (input.sourceUserId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "본인 계정은 인수인계 대상으로 선택할 수 없습니다.",
          });
        }

        const source = await getUserById(input.sourceUserId);
        const target = await getUserById(input.targetUserId);
        if (!source || !target)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다.",
          });
        if (target.accountStatus !== "active") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "새 담당자는 active 상태여야 합니다.",
          });
        }
        if (target.role !== "member" && target.role !== "team_leader") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "고객 담당자는 active team_leader 또는 member만 지정할 수 있습니다.",
          });
        }
        if (!target.teamId || !target.subBranchAdminId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "새 담당자의 팀과 부지점장 정보가 필요합니다.",
          });
        }

        const result = await executeUserHandoff({
          ...input,
          executedBy: ctx.user.id,
        });
        if (!result)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "인수인계 처리에 실패했습니다.",
          });
        return result;
      }),

    history: branchAdminProcedure
      .input(
        z
          .object({
            sourceUserId: z.number().optional(),
            targetUserId: z.number().optional(),
            limit: z.number().min(1).max(200).default(50),
          })
          .optional()
      )
      .query(async ({ input }) => getHandoffHistories(input)),
  }),

  adminAudit: router({
    summary: branchAdminProcedure.query(async () => {
      const [
        users,
        activeCustomers,
        deletedCustomers,
        activeContracts,
        deletedContracts,
        notifications,
        logs,
      ] = await Promise.all([
        getAllUsers(),
        getCustomers({}),
        getDeletedCustomers(),
        getAllContracts({}),
        getDeletedContracts(),
        getAllNotifications(),
        getActivityLogs(2000),
      ]);

      const now = new Date();
      const todayStart = toDayStart(now);
      const todayEnd = toDayEnd(now);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentLogs = logs.filter(
        entry => new Date(entry.createdAt).getTime() >= sevenDaysAgo.getTime()
      );

      const recentRiskEvents = recentLogs
        .filter(entry => RISK_ACTIONS.has(entry.action))
        .slice(0, 10)
        .map(entry => {
          const details = summarizeLogDetails(entry.details);
          return {
            id: entry.id,
            createdAt: entry.createdAt,
            actorId: entry.userId,
            action: entry.action,
            targetType: entry.targetType,
            targetId: entry.targetId,
            riskLevel: getRiskLevel(entry.action),
            reason: details.reason,
            summary: details.summary,
          };
        });

      return {
        cards: {
          activeUsers: users.filter(user => user.accountStatus === "active")
            .length,
          inactiveUsers: users.filter(user => user.accountStatus === "inactive")
            .length,
          resignedUsers: users.filter(user => user.accountStatus === "resigned")
            .length,
          activeCustomers: activeCustomers.length,
          softDeletedCustomers: deletedCustomers.length,
          activeContracts: activeContracts.length,
          softDeletedContracts: deletedContracts.length,
          unreadNotifications: notifications.filter(
            notification =>
              !notification.isRead || notification.processStatus === "미확인"
          ).length,
          todayCustomers: activeCustomers.filter(customer =>
            isWithinDateRange(
              new Date(customer.createdAt),
              todayStart,
              todayEnd
            )
          ).length,
          todayContracts: activeContracts.filter(contract =>
            isWithinDateRange(
              new Date(contract.createdAt),
              todayStart,
              todayEnd
            )
          ).length,
          recentDownloads: recentLogs.filter(entry =>
            DOWNLOAD_ACTIONS.has(entry.action)
          ).length,
          recentDeleteRestore: recentLogs.filter(entry =>
            DELETE_AUDIT_ACTIONS.has(entry.action)
          ).length,
          recentLoginBlocked: recentLogs.filter(
            entry => entry.action === "LOGIN_BLOCKED"
          ).length,
          recentSecurityActions: recentLogs.filter(
            entry =>
              entry.action === "USER_OAUTH_RESET" ||
              entry.action === "USER_FORCE_LOGOUT" ||
              entry.action === "ALL_USERS_FORCE_LOGOUT"
          ).length,
        },
        recentRiskEvents,
      };
    }),

    logSearch: branchAdminProcedure
      .input(
        z
          .object({
            datePreset: z.enum(["today", "7d", "30d", "custom"]).optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            actorId: z.number().optional(),
            action: z.string().optional(),
            targetType: z.string().optional(),
            category: z
              .enum([
                "download",
                "delete",
                "security",
                "customer",
                "contract",
                "user",
              ])
              .optional(),
            riskOnly: z.boolean().optional(),
            search: z.string().optional(),
            limit: z.number().min(1).max(200).default(50),
            offset: z.number().min(0).default(0),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const logs = await getActivityLogs(2000);
        const users = await getAllUsers();
        const usersById = new Map(users.map(user => [user.id, user]));
        const now = new Date();
        let dateFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        let dateTo = input?.dateTo
          ? toDayEnd(new Date(input.dateTo))
          : undefined;
        if (input?.datePreset === "today") {
          dateFrom = toDayStart(now);
          dateTo = toDayEnd(now);
        } else if (input?.datePreset === "7d") {
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (input?.datePreset === "30d") {
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        const search = input?.search?.trim().toLowerCase();

        const matchesCategory = (entry: {
          action: string;
          targetType: string | null;
        }) => {
          if (!input?.category) return true;
          if (input.category === "download")
            return DOWNLOAD_ACTIONS.has(entry.action);
          if (input.category === "delete")
            return DELETE_AUDIT_ACTIONS.has(entry.action);
          if (input.category === "security")
            return SECURITY_AUDIT_ACTIONS.has(entry.action);
          return entry.targetType === input.category;
        };

        const filtered = logs
          .filter(entry =>
            isWithinDateRange(new Date(entry.createdAt), dateFrom, dateTo)
          )
          .filter(entry => !input?.actorId || entry.userId === input.actorId)
          .filter(entry => !input?.action || entry.action === input.action)
          .filter(
            entry => !input?.targetType || entry.targetType === input.targetType
          )
          .filter(entry => !input?.riskOnly || RISK_ACTIONS.has(entry.action))
          .filter(matchesCategory)
          .map(entry => {
            const actor = usersById.get(entry.userId);
            const details = summarizeLogDetails(entry.details);
            return {
              id: entry.id,
              createdAt: entry.createdAt,
              actor: actor
                ? {
                    id: actor.id,
                    name: actor.name,
                    email: actor.email ? maskEmail(actor.email) : null,
                    role: actor.role,
                  }
                : null,
              action: entry.action,
              targetType: entry.targetType,
              targetId: entry.targetId,
              riskLevel: getRiskLevel(entry.action),
              reason: details.reason,
              summary: details.summary,
            };
          })
          .filter(entry => {
            if (!search) return true;
            return [
              entry.action,
              entry.targetType ?? "",
              String(entry.targetId ?? ""),
              entry.actor?.name ?? "",
              entry.actor?.email ?? "",
              entry.reason ?? "",
              entry.summary ?? "",
            ].some(value => value.toLowerCase().includes(search));
          });

        const offset = input?.offset ?? 0;
        const limit = input?.limit ?? 50;
        return {
          items: filtered.slice(offset, offset + limit),
          total: filtered.length,
          hasMore: offset + limit < filtered.length,
        };
      }),
  }),

  // ── Customers ─────────────────────────────────────────────────────────────
  operationRisk: router({
    summary: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(async ({ input }) => buildOperationRiskReport(input)),
    riskEvents: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(
        async ({ input }) =>
          (await buildOperationRiskReport(input)).recentRiskEvents
      ),
    downloadRisk: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(
        async ({ input }) =>
          (await buildOperationRiskReport(input)).downloadRisk
      ),
    accountRisk: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(
        async ({ input }) => (await buildOperationRiskReport(input)).accountRisk
      ),
    deletionRisk: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(
        async ({ input }) =>
          (await buildOperationRiskReport(input)).deletionRisk
      ),
    handoffRisk: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(
        async ({ input }) => (await buildOperationRiskReport(input)).handoffRisk
      ),
    pushRisk: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(
        async ({ input }) => (await buildOperationRiskReport(input)).pushRisk
      ),
    unresolvedWorkRisk: branchAdminProcedure
      .input(operationRiskPeriodInput)
      .query(
        async ({ input }) =>
          (await buildOperationRiskReport(input)).unresolvedWorkRisk
      ),
    scopedSummary: activeUserProcedure
      .input(operationRiskPeriodInput)
      .query(async ({ ctx, input }) =>
        buildScopedOperationRiskSummary(ctx.user, input)
      ),
  }),

  customers: router({
    list: activeUserProcedure
      .input(
        z.object({
          status: z.string().optional(),
          search: z.string().optional(),
          unassigned: z.boolean().optional(),
          assignmentStatus: z
            .enum(["unassigned", "assigned_to_sub_branch", "assigned_to_agent"])
            .optional(),
          region: z.string().optional(),
          source: z.string().optional(),
          dbCompany: z.string().optional(),
          priority: z.enum(CUSTOMER_PRIORITIES).optional(),
          tag: z.enum(CUSTOMER_TAGS).optional(),
          nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
          agentIdFilter: z.number().optional(),
          assignedDateFrom: z.string().optional(),
          assignedDateTo: z.string().optional(),
          scope: z.enum(["all", "mine", "member"]).optional(),
          selectedUserId: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (input.scope === "all" && user.role === "member") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "전체 DB는 지점장만 조회할 수 있습니다.",
          });
        }
        const baseFilter = {
          search: input.search?.trim() || undefined,
          status: input.status,
          unassigned: input.unassigned,
          assignmentStatus: input.assignmentStatus,
          region: input.region,
          source: input.source,
          dbCompany: input.dbCompany,
          priority: input.priority,
          tag: input.tag,
          nextAction: input.nextAction,
          assignedDateFrom: input.assignedDateFrom
            ? new Date(input.assignedDateFrom)
            : undefined,
          assignedDateTo: input.assignedDateTo
            ? new Date(input.assignedDateTo)
            : undefined,
        };
        if (input.scope === "member") {
          if (input.selectedUserId == null) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Select a member to view.",
            });
          }
          const target = await verifyTargetUserAccess(
            user,
            input.selectedUserId
          );
          return getCustomers({ ...baseFilter, agentId: target.id });
        }
        if (user.role === "branch_admin") {
          const scopedAgentId =
            input.scope === "mine" ? user.id : input.agentIdFilter;
          return getCustomers({ ...baseFilter, agentId: scopedAgentId });
        }
        if (user.role === "sub_branch_admin" || user.role === "team_leader") {
          if (input.scope === "mine")
            return getCustomers({ ...baseFilter, agentId: user.id });
          if (user.role === "team_leader" && user.teamId)
            return getCustomers({ ...baseFilter, teamId: user.teamId });
          if (user.role === "sub_branch_admin")
            return getCustomers({ ...baseFilter, subBranchAdminId: user.id });
          const agentIds = await getHierarchyScopeUserIds(user);
          return getCustomers({ ...baseFilter, agentIds });
        }
        return getCustomers({ ...baseFilter, agentId: user.id });
      }),

    searchForSchedulePicker: activeUserProcedure
      .input(
        z.object({
          search: z.string().max(100).optional(),
          limit: z.number().int().min(1).max(20).default(20),
          selectedCustomerId: z.number().int().positive().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { searchCustomersForSchedulePicker } = await import(
          "./scheduleCustomerPicker"
        );
        return searchCustomersForSchedulePicker(ctx.user, input);
      }),

    get: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.id);
        await log(ctx.user.id, "CUSTOMER_VIEWED", "customer", input.id);
        return customer;
      }),

    checkDuplicate: activeUserProcedure
      .input(z.object({ phone: z.string(), excludeId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const dup = await checkPhoneDuplicate(
          input.phone,
          input.excludeId,
          await buildPhoneDuplicateScope(ctx.user)
        );
        return {
          isDuplicate: !!dup,
          duplicate: !!dup,
          visibleDuplicateCount: dup ? 1 : 0,
          message: dup
            ? "확인 가능한 범위 내에 같은 연락처의 고객이 있습니다."
            : "확인 가능한 범위 내 중복 고객이 없습니다.",
        };
      }),

    create: activeUserProcedure
      .input(
        z.object({
          name: z.string().min(1),
          phone: z.string().optional(),
          birthDate: z.string().optional(),
          gender: z.enum(["male", "female", "other"]).optional(),
          region: z.string().optional(),
          expectedPremium: z.number().optional(),
          availableTime: z.string().optional(),
          source: z.string().optional(),
          dbCompany: z.string().max(100).optional(),
          consultStatus: z
            .enum([
              "미상담",
              "부재",
              "통화완료",
              "상담예정",
              "설계중",
              "계약",
              "보류",
              "거절",
              "해지관리",
              "재상담필요",
            ])
            .optional(),
          priority: z.enum(CUSTOMER_PRIORITIES).optional(),
          customerTags: z.array(z.enum(CUSTOMER_TAGS)).max(10).optional(),
          nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).nullable().optional(),
          privacyConsent: z.boolean().default(false),
          marketingConsent: z.boolean().default(false),
          memo: z.string().max(2000).optional(),
          agentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.phone) {
          const dup = await checkPhoneDuplicate(
            input.phone,
            undefined,
            await buildPhoneDuplicateScope(ctx.user)
          );
          if (dup)
            throw new TRPCError({
              code: "CONFLICT",
              message: "확인 가능한 범위 내에 같은 연락처의 고객이 있습니다.",
            });
        }
        const assignee = await resolveCustomerCreateAssignee(
          ctx.user,
          input.agentId
        );
        const { customerTags, agentId, ...customerInput } = input;
        await createCustomer({
          ...customerInput,
          ...assignee,
          customerTags: encodeCustomerTags(customerTags),
          phone: input.phone ? normalizePhone(input.phone) : undefined,
          birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
          assignedAt: new Date(),
          createdBy: ctx.user.id,
        });
        await log(
          ctx.user.id,
          "CUSTOMER_CREATED",
          "customer",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "customer",
            afterValue: {
              assignedAgentId: assignee.agentId,
              assignedTeamId: assignee.assignedTeamId,
              subBranchAdminId: assignee.subBranchAdminId,
              assignmentStatus: assignee.assignmentStatus,
            },
            metadata: {
              createdByRole: ctx.user.role,
              selfAssigned: assignee.agentId === ctx.user.id,
            },
          })
        );
        return { success: true };
      }),

    update: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          phone: z.string().optional(),
          birthDate: z.string().optional(),
          gender: z.enum(["male", "female", "other"]).optional(),
          region: z.string().optional(),
          expectedPremium: z.number().optional(),
          availableTime: z.string().optional(),
          source: z.string().optional(),
          dbCompany: z.string().max(100).optional(),
          privacyConsent: z.boolean().optional(),
          marketingConsent: z.boolean().optional(),
          memo: z.string().optional(),
          priority: z.enum(CUSTOMER_PRIORITIES).optional(),
          customerTags: z.array(z.enum(CUSTOMER_TAGS)).max(10).optional(),
          nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
          consultStatus: z
            .enum([
              "미상담",
              "부재",
              "통화완료",
              "상담예정",
              "설계중",
              "계약",
              "보류",
              "거절",
              "해지관리",
              "재상담필요",
            ])
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const {
          id,
          birthDate,
          consultStatus,
          privacyConsent,
          marketingConsent,
          customerTags,
          ...rest
        } = input;
        const existing = await verifyCustomerAccess(ctx.user, id);

        const beforeSnapshot: Record<string, unknown> = {};
        const afterSnapshot: Record<string, unknown> = {};
        for (const key of Object.keys(rest) as (keyof typeof rest)[]) {
          if (rest[key] !== undefined && (existing as any)[key] !== rest[key]) {
            beforeSnapshot[key] = (existing as any)[key];
            afterSnapshot[key] = rest[key];
          }
        }

        if (consultStatus && consultStatus !== existing.consultStatus) {
          await createStatusHistory({
            customerId: id,
            changedBy: ctx.user.id,
            previousStatus: existing.consultStatus,
            newStatus: consultStatus,
          });
          beforeSnapshot.consultStatus = existing.consultStatus;
          afterSnapshot.consultStatus = consultStatus;
        }
        if (
          privacyConsent !== undefined &&
          privacyConsent !== existing.privacyConsent
        ) {
          await createConsentLog({
            customerId: id,
            changedBy: ctx.user.id,
            consentType: "privacy",
            previousValue: existing.privacyConsent ?? false,
            newValue: privacyConsent,
          });
        }
        if (
          marketingConsent !== undefined &&
          marketingConsent !== existing.marketingConsent
        ) {
          await createConsentLog({
            customerId: id,
            changedBy: ctx.user.id,
            consentType: "marketing",
            previousValue: existing.marketingConsent ?? false,
            newValue: marketingConsent,
          });
        }

        const encodedTags = encodeCustomerTags(customerTags);
        if (
          encodedTags !== undefined &&
          existing.customerTags !== encodedTags
        ) {
          beforeSnapshot.customerTags = decodeCustomerTags(
            existing.customerTags
          );
          afterSnapshot.customerTags = customerTags ?? [];
        }
        await updateCustomer(id, {
          ...rest,
          customerTags: encodedTags,
          consultStatus,
          privacyConsent,
          marketingConsent,
          birthDate: birthDate ? new Date(birthDate) : undefined,
        });
        await log(
          ctx.user.id,
          "CUSTOMER_UPDATED",
          "customer",
          id,
          JSON.stringify({ before: beforeSnapshot, after: afterSnapshot })
        );
        return { success: true };
      }),

    updateManagementMeta: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          priority: z.enum(CUSTOMER_PRIORITIES).optional(),
          customerTags: z.array(z.enum(CUSTOMER_TAGS)).max(10).optional(),
          nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "비활성 고객은 관리 정보를 수정할 수 없습니다.",
          });
        const updates: Record<string, unknown> = {};
        if (input.priority !== undefined) updates.priority = input.priority;
        if (input.nextAction !== undefined)
          updates.nextAction = input.nextAction;
        if (input.customerTags !== undefined)
          updates.customerTags = encodeCustomerTags(input.customerTags);
        await updateCustomer(input.customerId, updates as any);
        if (
          input.priority !== undefined &&
          input.priority !== customer.priority
        ) {
          await log(
            ctx.user.id,
            "CUSTOMER_PRIORITY_UPDATED",
            "customer",
            input.customerId,
            logDetails({
              actor: ctx.user.id,
              targetId: input.customerId,
              targetType: "customer",
              beforeValue: { priority: customer.priority },
              afterValue: { priority: input.priority },
            })
          );
        }
        if (input.customerTags !== undefined) {
          await log(
            ctx.user.id,
            "CUSTOMER_TAGS_UPDATED",
            "customer",
            input.customerId,
            logDetails({
              actor: ctx.user.id,
              targetId: input.customerId,
              targetType: "customer",
              beforeValue: { tags: decodeCustomerTags(customer.customerTags) },
              afterValue: { tags: input.customerTags },
            })
          );
        }
        if (
          input.nextAction !== undefined &&
          input.nextAction !== customer.nextAction
        ) {
          await log(
            ctx.user.id,
            "CUSTOMER_NEXT_ACTION_UPDATED",
            "customer",
            input.customerId,
            logDetails({
              actor: ctx.user.id,
              targetId: input.customerId,
              targetType: "customer",
              beforeValue: { nextAction: customer.nextAction ?? null },
              afterValue: { nextAction: input.nextAction },
            })
          );
        }
        return { success: true };
      }),

    deactivate: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await verifyCustomerDeleteAccess(ctx.user, input.id);
        await softDeleteCustomer(input.id);
        await log(
          ctx.user.id,
          "CUSTOMER_DEACTIVATED",
          "customer",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "customer",
            beforeValue: {
              isActive: existing.isActive,
              deletedAt: (existing as any).deletedAt ?? null,
            },
            afterValue: { isActive: false },
            metadata: { deleteMode: "soft" },
          })
        );
        return { success: true };
      }),

    /** 지점장이 부지점장에게 DB 배분 */
    assignToSubBranch: branchAdminProcedure
      .input(z.object({ customerId: z.number(), subBranchAdminId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        await verifySubBranchAdminTarget(input.subBranchAdminId);
        if (
          customer.assignmentStatus === "assigned_to_agent" ||
          customer.agentId
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "이미 담당자에게 배정된 고객은 부지점장에게 되돌릴 수 없습니다.",
          });
        }
        const prevSubBranchAdminId = customer.subBranchAdminId;
        const subBranchAssignmentDetails = logDetails({
          actor: ctx.user.id,
          targetId: input.customerId,
          targetType: "customer",
          beforeValue: {
            previousSubBranchAdminId: customer.subBranchAdminId ?? null,
            previousAgentId: customer.agentId ?? null,
            assignmentStatus: customer.assignmentStatus,
          },
          afterValue: {
            newSubBranchAdminId: input.subBranchAdminId,
            newAgentId: null,
            assignmentStatus: "assigned_to_sub_branch",
          },
          metadata: { assignmentType: "branch_to_sub_branch" },
        });
        await runDbTransaction(async tx => {
          await assignCustomerToSubBranch(
            input.customerId,
            input.subBranchAdminId,
            tx
          );
          await createAssignmentHistory(
            {
              customerId: input.customerId,
              previousSubBranchAdminId: prevSubBranchAdminId ?? undefined,
              newSubBranchAdminId: input.subBranchAdminId,
              previousAgentId: customer.agentId ?? undefined,
              assignedBy: ctx.user.id,
              assignmentType: "branch_to_sub_branch",
            },
            tx
          );
          await log(
            ctx.user.id,
            "DB_ASSIGNED_TO_SUB_BRANCH_ADMIN",
            "customer",
            input.customerId,
            subBranchAssignmentDetails,
            tx
          );
          await log(
            ctx.user.id,
            "ASSIGNMENT_HISTORY_CREATED",
            "customer",
            input.customerId,
            undefined,
            tx
          );
          await log(
            ctx.user.id,
            "CUSTOMER_TRANSFERRED",
            "customer",
            input.customerId,
            subBranchAssignmentDetails,
            tx
          );
        });
        return { success: true };
      }),

    /** 지점장/부지점장/팀장이 산하 조직원에게 최종 배정 */
    assign: teamLeaderOrAboveProcedure
      .input(z.object({ customerId: z.number(), agentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const customer = await verifyCustomerAccess(user, input.customerId);
        const agent = await verifyAgentTarget(user, input.agentId);

        // 부지점장 이중 검증 (조건 3)
        if (user.role === "sub_branch_admin") {
          // ① 고객 DB가 본인에게 배분된 것인지
          if (customer.subBranchAdminId !== user.id)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "본인에게 배분된 DB만 배정 가능합니다.",
            });
          // ② 배정 대상이 본인 산하 팀장/팀원인지
        }

        const prevAgentId = customer.agentId ?? null;
        if (agent.role === "member" && prevAgentId === input.agentId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "현재 담당자와 동일한 사용자는 선택할 수 없습니다.",
          });
        }
        const autoSetAssignee = shouldAutoSetAssigneeOnDbAssignment(agent);
        const isBranchAdminSelfAssignment =
          user.role === "branch_admin" &&
          agent.id === user.id &&
          agent.role === "branch_admin";
        const nextScope = nextAssignmentScopeForUser(agent);
        const nextAgentId =
          autoSetAssignee || isBranchAdminSelfAssignment
            ? input.agentId
            : prevAgentId;

        // DB 배정 로그 분리 (역할 및 assignmentType 기반)
        const assignLogAction = isBranchAdminSelfAssignment
          ? "CUSTOMER_SELF_ASSIGNED_BY_BRANCH_ADMIN"
          : user.role === "branch_admin"
            ? "DB_ASSIGNED_BY_BRANCH_ADMIN"
            : user.role === "team_leader"
              ? "DB_ASSIGNED_BY_TEAM_LEADER"
              : "DB_ASSIGNED_BY_SUB_BRANCH_ADMIN";
        const agentAssignmentDetails = logDetails({
          actor: ctx.user.id,
          targetId: input.customerId,
          targetType: "customer",
          beforeValue: {
            previousAgentId: prevAgentId ?? null,
            previousSubBranchAdminId: customer.subBranchAdminId ?? null,
            previousTeamId: customer.assignedTeamId ?? null,
          },
          afterValue: {
            newAgentId: nextAgentId,
            newSubBranchAdminId: nextScope.subBranchAdminId,
            newTeamId: nextScope.teamId,
          },
          metadata: {
            assignmentType: assignmentTypeForActor(user.role),
            selfManagedByBranchAdmin: isBranchAdminSelfAssignment,
            autoSetAssignee,
            assignedDbToUserId: input.agentId,
            targetUserRole: agent.role,
          },
        });
        await runDbTransaction(async tx => {
          const result = await assignCustomerDbWithOwnerPolicy({
            customer,
            targetUser: agent,
            actor: ctx.user,
            tx,
          });
          await log(
            ctx.user.id,
            assignLogAction,
            "customer",
            input.customerId,
            agentAssignmentDetails,
            tx
          );
          await log(
            ctx.user.id,
            "ASSIGNMENT_HISTORY_CREATED",
            "customer",
            input.customerId,
            undefined,
            tx
          );
          await log(
            ctx.user.id,
            "CUSTOMER_ASSIGNED",
            "customer",
            input.customerId,
            agentAssignmentDetails,
            tx
          );
          if (
            result.autoSetAssignee &&
            result.previousAgentId !== result.nextAgentId
          ) {
            await log(
              ctx.user.id,
              "CUSTOMER_ASSIGNEE_AUTO_SET_BY_DB_ASSIGNMENT",
              "customer",
              input.customerId,
              logDetails({
                actor: ctx.user.id,
                targetId: input.customerId,
                targetType: "customer",
                beforeValue: { previousAssigneeId: result.previousAgentId },
                afterValue: { newAssigneeId: result.nextAgentId },
                metadata: {
                  reason: "auto_member_assignment_on_db_assignment",
                  customerId: input.customerId,
                  assignedDbToUserId: input.agentId,
                  previousAssigneeId: result.previousAgentId,
                  newAssigneeId: result.nextAgentId,
                  targetUserRole: agent.role,
                },
              }),
              tx
            );
          }
          await createNotification(
            {
              userId: input.agentId,
              type: "customer_assigned",
              title: "새 고객 배정",
              message: `${customer.name} 고객이 배정되었습니다.`,
              relatedType: "customer",
              relatedId: input.customerId,
              dueAt: new Date(),
            },
            tx
          );
        });

        if (autoSetAssignee || isBranchAdminSelfAssignment) {
          await createUncontactedReminder(
            input.customerId,
            input.agentId,
            new Date(),
            customer.name
          );
          if (customer.birthDate)
            await createBirthdayReminder(
              input.customerId,
              input.agentId,
              new Date(customer.birthDate),
              customer.name
            );
          await refreshLongUnmanagedReminder(
            input.customerId,
            input.agentId,
            new Date(),
            customer.name
          );
        }
        return { success: true };
      }),

    changeAgent: teamLeaderOrAboveProcedure
      .input(z.object({ customerId: z.number(), newAgentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await verifyCustomerAccess(ctx.user, input.customerId);
        const agent = await verifyAgentTarget(ctx.user, input.newAgentId);
        const prevAgentId = existing.agentId ?? null;
        if (prevAgentId === input.newAgentId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "현재 담당자와 동일한 사용자는 선택할 수 없습니다.",
          });
        }
        const isBranchAdminSelfAssignment =
          ctx.user.role === "branch_admin" &&
          agent.id === ctx.user.id &&
          agent.role === "branch_admin";
        const nextTeamId = isBranchAdminSelfAssignment
          ? null
          : (agent?.teamId ?? null);
        const nextSubBranchAdminId = isBranchAdminSelfAssignment
          ? null
          : (agent?.subBranchAdminId ?? null);
        const transferDetails = logDetails({
          actor: ctx.user.id,
          targetId: input.customerId,
          targetType: "customer",
          beforeValue: {
            previousAgentId: prevAgentId,
            previousSubBranchAdminId: existing.subBranchAdminId ?? null,
            previousTeamId: existing.assignedTeamId ?? null,
          },
          afterValue: {
            newAgentId: input.newAgentId,
            newSubBranchAdminId: nextSubBranchAdminId,
            newTeamId: nextTeamId,
          },
          metadata: {
            assignmentType: "reassignment",
            selfManagedByBranchAdmin: isBranchAdminSelfAssignment,
          },
        });
        await runDbTransaction(async tx => {
          await assignCustomer(
            input.customerId,
            input.newAgentId,
            nextTeamId ?? undefined,
            nextSubBranchAdminId ?? undefined,
            tx
          );
          await createAssignmentHistory(
            {
              customerId: input.customerId,
              previousSubBranchAdminId: existing.subBranchAdminId ?? undefined,
              newSubBranchAdminId: nextSubBranchAdminId ?? undefined,
              previousTeamId: existing.assignedTeamId ?? undefined,
              newTeamId: nextTeamId ?? undefined,
              previousAgentId: existing.agentId ?? undefined,
              newAgentId: input.newAgentId,
              assignedBy: ctx.user.id,
              assignmentType: "reassignment",
            },
            tx
          );
          await log(
            ctx.user.id,
            "AGENT_CHANGED",
            "customer",
            input.customerId,
            transferDetails,
            tx
          );
          await log(
            ctx.user.id,
            "CUSTOMER_REASSIGNED",
            "customer",
            input.customerId,
            transferDetails,
            tx
          );
          if (isBranchAdminSelfAssignment) {
            await log(
              ctx.user.id,
              "CUSTOMER_SELF_ASSIGNED_BY_BRANCH_ADMIN",
              "customer",
              input.customerId,
              transferDetails,
              tx
            );
          }
          if ((existing.subBranchAdminId ?? null) !== nextSubBranchAdminId) {
            await log(
              ctx.user.id,
              "CUSTOMER_TRANSFERRED",
              "customer",
              input.customerId,
              transferDetails,
              tx
            );
          }
        });
        return { success: true };
      }),

    bulkChangeAgent: teamLeaderOrAboveProcedure
      .input(
        z.object({
          customerIds: z
            .array(z.number())
            .min(1)
            .max(CUSTOMER_BULK_ASSIGNEE_LIMIT),
          newAgentId: z.number(),
          reason: customerAssigneeChangeReasonSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const target = await verifyAgentTarget(ctx.user, input.newAgentId);
        const isBranchAdminSelfAssignment =
          ctx.user.role === "branch_admin" &&
          target.id === ctx.user.id &&
          target.role === "branch_admin";
        const nextTeamId = isBranchAdminSelfAssignment
          ? null
          : (target.teamId ?? null);
        const nextSubBranchAdminId = isBranchAdminSelfAssignment
          ? null
          : (target.subBranchAdminId ?? null);
        const uniqueCustomerIds = Array.from(new Set(input.customerIds));
        const skipped: Array<{ customerId: number; reason: string }> = [];
        let changedCount = 0;

        await runDbTransaction(async tx => {
          for (const customerId of uniqueCustomerIds) {
            let existing: Awaited<ReturnType<typeof getCustomerById>>;
            try {
              existing = await verifyCustomerAccess(ctx.user, customerId, {
                includeInactiveOrDeleted: true,
              });
            } catch {
              skipped.push({ customerId, reason: "OUT_OF_SCOPE" });
              continue;
            }
            if (
              !existing ||
              existing.isActive === false ||
              (existing as any).deletedAt
            ) {
              skipped.push({ customerId, reason: "SOFT_DELETED_OR_INACTIVE" });
              continue;
            }
            const prevAgentId = existing.agentId ?? null;
            if (prevAgentId === input.newAgentId) {
              skipped.push({ customerId, reason: "ALREADY_SAME_ASSIGNEE" });
              continue;
            }
            await assignCustomer(
              customerId,
              input.newAgentId,
              isBranchAdminSelfAssignment
                ? undefined
                : (nextTeamId ?? undefined),
              isBranchAdminSelfAssignment
                ? undefined
                : (nextSubBranchAdminId ?? undefined),
              tx
            );
            await createAssignmentHistory(
              {
                customerId,
                previousSubBranchAdminId:
                  existing.subBranchAdminId ?? undefined,
                newSubBranchAdminId: isBranchAdminSelfAssignment
                  ? undefined
                  : (nextSubBranchAdminId ?? undefined),
                previousTeamId: existing.assignedTeamId ?? undefined,
                newTeamId: isBranchAdminSelfAssignment
                  ? undefined
                  : (nextTeamId ?? undefined),
                previousAgentId: existing.agentId ?? undefined,
                newAgentId: input.newAgentId,
                assignedBy: ctx.user.id,
                assignmentType: "reassignment",
                assignmentReason: input.reason || "bulk_assignee_change",
              },
              tx
            );
            await log(
              ctx.user.id,
              "CUSTOMER_ASSIGNEE_CHANGED_BY_BULK",
              "customer",
              customerId,
              logDetails({
                actor: ctx.user.id,
                targetId: customerId,
                targetType: "customer",
                beforeValue: { previousAssigneeId: prevAgentId },
                afterValue: {
                  newAssigneeId: input.newAgentId,
                  newTeamId: nextTeamId,
                  newSubBranchAdminId: nextSubBranchAdminId,
                },
                metadata: { reason: input.reason || "bulk_assignee_change" },
              }),
              tx
            );
            changedCount++;
          }
          await log(
            ctx.user.id,
            "CUSTOMER_ASSIGNEE_BULK_CHANGED",
            "customer",
            undefined,
            logDetails({
              actor: ctx.user.id,
              targetType: "customer",
              metadata: {
                requestedCount: uniqueCustomerIds.length,
                changedCount,
                skippedCount: skipped.length,
                targetAssigneeId: input.newAgentId,
                reason: input.reason || "bulk_assignee_change",
              },
            }),
            tx
          );
        });

        return {
          requestedCount: uniqueCustomerIds.length,
          changedCount,
          skippedCount: skipped.length,
          skipped,
        };
      }),

    reclaim: branchAdminProcedure
      .input(
        z.object({
          customerId: z.number(),
          reason: customerReclaimReasonSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const reclaimedAt = new Date().toISOString();
        const result = await runDbTransaction(async tx =>
          reclaimCustomerDb({
            customerId: input.customerId,
            reason: input.reason,
            reclaimedBy: ctx.user.id,
            reclaimedAt,
            tx,
          })
        );
        return { success: true, reclaimed: result };
      }),

    reclaimBulk: branchAdminProcedure
      .input(
        z.object({
          customerIds: z
            .array(z.number())
            .min(1)
            .max(CUSTOMER_RECLAIM_BULK_LIMIT),
          reason: customerReclaimReasonSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const uniqueCustomerIds = Array.from(new Set(input.customerIds));
        const reclaimedAt = new Date().toISOString();
        const reclaimed = await runDbTransaction(async tx => {
          const results = [];
          for (const customerId of uniqueCustomerIds) {
            results.push(
              await reclaimCustomerDb({
                customerId,
                reason: input.reason,
                reclaimedBy: ctx.user.id,
                reclaimedAt,
                tx,
              })
            );
          }
          return results;
        });
        return {
          success: true,
          count: reclaimed?.length ?? uniqueCustomerIds.length,
          reclaimed: reclaimed ?? [],
        };
      }),

    assignmentHistory: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getAssignmentHistory(input.customerId);
      }),

    statusHistory: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getStatusHistory(input.customerId);
      }),

    consentLogs: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getConsentLogs(input.customerId);
      }),

    // ── Bulk Import ─────────────────────────────────────────────────────────
    timeline: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          eventTypes: z.array(z.string()).max(20).optional(),
          limit: z.number().min(1).max(200).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
        if (dateFrom && Number.isNaN(dateFrom.getTime()))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "dateFrom이 올바르지 않습니다.",
          });
        if (dateTo && Number.isNaN(dateTo.getTime()))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "dateTo가 올바르지 않습니다.",
          });
        return getCustomerTimeline(input.customerId, {
          dateFrom,
          dateTo,
          eventTypes: input.eventTypes,
          limit: input.limit,
        });
      }),

    downloadImportTemplate: customerBulkImportProcedure.query(
      async ({ ctx }) => {
        const baseHeaders = [
          "이름",
          "생년월일",
          "연락처",
          "성별",
          "지역",
          "예상보험료(만원)",
          "통화가능시간",
          "유입경로",
          "DB 업체명",
          "상담상태",
          "메모",
        ];
        const headers =
          ctx.user.role === "branch_admin"
            ? [...baseHeaders, "담당자"]
            : baseHeaders;
        const csvContent = headers.join(",");
        await log(
          ctx.user.id,
          "DATA_DOWNLOAD",
          "template",
          undefined,
          "type=bulk_import_template"
        );
        return {
          headers,
          csvContent,
          requiredHeaders: ["이름", "생년월일", "연락처"],
          optionalHeaders: baseHeaders.filter(
            header => !["이름", "생년월일", "연락처"].includes(header)
          ),
          assigneeHeaderEnabled: ctx.user.role === "branch_admin",
        };
      }
    ),

    previewImport: customerBulkImportProcedure
      .input(
        z.object({
          rows: z.array(z.record(z.string(), z.any())).max(5000),
          fileName: z.string().optional(),
          fileSize: z.number().nonnegative().optional(),
          mimeType: z.string().optional(),
          agentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        verifyBulkImportFilePolicy(input);
        const headers = Object.keys(input.rows[0] || {});
        const forbiddenCols = detectForbiddenColumns(headers);
        if (forbiddenCols.length > 0) {
          await log(
            ctx.user.id,
            "CUSTOMER_BULK_IMPORT_FAILED",
            "customer",
            undefined,
            JSON.stringify({
              reason: "forbidden_columns",
              forbiddenColumns: forbiddenCols,
              fileName: "preview",
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `금지된 컬럼이 포함되어 있습니다: ${forbiddenCols.join(", ")}. 민감정보(주민번호, 증권번호 등)는 업로드할 수 없습니다.`,
          });
        }

        const existingPhones = await getAllActiveCustomerPhones(
          await buildPhoneDuplicateScope(ctx.user)
        );
        const filePhones = new Set<string>();
        const forcedAssignee =
          ctx.user.role === "branch_admin"
            ? input.agentId !== undefined
              ? await resolveCustomerCreateAssignee(ctx.user, input.agentId)
              : undefined
            : await resolveCustomerCreateAssignee(ctx.user, input.agentId);

        const validationResults: BulkImportValidationResult[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = normalizeBulkImportRow(input.rows[i]);
          const result = await validateBulkImportRow(
            row,
            i,
            existingPhones,
            filePhones,
            forcedAssignee
              ? {
                  forceAssignee: {
                    agentId: forcedAssignee.agentId,
                    teamId: forcedAssignee.assignedTeamId,
                    subBranchAdminId: forcedAssignee.subBranchAdminId,
                  },
                }
              : undefined
          );
          validationResults.push(result);
        }

        const successCount = validationResults.filter(r => r.isValid).length;
        const errorCount = validationResults.filter(r => !r.isValid).length;

        await log(
          ctx.user.id,
          "CUSTOMER_BULK_IMPORT_PREVIEWED",
          "customer",
          undefined,
          JSON.stringify({
            totalRows: input.rows.length,
            successRows: successCount,
            failedRows: errorCount,
          })
        );

        return {
          totalRows: input.rows.length,
          successRows: successCount,
          failedRows: errorCount,
          validationResults,
        };
      }),

    bulkImport: customerBulkImportProcedure
      .input(
        z.object({
          rows: z.array(z.record(z.string(), z.any())).max(5000),
          fileName: z.string().optional(),
          fileSize: z.number().nonnegative().optional(),
          mimeType: z.string().optional(),
          agentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const importBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        try {
          verifyBulkImportFilePolicy(input);
        } catch (error) {
          await log(
            ctx.user.id,
            "CUSTOMER_BULK_IMPORT_FAILED",
            "customer",
            undefined,
            JSON.stringify({
              importBatchId,
              reason: "file_policy_rejected",
              fileName: input.fileName,
              fileSize: input.fileSize,
              mimeType: input.mimeType,
            })
          );
          throw error;
        }

        const headers = Object.keys(input.rows[0] || {});
        const forbiddenCols = detectForbiddenColumns(headers);
        if (forbiddenCols.length > 0) {
          await log(
            ctx.user.id,
            "CUSTOMER_BULK_IMPORT_FAILED",
            "customer",
            undefined,
            JSON.stringify({
              importBatchId,
              reason: "forbidden_columns",
              forbiddenColumns: forbiddenCols,
              fileName: input.fileName,
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `금지된 컬럼이 포함되어 있습니다: ${forbiddenCols.join(", ")}`,
          });
        }

        const existingPhones = await getAllActiveCustomerPhones(
          await buildPhoneDuplicateScope(ctx.user)
        );
        const filePhones = new Set<string>();
        const forcedAssignee =
          ctx.user.role === "branch_admin"
            ? input.agentId !== undefined
              ? await resolveCustomerCreateAssignee(ctx.user, input.agentId)
              : undefined
            : await resolveCustomerCreateAssignee(ctx.user, input.agentId);

        const validationResults: BulkImportValidationResult[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = normalizeBulkImportRow(input.rows[i]);
          const result = await validateBulkImportRow(
            row,
            i,
            existingPhones,
            filePhones,
            forcedAssignee
              ? {
                  forceAssignee: {
                    agentId: forcedAssignee.agentId,
                    teamId: forcedAssignee.assignedTeamId,
                    subBranchAdminId: forcedAssignee.subBranchAdminId,
                  },
                }
              : undefined
          );
          validationResults.push(result);
        }

        const validRows = validationResults.filter(r => r.isValid);
        if (validRows.length === 0) {
          await log(
            ctx.user.id,
            "CUSTOMER_BULK_IMPORT_FAILED",
            "customer",
            undefined,
            JSON.stringify({
              importBatchId,
              reason: "no_valid_rows",
              totalRows: input.rows.length,
              fileName: input.fileName,
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "유효한 행이 없습니다. 모든 행에 오류가 있습니다.",
          });
        }

        const importedAt = new Date();
        const customersToCreate = validRows.map(result => {
          const row = normalizeBulkImportRow(input.rows[result.rowIndex]);
          return {
            name: row.name!,
            phone:
              result.normalizedPhone ??
              (row.phone ? normalizePhone(row.phone) : undefined),
            birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
            gender: (row.gender === "남" || row.gender === "male"
              ? "male"
              : row.gender === "여" || row.gender === "female"
                ? "female"
                : row.gender === "기타" || row.gender === "other"
                  ? "other"
                  : undefined) as any,
            region: row.region,
            expectedPremium: row.expectedPremium
              ? expectedPremiumStoredWonFromManwonInput(
                  String(row.expectedPremium)
                )
              : undefined,
            availableTime: row.availableTime,
            source: row.source,
            dbCompany: row.dbCompany,
            consultStatus: row.consultStatus || "미상담",
            memo: row.memo,
            agentId: result.agentId,
            subBranchAdminId: result.subBranchAdminId,
            assignedTeamId: result.teamId,
            assignmentStatus: result.assignmentStatus as
              | "unassigned"
              | "assigned_to_sub_branch"
              | "assigned_to_agent",
            assignedAt: result.agentId ? importedAt : undefined,
            createdBy: ctx.user.id,
            importBatchId,
            importedBy: ctx.user.id,
            importedAt,
          };
        });

        const errorCount = validationResults.filter(r => !r.isValid).length;
        const duplicateCount = validationResults.filter(r =>
          r.errors.some(e => e.includes("?? DB? ??"))
        ).length;

        await runDbTransaction(async tx => {
          await createImportBatch(
            {
              importBatchId,
              fileName: input.fileName,
              uploadedBy: ctx.user.id,
              totalRows: input.rows.length,
              successRows: validRows.length,
              failedRows: errorCount,
              duplicateRows: duplicateCount,
              blockedForbiddenColumn: false,
              status: "active",
            },
            tx
          );
          await bulkCreateCustomers(customersToCreate, tx);
          await log(
            ctx.user.id,
            "CUSTOMER_BULK_IMPORTED",
            "customer",
            undefined,
            JSON.stringify({
              importBatchId,
              fileName: input.fileName,
              uploadedBy: ctx.user.id,
              totalRows: input.rows.length,
              successRows: validRows.length,
              failedRows: errorCount,
              duplicateRows: duplicateCount,
              importedAt: importedAt.toISOString(),
            }),
            tx
          );
          await log(
            ctx.user.id,
            "DATA_IMPORT",
            "customers",
            undefined,
            logDetails({
              actor: ctx.user.id,
              targetType: "customers",
              afterValue: { successRows: validRows.length },
              metadata: {
                importBatchId,
                fileName: input.fileName,
                type: "bulk_import",
                successRows: validRows.length,
              },
            }),
            tx
          );
        });

        return {
          success: true,
          importBatchId,
          totalRows: input.rows.length,
          successRows: validRows.length,
          failedRows: errorCount,
          duplicateRows: duplicateCount,
          validationResults,
        };
      }),
  }),

  // ── Consultations ─────────────────────────────────────────────────────────
  customerMerge: router({
    findDuplicates: branchAdminProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            phone: z.string().optional(),
            name: z.string().optional(),
            onlyActive: z.boolean().default(true).optional(),
          })
          .optional()
      )
      .query(async ({ input }) =>
        findDuplicateCustomerGroups(input ?? { onlyActive: true })
      ),

    preview: branchAdminProcedure
      .input(
        z.object({ targetCustomerId: z.number(), sourceCustomerId: z.number() })
      )
      .query(async ({ ctx, input }) => {
        if (input.targetCustomerId === input.sourceCustomerId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "기준 고객과 병합 대상 고객이 같습니다.",
          });
        const preview = await getCustomerMergePreview(
          input.targetCustomerId,
          input.sourceCustomerId
        );
        if (!preview)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "고객을 찾을 수 없습니다.",
          });
        if (
          preview.blockers.inactiveTarget ||
          preview.blockers.inactiveSource ||
          preview.blockers.alreadyMerged ||
          preview.blockers.pendingDeleteRequests
        ) {
          await log(
            ctx.user.id,
            "CUSTOMER_MERGE_BLOCKED",
            "customer",
            input.targetCustomerId,
            logDetails({
              actor: ctx.user.id,
              targetId: input.targetCustomerId,
              targetType: "customer",
              metadata: {
                sourceCustomerId: input.sourceCustomerId,
                blockers: preview.blockers,
              },
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "active 상태이며 pending 삭제 요청이 없는 고객만 병합할 수 있습니다.",
          });
        }
        await log(
          ctx.user.id,
          "CUSTOMER_MERGE_PREVIEWED",
          "customer",
          input.targetCustomerId,
          logDetails({
            actor: ctx.user.id,
            targetId: input.targetCustomerId,
            targetType: "customer",
            metadata: {
              sourceCustomerId: input.sourceCustomerId,
              transferCounts: preview.transferCounts,
            },
          })
        );
        return preview;
      }),

    execute: branchAdminProcedure
      .input(
        z.object({
          targetCustomerId: z.number(),
          sourceCustomerId: z.number(),
          confirmText: z.string(),
          reason: z.string().min(5).max(300).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== "고객병합")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "확인 문구가 일치하지 않습니다.",
          });
        if (input.targetCustomerId === input.sourceCustomerId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "기준 고객과 병합 대상 고객이 같습니다.",
          });
        const preview = await getCustomerMergePreview(
          input.targetCustomerId,
          input.sourceCustomerId
        );
        if (!preview)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "고객을 찾을 수 없습니다.",
          });
        if (
          preview.blockers.inactiveTarget ||
          preview.blockers.inactiveSource ||
          preview.blockers.alreadyMerged ||
          preview.blockers.pendingDeleteRequests
        ) {
          await log(
            ctx.user.id,
            "CUSTOMER_MERGE_BLOCKED",
            "customer",
            input.targetCustomerId,
            logDetails({
              actor: ctx.user.id,
              targetId: input.targetCustomerId,
              targetType: "customer",
              metadata: {
                sourceCustomerId: input.sourceCustomerId,
                blockers: preview.blockers,
              },
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "active 상태이며 pending 삭제 요청이 없는 고객만 병합할 수 있습니다.",
          });
        }
        return mergeCustomers({
          targetCustomerId: input.targetCustomerId,
          sourceCustomerId: input.sourceCustomerId,
          actorId: ctx.user.id,
          reason: input.reason,
        });
      }),
  }),

  consultationTools: router({
    listChecklists: activeUserProcedure
      .input(z.object({ includeInactive: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) =>
        getConsultationChecklistTemplates(
          ctx.user.role === "branch_admin" && input?.includeInactive === true
        )
      ),

    createChecklist: branchAdminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          description: z.string().max(1000).optional(),
          phase: z.enum(CHECKLIST_PHASES),
          category: z.enum(CHECKLIST_CATEGORIES).default("basic"),
          sortOrder: z.number().int().default(0),
          isRequired: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const created = await createConsultationChecklistTemplate({
          ...input,
          createdBy: ctx.user.id,
          isActive: true,
        });
        await log(
          ctx.user.id,
          "CONSULTATION_CHECKLIST_TEMPLATE_CREATED",
          "consultation_checklist",
          created?.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "consultation_checklist",
            targetId: created?.id,
            afterValue: {
              ...input,
              description: input.description ? "[redacted]" : undefined,
            },
          })
        );
        return created;
      }),

    updateChecklist: branchAdminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(200).optional(),
          description: z.string().max(1000).nullable().optional(),
          phase: z.enum(CHECKLIST_PHASES).optional(),
          category: z.enum(CHECKLIST_CATEGORIES).optional(),
          sortOrder: z.number().int().optional(),
          isRequired: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getConsultationChecklistTemplateById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const { id, ...changes } = input;
        await updateConsultationChecklistTemplate(id, {
          ...changes,
          updatedBy: ctx.user.id,
          deletedAt:
            input.isActive === false
              ? new Date()
              : input.isActive === true
                ? null
                : undefined,
        });
        await log(
          ctx.user.id,
          input.isActive === false
            ? "CONSULTATION_CHECKLIST_TEMPLATE_DEACTIVATED"
            : input.isActive === true
              ? "CONSULTATION_CHECKLIST_TEMPLATE_REACTIVATED"
              : "CONSULTATION_CHECKLIST_TEMPLATE_UPDATED",
          "consultation_checklist",
          id,
          logDetails({
            actor: ctx.user.id,
            targetType: "consultation_checklist",
            targetId: id,
            beforeValue: { title: existing.title, isActive: existing.isActive },
            afterValue: {
              ...changes,
              description: changes.description ? "[redacted]" : undefined,
            },
          })
        );
        return { success: true };
      }),

    listCustomerChecks: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const [templates, results] = await Promise.all([
          getConsultationChecklistTemplates(false),
          getConsultationCheckResults(input.customerId),
        ]);
        return { templates, results };
      }),

    seedDefaultChecklists: branchAdminProcedure.mutation(async ({ ctx }) => {
      const result = await ensureDefaultConsultationChecklists(ctx.user.id);
      if (result.createdCount > 0 || result.reactivatedCount > 0) {
        await log(
          ctx.user.id,
          "CONSULTATION_CHECKLIST_DEFAULTS_SEEDED",
          "consultation_checklist",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "consultation_checklist",
            metadata: result,
          })
        );
      }
      return result;
    }),

    updateCheckResult: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          checklistId: z.number(),
          consultationId: z.number().nullable().optional(),
          checked: z.boolean(),
          memo: z.string().max(500).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "비활성 고객에는 체크리스트를 저장할 수 없습니다.",
          });
        const template = await getConsultationChecklistTemplateById(
          input.checklistId
        );
        if (!template || !template.isActive || template.deletedAt)
          throw new TRPCError({ code: "NOT_FOUND" });
        const saved = await upsertConsultationCheckResult({
          customerId: input.customerId,
          checklistId: input.checklistId,
          consultationId: input.consultationId ?? null,
          checked: input.checked,
          checkedAt: input.checked ? new Date() : null,
          checkedBy: input.checked ? ctx.user.id : null,
          memo: input.memo ?? null,
        });
        await log(
          ctx.user.id,
          "CONSULTATION_CHECKLIST_RESULT_UPDATED",
          "customer",
          input.customerId,
          logDetails({
            actor: ctx.user.id,
            targetType: "customer",
            targetId: input.customerId,
            metadata: {
              checklistId: input.checklistId,
              checked: input.checked,
            },
          })
        );
        return saved;
      }),

    listMessageTemplates: activeUserProcedure
      .input(z.object({ includeInactive: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) =>
        getMessageTemplates(
          ctx.user.role === "branch_admin" && input?.includeInactive === true
        )
      ),

    seedDefaultMessageTemplates: branchAdminProcedure.mutation(
      async ({ ctx }) => {
        const result = await ensureDefaultMessageTemplates(ctx.user.id);
        if (result.createdCount > 0 || result.reactivatedCount > 0) {
          await log(
            ctx.user.id,
            "MESSAGE_TEMPLATE_DEFAULTS_SEEDED",
            "message_template",
            undefined,
            logDetails({
              actor: ctx.user.id,
              targetType: "message_template",
              metadata: result,
            })
          );
        }
        return result;
      }
    ),

    createMessageTemplate: branchAdminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          situation: z.enum(TEMPLATE_SITUATIONS),
          channel: z.enum(TEMPLATE_CHANNELS),
          body: z.string().min(1).max(2000),
          complianceNote: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        validateMessageTemplateBody(input.body);
        const created = await createMessageTemplate({
          ...input,
          createdBy: ctx.user.id,
          isActive: true,
        });
        await log(
          ctx.user.id,
          "MESSAGE_TEMPLATE_CREATED",
          "message_template",
          created?.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "message_template",
            targetId: created?.id,
            afterValue: {
              title: input.title,
              situation: input.situation,
              channel: input.channel,
            },
          })
        );
        return created;
      }),

    updateMessageTemplate: branchAdminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(200).optional(),
          situation: z.enum(TEMPLATE_SITUATIONS).optional(),
          channel: z.enum(TEMPLATE_CHANNELS).optional(),
          body: z.string().min(1).max(2000).optional(),
          complianceNote: z.string().max(1000).nullable().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getMessageTemplateById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.body) validateMessageTemplateBody(input.body);
        const { id, ...changes } = input;
        await updateMessageTemplate(id, {
          ...changes,
          updatedBy: ctx.user.id,
          deletedAt:
            input.isActive === false
              ? new Date()
              : input.isActive === true
                ? null
                : undefined,
        });
        await log(
          ctx.user.id,
          input.isActive === false
            ? "MESSAGE_TEMPLATE_DEACTIVATED"
            : input.isActive === true
              ? "MESSAGE_TEMPLATE_REACTIVATED"
              : "MESSAGE_TEMPLATE_UPDATED",
          "message_template",
          id,
          logDetails({
            actor: ctx.user.id,
            targetType: "message_template",
            targetId: id,
            beforeValue: {
              title: existing.title,
              situation: existing.situation,
              channel: existing.channel,
              isActive: existing.isActive,
            },
            afterValue: {
              ...changes,
              body: changes.body ? "[redacted]" : undefined,
            },
          })
        );
        return { success: true };
      }),

    renderMessageTemplate: activeUserProcedure
      .input(
        z.object({
          templateId: z.number(),
          customerId: z.number(),
          nextContactDate: z.string().max(100).optional(),
          consultationTopic: z.string().max(100).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        const template = await getMessageTemplateById(input.templateId);
        if (!template || !template.isActive || template.deletedAt)
          throw new TRPCError({ code: "NOT_FOUND" });
        return {
          templateId: template.id,
          title: template.title,
          situation: template.situation,
          channel: template.channel,
          body: renderMessageBody(template.body, {
            customerName: customer.name,
            agentName: ctx.user.name ?? "담당자",
            nextContactDate: input.nextContactDate,
            consultationTopic: input.consultationTopic,
          }),
          complianceNote: template.complianceNote,
        };
      }),

    logMessageCopy: activeUserProcedure
      .input(
        z.object({
          templateId: z.number(),
          customerId: z.number(),
          channel: z.enum(TEMPLATE_CHANNELS),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const template = await getMessageTemplateById(input.templateId);
        if (!template || !template.isActive || template.deletedAt)
          throw new TRPCError({ code: "NOT_FOUND" });
        await log(
          ctx.user.id,
          "MESSAGE_TEMPLATE_COPIED",
          "customer",
          input.customerId,
          logDetails({
            actor: ctx.user.id,
            targetType: "customer",
            targetId: input.customerId,
            metadata: {
              templateId: input.templateId,
              situation: template.situation,
              channel: input.channel,
            },
          })
        );
        return { success: true };
      }),
  }),

  customerHandoffNotes: router({
    listByCustomer: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          includeInactive: z.boolean().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getCustomerHandoffNotes(
          input.customerId,
          input.includeInactive === true
        );
      }),

    create: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          noteType: z.enum(HANDOFF_NOTE_TYPES).default("handoff"),
          title: z.string().min(1).max(200),
          body: z.string().min(1).max(2000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "비활성 고객에는 인수인계 메모를 작성할 수 없습니다.",
          });
        validateHandoffNoteBody(input.body);
        const created = await createCustomerHandoffNote({
          ...input,
          visibility: "internal",
          createdBy: ctx.user.id,
          isActive: true,
        });
        await log(
          ctx.user.id,
          "CUSTOMER_HANDOFF_NOTE_CREATED",
          "customer",
          input.customerId,
          logDetails({
            actor: ctx.user.id,
            targetType: "customer",
            targetId: input.customerId,
            metadata: {
              noteId: created?.id,
              noteType: input.noteType,
              title: input.title,
            },
          })
        );
        return created;
      }),

    update: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(200).optional(),
          body: z.string().min(1).max(2000).optional(),
          noteType: z.enum(HANDOFF_NOTE_TYPES).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getCustomerHandoffNoteById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, existing.customerId);
        if (input.body) validateHandoffNoteBody(input.body);
        const { id, ...changes } = input;
        await updateCustomerHandoffNote(id, {
          ...changes,
          updatedBy: ctx.user.id,
          deletedAt:
            input.isActive === false
              ? new Date()
              : input.isActive === true
                ? null
                : undefined,
        });
        await log(
          ctx.user.id,
          input.isActive === false
            ? "CUSTOMER_HANDOFF_NOTE_DEACTIVATED"
            : input.isActive === true
              ? "CUSTOMER_HANDOFF_NOTE_REACTIVATED"
              : "CUSTOMER_HANDOFF_NOTE_UPDATED",
          "customer",
          existing.customerId,
          logDetails({
            actor: ctx.user.id,
            targetType: "customer",
            targetId: existing.customerId,
            metadata: {
              noteId: id,
              noteType: input.noteType ?? existing.noteType,
              title: input.title ?? existing.title,
            },
          })
        );
        return { success: true };
      }),
  }),

  consultationScripts: router({
    list: activeUserProcedure
      .input(
        z
          .object({
            includeInactive: z.boolean().optional(),
            category: z.enum(SCRIPT_CATEGORIES).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const rows = await getConsultationScripts(
          ctx.user.role === "branch_admin" && input?.includeInactive === true
        );
        return input?.category
          ? rows.filter(row => row.category === input.category)
          : rows;
      }),

    seedDefaults: branchAdminProcedure.mutation(async ({ ctx }) => {
      const result = await ensureDefaultConsultationScripts(ctx.user.id);
      if (result.createdCount > 0) {
        await log(
          ctx.user.id,
          "CONSULTATION_SCRIPT_DEFAULTS_SEEDED",
          "consultation_script",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "consultation_script",
            metadata: { createdCount: result.createdCount },
          })
        );
      }
      return result;
    }),

    create: branchAdminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          category: z.enum(SCRIPT_CATEGORIES),
          scriptBody: z.string().min(1).max(3000),
          complianceNote: z.string().max(1000).optional(),
          tags: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        validateScriptBody(input.scriptBody);
        const created = await createConsultationScript({
          ...input,
          createdBy: ctx.user.id,
          isActive: true,
        });
        await log(
          ctx.user.id,
          "CONSULTATION_SCRIPT_CREATED",
          "consultation_script",
          created?.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "consultation_script",
            targetId: created?.id,
            afterValue: { title: input.title, category: input.category },
          })
        );
        return created;
      }),

    update: branchAdminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(200).optional(),
          category: z.enum(SCRIPT_CATEGORIES).optional(),
          scriptBody: z.string().min(1).max(3000).optional(),
          complianceNote: z.string().max(1000).nullable().optional(),
          tags: z.string().max(500).nullable().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getConsultationScriptById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.scriptBody) validateScriptBody(input.scriptBody);
        const { id, ...changes } = input;
        await updateConsultationScript(id, {
          ...changes,
          updatedBy: ctx.user.id,
          deletedAt:
            input.isActive === false
              ? new Date()
              : input.isActive === true
                ? null
                : undefined,
        });
        await log(
          ctx.user.id,
          input.isActive === false
            ? "CONSULTATION_SCRIPT_DEACTIVATED"
            : input.isActive === true
              ? "CONSULTATION_SCRIPT_REACTIVATED"
              : "CONSULTATION_SCRIPT_UPDATED",
          "consultation_script",
          id,
          logDetails({
            actor: ctx.user.id,
            targetType: "consultation_script",
            targetId: id,
            beforeValue: {
              title: existing.title,
              category: existing.category,
              isActive: existing.isActive,
            },
            afterValue: {
              ...changes,
              scriptBody: changes.scriptBody ? "[redacted]" : undefined,
            },
          })
        );
        return { success: true };
      }),

    render: activeUserProcedure
      .input(z.object({ scriptId: z.number(), customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const script = await getConsultationScriptById(input.scriptId);
        if (!script || !script.isActive || script.deletedAt)
          throw new TRPCError({ code: "NOT_FOUND" });
        return script;
      }),

    logCopy: activeUserProcedure
      .input(z.object({ scriptId: z.number(), customerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const script = await getConsultationScriptById(input.scriptId);
        if (!script || !script.isActive || script.deletedAt)
          throw new TRPCError({ code: "NOT_FOUND" });
        await log(
          ctx.user.id,
          "CONSULTATION_SCRIPT_COPIED",
          "customer",
          input.customerId,
          logDetails({
            actor: ctx.user.id,
            targetType: "customer",
            targetId: input.customerId,
            metadata: { scriptId: input.scriptId, category: script.category },
          })
        );
        return { success: true };
      }),
  }),

  consultations: router({
    list: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getConsultationsByCustomer(input.customerId);
      }),

    create: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          status: z.enum([
            "미상담",
            "부재",
            "통화완료",
            "상담예정",
            "설계중",
            "계약",
            "보류",
            "거절",
            "해지관리",
            "재상담필요",
          ]),
          consultationType: z.enum(CONSULTATION_TYPES).optional(),
          customerNeed: z.enum(CUSTOMER_NEEDS).optional(),
          nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
          summary: z.string().max(200).optional(),
          content: z.string().max(2000).optional(),
          nextContactAt: z.string().optional(),
          calendarSchedule: linkedScheduleInputSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "비활성 고객에는 상담기록을 등록할 수 없습니다.",
          });
        const preparedSchedule = await prepareLinkedCustomerScheduleFromWork({
          actor: ctx.user,
          customer,
          schedule: input.calendarSchedule,
          fallbackStartTime: input.nextContactAt,
          defaultTitle: "재상담 일정",
          defaultType: "재통화",
          defaultMemo: input.summary ?? input.content,
        });
        if (input.status !== customer.consultStatus) {
          await createStatusHistory({
            customerId: input.customerId,
            changedBy: ctx.user.id,
            previousStatus: customer.consultStatus,
            newStatus: input.status,
          });
        }
        const nextContactDate = input.nextContactAt
          ? new Date(input.nextContactAt)
          : undefined;
        await createConsultation({
          customerId: input.customerId,
          agentId: ctx.user.id,
          status: input.status,
          consultationType: input.consultationType,
          customerNeed: input.customerNeed,
          nextAction: input.nextAction,
          summary: input.summary,
          content: input.content,
          nextContactAt: nextContactDate,
        });
        if (input.nextAction && input.nextAction !== customer.nextAction) {
          await updateCustomer(input.customerId, {
            nextAction: input.nextAction,
          });
          await log(
            ctx.user.id,
            "CUSTOMER_NEXT_ACTION_UPDATED",
            "customer",
            input.customerId,
            logDetails({
              actor: ctx.user.id,
              targetId: input.customerId,
              targetType: "customer",
              beforeValue: { nextAction: customer.nextAction ?? null },
              afterValue: { nextAction: input.nextAction },
            })
          );
        }
        if (nextContactDate)
          await createReconsultReminder(
            input.customerId,
            ctx.user.id,
            nextContactDate,
            customer.name
          );
        const scheduleCreated = await createPreparedLinkedCustomerSchedule(
          ctx.user.id,
          preparedSchedule
        );
        if (customer.agentId)
          await refreshLongUnmanagedReminder(
            input.customerId,
            customer.agentId,
            new Date(),
            customer.name
          );
        await log(
          ctx.user.id,
          "CONSULTATION_CREATED",
          "customer",
          input.customerId,
          logDetails({
            actor: ctx.user.id,
            targetId: input.customerId,
            targetType: "customer",
            afterValue: {
              status: input.status,
              consultationType: input.consultationType ?? null,
              customerNeed: input.customerNeed ?? null,
              nextAction: input.nextAction ?? null,
            },
            metadata: { scheduleCreated },
          })
        );
        return { success: true };
      }),

    update: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          status: z
            .enum([
              "미상담",
              "부재",
              "통화완료",
              "상담예정",
              "설계중",
              "계약",
              "보류",
              "거절",
              "해지관리",
              "재상담필요",
            ])
            .optional(),
          consultationType: z.enum(CONSULTATION_TYPES).optional(),
          customerNeed: z.enum(CUSTOMER_NEEDS).optional(),
          nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
          summary: z.string().max(200).optional(),
          content: z.string().max(2000).optional(),
          nextContactAt: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getConsultationById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, existing.customerId);
        // 소유권 검증: 상담기록의 고객을 통해 검증
        await verifyCustomerAccess(ctx.user, existing.customerId);

        const beforeSnapshot = {
          status: existing.status,
          consultationType: existing.consultationType,
          customerNeed: existing.customerNeed,
          nextAction: existing.nextAction,
          summary: existing.summary,
          nextContactAt: existing.nextContactAt,
        };
        const afterSnapshot: Record<string, unknown> = {};
        if (input.status !== undefined) afterSnapshot.status = input.status;
        if (input.consultationType !== undefined)
          afterSnapshot.consultationType = input.consultationType;
        if (input.customerNeed !== undefined)
          afterSnapshot.customerNeed = input.customerNeed;
        if (input.nextAction !== undefined)
          afterSnapshot.nextAction = input.nextAction;
        if (input.summary !== undefined) afterSnapshot.summary = input.summary;
        if (input.nextContactAt !== undefined)
          afterSnapshot.nextContactAt = input.nextContactAt;

        await updateConsultation(input.id, {
          status: input.status,
          consultationType: input.consultationType,
          customerNeed: input.customerNeed,
          nextAction: input.nextAction,
          summary: input.summary,
          content: input.content,
          nextContactAt:
            input.nextContactAt === null
              ? null
              : input.nextContactAt
                ? new Date(input.nextContactAt)
                : undefined,
        });

        if (input.status && input.status !== existing.status) {
          await createStatusHistory({
            customerId: existing.customerId,
            changedBy: ctx.user.id,
            previousStatus: existing.status,
            newStatus: input.status,
          });
        }
        if (input.nextContactAt) {
          const customer = await getCustomerById(existing.customerId);
          if (customer)
            await createReconsultReminder(
              existing.customerId,
              existing.agentId,
              new Date(input.nextContactAt),
              customer.name
            );
        }
        await log(
          ctx.user.id,
          "CONSULTATION_UPDATED",
          "consultation",
          input.id,
          JSON.stringify({ before: beforeSnapshot, after: afterSnapshot })
        );
        return { success: true };
      }),
  }),

  // ── Contracts ─────────────────────────────────────────────────────────────
  contracts: router({
    listByCustomer: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getContractsByCustomer(input.customerId);
      }),

    list: activeUserProcedure
      .input(z.object({ scope: z.enum(["all", "mine"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (input?.scope === "all" && user.role !== "branch_admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "전체 계약은 지점장만 조회할 수 있습니다.",
          });
        }
        if (user.role === "branch_admin")
          return getAllContracts(
            input?.scope === "mine" ? { agentId: user.id } : {}
          );
        if (user.role === "sub_branch_admin" || user.role === "team_leader") {
          return getAllContracts({
            agentIds: await getHierarchyScopeUserIds(user),
          });
        }
        return getAllContracts({ agentId: user.id });
      }),

    contractHistory: activeUserProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ ctx, input }) => {
        const contract = await getContractById(input.contractId);
        if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, contract.customerId);
        return getContractHistory(input.contractId);
      }),

    create: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          company: z.string().optional(),
          productName: z.string().optional(),
          productGroup: z.string().optional(),
          contractDate: z.string().optional(),
          monthlyPremium: z.number().optional(),
          paymentStatus: z
            .enum(["정상", "미납", "실효", "해지"])
            .default("정상"),
          contractStatus: z
            .enum(["청약", "성립", "철회", "유지", "해지"])
            .default("청약"),
          memo: z.string().optional(),
          agentIdOverride: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const customer = await verifyCustomerAccess(user, input.customerId);

        if (
          !input.agentIdOverride &&
          !customer.agentId &&
          user.role !== "member"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "계약 담당 설계사를 선택해야 합니다. 지점장/부지점장은 계약 담당자로 지정될 수 없습니다.",
          });
        }
        const finalAgentId =
          input.agentIdOverride ?? customer.agentId ?? user.id;
        const finalAgent = await verifyAgentTarget(user, finalAgentId);

        const { contractDate, agentIdOverride, ...rest } = input;
        const contractDateObj = contractDate
          ? new Date(contractDate)
          : undefined;
        await createContract({
          ...rest,
          agentId: finalAgentId,
          contractDate: contractDateObj,
          createdBy: ctx.user.id,
        });
        const allContracts = await getContractsByCustomer(input.customerId);
        const newContract = allContracts[0];
        await log(
          ctx.user.id,
          "CONTRACT_CREATED",
          "contract",
          newContract?.id,
          logDetails({
            actor: ctx.user.id,
            targetId: newContract?.id ?? null,
            targetType: "contract",
            beforeValue: null,
            afterValue: {
              customerId: input.customerId,
              agentId: finalAgentId,
              teamId: finalAgent.teamId ?? null,
              subBranchAdminId: finalAgent.subBranchAdminId ?? null,
              company: input.company ?? null,
              productGroup: input.productGroup ?? null,
              contractStatus: input.contractStatus,
              paymentStatus: input.paymentStatus,
            },
          })
        );

        if (contractDateObj) {
          if (newContract)
            await createContractReminders(
              newContract.id,
              finalAgentId,
              contractDateObj,
              customer.name
            );
        }
        return { success: true };
      }),

    update: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          company: z.string().optional(),
          productName: z.string().optional(),
          productGroup: z.string().optional(),
          contractDate: z.string().optional(),
          monthlyPremium: z.number().optional(),
          paymentStatus: z.enum(["정상", "미납", "실효", "해지"]).optional(),
          contractStatus: z
            .enum(["청약", "성립", "철회", "유지", "해지"])
            .optional(),
          memo: z.string().optional(),
          newAgentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, contractDate, paymentStatus, newAgentId, ...rest } = input;
        const existing = await getContractById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, existing.customerId);

        let verifiedNewAgent:
          | Awaited<ReturnType<typeof verifyAgentTarget>>
          | undefined;
        if (newAgentId !== undefined) {
          verifiedNewAgent = await verifyAgentTarget(ctx.user, newAgentId);
        }

        // contract_history 기록
        const fieldsToCheck: (keyof typeof rest)[] = [
          "company",
          "productName",
          "productGroup",
          "monthlyPremium",
          "contractStatus",
          "memo",
        ];
        for (const field of fieldsToCheck) {
          if (
            rest[field] !== undefined &&
            String((existing as any)[field] ?? "") !== String(rest[field] ?? "")
          ) {
            await createContractHistoryEntry({
              contractId: id,
              changedBy: ctx.user.id,
              fieldName: field,
              beforeValue: String((existing as any)[field] ?? ""),
              afterValue: String(rest[field] ?? ""),
            });
          }
        }
        if (paymentStatus && paymentStatus !== existing.paymentStatus) {
          await createContractHistoryEntry({
            contractId: id,
            changedBy: ctx.user.id,
            fieldName: "paymentStatus",
            beforeValue: existing.paymentStatus ?? "",
            afterValue: paymentStatus,
          });
        }
        if (newAgentId && newAgentId !== existing.agentId) {
          await createContractHistoryEntry({
            contractId: id,
            changedBy: ctx.user.id,
            fieldName: "agentId",
            beforeValue: String(existing.agentId),
            afterValue: String(newAgentId),
          });
          await log(
            ctx.user.id,
            "CONTRACT_OWNER_CHANGED",
            "contract",
            id,
            logDetails({
              actor: ctx.user.id,
              targetId: id,
              targetType: "contract",
              beforeValue: { previousAgentId: existing.agentId },
              afterValue: {
                newAgentId,
                newTeamId: verifiedNewAgent?.teamId ?? null,
                newSubBranchAdminId: verifiedNewAgent?.subBranchAdminId ?? null,
              },
            })
          );
        }

        await updateContract(id, {
          ...rest,
          paymentStatus,
          agentId: newAgentId ?? existing.agentId,
          contractDate: contractDate ? new Date(contractDate) : undefined,
        });
        await log(
          ctx.user.id,
          "CONTRACT_UPDATED",
          "contract",
          id,
          logDetails({
            actor: ctx.user.id,
            targetId: id,
            targetType: "contract",
            beforeValue: {
              company: existing.company,
              productName: existing.productName,
              productGroup: existing.productGroup,
              monthlyPremium: existing.monthlyPremium,
              paymentStatus: existing.paymentStatus,
              contractStatus: existing.contractStatus,
              agentId: existing.agentId,
            },
            afterValue: {
              ...rest,
              paymentStatus: paymentStatus ?? existing.paymentStatus,
              agentId: newAgentId ?? existing.agentId,
            },
          })
        );

        if (
          paymentStatus &&
          existing &&
          paymentStatus !== existing.paymentStatus
        ) {
          const customer = existing.customerId
            ? await getCustomerById(existing.customerId)
            : null;
          if (customer)
            await createPaymentStatusReminder(
              id,
              newAgentId ?? existing.agentId,
              paymentStatus,
              customer.name
            );
        }
        return { success: true };
      }),

    deactivate: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await verifyContractDeleteAccess(ctx.user, input.id);
        await createContractHistoryEntry({
          contractId: input.id,
          changedBy: ctx.user.id,
          fieldName: "isActive",
          beforeValue: String(existing.isActive),
          afterValue: "false",
        });
        await deactivateContract(input.id);
        await log(
          ctx.user.id,
          "CONTRACT_DEACTIVATED",
          "contract",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "contract",
            beforeValue: {
              isActive: existing.isActive,
              deletedAt: (existing as any).deletedAt ?? null,
              contractStatus: existing.contractStatus,
            },
            afterValue: { isActive: false },
            metadata: { deleteMode: "soft" },
          })
        );
        return { success: true };
      }),
  }),

  // ── Schedules ─────────────────────────────────────────────────────────────
  deletedData: router({
    listTeams: branchAdminProcedure.query(async () => getDeletedTeams()),
    listCustomers: branchAdminProcedure.query(async () =>
      getDeletedCustomers()
    ),
    listContracts: branchAdminProcedure.query(async () =>
      getDeletedContracts()
    ),

    restoreTeam: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await requireSoftDeletedTeam(input.id);
        await runDbTransaction(async tx => {
          await restoreTeam(input.id, tx);
          await log(
            ctx.user.id,
            "TEAM_RESTORED",
            "team",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "team",
              beforeValue: {
                isActive: existing.isActive,
                deletedAt: (existing as any).deletedAt ?? null,
              },
              afterValue: { isActive: true, deletedAt: null },
            }),
            tx
          );
        });
        return { success: true };
      }),

    restoreCustomer: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await requireSoftDeletedCustomer(input.id);
        if (existing.phone) {
          const dup = await checkPhoneDuplicate(existing.phone, input.id);
          if (dup)
            throw new TRPCError({
              code: "CONFLICT",
              message: "동일 연락처의 활성 고객이 있어 복구할 수 없습니다.",
            });
        }
        await runDbTransaction(async tx => {
          await restoreCustomer(input.id, tx);
          await log(
            ctx.user.id,
            "CUSTOMER_RESTORED",
            "customer",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "customer",
              beforeValue: {
                isActive: existing.isActive,
                deletedAt: (existing as any).deletedAt ?? null,
              },
              afterValue: { isActive: true, deletedAt: null },
            }),
            tx
          );
        });
        return { success: true };
      }),

    restoreContract: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await requireSoftDeletedContract(input.id);
        const customer = await getCustomerById(existing.customerId);
        if (!customer || !customer.isActive || (customer as any).deletedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "연결 고객이 비활성 상태라 계약을 복구할 수 없습니다.",
          });
        }
        await runDbTransaction(async tx => {
          await restoreContract(input.id, tx);
          await createContractHistoryEntry(
            {
              contractId: input.id,
              changedBy: ctx.user.id,
              fieldName: "isActive",
              beforeValue: String(existing.isActive),
              afterValue: "true",
            },
            tx
          );
          await log(
            ctx.user.id,
            "CONTRACT_RESTORED",
            "contract",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "contract",
              beforeValue: {
                isActive: existing.isActive,
                deletedAt: (existing as any).deletedAt ?? null,
              },
              afterValue: { isActive: true, deletedAt: null },
            }),
            tx
          );
        });
        return { success: true };
      }),

    permanentDeleteTeam: branchAdminProcedure
      .input(z.object({ id: z.number(), confirmText: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== PERMANENT_DELETE_CONFIRM_TEXT)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE,
          });
        const existing = await requireSoftDeletedTeam(input.id);
        const blockers = await getTeamPermanentDeleteBlockers(input.id);
        const hasBlockers = Object.values(blockers).some(count => count > 0);
        if (hasBlockers) {
          await log(
            ctx.user.id,
            "PERMANENT_DELETE_BLOCKED",
            "team",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "team",
              metadata: {
                reason: "linked_operational_history_exists",
                blockers,
              },
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: TEAM_PERMANENT_DELETE_BLOCKED_MESSAGE,
          });
        }
        await runDbTransaction(async tx => {
          await log(
            ctx.user.id,
            "TEAM_PERMANENTLY_DELETED",
            "team",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "team",
              beforeValue: { id: existing.id, isActive: existing.isActive },
            }),
            tx
          );
          await permanentlyDeleteTeam(input.id, tx);
        });
        return { success: true };
      }),

    permanentDeletePreview: branchAdminProcedure
      .input(
        z.object({ type: z.enum(["customer", "contract"]), id: z.number() })
      )
      .query(async ({ input }) => {
        if (input.type === "customer") {
          const existing = await requireSoftDeletedCustomer(input.id);
          const blockers = await getCustomerPermanentDeleteBlockers(input.id);
          const linkedCount = Object.values(blockers).reduce(
            (sum, count) => sum + Number(count ?? 0),
            0
          );
          return {
            type: input.type,
            id: input.id,
            targetName: existing.name,
            canDelete: linkedCount === 0,
            linkedCount,
            blockers,
          };
        }
        const existing = await requireSoftDeletedContract(input.id);
        const blockers = await getContractPermanentDeleteBlockers(input.id);
        const linkedCount = Object.values(blockers).reduce(
          (sum, count) => sum + Number(count ?? 0),
          0
        );
        return {
          type: input.type,
          id: input.id,
          targetName: existing.productName ?? `contract #${existing.id}`,
          customerId: existing.customerId,
          canDelete: linkedCount === 0,
          linkedCount,
          blockers,
        };
      }),

    permanentDeleteCustomer: branchAdminProcedure
      .input(
        z.object({
          id: z.number(),
          confirmText: z.string(),
          reason: permanentDeleteReasonSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== PERMANENT_DELETE_CONFIRM_TEXT)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE,
          });
        const safeReason = sanitizePermanentDeleteReason(input.reason);
        const existing = await requireSoftDeletedCustomer(input.id);
        const blockers = await getCustomerPermanentDeleteBlockers(input.id);
        const hasBlockers = Object.values(blockers).some(count => count > 0);
        if (hasBlockers) {
          await log(
            ctx.user.id,
            "PERMANENT_DELETE_BLOCKED",
            "customer",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "customer",
              metadata: {
                reason: safeReason,
                blockedReason: "linked_operational_history_exists",
                linkedSummary: blockers,
              },
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: CUSTOMER_PERMANENT_DELETE_BLOCKED_MESSAGE,
          });
        }
        await runDbTransaction(async tx => {
          await log(
            ctx.user.id,
            "CUSTOMER_PERMANENTLY_DELETED",
            "customer",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "customer",
              beforeValue: {
                id: existing.id,
                isActive: existing.isActive,
                deletedAt: (existing as any).deletedAt ?? null,
              },
              metadata: { reason: safeReason, linkedSummary: blockers },
            }),
            tx
          );
          await permanentlyDeleteCustomer(input.id, tx);
        });
        return { success: true };
      }),

    permanentDeleteContract: branchAdminProcedure
      .input(
        z.object({
          id: z.number(),
          confirmText: z.string(),
          reason: permanentDeleteReasonSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== PERMANENT_DELETE_CONFIRM_TEXT)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE,
          });
        const safeReason = sanitizePermanentDeleteReason(input.reason);
        const existing = await requireSoftDeletedContract(input.id);
        const blockers = await getContractPermanentDeleteBlockers(input.id);
        const hasBlockers = Object.values(blockers).some(count => count > 0);
        if (hasBlockers) {
          await log(
            ctx.user.id,
            "PERMANENT_DELETE_BLOCKED",
            "contract",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "contract",
              metadata: {
                reason: safeReason,
                blockedReason: "linked_operational_history_exists",
                linkedSummary: blockers,
              },
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: CONTRACT_PERMANENT_DELETE_BLOCKED_MESSAGE,
          });
        }
        await runDbTransaction(async tx => {
          await log(
            ctx.user.id,
            "CONTRACT_PERMANENTLY_DELETED",
            "contract",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "contract",
              beforeValue: {
                id: existing.id,
                customerId: existing.customerId,
                isActive: existing.isActive,
                deletedAt: (existing as any).deletedAt ?? null,
              },
              metadata: { reason: safeReason, linkedSummary: blockers },
            }),
            tx
          );
          await permanentlyDeleteContract(input.id, tx);
        });
        return { success: true };
      }),
  }),

  deleteRequests: router({
    createContractDeleteRequest: activeUserProcedure
      .input(
        z.object({
          contractId: z.number(),
          requestReason: z.string().min(1),
          requestMemo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const contract = await verifyContractDeleteRequestAccess(
          ctx.user,
          input.contractId
        );
        const existingPending = await getPendingDeleteRequestForTarget(
          "contract",
          input.contractId
        );
        if (existingPending)
          throw new TRPCError({
            code: "CONFLICT",
            message: "이미 처리 대기 중인 삭제 요청이 있습니다.",
          });
        await createDeleteRequest({
          requestType: "contract_delete",
          targetType: "contract",
          targetId: input.contractId,
          customerId: contract.customerId,
          requestedBy: ctx.user.id,
          requestReason: input.requestReason,
          requestMemo: input.requestMemo,
          expectedImpact: "performance_exclusion",
          status: "pending",
        });
        await log(
          ctx.user.id,
          "DELETE_REQUEST_CREATED",
          "delete_request",
          input.contractId,
          logDetails({
            actor: ctx.user.id,
            targetId: input.contractId,
            targetType: "contract",
            metadata: {
              requestType: "contract_delete",
              expectedImpact: "performance_exclusion",
              reason: input.requestReason,
            },
          })
        );
        const createdRequest = await getPendingDeleteRequestForTarget(
          "contract",
          input.contractId
        );
        if (createdRequest) {
          await pushNotifications.sendContractDeleteRequestPush(
            createdRequest.id
          );
        }
        return { success: true };
      }),

    listMyRequests: activeUserProcedure.query(async ({ ctx }) => {
      const requests = await getDeleteRequests({ requestedBy: ctx.user.id });
      return Promise.all(requests.map(buildDeleteRequestView));
    }),

    listAllRequestsForAdmin: branchAdminProcedure
      .input(
        z
          .object({
            status: z
              .enum(["pending", "approved", "rejected", "cancelled"])
              .optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const requests = await getDeleteRequests({ status: input?.status });
        return Promise.all(requests.map(buildDeleteRequestView));
      }),

    approve: branchAdminProcedure
      .input(z.object({ id: z.number(), reviewComment: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const request = await getDeleteRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        if (request.status !== "pending")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "pending 상태의 요청만 승인할 수 있습니다.",
          });
        const contract = await getContractById(request.targetId);
        if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
        if (!contract.isActive || (contract as any).deletedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 비활성 처리된 계약입니다.",
          });
        await runDbTransaction(async tx => {
          await deactivateContractWithClient(contract.id, tx);
          await createContractHistoryEntry(
            {
              contractId: contract.id,
              changedBy: ctx.user.id,
              fieldName: "isActive",
              beforeValue: String(contract.isActive),
              afterValue: "false",
            },
            tx
          );
          await updateDeleteRequest(
            input.id,
            {
              status: "approved",
              reviewedBy: ctx.user.id,
              reviewedAt: new Date(),
              reviewComment: input.reviewComment,
            },
            tx
          );
          await log(
            ctx.user.id,
            "DELETE_REQUEST_APPROVED",
            "delete_request",
            input.id,
            logDetails({
              actor: ctx.user.id,
              targetId: input.id,
              targetType: "delete_request",
              beforeValue: { status: request.status },
              afterValue: { status: "approved", reviewedBy: ctx.user.id },
              metadata: {
                contractId: contract.id,
                expectedImpact: request.expectedImpact,
              },
            }),
            tx
          );
          await log(
            ctx.user.id,
            "CONTRACT_DEACTIVATED_BY_REQUEST",
            "contract",
            contract.id,
            logDetails({
              actor: ctx.user.id,
              targetId: contract.id,
              targetType: "contract",
              beforeValue: {
                isActive: contract.isActive,
                deletedAt: (contract as any).deletedAt ?? null,
              },
              afterValue: { isActive: false },
              metadata: {
                deleteRequestId: input.id,
                expectedImpact: "performance_exclusion",
              },
            }),
            tx
          );
        });
        return { success: true };
      }),

    reject: branchAdminProcedure
      .input(z.object({ id: z.number(), reviewComment: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const request = await getDeleteRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        if (request.status !== "pending")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "pending 상태의 요청만 반려할 수 있습니다.",
          });
        await updateDeleteRequest(input.id, {
          status: "rejected",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          reviewComment: input.reviewComment,
        });
        await log(
          ctx.user.id,
          "DELETE_REQUEST_REJECTED",
          "delete_request",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "delete_request",
            beforeValue: { status: request.status },
            afterValue: { status: "rejected", reviewedBy: ctx.user.id },
            metadata: { contractId: request.targetId },
          })
        );
        return { success: true };
      }),

    cancelMyRequest: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const request = await getDeleteRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        if (request.requestedBy !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (request.status !== "pending")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "pending 상태의 요청만 취소할 수 있습니다.",
          });
        await updateDeleteRequest(input.id, { status: "cancelled" });
        await log(
          ctx.user.id,
          "DELETE_REQUEST_CANCELLED",
          "delete_request",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "delete_request",
            beforeValue: { status: request.status },
            afterValue: { status: "cancelled" },
            metadata: { contractId: request.targetId },
          })
        );
        return { success: true };
      }),
  }),

  imports: router({
    listBatches: branchAdminProcedure
      .input(
        z
          .object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            status: z
              .enum(["active", "cancelled", "partially_cancelled", "failed"])
              .optional(),
            uploadedBy: z.number().optional(),
            search: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const batches = await listImportBatches({
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
          status: input?.status,
          uploadedBy: input?.uploadedBy,
          search: input?.search,
        });
        return Promise.all(
          batches.map(async batch => {
            const customersInBatch = await getCustomersByImportBatch(
              batch.importBatchId
            );
            const activeCustomerCount = customersInBatch.filter(
              c => c.isActive && !(c as any).deletedAt
            ).length;
            const cancelledCustomerCount = customersInBatch.filter(
              c => !c.isActive || (c as any).deletedAt
            ).length;
            const uploader = await getUserById(batch.uploadedBy);
            return {
              ...batch,
              uploader: uploader
                ? { id: uploader.id, name: uploader.name, role: uploader.role }
                : null,
              activeCustomerCount,
              cancelledCustomerCount,
            };
          })
        );
      }),

    getBatchDetail: branchAdminProcedure
      .input(z.object({ importBatchId: z.string() }))
      .query(async ({ input, ctx }) => {
        const batch = await getImportBatchByBatchId(input.importBatchId);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
        const customersInBatch = await getCustomersByImportBatch(
          input.importBatchId
        );
        const blockers = await getImportBatchCancelBlockers(
          input.importBatchId
        );
        const uploader = await getUserById(batch.uploadedBy);
        const customersWithSummary = await Promise.all(
          customersInBatch.map(async customer => {
            const agent = customer.agentId
              ? await getUserById(customer.agentId)
              : undefined;
            return {
              id: customer.id,
              name: customer.name,
              maskedPhone: customer.phone ? maskPhone(customer.phone) : null,
              consultStatus: customer.consultStatus,
              agent: agent ? { id: agent.id, name: agent.name } : null,
              assignmentStatus: customer.assignmentStatus,
              createdAt: customer.createdAt,
              status:
                customer.isActive && !(customer as any).deletedAt
                  ? "active"
                  : "inactive",
              hasLinkedData: blockers.blockedCustomerIds.includes(customer.id),
            };
          })
        );
        await log(
          ctx.user.id,
          "IMPORT_BATCH_VIEWED",
          "import_batch",
          batch.id,
          logDetails({
            actor: ctx.user.id,
            targetId: batch.id,
            targetType: "import_batch",
            metadata: {
              importBatchId: input.importBatchId,
              customerCount: customersInBatch.length,
              blockedCustomerCount: blockers.blockedCustomerIds.length,
            },
          })
        );
        return {
          batch: {
            ...batch,
            uploader: uploader
              ? { id: uploader.id, name: uploader.name, role: uploader.role }
              : null,
          },
          customers: customersWithSummary,
          blockers,
        };
      }),

    cancelBatch: branchAdminProcedure
      .input(
        z.object({
          importBatchId: z.string(),
          confirmText: z.string(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== IMPORT_BATCH_CANCEL_CONFIRM_TEXT)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE,
          });
        const batch = await getImportBatchByBatchId(input.importBatchId);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
        if (batch.status === "cancelled")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: IMPORT_BATCH_ALREADY_CANCELLED_MESSAGE,
          });
        const customersInBatch = await getCustomersByImportBatch(
          input.importBatchId
        );
        const activeCustomers = customersInBatch.filter(
          c => c.isActive && !(c as any).deletedAt
        );
        if (activeCustomers.length === 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: IMPORT_BATCH_NO_ACTIVE_CUSTOMERS_MESSAGE,
          });
        const blockers = await getImportBatchCancelBlockers(
          input.importBatchId
        );
        if (blockers.blockedCustomerIds.length > 0) {
          await log(
            ctx.user.id,
            "IMPORT_BATCH_CANCEL_BLOCKED",
            "import_batch",
            batch.id,
            logDetails({
              actor: ctx.user.id,
              targetId: batch.id,
              targetType: "import_batch",
              metadata: {
                importBatchId: input.importBatchId,
                blockedCustomerCount: blockers.blockedCustomerIds.length,
                relatedCounts: blockers,
              },
            })
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: IMPORT_BATCH_CANCEL_BLOCKED_MESSAGE,
          });
        }
        await runDbTransaction(async tx => {
          await softDeleteCustomersByImportBatch(input.importBatchId, tx);
          await updateImportBatch(
            input.importBatchId,
            {
              status: "cancelled",
              cancelledBy: ctx.user.id,
              cancelledAt: new Date(),
              cancelReason: input.reason,
            },
            tx
          );
          await log(
            ctx.user.id,
            "IMPORT_BATCH_CANCELLED",
            "import_batch",
            batch.id,
            logDetails({
              actor: ctx.user.id,
              targetId: batch.id,
              targetType: "import_batch",
              beforeValue: {
                status: batch.status,
                activeCustomerCount: activeCustomers.length,
              },
              afterValue: { status: "cancelled", activeCustomerCount: 0 },
              metadata: {
                importBatchId: input.importBatchId,
                affectedCustomerCount: activeCustomers.length,
                reason: input.reason,
              },
            }),
            tx
          );
          await log(
            ctx.user.id,
            "CUSTOMER_DEACTIVATED_BY_BATCH_CANCELLED",
            "customer",
            undefined,
            logDetails({
              actor: ctx.user.id,
              targetType: "customer",
              afterValue: { isActive: false },
              metadata: {
                importBatchId: input.importBatchId,
                affectedCustomerCount: activeCustomers.length,
              },
            }),
            tx
          );
        });
        return { success: true, affectedCustomerCount: activeCustomers.length };
      }),
  }),

  schedules: router({
    list: activeUserProcedure
      .input(
        z
          .object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            viewMode: z
              .enum(["mine", "user", "team", "organization"])
              .default("mine"),
            ownerUserId: z.number().optional(),
            teamId: z.number().optional(),
            calendarCategory: z
              .enum(SCHEDULE_CALENDAR_CATEGORIES)
              .or(z.literal("all"))
              .optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) =>
        listCalendarSchedules(ctx.user, input ?? { viewMode: "mine" })
      ),

    create: activeUserProcedure
      .input(
        z.object({
          title: z.string().min(1),
          type: z.enum([
            "고객상담",
            "재통화",
            "계약예정",
            "보장분석",
            "해지방어",
            "팀회의",
            "교육",
            "외근",
            "휴무",
            "기타",
          ]),
          status: z
            .enum(["예정", "완료", "취소", "변경", "노쇼", "보류"])
            .default("예정"),
          startTime: z.string(),
          endTime: z.string().nullable().optional(),
          memo: z.string().optional(),
          description: z.string().optional(),
          reminderDayBefore: z.boolean().default(true),
          reminderSameDay: z.boolean().default(true),
          reminderOneHourBefore: z.boolean().default(true),
          reminderOffsetMinutes: z
            .union([
              z.literal(-1),
              z.literal(0),
              z.literal(30),
              z.literal(60),
              z.literal(120),
              z.literal(180),
              z.literal(1440),
            ])
            .default(30),
          targetUserId: z.number().optional(),
          customerId: z.number().optional(),
          calendarCategory: z.enum(SCHEDULE_CALENDAR_CATEGORIES).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        let targetUserId = user.id;
        if (input.targetUserId) {
          await verifyTargetUserAccess(user, input.targetUserId);
          await assertActiveScheduleTarget(input.targetUserId);
          targetUserId = input.targetUserId;
        }
        const targetUser = await getUserById(targetUserId);
        let linkedCustomerId: number | undefined;
        if (input.customerId !== undefined) {
          const customer = await verifyCustomerAccess(user, input.customerId);
          if (!customer.isActive || customer.deletedAt)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Inactive customers cannot be linked to schedules.",
            });
          linkedCustomerId = customer.id;
        }
        const startTimeDate = parseScheduleDateTime(
          input.startTime,
          "시작 시간"
        );
        const endTimeDate = input.endTime
          ? parseScheduleDateTime(input.endTime, "종료 시간")
          : undefined;
        assertScheduleEndAfterStart(startTimeDate, endTimeDate);
        const reminderFlags = reminderFlagsFromOffset(
          input.reminderOffsetMinutes
        );
        const resolvedCategory = resolveCalendarCategoryForSave({
          requestedCategory: input.calendarCategory,
          scheduleType: input.type,
          customerId: linkedCustomerId,
          ownerRole: targetUser?.role ?? user.role,
        });
        assertCanSelectCalendarCategory(user.role, resolvedCategory);

        await createSchedule({
          userId: targetUserId,
          customerId: linkedCustomerId,
          title: input.title,
          type: input.type,
          status: input.status,
          startTime: startTimeDate,
          endTime: endTimeDate,
          memo: input.memo,
          description: input.description,
          calendarCategory: resolvedCategory,
          reminderOffsetMinutes: input.reminderOffsetMinutes,
          ...reminderFlags,
          createdBy: ctx.user.id,
        });
        await log(
          ctx.user.id,
          "SCHEDULE_CREATED",
          "schedule",
          undefined,
          `title=${input.title}`
        );

        const allSchedules = await getSchedules({ userId: targetUserId });
        const newSchedule = allSchedules.find(
          s =>
            s.title === input.title &&
            s.startTime.getTime() === startTimeDate.getTime()
        );
        if (newSchedule) {
          await cancelScheduleTimingNotifications(targetUserId, newSchedule.id);
          if (input.reminderOffsetMinutes >= 0) {
            await createScheduleReminderByOffset(
              newSchedule.id,
              targetUserId,
              startTimeDate,
              input.title,
              input.reminderOffsetMinutes
            );
          }
          if (endTimeDate)
            await createScheduleIncompleteReminder(
              newSchedule.id,
              targetUserId,
              endTimeDate,
              input.title
            );
          void triggerGoogleCalendarSyncForScheduleId(
            ctx.user.id,
            newSchedule.id
          );
          await logCalendarCategoryActivity(
            ctx.user,
            "CALENDAR_CATEGORY_SELECTED",
            {
              calendarCategory: resolvedCategory,
              boaEventId: newSchedule.id,
              boaEventType: "calendar_event",
              actorId: ctx.user.id,
            }
          );
        }
        return { success: true };
      }),

    update: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          type: z
            .enum([
              "고객상담",
              "재통화",
              "계약예정",
              "보장분석",
              "해지방어",
              "팀회의",
              "교육",
              "외근",
              "휴무",
              "기타",
            ])
            .optional(),
          status: z
            .enum(["예정", "완료", "취소", "변경", "노쇼", "보류"])
            .optional(),
          startTime: z.string().optional(),
          endTime: z.string().nullable().optional(),
          memo: z.string().optional(),
          reminderOffsetMinutes: z
            .union([
              z.literal(-1),
              z.literal(0),
              z.literal(30),
              z.literal(60),
              z.literal(120),
              z.literal(180),
              z.literal(1440),
            ])
            .optional(),
          customerId: z.number().nullable().optional(),
          calendarCategory: z.enum(SCHEDULE_CALENDAR_CATEGORIES).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const {
          id,
          startTime,
          endTime,
          status,
          reminderOffsetMinutes,
          customerId,
          calendarCategory,
          ...rest
        } = input;
        const user = ctx.user;

        // 역할별 범위 조회로 소유권 검증 (조건 3 수정)
        const allSchedulesList = await getAccessibleSchedules(user);

        const existing = allSchedulesList.find(s => s.id === id);
        if (!existing)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "해당 일정에 접근 권한이 없습니다.",
          });

        if (existing.userId !== user.id)
          await assertActiveScheduleTarget(existing.userId);

        const actionLabel =
          status === "취소"
            ? "SCHEDULE_CANCELLED"
            : status === "완료"
              ? "SCHEDULE_COMPLETED"
              : "SCHEDULE_UPDATED";
        const parsedStartTime =
          startTime !== undefined
            ? parseScheduleDateTime(startTime, "시작 시간")
            : undefined;
        const parsedEndTime =
          endTime === undefined
            ? undefined
            : endTime === null || endTime === ""
              ? null
              : parseScheduleDateTime(endTime, "종료 시간");
        const effectiveStartTime = parsedStartTime ?? existing.startTime;
        const effectiveEndTime =
          parsedEndTime === undefined ? existing.endTime : parsedEndTime;
        assertScheduleEndAfterStart(effectiveStartTime, effectiveEndTime);

        const updateData: any = { ...rest };
        if (status !== undefined) updateData.status = status;
        if (parsedStartTime !== undefined)
          updateData.startTime = parsedStartTime;
        if (parsedEndTime !== undefined) updateData.endTime = parsedEndTime;
        if (customerId !== undefined) {
          if (customerId === null) {
            updateData.customerId = null;
          } else {
            const customer = await verifyCustomerAccess(user, customerId);
            if (!customer.isActive || customer.deletedAt)
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Inactive customers cannot be linked to schedules.",
              });
            updateData.customerId = customer.id;
          }
        }
        if (reminderOffsetMinutes !== undefined) {
          updateData.reminderOffsetMinutes = reminderOffsetMinutes;
          Object.assign(
            updateData,
            reminderFlagsFromOffset(reminderOffsetMinutes)
          );
        }

        const ownerUser = await getUserById(existing.userId);
        const previousCategory =
          existing.calendarCategory ??
          resolveCalendarCategoryForSave({
            scheduleType: existing.type,
            customerId: existing.customerId,
            ownerRole: ownerUser?.role ?? null,
            existingCategory: existing.calendarCategory,
          });
        if (calendarCategory !== undefined) {
          assertCanSelectCalendarCategory(user.role, calendarCategory);
          updateData.calendarCategory = calendarCategory;
        }

        if (status === "완료") {
          if (Object.keys(updateData).length)
            await updateSchedule(id, updateData);
          await completeSchedule(id);
          await cancelScheduleIncompleteNotification(existing.userId, id);
        } else if (status === "취소" || status === "노쇼") {
          await updateSchedule(id, updateData);
          await cancelScheduleTimingNotifications(existing.userId, id);
          await cancelScheduleIncompleteNotification(existing.userId, id);
        } else {
          await updateSchedule(id, updateData);
        }
        if (status !== "완료" && status !== "취소" && status !== "노쇼") {
          await cancelScheduleTimingNotifications(existing.userId, id);
          const effectiveReminderOffset =
            reminderOffsetMinutes ?? existing.reminderOffsetMinutes ?? 30;
          if (effectiveReminderOffset >= 0) {
            await createScheduleReminderByOffset(
              id,
              existing.userId,
              effectiveStartTime,
              rest.title ?? existing.title,
              effectiveReminderOffset
            );
          }
          await cancelScheduleIncompleteNotification(existing.userId, id);
          if (effectiveEndTime)
            await createScheduleIncompleteReminder(
              id,
              existing.userId,
              effectiveEndTime,
              rest.title ?? existing.title
            );
        }
        await log(ctx.user.id, actionLabel, "schedule", id);
        const updatedSchedule = await getScheduleById(id);
        if (updatedSchedule) {
          const nextCategory =
            updatedSchedule.calendarCategory ??
            resolveCalendarCategoryForSave({
              scheduleType: updatedSchedule.type,
              customerId: updatedSchedule.customerId,
              ownerRole: ownerUser?.role ?? null,
              existingCategory: updatedSchedule.calendarCategory,
            });
          if (
            calendarCategory !== undefined &&
            nextCategory !== previousCategory
          ) {
            await logCalendarCategoryActivity(
              ctx.user,
              "CALENDAR_CATEGORY_CHANGED",
              {
                previousCalendarCategory: previousCategory,
                nextCalendarCategory: nextCategory,
                calendarCategory: nextCategory,
                boaEventId: id,
                boaEventType: "calendar_event",
                actorId: ctx.user.id,
              }
            );
          }
          if (
            status === "취소" ||
            status === "노쇼" ||
            !updatedSchedule.isActive
          ) {
            const owner = await getUserById(updatedSchedule.userId);
            triggerGoogleCalendarDeleteForSchedule(
              ctx.user.id,
              updatedSchedule,
              owner?.role ?? null
            );
          } else {
            void triggerGoogleCalendarSyncForScheduleId(ctx.user.id, id);
          }
        }
        return { success: true };
      }),

    delete: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const allSchedulesList = await getAccessibleSchedules(user);

        const existing = allSchedulesList.find(s => s.id === input.id);
        if (!existing)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "해당 일정에 접근 권한이 없습니다.",
          });

        await softDeleteSchedule(input.id);
        await cancelScheduleTimingNotifications(existing.userId, input.id);
        await cancelScheduleIncompleteNotification(existing.userId, input.id);
        await log(ctx.user.id, "SCHEDULE_CANCELLED", "schedule", input.id);
        const owner = await getUserById(existing.userId);
        triggerGoogleCalendarDeleteForSchedule(
          ctx.user.id,
          existing,
          owner?.role ?? null
        );
        return { success: true };
      }),
  }),

  // ── Notifications ─────────────────────────────────────────────────────────
  followUps: router({
    create: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          nextContactDate: z.string(),
          reason: z.string().min(1),
          nextAction: z
            .enum([
              "전화",
              "카톡",
              "문자",
              "방문",
              "설계안 발송",
              "계약 확인",
              "보장분석",
              "사후관리",
              "기타",
            ])
            .default("전화"),
          memo: z.string().optional(),
          calendarSchedule: linkedScheduleInputSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "비활성 고객에는 후속관리를 등록할 수 없습니다.",
          });
        const nextContactDate = parseKstLocalDateTime(input.nextContactDate);
        if (Number.isNaN(nextContactDate.getTime()))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "다음 연락일이 올바르지 않습니다.",
          });
        const preparedSchedule = await prepareLinkedCustomerScheduleFromWork({
          actor: ctx.user,
          customer,
          schedule: input.calendarSchedule,
          fallbackStartTime: input.nextContactDate,
          defaultTitle: "후속관리 일정",
          defaultType: input.nextAction === "방문" ? "고객상담" : "재통화",
          defaultMemo: input.memo ?? input.reason,
        });
        const followUpId = await createFollowUp({
          customerId: customer.id,
          assignedAgentId: customer.agentId,
          teamId: customer.assignedTeamId,
          subBranchAdminId: customer.subBranchAdminId,
          nextContactDate,
          reason: input.reason,
          nextAction: input.nextAction,
          status: "scheduled",
          memo: input.memo,
          createdBy: ctx.user.id,
        });
        const scheduleCreated = await createPreparedLinkedCustomerSchedule(
          ctx.user.id,
          preparedSchedule
        );
        if (followUpId) {
          void triggerGoogleCalendarSyncForFollowUp(ctx.user.id, {
            followUpId,
            ownerUserId: customer.agentId ?? ctx.user.id,
            createdBy: ctx.user.id,
            customerId: customer.id,
            startTime: nextContactDate,
            reason: input.reason,
            nextAction: input.nextAction,
          });
        }
        await log(
          ctx.user.id,
          "FOLLOW_UP_CREATED",
          "customer",
          customer.id,
          logDetails({
            actor: ctx.user.id,
            targetId: customer.id,
            targetType: "customer",
            afterValue: {
              nextContactDate,
              reason: input.reason,
              nextAction: input.nextAction,
              status: "scheduled",
            },
            metadata: { customerId: customer.id, scheduleCreated },
          })
        );
        return { success: true };
      }),

    listByCustomer: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getFollowUps({ customerId: input.customerId });
      }),

    listToday: activeUserProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const date = input?.date
          ? parseKstLocalDateTime(input.date)
          : new Date();
        const scope = await getFollowUpScope(ctx.user);
        return getFollowUps({
          ...scope,
          statuses: ["scheduled", "postponed"],
          dueTo: toDayEnd(date),
        });
      }),

    listOverdue: activeUserProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const date = input?.date
          ? parseKstLocalDateTime(input.date)
          : new Date();
        const scope = await getFollowUpScope(ctx.user);
        return getFollowUps({
          ...scope,
          statuses: ["scheduled", "postponed"],
          dueTo: new Date(toDayStart(date).getTime() - 1),
        });
      }),

    complete: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const followUp = await verifyFollowUpAccess(ctx.user, input.id);
        if (!isOpenFollowUpStatus(followUp.status))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "처리 가능한 후속관리가 아닙니다.",
          });
        await updateFollowUp(input.id, {
          status: "completed",
          completedAt: new Date(),
          completedBy: ctx.user.id,
        });
        await log(
          ctx.user.id,
          "FOLLOW_UP_COMPLETED",
          "follow_up",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "follow_up",
            beforeValue: { status: followUp.status },
            afterValue: { status: "completed" },
            metadata: { customerId: followUp.customerId },
          })
        );
        return { success: true };
      }),

    postpone: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          nextContactDate: z.string(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const followUp = await verifyFollowUpAccess(ctx.user, input.id);
        if (!isOpenFollowUpStatus(followUp.status))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "연기 가능한 후속관리가 아닙니다.",
          });
        const nextContactDate = parseKstLocalDateTime(input.nextContactDate);
        if (Number.isNaN(nextContactDate.getTime()))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "다음 연락일이 올바르지 않습니다.",
          });
        await updateFollowUp(input.id, {
          status: "postponed",
          nextContactDate,
          reason: input.reason ?? followUp.reason,
        });
        await log(
          ctx.user.id,
          "FOLLOW_UP_POSTPONED",
          "follow_up",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "follow_up",
            beforeValue: {
              nextContactDate: followUp.nextContactDate,
              status: followUp.status,
            },
            afterValue: { nextContactDate, status: "postponed" },
            metadata: { customerId: followUp.customerId },
          })
        );
        return { success: true };
      }),

    cancel: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const followUp = await verifyFollowUpAccess(ctx.user, input.id);
        if (!isOpenFollowUpStatus(followUp.status))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "취소 가능한 후속관리가 아닙니다.",
          });
        await updateFollowUp(input.id, { status: "cancelled" });
        await log(
          ctx.user.id,
          "FOLLOW_UP_CANCELLED",
          "follow_up",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "follow_up",
            beforeValue: { status: followUp.status },
            afterValue: { status: "cancelled" },
            metadata: { customerId: followUp.customerId },
          })
        );
        return { success: true };
      }),
  }),

  aftercareCampaigns: router({
    list: activeUserProcedure
      .input(aftercareCampaignInputSchema.optional())
      .query(async ({ ctx, input }) => {
        const report = await buildAftercareCampaignData(ctx.user, input);
        return report.campaigns.map(campaign => ({
          campaignType: campaign.campaignType,
          policy: campaign.policy,
          summary: campaign.summary,
        }));
      }),

    summary: activeUserProcedure
      .input(aftercareCampaignInputSchema.optional())
      .query(async ({ ctx, input }) => {
        const report = await buildAftercareCampaignData(ctx.user, input);
        const total = report.campaigns.reduce(
          (acc, campaign) => ({
            targetCount: acc.targetCount + campaign.summary.targetCount,
            pendingCount: acc.pendingCount + campaign.summary.pendingCount,
            completedCount:
              acc.completedCount + campaign.summary.completedCount,
            overdueCount: acc.overdueCount + campaign.summary.overdueCount,
            highRiskCount: acc.highRiskCount + campaign.summary.highRiskCount,
          }),
          {
            targetCount: 0,
            pendingCount: 0,
            completedCount: 0,
            overdueCount: 0,
            highRiskCount: 0,
          }
        );
        return {
          generatedAt: report.generatedAt,
          summary: total,
          campaigns: report.campaigns.map(campaign => ({
            campaignType: campaign.campaignType,
            policy: campaign.policy,
            summary: campaign.summary,
          })),
        };
      }),

    detail: activeUserProcedure
      .input(
        aftercareCampaignInputSchema.extend({
          campaignType: z.enum(AFTERCARE_CAMPAIGN_TYPES),
        })
      )
      .query(async ({ ctx, input }) => {
        const report = await buildAftercareCampaignData(ctx.user, input);
        return report.campaigns[0] ?? null;
      }),

    targets: activeUserProcedure
      .input(
        aftercareCampaignInputSchema.extend({
          campaignType: z.enum(AFTERCARE_CAMPAIGN_TYPES),
        })
      )
      .query(async ({ ctx, input }) => {
        const report = await buildAftercareCampaignData(ctx.user, input);
        return report.campaigns[0]?.targets ?? [];
      }),

    getRecommendedTemplates: activeUserProcedure
      .input(
        z.object({
          campaignType: z.enum(AFTERCARE_CAMPAIGN_TYPES),
          customerId: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        if (input.customerId)
          await verifyCustomerAccess(ctx.user, input.customerId);
        const situations = AFTERCARE_TEMPLATE_SITUATION_MAP[input.campaignType];
        const templates = await getMessageTemplates(false);
        return templates
          .filter(template => situations.includes(template.situation))
          .map(template => ({
            id: template.id,
            title: template.title,
            situation: template.situation,
            channel: template.channel,
            complianceNote: template.complianceNote,
          }));
      }),

    createFollowUpForTarget: activeUserProcedure
      .input(
        z.object({
          campaignType: z.enum(AFTERCARE_CAMPAIGN_TYPES),
          customerId: z.number(),
          reason: z.string().min(1).max(200),
          dueDate: z.string(),
          memo: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "비활성 고객에는 후속관리를 등록할 수 없습니다.",
          });
        }
        const dueDate = parseKstLocalDateTime(input.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "후속관리 예정일이 올바르지 않습니다.",
          });
        }
        await createFollowUp({
          customerId: customer.id,
          assignedAgentId: customer.agentId,
          teamId: customer.assignedTeamId,
          subBranchAdminId: customer.subBranchAdminId,
          nextContactDate: dueDate,
          reason: input.reason,
          nextAction: "사후관리",
          status: "scheduled",
          memo: input.memo,
          createdBy: ctx.user.id,
        });
        await log(
          ctx.user.id,
          "AFTERCARE_CAMPAIGN_FOLLOW_UP_CREATED",
          "customer",
          customer.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "customer",
            targetId: customer.id,
            metadata: { campaignType: input.campaignType },
            afterValue: { dueDate, reason: input.reason },
          })
        );
        return { success: true };
      }),
  }),

  dashboard: router({
    todayWork: activeUserProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const baseDate = input?.date
          ? parseKstLocalDateTime(input.date)
          : new Date();
        const baseRange = getKstDayRange(baseDate);
        const monthYear = Number(baseRange.dateKey.slice(0, 4));
        const monthNumber = Number(baseRange.dateKey.slice(5, 7));
        const nextMonthYear = monthNumber === 12 ? monthYear + 1 : monthYear;
        const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
        const monthStart = parseKstLocalDateTime(
          `${baseRange.dateKey.slice(0, 7)}-01`
        );
        const nextMonthStart = parseKstLocalDateTime(
          `${nextMonthYear}-${String(nextMonthNumber).padStart(2, "0")}-01`
        );
        const {
          customerList,
          contractList,
          scheduleList,
          notifications,
          followUpList,
        } = await getScopedDashboardData(ctx.user);
        const customerMap = new Map(
          customerList.map(customer => [customer.id, customer])
        );
        const todayEnd = toDayEnd(baseDate);

        const todaySchedules = scheduleList
          .filter(
            schedule =>
              isSameCalendarDay(new Date(schedule.startTime), baseDate) &&
              !isFinishedScheduleStatus(schedule.status)
          )
          .sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );

        const incompleteSchedules = scheduleList
          .filter(schedule => {
            const deadline = schedule.endTime ?? schedule.startTime;
            return (
              new Date(deadline).getTime() <= baseDate.getTime() &&
              !isFinishedScheduleStatus(schedule.status)
            );
          })
          .sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );

        const pendingNotifications = notifications
          .filter(notification => isUnreadNotification(notification))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

        const todayFollowUps = followUpList
          .filter(
            followUp =>
              isOpenFollowUpStatus(followUp.status) &&
              new Date(followUp.nextContactDate).getTime() <= todayEnd.getTime()
          )
          .sort(
            (a, b) =>
              new Date(a.nextContactDate).getTime() -
              new Date(b.nextContactDate).getTime()
          );

        const overdueFollowUps = followUpList
          .filter(
            followUp =>
              isOpenFollowUpStatus(followUp.status) &&
              new Date(followUp.nextContactDate).getTime() <
                toDayStart(baseDate).getTime()
          )
          .sort(
            (a, b) =>
              new Date(a.nextContactDate).getTime() -
              new Date(b.nextContactDate).getTime()
          );

        const longUnmanagedCustomers = notifications
          .filter(
            notification =>
              notification.type === "long_unmanaged_90" &&
              notification.relatedType === "customer" &&
              notification.relatedId
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .map(notification => {
            const customer = customerMap.get(notification.relatedId ?? 0);
            if (!customer || !customer.isActive) return null;
            return {
              id: customer.id,
              name: customer.name,
              consultStatus: customer.consultStatus,
              agentId: customer.agentId,
              createdAt: notification.createdAt,
            };
          })
          .filter(item => item !== null)
          .slice(0, 10);

        const monthlyContracts = contractList.filter(contract => {
          if (!contract.contractDate) return false;
          const contractDate = new Date(contract.contractDate);
          return (
            contract.isActive &&
            contractDate >= monthStart &&
            contractDate < nextMonthStart
          );
        });
        const monthlyPremiumSum = monthlyContracts.reduce(
          (sum, contract) => sum + Number(contract.monthlyPremium ?? 0),
          0
        );

        return {
          scope: ctx.user.role,
          cards: {
            todayScheduleCount: todaySchedules.length,
            incompleteScheduleCount: incompleteSchedules.length,
            pendingNotificationCount: pendingNotifications.length,
            longUnmanagedCustomerCount: longUnmanagedCustomers.length,
            monthlyContractCount: monthlyContracts.length,
            monthlyPremiumSum,
            todayFollowUpCount: todayFollowUps.length,
            overdueFollowUpCount: overdueFollowUps.length,
          },
          todaySchedules: todaySchedules.slice(0, 8).map(schedule => ({
            id: schedule.id,
            title: schedule.title,
            type: schedule.type,
            status: schedule.status,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            userId: schedule.userId,
          })),
          incompleteSchedules: incompleteSchedules
            .slice(0, 8)
            .map(schedule => ({
              id: schedule.id,
              title: schedule.title,
              type: schedule.type,
              status: schedule.status,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              userId: schedule.userId,
            })),
          pendingNotifications: pendingNotifications
            .slice(0, 8)
            .map(notification => {
              const customer =
                notification.relatedType === "customer"
                  ? customerMap.get(notification.relatedId ?? 0)
                  : undefined;
              return {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                processStatus: notification.processStatus,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
                relatedType: notification.relatedType,
                relatedId: notification.relatedId,
                customerName: customer?.name ?? null,
              };
            }),
          longUnmanagedCustomers,
          todayFollowUps: todayFollowUps.slice(0, 8).map(followUp => {
            const customer = customerMap.get(followUp.customerId);
            return {
              id: followUp.id,
              customerId: followUp.customerId,
              customerName: customer?.name ?? null,
              consultStatus: customer?.consultStatus ?? null,
              nextContactDate: followUp.nextContactDate,
              reason: followUp.reason,
              nextAction: followUp.nextAction,
              status: followUp.status,
            };
          }),
          overdueFollowUps: overdueFollowUps.slice(0, 8).map(followUp => {
            const customer = customerMap.get(followUp.customerId);
            return {
              id: followUp.id,
              customerId: followUp.customerId,
              customerName: customer?.name ?? null,
              consultStatus: customer?.consultStatus ?? null,
              nextContactDate: followUp.nextContactDate,
              reason: followUp.reason,
              nextAction: followUp.nextAction,
              status: followUp.status,
            };
          }),
          monthlyPerformance: {
            contractCount: monthlyContracts.length,
            monthlyPremiumSum,
          },
        };
      }),
  }),

  notifications: router({
    list: activeUserProcedure
      .input(
        z
          .object({
            processStatus: z.string().optional(),
            isRead: z.boolean().optional(),
            type: z.string().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            limit: z.number().min(1).max(200).default(50),
            offset: z.number().min(0).default(0),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        const filter = {
          processStatus: input?.processStatus,
          isRead: input?.isRead,
          type: input?.type,
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
          limit: input?.limit ?? 50,
          offset: input?.offset ?? 0,
        };
        // branch_admin: 전체 알림 (userIds 제한 없음)
        if (user.role === "branch_admin") {
          return getNotificationsFiltered({ ...filter });
        }
        // sub_branch_admin: 본인 + 산하 팀원 알림
        if (user.role === "sub_branch_admin") {
          const subordinates = await getUsersBySubBranchAdminId(user.id);
          const userIds = [user.id, ...subordinates.map(u => u.id)];
          return getNotificationsFiltered({ ...filter, userIds });
        }
        // team_leader: 본인 + 본인 팀원 알림
        if (user.role === "team_leader" && user.teamId) {
          const teamMembers = await getUsersByTeamId(user.teamId);
          const userIds = [user.id, ...teamMembers.map(u => u.id)];
          return getNotificationsFiltered({ ...filter, userIds });
        }
        // member: 본인 알림만
        return getNotificationsFiltered({ ...filter, userIds: [user.id] });
      }),
    unreadCount: activeUserProcedure.query(async ({ ctx }) =>
      getUnreadCount(ctx.user.id)
    ),
    markRead: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await verifyNotificationAccess(ctx.user, input.id);
        await markNotificationRead(input.id);
        await log(
          ctx.user.id,
          "NOTIFICATION_READ",
          "notification",
          input.id,
          JSON.stringify({ actor: ctx.user.id, targetId: input.id })
        );
        return { success: true };
      }),
    markAllRead: activeUserProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    updateProcessStatus: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          processStatus: z.enum(["미확인", "확인", "처리완료", "보류"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await verifyNotificationAccess(ctx.user, input.id);
        await updateNotificationProcessStatus(input.id, input.processStatus);
        await log(
          ctx.user.id,
          "NOTIFICATION_STATUS_CHANGED",
          "notification",
          input.id,
          JSON.stringify({
            actor: ctx.user.id,
            targetId: input.id,
            afterValue: { processStatus: input.processStatus },
          })
        );
        return { success: true };
      }),
  }),

  // ── Performance ───────────────────────────────────────────────────────────
  performanceGoals: router({
    create: branchAdminProcedure
      .input(
        z.object({
          year: z.number().int().min(2000).max(2100),
          month: z.number().int().min(1).max(12),
          targetType: z.enum(["branch", "sub_branch", "team", "user"]),
          targetId: z.number().nullable().optional(),
          contractCountGoal: z.number().int().min(0),
          monthlyPremiumGoal: z.number().int().min(0),
          consultationGoal: z.number().int().min(0).default(0),
          followUpGoal: z.number().int().min(0).default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const targetId = input.targetType === "branch" ? null : input.targetId;
        if (input.targetType !== "branch" && !targetId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "대상 ID가 필요합니다.",
          });
        if (
          input.targetType === "team" &&
          targetId &&
          !(await getTeamById(targetId))
        )
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "팀을 찾을 수 없습니다.",
          });
        if (
          (input.targetType === "user" || input.targetType === "sub_branch") &&
          targetId
        ) {
          const targetUser = await getUserById(targetId);
          if (!targetUser)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "사용자를 찾을 수 없습니다.",
            });
          if (
            input.targetType === "sub_branch" &&
            targetUser.role !== "sub_branch_admin"
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "부지점 목표 대상은 sub_branch_admin이어야 합니다.",
            });
          if (input.targetType === "user") {
            const personalGoalRoles = new Set([
              "branch_admin",
              "sub_branch_admin",
              "team_leader",
              "member",
            ]);
            if (!personalGoalRoles.has(targetUser.role)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  "개인 목표 대상은 지점장, 부지점장, 팀장, 팀원만 설정할 수 있습니다.",
              });
            }
            if (targetUser.accountStatus !== "active") {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  "비활성 또는 퇴사 사용자에게는 개인 목표를 설정할 수 없습니다.",
              });
            }
          }
        }
        const duplicate = await getActivePerformanceGoal({
          year: input.year,
          month: input.month,
          targetType: input.targetType,
          targetId,
        });
        if (duplicate)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "같은 월과 대상의 active 목표가 이미 있습니다.",
          });
        const created = await createPerformanceGoal({
          ...input,
          targetId,
          createdBy: ctx.user.id,
        });
        await log(
          ctx.user.id,
          "PERFORMANCE_GOAL_CREATED",
          "performance_goal",
          created?.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "performance_goal",
            targetId: created?.id,
            afterValue: { ...input, targetId },
          })
        );
        return created;
      }),

    update: branchAdminProcedure
      .input(
        z.object({
          id: z.number(),
          contractCountGoal: z.number().int().min(0),
          monthlyPremiumGoal: z.number().int().min(0),
          consultationGoal: z.number().int().min(0).default(0),
          followUpGoal: z.number().int().min(0).default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const goal = await getPerformanceGoalById(input.id);
        if (!goal)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "목표를 찾을 수 없습니다.",
          });
        await updatePerformanceGoal(input.id, {
          contractCountGoal: input.contractCountGoal,
          monthlyPremiumGoal: input.monthlyPremiumGoal,
          consultationGoal: input.consultationGoal,
          followUpGoal: input.followUpGoal,
          updatedBy: ctx.user.id,
        });
        await log(
          ctx.user.id,
          "PERFORMANCE_GOAL_UPDATED",
          "performance_goal",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "performance_goal",
            targetId: input.id,
            beforeValue: {
              contractCountGoal: goal.contractCountGoal,
              monthlyPremiumGoal: goal.monthlyPremiumGoal,
              consultationGoal: goal.consultationGoal,
              followUpGoal: goal.followUpGoal,
            },
            afterValue: {
              contractCountGoal: input.contractCountGoal,
              monthlyPremiumGoal: input.monthlyPremiumGoal,
              consultationGoal: input.consultationGoal,
              followUpGoal: input.followUpGoal,
            },
          })
        );
        return { success: true };
      }),

    deactivate: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const goal = await getPerformanceGoalById(input.id);
        if (!goal)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "목표를 찾을 수 없습니다.",
          });
        if (!goal.isActive || goal.deletedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 비활성 처리된 목표입니다.",
          });
        await deactivatePerformanceGoal(input.id, ctx.user.id);
        await log(
          ctx.user.id,
          "PERFORMANCE_GOAL_DEACTIVATED",
          "performance_goal",
          input.id,
          logDetails({
            actor: ctx.user.id,
            targetType: "performance_goal",
            targetId: input.id,
            beforeValue: { isActive: goal.isActive },
            afterValue: { isActive: false },
          })
        );
        return { success: true };
      }),

    list: activeUserProcedure
      .input(
        z
          .object({
            year: z.number().int().optional(),
            month: z.number().int().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "branch_admin")
          return listPerformanceGoals(input ?? {});
        const now = new Date();
        const dashboard = await getPerformanceGoalDashboard(
          ctx.user as any,
          input?.year ?? now.getFullYear(),
          input?.month ?? now.getMonth() + 1
        );
        return dashboard.items.map(item => item.goal);
      }),

    dashboard: activeUserProcedure
      .input(
        z
          .object({
            year: z.number().int().min(2000).max(2100).optional(),
            month: z.number().int().min(1).max(12).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const now = new Date();
        return getPerformanceGoalDashboard(
          ctx.user as any,
          input?.year ?? now.getFullYear(),
          input?.month ?? now.getMonth() + 1
        );
      }),
  }),

  performance: router({
    stats: activeUserProcedure
      .input(
        z
          .object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            agentIdFilter: z.number().optional(),
            teamIdFilter: z.number().optional(),
            productGroup: z.string().optional(),
            company: z.string().optional(),
            region: z.string().optional(),
            source: z.string().optional(),
            scope: z.enum(["all", "mine"]).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo = input?.dateTo ? new Date(input.dateTo) : undefined;
        const extraFilter = {
          productGroup: input?.productGroup,
          company: input?.company,
          region: input?.region,
          source: input?.source,
        };
        const scope = await buildPerformanceScope(user, input);
        return getPerformanceStats({
          ...scope,
          dateFrom,
          dateTo,
          ...extraFilter,
        });
      }),

    agentStats: activeUserProcedure
      .input(
        z.object({
          agentId: z.number(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
        if (ctx.user.role === "member") {
          if (input.agentId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "팀장 이상만 접근 가능합니다.",
            });
          }
          return getPerformanceStats({
            agentId: input.agentId,
            dateFrom,
            dateTo,
          });
        }
        if (ctx.user.role === "team_leader" && input.agentId === ctx.user.id) {
          return getPerformanceStats({
            agentId: input.agentId,
            dateFrom,
            dateTo,
          });
        }
        await verifyTargetUserAccess(ctx.user, input.agentId);
        const target = await getUserById(input.agentId);
        if (
          !target ||
          (target.role !== "team_leader" && target.role !== "member")
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "팀장 또는 팀원의 실적만 조회할 수 있습니다.",
          });
        }
        return getPerformanceStats({
          agentId: input.agentId,
          dateFrom,
          dateTo,
        });
      }),
  }),

  // ── Download (지점장 전용) ─────────────────────────────────────────────────────────
  download: router({
    preview: branchAdminProcedure.query(async () => {
      const [customers, contracts, schedules, performance] = await Promise.all([
        getCustomers({}),
        getAllContracts({}),
        getSchedules({}),
        getPerformanceStats({}),
      ]);
      return {
        customers: {
          rowCount: customers.length,
          fields: downloadFieldPreview.customers,
        },
        contracts: {
          rowCount: contracts.length,
          fields: downloadFieldPreview.contracts,
        },
        schedules: {
          rowCount: schedules.length,
          fields: downloadFieldPreview.schedules,
        },
        performance: {
          rowCount: performance ? 1 : 0,
          fields: downloadFieldPreview.performance,
        },
      };
    }),
    customers: branchAdminProcedure
      .input(downloadRequestSchema)
      .query(async ({ ctx, input }) => {
        assertDownloadMode(input);
        const data = projectDownloadRows(
          "customers",
          (await getCustomers({})) as Record<string, unknown>[],
          input.masked
        );
        await log(
          ctx.user.id,
          "DATA_DOWNLOAD",
          "customers",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "customers",
            metadata: {
              type: "customers",
              rowCount: data.length,
              reason: input.reason,
              masked: input.masked,
              mode: input.masked ? "masked" : "raw",
              fields: downloadFieldPreview.customers.map(field => field.key),
            },
          })
        );
        return data;
      }),
    contracts: branchAdminProcedure
      .input(downloadRequestSchema)
      .query(async ({ ctx, input }) => {
        assertDownloadMode(input);
        const data = projectDownloadRows(
          "contracts",
          (await getAllContracts({})) as Record<string, unknown>[],
          input.masked
        );
        await log(
          ctx.user.id,
          "DATA_DOWNLOAD",
          "contracts",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "contracts",
            metadata: {
              type: "contracts",
              rowCount: data.length,
              reason: input.reason,
              masked: input.masked,
              mode: input.masked ? "masked" : "raw",
              fields: downloadFieldPreview.contracts.map(field => field.key),
            },
          })
        );
        return data;
      }),
    schedules: branchAdminProcedure
      .input(downloadRequestSchema)
      .query(async ({ ctx, input }) => {
        assertDownloadMode(input);
        const data = projectDownloadRows(
          "schedules",
          (await getSchedules({})) as Record<string, unknown>[],
          input.masked
        );
        await log(
          ctx.user.id,
          "DATA_DOWNLOAD",
          "schedules",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "schedules",
            metadata: {
              type: "schedules",
              rowCount: data.length,
              reason: input.reason,
              masked: input.masked,
              mode: input.masked ? "masked" : "raw",
              fields: downloadFieldPreview.schedules.map(field => field.key),
            },
          })
        );
        return data;
      }),
    performance: branchAdminProcedure
      .input(downloadRequestSchema)
      .query(async ({ ctx, input }) => {
        assertDownloadMode(input);
        const stats = await getPerformanceStats({});
        const rows = stats
          ? projectDownloadRows(
              "performance",
              [stats as Record<string, unknown>],
              input.masked
            )
          : [];
        await log(
          ctx.user.id,
          "DATA_DOWNLOAD",
          "performance",
          undefined,
          logDetails({
            actor: ctx.user.id,
            targetType: "performance",
            metadata: {
              type: "performance",
              rowCount: rows.length,
              reason: input.reason,
              masked: input.masked,
              mode: input.masked ? "masked" : "raw",
              fields: downloadFieldPreview.performance.map(field => field.key),
            },
          })
        );
        return rows[0] ?? null;
      }),
  }),

  // ── Settings (지점장 전용 마스터 데이터) ─────────────────────────────────────────────
  settings: router({
    list: branchAdminProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => getSettings(input.category)),
    formOptions: activeUserProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        const items = await getSettings(input.category);
        return items
          .filter(item => item.isActive)
          .map(item => ({
            category: item.category,
            value: item.value,
            label: item.value,
          }));
      }),
    create: branchAdminProcedure
      .input(z.object({ category: z.string(), value: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await createSetting(input.category, input.value, ctx.user.id);
        await log(
          ctx.user.id,
          "SETTINGS_CREATED",
          "settings",
          undefined,
          `category=${input.category},value=${input.value}`
        );
        return { success: true };
      }),
    toggle: branchAdminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await toggleSetting(input.id, input.isActive);
        await log(
          ctx.user.id,
          "SETTINGS_UPDATED",
          "settings",
          input.id,
          `isActive=${input.isActive}`
        );
        return { success: true };
      }),
    update: branchAdminProcedure
      .input(z.object({ id: z.number(), value: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await updateSetting(input.id, input.value);
        await log(
          ctx.user.id,
          "MASTER_DATA_UPDATED",
          "settings",
          input.id,
          `value=${input.value}`
        );
        return { success: true };
      }),
  }),

  // ── Activity Logs ───────────────────────────────────────────────────────────────
  logs: router({
    list: teamLeaderOrAboveProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      let entries;
      if (user.role === "branch_admin") {
        entries = await getActivityLogs(500);
      } else if (user.role === "sub_branch_admin") {
        entries = await getActivityLogs(500, user.id);
      } else {
        if (user.teamId == null) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "팀 범위가 없는 팀장은 활동 로그에 접근할 수 없습니다.",
          });
        }
        entries = await getActivityLogs(500, undefined, user.teamId);
      }
      return entries.map(sanitizeActivityLogRow);
    }),
  }),

  managementReports: managementReportsRouter,
  customerDataQuality: customerDataQualityRouter,
  onboardingTemplates: onboardingTemplatesRouter,
  onboardingAssignments: onboardingAssignmentsRouter,
  teamCoaching: teamCoachingRouter,
  actionPlans: actionPlansRouter,
  googleCalendar: googleCalendarRouter,
});

export type AppRouter = typeof appRouter;
