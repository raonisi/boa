import { describe, expect, it } from "vitest";

import { buildCalendarDayA11yLabel } from "./Calendar";

describe("Calendar day accessibility labels", () => {
  it("builds date label with today and selected state", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-06-24T00:00:00.000Z"),
      isToday: true,
      isSelected: true,
      scheduleCount: 3,
    });

    expect(label).toContain("2026년 6월 24일");
    expect(label).toContain("오늘");
    expect(label).toContain("선택됨");
    expect(label).toContain("일정 3건");
  });

  it("omits schedule count when no schedules", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-06-25T00:00:00.000Z"),
      isToday: false,
      isSelected: false,
      scheduleCount: 0,
    });

    expect(label).not.toContain("일정");
  });
});

