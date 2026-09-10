import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as db from "../../server/db";
import { appRouter } from "../../server/routers";
import { actors, NOW } from "./recommendation-query.fixture";
import type { TrpcContext } from "../../server/_core/context";

const direction = process.env.BOA_RF02_INSERT_ORDER;
const attempt = process.env.BOA_RF02_TIE_ATTEMPT ?? "";
let conn: mysql.Connection;
const evidence: Record<string, unknown> = {};
const candidates = Array.from({ length: 134 }, (_, i) => ({
  id: 60001 + i,
  agentId: i < 70 ? 4 : i < 80 ? 8 : i < 90 ? 2 : 5,
  score: i === 60 ? 85 : i === 61 ? 25 : i === 64 ? 0 : 15,
  priority: i === 60 || i === 61 ? "A" : i === 64 ? "unclassified" : "B",
  createdAt:
    i === 62
      ? "2025-01-01 00:00:00"
      : i === 63
        ? "2026-09-08 00:00:00"
        : "2026-09-01 00:00:00",
}));
function expected(actor: number, limit = 50, urgency?: string) {
  const agents =
    actor === 1
      ? [2, 4, 5, 8]
      : actor === 2
        ? [2, 4, 8]
        : actor === 8
          ? [8]
          : [4];
  // Explicit fixture groups form the oracle; no product comparator or scoring helper.
  const permitted = candidates.filter(
    r =>
      agents.includes(r.agentId) &&
      r.score > 0 &&
      (!urgency ||
        (r.score >= 55 ? "high" : r.score >= 25 ? "medium" : "low") === urgency)
  );
  const scores = [85, 25, 15],
    dates = [
      "2026-09-08 00:00:00",
      "2026-09-01 00:00:00",
      "2025-01-01 00:00:00",
    ];
  return scores
    .flatMap(score =>
      dates.flatMap(date =>
        permitted
          .filter(r => r.score === score && r.createdAt === date)
          .map(r => r.id)
          .sort((a, b) => a - b)
      )
    )
    .slice(0, limit);
}
const caller = (actor: number) =>
  appRouter.createCaller({
    user: actors[actor],
    req: { protocol: "http", headers: {} },
    res: { clearCookie() {} },
  } as TrpcContext);
