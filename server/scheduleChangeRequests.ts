import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import {
  scheduleChangeRequestReasonSchema,
  scheduleCreateRequestPayloadSchema,
  scheduleUpdateRequestPayloadSchema,
  SCHEDULE_CHANGE_REQUEST_STATUSES,
  SCHEDULE_CHANGE_REQUEST_TYPES,
  type ScheduleChangeRequestStatus,
  type ScheduleCreateRequestPayload,
  type ScheduleUpdateRequestPayload,
} from "@shared/scheduleChangeRequest";
import { parseKstLocalDateTime } from "@shared/timePolicy";
import {
  customers,
  scheduleChangeRequests,
  schedules,
  teams,
  users,
  type Schedule,
  type ScheduleChangeRequest,
} from "../drizzle/schema";
import { activeUserProcedure, branchAdminProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import {
  createActivityLog,
  createNotification,
  getDb,
  getScheduleById,
  getUserById,
} from "./db";
import {
  triggerGoogleCalendarDeleteForSchedule,
  triggerGoogleCalendarSyncForScheduleId,
} from "./googleCalendarHooks";
import {
  cancelScheduleIncompleteNotification,
  cancelScheduleTimingNotifications,
  createScheduleIncompleteReminder,
  createScheduleReminderByOffset,
} from "./notifications";
import {
  assertCanSelectCalendarCategory,
  resolveCalendarCategoryForSave,
} from "./scheduleCalendarCategory";
import { assertScheduleRequestScope } from "./scheduleChangeRequestScope";
import { approveScheduleChangeRequest } from "./scheduleApprovalService";
import type { OrgTeam, OrgUser } from "./organizationHierarchy";
import {
  SAFE_PUSH_PAYLOADS,
  sendPushToUsers,
} from "./pushNotifications";

type DbExecutor = any;
type RequestPayload = ScheduleCreateRequestPayload | ScheduleUpdateRequestPayload;

const createRequestInputSchema = z
  .object({
    targetUserId: z.number().int().positive(),
    reason: scheduleChangeRequestReasonSchema,
    payload: scheduleCreateRequestPayloadSchema,
  })
  .strict();

const updateRequestInputSchema = z
  .object({
    scheduleId: z.number().int().positive(),
    reason: scheduleChangeRequestReasonSchema,
    payload: scheduleUpdateRequestPayloadSchema,
  })
  .strict();

const deleteRequestInputSchema = z
  .object({
    scheduleId: z.number().int().positive(),
    reason: scheduleChangeRequestReasonSchema,
  })
  .strict();

const listFilterSchema = z
  .object({
    requestType: z.enum(SCHEDULE_CHANGE_REQUEST_TYPES).optional(),
    status: z.enum(SCHEDULE_CHANGE_REQUEST_STATUSES).optional(),
    requesterId: z.number().int().positive().optional(),
    targetUserId: z.number().int().positive().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })
  .strict()
  .optional();

function dbUnavailable() {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "일정 요청 저장소에 연결할 수 없습니다.",
  });
}

function affectedRows(result: any) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

function insertedId(result: any) {
  return Number(result?.[0]?.insertId ?? result?.insertId ?? 0);
}

