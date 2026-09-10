import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { appRouter } from "../../server/routers";
import type { TrpcContext } from "../../server/_core/context";

// Actual appRouter + Drizzle + MySQL; only the authentication context is synthetic.
// Requires a fresh, task-owned local instance with existing migrations applied.
let connection: mysql.Connection | undefined;
const facts: unknown[] = [];
const actorRows = [
  [1, "branch_admin", null, null, null],
  [2, "sub_branch_admin", null, null, null],
  [3, "team_leader", 10, 2, 2],
  [4, "member", 10, 2, 3],
  [5, "member", 20, 6, 7],
  [6, "sub_branch_admin", null, null, null],
  [7, "team_leader", 20, 6, 6],
  [8, "team_leader", null, null, null],
] as const;
const actors = Object.fromEntries(
  actorRows.map(([id, role, teamId, subBranchAdminId, parentUserId]) => [
    id,
    {
      id,
      role,
      teamId,
      subBranchAdminId,
      parentUserId,
      accountStatus: "active",
      openId: `f01-synthetic-${id}`,
      name: `[TEST] actor ${id}`,
      email: `actor${id}@test.invalid`,
      loginMethod: "google",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      lastSignedIn: new Date("2026-01-01"),
    },
  ])
) as Record<number, NonNullable<TrpcContext["user"]>>;
function caller(user: TrpcContext["user"]) {
  return appRouter.createCaller({
    user,
    req: { protocol: "http", headers: {} },
    res: { clearCookie() {} },
  } as TrpcContext);
}
const quickInput = {
  segment: "all" as const,
  newDbFrom: "2026-09-01",
  newDbTo: "2026-09-08",
};
async function result(actor: number, input = {}) {
  const api = caller(actors[actor]).customers;
  const rows = await api.list({
    segment: "all",
    sort: "name",
    page: 1,
    pageSize: 100,
    ...input,
  });
  const counts = await api.segmentCounts(input);
  return { ids: rows.map(row => row.id), counts };
}

beforeAll(async () => {
  if (
    process.env.E2E_TEST_MODE !== "true" ||
    !process.env.BOA_F01_MYSQL_OWNER_FILE
  ) {
    throw new Error(
      "Explicit task-owned MySQL integration environment required"
    );
  }
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    !/^\/boa_f01_[a-z0-9_]+$/.test(url.pathname)
  ) {
    throw new Error(
      "Only a fresh loopback boa_f01_* synthetic schema is allowed"
    );
  }
  const owner = JSON.parse(
    await readFile(process.env.BOA_F01_MYSQL_OWNER_FILE, "utf8")
  );
  if (owner.syntheticOnly !== true || Number(url.port) !== owner.port)
    throw new Error("Missing instance ownership proof");
  connection = await mysql.createConnection({ uri: url.href, timezone: "Z" });
  const [identity] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT @@datadir AS datadir, @@port AS port"
  );
  if (
    identity[0].port !== owner.port ||
    path.resolve(identity[0].datadir) !== path.resolve(owner.datadir)
  ) {
    throw new Error("MySQL instance differs from task-owned data directory");
  }
  const [existing] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT (SELECT count(*) FROM customers) AS customers, (SELECT count(*) FROM users) AS users"
  );
  if (Number(existing[0].customers) !== 0 || Number(existing[0].users) !== 0)
    throw new Error("Fresh empty migrated schema required");
  for (const a of Object.values(actors)) {
    await connection.query(
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
  }
  await connection.query(
    "INSERT INTO teams (id,name,managerId,subBranchAdminId) VALUES (10,'[TEST] Team A',3,2),(20,'[TEST] Team B',7,6)"
  );
  // Four audit IDs plus assigned customers exercising the existing scope OR terms.
  const rows = [
    [47001, null, null, 2],
    [47002, null, null, 6],
    [47003, null, 10, 2],
    [47004, null, null, null],
    [48001, 2, null, null],
    [48002, 4, null, null],
    [48003, 3, null, null],
    [48004, 5, 20, 6],
    [48005, 1, null, null],
    [48006, 8, null, null],
  ];
  for (const [id, agent, team, sub] of rows) {
    await connection.query(
      "INSERT INTO customers (id,name,agentId,assignedTeamId,subBranchAdminId,assignmentStatus,consultStatus,isActive) VALUES (?,?,?,?,?,?,'미상담',true)",
      [
        id,
        `[TEST] customer ${id}`,
        agent,
        team,
        sub,
        agent
          ? "assigned_to_agent"
          : sub
            ? "assigned_to_sub_branch"
            : "unassigned",
      ]
    );
  }
  await connection.query(
    "INSERT INTO customers (id,name,subBranchAdminId,consultStatus,isActive,deletedAt) VALUES (49001,'[TEST] inactive',2,'미상담',false,'2026-01-01')"
  );
  // Two contracts still count as one customer; classification stays unchanged.
  await connection.query(
    "INSERT INTO contracts (customerId,agentId,monthlyPremium,contractStatus,paymentStatus,isActive) VALUES (48002,4,10000,'유지','정상',true),(48002,4,20000,'성립','정상',true)"
  );
});
afterAll(async () => {
  if (process.env.BOA_F01_FACTS_FILE)
    await writeFile(
      process.env.BOA_F01_FACTS_FILE,
      JSON.stringify(facts, null, 2)
    );
  await connection?.end();
});

