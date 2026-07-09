import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  emptyCustomerSegmentCounts,
  getConcreteCustomerSegment,
  type CustomerSegment,
  type CustomerSegmentCounts,
} from "@shared/customerSegment";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  assignmentHistory,
  consentLogs,
  consultations,
  consultationChecklists,
  consultationCheckResults,
  consultationScripts,
  contractHistory,
  contracts,
  customerHandoffNotes,
  customerRelationships,
  customers,
  deleteRequests,
  followUps,
  handoffHistories,
  importBatches,
  InsertActivityLog,
  InsertAssignmentHistory,
  InsertConsentLog,
  InsertConsultation,
  InsertConsultationChecklist,
  InsertConsultationCheckResult,
  InsertConsultationScript,
  InsertContract,
  InsertContractHistory,
  InsertCustomer,
  InsertCustomerHandoffNote,
  InsertDeleteRequest,
  InsertFollowUp,
  InsertImportBatch,
  InsertNotification,
  InsertOnboardingTemplate,
  InsertOnboardingTemplateItem,
  InsertPushNotificationPreference,
  InsertPushNotificationLog,
  InsertSchedule,
  InsertStatusHistory,
  InsertMessageTemplate,
  InsertUserDeviceToken,
  messageTemplates,
  notifications,
  onboardingTemplateItems,
  onboardingTemplates,
  performanceGoals,
  pushNotificationPreferences,
  pushNotificationLogs,
  reminders,
  schedules,
  settings,
  statusHistory,
  teams,
  userOnboardingAssignments,
  userOnboardingItemProgress,
  userDeviceTokens,
  userPermissions,
  Team,
  users,
  User,
  InsertUserOnboardingAssignment,
  InsertUserOnboardingItemProgress,
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
  sourceUser: Pick<
    User,
    | "id"
    | "name"
    | "email"
    | "role"
    | "accountStatus"
    | "teamId"
    | "subBranchAdminId"
  >;
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

export type PerformanceGoalTargetType =
  | "branch"
  | "sub_branch"
  | "team"
  | "user";

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

export async function runDbTransaction<T>(
  callback: (tx: DbExecutor) => Promise<T>
): Promise<T | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async tx => callback(tx as DbExecutor));
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(
  user: typeof users.$inferInsert
): Promise<void> {
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

  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

async function permissionsByUserIds(userIds: number[]) {
  const db = await getDb();
  if (!db || userIds.length === 0) return new Map<number, string[]>();
  const rows = await db
    .select({
      userId: userPermissions.userId,
      permission: userPermissions.permission,
    })
    .from(userPermissions)
    .where(inArray(userPermissions.userId, userIds));
  const map = new Map<number, string[]>();
  for (const row of rows) {
    const permissions = map.get(row.userId) ?? [];
    permissions.push(row.permission);
    map.set(row.userId, permissions);
  }
  return map;
}

async function attachPermissions<T extends { id: number }>(rows: T[]) {
  const map = await permissionsByUserIds(rows.map(row => row.id));
  return rows.map(row => ({ ...row, permissions: map.get(row.id) ?? [] }));
}

export async function getUserPermissions(userId: number) {
  const map = await permissionsByUserIds([userId]);
  return map.get(userId) ?? [];
}

export async function createUser(data: {
  name: string;
  email: string;
  role: "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
  accountStatus?: "active" | "inactive" | "resigned";
  loginStatus?: "invited" | "linked";
  parentUserId?: number | null;
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
    parentUserId: data.parentUserId ?? null,
    teamId: data.teamId ?? null,
    subBranchAdminId: data.subBranchAdminId ?? null,
    phone: data.phone ?? null,
    memo: data.memo ?? null,
    lastSignedIn: new Date(),
  });
  const newUser = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email.toLowerCase()))
    .limit(1);
  return newUser[0] ?? null;
}

export async function linkUserOpenId(userId: number, openId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ openId, loginStatus: "linked", lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return (await attachPermissions(result))[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return attachPermissions(rows);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return (await attachPermissions(result))[0];
}

export async function setUserPermission(
  userId: number,
  permission: string,
  enabled: boolean,
  grantedBy?: number
) {
  const db = await getDb();
  if (!db) return;
  if (!enabled) {
    await db
      .delete(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permission, permission)
        )
      );
    return;
  }
  await db
    .insert(userPermissions)
    .values({
      userId,
      permission,
      grantedBy: grantedBy ?? null,
    })
    .onDuplicateKeyUpdate({
      set: { grantedBy: grantedBy ?? null, grantedAt: new Date() },
    });
}

export async function updateUserRole(
  id: number,
  role: "branch_admin" | "sub_branch_admin" | "team_leader" | "member"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserAccountStatus(
  id: number,
  accountStatus: "active" | "inactive" | "resigned"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ accountStatus }).where(eq(users.id, id));
}

export async function updateUserParent(
  id: number,
  parentUserId: number | null
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ parentUserId }).where(eq(users.id, id));
}

export async function updateUserOrganization(
  id: number,
  data: {
    parentUserId: number | null;
    teamId: number | null;
    subBranchAdminId: number | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
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
  await db
    .update(users)
    .set({ teamId, subBranchAdminId })
    .where(eq(users.id, id));
}

export async function updateUserSubBranchAdmin(
  id: number,
  subBranchAdminId: number | null
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ subBranchAdminId }).where(eq(users.id, id));
}

export async function invalidateUserSessions(
  id: number,
  invalidatedAt = new Date()
) {
  const db = await getDb();
  if (!db) return 0;
  await db
    .update(users)
    .set({ sessionInvalidatedAt: invalidatedAt })
    .where(eq(users.id, id));
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
  await db
    .update(users)
    .set({
      openId: invitedOpenId,
      loginStatus: "invited",
      sessionInvalidatedAt: now,
    })
    .where(eq(users.id, id));
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

async function getHandoffSourceCustomerIds(
  sourceUserId: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return [];
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.agentId, sourceUserId),
        eq(customers.isActive, true),
        isNull(customers.deletedAt)
      )
    );
  return rows.map((row: { id: number }) => row.id);
}

async function countRows(table: any, condition: any, client?: DbExecutor) {
  const db = client ?? (await getDb());
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(table)
    .where(condition);
  return Number(result[0]?.count ?? 0);
}

export async function getHandoffPreview(
  sourceUserId: number
): Promise<HandoffPreview | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const source = await getUserById(sourceUserId);
  if (!source) return undefined;
  const activeCustomerIds = await getHandoffSourceCustomerIds(sourceUserId, db);
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    softDeletedCustomers,
    activeContracts,
    pendingFollowUps,
    pendingSchedules,
    pendingNotifications,
    consultationsCount,
    recentActivityLogs,
  ] = await Promise.all([
    countRows(
      customers,
      and(
        eq(customers.agentId, sourceUserId),
        or(
          eq(customers.isActive, false),
          sql`${customers.deletedAt} is not null`
        )
      ),
      db
    ),
    activeCustomerIds.length > 0
      ? countRows(
          contracts,
          and(
            inArray(contracts.customerId, activeCustomerIds),
            eq(contracts.isActive, true),
            isNull(contracts.deletedAt)
          ),
          db
        )
      : Promise.resolve(0),
    countRows(
      followUps,
      and(
        eq(followUps.assignedAgentId, sourceUserId),
        or(
          eq(followUps.status, "scheduled"),
          eq(followUps.status, "postponed")
        ),
        isNull(followUps.deletedAt)
      ),
      db
    ),
    countRows(
      schedules,
      and(
        eq(schedules.userId, sourceUserId),
        eq(schedules.isActive, true),
        isNull(schedules.completedAt)
      ),
      db
    ),
    countRows(
      notifications,
      and(
        eq(notifications.userId, sourceUserId),
        eq(notifications.isRead, false)
      ),
      db
    ),
    activeCustomerIds.length > 0
      ? countRows(
          consultations,
          inArray(consultations.customerId, activeCustomerIds),
          db
        )
      : Promise.resolve(0),
    countRows(
      activityLogs,
      and(
        eq(activityLogs.userId, sourceUserId),
        gte(activityLogs.createdAt, recentCutoff)
      ),
      db
    ),
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

export async function getHandoffHistories(filter?: {
  sourceUserId?: number;
  targetUserId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter?.sourceUserId !== undefined)
    conditions.push(eq(handoffHistories.sourceUserId, filter.sourceUserId));
  if (filter?.targetUserId !== undefined)
    conditions.push(eq(handoffHistories.targetUserId, filter.targetUserId));
  return db
    .select()
    .from(handoffHistories)
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
  const afterStatus =
    input.updateSourceAccountStatus === "keep"
      ? source.accountStatus
      : input.updateSourceAccountStatus;
  const targetSubBranchAdminId =
    target.role === "sub_branch_admin"
      ? target.id
      : (target.subBranchAdminId ?? null);

  return db.transaction(async tx => {
    const client = tx as DbExecutor;
    const activeCustomerIds = await getHandoffSourceCustomerIds(
      input.sourceUserId,
      client
    );
    const movedCounts = {
      customers: 0,
      contracts: 0,
      followUps: 0,
      schedules: 0,
      notifications: 0,
    };

    if (input.transferCustomers && activeCustomerIds.length > 0) {
      const sourceCustomers = await client
        .select({
          id: customers.id,
          previousAgentId: customers.agentId,
          previousTeamId: customers.assignedTeamId,
          previousSubBranchAdminId: customers.subBranchAdminId,
        })
        .from(customers)
        .where(inArray(customers.id, activeCustomerIds));

      await client
        .update(customers)
        .set({
          agentId: input.targetUserId,
          assignedTeamId: target.teamId ?? null,
          subBranchAdminId: targetSubBranchAdminId,
          assignmentStatus: "assigned_to_agent",
          assignedAt: now,
        })
        .where(inArray(customers.id, activeCustomerIds));
      movedCounts.customers = sourceCustomers.length;

      await client
        .update(contracts)
        .set({ agentId: input.targetUserId })
        .where(
          and(
            inArray(contracts.customerId, activeCustomerIds),
            eq(contracts.agentId, input.sourceUserId)
          )
        );
      movedCounts.contracts = await countRows(
        contracts,
        and(
          inArray(contracts.customerId, activeCustomerIds),
          eq(contracts.agentId, input.targetUserId),
          eq(contracts.isActive, true),
          isNull(contracts.deletedAt)
        ),
        client
      );

      for (const customer of sourceCustomers) {
        await createAssignmentHistory(
          {
            customerId: customer.id,
            previousSubBranchAdminId: customer.previousSubBranchAdminId ?? null,
            newSubBranchAdminId: targetSubBranchAdminId,
            previousTeamId: customer.previousTeamId ?? null,
            newTeamId: target.teamId ?? null,
            previousAgentId: customer.previousAgentId ?? null,
            newAgentId: input.targetUserId,
            assignedBy: input.executedBy,
            assignmentType: "reassignment",
            assignmentReason: "handoff",
          },
          client
        );
        await createActivityLog(
          {
            userId: input.executedBy,
            action: "CUSTOMER_TRANSFERRED_BY_HANDOFF",
            targetType: "customer",
            targetId: customer.id,
            details: JSON.stringify({
              actor: input.executedBy,
              targetType: "customer",
              targetId: customer.id,
              metadata: {
                sourceUserId: input.sourceUserId,
                targetUserId: input.targetUserId,
                reason: input.reason,
              },
            }),
          },
          client
        );
      }
    }

    if (input.transferFollowUps) {
      const pending = await client
        .select({ id: followUps.id })
        .from(followUps)
        .where(
          and(
            eq(followUps.assignedAgentId, input.sourceUserId),
            or(
              eq(followUps.status, "scheduled"),
              eq(followUps.status, "postponed")
            ),
            isNull(followUps.deletedAt)
          )
        );
      if (pending.length > 0) {
        await client
          .update(followUps)
          .set({
            assignedAgentId: input.targetUserId,
            teamId: target.teamId ?? null,
            subBranchAdminId: target.subBranchAdminId ?? null,
          })
          .where(
            inArray(
              followUps.id,
              pending.map((item: { id: number }) => item.id)
            )
          );
      }
      movedCounts.followUps = pending.length;
    }

    if (input.transferSchedules) {
      const pending = await client
        .select({ id: schedules.id })
        .from(schedules)
        .where(
          and(
            eq(schedules.userId, input.sourceUserId),
            eq(schedules.isActive, true),
            isNull(schedules.completedAt)
          )
        );
      if (pending.length > 0) {
        await client
          .update(schedules)
          .set({ userId: input.targetUserId, teamId: target.teamId ?? null })
          .where(
            inArray(
              schedules.id,
              pending.map((item: { id: number }) => item.id)
            )
          );
      }
      movedCounts.schedules = pending.length;
    }

    if (input.transferNotifications) {
      const pending = await client
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, input.sourceUserId),
            eq(notifications.isRead, false)
          )
        );
      if (pending.length > 0) {
        await client
          .update(notifications)
          .set({ userId: input.targetUserId })
          .where(
            inArray(
              notifications.id,
              pending.map((item: { id: number }) => item.id)
            )
          );
      }
      movedCounts.notifications = pending.length;
    }

    const aggregateTransferLogs = [
      {
        action: "FOLLOW_UP_TRANSFERRED_BY_HANDOFF",
        targetType: "follow_up",
        count: movedCounts.followUps,
      },
      {
        action: "SCHEDULE_TRANSFERRED_BY_HANDOFF",
        targetType: "schedule",
        count: movedCounts.schedules,
      },
      {
        action: "NOTIFICATION_TRANSFERRED_BY_HANDOFF",
        targetType: "notification",
        count: movedCounts.notifications,
      },
    ];
    for (const entry of aggregateTransferLogs) {
      if (entry.count > 0) {
        await createActivityLog(
          {
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
          },
          client
        );
      }
    }

    if (
      input.updateSourceAccountStatus !== "keep" ||
      input.forceLogoutSource ||
      input.resetOAuthSource
    ) {
      const updateData: Partial<typeof users.$inferInsert> = {};
      if (input.updateSourceAccountStatus !== "keep")
        updateData.accountStatus = input.updateSourceAccountStatus;
      if (input.forceLogoutSource || input.resetOAuthSource)
        updateData.sessionInvalidatedAt = now;
      if (input.resetOAuthSource) {
        updateData.openId = `invited_handoff_${input.sourceUserId}_${Date.now().toString(36)}`;
        updateData.loginStatus = "invited";
      }
      await client
        .update(users)
        .set(updateData)
        .where(eq(users.id, input.sourceUserId));
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

    await createActivityLog(
      {
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
      },
      client
    );

    if (input.updateSourceAccountStatus !== "keep") {
      await createActivityLog(
        {
          userId: input.executedBy,
          action: "USER_STATUS_UPDATED_BY_HANDOFF",
          targetType: "user",
          targetId: input.sourceUserId,
          details: JSON.stringify({
            actor: input.executedBy,
            targetType: "user",
            targetId: input.sourceUserId,
            beforeValue: { accountStatus: source.accountStatus },
            afterValue: { accountStatus: afterStatus },
            metadata: { reason: input.reason },
          }),
        },
        client
      );
    }

    if (input.forceLogoutSource) {
      await createActivityLog(
        {
          userId: input.executedBy,
          action: "USER_FORCE_LOGOUT",
          targetType: "user",
          targetId: input.sourceUserId,
          details: JSON.stringify({
            actor: input.executedBy,
            targetType: "user",
            targetId: input.sourceUserId,
            metadata: {
              reason: input.reason,
              source: "handoff",
              affectedSessionCount: 1,
            },
          }),
        },
        client
      );
    }

    if (input.resetOAuthSource) {
      await createActivityLog(
        {
          userId: input.executedBy,
          action: "USER_OAUTH_RESET",
          targetType: "user",
          targetId: input.sourceUserId,
          details: JSON.stringify({
            actor: input.executedBy,
            targetType: "user",
            targetId: input.sourceUserId,
            metadata: {
              reason: input.reason,
              source: "handoff",
              openIdReset: true,
            },
          }),
        },
        client
      );
    }

    return {
      success: true,
      sourceUserId: input.sourceUserId,
      targetUserId: input.targetUserId,
      counts: movedCounts,
      sourceAccountStatusBefore: source.accountStatus,
      sourceAccountStatusAfter: afterStatus,
    };
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

export async function createTeam(
  name: string,
  managerId?: number,
  subBranchAdminId?: number,
  description?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(teams)
    .values({ name, managerId, subBranchAdminId, description });
}

export async function updateTeam(
  id: number,
  data: Partial<typeof teams.$inferInsert>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(teams).set(data).where(eq(teams.id, id));
  // 팀의 subBranchAdminId 변경 시 소속 팀원들의 subBranchAdminId 일괄 갱신 (조건 4)
  if (data.subBranchAdminId !== undefined) {
    await db
      .update(users)
      .set({ subBranchAdminId: data.subBranchAdminId })
      .where(eq(users.teamId, id));
  }
}

export async function deactivateTeam(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(teams)
    .set({ isActive: false, deletedAt: new Date() })
    .where(eq(teams.id, id));
}

export async function getDeletedTeams() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(teams)
    .where(or(eq(teams.isActive, false), sql`${teams.deletedAt} is not null`))
    .orderBy(desc(teams.createdAt));
}

export async function restoreTeam(id: number, client?: DbExecutor) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(teams)
    .set({ isActive: true, deletedAt: null })
    .where(eq(teams.id, id));
}

export async function permanentlyDeleteTeam(id: number, client?: DbExecutor) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.delete(teams).where(eq(teams.id, id));
}

