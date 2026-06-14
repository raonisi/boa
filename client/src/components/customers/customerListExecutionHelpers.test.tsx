import { describe, expect, it } from "vitest";
import {
  formatCustomerRecentActivity,
  maskPhone,
  nextExecutionAction,
} from "@/components/customers/customerListExecutionHelpers";

describe("customerListExecutionHelpers", () => {
  it("masks phone for list display", () => {
    expect(maskPhone("01012345678")).toBe("010-****-5678");
  });

  it("builds next execution action from customer context", () => {
    expect(
      nextExecutionAction({ consultStatus: "미상담", nextAction: null }, null)
    ).toBe("첫 상담 연결");
    expect(
      nextExecutionAction(
        { consultStatus: "통화완료", nextAction: "재연락" },
        null
      )
    ).toBe("재연락");
  });

  it("formats recent activity from recommendation dates", () => {
    const text = formatCustomerRecentActivity(
      {
        consultStatus: "통화완료",
        assignedAt: "2026-06-01T00:00:00.000Z",
        source: "소개",
      },
      {
        lastConsultationDate: "2026-06-10T00:00:00.000Z",
        nextContactDate: "2026-06-12T00:00:00.000Z",
      }
    );
    expect(text).toContain("최근 상담");
    expect(text).toContain("다음 연락");
    expect(text).toContain("배정");
  });
});
