import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  assignCustomer,
  assignCustomerToSubBranch,
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
  updateUserRole,
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
  upsertConsultationCheckResult,
  resetUserOAuthLink,
  softDeleteCustomersByImportBatch,
  BulkImportRow,
  BulkImportValidationResult,
} from "./db";
import {
  cancelPendingNotifications,
  cancelScheduleIncompleteNotification,
  createBirthdayReminder,
  createContractReminders,
  createPaymentStatusReminder,
  createReconsultReminder,
  createScheduleIncompleteReminder,
  createScheduleReminders,
  createUncontactedReminder,
  refreshLongUnmanagedReminder,
} from "./notifications";

// ─── 미들웨어 정의 ─────────────────────────────────────────────────────────────
/** 지점장 전용 (branch_admin + accountStatus=active) */
const branchAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  if (u.role !== "branch_admin") throw new TRPCError({ code: "FORBIDDEN", message: "지점장만 접근 가능합니다." });
  return next({ ctx });
});

/** 부지점장 이상 (sub_branch_admin, branch_admin + active) */
const subBranchAdminOrAboveProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  if (u.role !== "branch_admin" && u.role !== "sub_branch_admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "부지점장 이상만 접근 가능합니다." });
  return next({ ctx });
});

/** 팀장 이상 (team_leader, sub_branch_admin, branch_admin + active) */
const teamLeaderOrAboveProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  if (u.role !== "branch_admin" && u.role !== "sub_branch_admin" && u.role !== "team_leader")
    throw new TRPCError({ code: "FORBIDDEN", message: "팀장 이상만 접근 가능합니다." });
  return next({ ctx });
});

/** 활성 사용자 (accountStatus=active이면 모든 role 허용) */
const activeUserProcedure = protectedProcedure.use(({ ctx, next }) => {
  const u = ctx.user;
  if (u.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  return next({ ctx });
});

/** 고객 소유권 검증 헬퍼 */
async function verifyCustomerAccess(user: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null; accountStatus: string }, customerId: number) {
  const customer = await getCustomerById(customerId);
  if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
  if (user.role === "branch_admin") return customer;
  if (user.role === "sub_branch_admin") {
    if (customer.subBranchAdminId !== user.id)
      throw new TRPCError({ code: "FORBIDDEN", message: "본인 산하 고객만 접근 가능합니다." });
    return customer;
  }
  if (user.role === "team_leader") {
    const agent = customer.agentId ? await getUserById(customer.agentId) : null;
    if (!agent || agent.teamId !== user.teamId)
      throw new TRPCError({ code: "FORBIDDEN", message: "본인 팀 고객만 접근 가능합니다." });
    return customer;
  }
  // member
  if (customer.agentId !== user.id)
    throw new TRPCError({ code: "FORBIDDEN", message: "본인 고객만 접근 가능합니다." });
  return customer;
}

async function assertTeamCanBeDeactivated(teamId: number) {
  const team = await getTeamById(teamId);
  if (!team) throw new TRPCError({ code: "NOT_FOUND" });
  if ((team as any).isActive === false || (team as any).deletedAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "이미 비활성 처리된 팀입니다." });
  }

  const activeUsers = (await getUsersByTeamId(teamId)).filter((u: any) => u.accountStatus === "active");
  if (activeUsers.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "소속 활성 사용자가 있는 팀은 삭제할 수 없습니다." });
  }

  const activeCustomers = await getCustomers({ teamId });
  if (activeCustomers.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "활성 고객이 남아 있는 팀은 삭제할 수 없습니다." });
  }

  const activeSchedules = await getSchedules({ teamId });
  if (activeSchedules.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "진행 중인 일정이 남아 있는 팀은 삭제할 수 없습니다." });
  }

  return team;
}

async function verifyCustomerDeleteAccess(
  user: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null; accountStatus: string },
  customerId: number,
) {
  if (user.role !== "branch_admin" && user.role !== "sub_branch_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "고객 삭제는 지점장 또는 부지점장만 가능합니다." });
  }
  const customer = await verifyCustomerAccess(user, customerId);
  if ((customer as any).isActive === false || (customer as any).deletedAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "이미 비활성 처리된 고객입니다." });
  }
  const activeContracts = await getContractsByCustomer(customerId);
  if (activeContracts.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "활성 계약이 있는 고객은 삭제할 수 없습니다. 계약을 먼저 비활성 처리해주세요." });
  }
  return customer;
}

async function verifyContractDeleteAccess(
  user: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null; accountStatus: string },
  contractId: number,
) {
  if (user.role !== "branch_admin" && user.role !== "sub_branch_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "계약 삭제는 지점장 또는 부지점장만 가능합니다." });
  }
  const contract = await getContractById(contractId);
  if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
  if ((contract as any).isActive === false || (contract as any).deletedAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "이미 비활성 처리된 계약입니다." });
  }
  await verifyCustomerAccess(user, contract.customerId);
  return contract;
}

async function verifyContractDeleteRequestAccess(
  user: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null; accountStatus: string },
  contractId: number,
) {
  if (user.role === "branch_admin") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "branch_admin은 삭제 요청 대신 관리자 삭제/승인 기능을 사용하세요." });
  }
  const contract = await getContractById(contractId);
  if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
  if ((contract as any).isActive === false || (contract as any).deletedAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "이미 비활성 처리된 계약은 삭제 요청할 수 없습니다." });
  }
  await verifyCustomerAccess(user, contract.customerId);
  return contract;
}

function isSoftDeleted(row: { isActive?: boolean | null; deletedAt?: Date | null }) {
  return row.isActive === false || !!row.deletedAt;
}

const PERMANENT_DELETE_CONFIRM_TEXT = "\uC644\uC804\uC0AD\uC81C";
const PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE = "\uD655\uC778 \uBB38\uAD6C\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
const TEAM_PERMANENT_DELETE_BLOCKED_MESSAGE = "\uC5F0\uACB0\uB41C \uC0AC\uC6A9\uC790, \uACE0\uAC1D, \uC77C\uC815 \uB610\uB294 \uBC30\uC815 \uC774\uB825\uC774 \uC788\uC5B4 \uD300\uC744 \uC644\uC804\uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC6B4\uC601 \uC774\uB825 \uBCF4\uC874\uC744 \uC704\uD574 \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD574\uC8FC\uC138\uC694.";
const CUSTOMER_PERMANENT_DELETE_BLOCKED_MESSAGE = "\uC5F0\uACB0\uB41C \uACC4\uC57D, \uC77C\uC815, \uC0C1\uB2F4\uAE30\uB85D, \uC54C\uB9BC \uB610\uB294 \uBC30\uC815 \uC774\uB825\uC774 \uC788\uC5B4 \uACE0\uAC1D\uC744 \uC644\uC804\uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC6B4\uC601 \uC774\uB825 \uBCF4\uC874\uC744 \uC704\uD574 \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD574\uC8FC\uC138\uC694.";
const CONTRACT_PERMANENT_DELETE_BLOCKED_MESSAGE = "\uACC4\uC57D \uC774\uB825 \uB610\uB294 \uC54C\uB9BC \uC774\uB825\uC774 \uB0A8\uC544 \uC788\uC5B4 \uC644\uC804\uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uAC10\uC0AC \uCD94\uC801\uC744 \uC704\uD574 \uBE44\uD65C\uC131 \uC0C1\uD0DC\uB85C \uC720\uC9C0\uD574\uC8FC\uC138\uC694.";
const IMPORT_BATCH_CANCEL_CONFIRM_TEXT = "BATCH\uCDE8\uC18C";
const IMPORT_BATCH_ALREADY_CANCELLED_MESSAGE = "\uC774\uBBF8 \uCDE8\uC18C\uB41C batch\uC785\uB2C8\uB2E4.";
const IMPORT_BATCH_NO_ACTIVE_CUSTOMERS_MESSAGE = "\uCDE8\uC18C\uD560 active \uACE0\uAC1D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
const IMPORT_BATCH_CANCEL_BLOCKED_MESSAGE = "\uACC4\uC57D, \uC77C\uC815, \uC0C1\uB2F4\uAE30\uB85D, \uC54C\uB9BC \uB610\uB294 \uBC30\uC815 \uC774\uB825\uC774 \uC5F0\uACB0\uB41C \uACE0\uAC1D\uC774 \uC788\uC5B4 batch \uCDE8\uC18C\uB97C \uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD544\uC694\uD55C \uACE0\uAC1D\uC740 \uAC1C\uBCC4 \uC0AD\uC81C \uC694\uCCAD \uB610\uB294 \uAD00\uB9AC\uC790 \uAC80\uD1A0 \uD6C4 \uCC98\uB9AC\uD574\uC8FC\uC138\uC694.";

async function requireSoftDeletedTeam(teamId: number) {
  const team = await getTeamById(teamId);
  if (!team) throw new TRPCError({ code: "NOT_FOUND" });
  if (!isSoftDeleted(team)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "활성 팀은 복구/완전삭제 대상이 아닙니다." });
  }
  return team;
}

async function requireSoftDeletedCustomer(customerId: number) {
  const customer = await getCustomerById(customerId);
  if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
  if (!isSoftDeleted(customer)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "활성 고객은 복구/완전삭제 대상이 아닙니다." });
  }
  return customer;
}

async function requireSoftDeletedContract(contractId: number) {
  const contract = await getContractById(contractId);
  if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
  if (!isSoftDeleted(contract)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "활성 계약은 복구/완전삭제 대상이 아닙니다." });
  }
  return contract;
}

async function buildDeleteRequestView(request: Awaited<ReturnType<typeof getDeleteRequests>>[number]) {
  const contract = await getContractById(request.targetId);
  const customer = request.customerId ? await getCustomerById(request.customerId) : undefined;
  const requester = request.requestedBy ? await getUserById(request.requestedBy) : undefined;
  return {
    ...request,
    contract,
    customer: customer ? { id: customer.id, name: customer.name } : null,
    requester: requester ? {
      id: requester.id,
      name: requester.name,
      role: requester.role,
      teamId: requester.teamId,
      subBranchAdminId: requester.subBranchAdminId,
    } : null,
  };
}

async function log(userId: number, action: string, targetType?: string, targetId?: number, details?: string, client?: Parameters<typeof createActivityLog>[1]) {
  await createActivityLog({
    userId,
    action,
    targetType,
    targetId,
    details: standardizeLogDetails({ actor: userId, targetType, targetId, details }),
  }, client);
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

function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (["memo", "password", "ssn", "residentnumber", "policy_number"].includes(normalizedKey)) continue;
    if (normalizedKey.includes("email") && typeof raw === "string") {
      result[key] = maskEmail(raw);
    } else if (normalizedKey.includes("phone") && typeof raw === "string") {
      result[key] = maskPhone(raw);
    } else {
      result[key] = sanitizeLogValue(raw);
    }
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
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
    ? Object.fromEntries(Object.entries(parsed).filter(([key]) => !["actor", "targetId", "targetUserId", "targetType", "beforeValue", "afterValue", "before", "after"].includes(key)))
    : {};

  return logDetails({
    actor: Number(parsed?.actor ?? data.actor),
    targetId: (parsed?.targetId as number | null | undefined) ?? (parsed?.targetUserId as number | null | undefined) ?? data.targetId ?? null,
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
const CONSULTATION_TYPES = ["전화", "카톡", "문자", "방문", "소개", "보장분석", "계약상담", "사후관리", "기타"] as const;
const CUSTOMER_NEEDS = ["보험료 부담", "보장 불안", "가족 보장", "실손/의료비", "암/뇌/심장 보장", "운전자보험", "해지 고민", "리밸런싱", "자녀 보장", "노후/간병", "기타"] as const;
const CUSTOMER_NEXT_ACTIONS = ["재연락", "설계안 발송", "보장분석 진행", "계약 진행", "추가 자료 요청", "가족과 상의", "보류", "거절", "장기관리", "사후관리"] as const;
const CUSTOMER_TAGS = ["가격민감형", "보장불안형", "가족책임형", "무관심형", "해지위험", "리밸런싱필요", "사후관리필요", "소개가능성", "고액계약가능성", "장기관리"] as const;

const CHECKLIST_PHASES = ["before", "during", "after"] as const;
const CHECKLIST_CATEGORIES = ["basic", "needs", "coverage", "premium", "family", "follow_up", "compliance"] as const;
const TEMPLATE_SITUATIONS = ["missed_call", "proposal_follow_up", "pre_contract_check", "post_contract_care", "long_unmanaged", "birthday", "follow_up_schedule", "document_request", "after_consultation", "general_check"] as const;
const TEMPLATE_CHANNELS = ["kakao", "sms", "both"] as const;
const HANDOFF_NOTE_TYPES = ["handoff", "caution", "approach", "avoid", "relationship", "next_action"] as const;
const SCRIPT_CATEGORIES = ["first_call", "missed_call", "premium_burden", "coverage_concern", "family_responsibility", "surrender_risk", "proposal_follow_up", "post_contract_care", "long_unmanaged", "general_check"] as const;
const ALLOWED_TEMPLATE_PLACEHOLDERS = new Set(["고객명", "담당자명", "다음연락일", "상담주제"]);
const BANNED_TEMPLATE_PHRASES = ["무조건 보장", "반드시 가입", "지금 안 하면", "이 보험이 최고", "가장 저렴", "확정적으로 유리", "병에 걸리면 큰일", "안 하면 위험", "지금 가입", "누구나 받을", "무조건 유리"];

function validateMessageTemplateBody(body: string) {
  if (body.length > 2000) throw new TRPCError({ code: "BAD_REQUEST", message: "템플릿 본문은 2000자 이하로 입력해주세요." });
  const placeholders = Array.from(body.matchAll(/\{([^}]+)\}/g)).map((match) => match[1]);
  const invalid = placeholders.filter((placeholder) => !ALLOWED_TEMPLATE_PLACEHOLDERS.has(placeholder));
  if (invalid.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "허용되지 않은 placeholder가 포함되어 있습니다." });
  if (BANNED_TEMPLATE_PHRASES.some((phrase) => body.includes(phrase))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "가입 강요, 공포마케팅, 확정 표현은 사용할 수 없습니다." });
  }
}

function validateScriptBody(body: string) {
  if (body.length > 3000) throw new TRPCError({ code: "BAD_REQUEST", message: "스크립트 본문은 3000자 이하로 입력해주세요." });
  for (const phrase of BANNED_TEMPLATE_PHRASES) {
    if (body.includes(phrase)) throw new TRPCError({ code: "BAD_REQUEST", message: "가입 강요, 공포마케팅, 확정 표현은 사용할 수 없습니다." });
  }
}

function validateHandoffNoteBody(body: string) {
  if (body.length > 2000) throw new TRPCError({ code: "BAD_REQUEST", message: "인수인계 메모는 2000자 이하로 입력해주세요." });
}

function renderMessageBody(body: string, values: Record<string, string | null | undefined>) {
  return body.replace(/\{고객명\}/g, values.customerName ?? "")
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
  "IMPORT_BATCH_CANCELLED",
  "IMPORT_BATCH_CANCEL_BLOCKED",
  "USER_FORCE_LOGOUT",
  "USER_ROLE_CHANGED",
]);
const LOW_RISK_ACTIONS = new Set([
  "DELETE_REQUEST_CREATED",
  "DELETE_REQUEST_REJECTED",
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
  "CONTRACT_DEACTIVATED_BY_REQUEST",
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
  "TEAM_RESTORED",
  "CUSTOMER_RESTORED",
  "CONTRACT_RESTORED",
  "PERMANENT_DELETE_BLOCKED",
  "LOGIN_BLOCKED",
]);

function getRiskLevel(action: string): "high" | "medium" | "low" | "normal" {
  if (HIGH_RISK_ACTIONS.has(action)) return "high";
  if (MEDIUM_RISK_ACTIONS.has(action)) return "medium";
  if (LOW_RISK_ACTIONS.has(action)) return "low";
  return "normal";
}

function safeAuditText(value: unknown, maxLength = 160) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/(secret|token|password|DATABASE_URL|JWT_SECRET|GOOGLE_CLIENT_SECRET|api[_-]?key)\s*[:=]\s*[^,\s"}]+/gi, "$1=[redacted]")
    .slice(0, maxLength);
}

function summarizeLogDetails(details?: string | null) {
  if (!details) return { reason: null as string | null, summary: null as string | null };
  try {
    const parsed = JSON.parse(details) as Record<string, any>;
    const metadata = parsed.metadata ?? {};
    const reason = metadata.reason ?? parsed.reason ?? null;
    const parts = [
      metadata.type ? `type=${metadata.type}` : null,
      metadata.rowCount !== undefined ? `rows=${metadata.rowCount}` : null,
      metadata.affectedSessionCount !== undefined ? `sessions=${metadata.affectedSessionCount}` : null,
      metadata.affectedCustomerCount !== undefined ? `customers=${metadata.affectedCustomerCount}` : null,
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

function isWithinDateRange(date: Date, from?: Date, to?: Date) {
  const time = date.getTime();
  if (from && time < from.getTime()) return false;
  if (to && time > to.getTime()) return false;
  return true;
}

function encodeCustomerTags(tags?: string[]) {
  if (!tags) return undefined;
  const unique = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  return JSON.stringify(unique);
}

function decodeCustomerTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
}

async function verifyAgentTarget(
  actor: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null },
  targetUserId: number
) {
  const target = await getUserById(targetUserId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });
  if (target.accountStatus !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: "비활성 계정에는 배정할 수 없습니다." });
  }
  const isBranchAdminSelfTarget = actor.role === "branch_admin" && target.id === actor.id && target.role === "branch_admin";
  if (!isBranchAdminSelfTarget && target.role !== "team_leader" && target.role !== "member") {
    throw new TRPCError({ code: "FORBIDDEN", message: "팀장 또는 팀원만 담당자로 지정할 수 있습니다." });
  }
  if (target.teamId) {
    const team = await getTeamById(target.teamId);
    if (team && (team as any).subBranchAdminId !== target.subBranchAdminId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "대상 사용자의 팀과 부지점장 소속이 일치하지 않습니다." });
    }
  }
  if (actor.role === "sub_branch_admin" && target.subBranchAdminId !== actor.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "본인 산하 조직원에게만 배정 가능합니다." });
  }
  if (actor.role === "team_leader") {
    const isSameTeam = actor.teamId !== null && target.teamId === actor.teamId;
    if (target.id !== actor.id && !isSameTeam) {
      throw new TRPCError({ code: "FORBIDDEN", message: "본인 또는 본인 팀원에게만 배정 가능합니다." });
    }
  }
  if (actor.role === "member" && target.id !== actor.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "팀원은 담당자를 변경할 수 없습니다." });
  }
  return target;
}

async function verifySubBranchAdminTarget(userId: number) {
  const target = await getUserById(userId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "대상 부지점장을 찾을 수 없습니다." });
  if (target.accountStatus !== "active" || target.role !== "sub_branch_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "활성 부지점장에게만 배분할 수 있습니다." });
  }
  return target;
}

const BULK_IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]);

