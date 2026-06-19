import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  customerReferrals,
  customers,
  type CustomerReferral,
  type InsertCustomerReferral,
} from "../drizzle/schema";
import type {
  ReferralResultStatus,
  ReferralStage,
  ThankYouStatus,
} from "@shared/customerReferrals";
import {
  defaultResultStatusForStage,
  stageTimestampField,
} from "@shared/customerReferrals";
import { getDb } from "./db";
import type { CustomerRelationshipUser } from "./customerReferralsAccess";
import { getHierarchyScopeUserIds } from "./routers";

export type ReferralListFilter = {
  referralStage?: ReferralStage;
  resultStatus?: ReferralResultStatus;
  thankYouStatus?: ThankYouStatus;
  limit?: number;
  offset?: number;
};

function isActiveReferral(row: CustomerReferral) {
  return row.deletedAt == null;
}

async function getScopedCustomerIdsForReferrals(
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
    const branchAgents = await db
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
    return branchAgents.map(row => row.id);
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

async function referralScopeCondition(user: CustomerRelationshipUser) {
  const scopedIds = await getScopedCustomerIdsForReferrals(user);
  if (scopedIds === null) return undefined;
  if (scopedIds.length === 0) return sql`1 = 0`;
  return and(
    inArray(customerReferrals.referrerCustomerId, scopedIds),
    inArray(customerReferrals.referredCustomerId, scopedIds)
  );
}

function buildListConditions(
  user: CustomerRelationshipUser,
  filter: ReferralListFilter
) {
  const conditions: any[] = [isNull(customerReferrals.deletedAt)];
  if (filter.referralStage) {
    conditions.push(eq(customerReferrals.referralStage, filter.referralStage));
  }
  if (filter.resultStatus) {
    conditions.push(eq(customerReferrals.resultStatus, filter.resultStatus));
  }
  if (filter.thankYouStatus) {
    conditions.push(eq(customerReferrals.thankYouStatus, filter.thankYouStatus));
  }
  return conditions;
}

export async function findActiveReferralDuplicate(
  relationshipId: number,
  referrerCustomerId: number,
  referredCustomerId: number,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(customerReferrals)
    .where(
      and(
        isNull(customerReferrals.deletedAt),
        or(
          eq(customerReferrals.relationshipId, relationshipId),
          and(
            eq(customerReferrals.referrerCustomerId, referrerCustomerId),
            eq(customerReferrals.referredCustomerId, referredCustomerId)
          )
        )
      )
    );
  return rows.find(row => row.id !== excludeId && isActiveReferral(row)) ?? null;
}

export async function getCustomerReferralById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(customerReferrals)
    .where(eq(customerReferrals.id, id))
    .limit(1);
  return row ?? null;
}

export async function listCustomerReferrals(
  user: CustomerRelationshipUser,
  filter: ReferralListFilter = {}
) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  const scope = await referralScopeCondition(user);
  const conditions = buildListConditions(user, filter);
  if (scope) conditions.push(scope);

  return db
    .select()
    .from(customerReferrals)
    .where(and(...conditions))
    .orderBy(desc(customerReferrals.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function listCustomerReferralsByCustomerId(
  user: CustomerRelationshipUser,
  customerId: number
) {
  const db = await getDb();
  if (!db) return [];
  const scope = await referralScopeCondition(user);
  const conditions = [
    isNull(customerReferrals.deletedAt),
    or(
      eq(customerReferrals.referrerCustomerId, customerId),
      eq(customerReferrals.referredCustomerId, customerId)
    ),
  ];
  if (scope) conditions.push(scope);

  return db
    .select()
    .from(customerReferrals)
    .where(and(...conditions))
    .orderBy(desc(customerReferrals.updatedAt));
}

export async function createCustomerReferral(data: InsertCustomerReferral) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const result = await db.insert(customerReferrals).values(data);
  return getCustomerReferralById(Number(result[0].insertId));
}

export async function updateCustomerReferral(
  id: number,
  data: Partial<
    Pick<
      InsertCustomerReferral,
      | "referralStage"
      | "referralSourceType"
      | "introductionMethod"
      | "thankYouStatus"
      | "thankYouCompletedAt"
      | "firstContactedAt"
      | "consultationStartedAt"
      | "proposalMadeAt"
      | "contractedAt"
      | "declinedAt"
      | "deferredUntil"
      | "resultStatus"
      | "memo"
      | "updatedBy"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.update(customerReferrals).set(data).where(eq(customerReferrals.id, id));
  return getCustomerReferralById(id);
}

export async function softDeleteCustomerReferral(id: number, updatedBy: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db
    .update(customerReferrals)
    .set({
      deletedAt: new Date(),
      resultStatus: "closed",
      updatedBy,
    })
    .where(eq(customerReferrals.id, id));
  return getCustomerReferralById(id);
}

export function buildStageUpdatePayload(
  nextStage: ReferralStage,
  existing: CustomerReferral,
  deferredUntil?: Date | null
) {
  const payload: Partial<InsertCustomerReferral> = {
    referralStage: nextStage,
    resultStatus: defaultResultStatusForStage(nextStage),
  };
  const timestampField = stageTimestampField(nextStage);
  if (timestampField && !existing[timestampField]) {
    payload[timestampField] = new Date();
  }
  if (nextStage === "deferred" && deferredUntil) {
    payload.deferredUntil = deferredUntil;
  }
  return payload;
}

export async function getReferralPerformanceSummary(
  user: CustomerRelationshipUser
) {
  const rows = await listCustomerReferrals(user, { limit: 500 });
  const byStage: Record<string, number> = {};
  const byResultStatus: Record<string, number> = {};
  let thankYouPending = 0;
  let contracted = 0;
  let inProgress = 0;

  for (const row of rows) {
    byStage[row.referralStage] = (byStage[row.referralStage] ?? 0) + 1;
    byResultStatus[row.resultStatus] =
      (byResultStatus[row.resultStatus] ?? 0) + 1;
    if (row.thankYouStatus === "pending") thankYouPending += 1;
    if (row.resultStatus === "contracted") contracted += 1;
    if (row.resultStatus === "in_progress") inProgress += 1;
  }

  return {
    total: rows.length,
    byStage,
    byResultStatus,
    thankYouPending,
    contracted,
    inProgress,
  };
}

export async function searchCustomersForReferral(
  user: CustomerRelationshipUser,
  search: string,
  limit: number,
  excludeCustomerId?: number
) {
  const { searchCustomersForRelationship } = await import(
    "./customerRelationshipsDb"
  );
  return searchCustomersForRelationship(
    user,
    search,
    limit,
    excludeCustomerId
  );
}
