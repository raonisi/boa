import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  consultations,
  contracts,
  customers,
  InsertActivityLog,
  InsertConsultation,
  InsertContract,
  InsertCustomer,
  InsertNotification,
  InsertSchedule,
  InsertUser,
  notifications,
  schedules,
  teams,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUserRole(id: number, role: "admin" | "manager" | "agent" | "inactive") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserTeam(id: number, teamId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ teamId }).where(eq(users.id, id));
}

// ─── Teams ───────────────────────────────────────────────────────────────────
export async function getAllTeams() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teams);
}

export async function createTeam(name: string, managerId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(teams).values({ name, managerId });
}

// ─── Customers ───────────────────────────────────────────────────────────────
export async function getCustomers(filter: {
  agentId?: number;
  teamId?: number;
  unassigned?: boolean;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filter.agentId !== undefined) {
    conditions.push(eq(customers.agentId, filter.agentId));
  } else if (filter.unassigned) {
    conditions.push(isNull(customers.agentId));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    conditions.push(
      or(...agentIds.map((id) => eq(customers.agentId, id)))
    );
  }
  if (filter.status) {
    conditions.push(eq(customers.consultStatus, filter.status as any));
  }

  return db
    .select()
    .from(customers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(customers.createdAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) return;
  await db.insert(customers).values(data);
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function assignCustomer(customerId: number, agentId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customers)
    .set({ agentId, assignedAt: new Date() })
    .where(eq(customers.id, customerId));
}

// ─── Consultations ────────────────────────────────────────────────────────────
export async function getConsultationsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(consultations)
    .where(eq(consultations.customerId, customerId))
    .orderBy(desc(consultations.createdAt));
}

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) return;
  await db.insert(consultations).values(data);
  // Update customer status
  await db
    .update(customers)
    .set({ consultStatus: data.status })
    .where(eq(customers.id, data.customerId));
}

// ─── Contracts ────────────────────────────────────────────────────────────────
export async function getContractsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contracts)
    .where(eq(contracts.customerId, customerId))
    .orderBy(desc(contracts.createdAt));
}

export async function getAllContracts(filter: { agentId?: number; teamId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filter.agentId !== undefined) {
    conditions.push(eq(contracts.agentId, filter.agentId));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    conditions.push(or(...agentIds.map((id) => eq(contracts.agentId, id))));
  }

  return db
    .select()
    .from(contracts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contracts.createdAt));
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) return;
  await db.insert(contracts).values(data);
}

export async function updateContract(id: number, data: Partial<InsertContract>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contracts).set(data).where(eq(contracts.id, id));
}

// ─── Schedules ────────────────────────────────────────────────────────────────
export async function getSchedules(filter: { userId?: number; teamId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filter.userId !== undefined) {
    conditions.push(eq(schedules.userId, filter.userId));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    conditions.push(or(...agentIds.map((id) => eq(schedules.userId, id))));
  }

  return db
    .select()
    .from(schedules)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schedules.startTime);
}

export async function createSchedule(data: InsertSchedule) {
  const db = await getDb();
  if (!db) return;
  await db.insert(schedules).values(data);
}

export async function updateSchedule(id: number, data: Partial<InsertSchedule>) {
  const db = await getDb();
  if (!db) return;
  await db.update(schedules).set(data).where(eq(schedules.id, id));
}

export async function deleteSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(schedules).where(eq(schedules.id, id));
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function getUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(activityLogs)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// ─── Performance Stats ────────────────────────────────────────────────────────
export async function getPerformanceStats(filter: { agentId?: number; teamId?: number }) {
  const db = await getDb();
  if (!db) return null;

  let customerList: typeof customers.$inferSelect[] = [];
  let contractList: typeof contracts.$inferSelect[] = [];

  if (filter.agentId !== undefined) {
    customerList = await db
      .select()
      .from(customers)
      .where(eq(customers.agentId, filter.agentId));
    contractList = await db
      .select()
      .from(contracts)
      .where(eq(contracts.agentId, filter.agentId));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length > 0) {
      customerList = await db
        .select()
        .from(customers)
        .where(or(...agentIds.map((id) => eq(customers.agentId, id))));
      contractList = await db
        .select()
        .from(contracts)
        .where(or(...agentIds.map((id) => eq(contracts.agentId, id))));
    }
  } else {
    customerList = await db.select().from(customers);
    contractList = await db.select().from(contracts);
  }

  const total = customerList.length;
  const statusCount = (s: string) => customerList.filter((c) => c.consultStatus === s).length;

  const assigned = total;
  const uncontacted = statusCount("미상담");
  const absent = statusCount("부재");
  const called = statusCount("통화완료");
  const scheduled = statusCount("상담예정");
  const designing = statusCount("설계중");
  const contracted = statusCount("계약");
  const held = statusCount("보류");
  const rejected = statusCount("거절");

  const activeContracts = contractList.filter((c) => c.contractStatus === "유지");
  const canceledContracts = contractList.filter(
    (c) => c.contractStatus === "해지" || c.paymentStatus === "실효"
  );
  const monthlyPremiumSum = activeContracts.reduce(
    (sum, c) => sum + (c.monthlyPremium ?? 0),
    0
  );

  return {
    assigned,
    uncontacted,
    absent,
    called,
    scheduled,
    designing,
    contracted,
    monthlyPremiumSum,
    consultRate: total > 0 ? Math.round(((total - uncontacted) / total) * 100) : 0,
    contractRate: total > 0 ? Math.round((contracted / total) * 100) : 0,
    absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
    heldRejectedRate: total > 0 ? Math.round(((held + rejected) / total) * 100) : 0,
    activeContracts: activeContracts.length,
    canceledContracts: canceledContracts.length,
  };
}
