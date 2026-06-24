import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { retentionRiskCases } from "../drizzle/schema";
import {
  assertRetentionRiskMemoSafe,
  RETENTION_RISK_FORBIDDEN_SCHEMA_FIELDS,
  RETENTION_RISK_SENSITIVE_MEMO_ERROR,
} from "./retentionRisk";

describe("retentionRisk shared rules", () => {
  it("rejects sensitive memo patterns", () => {
    expect(() => assertRetentionRiskMemoSafe("010-1234-5678")).toThrow(
      RETENTION_RISK_SENSITIVE_MEMO_ERROR
    );
    expect(() => assertRetentionRiskMemoSafe("보험료 50000원")).toThrow(
      RETENTION_RISK_SENSITIVE_MEMO_ERROR
    );
  });

  it("allows short operational memo", () => {
    expect(() =>
      assertRetentionRiskMemoSafe("[TEST] 보험료 부담 상담 예정")
    ).not.toThrow();
  });

  it("does not define sensitive fields on retention_risk_cases schema", () => {
    const columns = Object.keys(getTableColumns(retentionRiskCases));
    for (const forbidden of RETENTION_RISK_FORBIDDEN_SCHEMA_FIELDS) {
      expect(
        columns.some(name =>
          name.toLowerCase().includes(forbidden.toLowerCase())
        )
      ).toBe(false);
    }
  });
});