function parseRequestDate(value: string, label: string) {
  const parsed = parseKstLocalDateTime(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label}이 올바르지 않습니다.`,
    });
  }
  return parsed;
}

function parseOptionalEndTime(value?: string | null) {
  if (!value) return null;
  return parseRequestDate(value, "종료 시간");
}

function assertEndAfterStart(startTime: Date, endTime: Date | null) {
  if (endTime && endTime.getTime() <= startTime.getTime()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "종료 시간은 시작 시간보다 늦어야 합니다.",
    });
  }
}

function reminderFlagsFromOffset(reminderOffsetMinutes: number) {
  return {
    reminderDayBefore: reminderOffsetMinutes === 1440,
    reminderSameDay: reminderOffsetMinutes === 0,
    reminderOneHourBefore: reminderOffsetMinutes === 60,
  };
}

function asOrgUsers(rows: any[]): OrgUser[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name ?? null,
    role: row.role,
    accountStatus: row.accountStatus,
    parentUserId: row.parentUserId ?? null,
    teamId: row.teamId ?? null,
    subBranchAdminId: row.subBranchAdminId ?? null,
  }));
}

function asOrgTeams(rows: any[]): OrgTeam[] {
  return rows.map(row => ({
    id: row.id,
    managerId: row.managerId ?? null,
    subBranchAdminId: row.subBranchAdminId ?? null,
    isActive: row.isActive,
  }));
}

async function loadOrganization(tx: DbExecutor) {
  const [userRows, teamRows] = await Promise.all([
    tx.select().from(users),
    tx.select().from(teams),
  ]);
  return { users: asOrgUsers(userRows), teams: asOrgTeams(teamRows) };
}

function requireUser(rows: OrgUser[], userId: number) {
  const user = rows.find(item => item.id === userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND" });
  return user;
}

async function assertCustomerAccessibleInTransaction(
  tx: DbExecutor,
  actor: OrgUser,
  customerId: number,
  organizationUsers: OrgUser[]
) {
  const rows = await tx
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  const customer = rows[0];
  if (!customer || !customer.isActive || customer.deletedAt) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (actor.role === "sub_branch_admin") {
    if (customer.subBranchAdminId === actor.id || customer.agentId === actor.id) {
      return customer;
    }
    const agent = organizationUsers.find(item => item.id === customer.agentId);
    if (agent?.subBranchAdminId === actor.id) return customer;
  }
  if (actor.role === "team_leader") {
    if (customer.agentId === actor.id) return customer;
    if (customer.assignedTeamId && customer.assignedTeamId === actor.teamId) {
      return customer;
    }
    const agent = organizationUsers.find(item => item.id === customer.agentId);
    if (agent?.teamId === actor.teamId) return customer;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "업무 범위 안의 고객만 일정 요청에 연결할 수 있습니다.",
  });
}

export function buildScheduleChangeRequestSnapshot(schedule: Schedule) {
  return {
    id: schedule.id,
    userId: schedule.userId,
    teamId: schedule.teamId ?? null,
    title: schedule.title,
    type: schedule.type,
    status: schedule.status,
    startTime: schedule.startTime.toISOString(),
    endTime: schedule.endTime?.toISOString() ?? null,
    completedAt: schedule.completedAt?.toISOString() ?? null,
    customerId: schedule.customerId ?? null,
    memo: schedule.memo ?? null,
    description: schedule.description ?? null,
    location: schedule.location ?? null,
    reminderOffsetMinutes: schedule.reminderOffsetMinutes ?? 30,
    reminderDayBefore: schedule.reminderDayBefore ?? false,
    reminderSameDay: schedule.reminderSameDay ?? false,
    reminderOneHourBefore: schedule.reminderOneHourBefore ?? false,
    calendarCategory: schedule.calendarCategory ?? null,
    isActive: schedule.isActive,
    deletedAt: schedule.deletedAt?.toISOString() ?? null,
    createdBy: schedule.createdBy ?? null,
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

function scheduleMatchesSnapshot(
  schedule: Schedule,
  snapshot: unknown
): boolean {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return false;
  }
  const current = buildScheduleChangeRequestSnapshot(schedule);
  const expected = snapshot as Record<string, unknown>;
  return Object.entries(current).every(([field, value]) =>
    sameValue(value, expected[field])
  );
}

function nullableScheduleCondition(column: any, value: unknown) {
  return value == null ? isNull(column) : eq(column, value as any);
}

function scheduleBaselineConditions(schedule: Schedule) {
  return [
    eq(schedules.id, schedule.id),
    eq(schedules.userId, schedule.userId),
    nullableScheduleCondition(schedules.teamId, schedule.teamId),
    nullableScheduleCondition(schedules.customerId, schedule.customerId),
    eq(schedules.title, schedule.title),
    nullableScheduleCondition(schedules.description, schedule.description),
    nullableScheduleCondition(schedules.location, schedule.location),
    eq(schedules.type, schedule.type),
    eq(schedules.status, schedule.status),
    eq(schedules.startTime, schedule.startTime),
    nullableScheduleCondition(schedules.endTime, schedule.endTime),
    nullableScheduleCondition(schedules.completedAt, schedule.completedAt),
    nullableScheduleCondition(schedules.memo, schedule.memo),
    nullableScheduleCondition(
      schedules.calendarCategory,
      schedule.calendarCategory
    ),
    nullableScheduleCondition(
      schedules.reminderDayBefore,
      schedule.reminderDayBefore
    ),
    nullableScheduleCondition(
      schedules.reminderSameDay,
      schedule.reminderSameDay
    ),
    nullableScheduleCondition(
      schedules.reminderOneHourBefore,
      schedule.reminderOneHourBefore
    ),
    eq(schedules.reminderOffsetMinutes, schedule.reminderOffsetMinutes),
    eq(schedules.isActive, schedule.isActive),
    nullableScheduleCondition(schedules.deletedAt, schedule.deletedAt),
    nullableScheduleCondition(schedules.createdBy, schedule.createdBy),
    eq(schedules.updatedAt, schedule.updatedAt),
  ];
}

function sameValue(left: unknown, right: unknown) {
  if (left instanceof Date) left = left.toISOString();
  if (right instanceof Date) right = right.toISOString();
  return (left ?? null) === (right ?? null);
}

export function buildScheduleUpdateRequestPayload(
  schedule: Schedule,
  input: ScheduleUpdateRequestPayload
): ScheduleUpdateRequestPayload {
  const changed: Record<string, unknown> = {};
  for (const [field, rawValue] of Object.entries(input)) {
    let nextValue: unknown = rawValue;
    let currentValue: unknown = (schedule as any)[field];
    if (field === "startTime" && typeof rawValue === "string") {
      nextValue = parseRequestDate(rawValue, "시작 시간").toISOString();
      currentValue = schedule.startTime.toISOString();
    }
    if (field === "endTime") {
      nextValue = parseOptionalEndTime(rawValue as string | null)?.toISOString() ?? null;
      currentValue = schedule.endTime?.toISOString() ?? null;
    }
    if (!sameValue(currentValue, nextValue)) changed[field] = nextValue;
  }
  if (Object.keys(changed).length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "실제 변경되는 일정 정보가 없습니다.",
    });
  }
  return scheduleUpdateRequestPayloadSchema.parse(changed);
}

function normalizedCreatePayload(
  input: ScheduleCreateRequestPayload,
  targetRole: string,
  actorRole: string
) {
  const startTime = parseRequestDate(input.startTime, "시작 시간");
  const endTime = parseOptionalEndTime(input.endTime);
  assertEndAfterStart(startTime, endTime);
  const calendarCategory = resolveCalendarCategoryForSave({
    requestedCategory: input.calendarCategory,
    scheduleType: input.type,
    customerId: input.customerId,
    ownerRole: targetRole,
  });
  assertCanSelectCalendarCategory(actorRole, calendarCategory);
  return {
    ...input,
    status: input.status ?? "예정",
    startTime: startTime.toISOString(),
    endTime: endTime?.toISOString() ?? null,
    reminderOffsetMinutes: input.reminderOffsetMinutes ?? 30,
    customerId: input.customerId ?? null,
    memo: input.memo ?? null,
    description: input.description ?? null,
    location: input.location ?? null,
    calendarCategory,
  };
}

function validateEffectiveUpdateTimes(
  schedule: Schedule,
  payload: ScheduleUpdateRequestPayload
) {
  const startTime = payload.startTime
    ? parseRequestDate(payload.startTime, "시작 시간")
    : schedule.startTime;
  const endTime =
    payload.endTime !== undefined
      ? parseOptionalEndTime(payload.endTime)
      : schedule.endTime;
  assertEndAfterStart(startTime, endTime ?? null);
}

function pendingKeyForSchedule(scheduleId: number) {
  return `schedule:${scheduleId}`;
}

async function insertActivity(
  tx: DbExecutor,
  actorId: number,
  action: string,
  requestId: number,
  metadata: Record<string, unknown>
) {
  await createActivityLog(
    {
      userId: actorId,
      action,
      targetType: "schedule_change_request",
      targetId: requestId,
      details: JSON.stringify({
        actor: actorId,
        targetType: "schedule_change_request",
        targetId: requestId,
        metadata,
      }),
    },
    tx
  );
}

async function insertInternalNotifications(
  tx: DbExecutor,
  userIds: number[],
  requestId: number,
  title: string,
  message: string
) {
  for (const userId of Array.from(new Set(userIds))) {
    await createNotification(
      {
        userId,
        type: "general",
        title,
        message,
        relatedType: "schedule_change_request",
        relatedId: requestId,
      },
      tx
    );
  }
}

async function sendRequestPush(
  userIds: number[],
  requestId: number,
  event: "created" | "approved" | "rejected" | "conflict" | "failed"
) {
  const payload =
    event === "created"
      ? SAFE_PUSH_PAYLOADS.scheduleChangeRequestCreated
      : event === "approved"
        ? SAFE_PUSH_PAYLOADS.scheduleChangeRequestApproved
        : event === "rejected"
          ? SAFE_PUSH_PAYLOADS.scheduleChangeRequestRejected
          : event === "conflict"
            ? SAFE_PUSH_PAYLOADS.scheduleChangeRequestConflict
            : SAFE_PUSH_PAYLOADS.scheduleChangeRequestFailed;
  await sendPushToUsers(userIds, payload, {
    type: "schedule_change_request",
    sourceType: "schedule_change_request",
    sourceId: requestId,
    dedupeKey: `schedule_change_request:${requestId}:${event}`,
  });
}

async function createRequestRecord(params: {
  actorId: number;
  targetUserId: number;
  requestType: "create" | "update" | "delete";
  scheduleId?: number | null;
  reason: string;
  payload: RequestPayload | Record<string, never>;
  beforeSnapshot?: Record<string, unknown> | null;
  baseScheduleUpdatedAt?: Date | null;
  pendingKey?: string | null;
}) {
  const db = await getDb();
  if (!db) throw dbUnavailable();
  try {
    return await db.transaction(async rawTx => {
      const tx = rawTx as DbExecutor;
      const organization = await loadOrganization(tx);
      const actor = requireUser(organization.users, params.actorId);
      const target = requireUser(organization.users, params.targetUserId);
      assertScheduleRequestScope(
        actor,
        target,
        organization.users,
        organization.teams
      );

      if (params.requestType !== "create") {
        const scheduleRows = await tx
          .select()
          .from(schedules)
          .where(eq(schedules.id, params.scheduleId!))
          .limit(1);
        const currentSchedule = scheduleRows[0];
        if (
          !currentSchedule ||
          !currentSchedule.isActive ||
          currentSchedule.deletedAt ||
          currentSchedule.userId !== target.id ||
          !datesMatch(
            currentSchedule.updatedAt,
            params.baseScheduleUpdatedAt
          ) ||
          !scheduleMatchesSnapshot(currentSchedule, params.beforeSnapshot)
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "요청을 저장하기 전에 원본 일정이 변경되었습니다.",
          });
        }
      }

      const customerId = (params.payload as any).customerId;
      if (customerId) {
        await assertCustomerAccessibleInTransaction(
          tx,
          actor,
          customerId,
          organization.users
        );
      }

      const insertResult = await tx.insert(scheduleChangeRequests).values({
        requestType: params.requestType,
        scheduleId: params.scheduleId ?? null,
        requesterId: actor.id,
        targetUserId: target.id,
        status: "pending",
        reason: params.reason,
        requestedPayload: params.payload,
        beforeSnapshot: params.beforeSnapshot ?? null,
        baseScheduleUpdatedAt: params.baseScheduleUpdatedAt ?? null,
        pendingKey: params.pendingKey ?? null,
      });
      const requestId = insertedId(insertResult);
      if (!requestId) throw new Error("schedule_request_insert_failed");
      const branchAdminIds = organization.users
        .filter(
          user =>
            user.role === "branch_admin" && user.accountStatus === "active"
        )
        .map(user => user.id);
      await insertInternalNotifications(
        tx,
        branchAdminIds,
        requestId,
        "일정 변경 요청",
        "새로운 일정 변경 요청이 있습니다."
      );
      await insertActivity(
        tx,
        actor.id,
        "SCHEDULE_CHANGE_REQUEST_CREATED",
        requestId,
        {
          requestId,
          requestType: params.requestType,
          scheduleId: params.scheduleId ?? null,
          requesterId: actor.id,
          targetUserId: target.id,
          changedFieldNames: Object.keys(params.payload),
          status: "pending",
        }
      );
      return { requestId, branchAdminIds };
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "이미 처리 대기 중인 일정 요청이 있습니다.",
      });
    }
    throw error;
  }
}

async function getRequestById(
  executor: DbExecutor,
  requestId: number
): Promise<ScheduleChangeRequest | undefined> {
  const rows = await executor
    .select()
    .from(scheduleChangeRequests)
    .where(eq(scheduleChangeRequests.id, requestId))
    .limit(1);
  return rows[0];
}

async function claimPendingRequest(
  tx: DbExecutor,
  requestId: number,
  reviewerId: number,
  now: Date
) {
  const result = await tx
    .update(scheduleChangeRequests)
    .set({
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: now,
    })
    .where(
      and(
        eq(scheduleChangeRequests.id, requestId),
        eq(scheduleChangeRequests.status, "pending")
      )
    );
  if (affectedRows(result) !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "이미 처리된 일정 요청입니다.",
    });
  }
}

async function setClaimedRequestStatus(
  tx: DbExecutor,
  requestId: number,
  status: "conflict" | "failed",
  reviewerId: number,
  comment: string,
  now: Date
) {
  const result = await tx
    .update(scheduleChangeRequests)
    .set({
      status,
      pendingKey: null,
      reviewedBy: reviewerId,
      reviewedAt: now,
      reviewComment: comment,
    })
    .where(
      and(
        eq(scheduleChangeRequests.id, requestId),
        eq(scheduleChangeRequests.status, "approved"),
        eq(scheduleChangeRequests.reviewedBy, reviewerId)
      )
    );
  if (affectedRows(result) !== 1) {
    throw new Error("schedule_request_terminal_status_update_failed");
  }
}

function datesMatch(left?: Date | null, right?: Date | null) {
  return Boolean(left && right && left.getTime() === right.getTime());
}

async function applyCreateRequest(
  tx: DbExecutor,
  request: ScheduleChangeRequest,
  approverId: number,
  target: OrgUser
) {
  const payload = scheduleCreateRequestPayloadSchema.parse(
    request.requestedPayload
  );
  const normalized = normalizedCreatePayload(payload, target.role, "branch_admin");
  const reminderOffset = normalized.reminderOffsetMinutes;
  const result = await tx.insert(schedules).values({
    userId: target.id,
    customerId: normalized.customerId,
    title: normalized.title,
    type: normalized.type,
    status: normalized.status,
    startTime: new Date(normalized.startTime),
    endTime: normalized.endTime ? new Date(normalized.endTime) : null,
    memo: normalized.memo,
    description: normalized.description,
    location: normalized.location,
    calendarCategory: normalized.calendarCategory,
    reminderOffsetMinutes: reminderOffset,
    ...reminderFlagsFromOffset(reminderOffset),
    isActive: true,
    createdBy: approverId,
  });
  const scheduleId = insertedId(result);
  if (!scheduleId) throw new Error("schedule_request_create_apply_failed");
  return scheduleId;
}

function buildUpdateData(
  payload: ScheduleUpdateRequestPayload,
  schedule: Schedule
) {
  const updateData: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(payload)) {
    if (field === "startTime") {
      updateData.startTime = parseRequestDate(String(value), "시작 시간");
    } else if (field === "endTime") {
      updateData.endTime = parseOptionalEndTime(value as string | null);
    } else {
      updateData[field] = value;
    }
  }
  if (payload.reminderOffsetMinutes !== undefined) {
    Object.assign(
      updateData,
      reminderFlagsFromOffset(payload.reminderOffsetMinutes)
    );
  }
  if (payload.status === "완료") updateData.completedAt = new Date();
  validateEffectiveUpdateTimes(schedule, payload);
  return updateData;
}

async function applyUpdateRequest(
  tx: DbExecutor,
  request: ScheduleChangeRequest,
  schedule: Schedule
) {
  const payload = scheduleUpdateRequestPayloadSchema.parse(
    request.requestedPayload
  );
  if (payload.calendarCategory) {
    assertCanSelectCalendarCategory("branch_admin", payload.calendarCategory);
  }
  const result = await tx
    .update(schedules)
    .set(buildUpdateData(payload, schedule))
    .where(
      and(...scheduleBaselineConditions(schedule))
    );
  return affectedRows(result) === 1;
}

async function applyDeleteRequest(
  tx: DbExecutor,
  request: ScheduleChangeRequest,
  schedule: Schedule,
  now: Date
) {
  const result = await tx
    .update(schedules)
    .set({ isActive: false, deletedAt: now, status: "취소" })
    .where(
      and(...scheduleBaselineConditions(schedule))
    );
  return affectedRows(result) === 1;
}

async function scheduleAfterApprovalSideEffects(input: {
  actorId: number;
  requestType: "create" | "update" | "delete";
  scheduleId: number;
  previousSchedule?: Schedule;
}) {
  if (input.requestType === "delete") {
    const schedule = input.previousSchedule;
    if (!schedule) return;
    await cancelScheduleTimingNotifications(schedule.userId, schedule.id);
    await cancelScheduleIncompleteNotification(schedule.userId, schedule.id);
    const owner = await getUserById(schedule.userId);
    triggerGoogleCalendarDeleteForSchedule(
      input.actorId,
      schedule,
      owner?.role ?? null
    );
    return;
  }
  const schedule = await getScheduleById(input.scheduleId);
  if (!schedule?.isActive || schedule.deletedAt) return;
  await cancelScheduleTimingNotifications(schedule.userId, schedule.id);
  await cancelScheduleIncompleteNotification(schedule.userId, schedule.id);
  if (!["완료", "취소", "노쇼"].includes(schedule.status)) {
    const reminderOffset = schedule.reminderOffsetMinutes ?? 30;
    if (reminderOffset >= 0) {
      await createScheduleReminderByOffset(
        schedule.id,
        schedule.userId,
        schedule.startTime,
        schedule.title,
        reminderOffset
      );
    }
    if (schedule.endTime) {
      await createScheduleIncompleteReminder(
        schedule.id,
        schedule.userId,
        schedule.endTime,
        schedule.title
      );
    }
  }
  void triggerGoogleCalendarSyncForScheduleId(input.actorId, schedule.id, {
    personalCalendarOwnerOnly: true,
  });
}

async function markFailedAfterRollback(requestId: number, reviewerId: number) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db.transaction(async rawTx => {
    const tx = rawTx as DbExecutor;
    const result = await tx
      .update(scheduleChangeRequests)
      .set({
        status: "failed",
        pendingKey: null,
        reviewedBy: reviewerId,
        reviewedAt: now,
        reviewComment: "일정 자동 반영 중 오류가 발생했습니다.",
      })
      .where(
        and(
          eq(scheduleChangeRequests.id, requestId),
          eq(scheduleChangeRequests.status, "pending")
        )
      );
    if (affectedRows(result) !== 1) return;
    const request = await getRequestById(tx, requestId);
    if (!request) return;
    await insertActivity(
      tx,
      reviewerId,
      "SCHEDULE_CHANGE_REQUEST_FAILED",
      requestId,
      {
        requestId,
        requestType: request.requestType,
        scheduleId: request.scheduleId,
        requesterId: request.requesterId,
        targetUserId: request.targetUserId,
        status: "failed",
      }
    );
    await insertInternalNotifications(
      tx,
      [request.requesterId],
      requestId,
      "일정 요청 반영 실패",
      "일정 요청을 자동 반영하지 못했습니다."
    );
  });
}

async function transitionPendingRequest(params: {
  requestId: number;
  actorId: number;
  status: "rejected" | "cancelled";
  reviewComment?: string;
}) {
  const db = await getDb();
  if (!db) throw dbUnavailable();
  const result = await db.transaction(async rawTx => {
    const tx = rawTx as DbExecutor;
    const request = await getRequestById(tx, params.requestId);
    if (!request) throw new TRPCError({ code: "NOT_FOUND" });
    if (params.status === "cancelled" && request.requesterId !== params.actorId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const now = new Date();
    const updateResult = await tx
      .update(scheduleChangeRequests)
      .set({
        status: params.status,
        pendingKey: null,
        reviewedBy: params.status === "rejected" ? params.actorId : null,
        reviewedAt: params.status === "rejected" ? now : null,
        reviewComment: params.reviewComment,
        cancelledAt: params.status === "cancelled" ? now : null,
      })
      .where(
        and(
          eq(scheduleChangeRequests.id, params.requestId),
          eq(scheduleChangeRequests.status, "pending")
        )
      );
    if (affectedRows(updateResult) !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "이미 처리된 일정 요청입니다.",
      });
    }
    const action =
      params.status === "rejected"
        ? "SCHEDULE_CHANGE_REQUEST_REJECTED"
        : "SCHEDULE_CHANGE_REQUEST_CANCELLED";
    await insertActivity(tx, params.actorId, action, params.requestId, {
      requestId: params.requestId,
      requestType: request.requestType,
      scheduleId: request.scheduleId,
      requesterId: request.requesterId,
      targetUserId: request.targetUserId,
      status: params.status,
    });
    if (params.status === "rejected") {
      await insertInternalNotifications(
        tx,
        [request.requesterId],
        params.requestId,
        "일정 요청 반려",
        "일정 요청이 반려되었습니다."
      );
    }
    return request;
  });
  if (params.status === "rejected") {
    await sendRequestPush(
      [result.requesterId],
      params.requestId,
      "rejected"
    ).catch(() => undefined);
  }
  return { success: true };
}

function parseFilterDate(value?: string, endOfDay = false) {
  if (!value) return undefined;
  const parsed = parseKstLocalDateTime(
    value.includes("T") ? value : `${value}T${endOfDay ? "23:59:59" : "00:00:00"}`
  );
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function listRequestRows(
  executor: DbExecutor,
  filter: {
    requesterId?: number;
    requestType?: (typeof SCHEDULE_CHANGE_REQUEST_TYPES)[number];
    status?: (typeof SCHEDULE_CHANGE_REQUEST_STATUSES)[number];
    targetUserId?: number;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const conditions: any[] = [];
  if (filter.requesterId !== undefined) {
    conditions.push(eq(scheduleChangeRequests.requesterId, filter.requesterId));
  }
  if (filter.requestType) {
    conditions.push(eq(scheduleChangeRequests.requestType, filter.requestType));
  }
  if (filter.status) {
    conditions.push(eq(scheduleChangeRequests.status, filter.status));
  }
  if (filter.targetUserId !== undefined) {
    conditions.push(eq(scheduleChangeRequests.targetUserId, filter.targetUserId));
  }
  const dateFrom = parseFilterDate(filter.dateFrom);
  const dateTo = parseFilterDate(filter.dateTo, true);
  if (dateFrom) conditions.push(gte(scheduleChangeRequests.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(scheduleChangeRequests.createdAt, dateTo));
  return executor
    .select()
    .from(scheduleChangeRequests)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(scheduleChangeRequests.createdAt))
    .limit(200);
}

async function buildRequestViews(
  executor: DbExecutor,
  requestRows: ScheduleChangeRequest[]
) {
  if (requestRows.length === 0) return [];
  const userIds = Array.from(
    new Set(
      requestRows.flatMap(row =>
        [row.requesterId, row.targetUserId, row.reviewedBy].filter(
          (value): value is number => value != null
        )
      )
    )
  );
  const scheduleIds = Array.from(
    new Set(
      requestRows
        .map(row => row.scheduleId)
        .filter((value): value is number => value != null)
    )
  );
  const [userRows, scheduleRows] = await Promise.all([
    userIds.length
      ? executor.select().from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
    scheduleIds.length
      ? executor
          .select()
          .from(schedules)
          .where(inArray(schedules.id, scheduleIds))
      : Promise.resolve([]),
  ]);
  const userById = new Map<number, any>(
    userRows.map((row: any) => [row.id, row])
  );
  const scheduleById = new Map<number, any>(
    scheduleRows.map((row: any) => [row.id, row])
  );
  return requestRows.map(row => ({
    ...row,
    requester: userById.has(row.requesterId)
      ? {
          id: row.requesterId,
          name: userById.get(row.requesterId)?.name ?? null,
          role: userById.get(row.requesterId)?.role ?? null,
        }
      : null,
    targetUser: userById.has(row.targetUserId)
      ? {
          id: row.targetUserId,
          name: userById.get(row.targetUserId)?.name ?? null,
          role: userById.get(row.targetUserId)?.role ?? null,
        }
      : null,
    reviewer: row.reviewedBy
      ? {
          id: row.reviewedBy,
          name: userById.get(row.reviewedBy)?.name ?? null,
        }
      : null,
    currentSchedule: row.scheduleId
      ? (scheduleById.get(row.scheduleId) ?? null)
      : null,
  }));
}

const scheduleApprovalDependencies = {
  getRequestById,
  claimPendingRequest,
  loadOrganization,
  requireUser,
  assertCustomerAccessibleInTransaction,
  setClaimedRequestStatus,
  insertActivity,
  insertInternalNotifications,
  datesMatch,
  scheduleMatchesSnapshot,
  applyCreateRequest,
  applyUpdateRequest,
  applyDeleteRequest,
  affectedRows,
  markFailedAfterRollback,
  scheduleAfterApprovalSideEffects,
  sendRequestPush,
};

export const scheduleChangeRequestsRouter = router({
  requestCreate: activeUserProcedure
    .input(createRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const organization = await loadOrganization(db as DbExecutor);
      const actor = requireUser(organization.users, ctx.user.id);
      const target = requireUser(organization.users, input.targetUserId);
      assertScheduleRequestScope(
        actor,
        target,
        organization.users,
        organization.teams
      );
      const payload = normalizedCreatePayload(
        input.payload,
        target.role,
        actor.role
      );
      const created = await createRequestRecord({
        actorId: ctx.user.id,
        targetUserId: input.targetUserId,
        requestType: "create",
        reason: input.reason,
        payload,
      });
      await sendRequestPush(
        created.branchAdminIds,
        created.requestId,
        "created"
      ).catch(() => undefined);
      return { success: true, requestId: created.requestId };
    }),

  requestUpdate: activeUserProcedure
    .input(updateRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const scheduleRows = await db
        .select()
        .from(schedules)
        .where(eq(schedules.id, input.scheduleId))
        .limit(1);
      const schedule = scheduleRows[0];
      if (!schedule || !schedule.isActive || schedule.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const payload = buildScheduleUpdateRequestPayload(
        schedule,
        input.payload
      );
      validateEffectiveUpdateTimes(schedule, payload);
      const created = await createRequestRecord({
        actorId: ctx.user.id,
        targetUserId: schedule.userId,
        requestType: "update",
        scheduleId: schedule.id,
        reason: input.reason,
        payload,
        beforeSnapshot: buildScheduleChangeRequestSnapshot(schedule),
        baseScheduleUpdatedAt: schedule.updatedAt,
        pendingKey: pendingKeyForSchedule(schedule.id),
      });
      await sendRequestPush(
        created.branchAdminIds,
        created.requestId,
        "created"
      ).catch(() => undefined);
      return { success: true, requestId: created.requestId };
    }),

  requestDelete: activeUserProcedure
    .input(deleteRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const scheduleRows = await db
        .select()
        .from(schedules)
        .where(eq(schedules.id, input.scheduleId))
        .limit(1);
      const schedule = scheduleRows[0];
      if (!schedule || !schedule.isActive || schedule.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const created = await createRequestRecord({
        actorId: ctx.user.id,
        targetUserId: schedule.userId,
        requestType: "delete",
        scheduleId: schedule.id,
        reason: input.reason,
        payload: {},
        beforeSnapshot: buildScheduleChangeRequestSnapshot(schedule),
        baseScheduleUpdatedAt: schedule.updatedAt,
        pendingKey: pendingKeyForSchedule(schedule.id),
      });
      await sendRequestPush(
        created.branchAdminIds,
        created.requestId,
        "created"
      ).catch(() => undefined);
      return { success: true, requestId: created.requestId };
    }),

  listMy: activeUserProcedure
    .input(listFilterSchema)
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await listRequestRows(db as DbExecutor, {
        ...input,
        requesterId: ctx.user.id,
      });
      return buildRequestViews(db as DbExecutor, rows);
    }),

  listAdmin: branchAdminProcedure
    .input(listFilterSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await listRequestRows(db as DbExecutor, input ?? {});
      return buildRequestViews(db as DbExecutor, rows);
    }),

  getDetail: activeUserProcedure
    .input(z.object({ id: z.number().int().positive() }).strict())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const request = await getRequestById(db as DbExecutor, input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        ctx.user.role !== "branch_admin" &&
        request.requesterId !== ctx.user.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return (await buildRequestViews(db as DbExecutor, [request]))[0];
    }),

  summary: branchAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return { pending: 0, today: 0, conflict: 0, monthApproved: 0, monthRejected: 0 };
    }
    const rows = await db.select().from(scheduleChangeRequests);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      pending: rows.filter(row => row.status === "pending").length,
      today: rows.filter(row => row.createdAt >= todayStart).length,
      conflict: rows.filter(row => row.status === "conflict").length,
      monthApproved: rows.filter(
        row => row.status === "approved" && row.reviewedAt && row.reviewedAt >= monthStart
      ).length,
      monthRejected: rows.filter(
        row => row.status === "rejected" && row.reviewedAt && row.reviewedAt >= monthStart
      ).length,
    };
  }),

  approve: branchAdminProcedure
    .input(z.object({ id: z.number().int().positive() }).strict())
    .mutation(({ ctx, input }) =>
      approveScheduleChangeRequest(
        input.id,
        ctx.user.id,
        scheduleApprovalDependencies
      )
    ),

  reject: branchAdminProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          reviewComment: z.string().trim().min(1).max(500),
        })
        .strict()
    )
    .mutation(({ ctx, input }) =>
      transitionPendingRequest({
        requestId: input.id,
        actorId: ctx.user.id,
        status: "rejected",
        reviewComment: input.reviewComment,
      })
    ),

  cancelMy: activeUserProcedure
    .input(z.object({ id: z.number().int().positive() }).strict())
    .mutation(({ ctx, input }) =>
      transitionPendingRequest({
        requestId: input.id,
        actorId: ctx.user.id,
        status: "cancelled",
      })
    ),
});
