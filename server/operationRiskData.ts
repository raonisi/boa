import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  activityLogs,
  deleteRequests,
  pushNotificationLogs,
  scheduleChangeRequests,
  userDeviceTokens,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

export const OPERATION_RISK_DOWNLOAD_ACTIONS = [
  "DATA_DOWNLOAD",
  "DATA_DOWNLOAD_FAILED",
] as const;

export const OPERATION_RISK_DELETE_ACTIONS = [
  "DELETE_REQUEST_CREATED",
  "DELETE_REQUEST_APPROVED",
  "DELETE_REQUEST_REJECTED",
  "DELETE_REQUEST_CANCELLED",
  "CONTRACT_DEACTIVATED_BY_REQUEST",
  "CUSTOMER_DEACTIVATED",
  "CONTRACT_DEACTIVATED",
  "TEAM_DEACTIVATED",
  "CUSTOMER_DEACTIVATED_BY_BATCH_CANCELLED",
  "TEAM_RESTORED",
  "CUSTOMER_RESTORED",
  "CONTRACT_RESTORED",
  "TEAM_PERMANENTLY_DELETED",
  "CUSTOMER_PERMANENTLY_DELETED",
  "CONTRACT_PERMANENTLY_DELETED",
  "PERMANENT_DELETE_BLOCKED",
  "IMPORT_BATCH_CANCELLED",
  "IMPORT_BATCH_CANCEL_BLOCKED",
] as const;

export const OPERATION_RISK_SECURITY_ACTIONS = [
  "USER_LOGIN",
  "LOGIN_BLOCKED",
  "USER_OAUTH_LINKED",
  "USER_OAUTH_LINK_CONFLICT",
  "USER_OAUTH_RESET",
  "USER_FORCE_LOGOUT",
  "ALL_USERS_FORCE_LOGOUT",
  "USER_ROLE_CHANGED",
  "USER_STATUS_CHANGED",
  "USER_BLOCKED",
  "USER_ACTIVATED",
] as const;

export const OPERATION_RISK_FAILED_ADMIN_ACTIONS = [
  "DATA_DOWNLOAD_FAILED",
  "USER_OAUTH_LINK_CONFLICT",
  "IMPORT_BATCH_CANCEL_BLOCKED",
  "PERMANENT_DELETE_BLOCKED",
  "CUSTOMER_MERGE_BLOCKED",
] as const;

export const OPERATION_RISK_IMMEDIATE_ACTIONS = [
  ...OPERATION_RISK_FAILED_ADMIN_ACTIONS,
  "LOGIN_BLOCKED",
] as const;

export const OPERATION_RISK_ACTION_REQUIRED_ACTIONS = [
  "DELETE_REQUEST_CREATED",
] as const;

const PERMANENT_DELETE_ACTIONS = [
  "TEAM_PERMANENTLY_DELETED",
  "CUSTOMER_PERMANENTLY_DELETED",
  "CONTRACT_PERMANENTLY_DELETED",
] as const;

const CRITICAL_ACCOUNT_ACTIONS = [
  "USER_OAUTH_RESET",
  "USER_FORCE_LOGOUT",
  "ALL_USERS_FORCE_LOGOUT",
  "LOGIN_BLOCKED",
] as const;

const PUSH_POLICY_SKIP_STATUSES = [
  "skipped",
  "skipped_no_token",
  "skipped_disabled",
  "skipped_quiet_hours",
  "skipped_missing_config",
] as const;

const OPERATION_RISK_EVENT_ACTIONS = Array.from(
  new Set([
    ...OPERATION_RISK_DOWNLOAD_ACTIONS,
    ...OPERATION_RISK_DELETE_ACTIONS,
    ...OPERATION_RISK_SECURITY_ACTIONS,
    ...OPERATION_RISK_FAILED_ADMIN_ACTIONS,
    "CUSTOMER_ASSIGNEE_BULK_CHANGED",
    "CUSTOMER_ASSIGNEE_CHANGED_BY_BULK",
    "AGENT_CHANGED",
    "CUSTOMER_ASSIGNEE_AUTO_SET_BY_DB_ASSIGNMENT",
    "CUSTOMER_MERGE_PREVIEWED",
  ])
);

