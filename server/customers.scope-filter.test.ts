import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

function createCtx(
  user: Partial<NonNullable<TrpcContext["user"]>>
): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "test-user",
      name: "Test User",
      email: "test@boa.local",
      loginMethod: "google",
      role: "sub_branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...user,
    } as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("customers.list agent filter scope", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows sub_branch_admin to filter by in-scope member", async () => {
    const getCustomersSpy = vi
      .spyOn(db, "getCustomers")
      .mockResolvedValue([] as any);
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 4) {
        return {
          id: 4,
          role: "member",
          accountStatus: "active",
          teamId: 10,
          subBranchAdminId: 2,
          parentUserId: 3,
        } as any;
      }
      return undefined;
    });
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 2,
        role: "sub_branch_admin",
        accountStatus: "active",
        teamId: null,
        subBranchAdminId: null,
        parentUserId: null,
      },
      {
        id: 3,
        role: "team_leader",
        accountStatus: "active",
        teamId: 10,
        subBranchAdminId: 2,
        parentUserId: 2,
      },
      {
        id: 4,
        role: "member",
        accountStatus: "active",
        teamId: 10,
        subBranchAdminId: 2,
        parentUserId: 3,
      },
    ] as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([
      { id: 10, managerId: 3, subBranchAdminId: 2 },
    ] as any);

    await appRouter
      .createCaller(createCtx({ role: "sub_branch_admin", id: 2 }))
      .customers.list({ agentIdFilter: 4 });

    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 4 })
    );
  });

  it("allows hierarchy managers to filter their directly assigned customers", async () => {
    const getCustomersSpy = vi
      .spyOn(db, "getCustomers")
      .mockResolvedValue([] as any);

    await appRouter
      .createCaller(createCtx({ role: "sub_branch_admin", id: 2 }))
      .customers.list({ agentIdFilter: 2 });

    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 2 })
    );
  });

  it("passes customer segment filters without changing sub_branch_admin scope", async () => {
    const getCustomersSpy = vi
      .spyOn(db, "getCustomers")
      .mockResolvedValue([] as any);

    await appRouter
      .createCaller(createCtx({ role: "sub_branch_admin", id: 2 }))
      .customers.list({
        segment: "contracted",
        page: 3,
        pageSize: 50,
        sort: "contract_value",
      });

    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subBranchAdminId: 2,
        segment: "contracted",
        page: 3,
        pageSize: 50,
        sort: "contract_value",
        withSegmentMeta: true,
      })
    );
  });

  it("returns segment counts using the same member scope", async () => {
    const getCountsSpy = vi
      .spyOn(db, "getCustomerSegmentCounts")
      .mockResolvedValue({
        all: 2,
        database: 1,
        contracted: 1,
      });

    const result = await appRouter
      .createCaller(createCtx({ role: "member", id: 4 }))
      .customers.segmentCounts({
        segment: "contracted",
        page: 2,
        pageSize: 50,
        sort: "name",
      });

    expect(result).toEqual({
      all: 2,
      database: 1,
      contracted: 1,
    });
    expect(getCountsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 4 })
    );
    expect(getCountsSpy.mock.calls[0]?.[0]).not.toHaveProperty("segment");
    expect(getCountsSpy.mock.calls[0]?.[0]).not.toHaveProperty("page");
    expect(getCountsSpy.mock.calls[0]?.[0]).not.toHaveProperty("pageSize");
    expect(getCountsSpy.mock.calls[0]?.[0]).not.toHaveProperty("sort");
  });

  it("blocks sub_branch_admin from filtering by out-of-scope agent", async () => {
    const getCustomersSpy = vi
      .spyOn(db, "getCustomers")
      .mockResolvedValue([] as any);
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 99) {
        return {
          id: 99,
          role: "member",
          accountStatus: "active",
          teamId: 99,
          subBranchAdminId: 9,
          parentUserId: 9,
        } as any;
      }
      return undefined;
    });
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 2,
        role: "sub_branch_admin",
        accountStatus: "active",
        teamId: null,
        subBranchAdminId: null,
        parentUserId: null,
      },
    ] as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([] as any);

    await expect(
      appRouter
        .createCaller(createCtx({ role: "sub_branch_admin", id: 2 }))
        .customers.list({ agentIdFilter: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      appRouter
        .createCaller(createCtx({ role: "sub_branch_admin", id: 2 }))
        .customers.segmentCounts({ agentIdFilter: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getCustomersSpy).not.toHaveBeenCalled();
  });
});

