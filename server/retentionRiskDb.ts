import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import {
  customers,
  retentionRiskCases,
  type InsertRetentionRiskCase,
  type RetentionRiskCase,
} from "../drizzle/schema";
import type {
  CustomerSentiment,
  ResolutionResult,
  ResponseStrategy,
  RetentionRiskLevel,
  RetentionRiskReason,
  RetentionStatus,
} from "@shared/retentionRisk";
import {
  isRetentionRiskOpenStatus,
  TERMINAL_RETENTION_STATUSES,
} from "@shared/retentionRisk";
import { getDb } from "./db";
import type { CustomerRelationshipUser } from "./retentionRiskAccess";
import { getHierarchyScopeUserIds } from "./routers";

export type RetentionRiskListFilter = {
  riskReason?: RetentionRiskReason;
  riskLevel?: RetentionRiskLevel;
  retentionStatus?: RetentionStatus;
  responseStrategy?: ResponseStrategy;
  customerSentiment?: CustomerSentiment;
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
  return inArray(retentionRiskCases.customerId, scopedIds);
}

function buildListConditions(filter: RetentionRiskListFilter) {
  const conditions: any[] = [isNull(retentionRiskCases.deletedAt)];
  if (filter.riskReason) {
    conditions.push(eq(retentionRiskCases.riskReason, filter.riskReason));
  }
  if (filter.riskLevel) {
    conditions.push(eq(retentionRiskCases.riskLevel, filter.riskLevel));
  }
  if (filter.retentionStatus) {
    conditions.push(
      eq(retentionRiskCases.retentionStatus, filter.retentionStatus)
    );
  }
  if (filter.responseStrategy) {
    conditions.push(
      eq(retentionRiskCases.responseStrategy, filter.responseStrategy)
    );
  }
  if (filter.customerSentiment) {
    conditions.push(
      eq(retentionRiskCases.customerSentiment, filter.customerSentiment)
    );
  }
  return conditions;
}

export async function findActiveRetentionRiskCase(
  customerId: number,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(retentionRiskCases)
    .where(
      and(
        isNull(retentionRiskCases.deletedAt),
        eq(retentionRiskCases.customerId, customerId),
        notInArray(retentionRiskCases.retentionStatus, TERMINAL_RETENTION_STATUSES)
      )
    );
  return rows.find(row => row.id !== excludeId) ?? null;
}

export async function getRetentionRiskCaseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(retentionRiskCases)
    .where(eq(retentionRiskCases.id, id))
    .limit(1);
  return row ?? null;
}

export async function listRetentionRiskCases(
  user: CustomerRelationshipUser,
  filter: RetentionRiskListFilter = {}
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
    .from(retentionRiskCases)
    .where(and(...conditions))
    .orderBy(desc(retentionRiskCases.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function listRetentionRiskCasesByCustomerId(
  user: CustomerRelationshipUser,
  customerId: number
) {
  const db = await getDb();
  if (!db) return [];
  const scope = await customerScopeCondition(user);
  const conditions = [
    isNull(retentionRiskCases.deletedAt),
    eq(retentionRiskCases.customerId, customerId),
  ];
  if (scope) conditions.push(scope);

  return db
    .select()
    .from(retentionRiskCases)
    .where(and(...conditions))
    .orderBy(desc(retentionRiskCases.updatedAt));
}

export async function createRetentionRiskCase(data: InsertRetentionRiskCase) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const result = await db.insert(retentionRiskCases).values(data);
  return getRetentionRiskCaseById(Number(result[0].insertId));
}

export async function updateRetentionRiskCase(
  id: number,
  data: Partial<
    Pick<
      InsertRetentionRiskCase,
      | "contractId"
      | "riskReason"
      | "riskLevel"
      | "retentionStatus"
      | "responseStrategy"
      | "customerSentiment"
      | "financialPressureLevel"
      | "competitorMentioned"
      | "followUpId"
      | "nextFollowUpAt"
      | "resolvedAt"
      | "resolutionResult"
      | "memo"
      | "updatedBy"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.update(retentionRiskCases).set(data).where(eq(retentionRiskCases.id, id));
  return getRetentionRiskCaseById(id);
}

export async function softDeleteRetentionRiskCase(id: number, updatedBy: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db
    .update(retentionRiskCases)
    .set({
      deletedAt: new Date(),
      retentionStatus: "closed",
      updatedBy,
    })
    .where(eq(retentionRiskCases.id, id));
  return getRetentionRiskCaseById(id);
}

export async function getRetentionRiskSummary(user: CustomerRelationshipUser) {
  const rows = await listRetentionRiskCases(user, { limit: 500 });
  const byRiskLevel: Record<string, number> = {};
  const byRetentionStatus: Record<string, number> = {};
  const byRiskReason: Record<string, number> = {};
  let openCount = 0;
  let criticalCount = 0;
  let highCount = 0;
  let waitingCustomer = 0;
  let followUpScheduled = 0;
  let resolvedCount = 0;

  const now = Date.now();
  for (const row of rows) {
    byRiskLevel[row.riskLevel] = (byRiskLevel[row.riskLevel] ?? 0) + 1;
    byRetentionStatus[row.retentionStatus] =
      (byRetentionStatus[row.retentionStatus] ?? 0) + 1;
    byRiskReason[row.riskReason] = (byRiskReason[row.riskReason] ?? 0) + 1;
    if (isRetentionRiskOpenStatus(row.retentionStatus)) openCount += 1;
    if (row.riskLevel === "critical") criticalCount += 1;
    if (row.riskLevel === "high") highCount += 1;
    if (row.retentionStatus === "waiting_customer") waitingCustomer += 1;
    if (row.resolvedAt) resolvedCount += 1;
    if (
      row.nextFollowUpAt &&
      new Date(row.nextFollowUpAt).getTime() >= now &&
      isRetentionRiskOpenStatus(row.retentionStatus)
    ) {
      followUpScheduled += 1;
    }
  }

  return {
    total: rows.length,
    openCount,
    criticalCount,
    highCount,
    waitingCustomer,
    followUpScheduled,
    resolvedCount,
    byRiskLevel,
    byRetentionStatus,
    byRiskReason,
  };
}
