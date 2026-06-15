import { TRPCError } from "@trpc/server";
import { parseKstLocalDateTime } from "@shared/timePolicy";
import {
  recommendScheduleCalendarCategory,
  SCHEDULE_CALENDAR_CATEGORIES,
  SCHEDULE_CALENDAR_CATEGORY_LABELS,
  type ScheduleCalendarCategory,
} from "@shared/scheduleCalendarCategory";
import {
  getAllTeams,
  getAllUsers,
  getCustomerById,
  getSchedules,
  getUserById,
} from "./db";
import { getHierarchyScopeUserIds } from "./routers";

export type ScheduleViewMode = "mine" | "user" | "team" | "organization";

export type ScheduleListInput = {
  dateFrom?: string;
  dateTo?: string;
  viewMode?: ScheduleViewMode;
  ownerUserId?: number;
  teamId?: number;
  calendarCategory?: ScheduleCalendarCategory | "all";
};

export type CalendarScheduleItem = {
  id: number;
  userId: number;
  ownerUserId: number;
  ownerName: string;
  title: string;
  type: string;
  status: string;
  startTime: Date;
  endTime: Date | null;
  reminderOffsetMinutes: number;
  customerId: number | null;
  customerDisplayName: string | null;
  canViewCustomerDetail: boolean;
  canEdit: boolean;
  canDelete: boolean;
  memo?: string | null;
  calendarCategory: ScheduleCalendarCategory;
  calendarCategoryLabel: string;
};

export type ScheduleViewUser = {
  userId: number;
  name: string | null;
  role: string;
  teamId: number | null;
  teamName: string | null;
  isActive: true;
};

export type ScheduleViewTeam = {
  teamId: number;
  name: string;
};

export type ScheduleListResult = {
  schedules: CalendarScheduleItem[];
  users: ScheduleViewUser[];
  teams: ScheduleViewTeam[];
  organizationViewWarning?: string;
};

const ORGANIZATION_VIEW_WARNING_THRESHOLD = 200;

type ScheduleViewer = {
  id: number;
  role: string;
  teamId: number | null;
  subBranchAdminId?: number | null;
  accountStatus: string;
};

export async function getAccessibleSchedules(user: ScheduleViewer) {
  if (user.role === "branch_admin") return getSchedules({});
  if (user.role === "sub_branch_admin" || user.role === "team_leader") {
    const userIds = await getHierarchyScopeUserIds(user);
    return getSchedules({ userIds: userIds ?? [user.id] });
  }
  return getSchedules({ userId: user.id });
}

async function canAccessCustomerSilent(
  user: ScheduleViewer,
  customerId: number
): Promise<boolean> {
  const customer = await getCustomerById(customerId);
  if (!customer || !customer.isActive || customer.deletedAt) return false;
  if (user.role === "branch_admin") return true;
  if (user.role === "sub_branch_admin")
    return customer.subBranchAdminId === user.id;
  if (user.role === "team_leader") {
    if (customer.assignedTeamId && customer.assignedTeamId === user.teamId)
      return true;
    const agent = customer.agentId ? await getUserById(customer.agentId) : null;
    return !!agent && agent.teamId === user.teamId;
  }
  return customer.agentId === user.id;
}

