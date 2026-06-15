import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ACTION_PLAN_STATUSES,
  isActionPlanEditable,
} from "@shared/actionPlans";
import {
  activeUserProcedure,
  branchAdminProcedure,
  teamLeaderOrAboveProcedure,
} from "./_core/procedures";
import { router } from "./_core/trpc";
import {
  createActivityLog,
  getAllUsers,
  getUserById,
} from "./db";
import { getHierarchyScopeUserIds } from "./routers";
import * as actionPlansDb from "./actionPlansDb";
import {
  assertNoSensitiveDailyPlanInput,
  assertNoSensitiveExecutiveInput,
  assertNoSensitiveMonthlyPlanInput,
  assertNoSensitiveWeeklyPlanInput,
  assertNoSensitiveActionPlanReportData,
  sanitizeActionPlanLogMetadata,
} from "./actionPlanSensitiveGuard";
import {
  buildExecutiveActionPlanXlsxBuffer,
  executiveReportFilename,
  type ExecutiveReportData,
} from "./executiveActionPlanReport";

type AppUser = {
  id: number;
  role: string;
  accountStatus: string;
  name?: string | null;
  teamId?: number | null;
  subBranchAdminId?: number | null;
};

const targetMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "YYYY-MM 형식이어야 합니다.");

const monthlyInputSchema = z.object({
  targetMonth: targetMonthSchema,
  monthlyContractTarget: z.number().int().min(0).default(0),
  monthlyPremiumTarget: z.number().int().min(0).default(0),
  monthlyConsultationTarget: z.number().int().min(0).default(0),
  monthlyCallTarget: z.number().int().min(0).default(0),
  monthlyMessageTarget: z.number().int().min(0).default(0),
  monthlyFollowUpTarget: z.number().int().min(0).default(0),
  focusCustomerGroup: z.string().max(2000).optional(),
  monthlyStrategy: z.string().max(5000).optional(),
  preparationMemo: z.string().max(5000).optional(),
  expectedRisk: z.string().max(3000).optional(),
  supportRequest: z.string().max(3000).optional(),
});

const weeklyInputSchema = z.object({
  monthlyPlanId: z.number().int().positive(),
  weekStartDate: z.string(),
  weekEndDate: z.string(),
  weekLabel: z.string().min(1).max(50),
  weeklyContractTarget: z.number().int().min(0).default(0),
  weeklyPremiumTarget: z.number().int().min(0).default(0),
  weeklyConsultationTarget: z.number().int().min(0).default(0),
  weeklyCallTarget: z.number().int().min(0).default(0),
  weeklyMessageTarget: z.number().int().min(0).default(0),
  weeklyVisitTarget: z.number().int().min(0).default(0),
  weeklyProposalTarget: z.number().int().min(0).default(0),
  weeklyFollowUpTarget: z.number().int().min(0).default(0),
  focusCustomerGroup: z.string().max(2000).optional(),
  weeklyActionPlan: z.string().max(5000).optional(),
  preparationMemo: z.string().max(5000).optional(),
  expectedRisk: z.string().max(3000).optional(),
  supportRequest: z.string().max(3000).optional(),
});

const dailyInputSchema = z.object({
  weeklyPlanId: z.number().int().positive(),
  planDate: z.string(),
  callTarget: z.number().int().min(0).default(0),
  messageTarget: z.number().int().min(0).default(0),
  consultationTarget: z.number().int().min(0).default(0),
  visitTarget: z.number().int().min(0).default(0),
  proposalTarget: z.number().int().min(0).default(0),
  followUpTarget: z.number().int().min(0).default(0),
  todayPriority: z.string().max(3000).optional(),
  preparationMemo: z.string().max(3000).optional(),
  actualCallCount: z.number().int().min(0).default(0),
  actualMessageCount: z.number().int().min(0).default(0),
  actualConsultationCount: z.number().int().min(0).default(0),
  actualVisitCount: z.number().int().min(0).default(0),
  actualProposalCount: z.number().int().min(0).default(0),
  actualFollowUpCount: z.number().int().min(0).default(0),
  actualResultMemo: z.string().max(5000).optional(),
  nextDayMemo: z.string().max(3000).optional(),
});

const reviewInputSchema = z.object({
  id: z.number().int().positive(),
  managerComment: z.string().max(5000).optional(),
});

