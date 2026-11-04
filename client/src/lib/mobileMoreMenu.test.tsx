import { describe, expect, it } from "vitest";
import {
  filterNavGroups,
  mobileMoreNavGroups,
  mobileQuickLinksForRole,
  type NavGroup,
  type NavItem,
} from "@/lib/navigationConfig";
import {
  getInitialExpandedGroups,
  normalizeSearchTerm,
  searchNavItems,
} from "@/lib/mobileMoreMenu";
import { Activity } from "lucide-react";

describe("mobileMoreMenu helper logic", () => {
  describe("normalizeSearchTerm", () => {
    it("trims whitespace, converts to lowercase, and collapses spaces", () => {
      expect(normalizeSearchTerm("")).toBe("");
      expect(normalizeSearchTerm("   ")).toBe("");
      expect(normalizeSearchTerm("  Google   Calendar  ")).toBe("google calendar");
      expect(normalizeSearchTerm(" 영업   분석 ")).toBe("영업 분석");
      expect(normalizeSearchTerm("RISK")).toBe("risk");
    });
  });

  describe("searchNavItems", () => {
    const mockGroups: NavGroup[] = [
      {
        label: "고객·계약",
        items: [
          { icon: Activity, label: "영업 분석", path: "/analytics" },
          { icon: Activity, label: "계약관리", path: "/contracts", description: "체결 계약 현황 및 상세" },
          { icon: Activity, label: "온보딩 체크리스트", path: "/onboarding-checklists" },
        ],
      },
      {
        label: "운영·감사",
        items: [
          { icon: Activity, label: "운영 리스크", path: "/operation-risk", description: "오늘 확인 필요" },
          { icon: Activity, label: "활동 로그", path: "/logs" },
          { icon: Activity, label: "데이터 다운로드", path: "/download" },
        ],
      },
      {
        label: "설정·연동",
        items: [
          { icon: Activity, label: "Google Calendar 연동", path: "/google-calendar-integration" },
        ],
      },
    ];

    const mockQuickLinks: NavItem[] = [
      { icon: Activity, label: "운영 리스크", path: "/operation-risk", description: "오늘 확인 필요" },
      { icon: Activity, label: "DB 배정", path: "/customers/assign" },
    ];

    it("returns empty array when query is empty or whitespace only", () => {
      expect(searchNavItems(mockGroups, mockQuickLinks, "")).toEqual([]);
      expect(searchNavItems(mockGroups, mockQuickLinks, "   ")).toEqual([]);
    });

    it("finds items matching label (case-insensitive)", () => {
      const results = searchNavItems(mockGroups, mockQuickLinks, "계약");
      expect(results.some(r => r.path === "/contracts")).toBe(true);
      expect(results.find(r => r.path === "/contracts")?.groupLabel).toBe("고객·계약");
    });

    it("finds items matching description", () => {
      const results = searchNavItems(mockGroups, mockQuickLinks, "체결 계약");
      expect(results.length).toBe(1);
      expect(results[0].path).toBe("/contracts");
      expect(results[0].label).toBe("계약관리");
    });

    it("finds items matching English queries and partial terms", () => {
      const results = searchNavItems(mockGroups, mockQuickLinks, "google");
      expect(results.length).toBe(1);
      expect(results[0].path).toBe("/google-calendar-integration");
      expect(results[0].groupLabel).toBe("설정·연동");
    });

    it("deduplicates identical paths across groups and quick links", () => {
      // /operation-risk is in both mockGroups and mockQuickLinks
      const results = searchNavItems(mockGroups, mockQuickLinks, "리스크");
      expect(results.filter(r => r.path === "/operation-risk").length).toBe(1);
      // Group label takes precedence
      expect(results.find(r => r.path === "/operation-risk")?.groupLabel).toBe("운영·감사");
    });

    it("includes unique quick link items when matching", () => {
      // /customers/assign is only in quick links
      const results = searchNavItems(mockGroups, mockQuickLinks, "DB 배정");
      expect(results.length).toBe(1);
      expect(results[0].path).toBe("/customers/assign");
      expect(results[0].groupLabel).toBe("오늘 바로가기");
    });

    it("returns empty array when no items match", () => {
      const results = searchNavItems(mockGroups, mockQuickLinks, "존재하지않는기능명");
      expect(results).toEqual([]);
    });
  });

  describe("getInitialExpandedGroups", () => {
    const sampleGroups: NavGroup[] = [
      { label: "고객·계약", items: [] },
      { label: "조직 운영", items: [] },
      { label: "운영·감사", items: [] },
      { label: "설정·연동", items: [] },
    ];

    it("expands '고객·계약' by default for core-smoke preservation and collapses others", () => {
      const state = getInitialExpandedGroups(sampleGroups, null);
      expect(state["고객·계약"]).toBe(true);
      expect(state["조직 운영"]).toBe(false);
      expect(state["운영·감사"]).toBe(false);
      expect(state["설정·연동"]).toBe(false);
    });

    it("automatically expands the active group in addition to '고객·계약'", () => {
      const state = getInitialExpandedGroups(sampleGroups, "운영·감사");
      expect(state["고객·계약"]).toBe(true);
      expect(state["운영·감사"]).toBe(true);
      expect(state["조직 운영"]).toBe(false);
      expect(state["설정·연동"]).toBe(false);
    });
  });

  describe("Role Route Invariance & Strict RBAC Isolation", () => {
    const roles = ["branch_admin", "sub_branch_admin", "team_leader", "member"] as const;

    it("maintains consistent accessible route sets for all roles", () => {
      for (const role of roles) {
        const user = { role, id: 1, name: "Test User" };
        const groups = filterNavGroups(mobileMoreNavGroups, user);
        const quick = mobileQuickLinksForRole(role);

        // Collect all distinct routes accessible through groups and quick links
        const allRoutes = new Set<string>();
        for (const g of groups) {
          for (const item of g.items) {
            allRoutes.add(item.path);
          }
        }
        for (const q of quick) {
          allRoutes.add(q.path);
        }

        // Each role must have accessible routes
        expect(allRoutes.size).toBeGreaterThan(0);

        // Core business routes must always be accessible
        expect(allRoutes.has("/analytics")).toBe(true);
        expect(allRoutes.has("/sales-pipeline")).toBe(true);
        expect(allRoutes.has("/contracts")).toBe(true);
      }
    });

    it("strictly isolates branch_admin exclusive routes from member", () => {
      const memberUser = { role: "member", id: 2, name: "Member User" };
      const memberGroups = filterNavGroups(mobileMoreNavGroups, memberUser);
      const memberQuick = mobileQuickLinksForRole("member");
      const memberAllRoutes = new Set<string>();
      for (const g of memberGroups) {
        for (const item of g.items) {
          memberAllRoutes.add(item.path);
        }
      }
      for (const q of memberQuick) {
        memberAllRoutes.add(q.path);
      }

      // Admin exclusive routes must NEVER be accessible to member
      const adminExclusiveRoutes = [
        "/operation-risk",
        "/customers/assign",
        "/team-insights",
        "/logs",
        "/download",
        "/admin/operations-center",
        "/settings",
        "/organization",
        "/users",
        "/contract-bulk-delete",
        "/admin/team-completion",
        "/admin/team-coaching",
      ];

      for (const route of adminExclusiveRoutes) {
        expect(memberAllRoutes.has(route)).toBe(false);
      }

      // Member search must never return admin exclusive routes
      const searchResults = searchNavItems(memberGroups, memberQuick, "다운로드");
      expect(searchResults.some(r => r.path === "/download")).toBe(false);

      const riskResults = searchNavItems(memberGroups, memberQuick, "리스크");
      expect(riskResults.some(r => r.path === "/operation-risk")).toBe(false);
    });

    it("allows branch_admin to access all management routes", () => {
      const adminUser = { role: "branch_admin", id: 1, name: "Admin User" };
      const adminGroups = filterNavGroups(mobileMoreNavGroups, adminUser);
      const adminQuick = mobileQuickLinksForRole("branch_admin");
      const adminAllRoutes = new Set<string>();
      for (const g of adminGroups) {
        for (const item of g.items) {
          adminAllRoutes.add(item.path);
        }
      }
      for (const q of adminQuick) {
        adminAllRoutes.add(q.path);
      }

      expect(adminAllRoutes.has("/download")).toBe(true);
      expect(adminAllRoutes.has("/settings")).toBe(true);
      expect(adminAllRoutes.has("/logs")).toBe(true);
      expect(adminAllRoutes.has("/operation-risk")).toBe(true);
      expect(adminAllRoutes.has("/customers/assign")).toBe(true);
      expect(adminAllRoutes.has("/organization")).toBe(true);
      expect(adminAllRoutes.has("/users")).toBe(true);

      // Branch admin quick links must have exactly 5 items
      expect(adminQuick.length).toBe(5);
    });

    it("sub_branch_admin and team_leader have 4 quick links and cannot access branch_admin exclusive routes", () => {
      for (const role of ["sub_branch_admin", "team_leader"] as const) {
        const user = { role, id: 3, name: "Manager User" };
        const groups = filterNavGroups(mobileMoreNavGroups, user);
        const quick = mobileQuickLinksForRole(role);
        const allRoutes = new Set<string>();
        for (const g of groups) {
          for (const item of g.items) {
            allRoutes.add(item.path);
          }
        }
        for (const q of quick) {
          allRoutes.add(q.path);
        }

        // Quick links must have 4 items
        expect(quick.length).toBe(4);
        expect(quick.some(q => q.path === "/download")).toBe(false);

        // Branch admin exclusive routes cannot be in allRoutes
        expect(allRoutes.has("/download")).toBe(false);
        expect(allRoutes.has("/settings")).toBe(false);
        expect(allRoutes.has("/users")).toBe(false);

        // Operational routes ARE accessible
        expect(allRoutes.has("/operation-risk")).toBe(true);
        expect(allRoutes.has("/customers/assign")).toBe(true);
        expect(allRoutes.has("/team-insights")).toBe(true);
        expect(allRoutes.has("/logs")).toBe(true);
        expect(allRoutes.has("/organization")).toBe(true);
      }
    });
  });
});
