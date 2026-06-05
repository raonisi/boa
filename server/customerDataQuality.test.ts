import { describe, expect, it } from "vitest";
import {
  buildDuplicateCandidateSet,
  calculateQualityScore,
  detectCustomerIssueTypes,
  getQualityLevel,
  maskCustomerDisplayName,
} from "./customerDataQuality";

describe("customerDataQuality scoring", () => {
  it("calculates score and level from issue penalties", () => {
    expect(calculateQualityScore(["missing_phone", "missing_birth_date"])).toBe(65);
    expect(getQualityLevel(95)).toBe("good");
    expect(getQualityLevel(80)).toBe("needs_improvement");
    expect(getQualityLevel(60)).toBe("caution");
    expect(getQualityLevel(30)).toBe("critical");
  });

  it("masks customer display names without exposing full names in lists", () => {
    expect(maskCustomerDisplayName("홍길동")).toBe("홍*동");
    expect(maskCustomerDisplayName("김철")).toBe("김*");
  });

  it("detects duplicate candidates by phone or name+birth date", () => {
    const duplicates = buildDuplicateCandidateSet([
      { id: 1, phone: "010-1234-5678", name: "홍길동", birthDate: "1990-01-01" },
      { id: 2, phone: "010-1234-5678", name: "홍길동", birthDate: "1990-01-01" },
      { id: 3, phone: "010-9999-0000", name: "김철수", birthDate: "1988-05-05" },
    ]);
    expect(duplicates.has(1)).toBe(true);
    expect(duplicates.has(2)).toBe(true);
    expect(duplicates.has(3)).toBe(false);
  });

  it("detects core issue types from customer context", () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    const context = {
      now,
      activeAgentIds: new Set([4]),
      duplicateCandidateIds: new Set<number>(),
      consultationDates: new Map<number, Date>([[103, new Date("2026-05-01")]]),
      followUpsByCustomer: new Map<number, any[]>(),
      schedulesByCustomer: new Map<number, any[]>(),
      contractsByCustomer: new Map<number, any[]>([[106, [{ id: 1 }]]]),
    };

    expect(detectCustomerIssueTypes({
      id: 101,
      phone: null,
      birthDate: null,
      consultStatus: "미상담",
      agentId: 4,
      customerTags: null,
      updatedAt: now,
    }, context)).toEqual(expect.arrayContaining(["missing_phone", "missing_birth_date", "missing_status"]));

    expect(detectCustomerIssueTypes({
      id: 103,
      phone: "01010000004",
      birthDate: "1990-01-04",
      consultStatus: "통화완료",
      agentId: 4,
      customerTags: null,
      updatedAt: now,
    }, context)).toContain("no_follow_up");

    expect(detectCustomerIssueTypes({
      id: 106,
      phone: "01010000006",
      birthDate: "1990-01-06",
      consultStatus: "계약",
      agentId: 4,
      customerTags: null,
      updatedAt: now,
    }, context)).toContain("contract_without_consultation");
  });
});
