import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { claimGuidanceCases } from "../drizzle/schema";
import {
  assertClaimGuidanceMemoSafe,
  CLAIM_GUIDANCE_FORBIDDEN_SCHEMA_FIELDS,
  CLAIM_GUIDANCE_SENSITIVE_MEMO_ERROR,
} from "./claimGuidance";

describe("claimGuidance shared rules", () => {
  it("rejects sensitive memo patterns", () => {
    expect(() => assertClaimGuidanceMemoSafe("010-1234-5678")).toThrow(
      CLAIM_GUIDANCE_SENSITIVE_MEMO_ERROR
    );
    expect(() => assertClaimGuidanceMemoSafe("진단명: 테스트")).toThrow(
      CLAIM_GUIDANCE_SENSITIVE_MEMO_ERROR
    );
    expect(() => assertClaimGuidanceMemoSafe("계좌번호 123456")).toThrow(
      CLAIM_GUIDANCE_SENSITIVE_MEMO_ERROR
    );
  });

  it("allows short operational memo", () => {
    expect(() =>
      assertClaimGuidanceMemoSafe("[TEST] 서류 안내 전화 예정")
    ).not.toThrow();
  });

  it("does not define sensitive fields on claim_guidance_cases schema", () => {
    const columns = Object.keys(getTableColumns(claimGuidanceCases));
    for (const forbidden of CLAIM_GUIDANCE_FORBIDDEN_SCHEMA_FIELDS) {
      expect(
        columns.some(name =>
          name.toLowerCase().includes(forbidden.toLowerCase())
        )
      ).toBe(false);
    }
    expect(columns).not.toContain("policyNumber");
    expect(columns).not.toContain("phone");
  });
});
