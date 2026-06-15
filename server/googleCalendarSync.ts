import {
  GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
  SKIPPED_NO_PERSONAL_CALENDAR_CODE,
  type BoaGoogleEventType,
  type GoogleCalendarType,
  type GoogleSyncTargetType,
} from "@shared/googleCalendar";
import type { Schedule } from "../drizzle/schema";
import { createActivityLog, getCustomerById } from "./db";
import {
  decryptRefreshToken,
  encryptRefreshToken,
} from "./googleCalendarCredentialCrypto";
import {
  exchangeGoogleRefreshToken,
  getGoogleCalendarApiClient,
} from "./googleCalendarClient";
import {
  getGoogleCalendarEventSync,
  getGoogleCalendarIntegrationByType,
  getGoogleCalendarOauthCredential,
  getGoogleCalendarOrgSettings,
  getGoogleCalendarPersonalSettings,
  listGoogleCalendarEventSyncsForBoaEvent,
  listGoogleCalendarIntegrations,
  upsertGoogleCalendarEventSync,
  upsertGoogleCalendarOauthCredential,
  updateGoogleCalendarEventSyncStatus,
} from "./googleCalendarDb";
import {
  assertGoogleCalendarPayloadPolicy,
  buildGoogleCalendarDescription,
  buildGoogleCalendarTitle,
  containsPhoneNumber,
  isRawPiiAllowed,
  mapBoaScheduleToGoogleCalendarType,
  mapFollowUpToGoogleCalendarType,
  mapScheduleTypeToBoaEventType,
  orgSettingsToPayloadPolicy,
  resolvePersonalCalendarActorUserIds,
  resolveScheduleGoogleCalendarType,
  sanitizeGoogleCalendarLogMetadata,
  syncMetadataFlagsFromPolicy,
} from "./googleCalendarSafePayload";

type SyncActor = { id: number };

export type ScheduleSyncContext = {
  schedule: Schedule;
  ownerRole?: string | null;
  customerReference?: string | null;
  segmentLabel?: string | null;
  customerContact?: string | null;
};

export type FollowUpSyncContext = {
  followUpId: number;
  ownerUserId: number;
  createdBy?: number | null;
  startTime: Date;
  endTime?: Date | null;
  reason: string;
  nextAction: string;
  customerContact?: string | null;
};

const PHONE_SCRUB_PATTERN =
  /(?:01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})|(?:\d{2,3}[-\s.]?\d{3,4}[-\s.]?\d{4})/g;

function sanitizeSafeErrorMessage(message?: string | null): string | null {
  if (!message) return null;
  return message.replace(PHONE_SCRUB_PATTERN, "[연락처]").slice(0, 500);
}

function sanitizeActivityMetadata(metadata: Record<string, unknown>) {
  return sanitizeGoogleCalendarLogMetadata(metadata);
}

async function getAccessTokenOrThrow(): Promise<string> {
  const credential = await getGoogleCalendarOauthCredential();
  if (!credential?.refreshTokenEnc) {
    throw Object.assign(new Error("Google Calendar OAuth가 연결되지 않았습니다."), {
      code: "OAUTH_NOT_CONNECTED",
    });
  }
  const refreshToken = decryptRefreshToken(credential.refreshTokenEnc);
  const token = await exchangeGoogleRefreshToken(refreshToken);
  return token.accessToken;
}

async function logGoogleCalendarActivity(
  actorId: number,
  action: string,
  metadata: Record<string, unknown>
) {
  await createActivityLog({
    userId: actorId,
    action,
    targetType: "google_calendar",
    details: JSON.stringify({
      actor: actorId,
      metadata: sanitizeActivityMetadata(metadata),
    }),
  });
}

function integrationReady(
  integration?: Awaited<ReturnType<typeof getGoogleCalendarIntegrationByType>>
) {
  return Boolean(
    integration?.isActive && integration.googleCalendarId?.trim()
  );
}

type BuiltPayload = {
  title: string;
  description: string;
};

type EventPayloadInput = {
  title?: string | null;
  description?: string | null;
  memo?: string | null;
  scheduleType?: string;
  boaEventType: BoaGoogleEventType;
  customerReference?: string | null;
  segmentLabel?: string | null;
  actionLabel?: string | null;
  rawTitle?: string | null;
  customerContact?: string | null;
  createdBy?: number | null;
  ownerUserId?: number | null;
};