function verifyBulkImportFilePolicy(input: { fileName?: string; fileSize?: number; mimeType?: string }) {
  if (input.fileName && !input.fileName.toLowerCase().endsWith(".csv")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CSV 파일만 업로드할 수 있습니다." });
  }
  if (input.fileSize !== undefined && input.fileSize > BULK_IMPORT_MAX_FILE_SIZE_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "파일 크기는 5MB 이하만 업로드할 수 있습니다." });
  }
  if (input.mimeType && !CSV_MIME_TYPES.has(input.mimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "허용되지 않는 파일 형식입니다. CSV 파일만 업로드할 수 있습니다." });
  }
}

async function verifyNotificationAccess(
  user: { id: number; role: string; teamId: number | null },
  notificationId: number
) {
  const notification = await getNotificationById(notificationId);
  if (!notification) throw new TRPCError({ code: "NOT_FOUND", message: "알림을 찾을 수 없습니다." });
  if (user.role === "branch_admin") return notification;
  if (notification.userId === user.id) return notification;
  if (user.role === "sub_branch_admin") {
    const subordinates = await getUsersBySubBranchAdminId(user.id);
    if (subordinates.some((u) => u.id === notification.userId)) return notification;
  }
  if (user.role === "team_leader" && user.teamId) {
    const teamMembers = await getUsersByTeamId(user.teamId);
    if (teamMembers.some((u) => u.id === notification.userId)) return notification;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "해당 알림을 수정할 권한이 없습니다." });
}

async function verifyTargetUserAccess(
  actor: { id: number; role: string; teamId: number | null },
  targetUserId: number
) {
  const target = await getUserById(targetUserId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });
  if (target.accountStatus !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: "비활성 사용자에게는 처리할 수 없습니다." });
  }
  if (actor.role === "branch_admin") return target;
  if (actor.role === "sub_branch_admin" && (target.id === actor.id || target.subBranchAdminId === actor.id)) return target;
  if (actor.role === "team_leader") {
    const isSameTeam = actor.teamId !== null && target.teamId === actor.teamId;
    if (target.id === actor.id || isSameTeam) return target;
  }
  if (actor.role === "member" && target.id === actor.id) return target;
  throw new TRPCError({ code: "FORBIDDEN", message: "대상 사용자에 대한 권한이 없습니다." });
}

// ─── App Router ───────────────────────────────────────────────────────────────
type MinimalUser = {
  id: number;
  name: string | null;
  email: null;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
  createdAt: null;
};

function toMinimalUser(user: {
  id: number;
  name: string | null;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
}): MinimalUser {
  return {
    id: user.id,
    name: user.name,
    email: null,
    role: user.role,
    teamId: user.teamId,
    subBranchAdminId: user.subBranchAdminId,
    accountStatus: user.accountStatus,
    createdAt: null,
  };
}

async function verifyTeamFilterAccess(
  actor: { id: number; role: string; teamId: number | null },
  teamId: number
) {
  const team = await getTeamById(teamId);
  if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "팀을 찾을 수 없습니다." });
  if (actor.role === "branch_admin") return team;
  if (actor.role === "sub_branch_admin" && (team as any).subBranchAdminId === actor.id) return team;
  if (actor.role === "team_leader" && actor.teamId !== null && actor.teamId === teamId) return team;
  throw new TRPCError({ code: "FORBIDDEN", message: "해당 팀의 실적을 조회할 권한이 없습니다." });
}

async function buildPerformanceScope(
  user: { id: number; role: string; teamId: number | null },
  input?: { agentIdFilter?: number; teamIdFilter?: number; scope?: "all" | "mine" }
) {
  const agentId = input?.agentIdFilter;
  const teamId = input?.teamIdFilter;

  if (input?.scope === "all" && user.role !== "branch_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "전체 범위는 지점장만 조회할 수 있습니다." });
  }

  if (user.role === "branch_admin") {
    if (input?.scope === "mine") return { agentId: user.id, teamId };
    return { agentId, teamId };
  }

  if (agentId !== undefined) {
    const target = await verifyTargetUserAccess(user, agentId);
    if (target.role !== "team_leader" && target.role !== "member") {
      throw new TRPCError({ code: "FORBIDDEN", message: "팀장 또는 팀원의 실적만 조회할 수 있습니다." });
    }
    if (teamId !== undefined && target.teamId !== teamId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "팀과 담당자 필터가 일치하지 않습니다." });
    }
  }

  if (teamId !== undefined) await verifyTeamFilterAccess(user, teamId);

  if (user.role === "sub_branch_admin") return { subBranchAdminId: user.id, agentId, teamId };
  if (user.role === "team_leader") {
    if (user.teamId === null) {
      if (teamId !== undefined || agentId !== undefined) {
        throw new TRPCError({ code: "FORBIDDEN", message: "팀 소속이 없어 팀 실적을 조회할 수 없습니다." });
      }
      return { agentId: user.id };
    }
    return { teamId: teamId ?? user.teamId, agentId };
  }

  if (teamId !== undefined || (agentId !== undefined && agentId !== user.id)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "본인 실적만 조회 가능합니다." });
  }
  return { agentId: user.id };
}

async function getAccessibleSchedules(user: { id: number; role: string; teamId: number | null }) {
  if (user.role === "branch_admin") return getSchedules({});
  if (user.role === "sub_branch_admin") return getSchedules({ subBranchAdminId: user.id });
  if (user.role === "team_leader") {
    if (user.teamId === null) return [];
    return getSchedules({ teamId: user.teamId });
  }
  return getSchedules({ userId: user.id });
}

async function getScopedDashboardData(user: { id: number; role: string; teamId: number | null }) {
  if (user.role === "branch_admin") {
    const [customerList, contractList, scheduleList, notificationResult, followUpList] = await Promise.all([
      getCustomers({}),
      getAllContracts({}),
      getAccessibleSchedules(user),
      getNotificationsFiltered({ limit: 200 }),
      getFollowUps({ statuses: ["scheduled", "postponed"] }),
    ]);
    return { customerList, contractList, scheduleList, notifications: notificationResult.items, followUpList };
  }

  if (user.role === "sub_branch_admin") {
    const subordinates = await getUsersBySubBranchAdminId(user.id);
    const userIds = [user.id, ...subordinates.map((u) => u.id)];
    const [customerList, contractList, scheduleList, notificationResult, followUpList] = await Promise.all([
      getCustomers({ subBranchAdminId: user.id }),
      getAllContracts({ subBranchAdminId: user.id }),
      getAccessibleSchedules(user),
      getNotificationsFiltered({ userIds, limit: 200 }),
      getFollowUps({ subBranchAdminId: user.id, statuses: ["scheduled", "postponed"] }),
    ]);
    return { customerList, contractList, scheduleList, notifications: notificationResult.items, followUpList };
  }

  if (user.role === "team_leader") {
    if (user.teamId === null) return { customerList: [], contractList: [], scheduleList: [], notifications: [], followUpList: [] };
    const teamMembers = await getUsersByTeamId(user.teamId);
    const userIds = [user.id, ...teamMembers.map((u) => u.id)];
    const [customerList, contractList, scheduleList, notificationResult, followUpList] = await Promise.all([
      getCustomers({ teamId: user.teamId }),
      getAllContracts({ teamId: user.teamId }),
      getAccessibleSchedules(user),
      getNotificationsFiltered({ userIds, limit: 200 }),
      getFollowUps({ teamId: user.teamId, statuses: ["scheduled", "postponed"] }),
    ]);
    return { customerList, contractList, scheduleList, notifications: notificationResult.items, followUpList };
  }

  const [customerList, contractList, scheduleList, notificationResult, followUpList] = await Promise.all([
    getCustomers({ agentId: user.id }),
    getAllContracts({ agentId: user.id }),
    getAccessibleSchedules(user),
    getNotificationsFiltered({ userIds: [user.id], limit: 200 }),
    getFollowUps({ agentId: user.id, statuses: ["scheduled", "postponed"] }),
  ]);
  return { customerList, contractList, scheduleList, notifications: notificationResult.items, followUpList };
}

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isFinishedScheduleStatus(status: string) {
  return ["완료", "취소", "노쇼"].includes(status);
}

function isUnreadNotification(notification: { isRead: boolean; processStatus?: string | null }) {
  return !notification.isRead || notification.processStatus === "미확인";
}

function isOpenFollowUpStatus(status: string) {
  return status === "scheduled" || status === "postponed";
}

function toDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDayEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

async function getFollowUpScope(user: { id: number; role: string; teamId: number | null }) {
  if (user.role === "branch_admin") return {};
  if (user.role === "sub_branch_admin") return { subBranchAdminId: user.id };
  if (user.role === "team_leader") {
    if (user.teamId === null) return { teamId: -1 };
    return { teamId: user.teamId };
  }
  return { agentId: user.id };
}

async function verifyFollowUpAccess(user: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null; accountStatus: string }, followUpId: number) {
  const followUp = await getFollowUpById(followUpId);
  if (!followUp || followUp.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "후속관리를 찾을 수 없습니다." });
  await verifyCustomerAccess(user, followUp.customerId);
  return followUp;
}

function parseRecommendationTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((toDayStart(to).getTime() - toDayStart(from).getTime()) / (24 * 60 * 60 * 1000));
}

function recommendationUrgency(score: number): "high" | "medium" | "low" {
  if (score >= 55) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function isDesignOrContractReviewState(customer: { consultStatus?: string | null; nextAction?: string | null }) {
  const text = `${customer.consultStatus ?? ""} ${customer.nextAction ?? ""}`;
  return ["설계", "계약", "검토", "발송", "진행"].some((keyword) => text.includes(keyword));
}

function hasRecommendationTag(tags: string[], keywords: string[]) {
  return tags.some((tag) => keywords.some((keyword) => tag.includes(keyword)));
}

function buildSafeContactReason(type: string) {
  const reasonMap: Record<string, { title: string; description: string; situation?: string }> = {
    overdue_follow_up: { title: "후속관리 확인", description: "지난 상담 이후 확인이 필요한 내용이 있어 후속 연락이 필요합니다.", situation: "follow_up_schedule" },
    today_follow_up: { title: "오늘 연락 예정", description: "이전에 정한 다음 연락일이 도래해 상담 내용을 이어서 확인할 수 있습니다.", situation: "follow_up_schedule" },
    priority_a_unmanaged: { title: "우선관리 고객 확인", description: "우선관리 고객으로 분류되어 최근 상담 이후 진행 상황 확인이 필요합니다.", situation: "general_check" },
    proposal_follow_up: { title: "자료 이해 여부 확인", description: "전달한 자료를 보시고 이해가 어려운 부분이 있는지 확인할 수 있습니다.", situation: "proposal_follow_up" },
    long_unmanaged: { title: "기존 기준 점검", description: "상황 변화가 있었을 수 있어 기존 보장 기준을 점검할 명분이 있습니다.", situation: "general_check" },
    post_contract_care: { title: "계약 후 사후관리", description: "계약 이후 보장 내용과 관리 기준을 다시 안내할 시점입니다.", situation: "post_contract_care" },
    retention_risk: { title: "유지 기준 확인", description: "해지 전 보장 공백과 유지 기준을 차분히 확인할 필요가 있습니다.", situation: "general_check" },
    premium_burden: { title: "보험료 부담 점검", description: "보험료 부담을 줄이기 위한 조정 가능성을 점검할 수 있습니다.", situation: "general_check" },
    family_responsibility: { title: "가족 기준 점검", description: "가족 구성과 책임 범위 기준으로 보장 공백을 확인할 수 있습니다.", situation: "general_check" },
    unread_notification: { title: "알림 내용 확인", description: "확인하지 않은 알림이 있어 고객 관련 처리 상태를 점검할 수 있습니다.", situation: "general_check" },
    no_consultation: { title: "초기 상담 기록 확인", description: "등록 후 상담기록이 없어 고객 상황과 상담 방향을 확인할 수 있습니다.", situation: "general_check" },
  };
  return reasonMap[type] ?? { title: "고객 상태 점검", description: "최근 고객 상태를 기준으로 필요한 내용을 확인할 수 있습니다.", situation: "general_check" };
}

function getReportRange(input?: { period?: "week" | "month" | "custom"; dateFrom?: string; dateTo?: string }) {
  const now = new Date();
  if (input?.period === "custom") {
    const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
    const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
    if (!dateFrom || Number.isNaN(dateFrom.getTime()) || !dateTo || Number.isNaN(dateTo.getTime())) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "기간이 올바르지 않습니다." });
    }
    return { dateFrom: toDayStart(dateFrom), dateTo: toDayEnd(dateTo), period: "custom" as const };
  }
  if (input?.period === "month") {
    return {
      dateFrom: new Date(now.getFullYear(), now.getMonth(), 1),
      dateTo: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      period: "month" as const,
    };
  }
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);
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

function goalItemForScope(items: any[], scope: { targetUserId?: number; teamId?: number; subBranchAdminId?: number }) {
  if (scope.targetUserId !== undefined) return items.find((item) => item.goal.targetType === "user" && item.goal.targetId === scope.targetUserId);
  if (scope.teamId !== undefined) return items.find((item) => item.goal.targetType === "team" && item.goal.targetId === scope.teamId);
  if (scope.subBranchAdminId !== undefined) return items.find((item) => item.goal.targetType === "sub_branch" && item.goal.targetId === scope.subBranchAdminId);
  return items.find((item) => item.goal.targetType === "branch") ?? items[0];
}

