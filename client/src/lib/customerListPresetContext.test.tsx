import { describe, expect, it } from "vitest";

import { buildCustomerListPresetContext } from "./customerListPresetContext";

describe("customerListPresetContext", () => {
  it("builds current preset title for users", () => {
    const context = buildCustomerListPresetContext("today-follow-up", false);
    expect(context.title).toBe("현재 보기: 오늘 연락할 고객");
  });

  it("adds extra filter note when manual filters are active", () => {
    const context = buildCustomerListPresetContext("priority-contact", true);
    expect(context.description).toContain("추가 필터");
  });
});

