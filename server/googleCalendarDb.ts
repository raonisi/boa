import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import {
  ORGANIZATION_SCOPE_DEFAULT,
  GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
  type GoogleCalendarType,
  type GoogleSyncStatus,
  type GoogleSyncTargetType,
  type BoaGoogleEventType,
} from "@shared/googleCalendar";
import {
  googleCalendarEventSyncs,
  googleCalendarIntegrations,
  googleCalendarMisclassifiedResyncRuns,
  googleCalendarOauthCredentials,
  googleCalendarOrgSettings,
  googleCalendarPersonalSettings,
  schedules,
  type InsertGoogleCalendarEventSync,
  type InsertGoogleCalendarIntegration,
  type InsertGoogleCalendarMisclassifiedResyncRun,
  type InsertGoogleCalendarPersonalSettings,
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

export async function getGoogleCalendarOrgSettings(
  organizationScope = ORGANIZATION_SCOPE_DEFAULT
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarOrgSettings)
    .where(eq(googleCalendarOrgSettings.organizationScope, organizationScope))
    .limit(1);
  return rows[0];
}

export async function upsertGoogleCalendarOrgSettings(input: {
  organizationScope?: number;
  updatedBy: number;
  includeCustomerContactForActorCalendar?: boolean;
  syncRawTitleToGoogleCalendar?: boolean;
  syncRawDescriptionToGoogleCalendar?: boolean;
  allowCustomerNameInGoogleCalendar?: boolean;
  allowCustomerContactInGoogleCalendar?: boolean;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const organizationScope =
    input.organizationScope ?? ORGANIZATION_SCOPE_DEFAULT;
  const existing = await getGoogleCalendarOrgSettings(organizationScope);
  const merged = {
    includeCustomerContactForActorCalendar:
      input.includeCustomerContactForActorCalendar ??
      existing?.includeCustomerContactForActorCalendar ??
      false,
    syncRawTitleToGoogleCalendar:
      input.syncRawTitleToGoogleCalendar ??
      existing?.syncRawTitleToGoogleCalendar ??
      false,
    syncRawDescriptionToGoogleCalendar:
      input.syncRawDescriptionToGoogleCalendar ??
      existing?.syncRawDescriptionToGoogleCalendar ??
      false,
    allowCustomerNameInGoogleCalendar:
      input.allowCustomerNameInGoogleCalendar ??
      existing?.allowCustomerNameInGoogleCalendar ??
      false,
    allowCustomerContactInGoogleCalendar:
      input.allowCustomerContactInGoogleCalendar ??
      existing?.allowCustomerContactInGoogleCalendar ??
      false,
  };
  if (existing) {
    await db
      .update(googleCalendarOrgSettings)
      .set({
        ...merged,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarOrgSettings.id, existing.id));
    return existing.id;
  }
  const inserted = await db.insert(googleCalendarOrgSettings).values({
    organizationScope,
    ...merged,
    updatedBy: input.updatedBy,
  });
  return inserted[0].insertId;
}

export async function getGoogleCalendarPersonalSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarPersonalSettings)
    .where(eq(googleCalendarPersonalSettings.userId, userId))
    .limit(1);
  return rows[0];
}

export async function upsertGoogleCalendarPersonalSettings(
  input: InsertGoogleCalendarPersonalSettings
) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await getGoogleCalendarPersonalSettings(input.userId);
  if (existing) {
    await db
      .update(googleCalendarPersonalSettings)
      .set({
        personalCalendarId:
          input.personalCalendarId ?? existing.personalCalendarId,
        contactDisplayConsent:
          input.contactDisplayConsent ?? existing.contactDisplayConsent,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarPersonalSettings.id, existing.id));
    return existing.id;
  }
  const inserted = await db
    .insert(googleCalendarPersonalSettings)
    .values(input);
  return inserted[0].insertId;
}

export async function getGoogleCalendarEventSync(
  boaEventType: BoaGoogleEventType,
  boaEventId: number,
  syncTargetType: GoogleSyncTargetType = "shared_calendar",
  targetUserId = GOOGLE_CALENDAR_SHARED_TARGET_USER_ID
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarEventSyncs)
    .where(
      and(
        eq(googleCalendarEventSyncs.boaEventType, boaEventType),
        eq(googleCalendarEventSyncs.boaEventId, boaEventId),
        eq(googleCalendarEventSyncs.syncTargetType, syncTargetType),
        eq(googleCalendarEventSyncs.targetUserId, targetUserId)
      )
    )
    .limit(1);
  return rows[0];
}

