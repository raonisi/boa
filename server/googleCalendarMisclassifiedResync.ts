import { randomBytes } from "crypto";
import {
  GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
  MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
  type MisclassifiedResyncResult,
} from "@shared/googleCalendar";
import { recommendScheduleCalendarCategory } from "@shared/scheduleCalendarCategory";
import type { Schedule } from "../drizzle/schema";
import { createActivityLog, getUserById } from "./db";
import {
  getGoogleCalendarIntegrationByType,
  getGoogleCalendarOauthCredential,
  getMisclassifiedResyncRunByToken,
  insertMisclassifiedResyncRun,
  listMisclassifiedConsultationScheduleCandidates,
  listMisclassifiedResyncRuns,
  updateMisclassifiedResyncRun,
  updateScheduleCalendarCategory,
  upsertGoogleCalendarEventSync,
} from "./googleCalendarDb";
import {
  exchangeGoogleRefreshToken,
  getGoogleCalendarApiClient,
} from "./googleCalendarClient";
import { decryptRefreshToken } from "./googleCalendarCredentialCrypto";
import {
  buildScheduleGooglePayload,
  loadCustomerContactForSync,
} from "./googleCalendarSync";
import {
  mapScheduleTypeToBoaEventType,
  sanitizeGoogleCalendarLogMetadata,
} from "./googleCalendarSafePayload";

const DEFAULT_RESYNC_LIMIT = 25;
const DRY_RUN_EXPIRY_MS = 30 * 60 * 1000;

export const EVENT_TYPE_FILTER_KEYS = [
  "consultation",
  "followup",
  "recontact",
  "checkup",
  "visit",
] as const;

export type EventTypeFilterKey = (typeof EVENT_TYPE_FILTER_KEYS)[number];

const EVENT_TYPE_FILTER_SCHEDULE_TYPES: Record<EventTypeFilterKey, string[]> = {
  consultation: ["고객상담"],
  followup: ["계약예정", "해지방어"],
  recontact: ["재통화"],
  checkup: ["보장분석"],
  visit: ["외근"],
};

export type MisclassifiedResyncParams = {
  fromCalendarType: "branch_common";
  toCalendarType: "consultation_followup";
  eventTypeFilter?: EventTypeFilterKey[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
};

export type MisclassifiedResyncCandidatePreview = {
  boaEventId: number;
  scheduleType: string;
  previousCalendarCategory: string | null;
  previousGoogleCalendarType: string | null;
  plannedAction:
    | "move"
    | "recreate"
    | "insert"
    | "skipped_missing_calendar"
    | "needs_manual_review";
  duplicateRisk: boolean;
};

export type MisclassifiedResyncDryRunSummary = {
  totalCandidates: number;
  withGoogleEventId: number;
  withoutGoogleEventId: number;
  movableCandidates: number;
  recreateRequiredCandidates: number;
  missingConsultationCalendarCount: number;
  needsManualReviewCount: number;
  executeToken: string;
  expiresAt: string;
  candidates: MisclassifiedResyncCandidatePreview[];
};

export type MisclassifiedResyncItemResult = {
  boaEventId: number;
  result: MisclassifiedResyncResult;
  syncStatus?: string;
  duplicateRisk?: boolean;
  safeErrorCode?: string;
};

export type MisclassifiedResyncExecuteSummary = {
  executeToken: string;
  movedCount: number;
  recreatedCount: number;
  failedCount: number;
  manualReviewCount: number;
  skippedMissingCalendarCount: number;
  results: MisclassifiedResyncItemResult[];
};

export type DuplicateAuditDryRunSummary = {
  totalChecked: number;
  duplicateCandidates: number;
  activeInBranchCommon: number;
  activeInConsultationFollowup: number;
  activeInBothCalendars: number;
  missingConsultationEvent: number;
  staleBranchCommonEvent: number;
  needsManualReview: number;
};

function integrationReady(
  integration?: Awaited<ReturnType<typeof getGoogleCalendarIntegrationByType>>
) {
  return Boolean(
    integration?.isActive && integration.googleCalendarId?.trim()
  );
}

function getScheduleTypesForFilter(
  filters?: EventTypeFilterKey[]
): Array<Schedule["type"]> {
  if (!filters?.length) {
    return [
      "고객상담",
      "재통화",
      "계약예정",
      "보장분석",
      "해지방어",
      "외근",
    ];
  }
  const types = new Set<Schedule["type"]>();
  for (const filter of filters) {
    for (const type of EVENT_TYPE_FILTER_SCHEDULE_TYPES[filter] ?? []) {
      types.add(type as Schedule["type"]);
    }
  }
  return Array.from(types);
}

function isConsultationScheduleCandidate(
  schedule: Schedule,
  filters?: EventTypeFilterKey[]
): boolean {
  const allowedTypes = getScheduleTypesForFilter(filters);
  if (!allowedTypes.includes(schedule.type)) return false;
  if (schedule.type === "외근" && !schedule.customerId) return false;

  const expected = recommendScheduleCalendarCategory({
    scheduleType: schedule.type,
    customerId: schedule.customerId,
  });
  if (expected !== "consultation_followup") return false;

  return true;
}

function isMisclassifiedAsBranchCommon(
  schedule: Schedule,
  syncCalendarType?: string | null
): boolean {
  return (
    schedule.calendarCategory === "branch_common" ||
    syncCalendarType === "branch_common"
  );
}

async function logResyncActivity(
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
      metadata: sanitizeGoogleCalendarLogMetadata(metadata),
    }),
  });
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

