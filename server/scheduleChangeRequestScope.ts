import { TRPCError } from "@trpc/server";
import {
  effectiveParentUserId,
  ensureOrgUsers,
  type OrgTeam,
  type OrgUser,
} from "./organizationHierarchy";

export function getScheduleRequestTargetUserIds(
  actor: OrgUser,
  usersList: OrgUser[],
  teamsList: OrgTeam[]
): number[] {
  if (actor.accountStatus !== "active") return [];
  if (actor.role !== "sub_branch_admin" && actor.role !== "team_leader") {
    return [];
  }
  const organizationUsers = ensureOrgUsers(usersList, actor);
  const activeUsers = organizationUsers.filter(
    user => user.accountStatus === "active"
  );
  const directChildren = activeUsers.filter(
    user =>
      effectiveParentUserId(user, organizationUsers, teamsList) === actor.id
  );

  if (actor.role === "team_leader") {
    return directChildren
      .filter(user => user.role === "member")
      .map(user => user.id);
  }

  const directLeaderIds = new Set(
    directChildren
      .filter(user => user.role === "team_leader")
      .map(user => user.id)
  );
  return activeUsers
    .filter(user => {
      const parentId = effectiveParentUserId(
        user,
        organizationUsers,
        teamsList
      );
      return (
        (user.role === "team_leader" && parentId === actor.id) ||
        (user.role === "member" &&
          (parentId === actor.id || directLeaderIds.has(parentId ?? -1)))
      );
    })
    .map(user => user.id);
}

export function canRequestScheduleChange(
  actor: OrgUser,
  target: OrgUser,
  usersList: OrgUser[],
  teamsList: OrgTeam[]
) {
  return getScheduleRequestTargetUserIds(actor, usersList, teamsList).includes(
    target.id
  );
}

export function assertScheduleRequestScope(
  actor: OrgUser,
  target: OrgUser,
  usersList: OrgUser[],
  teamsList: OrgTeam[]
) {
  if (actor.accountStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "비활성 계정은 일정 요청을 만들 수 없습니다.",
    });
  }
  if (target.accountStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "비활성 사용자 일정은 요청할 수 없습니다.",
    });
  }
  if (!canRequestScheduleChange(actor, target, usersList, teamsList)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "산하 직원 일정만 지점장에게 요청할 수 있습니다.",
    });
  }
}
