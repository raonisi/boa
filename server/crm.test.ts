import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "admin" | "manager" | "agent" | "inactive";

function createCtx(role: Role, teamId?: number, userId?: number): TrpcContext {
  const id = userId ?? (role === "admin" ? 1 : role === "manager" ? 2 : role === "agent" ? 3 : 4);
  return {
    user: {
      id,
      openId: `test-${role}-${id}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "manus",
      role,
      teamId: teamId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
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
    const ctx = createCtx("admin");
    expect((await appRouter.createCaller(ctx).auth.me())?.role).toBe("admin");
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

// ─── RBAC - users.list ────────────────────────────────────────────────────────
describe("RBAC - users.list", () => {
  it("allows admin to access users.list", async () => {
    await expect(appRouter.createCaller(createCtx("admin")).users.list()).resolves.toBeDefined();
  });
  it("allows agent to access users.list (for dropdowns)", async () => {
    await expect(appRouter.createCaller(createCtx("agent")).users.list()).resolves.toBeDefined();
  });
  it("allows manager to access users.list", async () => {
    await expect(appRouter.createCaller(createCtx("manager")).users.list()).resolves.toBeDefined();
  });
  it("blocks inactive user from users.list", async () => {
    await expect(appRouter.createCaller(createCtx("inactive")).users.list()).rejects.toThrow();
  });
});

// ─── RBAC - inactive user blocked ────────────────────────────────────────────
describe("RBAC - inactive user blocked from all data", () => {
  it("blocks inactive from customers.list", async () => {
    await expect(appRouter.createCaller(createCtx("inactive")).customers.list({})).rejects.toThrow("계정이 비활성화되었습니다.");
  });
  it("blocks inactive from schedules.list", async () => {
    await expect(appRouter.createCaller(createCtx("inactive")).schedules.list()).rejects.toThrow();
  });
  it("blocks inactive from notifications.list", async () => {
    await expect(appRouter.createCaller(createCtx("inactive")).notifications.list()).rejects.toThrow();
  });
  it("blocks inactive from performance.stats", async () => {
    await expect(appRouter.createCaller(createCtx("inactive")).performance.stats()).rejects.toThrow();
  });
});

// ─── RBAC - admin-only routes ─────────────────────────────────────────────────
describe("RBAC - users.updateRole (admin only)", () => {
  it("blocks agent from updating user role", async () => {
    await expect(
      appRouter.createCaller(createCtx("agent")).users.updateRole({ userId: 1, role: "manager" })
    ).rejects.toThrow("관리자만 접근 가능합니다.");
  });
  it("blocks manager from updating user role", async () => {
    await expect(
      appRouter.createCaller(createCtx("manager")).users.updateRole({ userId: 1, role: "agent" })
    ).rejects.toThrow("관리자만 접근 가능합니다.");
  });
});

// ─── RBAC - logs.list (manager+ only) ────────────────────────────────────────
describe("RBAC - logs.list (manager+ only)", () => {
  it("blocks agent from logs.list", async () => {
    await expect(appRouter.createCaller(createCtx("agent")).logs.list()).rejects.toThrow();
  });
  it("allows manager to access logs.list (filtered to team)", async () => {
    await expect(appRouter.createCaller(createCtx("manager")).logs.list()).resolves.toBeDefined();
  });
  it("allows admin to access logs.list", async () => {
    await expect(appRouter.createCaller(createCtx("admin")).logs.list()).resolves.toBeDefined();
  });
});

// ─── RBAC - customers.assign (admin only) ────────────────────────────────────
describe("RBAC - customers.assign (admin only)", () => {
  it("blocks agent from assigning customers", async () => {
    await expect(
      appRouter.createCaller(createCtx("agent")).customers.assign({ customerId: 1, agentId: 3 })
    ).rejects.toThrow("관리자만 접근 가능합니다.");
  });
  it("blocks manager from assigning customers", async () => {
    await expect(
      appRouter.createCaller(createCtx("manager")).customers.assign({ customerId: 1, agentId: 3 })
    ).rejects.toThrow("관리자만 접근 가능합니다.");
  });
});

// ─── RBAC - performance.agentStats (manager+ only) ───────────────────────────
describe("RBAC - performance.agentStats (manager+ only)", () => {
  it("blocks agent from agentStats", async () => {
    await expect(
      appRouter.createCaller(createCtx("agent")).performance.agentStats({ agentId: 3 })
    ).rejects.toThrow("팀장 이상만 접근 가능합니다.");
  });
  it("allows manager to access agentStats", async () => {
    await expect(
      appRouter.createCaller(createCtx("manager")).performance.agentStats({ agentId: 3 })
    ).resolves.toBeDefined();
  });
});

// ─── 1단계 치명적 문제 수정 검증 ─────────────────────────────────────────────

// consultations.list: 존재하지 않는 고객 ID → NOT_FOUND
describe("consultations.list - 권한 검증", () => {
  it("returns NOT_FOUND for non-existent customerId", async () => {
    const ctx = createCtx("agent", undefined, 3);
    await expect(
      appRouter.createCaller(ctx).consultations.list({ customerId: 999999 })
    ).rejects.toThrow();
  });
});

// contracts.listByCustomer: 존재하지 않는 고객 ID → NOT_FOUND
describe("contracts.listByCustomer - 권한 검증", () => {
  it("returns NOT_FOUND for non-existent customerId", async () => {
    const ctx = createCtx("agent", undefined, 3);
    await expect(
      appRouter.createCaller(ctx).contracts.listByCustomer({ customerId: 999999 })
    ).rejects.toThrow();
  });
});
