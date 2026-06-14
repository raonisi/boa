import { describe, expect, it } from "vitest";

import {
  adminPage,
  adminPanel,
  adminPushStatusClasses,
  adminRiskBadgeClasses,
} from "./adminDesignTokens";

describe("adminDesignTokens", () => {
  it("uses BOA semantic surfaces instead of raw slate hex drift", () => {
    expect(adminPage.card).toContain("border-border");
    expect(adminPage.card).toContain("bg-card");
    expect(adminPage.eyebrow).toContain("text-boa-amber");
    expect(adminPage.metricValue).toContain("text-boa-navy");
    expect(adminPage.card).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("maps risk badges to restrained BOA danger and amber tones", () => {
    expect(adminRiskBadgeClasses.high).toContain("destructive");
    expect(adminRiskBadgeClasses.caution).toContain("boa-amber");
    expect(adminRiskBadgeClasses.normal).not.toContain("rose");
  });

  it("keeps push status classes token-based", () => {
    expect(adminPushStatusClasses.failed).toContain("destructive");
    expect(adminPushStatusClasses.sent).toContain("boa-green");
  });

  it("defines semantic admin panels for success and warning", () => {
    expect(adminPanel.success).toContain("boa-green");
    expect(adminPanel.warning).toContain("boa-amber");
    expect(adminPanel.danger).toContain("destructive");
  });
});
