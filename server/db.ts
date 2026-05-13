import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  assignmentHistory,
  consentLogs,
  consultations,
  contractHistory,
  contracts,
  customers,
  deleteRequests,
  followUps,
  handoffHistories,
  importBatches,
  InsertActivityLog,
  InsertAssignmentHistory,
  InsertConsentLog,
  InsertConsultation,
  InsertContract,
  InsertContractHistory,
  InsertCustomer,
  InsertDeleteRequest,
  InsertFollowUp,
  InsertImportBatch,
  InsertNotification,
  InsertSchedule,
  InsertStatusHistory,
  notifications,
  reminders,
  schedules,
  settings,
  statusHistory,
  teams,
  Team,
  users,
  User,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
type DbExecutor = any;

export type CustomerTimelineEvent = {
  id: string;
  eventType: string;
  eventLabel: string;
  occurredAt: Date;
  actorName: string | null;
  actorRole: string | null;
  source: string;
  summary: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  severity: "normal" | "info" | "success" | "warning" | "danger";
  relatedId: number | null;
  relatedType: string | null;
};

export type CustomerTimelineFilter = {
  dateFrom?: Date;
  dateTo?: Date;
  eventTypes?: string[];
  limit?: number;
};

export type CustomerMergeStats = {
  consultations: number;
  contracts: number;
  followUps: number;
  notifications: number;
  reminders: number;
  deleteRequests: number;
  statusHistory: number;
  consentLogs: number;
  assignmentHistory: number;
};

export type HandoffPreview = {
  sourceUser: Pick<User, "id" | "name" | "email" | "role" | "accountStatus" | "teamId" | "subBranchAdminId">;
  counts: {
    activeCustomers: number;
    softDeletedCustomers: number;
    activeContracts: number;
    pendingFollowUps: number;
    pendingSchedules: number;
    pendingNotifications: number;
    consultations: number;
    recentActivityLogs: number;
  };
};

export type HandoffExecuteInput = {
  sourceUserId: number;
  targetUserId: number;
  executedBy: number;
  transferCustomers: boolean;
  transferFollowUps: boolean;
  transferSchedules: boolean;
  transferNotifications: boolean;
  updateSourceAccountStatus: "keep" | "inactive" | "resigned";
  forceLogoutSource: boolean;
  resetOAuthSource: boolean;
  reason: string;
};

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

