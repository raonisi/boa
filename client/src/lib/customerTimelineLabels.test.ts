import {
  getCustomerTimelineEventLabel,
  getCustomerTimelineSummary,
  shouldHideTimelineEvent,
} from "./customerTimelineLabels";

describe("customerTimelineLabels", () => {
  it("maps known event types to Korean labels", () => {
    expect(getCustomerTimelineEventLabel("CUSTOMER_VIEWED")).toBe(
      "고객 상세 조회"
    );
    expect(getCustomerTimelineEventLabel("bulk_assignee_change")).toBe(
      "담당자 일괄 변경"
    );
  });

  it("returns fallback for unknown event types", () => {
    expect(getCustomerTimelineEventLabel("UNKNOWN_INTERNAL_EVENT")).toBe(
      "활동 기록"
    );
  });

  it("hides noisy customer viewed events by default", () => {
    expect(shouldHideTimelineEvent("CUSTOMER_VIEWED")).toBe(true);
    expect(shouldHideTimelineEvent("consultation_created")).toBe(false);
  });

  it("replaces raw summary text with localized label", () => {
    expect(
      getCustomerTimelineSummary("CUSTOMER_VIEWED", "CUSTOMER_VIEWED")
    ).toBe("고객 상세 조회");
    expect(
      getCustomerTimelineSummary(
        "consultation_created",
        "통화 후 상담 약속 잡음"
      )
    ).toBe("통화 후 상담 약속 잡음");
  });
});