describe("P2-02 list and aggregate authorization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("B04: mine plus an explicit assignee remains an AND condition", async () => {
    const list = vi.spyOn(db, "getCustomers").mockResolvedValue([] as any);
    const counts = vi.spyOn(db, "getCustomerSegmentCounts").mockResolvedValue({ all: 0, database: 0, contracted: 0 });
    const caller = appRouter.createCaller(createCtx({ role: "branch_admin", id: 1 }));
    await caller.customers.list({ scope: "mine", agentIdFilter: 4 });
    await caller.customers.segmentCounts({ scope: "mine", agentIdFilter: 4 });
    const expected = expect.objectContaining({ agentId: 1, exactAssignmentFilter: { agentId: 4, unassigned: undefined } });
    expect(list).toHaveBeenCalledWith(expected); expect(counts).toHaveBeenCalledWith(expected);
  });

  it.each([
    ["branch_admin", 1, null, {}],
    ["sub_branch_admin", 2, null, { subBranchAdminId: 2 }],
    ["team_leader", 3, 10, { teamId: 10 }],
    ["member", 4, 10, { agentId: 4 }],
  ] as const)("B08: %s shares server scope for list/count/quick counts", async (role, id, teamId, scope) => {
    const list = vi.spyOn(db, "getCustomers").mockResolvedValue([] as any);
    const counts = vi.spyOn(db, "getCustomerSegmentCounts").mockResolvedValue({ all: 0, database: 0, contracted: 0 });
    const quick = vi.spyOn(db, "getCustomerQuickCounts").mockResolvedValue({ all: 0 } as any);
    const caller = appRouter.createCaller(createCtx({ role, id, teamId }));
    const input = { segment: "contracted" as const, customerIds: [99999], workflowFilter: "uncontacted" as const };
    await caller.customers.list(input); await caller.customers.segmentCounts(input);
    await caller.customers.quickCounts({ segment: "contracted", recommendationIds: [99999], newDbFrom: "2026-09-01", newDbTo: "2026-09-08" });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ ...scope, customerIds: [99999], workflowFilter: "uncontacted" }));
    expect(counts).toHaveBeenCalledWith(expect.objectContaining({ ...scope, customerIds: [99999], workflowFilter: "uncontacted" }));
    expect(quick).toHaveBeenCalledWith(expect.objectContaining({ ...scope, segment: "contracted" }), expect.objectContaining({ mineAgentId: role === "branch_admin" ? id : undefined }));
  });

  it.each(["inactive", "resigned"] as const)("B09: %s blocks every aggregate before DB access", async accountStatus => {
    const counts = vi.spyOn(db, "getCustomerSegmentCounts");
    const quick = vi.spyOn(db, "getCustomerQuickCounts");
    const caller = appRouter.createCaller(createCtx({ role: "member", accountStatus }));
    await expect(caller.customers.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.customers.segmentCounts({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.customers.quickCounts({ segment: "all", newDbFrom: "2026-09-01", newDbTo: "2026-09-08" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(counts).not.toHaveBeenCalled(); expect(quick).not.toHaveBeenCalled();
  });

  it("B09: unauthenticated callers cannot receive counts", async () => {
    const caller = appRouter.createCaller({ ...createCtx({}), user: null });
    await expect(caller.customers.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.customers.segmentCounts({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.customers.quickCounts({ segment: "all", newDbFrom: "2026-09-01", newDbTo: "2026-09-08" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("B09: member agent/org input cannot widen quick count scope, and scope=all is denied", async () => {
    const quick = vi.spyOn(db, "getCustomerQuickCounts").mockResolvedValue({ all: 0 } as any);
    const caller = appRouter.createCaller(createCtx({ id: 4, role: "member" }));
    await caller.customers.quickCounts({ segment: "all", newDbFrom: "2026-09-01", newDbTo: "2026-09-08", scope: "all", agentIdFilter: 99, teamId: 99 } as any);
    expect(quick).toHaveBeenCalledWith(expect.objectContaining({ agentId: 4 }), expect.anything());
    await expect(caller.customers.segmentCounts({ scope: "all" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.customers.segmentCounts({ scope: "member" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("B09/B10: rejects unbounded candidates before querying", async () => {
    const caller = appRouter.createCaller(createCtx({ role: "branch_admin" }));
    await expect(caller.customers.list({ customerIds: Array.from({ length: 51 }, (_, i) => i + 1) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.customers.quickCounts({ segment: "all", newDbFrom: "2026-09-01", newDbTo: "2026-09-08", recommendationIds: Array.from({ length: 51 }, (_, i) => i + 1) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