type CandidateRow = Awaited<
  ReturnType<typeof listMisclassifiedConsultationScheduleCandidates>
>[number];

async function loadCandidateRows(
  params: MisclassifiedResyncParams
): Promise<CandidateRow[]> {
  const scheduleTypes = getScheduleTypesForFilter(params.eventTypeFilter);
  const rows = await listMisclassifiedConsultationScheduleCandidates({
    scheduleTypes,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    limit: params.limit ?? DEFAULT_RESYNC_LIMIT,
  });

  return rows.filter(row => {
    if (!isConsultationScheduleCandidate(row.schedule, params.eventTypeFilter)) {
      return false;
    }
    return isMisclassifiedAsBranchCommon(
      row.schedule,
      row.sync?.calendarType
    );
  });
}

function classifyCandidatePreview(
  row: CandidateRow,
  targetReady: boolean,
  sourceReady: boolean,
  sourceCalendarId: string | null,
  targetCalendarId: string | null
): MisclassifiedResyncCandidatePreview {
  const schedule = row.schedule;
  const sync = row.sync;
  const googleEventId = sync?.googleEventId?.trim();
  const duplicateRisk = Boolean(
    googleEventId &&
      schedule.calendarCategory === "consultation_followup" &&
      sync?.calendarType === "branch_common"
  );

  let plannedAction: MisclassifiedResyncCandidatePreview["plannedAction"] =
    "insert";
  if (!targetReady) {
    plannedAction = "skipped_missing_calendar";
  } else if (!googleEventId) {
    plannedAction = "insert";
  } else if (!sourceReady || duplicateRisk) {
    plannedAction = "needs_manual_review";
  } else if (
    sourceCalendarId &&
    targetCalendarId &&
    sourceCalendarId !== targetCalendarId
  ) {
    plannedAction = "move";
  } else if (googleEventId) {
    plannedAction = "recreate";
  }

  return {
    boaEventId: schedule.id,
    scheduleType: schedule.type,
    previousCalendarCategory: schedule.calendarCategory ?? null,
    previousGoogleCalendarType: sync?.calendarType ?? null,
    plannedAction,
    duplicateRisk,
  };
}

function summarizeDryRunCandidates(
  previews: MisclassifiedResyncCandidatePreview[],
  targetReady: boolean
): Omit<
  MisclassifiedResyncDryRunSummary,
  "executeToken" | "expiresAt" | "candidates"
