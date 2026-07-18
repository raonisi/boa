import path from "node:path";

export const CRITICAL_E2E_DATABASE = "boa_e2e";

export const CRITICAL_E2E_IDS = {
  users: {
    branchAdmin: 9001,
    subBranchAdmin: 9002,
    teamLeader: 9003,
    member: 9004,
    otherTeamLeader: 9005,
    otherMember: 9006,
    inactive: 9007,
    resigned: 9008,
    subBranchAdminB: 9009,
    teamLeaderB: 9010,
    memberB: 9011,
  },
  teams: {
    primary: 9101,
    other: 9102,
    branchB: 9103,
  },
  customers: {
    primary: 9201,
    deleted: 9202,
    merged: 9203,
    outsideTeam: 9204,
    inactive: 9205,
    unassignedTeamA1Database: 9206,
    unassignedTeamA1Contracted: 9207,
    unassignedTeamA2: 9208,
    unassignedTeamB1: 9209,
    unassignedNoOrganization: 9210,
    unassignedTeamA1BulkStart: 9211,
  },
  schedules: {
    branchAdmin: 9301,
    subBranchAdmin: 9302,
    teamLeader: 9303,
    member: 9304,
    otherMember: 9305,
    conflict: 9306,
    approval: 9307,
    deleted: 9308,
  },
  contracts: {
    active: 9401,
    deleted: 9402,
    unassignedActive: 9403,
  },
  followUps: {
    active: 9501,
    deleted: 9502,
  },
  notifications: {
    activeUncontacted: 9601,
    activeLongUnmanaged: 9602,
    activeReconsult: 9603,
    completedReconsult: 9604,
    deletedCustomer: 9605,
    mergedCustomer: 9606,
    activeContract: 9607,
    deletedContract: 9608,
    activeSchedule: 9609,
    deletedSchedule: 9610,
    activeFollowUp: 9611,
    deletedFollowUp: 9612,
    missingSource: 9613,
    otherMember: 9614,
    teamLeader: 9615,
    subBranchAdmin: 9616,
    branchAdmin: 9617,
    inactive: 9618,
    outsideSource: 9619,
    inactiveCustomer: 9620,
    bulkStart: 9700,
  },
  deleteRequests: {
    pending: 11101,
  },
  activityLogs: {
    deleteRequested: 11201,
  },
} as const;

export const CRITICAL_E2E_BULK_NOTIFICATION_COUNT = 1001;
export const CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS = {
  memberTotal: 15,
  memberUnread: 13,
  teamLeaderScopedTotal: 16,
  teamLeaderScopedUnread: 14,
  subBranchScopedTotal: 18,
  subBranchScopedUnread: 16,
  branchTotal: 1021,
  branchUnread: 1019,
  memberActionRequired: 6,
  memberSourceAvailable: 7,
} as const;

export const CRITICAL_E2E_USERS = {
  branchAdmin: {
    id: CRITICAL_E2E_IDS.users.branchAdmin,
    openId: "e2e_branch_admin",
    name: "[TEST] 지점장",
    role: "branch_admin",
  },
  subBranchAdmin: {
    id: CRITICAL_E2E_IDS.users.subBranchAdmin,
    openId: "e2e_sub_branch_admin",
    name: "[TEST] 부지점장",
    role: "sub_branch_admin",
  },
  subBranchAdminB: {
    id: CRITICAL_E2E_IDS.users.subBranchAdminB,
    openId: "e2e_sub_branch_admin_b",
    name: "[TEST] Sub Branch B",
    role: "sub_branch_admin",
  },
  teamLeader: {
    id: CRITICAL_E2E_IDS.users.teamLeader,
    openId: "e2e_team_leader",
    name: "[TEST] 팀장",
    role: "team_leader",
  },
  otherTeamLeader: {
    id: CRITICAL_E2E_IDS.users.otherTeamLeader,
    openId: "e2e_other_team_leader",
    name: "[TEST] Team Leader A2",
    role: "team_leader",
  },
  teamLeaderB: {
    id: CRITICAL_E2E_IDS.users.teamLeaderB,
    openId: "e2e_team_leader_b",
    name: "[TEST] Team Leader B1",
    role: "team_leader",
  },
  member: {
    id: CRITICAL_E2E_IDS.users.member,
    openId: "e2e_member",
    name: "[TEST] 팀원",
    role: "member",
  },
  inactive: {
    id: CRITICAL_E2E_IDS.users.inactive,
    openId: "e2e_inactive",
    name: "[TEST] Inactive",
    role: "member",
  },
  resigned: {
    id: CRITICAL_E2E_IDS.users.resigned,
    openId: "e2e_resigned",
    name: "[TEST] Resigned",
    role: "member",
  },
} as const;

export type CriticalE2ERole = keyof typeof CRITICAL_E2E_USERS;

export const CRITICAL_E2E_AUTH_DIR = path.resolve("e2e/.auth");

export function criticalE2EStorageState(role: CriticalE2ERole) {
  return path.join(CRITICAL_E2E_AUTH_DIR, `${role}.json`);
}

export function assertCriticalE2EEnvironment() {
  if (process.env.E2E_TEST_MODE !== "true") {
    throw new Error("E2E_TEST_MODE=true is required for critical E2E setup");
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required for critical E2E");

  const databaseUrl = new URL(rawUrl);
  const databaseName = databaseUrl.pathname.replace(/^\//, "");
  const isLocalHost = new Set(["127.0.0.1", "localhost", "::1"]).has(
    databaseUrl.hostname
  );
  if (!isLocalHost || databaseName !== CRITICAL_E2E_DATABASE) {
    throw new Error(
      "Critical E2E only accepts the local disposable boa_e2e database"
    );
  }
}
