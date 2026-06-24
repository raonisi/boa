import { describe, expect, it } from "vitest";
import {
  getAccountStatusBadgeClasses,
  getGoalAchievementStatus,
  getOrgRelationBadge,
  getOrgRoleBadgeClasses,
  getTeamMemberRoleBadgeClasses,
} from "./orgGoalPresentation";

describe("orgGoalPresentation", () => {
  it("maps org roles to semantic badge classes", () => {
    expect(getOrgRoleBadgeClasses("branch_admin")).toContain("boa-amber");
    expect(getOrgRoleBadgeClasses("member")).toContain("boa-green");
    expect(getOrgRoleBadgeClasses("unknown_role")).toContain("muted");
  });

  it("maps account status without treating inactive as success", () => {
    expect(getAccountStatusBadgeClasses("active")).toContain("boa-green");
    expect(getAccountStatusBadgeClasses("inactive")).toContain("muted");
    expect(getAccountStatusBadgeClasses("resigned")).toContain("muted");
  });

  it("maps org relation badges with correct semantics", () => {
    expect(
      getOrgRelationBadge(
        { role: "member", accountStatus: "inactive" },
        { role: "team_leader" }
      )
    ).toEqual({ label: "비활성 조직원", variant: "inactive" });

    expect(
      getOrgRelationBadge({ role: "member", accountStatus: "active" }, null)
    ).toEqual({ label: "미배정", variant: "warning" });
  });

  it("maps goal achievement states", () => {
    expect(getGoalAchievementStatus(null)).toEqual({
      label: "목표 없음",
      variant: "neutral",
    });
    expect(
      getGoalAchievementStatus({
        achievementRate: { contractCount: 100, monthlyPremium: 90 },
        remainingDays: 10,
      })
    ).toEqual({ label: "목표 달성", variant: "success" });
    expect(
      getGoalAchievementStatus({
        achievementRate: { contractCount: 50, monthlyPremium: 40 },
        remainingDays: 2,
      })
    ).toEqual({ label: "미달 위험", variant: "danger" });
    expect(
      getGoalAchievementStatus({
        achievementRate: { contractCount: 50, monthlyPremium: 40 },
        remainingDays: 20,
      })
    ).toEqual({ label: "진행중", variant: "warning" });
  });

  it("maps team member role chips", () => {
    expect(getTeamMemberRoleBadgeClasses("team_leader")).toContain("primary");
    expect(getTeamMemberRoleBadgeClasses("member")).toContain("muted");
  });
});