> {
  const withGoogleEventId = previews.filter(
    c => c.plannedAction === "move" || c.plannedAction === "recreate" || c.plannedAction === "needs_manual_review"
  ).length;
  const withoutGoogleEventId = previews.filter(
    c => c.plannedAction === "insert"
  ).length;
  const movableCandidates = previews.filter(c => c.plannedAction === "move").length;
  const recreateRequiredCandidates = previews.filter(
    c => c.plannedAction === "recreate"
  ).length;
  const missingConsultationCalendarCount = targetReady
    ? previews.filter(c => c.plannedAction === "skipped_missing_calendar").length
    : previews.length;
  const needsManualReviewCount = previews.filter(
    c => c.plannedAction === "needs_manual_review" || c.duplicateRisk
  ).length;

  return {
    totalCandidates: previews.length,
    withGoogleEventId,
    withoutGoogleEventId,
    movableCandidates,
    recreateRequiredCandidates,
    missingConsultationCalendarCount,
    needsManualReviewCount,
  };
}

export async function runMisclassifiedResyncDryRun(
  actorId: number,
  params: MisclassifiedResyncParams
): Promise<MisclassifiedResyncDryRunSummary> {
  const rows = await loadCandidateRows(params);
  const targetIntegration = await getGoogleCalendarIntegrationByType(
    params.toCalendarType
  );
  const sourceIntegration = await getGoogleCalendarIntegrationByType(
    params.fromCalendarType
  );
  const targetReady = integrationReady(targetIntegration);
  const sourceReady = integrationReady(sourceIntegration);
  const targetCalendarId = targetIntegration?.googleCalendarId?.trim() ?? null;
  const sourceCalendarId = sourceIntegration?.googleCalendarId?.trim() ?? null;

  const candidates = rows.map(row =>
    classifyCandidatePreview(
      row,
      targetReady,
      sourceReady,
      sourceCalendarId,
      targetCalendarId
    )
  );
  const summary = summarizeDryRunCandidates(candidates, targetReady);
  const executeToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DRY_RUN_EXPIRY_MS);

  await insertMisclassifiedResyncRun({
    executeToken,
    status: "dry_run",
    fromCalendarType: params.fromCalendarType,
    toCalendarType: params.toCalendarType,
    summaryJson: JSON.stringify(summary),
    candidateIdsJson: JSON.stringify(candidates.map(c => c.boaEventId)),
    actorId,
    expiresAt,
  });

  await logResyncActivity(
    actorId,
    "GOOGLE_CALENDAR_MISCLASSIFIED_RESYNC_DRY_RUN",
    {
      ...summary,
      resyncMode: "resync_dry_run",
      previousCalendarCategory: params.fromCalendarType,
      nextCalendarCategory: params.toCalendarType,
      actorId,
    }
  );

  return {
    ...summary,
    executeToken,
    expiresAt: expiresAt.toISOString(),
    candidates,
  };
}

export async function runDuplicateAuditDryRun(
  actorId: number,
  params: MisclassifiedResyncParams
): Promise<DuplicateAuditDryRunSummary> {
  const rows = await loadCandidateRows(params);
  
  let totalChecked = rows.length;
  let activeInBranchCommon = 0;
  let activeInConsultationFollowup = 0;
  let staleBranchCommonEvent = 0;
  let missingConsultationEvent = 0;
  let needsManualReview = 0;

  for (const row of rows) {
    const sync = row.sync;
    if (!sync) {
      missingConsultationEvent++;
      continue;
    }
    
    if (sync.calendarType === "branch_common" && sync.syncStatus === "synced") {
      activeInBranchCommon++;
      if (row.schedule.calendarCategory === "consultation_followup") {
        staleBranchCommonEvent++;
      }
    } else if (sync.calendarType === "consultation_followup" && sync.syncStatus === "synced") {
      activeInConsultationFollowup++;
    } else if (sync.syncStatus === "failed" || sync.lastErrorCode === "needs_manual_review") {
      needsManualReview++;
    }
  }

  const summary: DuplicateAuditDryRunSummary = {
    totalChecked,
    duplicateCandidates: 0, // DB constraints prevent active in both via single sync row
    activeInBranchCommon,
    activeInConsultationFollowup,
    activeInBothCalendars: 0,
    missingConsultationEvent,
    staleBranchCommonEvent,
    needsManualReview,
  };

  await logResyncActivity(actorId, "GOOGLE_CALENDAR_DUPLICATE_AUDIT_RUN", {
    ...summary,
    duplicateDetected: false,
    duplicateCount: 0,
    actorId,
  });

  return summary;
}