export async function runDbTransaction<T>(callback: (tx: DbExecutor) => Promise<T>): Promise<T | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async (tx) => callback(tx as DbExecutor));
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: {
  name: string;
  email: string;
  role: "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
  accountStatus?: "active" | "inactive" | "resigned";
  loginStatus?: "invited" | "linked";
  teamId?: number | null;
  subBranchAdminId?: number | null;
  phone?: string;
  memo?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(users).values({
    openId: `invited_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: data.name,
    email: data.email.trim().toLowerCase(),
    role: data.role,
    accountStatus: data.accountStatus ?? "active",
    loginStatus: data.loginStatus ?? "invited",
    teamId: data.teamId ?? null,
    subBranchAdminId: data.subBranchAdminId ?? null,
    phone: data.phone ?? null,
    memo: data.memo ?? null,
    lastSignedIn: new Date(),
  });
  const newUser = await db.select().from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
  return newUser[0] ?? null;
}

export async function linkUserOpenId(userId: number, openId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ openId, loginStatus: "linked", lastSignedIn: new Date() }).where(eq(users.id, userId));
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

export async function invalidateUserSessions(id: number, invalidatedAt = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  await db.update(users).set({ sessionInvalidatedAt: invalidatedAt }).where(eq(users.id, id));
  return 1;
}

export async function invalidateAllUserSessions(invalidatedAt = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const currentUsers = await db.select({ id: users.id }).from(users);
  await db.update(users).set({ sessionInvalidatedAt: invalidatedAt });
  return currentUsers.length;
}

export async function resetUserOAuthLink(id: number) {
  const db = await getDb();
  if (!db) return;
  const invitedOpenId = `invited_reset_${id}_${Date.now().toString(36)}`;
  const now = new Date();
  await db.update(users).set({
    openId: invitedOpenId,
    loginStatus: "invited",
    sessionInvalidatedAt: now,
  }).where(eq(users.id, id));
}

// ─── Teams ───────────────────────────────────────────────────────────────────
function publicUserSnapshot(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    teamId: user.teamId,
    subBranchAdminId: user.subBranchAdminId,
  };
}

async function getHandoffSourceCustomerIds(sourceUserId: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return [];
  const rows = await db.select({ id: customers.id }).from(customers)
    .where(and(eq(customers.agentId, sourceUserId), eq(customers.isActive, true), isNull(customers.deletedAt)));
  return rows.map((row: { id: number }) => row.id);
}

async function countRows(table: any, condition: any, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(table).where(condition);
  return Number(result[0]?.count ?? 0);
}

export async function getHandoffPreview(sourceUserId: number): Promise<HandoffPreview | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const source = await getUserById(sourceUserId);
  if (!source) return undefined;
  const activeCustomerIds = await getHandoffSourceCustomerIds(sourceUserId, db);
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [softDeletedCustomers, activeContracts, pendingFollowUps, pendingSchedules, pendingNotifications, consultationsCount, recentActivityLogs] = await Promise.all([
    countRows(customers, and(eq(customers.agentId, sourceUserId), or(eq(customers.isActive, false), sql`${customers.deletedAt} is not null`)), db),
    activeCustomerIds.length > 0 ? countRows(contracts, and(inArray(contracts.customerId, activeCustomerIds), eq(contracts.isActive, true), isNull(contracts.deletedAt)), db) : Promise.resolve(0),
    countRows(followUps, and(eq(followUps.assignedAgentId, sourceUserId), or(eq(followUps.status, "scheduled"), eq(followUps.status, "postponed")), isNull(followUps.deletedAt)), db),
    countRows(schedules, and(eq(schedules.userId, sourceUserId), eq(schedules.isActive, true), isNull(schedules.completedAt)), db),
    countRows(notifications, and(eq(notifications.userId, sourceUserId), eq(notifications.isRead, false)), db),
    activeCustomerIds.length > 0 ? countRows(consultations, inArray(consultations.customerId, activeCustomerIds), db) : Promise.resolve(0),
    countRows(activityLogs, and(eq(activityLogs.userId, sourceUserId), gte(activityLogs.createdAt, recentCutoff)), db),
  ]);

  return {
    sourceUser: publicUserSnapshot(source),
    counts: {
      activeCustomers: activeCustomerIds.length,
      softDeletedCustomers,
      activeContracts,
      pendingFollowUps,
      pendingSchedules,
      pendingNotifications,
      consultations: consultationsCount,
      recentActivityLogs,
    },
  };
}

export async function getHandoffHistories(filter?: { sourceUserId?: number; targetUserId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.sourceUserId !== undefined) conditions.push(eq(handoffHistories.sourceUserId, filter.sourceUserId));
  if (filter?.targetUserId !== undefined) conditions.push(eq(handoffHistories.targetUserId, filter.targetUserId));
  return db.select().from(handoffHistories)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(handoffHistories.createdAt))
    .limit(filter?.limit ?? 50);
}

export async function executeUserHandoff(input: HandoffExecuteInput) {
  const db = await getDb();
  if (!db) return undefined;
  const source = await getUserById(input.sourceUserId);
  const target = await getUserById(input.targetUserId);
  if (!source || !target) return undefined;
  const now = new Date();
  const afterStatus = input.updateSourceAccountStatus === "keep" ? source.accountStatus : input.updateSourceAccountStatus;

  return db.transaction(async (tx) => {
    const client = tx as DbExecutor;
    const activeCustomerIds = await getHandoffSourceCustomerIds(input.sourceUserId, client);
    const movedCounts = { customers: 0, contracts: 0, followUps: 0, schedules: 0, notifications: 0 };

    if (input.transferCustomers && activeCustomerIds.length > 0) {
      const sourceCustomers = await client.select({
        id: customers.id,
        previousAgentId: customers.agentId,
        previousTeamId: customers.assignedTeamId,
        previousSubBranchAdminId: customers.subBranchAdminId,
      }).from(customers).where(inArray(customers.id, activeCustomerIds));

      await client.update(customers).set({
        agentId: input.targetUserId,
        assignedTeamId: target.teamId ?? null,
        subBranchAdminId: target.subBranchAdminId ?? null,
        assignmentStatus: "assigned_to_agent",
        assignedAt: now,
      }).where(inArray(customers.id, activeCustomerIds));
      movedCounts.customers = sourceCustomers.length;

      await client.update(contracts).set({ agentId: input.targetUserId })
        .where(and(inArray(contracts.customerId, activeCustomerIds), eq(contracts.agentId, input.sourceUserId)));
      movedCounts.contracts = await countRows(contracts, and(inArray(contracts.customerId, activeCustomerIds), eq(contracts.agentId, input.targetUserId), eq(contracts.isActive, true), isNull(contracts.deletedAt)), client);

      for (const customer of sourceCustomers) {
        await createAssignmentHistory({
          customerId: customer.id,
          previousSubBranchAdminId: customer.previousSubBranchAdminId ?? null,
          newSubBranchAdminId: target.subBranchAdminId ?? null,
          previousTeamId: customer.previousTeamId ?? null,
          newTeamId: target.teamId ?? null,
          previousAgentId: customer.previousAgentId ?? null,
          newAgentId: input.targetUserId,
          assignedBy: input.executedBy,
          assignmentType: "reassignment",
          assignmentReason: "handoff",
        }, client);
        await createActivityLog({
          userId: input.executedBy,
          action: "CUSTOMER_TRANSFERRED_BY_HANDOFF",
          targetType: "customer",
          targetId: customer.id,
          details: JSON.stringify({ actor: input.executedBy, targetType: "customer", targetId: customer.id, metadata: { sourceUserId: input.sourceUserId, targetUserId: input.targetUserId, reason: input.reason } }),
        }, client);
      }
    }

    if (input.transferFollowUps) {
      const pending = await client.select({ id: followUps.id }).from(followUps)
        .where(and(eq(followUps.assignedAgentId, input.sourceUserId), or(eq(followUps.status, "scheduled"), eq(followUps.status, "postponed")), isNull(followUps.deletedAt)));
      if (pending.length > 0) {
        await client.update(followUps).set({ assignedAgentId: input.targetUserId, teamId: target.teamId ?? null, subBranchAdminId: target.subBranchAdminId ?? null })
          .where(inArray(followUps.id, pending.map((item: { id: number }) => item.id)));
      }
      movedCounts.followUps = pending.length;
    }

    if (input.transferSchedules) {
      const pending = await client.select({ id: schedules.id }).from(schedules)
        .where(and(eq(schedules.userId, input.sourceUserId), eq(schedules.isActive, true), isNull(schedules.completedAt)));
      if (pending.length > 0) {
        await client.update(schedules).set({ userId: input.targetUserId, teamId: target.teamId ?? null })
          .where(inArray(schedules.id, pending.map((item: { id: number }) => item.id)));
      }
      movedCounts.schedules = pending.length;
    }

    if (input.transferNotifications) {
      const pending = await client.select({ id: notifications.id }).from(notifications)
        .where(and(eq(notifications.userId, input.sourceUserId), eq(notifications.isRead, false)));
      if (pending.length > 0) {
        await client.update(notifications).set({ userId: input.targetUserId })
          .where(inArray(notifications.id, pending.map((item: { id: number }) => item.id)));
      }
      movedCounts.notifications = pending.length;
    }

    const aggregateTransferLogs = [
      { action: "FOLLOW_UP_TRANSFERRED_BY_HANDOFF", targetType: "follow_up", count: movedCounts.followUps },
      { action: "SCHEDULE_TRANSFERRED_BY_HANDOFF", targetType: "schedule", count: movedCounts.schedules },
      { action: "NOTIFICATION_TRANSFERRED_BY_HANDOFF", targetType: "notification", count: movedCounts.notifications },
    ];
    for (const entry of aggregateTransferLogs) {
      if (entry.count > 0) {
        await createActivityLog({
          userId: input.executedBy,
          action: entry.action,
          targetType: entry.targetType,
          details: JSON.stringify({
            actor: input.executedBy,
            targetType: entry.targetType,
            metadata: {
              sourceUserId: input.sourceUserId,
              targetUserId: input.targetUserId,
              reason: input.reason,
              transferredCount: entry.count,
            },
          }),
        }, client);
      }
    }

    if (input.updateSourceAccountStatus !== "keep" || input.forceLogoutSource || input.resetOAuthSource) {
      const updateData: Partial<typeof users.$inferInsert> = {};
      if (input.updateSourceAccountStatus !== "keep") updateData.accountStatus = input.updateSourceAccountStatus;
      if (input.forceLogoutSource || input.resetOAuthSource) updateData.sessionInvalidatedAt = now;
      if (input.resetOAuthSource) {
        updateData.openId = `invited_handoff_${input.sourceUserId}_${Date.now().toString(36)}`;
        updateData.loginStatus = "invited";
      }
      await client.update(users).set(updateData).where(eq(users.id, input.sourceUserId));
    }

    await client.insert(handoffHistories).values({
      sourceUserId: input.sourceUserId,
      targetUserId: input.targetUserId,
      executedBy: input.executedBy,
      reason: input.reason,
      transferredCustomerCount: movedCounts.customers,
      transferredContractCount: movedCounts.contracts,
      transferredFollowUpCount: movedCounts.followUps,
      transferredScheduleCount: movedCounts.schedules,
      transferredNotificationCount: movedCounts.notifications,
      sourceAccountStatusBefore: source.accountStatus,
      sourceAccountStatusAfter: afterStatus,
      forceLogoutSource: input.forceLogoutSource,
      resetOAuthSource: input.resetOAuthSource,
    });

    await createActivityLog({
      userId: input.executedBy,
      action: "USER_HANDOFF_EXECUTED",
      targetType: "user",
      targetId: input.sourceUserId,
      details: JSON.stringify({
        actor: input.executedBy,
        targetType: "user",
        targetId: input.sourceUserId,
        metadata: {
          sourceUserId: input.sourceUserId,
          targetUserId: input.targetUserId,
          reason: input.reason,
          transferredCustomerCount: movedCounts.customers,
          transferredContractCount: movedCounts.contracts,
          transferredFollowUpCount: movedCounts.followUps,
          transferredScheduleCount: movedCounts.schedules,
          transferredNotificationCount: movedCounts.notifications,
          accountStatusBefore: source.accountStatus,
          accountStatusAfter: afterStatus,
          forceLogoutSource: input.forceLogoutSource,
          resetOAuthSource: input.resetOAuthSource,
        },
      }),
    }, client);

    if (input.updateSourceAccountStatus !== "keep") {
      await createActivityLog({
        userId: input.executedBy,
        action: "USER_STATUS_UPDATED_BY_HANDOFF",
        targetType: "user",
        targetId: input.sourceUserId,
        details: JSON.stringify({ actor: input.executedBy, targetType: "user", targetId: input.sourceUserId, beforeValue: { accountStatus: source.accountStatus }, afterValue: { accountStatus: afterStatus }, metadata: { reason: input.reason } }),
      }, client);
    }

    if (input.forceLogoutSource) {
      await createActivityLog({
        userId: input.executedBy,
        action: "USER_FORCE_LOGOUT",
        targetType: "user",
        targetId: input.sourceUserId,
        details: JSON.stringify({ actor: input.executedBy, targetType: "user", targetId: input.sourceUserId, metadata: { reason: input.reason, source: "handoff", affectedSessionCount: 1 } }),
      }, client);
    }

    if (input.resetOAuthSource) {
      await createActivityLog({
        userId: input.executedBy,
        action: "USER_OAUTH_RESET",
        targetType: "user",
        targetId: input.sourceUserId,
        details: JSON.stringify({ actor: input.executedBy, targetType: "user", targetId: input.sourceUserId, metadata: { reason: input.reason, source: "handoff", openIdReset: true } }),
      }, client);
    }

    return { success: true, sourceUserId: input.sourceUserId, targetUserId: input.targetUserId, counts: movedCounts, sourceAccountStatusBefore: source.accountStatus, sourceAccountStatusAfter: afterStatus };
  });
}

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

export async function getDeletedTeams() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teams)
    .where(or(eq(teams.isActive, false), sql`${teams.deletedAt} is not null`))
    .orderBy(desc(teams.createdAt));
}

export async function restoreTeam(id: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(teams).set({ isActive: true, deletedAt: null }).where(eq(teams.id, id));
}

export async function permanentlyDeleteTeam(id: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.delete(teams).where(eq(teams.id, id));
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
  priority?: string;
  tag?: string;
  nextAction?: string;
  assignedDateFrom?: Date;
  assignedDateTo?: Date;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

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
  if (filter.priority) conditions.push(eq(customers.priority, filter.priority as any));
  if (filter.nextAction) conditions.push(eq(customers.nextAction, filter.nextAction));
  if (filter.tag) conditions.push(sql`${customers.customerTags} like ${`%${filter.tag}%`}` as any);
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

export async function getDeletedCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customers)
    .where(or(eq(customers.isActive, false), sql`${customers.deletedAt} is not null`))
    .orderBy(desc(customers.createdAt));
}

export async function restoreCustomer(id: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(customers).set({ isActive: true, deletedAt: null }).where(eq(customers.id, id));
}

export async function permanentlyDeleteCustomer(id: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.delete(customers).where(eq(customers.id, id));
}

function maskPhoneForMerge(phone?: string | null) {
  const normalized = phone ? normalizePhone(phone) : "";
  if (normalized.length < 7) return normalized ? "***" : null;
  return `${normalized.slice(0, 3)}-****-${normalized.slice(-4)}`;
}

function decodeTagList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
}

function encodeTagList(tags: string[]) {
  return JSON.stringify(Array.from(new Set(tags)).slice(0, 10));
}

function strongerPriority(a?: string | null, b?: string | null) {
  const rank: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, unclassified: 1 };
  return (rank[b ?? "unclassified"] ?? 1) > (rank[a ?? "unclassified"] ?? 1) ? b : a;
}

function customerMergeSummary(row: typeof customers.$inferSelect, stats?: CustomerMergeStats) {
  return {
    id: row.id,
    name: row.name,
    maskedPhone: maskPhoneForMerge(row.phone),
    birthDate: row.birthDate,
    region: row.region,
    source: row.source,
    consultStatus: row.consultStatus,
    priority: row.priority,
    customerTags: decodeTagList(row.customerTags),
    nextAction: row.nextAction,
    agentId: row.agentId,
    assignedTeamId: row.assignedTeamId,
    subBranchAdminId: row.subBranchAdminId,
    isActive: row.isActive,
    deletedAt: row.deletedAt,
    mergedIntoCustomerId: row.mergedIntoCustomerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stats,
  };
}

export async function getCustomerMergeStats(customerId: number): Promise<CustomerMergeStats> {
  const db = await getDb();
  if (!db) return {
    consultations: 0,
    contracts: 0,
    followUps: 0,
    notifications: 0,
    reminders: 0,
    deleteRequests: 0,
    statusHistory: 0,
    consentLogs: 0,
    assignmentHistory: 0,
  };
  const [consultationRows, contractRows, followUpRows, notificationRows, reminderRows, requestRows, statusRows, consentRows, assignmentRows] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(consultations).where(eq(consultations.customerId, customerId)),
    db.select({ count: sql<number>`COUNT(*)` }).from(contracts).where(eq(contracts.customerId, customerId)),
    db.select({ count: sql<number>`COUNT(*)` }).from(followUps).where(eq(followUps.customerId, customerId)),
    db.select({ count: sql<number>`COUNT(*)` }).from(notifications).where(and(eq(notifications.relatedType, "customer"), eq(notifications.relatedId, customerId))),
    db.select({ count: sql<number>`COUNT(*)` }).from(reminders).where(and(eq(reminders.relatedType, "customer"), eq(reminders.relatedId, customerId))),
    db.select({ count: sql<number>`COUNT(*)` }).from(deleteRequests).where(eq(deleteRequests.customerId, customerId)),
    db.select({ count: sql<number>`COUNT(*)` }).from(statusHistory).where(eq(statusHistory.customerId, customerId)),
    db.select({ count: sql<number>`COUNT(*)` }).from(consentLogs).where(eq(consentLogs.customerId, customerId)),
    db.select({ count: sql<number>`COUNT(*)` }).from(assignmentHistory).where(eq(assignmentHistory.customerId, customerId)),
  ]);
  return {
    consultations: Number(consultationRows[0]?.count ?? 0),
    contracts: Number(contractRows[0]?.count ?? 0),
    followUps: Number(followUpRows[0]?.count ?? 0),
    notifications: Number(notificationRows[0]?.count ?? 0),
    reminders: Number(reminderRows[0]?.count ?? 0),
    deleteRequests: Number(requestRows[0]?.count ?? 0),
    statusHistory: Number(statusRows[0]?.count ?? 0),
    consentLogs: Number(consentRows[0]?.count ?? 0),
    assignmentHistory: Number(assignmentRows[0]?.count ?? 0),
  };
}

export async function findDuplicateCustomerGroups(filter: { search?: string; phone?: string; name?: string; onlyActive?: boolean } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter.onlyActive !== false) conditions.push(eq(customers.isActive, true), isNull(customers.deletedAt));
  if (filter.search) {
    const like = `%${filter.search}%`;
    conditions.push(or(sql`${customers.name} like ${like}`, sql`${customers.phone} like ${like}`) as any);
  }
  if (filter.name) conditions.push(sql`${customers.name} like ${`%${filter.name}%`}` as any);
  const rows = await db.select().from(customers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(customers.updatedAt))
    .limit(1000);

  const expectedPhone = filter.phone ? normalizePhone(filter.phone) : null;
  const phoneGroups = new Map<string, typeof rows>();
  for (const row of rows) {
    const normalized = row.phone ? normalizePhone(row.phone) : "";
    if (!normalized || (expectedPhone && normalized !== expectedPhone)) continue;
    const group = phoneGroups.get(normalized) ?? [];
    group.push(row);
    phoneGroups.set(normalized, group);
  }

  const duplicateGroups = Array.from(phoneGroups.entries())
    .filter(([, group]) => group.length > 1)
    .slice(0, 50);

  return Promise.all(duplicateGroups.map(async ([normalizedPhone, group]) => ({
    normalizedPhone,
    maskedPhone: maskPhoneForMerge(normalizedPhone),
    candidates: await Promise.all(group.map(async (row) => customerMergeSummary(row, await getCustomerMergeStats(row.id)))),
  })));
}

export async function getCustomerMergePreview(targetCustomerId: number, sourceCustomerId: number) {
  const [target, source] = await Promise.all([getCustomerById(targetCustomerId), getCustomerById(sourceCustomerId)]);
  if (!target || !source) return undefined;
  const [targetStats, sourceStats] = await Promise.all([
    getCustomerMergeStats(targetCustomerId),
    getCustomerMergeStats(sourceCustomerId),
  ]);
  const db = await getDb();
  const pendingRows = db ? await db.select({ count: sql<number>`COUNT(*)` }).from(deleteRequests)
    .where(and(eq(deleteRequests.customerId, sourceCustomerId), eq(deleteRequests.status, "pending")))
    : [{ count: 0 }];
  const conflicts = ["name", "phone", "region", "source", "consultStatus", "priority", "nextAction"]
    .filter((field) => (target as any)[field] && (source as any)[field] && (target as any)[field] !== (source as any)[field]);
  return {
    targetCustomer: customerMergeSummary(target, targetStats),
    sourceCustomer: customerMergeSummary(source, sourceStats),
    transferCounts: sourceStats,
    conflicts,
    mergePolicy: "기준 고객 값 유지, 빈 값 보완, 태그 union, 우선순위 상향",
    blockers: {
      sameCustomer: targetCustomerId === sourceCustomerId,
      inactiveTarget: !target.isActive || !!target.deletedAt,
      inactiveSource: !source.isActive || !!source.deletedAt,
      alreadyMerged: !!source.mergedIntoCustomerId,
      pendingDeleteRequests: Number(pendingRows[0]?.count ?? 0) > 0,
    },
  };
}

export async function mergeCustomers(params: {
  targetCustomerId: number;
  sourceCustomerId: number;
  actorId: number;
  reason?: string;
}) {
  const { targetCustomerId, sourceCustomerId, actorId, reason } = params;
  const preview = await getCustomerMergePreview(targetCustomerId, sourceCustomerId);
  if (!preview) throw new Error("merge_customers_not_found");
  const source = await getCustomerById(sourceCustomerId);
  const target = await getCustomerById(targetCustomerId);
  if (!source || !target) throw new Error("merge_customers_not_found");
  const now = new Date();
  const tags = encodeTagList([...decodeTagList(target.customerTags), ...decodeTagList(source.customerTags)]);
  const targetPatch: Partial<InsertCustomer> = {
    phone: target.phone ?? source.phone,
    birthDate: target.birthDate ?? source.birthDate,
    gender: target.gender ?? source.gender,
    region: target.region ?? source.region,
    expectedPremium: target.expectedPremium ?? source.expectedPremium,
    availableTime: target.availableTime ?? source.availableTime,
    source: target.source ?? source.source,
    priority: strongerPriority(target.priority, source.priority) as any,
    customerTags: tags,
    nextAction: target.nextAction ?? source.nextAction,
    privacyConsent: target.privacyConsent || source.privacyConsent,
    marketingConsent: target.marketingConsent || source.marketingConsent,
  };

  await runDbTransaction(async (tx) => {
    const client = tx as any;
    await client.update(consultations).set({ customerId: targetCustomerId }).where(eq(consultations.customerId, sourceCustomerId));
    await client.update(contracts).set({ customerId: targetCustomerId }).where(eq(contracts.customerId, sourceCustomerId));
    await client.update(followUps).set({ customerId: targetCustomerId }).where(eq(followUps.customerId, sourceCustomerId));
    await client.update(statusHistory).set({ customerId: targetCustomerId }).where(eq(statusHistory.customerId, sourceCustomerId));
    await client.update(consentLogs).set({ customerId: targetCustomerId }).where(eq(consentLogs.customerId, sourceCustomerId));
    await client.update(assignmentHistory).set({ customerId: targetCustomerId }).where(eq(assignmentHistory.customerId, sourceCustomerId));
    await client.update(deleteRequests).set({ customerId: targetCustomerId }).where(eq(deleteRequests.customerId, sourceCustomerId));
    await client.update(notifications).set({ relatedId: targetCustomerId }).where(and(eq(notifications.relatedType, "customer"), eq(notifications.relatedId, sourceCustomerId)));
    await client.update(reminders).set({ relatedId: targetCustomerId }).where(and(eq(reminders.relatedType, "customer"), eq(reminders.relatedId, sourceCustomerId)));
    await client.update(customers).set(targetPatch).where(eq(customers.id, targetCustomerId));
    await client.update(customers).set({
      isActive: false,
      deletedAt: now,
      mergedIntoCustomerId: targetCustomerId,
      mergedAt: now,
      mergedBy: actorId,
    }).where(eq(customers.id, sourceCustomerId));
    await createActivityLog({
      userId: actorId,
      action: "CUSTOMER_MERGED",
      targetType: "customer",
      targetId: targetCustomerId,
      details: JSON.stringify({
        actorId,
        sourceCustomerId,
        targetCustomerId,
        reason,
        movedConsultationCount: preview.transferCounts.consultations,
        movedContractCount: preview.transferCounts.contracts,
        movedFollowUpCount: preview.transferCounts.followUps,
        movedNotificationCount: preview.transferCounts.notifications,
        movedDeleteRequestCount: preview.transferCounts.deleteRequests,
        movedStatusHistoryCount: preview.transferCounts.statusHistory,
        movedConsentLogCount: preview.transferCounts.consentLogs,
        movedAssignmentHistoryCount: preview.transferCounts.assignmentHistory,
      }),
      createdAt: now,
    }, tx);
  });

  return {
    success: true,
    targetCustomerId,
    sourceCustomerId,
    affectedCounts: preview.transferCounts,
  };
}

export async function checkPhoneDuplicate(phone: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return null;
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const result = await db.select().from(customers)
    .where(eq(customers.isActive, true));
  const found = result.find((customer) => {
    if (!customer.phone) return false;
    if (excludeId && customer.id === excludeId) return false;
    return normalizePhone(customer.phone) === normalized;
  });
  if (!found) return null;
  return found;
}

/** 지점장이 부지점장에게 DB 배분 */
export async function assignCustomerToSubBranch(customerId: number, subBranchAdminId: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(customers).set({
    subBranchAdminId,
    assignmentStatus: "assigned_to_sub_branch",
    assignedAt: new Date(),
  }).where(eq(customers.id, customerId));
}

/** 최종 팀원 배정 */
export async function assignCustomer(customerId: number, agentId: number, teamId?: number, subBranchAdminId?: number, client?: DbExecutor) {
  const db = client ?? await getDb();
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

export async function updateConsultation(id: number, data: Partial<InsertConsultation>) {
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

export async function getContractsByCustomerIncludingInactive(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contracts)
    .where(eq(contracts.customerId, customerId))
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

export async function deactivateContractWithClient(id: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(contracts).set({ isActive: false, deletedAt: new Date() }).where(eq(contracts.id, id));
}

export async function getDeletedContracts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contracts)
    .where(or(eq(contracts.isActive, false), sql`${contracts.deletedAt} is not null`))
    .orderBy(desc(contracts.createdAt));
}

export async function restoreContract(id: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(contracts).set({ isActive: true, deletedAt: null }).where(eq(contracts.id, id));
}

export async function permanentlyDeleteContract(id: number, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.delete(contracts).where(eq(contracts.id, id));
}

export async function getCustomerPermanentDeleteBlockers(customerId: number) {
  const db = await getDb();
  if (!db) {
    return {
      contracts: 0,
      consultations: 0,
      statusHistory: 0,
      consentLogs: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      notifications: 0,
      reminders: 0,
    };
  }
  const [
    contractRows,
    consultationRows,
    statusRows,
    consentRows,
    assignmentRows,
    requestRows,
    notificationRows,
    reminderRows,
  ] = await Promise.all([
    db.select({ id: contracts.id }).from(contracts).where(eq(contracts.customerId, customerId)).limit(1),
    db.select({ id: consultations.id }).from(consultations).where(eq(consultations.customerId, customerId)).limit(1),
    db.select({ id: statusHistory.id }).from(statusHistory).where(eq(statusHistory.customerId, customerId)).limit(1),
    db.select({ id: consentLogs.id }).from(consentLogs).where(eq(consentLogs.customerId, customerId)).limit(1),
    db.select({ id: assignmentHistory.id }).from(assignmentHistory).where(eq(assignmentHistory.customerId, customerId)).limit(1),
    db.select({ id: deleteRequests.id }).from(deleteRequests).where(eq(deleteRequests.customerId, customerId)).limit(1),
    db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.relatedType, "customer"), eq(notifications.relatedId, customerId)))
      .limit(1),
    db.select({ id: reminders.id }).from(reminders)
      .where(and(eq(reminders.relatedType, "customer"), eq(reminders.relatedId, customerId)))
      .limit(1),
  ]);
  return {
    contracts: contractRows.length,
    consultations: consultationRows.length,
    statusHistory: statusRows.length,
    consentLogs: consentRows.length,
    assignmentHistory: assignmentRows.length,
    deleteRequests: requestRows.length,
    notifications: notificationRows.length,
    reminders: reminderRows.length,
  };
}

export async function getContractPermanentDeleteBlockers(contractId: number) {
  const db = await getDb();
  if (!db) return { contractHistory: 0, deleteRequests: 0, notifications: 0, reminders: 0 };
  const [historyRows, requestRows, notificationRows, reminderRows] = await Promise.all([
    db.select({ id: contractHistory.id }).from(contractHistory).where(eq(contractHistory.contractId, contractId)).limit(1),
    db.select({ id: deleteRequests.id }).from(deleteRequests)
      .where(and(eq(deleteRequests.targetType, "contract"), eq(deleteRequests.targetId, contractId)))
      .limit(1),
    db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.relatedType, "contract"), eq(notifications.relatedId, contractId)))
      .limit(1),
    db.select({ id: reminders.id }).from(reminders)
      .where(and(eq(reminders.relatedType, "contract"), eq(reminders.relatedId, contractId)))
      .limit(1),
  ]);
  return {
    contractHistory: historyRows.length,
    deleteRequests: requestRows.length,
    notifications: notificationRows.length,
    reminders: reminderRows.length,
  };
}

export async function getTeamPermanentDeleteBlockers(teamId: number) {
  const db = await getDb();
  if (!db) return { users: 0, customers: 0, schedules: 0, assignmentHistory: 0 };
  const [userRows, customerRows, scheduleRows, assignmentRows] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.teamId, teamId)).limit(1),
    db.select({ id: customers.id }).from(customers).where(eq(customers.assignedTeamId, teamId)).limit(1),
    db.select({ id: schedules.id }).from(schedules).where(eq(schedules.teamId, teamId)).limit(1),
    db.select({ id: assignmentHistory.id }).from(assignmentHistory)
      .where(or(eq(assignmentHistory.previousTeamId, teamId), eq(assignmentHistory.newTeamId, teamId)))
      .limit(1),
  ]);
  return {
    users: userRows.length,
    customers: customerRows.length,
    schedules: scheduleRows.length,
    assignmentHistory: assignmentRows.length,
  };
}

export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return result[0];
}

// ─── Contract History ─────────────────────────────────────────────────────────
export async function createContractHistoryEntry(data: InsertContractHistory, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.insert(contractHistory).values(data);
}

export async function getContractHistory(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contractHistory).where(eq(contractHistory.contractId, contractId)).orderBy(desc(contractHistory.createdAt));
}

export async function createDeleteRequest(data: InsertDeleteRequest, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.insert(deleteRequests).values(data);
}

export async function getDeleteRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deleteRequests).where(eq(deleteRequests.id, id)).limit(1);
  return result[0];
}

export async function getPendingDeleteRequestForTarget(targetType: "contract", targetId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deleteRequests)
    .where(and(eq(deleteRequests.targetType, targetType), eq(deleteRequests.targetId, targetId), eq(deleteRequests.status, "pending")))
    .limit(1);
  return result[0];
}

export async function getDeleteRequests(filter: { requestedBy?: number; status?: "pending" | "approved" | "rejected" | "cancelled" } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter.requestedBy !== undefined) conditions.push(eq(deleteRequests.requestedBy, filter.requestedBy));
  if (filter.status) conditions.push(eq(deleteRequests.status, filter.status));
  return db.select().from(deleteRequests)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(deleteRequests.createdAt));
}

export async function updateDeleteRequest(
  id: number,
  data: Partial<typeof deleteRequests.$inferInsert>,
  client?: DbExecutor,
) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(deleteRequests).set(data).where(eq(deleteRequests.id, id));
}

// ─── Schedules ────────────────────────────────────────────────────────────────
export async function createFollowUp(data: InsertFollowUp, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.insert(followUps).values(data);
}

export async function getFollowUpById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
  return result[0];
}

export async function getFollowUps(filter: {
  customerId?: number;
  agentId?: number;
  teamId?: number;
  subBranchAdminId?: number;
  statuses?: Array<"scheduled" | "completed" | "postponed" | "cancelled">;
  dueFrom?: Date;
  dueTo?: Date;
  includeDeleted?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (!filter.includeDeleted) conditions.push(isNull(followUps.deletedAt));
  if (filter.customerId !== undefined) conditions.push(eq(followUps.customerId, filter.customerId));
  if (filter.agentId !== undefined) conditions.push(eq(followUps.assignedAgentId, filter.agentId));
  if (filter.teamId !== undefined) conditions.push(eq(followUps.teamId, filter.teamId));
  if (filter.subBranchAdminId !== undefined) conditions.push(eq(followUps.subBranchAdminId, filter.subBranchAdminId));
  if (filter.statuses && filter.statuses.length > 0) conditions.push(or(...filter.statuses.map((status) => eq(followUps.status, status))));
  if (filter.dueFrom) conditions.push(gte(followUps.nextContactDate, filter.dueFrom));
  if (filter.dueTo) conditions.push(lte(followUps.nextContactDate, filter.dueTo));
  return db.select().from(followUps)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(followUps.nextContactDate);
}

export async function updateFollowUp(id: number, data: Partial<InsertFollowUp>, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(followUps).set(data).where(eq(followUps.id, id));
}

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
export async function getNotifications(userId: number, extraUserIds?: number[], limit = 200) {
  const db = await getDb();
  if (!db) return [];
  if (extraUserIds && extraUserIds.length > 0) {
    const allIds = [userId, ...extraUserIds];
    return db.select().from(notifications)
      .where(or(...allIds.map((id) => eq(notifications.userId, id))))
      .orderBy(desc(notifications.createdAt)).limit(limit);
  }
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getAllNotifications(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getNotificationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  return result[0];
}

export async function getNotificationsFiltered(filter: {
  userIds?: number[]; // null이면 전체 조회 (branch_admin)
  processStatus?: string;
  isRead?: boolean;
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0, hasMore: false };
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  const conditions: any[] = [];
  // 권한별 userId 범위 (null이면 전체)
  if (filter.userIds !== undefined && filter.userIds.length > 0) {
    conditions.push(or(...filter.userIds.map((id) => eq(notifications.userId, id))));
  }
  if (filter.processStatus) conditions.push(eq(notifications.processStatus, filter.processStatus as any));
  if (filter.isRead !== undefined) conditions.push(eq(notifications.isRead, filter.isRead));
  if (filter.type) conditions.push(eq(notifications.type, filter.type as any));
  if (filter.dateFrom) conditions.push(gte(notifications.createdAt, filter.dateFrom));
  if (filter.dateTo) conditions.push(lte(notifications.createdAt, filter.dateTo));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    whereClause
      ? db.select().from(notifications).where(whereClause).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset)
      : db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset),
    whereClause
      ? db.select({ count: sql<number>`COUNT(*)` }).from(notifications).where(whereClause)
      : db.select({ count: sql<number>`COUNT(*)` }).from(notifications),
  ]);
  const totalCount = Number(countResult[0]?.count ?? 0);
  return { items, totalCount, hasMore: offset + limit < totalCount };
}

export async function getAllUsersByEmail(email: string) {
  const db = await getDb();
  if (!db) return [];
  const normalized = email.trim().toLowerCase();
  return db.select().from(users).where(eq(users.email, normalized));
}

export async function getUsersBySubBranchAdminId(subBranchAdminId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id }).from(users)
    .where(and(eq(users.subBranchAdminId, subBranchAdminId), eq(users.accountStatus, "active")));
}

export async function getUsersByTeamId(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id }).from(users)
    .where(and(eq(users.teamId, teamId), eq(users.accountStatus, "active")));
}

export async function getUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

export async function createNotification(data: InsertNotification, client?: DbExecutor) {
  const db = client ?? await getDb();
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
export async function createAssignmentHistory(data: InsertAssignmentHistory, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.insert(assignmentHistory).values(data);
}

export async function getAssignmentHistory(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assignmentHistory).where(eq(assignmentHistory.customerId, customerId)).orderBy(desc(assignmentHistory.createdAt));
}

// ─── Settings ────────────────────────────────────────────────────────────
export async function getSettings(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(settings).where(eq(settings.category, category)).orderBy(settings.value);
}

export async function createSetting(category: string, value: string, createdBy: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(settings).values({ category, value, createdBy, isActive: true });
}

export async function toggleSetting(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(settings).set({ isActive }).where(eq(settings.id, id));
}

export async function updateSetting(id: number, value: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(settings).set({ value }).where(eq(settings.id, id));
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export async function createActivityLog(data: InsertActivityLog, client?: DbExecutor) {
  const db = client ?? await getDb();
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
function truncateTimelineText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function safeTimelineMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const blocked = /phone|contact|memo|content|secret|token|password|openId|database|url|jwt|client/i;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.test(key))
      .map(([key, item]) => [key, typeof item === "string" ? truncateTimelineText(item, 80) : item]),
  );
}

function parseLogDetails(details?: string | null) {
  if (!details) return {};
  try {
    return safeTimelineMetadata(JSON.parse(details));
  } catch {
    const text = truncateTimelineText(details, 80);
    return text ? { summary: text } : {};
  }
}

function userLabel(userMap: Map<number, { name: string | null; role: string | null }>, id?: number | null) {
  if (!id) return { actorName: null, actorRole: null };
  const user = userMap.get(id);
  return { actorName: user?.name ?? `#${id}`, actorRole: user?.role ?? null };
}

function timelineLabelForAction(action: string) {
  const labels: Record<string, string> = {
    CUSTOMER_CREATED: "고객이 등록되었습니다.",
    CUSTOMER_UPDATED: "고객 정보가 수정되었습니다.",
    CUSTOMER_DEACTIVATED: "고객이 삭제 처리되었습니다.",
    CUSTOMER_DELETED_SOFT: "고객이 삭제 처리되었습니다.",
    CUSTOMER_RESTORED: "고객이 복구되었습니다.",
    CUSTOMER_PRIORITY_UPDATED: "고객 우선순위가 변경되었습니다.",
    CUSTOMER_TAGS_UPDATED: "고객 성향 태그가 변경되었습니다.",
    CUSTOMER_NEXT_ACTION_UPDATED: "다음 액션이 변경되었습니다.",
    CONTRACT_CREATED: "계약이 등록되었습니다.",
    CONTRACT_UPDATED: "계약이 수정되었습니다.",
    CONTRACT_DEACTIVATED: "계약이 삭제 처리되었습니다.",
    CONTRACT_DEACTIVATED_BY_REQUEST: "계약 삭제 요청이 승인되었습니다.",
    CONTRACT_RESTORED: "계약이 복구되었습니다.",
    PERMANENT_DELETE_BLOCKED: "완전삭제가 차단되었습니다.",
    DELETE_REQUEST_CREATED: "삭제 요청이 생성되었습니다.",
    DELETE_REQUEST_APPROVED: "삭제 요청이 승인되었습니다.",
    DELETE_REQUEST_REJECTED: "삭제 요청이 반려되었습니다.",
    CUSTOMER_MERGED: "고객 병합이 실행되었습니다.",
    CUSTOMER_MERGE_BLOCKED: "고객 병합이 차단되었습니다.",
  };
  return labels[action] ?? action;
}

function timelineSeverity(eventType: string): CustomerTimelineEvent["severity"] {
  if (eventType.includes("deleted") || eventType.includes("blocked") || eventType.includes("rejected")) return "warning";
  if (eventType.includes("restored") || eventType.includes("completed") || eventType.includes("approved")) return "success";
  if (eventType.includes("contract")) return "info";
  return "normal";
}

export async function getCustomerTimeline(customerId: number, filter: CustomerTimelineFilter = {}) {
  const db = await getDb();
  if (!db) return { items: [], totalCount: 0 };

  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const [
    customerRows,
    userRows,
    consultationRows,
    contractRows,
    followUpRows,
    assignmentRows,
    statusRows,
    relatedNotificationRows,
    requestRows,
  ] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)).limit(1),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users),
    db.select().from(consultations).where(eq(consultations.customerId, customerId)),
    db.select().from(contracts).where(eq(contracts.customerId, customerId)),
    db.select().from(followUps).where(eq(followUps.customerId, customerId)),
    db.select().from(assignmentHistory).where(eq(assignmentHistory.customerId, customerId)),
    db.select().from(statusHistory).where(eq(statusHistory.customerId, customerId)),
    db.select().from(notifications).where(and(eq(notifications.relatedType, "customer"), eq(notifications.relatedId, customerId))),
    db.select().from(deleteRequests).where(eq(deleteRequests.customerId, customerId)),
  ]);

  const customer = customerRows[0];
  const userMap = new Map(userRows.map((user) => [user.id, { name: user.name, role: user.role }]));
  const contractIds = contractRows.map((contract) => contract.id);
  const requestIds = requestRows.map((request) => request.id);
  const [contractHistoryRows, contractNotificationRows, customerActivityRows, contractActivityRows, requestActivityRows] = await Promise.all([
    contractIds.length > 0 ? db.select().from(contractHistory).where(inArray(contractHistory.contractId, contractIds)) : Promise.resolve([]),
    contractIds.length > 0 ? db.select().from(notifications).where(and(eq(notifications.relatedType, "contract"), inArray(notifications.relatedId, contractIds))) : Promise.resolve([]),
    db.select().from(activityLogs).where(and(eq(activityLogs.targetType, "customer"), eq(activityLogs.targetId, customerId))).limit(200),
    contractIds.length > 0 ? db.select().from(activityLogs).where(and(eq(activityLogs.targetType, "contract"), inArray(activityLogs.targetId, contractIds))).limit(200) : Promise.resolve([]),
    requestIds.length > 0 ? db.select().from(activityLogs).where(and(eq(activityLogs.targetType, "delete_request"), inArray(activityLogs.targetId, requestIds))).limit(200) : Promise.resolve([]),
  ]);

  const events: CustomerTimelineEvent[] = [];
  const pushEvent = (event: CustomerTimelineEvent) => events.push(event);

  if (customer?.createdAt) {
    pushEvent({
      id: `customer:${customer.id}:created`,
      eventType: "customer_created",
      eventLabel: "고객이 등록되었습니다.",
      occurredAt: customer.createdAt,
      ...userLabel(userMap, customer.createdBy),
      source: "customers",
      summary: `${customer.name} 고객 등록`,
      detail: null,
      metadata: { consultStatus: customer.consultStatus, priority: customer.priority },
      severity: "normal",
      relatedId: customer.id,
      relatedType: "customer",
    });
  }

  for (const row of consultationRows) {
    const updated = row.updatedAt && row.updatedAt.getTime() !== row.createdAt.getTime();
    pushEvent({
      id: `consultation:${row.id}`,
      eventType: updated ? "consultation_updated" : "consultation_created",
      eventLabel: updated ? "상담기록이 수정되었습니다." : "상담기록이 추가되었습니다.",
      occurredAt: updated ? row.updatedAt : row.createdAt,
      ...userLabel(userMap, row.agentId),
      source: "consultations",
      summary: row.summary ?? `${row.consultationType ?? "상담"} / ${row.customerNeed ?? row.status}`,
      detail: truncateTimelineText(row.content, 140),
      metadata: safeTimelineMetadata({ status: row.status, consultationType: row.consultationType, customerNeed: row.customerNeed, nextAction: row.nextAction }),
      severity: "info",
      relatedId: row.id,
      relatedType: "consultation",
    });
  }

  for (const row of contractRows) {
    const deleted = row.isActive === false || !!row.deletedAt;
    pushEvent({
      id: `contract:${row.id}`,
      eventType: deleted ? "contract_deleted" : "contract_created",
      eventLabel: deleted ? "계약이 삭제 처리되었습니다." : "계약이 등록되었습니다.",
      occurredAt: row.deletedAt ?? row.createdAt,
      ...userLabel(userMap, row.createdBy ?? row.agentId),
      source: "contracts",
      summary: `${row.company ?? "보험사 미입력"} / ${row.productName ?? "상품명 미입력"}`,
      detail: null,
      metadata: safeTimelineMetadata({ productGroup: row.productGroup, contractStatus: row.contractStatus, paymentStatus: row.paymentStatus, monthlyPremium: row.monthlyPremium }),
      severity: deleted ? "warning" : "info",
      relatedId: row.id,
      relatedType: "contract",
    });
  }

  for (const row of contractHistoryRows) {
    pushEvent({
      id: `contract_history:${row.id}`,
      eventType: "contract_updated",
      eventLabel: "계약 이력이 기록되었습니다.",
      occurredAt: row.createdAt,
      ...userLabel(userMap, row.changedBy),
      source: "contract_history",
      summary: `${row.fieldName} 변경`,
      detail: null,
      metadata: safeTimelineMetadata({ fieldName: row.fieldName, beforeValue: row.beforeValue, afterValue: row.afterValue }),
      severity: row.fieldName === "isActive" ? "warning" : "info",
      relatedId: row.contractId,
      relatedType: "contract",
    });
  }

  for (const row of followUpRows) {
    const eventType = row.status === "completed" ? "follow_up_completed" : row.status === "cancelled" ? "follow_up_cancelled" : "follow_up_created";
    pushEvent({
      id: `follow_up:${row.id}`,
      eventType,
      eventLabel: row.status === "completed" ? "후속관리가 완료되었습니다." : row.status === "cancelled" ? "후속관리가 취소되었습니다." : "다음 연락일이 설정되었습니다.",
      occurredAt: row.completedAt ?? row.updatedAt ?? row.createdAt,
      ...userLabel(userMap, row.createdBy),
      source: "follow_ups",
      summary: `${row.nextAction} / ${row.reason}`,
      detail: truncateTimelineText(row.memo, 100),
      metadata: safeTimelineMetadata({ nextContactDate: row.nextContactDate, status: row.status }),
      severity: row.status === "completed" ? "success" : row.status === "cancelled" ? "warning" : "normal",
      relatedId: row.id,
      relatedType: "follow_up",
    });
  }

  for (const row of assignmentRows) {
    pushEvent({
      id: `assignment:${row.id}`,
      eventType: "assignment_changed",
      eventLabel: "담당자 또는 배정 범위가 변경되었습니다.",
      occurredAt: row.createdAt,
      ...userLabel(userMap, row.assignedBy),
      source: "assignment_history",
      summary: row.assignmentType ?? "배정 변경",
      detail: truncateTimelineText(row.assignmentReason, 120),
      metadata: safeTimelineMetadata({
        previousSubBranchAdminId: row.previousSubBranchAdminId,
        newSubBranchAdminId: row.newSubBranchAdminId,
        previousTeamId: row.previousTeamId,
        newTeamId: row.newTeamId,
        previousAgentId: row.previousAgentId,
        newAgentId: row.newAgentId,
      }),
      severity: "info",
      relatedId: row.id,
      relatedType: "assignment_history",
    });
  }

  for (const row of statusRows) {
    pushEvent({
      id: `status:${row.id}`,
      eventType: "customer_updated",
      eventLabel: "상담상태가 변경되었습니다.",
      occurredAt: row.createdAt,
      ...userLabel(userMap, row.changedBy),
      source: "status_history",
      summary: `${row.previousStatus ?? "-"} -> ${row.newStatus}`,
      detail: truncateTimelineText(row.note, 100),
      metadata: safeTimelineMetadata({ previousStatus: row.previousStatus, newStatus: row.newStatus }),
      severity: "normal",
      relatedId: row.id,
      relatedType: "status_history",
    });
  }

  for (const row of [...relatedNotificationRows, ...contractNotificationRows]) {
    const changed = row.isRead || row.processStatus !== "미확인";
    pushEvent({
      id: `notification:${row.id}`,
      eventType: changed ? "notification_status_changed" : "notification_created",
      eventLabel: changed ? "알림 상태가 변경되었습니다." : "알림이 생성되었습니다.",
      occurredAt: row.createdAt,
      ...userLabel(userMap, row.userId),
      source: "notifications",
      summary: row.title,
      detail: truncateTimelineText(row.message, 120),
      metadata: safeTimelineMetadata({ type: row.type, processStatus: row.processStatus, isRead: row.isRead, relatedType: row.relatedType, relatedId: row.relatedId }),
      severity: changed ? "success" : "warning",
      relatedId: row.id,
      relatedType: "notification",
    });
  }

  for (const row of requestRows) {
    pushEvent({
      id: `delete_request:${row.id}`,
      eventType: row.status === "approved" ? "delete_request_approved" : row.status === "rejected" ? "delete_request_rejected" : "delete_request_created",
      eventLabel: row.status === "approved" ? "삭제 요청이 승인되었습니다." : row.status === "rejected" ? "삭제 요청이 반려되었습니다." : "삭제 요청이 생성되었습니다.",
      occurredAt: row.reviewedAt ?? row.updatedAt ?? row.createdAt,
      ...userLabel(userMap, row.requestedBy),
      source: "delete_requests",
      summary: row.requestReason,
      detail: truncateTimelineText(row.reviewComment ?? row.requestMemo, 120),
      metadata: safeTimelineMetadata({ requestType: row.requestType, status: row.status, expectedImpact: row.expectedImpact }),
      severity: row.status === "approved" ? "warning" : row.status === "rejected" ? "normal" : "info",
      relatedId: row.id,
      relatedType: "delete_request",
    });
  }

  for (const row of [...customerActivityRows, ...contractActivityRows, ...requestActivityRows]) {
    pushEvent({
      id: `activity:${row.id}`,
      eventType: row.action.toLowerCase(),
      eventLabel: timelineLabelForAction(row.action),
      occurredAt: row.createdAt,
      ...userLabel(userMap, row.userId),
      source: "activity_logs",
      summary: timelineLabelForAction(row.action),
      detail: null,
      metadata: parseLogDetails(row.details),
      severity: timelineSeverity(row.action.toLowerCase()),
      relatedId: row.targetId ?? null,
      relatedType: row.targetType ?? null,
    });
  }

  const from = filter.dateFrom?.getTime();
  const to = filter.dateTo?.getTime();
  const eventTypes = new Set(filter.eventTypes ?? []);
  const filtered = events
    .filter((event) => !from || event.occurredAt.getTime() >= from)
    .filter((event) => !to || event.occurredAt.getTime() <= to)
    .filter((event) => eventTypes.size === 0 || eventTypes.has(event.eventType) || eventTypes.has(event.source))
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return { items: filtered.slice(0, limit), totalCount: filtered.length };
}