const executivePreviewSchema = z.object({
  reportMonth: targetMonthSchema,
  reportWeekLabel: z.string().min(1).max(50),
  branchSummary: z.string().max(5000).optional(),
  branchStrategy: z.string().max(5000).optional(),
  keyRisks: z.string().max(3000).optional(),
  supportRequest: z.string().max(3000).optional(),
  executiveMessage: z.string().max(5000).optional(),
  monthlyDirection: z.string().max(5000).optional(),
  weeklyFocus: z.string().max(3000).optional(),
  growthMembers: z.string().max(2000).optional(),
  coachingMembers: z.string().max(2000).optional(),
  orgIssues: z.string().max(3000).optional(),
});

function assertActive(user: AppUser) {
  if (user.accountStatus !== "active")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "비활성 계정은 접근할 수 없습니다.",
    });
}

async function getScopedUserIds(actor: AppUser): Promise<number[]> {
  if (actor.role === "branch_admin") {
    const all = await getAllUsers();
    return all
      .filter(
        (u: any) =>
          u.accountStatus === "active" &&
          ["branch_admin", "sub_branch_admin", "team_leader", "member"].includes(
            u.role
          )
      )
      .map((u: any) => u.id);
  }
  const ids = await getHierarchyScopeUserIds(actor);
  return ids ?? [actor.id];
}

async function assertCanViewUser(actor: AppUser, targetUserId: number) {
  if (actor.id === targetUserId) return;
  if (actor.role === "member")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 계획만 조회할 수 있습니다.",
    });
  const scoped = await getScopedUserIds(actor);
  if (!scoped.includes(targetUserId))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "권한 범위 밖 사용자의 계획입니다.",
    });
}

async function assertCanReview(actor: AppUser, targetUserId: number) {
  if (actor.role === "member")
    throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다." });
  await assertCanViewUser(actor, targetUserId);
  if (actor.id === targetUserId && actor.role !== "branch_admin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 계획은 리뷰할 수 없습니다.",
    });
}

function assertCanEditPlan(actor: AppUser, plan: { userId: number; status: string }) {
  if (plan.userId !== actor.id)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 계획만 수정할 수 있습니다.",
    });
  if (!isActionPlanEditable(plan.status as any))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "제출된 계획은 수정할 수 없습니다. 수정 요청을 기다려 주세요.",
    });
}

async function logAction(
  userId: number,
  action: string,
  targetType: string,
  targetId?: number,
  metadata?: Record<string, unknown>
) {
  await createActivityLog({
    userId,
    action,
    targetType,
    targetId,
    details: metadata
      ? JSON.stringify(sanitizeActionPlanLogMetadata(metadata))
      : undefined,
  });
}

async function resolveVisibleUsers(actor: AppUser) {
  const scopedIds = await getScopedUserIds(actor);
  const all = await getAllUsers();
  return all
    .filter(
      (u: any) =>
        scopedIds.includes(u.id) &&
        u.accountStatus === "active" &&
        ["branch_admin", "sub_branch_admin", "team_leader", "member"].includes(
          u.role
        )
    )
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      teamId: u.teamId,
      subBranchAdminId: u.subBranchAdminId,
    }));
}

async function buildReportData(
  actor: AppUser,
  input: z.infer<typeof executivePreviewSchema>
): Promise<ExecutiveReportData> {
  const users = await resolveVisibleUsers(actor);
  const userIds = users.map(u => u.id);
  const monthlyPlans = await actionPlansDb.getBranchActionPlansByUserIds(
    userIds,
    input.reportMonth
  );
  const weeklyPlans = await actionPlansDb.getWeeklyPlansForMonthByUserIds(
    userIds,
    input.reportMonth
  );
  const weekFiltered = weeklyPlans.filter(
    p => p.weekLabel === input.reportWeekLabel
  );
  const dailyPlans = await actionPlansDb.getDailyPlansForWeeklyIds(
    weekFiltered.map(p => p.id)
  );

  return {
    input: {
      reportMonth: input.reportMonth,
      reportWeekLabel: input.reportWeekLabel,
      branchName: "BOA 지점",
      generatedByName: actor.name ?? "지점장",
      generatedAt: new Date(),
      branchSummary: input.branchSummary,
      branchStrategy: input.branchStrategy,
      keyRisks: input.keyRisks,
      supportRequest: input.supportRequest,
      executiveMessage: input.executiveMessage,
      monthlyDirection: input.monthlyDirection,
      weeklyFocus: input.weeklyFocus,
      growthMembers: input.growthMembers,
      coachingMembers: input.coachingMembers,
      orgIssues: input.orgIssues,
    },
    users,
    monthlyPlans,
    weeklyPlans: weekFiltered.length > 0 ? weekFiltered : weeklyPlans,
    dailyPlans,
  };
}