function buildEventPayload(
  ctx: EventPayloadInput,
  policy: ReturnType<typeof orgSettingsToPayloadPolicy>,
  targetType: GoogleSyncTargetType,
  actorUserId?: number,
  includeLegacyContact?: boolean
): BuiltPayload {
  const title = buildGoogleCalendarTitle(
    {
      title: ctx.title ?? ctx.rawTitle,
      scheduleType: ctx.scheduleType,
      boaEventType: ctx.boaEventType,
      customerReference: ctx.customerReference,
      segmentLabel: ctx.segmentLabel,
      actionLabel: ctx.actionLabel,
      rawTitle: ctx.rawTitle,
    },
    policy
  );
  const description = buildGoogleCalendarDescription(
    {
      description: ctx.description,
      memo: ctx.memo,
      targetType,
      includeCustomerContact: includeLegacyContact,
      customerContact: ctx.customerContact,
      viewerUserId: actorUserId,
      createdBy: ctx.createdBy,
      ownerUserId: ctx.ownerUserId,
    },
    policy
  );
  assertGoogleCalendarPayloadPolicy(
    { title, description },
    policy,
    {
      targetType,
      includeCustomerContact: includeLegacyContact,
      customerContact: ctx.customerContact,
      viewerUserId: actorUserId,
      createdBy: ctx.createdBy,
      ownerUserId: ctx.ownerUserId,
    }
  );
  return { title, description };
}

function buildSharedPayload(
  ctx: ScheduleSyncContext,
  boaEventType: BoaGoogleEventType,
  policy: ReturnType<typeof orgSettingsToPayloadPolicy>
): BuiltPayload {
  return buildEventPayload(
    {
      title: ctx.schedule.title,
      description: ctx.schedule.description,
      memo: ctx.schedule.memo,
      scheduleType: ctx.schedule.type,
      boaEventType,
      customerReference: ctx.customerReference,
      segmentLabel: ctx.segmentLabel ?? ctx.schedule.type,
      rawTitle: ctx.schedule.title,
      customerContact: ctx.customerContact,
      createdBy: ctx.schedule.createdBy,
      ownerUserId: ctx.schedule.userId,
    },
    policy,
    "shared_calendar"
  );
}

function buildPersonalPayload(
  ctx: EventPayloadInput,
  policy: ReturnType<typeof orgSettingsToPayloadPolicy>,
  actorUserId: number,
  includeLegacyContact: boolean
): BuiltPayload {
  return buildEventPayload(
    ctx,
    policy,
    "actor_personal_calendar",
    actorUserId,
    includeLegacyContact
  );
}

async function upsertGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string | null | undefined,
  payload: BuiltPayload,
  startTime: Date,
  endTime?: Date | null
) {
  const client = getGoogleCalendarApiClient();
  if (googleEventId) {
    const updated = await client.updateEvent(accessToken, calendarId, googleEventId, {
      calendarId,
      title: payload.title,
      description: payload.description,
      startTime,
      endTime,
    });
    return updated.eventId;
  }
  const created = await client.createEvent(accessToken, {
    calendarId,
    title: payload.title,
    description: payload.description,
    startTime,
    endTime,
  });
  return created.eventId;
}

