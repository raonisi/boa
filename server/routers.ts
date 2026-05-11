import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  assignCustomer,
  createActivityLog,
  createConsentLog,
  createConsultation,
  createContract,
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
  getConsentLogs,
  getConsultationsByCustomer,
  getContractById,
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
  updateContract,
  updateCustomer,
  updateSchedule,
  updateUserRole,
  updateUserTeam,
} from "./db";
import {
  createBirthdayReminder,
  createContractReminders,
  createPaymentStatusReminder,
  createReconsultReminder,
  createScheduleReminders,
  createUncontactedReminder,
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
        const target = await getUserById(input.userId);
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
        // 고객 조회 로그
        await log(ctx.user.id, "CUSTOMER_VIEWED", "customer", input.id);
        return customer;
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

        // 상태 변경 이력 기록
        if (consultStatus && consultStatus !== existing.consultStatus) {
          await createStatusHistory({
            customerId: id,
            changedBy: ctx.user.id,
            previousStatus: existing.consultStatus,
            newStatus: consultStatus,
          });
        }

        // 동의 변경 이력 기록
        if (privacyConsent !== undefined && privacyConsent !== existing.privacyConsent) {
          await createConsentLog({
            customerId: id,
            changedBy: ctx.user.id,
            consentType: "privacy",
            previousValue: existing.privacyConsent ?? false,
            newValue: privacyConsent,
          });
        }
        if (marketingConsent !== undefined && marketingConsent !== existing.marketingConsent) {
          await createConsentLog({
            customerId: id,
            changedBy: ctx.user.id,
            consentType: "marketing",
            previousValue: existing.marketingConsent ?? false,
            newValue: marketingConsent,
          });
        }

        await updateCustomer(id, {
          ...rest,
          consultStatus,
          privacyConsent,
          marketingConsent,
          birthDate: birthDate ? new Date(birthDate) : undefined,
        });
        await log(ctx.user.id, "CUSTOMER_UPDATED", "customer", id);
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

    assign: adminProcedure
      .input(z.object({ customerId: z.number(), agentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const agent = await getUserById(input.agentId);
        const customer = await getCustomerById(input.customerId);
        await assignCustomer(input.customerId, input.agentId, agent?.teamId ?? undefined);
        await log(ctx.user.id, "CUSTOMER_ASSIGNED", "customer", input.customerId, `agentId=${input.agentId}`);

        if (agent && customer) {
          // 배정 알림
          await createNotification({
            userId: input.agentId,
            type: "customer_assigned",
            title: "새 고객 배정",
            message: `${customer.name} 고객이 배정되었습니다.`,
            relatedType: "customer",
            relatedId: input.customerId,
            dueAt: new Date(),
          });
          // 배정 3일 미상담 알림 예약
          await createUncontactedReminder(input.customerId, input.agentId, new Date(), customer.name);
          // 생일 알림 예약
          if (customer.birthDate) {
            await createBirthdayReminder(input.customerId, input.agentId, new Date(customer.birthDate), customer.name);
          }
        }
        return { success: true };
      }),

    changeAgent: adminProcedure
      .input(z.object({ customerId: z.number(), newAgentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const agent = await getUserById(input.newAgentId);
        await assignCustomer(input.customerId, input.newAgentId, agent?.teamId ?? undefined);
        await log(ctx.user.id, "AGENT_CHANGED", "customer", input.customerId, `newAgentId=${input.newAgentId}`);
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
      .query(async ({ input }) => getConsultationsByCustomer(input.customerId)),

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

        // 상태 변경 이력
        if (input.status !== customer.consultStatus) {
          await createStatusHistory({
            customerId: input.customerId,
            changedBy: ctx.user.id,
            previousStatus: customer.consultStatus,
            newStatus: input.status,
          });
        }

        const nextContactDate = input.nextContactAt ? new Date(input.nextContactAt) : undefined;
        await createConsultation({
          customerId: input.customerId,
          agentId: ctx.user.id,
          status: input.status,
          content: input.content,
          nextContactAt: nextContactDate,
        });

        // 재상담 알림 생성
        if (nextContactDate) {
          await createReconsultReminder(input.customerId, ctx.user.id, nextContactDate, customer.name);
        }

        await log(ctx.user.id, "CONSULTATION_CREATED", "customer", input.customerId, `status=${input.status}`);
        return { success: true };
      }),
  }),

  // ── Contracts ─────────────────────────────────────────────────────────────
  contracts: router({
    listByCustomer: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => getContractsByCustomer(input.customerId)),

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
      }))
      .mutation(async ({ ctx, input }) => {
        const { contractDate, ...rest } = input;
        const contractDateObj = contractDate ? new Date(contractDate) : undefined;
        await createContract({
          ...rest,
          agentId: ctx.user.id,
          contractDate: contractDateObj,
          createdBy: ctx.user.id,
        });
        await log(ctx.user.id, "CONTRACT_CREATED", "customer", input.customerId);

        // 계약 생성 시 알림 자동 생성
        if (contractDateObj) {
          const customer = await getCustomerById(input.customerId);
          if (customer) {
            // 임시 ID로 알림 생성 (실제로는 insert 후 ID를 가져와야 하지만 단순화)
            const allContracts = await getContractsByCustomer(input.customerId);
            const newContract = allContracts[0]; // 가장 최신
            if (newContract) {
              await createContractReminders(newContract.id, ctx.user.id, contractDateObj, customer.name);
            }
          }
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
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, contractDate, paymentStatus, ...rest } = input;
        const existing = await getContractById(id);

        await updateContract(id, {
          ...rest,
          paymentStatus,
          contractDate: contractDate ? new Date(contractDate) : undefined,
        });
        await log(ctx.user.id, "CONTRACT_UPDATED", "contract", id);

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
        await createSchedule({
          userId: targetUserId,
          title: input.title,
          type: input.type,
          status: input.status,
          startTime: startTimeDate,
          endTime: input.endTime ? new Date(input.endTime) : undefined,
          memo: input.memo,
          description: input.description,
          reminderDayBefore: input.reminderDayBefore,
          reminderSameDay: input.reminderSameDay,
          reminderOneHourBefore: input.reminderOneHourBefore,
          createdBy: ctx.user.id,
        });
        await log(ctx.user.id, "SCHEDULE_CREATED", "schedule", undefined, `title=${input.title}`);

        // 일정 알림 자동 생성 (임시 ID 사용)
        const allSchedules = await getSchedules({ userId: targetUserId });
        const newSchedule = allSchedules.find((s) => s.title === input.title && s.startTime.getTime() === startTimeDate.getTime());
        if (newSchedule) {
          await createScheduleReminders(
            newSchedule.id, targetUserId, startTimeDate, input.title,
            input.reminderDayBefore, input.reminderSameDay, input.reminderOneHourBefore
          );
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
        const actionLabel = status === "취소" ? "SCHEDULE_CANCELLED" : status === "완료" ? "SCHEDULE_COMPLETED" : "SCHEDULE_UPDATED";

        if (status === "완료") {
          await completeSchedule(id);
        } else {
          await updateSchedule(id, {
            ...rest,
            status,
            startTime: startTime ? new Date(startTime) : undefined,
            endTime: endTime ? new Date(endTime) : undefined,
          });
        }
        await log(ctx.user.id, actionLabel, "schedule", id);
        return { success: true };
      }),

    delete: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await softDeleteSchedule(input.id);
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
  }),

  // ── Performance ───────────────────────────────────────────────────────────
  performance: router({
    stats: activeUserProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (user.role === "admin") return getPerformanceStats({});
      if (user.role === "manager") return getPerformanceStats({ teamId: user.teamId ?? undefined });
      return getPerformanceStats({ agentId: user.id });
    }),
    agentStats: managerOrAdminProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => getPerformanceStats({ agentId: input.agentId })),
  }),

  // ── Activity Logs ─────────────────────────────────────────────────────────
  logs: router({
    list: adminProcedure.query(async () => getActivityLogs(200)),
  }),
});

export type AppRouter = typeof appRouter;
