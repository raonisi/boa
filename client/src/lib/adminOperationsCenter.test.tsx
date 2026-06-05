import { describe, expect, it } from "vitest";

import {
  ADMIN_OPERATION_CARDS,
  CARD_STATUS_LABELS,
  COMING_SOON_NOTICE,
  HIGH_RISK_NOTICE,
  NO_VISIBLE_CARDS_DESCRIPTION,
  RISK_LEVEL_LABELS,
  ROLE_SCOPE_HINTS,
  getVisibleAdminOperationCards,
  isCardVisibleForUser,
} from "./adminOperationsCenter";

describe("adminOperationsCenter copy", () => {
  it("uses the approved badge labels", () => {
    expect(RISK_LEVEL_LABELS.caution).toBe("주의 필요");
    expect(RISK_LEVEL_LABELS.high).toBe("신중 처리");
    expect(CARD_STATUS_LABELS.coming_soon).toBe("준비 중");
  });

  it("uses role-specific scope hints", () => {
    expect(ROLE_SCOPE_HINTS.branch_admin).toContain("전체 조직");
    expect(ROLE_SCOPE_HINTS.sub_branch_admin).toContain("산하 조직");
    expect(ROLE_SCOPE_HINTS.team_leader).toContain("산하 팀원");
  });

  it("includes shared coming-soon and high-risk notices", () => {
    expect(COMING_SOON_NOTICE[0]).toContain("조직 운영 고도화");
    expect(HIGH_RISK_NOTICE[0]).toContain("민감한 작업");
    expect(NO_VISIBLE_CARDS_DESCRIPTION).toContain("지점장에게");
  });
});

describe("adminOperationsCenter visibility", () => {
  it("shows branch-admin cards to branch_admin", () => {
    const cards = getVisibleAdminOperationCards({ role: "branch_admin", accountStatus: "active" });
    expect(cards.some((card) => card.id === "user-management")).toBe(true);
    expect(cards.some((card) => card.id === "oauth-reset")).toBe(true);
  });

  it("hides branch-admin-only cards from team_leader", () => {
    const cards = getVisibleAdminOperationCards({ role: "team_leader", accountStatus: "active" });
    expect(cards.some((card) => card.id === "oauth-reset")).toBe(false);
    expect(cards.some((card) => card.id === "customer-merge")).toBe(false);
    expect(cards.some((card) => card.id === "organization")).toBe(true);
  });

  it("keeps coming-soon cards visible but without routes", () => {
    const card = ADMIN_OPERATION_CARDS.find((item) => item.id === "team-insights");
    expect(card?.isComingSoon).toBe(true);
    expect(card?.status).toBe("coming_soon");
    expect(card?.route).toBeUndefined();
    expect(isCardVisibleForUser(card!, { role: "team_leader", accountStatus: "active" })).toBe(true);
  });

  it("blocks member access", () => {
    expect(getVisibleAdminOperationCards({ role: "member", accountStatus: "active" })).toEqual([]);
  });
});
