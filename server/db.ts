import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  assignmentHistory,
  consentLogs,
  consultations,
  contractHistory,
  contracts,
  customers,
  InsertActivityLog,
  InsertAssignmentHistory,
  InsertConsentLog,
  InsertConsultation,
  InsertContract,
  InsertContractHistory,
  InsertCustomer,
  InsertNotification,
  InsertSchedule,
  InsertStatusHistory,
  notifications,
  schedules,
  statusHistory,
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
export async function upsertUser(user: typeof users.$inferInsert): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: typeof users.$inferInsert = { openId: user.openId };
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
    values.role = "branch_admin";
    updateSet.role = "branch_admin";
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

export async function updateUserRole(id: number, role: "branch_admin" | "sub_branch_admin" | "team_leader" | "member") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserAccountStatus(id: number, accountStatus: "active" | "inactive" | "resigned") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ accountStatus }).where(eq(users.id, id));
}

export async function updateUserTeam(id: number, teamId: number | null) {
  const db = await getDb();
  if (!db) return;
  // 팀 이동 시 subBranchAdminId도 동기화 (조건 4)
  let subBranchAdminId: number | null = null;
  if (teamId !== null) {
    const team = await getTeamById(teamId);
    subBranchAdminId = team?.subBranchAdminId ?? null;
  }
  await db.update(users).set({ teamId, subBranchAdminId }).where(eq(users.id, id));
}

export async function updateUserSubBranchAdmin(id: number, subBranchAdminId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ subBranchAdminId }).where(eq(users.id, id));
}

// ─── Teams ───────────────────────────────────────────────────────────────────
export async function getAllTeams() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teams).where(eq(teams.isActive, true));
}

export async function getTeamById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  return result[0];
}

export async function createTeam(name: string, managerId?: number, subBranchAdminId?: number, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(teams).values({ name, managerId, subBranchAdminId, description });
}

export async function updateTeam(id: number, data: Partial<typeof teams.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(teams).set(data).where(eq(teams.id, id));
  // 팀의 subBranchAdminId 변경 시 소속 팀원들의 subBranchAdminId 일괄 갱신 (조건 4)
  if (data.subBranchAdminId !== undefined) {
    await db.update(users).set({ subBranchAdminId: data.subBranchAdminId }).where(eq(users.teamId, id));
  }
}

export async function deactivateTeam(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(teams).set({ isActive: false, deletedAt: new Date() }).where(eq(teams.id, id));
}

// ─── Customers ───────────────────────────────────────────────────────────────
/** 역할별 고객 목록 조회 */
export async function getCustomers(filter: {
  agentId?: number;
  teamId?: number;
  subBranchAdminId?: number;
  unassigned?: boolean;
  status?: string;
  includeInactive?: boolean;
  region?: string;
  source?: string;
  assignedDateFrom?: Date;
  assignedDateTo?: Date;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: ReturnType<typeof eq>[] = [];

  if (!filter.includeInactive) {
    conditions.push(eq(customers.isActive, true));
  }

  if (filter.agentId !== undefined) {
    conditions.push(eq(customers.agentId, filter.agentId));
  } else if (filter.unassigned) {
    conditions.push(isNull(customers.agentId));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db.select({ id: users.id }).from(users).where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    conditions.push(or(...agentIds.map((id) => eq(customers.agentId, id))) as any);
  } else if (filter.subBranchAdminId !== undefined) {
    conditions.push(eq(customers.subBranchAdminId, filter.subBranchAdminId));
  }

  if (filter.status) conditions.push(eq(customers.consultStatus, filter.status as any));
  if (filter.region) conditions.push(eq(customers.region, filter.region));
  if (filter.source) conditions.push(eq(customers.source, filter.source));
  if (filter.assignedDateFrom) conditions.push(gte(customers.assignedAt, filter.assignedDateFrom) as any);
  if (filter.assignedDateTo) conditions.push(lte(customers.assignedAt, filter.assignedDateTo) as any);

  return db.select().from(customers)
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
  await db.insert(customers).values({ ...data, isActive: true });
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function softDeleteCustomer(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set({ isActive: false, deletedAt: new Date() }).where(eq(customers.id, id));
}

export async function checkPhoneDuplicate(phone: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(customers)
    .where(and(eq(customers.phone, phone), eq(customers.isActive, true)))
    .limit(1);
  const found = result[0];
  if (!found) return null;
  if (excludeId && found.id === excludeId) return null;
  return found;
}

/** 지점장이 부지점장에게 DB 배분 */
export async function assignCustomerToSubBranch(customerId: number, subBranchAdminId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set({
    subBranchAdminId,
    assignmentStatus: "assigned_to_sub_branch",
    assignedAt: new Date(),
  }).where(eq(customers.id, customerId));
}

/** 최종 팀원 배정 */
export async function assignCustomer(customerId: number, agentId: number, teamId?: number, subBranchAdminId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set({
    agentId,
    assignedTeamId: teamId ?? null,
    subBranchAdminId: subBranchAdminId ?? null,
    assignedAt: new Date(),
    assignmentStatus: "assigned_to_agent",
  }).where(eq(customers.id, customerId));
}

// ─── Status History ───────────────────────────────────────────────────────────
export async function createStatusHistory(data: InsertStatusHistory) {
  const db = await getDb();
  if (!db) return;
  await db.insert(statusHistory).values(data);
}

export async function getStatusHistory(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(statusHistory).where(eq(statusHistory.customerId, customerId)).orderBy(desc(statusHistory.createdAt));
}

// ─── Consent Logs ─────────────────────────────────────────────────────────────
export async function createConsentLog(data: InsertConsentLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(consentLogs).values(data);
}

export async function getConsentLogs(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consentLogs).where(eq(consentLogs.customerId, customerId)).orderBy(desc(consentLogs.createdAt));
}

// ─── Consultations ────────────────────────────────────────────────────────────
export async function getConsultationsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consultations)
    .where(and(eq(consultations.customerId, customerId), eq(consultations.isActive, true)))
    .orderBy(desc(consultations.createdAt));
}

