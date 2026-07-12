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
  },
  teams: {
    primary: 9101,
    other: 9102,
  },
  customers: {
    primary: 9201,
  },
  schedules: {
    branchAdmin: 9301,
    subBranchAdmin: 9302,
    teamLeader: 9303,
    member: 9304,
    otherMember: 9305,
    conflict: 9306,
    approval: 9307,
  },
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
  teamLeader: {
    id: CRITICAL_E2E_IDS.users.teamLeader,
    openId: "e2e_team_leader",
    name: "[TEST] 팀장",
    role: "team_leader",
  },
  member: {
    id: CRITICAL_E2E_IDS.users.member,
    openId: "e2e_member",
    name: "[TEST] 팀원",
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
