import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as notifications from "./notifications";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
type AccountStatus = "active" | "inactive" | "resigned";

function createCtx(role: Role, opts?: { teamId?: number; subBranchAdminId?: number; userId?: number; accountStatus?: AccountStatus }): TrpcContext {
  const id = opts?.userId ?? (role === "branch_admin" ? 1 : role === "sub_branch_admin" ? 2 : role === "team_leader" ? 3 : 4);
  return {
    user: {
      id,
      openId: `test-${role}-${id}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "manus",
      role,
      accountStatus: opts?.accountStatus ?? "active",
      teamId: opts?.teamId ?? null,
      subBranchAdminId: opts?.subBranchAdminId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createInactiveCtx(role: Role = "member"): TrpcContext {
  return createCtx(role, { accountStatus: "inactive" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    expect(await appRouter.createCaller(ctx).auth.me()).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const ctx = createCtx("branch_admin");
    expect((await appRouter.createCaller(ctx).auth.me())?.role).toBe("branch_admin");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: (name: string) => { cleared.push(name); } } as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBe(1);
  });
});

// ─── RBAC - accountStatus 기반 차단 ──────────────────────────────────────────
describe("RBAC - inactive accountStatus blocked from all data", () => {
  it("blocks inactive from customers.list", async () => {
    await expect(appRouter.createCaller(createInactiveCtx()).customers.list({})).rejects.toThrow("계정이 비활성화되었습니다.");
  });
  it("blocks inactive from schedules.list", async () => {
    await expect(appRouter.createCaller(createInactiveCtx()).schedules.list()).rejects.toThrow();
  });
  it("blocks inactive from notifications.list", async () => {
    await expect(appRouter.createCaller(createInactiveCtx()).notifications.list()).rejects.toThrow();
  });
  it("blocks inactive from performance.stats", async () => {
    await expect(appRouter.createCaller(createInactiveCtx()).performance.stats()).rejects.toThrow();
  });
  it("blocks inactive branch_admin from users.list", async () => {
    await expect(appRouter.createCaller(createInactiveCtx("branch_admin")).users.list()).rejects.toThrow();
  });
});

// ─── RBAC - users.list ────────────────────────────────────────────────────────
describe("RBAC - users.list", () => {
  it("allows branch_admin to access users.list", async () => {
    await expect(appRouter.createCaller(createCtx("branch_admin")).users.list()).resolves.toBeDefined();
  });
  it("allows member to access users.list", async () => {
    await expect(appRouter.createCaller(createCtx("member")).users.list()).resolves.toBeDefined();
  });
  it("allows team_leader to access users.list", async () => {
    await expect(appRouter.createCaller(createCtx("team_leader")).users.list()).resolves.toBeDefined();
  });
  it("returns only minimal self data for member", async () => {
    const result = await appRouter.createCaller(createCtx("member", { userId: 44 })).users.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 44, role: "member", email: null });
    expect("phone" in result[0]).toBe(false);
    expect("memo" in result[0]).toBe(false);
  });
});

describe("RBAC - list null scope guards", () => {
  it("returns empty customers for team_leader without teamId", async () => {
    await expect(appRouter.createCaller(createCtx("team_leader", { teamId: null })).customers.list({})).resolves.toEqual([]);
  });
  it("returns empty contracts for team_leader without teamId", async () => {
    await expect(appRouter.createCaller(createCtx("team_leader", { teamId: null })).contracts.list()).resolves.toEqual([]);
  });
  it("returns empty schedules for team_leader without teamId", async () => {
    await expect(appRouter.createCaller(createCtx("team_leader", { teamId: null })).schedules.list()).resolves.toEqual([]);
  });
});

describe("RBAC - settings", () => {
  it("blocks non-branch_admin from settings.list", async () => {
    await expect(appRouter.createCaller(createCtx("member")).settings.list({ category: "region" })).rejects.toThrow();
  });
  it("allows active users to fetch minimal formOptions", async () => {
    await expect(appRouter.createCaller(createCtx("member")).settings.formOptions({ category: "region" })).resolves.toEqual([]);
  });
});

describe("Bulk import router policy", () => {
  it("blocks non CSV fileName on previewImport", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customers.previewImport({
        fileName: "customers.xlsx",
        rows: [{ 이름: "테스트", 연락처: "010-1234-5678" }],
      })
    ).rejects.toThrow();
  });

  it("blocks non CSV fileName on bulkImport", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customers.bulkImport({
        fileName: "customers.xlsx",
        rows: [{ 이름: "테스트", 연락처: "010-1234-5678" }],
      })
    ).rejects.toThrow();
  });
});

// ─── RBAC - branch_admin only ─────────────────────────────────────────────────
describe("RBAC - updateRole (branch_admin only)", () => {
  it("blocks member from updating user role", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).users.updateRole({ userId: 1, role: "team_leader" })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
  it("blocks team_leader from updating user role", async () => {
    await expect(
      appRouter.createCaller(createCtx("team_leader")).users.updateRole({ userId: 1, role: "member" })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
  it("allows branch_admin to update user role", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).users.updateRole({ userId: 1, role: "member" })
    ).resolves.toBeDefined();
  });
});

// ─── RBAC - DB 배정 권한 ──────────────────────────────────────────────────────
describe("RBAC - customers.assign (sub_branch_admin or above only)", () => {
  it("blocks member from assigning customers", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).customers.assign({ customerId: 1, agentId: 3 })
    ).rejects.toThrow("부지점장 이상만 접근 가능합니다.");
  });
  it("blocks team_leader from assigning customers", async () => {
    await expect(
      appRouter.createCaller(createCtx("team_leader")).customers.assign({ customerId: 1, agentId: 3 })
    ).rejects.toThrow("부지점장 이상만 접근 가능합니다.");
  });
});

// ─── RBAC - assignToSubBranch (branch_admin only) ────────────────────────────
describe("RBAC - customers.assignToSubBranch (branch_admin only)", () => {
  it("blocks sub_branch_admin from assigning to sub branch", async () => {
    await expect(
      appRouter.createCaller(createCtx("sub_branch_admin")).customers.assignToSubBranch({ customerId: 1, subBranchAdminId: 2 })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
  it("blocks team_leader from assigning to sub branch", async () => {
    await expect(
      appRouter.createCaller(createCtx("team_leader")).customers.assignToSubBranch({ customerId: 1, subBranchAdminId: 2 })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
});

// ─── RBAC - logs.list (team_leader or above) ─────────────────────────────────
describe("RBAC - logs.list (team_leader+)", () => {
  it("blocks member from logs.list", async () => {
    await expect(appRouter.createCaller(createCtx("member")).logs.list()).rejects.toThrow();
  });
  it("allows team_leader to access logs.list", async () => {
    await expect(appRouter.createCaller(createCtx("team_leader")).logs.list()).resolves.toBeDefined();
  });
  it("allows sub_branch_admin to access logs.list", async () => {
    await expect(appRouter.createCaller(createCtx("sub_branch_admin")).logs.list()).resolves.toBeDefined();
  });
  it("allows branch_admin to access logs.list", async () => {
    await expect(appRouter.createCaller(createCtx("branch_admin")).logs.list()).resolves.toBeDefined();
  });
});

// ─── RBAC - performance.agentStats (team_leader+) ────────────────────────────
describe("RBAC - performance.agentStats (team_leader+)", () => {
  it("blocks member from agentStats", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).performance.agentStats({ agentId: 3 })
    ).rejects.toThrow("팀장 이상만 접근 가능합니다.");
  });
  it("allows team_leader to access agentStats", async () => {
    await expect(
      appRouter.createCaller(createCtx("team_leader")).performance.agentStats({ agentId: 3 })
    ).resolves.toBeDefined();
  });
});

describe("RBAC - performance.stats", () => {
  it("blocks member from using another agentIdFilter", async () => {
    await expect(
      appRouter.createCaller(createCtx("member", { userId: 4 })).performance.stats({ agentIdFilter: 5 })
    ).rejects.toThrow();
  });
  it("blocks member from using teamIdFilter", async () => {
    await expect(
      appRouter.createCaller(createCtx("member", { userId: 4 })).performance.stats({ teamIdFilter: 10 })
    ).rejects.toThrow();
  });
  it("keeps member without filters scoped to self", async () => {
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).performance.stats()).resolves.toBeDefined();
  });
});

describe("PR16 - branch_admin own scope and assignee handling", () => {
  it("allows branch_admin to list all DB or only own DB", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    const caller = appRouter.createCaller(createCtx("branch_admin", { userId: 1 }));

    await caller.customers.list({ scope: "all" });
    await caller.customers.list({ scope: "mine" });

    expect(getCustomersSpy).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ agentId: 1 }));
    expect(getCustomersSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ agentId: 1 }));
  });

  it("blocks non-branch_admin from requesting all DB scope", async () => {
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customers.list({ scope: "all" })).rejects.toThrow();
  });

  it("allows branch_admin to list all contracts or only own contracts", async () => {
    const getAllContractsSpy = vi.spyOn(db, "getAllContracts").mockResolvedValue([]);
    const caller = appRouter.createCaller(createCtx("branch_admin", { userId: 1 }));

    await caller.contracts.list({ scope: "all" });
    await caller.contracts.list({ scope: "mine" });

    expect(getAllContractsSpy).toHaveBeenNthCalledWith(1, {});
    expect(getAllContractsSpy).toHaveBeenNthCalledWith(2, { agentId: 1 });
  });

  it("blocks non-branch_admin from requesting all contract scope", async () => {
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).contracts.list({ scope: "all" })).rejects.toThrow();
  });

  it("scopes branch_admin performance stats to own agent when requested", async () => {
    const getPerformanceStatsSpy = vi.spyOn(db, "getPerformanceStats").mockResolvedValue({ assigned: 0 } as any);
    const caller = appRouter.createCaller(createCtx("branch_admin", { userId: 1 }));

    await caller.performance.stats({ scope: "all" });
    await caller.performance.stats({ scope: "mine" });

    expect(getPerformanceStatsSpy).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ agentId: 1 }));
    expect(getPerformanceStatsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ agentId: 1 }));
  });

  it("blocks non-branch_admin from requesting all performance scope", async () => {
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).performance.stats({ scope: "all" })).rejects.toThrow();
  });

  it("allows branch_admin to assign a customer to self without team/sub-branch scope", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: null,
      assignedTeamId: 5,
      subBranchAdminId: 20,
      assignmentStatus: "unassigned",
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 1,
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      name: "Branch Admin",
    } as any);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback(tx));
    const assignSpy = vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    const historySpy = vi.spyOn(db, "createAssignmentHistory").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createNotification").mockResolvedValue(undefined);
    vi.spyOn(notifications, "createUncontactedReminder").mockResolvedValue(undefined);
    vi.spyOn(notifications, "createBirthdayReminder").mockResolvedValue(undefined);
    vi.spyOn(notifications, "refreshLongUnmanagedReminder").mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).customers.assign({ customerId: 100, agentId: 1 });

    expect(assignSpy).toHaveBeenCalledWith(100, 1, undefined, undefined, tx);
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      newAgentId: 1,
      newTeamId: undefined,
      newSubBranchAdminId: undefined,
      assignmentType: "branch_to_agent",
    }), tx);
    expect(db.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ action: "CUSTOMER_SELF_ASSIGNED_BY_BRANCH_ADMIN" }), tx);
  });

  it("blocks changing to the same assignee", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: 1,
      assignedTeamId: null,
      subBranchAdminId: null,
      assignmentStatus: "assigned_to_agent",
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 1,
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      name: "Branch Admin",
    } as any);

    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).customers.changeAgent({ customerId: 100, newAgentId: 1 })).rejects.toThrow();
  });
});

describe("RBAC - contract agent target validation", () => {
  function mockContractCustomerAccess() {
    vi.spyOn(db, "getContractById").mockResolvedValue({
      id: 10,
      customerId: 100,
      agentId: 31,
      company: "테스트보험",
      productName: "테스트상품",
      productGroup: "테스트",
      contractDate: new Date("2026-01-01") as any,
      monthlyPremium: 10000,
      paymentStatus: "정상",
      contractStatus: "청약",
      memo: null,
      isActive: true,
      deletedAt: null,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "테스트고객",
      phone: "01000000000",
      birthDate: null,
      gender: null,
      region: null,
      expectedPremium: null,
      availableTime: null,
      source: null,
      agentId: 31,
      assignedTeamId: 10,
      assignedAt: null,
      subBranchAdminId: 21,
      assignmentStatus: "assigned_to_agent",
      consultStatus: "미상담",
      memo: null,
      privacyConsent: false,
      marketingConsent: false,
      isActive: true,
      deletedAt: null,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(db, "getTeamById").mockResolvedValue({ id: 10, name: "A팀", description: null, managerId: 30, subBranchAdminId: 21, isActive: true, deletedAt: null, createdAt: new Date() } as any);
    vi.spyOn(db, "createContractHistoryEntry").mockResolvedValue(undefined);
    vi.spyOn(db, "updateContract").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  }

  it("blocks inactive users as contract owner", async () => {
    mockContractCustomerAccess();
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 31) return { id, role: "member", teamId: 10, subBranchAdminId: 21, accountStatus: "active", name: "기존" } as any;
      return { id, role: "member", teamId: 10, subBranchAdminId: 21, accountStatus: "inactive", name: "비활성" } as any;
    });

    await expect(
      appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).contracts.update({ id: 10, newAgentId: 99 })
    ).rejects.toThrow();
  });

  it("blocks team_leader from assigning another team's user", async () => {
    mockContractCustomerAccess();
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 31) return { id, role: "member", teamId: 10, subBranchAdminId: 21, accountStatus: "active", name: "기존" } as any;
      return { id, role: "member", teamId: 20, subBranchAdminId: 22, accountStatus: "active", name: "타팀" } as any;
    });

    await expect(
      appRouter.createCaller(createCtx("team_leader", { userId: 30, teamId: 10 })).contracts.update({ id: 10, newAgentId: 99 })
    ).rejects.toThrow();
  });
});

describe("RBAC - notifications date filter", () => {
  it("accepts dateFrom/dateTo with existing server-side filters", async () => {
    await expect(
      appRouter.createCaller(createCtx("member", { userId: 4 })).notifications.list({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        processStatus: "미확인",
        isRead: false,
        limit: 10,
        offset: 0,
      })
    ).resolves.toMatchObject({ items: [], totalCount: 0, hasMore: false });
  });
});

describe("customers assignment transaction flow", () => {
  function mockAssignableCustomer() {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: null,
      assignedTeamId: null,
      subBranchAdminId: 20,
      assignmentStatus: "assigned_to_sub_branch",
      birthDate: null,
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20) return { id, role: "sub_branch_admin", accountStatus: "active", teamId: null, subBranchAdminId: null } as any;
      if (id === 24) return { id, role: "member", accountStatus: "active", teamId: 5, subBranchAdminId: 20 } as any;
      if (id === 25) return { id, role: "member", accountStatus: "inactive", teamId: 5, subBranchAdminId: 20 } as any;
      if (id === 26) return { id, role: "member", accountStatus: "active", teamId: 6, subBranchAdminId: 21 } as any;
      return null;
    });
    vi.spyOn(db, "createNotification").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  }

  it("runs customers.assign update/history/log in one transaction", async () => {
    mockAssignableCustomer();
    const tx = { tx: true } as any;
    const transactionSpy = vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback(tx));
    const assignSpy = vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    const historySpy = vi.spyOn(db, "createAssignmentHistory").mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("sub_branch_admin", { userId: 20 })).customers.assign({ customerId: 100, agentId: 24 });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith(100, 24, 5, 20, tx);
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 100,
      newAgentId: 24,
      newTeamId: 5,
      newSubBranchAdminId: 20,
      assignmentType: "sub_branch_to_agent",
    }), tx);
    expect(db.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ASSIGNMENT_HISTORY_CREATED" }), tx);
  });

  it("propagates assignment history failure from transaction", async () => {
    mockAssignableCustomer();
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback({} as any));
    vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    vi.spyOn(db, "createAssignmentHistory").mockRejectedValue(new Error("history failed"));

    await expect(
      appRouter.createCaller(createCtx("sub_branch_admin", { userId: 20 })).customers.assign({ customerId: 100, agentId: 24 })
    ).rejects.toThrow("history failed");
  });

  it("blocks inactive and out-of-scope assignment targets before transaction", async () => {
    mockAssignableCustomer();
    const transactionSpy = vi.spyOn(db, "runDbTransaction");

    await expect(
      appRouter.createCaller(createCtx("sub_branch_admin", { userId: 20 })).customers.assign({ customerId: 100, agentId: 25 })
    ).rejects.toThrow();
    await expect(
      appRouter.createCaller(createCtx("sub_branch_admin", { userId: 20 })).customers.assign({ customerId: 100, agentId: 26 })
    ).rejects.toThrow();

    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it("records sub-branch and reassignment history inside transactions", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback(tx));
    vi.spyOn(db, "assignCustomerToSubBranch").mockResolvedValue(undefined);
    vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    const historySpy = vi.spyOn(db, "createAssignmentHistory").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: 24,
      assignedTeamId: 5,
      subBranchAdminId: 20,
      assignmentStatus: "assigned_to_sub_branch",
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20) return { id, role: "sub_branch_admin", accountStatus: "active", teamId: null, subBranchAdminId: null } as any;
      if (id === 24) return { id, role: "member", accountStatus: "active", teamId: 5, subBranchAdminId: 20 } as any;
      if (id === 27) return { id, role: "member", accountStatus: "active", teamId: 5, subBranchAdminId: 20 } as any;
      return null;
    });

    await appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).customers.changeAgent({ customerId: 100, newAgentId: 27 });

    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      previousAgentId: 24,
      newAgentId: 27,
      previousTeamId: 5,
      newTeamId: 5,
      previousSubBranchAdminId: 20,
      newSubBranchAdminId: 20,
      assignmentType: "reassignment",
    }), tx);
  });
});

// ─── 1단계 치명적 문제 수정 검증 ─────────────────────────────────────────────
describe("consultations.list - 권한 검증", () => {
  it("returns NOT_FOUND for non-existent customerId", async () => {
    const ctx = createCtx("member", { userId: 3 });
    await expect(
      appRouter.createCaller(ctx).consultations.list({ customerId: 999999 })
    ).rejects.toThrow();
  });
});

describe("admin security controls", () => {
  it("allows branch_admin to force logout a user and records an audit log", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      openId: "google-sub",
      name: "[TEST] Member",
      email: "member@test.local",
      loginMethod: "google",
      role: "member",
      accountStatus: "active",
      loginStatus: "linked",
      teamId: 10,
      subBranchAdminId: 2,
      sessionInvalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);
    const invalidateSpy = vi.spyOn(db, "invalidateUserSessions").mockResolvedValue(1);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter.createCaller(createCtx("branch_admin")).adminSecurity.forceLogoutUser({
      userId: 4,
      reason: "[TEST] security review",
    });

    expect(result).toEqual({ success: true, affectedSessionCount: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith(4, expect.any(Date));
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "USER_FORCE_LOGOUT",
      targetType: "user",
      targetId: 4,
    }), undefined);
  });

  it("blocks non-admin users from force logout APIs", async () => {
    await expect(appRouter.createCaller(createCtx("member")).adminSecurity.forceLogoutUser({
      userId: 4,
      reason: "[TEST] no permission",
    })).rejects.toThrow();
    await expect(appRouter.createCaller(createInactiveCtx("branch_admin")).adminSecurity.forceLogoutAll({
      reason: "[TEST] inactive",
      confirmText: "전체로그아웃",
    })).rejects.toThrow();
  });

  it("requires confirm text for full force logout and records affected sessions", async () => {
    const invalidateSpy = vi.spyOn(db, "invalidateAllUserSessions").mockResolvedValue(3);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).adminSecurity.forceLogoutAll({
      reason: "[TEST] missing confirm",
      confirmText: "logout",
    })).rejects.toThrow();

    const result = await appRouter.createCaller(createCtx("branch_admin")).adminSecurity.forceLogoutAll({
      reason: "[TEST] emergency",
      confirmText: "전체로그아웃",
    });

    expect(result).toEqual({ success: true, affectedSessionCount: 3 });
    expect(invalidateSpy).toHaveBeenCalledWith(expect.any(Date));
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "ALL_USERS_FORCE_LOGOUT",
    }), undefined);
  });

  it("resets OAuth link without changing role or account status", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      openId: "google-sub",
      name: "[TEST] Member",
      email: "member@test.local",
      loginMethod: "google",
      role: "member",
      accountStatus: "inactive",
      loginStatus: "linked",
      teamId: 10,
      subBranchAdminId: 2,
      sessionInvalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);
    const resetSpy = vi.spyOn(db, "resetUserOAuthLink").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).adminSecurity.resetOAuthLink({
      userId: 4,
      reason: "[TEST] wrong Google account",
      confirmText: "wrong",
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createCtx("branch_admin")).adminSecurity.resetOAuthLink({
      userId: 4,
      reason: "[TEST] wrong Google account",
      confirmText: "OAuth초기화",
    })).resolves.toEqual({ success: true });

    expect(resetSpy).toHaveBeenCalledWith(4);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "USER_OAUTH_RESET",
      targetType: "user",
      targetId: 4,
    }), undefined);
  });

  it("returns masked login history only to branch_admin", async () => {
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      { id: 1, userId: 1, action: "USER_LOGIN", targetType: "user", targetId: 4, details: "{}", createdAt: new Date() },
      { id: 2, userId: 1, action: "CUSTOMER_CREATED", targetType: "customer", targetId: 100, details: "{}", createdAt: new Date() },
    ] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, name: "[TEST] Admin", email: "admin@test.local", role: "branch_admin", accountStatus: "active", loginStatus: "linked" },
      { id: 4, name: "[TEST] Member", email: "member@test.local", role: "member", accountStatus: "active", loginStatus: "linked" },
    ] as any);

    const result = await appRouter.createCaller(createCtx("branch_admin")).adminSecurity.loginHistory({ limit: 10 });

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("USER_LOGIN");
    expect(result[0].user?.email).not.toBe("member@test.local");
    expect(result[0].user?.email).toContain("***");
    await expect(appRouter.createCaller(createCtx("member")).adminSecurity.loginHistory({ limit: 10 })).rejects.toThrow();
  });
});

describe("admin audit and download reason controls", () => {
  it("allows only branch_admin to access operational audit summary", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active" },
      { id: 2, role: "member", accountStatus: "inactive" },
      { id: 3, role: "member", accountStatus: "resigned" },
    ] as any);
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      { id: 100, isActive: true, createdAt: new Date() },
    ] as any);
    vi.spyOn(db, "getDeletedCustomers").mockResolvedValue([{ id: 101, isActive: false }] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      { id: 10, isActive: true, createdAt: new Date() },
    ] as any);
    vi.spyOn(db, "getDeletedContracts").mockResolvedValue([{ id: 11, isActive: false }] as any);
    vi.spyOn(db, "getAllNotifications").mockResolvedValue([
      { id: 1, isRead: false, processStatus: "미확인" },
    ] as any);
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      { id: 1, userId: 1, action: "DATA_DOWNLOAD", targetType: "customers", targetId: null, details: JSON.stringify({ metadata: { reason: "[TEST] audit", rowCount: 1 } }), createdAt: new Date() },
      { id: 2, userId: 1, action: "LOGIN_BLOCKED", targetType: "user", targetId: 2, details: "{}", createdAt: new Date() },
    ] as any);

    const result = await appRouter.createCaller(createCtx("branch_admin")).adminAudit.summary();

    expect(result.cards.activeUsers).toBe(1);
    expect(result.cards.inactiveUsers).toBe(1);
    expect(result.cards.softDeletedCustomers).toBe(1);
    expect(result.cards.recentDownloads).toBe(1);
    expect(result.recentRiskEvents[0].action).toBe("DATA_DOWNLOAD");
    await expect(appRouter.createCaller(createCtx("member")).adminAudit.summary()).rejects.toThrow();
  });

  it("filters audit logs by action, targetType, risk and pagination", async () => {
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      { id: 1, userId: 1, action: "DATA_DOWNLOAD", targetType: "customers", targetId: null, details: JSON.stringify({ metadata: { reason: "[TEST] export", rowCount: 2 } }), createdAt: new Date() },
      { id: 2, userId: 2, action: "CUSTOMER_CREATED", targetType: "customer", targetId: 100, details: "{}", createdAt: new Date() },
      { id: 3, userId: 1, action: "USER_OAUTH_RESET", targetType: "user", targetId: 4, details: JSON.stringify({ metadata: { reason: "[TEST] reset" } }), createdAt: new Date() },
    ] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, name: "[TEST] Admin", email: "admin@test.local", role: "branch_admin" },
      { id: 2, name: "[TEST] Member", email: "member@test.local", role: "member" },
    ] as any);

    const result = await appRouter.createCaller(createCtx("branch_admin")).adminAudit.logSearch({
      riskOnly: true,
      targetType: "customers",
      limit: 1,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].action).toBe("DATA_DOWNLOAD");
    expect(result.items[0].riskLevel).toBe("high");
    expect(result.items[0].actor?.email).toContain("***");
  });

  it("requires a download reason and records it in DATA_DOWNLOAD metadata", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([{ id: 100, name: "[TEST] Customer" }] as any);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).download.customers({ reason: "" })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("branch_admin")).download.customers({ reason: "짧음" })).rejects.toThrow();

    const data = await appRouter.createCaller(createCtx("branch_admin")).download.customers({ reason: "[TEST] 파일럿 점검" });

    expect(data).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "DATA_DOWNLOAD",
      targetType: "customers",
    }), undefined);
    const details = JSON.parse(String(logSpy.mock.calls[0]?.[0].details));
    expect(details.metadata.reason).toBe("[TEST] 파일럿 점검");
  });

  it("keeps download APIs branch_admin only", async () => {
    await expect(appRouter.createCaller(createCtx("member")).download.customers({ reason: "[TEST] no permission" })).rejects.toThrow();
  });
});

describe("PR9 full role permission QA", () => {
  it("allows branch_admin to access high-risk admin-only surfaces with required audit inputs", async () => {
    vi.spyOn(db, "getDeletedCustomers").mockResolvedValue([]);
    vi.spyOn(db, "listImportBatches").mockResolvedValue([]);
    vi.spyOn(db, "getDeleteRequests").mockResolvedValue([]);
    vi.spyOn(db, "getSettings").mockResolvedValue([]);
    vi.spyOn(db, "getPerformanceStats").mockResolvedValue({ contractCount: 0 } as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([{ id: 1, role: "branch_admin", accountStatus: "active" }] as any);
    vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    vi.spyOn(db, "getDeletedContracts").mockResolvedValue([]);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([]);
    vi.spyOn(db, "getAllNotifications").mockResolvedValue([]);
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([]);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 4, openId: "test-member", loginStatus: "linked", role: "member", accountStatus: "active" } as any);
    vi.spyOn(db, "invalidateUserSessions").mockResolvedValue(1);

    await expect(appRouter.createCaller(createCtx("branch_admin")).deletedData.listCustomers()).resolves.toEqual([]);
    await expect(appRouter.createCaller(createCtx("branch_admin")).imports.listBatches({})).resolves.toEqual([]);
    await expect(appRouter.createCaller(createCtx("branch_admin")).deleteRequests.listAllRequestsForAdmin({})).resolves.toEqual([]);
    await expect(appRouter.createCaller(createCtx("branch_admin")).settings.list({ category: "region" })).resolves.toEqual([]);
    await expect(appRouter.createCaller(createCtx("branch_admin")).adminAudit.summary()).resolves.toBeDefined();
    await expect(appRouter.createCaller(createCtx("branch_admin")).download.performance({ reason: "[TEST] 권한 QA" })).resolves.toBeDefined();
    await expect(appRouter.createCaller(createCtx("branch_admin")).adminSecurity.forceLogoutUser({ userId: 4, reason: "[TEST] 권한 QA" })).resolves.toEqual({ success: true, affectedSessionCount: 1 });
  });

  it("blocks non-admin roles from high-risk admin-only APIs", async () => {
    const roles: Role[] = ["sub_branch_admin", "team_leader", "member"];
    for (const role of roles) {
      const caller = appRouter.createCaller(createCtx(role));
      await expect(caller.deletedData.listCustomers()).rejects.toThrow();
      await expect(caller.deletedData.restoreCustomer({ id: 100 })).rejects.toThrow();
      await expect(caller.deletedData.permanentDeleteCustomer({ id: 100, confirmText: "완전삭제" })).rejects.toThrow();
      await expect(caller.imports.listBatches({})).rejects.toThrow();
      await expect(caller.imports.cancelBatch({ importBatchId: "batch_test", confirmText: "BATCH취소" })).rejects.toThrow();
      await expect(caller.adminAudit.summary()).rejects.toThrow();
      await expect(caller.adminAudit.logSearch({ riskOnly: true })).rejects.toThrow();
      await expect(caller.download.customers({ reason: "[TEST] 권한 QA" })).rejects.toThrow();
      await expect(caller.adminSecurity.loginHistory({ limit: 10 })).rejects.toThrow();
      await expect(caller.adminSecurity.resetOAuthLink({ userId: 4, reason: "[TEST] 권한 QA", confirmText: "OAuth초기화" })).rejects.toThrow();
      await expect(caller.users.updateRole({ userId: 4, role: "member" })).rejects.toThrow();
      await expect(caller.settings.list({ category: "region" })).rejects.toThrow();
    }
  });

  it("blocks inactive and resigned users from protected PR1-PR8 APIs", async () => {
    for (const accountStatus of ["inactive", "resigned"] as const) {
      const caller = appRouter.createCaller(createCtx("branch_admin", { accountStatus }));
      await expect(caller.dashboard.todayWork({ date: "2026-05-13T00:00:00.000Z" })).rejects.toThrow();
      await expect(caller.customers.list({})).rejects.toThrow();
      await expect(caller.contracts.list()).rejects.toThrow();
      await expect(caller.followUps.listToday()).rejects.toThrow();
      await expect(caller.consultations.list({ customerId: 100 })).rejects.toThrow();
      await expect(caller.deleteRequests.listAllRequestsForAdmin({})).rejects.toThrow();
      await expect(caller.deletedData.listCustomers()).rejects.toThrow();
      await expect(caller.imports.listBatches({})).rejects.toThrow();
      await expect(caller.adminAudit.summary()).rejects.toThrow();
      await expect(caller.download.customers({ reason: "[TEST] 권한 QA" })).rejects.toThrow();
    }
  });

  it("keeps customer management metadata, consultations and follow-ups inside role scope", async () => {
    const scopedCustomer = {
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "미상담",
      priority: "unclassified",
      customerTags: "[]",
      nextAction: null,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getCustomerById").mockResolvedValue(scopedCustomer);
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 4, teamId: 10, role: "member", accountStatus: "active" } as any);
    vi.spyOn(db, "updateCustomer").mockResolvedValue(undefined);
    vi.spyOn(db, "createConsultation").mockResolvedValue(undefined);
    vi.spyOn(db, "createFollowUp").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "getConsultationsByCustomer").mockResolvedValue([]);

    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).customers.updateManagementMeta({ customerId: 100, priority: "A" })).resolves.toEqual({ success: true });
    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).consultations.create({ customerId: 100, status: "상담예정", summary: "[TEST] summary" })).resolves.toEqual({ success: true });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.create({ customerId: 100, nextContactDate: "2026-05-14T10:00:00.000Z", reason: "[TEST] follow", nextAction: "전화" })).resolves.toEqual({ success: true });

    vi.restoreAllMocks();
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...scopedCustomer, agentId: 99, assignedTeamId: 99, subBranchAdminId: 99 });
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 99, teamId: 99, role: "member", accountStatus: "active" } as any);
    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).customers.updateManagementMeta({ customerId: 100, priority: "A" })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).consultations.list({ customerId: 100 })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.listByCustomer({ customerId: 100 })).rejects.toThrow();
  });

  it("keeps delete request scope limited to subordinate, team, and own contracts", async () => {
    const contract = { id: 10, customerId: 100, agentId: 4, isActive: true, deletedAt: null } as any;
    const customer = {
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getContractById").mockResolvedValue(contract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(customer);
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 4, teamId: 10, role: "member", accountStatus: "active" } as any);
    vi.spyOn(db, "getPendingDeleteRequestForTarget").mockResolvedValue(undefined);
    vi.spyOn(db, "createDeleteRequest").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).deleteRequests.createContractDeleteRequest({ contractId: 10, requestReason: "오입력" })).resolves.toEqual({ success: true });
    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).deleteRequests.createContractDeleteRequest({ contractId: 10, requestReason: "오입력" })).resolves.toEqual({ success: true });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).deleteRequests.createContractDeleteRequest({ contractId: 10, requestReason: "오입력" })).resolves.toEqual({ success: true });

    vi.restoreAllMocks();
    vi.spyOn(db, "getContractById").mockResolvedValue(contract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...customer, agentId: 99, assignedTeamId: 99, subBranchAdminId: 99 });
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 99, teamId: 99, role: "member", accountStatus: "active" } as any);
    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).deleteRequests.createContractDeleteRequest({ contractId: 10, requestReason: "오입력" })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).deleteRequests.createContractDeleteRequest({ contractId: 10, requestReason: "오입력" })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).deleteRequests.createContractDeleteRequest({ contractId: 10, requestReason: "오입력" })).rejects.toThrow();
  });
});

describe("Customer History Timeline", () => {
  const scopedCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    isActive: true,
    deletedAt: null,
  } as any;
  const timelineResult = {
    totalCount: 3,
    items: [
      {
        id: "consultation:1",
        eventType: "consultation_created",
        eventLabel: "상담기록이 추가되었습니다.",
        occurredAt: new Date("2026-05-13T09:00:00.000Z"),
        actorName: "[TEST] member",
        actorRole: "member",
        source: "consultations",
        summary: "[TEST] 상담 요약",
        detail: "[TEST] 필요한 최소 요약",
        metadata: { consultationType: "전화" },
        severity: "info",
        relatedId: 1,
        relatedType: "consultation",
      },
    ],
  };

  it("allows each active role to read only an accessible customer timeline", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(scopedCustomer);
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 4, teamId: 10, role: "member", accountStatus: "active" } as any);
    const timelineSpy = vi.spyOn(db, "getCustomerTimeline").mockResolvedValue(timelineResult);

    await expect(appRouter.createCaller(createCtx("branch_admin")).customers.timeline({ customerId: 100, limit: 50 })).resolves.toEqual(timelineResult);
    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).customers.timeline({ customerId: 100, eventTypes: ["consultations"] })).resolves.toEqual(timelineResult);
    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).customers.timeline({ customerId: 100, dateFrom: "2026-05-01T00:00:00.000Z" })).resolves.toEqual(timelineResult);
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customers.timeline({ customerId: 100 })).resolves.toEqual(timelineResult);
    expect(timelineSpy).toHaveBeenCalledWith(100, expect.objectContaining({ limit: 50 }));
    expect(JSON.stringify(timelineResult)).not.toContain("010-");
    expect(JSON.stringify(timelineResult)).not.toContain("secret");
  });

  it("blocks timeline access outside role scope and for inactive users", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...scopedCustomer, agentId: 99, assignedTeamId: 99, subBranchAdminId: 99 });
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 99, teamId: 99, role: "member", accountStatus: "active" } as any);
    const timelineSpy = vi.spyOn(db, "getCustomerTimeline").mockResolvedValue(timelineResult);

    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).customers.timeline({ customerId: 100 })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).customers.timeline({ customerId: 100 })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customers.timeline({ customerId: 100 })).rejects.toThrow();
    await expect(appRouter.createCaller(createInactiveCtx()).customers.timeline({ customerId: 100 })).rejects.toThrow();
    expect(timelineSpy).not.toHaveBeenCalled();
  });

  it("validates timeline date filters before querying events", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(scopedCustomer);
    const timelineSpy = vi.spyOn(db, "getCustomerTimeline").mockResolvedValue(timelineResult);

    await expect(appRouter.createCaller(createCtx("branch_admin")).customers.timeline({ customerId: 100, dateFrom: "not-a-date" })).rejects.toThrow();
    expect(timelineSpy).not.toHaveBeenCalled();
  });
});

describe("PR10-2 customer merge workflow", () => {
  const mergePreview = {
    targetCustomer: { id: 100, name: "[TEST] Target", maskedPhone: "010-****-5678", isActive: true },
    sourceCustomer: { id: 101, name: "[TEST] Source", maskedPhone: "010-****-5678", isActive: true },
    transferCounts: {
      consultations: 2,
      contracts: 1,
      followUps: 1,
      notifications: 1,
      reminders: 0,
      deleteRequests: 0,
      statusHistory: 1,
      consentLogs: 1,
      assignmentHistory: 1,
    },
    conflicts: ["name"],
    mergePolicy: "target_first",
    blockers: {
      sameCustomer: false,
      inactiveTarget: false,
      inactiveSource: false,
      alreadyMerged: false,
      pendingDeleteRequests: false,
    },
  } as any;

  it("allows only branch_admin to find duplicate customers and normalizes phone strings", async () => {
    const groups = [{ normalizedPhone: "01012345678", maskedPhone: "010-****-5678", candidates: [] }];
    vi.spyOn(db, "findDuplicateCustomerGroups").mockResolvedValue(groups as any);

    await expect(appRouter.createCaller(createCtx("branch_admin")).customerMerge.findDuplicates({ phone: "010-1234-5678" })).resolves.toEqual(groups);
    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).customerMerge.findDuplicates({})).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).customerMerge.findDuplicates({})).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customerMerge.findDuplicates({})).rejects.toThrow();
    await expect(appRouter.createCaller(createInactiveCtx("branch_admin")).customerMerge.findDuplicates({})).rejects.toThrow();
    expect(db.normalizePhone("010 1234 5678")).toBe("01012345678");
  });

  it("returns merge preview only for valid active customer pairs", async () => {
    vi.spyOn(db, "getCustomerMergePreview").mockResolvedValue(mergePreview);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).customerMerge.preview({ targetCustomerId: 100, sourceCustomerId: 101 })).resolves.toMatchObject({
      transferCounts: expect.objectContaining({ consultations: 2, contracts: 1 }),
    });
    await expect(appRouter.createCaller(createCtx("branch_admin")).customerMerge.preview({ targetCustomerId: 100, sourceCustomerId: 100 })).rejects.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(db, "getCustomerMergePreview").mockResolvedValue({ ...mergePreview, blockers: { ...mergePreview.blockers, pendingDeleteRequests: true } });
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    await expect(appRouter.createCaller(createCtx("branch_admin")).customerMerge.preview({ targetCustomerId: 100, sourceCustomerId: 101 })).rejects.toThrow();
  });

  it("executes customer merge with confirm text and records transactional helper call", async () => {
    vi.spyOn(db, "getCustomerMergePreview").mockResolvedValue(mergePreview);
    const mergeSpy = vi.spyOn(db, "mergeCustomers").mockResolvedValue({ success: true, targetCustomerId: 100, sourceCustomerId: 101, affectedCounts: mergePreview.transferCounts });

    await expect(appRouter.createCaller(createCtx("branch_admin")).customerMerge.execute({
      targetCustomerId: 100,
      sourceCustomerId: 101,
      confirmText: "고객병합",
      reason: "[TEST] 중복 고객 정리",
    })).resolves.toMatchObject({ success: true, targetCustomerId: 100, sourceCustomerId: 101 });
    expect(mergeSpy).toHaveBeenCalledWith(expect.objectContaining({
      targetCustomerId: 100,
      sourceCustomerId: 101,
      actorId: 1,
    }));
    await expect(appRouter.createCaller(createCtx("branch_admin")).customerMerge.execute({
      targetCustomerId: 100,
      sourceCustomerId: 101,
      confirmText: "삭제",
      reason: "[TEST] 중복 고객 정리",
    })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customerMerge.execute({
      targetCustomerId: 100,
      sourceCustomerId: 101,
      confirmText: "고객병합",
      reason: "[TEST] 중복 고객 정리",
    })).rejects.toThrow();
  });
});

describe("PR10-3 user handoff workflow", () => {
  const sourceUser = {
    id: 20,
    name: "Source Member",
    email: "source@example.test",
    role: "member",
    accountStatus: "active",
    teamId: 10,
    subBranchAdminId: 2,
    openId: "source-open",
    loginStatus: "linked",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as any;
  const targetUser = {
    id: 30,
    name: "Target Member",
    email: "target@example.test",
    role: "member",
    accountStatus: "active",
    teamId: 11,
    subBranchAdminId: 3,
    openId: "target-open",
    loginStatus: "linked",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as any;

  it("allows only branch_admin to preview user handoff", async () => {
    vi.spyOn(db, "getHandoffPreview").mockResolvedValue({
      sourceUser,
      counts: {
        activeCustomers: 2,
        softDeletedCustomers: 1,
        activeContracts: 1,
        pendingFollowUps: 1,
        pendingSchedules: 1,
        pendingNotifications: 1,
        consultations: 3,
        recentActivityLogs: 4,
      },
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).adminHandoff.preview({ sourceUserId: 20 })).resolves.toMatchObject({
      counts: { activeCustomers: 2 },
    });
    await expect(appRouter.createCaller(createCtx("member")).adminHandoff.preview({ sourceUserId: 20 })).rejects.toThrow();
    await expect(appRouter.createCaller(createInactiveCtx("branch_admin")).adminHandoff.preview({ sourceUserId: 20 })).rejects.toThrow();
  });

  it("blocks invalid handoff execution requests", async () => {
    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).adminHandoff.execute({
      sourceUserId: 20,
      targetUserId: 30,
      transferCustomers: true,
      transferFollowUps: true,
      transferSchedules: true,
      transferNotifications: true,
      updateSourceAccountStatus: "inactive",
      forceLogoutSource: true,
      resetOAuthSource: false,
      reason: "퇴사 처리",
      confirmText: "wrong",
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 20 })).adminHandoff.execute({
      sourceUserId: 20,
      targetUserId: 30,
      transferCustomers: true,
      transferFollowUps: true,
      transferSchedules: true,
      transferNotifications: true,
      updateSourceAccountStatus: "inactive",
      forceLogoutSource: true,
      resetOAuthSource: false,
      reason: "퇴사 처리",
      confirmText: "인수인계",
    })).rejects.toThrow();
  });

  it("executes handoff only to active team_leader/member targets", async () => {
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20) return sourceUser;
      if (id === 30) return targetUser;
      return undefined;
    });
    const executeSpy = vi.spyOn(db, "executeUserHandoff").mockResolvedValue({
      success: true,
      sourceUserId: 20,
      targetUserId: 30,
      counts: { customers: 2, contracts: 1, followUps: 1, schedules: 1, notifications: 1 },
      sourceAccountStatusBefore: "active",
      sourceAccountStatusAfter: "resigned",
    } as any);

    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).adminHandoff.execute({
      sourceUserId: 20,
      targetUserId: 30,
      transferCustomers: true,
      transferFollowUps: true,
      transferSchedules: true,
      transferNotifications: true,
      updateSourceAccountStatus: "resigned",
      forceLogoutSource: true,
      resetOAuthSource: true,
      reason: "퇴사로 인한 고객 이관",
      confirmText: "인수인계",
    })).resolves.toMatchObject({ success: true, sourceUserId: 20, targetUserId: 30 });

    expect(executeSpy).toHaveBeenCalledWith(expect.objectContaining({
      sourceUserId: 20,
      targetUserId: 30,
      executedBy: 1,
      updateSourceAccountStatus: "resigned",
      forceLogoutSource: true,
      resetOAuthSource: true,
    }));
  });

  it("blocks handoff to inactive or administrative target users", async () => {
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20) return sourceUser;
      if (id === 31) return { ...targetUser, id: 31, accountStatus: "inactive" };
      if (id === 32) return { ...targetUser, id: 32, role: "branch_admin", teamId: null, subBranchAdminId: null };
      return undefined;
    });
    const payload = {
      sourceUserId: 20,
      transferCustomers: true,
      transferFollowUps: true,
      transferSchedules: true,
      transferNotifications: true,
      updateSourceAccountStatus: "inactive" as const,
      forceLogoutSource: true,
      resetOAuthSource: false,
      reason: "비활성 처리",
      confirmText: "인수인계",
    };

    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).adminHandoff.execute({ ...payload, targetUserId: 31 })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).adminHandoff.execute({ ...payload, targetUserId: 32 })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("team_leader")).adminHandoff.execute({ ...payload, targetUserId: 31 })).rejects.toThrow();
  });

  it("allows branch_admin to view handoff history and blocks non-admin", async () => {
    vi.spyOn(db, "getHandoffHistories").mockResolvedValue([{ id: 1, sourceUserId: 20, targetUserId: 30 }] as any);
    await expect(appRouter.createCaller(createCtx("branch_admin")).adminHandoff.history({ limit: 10 })).resolves.toHaveLength(1);
    await expect(appRouter.createCaller(createCtx("member")).adminHandoff.history({ limit: 10 })).rejects.toThrow();
  });
});

describe("PR10-4 performance goals", () => {
  const goal = {
    id: 501,
    year: 2026,
    month: 5,
    targetType: "user",
    targetId: 4,
    contractCountGoal: 10,
    monthlyPremiumGoal: 3000000,
    consultationGoal: 0,
    followUpGoal: 0,
    createdBy: 1,
    updatedBy: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  it("allows branch_admin to create a goal and records an activity log", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 4, role: "member", accountStatus: "active", teamId: 10 } as any);
    vi.spyOn(db, "getActivePerformanceGoal").mockResolvedValue(null);
    vi.spyOn(db, "createPerformanceGoal").mockResolvedValue(goal);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).performanceGoals.create({
      year: 2026,
      month: 5,
      targetType: "user",
      targetId: 4,
      contractCountGoal: 10,
      monthlyPremiumGoal: 3000000,
    });

    expect(result).toEqual(goal);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "PERFORMANCE_GOAL_CREATED", targetType: "performance_goal", targetId: 501 }), undefined);
  });

  it("blocks non-admin create, duplicate active goals, and negative values", async () => {
    await expect(appRouter.createCaller(createCtx("member")).performanceGoals.create({
      year: 2026,
      month: 5,
      targetType: "user",
      targetId: 4,
      contractCountGoal: 10,
      monthlyPremiumGoal: 3000000,
    })).rejects.toThrow();

    vi.spyOn(db, "getActivePerformanceGoal").mockResolvedValue(goal);
    await expect(appRouter.createCaller(createCtx("branch_admin")).performanceGoals.create({
      year: 2026,
      month: 5,
      targetType: "branch",
      targetId: null,
      contractCountGoal: 10,
      monthlyPremiumGoal: 3000000,
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createCtx("branch_admin")).performanceGoals.create({
      year: 2026,
      month: 5,
      targetType: "branch",
      targetId: null,
      contractCountGoal: -1,
      monthlyPremiumGoal: 3000000,
    })).rejects.toThrow();
  });

  it("updates and soft-deactivates goals with audit logs", async () => {
    vi.spyOn(db, "getPerformanceGoalById").mockResolvedValue(goal);
    const updateSpy = vi.spyOn(db, "updatePerformanceGoal").mockResolvedValue(goal);
    const deactivateSpy = vi.spyOn(db, "deactivatePerformanceGoal").mockResolvedValue({ ...goal, isActive: false, deletedAt: new Date() });
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).performanceGoals.update({
      id: 501,
      contractCountGoal: 12,
      monthlyPremiumGoal: 3500000,
    })).resolves.toEqual({ success: true });
    expect(updateSpy).toHaveBeenCalledWith(501, expect.objectContaining({ contractCountGoal: 12, updatedBy: 1 }));

    await expect(appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).performanceGoals.deactivate({ id: 501 })).resolves.toEqual({ success: true });
    expect(deactivateSpy).toHaveBeenCalledWith(501, 1);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "PERFORMANCE_GOAL_UPDATED" }), undefined);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "PERFORMANCE_GOAL_DEACTIVATED" }), undefined);
  });

  it("returns role-scoped dashboard data and blocks inactive users", async () => {
    const dashboard = {
      year: 2026,
      month: 5,
      items: [{ goal, targetLabel: "Test Member", actual: { contractCount: 3, monthlyPremium: 900000 }, achievementRate: { contractCount: 30, monthlyPremium: 30 }, remaining: { contractCount: 7, monthlyPremium: 2100000 }, remainingDays: 10, dailyRequired: { contractCount: 0.7, monthlyPremium: 210000 } }],
      summary: { totalGoals: 1, achievedGoals: 0, pendingGoals: 1, averageContractRate: 30, averagePremiumRate: 30 },
    };
    const dashboardSpy = vi.spyOn(db, "getPerformanceGoalDashboard").mockResolvedValue(dashboard as any);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).performanceGoals.dashboard({ year: 2026, month: 5 })).resolves.toEqual(dashboard);
    expect(dashboardSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 4, role: "member" }), 2026, 5);
    await expect(appRouter.createCaller(createInactiveCtx()).performanceGoals.dashboard({ year: 2026, month: 5 })).rejects.toThrow();
  });
});

describe("PR11 consultation tools", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "미상담",
    isActive: true,
    deletedAt: null,
  } as any;

  it("allows only branch_admin to manage checklist templates", async () => {
    const created = { id: 701, title: "고객 기본정보 확인", phase: "before", category: "basic", sortOrder: 1, isRequired: true, isActive: true } as any;
    vi.spyOn(db, "createConsultationChecklistTemplate").mockResolvedValue(created);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationTools.createChecklist({
      title: "고객 기본정보 확인",
      phase: "before",
      category: "basic",
      sortOrder: 1,
      isRequired: true,
    })).resolves.toEqual(created);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "CONSULTATION_CHECKLIST_TEMPLATE_CREATED", targetId: 701 }), undefined);

    await expect(appRouter.createCaller(createCtx("member")).consultationTools.createChecklist({
      title: "차단",
      phase: "before",
      category: "basic",
      sortOrder: 1,
      isRequired: false,
    })).rejects.toThrow();
    await expect(appRouter.createCaller(createInactiveCtx("branch_admin")).consultationTools.createChecklist({
      title: "차단",
      phase: "before",
      category: "basic",
      sortOrder: 1,
      isRequired: false,
    })).rejects.toThrow();
  });

  it("stores checklist result only inside customer access scope", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getConsultationChecklistTemplateById").mockResolvedValue({ id: 701, isActive: true, deletedAt: null } as any);
    vi.spyOn(db, "upsertConsultationCheckResult").mockResolvedValue({ id: 801, customerId: 100, checklistId: 701, checked: true } as any);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).consultationTools.updateCheckResult({
      customerId: 100,
      checklistId: 701,
      checked: true,
      memo: "[TEST] checked",
    })).resolves.toMatchObject({ id: 801, checked: true });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "CONSULTATION_CHECKLIST_RESULT_UPDATED", targetType: "customer", targetId: 100 }), undefined);

    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, agentId: 99 });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).consultationTools.updateCheckResult({
      customerId: 100,
      checklistId: 701,
      checked: true,
    })).rejects.toThrow();
  });

  it("seeds default message templates without duplicate rows", async () => {
    vi.spyOn(db, "ensureDefaultMessageTemplates").mockResolvedValue({ createdCount: 10, reactivatedCount: 0 });
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationTools.seedDefaultMessageTemplates()).resolves.toEqual({ createdCount: 10, reactivatedCount: 0 });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "MESSAGE_TEMPLATE_DEFAULTS_SEEDED" }), undefined);
    await expect(appRouter.createCaller(createCtx("member")).consultationTools.seedDefaultMessageTemplates()).rejects.toThrow();
  });

  it("seeds default consultation checklists without duplicate rows", async () => {
    vi.spyOn(db, "ensureDefaultConsultationChecklists").mockResolvedValue({ createdCount: 14, reactivatedCount: 0 });
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationTools.seedDefaultChecklists()).resolves.toEqual({ createdCount: 14, reactivatedCount: 0 });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "CONSULTATION_CHECKLIST_DEFAULTS_SEEDED" }), undefined);
    await expect(appRouter.createCaller(createCtx("member")).consultationTools.seedDefaultChecklists()).rejects.toThrow();
  });

  it("manages message templates with compliance guards", async () => {
    vi.spyOn(db, "createMessageTemplate").mockResolvedValue({ id: 901, title: "부재 후 재연락", situation: "missed_call", channel: "both", body: "안녕하세요 {고객명}님", isActive: true } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationTools.createMessageTemplate({
      title: "부재 후 재연락",
      situation: "missed_call",
      channel: "both",
      body: "안녕하세요 {고객명}님. {담당자명}입니다.",
    })).resolves.toMatchObject({ id: 901 });

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationTools.createMessageTemplate({
      title: "금지 문구",
      situation: "missed_call",
      channel: "both",
      body: "지금 가입해야 합니다.",
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationTools.createMessageTemplate({
      title: "잘못된 placeholder",
      situation: "missed_call",
      channel: "both",
      body: "{연락처}로 연락주세요.",
    })).rejects.toThrow();
  });

  it("renders and logs message copy without storing full body in activity log", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getMessageTemplateById").mockResolvedValue({
      id: 901,
      title: "부재 후 재연락",
      situation: "missed_call",
      channel: "both",
      body: "{고객명}님, 안녕하세요. {담당자명}입니다. {상담주제}",
      isActive: true,
      deletedAt: null,
    } as any);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const rendered = await appRouter.createCaller(createCtx("member", { userId: 4 })).consultationTools.renderMessageTemplate({
      templateId: 901,
      customerId: 100,
      consultationTopic: "보장 점검",
    });
    expect(rendered.body).toContain("[TEST] Customer");
    expect(rendered.body).toContain("보장 점검");

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).consultationTools.logMessageCopy({
      templateId: 901,
      customerId: 100,
      channel: "both",
    })).resolves.toEqual({ success: true });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "MESSAGE_TEMPLATE_COPIED",
      details: expect.not.stringContaining("안녕하세요"),
    }), undefined);
  });
});

describe("PR13 customer handoff notes and consultation scripts", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "미상담",
    isActive: true,
    deletedAt: null,
  } as any;

  it("allows scoped users to create customer handoff notes without logging full body", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "createCustomerHandoffNote").mockResolvedValue({
      id: 601,
      customerId: 100,
      noteType: "approach",
      title: "Recommended approach",
      body: "Keep the tone calm and avoid pressure.",
      isActive: true,
    } as any);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customerHandoffNotes.create({
      customerId: 100,
      noteType: "approach",
      title: "Recommended approach",
      body: "Keep the tone calm and avoid pressure.",
    })).resolves.toMatchObject({ id: 601, customerId: 100 });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "CUSTOMER_HANDOFF_NOTE_CREATED",
      targetType: "customer",
      targetId: 100,
      details: expect.not.stringContaining("Keep the tone calm"),
    }), undefined);

    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, agentId: 99 });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customerHandoffNotes.create({
      customerId: 100,
      noteType: "caution",
      title: "Blocked",
      body: "Out of scope",
    })).rejects.toThrow();
  });

  it("blocks handoff notes for inactive customers and inactive accounts", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, isActive: false, deletedAt: new Date() });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customerHandoffNotes.create({
      customerId: 100,
      noteType: "handoff",
      title: "Inactive customer",
      body: "Do not store.",
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createInactiveCtx()).customerHandoffNotes.listByCustomer({ customerId: 100 })).rejects.toThrow();
  });

  it("keeps consultation script management branch_admin only with compliance guards", async () => {
    vi.spyOn(db, "createConsultationScript").mockResolvedValue({
      id: 701,
      title: "First call",
      category: "first_call",
      scriptBody: "Confirm the current needs and keep the explanation balanced.",
      isActive: true,
    } as any);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationScripts.create({
      title: "First call",
      category: "first_call",
      scriptBody: "Confirm the current needs and keep the explanation balanced.",
    })).resolves.toMatchObject({ id: 701 });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "CONSULTATION_SCRIPT_CREATED",
      details: expect.not.stringContaining("Confirm the current needs"),
    }), undefined);

    await expect(appRouter.createCaller(createCtx("member")).consultationScripts.create({
      title: "Blocked",
      category: "first_call",
      scriptBody: "Confirm the current needs.",
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationScripts.create({
      title: "Banned",
      category: "first_call",
      scriptBody: "지금 가입해야 합니다.",
    })).rejects.toThrow();
  });

  it("seeds default consultation scripts without duplicate rows", async () => {
    vi.spyOn(db, "ensureDefaultConsultationScripts").mockResolvedValue({ createdCount: 10 });
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).consultationScripts.seedDefaults()).resolves.toEqual({ createdCount: 10 });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "CONSULTATION_SCRIPT_DEFAULTS_SEEDED" }), undefined);
    await expect(appRouter.createCaller(createCtx("member")).consultationScripts.seedDefaults()).rejects.toThrow();
  });

  it("renders and logs consultation script copy only inside customer access scope", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getConsultationScriptById").mockResolvedValue({
      id: 701,
      title: "General check",
      category: "general_check",
      scriptBody: "Review the current coverage 기준 calmly.",
      isActive: true,
      deletedAt: null,
    } as any);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const script = await appRouter.createCaller(createCtx("member", { userId: 4 })).consultationScripts.render({
      scriptId: 701,
      customerId: 100,
    });
    expect(script.title).toBe("General check");

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).consultationScripts.logCopy({
      scriptId: 701,
      customerId: 100,
    })).resolves.toEqual({ success: true });
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "CONSULTATION_SCRIPT_COPIED",
      targetType: "customer",
      targetId: 100,
      details: expect.not.stringContaining("Review the current coverage"),
    }), undefined);

    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, agentId: 99 });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).consultationScripts.logCopy({
      scriptId: 701,
      customerId: 100,
    })).rejects.toThrow();
  });
});

describe("consultation UX metadata and customer management meta", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] 고객",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "미상담",
    priority: "unclassified",
    customerTags: null,
    nextAction: null,
    isActive: true,
    deletedAt: null,
  } as any;

  it("allows member to create structured consultation for own customer without logging detailed memo", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const createSpy = vi.spyOn(db, "createConsultation").mockResolvedValue(undefined);
    const updateCustomerSpy = vi.spyOn(db, "updateCustomer").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).consultations.create({
      customerId: 100,
      status: "미상담",
      consultationType: "전화",
      customerNeed: "보험료 부담",
      nextAction: "재연락",
      summary: "[TEST] 보험료 재상담",
      content: "[TEST] 상세 상담 메모",
    })).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 100,
      agentId: 4,
      consultationType: "전화",
      customerNeed: "보험료 부담",
      nextAction: "재연락",
      summary: "[TEST] 보험료 재상담",
      content: "[TEST] 상세 상담 메모",
    }));
    expect(updateCustomerSpy).toHaveBeenCalledWith(100, { nextAction: "재연락" });
    const consultationLog = logSpy.mock.calls.find((call) => call[0]?.action === "CONSULTATION_CREATED")?.[0];
    expect(consultationLog?.details).toContain("[TEST] 보험료 재상담");
    expect(consultationLog?.details).not.toContain("[TEST] 상세 상담 메모");
  });

  it("blocks member from creating consultation for another member customer", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, agentId: 5 });
    const createSpy = vi.spyOn(db, "createConsultation").mockResolvedValue(undefined);
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).consultations.create({
      customerId: 100,
      status: "미상담",
      consultationType: "전화",
      customerNeed: "기타",
      nextAction: "재연락",
    })).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("updates priority, tags, and nextAction with audit logs", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const updateSpy = vi.spyOn(db, "updateCustomer").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customers.updateManagementMeta({
      customerId: 100,
      priority: "A",
      customerTags: ["가격민감형", "장기관리"],
      nextAction: "설계안 발송",
    })).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(100, expect.objectContaining({
      priority: "A",
      customerTags: JSON.stringify(["가격민감형", "장기관리"]),
      nextAction: "설계안 발송",
    }));
    expect(logSpy.mock.calls.map((call) => call[0]?.action)).toEqual(expect.arrayContaining([
      "CUSTOMER_PRIORITY_UPDATED",
      "CUSTOMER_TAGS_UPDATED",
      "CUSTOMER_NEXT_ACTION_UPDATED",
    ]));
  });

  it("rejects invalid priority values", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).customers.updateManagementMeta({
      customerId: 100,
      priority: "VIP" as any,
    })).rejects.toThrow();
  });
});

describe("contracts.listByCustomer - 권한 검증", () => {
  it("returns NOT_FOUND for non-existent customerId", async () => {
    const ctx = createCtx("member", { userId: 3 });
    await expect(
      appRouter.createCaller(ctx).contracts.listByCustomer({ customerId: 999999 })
    ).rejects.toThrow();
  });
});
describe("soft delete permissions and audit flow", () => {
  it("allows branch_admin to deactivate an empty active team", async () => {
    vi.spyOn(db, "getTeamById").mockResolvedValue({ id: 77, name: "[TEST] Empty team", isActive: true, deletedAt: null } as any);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([]);
    vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    vi.spyOn(db, "getSchedules").mockResolvedValue([]);
    const deactivateSpy = vi.spyOn(db, "deactivateTeam").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).users.deactivateTeam({ id: 77 })).resolves.toEqual({ success: true });
    expect(deactivateSpy).toHaveBeenCalledWith(77);
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "TEAM_DEACTIVATED", targetType: "team", targetId: 77 }));
  });

  it("blocks non-branch admins and teams with active members from team deletion", async () => {
    await expect(appRouter.createCaller(createCtx("sub_branch_admin")).users.deactivateTeam({ id: 77 })).rejects.toThrow();

    vi.spyOn(db, "getTeamById").mockResolvedValue({ id: 77, name: "[TEST] Used team", isActive: true, deletedAt: null } as any);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([{ id: 10, accountStatus: "active" }] as any);
    const deactivateSpy = vi.spyOn(db, "deactivateTeam").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).users.deactivateTeam({ id: 77 })).rejects.toThrow();
    expect(deactivateSpy).not.toHaveBeenCalled();
  });

  it("allows branch_admin to soft delete a customer without active contracts", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "getContractsByCustomer").mockResolvedValue([]);
    const softDeleteSpy = vi.spyOn(db, "softDeleteCustomer").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).customers.deactivate({ id: 100 })).resolves.toEqual({ success: true });
    expect(softDeleteSpy).toHaveBeenCalledWith(100);
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "CUSTOMER_DEACTIVATED", targetType: "customer", targetId: 100 }));
  });

  it("blocks customer deletion for team_leader/member and when active contracts remain", async () => {
    await expect(appRouter.createCaller(createCtx("team_leader")).customers.deactivate({ id: 100 })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("member")).customers.deactivate({ id: 100 })).rejects.toThrow();

    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "getContractsByCustomer").mockResolvedValue([{ id: 10, isActive: true }] as any);
    const softDeleteSpy = vi.spyOn(db, "softDeleteCustomer").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).customers.deactivate({ id: 100 })).rejects.toThrow();
    expect(softDeleteSpy).not.toHaveBeenCalled();
  });

  it("allows branch_admin to soft delete a contract and records history plus audit log", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue({
      id: 10,
      customerId: 100,
      agentId: 4,
      isActive: true,
      deletedAt: null,
      contractStatus: "유지",
    } as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      agentId: 4,
      subBranchAdminId: 2,
      isActive: true,
    } as any);
    const historySpy = vi.spyOn(db, "createContractHistoryEntry").mockResolvedValue(undefined);
    const deactivateSpy = vi.spyOn(db, "deactivateContract").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).contracts.deactivate({ id: 10 })).resolves.toEqual({ success: true });
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({ contractId: 10, fieldName: "isActive", afterValue: "false" }));
    expect(deactivateSpy).toHaveBeenCalledWith(10);
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "CONTRACT_DEACTIVATED", targetType: "contract", targetId: 10 }));
  });

  it("blocks contract deletion for team_leader/member and out-of-scope sub_branch_admin", async () => {
    await expect(appRouter.createCaller(createCtx("team_leader")).contracts.deactivate({ id: 10 })).rejects.toThrow();
    await expect(appRouter.createCaller(createCtx("member")).contracts.deactivate({ id: 10 })).rejects.toThrow();

    vi.spyOn(db, "getContractById").mockResolvedValue({ id: 10, customerId: 100, agentId: 4, isActive: true } as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ id: 100, agentId: 4, subBranchAdminId: 99, isActive: true } as any);
    const deactivateSpy = vi.spyOn(db, "deactivateContract").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).contracts.deactivate({ id: 10 })).rejects.toThrow();
    expect(deactivateSpy).not.toHaveBeenCalled();
  });
});

describe("dashboard.todayWork", () => {
  const baseDate = "2026-05-13T09:00:00.000Z";
  const todaySchedule = {
    id: 1,
    userId: 4,
    teamId: 10,
    title: "[TEST] Today call",
    type: "고객상담",
    status: "예정",
    startTime: new Date("2026-05-13T10:00:00.000Z"),
    endTime: new Date("2026-05-13T10:30:00.000Z"),
    isActive: true,
  };
  const overdueSchedule = {
    id: 2,
    userId: 4,
    teamId: 10,
    title: "[TEST] Overdue",
    type: "고객상담",
    status: "예정",
    startTime: new Date("2026-05-12T10:00:00.000Z"),
    endTime: new Date("2026-05-12T10:30:00.000Z"),
    isActive: true,
  };
  const customer = {
    id: 100,
    name: "[TEST] Customer",
    phone: "01012345678",
    memo: "private memo",
    agentId: 4,
    teamId: 10,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "상담예정",
    isActive: true,
  };

  function mockTodayWorkData() {
    vi.spyOn(db, "getCustomers").mockResolvedValue([customer] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      { id: 10, customerId: 100, agentId: 4, contractDate: new Date("2026-05-03T00:00:00.000Z"), monthlyPremium: 120000, isActive: true },
      { id: 11, customerId: 100, agentId: 4, contractDate: new Date("2026-04-03T00:00:00.000Z"), monthlyPremium: 90000, isActive: true },
      { id: 12, customerId: 100, agentId: 4, contractDate: new Date("2026-05-04T00:00:00.000Z"), monthlyPremium: 30000, isActive: false },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([todaySchedule, overdueSchedule] as any);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [
        { id: 20, userId: 4, type: "general", title: "[TEST] Notice", isRead: false, processStatus: "미확인", relatedType: "customer", relatedId: 100, createdAt: new Date("2026-05-13T08:00:00.000Z") },
        { id: 21, userId: 4, type: "long_unmanaged_90", title: "[TEST] Long", isRead: true, processStatus: "확인", relatedType: "customer", relatedId: 100, createdAt: new Date("2026-05-10T08:00:00.000Z") },
      ],
      totalCount: 2,
      hasMore: false,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue([
      { id: 30, customerId: 100, assignedAgentId: 4, teamId: 10, subBranchAdminId: 2, nextContactDate: new Date("2026-05-13T11:00:00.000Z"), reason: "[TEST] Follow", nextAction: "전화", status: "scheduled", createdBy: 4, createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
      { id: 31, customerId: 100, assignedAgentId: 4, teamId: 10, subBranchAdminId: 2, nextContactDate: new Date("2026-05-12T11:00:00.000Z"), reason: "[TEST] Overdue", nextAction: "문자", status: "scheduled", createdBy: 4, createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
      { id: 32, customerId: 100, assignedAgentId: 4, teamId: 10, subBranchAdminId: 2, nextContactDate: new Date("2026-05-13T11:00:00.000Z"), reason: "[TEST] Done", nextAction: "전화", status: "completed", createdBy: 4, createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
    ] as any);
  }

  it("returns member-scoped today summary without customer phone or memo", async () => {
    mockTodayWorkData();
    const result = await appRouter.createCaller(createCtx("member", { userId: 4 })).dashboard.todayWork({ date: baseDate });

    expect(db.getCustomers).toHaveBeenCalledWith({ agentId: 4 });
    expect(db.getAllContracts).toHaveBeenCalledWith({ agentId: 4 });
    expect(result.cards.todayScheduleCount).toBe(1);
    expect(result.cards.incompleteScheduleCount).toBe(1);
    expect(result.cards.pendingNotificationCount).toBe(1);
    expect(result.cards.monthlyContractCount).toBe(1);
    expect(result.cards.monthlyPremiumSum).toBe(120000);
    expect(result.cards.todayFollowUpCount).toBe(2);
    expect(result.cards.overdueFollowUpCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain("01012345678");
    expect(JSON.stringify(result)).not.toContain("private memo");
  });

  it("uses team scope for team_leader and prevents null-team widening", async () => {
    mockTodayWorkData();
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([{ id: 4 }] as any);
    await appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).dashboard.todayWork({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ teamId: 10 });
    expect(db.getAllContracts).toHaveBeenCalledWith({ teamId: 10 });

    vi.restoreAllMocks();
    mockTodayWorkData();
    const result = await appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: null })).dashboard.todayWork({ date: baseDate });
    expect(result.cards.todayScheduleCount).toBe(0);
    expect(result.cards.monthlyContractCount).toBe(0);
  });

  it("uses sub-branch and branch scopes, and blocks inactive users", async () => {
    mockTodayWorkData();
    vi.spyOn(db, "getUsersBySubBranchAdminId").mockResolvedValue([{ id: 4 }] as any);
    await appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).dashboard.todayWork({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ subBranchAdminId: 2 });
    expect(db.getAllContracts).toHaveBeenCalledWith({ subBranchAdminId: 2 });

    vi.restoreAllMocks();
    mockTodayWorkData();
    await appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).dashboard.todayWork({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({});
    expect(db.getAllContracts).toHaveBeenCalledWith({});

    await expect(appRouter.createCaller(createInactiveCtx()).dashboard.todayWork({ date: baseDate })).rejects.toThrow();
  });
});

describe("PR12 recommendations", () => {
  const baseDate = "2026-05-13T09:00:00.000Z";
  const recommendedCustomer = {
    id: 100,
    name: "[TEST] Priority",
    phone: "01012345678",
    memo: "private memo",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "상담예정",
    priority: "A",
    customerTags: JSON.stringify(["해지위험", "사후관리필요"]),
    nextAction: "재연락",
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
  };
  const otherCustomer = {
    id: 200,
    name: "[TEST] Other",
    phone: "01099998888",
    agentId: 9,
    assignedTeamId: 99,
    subBranchAdminId: 8,
    consultStatus: "미상담",
    priority: "unclassified",
    customerTags: null,
    nextAction: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
  };

  function mockRecommendationData(customers = [recommendedCustomer]) {
    vi.spyOn(db, "getCustomers").mockResolvedValue(customers as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      { id: 10, customerId: 100, agentId: 4, contractDate: new Date("2026-04-01T00:00:00.000Z"), monthlyPremium: 100000, isActive: true, deletedAt: null },
      { id: 11, customerId: 100, agentId: 4, contractDate: new Date("2026-04-01T00:00:00.000Z"), monthlyPremium: 100000, isActive: false, deletedAt: new Date() },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([]);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [{ id: 20, userId: 4, type: "general", title: "[TEST] Notice", isRead: false, processStatus: "미확인", relatedType: "customer", relatedId: 100, createdAt: new Date("2026-05-13T08:00:00.000Z") }],
      totalCount: 1,
      hasMore: false,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue([
      { id: 30, customerId: 100, assignedAgentId: 4, teamId: 10, subBranchAdminId: 2, nextContactDate: new Date("2026-05-12T11:00:00.000Z"), reason: "[TEST] Overdue", nextAction: "전화", status: "scheduled", deletedAt: null },
      { id: 31, customerId: 100, assignedAgentId: 4, teamId: 10, subBranchAdminId: 2, nextContactDate: new Date("2026-05-13T11:00:00.000Z"), reason: "[TEST] Today", nextAction: "전화", status: "scheduled", deletedAt: null },
    ] as any);
    vi.spyOn(db, "getConsultationsByCustomer").mockResolvedValue([]);
  }

  it("returns scored priority contacts without phone or memo", async () => {
    mockRecommendationData();
    const result = await appRouter.createCaller(createCtx("member", { userId: 4 })).recommendations.priorityContacts({ date: baseDate, limit: 10 });

    expect(db.getCustomers).toHaveBeenCalledWith({ agentId: 4 });
    expect(result[0].customerId).toBe(100);
    expect(result[0].urgency).toBe("high");
    expect(result[0].warnings.map((warning) => warning.warningType)).toContain("overdue_follow_up");
    expect(result[0].reasons).toContain("A등급 고객");
    expect(JSON.stringify(result)).not.toContain("01012345678");
    expect(JSON.stringify(result)).not.toContain("private memo");
  });

  it("uses role scopes and blocks inactive users", async () => {
    mockRecommendationData();
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([{ id: 4 }] as any);
    await appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).recommendations.dashboardSummary({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ teamId: 10 });

    vi.restoreAllMocks();
    mockRecommendationData();
    vi.spyOn(db, "getUsersBySubBranchAdminId").mockResolvedValue([{ id: 4 }] as any);
    await appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).recommendations.dashboardSummary({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ subBranchAdminId: 2 });

    await expect(appRouter.createCaller(createInactiveCtx()).recommendations.priorityContacts({ date: baseDate })).rejects.toThrow();
  });

  it("returns safe contact reasons and warning details for an accessible customer", async () => {
    mockRecommendationData();
    vi.spyOn(db, "getCustomerById").mockResolvedValue(recommendedCustomer as any);
    const result = await appRouter.createCaller(createCtx("member", { userId: 4 })).recommendations.customerContactReasons({ customerId: 100 });

    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toMatch(/무조건|반드시 가입|지금 안 하면|큰일/);
  });

  it("does not recommend soft deleted customers", async () => {
    mockRecommendationData([{ ...recommendedCustomer, isActive: false, deletedAt: new Date() }]);
    const result = await appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).recommendations.priorityContacts({ date: baseDate });
    expect(result).toEqual([]);
  });
});

describe("PR14 work rhythm report", () => {
  const dateFrom = "2026-05-01T00:00:00";
  const dateTo = "2026-05-31T23:59:59";
  const customers = [
    { id: 100, name: "[TEST] A", agentId: 4, assignedTeamId: 10, subBranchAdminId: 2, priority: "A", isActive: true, deletedAt: null, createdAt: new Date("2026-04-01") },
    { id: 101, name: "[TEST] B", agentId: 4, assignedTeamId: 10, subBranchAdminId: 2, priority: "B", isActive: true, deletedAt: null, createdAt: new Date("2026-04-02") },
  ] as any[];
  const contracts = [
    { id: 11, customerId: 100, agentId: 4, contractDate: new Date("2026-05-10"), monthlyPremium: 100000, isActive: true, deletedAt: null },
    { id: 12, customerId: 101, agentId: 4, contractDate: new Date("2026-05-11"), monthlyPremium: 50000, isActive: false, deletedAt: new Date("2026-05-12") },
  ] as any[];
  const followUps = [
    { id: 21, customerId: 100, assignedAgentId: 4, teamId: 10, subBranchAdminId: 2, status: "completed", nextContactDate: new Date("2026-05-10"), completedAt: new Date("2026-05-10"), createdAt: new Date("2026-05-09"), deletedAt: null },
    { id: 22, customerId: 101, assignedAgentId: 4, teamId: 10, subBranchAdminId: 2, status: "scheduled", nextContactDate: new Date("2026-05-01"), createdAt: new Date("2026-05-01"), deletedAt: null },
  ] as any[];

  function mockWorkRhythmData() {
    vi.spyOn(db, "getCustomers").mockResolvedValue(customers as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue(contracts as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([]);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 200 } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue(followUps as any);
    vi.spyOn(db, "getConsultationsByCustomer").mockImplementation(async (customerId: number) => (
      customerId === 100
        ? [{ id: 31, customerId, createdAt: new Date("2026-05-13"), content: "do not expose memo" }] as any
        : []
    ));
    vi.spyOn(db, "getPerformanceGoalDashboard").mockResolvedValue({
      items: [{
        goal: { id: 41, targetType: "user", targetId: 4, contractCountGoal: 3, monthlyPremiumGoal: 300000 },
        targetLabel: "Test member",
        actual: { contractCount: 1, monthlyPremium: 100000 },
        remaining: { contractCount: 2, monthlyPremium: 200000 },
        remainingDays: 10,
        dailyRequired: { contractCount: 0.2, monthlyPremium: 20000 },
        achievementRate: { contractCount: 33, monthlyPremium: 33 },
        status: "in_progress",
      }],
      summary: {},
    } as any);
  }

  it("returns scoped aggregation and goal action recommendations without customer private fields", async () => {
    mockWorkRhythmData();
    const result = await appRouter.createCaller(createCtx("member", { userId: 4 })).workRhythm.summary({
      period: "custom",
      dateFrom,
      dateTo,
    });

    expect(result.consultationCount).toBe(1);
    expect(result.followUpCreatedCount).toBe(2);
    expect(result.followUpCompletedCount).toBe(1);
    expect(result.contractCount).toBe(1);
    expect(result.monthlyPremiumSum).toBe(100000);
    expect(result.remaining.contractCount).toBe(2);
    expect(JSON.stringify(result)).not.toContain("do not expose memo");
    expect(JSON.stringify(result)).not.toContain("010");
  });

  it("blocks member target-user escalation and inactive users", async () => {
    mockWorkRhythmData();
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 5, role: "member", accountStatus: "active", teamId: 10, subBranchAdminId: 2 } as any);
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).workRhythm.summary({
      period: "custom",
      dateFrom,
      dateTo,
      targetUserId: 5,
    })).rejects.toThrow();
    await expect(appRouter.createCaller(createInactiveCtx()).workRhythm.summary({ period: "month" })).rejects.toThrow();
  });

  it("allows team_leader to request own team report and applies team filters", async () => {
    mockWorkRhythmData();
    vi.spyOn(db, "getTeamById").mockResolvedValue({ id: 10, name: "[TEST] Team", subBranchAdminId: 2 } as any);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([{ id: 4 }, { id: 5 }] as any);

    await expect(appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).workRhythm.summary({
      period: "custom",
      dateFrom,
      dateTo,
      teamId: 10,
    })).resolves.toMatchObject({ scope: expect.objectContaining({ teamId: 10 }) });
  });
});

describe("followUps", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    isActive: true,
    deletedAt: null,
  } as any;
  const activeFollowUp = {
    id: 30,
    customerId: 100,
    assignedAgentId: 4,
    teamId: 10,
    subBranchAdminId: 2,
    nextContactDate: new Date("2026-05-13T10:00:00.000Z"),
    reason: "[TEST] Reason",
    nextAction: "전화",
    status: "scheduled",
    createdBy: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as any;

  it("allows member to create follow_up for own customer and blocks another customer", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const createSpy = vi.spyOn(db, "createFollowUp").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.create({
      customerId: 100,
      nextContactDate: "2026-05-14T10:00:00.000Z",
      reason: "[TEST] Follow",
      nextAction: "전화",
    })).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ customerId: 100, status: "scheduled", assignedAgentId: 4 }));
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "FOLLOW_UP_CREATED" }));

    vi.restoreAllMocks();
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, agentId: 99 });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.create({
      customerId: 100,
      nextContactDate: "2026-05-14T10:00:00.000Z",
      reason: "[TEST] Follow",
      nextAction: "전화",
    })).rejects.toThrow();
  });

  it("blocks follow_up creation for inactive customer and inactive account", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, isActive: false, deletedAt: new Date() });
    await expect(appRouter.createCaller(createCtx("branch_admin")).followUps.create({
      customerId: 100,
      nextContactDate: "2026-05-14T10:00:00.000Z",
      reason: "[TEST] Follow",
      nextAction: "전화",
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createInactiveCtx()).followUps.listToday()).rejects.toThrow();
  });

  it("completes, postpones and cancels an accessible follow_up with logs", async () => {
    vi.spyOn(db, "getFollowUpById").mockResolvedValue(activeFollowUp);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const updateSpy = vi.spyOn(db, "updateFollowUp").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.complete({ id: 30 })).resolves.toEqual({ success: true });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.postpone({ id: 30, nextContactDate: "2026-05-15T10:00:00.000Z", reason: "[TEST] Later" })).resolves.toEqual({ success: true });
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.cancel({ id: 30 })).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(30, expect.objectContaining({ status: "completed", completedBy: 4 }));
    expect(updateSpy).toHaveBeenCalledWith(30, expect.objectContaining({ status: "postponed" }));
    expect(updateSpy).toHaveBeenCalledWith(30, expect.objectContaining({ status: "cancelled" }));
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "FOLLOW_UP_COMPLETED" }));
    expect(logSpy.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ action: "FOLLOW_UP_POSTPONED" }));
    expect(logSpy.mock.calls[2]?.[0]).toEqual(expect.objectContaining({ action: "FOLLOW_UP_CANCELLED" }));
  });

  it("uses role scopes for today and overdue follow_up lists", async () => {
    const listSpy = vi.spyOn(db, "getFollowUps").mockResolvedValue([activeFollowUp]);
    await appRouter.createCaller(createCtx("member", { userId: 4 })).followUps.listToday({ date: "2026-05-13T00:00:00.000Z" });
    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ agentId: 4 }));

    await appRouter.createCaller(createCtx("team_leader", { userId: 3, teamId: 10 })).followUps.listOverdue({ date: "2026-05-13T00:00:00.000Z" });
    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ teamId: 10 }));

    await appRouter.createCaller(createCtx("sub_branch_admin", { userId: 2 })).followUps.listToday({ date: "2026-05-13T00:00:00.000Z" });
    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ subBranchAdminId: 2 }));
  });
});

describe("delete request and deleted data lifecycle", () => {
  const activeContract = {
    id: 10,
    customerId: 100,
    agentId: 4,
    company: "[TEST] insurer",
    productName: "[TEST] product",
    productGroup: "[TEST] group",
    contractDate: new Date("2026-01-01") as any,
    monthlyPremium: 10000,
    paymentStatus: "정상",
    contractStatus: "유지",
    memo: null,
    isActive: true,
    deletedAt: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    phone: "01000000000",
    birthDate: null,
    gender: null,
    region: null,
    expectedPremium: null,
    availableTime: null,
    source: null,
    agentId: 4,
    assignedTeamId: 10,
    assignedAt: null,
    subBranchAdminId: 2,
    assignmentStatus: "assigned_to_agent",
    consultStatus: "미상담",
    memo: null,
    privacyConsent: false,
    marketingConsent: false,
    isActive: true,
    deletedAt: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  it("allows member to request deleting own active contract and blocks duplicate pending request", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getPendingDeleteRequestForTarget").mockResolvedValue(undefined);
    const createSpy = vi.spyOn(db, "createDeleteRequest").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).deleteRequests.createContractDeleteRequest({
      contractId: 10,
      requestReason: "오입력",
    })).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      requestType: "contract_delete",
      targetType: "contract",
      targetId: 10,
      requestedBy: 4,
      status: "pending",
      expectedImpact: "performance_exclusion",
    }));
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "DELETE_REQUEST_CREATED" }));

    vi.restoreAllMocks();
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getPendingDeleteRequestForTarget").mockResolvedValue({ id: 1, status: "pending" } as any);
    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).deleteRequests.createContractDeleteRequest({
      contractId: 10,
      requestReason: "오입력",
    })).rejects.toThrow();
  });

  it("blocks delete requests outside contract access scope and from branch_admin", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, agentId: 99 });

    await expect(appRouter.createCaller(createCtx("member", { userId: 4 })).deleteRequests.createContractDeleteRequest({
      contractId: 10,
      requestReason: "오입력",
    })).rejects.toThrow();

    await expect(appRouter.createCaller(createCtx("branch_admin")).deleteRequests.createContractDeleteRequest({
      contractId: 10,
      requestReason: "오입력",
    })).rejects.toThrow();
  });

  it("approves pending request transactionally and soft deletes the contract", async () => {
    const request = {
      id: 7,
      requestType: "contract_delete",
      targetType: "contract",
      targetId: 10,
      customerId: 100,
      requestedBy: 4,
      requestReason: "오입력",
      requestMemo: null,
      expectedImpact: "performance_exclusion",
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    const tx = { tx: true } as any;
    vi.spyOn(db, "getDeleteRequestById").mockResolvedValue(request);
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback(tx));
    const deactivateSpy = vi.spyOn(db, "deactivateContractWithClient").mockResolvedValue(undefined);
    const updateRequestSpy = vi.spyOn(db, "updateDeleteRequest").mockResolvedValue(undefined);
    const historySpy = vi.spyOn(db, "createContractHistoryEntry").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).deleteRequests.approve({ id: 7 })).resolves.toEqual({ success: true });

    expect(deactivateSpy).toHaveBeenCalledWith(10, tx);
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({ contractId: 10, fieldName: "isActive", afterValue: "false" }), tx);
    expect(updateRequestSpy).toHaveBeenCalledWith(7, expect.objectContaining({ status: "approved", reviewedBy: 1 }), tx);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "DELETE_REQUEST_APPROVED" }), tx);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "CONTRACT_DEACTIVATED_BY_REQUEST" }), tx);
  });

  it("rejects pending request without touching contract data", async () => {
    vi.spyOn(db, "getDeleteRequestById").mockResolvedValue({ id: 7, status: "pending", targetId: 10 } as any);
    const updateRequestSpy = vi.spyOn(db, "updateDeleteRequest").mockResolvedValue(undefined);
    const deactivateSpy = vi.spyOn(db, "deactivateContractWithClient").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).deleteRequests.reject({ id: 7, reviewComment: "자료 확인 필요" })).resolves.toEqual({ success: true });

    expect(updateRequestSpy).toHaveBeenCalledWith(7, expect.objectContaining({ status: "rejected", reviewedBy: 1 }));
    expect(deactivateSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "DELETE_REQUEST_REJECTED" }));
  });

  it("allows branch_admin to restore soft deleted contract and blocks non-admin restore routes", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue({ ...activeContract, isActive: false, deletedAt: new Date() });
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback({} as any));
    const restoreSpy = vi.spyOn(db, "restoreContract").mockResolvedValue(undefined);
    vi.spyOn(db, "createContractHistoryEntry").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).deletedData.restoreContract({ id: 10 })).resolves.toEqual({ success: true });
    expect(restoreSpy).toHaveBeenCalled();

    await expect(appRouter.createCaller(createCtx("member")).deletedData.restoreContract({ id: 10 })).rejects.toThrow();
  });

  it("blocks permanent delete for active data and requires confirmation text", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    await expect(appRouter.createCaller(createCtx("branch_admin")).deletedData.permanentDeleteContract({ id: 10, confirmText: "완전삭제" })).rejects.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(db, "getContractById").mockResolvedValue({ ...activeContract, isActive: false, deletedAt: new Date() });
    await expect(appRouter.createCaller(createCtx("branch_admin")).deletedData.permanentDeleteContract({ id: 10, confirmText: "삭제" })).rejects.toThrow();
  });

  it("blocks customer permanent delete when operational history exists", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({ ...activeCustomer, isActive: false, deletedAt: new Date() });
    vi.spyOn(db, "getCustomerPermanentDeleteBlockers").mockResolvedValue({
      contracts: 0,
      consultations: 1,
      statusHistory: 0,
      consentLogs: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      notifications: 0,
      reminders: 0,
    });
    const permanentSpy = vi.spyOn(db, "permanentlyDeleteCustomer").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).deletedData.permanentDeleteCustomer({ id: 100, confirmText: "\uC644\uC804\uC0AD\uC81C" })).rejects.toThrow();

    expect(permanentSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "PERMANENT_DELETE_BLOCKED" }));
  });

  it("blocks contract permanent delete when notification or reminder history exists", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue({ ...activeContract, isActive: false, deletedAt: new Date() });
    vi.spyOn(db, "getContractPermanentDeleteBlockers").mockResolvedValue({
      contractHistory: 0,
      deleteRequests: 0,
      notifications: 1,
      reminders: 0,
    });
    const permanentSpy = vi.spyOn(db, "permanentlyDeleteContract").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).deletedData.permanentDeleteContract({ id: 10, confirmText: "\uC644\uC804\uC0AD\uC81C" })).rejects.toThrow();

    expect(permanentSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "PERMANENT_DELETE_BLOCKED" }));
  });

  it("blocks team permanent delete when schedules or assignment history exists", async () => {
    vi.spyOn(db, "getTeamById").mockResolvedValue({ id: 10, name: "[TEST] Team", isActive: false, deletedAt: new Date() } as any);
    vi.spyOn(db, "getTeamPermanentDeleteBlockers").mockResolvedValue({
      users: 0,
      customers: 0,
      schedules: 1,
      assignmentHistory: 0,
    });
    const permanentSpy = vi.spyOn(db, "permanentlyDeleteTeam").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).deletedData.permanentDeleteTeam({ id: 10, confirmText: "\uC644\uC804\uC0AD\uC81C" })).rejects.toThrow();

    expect(permanentSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "PERMANENT_DELETE_BLOCKED" }));
  });

  it("blocks non-admin direct restore and permanent delete API calls", async () => {
    const memberCaller = appRouter.createCaller(createCtx("member"));
    const teamLeaderCaller = appRouter.createCaller(createCtx("team_leader"));
    const subBranchCaller = appRouter.createCaller(createCtx("sub_branch_admin"));
    const inactiveCaller = appRouter.createCaller(createInactiveCtx("branch_admin"));

    await expect(memberCaller.deletedData.permanentDeleteContract({ id: 10, confirmText: "\uC644\uC804\uC0AD\uC81C" })).rejects.toThrow();
    await expect(teamLeaderCaller.deletedData.restoreCustomer({ id: 100 })).rejects.toThrow();
    await expect(subBranchCaller.deletedData.permanentDeleteTeam({ id: 10, confirmText: "\uC644\uC804\uC0AD\uC81C" })).rejects.toThrow();
    await expect(inactiveCaller.deletedData.restoreContract({ id: 10 })).rejects.toThrow();
  });

  it("allows only branch_admin to view import batches", async () => {
    await expect(appRouter.createCaller(createCtx("member")).imports.listBatches({})).rejects.toThrow();
    vi.spyOn(db, "listImportBatches").mockResolvedValue([]);
    await expect(appRouter.createCaller(createCtx("branch_admin")).imports.listBatches({})).resolves.toEqual([]);
  });

  it("cancels an import batch transactionally when no operational history exists", async () => {
    const batch = { id: 3, importBatchId: "batch_test", status: "active", uploadedBy: 1, createdAt: new Date() } as any;
    vi.spyOn(db, "getImportBatchByBatchId").mockResolvedValue(batch);
    vi.spyOn(db, "getCustomersByImportBatch").mockResolvedValue([{ ...activeCustomer, importBatchId: "batch_test", isActive: true, deletedAt: null }] as any);
    vi.spyOn(db, "getImportBatchCancelBlockers").mockResolvedValue({
      activeContracts: 0,
      consultations: 0,
      statusHistory: 0,
      notifications: 0,
      reminders: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      consentLogs: 0,
      blockedCustomerIds: [],
    });
    const tx = { tx: true } as any;
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback(tx));
    const softDeleteSpy = vi.spyOn(db, "softDeleteCustomersByImportBatch").mockResolvedValue(undefined);
    const updateBatchSpy = vi.spyOn(db, "updateImportBatch").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).imports.cancelBatch({ importBatchId: "batch_test", confirmText: "BATCH취소" })).resolves.toEqual({ success: true, affectedCustomerCount: 1 });

    expect(softDeleteSpy).toHaveBeenCalledWith("batch_test", tx);
    expect(updateBatchSpy).toHaveBeenCalledWith("batch_test", expect.objectContaining({ status: "cancelled", cancelledBy: 1 }), tx);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "IMPORT_BATCH_CANCELLED" }), tx);
  });

  it("blocks import batch cancellation when linked operational history exists", async () => {
    vi.spyOn(db, "getImportBatchByBatchId").mockResolvedValue({ id: 3, importBatchId: "batch_test", status: "active", uploadedBy: 1 } as any);
    vi.spyOn(db, "getCustomersByImportBatch").mockResolvedValue([{ ...activeCustomer, importBatchId: "batch_test", isActive: true, deletedAt: null }] as any);
    vi.spyOn(db, "getImportBatchCancelBlockers").mockResolvedValue({
      activeContracts: 1,
      consultations: 0,
      statusHistory: 0,
      notifications: 0,
      reminders: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      consentLogs: 0,
      blockedCustomerIds: [100],
    });
    const softDeleteSpy = vi.spyOn(db, "softDeleteCustomersByImportBatch").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(appRouter.createCaller(createCtx("branch_admin")).imports.cancelBatch({ importBatchId: "batch_test", confirmText: "BATCH취소" })).rejects.toThrow();

    expect(softDeleteSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ action: "IMPORT_BATCH_CANCEL_BLOCKED" }));
  });
});
