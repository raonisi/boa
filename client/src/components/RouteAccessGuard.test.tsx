import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RouteAccessGuard } from "./RouteAccessGuard";

const useAuthMock = vi.fn(() => ({
  user: { role: "branch_admin", accountStatus: "active" },
  loading: false,
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/components/ForbiddenState", () => ({
  ForbiddenState: () => <div data-testid="forbidden">접근 권한이 없습니다</div>,
}));

describe("RouteAccessGuard", () => {
  it("renders children when route access is allowed", () => {
    const html = renderToStaticMarkup(
      <RouteAccessGuard path="/referrals">
        <div>allowed-content</div>
      </RouteAccessGuard>
    );
    expect(html).toContain("allowed-content");
    expect(html).not.toContain("접근 권한이 없습니다");
  });

  it("renders standard forbidden state when route access is denied", () => {
    useAuthMock.mockReturnValueOnce({
      user: { role: "member", accountStatus: "inactive" },
      loading: false,
    });

    const html = renderToStaticMarkup(
      <RouteAccessGuard path="/referrals">
        <div>allowed-content</div>
      </RouteAccessGuard>
    );

    expect(html).toContain("접근 권한이 없습니다");
    expect(html).not.toContain("allowed-content");
  });

  it("shows loading instead of forbidden while auth is resolving", () => {
    useAuthMock.mockReturnValueOnce({
      user: undefined as never,
      loading: true,
    });

    const html = renderToStaticMarkup(
      <RouteAccessGuard path="/logs">
        <div>allowed-content</div>
      </RouteAccessGuard>
    );

    expect(html).not.toContain("allowed-content");
    expect(html).not.toContain("접근 권한이 없습니다");
    expect(html).toContain("animate-spin");
  });

  it("does not mount children when access is denied (query-before-guard)", () => {
    let childMounted = false;
    function TrackedChild() {
      childMounted = true;
      return <div>tracked-child</div>;
    }

    useAuthMock.mockReturnValueOnce({
      user: { role: "member", accountStatus: "active" },
      loading: false,
    });

    renderToStaticMarkup(
      <RouteAccessGuard path="/logs">
        <TrackedChild />
      </RouteAccessGuard>
    );

    expect(childMounted).toBe(false);
  });

  it("mounts children when manager access is allowed", () => {
    let childMounted = false;
    function TrackedChild() {
      childMounted = true;
      return <div>tracked-child</div>;
    }

    useAuthMock.mockReturnValueOnce({
      user: { role: "team_leader", accountStatus: "active" },
      loading: false,
    });

    renderToStaticMarkup(
      <RouteAccessGuard path="/logs">
        <TrackedChild />
      </RouteAccessGuard>
    );

    expect(childMounted).toBe(true);
  });
});
