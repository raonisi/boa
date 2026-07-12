import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { sanitizeActivityLogDetailsForStorage } from "./activityLogRedaction";
import * as db from "./db";
import * as notifications from "./notifications";
import * as pushNotifications from "./pushNotifications";
import {
  formatKstLocalDateTime,
  parseKstLocalDateTime,
} from "@shared/timePolicy";
import { CUSTOMER_BULK_IMPORT_PERMISSION } from "@shared/permissions";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
type AccountStatus = "active" | "inactive" | "resigned";

function createCtx(
  role: Role,
  opts?: {
    teamId?: number;
    subBranchAdminId?: number;
    userId?: number;
    accountStatus?: AccountStatus;
    permissions?: string[];
  }
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
      openId: `test-${role}-${id}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "manus",
      role,
      accountStatus: opts?.accountStatus ?? "active",
      teamId: opts?.teamId ?? null,
      subBranchAdminId: opts?.subBranchAdminId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      permissions: opts?.permissions,
    } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createInactiveCtx(role: Role = "member"): TrpcContext {
  return createCtx(role, { accountStatus: "inactive" });
}

afterEach(() => {
  pushNotifications.setPushSenderForTests(null);
  vi.restoreAllMocks();
});

describe("activity log redaction utility", () => {
  it("can sanitize legacy persisted activity log details for controlled backfill", () => {
    const details = JSON.stringify({
      reason: "download 010-1234-5678 token=legacy-token",
      birthDate: "1992-01-01",
      consultationBody: "상담본문 전문",
      premium: 120000,
    });

    const sanitized = String(sanitizeActivityLogDetailsForStorage(details));

    expect(sanitized).toContain("010-****-5678");
    expect(sanitized).toContain("1992-**-**");
    expect(sanitized).toContain("[REDACTED]");
    expect(sanitized).toContain("업무 상세 변경");
    expect(sanitized).toContain("금액 정보 변경");
    expect(sanitized).not.toContain("legacy-token");
    expect(sanitized).not.toContain("상담본문 전문");
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    expect(await appRouter.createCaller(ctx).auth.me()).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const ctx = createCtx("branch_admin");
    expect((await appRouter.createCaller(ctx).auth.me())?.role).toBe(
      "branch_admin"
    );
  });

  it("does not return inactive or resigned user payloads", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "inactive" }))
        .auth.me()
    ).resolves.toBeNull();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "resigned" }))
        .auth.me()
    ).resolves.toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => {
          cleared.push(name);
        },
      } as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBe(1);
  });
});

describe("Onboarding checklist RBAC and workflow", () => {
  it("blocks member from manager summary", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 41 }))
        .onboardingAssignments.summary()
    ).rejects.toThrow();
  });

  it("allows branch_admin to seed default onboarding templates", async () => {
    vi.spyOn(db, "ensureDefaultOnboardingTemplates").mockResolvedValue({
      createdTemplates: 2,
      createdItems: 5,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .onboardingTemplates.seedDefaults();
    expect(result).toEqual({ createdTemplates: 2, createdItems: 5 });
  });

  it("creates assignment with pending progress rows", async () => {
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 4)
        return {
          id: 4,
          role: "member",
          accountStatus: "active",
          teamId: 10,
        } as any;
      return undefined as any;
    });
    vi.spyOn(db, "getOnboardingTemplateById").mockResolvedValue({
      id: 100,
      isActive: true,
      archivedAt: null,
      targetRole: "member",
    } as any);
    vi.spyOn(db, "getOnboardingTemplateItems").mockResolvedValue([
      { id: 1001, required: true },
      { id: 1002, required: false },
    ] as any);
    vi.spyOn(db, "createOnboardingAssignment").mockResolvedValue({
      id: 900,
      targetUserId: 4,
      templateId: 100,
    } as any);
    const createRowsSpy = vi
      .spyOn(db, "createOnboardingItemProgressRows")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .onboardingAssignments.assign({
        targetUserId: 4,
        templateId: 100,
        startedAt: new Date("2026-06-01").toISOString(),
        dueAt: new Date("2026-06-08").toISOString(),
      });

    expect(result.assignmentId).toBe(900);
    expect(createRowsSpy).toHaveBeenCalled();
  });
});

// ─── RBAC - accountStatus 기반 차단 ──────────────────────────────────────────
describe("RBAC - inactive accountStatus blocked from all data", () => {
  it("blocks inactive from customers.list", async () => {
    await expect(
      appRouter.createCaller(createInactiveCtx()).customers.list({})
    ).rejects.toThrow("계정이 비활성화되었습니다.");
  });
  it("blocks inactive from schedules.list", async () => {
    await expect(
      appRouter.createCaller(createInactiveCtx()).schedules.list()
    ).rejects.toThrow();
  });
  it("blocks inactive from notifications.list", async () => {
    await expect(
      appRouter.createCaller(createInactiveCtx()).notifications.list()
    ).rejects.toThrow();
  });
  it("blocks inactive from performance.stats", async () => {
    await expect(
      appRouter.createCaller(createInactiveCtx()).performance.stats()
    ).rejects.toThrow();
  });
  it("blocks inactive branch_admin from users.list", async () => {
    await expect(
      appRouter.createCaller(createInactiveCtx("branch_admin")).users.list()
    ).rejects.toThrow();
  });
});

// ─── RBAC - users.list ────────────────────────────────────────────────────────
describe("RBAC - users.list", () => {
  it("allows branch_admin to access users.list", async () => {
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).users.list()
    ).resolves.toBeDefined();
  });
  it("allows member to access users.list", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).users.list()
    ).resolves.toBeDefined();
  });
  it("allows team_leader to access users.list", async () => {
    await expect(
      appRouter.createCaller(createCtx("team_leader")).users.list()
    ).resolves.toBeDefined();
  });
  it("returns only minimal self data for member", async () => {
    const result = await appRouter
      .createCaller(createCtx("member", { userId: 44 }))
      .users.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 44, role: "member", email: null });
    expect("phone" in result[0]).toBe(false);
    expect("memo" in result[0]).toBe(false);
  });
  it("returns only active users when activeOnly is requested", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 1,
        name: "[TEST] Admin",
        role: "branch_admin",
        accountStatus: "active",
        teamId: null,
        subBranchAdminId: null,
      },
      {
        id: 4,
        name: "[TEST] Member",
        role: "member",
        accountStatus: "active",
        teamId: 10,
        subBranchAdminId: 2,
      },
      {
        id: 5,
        name: "[TEST] Inactive",
        role: "member",
        accountStatus: "inactive",
        teamId: 10,
        subBranchAdminId: 2,
      },
      {
        id: 6,
        name: "[TEST] Resigned",
        role: "member",
        accountStatus: "resigned",
        teamId: 10,
        subBranchAdminId: 2,
      },
    ] as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .users.list({ activeOnly: true });

    expect(result.map(user => user.id)).toEqual([1, 4]);
    expect(result.every(user => user.accountStatus === "active")).toBe(true);
  });
});

describe("RBAC - list null scope guards", () => {
  it("returns empty customers for team_leader without teamId", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { teamId: null }))
        .customers.list({})
    ).resolves.toEqual([]);
  });
  it("returns empty contracts for team_leader without teamId", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { teamId: null }))
        .contracts.list()
    ).resolves.toEqual([]);
  });
  it("returns own schedules for team_leader without teamId on default mine view", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 3,
        name: "[TEST] Leader",
        role: "team_leader",
        accountStatus: "active",
        teamId: null,
        subBranchAdminId: 2,
      },
    ] as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { teamId: null }))
        .schedules.list()
    ).resolves.toMatchObject({ schedules: [] });
  });
});

describe("Schedules - datetime and reminder persistence", () => {
  const kst = (value: string) => parseKstLocalDateTime(value);

  const baseSchedule = (overrides: Partial<any> = {}) => ({
    id: 77,
    userId: 4,
    teamId: null,
    customerId: null,
    title: "보험 상담",
    description: null,
    type: "고객상담",
    status: "예정",
    startTime: new Date("2026-06-01T10:00:00.000Z"),
    endTime: new Date("2026-06-01T11:00:00.000Z"),
    completedAt: null,
    memo: null,
    reminderDayBefore: false,
    reminderSameDay: false,
    reminderOneHourBefore: true,
    reminderOffsetMinutes: 60,
    isActive: true,
    deletedAt: null,
    createdBy: 4,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides,
  });

  beforeEach(() => {
    vi.spyOn(db, "getScheduleById").mockImplementation(async id => {
      const rows = await db.getSchedules({});
      return rows.find(schedule => schedule.id === id);
    });
  });

  function mockScheduleMutationSideEffects() {
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleIncompleteNotification"
    ).mockResolvedValue(undefined);
    vi.spyOn(notifications, "createScheduleReminderByOffset").mockResolvedValue(
      undefined
    );
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);
  }

  it("preserves KST local datetime when creating schedules", async () => {
    const startTime = kst("2026-05-22T12:00:00");
    vi.spyOn(db, "createSchedule").mockResolvedValue(undefined);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      baseSchedule({
        id: 88,
        title: "신규 일정",
        startTime,
        reminderOffsetMinutes: 120,
      }),
    ] as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const cancelTimingSpy = vi
      .spyOn(notifications, "cancelScheduleTimingNotifications")
      .mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("member")).schedules.create({
      title: "신규 일정",
      type: "고객상담",
      startTime: "2026-05-22T12:00:00",
      reminderOffsetMinutes: 120,
    });

    expect(db.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime,
        reminderOffsetMinutes: 120,
        reminderDayBefore: false,
        reminderSameDay: false,
        reminderOneHourBefore: false,
      })
    );
    expect(formatKstLocalDateTime(startTime)).toBe("2026-05-22T12:00:00");
    expect(cancelTimingSpy).toHaveBeenCalledWith(4, 88);
    expect(reminderSpy).toHaveBeenCalledWith(
      88,
      4,
      startTime,
      "신규 일정",
      120
    );
  });

  it("preserves KST local start and end times for 09:00 schedule creation", async () => {
    const startTime = kst("2026-05-22T09:00:00");
    const endTime = kst("2026-05-22T10:00:00");
    vi.spyOn(db, "createSchedule").mockResolvedValue(undefined);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      baseSchedule({
        id: 89,
        title: "[TEST] 09 schedule",
        startTime,
        endTime,
        reminderOffsetMinutes: 30,
      }),
    ] as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    const incompleteSpy = vi
      .spyOn(notifications, "createScheduleIncompleteReminder")
      .mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("member")).schedules.create({
      title: "[TEST] 09 schedule",
      type: "고객상담",
      startTime: "2026-05-22T09:00:00",
      endTime: "2026-05-22T10:00:00",
      reminderOffsetMinutes: 30,
    });

    expect(db.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ startTime, endTime })
    );
    expect(formatKstLocalDateTime(startTime)).toBe("2026-05-22T09:00:00");
    expect(formatKstLocalDateTime(endTime)).toBe("2026-05-22T10:00:00");
    expect(reminderSpy).toHaveBeenCalledWith(
      89,
      4,
      startTime,
      "[TEST] 09 schedule",
      30
    );
    expect(incompleteSpy).toHaveBeenCalledWith(
      89,
      4,
      endTime,
      "[TEST] 09 schedule"
    );
  });

  it("links schedules to accessible customers without changing reminder creation", async () => {
    const startTime = kst("2026-05-22T11:00:00");
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);
    const createSpy = vi
      .spyOn(db, "createSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      baseSchedule({
        id: 90,
        title: "[TEST] linked customer",
        startTime,
        customerId: 100,
      }),
    ] as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .schedules.create({
        title: "[TEST] linked customer",
        type: "고객상담",
        startTime: "2026-05-22T11:00:00",
        reminderOffsetMinutes: 30,
        customerId: 100,
      });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 100 })
    );
    expect(reminderSpy).toHaveBeenCalledWith(
      90,
      4,
      startTime,
      "[TEST] linked customer",
      30
    );
  });

  it("blocks linking schedules to customers outside the actor scope", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 101,
      agentId: 99,
      assignedTeamId: 11,
      subBranchAdminId: 3,
      isActive: true,
      deletedAt: null,
    } as any);
    const createSpy = vi
      .spyOn(db, "createSchedule")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .schedules.create({
          title: "[TEST] blocked linked customer",
          type: "고객상담",
          startTime: "2026-05-22T11:00:00",
          customerId: 101,
        })
    ).rejects.toThrow();

    expect(createSpy).not.toHaveBeenCalled();
  });

  it("blocks schedule creation for inactive and resigned target users", async () => {
    for (const accountStatus of ["inactive", "resigned"] as const) {
      vi.restoreAllMocks();
      vi.spyOn(db, "getUserById").mockResolvedValue({
        id: 5,
        name: "[TEST] Target",
        role: "member",
        accountStatus,
        teamId: 10,
        subBranchAdminId: 2,
      } as any);
      vi.spyOn(db, "getAllUsers").mockResolvedValue([
        {
          id: 1,
          role: "branch_admin",
          accountStatus: "active",
          teamId: null,
          subBranchAdminId: null,
        },
        {
          id: 5,
          role: "member",
          accountStatus,
          teamId: 10,
          subBranchAdminId: 2,
        },
      ] as any);
      vi.spyOn(db, "getAllTeams").mockResolvedValue([] as any);
      const createSpy = vi
        .spyOn(db, "createSchedule")
        .mockResolvedValue(undefined);

      await expect(
        appRouter
          .createCaller(createCtx("branch_admin", { userId: 1 }))
          .schedules.create({
            title: "[TEST] blocked target",
            type: "怨좉컼?곷떞",
            startTime: "2026-05-22T11:00:00",
            targetUserId: 5,
          })
      ).rejects.toThrow();

      expect(createSpy).not.toHaveBeenCalled();
    }
  });

  it("updates and clears schedule customer context with existing schedule scope", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([baseSchedule()] as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleIncompleteNotification"
    ).mockResolvedValue(undefined);
    vi.spyOn(notifications, "createScheduleReminderByOffset").mockResolvedValue(
      undefined
    );
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .schedules.update({ id: 77, customerId: 100 });
    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .schedules.update({ id: 77, customerId: null });

    expect(updateSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({ customerId: 100 })
    );
    expect(updateSpy.mock.calls[1][1]).toEqual(
      expect.objectContaining({ customerId: null })
    );
  });

  it("blocks schedule updates when the existing schedule target is inactive or resigned", async () => {
    for (const accountStatus of ["inactive", "resigned"] as const) {
      vi.restoreAllMocks();
      vi.spyOn(db, "getScheduleById").mockResolvedValue(
        baseSchedule({ userId: 5 }) as any
      );
      vi.spyOn(db, "getUserById").mockResolvedValue({
        id: 5,
        role: "member",
        accountStatus,
        teamId: 10,
        subBranchAdminId: 2,
      } as any);
      const updateSpy = vi
        .spyOn(db, "updateSchedule")
        .mockResolvedValue(undefined);

      await expect(
        appRouter
          .createCaller(createCtx("branch_admin", { userId: 1 }))
          .schedules.update({
            id: 77,
            title: "[TEST] blocked update",
          })
      ).rejects.toThrow();

      expect(updateSpy).not.toHaveBeenCalled();
    }
  });

  it("updates start/end datetimes, persists reminderOffsetMinutes, and recalculates timing notifications", async () => {
    const newStart = kst("2026-05-23T18:30:00");
    const newEnd = kst("2026-05-23T19:30:00");
    vi.spyOn(db, "getSchedules").mockResolvedValue([baseSchedule()] as any);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const cancelTimingSpy = vi
      .spyOn(notifications, "cancelScheduleTimingNotifications")
      .mockResolvedValue(undefined);
    const cancelIncompleteSpy = vi
      .spyOn(notifications, "cancelScheduleIncompleteNotification")
      .mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    const incompleteSpy = vi
      .spyOn(notifications, "createScheduleIncompleteReminder")
      .mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("member")).schedules.update({
      id: 77,
      startTime: "2026-05-23T18:30:00",
      endTime: "2026-05-23T19:30:00",
      reminderOffsetMinutes: 30,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        startTime: newStart,
        endTime: newEnd,
        reminderOffsetMinutes: 30,
        reminderDayBefore: false,
        reminderSameDay: false,
        reminderOneHourBefore: false,
      })
    );
    expect(cancelTimingSpy).toHaveBeenCalledWith(4, 77);
    expect(reminderSpy).toHaveBeenCalledWith(77, 4, newStart, "보험 상담", 30);
    expect(cancelIncompleteSpy).toHaveBeenCalledWith(4, 77);
    expect(formatKstLocalDateTime(newStart)).toBe("2026-05-23T18:30:00");
    expect(formatKstLocalDateTime(newEnd)).toBe("2026-05-23T19:30:00");
    expect(incompleteSpy).toHaveBeenCalledWith(77, 4, newEnd, "보험 상담");
  });

  it("rejects updates when endTime is not after startTime", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([baseSchedule()] as any);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);

    await expect(
      appRouter.createCaller(createCtx("member")).schedules.update({
        id: 77,
        startTime: "2026-06-03T10:30:00",
        endTime: "2026-06-03T10:00:00",
      })
    ).rejects.toThrow("종료 시간은 시작 시간보다 늦어야 합니다.");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("persists reminder disabled state and skips creating a new timing notification", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([baseSchedule()] as any);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleIncompleteNotification"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("member")).schedules.update({
      id: 77,
      reminderOffsetMinutes: -1,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        reminderOffsetMinutes: -1,
        reminderDayBefore: false,
        reminderSameDay: false,
        reminderOneHourBefore: false,
      })
    );
    expect(reminderSpy).not.toHaveBeenCalled();
  });

  it("cancels timing and incomplete reminders when a schedule is cancelled", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([baseSchedule()] as any);
    vi.spyOn(db, "updateSchedule").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const cancelTimingSpy = vi
      .spyOn(notifications, "cancelScheduleTimingNotifications")
      .mockResolvedValue(undefined);
    const cancelIncompleteSpy = vi
      .spyOn(notifications, "cancelScheduleIncompleteNotification")
      .mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    const incompleteSpy = vi
      .spyOn(notifications, "createScheduleIncompleteReminder")
      .mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("member")).schedules.update({
      id: 77,
      status: "취소",
    });

    expect(cancelTimingSpy).toHaveBeenCalledWith(4, 77);
    expect(cancelIncompleteSpy).toHaveBeenCalledWith(4, 77);
    expect(reminderSpy).not.toHaveBeenCalled();
    expect(incompleteSpy).not.toHaveBeenCalled();
  });

  it("cancels timing and incomplete reminders when a schedule is deleted", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([baseSchedule()] as any);
    vi.spyOn(db, "softDeleteSchedule").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const cancelTimingSpy = vi
      .spyOn(notifications, "cancelScheduleTimingNotifications")
      .mockResolvedValue(undefined);
    const cancelIncompleteSpy = vi
      .spyOn(notifications, "cancelScheduleIncompleteNotification")
      .mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("member"))
      .schedules.delete({ id: 77 });

    expect(db.softDeleteSchedule).toHaveBeenCalledWith(77);
    expect(cancelTimingSpy).toHaveBeenCalledWith(4, 77);
    expect(cancelIncompleteSpy).toHaveBeenCalledWith(4, 77);
  });

  it("marks cancelled schedule reminders as read so unread count drops", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    vi.spyOn(db, "getDb").mockResolvedValue({
      session: { client: { execute } },
    } as any);

    await notifications.cancelScheduleTimingNotifications(4, 77);
    await notifications.cancelScheduleIncompleteNotification(4, 77);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0]).toContain("isRead = true");
    expect(execute.mock.calls[1][0]).toContain("isRead = true");
  });

  it("allows clearing optional endTime while saving reminderOffsetMinutes", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([baseSchedule()] as any);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleIncompleteNotification"
    ).mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    const incompleteSpy = vi
      .spyOn(notifications, "createScheduleIncompleteReminder")
      .mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("member")).schedules.update({
      id: 77,
      title: "종료 시간 없는 일정",
      endTime: null,
      reminderOffsetMinutes: 180,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        title: "종료 시간 없는 일정",
        endTime: null,
        reminderOffsetMinutes: 180,
        reminderDayBefore: false,
        reminderSameDay: false,
        reminderOneHourBefore: false,
      })
    );
    expect(reminderSpy).toHaveBeenCalledWith(
      77,
      4,
      baseSchedule().startTime,
      "종료 시간 없는 일정",
      180
    );
    expect(incompleteSpy).not.toHaveBeenCalled();
  });
  it("preserves existing start/end times when only title and memo change", async () => {
    const existing = baseSchedule({
      startTime: kst("2026-05-23T14:00:00"),
      endTime: kst("2026-05-23T15:00:00"),
      reminderOffsetMinutes: 30,
    });
    vi.spyOn(db, "getSchedules").mockResolvedValue([existing] as any);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleIncompleteNotification"
    ).mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    const incompleteSpy = vi
      .spyOn(notifications, "createScheduleIncompleteReminder")
      .mockResolvedValue(undefined);

    await appRouter.createCaller(createCtx("member")).schedules.update({
      id: 77,
      title: "[TEST] renamed",
      memo: "memo only",
    });

    expect(updateSpy).toHaveBeenCalledWith(
      77,
      expect.not.objectContaining({
        startTime: expect.any(Date),
        endTime: expect.any(Date),
      })
    );
    expect(reminderSpy).toHaveBeenCalledWith(
      77,
      4,
      existing.startTime,
      "[TEST] renamed",
      30
    );
    expect(incompleteSpy).toHaveBeenCalledWith(
      77,
      4,
      existing.endTime,
      "[TEST] renamed"
    );
    expect(formatKstLocalDateTime(existing.startTime)).toBe(
      "2026-05-23T14:00:00"
    );
    expect(formatKstLocalDateTime(existing.endTime)).toBe(
      "2026-05-23T15:00:00"
    );
  });

  it("preserves the unchanged date or time part when editing one local datetime component", async () => {
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleIncompleteNotification"
    ).mockResolvedValue(undefined);
    vi.spyOn(notifications, "createScheduleReminderByOffset").mockResolvedValue(
      undefined
    );
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);

    vi.spyOn(db, "getScheduleById").mockResolvedValue(
      baseSchedule({ startTime: kst("2026-05-23T14:00:00") }) as any
    );

    await appRouter.createCaller(createCtx("member")).schedules.update({
      id: 77,
      startTime: "2026-05-24T14:00:00",
    });
    await appRouter.createCaller(createCtx("member")).schedules.update({
      id: 77,
      startTime: "2026-05-23T18:30:00",
    });

    const dateOnlyChange = updateSpy.mock.calls[0][1].startTime as Date;
    const timeOnlyChange = updateSpy.mock.calls[1][1].startTime as Date;
    expect(formatKstLocalDateTime(dateOnlyChange)).toBe("2026-05-24T14:00:00");
    expect(formatKstLocalDateTime(timeOnlyChange)).toBe("2026-05-23T18:30:00");
  });

  it.each([
    ["branch_admin", 1],
    ["sub_branch_admin", 2],
    ["team_leader", 3],
    ["member", 4],
  ] as const)(
    "allows active %s to create an own schedule",
    async (role, userId) => {
      const createSpy = vi
        .spyOn(db, "createSchedule")
        .mockResolvedValue(undefined);
      vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);
      vi.spyOn(db, "getUserById").mockResolvedValue({
        id: userId,
        role,
        accountStatus: "active",
      } as any);
      vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

      await expect(
        appRouter.createCaller(createCtx(role, { userId })).schedules.create({
          title: "[TEST] own schedule",
          type: "기타",
          startTime: "2026-06-10T10:00:00",
        })
      ).resolves.toEqual({ success: true });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ userId, createdBy: userId })
      );
    }
  );

  it("allows branch_admin to create for another active user with distinct owner and creator", async () => {
    const createSpy = vi
      .spyOn(db, "createSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 5,
      role: "member",
      accountStatus: "active",
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .schedules.create({
          title: "[TEST] delegated schedule",
          type: "기타",
          startTime: "2026-06-10T10:00:00",
          targetUserId: 5,
        })
    ).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5, createdBy: 1 })
    );
  });

  it.each([
    ["sub_branch_admin", 2, 4],
    ["team_leader", 3, 4],
    ["member", 4, 5],
  ] as const)(
    "blocks %s from creating a schedule for user %i",
    async (role, actorId, targetUserId) => {
      const createSpy = vi
        .spyOn(db, "createSchedule")
        .mockResolvedValue(undefined);

      await expect(
        appRouter
          .createCaller(createCtx(role, { userId: actorId, teamId: 10 }))
          .schedules.create({
            title: "[TEST] forbidden delegated schedule",
            type: "기타",
            startTime: "2026-06-10T10:00:00",
            targetUserId,
          })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(createSpy).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["branch_admin", 1],
    ["sub_branch_admin", 2],
    ["team_leader", 3],
    ["member", 4],
  ] as const)(
    "allows active %s to update and delete an own schedule",
    async (role, userId) => {
      const owned = baseSchedule({ userId });
      vi.spyOn(db, "getScheduleById").mockResolvedValue(owned as any);
      const updateSpy = vi
        .spyOn(db, "updateSchedule")
        .mockResolvedValue(undefined);
      const deleteSpy = vi
        .spyOn(db, "softDeleteSchedule")
        .mockResolvedValue(undefined);
      mockScheduleMutationSideEffects();

      const caller = appRouter.createCaller(createCtx(role, { userId }));
      await expect(
        caller.schedules.update({ id: owned.id, title: "[TEST] updated" })
      ).resolves.toEqual({ success: true });
      await expect(caller.schedules.delete({ id: owned.id })).resolves.toEqual({
        success: true,
      });

      expect(updateSpy).toHaveBeenCalledWith(
        owned.id,
        expect.objectContaining({ title: "[TEST] updated" })
      );
      expect(deleteSpy).toHaveBeenCalledWith(owned.id);
    }
  );

  it("allows branch_admin to update and delete another user's schedule", async () => {
    const otherSchedule = baseSchedule({ userId: 5 });
    vi.spyOn(db, "getScheduleById").mockResolvedValue(otherSchedule as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 5,
      role: "member",
      accountStatus: "active",
    } as any);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    const deleteSpy = vi
      .spyOn(db, "softDeleteSchedule")
      .mockResolvedValue(undefined);
    mockScheduleMutationSideEffects();

    const caller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );
    await expect(
      caller.schedules.update({ id: otherSchedule.id, status: "완료" })
    ).resolves.toEqual({ success: true });
    await expect(
      caller.schedules.delete({ id: otherSchedule.id })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith(otherSchedule.id);
  });

  it.each([
    ["sub_branch_admin", 2, 4],
    ["team_leader", 3, 4],
    ["member", 4, 5],
  ] as const)(
    "blocks %s from updating or deleting user %i's schedule",
    async (role, actorId, ownerUserId) => {
      const otherSchedule = baseSchedule({ userId: ownerUserId });
      vi.spyOn(db, "getScheduleById").mockResolvedValue(otherSchedule as any);
      const updateSpy = vi
        .spyOn(db, "updateSchedule")
        .mockResolvedValue(undefined);
      const deleteSpy = vi
        .spyOn(db, "softDeleteSchedule")
        .mockResolvedValue(undefined);

      const caller = appRouter.createCaller(
        createCtx(role, { userId: actorId, teamId: 10 })
      );
      await expect(
        caller.schedules.update({ id: otherSchedule.id, status: "완료" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.schedules.update({
          id: otherSchedule.id,
          startTime: "2026-06-10T12:00:00",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.schedules.delete({ id: otherSchedule.id })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(updateSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();
    }
  );

  it("rejects ownership fields injected into schedule create and update payloads", async () => {
    const createSpy = vi
      .spyOn(db, "createSchedule")
      .mockResolvedValue(undefined);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createCtx("member", { userId: 4 }));

    await expect(
      caller.schedules.create({
        title: "[TEST] injected owner",
        type: "기타",
        startTime: "2026-06-10T10:00:00",
        userId: 5,
      } as any)
    ).rejects.toThrow();
    await expect(
      caller.schedules.update({ id: 77, userId: 5 } as any)
    ).rejects.toThrow();

    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it.each(["inactive", "resigned"] as const)(
    "blocks %s users from creating, updating, and deleting schedules",
    async accountStatus => {
      const caller = appRouter.createCaller(
        createCtx("member", { userId: 4, accountStatus })
      );
      await expect(
        caller.schedules.create({
          title: "[TEST] blocked account",
          type: "기타",
          startTime: "2026-06-10T10:00:00",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.schedules.update({ id: 77, status: "완료" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.schedules.delete({ id: 77 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  );

  it("uses the preserved KST wall-clock time for 30 minute reminder dueAt", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T00:00:00.000Z") });
    const execute = vi.fn().mockResolvedValue([]);
    vi.spyOn(db, "getDb").mockResolvedValue({
      session: { client: { execute } },
    } as any);

    await notifications.createScheduleReminderByOffset(
      91,
      4,
      kst("2026-05-22T12:00:00"),
      "[TEST] reminder",
      30
    );

    expect(execute).toHaveBeenCalledTimes(1);
    const dueAt = execute.mock.calls[0][1][6] as Date;
    expect(formatKstLocalDateTime(dueAt)).toBe("2026-05-22T11:30:00");
    vi.useRealTimers();
  });
});

describe("Follow-ups - KST local date policy", () => {
  const customer = {
    id: 100,
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    isActive: true,
    deletedAt: null,
  } as any;

  it("preserves the selected next contact local datetime when creating follow-ups", async () => {
    const createSpy = vi
      .spyOn(db, "createFollowUp")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(customer);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .followUps.create({
        customerId: 100,
        nextContactDate: "2026-05-22T10:00:00",
        reason: "[TEST] follow",
        nextAction: "전화",
      });

    const nextContactDate = createSpy.mock.calls[0][0].nextContactDate as Date;
    expect(formatKstLocalDateTime(nextContactDate)).toBe("2026-05-22T10:00:00");
  });

  it("creates a linked customer schedule when requested from follow-up creation", async () => {
    const startTime = parseKstLocalDateTime("2026-05-22T10:00:00");
    vi.spyOn(db, "getCustomerById").mockResolvedValue(customer);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "createFollowUp").mockResolvedValue(undefined);
    const scheduleSpy = vi
      .spyOn(db, "createSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      {
        id: 91,
        userId: 4,
        customerId: 100,
        title: "[TEST] follow schedule",
        startTime,
      } as any,
    ]);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .followUps.create({
        customerId: 100,
        nextContactDate: "2026-05-22T10:00:00",
        reason: "[TEST] follow",
        nextAction: "전화",
        calendarSchedule: {
          title: "[TEST] follow schedule",
          reminderOffsetMinutes: 30,
        },
      });

    expect(scheduleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 4,
        customerId: 100,
        title: "[TEST] follow schedule",
        type: "재통화",
        startTime,
        reminderOffsetMinutes: 30,
      })
    );
    expect(reminderSpy).toHaveBeenCalledWith(
      91,
      4,
      startTime,
      "[TEST] follow schedule",
      30
    );
  });

  it("blocks managers from creating linked schedules for subordinate customer owners", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(customer);
    const followUpSpy = vi
      .spyOn(db, "createFollowUp")
      .mockResolvedValue(undefined);
    const scheduleSpy = vi
      .spyOn(db, "createSchedule")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .followUps.create({
          customerId: 100,
          nextContactDate: "2026-05-22T10:00:00",
          reason: "[TEST] subordinate follow",
          nextAction: "전화",
          calendarSchedule: {
            title: "[TEST] forbidden subordinate schedule",
          },
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(followUpSpy).not.toHaveBeenCalled();
    expect(scheduleSpy).not.toHaveBeenCalled();
  });

  it("preserves the selected next contact local datetime when postponing follow-ups", async () => {
    vi.spyOn(db, "getFollowUpById").mockResolvedValue({
      id: 77,
      customerId: 100,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "scheduled",
      reason: "[TEST] follow",
      nextContactDate: parseKstLocalDateTime("2026-05-22T10:00:00"),
    } as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(customer);
    const updateSpy = vi
      .spyOn(db, "updateFollowUp")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .followUps.postpone({
        id: 77,
        nextContactDate: "2026-05-23T14:30:00",
        reason: "[TEST] postponed",
      });

    const nextContactDate = updateSpy.mock.calls[0][1].nextContactDate as Date;
    expect(formatKstLocalDateTime(nextContactDate)).toBe("2026-05-23T14:30:00");
  });
});

describe("RBAC - settings", () => {
  it("blocks non-branch_admin from settings.list", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .settings.list({ category: "region" })
    ).rejects.toThrow();
  });
  it("allows active users to fetch minimal formOptions", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .settings.formOptions({ category: "region" })
    ).resolves.toEqual([]);
  });
});

describe("Bulk import router policy", () => {
  it("allows CSV and XLSX fileName on previewImport", async () => {
    vi.spyOn(db, "getAllActiveCustomerPhones").mockResolvedValue(new Set());
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.previewImport({
          fileName: "customers.xlsx",
          rows: [
            { 이름: "테스트", 생년월일: "1990-01-15", 연락처: "010-1234-5678" },
          ],
        })
    ).resolves.toMatchObject({ totalRows: 1 });
  });

  it("blocks unsupported fileName on previewImport", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.previewImport({
          fileName: "customers.txt",
          rows: [
            { 이름: "테스트", 생년월일: "1990-01-15", 연락처: "010-1234-5678" },
          ],
        })
    ).rejects.toThrow();
  });

  it("blocks unsupported fileName on bulkImport", async () => {
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customers.bulkImport({
        fileName: "customers.txt",
        rows: [
          { 이름: "테스트", 생년월일: "1990-01-15", 연락처: "010-1234-5678" },
        ],
      })
    ).rejects.toThrow();
  });

  it("keeps bulk import template access branch_admin only", async () => {
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const branchTemplate = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customers.downloadImportTemplate();

    expect(branchTemplate.requiredHeaders).toEqual([
      "이름",
      "생년월일",
      "연락처",
    ]);
    expect(branchTemplate.headers).toContain("담당자");
    expect(branchTemplate.headers).not.toContain("부지점장");
    expect(branchTemplate.headers).not.toContain("팀");
    expect(branchTemplate.assigneeHeaderEnabled).toBe(true);
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .customers.downloadImportTemplate()
    ).rejects.toThrow();

    const teamLeaderTemplate = await appRouter
      .createCaller(
        createCtx("team_leader", {
          teamId: 10,
          permissions: [CUSTOMER_BULK_IMPORT_PERMISSION],
        })
      )
      .customers.downloadImportTemplate();
    expect(teamLeaderTemplate.assigneeHeaderEnabled).toBe(false);

    const subBranchTemplate = await appRouter
      .createCaller(
        createCtx("sub_branch_admin", {
          subBranchAdminId: 2,
          permissions: [CUSTOMER_BULK_IMPORT_PERMISSION],
        })
      )
      .customers.downloadImportTemplate();
    expect(subBranchTemplate.assigneeHeaderEnabled).toBe(false);
  });
});

describe("PR18-4 - direct customer creation assignment policy", () => {
  it("allows branch_admin to create a customer assigned to self by default", async () => {
    vi.spyOn(db, "checkPhoneDuplicate").mockResolvedValue(undefined);
    const createSpy = vi
      .spyOn(db, "createCustomer")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .customers.create({
          name: "[TEST] Branch Direct",
          phone: "010-1000-0001",
          dbCompany: "[TEST] Vendor",
        })
    ).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "[TEST] Branch Direct",
        dbCompany: "[TEST] Vendor",
        agentId: 1,
        assignedTeamId: null,
        subBranchAdminId: null,
        assignmentStatus: "assigned_to_agent",
        createdBy: 1,
      })
    );
  });

  it("allows branch_admin to choose an active assignee", async () => {
    vi.spyOn(db, "checkPhoneDuplicate").mockResolvedValue(undefined);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    const createSpy = vi
      .spyOn(db, "createCustomer")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.create({
        name: "[TEST] Assigned Direct",
        phone: "010-1000-0002",
        agentId: 4,
      });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 4,
        assignedTeamId: 10,
        subBranchAdminId: 2,
        assignmentStatus: "assigned_to_agent",
      })
    );
  });

  it("allows member to create only self-assigned customers", async () => {
    vi.spyOn(db, "checkPhoneDuplicate").mockResolvedValue(undefined);
    const createSpy = vi
      .spyOn(db, "createCustomer")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await appRouter
      .createCaller(
        createCtx("member", { userId: 44, teamId: 10, subBranchAdminId: 2 })
      )
      .customers.create({
        name: "[TEST] Member Direct",
        phone: "010-1000-0003",
      });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 44,
        assignedTeamId: 10,
        subBranchAdminId: 2,
        assignmentStatus: "assigned_to_agent",
        createdBy: 44,
      })
    );
  });

  it("allows team_leader and sub_branch_admin to create self-assigned customers", async () => {
    vi.spyOn(db, "checkPhoneDuplicate").mockResolvedValue(undefined);
    const createSpy = vi
      .spyOn(db, "createCustomer")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await appRouter
      .createCaller(
        createCtx("team_leader", {
          userId: 33,
          teamId: 10,
          subBranchAdminId: 2,
        })
      )
      .customers.create({
        name: "[TEST] Leader Direct",
        phone: "010-1000-0004",
      });
    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 22 }))
      .customers.create({
        name: "[TEST] Sub Direct",
        phone: "010-1000-0005",
      });

    expect(createSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        agentId: 33,
        assignedTeamId: 10,
        subBranchAdminId: 2,
      })
    );
    expect(createSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        agentId: 22,
        assignedTeamId: null,
        subBranchAdminId: 22,
      })
    );
  });

  it("blocks non-admin from assigning a direct-created customer to another user", async () => {
    vi.spyOn(db, "checkPhoneDuplicate").mockResolvedValue(undefined);
    vi.spyOn(db, "createCustomer").mockResolvedValue(undefined);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 44 }))
        .customers.create({
          name: "[TEST] Bad Assignment",
          phone: "010-1000-0006",
          agentId: 45,
        })
    ).rejects.toThrow("본인만 지정");
  });

  it("blocks inactive users from creating customers", async () => {
    await expect(
      appRouter.createCaller(createInactiveCtx("member")).customers.create({
        name: "[TEST] Inactive Direct",
      })
    ).rejects.toThrow("계정이 비활성화되었습니다.");
  });
});

describe("Bulk import branch-admin access policy", () => {
  const row = {
    name: "[TEST] Bulk",
    birthDate: "1990-01-15",
    phone: "010-2000-0001",
  };

  it("blocks users without bulk import permission", async () => {
    const memberCaller = appRouter.createCaller(
      createCtx("member", { userId: 44, teamId: 10, subBranchAdminId: 2 })
    );

    await expect(
      memberCaller.customers.downloadImportTemplate()
    ).rejects.toThrow();
    await expect(
      memberCaller.customers.previewImport({
        fileName: "customers.csv",
        rows: [row],
      })
    ).rejects.toThrow();
    await expect(
      memberCaller.customers.bulkImport({
        fileName: "customers.csv",
        rows: [row],
      })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(
          createCtx("member", {
            userId: 44,
            teamId: 10,
            subBranchAdminId: 2,
            permissions: [CUSTOMER_BULK_IMPORT_PERMISSION],
          })
        )
        .customers.downloadImportTemplate()
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .customers.downloadImportTemplate()
    ).rejects.toThrow();
  });

  it("allows team_leader with customers.bulk_import permission and keeps self assignment", async () => {
    vi.spyOn(db, "getAllActiveCustomerPhones").mockResolvedValue(new Set());
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createImportBatch").mockResolvedValue(undefined);
    const bulkCreateSpy = vi
      .spyOn(db, "bulkCreateCustomers")
      .mockResolvedValue([] as any);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({})
    );

    await appRouter
      .createCaller(
        createCtx("team_leader", {
          userId: 3,
          teamId: 10,
          subBranchAdminId: 2,
          permissions: [CUSTOMER_BULK_IMPORT_PERMISSION],
        })
      )
      .customers.bulkImport({
        fileName: "customers.csv",
        rows: [{ ...row, name: "[TEST] Bulk Team Leader" }],
      });

    expect(bulkCreateSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: "[TEST] Bulk Team Leader",
          agentId: 3,
          assignedTeamId: 10,
          subBranchAdminId: 2,
        }),
      ],
      {}
    );
  });

  it("allows branch_admin bulk import to force a selected assignee", async () => {
    vi.spyOn(db, "getAllActiveCustomerPhones").mockResolvedValue(new Set());
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const preview = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.previewImport({
        fileName: "customers.csv",
        rows: [{ ...row, name: "[TEST] Bulk Branch" }],
        agentId: 4,
      });

    expect(preview.validationResults[0]).toMatchObject({
      isValid: true,
      agentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      assignmentStatus: "assigned_to_agent",
    });
  });

  it("allows branch_admin bulk import to persist a selected assignee", async () => {
    vi.spyOn(db, "getAllActiveCustomerPhones").mockResolvedValue(new Set());
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createImportBatch").mockResolvedValue(undefined);
    const bulkCreateSpy = vi
      .spyOn(db, "bulkCreateCustomers")
      .mockResolvedValue([] as any);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({})
    );

    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.bulkImport({
        fileName: "customers.xlsx",
        rows: [
          { ...row, name: "[TEST] Bulk Status", "DB 업체명": "[TEST] Vendor" },
        ],
        agentId: 4,
      });

    expect(bulkCreateSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: "[TEST] Bulk Status",
          dbCompany: "[TEST] Vendor",
          agentId: 4,
        }),
      ],
      {}
    );
  });

  it("does not create consultation history when 상담기록 is empty", async () => {
    vi.spyOn(db, "getAllActiveCustomerPhones")
      .mockResolvedValueOnce(new Set())
      .mockResolvedValueOnce(new Set());
    vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createImportBatch").mockResolvedValue(undefined);
    vi.spyOn(db, "bulkCreateCustomers").mockResolvedValue([{ insertId: 10 }] as any);
    const createConsultationSpy = vi
      .spyOn(db, "createConsultation")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({})
    );

    await appRouter.createCaller(createCtx("branch_admin", { userId: 1 })).customers.bulkImport({
      fileName: "customers.csv",
      rows: [
        {
          ...row,
          name: "[TEST] No Consultation Log",
          상담기록: "",
        },
      ],
    });

    expect(createConsultationSpy).not.toHaveBeenCalled();
  });

  it("stores imported consultation with assignee in agentId and uploader metadata while skipping customer status update side effects", async () => {
    const existingCustomer = {
      id: 77,
      name: "[TEST] Existing",
      phone: "01020000009",
      consultStatus: "미상담",
      isActive: true,
    } as any;
    vi.spyOn(db, "getAllActiveCustomerPhones")
      .mockResolvedValueOnce(new Set(["01020000009"]))
      .mockResolvedValueOnce(new Set(["01020000009"]));
    vi.spyOn(db, "getCustomers").mockResolvedValue([existingCustomer]);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createImportBatch").mockResolvedValue(undefined);
    vi.spyOn(db, "bulkCreateCustomers").mockResolvedValue([] as any);
    const updateCustomerSpy = vi
      .spyOn(db, "updateCustomer")
      .mockResolvedValue(undefined);
    const createConsultationSpy = vi
      .spyOn(db, "createConsultation")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({})
    );

    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.bulkImport({
        fileName: "customers.xlsx",
        rows: [
          {
            ...row,
            phone: "010-2000-0009",
            담당자: "담당자A",
            상담기록: "부재",
            상담메모: "",
          },
        ],
        agentId: 4,
      });

    expect(updateCustomerSpy).toHaveBeenCalledTimes(1);
    const updatedPayload = updateCustomerSpy.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(updatedPayload).toBeDefined();
    expect("consultStatus" in updatedPayload).toBe(false);

    expect(createConsultationSpy).toHaveBeenCalledTimes(1);
    const createConsultArgs = createConsultationSpy.mock.calls[0] as any[];
    expect(createConsultArgs[0]).toEqual(
      expect.objectContaining({
        customerId: 77,
        agentId: 4,
        consultationType: "DB 통화결과",
      })
    );
    expect(String(createConsultArgs[0].content)).toContain("작성자:1");
    expect(String(createConsultArgs[0].content)).toContain("담당자:4");
    expect(createConsultArgs[2]).toEqual(
      expect.objectContaining({ updateCustomerConsultStatus: false })
    );
  });

  it("returns partial success for invalid 상담기록 rows", async () => {
    vi.spyOn(db, "getAllActiveCustomerPhones")
      .mockResolvedValueOnce(new Set())
      .mockResolvedValueOnce(new Set());
    vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createImportBatch").mockResolvedValue(undefined);
    vi.spyOn(db, "bulkCreateCustomers").mockResolvedValue([{ insertId: 11 }] as any);
    vi.spyOn(db, "createConsultation").mockResolvedValue(undefined);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({})
    );

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.bulkImport({
        fileName: "customers.csv",
        rows: [
          { ...row, name: "[TEST] Valid 상담기록", 상담기록: "상담 예정" },
          { ...row, name: "[TEST] Invalid 상담기록", phone: "010-2000-0012", 상담기록: "알수없음" },
        ],
      });

    expect(result.successRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.consultationCreatedRows).toBe(1);
    expect(result.validationResults[1]?.errors).toContain(
      "상담기록은 전화끊음, 입원중, 부재, 거절, 상담예정 중 하나로 입력해 주세요."
    );
  });

  it("lets branch_admin grant and revoke customers.bulk_import only for managers", async () => {
    const setPermissionSpy = vi
      .spyOn(db, "setUserPermission")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "getUserById")
      .mockResolvedValueOnce({
        id: 3,
        role: "team_leader",
        accountStatus: "active",
      } as any)
      .mockResolvedValueOnce({
        id: 2,
        role: "sub_branch_admin",
        accountStatus: "active",
      } as any)
      .mockResolvedValueOnce({
        id: 4,
        role: "member",
        accountStatus: "active",
      } as any)
      .mockResolvedValueOnce({
        id: 5,
        role: "team_leader",
        accountStatus: "inactive",
      } as any);

    const caller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );

    await expect(
      caller.users.updatePermission({
        userId: 3,
        permission: CUSTOMER_BULK_IMPORT_PERMISSION,
        enabled: true,
      })
    ).resolves.toEqual({ success: true });
    await expect(
      caller.users.updatePermission({
        userId: 2,
        permission: CUSTOMER_BULK_IMPORT_PERMISSION,
        enabled: false,
      })
    ).resolves.toEqual({ success: true });
    await expect(
      caller.users.updatePermission({
        userId: 4,
        permission: CUSTOMER_BULK_IMPORT_PERMISSION,
        enabled: true,
      })
    ).rejects.toThrow();
    await expect(
      caller.users.updatePermission({
        userId: 5,
        permission: CUSTOMER_BULK_IMPORT_PERMISSION,
        enabled: true,
      })
    ).rejects.toThrow();

    expect(setPermissionSpy).toHaveBeenNthCalledWith(
      1,
      3,
      CUSTOMER_BULK_IMPORT_PERMISSION,
      true,
      1
    );
    expect(setPermissionSpy).toHaveBeenNthCalledWith(
      2,
      2,
      CUSTOMER_BULK_IMPORT_PERMISSION,
      false,
      1
    );
  });
});

describe("PR19-2 - FCM device token registration", () => {
  const token = "fcm_test_registration_token_1234567890";

  it("allows active users to register an Android device token without logging plaintext token", async () => {
    const savedToken = {
      id: 10,
      userId: 4,
      platform: "android",
      token,
      deviceId: "device-1",
      appVersion: "1.0.0",
      deviceModel: "Android Test",
      osVersion: "13",
      isActive: true,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      revokedAt: null,
    };
    const upsertSpy = vi
      .spyOn(db, "upsertUserDeviceToken")
      .mockResolvedValue(savedToken as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .deviceTokens.register({
        token,
        platform: "android",
        deviceId: "device-1",
        appVersion: "1.0.0",
        deviceModel: "Android Test",
        osVersion: "13",
      });

    expect(result).toMatchObject({ success: true, id: 10 });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 4,
        token,
        platform: "android",
        isActive: true,
      })
    );
    const details = String(logSpy.mock.calls[0]?.[0]?.details ?? "");
    expect(details).not.toContain(token);
    expect(details).toContain("tokenHash");
  });

  it("blocks inactive users from registering device tokens", async () => {
    await expect(
      appRouter
        .createCaller(createInactiveCtx("member"))
        .deviceTokens.register({
          token,
          platform: "android",
        })
    ).rejects.toThrow("계정이 비활성화되었습니다.");
  });

  it("blocks resigned users from registering device tokens", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .deviceTokens.register({
          token,
          platform: "android",
        })
    ).rejects.toThrow();
  });

  it("uses upsert behavior for repeated token registration", async () => {
    const upsertSpy = vi.spyOn(db, "upsertUserDeviceToken").mockResolvedValue({
      id: 11,
      userId: 4,
      platform: "android",
      token,
      isActive: true,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      revokedAt: null,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createCtx("member", { userId: 4 }));

    await caller.deviceTokens.register({ token, platform: "android" });
    await caller.deviceTokens.register({ token, platform: "android" });

    expect(upsertSpy).toHaveBeenCalledTimes(2);
  });

  it("deactivates only the current user's token without logging plaintext token", async () => {
    const deactivateSpy = vi
      .spyOn(db, "deactivateUserDeviceToken")
      .mockResolvedValue(1);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .deviceTokens.deactivate({ token });

    expect(result).toEqual({ success: true, affectedCount: 1 });
    expect(deactivateSpy).toHaveBeenCalledWith(4, token);
    const details = String(logSpy.mock.calls[0]?.[0]?.details ?? "");
    expect(details).not.toContain(token);
    expect(details).toContain("tokenHash");
  });

  it("does not expose plaintext tokens in listMine", async () => {
    vi.spyOn(db, "listUserDeviceTokens").mockResolvedValue([
      {
        id: 12,
        userId: 4,
        platform: "android",
        token,
        deviceId: "device-1",
        appVersion: "1.0.0",
        deviceModel: "Android Test",
        osVersion: "13",
        isActive: true,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        revokedAt: null,
      },
    ] as any);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .deviceTokens.listMine();

    expect(result[0]).not.toHaveProperty("token");
    expect(result[0].tokenMasked).not.toBe(token);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("blocks attempts to deactivate malformed or short tokens", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .deviceTokens.deactivate({ token: "short-token" })
    ).rejects.toThrow();
  });
});

// ─── RBAC - branch_admin only ─────────────────────────────────────────────────
describe("PR19-3 - safe FCM work notifications", () => {
  const token = "fcm_push_token_1234567890";

  it("sends safe push payloads to active device tokens and stores no plaintext token in push logs", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue(null);
    const createLogSpy = vi
      .spyOn(db, "createPushNotificationLog")
      .mockResolvedValue({
        id: 9,
        type: "today_follow_up",
        userId: 4,
        dedupeKey: "follow_up:1:2026-05-13:today:user:4",
        status: "skipped",
        createdAt: new Date(),
      } as any);
    const updateLogSpy = vi
      .spyOn(db, "updatePushNotificationLog")
      .mockResolvedValue(undefined);
    pushNotifications.setPushSenderForTests(async tokens =>
      tokens.map(item => ({ token: item, success: true }))
    );

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.todayFollowUp,
      {
        type: "today_follow_up",
        sourceType: "follow_up",
        sourceId: 1,
        dedupeKey: "follow_up:1:2026-05-13:today",
        now: new Date("2026-05-13T03:00:00.000Z"),
      }
    );

    expect(result.sentCount).toBe(1);
    expect(JSON.stringify(createLogSpy.mock.calls)).not.toContain(token);
    expect(JSON.stringify(updateLogSpy.mock.calls)).not.toContain(token);
  });

  it("skips users without active device tokens", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([]);

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.test,
      {
        type: "test",
        dedupeKey: "test:4",
        now: new Date("2026-05-13T03:00:00.000Z"),
      }
    );

    expect(result.disabledReason).toBe("no_tokens");
    expect(result.tokenCount).toBe(0);
  });

  it("blocks sensitive content in push payloads", () => {
    expect(() =>
      pushNotifications.sanitizePushPayload({
        title: "BOA 업무 알림",
        body: "010-1234-5678 고객 확인",
      } as any)
    ).toThrow();
    expect(() =>
      pushNotifications.sanitizePushPayload({
        title: "BOA 일정 알림",
        body: "예정된 일정이 있습니다.",
        data: { customerName: "고객명" },
      })
    ).toThrow();
  });

  it("deactivates invalid tokens after FCM failure", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue(null);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 9,
      type: "test",
      userId: 4,
      dedupeKey: "test:invalid:user:4",
      status: "skipped",
      createdAt: new Date(),
    } as any);
    vi.spyOn(db, "updatePushNotificationLog").mockResolvedValue(undefined);
    const deactivateSpy = vi
      .spyOn(db, "deactivateDeviceTokenByToken")
      .mockResolvedValue(1);
    pushNotifications.setPushSenderForTests(async () => [
      {
        token,
        success: false,
        errorCode: "messaging/registration-token-not-registered",
      },
    ]);

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.test,
      {
        type: "test",
        dedupeKey: "test:invalid",
        now: new Date("2026-05-13T03:00:00.000Z"),
      }
    );

    expect(result.failureCount).toBe(1);
    expect(deactivateSpy).toHaveBeenCalledWith(token);
  });

  it("prevents duplicate push sends by dedupe key", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue({
      id: 99,
    } as any);
    const sender = vi.fn(async () => [{ token, success: true }]);
    pushNotifications.setPushSenderForTests(sender);

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.test,
      {
        type: "test",
        dedupeKey: "test:duplicate",
        now: new Date("2026-05-13T03:00:00.000Z"),
      }
    );

    expect(result.duplicateSkippedCount).toBe(1);
    expect(sender).not.toHaveBeenCalled();
  });

  it("calls branch admin push service when a contract delete request is created", async () => {
    const activeContract = {
      id: 10,
      customerId: 100,
      agentId: 4,
      isActive: true,
      deletedAt: null,
    } as any;
    const activeCustomer = {
      id: 100,
      agentId: 4,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getPendingDeleteRequestForTarget")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 77, status: "pending" } as any);
    vi.spyOn(db, "createDeleteRequest").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const pushSpy = vi
      .spyOn(pushNotifications, "sendContractDeleteRequestPush")
      .mockResolvedValue({
        requestedUserIds: [1],
        tokenCount: 1,
        sentCount: 1,
        failureCount: 0,
        skippedCount: 0,
        duplicateSkippedCount: 0,
      });

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "[TEST] delete request",
        })
    ).resolves.toEqual({ success: true });

    expect(pushSpy).toHaveBeenCalledWith(77);
  });

  it("blocks non-admin users from test push APIs", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .pushNotifications.sendTestToMe()
    ).rejects.toThrow();
  });

  it("creates default push preferences for active users", async () => {
    const preference = {
      id: 1,
      userId: 4,
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue(
      preference as any
    );

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .pushNotifications.getPreferences();

    expect(result).toMatchObject({
      userId: 4,
      followUpTodayEnabled: true,
      timezone: "Asia/Seoul",
    });
  });

  it("allows users to update only their own push preferences", async () => {
    const updateSpy = vi
      .spyOn(db, "updatePushNotificationPreference")
      .mockResolvedValue({
        id: 1,
        userId: 4,
        followUpTodayEnabled: false,
        scheduleReminderEnabled: true,
        deleteRequestEnabled: true,
        testNotificationEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: "21:00",
        quietHoursEnd: "08:00",
        timezone: "Asia/Seoul",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .pushNotifications.updatePreferences({ followUpTodayEnabled: false });

    expect(updateSpy).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ followUpTodayEnabled: false })
    );
  });

  it("bridges due notification-center events into safe FCM push attempts", async () => {
    vi.spyOn(db, "getDb").mockResolvedValue({
      session: {
        client: {
          execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
        },
      },
    } as any);
    const sendSpy = vi
      .spyOn(pushNotifications, "sendPushToUsers")
      .mockResolvedValue({
        requestedUserIds: [4],
        tokenCount: 0,
        sentCount: 0,
        failureCount: 0,
        skippedCount: 1,
        duplicateSkippedCount: 0,
        disabledSkippedCount: 0,
        quietHoursSkippedCount: 0,
        invalidTokenDeactivatedCount: 0,
        statuses: { 4: "skipped_no_token" },
      });

    await notifications.createNotificationSafe({
      userId: 4,
      type: "contract_180",
      title: "[TEST] contract milestone",
      message: "[TEST] contract milestone",
      relatedType: "contract",
      relatedId: 200,
      dueAt: parseKstLocalDateTime("2026-05-20T09:00:00"),
    });

    expect(sendSpy).toHaveBeenCalledWith(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.contract180,
      expect.objectContaining({
        type: "contract_180",
        sourceType: "contract",
        sourceId: 200,
        dedupeKey: expect.stringContaining(
          "notification:contract_180:contract:200"
        ),
      })
    );
  });

  it("skips today follow-up push when the user's preference is disabled", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: false,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    const createLogSpy = vi
      .spyOn(db, "createPushNotificationLog")
      .mockResolvedValue({ id: 3, status: "skipped_disabled" } as any);

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.todayFollowUp,
      {
        type: "today_follow_up",
        dedupeKey: "follow_up:disabled",
      }
    );

    expect(result.disabledSkippedCount).toBe(1);
    expect(result.statuses[4]).toBe("skipped_disabled");
    expect(JSON.stringify(createLogSpy.mock.calls)).toContain(
      "skipped_disabled"
    );
  });

  it("skips schedule reminders when the user's schedule preference is disabled", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: false,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.schedule30Minute,
      {
        type: "schedule_30min",
        dedupeKey: "schedule:disabled",
      }
    );

    expect(result.statuses[4]).toBe("skipped_disabled");
  });

  it("skips contract delete request pushes when the user's delete-request preference is disabled", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 1, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: false,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);

    const result = await pushNotifications.sendPushToUsers(
      [1],
      pushNotifications.SAFE_PUSH_PAYLOADS.contractDeleteRequest,
      {
        type: "contract_delete_request",
        dedupeKey: "delete-request:disabled",
      }
    );

    expect(result.statuses[1]).toBe("skipped_disabled");
  });

  it("skips push during quiet hours", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.schedule30Minute,
      {
        type: "schedule_30min",
        dedupeKey: "schedule:quiet",
        now: new Date("2026-05-13T13:00:00.000Z"),
      }
    );

    expect(result.quietHoursSkippedCount).toBe(1);
    expect(result.statuses[4]).toBe("skipped_quiet_hours");
  });

  it("calculates quiet hours in Asia/Seoul by default boundaries", () => {
    const preference = {
      quietHoursEnabled: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    };

    expect(
      pushNotifications.isInQuietHours(
        preference,
        parseKstLocalDateTime("2026-05-22T07:59:00")
      )
    ).toBe(true);
    expect(
      pushNotifications.isInQuietHours(
        preference,
        parseKstLocalDateTime("2026-05-22T08:00:00")
      )
    ).toBe(false);
    expect(
      pushNotifications.isInQuietHours(
        preference,
        parseKstLocalDateTime("2026-05-22T21:00:00")
      )
    ).toBe(true);
  });

  it("selects schedule push targets by reminderOffsetMinutes dueAt instead of fixed 30 minutes", () => {
    const candidates = pushNotifications.getSchedulePushCandidates(
      [
        {
          id: 501,
          userId: 4,
          status: "예정",
          startTime: parseKstLocalDateTime("2026-05-22T12:00:00"),
          reminderOffsetMinutes: 120,
          isActive: true,
        },
        {
          id: 502,
          userId: 4,
          status: "예정",
          startTime: parseKstLocalDateTime("2026-05-22T10:30:00"),
          reminderOffsetMinutes: 60,
          isActive: true,
        },
      ] as any,
      {
        now: parseKstLocalDateTime("2026-05-22T10:00:00"),
        lookbackMinutes: 10,
      }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: "reminder",
      scheduleId: 501,
      userId: 4,
    });
    expect(candidates[0].dedupeKey).toContain("reminder:120");
  });

  it("calculates a 07:13 schedule with a 60 minute reminder as a 06:13 dueAt", () => {
    const candidates = pushNotifications.getSchedulePushCandidates(
      [
        {
          id: 503,
          userId: 4,
          status: "예정",
          startTime: parseKstLocalDateTime("2026-05-22T07:13:00"),
          reminderOffsetMinutes: 60,
          isActive: true,
        },
      ] as any,
      {
        now: parseKstLocalDateTime("2026-05-22T06:13:00"),
        lookbackMinutes: 30,
      }
    );

    expect(candidates).toHaveLength(1);
    expect(
      formatKstLocalDateTime(candidates[0].dueAt, { seconds: false })
    ).toBe("2026-05-22T06:13");
    expect(candidates[0].dedupeKey).toContain("reminder:60");
  });

  it("uses the lookback window to distinguish missed schedule reminder candidates", () => {
    const schedule = {
      id: 504,
      userId: 4,
      status: "예정",
      startTime: parseKstLocalDateTime("2026-05-22T07:13:00"),
      reminderOffsetMinutes: 60,
      isActive: true,
    };

    expect(
      pushNotifications.getSchedulePushCandidates([schedule] as any, {
        now: parseKstLocalDateTime("2026-05-22T06:42:00"),
        lookbackMinutes: 30,
      })
    ).toHaveLength(1);
    expect(
      pushNotifications.getSchedulePushCandidates([schedule] as any, {
        now: parseKstLocalDateTime("2026-05-22T06:44:00"),
        lookbackMinutes: 30,
      })
    ).toHaveLength(0);
  });

  it("excludes deleted, cancelled, completed, no-show, and completedAt schedules from schedule push candidates", () => {
    const dueStart = parseKstLocalDateTime("2026-05-22T10:05:00");
    const candidates = pushNotifications.getSchedulePushCandidates(
      [
        {
          id: 601,
          userId: 4,
          status: "예정",
          startTime: dueStart,
          reminderOffsetMinutes: 0,
          isActive: false,
        },
        {
          id: 602,
          userId: 4,
          status: "취소",
          startTime: dueStart,
          reminderOffsetMinutes: 0,
          isActive: true,
        },
        {
          id: 603,
          userId: 4,
          status: "완료",
          startTime: dueStart,
          reminderOffsetMinutes: 0,
          isActive: true,
        },
        {
          id: 604,
          userId: 4,
          status: "노쇼",
          startTime: dueStart,
          reminderOffsetMinutes: 0,
          isActive: true,
        },
        {
          id: 605,
          userId: 4,
          status: "예정",
          startTime: dueStart,
          reminderOffsetMinutes: 0,
          isActive: true,
          deletedAt: new Date(),
        },
        {
          id: 606,
          userId: 4,
          status: "예정",
          startTime: dueStart,
          reminderOffsetMinutes: 0,
          isActive: true,
          completedAt: new Date(),
        },
      ] as any,
      {
        now: parseKstLocalDateTime("2026-05-22T10:05:00"),
        lookbackMinutes: 10,
      }
    );

    expect(candidates).toEqual([]);
  });

  it("creates incomplete schedule push candidates without customer data", () => {
    const candidates = pushNotifications.getSchedulePushCandidates(
      [
        {
          id: 701,
          userId: 4,
          status: "예정",
          startTime: parseKstLocalDateTime("2026-05-22T09:00:00"),
          endTime: parseKstLocalDateTime("2026-05-22T10:00:00"),
          reminderOffsetMinutes: -1,
          isActive: true,
        },
      ] as any,
      {
        now: parseKstLocalDateTime("2026-05-22T10:03:00"),
        lookbackMinutes: 10,
      }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: "incomplete",
      scheduleId: 701,
      userId: 4,
    });
    expect(pushNotifications.SAFE_PUSH_PAYLOADS.scheduleIncomplete.title).toBe(
      "BOA 일정 알림"
    );
    expect(
      JSON.stringify(pushNotifications.SAFE_PUSH_PAYLOADS.scheduleIncomplete)
    ).not.toMatch(/010|고객명|전화번호|생년월일|질병|상품명|보험료/);
  });

  it("runs the schedule push reminder engine through the branch-admin trigger", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      {
        id: 801,
        userId: 4,
        status: "예정",
        startTime: parseKstLocalDateTime("2026-05-22T12:00:00"),
        reminderOffsetMinutes: 120,
        isActive: true,
      },
    ] as any);
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue(null);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 5,
      status: "skipped",
    } as any);
    vi.spyOn(db, "updatePushNotificationLog").mockResolvedValue(undefined);
    pushNotifications.setPushSenderForTests(async (tokens, payload) => {
      expect(payload).toEqual(
        pushNotifications.SAFE_PUSH_PAYLOADS.scheduleReminder
      );
      return tokens.map(item => ({ token: item, success: true }));
    });

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .pushNotifications.sendSchedulePushReminderEngine({
        now: "2026-05-22T10:00:00",
      });

    expect(result.targetCount).toBe(1);
    expect(result.reminderTargetCount).toBe(1);
    expect(result.sentCount).toBe(1);
    expect(result.summary).toMatchObject({
      candidateCount: 1,
      sendAttemptCount: 1,
      logExpectation: "send_attempts_create_push_logs",
      lookbackMinutes: 10,
    });
  });

  it("allows an explicit bounded lookback for controlled scheduler catch-up", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      {
        id: 802,
        userId: 4,
        status: "예정",
        startTime: parseKstLocalDateTime("2026-05-22T07:13:00"),
        reminderOffsetMinutes: 60,
        isActive: true,
      },
    ] as any);
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 6,
      status: "skipped_no_token",
    } as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .pushNotifications.sendSchedulePushReminderEngine({
        now: "2026-05-22T06:42:00",
        lookbackMinutes: 30,
      });

    expect(result.targetCount).toBe(1);
    expect(result.summary).toMatchObject({
      candidateCount: 1,
      sendAttemptCount: 1,
      noTokenSkippedCount: 1,
      logExpectation: "send_attempts_create_push_logs",
      lookbackMinutes: 30,
    });
  });

  it("returns a safe no-candidate summary when the schedule engine has nothing to send", async () => {
    vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);
    const createLogSpy = vi.spyOn(db, "createPushNotificationLog");

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .pushNotifications.sendSchedulePushReminderEngine({
        now: "2026-05-22T10:00:00",
      });

    expect(result.targetCount).toBe(0);
    expect(result.summary).toMatchObject({
      candidateCount: 0,
      sendAttemptCount: 0,
      logExpectation: "no_candidates_no_push_logs",
      lookbackMinutes: 10,
    });
    expect(createLogSpy).not.toHaveBeenCalled();
  });

  it("allows a scheduler secret to trigger the schedule push reminder engine", async () => {
    const previousSecret = process.env.PUSH_SCHEDULER_SECRET;
    process.env.PUSH_SCHEDULER_SECRET = "test-scheduler-secret";
    vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);
    vi.spyOn(db, "getCustomers").mockResolvedValue([] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([] as any);

    await expect(
      appRouter
        .createCaller({
          user: null,
          req: { protocol: "https", headers: {} },
          res: { clearCookie: () => {} },
        } as any)
        .pushNotifications.runSchedulePushReminderEngineInternal({
          secret: "test-scheduler-secret",
          now: "2026-05-22T10:00:00",
        })
    ).resolves.toMatchObject({
      success: true,
      targetCount: 0,
      schedule: { targetCount: 0 },
      business: { targetCount: 0 },
    });
    await expect(
      appRouter
        .createCaller({
          user: null,
          req: { protocol: "https", headers: {} },
          res: { clearCookie: () => {} },
        } as any)
        .pushNotifications.runSchedulePushReminderEngineInternal({
          secret: "wrong-scheduler-secret",
        })
    ).rejects.toThrow();

    process.env.PUSH_SCHEDULER_SECRET = previousSecret;
  });

  it("rejects internal scheduler calls when the scheduler secret is not configured", async () => {
    const previousSecret = process.env.PUSH_SCHEDULER_SECRET;
    delete process.env.PUSH_SCHEDULER_SECRET;
    vi.spyOn(db, "createPushNotificationLog");

    await expect(
      appRouter
        .createCaller({
          user: null,
          req: { protocol: "https", headers: {} },
          res: { clearCookie: () => {} },
        } as any)
        .pushNotifications.runSchedulePushReminderEngineInternal({
          secret: "test-scheduler-secret",
        })
    ).rejects.toThrow();
    expect(db.createPushNotificationLog).not.toHaveBeenCalled();

    process.env.PUSH_SCHEDULER_SECRET = previousSecret;
  });

  it("creates birthday, contract 90, contract 180, contract 365, and long-unmanaged business push candidates without customer data", () => {
    const candidates = pushNotifications.getBusinessPushCandidates(
      {
        customers: [
          {
            id: 100,
            agentId: 4,
            birthDate: "1980-05-22",
            assignedAt: "2026-02-21",
            isActive: true,
            deletedAt: null,
          },
          {
            id: 101,
            agentId: 4,
            birthDate: "1980-05-21",
            assignedAt: "2026-02-20",
            isActive: true,
            deletedAt: null,
          },
        ],
        contracts: [
          {
            id: 200,
            agentId: 4,
            contractDate: "2026-02-21",
            isActive: true,
            deletedAt: null,
          },
          {
            id: 201,
            agentId: 4,
            contractDate: "2025-05-22",
            isActive: true,
            deletedAt: null,
          },
          {
            id: 202,
            agentId: 4,
            contractDate: "2025-11-23",
            isActive: true,
            deletedAt: null,
          },
        ],
        consultationsByCustomer: {
          100: [
            {
              customerId: 100,
              createdAt: "2026-02-21",
              isActive: true,
              deletedAt: null,
            },
          ],
        },
      },
      { now: parseKstLocalDateTime("2026-05-22T09:00:00") }
    );

    expect(candidates.map(candidate => candidate.type).sort()).toEqual([
      "contract_180",
      "contract_365",
      "contract_90",
      "customer_birthday",
      "long_unmanaged_90",
    ]);
    expect(
      candidates.find(candidate => candidate.type === "contract_90")?.dedupeKey
    ).toBe("business:contract_90:contract:200:2026-05-22");
    expect(
      candidates.find(candidate => candidate.type === "contract_180")?.dedupeKey
    ).toBe("business:contract_180:contract:202:2026-05-22");
    expect(
      JSON.stringify([
        pushNotifications.SAFE_PUSH_PAYLOADS.customerBirthday,
        pushNotifications.SAFE_PUSH_PAYLOADS.contract90,
        pushNotifications.SAFE_PUSH_PAYLOADS.contract180,
        pushNotifications.SAFE_PUSH_PAYLOADS.contract365,
        pushNotifications.SAFE_PUSH_PAYLOADS.longUnmanaged90,
      ])
    ).not.toMatch(
      /010|1980|birthDate|customerName|phone|productName|monthlyPremium|disease|premium/
    );
  });

  it("skips unassigned, deleted, and inactive customer or contract business push candidates", () => {
    const candidates = pushNotifications.getBusinessPushCandidates(
      {
        customers: [
          {
            id: 110,
            agentId: null,
            birthDate: "1980-05-22",
            assignedAt: "2026-02-21",
            isActive: true,
          },
          {
            id: 111,
            agentId: 4,
            birthDate: "1980-05-22",
            assignedAt: "2026-02-21",
            isActive: false,
          },
          {
            id: 112,
            agentId: 4,
            birthDate: "1980-05-22",
            assignedAt: "2026-02-21",
            isActive: true,
            deletedAt: new Date(),
          },
        ],
        contracts: [
          {
            id: 210,
            agentId: null,
            contractDate: "2026-02-21",
            isActive: true,
          },
          { id: 211, agentId: 4, contractDate: "2026-02-21", isActive: false },
          {
            id: 212,
            agentId: 4,
            contractDate: "2026-02-21",
            isActive: true,
            deletedAt: new Date(),
          },
        ],
        consultationsByCustomer: {},
      },
      { now: parseKstLocalDateTime("2026-05-22T09:00:00") }
    );

    expect(candidates).toEqual([]);
  });

  it("runs the business push reminder engine for active owners only", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 100,
        agentId: 4,
        birthDate: "1980-05-22",
        assignedAt: "2026-02-21",
        isActive: true,
        deletedAt: null,
      },
      {
        id: 101,
        agentId: 5,
        birthDate: "1980-05-22",
        assignedAt: "2026-02-21",
        isActive: true,
        deletedAt: null,
      },
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      {
        id: 200,
        agentId: 4,
        contractDate: "2026-02-21",
        isActive: true,
        deletedAt: null,
      },
      {
        id: 201,
        agentId: 4,
        contractDate: "2025-11-23",
        isActive: true,
        deletedAt: null,
      },
    ] as any);
    vi.spyOn(db, "getLatestConsultationDatesByCustomerIds").mockResolvedValue([
      { customerId: 100, latestCreatedAt: "2026-02-21" },
    ] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 4, accountStatus: "active" },
      { id: 5, accountStatus: "resigned" },
    ] as any);
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue(null);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 10,
      status: "skipped",
    } as any);
    vi.spyOn(db, "updatePushNotificationLog").mockResolvedValue(undefined);
    pushNotifications.setPushSenderForTests(async (tokens, payload) => {
      expect(tokens).toEqual([token]);
      expect(JSON.stringify(payload)).not.toMatch(
        /010|1980|customerName|phone|productName|monthlyPremium/
      );
      return tokens.map(item => ({ token: item, success: true }));
    });

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .pushNotifications.sendBusinessPushReminderEngine({
        now: "2026-05-22T09:00:00",
      });

    expect(result.targetCount).toBe(4);
    expect(result.birthdayTargetCount).toBe(1);
    expect(result.contract90TargetCount).toBe(1);
    expect(result.contract180TargetCount).toBe(1);
    expect(result.longUnmanagedTargetCount).toBe(1);
    expect(result.sentCount).toBe(4);
  });

  it("applies no-token, preference, quiet-hours, and duplicate gates to business push types", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([]);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue(null);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 20,
      status: "skipped_no_token",
    } as any);
    expect(
      (
        await pushNotifications.sendPushToUsers(
          [4],
          pushNotifications.SAFE_PUSH_PAYLOADS.customerBirthday,
          {
            type: "customer_birthday",
            dedupeKey: "business:customer_birthday:customer:100:2026-05-22",
          }
        )
      ).statuses[4]
    ).toBe("skipped_no_token");

    vi.restoreAllMocks();
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: false,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 21,
      status: "skipped_disabled",
    } as any);
    expect(
      (
        await pushNotifications.sendPushToUsers(
          [4],
          pushNotifications.SAFE_PUSH_PAYLOADS.contract90,
          {
            type: "contract_90",
            dedupeKey: "business:contract_90:contract:200:2026-05-22",
          }
        )
      ).statuses[4]
    ).toBe("skipped_disabled");

    vi.restoreAllMocks();
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 22,
      status: "skipped_quiet_hours",
    } as any);
    expect(
      (
        await pushNotifications.sendPushToUsers(
          [4],
          pushNotifications.SAFE_PUSH_PAYLOADS.contract365,
          {
            type: "contract_365",
            dedupeKey: "business:contract_365:contract:201:2026-05-22",
            now: parseKstLocalDateTime("2026-05-22T21:30:00"),
          }
        )
      ).statuses[4]
    ).toBe("skipped_quiet_hours");

    vi.restoreAllMocks();
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([
      { id: 1, userId: 4, platform: "android", token },
    ] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue({
      id: 30,
      status: "sent",
    } as any);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 23,
      status: "duplicate_skipped",
    } as any);
    expect(
      (
        await pushNotifications.sendPushToUsers(
          [4],
          pushNotifications.SAFE_PUSH_PAYLOADS.longUnmanaged90,
          {
            type: "long_unmanaged_90",
            dedupeKey: "business:long_unmanaged_90:customer:100:2026-05-22",
          }
        )
      ).statuses[4]
    ).toBe("duplicate_skipped");
  });

  it("allows the internal scheduler secret to trigger schedule and business engines together", async () => {
    const previousSecret = process.env.PUSH_SCHEDULER_SECRET;
    process.env.PUSH_SCHEDULER_SECRET = "test-scheduler-secret";
    vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 100,
        agentId: 4,
        birthDate: "1980-05-22",
        assignedAt: "2026-02-21",
        isActive: true,
        deletedAt: null,
      },
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([] as any);
    vi.spyOn(db, "getLatestConsultationDatesByCustomerIds").mockResolvedValue(
      [] as any
    );
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 4, accountStatus: "active" },
    ] as any);
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([] as any);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);
    vi.spyOn(db, "getPushNotificationLogByDedupeKey").mockResolvedValue(null);
    vi.spyOn(db, "createPushNotificationLog").mockResolvedValue({
      id: 40,
      status: "skipped_no_token",
    } as any);

    const result = await appRouter
      .createCaller({
        user: null,
        req: { protocol: "https", headers: {} },
        res: { clearCookie: () => {} },
      } as any)
      .pushNotifications.runPushReminderEnginesInternal({
        secret: "test-scheduler-secret",
        now: "2026-05-22T09:00:00",
      });

    expect(result.schedule.targetCount).toBe(0);
    expect(result.business.birthdayTargetCount).toBe(1);
    expect(result.business.longUnmanagedTargetCount).toBe(1);
    expect(result.targetCount).toBe(2);
    process.env.PUSH_SCHEDULER_SECRET = previousSecret;
  });

  it("records skipped_no_token when no active device token exists", async () => {
    vi.spyOn(db, "getActiveDeviceTokensForUsers").mockResolvedValue([]);
    vi.spyOn(db, "getPushNotificationPreference").mockResolvedValue({
      followUpTodayEnabled: true,
      scheduleReminderEnabled: true,
      deleteRequestEnabled: true,
      testNotificationEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      timezone: "Asia/Seoul",
    } as any);

    const result = await pushNotifications.sendPushToUsers(
      [4],
      pushNotifications.SAFE_PUSH_PAYLOADS.test,
      {
        type: "test",
        dedupeKey: "test:no-token",
      }
    );

    expect(result.statuses[4]).toBe("skipped_no_token");
    expect(result.disabledReason).toBe("no_tokens");
  });

  it("allows only branch_admin to access push operation APIs", async () => {
    vi.spyOn(db, "getPushNotificationOperationSummary").mockResolvedValue({
      total: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      inactiveTokens: 0,
    } as any);
    vi.spyOn(db, "listPushNotificationLogs").mockResolvedValue([]);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .pushNotifications.operationSummary()
    ).resolves.toBeDefined();
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .pushNotifications.operationSummary()
    ).rejects.toThrow();
    await expect(
      appRouter.createCaller(createCtx("team_leader")).pushNotifications.logs()
    ).rejects.toThrow();
  });
});

describe("RBAC - updateRole (branch_admin only)", () => {
  it("blocks member from updating user role", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .users.updateRole({ userId: 1, role: "team_leader" })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
  it("blocks team_leader from updating user role", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .users.updateRole({ userId: 1, role: "member" })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
  it("allows branch_admin to update user role", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .users.updateRole({ userId: 1, role: "member" })
    ).resolves.toBeDefined();
  });
});

// ─── RBAC - DB 배정 권한 ──────────────────────────────────────────────────────
describe("RBAC - customers.assign (team_leader or above only)", () => {
  it("blocks member from assigning customers", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .customers.assign({ customerId: 1, agentId: 3 })
    ).rejects.toThrow();
  });

  it("allows team_leader to assign an own-team customer to an active subordinate member", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Team Customer",
      agentId: null,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      assignmentStatus: "assigned_to_sub_branch",
      birthDate: null,
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      name: "[TEST] Member",
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 3,
        name: "[TEST] Leader",
        role: "team_leader",
        accountStatus: "active",
        parentUserId: null,
        teamId: 10,
        subBranchAdminId: 2,
      },
      {
        id: 4,
        name: "[TEST] Member",
        role: "member",
        accountStatus: "active",
        parentUserId: 3,
        teamId: 10,
        subBranchAdminId: 2,
      },
    ] as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([] as any);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const assignSpy = vi
      .spyOn(db, "assignCustomer")
      .mockResolvedValue(undefined);
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createNotification").mockResolvedValue(undefined);
    vi.spyOn(notifications, "createUncontactedReminder").mockResolvedValue(
      undefined
    );
    vi.spyOn(notifications, "createBirthdayReminder").mockResolvedValue(
      undefined
    );
    vi.spyOn(notifications, "refreshLongUnmanagedReminder").mockResolvedValue(
      undefined
    );

    await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .customers.assign({ customerId: 100, agentId: 4 });

    expect(assignSpy).toHaveBeenCalledWith(100, 4, 10, 2, tx);
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        newAgentId: 4,
        newTeamId: 10,
        newSubBranchAdminId: 2,
        assignedBy: 3,
        assignmentType: "reassignment",
      }),
      tx
    );
    expect(db.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DB_ASSIGNED_BY_TEAM_LEADER" }),
      tx
    );
  });

  it("blocks team_leader from assigning a customer outside own team even to an own-team member", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Outside Customer",
      agentId: null,
      assignedTeamId: 99,
      subBranchAdminId: 8,
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      name: "[TEST] Member",
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 3,
        name: "[TEST] Leader",
        role: "team_leader",
        accountStatus: "active",
        parentUserId: null,
        teamId: 10,
        subBranchAdminId: 2,
      },
      {
        id: 4,
        name: "[TEST] Member",
        role: "member",
        accountStatus: "active",
        parentUserId: 3,
        teamId: 10,
        subBranchAdminId: 2,
      },
    ] as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([] as any);
    const transactionSpy = vi.spyOn(db, "runDbTransaction");

    await expect(
      appRouter
        .createCaller(
          createCtx("team_leader", {
            userId: 3,
            teamId: 10,
            subBranchAdminId: 2,
          })
        )
        .customers.assign({ customerId: 100, agentId: 4 })
    ).rejects.toThrow("본인 팀 고객만 접근 가능합니다.");
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it("blocks team_leader from assigning outside descendants", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 1,
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 99,
      name: "[TEST] Outside",
      role: "member",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
    } as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 3,
        name: "[TEST] Leader",
        role: "team_leader",
        accountStatus: "active",
        parentUserId: null,
        teamId: 10,
        subBranchAdminId: 2,
      },
      {
        id: 99,
        name: "[TEST] Outside",
        role: "member",
        accountStatus: "active",
        parentUserId: null,
        teamId: null,
        subBranchAdminId: null,
      },
    ] as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([] as any);
    await expect(
      appRouter
        .createCaller(
          createCtx("team_leader", {
            userId: 3,
            teamId: 10,
            subBranchAdminId: 2,
          })
        )
        .customers.assign({ customerId: 1, agentId: 99 })
    ).rejects.toThrow();
  });
});

// RBAC - assignToSubBranch (branch_admin only)
describe("RBAC - customers.assignToSubBranch (branch_admin only)", () => {
  it("blocks sub_branch_admin from assigning to sub branch", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin"))
        .customers.assignToSubBranch({ customerId: 1, subBranchAdminId: 2 })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
  it("blocks team_leader from assigning to sub branch", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .customers.assignToSubBranch({ customerId: 1, subBranchAdminId: 2 })
    ).rejects.toThrow("지점장만 접근 가능합니다.");
  });
});

// ─── RBAC - logs.list (team_leader or above) ─────────────────────────────────
describe("RBAC - logs.list activity log scope", () => {
  const logRow = (overrides: Partial<any> = {}) => ({
    id: overrides.id ?? 1,
    userId: overrides.userId ?? 1,
    action: overrides.action ?? "CUSTOMER_CREATED",
    targetType: overrides.targetType ?? "customer",
    targetId: overrides.targetId ?? 100,
    details: overrides.details ?? "{}",
    ipAddress: null,
    userAgent: null,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
  });

  it("keeps branch_admin full activity log scope explicit", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([logRow({ userId: 1 })] as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .logs.list();

    expect(getLogsSpy).toHaveBeenCalledWith(500);
    expect(result).toHaveLength(1);
  });

  it("keeps sub_branch_admin activity logs scoped to subordinate users", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([logRow({ userId: 4 })] as any);

    const result = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .logs.list();

    expect(getLogsSpy).toHaveBeenCalledWith(500, 2);
    expect(result).toHaveLength(1);
  });

  it("keeps team_leader activity logs scoped to own team", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([logRow({ userId: 4 })] as any);

    const result = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .logs.list();

    expect(getLogsSpy).toHaveBeenCalledWith(500, undefined, 10);
    expect(result).toHaveLength(1);
  });

  it("blocks team_leader without teamId instead of falling back to all activity logs", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([logRow({ userId: 1 })] as any);

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: null }))
        .logs.list()
    ).rejects.toThrow("팀 범위가 없는 팀장은 활동 로그에 접근할 수 없습니다.");
    expect(getLogsSpy).not.toHaveBeenCalled();
  });

  it("blocks member and inactive users from activity logs", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([logRow({ userId: 1 })] as any);

    await expect(
      appRouter.createCaller(createCtx("member", { userId: 4 })).logs.list()
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(
          createCtx("team_leader", {
            userId: 3,
            teamId: 10,
            accountStatus: "inactive",
          })
        )
        .logs.list()
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(
          createCtx("team_leader", {
            userId: 3,
            teamId: 10,
            accountStatus: "resigned",
          })
        )
        .logs.list()
    ).rejects.toThrow();
    expect(getLogsSpy).not.toHaveBeenCalled();
  });
});

describe("Branch admin DB reclaim", () => {
  const assignedCustomer = (overrides: Partial<any> = {}) => ({
    id: 100,
    name: "[TEST] Customer",
    agentId: 44,
    assignedTeamId: 10,
    subBranchAdminId: 20,
    assignmentStatus: "assigned_to_agent",
    isActive: true,
    deletedAt: null,
    ...overrides,
  });

  it("allows branch_admin to reclaim one assigned customer and records history and activity log", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      assignedCustomer() as any
    );
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const reclaimSpy = vi
      .spyOn(db, "reclaimCustomerAssignment")
      .mockResolvedValue(undefined);
    const transferSpy = vi
      .spyOn(db, "transferReclaimedCustomerWork")
      .mockResolvedValue({
        followUps: 1,
        notifications: 1,
        reminders: 1,
        schedules: 0,
      });
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.reclaim({
        customerId: 100,
        reason: "담당자 재배정 검토",
      });

    expect(result.success).toBe(true);
    expect(reclaimSpy).toHaveBeenCalledWith(100, tx);
    expect(transferSpy).toHaveBeenCalledWith(100, 44, 1, tx);
    expect(result.reclaimed.transferredWork).toEqual({
      followUps: 1,
      notifications: 1,
      reminders: 1,
      schedules: 0,
    });
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        previousSubBranchAdminId: 20,
        previousTeamId: 10,
        previousAgentId: 44,
        newAgentId: undefined,
        assignedBy: 1,
        assignmentType: "reassignment",
        assignmentReason: "담당자 재배정 검토",
      }),
      tx
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CUSTOMER_DB_RECLAIMED",
        targetType: "customer",
        targetId: 100,
        details: expect.stringContaining("previousAgentId"),
      }),
      tx
    );
  });

  it("allows branch_admin to bulk reclaim assigned customers", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "getCustomerById").mockImplementation(
      async (id: number) => assignedCustomer({ id, agentId: id + 100 }) as any
    );
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const reclaimSpy = vi
      .spyOn(db, "reclaimCustomerAssignment")
      .mockResolvedValue(undefined);
    const transferSpy = vi
      .spyOn(db, "transferReclaimedCustomerWork")
      .mockResolvedValue({
        followUps: 0,
        notifications: 0,
        reminders: 0,
        schedules: 0,
      });
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.reclaimBulk({
        customerIds: [100, 101, 100],
        reason: "일괄 회수 테스트",
      });

    expect(result).toMatchObject({ success: true, count: 2 });
    expect(reclaimSpy).toHaveBeenCalledTimes(2);
    expect(reclaimSpy).toHaveBeenNthCalledWith(1, 100, tx);
    expect(reclaimSpy).toHaveBeenNthCalledWith(2, 101, tx);
    expect(transferSpy).toHaveBeenNthCalledWith(1, 100, 200, 1, tx);
    expect(transferSpy).toHaveBeenNthCalledWith(2, 101, 201, 1, tx);
    expect(historySpy).toHaveBeenCalledTimes(2);
  });

  it("blocks non-branch admins and inactive or resigned branch admins", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin"))
        .customers.reclaim({ customerId: 100, reason: "권한 없음" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .customers.reclaim({ customerId: 100, reason: "권한 없음" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .customers.reclaim({ customerId: 100, reason: "권한 없음" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "inactive" }))
        .customers.reclaim({ customerId: 100, reason: "비활성" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "resigned" }))
        .customers.reclaim({ customerId: 100, reason: "퇴사" })
    ).rejects.toThrow();
  });

  it("requires a reclaim reason", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.reclaim({ customerId: 100, reason: "" })
    ).rejects.toThrow();
  });

  it("blocks soft-deleted and already unassigned customers", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const reclaimSpy = vi
      .spyOn(db, "reclaimCustomerAssignment")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "getCustomerById").mockResolvedValueOnce(
      assignedCustomer({ isActive: false, deletedAt: new Date() }) as any
    );

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.reclaim({ customerId: 100, reason: "삭제 고객" })
    ).rejects.toThrow();

    vi.spyOn(db, "getCustomerById").mockResolvedValueOnce(
      assignedCustomer({
        agentId: null,
        assignedTeamId: null,
        subBranchAdminId: null,
        assignmentStatus: "unassigned",
      }) as any
    );
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.reclaim({ customerId: 100, reason: "미배정 고객" })
    ).rejects.toThrow();
    expect(reclaimSpy).not.toHaveBeenCalled();
  });

  it("keeps former agent own DB scoped to agentId and exposes unassigned filter for branch_admin", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);

    await appRouter
      .createCaller(createCtx("member", { userId: 44 }))
      .customers.list({});
    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.list({
        scope: "all",
        unassigned: true,
        assignmentStatus: "unassigned",
      });

    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ agentId: 44 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        unassigned: true,
        assignmentStatus: "unassigned",
      })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({ agentId: 44 })
    );
  });

  it("blocks former member from direct customer detail after reclaim while branch_admin can access it", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      assignedCustomer({
        agentId: null,
        assignedTeamId: null,
        subBranchAdminId: null,
        assignmentStatus: "unassigned",
      }) as any
    );
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 44 }))
        .customers.get({ id: 100 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .customers.get({ id: 100 })
    ).resolves.toMatchObject({ id: 100 });
  });

  it("keeps sub_branch_admin list and detail access aligned for directly assigned customers", async () => {
    const directAssigned = assignedCustomer({
      agentId: 20,
      assignedTeamId: null,
      subBranchAdminId: null,
    });
    const getCustomersSpy = vi
      .spyOn(db, "getCustomers")
      .mockResolvedValue([directAssigned] as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(directAssigned as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(
      createCtx("sub_branch_admin", { userId: 20 })
    );

    await expect(caller.customers.list({})).resolves.toEqual([
      expect.objectContaining({ id: 100 }),
    ]);
    expect(getCustomersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ subBranchAdminId: 20 })
    );
    await expect(caller.customers.get({ id: 100 })).resolves.toMatchObject({
      id: 100,
    });
  });

  it("allows sub_branch_admin detail access for subordinate assigned customers even when customer subBranchAdminId is stale", async () => {
    const subordinateAssigned = assignedCustomer({
      agentId: 44,
      assignedTeamId: 10,
      subBranchAdminId: null,
    });
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      subordinateAssigned as any
    );
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 44,
      role: "member",
      teamId: 10,
      subBranchAdminId: 20,
      accountStatus: "active",
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 20 }))
        .customers.get({ id: 100 })
    ).resolves.toMatchObject({ id: 100 });
  });

  it("blocks sub_branch_admin direct detail access outside direct and subordinate scope", async () => {
    const outOfScope = assignedCustomer({
      agentId: 44,
      assignedTeamId: 10,
      subBranchAdminId: null,
    });
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(outOfScope as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 44,
      role: "member",
      teamId: 10,
      subBranchAdminId: 21,
      accountStatus: "active",
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 20 }))
        .customers.get({ id: 100 })
    ).rejects.toThrow();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("allows team_leader detail access for directly assigned customers without team metadata", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      assignedCustomer({
        agentId: 3,
        assignedTeamId: null,
        subBranchAdminId: null,
      }) as any
    );
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .customers.get({ id: 100 })
    ).resolves.toMatchObject({ id: 100 });
  });

  it("keeps active scoped customer get and update working", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      assignedCustomer() as any
    );
    const updateSpy = vi
      .spyOn(db, "updateCustomer")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const caller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );

    await expect(caller.customers.get({ id: 100 })).resolves.toMatchObject({
      id: 100,
    });
    await expect(
      caller.customers.update({ id: 100, name: "[TEST] Updated" })
    ).resolves.toEqual({ success: true });
    expect(updateSpy).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ name: "[TEST] Updated" })
    );
    expect(logSpy.mock.calls.map(call => call[0].action)).toEqual(
      expect.arrayContaining(["CUSTOMER_VIEWED", "CUSTOMER_UPDATED"])
    );
  });

  it("blocks inactive or soft-deleted customer direct get and update for all business roles", async () => {
    const actors = [
      createCtx("branch_admin", { userId: 1 }),
      createCtx("sub_branch_admin", { userId: 20 }),
      createCtx("team_leader", { userId: 3, teamId: 10 }),
      createCtx("member", { userId: 44 }),
    ];
    const lifecycleRows = [
      assignedCustomer({
        isActive: false,
        deletedAt: new Date("2026-05-01T00:00:00.000Z"),
        phone: "010-1111-2222",
        birthDate: new Date("1990-01-01"),
      }),
      assignedCustomer({
        isActive: false,
        deletedAt: null,
        phone: "010-1111-2222",
        birthDate: new Date("1990-01-01"),
      }),
    ];

    for (const customer of lifecycleRows) {
      vi.restoreAllMocks();
      vi.spyOn(db, "getCustomerById").mockResolvedValue(customer as any);
      const updateSpy = vi
        .spyOn(db, "updateCustomer")
        .mockResolvedValue(undefined);
      const logSpy = vi
        .spyOn(db, "createActivityLog")
        .mockResolvedValue(undefined);

      for (const ctx of actors) {
        const caller = appRouter.createCaller(ctx);

        await expect(caller.customers.get({ id: 100 })).rejects.toThrow();
        await expect(
          caller.customers.update({ id: 100, name: "[TEST] Blocked" })
        ).rejects.toThrow();
        await caller.customers.get({ id: 100 }).catch(error => {
          const message = String((error as Error).message);
          expect(message).not.toContain("010-1111-2222");
          expect(message).not.toContain("1990-01-01");
        });
      }

      expect(updateSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    }
  });

  it("keeps branch_admin deleted-data restore path for soft-deleted customers", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      assignedCustomer({
        isActive: false,
        deletedAt: new Date("2026-05-01T00:00:00.000Z"),
      }) as any
    );
    vi.spyOn(db, "checkPhoneDuplicate").mockResolvedValue(null as any);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const restoreSpy = vi
      .spyOn(db, "restoreCustomer")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .deletedData.restoreCustomer({ id: 100 })
    ).resolves.toEqual({ success: true });
    expect(restoreSpy).toHaveBeenCalledWith(100, tx);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CUSTOMER_RESTORED",
        targetType: "customer",
        targetId: 100,
      }),
      tx
    );
  });
});

describe("RBAC - logs.list (team_leader+)", () => {
  it("blocks member from logs.list", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).logs.list()
    ).rejects.toThrow();
  });
  it("allows team_leader to access logs.list", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([] as any);
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { teamId: 10 }))
        .logs.list()
    ).resolves.toEqual([]);
    expect(getLogsSpy).toHaveBeenCalledWith(500, undefined, 10);
  });
  it("allows sub_branch_admin to access logs.list", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([] as any);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .logs.list()
    ).resolves.toEqual([]);
    expect(getLogsSpy).toHaveBeenCalledWith(500, 2);
  });
  it("allows branch_admin to access logs.list", async () => {
    const getLogsSpy = vi
      .spyOn(db, "getActivityLogs")
      .mockResolvedValue([] as any);
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).logs.list()
    ).resolves.toEqual([]);
    expect(getLogsSpy).toHaveBeenCalledWith(500);
  });
  it("redacts sensitive legacy activity log details without changing business customer APIs", async () => {
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      {
        id: 1,
        userId: 1,
        action: "DATA_DOWNLOAD",
        targetType: "customers",
        targetId: null,
        details: JSON.stringify({
          metadata: {
            reason:
              "[TEST] audit 010-1111-2222 token=raw-token DATABASE_URL=mysql://secret",
            rowCount: 7,
            consultationBody: "[TEST] detailed consultation body",
            birthDate: "1992-01-01",
            productName: "[TEST] product name",
            monthlyPremium: "123456",
            email: "customer@example.test",
          },
        }),
        ipAddress: "127.0.0.1",
        userAgent: "token=browser-secret",
        createdAt: new Date(),
      },
    ] as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .logs.list();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("010-1111-2222");
    expect(serialized).not.toContain("raw-token");
    expect(serialized).not.toContain("mysql://secret");
    expect(serialized).not.toContain("detailed consultation body");
    expect(serialized).not.toContain("[TEST] product name");
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("customer@example.test");
    expect(serialized).toContain("010-****-2222");
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).toContain("1992-**-**");
    expect(serialized).toContain("업무 상세 변경");
    expect(serialized).toContain("금액 정보 변경");
    expect(serialized).toContain("@example.test");
    expect(JSON.parse(String(result[0].details)).metadata.rowCount).toBe(7);
  });
});

// ─── RBAC - performance.agentStats (team_leader+) ────────────────────────────
describe("RBAC - performance.agentStats (team_leader+)", () => {
  it("blocks member from agentStats", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .performance.agentStats({ agentId: 3 })
    ).rejects.toThrow("팀장 이상만 접근 가능합니다.");
  });
  it("allows team_leader to access agentStats", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .performance.agentStats({ agentId: 3 })
    ).resolves.toBeDefined();
  });
});

describe("RBAC - performance.stats", () => {
  it("blocks member from using another agentIdFilter", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .performance.stats({ agentIdFilter: 5 })
    ).rejects.toThrow();
  });
  it("blocks member from using teamIdFilter", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .performance.stats({ teamIdFilter: 10 })
    ).rejects.toThrow();
  });
  it("keeps member without filters scoped to self", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .performance.stats()
    ).resolves.toBeDefined();
  });

  it("preserves contractCount and exposes newContractCount/monthlyPremiumTotal aliases", async () => {
    vi.spyOn(db, "getPerformanceStats").mockResolvedValue({
      contractCount: 2,
      newContractCount: 2,
      monthlyPremiumSum: 150000,
      monthlyPremiumTotal: 150000,
    } as any);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .performance.stats();

    expect(result.contractCount).toBe(2);
    expect(result.newContractCount).toBe(2);
    expect(result.monthlyPremiumSum).toBe(150000);
    expect(result.monthlyPremiumTotal).toBe(150000);
    expect(result).not.toHaveProperty("maintenanceContractCount");
    expect(result).not.toHaveProperty("activeContractCount");
    expect(result).not.toHaveProperty("validContractCount");
  });
});

describe("PR16 - branch_admin own scope and assignee handling", () => {
  it("allows branch_admin to list all DB or only own DB", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    const caller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );

    await caller.customers.list({ scope: "all" });
    await caller.customers.list({ scope: "mine" });

    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({ agentId: 1 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ agentId: 1 })
    );
  });

  it("lets managers narrow the actual sales pipeline customer list to own assigned customers", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);

    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .customers.list({});
    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .customers.list({ scope: "mine" });
    await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .customers.list({});
    await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .customers.list({ scope: "mine" });

    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ subBranchAdminId: 2 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ agentId: 2 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ teamId: 10 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ agentId: 3 })
    );
  });

  it("applies customer search inside each role scope without widening access", async () => {
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);

    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.list({ search: "  test  " });
    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .customers.list({ search: "test" });
    await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .customers.list({ search: "test" });
    await appRouter
      .createCaller(
        createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
      )
      .customers.list({ search: "test" });

    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ search: "test" })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({
        agentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
      })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ search: "test", subBranchAdminId: 2 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ search: "test", teamId: 10 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ search: "test", agentId: 4 })
    );
  });

  it("lets managers narrow the actual sales pipeline customer list to a selected organization member", async () => {
    const users = [
      {
        id: 1,
        name: "[TEST] Branch",
        role: "branch_admin",
        accountStatus: "active",
        teamId: null,
        subBranchAdminId: null,
        parentUserId: null,
      },
      {
        id: 2,
        name: "[TEST] Sub",
        role: "sub_branch_admin",
        accountStatus: "active",
        teamId: null,
        subBranchAdminId: null,
        parentUserId: 1,
      },
      {
        id: 3,
        name: "[TEST] Leader",
        role: "team_leader",
        accountStatus: "active",
        teamId: 10,
        subBranchAdminId: 2,
        parentUserId: 2,
      },
      {
        id: 4,
        name: "[TEST] Member",
        role: "member",
        accountStatus: "active",
        teamId: 10,
        subBranchAdminId: 2,
        parentUserId: 3,
      },
      {
        id: 5,
        name: "[TEST] Other",
        role: "member",
        accountStatus: "active",
        teamId: 20,
        subBranchAdminId: 99,
        parentUserId: 30,
      },
      {
        id: 6,
        name: "[TEST] Inactive",
        role: "member",
        accountStatus: "inactive",
        teamId: 10,
        subBranchAdminId: 2,
        parentUserId: 3,
      },
    ] as any[];
    const teams = [
      {
        id: 10,
        name: "[TEST] Team",
        managerId: 3,
        subBranchAdminId: 2,
        isActive: true,
        deletedAt: null,
      },
      {
        id: 20,
        name: "[TEST] Other Team",
        managerId: 30,
        subBranchAdminId: 99,
        isActive: true,
        deletedAt: null,
      },
    ] as any[];
    vi.spyOn(db, "getAllUsers").mockResolvedValue(users as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams as any);
    vi.spyOn(db, "getUserById").mockImplementation(
      async (id: number) => users.find(item => item.id === id) as any
    );
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([]);

    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.list({ scope: "member", selectedUserId: 4 });
    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .customers.list({ scope: "member", selectedUserId: 4 });
    await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .customers.list({ scope: "member", selectedUserId: 4 });

    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ agentId: 4 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ agentId: 4 })
    );
    expect(getCustomersSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ agentId: 4 })
    );
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .customers.list({ scope: "member" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .customers.list({ scope: "member", selectedUserId: 6 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customers.list({ scope: "member", selectedUserId: 5 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(
          createCtx("team_leader", {
            userId: 3,
            teamId: 10,
            subBranchAdminId: 2,
          })
        )
        .customers.list({ scope: "member", selectedUserId: 5 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(
          createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
        )
        .customers.list({ scope: "member", selectedUserId: 5 })
    ).rejects.toThrow();
  });

  it("blocks non-branch_admin from requesting all DB scope", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.list({ scope: "all" })
    ).rejects.toThrow();
  });

  it("allows branch_admin to list all contracts or only own contracts", async () => {
    const getAllContractsSpy = vi
      .spyOn(db, "getAllContracts")
      .mockResolvedValue([]);
    const caller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );

    await caller.contracts.list({ scope: "all" });
    await caller.contracts.list({ scope: "mine" });

    expect(getAllContractsSpy).toHaveBeenNthCalledWith(1, {});
    expect(getAllContractsSpy).toHaveBeenNthCalledWith(2, { agentId: 1 });
  });

  it("blocks non-branch_admin from requesting all contract scope", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .contracts.list({ scope: "all" })
    ).rejects.toThrow();
  });

  it("scopes branch_admin performance stats to own agent when requested", async () => {
    const getPerformanceStatsSpy = vi
      .spyOn(db, "getPerformanceStats")
      .mockResolvedValue({ assigned: 0 } as any);
    const caller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );

    await caller.performance.stats({ scope: "all" });
    await caller.performance.stats({ scope: "mine" });

    expect(getPerformanceStatsSpy).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({ agentId: 1 })
    );
    expect(getPerformanceStatsSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ agentId: 1 })
    );
  });

  it("blocks non-branch_admin from requesting all performance scope", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .performance.stats({ scope: "all" })
    ).rejects.toThrow();
  });

  it("allows branch_admin to assign a customer to self without team/sub-branch scope", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: null,
      assignedTeamId: 5,
      subBranchAdminId: 20,
      assignmentStatus: "unassigned",
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 1,
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      name: "Branch Admin",
    } as any);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const assignSpy = vi
      .spyOn(db, "assignCustomer")
      .mockResolvedValue(undefined);
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "createNotification").mockResolvedValue(undefined);
    vi.spyOn(notifications, "createUncontactedReminder").mockResolvedValue(
      undefined
    );
    vi.spyOn(notifications, "createBirthdayReminder").mockResolvedValue(
      undefined
    );
    vi.spyOn(notifications, "refreshLongUnmanagedReminder").mockResolvedValue(
      undefined
    );

    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.assign({ customerId: 100, agentId: 1 });

    expect(assignSpy).toHaveBeenCalledWith(100, 1, undefined, undefined, tx);
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        newAgentId: 1,
        newTeamId: undefined,
        newSubBranchAdminId: undefined,
        assignmentType: "branch_to_agent",
      }),
      tx
    );
    expect(db.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CUSTOMER_SELF_ASSIGNED_BY_BRANCH_ADMIN",
      }),
      tx
    );
  });

  it("blocks changing to the same assignee", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: 1,
      assignedTeamId: null,
      subBranchAdminId: null,
      assignmentStatus: "assigned_to_agent",
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 1,
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      name: "Branch Admin",
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .customers.changeAgent({ customerId: 100, newAgentId: 1 })
    ).rejects.toThrow();
  });

  it("allows branch_admin to bulk change customer assignees and skips invalid rows", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 44,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
      name: "Target",
    } as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([]);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([]);
    vi.spyOn(db, "getTeamById").mockResolvedValue({
      id: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "getCustomerById").mockImplementation(
      async (id: number) =>
        ({
          id,
          name: `Customer ${id}`,
          agentId: id === 101 ? 44 : 40,
          assignedTeamId: 9,
          subBranchAdminId: 2,
          assignmentStatus: "assigned_to_agent",
          isActive: id !== 102,
          deletedAt: id === 102 ? new Date() : null,
        }) as any
    );
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const assignSpy = vi
      .spyOn(db, "assignCustomer")
      .mockResolvedValue(undefined);
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.bulkChangeAgent({
        customerIds: [100, 101, 102],
        newAgentId: 44,
        reason: "운영 배분",
      });

    expect(result).toMatchObject({
      requestedCount: 3,
      changedCount: 1,
      skippedCount: 2,
    });
    expect(result.skipped.map(item => item.reason)).toEqual(
      expect.arrayContaining([
        "ALREADY_SAME_ASSIGNEE",
        "SOFT_DELETED_OR_INACTIVE",
      ])
    );
    expect(assignSpy).toHaveBeenCalledWith(100, 44, 10, 2, tx);
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        previousAgentId: 40,
        newAgentId: 44,
        assignmentReason: "운영 배분",
      }),
      tx
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CUSTOMER_ASSIGNEE_BULK_CHANGED" }),
      tx
    );
  });

  it("blocks member from bulk assignee assignment", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.bulkChangeAgent({ customerIds: [100], newAgentId: 44 })
    ).rejects.toThrow();
  });
});

describe("RBAC - contract agent target validation", () => {
  function mockContractCustomerAccess() {
    vi.spyOn(db, "getContractById").mockResolvedValue({
      id: 10,
      customerId: 100,
      agentId: 31,
      company: "테스트보험",
      productName: "테스트상품",
      productGroup: "테스트",
      contractDate: new Date("2026-01-01") as any,
      monthlyPremium: 10000,
      paymentStatus: "정상",
      contractStatus: "청약",
      memo: null,
      isActive: true,
      deletedAt: null,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "테스트고객",
      phone: "01000000000",
      birthDate: null,
      gender: null,
      region: null,
      expectedPremium: null,
      availableTime: null,
      source: null,
      agentId: 31,
      assignedTeamId: 10,
      assignedAt: null,
      subBranchAdminId: 21,
      assignmentStatus: "assigned_to_agent",
      consultStatus: "미상담",
      memo: null,
      privacyConsent: false,
      marketingConsent: false,
      isActive: true,
      deletedAt: null,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.spyOn(db, "getTeamById").mockResolvedValue({
      id: 10,
      name: "A팀",
      description: null,
      managerId: 30,
      subBranchAdminId: 21,
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
    } as any);
    vi.spyOn(db, "createContractHistoryEntry").mockResolvedValue(undefined);
    vi.spyOn(db, "updateContract").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  }

  it("blocks inactive users as contract owner", async () => {
    mockContractCustomerAccess();
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 31)
        return {
          id,
          role: "member",
          teamId: 10,
          subBranchAdminId: 21,
          accountStatus: "active",
          name: "기존",
        } as any;
      return {
        id,
        role: "member",
        teamId: 10,
        subBranchAdminId: 21,
        accountStatus: "inactive",
        name: "비활성",
      } as any;
    });

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .contracts.update({ id: 10, newAgentId: 99 })
    ).rejects.toThrow();
  });

  it("blocks team_leader from assigning another team's user", async () => {
    mockContractCustomerAccess();
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 31)
        return {
          id,
          role: "member",
          teamId: 10,
          subBranchAdminId: 21,
          accountStatus: "active",
          name: "기존",
        } as any;
      return {
        id,
        role: "member",
        teamId: 20,
        subBranchAdminId: 22,
        accountStatus: "active",
        name: "타팀",
      } as any;
    });

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 30, teamId: 10 }))
        .contracts.update({ id: 10, newAgentId: 99 })
    ).rejects.toThrow();
  });
});

describe("RBAC - notifications date filter", () => {
  it("accepts dateFrom/dateTo with existing server-side filters", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .notifications.list({
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
          processStatus: "미확인",
          isRead: false,
          limit: 10,
          offset: 0,
        })
    ).resolves.toMatchObject({ items: [], totalCount: 0, hasMore: false });
  });
});

describe("customers assignment transaction flow", () => {
  function mockAssignableCustomer() {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: null,
      assignedTeamId: null,
      subBranchAdminId: 20,
      assignmentStatus: "assigned_to_sub_branch",
      birthDate: null,
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20)
        return {
          id,
          role: "sub_branch_admin",
          accountStatus: "active",
          teamId: null,
          subBranchAdminId: null,
        } as any;
      if (id === 23)
        return {
          id,
          role: "team_leader",
          accountStatus: "active",
          teamId: 5,
          subBranchAdminId: 20,
        } as any;
      if (id === 24)
        return {
          id,
          role: "member",
          accountStatus: "active",
          teamId: 5,
          subBranchAdminId: 20,
        } as any;
      if (id === 25)
        return {
          id,
          role: "member",
          accountStatus: "inactive",
          teamId: 5,
          subBranchAdminId: 20,
        } as any;
      if (id === 26)
        return {
          id,
          role: "member",
          accountStatus: "active",
          teamId: 6,
          subBranchAdminId: 21,
        } as any;
      return null;
    });
    vi.spyOn(db, "createNotification").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  }

  it("runs customers.assign update/history/log in one transaction", async () => {
    mockAssignableCustomer();
    const tx = { tx: true } as any;
    const transactionSpy = vi
      .spyOn(db, "runDbTransaction")
      .mockImplementation(async (callback: any) => callback(tx));
    const assignSpy = vi
      .spyOn(db, "assignCustomer")
      .mockResolvedValue(undefined);
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 20 }))
      .customers.assign({ customerId: 100, agentId: 24 });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith(100, 24, 5, 20, tx);
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        newAgentId: 24,
        newTeamId: 5,
        newSubBranchAdminId: 20,
        assignmentType: "sub_branch_to_agent",
      }),
      tx
    );
    expect(db.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ASSIGNMENT_HISTORY_CREATED" }),
      tx
    );
  });

  it("does not auto-change assignee when DB is assigned to a team_leader", async () => {
    mockAssignableCustomer();
    const tx = { tx: true } as any;
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const assignSpy = vi
      .spyOn(db, "assignCustomer")
      .mockResolvedValue(undefined);
    const assignTeamSpy = vi
      .spyOn(db, "assignCustomerDbToTeam")
      .mockResolvedValue(undefined);
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createUncontactedReminder")
      .mockResolvedValue(undefined);
    vi.spyOn(notifications, "createBirthdayReminder").mockResolvedValue(
      undefined
    );
    vi.spyOn(notifications, "refreshLongUnmanagedReminder").mockResolvedValue(
      undefined
    );

    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 20 }))
      .customers.assign({ customerId: 100, agentId: 23 });

    expect(assignSpy).not.toHaveBeenCalled();
    expect(assignTeamSpy).toHaveBeenCalledWith(100, 5, 20, tx);
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        newAgentId: undefined,
        newTeamId: 5,
        newSubBranchAdminId: 20,
      }),
      tx
    );
    expect(reminderSpy).not.toHaveBeenCalled();
  });

  it("propagates assignment history failure from transaction", async () => {
    mockAssignableCustomer();
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({} as any)
    );
    vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    vi.spyOn(db, "createAssignmentHistory").mockRejectedValue(
      new Error("history failed")
    );

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 20 }))
        .customers.assign({ customerId: 100, agentId: 24 })
    ).rejects.toThrow("history failed");
  });

  it("blocks inactive and out-of-scope assignment targets before transaction", async () => {
    mockAssignableCustomer();
    const transactionSpy = vi.spyOn(db, "runDbTransaction");

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 20 }))
        .customers.assign({ customerId: 100, agentId: 25 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 20 }))
        .customers.assign({ customerId: 100, agentId: 26 })
    ).rejects.toThrow();

    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it("records sub-branch and reassignment history inside transactions", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    vi.spyOn(db, "assignCustomerToSubBranch").mockResolvedValue(undefined);
    vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    const historySpy = vi
      .spyOn(db, "createAssignmentHistory")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "Test Customer",
      agentId: 24,
      assignedTeamId: 5,
      subBranchAdminId: 20,
      assignmentStatus: "assigned_to_sub_branch",
      isActive: true,
    } as any);
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20)
        return {
          id,
          role: "sub_branch_admin",
          accountStatus: "active",
          teamId: null,
          subBranchAdminId: null,
        } as any;
      if (id === 24)
        return {
          id,
          role: "member",
          accountStatus: "active",
          teamId: 5,
          subBranchAdminId: 20,
        } as any;
      if (id === 27)
        return {
          id,
          role: "member",
          accountStatus: "active",
          teamId: 5,
          subBranchAdminId: 20,
        } as any;
      return null;
    });

    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .customers.changeAgent({ customerId: 100, newAgentId: 27 });

    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        previousAgentId: 24,
        newAgentId: 27,
        previousTeamId: 5,
        newTeamId: 5,
        previousSubBranchAdminId: 20,
        newSubBranchAdminId: 20,
        assignmentType: "reassignment",
      }),
      tx
    );
  });
});

// ─── 1단계 치명적 문제 수정 검증 ─────────────────────────────────────────────
describe("consultations.list - 권한 검증", () => {
  it("returns NOT_FOUND for non-existent customerId", async () => {
    const ctx = createCtx("member", { userId: 3 });
    await expect(
      appRouter.createCaller(ctx).consultations.list({ customerId: 999999 })
    ).rejects.toThrow();
  });
});

describe("admin security controls", () => {
  it("allows branch_admin to force logout a user and records an audit log", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      openId: "google-sub",
      name: "[TEST] Member",
      email: "member@test.local",
      loginMethod: "google",
      role: "member",
      accountStatus: "active",
      loginStatus: "linked",
      teamId: 10,
      subBranchAdminId: 2,
      sessionInvalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);
    const invalidateSpy = vi
      .spyOn(db, "invalidateUserSessions")
      .mockResolvedValue(1);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .adminSecurity.forceLogoutUser({
        userId: 4,
        reason: "[TEST] security review",
      });

    expect(result).toEqual({ success: true, affectedSessionCount: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith(4, expect.any(Date));
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_FORCE_LOGOUT",
        targetType: "user",
        targetId: 4,
      }),
      undefined
    );
  });

  it("blocks non-admin users from force logout APIs", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .adminSecurity.forceLogoutUser({
          userId: 4,
          reason: "[TEST] no permission",
        })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createInactiveCtx("branch_admin"))
        .adminSecurity.forceLogoutAll({
          reason: "[TEST] inactive",
          confirmText: "전체로그아웃",
        })
    ).rejects.toThrow();
  });

  it("requires confirm text for full force logout and records affected sessions", async () => {
    const invalidateSpy = vi
      .spyOn(db, "invalidateAllUserSessions")
      .mockResolvedValue(3);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .adminSecurity.forceLogoutAll({
          reason: "[TEST] missing confirm",
          confirmText: "logout",
        })
    ).rejects.toThrow();

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .adminSecurity.forceLogoutAll({
        reason: "[TEST] emergency",
        confirmText: "전체로그아웃",
      });

    expect(result).toEqual({ success: true, affectedSessionCount: 3 });
    expect(invalidateSpy).toHaveBeenCalledWith(expect.any(Date));
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ALL_USERS_FORCE_LOGOUT",
      }),
      undefined
    );
  });

  it("resets OAuth link without changing role or account status", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      openId: "google-sub",
      name: "[TEST] Member",
      email: "member@test.local",
      loginMethod: "google",
      role: "member",
      accountStatus: "inactive",
      loginStatus: "linked",
      teamId: 10,
      subBranchAdminId: 2,
      sessionInvalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);
    const resetSpy = vi
      .spyOn(db, "resetUserOAuthLink")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .adminSecurity.resetOAuthLink({
          userId: 4,
          reason: "[TEST] wrong Google account",
          confirmText: "wrong",
        })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .adminSecurity.resetOAuthLink({
          userId: 4,
          reason: "[TEST] wrong Google account",
          confirmText: "OAuth초기화",
        })
    ).resolves.toEqual({ success: true });

    expect(resetSpy).toHaveBeenCalledWith(4);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_OAUTH_RESET",
        targetType: "user",
        targetId: 4,
      }),
      undefined
    );
  });

  it("returns masked login history only to branch_admin", async () => {
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      {
        id: 1,
        userId: 1,
        action: "USER_LOGIN",
        targetType: "user",
        targetId: 4,
        details: "{}",
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        action: "CUSTOMER_CREATED",
        targetType: "customer",
        targetId: 100,
        details: "{}",
        createdAt: new Date(),
      },
    ] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 1,
        name: "[TEST] Admin",
        email: "admin@test.local",
        role: "branch_admin",
        accountStatus: "active",
        loginStatus: "linked",
      },
      {
        id: 4,
        name: "[TEST] Member",
        email: "member@test.local",
        role: "member",
        accountStatus: "active",
        loginStatus: "linked",
      },
    ] as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .adminSecurity.loginHistory({ limit: 10 });

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("USER_LOGIN");
    expect(result[0].user?.email).not.toBe("member@test.local");
    expect(result[0].user?.email).toContain("***");
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .adminSecurity.loginHistory({ limit: 10 })
    ).rejects.toThrow();
  });
});

describe("admin audit and download reason controls", () => {
  it("allows only branch_admin to access operational audit summary", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active" },
      { id: 2, role: "member", accountStatus: "inactive" },
      { id: 3, role: "member", accountStatus: "resigned" },
    ] as any);
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      { id: 100, isActive: true, createdAt: new Date() },
    ] as any);
    vi.spyOn(db, "getDeletedCustomers").mockResolvedValue([
      { id: 101, isActive: false },
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      { id: 10, isActive: true, createdAt: new Date() },
    ] as any);
    vi.spyOn(db, "getDeletedContracts").mockResolvedValue([
      { id: 11, isActive: false },
    ] as any);
    vi.spyOn(db, "getAllNotifications").mockResolvedValue([
      { id: 1, isRead: false, processStatus: "미확인" },
    ] as any);
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      {
        id: 1,
        userId: 1,
        action: "DATA_DOWNLOAD",
        targetType: "customers",
        targetId: null,
        details: JSON.stringify({
          metadata: { reason: "[TEST] audit", rowCount: 1 },
        }),
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        action: "LOGIN_BLOCKED",
        targetType: "user",
        targetId: 2,
        details: "{}",
        createdAt: new Date(),
      },
    ] as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .adminAudit.summary();

    expect(result.cards.activeUsers).toBe(1);
    expect(result.cards.inactiveUsers).toBe(1);
    expect(result.cards.softDeletedCustomers).toBe(1);
    expect(result.cards.recentDownloads).toBe(1);
    expect(result.recentRiskEvents[0].action).toBe("DATA_DOWNLOAD");
    await expect(
      appRouter.createCaller(createCtx("member")).adminAudit.summary()
    ).rejects.toThrow();
  });

  it("filters audit logs by action, targetType, risk and pagination", async () => {
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      {
        id: 1,
        userId: 1,
        action: "DATA_DOWNLOAD",
        targetType: "customers",
        targetId: null,
        details: JSON.stringify({
          metadata: { reason: "[TEST] export", rowCount: 2 },
        }),
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: 2,
        action: "CUSTOMER_CREATED",
        targetType: "customer",
        targetId: 100,
        details: "{}",
        createdAt: new Date(),
      },
      {
        id: 3,
        userId: 1,
        action: "USER_OAUTH_RESET",
        targetType: "user",
        targetId: 4,
        details: JSON.stringify({ metadata: { reason: "[TEST] reset" } }),
        createdAt: new Date(),
      },
    ] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 1,
        name: "[TEST] Admin",
        email: "admin@test.local",
        role: "branch_admin",
      },
      {
        id: 2,
        name: "[TEST] Member",
        email: "member@test.local",
        role: "member",
      },
    ] as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .adminAudit.logSearch({
        riskOnly: true,
        targetType: "customers",
        limit: 1,
        offset: 0,
      });

    expect(result.total).toBe(1);
    expect(result.items[0].action).toBe("DATA_DOWNLOAD");
    expect(result.items[0].riskLevel).toBe("high");
    expect(result.items[0].actor?.email).toContain("***");
  });

  it("searches audit logs only through sanitized reason and summary fields", async () => {
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      {
        id: 1,
        userId: 1,
        action: "DATA_DOWNLOAD",
        targetType: "customers",
        targetId: null,
        details: JSON.stringify({
          metadata: {
            reason: "[TEST] export 010-1111-2222 token=raw-token",
            rowCount: 2,
          },
        }),
        createdAt: new Date(),
      },
    ] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      {
        id: 1,
        name: "[TEST] Admin",
        email: "admin@test.local",
        role: "branch_admin",
      },
    ] as any);

    const byToken = await appRouter
      .createCaller(createCtx("branch_admin"))
      .adminAudit.logSearch({ search: "raw-token" });
    const byMaskedPhone = await appRouter
      .createCaller(createCtx("branch_admin"))
      .adminAudit.logSearch({ search: "010-****-2222" });
    const serialized = JSON.stringify(byMaskedPhone);

    expect(byToken.total).toBe(0);
    expect(byMaskedPhone.total).toBe(1);
    expect(serialized).not.toContain("010-1111-2222");
    expect(serialized).not.toContain("raw-token");
  });

  it("blocks inactive or resigned branch admins from audit log search", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "inactive" }))
        .adminAudit.logSearch({ riskOnly: true })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "resigned" }))
        .adminAudit.logSearch({ riskOnly: true })
    ).rejects.toThrow();
  });

  it("requires a download reason and records it in DATA_DOWNLOAD metadata", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      { id: 100, name: "[TEST] Customer" },
    ] as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .download.customers({ reason: "" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .download.customers({ reason: "짧음" })
    ).rejects.toThrow();

    const data = await appRouter
      .createCaller(createCtx("branch_admin"))
      .download.customers({ reason: "[TEST] 파일럿 점검" });

    expect(data).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DATA_DOWNLOAD",
        targetType: "customers",
      }),
      undefined
    );
    const details = JSON.parse(String(logSpy.mock.calls[0]?.[0].details));
    expect(details.metadata.reason).toBe("[TEST] 파일럿 점검");
  });

  it("previews export row counts and field sensitivity for branch admins only", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([{ id: 100 }] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      { id: 10 },
      { id: 11 },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);
    vi.spyOn(db, "getPerformanceStats").mockResolvedValue({
      newContractCount: 1,
    } as any);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .download.preview();

    expect(result.customers.rowCount).toBe(1);
    expect(result.contracts.rowCount).toBe(2);
    expect(result.schedules.rowCount).toBe(0);
    expect(result.performance.rowCount).toBe(1);
    expect(
      result.customers.fields.some(
        field => field.key === "phone" && field.sensitive
      )
    ).toBe(true);
    await expect(
      appRouter.createCaller(createCtx("member")).download.preview()
    ).rejects.toThrow();
  });

  it("keeps preview field keys aligned with actual exported fields", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 100,
        name: "[TEST] Customer",
        phone: "010-1111-2222",
        extraSecret: "hidden",
      },
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      {
        id: 10,
        company: "[TEST] Insurer",
        productName: "[TEST] Product",
        extraSecret: "hidden",
      },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      {
        id: 20,
        title: "[TEST] Schedule",
        type: "교육",
        status: "예정",
        startTime: new Date("2026-05-01T00:00:00.000Z"),
        customerId: 100,
        extraSecret: "hidden",
      },
    ] as any);
    vi.spyOn(db, "getPerformanceStats").mockResolvedValue({
      newContractCount: 1,
      monthlyPremiumTotal: 10000,
      consultationCount: 2,
      goalAchievementRate: 50,
      extraSecret: "hidden",
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx("branch_admin"));
    const preview = await caller.download.preview();
    const customers = await caller.download.customers({
      reason: "[TEST] field alignment",
    });
    const contracts = await caller.download.contracts({
      reason: "[TEST] field alignment",
    });
    const schedules = await caller.download.schedules({
      reason: "[TEST] field alignment",
    });
    const performance = await caller.download.performance({
      reason: "[TEST] field alignment",
    });

    expect(Object.keys(customers[0])).toEqual(
      preview.customers.fields.map(field => field.key)
    );
    expect(Object.keys(contracts[0])).toEqual(
      preview.contracts.fields.map(field => field.key)
    );
    expect(Object.keys(schedules[0])).toEqual(
      preview.schedules.fields.map(field => field.key)
    );
    expect(Object.keys(performance ?? {})).toEqual(
      preview.performance.fields.map(field => field.key)
    );
    expect(JSON.stringify(customers)).not.toContain("extraSecret");
  });

  it("supports masked customer exports without storing raw sensitive details in DATA_DOWNLOAD metadata", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 100,
        name: "홍길동",
        phone: "010-1111-2222",
        birthDate: "1990-01-01",
        expectedPremium: 120000,
        memo: "raw memo",
      },
    ] as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const data = await appRouter
      .createCaller(createCtx("branch_admin"))
      .download.customers({
        reason: "[TEST] masked export",
        masked: true,
      });

    const serialized = JSON.stringify(data);
    expect(serialized).toContain("010-****-2222");
    expect(serialized).not.toContain("010-1111-2222");
    expect(serialized).not.toContain("1990-01-01");
    expect(serialized).not.toContain("120000");
    expect(serialized).not.toContain("raw memo");

    const details = JSON.parse(String(logSpy.mock.calls[0]?.[0].details));
    expect(details.metadata).toMatchObject({
      type: "customers",
      rowCount: 1,
      reason: "[TEST] masked export",
      masked: true,
    });
    expect(String(logSpy.mock.calls[0]?.[0].details)).not.toContain(
      "010-1111-2222"
    );
    expect(String(logSpy.mock.calls[0]?.[0].details)).not.toContain("홍길동");
  });

  it("defaults to masked exports and requires explicit confirmation for raw exports", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 100,
        name: "[TEST] Customer",
        phone: "010-1111-2222",
        birthDate: "1990-01-01",
        expectedPremium: 120000,
      },
    ] as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createCtx("branch_admin"));

    const maskedByDefault = await caller.download.customers({
      reason: "[TEST] default masked",
    });
    expect(JSON.stringify(maskedByDefault)).toContain("010-****-2222");
    expect(JSON.stringify(maskedByDefault)).not.toContain("010-1111-2222");

    await expect(
      caller.download.customers({ reason: "[TEST] raw blocked", masked: false })
    ).rejects.toThrow();
    const raw = await caller.download.customers({
      reason: "[TEST] raw allowed",
      masked: false,
      rawConfirm: true,
    });
    expect(raw[0].phone).toBe("010-1111-2222");
  });

  it("neutralizes spreadsheet formulas in exported string values", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 100,
        name: "=1+1",
        birthDate: "\t1990-01-01",
        phone: "\r010-1111-2222",
        gender: "\nF",
        region: '@HYPERLINK("http://example.test")',
        source: "+SUM(A1:A2)",
        consultStatus: "-10+20",
        expectedPremium: 120000,
      },
    ] as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const data = await appRouter
      .createCaller(createCtx("branch_admin"))
      .download.customers({
        reason: "[TEST] formula safety",
        masked: false,
        rawConfirm: true,
      });

    expect(data[0]).toMatchObject({
      name: "'=1+1",
      birthDate: "'\t1990-01-01",
      phone: "'\r010-1111-2222",
      gender: "'\nF",
      region: '\'@HYPERLINK("http://example.test")',
      source: "'+SUM(A1:A2)",
      consultStatus: "'-10+20",
      expectedPremium: 120000,
    });
  });

  it("neutralizes spreadsheet formulas across export types", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      {
        id: 10,
        company: "=cmd|calc",
        productName: "+SUM(A1:A2)",
        productGroup: '@HYPERLINK("http://example.test")',
        contractDate: "\t2026-05-01",
        monthlyPremium: 120000,
        paymentStatus: "\r정상",
        contractStatus: "\n유지",
      },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      {
        id: 20,
        title: "=1+1",
        type: "+meeting",
        status: "-10+20",
        startTime: "\t2026-05-01T10:00:00.000Z",
        customerId: 100,
      },
    ] as any);
    vi.spyOn(db, "getPerformanceStats").mockResolvedValue({
      newContractCount: 1,
      monthlyPremiumTotal: '@HYPERLINK("http://example.test")',
      consultationCount: 2,
      goalAchievementRate: "-10+20",
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createCtx("branch_admin"));

    const contracts = await caller.download.contracts({
      reason: "[TEST] formula safety",
      masked: false,
      rawConfirm: true,
    });
    const schedules = await caller.download.schedules({
      reason: "[TEST] formula safety",
      masked: false,
      rawConfirm: true,
    });
    const performance = await caller.download.performance({
      reason: "[TEST] formula safety",
      masked: false,
      rawConfirm: true,
    });

    expect(contracts[0]).toMatchObject({
      company: "'=cmd|calc",
      productName: "'+SUM(A1:A2)",
      productGroup: '\'@HYPERLINK("http://example.test")',
      contractDate: "'\t2026-05-01",
      paymentStatus: "'\r정상",
      contractStatus: "'\n유지",
    });
    expect(schedules[0]).toMatchObject({
      title: "'=1+1",
      type: "'+meeting",
      status: "'-10+20",
      startTime: "'\t2026-05-01T10:00:00.000Z",
    });
    expect(performance).toMatchObject({
      monthlyPremiumTotal: '\'@HYPERLINK("http://example.test")',
      goalAchievementRate: "'-10+20",
    });
  });

  it("records safe DATA_DOWNLOAD metadata for each export type", async () => {
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      { id: 100, name: "raw customer", phone: "010-1111-2222" },
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      {
        id: 10,
        company: "raw insurer",
        productName: "raw product",
        monthlyPremium: 120000,
      },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      { id: 20, title: "raw schedule", customerId: 100 },
    ] as any);
    vi.spyOn(db, "getPerformanceStats").mockResolvedValue({
      newContractCount: 1,
      monthlyPremiumTotal: 120000,
      consultationCount: 2,
      goalAchievementRate: 50,
    } as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createCtx("branch_admin"));

    await caller.download.customers({
      reason: "[TEST] metadata safe",
      masked: true,
    });
    await caller.download.contracts({
      reason: "[TEST] metadata safe",
      masked: true,
    });
    await caller.download.schedules({
      reason: "[TEST] metadata safe",
      masked: true,
    });
    await caller.download.performance({
      reason: "[TEST] metadata safe",
      masked: true,
    });

    const details = logSpy.mock.calls.map(
      call => JSON.parse(String(call[0].details)).metadata
    );
    expect(details.map(item => item.type)).toEqual([
      "customers",
      "contracts",
      "schedules",
      "performance",
    ]);
    expect(details.map(item => item.rowCount)).toEqual([1, 1, 1, 1]);
    for (const item of details) {
      expect(item).toMatchObject({
        reason: "[TEST] metadata safe",
        masked: true,
        mode: "masked",
      });
      expect(Array.isArray(item.fields)).toBe(true);
    }
    const serialized = JSON.stringify(logSpy.mock.calls);
    expect(serialized).not.toContain("010-1111-2222");
    expect(serialized).not.toContain("raw product");
    expect(serialized).not.toContain("120000");
  });

  it("keeps download APIs branch_admin only", async () => {
    const caller = appRouter.createCaller(createCtx("member"));
    await expect(caller.download.preview()).rejects.toThrow();
    await expect(
      caller.download.customers({ reason: "[TEST] no permission" })
    ).rejects.toThrow();
    await expect(
      caller.download.contracts({ reason: "[TEST] no permission" })
    ).rejects.toThrow();
    await expect(
      caller.download.schedules({ reason: "[TEST] no permission" })
    ).rejects.toThrow();
    await expect(
      caller.download.performance({ reason: "[TEST] no permission" })
    ).rejects.toThrow();
  });
});

describe("PR6 operation risk center", () => {
  function mockOperationRiskSources(
    overrides: Partial<{
      users: any[];
      customers: any[];
      contracts: any[];
      followUps: any[];
      schedules: any[];
      notifications: any[];
      deleteRequests: any[];
      handoffHistories: any[];
      activityLogs: any[];
      pushSummary: any;
      pushLogs: any[];
    }> = {}
  ) {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(
      overrides.users ??
        ([
          {
            id: 1,
            name: "[TEST] Admin",
            email: "admin@test.local",
            role: "branch_admin",
            accountStatus: "active",
          },
        ] as any)
    );
    vi.spyOn(db, "getCustomers").mockResolvedValue(
      overrides.customers ?? ([] as any)
    );
    vi.spyOn(db, "getAllContracts").mockResolvedValue(
      overrides.contracts ?? ([] as any)
    );
    vi.spyOn(db, "getFollowUps").mockResolvedValue(
      overrides.followUps ?? ([] as any)
    );
    vi.spyOn(db, "getSchedules").mockResolvedValue(
      overrides.schedules ?? ([] as any)
    );
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: overrides.notifications ?? [],
      totalCount: overrides.notifications?.length ?? 0,
      hasMore: false,
    } as any);
    vi.spyOn(db, "getDeleteRequests").mockResolvedValue(
      overrides.deleteRequests ?? ([] as any)
    );
    vi.spyOn(db, "getHandoffHistories").mockResolvedValue(
      overrides.handoffHistories ?? ([] as any)
    );
    vi.spyOn(db, "getActivityLogs").mockResolvedValue(
      overrides.activityLogs ?? ([] as any)
    );
    vi.spyOn(db, "getPushNotificationOperationSummary").mockResolvedValue(
      overrides.pushSummary ??
        ({
          total: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          inactiveTokens: 0,
        } as any)
    );
    vi.spyOn(db, "listPushNotificationLogs").mockResolvedValue(
      overrides.pushLogs ?? ([] as any)
    );
  }

  it("allows branch_admin to view operation risk summary and risk events", async () => {
    const now = new Date();
    mockOperationRiskSources({
      users: [
        {
          id: 1,
          name: "[TEST] Admin",
          email: "admin@test.local",
          role: "branch_admin",
          accountStatus: "active",
        },
        {
          id: 4,
          name: "[TEST] Former",
          email: "former@test.local",
          role: "member",
          accountStatus: "resigned",
        },
      ],
      customers: [{ id: 100, agentId: 4, phone: "010-1234-5678" }],
      followUps: [
        {
          id: 10,
          assignedAgentId: 4,
          status: "scheduled",
          nextContactDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      schedules: [
        {
          id: 20,
          userId: 4,
          status: "scheduled",
          startTime: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      notifications: [
        { id: 30, userId: 4, isRead: false, processStatus: "미확인" },
      ],
      deleteRequests: [{ id: 7, status: "pending" }],
      activityLogs: [
        {
          id: 1,
          userId: 1,
          action: "DATA_DOWNLOAD",
          targetType: "customers",
          targetId: null,
          details: JSON.stringify({
            metadata: {
              reason: "a",
              rowCount: 20,
              token: "raw-token",
              phone: "010-1111-2222",
            },
          }),
          createdAt: now,
        },
        {
          id: 2,
          userId: 1,
          action: "DATA_DOWNLOAD",
          targetType: "contracts",
          targetId: null,
          details: JSON.stringify({
            metadata: { reason: "[TEST] repeated", rowCount: 3 },
          }),
          createdAt: now,
        },
        {
          id: 3,
          userId: 1,
          action: "DATA_DOWNLOAD",
          targetType: "performance",
          targetId: null,
          details: JSON.stringify({
            metadata: { reason: "[TEST] repeated", rowCount: 1 },
          }),
          createdAt: now,
        },
        {
          id: 4,
          userId: 1,
          action: "CONTRACT_PERMANENTLY_DELETED",
          targetType: "contract",
          targetId: 9,
          details: "{}",
          createdAt: now,
        },
        {
          id: 5,
          userId: 1,
          action: "USER_OAUTH_RESET",
          targetType: "user",
          targetId: 4,
          details: JSON.stringify({ metadata: { reason: "[TEST] reset" } }),
          createdAt: now,
        },
      ],
      pushSummary: {
        total: 3,
        sent: 1,
        failed: 1,
        skipped: 1,
        inactiveTokens: 2,
      },
      pushLogs: [
        {
          id: 99,
          type: "follow_up_today",
          userId: 4,
          userName: "[TEST] Former",
          userRole: "member",
          sourceType: "follow_up",
          status: "failed",
          errorCode: "UNREGISTERED raw-token",
          createdAt: now,
          dedupeKey: "secret-dedupe",
        },
      ],
    });
    const createLogSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createCtx("branch_admin"));
    const result = await caller.operationRisk.summary({ period: "7d" });
    const events = await caller.operationRisk.riskEvents({ period: "7d" });

    expect(result.overall.score).toBeGreaterThan(0);
    expect(result.downloadRisk.total).toBe(3);
    expect(result.downloadRisk.repeatedUserCount).toBe(1);
    expect(result.downloadRisk.shortReasonCount).toBe(1);
    expect(result.deletionRisk.permanentDeleteCount).toBe(1);
    expect(result.accountRisk.criticalCount).toBe(1);
    expect(result.handoffRisk.unresolvedCount).toBeGreaterThan(0);
    expect(result.pushRisk.failed).toBe(1);
    expect(events[0].action).toBe("DATA_DOWNLOAD");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("010-1111-2222");
    expect(serialized).not.toContain("010-1234-5678");
    expect(serialized).not.toContain("raw-token");
    expect(serialized).not.toContain("secret-dedupe");
    expect(createLogSpy).not.toHaveBeenCalled();
  });

  it("blocks non-branch_admin and inactive or resigned users from operation risk APIs", async () => {
    for (const role of [
      "sub_branch_admin",
      "team_leader",
      "member",
    ] as Role[]) {
      await expect(
        appRouter
          .createCaller(createCtx(role))
          .operationRisk.summary({ period: "7d" })
      ).rejects.toThrow();
      await expect(
        appRouter
          .createCaller(createCtx(role))
          .operationRisk.riskEvents({ period: "7d" })
      ).rejects.toThrow();
    }
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "inactive" }))
        .operationRisk.summary({ period: "7d" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "resigned" }))
        .operationRisk.summary({ period: "7d" })
    ).rejects.toThrow();
  });

  it("allows sub_branch_admin and team_leader to view scoped read-only operation risk", async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const getCustomersSpy = vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 101,
        agentId: 4,
        isActive: true,
        createdAt: oldDate,
        updatedAt: oldDate,
        lastContactDate: oldDate,
        assignmentStatus: "assigned",
      },
      {
        id: 102,
        agentId: null,
        subBranchAdminId: null,
        isActive: true,
        createdAt: oldDate,
        updatedAt: oldDate,
        assignmentStatus: "unassigned",
      },
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      {
        id: 201,
        userId: 4,
        status: "scheduled",
        startTime: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
    ] as any);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [{ id: 301, userId: 4, isRead: false, processStatus: "unread" }],
      totalCount: 1,
      hasMore: false,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue([
      {
        id: 401,
        assignedAgentId: 4,
        status: "scheduled",
        nextContactDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    ] as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 2, role: "sub_branch_admin", accountStatus: "active" },
      {
        id: 3,
        role: "team_leader",
        accountStatus: "active",
        parentUserId: 2,
        teamId: 10,
      },
      {
        id: 4,
        role: "member",
        accountStatus: "active",
        parentUserId: 3,
        teamId: 10,
      },
      {
        id: 9,
        role: "member",
        accountStatus: "active",
        parentUserId: 99,
        teamId: 99,
      },
    ] as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([
      { id: 10, managerId: 3, subBranchAdminId: 2 },
    ] as any);
    const getLogsSpy = vi.spyOn(db, "getActivityLogs").mockResolvedValue([
      {
        id: 1,
        action: "DATA_DOWNLOAD",
        details: JSON.stringify({ phone: "010-0000-0000" }),
        createdAt: now,
      },
    ] as any);

    const subBranchResult = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .operationRisk.scopedSummary({ period: "7d" });
    const teamResult = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .operationRisk.scopedSummary({ period: "7d" });

    expect(subBranchResult.scope.role).toBe("sub_branch_admin");
    expect(teamResult.scope.role).toBe("team_leader");
    expect(subBranchResult.cards.map(card => card.title)).toEqual([
      "미처리 후속관리",
      "오래된 미완료 일정",
      "장기 미관리 고객",
      "미확인 알림",
      "배정/인수인계 확인 필요",
    ]);
    expect(subBranchResult.cards.some(card => card.count > 0)).toBe(true);
    expect(JSON.stringify(subBranchResult)).not.toContain("DATA_DOWNLOAD");
    expect(JSON.stringify(subBranchResult)).not.toContain("010-0000-0000");
    expect(getLogsSpy).not.toHaveBeenCalled();
    expect(getCustomersSpy).toHaveBeenCalledWith({ agentIds: [2, 3, 4] });
    expect(getCustomersSpy).toHaveBeenCalledWith({ agentIds: [3, 4] });
  });

  it("blocks member and inactive users from scoped operation risk", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .operationRisk.scopedSummary({ period: "7d" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { accountStatus: "inactive" }))
        .operationRisk.scopedSummary({ period: "7d" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(
          createCtx("sub_branch_admin", { accountStatus: "resigned" })
        )
        .operationRisk.scopedSummary({ period: "7d" })
    ).rejects.toThrow();
  });

  it("keeps all operation risk sub-queries branch_admin only", async () => {
    mockOperationRiskSources();
    const branchAdmin = appRouter.createCaller(createCtx("branch_admin"));

    await expect(
      branchAdmin.operationRisk.downloadRisk({ period: "7d" })
    ).resolves.toBeDefined();
    await expect(
      branchAdmin.operationRisk.accountRisk({ period: "7d" })
    ).resolves.toBeDefined();
    await expect(
      branchAdmin.operationRisk.deletionRisk({ period: "7d" })
    ).resolves.toBeDefined();
    await expect(
      branchAdmin.operationRisk.handoffRisk({ period: "7d" })
    ).resolves.toBeDefined();
    await expect(
      branchAdmin.operationRisk.pushRisk({ period: "7d" })
    ).resolves.toBeDefined();
    await expect(
      branchAdmin.operationRisk.unresolvedWorkRisk({ period: "7d" })
    ).resolves.toBeDefined();

    for (const role of [
      "sub_branch_admin",
      "team_leader",
      "member",
    ] as Role[]) {
      const caller = appRouter.createCaller(createCtx(role));
      await expect(
        caller.operationRisk.downloadRisk({ period: "7d" })
      ).rejects.toThrow();
      await expect(
        caller.operationRisk.accountRisk({ period: "7d" })
      ).rejects.toThrow();
      await expect(
        caller.operationRisk.deletionRisk({ period: "7d" })
      ).rejects.toThrow();
      await expect(
        caller.operationRisk.handoffRisk({ period: "7d" })
      ).rejects.toThrow();
      await expect(
        caller.operationRisk.pushRisk({ period: "7d" })
      ).rejects.toThrow();
      await expect(
        caller.operationRisk.unresolvedWorkRisk({ period: "7d" })
      ).rejects.toThrow();
    }
  });

  it("returns stable normal output for empty operation risk data", async () => {
    mockOperationRiskSources();

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .operationRisk.summary({
        period: "custom",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
      });

    expect(result.overall.level).toBe("normal");
    expect(result.overall.score).toBe(0);
    expect(result.riskCards.every(card => Number.isFinite(card.score))).toBe(
      true
    );
    expect(result.riskCards.every(card => card.count === 0)).toBe(true);
    expect(result.recentRiskEvents).toHaveLength(0);
    expect(result.pushRisk.recentFailures).toHaveLength(0);
  });
});

describe("PR9 full role permission QA", () => {
  it("allows branch_admin to access high-risk admin-only surfaces with required audit inputs", async () => {
    vi.spyOn(db, "getDeletedCustomers").mockResolvedValue([]);
    vi.spyOn(db, "listImportBatches").mockResolvedValue([]);
    vi.spyOn(db, "getDeleteRequests").mockResolvedValue([]);
    vi.spyOn(db, "getSettings").mockResolvedValue([]);
    vi.spyOn(db, "getPerformanceStats").mockResolvedValue({
      contractCount: 0,
    } as any);
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active" },
    ] as any);
    vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    vi.spyOn(db, "getDeletedContracts").mockResolvedValue([]);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([]);
    vi.spyOn(db, "getAllNotifications").mockResolvedValue([]);
    vi.spyOn(db, "getActivityLogs").mockResolvedValue([]);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      openId: "test-member",
      loginStatus: "linked",
      role: "member",
      accountStatus: "active",
    } as any);
    vi.spyOn(db, "invalidateUserSessions").mockResolvedValue(1);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.listCustomers()
    ).resolves.toEqual([]);
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).imports.listBatches({})
    ).resolves.toEqual([]);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deleteRequests.listAllRequestsForAdmin({})
    ).resolves.toEqual([]);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .settings.list({ category: "region" })
    ).resolves.toEqual([]);
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).adminAudit.summary()
    ).resolves.toBeDefined();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .download.performance({ reason: "[TEST] 권한 QA" })
    ).resolves.toBeDefined();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .adminSecurity.forceLogoutUser({ userId: 4, reason: "[TEST] 권한 QA" })
    ).resolves.toEqual({ success: true, affectedSessionCount: 1 });
  });

  it("blocks non-admin roles from high-risk admin-only APIs", async () => {
    const roles: Role[] = ["sub_branch_admin", "team_leader", "member"];
    for (const role of roles) {
      const caller = appRouter.createCaller(createCtx(role));
      await expect(caller.deletedData.listCustomers()).rejects.toThrow();
      await expect(
        caller.deletedData.restoreCustomer({ id: 100 })
      ).rejects.toThrow();
      await expect(
        caller.deletedData.permanentDeleteCustomer({
          id: 100,
          confirmText: "완전삭제",
          reason: "[TEST] reason",
        })
      ).rejects.toThrow();
      await expect(caller.imports.listBatches({})).rejects.toThrow();
      await expect(
        caller.imports.cancelBatch({
          importBatchId: "batch_test",
          confirmText: "BATCH취소",
        })
      ).rejects.toThrow();
      await expect(caller.adminAudit.summary()).rejects.toThrow();
      await expect(
        caller.adminAudit.logSearch({ riskOnly: true })
      ).rejects.toThrow();
      await expect(
        caller.download.customers({ reason: "[TEST] 권한 QA" })
      ).rejects.toThrow();
      await expect(
        caller.adminSecurity.loginHistory({ limit: 10 })
      ).rejects.toThrow();
      await expect(
        caller.adminSecurity.resetOAuthLink({
          userId: 4,
          reason: "[TEST] 권한 QA",
          confirmText: "OAuth초기화",
        })
      ).rejects.toThrow();
      await expect(
        caller.users.updateRole({ userId: 4, role: "member" })
      ).rejects.toThrow();
      await expect(
        caller.settings.list({ category: "region" })
      ).rejects.toThrow();
    }
  });

  it("blocks inactive and resigned users from protected PR1-PR8 APIs", async () => {
    for (const accountStatus of ["inactive", "resigned"] as const) {
      const caller = appRouter.createCaller(
        createCtx("branch_admin", { accountStatus })
      );
      await expect(
        caller.dashboard.todayWork({ date: "2026-05-13T00:00:00.000Z" })
      ).rejects.toThrow();
      await expect(caller.customers.list({})).rejects.toThrow();
      await expect(caller.contracts.list()).rejects.toThrow();
      await expect(caller.followUps.listToday()).rejects.toThrow();
      await expect(
        caller.consultations.list({ customerId: 100 })
      ).rejects.toThrow();
      await expect(
        caller.deleteRequests.listAllRequestsForAdmin({})
      ).rejects.toThrow();
      await expect(caller.deletedData.listCustomers()).rejects.toThrow();
      await expect(caller.imports.listBatches({})).rejects.toThrow();
      await expect(caller.adminAudit.summary()).rejects.toThrow();
      await expect(
        caller.download.customers({ reason: "[TEST] 권한 QA" })
      ).rejects.toThrow();
    }
  });

  it("keeps customer management metadata, consultations and follow-ups inside role scope", async () => {
    const scopedCustomer = {
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "미상담",
      priority: "unclassified",
      customerTags: "[]",
      nextAction: null,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getCustomerById").mockResolvedValue(scopedCustomer);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      teamId: 10,
      role: "member",
      accountStatus: "active",
    } as any);
    vi.spyOn(db, "updateCustomer").mockResolvedValue(undefined);
    vi.spyOn(db, "createConsultation").mockResolvedValue(undefined);
    vi.spyOn(db, "createFollowUp").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "getConsultationsByCustomer").mockResolvedValue([]);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customers.updateManagementMeta({ customerId: 100, priority: "A" })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .consultations.create({
          customerId: 100,
          status: "상담예정",
          summary: "[TEST] summary",
        })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.create({
          customerId: 100,
          nextContactDate: "2026-05-14T10:00:00.000Z",
          reason: "[TEST] follow",
          nextAction: "전화",
        })
    ).resolves.toEqual({ success: true });

    vi.restoreAllMocks();
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...scopedCustomer,
      agentId: 99,
      assignedTeamId: 99,
      subBranchAdminId: 99,
    });
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 99,
      teamId: 99,
      role: "member",
      accountStatus: "active",
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customers.updateManagementMeta({ customerId: 100, priority: "A" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .consultations.list({ customerId: 100 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.listByCustomer({ customerId: 100 })
    ).rejects.toThrow();
  });

  it("keeps delete request scope limited to subordinate, team, and own contracts", async () => {
    const contract = {
      id: 10,
      customerId: 100,
      agentId: 4,
      isActive: true,
      deletedAt: null,
    } as any;
    const customer = {
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getContractById").mockResolvedValue(contract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(customer);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      teamId: 10,
      role: "member",
      accountStatus: "active",
    } as any);
    vi.spyOn(db, "getPendingDeleteRequestForTarget").mockResolvedValue(
      undefined
    );
    vi.spyOn(db, "createDeleteRequest").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).resolves.toEqual({ success: true });

    vi.restoreAllMocks();
    vi.spyOn(db, "getContractById").mockResolvedValue(contract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...customer,
      agentId: 99,
      assignedTeamId: 99,
      subBranchAdminId: 99,
    });
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 99,
      teamId: 99,
      role: "member",
      accountStatus: "active",
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).rejects.toThrow();
  });
});

describe("Customer History Timeline", () => {
  const scopedCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    isActive: true,
    deletedAt: null,
  } as any;
  const timelineResult = {
    totalCount: 3,
    items: [
      {
        id: "consultation:1",
        eventType: "consultation_created",
        eventLabel: "상담기록이 추가되었습니다.",
        occurredAt: new Date("2026-05-13T09:00:00.000Z"),
        actorName: "[TEST] member",
        actorRole: "member",
        source: "consultations",
        summary: "[TEST] 상담 요약",
        detail: "[TEST] 필요한 최소 요약",
        metadata: { consultationType: "전화" },
        severity: "info",
        relatedId: 1,
        relatedType: "consultation",
      },
    ],
  };

  it("allows each active role to read only an accessible customer timeline", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(scopedCustomer);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      teamId: 10,
      role: "member",
      accountStatus: "active",
    } as any);
    const timelineSpy = vi
      .spyOn(db, "getCustomerTimeline")
      .mockResolvedValue(timelineResult);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.timeline({ customerId: 100, limit: 50 })
    ).resolves.toEqual(timelineResult);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customers.timeline({ customerId: 100, eventTypes: ["consultations"] })
    ).resolves.toEqual(timelineResult);
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .customers.timeline({
          customerId: 100,
          dateFrom: "2026-05-01T00:00:00.000Z",
        })
    ).resolves.toEqual(timelineResult);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.timeline({ customerId: 100 })
    ).resolves.toEqual(timelineResult);
    expect(timelineSpy).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ limit: 50 })
    );
    expect(JSON.stringify(timelineResult)).not.toContain("010-");
    expect(JSON.stringify(timelineResult)).not.toContain("secret");
  });

  it("blocks timeline access outside role scope and for inactive users", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...scopedCustomer,
      agentId: 99,
      assignedTeamId: 99,
      subBranchAdminId: 99,
    });
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 99,
      teamId: 99,
      role: "member",
      accountStatus: "active",
    } as any);
    const timelineSpy = vi
      .spyOn(db, "getCustomerTimeline")
      .mockResolvedValue(timelineResult);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customers.timeline({ customerId: 100 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .customers.timeline({ customerId: 100 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.timeline({ customerId: 100 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .customers.timeline({ customerId: 100 })
    ).rejects.toThrow();
    expect(timelineSpy).not.toHaveBeenCalled();
  });

  it("validates timeline date filters before querying events", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(scopedCustomer);
    const timelineSpy = vi
      .spyOn(db, "getCustomerTimeline")
      .mockResolvedValue(timelineResult);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.timeline({ customerId: 100, dateFrom: "not-a-date" })
    ).rejects.toThrow();
    expect(timelineSpy).not.toHaveBeenCalled();
  });
});

describe("P0-3 phone duplicate checks", () => {
  it("scopes duplicate checks by role without exposing out-of-scope customer fields", async () => {
    const duplicate = {
      id: 99,
      name: "[TEST] Hidden Customer",
      phone: "01012345678",
      isActive: true,
    } as any;
    const checkSpy = vi
      .spyOn(db, "checkPhoneDuplicate")
      .mockResolvedValueOnce(duplicate)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .customers.checkDuplicate({ phone: "010-1234-5678" })
    ).resolves.toMatchObject({
      isDuplicate: true,
      duplicate: true,
      visibleDuplicateCount: 1,
    });
    const subResult = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .customers.checkDuplicate({ phone: "010-1234-5678" });
    const teamResult = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .customers.checkDuplicate({ phone: "010-1234-5678" });
    const memberResult = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .customers.checkDuplicate({ phone: "010-1234-5678" });

    expect(subResult).toEqual(
      expect.objectContaining({
        isDuplicate: false,
        duplicate: false,
        visibleDuplicateCount: 0,
      })
    );
    expect(teamResult).toEqual(
      expect.objectContaining({
        isDuplicate: false,
        duplicate: false,
        visibleDuplicateCount: 0,
      })
    );
    expect(memberResult).toEqual(
      expect.objectContaining({
        isDuplicate: false,
        duplicate: false,
        visibleDuplicateCount: 0,
      })
    );
    expect(JSON.stringify([subResult, teamResult, memberResult])).not.toContain(
      "Hidden Customer"
    );
    expect(checkSpy).toHaveBeenNthCalledWith(1, "010-1234-5678", undefined, {});
    expect(checkSpy).toHaveBeenNthCalledWith(2, "010-1234-5678", undefined, {
      subBranchAdminId: 2,
    });
    expect(checkSpy).toHaveBeenNthCalledWith(3, "010-1234-5678", undefined, {
      teamId: 10,
    });
    expect(checkSpy).toHaveBeenNthCalledWith(4, "010-1234-5678", undefined, {
      agentId: 4,
    });
  });

  it("blocks inactive and resigned users from duplicate checks", async () => {
    await expect(
      appRouter
        .createCaller(createInactiveCtx("member"))
        .customers.checkDuplicate({ phone: "010-1234-5678" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .customers.checkDuplicate({ phone: "010-1234-5678" })
    ).rejects.toThrow();
  });

  it("uses scoped duplicate checks for create and does not include duplicate customer names in conflicts", async () => {
    vi.spyOn(db, "checkPhoneDuplicate").mockResolvedValue({
      id: 99,
      name: "[TEST] Hidden Customer",
      phone: "01012345678",
      isActive: true,
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.create({
          name: "[TEST] New Customer",
          phone: "010-1234-5678",
          birthDate: "1990-01-01",
          privacyConsent: true,
        })
    ).rejects.toThrow("확인 가능한 범위");

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.create({
          name: "[TEST] New Customer",
          phone: "010-1234-5678",
          birthDate: "1990-01-01",
          privacyConsent: true,
        })
    ).rejects.not.toThrow("[TEST] Hidden Customer");
  });

  it("uses global existing phone sets for branch_admin bulk import preview and import", async () => {
    const phoneSpy = vi
      .spyOn(db, "getAllActiveCustomerPhones")
      .mockResolvedValue(new Set());
    vi.spyOn(db, "createImportBatch").mockResolvedValue(undefined as any);
    vi.spyOn(db, "bulkCreateCustomers").mockResolvedValue([] as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({})
    );

    const row = {
      name: "[TEST] Bulk",
      birthDate: "1990-01-01",
      phone: "010-1234-5678",
    };
    const caller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );

    await caller.customers.previewImport({
      rows: [row],
      fileName: "test.csv",
      fileSize: 100,
      mimeType: "text/csv",
    });
    await caller.customers.bulkImport({
      rows: [row],
      fileName: "test.csv",
      fileSize: 100,
      mimeType: "text/csv",
    });

    expect(phoneSpy).toHaveBeenNthCalledWith(1, {});
    expect(phoneSpy).toHaveBeenNthCalledWith(2, {});
  });

  it("keeps global duplicate reconciliation available only through branch_admin merge management", async () => {
    const groups = [
      {
        normalizedPhone: "01012345678",
        maskedPhone: "010-****-5678",
        candidates: [],
      },
    ];
    const finder = vi
      .spyOn(db, "findDuplicateCustomerGroups")
      .mockResolvedValue(groups as any);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerMerge.findDuplicates({ phone: "010-1234-5678" })
    ).resolves.toEqual(groups);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customerMerge.findDuplicates({ phone: "010-1234-5678" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .customerMerge.findDuplicates({ phone: "010-1234-5678" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customerMerge.findDuplicates({ phone: "010-1234-5678" })
    ).rejects.toThrow();

    expect(finder).toHaveBeenCalledWith({
      phone: "010-1234-5678",
      onlyActive: true,
    });
  });
});

describe("PR10-2 customer merge workflow", () => {
  const mergePreview = {
    targetCustomer: {
      id: 100,
      name: "[TEST] Target",
      maskedPhone: "010-****-5678",
      isActive: true,
    },
    sourceCustomer: {
      id: 101,
      name: "[TEST] Source",
      maskedPhone: "010-****-5678",
      isActive: true,
    },
    transferCounts: {
      consultations: 2,
      contracts: 1,
      followUps: 1,
      notifications: 1,
      reminders: 0,
      deleteRequests: 0,
      statusHistory: 1,
      consentLogs: 1,
      assignmentHistory: 1,
    },
    conflicts: ["name"],
    mergePolicy: "target_first",
    blockers: {
      sameCustomer: false,
      inactiveTarget: false,
      inactiveSource: false,
      alreadyMerged: false,
      pendingDeleteRequests: false,
    },
  } as any;

  it("allows only branch_admin to find duplicate customers and normalizes phone strings", async () => {
    const groups = [
      {
        normalizedPhone: "01012345678",
        maskedPhone: "010-****-5678",
        candidates: [],
      },
    ];
    vi.spyOn(db, "findDuplicateCustomerGroups").mockResolvedValue(
      groups as any
    );

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerMerge.findDuplicates({ phone: "010-1234-5678" })
    ).resolves.toEqual(groups);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customerMerge.findDuplicates({})
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .customerMerge.findDuplicates({})
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customerMerge.findDuplicates({})
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createInactiveCtx("branch_admin"))
        .customerMerge.findDuplicates({})
    ).rejects.toThrow();
    expect(db.normalizePhone("010 1234 5678")).toBe("01012345678");
  });

  it("returns merge preview only for valid active customer pairs", async () => {
    vi.spyOn(db, "getCustomerMergePreview").mockResolvedValue(mergePreview);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerMerge.preview({ targetCustomerId: 100, sourceCustomerId: 101 })
    ).resolves.toMatchObject({
      transferCounts: expect.objectContaining({
        consultations: 2,
        contracts: 1,
      }),
    });
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerMerge.preview({ targetCustomerId: 100, sourceCustomerId: 100 })
    ).rejects.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(db, "getCustomerMergePreview").mockResolvedValue({
      ...mergePreview,
      blockers: { ...mergePreview.blockers, pendingDeleteRequests: true },
    });
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customerMerge.preview({ targetCustomerId: 100, sourceCustomerId: 101 })
    ).rejects.toThrow();
  });

  it("executes customer merge with confirm text and records transactional helper call", async () => {
    vi.spyOn(db, "getCustomerMergePreview").mockResolvedValue(mergePreview);
    const mergeSpy = vi.spyOn(db, "mergeCustomers").mockResolvedValue({
      success: true,
      targetCustomerId: 100,
      sourceCustomerId: 101,
      affectedCounts: mergePreview.transferCounts,
    });

    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customerMerge.execute({
        targetCustomerId: 100,
        sourceCustomerId: 101,
        confirmText: "고객병합",
        reason: "[TEST] 중복 고객 정리",
      })
    ).resolves.toMatchObject({
      success: true,
      targetCustomerId: 100,
      sourceCustomerId: 101,
    });
    expect(mergeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        targetCustomerId: 100,
        sourceCustomerId: 101,
        actorId: 1,
      })
    );
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).customerMerge.execute({
        targetCustomerId: 100,
        sourceCustomerId: 101,
        confirmText: "삭제",
        reason: "[TEST] 중복 고객 정리",
      })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customerMerge.execute({
          targetCustomerId: 100,
          sourceCustomerId: 101,
          confirmText: "고객병합",
          reason: "[TEST] 중복 고객 정리",
        })
    ).rejects.toThrow();
  });
});

describe("PR10-3 user handoff workflow", () => {
  const sourceUser = {
    id: 20,
    name: "Source Member",
    email: "source@example.test",
    role: "member",
    accountStatus: "active",
    teamId: 10,
    subBranchAdminId: 2,
    openId: "source-open",
    loginStatus: "linked",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as any;
  const targetUser = {
    id: 30,
    name: "Target Member",
    email: "target@example.test",
    role: "member",
    accountStatus: "active",
    teamId: 11,
    subBranchAdminId: 3,
    openId: "target-open",
    loginStatus: "linked",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as any;

  it("allows only branch_admin to preview user handoff", async () => {
    vi.spyOn(db, "getHandoffPreview").mockResolvedValue({
      sourceUser,
      counts: {
        activeCustomers: 2,
        softDeletedCustomers: 1,
        activeContracts: 1,
        pendingFollowUps: 1,
        pendingSchedules: 1,
        pendingNotifications: 1,
        consultations: 3,
        recentActivityLogs: 4,
      },
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .adminHandoff.preview({ sourceUserId: 20 })
    ).resolves.toMatchObject({
      counts: { activeCustomers: 2 },
    });
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .adminHandoff.preview({ sourceUserId: 20 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createInactiveCtx("branch_admin"))
        .adminHandoff.preview({ sourceUserId: 20 })
    ).rejects.toThrow();
  });

  it("blocks invalid handoff execution requests", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .adminHandoff.execute({
          sourceUserId: 20,
          targetUserId: 30,
          transferCustomers: true,
          transferFollowUps: true,
          transferSchedules: true,
          transferNotifications: true,
          updateSourceAccountStatus: "inactive",
          forceLogoutSource: true,
          resetOAuthSource: false,
          reason: "퇴사 처리",
          confirmText: "wrong",
        })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 20 }))
        .adminHandoff.execute({
          sourceUserId: 20,
          targetUserId: 30,
          transferCustomers: true,
          transferFollowUps: true,
          transferSchedules: true,
          transferNotifications: true,
          updateSourceAccountStatus: "inactive",
          forceLogoutSource: true,
          resetOAuthSource: false,
          reason: "퇴사 처리",
          confirmText: "인수인계",
        })
    ).rejects.toThrow();
  });

  it("executes handoff only to active team_leader/member targets", async () => {
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20) return sourceUser;
      if (id === 30) return targetUser;
      return undefined;
    });
    const executeSpy = vi.spyOn(db, "executeUserHandoff").mockResolvedValue({
      success: true,
      sourceUserId: 20,
      targetUserId: 30,
      counts: {
        customers: 2,
        contracts: 1,
        followUps: 1,
        schedules: 1,
        notifications: 1,
      },
      sourceAccountStatusBefore: "active",
      sourceAccountStatusAfter: "resigned",
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .adminHandoff.execute({
          sourceUserId: 20,
          targetUserId: 30,
          transferCustomers: true,
          transferFollowUps: true,
          transferSchedules: true,
          transferNotifications: true,
          updateSourceAccountStatus: "resigned",
          forceLogoutSource: true,
          resetOAuthSource: true,
          reason: "퇴사로 인한 고객 이관",
          confirmText: "인수인계",
        })
    ).resolves.toMatchObject({
      success: true,
      sourceUserId: 20,
      targetUserId: 30,
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUserId: 20,
        targetUserId: 30,
        executedBy: 1,
        updateSourceAccountStatus: "resigned",
        forceLogoutSource: true,
        resetOAuthSource: true,
      })
    );
  });

  it("blocks handoff to inactive or administrative target users", async () => {
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => {
      if (id === 20) return sourceUser;
      if (id === 31)
        return { ...targetUser, id: 31, accountStatus: "inactive" };
      if (id === 32)
        return {
          ...targetUser,
          id: 32,
          role: "branch_admin",
          teamId: null,
          subBranchAdminId: null,
        };
      return undefined;
    });
    const payload = {
      sourceUserId: 20,
      transferCustomers: true,
      transferFollowUps: true,
      transferSchedules: true,
      transferNotifications: true,
      updateSourceAccountStatus: "inactive" as const,
      forceLogoutSource: true,
      resetOAuthSource: false,
      reason: "비활성 처리",
      confirmText: "인수인계",
    };

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .adminHandoff.execute({ ...payload, targetUserId: 31 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .adminHandoff.execute({ ...payload, targetUserId: 32 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .adminHandoff.execute({ ...payload, targetUserId: 31 })
    ).rejects.toThrow();
  });

  it("allows branch_admin to view handoff history and blocks non-admin", async () => {
    vi.spyOn(db, "getHandoffHistories").mockResolvedValue([
      { id: 1, sourceUserId: 20, targetUserId: 30 },
    ] as any);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .adminHandoff.history({ limit: 10 })
    ).resolves.toHaveLength(1);
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .adminHandoff.history({ limit: 10 })
    ).rejects.toThrow();
  });
});

describe("PR10-4 performance goals", () => {
  const goal = {
    id: 501,
    year: 2026,
    month: 5,
    targetType: "user",
    targetId: 4,
    contractCountGoal: 10,
    monthlyPremiumGoal: 3000000,
    consultationGoal: 0,
    followUpGoal: 0,
    createdBy: 1,
    updatedBy: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  it("allows branch_admin to create a goal and records an activity log", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
    } as any);
    vi.spyOn(db, "getActivePerformanceGoal").mockResolvedValue(null);
    vi.spyOn(db, "createPerformanceGoal").mockResolvedValue(goal);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .performanceGoals.create({
        year: 2026,
        month: 5,
        targetType: "user",
        targetId: 4,
        contractCountGoal: 10,
        monthlyPremiumGoal: 3000000,
      });

    expect(result).toEqual(goal);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PERFORMANCE_GOAL_CREATED",
        targetType: "performance_goal",
        targetId: 501,
      }),
      undefined
    );
  });

  it("blocks non-admin create, duplicate active goals, and negative values", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).performanceGoals.create({
        year: 2026,
        month: 5,
        targetType: "user",
        targetId: 4,
        contractCountGoal: 10,
        monthlyPremiumGoal: 3000000,
      })
    ).rejects.toThrow();

    vi.spyOn(db, "getActivePerformanceGoal").mockResolvedValue(goal);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .performanceGoals.create({
          year: 2026,
          month: 5,
          targetType: "branch",
          targetId: null,
          contractCountGoal: 10,
          monthlyPremiumGoal: 3000000,
        })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .performanceGoals.create({
          year: 2026,
          month: 5,
          targetType: "branch",
          targetId: null,
          contractCountGoal: -1,
          monthlyPremiumGoal: 3000000,
        })
    ).rejects.toThrow();
  });

  it("updates and soft-deactivates goals with audit logs", async () => {
    vi.spyOn(db, "getPerformanceGoalById").mockResolvedValue(goal);
    const updateSpy = vi
      .spyOn(db, "updatePerformanceGoal")
      .mockResolvedValue(goal);
    const deactivateSpy = vi
      .spyOn(db, "deactivatePerformanceGoal")
      .mockResolvedValue({ ...goal, isActive: false, deletedAt: new Date() });
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .performanceGoals.update({
          id: 501,
          contractCountGoal: 12,
          monthlyPremiumGoal: 3500000,
        })
    ).resolves.toEqual({ success: true });
    expect(updateSpy).toHaveBeenCalledWith(
      501,
      expect.objectContaining({ contractCountGoal: 12, updatedBy: 1 })
    );

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .performanceGoals.deactivate({ id: 501 })
    ).resolves.toEqual({ success: true });
    expect(deactivateSpy).toHaveBeenCalledWith(501, 1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PERFORMANCE_GOAL_UPDATED" }),
      undefined
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PERFORMANCE_GOAL_DEACTIVATED" }),
      undefined
    );
  });

  it("returns role-scoped dashboard data and blocks inactive users", async () => {
    const dashboard = {
      year: 2026,
      month: 5,
      items: [
        {
          goal,
          targetLabel: "Test Member",
          actual: { contractCount: 3, monthlyPremium: 900000 },
          achievementRate: { contractCount: 30, monthlyPremium: 30 },
          remaining: { contractCount: 7, monthlyPremium: 2100000 },
          remainingDays: 10,
          dailyRequired: { contractCount: 0.7, monthlyPremium: 210000 },
        },
      ],
      summary: {
        totalGoals: 1,
        achievedGoals: 0,
        pendingGoals: 1,
        averageContractRate: 30,
        averagePremiumRate: 30,
      },
    };
    const dashboardSpy = vi
      .spyOn(db, "getPerformanceGoalDashboard")
      .mockResolvedValue(dashboard as any);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .performanceGoals.dashboard({ year: 2026, month: 5 })
    ).resolves.toEqual(dashboard);
    expect(dashboardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, role: "member" }),
      2026,
      5
    );
    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .performanceGoals.dashboard({ year: 2026, month: 5 })
    ).rejects.toThrow();
  });

  it.each([
    ["branch_admin", 1],
    ["sub_branch_admin", 2],
    ["team_leader", 3],
    ["member", 4],
  ] as const)(
    "allows branch_admin to create personal goals for %s",
    async (role, userId) => {
      vi.spyOn(db, "getUserById").mockResolvedValue({
        id: userId,
        role,
        accountStatus: "active",
        teamId: role === "member" || role === "team_leader" ? 10 : null,
      } as any);
      vi.spyOn(db, "getActivePerformanceGoal").mockResolvedValue(null);
      vi.spyOn(db, "createPerformanceGoal").mockResolvedValue({
        ...goal,
        targetId: userId,
      });
      vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

      await expect(
        appRouter
          .createCaller(createCtx("branch_admin", { userId: 1 }))
          .performanceGoals.create({
            year: 2026,
            month: 6,
            targetType: "user",
            targetId: userId,
            contractCountGoal: 5,
            monthlyPremiumGoal: 1000000,
          })
      ).resolves.toEqual(expect.objectContaining({ targetId: userId }));
    }
  );

  it("blocks personal goals for inactive users and non-admin creators", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 5,
      role: "member",
      accountStatus: "inactive",
      teamId: 10,
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { userId: 1 }))
        .performanceGoals.create({
          year: 2026,
          month: 6,
          targetType: "user",
          targetId: 5,
          contractCountGoal: 5,
          monthlyPremiumGoal: 1000000,
        })
    ).rejects.toThrow("비활성 또는 퇴사 사용자");

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3 }))
        .performanceGoals.create({
          year: 2026,
          month: 6,
          targetType: "user",
          targetId: 4,
          contractCountGoal: 5,
          monthlyPremiumGoal: 1000000,
        })
    ).rejects.toThrow();
  });
});

describe("PR11 consultation tools", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "미상담",
    isActive: true,
    deletedAt: null,
  } as any;

  it("allows only branch_admin to manage checklist templates", async () => {
    const created = {
      id: 701,
      title: "고객 기본정보 확인",
      phase: "before",
      category: "basic",
      sortOrder: 1,
      isRequired: true,
      isActive: true,
    } as any;
    vi.spyOn(db, "createConsultationChecklistTemplate").mockResolvedValue(
      created
    );
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.createChecklist({
          title: "고객 기본정보 확인",
          phase: "before",
          category: "basic",
          sortOrder: 1,
          isRequired: true,
        })
    ).resolves.toEqual(created);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_CHECKLIST_TEMPLATE_CREATED",
        targetId: 701,
      }),
      undefined
    );

    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .consultationTools.createChecklist({
          title: "차단",
          phase: "before",
          category: "basic",
          sortOrder: 1,
          isRequired: false,
        })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createInactiveCtx("branch_admin"))
        .consultationTools.createChecklist({
          title: "차단",
          phase: "before",
          category: "basic",
          sortOrder: 1,
          isRequired: false,
        })
    ).rejects.toThrow();
  });

  it("allows branch_admin to update and soft-deactivate checklist templates without logging full description", async () => {
    const existing = {
      id: 701,
      title: "기존 체크리스트",
      description: "Original checklist detail.",
      phase: "before",
      category: "basic",
      sortOrder: 1,
      isRequired: false,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getConsultationChecklistTemplateById").mockResolvedValue(
      existing
    );
    const updateSpy = vi
      .spyOn(db, "updateConsultationChecklistTemplate")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.updateChecklist({
          id: 701,
          title: "수정된 체크리스트",
          description: "Updated checklist detail that should not be logged.",
          phase: "during",
          category: "needs",
          sortOrder: 2,
          isRequired: true,
        })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(
      701,
      expect.objectContaining({
        title: "수정된 체크리스트",
        description: "Updated checklist detail that should not be logged.",
        updatedBy: 1,
      })
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_CHECKLIST_TEMPLATE_UPDATED",
        details: expect.not.stringContaining("Updated checklist detail"),
      }),
      undefined
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.stringContaining("[redacted]"),
      }),
      undefined
    );

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.updateChecklist({
          id: 701,
          isActive: false,
        })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenLastCalledWith(
      701,
      expect.objectContaining({
        isActive: false,
        deletedAt: expect.any(Date),
        updatedBy: 1,
      })
    );
    expect(logSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_CHECKLIST_TEMPLATE_DEACTIVATED",
        details: expect.not.stringContaining("Original checklist detail"),
      }),
      undefined
    );
  });

  it("keeps checklist template update and deactivate branch_admin only", async () => {
    const input = { id: 701, title: "Blocked checklist" };
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin"))
        .consultationTools.updateChecklist(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .consultationTools.updateChecklist(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .consultationTools.updateChecklist(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "inactive" }))
        .consultationTools.updateChecklist(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "resigned" }))
        .consultationTools.updateChecklist(input)
    ).rejects.toThrow();
  });

  it("stores checklist result only inside customer access scope", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getConsultationChecklistTemplateById").mockResolvedValue({
      id: 701,
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "upsertConsultationCheckResult").mockResolvedValue({
      id: 801,
      customerId: 100,
      checklistId: 701,
      checked: true,
    } as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultationTools.updateCheckResult({
          customerId: 100,
          checklistId: 701,
          checked: true,
          memo: "[TEST] checked",
        })
    ).resolves.toMatchObject({ id: 801, checked: true });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_CHECKLIST_RESULT_UPDATED",
        targetType: "customer",
        targetId: 100,
      }),
      undefined
    );

    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      agentId: 99,
    });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultationTools.updateCheckResult({
          customerId: 100,
          checklistId: 701,
          checked: true,
        })
    ).rejects.toThrow();
  });

  it("seeds default message templates without duplicate rows", async () => {
    vi.spyOn(db, "ensureDefaultMessageTemplates").mockResolvedValue({
      createdCount: 10,
      reactivatedCount: 0,
    });
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.seedDefaultMessageTemplates()
    ).resolves.toEqual({ createdCount: 10, reactivatedCount: 0 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MESSAGE_TEMPLATE_DEFAULTS_SEEDED" }),
      undefined
    );
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .consultationTools.seedDefaultMessageTemplates()
    ).rejects.toThrow();
  });

  it("seeds default consultation checklists without duplicate rows", async () => {
    vi.spyOn(db, "ensureDefaultConsultationChecklists").mockResolvedValue({
      createdCount: 14,
      reactivatedCount: 0,
    });
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.seedDefaultChecklists()
    ).resolves.toEqual({ createdCount: 14, reactivatedCount: 0 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_CHECKLIST_DEFAULTS_SEEDED",
      }),
      undefined
    );
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .consultationTools.seedDefaultChecklists()
    ).rejects.toThrow();
  });

  it("manages message templates with compliance guards", async () => {
    vi.spyOn(db, "createMessageTemplate").mockResolvedValue({
      id: 901,
      title: "부재 후 재연락",
      situation: "missed_call",
      channel: "both",
      body: "안녕하세요 {고객명}님",
      isActive: true,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.createMessageTemplate({
          title: "부재 후 재연락",
          situation: "missed_call",
          channel: "both",
          body: "안녕하세요 {고객명}님. {담당자명}입니다.",
        })
    ).resolves.toMatchObject({ id: 901 });

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.createMessageTemplate({
          title: "금지 문구",
          situation: "missed_call",
          channel: "both",
          body: "지금 가입해야 합니다.",
        })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.createMessageTemplate({
          title: "잘못된 placeholder",
          situation: "missed_call",
          channel: "both",
          body: "{연락처}로 연락주세요.",
        })
    ).rejects.toThrow();
  });

  it("allows branch_admin to update and soft-deactivate message templates without logging full body", async () => {
    const existing = {
      id: 901,
      title: "부재 후 재연락",
      situation: "missed_call",
      channel: "both",
      body: "Original template body.",
      complianceNote: null,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getMessageTemplateById").mockResolvedValue(existing);
    const updateSpy = vi
      .spyOn(db, "updateMessageTemplate")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.updateMessageTemplate({
          id: 901,
          title: "수정된 문구",
          situation: "proposal_follow_up",
          channel: "sms",
          body: "{고객명}님 {담당자명}입니다. {상담주제} 관련해 다시 안내드립니다.",
          complianceNote: "확정 표현 금지",
        })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(
      901,
      expect.objectContaining({
        title: "수정된 문구",
        body: "{고객명}님 {담당자명}입니다. {상담주제} 관련해 다시 안내드립니다.",
        updatedBy: 1,
      })
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MESSAGE_TEMPLATE_UPDATED",
        details: expect.not.stringContaining("다시 안내드립니다"),
      }),
      undefined
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.stringContaining("[redacted]"),
      }),
      undefined
    );

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.updateMessageTemplate({
          id: 901,
          isActive: false,
        })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenLastCalledWith(
      901,
      expect.objectContaining({
        isActive: false,
        deletedAt: expect.any(Date),
        updatedBy: 1,
      })
    );
    expect(logSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "MESSAGE_TEMPLATE_DEACTIVATED",
        details: expect.not.stringContaining("Original template body"),
      }),
      undefined
    );
  });

  it("keeps message template update and deactivate branch_admin only", async () => {
    const input = { id: 901, title: "Blocked template" };
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin"))
        .consultationTools.updateMessageTemplate(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .consultationTools.updateMessageTemplate(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .consultationTools.updateMessageTemplate(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "inactive" }))
        .consultationTools.updateMessageTemplate(input)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "resigned" }))
        .consultationTools.updateMessageTemplate(input)
    ).rejects.toThrow();
  });

  it("keeps message template update compliance guards", async () => {
    vi.spyOn(db, "getMessageTemplateById").mockResolvedValue({
      id: 901,
      title: "부재 후 재연락",
      situation: "missed_call",
      channel: "both",
      body: "safe body",
      isActive: true,
      deletedAt: null,
    } as any);
    const updateSpy = vi
      .spyOn(db, "updateMessageTemplate")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.updateMessageTemplate({
          id: 901,
          body: "지금 가입해야 합니다.",
        })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationTools.updateMessageTemplate({
          id: 901,
          body: "{연락처}로 연락주세요.",
        })
    ).rejects.toThrow();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("renders and logs message copy without storing full body in activity log", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getMessageTemplateById").mockResolvedValue({
      id: 901,
      title: "부재 후 재연락",
      situation: "missed_call",
      channel: "both",
      body: "{고객명}님, 안녕하세요. {담당자명}입니다. {상담주제}",
      isActive: true,
      deletedAt: null,
    } as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const rendered = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .consultationTools.renderMessageTemplate({
        templateId: 901,
        customerId: 100,
        consultationTopic: "보장 점검",
      });
    expect(rendered.body).toContain("[TEST] Customer");
    expect(rendered.body).toContain("보장 점검");

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultationTools.logMessageCopy({
          templateId: 901,
          customerId: 100,
          channel: "both",
        })
    ).resolves.toEqual({ success: true });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MESSAGE_TEMPLATE_COPIED",
        details: expect.not.stringContaining("안녕하세요"),
      }),
      undefined
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.stringContaining('"templateId":901'),
      }),
      undefined
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.stringContaining('"channel":"both"'),
      }),
      undefined
    );
  });
});

describe("PR13 customer handoff notes and consultation scripts", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "미상담",
    isActive: true,
    deletedAt: null,
  } as any;

  it("allows scoped users to create customer handoff notes without logging full body", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "createCustomerHandoffNote").mockResolvedValue({
      id: 601,
      customerId: 100,
      noteType: "approach",
      title: "Recommended approach",
      body: "Keep the tone calm and avoid pressure.",
      isActive: true,
    } as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customerHandoffNotes.create({
          customerId: 100,
          noteType: "approach",
          title: "Recommended approach",
          body: "Keep the tone calm and avoid pressure.",
        })
    ).resolves.toMatchObject({ id: 601, customerId: 100 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CUSTOMER_HANDOFF_NOTE_CREATED",
        targetType: "customer",
        targetId: 100,
        details: expect.not.stringContaining("Keep the tone calm"),
      }),
      undefined
    );

    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      agentId: 99,
    });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customerHandoffNotes.create({
          customerId: 100,
          noteType: "caution",
          title: "Blocked",
          body: "Out of scope",
        })
    ).rejects.toThrow();
  });

  it("blocks handoff notes for inactive customers and inactive accounts", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      isActive: false,
      deletedAt: new Date(),
    });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customerHandoffNotes.create({
          customerId: 100,
          noteType: "handoff",
          title: "Inactive customer",
          body: "Do not store.",
        })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .customerHandoffNotes.listByCustomer({ customerId: 100 })
    ).rejects.toThrow();
  });

  it("keeps consultation script management branch_admin only with compliance guards", async () => {
    vi.spyOn(db, "createConsultationScript").mockResolvedValue({
      id: 701,
      title: "First call",
      category: "first_call",
      scriptBody:
        "Confirm the current needs and keep the explanation balanced.",
      isActive: true,
    } as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationScripts.create({
          title: "First call",
          category: "first_call",
          scriptBody:
            "Confirm the current needs and keep the explanation balanced.",
        })
    ).resolves.toMatchObject({ id: 701 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_SCRIPT_CREATED",
        details: expect.not.stringContaining("Confirm the current needs"),
      }),
      undefined
    );

    await expect(
      appRouter.createCaller(createCtx("member")).consultationScripts.create({
        title: "Blocked",
        category: "first_call",
        scriptBody: "Confirm the current needs.",
      })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationScripts.create({
          title: "Banned",
          category: "first_call",
          scriptBody: "지금 가입해야 합니다.",
        })
    ).rejects.toThrow();
  });

  it("seeds default consultation scripts without duplicate rows", async () => {
    vi.spyOn(db, "ensureDefaultConsultationScripts").mockResolvedValue({
      createdCount: 10,
    });
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationScripts.seedDefaults()
    ).resolves.toEqual({ createdCount: 10 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_SCRIPT_DEFAULTS_SEEDED",
      }),
      undefined
    );
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .consultationScripts.seedDefaults()
    ).rejects.toThrow();
  });

  it("allows branch_admin to update and soft-delete consultation scripts without logging full script body", async () => {
    const existingScript = {
      id: 701,
      title: "General check",
      category: "general_check",
      scriptBody: "Original safe script body.",
      complianceNote: null,
      tags: null,
      isActive: true,
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getConsultationScriptById").mockResolvedValue(existingScript);
    const updateSpy = vi
      .spyOn(db, "updateConsultationScript")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationScripts.update({
          id: 701,
          title: "Updated general check",
          category: "general_check",
          scriptBody: "Updated safe script body that should not be logged.",
          complianceNote: "Keep guidance balanced.",
          tags: "follow-up",
        })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(
      701,
      expect.objectContaining({
        title: "Updated general check",
        scriptBody: "Updated safe script body that should not be logged.",
        updatedBy: 1,
      })
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_SCRIPT_UPDATED",
        details: expect.not.stringContaining("Updated safe script body"),
      }),
      undefined
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.stringContaining("[redacted]"),
      }),
      undefined
    );

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .consultationScripts.update({
          id: 701,
          isActive: false,
        })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenLastCalledWith(
      701,
      expect.objectContaining({
        isActive: false,
        deletedAt: expect.any(Date),
        updatedBy: 1,
      })
    );
    expect(logSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_SCRIPT_DEACTIVATED",
        details: expect.not.stringContaining("Original safe script body"),
      }),
      undefined
    );
  });

  it("keeps consultation script update and soft-delete branch_admin only", async () => {
    const updateInput = { id: 701, title: "Blocked" };
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin"))
        .consultationScripts.update(updateInput)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .consultationScripts.update(updateInput)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .consultationScripts.update(updateInput)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "inactive" }))
        .consultationScripts.update(updateInput)
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin", { accountStatus: "resigned" }))
        .consultationScripts.update(updateInput)
    ).rejects.toThrow();
  });

  it("hides inactive consultation scripts from regular script lists and renders only active scripts", async () => {
    const listSpy = vi
      .spyOn(db, "getConsultationScripts")
      .mockResolvedValue([]);
    await appRouter
      .createCaller(createCtx("branch_admin"))
      .consultationScripts.list();
    expect(listSpy).toHaveBeenLastCalledWith(false);

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .consultationScripts.list({ includeInactive: true });
    expect(listSpy).toHaveBeenLastCalledWith(true);

    await appRouter
      .createCaller(createCtx("member"))
      .consultationScripts.list({ includeInactive: true });
    expect(listSpy).toHaveBeenLastCalledWith(false);

    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getConsultationScriptById").mockResolvedValue({
      id: 702,
      title: "Deleted script",
      category: "general_check",
      scriptBody: "Deleted script body.",
      isActive: false,
      deletedAt: new Date(),
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultationScripts.render({
          scriptId: 702,
          customerId: 100,
        })
    ).rejects.toThrow();
  });

  it("renders and logs consultation script copy only inside customer access scope", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getConsultationScriptById").mockResolvedValue({
      id: 701,
      title: "General check",
      category: "general_check",
      scriptBody: "Review the current coverage 기준 calmly.",
      isActive: true,
      deletedAt: null,
    } as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    const script = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .consultationScripts.render({
        scriptId: 701,
        customerId: 100,
      });
    expect(script.title).toBe("General check");

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultationScripts.logCopy({
          scriptId: 701,
          customerId: 100,
        })
    ).resolves.toEqual({ success: true });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONSULTATION_SCRIPT_COPIED",
        targetType: "customer",
        targetId: 100,
        details: expect.not.stringContaining("Review the current coverage"),
      }),
      undefined
    );

    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      agentId: 99,
    });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultationScripts.logCopy({
          scriptId: 701,
          customerId: 100,
        })
    ).rejects.toThrow();
  });
});

describe("consultation UX metadata and customer management meta", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] 고객",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "미상담",
    priority: "unclassified",
    customerTags: null,
    nextAction: null,
    isActive: true,
    deletedAt: null,
  } as any;

  it("allows member to create structured consultation for own customer without logging detailed memo", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const createSpy = vi
      .spyOn(db, "createConsultation")
      .mockResolvedValue(undefined);
    const updateCustomerSpy = vi
      .spyOn(db, "updateCustomer")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultations.create({
          customerId: 100,
          status: "미상담",
          consultationType: "전화",
          customerNeed: "보험료 부담",
          nextAction: "재연락",
          summary: "[TEST] 보험료 재상담",
          content: "[TEST] 상세 상담 메모",
        })
    ).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        agentId: 4,
        consultationType: "전화",
        customerNeed: "보험료 부담",
        nextAction: "재연락",
        summary: "[TEST] 보험료 재상담",
        content: "[TEST] 상세 상담 메모",
      })
    );
    expect(updateCustomerSpy).toHaveBeenCalledWith(100, {
      nextAction: "재연락",
    });
    const consultationLog = logSpy.mock.calls.find(
      call => call[0]?.action === "CONSULTATION_CREATED"
    )?.[0];
    expect(consultationLog?.details).not.toContain("[TEST] 보험료 재상담");
    expect(consultationLog?.details).not.toContain("[TEST] 상세 상담 메모");
  });

  it("creates a linked customer schedule when requested from consultation creation", async () => {
    const startTime = parseKstLocalDateTime("2026-05-22T14:00:00");
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 4,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "createConsultation").mockResolvedValue(undefined);
    vi.spyOn(db, "updateCustomer").mockResolvedValue(undefined);
    const scheduleSpy = vi
      .spyOn(db, "createSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      {
        id: 92,
        userId: 4,
        customerId: 100,
        title: "[TEST] consult schedule",
        startTime,
      } as any,
    ]);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(notifications, "createReconsultReminder").mockResolvedValue(
      undefined
    );
    vi.spyOn(notifications, "refreshLongUnmanagedReminder").mockResolvedValue(
      undefined
    );
    vi.spyOn(
      notifications,
      "cancelScheduleTimingNotifications"
    ).mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);
    vi.spyOn(
      notifications,
      "createScheduleIncompleteReminder"
    ).mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultations.create({
          customerId: 100,
          status: "미상담",
          consultationType: "전화",
          customerNeed: "보험료 부담",
          nextAction: "재연락",
          summary: "[TEST] 보험료 재상담",
          nextContactAt: "2026-05-22T14:00:00",
          calendarSchedule: {
            title: "[TEST] consult schedule",
            reminderOffsetMinutes: 60,
          },
        })
    ).resolves.toEqual({ success: true });

    expect(scheduleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 4,
        customerId: 100,
        title: "[TEST] consult schedule",
        type: "재통화",
        startTime,
        reminderOffsetMinutes: 60,
      })
    );
    expect(reminderSpy).toHaveBeenCalledWith(
      92,
      4,
      startTime,
      "[TEST] consult schedule",
      60
    );
  });

  it("blocks member from creating consultation for another member customer", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      agentId: 5,
    });
    const createSpy = vi
      .spyOn(db, "createConsultation")
      .mockResolvedValue(undefined);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .consultations.create({
          customerId: 100,
          status: "미상담",
          consultationType: "전화",
          customerNeed: "기타",
          nextAction: "재연락",
        })
    ).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("updates priority, tags, and nextAction with audit logs", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const updateSpy = vi
      .spyOn(db, "updateCustomer")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.updateManagementMeta({
          customerId: 100,
          priority: "A",
          customerTags: ["가격민감형", "장기관리"],
          nextAction: "설계안 발송",
        })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(
      100,
      expect.objectContaining({
        priority: "A",
        customerTags: JSON.stringify(["가격민감형", "장기관리"]),
        nextAction: "설계안 발송",
      })
    );
    expect(logSpy.mock.calls.map(call => call[0]?.action)).toEqual(
      expect.arrayContaining([
        "CUSTOMER_PRIORITY_UPDATED",
        "CUSTOMER_TAGS_UPDATED",
        "CUSTOMER_NEXT_ACTION_UPDATED",
      ])
    );
  });

  it("rejects invalid priority values", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.updateManagementMeta({
          customerId: 100,
          priority: "VIP" as any,
        })
    ).rejects.toThrow();
  });
});

describe("contracts.listByCustomer - 권한 검증", () => {
  it("returns NOT_FOUND for non-existent customerId", async () => {
    const ctx = createCtx("member", { userId: 3 });
    await expect(
      appRouter
        .createCaller(ctx)
        .contracts.listByCustomer({ customerId: 999999 })
    ).rejects.toThrow();
  });
});
describe("soft delete permissions and audit flow", () => {
  it("allows branch_admin to deactivate an empty active team", async () => {
    vi.spyOn(db, "getTeamById").mockResolvedValue({
      id: 77,
      name: "[TEST] Empty team",
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([]);
    vi.spyOn(db, "getCustomers").mockResolvedValue([]);
    vi.spyOn(db, "getSchedules").mockResolvedValue([]);
    const deactivateSpy = vi
      .spyOn(db, "deactivateTeam")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .users.deactivateTeam({ id: 77 })
    ).resolves.toEqual({ success: true });
    expect(deactivateSpy).toHaveBeenCalledWith(77);
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        action: "TEAM_DEACTIVATED",
        targetType: "team",
        targetId: 77,
      })
    );
  });

  it("blocks non-branch admins and teams with active members from team deletion", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin"))
        .users.deactivateTeam({ id: 77 })
    ).rejects.toThrow();

    vi.spyOn(db, "getTeamById").mockResolvedValue({
      id: 77,
      name: "[TEST] Used team",
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([
      { id: 10, accountStatus: "active" },
    ] as any);
    const deactivateSpy = vi
      .spyOn(db, "deactivateTeam")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .users.deactivateTeam({ id: 77 })
    ).rejects.toThrow();
    expect(deactivateSpy).not.toHaveBeenCalled();
  });

  it("allows branch_admin to soft delete a customer without active contracts", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "getContractsByCustomer").mockResolvedValue([]);
    const softDeleteSpy = vi
      .spyOn(db, "softDeleteCustomer")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .customers.deactivate({ id: 100 })
    ).resolves.toEqual({ success: true });
    expect(softDeleteSpy).toHaveBeenCalledWith(100);
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        action: "CUSTOMER_DEACTIVATED",
        targetType: "customer",
        targetId: 100,
      })
    );
  });

  it("blocks customer deletion for team_leader/member and when active contracts remain", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .customers.deactivate({ id: 100 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .customers.deactivate({ id: 100 })
    ).rejects.toThrow();

    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "getContractsByCustomer").mockResolvedValue([
      { id: 10, isActive: true },
    ] as any);
    const softDeleteSpy = vi
      .spyOn(db, "softDeleteCustomer")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .customers.deactivate({ id: 100 })
    ).rejects.toThrow();
    expect(softDeleteSpy).not.toHaveBeenCalled();
  });

  it("allows branch_admin to soft delete a contract and records history plus audit log", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue({
      id: 10,
      customerId: 100,
      agentId: 4,
      isActive: true,
      deletedAt: null,
      contractStatus: "유지",
    } as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      agentId: 4,
      subBranchAdminId: 2,
      isActive: true,
    } as any);
    const historySpy = vi
      .spyOn(db, "createContractHistoryEntry")
      .mockResolvedValue(undefined);
    const deactivateSpy = vi
      .spyOn(db, "deactivateContract")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .contracts.deactivate({ id: 10 })
    ).resolves.toEqual({ success: true });
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 10,
        fieldName: "isActive",
        afterValue: "false",
      })
    );
    expect(deactivateSpy).toHaveBeenCalledWith(10);
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        action: "CONTRACT_DEACTIVATED",
        targetType: "contract",
        targetId: 10,
      })
    );
  });

  it("blocks contract deletion for team_leader/member and out-of-scope sub_branch_admin", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader"))
        .contracts.deactivate({ id: 10 })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .contracts.deactivate({ id: 10 })
    ).rejects.toThrow();

    vi.spyOn(db, "getContractById").mockResolvedValue({
      id: 10,
      customerId: 100,
      agentId: 4,
      isActive: true,
    } as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      agentId: 4,
      subBranchAdminId: 99,
      isActive: true,
    } as any);
    const deactivateSpy = vi
      .spyOn(db, "deactivateContract")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .contracts.deactivate({ id: 10 })
    ).rejects.toThrow();
    expect(deactivateSpy).not.toHaveBeenCalled();
  });
});

describe("dashboard.todayWork", () => {
  const baseDate = "2026-05-13T09:00:00.000Z";
  const todaySchedule = {
    id: 1,
    userId: 4,
    teamId: 10,
    title: "[TEST] Today call",
    type: "고객상담",
    status: "예정",
    startTime: new Date("2026-05-13T10:00:00.000Z"),
    endTime: new Date("2026-05-13T10:30:00.000Z"),
    isActive: true,
  };
  const overdueSchedule = {
    id: 2,
    userId: 4,
    teamId: 10,
    title: "[TEST] Overdue",
    type: "고객상담",
    status: "예정",
    startTime: new Date("2026-05-12T10:00:00.000Z"),
    endTime: new Date("2026-05-12T10:30:00.000Z"),
    isActive: true,
  };
  const customer = {
    id: 100,
    name: "[TEST] Customer",
    phone: "01012345678",
    memo: "private memo",
    agentId: 4,
    teamId: 10,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "상담예정",
    isActive: true,
  };

  function mockTodayWorkData() {
    vi.spyOn(db, "getCustomers").mockResolvedValue([customer] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      {
        id: 10,
        customerId: 100,
        agentId: 4,
        contractDate: new Date("2026-05-03T00:00:00.000Z"),
        monthlyPremium: 120000,
        isActive: true,
      },
      {
        id: 11,
        customerId: 100,
        agentId: 4,
        contractDate: new Date("2026-04-03T00:00:00.000Z"),
        monthlyPremium: 90000,
        isActive: true,
      },
      {
        id: 12,
        customerId: 100,
        agentId: 4,
        contractDate: new Date("2026-05-04T00:00:00.000Z"),
        monthlyPremium: 30000,
        isActive: false,
      },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      todaySchedule,
      overdueSchedule,
    ] as any);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [
        {
          id: 20,
          userId: 4,
          type: "general",
          title: "[TEST] Notice",
          isRead: false,
          processStatus: "미확인",
          relatedType: "customer",
          relatedId: 100,
          createdAt: new Date("2026-05-13T08:00:00.000Z"),
        },
        {
          id: 21,
          userId: 4,
          type: "long_unmanaged_90",
          title: "[TEST] Long",
          isRead: true,
          processStatus: "확인",
          relatedType: "customer",
          relatedId: 100,
          createdAt: new Date("2026-05-10T08:00:00.000Z"),
        },
      ],
      totalCount: 2,
      hasMore: false,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue([
      {
        id: 30,
        customerId: 100,
        assignedAgentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
        nextContactDate: new Date("2026-05-13T11:00:00.000Z"),
        reason: "[TEST] Follow",
        nextAction: "전화",
        status: "scheduled",
        createdBy: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: 31,
        customerId: 100,
        assignedAgentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
        nextContactDate: new Date("2026-05-12T11:00:00.000Z"),
        reason: "[TEST] Overdue",
        nextAction: "문자",
        status: "scheduled",
        createdBy: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: 32,
        customerId: 100,
        assignedAgentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
        nextContactDate: new Date("2026-05-13T11:00:00.000Z"),
        reason: "[TEST] Done",
        nextAction: "전화",
        status: "completed",
        createdBy: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ] as any);
  }

  it("returns member-scoped today summary without customer phone or memo", async () => {
    mockTodayWorkData();
    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .dashboard.todayWork({ date: baseDate });

    expect(db.getCustomers).toHaveBeenCalledWith({ agentId: 4 });
    expect(db.getAllContracts).toHaveBeenCalledWith({ agentId: 4 });
    expect(result.cards.todayScheduleCount).toBe(1);
    expect(result.cards.incompleteScheduleCount).toBe(1);
    expect(result.cards.pendingNotificationCount).toBe(1);
    expect(result.cards.monthlyContractCount).toBe(1);
    expect(result.cards.monthlyPremiumSum).toBe(120000);
    expect(result.cards.todayFollowUpCount).toBe(2);
    expect(result.cards.overdueFollowUpCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain("01012345678");
    expect(JSON.stringify(result)).not.toContain("private memo");
  });

  it("calculates today follow-ups by Asia/Seoul day boundaries", async () => {
    mockTodayWorkData();
    vi.spyOn(db, "getFollowUps").mockResolvedValue([
      {
        id: 40,
        customerId: 100,
        assignedAgentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
        nextContactDate: parseKstLocalDateTime("2026-05-13T00:30:00"),
        reason: "[TEST] Early",
        nextAction: "전화",
        status: "scheduled",
        createdBy: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: 41,
        customerId: 100,
        assignedAgentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
        nextContactDate: parseKstLocalDateTime("2026-05-12T23:30:00"),
        reason: "[TEST] Overdue",
        nextAction: "전화",
        status: "scheduled",
        createdBy: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ] as any);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .dashboard.todayWork({ date: "2026-05-13" });

    expect(result.cards.todayFollowUpCount).toBe(2);
    expect(result.cards.overdueFollowUpCount).toBe(1);
  });

  it("uses team scope for team_leader and prevents null-team widening", async () => {
    mockTodayWorkData();
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([{ id: 4 }] as any);
    await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .dashboard.todayWork({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ agentIds: [3, 4] });
    expect(db.getAllContracts).toHaveBeenCalledWith({ agentIds: [3, 4] });

    vi.restoreAllMocks();
    mockTodayWorkData();
    await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: null }))
      .dashboard.todayWork({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ agentIds: [3] });
    expect(db.getAllContracts).toHaveBeenCalledWith({ agentIds: [3] });
  });

  it("uses sub-branch and branch scopes, and blocks inactive users", async () => {
    mockTodayWorkData();
    vi.spyOn(db, "getUsersBySubBranchAdminId").mockResolvedValue([
      { id: 4 },
    ] as any);
    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .dashboard.todayWork({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ agentIds: [2, 4] });
    expect(db.getAllContracts).toHaveBeenCalledWith({ agentIds: [2, 4] });

    vi.restoreAllMocks();
    mockTodayWorkData();
    await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .dashboard.todayWork({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({});
    expect(db.getAllContracts).toHaveBeenCalledWith({});

    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .dashboard.todayWork({ date: baseDate })
    ).rejects.toThrow();
  });
});

describe("PR12 recommendations", () => {
  const baseDate = "2026-05-13T09:00:00.000Z";
  const recommendedCustomer = {
    id: 100,
    name: "[TEST] Priority",
    phone: "01012345678",
    memo: "private memo",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "상담예정",
    priority: "A",
    customerTags: JSON.stringify(["해지위험", "사후관리필요"]),
    nextAction: "재연락",
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
  };
  const otherCustomer = {
    id: 200,
    name: "[TEST] Other",
    phone: "01099998888",
    agentId: 9,
    assignedTeamId: 99,
    subBranchAdminId: 8,
    consultStatus: "미상담",
    priority: "unclassified",
    customerTags: null,
    nextAction: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
  };

  function mockRecommendationData(customers = [recommendedCustomer]) {
    vi.spyOn(db, "getCustomers").mockResolvedValue(customers as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([
      {
        id: 10,
        customerId: 100,
        agentId: 4,
        contractDate: new Date("2026-04-01T00:00:00.000Z"),
        monthlyPremium: 100000,
        isActive: true,
        deletedAt: null,
      },
      {
        id: 11,
        customerId: 100,
        agentId: 4,
        contractDate: new Date("2026-04-01T00:00:00.000Z"),
        monthlyPremium: 100000,
        isActive: false,
        deletedAt: new Date(),
      },
    ] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([]);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [
        {
          id: 20,
          userId: 4,
          type: "general",
          title: "[TEST] Notice",
          isRead: false,
          processStatus: "미확인",
          relatedType: "customer",
          relatedId: 100,
          createdAt: new Date("2026-05-13T08:00:00.000Z"),
        },
      ],
      totalCount: 1,
      hasMore: false,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue([
      {
        id: 30,
        customerId: 100,
        assignedAgentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
        nextContactDate: new Date("2026-05-12T11:00:00.000Z"),
        reason: "[TEST] Overdue",
        nextAction: "전화",
        status: "scheduled",
        deletedAt: null,
      },
      {
        id: 31,
        customerId: 100,
        assignedAgentId: 4,
        teamId: 10,
        subBranchAdminId: 2,
        nextContactDate: new Date("2026-05-13T11:00:00.000Z"),
        reason: "[TEST] Today",
        nextAction: "전화",
        status: "scheduled",
        deletedAt: null,
      },
    ] as any);
    vi.spyOn(db, "getConsultationsByCustomer").mockResolvedValue([]);
  }

  it("returns scored priority contacts without phone or memo", async () => {
    mockRecommendationData();
    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .recommendations.priorityContacts({ date: baseDate, limit: 10 });

    expect(db.getCustomers).toHaveBeenCalledWith({ agentId: 4 });
    expect(result[0].customerId).toBe(100);
    expect(result[0].urgency).toBe("high");
    expect(result[0].warnings.map(warning => warning.warningType)).toContain(
      "overdue_follow_up"
    );
    expect(result[0].reasons).toContain("A등급 고객");
    expect(JSON.stringify(result)).not.toContain("01012345678");
    expect(JSON.stringify(result)).not.toContain("private memo");
  });

  it("uses role scopes and blocks inactive users", async () => {
    mockRecommendationData();
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([{ id: 4 }] as any);
    await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .recommendations.dashboardSummary({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ agentIds: [3, 4] });

    vi.restoreAllMocks();
    mockRecommendationData();
    vi.spyOn(db, "getUsersBySubBranchAdminId").mockResolvedValue([
      { id: 4 },
    ] as any);
    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .recommendations.dashboardSummary({ date: baseDate });
    expect(db.getCustomers).toHaveBeenCalledWith({ agentIds: [2, 4] });

    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .recommendations.priorityContacts({ date: baseDate })
    ).rejects.toThrow();
  });

  it("returns safe contact reasons and warning details for an accessible customer", async () => {
    mockRecommendationData();
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      recommendedCustomer as any
    );
    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .recommendations.customerContactReasons({ customerId: 100 });

    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toMatch(
      /무조건|반드시 가입|지금 안 하면|큰일/
    );
  });

  it("does not mark a newly assigned old customer as long unmanaged before the assignment grace period", async () => {
    const newlyAssignedCustomer = {
      ...recommendedCustomer,
      consultStatus: "미상담",
      priority: "unclassified",
      customerTags: null,
      nextAction: null,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      assignedAt: new Date("2026-05-13T08:00:00.000Z"),
    };
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      newlyAssignedCustomer,
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([]);
    vi.spyOn(db, "getSchedules").mockResolvedValue([]);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [],
      totalCount: 0,
      hasMore: false,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue([]);
    vi.spyOn(db, "getConsultationsByCustomer").mockResolvedValue([]);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(
      newlyAssignedCustomer as any
    );

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .recommendations.customerContactReasons({ customerId: 100 });

    expect(result.warnings.map(warning => warning.warningType)).not.toContain(
      "long_unmanaged"
    );
    expect(result.reasons.map(reason => reason.reasonType)).not.toContain(
      "long_unmanaged"
    );
  });

  it("does not recommend soft deleted customers", async () => {
    mockRecommendationData([
      { ...recommendedCustomer, isActive: false, deletedAt: new Date() },
    ]);
    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .recommendations.priorityContacts({ date: baseDate });
    expect(result).toEqual([]);
  });
});

describe("PR14 work rhythm report", () => {
  const dateFrom = "2026-05-01T00:00:00+09:00";
  const dateTo = "2026-05-31T23:59:59+09:00";
  const customers = [
    {
      id: 100,
      name: "[TEST] A",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      priority: "A",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-04-01"),
    },
    {
      id: 101,
      name: "[TEST] B",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      priority: "B",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-04-02"),
    },
  ] as any[];
  const contracts = [
    {
      id: 11,
      customerId: 100,
      agentId: 4,
      contractDate: new Date("2026-05-10"),
      monthlyPremium: 100000,
      isActive: true,
      deletedAt: null,
    },
    {
      id: 12,
      customerId: 101,
      agentId: 4,
      contractDate: new Date("2026-05-11"),
      monthlyPremium: 50000,
      isActive: false,
      deletedAt: new Date("2026-05-12"),
    },
  ] as any[];
  const followUps = [
    {
      id: 21,
      customerId: 100,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "completed",
      nextContactDate: new Date("2026-05-10"),
      completedAt: new Date("2026-05-10"),
      createdAt: new Date("2026-05-09"),
      deletedAt: null,
    },
    {
      id: 22,
      customerId: 101,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "scheduled",
      nextContactDate: new Date("2026-05-01"),
      createdAt: new Date("2026-05-01"),
      deletedAt: null,
    },
  ] as any[];

  function mockWorkRhythmData() {
    vi.spyOn(db, "getCustomers").mockResolvedValue(customers as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue(contracts as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([]);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 200,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue(followUps as any);
    vi.spyOn(db, "getConsultationsByCustomer").mockImplementation(
      async (customerId: number) =>
        customerId === 100
          ? ([
              {
                id: 31,
                customerId,
                createdAt: new Date("2026-05-13"),
                content: "do not expose memo",
              },
            ] as any)
          : []
    );
    vi.spyOn(db, "getPerformanceGoalDashboard").mockResolvedValue({
      items: [
        {
          goal: {
            id: 41,
            targetType: "user",
            targetId: 4,
            contractCountGoal: 3,
            monthlyPremiumGoal: 300000,
          },
          targetLabel: "Test member",
          actual: { contractCount: 1, monthlyPremium: 100000 },
          remaining: { contractCount: 2, monthlyPremium: 200000 },
          remainingDays: 10,
          dailyRequired: { contractCount: 0.2, monthlyPremium: 20000 },
          achievementRate: { contractCount: 33, monthlyPremium: 33 },
          status: "in_progress",
        },
      ],
      summary: {},
    } as any);
  }

  it("returns scoped aggregation and goal action recommendations without customer private fields", async () => {
    mockWorkRhythmData();
    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .workRhythm.summary({
        period: "custom",
        dateFrom,
        dateTo,
      });

    expect(result.consultationCount).toBe(1);
    expect(result.followUpCreatedCount).toBe(2);
    expect(result.followUpCompletedCount).toBe(1);
    expect(result.contractCount).toBe(1);
    expect(result.newContractCount).toBe(1);
    expect(result.monthlyPremiumSum).toBe(100000);
    expect(result.monthlyPremiumTotal).toBe(100000);
    expect(result.remaining.contractCount).toBe(2);
    expect(result).not.toHaveProperty("maintenanceContractCount");
    expect(result).not.toHaveProperty("activeContractCount");
    expect(JSON.stringify(result)).not.toContain("do not expose memo");
    expect(JSON.stringify(result)).not.toContain("010");
  });

  it("blocks member target-user escalation and inactive users", async () => {
    mockWorkRhythmData();
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 5,
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .workRhythm.summary({
          period: "custom",
          dateFrom,
          dateTo,
          targetUserId: 5,
        })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .workRhythm.summary({ period: "month" })
    ).rejects.toThrow();
  });

  it("allows team_leader to request own team report and applies team filters", async () => {
    mockWorkRhythmData();
    vi.spyOn(db, "getTeamById").mockResolvedValue({
      id: 10,
      name: "[TEST] Team",
      subBranchAdminId: 2,
    } as any);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([
      { id: 4 },
      { id: 5 },
    ] as any);

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .workRhythm.summary({
          period: "custom",
          dateFrom,
          dateTo,
          teamId: 10,
        })
    ).resolves.toMatchObject({
      scope: expect.objectContaining({ teamId: 10 }),
    });
  });
});

describe("adminTeamInsights", () => {
  const dateFrom = "2026-05-01T00:00:00";
  const dateTo = "2026-05-31T23:59:59";
  const users = [
    {
      id: 1,
      name: "[TEST] Branch Admin",
      role: "branch_admin",
      accountStatus: "active",
    },
    {
      id: 2,
      name: "[TEST] Sub Branch Admin",
      role: "sub_branch_admin",
      accountStatus: "active",
    },
    {
      id: 3,
      name: "[TEST] Leader",
      role: "team_leader",
      teamId: 10,
      subBranchAdminId: 2,
      accountStatus: "active",
    },
    {
      id: 4,
      name: "[TEST] Member",
      role: "member",
      teamId: 10,
      subBranchAdminId: 2,
      accountStatus: "active",
    },
    {
      id: 5,
      name: "[TEST] Inactive",
      role: "member",
      teamId: 10,
      subBranchAdminId: 2,
      accountStatus: "inactive",
    },
  ];

  function mockDashboardData() {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(users as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue([
      { id: 10, subBranchAdminId: 2, isActive: true },
    ] as any);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([
      { id: 3 },
      { id: 4 },
    ] as any);
    vi.spyOn(db, "getCustomers").mockResolvedValue([
      {
        id: 100,
        agentId: 4,
        consultStatus: "미상담",
        priority: "B",
        isActive: true,
        deletedAt: null,
      },
    ] as any);
    vi.spyOn(db, "getAllContracts").mockResolvedValue([] as any);
    vi.spyOn(db, "getSchedules").mockResolvedValue([] as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue([] as any);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 200,
    } as any);
    vi.spyOn(db, "getConsultationsByCustomer").mockResolvedValue([] as any);
  }

  it("calculates metrics correctly for team members", async () => {
    mockDashboardData();
    const result = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .adminTeamInsights.summary();

    expect(result.summary.totalUnconsultedDb).toBe(1);
    expect(
      result.userMetrics.find((m: any) => m.user.id === 4)?.metrics
        .unconsultedDbCount
    ).toBe(1);
    expect(result.userMetrics.some((m: any) => m.user.id === 5)).toBe(false); // Inactive excluded
  });

  it("blocks member access", async () => {
    mockDashboardData();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .adminTeamInsights.summary()
    ).rejects.toThrow(/FORBIDDEN|관리자/);
  });
});

describe("PR5 sales funnel performance report", () => {
  const dateFrom = "2026-05-01T00:00:00";
  const dateTo = "2026-05-31T23:59:59";
  const users = [
    {
      id: 1,
      name: "[TEST] Branch",
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: null,
    },
    {
      id: 2,
      name: "[TEST] Sub",
      role: "sub_branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: 1,
    },
    {
      id: 3,
      name: "[TEST] Leader",
      role: "team_leader",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 2,
    },
    {
      id: 4,
      name: "[TEST] Member",
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 3,
    },
    {
      id: 5,
      name: "[TEST] Other",
      role: "member",
      accountStatus: "active",
      teamId: 20,
      subBranchAdminId: 99,
      parentUserId: 30,
    },
    {
      id: 6,
      name: "[TEST] Inactive",
      role: "member",
      accountStatus: "inactive",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 3,
    },
    {
      id: 7,
      name: "[TEST] Resigned",
      role: "member",
      accountStatus: "resigned",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 3,
    },
  ] as any[];
  const teams = [
    {
      id: 10,
      name: "[TEST] Team",
      managerId: 3,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    },
    {
      id: 20,
      name: "[TEST] Other Team",
      managerId: 30,
      subBranchAdminId: 99,
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const customers = [
    {
      id: 100,
      name: "[TEST] Customer A",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-04-01"),
    },
    {
      id: 101,
      name: "[TEST] Customer B",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "미상담",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-04-02"),
    },
    {
      id: 200,
      name: "[TEST] Other Customer",
      agentId: 5,
      assignedTeamId: 20,
      subBranchAdminId: 99,
      consultStatus: "계약",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-04-03"),
    },
  ] as any[];
  const contracts = [
    {
      id: 11,
      customerId: 100,
      agentId: 4,
      contractDate: new Date("2026-05-10"),
      monthlyPremium: 100000,
      contractStatus: "유지",
      paymentStatus: "정상",
      isActive: true,
      deletedAt: null,
    },
    {
      id: 12,
      customerId: 200,
      agentId: 5,
      contractDate: new Date("2026-05-11"),
      monthlyPremium: 200000,
      contractStatus: "유지",
      paymentStatus: "정상",
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const followUps = [
    {
      id: 21,
      customerId: 100,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "completed",
      nextContactDate: new Date("2026-05-10"),
      completedAt: new Date("2026-05-10"),
      createdAt: new Date("2026-05-09"),
      deletedAt: null,
    },
    {
      id: 22,
      customerId: 101,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "scheduled",
      nextContactDate: new Date("2026-05-20"),
      createdAt: new Date("2026-05-15"),
      deletedAt: null,
    },
    {
      id: 23,
      customerId: 200,
      assignedAgentId: 5,
      teamId: 20,
      subBranchAdminId: 99,
      status: "completed",
      nextContactDate: new Date("2026-05-11"),
      completedAt: new Date("2026-05-11"),
      createdAt: new Date("2026-05-10"),
      deletedAt: null,
    },
  ] as any[];
  const schedules = [
    {
      id: 31,
      userId: 4,
      teamId: 10,
      status: "완료",
      startTime: new Date("2026-05-13"),
      completedAt: new Date("2026-05-13"),
      isActive: true,
      deletedAt: null,
    },
    {
      id: 32,
      userId: 5,
      teamId: 20,
      status: "완료",
      startTime: new Date("2026-05-14"),
      completedAt: new Date("2026-05-14"),
      isActive: true,
      deletedAt: null,
    },
  ] as any[];

  function mockSalesReportData(
    overrides: Partial<{
      customers: any[];
      contracts: any[];
      followUps: any[];
      schedules: any[];
    }> = {}
  ) {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(users as any);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams as any);
    vi.spyOn(db, "getUserById").mockImplementation(
      async (id: number) => users.find(item => item.id === id) as any
    );
    vi.spyOn(db, "getTeamById").mockImplementation(
      async (id: number) => teams.find(item => item.id === id) as any
    );
    vi.spyOn(db, "getUsersByTeamId").mockImplementation(
      async (teamId: number) =>
        users.filter(item => item.teamId === teamId) as any
    );
    vi.spyOn(db, "getUsersBySubBranchAdminId").mockImplementation(
      async (subBranchAdminId: number) =>
        users.filter(
          item =>
            item.subBranchAdminId === subBranchAdminId ||
            item.id === subBranchAdminId
        ) as any
    );
    vi.spyOn(db, "getCustomers").mockResolvedValue(
      (overrides.customers ?? customers) as any
    );
    vi.spyOn(db, "getAllContracts").mockResolvedValue(
      (overrides.contracts ?? contracts) as any
    );
    vi.spyOn(db, "getSchedules").mockResolvedValue(
      (overrides.schedules ?? schedules) as any
    );
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 200,
    } as any);
    vi.spyOn(db, "getFollowUps").mockResolvedValue(
      (overrides.followUps ?? followUps) as any
    );
    vi.spyOn(db, "getConsultationsByCustomer").mockImplementation(
      async (customerId: number) => {
        if (customerId === 100)
          return [
            {
              id: 41,
              customerId,
              agentId: 4,
              createdAt: new Date("2026-05-10"),
              content: "010-1111-2222 sensitive memo",
            },
          ] as any;
        if (customerId === 200)
          return [
            {
              id: 42,
              customerId,
              agentId: 5,
              createdAt: new Date("2026-05-11"),
              content: "other memo",
            },
          ] as any;
        return [] as any;
      }
    );
    vi.spyOn(db, "getPerformanceGoalDashboard").mockResolvedValue({
      items: [
        {
          goal: {
            id: 51,
            targetType: "user",
            targetId: 4,
            contractCountGoal: 2,
            monthlyPremiumGoal: 200000,
          },
          achievementRate: { contractCount: 50, monthlyPremium: 50 },
        },
        {
          goal: {
            id: 52,
            targetType: "branch",
            targetId: null,
            contractCountGoal: 5,
            monthlyPremiumGoal: 1000000,
          },
          achievementRate: { contractCount: 40, monthlyPremium: 30 },
        },
      ],
      summary: {},
    } as any);
  }

  it("lets a member view only their own funnel report without exposing consultation body", async () => {
    mockSalesReportData();
    const result = await appRouter
      .createCaller(
        createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
      )
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
      });

    expect(result.performance.newContractCount).toBe(1);
    expect(result.performance.monthlyPremiumTotal).toBe(100000);
    expect(result.performance.consultationCount).toBe(1);
    expect(result.performance.followUpCompletionRate).toBe(50);
    expect(result.ranking).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("010-1111-2222");
    expect(JSON.stringify(result)).not.toContain("sensitive memo");
  });

  it("blocks member escalation to another user's report", async () => {
    mockSalesReportData();
    await expect(
      appRouter
        .createCaller(
          createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
        )
        .salesReports.summary({
          period: "custom",
          dateFrom,
          dateTo,
          organizationType: "user",
          userId: 5,
        })
    ).rejects.toThrow();
  });

  it("lets branch_admin see organization ranking and combined performance", async () => {
    mockSalesReportData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
      });

    expect(result.performance.newContractCount).toBe(2);
    expect(result.performance.monthlyPremiumTotal).toBe(300000);
    expect(result.scope.canViewRanking).toBe(true);
    expect(result.ranking.map(item => item.userId)).toEqual(
      expect.arrayContaining([4, 5])
    );
  });

  it("lets branch_admin use my DB scope without exposing organization ranking", async () => {
    mockSalesReportData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        scope: "mine",
      });

    expect(result.scope.targetUserId).toBe(1);
    expect(result.scope.canViewRanking).toBe(false);
    expect(result.ranking).toHaveLength(0);
  });

  it("limits branch_admin ownershipScope mine to customers directly assigned to the branch admin", async () => {
    mockSalesReportData({
      customers: [
        ...customers,
        {
          id: 300,
          name: "[TEST] Branch Own",
          agentId: 1,
          assignedTeamId: null,
          subBranchAdminId: null,
          consultStatus: "계약",
          isActive: true,
          deletedAt: null,
          createdAt: new Date("2026-04-04"),
        },
      ],
      contracts: [
        ...contracts,
        {
          id: 13,
          customerId: 300,
          agentId: 1,
          contractDate: new Date("2026-05-12"),
          monthlyPremium: 50000,
          contractStatus: "유지",
          paymentStatus: "정상",
          isActive: true,
          deletedAt: null,
        },
      ],
    });
    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "mine",
      });

    expect(result.scope.ownershipScope).toBe("mine");
    expect(result.scope.targetUserId).toBe(1);
    expect(result.funnel.stages.find(stage => stage.key === "db")?.count).toBe(
      1
    );
    expect(result.performance.newContractCount).toBe(1);
    expect(result.performance.monthlyPremiumTotal).toBe(50000);
    expect(result.ranking).toHaveLength(0);
  });

  it("keeps sub_branch_admin and team_leader ownershipScope mine separate from subordinate customers", async () => {
    mockSalesReportData({
      customers: [
        ...customers,
        {
          id: 301,
          name: "[TEST] Sub Own",
          agentId: 2,
          assignedTeamId: null,
          subBranchAdminId: 2,
          consultStatus: "계약",
          isActive: true,
          deletedAt: null,
          createdAt: new Date("2026-04-05"),
        },
        {
          id: 302,
          name: "[TEST] Leader Own",
          agentId: 3,
          assignedTeamId: 10,
          subBranchAdminId: 2,
          consultStatus: "계약",
          isActive: true,
          deletedAt: null,
          createdAt: new Date("2026-04-06"),
        },
      ],
      contracts: [
        ...contracts,
        {
          id: 14,
          customerId: 301,
          agentId: 2,
          contractDate: new Date("2026-05-12"),
          monthlyPremium: 60000,
          contractStatus: "유지",
          paymentStatus: "정상",
          isActive: true,
          deletedAt: null,
        },
        {
          id: 15,
          customerId: 302,
          agentId: 3,
          contractDate: new Date("2026-05-13"),
          monthlyPremium: 70000,
          contractStatus: "유지",
          paymentStatus: "정상",
          isActive: true,
          deletedAt: null,
        },
      ],
    });

    const subResult = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "mine",
      });
    const leaderResult = await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "mine",
      });

    expect(subResult.performance.newContractCount).toBe(1);
    expect(subResult.performance.monthlyPremiumTotal).toBe(60000);
    expect(
      subResult.funnel.stages.find(stage => stage.key === "db")?.count
    ).toBe(1);
    expect(subResult.ranking).toHaveLength(0);
    expect(leaderResult.performance.newContractCount).toBe(1);
    expect(leaderResult.performance.monthlyPremiumTotal).toBe(70000);
    expect(
      leaderResult.funnel.stages.find(stage => stage.key === "db")?.count
    ).toBe(1);
    expect(leaderResult.ranking).toHaveLength(0);
  });

  it("keeps member managed ownership requests scoped to the member's own customers", async () => {
    mockSalesReportData();
    const result = await appRouter
      .createCaller(
        createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
      )
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "managed",
      });

    expect(result.scope.ownershipScope).toBe("mine");
    expect(result.performance.newContractCount).toBe(1);
    expect(result.performance.monthlyPremiumTotal).toBe(100000);
    expect(result.scope.canViewRanking).toBe(false);
    expect(result.ranking).toHaveLength(0);
  });

  it("hides member ranking for ownershipScope mine across direct endpoint calls", async () => {
    mockSalesReportData();
    const result = await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .salesReports.memberRanking({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "mine",
      });

    expect(result.scope.ownershipScope).toBe("mine");
    expect(result.scope.canViewRanking).toBe(false);
    expect(result.ranking).toHaveLength(0);
  });

  it("lets managers report on a selected active organization member without including other assignees", async () => {
    mockSalesReportData();

    const branchResult = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 4,
      });
    const subResult = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 4,
      });
    const leaderResult = await appRouter
      .createCaller(
        createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
      )
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 4,
      });

    for (const result of [branchResult, subResult, leaderResult]) {
      expect(result.scope.ownershipScope).toBe("member");
      expect(result.scope.targetUserId).toBe(4);
      expect(
        result.funnel.stages.find(stage => stage.key === "db")?.count
      ).toBe(2);
      expect(result.performance.newContractCount).toBe(1);
      expect(result.performance.monthlyPremiumTotal).toBe(100000);
      expect(result.scope.canViewRanking).toBe(false);
      expect(result.ranking).toHaveLength(0);
      expect(JSON.stringify(result)).not.toContain("other memo");
    }
  });

  it("blocks invalid selected member scopes and hides inactive or resigned users from options", async () => {
    mockSalesReportData();
    const branchCaller = appRouter.createCaller(
      createCtx("branch_admin", { userId: 1 })
    );
    const subCaller = appRouter.createCaller(
      createCtx("sub_branch_admin", { userId: 2 })
    );
    const leaderCaller = appRouter.createCaller(
      createCtx("team_leader", { userId: 3, teamId: 10, subBranchAdminId: 2 })
    );
    const memberCaller = appRouter.createCaller(
      createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
    );

    await expect(
      branchCaller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
      })
    ).rejects.toThrow();
    await expect(
      branchCaller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 6,
      })
    ).rejects.toThrow();
    await expect(
      branchCaller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 7,
      })
    ).rejects.toThrow();
    await expect(
      subCaller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 5,
      })
    ).rejects.toThrow();
    await expect(
      leaderCaller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 5,
      })
    ).rejects.toThrow();
    await expect(
      memberCaller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 5,
      })
    ).rejects.toThrow();

    const options = await branchCaller.salesReports.filterOptions();
    expect(options.users.map(item => item.id)).toEqual(
      expect.arrayContaining([2, 3, 4, 5])
    );
    expect(options.users.map(item => item.id)).not.toEqual(
      expect.arrayContaining([6, 7])
    );
  });

  it("hides ranking for ownershipScope member across direct endpoint calls", async () => {
    mockSalesReportData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .salesReports.memberRanking({
        period: "custom",
        dateFrom,
        dateTo,
        ownershipScope: "member",
        selectedUserId: 4,
      });

    expect(result.scope.ownershipScope).toBe("member");
    expect(result.scope.targetUserId).toBe(4);
    expect(result.scope.canViewRanking).toBe(false);
    expect(result.ranking).toHaveLength(0);
  });

  it("allows sub_branch_admin own scope and blocks outside user or team", async () => {
    mockSalesReportData();
    const caller = appRouter.createCaller(
      createCtx("sub_branch_admin", { userId: 2 })
    );

    await expect(
      caller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        organizationType: "sub_branch",
        subBranchAdminId: 2,
      })
    ).resolves.toMatchObject({
      performance: expect.objectContaining({ newContractCount: 1 }),
      scope: expect.objectContaining({ subBranchAdminId: 2 }),
    });
    await expect(
      caller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        organizationType: "user",
        userId: 5,
      })
    ).rejects.toThrow();
    await expect(
      caller.salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
        organizationType: "team",
        teamId: 20,
      })
    ).rejects.toThrow();
  });

  it("allows team_leader own team scope and blocks member team ranking requests", async () => {
    mockSalesReportData();

    await expect(
      appRouter
        .createCaller(
          createCtx("team_leader", {
            userId: 3,
            teamId: 10,
            subBranchAdminId: 2,
          })
        )
        .salesReports.summary({
          period: "custom",
          dateFrom,
          dateTo,
          organizationType: "team",
          teamId: 10,
        })
    ).resolves.toMatchObject({
      performance: expect.objectContaining({ newContractCount: 1 }),
      scope: expect.objectContaining({ teamId: 10 }),
    });

    await expect(
      appRouter
        .createCaller(
          createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
        )
        .salesReports.summary({
          period: "custom",
          dateFrom,
          dateTo,
          organizationType: "team",
          teamId: 10,
        })
    ).rejects.toThrow();
  });

  it("blocks team_leader from reading another team report", async () => {
    mockSalesReportData();
    await expect(
      appRouter
        .createCaller(
          createCtx("team_leader", {
            userId: 3,
            teamId: 10,
            subBranchAdminId: 2,
          })
        )
        .salesReports.summary({
          period: "custom",
          dateFrom,
          dateTo,
          organizationType: "team",
          teamId: 20,
        })
    ).rejects.toThrow();
  });

  it("blocks inactive users from salesReports APIs", async () => {
    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .salesReports.summary({ period: "month" })
    ).rejects.toThrow();
  });

  it("blocks resigned users from salesReports APIs", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .salesReports.summary({ period: "month" })
    ).rejects.toThrow();
  });

  it("keeps conversion rates safe when there is no denominator", async () => {
    mockSalesReportData({
      customers: [],
      contracts: [],
      followUps: [],
      schedules: [],
    });
    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .salesReports.summary({
        period: "custom",
        dateFrom,
        dateTo,
      });

    expect(result.performance.dbToConsultRate).toBe(0);
    expect(result.performance.consultToContractRate).toBe(0);
    expect(result.performance.followUpCompletionRate).toBe(0);
    expect(
      result.funnel.stages.every(
        stage =>
          stage.conversionRate === null || Number.isFinite(stage.conversionRate)
      )
    ).toBe(true);
  });

  it("uses Asia/Seoul inclusive date boundaries for custom ranges", async () => {
    mockSalesReportData({
      contracts: [
        {
          id: 71,
          customerId: 100,
          agentId: 4,
          contractDate: new Date("2026-05-30T14:59:59.000Z"),
          monthlyPremium: 70000,
          contractStatus: "유지",
          paymentStatus: "정상",
          isActive: true,
          deletedAt: null,
        },
        {
          id: 72,
          customerId: 100,
          agentId: 4,
          contractDate: new Date("2026-05-30T15:00:00.000Z"),
          monthlyPremium: 80000,
          contractStatus: "유지",
          paymentStatus: "정상",
          isActive: true,
          deletedAt: null,
        },
        {
          id: 73,
          customerId: 100,
          agentId: 4,
          contractDate: new Date("2026-05-31T14:59:59.000Z"),
          monthlyPremium: 90000,
          contractStatus: "유지",
          paymentStatus: "정상",
          isActive: true,
          deletedAt: null,
        },
        {
          id: 74,
          customerId: 100,
          agentId: 4,
          contractDate: new Date("2026-05-31T15:00:00.000Z"),
          monthlyPremium: 100000,
          contractStatus: "유지",
          paymentStatus: "정상",
          isActive: true,
          deletedAt: null,
        },
      ],
    });

    const result = await appRouter
      .createCaller(
        createCtx("member", { userId: 4, teamId: 10, subBranchAdminId: 2 })
      )
      .salesReports.summary({
        period: "custom",
        dateFrom: "2026-05-31",
        dateTo: "2026-05-31",
      });

    expect(result.period.dateFrom).toBe("2026-05-30T15:00:00.000Z");
    expect(result.period.dateTo).toBe("2026-05-31T14:59:59.999Z");
    expect(result.performance.newContractCount).toBe(2);
    expect(result.performance.monthlyPremiumTotal).toBe(170000);
  });
});

describe("followUps", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    isActive: true,
    deletedAt: null,
  } as any;
  const activeFollowUp = {
    id: 30,
    customerId: 100,
    assignedAgentId: 4,
    teamId: 10,
    subBranchAdminId: 2,
    nextContactDate: new Date("2026-05-13T10:00:00.000Z"),
    reason: "[TEST] Reason",
    nextAction: "전화",
    status: "scheduled",
    createdBy: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as any;

  it("allows member to create follow_up for own customer and blocks another customer", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const createSpy = vi
      .spyOn(db, "createFollowUp")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.create({
          customerId: 100,
          nextContactDate: "2026-05-14T10:00:00.000Z",
          reason: "[TEST] Follow",
          nextAction: "전화",
        })
    ).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        status: "scheduled",
        assignedAgentId: 4,
      })
    );
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "FOLLOW_UP_CREATED" })
    );

    vi.restoreAllMocks();
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      agentId: 99,
    });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.create({
          customerId: 100,
          nextContactDate: "2026-05-14T10:00:00.000Z",
          reason: "[TEST] Follow",
          nextAction: "전화",
        })
    ).rejects.toThrow();
  });

  it("blocks follow_up creation for inactive customer and inactive account", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      isActive: false,
      deletedAt: new Date(),
    });
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).followUps.create({
        customerId: 100,
        nextContactDate: "2026-05-14T10:00:00.000Z",
        reason: "[TEST] Follow",
        nextAction: "전화",
      })
    ).rejects.toThrow();

    await expect(
      appRouter.createCaller(createInactiveCtx()).followUps.listToday()
    ).rejects.toThrow();
  });

  it("completes, postpones and cancels an accessible follow_up with logs", async () => {
    vi.spyOn(db, "getFollowUpById").mockResolvedValue(activeFollowUp);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const updateSpy = vi
      .spyOn(db, "updateFollowUp")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.complete({ id: 30 })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.postpone({
          id: 30,
          nextContactDate: "2026-05-15T10:00:00.000Z",
          reason: "[TEST] Later",
        })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.cancel({ id: 30 })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(
      30,
      expect.objectContaining({ status: "completed", completedBy: 4 })
    );
    expect(updateSpy).toHaveBeenCalledWith(
      30,
      expect.objectContaining({ status: "postponed" })
    );
    expect(updateSpy).toHaveBeenCalledWith(
      30,
      expect.objectContaining({ status: "cancelled" })
    );
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "FOLLOW_UP_COMPLETED" })
    );
    expect(logSpy.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ action: "FOLLOW_UP_POSTPONED" })
    );
    expect(logSpy.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({ action: "FOLLOW_UP_CANCELLED" })
    );
  });

  it("uses role scopes for today and overdue follow_up lists", async () => {
    const listSpy = vi
      .spyOn(db, "getFollowUps")
      .mockResolvedValue([activeFollowUp]);
    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .followUps.listToday({ date: "2026-05-13T00:00:00.000Z" });
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 4 })
    );

    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([{ id: 4 }] as any);
    await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .followUps.listOverdue({ date: "2026-05-13T00:00:00.000Z" });
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentIds: [3, 4] })
    );

    vi.spyOn(db, "getUsersBySubBranchAdminId").mockResolvedValue([
      { id: 4 },
    ] as any);
    await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .followUps.listToday({ date: "2026-05-13T00:00:00.000Z" });
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentIds: [2, 4] })
    );
  });
});

describe("PR4 mobile three-touch task completion APIs", () => {
  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    agentId: 4,
    assignedTeamId: 10,
    subBranchAdminId: 2,
    consultStatus: "미상담",
    isActive: true,
    deletedAt: null,
  } as any;

  it("lets a member complete own follow_up and blocks another member's follow_up", async () => {
    const followUp = {
      id: 900,
      customerId: 100,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "scheduled",
      nextContactDate: new Date("2026-05-20T10:00:00.000Z"),
      deletedAt: null,
    } as any;
    vi.spyOn(db, "getFollowUpById").mockResolvedValue(followUp);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const updateSpy = vi
      .spyOn(db, "updateFollowUp")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.complete({ id: 900 })
    ).resolves.toEqual({ success: true });
    expect(updateSpy).toHaveBeenCalledWith(
      900,
      expect.objectContaining({ status: "completed", completedBy: 4 })
    );

    vi.restoreAllMocks();
    vi.spyOn(db, "getFollowUpById").mockResolvedValue(followUp);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      agentId: 99,
    });
    const blockedUpdateSpy = vi
      .spyOn(db, "updateFollowUp")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .followUps.complete({ id: 900 })
    ).rejects.toThrow();
    expect(blockedUpdateSpy).not.toHaveBeenCalled();
  });

  it("completes schedules through existing scoped update without recreating reminder notifications", async () => {
    const schedule = {
      id: 901,
      userId: 4,
      title: "[TEST] Mobile schedule",
      type: "고객상담",
      status: "예정",
      startTime: new Date("2026-05-20T10:00:00.000Z"),
      endTime: new Date("2026-05-20T11:00:00.000Z"),
      isActive: true,
      completedAt: null,
      deletedAt: null,
      reminderOffsetMinutes: 30,
    } as any;
    vi.spyOn(db, "getScheduleById").mockResolvedValue(schedule);
    const updateSpy = vi
      .spyOn(db, "updateSchedule")
      .mockResolvedValue(undefined);
    const completeSpy = vi
      .spyOn(db, "completeSchedule")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    const cancelIncompleteSpy = vi
      .spyOn(notifications, "cancelScheduleIncompleteNotification")
      .mockResolvedValue(undefined);
    const cancelTimingSpy = vi
      .spyOn(notifications, "cancelScheduleTimingNotifications")
      .mockResolvedValue(undefined);
    const reminderSpy = vi
      .spyOn(notifications, "createScheduleReminderByOffset")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .schedules.update({ id: 901, status: "완료" })
    ).resolves.toEqual({ success: true });

    expect(updateSpy).toHaveBeenCalledWith(
      901,
      expect.objectContaining({ status: "완료" })
    );
    expect(completeSpy).toHaveBeenCalledWith(901);
    expect(cancelIncompleteSpy).toHaveBeenCalledWith(4, 901);
    expect(cancelTimingSpy).not.toHaveBeenCalled();
    expect(reminderSpy).not.toHaveBeenCalled();
  });

  it("acknowledges notifications with existing read/status mutations and scoped access", async () => {
    const notification = {
      id: 902,
      userId: 4,
      type: "schedule_reminder",
      title: "[TEST] Notification",
      processStatus: "미확인",
      isRead: false,
    } as any;
    vi.spyOn(db, "getNotificationById").mockResolvedValue(notification);
    const statusSpy = vi
      .spyOn(db, "updateNotificationProcessStatus")
      .mockResolvedValue(undefined);
    const readSpy = vi
      .spyOn(db, "markNotificationRead")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .notifications.updateProcessStatus({ id: 902, processStatus: "확인" })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .notifications.markRead({ id: 902 })
    ).resolves.toEqual({ success: true });

    expect(statusSpy).toHaveBeenCalledWith(902, "확인");
    expect(readSpy).toHaveBeenCalledWith(902);
    expect(logSpy.mock.calls.map(call => call[0].action)).toEqual(
      expect.arrayContaining([
        "NOTIFICATION_STATUS_CHANGED",
        "NOTIFICATION_READ",
      ])
    );
  });

  it("updates consultation status through existing customer update with status history", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    const statusHistorySpy = vi
      .spyOn(db, "createStatusHistory")
      .mockResolvedValue(undefined);
    const updateSpy = vi
      .spyOn(db, "updateCustomer")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customers.update({ id: 100, consultStatus: "통화완료" })
    ).resolves.toEqual({ success: true });

    expect(statusHistorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 100,
        previousStatus: "미상담",
        newStatus: "통화완료",
      })
    );
    expect(updateSpy).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ consultStatus: "통화완료" })
    );
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        action: "CUSTOMER_UPDATED",
        targetType: "customer",
        targetId: 100,
      })
    );
    expect(logSpy.mock.calls[0]?.[0].details).not.toContain("010");
  });

  it("blocks inactive and resigned users from mobile quick-action mutations", async () => {
    for (const accountStatus of ["inactive", "resigned"] as const) {
      const caller = appRouter.createCaller(
        createCtx("member", { userId: 4, accountStatus })
      );

      await expect(caller.followUps.complete({ id: 900 })).rejects.toThrow();
      await expect(
        caller.followUps.postpone({
          id: 900,
          nextContactDate: "2026-05-20T10:00:00.000Z",
        })
      ).rejects.toThrow();
      await expect(caller.followUps.cancel({ id: 900 })).rejects.toThrow();
      await expect(
        caller.schedules.update({ id: 901, status: "완료" })
      ).rejects.toThrow();
      await expect(
        caller.notifications.markRead({ id: 902 })
      ).rejects.toThrow();
      await expect(
        caller.notifications.updateProcessStatus({
          id: 902,
          processStatus: "확인",
        })
      ).rejects.toThrow();
      await expect(
        caller.customers.update({ id: 100, consultStatus: "통화완료" })
      ).rejects.toThrow();
    }
  });
});

describe("delete request and deleted data lifecycle", () => {
  const activeContract = {
    id: 10,
    customerId: 100,
    agentId: 4,
    company: "[TEST] insurer",
    productName: "[TEST] product",
    productGroup: "[TEST] group",
    contractDate: new Date("2026-01-01") as any,
    monthlyPremium: 10000,
    paymentStatus: "정상",
    contractStatus: "유지",
    memo: null,
    isActive: true,
    deletedAt: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const activeCustomer = {
    id: 100,
    name: "[TEST] Customer",
    phone: "01000000000",
    birthDate: null,
    gender: null,
    region: null,
    expectedPremium: null,
    availableTime: null,
    source: null,
    agentId: 4,
    assignedTeamId: 10,
    assignedAt: null,
    subBranchAdminId: 2,
    assignmentStatus: "assigned_to_agent",
    consultStatus: "미상담",
    memo: null,
    privacyConsent: false,
    marketingConsent: false,
    isActive: true,
    deletedAt: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  it("allows member to request deleting own active contract and blocks duplicate pending request", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getPendingDeleteRequestForTarget").mockResolvedValue(
      undefined
    );
    const createSpy = vi
      .spyOn(db, "createDeleteRequest")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).resolves.toEqual({ success: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: "contract_delete",
        targetType: "contract",
        targetId: 10,
        requestedBy: 4,
        status: "pending",
        expectedImpact: "performance_exclusion",
      })
    );
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "DELETE_REQUEST_CREATED" })
    );

    vi.restoreAllMocks();
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "getPendingDeleteRequestForTarget").mockResolvedValue({
      id: 1,
      status: "pending",
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).rejects.toThrow();
  });

  it("blocks delete requests outside contract access scope and from branch_admin", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      agentId: 99,
    });

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deleteRequests.createContractDeleteRequest({
          contractId: 10,
          requestReason: "오입력",
        })
    ).rejects.toThrow();
  });

  it("approves pending request transactionally and soft deletes the contract", async () => {
    const request = {
      id: 7,
      requestType: "contract_delete",
      targetType: "contract",
      targetId: 10,
      customerId: 100,
      requestedBy: 4,
      requestReason: "오입력",
      requestMemo: null,
      expectedImpact: "performance_exclusion",
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    const tx = { tx: true } as any;
    vi.spyOn(db, "getDeleteRequestById").mockResolvedValue(request);
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const deactivateSpy = vi
      .spyOn(db, "deactivateContractWithClient")
      .mockResolvedValue(undefined);
    const updateRequestSpy = vi
      .spyOn(db, "updateDeleteRequest")
      .mockResolvedValue(undefined);
    const historySpy = vi
      .spyOn(db, "createContractHistoryEntry")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deleteRequests.approve({ id: 7 })
    ).resolves.toEqual({ success: true });

    expect(deactivateSpy).toHaveBeenCalledWith(10, tx);
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 10,
        fieldName: "isActive",
        afterValue: "false",
      }),
      tx
    );
    expect(updateRequestSpy).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ status: "approved", reviewedBy: 1 }),
      tx
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_REQUEST_APPROVED" }),
      tx
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CONTRACT_DEACTIVATED_BY_REQUEST" }),
      tx
    );
  });

  it("rejects pending request without touching contract data", async () => {
    vi.spyOn(db, "getDeleteRequestById").mockResolvedValue({
      id: 7,
      status: "pending",
      targetId: 10,
    } as any);
    const updateRequestSpy = vi
      .spyOn(db, "updateDeleteRequest")
      .mockResolvedValue(undefined);
    const deactivateSpy = vi
      .spyOn(db, "deactivateContractWithClient")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deleteRequests.reject({ id: 7, reviewComment: "자료 확인 필요" })
    ).resolves.toEqual({ success: true });

    expect(updateRequestSpy).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ status: "rejected", reviewedBy: 1 })
    );
    expect(deactivateSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "DELETE_REQUEST_REJECTED" })
    );
  });

  it("allows branch_admin to restore soft deleted contract and blocks non-admin restore routes", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue({
      ...activeContract,
      isActive: false,
      deletedAt: new Date(),
    });
    vi.spyOn(db, "getCustomerById").mockResolvedValue(activeCustomer);
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback({} as any)
    );
    const restoreSpy = vi
      .spyOn(db, "restoreContract")
      .mockResolvedValue(undefined);
    vi.spyOn(db, "createContractHistoryEntry").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.restoreContract({ id: 10 })
    ).resolves.toEqual({ success: true });
    expect(restoreSpy).toHaveBeenCalled();

    await expect(
      appRouter
        .createCaller(createCtx("member"))
        .deletedData.restoreContract({ id: 10 })
    ).rejects.toThrow();
  });

  it("blocks permanent delete for active data and requires confirmation text", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue(activeContract);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteContract({
          id: 10,
          confirmText: "완전삭제",
          reason: "[TEST] reason",
        })
    ).rejects.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(db, "getContractById").mockResolvedValue({
      ...activeContract,
      isActive: false,
      deletedAt: new Date(),
    });
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteContract({
          id: 10,
          confirmText: "삭제",
          reason: "[TEST] reason",
        })
    ).rejects.toThrow();
  });

  it("requires a reason for customer and contract permanent delete", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteCustomer({
          id: 100,
          confirmText: "\uC644\uC804\uC0AD\uC81C",
          reason: "",
        })
    ).rejects.toThrow();

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteContract({
          id: 10,
          confirmText: "\uC644\uC804\uC0AD\uC81C",
        } as any)
    ).rejects.toThrow();
  });

  it("logs sanitized reason and linked summary when branch_admin permanently deletes eligible customer and contract", async () => {
    const tx = { tx: true } as any;
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      isActive: false,
      deletedAt: new Date(),
    });
    vi.spyOn(db, "getCustomerPermanentDeleteBlockers").mockResolvedValue({
      contracts: 0,
      consultations: 0,
      statusHistory: 0,
      consentLogs: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      notifications: 0,
      reminders: 0,
    });
    vi.spyOn(db, "permanentlyDeleteCustomer").mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteCustomer({
          id: 100,
          confirmText: "\uC644\uC804\uC0AD\uC81C",
          reason: "[TEST] stale duplicate 010-1111-2222 token=abc",
        })
    ).resolves.toEqual({ success: true });

    const customerLog = logSpy.mock.calls[0]?.[0] as any;
    expect(customerLog).toEqual(
      expect.objectContaining({ action: "CUSTOMER_PERMANENTLY_DELETED" })
    );
    expect(customerLog.details).toContain("[redacted-phone]");
    expect(customerLog.details).toContain("[redacted-secret]");
    expect(customerLog.details).not.toContain("010-1111-2222");
    expect(customerLog.details).not.toContain("token=abc");

    vi.restoreAllMocks();
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    vi.spyOn(db, "getContractById").mockResolvedValue({
      ...activeContract,
      isActive: false,
      deletedAt: new Date(),
    });
    vi.spyOn(db, "getContractPermanentDeleteBlockers").mockResolvedValue({
      contractHistory: 0,
      deleteRequests: 0,
      notifications: 0,
      reminders: 0,
    });
    vi.spyOn(db, "permanentlyDeleteContract").mockResolvedValue(undefined);
    const contractLogSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteContract({
          id: 10,
          confirmText: "\uC644\uC804\uC0AD\uC81C",
          reason: "[TEST] no linked records",
        })
    ).resolves.toEqual({ success: true });

    const contractLog = contractLogSpy.mock.calls[0]?.[0] as any;
    expect(contractLog).toEqual(
      expect.objectContaining({ action: "CONTRACT_PERMANENTLY_DELETED" })
    );
    expect(contractLog.details).toContain("linkedSummary");
    expect(contractLog.details).not.toContain("[TEST] product");
  });

  it("blocks customer permanent delete when operational history exists", async () => {
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      ...activeCustomer,
      isActive: false,
      deletedAt: new Date(),
    });
    vi.spyOn(db, "getCustomerPermanentDeleteBlockers").mockResolvedValue({
      contracts: 0,
      consultations: 1,
      statusHistory: 0,
      consentLogs: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      notifications: 0,
      reminders: 0,
    });
    const permanentSpy = vi
      .spyOn(db, "permanentlyDeleteCustomer")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteCustomer({
          id: 100,
          confirmText: "\uC644\uC804\uC0AD\uC81C",
          reason: "[TEST] reason",
        })
    ).rejects.toThrow();

    expect(permanentSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "PERMANENT_DELETE_BLOCKED" })
    );
  });

  it("blocks contract permanent delete when notification or reminder history exists", async () => {
    vi.spyOn(db, "getContractById").mockResolvedValue({
      ...activeContract,
      isActive: false,
      deletedAt: new Date(),
    });
    vi.spyOn(db, "getContractPermanentDeleteBlockers").mockResolvedValue({
      contractHistory: 0,
      deleteRequests: 0,
      notifications: 1,
      reminders: 0,
    });
    const permanentSpy = vi
      .spyOn(db, "permanentlyDeleteContract")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteContract({
          id: 10,
          confirmText: "\uC644\uC804\uC0AD\uC81C",
          reason: "[TEST] reason",
        })
    ).rejects.toThrow();

    expect(permanentSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "PERMANENT_DELETE_BLOCKED" })
    );
  });

  it("blocks team permanent delete when schedules or assignment history exists", async () => {
    vi.spyOn(db, "getTeamById").mockResolvedValue({
      id: 10,
      name: "[TEST] Team",
      isActive: false,
      deletedAt: new Date(),
    } as any);
    vi.spyOn(db, "getTeamPermanentDeleteBlockers").mockResolvedValue({
      users: 0,
      customers: 0,
      schedules: 1,
      assignmentHistory: 0,
    });
    const permanentSpy = vi
      .spyOn(db, "permanentlyDeleteTeam")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .deletedData.permanentDeleteTeam({
          id: 10,
          confirmText: "\uC644\uC804\uC0AD\uC81C",
        })
    ).rejects.toThrow();

    expect(permanentSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "PERMANENT_DELETE_BLOCKED" })
    );
  });

  it("blocks non-admin direct restore and permanent delete API calls", async () => {
    const memberCaller = appRouter.createCaller(createCtx("member"));
    const teamLeaderCaller = appRouter.createCaller(createCtx("team_leader"));
    const subBranchCaller = appRouter.createCaller(
      createCtx("sub_branch_admin")
    );
    const inactiveCaller = appRouter.createCaller(
      createInactiveCtx("branch_admin")
    );

    await expect(
      memberCaller.deletedData.permanentDeleteContract({
        id: 10,
        confirmText: "\uC644\uC804\uC0AD\uC81C",
        reason: "[TEST] reason",
      })
    ).rejects.toThrow();
    await expect(
      teamLeaderCaller.deletedData.restoreCustomer({ id: 100 })
    ).rejects.toThrow();
    await expect(
      subBranchCaller.deletedData.permanentDeleteTeam({
        id: 10,
        confirmText: "\uC644\uC804\uC0AD\uC81C",
      })
    ).rejects.toThrow();
    await expect(
      inactiveCaller.deletedData.restoreContract({ id: 10 })
    ).rejects.toThrow();
  });

  it("allows only branch_admin to view import batches", async () => {
    await expect(
      appRouter.createCaller(createCtx("member")).imports.listBatches({})
    ).rejects.toThrow();
    vi.spyOn(db, "listImportBatches").mockResolvedValue([]);
    await expect(
      appRouter.createCaller(createCtx("branch_admin")).imports.listBatches({})
    ).resolves.toEqual([]);
  });

  it("cancels an import batch transactionally when no operational history exists", async () => {
    const batch = {
      id: 3,
      importBatchId: "batch_test",
      status: "active",
      uploadedBy: 1,
      createdAt: new Date(),
    } as any;
    vi.spyOn(db, "getImportBatchByBatchId").mockResolvedValue(batch);
    vi.spyOn(db, "getCustomersByImportBatch").mockResolvedValue([
      {
        ...activeCustomer,
        importBatchId: "batch_test",
        isActive: true,
        deletedAt: null,
      },
    ] as any);
    vi.spyOn(db, "getImportBatchCancelBlockers").mockResolvedValue({
      activeContracts: 0,
      consultations: 0,
      statusHistory: 0,
      notifications: 0,
      reminders: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      consentLogs: 0,
      blockedCustomerIds: [],
    });
    const tx = { tx: true } as any;
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) =>
      callback(tx)
    );
    const softDeleteSpy = vi
      .spyOn(db, "softDeleteCustomersByImportBatch")
      .mockResolvedValue(undefined);
    const updateBatchSpy = vi
      .spyOn(db, "updateImportBatch")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter.createCaller(createCtx("branch_admin")).imports.cancelBatch({
        importBatchId: "batch_test",
        confirmText: "BATCH취소",
      })
    ).resolves.toEqual({ success: true, affectedCustomerCount: 1 });

    expect(softDeleteSpy).toHaveBeenCalledWith("batch_test", tx);
    expect(updateBatchSpy).toHaveBeenCalledWith(
      "batch_test",
      expect.objectContaining({ status: "cancelled", cancelledBy: 1 }),
      tx
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "IMPORT_BATCH_CANCELLED" }),
      tx
    );
  });

  it("blocks import batch cancellation when linked operational history exists", async () => {
    vi.spyOn(db, "getImportBatchByBatchId").mockResolvedValue({
      id: 3,
      importBatchId: "batch_test",
      status: "active",
      uploadedBy: 1,
    } as any);
    vi.spyOn(db, "getCustomersByImportBatch").mockResolvedValue([
      {
        ...activeCustomer,
        importBatchId: "batch_test",
        isActive: true,
        deletedAt: null,
      },
    ] as any);
    vi.spyOn(db, "getImportBatchCancelBlockers").mockResolvedValue({
      activeContracts: 1,
      consultations: 0,
      statusHistory: 0,
      notifications: 0,
      reminders: 0,
      assignmentHistory: 0,
      deleteRequests: 0,
      consentLogs: 0,
      blockedCustomerIds: [100],
    });
    const softDeleteSpy = vi
      .spyOn(db, "softDeleteCustomersByImportBatch")
      .mockResolvedValue(undefined);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await expect(
      appRouter.createCaller(createCtx("branch_admin")).imports.cancelBatch({
        importBatchId: "batch_test",
        confirmText: "BATCH취소",
      })
    ).rejects.toThrow();

    expect(softDeleteSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ action: "IMPORT_BATCH_CANCEL_BLOCKED" })
    );
  });
});

describe("managementReports", () => {
  const users = [
    {
      id: 1,
      name: "[TEST] Branch",
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: null,
    },
    {
      id: 2,
      name: "[TEST] Sub",
      role: "sub_branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: 1,
    },
    {
      id: 3,
      name: "[TEST] Leader",
      role: "team_leader",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 2,
    },
    {
      id: 4,
      name: "[TEST] Member",
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 3,
    },
    {
      id: 5,
      name: "[TEST] Other",
      role: "member",
      accountStatus: "active",
      teamId: 20,
      subBranchAdminId: 99,
      parentUserId: 30,
    },
  ] as any[];
  const teams = [
    {
      id: 10,
      name: "[TEST] Team",
      managerId: 3,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    },
    {
      id: 20,
      name: "[TEST] Other Team",
      managerId: 30,
      subBranchAdminId: 99,
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const customers = [
    {
      id: 100,
      name: "[TEST] Customer A",
      phone: "010-0000-0000",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      priority: "A",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-05-10"),
      assignedAt: new Date("2026-05-10"),
    },
    {
      id: 101,
      name: "[TEST] Customer B",
      phone: "010-1111-2222",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "미상담",
      priority: "B",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-05-11"),
      assignedAt: new Date("2026-05-11"),
    },
    {
      id: 200,
      name: "[TEST] Other Customer",
      phone: "010-9999-8888",
      agentId: 5,
      assignedTeamId: 20,
      subBranchAdminId: 99,
      consultStatus: "계약",
      priority: "A",
      isActive: true,
      deletedAt: null,
      createdAt: new Date("2026-05-12"),
      assignedAt: new Date("2026-05-12"),
    },
  ] as any[];
  const contracts = [
    {
      id: 11,
      customerId: 100,
      agentId: 4,
      contractDate: new Date("2026-05-10"),
      monthlyPremium: 100000,
      contractStatus: "유지",
      paymentStatus: "정상",
      isActive: true,
      deletedAt: null,
    },
    {
      id: 12,
      customerId: 200,
      agentId: 5,
      contractDate: new Date("2026-05-11"),
      monthlyPremium: 200000,
      contractStatus: "유지",
      paymentStatus: "정상",
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const followUps = [
    {
      id: 21,
      customerId: 100,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "completed",
      nextContactDate: new Date("2026-05-10"),
      completedAt: new Date("2026-05-10"),
      createdAt: new Date("2026-05-09"),
      deletedAt: null,
    },
    {
      id: 22,
      customerId: 101,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "scheduled",
      nextContactDate: new Date("2026-04-01"),
      createdAt: new Date("2026-04-01"),
      deletedAt: null,
    },
    {
      id: 23,
      customerId: 200,
      assignedAgentId: 5,
      teamId: 20,
      subBranchAdminId: 99,
      status: "completed",
      nextContactDate: new Date("2026-05-11"),
      completedAt: new Date("2026-05-11"),
      createdAt: new Date("2026-05-10"),
      deletedAt: null,
    },
  ] as any[];
  const schedules = [
    {
      id: 31,
      userId: 4,
      teamId: 10,
      status: "예정",
      startTime: new Date("2026-05-18"),
      isActive: true,
      deletedAt: null,
    },
    {
      id: 32,
      userId: 5,
      teamId: 20,
      status: "예정",
      startTime: new Date("2026-05-18"),
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const consultations = [
    { id: 41, customerId: 100, createdAt: new Date("2026-05-10") },
    { id: 42, customerId: 101, createdAt: new Date("2026-05-11") },
  ] as any[];

  function mockManagementReportData() {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(users);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getUsersByTeamId").mockImplementation(
      async (teamId: number) => {
        if (teamId === 10) return [{ id: 3 }, { id: 4 }] as any;
        if (teamId === 20) return [{ id: 5 }] as any;
        return [];
      }
    );
    vi.spyOn(db, "getCustomers").mockResolvedValue(customers);
    vi.spyOn(db, "getAllContracts").mockResolvedValue(contracts);
    vi.spyOn(db, "getSchedules").mockResolvedValue(schedules);
    vi.spyOn(db, "getFollowUps").mockResolvedValue(followUps);
    vi.spyOn(db, "getNotificationsFiltered").mockResolvedValue({
      items: [
        {
          id: 1,
          userId: 4,
          isRead: false,
          processStatus: "미확인",
          createdAt: new Date("2026-05-10"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 500,
    } as any);
    vi.spyOn(db, "getConsultationsByCustomer").mockImplementation(
      async (customerId: number) =>
        consultations.filter(item => item.customerId === customerId)
    );
    vi.spyOn(db, "getPerformanceGoalDashboard").mockResolvedValue({
      items: [
        { achievementRate: 75, goal: { targetType: "team", targetId: 10 } },
      ],
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
  }

  it("allows branch_admin to generate a weekly report for all scope", async () => {
    mockManagementReportData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .managementReports.generate({
        reportType: "weekly",
        periodType: "custom",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
      });
    expect(result.empty).toBe(false);
    expect(result.users.some(user => user.userId === 4)).toBe(true);
    expect(result.users.some(user => user.userId === 5)).toBe(true);
    expect(result.summary.consultationCount).toBeGreaterThan(0);
    expect(result.summary.followUpCompletionRate).not.toBeNull();
  });

  it("scopes sub_branch_admin reports to managed users only", async () => {
    mockManagementReportData();
    const result = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .managementReports.generate({ reportType: "weekly", periodType: "week" });
    expect(result.users.some(user => user.userId === 4)).toBe(true);
    expect(result.users.some(user => user.userId === 5)).toBe(false);
  });

  it("scopes team_leader reports to own team only", async () => {
    mockManagementReportData();
    const result = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .managementReports.generate({
        reportType: "team",
        periodType: "week",
        targetTeamId: 10,
      });
    expect(result.users.some(user => user.userId === 4)).toBe(true);
    expect(result.users.some(user => user.userId === 5)).toBe(false);
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .managementReports.generate({
          reportType: "team",
          periodType: "week",
          targetTeamId: 20,
        })
    ).rejects.toThrow();
  });

  it("blocks member access", async () => {
    mockManagementReportData();
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .managementReports.generate({
          reportType: "weekly",
          periodType: "week",
        })
    ).rejects.toThrow(/FORBIDDEN|관리자/);
  });

  it("blocks inactive and resigned users", async () => {
    mockManagementReportData();
    await expect(
      appRouter.createCaller(createInactiveCtx()).managementReports.generate({
        reportType: "weekly",
        periodType: "week",
      })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { accountStatus: "resigned" }))
        .managementReports.generate({
          reportType: "weekly",
          periodType: "week",
        })
    ).rejects.toThrow();
  });

  it("calculates overdue follow-up and incomplete schedule counts", async () => {
    mockManagementReportData();
    const result = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .managementReports.generate({ reportType: "daily", periodType: "today" });
    const member = result.users.find(user => user.userId === 4);
    expect(member?.metrics.overdueFollowUpCount).toBeGreaterThan(0);
    expect(member?.metrics.unconsultedDbCount).toBe(1);
    expect(result.summary.overdueFollowUpCount).toBeGreaterThan(0);
  });

  it("keeps customer-sensitive data out of copyable and narrative summaries", async () => {
    mockManagementReportData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .managementReports.generate({ reportType: "weekly", periodType: "week" });
    expect(result.copyableSummary).not.toContain("010-");
    expect(result.copyableSummary).not.toContain("[TEST] Customer");
    expect(result.narrativeSummary).not.toContain("010-");
    expect(result.narrativeSummary).not.toContain("100000");
    expect(result.copyableSummary).toContain("후속관리 지연");
  });

  it("logs report generation metadata without full report body", async () => {
    mockManagementReportData();
    const logSpy = vi.spyOn(db, "createActivityLog");
    await appRouter
      .createCaller(createCtx("branch_admin"))
      .managementReports.generate({
        reportType: "monthly",
        periodType: "month",
      });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MANAGEMENT_REPORT_GENERATED",
        targetType: "management_report",
      })
    );
    const details = JSON.parse(
      String(logSpy.mock.calls.at(-1)?.[0]?.details ?? "{}")
    );
    expect(details.reportType).toBe("monthly");
    expect(details).not.toHaveProperty("copyableSummary");
    expect(details).not.toHaveProperty("narrativeSummary");
  });
});

describe("customerDataQuality", () => {
  const users = [
    {
      id: 1,
      name: "[TEST] Branch",
      role: "branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: null,
    },
    {
      id: 2,
      name: "[TEST] Sub",
      role: "sub_branch_admin",
      accountStatus: "active",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: 1,
    },
    {
      id: 3,
      name: "[TEST] Leader",
      role: "team_leader",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 2,
    },
    {
      id: 4,
      name: "[TEST] Member",
      role: "member",
      accountStatus: "active",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 3,
    },
    {
      id: 5,
      name: "[TEST] Other",
      role: "member",
      accountStatus: "active",
      teamId: 20,
      subBranchAdminId: 99,
      parentUserId: 30,
    },
    {
      id: 99,
      name: "[TEST] Inactive Agent",
      role: "member",
      accountStatus: "inactive",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 3,
    },
  ] as any[];
  const teams = [
    {
      id: 10,
      name: "[TEST] Team",
      managerId: 3,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    },
    {
      id: 20,
      name: "[TEST] Other Team",
      managerId: 30,
      subBranchAdminId: 99,
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const customers = [
    {
      id: 100,
      name: "[TEST] Good Customer",
      phone: "010-1000-0001",
      birthDate: "1990-01-01",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      customerTags: JSON.stringify(["vip"]),
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 101,
      name: "[TEST] Missing Phone",
      phone: null,
      birthDate: null,
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "미상담",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 102,
      name: "[TEST] Unassigned",
      phone: "010-1000-0003",
      birthDate: "1990-01-03",
      agentId: null,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "미상담",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 103,
      name: "[TEST] No Follow Up",
      phone: "010-1000-0004",
      birthDate: "1990-01-04",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 104,
      name: "[TEST] Duplicate",
      phone: "010-1000-0001",
      birthDate: "1990-01-01",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 105,
      name: "[TEST] Many Tags",
      phone: "010-1000-0005",
      birthDate: "1990-01-05",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      customerTags: JSON.stringify(["1", "2", "3", "4", "5", "6", "7", "8"]),
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 106,
      name: "[TEST] Contract Only",
      phone: "010-1000-0006",
      birthDate: "1990-01-06",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "계약",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 107,
      name: "[TEST] Long Unmanaged",
      phone: "010-1000-0007",
      birthDate: "1990-01-07",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2025-01-01"),
      createdAt: new Date("2025-01-01"),
    },
    {
      id: 108,
      name: "[TEST] Inactive Agent",
      phone: "010-1000-0008",
      birthDate: "1990-01-08",
      agentId: 99,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      consultStatus: "통화완료",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
    {
      id: 200,
      name: "[TEST] Other Team",
      phone: "010-9999-0001",
      birthDate: "1990-02-01",
      agentId: 5,
      assignedTeamId: 20,
      subBranchAdminId: 99,
      consultStatus: "통화완료",
      customerTags: null,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date("2026-05-20"),
      createdAt: new Date("2026-05-01"),
    },
  ] as any[];
  const contracts = [
    {
      id: 11,
      customerId: 100,
      agentId: 4,
      contractDate: new Date("2026-05-10"),
      monthlyPremium: 100000,
      contractStatus: "유지",
      paymentStatus: "정상",
      isActive: true,
      deletedAt: null,
    },
    {
      id: 12,
      customerId: 106,
      agentId: 4,
      contractDate: new Date("2026-05-10"),
      monthlyPremium: 100000,
      contractStatus: "유지",
      paymentStatus: "정상",
      isActive: true,
      deletedAt: null,
    },
    {
      id: 13,
      customerId: 200,
      agentId: 5,
      contractDate: new Date("2026-05-10"),
      monthlyPremium: 100000,
      contractStatus: "유지",
      paymentStatus: "정상",
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const followUps = [
    {
      id: 21,
      customerId: 100,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "completed",
      nextContactDate: new Date("2026-05-10"),
      completedAt: new Date("2026-05-10"),
      createdAt: new Date("2026-05-09"),
      deletedAt: null,
    },
    {
      id: 22,
      customerId: 101,
      assignedAgentId: 4,
      teamId: 10,
      subBranchAdminId: 2,
      status: "scheduled",
      nextContactDate: new Date("2026-04-01"),
      createdAt: new Date("2026-04-01"),
      deletedAt: null,
    },
    {
      id: 23,
      customerId: 200,
      assignedAgentId: 5,
      teamId: 20,
      subBranchAdminId: 99,
      status: "completed",
      nextContactDate: new Date("2026-05-11"),
      completedAt: new Date("2026-05-11"),
      createdAt: new Date("2026-05-10"),
      deletedAt: null,
    },
  ] as any[];
  const schedules = [
    {
      id: 31,
      userId: 4,
      customerId: 101,
      teamId: 10,
      status: "예정",
      startTime: new Date("2026-04-01"),
      isActive: true,
      deletedAt: null,
    },
    {
      id: 32,
      userId: 5,
      customerId: 200,
      teamId: 20,
      status: "예정",
      startTime: new Date("2026-05-18"),
      isActive: true,
      deletedAt: null,
    },
  ] as any[];
  const consultationDates = [
    { customerId: 100, latestCreatedAt: new Date("2026-05-10") },
    { customerId: 103, latestCreatedAt: new Date("2026-05-10") },
    { customerId: 104, latestCreatedAt: new Date("2026-05-10") },
    { customerId: 105, latestCreatedAt: new Date("2026-05-10") },
    { customerId: 107, latestCreatedAt: new Date("2025-01-01") },
    { customerId: 108, latestCreatedAt: new Date("2026-05-10") },
    { customerId: 200, latestCreatedAt: new Date("2026-05-10") },
  ] as any[];

  function mockCustomerDataQualityData() {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(users);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getUsersByTeamId").mockImplementation(
      async (teamId: number) => {
        if (teamId === 10) return [{ id: 3 }, { id: 4 }, { id: 99 }] as any;
        if (teamId === 20) return [{ id: 5 }] as any;
        return [];
      }
    );
    vi.spyOn(db, "getCustomers").mockImplementation(
      async (filter: any = {}) => {
        if (filter.agentId)
          return customers.filter(item => item.agentId === filter.agentId);
        if (filter.agentIds)
          return customers.filter(
            item => item.agentId && filter.agentIds.includes(item.agentId)
          );
        return customers;
      }
    );
    vi.spyOn(db, "getAllContracts").mockImplementation(
      async (filter: any = {}) => {
        if (filter.agentIds)
          return contracts.filter(item =>
            filter.agentIds.includes(item.agentId)
          );
        if (filter.agentId)
          return contracts.filter(item => item.agentId === filter.agentId);
        return contracts;
      }
    );
    vi.spyOn(db, "getSchedules").mockImplementation(
      async (filter: any = {}) => {
        if (filter.userId)
          return schedules.filter(item => item.userId === filter.userId);
        if (filter.userIds)
          return schedules.filter(item => filter.userIds.includes(item.userId));
        return schedules;
      }
    );
    vi.spyOn(db, "getFollowUps").mockImplementation(
      async (filter: any = {}) => {
        if (filter.agentId)
          return followUps.filter(
            item => item.assignedAgentId === filter.agentId
          );
        if (filter.agentIds)
          return followUps.filter(item =>
            filter.agentIds.includes(item.assignedAgentId)
          );
        return followUps;
      }
    );
    vi.spyOn(db, "getLatestConsultationDatesByCustomerIds").mockImplementation(
      async (customerIds: number[]) =>
        consultationDates.filter(item => customerIds.includes(item.customerId))
    );
  }

  it("allows branch_admin to view full-scope quality summary", async () => {
    mockCustomerDataQualityData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerDataQuality.dashboard({});
    expect(result.summary.customerCount).toBeGreaterThan(8);
    expect(result.customers.some(item => item.customerId === 200)).toBe(true);
    expect(result.assignees.length).toBeGreaterThan(0);
  });

  it("scopes sub_branch_admin to managed customers only", async () => {
    mockCustomerDataQualityData();
    const result = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .customerDataQuality.dashboard({});
    expect(result.customers.some(item => item.customerId === 200)).toBe(false);
    expect(result.customers.some(item => item.customerId === 101)).toBe(true);
  });

  it("scopes team_leader to own team customers only", async () => {
    mockCustomerDataQualityData();
    const result = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .customerDataQuality.dashboard({});
    expect(result.customers.some(item => item.customerId === 200)).toBe(false);
    expect(result.customers.some(item => item.customerId === 101)).toBe(true);
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .customerDataQuality.dashboard({ teamId: 20 })
    ).rejects.toThrow();
  });

  it("allows member to view only own assigned customer issues", async () => {
    mockCustomerDataQualityData();
    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .customerDataQuality.dashboard({});
    expect(result.customers.every(item => item.assignedUserId === 4)).toBe(
      true
    );
    expect(result.customers.some(item => item.customerId === 200)).toBe(false);
    expect(result.assignees).toEqual([]);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .customerDataQuality.dashboard({ assignedUserId: 5 })
    ).rejects.toThrow();
  });

  it("blocks inactive and resigned users", async () => {
    mockCustomerDataQualityData();
    await expect(
      appRouter
        .createCaller(createInactiveCtx())
        .customerDataQuality.dashboard({})
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "resigned" }))
        .customerDataQuality.dashboard({})
    ).rejects.toThrow();
  });

  it("calculates issue counts and quality levels accurately", async () => {
    mockCustomerDataQualityData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerDataQuality.dashboard({});
    expect(result.summary.missingPhoneCount).toBeGreaterThan(0);
    expect(result.summary.unassignedCustomerCount).toBeGreaterThan(0);
    expect(result.summary.noFollowUpCount).toBeGreaterThan(0);
    expect(result.summary.duplicateCandidateCount).toBeGreaterThan(0);
    expect(result.summary.excessiveTagCount).toBeGreaterThan(0);
    expect(result.summary.contractWithoutConsultationCount).toBeGreaterThan(0);
    expect(result.summary.longUnmanagedCount).toBeGreaterThan(0);
    expect(result.summary.delayedFollowUpOrScheduleCount).toBeGreaterThan(0);

    const missingPhone = result.customers.find(item => item.customerId === 101);
    expect(missingPhone?.issueTypes).toEqual(
      expect.arrayContaining([
        "missing_phone",
        "missing_birth_date",
        "missing_status",
      ])
    );
    expect(missingPhone?.qualityLevel).toBe("critical");

    const duplicate = result.customers.find(item => item.customerId === 104);
    expect(duplicate?.issueTypes).toContain("duplicate_candidate");
  });

  it("keeps sensitive customer fields out of default dashboard rows", async () => {
    mockCustomerDataQualityData();
    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .customerDataQuality.dashboard({});
    const serialized = JSON.stringify(result.customers);
    expect(serialized).not.toContain("010-");
    expect(serialized).not.toContain("1990-01-01");
    expect(serialized).not.toContain("100000");
    expect(
      result.customers.every(
        item =>
          item.customerDisplayName.includes("*") ||
          item.customerDisplayName.length <= 2
      )
    ).toBe(true);
  });
});
