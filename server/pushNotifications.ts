import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import {
  createPushNotificationLog,
  deactivateDeviceTokenByToken,
  getActiveDeviceTokensForUsers,
  getAllUsers,
  getSchedules,
  getPushNotificationLogByDedupeKey,
  getPushNotificationPreference,
  updatePushNotificationLog,
} from "./db";
import { addMinutes, getScheduleReminderDueAt, isInQuietHoursByPolicy } from "@shared/timePolicy";

export type PushNotificationType =
  | "today_follow_up"
  /** @deprecated Use schedule_reminder. */
  | "schedule_30min"
  | "schedule_reminder"
  | "schedule_incomplete"
  | "contract_delete_request"
  | "test";
export type PushNotificationLogStatus =
  | "sent"
  | "skipped"
  | "failed"
  | "skipped_no_token"
  | "skipped_disabled"
  | "skipped_quiet_hours"
  | "skipped_missing_config"
  | "duplicate_skipped"
  | "invalid_token_deactivated";

export type SafePushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushSendContext = {
  type: PushNotificationType;
  sourceType?: string;
  sourceId?: number;
  dedupeKey?: string;
  force?: boolean;
  now?: Date;
};

export type PushSendResult = {
  requestedUserIds: number[];
  tokenCount: number;
  sentCount: number;
  failureCount: number;
  skippedCount: number;
  duplicateSkippedCount: number;
  disabledSkippedCount: number;
  quietHoursSkippedCount: number;
  invalidTokenDeactivatedCount: number;
  statuses: Record<string, PushNotificationLogStatus>;
  disabledReason?: "missing_firebase_config" | "no_tokens";
};

type PushSender = (tokens: string[], payload: SafePushPayload) => Promise<Array<{ token: string; success: boolean; errorCode?: string }>>;

let testSender: PushSender | null = null;
let firebaseMessaging: Messaging | null | undefined;

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
]);

export const SAFE_PUSH_PAYLOADS = {
  todayFollowUp: {
    title: "BOA \uC5C5\uBB34 \uC54C\uB9BC",
    body: "\uC624\uB298 \uD655\uC778\uD560 \uD6C4\uC18D\uAD00\uB9AC\uAC00 \uC788\uC2B5\uB2C8\uB2E4.",
  },
  scheduleReminder: {
    title: "BOA \uC77C\uC815 \uC54C\uB9BC",
    body: "\uC608\uC815\uB41C \uC77C\uC815\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
    data: { type: "schedule_reminder" },
  },
  scheduleIncomplete: {
    title: "BOA \uC77C\uC815 \uC54C\uB9BC",
    body: "\uC544\uC9C1 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC740 \uC77C\uC815\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
    data: { type: "schedule_incomplete" },
  },
  /** @deprecated Fixed 30-minute schedule pushes are kept only for legacy compatibility. */
  schedule30Minute: {
    title: "BOA \uC77C\uC815 \uC54C\uB9BC",
    body: "30\uBD84 \uD6C4 \uC608\uC815\uB41C \uC77C\uC815\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
  },
  contractDeleteRequest: {
    title: "BOA \uCC98\uB9AC \uC694\uCCAD",
    body: "\uCC98\uB9AC\uD560 \uACC4\uC57D \uC0AD\uC81C \uC694\uCCAD\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
  },
  test: {
    title: "BOA \uD14C\uC2A4\uD2B8 \uC54C\uB9BC",
    body: "\uD478\uC2DC \uC54C\uB9BC \uC218\uC2E0 \uC900\uBE44\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
  },
} as const satisfies Record<string, SafePushPayload>;

export function setPushSenderForTests(sender: PushSender | null) {
  testSender = sender;
}

function getFirebaseMessagingClient() {
  if (testSender) return null;
  if (firebaseMessaging !== undefined) return firebaseMessaging;

  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  try {
    if (serviceAccountBase64) {
      const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, "base64").toString("utf8"));
      const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
      firebaseMessaging = getMessaging(app);
      return firebaseMessaging;
    }

    if (projectId && clientEmail && privateKey) {
      const app = getApps()[0] ?? initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
      firebaseMessaging = getMessaging(app);
      return firebaseMessaging;
    }
  } catch {
    console.warn("[Push] Firebase Admin initialization failed. Push sending is disabled.");
    firebaseMessaging = null;
    return firebaseMessaging;
  }

  console.warn("[Push] Firebase Admin environment variables are not configured. Push sending is skipped.");
  firebaseMessaging = null;
  return firebaseMessaging;
}

