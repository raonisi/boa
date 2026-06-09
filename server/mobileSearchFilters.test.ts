import { describe, expect, it } from "vitest";
import {
  filterMobileContracts,
  filterMobileCustomers,
  paginateMobileList,
  parseMobileSearchQuery,
} from "./mobileSearchFilters";

describe("parseMobileSearchQuery", () => {
  it("accepts trimmed search under 100 chars", () => {
    expect(parseMobileSearchQuery("  alpha  ")).toEqual({ ok: true, value: "alpha" });
    expect(parseMobileSearchQuery("")).toEqual({ ok: true, value: undefined });
    expect(parseMobileSearchQuery(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("rejects invalid queries", () => {
    expect(parseMobileSearchQuery("x".repeat(101))).toEqual({ ok: false });
    expect(parseMobileSearchQuery(42)).toEqual({ ok: false });
  });
});

describe("filterMobileCustomers", () => {
  const rows = [
    { id: 1, name: "[TEST] Alpha", consultStatus: "미상담", phone: "01011112222" },
    { id: 2, name: "[TEST] Beta", consultStatus: "계약", nextAction: "재연락" },
    { id: 3, name: "[TEST] Gamma", priority: "VIP" },
  ];

  it("filters by name across full scoped list", () => {
    const filtered = filterMobileCustomers(rows, "gamma");
    expect(filtered.map((r) => r.id)).toEqual([3]);
  });

  it("filters by status and nextAction", () => {
    expect(filterMobileCustomers(rows, "재연락").map((r) => r.id)).toEqual([2]);
    expect(filterMobileCustomers(rows, "미상담").map((r) => r.id)).toEqual([1]);
  });

  it("returns all rows when search empty", () => {
    expect(filterMobileCustomers(rows, "   ")).toHaveLength(3);
  });
});

describe("filterMobileContracts", () => {
  const rows = [
    { id: 1, productName: "[TEST] Product A", company: "Insurer One", contractStatus: "유지" },
    { id: 2, productName: "[TEST] Product B", company: "Insurer Two", paymentStatus: "미납" },
  ];

  it("filters by product and company", () => {
    expect(filterMobileContracts(rows, "product b").map((r) => r.id)).toEqual([2]);
    expect(filterMobileContracts(rows, "insurer one").map((r) => r.id)).toEqual([1]);
  });

  it("filters by contract status fields", () => {
    expect(filterMobileContracts(rows, "미납").map((r) => r.id)).toEqual([2]);
  });
});

describe("paginateMobileList", () => {
  it("applies offset/limit after filtering", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
    const page = paginateMobileList(rows, 2, 2);
    expect(page.items.map((r) => r.id)).toEqual([3, 4]);
    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(4);
  });
});
