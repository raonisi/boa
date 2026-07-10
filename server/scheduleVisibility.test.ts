import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import {
  canCreateScheduleForUser,
  canManageSchedule,
  listCalendarSchedules,
  getAccessibleSchedules,
} from "./scheduleVisibility";

const activeUsers = [
  {
    id: 1,
    name: "[TEST] Branch Admin",
    role: "branch_admin",
    accountStatus: "active",
    teamId: null,
    subBranchAdminId: null,
  },
  {
    id: 2,
    name: "[TEST] Sub Admin",
    role: "sub_branch_admin",
    accountStatus: "active",
    teamId: null,
    subBranchAdminId: null,
  },
  {
    id: 3,
    name: "[TEST] Team Leader",
    role: "team_leader",
    accountStatus: "active",
    teamId: 10,
    subBranchAdminId: 2,
  },
  {
    id: 4,
    name: "[TEST] Member A",
    role: "member",
    accountStatus: "active",
    teamId: 10,
    subBranchAdminId: 2,
  },
  {
    id: 5,
    name: "[TEST] Member B",
    role: "member",
    accountStatus: "active",
    teamId: 20,
    subBranchAdminId: 2,
  },
  {
    id: 99,
    name: "[TEST] Inactive",
    role: "member",
    accountStatus: "inactive",
    teamId: 10,
    subBranchAdminId: 2,
  },
] as any;

const teams = [
  { id: 10, name: "[TEST] Team A", isActive: true },
  { id: 20, name: "[TEST] Team B", isActive: true },
] as any;

const baseSchedule = (overrides: Record<string, unknown> = {}) => ({
  id: 77,
  userId: 4,
  customerId: 100,
  title: "[TEST] Schedule",
  type: "고객상담",
  status: "예정",
  startTime: new Date("2026-06-10T10:00:00"),
  endTime: new Date("2026-06-10T11:00:00"),
  memo: "[TEST] sensitive memo",
  reminderOffsetMinutes: 30,
  isActive: true,
  ...overrides,
});

