import { describe, expect, it } from "vitest";
import {
  getManagerQuickLinks,
  getMemberQuickActions,
  getOperationalCardsForRole,
  getScopeLabel,
  pickTeamSupportAssignees,
  resolveOperationalCardPath,
} from "./roleOperationalDashboard";

describe("roleOperationalDashboard", () => {
  it("returns scope labels per role", () => {
    expect(getScopeLabel("branch_admin")).toBe("지점 전체");
    expect(getScopeLabel("sub_branch_admin")).toBe("산하 조직");
    expect(getScopeLabel("team_leader")).toBe("내 팀");
    expect(getScopeLabel("member")).toBe("내 고객");
  });

  it("does not expose operational cards to branch_admin or inactive roles", () => {
    expect(getOperationalCardsForRole("branch_admin")).toEqual([]);
    expect(getOperationalCardsForRole("inactive")).toEqual([]);
    expect(getOperationalCardsForRole("resigned")).toEqual([]);
  });

  it("returns member execution cards with whitelisted preset links", () => {
    const cards = getOperationalCardsForRole("member");
    expect(cards.map(card => card.id)).toEqual([
      "today-contact",
      "overdue-followup",
      "today-schedule",
      "priority-contact",
    ]);
    expect(resolveOperationalCardPath(cards[0]!.link)).toBe(
      "/customers?preset=today-follow-up"
    );
    expect(resolveOperationalCardPath(cards[1]!.link)).toBe(
      "/customers?preset=overdue-follow-up"
    );
    expect(resolveOperationalCardPath(cards[3]!.link)).toBe(
      "/customers?preset=priority-contact"
    );
  });

  it("returns manager operational cards for sub_branch_admin and team_leader", () => {
    for (const role of ["sub_branch_admin", "team_leader"] as const) {
      const cards = getOperationalCardsForRole(role);
      expect(cards.map(card => card.id)).toEqual([
        "today-contact",
        "overdue-followup",
        "today-schedule",
        "notifications",
        "long-unmanaged",
        "incomplete-schedule",
      ]);
      expect(cards.every(card => card.scopeLabel === getScopeLabel(role))).toBe(
        true
      );
    }
  });

  it("maps schedule and notification cards to dedicated routes", () => {
    const managerCards = getOperationalCardsForRole("team_leader");
    const schedule = managerCards.find(card => card.id === "today-schedule");
    const notifications = managerCards.find(
      card => card.id === "notifications"
    );
    expect(resolveOperationalCardPath(schedule!.link)).toBe("/calendar");
    expect(resolveOperationalCardPath(notifications!.link)).toBe(
      "/notifications"
    );
  });

  it("exposes member quick actions without unsupported preset values", () => {
    const actions = getMemberQuickActions();
    const paths = actions.map(action => action.path);
    expect(paths).toContain("/customers?preset=today-follow-up");
    expect(paths).toContain("/customers?preset=overdue-follow-up");
    expect(paths).toContain("/customers?action=quick-followup");
    expect(paths).toContain("/customers?preset=priority-contact");
    expect(paths).toContain("/calendar");
    expect(paths.filter(path => path.includes("preset="))).not.toContain(
      "/customers?preset=pending-follow-up"
    );
  });

  it("exposes manager quick links for operational screens", () => {
    const links = getManagerQuickLinks("team_leader");
    expect(links.map(link => link.path)).toEqual([
      "/customers",
      "/customers/assign",
      "/team-insights",
    ]);
  });

  it("ranks team support assignees by open work without exposing zero-work users", () => {
    const assignees = pickTeamSupportAssignees([
      {
        user: { id: 1, name: "김팀원", role: "member" },
        metrics: {
          overdueFollowUpsCount: 0,
          todayFollowUpsCount: 1,
          incompleteSchedulesCount: 0,
          unconsultedDbCount: 0,
        },
      },
      {
        user: { id: 2, name: "이팀원", role: "member" },
        metrics: {
          overdueFollowUpsCount: 2,
          todayFollowUpsCount: 0,
          incompleteSchedulesCount: 1,
          unconsultedDbCount: 1,
        },
      },
    ]);

    expect(assignees).toHaveLength(1);
    expect(assignees[0]?.userId).toBe(2);
    expect(assignees[0]?.openWorkCount).toBe(4);
    expect(assignees[0]?.overdueFollowUpCount).toBe(2);
  });
});
