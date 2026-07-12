import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import {
  assertCriticalE2EEnvironment,
  CRITICAL_E2E_IDS,
} from "../e2e/critical/fixtures";

const ids = CRITICAL_E2E_IDS;

const userRows = [
  [
    ids.users.branchAdmin,
    "e2e_branch_admin",
    "[TEST] 지점장",
    "branch_admin",
    "active",
    null,
    null,
    null,
  ],
  [
    ids.users.subBranchAdmin,
    "e2e_sub_branch_admin",
    "[TEST] 부지점장",
    "sub_branch_admin",
    "active",
    ids.users.branchAdmin,
    null,
    null,
  ],
  [
    ids.users.teamLeader,
    "e2e_team_leader",
    "[TEST] 팀장",
    "team_leader",
    "active",
    ids.users.subBranchAdmin,
    ids.teams.primary,
    ids.users.subBranchAdmin,
  ],
  [
    ids.users.member,
    "e2e_member",
    "[TEST] 팀원",
    "member",
    "active",
    ids.users.teamLeader,
    ids.teams.primary,
    ids.users.subBranchAdmin,
  ],
  [
    ids.users.otherTeamLeader,
    "e2e_other_team_leader",
    "[TEST] 타팀장",
    "team_leader",
    "active",
    ids.users.subBranchAdmin,
    ids.teams.other,
    ids.users.subBranchAdmin,
  ],
  [
    ids.users.otherMember,
    "e2e_other_member",
    "[TEST] 타팀원",
    "member",
    "active",
    ids.users.otherTeamLeader,
    ids.teams.other,
    ids.users.subBranchAdmin,
  ],
  [
    ids.users.inactive,
    "e2e_inactive",
    "[TEST] 비활성",
    "member",
    "inactive",
    ids.users.teamLeader,
    ids.teams.primary,
    ids.users.subBranchAdmin,
  ],
  [
    ids.users.resigned,
    "e2e_resigned",
    "[TEST] 퇴사",
    "member",
    "resigned",
    ids.users.teamLeader,
    ids.teams.primary,
    ids.users.subBranchAdmin,
  ],
] as const;

const scheduleRows = [
  [
    ids.schedules.branchAdmin,
    ids.users.branchAdmin,
    null,
    "[TEST] 지점장 일정",
    "조직 일정 조회 검증",
  ],
  [
    ids.schedules.subBranchAdmin,
    ids.users.subBranchAdmin,
    null,
    "[TEST] 부지점장 일정",
    "조직 일정 조회 검증",
  ],
  [
    ids.schedules.teamLeader,
    ids.users.teamLeader,
    null,
    "[TEST] 팀장 일정",
    "요청 대기 상태 검증",
  ],
  [
    ids.schedules.member,
    ids.users.member,
    ids.customers.primary,
    "[TEST] 팀원 고객 일정",
    "[TEST] 합성 상담내용",
  ],
  [
    ids.schedules.otherMember,
    ids.users.otherMember,
    null,
    "[TEST] 타팀원 일정",
    "권한 밖 요청 검증",
  ],
  [
    ids.schedules.conflict,
    ids.users.teamLeader,
    null,
    "[TEST] 충돌 대상 일정",
    "승인 충돌 검증",
  ],
  [
    ids.schedules.approval,
    ids.users.teamLeader,
    null,
    "[TEST] 승인 대상 일정",
    "승인 자동반영 검증",
  ],
] as const;

export async function seedCriticalE2E() {
  assertCriticalE2EEnvironment();
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  startAt.setMinutes(0, 0, 0);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

  try {
    await connection.beginTransaction();

    await connection.execute(
      "DELETE FROM schedule_change_requests WHERE requesterId BETWEEN 9001 AND 9008 OR targetUserId BETWEEN 9001 AND 9008"
    );
    await connection.execute(
      "DELETE FROM notifications WHERE userId BETWEEN 9001 AND 9008"
    );
    await connection.execute(
      "DELETE FROM reminders WHERE userId BETWEEN 9001 AND 9008"
    );
    await connection.execute(
      "DELETE FROM activity_logs WHERE userId BETWEEN 9001 AND 9008"
    );
    await connection.execute(
      "DELETE FROM schedules WHERE id BETWEEN 9301 AND 9307"
    );
    await connection.execute("DELETE FROM customers WHERE id = ?", [
      ids.customers.primary,
    ]);
    await connection.execute(
      "DELETE FROM users WHERE id BETWEEN 9001 AND 9008"
    );
    await connection.execute(
      "DELETE FROM teams WHERE id BETWEEN 9101 AND 9102"
    );

    await connection.execute(
      "INSERT INTO teams (id, name, managerId, subBranchAdminId, isActive) VALUES (?, ?, ?, ?, true), (?, ?, ?, ?, true)",
      [
        ids.teams.primary,
        "[TEST] 1팀",
        ids.users.teamLeader,
        ids.users.subBranchAdmin,
        ids.teams.other,
        "[TEST] 2팀",
        ids.users.otherTeamLeader,
        ids.users.subBranchAdmin,
      ]
    );

    for (const row of userRows) {
      await connection.execute(
        `INSERT INTO users
        (id, openId, name, email, loginMethod, role, accountStatus, loginStatus, parentUserId, teamId, subBranchAdminId)
       VALUES (?, ?, ?, ?, 'google', ?, ?, 'linked', ?, ?, ?)`,
        [
          row[0],
          row[1],
          row[2],
          `${row[1]}@example.test`,
          row[3],
          row[4],
          row[5],
          row[6],
          row[7],
        ]
      );
    }

    await connection.execute(
      `INSERT INTO customers
      (id, name, phone, source, agentId, assignedTeamId, assignedAt,
       subBranchAdminId, assignmentStatus, consultStatus, priority,
       privacyConsent, marketingConsent, isActive, createdBy)
     VALUES (?, '[TEST] E2E 고객 A', NULL, '[TEST] 합성 유입', ?, ?, NOW(), ?,
       'assigned_to_agent', '상담예정', 'B', false, false, true, ?)`,
      [
        ids.customers.primary,
        ids.users.member,
        ids.teams.primary,
        ids.users.subBranchAdmin,
        ids.users.branchAdmin,
      ]
    );

    for (const row of scheduleRows) {
      await connection.execute(
        `INSERT INTO schedules
        (id, userId, teamId, customerId, title, description, type, status,
         startTime, endTime, calendarCategory, reminderOffsetMinutes,
         isActive, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, '고객상담', '예정', ?, ?,
         'consultation_followup', -1, true, ?)`,
        [
          row[0],
          row[1],
          row[1] === ids.users.branchAdmin ||
          row[1] === ids.users.subBranchAdmin
            ? null
            : row[1] === ids.users.otherMember
              ? ids.teams.other
              : ids.teams.primary,
          row[2],
          row[3],
          row[4],
          startAt,
          endAt,
          row[1],
        ]
      );
    }

    await connection.commit();
    console.info("[e2e-seed] critical synthetic fixtures ready", {
      userCount: userRows.length,
      scheduleCount: scheduleRows.length,
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await seedCriticalE2E();
}
