import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  users,
  teamMemberCoachingNotes,
  InsertTeamMemberCoachingNote,
  activityLogs,
} from "../drizzle/schema";
import { getHierarchyScopeUserIds } from "./routers";

// RBAC: Verify if the user can manage the target user
async function verifyManagerAccess(db: any, currentUser: any, targetUserId: number) {
  if (currentUser.id === targetUserId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cannot coach yourself." });
  }

  if (currentUser.role === "member") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Members cannot create coaching notes." });
  }

  const visibleUserIds = await getHierarchyScopeUserIds(currentUser);
  if (visibleUserIds && !visibleUserIds.includes(targetUserId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Target user is outside of your management scope." });
  }
}

// Log activity without sensitive note content
async function logCoachingActivity(db: any, tx: any, type: string, currentUser: any, coachingNoteId: number, targetUserId: number, extraDetails: any = {}) {
  await (tx || db).insert(activityLogs).values({
    userId: currentUser.id,
    targetUserId: targetUserId,
    type,
    details: JSON.stringify({
      coachingNoteId,
      ...extraDetails
    })
  });
}

export const teamCoachingRouter = router({
  create: protectedProcedure
    .input(z.object({
      targetUserId: z.number(),
      category: z.enum(["praise", "improvement", "follow_up_delay", "notification_unread", "customer_care_gap", "goal_gap", "training", "one_on_one", "general"]),
      title: z.string().min(1).max(200),
      note: z.string().min(1),
      actionItems: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]),
      visibility: z.enum(["private_admin", "manager_visible", "member_visible"]),
      nextReviewAt: z.string().optional(),
      linkedMetricType: z.string().optional(),
      linkedMetricSnapshotJson: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }: { ctx: any, input: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await verifyManagerAccess(db, ctx.user, input.targetUserId);

      // Check if target user is active
      const [targetUser] = await db.select().from(users).where(eq(users.id, input.targetUserId));
      if (!targetUser || targetUser.accountStatus !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot create coaching notes for inactive or resigned users." });
      }

      // Check for sensitive patterns in note
      const sensitivePattern = /(\d{6}[-]?\d{7})|(010[-]?\d{4}[-]?\d{4})|(암|당뇨|뇌졸중)/;
      if (sensitivePattern.test(input.note)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "코칭 메모 본문에 고객의 전화번호, 주민등록번호 또는 질병명 등을 직접 입력할 수 없습니다. 안전한 코칭 기록을 위해 관련 정보를 지표나 고객 번호로 대체해 주세요." });
      }

      const noteData: InsertTeamMemberCoachingNote = {
        targetUserId: input.targetUserId,
        authorUserId: ctx.user.id,
        category: input.category,
        title: input.title,
        note: input.note,
        actionItems: input.actionItems,
        priority: input.priority,
        visibility: input.visibility,
        nextReviewAt: input.nextReviewAt ? new Date(input.nextReviewAt) : undefined,
        linkedMetricType: input.linkedMetricType,
        linkedMetricSnapshotJson: input.linkedMetricSnapshotJson,
        status: "open",
        isArchived: false,
      };

      const [result] = await db.insert(teamMemberCoachingNotes).values(noteData);

      await logCoachingActivity(db, db, "COACHING_NOTE_CREATED", ctx.user, result.insertId, input.targetUserId, {
        category: input.category,
        visibility: input.visibility,
        priority: input.priority
      });

      return { id: result.insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      category: z.enum(["praise", "improvement", "follow_up_delay", "notification_unread", "customer_care_gap", "goal_gap", "training", "one_on_one", "general"]).optional(),
      title: z.string().min(1).max(200).optional(),
      note: z.string().min(1).optional(),
      actionItems: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      visibility: z.enum(["private_admin", "manager_visible", "member_visible"]).optional(),
      nextReviewAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }: { ctx: any, input: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existingNote] = await db.select().from(teamMemberCoachingNotes).where(eq(teamMemberCoachingNotes.id, input.id));
      if (!existingNote) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check permissions
      if (ctx.user.id !== existingNote.authorUserId && ctx.user.role !== "branch_admin" && ctx.user.role !== "sub_branch_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the author or higher-level administrators can update coaching notes." });
      }

      if (input.note) {
        const sensitivePattern = /(\d{6}[-]?\d{7})|(010[-]?\d{4}[-]?\d{4})|(암|당뇨|뇌졸중)/;
        if (sensitivePattern.test(input.note)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "코칭 메모 본문에 고객의 전화번호, 주민등록번호 또는 질병명 등을 직접 입력할 수 없습니다. 안전한 코칭 기록을 위해 관련 정보를 지표나 고객 번호로 대체해 주세요." });
        }
      }

      const updateData: any = {};
      if (input.category) updateData.category = input.category;
      if (input.title) updateData.title = input.title;
      if (input.note) updateData.note = input.note;
      if (input.actionItems !== undefined) updateData.actionItems = input.actionItems;
      if (input.priority) updateData.priority = input.priority;
      if (input.visibility) updateData.visibility = input.visibility;
      if (input.nextReviewAt !== undefined) updateData.nextReviewAt = input.nextReviewAt ? new Date(input.nextReviewAt) : null;

      await db.update(teamMemberCoachingNotes)
        .set(updateData)
        .where(eq(teamMemberCoachingNotes.id, input.id));

      await logCoachingActivity(db, db, "COACHING_NOTE_UPDATED", ctx.user, input.id, existingNote.targetUserId, {
        updatedFields: Object.keys(updateData).filter(k => k !== "note" && k !== "actionItems")
      });

      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["open", "resolved"]),
    }))
    .mutation(async ({ ctx, input }: { ctx: any, input: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existingNote] = await db.select().from(teamMemberCoachingNotes).where(eq(teamMemberCoachingNotes.id, input.id));
      if (!existingNote) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (ctx.user.id !== existingNote.authorUserId && ctx.user.role !== "branch_admin" && ctx.user.role !== "sub_branch_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.update(teamMemberCoachingNotes)
        .set({ status: input.status })
        .where(eq(teamMemberCoachingNotes.id, input.id));

      await logCoachingActivity(db, db, "COACHING_NOTE_STATUS_CHANGED", ctx.user, input.id, existingNote.targetUserId, { status: input.status });
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ ctx, input }: { ctx: any, input: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existingNote] = await db.select().from(teamMemberCoachingNotes).where(eq(teamMemberCoachingNotes.id, input.id));
      if (!existingNote) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (ctx.user.id !== existingNote.authorUserId && ctx.user.role !== "branch_admin" && ctx.user.role !== "sub_branch_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.update(teamMemberCoachingNotes)
        .set({ 
          isArchived: true, 
          archivedAt: new Date(), 
          archivedBy: ctx.user.id,
          status: "archived"
        })
        .where(eq(teamMemberCoachingNotes.id, input.id));

      await logCoachingActivity(db, db, "COACHING_NOTE_ARCHIVED", ctx.user, input.id, existingNote.targetUserId);
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({
      targetUserId: z.number().optional(),
      status: z.enum(["open", "resolved", "archived"]).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
    }))
    .query(async ({ ctx, input }: { ctx: any, input: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(teamMemberCoachingNotes.isArchived, false)];

      if (input.status) {
        conditions.push(eq(teamMemberCoachingNotes.status, input.status));
      }
      if (input.priority) {
        conditions.push(eq(teamMemberCoachingNotes.priority, input.priority));
      }

      if (ctx.user.role === "member") {
        // Members can only see their own notes that are member_visible
        conditions.push(eq(teamMemberCoachingNotes.targetUserId, ctx.user.id));
        conditions.push(eq(teamMemberCoachingNotes.visibility, "member_visible"));
      } else {
        // Managers can see notes for their hierarchy
        let visibleUserIds = await getHierarchyScopeUserIds(ctx.user);
        
        if (input.targetUserId) {
          if (visibleUserIds && !visibleUserIds.includes(input.targetUserId)) {
             throw new TRPCError({ code: "FORBIDDEN", message: "Target user is outside of your management scope." });
          }
          conditions.push(eq(teamMemberCoachingNotes.targetUserId, input.targetUserId));
        } else if (visibleUserIds) {
          conditions.push(inArray(teamMemberCoachingNotes.targetUserId, visibleUserIds));
        }

        // Visibility rules for managers:
        // Branch Admin: can see all
        // Sub Branch Admin: can see manager_visible + private_admin (if they are the author) + member_visible
        // Team Leader: can see manager_visible + private_admin (if they are the author) + member_visible
        if (ctx.user.role !== "branch_admin") {
          conditions.push(
            sql`(${teamMemberCoachingNotes.visibility} != 'private_admin' OR ${teamMemberCoachingNotes.authorUserId} = ${ctx.user.id})`
          );
        }
      }

      const results = await db.select({
        id: teamMemberCoachingNotes.id,
        targetUserId: teamMemberCoachingNotes.targetUserId,
        authorUserId: teamMemberCoachingNotes.authorUserId,
        category: teamMemberCoachingNotes.category,
        title: teamMemberCoachingNotes.title,
        note: teamMemberCoachingNotes.note,
        actionItems: teamMemberCoachingNotes.actionItems,
        priority: teamMemberCoachingNotes.priority,
        status: teamMemberCoachingNotes.status,
        visibility: teamMemberCoachingNotes.visibility,
        nextReviewAt: teamMemberCoachingNotes.nextReviewAt,
        linkedMetricType: teamMemberCoachingNotes.linkedMetricType,
        linkedMetricSnapshotJson: teamMemberCoachingNotes.linkedMetricSnapshotJson,
        createdAt: teamMemberCoachingNotes.createdAt,
        updatedAt: teamMemberCoachingNotes.updatedAt,
        authorName: users.name,
      })
      .from(teamMemberCoachingNotes)
      .leftJoin(users, eq(users.id, teamMemberCoachingNotes.authorUserId))
      .where(and(...conditions))
      .orderBy(desc(teamMemberCoachingNotes.createdAt));

      return results;
    }),

  summary: protectedProcedure
    .query(async ({ ctx }: { ctx: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (ctx.user.role === "member") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const visibleUserIds = await getHierarchyScopeUserIds(ctx.user);
      if (visibleUserIds && visibleUserIds.length === 0) {
        return {
          openNotes: 0,
          thisWeekNotes: 0,
          dueForReview: 0,
          highPriority: 0,
        };
      }

      const conditions = [
        eq(teamMemberCoachingNotes.isArchived, false)
      ];
      if (visibleUserIds) {
        conditions.push(inArray(teamMemberCoachingNotes.targetUserId, visibleUserIds));
      }

      if (ctx.user.role !== "branch_admin") {
        conditions.push(
          sql`(${teamMemberCoachingNotes.visibility} != 'private_admin' OR ${teamMemberCoachingNotes.authorUserId} = ${ctx.user.id})`
        );
      }

      const results = await db.select({
        status: teamMemberCoachingNotes.status,
        priority: teamMemberCoachingNotes.priority,
        createdAt: teamMemberCoachingNotes.createdAt,
        nextReviewAt: teamMemberCoachingNotes.nextReviewAt,
      })
      .from(teamMemberCoachingNotes)
      .where(and(...conditions));

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const summary = {
        openNotes: results.filter(r => r.status === "open").length,
        thisWeekNotes: results.filter(r => new Date(r.createdAt) >= oneWeekAgo).length,
        dueForReview: results.filter(r => r.status === "open" && r.nextReviewAt && new Date(r.nextReviewAt) <= now).length,
        highPriority: results.filter(r => r.status === "open" && r.priority === "high").length,
      };

      return summary;
    })
});
