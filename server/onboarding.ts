import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { activeUserProcedure, branchAdminProcedure, managerAnalyticsProcedure, teamLeaderOrAboveProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import {
  createActivityLog,
  createOnboardingAssignment,
  createOnboardingItemProgressRows,
  createOnboardingTemplate,
  ensureDefaultOnboardingTemplates,
  getOnboardingAssignmentById,
  getOnboardingAssignments,
  getOnboardingItemProgressByAssignment,
  getOnboardingItemProgressById,
  getOnboardingTemplateById,
  getOnboardingTemplateItems,
  getOnboardingTemplates,
  getUserById,
  updateOnboardingAssignment,
  updateOnboardingItemProgress,
  updateOnboardingTemplate,
  upsertOnboardingTemplateItem,
} from "./db";
import { getHierarchyScopeUserIds } from "./routers";

const ROLE_VALUES = ["branch_admin", "sub_branch_admin", "team_leader", "member"] as const;

const templateItemInputSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100),
  required: z.boolean().default(true),
  requiresManagerApproval: z.boolean().default(false),
  practiceRequired: z.boolean().default(false),
  relatedMenu: z.string().max(200).optional(),
  completionCriteria: z.string().max(1000).optional(),
  estimatedMinutes: z.number().int().min(1).max(480).default(10),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
});

type AppUser = { id: number; role: string; accountStatus: string; teamId?: number | null; subBranchAdminId?: number | null };

function assertActiveRole(user: { role: string; accountStatus: string }) {
  if (user.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "비활성 계정은 접근할 수 없습니다." });
}

async function assertCanManageTarget(actor: AppUser, targetUserId: number) {
  const target = await getUserById(targetUserId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "대상 사용자를 찾을 수 없습니다." });
  if (target.accountStatus !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "inactive/resigned 사용자는 신규 배정할 수 없습니다." });

  if (actor.role === "branch_admin") return target;
  if (actor.role === "sub_branch_admin") {
    const ids = await getHierarchyScopeUserIds(actor);
    if (!ids || !ids.includes(targetUserId)) throw new TRPCError({ code: "FORBIDDEN", message: "산하 직원에게만 배정할 수 있습니다." });
    return target;
  }
  if (actor.role === "team_leader") {
    const ids = await getHierarchyScopeUserIds(actor);
    if (!ids || !ids.includes(targetUserId) || target.role !== "member") throw new TRPCError({ code: "FORBIDDEN", message: "산하 팀원에게만 배정할 수 있습니다." });
    return target;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "권한이 없습니다." });
}

async function assertCanReadAssignment(actor: AppUser, assignment: { targetUserId: number }) {
  if (actor.role === "branch_admin") return;
  if (actor.role === "member") {
    if (assignment.targetUserId !== actor.id) throw new TRPCError({ code: "FORBIDDEN" });
    return;
  }
  const ids = await getHierarchyScopeUserIds(actor);
  if (ids && !ids.includes(assignment.targetUserId)) throw new TRPCError({ code: "FORBIDDEN" });
}

async function recalcAssignmentProgress(assignmentId: number) {
  const assignment = await getOnboardingAssignmentById(assignmentId);
  if (!assignment) return;
  const items = await getOnboardingTemplateItems(assignment.templateId);
  const progress = await getOnboardingItemProgressByAssignment(assignmentId);
  const byItemId = new Map(progress.map((item) => [item.itemId, item]));

  let completed = 0;
  let requiredPending = 0;
  let approvalPending = 0;
  for (const item of items) {
    const p = byItemId.get(item.id);
    const done = p?.status === "approved" || p?.status === "skipped";
    if (done) completed += 1;
    if (item.required && !done) requiredPending += 1;
    if (p?.status === "needs_approval") approvalPending += 1;
  }
  const progressPercent = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
  const now = new Date();
  const isOverdue = (assignment.dueAt?.getTime?.() ?? new Date(assignment.dueAt).getTime()) < now.getTime() && requiredPending > 0;
  const status = requiredPending === 0 ? "completed" : isOverdue ? "overdue" : progressPercent > 0 ? "in_progress" : "assigned";

  await updateOnboardingAssignment(assignmentId, {
    progressPercent,
    requiredPendingCount: requiredPending,
    approvalPendingCount: approvalPending,
    status: status as any,
    completedAt: status === "completed" ? now : null,
  });
}

