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
import { EmptyState, ErrorState, ForbiddenInlineState, LoadingState, LoadingMetric, NotFoundState, renderMetricValue } from "./empty-state";

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
    const html = renderToStaticMarkup(<LoadingState />);

    expect(html).toContain("정보를 불러오고 있습니다.");
    expect(html).toContain("aria-label=\"불러오는 중\"");
    expect(html).toContain("aria-busy=\"true\"");
  });

  it("renders loading metrics with Korean accessibility label", () => {
    const html = renderToStaticMarkup(<LoadingMetric className="h-7 w-12" />);
    expect(html).toContain("aria-label=\"불러오는 중\"");
    expect(html).toContain("role=\"status\"");
  });

  it("renders metric values with loading and error fallbacks", () => {
    const loading = renderToStaticMarkup(
      <span>{renderMetricValue(12, { isLoading: true, isError: false })}</span>
    );
    const error = renderToStaticMarkup(
      <span>{renderMetricValue(12, { isLoading: false, isError: true })}</span>
    );
    expect(loading).toContain("불러오는 중");
    expect(error).toContain("—");
    expect(error).not.toContain("12");
  });

  it("renders recoverable errors without technical details", () => {
    const html = renderToStaticMarkup(
      <ErrorState
        description="잠시 후 다시 시도해 주세요."
        onRetry={() => undefined}
      />
    );

    expect(html).toContain("정보를 불러오지 못했습니다.");
    expect(html).toContain("다시 시도");
    expect(html).not.toContain("stack");
    expect(html).not.toContain("token");
  });

  it("renders forbidden states without implying protected data exists", () => {
    const html = renderToStaticMarkup(<ForbiddenInlineState />);

    expect(html).toContain("접근 권한이 없습니다");
    expect(html).toContain("현재 권한으로는 이 기능을 사용할 수 없습니다.");
    expect(html).toContain("대시보드로 이동");
    expect(html).not.toContain("고객명");
    expect(html).not.toContain("전화번호");
    expect(html).not.toContain("생년월일");
  });

  it("renders not-found guidance in Korean", () => {
    const html = renderToStaticMarkup(
      <NotFoundState onAction={() => undefined} />
    );

    expect(html).toContain("요청한 화면을 찾을 수 없습니다.");
    expect(html).toContain("이전 화면");
    expect(html).not.toContain("NotFound");
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

  it("uses inactive variant for resigned account status", () => {
    const html = renderToStaticMarkup(<StatusBadge status="resigned" />);
    expect(html).toContain("퇴사자");
    expect(html).toContain("ring-border/60");
  });

  it("uses neutral fallback for unknown status values", () => {
    const html = renderToStaticMarkup(<StatusBadge status="unknown_enum" />);
    expect(html).toContain("기타 상태");
    expect(html).toContain("bg-muted");
  });
});