async function syncSharedEvent(input: {
  actor: SyncActor;
  boaEventType: BoaGoogleEventType;
  boaEventId: number;
  calendarType: GoogleCalendarType;
  payload: BuiltPayload;
  startTime: Date;
  endTime?: Date | null;
  ownerUserId: number;
  createdBy?: number | null;
  policy: ReturnType<typeof orgSettingsToPayloadPolicy>;
}) {
  const integration = await getGoogleCalendarIntegrationByType(input.calendarType);
  if (!integrationReady(integration)) {
    await upsertGoogleCalendarEventSync({
      boaEventType: input.boaEventType,
      boaEventId: input.boaEventId,
      syncTargetType: "shared_calendar",
      targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
      googleCalendarId: integration?.googleCalendarId ?? "unassigned",
      calendarType: input.calendarType,
      syncStatus: "skipped",
      includeContactInDescription: false,
      contactIncluded: false,
      lastErrorCode: "SKIPPED_MISSING_CALENDAR",
      lastErrorMessageSafe: "해당 Google Calendar 연동이 비활성화되었거나 calendarId가 없습니다.",
      ownerUserId: input.ownerUserId,
      createdBy: input.actor.id,
      updatedBy: input.actor.id,
    });
    return;
  }

  const accessToken = await getAccessTokenOrThrow();
  const existing = await getGoogleCalendarEventSync(
    input.boaEventType,
    input.boaEventId,
    "shared_calendar",
    GOOGLE_CALENDAR_SHARED_TARGET_USER_ID
  );
  const googleEventId = await upsertGoogleEvent(
    accessToken,
    integration!.googleCalendarId,
    existing?.googleEventId,
    input.payload,
    input.startTime,
    input.endTime
  );

  const syncId = await upsertGoogleCalendarEventSync({
    boaEventType: input.boaEventType,
    boaEventId: input.boaEventId,
    syncTargetType: "shared_calendar",
    targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
    googleCalendarId: integration!.googleCalendarId,
    googleEventId,
    calendarType: input.calendarType,
    syncStatus: "synced",
    includeContactInDescription: false,
    contactIncluded: false,
    lastSyncedAt: new Date(),
    ownerUserId: input.ownerUserId,
    createdBy: input.createdBy ?? input.actor.id,
    updatedBy: input.actor.id,
  });

  await logGoogleCalendarActivity(input.actor.id, "GOOGLE_CALENDAR_EVENT_SYNCED", {
    calendarType: input.calendarType,
    calendarCategory: input.calendarType,
    syncTargetType: "shared_calendar",
    boaEventType: input.boaEventType,
    boaEventId: input.boaEventId,
    syncStatus: "synced",
    contactIncluded: input.policy.allowCustomerContactInGoogleCalendar,
    actorId: input.actor.id,
    syncId,
    ...syncMetadataFlagsFromPolicy(input.policy),
  });
}