export function sanitizePushPayload(payload: SafePushPayload): SafePushPayload {
  const text = `${payload.title} ${payload.body} ${Object.values(payload.data ?? {}).join(" ")}`;
  const blocked = /(010[-\s]?\d{3,4}[-\s]?\d{4}|주민|증권|질병|병력|보험료|상품명|고객명|전화번호|\d{1,3}(,\d{3})*원)/;
  if (blocked.test(text)) {
    throw new Error("Push payload contains blocked sensitive content.");
  }
  return {
    title: payload.title,
    body: payload.body,
    data: payload.data,
  };
}

export function isInQuietHours(preference: { quietHoursEnabled: boolean; quietHoursStart: string; quietHoursEnd: string; timezone: string }, now = new Date()) {
  return isInQuietHoursByPolicy(preference, now);
}

function isNotificationEnabled(preference: {
  followUpTodayEnabled: boolean;
  scheduleReminderEnabled: boolean;
  deleteRequestEnabled: boolean;
  testNotificationEnabled: boolean;
}, type: PushNotificationType) {
  if (type === "today_follow_up") return preference.followUpTodayEnabled;
  if (type === "schedule_30min" || type === "schedule_reminder" || type === "schedule_incomplete") return preference.scheduleReminderEnabled;
  if (type === "contract_delete_request") return preference.deleteRequestEnabled;
  return preference.testNotificationEnabled;
}

async function sendWithFirebase(tokens: string[], payload: SafePushPayload) {
  const messaging = getFirebaseMessagingClient();
  if (!messaging) return null;
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      type: payload.data?.type ?? "work_notification",
      ...(payload.data ?? {}),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "boa_work",
        title: payload.title,
        body: payload.body,
      },
    },
  });

  return response.responses.map((item, index) => ({
    token: tokens[index],
    success: item.success,
    errorCode: item.error?.code,
  }));
}

function emptyResult(userIds: number[]): PushSendResult {
  return {
    requestedUserIds: userIds,
    tokenCount: 0,
    sentCount: 0,
    failureCount: 0,
    skippedCount: 0,
    duplicateSkippedCount: 0,
    disabledSkippedCount: 0,
    quietHoursSkippedCount: 0,
    invalidTokenDeactivatedCount: 0,
    statuses: {},
  };
}

async function createOrUpdateLog(context: PushSendContext, userId: number, status: PushNotificationLogStatus, errorCode?: string | null) {
  const dedupeKey = context.dedupeKey ? `${context.dedupeKey}:user:${userId}` : `${context.type}:${context.sourceType ?? "manual"}:${context.sourceId ?? "none"}:${Date.now()}:user:${userId}`;
  const row = await createPushNotificationLog({
    type: context.type,
    userId,
    sourceType: context.sourceType ?? null,
    sourceId: context.sourceId ?? null,
    dedupeKey,
    status,
    errorCode: errorCode ?? null,
    sentAt: status === "sent" ? new Date() : null,
  } as any);
  if (row && row.status !== status) {
    await updatePushNotificationLog(row.id, { status, errorCode: errorCode ?? null, sentAt: status === "sent" ? new Date() : null } as any);
  }
  return row;
}

