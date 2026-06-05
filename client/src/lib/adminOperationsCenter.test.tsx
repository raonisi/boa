import { describe, expect, it } from "vitest";

import {
  ADMIN_OPERATION_CARDS,
  AVAILABLE_NOTICE,
  BETA_NOTICE,
  CARD_STATUS_LABELS,
  COMING_SOON_NOTICE,
  HIGH_RISK_NOTICE,
  NO_VISIBLE_CARDS_DESCRIPTION,
  PRODUCTION_READY_NOTICE,
  RESTRICTED_NOTICE,
  RISK_LEVEL_LABELS,
  ROLE_SCOPE_HINTS,
  getCardStatusNotice,
  getVisibleAdminOperationCards,
  isCardNavigable,
  isCardVisibleForUser,
} from "./adminOperationsCenter";

describe("adminOperationsCenter copy", () => {
  it("uses the approved badge labels", () => {
    expect(RISK_LEVEL_LABELS.caution).toBe("주의 필요");
    expect(RISK_LEVEL_LABELS.high).toBe("신중 처리");
    expect(CARD_STATUS_LABELS.coming_soon).toBe("준비 중");
    expect(CARD_STATUS_LABELS.beta).toBe("검수 필요");
    expect(CARD_STATUS_LABELS.production_ready).toBe("운영 안정");
  });

  it("uses role-specific scope hints", () => {
    expect(ROLE_SCOPE_HINTS.branch_admin).toContain("전체 조직");
    expect(ROLE_SCOPE_HINTS.sub_branch_admin).toContain("산하 조직");
    expect(ROLE_SCOPE_HINTS.team_leader).toContain("산하 팀원");
  });

  it("includes shared coming-soon and high-risk notices", () => {
    expect(COMING_SOON_NOTICE[0]).toContain("준비 중");
    expect(HIGH_RISK_NOTICE[0]).toContain("민감한 작업");
    expect(NO_VISIBLE_CARDS_DESCRIPTION).toContain("지점장에게");
  });
});

describe("adminOperationsCenter feature availability", () => {
  const findCard = (id: string) => ADMIN_OPERATION_CARDS.find((item) => item.id === id);

  it("marks implemented audit features as navigable", () => {
    const implementedIds = [
      "aftercare-campaigns",
      "onboarding-checklists",
      "first-contact-sla",
      "team-completion",
      "team-coaching",
      "team-insights",
      "today-work-priority",
      "management-reports",
      "operation-risk-report",
    ];

    for (const id of implementedIds) {
      const card = findCard(id);
      expect(card, `${id} should exist`).toBeDefined();
      expect(isCardNavigable(card!)).toBe(true);
      expect(card!.route).toBeTruthy();
    }
  });

  it("exposes customer data quality as an available routed feature", () => {
    const card = findCard("customer-data-quality");
    expect(card?.status).toBe("available");
    expect(card?.route).toBe("/customer-data-quality");
    expect(isCardNavigable(card!)).toBe(true);
    expect(card?.description).toContain("보완 필요");
  });

  it("uses beta notice for management reports and team coaching", () => {
    expect(findCard("management-reports")?.status).toBe("beta");
    expect(findCard("team-coaching")?.status).toBe("beta");
    expect(getCardStatusNotice(findCard("management-reports")!)).toEqual(BETA_NOTICE);
  });

  it("uses production_ready notice for operation risk cards", () => {
    expect(findCard("operation-risk-report")?.status).toBe("production_ready");
    expect(getCardStatusNotice(findCard("operation-risk-report")!)).toEqual(PRODUCTION_READY_NOTICE);
  });

  it("uses restricted notice for branch-admin-only cards", () => {
    expect(findCard("deleted-data")?.status).toBe("branch_admin_only");
    expect(getCardStatusNotice(findCard("deleted-data")!)).toEqual(RESTRICTED_NOTICE);
  });

  it("reflects quick consult and timeline in customer-db description", () => {
    const card = findCard("customer-db");
    expect(card?.description).toContain("퀵 상담");
    expect(card?.description).toContain("타임라인");
  });
});

describe("adminOperationsCenter visibility", () => {
  it("shows branch-admin cards to branch_admin", () => {
    const cards = getVisibleAdminOperationCards({ role: "branch_admin", accountStatus: "active" });
    expect(cards.some((card) => card.id === "user-management")).toBe(true);
    expect(cards.some((card) => card.id === "oauth-reset")).toBe(true);
    expect(cards.some((card) => card.id === "deleted-data")).toBe(true);
  });

  it("hides branch-admin-only cards from team_leader", () => {
    const cards = getVisibleAdminOperationCards({ role: "team_leader", accountStatus: "active" });
    expect(cards.some((card) => card.id === "oauth-reset")).toBe(false);
    expect(cards.some((card) => card.id === "customer-merge")).toBe(false);
    expect(cards.some((card) => card.id === "deleted-data")).toBe(false);
    expect(cards.some((card) => card.id === "organization")).toBe(true);
    expect(cards.some((card) => card.id === "team-insights")).toBe(true);
    expect(cards.some((card) => card.id === "first-contact-sla")).toBe(true);
  });

  it("exposes implemented team cards to team_leader", () => {
    const card = ADMIN_OPERATION_CARDS.find((item) => item.id === "team-insights");
    expect(card?.isComingSoon).toBeUndefined();
    expect(card?.status).toBe("available");
    expect(card?.route).toBe("/team-insights");
    expect(isCardVisibleForUser(card!, { role: "team_leader", accountStatus: "active" })).toBe(true);
  });

  it("blocks member access", () => {
    expect(getVisibleAdminOperationCards({ role: "member", accountStatus: "active" })).toEqual([]);
  });

  it("blocks inactive users", () => {
    expect(
      getVisibleAdminOperationCards({ role: "branch_admin", accountStatus: "inactive" }),
    ).toEqual([]);
  });
});
