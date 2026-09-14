import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowupQuickCreateDialog from "./FollowupQuickCreateDialog";
import ScheduleCustomerLinkPicker from "../schedule/ScheduleCustomerLinkPicker";

const query = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: { customers: { searchForSchedulePicker: query } },
}));
vi.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: Wrapper,
    DialogContent: Wrapper,
    DialogHeader: Wrapper,
    DialogTitle: Wrapper,
    useDialogComposition: () => null,
  };
});

beforeEach(() => {
  vi.stubGlobal("React", React);
  query.useQuery.mockReset();
  query.useQuery.mockImplementation((input, options) => ({
    data: options.enabled
      ? {
          selectedCustomer: {
            id: input.selectedCustomerId,
            name: "[TEST] Customer A",
            maskedPhone: "010-****-5678",
            statusLabel: "미상담",
            priorityLabel: "A",
            assignedUserName: "[TEST] 담당자",
          },
          items: [],
        }
      : undefined,
    isFetching: false,
    isPending: !options.enabled,
    isError: false,
    isSuccess: options.enabled,
    refetch: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("P2-04 locked follow-up target", () => {
  it("PRE-FIX T01/T03-T08: first open requests the selected ID and displays the target without search controls", () => {
    const html = renderToStaticMarkup(
      <FollowupQuickCreateDialog
        open
        defaultCustomerId={101}
        loading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onOpenDetailed={vi.fn()}
      />
    );
    expect(query.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCustomerId: 101, search: undefined }),
      expect.objectContaining({ enabled: true })
    );
    expect(html).toContain("[TEST] Customer A");
    expect(html).toContain("010-****-5678");
    expect(html).not.toContain("01012345678");
    expect(html).not.toContain("고객명 또는 연락처로 검색");
    expect(html).not.toContain("2글자");
    expect(html).not.toContain("연결 해제");
    expect(html).not.toContain("일정과 연결할");
  });

  it("T01/R03 disabled interactions still permit selected lookup and preserve summary", () => {
    const html = renderToStaticMarkup(
      <ScheduleCustomerLinkPicker
        value={101}
        onChange={vi.fn()}
        selectionLocked
        disabled
      />
    );
    expect(query.useQuery.mock.lastCall?.[1].enabled).toBe(true);
    expect(html).toContain("[TEST] Customer A");
    expect(html).not.toContain("연결 해제");
  });

  it("T02 pending selected lookup has a target loading state", () => {
    query.useQuery.mockReturnValue({
      isPending: true,
      isFetching: true,
      isError: false,
    });
    const html = renderToStaticMarkup(
      <ScheduleCustomerLinkPicker
        value={101}
        onChange={vi.fn()}
        selectionLocked
      />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("대상 고객을 확인하고 있습니다.");
    expect(html).not.toContain("검색 중");
    expect(html).not.toContain("2글자");
  });

  it.each(["error", "missing", "mismatched", "cached-error"])(
    "T12/T13 %s target is unavailable and detailed entry is blocked",
    mode => {
      query.useQuery.mockReturnValue({
        isPending: false,
        isFetching: false,
        isError: mode.includes("error"),
        data: {
          selectedCustomer:
            mode === "cached-error"
              ? { id: 101, name: "[TEST] Stale" }
              : mode === "mismatched"
                ? { id: 102, name: "[TEST] Wrong" }
                : null,
          items: [],
        },
        refetch: vi.fn(),
      });
      const html = renderToStaticMarkup(
        <FollowupQuickCreateDialog
          open
          defaultCustomerId={101}
          loading={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onOpenDetailed={vi.fn()}
        />
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain("대상 고객을 확인할 수 없습니다.");
      expect(html).toContain("대상 고객 다시 확인");
      expect(html).not.toContain("[TEST] Wrong");
      expect(html).not.toContain("[TEST] Stale");
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>상세 입력<\/button>/);
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>후속 등록<\/button>/);
    }
  );

  it("T09 locked null avoids lookup and search, while editable null retains the search hint", () => {
    const locked = renderToStaticMarkup(
      <ScheduleCustomerLinkPicker
        value={null}
        onChange={vi.fn()}
        selectionLocked
      />
    );
    expect(query.useQuery.mock.lastCall?.[1].enabled).toBe(false);
    expect(locked).toContain("대상 고객을 확인할 수 없습니다.");
    expect(locked).not.toContain("2글자");
    const editable = renderToStaticMarkup(
      <ScheduleCustomerLinkPicker value={null} onChange={vi.fn()} />
    );
    expect(query.useQuery.mock.lastCall?.[1].enabled).toBe(false);
    expect(editable).toContain("2글자");
    expect(editable).toContain("고객명 또는 연락처로 검색");
    expect(editable).toContain("일정과 연결할 고객");
  });

  it("T11 editable selected customer retains unlink", () => {
    const html = renderToStaticMarkup(
      <ScheduleCustomerLinkPicker value={101} onChange={vi.fn()} />
    );
    expect(html).toContain("연결 해제");
    expect(html).toContain("고객명 또는 연락처로 검색");
  });
});