// ─── Customers ───────────────────────────────────────────────────────────────
/** 역할별 고객 목록 조회 */
export async function getCustomers(filter: {
  agentId?: number;
  agentIds?: number[];
  teamId?: number;
  subBranchAdminId?: number;
  unassigned?: boolean;
  assignmentStatus?: string;
  status?: string;
  includeInactive?: boolean;
  region?: string;
  source?: string;
  dbCompany?: string;
  priority?: string;
  tag?: string;
  nextAction?: string;
  search?: string;
  assignedDateFrom?: Date;
  assignedDateTo?: Date;
  limit?: number;
  segment?: CustomerSegment;
  withSegmentMeta?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (!filter.includeInactive) {
    conditions.push(eq(customers.isActive, true));
  }

  if (filter.agentIds !== undefined) {
    if (filter.agentIds.length === 0) return [];
    conditions.push(
      or(...filter.agentIds.map(id => eq(customers.agentId, id))) as any
    );
  } else if (filter.agentId !== undefined) {
    conditions.push(eq(customers.agentId, filter.agentId));
  } else if (filter.unassigned) {
    conditions.push(isNull(customers.agentId));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map(u => u.id);
    const teamConditions = [eq(customers.assignedTeamId, filter.teamId) as any];
    if (agentIds.length > 0)
      teamConditions.push(
        ...agentIds.map(id => eq(customers.agentId, id) as any)
      );
    conditions.push(or(...teamConditions) as any);
  } else if (filter.subBranchAdminId !== undefined) {
    const branchAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.subBranchAdminId, filter.subBranchAdminId));
    const agentIds = branchAgents.map(u => u.id);
    const branchConditions = [
      eq(customers.subBranchAdminId, filter.subBranchAdminId) as any,
      eq(customers.agentId, filter.subBranchAdminId) as any,
    ];
    if (agentIds.length > 0)
      branchConditions.push(
        ...agentIds.map(id => eq(customers.agentId, id) as any)
      );
    conditions.push(or(...branchConditions) as any);
  }

  if (filter.assignmentStatus)
    conditions.push(
      eq(customers.assignmentStatus, filter.assignmentStatus as any)
    );
  if (filter.status)
    conditions.push(eq(customers.consultStatus, filter.status as any));
  if (filter.region) conditions.push(eq(customers.region, filter.region));
  if (filter.source) conditions.push(eq(customers.source, filter.source));
  if (filter.dbCompany)
    conditions.push(eq(customers.dbCompany, filter.dbCompany));
  if (filter.priority)
    conditions.push(eq(customers.priority, filter.priority as any));
  if (filter.nextAction)
    conditions.push(eq(customers.nextAction, filter.nextAction));
  if (filter.tag)
    conditions.push(
      sql`${customers.customerTags} like ${`%${filter.tag}%`}` as any
    );
  const search = filter.search?.trim().toLowerCase();
  if (search) {
    const likeSearch = `%${search}%`;
    conditions.push(
      or(
        sql`lower(${customers.name}) like ${likeSearch}`,
        sql`lower(${customers.phone}) like ${likeSearch}`,
        sql`lower(${customers.region}) like ${likeSearch}`,
        sql`lower(${customers.source}) like ${likeSearch}`,
        sql`lower(${customers.dbCompany}) like ${likeSearch}`,
        sql`lower(${customers.consultStatus}) like ${likeSearch}`,
        sql`lower(${customers.priority}) like ${likeSearch}`
      ) as any
    );
  }
  if (filter.assignedDateFrom)
    conditions.push(gte(customers.assignedAt, filter.assignedDateFrom) as any);
  if (filter.assignedDateTo)
    conditions.push(lte(customers.assignedAt, filter.assignedDateTo) as any);

  let query = db
    .select()
    .from(customers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(customers.createdAt));

  if (filter.limit != null && filter.limit > 0) {
    query = query.limit(filter.limit) as typeof query;
  }

  const rows = await query;
  if (!filter.withSegmentMeta && (!filter.segment || filter.segment === "all")) {
    return rows;
  }

  const rowsWithSegment = await attachCustomerSegmentMeta(rows);
  if (!filter.segment || filter.segment === "all") return rowsWithSegment;
  return rowsWithSegment.filter(row => row.customerSegment === filter.segment);
}

type CustomerSegmentMeta = {
  customerSegment: Exclude<CustomerSegment, "all">;
  contractCount: number;
  monthlyPremiumTotal: number;
  recentContractDate: Date | string | null;
  consultationCount: number;
  recentConsultationAt: Date | null;
  followUpCount: number;
  nextFollowUpAt: Date | null;
  activityCount: number;
  recentActivityAt: Date | null;
};

async function attachCustomerSegmentMeta<T extends typeof customers.$inferSelect>(
  rows: T[]
): Promise<(T & CustomerSegmentMeta)[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  if (!db) {
    return rows.map(row => ({
      ...row,
      customerSegment: getConcreteCustomerSegment({
        nextAction: row.nextAction,
      }),
      contractCount: 0,
      monthlyPremiumTotal: 0,
      recentContractDate: null,
      consultationCount: 0,
      recentConsultationAt: null,
      followUpCount: 0,
      nextFollowUpAt: null,
      activityCount: 0,
      recentActivityAt: null,
    }));
  }

  const customerIds = rows.map(row => row.id);
  const [contractRows, consultationRows, followUpRows, activityRows] =
    await Promise.all([
      db
        .select({
          customerId: contracts.customerId,
          contractCount: sql<number>`count(*)`,
          monthlyPremiumTotal: sql<number>`coalesce(sum(${contracts.monthlyPremium}), 0)`,
          recentContractDate: sql<Date | string | null>`max(${contracts.contractDate})`,
        })
        .from(contracts)
        .where(
          and(
            inArray(contracts.customerId, customerIds),
            eq(contracts.isActive, true),
            isNull(contracts.deletedAt)
          )
        )
        .groupBy(contracts.customerId),
      db
        .select({
          customerId: consultations.customerId,
          consultationCount: sql<number>`count(*)`,
          recentConsultationAt: sql<Date | null>`max(${consultations.createdAt})`,
        })
        .from(consultations)
        .where(
          and(
            inArray(consultations.customerId, customerIds),
            eq(consultations.isActive, true),
            isNull(consultations.deletedAt)
          )
        )
        .groupBy(consultations.customerId),
      db
        .select({
          customerId: followUps.customerId,
          followUpCount: sql<number>`count(*)`,
          nextFollowUpAt: sql<Date | null>`min(${followUps.nextContactDate})`,
        })
        .from(followUps)
        .where(
          and(inArray(followUps.customerId, customerIds), isNull(followUps.deletedAt))
        )
        .groupBy(followUps.customerId),
      db
        .select({
          customerId: activityLogs.targetId,
          activityCount: sql<number>`count(*)`,
          recentActivityAt: sql<Date | null>`max(${activityLogs.createdAt})`,
        })
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.targetType, "customer"),
            inArray(activityLogs.targetId, customerIds)
          )
        )
        .groupBy(activityLogs.targetId),
    ]);

  const contractByCustomer = new Map(contractRows.map(row => [row.customerId, row]));
  const consultationByCustomer = new Map(
    consultationRows.map(row => [row.customerId, row])
  );
  const followUpByCustomer = new Map(followUpRows.map(row => [row.customerId, row]));
  const activityByCustomer = new Map(activityRows.map(row => [row.customerId, row]));

  return rows.map(row => {
    const contract = contractByCustomer.get(row.id);
    const consultation = consultationByCustomer.get(row.id);
    const followUp = followUpByCustomer.get(row.id);
    const activity = activityByCustomer.get(row.id);
    const contractCount = Number(contract?.contractCount ?? 0);
    const consultationCount = Number(consultation?.consultationCount ?? 0);
    const followUpCount = Number(followUp?.followUpCount ?? 0);
    const activityCount = Number(activity?.activityCount ?? 0);

    return {
      ...row,
      customerSegment: getConcreteCustomerSegment({
        contractCount,
        consultationCount,
        followUpCount,
        activityCount,
        nextAction: row.nextAction,
      }),
      contractCount,
      monthlyPremiumTotal: Number(contract?.monthlyPremiumTotal ?? 0),
      recentContractDate: contract?.recentContractDate ?? null,
      consultationCount,
      recentConsultationAt: consultation?.recentConsultationAt ?? null,
      followUpCount,
      nextFollowUpAt: followUp?.nextFollowUpAt ?? null,
      activityCount,
      recentActivityAt: activity?.recentActivityAt ?? null,
    };
  });
}

export async function getCustomerSegmentCounts(
  filter: Omit<Parameters<typeof getCustomers>[0], "segment" | "withSegmentMeta">
): Promise<CustomerSegmentCounts> {
  const rows = await getCustomers({ ...filter, withSegmentMeta: true });
  const counts = emptyCustomerSegmentCounts();
  for (const row of rows as Array<{ customerSegment?: CustomerSegment }>) {
    const segment = row.customerSegment;
    counts.all += 1;
    if (segment && segment !== "all") counts[segment] += 1;
  }
  return counts;
}

const CONSULT_TA_OR_BEYOND = [
  "통화완료",
  "상담예정",
  "설계중",
  "계약",
] as const;
const CONSULT_AP_OR_BEYOND = ["상담예정", "설계중", "계약"] as const;
const CONSULT_PC_OR_BEYOND = ["설계중", "계약"] as const;

/**
 * 영업 퍼널 집계: 배정 DB(담당자 있는 활성 고객) 기준, consultStatus 누적 단계별 건수.
 * @param agentIdIn 담당자 ID 제한. `undefined`이면 담당자 범위 제한 없음(지점장 전체). 빈 배열이면 0건 처리.
 */
export async function getSalesFunnelAggregates(
  agentIdIn: number[] | undefined
): Promise<{
  totalAssigned: number;
  taCumulative: number;
  apCumulative: number;
  pcCumulative: number;
  contracted: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalAssigned: 0,
      taCumulative: 0,
      apCumulative: 0,
      pcCumulative: 0,
      contracted: 0,
    };
  }
  if (agentIdIn !== undefined && agentIdIn.length === 0) {
    return {
      totalAssigned: 0,
      taCumulative: 0,
      apCumulative: 0,
      pcCumulative: 0,
      contracted: 0,
    };
  }

  const base: any[] = [
    eq(customers.isActive, true),
    isNotNull(customers.agentId),
  ];
  if (agentIdIn !== undefined) {
    base.push(inArray(customers.agentId, agentIdIn));
  }
  const database = db;
  const baseWhere = and(...base);

  async function countWhere(extra?: any) {
    const where = extra ? and(baseWhere, extra) : baseWhere;
    const [row] = await database
      .select({ c: sql<number>`cast(count(*) as signed)` })
      .from(customers)
      .where(where);
    return Number(row?.c ?? 0);
  }

  const [totalAssigned, taCumulative, apCumulative, pcCumulative, contracted] =
    await Promise.all([
      countWhere(),
      countWhere(inArray(customers.consultStatus, [...CONSULT_TA_OR_BEYOND])),
      countWhere(inArray(customers.consultStatus, [...CONSULT_AP_OR_BEYOND])),
      countWhere(inArray(customers.consultStatus, [...CONSULT_PC_OR_BEYOND])),
      countWhere(eq(customers.consultStatus, "계약")),
    ]);

  return {
    totalAssigned,
    taCumulative,
    apCumulative,
    pcCumulative,
    contracted,
  };
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer, client?: DbExecutor) {
  const db = client ?? (await getDb());
  if (!db) return;
  const result = await db
    .insert(customers)
    .values({ ...data, isActive: true });
  return result as any;
}

export async function updateCustomer(
  id: number,
  data: Partial<InsertCustomer>,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function softDeleteCustomer(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customers)
    .set({ isActive: false, deletedAt: new Date() })
    .where(eq(customers.id, id));
}

export async function getDeletedCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customers)
    .where(
      or(eq(customers.isActive, false), sql`${customers.deletedAt} is not null`)
    )
    .orderBy(desc(customers.createdAt));
}

export async function restoreCustomer(id: number, client?: DbExecutor) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(customers)
    .set({ isActive: true, deletedAt: null })
    .where(eq(customers.id, id));
}

export async function permanentlyDeleteCustomer(
  id: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
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
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return value
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }
}

function encodeTagList(tags: string[]) {
  return JSON.stringify(Array.from(new Set(tags)).slice(0, 10));
}

function strongerPriority(a?: string | null, b?: string | null) {
  const rank: Record<string, number> = {
    A: 5,
    B: 4,
    C: 3,
    D: 2,
    unclassified: 1,
  };
  return (rank[b ?? "unclassified"] ?? 1) > (rank[a ?? "unclassified"] ?? 1)
    ? b
    : a;
}