async function syncPersonalActorEvents(input: {
  actor: SyncActor;
  boaEventType: BoaGoogleEventType;
  boaEventId: number;
  calendarType: GoogleCalendarType;
  payloadBase: EventPayloadInput;
  startTime: Date;
  endTime?: Date | null;
  ownerUserId: number;
  createdBy?: number | null;
  policy: ReturnType<typeof orgSettingsToPayloadPolicy>;
}) {
  if (input.calendarType !== "consultation_followup") return;

  const orgSettings = await getGoogleCalendarOrgSettings();
  const legacyContactPolicyEnabled = Boolean(
    orgSettings?.includeCustomerContactForActorCalendar
  );
  const useUnifiedRawPolicy = isRawPiiAllowed(input.policy);
  const actorUserIds = resolvePersonalCalendarActorUserIds({
    createdBy: input.createdBy ?? input.payloadBase.createdBy,
    ownerUserId: input.ownerUserId,
  });

  for (const actorUserId of actorUserIds) {
    const personal = await getGoogleCalendarPersonalSettings(actorUserId);
    if (!personal?.isActive || !personal.personalCalendarId?.trim()) {
      await upsertGoogleCalendarEventSync({
        boaEventType: input.boaEventType,
        boaEventId: input.boaEventId,
        syncTargetType: "actor_personal_calendar",
        targetUserId: actorUserId,
        googleCalendarId: "unassigned",
        calendarType: input.calendarType,
        syncStatus: "skipped",
        includeContactInDescription:
          useUnifiedRawPolicy
            ? input.policy.allowCustomerContactInGoogleCalendar
            : legacyContactPolicyEnabled,
        contactIncluded: false,
        lastErrorCode: SKIPPED_NO_PERSONAL_CALENDAR_CODE,
        lastErrorMessageSafe: "개인 Google Calendar가 연동되지 않았습니다.",
        ownerUserId: input.ownerUserId,
        createdBy: input.actor.id,
        updatedBy: input.actor.id,
      });
      continue;
    }

    const includeLegacyContact = Boolean(
      !useUnifiedRawPolicy &&
        legacyContactPolicyEnabled &&
        personal.contactDisplayConsent &&
        input.payloadBase.customerContact?.trim()
    );

    const payload = buildPersonalPayload(
      input.payloadBase,
      input.policy,
      actorUserId,
      includeLegacyContact
    );

    const contactIncluded = useUnifiedRawPolicy
      ? Boolean(
          input.policy.allowCustomerContactInGoogleCalendar &&
            containsPhoneNumber(payload.title + payload.description)
        )
      : includeLegacyContact;

    try {
      const accessToken = await getAccessTokenOrThrow();
      const existing = await getGoogleCalendarEventSync(
        input.boaEventType,
        input.boaEventId,
        "actor_personal_calendar",
        actorUserId
      );
      const googleEventId = await upsertGoogleEvent(
        accessToken,
        personal.personalCalendarId,
        existing?.googleEventId,
        payload,
        input.startTime,
        input.endTime
      );

      await upsertGoogleCalendarEventSync({
        boaEventType: input.boaEventType,
        boaEventId: input.boaEventId,
        syncTargetType: "actor_personal_calendar",
        targetUserId: actorUserId,
        googleCalendarId: personal.personalCalendarId,
        googleEventId,
        calendarType: input.calendarType,
        syncStatus: "synced",
        includeContactInDescription: contactIncluded,
        contactIncluded,
        lastSyncedAt: new Date(),
        ownerUserId: input.ownerUserId,
        createdBy: input.actor.id,
        updatedBy: input.actor.id,
      });

      await logGoogleCalendarActivity(
        input.actor.id,
        "GOOGLE_CALENDAR_EVENT_SYNCED",
        {
          calendarType: input.calendarType,
          syncTargetType: "actor_personal_calendar",
          boaEventType: input.boaEventType,
          boaEventId: input.boaEventId,
          syncStatus: "synced",
          contactIncluded,
          actorId: input.actor.id,
          targetUserId: actorUserId,
          ...syncMetadataFlagsFromPolicy(input.policy),
        }
      );
    } catch (error) {
      const err = error as Error & { code?: string };
      await upsertGoogleCalendarEventSync({
        boaEventType: input.boaEventType,
        boaEventId: input.boaEventId,
        syncTargetType: "actor_personal_calendar",
        targetUserId: actorUserId,
        googleCalendarId: personal.personalCalendarId,
        calendarType: input.calendarType,
        syncStatus: "failed",
        includeContactInDescription: contactIncluded,
        contactIncluded: false,
        lastErrorCode: err.code ?? "SYNC_FAILED",
        lastErrorMessageSafe: sanitizeSafeErrorMessage(
          err.message ?? "Google Calendar 동기화에 실패했습니다."
        ),
        ownerUserId: input.ownerUserId,
        createdBy: input.actor.id,
        updatedBy: input.actor.id,
      });
      await logGoogleCalendarActivity(
        input.actor.id,
        "GOOGLE_CALENDAR_EVENT_SYNC_FAILED",
        {
          syncTargetType: "actor_personal_calendar",
          boaEventType: input.boaEventType,
          boaEventId: input.boaEventId,
          syncStatus: "failed",
          safeErrorCode: err.code ?? "SYNC_FAILED",
          contactIncluded: false,
          actorId: input.actor.id,
          targetUserId: actorUserId,
        }
      );
    }
  }
}

export async function buildScheduleGooglePayload(ctx: ScheduleSyncContext) {
  const calendarType = resolveScheduleGoogleCalendarType({
    scheduleType: ctx.schedule.type,
    customerId: ctx.schedule.customerId,
    ownerRole: ctx.ownerRole,
    status: ctx.schedule.status,
    calendarCategory: ctx.schedule.calendarCategory,
  });
  if (calendarType === "skipped") {
    return { calendarType, skipped: true as const };
  }

  const orgSettings = await getGoogleCalendarOrgSettings();
  const policy = orgSettingsToPayloadPolicy(orgSettings);

  const boaEventType = mapScheduleTypeToBoaEventType(
    ctx.schedule.type,
    calendarType
  );
  const payload = buildSharedPayload(ctx, boaEventType, policy);
  return {
    calendarType,
    boaEventType,
    payload,
    policy,
    skipped: false as const,
  };
}

