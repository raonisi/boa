import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  SERVER_VALIDATION_MESSAGES,
  isZodError,
  toKoreanValidationMessage,
} from "./validationMessage";

function parseError(schema: z.ZodTypeAny, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("expected validation failure");
  return result.error;
}

const TECHNICAL_TOKENS = [
  "expected",
  "received",
  "invalid_type",
  "ZodError",
  "undefined",
  "path",
];

function expectNoTechnicalLeak(message: string) {
  expect(/[가-힣]/.test(message)).toBe(true);
  for (const token of TECHNICAL_TOKENS) {
    expect(message.toLowerCase()).not.toContain(token.toLowerCase());
  }
}

describe("toKoreanValidationMessage", () => {
  it("maps missing required string field", () => {
    const schema = z.object({ name: z.string().min(1) });
    const message = toKoreanValidationMessage(parseError(schema, {}));
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.required);
    expectNoTechnicalLeak(message);
  });

  it("maps empty customer name to a field-specific message", () => {
    const schema = z.object({ customerName: z.string().min(1) });
    const message = toKoreanValidationMessage(
      parseError(schema, { customerName: "" })
    );
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.customerName);
  });

  it("maps missing assignee id to a field-specific message", () => {
    const schema = z.object({ agentId: z.number() });
    const message = toKoreanValidationMessage(parseError(schema, {}));
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.assignee);
    expectNoTechnicalLeak(message);
  });

  it("maps invalid email format", () => {
    const schema = z.object({ email: z.string().email() });
    const message = toKoreanValidationMessage(
      parseError(schema, { email: "not-an-email" })
    );
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.email);
    expectNoTechnicalLeak(message);
  });

  it("maps phone regex failure by field name", () => {
    const schema = z.object({ phone: z.string().regex(/^\d{2,3}-\d{3,4}-\d{4}$/) });
    const message = toKoreanValidationMessage(
      parseError(schema, { phone: "abc" })
    );
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.phone);
  });

  it("maps datetime format failure", () => {
    const schema = z.object({ startTime: z.string().datetime() });
    const message = toKoreanValidationMessage(
      parseError(schema, { startTime: "not-a-date" })
    );
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.date);
  });

  it("maps number range failure", () => {
    const schema = z.object({ premium: z.number().min(0).max(100) });
    const message = toKoreanValidationMessage(
      parseError(schema, { premium: 1000 })
    );
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.range);
  });

  it("maps enum failure", () => {
    const schema = z.object({ status: z.enum(["미상담", "상담완료"]) });
    const message = toKoreanValidationMessage(
      parseError(schema, { status: "기타" })
    );
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.enum);
  });

  it("maps array minimum failure", () => {
    const schema = z.object({ ids: z.array(z.number()).min(1) });
    const message = toKoreanValidationMessage(parseError(schema, { ids: [] }));
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.arrayMin);
  });

  it("falls back to generic for unmapped technical failures", () => {
    const schema = z.object({ flag: z.boolean() });
    const message = toKoreanValidationMessage(
      parseError(schema, { flag: "yes" })
    );
    expectNoTechnicalLeak(message);
    expect(Object.values(SERVER_VALIDATION_MESSAGES)).toContain(message);
  });

  it("preserves existing safe Korean custom messages", () => {
    const schema = z.object({
      title: z.string().min(1, "제목을 입력해 주세요."),
    });
    const message = toKoreanValidationMessage(
      parseError(schema, { title: "" })
    );
    expect(message).toBe("제목을 입력해 주세요.");
  });

  it("does not leak English custom messages", () => {
    const schema = z.object({
      title: z.string().min(1, "Title is required"),
    });
    const message = toKoreanValidationMessage(
      parseError(schema, { title: "" })
    );
    expectNoTechnicalLeak(message);
    expect(message).toBe(SERVER_VALIDATION_MESSAGES.required);
  });

  it("returns generic message for empty issue list", () => {
    expect(toKoreanValidationMessage({ issues: [] } as unknown as z.ZodError)).toBe(
      SERVER_VALIDATION_MESSAGES.generic
    );
  });

  it("detects ZodError instances", () => {
    const schema = z.object({ name: z.string() });
    expect(isZodError(parseError(schema, {}))).toBe(true);
    expect(isZodError(new Error("nope"))).toBe(false);
  });
});
