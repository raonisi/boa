import type { Connection } from "mysql2/promise";
import type { TrpcContext } from "../../server/_core/context";

export const NOW = "2026-09-09T09:00:00.000Z";
export const actors = Object.fromEntries(
  [
    [1, "branch_admin", null, null, null],
    [2, "sub_branch_admin", null, null, null],
    [3, "team_leader", 10, 2, 2],
    [4, "member", 10, 2, 3],
    [5, "member", 20, 6, 7],
    [6, "sub_branch_admin", null, null, null],
    [7, "team_leader", 20, 6, 6],
    [8, "member", 11, 2, 9],
    [9, "team_leader", 11, 2, 2],
    [10, "member", null, null, null],
  ].map(([id, role, teamId, subBranchAdminId, parentUserId]) => [
    id,
    {
      id,
      role,
      teamId,
      subBranchAdminId,
      parentUserId,
      openId: `f02-test-${id}`,
      name: `[TEST] actor ${id}`,
      email: `actor${id}@test.invalid`,
      accountStatus: "active",
      loginMethod: "google",
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
      lastSignedIn: new Date(NOW),
    },
  ])
) as Record<number, NonNullable<TrpcContext["user"]>>;

export function fixtureAgent(index: number, size: number) {
  return index === size - 1 || index < 20
    ? 4
    : index < 40
      ? 3
      : index < 70
        ? 8
        : index < 80
          ? 2
          : 5;
}
export function allowedIds(actor: number, size: number) {
  // Independent fixture ownership, not a production scope or aggregation helper.
  const agents =
    actor === 1
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
      : actor === 2
        ? [2, 3, 4, 8, 9]
        : actor === 3
          ? [3, 4]
          : [actor];
  return Array.from({ length: size }, (_, i) => 40001 + i).filter((_, i) =>
    agents.includes(fixtureAgent(i, size))
  );
}
export async function seedRecommendations(db: Connection, size: number) {
  for (const a of Object.values(actors))
    await db.query(
      "INSERT INTO users (id,openId,name,email,role,accountStatus,teamId,subBranchAdminId,parentUserId) VALUES (?,?,?,?,?,'active',?,?,?)",
      [
        a.id,
        a.openId,
        a.name,
        a.email,
        a.role,
        a.teamId,
        a.subBranchAdminId,
        a.parentUserId,
      ]
    );
  await db.query(
    "INSERT INTO teams (id,name,managerId,subBranchAdminId) VALUES (10,'[TEST] A',3,2),(11,'[TEST] A2',9,2),(20,'[TEST] B',7,6)"
  );
  for (let i = 0; i < size; i++) {
    const id = 40001 + i,
      agent = fixtureAgent(i, size),
      team = agent === 5 ? 20 : agent === 8 ? 11 : agent === 2 ? null : 10,
      sub = agent === 5 ? 6 : 2;
    const mode = i < 2 ? 0 : i % 12,
      last = i === size - 1;
    const createdAt = last
      ? new Date("2025-01-01")
      : new Date(Date.parse(NOW) - 86400000 - (i < 2 ? 0 : i) * 3600000);
    const assignedAt = new Date(
      mode === 0 && !last ? NOW : "2026-01-01T00:00:00Z"
    );
    const priority =
      mode === 0
        ? "B"
        : mode % 3 === 0
          ? "unclassified"
          : mode % 3 === 1
            ? "A"
            : "B";
    const tags = last
      ? '["해지위험","사후관리","가격부담","가족책임"]'
      : mode === 3
        ? '["해지위험",12,"사후관리"]'
        : mode === 4
          ? "가격부담, 가족책임"
          : null;
    await db.query(
      "INSERT INTO customers (id,name,agentId,assignedTeamId,subBranchAdminId,assignmentStatus,consultStatus,priority,customerTags,nextAction,assignedAt,createdAt,isActive) VALUES (?,?,?,?,?,'assigned_to_agent',?,?,?,?,?,?,true)",
      [
        id,
        `[TEST] customer ${id}`,
        agent,
        team,
        sub,
        mode === 5 ? "설계중" : "미상담",
        last ? "A" : priority,
        tags,
        last || mode === 5 ? "설계안 재연락" : null,
        assignedAt,
        createdAt,
      ]
    );
    if (mode !== 0 && !last) {
      for (let j = 0; j < mode % 4; j++)
        await db.query(
          "INSERT INTO consultations (customerId,agentId,status,isActive,deletedAt,createdAt,content) VALUES (?,?,'통화완료',?,?,?,'[TEST] unused consultation body')",
          [
            id,
            agent,
            j !== 2,
            j === 1 ? new Date("2026-08-01") : null,
            new Date(j === 1 ? "2026-09-08T15:00:00Z" : "2026-01-01T00:00:00Z"),
          ]
        );
      if (mode % 3 === 0)
        await db.query(
          "INSERT INTO contracts (customerId,agentId,contractDate,createdAt,contractStatus,paymentStatus,isActive,deletedAt) VALUES (?,?,'2026-01-01','2026-01-01','철회','실효',true,NULL),(?,?,NULL,'2026-09-01','유지','정상',true,NULL)",
          [id, agent, id, agent]
        );
      if (mode % 3 === 1)
        await db.query(
          "INSERT INTO contracts (customerId,agentId,contractDate,createdAt,contractStatus,isActive,deletedAt) VALUES (?,?,'2026-01-01','2026-01-01','유지',true,NULL),(?,?,'2026-09-01','2026-09-01','유지',false,NULL),(?,?,'2026-09-02','2026-09-02','유지',true,'2026-09-03')",
          [id, agent, id, agent, id, agent]
        );
    }
    if (mode > 0 || last) {
      const dates = [
        "2026-09-08T14:59:59Z",
        "2026-09-08T15:00:00Z",
        "2026-09-09T14:59:59Z",
        "2026-09-09T15:00:00Z",
      ];
      for (let j = 0; j < (last ? 4 : mode % 4); j++)
        await db.query(
          "INSERT INTO follow_ups (customerId,assignedAgentId,nextContactDate,reason,status,createdBy,deletedAt) VALUES (?,?,?,'[TEST] follow up',?,?,?)",
          [
            id,
            agent,
            new Date(dates[j]),
            j === 2 && !last
              ? "completed"
              : j === 3 && !last
                ? "cancelled"
                : j === 1
                  ? "postponed"
                  : "scheduled",
            agent,
            mode === 8 ? new Date(NOW) : null,
          ]
        );
    }
    if (mode % 3 === 1 || last)
      await db.query(
        "INSERT INTO notifications (userId,type,title,message,relatedType,relatedId,isRead,processStatus,dueAt,createdAt) VALUES (?,'general','[TEST] notice','[TEST] message','customer',?,?,?,NULL,?)",
        [
          agent,
          id,
          mode === 7,
          mode === 7 ? "미확인" : "확인",
          new Date(Date.parse(NOW) - i * 1000),
        ]
      );
  }
  // Out-of-scope/unassigned, active-but-deleted, inactive and their related records remain present.
  await db.query(
    "INSERT INTO customers (id,name,agentId,subBranchAdminId,consultStatus,priority,isActive,deletedAt) VALUES (49001,'[TEST] inactive',4,2,'미상담','A',false,NULL),(49002,'[TEST] deleted',4,2,'미상담','A',true,'2026-01-01')"
  );
  // Recently delivered unrelated/read notifications occupy the existing 200-row window.
  for (let i = 0; i < 220; i++)
    await db.query(
      "INSERT INTO notifications (userId,type,title,message,relatedType,relatedId,isRead,processStatus,dueAt,createdAt) VALUES (4,'general','[TEST] window','[TEST] window','schedule',?,true,'확인',NULL,?)",
      [70000 + i, new Date(Date.parse(NOW) - 1000000 - i * 1000)]
    );
  await db.query(
    "INSERT INTO notifications (userId,type,title,message,relatedType,relatedId,isRead,processStatus,dueAt,createdAt) VALUES (4,'general','[TEST] old','[TEST] old','customer',40001,false,'미확인',NULL,'2026-01-01'),(4,'general','[TEST] future','[TEST] future','customer',40002,false,'미확인','2026-09-10','2026-09-09')"
  );
}
