import { describe, expect, it } from "vitest";
import {
  formatUnreadBadgeCount,
  getUnreadBadgeAriaLabel,
  getUnreadBadgeLabel,
  shouldShowUnreadBadge,
} from "./unreadBadge";

describe("unreadBadge", () => {
  it("formats badge counts with a shared 99+ cap", () => {
    expect(formatUnreadBadgeCount(0)).toBe("");
    expect(formatUnreadBadgeCount(1)).toBe("1");
    expect(formatUnreadBadgeCount(9)).toBe("9");
    expect(formatUnreadBadgeCount(10)).toBe("10");
    expect(formatUnreadBadgeCount(99)).toBe("99");
    expect(formatUnreadBadgeCount(100)).toBe("99+");
    expect(formatUnreadBadgeCount(250)).toBe("99+");
  });

  it("hides badge while loading or on query error", () => {
    expect(shouldShowUnreadBadge({ count: 5, isLoading: true })).toBe(false);
    expect(shouldShowUnreadBadge({ count: 5, isError: true })).toBe(false);
    expect(getUnreadBadgeLabel({ count: 12 })).toBe("12");
    expect(getUnreadBadgeLabel({ count: 12, isLoading: true })).toBeNull();
    expect(getUnreadBadgeLabel({ count: 12, isError: true })).toBeNull();
  });

  it("uses aria labels that match the displayed count", () => {
    expect(getUnreadBadgeAriaLabel({ count: 0 })).toContain("없음");
    expect(getUnreadBadgeAriaLabel({ count: 3 })).toBe("읽지 않은 알림 3건");
    expect(getUnreadBadgeAriaLabel({ count: 120 })).toContain("99건 이상");
    expect(getUnreadBadgeAriaLabel({ isLoading: true })).toContain(
      "불러오는 중"
    );
    expect(getUnreadBadgeAriaLabel({ isError: true })).toContain(
      "불러오지 못했습니다"
    );
  });
});