function customerMergeSummary(
  row: typeof customers.$inferSelect,
  stats?: CustomerMergeStats
) {
  return {
    id: row.id,
    name: row.name,
    maskedPhone: maskPhoneForMerge(row.phone),
    birthDate: row.birthDate,
    region: row.region,
    source: row.source,
    dbCompany: row.dbCompany,
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

export async function getCustomerMergeStats(
  customerId: number
): Promise<CustomerMergeStats> {
  const db = await getDb();
  if (!db)
    return {
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
  const [
    consultationRows,
    contractRows,
    followUpRows,
    notificationRows,
    reminderRows,
    requestRows,
    statusRows,
    consentRows,
    assignmentRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(consultations)
      .where(eq(consultations.customerId, customerId)),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contracts)
      .where(eq(contracts.customerId, customerId)),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(followUps)
      .where(eq(followUps.customerId, customerId)),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.relatedType, "customer"),
          eq(notifications.relatedId, customerId)
        )
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(reminders)
      .where(
        and(
          eq(reminders.relatedType, "customer"),
          eq(reminders.relatedId, customerId)
        )
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(deleteRequests)
      .where(eq(deleteRequests.customerId, customerId)),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(statusHistory)
      .where(eq(statusHistory.customerId, customerId)),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(consentLogs)
      .where(eq(consentLogs.customerId, customerId)),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(assignmentHistory)
      .where(eq(assignmentHistory.customerId, customerId)),
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

export async function findDuplicateCustomerGroups(
  filter: {
    search?: string;
    phone?: string;
    name?: string;
    onlyActive?: boolean;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter.onlyActive !== false)
    conditions.push(eq(customers.isActive, true), isNull(customers.deletedAt));
  if (filter.search) {
    const like = `%${filter.search}%`;
    conditions.push(
      or(
        sql`${customers.name} like ${like}`,
        sql`${customers.phone} like ${like}`
      ) as any
    );
  }
  if (filter.name)
    conditions.push(sql`${customers.name} like ${`%${filter.name}%`}` as any);
  const rows = await db
    .select()
    .from(customers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(customers.updatedAt))
    .limit(1000);

  const expectedPhone = filter.phone ? normalizePhone(filter.phone) : null;
  const phoneGroups = new Map<string, typeof rows>();
  for (const row of rows) {
    const normalized = row.phone ? normalizePhone(row.phone) : "";
    if (!normalized || (expectedPhone && normalized !== expectedPhone))
      continue;
    const group = phoneGroups.get(normalized) ?? [];
    group.push(row);
    phoneGroups.set(normalized, group);
  }

  const duplicateGroups = Array.from(phoneGroups.entries())
    .filter(([, group]) => group.length > 1)
    .slice(0, 50);

  return Promise.all(
    duplicateGroups.map(async ([normalizedPhone, group]) => ({
      normalizedPhone,
      maskedPhone: maskPhoneForMerge(normalizedPhone),
      candidates: await Promise.all(
        group.map(async row =>
          customerMergeSummary(row, await getCustomerMergeStats(row.id))
        )
      ),
    }))
  );
}

export async function getCustomerMergePreview(
  targetCustomerId: number,
  sourceCustomerId: number
) {
  const [target, source] = await Promise.all([
    getCustomerById(targetCustomerId),
    getCustomerById(sourceCustomerId),
  ]);
  if (!target || !source) return undefined;
  const [targetStats, sourceStats] = await Promise.all([
    getCustomerMergeStats(targetCustomerId),
    getCustomerMergeStats(sourceCustomerId),
  ]);
  const db = await getDb();
  const pendingRows = db
    ? await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(deleteRequests)
        .where(
          and(
            eq(deleteRequests.customerId, sourceCustomerId),
            eq(deleteRequests.status, "pending")
          )
        )
    : [{ count: 0 }];
  const conflicts = [
    "name",
    "phone",
    "region",
    "source",
    "dbCompany",
    "consultStatus",
    "priority",
    "nextAction",
  ].filter(
    field =>
      (target as any)[field] &&
      (source as any)[field] &&
      (target as any)[field] !== (source as any)[field]
  );
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
  const preview = await getCustomerMergePreview(
    targetCustomerId,
    sourceCustomerId
  );
  if (!preview) throw new Error("merge_customers_not_found");
  const source = await getCustomerById(sourceCustomerId);
  const target = await getCustomerById(targetCustomerId);
  if (!source || !target) throw new Error("merge_customers_not_found");
  const now = new Date();
  const tags = encodeTagList([
    ...decodeTagList(target.customerTags),
    ...decodeTagList(source.customerTags),
  ]);
  const targetPatch: Partial<InsertCustomer> = {
    phone: target.phone ?? source.phone,
    birthDate: target.birthDate ?? source.birthDate,
    gender: target.gender ?? source.gender,
    region: target.region ?? source.region,
    expectedPremium: target.expectedPremium ?? source.expectedPremium,
    availableTime: target.availableTime ?? source.availableTime,
    source: target.source ?? source.source,
    dbCompany: target.dbCompany ?? source.dbCompany,
    priority: strongerPriority(target.priority, source.priority) as any,
    customerTags: tags,
    nextAction: target.nextAction ?? source.nextAction,
    privacyConsent: target.privacyConsent || source.privacyConsent,
    marketingConsent: target.marketingConsent || source.marketingConsent,
  };

  await runDbTransaction(async tx => {
    const client = tx as any;
    await client
      .update(consultations)
      .set({ customerId: targetCustomerId })
      .where(eq(consultations.customerId, sourceCustomerId));
    await client
      .update(contracts)
      .set({ customerId: targetCustomerId })
      .where(eq(contracts.customerId, sourceCustomerId));
    await client
      .update(followUps)
      .set({ customerId: targetCustomerId })
      .where(eq(followUps.customerId, sourceCustomerId));
    await client
      .update(statusHistory)
      .set({ customerId: targetCustomerId })
      .where(eq(statusHistory.customerId, sourceCustomerId));
    await client
      .update(consentLogs)
      .set({ customerId: targetCustomerId })
      .where(eq(consentLogs.customerId, sourceCustomerId));
    await client
      .update(assignmentHistory)
      .set({ customerId: targetCustomerId })
      .where(eq(assignmentHistory.customerId, sourceCustomerId));
    await client
      .update(deleteRequests)
      .set({ customerId: targetCustomerId })
      .where(eq(deleteRequests.customerId, sourceCustomerId));
    await client
      .update(notifications)
      .set({ relatedId: targetCustomerId })
      .where(
        and(
          eq(notifications.relatedType, "customer"),
          eq(notifications.relatedId, sourceCustomerId)
        )
      );
    await client
      .update(reminders)
      .set({ relatedId: targetCustomerId })
      .where(
        and(
          eq(reminders.relatedType, "customer"),
          eq(reminders.relatedId, sourceCustomerId)
        )
      );
    await client
      .update(customers)
      .set(targetPatch)
      .where(eq(customers.id, targetCustomerId));
    await client
      .update(customers)
      .set({
        isActive: false,
        deletedAt: now,
        mergedIntoCustomerId: targetCustomerId,
        mergedAt: now,
        mergedBy: actorId,
      })
      .where(eq(customers.id, sourceCustomerId));
    await createActivityLog(
      {
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
      },
      tx
    );
  });

  return {
    success: true,
    targetCustomerId,
    sourceCustomerId,
    affectedCounts: preview.transferCounts,
  };
}

type CustomerPhoneScopeFilter = {
  agentId?: number;
  agentIds?: number[];
  teamId?: number;
  subBranchAdminId?: number;
};

export async function checkPhoneDuplicate(
  phone: string,
  excludeId?: number,
  filter: CustomerPhoneScopeFilter = {}
) {
  const db = await getDb();
  if (!db) return null;
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const result = await getCustomers(filter);
  const found = result.find(customer => {
    if (!customer.phone) return false;
    if (excludeId && customer.id === excludeId) return false;
    return normalizePhone(customer.phone) === normalized;
  });
  if (!found) return null;
  return found;
}

/** 지점장이 부지점장에게 DB 배분 */
export async function assignCustomerToSubBranch(
  customerId: number,
  subBranchAdminId: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(customers)
    .set({
      subBranchAdminId,
      assignmentStatus: "assigned_to_sub_branch",
      assignedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}

export async function reclaimCustomerAssignment(
  customerId: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(customers)
    .set({
      agentId: null,
      assignedTeamId: null,
      subBranchAdminId: null,
      assignedAt: null,
      assignmentStatus: "unassigned",
    })
    .where(eq(customers.id, customerId));
}

export async function transferReclaimedCustomerWork(
  customerId: number,
  previousAgentId: number | null | undefined,
  targetUserId: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db || !previousAgentId)
    return { followUps: 0, notifications: 0, reminders: 0, schedules: 0 };

  const pendingFollowUps = await db
    .select({ id: followUps.id })
    .from(followUps)
    .where(
      and(
        eq(followUps.customerId, customerId),
        eq(followUps.assignedAgentId, previousAgentId),
        or(
          eq(followUps.status, "scheduled"),
          eq(followUps.status, "postponed")
        ),
        isNull(followUps.deletedAt)
      )
    );
  if (pendingFollowUps.length > 0) {
    await db
      .update(followUps)
      .set({
        assignedAgentId: targetUserId,
        teamId: null,
        subBranchAdminId: null,
      })
      .where(
        inArray(
          followUps.id,
          pendingFollowUps.map((item: { id: number }) => item.id)
        )
      );
  }
  const pendingFollowUpIds = pendingFollowUps.map(
    (item: { id: number }) => item.id
  );
  const notificationRelationCondition =
    pendingFollowUpIds.length > 0
      ? or(
          and(
            eq(notifications.relatedType, "customer"),
            eq(notifications.relatedId, customerId)
          ),
          and(
            eq(notifications.relatedType, "follow_up"),
            inArray(notifications.relatedId, pendingFollowUpIds)
          )
        )
      : and(
          eq(notifications.relatedType, "customer"),
          eq(notifications.relatedId, customerId)
        );
  const reminderRelationCondition =
    pendingFollowUpIds.length > 0
      ? or(
          and(
            eq(reminders.relatedType, "customer"),
            eq(reminders.relatedId, customerId)
          ),
          and(
            eq(reminders.relatedType, "follow_up"),
            inArray(reminders.relatedId, pendingFollowUpIds)
          )
        )
      : and(
          eq(reminders.relatedType, "customer"),
          eq(reminders.relatedId, customerId)
        );

  const pendingNotifications = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, previousAgentId),
        notificationRelationCondition,
        eq(notifications.isRead, false)
      )
    );
  if (pendingNotifications.length > 0) {
    await db
      .update(notifications)
      .set({ userId: targetUserId })
      .where(
        inArray(
          notifications.id,
          pendingNotifications.map((item: { id: number }) => item.id)
        )
      );
  }

  const pendingReminders = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, previousAgentId),
        reminderRelationCondition,
        eq(reminders.isRead, false)
      )
    );
  if (pendingReminders.length > 0) {
    await db
      .update(reminders)
      .set({ userId: targetUserId })
      .where(
        inArray(
          reminders.id,
          pendingReminders.map((item: { id: number }) => item.id)
        )
      );
  }

  return {
    followUps: pendingFollowUps.length,
    notifications: pendingNotifications.length,
    reminders: pendingReminders.length,
    schedules: 0,
  };
}

/** 최종 팀원 배정 */
export async function assignCustomer(
  customerId: number,
  agentId: number,
  teamId?: number,
  subBranchAdminId?: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(customers)
    .set({
      agentId,
      assignedTeamId: teamId ?? null,
      subBranchAdminId: subBranchAdminId ?? null,
      assignedAt: new Date(),
      assignmentStatus: "assigned_to_agent",
    })
    .where(eq(customers.id, customerId));
}

export async function assignCustomerDbToTeam(
  customerId: number,
  teamId: number | null,
  subBranchAdminId?: number | null,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(customers)
    .set({
      assignedTeamId: teamId,
      subBranchAdminId: subBranchAdminId ?? null,
      assignedAt: new Date(),
      assignmentStatus: "assigned_to_sub_branch",
    })
    .where(eq(customers.id, customerId));
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
  return db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.customerId, customerId))
    .orderBy(desc(statusHistory.createdAt));
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
  return db
    .select()
    .from(consentLogs)
    .where(eq(consentLogs.customerId, customerId))
    .orderBy(desc(consentLogs.createdAt));
}

// ─── Consultations ────────────────────────────────────────────────────────────
export async function getConsultationsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.customerId, customerId),
        eq(consultations.isActive, true)
      )
    )
    .orderBy(desc(consultations.createdAt));
}

export async function getLatestConsultationDatesByCustomerIds(
  customerIds: number[]
) {
  const db = await getDb();
  const uniqueIds = Array.from(
    new Set(customerIds.filter(id => Number.isFinite(id)))
  );
  if (!db || uniqueIds.length === 0) return [];
  return db
    .select({
      customerId: consultations.customerId,
      latestCreatedAt: sql<Date>`max(${consultations.createdAt})`,
    })
    .from(consultations)
    .where(
      and(
        inArray(consultations.customerId, uniqueIds),
        eq(consultations.isActive, true),
        isNull(consultations.deletedAt)
      )
    )
    .groupBy(consultations.customerId);
}

export async function getConsultationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(consultations)
    .where(eq(consultations.id, id))
    .limit(1);
  return result[0];
}

export async function createConsultation(
  data: InsertConsultation,
  client?: DbExecutor,
  options?: { updateCustomerConsultStatus?: boolean }
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.insert(consultations).values({ ...data, isActive: true });
  if (options?.updateCustomerConsultStatus ?? true) {
    await db
      .update(customers)
      .set({ consultStatus: data.status })
      .where(eq(customers.id, data.customerId));
  }
}

export async function updateConsultation(
  id: number,
  data: Partial<InsertConsultation>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(consultations).set(data).where(eq(consultations.id, id));
}

export const DEFAULT_MESSAGE_TEMPLATES = [
  {
    title: "부재 후 재연락",
    situation: "missed_call",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n방금 연락드렸는데 통화가 어려우신 것 같아 문자 남깁니다.\n\n급한 내용은 아니고,\n이전에 확인이 필요했던 보험 관련 내용이 있어 연락드렸습니다.\n\n편하실 때 통화 가능하신 시간 알려주시면 맞춰 연락드리겠습니다.",
  },
  {
    title: "설계안 발송 후 확인",
    situation: "proposal_follow_up",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n말씀 나눴던 내용 기준으로 자료를 정리해드렸습니다.\n\n보시다가 이해가 어려운 부분이나\n추가로 확인하고 싶은 부분이 있으시면 편하게 말씀해주세요.\n\n현재 기준을 함께 확인하기 위한 자료로 봐주시면 됩니다.",
  },
  {
    title: "계약 전 확인",
    situation: "pre_contract_check",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n진행 전 마지막으로\n보장 내용, 보험료, 납입기간, 유의사항을 한 번 더 확인드리려고 합니다.\n\n충분히 이해하신 뒤 결정하시는 것이 가장 중요합니다.\n\n궁금한 부분은 편하게 말씀해주세요.",
  },
  {
    title: "계약 후 사후관리",
    situation: "post_contract_care",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n오늘 진행하신 내용은 이후에도 필요하실 때 다시 확인하실 수 있도록 관리하겠습니다.\n\n보장 내용, 청구, 변경사항이 궁금하실 때\n편하게 연락주시면 확인 도와드리겠습니다.",
  },
  {
    title: "장기 미관리 고객 재접촉",
    situation: "long_unmanaged",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n오랜만에 연락드립니다.\n\n그동안 상황이나 가족 구성, 직장, 보험료 부담 등이 달라졌을 수 있어\n기존 보장 기준을 한 번 점검해보시면 좋을 시점이라 연락드렸습니다.\n\n부담 없이 현재 기준만 확인해보셔도 괜찮습니다.",
  },
  {
    title: "생일 관리",
    situation: "birthday",
    channel: "both",
    body: "{고객명}님, 생일 진심으로 축하드립니다.\n\n오늘 하루는 바쁜 일보다\n편안하고 기분 좋은 일들이 더 많으셨으면 좋겠습니다.\n\n필요하실 때 보험 관련해서 편하게 물어보실 수 있도록\n앞으로도 잘 관리하겠습니다.",
  },
  {
    title: "다음 연락일 안내",
    situation: "follow_up_schedule",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n오늘 말씀드린 내용은 제가 정리해두고,\n{다음연락일}에 다시 한 번 확인 연락드리겠습니다.\n\n그 전에 궁금한 점이 생기시면 편하게 메시지 남겨주세요.",
  },
  {
    title: "자료 요청",
    situation: "document_request",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n정확한 확인을 위해 필요한 자료가 있어 안내드립니다.\n\n가능하실 때 관련 자료를 보내주시면,\n현재 상황에 맞게 필요한 부분만 정리해서 말씀드리겠습니다.\n\n민감한 정보는 가려서 보내주셔도 괜찮습니다.",
  },
  {
    title: "상담 후 요약",
    situation: "after_consultation",
    channel: "both",
    body: "{고객명}님, 오늘 상담 내용 간단히 정리드립니다.\n\n오늘 확인한 핵심은\n현재 보험료 부담, 필요한 보장 범위,\n앞으로 점검해야 할 부분이었습니다.\n\n제가 정리한 기준으로 다시 확인드리고,\n필요한 내용은 다음 연락 때 이어서 안내드리겠습니다.",
  },
  {
    title: "일반 점검 안내",
    situation: "general_check",
    channel: "both",
    body: "{고객명}님, 안녕하세요. {담당자명}입니다.\n\n보험은 가입보다\n현재 상황에 맞게 유지되고 있는지 확인하는 과정이 중요합니다.\n\n최근 상황이 달라진 부분이 있다면\n기존 보장 기준을 한 번 점검해보셔도 좋습니다.",
  },
] as const;

export async function getConsultationChecklistTemplates(
  includeInactive = false
) {
  const db = await getDb();
  if (!db) return [];
  const condition = includeInactive
    ? undefined
    : and(
        eq(consultationChecklists.isActive, true),
        isNull(consultationChecklists.deletedAt)
      );
  return db
    .select()
    .from(consultationChecklists)
    .where(condition)
    .orderBy(consultationChecklists.phase, consultationChecklists.sortOrder);
}

export async function createConsultationChecklistTemplate(
  data: InsertConsultationChecklist
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(consultationChecklists).values(data);
  const result = await db
    .select()
    .from(consultationChecklists)
    .orderBy(desc(consultationChecklists.id))
    .limit(1);
  return result[0];
}

export async function updateConsultationChecklistTemplate(
  id: number,
  data: Partial<InsertConsultationChecklist>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(consultationChecklists)
    .set(data)
    .where(eq(consultationChecklists.id, id));
}

export const DEFAULT_CONSULTATION_CHECKLISTS = [
  {
    phase: "before",
    category: "basic",
    sortOrder: 10,
    isRequired: false,
    title: "고객 기본정보 확인",
    description: "고객 기본정보를 확인했습니다.",
  },
  {
    phase: "before",
    category: "basic",
    sortOrder: 20,
    isRequired: false,
    title: "기존 상담기록 확인",
    description: "기존 상담기록을 확인했습니다.",
  },
  {
    phase: "before",
    category: "coverage",
    sortOrder: 30,
    isRequired: false,
    title: "기존 계약 또는 보장 현황 확인",
    description: "기존 계약 또는 보장 현황을 확인했습니다.",
  },
  {
    phase: "before",
    category: "follow_up",
    sortOrder: 40,
    isRequired: false,
    title: "오늘 상담 목적 정리",
    description: "오늘 상담 목적을 정리했습니다.",
  },
  {
    phase: "during",
    category: "needs",
    sortOrder: 10,
    isRequired: false,
    title: "현재 고민 확인",
    description: "고객의 현재 고민을 확인했습니다.",
  },
  {
    phase: "during",
    category: "premium",
    sortOrder: 20,
    isRequired: false,
    title: "보험료 부담 확인",
    description: "보험료 부담 여부를 확인했습니다.",
  },
  {
    phase: "during",
    category: "coverage",
    sortOrder: 30,
    isRequired: false,
    title: "보장 공백 우려 확인",
    description: "보장 공백 우려를 확인했습니다.",
  },
  {
    phase: "during",
    category: "family",
    sortOrder: 40,
    isRequired: false,
    title: "가족 구성과 책임 범위 확인",
    description: "가족 구성과 책임 범위를 확인했습니다.",
  },
  {
    phase: "during",
    category: "needs",
    sortOrder: 50,
    isRequired: false,
    title: "상담 방향 확인",
    description: "고객이 원하는 상담 방향을 확인했습니다.",
  },
  {
    phase: "after",
    category: "basic",
    sortOrder: 10,
    isRequired: false,
    title: "상담 요약 기록",
    description: "상담 요약을 기록했습니다.",
  },
  {
    phase: "after",
    category: "follow_up",
    sortOrder: 20,
    isRequired: false,
    title: "다음 액션 설정",
    description: "다음 액션을 설정했습니다.",
  },
  {
    phase: "after",
    category: "follow_up",
    sortOrder: 30,
    isRequired: false,
    title: "다음 연락일 설정",
    description: "다음 연락일을 설정했습니다.",
  },
  {
    phase: "after",
    category: "follow_up",
    sortOrder: 40,
    isRequired: false,
    title: "자료 또는 설계안 전달 기록",
    description: "필요한 자료 또는 설계안 전달 여부를 기록했습니다.",
  },
  {
    phase: "after",
    category: "compliance",
    sortOrder: 50,
    isRequired: true,
    title: "민감정보 기록 여부 확인",
    description: "민감정보를 상담 메모에 남기지 않았는지 확인했습니다.",
  },
] as const;

