import { getScheduleById, getUserById } from "./db";
import {
  fireAndForgetGoogleCalendarScheduleDelete,
  fireAndForgetGoogleCalendarScheduleSync,
  syncFollowUpToGoogleCalendar,
} from "./googleCalendarSync";
import {
  mapScheduleTypeToBoaEventType,
  mapBoaScheduleToGoogleCalendarType,
} from "./googleCalendarSafePayload";
import type { BoaGoogleEventType } from "@shared/googleCalendar";
import type { Schedule } from "../drizzle/schema";

export async function triggerGoogleCalendarSyncForScheduleId(
  actorId: number,
  scheduleId: number
) {
  const schedule = await getScheduleById(scheduleId);
  if (!schedule?.isActive || schedule.deletedAt) return;
  const owner = await getUserById(schedule.userId);
  fireAndForgetGoogleCalendarScheduleSync(
    { id: actorId },
    {
      schedule,
      ownerRole: owner?.role ?? null,
      customerReference: schedule.customerId
        ? `A-${schedule.customerId}`
        : null,
      segmentLabel: schedule.type,
    }
  );
}

export function triggerGoogleCalendarDeleteForSchedule(
  actorId: number,
  schedule: Pick<Schedule, "id" | "type" | "customerId" | "userId">,
  ownerRole?: string | null
) {
  const calendarType = mapBoaScheduleToGoogleCalendarType({
    scheduleType: schedule.type,
    customerId: schedule.customerId,
    ownerRole,
    status: "취소",
  });
  if (calendarType === "skipped") return;
  const boaEventType = mapScheduleTypeToBoaEventType(
    schedule.type,
    calendarType
  );
  fireAndForgetGoogleCalendarScheduleDelete(
    { id: actorId },
    boaEventType as BoaGoogleEventType,
    schedule.id
  );
}

export function triggerGoogleCalendarSyncForFollowUp(
  actorId: number,
  input: {
    followUpId: number;
    ownerUserId: number;
    startTime: Date;
    reason: string;
    nextAction: string;
  }
) {
  void syncFollowUpToGoogleCalendar({ id: actorId }, {
    followUpId: input.followUpId,
    ownerUserId: input.ownerUserId,
    startTime: input.startTime,
    endTime: new Date(input.startTime.getTime() + 60 * 60 * 1000),
    reason: input.reason,
    nextAction: input.nextAction,
  }).catch(() => undefined);
}
