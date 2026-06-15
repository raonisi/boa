import type { BoaGoogleEventType, GoogleCalendarType } from "@shared/googleCalendar";
import type { Schedule } from "../drizzle/schema";
import { createActivityLog } from "./db";
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
  listGoogleCalendarIntegrations,
  upsertGoogleCalendarEventSync,
  upsertGoogleCalendarOauthCredential,
  updateGoogleCalendarEventSyncStatus,
} from "./googleCalendarDb";
import {
  assertSafeGoogleCalendarEventPayload,
  buildSafeGoogleCalendarDescription,
  buildSafeGoogleCalendarTitle,
  mapBoaScheduleToGoogleCalendarType,
  mapFollowUpToGoogleCalendarType,
  mapScheduleTypeToBoaEventType,
} from "./googleCalendarSafePayload";

type SyncActor = { id: number };

export type ScheduleSyncContext = {
  schedule: Schedule;
  ownerRole?: string | null;
  customerReference?: string | null;
  segmentLabel?: string | null;
};

export type FollowUpSyncContext = {
  followUpId: number;
  ownerUserId: number;
  startTime: Date;
  endTime?: Date | null;
  reason: string;
  nextAction: string;
};

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
      metadata,
    }),
  });
}

function integrationReady(
  calendarType: GoogleCalendarType,
  integration?: Awaited<ReturnType<typeof getGoogleCalendarIntegrationByType>>
) {
  return Boolean(
    integration?.isActive && integration.googleCalendarId?.trim()
  );
}