export async function ensureDefaultConsultationChecklists(createdBy: number) {
  const db = await getDb();
  if (!db) return { createdCount: 0, reactivatedCount: 0 };
  let createdCount = 0;
  let reactivatedCount = 0;
  for (const checklist of DEFAULT_CONSULTATION_CHECKLISTS) {
    const existing = await db
      .select()
      .from(consultationChecklists)
      .where(
        and(
          eq(consultationChecklists.title, checklist.title),
          eq(consultationChecklists.phase, checklist.phase as any)
        )
      )
      .limit(1);
    if (existing[0]) {
      if (!existing[0].isActive || existing[0].deletedAt) {
        await db
          .update(consultationChecklists)
          .set({ isActive: true, deletedAt: null, updatedBy: createdBy })
          .where(eq(consultationChecklists.id, existing[0].id));
        reactivatedCount++;
      }
      continue;
    }
    await db.insert(consultationChecklists).values({
      ...checklist,
      phase: checklist.phase as any,
      category: checklist.category as any,
      createdBy,
      isActive: true,
    });
    createdCount++;
  }
  return { createdCount, reactivatedCount };
}

export async function getConsultationChecklistTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(consultationChecklists)
    .where(eq(consultationChecklists.id, id))
    .limit(1);
  return result[0];
}

export async function getConsultationCheckResults(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(consultationCheckResults)
    .where(eq(consultationCheckResults.customerId, customerId));
}

export async function upsertConsultationCheckResult(
  data: InsertConsultationCheckResult
) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db
    .select()
    .from(consultationCheckResults)
    .where(
      and(
        eq(consultationCheckResults.customerId, data.customerId),
        eq(consultationCheckResults.checklistId, data.checklistId)
      )
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(consultationCheckResults)
      .set(data)
      .where(eq(consultationCheckResults.id, existing[0].id));
    return { ...existing[0], ...data };
  }
  await db.insert(consultationCheckResults).values(data);
  const result = await db
    .select()
    .from(consultationCheckResults)
    .orderBy(desc(consultationCheckResults.id))
    .limit(1);
  return result[0];
}

export async function ensureDefaultMessageTemplates(createdBy: number) {
  const db = await getDb();
  if (!db) return { createdCount: 0, reactivatedCount: 0 };
  let createdCount = 0;
  let reactivatedCount = 0;
  for (const template of DEFAULT_MESSAGE_TEMPLATES) {
    const existing = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.title, template.title),
          eq(messageTemplates.situation, template.situation as any),
          eq(messageTemplates.channel, template.channel as any)
        )
      )
      .limit(1);
    if (existing[0]) {
      if (!existing[0].isActive || existing[0].deletedAt) {
        await db
          .update(messageTemplates)
          .set({ isActive: true, deletedAt: null, updatedBy: createdBy })
          .where(eq(messageTemplates.id, existing[0].id));
        reactivatedCount++;
      }
      continue;
    }
    await db.insert(messageTemplates).values({
      ...template,
      situation: template.situation as any,
      channel: template.channel as any,
      complianceNote:
        "고객 이해를 돕기 위한 안내 문구입니다. 확정 표현, 공포마케팅, 가입 강요 표현을 사용하지 마세요.",
      createdBy,
      isActive: true,
    });
    createdCount++;
  }
  return { createdCount, reactivatedCount };
}

export async function getMessageTemplates(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const condition = includeInactive
    ? undefined
    : and(
        eq(messageTemplates.isActive, true),
        isNull(messageTemplates.deletedAt)
      );
  return db
    .select()
    .from(messageTemplates)
    .where(condition)
    .orderBy(messageTemplates.situation, messageTemplates.title);
}

export async function getMessageTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.id, id))
    .limit(1);
  return result[0];
}

export async function createMessageTemplate(data: InsertMessageTemplate) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(messageTemplates).values(data);
  const result = await db
    .select()
    .from(messageTemplates)
    .orderBy(desc(messageTemplates.id))
    .limit(1);
  return result[0];
}

export async function updateMessageTemplate(
  id: number,
  data: Partial<InsertMessageTemplate>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(messageTemplates)
    .set(data)
    .where(eq(messageTemplates.id, id));
}

// ─── Contracts ────────────────────────────────────────────────────────────────
export const DEFAULT_CONSULTATION_SCRIPTS = [
  {
    title: "첫 통화 기본 흐름",
    category: "first_call",
    scriptBody:
      "안녕하세요, {담당자명}입니다.\n오늘 연락드린 이유는 가입을 권유드리기보다, 현재 보험 기준을 한 번 확인하실 수 있도록 안내드리기 위해서입니다.\n짧게 현재 상황만 확인하고, 필요하지 않은 내용은 권유드리지 않겠습니다.\n괜찮으시면 현재 보험료 부담이나 보장 관련해서 불편하신 부분이 있는지 먼저 여쭤봐도 될까요?",
  },
  {
    title: "부재 고객 재연락 흐름",
    category: "missed_call",
    scriptBody:
      "고객님, 통화가 어려우셨던 것 같아 다시 연락드렸습니다.\n급한 내용은 아니고, 이전에 확인이 필요했던 보험 관련 기준을 정리해드리려고 했습니다.\n편하신 시간에 짧게 확인만 도와드리겠습니다.",
  },
  {
    title: "보험료 부담 상담 흐름",
    category: "premium_burden",
    scriptBody:
      "보험료가 부담스럽게 느껴지실 때는 무조건 줄이는 것보다, 줄여도 되는 부분과 유지해야 하는 부분을 나누어 보는 것이 중요합니다.\n해지부터 판단하기보다, 현재 보장 공백이 생기지 않는 범위에서 조정 가능한지 먼저 확인해보겠습니다.",
  },
  {
    title: "보장 불안 상담 흐름",
    category: "coverage_concern",
    scriptBody:
      "보장이 충분한지 불안하실 때는 상품 이름보다 실제 어떤 상황에서 보장이 되는지 확인하는 것이 중요합니다.\n암, 뇌, 심장, 실손, 수술비처럼 기본 보장 축을 기준으로 현재 공백이 있는지 차분히 확인해보겠습니다.",
  },
  {
    title: "가족 책임형 상담 흐름",
    category: "family_responsibility",
    scriptBody:
      "가족을 책임지고 계신 경우에는 본인 보장만 보는 것보다, 소득 공백이나 치료비 부담이 가족에게 어떻게 이어질 수 있는지 함께 확인하는 것이 중요합니다.\n현재 가족 구성과 경제적 책임 범위를 기준으로 필요한 부분만 점검해보겠습니다.",
  },
  {
    title: "해지 고민 상담 흐름",
    category: "surrender_risk",
    scriptBody:
      "보험 해지를 고민하실 때는 보험료 부담도 중요하지만, 해지 후 다시 준비하기 어려운 보장이 있는지도 확인해야 합니다.\n바로 해지 여부를 결정하기보다, 유지할 것과 줄일 것, 조정 가능한 부분을 나누어 확인해보겠습니다.",
  },
  {
    title: "설계안 발송 후 확인 흐름",
    category: "proposal_follow_up",
    scriptBody:
      "자료를 보셨을 때 가장 중요한 것은 전체 금액보다 왜 이 구성이 필요한지 이해되는지입니다.\n이해가 안 되는 부분이나 부담스러운 부분이 있으면 그 기준부터 다시 설명드리겠습니다.",
  },
  {
    title: "계약 후 사후관리 흐름",
    category: "post_contract_care",
    scriptBody:
      "계약 이후에는 가입 내용이 제대로 이해되었는지, 청구나 변경 시 어떤 기준으로 확인하면 되는지 아는 것이 중요합니다.\n앞으로 필요하실 때 헷갈리지 않도록 주요 내용만 정리해서 관리해드리겠습니다.",
  },
  {
    title: "장기 미관리 고객 재접촉 흐름",
    category: "long_unmanaged",
    scriptBody:
      "오랜만에 연락드리는 만큼 부담을 드리기보다, 그동안 상황이 달라진 부분이 있는지만 먼저 확인하고 싶습니다.\n직장, 가족 구성, 보험료 부담, 기존 보장 기준이 달라졌다면 점검이 필요할 수 있습니다.",
  },
  {
    title: "일반 보장 점검 흐름",
    category: "general_check",
    scriptBody:
      "보험은 새로 준비하는 것보다 현재 상황에 맞게 유지되고 있는지 확인하는 과정이 중요합니다.\n현재 기준에서 과한 부분, 부족한 부분, 조정이 필요한 부분이 있는지 차분히 점검해보겠습니다.",
  },
] as const;

export async function getCustomerHandoffNotes(
  customerId: number,
  includeInactive = false
) {
  const db = await getDb();
  if (!db) return [];
  const condition = includeInactive
    ? eq(customerHandoffNotes.customerId, customerId)
    : and(
        eq(customerHandoffNotes.customerId, customerId),
        eq(customerHandoffNotes.isActive, true),
        isNull(customerHandoffNotes.deletedAt)
      );
  return db
    .select()
    .from(customerHandoffNotes)
    .where(condition)
    .orderBy(desc(customerHandoffNotes.createdAt));
}

export async function getCustomerHandoffNoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(customerHandoffNotes)
    .where(eq(customerHandoffNotes.id, id))
    .limit(1);
  return result[0];
}

export async function createCustomerHandoffNote(
  data: InsertCustomerHandoffNote
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(customerHandoffNotes).values(data);
  const result = await db
    .select()
    .from(customerHandoffNotes)
    .orderBy(desc(customerHandoffNotes.id))
    .limit(1);
  return result[0];
}

export async function updateCustomerHandoffNote(
  id: number,
  data: Partial<InsertCustomerHandoffNote>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customerHandoffNotes)
    .set(data)
    .where(eq(customerHandoffNotes.id, id));
}

export async function ensureDefaultConsultationScripts(createdBy: number) {
  const db = await getDb();
  if (!db) return { createdCount: 0 };
  let createdCount = 0;
  for (const script of DEFAULT_CONSULTATION_SCRIPTS) {
    const existing = await db
      .select()
      .from(consultationScripts)
      .where(
        and(
          eq(consultationScripts.title, script.title),
          eq(consultationScripts.category, script.category as any)
        )
      )
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(consultationScripts).values({
      ...script,
      complianceNote:
        "상담 참고용 문구입니다. 고객 상황에 맞게 설명하고 가입 강요, 공포 표현, 확정 표현은 피하세요.",
      tags: null,
      createdBy,
      isActive: true,
    } as InsertConsultationScript);
    createdCount += 1;
  }
  return { createdCount };
}

export async function getConsultationScripts(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const condition = includeInactive
    ? undefined
    : and(
        eq(consultationScripts.isActive, true),
        isNull(consultationScripts.deletedAt)
      );
  return db
    .select()
    .from(consultationScripts)
    .where(condition)
    .orderBy(consultationScripts.category, consultationScripts.title);
}

export async function getConsultationScriptById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(consultationScripts)
    .where(eq(consultationScripts.id, id))
    .limit(1);
  return result[0];
}

export async function createConsultationScript(data: InsertConsultationScript) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(consultationScripts).values(data);
  const result = await db
    .select()
    .from(consultationScripts)
    .orderBy(desc(consultationScripts.id))
    .limit(1);
  return result[0];
}

export async function updateConsultationScript(
  id: number,
  data: Partial<InsertConsultationScript>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(consultationScripts)
    .set(data)
    .where(eq(consultationScripts.id, id));
}

export async function getContractsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contracts)
    .where(
      and(eq(contracts.customerId, customerId), eq(contracts.isActive, true))
    )
    .orderBy(desc(contracts.createdAt));
}

export async function getContractsByCustomerIncludingInactive(
  customerId: number
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contracts)
    .where(eq(contracts.customerId, customerId))
    .orderBy(desc(contracts.createdAt));
}

export async function getAllContracts(filter: {
  agentId?: number;
  agentIds?: number[];
  teamId?: number;
  subBranchAdminId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const baseCondition = eq(contracts.isActive, true);
  if (filter.agentIds !== undefined) {
    if (filter.agentIds.length === 0) return [];
    return db
      .select()
      .from(contracts)
      .where(
        and(
          baseCondition,
          or(...filter.agentIds.map(id => eq(contracts.agentId, id)))
        )
      )
      .orderBy(desc(contracts.createdAt));
  } else if (filter.agentId !== undefined) {
    return db
      .select()
      .from(contracts)
      .where(and(baseCondition, eq(contracts.agentId, filter.agentId)))
      .orderBy(desc(contracts.createdAt));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map(u => u.id);
    if (agentIds.length === 0) return [];
    return db
      .select()
      .from(contracts)
      .where(
        and(baseCondition, or(...agentIds.map(id => eq(contracts.agentId, id))))
      )
      .orderBy(desc(contracts.createdAt));
  } else if (filter.subBranchAdminId !== undefined) {
    // 부지점장 산하 팀원들의 계약
    const subAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.subBranchAdminId, filter.subBranchAdminId));
    const agentIds = subAgents.map(u => u.id);
    if (
      typeof filter !== "undefined" &&
      filter.subBranchAdminId &&
      !agentIds.includes(filter.subBranchAdminId)
    )
      agentIds.push(filter.subBranchAdminId);
    if (agentIds.length === 0) return [];
    return db
      .select()
      .from(contracts)
      .where(
        and(baseCondition, or(...agentIds.map(id => eq(contracts.agentId, id))))
      )
      .orderBy(desc(contracts.createdAt));
  }
  return db
    .select()
    .from(contracts)
    .where(baseCondition)
    .orderBy(desc(contracts.createdAt));
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) return;
  await db.insert(contracts).values({ ...data, isActive: true });
}

export async function updateContract(
  id: number,
  data: Partial<InsertContract>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(contracts).set(data).where(eq(contracts.id, id));
}

export async function deactivateContract(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(contracts)
    .set({ isActive: false, deletedAt: new Date() })
    .where(eq(contracts.id, id));
}

export async function deactivateContractWithClient(
  id: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(contracts)
    .set({ isActive: false, deletedAt: new Date() })
    .where(eq(contracts.id, id));
}

export async function getDeletedContracts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contracts)
    .where(
      or(eq(contracts.isActive, false), sql`${contracts.deletedAt} is not null`)
    )
    .orderBy(desc(contracts.createdAt));
}

export async function restoreContract(id: number, client?: DbExecutor) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(contracts)
    .set({ isActive: true, deletedAt: null })
    .where(eq(contracts.id, id));
}

export async function permanentlyDeleteContract(
  id: number,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
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
    db
      .select({ id: contracts.id })
      .from(contracts)
      .where(eq(contracts.customerId, customerId))
      .limit(1),
    db
      .select({ id: consultations.id })
      .from(consultations)
      .where(eq(consultations.customerId, customerId))
      .limit(1),
    db
      .select({ id: statusHistory.id })
      .from(statusHistory)
      .where(eq(statusHistory.customerId, customerId))
      .limit(1),
    db
      .select({ id: consentLogs.id })
      .from(consentLogs)
      .where(eq(consentLogs.customerId, customerId))
      .limit(1),
    db
      .select({ id: assignmentHistory.id })
      .from(assignmentHistory)
      .where(eq(assignmentHistory.customerId, customerId))
      .limit(1),
    db
      .select({ id: deleteRequests.id })
      .from(deleteRequests)
      .where(eq(deleteRequests.customerId, customerId))
      .limit(1),
    db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.relatedType, "customer"),
          eq(notifications.relatedId, customerId)
        )
      )
      .limit(1),
    db
      .select({ id: reminders.id })
      .from(reminders)
      .where(
        and(
          eq(reminders.relatedType, "customer"),
          eq(reminders.relatedId, customerId)
        )
      )
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
  if (!db)
    return {
      contractHistory: 0,
      deleteRequests: 0,
      notifications: 0,
      reminders: 0,
    };
  const [historyRows, requestRows, notificationRows, reminderRows] =
    await Promise.all([
      db
        .select({ id: contractHistory.id })
        .from(contractHistory)
        .where(eq(contractHistory.contractId, contractId))
        .limit(1),
      db
        .select({ id: deleteRequests.id })
        .from(deleteRequests)
        .where(
          and(
            eq(deleteRequests.targetType, "contract"),
            eq(deleteRequests.targetId, contractId)
          )
        )
        .limit(1),
      db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.relatedType, "contract"),
            eq(notifications.relatedId, contractId)
          )
        )
        .limit(1),
      db
        .select({ id: reminders.id })
        .from(reminders)
        .where(
          and(
            eq(reminders.relatedType, "contract"),
            eq(reminders.relatedId, contractId)
          )
        )
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
  if (!db)
    return { users: 0, customers: 0, schedules: 0, assignmentHistory: 0 };
  const [userRows, customerRows, scheduleRows, assignmentRows] =
    await Promise.all([
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.teamId, teamId))
        .limit(1),
      db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.assignedTeamId, teamId))
        .limit(1),
      db
        .select({ id: schedules.id })
        .from(schedules)
        .where(eq(schedules.teamId, teamId))
        .limit(1),
      db
        .select({ id: assignmentHistory.id })
        .from(assignmentHistory)
        .where(
          or(
            eq(assignmentHistory.previousTeamId, teamId),
            eq(assignmentHistory.newTeamId, teamId)
          )
        )
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
  const result = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, id))
    .limit(1);
  return result[0];
}

