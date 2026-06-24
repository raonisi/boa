import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { canAccessRoutePath } from "@/lib/routeAccess";
import ReferralManagement from "./ReferralManagement";

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
      1: {
        id: 1,
        name: "[TEST] Referrer",
        consultStatus: "통화완료",
        agentId: 10,
      },
      2: {
        id: 2,
        name: "[TEST] Referred",
        consultStatus: "미상담",
        agentId: 11,
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
    customerReferrals: {
      summary: {
        useQuery: vi.fn(() => ({
          data: {
            total: 3,
            inProgress: 2,
            contracted: 1,
            thankYouPending: 1,
            byStage: { introduced: 1, contracted: 1 },
            byResultStatus: { in_progress: 2, contracted: 1, deferred: 0, declined: 0 },
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
              referrerCustomerId: 1,
              referredCustomerId: 2,
              referralStage: "introduced",
              thankYouStatus: "pending",
              resultStatus: "in_progress",
              memo: "업무 메모",
              updatedAt: "2026-06-01T10:00:00.000Z",
            },
          ],
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        })),
      },
    },
    users: {
      list: {
        useQuery: vi.fn(() => ({
          data: [{ id: 10, name: "[TEST] Agent", role: "member", teamId: 1 }],
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

describe("ReferralManagement", () => {
  it("renders dashboard title, KPI cards, and referral list", () => {
    const html = renderToStaticMarkup(<ReferralManagement />);
    expect(html).toContain("소개 관리");
    expect(html).toContain("전체 소개");
    expect(html).toContain("진행 중");
    expect(html).toContain("기록된 소개 흐름 기준");
    expect(html).toContain("[TEST] Referrer");
    expect(html).toContain("팀원별 소개 현황");
  });

  it("denies inactive users at route access layer", () => {
    expect(
      canAccessRoutePath("/referrals", {
        role: "member",
        accountStatus: "inactive",
      })
    ).toBe(false);
  });
});