describe("F01: organization scope AND unassigned business filter", () => {
  it.each([
    [2, [47001, 47003]],
    [3, [47003]],
  ] as const)(
    "audit actor %s cannot see other or missing organizations",
    async (actor, allowed) => {
      const got = await result(actor, { unassigned: true });
      facts.push({ case: "F01-audit-reproduction", actor, allowed, ...got });
      expect.soft(got.ids).toEqual(allowed);
      expect
        .soft(got.counts)
        .toEqual({
          all: allowed.length,
          database: allowed.length,
          contracted: 0,
        });
      expect.soft(got.ids).not.toContain(47002);
      expect.soft(got.ids).not.toContain(47004);
    }
  );

  it.each([
    [
      1,
      [47001, 47002, 47003, 47004, 48001, 48002, 48003, 48004, 48005, 48006],
      [47001, 47002, 47003, 47004],
      1,
    ],
    [2, [47001, 47003, 48001, 48002, 48003], [47001, 47003], 1],
    [3, [47003, 48002, 48003], [47003], 1],
    [4, [48002], [], 1],
    [8, [48006], [], 0],
  ] as const)(
    "actor %s preserves normal, false and true filters, classification and quick counts",
    async (actor, all, unassigned, contracted) => {
      for (const input of [{}, { unassigned: false }]) {
        const got = await result(actor, input);
        expect(got.ids).toEqual(all);
        expect(got.counts).toEqual({
          all: all.length,
          database: all.length - contracted,
          contracted,
        });
      }
      const got = await result(actor, { unassigned: true });
      expect(got.ids).toEqual(unassigned);
      expect(got.counts).toEqual({
        all: unassigned.length,
        database: unassigned.length,
        contracted: 0,
      });
      const quick = await caller(actors[actor]).customers.quickCounts(
        quickInput
      );
      expect(quick.all).toBe(all.length);
      const databaseQuick = await caller(actors[actor]).customers.quickCounts({
        ...quickInput,
        segment: "database",
      });
      expect(databaseQuick.all).toBe(all.length - contracted);
      facts.push({
        case: "role-scope",
        actor,
        ids: all,
        unassigned,
        quickAll: quick.all,
        databaseQuickAll: databaseQuick.all,
      });
    }
  );

  it.each([2, 3])(
    "actor %s intersects search, classification and conflicting assignee inputs",
    async actor => {
      expect(
        await result(actor, {
          unassigned: true,
          search: "47003",
          workflowFilter: "uncontacted",
        })
      ).toEqual({
        ids: [47003],
        counts: { all: 1, database: 1, contracted: 0 },
      });
      expect(
        (await result(actor, { unassigned: true, segment: "contracted" })).ids
      ).toEqual([]);
      for (const input of [
        { agentIdFilter: 4 },
        { scope: "mine" },
        { scope: "member", selectedUserId: 4 },
      ]) {
        expect(await result(actor, { ...input, unassigned: true })).toEqual({
          ids: [],
          counts: { all: 0, database: 0, contracted: 0 },
        });
      }
      const allowed = actor === 2 ? [47001, 47003] : [47003];
      expect(
        (
          await result(actor, {
            unassigned: true,
            segment: "database",
            assignmentStatus: "assigned_to_sub_branch",
          })
        ).ids
      ).toEqual(allowed);
    }
  );

  it.each([2, 3, 4, 8])(
    "actor %s cannot broaden scope using caller-supplied organization or IDs",
    async actor => {
      const injected = {
        teamId: 20,
        subBranchAdminId: 6,
        agentId: 5,
        agentIds: [5],
        unassigned: true,
      };
      expect(await result(actor, injected)).toEqual(
        await result(actor, { unassigned: true })
      );
      const api = caller(actors[actor]).customers;
      expect(
        (
          await api.quickCounts({
            ...quickInput,
            ...injected,
            scope: "all",
            recommendationIds: [47002, 47004, 48004],
            urgentIds: [47002, 47004, 48004],
          } as typeof quickInput)
        ).today_contact
      ).toBe(0);
      expect(
        (
          await result(actor, {
            customerIds: [47002, 47004, 48004],
            unassigned: true,
          })
        ).ids
      ).toEqual([]);
      for (const endpoint of [api.list, api.segmentCounts]) {
        await expect(
          endpoint({ scope: "member", selectedUserId: 5, unassigned: true })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        if (actor !== 4)
          await expect(
            endpoint({ agentIdFilter: 5, unassigned: true })
          ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      if (actor === 4) {
        expect(
          await result(actor, { agentIdFilter: 5, unassigned: true })
        ).toEqual({ ids: [], counts: { all: 0, database: 0, contracted: 0 } });
        await expect(api.list({ scope: "all" })).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
    }
  );

  it.each(["unauthenticated", "inactive", "resigned"])(
    "rejects %s in actual router middleware for all three queries",
    async status => {
      const user =
        status === "unauthenticated"
          ? null
          : ({ ...actors[4], accountStatus: status } as TrpcContext["user"]);
      const api = caller(user).customers;
      const code = user ? "FORBIDDEN" : "UNAUTHORIZED";
      await expect(api.list({ unassigned: true })).rejects.toMatchObject({
        code,
      });
      await expect(
        api.segmentCounts({ unassigned: true })
      ).rejects.toMatchObject({ code });
      await expect(api.quickCounts(quickInput)).rejects.toMatchObject({ code });
    }
  );
});
