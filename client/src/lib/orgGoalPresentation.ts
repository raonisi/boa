import { adminRiskBadgeClasses } from "@/lib/adminDesignTokens";
import {
  getStatusSurfaceClasses,
  getStatusVariantClasses,
  STATUS_BADGE_BASE,
  type StatusVariant,
} from "@/lib/statusPresentation";

/** Organization tree role badges — hierarchy, not customer consult status */
export function getOrgRoleBadgeClasses(role: string): string {
  switch (role) {
    case "branch_admin":
      return `${STATUS_BADGE_BASE} ${adminRiskBadgeClasses.branch_admin_only}`;
    case "sub_branch_admin":
      return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("info")}`;
    case "team_leader":
      return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("info")}`;
    case "member":
      return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("success")}`;
    default:
      return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("neutral")}`;
  }
}

export function getAccountStatusBadgeClasses(status: string): string {
  if (status === "active") {
    return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("success")}`;
  }
  if (status === "inactive" || status === "resigned") {
    return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("inactive")}`;
  }
  return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("danger")}`;
}

type OrgRelationBadge = { label: string; variant: StatusVariant };

export function getOrgRelationBadge(
  node: { role: string; accountStatus: string },
  parent?: { role: string } | null
): OrgRelationBadge | null {
  if (node.role === "branch_admin") return null;
  if (node.accountStatus !== "active") {
    return { label: "비활성 조직원", variant: "inactive" };
  }
  if (!parent) {
    return { label: "미배정", variant: "warning" };
  }
  if (parent.role === "branch_admin" && node.role === "team_leader") {
    return { label: "직할 팀장", variant: "warning" };
  }
  if (parent.role === "branch_admin" && node.role === "member") {
    return { label: "직할 팀원", variant: "warning" };
  }
  if (parent.role === "sub_branch_admin" && node.role === "team_leader") {
    return { label: "산하 팀장", variant: "info" };
  }
  if (parent.role === "sub_branch_admin" && node.role === "member") {
    return { label: "직할 팀원", variant: "info" };
  }
  if (parent.role === "team_leader" && node.role === "member") {
    return { label: "팀 소속", variant: "info" };
  }
  return null;
}

export function getOrgRelationBadgeClasses(variant: StatusVariant): string {
  return `${STATUS_BADGE_BASE} ${getStatusSurfaceClasses(variant)}`;
}

export type GoalAchievementStatus = {
  label: string;
  variant: StatusVariant;
};

export function getGoalAchievementStatus(
  item:
    | {
        achievementRate?: {
          contractCount?: number | null;
          monthlyPremium?: number | null;
        };
        remainingDays?: number | null;
      }
    | null
    | undefined
): GoalAchievementStatus {
  if (!item) {
    return { label: "목표 없음", variant: "neutral" };
  }
  const contractRate = Number(item.achievementRate?.contractCount ?? 0);
  const premiumRate = Number(item.achievementRate?.monthlyPremium ?? 0);
  const bestRate = Math.max(contractRate, premiumRate);
  if (bestRate >= 100) {
    return { label: "목표 달성", variant: "success" };
  }
  if ((item.remainingDays ?? 0) <= 5 && bestRate < 80) {
    return { label: "미달 위험", variant: "danger" };
  }
  return { label: "진행중", variant: "warning" };
}

export function getGoalAchievementBadgeClasses(
  status: GoalAchievementStatus
): string {
  return `${STATUS_BADGE_BASE} ${getStatusVariantClasses(status.variant)}`;
}

/** Team management inline role / assignment state chips */
export function getTeamMemberRoleBadgeClasses(role: string): string {
  if (role === "team_leader") {
    return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("info")}`;
  }
  return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("neutral")}`;
}

export function getTeamUnassignedRoleBadgeClasses(): string {
  return `${STATUS_BADGE_BASE} ${getStatusVariantClasses("warning")}`;
}
