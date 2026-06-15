import { getCustomerById, getScheduleById, getUserById } from "./db";
import {
  fireAndForgetGoogleCalendarScheduleDelete,
  fireAndForgetGoogleCalendarScheduleSync,
  loadCustomerContactForSync,
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
  const customerContact = await loadCustomerContactForSync(schedule.customerId);
  fireAndForgetGoogleCalendarScheduleSync(
    { id: actorId },
    {
      schedule,
      ownerRole: owner?.role ?? null,
      customerReference: schedule.customerId
        ? `A-${schedule.customerId}`
        : null,
      segmentLabel: schedule.type,
      customerContact,
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

export async function triggerGoogleCalendarSyncForFollowUp(
  actorId: number,
  input: {
    followUpId: number;
    ownerUserId: number;
    createdBy: number;
    customerId: number;
    startTime: Date;
    reason: string;
    nextAction: string;
  }
) {
  const customerContact = await loadCustomerContactForSync(input.customerId);
  void syncFollowUpToGoogleCalendar(
    { id: actorId },
    {
      followUpId: input.followUpId,
      ownerUserId: input.ownerUserId,
      createdBy: input.createdBy,
      startTime: input.startTime,
      endTime: new Date(input.startTime.getTime() + 60 * 60 * 1000),
      reason: input.reason,
      nextAction: input.nextAction,
      customerContact,
    }
  ).catch(() => undefined);
}
