import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { OrgTeam, OrgUser } from "./organizationHierarchy";
import {
  assertScheduleRequestScope,
  canRequestScheduleChange,
  getScheduleRequestTargetUserIds,
} from "./scheduleChangeRequestScope";

const users: OrgUser[] = [
  {
    id: 1,
    role: "branch_admin",
    accountStatus: "active",
    parentUserId: null,
    teamId: null,
    subBranchAdminId: null,
  },
  {
    id: 2,
    role: "sub_branch_admin",
    accountStatus: "active",
    parentUserId: null,
    teamId: null,
    subBranchAdminId: null,
  },
  {
    id: 3,
    role: "team_leader",
    accountStatus: "active",
    parentUserId: 2,
    teamId: 10,
    subBranchAdminId: 2,
  },
  {
    id: 4,
    role: "member",
    accountStatus: "active",
    parentUserId: 2,
    teamId: null,
    subBranchAdminId: 2,
  },
  {
    id: 5,
    role: "member",
    accountStatus: "active",
    parentUserId: 3,
    teamId: 10,
    subBranchAdminId: 2,
  },
  {
    id: 6,
    role: "sub_branch_admin",
    accountStatus: "active",
    parentUserId: null,
    teamId: null,
    subBranchAdminId: null,
  },
  {
    id: 7,
    role: "team_leader",
    accountStatus: "active",
    parentUserId: 6,
    teamId: 20,
    subBranchAdminId: 6,
  },
  {
    id: 8,
    role: "member",
    accountStatus: "active",
    parentUserId: 7,
    teamId: 20,
    subBranchAdminId: 6,
  },
  {
    id: 9,
    role: "member",
    accountStatus: "inactive",
    parentUserId: 2,
    teamId: null,
    subBranchAdminId: 2,
  },
  {
    id: 10,
    role: "member",
    accountStatus: "resigned",
    parentUserId: 3,
    teamId: 10,
    subBranchAdminId: 2,
  },
];

const teams: OrgTeam[] = [
  { id: 10, managerId: 3, subBranchAdminId: 2, isActive: true },
  { id: 20, managerId: 7, subBranchAdminId: 6, isActive: true },
];

function user(id: number) {
  const found = users.find(item => item.id === id);
  if (!found) throw new Error(`Missing test user ${id}`);
  return found;
}

function expectForbidden(run: () => unknown) {
  try {
    run();
    throw new Error("Expected FORBIDDEN");
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("FORBIDDEN");
  }
}

describe("schedule change request hierarchy scope", () => {
  it("allows a sub-branch admin to request for a direct member, subordinate leader, and that leader's member", () => {
    expect(getScheduleRequestTargetUserIds(user(2), users, teams)).toEqual([
      3, 4, 5,
    ]);
    expect(canRequestScheduleChange(user(2), user(3), users, teams)).toBe(true);
    expect(canRequestScheduleChange(user(2), user(4), users, teams)).toBe(true);
    expect(canRequestScheduleChange(user(2), user(5), users, teams)).toBe(true);
  });

  it("rejects a sub-branch admin request outside the subordinate hierarchy", () => {
    expect(canRequestScheduleChange(user(2), user(8), users, teams)).toBe(
      false
    );
    expectForbidden(() =>
      assertScheduleRequestScope(user(2), user(8), users, teams)
    );
  });

  it("allows a team leader to request only for direct active members", () => {
    expect(getScheduleRequestTargetUserIds(user(3), users, teams)).toEqual([5]);
    expect(canRequestScheduleChange(user(3), user(5), users, teams)).toBe(true);
    expect(canRequestScheduleChange(user(3), user(4), users, teams)).toBe(
      false
    );
    expect(canRequestScheduleChange(user(3), user(7), users, teams)).toBe(
      false
    );
  });

  it("rejects member and branch-admin actors from the subordinate request flow", () => {
    expect(getScheduleRequestTargetUserIds(user(5), users, teams)).toEqual([]);
    expect(getScheduleRequestTargetUserIds(user(1), users, teams)).toEqual([]);
    expectForbidden(() =>
      assertScheduleRequestScope(user(5), user(4), users, teams)
    );
  });

  it("rejects inactive and resigned actors and targets", () => {
    const inactiveActor = { ...user(2), accountStatus: "inactive" };
    const resignedActor = { ...user(3), accountStatus: "resigned" };

    expect(getScheduleRequestTargetUserIds(inactiveActor, users, teams)).toEqual(
      []
    );
    expect(getScheduleRequestTargetUserIds(resignedActor, users, teams)).toEqual(
      []
    );
    expectForbidden(() =>
      assertScheduleRequestScope(inactiveActor, user(4), users, teams)
    );
    expectForbidden(() =>
      assertScheduleRequestScope(resignedActor, user(5), users, teams)
    );
    expectForbidden(() =>
      assertScheduleRequestScope(user(2), user(9), users, teams)
    );
    expectForbidden(() =>
      assertScheduleRequestScope(user(3), user(10), users, teams)
    );
  });

  it("does not widen request scope through an unexpected member-to-member chain", () => {
    const nestedMember: OrgUser = {
      id: 11,
      role: "member",
      accountStatus: "active",
      parentUserId: 5,
      teamId: 10,
      subBranchAdminId: 2,
    };
    const extendedUsers = [...users, nestedMember];

    expect(
      getScheduleRequestTargetUserIds(user(3), extendedUsers, teams)
    ).not.toContain(11);
    expect(
      getScheduleRequestTargetUserIds(user(2), extendedUsers, teams)
    ).not.toContain(11);
  });
});
