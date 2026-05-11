import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
