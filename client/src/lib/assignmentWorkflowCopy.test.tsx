import { describe, expect, it } from "vitest";
import {
  formatDbAssignmentSuccessMessage,
  formatHandoffSuccessMessage,
  formatReassignmentSuccessMessage,
  summarizeCurrentAssignees,
} from "./assignmentWorkflowCopy";

describe("assignmentWorkflowCopy", () => {
  it("summarizes current assignees for reassignment confirm", () => {
    expect(
      summarizeCurrentAssignees(
        [1, 2],
        [
          { id: 1, agentId: 10 },
          { id: 2, agentId: 10 },
        ],
        user => `담당자#${user}`
      )
    ).toBe("담당자#10");

    expect(
      summarizeCurrentAssignees(
        [1, 2],
        [
          { id: 1, agentId: 10 },
          { id: 2, agentId: 11 },
        ],
        user => `담당자#${user}`
      )
    ).toBe("2명의 담당자에게 분산");

    expect(
      summarizeCurrentAssignees([1], [{ id: 1, agentId: null }], () => "x")
    ).toBe("미배정");
  });

  it("formats db assignment success copy", () => {
    expect(
      formatDbAssignmentSuccessMessage({
        successCount: 5,
        targetLabel: "김팀장",
      })
    ).toBe("고객 5건을 김팀장 담당자에게 배정했습니다.");
  });

  it("formats reassignment success copy with history guidance", () => {
    expect(
      formatReassignmentSuccessMessage({
        changedCount: 3,
        previousAssigneeLabel: "김OO",
        newAssigneeLabel: "이OO",
      })
    ).toContain("김OO에서 이OO로 변경했습니다.");
    expect(
      formatReassignmentSuccessMessage({
        changedCount: 2,
        newAssigneeLabel: "이OO",
        skippedCount: 1,
      })
    ).toContain("(1건 제외)");
  });

  it("formats handoff success copy", () => {
    expect(formatHandoffSuccessMessage()).toContain(
      "인수인계가 완료되었습니다."
    );
  });
});