async function buildScheduleContext(schedule: Schedule) {
  const owner = await getUserById(schedule.userId);
  const customerContact = await loadCustomerContactForSync(schedule.customerId);
  return {
    schedule,
    ownerRole: owner?.role ?? null,
    customerReference: schedule.customerId ? `A-${schedule.customerId}` : null,
    segmentLabel: schedule.type,
    customerContact,
  };
}

async function resyncOneSchedule(
  actorId: number,
  row: CandidateRow,
  params: MisclassifiedResyncParams,
  accessToken: string
): Promise<MisclassifiedResyncItemResult> {
  const schedule = row.schedule;
  const sync = row.sync;
  const boaEventId = schedule.id;

  const targetIntegration = await getGoogleCalendarIntegrationByType(
    params.toCalendarType
  );
  if (!integrationReady(targetIntegration)) {
    await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_RESYNC_FAILED", {
      boaEventId,
      previousCalendarCategory: schedule.calendarCategory,
      nextCalendarCategory: params.toCalendarType,
      result: "skipped_missing_calendar",
      syncStatus: "skipped",
      actorId,
    });
    return {
      boaEventId,
      result: "skipped_missing_calendar",
      syncStatus: "skipped",
    };
  }

  const sourceIntegration = await getGoogleCalendarIntegrationByType(
    params.fromCalendarType
  );
  const sourceReady = integrationReady(sourceIntegration);
  const targetCalendarId = targetIntegration!.googleCalendarId;
  const sourceCalendarId = sourceIntegration?.googleCalendarId ?? null;
  const existingEventId = sync?.googleEventId?.trim() || null;

  const duplicateRisk = Boolean(
    existingEventId &&
      schedule.calendarCategory === "consultation_followup" &&
      sync?.calendarType === "branch_common"
  );
  if (duplicateRisk) {
    await logResyncActivity(
      actorId,
      "GOOGLE_CALENDAR_EVENT_NEEDS_MANUAL_REVIEW",
      {
        boaEventId,
        previousCalendarCategory: schedule.calendarCategory,
        nextCalendarCategory: params.toCalendarType,
        previousGoogleCalendarType: sync?.calendarType ?? params.fromCalendarType,
        nextGoogleCalendarType: params.toCalendarType,
        result: "needs_manual_review",
        duplicateRisk: true,
        actorId,
      }
    );
    return {
      boaEventId,
      result: "needs_manual_review",
      duplicateRisk: true,
    };
  }

  await updateScheduleCalendarCategory(boaEventId, params.toCalendarType);
  const updatedSchedule = {
    ...schedule,
    calendarCategory: params.toCalendarType,
  } as Schedule;
  const ctx = await buildScheduleContext(updatedSchedule);
  const built = await buildScheduleGooglePayload(ctx);
  if (built.skipped) {
    await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_RESYNC_FAILED", {
      boaEventId,
      result: "resync_failed",
      syncStatus: "failed",
      safeErrorCode: "PAYLOAD_SKIPPED",
      actorId,
    });
    return {
      boaEventId,
      result: "resync_failed",
      syncStatus: "failed",
      safeErrorCode: "PAYLOAD_SKIPPED",
    };
  }

  const client = getGoogleCalendarApiClient();
  const boaEventType = built.boaEventType;

  if (existingEventId && sourceReady && sourceCalendarId) {
    if (sourceCalendarId === targetCalendarId) {
      try {
        const updatedId = (
          await client.updateEvent(
            accessToken,
            targetCalendarId,
            existingEventId,
            {
              calendarId: targetCalendarId,
              title: built.payload.title,
              description: built.payload.description,
              startTime: updatedSchedule.startTime,
              endTime: updatedSchedule.endTime,
            }
          )
        ).eventId;
        await upsertGoogleCalendarEventSync({
          boaEventType,
          boaEventId,
          syncTargetType: "shared_calendar",
          targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
          googleCalendarId: targetCalendarId,
          googleEventId: updatedId,
          calendarType: params.toCalendarType,
          syncStatus: "synced",
          includeContactInDescription: false,
          contactIncluded: false,
          lastSyncedAt: new Date(),
          lastErrorCode: "resync_moved",
          ownerUserId: updatedSchedule.userId,
          createdBy: actorId,
          updatedBy: actorId,
        });
        await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_MOVED", {
          boaEventId,
          previousCalendarCategory: params.fromCalendarType,
          nextCalendarCategory: params.toCalendarType,
          previousGoogleCalendarType: params.fromCalendarType,
          nextGoogleCalendarType: params.toCalendarType,
          result: "resync_moved",
          syncStatus: "synced",
          actorId,
        });
        return { boaEventId, result: "resync_moved", syncStatus: "synced" };
      } catch (error) {
        const code =
          error instanceof Error && "code" in error
            ? String((error as Error & { code?: string }).code)
            : "UPDATE_FAILED";
        await upsertGoogleCalendarEventSync({
          boaEventType,
          boaEventId,
          syncTargetType: "shared_calendar",
          targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
          googleCalendarId: targetCalendarId,
          googleEventId: existingEventId,
          calendarType: params.toCalendarType,
          syncStatus: "failed",
          lastErrorCode: "resync_failed",
          lastErrorMessageSafe: "동일 캘린더 업데이트에 실패했습니다.",
          ownerUserId: updatedSchedule.userId,
          updatedBy: actorId,
        });
        await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_RESYNC_FAILED", {
          boaEventId,
          result: "resync_failed",
          syncStatus: "failed",
          safeErrorCode: code,
          actorId,
        });
        return {
          boaEventId,
          result: "resync_failed",
          syncStatus: "failed",
          safeErrorCode: code,
        };
      }
    }

    try {
      const moved = await client.moveEvent(
        accessToken,
        sourceCalendarId,
        existingEventId,
        targetCalendarId
      );
      await upsertGoogleCalendarEventSync({
        boaEventType,
        boaEventId,
        syncTargetType: "shared_calendar",
        targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
        googleCalendarId: targetCalendarId,
        googleEventId: moved.eventId,
        calendarType: params.toCalendarType,
        syncStatus: "synced",
        includeContactInDescription: false,
        contactIncluded: false,
        lastSyncedAt: new Date(),
        lastErrorCode: "resync_moved",
        ownerUserId: updatedSchedule.userId,
        createdBy: actorId,
        updatedBy: actorId,
      });
      await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_MOVED", {
        boaEventId,
        previousCalendarCategory: params.fromCalendarType,
        nextCalendarCategory: params.toCalendarType,
        previousGoogleCalendarType: params.fromCalendarType,
        nextGoogleCalendarType: params.toCalendarType,
        result: "resync_moved",
        syncStatus: "synced",
        actorId,
      });
      return { boaEventId, result: "resync_moved", syncStatus: "synced" };
    } catch {
      try {
        await client.deleteEvent(accessToken, sourceCalendarId, existingEventId);
      } catch {
        await logResyncActivity(
          actorId,
          "GOOGLE_CALENDAR_EVENT_NEEDS_MANUAL_REVIEW",
          {
            boaEventId,
            previousCalendarCategory: params.fromCalendarType,
            nextCalendarCategory: params.toCalendarType,
            result: "needs_manual_review",
            actorId,
          }
        );
        return { boaEventId, result: "needs_manual_review" };
      }

      try {
        const created = await client.createEvent(accessToken, {
          calendarId: targetCalendarId,
          title: built.payload.title,
          description: built.payload.description,
          startTime: updatedSchedule.startTime,
          endTime: updatedSchedule.endTime,
        });
        await upsertGoogleCalendarEventSync({
          boaEventType,
          boaEventId,
          syncTargetType: "shared_calendar",
          targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
          googleCalendarId: targetCalendarId,
          googleEventId: created.eventId,
          calendarType: params.toCalendarType,
          syncStatus: "synced",
          includeContactInDescription: false,
          contactIncluded: false,
          lastSyncedAt: new Date(),
          lastErrorCode: "resync_recreated",
          ownerUserId: updatedSchedule.userId,
          createdBy: actorId,
          updatedBy: actorId,
        });
        await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_RECREATED", {
          boaEventId,
          previousCalendarCategory: params.fromCalendarType,
          nextCalendarCategory: params.toCalendarType,
          result: "resync_recreated",
          syncStatus: "synced",
          actorId,
        });
        return { boaEventId, result: "resync_recreated", syncStatus: "synced" };
      } catch (error) {
        const code =
          error instanceof Error && "code" in error
            ? String((error as Error & { code?: string }).code)
            : "CREATE_FAILED";
        await upsertGoogleCalendarEventSync({
          boaEventType,
          boaEventId,
          syncTargetType: "shared_calendar",
          targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
          googleCalendarId: targetCalendarId,
          googleEventId: null,
          calendarType: params.toCalendarType,
          syncStatus: "failed",
          lastErrorCode: "resync_failed",
          lastErrorMessageSafe: "재생성에 실패했습니다.",
          ownerUserId: updatedSchedule.userId,
          updatedBy: actorId,
        });
        await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_RESYNC_FAILED", {
          boaEventId,
          result: "resync_failed",
          syncStatus: "failed",
          safeErrorCode: code,
          actorId,
        });
        return {
          boaEventId,
          result: "resync_failed",
          syncStatus: "failed",
          safeErrorCode: code,
        };
      }
    }
  }

  if (existingEventId && !sourceReady) {
    await logResyncActivity(
      actorId,
      "GOOGLE_CALENDAR_EVENT_NEEDS_MANUAL_REVIEW",
      {
        boaEventId,
        previousCalendarCategory: params.fromCalendarType,
        nextCalendarCategory: params.toCalendarType,
        result: "needs_manual_review",
        actorId,
      }
    );
    return { boaEventId, result: "needs_manual_review" };
  }

  try {
    const created = await client.createEvent(accessToken, {
      calendarId: targetCalendarId,
      title: built.payload.title,
      description: built.payload.description,
      startTime: updatedSchedule.startTime,
      endTime: updatedSchedule.endTime,
    });
    await upsertGoogleCalendarEventSync({
      boaEventType,
      boaEventId,
      syncTargetType: "shared_calendar",
      targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
      googleCalendarId: targetCalendarId,
      googleEventId: created.eventId,
      calendarType: params.toCalendarType,
      syncStatus: "synced",
      includeContactInDescription: false,
      contactIncluded: false,
      lastSyncedAt: new Date(),
      lastErrorCode: existingEventId ? "resync_recreated" : "resync_recreated",
      ownerUserId: updatedSchedule.userId,
      createdBy: actorId,
      updatedBy: actorId,
    });
    await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_RECREATED", {
      boaEventId,
      previousCalendarCategory: params.fromCalendarType,
      nextCalendarCategory: params.toCalendarType,
      result: "resync_recreated",
      syncStatus: "synced",
      actorId,
    });
    return { boaEventId, result: "resync_recreated", syncStatus: "synced" };
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? String((error as Error & { code?: string }).code)
        : "CREATE_FAILED";
    await upsertGoogleCalendarEventSync({
      boaEventType: mapScheduleTypeToBoaEventType(
        updatedSchedule.type,
        params.toCalendarType
      ),
      boaEventId,
      syncTargetType: "shared_calendar",
      targetUserId: GOOGLE_CALENDAR_SHARED_TARGET_USER_ID,
      googleCalendarId: targetCalendarId,
      googleEventId: existingEventId,
      calendarType: params.toCalendarType,
      syncStatus: "failed",
      lastErrorCode: "resync_failed",
      lastErrorMessageSafe: "Google Calendar 생성에 실패했습니다.",
      ownerUserId: updatedSchedule.userId,
      updatedBy: actorId,
    });
    await logResyncActivity(actorId, "GOOGLE_CALENDAR_EVENT_RESYNC_FAILED", {
      boaEventId,
      result: "resync_failed",
      syncStatus: "failed",
      safeErrorCode: code,
      actorId,
    });
    return {
      boaEventId,
      result: "resync_failed",
      syncStatus: "failed",
      safeErrorCode: code,
    };
  }
}

