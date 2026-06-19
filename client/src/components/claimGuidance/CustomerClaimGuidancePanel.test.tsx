import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerClaimGuidancePanel } from "./CustomerClaimGuidancePanel";

const mockCases = [
  {
    id: 1,
    customerId: 200,
    contractId: 300,
    guidanceType: "process_guidance",
    guidanceStatus: "guidance_needed",
    documentGuideStatus: "not_started",
    customerActionStatus: "no_action",
    followUpId: 400,
    nextFollowUpAt: "2026-06-10T10:00:00.000Z",
    closedAt: null,
    closedReason: null,
    memo: "짧은 업무 메모",
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: 2,
    customerId: 200,
    contractId: null,
    guidanceType: "required_documents",
    guidanceStatus: "closed",
    documentGuideStatus: "completed",
    customerActionStatus: "completed",
    followUpId: null,
    nextFollowUpAt: null,
    closedAt: "2026-06-02T10:00:00.000Z",
    closedReason: "customer_completed",
    memo: "긴 메모 ".repeat(30),
    updatedAt: "2026-06-02T10:00:00.000Z",
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      claimGuidance: {
        listByCustomer: { invalidate: vi.fn() },
        summary: { invalidate: vi.fn() },
      },
    }),
    claimGuidance: {
      listByCustomer: {
        useQuery: vi.fn(() => ({ data: mockCases, isLoading: false })),
      },
      create: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      update: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      changeStatus: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      close: {
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

describe("CustomerClaimGuidancePanel", () => {
  const pageCustomer = { id: 200, agentId: 4 };
  const adminUser = {
    id: 1,
    role: "branch_admin",
    accountStatus: "active",
  };

  it("renders claim guidance section with badges and controls", () => {
    const html = renderToStaticMarkup(
      <CustomerClaimGuidancePanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("청구 안내");
    expect(html).toContain("안내 필요");
    expect(html).toContain("필요서류 안내");
    expect(html).toContain("고객 준비 상태");
    expect(html).toContain("다음 확인일");
    expect(html).toContain(">추가<");
    expect(html).toContain("상태 변경");
    expect(html).toContain("종료 처리");
  });

  it("does not use prohibited prediction wording", () => {
    const html = renderToStaticMarkup(
      <CustomerClaimGuidancePanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).not.toContain("지급 예상");
    expect(html).not.toContain("자동 청구");
    expect(html).not.toContain("청구 가능성");
  });

  it("hides manage controls for members without scope", () => {
    const html = renderToStaticMarkup(
      <CustomerClaimGuidancePanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={{ id: 99, role: "member", accountStatus: "active" }}
      />
    );
    expect(html).toContain("청구 안내");
    expect(html).not.toContain(">추가<");
    expect(html).not.toContain("상태 변경");
    expect(html).not.toContain(">수정<");
    expect(html).not.toContain("비활성화");
  });

  it("renders empty state when no cases", async () => {
    const { trpc } = await import("@/lib/trpc");
    vi.mocked(trpc.claimGuidance.listByCustomer.useQuery).mockReturnValueOnce({
      data: [],
      isLoading: false,
    } as never);
    const html = renderToStaticMarkup(
      <CustomerClaimGuidancePanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("등록된 청구 안내가 없습니다");
  });

  it("truncates long memo with line-clamp", () => {
    const html = renderToStaticMarkup(
      <CustomerClaimGuidancePanel
        customerId={200}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("line-clamp-2");
  });
});
