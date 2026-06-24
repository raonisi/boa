import { describe, expect, it, vi } from "vitest";
import {
  applyCustomerDetailAction,
  buildCustomerDetailPath,
  parseCustomerDetailAction,
} from "./customerDetailActions";

describe("customerDetailActions", () => {
  it("accepts whitelisted action values only", () => {
    expect(parseCustomerDetailAction("consult")).toBe("consult");
    expect(parseCustomerDetailAction("quick-followup")).toBe("quick-followup");
    expect(parseCustomerDetailAction("followup")).toBe("followup");
    expect(parseCustomerDetailAction("contract")).toBe("contract");
    expect(parseCustomerDetailAction("message")).toBe("message");
    expect(parseCustomerDetailAction("auto-save")).toBe("invalid");
    expect(parseCustomerDetailAction(null)).toBeNull();
  });

  it("builds customer detail paths without sensitive query data", () => {
    expect(buildCustomerDetailPath(42)).toBe("/customers/42");
    expect(buildCustomerDetailPath(42, "consult")).toBe(
      "/customers/42?action=consult"
    );
    expect(buildCustomerDetailPath(42, "quick-followup")).toBe(
      "/customers/42?action=quick-followup"
    );
  });

  it("routes supported actions to existing handlers only", () => {
    const onConsult = vi.fn();
    const onQuickFollowup = vi.fn();
    const onContract = vi.fn();
    const onMessage = vi.fn();
    const handlers = { onConsult, onQuickFollowup, onContract, onMessage };

    applyCustomerDetailAction("consult", handlers);
    applyCustomerDetailAction("quick-followup", handlers);
    applyCustomerDetailAction("followup", handlers);
    applyCustomerDetailAction("contract", handlers);
    applyCustomerDetailAction("message", handlers);

    expect(onConsult).toHaveBeenCalledTimes(1);
    expect(onQuickFollowup).toHaveBeenCalledTimes(2);
    expect(onContract).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});
