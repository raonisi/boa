import { describe, expect, it } from "vitest";
import {
  buildSafeGoogleCalendarTitle,
  findSensitiveCalendarPattern,
  mapBoaScheduleToGoogleCalendarType,
} from "./googleCalendarSafePayload";

describe("googleCalendarSafePayload", () => {
  it("maps branch common schedule types", () => {
    expect(
      mapBoaScheduleToGoogleCalendarType({ scheduleType: "교육" })
    ).toBe("branch_common");
    expect(
      mapBoaScheduleToGoogleCalendarType({ scheduleType: "팀회의" })
    ).toBe("branch_common");
  });

  it("maps consultation and follow-up schedule types", () => {
    for (const type of ["고객상담", "재통화", "계약예정", "보장분석", "해지방어"]) {
      expect(mapBoaScheduleToGoogleCalendarType({ scheduleType: type })).toBe(
        "consultation_followup"
      );
    }
  });

  it("maps admin meetings without customer", () => {
    expect(
      mapBoaScheduleToGoogleCalendarType({
        scheduleType: "팀회의",
        ownerRole: "branch_admin",
      })
    ).toBe("admin");
  });

  it("blocks sensitive customer names and phone numbers", () => {
    expect(findSensitiveCalendarPattern("홍길동 고객 암보험 상담")).toBe(
      "customer_name"
    );
    expect(findSensitiveCalendarPattern("계약자 김철수 상담")).toBe(
      "customer_name"
    );
    expect(findSensitiveCalendarPattern("피보험자 이영희 상담")).toBe(
      "customer_name"
    );
    expect(findSensitiveCalendarPattern("010-1234-5678 고객 재연락")).toBe(
      "phone_number"
    );
    expect(findSensitiveCalendarPattern("월 보험료 15만원 조정 상담")).toBe(
      "premium_amount"
    );
    expect(findSensitiveCalendarPattern("김철수 피보험자 질병 상담")).toBe(
      "customer_name"
    );
  });

  it("allows safe references and builds safe titles", () => {
    expect(findSensitiveCalendarPattern("A-102")).toBeNull();
    expect(findSensitiveCalendarPattern("K고객")).toBeNull();
    expect(findSensitiveCalendarPattern("기존계약자군")).toBeNull();

    const title = buildSafeGoogleCalendarTitle({
      scheduleType: "고객상담",
      customerReference: "A-102",
      segmentLabel: "보장점검",
    });
    expect(title).toBe("[BOA] 상담 예정 · A-102 · 보장점검");
  });
});
