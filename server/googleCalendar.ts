import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  GOOGLE_CALENDAR_TYPES,
  GOOGLE_CALENDAR_TYPE_LABELS,
  type BoaGoogleEventType,
} from "@shared/googleCalendar";
import {
  activeUserProcedure,
  branchAdminProcedure,
  teamLeaderOrAboveProcedure,
} from "./_core/procedures";
import { router } from "./_core/trpc";
import { buildGoogleCalendarOAuthAuthorizeUrl } from "./_core/oauth";
import { issueOAuthState } from "./_core/oauthState";
import { createActivityLog, getScheduleById, getUserById } from "./db";
import {
  disableGoogleCalendarIntegration,
  getGoogleCalendarEventSync,
  getGoogleCalendarIntegrationByType,
  getGoogleCalendarOrgSettings,
  listFailedGoogleCalendarEventSyncs,
  listGoogleCalendarEventSyncs,
  listGoogleCalendarEventSyncsForBoaEvent,
  listGoogleCalendarIntegrations,
  updateGoogleCalendarIntegrationTestResult,
  upsertGoogleCalendarIntegration,
  upsertGoogleCalendarOrgSettings,
  upsertGoogleCalendarPersonalSettings,
} from "./googleCalendarDb";
import {
  buildScheduleGooglePayload,
  deleteGoogleCalendarEventForBoaEvent,
  getGoogleCalendarSettingsSummary,
  loadCustomerContactForSync,
  retryFailedGoogleCalendarSync,
  syncScheduleToGoogleCalendar,
  testGoogleCalendarAccessForIntegration,
} from "./googleCalendarSync";
import {
  assertGoogleCalendarPayloadPolicy,
  assertSafeGoogleCalendarEventPayload,
  buildGoogleCalendarDescription,
  buildGoogleCalendarTitle,
  buildSafeGoogleCalendarDescription,
  buildSafeGoogleCalendarTitle,
  findSensitiveCalendarPattern,
  isRawPiiAllowed,
  getCalendarDisplayName,
  mapBoaScheduleToGoogleCalendarType,
  mapScheduleTypeToBoaEventType,
  orgSettingsToPayloadPolicy,
  resolveScheduleGoogleCalendarType,
  sanitizeGoogleCalendarLogMetadata,
} from "./googleCalendarSafePayload";
import {
  EVENT_TYPE_FILTER_KEYS,
  getMisclassifiedResyncHistory,
  runDuplicateAuditDryRun,
  runMisclassifiedResyncDryRun,
  runMisclassifiedResyncExecute,
} from "./googleCalendarMisclassifiedResync";
import { MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT } from "@shared/googleCalendar";

type AppUser = {
  id: number;
  role: string;
  accountStatus: string;
  teamId?: number | null;
  subBranchAdminId?: number | null;
};

async function logGoogleCalendarRouterAction(
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

async function getSyncScopeUserIds(
  user: AppUser
): Promise<number[] | undefined> {
  if (user.role === "branch_admin") return undefined;
  if (user.role === "member") return [user.id];
  const { getHierarchyScopeUserIds } = await import("./routers");
  return (await getHierarchyScopeUserIds(user)) ?? [user.id];
}

async function assertCanAccessSyncRow(
  user: AppUser,
  ownerUserId?: number | null
) {
  if (user.role === "branch_admin") return;
  const scope = await getSyncScopeUserIds(user);
  if (!ownerUserId || !scope?.includes(ownerUserId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 동기화 상태에 접근 권한이 없습니다.",
    });
  }
}

