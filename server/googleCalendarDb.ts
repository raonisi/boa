import { and, desc, eq, inArray } from "drizzle-orm";
import {
  ORGANIZATION_SCOPE_DEFAULT,
  type GoogleCalendarType,
  type GoogleSyncStatus,
  type BoaGoogleEventType,
} from "@shared/googleCalendar";
import {
  googleCalendarEventSyncs,
  googleCalendarIntegrations,
  googleCalendarOauthCredentials,
  type InsertGoogleCalendarEventSync,
  type InsertGoogleCalendarIntegration,
} from "../drizzle/schema";
import { getDb } from "./db";

export async function getGoogleCalendarOauthCredential(
  organizationScope = ORGANIZATION_SCOPE_DEFAULT
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarOauthCredentials)
    .where(
      and(
        eq(googleCalendarOauthCredentials.organizationScope, organizationScope),
        eq(googleCalendarOauthCredentials.isActive, true)
      )
    )
    .limit(1);
  return rows[0];
}

export async function upsertGoogleCalendarOauthCredential(input: {
  organizationScope?: number;
  refreshTokenEnc: string;
  tokenScope?: string;
  connectedBy: number;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const organizationScope =
    input.organizationScope ?? ORGANIZATION_SCOPE_DEFAULT;
  const existing = await getGoogleCalendarOauthCredential(organizationScope);
  if (existing) {
    await db
      .update(googleCalendarOauthCredentials)
      .set({
        refreshTokenEnc: input.refreshTokenEnc,
        tokenScope: input.tokenScope ?? existing.tokenScope,
        connectedBy: input.connectedBy,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarOauthCredentials.id, existing.id));
    return existing.id;
  }
  const inserted = await db.insert(googleCalendarOauthCredentials).values({
    organizationScope,
    refreshTokenEnc: input.refreshTokenEnc,
    tokenScope: input.tokenScope,
    connectedBy: input.connectedBy,
    isActive: true,
  });
  return inserted[0].insertId;
}

export async function updateGoogleCalendarOauthTestResult(
  id: number,
  result: {
    lastTestedAt: Date;
    lastTestResult: string;
    lastTestErrorSafe?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(googleCalendarOauthCredentials)
    .set(result)
    .where(eq(googleCalendarOauthCredentials.id, id));
}

export async function listGoogleCalendarIntegrations(
  organizationScope = ORGANIZATION_SCOPE_DEFAULT
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(googleCalendarIntegrations)
    .where(eq(googleCalendarIntegrations.organizationScope, organizationScope))
    .orderBy(googleCalendarIntegrations.calendarType);
}

export async function getGoogleCalendarIntegrationByType(
  calendarType: GoogleCalendarType,
  organizationScope = ORGANIZATION_SCOPE_DEFAULT
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarIntegrations)
    .where(
      and(
        eq(googleCalendarIntegrations.organizationScope, organizationScope),
        eq(googleCalendarIntegrations.calendarType, calendarType)
      )
    )
    .limit(1);
  return rows[0];
}

export async function upsertGoogleCalendarIntegration(
  input: InsertGoogleCalendarIntegration & {
    organizationScope?: number;
    updatedBy: number;
  }
) {
  const db = await getDb();
  if (!db) return undefined;
  const organizationScope =
    input.organizationScope ?? ORGANIZATION_SCOPE_DEFAULT;
  const existing = await getGoogleCalendarIntegrationByType(
    input.calendarType,
    organizationScope
  );
  if (existing) {
    await db
      .update(googleCalendarIntegrations)
      .set({
        googleCalendarId: input.googleCalendarId,
        displayName: input.displayName,
        isActive: input.isActive ?? true,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarIntegrations.id, existing.id));
    return existing.id;
  }
  const inserted = await db.insert(googleCalendarIntegrations).values({
    organizationScope,
    provider: "google_calendar",
    calendarType: input.calendarType,
    googleCalendarId: input.googleCalendarId,
    displayName: input.displayName,
    isActive: input.isActive ?? true,
    createdBy: input.createdBy,
    updatedBy: input.updatedBy,
  });
  return inserted[0].insertId;
}

export async function disableGoogleCalendarIntegration(
  calendarType: GoogleCalendarType,
  updatedBy: number,
  organizationScope = ORGANIZATION_SCOPE_DEFAULT
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(googleCalendarIntegrations)
    .set({ isActive: false, updatedBy, updatedAt: new Date() })
    .where(
      and(
        eq(googleCalendarIntegrations.organizationScope, organizationScope),
        eq(googleCalendarIntegrations.calendarType, calendarType)
      )
    );
}

export async function updateGoogleCalendarIntegrationTestResult(
  id: number,
  result: {
    lastTestedAt: Date;
    lastTestResult: string;
    lastTestErrorSafe?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(googleCalendarIntegrations)
    .set(result)
    .where(eq(googleCalendarIntegrations.id, id));
}

export async function getGoogleCalendarEventSync(
  boaEventType: BoaGoogleEventType,
  boaEventId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarEventSyncs)
    .where(
      and(
        eq(googleCalendarEventSyncs.boaEventType, boaEventType),
        eq(googleCalendarEventSyncs.boaEventId, boaEventId)
      )
    )
    .limit(1);
  return rows[0];
}

export async function upsertGoogleCalendarEventSync(
  input: InsertGoogleCalendarEventSync & { updatedBy?: number }
) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await getGoogleCalendarEventSync(
    input.boaEventType,
    input.boaEventId
  );
  if (existing) {
    await db
      .update(googleCalendarEventSyncs)
      .set({
        googleCalendarId: input.googleCalendarId,
        googleEventId: input.googleEventId ?? existing.googleEventId,
        calendarType: input.calendarType,
        syncStatus: input.syncStatus ?? existing.syncStatus,
        lastSyncedAt: input.lastSyncedAt ?? existing.lastSyncedAt,
        lastErrorCode: input.lastErrorCode ?? null,
        lastErrorMessageSafe: input.lastErrorMessageSafe ?? null,
        retryCount: input.retryCount ?? existing.retryCount,
        ownerUserId: input.ownerUserId ?? existing.ownerUserId,
        updatedBy: input.updatedBy ?? existing.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarEventSyncs.id, existing.id));
    return existing.id;
  }
  const inserted = await db.insert(googleCalendarEventSyncs).values(input);
  return inserted[0].insertId;
}

