import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCtx(
  role: "branch_admin" | "sub_branch_admin" | "team_leader" | "member",
  opts?: { teamId?: number | null; subBranchAdminId?: number | null; userId?: number }
): TrpcContext {
  const id = opts?.userId ?? (role === "branch_admin" ? 1 : role === "sub_branch_admin" ? 2 : role === "team_leader" ? 3 : 4);
  return {
    user: {
      id,
      openId: `test-${role}-${id}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "manus",
      role,
      accountStatus: "active",
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

describe("analytics RBAC", () => {
  it("rejects member with UNAUTHORIZED", async () => {
    try {
      await appRouter.createCaller(createCtx("member")).analytics.salesFunnel({});
      expect.fail("expected UNAUTHORIZED");
    } catch (e: any) {
      expect(e?.code ?? e?.cause?.code).toBe("UNAUTHORIZED");
    }
  });
});
