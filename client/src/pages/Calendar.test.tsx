import { describe, expect, it } from "vitest";

import {
  buildCalendarDayA11yLabel,
  CALENDAR_MOBILE_VIEW_HINT,
} from "./Calendar";

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

  it("builds a plain date label", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-06-24T00:00:00.000Z"),
      isToday: false,
      isSelected: false,
      scheduleCount: 0,
    });

    expect(label).toBe("2026년 6월 24일");
  });

  it("announces a single schedule", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-06-24T00:00:00.000Z"),
      isToday: false,
      isSelected: false,
      scheduleCount: 1,
    });

    expect(label).toContain("일정 1건");
  });

  it("marks dates outside the current month", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-05-31T00:00:00.000Z"),
      isToday: false,
      isSelected: false,
      isOutsideMonth: true,
      scheduleCount: 0,
    });

    expect(label).toContain("현재 달이 아님");
  });

  it("marks disabled dates", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-06-24T00:00:00.000Z"),
      isToday: false,
      isSelected: false,
      isDisabled: true,
      scheduleCount: 0,
    });

    expect(label).toContain("선택할 수 없음");
  });

  it("never includes sensitive schedule content", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-06-24T00:00:00.000Z"),
      isToday: true,
      isSelected: true,
      scheduleCount: 2,
    });

    // 일정 제목·고객명·전화번호 등은 라벨에 들어가지 않는다.
    expect(label).toBe("2026년 6월 24일, 오늘, 선택됨, 일정 2건");
  });

  it("ignores non-finite schedule counts", () => {
    const label = buildCalendarDayA11yLabel({
      day: new Date("2026-06-24T00:00:00.000Z"),
      isToday: false,
      isSelected: false,
      scheduleCount: Number.NaN,
    });

    expect(label).not.toContain("일정");
  });
});

describe("Calendar mobile view hint", () => {
  it("is concise korean guidance without sensitive content", () => {
    expect(/[가-힣]/.test(CALENDAR_MOBILE_VIEW_HINT)).toBe(true);
    expect(CALENDAR_MOBILE_VIEW_HINT.length).toBeLessThanOrEqual(40);
    expect(CALENDAR_MOBILE_VIEW_HINT).toContain("목록");
  });
});