export async function sendPushToUsers(userIds: number[], payload: SafePushPayload, context: PushSendContext): Promise<PushSendResult> {
  const uniqueUserIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  const result = emptyResult(uniqueUserIds);
  const safePayload = sanitizePushPayload(payload);
  const rows = await getActiveDeviceTokensForUsers(uniqueUserIds);
  const sender = testSender ?? sendWithFirebase;
  const firebaseReady = Boolean(testSender || getFirebaseMessagingClient());

  for (const userId of uniqueUserIds) {
    const preference = await getPushNotificationPreference(userId);
    const userRows = rows.filter((row) => row.userId === userId);

    if (!context.force && !isNotificationEnabled(preference, context.type)) {
      await createOrUpdateLog(context, userId, "skipped_disabled");
      result.skippedCount += 1;
      result.disabledSkippedCount += 1;
      result.statuses[userId] = "skipped_disabled";
      continue;
    }

    if (!context.force && isInQuietHours(preference, context.now ?? new Date())) {
      await createOrUpdateLog(context, userId, "skipped_quiet_hours");
      result.skippedCount += 1;
      result.quietHoursSkippedCount += 1;
      result.statuses[userId] = "skipped_quiet_hours";
      continue;
    }

    if (context.dedupeKey && await getPushNotificationLogByDedupeKey(`${context.dedupeKey}:user:${userId}`)) {
      await createOrUpdateLog({ ...context, dedupeKey: `${context.dedupeKey}:duplicate:${Date.now()}` }, userId, "duplicate_skipped");
      result.skippedCount += 1;
      result.duplicateSkippedCount += 1;
      result.statuses[userId] = "duplicate_skipped";
      continue;
    }

    if (userRows.length === 0) {
      await createOrUpdateLog(context, userId, "skipped_no_token");
      result.skippedCount += 1;
      result.statuses[userId] = "skipped_no_token";
      continue;
    }

    result.tokenCount += userRows.length;
    if (!firebaseReady) {
      await createOrUpdateLog(context, userId, "skipped_missing_config", "missing_firebase_config");
      result.skippedCount += userRows.length;
      result.statuses[userId] = "skipped_missing_config";
      continue;
    }

    const logRow = await createOrUpdateLog(context, userId, "skipped");
    const sendResults = await sender(userRows.map((row) => row.token), safePayload);
    if (!sendResults) {
      if (logRow) await updatePushNotificationLog(logRow.id, { status: "skipped_missing_config", errorCode: "missing_firebase_config" } as any);
      result.skippedCount += userRows.length;
      result.statuses[userId] = "skipped_missing_config";
      continue;
    }

    const failures = sendResults.filter((item) => !item.success);
    const successes = sendResults.filter((item) => item.success);
    result.sentCount += successes.length;
    result.failureCount += failures.length;

    let invalidDeactivated = false;
    for (const failure of failures) {
      if (failure.errorCode && INVALID_TOKEN_CODES.has(failure.errorCode)) {
        await deactivateDeviceTokenByToken(failure.token);
        invalidDeactivated = true;
        result.invalidTokenDeactivatedCount += 1;
      }
    }

    const status: PushNotificationLogStatus = invalidDeactivated && successes.length === 0
      ? "invalid_token_deactivated"
      : failures.length === sendResults.length
        ? "failed"
        : "sent";
    if (logRow) {
      await updatePushNotificationLog(logRow.id, {
        status,
        errorCode: failures[0]?.errorCode ?? null,
        sentAt: successes.length > 0 ? new Date() : null,
      } as any);
    }
    result.statuses[userId] = status;
  }

  if (result.tokenCount === 0 && result.skippedCount > 0) result.disabledReason = "no_tokens";
  if (!firebaseReady && result.tokenCount > 0) result.disabledReason = "missing_firebase_config";
  return result;
}

export async function sendContractDeleteRequestPush(deleteRequestId: number) {
  const users = await getAllUsers();
  const branchAdminIds = users
    .filter((user) => user.role === "branch_admin" && user.accountStatus === "active")
    .map((user) => user.id);
  return sendPushToUsers(branchAdminIds, SAFE_PUSH_PAYLOADS.contractDeleteRequest, {
    type: "contract_delete_request",
    sourceType: "delete_request",
    sourceId: deleteRequestId,
    dedupeKey: `delete_request:${deleteRequestId}:created`,
  });
}

type SchedulePushSchedule = {
  id: number;
  userId: number;
  status: string;
  startTime: Date | string;
  endTime?: Date | string | null;
  completedAt?: Date | string | null;
  reminderOffsetMinutes?: number | null;
  isActive?: boolean | null;
  deletedAt?: Date | string | null;
};

export type SchedulePushCandidate = {
  kind: "reminder" | "incomplete";
  scheduleId: number;
  userId: number;
  dueAt: Date;
  dedupeKey: string;
};