export async function syncScheduleToGoogleCalendar(
  actor: SyncActor,
  ctx: ScheduleSyncContext
): Promise<void> {
  try {
    const built = await buildScheduleGooglePayload(ctx);
    if (built.skipped) {
      await upsertGoogleCalendarEventSync({
        boaEventType: "calendar_event",
        boaEventId: ctx.schedule.id,
        syncTargetType: "shared_calendar",
        targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
        googleCalendarId: "unassigned",
        calendarType: "branch_common",
        syncStatus: "skipped",
        ownerUserId: ctx.schedule.userId,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      return;
    }

    await syncSharedEvent({
      actor,
      boaEventType: built.boaEventType,
      boaEventId: ctx.schedule.id,
      calendarType: built.calendarType,
      payload: built.payload,
      startTime: ctx.schedule.startTime,
      endTime: ctx.schedule.endTime,
      ownerUserId: ctx.schedule.userId,
      createdBy: ctx.schedule.createdBy,
      policy: built.policy,
    });

    await syncPersonalActorEvents({
      actor,
      boaEventType: built.boaEventType,
      boaEventId: ctx.schedule.id,
      calendarType: built.calendarType,
      payloadBase: {
        title: ctx.schedule.title,
        description: ctx.schedule.description,
        memo: ctx.schedule.memo,
        scheduleType: ctx.schedule.type,
        boaEventType: built.boaEventType,
        customerReference: ctx.customerReference,
        segmentLabel: ctx.segmentLabel ?? ctx.schedule.type,
        rawTitle: ctx.schedule.title,
        customerContact: ctx.customerContact,
        createdBy: ctx.schedule.createdBy,
        ownerUserId: ctx.schedule.userId,
      },
      startTime: ctx.schedule.startTime,
      endTime: ctx.schedule.endTime,
      ownerUserId: ctx.schedule.userId,
      createdBy: ctx.schedule.createdBy,
      policy: built.policy,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    const calendarType = resolveScheduleGoogleCalendarType({
      scheduleType: ctx.schedule.type,
      customerId: ctx.schedule.customerId,
      ownerRole: ctx.ownerRole,
      status: ctx.schedule.status,
      calendarCategory: ctx.schedule.calendarCategory,
    });
    const resolvedCalendarType =
      calendarType === "skipped" ? "branch_common" : calendarType;
    const boaEventType = mapScheduleTypeToBoaEventType(
      ctx.schedule.type,
      resolvedCalendarType
    );

    await upsertGoogleCalendarEventSync({
      boaEventType,
      boaEventId: ctx.schedule.id,
      syncTargetType: "shared_calendar",
      targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
      googleCalendarId: "unassigned",
      calendarType: resolvedCalendarType,
      syncStatus: "failed",
      includeContactInDescription: false,
      contactIncluded: false,
      lastErrorCode: err.code ?? "SYNC_FAILED",
      lastErrorMessageSafe: sanitizeSafeErrorMessage(
        err.message ?? "Google Calendar 동기화에 실패했습니다."
      ),
      ownerUserId: ctx.schedule.userId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await logGoogleCalendarActivity(
      actor.id,
      "GOOGLE_CALENDAR_EVENT_SYNC_FAILED",
      {
        boaEventType,
        boaEventId: ctx.schedule.id,
        syncStatus: "failed",
        safeErrorCode: err.code ?? "SYNC_FAILED",
        contactIncluded: false,
        actorId: actor.id,
      }
    );
  }
}

export async function syncFollowUpToGoogleCalendar(
  actor: SyncActor,
  ctx: FollowUpSyncContext
): Promise<void> {
  const calendarType = mapFollowUpToGoogleCalendarType();
  const orgSettings = await getGoogleCalendarOrgSettings();
  const policy = orgSettingsToPayloadPolicy(orgSettings);
  const followUpTitle = [ctx.reason, ctx.nextAction].filter(Boolean).join(" · ");
  const sharedPayload = buildEventPayload(
    {
      title: followUpTitle,
      description: followUpTitle,
      boaEventType: "follow_up",
      actionLabel: ctx.nextAction,
      segmentLabel: ctx.reason,
      rawTitle: followUpTitle,
      customerContact: ctx.customerContact,
      createdBy: ctx.createdBy ?? actor.id,
      ownerUserId: ctx.ownerUserId,
    },
    policy,
    "shared_calendar"
  );

  try {
    await syncSharedEvent({
      actor,
      boaEventType: "follow_up",
      boaEventId: ctx.followUpId,
      calendarType,
      payload: sharedPayload,
      startTime: ctx.startTime,
      endTime: ctx.endTime,
      ownerUserId: ctx.ownerUserId,
      createdBy: ctx.createdBy ?? actor.id,
      policy,
    });

    await syncPersonalActorEvents({
      actor,
      boaEventType: "follow_up",
      boaEventId: ctx.followUpId,
      calendarType,
      payloadBase: {
        title: followUpTitle,
        description: followUpTitle,
        boaEventType: "follow_up",
        actionLabel: ctx.nextAction,
        segmentLabel: ctx.reason,
        rawTitle: followUpTitle,
        customerContact: ctx.customerContact,
        createdBy: ctx.createdBy ?? actor.id,
        ownerUserId: ctx.ownerUserId,
      },
      startTime: ctx.startTime,
      endTime: ctx.endTime,
      ownerUserId: ctx.ownerUserId,
      createdBy: ctx.createdBy ?? actor.id,
      policy,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    await upsertGoogleCalendarEventSync({
      boaEventType: "follow_up",
      boaEventId: ctx.followUpId,
      syncTargetType: "shared_calendar",
      targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
      googleCalendarId: "unassigned",
      calendarType,
      syncStatus: "failed",
      includeContactInDescription: false,
      contactIncluded: false,
      lastErrorCode: err.code ?? "SYNC_FAILED",
      lastErrorMessageSafe: sanitizeSafeErrorMessage(
        err.message ?? "Google Calendar 동기화에 실패했습니다."
      ),
      ownerUserId: ctx.ownerUserId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await logGoogleCalendarActivity(
      actor.id,
      "GOOGLE_CALENDAR_EVENT_SYNC_FAILED",
      {
        boaEventType: "follow_up",
        boaEventId: ctx.followUpId,
        syncStatus: "failed",
        safeErrorCode: err.code ?? "SYNC_FAILED",
        contactIncluded: false,
        actorId: actor.id,
      }
    );
  }
}

export async function deleteGoogleCalendarEventForBoaEvent(
  actor: SyncActor,
  boaEventType: BoaGoogleEventType,
  boaEventId: number
): Promise<void> {
  const rows = await listGoogleCalendarEventSyncsForBoaEvent(
    boaEventType,
    boaEventId
  );
  if (!rows.length) return;

  const accessToken = await getAccessTokenOrThrow().catch(() => null);
  const client = getGoogleCalendarApiClient();

  for (const existing of rows) {
    if (!existing.googleEventId || existing.googleCalendarId === "unassigned") {
      await updateGoogleCalendarEventSyncStatus(existing.id, {
        syncStatus: "deleted",
        updatedBy: actor.id,
      });
      continue;
    }
    try {
      if (accessToken) {
        await client.deleteEvent(
          accessToken,
          existing.googleCalendarId,
          existing.googleEventId
        );
      }
      await updateGoogleCalendarEventSyncStatus(existing.id, {
        syncStatus: "deleted",
        lastSyncedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessageSafe: null,
        updatedBy: actor.id,
      });
    } catch (error) {
      const err = error as Error & { code?: string };
      await updateGoogleCalendarEventSyncStatus(existing.id, {
        syncStatus: "failed",
        lastErrorCode: err.code ?? "DELETE_FAILED",
        lastErrorMessageSafe: sanitizeSafeErrorMessage(
          err.message ?? "Google Calendar 이벤트 삭제에 실패했습니다."
        ),
        updatedBy: actor.id,
      });
    }
  }

  await logGoogleCalendarActivity(actor.id, "GOOGLE_CALENDAR_EVENT_DELETED", {
    boaEventType,
    boaEventId,
    syncStatus: "deleted",
    contactIncluded: false,
    actorId: actor.id,
  });
}

export async function retryFailedGoogleCalendarSync(
  actor: SyncActor,
  syncId: number,
  scheduleLoader: (
    boaEventType: BoaGoogleEventType,
    boaEventId: number
  ) => Promise<ScheduleSyncContext | null>
): Promise<{ success: boolean }> {
  const { listGoogleCalendarEventSyncs } = await import("./googleCalendarDb");
  const rows = await listGoogleCalendarEventSyncs({ limit: 500 });
  const row = rows.find(r => r.id === syncId);
  if (!row || row.syncStatus !== "failed") {
    return { success: false };
  }

  await logGoogleCalendarActivity(
    actor.id,
    "GOOGLE_CALENDAR_EVENT_RETRY_REQUESTED",
    {
      boaEventType: row.boaEventType,
      boaEventId: row.boaEventId,
      syncTargetType: row.syncTargetType,
      retryCount: (row.retryCount ?? 0) + 1,
      contactIncluded: false,
      actorId: actor.id,
    }
  );

  const scheduleCtx = await scheduleLoader(row.boaEventType, row.boaEventId);
  if (!scheduleCtx) return { success: false };

  await updateGoogleCalendarEventSyncStatus(syncId, {
    retryCount: (row.retryCount ?? 0) + 1,
    updatedBy: actor.id,
  });
  await syncScheduleToGoogleCalendar(actor, scheduleCtx);
  const refreshed = await getGoogleCalendarEventSync(
    row.boaEventType,
    row.boaEventId,
    row.syncTargetType as GoogleSyncTargetType,
    row.targetUserId
  );
  return { success: refreshed?.syncStatus === "synced" };
}

export function fireAndForgetGoogleCalendarScheduleSync(
  actor: SyncActor,
  ctx: ScheduleSyncContext
) {
  void syncScheduleToGoogleCalendar(actor, ctx).catch(() => undefined);
}

export function fireAndForgetGoogleCalendarScheduleDelete(
  actor: SyncActor,
  boaEventType: BoaGoogleEventType,
  boaEventId: number
) {
  void deleteGoogleCalendarEventForBoaEvent(actor, boaEventType, boaEventId).catch(
    () => undefined
  );
}

export async function testGoogleCalendarAccessForIntegration(
  calendarId: string
): Promise<{ ok: boolean; errorCode?: string; errorMessageSafe?: string }> {
  const accessToken = await getAccessTokenOrThrow();
  const client = getGoogleCalendarApiClient();
  return client.testCalendarAccess(accessToken, calendarId);
}

export async function storeGoogleCalendarRefreshToken(
  refreshToken: string,
  connectedBy: number,
  scope?: string
) {
  await upsertGoogleCalendarOauthCredential({
    refreshTokenEnc: encryptRefreshToken(refreshToken),
    tokenScope: scope,
    connectedBy,
  });
}

export async function getGoogleCalendarSettingsSummary(userId: number) {
  const [integrations, oauth, orgSettings, personalSettings] = await Promise.all([
    listGoogleCalendarIntegrations(),
    getGoogleCalendarOauthCredential(),
    getGoogleCalendarOrgSettings(),
    getGoogleCalendarPersonalSettings(userId),
  ]);
  return {
    oauthConnected: Boolean(oauth?.isActive),
    oauthLastTestedAt: oauth?.lastTestedAt ?? null,
    oauthLastTestResult: oauth?.lastTestResult ?? null,
    oauthLastTestErrorSafe: oauth?.lastTestErrorSafe ?? null,
    includeCustomerContactForActorCalendar:
      orgSettings?.includeCustomerContactForActorCalendar ?? false,
    syncRawTitleToGoogleCalendar:
      orgSettings?.syncRawTitleToGoogleCalendar ?? false,
    syncRawDescriptionToGoogleCalendar:
      orgSettings?.syncRawDescriptionToGoogleCalendar ?? false,
    allowCustomerNameInGoogleCalendar:
      orgSettings?.allowCustomerNameInGoogleCalendar ?? false,
    allowCustomerContactInGoogleCalendar:
      orgSettings?.allowCustomerContactInGoogleCalendar ?? false,
    personalSettings: personalSettings
      ? {
          personalCalendarIdMasked: personalSettings.personalCalendarId
            ? maskCalendarId(personalSettings.personalCalendarId)
            : null,
          contactDisplayConsent: personalSettings.contactDisplayConsent,
          isActive: personalSettings.isActive,
          hasPersonalCalendar: Boolean(personalSettings.personalCalendarId),
        }
      : {
          personalCalendarIdMasked: null,
          contactDisplayConsent: false,
          isActive: false,
          hasPersonalCalendar: false,
        },
    integrations: integrations.map(row => ({
      id: row.id,
      calendarType: row.calendarType,
      displayName: row.displayName,
      googleCalendarIdMasked: maskCalendarId(row.googleCalendarId),
      isActive: row.isActive,
      lastTestedAt: row.lastTestedAt,
      lastTestResult: row.lastTestResult,
      lastTestErrorSafe: row.lastTestErrorSafe,
    })),
  };
}

export async function loadCustomerContactForSync(
  customerId?: number | null
): Promise<string | null> {
  if (!customerId) return null;
  const customer = await getCustomerById(customerId);
  const phone = customer?.phone?.trim();
  return phone || null;
}

function maskCalendarId(calendarId: string): string {
  if (calendarId.length <= 8) return "****";
  return `${calendarId.slice(0, 4)}...${calendarId.slice(-4)}`;
}