async function buildAssignmentDetails(assignmentId: number) {
  const assignment = await getOnboardingAssignmentById(assignmentId);
  if (!assignment) return null;
  const template = await getOnboardingTemplateById(assignment.templateId);
  if (!template) return null;
  const [targetUser, trainer, assigner, items, progressRows] = await Promise.all([
    getUserById(assignment.targetUserId),
    assignment.trainerUserId ? getUserById(assignment.trainerUserId) : Promise.resolve(undefined),
    getUserById(assignment.assignedBy),
    getOnboardingTemplateItems(assignment.templateId),
    getOnboardingItemProgressByAssignment(assignmentId),
  ]);

  const progressByItem = new Map(progressRows.map((row) => [row.itemId, row]));
  return {
    ...assignment,
    template: { id: template.id, name: template.name, targetRole: template.targetRole },
    targetUser: targetUser ? { id: targetUser.id, name: targetUser.name, role: targetUser.role, teamId: targetUser.teamId, subBranchAdminId: targetUser.subBranchAdminId } : null,
    trainer: trainer ? { id: trainer.id, name: trainer.name } : null,
    assignedByUser: assigner ? { id: assigner.id, name: assigner.name } : null,
    items: items.map((item) => ({
      ...item,
      progress: progressByItem.get(item.id) ?? null,
    })),
  };
}

export const onboardingTemplatesRouter = router({
    list: activeUserProcedure
      .input(z.object({ includeInactive: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const includeInactive = ctx.user.role === "branch_admin" && input?.includeInactive === true;
        const templates = await getOnboardingTemplates(includeInactive);
        const withItems = await Promise.all(templates.map(async (template) => ({
          ...template,
          items: await getOnboardingTemplateItems(template.id, includeInactive),
        })));
        return withItems;
      }),

    seedDefaults: branchAdminProcedure.mutation(async ({ ctx }) => {
      const result = await ensureDefaultOnboardingTemplates(ctx.user.id);
      await createActivityLog({
        userId: ctx.user.id,
        action: "ONBOARDING_TEMPLATE_DEFAULTS_SEEDED",
        targetType: "onboarding_template",
        details: JSON.stringify({ createdTemplates: result.createdTemplates, createdItems: result.createdItems }),
      });
      return result;
    }),

    create: branchAdminProcedure
      .input(z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        targetRole: z.enum(ROLE_VALUES),
        items: z.array(templateItemInputSchema).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const created = await createOnboardingTemplate(
          {
            name: input.name,
            description: input.description,
            targetRole: input.targetRole,
            isActive: true,
            createdBy: ctx.user.id,
          },
          input.items.map((item) => ({
            title: item.title,
            description: item.description,
            category: item.category,
            required: item.required,
            requiresManagerApproval: item.requiresManagerApproval,
            practiceRequired: item.practiceRequired,
            relatedMenu: item.relatedMenu,
            completionCriteria: item.completionCriteria,
            estimatedMinutes: item.estimatedMinutes,
            sortOrder: item.sortOrder,
            isActive: item.isActive ?? true,
          }))
        );
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await createActivityLog({
          userId: ctx.user.id,
          action: "ONBOARDING_TEMPLATE_CREATED",
          targetType: "onboarding_template",
          targetId: created.id,
          details: JSON.stringify({ name: input.name, targetRole: input.targetRole }),
        });
        return { id: created.id };
      }),

    update: branchAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        targetRole: z.enum(ROLE_VALUES).optional(),
        isActive: z.boolean().optional(),
        items: z.array(templateItemInputSchema).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await getOnboardingTemplateById(input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        const { items, ...changes } = input;
        await updateOnboardingTemplate(input.id, {
          ...changes,
          archivedAt: input.isActive === false ? new Date() : input.isActive === true ? null : undefined,
          archivedBy: input.isActive === false ? ctx.user.id : input.isActive === true ? null : undefined,
        });

        if (items) {
          for (const item of items) {
            await upsertOnboardingTemplateItem(item.id ?? null, {
              templateId: input.id,
              title: item.title,
              description: item.description,
              category: item.category,
              required: item.required,
              requiresManagerApproval: item.requiresManagerApproval,
              practiceRequired: item.practiceRequired,
              relatedMenu: item.relatedMenu,
              completionCriteria: item.completionCriteria,
              estimatedMinutes: item.estimatedMinutes,
              sortOrder: item.sortOrder,
              isActive: item.isActive ?? true,
            });
          }
        }
        await createActivityLog({
          userId: ctx.user.id,
          action: "ONBOARDING_TEMPLATE_UPDATED",
          targetType: "onboarding_template",
          targetId: input.id,
          details: JSON.stringify({ updatedFields: Object.keys(changes) }),
        });
        return { success: true };
      }),

    archive: branchAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const template = await getOnboardingTemplateById(input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        await updateOnboardingTemplate(input.id, {
          isActive: false,
          archivedAt: new Date(),
          archivedBy: ctx.user.id,
        });
        await createActivityLog({
          userId: ctx.user.id,
          action: "ONBOARDING_TEMPLATE_ARCHIVED",
          targetType: "onboarding_template",
          targetId: input.id,
        });
        return { success: true };
      }),
});

