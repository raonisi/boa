import { describe, expect, it } from "vitest";
import {
  buildCustomerListPresetPath,
  customerMatchesUrlPreset,
  parseCustomerListUrlPreset,
  quickPresetToUrlPreset,
  urlPresetMatchesQuickPreset,
} from "./customerListUrlPresets";

describe("customerListUrlPresets", () => {
  it("accepts whitelisted preset values", () => {
    expect(parseCustomerListUrlPreset("today-follow-up")).toBe("today-follow-up");
    expect(parseCustomerListUrlPreset("overdue_follow_up")).toBe(
      "overdue-follow-up"
    );
    expect(parseCustomerListUrlPreset("priority-contact")).toBe(
      "priority-contact"
    );
  });

  it("rejects unknown preset values", () => {
    expect(parseCustomerListUrlPreset("agent-scope-hack")).toBe("invalid");
    expect(parseCustomerListUrlPreset("")).toBe(null);
    expect(parseCustomerListUrlPreset(null)).toBe(null);
  });

  it("builds stable customer list preset paths", () => {
    expect(buildCustomerListPresetPath("today-follow-up")).toBe(
      "/customers?preset=today-follow-up"
    );
  });

  it("maps quick presets to url presets when supported", () => {
    expect(quickPresetToUrlPreset("today_contact")).toBe("priority-contact");
    expect(quickPresetToUrlPreset("mine")).toBeNull();
    expect(urlPresetMatchesQuickPreset("priority-contact", "today_contact")).toBe(
      true
    );
  });

  it("filters follow-up presets by scoped customer ids only", () => {
    const todayIds = new Set([1, 2]);
    const overdueIds = new Set([3]);

    expect(
      customerMatchesUrlPreset({
        preset: "today-follow-up",
        customerId: 2,
        followUpTodayCustomerIds: todayIds,
        followUpOverdueCustomerIds: overdueIds,
      })
    ).toBe(true);

    expect(
      customerMatchesUrlPreset({
        preset: "today-follow-up",
        customerId: 99,
        followUpTodayCustomerIds: todayIds,
        followUpOverdueCustomerIds: overdueIds,
      })
    ).toBe(false);

    expect(
      customerMatchesUrlPreset({
        preset: "overdue-follow-up",
        customerId: 3,
        followUpTodayCustomerIds: todayIds,
        followUpOverdueCustomerIds: overdueIds,
      })
    ).toBe(true);
  });

  it("filters quick presets by recommendation and customer fields", () => {
    expect(
      customerMatchesUrlPreset({
        preset: "priority-contact",
        customerId: 1,
        followUpTodayCustomerIds: new Set(),
        followUpOverdueCustomerIds: new Set(),
        recommendation: { urgency: "medium" },
      })
    ).toBe(true);

    expect(
      customerMatchesUrlPreset({
        preset: "priority-urgent",
        customerId: 1,
        followUpTodayCustomerIds: new Set(),
        followUpOverdueCustomerIds: new Set(),
        recommendation: { urgency: "high" },
      })
    ).toBe(true);
  });

  it("filters warning presets without widening scope", () => {
    expect(
      customerMatchesUrlPreset({
        preset: "long-unmanaged",
        customerId: 10,
        followUpTodayCustomerIds: new Set(),
        followUpOverdueCustomerIds: new Set(),
        recommendation: {
          warnings: [{ warningType: "long_unmanaged" }],
        },
      })
    ).toBe(true);

    expect(
      customerMatchesUrlPreset({
        preset: "long-unmanaged",
        customerId: 10,
        followUpTodayCustomerIds: new Set(),
        followUpOverdueCustomerIds: new Set(),
        recommendation: {
          warnings: [{ warningType: "unread_notification" }],
        },
      })
    ).toBe(false);
  });
});
