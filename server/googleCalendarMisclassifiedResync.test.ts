import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY,
  MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
} from "@shared/googleCalendar";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as googleCalendarDb from "./googleCalendarDb";
import * as googleCalendarClient from "./googleCalendarClient";
import * as googleCalendarCredentialCrypto from "./googleCalendarCredentialCrypto";
import * as googleCalendarSync from "./googleCalendarSync";
import {
  runMisclassifiedResyncDryRun,
  runMisclassifiedResyncExecute,
} from "./googleCalendarMisclassifiedResync";
import {
  buildGoogleCalendarTitle,
  sanitizeGoogleCalendarLogMetadata,
} from "./googleCalendarSafePayload";

type Role =
  | "branch_admin"
  | "sub_branch_admin"
  | "team_leader"
  | "member"
  | "inactive";

function createCtx(role: Role): TrpcContext {
  const id =
    role === "branch_admin"
      ? 1
      : role === "sub_branch_admin"
        ? 2
        : role === "team_leader"
          ? 3
          : 4;
  return {
    user: {
      id,
      openId: `test-${role}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "google",
      role: role === "inactive" ? "member" : role,
      accountStatus: role === "inactive" ? "inactive" : "active",
      teamId: role === "team_leader" ? 10 : null,
      subBranchAdminId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      headers: { origin: "https://example.test" },
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const baseSchedule = {
  id: 101,
  type: "고객상담",
  title: "홍길동 고객 상담",
  description: "010-1234-5678 연락",
  memo: null,
  calendarCategory: "branch_common" as const,
  customerId: 55,
  userId: 4,
  createdBy: 4,
  startTime: new Date("2026-06-20T10:00:00Z"),
  endTime: new Date("2026-06-20T11:00:00Z"),
  isActive: true,
  status: "scheduled",
};

const baseSync = {
  id: 9,
  boaEventType: "calendar_event" as const,
  boaEventId: 101,
  syncTargetType: "shared_calendar" as const,
  targetUserId: 0,
  googleCalendarId: "branch-common-cal",
  googleEventId: "evt-branch-1",
  calendarType: "branch_common" as const,
  syncStatus: "synced" as const,
  includeContactInDescription: false,
  contactIncluded: false,
  lastSyncedAt: new Date(),
  lastErrorCode: null,
  lastErrorMessageSafe: null,
  retryCount: 0,
  ownerUserId: 4,
  createdBy: 4,
  updatedBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let mockClient: googleCalendarClient.GoogleCalendarApiClient;

beforeEach(() => {
  mockClient = {
    testCalendarAccess: vi.fn(async () => ({ ok: true })),
    createEvent: vi.fn(async () => ({ eventId: "evt-consult-new" })),
    updateEvent: vi.fn(async () => ({ eventId: "evt-branch-1" })),
    deleteEvent: vi.fn(async () => undefined),
    moveEvent: vi.fn(async () => ({ eventId: "evt-moved-1" })),
  };
  googleCalendarClient.setGoogleCalendarApiClientForTests(mockClient);
  vi.spyOn(
    googleCalendarCredentialCrypto,
    "decryptRefreshToken"
  ).mockReturnValue("refresh-token");
  vi.spyOn(
    googleCalendarClient,
    "exchangeGoogleRefreshToken"
  ).mockResolvedValue({
    accessToken: "access-token",
    expiresIn: 3600,
  });
  vi.spyOn(
    googleCalendarDb,
    "getGoogleCalendarOauthCredential"
  ).mockResolvedValue({
    refreshTokenEnc: "enc",
  } as any);
  vi.spyOn(googleCalendarDb, "getGoogleCalendarOrgSettings").mockResolvedValue({
    ...DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY,
    includeCustomerContactForActorCalendar: false,
  } as any);
  vi.spyOn(db, "getUserById").mockResolvedValue({
    id: 4,
    role: "member",
  } as any);
  vi.spyOn(googleCalendarSync, "loadCustomerContactForSync").mockResolvedValue(
    "010-1234-5678"
  );
  vi.spyOn(
    googleCalendarDb,
    "getGoogleCalendarIntegrationByType"
  ).mockImplementation(async (type: string) => {
    if (type === "branch_common") {
      return {
        calendarType: "branch_common",
        googleCalendarId: "branch-common-cal",
        isActive: true,
      } as any;
    }
    if (type === "consultation_followup") {
      return {
        calendarType: "consultation_followup",
        googleCalendarId: "consult-cal",
        isActive: true,
      } as any;
    }
    return undefined;
  });
  vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  googleCalendarClient.setGoogleCalendarApiClientForTests(null);
});

describe("google calendar misclassified resync RBAC", () => {
  it("allows branch_admin dry-run", async () => {
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([]);
    vi.spyOn(
      googleCalendarDb,
      "insertMisclassifiedResyncRun"
    ).mockResolvedValue(1);

    const caller = appRouter.createCaller(createCtx("branch_admin"));
    const result =
      await caller.googleCalendar.resyncMisclassifiedConsultationEventsDryRun(
        {}
      );
    expect(result.totalCandidates).toBe(0);
    expect(result.executeToken).toBeTruthy();
  });

  it("blocks sub_branch_admin dry-run", async () => {
    const caller = appRouter.createCaller(createCtx("sub_branch_admin"));
    await expect(
      caller.googleCalendar.resyncMisclassifiedConsultationEventsDryRun({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks team_leader dry-run", async () => {
    const caller = appRouter.createCaller(createCtx("team_leader"));
    await expect(
      caller.googleCalendar.resyncMisclassifiedConsultationEventsDryRun({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks member dry-run", async () => {
    const caller = appRouter.createCaller(createCtx("member"));
    await expect(
      caller.googleCalendar.resyncMisclassifiedConsultationEventsDryRun({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows branch_admin execute with valid token", async () => {
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "getMisclassifiedResyncRunByToken"
    ).mockResolvedValue({
      id: 1,
      executeToken: "token-1",
      status: "dry_run",
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      summaryJson: "{}",
      candidateIdsJson: "[101]",
      actorId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      executedAt: null,
      resultJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "updateMisclassifiedResyncRun"
    ).mockResolvedValue();
    vi.spyOn(
      googleCalendarDb,
      "updateScheduleCalendarCategory"
    ).mockResolvedValue(true);
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarEventSync"
    ).mockResolvedValue(9);

    const caller = appRouter.createCaller(createCtx("branch_admin"));
    const result =
      await caller.googleCalendar.resyncMisclassifiedConsultationEventsExecute({
        executeToken: "token-1",
        confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
      });
    expect(result.movedCount).toBe(1);
  });
});

describe("google calendar misclassified resync behavior", () => {
  it("detects branch_common misclassified consultation schedules", async () => {
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "insertMisclassifiedResyncRun"
    ).mockResolvedValue(1);

    const result = await runMisclassifiedResyncDryRun(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
    });
    expect(result.totalCandidates).toBe(1);
    expect(result.candidates[0]?.boaEventId).toBe(101);
    expect(result.candidates[0]?.scheduleType).toBe("고객상담");
    expect(result.candidates[0]?.plannedAction).toBe("move");
  });

  it("dry-run does not mutate schedule or sync rows", async () => {
    const updateSchedule = vi
      .spyOn(googleCalendarDb, "updateScheduleCalendarCategory")
      .mockResolvedValue(true);
    const upsertSync = vi
      .spyOn(googleCalendarDb, "upsertGoogleCalendarEventSync")
      .mockResolvedValue(1);
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "insertMisclassifiedResyncRun"
    ).mockResolvedValue(1);

    await runMisclassifiedResyncDryRun(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
    });
    expect(updateSchedule).not.toHaveBeenCalled();
    expect(upsertSync).not.toHaveBeenCalled();
    expect(mockClient.moveEvent).not.toHaveBeenCalled();
  });

  it("execute updates calendarCategory to consultation_followup", async () => {
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "getMisclassifiedResyncRunByToken"
    ).mockResolvedValue({
      id: 1,
      executeToken: "token-2",
      status: "dry_run",
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      summaryJson: "{}",
      candidateIdsJson: "[101]",
      actorId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      executedAt: null,
      resultJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "updateMisclassifiedResyncRun"
    ).mockResolvedValue();
    const updateSchedule = vi
      .spyOn(googleCalendarDb, "updateScheduleCalendarCategory")
      .mockResolvedValue(true);
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarEventSync"
    ).mockResolvedValue(9);

    await runMisclassifiedResyncExecute(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      executeToken: "token-2",
      confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
    });
    expect(updateSchedule).toHaveBeenCalledWith(101, "consultation_followup");
  });

  it("tries move when googleEventId exists", async () => {
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "getMisclassifiedResyncRunByToken"
    ).mockResolvedValue({
      id: 1,
      executeToken: "token-3",
      status: "dry_run",
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      summaryJson: "{}",
      candidateIdsJson: "[101]",
      actorId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      executedAt: null,
      resultJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "updateMisclassifiedResyncRun"
    ).mockResolvedValue();
    vi.spyOn(
      googleCalendarDb,
      "updateScheduleCalendarCategory"
    ).mockResolvedValue(true);
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarEventSync"
    ).mockResolvedValue(9);

    const result = await runMisclassifiedResyncExecute(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      executeToken: "token-3",
      confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
    });
    expect(mockClient.moveEvent).toHaveBeenCalled();
    expect(result.results[0]?.result).toBe("resync_moved");
  });

  it("falls back to delete+insert when move fails", async () => {
    mockClient.moveEvent = vi.fn(async () => {
      throw Object.assign(new Error("move failed"), { code: "MOVE_FAILED" });
    });
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "getMisclassifiedResyncRunByToken"
    ).mockResolvedValue({
      id: 1,
      executeToken: "token-4",
      status: "dry_run",
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      summaryJson: "{}",
      candidateIdsJson: "[101]",
      actorId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      executedAt: null,
      resultJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "updateMisclassifiedResyncRun"
    ).mockResolvedValue();
    vi.spyOn(
      googleCalendarDb,
      "updateScheduleCalendarCategory"
    ).mockResolvedValue(true);
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarEventSync"
    ).mockResolvedValue(9);

    const result = await runMisclassifiedResyncExecute(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      executeToken: "token-4",
      confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
    });
    expect(mockClient.deleteEvent).toHaveBeenCalled();
    expect(mockClient.createEvent).toHaveBeenCalled();
    expect(result.results[0]?.result).toBe("resync_recreated");
  });

  it("inserts when googleEventId is missing", async () => {
    const syncWithoutEvent = { ...baseSync, googleEventId: null };
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: syncWithoutEvent as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "getMisclassifiedResyncRunByToken"
    ).mockResolvedValue({
      id: 1,
      executeToken: "token-5",
      status: "dry_run",
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      summaryJson: "{}",
      candidateIdsJson: "[101]",
      actorId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      executedAt: null,
      resultJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "updateMisclassifiedResyncRun"
    ).mockResolvedValue();
    vi.spyOn(
      googleCalendarDb,
      "updateScheduleCalendarCategory"
    ).mockResolvedValue(true);
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarEventSync"
    ).mockResolvedValue(9);

    const result = await runMisclassifiedResyncExecute(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      executeToken: "token-5",
      confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
    });
    expect(mockClient.createEvent).toHaveBeenCalled();
    expect(mockClient.moveEvent).not.toHaveBeenCalled();
    expect(result.results[0]?.result).toBe("resync_recreated");
  });

  it("skips when consultation_followup calendarId is missing", async () => {
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarIntegrationByType"
    ).mockImplementation(async (type: string) => {
      if (type === "branch_common") {
        return {
          calendarType: "branch_common",
          googleCalendarId: "branch-common-cal",
          isActive: true,
        } as any;
      }
      return { calendarType: "consultation_followup", isActive: false } as any;
    });
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "getMisclassifiedResyncRunByToken"
    ).mockResolvedValue({
      id: 1,
      executeToken: "token-6",
      status: "dry_run",
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      summaryJson: "{}",
      candidateIdsJson: "[101]",
      actorId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      executedAt: null,
      resultJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "updateMisclassifiedResyncRun"
    ).mockResolvedValue();
    vi.spyOn(
      googleCalendarDb,
      "updateScheduleCalendarCategory"
    ).mockResolvedValue(true);

    const result = await runMisclassifiedResyncExecute(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      executeToken: "token-6",
      confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
    });
    expect(result.results[0]?.result).toBe("skipped_missing_calendar");
    expect(mockClient.moveEvent).not.toHaveBeenCalled();
  });

  it("updates single sync row to avoid duplicate google events", async () => {
    const upsert = vi
      .spyOn(googleCalendarDb, "upsertGoogleCalendarEventSync")
      .mockResolvedValue(9);
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "getMisclassifiedResyncRunByToken"
    ).mockResolvedValue({
      id: 1,
      executeToken: "token-7",
      status: "dry_run",
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      summaryJson: "{}",
      candidateIdsJson: "[101]",
      actorId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      executedAt: null,
      resultJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "updateMisclassifiedResyncRun"
    ).mockResolvedValue();
    vi.spyOn(
      googleCalendarDb,
      "updateScheduleCalendarCategory"
    ).mockResolvedValue(true);

    await runMisclassifiedResyncExecute(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
      executeToken: "token-7",
      confirmationText: MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT,
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      boaEventId: 101,
      googleEventId: "evt-moved-1",
      calendarType: "consultation_followup",
    });
  });

  it("does not store customer PII in activity log metadata", async () => {
    const createLog = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined as any);
    vi.spyOn(
      googleCalendarDb,
      "listMisclassifiedConsultationScheduleCandidates"
    ).mockResolvedValue([
      { schedule: baseSchedule as any, sync: baseSync as any },
    ]);
    vi.spyOn(
      googleCalendarDb,
      "insertMisclassifiedResyncRun"
    ).mockResolvedValue(1);

    await runMisclassifiedResyncDryRun(1, {
      fromCalendarType: "branch_common",
      toCalendarType: "consultation_followup",
    });

    const details = createLog.mock.calls.find(
      c => c[0]?.action === "GOOGLE_CALENDAR_MISCLASSIFIED_RESYNC_DRY_RUN"
    )?.[0]?.details;
    expect(details).toBeTruthy();
    expect(details).not.toContain("홍길동");
    expect(details).not.toContain("010-1234-5678");
    const parsed = JSON.parse(details!);
    const sanitized = sanitizeGoogleCalendarLogMetadata(parsed.metadata);
    expect(JSON.stringify(sanitized)).not.toContain("홍길동");
  });

  it("uses raw title when org policy allows", () => {
    const title = buildGoogleCalendarTitle(
      {
        title: "홍길동 상담",
        scheduleType: "고객상담",
        boaEventType: "calendar_event",
        customerReference: "A-55",
        rawTitle: "홍길동 상담",
        customerContact: "010-9999-8888",
      },
      {
        syncRawTitleToGoogleCalendar: true,
        syncRawDescriptionToGoogleCalendar: true,
        allowCustomerNameInGoogleCalendar: true,
        allowCustomerContactInGoogleCalendar: true,
      }
    );
    expect(title).toContain("홍길동");
  });

  it("uses safe title when org policy disallows raw PII", () => {
    const title = buildGoogleCalendarTitle(
      {
        title: "홍길동 상담",
        scheduleType: "고객상담",
        boaEventType: "calendar_event",
        customerReference: "A-55",
        rawTitle: "홍길동 상담",
        customerContact: "010-9999-8888",
      },
      DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY
    );
    expect(title).not.toContain("홍길동");
    expect(title).toContain("A-55");
  });
});