// ─── Contract History ─────────────────────────────────────────────────────────
export async function createContractHistoryEntry(
  data: InsertContractHistory,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.insert(contractHistory).values(data);
}

export async function getContractHistory(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contractHistory)
    .where(eq(contractHistory.contractId, contractId))
    .orderBy(desc(contractHistory.createdAt));
}

export async function createDeleteRequest(
  data: InsertDeleteRequest,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.insert(deleteRequests).values(data);
}

export async function getDeleteRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(deleteRequests)
    .where(eq(deleteRequests.id, id))
    .limit(1);
  return result[0];
}

export async function getPendingDeleteRequestForTarget(
  targetType: "contract",
  targetId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(deleteRequests)
    .where(
      and(
        eq(deleteRequests.targetType, targetType),
        eq(deleteRequests.targetId, targetId),
        eq(deleteRequests.status, "pending")
      )
    )
    .limit(1);
  return result[0];
}

export async function getDeleteRequests(
  filter: {
    requestedBy?: number;
    status?: "pending" | "approved" | "rejected" | "cancelled";
  } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter.requestedBy !== undefined)
    conditions.push(eq(deleteRequests.requestedBy, filter.requestedBy));
  if (filter.status) conditions.push(eq(deleteRequests.status, filter.status));
  return db
    .select()
    .from(deleteRequests)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(deleteRequests.createdAt));
}

export async function updateDeleteRequest(
  id: number,
  data: Partial<typeof deleteRequests.$inferInsert>,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.update(deleteRequests).set(data).where(eq(deleteRequests.id, id));
}

// ─── Schedules ────────────────────────────────────────────────────────────────
export async function createFollowUp(
  data: InsertFollowUp,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return undefined;
  const result = await db.insert(followUps).values(data);
  return result[0].insertId as number;
}

export async function getFollowUpById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(followUps)
    .where(eq(followUps.id, id))
    .limit(1);
  return result[0];
}

export async function getFollowUps(filter: {
  customerId?: number;
  agentId?: number;
  agentIds?: number[];
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
  if (filter.customerId !== undefined)
    conditions.push(eq(followUps.customerId, filter.customerId));
  if (filter.agentIds !== undefined) {
    if (filter.agentIds.length === 0) return [];
    conditions.push(
      or(...filter.agentIds.map(id => eq(followUps.assignedAgentId, id)))
    );
  } else if (filter.agentId !== undefined)
    conditions.push(eq(followUps.assignedAgentId, filter.agentId));
  if (filter.teamId !== undefined)
    conditions.push(eq(followUps.teamId, filter.teamId));
  if (filter.subBranchAdminId !== undefined)
    conditions.push(eq(followUps.subBranchAdminId, filter.subBranchAdminId));
  if (filter.statuses && filter.statuses.length > 0)
    conditions.push(
      or(...filter.statuses.map(status => eq(followUps.status, status)))
    );
  if (filter.dueFrom)
    conditions.push(gte(followUps.nextContactDate, filter.dueFrom));
  if (filter.dueTo)
    conditions.push(lte(followUps.nextContactDate, filter.dueTo));
  return db
    .select()
    .from(followUps)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(followUps.nextContactDate);
}

export async function updateFollowUp(
  id: number,
  data: Partial<InsertFollowUp>,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.update(followUps).set(data).where(eq(followUps.id, id));
}

export async function getSchedules(filter: {
  userId?: number;
  userIds?: number[];
  teamId?: number;
  subBranchAdminId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(schedules.isActive, true)];
  if (filter.dateFrom)
    conditions.push(gte(schedules.startTime, filter.dateFrom));
  if (filter.dateTo) conditions.push(lte(schedules.startTime, filter.dateTo));

  if (filter.userIds !== undefined) {
    if (filter.userIds.length === 0) return [];
    return db
      .select()
      .from(schedules)
      .where(
        and(
          ...conditions,
          or(...filter.userIds.map(id => eq(schedules.userId, id)))
        )
      )
      .orderBy(schedules.startTime);
  }
  if (filter.userId !== undefined) {
    return db
      .select()
      .from(schedules)
      .where(and(...conditions, eq(schedules.userId, filter.userId)))
      .orderBy(schedules.startTime);
  }
  if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map(u => u.id);
    if (agentIds.length === 0) return [];
    return db
      .select()
      .from(schedules)
      .where(
        and(...conditions, or(...agentIds.map(id => eq(schedules.userId, id))))
      )
      .orderBy(schedules.startTime);
  }
  if (filter.subBranchAdminId !== undefined) {
    const subAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.subBranchAdminId, filter.subBranchAdminId));
    const agentIds = subAgents.map(u => u.id);
    if (
      typeof filter !== "undefined" &&
      filter.subBranchAdminId &&
      !agentIds.includes(filter.subBranchAdminId)
    )
      agentIds.push(filter.subBranchAdminId);
    if (agentIds.length === 0) return [];
    return db
      .select()
      .from(schedules)
      .where(
        and(...conditions, or(...agentIds.map(id => eq(schedules.userId, id))))
      )
      .orderBy(schedules.startTime);
  }
  return db
    .select()
    .from(schedules)
    .where(and(...conditions))
    .orderBy(schedules.startTime);
}

export async function createSchedule(data: InsertSchedule) {
  const db = await getDb();
  if (!db) return;
  await db.insert(schedules).values({ ...data, isActive: true });
}

export async function getScheduleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .limit(1);
  return rows[0];
}

export async function updateSchedule(
  id: number,
  data: Partial<InsertSchedule>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(schedules).set(data).where(eq(schedules.id, id));
}

export async function softDeleteSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(schedules)
    .set({ isActive: false, deletedAt: new Date(), status: "취소" })
    .where(eq(schedules.id, id));
}

export async function completeSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(schedules)
    .set({ status: "완료", completedAt: new Date() })
    .where(eq(schedules.id, id));
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotifications(
  userId: number,
  extraUserIds?: number[],
  limit = 200
) {
  const db = await getDb();
  if (!db) return [];
  if (extraUserIds && extraUserIds.length > 0) {
    const allIds = [userId, ...extraUserIds];
    return db
      .select()
      .from(notifications)
      .where(
        and(
          or(...allIds.map(id => eq(notifications.userId, id))),
          or(isNull(notifications.dueAt), lte(notifications.dueAt, new Date()))
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        or(isNull(notifications.dueAt), lte(notifications.dueAt, new Date()))
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getAllNotifications(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getNotificationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
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
    conditions.push(
      or(...filter.userIds.map(id => eq(notifications.userId, id)))
    );
  }
  if (filter.processStatus)
    conditions.push(
      eq(notifications.processStatus, filter.processStatus as any)
    );
  if (filter.isRead !== undefined)
    conditions.push(eq(notifications.isRead, filter.isRead));
  if (filter.type) conditions.push(eq(notifications.type, filter.type as any));
  if (filter.dateFrom)
    conditions.push(gte(notifications.createdAt, filter.dateFrom));
  if (filter.dateTo)
    conditions.push(lte(notifications.createdAt, filter.dateTo));
  conditions.push(
    or(isNull(notifications.dueAt), lte(notifications.dueAt, new Date()))
  );
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    whereClause
      ? db
          .select()
          .from(notifications)
          .where(whereClause)
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset)
      : db
          .select()
          .from(notifications)
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset),
    whereClause
      ? db
          .select({ count: sql<number>`COUNT(*)` })
          .from(notifications)
          .where(whereClause)
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
  return db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.subBranchAdminId, subBranchAdminId),
        eq(users.accountStatus, "active")
      )
    );
}

export async function getUsersByTeamId(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.teamId, teamId), eq(users.accountStatus, "active")));
}

export async function getUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        or(isNull(notifications.dueAt), lte(notifications.dueAt, new Date()))
      )
    );
  return result[0]?.count ?? 0;
}

export async function createNotification(
  data: InsertNotification,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}

export async function updateNotificationProcessStatus(
  id: number,
  processStatus: "미확인" | "확인" | "처리완료" | "보류"
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ processStatus, isRead: processStatus !== "미확인" })
    .where(eq(notifications.id, id));
}

// ─── Assignment History ───────────────────────────────────────────────────────
export async function createAssignmentHistory(
  data: InsertAssignmentHistory,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.insert(assignmentHistory).values(data);
}

export async function getAssignmentHistory(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(assignmentHistory)
    .where(eq(assignmentHistory.customerId, customerId))
    .orderBy(desc(assignmentHistory.createdAt));
}

// ─── Settings ────────────────────────────────────────────────────────────
export async function getSettings(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(settings)
    .where(eq(settings.category, category))
    .orderBy(settings.value);
}

export async function createSetting(
  category: string,
  value: string,
  createdBy: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(settings)
    .values({ category, value, createdBy, isActive: true });
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

export type OnboardingTemplateWithItemsInput = {
  name: string;
  description?: string | null;
  targetRole: "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
  items: Array<{
    title: string;
    description?: string | null;
    category: string;
    required: boolean;
    requiresManagerApproval: boolean;
    practiceRequired: boolean;
    relatedMenu?: string | null;
    completionCriteria?: string | null;
    estimatedMinutes?: number;
    sortOrder: number;
  }>;
};

export async function getOnboardingTemplates(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const condition = includeInactive
    ? undefined
    : and(
        eq(onboardingTemplates.isActive, true),
        isNull(onboardingTemplates.archivedAt)
      );
  return db
    .select()
    .from(onboardingTemplates)
    .where(condition)
    .orderBy(onboardingTemplates.targetRole, onboardingTemplates.id);
}

export async function getOnboardingTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(onboardingTemplates)
    .where(eq(onboardingTemplates.id, id))
    .limit(1);
  return rows[0];
}

export async function getOnboardingTemplateItems(
  templateId: number,
  includeInactive = false
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    eq(onboardingTemplateItems.templateId, templateId),
  ];
  if (!includeInactive)
    conditions.push(eq(onboardingTemplateItems.isActive, true));
  return db
    .select()
    .from(onboardingTemplateItems)
    .where(and(...conditions))
    .orderBy(onboardingTemplateItems.sortOrder, onboardingTemplateItems.id);
}

export async function createOnboardingTemplate(
  data: InsertOnboardingTemplate,
  items: Array<Omit<InsertOnboardingTemplateItem, "templateId">>
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(onboardingTemplates).values(data);
  const [template] = await db
    .select()
    .from(onboardingTemplates)
    .orderBy(desc(onboardingTemplates.id))
    .limit(1);
  if (!template) return null;
  if (items.length > 0) {
    await db
      .insert(onboardingTemplateItems)
      .values(items.map(item => ({ ...item, templateId: template.id })));
  }
  return template;
}

export async function updateOnboardingTemplate(
  id: number,
  data: Partial<InsertOnboardingTemplate>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(onboardingTemplates)
    .set(data)
    .where(eq(onboardingTemplates.id, id));
}

export async function upsertOnboardingTemplateItem(
  id: number | null,
  data: InsertOnboardingTemplateItem
) {
  const db = await getDb();
  if (!db) return;
  if (id) {
    await db
      .update(onboardingTemplateItems)
      .set(data)
      .where(eq(onboardingTemplateItems.id, id));
    return id;
  }
  await db.insert(onboardingTemplateItems).values(data);
  const [created] = await db
    .select()
    .from(onboardingTemplateItems)
    .orderBy(desc(onboardingTemplateItems.id))
    .limit(1);
  return created?.id;
}

export async function getOnboardingAssignments(filter: {
  targetUserIds?: number[];
  targetUserId?: number;
  assignedBy?: number;
  includeArchived?: boolean;
  status?: "assigned" | "in_progress" | "completed" | "overdue" | "archived";
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (!filter.includeArchived)
    conditions.push(isNull(userOnboardingAssignments.archivedAt));
  if (filter.targetUserIds !== undefined) {
    if (filter.targetUserIds.length === 0) return [];
    conditions.push(
      inArray(userOnboardingAssignments.targetUserId, filter.targetUserIds)
    );
  } else if (filter.targetUserId !== undefined) {
    conditions.push(
      eq(userOnboardingAssignments.targetUserId, filter.targetUserId)
    );
  }
  if (filter.assignedBy !== undefined)
    conditions.push(
      eq(userOnboardingAssignments.assignedBy, filter.assignedBy)
    );
  if (filter.status)
    conditions.push(eq(userOnboardingAssignments.status, filter.status));
  return db
    .select()
    .from(userOnboardingAssignments)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(userOnboardingAssignments.createdAt));
}

export async function getOnboardingAssignmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(userOnboardingAssignments)
    .where(eq(userOnboardingAssignments.id, id))
    .limit(1);
  return rows[0];
}

export async function getOnboardingItemProgressByAssignment(
  assignmentId: number
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userOnboardingItemProgress)
    .where(eq(userOnboardingItemProgress.assignmentId, assignmentId));
}

export async function createOnboardingAssignment(
  data: InsertUserOnboardingAssignment
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(userOnboardingAssignments).values(data);
  const [created] = await db
    .select()
    .from(userOnboardingAssignments)
    .orderBy(desc(userOnboardingAssignments.id))
    .limit(1);
  return created;
}

export async function createOnboardingItemProgressRows(
  rows: InsertUserOnboardingItemProgress[]
) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  await db.insert(userOnboardingItemProgress).values(rows);
}

export async function updateOnboardingAssignment(
  id: number,
  data: Partial<InsertUserOnboardingAssignment>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userOnboardingAssignments)
    .set(data)
    .where(eq(userOnboardingAssignments.id, id));
}

export async function updateOnboardingItemProgress(
  id: number,
  data: Partial<InsertUserOnboardingItemProgress>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userOnboardingItemProgress)
    .set(data)
    .where(eq(userOnboardingItemProgress.id, id));
}

export async function getOnboardingItemProgressById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(userOnboardingItemProgress)
    .where(eq(userOnboardingItemProgress.id, id))
    .limit(1);
  return rows[0];
}

