import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { ScheduleChangeRequestStatus } from "@shared/scheduleChangeRequest";
import {
  scheduleChangeRequests,
  schedules,
  type Schedule,
  type ScheduleChangeRequest,
} from "../drizzle/schema";
import { getDb } from "./db";
import { assertScheduleRequestScope } from "./scheduleChangeRequestScope";
import type { OrgTeam, OrgUser } from "./organizationHierarchy";

type DbExecutor = any;

type ApprovalSideEffects = {
  actorId: number;
  requestType: "create" | "update" | "delete";
  scheduleId: number;
  previousSchedule?: Schedule;
  notifyUserIds: number[];
  status: ScheduleChangeRequestStatus;
};

export type ScheduleApprovalDependencies = {
  getRequestById: (
    executor: DbExecutor,
    requestId: number
  ) => Promise<ScheduleChangeRequest | undefined>;
  claimPendingRequest: (
    tx: DbExecutor,
    requestId: number,
    reviewerId: number,
    now: Date
  ) => Promise<void>;
  loadOrganization: (
    tx: DbExecutor
  ) => Promise<{ users: OrgUser[]; teams: OrgTeam[] }>;
  requireUser: (rows: OrgUser[], userId: number) => OrgUser;
  assertCustomerAccessibleInTransaction: (
    tx: DbExecutor,
    actor: OrgUser,
    customerId: number,
    organizationUsers: OrgUser[]
  ) => Promise<unknown>;
  setClaimedRequestStatus: (
    tx: DbExecutor,
    requestId: number,
    status: "conflict" | "failed",
    reviewerId: number,
    comment: string,
    now: Date
  ) => Promise<void>;
  insertActivity: (...args: any[]) => Promise<void>;
  insertInternalNotifications: (...args: any[]) => Promise<void>;
  datesMatch: (left?: Date | null, right?: Date | null) => boolean;
  scheduleMatchesSnapshot: (
    schedule: Schedule,
    snapshot: unknown
  ) => boolean;
  applyCreateRequest: (
    tx: DbExecutor,
    request: ScheduleChangeRequest,
    approverId: number,
    target: OrgUser
  ) => Promise<number>;
  applyUpdateRequest: (
    tx: DbExecutor,
    request: ScheduleChangeRequest,
    schedule: Schedule
  ) => Promise<boolean>;
  applyDeleteRequest: (
    tx: DbExecutor,
    request: ScheduleChangeRequest,
    schedule: Schedule,
    now: Date
  ) => Promise<boolean>;
  affectedRows: (result: unknown) => number;
  markFailedAfterRollback: (
    requestId: number,
    reviewerId: number
  ) => Promise<void>;
  scheduleAfterApprovalSideEffects: (
    input: ApprovalSideEffects
  ) => Promise<void>;
  sendRequestPush: (
    userIds: number[],
    requestId: number,
    status: "approved" | "conflict" | "failed"
  ) => Promise<void>;
};

