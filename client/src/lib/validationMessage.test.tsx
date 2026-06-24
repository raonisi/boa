import { describe, expect, it } from "vitest";

import { toSafeValidationMessage, VALIDATION_FALLBACK } from "./validationMessage";

describe("validationMessage", () => {
  it("keeps safe korean validation messages", () => {
    expect(toSafeValidationMessage("필수 입력 항목입니다.")).toBe(
      "필수 입력 항목입니다."
    );
  });

  it("maps required-like technical messages", () => {
    expect(toSafeValidationMessage("Required")).toBe(VALIDATION_FALLBACK.required);
  });

  it("maps format-like technical messages", () => {
    expect(toSafeValidationMessage("Invalid email")).toBe(
      VALIDATION_FALLBACK.format
    );
  });

  it("maps range-like technical messages", () => {
    expect(toSafeValidationMessage("Value must be less than 10")).toBe(
      VALIDATION_FALLBACK.range
    );
  });

  it("falls back to generic for unknown technical text", () => {
    expect(toSafeValidationMessage("ZodError: invalid_type at path")).toBe(
      VALIDATION_FALLBACK.format
    );
  });
});

