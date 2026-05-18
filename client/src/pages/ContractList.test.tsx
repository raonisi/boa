import { describe, expect, it } from "vitest";

import { getContractListStatus } from "./ContractList";

describe("getContractListStatus", () => {
  it("prioritizes loading and error states over empty data", () => {
    expect(getContractListStatus({
      isLoading: true,
      isError: false,
      totalCount: 0,
      filteredCount: 0,
      hasActiveFilters: false,
    })).toBe("loading");

    expect(getContractListStatus({
      isLoading: false,
      isError: true,
      totalCount: 0,
      filteredCount: 0,
      hasActiveFilters: false,
    })).toBe("error");
  });

  it("separates true empty contracts from filter no-result states", () => {
    expect(getContractListStatus({
      isLoading: false,
      isError: false,
      totalCount: 0,
      filteredCount: 0,
      hasActiveFilters: true,
    })).toBe("empty");

    expect(getContractListStatus({
      isLoading: false,
      isError: false,
      totalCount: 3,
      filteredCount: 0,
      hasActiveFilters: true,
    })).toBe("no-result");
  });

  it("keeps populated contract lists in the ready state", () => {
    expect(getContractListStatus({
      isLoading: false,
      isError: false,
      totalCount: 3,
      filteredCount: 2,
      hasActiveFilters: true,
    })).toBe("ready");
  });
});
