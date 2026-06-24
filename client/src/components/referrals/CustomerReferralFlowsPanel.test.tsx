import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerReferralFlowsPanel } from "./CustomerReferralFlowsPanel";

const mockReferrals = [
  {
    id: 1,
    relationshipId: 10,
    referrerCustomerId: 1,
    referredCustomerId: 2,
    referralStage: "introduced",
    referralSourceType: "customer_referral",
    introductionMethod: "phone",
    thankYouStatus: "pending",
    thankYouCompletedAt: null,
    resultStatus: "in_progress",
    memo: "짧은 업무 메모입니다",
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: 2,
    relationshipId: 11,
    referrerCustomerId: 3,
    referredCustomerId: 1,
    referralStage: "contracted",
    referralSourceType: "customer_referral",
    introductionMethod: null,
    thankYouStatus: "completed",
    thankYouCompletedAt: "2026-06-02T10:00:00.000Z",
    resultStatus: "contracted",
    memo: "매우 긴 메모 텍스트 ".repeat(20),
    updatedAt: "2026-06-02T10:00:00.000Z",
  },
];

vi.mock("@/hooks/useCustomerLookup", () => ({
  useCustomerLookup: vi.fn(() => ({
    lookup: {
      1: {
        id: 1,
        name: "[TEST] Anchor",
        consultStatus: "통화완료",
        agentId: 10,
      },
      2: {
        id: 2,
        name: "[TEST] Referred",
        consultStatus: "미상담",
        agentId: 10,
      },
      3: {
        id: 3,
        name: "[TEST] Referrer",
        consultStatus: "상담완료",
        agentId: 11,
      },
    },
    isLoading: false,
  })),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      customerReferrals: {
        listByCustomer: { invalidate: vi.fn() },
      },
    }),
    customerReferrals: {
      listByCustomer: {
        useQuery: vi.fn(() => ({
          data: mockReferrals,
          isLoading: false,
        })),
      },
      searchCustomers: {
        useQuery: vi.fn(() => ({ data: { items: [] }, isFetching: false })),
      },
      create: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      update: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      changeStage: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      completeThankYou: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      delete: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
    },
    customerRelationships: {
      list: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
    },
    users: {
      list: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/customers/1", vi.fn()],
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("CustomerReferralFlowsPanel", () => {
  const pageCustomer = { id: 1, agentId: 10 };
  const adminUser = {
    id: 1,
    role: "branch_admin",
    accountStatus: "active",
  };

  it("renders referral sections, stage badges, and manage controls", () => {
    const html = renderToStaticMarkup(
      <CustomerReferralFlowsPanel
        customerId={1}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("소개 흐름");
    expect(html).toContain("이 고객이 소개한 고객");
    expect(html).toContain("이 고객을 소개한 고객");
    expect(html).toContain("[TEST] Referred");
    expect(html).toContain("[TEST] Referrer");
    expect(html).toContain("소개 받음");
    expect(html).toContain("계약 완료");
    expect(html).toContain("감사 완료");
    expect(html).toContain("단계 변경");
    expect(html).toContain(">추가<");
  });

  it("shows thank-you complete button for pending introduced-by flows", () => {
    const html = renderToStaticMarkup(
      <CustomerReferralFlowsPanel
        customerId={1}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("감사 대기");
    expect(html).toContain(">감사 완료<");
  });

  it("hides manage controls for members without scope", () => {
    const html = renderToStaticMarkup(
      <CustomerReferralFlowsPanel
        customerId={1}
        pageCustomer={pageCustomer}
        user={{ id: 99, role: "member", accountStatus: "active" }}
      />
    );
    expect(html).toContain("이 고객이 소개한 고객");
    expect(html).not.toContain(">추가<");
    expect(html).not.toContain("단계 변경");
    expect(html).not.toContain(">수정<");
    expect(html).not.toContain(">삭제<");
  });

  it("renders empty state when no referrals", async () => {
    const { trpc } = await import("@/lib/trpc");
    vi.mocked(
      trpc.customerReferrals.listByCustomer.useQuery
    ).mockReturnValueOnce({
      data: [],
      isLoading: false,
    } as never);
    const html = renderToStaticMarkup(
      <CustomerReferralFlowsPanel
        customerId={1}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("등록된 소개 흐름이 없습니다");
  });

  it("truncates long memo with line-clamp", () => {
    const html = renderToStaticMarkup(
      <CustomerReferralFlowsPanel
        customerId={1}
        pageCustomer={pageCustomer}
        user={adminUser}
      />
    );
    expect(html).toContain("line-clamp-2");
  });
});
