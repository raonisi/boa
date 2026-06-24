import { describe, expect, it } from "vitest";

import { getAssignmentCandidateAvailability } from "./customerAssignAvailability";

describe("customerAssignAvailability", () => {
  it("keeps active candidates selectable", () => {
    expect(getAssignmentCandidateAvailability("active")).toEqual({
      selectable: true,
    });
  });

  it("maps inactive and resigned candidates to explicit reasons", () => {
    expect(getAssignmentCandidateAvailability("inactive")).toEqual({
      selectable: false,
      disabledReason: "비활성 계정입니다",
    });
    expect(getAssignmentCandidateAvailability("resigned")).toEqual({
      selectable: false,
      disabledReason: "퇴사 처리된 사용자입니다",
    });
  });

  it("uses a safe fallback for unknown account status", () => {
    expect(getAssignmentCandidateAvailability("blocked")).toEqual({
      selectable: false,
      disabledReason: "현재 선택할 수 없는 사용자입니다",
    });
  });

  it("marks the current assignee as not selectable", () => {
    expect(
      getAssignmentCandidateAvailability("active", {
        isCurrentAssignee: true,
      })
    ).toEqual({
      selectable: false,
      disabledReason: "현재 담당자입니다",
    });
  });
});