function approvalDbUnavailable() {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "일정 요청 저장소에 연결할 수 없습니다.",
  });
}
export async function approveScheduleChangeRequest(
  requestId: number,
  approverId: number,
  deps: ScheduleApprovalDependencies
) {
  const db = await getDb();
  if (!db) throw approvalDbUnavailable();
  let sideEffects:
    | {
        actorId: number;
        requestType: "create" | "update" | "delete";
        scheduleId: number;
        previousSchedule?: Schedule;
        notifyUserIds: number[];
        status: ScheduleChangeRequestStatus;
      }
    | undefined;
  try {
    sideEffects = await db.transaction(async rawTx => {
      const tx = rawTx as DbExecutor;
      const request = await deps.getRequestById(tx, requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 처리된 일정 요청입니다.",
        });
      }
      const now = new Date();
      await deps.claimPendingRequest(tx, requestId, approverId, now);
      const organization = await deps.loadOrganization(tx);
      let requester: OrgUser;
      let target: OrgUser;
      try {
        requester = deps.requireUser(organization.users, request.requesterId);
        target = deps.requireUser(organization.users, request.targetUserId);
        assertScheduleRequestScope(
          requester,
          target,
          organization.users,
          organization.teams
        );
        const customerId = (request.requestedPayload as any)?.customerId;
        if (customerId) {
          await deps.assertCustomerAccessibleInTransaction(
            tx,
            requester,
            customerId,
            organization.users
          );
        }
      } catch {
        await deps.setClaimedRequestStatus(
          tx,
          requestId,
          "failed",
          approverId,
          "승인 시점 권한 또는 대상 상태 검증에 실패했습니다.",
          now
        );
        await deps.insertActivity(
          tx,
          approverId,
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
        await deps.insertInternalNotifications(
          tx,
          [request.requesterId],
          requestId,
          "일정 요청 반영 실패",
          "승인 시점의 권한 또는 대상 상태가 변경되어 반영되지 않았습니다."
        );
        return {
          actorId: approverId,
          requestType: request.requestType,
          scheduleId: request.scheduleId ?? 0,
          notifyUserIds: [request.requesterId],
          status: "failed" as const,
        };
      }

      let currentSchedule: Schedule | undefined;
      if (request.requestType !== "create") {
        const scheduleRows = await tx
          .select()
          .from(schedules)
          .where(eq(schedules.id, request.scheduleId!))
          .limit(1);
        currentSchedule = scheduleRows[0];
        if (
          !currentSchedule ||
          !currentSchedule.isActive ||
          currentSchedule.deletedAt ||
          currentSchedule.userId !== request.targetUserId ||
          !deps.datesMatch(
            currentSchedule.updatedAt,
            request.baseScheduleUpdatedAt
          ) ||
          !deps.scheduleMatchesSnapshot(currentSchedule, request.beforeSnapshot)
        ) {
          await deps.setClaimedRequestStatus(
            tx,
            requestId,
            "conflict",
            approverId,
            "요청 이후 원본 일정이 변경되었습니다.",
            now
          );
          const branchAdminIds = organization.users
            .filter(
              user =>
                user.role === "branch_admin" &&
                user.accountStatus === "active"
            )
            .map(user => user.id);
          await deps.insertActivity(
            tx,
            approverId,
            "SCHEDULE_CHANGE_REQUEST_CONFLICT",
            requestId,
            {
              requestId,
              requestType: request.requestType,
              scheduleId: request.scheduleId,
              requesterId: request.requesterId,
              targetUserId: request.targetUserId,
              status: "conflict",
            }
          );
          await deps.insertInternalNotifications(
            tx,
            [...branchAdminIds, request.requesterId],
            requestId,
            "일정 요청 충돌",
            "요청 이후 일정이 변경되어 자동 반영되지 않았습니다."
          );
          return {
            actorId: approverId,
            requestType: request.requestType,
            scheduleId: request.scheduleId ?? 0,
            previousSchedule: currentSchedule,
            notifyUserIds: [...branchAdminIds, request.requesterId],
            status: "conflict" as const,
          };
        }
      }

      let appliedScheduleId = request.scheduleId ?? 0;
      let applied = true;
      if (request.requestType === "create") {
        appliedScheduleId = await deps.applyCreateRequest(
          tx,
          request,
          approverId,
          target!
        );
      } else if (request.requestType === "update") {
        applied = await deps.applyUpdateRequest(tx, request, currentSchedule!);
      } else {
        applied = await deps.applyDeleteRequest(tx, request, currentSchedule!, now);
      }

      if (!applied) {
        await deps.setClaimedRequestStatus(
          tx,
          requestId,
          "conflict",
          approverId,
          "승인 직전 원본 일정이 변경되었습니다.",
          now
        );
        await deps.insertActivity(
          tx,
          approverId,
          "SCHEDULE_CHANGE_REQUEST_CONFLICT",
          requestId,
          {
            requestId,
            requestType: request.requestType,
            scheduleId: request.scheduleId,
            requesterId: request.requesterId,
            targetUserId: request.targetUserId,
            status: "conflict",
          }
        );
        await deps.insertInternalNotifications(
          tx,
          [request.requesterId, approverId],
          requestId,
          "일정 요청 충돌",
          "요청 이후 일정이 변경되어 자동 반영되지 않았습니다."
        );
        return {
          actorId: approverId,
          requestType: request.requestType,
          scheduleId: request.scheduleId ?? 0,
          previousSchedule: currentSchedule,
          notifyUserIds: [request.requesterId, approverId],
          status: "conflict" as const,
        };
      }

      const finalizeResult = await tx
        .update(scheduleChangeRequests)
        .set({
          scheduleId: appliedScheduleId,
          pendingKey: null,
          appliedAt: now,
        })
        .where(
          and(
            eq(scheduleChangeRequests.id, requestId),
            eq(scheduleChangeRequests.status, "approved"),
            eq(scheduleChangeRequests.reviewedBy, approverId)
          )
        );
      if (deps.affectedRows(finalizeResult) !== 1) {
        throw new Error("schedule_request_approval_finalize_failed");
      }
      await deps.insertActivity(
        tx,
        approverId,
        "SCHEDULE_CHANGE_REQUEST_APPROVED",
        requestId,
        {
          requestId,
          requestType: request.requestType,
          scheduleId: appliedScheduleId,
          requesterId: request.requesterId,
          targetUserId: request.targetUserId,
          changedFieldNames: Object.keys(
            (request.requestedPayload ?? {}) as Record<string, unknown>
          ),
          status: "approved",
        }
      );
      await deps.insertInternalNotifications(
        tx,
        [request.requesterId, request.targetUserId],
        requestId,
        "일정 요청 승인",
        "일정 요청이 승인되어 반영되었습니다."
      );
      return {
        actorId: approverId,
        requestType: request.requestType,
        scheduleId: appliedScheduleId,
        previousSchedule: currentSchedule,
        notifyUserIds: [request.requesterId, request.targetUserId],
        status: "approved" as const,
      };
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    await deps.markFailedAfterRollback(requestId, approverId);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "일정 요청을 자동 반영하지 못했습니다.",
    });
  }

  if (!sideEffects) throw approvalDbUnavailable();
  if (sideEffects.status === "approved") {
    await deps.scheduleAfterApprovalSideEffects(sideEffects).catch(() => undefined);
    await deps.sendRequestPush(
      sideEffects.notifyUserIds,
      requestId,
      "approved"
    ).catch(() => undefined);
  } else if (sideEffects.status === "conflict") {
    await deps.sendRequestPush(
      sideEffects.notifyUserIds,
      requestId,
      "conflict"
    ).catch(() => undefined);
  } else if (sideEffects.status === "failed") {
    await deps.sendRequestPush(
      sideEffects.notifyUserIds,
      requestId,
      "failed"
    ).catch(() => undefined);
  }
  return { success: sideEffects.status === "approved", status: sideEffects.status };
}
