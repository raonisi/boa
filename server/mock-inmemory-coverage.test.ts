import { describe, expect, it } from "vitest";
import {
  detectForbiddenColumns,
  normalizeBulkImportRow,
  normalizePhone,
} from "./db";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
type AccountStatus = "active" | "inactive" | "resigned";

type TestUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  loginStatus: "invited" | "linked";
  openId: string | null;
  teamId: number | null;
  subBranchAdminId: number | null;
};

type TestCustomer = {
  id: number;
  name: string;
  phone: string;
  agentId: number | null;
  assignedTeamId: number | null;
  subBranchAdminId: number | null;
  assignmentStatus:
    | "unassigned"
    | "assigned_to_sub_branch"
    | "assigned_to_agent";
};

type TestContract = {
  id: number;
  customerId: number;
  agentId: number;
  productGroup: string;
  company: string;
  monthlyPremium: number;
  contractStatus: "청약" | "성립" | "철회" | "유지" | "해지";
  paymentStatus: "정상" | "미납" | "실효" | "해지";
};

type TestSchedule = {
  id: number;
  userId: number;
  teamId: number | null;
  status: "예정" | "완료" | "취소" | "노쇼" | "보류";
};

type TestNotification = {
  id: number;
  userId: number;
  type: string;
  isRead: boolean;
  processStatus: "미확인" | "확인" | "처리완료" | "보류";
  dueAt: Date;
};

