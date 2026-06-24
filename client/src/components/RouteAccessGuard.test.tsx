import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RouteAccessGuard } from "./RouteAccessGuard";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { role: "branch_admin", accountStatus: "active" },
  })),
}));

vi.mock("@/components/ForbiddenState", () => ({
  ForbiddenState: () => <div data-testid="forbidden">접근 권한이 없습니다</div>,
}));

describe("RouteAccessGuard", () => {
  it("renders children when route access is allowed", async () => {
    const html = renderToStaticMarkup(
      <RouteAccessGuard path="/referrals">
        <div>allowed-content</div>
      </RouteAccessGuard>
    );
    expect(html).toContain("allowed-content");
    expect(html).not.toContain("접근 권한이 없습니다");
  });

  it("renders standard forbidden state when route access is denied", async () => {
    const { useAuth } = await import("@/_core/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { role: "member", accountStatus: "inactive" },
    } as never);

    const html = renderToStaticMarkup(
      <RouteAccessGuard path="/referrals">
        <div>allowed-content</div>
      </RouteAccessGuard>
    );

    expect(html).toContain("접근 권한이 없습니다");
    expect(html).not.toContain("allowed-content");
  });
});
