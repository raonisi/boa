import { describe, expect, it } from "vitest";

import {
  buildCustomerDetailTabLocation,
  getCustomerDetailTabFromLocation,
  parseCustomerDetailTab,
} from "./customerDetailTabs";

describe("customer detail tab location", () => {
  it("uses summary for missing or invalid tab values", () => {
    expect(parseCustomerDetailTab(null)).toBe("summary");
    expect(parseCustomerDetailTab("unknown")).toBe("summary");
    expect(getCustomerDetailTabFromLocation("/customers/101")).toBe(
      "summary"
    );
  });

  it("parses each task-oriented tab", () => {
    expect(
      getCustomerDetailTabFromLocation("/customers/101?tab=consultation")
    ).toBe("consultation");
    expect(getCustomerDetailTabFromLocation("/customers/101?tab=contracts")).toBe(
      "contracts"
    );
    expect(getCustomerDetailTabFromLocation("/customers/101?tab=schedule")).toBe(
      "schedule"
    );
    expect(getCustomerDetailTabFromLocation("/customers/101?tab=history")).toBe(
      "history"
    );
  });

  it("keeps legacy deep links useful", () => {
    expect(parseCustomerDetailTab("consult")).toBe("consultation");
    expect(parseCustomerDetailTab("tools")).toBe("consultation");
    expect(parseCustomerDetailTab("contract")).toBe("contracts");
    expect(parseCustomerDetailTab("timeline")).toBe("history");
    expect(parseCustomerDetailTab("assign_history")).toBe("history");
  });

  it("updates tab while preserving actions, other query values, and hash", () => {
    expect(
      buildCustomerDetailTabLocation(
        "/customers/101?action=consult&source=dashboard#latest",
        "contracts"
      )
    ).toBe(
      "/customers/101?action=consult&source=dashboard&tab=contracts#latest"
    );
  });

  it("replaces the previous customer tab without carrying page state elsewhere", () => {
    expect(
      buildCustomerDetailTabLocation("/customers/202?tab=history", "summary")
    ).toBe("/customers/202?tab=summary");
  });
});
