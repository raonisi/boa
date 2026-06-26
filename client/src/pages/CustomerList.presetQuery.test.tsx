import { describe, expect, it } from "vitest";

import { getCustomerListQueryString } from "./CustomerList";

describe("getCustomerListQueryString", () => {
  it("reads preset from wouter location when query is embedded", () => {
    expect(
      getCustomerListQueryString("/customers?preset=priority-contact")
    ).toBe("preset=priority-contact");
  });

  it("prefers embedded query over pathname-only location", () => {
    expect(
      getCustomerListQueryString("/customers?preset=today-follow-up&action=foo")
    ).toContain("preset=today-follow-up");
  });
});
