import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import {
  assertCriticalE2EEnvironment,
  CRITICAL_E2E_BULK_NOTIFICATION_COUNT,
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
      "DELETE FROM delete_requests WHERE id = ? OR requestedBy BETWEEN 9001 AND 9008",
      [ids.deleteRequests.pending]
    );
    await connection.execute(
      "DELETE FROM follow_ups WHERE id BETWEEN 9501 AND 9502"
    );
    await connection.execute(
      "DELETE FROM contracts WHERE id BETWEEN 9401 AND 9402"
    );
    await connection.execute(
      "DELETE FROM schedules WHERE id BETWEEN 9301 AND 9308"
    );
    await connection.execute(
      "DELETE FROM customers WHERE id BETWEEN 9201 AND 9205"
    );
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

    await connection.execute(
      `INSERT INTO customers
      (id, name, source, agentId, assignedTeamId, assignedAt,
       subBranchAdminId, assignmentStatus, consultStatus, priority,
       privacyConsent, marketingConsent, isActive, createdBy)
     VALUES (?, '[TEST] 비활성 고객', '[TEST] 합성 유입', ?, ?, NOW(), ?,
       'assigned_to_agent', '보류', 'C', false, false, false, ?)`,
      [
        ids.customers.inactive,
        ids.users.member,
        ids.teams.primary,
        ids.users.subBranchAdmin,
        ids.users.branchAdmin,
      ]
    );

    await connection.execute(
      `INSERT INTO customers
      (id, name, source, agentId, assignedTeamId, assignedAt,
       subBranchAdminId, assignmentStatus, consultStatus, priority,
       privacyConsent, marketingConsent, isActive, deletedAt, createdBy)
     VALUES (?, '[TEST] 삭제 고객', '[TEST] 합성 유입', ?, ?, NOW(), ?,
       'assigned_to_agent', '보류', 'C', false, false, false, NOW(), ?)`,
      [
        ids.customers.deleted,
        ids.users.member,
        ids.teams.primary,
        ids.users.subBranchAdmin,
        ids.users.branchAdmin,
      ]
    );

    await connection.execute(
      `INSERT INTO customers
      (id, name, source, agentId, assignedTeamId, assignedAt,
       subBranchAdminId, assignmentStatus, consultStatus, priority,
       privacyConsent, marketingConsent, isActive, mergedIntoCustomerId,
       mergedAt, mergedBy, createdBy)
     VALUES (?, '[TEST] 병합 고객', '[TEST] 합성 유입', ?, ?, NOW(), ?,
       'assigned_to_agent', '보류', 'C', false, false, false, ?, NOW(), ?, ?)`,
      [
        ids.customers.merged,
        ids.users.member,
        ids.teams.primary,
        ids.users.subBranchAdmin,
        ids.customers.primary,
        ids.users.branchAdmin,
        ids.users.branchAdmin,
      ]
    );

    await connection.execute(
      `INSERT INTO customers
      (id, name, source, agentId, assignedTeamId, assignedAt,
       subBranchAdminId, assignmentStatus, consultStatus, priority,
       privacyConsent, marketingConsent, isActive, createdBy)
     VALUES (?, '[TEST] 타팀 고객', '[TEST] 합성 유입', ?, ?, NOW(), ?,
       'assigned_to_agent', '상담예정', 'B', false, false, true, ?)`,
      [
        ids.customers.outsideTeam,
        ids.users.otherMember,
        ids.teams.other,
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

    await connection.execute(
      `INSERT INTO schedules
      (id, userId, teamId, customerId, title, description, type, status,
       startTime, endTime, calendarCategory, reminderOffsetMinutes,
       isActive, deletedAt, createdBy)
     VALUES (?, ?, ?, ?, '[TEST] 삭제 일정', '[TEST] 삭제 소스', '고객상담',
       '예정', ?, ?, 'consultation_followup', -1, false, NOW(), ?)`,
      [
        ids.schedules.deleted,
        ids.users.member,
        ids.teams.primary,
        ids.customers.primary,
        startAt,
        endAt,
        ids.users.member,
      ]
    );

    await connection.execute(
      `INSERT INTO contracts
      (id, customerId, agentId, company, productName, productGroup,
       paymentStatus, contractStatus, isActive, createdBy)
     VALUES (?, ?, ?, '[TEST] 보험사', '[TEST] 합성 상품', '[TEST] 합성',
       '미납', '유지', true, ?)`,
      [
        ids.contracts.active,
        ids.customers.primary,
        ids.users.member,
        ids.users.branchAdmin,
      ]
    );
    await connection.execute(
      `INSERT INTO contracts
      (id, customerId, agentId, company, productName, productGroup,
       paymentStatus, contractStatus, isActive, deletedAt, createdBy)
     VALUES (?, ?, ?, '[TEST] 보험사', '[TEST] 삭제 상품', '[TEST] 합성',
       '미납', '유지', false, NOW(), ?)`,
      [
        ids.contracts.deleted,
        ids.customers.primary,
        ids.users.member,
        ids.users.branchAdmin,
      ]
    );

    await connection.execute(
      `INSERT INTO follow_ups
      (id, customerId, assignedAgentId, teamId, subBranchAdminId,
       nextContactDate, reason, nextAction, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, '[TEST] 후속관리', '전화', 'scheduled', ?)`,
      [
        ids.followUps.active,
        ids.customers.primary,
        ids.users.member,
        ids.teams.primary,
        ids.users.subBranchAdmin,
        startAt,
        ids.users.member,
      ]
    );
    await connection.execute(
      `INSERT INTO follow_ups
      (id, customerId, assignedAgentId, teamId, subBranchAdminId,
       nextContactDate, reason, nextAction, status, createdBy, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, '[TEST] 삭제 후속관리', '전화', 'scheduled', ?, NOW())`,
      [
        ids.followUps.deleted,
        ids.customers.primary,
        ids.users.member,
        ids.teams.primary,
        ids.users.subBranchAdmin,
        startAt,
        ids.users.member,
      ]
    );

    const notificationRows = [
      [
        ids.notifications.activeUncontacted,
        ids.users.member,
        "uncontacted_3days",
        "customer",
        ids.customers.primary,
        false,
        "미확인",
      ],
      [
        ids.notifications.activeLongUnmanaged,
        ids.users.member,
        "long_unmanaged_90",
        "customer",
        ids.customers.primary,
        true,
        "확인",
      ],
      [
        ids.notifications.activeReconsult,
        ids.users.member,
        "reconsult",
        "customer",
        ids.customers.primary,
        false,
        "보류",
      ],
      [
        ids.notifications.completedReconsult,
        ids.users.member,
        "reconsult",
        "customer",
        ids.customers.primary,
        true,
        "처리완료",
      ],
      [
        ids.notifications.deletedCustomer,
        ids.users.member,
        "uncontacted_3days",
        "customer",
        ids.customers.deleted,
        false,
        "미확인",
      ],
      [
        ids.notifications.mergedCustomer,
        ids.users.member,
        "long_unmanaged_90",
        "customer",
        ids.customers.merged,
        false,
        "미확인",
      ],
      [
        ids.notifications.activeContract,
        ids.users.member,
        "unpaid_lapse",
        "contract",
        ids.contracts.active,
        false,
        "미확인",
      ],
      [
        ids.notifications.deletedContract,
        ids.users.member,
        "unpaid_lapse",
        "contract",
        ids.contracts.deleted,
        false,
        "미확인",
      ],
      [
        ids.notifications.activeSchedule,
        ids.users.member,
        "schedule_incomplete",
        "schedule",
        ids.schedules.member,
        false,
        "미확인",
      ],
      [
        ids.notifications.deletedSchedule,
        ids.users.member,
        "schedule_incomplete",
        "schedule",
        ids.schedules.deleted,
        false,
        "미확인",
      ],
      [
        ids.notifications.activeFollowUp,
        ids.users.member,
        "general",
        "follow_up",
        ids.followUps.active,
        false,
        "미확인",
      ],
      [
        ids.notifications.deletedFollowUp,
        ids.users.member,
        "general",
        "follow_up",
        ids.followUps.deleted,
        false,
        "미확인",
      ],
      [
        ids.notifications.missingSource,
        ids.users.member,
        "general",
        "customer",
        999999,
        false,
        "미확인",
      ],
      [
        ids.notifications.otherMember,
        ids.users.otherMember,
        "general",
        "customer",
        ids.customers.outsideTeam,
        false,
        "미확인",
      ],
      [
        ids.notifications.teamLeader,
        ids.users.teamLeader,
        "general",
        null,
        null,
        false,
        "미확인",
      ],
      [
        ids.notifications.subBranchAdmin,
        ids.users.subBranchAdmin,
        "general",
        null,
        null,
        false,
        "미확인",
      ],
      [
        ids.notifications.branchAdmin,
        ids.users.branchAdmin,
        "general",
        null,
        null,
        false,
        "미확인",
      ],
      [
        ids.notifications.inactive,
        ids.users.inactive,
        "general",
        null,
        null,
        false,
        "미확인",
      ],
      [
        ids.notifications.outsideSource,
        ids.users.member,
        "general",
        "customer",
        ids.customers.outsideTeam,
        false,
        "미확인",
      ],
      [
        ids.notifications.inactiveCustomer,
        ids.users.member,
        "uncontacted_3days",
        "customer",
        ids.customers.inactive,
        false,
        "미확인",
      ],
    ] as const;

    for (const row of notificationRows) {
      await connection.execute(
        `INSERT INTO notifications
        (id, userId, type, title, message, relatedType, relatedId,
         isRead, processStatus)
       VALUES (?, ?, ?, '[TEST] 합성 알림', '[TEST] 민감정보 없는 검증 알림', ?, ?, ?, ?)`,
        row
      );
    }

    const bulkPlaceholders = Array.from(
      { length: CRITICAL_E2E_BULK_NOTIFICATION_COUNT },
      () =>
        "(?, ?, 'general', '[TEST] 대량 알림', '[TEST] 집계 검증', 'e2e_bulk', ?, false, '미확인')"
    ).join(", ");
    const bulkValues = Array.from(
      { length: CRITICAL_E2E_BULK_NOTIFICATION_COUNT },
      (_, index) => [
        ids.notifications.bulkStart + index,
        ids.users.inactive,
        index + 1,
      ]
    ).flat();
    await connection.execute(
      `INSERT INTO notifications
      (id, userId, type, title, message, relatedType, relatedId, isRead, processStatus)
     VALUES ${bulkPlaceholders}`,
      bulkValues
    );

    await connection.execute(
      `INSERT INTO delete_requests
      (id, requestType, targetType, targetId, customerId, requestedBy,
       requestReason, expectedImpact, status)
     VALUES (?, 'contract_delete', 'contract', ?, ?, ?, '[TEST] 중복 집계 검증',
       'performance_exclusion', 'pending')`,
      [
        ids.deleteRequests.pending,
        ids.contracts.active,
        ids.customers.primary,
        ids.users.member,
      ]
    );
    await connection.execute(
      `INSERT INTO activity_logs
      (id, userId, action, targetType, targetId, details)
     VALUES (?, ?, 'DELETE_REQUEST_CREATED', 'contract', ?, '{"reason":"[TEST] 중복 집계 검증"}')`,
      [ids.activityLogs.deleteRequested, ids.users.member, ids.contracts.active]
    );

    await connection.commit();
    console.info("[e2e-seed] critical synthetic fixtures ready", {
      userCount: userRows.length,
      scheduleCount: scheduleRows.length,
      notificationCount:
        notificationRows.length + CRITICAL_E2E_BULK_NOTIFICATION_COUNT,
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
