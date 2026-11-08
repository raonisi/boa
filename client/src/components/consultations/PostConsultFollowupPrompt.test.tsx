import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PostConsultFollowupPrompt from "./PostConsultFollowupPrompt";

describe("PostConsultFollowupPrompt Component", () => {
  it("renders recommended title and description correctly", () => {
    const html = renderToStaticMarkup(
      <PostConsultFollowupPrompt
        prompt={{
          customerId: 101,
          hasCalendarSchedule: false,
        }}
        openFollowUpsCount={0}
        onOpenFollowUp={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(html).toContain("상담기록이 저장되었습니다.");
    expect(html).toContain("다음 연락이 필요하다면 후속관리로 이어서 등록할 수 있습니다.");
    expect(html).toContain("후속관리 등록");
    expect(html).toContain("나중에 처리");
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="상담 저장 후 후속관리 안내"');
    expect(html).toContain('data-testid="post-consult-followup-prompt"');
    expect(html).toContain('data-testid="post-consult-create-followup-button"');
    expect(html).toContain('data-testid="post-consult-dismiss-button"');
  });

  it("renders calendar schedule badge when calendar event was created", () => {
    const html = renderToStaticMarkup(
      <PostConsultFollowupPrompt
        prompt={{
          customerId: 101,
          hasCalendarSchedule: true,
          nextContactAt: "2026-11-05T14:00",
        }}
        openFollowUpsCount={0}
        onOpenFollowUp={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(html).toContain("캘린더 일정 등록됨");
    expect(html).not.toContain("기존 후속관리");
  });

  it("renders existing follow-up count badge when customer already has open follow-ups", () => {
    const html = renderToStaticMarkup(
      <PostConsultFollowupPrompt
        prompt={{
          customerId: 101,
          hasCalendarSchedule: false,
        }}
        openFollowUpsCount={2}
        onOpenFollowUp={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(html).toContain("기존 후속관리 2건");
    expect(html).not.toContain("캘린더 일정 등록됨");
  });

  it("renders both badges when calendar schedule was created and customer already has follow-ups", () => {
    const html = renderToStaticMarkup(
      <PostConsultFollowupPrompt
        prompt={{
          customerId: 101,
          hasCalendarSchedule: true,
        }}
        openFollowUpsCount={3}
        onOpenFollowUp={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(html).toContain("캘린더 일정 등록됨");
    expect(html).toContain("기존 후속관리 3건");
  });

  it("provides touch-compliant min-h-11 targets on mobile for both buttons", () => {
    const html = renderToStaticMarkup(
      <PostConsultFollowupPrompt
        prompt={{
          customerId: 101,
          hasCalendarSchedule: false,
        }}
        openFollowUpsCount={0}
        onOpenFollowUp={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(html).toContain("min-h-11");
  });
});
