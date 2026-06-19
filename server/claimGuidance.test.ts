import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { sanitizeActivityLogDetailsForStorage } from "./activityLogRedaction";
import * as db from "./db";
import * as claimGuidanceDb from "./claimGuidanceDb";

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
  name: "[TEST] Claim Customer",
  agentId: 4,
  assignedTeamId: 10,
  subBranchAdminId: 2,
  consultStatus: "계약",
  isActive: true,
  deletedAt: null,
} as any;

const outOfScopeCustomer = {
  id: 201,
  name: "[TEST] Out Customer",
  agentId: 99,
  assignedTeamId: 20,
  subBranchAdminId: 9,
  consultStatus: "미상담",
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

const mismatchedFollowUp = {
  id: 401,
  customerId: 201,
  assignedAgentId: 99,
  deletedAt: null,
} as any;

const claimCaseRow = {
  id: 900,
  customerId: 200,
  contractId: 300,
  guidanceType: "process_guidance",
  guidanceStatus: "guidance_needed",
  documentGuideStatus: "not_started",
  customerActionStatus: "no_action",
  followUpId: null,
  nextFollowUpAt: null,
  closedAt: null,
  closedReason: null,
  memo: null,
  createdBy: 1,
  updatedBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as any;

const createInput = {
  customerId: 200,
  guidanceType: "process_guidance" as const,
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

describe("claimGuidance RBAC", () => {
  it("allows branch_admin to create claim guidance cases", async () => {
    mockCustomers({ 200: scopedCustomer });
    vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase").mockResolvedValue(
      claimCaseRow
    );

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .claimGuidance.create(createInput);
    expect(result.id).toBe(900);
  });

  it("blocks sub_branch_admin outside sub-branch scope", async () => {
    mockCustomers({
      200: { ...scopedCustomer, subBranchAdminId: 9 },
    });
    const createSpy = vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase");

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { id: 2 }))
        .claimGuidance.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks team_leader outside team scope", async () => {
    mockCustomers({
      200: { ...scopedCustomer, assignedTeamId: 99, agentId: 99 },
    });
    const createSpy = vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase");

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { id: 3, teamId: 10 }))
        .claimGuidance.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks member create for customers outside their assignment", async () => {
    mockCustomers({
      200: { ...scopedCustomer, agentId: 99 },
    });
    const createSpy = vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase");

    await expect(
      appRouter
        .createCaller(createCtx("member", { id: 4 }))
        .claimGuidance.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("allows member create for own assigned customers", async () => {
    mockCustomers({ 200: scopedCustomer });
    vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase").mockResolvedValue(
      claimCaseRow
    );

    await appRouter
      .createCaller(createCtx("member", { id: 4 }))
      .claimGuidance.create(createInput);
  });

  it("blocks inactive and resigned users", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "inactive" }))
        .claimGuidance.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .claimGuidance.summary()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("claimGuidance validation", () => {
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
      if (id === 401) return mismatchedFollowUp;
      return undefined;
    });
  });

  it("blocks contractId that does not belong to customerId", async () => {
    const createSpy = vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase");
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).claimGuidance.create({
        ...createInput,
        contractId: 301,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks contractId outside RBAC scope", async () => {
    const createSpy = vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase");
    await expect(
      appRouter
        .createCaller(createCtx("member", { id: 4 }))
        .claimGuidance.create({
          customerId: 201,
          guidanceType: "process_guidance",
          contractId: 301,
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks followUpId that does not belong to customerId", async () => {
    const createSpy = vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase");
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).claimGuidance.create({
        ...createInput,
        followUpId: 401,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("changes guidance status", async () => {
    vi.spyOn(claimGuidanceDb, "getClaimGuidanceCaseById").mockResolvedValue(
      claimCaseRow
    );
    vi.spyOn(claimGuidanceDb, "updateClaimGuidanceCase").mockResolvedValue({
      ...claimCaseRow,
      guidanceStatus: "guidance_provided",
    });

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .claimGuidance.changeStatus({
        id: 900,
        guidanceStatus: "guidance_provided",
      });
  });

  it("closes claim guidance with reason", async () => {
    vi.spyOn(claimGuidanceDb, "getClaimGuidanceCaseById").mockResolvedValue(
      claimCaseRow
    );
    vi.spyOn(claimGuidanceDb, "updateClaimGuidanceCase").mockResolvedValue({
      ...claimCaseRow,
      guidanceStatus: "closed",
      closedAt: new Date(),
      closedReason: "customer_completed",
    });

    await appRouter.createCaller(createCtx("branch_admin")).claimGuidance.close({
      id: 900,
      closedReason: "customer_completed",
    });
  });

  it("excludes soft-deleted cases from list", async () => {
    vi.spyOn(claimGuidanceDb, "listClaimGuidanceCases").mockResolvedValue([]);
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .claimGuidance.list({});
    expect(result).toEqual([]);
  });

  it("does not store memo text in activity logs", async () => {
    vi.spyOn(claimGuidanceDb, "createClaimGuidanceCase").mockResolvedValue({
      ...claimCaseRow,
      memo: "secret memo",
    });
    const logSpy = vi.spyOn(db, "createActivityLog");

    await appRouter.createCaller(createCtx("branch_admin")).claimGuidance.create({
      ...createInput,
      memo: "[TEST] 업무 메모",
    });

    const payload = logSpy.mock.calls[0]?.[0];
    const sanitized = String(
      sanitizeActivityLogDetailsForStorage(payload?.details ?? "")
    );
    expect(sanitized).not.toContain("secret memo");
    expect(sanitized).not.toContain("[TEST] 업무 메모");
    expect(sanitized).toContain("claimGuidanceCaseId");
  });

  it("rejects sensitive memo on create", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).claimGuidance.create({
        ...createInput,
        memo: "010-1234-5678",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("claimGuidance summary", () => {
  it("returns scoped summary for branch_admin", async () => {
    vi.spyOn(claimGuidanceDb, "getClaimGuidanceSummary").mockResolvedValue({
      total: 2,
      openCount: 1,
      guidanceNeeded: 1,
      additionalGuidanceNeeded: 0,
      completed: 1,
      closed: 0,
      followUpScheduled: 0,
      byGuidanceStatus: { guidance_needed: 1, completed: 1 },
      byGuidanceType: { process_guidance: 2 },
    });

    const summary = await appRouter
      .createCaller(createCtx("branch_admin"))
      .claimGuidance.summary();
    expect(summary.total).toBe(2);
  });

  it("scopes summary through list layer for member", async () => {
    const summarySpy = vi
      .spyOn(claimGuidanceDb, "getClaimGuidanceSummary")
      .mockResolvedValue({
        total: 1,
        openCount: 1,
        guidanceNeeded: 1,
        additionalGuidanceNeeded: 0,
        completed: 0,
        closed: 0,
        followUpScheduled: 0,
        byGuidanceStatus: { guidance_needed: 1 },
        byGuidanceType: { required_documents: 1 },
      });

    await appRouter.createCaller(createCtx("member", { id: 4 })).claimGuidance.summary();
    expect(summarySpy).toHaveBeenCalled();
  });
});