beforeAll(async () => {
  if (
    process.env.E2E_TEST_MODE !== "true" ||
    !["forward", "reverse"].includes(direction!)
  )
    throw Error("Explicit synthetic insertion-order environment required");
  const url = new URL(process.env.DATABASE_URL!);
  if (
    url.hostname !== "127.0.0.1" ||
    url.pathname !== `/boa_f02_rf_tie_${direction}${attempt}` ||
    (attempt !== "" && !/^_r\d+$/.test(attempt))
  )
    throw Error("Unexpected database");
  conn = await mysql.createConnection({ uri: url.href, timezone: "Z" });
  const owner = JSON.parse(await readFile(process.env.BOA_F02_OWNER!, "utf8"));
  const [[identity]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT @@datadir AS datadir,@@port AS port"
  );
  if (
    owner.syntheticOnly !== true ||
    identity.port !== owner.port ||
    path.resolve(identity.datadir) !== path.resolve(owner.datadir)
  )
    throw Error("Unowned DB");
  const [[counts]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT (SELECT count(*) FROM customers) AS customers,(SELECT count(*) FROM users) AS users"
  );
  if (Number(counts.customers) || Number(counts.users))
    throw Error("Fresh empty database required");
  for (const actor of Object.values(actors))
    await conn.query(
      "INSERT INTO users (id,openId,name,email,role,accountStatus,teamId,subBranchAdminId,parentUserId) VALUES (?,?,?,?,?,'active',?,?,?)",
      [
        actor.id,
        actor.openId,
        actor.name,
        actor.email,
        actor.role,
        actor.teamId,
        actor.subBranchAdminId,
        actor.parentUserId,
      ]
    );
  await conn.query(
    "INSERT INTO teams (id,name,managerId,subBranchAdminId) VALUES (10,'[TEST] A',3,2),(11,'[TEST] A2',9,2),(20,'[TEST] B',7,6)"
  );
  const insert =
    direction === "forward" ? candidates : [...candidates].reverse();
  for (const row of insert)
    await conn.query(
      "INSERT INTO customers (id,name,agentId,assignedTeamId,subBranchAdminId,priority,customerTags,nextAction,consultStatus,assignedAt,createdAt,isActive) VALUES (?,?,?,?,?,?,?,?,?,'2026-09-09 09:00:00',?,true)",
      [
        row.id,
        `[TEST] tie ${row.id}`,
        row.agentId,
        row.agentId === 5 ? 20 : row.agentId === 8 ? 11 : 10,
        row.agentId === 5 ? 6 : 2,
        row.priority,
        row.id === 60061 ? '["해지위험","사후관리"]' : null,
        row.id === 60061 ? "설계안 재연락" : null,
        "미상담",
        row.createdAt,
      ]
    );
  await conn.query(
    "INSERT INTO customers (id,name,agentId,isActive,deletedAt) VALUES (69001,'[TEST] inactive',4,false,NULL),(69002,'[TEST] deleted',4,true,'2026-09-01')"
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});
afterAll(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (conn) await conn.end();
  await writeFile(
    path.join(process.env.BOA_F02_EVIDENCE!, `tie-${direction}${attempt}-results.json`),
    JSON.stringify(evidence, null, 2),
    { flag: "wx" }
  );
});
describe("RF02 actual MySQL insertion/projection/cutoff", () => {
  it.each([1, 2, 3, 4])(
    "C02-C06/C09: actor %s obeys the oracle at every cutoff",
    async actor => {
      const api = caller(actor).recommendations;
      for (const limit of [1, 10, 25, 50])
        for (const includeWarnings of [true, false]) {
          const result = await api.priorityContacts({
            date: NOW,
            limit,
            includeWarnings,
          });
          expect(result.map(r => r.customerId)).toEqual(expected(actor, limit));
          for (const row of result)
            expect(row.totalScore).toBe(
              candidates.find(r => r.id === row.customerId)!.score
            );
          evidence[`${actor}/${limit}/${includeWarnings}`] = result;
        }
      for (const urgency of ["high", "medium", "low"] as const)
        expect(
          (await api.priorityContacts({ date: NOW, limit: 50, urgency })).map(
            r => r.customerId
          )
        ).toEqual(expected(actor, 50, urgency));
      expect(
        (await api.dashboardSummary({ date: NOW })).topContacts.map(
          r => r.customerId
        )
      ).toEqual(expected(actor, 5));
      await expect(api.priorityContacts({ limit: 51 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      if (actor !== 1)
        await expect(
          api.customerContactReasons({ customerId: 60091 })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  );
  it("T08/C07: ten real DB calls return the same ordered IDs", async () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      const ids = (
        await caller(4).recommendations.priorityContacts({
          date: NOW,
          limit: 50,
        })
      ).map(r => r.customerId);
      expect(ids).toEqual(expected(4));
      results.push(ids);
    }
    evidence.repeated = results;
    expect(
      (await caller(8).recommendations.priorityContacts({ limit: 50 })).map(
        r => r.customerId
      )
    ).toEqual(expected(8));
  });
  it("T05/T07: actual full-row and minimal SQL collectors supply the same recommendation facts", async () => {
    // Synthetic test collectors only. Production priorityContacts is separately measured unmocked.
    const raw = await db.getCustomers({ agentId: 4 });
    const optimized = await db.getRecommendationData({ agentId: 4 });
    expect(Object.keys(raw[0])).toContain("phone");
    expect(Object.keys(optimized.customerList[0])).not.toContain("phone");
    const spy = vi.spyOn(db, "getRecommendationData");
    try {
      spy.mockResolvedValue({ ...optimized, customerList: [...raw].reverse() });
      const before = await caller(4).recommendations.priorityContacts({
        date: NOW,
        limit: 50,
      });
      spy.mockResolvedValue({
        ...optimized,
        customerList: [...optimized.customerList].sort((a, b) => b.id - a.id),
      });
      const after = await caller(4).recommendations.priorityContacts({
        date: NOW,
        limit: 50,
      });
      expect(after).toEqual(before);
      expect(after.map(r => r.customerId)).toEqual(expected(4));
      evidence.collectorEquivalent = after;
    } finally {
      spy.mockRestore();
    }
  });
});
