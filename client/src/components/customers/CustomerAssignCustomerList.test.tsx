import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerAssignCustomerList } from "./CustomerAssignCustomerList";
import { CustomerAssignMobileActionBar } from "./CustomerAssignMobileActionBar";
import { WORKFLOW_COPY } from "@/lib/assignmentWorkflowCopy";
import { MOBILE_FIXED_ABOVE_NAV_BOTTOM } from "@/lib/mobileLayout";
import { useIsMobile } from "@/hooks/useMobile";

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
    expect(html).toContain("현재 페이지 배정 대상 고객 1번 행 선택");
    expect(html).not.toContain('aria-label="고객 선택"');
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
    expect(html).toContain(MOBILE_FIXED_ABOVE_NAV_BOTTOM);
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

describe.each([false, true])("CustomerAssign query states (mobile=%s)", mobile => {
  beforeEach(() => vi.mocked(useIsMobile).mockReturnValue(mobile));
  const renderList = (overrides: Partial<React.ComponentProps<typeof CustomerAssignCustomerList>> = {}) =>
    renderToStaticMarkup(<CustomerAssignCustomerList
      customers={[]} totalCount={0} selected={[]} onToggle={() => undefined} onToggleAll={() => undefined}
      search="" onSearchChange={() => undefined} statusFilter="all" onStatusFilterChange={() => undefined}
      sourceFilter="all" onSourceFilterChange={() => undefined} statusOptions={[]} sourceOptions={[]}
      title="미배정 고객 목록" emptyTitle="미배정 고객 DB가 없습니다." emptyDescription="고객 등록 후 배정할 수 있습니다."
      onRetry={() => undefined} {...overrides} />);

  it("A01 pending does not render a successful zero", () => {
    const html = renderList({ queryState: { isPending: true, isError: false, isFetching: true, hasData: false } });
    expect(html).toContain("고객 목록을 불러오는 중입니다");
    expect(html).not.toContain("미배정 고객 DB가 없습니다.");
    expect(html).not.toContain("전체 0건");
    expect(html).toContain('aria-busy="true"');
  });
  it("A02 failed query has a named retry and unavailable counts", () => {
    const html = renderList({ queryState: { isPending: false, isError: true, isFetching: false, hasData: false } });
    expect(html).toContain("고객 목록을 불러오지 못했습니다");
    expect(html).toContain("다시 불러오기");
    expect(html).toContain("전체 확인 불가");
    expect(html).toContain("필터 결과 확인 불가");
    expect(html).toContain('aria-label="고객 목록 조회 상태"');
    expect(html).not.toContain("미배정 고객 DB가 없습니다.");
  });
  it("A03 successful zero retains the empty state", () => {
    const html = renderList({ queryState: { isPending: false, isError: false, isFetching: false, hasData: true } });
    expect(html).toContain("미배정 고객 DB가 없습니다.");
    expect(html).toContain("전체 0건");
    expect(html).not.toContain("다시 불러오기");
  });
  it("A05 filtered zero has its own reset action", () => {
    const html = renderList({ totalCount: 1, search: "합성 검색" });
    expect(html).toContain("검색·필터 조건에 맞는 고객이 없습니다");
    expect(html).toContain("필터 초기화");
    expect(html).toContain("전체 1건");
    expect(html).not.toContain("미배정 고객 DB가 없습니다.");
  });
  it("A07 hides cached rows and metrics after refresh failure", () => {
    const html = renderList({ customers: sampleCustomers, totalCount: 1, selected: [1],
      queryState: { isPending: false, isError: true, isFetching: false, hasData: true } });
    expect(html).toContain("최신 상태 확인 실패");
    expect(html).toContain("마지막 조회 자료");
    expect(html).toContain("전체 확인 불가");
    expect(html).not.toContain("김테스트");
    expect(html).not.toContain("전체 1건");
  });
  it("labels previous data while refreshing", () => {
    const html = renderList({ customers: sampleCustomers, totalCount: 1,
      queryState: { isPending: false, isError: false, isFetching: true, hasData: true } });
    expect(html).toContain("마지막 조회 자료 · 최신 상태 확인 중");
    expect(html).toContain("김테스트");
  });
});
