import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  getDownloadReadinessItems,
  neutralizeSpreadsheetFormula,
} from "./Download";

describe("Download CSV safety", () => {
  it("neutralizes spreadsheet formula prefixes before CSV escaping", () => {
    for (const value of [
      "=cmd|calc",
      "=1+1",
      "+SUM(A1:A2)",
      "-10+20",
      '@HYPERLINK("http://example.test")',
      "\tTabbed",
      "\rCarriage",
      "\nLine",
    ]) {
      expect(neutralizeSpreadsheetFormula(value).startsWith("'")).toBe(true);
      expect(escapeCsvCell(value)).toContain("'");
    }
  });

  it("keeps ordinary numbers and dates readable while escaping CSV syntax", () => {
    expect(escapeCsvCell(120000)).toBe("120000");
    expect(escapeCsvCell("2026-05-18")).toBe("2026-05-18");
    expect(escapeCsvCell("plain text")).toBe("plain text");
    expect(escapeCsvCell("contains,comma")).toBe('"contains,comma"');
    expect(escapeCsvCell('contains "quote"')).toBe('"contains ""quote"""');
  });
});

describe("getDownloadReadinessItems", () => {
  it("marks blocking items until reason, masking choice, and final confirmation are satisfied", () => {
    const blocked = getDownloadReadinessItems({
      previewLoading: false,
      rowCount: 12,
      reason: "짧음",
      maskedDownload: true,
      rawExportConfirmed: false,
      finalConfirmed: false,
    });

    expect(blocked.find(item => item.id === "reason")?.done).toBe(false);
    expect(blocked.find(item => item.id === "final")?.done).toBe(false);
    expect(blocked.find(item => item.id === "scope")?.done).toBe(true);
    expect(blocked.find(item => item.id === "masking")?.done).toBe(true);

    const ready = getDownloadReadinessItems({
      previewLoading: false,
      rowCount: 12,
      reason: "월말 실적 점검용 내부 확인",
      maskedDownload: true,
      rawExportConfirmed: false,
      finalConfirmed: true,
    });

    expect(ready.every(item => item.done)).toBe(true);
  });

  it("requires raw export approval when masking is disabled", () => {
    const items = getDownloadReadinessItems({
      previewLoading: false,
      rowCount: 3,
      reason: "감사 대응 자료 확인",
      maskedDownload: false,
      rawExportConfirmed: false,
      finalConfirmed: true,
    });

    expect(items.find(item => item.id === "raw")?.done).toBe(false);
  });
});
