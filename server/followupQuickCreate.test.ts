import { describe, expect, it } from "vitest";
import {
  buildFollowupQuickContactDate,
  buildQuickFollowUpPayload,
  resolveFollowupQuickDateChip,
} from "@shared/followupQuickCreate";
import { formatKstLocalDate, parseKstLocalDateTime } from "@shared/timePolicy";

const KST_MONDAY_10AM = new Date("2026-06-15T01:00:00.000Z");

describe("followupQuickCreate KST helpers", () => {
  it("resolves today, tomorrow, and 3 days later in KST", () => {
    expect(
      resolveFollowupQuickDateChip("today", undefined, KST_MONDAY_10AM)
    ).toBe("2026-06-15");
    expect(
      resolveFollowupQuickDateChip("tomorrow", undefined, KST_MONDAY_10AM)
    ).toBe("2026-06-16");
    expect(
      resolveFollowupQuickDateChip("in_3_days", undefined, KST_MONDAY_10AM)
    ).toBe("2026-06-18");
  });

  it("resolves this week to upcoming Friday in KST", () => {
    expect(
      resolveFollowupQuickDateChip("this_week", undefined, KST_MONDAY_10AM)
    ).toBe("2026-06-19");
  });

  it("builds contact datetime at 10:00 KST without day shift", () => {
    const nextContactDate = buildFollowupQuickContactDate({
      dateChip: "today",
      now: KST_MONDAY_10AM,
    });
    expect(nextContactDate).toBe("2026-06-15T10:00");
    const parsed = parseKstLocalDateTime(nextContactDate);
    expect(formatKstLocalDate(parsed)).toBe("2026-06-15");
    expect(formatKstLocalDate(parsed)).not.toBe("2026-06-14");
  });

  it("suggests preset reason and next action for callback", () => {
    const payload = buildQuickFollowUpPayload({
      presetId: "callback",
      dateChip: "tomorrow",
      customerId: 7,
      now: KST_MONDAY_10AM,
    });
    expect(payload.reason).toBe("다시 연락하기");
    expect(payload.nextAction).toBe("전화");
    expect(payload.customerId).toBe(7);
    expect(payload.nextContactDate).toBe("2026-06-16T10:00");
    expect(payload.presetLabel).toBe("다시 연락");
  });

  it("uses custom reason when provided", () => {
    const payload = buildQuickFollowUpPayload({
      presetId: "document_check",
      dateChip: "in_3_days",
      customerId: 3,
      reason: "청구 서류 재요청",
      memo: "카톡으로 안내 예정",
      now: KST_MONDAY_10AM,
    });
    expect(payload.reason).toBe("청구 서류 재요청");
    expect(payload.memo).toBe("카톡으로 안내 예정");
    expect(payload.nextAction).toBe("카톡");
  });
});