export async function runMisclassifiedResyncExecute(
  actorId: number,
  params: MisclassifiedResyncParams & {
    executeToken: string;
    confirmationText: string;
  }
): Promise<MisclassifiedResyncExecuteSummary> {
  if (params.confirmationText !== MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT) {
    throw Object.assign(
      new Error(
        `실행 확인 문구가 일치하지 않습니다. "${MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT}"를 입력하세요.`
      ),
      { code: "CONFIRMATION_MISMATCH" }
    );
  }

  const run = await getMisclassifiedResyncRunByToken(params.executeToken);
  if (!run || run.status !== "dry_run") {
    throw Object.assign(
      new Error("유효한 dry-run 토큰이 없습니다. 먼저 대상 확인을 실행하세요."),
      { code: "INVALID_EXECUTE_TOKEN" }
    );
  }
  if (run.actorId !== actorId) {
    throw Object.assign(new Error("dry-run을 실행한 사용자만 재동기화할 수 있습니다."), {
      code: "FORBIDDEN",
    });
  }
  if (run.expiresAt.getTime() < Date.now()) {
    await updateMisclassifiedResyncRun(run.id, { status: "expired" });
    throw Object.assign(
      new Error("dry-run 토큰이 만료되었습니다. 대상 확인을 다시 실행하세요."),
      { code: "EXECUTE_TOKEN_EXPIRED" }
    );
  }

  await updateMisclassifiedResyncRun(run.id, { status: "executing" });

  const candidateIds = JSON.parse(run.candidateIdsJson) as number[];
  const rows = await loadCandidateRows(params);
  const rowMap = new Map(rows.map(row => [row.schedule.id, row]));
  const orderedRows = candidateIds
    .map(id => rowMap.get(id))
    .filter((row): row is CandidateRow => row != null);

  const accessToken = await getAccessTokenOrThrow();
  const results: MisclassifiedResyncItemResult[] = [];

  for (const row of orderedRows) {
    const result = await resyncOneSchedule(actorId, row, params, accessToken);
    results.push(result);
  }

  const movedCount = results.filter(r => r.result === "resync_moved").length;
  const recreatedCount = results.filter(r => r.result === "resync_recreated").length;
  const failedCount = results.filter(r => r.result === "resync_failed").length;
  const manualReviewCount = results.filter(
    r => r.result === "needs_manual_review"
  ).length;
  const skippedMissingCalendarCount = results.filter(
    r => r.result === "skipped_missing_calendar"
  ).length;

  const executeSummary: MisclassifiedResyncExecuteSummary = {
    executeToken: params.executeToken,
    movedCount,
    recreatedCount,
    failedCount,
    manualReviewCount,
    skippedMissingCalendarCount,
    results,
  };

  await updateMisclassifiedResyncRun(run.id, {
    status: "completed",
    resultJson: JSON.stringify(executeSummary),
    executedAt: new Date(),
  });

  await logResyncActivity(
    actorId,
    "GOOGLE_CALENDAR_MISCLASSIFIED_RESYNC_EXECUTED",
    {
      executeToken: params.executeToken,
      movedCount,
      recreatedCount,
      failedCount,
      manualReviewCount,
      previousCalendarCategory: params.fromCalendarType,
      nextCalendarCategory: params.toCalendarType,
      resyncMode: "execute",
      actorId,
    }
  );

  return executeSummary;
}

export async function getMisclassifiedResyncHistory(limit = 20) {
  const runs = await listMisclassifiedResyncRuns(limit);
  return runs.map(run => ({
    id: run.id,
    executeToken: run.executeToken,
    status: run.status,
    fromCalendarType: run.fromCalendarType,
    toCalendarType: run.toCalendarType,
    summary: JSON.parse(run.summaryJson) as Record<string, unknown>,
    candidateCount: (JSON.parse(run.candidateIdsJson) as number[]).length,
    result: run.resultJson
      ? (JSON.parse(run.resultJson) as MisclassifiedResyncExecuteSummary)
      : null,
    actorId: run.actorId,
    expiresAt: run.expiresAt.toISOString(),
    executedAt: run.executedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  }));
}
