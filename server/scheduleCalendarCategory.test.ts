import { describe, expect, it } from "vitest";
import {
  recommendScheduleCalendarCategory,
  SCHEDULE_CALENDAR_CATEGORY_CARDS,
  SCHEDULE_CALENDAR_CATEGORY_LABELS,
} from "@shared/scheduleCalendarCategory";

describe("scheduleCalendarCategory cards", () => {
  it("exposes three calendar category cards with expected values", () => {
    expect(SCHEDULE_CALENDAR_CATEGORY_CARDS.map(card => card.value)).toEqual([
      "branch_common",
      "consultation_followup",
      "admin",
    ]);
    expect(SCHEDULE_CALENDAR_CATEGORY_LABELS.branch_common).toBe("공통일정");
    expect(SCHEDULE_CALENDAR_CATEGORY_LABELS.consultation_followup).toBe(
      "상담일정"
    );
    expect(SCHEDULE_CALENDAR_CATEGORY_LABELS.admin).toBe("관리자일정");
  });

  it("recommends consultation_followup for customer consultation types", () => {
    expect(
      recommendScheduleCalendarCategory({ scheduleType: "고객상담" })
    ).toBe("consultation_followup");
  });

  it("recommends branch_common for education schedules", () => {
    expect(recommendScheduleCalendarCategory({ scheduleType: "교육" })).toBe(
      "branch_common"
    );
  });
});
