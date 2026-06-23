import { describe, expect, it } from "vitest";
import { createBulkCompleteConfirmation } from "./Notifications";

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
});
