import { TRPCError } from "@trpc/server";
import { getUserById } from "./db";

type ScheduleMutationActor = {
  id: number;
  role: string;
};

type ScheduleOwner = {
  userId: number;
};

export function canCreateScheduleForUser(
  actor: ScheduleMutationActor,
  targetUserId: number
) {
  return actor.role === "branch_admin" || targetUserId === actor.id;
}

export function assertCanCreateScheduleForUser(
  actor: ScheduleMutationActor,
  targetUserId: number
) {
  if (!canCreateScheduleForUser(actor, targetUserId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 명의의 일정만 생성할 수 있습니다.",
    });
  }
}

export function canManageSchedule(
  actor: ScheduleMutationActor,
  schedule: ScheduleOwner
) {
  return actor.role === "branch_admin" || schedule.userId === actor.id;
}

export function assertScheduleMutationAccess(
  actor: ScheduleMutationActor,
  schedule: ScheduleOwner
) {
  if (!canManageSchedule(actor, schedule)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 소유 일정만 수정하거나 삭제할 수 있습니다.",
    });
  }
}

export async function assertActiveScheduleTarget(userId: number) {
  const target = await getUserById(userId);
  if (!target) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Target user not found.",
    });
  }
  if (target.accountStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot update schedules for inactive users.",
    });
  }
  return target;
}