export async function buildScheduleGooglePayload(ctx: ScheduleSyncContext) {
  const calendarType = mapBoaScheduleToGoogleCalendarType({
    scheduleType: ctx.schedule.type,
    customerId: ctx.schedule.customerId,
    ownerRole: ctx.ownerRole,
    status: ctx.schedule.status,
  });
  if (calendarType === "skipped") {
    return { calendarType, skipped: true as const };
  }

  const boaEventType = mapScheduleTypeToBoaEventType(
    ctx.schedule.type,
    calendarType
  );
  const title = buildSafeGoogleCalendarTitle({
    scheduleType: ctx.schedule.type,
    boaEventType,
    customerReference: ctx.customerReference,
    segmentLabel: ctx.segmentLabel ?? ctx.schedule.type,
    rawTitle: ctx.schedule.title,
  });
  const description = buildSafeGoogleCalendarDescription();
  const payload = { title, description };
  assertSafeGoogleCalendarEventPayload(payload);
  return {
    calendarType,
    boaEventType,
    payload,
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
        googleCalendarId: "unassigned",
        calendarType: "branch_common",
        syncStatus: "skipped",
        ownerUserId: ctx.schedule.userId,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      return;
    }

    const integration = await getGoogleCalendarIntegrationByType(
      built.calendarType
    );
    if (!integrationReady(built.calendarType, integration)) {
      await upsertGoogleCalendarEventSync({
        boaEventType: built.boaEventType,
        boaEventId: ctx.schedule.id,
        googleCalendarId: integration?.googleCalendarId ?? "",
        calendarType: built.calendarType,
        syncStatus: "skipped",
        lastErrorCode: "INTEGRATION_INACTIVE",
        lastErrorMessageSafe: "캘린더 연동이 비활성화되어 있습니다.",
        ownerUserId: ctx.schedule.userId,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      return;
    }

    const accessToken = await getAccessTokenOrThrow();
    const client = getGoogleCalendarApiClient();
    const existing = await getGoogleCalendarEventSync(
      built.boaEventType,
      ctx.schedule.id
    );

    let googleEventId = existing?.googleEventId ?? undefined;
    if (googleEventId) {
      const updated = await client.updateEvent(
        accessToken,
        integration!.googleCalendarId,
        googleEventId,
        {
          calendarId: integration!.googleCalendarId,
          title: built.payload.title,
          description: built.payload.description,
          startTime: ctx.schedule.startTime,
          endTime: ctx.schedule.endTime,
        }
      );
      googleEventId = updated.eventId;
    } else {
      const created = await client.createEvent(accessToken, {
        calendarId: integration!.googleCalendarId,
        title: built.payload.title,
        description: built.payload.description,
        startTime: ctx.schedule.startTime,
        endTime: ctx.schedule.endTime,
      });
      googleEventId = created.eventId;
    }

    const syncId = await upsertGoogleCalendarEventSync({
      boaEventType: built.boaEventType,
      boaEventId: ctx.schedule.id,
      googleCalendarId: integration!.googleCalendarId,
      googleEventId,
      calendarType: built.calendarType,
      syncStatus: "synced",
      lastSyncedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessageSafe: null,
      ownerUserId: ctx.schedule.userId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await logGoogleCalendarActivity(actor.id, "GOOGLE_CALENDAR_EVENT_SYNCED", {
      calendarType: built.calendarType,
      boaEventType: built.boaEventType,
      boaEventId: ctx.schedule.id,
      syncStatus: "synced",
      actorId: actor.id,
      syncId,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    const calendarType = mapBoaScheduleToGoogleCalendarType({
      scheduleType: ctx.schedule.type,
      customerId: ctx.schedule.customerId,
      ownerRole: ctx.ownerRole,
      status: ctx.schedule.status,
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
      googleCalendarId: "unassigned",
      calendarType: resolvedCalendarType,
      syncStatus: "failed",
      lastErrorCode: err.code ?? "SYNC_FAILED",
      lastErrorMessageSafe:
        err.message?.slice(0, 500) ??
        "Google Calendar 동기화에 실패했습니다.",
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
  try {
    const integration = await getGoogleCalendarIntegrationByType(calendarType);
    if (!integrationReady(calendarType, integration)) return;

    const title = buildSafeGoogleCalendarTitle({
      boaEventType: "follow_up",
      actionLabel: ctx.nextAction,
      segmentLabel: ctx.reason,
    });
    const description = buildSafeGoogleCalendarDescription();
    assertSafeGoogleCalendarEventPayload({ title, description });

    const accessToken = await getAccessTokenOrThrow();
    const client = getGoogleCalendarApiClient();
    const existing = await getGoogleCalendarEventSync(
      "follow_up",
      ctx.followUpId
    );

    let googleEventId = existing?.googleEventId ?? undefined;
    if (googleEventId) {
      const updated = await client.updateEvent(
        accessToken,
        integration!.googleCalendarId,
        googleEventId,
        {
          calendarId: integration!.googleCalendarId,
          title,
          description,
          startTime: ctx.startTime,
          endTime: ctx.endTime,
        }
      );
      googleEventId = updated.eventId;
    } else {
      const created = await client.createEvent(accessToken, {
        calendarId: integration!.googleCalendarId,
        title,
        description,
        startTime: ctx.startTime,
        endTime: ctx.endTime,
      });
      googleEventId = created.eventId;
    }

    await upsertGoogleCalendarEventSync({
      boaEventType: "follow_up",
      boaEventId: ctx.followUpId,
      googleCalendarId: integration!.googleCalendarId,
      googleEventId,
      calendarType,
      syncStatus: "synced",
      lastSyncedAt: new Date(),
      ownerUserId: ctx.ownerUserId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    await logGoogleCalendarActivity(actor.id, "GOOGLE_CALENDAR_EVENT_SYNCED", {
      calendarType,
      boaEventType: "follow_up",
      boaEventId: ctx.followUpId,
      syncStatus: "synced",
      actorId: actor.id,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    await upsertGoogleCalendarEventSync({
      boaEventType: "follow_up",
      boaEventId: ctx.followUpId,
      googleCalendarId: "unassigned",
      calendarType,
      syncStatus: "failed",
      lastErrorCode: err.code ?? "SYNC_FAILED",
      lastErrorMessageSafe:
        err.message?.slice(0, 500) ??
        "Google Calendar 동기화에 실패했습니다.",
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
  const existing = await getGoogleCalendarEventSync(boaEventType, boaEventId);
  if (!existing?.googleEventId || !existing.googleCalendarId) {
    if (existing) {
      await updateGoogleCalendarEventSyncStatus(existing.id, {
        syncStatus: "deleted",
        updatedBy: actor.id,
      });
    }
    return;
  }

  try {
    const accessToken = await getAccessTokenOrThrow();
    const client = getGoogleCalendarApiClient();
    await client.deleteEvent(
      accessToken,
      existing.googleCalendarId,
      existing.googleEventId
    );
    await updateGoogleCalendarEventSyncStatus(existing.id, {
      syncStatus: "deleted",
      lastSyncedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessageSafe: null,
      updatedBy: actor.id,
    });
    await logGoogleCalendarActivity(actor.id, "GOOGLE_CALENDAR_EVENT_DELETED", {
      boaEventType,
      boaEventId,
      syncStatus: "deleted",
      actorId: actor.id,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    await updateGoogleCalendarEventSyncStatus(existing.id, {
      syncStatus: "failed",
      lastErrorCode: err.code ?? "DELETE_FAILED",
      lastErrorMessageSafe:
        err.message?.slice(0, 500) ??
        "Google Calendar 이벤트 삭제에 실패했습니다.",
      updatedBy: actor.id,
    });
    await logGoogleCalendarActivity(
      actor.id,
      "GOOGLE_CALENDAR_EVENT_SYNC_FAILED",
      {
        boaEventType,
        boaEventId,
        syncStatus: "failed",
        safeErrorCode: err.code ?? "DELETE_FAILED",
        actorId: actor.id,
      }
    );
  }
}

export async function retryFailedGoogleCalendarSync(
  actor: SyncActor,
  syncId: number,
  scheduleLoader: (boaEventType: BoaGoogleEventType, boaEventId: number) => Promise<ScheduleSyncContext | null>
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
      retryCount: (row.retryCount ?? 0) + 1,
      actorId: actor.id,
    }
  );

  if (row.boaEventType === "follow_up") {
    return { success: false };
  }

  const scheduleCtx = await scheduleLoader(row.boaEventType, row.boaEventId);
  if (!scheduleCtx) return { success: false };

  await updateGoogleCalendarEventSyncStatus(syncId, {
    retryCount: (row.retryCount ?? 0) + 1,
    updatedBy: actor.id,
  });
  await syncScheduleToGoogleCalendar(actor, scheduleCtx);
  const refreshed = await getGoogleCalendarEventSync(
    row.boaEventType,
    row.boaEventId
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

export async function getGoogleCalendarSettingsSummary() {
  const [integrations, oauth] = await Promise.all([
    listGoogleCalendarIntegrations(),
    getGoogleCalendarOauthCredential(),
  ]);
  return {
    oauthConnected: Boolean(oauth?.isActive),
    oauthLastTestedAt: oauth?.lastTestedAt ?? null,
    oauthLastTestResult: oauth?.lastTestResult ?? null,
    oauthLastTestErrorSafe: oauth?.lastTestErrorSafe ?? null,
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

function maskCalendarId(calendarId: string): string {
  if (calendarId.length <= 8) return "****";
  return `${calendarId.slice(0, 4)}...${calendarId.slice(-4)}`;
}
