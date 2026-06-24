import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerRelationshipsPanel } from "./CustomerRelationshipsPanel";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      customerRelationships: {
        list: { invalidate: vi.fn() },
      },
      customers: {
        timeline: { invalidate: vi.fn() },
      },
    }),
    customerRelationships: {
      list: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: 1,
              relationshipType: "family_spouse",
              relationshipLabel: "배우자",
              note: "내부 업무 메모",
              status: "active",
              relatedCustomer: {
                id: 2,
                name: "[TEST] Related",
                consultStatus: "통화완료",
                agentName: "[TEST] Agent",
                lastConsultedAt: null,
                nextContactDate: null,
              },
            },
          ],
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
      delete: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/customers/1", vi.fn()],
}));

describe("CustomerRelationshipsPanel", () => {
  it("renders relationship section and cards", () => {
    const html = renderToStaticMarkup(
      <CustomerRelationshipsPanel customerId={1} canManage />
    );
    expect(html).toContain("연결 고객");
    expect(html).toContain("[TEST] Related");
    expect(html).toContain("배우자");
    expect(html).toContain("관계 추가");
    expect(html).toContain("수정");
    expect(html).toContain("연결 해제");
  });

  it("hides manage controls without permission", () => {
    const html = renderToStaticMarkup(
      <CustomerRelationshipsPanel customerId={1} canManage={false} />
    );
    expect(html).toContain("[TEST] Related");
    expect(html).not.toContain("관계 추가");
    expect(html).not.toContain(">수정<");
    expect(html).not.toContain(">삭제<");
  });
});
