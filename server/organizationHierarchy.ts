export type OrgUser = {
  id: number;
  name?: string | null;
  role: string;
  accountStatus: string;
  parentUserId?: number | null;
  teamId: number | null;
  subBranchAdminId: number | null;
};

export type OrgTeam = {
  id: number;
  managerId: number | null;
  subBranchAdminId: number | null;
  isActive?: boolean | null;
};

export function effectiveParentUserId(
  user: OrgUser,
  _usersList: OrgUser[],
  teamsList: OrgTeam[]
): number | null {
  if (user.parentUserId !== undefined && user.parentUserId !== null) {
    return user.parentUserId;
  }
  if (user.role === "branch_admin" || user.role === "sub_branch_admin") {
    return null;
  }
  if (user.role === "team_leader") return user.subBranchAdminId ?? null;
  if (user.role === "member") {
    if (user.teamId !== null) {
      const team = teamsList.find(item => item.id === user.teamId);
      if (team?.managerId) return team.managerId;
    }
    if (user.subBranchAdminId !== null) return user.subBranchAdminId;
  }
  return null;
}

export function ensureOrgUsers(
  usersList: OrgUser[],
  actor: { id: number; role: string; accountStatus?: string },
  target?: OrgUser
) {
  const byId = new Map<number, OrgUser>();
  for (const user of usersList) byId.set(user.id, user);
  if (!byId.has(actor.id)) {
    byId.set(actor.id, {
      id: actor.id,
      name: null,
      role: actor.role,
      accountStatus: actor.accountStatus ?? "active",
      parentUserId: null,
      teamId: null,
      subBranchAdminId: null,
    });
  }
  if (target && !byId.has(target.id)) byId.set(target.id, target);
  return Array.from(byId.values());
}

export function descendantUserIdsFrom(
  rootUserId: number,
  usersList: OrgUser[],
  teamsList: OrgTeam[],
  includeRoot = true
): number[] {
  const result = new Set<number>();
  if (includeRoot) result.add(rootUserId);
  const walk = (parentId: number) => {
    for (const user of usersList) {
      if (user.accountStatus !== "active") continue;
      if (effectiveParentUserId(user, usersList, teamsList) !== parentId) {
        continue;
      }
      if (result.has(user.id)) continue;
      result.add(user.id);
      walk(user.id);
    }
  };
  walk(rootUserId);
  return Array.from(result);
}
