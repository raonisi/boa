import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerRetentionRiskPanel } from "./CustomerRetentionRiskPanel";

const mockCases = [
  {
    id: 1,
    customerId: 200,
    contractId: 300,
    riskReason: "premium_burden",
    riskLevel: "medium",
    retentionStatus: "detected",
    responseStrategy: "wait_and_followup",
    customerSentiment: "price_sensitive",
    financialPressureLevel: "medium",
    competitorMentioned: false,
    followUpId: 400,
    nextFollowUpAt: "2026-06-10T10:00:00.000Z",
    resolvedAt: null,
    resolutionResult: null,
    memo: "짧은 업무 메모",
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: 2,
    customerId: 200,
    contractId: null,
    riskReason: "cash_need",
    riskLevel: "high",
    retentionStatus: "retained",
    responseStrategy: "explain_existing_value",
    customerSentiment: "calm",
    financialPressureLevel: null,
    competitorMentioned: false,
    followUpId: null,
    nextFollowUpAt: null,
    resolvedAt: "2026-06-02T10:00:00.000Z",
    resolutionResult: "retained",
    memo: "긴 메모 ".repeat(30),
    updatedAt: "2026-06-02T10:00:00.000Z",
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      retentionRisk: {
        listByCustomer: { invalidate: vi.fn() },
        summary: { invalidate: vi.fn() },
      },
    }),
    retentionRisk: {
      listByCustomer: {
        useQuery: vi.fn(() => ({ data: mockCases, isLoading: false })),
      },
      create: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      update: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      changeRiskLevel: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn(),
          isPending: false,
        })),
      },
      changeRetentionStatus: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn(),
          isPending: false,
        })),
      },
      resolve: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      delete: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
    },
    contracts: {
      listByCustomer: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: 300,
              productName: "[TEST] Product",
              contractDate: "2026-01-01",
            },
          ],
        })),
      },
    },
    followUps: {
      listByCustomer: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: 400,
              reason: "[TEST] Follow",
              nextContactDate: "2026-06-10T10:00:00.000Z",
              deletedAt: null,
            },
          ],
        })),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("CustomerRetentionRiskPanel", () => {
  const pageCustomer = { id: 200, agentId: 4 };
  const adminUser = {
    id: 1,
    role: "branch_admin",
    accountStatus: "active",
  };

  it("renders retention risk section with badges and controls", () => {
    const html = renderToStaticMarkup(
      <CustomerRetentionRiskPanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("해지위험 관리");
    expect(html).toContain("위험 감지");
    expect(html).toContain("위험 보통");
    expect(html).toContain("해지 고민 사유");
    expect(html).toContain("대응 방향");
    expect(html).toContain("다음 확인일");
    expect(html).toContain(">추가<");
    expect(html).toContain("상태 변경");
    expect(html).toContain("종료 처리");
  });

  it("shows sensitive memo notice in create flow copy", () => {
    const html = renderToStaticMarkup(
      <CustomerRetentionRiskPanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("민감정보");
  });

  it("does not use prohibited pressure wording", () => {
    const html = renderToStaticMarkup(
      <CustomerRetentionRiskPanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).not.toContain("반드시 유지");
    expect(html).not.toContain("무조건 해지 방어");
    expect(html).not.toContain("해지하면 손해");
    expect(html).not.toContain("유지율");
    expect(html).not.toContain("해지 확률");
  });

  it("hides manage controls for members without scope", () => {
    const html = renderToStaticMarkup(
      <CustomerRetentionRiskPanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={{ id: 99, role: "member", accountStatus: "active" }}
      />
    );
    expect(html).toContain("해지위험 관리");
    expect(html).not.toContain(">추가<");
    expect(html).not.toContain("상태 변경");
    expect(html).not.toContain(">수정<");
    expect(html).not.toContain("비활성화");
  });

  it("renders empty state when no cases", async () => {
    const { trpc } = await import("@/lib/trpc");
    vi.mocked(trpc.retentionRisk.listByCustomer.useQuery).mockReturnValueOnce({
      data: [],
      isLoading: false,
    } as never);
    const html = renderToStaticMarkup(
      <CustomerRetentionRiskPanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("등록된 해지위험 관리가 없습니다");
  });

  it("truncates long memo with line-clamp", () => {
    const html = renderToStaticMarkup(
      <CustomerRetentionRiskPanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("line-clamp-2");
  });
});
