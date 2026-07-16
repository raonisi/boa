import { describe, expect, it } from "vitest";
import {
  createBulkCompleteConfirmation,
  buildNotificationUrlState,
  getBulkSelectionCheckboxState,
  parseNotificationUrlState,
} from "./Notifications";

describe("Notifications bulk complete confirmation", () => {
  it("does not create a confirmation payload for empty selection", () => {
    expect(createBulkCompleteConfirmation([])).toBeNull();
  });

  it("creates confirmation payload with selected ids and action", () => {
    expect(createBulkCompleteConfirmation([1, 2, 3])).toEqual({
      ids: [1, 2, 3],
      action: "complete",
    });

    expect(createBulkCompleteConfirmation([10], "todayComplete")).toEqual({
      ids: [10],
      action: "todayComplete",
    });
  });

  it("returns mixed checkbox state for partial selection", () => {
    expect(
      getBulkSelectionCheckboxState({
        allVisibleSelected: false,
        selectedVisibleCount: 2,
      })
    ).toBe("indeterminate");

    expect(
      getBulkSelectionCheckboxState({
        allVisibleSelected: true,
        selectedVisibleCount: 2,
      })
    ).toBe(true);
  });
});

describe("Notifications URL filters", () => {
  it("round-trips allowlisted action-center filters", () => {
    const location = buildNotificationUrlState({
      priority: "urgent",
      category: "schedule",
      action: "required",
      processStatus: "확인",
      read: "unread",
      type: "schedule_incomplete",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-15",
      offset: 50,
    });

    expect(parseNotificationUrlState(location)).toEqual({
      priority: "urgent",
      category: "schedule",
      action: "required",
      processStatus: "확인",
      read: "unread",
      type: "schedule_incomplete",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-15",
      offset: 50,
    });
  });

  it("fails closed for unknown filter values", () => {
    expect(
      parseNotificationUrlState(
        "/notifications?category=external&action=javascript%3Aalert(1)&offset=-1"
      )
    ).toMatchObject({ category: "all", action: "all", offset: 0 });
  });
});