export async function updateGoogleCalendarEventSyncStatus(
  id: number,
  data: Partial<{
    syncStatus: GoogleSyncStatus;
    googleEventId: string | null;
    lastSyncedAt: Date | null;
    lastErrorCode: string | null;
    lastErrorMessageSafe: string | null;
    retryCount: number;
    updatedBy: number;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(googleCalendarEventSyncs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(googleCalendarEventSyncs.id, id));
}

export async function listGoogleCalendarEventSyncs(input?: {
  syncStatus?: GoogleSyncStatus;
  ownerUserIds?: number[];
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (input?.syncStatus) {
    conditions.push(eq(googleCalendarEventSyncs.syncStatus, input.syncStatus));
  }
  if (input?.ownerUserIds?.length) {
    conditions.push(
      inArray(googleCalendarEventSyncs.ownerUserId, input.ownerUserIds)
    );
  }
  const query = db
    .select()
    .from(googleCalendarEventSyncs)
    .orderBy(desc(googleCalendarEventSyncs.updatedAt))
    .limit(input?.limit ?? 100);
  if (conditions.length === 1) {
    return query.where(conditions[0]);
  }
  if (conditions.length > 1) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function listFailedGoogleCalendarEventSyncs(limit = 50) {
  return listGoogleCalendarEventSyncs({ syncStatus: "failed", limit });
}