export async function ensureDefaultOnboardingTemplates(createdBy: number) {
  const db = await getDb();
  if (!db) return { createdTemplates: 0, createdItems: 0 };

  const baseline: OnboardingTemplateWithItemsInput[] = [
    {
      name: "팀원 기본 교육",
      description: "신규 팀원의 고객관리·상담·후속관리 기본 운영 교육",
      targetRole: "member",
      items: [
        {
          title: "BOA CRM 로그인 방법",
          category: "basic",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: false,
          relatedMenu: "/",
          completionCriteria: "정상 로그인 확인",
          estimatedMinutes: 10,
          sortOrder: 10,
        },
        {
          title: "모바일 앱 실행 및 푸시 알림 허용",
          category: "mobile",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/notification-preferences",
          completionCriteria: "모바일에서 알림 허용 완료",
          estimatedMinutes: 15,
          sortOrder: 20,
        },
        {
          title: "내 고객만 조회되는 권한 구조 이해",
          category: "security",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: false,
          relatedMenu: "/customers",
          completionCriteria: "권한 범위 설명 가능",
          estimatedMinutes: 15,
          sortOrder: 30,
        },
        {
          title: "고객 검색 방법",
          category: "customer",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/customers",
          completionCriteria: "[TEST] 고객 검색 성공",
          estimatedMinutes: 10,
          sortOrder: 40,
        },
        {
          title: "상담기록 2~3줄 작성 기준",
          category: "consultation",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/customers",
          completionCriteria: "[TEST] 고객 상담기록 작성",
          estimatedMinutes: 15,
          sortOrder: 50,
        },
        {
          title: "후속관리 날짜 등록",
          category: "follow_up",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/customers",
          completionCriteria: "[TEST] 고객 후속관리 등록",
          estimatedMinutes: 15,
          sortOrder: 60,
        },
        {
          title: "일정 생성과 완료 처리",
          category: "schedule",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/calendar",
          completionCriteria: "일정 생성/완료 처리",
          estimatedMinutes: 15,
          sortOrder: 70,
        },
        {
          title: "계약 입력 기준",
          category: "contract",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: true,
          relatedMenu: "/contracts",
          completionCriteria: "[TEST] 계약 입력 연습",
          estimatedMinutes: 20,
          sortOrder: 80,
        },
        {
          title: "고객정보 외부 저장 금지",
          category: "security",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: false,
          relatedMenu: "/operation-risk",
          completionCriteria: "보안 정책 확인",
          estimatedMinutes: 10,
          sortOrder: 90,
        },
        {
          title: "실제 고객정보 테스트 금지",
          category: "security",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: false,
          relatedMenu: "/customers",
          completionCriteria: "[TEST] 데이터만 사용",
          estimatedMinutes: 10,
          sortOrder: 100,
        },
      ],
    },
    {
      name: "팀장 기본 교육",
      description: "팀장 산하 팀원 관리와 운영 지표 점검 교육",
      targetRole: "team_leader",
      items: [
        {
          title: "산하 팀원 고객 조회 범위",
          category: "rbac",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: false,
          relatedMenu: "/customers",
          completionCriteria: "타 팀 접근 금지 이해",
          estimatedMinutes: 15,
          sortOrder: 10,
        },
        {
          title: "팀원 DB 배정 기준",
          category: "operation",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: true,
          relatedMenu: "/customers/assign",
          completionCriteria: "[TEST] 배정 시나리오 설명",
          estimatedMinutes: 20,
          sortOrder: 20,
        },
        {
          title: "오늘 후속관리 누락 확인",
          category: "follow_up",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/aftercare-campaigns",
          completionCriteria: "누락 대상 확인",
          estimatedMinutes: 15,
          sortOrder: 30,
        },
        {
          title: "알림 처리율·후속관리 완료율 확인",
          category: "analytics",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/admin/team-completion",
          completionCriteria: "지표 조회 성공",
          estimatedMinutes: 15,
          sortOrder: 40,
        },
        {
          title: "타 팀 데이터 접근 금지",
          category: "security",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: false,
          relatedMenu: "/operation-risk",
          completionCriteria: "권한 정책 숙지",
          estimatedMinutes: 10,
          sortOrder: 50,
        },
      ],
    },
    {
      name: "부지점장 기본 교육",
      description: "부지점 단위 조직 운영과 보고 기준 교육",
      targetRole: "sub_branch_admin",
      items: [
        {
          title: "산하 팀장·팀원 범위 이해",
          category: "rbac",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: false,
          relatedMenu: "/organization",
          completionCriteria: "산하 범위 설명",
          estimatedMinutes: 15,
          sortOrder: 10,
        },
        {
          title: "산하 고객 조회 기준",
          category: "customer",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/customers",
          completionCriteria: "필터 기반 조회",
          estimatedMinutes: 15,
          sortOrder: 20,
        },
        {
          title: "팀장별 업무 흐름 점검",
          category: "operation",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: true,
          relatedMenu: "/team-insights",
          completionCriteria: "팀장별 현황 확인",
          estimatedMinutes: 20,
          sortOrder: 30,
        },
      ],
    },
    {
      name: "지점장 관리자 교육",
      description: "전체 운영 권한과 민감 기능 주의사항 교육",
      targetRole: "branch_admin",
      items: [
        {
          title: "전체 DB와 내 DB 구분",
          category: "rbac",
          required: true,
          requiresManagerApproval: false,
          practiceRequired: false,
          relatedMenu: "/",
          completionCriteria: "대시보드 지표 구분 이해",
          estimatedMinutes: 10,
          sortOrder: 10,
        },
        {
          title: "삭제 요청 승인·반려",
          category: "critical",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: true,
          relatedMenu: "/operation-risk",
          completionCriteria: "[TEST] 삭제 요청 처리",
          estimatedMinutes: 20,
          sortOrder: 20,
        },
        {
          title: "운영 DB reset/drop/hard delete 금지",
          category: "security",
          required: true,
          requiresManagerApproval: true,
          practiceRequired: false,
          relatedMenu: "/operation-risk",
          completionCriteria: "운영 안전 정책 확인",
          estimatedMinutes: 10,
          sortOrder: 30,
        },
      ],
    },
  ];

  let createdTemplates = 0;
  let createdItems = 0;
  for (const template of baseline) {
    const [existing] = await db
      .select()
      .from(onboardingTemplates)
      .where(
        and(
          eq(onboardingTemplates.name, template.name),
          eq(onboardingTemplates.targetRole, template.targetRole as any)
        )
      )
      .limit(1);
    let templateId = existing?.id;
    if (!existing) {
      await db.insert(onboardingTemplates).values({
        name: template.name,
        description: template.description,
        targetRole: template.targetRole,
        createdBy,
        isActive: true,
      });
      const [created] = await db
        .select()
        .from(onboardingTemplates)
        .orderBy(desc(onboardingTemplates.id))
        .limit(1);
      templateId = created?.id;
      createdTemplates += 1;
    }
    if (!templateId) continue;
    for (const item of template.items) {
      const [existsItem] = await db
        .select()
        .from(onboardingTemplateItems)
        .where(
          and(
            eq(onboardingTemplateItems.templateId, templateId),
            eq(onboardingTemplateItems.title, item.title)
          )
        )
        .limit(1);
      if (existsItem) continue;
      await db.insert(onboardingTemplateItems).values({
        templateId,
        title: item.title,
        description: item.description,
        category: item.category,
        required: item.required,
        requiresManagerApproval: item.requiresManagerApproval,
        practiceRequired: item.practiceRequired,
        relatedMenu: item.relatedMenu,
        completionCriteria: item.completionCriteria,
        estimatedMinutes: item.estimatedMinutes ?? 10,
        sortOrder: item.sortOrder,
        isActive: true,
      });
      createdItems += 1;
    }
  }
  return { createdTemplates, createdItems };
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export async function createActivityLog(
  data: InsertActivityLog,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.insert(activityLogs).values({
    ...data,
    details: sanitizeActivityLogDetailsForStorage(data.details),
    ipAddress: data.ipAddress ? "[REDACTED]" : data.ipAddress,
    userAgent: data.userAgent
      ? sanitizeActivityLogText(data.userAgent, 80)
      : data.userAgent,
  });
}

export async function getActivityLogs(
  limit = 500,
  subBranchAdminId?: number,
  teamId?: number
) {
  const db = await getDb();
  if (!db) return [];

  if (subBranchAdminId !== undefined) {
    // 부지점장: 본인 산하 팀원들의 로그만
    const subAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.subBranchAdminId, subBranchAdminId));
    const agentIds = subAgents.map(u => u.id);
    if (subBranchAdminId && !agentIds.includes(subBranchAdminId))
      agentIds.push(subBranchAdminId);
    if (agentIds.length === 0) return [];
    return db
      .select()
      .from(activityLogs)
      .where(or(...agentIds.map(id => eq(activityLogs.userId, id))))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  } else if (teamId !== undefined) {
    // 팀장: 본인 팀원들의 로그만
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, teamId));
    const agentIds = teamAgents.map(u => u.id);
    if (agentIds.length === 0) return [];
    return db
      .select()
      .from(activityLogs)
      .where(or(...agentIds.map(id => eq(activityLogs.userId, id))))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(activityLogs)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// ─── User Device Tokens ──────────────────────────────────────────────────────
export async function upsertUserDeviceToken(data: InsertUserDeviceToken) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  await db
    .insert(userDeviceTokens)
    .values({
      ...data,
      platform: "android",
      isActive: true,
      lastSeenAt: now,
      revokedAt: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        deviceId: data.deviceId ?? null,
        appVersion: data.appVersion ?? null,
        deviceModel: data.deviceModel ?? null,
        osVersion: data.osVersion ?? null,
        isActive: true,
        revokedAt: null,
        lastSeenAt: now,
        updatedAt: now,
      },
    });
  const rows = await db
    .select()
    .from(userDeviceTokens)
    .where(
      and(
        eq(userDeviceTokens.userId, data.userId),
        eq(userDeviceTokens.token, data.token)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function deactivateUserDeviceToken(userId: number, token: string) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .update(userDeviceTokens)
    .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(userDeviceTokens.userId, userId),
        eq(userDeviceTokens.token, token)
      )
    );
  return Number(
    (result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0
  );
}

export async function deactivateAllUserDeviceTokens(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .update(userDeviceTokens)
    .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(userDeviceTokens.userId, userId),
        eq(userDeviceTokens.isActive, true)
      )
    );
  return Number(
    (result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0
  );
}

export async function listUserDeviceTokens(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userDeviceTokens)
    .where(eq(userDeviceTokens.userId, userId))
    .orderBy(desc(userDeviceTokens.lastSeenAt));
}

export async function getActiveDeviceTokensForUsers(userIds: number[]) {
  const db = await getDb();
  if (!db || userIds.length === 0) return [];
  return db
    .select({
      id: userDeviceTokens.id,
      userId: userDeviceTokens.userId,
      platform: userDeviceTokens.platform,
      token: userDeviceTokens.token,
    })
    .from(userDeviceTokens)
    .innerJoin(users, eq(userDeviceTokens.userId, users.id))
    .where(
      and(
        inArray(userDeviceTokens.userId, userIds),
        eq(userDeviceTokens.platform, "android"),
        eq(userDeviceTokens.isActive, true),
        isNull(userDeviceTokens.revokedAt),
        eq(users.accountStatus, "active")
      )
    );
}

export async function deactivateDeviceTokenByToken(token: string) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .update(userDeviceTokens)
    .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(userDeviceTokens.token, token));
  return Number(
    (result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0
  );
}

export async function getPushNotificationLogByDedupeKey(dedupeKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pushNotificationLogs)
    .where(eq(pushNotificationLogs.dedupeKey, dedupeKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPushNotificationLog(
  data: InsertPushNotificationLog
) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(pushNotificationLogs).values(data);
  } catch (err: any) {
    if (err?.code !== "ER_DUP_ENTRY" && err?.errno !== 1062) throw err;
  }
  return getPushNotificationLogByDedupeKey(data.dedupeKey);
}

export async function updatePushNotificationLog(
  id: number,
  data: Partial<InsertPushNotificationLog>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushNotificationLogs)
    .set(data)
    .where(eq(pushNotificationLogs.id, id));
}

export const DEFAULT_PUSH_NOTIFICATION_PREFERENCES = {
  followUpTodayEnabled: true,
  scheduleReminderEnabled: true,
  deleteRequestEnabled: true,
  testNotificationEnabled: true,
  quietHoursEnabled: true,
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  timezone: "Asia/Seoul",
} as const;

export async function getPushNotificationPreference(userId: number) {
  const db = await getDb();
  if (!db)
    return {
      id: 0,
      userId,
      ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  const rows = await db
    .select()
    .from(pushNotificationPreferences)
    .where(eq(pushNotificationPreferences.userId, userId))
    .limit(1);
  if (rows[0]) return rows[0];
  await db
    .insert(pushNotificationPreferences)
    .values({ userId, ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES });
  const created = await db
    .select()
    .from(pushNotificationPreferences)
    .where(eq(pushNotificationPreferences.userId, userId))
    .limit(1);
  return (
    created[0] ?? {
      id: 0,
      userId,
      ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );
}

export async function updatePushNotificationPreference(
  userId: number,
  data: Partial<
    Omit<
      InsertPushNotificationPreference,
      "id" | "userId" | "createdAt" | "updatedAt"
    >
  >
) {
  const db = await getDb();
  if (!db) return getPushNotificationPreference(userId);
  await getPushNotificationPreference(userId);
  await db
    .update(pushNotificationPreferences)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pushNotificationPreferences.userId, userId));
  return getPushNotificationPreference(userId);
}

export async function listPushNotificationLogs(
  filter: {
    dateFrom?: Date;
    dateTo?: Date;
    type?: string;
    status?: string;
    userId?: number;
    sourceType?: string;
    limit?: number;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const clauses = [];
  if (filter.dateFrom)
    clauses.push(gte(pushNotificationLogs.createdAt, filter.dateFrom));
  if (filter.dateTo)
    clauses.push(lte(pushNotificationLogs.createdAt, filter.dateTo));
  if (filter.type) clauses.push(eq(pushNotificationLogs.type, filter.type));
  if (filter.status)
    clauses.push(eq(pushNotificationLogs.status, filter.status as any));
  if (filter.userId)
    clauses.push(eq(pushNotificationLogs.userId, filter.userId));
  if (filter.sourceType)
    clauses.push(eq(pushNotificationLogs.sourceType, filter.sourceType));
  return db
    .select({
      id: pushNotificationLogs.id,
      type: pushNotificationLogs.type,
      userId: pushNotificationLogs.userId,
      userName: users.name,
      userRole: users.role,
      sourceType: pushNotificationLogs.sourceType,
      sourceId: pushNotificationLogs.sourceId,
      dedupeKey: pushNotificationLogs.dedupeKey,
      status: pushNotificationLogs.status,
      errorCode: pushNotificationLogs.errorCode,
      sentAt: pushNotificationLogs.sentAt,
      createdAt: pushNotificationLogs.createdAt,
    })
    .from(pushNotificationLogs)
    .leftJoin(users, eq(pushNotificationLogs.userId, users.id))
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(pushNotificationLogs.createdAt))
    .limit(filter.limit ?? 100);
}

export async function getPushNotificationOperationSummary(
  dateFrom?: Date,
  dateTo?: Date
) {
  const logs = await listPushNotificationLogs({
    dateFrom,
    dateTo,
    limit: 1000,
  });
  const tokens = await listAllDeviceTokenSummaries();
  return {
    total: logs.length,
    sent: logs.filter(log => log.status === "sent").length,
    failed: logs.filter(
      log =>
        log.status === "failed" || log.status === "invalid_token_deactivated"
    ).length,
    skipped: logs.filter(
      log =>
        String(log.status).startsWith("skipped") ||
        log.status === "duplicate_skipped"
    ).length,
    inactiveTokens: tokens.filter(token => !token.isActive || token.revokedAt)
      .length,
  };
}

export async function listAllDeviceTokenSummaries() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: userDeviceTokens.id,
      userId: userDeviceTokens.userId,
      platform: userDeviceTokens.platform,
      isActive: userDeviceTokens.isActive,
      revokedAt: userDeviceTokens.revokedAt,
      lastSeenAt: userDeviceTokens.lastSeenAt,
    })
    .from(userDeviceTokens);
}

// ─── Performance Stats ────────────────────────────────────────────────────────
function maskLogPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "[masked-phone]";
  if (digits.startsWith("02"))
    return `${digits.slice(0, 2)}-***-${digits.slice(-4)}`;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskLogEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return "[masked-email]";
  return `${local.slice(0, 1)}***@${domain}`;
}

function sanitizeActivityLogText(value: string, maxLength = 160) {
  const sanitized = value
    .replace(/\b\d{6}-\d{7}\b/g, match => `${match.slice(0, 6)}-*******`)
    .replace(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/g, "$1-**-**")
    .replace(/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match =>
      maskLogPhone(match)
    )
    .replace(/\b02[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, match => maskLogPhone(match))
    .replace(
      /\b([A-Z0-9._%+-])([A-Z0-9._%+-]*)(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
      (_match, first, rest, domain) =>
        `${first}${"*".repeat(Math.max(3, String(rest).length))}${domain}`
    )
    .replace(
      /\b(?:token|accessToken|refreshToken|idToken|firebaseToken|deviceToken|fcmToken|secret|clientSecret|password|api[_-]?key|privateKey|DATABASE_URL|JWT_SECRET|authorization|cookie|session|credential|keyFile|googleClientSecret|firebaseAdmin)\s*[:=]\s*[^,\s"}]+/gi,
      "[REDACTED]"
    );
  return sanitized.length > maxLength
    ? `${sanitized.slice(0, maxLength)}...`
    : sanitized;
}

function sanitizeActivityLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeActivityLogValue);
  if (typeof value === "string") return sanitizeActivityLogText(value);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (
      /(password|pass|token|accesstoken|refreshtoken|idtoken|firebasetoken|devicetoken|fcmtoken|secret|clientsecret|apikey|privatekey|serviceaccount|database_url|jwt_secret|authorization|cookie|session|credential|keyfile|googleclientsecret|firebaseadmin|openid|ssn|residentnumber|rrn|policy_number|policynumber)/i.test(
        normalizedKey
      )
    ) {
      result[key] = "[REDACTED]";
    } else if (
      /birth(date|day)?/i.test(normalizedKey) &&
      typeof item === "string"
    ) {
      const digits = item.replace(/\D/g, "");
      result[key] =
        digits.length === 6
          ? `${digits.slice(0, 2)}****`
          : digits.length >= 8
            ? `${digits.slice(0, 4)}****`
            : "[masked-birth-date]";
    } else if (
      /phone|contact|mobile|tel/i.test(normalizedKey) &&
      typeof item === "string"
    ) {
      result[key] = maskLogPhone(item);
    } else if (/email/i.test(normalizedKey) && typeof item === "string") {
      result[key] = maskLogEmail(item);
    } else if (/(premium|amount|fee)/i.test(normalizedKey)) {
      result[key] = "금액 정보 변경 [redacted]";
    } else if (
      /(content|body|scriptbody|templatebody|description|memo|message|note|productname|diseasename|illness|medical)/i.test(
        normalizedKey
      )
    ) {
      result[key] = "업무 상세 변경 [redacted]";
    } else {
      result[key] = sanitizeActivityLogValue(item);
    }
  }
  return result;
}

function sanitizeActivityLogDetailsForStorage(details?: string | null) {
  if (!details) return details ?? null;
  try {
    return JSON.stringify(sanitizeActivityLogValue(JSON.parse(details)));
  } catch {
    return sanitizeActivityLogText(details, 240);
  }
}

function truncateTimelineText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return null;
  const normalized = sanitizeActivityLogText(
    value.replace(/\s+/g, " ").trim(),
    maxLength
  );
  if (!normalized) return null;
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function safeTimelineMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return sanitizeActivityLogValue(value) as Record<string, unknown>;
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

function userLabel(
  userMap: Map<number, { name: string | null; role: string | null }>,
  id?: number | null
) {
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
    CUSTOMER_RELATIONSHIP_CREATED: "고객 관계가 추가되었습니다.",
    CUSTOMER_RELATIONSHIP_UPDATED: "고객 관계가 수정되었습니다.",
    CUSTOMER_RELATIONSHIP_DELETED: "고객 관계가 삭제되었습니다.",
  };
  return labels[action] ?? action;
}

function timelineSeverity(
  eventType: string
): CustomerTimelineEvent["severity"] {
  if (
    eventType.includes("deleted") ||
    eventType.includes("blocked") ||
    eventType.includes("rejected")
  )
    return "warning";
  if (
    eventType.includes("restored") ||
    eventType.includes("completed") ||
    eventType.includes("approved")
  )
    return "success";
  if (eventType.includes("contract")) return "info";
  return "normal";
}

