import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { buildScheduleChangeRequestSnapshot } from "./scheduleChangeRequests";
import * as dbModule from "./db";
import * as googleCalendarHooks from "./googleCalendarHooks";
import * as notificationModule from "./notifications";
import * as pushModule from "./pushNotifications";
import {
  activityLogs,
  customers,
  notifications,
  scheduleChangeRequests,
  schedules,
  teams,
  users,
  type Schedule,
  type ScheduleChangeRequest,
} from "../drizzle/schema";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";

function createCtx(
  role: Role,
  id: number,
  accountStatus: "active" | "inactive" | "resigned" = "active"
): TrpcContext {
  return {
    user: {
      id,
      openId: `[TEST]-${role}-${id}`,
      name: `[TEST] ${role}`,
      email: `${role}-${id}@test.invalid`,
      loginMethod: "manus",
      role,
      accountStatus,
      teamId: role === "team_leader" || role === "member" ? 10 : null,
      subBranchAdminId:
        role === "team_leader" || role === "member" ? 2 : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const orgUsers = [
  {
    id: 1,
    name: "[TEST] 지점장",
    role: "branch_admin",
    accountStatus: "active",
    parentUserId: null,
    teamId: null,
    subBranchAdminId: null,
  },
  {
    id: 2,
    name: "[TEST] 부지점장",
    role: "sub_branch_admin",
    accountStatus: "active",
    parentUserId: null,
    teamId: null,
    subBranchAdminId: null,
  },
  {
    id: 3,
    name: "[TEST] 팀장",
    role: "team_leader",
    accountStatus: "active",
    parentUserId: 2,
    teamId: 10,
    subBranchAdminId: 2,
  },
  {
    id: 5,
    name: "[TEST] 팀원",
    role: "member",
    accountStatus: "active",
    parentUserId: 3,
    teamId: 10,
    subBranchAdminId: 2,
  },
];

const orgTeams = [
  {
    id: 10,
    name: "[TEST] 팀",
    managerId: 3,
    subBranchAdminId: 2,
    isActive: true,
  },
];

function makeQuery<T>(rows: T[]) {
  const query: any = {
    where: () => query,
    orderBy: () => query,
    limit: async (count: number) => rows.slice(0, count),
    then: (resolve: (value: T[]) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return query;
}

function createFakeDb(initial?: {
  requests?: ScheduleChangeRequest[];
  schedules?: Schedule[];
  customers?: any[];
}) {
  const state = {
    requests: [...(initial?.requests ?? [])],
    schedules: [...(initial?.schedules ?? [])],
    customers: [...(initial?.customers ?? [])],
    activityValues: [] as any[],
    notificationValues: [] as any[],
    nextRequestId: 50,
    nextScheduleId: 100,
  };

  const fake: any = {
    select: () => ({
      from: (table: unknown) => {
        if (table === users) return makeQuery(orgUsers);
        if (table === teams) return makeQuery(orgTeams);
        if (table === scheduleChangeRequests) return makeQuery(state.requests);
        if (table === schedules) return makeQuery(state.schedules);
        if (table === customers) return makeQuery(state.customers);
        return makeQuery([]);
      },
    }),
    insert: (table: unknown) => ({
      values: async (value: any) => {
        if (table === scheduleChangeRequests) {
          if (
            value.pendingKey &&
            state.requests.some(
              request =>
                request.pendingKey === value.pendingKey &&
                request.status === "pending"
            )
          ) {
            throw Object.assign(new Error("duplicate pending request"), {
              code: "ER_DUP_ENTRY",
              errno: 1062,
            });
          }
          const now = new Date("2026-07-10T00:00:00.000Z");
          const row = {
            id: state.nextRequestId++,
            reviewedBy: null,
            reviewedAt: null,
            reviewComment: null,
            appliedAt: null,
            cancelledAt: null,
            createdAt: now,
            updatedAt: now,
            ...value,
          } as ScheduleChangeRequest;
          state.requests.push(row);
          return [{ insertId: row.id, affectedRows: 1 }];
        }
        if (table === schedules) {
          const now = new Date("2026-07-10T00:00:00.000Z");
          const row = {
            id: state.nextScheduleId++,
            teamId: null,
            completedAt: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            ...value,
          } as Schedule;
          state.schedules.push(row);
          return [{ insertId: row.id, affectedRows: 1 }];
        }
        if (table === activityLogs) state.activityValues.push(value);
        if (table === notifications) state.notificationValues.push(value);
        return [{ insertId: 1, affectedRows: 1 }];
      },
    }),
    update: (table: unknown) => ({
      set: (value: any) => ({
        where: async () => {
          if (table === schedules) {
            const schedule = state.schedules[0];
            if (!schedule) return [{ affectedRows: 0 }];
            Object.assign(schedule, value);
            return [{ affectedRows: 1 }];
          }
          if (table !== scheduleChangeRequests) {
            return [{ affectedRows: 1 }];
          }
          const request = state.requests[0];
          if (!request) return [{ affectedRows: 0 }];
          if (value.status === "approved" && value.reviewedBy) {
            if (request.status !== "pending") return [{ affectedRows: 0 }];
            Object.assign(request, value);
            return [{ affectedRows: 1 }];
          }
          if (value.status === "cancelled" || value.status === "rejected") {
            if (request.status !== "pending") return [{ affectedRows: 0 }];
            Object.assign(request, value);
            return [{ affectedRows: 1 }];
          }
          if (value.status === "conflict" || value.status === "failed") {
            if (request.status !== "approved" && request.status !== "pending") {
              return [{ affectedRows: 0 }];
            }
            Object.assign(request, value);
            return [{ affectedRows: 1 }];
          }
          Object.assign(request, value);
          return [{ affectedRows: 1 }];
        },
      }),
    }),
    transaction: async (callback: (tx: any) => unknown) => callback(fake),
  };

  return { fake, state };
}

function pendingCreateRequest(): ScheduleChangeRequest {
  const now = new Date("2026-07-10T00:00:00.000Z");
  return {
    id: 51,
    requestType: "create",
    scheduleId: null,
    requesterId: 3,
    targetUserId: 5,
    status: "pending",
    reason: "[TEST] 팀원 일정 요청",
    requestedPayload: {
      title: "[TEST] 후속 일정",
      type: "고객상담",
      status: "예정",
      startTime: "2026-07-11T10:00",
      endTime: "2026-07-11T11:00",
      customerId: null,
      reminderOffsetMinutes: 30,
      calendarCategory: "consultation_followup",
    },
    beforeSnapshot: null,
    baseScheduleUpdatedAt: null,
    pendingKey: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    appliedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  const createdAt = new Date("2026-07-01T00:00:00.000Z");
  return {
    id: 101,
    userId: 5,
    teamId: 10,
    customerId: null,
    title: "[TEST] 기존 일정",
    description: null,
    location: null,
    type: "고객상담",
    status: "예정",
    startTime: new Date("2026-07-11T01:00:00.000Z"),
    endTime: new Date("2026-07-11T02:00:00.000Z"),
    completedAt: null,
    memo: null,
    calendarCategory: "consultation_followup",
    reminderDayBefore: false,
    reminderSameDay: false,
    reminderOneHourBefore: false,
    reminderOffsetMinutes: 30,
    isActive: true,
    deletedAt: null,
    createdBy: 5,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function stubPostCommitSideEffects(state: { schedules: Schedule[] }) {
  vi.spyOn(dbModule, "getScheduleById").mockImplementation(async id =>
    state.schedules.find(item => item.id === id)
  );
  vi.spyOn(dbModule, "getUserById").mockImplementation(async id =>
    orgUsers.find(item => item.id === id) as any
  );
  vi.spyOn(notificationModule, "cancelScheduleTimingNotifications").mockResolvedValue();
  vi.spyOn(notificationModule, "cancelScheduleIncompleteNotification").mockResolvedValue();
  vi.spyOn(notificationModule, "createScheduleReminderByOffset").mockResolvedValue();
  vi.spyOn(notificationModule, "createScheduleIncompleteReminder").mockResolvedValue();
  vi.spyOn(googleCalendarHooks, "triggerGoogleCalendarSyncForScheduleId").mockResolvedValue();
  vi.spyOn(googleCalendarHooks, "triggerGoogleCalendarDeleteForSchedule").mockImplementation(
    () => undefined
  );
  vi.spyOn(pushModule, "sendPushToUsers").mockResolvedValue({ sent: 0, failed: 0 });
}

describe("schedule change request router workflow", () => {
  it("stores a manager create request without creating a schedule", async () => {
    const { fake, state } = createFakeDb();
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    vi.spyOn(pushModule, "sendPushToUsers").mockResolvedValue({ sent: 0, failed: 0 });

    const result = await appRouter
      .createCaller(createCtx("team_leader", 3))
      .scheduleChangeRequests.requestCreate({
        targetUserId: 5,
        reason: "[TEST] 팀원 일정 등록 요청",
        payload: {
          title: "[TEST] 상담 일정",
          type: "고객상담",
          status: "예정",
          startTime: "2026-07-11T10:00",
          endTime: "2026-07-11T11:00",
          customerId: null,
          reminderOffsetMinutes: 30,
          calendarCategory: "consultation_followup",
        },
      });

    expect(result.success).toBe(true);
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]).toMatchObject({
      requesterId: 3,
      targetUserId: 5,
      requestType: "create",
      status: "pending",
    });
    expect(state.schedules).toHaveLength(0);
    expect(JSON.stringify(state.activityValues)).not.toContain(
      "[TEST] 상담 일정"
    );
    expect(JSON.stringify(state.activityValues)).not.toContain(
      "[TEST] 팀원 일정 등록 요청"
    );
    expect(JSON.stringify(state.notificationValues)).not.toContain(
      "[TEST] 상담 일정"
    );
  });

  it("keeps schedule-request push templates free of customer and credential data", () => {
    const serialized = JSON.stringify({
      created: pushModule.SAFE_PUSH_PAYLOADS.scheduleChangeRequestCreated,
      approved: pushModule.SAFE_PUSH_PAYLOADS.scheduleChangeRequestApproved,
      rejected: pushModule.SAFE_PUSH_PAYLOADS.scheduleChangeRequestRejected,
      conflict: pushModule.SAFE_PUSH_PAYLOADS.scheduleChangeRequestConflict,
      failed: pushModule.SAFE_PUSH_PAYLOADS.scheduleChangeRequestFailed,
    });

    expect(serialized).not.toMatch(/010[-\d]/);
    expect(serialized).not.toMatch(/고객명|생년월일|상담내용|token|secret/i);
  });

  it("blocks inactive users and input identity/status manipulation before storage", async () => {
    const { fake, state } = createFakeDb();
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);

    const payload = {
      targetUserId: 5,
      reason: "[TEST] 요청",
      payload: {
        title: "[TEST] 일정",
        type: "기타" as const,
        startTime: "2026-07-11T10:00",
      },
    };
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", 3, "inactive"))
        .scheduleChangeRequests.requestCreate(payload)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", 3))
        .scheduleChangeRequests.requestCreate({
          ...payload,
          requesterId: 1,
          status: "approved",
        } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.requests).toHaveLength(0);
  });

  it("rejects a customer link outside the requester's customer scope", async () => {
    const { fake, state } = createFakeDb({
      customers: [
        {
          id: 700,
          isActive: true,
          deletedAt: null,
          agentId: 80,
          assignedTeamId: 20,
          subBranchAdminId: 8,
        },
      ],
    });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", 3))
        .scheduleChangeRequests.requestCreate({
          targetUserId: 5,
          reason: "[TEST] 범위 밖 고객 연결 요청",
          payload: {
            title: "[TEST] 일정",
            type: "고객상담",
            startTime: "2026-07-11T10:00",
            customerId: 700,
          },
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.requests).toHaveLength(0);
  });

  it("stores only effective update fields and blocks a duplicate pending delete", async () => {
    const current = schedule();
    const { fake, state } = createFakeDb({ schedules: [current] });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    vi.spyOn(pushModule, "sendPushToUsers").mockResolvedValue({ sent: 0, failed: 0 });
    const caller = appRouter.createCaller(createCtx("team_leader", 3));

    await caller.scheduleChangeRequests.requestUpdate({
      scheduleId: current.id,
      reason: "[TEST] 일정 제목 변경",
      payload: {
        title: "[TEST] 변경 요청 제목",
        memo: null,
        reminderOffsetMinutes: 30,
      },
    });

    expect(state.requests[0].requestedPayload).toEqual({
      title: "[TEST] 변경 요청 제목",
    });
    expect(current.title).toBe("[TEST] 기존 일정");

    await expect(
      caller.scheduleChangeRequests.requestDelete({
        scheduleId: current.id,
        reason: "[TEST] 중복 삭제 요청",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.requests).toHaveLength(1);
  });

  it("applies an approved create request once with target ownership and approver audit", async () => {
    const request = pendingCreateRequest();
    const { fake, state } = createFakeDb({ requests: [request] });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    stubPostCommitSideEffects(state);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", 1))
      .scheduleChangeRequests.approve({ id: request.id });

    expect(result).toEqual({ success: true, status: "approved" });
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]).toMatchObject({ userId: 5, createdBy: 1 });
    expect(request).toMatchObject({
      status: "approved",
      scheduleId: state.schedules[0].id,
    });
    expect(
      googleCalendarHooks.triggerGoogleCalendarSyncForScheduleId
    ).toHaveBeenCalledWith(1, state.schedules[0].id, {
      personalCalendarOwnerOnly: true,
    });
  });

  it("allows only one of two concurrent approval attempts to apply", async () => {
    const request = pendingCreateRequest();
    const { fake, state } = createFakeDb({ requests: [request] });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    stubPostCommitSideEffects(state);
    const caller = appRouter.createCaller(createCtx("branch_admin", 1));

    const results = await Promise.allSettled([
      caller.scheduleChangeRequests.approve({ id: request.id }),
      caller.scheduleChangeRequests.approve({ id: request.id }),
    ]);

    expect(results.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(item => item.status === "rejected")).toHaveLength(1);
    expect(state.schedules).toHaveLength(1);
  });

  it("detects an updated source schedule and leaves it unchanged", async () => {
    const baseUpdatedAt = new Date("2026-07-01T00:00:00.000Z");
    const original = schedule({ updatedAt: baseUpdatedAt });
    const current = schedule({
      title: "[TEST] 승인 전 변경된 일정",
      updatedAt: baseUpdatedAt,
    });
    const request = {
      ...pendingCreateRequest(),
      requestType: "update" as const,
      scheduleId: current.id,
      targetUserId: current.userId,
      requestedPayload: { title: "[TEST] 요청 제목" },
      beforeSnapshot: buildScheduleChangeRequestSnapshot(original),
      baseScheduleUpdatedAt: baseUpdatedAt,
      pendingKey: `schedule:${current.id}`,
    };
    const { fake, state } = createFakeDb({
      requests: [request],
      schedules: [current],
    });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    vi.spyOn(pushModule, "sendPushToUsers").mockResolvedValue({ sent: 0, failed: 0 });

    const result = await appRouter
      .createCaller(createCtx("branch_admin", 1))
      .scheduleChangeRequests.approve({ id: request.id });

    expect(result).toEqual({ success: false, status: "conflict" });
    expect(request.status).toBe("conflict");
    expect(current.title).toBe("[TEST] 승인 전 변경된 일정");
  });

  it("applies only requested update fields without transferring ownership", async () => {
    const current = schedule();
    const request = {
      ...pendingCreateRequest(),
      requestType: "update" as const,
      scheduleId: current.id,
      targetUserId: current.userId,
      requestedPayload: {
        title: "[TEST] 승인된 제목",
        reminderOffsetMinutes: 60,
      },
      beforeSnapshot: buildScheduleChangeRequestSnapshot(current),
      baseScheduleUpdatedAt: current.updatedAt,
      pendingKey: `schedule:${current.id}`,
    };
    const { fake, state } = createFakeDb({
      requests: [request],
      schedules: [current],
    });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    stubPostCommitSideEffects(state);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", 1))
      .scheduleChangeRequests.approve({ id: request.id });

    expect(result).toEqual({ success: true, status: "approved" });
    expect(current).toMatchObject({
      userId: 5,
      title: "[TEST] 승인된 제목",
      reminderOffsetMinutes: 60,
      reminderOneHourBefore: true,
    });
    expect(
      googleCalendarHooks.triggerGoogleCalendarSyncForScheduleId
    ).toHaveBeenCalledWith(1, current.id, {
      personalCalendarOwnerOnly: true,
    });
  });

  it("uses the existing soft-delete policy for an approved delete request", async () => {
    const current = schedule();
    const request = {
      ...pendingCreateRequest(),
      requestType: "delete" as const,
      scheduleId: current.id,
      targetUserId: current.userId,
      requestedPayload: {},
      beforeSnapshot: buildScheduleChangeRequestSnapshot(current),
      baseScheduleUpdatedAt: current.updatedAt,
      pendingKey: `schedule:${current.id}`,
    };
    const { fake, state } = createFakeDb({
      requests: [request],
      schedules: [current],
    });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    stubPostCommitSideEffects(state);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", 1))
      .scheduleChangeRequests.approve({ id: request.id });

    expect(result).toEqual({ success: true, status: "approved" });
    expect(current.isActive).toBe(false);
    expect(current.status).toBe("취소");
    expect(current.deletedAt).toBeInstanceOf(Date);
    expect(
      googleCalendarHooks.triggerGoogleCalendarDeleteForSchedule
    ).toHaveBeenCalledWith(1, current, "member");
  });

  it("resolves an approve/cancel race with exactly one terminal transition", async () => {
    const request = pendingCreateRequest();
    const { fake, state } = createFakeDb({ requests: [request] });
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fake);
    stubPostCommitSideEffects(state);
    const approver = appRouter.createCaller(createCtx("branch_admin", 1));
    const requester = appRouter.createCaller(createCtx("team_leader", 3));

    const results = await Promise.allSettled([
      approver.scheduleChangeRequests.approve({ id: request.id }),
      requester.scheduleChangeRequests.cancelMy({ id: request.id }),
    ]);

    expect(results.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(item => item.status === "rejected")).toHaveLength(1);
    expect(["approved", "cancelled"]).toContain(request.status);
    expect(state.schedules.length).toBe(request.status === "approved" ? 1 : 0);
  });
});
