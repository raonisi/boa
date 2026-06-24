import { describe, expect, it } from "vitest";
import {
  assertRelationshipNoteSafe,
  displayRelationshipLabelForViewer,
  resolveRelationshipLabel,
} from "@shared/customerRelationships";

describe("customerRelationships shared helpers", () => {
  it("resolves referral labels by direction", () => {
    expect(resolveRelationshipLabel("referral", "outbound")).toBe("소개자");
    expect(resolveRelationshipLabel("referral", "inbound")).toBe("피소개자");
  });

  it("flips label when viewing from related customer side", () => {
    expect(
      displayRelationshipLabelForViewer(
        "family_child",
        "outbound",
        "자녀",
        101,
        100
      )
    ).toBe("부모");
  });

  it("rejects sensitive note patterns", () => {
    expect(() => assertRelationshipNoteSafe("123456-1234567")).toThrow(
      /민감정보/
    );
  });
});