function parseOptionalScheduleDate(
  value: string | undefined,
  fieldName: string
) {
  if (!value) return undefined;
  const parsed = parseKstLocalDateTime(
    value.includes("T") ? value : `${value}T00:00:00`
  );
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${fieldName}이 올바르지 않습니다.`,
    });
  }
  return parsed;
}

function parseOptionalScheduleEndDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = parseKstLocalDateTime(
    value.includes("T") ? value : `${value}T23:59:59`
  );
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "종료일이 올바르지 않습니다.",
    });
  }
  return parsed;
}

async function resolveScheduleOwnerUserIds(
  viewer: ScheduleViewer,
  input: ScheduleListInput,
  activeUsers: Awaited<ReturnType<typeof getAllUsers>>
) {
  const viewMode = input.viewMode ?? "mine";

  switch (viewMode) {
    case "mine":
      return [viewer.id];
    case "user": {
      if (!input.ownerUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "조회할 직원을 선택해주세요.",
        });
      }
      const target = activeUsers.find(user => user.id === input.ownerUserId);
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "선택한 직원을 찾을 수 없습니다.",
        });
      }
      return [target.id];
    }
    case "team": {
      if (!input.teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "조회할 팀을 선택해주세요.",
        });
      }
      return activeUsers
        .filter(user => user.teamId === input.teamId)
        .map(user => user.id);
    }
    case "organization":
      return activeUsers.map(user => user.id);
    default:
      return [viewer.id];
  }
}

export async function listCalendarSchedules(
  viewer: ScheduleViewer,
  input: ScheduleListInput = { viewMode: "mine" }
): Promise<ScheduleListResult> {
  const viewMode = input.viewMode ?? "mine";
  const [allUsers, allTeams] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
  ]);
  const activeUsers = allUsers.filter(user => user.accountStatus === "active");
  const activeUserIds = new Set(activeUsers.map(user => user.id));
  const teamNameById = new Map(
    allTeams.map(team => [team.id, team.name ?? `팀 #${team.id}`])
  );
  const userNameById = new Map(
    activeUsers.map(user => [user.id, user.name ?? `사용자 #${user.id}`])
  );

  const ownerUserIds = await resolveScheduleOwnerUserIds(
    viewer,
    input,
    activeUsers
  );
  const dateFrom = parseOptionalScheduleDate(input.dateFrom, "시작일");
  const dateTo = parseOptionalScheduleEndDate(input.dateTo);

  const scheduleFilter = {
    ...(ownerUserIds.length === 1
      ? { userId: ownerUserIds[0] }
      : { userIds: ownerUserIds }),
    dateFrom,
    dateTo,
  };

  const rawSchedules =
    ownerUserIds.length === 0 ? [] : await getSchedules(scheduleFilter);

  const filteredSchedules = rawSchedules.filter(schedule =>
    activeUserIds.has(schedule.userId)
  );
  const mutableScheduleIds = new Set(
    (await getAccessibleSchedules(viewer)).map(schedule => schedule.id)
  );

  const schedules: CalendarScheduleItem[] = await Promise.all(
    filteredSchedules.map(async schedule => {
      const canEdit = mutableScheduleIds.has(schedule.id);
      const canDelete = canEdit;
      const isOwnSchedule = schedule.userId === viewer.id;

      let customerDisplayName: string | null = null;
      let canViewCustomerDetail = false;
      if (schedule.customerId) {
        canViewCustomerDetail = await canAccessCustomerSilent(
          viewer,
          schedule.customerId
        );
        if (canViewCustomerDetail) {
          const customer = await getCustomerById(schedule.customerId);
          customerDisplayName = customer?.name ?? "고객 일정";
        } else {
          customerDisplayName = "고객 일정";
        }
      }

      const effectiveCategory =
        schedule.calendarCategory ??
        recommendScheduleCalendarCategory({
          scheduleType: schedule.type,
          customerId: schedule.customerId,
          ownerRole: (await getUserById(schedule.userId))?.role ?? null,
        });

      const item: CalendarScheduleItem = {
        id: schedule.id,
        userId: schedule.userId,
        ownerUserId: schedule.userId,
        ownerName:
          userNameById.get(schedule.userId) ?? `사용자 #${schedule.userId}`,
        title: schedule.title,
        type: schedule.type,
        status: schedule.status,
        startTime: schedule.startTime,
        endTime: schedule.endTime ?? null,
        reminderOffsetMinutes: schedule.reminderOffsetMinutes ?? 30,
        customerId: schedule.customerId ?? null,
        customerDisplayName,
        canViewCustomerDetail,
        canEdit,
        canDelete,
        calendarCategory: effectiveCategory,
        calendarCategoryLabel: SCHEDULE_CALENDAR_CATEGORY_LABELS[effectiveCategory],
      };

      if ((isOwnSchedule || canEdit) && schedule.memo) {
        item.memo = schedule.memo;
      }

      return item;
    })
  );

  const categoryFilter = input.calendarCategory ?? "all";
  const schedulesFiltered =
    categoryFilter === "all"
      ? schedules
      : schedules.filter(item => item.calendarCategory === categoryFilter);

  let organizationViewWarning: string | undefined;
  if (
    viewMode === "organization" &&
    schedulesFiltered.length >= ORGANIZATION_VIEW_WARNING_THRESHOLD
  ) {
    organizationViewWarning =
      "전체 일정이 많습니다. 기간을 좁히면 더 빠르게 확인할 수 있습니다.";
  }

  const users: ScheduleViewUser[] = activeUsers.map(user => ({
    userId: user.id,
    name: user.name,
    role: user.role,
    teamId: user.teamId ?? null,
    teamName: user.teamId ? (teamNameById.get(user.teamId) ?? null) : null,
    isActive: true as const,
  }));

  const teams: ScheduleViewTeam[] = allTeams
    .filter(team => (team as { isActive?: boolean }).isActive !== false)
    .map(team => ({
      teamId: team.id,
      name: team.name ?? `팀 #${team.id}`,
    }));

  return {
    schedules: schedulesFiltered,
    users,
    teams,
    organizationViewWarning,
  };
}
