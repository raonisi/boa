import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { adminPage } from "@/lib/adminDesignTokens";
import {
  getOrgRoleBadgeClasses,
  getAccountStatusBadgeClasses,
} from "@/lib/orgGoalPresentation";

const fixture = vi.hoisted(() => ({
  nodes: [] as any[],
  query: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, role: "branch_admin" } }),
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: any) => children,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      users: {
        organizationTree: { invalidate: vi.fn() },
        list: { invalidate: vi.fn() },
      },
    }),
    users: {
      organizationTree: {
        useQuery: (...args: any[]) => {
          fixture.query(...args);
          return {
            data: { nodes: fixture.nodes, summary: {} },
            refetch: vi.fn(),
          };
        },
      },
      updateParent: { useMutation: () => ({ mutate: fixture.mutate }) },
    },
  },
}));
import OrganizationManagement from "./OrganizationManagement";

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.clearAllMocks();
  fixture.nodes = [
    {
      id: 1,
      name: "[TEST] Branch",
      role: "branch_admin",
      accountStatus: "active",
      parentUserId: null,
      explicitParentUserId: null,
      directReportCount: 3,
      descendantCount: 6,
      customerCount: 1234,
    },
    ...["sub_branch_admin", "team_leader", "member"].map((role, index) => ({
      id: index + 2,
      name: `[TEST] ${role}`,
      role,
      accountStatus: "active",
      parentUserId: 1,
      explicitParentUserId: 1,
      directReportCount: 0,
      descendantCount: 0,
      customerCount: 9,
    })),
    ...["inactive", "resigned"].map((accountStatus, index) => ({
      id: index + 5,
      name: `[TEST] ${accountStatus}`,
      role: "member",
      accountStatus,
      parentUserId: 1,
      explicitParentUserId: 1,
      directReportCount: 0,
      descendantCount: 0,
      customerCount: 0,
    })),
  ];
});
afterEach(() => vi.unstubAllGlobals());

function render() {
  const html = renderToStaticMarkup(<OrganizationManagement />);
  const cards = html
    .split(/(?=<div data-slot="card"\s)/)
    .filter(s => s.startsWith('<div data-slot="card"'));
  return {
    html,
    branch: cards.find(s => s.includes("[TEST] Branch"))!,
    other: (name: string) => cards.find(s => s.includes(name))!,
  };
}
const metricBoxes = (html: string) =>
  Array.from(
    html.matchAll(/<div class="([^"]*rounded-xl p-2[^"]*)">(.*?)<\/div>/g)
  );

describe("P2-06 organization card presentation and preserved semantics", () => {
  it("T01 branch metrics use a contrasting local surface", () => {
    expect(metricBoxes(render().branch)).toHaveLength(3);
    for (const box of metricBoxes(render().branch)) {
      expect(box[1]).toContain("bg-primary-foreground/10");
      expect(box[1]).toContain("border-primary-foreground/20");
      expect(box[1]).not.toContain("bg-muted/30");
    }
  });
  it("T02 branch metric labels use the card's contrasting text", () => {
    for (const box of metricBoxes(render().branch))
      expect(box[2]).toMatch(/class="text-xs text-primary-foreground"/);
  });
  it("T03 branch metric values use the card's contrasting text", () => {
    for (const box of metricBoxes(render().branch))
      expect(box[2]).toMatch(
        /class="text-base font-bold text-primary-foreground"/
      );
  });
  it("T04 non-branch role metrics retain shared surfaces and text", () => {
    for (const role of ["sub_branch_admin", "team_leader", "member"]) {
      for (const box of metricBoxes(render().other(`[TEST] ${role}`))) {
        expect(box[1]).toContain(adminPage.surface);
        expect(box[2]).toContain("text-xs text-muted-foreground");
        expect(box[2]).toContain("text-base font-bold text-foreground");
      }
    }
  });
  it("T05 inactive and resigned organization cards retain muted styling", () => {
    for (const status of ["inactive", "resigned"])
      expect(render().other(`[TEST] ${status}`)).toContain(
        "border-border bg-muted/40 opacity-80"
      );
  });
  it("T06 labels and server-supplied counts are preserved", () => {
    const boxes = metricBoxes(render().branch);
    for (const [index, label, value] of [
      [0, "직속", 3],
      [1, "산하", 6],
      [2, "고객", 1234],
    ] as const) {
      expect(boxes[index][2]).toContain(`>${label}</p>`);
      expect(boxes[index][2]).toContain(`>${value}</p>`);
    }
    fixture.nodes[0].customerCount = 42;
    expect(metricBoxes(render().branch)[2][2]).toContain(">42</p>");
  });
  it("T07 branch name and parent label preserve their existing styles and content", () => {
    const { branch } = render();
    expect(branch).toContain(
      'class="mt-2 truncate text-lg font-bold text-primary-foreground"'
    );
    expect(branch).toContain('class="mt-1 text-sm text-primary-foreground/75"');
    expect(branch).toContain("상위: 없음");
  });
  it("T08 non-branch role and status badges continue using the shared helpers", () => {
    for (const role of ["sub_branch_admin", "team_leader", "member"]) {
      const html = render().other(`[TEST] ${role}`);
      for (const token of getOrgRoleBadgeClasses(role).split(" "))
        expect(html).toContain(token);
      for (const token of getAccountStatusBadgeClasses("active").split(" "))
        expect(html).toContain(token);
    }
  });
  it("T09 query scope and parent action visibility are unchanged and rendering writes nothing", () => {
    const { branch, other } = render();
    expect(fixture.query).toHaveBeenCalledWith(undefined, { enabled: true });
    expect(branch).not.toContain("상위자 변경");
    expect(branch).not.toContain("산하 해제");
    expect(other("[TEST] member")).toContain("상위자 변경");
    expect(other("[TEST] member")).toContain("산하 해제");
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("T10 shared surface token is unchanged", () => {
    expect(adminPage.surface).toBe(
      "rounded-xl border border-border bg-muted/30"
    );
  });
  it("TR08 branch role and every status override only the color transition", () => {
    for (const status of ["active", "inactive", "resigned"]) {
      fixture.nodes[0].accountStatus = status;
      const badges = Array.from(
        render()
          .branch.split("<h3")[0]
          .matchAll(/<span data-slot="badge" class="([^"]*)"/g)
      );
      expect(badges).toHaveLength(2);
      for (const badge of badges) {
        expect(badge[1]).toContain("transition-[box-shadow]");
        expect(badge[1]).not.toContain("transition-[color,box-shadow]");
        expect(badge[1]).toContain("focus-visible:ring-[3px]");
      }
    }
  });
  it("non-branch role and status badges retain the common color transition", () => {
    for (const name of [
      "sub_branch_admin",
      "team_leader",
      "member",
      "inactive",
      "resigned",
    ]) {
      const badges = Array.from(
        render()
          .other(`[TEST] ${name}`)
          .matchAll(/<span data-slot="badge" class="([^"]*)"/g)
      );
      expect(badges.length).toBeGreaterThanOrEqual(2);
      for (const badge of badges) {
        expect(badge[1]).toContain("transition-[color,box-shadow]");
        expect(badge[1]).not.toContain("transition-[box-shadow]");
      }
    }
  });
  it("common Badge source bytes retain the locked candidate hash", () => {
    const source = readFileSync("client/src/components/ui/badge.tsx");
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      "2a6c35c692eb769cf14614f0bb601bb3fc52f34a064c22c52d0ba55f82aca285"
    );
  });
});
