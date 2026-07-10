import { CUSTOMER_BULK_IMPORT_PERMISSION } from "@shared/permissions";
import { describe, expect, it } from "vitest";
import {
  canAccessRoutePath,
  getRouteAccessRoles,
  isKnownOperationalRole,
} from "./routeAccess";

const active = (role: string, permissions?: string[]) => ({
  role,
  accountStatus: "active" as const,
  permissions,
});

describe("isKnownOperationalRole", () => {
  it("recognizes operational roles", () => {
    expect(isKnownOperationalRole("branch_admin")).toBe(true);
    expect(isKnownOperationalRole("member")).toBe(true);
  });

  it("rejects unknown and blocked roles", () => {
    expect(isKnownOperationalRole("inactive")).toBe(false);
    expect(isKnownOperationalRole("bogus_role")).toBe(false);
    expect(isKnownOperationalRole(null)).toBe(false);
  });
});

describe("canAccessRoutePath", () => {
  const managerRoutes = [
    "/customers/assign",
    "/organization",
    "/team-insights",
    "/admin/sla",
    "/logs",
    "/operation-risk",
    "/admin/team-completion",
    "/admin/team-coaching",
    "/admin/operations-center",
    "/management-reports",
    "/schedule-change-requests",
  ] as const;

  const adminRoutes = [
    "/customers/import-batches",
    "/customers/merge",
    "/push-notifications",
    "/users/handoff",
    "/users",
    "/teams",
    "/download",
    "/settings",
    "/consultation-tools",
    "/deleted-data",
  ] as const;

  const operationalModuleRoutes = [
    "/referrals",
    "/claim-guidance",
    "/retention-risk",
    "/google-calendar-integration",
    "/aftercare-campaigns",
    "/onboarding-checklists",
    "/action-plans",
    "/performance/goals",
  ] as const;

  it("allows branch_admin on manager-only routes", () => {
    for (const path of managerRoutes) {
      expect(canAccessRoutePath(path, active("branch_admin"))).toBe(true);
    }
    expect(
      canAccessRoutePath("/customers/merge", active("branch_admin"))
    ).toBe(true);
  });

  it("allows managers on manager-only routes and blocks member", () => {
    for (const path of managerRoutes) {
      expect(canAccessRoutePath(path, active("sub_branch_admin"))).toBe(true);
      expect(canAccessRoutePath(path, active("team_leader"))).toBe(true);
      expect(canAccessRoutePath(path, active("member"))).toBe(false);
    }
  });

  it("allows branch_admin only on branch-admin routes", () => {
    for (const path of adminRoutes) {
      expect(canAccessRoutePath(path, active("branch_admin"))).toBe(true);
      expect(canAccessRoutePath(path, active("sub_branch_admin"))).toBe(false);
      expect(canAccessRoutePath(path, active("team_leader"))).toBe(false);
      expect(canAccessRoutePath(path, active("member"))).toBe(false);
    }
  });

  it("allows member on operational module routes", () => {
    for (const path of operationalModuleRoutes) {
      expect(canAccessRoutePath(path, active("member"))).toBe(true);
    }
  });

  it("allows member and managers on customer-data-quality", () => {
    expect(canAccessRoutePath("/customer-data-quality", active("member"))).toBe(
      true
    );
    expect(
      canAccessRoutePath("/customer-data-quality", active("team_leader"))
    ).toBe(true);
    expect(
      canAccessRoutePath("/customer-data-quality", active("sub_branch_admin"))
    ).toBe(true);
  });

  it("aligns bulk-import access with navigation canAccess", () => {
    expect(
      canAccessRoutePath("/customers/bulk-import", active("branch_admin"))
    ).toBe(true);
    expect(
      canAccessRoutePath(
        "/customers/bulk-import",
        active("sub_branch_admin", [CUSTOMER_BULK_IMPORT_PERMISSION])
      )
    ).toBe(true);
    expect(
      canAccessRoutePath("/customers/bulk-import", active("sub_branch_admin"))
    ).toBe(false);
    expect(
      canAccessRoutePath(
        "/customers/bulk-import",
        active("team_leader", [CUSTOMER_BULK_IMPORT_PERMISSION])
      )
    ).toBe(true);
    expect(
      canAccessRoutePath("/customers/bulk-import", active("member"))
    ).toBe(false);
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

  it("fails closed for unknown role on nav-restricted routes", () => {
    const user = { role: "bogus_role", accountStatus: "active" as const };
    expect(canAccessRoutePath("/logs", user)).toBe(false);
    expect(canAccessRoutePath("/users", user)).toBe(false);
    expect(canAccessRoutePath("/referrals", user)).toBe(false);
  });

  it("allows unknown role on unrestricted nav paths (server enforces scope)", () => {
    expect(
      canAccessRoutePath("/customers", {
        role: "bogus_role",
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
    expect(getRouteAccessRoles("/logs")?.sort()).toEqual([
      "branch_admin",
      "sub_branch_admin",
      "team_leader",
    ]);
    expect(getRouteAccessRoles("/schedule-change-requests")?.sort()).toEqual([
      "branch_admin",
      "sub_branch_admin",
      "team_leader",
    ]);
  });

  it("returns null for open routes without role restrictions", () => {
    expect(getRouteAccessRoles("/performance/goals")).toBeNull();
    expect(getRouteAccessRoles("/customers")).toBeNull();
  });
});
