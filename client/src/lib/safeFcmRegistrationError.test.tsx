import { describe, expect, it } from "vitest";

import { safeFcmRegistrationErrorSummary } from "./safeFcmRegistrationError";

describe("safeFcmRegistrationErrorSummary", () => {
  it("classifies network failures without raw error payloads", () => {
    const summary = safeFcmRegistrationErrorSummary({
      name: "TypeError",
      message: "Failed to fetch",
    });

    expect(summary.reason).toBe("network_error");
    expect(summary).not.toHaveProperty("headers");
    expect(JSON.stringify(summary)).not.toMatch(/Bearer|deviceToken|token=/i);
  });

  it("classifies auth failures from status only", () => {
    const summary = safeFcmRegistrationErrorSummary({
      name: "TRPCClientError",
      data: { httpStatus: 401 },
    });

    expect(summary.reason).toBe("auth_required");
    expect(summary.status).toBe(401);
  });

  it("does not echo token-like strings from messages", () => {
    const summary = safeFcmRegistrationErrorSummary(
      "Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig"
    );

    expect(summary.reason).toBe("auth_required");
    expect(JSON.stringify(summary)).not.toContain("eyJ");
  });
});