async function loadScheduleSyncContext(
  boaEventType: BoaGoogleEventType,
  boaEventId: number
) {
  if (boaEventType === "follow_up") return null;
  const schedule = await getScheduleById(boaEventId);
  if (!schedule) return null;
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

export const googleCalendarRouter = router({
  getSettings: activeUserProcedure.query(async ({ ctx }) => {
    const summary = await getGoogleCalendarSettingsSummary(ctx.user.id);
    const canManage = ctx.user.role === "branch_admin";
    return { ...summary, canManage };
  }),

  updateContactPolicy: branchAdminProcedure
    .input(
      z.object({
        includeCustomerContactForActorCalendar: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertGoogleCalendarOrgSettings({
        includeCustomerContactForActorCalendar:
          input.includeCustomerContactForActorCalendar,
        updatedBy: ctx.user.id,
      });
      await logGoogleCalendarRouterAction(
        ctx.user.id,
        "GOOGLE_CALENDAR_CONTACT_POLICY_UPDATED",
        {
          actorId: ctx.user.id,
        }
      );
      return { success: true };
    }),

  updateSyncPolicy: branchAdminProcedure
    .input(
      z.object({
        syncRawTitleToGoogleCalendar: z.boolean().optional(),
        syncRawDescriptionToGoogleCalendar: z.boolean().optional(),
        allowCustomerNameInGoogleCalendar: z.boolean().optional(),
        allowCustomerContactInGoogleCalendar: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertGoogleCalendarOrgSettings({
        syncRawTitleToGoogleCalendar: input.syncRawTitleToGoogleCalendar,
        syncRawDescriptionToGoogleCalendar:
          input.syncRawDescriptionToGoogleCalendar,
        allowCustomerNameInGoogleCalendar:
          input.allowCustomerNameInGoogleCalendar,
        allowCustomerContactInGoogleCalendar:
          input.allowCustomerContactInGoogleCalendar,
        updatedBy: ctx.user.id,
      });
      const { getGoogleCalendarOrgSettings } = await import(
        "./googleCalendarDb"
      );
      const orgSettings = await getGoogleCalendarOrgSettings();
      const policyFlags = {
        rawTitleSynced: orgSettings?.syncRawTitleToGoogleCalendar ?? false,
        rawDescriptionSynced:
          orgSettings?.syncRawDescriptionToGoogleCalendar ?? false,
        customerNameAllowed:
          orgSettings?.allowCustomerNameInGoogleCalendar ?? false,
        customerContactAllowed:
          orgSettings?.allowCustomerContactInGoogleCalendar ?? false,
      };
      await logGoogleCalendarRouterAction(
        ctx.user.id,
        "GOOGLE_CALENDAR_SYNC_POLICY_UPDATED",
        {
          actorId: ctx.user.id,
          ...policyFlags,
        }
      );
      return { success: true, ...policyFlags };
    }),

  upsertPersonalSettings: activeUserProcedure
    .input(
      z.object({
        personalCalendarId: z.string().min(3).max(255).optional(),
        contactDisplayConsent: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertGoogleCalendarPersonalSettings({
        userId: ctx.user.id,
        personalCalendarId: input.personalCalendarId?.trim() ?? null,
        contactDisplayConsent: input.contactDisplayConsent ?? false,
        isActive: input.isActive ?? true,
      });
      await logGoogleCalendarRouterAction(
        ctx.user.id,
        "GOOGLE_CALENDAR_PERSONAL_SETTINGS_UPDATED",
        {
          actorId: ctx.user.id,
          contactDisplayConsent: input.contactDisplayConsent ?? false,
          hasPersonalCalendar: Boolean(input.personalCalendarId?.trim()),
        }
      );
      return { success: true };
    }),

  getOAuthConnectUrl: branchAdminProcedure.query(({ ctx }) => {
    const forwardedProto = (
      ctx.req.headers["x-forwarded-proto"] as string | undefined
    )
      ?.split(",")[0]
      ?.trim();
    const forwardedHost = (
      ctx.req.headers["x-forwarded-host"] as string | undefined
    )
      ?.split(",")[0]
      ?.trim();
    const host = forwardedHost ?? ctx.req.headers.host;
    const protocol = forwardedProto ?? ctx.req.protocol;
    const origin = host ? `${protocol}://${host}` : undefined;
    if (!origin) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "요청 origin을 확인할 수 없습니다.",
      });
    }
    const state = issueOAuthState(ctx.req, ctx.res, "google_calendar");
    return { url: buildGoogleCalendarOAuthAuthorizeUrl(origin, state) };
  }),

  upsertCalendarIntegration: branchAdminProcedure
    .input(
      z.object({
        calendarType: z.enum(GOOGLE_CALENDAR_TYPES),
        googleCalendarId: z.string().min(3).max(255),
        displayName: z.string().min(1).max(200).optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const displayName =
        input.displayName ?? GOOGLE_CALENDAR_TYPE_LABELS[input.calendarType];
      const id = await upsertGoogleCalendarIntegration({
        calendarType: input.calendarType,
        googleCalendarId: input.googleCalendarId.trim(),
        displayName,
        isActive: input.isActive,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      await logGoogleCalendarRouterAction(
        ctx.user.id,
        "GOOGLE_CALENDAR_INTEGRATION_UPSERTED",
        {
          calendarType: input.calendarType,
          actorId: ctx.user.id,
          integrationId: id,
        }
      );
      return { success: true, id };
    }),

  disableCalendarIntegration: branchAdminProcedure
    .input(z.object({ calendarType: z.enum(GOOGLE_CALENDAR_TYPES) }))
    .mutation(async ({ ctx, input }) => {
      await disableGoogleCalendarIntegration(input.calendarType, ctx.user.id);
      await logGoogleCalendarRouterAction(
        ctx.user.id,
        "GOOGLE_CALENDAR_INTEGRATION_DISABLED",
        { calendarType: input.calendarType, actorId: ctx.user.id }
      );
      return { success: true };
    }),

  testCalendarAccess: branchAdminProcedure
    .input(
      z.object({
        calendarType: z.enum(GOOGLE_CALENDAR_TYPES),
        googleCalendarId: z.string().min(3).max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integration = (await listGoogleCalendarIntegrations()).find(
        row => row.calendarType === input.calendarType
      );
      const calendarId =
        input.googleCalendarId?.trim() ?? integration?.googleCalendarId;
      if (!calendarId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "테스트할 calendarId가 없습니다.",
        });
      }
      const result = await testGoogleCalendarAccessForIntegration(calendarId);
      if (integration) {
        await updateGoogleCalendarIntegrationTestResult(integration.id, {
          lastTestedAt: new Date(),
          lastTestResult: result.ok ? "success" : "failed",
          lastTestErrorSafe: result.errorMessageSafe ?? null,
        });
      }
      await logGoogleCalendarRouterAction(
        ctx.user.id,
        "GOOGLE_CALENDAR_ACCESS_TESTED",
        {
          calendarType: input.calendarType,
          actorId: ctx.user.id,
          testResult: result.ok ? "success" : "failed",
          safeErrorCode: result.errorCode ?? null,
        }
      );
      return result;
    }),

  syncBoaEventToGoogle: branchAdminProcedure
    .input(
      z.object({
        boaEventType: z.enum([
          "calendar_event",
          "follow_up",
          "consultation",
          "meeting",
          "education",
          "admin",
        ]),
        boaEventId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scheduleCtx = await loadScheduleSyncContext(
        input.boaEventType,
        input.boaEventId
      );
      if (!scheduleCtx) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "동기화할 일정을 찾을 수 없습니다.",
        });
      }
      await syncScheduleToGoogleCalendar(ctx.user, scheduleCtx);
      const sync = await getGoogleCalendarEventSync(
        input.boaEventType,
        input.boaEventId
      );
      return {
        success: sync?.syncStatus === "synced",
        syncStatus: sync?.syncStatus,
      };
    }),

  retryFailedSync: branchAdminProcedure
    .input(z.object({ syncId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const result = await retryFailedGoogleCalendarSync(
        ctx.user,
        input.syncId,
        loadScheduleSyncContext
      );
      return result;
    }),

  listSyncStatus: activeUserProcedure
    .input(
      z
        .object({
          syncStatus: z
            .enum(["pending", "synced", "failed", "deleted", "skipped"])
            .optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const ownerUserIds = await getSyncScopeUserIds(ctx.user);
      const rows = await listGoogleCalendarEventSyncs({
        syncStatus: input?.syncStatus,
        ownerUserIds,
        limit: input?.limit ?? 50,
      });
      return rows.map(row => ({
        id: row.id,
        boaEventType: row.boaEventType,
        boaEventId: row.boaEventId,
        syncTargetType: row.syncTargetType,
        targetUserId: row.targetUserId,
        calendarType: row.calendarType,
        syncStatus: row.syncStatus,
        contactIncluded: row.contactIncluded,
        lastSyncedAt: row.lastSyncedAt,
        lastErrorCode: row.lastErrorCode,
        lastErrorMessageSafe: row.lastErrorMessageSafe,
        retryCount: row.retryCount,
        ownerUserId: row.ownerUserId,
      }));
    }),

  listFailedSyncs: teamLeaderOrAboveProcedure.query(async ({ ctx }) => {
    const ownerUserIds = await getSyncScopeUserIds(ctx.user);
    const rows = await listFailedGoogleCalendarEventSyncs(100);
    return rows.filter(
      row =>
        ctx.user.role === "branch_admin" ||
        (row.ownerUserId != null && ownerUserIds?.includes(row.ownerUserId))
    );
  }),

  deleteGoogleEventForBoaEvent: branchAdminProcedure
    .input(
      z.object({
        boaEventType: z.enum([
          "calendar_event",
          "follow_up",
          "consultation",
          "meeting",
          "education",
          "admin",
        ]),
        boaEventId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await deleteGoogleCalendarEventForBoaEvent(
        ctx.user,
        input.boaEventType,
        input.boaEventId
      );
      return { success: true };
    }),

  getScheduleSyncSummary: activeUserProcedure
    .input(z.object({ scheduleId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const schedule = await getScheduleById(input.scheduleId);
      if (!schedule?.isActive || schedule.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "일정을 찾을 수 없습니다.",
        });
      }
      await assertCanAccessSyncRow(ctx.user, schedule.userId);
      const owner = await getUserById(schedule.userId);
      const calendarType = resolveScheduleGoogleCalendarType({
        scheduleType: schedule.type,
        customerId: schedule.customerId,
        ownerRole: owner?.role ?? null,
        status: schedule.status,
        calendarCategory: schedule.calendarCategory,
      });
      const boaEventType =
        calendarType === "skipped"
          ? ("calendar_event" as const)
          : mapScheduleTypeToBoaEventType(schedule.type, calendarType);
      const rows = await listGoogleCalendarEventSyncsForBoaEvent(
        boaEventType,
        schedule.id
      );
      const shared = rows.find(row => row.syncTargetType === "shared_calendar");
      return {
        calendarCategory:
          schedule.calendarCategory ??
          (calendarType === "skipped" ? null : calendarType),
        googleCalendarType: calendarType === "skipped" ? null : calendarType,
        googleCalendarLabel:
          calendarType === "skipped"
            ? null
            : getCalendarDisplayName(calendarType),
        syncStatus: shared?.syncStatus ?? null,
        lastErrorCode: shared?.lastErrorCode ?? null,
        lastErrorMessageSafe: shared?.lastErrorMessageSafe ?? null,
        lastSyncedAt: shared?.lastSyncedAt ?? null,
      };
    }),

  previewSafeEventPayload: activeUserProcedure
    .input(
      z.object({
        rawTitle: z.string().max(500).optional(),
        scheduleType: z
          .enum([
            "고객상담",
            "재통화",
            "계약예정",
            "보장분석",
            "해지방어",
            "팀회의",
            "교육",
            "외근",
            "휴무",
            "기타",
          ])
          .optional(),
        boaEventType: z
          .enum([
            "calendar_event",
            "follow_up",
            "consultation",
            "meeting",
            "education",
            "admin",
          ])
          .optional(),
        customerReference: z.string().max(100).optional(),
        segmentLabel: z.string().max(100).optional(),
        actionLabel: z.string().max(100).optional(),
        ownerRole: z
          .enum(["branch_admin", "sub_branch_admin", "team_leader", "member"])
          .optional(),
        customerId: z.number().nullable().optional(),
        previewTargetType: z
          .enum(["shared_calendar", "actor_personal_calendar"])
          .default("shared_calendar"),
        includeCustomerContact: z.boolean().default(false),
        customerContactPreview: z.string().max(20).optional(),
        viewerUserId: z.number().int().positive().optional(),
        createdBy: z.number().int().positive().optional(),
        ownerUserId: z.number().int().positive().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgSettings = await getGoogleCalendarOrgSettings();
      const policy = orgSettingsToPayloadPolicy(orgSettings);
      if (!isRawPiiAllowed(policy) && input.rawTitle) {
        const blocked = findSensitiveCalendarPattern(input.rawTitle, {
          field: "title",
        });
        if (blocked) {
          return {
            blocked: true as const,
            reason: blocked,
            message: "민감정보가 포함되어 Google Calendar로보낼 수 없습니다.",
          };
        }
      }
      try {
        const calendarType = input.scheduleType
          ? mapBoaScheduleToGoogleCalendarType({
              scheduleType: input.scheduleType,
              customerId: input.customerId,
              ownerRole: input.ownerRole,
            })
          : "consultation_followup";
        const viewerUserId = input.viewerUserId ?? ctx.user.id;
        const title = buildGoogleCalendarTitle(
          {
            title: input.rawTitle,
            scheduleType: input.scheduleType,
            boaEventType: input.boaEventType,
            customerReference: input.customerReference,
            segmentLabel: input.segmentLabel,
            actionLabel: input.actionLabel,
            rawTitle: input.rawTitle,
          },
          policy
        );
        const description = buildGoogleCalendarDescription(
          {
            description: input.rawTitle,
            targetType: input.previewTargetType,
            includeCustomerContact: input.includeCustomerContact,
            customerContact: input.customerContactPreview,
            viewerUserId,
            createdBy: input.createdBy ?? viewerUserId,
            ownerUserId: input.ownerUserId ?? viewerUserId,
          },
          policy
        );
        assertGoogleCalendarPayloadPolicy({ title, description }, policy, {
          targetType: input.previewTargetType,
          includeCustomerContact: input.includeCustomerContact,
          customerContact: input.customerContactPreview,
          viewerUserId,
          createdBy: input.createdBy ?? viewerUserId,
          ownerUserId: input.ownerUserId ?? viewerUserId,
        });
        return {
          blocked: false as const,
          calendarType,
          previewTargetType: input.previewTargetType,
          title,
          description,
          contactIncluded:
            policy.allowCustomerContactInGoogleCalendar ||
            (input.previewTargetType === "actor_personal_calendar" &&
              input.includeCustomerContact),
          policy,
        };
      } catch (error) {
        return {
          blocked: true as const,
          reason: "unsafe_payload",
          message:
            error instanceof Error
              ? error.message
              : "안전 제목을 생성할 수 없습니다.",
        };
      }
    }),
  duplicateAuditDryRun: branchAdminProcedure
    .input(
      z.object({
        fromCalendarType: z.literal("branch_common").default("branch_common"),
        toCalendarType: z
          .literal("consultation_followup")
          .default("consultation_followup"),
        eventTypeFilter: z.array(z.enum(EVENT_TYPE_FILTER_KEYS)).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return runDuplicateAuditDryRun(ctx.user.id, input);
    }),
  resyncMisclassifiedConsultationEventsDryRun: branchAdminProcedure
    .input(
      z.object({
        fromCalendarType: z.literal("branch_common").default("branch_common"),
        toCalendarType: z
          .literal("consultation_followup")
          .default("consultation_followup"),
        eventTypeFilter: z.array(z.enum(EVENT_TYPE_FILTER_KEYS)).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return runMisclassifiedResyncDryRun(ctx.user.id, input);
    }),
  resyncMisclassifiedConsultationEventsExecute: branchAdminProcedure
    .input(
      z.object({
        fromCalendarType: z.literal("branch_common").default("branch_common"),
        toCalendarType: z
          .literal("consultation_followup")
          .default("consultation_followup"),
        eventTypeFilter: z.array(z.enum(EVENT_TYPE_FILTER_KEYS)).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        limit: z.number().int().min(1).max(100).default(25),
        executeToken: z.string().min(1),
        confirmationText: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runMisclassifiedResyncExecute(ctx.user.id, input);
      } catch (error) {
        const err = error as Error & { code?: string };
        if (
          err.code === "INVALID_EXECUTE_TOKEN" ||
          err.code === "EXECUTE_TOKEN_EXPIRED" ||
          err.code === "CONFIRMATION_MISMATCH"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message,
          });
        }
        if (err.code === "FORBIDDEN") {
          throw new TRPCError({ code: "FORBIDDEN", message: err.message });
        }
        throw error;
      }
    }),
  getResyncHistory: branchAdminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getMisclassifiedResyncHistory(input?.limit ?? 20);
    }),
  getMisclassifiedResyncConfirmationText: branchAdminProcedure.query(() => ({
    confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
  })),
});
