import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as relationshipsDb from "./customerRelationshipsDb";
import * as relationshipsAccess from "./customerRelationshipsAccess";
import { sanitizeActivityLogDetailsForStorage } from "./activityLogRedaction";

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

const ownCustomer = {
  id: 100,
  name: "[TEST] Own",
  agentId: 4,
  assignedTeamId: 10,
  subBranchAdminId: 2,
  consultStatus: "미상담",
  isActive: true,
  deletedAt: null,
} as any;

const otherCustomer = {
  id: 101,
  name: "[TEST] Other",
  agentId: 99,
  assignedTeamId: 10,
  subBranchAdminId: 2,
  consultStatus: "미상담",
  isActive: true,
  deletedAt: null,
} as any;

const relationshipRow = {
  id: 500,
  primaryCustomerId: 100,
  relatedCustomerId: 101,
  relationshipType: "family_spouse",
  relationshipLabel: "배우자",
  direction: "mutual",
  note: "업무 메모",
  status: "active",
  createdBy: 1,
  updatedBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as any;

beforeEach(() => {
  vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
    if (id === 4) return { id: 4, name: "[TEST] Member", teamId: 10 } as any;
    if (id === 99)
      return { id: 99, name: "[TEST] Other Agent", teamId: 10 } as any;
    return undefined;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("customerRelationships RBAC", () => {
  it("allows branch_admin to create relationships across scope", async () => {
    vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) => {
      if (id === 100) return ownCustomer;
      if (id === 101) return otherCustomer;
      return undefined;
    });
    vi.spyOn(
      relationshipsDb,
      "findActiveRelationshipDuplicate"
    ).mockResolvedValue(null);
    const createSpy = vi
      .spyOn(relationshipsDb, "createCustomerRelationship")
      .mockResolvedValue(relationshipRow);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerRelationships.create({
        customerId: 100,
        relatedCustomerId: 101,
        relationshipType: "family_spouse",
      });

    expect(result.id).toBe(500);
    expect(createSpy).toHaveBeenCalled();
  });

  it("allows member to create only for own assigned customer anchor", async () => {
    vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) => {
      if (id === 100) return { ...ownCustomer, agentId: 4 };
      if (id === 101) return { ...otherCustomer, agentId: 4 };
      return undefined;
    });
    vi.spyOn(
      relationshipsDb,
      "findActiveRelationshipDuplicate"
    ).mockResolvedValue(null);
    const createSpy = vi
      .spyOn(relationshipsDb, "createCustomerRelationship")
      .mockResolvedValue(relationshipRow);

    await appRouter
      .createCaller(createCtx("member", { id: 4 }))
      .customerRelationships.create({
        customerId: 100,
        relatedCustomerId: 101,
        relationshipType: "referral",
      });
    expect(createSpy).toHaveBeenCalled();
  });

  it("blocks member when anchor customer is not theirs", async () => {
    vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) => {
      if (id === 100) return { ...ownCustomer, agentId: 99 };
      if (id === 101) return { ...otherCustomer, agentId: 99 };
      return undefined;
    });
    const createSpy = vi.spyOn(relationshipsDb, "createCustomerRelationship");

    await expect(
      appRouter
        .createCaller(createCtx("member", { id: 4 }))
        .customerRelationships.create({
          customerId: 100,
          relatedCustomerId: 101,
          relationshipType: "referral",
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks relationship creation when related customer is outside scope", async () => {
    vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) => {
      if (id === 100) return { ...ownCustomer, agentId: 4 };
      if (id === 101) return { ...otherCustomer, agentId: 99 };
      return undefined;
    });
    const createSpy = vi.spyOn(relationshipsDb, "createCustomerRelationship");

    await expect(
      appRouter
        .createCaller(createCtx("member", { id: 4 }))
        .customerRelationships.create({
          customerId: 100,
          relatedCustomerId: 101,
          relationshipType: "referral",
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks inactive and resigned users", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "inactive" }))
        .customerRelationships.list({ customerId: 100 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .customerRelationships.list({ customerId: 100 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("excludes relationships when related customer is outside user scope", async () => {
    vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) => {
      if (id === 100) return ownCustomer;
      if (id === 101) return otherCustomer;
      return undefined;
    });
    vi.spyOn(relationshipsAccess, "filterCustomerIdsInScope").mockResolvedValue(
      []
    );
    vi.spyOn(db, "getDb").mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([relationshipRow]),
          }),
        }),
      }),
    } as any);

    const result = await appRouter
      .createCaller(createCtx("member", { id: 4 }))
      .customerRelationships.list({ customerId: 100 });

    expect(result).toEqual([]);
  });
});

describe("customerRelationships validation", () => {
  beforeEach(() => {
    vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) => {
      if (id === 100) return ownCustomer;
      if (id === 101) return { ...otherCustomer, agentId: 4 };
      return undefined;
    });
  });

  it("blocks self relationship", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerRelationships.create({
          customerId: 100,
          relatedCustomerId: 100,
          relationshipType: "friend",
        })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks duplicate relationship type for the same pair", async () => {
    vi.spyOn(
      relationshipsDb,
      "findActiveRelationshipDuplicate"
    ).mockResolvedValue(relationshipRow);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerRelationships.create({
          customerId: 100,
          relatedCustomerId: 101,
          relationshipType: "family_spouse",
        })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("excludes soft-deleted relationships from list results", async () => {
    vi.spyOn(relationshipsDb, "listCustomerRelationships").mockResolvedValue(
      []
    );
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerRelationships.list({ customerId: 100 });
    expect(result).toEqual([]);
  });

  it("rejects sensitive note content on create", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerRelationships.create({
          customerId: 100,
          relatedCustomerId: 101,
          relationshipType: "family_spouse",
          note: "010-1234-5678 주민등록번호 포함",
        })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not store note or customer names in activity logs", async () => {
    vi.spyOn(
      relationshipsDb,
      "findActiveRelationshipDuplicate"
    ).mockResolvedValue(null);
    vi.spyOn(relationshipsDb, "createCustomerRelationship").mockResolvedValue(
      relationshipRow
    );
    const logSpy = vi.spyOn(db, "createActivityLog");

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerRelationships.create({
        customerId: 100,
        relatedCustomerId: 101,
        relationshipType: "family_spouse",
      });

    expect(logSpy).toHaveBeenCalled();
    const payload = logSpy.mock.calls[0]?.[0];
    const sanitized = String(
      sanitizeActivityLogDetailsForStorage(payload?.details ?? "")
    );
    expect(sanitized).not.toContain("업무 메모");
    expect(sanitized).not.toContain("[TEST]");
    expect(sanitized).not.toContain("note");
    expect(sanitized).toContain("relationshipType");
  });
});
