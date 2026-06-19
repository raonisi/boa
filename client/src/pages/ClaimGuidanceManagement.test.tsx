import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ClaimGuidanceManagement from "./ClaimGuidanceManagement";

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
        consultStatus: "계약",
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
    claimGuidance: {
      summary: {
        useQuery: vi.fn(() => ({
          data: {
            total: 2,
            guidanceNeeded: 1,
            additionalGuidanceNeeded: 0,
            completed: 1,
            closed: 0,
            followUpScheduled: 1,
            byGuidanceStatus: { guidance_needed: 1, completed: 1 },
            byGuidanceType: { process_guidance: 2 },
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
              guidanceType: "process_guidance",
              guidanceStatus: "guidance_needed",
              customerActionStatus: "no_action",
              nextFollowUpAt: "2026-06-10T10:00:00.000Z",
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

describe("ClaimGuidanceManagement", () => {
  it("renders management dashboard and list", () => {
    const html = renderToStaticMarkup(<ClaimGuidanceManagement />);
    expect(html).toContain("청구 안내 관리");
    expect(html).toContain("기록된 청구 안내 상태");
    expect(html).toContain("안내 필요");
    expect(html).toContain("[TEST] Customer");
    expect(html).not.toContain("지급 예상");
  });

  it("renders empty access state for inactive users", async () => {
    const { useAuth } = await import("@/_core/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { id: 1, role: "member", accountStatus: "inactive" },
    } as never);
    const html = renderToStaticMarkup(<ClaimGuidanceManagement />);
    expect(html).toContain("접근 권한이 없습니다");
  });
});
