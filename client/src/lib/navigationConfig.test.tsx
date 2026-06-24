import { describe, expect, it } from "vitest";
import {
  filterNavGroups,
  getPageTitle,
  sidebarNavGroups,
} from "./navigationConfig";
import {
  getNavMatchScore,
  normalizeNavPath,
  resolveActiveNavItem,
} from "./navigationMatch";

describe("navigationMatch", () => {
  it("matches dynamic customer detail routes to 고객 관리", () => {
    const groups = filterNavGroups(sidebarNavGroups, { role: "member" });
    const active = resolveActiveNavItem(groups, "/customers/42");
    expect(active?.item.path).toBe("/customers");
    expect(active?.groupLabel).toBe("고객·계약");
  });

  it("does not let /customers steal /customers/assign active state", () => {
    expect(getNavMatchScore("/customers", "/customers/assign")).toBe(0);
    const groups = filterNavGroups(sidebarNavGroups, { role: "branch_admin" });
    const active = resolveActiveNavItem(groups, "/customers/assign");
    expect(active?.item.path).toBe("/customers/assign");
  });

  it("prefers longer paths such as /performance/goals over /performance", () => {
    const groups = filterNavGroups(sidebarNavGroups, { role: "member" });
    const active = resolveActiveNavItem(groups, "/performance/goals");
    expect(active?.item.path).toBe("/performance/goals");
  });

  it("normalizes query strings from location", () => {
    expect(normalizeNavPath("/customers?preset=today-follow-up")).toBe(
      "/customers"
    );
  });
});

describe("navigationConfig IA groups", () => {
  it("uses the five workflow group labels for branch_admin", () => {
    const groups = filterNavGroups(sidebarNavGroups, { role: "branch_admin" });
    expect(groups.map(group => group.label)).toEqual([
      "오늘 실행",
      "고객·계약",
      "조직 운영",
      "운영·감사",
      "설정·연동",
    ]);
  });

  it("hides branch_admin audit items from member navigation", () => {
    const groups = filterNavGroups(sidebarNavGroups, { role: "member" });
    const paths = groups.flatMap(group => group.items.map(item => item.path));
    expect(paths).not.toContain("/customers/assign");
    expect(paths).not.toContain("/customers/merge");
    expect(paths).not.toContain("/deleted-data");
    expect(paths).not.toContain("/users");
    expect(paths).not.toContain("/logs");
  });

  it("keeps member execution-first sidebar entries", () => {
    const groups = filterNavGroups(sidebarNavGroups, { role: "member" });
    const paths = groups.flatMap(group => group.items.map(item => item.path));
    expect(paths).toContain("/");
    expect(paths).toContain("/customers");
    expect(paths).toContain("/calendar");
    expect(paths).toContain("/notifications");
  });

  it("resolves page titles for reorganized labels", () => {
    expect(getPageTitle("/customers/merge")).toBe("중복 고객 관리");
    expect(getPageTitle("/action-plans")).toBe("실행계획 관리");
  });
});
