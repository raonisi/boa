import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorFallback } from "./ErrorBoundary";

describe("ErrorFallback", () => {
  it("never exposes stack traces or raw error messages to users", () => {
    const error = new Error("sensitive failure");
    error.stack =
      "Error: sensitive failure\n    at SecretPath (C:/internal/token.ts:1:1)";

    const html = renderToStaticMarkup(
      <ErrorFallback error={error} />
    );

    expect(html).toContain("문제가 발생했습니다.");
    expect(html).toContain("다시 시도");
    expect(html).toContain("홈으로 이동");
    expect(html).not.toContain("SecretPath");
    expect(html).not.toContain("C:/internal");
    expect(html).not.toContain("sensitive failure");
    expect(html).not.toContain("개발자 오류 정보");
  });

  it("renders the same safe copy when no error object is provided", () => {
    const html = renderToStaticMarkup(<ErrorFallback />);

    expect(html).toContain("문제가 발생했습니다.");
    expect(html).not.toContain("<pre");
  });
});
