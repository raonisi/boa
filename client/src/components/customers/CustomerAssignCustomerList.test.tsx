import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerAssignCustomerList } from "./CustomerAssignCustomerList";
import { CustomerAssignMobileActionBar } from "./CustomerAssignMobileActionBar";
import { WORKFLOW_COPY } from "@/lib/assignmentWorkflowCopy";

const sampleCustomers = [
  {
    id: 1,
    name: "김테스트",
    region: "서울",
    source: "소개",
    consultStatus: "미상담",
    createdAt: "2026-01-15T00:00:00.000Z",
    assignmentStatus: "unassigned",
  },
];

vi.mock("@/hooks/useMobile", () => ({
  useIsMobile: vi.fn(() => true),
}));

describe("CustomerAssign mobile workspace", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders mobile cards without desktop table headers", () => {
    const html = renderToStaticMarkup(
      <CustomerAssignCustomerList
        customers={sampleCustomers}
        totalCount={1}
        selected={[]}
        onToggle={() => undefined}
        onToggleAll={() => undefined}
        search=""
        onSearchChange={() => undefined}
        statusFilter="all"
        onStatusFilterChange={() => undefined}
        sourceFilter="all"
        onSourceFilterChange={() => undefined}
        statusOptions={["미상담"]}
        sourceOptions={["소개"]}
        title="미배정 고객"
        emptyTitle="없음"
        emptyDescription="설명"
      />
    );

    expect(html).toContain("김테스트");
    expect(html).toContain("DB 배정 대상");
    expect(html).toContain("미배정");
    expect(html).not.toContain("연락처");
    expect(html).not.toContain("<table");
  });

  it("shows selected state on mobile cards", () => {
    const html = renderToStaticMarkup(
      <CustomerAssignCustomerList
        customers={sampleCustomers}
        totalCount={1}
        selected={[1]}
        onToggle={() => undefined}
        onToggleAll={() => undefined}
        search=""
        onSearchChange={() => undefined}
        statusFilter="all"
        onStatusFilterChange={() => undefined}
        sourceFilter="all"
        onSourceFilterChange={() => undefined}
        statusOptions={[]}
        sourceOptions={[]}
        title="미배정 고객"
        emptyTitle="없음"
        emptyDescription="설명"
      />
    );

    expect(html).toContain("선택됨");
  });

  it("renders mobile action bar with workflow-specific copy", () => {
    const html = renderToStaticMarkup(
      <CustomerAssignMobileActionBar
        selectedCount={2}
        canExecute
        workflowKind="dbAssignment"
        actionLabel="2명 배정"
        helperText="홍길동 (팀원)"
        pending={false}
        onExecute={() => undefined}
        onClearSelection={() => undefined}
      />
    );

    expect(html).toContain("선택한 고객 2명");
    expect(html).toContain(WORKFLOW_COPY.dbAssignment.title);
    expect(html).toContain("2명 배정");
    expect(html).toContain("선택 해제");
    expect(html).toContain("bottom-[68px]");
  });

  it("hides action bar when nothing is selected", () => {
    const html = renderToStaticMarkup(
      <CustomerAssignMobileActionBar
        selectedCount={0}
        canExecute={false}
        workflowKind="dbDistribution"
        actionLabel="배분하기"
        pending={false}
        onExecute={() => undefined}
        onClearSelection={() => undefined}
      />
    );

    expect(html).toBe("");
  });
});
