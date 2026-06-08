import { describe, expect, it } from "vitest";

import {
  assertNoDeviceTokenInPushLogRow,
  buildPushLogsQuery,
  formatPushLogUserLabel,
  pushStatusLabels,
} from "./pushNotificationOperationsUtils";

describe("pushNotificationOperationsUtils", () => {
  it("builds filtered query payloads for branch-admin log API", () => {
    expect(buildPushLogsQuery({
      status: "all",
      type: "test",
      sourceType: "",
      dateFrom: "2026-05-01",
      dateTo: "",
    })).toEqual({
      status: undefined,
      type: "test",
      sourceType: undefined,
      dateFrom: "2026-05-01",
      dateTo: undefined,
      userId: undefined,
      limit: 100,
    });
  });

  it("formats user labels without exposing tokens", () => {
    expect(formatPushLogUserLabel({ userName: "[TEST] User", userId: 4, userRole: "member" }))
      .toBe("[TEST] User (member)");
    expect(formatPushLogUserLabel({ userName: null, userId: 9, userRole: null })).toBe("#9");
  });

  it("rejects push log rows that contain token-like string fields", () => {
    expect(() => assertNoDeviceTokenInPushLogRow({
      id: 1,
      deviceToken: "a".repeat(160),
    })).toThrow(/token/i);
    expect(() => assertNoDeviceTokenInPushLogRow({
      id: 1,
      userName: "[TEST]",
      status: pushStatusLabels.sent,
    })).not.toThrow();
  });
});
