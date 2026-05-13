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
