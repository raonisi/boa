import {
  getAllTeams,
  getAllUsers,
  getUsersBySubBranchAdminId,
  getUsersByTeamId,
} from "./db";
import {
  descendantUserIdsFrom,
  ensureOrgUsers,
  type OrgTeam,
  type OrgUser,
} from "./organizationHierarchy";

export async function getHierarchyScopeUserIds(actor: {
  id: number;
  role: string;
  accountStatus: string;
  teamId?: number | null;
  subBranchAdminId?: number | null;
}): Promise<number[] | undefined> {
  if (actor.role === "branch_admin") return undefined;
  const [usersList, teamsList] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
  ]);
  if (actor.role === "sub_branch_admin" || actor.role === "team_leader") {
    const ids = descendantUserIdsFrom(
      actor.id,
      ensureOrgUsers(usersList as OrgUser[], actor),
      teamsList as OrgTeam[],
      true
    );
    if (ids.length > 1) return ids;
    if (actor.role === "team_leader" && actor.teamId) {
      const teamMembers = await getUsersByTeamId(actor.teamId);
      return Array.from(
        new Set([
          actor.id,
          ...teamMembers
            .filter(
              (member: any) =>
                !member.accountStatus || member.accountStatus === "active"
            )
            .map(member => member.id),
        ])
      );
    }
    if (actor.role === "sub_branch_admin") {
      const subordinates = await getUsersBySubBranchAdminId(actor.id);
      return Array.from(
        new Set([
          actor.id,
          ...subordinates
            .filter(
              (member: any) =>
                !member.accountStatus || member.accountStatus === "active"
            )
            .map(member => member.id),
        ])
      );
    }
    return ids;
  }
  return [actor.id];
}