export async function getPerformanceStats(filter: {
  agentId?: number;
  teamId?: number;
  subBranchAdminId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  productGroup?: string;
  company?: string;
  region?: string;
  source?: string;
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
  // 계약 필터 (상품군, 보험사)
  if (filter.productGroup) dateConditions.push(eq(contracts.productGroup, filter.productGroup));
  if (filter.company) dateConditions.push(eq(contracts.company, filter.company));

  // 고객 필터 (지역, 유입경로)
  const customerConditions: any[] = [activeCondition];
  if (filter.region) customerConditions.push(eq(customers.region, filter.region));
  if (filter.source) customerConditions.push(eq(customers.source, filter.source));
  const customerBaseCondition = customerConditions.length > 1 ? and(...customerConditions) : activeCondition;

  if (filter.agentId !== undefined) {
    customerList = await db.select().from(customers).where(and(eq(customers.agentId, filter.agentId), customerBaseCondition as any));
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


// ─── Bulk Import Helpers ─────────────────────────────────────────────────────
/** 연락처 정규화 (숫자만 추출) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return undefined;
}

export function normalizeBulkImportRow(row: Record<string, unknown>): BulkImportRow {
  return {
    name: pickString(row, "name", "이름"),
    phone: pickString(row, "phone", "연락처"),
    birthDate: pickString(row, "birthDate", "생년월일"),
    gender: pickString(row, "gender", "성별"),
    region: pickString(row, "region", "지역"),
    expectedPremium: pickString(row, "expectedPremium", "예상보험료"),
    availableTime: pickString(row, "availableTime", "통화가능시간"),
    source: pickString(row, "source", "유입경로"),
    consultStatus: pickString(row, "consultStatus", "상담상태"),
    memo: pickString(row, "memo", "메모"),
    subBranchAdminName: pickString(row, "subBranchAdminName", "부지점장"),
    teamName: pickString(row, "teamName", "팀"),
    agentName: pickString(row, "agentName", "담당자"),
  };
}

/** 금지 컬럼 감지 */
export function detectForbiddenColumns(headers: string[]): string[] {
  const forbiddenPatterns = [
    /주민등록번호|주민번호|ssn|resident|identification/i,
    /증권번호|policy|증권/i,
    /신분증|id.?number|identification/i,
    /병력|medical|health.?history/i,
    /계좌번호|account.?number|bank/i,
    /카드번호|card.?number|credit/i,
  ];
  return headers.filter((h) =>
    forbiddenPatterns.some((pattern) => pattern.test(h))
  );
}

/** 동명이인 검증 (정확히 1명과 매칭되어야 함) */
export async function findUserByNameUnique(
  name: string,
  role?: "sub_branch_admin" | "team_leader" | "member"
): Promise<{ user: User | undefined; isDuplicate: boolean }> {
  const db = await getDb();
  if (!db) return { user: undefined, isDuplicate: false };

  const conditions: ReturnType<typeof eq>[] = [
    eq(users.name, name),
    eq(users.accountStatus, "active"),
  ];
  if (role) conditions.push(eq(users.role, role));

  const results = await db
    .select()
    .from(users)
    .where(and(...conditions));

  if (results.length === 0) return { user: undefined, isDuplicate: false };
  if (results.length === 1) return { user: results[0], isDuplicate: false };
  return { user: undefined, isDuplicate: true };
}

/** 팀 이름으로 팀 조회 (부지점장 ID 기반 필터링) */
export async function findTeamByNameAndSubBranch(
  teamName: string,
  subBranchAdminId: number
): Promise<Team | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const results = await db
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.name, teamName),
        eq(teams.subBranchAdminId, subBranchAdminId),
        eq(teams.isActive, true)
      )
    )
    .limit(1);

  return results[0];
}

