import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { searchCustomersForSchedulePicker } from "./scheduleCustomerPicker";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";

function createCtx(
  role: Role,
  overrides?: Partial<TrpcContext["user"]>
): TrpcContext {
  const id =
    role === "branch_admin"
      ? 1
      : role === "sub_branch_admin"
        ? 2
        : role === "team_leader"
          ? 3
          : 4;
  return {
    user: {
      id,
      openId: `test-${role}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "google",
      role,
      accountStatus: "active",
      teamId: role === "team_leader" ? 10 : null,
      subBranchAdminId: role === "sub_branch_admin" ? null : 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      headers: { origin: "https://example.test" },
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const sampleCustomer = {
  id: 101,
  name: "[TEST] Alpha",
  phone: "01012345678",
  consultStatus: "미상담",
  priority: "A",
  agentId: 4,
  assignedTeamId: 10,
  subBranchAdminId: 2,
  isActive: true,
  deletedAt: null,
} as any;

beforeEach(() => {
  vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
    if (id === 4) return { id: 4, name: "[TEST] Member", teamId: 10 } as any;
    return undefined;
  });
  vi.spyOn(db, "getAllUsers").mockResolvedValue([
    { id: 4, name: "[TEST] Member", teamId: 10, accountStatus: "active" },
  ] as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("schedule customer picker RBAC", () => {
  it("allows branch_admin scoped search", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([
      sampleCustomer,
    ]);
    const caller = appRouter.createCaller(createCtx("branch_admin"));
    const result = await caller.customers.searchForSchedulePicker({
      search: "Alpha",
    });
    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ search: "Alpha", limit: 21 })
    );
    expect(result.items[0]?.name).toBe("[TEST] Alpha");
  });

  it("scopes member search to own customers", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([
      sampleCustomer,
    ]);
    await searchCustomersForSchedulePicker(
      createCtx("member", { id: 99, teamId: 10, subBranchAdminId: 2 }).user,
      { search: "Alpha" }
    );
    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 99, search: "Alpha" })
    );
  });

  it("scopes sub_branch_admin search to sub branch", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    await searchCustomersForSchedulePicker(createCtx("sub_branch_admin").user, {
      search: "kim",
    });
    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ subBranchAdminId: 2, search: "kim" })
    );
  });

  it("scopes team_leader search to team", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    await searchCustomersForSchedulePicker(createCtx("team_leader").user, {
      search: "kim",
    });
    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 10, search: "kim" })
    );
  });

  it("rejects out-of-scope selectedCustomerId", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...sampleCustomer,
      agentId: 999,
    });
    const result = await searchCustomersForSchedulePicker(
      createCtx("member", { id: 4 }).user,
      { selectedCustomerId: 101 }
    );
    expect(result.selectedCustomer).toBeNull();
  });
});

describe("schedule customer picker behavior", () => {
  it("requires at least 2 characters before search", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    const result = await searchCustomersForSchedulePicker(
      createCtx("branch_admin").user,
      { search: "a" }
    );
    expect(getCustomersSpy).not.toHaveBeenCalled();
    expect(result.searchRequired).toBe(true);
    expect(result.hint).toContain("2글자");
  });

  it("returns selected existing customer without search", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(sampleCustomer);
    const result = await searchCustomersForSchedulePicker(
      createCtx("branch_admin").user,
      { selectedCustomerId: 101 }
    );
    expect(result.selectedCustomer?.id).toBe(101);
    expect(result.items[0]?.id).toBe(101);
  });

  it("masks phone in picker response", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([sampleCustomer]);
    const result = await searchCustomersForSchedulePicker(
      createCtx("branch_admin").user,
      { search: "Alpha" }
    );
    expect(result.items[0]?.maskedPhone).toBe("010-****-5678");
    expect(JSON.stringify(result)).not.toContain("01012345678");
  });

  it("flags too many results", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({ ...sampleCustomer, id: i + 1 }))
    );
    const result = await searchCustomersForSchedulePicker(
      createCtx("branch_admin").user,
      { search: "test", limit: 20 }
    );
    expect(result.tooManyResults).toBe(true);
    expect(result.items).toHaveLength(20);
  });
});
