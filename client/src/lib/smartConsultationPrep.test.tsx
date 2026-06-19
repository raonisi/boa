import { describe, expect, it } from "vitest";
import {
  buildSmartConsultationPrepViewModel,
  deriveApproachDirections,
  deriveConsultationGoal,
} from "./smartConsultationPrep";

const baseInput = {
  customer: {
    consultStatus: "미상담",
    priority: "B",
    nextAction: "재연락",
  },
  customerTags: ["가격민감형"],
  agentName: "[TEST] Agent",
  latestConsult: null,
  latestConsultDate: null,
  nextFollowUp: null,
  contactReasons: null,
  handoffNotes: null,
  hasOpenRetentionRisk: false,
  hasOpenClaimGuidance: false,
  hasReferralFlows: false,
  hasRelationships: false,
};

describe("smartConsultationPrep", () => {
  it("derives first contact goal for unconsulted customers", () => {
    expect(deriveConsultationGoal(baseInput)).toBe("첫 접촉");
  });

  it("derives retention risk goal when open case exists", () => {
    expect(
      deriveConsultationGoal({ ...baseInput, hasOpenRetentionRisk: true })
    ).toBe("해지위험 확인");
  });

  it("shows approach direction from personality tag", () => {
    const directions = deriveApproachDirections(baseInput);
    expect(directions[0]).toContain("유지할 기준");
  });

  it("shows empty consult and follow-up states", () => {
    const view = buildSmartConsultationPrepViewModel(baseInput);
    expect(view.recentConsultSummary).toContain("최근 상담기록 없음");
    expect(view.recentFollowUpSummary).toContain("예정된 후속관리 없음");
    expect(view.hasRecentConsult).toBe(false);
    expect(view.hasFollowUp).toBe(false);
  });

  it("includes forbidden phrases and avoids pressure wording in defaults", () => {
    const view = buildSmartConsultationPrepViewModel(baseInput);
    expect(view.forbiddenPhrases).toContain("무조건 유지하세요");
    expect(view.approachDirections.join(" ")).not.toContain("반드시");
    expect(view.approachDirections.join(" ")).not.toContain("무조건");
  });

  it("truncates long handoff memo summary", () => {
    const view = buildSmartConsultationPrepViewModel({
      ...baseInput,
      handoffNotes: [
        {
          noteType: "approach",
          title: "[TEST] Approach",
          body: "긴 메모 ".repeat(40),
        },
      ],
    });
    expect(view.handoffSummary.length).toBeLessThanOrEqual(141);
  });
});
