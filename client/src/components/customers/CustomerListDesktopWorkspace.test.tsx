import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerListDesktopWorkspace } from "./CustomerListDesktopWorkspace";

vi.stubGlobal("React", React);

const callbacks = {
  onRetry: vi.fn(),
  onClearFilters: vi.fn(),
  onCreateCustomer: vi.fn(),
  onNavigate: vi.fn(),
  onToggleAllVisibleSelectable: vi.fn(),
  onToggleCustomerSelection: vi.fn(),
  onOpenReclaimCustomer: vi.fn(),
  onDeactivateCustomer: vi.fn(),
  onQuickConsult: vi.fn(),
};

const baseProps = {
  customers: [] as any[],
  recommendationByCustomerId: new Map<number, any>(),
  agentById: new Map<number, any>([
    [4, { id: 4, name: "[TEST] Agent", role: "member" }],
  ]),
  isLoading: false,
  isError: false,
  hasActiveFilters: false,
  canCreateCustomer: true,
  canDeactivateCustomer: true,
  canReclaimCustomer: true,
  canBulkChangeAssignee: true,
  selectableFilteredIds: [101, 102],
  selectedCustomerIds: [101],
  allVisibleSelectableSelected: false,
  isCustomerReclaimable: (customer: any) => customer.id === 101,
  relationFlags: { 101: true },
  sortMode: "recent" as const,
  ...callbacks,
};

const databaseCustomer = {
  id: 101,
  name: "[TEST] Database Customer",
  phone: "01012345678",
  agentId: 4,
  consultStatus: "상담중",
  priority: "A",
  customerSegment: "database",
  assignedDate: "2026-07-01T00:00:00.000Z",
  expectedPremium: 120000,
  region: "Seoul",
  nextAction: "상담기록 추가",
  customerTags: "[]",
};

const contractedCustomer = {
  ...databaseCustomer,
  id: 102,
  name: "[TEST] Contracted Customer",
  phone: null,
  customerSegment: "contracted",
  contractCount: 2,
  monthlyPremiumTotal: 250000,
  recentContractDate: "2026-07-10T00:00:00.000Z",
};

describe("CustomerListDesktopWorkspace", () => {
  it("renders database and contracted rows in one semantic table", () => {
    const html = renderToStaticMarkup(
      <CustomerListDesktopWorkspace
        {...baseProps}
        customers={[databaseCustomer, contractedCustomer]}
      />
    );

    expect(html).toContain('role="table"');
    expect(html).toContain("[TEST] Database Customer");
    expect(html).toContain("[TEST] Contracted Customer");
    expect(html).toContain('data-testid="customer-segment-badge"');
    expect(html).toContain('href="tel:01012345678"');
  });

  it("renders loading, error and filtered-empty states", () => {
    const loading = renderToStaticMarkup(
      <CustomerListDesktopWorkspace {...baseProps} isLoading />
    );
    const error = renderToStaticMarkup(
      <CustomerListDesktopWorkspace {...baseProps} isError />
    );
    const empty = renderToStaticMarkup(
      <CustomerListDesktopWorkspace {...baseProps} hasActiveFilters />
    );

    expect(loading).toContain('aria-busy="true"');
    expect(error).toContain("button");
    expect(empty).toContain("button");
  });
});