const ACCOUNT_AND_ADMIN_ACTIONS = Array.from(
  new Set([
    ...OPERATION_RISK_SECURITY_ACTIONS,
    ...OPERATION_RISK_FAILED_ADMIN_ACTIONS,
  ])
);

const ACTIVITY_AGGREGATE_ACTIONS = Array.from(
  new Set([
    ...OPERATION_RISK_DOWNLOAD_ACTIONS,
    ...OPERATION_RISK_DELETE_ACTIONS,
    ...ACCOUNT_AND_ADMIN_ACTIONS,
  ])
);

function toSafeCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function emptyOperationRiskAggregates() {
  return {
    activity: {
      downloadTotal: 0,
      failedDownloadCount: 0,
      repeatedDownloadUserCount: 0,
      shortDownloadReasonCount: 0,
      downloadsByUser: {} as Record<string, number>,
      deletionTotal: 0,
      permanentDeleteCount: 0,
      failedDeletionActionCount: 0,
      accountTotal: 0,
      criticalAccountCount: 0,
      loginBlockedCount: 0,
      failedAdminActionCount: 0,
    },
    push: {
      total: 0,
      sent: 0,
      failed: 0,
      policySkipped: 0,
      duplicateSkipped: 0,
      invalidTokenDeactivated: 0,
      inactiveTokens: 0,
    },
    current: {
      pendingDeleteRequestCount: 0,
      schedulePendingCount: 0,
    },
    scheduleHistory: {
      conflictCount: 0,
      failedCount: 0,
    },
  };
}

