import { describe, expect, it } from "vitest";
import { escapeCsvCell, neutralizeSpreadsheetFormula } from "./Download";

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
