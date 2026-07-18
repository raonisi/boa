import { describe, expect, it } from "vitest";

import {
  classifyOperationRiskActionLevel,
  getOperationRiskActionLevelForStatus,
  sortOperationRiskItems,
} from "./operationRiskActionLevel";

describe("operation risk action-level policy", () => {
  it.each([
    ["pending", "action_required"],
    ["conflict", "immediate"],
    ["failed", "immediate"],
    ["approved", "informational"],
    ["rejected", "informational"],
    ["completed", "informational"],
    ["unknown", "informational"],
    [null, "informational"],
  ] as const)("maps status %s to %s", (status, expected) => {
    expect(getOperationRiskActionLevelForStatus(status)).toBe(expected);
  });

  it("does not promote multiple pending events to immediate", () => {
    expect(
      classifyOperationRiskActionLevel({ actionRequiredCount: 1_000 })
    ).toBe("action_required");
  });

  it("sorts by explicit action level, due date, recency, and stable input order", () => {
    const input = [
      {
        id: "info",
        actionLevel: "informational" as const,
        createdAt: "2026-07-16T01:00:00.000Z",
      },
      {
        id: "action-later",
        actionLevel: "action_required" as const,
        dueAt: "2026-07-18T00:00:00.000Z",
      },
      {
        id: "immediate-old",
        actionLevel: "immediate" as const,
        createdAt: "2026-07-15T00:00:00.000Z",
      },
      {
        id: "action-sooner",
        actionLevel: "action_required" as const,
        dueAt: "2026-07-17T00:00:00.000Z",
      },
      {
        id: "immediate-new",
        actionLevel: "immediate" as const,
        createdAt: "2026-07-16T00:00:00.000Z",
      },
    ];

    const first = sortOperationRiskItems(input).map(item => item.id);
    const second = sortOperationRiskItems(input).map(item => item.id);

    expect(first).toEqual([
      "immediate-new",
      "immediate-old",
      "action-sooner",
      "action-later",
      "info",
    ]);
    expect(second).toEqual(first);
  });
});
