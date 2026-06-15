import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as googleCalendarDb from "./googleCalendarDb";
import * as googleCalendarSync from "./googleCalendarSync";
import * as googleCalendarClient from "./googleCalendarClient";
import * as googleCalendarCredentialCrypto from "./googleCalendarCredentialCrypto";
import {
  buildSafeGoogleCalendarTitle,
  findSensitiveCalendarPattern,
} from "./googleCalendarSafePayload";

type Role =
  | "branch_admin"
  | "sub_branch_admin"
  | "team_leader"
  | "member"
  | "inactive"
  | "resigned";

function createCtx(
  role: Role,
  opts?: { userId?: number; teamId?: number }
): TrpcContext {
  const id =
    opts?.userId ??
    (role === "branch_admin"
      ? 1
      : role === "sub_branch_admin"
        ? 2
        : role === "team_leader"
          ? 3
          : 4);
  return {
    user: {
      id,
      openId: `test-${role}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "google",
      role: role === "inactive" || role === "resigned" ? "member" : role,
      accountStatus:
        role === "inactive"
          ? "inactive"
          : role === "resigned"
            ? "resigned"
            : "active",
      teamId: opts?.teamId ?? (role === "team_leader" ? 10 : null),
      subBranchAdminId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: { origin: "https://example.test" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const mockClient: googleCalendarClient.GoogleCalendarApiClient = {
  testCalendarAccess: vi.fn(async () => ({ ok: true })),
  createEvent: vi.fn(async () => ({ eventId: "mock-event-1" })),
  updateEvent: vi.fn(async () => ({ eventId: "mock-event-1" })),
  deleteEvent: vi.fn(async () => undefined),
};

afterEach(() => {
  vi.restoreAllMocks();
  googleCalendarClient.setGoogleCalendarApiClientForTests(null);
});

function mockGoogleAuth() {
  vi.spyOn(googleCalendarCredentialCrypto, "decryptRefreshToken").mockReturnValue(
    "mock-refresh"
  );
  vi.spyOn(googleCalendarClient, "exchangeGoogleRefreshToken").mockResolvedValue({
    accessToken: "mock-access",
  });
}

describe("PR22 Google Calendar integration", () => {
  it("allows only branch_admin to upsert calendar integration", async () => {
    vi.spyOn(googleCalendarDb, "upsertGoogleCalendarIntegration").mockResolvedValue(1);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx("branch_admin"));
    const result = await caller.googleCalendar.upsertCalendarIntegration({
      calendarType: "branch_common",
      googleCalendarId: "test-calendar-id@group.calendar.google.com",
    });
    expect(result.success).toBe(true);

    await expect(
      appRouter.createCaller(createCtx("sub_branch_admin")).googleCalendar.upsertCalendarIntegration({
        calendarType: "branch_common",
        googleCalendarId: "x@group.calendar.google.com",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter.createCaller(createCtx("team_leader")).googleCalendar.upsertCalendarIntegration({
        calendarType: "branch_common",
        googleCalendarId: "x@group.calendar.google.com",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter.createCaller(createCtx("member")).googleCalendar.upsertCalendarIntegration({
        calendarType: "branch_common",
        googleCalendarId: "x@group.calendar.google.com",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks inactive and resigned users", async () => {
    await expect(
      appRouter.createCaller(createCtx("inactive")).googleCalendar.getSettings()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      appRouter.createCaller(createCtx("resigned")).googleCalendar.getSettings()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("syncs schedule with mocked Google API", async () => {
    googleCalendarClient.setGoogleCalendarApiClientForTests(mockClient);
    vi.spyOn(googleCalendarDb, "getGoogleCalendarOauthCredential").mockResolvedValue({
      id: 1,
      organizationScope: 1,
      provider: "google_calendar",
      refreshTokenEnc: "enc",
      tokenScope: null,
      connectedBy: 1,
      isActive: true,
      lastTestedAt: null,
      lastTestResult: null,
      lastTestErrorSafe: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(googleCalendarDb, "getGoogleCalendarIntegrationByType").mockResolvedValue({
      id: 1,
      organizationScope: 1,
      provider: "google_calendar",
      calendarType: "consultation_followup",
      googleCalendarId: "test-calendar@group.calendar.google.com",
      displayName: "BOA 상담·후속관리 일정",
      isActive: true,
      lastTestedAt: null,
      lastTestResult: null,
      lastTestErrorSafe: null,
      createdBy: 1,
      updatedBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(googleCalendarDb, "getGoogleCalendarEventSync").mockResolvedValue(undefined);
    vi.spyOn(googleCalendarDb, "upsertGoogleCalendarEventSync").mockResolvedValue(10);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    mockGoogleAuth();

    const schedule = {
      id: 55,
      userId: 4,
      teamId: null,
      customerId: 102,
      title: "고객상담 일정",
      description: null,
      type: "고객상담" as const,
      status: "예정" as const,
      startTime: new Date("2026-06-15T10:00:00+09:00"),
      endTime: new Date("2026-06-15T11:00:00+09:00"),
      completedAt: null,
      memo: null,
      reminderDayBefore: true,
      reminderSameDay: true,
      reminderOneHourBefore: true,
      reminderOffsetMinutes: 30,
      isActive: true,
      deletedAt: null,
      createdBy: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await googleCalendarSync.syncScheduleToGoogleCalendar(
      { id: 1 },
      {
        schedule,
        ownerRole: "member",
        customerReference: "A-102",
        segmentLabel: "보장점검",
      }
    );

    expect(mockClient.createEvent).toHaveBeenCalled();
    const payload = (mockClient.createEvent as any).mock.calls[0][1];
    expect(payload.title).toContain("[BOA]");
    expect(payload.title).not.toContain("홍길동");
    expect(payload.description).toContain("BOA CRM");
  });

  it("marks sync failed without throwing when Google API fails", async () => {
    googleCalendarClient.setGoogleCalendarApiClientForTests({
      ...mockClient,
      createEvent: vi.fn(async () => {
        throw Object.assign(new Error("Google Calendar API 요청에 실패했습니다."), {
          code: "HTTP_403",
        });
      }),
    });
    vi.spyOn(googleCalendarDb, "getGoogleCalendarOauthCredential").mockResolvedValue({
      id: 1,
      refreshTokenEnc: "enc",
      isActive: true,
    } as any);
    vi.spyOn(googleCalendarDb, "getGoogleCalendarIntegrationByType").mockResolvedValue({
      calendarType: "consultation_followup",
      googleCalendarId: "calendar@test",
      isActive: true,
    } as any);
    vi.spyOn(googleCalendarDb, "getGoogleCalendarEventSync").mockResolvedValue(undefined);
    const upsertSpy = vi
      .spyOn(googleCalendarDb, "upsertGoogleCalendarEventSync")
      .mockResolvedValue(1);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    mockGoogleAuth();

    await expect(
      googleCalendarSync.syncScheduleToGoogleCalendar(
        { id: 1 },
        {
          schedule: {
            id: 1,
            userId: 4,
            type: "고객상담",
            status: "예정",
            startTime: new Date(),
            endTime: null,
            customerId: null,
            title: "상담",
          } as any,
          ownerRole: "member",
        }
      )
    ).resolves.toBeUndefined();

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: "failed" })
    );
  });

  it("retryFailedSync updates to synced on success", async () => {
    vi.spyOn(googleCalendarDb, "listGoogleCalendarEventSyncs").mockResolvedValue([
      {
        id: 9,
        boaEventType: "calendar_event",
        boaEventId: 77,
        googleCalendarId: "calendar@test",
        googleEventId: null,
        calendarType: "consultation_followup",
        syncStatus: "failed",
        retryCount: 1,
        ownerUserId: 4,
      },
    ] as any);
    vi.spyOn(googleCalendarDb, "updateGoogleCalendarEventSyncStatus").mockResolvedValue();
    vi.spyOn(db, "getScheduleById").mockResolvedValue({
      id: 77,
      userId: 4,
      type: "고객상담",
      status: "예정",
      startTime: new Date(),
      endTime: null,
      customerId: 102,
      title: "상담",
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({ id: 4, role: "member" } as any);
    vi.spyOn(googleCalendarSync, "syncScheduleToGoogleCalendar").mockResolvedValue();
    vi.spyOn(googleCalendarDb, "getGoogleCalendarEventSync").mockResolvedValue({
      syncStatus: "synced",
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await googleCalendarSync.retryFailedGoogleCalendarSync(
      { id: 1 },
      9,
      async () => ({
        schedule: {
          id: 77,
          userId: 4,
          type: "고객상담",
          status: "예정",
          startTime: new Date(),
          endTime: null,
          customerId: 102,
          title: "상담",
        } as any,
        ownerRole: "member",
        customerReference: "A-102",
      })
    );
    expect(result.success).toBe(true);
  });

  it("does not include tokens in activity log metadata", async () => {
    const logSpy = vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(googleCalendarDb, "upsertGoogleCalendarIntegration").mockResolvedValue(1);

    await appRouter.createCaller(createCtx("branch_admin")).googleCalendar.upsertCalendarIntegration({
      calendarType: "admin",
      googleCalendarId: "admin-calendar@test",
    });

    const details = logSpy.mock.calls[0]?.[0]?.details ?? "";
    expect(details).not.toMatch(/refreshToken|accessToken|mock-refresh/i);
    expect(findSensitiveCalendarPattern("홍길동")).toBe("customer_name");
    expect(() =>
      buildSafeGoogleCalendarTitle({ rawTitle: "홍길동 고객 상담" })
    ).toThrow();
  });

  it("blocks member from manual sync", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .googleCalendar.syncBoaEventToGoogle({
          boaEventType: "calendar_event",
          boaEventId: 1,
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
