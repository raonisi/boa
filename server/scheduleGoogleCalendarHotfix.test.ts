import { describe, expect, it, vi, afterEach } from "vitest";
import { DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY } from "@shared/googleCalendar";
import {
  recommendScheduleCalendarCategory,
  SCHEDULE_CALENDAR_CATEGORY_LABELS,
} from "@shared/scheduleCalendarCategory";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as googleCalendarDb from "./googleCalendarDb";
import * as googleCalendarClient from "./googleCalendarClient";
import * as googleCalendarCredentialCrypto from "./googleCalendarCredentialCrypto";
import * as googleCalendarSync from "./googleCalendarSync";
import {
  buildGoogleCalendarTitle,
  resolveScheduleGoogleCalendarType,
  sanitizeGoogleCalendarLogMetadata,
} from "./googleCalendarSafePayload";
import { assertCanSelectCalendarCategory } from "./scheduleCalendarCategory";

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
    } as any,
    req: {
      protocol: "https",
      headers: { origin: "https://example.test" },
    } as TrpcContext["req"],
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

describe("PR22 hotfix schedule calendar category", () => {
  it("recommends consultation_followup for consultation schedule types", () => {
    expect(
      recommendScheduleCalendarCategory({ scheduleType: "고객상담" })
    ).toBe("consultation_followup");
  });

  it("prioritizes stored calendarCategory over auto mapping", () => {
    expect(
      resolveScheduleGoogleCalendarType({
        scheduleType: "고객상담",
        calendarCategory: "branch_common",
      })
    ).toBe("branch_common");
    expect(
      resolveScheduleGoogleCalendarType({
        scheduleType: "교육",
        calendarCategory: "consultation_followup",
      })
    ).toBe("consultation_followup");
  });

  it("maps each calendarCategory to the matching Google Calendar target", async () => {
    googleCalendarClient.setGoogleCalendarApiClientForTests(mockClient);
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarOrgSettings"
    ).mockResolvedValue({
      syncRawTitleToGoogleCalendar: false,
      syncRawDescriptionToGoogleCalendar: false,
      allowCustomerNameInGoogleCalendar: false,
      allowCustomerContactInGoogleCalendar: false,
      includeCustomerContactForActorCalendar: false,
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarPersonalSettings"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarOauthCredential"
    ).mockResolvedValue({
      id: 1,
      refreshTokenEnc: "enc",
      isActive: true,
    } as any);
    const integrationSpy = vi
      .spyOn(googleCalendarDb, "getGoogleCalendarIntegrationByType")
      .mockImplementation(
        async calendarType =>
          ({
            calendarType,
            googleCalendarId: `${calendarType}@test`,
            isActive: true,
          }) as any
      );
    vi.spyOn(googleCalendarDb, "getGoogleCalendarEventSync").mockResolvedValue(
      undefined
    );
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarEventSync"
    ).mockResolvedValue(10);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      googleCalendarCredentialCrypto,
      "decryptRefreshToken"
    ).mockReturnValue("mock-refresh");
    vi.spyOn(
      googleCalendarClient,
      "exchangeGoogleRefreshToken"
    ).mockResolvedValue({
      accessToken: "mock-access",
    });

    const cases = [
      { category: "branch_common" as const, type: "교육" },
      { category: "consultation_followup" as const, type: "고객상담" },
      { category: "admin" as const, type: "팀회의" },
    ];

    for (const testCase of cases) {
      integrationSpy.mockClear();
      (mockClient.createEvent as any).mockClear();
      await googleCalendarSync.syncScheduleToGoogleCalendar(
        { id: 1 },
        {
          schedule: {
            id: 100,
            userId: 4,
            type: testCase.type,
            status: "예정",
            startTime: new Date(),
            endTime: null,
            customerId: null,
            title: "테스트 일정",
            calendarCategory: testCase.category,
          } as any,
          ownerRole: "branch_admin",
        }
      );
      expect(integrationSpy).toHaveBeenCalledWith(testCase.category);
    }
  });

  it("blocks member from selecting admin calendar category", () => {
    expect(() => assertCanSelectCalendarCategory("member", "admin")).toThrow();
    expect(() =>
      assertCanSelectCalendarCategory("team_leader", "admin")
    ).not.toThrow();
  });

  it("uses raw title when sync policy enabled", () => {
    const rawTitle = "홍길동 010-1234-5678 보장점검 상담";
    const title = buildGoogleCalendarTitle(
      { title: rawTitle },
      {
        ...DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY,
        syncRawTitleToGoogleCalendar: true,
        allowCustomerNameInGoogleCalendar: true,
        allowCustomerContactInGoogleCalendar: true,
      }
    );
    expect(title).toBe(rawTitle);
    expect(title).not.toContain("A-38");
  });

  it("uses safe title when raw sync policy disabled", () => {
    const title = buildGoogleCalendarTitle(
      {
        title: "홍길동 010-1234-5678 보장점검 상담",
        scheduleType: "고객상담",
        customerReference: "A-38",
        segmentLabel: "보장점검",
      },
      DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY
    );
    expect(title).toContain("[BOA]");
    expect(title).not.toContain("홍길동");
  });

  it("does not store raw PII in activity log metadata", () => {
    const safe = sanitizeGoogleCalendarLogMetadata({
      calendarCategory: "consultation_followup",
      title: "홍길동 010-1234-5678 보장점검 상담",
      customerName: "홍길동",
      customerContact: "010-1234-5678",
      refreshToken: "secret",
    });
    expect(safe).not.toHaveProperty("title");
    expect(safe).not.toHaveProperty("customerName");
    expect(safe).not.toHaveProperty("refreshToken");
    expect(safe.calendarCategory).toBe("consultation_followup");
  });

  it("syncs consultation_followup calendar when calendarCategory is set", async () => {
    googleCalendarClient.setGoogleCalendarApiClientForTests(mockClient);
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarOrgSettings"
    ).mockResolvedValue({
      syncRawTitleToGoogleCalendar: true,
      syncRawDescriptionToGoogleCalendar: false,
      allowCustomerNameInGoogleCalendar: true,
      allowCustomerContactInGoogleCalendar: true,
      includeCustomerContactForActorCalendar: false,
    } as any);
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarPersonalSettings"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarOauthCredential"
    ).mockResolvedValue({
      id: 1,
      refreshTokenEnc: "enc",
      isActive: true,
    } as any);
    const integrationSpy = vi
      .spyOn(googleCalendarDb, "getGoogleCalendarIntegrationByType")
      .mockImplementation(async calendarType => {
        if (calendarType === "consultation_followup") {
          return {
            calendarType: "consultation_followup",
            googleCalendarId: "consultation@test",
            isActive: true,
          } as any;
        }
        if (calendarType === "branch_common") {
          return {
            calendarType: "branch_common",
            googleCalendarId: "common@test",
            isActive: true,
          } as any;
        }
        return undefined;
      });
    vi.spyOn(googleCalendarDb, "getGoogleCalendarEventSync").mockResolvedValue(
      undefined
    );
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarEventSync"
    ).mockResolvedValue(10);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      googleCalendarCredentialCrypto,
      "decryptRefreshToken"
    ).mockReturnValue("mock-refresh");
    vi.spyOn(
      googleCalendarClient,
      "exchangeGoogleRefreshToken"
    ).mockResolvedValue({
      accessToken: "mock-access",
    });

    const rawTitle = "홍길동 010-1234-5678 보장점검 상담";
    await googleCalendarSync.syncScheduleToGoogleCalendar(
      { id: 1 },
      {
        schedule: {
          id: 99,
          userId: 4,
          type: "교육",
          status: "예정",
          startTime: new Date(),
          endTime: null,
          customerId: 38,
          title: rawTitle,
          description: null,
          calendarCategory: "consultation_followup",
        } as any,
        ownerRole: "member",
        customerReference: "A-38",
      }
    );

    expect(integrationSpy).toHaveBeenCalledWith("consultation_followup");
    expect(integrationSpy).not.toHaveBeenCalledWith("branch_common");
    const payload = (mockClient.createEvent as any).mock.calls[0][1];
    expect(payload.title).toBe(rawTitle);
  });

  it("blocks member from creating admin calendar category schedule", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).schedules.create({
        title: "관리자 회의",
        type: "팀회의",
        startTime: "2026-06-15T10:00",
        calendarCategory: "admin",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows branch_admin to update sync policy", async () => {
    vi.spyOn(
      googleCalendarDb,
      "upsertGoogleCalendarOrgSettings"
    ).mockResolvedValue(1);
    vi.spyOn(
      googleCalendarDb,
      "getGoogleCalendarOrgSettings"
    ).mockResolvedValue({
      syncRawTitleToGoogleCalendar: true,
      syncRawDescriptionToGoogleCalendar: false,
      allowCustomerNameInGoogleCalendar: true,
      allowCustomerContactInGoogleCalendar: true,
      includeCustomerContactForActorCalendar: false,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .googleCalendar.updateSyncPolicy({
        syncRawTitleToGoogleCalendar: true,
        allowCustomerNameInGoogleCalendar: true,
      });
    expect(result.success).toBe(true);
    expect(result.rawTitleSynced).toBe(true);
  });

  it("exposes calendar category labels for UI", () => {
    expect(SCHEDULE_CALENDAR_CATEGORY_LABELS.consultation_followup).toBe(
      "상담일정"
    );
  });
});
