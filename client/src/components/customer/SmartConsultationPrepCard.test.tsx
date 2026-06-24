import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SmartConsultationPrepCard } from "./SmartConsultationPrepCard";

const noop = () => {};

describe("SmartConsultationPrepCard", () => {
  const baseProps = {
    isMobile: false,
    customer: {
      consultStatus: "계약",
      priority: "A",
      nextAction: "사후관리",
    },
    customerTags: ["보장불안형"],
    agentName: "[TEST] Agent",
    latestConsult: {
      summary: "[TEST] 최근 상담 요약",
      consultationDate: "2026-06-01",
    },
    latestConsultDate: "2026-06-01",
    nextFollowUp: {
      reason: "[TEST] Follow reason",
      nextContactDate: "2026-06-10",
    },
    contactReasons: {
      warnings: [{ warningType: "follow_up", message: "[TEST] Warning" }],
      reasons: [{ reasonType: "general_check", title: "[TEST] Reason" }],
    },
    handoffNotes: [
      {
        noteType: "approach",
        title: "[TEST] Handoff",
        body: "차분히 설명",
      },
    ],
    hasOpenRetentionRisk: false,
    hasOpenClaimGuidance: false,
    hasReferralFlows: true,
    hasRelationships: true,
    onConsultRecord: noop,
    onFollowUpCreate: noop,
    onOpenTemplates: noop,
    onOpenChecklist: noop,
    onOpenTimeline: noop,
    onOpenHandoff: noop,
    onOpenRelationships: noop,
    onOpenReferrals: noop,
  };

  it("renders prep card sections and customer status", () => {
    const html = renderToStaticMarkup(
      <SmartConsultationPrepCard {...baseProps} />
    );
    expect(html).toContain("스마트 상담 준비 카드");
    expect(html).toContain("상담 전 꼭 확인할 기준만");
    expect(html).toContain("보장불안형");
    expect(html).toContain("오늘 상담 목표");
    expect(html).toContain("피해야 할 말");
    expect(html).toContain("상담기록 작성");
  });

  it("shows forbidden phrases and no pressure marketing copy", () => {
    const html = renderToStaticMarkup(
      <SmartConsultationPrepCard {...baseProps} />
    );
    expect(html).toContain("무조건 유지하세요");
    expect(html).not.toContain("반드시 유지");
    expect(html).not.toContain("유지율");
    expect(html).not.toContain("가입 권유");
  });

  it("shows empty states when consult and follow-up missing", () => {
    const html = renderToStaticMarkup(
      <SmartConsultationPrepCard
        {...baseProps}
        latestConsult={null}
        latestConsultDate={null}
        nextFollowUp={null}
        contactReasons={{ warnings: [], reasons: [] }}
      />
    );
    expect(html).toContain("최근 상담기록 없음");
    expect(html).toContain("예정된 후속관리 없음");
  });

  it("renders mobile summary mode collapsed by default", () => {
    const html = renderToStaticMarkup(
      <SmartConsultationPrepCard {...baseProps} isMobile />
    );
    expect(html).toContain("자세히 보기");
    expect(html).toContain("상담 목표");
  });

  it("uses line-clamp for long memo areas", () => {
    const html = renderToStaticMarkup(
      <SmartConsultationPrepCard
        {...baseProps}
        latestConsult={{ summary: "긴 메모 ".repeat(30) }}
      />
    );
    expect(html).toContain("line-clamp-2");
  });
});
