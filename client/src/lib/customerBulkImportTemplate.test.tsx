import { describe, expect, it } from "vitest";
import {
  BULK_IMPORT_TEMPLATE_BRANCH_ADMIN_SAMPLE_ROW,
  BULK_IMPORT_TEMPLATE_NON_ADMIN_SAMPLE_ROW,
  buildBulkImportTemplateGuideRows,
  getBulkImportTemplateSampleRow,
} from "./customerBulkImportTemplate";

const BRANCH_ADMIN_HEADERS = [
  "이름",
  "생년월일",
  "연락처",
  "성별",
  "지역",
  "예상보험료(만원)",
  "통화가능시간",
  "유입경로",
  "DB 업체명",
  "상담상태",
  "메모",
  "상담기록",
  "상담일시",
  "상담메모",
  "다음연락일",
  "담당자",
] as const;

const NON_ADMIN_HEADERS = BRANCH_ADMIN_HEADERS.slice(0, -1);

function zipHeadersWithSample(headers: readonly string[], sample: readonly string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, sample[index]]));
}

describe("customerBulkImportTemplate", () => {
  it("aligns branch-admin sample values with headers", () => {
    const mapped = zipHeadersWithSample(
      BRANCH_ADMIN_HEADERS,
      BULK_IMPORT_TEMPLATE_BRANCH_ADMIN_SAMPLE_ROW
    );

    expect(BRANCH_ADMIN_HEADERS).toHaveLength(
      BULK_IMPORT_TEMPLATE_BRANCH_ADMIN_SAMPLE_ROW.length
    );
    expect(mapped["상담기록"]).toBe("부재");
    expect(mapped["상담일시"]).toBe("2026-06-25 10:00");
    expect(mapped["상담메모"]).toBe("초기 통화 연결되지 않음");
    expect(mapped["다음연락일"]).toBe("2026-06-27 11:00");
    expect(mapped["담당자"]).toBe("김담당");
  });

  it("aligns non-admin sample values with headers", () => {
    const mapped = zipHeadersWithSample(
      NON_ADMIN_HEADERS,
      BULK_IMPORT_TEMPLATE_NON_ADMIN_SAMPLE_ROW
    );

    expect(NON_ADMIN_HEADERS).toHaveLength(
      BULK_IMPORT_TEMPLATE_NON_ADMIN_SAMPLE_ROW.length
    );
    expect(mapped["상담기록"]).toBe("부재");
    expect(mapped["담당자"]).toBeUndefined();
  });

  it("includes 상담기록 in optional column guide and splits assignee guidance by role", () => {
    const branchGuide = buildBulkImportTemplateGuideRows(true);
    const memberGuide = buildBulkImportTemplateGuideRows(false);

    expect(branchGuide[2]?.[1]).toContain("상담기록");
    expect(branchGuide[2]?.[1]).toContain("담당자");
    expect(memberGuide[2]?.[1]).toContain("상담기록");
    expect(memberGuide[2]?.[1]).not.toContain("담당자");
    expect(branchGuide.some(row => row[0] === "지점장 배정")).toBe(true);
    expect(memberGuide.some(row => row[0] === "비관리자 배정")).toBe(true);
  });

  it("returns role-specific sample rows", () => {
    expect(getBulkImportTemplateSampleRow(true)).toEqual([
      ...BULK_IMPORT_TEMPLATE_BRANCH_ADMIN_SAMPLE_ROW,
    ]);
    expect(getBulkImportTemplateSampleRow(false)).toEqual([
      ...BULK_IMPORT_TEMPLATE_NON_ADMIN_SAMPLE_ROW,
    ]);
  });
});
