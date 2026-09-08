import { describe, expect, it } from "vitest";
import { formatKstLocalDate, formatKstLocalDateTime } from "@shared/timePolicy";
import {
  buildCriticalE2EScheduleFixture,
  CRITICAL_E2E_REFERENCE_INSTANT,
} from "../e2e/critical/fixtures";

describe("critical E2E KST schedule fixture", () => {
  it("uses one fixed weekday-morning instant for the seed and browser clock", () => {
    const fixture = buildCriticalE2EScheduleFixture();

    expect(fixture.reference.toISOString()).toBe(
      CRITICAL_E2E_REFERENCE_INSTANT
    );
    expect(fixture.dateKey).toBe("2026-06-15");
    expect(formatKstLocalDateTime(fixture.reference)).toBe(
      "2026-06-15T09:30:00"
    );
    expect(formatKstLocalDateTime(fixture.startAt)).toBe(
      "2026-06-15T10:00:00"
    );
    expect(formatKstLocalDateTime(fixture.endAt)).toBe(
      "2026-06-15T11:00:00"
    );
  });

  it.each([
    ["UTC and KST dates differ", "2026-06-14T15:30:00.000Z", "2026-06-15"],
    ["just before KST midnight", "2026-06-14T14:59:59.999Z", "2026-06-14"],
    ["just after KST midnight", "2026-06-14T15:00:00.000Z", "2026-06-15"],
    ["month end", "2026-01-31T15:00:00.000Z", "2026-02-01"],
    ["year end", "2025-12-31T15:00:00.000Z", "2026-01-01"],
  ])("keeps the fixture stable at %s", (_label, instant, expectedDateKey) => {
    const fixture = buildCriticalE2EScheduleFixture(instant);

    expect(fixture.dateKey).toBe(expectedDateKey);
    expect(formatKstLocalDate(fixture.startAt)).toBe(expectedDateKey);
    expect(formatKstLocalDate(fixture.endAt)).toBe(expectedDateKey);
  });

  it("derives yesterday, today, and tomorrow from the same KST instant", () => {
    const yesterday = buildCriticalE2EScheduleFixture(
      CRITICAL_E2E_REFERENCE_INSTANT,
      -1
    );
    const today = buildCriticalE2EScheduleFixture(
      CRITICAL_E2E_REFERENCE_INSTANT
    );
    const tomorrow = buildCriticalE2EScheduleFixture(
      CRITICAL_E2E_REFERENCE_INSTANT,
      1
    );

    expect(yesterday.dateKey).toBe("2026-06-14");
    expect(today.dateKey).toBe("2026-06-15");
    expect(tomorrow.dateKey).toBe("2026-06-16");
    expect(formatKstLocalDate(today.startAt)).toBe(today.dateKey);
  });

  it("rejects an invalid reference instant", () => {
    expect(() => buildCriticalE2EScheduleFixture("not-a-date")).toThrow(
      "Critical E2E reference instant must be a valid date"
    );
  });
});
