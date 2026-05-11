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
  createUser,
  linkUserOpenId,
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

async function log(userId: number, action: string, targetType?: string, targetId?: number, details?: string) {
  await createActivityLog({ userId, action, targetType, targetId, details });
}

// ─── App Router ───────────────────────────────────────────────────────────────
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
      return all.filter((u) => u.accountStatus === "active");
    }),

    updateRole: branchAdminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["branch_admin", "sub_branch_admin", "team_leader", "member"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserRole(input.userId, input.role);
        await log(ctx.user.id, "USER_ROLE_CHANGED", "user", input.userId, `role=${input.role}`);
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
        });
        if (!newUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "사용자 생성에 실패했습니다." });
        await log(ctx.user.id, "USER_CREATED", "user", newUser.id,
          JSON.stringify({ actor: ctx.user.id, targetUserId: newUser.id, role: input.role, accountStatus: input.accountStatus, subBranchAdminId: resolvedSubBranchAdminId, teamId: resolvedTeamId, email: input.email }));
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
        await updateUserTeam(input.userId, input.teamId);
        // 로그 분기: 최초 배치 vs 팀 이동
        const teamLogAction = previousTeamId === null ? "MEMBER_ASSIGNED_TO_TEAM" : "USER_MOVED_TO_ANOTHER_TEAM";
        await log(ctx.user.id, teamLogAction, "user", input.userId,
          JSON.stringify({ actor: ctx.user.id, targetUserId: input.userId, previousTeamId, newTeamId: input.teamId, previousSubBranchAdminId: existingUserForTeam?.subBranchAdminId }));
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
          await log(ctx.user.id, "TEAM_LEADER_ASSIGNED", "team", id, `managerId=${data.managerId}`);
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
        if (user.role === "team_leader") return getCustomers({ ...baseFilter, teamId: user.teamId ?? undefined });
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
        return { isDuplicate: !!dup, existingCustomer: dup ? { id: dup.id, name: dup.name } : null };
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
        privacyConsent: z.boolean().default(false),
        marketingConsent: z.boolean().default(false),
        memo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.phone) {
          const dup = await checkPhoneDuplicate(input.phone);
          if (dup) throw new TRPCError({ code: "CONFLICT", message: `이미 동일한 연락처가 등록되어 있습니다. (${dup.name})` });
        }
        await createCustomer({ ...input, birthDate: input.birthDate ? new Date(input.birthDate) : undefined, createdBy: ctx.user.id });
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
        const prevSubBranchAdminId = customer.subBranchAdminId;
        await assignCustomerToSubBranch(input.customerId, input.subBranchAdminId);
        await createAssignmentHistory({
          customerId: input.customerId,
          previousSubBranchAdminId: prevSubBranchAdminId ?? undefined,
          newSubBranchAdminId: input.subBranchAdminId,
          previousAgentId: customer.agentId ?? undefined,
          assignedBy: ctx.user.id,
          assignmentType: "branch_to_sub_branch",
        });
        await log(ctx.user.id, "DB_ASSIGNED_TO_SUB_BRANCH_ADMIN", "customer", input.customerId, `subBranchAdminId=${input.subBranchAdminId}`);
        await log(ctx.user.id, "ASSIGNMENT_HISTORY_CREATED", "customer", input.customerId);
        await log(ctx.user.id, "CUSTOMER_TRANSFERRED", "customer", input.customerId,
          JSON.stringify({ actor: ctx.user.id, customerId: input.customerId, previousSubBranchAdminId: customer.subBranchAdminId ?? null, newSubBranchAdminId: input.subBranchAdminId, previousAgentId: customer.agentId ?? null, newAgentId: null, assignmentStatusBefore: customer.assignmentStatus, assignmentStatusAfter: "assigned_to_sub_branch" }));
        return { success: true };
      }),

    /** 지점장 또는 부지점장이 팀원에게 최종 배정 */
    assign: subBranchAdminOrAboveProcedure
      .input(z.object({ customerId: z.number(), agentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

        // 부지점장 이중 검증 (조건 3)
        if (user.role === "sub_branch_admin") {
          // ① 고객 DB가 본인에게 배분된 것인지
          if (customer.subBranchAdminId !== user.id)
            throw new TRPCError({ code: "FORBIDDEN", message: "본인에게 배분된 DB만 배정 가능합니다." });
          // ② 배정 대상이 본인 산하 팀장/팀원인지
          const targetUser = await getUserById(input.agentId);
          if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });
          if (targetUser.subBranchAdminId !== user.id)
            throw new TRPCError({ code: "FORBIDDEN", message: "본인 산하 조직원에게만 배정 가능합니다." });
          // ③ 대상 역할 확인
          if (targetUser.role !== "team_leader" && targetUser.role !== "member")
            throw new TRPCError({ code: "FORBIDDEN", message: "팀장 또는 팀원에게만 배정 가능합니다." });
          // ④ 대상 계정 활성 확인
          if (targetUser.accountStatus !== "active")
            throw new TRPCError({ code: "FORBIDDEN", message: "비활성 계정에는 배정할 수 없습니다." });
        }

        const agent = await getUserById(input.agentId);
        const prevAgentId = customer.agentId;
        await assignCustomer(input.customerId, input.agentId, agent?.teamId ?? undefined, agent?.subBranchAdminId ?? undefined);

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
        });

        // DB 배정 로그 분리 (역할 및 assignmentType 기반)
        const assignLogAction = user.role === "branch_admin" ? "DB_ASSIGNED_BY_BRANCH_ADMIN" : "DB_ASSIGNED_BY_SUB_BRANCH_ADMIN";
        await log(ctx.user.id, assignLogAction, "customer", input.customerId, `agentId=${input.agentId}`);
        await log(ctx.user.id, "ASSIGNMENT_HISTORY_CREATED", "customer", input.customerId);
        await log(ctx.user.id, "CUSTOMER_ASSIGNED", "customer", input.customerId, `agentId=${input.agentId}`);

        if (agent && customer) {
          await createNotification({ userId: input.agentId, type: "customer_assigned", title: "새 고객 배정", message: `${customer.name} 고객이 배정되었습니다.`, relatedType: "customer", relatedId: input.customerId, dueAt: new Date() });
          await createUncontactedReminder(input.customerId, input.agentId, new Date(), customer.name);
          if (customer.birthDate) await createBirthdayReminder(input.customerId, input.agentId, new Date(customer.birthDate), customer.name);
          await refreshLongUnmanagedReminder(input.customerId, input.agentId, new Date(), customer.name);
        }
        return { success: true };
      }),

    changeAgent: teamLeaderOrAboveProcedure
      .input(z.object({ customerId: z.number(), newAgentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await verifyCustomerAccess(ctx.user, input.customerId);
        const agent = await getUserById(input.newAgentId);
        await assignCustomer(input.customerId, input.newAgentId, agent?.teamId ?? undefined, agent?.subBranchAdminId ?? undefined);
        await createAssignmentHistory({
          customerId: input.customerId,
          previousAgentId: existing.agentId ?? undefined,
          newAgentId: input.newAgentId,
          assignedBy: ctx.user.id,
          assignmentType: "reassignment",
        });
        const prevAgentId = existing.agentId ?? null;
        await log(ctx.user.id, "AGENT_CHANGED", "customer", input.customerId, JSON.stringify({ before: { agentId: prevAgentId }, after: { agentId: input.newAgentId } }));
        await log(ctx.user.id, "CUSTOMER_REASSIGNED", "customer", input.customerId,
          JSON.stringify({ actor: ctx.user.id, customerId: input.customerId, previousAgentId: prevAgentId, newAgentId: input.newAgentId }));
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
      if (user.role === "team_leader") return getAllContracts({ teamId: user.teamId ?? undefined });
      return getAllContracts({ agentId: user.id });
    }),

    contractHistory: activeUserProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => getContractHistory(input.contractId)),

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

        let finalAgentId = user.id;
        if (input.agentIdOverride && user.role !== "member") {
          // 팀장: 본인 팀원만 지정 가능
          if (user.role === "team_leader") {
            const targetAgent = await getUserById(input.agentIdOverride);
            if (!targetAgent || targetAgent.teamId !== user.teamId)
              throw new TRPCError({ code: "FORBIDDEN", message: "본인 팀원만 담당자로 지정 가능합니다." });
          }
          // 부지점장: 본인 산하만 지정 가능
          if (user.role === "sub_branch_admin") {
            const targetAgent = await getUserById(input.agentIdOverride);
            if (!targetAgent || targetAgent.subBranchAdminId !== user.id)
              throw new TRPCError({ code: "FORBIDDEN", message: "본인 산하 조직원만 담당자로 지정 가능합니다." });
          }
          finalAgentId = input.agentIdOverride;
        }

        const { contractDate, agentIdOverride, ...rest } = input;
        const contractDateObj = contractDate ? new Date(contractDate) : undefined;
        await createContract({ ...rest, agentId: finalAgentId, contractDate: contractDateObj, createdBy: ctx.user.id });
        await log(ctx.user.id, "CONTRACT_CREATED", "customer", input.customerId);

        if (contractDateObj) {
          const allContracts = await getContractsByCustomer(input.customerId);
          const newContract = allContracts[0];
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

        // 담당자 변경 권한 (팀원 불가)
        if (newAgentId !== undefined && ctx.user.role === "member")
          throw new TRPCError({ code: "FORBIDDEN", message: "팀원은 계약 담당자를 변경할 수 없습니다." });

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
          await log(ctx.user.id, "CONTRACT_OWNER_CHANGED", "contract", id, JSON.stringify({ before: { agentId: existing.agentId }, after: { agentId: newAgentId } }));
        }

        await updateContract(id, { ...rest, paymentStatus, agentId: newAgentId ?? existing.agentId, contractDate: contractDate ? new Date(contractDate) : undefined });
        await log(ctx.user.id, "CONTRACT_UPDATED", "contract", id);

        if (paymentStatus && existing && paymentStatus !== existing.paymentStatus) {
          const customer = existing.customerId ? await getCustomerById(existing.customerId) : null;
          if (customer) await createPaymentStatusReminder(id, ctx.user.id, paymentStatus, customer.name);
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
        await log(ctx.user.id, "CONTRACT_DEACTIVATED", "contract", input.id);
        return { success: true };
      }),
  }),

  // ── Schedules ─────────────────────────────────────────────────────────────
  schedules: router({
    list: activeUserProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (user.role === "branch_admin") return getSchedules({});
      if (user.role === "sub_branch_admin") return getSchedules({ subBranchAdminId: user.id });
      if (user.role === "team_leader") return getSchedules({ teamId: user.teamId ?? undefined });
      return getSchedules({ userId: user.id });
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
        if (input.targetUserId && user.role !== "member") {
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
        let allSchedulesList;
        if (user.role === "branch_admin") allSchedulesList = await getSchedules({});
        else if (user.role === "sub_branch_admin") allSchedulesList = await getSchedules({ subBranchAdminId: user.id });
        else if (user.role === "team_leader") allSchedulesList = await getSchedules({ teamId: user.teamId ?? undefined });
        else allSchedulesList = await getSchedules({ userId: user.id });

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
        let allSchedulesList;
        if (user.role === "branch_admin") allSchedulesList = await getSchedules({});
        else if (user.role === "sub_branch_admin") allSchedulesList = await getSchedules({ subBranchAdminId: user.id });
        else if (user.role === "team_leader") allSchedulesList = await getSchedules({ teamId: user.teamId ?? undefined });
        else allSchedulesList = await getSchedules({ userId: user.id });

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
    list: activeUserProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      // branch_admin: 전체 알림 (userId 기반 본인 알림만 - 전체 알림은 관리자 로그에서 확인)
      if (user.role === "branch_admin") return getNotifications(user.id);
      // sub_branch_admin: 본인 + 산하 팀원 알림
      if (user.role === "sub_branch_admin") {
        const subordinates = await getUsersBySubBranchAdminId(user.id);
        const extraIds = subordinates.map((u) => u.id).filter((id) => id !== user.id);
        return getNotifications(user.id, extraIds);
      }
      // team_leader: 본인 + 본인 팀원 알림
      if (user.role === "team_leader" && user.teamId) {
        const teamMembers = await getUsersByTeamId(user.teamId);
        const extraIds = teamMembers.map((u) => u.id).filter((id) => id !== user.id);
        return getNotifications(user.id, extraIds);
      }
      // member: 본인 알림만
      return getNotifications(user.id);
    }),
    unreadCount: activeUserProcedure.query(async ({ ctx }) => getUnreadCount(ctx.user.id)),
    markRead: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await markNotificationRead(input.id); return { success: true }; }),
    markAllRead: activeUserProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    updateProcessStatus: activeUserProcedure
      .input(z.object({ id: z.number(), processStatus: z.enum(["미확인","확인","처리완료","보류"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateNotificationProcessStatus(input.id, input.processStatus);
        await log(ctx.user.id, "NOTIFICATION_STATUS_CHANGED", "notification", input.id, `processStatus=${input.processStatus}`);
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
        if (user.role === "branch_admin") {
          return getPerformanceStats({ agentId: input?.agentIdFilter, teamId: input?.teamIdFilter, dateFrom, dateTo, ...extraFilter });
        }
        if (user.role === "sub_branch_admin") return getPerformanceStats({ subBranchAdminId: user.id, agentId: input?.agentIdFilter, dateFrom, dateTo, ...extraFilter });
        if (user.role === "team_leader") return getPerformanceStats({ teamId: user.teamId ?? undefined, agentId: input?.agentIdFilter, dateFrom, dateTo, ...extraFilter });
        return getPerformanceStats({ agentId: user.id, dateFrom, dateTo, ...extraFilter });
      }),

    agentStats: teamLeaderOrAboveProcedure
      .input(z.object({ agentId: z.number(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input }) => getPerformanceStats({
        agentId: input.agentId,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
      })),
  }),

  // ── Download (지점장 전용) ─────────────────────────────────────────────────────────
  download: router({
    customers: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getCustomers({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "customers", undefined, "type=customers");
      return data;
    }),
    contracts: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getAllContracts({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "contracts", undefined, "type=contracts");
      return data;
    }),
    schedules: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getSchedules({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "schedules", undefined, "type=schedules");
      return data;
    }),
    performance: branchAdminProcedure.query(async ({ ctx }) => {
      const data = await getPerformanceStats({});
      await log(ctx.user.id, "DATA_DOWNLOAD", "performance", undefined, "type=performance");
      return data;
    }),
  }),

  // ── Settings (지점장 전용 마스터 데이터) ─────────────────────────────────────────────
  settings: router({
    list: activeUserProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => getSettings(input.category)),
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
