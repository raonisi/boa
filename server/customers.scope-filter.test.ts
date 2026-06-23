import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

function createCtx(user: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
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
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([] as any);
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

  it("blocks sub_branch_admin from filtering by out-of-scope agent", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([] as any);
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

    expect(getCustomersSpy).not.toHaveBeenCalled();
  });
});
