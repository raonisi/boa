import { describe, expect, it } from "vitest";

import { safeLogSummary } from "./ActivityLog";

describe("safeLogSummary", () => {
  it("keeps DATA_DOWNLOAD summaries useful without exposing raw sensitive details", () => {
    const summary = safeLogSummary({
      details: JSON.stringify({
        metadata: {
          reason: "pilot export review 010-1111-2222 token=raw-token DATABASE_URL=mysql://secret",
          customerName: "Sensitive Customer",
          productName: "Sensitive Product",
          monthlyPremium: "123456",
          email: "customer@example.test",
        },
      }),
    });

    expect(summary).toContain("사유:");
    expect(summary).toContain("pilot export review");
    expect(summary).toContain("010-****-2222");
    expect(summary).toContain("[REDACTED]");
    expect(summary).not.toContain("010-1111-2222");
    expect(summary).not.toContain("raw-token");
    expect(summary).not.toContain("mysql://secret");
    expect(summary).not.toContain("Sensitive Customer");
    expect(summary).not.toContain("Sensitive Product");
    expect(summary).not.toContain("123456");
    expect(summary).not.toContain("customer@example.test");
  });
});
