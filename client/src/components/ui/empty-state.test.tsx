import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmptyState, ErrorState, ForbiddenInlineState } from "./empty-state";

describe("shared state components", () => {
  it("renders empty states with a clear next action", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="등록된 고객이 없습니다."
        description="새 고객을 등록하거나 필터를 초기화해 보세요."
        actionLabel="고객 등록"
        onAction={() => undefined}
      />
    );

    expect(html).toContain("등록된 고객이 없습니다.");
    expect(html).toContain("고객 등록");
    expect(html).toContain("status");
  });

  it("renders recoverable errors without technical details", () => {
    const html = renderToStaticMarkup(
      <ErrorState description="잠시 후 다시 시도해 주세요." onRetry={() => undefined} />
    );

    expect(html).toContain("데이터를 불러오지 못했습니다.");
    expect(html).toContain("다시 시도");
    expect(html).not.toContain("stack");
    expect(html).not.toContain("token");
  });

  it("renders forbidden states without implying protected data exists", () => {
    const html = renderToStaticMarkup(
      <ForbiddenInlineState description="이 화면은 현재 권한으로 사용할 수 없습니다." />
    );

    expect(html).toContain("접근 권한이 없습니다.");
    expect(html).toContain("현재 권한");
    expect(html).not.toContain("고객명");
    expect(html).not.toContain("전화번호");
    expect(html).not.toContain("생년월일");
  });
});
