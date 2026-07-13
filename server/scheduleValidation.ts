import { TRPCError } from "@trpc/server";
import { parseKstLocalDateTime } from "@shared/timePolicy";

export function parseScheduleDateTime(value: string, fieldName: string) {
  const parsed = parseKstLocalDateTime(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${fieldName}이 올바르지 않습니다.`,
    });
  }
  return parsed;
}

export function assertScheduleEndAfterStart(
  startTime: Date,
  endTime?: Date | null
) {
  if (endTime && endTime.getTime() <= startTime.getTime()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "종료 시간은 시작 시간보다 늦어야 합니다.",
    });
  }
}

export function reminderFlagsFromOffset(reminderOffsetMinutes: number) {
  return {
    reminderDayBefore: reminderOffsetMinutes === 1440,
    reminderSameDay: reminderOffsetMinutes === 0,
    reminderOneHourBefore: reminderOffsetMinutes === 60,
  };
}
