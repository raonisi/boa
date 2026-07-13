import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { SCHEDULE_CALENDAR_CATEGORIES } from "@shared/scheduleCalendarCategory";
import { activeUserProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import {
  completeSchedule,
  createSchedule,
  getScheduleById,
  getSchedules,
  getUserById,
  softDeleteSchedule,
  updateSchedule,
} from "./db";
import {
  cancelScheduleIncompleteNotification,
  cancelScheduleTimingNotifications,
  createScheduleIncompleteReminder,
  createScheduleReminderByOffset,
} from "./notifications";
import {
  assertActiveScheduleTarget,
  assertCanCreateScheduleForUser,
  assertScheduleMutationAccess,
} from "./scheduleAuthorization";
import {
  assertCanSelectCalendarCategory,
  logCalendarCategoryActivity,
  resolveCalendarCategoryForSave,
} from "./scheduleCalendarCategory";
import {
  assertScheduleEndAfterStart,
  parseScheduleDateTime,
  reminderFlagsFromOffset,
} from "./scheduleValidation";
import { listCalendarSchedules } from "./scheduleVisibility";
import {
  triggerGoogleCalendarDeleteForSchedule,
  triggerGoogleCalendarSyncForScheduleId,
} from "./googleCalendarHooks";

type ScheduleActor = {
  id: number;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
};

type ScheduleRouterDependencies = {
  verifyCustomerAccess: (
    user: ScheduleActor,
    customerId: number
  ) => Promise<any>;
  log: (
    userId: number,
    action: string,
    targetType?: string,
    targetId?: number,
    details?: string
  ) => Promise<void>;
};

export function createSchedulesRouter({
  verifyCustomerAccess,
  log,
}: ScheduleRouterDependencies) {
  return router({
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
          location: z.string().max(200).nullable().optional(),
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
          userId: z.never().optional(),
          targetUserId: z.number().optional(),
          customerId: z.number().optional(),
          calendarCategory: z.enum(SCHEDULE_CALENDAR_CATEGORIES).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        let targetUserId = user.id;
        if (input.targetUserId !== undefined) {
          assertCanCreateScheduleForUser(user, input.targetUserId);
          await assertActiveScheduleTarget(input.targetUserId);
          targetUserId = input.targetUserId;
        }
        const targetUser = await getUserById(targetUserId);
        let linkedCustomerId: number | undefined;
        if (input.customerId !== undefined) {
          const customer = await verifyCustomerAccess(user, input.customerId);
          if (!customer.isActive || customer.deletedAt) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Inactive customers cannot be linked to schedules.",
            });
          }
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
          location: input.location,
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
          schedule =>
            schedule.title === input.title &&
            schedule.startTime.getTime() === startTimeDate.getTime()
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
          if (endTimeDate) {
            await createScheduleIncompleteReminder(
              newSchedule.id,
              targetUserId,
              endTimeDate,
              input.title
            );
          }
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
          description: z.string().nullable().optional(),
          location: z.string().max(200).nullable().optional(),
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
          userId: z.never().optional(),
          targetUserId: z.never().optional(),
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

        const existing = await getScheduleById(id);
        if (!existing || !existing.isActive || existing.deletedAt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "해당 일정에 접근 권한이 없습니다.",
          });
        }
        assertScheduleMutationAccess(user, existing);

        if (existing.userId !== user.id) {
          await assertActiveScheduleTarget(existing.userId);
        }

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
        if (parsedStartTime !== undefined) {
          updateData.startTime = parsedStartTime;
        }
        if (parsedEndTime !== undefined) updateData.endTime = parsedEndTime;
        if (customerId !== undefined) {
          if (customerId === null) {
            updateData.customerId = null;
          } else {
            const customer = await verifyCustomerAccess(user, customerId);
            if (!customer.isActive || customer.deletedAt) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Inactive customers cannot be linked to schedules.",
              });
            }
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
          if (Object.keys(updateData).length) {
            await updateSchedule(id, updateData);
          }
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
          if (effectiveEndTime) {
            await createScheduleIncompleteReminder(
              id,
              existing.userId,
              effectiveEndTime,
              rest.title ?? existing.title
            );
          }
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
        const existing = await getScheduleById(input.id);
        if (!existing || !existing.isActive || existing.deletedAt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "해당 일정에 접근 권한이 없습니다.",
          });
        }
        assertScheduleMutationAccess(user, existing);

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
  });
}
