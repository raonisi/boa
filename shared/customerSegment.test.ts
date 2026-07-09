import { describe, expect, it } from "vitest";
import {
  emptyCustomerSegmentCounts,
  getConcreteCustomerSegment,
} from "./customerSegment";

describe("customer segment classification", () => {
  it("classifies customers with active contracts as contracted", () => {
    expect(getConcreteCustomerSegment({ contractCount: 1 })).toBe(
      "contracted"
    );
  });

  it("classifies pre-contract activity as in-progress DB", () => {
    expect(getConcreteCustomerSegment({ consultationCount: 1 })).toBe(
      "in_progress_db"
    );
    expect(getConcreteCustomerSegment({ followUpCount: 1 })).toBe(
      "in_progress_db"
    );
    expect(getConcreteCustomerSegment({ nextAction: "전화" })).toBe(
      "in_progress_db"
    );
    expect(getConcreteCustomerSegment({ activityCount: 1 })).toBe(
      "in_progress_db"
    );
  });

  it("classifies assigned customers without contracts or activity as DB only", () => {
    expect(getConcreteCustomerSegment({})).toBe("db_only");
  });

  it("creates stable zero counts for all tabs", () => {
    expect(emptyCustomerSegmentCounts()).toEqual({
      all: 0,
      db_only: 0,
      in_progress_db: 0,
      contracted: 0,
    });
  });
});
