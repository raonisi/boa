import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "admin" | "manager" | "agent" | "inactive";

function createCtx(role: Role, teamId?: number): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : role === "manager" ? 2 : role === "agent" ? 3 : 4,
      openId: `test-${role}`,
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

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const ctx = createCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result?.role).toBe("admin");
  });
});

describe("RBAC - admin procedures", () => {
  it("allows admin to access users.list", async () => {
    const ctx = createCtx("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).resolves.toBeDefined();
  });

  it("allows agent to access users.list (for assignment dropdowns)", async () => {
    const ctx = createCtx("agent");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).resolves.toBeDefined();
  });

  it("allows manager to access users.list", async () => {
    const ctx = createCtx("manager");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).resolves.toBeDefined();
  });

  it("blocks admin from being accessed by inactive user", async () => {
    const ctx = createCtx("inactive");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("RBAC - inactive user", () => {
  it("blocks inactive user from accessing customers.list", async () => {
    const ctx = createCtx("inactive");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.customers.list({})).rejects.toThrow("계정이 비활성화되었습니다.");
  });

  it("blocks inactive user from accessing schedules.list", async () => {
    const ctx = createCtx("inactive");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.schedules.list()).rejects.toThrow();
  });
});

describe("RBAC - admin-only routes", () => {
  it("blocks agent from accessing logs.list", async () => {
    const ctx = createCtx("agent");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.logs.list()).rejects.toThrow();
  });

  it("blocks manager from accessing logs.list", async () => {
    const ctx = createCtx("manager");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.logs.list()).rejects.toThrow();
  });

  it("allows admin to access logs.list", async () => {
    const ctx = createCtx("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.logs.list()).resolves.toBeDefined();
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
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBe(1);
  });
});
