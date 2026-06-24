import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { canAccessRoutePath } from "@/lib/routeAccess";
import RetentionRiskManagement from "./RetentionRiskManagement";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, role: "branch_admin", accountStatus: "active" },
  })),
}));

vi.mock("@/hooks/useMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/hooks/useCustomerLookup", () => ({
  useCustomerLookup: vi.fn(() => ({
    lookup: {
      200: {
        id: 200,
        name: "[TEST] Customer",
        consultStatus: "해지관리",
        agentId: 4,
      },
    },
    isLoading: false,
  })),
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    retentionRisk: {
      summary: {
        useQuery: vi.fn(() => ({
          data: {
            total: 2,
            openCount: 1,
            criticalCount: 0,
            highCount: 1,
            waitingCustomer: 1,
            followUpScheduled: 1,
            resolvedCount: 1,
            byRiskLevel: { medium: 1, high: 1 },
            byRetentionStatus: { detected: 1, retained: 1 },
            byRiskReason: { premium_burden: 2 },
          },
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
      list: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: 1,
              customerId: 200,
              riskReason: "premium_burden",
              riskLevel: "medium",
              retentionStatus: "detected",
              responseStrategy: "wait_and_followup",
              customerSentiment: "price_sensitive",
              nextFollowUpAt: "2026-06-10T10:00:00.000Z",
              resolvedAt: null,
              resolutionResult: null,
              memo: "업무 메모",
              updatedAt: "2026-06-01T10:00:00.000Z",
            },
          ],
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
    },
    users: {
      list: {
        useQuery: vi.fn(() => ({
          data: [{ id: 4, name: "[TEST] Agent", role: "member", teamId: 1 }],
        })),
      },
      teams: {
        useQuery: vi.fn(() => ({
          data: [{ id: 1, name: "[TEST] Team" }],
        })),
      },
    },
  },
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

describe("RetentionRiskManagement", () => {
  it("renders management dashboard and list", () => {
    const html = renderToStaticMarkup(<RetentionRiskManagement />);
    expect(html).toContain("해지위험 관리");
    expect(html).toContain("기록된 해지위험 상태");
    expect(html).toContain("긴급 위험");
    expect(html).toContain("[TEST] Customer");
    expect(html).not.toContain("유지율");
    expect(html).not.toContain("해지 확률");
  });

  it("denies inactive users at route access layer", () => {
    expect(
      canAccessRoutePath("/retention-risk", {
        role: "member",
        accountStatus: "inactive",
      })
    ).toBe(false);
  });
});
