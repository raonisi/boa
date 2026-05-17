import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorFallback } from "./ErrorBoundary";

describe("ErrorFallback", () => {
  it("hides stack traces from the production user-facing state", () => {
    const error = new Error("sensitive failure");
    error.stack = "Error: sensitive failure\n    at SecretPath (C:/internal/token.ts:1:1)";

    const html = renderToStaticMarkup(<ErrorFallback error={error} showDetails={false} />);

    expect(html).toContain("문제가 발생했습니다.");
    expect(html).toContain("다시 시도");
    expect(html).toContain("홈으로 이동");
    expect(html).not.toContain("SecretPath");
    expect(html).not.toContain("C:/internal");
    expect(html).not.toContain("개발자 오류 정보");
  });

  it("keeps developer details available when explicitly enabled", () => {
    const error = new Error("developer-only failure");
    error.stack = "Error: developer-only failure\n    at Component.tsx:10:1";

    const html = renderToStaticMarkup(<ErrorFallback error={error} showDetails />);

    expect(html).toContain("개발자 오류 정보");
    expect(html).toContain("developer-only failure");
  });
});
