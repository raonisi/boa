import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  assignCustomer,
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
  getUnreadCount,
  getUserById,
  markAllNotificationsRead,
  markNotificationRead,
  updateConsultation,
  updateContract,
  updateCustomer,
  updateNotificationProcessStatus,
  updateSchedule,
  updateUserRole,
  updateUserTeam,
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

// ─── Middleware helpers ───────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  return next({ ctx });
});

const managerOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "manager")
    throw new TRPCError({ code: "FORBIDDEN", message: "팀장 이상만 접근 가능합니다." });
  return next({ ctx });
});

const activeUserProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "inactive")
    throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  return next({ ctx });
});

async function log(
  userId: number,
  action: string,
  targetType?: string,
  targetId?: number,
  details?: string
) {
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
      if (ctx.user.role === "admin") return all;
      return all.filter((u) => u.role !== "inactive");
    }),

    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["admin", "manager", "agent", "inactive"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserRole(input.userId, input.role);
        await log(ctx.user.id, input.role === "inactive" ? "USER_BLOCKED" : "USER_ROLE_CHANGED", "user", input.userId, `role=${input.role}`);
        return { success: true };
      }),

    updateTeam: adminProcedure
      .input(z.object({ userId: z.number(), teamId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await updateUserTeam(input.userId, input.teamId);
        await log(ctx.user.id, "USER_TEAM_CHANGED", "user", input.userId, `teamId=${input.teamId}`);
        return { success: true };
      }),

    teams: activeUserProcedure.query(async () => getAllTeams()),

    createTeam: adminProcedure
      .input(z.object({ name: z.string().min(1), managerId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await createTeam(input.name, input.managerId);
        await log(ctx.user.id, "TEAM_CREATED", "team", undefined, `name=${input.name}`);
        return { success: true };
      }),
  }),

  // ── Customers ─────────────────────────────────────────────────────────────
  customers: router({
    list: activeUserProcedure
      .input(z.object({ status: z.string().optional(), unassigned: z.boolean().optional() }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (user.role === "admin") return getCustomers({ status: input.status, unassigned: input.unassigned });
        if (user.role === "manager") return getCustomers({ teamId: user.teamId ?? undefined, status: input.status });
        return getCustomers({ agentId: user.id, status: input.status });
      }),

    get: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const customer = await getCustomerById(input.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        const user = ctx.user;
        if (user.role === "agent" && customer.agentId !== user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (user.role === "manager") {
          const agent = customer.agentId ? await getUserById(customer.agentId) : null;
          if (agent && agent.teamId !== user.teamId) throw new TRPCError({ code: "FORBIDDEN" });
        }
        await log(ctx.user.id, "CUSTOMER_VIEWED", "customer", input.id);
        return customer;
      }),

    checkDuplicate: activeUserProcedure
      .input(z.object({ phone: z.string(), excludeId: z.number().optional() }))
      .query(async ({ input }) => {
        const dup = await checkPhoneDuplicate(input.phone, input.excludeId);
        return { isDuplicate: !!dup, existingCustomer: dup ? { id: dup.id, name: dup.name } : null };
      }),

    create: adminProcedure
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
        // 연락처 중복 확인
        if (input.phone) {
          const dup = await checkPhoneDuplicate(input.phone);
          if (dup) {
            throw new TRPCError({ code: "CONFLICT", message: `이미 동일한 연락처가 등록되어 있습니다. (${dup.name})` });
          }
        }
        await createCustomer({
          ...input,
          birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
          createdBy: ctx.user.id,
        });
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
        const existing = await getCustomerById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        // 권한 검증: 팀원은 본인 고객만, 팀장은 본인 팀 고객만
        const user = ctx.user;
        if (user.role === "agent" && existing.agentId !== user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (user.role === "manager") {
          const agent = existing.agentId ? await getUserById(existing.agentId) : null;
          if (agent && agent.teamId !== user.teamId) throw new TRPCError({ code: "FORBIDDEN" });
        }

        // before/after 기록
        const beforeSnapshot: Record<string, unknown> = {};
        const afterSnapshot: Record<string, unknown> = {};
        for (const key of Object.keys(rest) as (keyof typeof rest)[]) {
          if (rest[key] !== undefined && (existing as any)[key] !== rest[key]) {
            beforeSnapshot[key] = (existing as any)[key];
            afterSnapshot[key] = rest[key];
          }
        }

        // 상태 변경 이력
        if (consultStatus && consultStatus !== existing.consultStatus) {
          await createStatusHistory({ customerId: id, changedBy: ctx.user.id, previousStatus: existing.consultStatus, newStatus: consultStatus });
          beforeSnapshot.consultStatus = existing.consultStatus;
          afterSnapshot.consultStatus = consultStatus;
        }

        // 동의 변경 이력
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

    deactivate: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "manager")
          throw new TRPCError({ code: "FORBIDDEN" });
        await softDeleteCustomer(input.id);
        await log(ctx.user.id, "CUSTOMER_DEACTIVATED", "customer", input.id);
        return { success: true };
      }),

    assignmentHistory: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => getAssignmentHistory(input.customerId)),

    assign: adminProcedure
      .input(z.object({ customerId: z.number(), agentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const agent = await getUserById(input.agentId);
        const customer = await getCustomerById(input.customerId);
        const previousAgentId = customer?.agentId ?? undefined;
        await assignCustomer(input.customerId, input.agentId, agent?.teamId ?? undefined);
        // 배정 이력 기록
        await createAssignmentHistory({ customerId: input.customerId, previousAgentId, newAgentId: input.agentId, assignedBy: ctx.user.id });
        await log(ctx.user.id, "CUSTOMER_ASSIGNED", "customer", input.customerId, `agentId=${input.agentId}`);

        if (agent && customer) {
          await createNotification({
            userId: input.agentId,
            type: "customer_assigned",
            title: "새 고객 배정",
            message: `${customer.name} 고객이 배정되었습니다.`,
            relatedType: "customer",
            relatedId: input.customerId,
            dueAt: new Date(),
          });
          await createUncontactedReminder(input.customerId, input.agentId, new Date(), customer.name);
          if (customer.birthDate) {
            await createBirthdayReminder(input.customerId, input.agentId, new Date(customer.birthDate), customer.name);
          }
          // 배정일 기준 90일 장기 미관리 알림 예약
          await refreshLongUnmanagedReminder(input.customerId, input.agentId, new Date(), customer.name);
        }
        return { success: true };
      }),

    changeAgent: adminProcedure
      .input(z.object({ customerId: z.number(), newAgentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getCustomerById(input.customerId);
        const agent = await getUserById(input.newAgentId);
        const previousAgentId = existing?.agentId ?? undefined;
        await assignCustomer(input.customerId, input.newAgentId, agent?.teamId ?? undefined);
        // 배정 이력 기록
        await createAssignmentHistory({ customerId: input.customerId, previousAgentId, newAgentId: input.newAgentId, assignedBy: ctx.user.id });
        await log(ctx.user.id, "AGENT_CHANGED", "customer", input.customerId,
          JSON.stringify({ before: { agentId: previousAgentId }, after: { agentId: input.newAgentId } }));
        return { success: true };
      }),

    statusHistory: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => getStatusHistory(input.customerId)),

    consentLogs: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => getConsentLogs(input.customerId)),
  }),

  // ── Consultations ─────────────────────────────────────────────────────────
  consultations: router({
    list: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        // 조건 1: 고객 존재 여부 확인
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        // 조건 2: 역할별 소유권 검증 (activeUserProcedure만으로 데이터 접근 허용 금지)
        if (user.role === "admin") {
          // 지점장: 전체 허용
        } else if (user.role === "manager") {
          // 팀장: 본인 팀 고객만
          const agent = customer.agentId ? await getUserById(customer.agentId) : null;
          if (!agent || agent.teamId !== user.teamId)
            throw new TRPCError({ code: "FORBIDDEN", message: "본인 팀 고객만 조회 가능합니다." });
        } else {
          // 팀원: 본인 고객만
          if (customer.agentId !== user.id)
            throw new TRPCError({ code: "FORBIDDEN", message: "본인 고객만 조회 가능합니다." });
        }
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
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

        // 권한 검증
        const user = ctx.user;
        if (user.role === "agent" && customer.agentId !== user.id)
          throw new TRPCError({ code: "FORBIDDEN" });

        // 상태 변경 이력
        if (input.status !== customer.consultStatus) {
          await createStatusHistory({ customerId: input.customerId, changedBy: ctx.user.id, previousStatus: customer.consultStatus, newStatus: input.status });
        }

        const nextContactDate = input.nextContactAt ? new Date(input.nextContactAt) : undefined;
        await createConsultation({
          customerId: input.customerId,
          agentId: ctx.user.id,
          status: input.status,
          content: input.content,
          nextContactAt: nextContactDate,
        });

        // 재상담 알림
        if (nextContactDate) {
          await createReconsultReminder(input.customerId, ctx.user.id, nextContactDate, customer.name);
        }

        // 장기 미관리 90일 알림 갱신 (기존 알림 취소 + 새 상담일 기준 재예약)
        if (customer.agentId) {
          await refreshLongUnmanagedReminder(input.customerId, customer.agentId, new Date(), customer.name);
        }

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

        // 권한 검증: 본인이 작성한 상담기록만 수정 가능
        const user = ctx.user;
        if (user.role === "agent" && existing.agentId !== user.id)
          throw new TRPCError({ code: "FORBIDDEN" });

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

        // 상태 변경 이력
        if (input.status && input.status !== existing.status) {
          const customer = await getCustomerById(existing.customerId);
          if (customer) {
            await createStatusHistory({ customerId: existing.customerId, changedBy: ctx.user.id, previousStatus: existing.status, newStatus: input.status });
          }
        }

        // 재상담 알림 갱신
        if (input.nextContactAt) {
          const customer = await getCustomerById(existing.customerId);
          if (customer) {
            await createReconsultReminder(existing.customerId, existing.agentId, new Date(input.nextContactAt), customer.name);
          }
        }

        await log(ctx.user.id, "CONSULTATION_UPDATED", "consultation", input.id,
          JSON.stringify({ before: beforeSnapshot, after: afterSnapshot }));
        return { success: true };
      }),
  }),

  // ── Contracts ─────────────────────────────────────────────────────────────
  contracts: router({
    listByCustomer: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        // 조건 1: 고객 존재 여부 확인
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        // 조건 2: 역할별 소유권 검증 (activeUserProcedure만으로 데이터 접근 허용 금지)
        if (user.role === "admin") {
          // 지점장: 전체 허용
        } else if (user.role === "manager") {
          // 팀장: 본인 팀 고객만
          const agent = customer.agentId ? await getUserById(customer.agentId) : null;
          if (!agent || agent.teamId !== user.teamId)
            throw new TRPCError({ code: "FORBIDDEN", message: "본인 팀 고객만 조회 가능합니다." });
        } else {
          // 팀원: 본인 고객만
          if (customer.agentId !== user.id)
            throw new TRPCError({ code: "FORBIDDEN", message: "본인 고객만 조회 가능합니다." });
        }
        return getContractsByCustomer(input.customerId);
      }),

    list: activeUserProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (user.role === "admin") return getAllContracts({});
      if (user.role === "manager") return getAllContracts({ teamId: user.teamId ?? undefined });
      return getAllContracts({ agentId: user.id });
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
        // 팀장/관리자가 담당 설계사를 지정할 수 있음
        agentIdOverride: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const customer = await getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

        // 권한 검증
        if (user.role === "agent" && customer.agentId !== user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (user.role === "manager") {
          const agent = customer.agentId ? await getUserById(customer.agentId) : null;
          if (agent && agent.teamId !== user.teamId) throw new TRPCError({ code: "FORBIDDEN" });
        }

        // 담당 설계사 결정: 팀원=본인, 팀장=지정 팀원 또는 본인, 관리자=전체 지정 가능
        let finalAgentId = user.id;
        if (input.agentIdOverride && (user.role === "admin" || user.role === "manager")) {
          finalAgentId = input.agentIdOverride;
        }

        const { contractDate, agentIdOverride, ...rest } = input;
        const contractDateObj = contractDate ? new Date(contractDate) : undefined;
        await createContract({ ...rest, agentId: finalAgentId, contractDate: contractDateObj, createdBy: ctx.user.id });
        await log(ctx.user.id, "CONTRACT_CREATED", "customer", input.customerId);

        if (contractDateObj) {
          const allContracts = await getContractsByCustomer(input.customerId);
          const newContract = allContracts[0];
          if (newContract) {
            await createContractReminders(newContract.id, finalAgentId, contractDateObj, customer.name);
          }
        }
        return { success: true };
      }),

    contractHistory: activeUserProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => getContractHistory(input.contractId)),

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
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, contractDate, paymentStatus, ...rest } = input;
        const existing = await getContractById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        // contract_history 테이블에 변경 필드별 기록
        const fieldsToCheck: (keyof typeof rest)[] = ["company", "productName", "productGroup", "monthlyPremium", "contractStatus", "memo"];
        for (const field of fieldsToCheck) {
          if (rest[field] !== undefined && String((existing as any)[field] ?? "") !== String(rest[field] ?? "")) {
            await createContractHistoryEntry({ contractId: id, changedBy: ctx.user.id, fieldName: field, beforeValue: String((existing as any)[field] ?? ""), afterValue: String(rest[field] ?? "") });
          }
        }
        if (paymentStatus && paymentStatus !== existing.paymentStatus) {
          await createContractHistoryEntry({ contractId: id, changedBy: ctx.user.id, fieldName: "paymentStatus", beforeValue: existing.paymentStatus ?? "", afterValue: paymentStatus });
        }
        if (contractDate && existing.contractDate && new Date(contractDate).toDateString() !== new Date(existing.contractDate).toDateString()) {
          await createContractHistoryEntry({ contractId: id, changedBy: ctx.user.id, fieldName: "contractDate", beforeValue: String(existing.contractDate), afterValue: contractDate });
        }

        await updateContract(id, { ...rest, paymentStatus, contractDate: contractDate ? new Date(contractDate) : undefined });
        await log(ctx.user.id, "CONTRACT_UPDATED", "contract", id, JSON.stringify({ paymentStatus, ...rest }));

        // 납입상태 변경 시 알림
        if (paymentStatus && existing && paymentStatus !== existing.paymentStatus) {
          const customer = existing.customerId ? await getCustomerById(existing.customerId) : null;
          if (customer) {
            await createPaymentStatusReminder(id, ctx.user.id, paymentStatus, customer.name);
          }
        }
        return { success: true };
      }),
  }),

  // ── Schedules ─────────────────────────────────────────────────────────────
  schedules: router({
    list: activeUserProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (user.role === "admin") return getSchedules({});
      if (user.role === "manager") return getSchedules({ teamId: user.teamId ?? undefined });
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
        if (input.targetUserId && (user.role === "admin" || user.role === "manager")) {
          targetUserId = input.targetUserId;
        }
        const startTimeDate = new Date(input.startTime);
        const endTimeDate = input.endTime ? new Date(input.endTime) : undefined;

        await createSchedule({
          userId: targetUserId,
          title: input.title,
          type: input.type,
          status: input.status,
          startTime: startTimeDate,
          endTime: endTimeDate,
          memo: input.memo,
          description: input.description,
          reminderDayBefore: input.reminderDayBefore,
          reminderSameDay: input.reminderSameDay,
          reminderOneHourBefore: input.reminderOneHourBefore,
          createdBy: ctx.user.id,
        });
        await log(ctx.user.id, "SCHEDULE_CREATED", "schedule", undefined, `title=${input.title}`);

        // 일정 알림 자동 생성
        const allSchedules = await getSchedules({ userId: targetUserId });
        const newSchedule = allSchedules.find((s) => s.title === input.title && s.startTime.getTime() === startTimeDate.getTime());
        if (newSchedule) {
          await createScheduleReminders(newSchedule.id, targetUserId, startTimeDate, input.title, input.reminderDayBefore, input.reminderSameDay, input.reminderOneHourBefore);
          // 미완료 일정 알림 예약 (endTime 기준)
          if (endTimeDate) {
            await createScheduleIncompleteReminder(newSchedule.id, targetUserId, endTimeDate, input.title);
          }
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
        const existing = await getSchedules({ userId: ctx.user.id }).then((list) => list.find((s) => s.id === id));
        const actionLabel = status === "취소" ? "SCHEDULE_CANCELLED" : status === "완료" ? "SCHEDULE_COMPLETED" : "SCHEDULE_UPDATED";

        if (status === "완료") {
          await completeSchedule(id);
          // 미완료 일정 알림 취소
          if (existing) await cancelScheduleIncompleteNotification(existing.userId, id);
        } else if (status === "취소" || status === "노쇼") {
          await updateSchedule(id, { status, startTime: startTime ? new Date(startTime) : undefined, endTime: endTime ? new Date(endTime) : undefined, ...rest });
          // 미완료 일정 알림 취소
          if (existing) await cancelScheduleIncompleteNotification(existing.userId, id);
        } else {
          await updateSchedule(id, { status, startTime: startTime ? new Date(startTime) : undefined, endTime: endTime ? new Date(endTime) : undefined, ...rest });
        }
        await log(ctx.user.id, actionLabel, "schedule", id);
        return { success: true };
      }),

    delete: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getSchedules({ userId: ctx.user.id }).then((list) => list.find((s) => s.id === input.id));
        await softDeleteSchedule(input.id);
        if (existing) await cancelScheduleIncompleteNotification(existing.userId, input.id);
        await log(ctx.user.id, "SCHEDULE_CANCELLED", "schedule", input.id);
        return { success: true };
      }),
  }),

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: router({
    list: activeUserProcedure.query(async ({ ctx }) => getNotifications(ctx.user.id)),
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
  // ── Performance ───────────────────────────────────────────────────────────────
  performance: router({
    stats: activeUserProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        agentIdFilter: z.number().optional(),
        teamIdFilter: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo = input?.dateTo ? new Date(input.dateTo) : undefined;
        if (user.role === "admin") {
          return getPerformanceStats({ agentId: input?.agentIdFilter, teamId: input?.teamIdFilter, dateFrom, dateTo });
        }
        if (user.role === "manager") {
          return getPerformanceStats({ teamId: user.teamId ?? undefined, agentId: input?.agentIdFilter, dateFrom, dateTo });
        }
        return getPerformanceStats({ agentId: user.id, dateFrom, dateTo });
      }),
    agentStats: managerOrAdminProcedure
      .input(z.object({ agentId: z.number(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ input }) => getPerformanceStats({
        agentId: input.agentId,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
      })),
  }),

  // ── Activity Logs ───────────────────────────────────────────────────────────────
  logs: router({
    list: managerOrAdminProcedure.query(async ({ ctx }) => {
      const all = await getActivityLogs(500);
      if (ctx.user.role === "admin") return all;
      // 팀장: 본인 팀원 userId 기준 필터
      const teamMembers = await getAllUsers().then((users) =>
        users.filter((u) => u.teamId === ctx.user.teamId).map((u) => u.id)
      );
      return all.filter((log) => teamMembers.includes(log.userId));
    }),
  }),
});

export type AppRouter = typeof appRouter;