/** 일괄 업로드 데이터 검증 */
export interface BulkImportRow {
  name?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  region?: string;
  expectedPremium?: string;
  availableTime?: string;
  source?: string;
  consultStatus?: string;
  memo?: string;
  subBranchAdminName?: string;
  teamName?: string;
  agentName?: string;
}

export interface BulkImportValidationResult {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  normalizedPhone?: string;
  agentId?: number;
  subBranchAdminId?: number;
  teamId?: number;
  assignmentStatus?: "unassigned" | "assigned_to_sub_branch" | "assigned_to_agent";
}

export async function validateBulkImportRow(
  sourceRow: BulkImportRow,
  rowIndex: number,
  existingPhones: Set<string>,
  filePhones: Set<string>
): Promise<BulkImportValidationResult> {
  const row = normalizeBulkImportRow(sourceRow as Record<string, unknown>);
  const errors: string[] = [];
  let normalizedPhone: string | undefined;
  let agentId: number | undefined;
  let subBranchAdminId: number | undefined;
  let teamId: number | undefined;
  let assignmentStatus: "unassigned" | "assigned_to_sub_branch" | "assigned_to_agent" = "unassigned";

  // 필수값 검증
  if (!row.name || row.name.trim() === "") {
    errors.push("이름이 필수입니다.");
  }
  if (!row.phone || row.phone.trim() === "") {
    errors.push("연락처가 필수입니다.");
  } else {
    normalizedPhone = normalizePhone(row.phone);
    if (normalizedPhone.length < 10) {
      errors.push("연락처 형식이 올바르지 않습니다. (최소 10자리)");
    } else {
      // 파일 내부 중복 검증
      if (filePhones.has(normalizedPhone)) {
        errors.push(`연락처가 파일 내 중복됩니다. (${row.phone})`);
      } else {
        filePhones.add(normalizedPhone);
      }

      // 기존 DB 중복 검증
      if (existingPhones.has(normalizedPhone)) {
        errors.push(`연락처가 기존 DB에 존재합니다. (${row.phone})`);
      }
    }
  }

  // 생년월일 형식 검증
  if (row.birthDate && row.birthDate.trim() !== "") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(row.birthDate)) {
      errors.push(`생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD 형식 필수)`);
    }
  }

  // 예상보험료 숫자 검증
  if (row.expectedPremium && row.expectedPremium.trim() !== "") {
    if (isNaN(Number(row.expectedPremium))) {
      errors.push("예상보험료는 숫자여야 합니다.");
    }
  }

  // 성별 값 검증
  if (row.gender && row.gender.trim() !== "") {
    const validGenders = ["남", "여", "기타", "male", "female", "other"];
    if (!validGenders.includes(row.gender)) {
      errors.push(`성별 값이 올바르지 않습니다. (${row.gender})`);
    }
  }

  // 상담상태 값 검증
  if (row.consultStatus && row.consultStatus.trim() !== "") {
    const validStatuses = [
      "미상담",
      "부재",
      "통화완료",
      "상담예정",
      "설계중",
      "계약",
      "보류",
      "거절",
      "해지관리",
      "재상담필요",
    ];
    if (!validStatuses.includes(row.consultStatus)) {
      errors.push(`상담상태 값이 올바르지 않습니다. (${row.consultStatus})`);
    }
  }

  // 조직 정합성 검증 (부지점장, 팀, 담당자)
  if (row.subBranchAdminName && row.subBranchAdminName.trim() !== "") {
    const { user, isDuplicate } = await findUserByNameUnique(
      row.subBranchAdminName,
      "sub_branch_admin"
    );
    if (isDuplicate) {
      errors.push(
        `부지점장 이름이 2명 이상과 일치합니다. 고유 식별값을 입력해주세요. (${row.subBranchAdminName})`
      );
    } else if (!user) {
      errors.push(
        `부지점장을 찾을 수 없습니다. (${row.subBranchAdminName})`
      );
    } else {
      subBranchAdminId = user.id;
    }
  }

  if (row.teamName && row.teamName.trim() !== "") {
    if (!subBranchAdminId) {
      errors.push("팀을 지정하려면 부지점장이 필요합니다.");
    } else {
      const team = await findTeamByNameAndSubBranch(row.teamName, subBranchAdminId);
      if (!team) {
        errors.push(
          `팀을 찾을 수 없습니다. (${row.teamName})`
        );
      } else {
        teamId = team.id;
      }
    }
  }

  if (row.agentName && row.agentName.trim() !== "") {
    const { user, isDuplicate } = await findUserByNameUnique(
      row.agentName
    );
    if (isDuplicate) {
      errors.push(
        `담당자 이름이 2명 이상과 일치합니다. 고유 식별값을 입력해주세요. (${row.agentName})`
      );
    } else if (!user) {
      errors.push(
        `담당자를 찾을 수 없습니다. (${row.agentName})`
      );
    } else {
      if (user.role !== "team_leader" && user.role !== "member") {
        errors.push(`담당자는 팀장 또는 팀원이어야 합니다. (${row.agentName})`);
      } else {
        agentId = user.id;
      }
      // 담당자의 subBranchAdminId/teamId 자동 적용
      if (!subBranchAdminId && user.subBranchAdminId) {
        subBranchAdminId = user.subBranchAdminId;
      }
      if (!teamId && user.teamId) {
        teamId = user.teamId;
      }
      if (subBranchAdminId && user.subBranchAdminId && subBranchAdminId !== user.subBranchAdminId) {
        errors.push("담당자의 부지점장 소속이 지정한 부지점장과 일치하지 않습니다.");
      }
      if (teamId && user.teamId && teamId !== user.teamId) {
        errors.push("담당자의 팀 소속이 지정한 팀과 일치하지 않습니다.");
      }
    }
  }

  // assignmentStatus 계산
  if (agentId) {
    assignmentStatus = "assigned_to_agent";
  } else if (subBranchAdminId) {
    assignmentStatus = "assigned_to_sub_branch";
  }

  return {
    rowIndex,
    isValid: errors.length === 0,
    errors,
    normalizedPhone,
    agentId,
    subBranchAdminId,
    teamId,
    assignmentStatus,
  };
}

