import { describe, expect, it } from "vitest";

import {
  EMPTY_UX,
  ERROR_UX,
  getEmptyCopy,
  getLoadErrorCopy,
  getLoadingCopy,
  getSafeBlockedMessage,
  LOADING_UX,
  MOBILE_STATE_UX,
  SENSITIVE_ACCESS_UX,
} from "./stateUxCopy";

describe("stateUxCopy", () => {
  it("provides consistent loading copy", () => {
    expect(LOADING_UX.defaultTitle).toBe("정보를 불러오는 중입니다.");
    expect(getLoadingCopy("고객 목록").title).toBe(
      "고객 목록을(를) 불러오는 중입니다."
    );
  });

  it("distinguishes empty and filtered empty copy", () => {
    expect(getEmptyCopy("고객").title).toBe("조건에 맞는 고객이 없습니다.");
    expect(getEmptyCopy("고객", { hasActiveFilters: true }).title).toBe(
      "현재 필터에 맞는 고객이 없습니다."
    );
    expect(EMPTY_UX.filterResetLabel).toBe("필터 초기화");
  });

  it("provides scoped load error titles", () => {
    expect(getLoadErrorCopy().title).toBe(ERROR_UX.loadTitle);
    expect(getLoadErrorCopy("알림").title).toBe(
      "알림을(를) 불러오지 못했습니다."
    );
  });

  it("keeps sensitive access copy separate from forbidden copy", () => {
    expect(SENSITIVE_ACCESS_UX.title).toBe("세부 정보를 표시할 수 없습니다.");
    expect(SENSITIVE_ACCESS_UX.description).toContain(
      "목록으로 돌아가 다시 선택해 주세요"
    );
    expect(SENSITIVE_ACCESS_UX.listActionLabel).toBe("고객 목록으로 이동");
  });

  it("never discloses existence, ownership, or permission in sensitive copy", () => {
    const combined = `${SENSITIVE_ACCESS_UX.title} ${SENSITIVE_ACCESS_UX.description}`;
    for (const banned of [
      "권한이 없",
      "다른 담당자",
      "타 지점",
      "존재하지 않",
      "고객 ID",
      "접근할 수",
    ]) {
      expect(combined).not.toContain(banned);
    }
  });

  it("keeps mobile state copy concise and action-oriented", () => {
    const mobileCopy = [
      MOBILE_STATE_UX.customerList.emptyDescription,
      MOBILE_STATE_UX.calendar.todayEmptyDescription,
      MOBILE_STATE_UX.notifications.emptyDescription,
      MOBILE_STATE_UX.dashboard.notificationEmpty,
      MOBILE_STATE_UX.customerAssign.emptyDescription,
    ].join(" ");

    expect(MOBILE_STATE_UX.dashboard.todayWorkEmpty).toBe(
      "오늘 바로 처리할 업무가 없습니다."
    );
    expect(mobileCopy).not.toContain("다른 담당자");
    expect(mobileCopy).not.toContain("타 지점");
    expect(mobileCopy).not.toContain("고객 ID");
    expect(mobileCopy).not.toContain("403");
    expect(mobileCopy).not.toContain("tRPC");
  });

  it("sanitizes unsafe blocked preview messages", () => {
    expect(getSafeBlockedMessage("Internal server error")).toBe(
      "현재 조건에서는 미리보기를 표시할 수 없습니다."
    );
    expect(getSafeBlockedMessage("연동 권한이 필요합니다.")).toBe(
      "연동 권한이 필요합니다."
    );
  });
});