const seed = {
  users: [
    {
      id: 1,
      name: "[TEST] branch_admin",
      email: "branch@example.test",
      role: "branch_admin",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-branch",
      teamId: null,
      subBranchAdminId: null,
    },
    {
      id: 10,
      name: "[TEST] sub_branch_admin A",
      email: "sub-a@example.test",
      role: "sub_branch_admin",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-sub-a",
      teamId: null,
      subBranchAdminId: null,
    },
    {
      id: 11,
      name: "[TEST] sub_branch_admin B",
      email: "sub-b@example.test",
      role: "sub_branch_admin",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-sub-b",
      teamId: null,
      subBranchAdminId: null,
    },
    {
      id: 20,
      name: "[TEST] team_leader A",
      email: "leader-a@example.test",
      role: "team_leader",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-leader-a",
      teamId: 100,
      subBranchAdminId: 10,
    },
    {
      id: 21,
      name: "[TEST] team_leader B",
      email: "leader-b@example.test",
      role: "team_leader",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-leader-b",
      teamId: 200,
      subBranchAdminId: 11,
    },
    {
      id: 30,
      name: "[TEST] member A-1",
      email: "member-a1@example.test",
      role: "member",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-member-a1",
      teamId: 100,
      subBranchAdminId: 10,
    },
    {
      id: 31,
      name: "[TEST] member A-2",
      email: "member-a2@example.test",
      role: "member",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-member-a2",
      teamId: 100,
      subBranchAdminId: 10,
    },
    {
      id: 32,
      name: "[TEST] member B-1",
      email: "member-b1@example.test",
      role: "member",
      accountStatus: "active",
      loginStatus: "linked",
      openId: "open-member-b1",
      teamId: 200,
      subBranchAdminId: 11,
    },
    {
      id: 90,
      name: "[TEST] inactive member",
      email: "inactive@example.test",
      role: "member",
      accountStatus: "inactive",
      loginStatus: "invited",
      openId: null,
      teamId: 100,
      subBranchAdminId: 10,
    },
    {
      id: 91,
      name: "[TEST] resigned member",
      email: "resigned@example.test",
      role: "member",
      accountStatus: "resigned",
      loginStatus: "linked",
      openId: "open-resigned",
      teamId: 100,
      subBranchAdminId: 10,
    },
  ] satisfies TestUser[],
  teams: [
    {
      id: 100,
      name: "[TEST] A team",
      managerId: 20,
      subBranchAdminId: 10,
      isActive: true,
    },
    {
      id: 200,
      name: "[TEST] B team",
      managerId: 21,
      subBranchAdminId: 11,
      isActive: true,
    },
  ],
  customers: [
    {
      id: 1000,
      name: "[TEST] customer A-1",
      phone: "010-1000-0001",
      agentId: 30,
      assignedTeamId: 100,
      subBranchAdminId: 10,
      assignmentStatus: "assigned_to_agent",
    },
    {
      id: 1001,
      name: "[TEST] customer A-2",
      phone: "010 1000 0002",
      agentId: 31,
      assignedTeamId: 100,
      subBranchAdminId: 10,
      assignmentStatus: "assigned_to_agent",
    },
    {
      id: 2000,
      name: "[TEST] customer B-1",
      phone: "01010000003",
      agentId: 32,
      assignedTeamId: 200,
      subBranchAdminId: 11,
      assignmentStatus: "assigned_to_agent",
    },
    {
      id: 3000,
      name: "[TEST] unassigned customer",
      phone: "01010000004",
      agentId: null,
      assignedTeamId: null,
      subBranchAdminId: null,
      assignmentStatus: "unassigned",
    },
    {
      id: 3001,
      name: "[TEST] sub-branch A pool customer",
      phone: "01010000005",
      agentId: null,
      assignedTeamId: null,
      subBranchAdminId: 10,
      assignmentStatus: "assigned_to_sub_branch",
    },
  ] satisfies TestCustomer[],
  contracts: [
    {
      id: 5000,
      customerId: 1000,
      agentId: 30,
      productGroup: "diagnosis",
      company: "[TEST] insurer A",
      monthlyPremium: 100000,
      contractStatus: "유지",
      paymentStatus: "정상",
    },
    {
      id: 5001,
      customerId: 1001,
      agentId: 31,
      productGroup: "savings",
      company: "[TEST] insurer A",
      monthlyPremium: 80000,
      contractStatus: "유지",
      paymentStatus: "정상",
    },
    {
      id: 6000,
      customerId: 2000,
      agentId: 32,
      productGroup: "diagnosis",
      company: "[TEST] insurer B",
      monthlyPremium: 120000,
      contractStatus: "해지",
      paymentStatus: "해지",
    },
  ] satisfies TestContract[],
  schedules: [
    { id: 7000, userId: 30, teamId: 100, status: "예정" },
    { id: 7001, userId: 31, teamId: 100, status: "예정" },
    { id: 8000, userId: 32, teamId: 200, status: "예정" },
    { id: 9000, userId: 30, teamId: 100, status: "보류" },
  ] satisfies TestSchedule[],
  notifications: [
    {
      id: 9001,
      userId: 30,
      type: "general",
      isRead: false,
      processStatus: "미확인",
      dueAt: new Date("2026-05-10"),
    },
    {
      id: 9002,
      userId: 31,
      type: "birthday",
      isRead: false,
      processStatus: "확인",
      dueAt: new Date("2026-05-11"),
    },
    {
      id: 9003,
      userId: 32,
      type: "general",
      isRead: true,
      processStatus: "처리완료",
      dueAt: new Date("2026-05-12"),
    },
    {
      id: 9004,
      userId: 30,
      type: "contract_90",
      isRead: false,
      processStatus: "미확인",
      dueAt: new Date("2026-05-13"),
    },
    {
      id: 9005,
      userId: 30,
      type: "contract_365",
      isRead: false,
      processStatus: "미확인",
      dueAt: new Date("2026-05-14"),
    },
    {
      id: 9006,
      userId: 30,
      type: "long_unmanaged_90",
      isRead: false,
      processStatus: "미확인",
      dueAt: new Date("2026-05-15"),
    },
    {
      id: 9007,
      userId: 30,
      type: "schedule_incomplete",
      isRead: false,
      processStatus: "미확인",
      dueAt: new Date("2026-05-16"),
    },
  ] satisfies TestNotification[],
};

function user(id: number): TestUser {
  const found = seed.users.find(item => item.id === id);
  if (!found) throw new Error(`missing user ${id}`);
  return found;
}

function customer(id: number): TestCustomer {
  const found = seed.customers.find(item => item.id === id);
  if (!found) throw new Error(`missing customer ${id}`);
  return found;
}

