import { describe, expect, it } from "vitest";
import { buildCustomerExecutionScore } from "../shared/customerExecution";

describe("customer next best action execution score", () => {
  it("keeps score inside 0~100 and prioritizes long unmanaged customers", () => {
    const result = buildCustomerExecutionScore({
      customer: {
        consultStatus: "미상담",
        priority: "unclassified",
        customerTags: JSON.stringify([
          "해지위험",
          "리밸런싱필요",
          "사후관리필요",
        ]),
        expectedPremium: 200000,
      },
      latestConsult: null,
      nextFollowUp: null,
      isLongUnmanaged: true,
      hasOpenFollowUp: true,
    });

    expect(result.score).toBe(100);
    expect(result.grade).toBe("최우선 관리");
    expect(result.actionTitle).toBe("기존 기준 점검 연락 필요");
    expect(result.reasons.map(reason => reason.label)).toContain("장기 미관리");
  });

  it("recommends first consultation for unconsulted customers", () => {
    const result = buildCustomerExecutionScore({
      customer: { consultStatus: "미상담", priority: "A", expectedPremium: 0 },
      latestConsult: null,
      nextFollowUp: {},
    });

    expect(result.actionTitle).toBe("첫 상담 연결 필요");
    expect(result.reasons).toContainEqual({ label: "미상담", points: 20 });
  });

  it("recommends follow-up date setup when there is no next contact", () => {
    const result = buildCustomerExecutionScore({
      customer: { consultStatus: "TA", priority: "B", expectedPremium: 0 },
      latestConsult: {},
      nextFollowUp: null,
    });

    expect(result.actionTitle).toBe("다음 연락일 설정 필요");
    expect(result.reasons).toContainEqual({
      label: "다음 연락일 없음",
      points: 15,
    });
  });

  it("does not persist or require DB fields for retention-risk tags", () => {
    const result = buildCustomerExecutionScore({
      customer: {
        consultStatus: "TA",
        priority: "A",
        customerTags: "해지위험",
        expectedPremium: 0,
      },
      latestConsult: {},
      nextFollowUp: {},
    });

    expect(result.actionTitle).toBe("유지 관리 우선 필요");
    expect(result.reasons).toContainEqual({
      label: "해지위험 태그",
      points: 20,
    });
  });

  it("uses recommendation score when it is higher than local UI signals", () => {
    const result = buildCustomerExecutionScore({
      customer: { consultStatus: "TA", priority: "A", expectedPremium: 0 },
      recommendation: { totalScore: 72, recommendedAction: "오늘 연락 예정" },
      latestConsult: {},
      nextFollowUp: {},
    });

    expect(result.score).toBe(72);
    expect(result.grade).toBe("우선 관리");
  });
});
