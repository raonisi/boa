import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import * as db from "./db";
import * as notifications from "./notifications";
import {
  formatKstLocalDateTime,
  parseKstLocalDateTime,
} from "@shared/timePolicy";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
type AccountStatus = "active" | "inactive" | "resigned";

function createCtx(
  role: Role,
  opts?: {
    teamId?: number | null;
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Schedules - router access guards", () => {
  it("blocks inactive from schedules.list", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { accountStatus: "inactive" }))
        .schedules.list()
    ).rejects.toThrow();
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