describe("scheduleVisibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the current user's schedules", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(activeUsers);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getSchedules").mockImplementation(async filter => {
      if (filter.userId === 4) return [baseSchedule()] as any;
      return [];
    });
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Customer",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);

    const result = await listCalendarSchedules(
      {
        id: 4,
        role: "member",
        teamId: 10,
        subBranchAdminId: 2,
        accountStatus: "active",
      },
      { viewMode: "mine" }
    );

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]?.ownerUserId).toBe(4);
    expect(result.schedules[0]?.canEdit).toBe(true);
    expect(result.schedules[0]?.memo).toBe("[TEST] sensitive memo");
  });

  it("allows sub_branch_admin to view detail links for directly assigned customer schedules", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(activeUsers);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      baseSchedule({ id: 99, userId: 2, customerId: 100 }),
    ] as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Direct Customer",
      agentId: 2,
      assignedTeamId: null,
      subBranchAdminId: null,
      isActive: true,
      deletedAt: null,
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue(activeUsers[1]);

    const result = await listCalendarSchedules(
      {
        id: 2,
        role: "sub_branch_admin",
        teamId: null,
        subBranchAdminId: null,
        accountStatus: "active",
      },
      { viewMode: "mine" }
    );

    expect(result.schedules[0]?.canViewCustomerDetail).toBe(true);
    expect(result.schedules[0]?.customerDisplayName).toBe(
      "[TEST] Direct Customer"
    );
  });

  it("allows a member to view another member's schedules as read-only", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(activeUsers);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getSchedules").mockImplementation(async filter => {
      if (filter.userId === 5)
        return [baseSchedule({ id: 88, userId: 5, customerId: 200 })] as any;
      if (filter.userId === 4) return [baseSchedule()] as any;
      return [];
    });
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 200,
      name: "[TEST] Other Customer",
      agentId: 5,
      assignedTeamId: 20,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);

    const result = await listCalendarSchedules(
      {
        id: 4,
        role: "member",
        teamId: 10,
        subBranchAdminId: 2,
        accountStatus: "active",
      },
      { viewMode: "user", ownerUserId: 5 }
    );

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]?.ownerUserId).toBe(5);
    expect(result.schedules[0]?.canEdit).toBe(false);
    expect(result.schedules[0]?.canDelete).toBe(false);
    expect(result.schedules[0]?.customerDisplayName).toBe("고객 일정");
    expect(result.schedules[0]?.canViewCustomerDetail).toBe(false);
    expect(result.schedules[0]?.memo).toBe("[TEST] sensitive memo");
  });

  it("allows organization-wide schedule viewing for all active users", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(activeUsers);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      baseSchedule({ id: 77, userId: 4 }),
      baseSchedule({ id: 78, userId: 3 }),
      baseSchedule({ id: 79, userId: 99 }),
    ] as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue(null);

    for (const viewer of activeUsers.slice(0, 4)) {
      const result = await listCalendarSchedules(
        viewer,
        { viewMode: "organization" }
      );

      expect(result.schedules.map(item => item.ownerUserId)).toEqual([4, 3]);
      for (const schedule of result.schedules) {
        const canManage =
          viewer.role === "branch_admin" || schedule.ownerUserId === viewer.id;
        expect(schedule.canEdit).toBe(canManage);
        expect(schedule.canDelete).toBe(canManage);
        expect(schedule.memo).toBe("[TEST] sensitive memo");
      }
      expect(result.users.every(user => user.isActive)).toBe(true);
      expect(result.users.some(user => user.userId === 99)).toBe(false);
    }
  });

  it("preserves subordinate customer and memo visibility without granting mutation access", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(activeUsers);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getSchedules").mockResolvedValue([
      baseSchedule({ userId: 4 }),
    ] as any);
    vi.spyOn(db, "getCustomerById").mockResolvedValue({
      id: 100,
      name: "[TEST] Subordinate Customer",
      agentId: 4,
      assignedTeamId: 10,
      subBranchAdminId: 2,
      isActive: true,
      deletedAt: null,
    } as any);

    const result = await listCalendarSchedules(
      {
        id: 2,
        role: "sub_branch_admin",
        teamId: null,
        subBranchAdminId: null,
        accountStatus: "active",
      },
      { viewMode: "organization" }
    );

    expect(result.schedules[0]).toMatchObject({
      customerDisplayName: "[TEST] Subordinate Customer",
      memo: "[TEST] sensitive memo",
      canEdit: false,
      canDelete: false,
    });
  });

  it("filters schedules by team for team view mode", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue(activeUsers);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getSchedules").mockImplementation(async filter => {
      if (filter.userIds?.includes(4) && filter.userIds.includes(3)) {
        return [
          baseSchedule({ userId: 4 }),
          baseSchedule({ id: 78, userId: 3 }),
        ] as any;
      }
      return [];
    });
    vi.spyOn(db, "getCustomerById").mockResolvedValue(null);

    const result = await listCalendarSchedules(
      { id: 1, role: "branch_admin", teamId: null, accountStatus: "active" },
      { viewMode: "team", teamId: 10 }
    );

    expect(result.schedules).toHaveLength(2);
  });

  it("keeps hierarchy reporting scope separate from mutation ownership", async () => {
    vi.spyOn(db, "getSchedules").mockImplementation(async filter => {
      if (filter.userId === 4) return [baseSchedule()] as any;
      if (filter.userIds?.includes(4)) return [baseSchedule()] as any;
      return [];
    });

    const memberAccessible = await getAccessibleSchedules({
      id: 4,
      role: "member",
      teamId: 10,
      accountStatus: "active",
    });
    expect(memberAccessible).toHaveLength(1);

    vi.spyOn(db, "getAllUsers").mockResolvedValue(activeUsers);
    vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
    vi.spyOn(db, "getUsersByTeamId").mockResolvedValue([
      activeUsers[3],
      activeUsers[2],
    ] as any);

    const leaderAccessible = await getAccessibleSchedules({
      id: 3,
      role: "team_leader",
      teamId: 10,
      accountStatus: "active",
    });
    expect(leaderAccessible.length).toBeGreaterThan(0);
    expect(
      canManageSchedule({ id: 3, role: "team_leader" }, { userId: 4 })
    ).toBe(false);
  });

  it.each(["sub_branch_admin", "team_leader", "member"])(
    "allows %s to manage and create only own schedules",
    role => {
      expect(canManageSchedule({ id: 4, role }, { userId: 4 })).toBe(true);
      expect(canManageSchedule({ id: 4, role }, { userId: 5 })).toBe(false);
      expect(canCreateScheduleForUser({ id: 4, role }, 4)).toBe(true);
      expect(canCreateScheduleForUser({ id: 4, role }, 5)).toBe(false);
    }
  );

  it("allows branch_admin to create and manage schedules for other active users", () => {
    expect(
      canManageSchedule({ id: 1, role: "branch_admin" }, { userId: 4 })
    ).toBe(true);
    expect(canCreateScheduleForUser({ id: 1, role: "branch_admin" }, 4)).toBe(
      true
    );
  });
});
