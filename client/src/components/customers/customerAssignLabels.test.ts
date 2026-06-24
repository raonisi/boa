import { describe, expect, it } from "vitest";

import {
  ASSIGNMENT_STATUS_LABELS,
  formatAssignmentStatusLabel,
} from "./customerAssignLabels";

describe("customerAssignLabels", () => {
  it("maps known assignment statuses to Korean labels", () => {
    expect(formatAssignmentStatusLabel("unassigned")).toBe(
      ASSIGNMENT_STATUS_LABELS.unassigned
    );
    expect(formatAssignmentStatusLabel("assigned_to_sub_branch")).toBe(
      "부지점장 배분됨"
    );
  });

  it("defaults missing status to unassigned", () => {
    expect(formatAssignmentStatusLabel(null)).toBe("미배정");
  });
});
