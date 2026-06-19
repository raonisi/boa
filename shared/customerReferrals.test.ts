import { describe, expect, it } from "vitest";
import {
  assertReferralMemoSafe,
  defaultResultStatusForStage,
  stageTimestampField,
} from "@shared/customerReferrals";

describe("customerReferrals shared helpers", () => {
  it("maps contracted stage to contracted result status", () => {
    expect(defaultResultStatusForStage("contracted")).toBe("contracted");
    expect(defaultResultStatusForStage("introduced")).toBe("in_progress");
  });

  it("returns timestamp field for contacted stage", () => {
    expect(stageTimestampField("contacted")).toBe("firstContactedAt");
    expect(stageTimestampField("introduced")).toBeNull();
  });

  it("rejects sensitive memo patterns", () => {
    expect(() => assertReferralMemoSafe("123456-1234567")).toThrow(/민감정보/);
  });
});