/** 기존 DB의 모든 활성 고객 연락처 조회 */
export async function getAllActiveCustomerPhones(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();

  const results = await db
    .select({ phone: customers.phone })
    .from(customers)
    .where(eq(customers.isActive, true));

  const phoneSet = new Set<string>();
  results.forEach((r) => {
    if (r.phone) {
      phoneSet.add(normalizePhone(r.phone));
    }
  });
  return phoneSet;
}

/** 일괄 고객 생성 */
export async function bulkCreateCustomers(
  rows: Array<{
    name: string;
    phone?: string;
    birthDate?: Date;
    gender?: "male" | "female" | "other";
    region?: string;
    expectedPremium?: number;
    availableTime?: string;
    source?: string;
    consultStatus: string;
    memo?: string;
    agentId?: number;
    subBranchAdminId?: number;
    assignedTeamId?: number;
	    assignmentStatus: "unassigned" | "assigned_to_sub_branch" | "assigned_to_agent";
	    createdBy: number;
	    importBatchId?: string;
	    importedBy?: number;
	    importedAt?: Date;
	  }>
	  , client?: DbExecutor
	) {
	  const db = client ?? await getDb();
	  if (!db) return [];

  const insertData = rows.map((row) => ({
    name: row.name,
    phone: row.phone,
    birthDate: row.birthDate,
    gender: row.gender,
    region: row.region,
    expectedPremium: row.expectedPremium,
    availableTime: row.availableTime,
    source: row.source,
    consultStatus: row.consultStatus as any,
    memo: row.memo,
    agentId: row.agentId,
    subBranchAdminId: row.subBranchAdminId,
    assignedTeamId: row.assignedTeamId,
	    assignmentStatus: row.assignmentStatus,
	    createdBy: row.createdBy,
	    importBatchId: row.importBatchId,
	    importedBy: row.importedBy,
	    importedAt: row.importedAt,
	    isActive: true,
    assignedAt: row.agentId ? new Date() : undefined,
  }));

  const result = await db.insert(customers).values(insertData);
  return result;
}

