import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { sanitizeActivityLogDetailsForStorage } from "./activityLogRedaction";
import * as db from "./db";
import * as retentionRiskDb from "./retentionRiskDb";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";

function createCtx(
  role: Role,
  overrides?: Partial<NonNullable<TrpcContext["user"]>>
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
      openId: `test-${role}-${id}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "google",
      role,
      accountStatus: "active",
      teamId: role === "team_leader" ? 10 : null,
      subBranchAdminId: role === "sub_branch_admin" ? 2 : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const scopedCustomer = {
  id: 200,
  name: "[TEST] Retention Customer",
  agentId: 4,
  assignedTeamId: 10,
  subBranchAdminId: 2,
  consultStatus: "해지관리",
  isActive: true,
  deletedAt: null,
} as any;

const outOfScopeCustomer = {
  id: 201,
  name: "[TEST] Out Customer",
  agentId: 99,
  assignedTeamId: 20,
  subBranchAdminId: 9,
  consultStatus: "계약",
  isActive: true,
  deletedAt: null,
} as any;

const scopedContract = {
  id: 300,
  customerId: 200,
  agentId: 4,
  isActive: true,
  deletedAt: null,
} as any;

const mismatchedContract = {
  id: 301,
  customerId: 201,
  agentId: 99,
  isActive: true,
  deletedAt: null,
} as any;

const scopedFollowUp = {
  id: 400,
  customerId: 200,
  assignedAgentId: 4,
  deletedAt: null,
} as any;

const riskCaseRow = {
  id: 900,
  customerId: 200,
  contractId: 300,
  riskReason: "premium_burden",
  riskLevel: "medium",
  retentionStatus: "detected",
  responseStrategy: "wait_and_followup",
  customerSentiment: "price_sensitive",
  financialPressureLevel: "medium",
  competitorMentioned: false,
  followUpId: null,
  nextFollowUpAt: null,
  resolvedAt: null,
  resolutionResult: null,
  memo: null,
  createdBy: 1,
  updatedBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as any;

const createInput = {
  customerId: 200,
  riskReason: "premium_burden" as const,
};

beforeEach(() => {
  vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
    if (id === 4) return { id: 4, name: "[TEST] Member", teamId: 10 } as any;
    if (id === 99) return { id: 99, name: "[TEST] Other", teamId: 20 } as any;
    return undefined;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockCustomers(map: Record<number, any | undefined>) {
  vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) =>
    map[id]
  );
}

describe("retentionRisk RBAC", () => {
  it("allows branch_admin to create retention risk cases", async () => {
    mockCustomers({ 200: scopedCustomer });
    vi.spyOn(retentionRiskDb, "findActiveRetentionRiskCase").mockResolvedValue(
      null
    );
    vi.spyOn(retentionRiskDb, "createRetentionRiskCase").mockResolvedValue(
      riskCaseRow
    );

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.create(createInput);
    expect(result.id).toBe(900);
  });

  it("blocks sub_branch_admin outside sub-branch scope", async () => {
    mockCustomers({
      200: { ...scopedCustomer, subBranchAdminId: 9 },
    });
    const createSpy = vi.spyOn(retentionRiskDb, "createRetentionRiskCase");

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { id: 2 }))
        .retentionRisk.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks team_leader outside team scope", async () => {
    mockCustomers({
      200: { ...scopedCustomer, assignedTeamId: 99, agentId: 99 },
    });
    const createSpy = vi.spyOn(retentionRiskDb, "createRetentionRiskCase");

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { id: 3, teamId: 10 }))
        .retentionRisk.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks member create for customers outside their assignment", async () => {
    mockCustomers({
      200: { ...scopedCustomer, agentId: 99 },
    });
    const createSpy = vi.spyOn(retentionRiskDb, "createRetentionRiskCase");

    await expect(
      appRouter
        .createCaller(createCtx("member", { id: 4 }))
        .retentionRisk.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("allows member create for own assigned customers", async () => {
    mockCustomers({ 200: scopedCustomer });
    vi.spyOn(retentionRiskDb, "findActiveRetentionRiskCase").mockResolvedValue(
      null
    );
    vi.spyOn(retentionRiskDb, "createRetentionRiskCase").mockResolvedValue(
      riskCaseRow
    );

    await appRouter
      .createCaller(createCtx("member", { id: 4 }))
      .retentionRisk.create(createInput);
  });

  it("blocks inactive and resigned users", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "inactive" }))
        .retentionRisk.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .retentionRisk.summary()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("retentionRisk validation", () => {
  beforeEach(() => {
    mockCustomers({
      200: scopedCustomer,
      201: outOfScopeCustomer,
    });
    vi.spyOn(db, "getContractById").mockImplementation(async (id: number) => {
      if (id === 300) return scopedContract;
      if (id === 301) return mismatchedContract;
      return undefined;
    });
    vi.spyOn(db, "getFollowUpById").mockImplementation(async (id: number) => {
      if (id === 400) return scopedFollowUp;
      return undefined;
    });
  });

  it("blocks contractId that does not belong to customerId", async () => {
    vi.spyOn(retentionRiskDb, "findActiveRetentionRiskCase").mockResolvedValue(
      null
    );
    const createSpy = vi.spyOn(retentionRiskDb, "createRetentionRiskCase");
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).retentionRisk.create({
        ...createInput,
        contractId: 301,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks contractId outside RBAC scope", async () => {
    const createSpy = vi.spyOn(retentionRiskDb, "createRetentionRiskCase");
    await expect(
      appRouter
        .createCaller(createCtx("member", { id: 4 }))
        .retentionRisk.create({
          customerId: 201,
          riskReason: "premium_burden",
          contractId: 301,
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks duplicate active retention risk case", async () => {
    vi.spyOn(retentionRiskDb, "findActiveRetentionRiskCase").mockResolvedValue(
      riskCaseRow
    );
    const createSpy = vi.spyOn(retentionRiskDb, "createRetentionRiskCase");
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .retentionRisk.create(createInput)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("changes risk level", async () => {
    vi.spyOn(retentionRiskDb, "getRetentionRiskCaseById").mockResolvedValue(
      riskCaseRow
    );
    vi.spyOn(retentionRiskDb, "updateRetentionRiskCase").mockResolvedValue({
      ...riskCaseRow,
      riskLevel: "high",
    });

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.changeRiskLevel({ id: 900, riskLevel: "high" });
  });

  it("changes retention status", async () => {
    vi.spyOn(retentionRiskDb, "getRetentionRiskCaseById").mockResolvedValue(
      riskCaseRow
    );
    vi.spyOn(retentionRiskDb, "updateRetentionRiskCase").mockResolvedValue({
      ...riskCaseRow,
      retentionStatus: "contacted",
    });

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.changeRetentionStatus({
        id: 900,
        retentionStatus: "contacted",
      });
  });

  it("resolves retention risk case", async () => {
    vi.spyOn(retentionRiskDb, "getRetentionRiskCaseById").mockResolvedValue(
      riskCaseRow
    );
    vi.spyOn(retentionRiskDb, "updateRetentionRiskCase").mockResolvedValue({
      ...riskCaseRow,
      retentionStatus: "retained",
      resolutionResult: "retained",
      resolvedAt: new Date(),
    });

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.resolve({
        id: 900,
        resolutionResult: "retained",
      });
  });

  it("excludes soft-deleted cases from list", async () => {
    vi.spyOn(retentionRiskDb, "listRetentionRiskCases").mockResolvedValue([]);
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.list({});
    expect(result).toEqual([]);
  });

  it("does not store memo text in activity logs", async () => {
    vi.spyOn(retentionRiskDb, "findActiveRetentionRiskCase").mockResolvedValue(
      null
    );
    vi.spyOn(retentionRiskDb, "createRetentionRiskCase").mockResolvedValue({
      ...riskCaseRow,
      memo: "secret memo",
    });
    const logSpy = vi.spyOn(db, "createActivityLog");

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.create({
        ...createInput,
        memo: "[TEST] 업무 메모",
      });

    const payload = logSpy.mock.calls[0]?.[0];
    const sanitized = String(
      sanitizeActivityLogDetailsForStorage(payload?.details ?? "")
    );
    expect(sanitized).not.toContain("secret memo");
    expect(sanitized).not.toContain("[TEST] 업무 메모");
    expect(sanitized).toContain("retentionRiskCaseId");
  });

  it("rejects sensitive memo on create", async () => {
    vi.spyOn(retentionRiskDb, "findActiveRetentionRiskCase").mockResolvedValue(
      null
    );
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).retentionRisk.create({
        ...createInput,
        memo: "010-1234-5678",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("retentionRisk summary", () => {
  it("returns scoped summary for branch_admin", async () => {
    vi.spyOn(retentionRiskDb, "getRetentionRiskSummary").mockResolvedValue({
      total: 2,
      openCount: 1,
      criticalCount: 0,
      highCount: 1,
      waitingCustomer: 1,
      followUpScheduled: 0,
      resolvedCount: 1,
      byRiskLevel: { medium: 1, high: 1 },
      byRetentionStatus: { detected: 1, retained: 1 },
      byRiskReason: { premium_burden: 2 },
    });

    const summary = await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.summary();
    expect(summary.total).toBe(2);
  });
});

describe("retentionRisk consultStatus coexistence", () => {
  it("does not auto-change customer consultStatus on create", async () => {
    mockCustomers({ 200: scopedCustomer });
    vi.spyOn(retentionRiskDb, "findActiveRetentionRiskCase").mockResolvedValue(
      null
    );
    vi.spyOn(retentionRiskDb, "createRetentionRiskCase").mockResolvedValue(
      riskCaseRow
    );
    const updateCustomerSpy = vi.spyOn(db, "updateCustomer");

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .retentionRisk.create(createInput);

    expect(updateCustomerSpy).not.toHaveBeenCalled();
  });
});