export const actionPlansRouter = router({
  getMyMonthlyPlans: activeUserProcedure.query(async ({ ctx }) => {
    assertActive(ctx.user);
    return actionPlansDb.getBranchActionPlansByUser(ctx.user.id);
  }),

  getMonthlyPlan: activeUserProcedure
    .input(
      z.object({
        userId: z.number().int().positive().optional(),
        targetMonth: targetMonthSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const userId = input.userId ?? ctx.user.id;
      await assertCanViewUser(ctx.user, userId);
      return actionPlansDb.getBranchActionPlanByUserMonth(
        userId,
        input.targetMonth
      );
    }),

  createMonthlyPlan: activeUserProcedure
    .input(monthlyInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      assertNoSensitiveMonthlyPlanInput(input);
      const existing = await actionPlansDb.getBranchActionPlanByUserMonth(
        ctx.user.id,
        input.targetMonth
      );
      if (existing)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "해당 월 계획이 이미 있습니다.",
        });
      const created = await actionPlansDb.createBranchActionPlan({
        userId: ctx.user.id,
        ...input,
        status: "draft",
      });
      await logAction(ctx.user.id, "ACTION_PLAN_CREATED", "branch_action_plan", created?.id, {
        planType: "monthly",
        targetMonth: input.targetMonth,
      });
      return created;
    }),

  updateMonthlyPlan: activeUserProcedure
    .input(monthlyInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getBranchActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      assertCanEditPlan(ctx.user, plan);
      assertNoSensitiveMonthlyPlanInput(input);
      const { id, ...data } = input;
      return actionPlansDb.updateBranchActionPlan(id, data);
    }),

  submitMonthlyPlan: activeUserProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getBranchActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (!isActionPlanEditable(plan.status as any))
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미 제출되었습니다." });
      const updated = await actionPlansDb.updateBranchActionPlan(input.id, {
        status: "submitted",
        submittedAt: new Date(),
      });
      await logAction(ctx.user.id, "ACTION_PLAN_SUBMITTED", "branch_action_plan", input.id, {
        planType: "monthly",
      });
      return updated;
    }),

  reviewMonthlyPlan: teamLeaderOrAboveProcedure
    .input(reviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getBranchActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanReview(ctx.user, plan.userId);
      assertNoSensitiveMonthlyPlanInput({
        managerComment: input.managerComment,
      });
      const updated = await actionPlansDb.updateBranchActionPlan(input.id, {
        status: "reviewed",
        managerComment: input.managerComment ?? plan.managerComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      });
      await logAction(ctx.user.id, "ACTION_PLAN_REVIEWED", "branch_action_plan", input.id, {
        planType: "monthly",
      });
      return updated;
    }),

  requestMonthlyRevision: teamLeaderOrAboveProcedure
    .input(reviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getBranchActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanReview(ctx.user, plan.userId);
      assertNoSensitiveMonthlyPlanInput({
        managerComment: input.managerComment,
      });
      const updated = await actionPlansDb.updateBranchActionPlan(input.id, {
        status: "revision_requested",
        managerComment: input.managerComment ?? plan.managerComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      });
      await logAction(
        ctx.user.id,
        "ACTION_PLAN_REVISION_REQUESTED",
        "branch_action_plan",
        input.id,
        { planType: "monthly" }
      );
      return updated;
    }),

  getWeeklyPlans: activeUserProcedure
    .input(
      z.object({
        monthlyPlanId: z.number().int().positive().optional(),
        userId: z.number().int().positive().optional(),
        targetMonth: targetMonthSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      assertActive(ctx.user);
      if (input.monthlyPlanId) {
        const monthly = await actionPlansDb.getBranchActionPlanById(
          input.monthlyPlanId
        );
        if (!monthly) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCanViewUser(ctx.user, monthly.userId);
        return actionPlansDb.getWeeklyActionPlansByMonthlyPlanId(
          input.monthlyPlanId
        );
      }
      const userId = input.userId ?? ctx.user.id;
      await assertCanViewUser(ctx.user, userId);
      if (!input.targetMonth)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "targetMonth가 필요합니다.",
        });
      const monthly = await actionPlansDb.getBranchActionPlanByUserMonth(
        userId,
        input.targetMonth
      );
      if (!monthly) return [];
      return actionPlansDb.getWeeklyActionPlansByMonthlyPlanId(monthly.id);
    }),

  createWeeklyPlan: activeUserProcedure
    .input(weeklyInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const monthly = await actionPlansDb.getBranchActionPlanById(
        input.monthlyPlanId
      );
      if (!monthly) throw new TRPCError({ code: "NOT_FOUND" });
      if (monthly.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      assertNoSensitiveWeeklyPlanInput(input);
      const created = await actionPlansDb.createWeeklyActionPlan({
        ...input,
        userId: ctx.user.id,
        weekStartDate: new Date(input.weekStartDate),
        weekEndDate: new Date(input.weekEndDate),
        status: "draft",
      });
      await logAction(ctx.user.id, "ACTION_PLAN_CREATED", "weekly_action_plan", created?.id, {
        planType: "weekly",
      });
      return created;
    }),

  updateWeeklyPlan: activeUserProcedure
    .input(weeklyInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getWeeklyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      assertCanEditPlan(ctx.user, plan);
      assertNoSensitiveWeeklyPlanInput(input);
      const { id, monthlyPlanId: _m, ...data } = input;
      return actionPlansDb.updateWeeklyActionPlan(id, {
        ...data,
        weekStartDate: new Date(data.weekStartDate),
        weekEndDate: new Date(data.weekEndDate),
      });
    }),

  submitWeeklyPlan: activeUserProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getWeeklyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (!isActionPlanEditable(plan.status as any))
        throw new TRPCError({ code: "BAD_REQUEST" });
      const updated = await actionPlansDb.updateWeeklyActionPlan(input.id, {
        status: "submitted",
        submittedAt: new Date(),
      });
      await logAction(ctx.user.id, "ACTION_PLAN_SUBMITTED", "weekly_action_plan", input.id, {
        planType: "weekly",
      });
      return updated;
    }),

  reviewWeeklyPlan: teamLeaderOrAboveProcedure
    .input(reviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getWeeklyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanReview(ctx.user, plan.userId);
      assertNoSensitiveWeeklyPlanInput({
        managerComment: input.managerComment,
      });
      const updated = await actionPlansDb.updateWeeklyActionPlan(input.id, {
        status: "reviewed",
        managerComment: input.managerComment ?? plan.managerComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      });
      await logAction(ctx.user.id, "ACTION_PLAN_REVIEWED", "weekly_action_plan", input.id, {
        planType: "weekly",
      });
      return updated;
    }),

  requestWeeklyRevision: teamLeaderOrAboveProcedure
    .input(reviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getWeeklyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanReview(ctx.user, plan.userId);
      assertNoSensitiveWeeklyPlanInput({
        managerComment: input.managerComment,
      });
      const updated = await actionPlansDb.updateWeeklyActionPlan(input.id, {
        status: "revision_requested",
        managerComment: input.managerComment ?? plan.managerComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      });
      await logAction(
        ctx.user.id,
        "ACTION_PLAN_REVISION_REQUESTED",
        "weekly_action_plan",
        input.id,
        { planType: "weekly" }
      );
      return updated;
    }),

  getDailyPlans: activeUserProcedure
    .input(
      z.object({
        weeklyPlanId: z.number().int().positive().optional(),
        userId: z.number().int().positive().optional(),
        planDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      assertActive(ctx.user);
      if (input.weeklyPlanId) {
        const weekly = await actionPlansDb.getWeeklyActionPlanById(
          input.weeklyPlanId
        );
        if (!weekly) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCanViewUser(ctx.user, weekly.userId);
        const plans = await actionPlansDb.getDailyActionPlansByWeeklyPlanId(
          input.weeklyPlanId
        );
        if (input.planDate)
          return plans.filter(
            p => String(p.planDate).slice(0, 10) === input.planDate
          );
        return plans;
      }
      const userId = input.userId ?? ctx.user.id;
      await assertCanViewUser(ctx.user, userId);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "weeklyPlanId가 필요합니다.",
      });
    }),

  createDailyPlan: activeUserProcedure
    .input(dailyInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const weekly = await actionPlansDb.getWeeklyActionPlanById(
        input.weeklyPlanId
      );
      if (!weekly) throw new TRPCError({ code: "NOT_FOUND" });
      if (weekly.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      assertNoSensitiveDailyPlanInput(input);
      const created = await actionPlansDb.createDailyActionPlan({
        ...input,
        userId: ctx.user.id,
        planDate: new Date(input.planDate),
        status: "draft",
      });
      await logAction(ctx.user.id, "ACTION_PLAN_CREATED", "daily_action_plan", created?.id, {
        planType: "daily",
      });
      return created;
    }),

  updateDailyPlan: activeUserProcedure
    .input(dailyInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getDailyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      assertCanEditPlan(ctx.user, plan);
      assertNoSensitiveDailyPlanInput(input);
      const { id, weeklyPlanId: _w, ...data } = input;
      return actionPlansDb.updateDailyActionPlan(id, {
        ...data,
        planDate: new Date(data.planDate),
      });
    }),

  submitDailyPlan: activeUserProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getDailyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (!isActionPlanEditable(plan.status as any))
        throw new TRPCError({ code: "BAD_REQUEST" });
      const updated = await actionPlansDb.updateDailyActionPlan(input.id, {
        status: "submitted",
        submittedAt: new Date(),
      });
      await logAction(ctx.user.id, "ACTION_PLAN_SUBMITTED", "daily_action_plan", input.id, {
        planType: "daily",
      });
      return updated;
    }),

  reviewDailyPlan: teamLeaderOrAboveProcedure
    .input(reviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getDailyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanReview(ctx.user, plan.userId);
      assertNoSensitiveDailyPlanInput({
        managerComment: input.managerComment,
      });
      const updated = await actionPlansDb.updateDailyActionPlan(input.id, {
        status: "reviewed",
        managerComment: input.managerComment ?? plan.managerComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      });
      await logAction(ctx.user.id, "ACTION_PLAN_REVIEWED", "daily_action_plan", input.id, {
        planType: "daily",
      });
      return updated;
    }),

  requestDailyRevision: teamLeaderOrAboveProcedure
    .input(reviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const plan = await actionPlansDb.getDailyActionPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanReview(ctx.user, plan.userId);
      assertNoSensitiveDailyPlanInput({
        managerComment: input.managerComment,
      });
      const updated = await actionPlansDb.updateDailyActionPlan(input.id, {
        status: "revision_requested",
        managerComment: input.managerComment ?? plan.managerComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      });
      await logAction(
        ctx.user.id,
        "ACTION_PLAN_REVISION_REQUESTED",
        "daily_action_plan",
        input.id,
        { planType: "daily" }
      );
      return updated;
    }),

  getTeamPlanSummary: teamLeaderOrAboveProcedure
    .input(
      z.object({
        targetMonth: targetMonthSchema,
        weekLabel: z.string().optional(),
        status: z.enum(ACTION_PLAN_STATUSES).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const users = await resolveVisibleUsers(ctx.user);
      const userIds = users.map(u => u.id);
      const monthlyPlans = await actionPlansDb.getBranchActionPlansByUserIds(
        userIds,
        input.targetMonth
      );
      const weeklyAll = await actionPlansDb.getWeeklyPlansForMonthByUserIds(
        userIds,
        input.targetMonth
      );
      const weeklyPlans = input.weekLabel
        ? weeklyAll.filter(p => p.weekLabel === input.weekLabel)
        : weeklyAll;

      return users.map(user => {
        const monthly = monthlyPlans.find(p => p.userId === user.id);
        const weekly = weeklyPlans.filter(p => p.userId === user.id);
        const monthlyStatus = monthly?.status ?? "draft";
        const matchesStatus =
          !input.status ||
          monthlyStatus === input.status ||
          weekly.some(w => w.status === input.status);
        if (!matchesStatus && input.status) return null;
        return {
          user,
          monthly: monthly ?? null,
          weekly,
        };
      }).filter(Boolean);
    }),

  getSubmissionStatus: teamLeaderOrAboveProcedure
    .input(
      z.object({
        targetMonth: targetMonthSchema,
        weekLabel: z.string().optional(),
        todayDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      assertActive(ctx.user);
      const users = await resolveVisibleUsers(ctx.user);
      const userIds = users.map(u => u.id);
      const monthlyPlans = await actionPlansDb.getBranchActionPlansByUserIds(
        userIds,
        input.targetMonth
      );
      const weeklyAll = await actionPlansDb.getWeeklyPlansForMonthByUserIds(
        userIds,
        input.targetMonth
      );
      const weekPlans = input.weekLabel
        ? weeklyAll.filter(p => p.weekLabel === input.weekLabel)
        : weeklyAll;
      const dailyAll = await actionPlansDb.getDailyPlansForWeeklyIds(
        weekPlans.map(p => p.id)
      );
      const today = input.todayDate ?? new Date().toISOString().slice(0, 10);
      const todayDaily = dailyAll.filter(
        p => String(p.planDate).slice(0, 10) === today
      );

      const submittedMonthly = monthlyPlans.filter(
        p =>
          p.status === "submitted" ||
          p.status === "reviewed" ||
          p.status === "revision_requested"
      ).length;
      const submittedWeekly = weekPlans.filter(
        p =>
          p.status === "submitted" ||
          p.status === "reviewed" ||
          p.status === "revision_requested"
      ).length;
      const submittedDailyToday = todayDaily.filter(
        p =>
          p.status === "submitted" ||
          p.status === "reviewed" ||
          p.status === "revision_requested"
      ).length;

      const notSubmitted = users
        .filter(u => {
          const m = monthlyPlans.find(p => p.userId === u.id);
          return (
            !m ||
            m.status === "draft" ||
            (m.status !== "submitted" &&
              m.status !== "reviewed" &&
              m.status !== "revision_requested")
          );
        })
        .map(u => ({ id: u.id, name: u.name, role: u.role }));

      const revisionRequested = monthlyPlans
        .filter(p => p.status === "revision_requested")
        .map(p => {
          const u = users.find(x => x.id === p.userId);
          return { id: p.userId, name: u?.name, role: u?.role, planId: p.id };
        });

      const pendingReview = monthlyPlans
        .filter(p => p.status === "submitted")
        .map(p => {
          const u = users.find(x => x.id === p.userId);
          return { id: p.userId, name: u?.name, role: u?.role, planId: p.id };
        });

      return {
        totals: {
          users: users.length,
          monthlySubmittedRate:
            users.length > 0
              ? Math.round((submittedMonthly / users.length) * 100)
              : 0,
          weeklySubmittedRate:
            users.length > 0
              ? Math.round((submittedWeekly / users.length) * 100)
              : 0,
          dailySubmittedRateToday:
            users.length > 0
              ? Math.round((submittedDailyToday / users.length) * 100)
              : 0,
        },
        notSubmitted,
        revisionRequested,
        pendingReview,
      };
    }),

  getExecutiveReportPreview: branchAdminProcedure
    .input(executivePreviewSchema)
    .query(async ({ ctx, input }) => {
      assertNoSensitiveExecutiveInput(input);
      const data = await buildReportData(ctx.user, input);
      return {
        reportMonth: input.reportMonth,
        reportWeekLabel: input.reportWeekLabel,
        userCount: data.users.length,
        monthlyPlanCount: data.monthlyPlans.length,
        weeklyPlanCount: data.weeklyPlans.length,
        dailyPlanCount: data.dailyPlans.length,
        branchSummary: input.branchSummary,
        branchStrategy: input.branchStrategy,
        keyRisks: input.keyRisks,
        supportRequest: input.supportRequest,
        executiveMessage: input.executiveMessage,
      };
    }),

  downloadExecutiveReportXlsx: branchAdminProcedure
    .input(
      executivePreviewSchema.extend({
        downloadReason: z.string().min(5).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertNoSensitiveExecutiveInput(input);
      const data = await buildReportData(ctx.user, input);
      assertNoSensitiveActionPlanReportData({
        monthlyPlans: data.monthlyPlans as unknown as Record<string, unknown>[],
        weeklyPlans: data.weeklyPlans as unknown as Record<string, unknown>[],
        dailyPlans: data.dailyPlans as unknown as Record<string, unknown>[],
        executive: input,
      });
      const buffer = buildExecutiveActionPlanXlsxBuffer(data);
      const filename = executiveReportFilename(
        input.reportMonth,
        input.reportWeekLabel
      );
      const report = await actionPlansDb.createExecutiveActionPlanReport({
        reportMonth: input.reportMonth,
        reportWeekLabel: input.reportWeekLabel,
        generatedBy: ctx.user.id,
        reportTitle: filename,
        branchSummary: input.branchSummary,
        branchStrategy: input.branchStrategy,
        keyRisks: input.keyRisks,
        supportRequest: input.supportRequest,
        executiveMessage: input.executiveMessage,
        downloadReason: input.downloadReason,
      });
      await logAction(
        ctx.user.id,
        "EXECUTIVE_ACTION_PLAN_REPORT_DOWNLOADED",
        "executive_action_plan_report",
        report?.id,
        {
          reportMonth: input.reportMonth,
          reportWeekLabel: input.reportWeekLabel,
          generatedBy: ctx.user.id,
          status: "downloaded",
          userCount: data.users.length,
        }
      );
      return {
        filename,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        contentBase64: buffer.toString("base64"),
        reportId: report?.id,
      };
    }),
});
