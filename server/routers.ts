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
  createContract,
  createContractHistoryEntry,
  createCustomer,
  createNotification,
  createSchedule,
  createStatusHistory,
  createTeam,
  completeSchedule,
  deactivateContract,
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
  getConsultationsByCustomer,
  getContractById,
  getContractHistory,
  getContractsByCustomer,
  getCustomerById,
  getCustomers,
  getNotifications,
  getNotificationById,
  getPerformanceStats,
  getSchedules,
  getStatusHistory,
  getTeamById,
  getUnreadCount,
  getUserById,
  markAllNotificationsRead,
  markNotificationRead,
  updateConsultation,
  updateContract,
  updateCustomer,
  updateNotificationProcessStatus,
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
  linkUserOpenId,
  getAllNotifications,
  getNotificationsFiltered,
  normalizePhone,
  normalizeBulkImportRow,
  runDbTransaction,
  detectForbiddenColumns,
  findUserByNameUnique,
  findTeamByNameAndSubBranch,
  validateBulkImportRow,
  getAllActiveCustomerPhones,
  bulkCreateCustomers,
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

async function verifyAgentTarget(
  actor: { id: number; role: string; teamId: number | null; subBranchAdminId: number | null },
  targetUserId: number
) {
  const target = await getUserById(targetUserId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });
  if (target.accountStatus !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: "비활성 계정에는 배정할 수 없습니다." });
  }
  if (target.role !== "team_leader" && target.role !== "member") {
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
  input?: { agentIdFilter?: number; teamIdFilter?: number }
) {
  const agentId = input?.agentIdFilter;
  const teamId = input?.teamIdFilter;

  if (user.role === "branch_admin") return { agentId, teamId };

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
        await updateTeam(id, data);

        if (data.isActive === false) {
          await log(ctx.user.id, "TEAM_DEACTIVATED", "team", id);
        } else if (data.managerId !== undefined) {
          const previousManagerId = existing?.managerId ?? null;
          await log(ctx.user.id, "TEAM_LEADER_ASSIGNED", "team", id,
            JSON.stringify({ actor: ctx.user.id, teamId: id, previousTeamLeaderId: previousManagerId, newTeamLeaderId: data.managerId, beforeValue: { managerId: previousManagerId }, afterValue: { managerId: data.managerId } }));
        } else {
          await log(ctx.user.id, "TEAM_UPDATED", "team", id, JSON.stringify({ before: existing, after: data }));
        }
        return { success: true };
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
        agentIdFilter: z.number().optional(),
        assignedDateFrom: z.string().optional(),
        assignedDateTo: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        const baseFilter = {
          status: input.status,
          unassigned: input.unassigned,
          region: input.region,
          source: input.source,
          assignedDateFrom: input.assignedDateFrom ? new Date(input.assignedDateFrom) : undefined,
          assignedDateTo: input.assignedDateTo ? new Date(input.assignedDateTo) : undefined,
        };
        if (user.role === "branch_admin") return getCustomers({ ...baseFilter, agentId: input.agentIdFilter });
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
        privacyConsent: z.boolean().default(false),
        marketingConsent: z.boolean().default(false),
        memo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.phone) {
          const dup = await checkPhoneDuplicate(input.phone);
          if (dup) throw new TRPCError({ code: "CONFLICT", message: `이미 동일한 연락처가 등록되어 있습니다. (${dup.name})` });
        }
        await createCustomer({ ...input, phone: input.phone ? normalizePhone(input.phone) : undefined, birthDate: input.birthDate ? new Date(input.birthDate) : undefined, createdBy: ctx.user.id });
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
        consultStatus: z.enum(["미상담","부재","통화완료","상담예정","설계중","계약","보류","거절","해지관리","재상담필요"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, birthDate, consultStatus, privacyConsent, marketingConsent, ...rest } = input;
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

        await updateCustomer(id, { ...rest, consultStatus, privacyConsent, marketingConsent, birthDate: birthDate ? new Date(birthDate) : undefined });
        await log(ctx.user.id, "CUSTOMER_UPDATED", "customer", id, JSON.stringify({ before: beforeSnapshot, after: afterSnapshot }));
        return { success: true };
      }),

    deactivate: teamLeaderOrAboveProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await verifyCustomerAccess(ctx.user, input.id);
        await softDeleteCustomer(input.id);
        await log(ctx.user.id, "CUSTOMER_DEACTIVATED", "customer", input.id);
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

        // DB 배정 로그 분리 (역할 및 assignmentType 기반)
        const assignLogAction = user.role === "branch_admin" ? "DB_ASSIGNED_BY_BRANCH_ADMIN" : "DB_ASSIGNED_BY_SUB_BRANCH_ADMIN";
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
            newSubBranchAdminId: agent?.subBranchAdminId ?? null,
            newTeamId: agent?.teamId ?? null,
          },
          metadata: { assignmentType: user.role === "branch_admin" ? "branch_to_agent" : "sub_branch_to_agent" },
        });
        await runDbTransaction(async (tx) => {
          await assignCustomer(input.customerId, input.agentId, agent?.teamId ?? undefined, agent?.subBranchAdminId ?? undefined, tx);
          await createAssignmentHistory({
            customerId: input.customerId,
            previousSubBranchAdminId: customer.subBranchAdminId ?? undefined,
            newSubBranchAdminId: agent?.subBranchAdminId ?? undefined,
            previousTeamId: customer.assignedTeamId ?? undefined,
            newTeamId: agent?.teamId ?? undefined,
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
            newSubBranchAdminId: agent?.subBranchAdminId ?? null,
            newTeamId: agent?.teamId ?? null,
          },
          metadata: { assignmentType: "reassignment" },
        });
        await runDbTransaction(async (tx) => {
          await assignCustomer(input.customerId, input.newAgentId, agent?.teamId ?? undefined, agent?.subBranchAdminId ?? undefined, tx);
          await createAssignmentHistory({
            customerId: input.customerId,
            previousSubBranchAdminId: existing.subBranchAdminId ?? undefined,
            newSubBranchAdminId: agent?.subBranchAdminId ?? undefined,
            previousTeamId: existing.assignedTeamId ?? undefined,
            newTeamId: agent?.teamId ?? undefined,
            previousAgentId: existing.agentId ?? undefined,
            newAgentId: input.newAgentId,
            assignedBy: ctx.user.id,
            assignmentType: "reassignment",
          }, tx);
          await log(ctx.user.id, "AGENT_CHANGED", "customer", input.customerId, transferDetails, tx);
          await log(ctx.user.id, "CUSTOMER_REASSIGNED", "customer", input.customerId, transferDetails, tx);
          if ((existing.subBranchAdminId ?? null) !== (agent?.subBranchAdminId ?? null)) {
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

        const customersToCreate = validRows.map((result) => {
          const row = normalizeBulkImportRow(input.rows[result.rowIndex]);
          return {
            name: row.name!,
            phone: result.normalizedPhone ?? (row.phone ? normalizePhone(row.phone) : undefined),
            birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
            gender: (row.gender === "남" || row.gender === "male" ? "male" : row.gender === "여" || row.gender === "female" ? "female" : row.gender === "기타" || row.gender === "other" ? "other" : undefined) as any,
            region: row.region,
            expectedPremium: row.expectedPremium ? parseInt(row.expectedPremium, 10) : undefined,
            availableTime: row.availableTime,
            source: row.source,
            consultStatus: row.consultStatus || "미상담",
            memo: row.memo,
            agentId: result.agentId,
            subBranchAdminId: result.subBranchAdminId,
            assignedTeamId: result.teamId,
            assignmentStatus: result.assignmentStatus as "unassigned" | "assigned_to_sub_branch" | "assigned_to_agent",
            createdBy: ctx.user.id,
          };
        })

        await bulkCreateCustomers(customersToCreate);

        const errorCount = validationResults.filter((r) => !r.isValid).length;
        const duplicateCount = validationResults.filter((r) => r.errors.some((e) => e.includes("기존 DB에 존재"))).length;

        await log(ctx.user.id, "CUSTOMER_BULK_IMPORTED", "customer", undefined,
          JSON.stringify({
            importBatchId,
            fileName: input.fileName,
            uploadedBy: ctx.user.id,
            totalRows: input.rows.length,
            successRows: validRows.length,
            failedRows: errorCount,
            duplicateRows: duplicateCount,
            importedAt: new Date().toISOString(),
          }));

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
          }));

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
        content: z.string().optional(),
        nextContactAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customer = await verifyCustomerAccess(ctx.user, input.customerId);
        if (input.status !== customer.consultStatus) {
          await createStatusHistory({ customerId: input.customerId, changedBy: ctx.user.id, previousStatus: customer.consultStatus, newStatus: input.status });
        }
        const nextContactDate = input.nextContactAt ? new Date(input.nextContactAt) : undefined;
        await createConsultation({ customerId: input.customerId, agentId: ctx.user.id, status: input.status, content: input.content, nextContactAt: nextContactDate });
        if (nextContactDate) await createReconsultReminder(input.customerId, ctx.user.id, nextContactDate, customer.name);
        if (customer.agentId) await refreshLongUnmanagedReminder(input.customerId, customer.agentId, new Date(), customer.name);
        await log(ctx.user.id, "CONSULTATION_CREATED", "customer", input.customerId, `status=${input.status}`);
        return { success: true };
      }),

    update: activeUserProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["미상담","부재","통화완료","상담예정","설계중","계약","보류","거절","해지관리","재상담필요"]).optional(),
        content: z.string().optional(),
        nextContactAt: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getConsultationById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, existing.customerId);
        // 소유권 검증: 상담기록의 고객을 통해 검증
        await verifyCustomerAccess(ctx.user, existing.customerId);

        const beforeSnapshot = { status: existing.status, content: existing.content, nextContactAt: existing.nextContactAt };
        const afterSnapshot: Record<string, unknown> = {};
        if (input.status !== undefined) afterSnapshot.status = input.status;
        if (input.content !== undefined) afterSnapshot.content = input.content;
        if (input.nextContactAt !== undefined) afterSnapshot.nextContactAt = input.nextContactAt;

        await updateConsultation(input.id, {
          status: input.status,
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

    list: activeUserProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (user.role === "branch_admin") return getAllContracts({});
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

    deactivate: teamLeaderOrAboveProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getContractById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await verifyCustomerAccess(ctx.user, existing.customerId);
        await deactivateContract(input.id);
        await log(ctx.user.id, "CONTRACT_DEACTIVATED", "contract", input.id,
          logDetails({
            actor: ctx.user.id,
            targetId: input.id,
            targetType: "contract",
            beforeValue: { isActive: existing.isActive, contractStatus: existing.contractStatus },
            afterValue: { isActive: false },
          }));
        return { success: true };
      }),
  }),

  // ── Schedules ─────────────────────────────────────────────────────────────
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
    customers: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getCustomers({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "customers", undefined,
        logDetails({ actor: ctx.user.id, targetType: "customers", metadata: { type: "customers", rowCount: data.length } }));
      return data;
    }),
    contracts: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getAllContracts({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "contracts", undefined,
        logDetails({ actor: ctx.user.id, targetType: "contracts", metadata: { type: "contracts", rowCount: data.length } }));
      return data;
    }),
    schedules: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getSchedules({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "schedules", undefined,
        logDetails({ actor: ctx.user.id, targetType: "schedules", metadata: { type: "schedules", rowCount: data.length } }));
      return data;
    }),
    performance: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getPerformanceStats({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "performance", undefined,
        logDetails({ actor: ctx.user.id, targetType: "performance", metadata: { type: "performance" } }));
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
