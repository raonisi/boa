import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import {
  createPushNotificationLog,
  deactivateDeviceTokenByToken,
  getActiveDeviceTokensForUsers,
  getAllUsers,
  getPushNotificationLogByDedupeKey,
  updatePushNotificationLog,
} from "./db";

export type PushNotificationType = "today_follow_up" | "schedule_30min" | "contract_delete_request" | "test";

export type SafePushPayload = {
  title: "BOA 업무 알림" | "BOA 일정 알림" | "BOA 처리 요청" | "BOA 테스트 알림";
  body:
    | "오늘 확인할 후속관리가 있습니다."
    | "30분 후 예정된 일정이 있습니다."
    | "처리할 계약 삭제 요청이 있습니다."
    | "푸시 알림 수신 준비가 완료되었습니다.";
  data?: Record<string, string>;
};

export type PushSendContext = {
  type: PushNotificationType;
  sourceType?: string;
  sourceId?: number;
  dedupeKey?: string;
};

export type PushSendResult = {
  requestedUserIds: number[];
  tokenCount: number;
  sentCount: number;
  failureCount: number;
  skippedCount: number;
  duplicateSkippedCount: number;
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
    title: "BOA 업무 알림",
    body: "오늘 확인할 후속관리가 있습니다.",
  },
  schedule30Minute: {
    title: "BOA 일정 알림",
    body: "30분 후 예정된 일정이 있습니다.",
  },
  contractDeleteRequest: {
    title: "BOA 처리 요청",
    body: "처리할 계약 삭제 요청이 있습니다.",
  },
  test: {
    title: "BOA 테스트 알림",
    body: "푸시 알림 수신 준비가 완료되었습니다.",
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
  const text = `${payload.title} ${payload.body}`;
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

export async function sendPushToUsers(userIds: number[], payload: SafePushPayload, context: PushSendContext): Promise<PushSendResult> {
  const uniqueUserIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  const safePayload = sanitizePushPayload(payload);
  let duplicateSkippedCount = 0;

  const rows = await getActiveDeviceTokensForUsers(uniqueUserIds);
  if (rows.length === 0) {
    return { requestedUserIds: uniqueUserIds, tokenCount: 0, sentCount: 0, failureCount: 0, skippedCount: uniqueUserIds.length, duplicateSkippedCount, disabledReason: "no_tokens" };
  }

  const sender = testSender ?? sendWithFirebase;
  if (!testSender && !getFirebaseMessagingClient()) {
    return { requestedUserIds: uniqueUserIds, tokenCount: rows.length, sentCount: 0, failureCount: 0, skippedCount: rows.length, duplicateSkippedCount, disabledReason: "missing_firebase_config" };
  }

  let sentCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const userId of uniqueUserIds) {
    const userRows = rows.filter((row) => row.userId === userId);
    if (userRows.length === 0) {
      skippedCount += 1;
      continue;
    }

    const dedupeKey = context.dedupeKey ? `${context.dedupeKey}:user:${userId}` : undefined;
    if (dedupeKey && await getPushNotificationLogByDedupeKey(dedupeKey)) {
      duplicateSkippedCount += 1;
      continue;
    }

    const logRow = dedupeKey ? await createPushNotificationLog({
      type: context.type,
      userId,
      sourceType: context.sourceType ?? null,
      sourceId: context.sourceId ?? null,
      dedupeKey,
      status: "skipped",
    }) : null;

    const sendResults = await sender(userRows.map((row) => row.token), safePayload);
    if (!sendResults) {
      skippedCount += userRows.length;
      if (logRow) await updatePushNotificationLog(logRow.id, { status: "skipped", errorCode: "missing_firebase_config" });
      continue;
    }

    const failures = sendResults.filter((item) => !item.success);
    const successes = sendResults.filter((item) => item.success);
    sentCount += successes.length;
    failureCount += failures.length;

    for (const failure of failures) {
      if (failure.errorCode && INVALID_TOKEN_CODES.has(failure.errorCode)) {
        await deactivateDeviceTokenByToken(failure.token);
      }
    }

    if (logRow) {
      await updatePushNotificationLog(logRow.id, {
        status: failures.length === sendResults.length ? "failed" : "sent",
        errorCode: failures[0]?.errorCode ?? null,
        sentAt: successes.length > 0 ? new Date() : null,
      });
    }
  }

  return { requestedUserIds: uniqueUserIds, tokenCount: rows.length, sentCount, failureCount, skippedCount, duplicateSkippedCount };
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
