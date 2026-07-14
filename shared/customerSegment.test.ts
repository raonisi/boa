import { describe, expect, it } from "vitest";
import {
  emptyCustomerSegmentCounts,
  getConcreteCustomerSegment,
  isActiveCustomerContract,
} from "./customerSegment";

describe("customer segment classification", () => {
  it("classifies customers with active contracts as contracted", () => {
    expect(getConcreteCustomerSegment({ contractCount: 1 })).toBe(
      "contracted"
    );
    expect(getConcreteCustomerSegment({ contractCount: 2 })).toBe(
      "contracted"
    );
  });

  it("classifies customers without active contracts as database customers", () => {
    expect(getConcreteCustomerSegment({})).toBe("database");
    expect(getConcreteCustomerSegment({ contractCount: 0 })).toBe("database");
  });

  it.each([
    { contractStatus: "철회" },
    { contractStatus: "해지" },
    { paymentStatus: "실효" },
    { paymentStatus: "해지" },
    { isActive: false },
    { deletedAt: "2026-07-14T00:00:00.000Z" },
  ])("excludes non-current contract state %#", state => {
    expect(isActiveCustomerContract(state)).toBe(false);
  });

  it.each([
    { contractStatus: "청약", paymentStatus: "정상" },
    { contractStatus: "성립", paymentStatus: "미납" },
    { contractStatus: "유지", paymentStatus: "정상" },
    { contractStatus: null, paymentStatus: null },
  ])("keeps objectively active contract state %#", state => {
    expect(isActiveCustomerContract(state)).toBe(true);
  });

  it("creates stable zero counts for all tabs", () => {
    expect(emptyCustomerSegmentCounts()).toEqual({
      all: 0,
      database: 0,
      contracted: 0,
    });
  });
});