export async function listGoogleCalendarEventSyncsForBoaEvent(
  boaEventType: BoaGoogleEventType,
  boaEventId: number
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(googleCalendarEventSyncs)
    .where(
      and(
        eq(googleCalendarEventSyncs.boaEventType, boaEventType),
        eq(googleCalendarEventSyncs.boaEventId, boaEventId)
      )
    );
}

export async function upsertGoogleCalendarEventSync(
  input: InsertGoogleCalendarEventSync & { updatedBy?: number }
) {
  const db = await getDb();
  if (!db) return undefined;
  const syncTargetType = input.syncTargetType ?? "shared_calendar";
  const targetUserId =
    input.targetUserId ?? GOOGLE_CALENDAR_SHARED_TARGET_USER_ID;
  const existing = await getGoogleCalendarEventSync(
    input.boaEventType,
    input.boaEventId,
    syncTargetType,
    targetUserId
  );
  if (existing) {
    await db
      .update(googleCalendarEventSyncs)
      .set({
        googleCalendarId: input.googleCalendarId,
        googleEventId: input.googleEventId ?? existing.googleEventId,
        calendarType: input.calendarType,
        syncStatus: input.syncStatus ?? existing.syncStatus,
        includeContactInDescription:
          input.includeContactInDescription ??
          existing.includeContactInDescription,
        contactIncluded: input.contactIncluded ?? existing.contactIncluded,
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
  const inserted = await db.insert(googleCalendarEventSyncs).values({
    ...input,
    syncTargetType,
    targetUserId,
  });
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

export async function listMisclassifiedConsultationScheduleCandidates(input: {
  scheduleTypes: Array<typeof schedules.$inferSelect.type>;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(schedules.isActive, true),
    inArray(schedules.type, input.scheduleTypes),
    or(
      eq(schedules.calendarCategory, "branch_common"),
      eq(googleCalendarEventSyncs.calendarType, "branch_common")
    ),
  ];
  if (input.dateFrom) {
    conditions.push(gte(schedules.startTime, input.dateFrom));
  }
  if (input.dateTo) {
    conditions.push(lte(schedules.startTime, input.dateTo));
  }
  return db
    .select({
      schedule: schedules,
      sync: googleCalendarEventSyncs,
    })
    .from(schedules)
    .leftJoin(
      googleCalendarEventSyncs,
      and(
        eq(googleCalendarEventSyncs.boaEventId, schedules.id),
        eq(googleCalendarEventSyncs.syncTargetType, "shared_calendar"),
        eq(
          googleCalendarEventSyncs.targetUserId,
          GOOGLE_CALENDAR_SHARED_TARGET_USER_ID
        )
      )
    )
    .where(and(...conditions))
    .orderBy(desc(schedules.startTime))
    .limit(input.limit ?? 25);
}

export async function updateScheduleCalendarCategory(
  scheduleId: number,
  calendarCategory: "branch_common" | "consultation_followup" | "admin"
) {
  const db = await getDb();
  if (!db) return false;
  await db
    .update(schedules)
    .set({ calendarCategory, updatedAt: new Date() })
    .where(eq(schedules.id, scheduleId));
  return true;
}

export async function insertMisclassifiedResyncRun(
  input: InsertGoogleCalendarMisclassifiedResyncRun
) {
  const db = await getDb();
  if (!db) return undefined;
  const inserted = await db
    .insert(googleCalendarMisclassifiedResyncRuns)
    .values(input);
  return inserted[0].insertId;
}

export async function getMisclassifiedResyncRunByToken(executeToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleCalendarMisclassifiedResyncRuns)
    .where(eq(googleCalendarMisclassifiedResyncRuns.executeToken, executeToken))
    .limit(1);
  return rows[0];
}

export async function updateMisclassifiedResyncRun(
  id: number,
  data: Partial<{
    status: "dry_run" | "executing" | "completed" | "expired";
    resultJson: string | null;
    executedAt: Date | null;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(googleCalendarMisclassifiedResyncRuns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(googleCalendarMisclassifiedResyncRuns.id, id));
}

export async function listMisclassifiedResyncRuns(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(googleCalendarMisclassifiedResyncRuns)
    .orderBy(desc(googleCalendarMisclassifiedResyncRuns.createdAt))
    .limit(limit);
}
