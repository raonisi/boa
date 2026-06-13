import { describe, expect, it } from "vitest";
import {
  formatUserWithRole,
  getActiveLabel,
  getRoleLabel,
  getScopeLabel,
  getTargetTypeLabel,
  getUserStatusLabel,
  localizeKnownEnumText,
  roleLabel,
} from "../client/src/lib/userRole";

describe("Korean display labels", () => {
  it("maps canonical role enums without changing the enum values", () => {
    expect(getRoleLabel("branch_admin")).toBe("지점장");
    expect(getRoleLabel("sub_branch_admin")).toBe("부지점장");
    expect(getRoleLabel("team_leader")).toBe("팀장");
    expect(getRoleLabel("member")).toBe("팀원");
  });

  it("maps user account statuses", () => {
    expect(getUserStatusLabel("active")).toBe("활성");
    expect(getUserStatusLabel("inactive")).toBe("비활성");
    expect(getUserStatusLabel("resigned")).toBe("퇴사자");
  });

  it("maps common scope and target labels", () => {
    expect(getScopeLabel("managed")).toBe("산하 전체");
    expect(getScopeLabel("mine")).toBe("내 담당 고객");
    expect(getScopeLabel("member")).toBe("조직원별");
    expect(getTargetTypeLabel("customer")).toBe("고객");
  });

  it("formats user display names with Korean role labels", () => {
    expect(formatUserWithRole({ id: 1, name: "홍길동", role: "member" })).toBe(
      "홍길동(팀원)"
    );
    expect(formatUserWithRole({ id: 2, role: "team_leader" })).toBe(
      "사용자 #2(팀장)"
    );
    expect(formatUserWithRole(null)).toBe("-");
  });

  it("keeps the legacy roleLabel behavior for inactive and resigned accounts", () => {
    expect(roleLabel("member", "inactive")).toBe("비활성");
    expect(roleLabel("team_leader", "resigned")).toBe("퇴사자");
  });

  it("localizes known enum text for rendered audit details only", () => {
    expect(
      localizeKnownEnumText(
        '{"role":"branch_admin","accountStatus":"inactive","ownershipScope":"mine"}'
      )
    ).toContain("지점장");
    expect(
      localizeKnownEnumText(
        '{"role":"branch_admin","accountStatus":"inactive","ownershipScope":"mine"}'
      )
    ).toContain("비활성");
    expect(
      localizeKnownEnumText(
        '{"role":"branch_admin","accountStatus":"inactive","ownershipScope":"mine"}'
      )
    ).toContain("내 담당 고객");
    expect(getActiveLabel(false)).toBe("비활성");
  });
});