export const onboardingAssignmentsRouter = router({
    assign: teamLeaderOrAboveProcedure
      .input(z.object({
        targetUserId: z.number(),
        templateId: z.number(),
        trainerUserId: z.number().optional(),
        startedAt: z.string(),
        dueAt: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [template, targetUser] = await Promise.all([
          getOnboardingTemplateById(input.templateId),
          assertCanManageTarget(ctx.user, input.targetUserId),
        ]);
        if (!template || !template.isActive || template.archivedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "활성 템플릿만 배정할 수 있습니다." });
        if (ctx.user.role !== "branch_admin" && template.targetRole !== targetUser.role) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "대상 역할과 템플릿 역할이 일치하지 않습니다." });
        }
        if (input.trainerUserId) await assertCanManageTarget(ctx.user, input.trainerUserId);

        const startedAt = new Date(input.startedAt);
        const dueAt = new Date(input.dueAt);
        if (Number.isNaN(startedAt.getTime()) || Number.isNaN(dueAt.getTime()) || dueAt.getTime() < startedAt.getTime()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "시작일/목표일이 올바르지 않습니다." });
        }

        const items = await getOnboardingTemplateItems(template.id);
        const assignment = await createOnboardingAssignment({
          targetUserId: input.targetUserId,
          templateId: template.id,
          assignedBy: ctx.user.id,
          trainerUserId: input.trainerUserId ?? null,
          startedAt,
          dueAt,
          status: "assigned",
          progressPercent: 0,
          requiredPendingCount: items.filter((item) => item.required).length,
          approvalPendingCount: 0,
        });
        if (!assignment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await createOnboardingItemProgressRows(items.map((item) => ({
          assignmentId: assignment.id,
          itemId: item.id,
          status: "pending",
        })));

        await createActivityLog({
          userId: ctx.user.id,
          action: "ONBOARDING_ASSIGNED",
          targetType: "user",
          targetId: input.targetUserId,
          details: JSON.stringify({ assignmentId: assignment.id, templateId: template.id, trainerUserId: input.trainerUserId ?? null }),
        });
        return { assignmentId: assignment.id };
      }),

    list: managerAnalyticsProcedure
      .input(z.object({ status: z.enum(["assigned", "in_progress", "completed", "overdue", "archived"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const scopeUserIds = ctx.user.role === "branch_admin" ? undefined : (await getHierarchyScopeUserIds(ctx.user)) ?? [ctx.user.id];
        const assignments = await getOnboardingAssignments({
          targetUserIds: scopeUserIds,
          includeArchived: false,
          status: input?.status,
        });
        return Promise.all(assignments.map((assignment) => buildAssignmentDetails(assignment.id)));
      }),

    byUser: managerAnalyticsProcedure
      .input(z.object({ targetUserId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertCanManageTarget(ctx.user, input.targetUserId);
        const assignments = await getOnboardingAssignments({ targetUserId: input.targetUserId, includeArchived: true });
        return Promise.all(assignments.map((assignment) => buildAssignmentDetails(assignment.id)));
      }),

    getMine: activeUserProcedure.query(async ({ ctx }) => {
      const assignments = await getOnboardingAssignments({ targetUserId: ctx.user.id, includeArchived: false });
      return Promise.all(assignments.map((assignment) => buildAssignmentDetails(assignment.id)));
    }),

    updateItemProgress: activeUserProcedure
      .input(z.object({
        assignmentId: z.number(),
        itemId: z.number(),
        note: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const assignment = await getOnboardingAssignmentById(input.assignmentId);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCanReadAssignment(ctx.user, assignment);
        if (ctx.user.id !== assignment.targetUserId) throw new TRPCError({ code: "FORBIDDEN", message: "본인 항목만 완료 체크할 수 있습니다." });

        const itemRows = await getOnboardingTemplateItems(assignment.templateId, true);
        const item = itemRows.find((candidate) => candidate.id === input.itemId);
        if (!item || !item.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "항목을 찾을 수 없습니다." });
        const progressRows = await getOnboardingItemProgressByAssignment(input.assignmentId);
        const progress = progressRows.find((row) => row.itemId === input.itemId);
        if (!progress) throw new TRPCError({ code: "NOT_FOUND" });

        const nextStatus = item.requiresManagerApproval ? "needs_approval" : "approved";
        await updateOnboardingItemProgress(progress.id, {
          status: nextStatus as any,
          completedAt: new Date(),
          completedBy: ctx.user.id,
          note: input.note,
          approvedAt: item.requiresManagerApproval ? null : new Date(),
          approvedBy: item.requiresManagerApproval ? null : ctx.user.id,
        });
        await recalcAssignmentProgress(input.assignmentId);

        await createActivityLog({
          userId: ctx.user.id,
          action: "ONBOARDING_ITEM_COMPLETED",
          targetType: "user_onboarding_assignment",
          targetId: input.assignmentId,
          details: JSON.stringify({ itemId: input.itemId, status: nextStatus }),
        });
        return { success: true, status: nextStatus };
      }),

    approveItem: teamLeaderOrAboveProcedure
      .input(z.object({
        progressId: z.number(),
        decision: z.enum(["approved", "rejected"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const progress = await getOnboardingItemProgressById(input.progressId);
        if (!progress) throw new TRPCError({ code: "NOT_FOUND" });
        const assignment = await getOnboardingAssignmentById(progress.assignmentId);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCanReadAssignment(ctx.user, assignment);
        if (progress.status !== "needs_approval") throw new TRPCError({ code: "BAD_REQUEST", message: "승인 대기 항목만 처리할 수 있습니다." });

        await updateOnboardingItemProgress(progress.id, {
          status: input.decision as any,
          approvedAt: new Date(),
          approvedBy: ctx.user.id,
        });
        await recalcAssignmentProgress(progress.assignmentId);

        await createActivityLog({
          userId: ctx.user.id,
          action: "ONBOARDING_ITEM_APPROVED",
          targetType: "user_onboarding_assignment",
          targetId: progress.assignmentId,
          details: JSON.stringify({ progressId: progress.id, decision: input.decision }),
        });
        return { success: true };
      }),

    archive: teamLeaderOrAboveProcedure
      .input(z.object({ assignmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const assignment = await getOnboardingAssignmentById(input.assignmentId);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
        await assertCanReadAssignment(ctx.user, assignment);
        await updateOnboardingAssignment(input.assignmentId, {
          status: "archived",
          archivedAt: new Date(),
          archivedBy: ctx.user.id,
        });
        await createActivityLog({
          userId: ctx.user.id,
          action: "ONBOARDING_ASSIGNMENT_ARCHIVED",
          targetType: "user_onboarding_assignment",
          targetId: input.assignmentId,
        });
        return { success: true };
      }),

    summary: managerAnalyticsProcedure.query(async ({ ctx }) => {
      const scopeUserIds = ctx.user.role === "branch_admin" ? undefined : (await getHierarchyScopeUserIds(ctx.user)) ?? [ctx.user.id];
      const assignments = await getOnboardingAssignments({ targetUserIds: scopeUserIds, includeArchived: false });
      const statusCounts = {
        total: assignments.length,
        inProgress: assignments.filter((item) => item.status === "in_progress" || item.status === "assigned").length,
        completed: assignments.filter((item) => item.status === "completed").length,
        overdue: assignments.filter((item) => item.status === "overdue").length,
        approvalPending: assignments.reduce((sum, item) => sum + (item.approvalPendingCount ?? 0), 0),
        requiredIncomplete: assignments.reduce((sum, item) => sum + (item.requiredPendingCount ?? 0), 0),
      };
      const byRole = { branch_admin: 0, sub_branch_admin: 0, team_leader: 0, member: 0 } as Record<string, number>;
      const users = await Promise.all(assignments.map((item) => getUserById(item.targetUserId)));
      for (const user of users) {
        if (!user?.role) continue;
        byRole[user.role] = (byRole[user.role] ?? 0) + 1;
      }
      return { ...statusCounts, byRole };
    }),
});

