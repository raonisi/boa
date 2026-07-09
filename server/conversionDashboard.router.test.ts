import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { appRouter } from "./routers";

function createCtx(
  user: Partial<NonNullable<TrpcContext["user"]>>
): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@boa.local",
      loginMethod: "google",
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...user,
    } as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const users = [
  {
    id: 1,
    name: "Branch Admin",
    role: "branch_admin",
    accountStatus: "active",
    teamId: null,
    subBranchAdminId: null,
    parentUserId: null,
  },
  {
    id: 2,
    name: "Sub Admin",
    role: "sub_branch_admin",
    accountStatus: "active",
    teamId: null,
    subBranchAdminId: null,
    parentUserId: null,
  },
  {
    id: 3,
    name: "Team Leader",
    role: "team_leader",
    accountStatus: "active",
    teamId: 10,
    subBranchAdminId: 2,
    parentUserId: 2,
  },
  {
    id: 4,
    name: "Member A",
    role: "member",
    accountStatus: "active",
    teamId: 10,
    subBranchAdminId: 2,
    parentUserId: 3,
  },
  {
    id: 5,
    name: "Out Member",
    role: "member",
    accountStatus: "active",
    teamId: 20,
    subBranchAdminId: 9,
    parentUserId: 9,
  },
  {
    id: 9,
    name: "Other Sub Admin",
    role: "sub_branch_admin",
    accountStatus: "active",
    teamId: null,
    subBranchAdminId: null,
    parentUserId: null,
  },
] as any;

const teams = [
  { id: 10, name: "Team A", managerId: 3, subBranchAdminId: 2 },
  { id: 20, name: "Team B", managerId: 9, subBranchAdminId: 9 },
] as any;

function mockDashboardSources() {
  vi.spyOn(db, "getAllUsers").mockResolvedValue(users);
  vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
  vi.spyOn(db, "getCustomers").mockResolvedValue([] as any);
  vi.spyOn(db, "getAllContracts").mockResolvedValue([] as any);
  vi.spyOn(db, "getFollowUps").mockResolvedValue([] as any);
  vi.spyOn(db, "getDb").mockResolvedValue(null as any);
}

describe("conversionDashboard router scope", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows branch_admin to query branch scoped dashboard", async () => {
    mockDashboardSources();

    const result = await appRouter
      .createCaller(createCtx({ role: "branch_admin", id: 1 }))
      .conversionDashboard.summary({});

    expect(result.scope.agentIds).toEqual([1, 2, 3, 4, 5, 9]);
  });

  it("allows sub_branch_admin to query subordinate agent only", async () => {
    mockDashboardSources();

    const result = await appRouter
      .createCaller(createCtx({ role: "sub_branch_admin", id: 2 }))
      .conversionDashboard.summary({ agentIdFilter: 4 });

    expect(result.scope.agentIds).toEqual([4]);
  });

  it("blocks sub_branch_admin from querying out-of-scope agent", async () => {
    mockDashboardSources();

    await expect(
      appRouter
        .createCaller(createCtx({ role: "sub_branch_admin", id: 2 }))
        .conversionDashboard.summary({ agentIdFilter: 5 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows team_leader to query subordinate member only", async () => {
    mockDashboardSources();

    const result = await appRouter
      .createCaller(createCtx({ role: "team_leader", id: 3, teamId: 10 }))
      .conversionDashboard.byAgent({ agentIdFilter: 4 });

    expect(result.rows).toEqual([]);
  });

  it("blocks team_leader from querying out-of-team agent", async () => {
    mockDashboardSources();

    await expect(
      appRouter
        .createCaller(createCtx({ role: "team_leader", id: 3, teamId: 10 }))
        .conversionDashboard.summary({ agentIdFilter: 5 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("limits member dashboard to the signed-in member", async () => {
    mockDashboardSources();

    const result = await appRouter
      .createCaller(createCtx({ role: "member", id: 4, teamId: 10 }))
      .conversionDashboard.summary({});

    expect(result.scope.agentIds).toEqual([4]);
  });

  it("blocks member from querying another agent", async () => {
    mockDashboardSources();

    await expect(
      appRouter
        .createCaller(createCtx({ role: "member", id: 4, teamId: 10 }))
        .conversionDashboard.summary({ agentIdFilter: 5 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks inactive and resigned users before aggregation", async () => {
    mockDashboardSources();

    await expect(
      appRouter
        .createCaller(createCtx({ role: "member", id: 4, accountStatus: "inactive" }))
        .conversionDashboard.summary({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter
        .createCaller(createCtx({ role: "member", id: 4, accountStatus: "resigned" }))
        .conversionDashboard.summary({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