export async function createImportBatch(data: InsertImportBatch, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.insert(importBatches).values(data);
}

export async function getImportBatchByBatchId(importBatchId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(importBatches).where(eq(importBatches.importBatchId, importBatchId)).limit(1);
  return result[0];
}

export async function listImportBatches(filter: {
  dateFrom?: Date;
  dateTo?: Date;
  status?: "active" | "cancelled" | "partially_cancelled" | "failed";
  uploadedBy?: number;
  search?: string;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter.dateFrom) conditions.push(gte(importBatches.createdAt, filter.dateFrom));
  if (filter.dateTo) conditions.push(lte(importBatches.createdAt, filter.dateTo));
  if (filter.status) conditions.push(eq(importBatches.status, filter.status));
  if (filter.uploadedBy !== undefined) conditions.push(eq(importBatches.uploadedBy, filter.uploadedBy));
  if (filter.search) {
    const q = `%${filter.search.trim()}%`;
    conditions.push(or(sql`${importBatches.importBatchId} like ${q}`, sql`${importBatches.fileName} like ${q}`));
  }
  return db.select().from(importBatches)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(importBatches.createdAt));
}

export async function updateImportBatch(
  importBatchId: string,
  data: Partial<typeof importBatches.$inferInsert>,
  client?: DbExecutor,
) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(importBatches).set(data).where(eq(importBatches.importBatchId, importBatchId));
}