export async function getCustomerTimeline(
  customerId: number,
  filter: CustomerTimelineFilter = {}
) {
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
    relationshipRows,
  ] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)).limit(1),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users),
    db
      .select()
      .from(consultations)
      .where(eq(consultations.customerId, customerId)),
    db.select().from(contracts).where(eq(contracts.customerId, customerId)),
    db.select().from(followUps).where(eq(followUps.customerId, customerId)),
    db
      .select()
      .from(assignmentHistory)
      .where(eq(assignmentHistory.customerId, customerId)),
    db
      .select()
      .from(statusHistory)
      .where(eq(statusHistory.customerId, customerId)),
    db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.relatedType, "customer"),
          eq(notifications.relatedId, customerId)
        )
      ),
    db
      .select()
      .from(deleteRequests)
      .where(eq(deleteRequests.customerId, customerId)),
    db
      .select()
      .from(customerRelationships)
      .where(
        or(
          eq(customerRelationships.primaryCustomerId, customerId),
          eq(customerRelationships.relatedCustomerId, customerId)
        )
      )
      .limit(100),
  ]);

  const customer = customerRows[0];
  const userMap = new Map(
    userRows.map(user => [user.id, { name: user.name, role: user.role }])
  );
  const contractIds = contractRows.map(contract => contract.id);
  const requestIds = requestRows.map(request => request.id);
  const [
    contractHistoryRows,
    contractNotificationRows,
    customerActivityRows,
    contractActivityRows,
    requestActivityRows,
  ] = await Promise.all([
    contractIds.length > 0
      ? db
          .select()
          .from(contractHistory)
          .where(inArray(contractHistory.contractId, contractIds))
      : Promise.resolve([]),
    contractIds.length > 0
      ? db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.relatedType, "contract"),
              inArray(notifications.relatedId, contractIds)
            )
          )
      : Promise.resolve([]),
    db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.targetType, "customer"),
          eq(activityLogs.targetId, customerId)
        )
      )
      .limit(200),
    contractIds.length > 0
      ? db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.targetType, "contract"),
              inArray(activityLogs.targetId, contractIds)
            )
          )
          .limit(200)
      : Promise.resolve([]),
    requestIds.length > 0
      ? db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.targetType, "delete_request"),
              inArray(activityLogs.targetId, requestIds)
            )
          )
          .limit(200)
      : Promise.resolve([]),
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
      metadata: {
        consultStatus: customer.consultStatus,
        priority: customer.priority,
      },
      severity: "normal",
      relatedId: customer.id,
      relatedType: "customer",
    });
  }

  for (const row of consultationRows) {
    const updated =
      row.updatedAt && row.updatedAt.getTime() !== row.createdAt.getTime();
    pushEvent({
      id: `consultation:${row.id}`,
      eventType: updated ? "consultation_updated" : "consultation_created",
      eventLabel: updated
        ? "상담기록이 수정되었습니다."
        : "상담기록이 추가되었습니다.",
      occurredAt: updated ? row.updatedAt : row.createdAt,
      ...userLabel(userMap, row.agentId),
      source: "consultations",
      summary:
        row.summary ??
        `${row.consultationType ?? "상담"} / ${row.customerNeed ?? row.status}`,
      detail: truncateTimelineText(row.content, 140),
      metadata: safeTimelineMetadata({
        status: row.status,
        consultationType: row.consultationType,
        customerNeed: row.customerNeed,
        nextAction: row.nextAction,
      }),
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
      eventLabel: deleted
        ? "계약이 삭제 처리되었습니다."
        : "계약이 등록되었습니다.",
      occurredAt: row.deletedAt ?? row.createdAt,
      ...userLabel(userMap, row.createdBy ?? row.agentId),
      source: "contracts",
      summary: `${row.company ?? "보험사 미입력"} / ${row.productName ?? "상품명 미입력"}`,
      detail: null,
      metadata: safeTimelineMetadata({
        productGroup: row.productGroup,
        contractStatus: row.contractStatus,
        paymentStatus: row.paymentStatus,
        monthlyPremium: row.monthlyPremium,
      }),
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
      metadata: safeTimelineMetadata({
        fieldName: row.fieldName,
        beforeValue: row.beforeValue,
        afterValue: row.afterValue,
      }),
      severity: row.fieldName === "isActive" ? "warning" : "info",
      relatedId: row.contractId,
      relatedType: "contract",
    });
  }

  for (const row of followUpRows) {
    const eventType =
      row.status === "completed"
        ? "follow_up_completed"
        : row.status === "cancelled"
          ? "follow_up_cancelled"
          : "follow_up_created";
    pushEvent({
      id: `follow_up:${row.id}`,
      eventType,
      eventLabel:
        row.status === "completed"
          ? "후속관리가 완료되었습니다."
          : row.status === "cancelled"
            ? "후속관리가 취소되었습니다."
            : "다음 연락일이 설정되었습니다.",
      occurredAt: row.completedAt ?? row.updatedAt ?? row.createdAt,
      ...userLabel(userMap, row.createdBy),
      source: "follow_ups",
      summary: `${row.nextAction} / ${row.reason}`,
      detail: truncateTimelineText(row.memo, 100),
      metadata: safeTimelineMetadata({
        nextContactDate: row.nextContactDate,
        status: row.status,
      }),
      severity:
        row.status === "completed"
          ? "success"
          : row.status === "cancelled"
            ? "warning"
            : "normal",
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
      metadata: safeTimelineMetadata({
        previousStatus: row.previousStatus,
        newStatus: row.newStatus,
      }),
      severity: "normal",
      relatedId: row.id,
      relatedType: "status_history",
    });
  }

  for (const row of [...relatedNotificationRows, ...contractNotificationRows]) {
    const changed = row.isRead || row.processStatus !== "미확인";
    pushEvent({
      id: `notification:${row.id}`,
      eventType: changed
        ? "notification_status_changed"
        : "notification_created",
      eventLabel: changed
        ? "알림 상태가 변경되었습니다."
        : "알림이 생성되었습니다.",
      occurredAt: row.createdAt,
      ...userLabel(userMap, row.userId),
      source: "notifications",
      summary: row.title,
      detail: truncateTimelineText(row.message, 120),
      metadata: safeTimelineMetadata({
        type: row.type,
        processStatus: row.processStatus,
        isRead: row.isRead,
        relatedType: row.relatedType,
        relatedId: row.relatedId,
      }),
      severity: changed ? "success" : "warning",
      relatedId: row.id,
      relatedType: "notification",
    });
  }

  for (const row of requestRows) {
    pushEvent({
      id: `delete_request:${row.id}`,
      eventType:
        row.status === "approved"
          ? "delete_request_approved"
          : row.status === "rejected"
            ? "delete_request_rejected"
            : "delete_request_created",
      eventLabel:
        row.status === "approved"
          ? "삭제 요청이 승인되었습니다."
          : row.status === "rejected"
            ? "삭제 요청이 반려되었습니다."
            : "삭제 요청이 생성되었습니다.",
      occurredAt: row.reviewedAt ?? row.updatedAt ?? row.createdAt,
      ...userLabel(userMap, row.requestedBy),
      source: "delete_requests",
      summary: row.requestReason,
      detail: truncateTimelineText(row.reviewComment ?? row.requestMemo, 120),
      metadata: safeTimelineMetadata({
        requestType: row.requestType,
        status: row.status,
        expectedImpact: row.expectedImpact,
      }),
      severity:
        row.status === "approved"
          ? "warning"
          : row.status === "rejected"
            ? "normal"
            : "info",
      relatedId: row.id,
      relatedType: "delete_request",
    });
  }

  for (const row of relationshipRows) {
    const deleted = row.deletedAt != null || row.status === "inactive";
    pushEvent({
      id: `customer_relationship:${row.id}:${deleted ? "deleted" : "active"}`,
      eventType: deleted
        ? "customer_relationship_deleted"
        : row.createdAt.getTime() === row.updatedAt.getTime()
          ? "customer_relationship_created"
          : "customer_relationship_updated",
      eventLabel: deleted
        ? "고객 관계가 삭제되었습니다."
        : row.createdAt.getTime() === row.updatedAt.getTime()
          ? "고객 관계가 추가되었습니다."
          : "고객 관계가 수정되었습니다.",
      occurredAt: row.deletedAt ?? row.updatedAt ?? row.createdAt,
      ...userLabel(userMap, row.updatedBy ?? row.createdBy),
      source: "customer_relationships",
      summary: row.relationshipLabel,
      detail: null,
      metadata: safeTimelineMetadata({
        relationshipId: row.id,
        relationshipType: row.relationshipType,
        relationshipLabel: row.relationshipLabel,
        status: row.status,
      }),
      severity: deleted ? "warning" : "info",
      relatedId: row.id,
      relatedType: "customer_relationship",
    });
  }

  for (const row of [
    ...customerActivityRows,
    ...contractActivityRows,
    ...requestActivityRows,
  ]) {
    if (row.action.startsWith("CUSTOMER_RELATIONSHIP_")) continue;
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
    .filter(event => !from || event.occurredAt.getTime() >= from)
    .filter(event => !to || event.occurredAt.getTime() <= to)
    .filter(
      event =>
        eventTypes.size === 0 ||
        eventTypes.has(event.eventType) ||
        eventTypes.has(event.source)
    )
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return { items: filtered.slice(0, limit), totalCount: filtered.length };
}

export async function getPerformanceStats(filter: {
  agentId?: number;
  agentIds?: number[];
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

  let customerList: (typeof customers.$inferSelect)[] = [];
  let contractList: (typeof contracts.$inferSelect)[] = [];

  const activeCondition = eq(customers.isActive, true);
  const activeContractCondition = eq(contracts.isActive, true);

  // 기간 필터 조건 (contracts.contractDate 기준)
  const dateConditions: any[] = [activeContractCondition];
  if (filter.dateFrom)
    dateConditions.push(gte(contracts.contractDate, filter.dateFrom as any));
  if (filter.dateTo)
    dateConditions.push(lte(contracts.contractDate, filter.dateTo as any));
  // 계약 필터 (상품군, 보험사)
  if (filter.productGroup)
    dateConditions.push(eq(contracts.productGroup, filter.productGroup));
  if (filter.company)
    dateConditions.push(eq(contracts.company, filter.company));

  // 고객 필터 (지역, 유입경로)
  const customerConditions: any[] = [activeCondition];
  if (filter.region)
    customerConditions.push(eq(customers.region, filter.region));
  if (filter.source)
    customerConditions.push(eq(customers.source, filter.source));
  const customerBaseCondition =
    customerConditions.length > 1
      ? and(...customerConditions)
      : activeCondition;

  if (filter.agentIds !== undefined) {
    if (filter.agentIds.length > 0) {
      customerList = await db
        .select()
        .from(customers)
        .where(
          and(
            or(...filter.agentIds.map(id => eq(customers.agentId, id))),
            customerBaseCondition as any
          )
        );
      contractList = await db
        .select()
        .from(contracts)
        .where(
          and(
            or(...filter.agentIds.map(id => eq(contracts.agentId, id))),
            ...dateConditions
          )
        );
    }
  } else if (filter.agentId !== undefined) {
    customerList = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.agentId, filter.agentId), customerBaseCondition as any)
      );
    contractList = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.agentId, filter.agentId), ...dateConditions));
  } else if (filter.teamId !== undefined) {
    const teamAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.teamId, filter.teamId));
    const agentIds = teamAgents.map(u => u.id);
    if (agentIds.length > 0) {
      customerList = await db
        .select()
        .from(customers)
        .where(
          and(
            or(...agentIds.map(id => eq(customers.agentId, id))),
            activeCondition
          )
        );
      contractList = await db
        .select()
        .from(contracts)
        .where(
          and(
            or(...agentIds.map(id => eq(contracts.agentId, id))),
            ...dateConditions
          )
        );
    }
  } else if (filter.subBranchAdminId !== undefined) {
    const subAgents = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.subBranchAdminId, filter.subBranchAdminId));
    const agentIds = subAgents.map(u => u.id);
    if (
      typeof filter !== "undefined" &&
      filter.subBranchAdminId &&
      !agentIds.includes(filter.subBranchAdminId)
    )
      agentIds.push(filter.subBranchAdminId);
    if (agentIds.length > 0) {
      customerList = await db
        .select()
        .from(customers)
        .where(
          and(
            or(...agentIds.map(id => eq(customers.agentId, id))),
            activeCondition
          )
        );
      contractList = await db
        .select()
        .from(contracts)
        .where(
          and(
            or(...agentIds.map(id => eq(contracts.agentId, id))),
            ...dateConditions
          )
        );
    }
  } else {
    customerList = await db.select().from(customers).where(activeCondition);
    contractList = await db
      .select()
      .from(contracts)
      .where(and(...dateConditions));
  }

  const total = customerList.length;
  const statusCount = (s: string) =>
    customerList.filter(c => c.consultStatus === s).length;
  const isNewContractMetricTarget = (contract: typeof contracts.$inferSelect) =>
    contract.contractStatus !== "철회" &&
    contract.contractStatus !== "해지" &&
    contract.paymentStatus !== "실효" &&
    contract.paymentStatus !== "해지";

  const assigned = total;
  const uncontacted = statusCount("미상담");
  const absent = statusCount("부재");
  const called = statusCount("통화완료");
  const scheduled = statusCount("상담예정");
  const designing = statusCount("설계중");
  const contracted = statusCount("계약");
  const held = statusCount("보류");
  const rejected = statusCount("거절");

  const newContractCount = contracted;
  const activeContracts = contractList.filter(c => c.contractStatus === "유지");
  const canceledContracts = contractList.filter(
    c => c.contractStatus === "해지" || c.paymentStatus === "실효"
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
    contractCount: newContractCount,
    newContractCount,
    monthlyPremiumSum,
    monthlyPremiumTotal: monthlyPremiumSum,
    consultRate:
      total > 0 ? Math.round(((total - uncontacted) / total) * 100) : 0,
    contractRate: total > 0 ? Math.round((contracted / total) * 100) : 0,
    absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
    heldRejectedRate:
      total > 0 ? Math.round(((held + rejected) / total) * 100) : 0,
    activeContracts: activeContracts.length,
    canceledContracts: canceledContracts.length,
  };
}

// ─── Bulk Import Helpers ─────────────────────────────────────────────────────
/** 연락처 정규화 (숫자만 추출) */
function monthRange(year: number, month: number) {
  const dateFrom = new Date(year, month - 1, 1);
  const dateTo = new Date(year, month, 0, 23, 59, 59, 999);
  return { dateFrom, dateTo };
}

function performanceScopeForGoal(goal: typeof performanceGoals.$inferSelect) {
  if (goal.targetType === "sub_branch")
    return { subBranchAdminId: goal.targetId ?? undefined };
  if (goal.targetType === "team") return { teamId: goal.targetId ?? undefined };
  if (goal.targetType === "user")
    return { agentId: goal.targetId ?? undefined };
  return {};
}

function daysRemainingInMonth(year: number, month: number) {
  const now = new Date();
  const monthEnd = new Date(year, month, 0);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getFullYear() !== year || now.getMonth() + 1 !== month)
    return Math.max(0, monthEnd.getDate());
  return Math.max(
    1,
    Math.ceil((monthEnd.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) +
      1
  );
}

function buildGoalProgress(
  goal: typeof performanceGoals.$inferSelect,
  actual: {
    newContractCount?: number;
    contractCount?: number;
    contracted?: number;
    activeContracts?: number;
    monthlyPremiumTotal?: number;
    monthlyPremiumSum?: number;
  } | null,
  targetLabel: string
) {
  const actualContractCount = Number(
    actual?.newContractCount ??
      actual?.contractCount ??
      actual?.contracted ??
      actual?.activeContracts ??
      0
  );
  const actualMonthlyPremium = Number(
    actual?.monthlyPremiumTotal ?? actual?.monthlyPremiumSum ?? 0
  );
  const contractGoal = Number(goal.contractCountGoal ?? 0);
  const premiumGoal = Number(goal.monthlyPremiumGoal ?? 0);
  const remainingContractCount = Math.max(
    0,
    contractGoal - actualContractCount
  );
  const remainingMonthlyPremium = Math.max(
    0,
    premiumGoal - actualMonthlyPremium
  );
  const remainingDays = daysRemainingInMonth(goal.year, goal.month);
  return {
    goal,
    targetLabel,
    actual: {
      contractCount: actualContractCount,
      newContractCount: actualContractCount,
      monthlyPremium: actualMonthlyPremium,
      monthlyPremiumTotal: actualMonthlyPremium,
    },
    achievementRate: {
      contractCount:
        contractGoal > 0
          ? Math.round((actualContractCount / contractGoal) * 100)
          : null,
      monthlyPremium:
        premiumGoal > 0
          ? Math.round((actualMonthlyPremium / premiumGoal) * 100)
          : null,
    },
    remaining: {
      contractCount: remainingContractCount,
      monthlyPremium: remainingMonthlyPremium,
    },
    remainingDays,
    dailyRequired: {
      contractCount:
        remainingDays > 0
          ? Math.ceil(remainingContractCount / remainingDays)
          : remainingContractCount,
      monthlyPremium:
        remainingDays > 0
          ? Math.ceil(remainingMonthlyPremium / remainingDays)
          : remainingMonthlyPremium,
    },
    status:
      contractGoal === 0 && premiumGoal === 0
        ? "goal_unset"
        : remainingContractCount === 0 && remainingMonthlyPremium === 0
          ? "achieved"
          : "in_progress",
  };
}

