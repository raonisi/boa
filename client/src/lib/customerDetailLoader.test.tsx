import { describe, expect, it } from "vitest";
import { CustomerDetailChunkError, classifyCustomerDetailResponse, resolveCustomerDetailChunkPath } from "./customerDetailLoader";

const origin = "https://crm.example.test";
describe("CustomerDetail retry sources", () => {
  it("uses only the current document's matching same-origin preload", () => {
    expect(resolveCustomerDetailChunkPath(["/assets/vendor-abc.js", "/assets/CustomerDetail-ab_C-12.js"], origin)).toBe("/assets/CustomerDetail-ab_C-12.js");
    expect(resolveCustomerDetailChunkPath([origin + "/assets/CustomerDetail-ab_C-12.js"], origin)).toBe("/assets/CustomerDetail-ab_C-12.js");
  });
  it.each([
    "https://external.example/assets/CustomerDetail-abc.js",
    "//external.example/assets/CustomerDetail-abc.js",
    "https://user:secret@crm.example.test/assets/CustomerDetail-abc.js",
    "/assets/OtherPage-abc.js", "/arbitrary.js", "/assets/CustomerDetail-abc.js?script=other",
    "/assets/CustomerDetail-abc.js#other", "/assets/../arbitrary.js",
    "/assets/CustomerDetail-%61bc.js", "javascript:alert(1)", "/src/pages/CustomerDetail.tsx",
  ])("rejects unowned script source %s", href => {
    expect(resolveCustomerDetailChunkPath([href], origin)).toBeUndefined();
  });
  it("allows exactly the Vite dev route only in development", () => {
    expect(resolveCustomerDetailChunkPath(["/src/pages/CustomerDetail.tsx"], origin, true)).toBe("/src/pages/CustomerDetail.tsx");
    expect(resolveCustomerDetailChunkPath(["/src/pages/OtherPage.tsx"], origin, true)).toBeUndefined();
    expect(resolveCustomerDetailChunkPath(["/assets/CustomerDetail-abc.js"], origin, true)).toBeUndefined();
  });
});

describe("CustomerDetail failure guidance", () => {
  it.each([404, 410])("recognizes missing deployment asset %i", status => {
    expect(classifyCustomerDetailResponse(status, "text/javascript")).toBe("missing");
  });
  it.each(["text/html; charset=utf-8", "application/json", "", "text/plain"])("rejects HTTP200 non-module MIME %s", mime => {
    expect(classifyCustomerDetailResponse(200, mime)).toBe("html");
  });
  it.each(["text/javascript; charset=utf-8", "application/javascript", "TEXT/ECMASCRIPT"])("keeps recoverable guidance for valid module MIME %s", mime => {
    expect(classifyCustomerDetailResponse(200, mime)).toBe("network");
  });
  it("keeps retry manual and finite while offering stale-asset refresh guidance", () => {
    expect(new CustomerDetailChunkError("network", 1)).toMatchObject({ canRetry: true, refreshRequired: false });
    expect(new CustomerDetailChunkError("network", 2)).toMatchObject({ canRetry: true, refreshRequired: true });
    expect(new CustomerDetailChunkError("missing", 1)).toMatchObject({ canRetry: true, refreshRequired: true });
    expect(new CustomerDetailChunkError("html", 1)).toMatchObject({ canRetry: true, refreshRequired: true });
    expect(new CustomerDetailChunkError("invalid-path", 1)).toMatchObject({ canRetry: true, refreshRequired: true });
    expect(new CustomerDetailChunkError("invalid-module", 1)).toMatchObject({ canRetry: true, refreshRequired: true });
    const exhausted = new CustomerDetailChunkError("exhausted", 4);
    expect(exhausted).toMatchObject({ canRetry: false, refreshRequired: true });
    expect(exhausted.message).toContain("새로고침");
  });
});
