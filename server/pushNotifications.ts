import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import {
  createPushNotificationLog,
  deactivateDeviceTokenByToken,
  getActiveDeviceTokensForUsers,
  getAllContracts,
  getAllUsers,
  getCustomers,
  getLatestConsultationDatesByCustomerIds,
  getSchedules,
  getPushNotificationLogByDedupeKey,
  getPushNotificationPreference,
  updatePushNotificationLog,
} from "./db";
import { addMinutes, formatKstLocalDate, getScheduleReminderDueAt, isInQuietHoursByPolicy } from "@shared/timePolicy";

export type PushNotificationType =
  | "today_follow_up"
  /** @deprecated Use schedule_reminder. */
  | "schedule_30min"
  | "schedule_reminder"
  | "schedule_incomplete"
  | "customer_birthday"
  | "contract_90"
  | "contract_180"
  | "contract_365"
  | "long_unmanaged_90"
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
  customerBirthday: {
    title: "BOA \uACE0\uAC1D\uAD00\uB9AC \uC54C\uB9BC",
    body: "\uC624\uB298 \uD655\uC778\uD560 \uACE0\uAC1D \uAE30\uB150\uC77C\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
    data: { type: "customer_birthday" },
  },
  contract90: {
    title: "BOA \uACC4\uC57D\uAD00\uB9AC \uC54C\uB9BC",
    body: "\uC810\uAC80\uD560 \uACC4\uC57D \uAD00\uB9AC \uC77C\uC815\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
    data: { type: "contract_90" },
  },
  contract180: {
    title: "BOA \uACC4\uC57D\uAD00\uB9AC \uC54C\uB9BC",
    body: "\uC911\uAC04 \uC810\uAC80\uD560 \uACC4\uC57D \uAD00\uB9AC \uC77C\uC815\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
    data: { type: "contract_180" },
  },
  contract365: {
    title: "BOA \uACC4\uC57D\uAD00\uB9AC \uC54C\uB9BC",
    body: "\uAC31\uC2E0 \uB610\uB294 \uC810\uAC80\uD560 \uACC4\uC57D \uAD00\uB9AC \uC77C\uC815\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
    data: { type: "contract_365" },
  },
  longUnmanaged90: {
    title: "BOA \uACE0\uAC1D\uAD00\uB9AC \uC54C\uB9BC",
    body: "\uC7A5\uAE30 \uBBF8\uAD00\uB9AC \uACE0\uAC1D\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
    data: { type: "long_unmanaged_90" },
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
  if (type === "customer_birthday" || type === "contract_90" || type === "contract_180" || type === "contract_365" || type === "long_unmanaged_90") return preference.followUpTodayEnabled;
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

export type PushEngineOperationalSummary = {
  checkedAt: string;
  candidateCount: number;
  sendAttemptCount: number;
  sentCount: number;
  skippedCount: number;
  failureCount: number;
  duplicateSkippedCount: number;
  quietHoursSkippedCount: number;
  disabledSkippedCount: number;
  noTokenSkippedCount: number;
  missingConfigSkippedCount: number;
  invalidTokenDeactivatedCount: number;
  logExpectation: "no_candidates_no_push_logs" | "send_attempts_create_push_logs";
  windowStart?: string;
  windowEnd?: string;
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
  summary: PushEngineOperationalSummary;
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

function countStatus(results: PushSendResult[], status: string) {
  return results.reduce((sum, result) => sum + Object.values(result.statuses).filter((item) => item === status).length, 0);
}

function buildOperationalSummary(input: {
  checkedAt: Date;
  candidateCount: number;
  results: PushSendResult[];
  lookbackMinutes?: number;
  windowStart?: Date;
  windowEnd?: Date;
}): PushEngineOperationalSummary {
  const sendAttemptCount = input.results.reduce((sum, item) => sum + item.requestedUserIds.length, 0);
  const skippedCount = input.results.reduce((sum, item) => sum + item.skippedCount, 0);
  return {
    checkedAt: input.checkedAt.toISOString(),
    candidateCount: input.candidateCount,
    sendAttemptCount,
    sentCount: input.results.reduce((sum, item) => sum + item.sentCount, 0),
    skippedCount,
    failureCount: input.results.reduce((sum, item) => sum + item.failureCount, 0),
    duplicateSkippedCount: input.results.reduce((sum, item) => sum + item.duplicateSkippedCount, 0),
    quietHoursSkippedCount: input.results.reduce((sum, item) => sum + item.quietHoursSkippedCount, 0),
    disabledSkippedCount: input.results.reduce((sum, item) => sum + item.disabledSkippedCount, 0),
    noTokenSkippedCount: countStatus(input.results, "skipped_no_token"),
    missingConfigSkippedCount: countStatus(input.results, "skipped_missing_config"),
    invalidTokenDeactivatedCount: input.results.reduce((sum, item) => sum + item.invalidTokenDeactivatedCount, 0),
    logExpectation: sendAttemptCount > 0 ? "send_attempts_create_push_logs" : "no_candidates_no_push_logs",
    windowStart: input.windowStart?.toISOString(),
    windowEnd: input.windowEnd?.toISOString(),
    lookbackMinutes: input.lookbackMinutes,
  };
}

function logOperationalSummary(engine: string, summary: PushEngineOperationalSummary) {
  console.info("[push-scheduler] engine summary", {
    engine,
    checkedAt: summary.checkedAt,
    candidateCount: summary.candidateCount,
    sendAttemptCount: summary.sendAttemptCount,
    sentCount: summary.sentCount,
    skippedCount: summary.skippedCount,
    failureCount: summary.failureCount,
    duplicateSkippedCount: summary.duplicateSkippedCount,
    quietHoursSkippedCount: summary.quietHoursSkippedCount,
    disabledSkippedCount: summary.disabledSkippedCount,
    noTokenSkippedCount: summary.noTokenSkippedCount,
    missingConfigSkippedCount: summary.missingConfigSkippedCount,
    logExpectation: summary.logExpectation,
    windowStart: summary.windowStart,
    windowEnd: summary.windowEnd,
    lookbackMinutes: summary.lookbackMinutes,
  });
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
  const windowStart = addMinutes(now, -lookbackMinutes);
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

  const summary = buildOperationalSummary({
    checkedAt: now,
    candidateCount: candidates.length,
    results,
    lookbackMinutes,
    windowStart,
    windowEnd: now,
  });
  logOperationalSummary("schedule", summary);

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
    summary,
  };
}

type BusinessPushType = Extract<PushNotificationType, "customer_birthday" | "contract_90" | "contract_180" | "contract_365" | "long_unmanaged_90">;

type BusinessPushCustomer = {
  id: number;
  agentId?: number | null;
  birthDate?: Date | string | null;
  assignedAt?: Date | string | null;
  createdAt?: Date | string | null;
  isActive?: boolean | null;
  deletedAt?: Date | string | null;
};

type BusinessPushContract = {
  id: number;
  agentId?: number | null;
  contractDate?: Date | string | null;
  isActive?: boolean | null;
  deletedAt?: Date | string | null;
};

type BusinessPushConsultation = {
  customerId?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  isActive?: boolean | null;
  deletedAt?: Date | string | null;
};

export type BusinessPushCandidate = {
  type: BusinessPushType;
  sourceType: "customer" | "contract";
  sourceId: number;
  userId: number;
  dueDateKey: string;
  dedupeKey: string;
};

export type BusinessPushReminderEngineOptions = {
  now?: Date;
};

export type BusinessPushReminderEngineResult = {
  success: true;
  targetCount: number;
  birthdayTargetCount: number;
  contract90TargetCount: number;
  contract180TargetCount: number;
  contract365TargetCount: number;
  longUnmanagedTargetCount: number;
  sentCount: number;
  skippedCount: number;
  failureCount: number;
  duplicateSkippedCount: number;
  results: PushSendResult[];
  summary: PushEngineOperationalSummary;
};

type BusinessPushCandidateInput = {
  customers: BusinessPushCustomer[];
  contracts: BusinessPushContract[];
  consultationsByCustomer?: Record<number, BusinessPushConsultation[]>;
};

const BUSINESS_PUSH_PAYLOADS: Record<BusinessPushType, SafePushPayload> = {
  customer_birthday: SAFE_PUSH_PAYLOADS.customerBirthday,
  contract_90: SAFE_PUSH_PAYLOADS.contract90,
  contract_180: SAFE_PUSH_PAYLOADS.contract180,
  contract_365: SAFE_PUSH_PAYLOADS.contract365,
  long_unmanaged_90: SAFE_PUSH_PAYLOADS.longUnmanaged90,
};

function isActiveBusinessRow(row: { isActive?: boolean | null; deletedAt?: Date | string | null }) {
  return row.isActive !== false && !row.deletedAt;
}

function hasFiniteId(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toKstDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatKstLocalDate(date);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function latestConsultationDateKey(consultations: BusinessPushConsultation[]) {
  let latest: string | null = null;
  for (const consultation of consultations) {
    if (consultation.isActive === false || consultation.deletedAt) continue;
    const dateKey = toKstDateKey(consultation.createdAt ?? consultation.updatedAt);
    if (!dateKey) continue;
    if (!latest || dateKey > latest) latest = dateKey;
  }
  return latest;
}

function businessDedupeKey(type: BusinessPushType, sourceType: "customer" | "contract", sourceId: number, dueDateKey: string) {
  return `business:${type}:${sourceType}:${sourceId}:${dueDateKey}`;
}

export function getBusinessPushCandidates(
  input: BusinessPushCandidateInput,
  options: Required<Pick<BusinessPushReminderEngineOptions, "now">>,
): BusinessPushCandidate[] {
  const todayKey = formatKstLocalDate(options.now);
  const todayMonthDay = todayKey.slice(5);
  const candidates: BusinessPushCandidate[] = [];
  const seen = new Set<string>();

  const pushCandidate = (candidate: BusinessPushCandidate) => {
    const key = `${candidate.type}:${candidate.sourceType}:${candidate.sourceId}:${candidate.userId}:${candidate.dueDateKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  for (const customer of input.customers) {
    if (!hasFiniteId(customer.id) || !hasFiniteId(customer.agentId)) continue;
    if (!isActiveBusinessRow(customer)) continue;

    const birthDateKey = toKstDateKey(customer.birthDate);
    if (birthDateKey && birthDateKey.slice(5) === todayMonthDay) {
      pushCandidate({
        type: "customer_birthday",
        sourceType: "customer",
        sourceId: customer.id,
        userId: customer.agentId,
        dueDateKey: todayKey,
        dedupeKey: businessDedupeKey("customer_birthday", "customer", customer.id, todayKey),
      });
    }

    const consultationDateKey = latestConsultationDateKey(input.consultationsByCustomer?.[customer.id] ?? []);
    const longUnmanagedBaseDateKey = consultationDateKey ?? toKstDateKey(customer.assignedAt ?? customer.createdAt);
    if (longUnmanagedBaseDateKey && addDaysToDateKey(longUnmanagedBaseDateKey, 90) === todayKey) {
      pushCandidate({
        type: "long_unmanaged_90",
        sourceType: "customer",
        sourceId: customer.id,
        userId: customer.agentId,
        dueDateKey: todayKey,
        dedupeKey: businessDedupeKey("long_unmanaged_90", "customer", customer.id, todayKey),
      });
    }
  }

  for (const contract of input.contracts) {
    if (!hasFiniteId(contract.id) || !hasFiniteId(contract.agentId)) continue;
    if (!isActiveBusinessRow(contract)) continue;

    const contractDateKey = toKstDateKey(contract.contractDate);
    if (!contractDateKey) continue;

    const milestones: Array<{ type: BusinessPushType; days: number }> = [
      { type: "contract_90", days: 90 },
      { type: "contract_180", days: 180 },
      { type: "contract_365", days: 365 },
    ];
    for (const milestone of milestones) {
      if (addDaysToDateKey(contractDateKey, milestone.days) !== todayKey) continue;
      pushCandidate({
        type: milestone.type,
        sourceType: "contract",
        sourceId: contract.id,
        userId: contract.agentId,
        dueDateKey: todayKey,
        dedupeKey: businessDedupeKey(milestone.type, "contract", contract.id, todayKey),
      });
    }
  }

  return candidates;
}

export async function runBusinessPushReminderEngine(
  options: BusinessPushReminderEngineOptions = {},
): Promise<BusinessPushReminderEngineResult> {
  const now = options.now ?? new Date();
  const customers = await getCustomers({});
  const contracts = await getAllContracts({});
  const activeUserIds = new Set((await getAllUsers())
    .filter((user) => user.accountStatus === "active")
    .map((user) => user.id));
  const customerIds = (customers as BusinessPushCustomer[])
    .map((customer) => customer.id)
    .filter((id) => hasFiniteId(id));
  const latestConsultations = await getLatestConsultationDatesByCustomerIds(customerIds);
  const consultationsByCustomer = Object.fromEntries(latestConsultations.map((row) => [
    row.customerId,
    [{ customerId: row.customerId, createdAt: row.latestCreatedAt, isActive: true, deletedAt: null }],
  ])) as Record<number, BusinessPushConsultation[]>;

  const candidates = getBusinessPushCandidates({
    customers: customers as BusinessPushCustomer[],
    contracts: contracts as BusinessPushContract[],
    consultationsByCustomer,
  }, { now }).filter((candidate) => activeUserIds.has(candidate.userId));
  const results: PushSendResult[] = [];

  for (const candidate of candidates) {
    results.push(await sendPushToUsers([candidate.userId], BUSINESS_PUSH_PAYLOADS[candidate.type], {
      type: candidate.type,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      dedupeKey: candidate.dedupeKey,
      now,
    }));
  }

  const summary = buildOperationalSummary({
    checkedAt: now,
    candidateCount: candidates.length,
    results,
  });
  logOperationalSummary("business", summary);

  return {
    success: true,
    targetCount: candidates.length,
    birthdayTargetCount: candidates.filter((candidate) => candidate.type === "customer_birthday").length,
    contract90TargetCount: candidates.filter((candidate) => candidate.type === "contract_90").length,
    contract180TargetCount: candidates.filter((candidate) => candidate.type === "contract_180").length,
    contract365TargetCount: candidates.filter((candidate) => candidate.type === "contract_365").length,
    longUnmanagedTargetCount: candidates.filter((candidate) => candidate.type === "long_unmanaged_90").length,
    sentCount: results.reduce((sum, item) => sum + item.sentCount, 0),
    skippedCount: results.reduce((sum, item) => sum + item.skippedCount, 0),
    failureCount: results.reduce((sum, item) => sum + item.failureCount, 0),
    duplicateSkippedCount: results.reduce((sum, item) => sum + item.duplicateSkippedCount, 0),
    results,
    summary,
  };
}

export async function runPushReminderEngines(options: { now?: Date; lookbackMinutes?: number } = {}) {
  const now = options.now ?? new Date();
  const schedule = await runSchedulePushReminderEngine({ now, lookbackMinutes: options.lookbackMinutes });
  const business = await runBusinessPushReminderEngine({ now });
  const summary = buildOperationalSummary({
    checkedAt: now,
    candidateCount: schedule.targetCount + business.targetCount,
    results: [...schedule.results, ...business.results],
  });
  logOperationalSummary("combined", summary);
  return {
    success: true,
    schedule,
    business,
    targetCount: schedule.targetCount + business.targetCount,
    sentCount: schedule.sentCount + business.sentCount,
    skippedCount: schedule.skippedCount + business.skippedCount,
    failureCount: schedule.failureCount + business.failureCount,
    duplicateSkippedCount: schedule.duplicateSkippedCount + business.duplicateSkippedCount,
    summary,
  };
}
