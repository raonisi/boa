import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

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
      return null;
    });

    await appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).customers.changeAgent({ customerId: 100, newAgentId: 24 });

    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      previousAgentId: 24,
      newAgentId: 24,
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

describe("contracts.listByCustomer - 권한 검증", () => {
  it("returns NOT_FOUND for non-existent customerId", async () => {
    const ctx = createCtx("member", { userId: 3 });
    await expect(
      appRouter.createCaller(ctx).contracts.listByCustomer({ customerId: 999999 })
    ).rejects.toThrow();
  });
});
