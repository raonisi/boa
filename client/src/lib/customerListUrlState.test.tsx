import { describe, expect, it } from "vitest";
import {
  normalizeCustomerSearch,
  parseCustomerListUrlState,
  writeCustomerListUrlState,
} from "./customerListUrlState";

describe("customer list URL state", () => {
  it("restores segment, search, filters, sorting, page and table view", () => {
    expect(
      parseCustomerListUrlState(
        "segment=contracted&search=%20%EA%B9%80%20%20%EB%B3%B4%ED%97%98%20&status=%EC%84%A4%EA%B3%84%EC%A4%91&priority=A&agent=4&tag=%EC%9E%A5%EA%B8%B0%EA%B4%80%EB%A6%AC&sort=contract_value&page=3&pageSize=50&view=table"
      )
    ).toMatchObject({
      segment: "contracted",
      search: "\uAE40 \uBCF4\uD5D8",
      status: "\uC124\uACC4\uC911",
      priority: "A",
      agent: "4",
      tag: "\uC7A5\uAE30\uAD00\uB9AC",
      sort: "contract_value",
      page: 3,
      pageSize: 50,
      view: "table",
    });
  });

  it("normalizes invalid values and forces card view on mobile", () => {
    expect(
      parseCustomerListUrlState(
        "segment=unknown&status=hidden&priority=VIP&agent=-2&tag=secret&nextAction=unknown&assignedFrom=2026-02-31&sort=wrong&page=-2&pageSize=777&view=table",
        { isMobile: true, defaultSegment: "database" }
      )
    ).toMatchObject({
      segment: "database",
      status: "all",
      priority: "all",
      agent: "all",
      tag: "all",
      nextAction: "all",
      assignedDateFrom: "",
      sort: "recent",
      page: 1,
      pageSize: 20,
      view: "card",
    });
  });

  it("maps legacy DB segments to the current database segment", () => {
    expect(parseCustomerListUrlState("segment=in_progress_db").segment).toBe(
      "database"
    );
  });

  it("writes only meaningful state while preserving unrelated preset", () => {
    const state = parseCustomerListUrlState("");
    const query = writeCustomerListUrlState("preset=today-follow-up", {
      ...state,
      segment: "contracted",
      search: "  \uAE40   \uBCF4\uD5D8 ",
      page: 2,
      view: "table",
    });
    expect(new URLSearchParams(query)).toEqual(
      new URLSearchParams(
        "preset=today-follow-up&segment=contracted&search=%EA%B9%80+%EB%B3%B4%ED%97%98&view=table&page=2"
      )
    );
  });

  it("normalizes search whitespace and length", () => {
    expect(normalizeCustomerSearch("  010  1234-5678  ")).toBe(
      "010 1234-5678"
    );
    expect(normalizeCustomerSearch("x".repeat(120))).toHaveLength(100);
  });
});
