import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import SuperJSON from "superjson";
import { policyGolden } from "./recommendation-order.oracle";
import {
  actors,
  allowedIds,
  NOW,
  seedRecommendations,
} from "./recommendation-query.fixture";
import type { appRouter as Router } from "../../server/routers";
import type { TrpcContext } from "../../server/_core/context";

const phase = process.env.BOA_F02_PHASE,
  size = Number(process.env.BOA_F02_SIZE);
const attempt = process.env.BOA_F02_ATTEMPT ?? "";
const output = process.env.BOA_F02_EVIDENCE!;
let conn: mysql.Connection, appRouter: typeof Router;
const records: Record<string, unknown> = {},
  volumes: unknown[] = [];
let golden: Record<string, unknown>;
function caller(id: number, user: TrpcContext["user"] = actors[id]) {
  return appRouter.createCaller({
    user,
    req: { protocol: "http", headers: {} },
    res: { clearCookie() {} },
  } as TrpcContext);
}
function equivalent(key: string, value: unknown) {
  const serialized = JSON.parse(JSON.stringify(SuperJSON.serialize(value)));
  records[key] = serialized;
  if (phase === "post")
    expect(serialized, key).toEqual(
      JSON.parse(JSON.stringify(policyGolden(key, golden)))
    );
}
async function measured(actor: number, run: () => Promise<unknown>) {
  const [[start]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT DATE_FORMAT(NOW(6),'%Y-%m-%d %H:%i:%s.%f') AS mark"
  );
  const value = await run();
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT argument FROM mysql.general_log WHERE event_time>=? AND command_type IN ('Query','Execute') AND thread_id<>?",
    [start.mark, conn.threadId]
  );
  const selects = rows
    .map(r => String(r.argument))
    .filter(q => /^select/i.test(q));
  const consultations = selects.filter(q => /from `?consultations`?/i.test(q));
  const rawCustomers = selects.filter(
    q => /from `?customers`?/i.test(q) && /`phone`/.test(q)
  );
  volumes.push({
    actor,
    size,
    statements: selects.length,
    customerSelects: selects.filter(q => /from `?customers`?/i.test(q)).length,
    consultationSelects: consultations.length,
    otherSelects: selects.filter(
      q => !/from `?(customers|consultations)`?/i.test(q)
    ).length,
    rawCustomerSelects: rawCustomers.length,
    returned: (value as unknown[]).length,
    sql: selects,
  });
  {
    const recommendationQueries = selects.filter(q =>
      /from `?(customers|consultations|contracts|follow_ups|notifications)`?/i.test(
        q
      )
    );
    // Existing hierarchy authorization also reads users/teams/permissions.
    // Check customer-data projection separately and still bound ALL statements.
    expect(recommendationQueries).toHaveLength(5);
    expect(selects).toHaveLength(actor === 2 || actor === 3 ? 8 : 5);
    expect(consultations).toHaveLength(1);
    expect(consultations[0]).toMatch(/group by/i);
    expect(rawCustomers).toHaveLength(0);
    expect(recommendationQueries.join("\n")).not.toMatch(
      /`phone`|`birthDate`|`memo`|`content`/
    );
  }
  return value;
}
beforeAll(async () => {
  if (
    process.env.E2E_TEST_MODE !== "true" ||
    !["pre", "post"].includes(phase!) ||
    ![134, 500].includes(size)
  )
    throw Error("Explicit isolated F02 environment required");
  const url = new URL(process.env.DATABASE_URL!);
  if (attempt && !/^_r\d+$/.test(attempt)) throw Error("Invalid attempt");
  if (
    url.hostname !== "127.0.0.1" ||
    url.pathname !== `/boa_f02_rf_${phase}${size}${attempt}`
  )
    throw Error("Unexpected synthetic schema");
  const owner = JSON.parse(await readFile(process.env.BOA_F02_OWNER!, "utf8"));
  conn = await mysql.createConnection({ uri: url.href, timezone: "Z" });
  const [[identity]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT @@datadir AS datadir,@@port AS port"
  );
  if (
    owner.syntheticOnly !== true ||
    identity.port !== owner.port ||
    path.resolve(identity.datadir) !== path.resolve(owner.datadir)
  )
    throw Error("Not the owned instance");
  const [[empty]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT (SELECT count(*) FROM customers) AS customers,(SELECT count(*) FROM users) AS users"
  );
  if (Number(empty.customers) || Number(empty.users))
    throw Error("Fresh migrated schema required");
  await seedRecommendations(conn, size);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  ({ appRouter } = await import(
    /* @vite-ignore */ `${process.env.BOA_F02_ROOT}/server/routers.ts`
  ));
  if (phase === "post")
    golden = JSON.parse(
      await readFile(path.join(output, `golden-${size}.json`), "utf8")
    );
  else {
    try {
      await access(path.join(output, `golden-${size}.json`));
      throw Error("Golden already exists");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  // Capture every candidate's semantic fields before limit, not just the old top 50.
  // The PRE probe only appends an export to the frozen router copy.
  const probe = await import(
    /* @vite-ignore */ phase === "pre"
      ? `${process.env.BOA_RF02_PRE_ROOT}/server/rf02-probe.ts`
      : `${process.env.BOA_F02_ROOT}/server/routers.ts`
  );
  const [dateRows] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id,createdAt FROM customers WHERE isActive=true AND deletedAt IS NULL ORDER BY id"
  );
  equivalent(
    "createdAt",
    Object.fromEntries(dateRows.map(row => [row.id, row.createdAt]))
  );
  for (const actor of [1, 2, 3, 4]) {
    const result = await (
      phase === "pre" ? probe.rf02Items : probe.buildRecommendationItems
    )(actors[actor], new Date(NOW));
    const items = phase === "pre" ? result : result.items;
    expect(
      items
        .map((row: any) => row.customerId)
        .sort((a: number, b: number) => a - b)
    ).toEqual(allowedIds(actor, size));
    equivalent(
      `full/${actor}`,
      [...items].sort((a: any, b: any) => a.customerId - b.customerId)
    );
  }
  await conn.query("SET GLOBAL log_output='TABLE'");
  await conn.query("SET GLOBAL general_log=ON");
});
afterAll(async () => {
  vi.useRealTimers();
  if (conn) {
    await conn.query("SET GLOBAL general_log=OFF");
    await conn.end();
  }
  if (phase === "pre")
    await writeFile(
      path.join(output, `golden-${size}.json`),
      JSON.stringify(records, null, 2)
    );
  else
    await writeFile(
      path.join(output, `post-${size}${attempt}-results.json`),
      JSON.stringify(records, null, 2)
    );
  await writeFile(
    path.join(output, `${phase}-${size}${attempt}-queries.json`),
    JSON.stringify(volumes, null, 2)
  );
});
describe("F02 actual router/MySQL Golden and query architecture (synthetic auth context)", () => {
  it.each([1, 2, 3, 4])(
    "F02-01..09: actor %s priority matrix, order, fields, warnings and scope",
    async actor => {
      const api = caller(actor).recommendations;
      for (const limit of [1, 10, 25, 50])
        for (const includeWarnings of [true, false]) {
          const input = { date: NOW, limit, includeWarnings };
          const value =
            limit === 50 && includeWarnings
              ? await measured(actor, () => api.priorityContacts(input))
              : await api.priorityContacts(input);
          equivalent(`priority/${actor}/${limit}/${includeWarnings}`, value);
          const rows = value as Awaited<
            ReturnType<typeof api.priorityContacts>
          >;
          expect(rows.length).toBeLessThanOrEqual(limit);
          expect(
            rows.every(r => allowedIds(actor, size).includes(r.customerId))
          ).toBe(true);
          if (!includeWarnings)
            expect(rows.every(r => r.warnings.length === 0)).toBe(true);
          // The oldest, highest-ID customer must survive candidate selection before limit=1.
          expect(rows[0].customerId).toBe(40000 + size);
          expect(rows[0]).not.toHaveProperty("rank"); // rank is ordered array position, not an API field.
        }
      for (const urgency of ["high", "medium", "low"] as const)
        equivalent(
          `urgency/${actor}/${urgency}`,
          await api.priorityContacts({ date: NOW, limit: 50, urgency })
        );
      equivalent(`default/${actor}`, await api.priorityContacts());
      equivalent(
        `raw-keys/${actor}`,
        await api.priorityContacts({
          date: NOW,
          limit: 50,
          includeWarnings: true,
          agentId: 5,
          agentIdFilter: 5,
          selectedUserId: 5,
          teamId: 20,
          subBranchAdminId: 6,
          scope: "all",
          unassigned: true,
        } as any)
      );
      expect(records[`raw-keys/${actor}`]).toEqual(
        records[`priority/${actor}/50/true`]
      );
      await expect(api.priorityContacts({ limit: 51 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      if (actor === 4) {
        const rows = await api.priorityContacts({ limit: 50 });
        expect(rows.length).toBeLessThan(50);
        expect(rows.length).toBeGreaterThan(10);
      }
    }
  );
  it.each([1, 2, 3, 4])(
    "F02-10: actor %s shared APIs preserve shape, defaults, warnings and reasons",
    async actor => {
      const api = caller(actor).recommendations,
        customerId = 40000 + size;
      equivalent(`summary/${actor}`, await api.dashboardSummary({ date: NOW }));
      equivalent(`warnings-default/${actor}`, await api.customerWarnings());
      equivalent(
        `warnings-filter/${actor}`,
        await api.customerWarnings({
          customerId,
          warningTypes: ["long_unmanaged"],
          limit: 1,
        })
      );
      equivalent(
        `reasons/${actor}`,
        await api.customerContactReasons({ customerId })
      );
      if (actor !== 1) {
        await expect(
          api.customerContactReasons({ customerId: 40081 })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          api.customerWarnings({ customerId: 40081 })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
  );
  it("F02-07/10: direct auth denial and genuine empty scopes", async () => {
    for (const user of [
      null,
      { ...actors[4], accountStatus: "inactive" },
      { ...actors[4], accountStatus: "resigned" },
    ] as TrpcContext["user"][]) {
      const api = caller(4, user).recommendations,
        code = user ? "FORBIDDEN" : "UNAUTHORIZED";
      for (const call of [
        () => api.priorityContacts(),
        () => api.customerWarnings(),
        () => api.customerContactReasons({ customerId: 40001 }),
        () => api.dashboardSummary(),
      ])
        await expect(call()).rejects.toMatchObject({ code });
    }
    const api = caller(10).recommendations;
    expect(await api.priorityContacts()).toEqual([]);
    expect(await api.customerWarnings()).toEqual([]);
    expect(await api.dashboardSummary()).toEqual({
      priorityContactCount: 0,
      highUrgencyCount: 0,
      warningCount: 0,
      topContacts: [],
    });
    await expect(
      api.customerContactReasons({ customerId: 999999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("RF02 C04: equal-score/date customers follow the explicit ID order", async () => {
    const rows = await caller(4).recommendations.priorityContacts({
      limit: 50,
    });
    const ties = rows.filter(r => [40001, 40002].includes(r.customerId));
    expect(ties).toHaveLength(2);
    expect(ties[0].totalScore).toBe(ties[1].totalScore);
    equivalent("ties", ties);
  });
  it("F02-10: workRhythm direct scoring caller remains equivalent", async () => {
    equivalent(
      "workRhythm/member",
      await caller(4).workRhythm.summary({
        period: "custom",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-09",
      })
    );
  });
});
