import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CoachingPriorityBadge,
  getPriorityLabel,
  getStatusLabel,
  PriorityBadge,
  StatusBadge,
} from "@/components/StatusBadge";
import { EmptyState, ErrorState, ForbiddenInlineState, LoadingState } from "./empty-state";

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

  it("renders loading states with Korean accessibility labels", () => {
    const html = renderToStaticMarkup(
      <LoadingState title="고객 목록을 불러오는 중…" />
    );

    expect(html).toContain("고객 목록을 불러오는 중");
    expect(html).toContain("aria-label=\"불러오는 중\"");
    expect(html).toContain("aria-busy=\"true\"");
  });

  it("renders recoverable errors without technical details", () => {
    const html = renderToStaticMarkup(
      <ErrorState
        description="잠시 후 다시 시도해 주세요."
        onRetry={() => undefined}
      />
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

describe("StatusBadge family", () => {
  it("maps English enums to Korean labels", () => {
    expect(getStatusLabel("pending")).toBe("대기");
    expect(getStatusLabel("active")).toBe("활성");
    expect(getStatusLabel("unknown_enum")).toBe("기타 상태");
  });

  it("preserves Korean consult statuses", () => {
    const html = renderToStaticMarkup(<StatusBadge status="미상담" />);
    expect(html).toContain("미상담");
  });

  it("renders customer priority badges consistently", () => {
    const html = renderToStaticMarkup(<PriorityBadge priority="A" />);
    expect(html).toContain("A");
    expect(getPriorityLabel("unclassified")).toBe("미분류");
  });

  it("does not expose raw English coaching priority", () => {
    const html = renderToStaticMarkup(<CoachingPriorityBadge priority="high" />);
    expect(html).toContain("높음");
    expect(html).not.toContain("HIGH");
  });
});