function userIdsForScope(actor: TestUser): number[] {
  if (actor.accountStatus !== "active") return [];
  if (actor.role === "branch_admin")
    return seed.users
      .filter(item => item.accountStatus === "active")
      .map(item => item.id);
  if (actor.role === "sub_branch_admin")
    return seed.users
      .filter(
        item => item.id === actor.id || item.subBranchAdminId === actor.id
      )
      .map(item => item.id);
  if (actor.role === "team_leader") {
    if (!actor.teamId) return [];
    return seed.users
      .filter(item => item.id === actor.id || item.teamId === actor.teamId)
      .map(item => item.id);
  }
  return [actor.id];
}

function canAccessCustomer(actor: TestUser, target: TestCustomer): boolean {
  if (actor.accountStatus !== "active") return false;
  if (actor.role === "branch_admin") return true;
  if (actor.role === "sub_branch_admin")
    return target.subBranchAdminId === actor.id;
  if (actor.role === "team_leader")
    return actor.teamId !== null && target.assignedTeamId === actor.teamId;
  return target.agentId === actor.id;
}

function canAccessContract(actor: TestUser, contract: TestContract): boolean {
  return (
    canAccessCustomer(actor, customer(contract.customerId)) &&
    (actor.role !== "member" || contract.agentId === actor.id)
  );
}

function canAccessSchedule(actor: TestUser, schedule: TestSchedule): boolean {
  if (actor.accountStatus !== "active") return false;
  if (actor.role === "branch_admin") return true;
  if (actor.role === "sub_branch_admin")
    return user(schedule.userId).subBranchAdminId === actor.id;
  if (actor.role === "team_leader")
    return actor.teamId !== null && schedule.teamId === actor.teamId;
  return schedule.userId === actor.id;
}

function canAccessNotification(
  actor: TestUser,
  notification: TestNotification
): boolean {
  return userIdsForScope(actor).includes(notification.userId);
}

function canAssignCustomer(
  actor: TestUser,
  target: TestCustomer,
  assignee: TestUser
): boolean {
  if (actor.accountStatus !== "active" || assignee.accountStatus !== "active")
    return false;
  if (!["team_leader", "member"].includes(assignee.role)) return false;
  if (actor.role === "branch_admin") return true;
  if (actor.role === "sub_branch_admin") {
    return (
      target.subBranchAdminId === actor.id &&
      assignee.subBranchAdminId === actor.id
    );
  }
  return false;
}

function canAssignToSubBranch(actor: TestUser, assignee: TestUser): boolean {
  return (
    actor.role === "branch_admin" &&
    actor.accountStatus === "active" &&
    assignee.role === "sub_branch_admin" &&
    assignee.accountStatus === "active"
  );
}

function canUseContractAgent(actor: TestUser, assignee: TestUser): boolean {
  if (actor.accountStatus !== "active" || assignee.accountStatus !== "active")
    return false;
  if (!["team_leader", "member"].includes(assignee.role)) return false;
  if (actor.role === "branch_admin") return true;
  if (actor.role === "sub_branch_admin")
    return assignee.subBranchAdminId === actor.id;
  if (actor.role === "team_leader")
    return (
      assignee.id === actor.id ||
      (assignee.role === "member" && assignee.teamId === actor.teamId)
    );
  return assignee.id === actor.id;
}

function performanceContracts(
  actor: TestUser,
  filters: { agentIdFilter?: number; teamIdFilter?: number } = {}
): TestContract[] {
  if (
    filters.agentIdFilter !== undefined &&
    !userIdsForScope(actor).includes(filters.agentIdFilter)
  ) {
    throw new Error("FORBIDDEN");
  }
  if (filters.teamIdFilter !== undefined) {
    if (actor.role === "member") throw new Error("FORBIDDEN");
    if (actor.role === "team_leader" && actor.teamId !== filters.teamIdFilter)
      throw new Error("FORBIDDEN");
    if (actor.role === "sub_branch_admin") {
      const team = seed.teams.find(item => item.id === filters.teamIdFilter);
      if (!team || team.subBranchAdminId !== actor.id)
        throw new Error("FORBIDDEN");
    }
  }
  return seed.contracts.filter(contract => {
    if (!canAccessContract(actor, contract)) return false;
    if (
      filters.agentIdFilter !== undefined &&
      contract.agentId !== filters.agentIdFilter
    )
      return false;
    if (
      filters.teamIdFilter !== undefined &&
      customer(contract.customerId).assignedTeamId !== filters.teamIdFilter
    )
      return false;
    return true;
  });
}

