import { describe, expect, it } from "vitest";
import {
  ACTION_PLAN_SENSITIVE_ERROR,
  assertNoSensitiveActionPlanText,
  assertNoSensitiveExecutiveInput,
  findSensitiveActionPlanPattern,
  sanitizeActionPlanLogMetadata,
} from "./actionPlanSensitiveGuard";

describe("actionPlanSensitiveGuard", () => {
  it("detects phone numbers", () => {
    expect(findSensitiveActionPlanPattern("연락 010-1234-5678")).toBe("phone");
  });

  it("detects email", () => {
    expect(findSensitiveActionPlanPattern("user@example.com")).toBe("email");
  });

  it("detects disease keywords", () => {
    expect(findSensitiveActionPlanPattern("고객 질병 이력")).toBe("disease");
  });

  it("throws generic error without echoing sensitive text", () => {
    expect(() => assertNoSensitiveActionPlanText("010-9999-8888")).toThrow(
      ACTION_PLAN_SENSITIVE_ERROR
    );
    expect(() => assertNoSensitiveActionPlanText("고객명 홍길동")).toThrow(
      ACTION_PLAN_SENSITIVE_ERROR
    );
  });

  it("blocks executive keyRisks with phone", () => {
    expect(() =>
      assertNoSensitiveExecutiveInput({
        keyRisks: "담당자 01012345678 연락 필요",
      })
    ).toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("sanitizes log metadata", () => {
    const safe = sanitizeActionPlanLogMetadata({
      reportMonth: "2026-06",
      reportWeekLabel: "1주차",
      generatedBy: 1,
      status: "downloaded",
      reason: "should-not-appear",
      userCount: 5,
    });
    expect(safe.reportMonth).toBe("2026-06");
    expect(safe.generatedBy).toBe(1);
    expect(safe).not.toHaveProperty("reason");
  });
});

describe("customer label + name patterns", () => {
  const blockedExamples = [
    "고객명 홍길동",
    "고객명: 홍길동",
    "고객 이름 홍길동",
    "계약자 홍길동",
    "계약자명: 김철수",
    "피보험자 이영희",
    "피보험자명: 박민수",
    "수익자 홍길동",
    "가입자 김철수",
    "청약자 박민수",
    "상담고객 이영희",
    "대상 고객 홍길동",
    "고객성명 김철수",
    "보험대상자 김철수",
    "계약자-김철수",
  ];

  it.each(blockedExamples)("blocks %s", example => {
    expect(findSensitiveActionPlanPattern(example)).toBe("customer_label_name");
    expect(() => assertNoSensitiveActionPlanText(example)).toThrow(
      ACTION_PLAN_SENSITIVE_ERROR
    );
  });

  const allowedExamples = [
    "고객 중심 전략",
    "계약자 보호 관점",
    "피보험자 기준 설명",
    "신규 DB 집중 공략",
    "상담 고객 확보 전략",
  ];

  it.each(allowedExamples)("allows %s", example => {
    expect(findSensitiveActionPlanPattern(example)).toBeNull();
    expect(() => assertNoSensitiveActionPlanText(example)).not.toThrow();
  });
});
