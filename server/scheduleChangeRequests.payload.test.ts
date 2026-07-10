import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { Schedule } from "../drizzle/schema";
import { buildScheduleUpdateRequestPayload } from "./scheduleChangeRequests";

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 101,
    userId: 5,
    teamId: 10,
    customerId: null,
    title: "[TEST] 팀원 후속 일정",
    description: null,
    location: null,
    type: "고객상담",
    status: "예정",
    startTime: new Date("2026-07-10T01:00:00.000Z"),
    endTime: new Date("2026-07-10T02:00:00.000Z"),
    completedAt: null,
    memo: null,
    calendarCategory: "consultation_followup",
    reminderDayBefore: false,
    reminderSameDay: false,
    reminderOneHourBefore: false,
    reminderOffsetMinutes: 30,
    isActive: true,
    deletedAt: null,
    createdBy: 5,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("schedule change request update payload", () => {
  it("keeps only fields whose effective values changed", () => {
    const current = schedule();

    expect(
      buildScheduleUpdateRequestPayload(current, {
        title: current.title,
        startTime: "2026-07-10T10:00",
        memo: null,
        location: "[TEST] 회의실",
        reminderOffsetMinutes: 60,
      })
    ).toEqual({
      location: "[TEST] 회의실",
      reminderOffsetMinutes: 60,
    });
  });

  it("normalizes changed date fields before returning the payload", () => {
    const current = schedule();

    expect(
      buildScheduleUpdateRequestPayload(current, {
        startTime: "2026-07-10T11:30",
        endTime: null,
      })
    ).toEqual({
      startTime: "2026-07-10T02:30:00.000Z",
      endTime: null,
    });
  });

  it("rejects an update request with no effective changes", () => {
    const current = schedule();

    try {
      buildScheduleUpdateRequestPayload(current, {
        title: current.title,
        startTime: "2026-07-10T10:00",
        endTime: "2026-07-10T11:00",
        memo: null,
        description: null,
        location: null,
        reminderOffsetMinutes: 30,
        customerId: null,
        calendarCategory: "consultation_followup",
      });
      throw new Error("Expected BAD_REQUEST");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_REQUEST");
    }
  });
});