export async function getCustomersByImportBatch(importBatchId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customers)
    .where(eq(customers.importBatchId, importBatchId))
    .orderBy(desc(customers.createdAt));
}

export async function softDeleteCustomersByImportBatch(importBatchId: string, client?: DbExecutor) {
  const db = client ?? await getDb();
  if (!db) return;
  await db.update(customers)
    .set({ isActive: false, deletedAt: new Date() })
    .where(and(eq(customers.importBatchId, importBatchId), eq(customers.isActive, true)));
}

export async function getImportBatchCancelBlockers(importBatchId: string) {
  const db = await getDb();
  const empty = {
    activeContracts: 0,
    consultations: 0,
    statusHistory: 0,
    notifications: 0,
    reminders: 0,
    assignmentHistory: 0,
    deleteRequests: 0,
    consentLogs: 0,
    blockedCustomerIds: [] as number[],
  };
  if (!db) return empty;
  const batchCustomers = await db.select({ id: customers.id }).from(customers).where(eq(customers.importBatchId, importBatchId));
  const customerIds = batchCustomers.map((c) => c.id);
  if (customerIds.length === 0) return empty;
  const [
    activeContracts,
    consultationRows,
    statusRows,
    notificationRows,
    reminderRows,
    assignmentRows,
    requestRows,
    consentRows,
  ] = await Promise.all([
    db.select({ customerId: contracts.customerId }).from(contracts)
      .where(and(inArray(contracts.customerId, customerIds), eq(contracts.isActive, true))),
    db.select({ customerId: consultations.customerId }).from(consultations)
      .where(inArray(consultations.customerId, customerIds)),
    db.select({ customerId: statusHistory.customerId }).from(statusHistory)
      .where(inArray(statusHistory.customerId, customerIds)),
    db.select({ relatedId: notifications.relatedId }).from(notifications)
      .where(and(eq(notifications.relatedType, "customer"), inArray(notifications.relatedId, customerIds))),
    db.select({ relatedId: reminders.relatedId }).from(reminders)
      .where(and(eq(reminders.relatedType, "customer"), inArray(reminders.relatedId, customerIds))),
    db.select({ customerId: assignmentHistory.customerId }).from(assignmentHistory)
      .where(inArray(assignmentHistory.customerId, customerIds)),
    db.select({ customerId: deleteRequests.customerId }).from(deleteRequests)
      .where(inArray(deleteRequests.customerId, customerIds)),
    db.select({ customerId: consentLogs.customerId }).from(consentLogs)
      .where(inArray(consentLogs.customerId, customerIds)),
  ]);
  const blocked = new Set<number>();
  for (const row of activeContracts) blocked.add(row.customerId);
  for (const row of consultationRows) blocked.add(row.customerId);
  for (const row of statusRows) blocked.add(row.customerId);
  for (const row of notificationRows) if (row.relatedId != null) blocked.add(row.relatedId);
  for (const row of reminderRows) if (row.relatedId != null) blocked.add(row.relatedId);
  for (const row of assignmentRows) blocked.add(row.customerId);
  for (const row of requestRows) blocked.add(row.customerId);
  for (const row of consentRows) blocked.add(row.customerId);
  return {
    activeContracts: activeContracts.length,
    consultations: consultationRows.length,
    statusHistory: statusRows.length,
    notifications: notificationRows.length,
    reminders: reminderRows.length,
    assignmentHistory: assignmentRows.length,
    deleteRequests: requestRows.length,
    consentLogs: consentRows.length,
    blockedCustomerIds: Array.from(blocked),
  };
}
