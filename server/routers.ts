import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  assignCustomer,
  createActivityLog,
  createConsultation,
  createContract,
  createCustomer,
  createNotification,
  createSchedule,
  createTeam,
  deleteSchedule,
  getActivityLogs,
  getAllContracts,
  getAllTeams,
  getAllUsers,
  getConsultationsByCustomer,
  getContractsByCustomer,
  getCustomerById,
  getCustomers,
  getNotifications,
  getPerformanceStats,
  getSchedules,
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

// ─── Middleware helpers ───────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  return next({ ctx });
});

const managerOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "manager")
    throw new TRPCError({ code: "FORBIDDEN", message: "팀장 이상만 접근 가능합니다." });
  return next({ ctx });
});

const activeUserProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "inactive") throw new TRPCError({ code: "FORBIDDEN", message: "계정이 비활성화되었습니다." });
  return next({ ctx });
});

async function logActivity(
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
    // Admin: all users. Manager/Agent: only users in same team (for display purposes)
    list: activeUserProcedure.query(async ({ ctx }) => {
      const all = await getAllUsers();
      if (ctx.user.role === "admin") return all;
      // For non-admin, return only active users (for assignment dropdowns etc.)
      return all.filter((u) => u.role !== "inactive");
    }),

    updateRole: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["admin", "manager", "agent", "inactive"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateUserRole(input.userId, input.role);
        await logActivity(ctx.user.id, "USER_ROLE_CHANGED", "user", input.userId, `role=${input.role}`);
        return { success: true };
      }),

    updateTeam: adminProcedure
      .input(z.object({ userId: z.number(), teamId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await updateUserTeam(input.userId, input.teamId);
        await logActivity(ctx.user.id, "USER_TEAM_CHANGED", "user", input.userId, `teamId=${input.teamId}`);
        return { success: true };
      }),

    teams: protectedProcedure.query(async () => getAllTeams()),

    createTeam: adminProcedure
      .input(z.object({ name: z.string().min(1), managerId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        await createTeam(input.name, input.managerId);
        await logActivity(ctx.user.id, "TEAM_CREATED", "team", undefined, `name=${input.name}`);
        return { success: true };
      }),
  }),

  // ── Customers ─────────────────────────────────────────────────────────────
  customers: router({
    list: activeUserProcedure
      .input(
        z.object({
          status: z.string().optional(),
          unassigned: z.boolean().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (user.role === "admin") {
          return getCustomers({ status: input.status, unassigned: input.unassigned });
        } else if (user.role === "manager") {
          return getCustomers({ teamId: user.teamId ?? undefined, status: input.status });
        } else {
          return getCustomers({ agentId: user.id, status: input.status });
        }
      }),

    get: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const customer = await getCustomerById(input.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
        // Access control
        const user = ctx.user;
        if (user.role === "agent" && customer.agentId !== user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (user.role === "manager") {
          const agent = customer.agentId ? await getUserById(customer.agentId) : null;
          if (agent && agent.teamId !== user.teamId) throw new TRPCError({ code: "FORBIDDEN" });
        }
        return customer;
      }),

    create: adminProcedure
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
          privacyConsent: z.boolean().default(false),
          marketingConsent: z.boolean().default(false),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createCustomer({
          ...input,
          birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
          createdBy: ctx.user.id,
        });
        await logActivity(ctx.user.id, "CUSTOMER_CREATED", "customer", undefined, `name=${input.name}`);
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
          privacyConsent: z.boolean().optional(),
          marketingConsent: z.boolean().optional(),
          memo: z.string().optional(),
          consultStatus: z
            .enum(["미상담", "부재", "통화완료", "상담예정", "설계중", "계약", "보류", "거절", "해지관리", "재상담필요"])
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, birthDate, ...rest } = input;
        await updateCustomer(id, {
          ...rest,
          birthDate: birthDate ? new Date(birthDate) : undefined,
        });
        await logActivity(ctx.user.id, "CUSTOMER_UPDATED", "customer", id);
        return { success: true };
      }),

    assign: adminProcedure
      .input(z.object({ customerId: z.number(), agentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assignCustomer(input.customerId, input.agentId);
        await logActivity(
          ctx.user.id,
          "CUSTOMER_ASSIGNED",
          "customer",
          input.customerId,
          `agentId=${input.agentId}`
        );
        // Create notification for agent
        const agent = await getUserById(input.agentId);
        const customer = await getCustomerById(input.customerId);
        if (agent && customer) {
          await createNotification({
            userId: input.agentId,
            type: "uncontacted_3days",
            title: "새 고객 배정",
            message: `${customer.name} 고객이 배정되었습니다.`,
            relatedType: "customer",
            relatedId: input.customerId,
          });
        }
        return { success: true };
      }),
  }),

  // ── Consultations ─────────────────────────────────────────────────────────
  consultations: router({
    list: activeUserProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => getConsultationsByCustomer(input.customerId)),

    create: activeUserProcedure
      .input(
        z.object({
          customerId: z.number(),
          status: z.enum(["미상담", "부재", "통화완료", "상담예정", "설계중", "계약", "보류", "거절", "해지관리", "재상담필요"]),
          content: z.string().optional(),
          nextContactAt: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createConsultation({
          customerId: input.customerId,
          agentId: ctx.user.id,
          status: input.status,
          content: input.content,
          nextContactAt: input.nextContactAt ? new Date(input.nextContactAt) : undefined,
        });
        await logActivity(ctx.user.id, "CONSULTATION_CREATED", "customer", input.customerId, `status=${input.status}`);
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
      .input(
        z.object({
          customerId: z.number(),
          company: z.string().optional(),
          productName: z.string().optional(),
          productGroup: z.string().optional(),
          contractDate: z.string().optional(),
          monthlyPremium: z.number().optional(),
          paymentStatus: z.enum(["정상", "미납", "실효", "해지"]).default("정상"),
          contractStatus: z.enum(["청약", "성립", "철회", "유지", "해지"]).default("청약"),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { contractDate, ...rest } = input;
        await createContract({
          ...rest,
          agentId: ctx.user.id,
          contractDate: contractDate ? new Date(contractDate) : undefined,
        });
        await logActivity(ctx.user.id, "CONTRACT_CREATED", "customer", input.customerId);
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
          contractStatus: z.enum(["청약", "성립", "철회", "유지", "해지"]).optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, contractDate, ...rest } = input;
        await updateContract(id, {
          ...rest,
          contractDate: contractDate ? new Date(contractDate) : undefined,
        });
        await logActivity(ctx.user.id, "CONTRACT_UPDATED", "contract", id);
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
      .input(
        z.object({
          title: z.string().min(1),
          type: z.enum(["고객상담", "재통화", "계약예정", "보장분석", "해지방어", "팀회의", "교육", "외근", "휴무", "기타"]),
          status: z.enum(["예정", "완료", "취소", "변경", "노쇼", "보류"]).default("예정"),
          startTime: z.string(),
          endTime: z.string().optional(),
          memo: z.string().optional(),
          targetUserId: z.number().optional(), // for manager/admin to create for others
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        let targetUserId = user.id;
        if (input.targetUserId && (user.role === "admin" || user.role === "manager")) {
          targetUserId = input.targetUserId;
        }
        await createSchedule({
          userId: targetUserId,
          title: input.title,
          type: input.type,
          status: input.status,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : undefined,
          memo: input.memo,
        });
        await logActivity(ctx.user.id, "SCHEDULE_CREATED", "schedule", undefined, `title=${input.title}`);
        return { success: true };
      }),

    update: activeUserProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          type: z.enum(["고객상담", "재통화", "계약예정", "보장분석", "해지방어", "팀회의", "교육", "외근", "휴무", "기타"]).optional(),
          status: z.enum(["예정", "완료", "취소", "변경", "노쇼", "보류"]).optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, startTime, endTime, ...rest } = input;
        await updateSchedule(id, {
          ...rest,
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : undefined,
        });
        await logActivity(ctx.user.id, "SCHEDULE_UPDATED", "schedule", id);
        return { success: true };
      }),

    delete: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteSchedule(input.id);
        await logActivity(ctx.user.id, "SCHEDULE_DELETED", "schedule", input.id);
        return { success: true };
      }),
  }),

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: router({
    list: activeUserProcedure.query(async ({ ctx }) => getNotifications(ctx.user.id)),

    unreadCount: activeUserProcedure.query(async ({ ctx }) => getUnreadCount(ctx.user.id)),

    markRead: activeUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await markNotificationRead(input.id);
        return { success: true };
      }),

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
