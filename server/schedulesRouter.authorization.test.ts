import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import * as db from "./db";
import * as notifications from "./notifications";

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Schedules - router mutation authorization", () => {
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

});
