import { describe, expect, it } from "vitest";
import { canAccessRoutePath, getRouteAccessRoles } from "./routeAccess";

describe("canAccessRoutePath", () => {
  it("allows branch_admin on manager-only routes", () => {
    expect(
      canAccessRoutePath("/logs", {
        role: "branch_admin",
        accountStatus: "active",
      })
    ).toBe(true);
    expect(
      canAccessRoutePath("/customers/merge", {
        role: "branch_admin",
        accountStatus: "active",
      })
    ).toBe(true);
  });

  it("blocks member from manager-only management routes", () => {
    expect(
      canAccessRoutePath("/logs", { role: "member", accountStatus: "active" })
    ).toBe(false);
    expect(
      canAccessRoutePath("/operation-risk", {
        role: "member",
        accountStatus: "active",
      })
    ).toBe(false);
    expect(
      canAccessRoutePath("/customers/merge", {
        role: "member",
        accountStatus: "active",
      })
    ).toBe(false);
  });

  it("allows member on operational module routes", () => {
    expect(
      canAccessRoutePath("/referrals", {
        role: "member",
        accountStatus: "active",
      })
    ).toBe(true);
    expect(
      canAccessRoutePath("/claim-guidance", {
        role: "member",
        accountStatus: "active",
      })
    ).toBe(true);
    expect(
      canAccessRoutePath("/google-calendar-integration", {
        role: "member",
        accountStatus: "active",
      })
    ).toBe(true);
  });

  it("blocks inactive and resigned accounts", () => {
    expect(
      canAccessRoutePath("/referrals", {
        role: "member",
        accountStatus: "inactive",
      })
    ).toBe(false);
    expect(
      canAccessRoutePath("/referrals", {
        role: "branch_admin",
        accountStatus: "resigned",
      })
    ).toBe(false);
  });

  it("allows member and managers on customer-data-quality", () => {
    expect(
      canAccessRoutePath("/customer-data-quality", {
        role: "member",
        accountStatus: "active",
      })
    ).toBe(true);
    expect(
      canAccessRoutePath("/customer-data-quality", {
        role: "team_leader",
        accountStatus: "active",
      })
    ).toBe(true);
  });
});

describe("getRouteAccessRoles", () => {
  it("returns explicit roles for restricted routes", () => {
    expect(getRouteAccessRoles("/users")?.sort()).toEqual(["branch_admin"]);
    expect(getRouteAccessRoles("/referrals")?.sort()).toEqual([
      "branch_admin",
      "member",
      "sub_branch_admin",
      "team_leader",
    ]);
  });
});
