import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  claimGuidanceCases,
  customers,
  type ClaimGuidanceCase,
  type InsertClaimGuidanceCase,
} from "../drizzle/schema";
import type {
  ClaimCustomerActionStatus,
  ClaimDocumentGuideStatus,
  ClaimGuidanceStatus,
  ClaimGuidanceType,
} from "@shared/claimGuidance";
import { isClaimGuidanceOpenStatus } from "@shared/claimGuidance";
import { getDb } from "./db";
import type { CustomerRelationshipUser } from "./claimGuidanceAccess";
import { getHierarchyScopeUserIds } from "./routers";

export type ClaimGuidanceListFilter = {
  guidanceType?: ClaimGuidanceType;
  guidanceStatus?: ClaimGuidanceStatus;
  documentGuideStatus?: ClaimDocumentGuideStatus;
  customerActionStatus?: ClaimCustomerActionStatus;
  limit?: number;
  offset?: number;
};

async function getScopedCustomerIds(
  user: CustomerRelationshipUser
): Promise<number[] | null> {
  const db = await getDb();
  if (!db) return [];
  if (user.role === "branch_admin") return null;

  const activeCustomer = and(
    eq(customers.isActive, true),
    isNull(customers.deletedAt)
  );

  if (user.role === "member") {
    const rows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(activeCustomer, eq(customers.agentId, user.id)));
    return rows.map(row => row.id);
  }

  if (user.role === "sub_branch_admin") {
    const rows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          activeCustomer,
          or(
            eq(customers.subBranchAdminId, user.id),
            eq(customers.agentId, user.id)
          )
        )
      );
    return rows.map(row => row.id);
  }

  const agentIds = await getHierarchyScopeUserIds(user);
  const scopeConditions = [];
  if (agentIds?.length) {
    scopeConditions.push(inArray(customers.agentId, agentIds));
  }
  if (user.teamId) {
    scopeConditions.push(eq(customers.assignedTeamId, user.teamId));
  }
  if (scopeConditions.length === 0) return [];
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(activeCustomer, or(...scopeConditions)));
  return rows.map(row => row.id);
}

async function customerScopeCondition(user: CustomerRelationshipUser) {
  const scopedIds = await getScopedCustomerIds(user);
  if (scopedIds === null) return undefined;
  if (scopedIds.length === 0) return sql`1 = 0`;
  return inArray(claimGuidanceCases.customerId, scopedIds);
}

function buildListConditions(filter: ClaimGuidanceListFilter) {
  const conditions: any[] = [isNull(claimGuidanceCases.deletedAt)];
  if (filter.guidanceType) {
    conditions.push(eq(claimGuidanceCases.guidanceType, filter.guidanceType));
  }
  if (filter.guidanceStatus) {
    conditions.push(
      eq(claimGuidanceCases.guidanceStatus, filter.guidanceStatus)
    );
  }
  if (filter.documentGuideStatus) {
    conditions.push(
      eq(claimGuidanceCases.documentGuideStatus, filter.documentGuideStatus)
    );
  }
  if (filter.customerActionStatus) {
    conditions.push(
      eq(claimGuidanceCases.customerActionStatus, filter.customerActionStatus)
    );
  }
  return conditions;
}

export async function getClaimGuidanceCaseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(claimGuidanceCases)
    .where(eq(claimGuidanceCases.id, id))
    .limit(1);
  return row ?? null;
}

export async function listClaimGuidanceCases(
  user: CustomerRelationshipUser,
  filter: ClaimGuidanceListFilter = {}
) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  const scope = await customerScopeCondition(user);
  const conditions = buildListConditions(filter);
  if (scope) conditions.push(scope);

  return db
    .select()
    .from(claimGuidanceCases)
    .where(and(...conditions))
    .orderBy(desc(claimGuidanceCases.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function listClaimGuidanceCasesByCustomerId(
  user: CustomerRelationshipUser,
  customerId: number
) {
  const db = await getDb();
  if (!db) return [];
  const scope = await customerScopeCondition(user);
  const conditions = [
    isNull(claimGuidanceCases.deletedAt),
    eq(claimGuidanceCases.customerId, customerId),
  ];
  if (scope) conditions.push(scope);

  return db
    .select()
    .from(claimGuidanceCases)
    .where(and(...conditions))
    .orderBy(desc(claimGuidanceCases.updatedAt));
}

export async function createClaimGuidanceCase(data: InsertClaimGuidanceCase) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const result = await db.insert(claimGuidanceCases).values(data);
  return getClaimGuidanceCaseById(Number(result[0].insertId));
}

export async function updateClaimGuidanceCase(
  id: number,
  data: Partial<
    Pick<
      InsertClaimGuidanceCase,
      | "contractId"
      | "guidanceType"
      | "guidanceStatus"
      | "documentGuideStatus"
      | "customerActionStatus"
      | "followUpId"
      | "nextFollowUpAt"
      | "closedAt"
      | "closedReason"
      | "memo"
      | "updatedBy"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db
    .update(claimGuidanceCases)
    .set(data)
    .where(eq(claimGuidanceCases.id, id));
  return getClaimGuidanceCaseById(id);
}

export async function softDeleteClaimGuidanceCase(
  id: number,
  updatedBy: number
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db
    .update(claimGuidanceCases)
    .set({
      deletedAt: new Date(),
      guidanceStatus: "closed",
      updatedBy,
    })
    .where(eq(claimGuidanceCases.id, id));
  return getClaimGuidanceCaseById(id);
}

export async function getClaimGuidanceSummary(user: CustomerRelationshipUser) {
  const rows = await listClaimGuidanceCases(user, { limit: 500 });
  const byGuidanceStatus: Record<string, number> = {};
  const byGuidanceType: Record<string, number> = {};
  let openCount = 0;
  let guidanceNeeded = 0;
  let additionalGuidanceNeeded = 0;
  let completed = 0;
  let closed = 0;
  let followUpScheduled = 0;

  const now = Date.now();
  for (const row of rows) {
    byGuidanceStatus[row.guidanceStatus] =
      (byGuidanceStatus[row.guidanceStatus] ?? 0) + 1;
    byGuidanceType[row.guidanceType] =
      (byGuidanceType[row.guidanceType] ?? 0) + 1;
    if (isClaimGuidanceOpenStatus(row.guidanceStatus)) openCount += 1;
    if (row.guidanceStatus === "guidance_needed") guidanceNeeded += 1;
    if (row.guidanceStatus === "additional_guidance_needed") {
      additionalGuidanceNeeded += 1;
    }
    if (row.guidanceStatus === "completed") completed += 1;
    if (row.guidanceStatus === "closed") closed += 1;
    if (
      row.nextFollowUpAt &&
      new Date(row.nextFollowUpAt).getTime() >= now &&
      isClaimGuidanceOpenStatus(row.guidanceStatus)
    ) {
      followUpScheduled += 1;
    }
  }

  return {
    total: rows.length,
    openCount,
    guidanceNeeded,
    additionalGuidanceNeeded,
    completed,
    closed,
    followUpScheduled,
    byGuidanceStatus,
    byGuidanceType,
  };
}
