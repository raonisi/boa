import { describe, expect, it } from "vitest";

import {
  getPageRowSelectionLabel,
  getPageSelectAllLabel,
} from "./checkboxA11yLabels";

describe("checkboxA11yLabels", () => {
  it("uses safe assign row labels without customer-identifying text", () => {
    const label = getPageRowSelectionLabel({
      surface: "customer",
      rowIndex: 2,
      workflow: "assign",
    });
    expect(label).toBe("현재 페이지 배정 대상 고객 2번 행 선택");
    expect(label).not.toMatch(/010-|김|이름/);
  });

  it("uses safe notification row labels", () => {
    expect(
      getPageRowSelectionLabel({ surface: "notification", rowIndex: 3 })
    ).toBe("현재 페이지 알림 3번 행 선택");
  });

  it("describes current-page select-all scope", () => {
    expect(
      getPageSelectAllLabel({ surface: "customer", workflow: "assign" })
    ).toBe("현재 페이지 배정 대상 고객 전체 선택");
    expect(getPageSelectAllLabel({ surface: "notification" })).toBe(
      "현재 페이지 알림 전체 선택"
    );
  });
});