export async function getConsultationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(consultations).where(eq(consultations.id, id)).limit(1);
  return result[0];
}

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) return;
  await db.insert(consultations).values({ ...data, isActive: true });
  await db.update(customers).set({ consultStatus: data.status }).where(eq(customers.id, data.customerId));
}

export async function updateConsultation(id: number, data: { content?: string; status?: typeof consultations.$inferSelect["status"]; nextContactAt?: Date | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(consultations).set(data).where(eq(consultations.id, id));
}

// ─── Contracts ────────────────────────────────────────────────────────────────
export async function getContractsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contracts)
    .where(and(eq(contracts.customerId, customerId), eq(contracts.isActive, true)))
    .orderBy(desc(contracts.createdAt));
}

export async function getAllContracts(filter: { agentId?: number; teamId?: number; subBranchAdminId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const baseCondition = eq(contracts.isActive, true);
  if (filter.agentId !== undefined) {
    return db.select().from(contracts).where(and(baseCondition, eq(contracts.agentId, filter.agentId))).orderBy(desc(contracts.createdAt));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db.select({ id: users.id }).from(users).where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    return db.select().from(contracts).where(and(baseCondition, or(...agentIds.map((id) => eq(contracts.agentId, id))))).orderBy(desc(contracts.createdAt));
  } else if (filter.subBranchAdminId !== undefined) {
    // 부지점장 산하 팀원들의 계약
    const subAgents = await db.select({ id: users.id }).from(users).where(eq(users.subBranchAdminId, filter.subBranchAdminId));
    const agentIds = subAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    return db.select().from(contracts).where(and(baseCondition, or(...agentIds.map((id) => eq(contracts.agentId, id))))).orderBy(desc(contracts.createdAt));
  }
  return db.select().from(contracts).where(baseCondition).orderBy(desc(contracts.createdAt));
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) return;
  await db.insert(contracts).values({ ...data, isActive: true });
}

export async function updateContract(id: number, data: Partial<InsertContract>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contracts).set(data).where(eq(contracts.id, id));
}

export async function deactivateContract(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contracts).set({ isActive: false, deletedAt: new Date() }).where(eq(contracts.id, id));
}

export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return result[0];
}

// ─── Contract History ─────────────────────────────────────────────────────────
export async function createContractHistoryEntry(data: InsertContractHistory) {
  const db = await getDb();
  if (!db) return;
  await db.insert(contractHistory).values(data);
}

export async function getContractHistory(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contractHistory).where(eq(contractHistory.contractId, contractId)).orderBy(desc(contractHistory.createdAt));
}

// ─── Schedules ────────────────────────────────────────────────────────────────
export async function getSchedules(filter: { userId?: number; teamId?: number; subBranchAdminId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const baseCondition = eq(schedules.isActive, true);
  if (filter.userId !== undefined) {
    return db.select().from(schedules).where(and(baseCondition, eq(schedules.userId, filter.userId))).orderBy(schedules.startTime);
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db.select({ id: users.id }).from(users).where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    return db.select().from(schedules).where(and(baseCondition, or(...agentIds.map((id) => eq(schedules.userId, id))))).orderBy(schedules.startTime);
  } else if (filter.subBranchAdminId !== undefined) {
    const subAgents = await db.select({ id: users.id }).from(users).where(eq(users.subBranchAdminId, filter.subBranchAdminId));
    const agentIds = subAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    return db.select().from(schedules).where(and(baseCondition, or(...agentIds.map((id) => eq(schedules.userId, id))))).orderBy(schedules.startTime);
  }
  return db.select().from(schedules).where(baseCondition).orderBy(schedules.startTime);
}

export async function createSchedule(data: InsertSchedule) {
  const db = await getDb();
  if (!db) return;
  await db.insert(schedules).values({ ...data, isActive: true });
}

export async function updateSchedule(id: number, data: Partial<InsertSchedule>) {
  const db = await getDb();
  if (!db) return;
  await db.update(schedules).set(data).where(eq(schedules.id, id));
}

export async function softDeleteSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(schedules).set({ isActive: false, deletedAt: new Date(), status: "취소" }).where(eq(schedules.id, id));
}

