import { describe, expect, it } from "vitest";
import {
  canLoadCustomerDetailDependencies,
  shouldShowCustomerDetailLoadingShell,
  shouldShowCustomerDetailUnavailable,
} from "./customerDetailQueryGating";

const baseState = {
  customerId: 42,
  customer: { id: 42 },
  isLoading: false,
  isError: false,
  isFetching: false,
};

describe("customerDetailQueryGating", () => {
  describe("canLoadCustomerDetailDependencies", () => {
    it("allows dependencies when base customer access is resolved for the current id", () => {
      expect(canLoadCustomerDetailDependencies(baseState)).toBe(true);
    });

    it("blocks dependencies while base customer query is loading", () => {
      expect(
        canLoadCustomerDetailDependencies({
          ...baseState,
          customer: undefined,
          isLoading: true,
        })
      ).toBe(false);
    });

    it("blocks dependencies when base customer query fails", () => {
      expect(
        canLoadCustomerDetailDependencies({
          ...baseState,
          customer: undefined,
          isError: true,
        })
      ).toBe(false);
    });

    it("blocks dependencies when customer id does not match route id", () => {
      expect(
        canLoadCustomerDetailDependencies({
          ...baseState,
          customerId: 99,
          customer: { id: 42 },
        })
      ).toBe(false);
    });

    it("blocks dependencies for invalid customer ids", () => {
      expect(
        canLoadCustomerDetailDependencies({
          ...baseState,
          customerId: Number.NaN,
          customer: undefined,
        })
      ).toBe(false);
    });
  });

  describe("shouldShowCustomerDetailLoadingShell", () => {
    it("shows loading while base customer query is pending", () => {
      expect(
        shouldShowCustomerDetailLoadingShell({
          ...baseState,
          customer: undefined,
          isLoading: true,
        })
      ).toBe(true);
    });

    it("shows loading while switching to another customer id", () => {
      expect(
        shouldShowCustomerDetailLoadingShell({
          ...baseState,
          customerId: 99,
          customer: { id: 42 },
          isFetching: true,
        })
      ).toBe(true);
    });

    it("keeps the resolved shell during background refetch for the same customer", () => {
      expect(
        shouldShowCustomerDetailLoadingShell({
          ...baseState,
          isFetching: true,
        })
      ).toBe(false);
    });
  });

  describe("shouldShowCustomerDetailUnavailable", () => {
    it("shows unavailable for base customer query failures", () => {
      expect(
        shouldShowCustomerDetailUnavailable({
          ...baseState,
          customer: undefined,
          isError: true,
        })
      ).toBe(true);
    });

    it("shows unavailable for invalid customer ids", () => {
      expect(
        shouldShowCustomerDetailUnavailable({
          ...baseState,
          customerId: 0,
          customer: undefined,
        })
      ).toBe(true);
    });

    it("does not show unavailable while loading shell should be shown", () => {
      expect(
        shouldShowCustomerDetailUnavailable({
          ...baseState,
          customer: undefined,
          isLoading: true,
        })
      ).toBe(false);
    });
  });
});
