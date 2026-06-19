import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { sanitizeActivityLogDetailsForStorage } from "./activityLogRedaction";
import * as db from "./db";
import * as referralsDb from "./customerReferralsDb";
import * as relationshipsDb from "./customerRelationshipsDb";

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

const referrerCustomer = {
  id: 100,
  name: "[TEST] Referrer",
  agentId: 4,
  assignedTeamId: 10,
  subBranchAdminId: 2,
  consultStatus: "계약",
  isActive: true,
  deletedAt: null,
} as any;

const referredCustomer = {
  id: 101,
  name: "[TEST] Referred",
  agentId: 4,
  assignedTeamId: 10,
  subBranchAdminId: 2,
  consultStatus: "미상담",
  isActive: true,
  deletedAt: null,
} as any;

const outOfScopeCustomer = {
  id: 102,
  name: "[TEST] Out",
  agentId: 99,
  assignedTeamId: 20,
  subBranchAdminId: 9,
  consultStatus: "미상담",
  isActive: true,
  deletedAt: null,
} as any;

const referralRelationship = {
  id: 700,
  primaryCustomerId: 100,
  relatedCustomerId: 101,
  relationshipType: "referral",
  relationshipLabel: "소개자",
  direction: "outbound",
  status: "active",
  deletedAt: null,
} as any;

const referralRow = {
  id: 800,
  relationshipId: 700,
  referrerCustomerId: 100,
  referredCustomerId: 101,
  referralStage: "introduced",
  referralSourceType: "customer_referral",
  introductionMethod: "phone",
  thankYouStatus: "pending",
  thankYouCompletedAt: null,
  resultStatus: "in_progress",
  memo: null,
  createdBy: 1,
  updatedBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as any;

const createInput = {
  relationshipId: 700,
  referrerCustomerId: 100,
  referredCustomerId: 101,
  anchorCustomerId: 100,
  referralSourceType: "customer_referral" as const,
};

beforeEach(() => {
  vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
    if (id === 4) return { id: 4, name: "[TEST] Member", teamId: 10 } as any;
    if (id === 99) return { id: 99, name: "[TEST] Other", teamId: 20 } as any;
    return undefined;
  });
  vi.spyOn(relationshipsDb, "getCustomerRelationshipById").mockResolvedValue(
    referralRelationship
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockCustomers(
  map: Record<number, any | undefined>
) {
  vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) =>
    map[id]
  );
}