export async function getOperationRiskAggregates(input: {
  dateFrom: Date;
  dateTo: Date;
}) {
  const db = await getDb();
  if (!db) return emptyOperationRiskAggregates();

  const activityRange = and(
    gte(activityLogs.createdAt, input.dateFrom),
    lte(activityLogs.createdAt, input.dateTo),
    inArray(activityLogs.action, ACTIVITY_AGGREGATE_ACTIONS)
  );
  const safeJsonDetails = sql<string>`IF(JSON_VALID(${activityLogs.details}), ${activityLogs.details}, '{}')`;
  const downloadReason = sql<string>`COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(${safeJsonDetails}, '$.metadata.reason')),
    JSON_UNQUOTE(JSON_EXTRACT(${safeJsonDetails}, '$.reason')),
    CASE WHEN JSON_VALID(${activityLogs.details}) THEN '' ELSE COALESCE(${activityLogs.details}, '') END
  )`;

  const [
    activityRows,
    downloadUserRows,
    pushRows,
    inactiveTokenRows,
    pendingDeleteRows,
    scheduleRows,
  ] = await Promise.all([
    db
      .select({
        downloadTotal: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, [...OPERATION_RISK_DOWNLOAD_ACTIONS])} THEN 1 ELSE 0 END), 0)`,
        failedDownloadCount: sql<number>`COALESCE(SUM(CASE WHEN ${eq(activityLogs.action, "DATA_DOWNLOAD_FAILED")} THEN 1 ELSE 0 END), 0)`,
        shortDownloadReasonCount: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, [...OPERATION_RISK_DOWNLOAD_ACTIONS])} AND CHAR_LENGTH(TRIM(${downloadReason})) < 5 THEN 1 ELSE 0 END), 0)`,
        deletionTotal: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, [...OPERATION_RISK_DELETE_ACTIONS])} THEN 1 ELSE 0 END), 0)`,
        permanentDeleteCount: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, [...PERMANENT_DELETE_ACTIONS])} THEN 1 ELSE 0 END), 0)`,
        failedDeletionActionCount: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, ["IMPORT_BATCH_CANCEL_BLOCKED", "PERMANENT_DELETE_BLOCKED"])} THEN 1 ELSE 0 END), 0)`,
        accountTotal: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, ACCOUNT_AND_ADMIN_ACTIONS)} THEN 1 ELSE 0 END), 0)`,
        criticalAccountCount: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, [...CRITICAL_ACCOUNT_ACTIONS])} THEN 1 ELSE 0 END), 0)`,
        loginBlockedCount: sql<number>`COALESCE(SUM(CASE WHEN ${eq(activityLogs.action, "LOGIN_BLOCKED")} THEN 1 ELSE 0 END), 0)`,
        failedAdminActionCount: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(activityLogs.action, [...OPERATION_RISK_FAILED_ADMIN_ACTIONS])} THEN 1 ELSE 0 END), 0)`,
      })
      .from(activityLogs)
      .where(activityRange),
    db
      .select({
        userId: activityLogs.userId,
        count: sql<number>`COUNT(*)`,
      })
      .from(activityLogs)
      .where(
        and(
          gte(activityLogs.createdAt, input.dateFrom),
          lte(activityLogs.createdAt, input.dateTo),
          inArray(activityLogs.action, [...OPERATION_RISK_DOWNLOAD_ACTIONS])
        )
      )
      .groupBy(activityLogs.userId),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        sent: sql<number>`COALESCE(SUM(CASE WHEN ${eq(pushNotificationLogs.status, "sent")} THEN 1 ELSE 0 END), 0)`,
        failed: sql<number>`COALESCE(SUM(CASE WHEN ${eq(pushNotificationLogs.status, "failed")} THEN 1 ELSE 0 END), 0)`,
        policySkipped: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(pushNotificationLogs.status, [...PUSH_POLICY_SKIP_STATUSES])} THEN 1 ELSE 0 END), 0)`,
        duplicateSkipped: sql<number>`COALESCE(SUM(CASE WHEN ${eq(pushNotificationLogs.status, "duplicate_skipped")} THEN 1 ELSE 0 END), 0)`,
        invalidTokenDeactivated: sql<number>`COALESCE(SUM(CASE WHEN ${eq(pushNotificationLogs.status, "invalid_token_deactivated")} THEN 1 ELSE 0 END), 0)`,
      })
      .from(pushNotificationLogs)
      .where(
        and(
          gte(pushNotificationLogs.createdAt, input.dateFrom),
          lte(pushNotificationLogs.createdAt, input.dateTo)
        )
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userDeviceTokens)
      .where(
        or(
          eq(userDeviceTokens.isActive, false),
          isNotNull(userDeviceTokens.revokedAt)
        )
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(deleteRequests)
      .where(eq(deleteRequests.status, "pending")),
    db
      .select({
        pending: sql<number>`COALESCE(SUM(CASE WHEN ${eq(scheduleChangeRequests.status, "pending")} THEN 1 ELSE 0 END), 0)`,
        conflict: sql<number>`COALESCE(SUM(CASE WHEN ${eq(scheduleChangeRequests.status, "conflict")} AND ${gte(scheduleChangeRequests.createdAt, input.dateFrom)} AND ${lte(scheduleChangeRequests.createdAt, input.dateTo)} THEN 1 ELSE 0 END), 0)`,
        failed: sql<number>`COALESCE(SUM(CASE WHEN ${eq(scheduleChangeRequests.status, "failed")} AND ${gte(scheduleChangeRequests.createdAt, input.dateFrom)} AND ${lte(scheduleChangeRequests.createdAt, input.dateTo)} THEN 1 ELSE 0 END), 0)`,
      })
      .from(scheduleChangeRequests)
      .where(
        or(
          eq(scheduleChangeRequests.status, "pending"),
          and(
            inArray(scheduleChangeRequests.status, ["conflict", "failed"]),
            gte(scheduleChangeRequests.createdAt, input.dateFrom),
            lte(scheduleChangeRequests.createdAt, input.dateTo)
          )
        )
      ),
  ]);

  const activity = activityRows[0];
  const push = pushRows[0];
  const schedule = scheduleRows[0];
  const downloadsByUser = Object.fromEntries(
    downloadUserRows.map(row => [String(row.userId), toSafeCount(row.count)])
  );

  return {
    activity: {
      downloadTotal: toSafeCount(activity?.downloadTotal),
      failedDownloadCount: toSafeCount(activity?.failedDownloadCount),
      repeatedDownloadUserCount: Object.values(downloadsByUser).filter(
        count => count >= 3
      ).length,
      shortDownloadReasonCount: toSafeCount(activity?.shortDownloadReasonCount),
      downloadsByUser,
      deletionTotal: toSafeCount(activity?.deletionTotal),
      permanentDeleteCount: toSafeCount(activity?.permanentDeleteCount),
      failedDeletionActionCount: toSafeCount(
        activity?.failedDeletionActionCount
      ),
      accountTotal: toSafeCount(activity?.accountTotal),
      criticalAccountCount: toSafeCount(activity?.criticalAccountCount),
      loginBlockedCount: toSafeCount(activity?.loginBlockedCount),
      failedAdminActionCount: toSafeCount(activity?.failedAdminActionCount),
    },
    push: {
      total: toSafeCount(push?.total),
      sent: toSafeCount(push?.sent),
      failed: toSafeCount(push?.failed),
      policySkipped: toSafeCount(push?.policySkipped),
      duplicateSkipped: toSafeCount(push?.duplicateSkipped),
      invalidTokenDeactivated: toSafeCount(push?.invalidTokenDeactivated),
      inactiveTokens: toSafeCount(inactiveTokenRows[0]?.count),
    },
    current: {
      pendingDeleteRequestCount: toSafeCount(pendingDeleteRows[0]?.count),
      schedulePendingCount: toSafeCount(schedule?.pending),
    },
    scheduleHistory: {
      conflictCount: toSafeCount(schedule?.conflict),
      failedCount: toSafeCount(schedule?.failed),
    },
  };
}

export async function getOperationRiskRecentItems(input: {
  dateFrom: Date;
  dateTo: Date;
  limit: number;
  offset: number;
  pushFailureLimit?: number;
}) {
  const db = await getDb();
  if (!db) return { activity: [], pushFailures: [] };

  const [activity, pushFailures] = await Promise.all([
    db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        actorName: users.name,
        actorRole: users.role,
        actorEmail: users.email,
        action: activityLogs.action,
        targetType: activityLogs.targetType,
        targetId: activityLogs.targetId,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(
        and(
          gte(activityLogs.createdAt, input.dateFrom),
          lte(activityLogs.createdAt, input.dateTo),
          inArray(activityLogs.action, OPERATION_RISK_EVENT_ACTIONS)
        )
      )
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({
        id: pushNotificationLogs.id,
        type: pushNotificationLogs.type,
        userId: pushNotificationLogs.userId,
        userName: users.name,
        userRole: users.role,
        sourceType: pushNotificationLogs.sourceType,
        status: pushNotificationLogs.status,
        errorCode: pushNotificationLogs.errorCode,
        createdAt: pushNotificationLogs.createdAt,
      })
      .from(pushNotificationLogs)
      .leftJoin(users, eq(pushNotificationLogs.userId, users.id))
      .where(
        and(
          gte(pushNotificationLogs.createdAt, input.dateFrom),
          lte(pushNotificationLogs.createdAt, input.dateTo),
          inArray(pushNotificationLogs.status, [
            "failed",
            "invalid_token_deactivated",
          ])
        )
      )
      .orderBy(
        desc(pushNotificationLogs.createdAt),
        desc(pushNotificationLogs.id)
      )
      .limit(input.pushFailureLimit ?? 10),
  ]);

  return { activity, pushFailures };
}