function filterNotifications(
  actor: TestUser,
  filter: {
    processStatus?: string;
    isRead?: boolean;
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  } = {}
) {
  const now = new Date("2026-05-15T12:00:00.000Z");
  const rows = seed.notifications.filter(notification => {
    if (!canAccessNotification(actor, notification)) return false;
    if (notification.dueAt && notification.dueAt > now) return false;
    if (
      filter.processStatus &&
      notification.processStatus !== filter.processStatus
    )
      return false;
    if (filter.isRead !== undefined && notification.isRead !== filter.isRead)
      return false;
    if (filter.type && notification.type !== filter.type) return false;
    if (filter.dateFrom && notification.dueAt < filter.dateFrom) return false;
    if (filter.dateTo && notification.dueAt > filter.dateTo) return false;
    return true;
  });
  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? 50;
  return {
    items: rows.slice(offset, offset + limit),
    totalCount: rows.length,
    hasMore: offset + limit < rows.length,
  };
}

function oauthLogin(
  input: { email: string; openId: string },
  users = seed.users
) {
  const email = input.email.trim().toLowerCase();
  const matches = users.filter(
    item => item.email.trim().toLowerCase() === email
  );
  if (matches.length === 0) return { ok: false, action: "LOGIN_BLOCKED" };
  if (matches.length > 1)
    return { ok: false, action: "USER_OAUTH_LINK_CONFLICT" };
  const target = matches[0];
  if (target.accountStatus !== "active")
    return { ok: false, action: "LOGIN_BLOCKED" };
  if (
    target.openId &&
    !target.openId.startsWith("invited_") &&
    target.openId !== input.openId
  ) {
    return { ok: false, action: "USER_OAUTH_LINK_CONFLICT" };
  }
  return {
    ok: true,
    action: "USER_OAUTH_LINKED",
    user: { ...target, openId: input.openId, loginStatus: "linked" },
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function logDetails(input: {
  actor: number;
  targetId: number | null;
  targetType: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  metadata?: unknown;
}) {
  return {
    actor: input.actor,
    targetId: input.targetId,
    targetType: input.targetType,
    beforeValue: input.beforeValue ?? {},
    afterValue: input.afterValue ?? {},
    metadata: input.metadata ?? {},
  };
}

describe("mock in-memory RBAC coverage", () => {
  it("keeps seeded organization relationships internally consistent", () => {
    expect(seed.users.every(item => item.name.startsWith("[TEST]"))).toBe(true);
    expect(user(20).teamId).toBe(100);
    expect(user(20).subBranchAdminId).toBe(seed.teams[0].subBranchAdminId);
    expect(user(21).teamId).toBe(200);
    expect(user(21).subBranchAdminId).toBe(seed.teams[1].subBranchAdminId);
  });

  it("enforces customer, contract, schedule, and notification scopes", () => {
    expect(
      seed.customers.filter(item => canAccessCustomer(user(1), item))
    ).toHaveLength(5);
    expect(
      seed.customers
        .filter(item => canAccessCustomer(user(10), item))
        .map(item => item.id)
    ).toEqual([1000, 1001, 3001]);
    expect(canAccessCustomer(user(10), customer(2000))).toBe(false);
    expect(canAccessCustomer(user(20), customer(2000))).toBe(false);
    expect(canAccessCustomer(user(30), customer(1001))).toBe(false);
    expect(canAccessContract(user(30), seed.contracts[1])).toBe(false);
    expect(canAccessSchedule(user(20), seed.schedules[2])).toBe(false);
    expect(canAccessNotification(user(30), seed.notifications[1])).toBe(false);
    expect(canAccessCustomer(user(90), customer(1000))).toBe(false);
    expect(canAccessCustomer(user(91), customer(1000))).toBe(false);
  });

  it("prevents null team or inactive status from expanding access", () => {
    const leaderWithoutTeam: TestUser = { ...user(20), id: 120, teamId: null };
    expect(
      seed.customers.filter(item => canAccessCustomer(leaderWithoutTeam, item))
    ).toEqual([]);
    expect(
      seed.schedules.filter(item => canAccessSchedule(leaderWithoutTeam, item))
    ).toEqual([]);
    expect(userIdsForScope({ ...user(10), accountStatus: "inactive" })).toEqual(
      []
    );
  });

  it("enforces DB assignment target role, status, and organization rules", () => {
    expect(canAssignToSubBranch(user(1), user(10))).toBe(true);
    expect(canAssignToSubBranch(user(1), user(90))).toBe(false);
    expect(canAssignCustomer(user(1), customer(3000), user(30))).toBe(true);
    expect(canAssignCustomer(user(10), customer(3001), user(30))).toBe(true);
    expect(canAssignCustomer(user(10), customer(3001), user(32))).toBe(false);
    expect(canAssignCustomer(user(20), customer(1000), user(30))).toBe(false);
    expect(canAssignCustomer(user(30), customer(1000), user(30))).toBe(false);
  });
});

describe("mock OAuth pre-registration coverage", () => {
  it("links only a pre-registered active user", () => {
    const invited: TestUser = {
      ...user(30),
      openId: "invited_test_member_a1",
      loginStatus: "invited",
    };
    const result = oauthLogin(
      { email: " MEMBER-A1@EXAMPLE.TEST ", openId: "oauth-member-a1" },
      [invited]
    );
    expect(result).toMatchObject({ ok: true, action: "USER_OAUTH_LINKED" });
    expect(result.user?.openId).toBe("oauth-member-a1");
  });

  it("blocks unregistered, duplicate, inactive, resigned, and openId overwrite cases", () => {
    expect(
      oauthLogin({ email: "unknown@example.test", openId: "x" })
    ).toMatchObject({ ok: false, action: "LOGIN_BLOCKED" });
    expect(
      oauthLogin({ email: "inactive@example.test", openId: "x" })
    ).toMatchObject({ ok: false, action: "LOGIN_BLOCKED" });
    expect(
      oauthLogin({ email: "resigned@example.test", openId: "x" })
    ).toMatchObject({ ok: false, action: "LOGIN_BLOCKED" });
    expect(
      oauthLogin({
        email: "member-a1@example.test",
        openId: "different-open-id",
      })
    ).toMatchObject({ ok: false, action: "USER_OAUTH_LINK_CONFLICT" });
    expect(
      oauthLogin({ email: "dup@example.test", openId: "x" }, [
        { ...user(30), email: "dup@example.test" },
        { ...user(31), email: "dup@example.test" },
      ])
    ).toMatchObject({ ok: false, action: "USER_OAUTH_LINK_CONFLICT" });
  });
});

describe("mock contract and performance coverage", () => {
  it("enforces contract agent target rules and owner-change audit fields", () => {
    expect(canUseContractAgent(user(1), user(30))).toBe(true);
    expect(canUseContractAgent(user(1), user(10))).toBe(false);
    expect(canUseContractAgent(user(1), user(90))).toBe(false);
    expect(canUseContractAgent(user(10), user(30))).toBe(true);
    expect(canUseContractAgent(user(10), user(32))).toBe(false);
    expect(canUseContractAgent(user(20), user(31))).toBe(true);
    expect(canUseContractAgent(user(20), user(32))).toBe(false);
    expect(canUseContractAgent(user(30), user(31))).toBe(false);

    const details = logDetails({
      actor: 1,
      targetId: 5000,
      targetType: "contract",
      beforeValue: { previousAgentId: 30 },
      afterValue: { newAgentId: 31 },
    });
    expect(details.beforeValue).toEqual({ previousAgentId: 30 });
    expect(details.afterValue).toEqual({ newAgentId: 31 });
  });

  it("aggregates performance from contracts without manual, converted, or commission fields", () => {
    expect(performanceContracts(user(1))).toHaveLength(3);
    expect(performanceContracts(user(10))).toHaveLength(2);
    expect(performanceContracts(user(20), { teamIdFilter: 100 })).toHaveLength(
      2
    );
    expect(() => performanceContracts(user(20), { teamIdFilter: 200 })).toThrow(
      "FORBIDDEN"
    );
    expect(() => performanceContracts(user(30), { agentIdFilter: 31 })).toThrow(
      "FORBIDDEN"
    );

    const stats = performanceContracts(user(10)).reduce(
      (acc, contract) => ({
        count: acc.count + 1,
        monthlyPremium: acc.monthlyPremium + contract.monthlyPremium,
      }),
      { count: 0, monthlyPremium: 0 }
    );
    expect(stats).toEqual({ count: 2, monthlyPremium: 180000 });
    expect(
      seed.contracts.some(
        contract =>
          "commission" in contract || "convertedPerformance" in contract
      )
    ).toBe(false);
  });
});

describe("mock schedule and notification coverage", () => {
  it("enforces target user boundaries for schedule creation/update/delete checks", () => {
    expect(userIdsForScope(user(1))).toEqual(
      expect.arrayContaining([30, 31, 32])
    );
    expect(userIdsForScope(user(10))).toEqual(expect.arrayContaining([30, 31]));
    expect(userIdsForScope(user(10))).not.toContain(32);
    expect(userIdsForScope(user(20))).toEqual(
      expect.arrayContaining([20, 30, 31])
    );
    expect(userIdsForScope(user(20))).not.toContain(32);
    expect(userIdsForScope(user(30))).toEqual([30]);
    expect(canAccessSchedule(user(30), seed.schedules[1])).toBe(false);
  });

  it("applies notification filters and pagination inside the actor scope", () => {
    const memberResult = filterNotifications(user(30), {
      isRead: false,
      limit: 2,
    });
    expect(
      memberResult.items.map(item => item.userId).every(id => id === 30)
    ).toBe(true);
    expect(memberResult.hasMore).toBe(true);

    const leaderFiltered = filterNotifications(user(20), {
      processStatus: "미확인",
      type: "contract_90",
      dateFrom: new Date("2026-05-13"),
      dateTo: new Date("2026-05-13"),
    });
    expect(leaderFiltered.items).toHaveLength(1);
    expect(leaderFiltered.totalCount).toBe(1);
    expect(canAccessNotification(user(20), seed.notifications[2])).toBe(false);
  });

  it("hides future dueAt notifications from list/count while keeping dueAt null visible", () => {
    const actor = user(30);
    const base = filterNotifications(actor, { isRead: false });
    const unreadVisibleCount = base.items.length;

    seed.notifications.push(
      {
        id: 9991,
        userId: 30,
        type: "general",
        isRead: false,
        processStatus: "미확인",
        dueAt: new Date("2026-05-20T09:00:00.000Z"),
      },
      {
        id: 9992,
        userId: 30,
        type: "general",
        isRead: false,
        processStatus: "미확인",
        dueAt: new Date("2026-05-15T08:00:00.000Z"),
      },
      {
        id: 9993,
        userId: 30,
        type: "general",
        isRead: false,
        processStatus: "미확인",
        dueAt: null as unknown as Date,
      }
    );

    const result = filterNotifications(actor, { isRead: false, limit: 100 });
    const ids = result.items.map(item => item.id);
    expect(ids).not.toContain(9991); // 미래 dueAt 숨김
    expect(ids).toContain(9992); // 현재 이하 dueAt 노출
    expect(ids).toContain(9993); // dueAt null 노출 유지
    expect(result.totalCount).toBe(unreadVisibleCount + 2);
  });

  it("models expected reminder types and duplicate-prevention key", () => {
    const reminderKeys = new Set<string>();
    for (const item of seed.notifications.filter(
      notification => notification.userId === 30
    )) {
      if (!item.dueAt) continue;
      const key = `${item.userId}:${item.type}:${item.dueAt.toISOString()}`;
      expect(reminderKeys.has(key)).toBe(false);
      reminderKeys.add(key);
    }
    expect(seed.notifications.map(item => item.type)).toEqual(
      expect.arrayContaining([
        "contract_90",
        "contract_365",
        "birthday",
        "long_unmanaged_90",
        "schedule_incomplete",
      ])
    );
  });
});

describe("mock bulk import and settings option coverage", () => {
  it("normalizes Korean bulk import headers and phone values", () => {
    const row = normalizeBulkImportRow({
      이름: "[TEST] bulk customer",
      연락처: "010 1234 5678",
      생년월일: "1990-01-01",
      성별: "남",
      지역: "서울",
      예상보험료: "10",
      통화가능시간: "evening",
      유입경로: "test",
      "DB 업체명": "렌선",
      상담상태: "미상담",
      메모: "[TEST] memo",
      부지점장: "[TEST] sub_branch_admin A",
      팀: "[TEST] A team",
      담당자: "[TEST] member A-1",
    });
    expect(row).toMatchObject({
      name: "[TEST] bulk customer",
      phone: "010 1234 5678",
      dbCompany: "렌선",
    });
    expect(normalizePhone(row.phone ?? "")).toBe("01012345678");
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone("01012345678")).toBe("01012345678");
  });

  it("blocks forbidden bulk import columns by header only", () => {
    const forbidden = detectForbiddenColumns([
      "이름",
      "연락처",
      "주민등록번호",
      "주민번호",
      "증권번호",
      "신분증",
      "병력상세",
      "계좌번호",
      "카드번호",
    ]);
    expect(forbidden).toEqual(
      expect.arrayContaining([
        "주민등록번호",
        "주민번호",
        "증권번호",
        "신분증",
        "병력상세",
        "계좌번호",
        "카드번호",
      ])
    );
  });

  it("keeps form options active-only and minimal", () => {
    const settings = [
      {
        id: 1,
        category: "region",
        value: "서울",
        isActive: true,
        createdBy: 1,
      },
      {
        id: 2,
        category: "region",
        value: "비활성",
        isActive: false,
        createdBy: 1,
      },
      {
        id: 3,
        category: "productGroup",
        value: "진단비",
        isActive: true,
        createdBy: 1,
      },
      {
        id: 4,
        category: "scheduleType",
        value: "고객상담",
        isActive: true,
        createdBy: 1,
      },
    ];
    const formOptions = (category: string) =>
      settings
        .filter(item => item.category === category && item.isActive)
        .map(item => ({
          category: item.category,
          value: item.value,
          label: item.value,
        }));

    expect(formOptions("region")).toEqual([
      { category: "region", value: "서울", label: "서울" },
    ]);
    expect(Object.keys(formOptions("productGroup")[0]).sort()).toEqual([
      "category",
      "label",
      "value",
    ]);
    expect(JSON.stringify(formOptions("scheduleType"))).not.toContain(
      "createdBy"
    );
  });
});

describe("mock log privacy and security regression coverage", () => {
  it("uses a standard log envelope and masks direct identifiers", () => {
    const details = logDetails({
      actor: 1,
      targetId: 30,
      targetType: "user",
      beforeValue: { role: "member" },
      afterValue: {
        role: "team_leader",
        email: maskEmail("member-a1@example.test"),
      },
      metadata: { reason: "test" },
    });
    expect(details).toMatchObject({
      actor: 1,
      targetId: 30,
      targetType: "user",
    });
    expect(JSON.stringify(details)).toContain("me***@example.test");
    expect(JSON.stringify(details)).not.toContain("member-a1@example.test");
    expect(JSON.stringify(details)).not.toContain("memo");
  });

  it("keeps prohibited fields out of the CRM model keys used by the test seed", () => {
    const forbiddenKeys = [
      "residentRegistrationNumber",
      "policyNumber",
      "idCardImage",
      "medicalDetail",
      "accountNumber",
      "cardNumber",
      "hardDelete",
    ];
    const modelText = JSON.stringify(seed);
    for (const key of forbiddenKeys) {
      expect(modelText).not.toContain(key);
    }
  });
});
