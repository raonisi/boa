import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  consultations,
  customerRelationships,
  customers,
  followUps,
  users,
  type Customer,
  type CustomerRelationship,
  type InsertCustomerRelationship,
} from "../drizzle/schema";
import {
  displayRelationshipLabelForViewer,
  normalizeCustomerPair,
  type CustomerRelationshipType,
} from "@shared/customerRelationships";
import { filterCustomerIdsInScope } from "./customerRelationshipsAccess";
import { getDb, getCustomers, getUserById } from "./db";
import type { CustomerRelationshipUser } from "./customerRelationshipsAccess";

export type CustomerRelationshipListItem = {
  id: number;
  relationshipType: CustomerRelationshipType;
  relationshipLabel: string;
  direction: CustomerRelationship["direction"];
  note: string | null;
  status: CustomerRelationship["status"];
  relatedCustomer: {
    id: number;
    name: string;
    consultStatus: string;
    agentId: number | null;
    agentName: string | null;
    lastConsultedAt: string | null;
    nextContactDate: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
};

function isActiveRelationship(row: CustomerRelationship) {
  return row.deletedAt == null && row.status === "active";
}

export async function findActiveRelationshipDuplicate(
  primaryCustomerId: number,
  relatedCustomerId: number,
  relationshipType: CustomerRelationshipType,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return null;
  const [lo, hi] = normalizeCustomerPair(
    primaryCustomerId,
    relatedCustomerId
  );
  const rows = await db
    .select()
    .from(customerRelationships)
    .where(
      and(
        isNull(customerRelationships.deletedAt),
        eq(customerRelationships.relationshipType, relationshipType),
        or(
          and(
            eq(customerRelationships.primaryCustomerId, primaryCustomerId),
            eq(customerRelationships.relatedCustomerId, relatedCustomerId)
          ),
          and(
            eq(customerRelationships.primaryCustomerId, relatedCustomerId),
            eq(customerRelationships.relatedCustomerId, primaryCustomerId)
          ),
          and(
            eq(customerRelationships.primaryCustomerId, lo),
            eq(customerRelationships.relatedCustomerId, hi)
          )
        )
      )
    );
  return (
    rows.find(row => row.id !== excludeId && isActiveRelationship(row)) ?? null
  );
}

async function loadRelatedCustomerContext(
  customer: Customer,
  agentName: string | null,
  lastConsultedAt: Date | null,
  nextContactDate: Date | null
) {
  return {
    id: customer.id,
    name: customer.name,
    consultStatus: customer.consultStatus,
    agentId: customer.agentId,
    agentName,
    lastConsultedAt: lastConsultedAt?.toISOString() ?? null,
    nextContactDate: nextContactDate?.toISOString() ?? null,
  };
}

async function enrichRelationshipRows(
  rows: CustomerRelationship[],
  viewingCustomerId: number,
  user: CustomerRelationshipUser
): Promise<CustomerRelationshipListItem[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  if (!db) return [];

  const relatedIds = Array.from(
    new Set(
      rows.flatMap(row =>
        row.primaryCustomerId === viewingCustomerId
          ? [row.relatedCustomerId]
          : [row.primaryCustomerId]
      )
    )
  );

  const scopedRelatedIds = new Set(
    await filterCustomerIdsInScope(user, relatedIds)
  );
  const visibleRelatedIds = relatedIds.filter(id => scopedRelatedIds.has(id));
  if (visibleRelatedIds.length === 0) return [];

  const [customerRows, consultationRows, followUpRows, userRows] =
    await Promise.all([
      db
        .select()
        .from(customers)
        .where(inArray(customers.id, visibleRelatedIds)),
      db
        .select({
          customerId: consultations.customerId,
          createdAt: consultations.createdAt,
        })
        .from(consultations)
        .where(
          and(
            inArray(consultations.customerId, visibleRelatedIds),
            eq(consultations.isActive, true)
          )
        )
        .orderBy(desc(consultations.createdAt)),
      db
        .select({
          customerId: followUps.customerId,
          nextContactDate: followUps.nextContactDate,
        })
        .from(followUps)
        .where(
          and(
            inArray(followUps.customerId, visibleRelatedIds),
            eq(followUps.status, "scheduled")
          )
        )
        .orderBy(followUps.nextContactDate),
      db.select({ id: users.id, name: users.name }).from(users),
    ]);

  const customerMap = new Map(customerRows.map(row => [row.id, row]));
  const userMap = new Map(userRows.map(row => [row.id, row.name]));
  const lastConsultMap = new Map<number, Date>();
  for (const row of consultationRows) {
    if (!lastConsultMap.has(row.customerId)) {
      lastConsultMap.set(row.customerId, row.createdAt);
    }
  }
  const nextContactMap = new Map<number, Date>();
  for (const row of followUpRows) {
    if (!nextContactMap.has(row.customerId) && row.nextContactDate) {
      nextContactMap.set(row.customerId, row.nextContactDate);
    }
  }

  const items: CustomerRelationshipListItem[] = [];
  for (const row of rows) {
    if (!isActiveRelationship(row)) continue;
    const otherId =
      row.primaryCustomerId === viewingCustomerId
        ? row.relatedCustomerId
        : row.primaryCustomerId;
    if (!scopedRelatedIds.has(otherId)) continue;
    const other = customerMap.get(otherId);
    if (!other || other.isActive === false || other.deletedAt) continue;
    items.push({
      id: row.id,
      relationshipType: row.relationshipType as CustomerRelationshipType,
      relationshipLabel: displayRelationshipLabelForViewer(
        row.relationshipType as CustomerRelationshipType,
        row.direction,
        row.relationshipLabel,
        viewingCustomerId,
        row.primaryCustomerId
      ),
      direction: row.direction,
      note: row.note,
      status: row.status,
      relatedCustomer: await loadRelatedCustomerContext(
        other,
        other.agentId ? (userMap.get(other.agentId) ?? null) : null,
        lastConsultMap.get(other.id) ?? null,
        nextContactMap.get(other.id) ?? null
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  return items;
}

export async function listCustomerRelationships(
  viewingCustomerId: number,
  user: CustomerRelationshipUser
): Promise<CustomerRelationshipListItem[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(customerRelationships)
    .where(
      and(
        isNull(customerRelationships.deletedAt),
        or(
          eq(customerRelationships.primaryCustomerId, viewingCustomerId),
          eq(customerRelationships.relatedCustomerId, viewingCustomerId)
        )
      )
    )
    .orderBy(desc(customerRelationships.updatedAt));
  return enrichRelationshipRows(rows, viewingCustomerId, user);
}

export async function getCustomerRelationshipById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(customerRelationships)
    .where(eq(customerRelationships.id, id))
    .limit(1);
  return row ?? null;
}

export async function createCustomerRelationship(
  data: InsertCustomerRelationship
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const result = await db.insert(customerRelationships).values(data);
  const insertId = Number(result[0].insertId);
  return getCustomerRelationshipById(insertId);
}

export async function updateCustomerRelationship(
  id: number,
  data: Partial<
    Pick<
      InsertCustomerRelationship,
      | "relationshipType"
      | "relationshipLabel"
      | "direction"
      | "note"
      | "status"
      | "updatedBy"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db
    .update(customerRelationships)
    .set(data)
    .where(eq(customerRelationships.id, id));
  return getCustomerRelationshipById(id);
}

export async function softDeleteCustomerRelationship(
  id: number,
  updatedBy: number
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db
    .update(customerRelationships)
    .set({
      status: "inactive",
      deletedAt: new Date(),
      updatedBy,
    })
    .where(eq(customerRelationships.id, id));
  return getCustomerRelationshipById(id);
}

export async function searchCustomersForRelationship(
  user: CustomerRelationshipUser,
  search: string,
  limit: number,
  excludeCustomerId?: number
) {
  const trimmed = search.trim();
  if (trimmed.length < 2) {
    return { items: [], searchRequired: true, hint: "2자 이상 입력해 주세요." };
  }

  const scopedLimit = Math.min(Math.max(limit, 1), 20);
  let rows: Customer[] = [];
  const baseFilter = { search: trimmed, limit: scopedLimit + 1 };

  if (user.role === "branch_admin") {
    rows = await getCustomers(baseFilter);
  } else if (user.role === "sub_branch_admin") {
    rows = await getCustomers({ ...baseFilter, subBranchAdminId: user.id });
  } else if (user.role === "team_leader" && user.teamId) {
    rows = await getCustomers({ ...baseFilter, teamId: user.teamId });
  } else if (user.role === "team_leader") {
    const { getHierarchyScopeUserIds } = await import("./routers");
    const agentIds = await getHierarchyScopeUserIds(user);
    rows = await getCustomers({ ...baseFilter, agentIds: agentIds ?? [user.id] });
  } else {
    rows = await getCustomers({ ...baseFilter, agentId: user.id });
  }

  const filtered = rows
    .filter(row => row.id !== excludeCustomerId)
    .slice(0, scopedLimit)
    .map(row => ({
      id: row.id,
      name: row.name,
      consultStatus: row.consultStatus,
      agentId: row.agentId,
    }));

  return {
    items: filtered,
    searchRequired: false,
    hint:
      rows.length > scopedLimit
        ? "검색어를 더 구체적으로 입력해 주세요."
        : null,
  };
}

export async function getCustomerRelationFlags(customerIds: number[]) {
  const db = await getDb();
  if (!db || customerIds.length === 0) return {} as Record<number, boolean>;
  const uniqueIds = Array.from(new Set(customerIds));
  const rows = await db
    .select({
      primaryCustomerId: customerRelationships.primaryCustomerId,
      relatedCustomerId: customerRelationships.relatedCustomerId,
    })
    .from(customerRelationships)
    .where(
      and(
        isNull(customerRelationships.deletedAt),
        eq(customerRelationships.status, "active"),
        or(
          inArray(customerRelationships.primaryCustomerId, uniqueIds),
          inArray(customerRelationships.relatedCustomerId, uniqueIds)
        )
      )
    );

  const flags: Record<number, boolean> = {};
  for (const id of uniqueIds) flags[id] = false;
  for (const row of rows) {
    if (uniqueIds.includes(row.primaryCustomerId)) {
      flags[row.primaryCustomerId] = true;
    }
    if (uniqueIds.includes(row.relatedCustomerId)) {
      flags[row.relatedCustomerId] = true;
    }
  }
  return flags;
}

export function buildRelationshipActivityMetadata(
  relationship: Pick<
    CustomerRelationship,
    "id" | "relationshipType" | "relationshipLabel" | "status" | "direction"
  >
) {
  return {
    relationshipId: relationship.id,
    relationshipType: relationship.relationshipType,
    relationshipLabel: relationship.relationshipLabel,
    direction: relationship.direction,
    status: relationship.status,
  };
}

export async function listRelationshipTimelineRows(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customerRelationships)
    .where(
      or(
        eq(customerRelationships.primaryCustomerId, customerId),
        eq(customerRelationships.relatedCustomerId, customerId)
      )
    )
    .orderBy(desc(customerRelationships.updatedAt))
    .limit(100);
}