export type SchedulePushReminderEngineOptions = {
  now?: Date;
  lookbackMinutes?: number;
};

export type SchedulePushReminderEngineResult = {
  success: true;
  targetCount: number;
  reminderTargetCount: number;
  incompleteTargetCount: number;
  sentCount: number;
  skippedCount: number;
  failureCount: number;
  duplicateSkippedCount: number;
  results: PushSendResult[];
};

function isFinishedScheduleForPush(schedule: SchedulePushSchedule) {
  return schedule.isActive === false ||
    Boolean(schedule.deletedAt) ||
    Boolean(schedule.completedAt) ||
    ["완료", "취소", "노쇼"].includes(String(schedule.status));
}

function isInDueWindow(dueAt: Date, now: Date, lookbackMinutes: number) {
  const windowStart = addMinutes(now, -lookbackMinutes);
  return dueAt > windowStart && dueAt <= now;
}

export function getSchedulePushCandidates(
  schedules: SchedulePushSchedule[],
  options: Required<Pick<SchedulePushReminderEngineOptions, "now" | "lookbackMinutes">>,
): SchedulePushCandidate[] {
  const candidates: SchedulePushCandidate[] = [];
  for (const schedule of schedules) {
    if (!Number.isFinite(schedule.id) || !Number.isFinite(schedule.userId)) continue;
    if (isFinishedScheduleForPush(schedule)) continue;

    const startTime = new Date(schedule.startTime);
    if (Number.isNaN(startTime.getTime())) continue;

    const offset = schedule.reminderOffsetMinutes ?? 30;
    if (offset >= 0) {
      const dueAt = getScheduleReminderDueAt(startTime, offset);
      if (isInDueWindow(dueAt, options.now, options.lookbackMinutes)) {
        candidates.push({
          kind: "reminder",
          scheduleId: schedule.id,
          userId: schedule.userId,
          dueAt,
          dedupeKey: `schedule:${schedule.id}:reminder:${offset}:${dueAt.toISOString()}`,
        });
      }
    }

    if (schedule.endTime) {
      const endTime = new Date(schedule.endTime);
      if (!Number.isNaN(endTime.getTime()) && isInDueWindow(endTime, options.now, options.lookbackMinutes)) {
        candidates.push({
          kind: "incomplete",
          scheduleId: schedule.id,
          userId: schedule.userId,
          dueAt: endTime,
          dedupeKey: `schedule:${schedule.id}:incomplete:${endTime.toISOString()}`,
        });
      }
    }
  }
  return candidates;
}

export async function runSchedulePushReminderEngine(
  options: SchedulePushReminderEngineOptions = {},
): Promise<SchedulePushReminderEngineResult> {
  const now = options.now ?? new Date();
  const lookbackMinutes = options.lookbackMinutes ?? 10;
  const candidates = getSchedulePushCandidates(await getSchedules({}) as SchedulePushSchedule[], { now, lookbackMinutes });
  const results: PushSendResult[] = [];

  for (const candidate of candidates) {
    const payload = candidate.kind === "reminder"
      ? SAFE_PUSH_PAYLOADS.scheduleReminder
      : SAFE_PUSH_PAYLOADS.scheduleIncomplete;
    results.push(await sendPushToUsers([candidate.userId], payload, {
      type: candidate.kind === "reminder" ? "schedule_reminder" : "schedule_incomplete",
      sourceType: "schedule",
      sourceId: candidate.scheduleId,
      dedupeKey: candidate.dedupeKey,
      now,
    }));
  }

  return {
    success: true,
    targetCount: candidates.length,
    reminderTargetCount: candidates.filter((candidate) => candidate.kind === "reminder").length,
    incompleteTargetCount: candidates.filter((candidate) => candidate.kind === "incomplete").length,
    sentCount: results.reduce((sum, item) => sum + item.sentCount, 0),
    skippedCount: results.reduce((sum, item) => sum + item.skippedCount, 0),
    failureCount: results.reduce((sum, item) => sum + item.failureCount, 0),
    duplicateSkippedCount: results.reduce((sum, item) => sum + item.duplicateSkippedCount, 0),
    results,
  };
}
