import { describe, expect, it } from "vitest";

import { sanitizeAuthError } from "./authErrorSanitizer";

describe("sanitizeAuthError", () => {
  it("returns only safe fields for Axios-like errors", () => {
    const sanitized = sanitizeAuthError({
      name: "AxiosError",
      code: "ECONNABORTED",
      isAxiosError: true,
      response: { status: 401, data: { id_token: "secret-token" } },
      config: { headers: { Authorization: "Bearer secret" } },
      request: { path: "/tokeninfo" },
    });

    expect(sanitized).toEqual({
      name: "AxiosError",
      code: "ECONNABORTED",
      status: 401,
      isAxiosError: true,
      message: "Mobile Google login failed",
    });
    expect(JSON.stringify(sanitized)).not.toContain("secret");
    expect(JSON.stringify(sanitized)).not.toContain("id_token");
    expect(JSON.stringify(sanitized)).not.toContain("Authorization");
  });

  it("falls back safely for unknown errors", () => {
    expect(sanitizeAuthError(undefined)).toEqual({
      name: "AuthError",
      isAxiosError: false,
      message: "Mobile Google login failed",
    });
  });
});
