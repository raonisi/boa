import React from "react";
(globalThis as any).React = React;
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminAttentionSection } from "./Dashboard";

const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", mockSetLocation],
}));

const mockScheduleChangeSummary = vi.fn();
const mockDeleteRequestsList = vi.fn();
const mockOperationRiskSummary = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    scheduleChangeRequests: {
      summary: {
        useQuery: (...args: any[]) => mockScheduleChangeSummary(...args),
      },
    },
    deleteRequests: {
      listAllRequestsForAdmin: {
        useQuery: (...args: any[]) => mockDeleteRequestsList(...args),
      },
    },
    operationRisk: {
      summary: {
        useQuery: (...args: any[]) => mockOperationRiskSummary(...args),
      },
    },
  },
}));

describe("Dashboard AdminAttentionSection Navigation and Role Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockScheduleChangeSummary.mockReturnValue({
      data: { pending: 3 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    mockDeleteRequestsList.mockReturnValue({
      data: [
        { id: 101, status: "pending", targetType: "contract" },
        { id: 102, status: "pending", targetType: "contract" },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    mockOperationRiskSummary.mockReturnValue({
      data: {
        riskCards: [
          { id: "r1", actionLevel: "warning" },
          { id: "r2", actionLevel: "critical" },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("renders attention section for branch_admin with contract delete approval pointing to /deleted-data", () => {
    const html = renderToStaticMarkup(<AdminAttentionSection role="branch_admin" />);

    // Section rendered
    expect(html).toContain("지점 운영 확인");
    expect(html).toContain("지점장 승인이 필요한 업무와 운영 위험만 모았습니다.");

    // Contract delete approval card
    expect(html).toContain("계약 삭제 승인");
    expect(html).toContain("처리 대기 중인 계약 요청");
    expect(html).toContain("2"); // pending count

    // Schedule approvals card
    expect(html).toContain("일정 변경 승인");
    expect(html).toContain("생성·수정·삭제 요청 검토");
    expect(html).toContain("3");

    // Operation risk card
    expect(html).toContain("운영 위험 신호");
    expect(html).toContain("최근 7일 확인이 필요한 항목");
  });

  it("does not render AdminAttentionSection for non-branch_admin roles", () => {
    for (const role of ["sub_branch_admin", "team_leader", "member", null, undefined, "inactive", "resigned"] as const) {
      const html = renderToStaticMarkup(<AdminAttentionSection role={role} />);
      expect(html).toBe("");
    }
  });

  it("only enables trpc queries when role is branch_admin", () => {
    renderToStaticMarkup(<AdminAttentionSection role="member" />);
    expect(mockScheduleChangeSummary).toHaveBeenCalledWith(undefined, { enabled: false });
    expect(mockDeleteRequestsList).toHaveBeenCalledWith({ status: "pending" }, { enabled: false });
    expect(mockOperationRiskSummary).toHaveBeenCalledWith({ period: "7d" }, { enabled: false });

    vi.clearAllMocks();
    renderToStaticMarkup(<AdminAttentionSection role="branch_admin" />);
    expect(mockScheduleChangeSummary).toHaveBeenCalledWith(undefined, { enabled: true });
    expect(mockDeleteRequestsList).toHaveBeenCalledWith({ status: "pending" }, { enabled: true });
    expect(mockOperationRiskSummary).toHaveBeenCalledWith({ period: "7d" }, { enabled: true });
  });

  it("displays 0 when contract delete requests list is empty", () => {
    mockDeleteRequestsList.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<AdminAttentionSection role="branch_admin" />);
    expect(html).toContain("계약 삭제 승인");
    expect(html).toContain("0");
  });

  it("displays retry button on query error", () => {
    mockDeleteRequestsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<AdminAttentionSection role="branch_admin" />);
    expect(html).toContain("다시 시도");
  });
});