async function buildRecommendationItems(user: { id: number; role: string; teamId: number | null }, baseDate: Date) {
  const { customerList, contractList, notifications, followUpList } = await getScopedDashboardData(user);
  const activeCustomers = customerList.filter((customer) => customer.isActive && !customer.deletedAt);
  const consultationEntries = await Promise.all(activeCustomers.map(async (customer) => ({
    customerId: customer.id,
    consultations: await getConsultationsByCustomer(customer.id),
  })));
  const consultationsByCustomer = new Map(consultationEntries.map((entry) => [entry.customerId, entry.consultations]));
  const contractsByCustomer = new Map<number, typeof contractList>();
  for (const contract of contractList.filter((contract) => contract.isActive && !contract.deletedAt)) {
    const rows = contractsByCustomer.get(contract.customerId) ?? [];
    rows.push(contract);
    contractsByCustomer.set(contract.customerId, rows);
  }
  const followUpsByCustomer = new Map<number, typeof followUpList>();
  for (const followUp of followUpList.filter((followUp) => isOpenFollowUpStatus(followUp.status))) {
    const rows = followUpsByCustomer.get(followUp.customerId) ?? [];
    rows.push(followUp);
    followUpsByCustomer.set(followUp.customerId, rows);
  }
  const unreadNotificationsByCustomer = new Map<number, typeof notifications>();
  for (const notification of notifications.filter((notification) => isUnreadNotification(notification))) {
    if (notification.relatedType !== "customer" || !notification.relatedId) continue;
    const rows = unreadNotificationsByCustomer.get(notification.relatedId) ?? [];
    rows.push(notification);
    unreadNotificationsByCustomer.set(notification.relatedId, rows);
  }

  const todayStart = toDayStart(baseDate);
  const todayEnd = toDayEnd(baseDate);

  return activeCustomers.map((customer) => {
    const tags = parseRecommendationTags(customer.customerTags);
    const customerFollowUps = followUpsByCustomer.get(customer.id) ?? [];
    const customerConsultations = consultationsByCustomer.get(customer.id) ?? [];
    const customerContracts = contractsByCustomer.get(customer.id) ?? [];
    const unreadNotifications = unreadNotificationsByCustomer.get(customer.id) ?? [];
    const latestConsultation = customerConsultations.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const latestContract = customerContracts.slice().sort((a, b) => new Date(b.contractDate ?? b.createdAt).getTime() - new Date(a.contractDate ?? a.createdAt).getTime())[0];

    let totalScore = 0;
    const reasons: string[] = [];
    const warnings: Array<{ warningType: string; severity: "high" | "medium" | "low"; message: string; source: string }> = [];
    const contactReasonTypes = new Set<string>();

    const overdueFollowUps = customerFollowUps.filter((followUp) => new Date(followUp.nextContactDate).getTime() < todayStart.getTime());
    const todayFollowUps = customerFollowUps.filter((followUp) => {
      const nextDate = new Date(followUp.nextContactDate);
      return nextDate.getTime() >= todayStart.getTime() && nextDate.getTime() <= todayEnd.getTime();
    });
    if (overdueFollowUps.length > 0) {
      totalScore += 40;
      reasons.push("후속관리 예정일 경과");
      warnings.push({ warningType: "overdue_follow_up", severity: "high", message: "후속관리 예정일이 지났습니다.", source: "follow_ups" });
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
      warnings.push({ warningType: "unread_notification", severity: "medium", message: "확인하지 않은 알림이 있습니다.", source: "notifications" });
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
    if (hasRecommendationTag(tags, ["가격", "보험료", "부담"])) contactReasonTypes.add("premium_burden");
    if (hasRecommendationTag(tags, ["가족", "책임"])) contactReasonTypes.add("family_responsibility");
    if (customer.nextAction && ["재연락", "설계안", "계약", "보장분석"].some((keyword) => customer.nextAction?.includes(keyword))) {
      totalScore += 15;
      reasons.push(`다음 액션: ${customer.nextAction}`);
      if (customer.nextAction.includes("설계안")) contactReasonTypes.add("proposal_follow_up");
    }

    const registeredDays = daysBetween(new Date(customer.createdAt), baseDate);
    if (registeredDays >= 7 && customerConsultations.length === 0) {
      totalScore += 15;
      warnings.push({ warningType: "no_consultation", severity: "medium", message: "등록 후 상담기록이 없습니다.", source: "consultations" });
      contactReasonTypes.add("no_consultation");
    }

    const lastConsultationDate = latestConsultation ? new Date(latestConsultation.createdAt) : null;
    const daysSinceConsult = lastConsultationDate ? daysBetween(lastConsultationDate, baseDate) : null;
    if (isDesignOrContractReviewState(customer) && (daysSinceConsult === null || daysSinceConsult >= 14)) {
      totalScore += 20;
      reasons.push("설계/계약 검토 장기화");
      warnings.push({ warningType: "proposal_stalled", severity: "medium", message: "설계 진행 상태가 장기화되고 있습니다.", source: "customers" });
      contactReasonTypes.add("proposal_follow_up");
    }
    if (customer.priority === "A" && (daysSinceConsult === null || daysSinceConsult >= 7) && todayFollowUps.length === 0) {
      warnings.push({ warningType: "priority_a_unmanaged", severity: "high", message: "A등급 고객 관리가 지연되고 있습니다.", source: "customers" });
      contactReasonTypes.add("priority_a_unmanaged");
    }
    if (daysSinceConsult === null || daysSinceConsult >= 90) {
      totalScore += 20;
      reasons.push("장기 미관리 가능성");
      warnings.push({ warningType: "long_unmanaged", severity: "medium", message: "장기 미관리 고객입니다.", source: "consultations" });
      contactReasonTypes.add("long_unmanaged");
    }
    if (latestContract?.contractDate) {
      const contractDate = new Date(latestContract.contractDate);
      const daysSinceContract = daysBetween(contractDate, baseDate);
      if ((daysSinceContract >= 30 || daysSinceContract >= 90) && (!lastConsultationDate || lastConsultationDate < contractDate)) {
        totalScore += 10;
        reasons.push("계약 후 사후관리 시점");
        warnings.push({ warningType: "post_contract_unmanaged", severity: "medium", message: "계약 후 사후관리 확인이 필요합니다.", source: "contracts" });
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
      nextContactDate: [...overdueFollowUps, ...todayFollowUps].sort((a, b) => new Date(a.nextContactDate).getTime() - new Date(b.nextContactDate).getTime())[0]?.nextContactDate ?? null,
      openFollowUpCount: customerFollowUps.length,
      unreadNotificationCount: unreadNotifications.length,
      warnings,
      contactReasons: contactReasonTypeList.map((type) => ({ reasonType: type, ...buildSafeContactReason(type) })),
    };
  });
}

async function buildWorkRhythmReport(
  user: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null; accountStatus: string },
  input?: { period?: "week" | "month" | "custom"; dateFrom?: string; dateTo?: string; targetUserId?: number; teamId?: number; subBranchAdminId?: number }
) {
  const range = getReportRange(input);
  const monthStart = new Date(range.dateTo.getFullYear(), range.dateTo.getMonth(), 1);
  const monthEnd = new Date(range.dateTo.getFullYear(), range.dateTo.getMonth() + 1, 0, 23, 59, 59, 999);
  const scoped = await getScopedDashboardData(user);
  let customerList = scoped.customerList.filter((customer) => customer.isActive && !customer.deletedAt);
  let contractList = scoped.contractList.filter((contract) => contract.isActive && !contract.deletedAt);
  const followUpScope = await getFollowUpScope(user);
  let followUpList = await getFollowUps({ ...followUpScope, statuses: ["scheduled", "postponed", "completed", "cancelled"] });
  const requestedScope: { targetUserId?: number; teamId?: number; subBranchAdminId?: number } = {};

  if (input?.targetUserId !== undefined) {
    const target = await verifyTargetUserAccess(user, input.targetUserId);
    if (target.role !== "team_leader" && target.role !== "member") {
      throw new TRPCError({ code: "FORBIDDEN", message: "팀장 또는 팀원 리포트만 조회할 수 있습니다." });
    }
    requestedScope.targetUserId = input.targetUserId;
    customerList = customerList.filter((customer) => customer.agentId === input.targetUserId);
    contractList = contractList.filter((contract) => contract.agentId === input.targetUserId);
    followUpList = followUpList.filter((followUp) => followUp.assignedAgentId === input.targetUserId);
  }

  if (input?.teamId !== undefined) {
    await verifyTeamFilterAccess(user, input.teamId);
    requestedScope.teamId = input.teamId;
    customerList = customerList.filter((customer) => customer.assignedTeamId === input.teamId);
    const teamMembers = await getUsersByTeamId(input.teamId);
    const teamUserIds = new Set(teamMembers.map((item) => item.id));
    contractList = contractList.filter((contract) => teamUserIds.has(contract.agentId ?? -1));
    followUpList = followUpList.filter((followUp) => followUp.teamId === input.teamId);
  }

  if (input?.subBranchAdminId !== undefined) {
    if (user.role !== "branch_admin" && !(user.role === "sub_branch_admin" && input.subBranchAdminId === user.id)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "해당 부지점 리포트를 조회할 권한이 없습니다." });
    }
    requestedScope.subBranchAdminId = input.subBranchAdminId;
    customerList = customerList.filter((customer) => customer.subBranchAdminId === input.subBranchAdminId);
    const subUsers = await getUsersBySubBranchAdminId(input.subBranchAdminId);
    const subUserIds = new Set(subUsers.map((item) => item.id));
    contractList = contractList.filter((contract) => subUserIds.has(contract.agentId ?? -1));
    followUpList = followUpList.filter((followUp) => followUp.subBranchAdminId === input.subBranchAdminId);
  }

  const consultationEntries = await Promise.all(customerList.map(async (customer) => ({
    customer,
    consultations: await getConsultationsByCustomer(customer.id),
  })));
  const allConsultations = consultationEntries.flatMap((entry) => entry.consultations.map((consultation) => ({ ...consultation, customerId: entry.customer.id })));
  const consultationsInPeriod = allConsultations.filter((consultation) => isDateInRange(consultation.createdAt, range.dateFrom, range.dateTo));
  const followUpsCreated = followUpList.filter((followUp) => isDateInRange(getFollowUpCreatedValue(followUp), range.dateFrom, range.dateTo));
  const followUpsCompleted = followUpList.filter((followUp) => followUp.status === "completed" && isDateInRange(getFollowUpCompletedValue(followUp), range.dateFrom, range.dateTo));
  const openOverdueFollowUps = followUpList.filter((followUp) => isOpenFollowUpStatus(followUp.status) && new Date(followUp.nextContactDate) <= toDayEnd(new Date()));
  const contractsInPeriod = contractList.filter((contract) => isDateInRange(getContractDateValue(contract), range.dateFrom, range.dateTo));
  const monthlyContracts = contractList.filter((contract) => isDateInRange(getContractDateValue(contract), monthStart, monthEnd));
  const priorityACustomers = customerList.filter((customer) => customer.priority === "A");
  const managedSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const managedCustomerIds = new Set([
    ...allConsultations.filter((consultation) => isDateInRange(consultation.createdAt, managedSince, new Date())).map((consultation) => consultation.customerId),
    ...followUpList.filter((followUp) => followUp.status === "completed" && isDateInRange(getFollowUpCompletedValue(followUp), managedSince, new Date())).map((followUp) => followUp.customerId),
  ]);
  const priorityAManagedCount = priorityACustomers.filter((customer) => managedCustomerIds.has(customer.id)).length;
  const longUnmanagedCustomerCount = customerList.filter((customer) => {
    const latestConsult = allConsultations
      .filter((consultation) => consultation.customerId === customer.id)
      .map((consultation) => new Date(consultation.createdAt).getTime())
      .filter((time) => !Number.isNaN(time))
      .sort((a, b) => b - a)[0];
    return !latestConsult || daysBetween(new Date(latestConsult), new Date()) >= 90;
  }).length;
  const goalDashboard = await getPerformanceGoalDashboard(user as any, range.dateTo.getFullYear(), range.dateTo.getMonth() + 1);
  const goalItem = goalItemForScope(goalDashboard.items, requestedScope);
  const goal = goalItem?.goal ?? null;
  const actualContractCount = monthlyContracts.length;
  const actualMonthlyPremium = monthlyContracts.reduce((sum, contract) => sum + Number(contract.monthlyPremium ?? 0), 0);
  const contractCountGoal = Number(goal?.contractCountGoal ?? 0);
  const monthlyPremiumGoal = Number(goal?.monthlyPremiumGoal ?? 0);
  const remainingContractCount = Math.max(0, contractCountGoal - actualContractCount);
  const remainingMonthlyPremium = Math.max(0, monthlyPremiumGoal - actualMonthlyPremium);
  const remainingDays = daysRemainingFromToday();
  const priorityContacts = (await buildRecommendationItems(user, new Date())).filter((item) => customerList.some((customer) => customer.id === item.customerId));
  const followUpCompletionRate = followUpsCreated.length > 0 ? Math.round((followUpsCompleted.length / followUpsCreated.length) * 100) : null;
  const insights: string[] = [];
  if (followUpCompletionRate !== null && followUpCompletionRate < 60) insights.push("이번 기간 후속관리 완료율이 낮습니다.");
  if (priorityACustomers.length > priorityAManagedCount) insights.push("A등급 고객 중 최근 관리 이력이 없는 고객이 있습니다.");
  if (remainingContractCount > 0 || remainingMonthlyPremium > 0) insights.push("목표까지 부족한 계약 수 또는 월납보험료가 남아 있습니다.");
  if (priorityContacts.length > 0) insights.push("오늘 우선 연락 고객을 먼저 확인해보세요.");

  return {
    scope: {
      role: user.role,
      userId: user.id,
      targetUserId: requestedScope.targetUserId ?? null,
      teamId: requestedScope.teamId ?? null,
      subBranchAdminId: requestedScope.subBranchAdminId ?? null,
    },
    period: { type: range.period, dateFrom: range.dateFrom.toISOString(), dateTo: range.dateTo.toISOString() },
    consultationCount: consultationsInPeriod.length,
    followUpCreatedCount: followUpsCreated.length,
    followUpCompletedCount: followUpsCompleted.length,
    followUpCompletionRate,
    pendingFollowUpCount: followUpList.filter((followUp) => isOpenFollowUpStatus(followUp.status)).length,
    overdueFollowUpCount: openOverdueFollowUps.length,
    contractCount: contractsInPeriod.length,
    monthlyPremiumSum: contractsInPeriod.reduce((sum, contract) => sum + Number(contract.monthlyPremium ?? 0), 0),
    longUnmanagedCustomerCount,
    priorityACustomerCount: priorityACustomers.length,
    priorityAManagedCount,
    priorityAManagementRate: priorityACustomers.length > 0 ? Math.round((priorityAManagedCount / priorityACustomers.length) * 100) : null,
    goal: goal ? { id: goal.id, targetType: goal.targetType, targetId: goal.targetId, contractCountGoal, monthlyPremiumGoal } : null,
    actual: { contractCount: actualContractCount, monthlyPremium: actualMonthlyPremium },
    remaining: { contractCount: remainingContractCount, monthlyPremium: remainingMonthlyPremium },
    remainingDays,
    dailyRequired: {
      contractCount: Number((remainingContractCount / remainingDays).toFixed(1)),
      monthlyPremium: Math.ceil(remainingMonthlyPremium / remainingDays),
    },
    recommendedTodayActions: {
      priorityContactCount: priorityContacts.length,
      highUrgencyContactCount: priorityContacts.filter((item) => item.urgency === "high").length,
      suggestedConsultationCount: Math.max(priorityContacts.filter((item) => item.urgency === "high").length, Math.ceil(remainingContractCount / remainingDays) * 3),
    },
    insights,
  };
}

