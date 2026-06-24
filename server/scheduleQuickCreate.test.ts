import { describe, expect, it } from "vitest";
import {
  buildQuickSchedulePayload,
  buildQuickScheduleStartTime,
  resolveQuickDateChip,
  resolveQuickTimeValue,
} from "@shared/scheduleQuickCreate";
import { formatKstLocalDate, parseKstLocalDateTime } from "@shared/timePolicy";

const KST_MONDAY_10AM = new Date("2026-06-15T01:00:00.000Z");

describe("scheduleQuickCreate KST helpers", () => {
  it("resolves today and tomorrow in KST", () => {
    expect(resolveQuickDateChip("today", undefined, KST_MONDAY_10AM)).toBe(
      "2026-06-15"
    );
    expect(resolveQuickDateChip("tomorrow", undefined, KST_MONDAY_10AM)).toBe(
      "2026-06-16"
    );
  });

  it("resolves this week to upcoming Friday in KST", () => {
    expect(resolveQuickDateChip("this_week", undefined, KST_MONDAY_10AM)).toBe(
      "2026-06-19"
    );
  });

  it("resolves next week to next Monday in KST", () => {
    expect(resolveQuickDateChip("next_week", undefined, KST_MONDAY_10AM)).toBe(
      "2026-06-22"
    );
  });

  it("maps quick time chips to default hours", () => {
    expect(resolveQuickTimeValue("morning")).toBe("10:00");
    expect(resolveQuickTimeValue("afternoon")).toBe("14:00");
    expect(resolveQuickTimeValue("before_leave")).toBe("17:00");
  });

  it("builds start time without 9-hour offset regression", () => {
    const startTime = buildQuickScheduleStartTime({
      dateChip: "today",
      timeChip: "morning",
      now: KST_MONDAY_10AM,
    });
    expect(startTime).toBe("2026-06-15T10:00");
    const parsed = parseKstLocalDateTime(startTime);
    expect(formatKstLocalDate(parsed)).toBe("2026-06-15");
    expect(formatKstLocalDate(parsed)).not.toBe("2026-06-14");
  });

  it("suggests preset title and consultation calendar category", () => {
    const payload = buildQuickSchedulePayload({
      presetId: "phone_consultation",
      dateChip: "today",
      timeChip: "morning",
      customerId: 12,
      now: KST_MONDAY_10AM,
    });
    expect(payload.title).toBe("전화 상담");
    expect(payload.type).toBe("고객상담");
    expect(payload.calendarCategory).toBe("consultation_followup");
    expect(payload.customerId).toBe(12);
    expect(payload.startTime).toBe("2026-06-15T10:00");
  });

  it("keeps visit consultation on consultation_followup when customer linked", () => {
    const payload = buildQuickSchedulePayload({
      presetId: "visit_consultation",
      dateChip: "tomorrow",
      timeChip: "afternoon",
      customerId: 5,
      now: KST_MONDAY_10AM,
    });
    expect(payload.type).toBe("외근");
    expect(payload.calendarCategory).toBe("consultation_followup");
  });
});
