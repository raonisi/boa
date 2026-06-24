import { describe, expect, it } from "vitest";

import { getAssignmentCandidateAvailability } from "./customerAssignAvailability";

describe("customerAssignAvailability", () => {
  it("keeps active candidates selectable", () => {
    expect(getAssignmentCandidateAvailability("active")).toEqual({
      selectable: true,
    });
  });

  it("marks inactive-like candidates with safe reason", () => {
    const inactive = getAssignmentCandidateAvailability("inactive");
    const resigned = getAssignmentCandidateAvailability("resigned");

    expect(inactive.selectable).toBe(false);
    expect(resigned.selectable).toBe(false);
    expect(inactive.disabledReason).toBe("선택할 수 없는 계정 상태입니다");
  });
});