export async function completeSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(schedules).set({ status: "완료", completedAt: new Date() }).where(eq(schedules.id, id));
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function getUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications)
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
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function updateNotificationProcessStatus(id: number, processStatus: "미확인" | "확인" | "처리완료" | "보류") {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ processStatus, isRead: processStatus !== "미확인" }).where(eq(notifications.id, id));
}

// ─── Assignment History ───────────────────────────────────────────────────────
export async function createAssignmentHistory(data: InsertAssignmentHistory) {
  const db = await getDb();
  if (!db) return;
  await db.insert(assignmentHistory).values(data);
}

export async function getAssignmentHistory(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assignmentHistory).where(eq(assignmentHistory.customerId, customerId)).orderBy(desc(assignmentHistory.createdAt));
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(limit = 500, subBranchAdminId?: number, teamId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (subBranchAdminId !== undefined) {
    // 부지점장: 본인 산하 팀원들의 로그만
    const subAgents = await db.select({ id: users.id }).from(users).where(eq(users.subBranchAdminId, subBranchAdminId));
    const agentIds = subAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    return db.select().from(activityLogs)
      .where(or(...agentIds.map((id) => eq(activityLogs.userId, id))))
      .orderBy(desc(activityLogs.createdAt)).limit(limit);
  } else if (teamId !== undefined) {
    // 팀장: 본인 팀원들의 로그만
    const teamAgents = await db.select({ id: users.id }).from(users).where(eq(users.teamId, teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length === 0) return [];
    return db.select().from(activityLogs)
      .where(or(...agentIds.map((id) => eq(activityLogs.userId, id))))
      .orderBy(desc(activityLogs.createdAt)).limit(limit);
  }

  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

// ─── Performance Stats ────────────────────────────────────────────────────────
export async function getPerformanceStats(filter: {
  agentId?: number;
  teamId?: number;
  subBranchAdminId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = await getDb();
  if (!db) return null;

  let customerList: typeof customers.$inferSelect[] = [];
  let contractList: typeof contracts.$inferSelect[] = [];

  const activeCondition = eq(customers.isActive, true);
  const activeContractCondition = eq(contracts.isActive, true);

  // 기간 필터 조건 (contracts.contractDate 기준)
  const dateConditions: any[] = [activeContractCondition];
  if (filter.dateFrom) dateConditions.push(gte(contracts.contractDate, filter.dateFrom as any));
  if (filter.dateTo) dateConditions.push(lte(contracts.contractDate, filter.dateTo as any));

  if (filter.agentId !== undefined) {
    customerList = await db.select().from(customers).where(and(eq(customers.agentId, filter.agentId), activeCondition));
    contractList = await db.select().from(contracts).where(and(eq(contracts.agentId, filter.agentId), ...dateConditions));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db.select({ id: users.id }).from(users).where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map((u) => u.id);
    if (agentIds.length > 0) {
      customerList = await db.select().from(customers).where(and(or(...agentIds.map((id) => eq(customers.agentId, id))), activeCondition));
      contractList = await db.select().from(contracts).where(and(or(...agentIds.map((id) => eq(contracts.agentId, id))), ...dateConditions));
    }
  } else if (filter.subBranchAdminId !== undefined) {
    const subAgents = await db.select({ id: users.id }).from(users).where(eq(users.subBranchAdminId, filter.subBranchAdminId));
    const agentIds = subAgents.map((u) => u.id);
    if (agentIds.length > 0) {
      customerList = await db.select().from(customers).where(and(or(...agentIds.map((id) => eq(customers.agentId, id))), activeCondition));
      contractList = await db.select().from(contracts).where(and(or(...agentIds.map((id) => eq(contracts.agentId, id))), ...dateConditions));
    }
  } else {
    customerList = await db.select().from(customers).where(activeCondition);
    contractList = await db.select().from(contracts).where(and(...dateConditions));
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
  const canceledContracts = contractList.filter((c) => c.contractStatus === "해지" || c.paymentStatus === "실효");
  const monthlyPremiumSum = activeContracts.reduce((sum, c) => sum + (c.monthlyPremium ?? 0), 0);

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