describe("customerReferrals RBAC", () => {
  it("allows branch_admin to create referral flows", async () => {
    mockCustomers({
      100: referrerCustomer,
      101: referredCustomer,
    });
    vi.spyOn(referralsDb, "findActiveReferralDuplicate").mockResolvedValue(null);
    vi.spyOn(referralsDb, "createCustomerReferral").mockResolvedValue(referralRow);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerReferrals.create(createInput);
    expect(result.id).toBe(800);
  });

  it("blocks sub_branch_admin outside sub-branch scope", async () => {
    mockCustomers({
      100: { ...referrerCustomer, subBranchAdminId: 9 },
      101: { ...referredCustomer, subBranchAdminId: 9 },
    });
    const createSpy = vi.spyOn(referralsDb, "createCustomerReferral");

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { id: 2 }))
        .customerReferrals.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks team_leader outside team scope", async () => {
    mockCustomers({
      100: { ...referrerCustomer, assignedTeamId: 99, agentId: 99 },
      101: { ...referredCustomer, assignedTeamId: 99, agentId: 99 },
    });
    const createSpy = vi.spyOn(referralsDb, "createCustomerReferral");

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { id: 3, teamId: 10 }))
        .customerReferrals.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks member create when anchor customer is not theirs", async () => {
    mockCustomers({
      100: { ...referrerCustomer, agentId: 99 },
      101: { ...referredCustomer, agentId: 99 },
    });
    const createSpy = vi.spyOn(referralsDb, "createCustomerReferral");

    await expect(
      appRouter
        .createCaller(createCtx("member", { id: 4 }))
        .customerReferrals.create(createInput)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("allows member create for own assigned customers", async () => {
    mockCustomers({
      100: referrerCustomer,
      101: referredCustomer,
    });
    vi.spyOn(referralsDb, "findActiveReferralDuplicate").mockResolvedValue(null);
    vi.spyOn(referralsDb, "createCustomerReferral").mockResolvedValue(referralRow);

    await appRouter
      .createCaller(createCtx("member", { id: 4 }))
      .customerReferrals.create(createInput);
  });

  it("blocks inactive and resigned users", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "inactive" }))
        .customerReferrals.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .customerReferrals.summary()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("customerReferrals validation", () => {
  beforeEach(() => {
    mockCustomers({
      100: referrerCustomer,
      101: referredCustomer,
      102: outOfScopeCustomer,
    });
  });

  it("blocks self referral", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customerReferrals.create({
        ...createInput,
        referrerCustomerId: 100,
        referredCustomerId: 100,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks duplicate referral flows", async () => {
    vi.spyOn(referralsDb, "findActiveReferralDuplicate").mockResolvedValue(
      referralRow
    );
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerReferrals.create(createInput)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates relationshipId customer scope and type", async () => {
    vi.spyOn(relationshipsDb, "getCustomerRelationshipById").mockResolvedValue({
      ...referralRelationship,
      relationshipType: "family_spouse",
    });
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerReferrals.create(createInput)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks mismatched referrer/referred for outbound referral relationship", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customerReferrals.create({
        ...createInput,
        referrerCustomerId: 101,
        referredCustomerId: 100,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("changes referral stage", async () => {
    vi.spyOn(referralsDb, "getCustomerReferralById").mockResolvedValue(referralRow);
    vi.spyOn(referralsDb, "updateCustomerReferral").mockResolvedValue({
      ...referralRow,
      referralStage: "contacted",
      resultStatus: "in_progress",
      firstContactedAt: new Date(),
    });

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerReferrals.changeStage({
        id: 800,
        anchorCustomerId: 100,
        referralStage: "contacted",
      });
  });

  it("completes thank-you contact", async () => {
    vi.spyOn(referralsDb, "getCustomerReferralById").mockResolvedValue(referralRow);
    vi.spyOn(referralsDb, "updateCustomerReferral").mockResolvedValue({
      ...referralRow,
      thankYouStatus: "completed",
      thankYouCompletedAt: new Date(),
    });

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerReferrals.completeThankYou({
        id: 800,
        anchorCustomerId: 100,
      });
  });

  it("excludes soft-deleted referrals from list", async () => {
    vi.spyOn(referralsDb, "listCustomerReferrals").mockResolvedValue([]);
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerReferrals.list({});
    expect(result).toEqual([]);
  });

  it("does not store memo text in activity logs", async () => {
    vi.spyOn(referralsDb, "findActiveReferralDuplicate").mockResolvedValue(null);
    vi.spyOn(referralsDb, "createCustomerReferral").mockResolvedValue({
      ...referralRow,
      memo: "secret memo",
    });
    const logSpy = vi.spyOn(db, "createActivityLog");

    await appRouter.createCaller(createCtx("branch_admin")).customerReferrals.create({
      ...createInput,
      memo: "업무 메모",
    });

    const payload = logSpy.mock.calls[0]?.[0];
    const sanitized = String(
      sanitizeActivityLogDetailsForStorage(payload?.details ?? "")
    );
    expect(sanitized).not.toContain("secret memo");
    expect(sanitized).not.toContain("업무 메모");
    expect(sanitized).toContain("referralId");
  });

  it("rejects sensitive memo on create", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customerReferrals.create({
        ...createInput,
        memo: "010-1234-5678",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("customerReferrals summary and search", () => {
  it("returns scoped referral summary", async () => {
    vi.spyOn(referralsDb, "getReferralPerformanceSummary").mockResolvedValue({
      total: 2,
      byStage: { introduced: 1, contacted: 1 },
      byResultStatus: { in_progress: 2 },
      thankYouPending: 1,
      contracted: 0,
      inProgress: 2,
    });

    const summary = await appRouter
      .createCaller(createCtx("team_leader", { teamId: 10 }))
      .customerReferrals.summary();
    expect(summary.total).toBe(2);
  });

  it("scopes customer search through relationship picker", async () => {
    const searchSpy = vi
      .spyOn(referralsDb, "searchCustomersForReferral")
      .mockResolvedValue({
        items: [{ id: 101, name: "[TEST] Referred", consultStatus: "미상담" }],
        searchRequired: false,
        hint: null,
      });
    mockCustomers({ 100: referrerCustomer });

    const result = await appRouter
      .createCaller(createCtx("member", { id: 4 }))
      .customerReferrals.searchCustomers({
        anchorCustomerId: 100,
        search: "Referred",
      });
    expect(searchSpy).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });
});