export const appRouter = router({
  system: systemRouter,

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Users ─────────────────────────────────────────────────────────────────
  recommendations: router({
    priorityContacts: activeUserProcedure
      .input(z.object({
        date: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
        urgency: z.enum(["high", "medium", "low"]).optional(),
        includeWarnings: z.boolean().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const baseDate = input?.date ? new Date(input.date) : new Date();
        const items = await buildRecommendationItems(ctx.user, baseDate);
        return items
          .filter((item) => item.totalScore > 0)
          .filter((item) => !input?.urgency || item.urgency === input.urgency)
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, input?.limit ?? 10)
          .map((item) => ({ ...item, warnings: input?.includeWarnings === false ? [] : item.warnings }));
      }),

    customerWarnings: activeUserProcedure
      .input(z.object({
        customerId: z.number().optional(),
        warningTypes: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (input?.customerId) await verifyCustomerAccess(ctx.user, input.customerId);
        const items = await buildRecommendationItems(ctx.user, new Date());
        return items
          .filter((item) => !input?.customerId || item.customerId === input.customerId)
          .flatMap((item) => item.warnings.map((warning) => ({
            customerId: item.customerId,
            customerName: item.customerName,
            ...warning,
            detectedAt: new Date(),
          })))
          .filter((warning) => !input?.warningTypes?.length || input.warningTypes.includes(warning.warningType))
          .slice(0, input?.limit ?? 50);
      }),

    customerContactReasons: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const items = await buildRecommendationItems(ctx.user, new Date());
        const item = items.find((entry) => entry.customerId === input.customerId);
        return {
          customerId: input.customerId,
          reasons: item?.contactReasons ?? [{ reasonType: "general_check", ...buildSafeContactReason("general_check") }],
          warnings: item?.warnings ?? [],
          recommendedAction: item?.recommendedAction ?? "고객 상태 점검",
          urgency: item?.urgency ?? "low",
        };
      }),

    dashboardSummary: activeUserProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const baseDate = input?.date ? new Date(input.date) : new Date();
        const items = await buildRecommendationItems(ctx.user, baseDate);
        const scored = items.filter((item) => item.totalScore > 0);
        return {
          priorityContactCount: scored.length,
          highUrgencyCount: scored.filter((item) => item.urgency === "high").length,
          warningCount: scored.reduce((sum, item) => sum + item.warnings.length, 0),
          topContacts: scored.sort((a, b) => b.totalScore - a.totalScore).slice(0, 5),
        };
      }),
  }),

  workRhythm: router({
    summary: activeUserProcedure
      .input(z.object({
        period: z.enum(["week", "month", "custom"]).default("week"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        targetUserId: z.number().optional(),
        teamId: z.number().optional(),
        subBranchAdminId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => buildWorkRhythmReport(ctx.user, input ?? { period: "week" })),
  }),

  users: router({
    list: activeUserProcedure.query(async ({ ctx }) => {
      const all = await getAllUsers();
      if (ctx.user.role === "branch_admin") return all;
      // 비활성 사용자 제외 후 반환
      if (ctx.user.role === "sub_branch_admin") {
        return all
          .filter((u) => u.accountStatus === "active" && u.subBranchAdminId === ctx.user.id && (u.role === "team_leader" || u.role === "member"))
          .map(toMinimalUser);
      }
      if (ctx.user.role === "team_leader") {
        if (ctx.user.teamId === null) return [toMinimalUser(ctx.user)];
        return all
          .filter((u) => u.accountStatus === "active" && u.teamId === ctx.user.teamId && u.role === "member")
          .map(toMinimalUser);
      }
      return [toMinimalUser(ctx.user)];
    }),

    updateRole: branchAdminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["branch_admin", "sub_branch_admin", "team_leader", "member"]) }))
      .mutation(async ({ ctx, input }) => {
        const existingForRole = await getUserById(input.userId);
        const previousRole = existingForRole?.role ?? null;
        await updateUserRole(input.userId, input.role);
        await log(ctx.user.id, "USER_ROLE_CHANGED", "user", input.userId,
          JSON.stringify({ actor: ctx.user.id, targetUserId: input.userId, previousRole, newRole: input.role, beforeValue: { role: previousRole }, afterValue: { role: input.role } }));
        return { success: true };
      }),

    create: branchAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["branch_admin", "sub_branch_admin", "team_leader", "member"]),
        accountStatus: z.enum(["active", "inactive", "resigned"]).default("active"),
        teamId: z.number().nullable().optional(),
        subBranchAdminId: z.number().nullable().optional(),
        phone: z.string().optional(),
        memo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 조건 2: 이메일 중복 검증
        const existing = await getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 등록된 이메일입니다." });
        // 조건 4: 역할별 조직 정합성 검증
        let resolvedSubBranchAdminId = input.subBranchAdminId ?? null;
        const resolvedTeamId = input.teamId ?? null;
        if (resolvedTeamId) {
          const team = await getTeamById(resolvedTeamId);
          if (team) resolvedSubBranchAdminId = (team as any).subBranchAdminId ?? null;
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
        if (!newUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "사용자 생성에 실패했습니다." });
        await log(ctx.user.id, "USER_CREATED", "user", newUser.id,
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
            }
          }));
        return { success: true, userId: newUser.id };
      }),

    updateAccountStatus: branchAdminProcedure
      .input(z.object({ userId: z.number(), accountStatus: z.enum(["active", "inactive", "resigned"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserAccountStatus(input.userId, input.accountStatus);
        const action = input.accountStatus !== "active" ? "USER_BLOCKED" : "USER_ACTIVATED";
        await log(ctx.user.id, action, "user", input.userId, `accountStatus=${input.accountStatus}`);
        return { success: true };
      }),

    updateTeam: branchAdminProcedure
      .input(z.object({ userId: z.number(), teamId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const existingUserForTeam = await getUserById(input.userId);
        const previousTeamId = existingUserForTeam?.teamId ?? null;
        const previousSubBranchAdminId = existingUserForTeam?.subBranchAdminId ?? null;
        await updateUserTeam(input.userId, input.teamId);
        // 새 팀의 subBranchAdminId 조회 (자동 동기화 후)
        const newUserState = await getUserById(input.userId);
        const newSubBranchAdminId = newUserState?.subBranchAdminId ?? null;
        // 로그 분기: 최초 배치 vs 팀 이동
        const teamLogAction = previousTeamId === null ? "MEMBER_ASSIGNED_TO_TEAM" : "USER_MOVED_TO_ANOTHER_TEAM";
        await log(ctx.user.id, teamLogAction, "user", input.userId,
          JSON.stringify({ actor: ctx.user.id, targetUserId: input.userId, previousTeamId, newTeamId: input.teamId, previousSubBranchAdminId, newSubBranchAdminId, beforeValue: { teamId: previousTeamId, subBranchAdminId: previousSubBranchAdminId }, afterValue: { teamId: input.teamId, subBranchAdminId: newSubBranchAdminId } }));
        // 부지점장 산하가 자동 동기화된 경우 추가 로그
        if (previousSubBranchAdminId !== newSubBranchAdminId) {
          await log(ctx.user.id, "USER_MOVED_TO_ANOTHER_SUB_BRANCH", "user", input.userId,
            JSON.stringify({ actor: ctx.user.id, targetUserId: input.userId, previousSubBranchAdminId, newSubBranchAdminId, reason: "team_change_auto_sync", previousTeamId, newTeamId: input.teamId }));
        }
        await log(ctx.user.id, "USER_TEAM_CHANGED", "user", input.userId, `teamId=${input.teamId}`);
        return { success: true };
      }),

    updateSubBranchAdmin: branchAdminProcedure
      .input(z.object({ userId: z.number(), subBranchAdminId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        // 조건 6: 서버 레벨 불일치 차단 - teamId가 있으면 해당 팀의 subBranchAdminId와 일치 확인
        const existingUser = await getUserById(input.userId); // 수정 전 먼저 조회 (before 값 정확성)
        if (existingUser?.teamId && input.subBranchAdminId !== null) {
          const team = await getTeamById(existingUser.teamId);
          if (team && (team as any).subBranchAdminId !== null && (team as any).subBranchAdminId !== input.subBranchAdminId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "사용자의 소속 팀과 부지점장 산하 정보가 일치하지 않습니다. 팀 이동과 함께 처리해야 합니다."
            });
          }
        }
        const previousSubBranchAdminId = existingUser?.subBranchAdminId ?? null;
        await updateUserSubBranchAdmin(input.userId, input.subBranchAdminId);
        await log(ctx.user.id, "SUB_BRANCH_ADMIN_ASSIGNED", "user", input.userId,
          JSON.stringify({ before: { subBranchAdminId: previousSubBranchAdminId }, after: { subBranchAdminId: input.subBranchAdminId } }));
        await log(ctx.user.id, "USER_MOVED_TO_ANOTHER_SUB_BRANCH", "user", input.userId,
          JSON.stringify({ actor: ctx.user.id, targetUserId: input.userId, previousSubBranchAdminId, newSubBranchAdminId: input.subBranchAdminId }));
        return { success: true };
      }),

    teams: activeUserProcedure.query(async () => getAllTeams()),

    createTeam: branchAdminProcedure
      .input(z.object({ name: z.string().min(1), managerId: z.number().optional(), subBranchAdminId: z.number().optional(), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await createTeam(input.name, input.managerId, input.subBranchAdminId, input.description);
        await log(ctx.user.id, "TEAM_CREATED", "team", undefined, `name=${input.name}`);
        return { success: true };
      }),

    updateTeamInfo: branchAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        managerId: z.number().optional().nullable(),
        subBranchAdminId: z.number().optional().nullable(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const existing = await getTeamById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (data.isActive === false) {
          await assertTeamCanBeDeactivated(id);
        }
        const updateData = data.isActive === false ? { ...data, deletedAt: new Date() } : data;
        await updateTeam(id, updateData);

        if (data.isActive === false) {
          await log(ctx.user.id, "TEAM_DEACTIVATED", "team", id,
            logDetails({
              actor: ctx.user.id,
              targetId: id,
              targetType: "team",
              beforeValue: { isActive: existing?.isActive ?? null, deletedAt: (existing as any)?.deletedAt ?? null },
              afterValue: { isActive: false },
              metadata: { deleteMode: "soft" },
            }));
        } else if (data.managerId !== undefined) {
          const previousManagerId = existing?.managerId ?? null;
          await log(ctx.user.id, "TEAM_LEADER_ASSIGNED", "team", id,
            JSON.stringify({ actor: ctx.user.id, teamId: id, previousTeamLeaderId: previousManagerId, newTeamLeaderId: data.managerId, beforeValue: { managerId: previousManagerId }, afterValue: { managerId: data.managerId } }));
        } else {
          await log(ctx.user.id, "TEAM_UPDATED", "team", id, JSON.stringify({ before: existing, after: data }));
        }
        return { success: true };
      }),

    deactivateTeam: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertTeamCanBeDeactivated(input.id);
        await deactivateTeam(input.id);
        await log(ctx.user.id, "TEAM_DEACTIVATED", "team", input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "team",
            beforeValue: { isActive: existing.isActive, deletedAt: (existing as any).deletedAt ?? null },
            afterValue: { isActive: false },
            metadata: { deleteMode: "soft" },
          }));
        return { success: true };
      }),
  }),

  // ── Admin Security ────────────────────────────────────────────────────────
  adminSecurity: router({
    forceLogoutUser: branchAdminProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string().min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const target = await getUserById(input.userId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." });

        const invalidatedAt = new Date();
        const affectedSessionCount = await invalidateUserSessions(input.userId, invalidatedAt);
        await log(ctx.user.id, "USER_FORCE_LOGOUT", "user", input.userId, logDetails({
          actor: ctx.user.id,
          targetId: input.userId,
          targetType: "user",
          beforeValue: { sessionInvalidatedAt: target.sessionInvalidatedAt ?? null },
          afterValue: { sessionInvalidatedAt: invalidatedAt },
          metadata: { reason: input.reason, affectedSessionCount },
        }));

        return { success: true, affectedSessionCount };
      }),

    forceLogoutAll: branchAdminProcedure
      .input(z.object({
        reason: z.string().min(1).max(500),
        confirmText: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== ALL_FORCE_LOGOUT_CONFIRM_TEXT) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "확인 문구가 일치하지 않습니다." });
        }

        const invalidatedAt = new Date();
        const affectedSessionCount = await invalidateAllUserSessions(invalidatedAt);
        await log(ctx.user.id, "ALL_USERS_FORCE_LOGOUT", "user", ctx.user.id, logDetails({
          actor: ctx.user.id,
          targetType: "user",
          metadata: { reason: input.reason, affectedSessionCount, sessionInvalidatedAt: invalidatedAt },
        }));

        return { success: true, affectedSessionCount };
      }),

    resetOAuthLink: branchAdminProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string().min(1).max(500),
        confirmText: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== OAUTH_RESET_CONFIRM_TEXT) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "확인 문구가 일치하지 않습니다." });
        }

        const target = await getUserById(input.userId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." });

        const beforeLoginStatus = target.loginStatus ?? null;
        const beforeOpenIdState = target.openId?.startsWith("invited_") ? "invited" : target.openId ? "linked" : "empty";
        await resetUserOAuthLink(input.userId);
        await log(ctx.user.id, "USER_OAUTH_RESET", "user", input.userId, logDetails({
          actor: ctx.user.id,
          targetId: input.userId,
          targetType: "user",
          beforeValue: { loginStatus: beforeLoginStatus, openIdState: beforeOpenIdState },
          afterValue: { loginStatus: "invited", openIdState: "invited", sessionInvalidated: true },
          metadata: { reason: input.reason, openIdReset: true },
        }));

        return { success: true };
      }),

    loginHistory: branchAdminProcedure
      .input(z.object({
        action: z.string().optional(),
        userId: z.number().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(100),
      }).optional())
      .query(async ({ input }) => {
        const entries = await getActivityLogs(1000);
        const users = await getAllUsers();
        const usersById = new Map(users.map((user) => [user.id, user]));
        const search = input?.search?.trim().toLowerCase();

        return entries
          .filter((entry) => LOGIN_HISTORY_ACTIONS.has(entry.action))
          .filter((entry) => !input?.action || entry.action === input.action)
          .filter((entry) => !input?.userId || entry.userId === input.userId || entry.targetId === input.userId)
          .map((entry) => {
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
              user: targetUser ? {
                id: targetUser.id,
                name: targetUser.name,
                email: targetUser.email ? maskEmail(targetUser.email) : null,
                role: targetUser.role,
                accountStatus: targetUser.accountStatus,
                loginStatus: targetUser.loginStatus,
              } : null,
              actor: actor ? { id: actor.id, name: actor.name, role: actor.role } : null,
              details,
            };
          })
          .filter((entry) => {
            if (!search) return true;
            return [entry.action, entry.user?.name ?? "", entry.user?.email ?? "", entry.actor?.name ?? ""]
              .some((value) => value.toLowerCase().includes(search));
          })
          .slice(0, input?.limit ?? 100);
      }),
  }),

  adminHandoff: router({
    listUsers: branchAdminProcedure.query(async ({ ctx }) => {
      const allUsers = await getAllUsers();
      return allUsers
        .filter((user) => user.id !== ctx.user.id)
        .map((user) => ({
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
          throw new TRPCError({ code: "BAD_REQUEST", message: "본인 계정은 인수인계 대상으로 선택할 수 없습니다." });
        }
        const preview = await getHandoffPreview(input.sourceUserId);
        if (!preview) throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." });
        await log(ctx.user.id, "USER_HANDOFF_PREVIEWED", "user", input.sourceUserId, logDetails({
          actor: ctx.user.id,
          targetType: "user",
          targetId: input.sourceUserId,
          metadata: { counts: preview.counts },
        }));
        return preview;
      }),

    execute: branchAdminProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== "인수인계") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "확인 문구가 일치하지 않습니다." });
        }
        if (input.sourceUserId === input.targetUserId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "이관 대상자와 새 담당자가 같습니다." });
        }
        if (input.sourceUserId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "본인 계정은 인수인계 대상으로 선택할 수 없습니다." });
        }

        const source = await getUserById(input.sourceUserId);
        const target = await getUserById(input.targetUserId);
        if (!source || !target) throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." });
        if (target.accountStatus !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "새 담당자는 active 상태여야 합니다." });
        }
        if (target.role !== "member" && target.role !== "team_leader") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "고객 담당자는 active team_leader 또는 member만 지정할 수 있습니다." });
        }
        if (!target.teamId || !target.subBranchAdminId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "새 담당자의 팀과 부지점장 정보가 필요합니다." });
        }

        const result = await executeUserHandoff({ ...input, executedBy: ctx.user.id });
        if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "인수인계 처리에 실패했습니다." });
        return result;
      }),

    history: branchAdminProcedure
      .input(z.object({
        sourceUserId: z.number().optional(),
        targetUserId: z.number().optional(),
        limit: z.number().min(1).max(200).default(50),
      }).optional())
      .query(async ({ input }) => getHandoffHistories(input)),
  }),

  adminAudit: router({
    summary: branchAdminProcedure.query(async () => {
      const [users, activeCustomers, deletedCustomers, activeContracts, deletedContracts, notifications, logs] = await Promise.all([
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
      const recentLogs = logs.filter((entry) => new Date(entry.createdAt).getTime() >= sevenDaysAgo.getTime());

      const recentRiskEvents = recentLogs
        .filter((entry) => RISK_ACTIONS.has(entry.action))
        .slice(0, 10)
        .map((entry) => {
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
          activeUsers: users.filter((user) => user.accountStatus === "active").length,
          inactiveUsers: users.filter((user) => user.accountStatus === "inactive").length,
          resignedUsers: users.filter((user) => user.accountStatus === "resigned").length,
          activeCustomers: activeCustomers.length,
          softDeletedCustomers: deletedCustomers.length,
          activeContracts: activeContracts.length,
          softDeletedContracts: deletedContracts.length,
          unreadNotifications: notifications.filter((notification) => !notification.isRead || notification.processStatus === "미확인").length,
          todayCustomers: activeCustomers.filter((customer) => isWithinDateRange(new Date(customer.createdAt), todayStart, todayEnd)).length,
          todayContracts: activeContracts.filter((contract) => isWithinDateRange(new Date(contract.createdAt), todayStart, todayEnd)).length,
          recentDownloads: recentLogs.filter((entry) => DOWNLOAD_ACTIONS.has(entry.action)).length,
          recentDeleteRestore: recentLogs.filter((entry) => DELETE_AUDIT_ACTIONS.has(entry.action)).length,
          recentLoginBlocked: recentLogs.filter((entry) => entry.action === "LOGIN_BLOCKED").length,
          recentSecurityActions: recentLogs.filter((entry) => entry.action === "USER_OAUTH_RESET" || entry.action === "USER_FORCE_LOGOUT" || entry.action === "ALL_USERS_FORCE_LOGOUT").length,
        },
        recentRiskEvents,
      };
    }),

    logSearch: branchAdminProcedure
      .input(z.object({
        datePreset: z.enum(["today", "7d", "30d", "custom"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        actorId: z.number().optional(),
        action: z.string().optional(),
        targetType: z.string().optional(),
        category: z.enum(["download", "delete", "security", "customer", "contract", "user"]).optional(),
        riskOnly: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        const logs = await getActivityLogs(2000);
        const users = await getAllUsers();
        const usersById = new Map(users.map((user) => [user.id, user]));
        const now = new Date();
        let dateFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        let dateTo = input?.dateTo ? toDayEnd(new Date(input.dateTo)) : undefined;
        if (input?.datePreset === "today") {
          dateFrom = toDayStart(now);
          dateTo = toDayEnd(now);
        } else if (input?.datePreset === "7d") {
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (input?.datePreset === "30d") {
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        const search = input?.search?.trim().toLowerCase();

        const matchesCategory = (entry: { action: string; targetType: string | null }) => {
          if (!input?.category) return true;
          if (input.category === "download") return DOWNLOAD_ACTIONS.has(entry.action);
          if (input.category === "delete") return DELETE_AUDIT_ACTIONS.has(entry.action);
          if (input.category === "security") return SECURITY_AUDIT_ACTIONS.has(entry.action);
          return entry.targetType === input.category;
        };

        const filtered = logs
          .filter((entry) => isWithinDateRange(new Date(entry.createdAt), dateFrom, dateTo))
          .filter((entry) => !input?.actorId || entry.userId === input.actorId)
          .filter((entry) => !input?.action || entry.action === input.action)
          .filter((entry) => !input?.targetType || entry.targetType === input.targetType)
          .filter((entry) => !input?.riskOnly || RISK_ACTIONS.has(entry.action))
          .filter(matchesCategory)
          .map((entry) => {
            const actor = usersById.get(entry.userId);
            const details = summarizeLogDetails(entry.details);
            return {
              id: entry.id,
              createdAt: entry.createdAt,
              actor: actor ? { id: actor.id, name: actor.name, email: actor.email ? maskEmail(actor.email) : null, role: actor.role } : null,
              action: entry.action,
              targetType: entry.targetType,
              targetId: entry.targetId,
              riskLevel: getRiskLevel(entry.action),
              reason: details.reason,
              summary: details.summary,
            };
          })
          .filter((entry) => {
            if (!search) return true;
            return [
              entry.action,
              entry.targetType ?? "",
              String(entry.targetId ?? ""),
              entry.actor?.name ?? "",
              entry.actor?.email ?? "",
              entry.reason ?? "",
              entry.summary ?? "",
            ].some((value) => value.toLowerCase().includes(search));
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
  customers: router({
    list: activeUserProcedure
      .input(z.object({
        status: z.string().optional(),
        unassigned: z.boolean().optional(),
        region: z.string().optional(),
        source: z.string().optional(),
        priority: z.enum(CUSTOMER_PRIORITIES).optional(),
        tag: z.enum(CUSTOMER_TAGS).optional(),
        nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
        agentIdFilter: z.number().optional(),
        assignedDateFrom: z.string().optional(),
        assignedDateTo: z.string().optional(),
        scope: z.enum(["all", "mine"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (input.scope === "all" && user.role !== "branch_admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "전체 DB는 지점장만 조회할 수 있습니다." });
        }
        const baseFilter = {
          status: input.status,
          unassigned: input.unassigned,
          region: input.region,
          source: input.source,
          priority: input.priority,
          tag: input.tag,
          nextAction: input.nextAction,
          assignedDateFrom: input.assignedDateFrom ? new Date(input.assignedDateFrom) : undefined,
          assignedDateTo: input.assignedDateTo ? new Date(input.assignedDateTo) : undefined,
        };
        if (user.role === "branch_admin") {
          const scopedAgentId = input.scope === "mine" ? user.id : input.agentIdFilter;
          return getCustomers({ ...baseFilter, agentId: scopedAgentId });
        }
        if (user.role === "sub_branch_admin") return getCustomers({ ...baseFilter, subBranchAdminId: user.id });
        if (user.role === "team_leader") {
          if (user.teamId === null) return [];
          return getCustomers({ ...baseFilter, teamId: user.teamId });
        }
        return getCustomers({ ...baseFilter, agentId: user.id });
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
      .query(async ({ input }) => {
        const dup = await checkPhoneDuplicate(input.phone, input.excludeId);
        return { isDuplicate: !!dup };
      }),

    create: branchAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        birthDate: z.string().optional(),
        gender: z.enum(["male", "female", "other"]).optional(),
        region: z.string().optional(),
        expectedPremium: z.number().optional(),
        availableTime: z.string().optional(),
        source: z.string().optional(),
        consultStatus: z.enum(["미상담","부재","통화완료","상담예정","설계중","계약","보류","거절","해지관리","재상담필요"]).optional(),
        priority: z.enum(CUSTOMER_PRIORITIES).optional(),
        customerTags: z.array(z.enum(CUSTOMER_TAGS)).max(10).optional(),
        nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).nullable().optional(),
        privacyConsent: z.boolean().default(false),
        marketingConsent: z.boolean().default(false),
        memo: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.phone) {
          const dup = await checkPhoneDuplicate(input.phone);
          if (dup) throw new TRPCError({ code: "CONFLICT", message: `이미 동일한 연락처가 등록되어 있습니다. (${dup.name})` });
        }
        const { customerTags, ...customerInput } = input;
        await createCustomer({ ...customerInput, customerTags: encodeCustomerTags(customerTags), phone: input.phone ? normalizePhone(input.phone) : undefined, birthDate: input.birthDate ? new Date(input.birthDate) : undefined, createdBy: ctx.user.id });
        await log(ctx.user.id, "CUSTOMER_CREATED", "customer", undefined, `name=${input.name}`);
        return { success: true };
      }),

    update: activeUserProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        birthDate: z.string().optional(),
        gender: z.enum(["male", "female", "other"]).optional(),
        region: z.string().optional(),
        expectedPremium: z.number().optional(),
        availableTime: z.string().optional(),
        source: z.string().optional(),
        privacyConsent: z.boolean().optional(),
        marketingConsent: z.boolean().optional(),
        memo: z.string().optional(),
        priority: z.enum(CUSTOMER_PRIORITIES).optional(),
        customerTags: z.array(z.enum(CUSTOMER_TAGS)).max(10).optional(),
        nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
        consultStatus: z.enum(["미상담","부재","통화완료","상담예정","설계중","계약","보류","거절","해지관리","재상담필요"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, birthDate, consultStatus, privacyConsent, marketingConsent, customerTags, ...rest } = input;
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
          await createStatusHistory({ customerId: id, changedBy: ctx.user.id, previousStatus: existing.consultStatus, newStatus: consultStatus });
          beforeSnapshot.consultStatus = existing.consultStatus;
          afterSnapshot.consultStatus = consultStatus;
        }
        if (privacyConsent !== undefined && privacyConsent !== existing.privacyConsent) {
          await createConsentLog({ customerId: id, changedBy: ctx.user.id, consentType: "privacy", previousValue: existing.privacyConsent ?? false, newValue: privacyConsent });
        }
        if (marketingConsent !== undefined && marketingConsent !== existing.marketingConsent) {
          await createConsentLog({ customerId: id, changedBy: ctx.user.id, consentType: "marketing", previousValue: existing.marketingConsent ?? false, newValue: marketingConsent });
        }

        const encodedTags = encodeCustomerTags(customerTags);
        if (encodedTags !== undefined && existing.customerTags !== encodedTags) {
          beforeSnapshot.customerTags = decodeCustomerTags(existing.customerTags);
          afterSnapshot.customerTags = customerTags ?? [];
        }
        await updateCustomer(id, { ...rest, customerTags: encodedTags, consultStatus, privacyConsent, marketingConsent, birthDate: birthDate ? new Date(birthDate) : undefined });
        await log(ctx.user.id, "CUSTOMER_UPDATED", "customer", id, JSON.stringify({ before: beforeSnapshot, after: afterSnapshot }));
        return { success: true };
      }),

    updateManagementMeta: activeUserProcedure
      .input(z.object({
        customerId: z.number(),
        priority: z.enum(CUSTOMER_PRIORITIES).optional(),
        customerTags: z.array(z.enum(CUSTOMER_TAGS)).max(10).optional(),
        nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "비활성 고객은 관리 정보를 수정할 수 없습니다." });
        const updates: Record<string, unknown> = {};
        if (input.priority !== undefined) updates.priority = input.priority;
        if (input.nextAction !== undefined) updates.nextAction = input.nextAction;
        if (input.customerTags !== undefined) updates.customerTags = encodeCustomerTags(input.customerTags);
        await updateCustomer(input.customerId, updates as any);
        if (input.priority !== undefined && input.priority !== customer.priority) {
          await log(ctx.user.id, "CUSTOMER_PRIORITY_UPDATED", "customer", input.customerId, logDetails({
            actor: ctx.user.id,
            targetId: input.customerId,
            targetType: "customer",
            beforeValue: { priority: customer.priority },
            afterValue: { priority: input.priority },
          }));
        }
        if (input.customerTags !== undefined) {
          await log(ctx.user.id, "CUSTOMER_TAGS_UPDATED", "customer", input.customerId, logDetails({
            actor: ctx.user.id,
            targetId: input.customerId,
            targetType: "customer",
            beforeValue: { tags: decodeCustomerTags(customer.customerTags) },
            afterValue: { tags: input.customerTags },
          }));
        }
        if (input.nextAction !== undefined && input.nextAction !== customer.nextAction) {
          await log(ctx.user.id, "CUSTOMER_NEXT_ACTION_UPDATED", "customer", input.customerId, logDetails({
            actor: ctx.user.id,
            targetId: input.customerId,
            targetType: "customer",
            beforeValue: { nextAction: customer.nextAction ?? null },
            afterValue: { nextAction: input.nextAction },
          }));
        }
        return { success: true };
      }),

    deactivate: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await verifyCustomerDeleteAccess(ctx.user, input.id);
        await softDeleteCustomer(input.id);
        await log(ctx.user.id, "CUSTOMER_DEACTIVATED", "customer", input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "customer",
            beforeValue: { isActive: existing.isActive, deletedAt: (existing as any).deletedAt ?? null },
            afterValue: { isActive: false },
            metadata: { deleteMode: "soft" },
          }));
        return { success: true };
      }),

    /** 지점장이 부지점장에게 DB 배분 */
    assignToSubBranch: branchAdminProcedure
      .input(z.object({ customerId: z.number(), subBranchAdminId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        await verifySubBranchAdminTarget(input.subBranchAdminId);
        if (customer.assignmentStatus === "assigned_to_agent" || customer.agentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "이미 담당자에게 배정된 고객은 부지점장에게 되돌릴 수 없습니다." });
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
        await runDbTransaction(async (tx) => {
          await assignCustomerToSubBranch(input.customerId, input.subBranchAdminId, tx);
          await createAssignmentHistory({
            customerId: input.customerId,
            previousSubBranchAdminId: prevSubBranchAdminId ?? undefined,
            newSubBranchAdminId: input.subBranchAdminId,
            previousAgentId: customer.agentId ?? undefined,
            assignedBy: ctx.user.id,
            assignmentType: "branch_to_sub_branch",
          }, tx);
          await log(ctx.user.id, "DB_ASSIGNED_TO_SUB_BRANCH_ADMIN", "customer", input.customerId, subBranchAssignmentDetails, tx);
          await log(ctx.user.id, "ASSIGNMENT_HISTORY_CREATED", "customer", input.customerId, undefined, tx);
          await log(ctx.user.id, "CUSTOMER_TRANSFERRED", "customer", input.customerId, subBranchAssignmentDetails, tx);
        });
        return { success: true };
      }),

    /** 지점장 또는 부지점장이 팀원에게 최종 배정 */
    assign: subBranchAdminOrAboveProcedure
      .input(z.object({ customerId: z.number(), agentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        const agent = await verifyAgentTarget(user, input.agentId);

        // 부지점장 이중 검증 (조건 3)
        if (user.role === "sub_branch_admin") {
          // ① 고객 DB가 본인에게 배분된 것인지
          if (customer.subBranchAdminId !== user.id)
            throw new TRPCError({ code: "FORBIDDEN", message: "본인에게 배분된 DB만 배정 가능합니다." });
          // ② 배정 대상이 본인 산하 팀장/팀원인지
        }

        const prevAgentId = customer.agentId;
        if (prevAgentId === input.agentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "현재 담당자와 동일한 사용자는 선택할 수 없습니다." });
        }
        const isBranchAdminSelfAssignment = user.role === "branch_admin" && agent.id === user.id && agent.role === "branch_admin";
        const nextTeamId = isBranchAdminSelfAssignment ? null : agent?.teamId ?? null;
        const nextSubBranchAdminId = isBranchAdminSelfAssignment ? null : agent?.subBranchAdminId ?? null;

        // DB 배정 로그 분리 (역할 및 assignmentType 기반)
        const assignLogAction = isBranchAdminSelfAssignment ? "CUSTOMER_SELF_ASSIGNED_BY_BRANCH_ADMIN" : user.role === "branch_admin" ? "DB_ASSIGNED_BY_BRANCH_ADMIN" : "DB_ASSIGNED_BY_SUB_BRANCH_ADMIN";
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
            newAgentId: input.agentId,
            newSubBranchAdminId: nextSubBranchAdminId,
            newTeamId: nextTeamId,
          },
          metadata: { assignmentType: user.role === "branch_admin" ? "branch_to_agent" : "sub_branch_to_agent", selfManagedByBranchAdmin: isBranchAdminSelfAssignment },
        });
        await runDbTransaction(async (tx) => {
          await assignCustomer(input.customerId, input.agentId, nextTeamId ?? undefined, nextSubBranchAdminId ?? undefined, tx);
          await createAssignmentHistory({
            customerId: input.customerId,
            previousSubBranchAdminId: customer.subBranchAdminId ?? undefined,
            newSubBranchAdminId: nextSubBranchAdminId ?? undefined,
            previousTeamId: customer.assignedTeamId ?? undefined,
            newTeamId: nextTeamId ?? undefined,
            previousAgentId: prevAgentId ?? undefined,
            newAgentId: input.agentId,
            assignedBy: ctx.user.id,
            assignmentType: user.role === "branch_admin" ? "branch_to_agent" : "sub_branch_to_agent",
          }, tx);
          await log(ctx.user.id, assignLogAction, "customer", input.customerId, agentAssignmentDetails, tx);
          await log(ctx.user.id, "ASSIGNMENT_HISTORY_CREATED", "customer", input.customerId, undefined, tx);
          await log(ctx.user.id, "CUSTOMER_ASSIGNED", "customer", input.customerId, agentAssignmentDetails, tx);
          await createNotification({ userId: input.agentId, type: "customer_assigned", title: "새 고객 배정", message: `${customer.name} 고객이 배정되었습니다.`, relatedType: "customer", relatedId: input.customerId, dueAt: new Date() }, tx);
        });

        await createUncontactedReminder(input.customerId, input.agentId, new Date(), customer.name);
        if (customer.birthDate) await createBirthdayReminder(input.customerId, input.agentId, new Date(customer.birthDate), customer.name);
        await refreshLongUnmanagedReminder(input.customerId, input.agentId, new Date(), customer.name);
        return { success: true };
      }),

    changeAgent: teamLeaderOrAboveProcedure
      .input(z.object({ customerId: z.number(), newAgentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await verifyCustomerAccess(ctx.user, input.customerId);
        const agent = await verifyAgentTarget(ctx.user, input.newAgentId);
        const prevAgentId = existing.agentId ?? null;
        if (prevAgentId === input.newAgentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "현재 담당자와 동일한 사용자는 선택할 수 없습니다." });
        }
        const isBranchAdminSelfAssignment = ctx.user.role === "branch_admin" && agent.id === ctx.user.id && agent.role === "branch_admin";
        const nextTeamId = isBranchAdminSelfAssignment ? null : agent?.teamId ?? null;
        const nextSubBranchAdminId = isBranchAdminSelfAssignment ? null : agent?.subBranchAdminId ?? null;
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
          metadata: { assignmentType: "reassignment", selfManagedByBranchAdmin: isBranchAdminSelfAssignment },
        });
        await runDbTransaction(async (tx) => {
          await assignCustomer(input.customerId, input.newAgentId, nextTeamId ?? undefined, nextSubBranchAdminId ?? undefined, tx);
          await createAssignmentHistory({
            customerId: input.customerId,
            previousSubBranchAdminId: existing.subBranchAdminId ?? undefined,
            newSubBranchAdminId: nextSubBranchAdminId ?? undefined,
            previousTeamId: existing.assignedTeamId ?? undefined,
            newTeamId: nextTeamId ?? undefined,
            previousAgentId: existing.agentId ?? undefined,
            newAgentId: input.newAgentId,
            assignedBy: ctx.user.id,
            assignmentType: "reassignment",
          }, tx);
          await log(ctx.user.id, "AGENT_CHANGED", "customer", input.customerId, transferDetails, tx);
          await log(ctx.user.id, "CUSTOMER_REASSIGNED", "customer", input.customerId, transferDetails, tx);
          if (isBranchAdminSelfAssignment) {
            await log(ctx.user.id, "CUSTOMER_SELF_ASSIGNED_BY_BRANCH_ADMIN", "customer", input.customerId, transferDetails, tx);
          }
          if ((existing.subBranchAdminId ?? null) !== nextSubBranchAdminId) {
            await log(ctx.user.id, "CUSTOMER_TRANSFERRED", "customer", input.customerId, transferDetails, tx);
          }
        });
        return { success: true };
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

    // ── Bulk Import (지점장 전용) ────────────────────────────────────────────
    timeline: activeUserProcedure
      .input(z.object({
        customerId: z.number(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        eventTypes: z.array(z.string()).max(20).optional(),
        limit: z.number().min(1).max(200).optional(),
      }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
        if (dateFrom && Number.isNaN(dateFrom.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "dateFrom이 올바르지 않습니다." });
        if (dateTo && Number.isNaN(dateTo.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "dateTo가 올바르지 않습니다." });
        return getCustomerTimeline(input.customerId, {
          dateFrom,
          dateTo,
          eventTypes: input.eventTypes,
          limit: input.limit,
        });
      }),

    downloadImportTemplate: branchAdminProcedure.query(async ({ ctx }) => {
      const headers = [
        "이름",
        "연락처",
        "생년월일",
        "성별",
        "지역",
        "예상보험료",
        "통화가능시간",
        "유입경로",
        "상담상태",
        "메모",
        "부지점장",
        "팀",
        "담당자",
      ];
      const csvContent = headers.join(",");
      await log(ctx.user.id, "DATA_DOWNLOAD", "template", undefined, "type=bulk_import_template");
      return { headers, csvContent };
    }),

    previewImport: branchAdminProcedure
      .input(z.object({
        rows: z.array(z.record(z.string(), z.any())).max(5000),
        fileName: z.string().optional(),
        fileSize: z.number().nonnegative().optional(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        verifyBulkImportFilePolicy(input);
        if (input.fileName && !input.fileName.toLowerCase().endsWith(".csv")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "CSV 파일만 업로드할 수 있습니다." });
        }
        const headers = Object.keys(input.rows[0] || {});
        const forbiddenCols = detectForbiddenColumns(headers);
        if (forbiddenCols.length > 0) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ reason: "forbidden_columns", forbiddenColumns: forbiddenCols, fileName: "preview" }));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `금지된 컬럼이 포함되어 있습니다: ${forbiddenCols.join(", ")}. 민감정보(주민번호, 증권번호 등)는 업로드할 수 없습니다.`,
          });
        }

        const existingPhones = await getAllActiveCustomerPhones();
        const filePhones = new Set<string>();

        const validationResults: BulkImportValidationResult[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = normalizeBulkImportRow(input.rows[i]);
          const result = await validateBulkImportRow(row, i, existingPhones, filePhones);
          validationResults.push(result);
        }

        const successCount = validationResults.filter((r) => r.isValid).length;
        const errorCount = validationResults.filter((r) => !r.isValid).length;

        await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_PREVIEWED", "customer", undefined,
          JSON.stringify({ totalRows: input.rows.length, successRows: successCount, failedRows: errorCount }));

        return {
          totalRows: input.rows.length,
          successRows: successCount,
          failedRows: errorCount,
          validationResults,
        };
      }),

    bulkImport: branchAdminProcedure
      .input(z.object({
        rows: z.array(z.record(z.string(), z.any())).max(5000),
        fileName: z.string().optional(),
        fileSize: z.number().nonnegative().optional(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const importBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        try {
          verifyBulkImportFilePolicy(input);
        } catch (error) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ importBatchId, reason: "file_policy_rejected", fileName: input.fileName, fileSize: input.fileSize, mimeType: input.mimeType }));
          throw error;
        }
        if (input.fileName && !input.fileName.toLowerCase().endsWith(".csv")) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ importBatchId, reason: "unsupported_extension", fileName: input.fileName }));
          throw new TRPCError({ code: "BAD_REQUEST", message: "CSV 파일만 업로드할 수 있습니다." });
        }

        const headers = Object.keys(input.rows[0] || {});
        const forbiddenCols = detectForbiddenColumns(headers);
        if (forbiddenCols.length > 0) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ importBatchId, reason: "forbidden_columns", forbiddenColumns: forbiddenCols, fileName: input.fileName }));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `금지된 컬럼이 포함되어 있습니다: ${forbiddenCols.join(", ")}`,
          });
        }

        const existingPhones = await getAllActiveCustomerPhones();
        const filePhones = new Set<string>();

        const validationResults: BulkImportValidationResult[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = normalizeBulkImportRow(input.rows[i]);
          const result = await validateBulkImportRow(row, i, existingPhones, filePhones);
          validationResults.push(result);
        }

        const validRows = validationResults.filter((r) => r.isValid);
        if (validRows.length === 0) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ importBatchId, reason: "no_valid_rows", totalRows: input.rows.length, fileName: input.fileName }));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "유효한 행이 없습니다. 모든 행에 오류가 있습니다.",
          });
        }

        const importedAt = new Date();
        const customersToCreate = validRows.map((result) => {
          const row = normalizeBulkImportRow(input.rows[result.rowIndex]);
          return {
            name: row.name!,
            phone: result.normalizedPhone ?? (row.phone ? normalizePhone(row.phone) : undefined),
            birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
            gender: (row.gender === "?" || row.gender === "male" ? "male" : row.gender === "?" || row.gender === "female" ? "female" : row.gender === "??" || row.gender === "other" ? "other" : undefined) as any,
            region: row.region,
            expectedPremium: row.expectedPremium ? parseInt(row.expectedPremium, 10) : undefined,
            availableTime: row.availableTime,
            source: row.source,
            consultStatus: row.consultStatus || "???",
            memo: row.memo,
            agentId: result.agentId,
            subBranchAdminId: result.subBranchAdminId,
            assignedTeamId: result.teamId,
            assignmentStatus: result.assignmentStatus as "unassigned" | "assigned_to_sub_branch" | "assigned_to_agent",
            createdBy: ctx.user.id,
            importBatchId,
            importedBy: ctx.user.id,
            importedAt,
          };
        });

        const errorCount = validationResults.filter((r) => !r.isValid).length;
        const duplicateCount = validationResults.filter((r) => r.errors.some((e) => e.includes("?? DB? ??"))).length;

        await runDbTransaction(async (tx) => {
          await createImportBatch({
            importBatchId,
            fileName: input.fileName,
            uploadedBy: ctx.user.id,
            totalRows: input.rows.length,
            successRows: validRows.length,
            failedRows: errorCount,
            duplicateRows: duplicateCount,
            blockedForbiddenColumn: false,
            status: "active",
          }, tx);
          await bulkCreateCustomers(customersToCreate, tx);
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORTED", "customer", undefined,
            JSON.stringify({
              importBatchId,
              fileName: input.fileName,
              uploadedBy: ctx.user.id,
              totalRows: input.rows.length,
              successRows: validRows.length,
              failedRows: errorCount,
              duplicateRows: duplicateCount,
              importedAt: importedAt.toISOString(),
            }), tx);
          await log(ctx.user.id, "DATA_IMPORT", "customers", undefined,
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
            }), tx);
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
      .input(z.object({
        search: z.string().optional(),
        phone: z.string().optional(),
        name: z.string().optional(),
        onlyActive: z.boolean().default(true).optional(),
      }).optional())
      .query(async ({ input }) => findDuplicateCustomerGroups(input ?? { onlyActive: true })),

    preview: branchAdminProcedure
      .input(z.object({ targetCustomerId: z.number(), sourceCustomerId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (input.targetCustomerId === input.sourceCustomerId) throw new TRPCError({ code: "BAD_REQUEST", message: "기준 고객과 병합 대상 고객이 같습니다." });
        const preview = await getCustomerMergePreview(input.targetCustomerId, input.sourceCustomerId);
        if (!preview) throw new TRPCError({ code: "NOT_FOUND", message: "고객을 찾을 수 없습니다." });
        if (preview.blockers.inactiveTarget || preview.blockers.inactiveSource || preview.blockers.alreadyMerged || preview.blockers.pendingDeleteRequests) {
          await log(ctx.user.id, "CUSTOMER_MERGE_BLOCKED", "customer", input.targetCustomerId, logDetails({
            actor: ctx.user.id,
            targetId: input.targetCustomerId,
            targetType: "customer",
            metadata: { sourceCustomerId: input.sourceCustomerId, blockers: preview.blockers },
          }));
          throw new TRPCError({ code: "BAD_REQUEST", message: "active 상태이며 pending 삭제 요청이 없는 고객만 병합할 수 있습니다." });
        }
        await log(ctx.user.id, "CUSTOMER_MERGE_PREVIEWED", "customer", input.targetCustomerId, logDetails({
          actor: ctx.user.id,
          targetId: input.targetCustomerId,
          targetType: "customer",
          metadata: { sourceCustomerId: input.sourceCustomerId, transferCounts: preview.transferCounts },
        }));
        return preview;
      }),

    execute: branchAdminProcedure
      .input(z.object({
        targetCustomerId: z.number(),
        sourceCustomerId: z.number(),
        confirmText: z.string(),
        reason: z.string().min(5).max(300).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== "고객병합") throw new TRPCError({ code: "BAD_REQUEST", message: "확인 문구가 일치하지 않습니다." });
        if (input.targetCustomerId === input.sourceCustomerId) throw new TRPCError({ code: "BAD_REQUEST", message: "기준 고객과 병합 대상 고객이 같습니다." });
        const preview = await getCustomerMergePreview(input.targetCustomerId, input.sourceCustomerId);
        if (!preview) throw new TRPCError({ code: "NOT_FOUND", message: "고객을 찾을 수 없습니다." });
        if (preview.blockers.inactiveTarget || preview.blockers.inactiveSource || preview.blockers.alreadyMerged || preview.blockers.pendingDeleteRequests) {
          await log(ctx.user.id, "CUSTOMER_MERGE_BLOCKED", "customer", input.targetCustomerId, logDetails({
            actor: ctx.user.id,
            targetId: input.targetCustomerId,
            targetType: "customer",
            metadata: { sourceCustomerId: input.sourceCustomerId, blockers: preview.blockers },
          }));
          throw new TRPCError({ code: "BAD_REQUEST", message: "active 상태이며 pending 삭제 요청이 없는 고객만 병합할 수 있습니다." });
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
      .query(async ({ ctx, input }) => getConsultationChecklistTemplates(ctx.user.role === "branch_admin" && input?.includeInactive === true)),

    createChecklist: branchAdminProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        phase: z.enum(CHECKLIST_PHASES),
        category: z.enum(CHECKLIST_CATEGORIES).default("basic"),
        sortOrder: z.number().int().default(0),
        isRequired: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const created = await createConsultationChecklistTemplate({ ...input, createdBy: ctx.user.id, isActive: true });
        await log(ctx.user.id, "CONSULTATION_CHECKLIST_TEMPLATE_CREATED", "consultation_checklist", created?.id, logDetails({ actor: ctx.user.id, targetType: "consultation_checklist", targetId: created?.id, afterValue: input }));
        return created;
      }),

    updateChecklist: branchAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).nullable().optional(),
        phase: z.enum(CHECKLIST_PHASES).optional(),
        category: z.enum(CHECKLIST_CATEGORIES).optional(),
        sortOrder: z.number().int().optional(),
        isRequired: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getConsultationChecklistTemplateById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const { id, ...changes } = input;
        await updateConsultationChecklistTemplate(id, { ...changes, updatedBy: ctx.user.id, deletedAt: input.isActive === false ? new Date() : input.isActive === true ? null : undefined });
        await log(ctx.user.id, input.isActive === false ? "CONSULTATION_CHECKLIST_TEMPLATE_DEACTIVATED" : input.isActive === true ? "CONSULTATION_CHECKLIST_TEMPLATE_REACTIVATED" : "CONSULTATION_CHECKLIST_TEMPLATE_UPDATED", "consultation_checklist", id, logDetails({ actor: ctx.user.id, targetType: "consultation_checklist", targetId: id, beforeValue: { title: existing.title, isActive: existing.isActive }, afterValue: changes }));
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
        await log(ctx.user.id, "CONSULTATION_CHECKLIST_DEFAULTS_SEEDED", "consultation_checklist", undefined, logDetails({ actor: ctx.user.id, targetType: "consultation_checklist", metadata: result }));
      }
      return result;
    }),

    updateCheckResult: activeUserProcedure
      .input(z.object({
        customerId: z.number(),
        checklistId: z.number(),
        consultationId: z.number().nullable().optional(),
        checked: z.boolean(),
        memo: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "비활성 고객에는 체크리스트를 저장할 수 없습니다." });
        const template = await getConsultationChecklistTemplateById(input.checklistId);
        if (!template || !template.isActive || template.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
        const saved = await upsertConsultationCheckResult({
          customerId: input.customerId,
          checklistId: input.checklistId,
          consultationId: input.consultationId ?? null,
          checked: input.checked,
          checkedAt: input.checked ? new Date() : null,
          checkedBy: input.checked ? ctx.user.id : null,
          memo: input.memo ?? null,
        });
        await log(ctx.user.id, "CONSULTATION_CHECKLIST_RESULT_UPDATED", "customer", input.customerId, logDetails({ actor: ctx.user.id, targetType: "customer", targetId: input.customerId, metadata: { checklistId: input.checklistId, checked: input.checked } }));
        return saved;
      }),

    listMessageTemplates: activeUserProcedure
      .input(z.object({ includeInactive: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => getMessageTemplates(ctx.user.role === "branch_admin" && input?.includeInactive === true)),

    seedDefaultMessageTemplates: branchAdminProcedure.mutation(async ({ ctx }) => {
      const result = await ensureDefaultMessageTemplates(ctx.user.id);
      if (result.createdCount > 0 || result.reactivatedCount > 0) {
        await log(ctx.user.id, "MESSAGE_TEMPLATE_DEFAULTS_SEEDED", "message_template", undefined, logDetails({ actor: ctx.user.id, targetType: "message_template", metadata: result }));
      }
      return result;
    }),

    createMessageTemplate: branchAdminProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        situation: z.enum(TEMPLATE_SITUATIONS),
        channel: z.enum(TEMPLATE_CHANNELS),
        body: z.string().min(1).max(2000),
        complianceNote: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        validateMessageTemplateBody(input.body);
        const created = await createMessageTemplate({ ...input, createdBy: ctx.user.id, isActive: true });
        await log(ctx.user.id, "MESSAGE_TEMPLATE_CREATED", "message_template", created?.id, logDetails({ actor: ctx.user.id, targetType: "message_template", targetId: created?.id, afterValue: { title: input.title, situation: input.situation, channel: input.channel } }));
        return created;
      }),

    updateMessageTemplate: branchAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        situation: z.enum(TEMPLATE_SITUATIONS).optional(),
        channel: z.enum(TEMPLATE_CHANNELS).optional(),
        body: z.string().min(1).max(2000).optional(),
        complianceNote: z.string().max(1000).nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getMessageTemplateById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.body) validateMessageTemplateBody(input.body);
        const { id, ...changes } = input;
        await updateMessageTemplate(id, { ...changes, updatedBy: ctx.user.id, deletedAt: input.isActive === false ? new Date() : input.isActive === true ? null : undefined });
        await log(ctx.user.id, input.isActive === false ? "MESSAGE_TEMPLATE_DEACTIVATED" : input.isActive === true ? "MESSAGE_TEMPLATE_REACTIVATED" : "MESSAGE_TEMPLATE_UPDATED", "message_template", id, logDetails({ actor: ctx.user.id, targetType: "message_template", targetId: id, beforeValue: { title: existing.title, situation: existing.situation, channel: existing.channel, isActive: existing.isActive }, afterValue: { ...changes, body: changes.body ? "[redacted]" : undefined } }));
        return { success: true };
      }),

    renderMessageTemplate: activeUserProcedure
      .input(z.object({
        templateId: z.number(),
        customerId: z.number(),
        nextContactDate: z.string().max(100).optional(),
        consultationTopic: z.string().max(100).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        const template = await getMessageTemplateById(input.templateId);
        if (!template || !template.isActive || template.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
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
      .input(z.object({ templateId: z.number(), customerId: z.number(), channel: z.enum(TEMPLATE_CHANNELS) }))
      .mutation(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const template = await getMessageTemplateById(input.templateId);
        if (!template || !template.isActive || template.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
        await log(ctx.user.id, "MESSAGE_TEMPLATE_COPIED", "customer", input.customerId, logDetails({ actor: ctx.user.id, targetType: "customer", targetId: input.customerId, metadata: { templateId: input.templateId, situation: template.situation, channel: input.channel } }));
        return { success: true };
      }),
  }),

  customerHandoffNotes: router({
    listByCustomer: activeUserProcedure
      .input(z.object({ customerId: z.number(), includeInactive: z.boolean().optional() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        return getCustomerHandoffNotes(input.customerId, input.includeInactive === true);
      }),

    create: activeUserProcedure
      .input(z.object({
        customerId: z.number(),
        noteType: z.enum(HANDOFF_NOTE_TYPES).default("handoff"),
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "비활성 고객에는 인수인계 메모를 작성할 수 없습니다." });
        validateHandoffNoteBody(input.body);
        const created = await createCustomerHandoffNote({ ...input, visibility: "internal", createdBy: ctx.user.id, isActive: true });
        await log(ctx.user.id, "CUSTOMER_HANDOFF_NOTE_CREATED", "customer", input.customerId, logDetails({ actor: ctx.user.id, targetType: "customer", targetId: input.customerId, metadata: { noteId: created?.id, noteType: input.noteType, title: input.title } }));
        return created;
      }),

    update: activeUserProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        body: z.string().min(1).max(2000).optional(),
        noteType: z.enum(HANDOFF_NOTE_TYPES).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getCustomerHandoffNoteById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, existing.customerId);
        if (input.body) validateHandoffNoteBody(input.body);
        const { id, ...changes } = input;
        await updateCustomerHandoffNote(id, { ...changes, updatedBy: ctx.user.id, deletedAt: input.isActive === false ? new Date() : input.isActive === true ? null : undefined });
        await log(ctx.user.id, input.isActive === false ? "CUSTOMER_HANDOFF_NOTE_DEACTIVATED" : input.isActive === true ? "CUSTOMER_HANDOFF_NOTE_REACTIVATED" : "CUSTOMER_HANDOFF_NOTE_UPDATED", "customer", existing.customerId, logDetails({ actor: ctx.user.id, targetType: "customer", targetId: existing.customerId, metadata: { noteId: id, noteType: input.noteType ?? existing.noteType, title: input.title ?? existing.title } }));
        return { success: true };
      }),
  }),

  consultationScripts: router({
    list: activeUserProcedure
      .input(z.object({ includeInactive: z.boolean().optional(), category: z.enum(SCRIPT_CATEGORIES).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const rows = await getConsultationScripts(ctx.user.role === "branch_admin" && input?.includeInactive === true);
        return input?.category ? rows.filter((row) => row.category === input.category) : rows;
      }),

    seedDefaults: branchAdminProcedure.mutation(async ({ ctx }) => {
      const result = await ensureDefaultConsultationScripts(ctx.user.id);
      if (result.createdCount > 0) {
        await log(ctx.user.id, "CONSULTATION_SCRIPT_DEFAULTS_SEEDED", "consultation_script", undefined, logDetails({ actor: ctx.user.id, targetType: "consultation_script", metadata: { createdCount: result.createdCount } }));
      }
      return result;
    }),

    create: branchAdminProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        category: z.enum(SCRIPT_CATEGORIES),
        scriptBody: z.string().min(1).max(3000),
        complianceNote: z.string().max(1000).optional(),
        tags: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        validateScriptBody(input.scriptBody);
        const created = await createConsultationScript({ ...input, createdBy: ctx.user.id, isActive: true });
        await log(ctx.user.id, "CONSULTATION_SCRIPT_CREATED", "consultation_script", created?.id, logDetails({ actor: ctx.user.id, targetType: "consultation_script", targetId: created?.id, afterValue: { title: input.title, category: input.category } }));
        return created;
      }),

    update: branchAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        category: z.enum(SCRIPT_CATEGORIES).optional(),
        scriptBody: z.string().min(1).max(3000).optional(),
        complianceNote: z.string().max(1000).nullable().optional(),
        tags: z.string().max(500).nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getConsultationScriptById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.scriptBody) validateScriptBody(input.scriptBody);
        const { id, ...changes } = input;
        await updateConsultationScript(id, { ...changes, updatedBy: ctx.user.id, deletedAt: input.isActive === false ? new Date() : input.isActive === true ? null : undefined });
        await log(ctx.user.id, input.isActive === false ? "CONSULTATION_SCRIPT_DEACTIVATED" : input.isActive === true ? "CONSULTATION_SCRIPT_REACTIVATED" : "CONSULTATION_SCRIPT_UPDATED", "consultation_script", id, logDetails({ actor: ctx.user.id, targetType: "consultation_script", targetId: id, beforeValue: { title: existing.title, category: existing.category, isActive: existing.isActive }, afterValue: { ...changes, scriptBody: changes.scriptBody ? "[redacted]" : undefined } }));
        return { success: true };
      }),

    render: activeUserProcedure
      .input(z.object({ scriptId: z.number(), customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const script = await getConsultationScriptById(input.scriptId);
        if (!script || !script.isActive || script.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
        return script;
      }),

    logCopy: activeUserProcedure
      .input(z.object({ scriptId: z.number(), customerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.customerId);
        const script = await getConsultationScriptById(input.scriptId);
        if (!script || !script.isActive || script.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
        await log(ctx.user.id, "CONSULTATION_SCRIPT_COPIED", "customer", input.customerId, logDetails({ actor: ctx.user.id, targetType: "customer", targetId: input.customerId, metadata: { scriptId: input.scriptId, category: script.category } }));
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
      .input(z.object({
        customerId: z.number(),
        status: z.enum(["미상담","부재","통화완료","상담예정","설계중","계약","보류","거절","해지관리","재상담필요"]),
        consultationType: z.enum(CONSULTATION_TYPES).optional(),
        customerNeed: z.enum(CUSTOMER_NEEDS).optional(),
        nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
        summary: z.string().max(200).optional(),
        content: z.string().max(2000).optional(),
        nextContactAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "비활성 고객에는 상담기록을 등록할 수 없습니다." });
        if (input.status !== customer.consultStatus) {
          await createStatusHistory({ customerId: input.customerId, changedBy: ctx.user.id, previousStatus: customer.consultStatus, newStatus: input.status });
        }
        const nextContactDate = input.nextContactAt ? new Date(input.nextContactAt) : undefined;
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
          await updateCustomer(input.customerId, { nextAction: input.nextAction });
          await log(ctx.user.id, "CUSTOMER_NEXT_ACTION_UPDATED", "customer", input.customerId, logDetails({
            actor: ctx.user.id,
            targetId: input.customerId,
            targetType: "customer",
            beforeValue: { nextAction: customer.nextAction ?? null },
            afterValue: { nextAction: input.nextAction },
          }));
        }
        if (nextContactDate) await createReconsultReminder(input.customerId, ctx.user.id, nextContactDate, customer.name);
        if (customer.agentId) await refreshLongUnmanagedReminder(input.customerId, customer.agentId, new Date(), customer.name);
        await log(ctx.user.id, "CONSULTATION_CREATED", "customer", input.customerId, logDetails({
          actor: ctx.user.id,
          targetId: input.customerId,
          targetType: "customer",
          afterValue: {
            status: input.status,
            consultationType: input.consultationType ?? null,
            customerNeed: input.customerNeed ?? null,
            nextAction: input.nextAction ?? null,
            summary: input.summary ?? null,
          },
        }));
        return { success: true };
      }),

    update: activeUserProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["미상담","부재","통화완료","상담예정","설계중","계약","보류","거절","해지관리","재상담필요"]).optional(),
        consultationType: z.enum(CONSULTATION_TYPES).optional(),
        customerNeed: z.enum(CUSTOMER_NEEDS).optional(),
        nextAction: z.enum(CUSTOMER_NEXT_ACTIONS).optional(),
        summary: z.string().max(200).optional(),
        content: z.string().max(2000).optional(),
        nextContactAt: z.string().optional().nullable(),
      }))
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
        if (input.consultationType !== undefined) afterSnapshot.consultationType = input.consultationType;
        if (input.customerNeed !== undefined) afterSnapshot.customerNeed = input.customerNeed;
        if (input.nextAction !== undefined) afterSnapshot.nextAction = input.nextAction;
        if (input.summary !== undefined) afterSnapshot.summary = input.summary;
        if (input.nextContactAt !== undefined) afterSnapshot.nextContactAt = input.nextContactAt;

        await updateConsultation(input.id, {
          status: input.status,
          consultationType: input.consultationType,
          customerNeed: input.customerNeed,
          nextAction: input.nextAction,
          summary: input.summary,
          content: input.content,
          nextContactAt: input.nextContactAt === null ? null : input.nextContactAt ? new Date(input.nextContactAt) : undefined,
        });

        if (input.status && input.status !== existing.status) {
          await createStatusHistory({ customerId: existing.customerId, changedBy: ctx.user.id, previousStatus: existing.status, newStatus: input.status });
        }
        if (input.nextContactAt) {
          const customer = await getCustomerById(existing.customerId);
          if (customer) await createReconsultReminder(existing.customerId, existing.agentId, new Date(input.nextContactAt), customer.name);
        }
        await log(ctx.user.id, "CONSULTATION_UPDATED", "consultation", input.id, JSON.stringify({ before: beforeSnapshot, after: afterSnapshot }));
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
        throw new TRPCError({ code: "FORBIDDEN", message: "전체 계약은 지점장만 조회할 수 있습니다." });
      }
      if (user.role === "branch_admin") return getAllContracts(input?.scope === "mine" ? { agentId: user.id } : {});
      if (user.role === "sub_branch_admin") return getAllContracts({ subBranchAdminId: user.id });
      if (user.role === "team_leader") {
        if (user.teamId === null) return [];
        return getAllContracts({ teamId: user.teamId });
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
      .input(z.object({
        customerId: z.number(),
        company: z.string().optional(),
        productName: z.string().optional(),
        productGroup: z.string().optional(),
        contractDate: z.string().optional(),
        monthlyPremium: z.number().optional(),
        paymentStatus: z.enum(["정상","미납","실효","해지"]).default("정상"),
        contractStatus: z.enum(["청약","성립","철회","유지","해지"]).default("청약"),
        memo: z.string().optional(),
        agentIdOverride: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const customer = await verifyCustomerAccess(user, input.customerId);

        if (!input.agentIdOverride && !customer.agentId && user.role !== "member") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "계약 담당 설계사를 선택해야 합니다. 지점장/부지점장은 계약 담당자로 지정될 수 없습니다.",
          });
        }
        const finalAgentId = input.agentIdOverride ?? customer.agentId ?? user.id;
        const finalAgent = await verifyAgentTarget(user, finalAgentId);

        const { contractDate, agentIdOverride, ...rest } = input;
        const contractDateObj = contractDate ? new Date(contractDate) : undefined;
        await createContract({ ...rest, agentId: finalAgentId, contractDate: contractDateObj, createdBy: ctx.user.id });
        const allContracts = await getContractsByCustomer(input.customerId);
        const newContract = allContracts[0];
        await log(ctx.user.id, "CONTRACT_CREATED", "contract", newContract?.id,
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
          }));

        if (contractDateObj) {
          if (newContract) await createContractReminders(newContract.id, finalAgentId, contractDateObj, customer.name);
        }
        return { success: true };
      }),

    update: activeUserProcedure
      .input(z.object({
        id: z.number(),
        company: z.string().optional(),
        productName: z.string().optional(),
        productGroup: z.string().optional(),
        contractDate: z.string().optional(),
        monthlyPremium: z.number().optional(),
        paymentStatus: z.enum(["정상","미납","실효","해지"]).optional(),
        contractStatus: z.enum(["청약","성립","철회","유지","해지"]).optional(),
        memo: z.string().optional(),
        newAgentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, contractDate, paymentStatus, newAgentId, ...rest } = input;
        const existing = await getContractById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, existing.customerId);

        let verifiedNewAgent: Awaited<ReturnType<typeof verifyAgentTarget>> | undefined;
        if (newAgentId !== undefined) {
          verifiedNewAgent = await verifyAgentTarget(ctx.user, newAgentId);
        }

        // contract_history 기록
        const fieldsToCheck: (keyof typeof rest)[] = ["company", "productName", "productGroup", "monthlyPremium", "contractStatus", "memo"];
        for (const field of fieldsToCheck) {
          if (rest[field] !== undefined && String((existing as any)[field] ?? "") !== String(rest[field] ?? "")) {
            await createContractHistoryEntry({ contractId: id, changedBy: ctx.user.id, fieldName: field, beforeValue: String((existing as any)[field] ?? ""), afterValue: String(rest[field] ?? "") });
          }
        }
        if (paymentStatus && paymentStatus !== existing.paymentStatus) {
          await createContractHistoryEntry({ contractId: id, changedBy: ctx.user.id, fieldName: "paymentStatus", beforeValue: existing.paymentStatus ?? "", afterValue: paymentStatus });
        }
        if (newAgentId && newAgentId !== existing.agentId) {
          await createContractHistoryEntry({ contractId: id, changedBy: ctx.user.id, fieldName: "agentId", beforeValue: String(existing.agentId), afterValue: String(newAgentId) });
          await log(ctx.user.id, "CONTRACT_OWNER_CHANGED", "contract", id,
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
            }));
        }

        await updateContract(id, { ...rest, paymentStatus, agentId: newAgentId ?? existing.agentId, contractDate: contractDate ? new Date(contractDate) : undefined });
        await log(ctx.user.id, "CONTRACT_UPDATED", "contract", id,
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
          }));

        if (paymentStatus && existing && paymentStatus !== existing.paymentStatus) {
          const customer = existing.customerId ? await getCustomerById(existing.customerId) : null;
          if (customer) await createPaymentStatusReminder(id, newAgentId ?? existing.agentId, paymentStatus, customer.name);
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
        await log(ctx.user.id, "CONTRACT_DEACTIVATED", "contract", input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "contract",
            beforeValue: { isActive: existing.isActive, deletedAt: (existing as any).deletedAt ?? null, contractStatus: existing.contractStatus },
            afterValue: { isActive: false },
            metadata: { deleteMode: "soft" },
          }));
        return { success: true };
      }),
  }),

  // ── Schedules ─────────────────────────────────────────────────────────────
  deletedData: router({
    listTeams: branchAdminProcedure.query(async () => getDeletedTeams()),
    listCustomers: branchAdminProcedure.query(async () => getDeletedCustomers()),
    listContracts: branchAdminProcedure.query(async () => getDeletedContracts()),

    restoreTeam: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await requireSoftDeletedTeam(input.id);
        await runDbTransaction(async (tx) => {
          await restoreTeam(input.id, tx);
          await log(ctx.user.id, "TEAM_RESTORED", "team", input.id, logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "team",
            beforeValue: { isActive: existing.isActive, deletedAt: (existing as any).deletedAt ?? null },
            afterValue: { isActive: true, deletedAt: null },
          }), tx);
        });
        return { success: true };
      }),

    restoreCustomer: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await requireSoftDeletedCustomer(input.id);
        if (existing.phone) {
          const dup = await checkPhoneDuplicate(existing.phone, input.id);
          if (dup) throw new TRPCError({ code: "CONFLICT", message: "동일 연락처의 활성 고객이 있어 복구할 수 없습니다." });
        }
        await runDbTransaction(async (tx) => {
          await restoreCustomer(input.id, tx);
          await log(ctx.user.id, "CUSTOMER_RESTORED", "customer", input.id, logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "customer",
            beforeValue: { isActive: existing.isActive, deletedAt: (existing as any).deletedAt ?? null },
            afterValue: { isActive: true, deletedAt: null },
          }), tx);
        });
        return { success: true };
      }),

    restoreContract: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await requireSoftDeletedContract(input.id);
        const customer = await getCustomerById(existing.customerId);
        if (!customer || !customer.isActive || (customer as any).deletedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "연결 고객이 비활성 상태라 계약을 복구할 수 없습니다." });
        }
        await runDbTransaction(async (tx) => {
          await restoreContract(input.id, tx);
          await createContractHistoryEntry({ contractId: input.id, changedBy: ctx.user.id, fieldName: "isActive", beforeValue: String(existing.isActive), afterValue: "true" }, tx);
          await log(ctx.user.id, "CONTRACT_RESTORED", "contract", input.id, logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "contract",
            beforeValue: { isActive: existing.isActive, deletedAt: (existing as any).deletedAt ?? null },
            afterValue: { isActive: true, deletedAt: null },
          }), tx);
        });
        return { success: true };
      }),

    permanentDeleteTeam: branchAdminProcedure
      .input(z.object({ id: z.number(), confirmText: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== PERMANENT_DELETE_CONFIRM_TEXT) throw new TRPCError({ code: "BAD_REQUEST", message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE });
        const existing = await requireSoftDeletedTeam(input.id);
        const blockers = await getTeamPermanentDeleteBlockers(input.id);
        const hasBlockers = Object.values(blockers).some((count) => count > 0);
        if (hasBlockers) {
          await log(ctx.user.id, "PERMANENT_DELETE_BLOCKED", "team", input.id, logDetails({ actor: ctx.user.id, targetId: input.id, targetType: "team", metadata: { reason: "linked_operational_history_exists", blockers } }));
          throw new TRPCError({ code: "BAD_REQUEST", message: TEAM_PERMANENT_DELETE_BLOCKED_MESSAGE });
        }
        await runDbTransaction(async (tx) => {
          await log(ctx.user.id, "TEAM_PERMANENTLY_DELETED", "team", input.id, logDetails({ actor: ctx.user.id, targetId: input.id, targetType: "team", beforeValue: { id: existing.id, isActive: existing.isActive } }), tx);
          await permanentlyDeleteTeam(input.id, tx);
        });
        return { success: true };
      }),

    permanentDeleteCustomer: branchAdminProcedure
      .input(z.object({ id: z.number(), confirmText: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== PERMANENT_DELETE_CONFIRM_TEXT) throw new TRPCError({ code: "BAD_REQUEST", message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE });
        const existing = await requireSoftDeletedCustomer(input.id);
        const blockers = await getCustomerPermanentDeleteBlockers(input.id);
        const hasBlockers = Object.values(blockers).some((count) => count > 0);
        if (hasBlockers) {
          await log(ctx.user.id, "PERMANENT_DELETE_BLOCKED", "customer", input.id, logDetails({ actor: ctx.user.id, targetId: input.id, targetType: "customer", metadata: { reason: "linked_operational_history_exists", blockers } }));
          throw new TRPCError({ code: "BAD_REQUEST", message: CUSTOMER_PERMANENT_DELETE_BLOCKED_MESSAGE });
        }
        await runDbTransaction(async (tx) => {
          await log(ctx.user.id, "CUSTOMER_PERMANENTLY_DELETED", "customer", input.id, logDetails({ actor: ctx.user.id, targetId: input.id, targetType: "customer", beforeValue: { id: existing.id, isActive: existing.isActive } }), tx);
          await permanentlyDeleteCustomer(input.id, tx);
        });
        return { success: true };
      }),

    permanentDeleteContract: branchAdminProcedure
      .input(z.object({ id: z.number(), confirmText: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== PERMANENT_DELETE_CONFIRM_TEXT) throw new TRPCError({ code: "BAD_REQUEST", message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE });
        const existing = await requireSoftDeletedContract(input.id);
        const blockers = await getContractPermanentDeleteBlockers(input.id);
        const hasBlockers = Object.values(blockers).some((count) => count > 0);
        if (hasBlockers) {
          await log(ctx.user.id, "PERMANENT_DELETE_BLOCKED", "contract", input.id, logDetails({ actor: ctx.user.id, targetId: input.id, targetType: "contract", metadata: { reason: "linked_operational_history_exists", blockers } }));
          throw new TRPCError({ code: "BAD_REQUEST", message: CONTRACT_PERMANENT_DELETE_BLOCKED_MESSAGE });
        }
        await runDbTransaction(async (tx) => {
          await log(ctx.user.id, "CONTRACT_PERMANENTLY_DELETED", "contract", input.id, logDetails({ actor: ctx.user.id, targetId: input.id, targetType: "contract", beforeValue: { id: existing.id, isActive: existing.isActive } }), tx);
          await permanentlyDeleteContract(input.id, tx);
        });
        return { success: true };
      }),
  }),

  deleteRequests: router({
    createContractDeleteRequest: activeUserProcedure
      .input(z.object({ contractId: z.number(), requestReason: z.string().min(1), requestMemo: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const contract = await verifyContractDeleteRequestAccess(ctx.user, input.contractId);
        const existingPending = await getPendingDeleteRequestForTarget("contract", input.contractId);
        if (existingPending) throw new TRPCError({ code: "CONFLICT", message: "이미 처리 대기 중인 삭제 요청이 있습니다." });
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
        await log(ctx.user.id, "DELETE_REQUEST_CREATED", "delete_request", input.contractId, logDetails({
          actor: ctx.user.id,
          targetId: input.contractId,
          targetType: "contract",
          metadata: { requestType: "contract_delete", expectedImpact: "performance_exclusion", reason: input.requestReason },
        }));
        return { success: true };
      }),

    listMyRequests: activeUserProcedure.query(async ({ ctx }) => {
      const requests = await getDeleteRequests({ requestedBy: ctx.user.id });
      return Promise.all(requests.map(buildDeleteRequestView));
    }),

    listAllRequestsForAdmin: branchAdminProcedure
      .input(z.object({ status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional() }).optional())
      .query(async ({ input }) => {
        const requests = await getDeleteRequests({ status: input?.status });
        return Promise.all(requests.map(buildDeleteRequestView));
      }),

    approve: branchAdminProcedure
      .input(z.object({ id: z.number(), reviewComment: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const request = await getDeleteRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "pending 상태의 요청만 승인할 수 있습니다." });
        const contract = await getContractById(request.targetId);
        if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
        if (!contract.isActive || (contract as any).deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 비활성 처리된 계약입니다." });
        await runDbTransaction(async (tx) => {
          await deactivateContractWithClient(contract.id, tx);
          await createContractHistoryEntry({ contractId: contract.id, changedBy: ctx.user.id, fieldName: "isActive", beforeValue: String(contract.isActive), afterValue: "false" }, tx);
          await updateDeleteRequest(input.id, { status: "approved", reviewedBy: ctx.user.id, reviewedAt: new Date(), reviewComment: input.reviewComment }, tx);
          await log(ctx.user.id, "DELETE_REQUEST_APPROVED", "delete_request", input.id, logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "delete_request",
            beforeValue: { status: request.status },
            afterValue: { status: "approved", reviewedBy: ctx.user.id },
            metadata: { contractId: contract.id, expectedImpact: request.expectedImpact },
          }), tx);
          await log(ctx.user.id, "CONTRACT_DEACTIVATED_BY_REQUEST", "contract", contract.id, logDetails({
            actor: ctx.user.id,
            targetId: contract.id,
            targetType: "contract",
            beforeValue: { isActive: contract.isActive, deletedAt: (contract as any).deletedAt ?? null },
            afterValue: { isActive: false },
            metadata: { deleteRequestId: input.id, expectedImpact: "performance_exclusion" },
          }), tx);
        });
        return { success: true };
      }),

    reject: branchAdminProcedure
      .input(z.object({ id: z.number(), reviewComment: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const request = await getDeleteRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "pending 상태의 요청만 반려할 수 있습니다." });
        await updateDeleteRequest(input.id, { status: "rejected", reviewedBy: ctx.user.id, reviewedAt: new Date(), reviewComment: input.reviewComment });
        await log(ctx.user.id, "DELETE_REQUEST_REJECTED", "delete_request", input.id, logDetails({
          actor: ctx.user.id,
          targetId: input.id,
          targetType: "delete_request",
          beforeValue: { status: request.status },
          afterValue: { status: "rejected", reviewedBy: ctx.user.id },
          metadata: { contractId: request.targetId },
        }));
        return { success: true };
      }),

    cancelMyRequest: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const request = await getDeleteRequestById(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND" });
        if (request.requestedBy !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "pending 상태의 요청만 취소할 수 있습니다." });
        await updateDeleteRequest(input.id, { status: "cancelled" });
        await log(ctx.user.id, "DELETE_REQUEST_CANCELLED", "delete_request", input.id, logDetails({
          actor: ctx.user.id,
          targetId: input.id,
          targetType: "delete_request",
          beforeValue: { status: request.status },
          afterValue: { status: "cancelled" },
          metadata: { contractId: request.targetId },
        }));
        return { success: true };
      }),
  }),

  imports: router({
    listBatches: branchAdminProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        status: z.enum(["active", "cancelled", "partially_cancelled", "failed"]).optional(),
        uploadedBy: z.number().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const batches = await listImportBatches({
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
          status: input?.status,
          uploadedBy: input?.uploadedBy,
          search: input?.search,
        });
        return Promise.all(batches.map(async (batch) => {
          const customersInBatch = await getCustomersByImportBatch(batch.importBatchId);
          const activeCustomerCount = customersInBatch.filter((c) => c.isActive && !(c as any).deletedAt).length;
          const cancelledCustomerCount = customersInBatch.filter((c) => !c.isActive || (c as any).deletedAt).length;
          const uploader = await getUserById(batch.uploadedBy);
          return { ...batch, uploader: uploader ? { id: uploader.id, name: uploader.name, role: uploader.role } : null, activeCustomerCount, cancelledCustomerCount };
        }));
      }),

    getBatchDetail: branchAdminProcedure
      .input(z.object({ importBatchId: z.string() }))
      .query(async ({ input, ctx }) => {
        const batch = await getImportBatchByBatchId(input.importBatchId);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
        const customersInBatch = await getCustomersByImportBatch(input.importBatchId);
        const blockers = await getImportBatchCancelBlockers(input.importBatchId);
        const uploader = await getUserById(batch.uploadedBy);
        const customersWithSummary = await Promise.all(customersInBatch.map(async (customer) => {
          const agent = customer.agentId ? await getUserById(customer.agentId) : undefined;
          return {
            id: customer.id,
            name: customer.name,
            maskedPhone: customer.phone ? maskPhone(customer.phone) : null,
            consultStatus: customer.consultStatus,
            agent: agent ? { id: agent.id, name: agent.name } : null,
            assignmentStatus: customer.assignmentStatus,
            createdAt: customer.createdAt,
            status: customer.isActive && !(customer as any).deletedAt ? "active" : "inactive",
            hasLinkedData: blockers.blockedCustomerIds.includes(customer.id),
          };
        }));
        await log(ctx.user.id, "IMPORT_BATCH_VIEWED", "import_batch", batch.id, logDetails({
          actor: ctx.user.id,
          targetId: batch.id,
          targetType: "import_batch",
          metadata: {
            importBatchId: input.importBatchId,
            customerCount: customersInBatch.length,
            blockedCustomerCount: blockers.blockedCustomerIds.length,
          },
        }));
        return { batch: { ...batch, uploader: uploader ? { id: uploader.id, name: uploader.name, role: uploader.role } : null }, customers: customersWithSummary, blockers };
      }),

    cancelBatch: branchAdminProcedure
      .input(z.object({ importBatchId: z.string(), confirmText: z.string(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.confirmText !== IMPORT_BATCH_CANCEL_CONFIRM_TEXT) throw new TRPCError({ code: "BAD_REQUEST", message: PERMANENT_DELETE_CONFIRM_MISMATCH_MESSAGE });
        const batch = await getImportBatchByBatchId(input.importBatchId);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
        if (batch.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: IMPORT_BATCH_ALREADY_CANCELLED_MESSAGE });
        const customersInBatch = await getCustomersByImportBatch(input.importBatchId);
        const activeCustomers = customersInBatch.filter((c) => c.isActive && !(c as any).deletedAt);
        if (activeCustomers.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: IMPORT_BATCH_NO_ACTIVE_CUSTOMERS_MESSAGE });
        const blockers = await getImportBatchCancelBlockers(input.importBatchId);
        if (blockers.blockedCustomerIds.length > 0) {
          await log(ctx.user.id, "IMPORT_BATCH_CANCEL_BLOCKED", "import_batch", batch.id, logDetails({ actor: ctx.user.id, targetId: batch.id, targetType: "import_batch", metadata: { importBatchId: input.importBatchId, blockedCustomerCount: blockers.blockedCustomerIds.length, relatedCounts: blockers } }));
          throw new TRPCError({ code: "BAD_REQUEST", message: IMPORT_BATCH_CANCEL_BLOCKED_MESSAGE });
        }
        await runDbTransaction(async (tx) => {
          await softDeleteCustomersByImportBatch(input.importBatchId, tx);
          await updateImportBatch(input.importBatchId, { status: "cancelled", cancelledBy: ctx.user.id, cancelledAt: new Date(), cancelReason: input.reason }, tx);
          await log(ctx.user.id, "IMPORT_BATCH_CANCELLED", "import_batch", batch.id, logDetails({ actor: ctx.user.id, targetId: batch.id, targetType: "import_batch", beforeValue: { status: batch.status, activeCustomerCount: activeCustomers.length }, afterValue: { status: "cancelled", activeCustomerCount: 0 }, metadata: { importBatchId: input.importBatchId, affectedCustomerCount: activeCustomers.length, reason: input.reason } }), tx);
          await log(ctx.user.id, "CUSTOMER_DEACTIVATED_BY_BATCH_CANCELLED", "customer", undefined, logDetails({ actor: ctx.user.id, targetType: "customer", afterValue: { isActive: false }, metadata: { importBatchId: input.importBatchId, affectedCustomerCount: activeCustomers.length } }), tx);
        });
        return { success: true, affectedCustomerCount: activeCustomers.length };
      }),
  }),

  schedules: router({
    list: activeUserProcedure.query(async ({ ctx }) => {
      return getAccessibleSchedules(ctx.user);
    }),

    create: activeUserProcedure
      .input(z.object({
        title: z.string().min(1),
        type: z.enum(["고객상담","재통화","계약예정","보장분석","해지방어","팀회의","교육","외근","휴무","기타"]),
        status: z.enum(["예정","완료","취소","변경","노쇼","보류"]).default("예정"),
        startTime: z.string(),
        endTime: z.string().optional(),
        memo: z.string().optional(),
        description: z.string().optional(),
        reminderDayBefore: z.boolean().default(true),
        reminderSameDay: z.boolean().default(true),
        reminderOneHourBefore: z.boolean().default(true),
        targetUserId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        let targetUserId = user.id;
        if (input.targetUserId) {
          await verifyTargetUserAccess(user, input.targetUserId);
          targetUserId = input.targetUserId;
        }
        const startTimeDate = new Date(input.startTime);
        const endTimeDate = input.endTime ? new Date(input.endTime) : undefined;

        await createSchedule({ userId: targetUserId, title: input.title, type: input.type, status: input.status, startTime: startTimeDate, endTime: endTimeDate, memo: input.memo, description: input.description, reminderDayBefore: input.reminderDayBefore, reminderSameDay: input.reminderSameDay, reminderOneHourBefore: input.reminderOneHourBefore, createdBy: ctx.user.id });
        await log(ctx.user.id, "SCHEDULE_CREATED", "schedule", undefined, `title=${input.title}`);

        const allSchedules = await getSchedules({ userId: targetUserId });
        const newSchedule = allSchedules.find((s) => s.title === input.title && s.startTime.getTime() === startTimeDate.getTime());
        if (newSchedule) {
          await createScheduleReminders(newSchedule.id, targetUserId, startTimeDate, input.title, input.reminderDayBefore, input.reminderSameDay, input.reminderOneHourBefore);
          if (endTimeDate) await createScheduleIncompleteReminder(newSchedule.id, targetUserId, endTimeDate, input.title);
        }
        return { success: true };
      }),

    update: activeUserProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        type: z.enum(["고객상담","재통화","계약예정","보장분석","해지방어","팀회의","교육","외근","휴무","기타"]).optional(),
        status: z.enum(["예정","완료","취소","변경","노쇼","보류"]).optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        memo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, startTime, endTime, status, ...rest } = input;
        const user = ctx.user;

        // 역할별 범위 조회로 소유권 검증 (조건 3 수정)
        const allSchedulesList = await getAccessibleSchedules(user);

        const existing = allSchedulesList.find((s) => s.id === id);
        if (!existing) throw new TRPCError({ code: "FORBIDDEN", message: "해당 일정에 접근 권한이 없습니다." });

        const actionLabel = status === "취소" ? "SCHEDULE_CANCELLED" : status === "완료" ? "SCHEDULE_COMPLETED" : "SCHEDULE_UPDATED";

        if (status === "완료") {
          await completeSchedule(id);
          await cancelScheduleIncompleteNotification(existing.userId, id);
        } else if (status === "취소" || status === "노쇼") {
          await updateSchedule(id, { status, startTime: startTime ? new Date(startTime) : undefined, endTime: endTime ? new Date(endTime) : undefined, ...rest });
          await cancelScheduleIncompleteNotification(existing.userId, id);
        } else {
          await updateSchedule(id, { status, startTime: startTime ? new Date(startTime) : undefined, endTime: endTime ? new Date(endTime) : undefined, ...rest });
        }
        await log(ctx.user.id, actionLabel, "schedule", id);
        return { success: true };
      }),

    delete: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const allSchedulesList = await getAccessibleSchedules(user);

        const existing = allSchedulesList.find((s) => s.id === input.id);
        if (!existing) throw new TRPCError({ code: "FORBIDDEN", message: "해당 일정에 접근 권한이 없습니다." });

        await softDeleteSchedule(input.id);
        await cancelScheduleIncompleteNotification(existing.userId, input.id);
        await log(ctx.user.id, "SCHEDULE_CANCELLED", "schedule", input.id);
        return { success: true };
      }),
  }),

  // ── Notifications ─────────────────────────────────────────────────────────
  followUps: router({
    create: activeUserProcedure
      .input(z.object({
        customerId: z.number(),
        nextContactDate: z.string(),
        reason: z.string().min(1),
        nextAction: z.enum(["전화", "카톡", "문자", "방문", "설계안 발송", "계약 확인", "보장분석", "사후관리", "기타"]).default("전화"),
        memo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (!customer.isActive || customer.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "비활성 고객에는 후속관리를 등록할 수 없습니다." });
        const nextContactDate = new Date(input.nextContactDate);
        if (Number.isNaN(nextContactDate.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "다음 연락일이 올바르지 않습니다." });
        await createFollowUp({
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
        await log(ctx.user.id, "FOLLOW_UP_CREATED", "customer", customer.id, logDetails({
          actor: ctx.user.id,
          targetId: customer.id,
          targetType: "customer",
          afterValue: { nextContactDate, reason: input.reason, nextAction: input.nextAction, status: "scheduled" },
          metadata: { customerId: customer.id },
        }));
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
        const date = input?.date ? new Date(input.date) : new Date();
        const scope = await getFollowUpScope(ctx.user);
        return getFollowUps({ ...scope, statuses: ["scheduled", "postponed"], dueTo: toDayEnd(date) });
      }),

    listOverdue: activeUserProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const date = input?.date ? new Date(input.date) : new Date();
        const scope = await getFollowUpScope(ctx.user);
        return getFollowUps({ ...scope, statuses: ["scheduled", "postponed"], dueTo: new Date(toDayStart(date).getTime() - 1) });
      }),

    complete: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const followUp = await verifyFollowUpAccess(ctx.user, input.id);
        if (!isOpenFollowUpStatus(followUp.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "처리 가능한 후속관리가 아닙니다." });
        await updateFollowUp(input.id, { status: "completed", completedAt: new Date(), completedBy: ctx.user.id });
        await log(ctx.user.id, "FOLLOW_UP_COMPLETED", "follow_up", input.id, logDetails({
          actor: ctx.user.id,
          targetId: input.id,
          targetType: "follow_up",
          beforeValue: { status: followUp.status },
          afterValue: { status: "completed" },
          metadata: { customerId: followUp.customerId },
        }));
        return { success: true };
      }),

    postpone: activeUserProcedure
      .input(z.object({ id: z.number(), nextContactDate: z.string(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const followUp = await verifyFollowUpAccess(ctx.user, input.id);
        if (!isOpenFollowUpStatus(followUp.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "연기 가능한 후속관리가 아닙니다." });
        const nextContactDate = new Date(input.nextContactDate);
        if (Number.isNaN(nextContactDate.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "다음 연락일이 올바르지 않습니다." });
        await updateFollowUp(input.id, { status: "postponed", nextContactDate, reason: input.reason ?? followUp.reason });
        await log(ctx.user.id, "FOLLOW_UP_POSTPONED", "follow_up", input.id, logDetails({
          actor: ctx.user.id,
          targetId: input.id,
          targetType: "follow_up",
          beforeValue: { nextContactDate: followUp.nextContactDate, status: followUp.status },
          afterValue: { nextContactDate, status: "postponed" },
          metadata: { customerId: followUp.customerId },
        }));
        return { success: true };
      }),

    cancel: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const followUp = await verifyFollowUpAccess(ctx.user, input.id);
        if (!isOpenFollowUpStatus(followUp.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "취소 가능한 후속관리가 아닙니다." });
        await updateFollowUp(input.id, { status: "cancelled" });
        await log(ctx.user.id, "FOLLOW_UP_CANCELLED", "follow_up", input.id, logDetails({
          actor: ctx.user.id,
          targetId: input.id,
          targetType: "follow_up",
          beforeValue: { status: followUp.status },
          afterValue: { status: "cancelled" },
          metadata: { customerId: followUp.customerId },
        }));
        return { success: true };
      }),
  }),

  dashboard: router({
    todayWork: activeUserProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const baseDate = input?.date ? new Date(input.date) : new Date();
        const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const nextMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        const { customerList, contractList, scheduleList, notifications, followUpList } = await getScopedDashboardData(ctx.user);
        const customerMap = new Map(customerList.map((customer) => [customer.id, customer]));
        const todayEnd = toDayEnd(baseDate);

        const todaySchedules = scheduleList
          .filter((schedule) => isSameCalendarDay(new Date(schedule.startTime), baseDate) && !isFinishedScheduleStatus(schedule.status))
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        const incompleteSchedules = scheduleList
          .filter((schedule) => {
            const deadline = schedule.endTime ?? schedule.startTime;
            return new Date(deadline).getTime() <= baseDate.getTime() && !isFinishedScheduleStatus(schedule.status);
          })
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        const pendingNotifications = notifications
          .filter((notification) => isUnreadNotification(notification))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const todayFollowUps = followUpList
          .filter((followUp) => isOpenFollowUpStatus(followUp.status) && new Date(followUp.nextContactDate).getTime() <= todayEnd.getTime())
          .sort((a, b) => new Date(a.nextContactDate).getTime() - new Date(b.nextContactDate).getTime());

        const overdueFollowUps = followUpList
          .filter((followUp) => isOpenFollowUpStatus(followUp.status) && new Date(followUp.nextContactDate).getTime() < toDayStart(baseDate).getTime())
          .sort((a, b) => new Date(a.nextContactDate).getTime() - new Date(b.nextContactDate).getTime());

        const longUnmanagedCustomers = notifications
          .filter((notification) => notification.type === "long_unmanaged_90" && notification.relatedType === "customer" && notification.relatedId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((notification) => {
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
          .filter((item) => item !== null)
          .slice(0, 10);

        const monthlyContracts = contractList.filter((contract) => {
          if (!contract.contractDate) return false;
          const contractDate = new Date(contract.contractDate);
          return contract.isActive && contractDate >= monthStart && contractDate < nextMonthStart;
        });
        const monthlyPremiumSum = monthlyContracts.reduce((sum, contract) => sum + Number(contract.monthlyPremium ?? 0), 0);

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
          todaySchedules: todaySchedules.slice(0, 8).map((schedule) => ({
            id: schedule.id,
            title: schedule.title,
            type: schedule.type,
            status: schedule.status,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            userId: schedule.userId,
          })),
          incompleteSchedules: incompleteSchedules.slice(0, 8).map((schedule) => ({
            id: schedule.id,
            title: schedule.title,
            type: schedule.type,
            status: schedule.status,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            userId: schedule.userId,
          })),
          pendingNotifications: pendingNotifications.slice(0, 8).map((notification) => {
            const customer = notification.relatedType === "customer" ? customerMap.get(notification.relatedId ?? 0) : undefined;
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
          todayFollowUps: todayFollowUps.slice(0, 8).map((followUp) => {
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
          overdueFollowUps: overdueFollowUps.slice(0, 8).map((followUp) => {
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
      .input(z.object({
        processStatus: z.string().optional(),
        isRead: z.boolean().optional(),
        type: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
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
          const userIds = [user.id, ...subordinates.map((u) => u.id)];
          return getNotificationsFiltered({ ...filter, userIds });
        }
        // team_leader: 본인 + 본인 팀원 알림
        if (user.role === "team_leader" && user.teamId) {
          const teamMembers = await getUsersByTeamId(user.teamId);
          const userIds = [user.id, ...teamMembers.map((u) => u.id)];
          return getNotificationsFiltered({ ...filter, userIds });
        }
        // member: 본인 알림만
        return getNotificationsFiltered({ ...filter, userIds: [user.id] });
      }),
    unreadCount: activeUserProcedure.query(async ({ ctx }) => getUnreadCount(ctx.user.id)),
    markRead: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await verifyNotificationAccess(ctx.user, input.id);
        await markNotificationRead(input.id);
        await log(ctx.user.id, "NOTIFICATION_READ", "notification", input.id, JSON.stringify({ actor: ctx.user.id, targetId: input.id }));
        return { success: true };
      }),
    markAllRead: activeUserProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    updateProcessStatus: activeUserProcedure
      .input(z.object({ id: z.number(), processStatus: z.enum(["미확인","확인","처리완료","보류"]) }))
      .mutation(async ({ ctx, input }) => {
        await verifyNotificationAccess(ctx.user, input.id);
        await updateNotificationProcessStatus(input.id, input.processStatus);
        await log(ctx.user.id, "NOTIFICATION_STATUS_CHANGED", "notification", input.id,
          JSON.stringify({ actor: ctx.user.id, targetId: input.id, afterValue: { processStatus: input.processStatus } }));
        return { success: true };
      }),
  }),

  // ── Performance ───────────────────────────────────────────────────────────
  performanceGoals: router({
    create: branchAdminProcedure
      .input(z.object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        targetType: z.enum(["branch", "sub_branch", "team", "user"]),
        targetId: z.number().nullable().optional(),
        contractCountGoal: z.number().int().min(0),
        monthlyPremiumGoal: z.number().int().min(0),
        consultationGoal: z.number().int().min(0).default(0),
        followUpGoal: z.number().int().min(0).default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const targetId = input.targetType === "branch" ? null : input.targetId;
        if (input.targetType !== "branch" && !targetId) throw new TRPCError({ code: "BAD_REQUEST", message: "대상 ID가 필요합니다." });
        if (input.targetType === "team" && targetId && !await getTeamById(targetId)) throw new TRPCError({ code: "NOT_FOUND", message: "팀을 찾을 수 없습니다." });
        if ((input.targetType === "user" || input.targetType === "sub_branch") && targetId) {
          const targetUser = await getUserById(targetId);
          if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." });
          if (input.targetType === "sub_branch" && targetUser.role !== "sub_branch_admin") throw new TRPCError({ code: "BAD_REQUEST", message: "부지점 목표 대상은 sub_branch_admin이어야 합니다." });
          if (input.targetType === "user" && targetUser.role !== "team_leader" && targetUser.role !== "member") throw new TRPCError({ code: "BAD_REQUEST", message: "개인 목표 대상은 team_leader 또는 member여야 합니다." });
        }
        const duplicate = await getActivePerformanceGoal({ year: input.year, month: input.month, targetType: input.targetType, targetId });
        if (duplicate) throw new TRPCError({ code: "BAD_REQUEST", message: "같은 월과 대상의 active 목표가 이미 있습니다." });
        const created = await createPerformanceGoal({ ...input, targetId, createdBy: ctx.user.id });
        await log(ctx.user.id, "PERFORMANCE_GOAL_CREATED", "performance_goal", created?.id, logDetails({ actor: ctx.user.id, targetType: "performance_goal", targetId: created?.id, afterValue: { ...input, targetId } }));
        return created;
      }),

    update: branchAdminProcedure
      .input(z.object({ id: z.number(), contractCountGoal: z.number().int().min(0), monthlyPremiumGoal: z.number().int().min(0), consultationGoal: z.number().int().min(0).default(0), followUpGoal: z.number().int().min(0).default(0) }))
      .mutation(async ({ ctx, input }) => {
        const goal = await getPerformanceGoalById(input.id);
        if (!goal) throw new TRPCError({ code: "NOT_FOUND", message: "목표를 찾을 수 없습니다." });
        await updatePerformanceGoal(input.id, { contractCountGoal: input.contractCountGoal, monthlyPremiumGoal: input.monthlyPremiumGoal, consultationGoal: input.consultationGoal, followUpGoal: input.followUpGoal, updatedBy: ctx.user.id });
        await log(ctx.user.id, "PERFORMANCE_GOAL_UPDATED", "performance_goal", input.id, logDetails({
          actor: ctx.user.id,
          targetType: "performance_goal",
          targetId: input.id,
          beforeValue: { contractCountGoal: goal.contractCountGoal, monthlyPremiumGoal: goal.monthlyPremiumGoal, consultationGoal: goal.consultationGoal, followUpGoal: goal.followUpGoal },
          afterValue: { contractCountGoal: input.contractCountGoal, monthlyPremiumGoal: input.monthlyPremiumGoal, consultationGoal: input.consultationGoal, followUpGoal: input.followUpGoal },
        }));
        return { success: true };
      }),

    deactivate: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const goal = await getPerformanceGoalById(input.id);
        if (!goal) throw new TRPCError({ code: "NOT_FOUND", message: "목표를 찾을 수 없습니다." });
        if (!goal.isActive || goal.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 비활성 처리된 목표입니다." });
        await deactivatePerformanceGoal(input.id, ctx.user.id);
        await log(ctx.user.id, "PERFORMANCE_GOAL_DEACTIVATED", "performance_goal", input.id, logDetails({ actor: ctx.user.id, targetType: "performance_goal", targetId: input.id, beforeValue: { isActive: goal.isActive }, afterValue: { isActive: false } }));
        return { success: true };
      }),

    list: activeUserProcedure
      .input(z.object({ year: z.number().int().optional(), month: z.number().int().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "branch_admin") return listPerformanceGoals(input ?? {});
        const now = new Date();
        const dashboard = await getPerformanceGoalDashboard(ctx.user as any, input?.year ?? now.getFullYear(), input?.month ?? now.getMonth() + 1);
        return dashboard.items.map((item) => item.goal);
      }),

    dashboard: activeUserProcedure
      .input(z.object({ year: z.number().int().min(2000).max(2100).optional(), month: z.number().int().min(1).max(12).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const now = new Date();
        return getPerformanceGoalDashboard(ctx.user as any, input?.year ?? now.getFullYear(), input?.month ?? now.getMonth() + 1);
      }),
  }),

  performance: router({
    stats: activeUserProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        agentIdFilter: z.number().optional(),
        teamIdFilter: z.number().optional(),
        productGroup: z.string().optional(),
        company: z.string().optional(),
        region: z.string().optional(),
        source: z.string().optional(),
        scope: z.enum(["all", "mine"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo = input?.dateTo ? new Date(input.dateTo) : undefined;
        const extraFilter = { productGroup: input?.productGroup, company: input?.company, region: input?.region, source: input?.source };
        const scope = await buildPerformanceScope(user, input);
        return getPerformanceStats({ ...scope, dateFrom, dateTo, ...extraFilter });
      }),

    agentStats: activeUserProcedure
      .input(z.object({ agentId: z.number(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
        if (ctx.user.role === "member") {
          if (input.agentId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "팀장 이상만 접근 가능합니다." });
          }
          return getPerformanceStats({ agentId: input.agentId, dateFrom, dateTo });
        }
        if (ctx.user.role === "team_leader" && input.agentId === ctx.user.id) {
          return getPerformanceStats({ agentId: input.agentId, dateFrom, dateTo });
        }
        await verifyTargetUserAccess(ctx.user, input.agentId);
        const target = await getUserById(input.agentId);
        if (!target || (target.role !== "team_leader" && target.role !== "member")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "팀장 또는 팀원의 실적만 조회할 수 있습니다." });
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
    customers: branchAdminProcedure
      .input(z.object({ reason: z.string().min(5).max(300) }))
      .query(async ({ ctx, input }) => {
      const data = await getCustomers({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "customers", undefined,
        logDetails({ actor: ctx.user.id, targetType: "customers", metadata: { type: "customers", rowCount: data.length, reason: input.reason } }));
      return data;
    }),
    contracts: branchAdminProcedure
      .input(z.object({ reason: z.string().min(5).max(300) }))
      .query(async ({ ctx, input }) => {
      const data = await getAllContracts({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "contracts", undefined,
        logDetails({ actor: ctx.user.id, targetType: "contracts", metadata: { type: "contracts", rowCount: data.length, reason: input.reason } }));
      return data;
    }),
    schedules: branchAdminProcedure
      .input(z.object({ reason: z.string().min(5).max(300) }))
      .query(async ({ ctx, input }) => {
      const data = await getSchedules({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "schedules", undefined,
        logDetails({ actor: ctx.user.id, targetType: "schedules", metadata: { type: "schedules", rowCount: data.length, reason: input.reason } }));
      return data;
    }),
    performance: branchAdminProcedure
      .input(z.object({ reason: z.string().min(5).max(300) }))
      .query(async ({ ctx, input }) => {
      const data = await getPerformanceStats({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "performance", undefined,
        logDetails({ actor: ctx.user.id, targetType: "performance", metadata: { type: "performance", reason: input.reason } }));
      return data;
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
          .filter((item) => item.isActive)
          .map((item) => ({ category: item.category, value: item.value, label: item.value }));
      }),
    create: branchAdminProcedure
      .input(z.object({ category: z.string(), value: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await createSetting(input.category, input.value, ctx.user.id);
        await log(ctx.user.id, "SETTINGS_CREATED", "settings", undefined, `category=${input.category},value=${input.value}`);
        return { success: true };
      }),
    toggle: branchAdminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await toggleSetting(input.id, input.isActive);
        await log(ctx.user.id, "SETTINGS_UPDATED", "settings", input.id, `isActive=${input.isActive}`);
        return { success: true };
      }),
    update: branchAdminProcedure
      .input(z.object({ id: z.number(), value: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await updateSetting(input.id, input.value);
        await log(ctx.user.id, "MASTER_DATA_UPDATED", "settings", input.id, `value=${input.value}`);
        return { success: true };
      }),
  }),

  // ── Activity Logs ───────────────────────────────────────────────────────────────
  logs: router({
    list: teamLeaderOrAboveProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (user.role === "branch_admin") return getActivityLogs(500);
      if (user.role === "sub_branch_admin") return getActivityLogs(500, user.id);
      return getActivityLogs(500, undefined, user.teamId ?? undefined);
    }),
  }),
});

export type AppRouter = typeof appRouter;
