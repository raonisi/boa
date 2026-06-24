import { TRPCError } from "@trpc/server";
import {
  recommendScheduleCalendarCategory,
  type ScheduleCalendarCategory,
} from "@shared/scheduleCalendarCategory";
import { createActivityLog } from "./db";
import { sanitizeGoogleCalendarLogMetadata } from "./googleCalendarSafePayload";

type ScheduleActor = {
  id: number;
  role: string;
};

export function assertCanSelectCalendarCategory(
  role: string,
  category: ScheduleCalendarCategory
) {
  if (category === "admin" && role === "member") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "관리자일정은 선택할 수 없습니다.",
    });
  }
}

export function resolveCalendarCategoryForSave(input: {
  requestedCategory?: ScheduleCalendarCategory | null;
  scheduleType: string;
  customerId?: number | null;
  ownerRole?: string | null;
  existingCategory?: ScheduleCalendarCategory | null;
}): ScheduleCalendarCategory {
  if (input.requestedCategory) {
    return input.requestedCategory;
  }
  if (input.existingCategory) {
    return input.existingCategory;
  }
  return recommendScheduleCalendarCategory({
    scheduleType: input.scheduleType,
    customerId: input.customerId,
    ownerRole: input.ownerRole,
  });
}

export async function logCalendarCategoryActivity(
  actor: ScheduleActor,
  action: "CALENDAR_CATEGORY_SELECTED" | "CALENDAR_CATEGORY_CHANGED",
  metadata: Record<string, unknown>
) {
  await createActivityLog({
    userId: actor.id,
    action,
    targetType: "schedule",
    details: JSON.stringify({
      actor: actor.id,
      metadata: sanitizeGoogleCalendarLogMetadata(metadata),
    }),
  });
}