async function getGoalTargetLabel(
  goal: typeof performanceGoals.$inferSelect,
  userMap: Map<number, User>,
  teamMap: Map<number, Team>
) {
  if (goal.targetType === "branch") return "지점 전체";
  if (goal.targetType === "team")
    return goal.targetId
      ? (teamMap.get(goal.targetId)?.name ?? `팀 #${goal.targetId}`)
      : "팀";
  if (goal.targetType === "sub_branch")
    return goal.targetId
      ? (userMap.get(goal.targetId)?.name ?? `부지점 #${goal.targetId}`)
      : "부지점";
  return goal.targetId
    ? (userMap.get(goal.targetId)?.name ?? `사용자 #${goal.targetId}`)
    : "개인";
}

export async function getActivePerformanceGoal(target: {
  year: number;
  month: number;
  targetType: PerformanceGoalTargetType;
  targetId?: number | null;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions: any[] = [
    eq(performanceGoals.year, target.year),
    eq(performanceGoals.month, target.month),
    eq(performanceGoals.targetType, target.targetType),
    eq(performanceGoals.isActive, true),
    isNull(performanceGoals.deletedAt),
  ];
  if (target.targetId == null)
    conditions.push(isNull(performanceGoals.targetId));
  else conditions.push(eq(performanceGoals.targetId, target.targetId));
  const result = await db
    .select()
    .from(performanceGoals)
    .where(and(...conditions))
    .limit(1);
  return result[0];
}

export async function createPerformanceGoal(
  data: typeof performanceGoals.$inferInsert
) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(performanceGoals).values(data);
  return getActivePerformanceGoal({
    year: data.year,
    month: data.month,
    targetType: data.targetType as PerformanceGoalTargetType,
    targetId: data.targetId,
  });
}

export async function updatePerformanceGoal(
  id: number,
  data: Partial<typeof performanceGoals.$inferInsert>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(performanceGoals)
    .set(data)
    .where(eq(performanceGoals.id, id));
}

export async function deactivatePerformanceGoal(id: number, updatedBy: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(performanceGoals)
    .set({ isActive: false, deletedAt: new Date(), updatedBy })
    .where(eq(performanceGoals.id, id));
}

export async function getPerformanceGoalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(performanceGoals)
    .where(eq(performanceGoals.id, id))
    .limit(1);
  return result[0];
}

export async function listPerformanceGoals(
  filter: { year?: number; month?: number; includeInactive?: boolean } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (!filter.includeInactive) {
    conditions.push(eq(performanceGoals.isActive, true));
    conditions.push(isNull(performanceGoals.deletedAt));
  }
  if (filter.year) conditions.push(eq(performanceGoals.year, filter.year));
  if (filter.month) conditions.push(eq(performanceGoals.month, filter.month));
  return db
    .select()
    .from(performanceGoals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(performanceGoals.createdAt));
}

export async function getPerformanceGoalDashboard(
  user: User,
  year: number,
  month: number
) {
  const [goals, allUsers, allTeams] = await Promise.all([
    listPerformanceGoals({ year, month }),
    getAllUsers(),
    getAllTeams(),
  ]);
  const userMap = new Map(allUsers.map(item => [item.id, item]));
  const teamMap = new Map(allTeams.map(item => [item.id, item]));
  const visibleGoals = goals.filter(goal => {
    if (user.role === "branch_admin") return true;
    if (user.role === "sub_branch_admin") {
      if (goal.targetType === "sub_branch") return goal.targetId === user.id;
      if (goal.targetType === "team")
        return (
          goal.targetId != null &&
          teamMap.get(goal.targetId)?.subBranchAdminId === user.id
        );
      if (goal.targetType === "user")
        return (
          goal.targetId != null &&
          userMap.get(goal.targetId)?.subBranchAdminId === user.id
        );
      return false;
    }
    if (user.role === "team_leader") {
      if (goal.targetType === "team") return goal.targetId === user.teamId;
      if (goal.targetType === "user")
        return (
          goal.targetId != null &&
          userMap.get(goal.targetId)?.teamId === user.teamId
        );
      return false;
    }
    return goal.targetType === "user" && goal.targetId === user.id;
  });

  const range = monthRange(year, month);
  const items = [];
  for (const goal of visibleGoals) {
    const actual = await getPerformanceStats({
      ...performanceScopeForGoal(goal),
      ...range,
    });
    items.push(
      buildGoalProgress(
        goal,
        actual,
        await getGoalTargetLabel(goal, userMap, teamMap)
      )
    );
  }
  return {
    year,
    month,
    scope: user.role,
    items,
    summary: {
      totalGoals: items.length,
      achievedGoals: items.filter(item => item.status === "achieved").length,
      pendingGoals: items.filter(item => item.status !== "achieved").length,
      averageContractRate:
        items.length > 0
          ? Math.round(
              items.reduce(
                (sum, item) =>
                  sum + Number(item.achievementRate.contractCount ?? 0),
                0
              ) / items.length
            )
          : null,
      averagePremiumRate:
        items.length > 0
          ? Math.round(
              items.reduce(
                (sum, item) =>
                  sum + Number(item.achievementRate.monthlyPremium ?? 0),
                0
              ) / items.length
            )
          : null,
    },
  };
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function pickString(
  row: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return undefined;
}

export function normalizeBulkImportRow(
  row: Record<string, unknown>
): BulkImportRow {
  return {
    name: pickString(row, "name", "이름"),
    phone: pickString(row, "phone", "연락처"),
    birthDate: pickString(row, "birthDate", "생년월일"),
    gender: pickString(row, "gender", "성별"),
    region: pickString(row, "region", "지역"),
    expectedPremium: pickString(
      row,
      "expectedPremium",
      "예상보험료(만원)",
      "예상보험료"
    ),
    availableTime: pickString(row, "availableTime", "통화가능시간"),
    source: pickString(row, "source", "유입경로"),
    dbCompany: pickString(
      row,
      "dbCompany",
      "DB 업체명",
      "DB업체명",
      "디비업체명",
      "업체명"
    ),
    consultStatus: pickString(row, "consultStatus", "상담상태"),
    memo: pickString(row, "memo", "메모"),
    consultationLog: pickString(row, "consultationLog", "상담기록"),
    consultationDateTime: pickString(
      row,
      "consultationDateTime",
      "상담일시"
    ),
    consultationMemo: pickString(row, "consultationMemo", "상담메모"),
    nextContactDate: pickString(row, "nextContactDate", "다음연락일"),
    subBranchAdminName: pickString(row, "subBranchAdminName", "부지점장"),
    teamName: pickString(row, "teamName", "팀"),
    agentName: pickString(row, "agentName", "담당자"),
  };
}

const BULK_IMPORT_CONSULTATION_RESULT_CANONICAL = [
  "전화끊음",
  "입원중",
  "부재",
  "거절",
  "상담예정",
] as const;

const BULK_IMPORT_CONSULTATION_RESULT_ALIAS: Record<string, string> = {
  "전화 끊음": "전화끊음",
  끊음: "전화끊음",
  통화끊김: "전화끊음",
  부재중: "부재",
  안받음: "부재",
  통화거절: "거절",
  "상담 예정": "상담예정",
  재통화예정: "상담예정",
};

const BULK_IMPORT_CONSULTATION_RESULT_SET = new Set<string>([
  ...BULK_IMPORT_CONSULTATION_RESULT_CANONICAL,
  ...Object.keys(BULK_IMPORT_CONSULTATION_RESULT_ALIAS),
]);

export function normalizeBulkImportConsultationResult(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!BULK_IMPORT_CONSULTATION_RESULT_SET.has(trimmed)) return null;
  return BULK_IMPORT_CONSULTATION_RESULT_ALIAS[trimmed] ?? trimmed;
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
  return headers.filter(h =>
    forbiddenPatterns.some(pattern => pattern.test(h))
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
  dbCompany?: string;
  consultStatus?: string;
  memo?: string;
  consultationLog?: string;
  consultationDateTime?: string;
  consultationMemo?: string;
  nextContactDate?: string;
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
  assignmentStatus?:
    | "unassigned"
    | "assigned_to_sub_branch"
    | "assigned_to_agent";
  matchedExistingCustomerId?: number;
  requiresManualReview?: boolean;
}

export async function validateBulkImportRow(
  sourceRow: BulkImportRow,
  rowIndex: number,
  existingPhones: Set<string>,
  filePhones: Set<string>,
  options?: {
    forceAssignee?: {
      agentId: number;
      teamId: number | null;
      subBranchAdminId: number | null;
    };
    skipExistingPhoneCheck?: boolean;
  }
): Promise<BulkImportValidationResult> {
  const row = normalizeBulkImportRow(sourceRow as Record<string, unknown>);
  const errors: string[] = [];
  let normalizedPhone: string | undefined;
  let agentId: number | undefined;
  let subBranchAdminId: number | undefined;
  let teamId: number | undefined;
  let assignmentStatus:
    | "unassigned"
    | "assigned_to_sub_branch"
    | "assigned_to_agent" = "unassigned";

  // 필수값 검증
  if (!row.name || row.name.trim() === "") {
    errors.push("이름이 필수입니다.");
  }
  if (!row.birthDate || row.birthDate.trim() === "") {
    errors.push("생년월일이 필수입니다.");
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
      if (!options?.skipExistingPhoneCheck && existingPhones.has(normalizedPhone)) {
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

  // 예상보험료 숫자 검증 (만원 단위, 콤마 허용)
  if (row.expectedPremium && row.expectedPremium.trim() !== "") {
    const raw = row.expectedPremium.trim().replace(/,/g, "");
    if (raw === "" || !Number.isFinite(Number(raw))) {
      errors.push("예상보험료는 만원 단위 숫자로 입력해 주세요.");
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

  if (row.consultationLog && row.consultationLog.trim() !== "") {
    const normalizedConsultationResult = normalizeBulkImportConsultationResult(
      row.consultationLog
    );
    if (!normalizedConsultationResult) {
      errors.push(
        "상담기록은 전화끊음, 입원중, 부재, 거절, 상담예정 중 하나로 입력해 주세요."
      );
    }
  }

  // 조직 정합성 검증 (부지점장, 팀, 담당자)
  if (
    !options?.forceAssignee &&
    row.subBranchAdminName &&
    row.subBranchAdminName.trim() !== ""
  ) {
    const { user, isDuplicate } = await findUserByNameUnique(
      row.subBranchAdminName,
      "sub_branch_admin"
    );
    if (isDuplicate) {
      errors.push(
        `부지점장 이름이 2명 이상과 일치합니다. 고유 식별값을 입력해주세요. (${row.subBranchAdminName})`
      );
    } else if (!user) {
      errors.push(`부지점장을 찾을 수 없습니다. (${row.subBranchAdminName})`);
    } else {
      subBranchAdminId = user.id;
    }
  }

  if (!options?.forceAssignee && row.teamName && row.teamName.trim() !== "") {
    if (!subBranchAdminId) {
      errors.push("팀을 지정하려면 부지점장이 필요합니다.");
    } else {
      const team = await findTeamByNameAndSubBranch(
        row.teamName,
        subBranchAdminId
      );
      if (!team) {
        errors.push(`팀을 찾을 수 없습니다. (${row.teamName})`);
      } else {
        teamId = team.id;
      }
    }
  }

  if (!options?.forceAssignee && row.agentName && row.agentName.trim() !== "") {
    const { user, isDuplicate } = await findUserByNameUnique(row.agentName);
    if (isDuplicate) {
      errors.push(
        `담당자 이름이 2명 이상과 일치합니다. 고유 식별값을 입력해주세요. (${row.agentName})`
      );
    } else if (!user) {
      errors.push(`담당자를 찾을 수 없습니다. (${row.agentName})`);
    } else {
      if (
        user.role !== "branch_admin" &&
        user.role !== "sub_branch_admin" &&
        user.role !== "team_leader" &&
        user.role !== "member"
      ) {
        errors.push(
          `담당자는 올바른 직책(지점장/부지점장/팀장/팀원)을 가져야 합니다. (${row.agentName})`
        );
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
      if (
        subBranchAdminId &&
        user.subBranchAdminId &&
        subBranchAdminId !== user.subBranchAdminId
      ) {
        errors.push(
          "담당자의 부지점장 소속이 지정한 부지점장과 일치하지 않습니다."
        );
      }
      if (teamId && user.teamId && teamId !== user.teamId) {
        errors.push("담당자의 팀 소속이 지정한 팀과 일치하지 않습니다.");
      }
    }
  }

  if (options?.forceAssignee) {
    agentId = options.forceAssignee.agentId;
    teamId = options.forceAssignee.teamId ?? undefined;
    subBranchAdminId = options.forceAssignee.subBranchAdminId ?? undefined;
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
export async function getAllActiveCustomerPhones(
  filter: CustomerPhoneScopeFilter = {}
): Promise<Set<string>> {
  const results = await getCustomers(filter);

  const phoneSet = new Set<string>();
  results.forEach(r => {
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
    dbCompany?: string;
    consultStatus: string;
    memo?: string;
    agentId?: number;
    subBranchAdminId?: number;
    assignedTeamId?: number;
    assignmentStatus:
      | "unassigned"
      | "assigned_to_sub_branch"
      | "assigned_to_agent";
    createdBy: number;
    importBatchId?: string;
    importedBy?: number;
    importedAt?: Date;
  }>,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return [];

  const insertData = rows.map(row => ({
    name: row.name,
    phone: row.phone,
    birthDate: row.birthDate,
    gender: row.gender,
    region: row.region,
    expectedPremium: row.expectedPremium,
    availableTime: row.availableTime,
    source: row.source,
    dbCompany: row.dbCompany,
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

export async function createImportBatch(
  data: InsertImportBatch,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db.insert(importBatches).values(data);
}

export async function getImportBatchByBatchId(importBatchId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.importBatchId, importBatchId))
    .limit(1);
  return result[0];
}

export async function listImportBatches(
  filter: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: "active" | "cancelled" | "partially_cancelled" | "failed";
    uploadedBy?: number;
    search?: string;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filter.dateFrom)
    conditions.push(gte(importBatches.createdAt, filter.dateFrom));
  if (filter.dateTo)
    conditions.push(lte(importBatches.createdAt, filter.dateTo));
  if (filter.status) conditions.push(eq(importBatches.status, filter.status));
  if (filter.uploadedBy !== undefined)
    conditions.push(eq(importBatches.uploadedBy, filter.uploadedBy));
  if (filter.search) {
    const q = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        sql`${importBatches.importBatchId} like ${q}`,
        sql`${importBatches.fileName} like ${q}`
      )
    );
  }
  return db
    .select()
    .from(importBatches)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(importBatches.createdAt));
}

export async function updateImportBatch(
  importBatchId: string,
  data: Partial<typeof importBatches.$inferInsert>,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(importBatches)
    .set(data)
    .where(eq(importBatches.importBatchId, importBatchId));
}

export async function getCustomersByImportBatch(importBatchId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customers)
    .where(eq(customers.importBatchId, importBatchId))
    .orderBy(desc(customers.createdAt));
}

export async function softDeleteCustomersByImportBatch(
  importBatchId: string,
  client?: DbExecutor
) {
  const db = client ?? (await getDb());
  if (!db) return;
  await db
    .update(customers)
    .set({ isActive: false, deletedAt: new Date() })
    .where(
      and(
        eq(customers.importBatchId, importBatchId),
        eq(customers.isActive, true)
      )
    );
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
  const batchCustomers = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.importBatchId, importBatchId));
  const customerIds = batchCustomers.map(c => c.id);
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
    db
      .select({ customerId: contracts.customerId })
      .from(contracts)
      .where(
        and(
          inArray(contracts.customerId, customerIds),
          eq(contracts.isActive, true)
        )
      ),
    db
      .select({ customerId: consultations.customerId })
      .from(consultations)
      .where(inArray(consultations.customerId, customerIds)),
    db
      .select({ customerId: statusHistory.customerId })
      .from(statusHistory)
      .where(inArray(statusHistory.customerId, customerIds)),
    db
      .select({ relatedId: notifications.relatedId })
      .from(notifications)
      .where(
        and(
          eq(notifications.relatedType, "customer"),
          inArray(notifications.relatedId, customerIds)
        )
      ),
    db
      .select({ relatedId: reminders.relatedId })
      .from(reminders)
      .where(
        and(
          eq(reminders.relatedType, "customer"),
          inArray(reminders.relatedId, customerIds)
        )
      ),
    db
      .select({ customerId: assignmentHistory.customerId })
      .from(assignmentHistory)
      .where(inArray(assignmentHistory.customerId, customerIds)),
    db
      .select({ customerId: deleteRequests.customerId })
      .from(deleteRequests)
      .where(inArray(deleteRequests.customerId, customerIds)),
    db
      .select({ customerId: consentLogs.customerId })
      .from(consentLogs)
      .where(inArray(consentLogs.customerId, customerIds)),
  ]);
  const blocked = new Set<number>();
  for (const row of activeContracts) blocked.add(row.customerId);
  for (const row of consultationRows) blocked.add(row.customerId);
  for (const row of statusRows) blocked.add(row.customerId);
  for (const row of notificationRows)
    if (row.relatedId != null) blocked.add(row.relatedId);
  for (const row of reminderRows)
    if (row.relatedId != null) blocked.add(row.relatedId);
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
