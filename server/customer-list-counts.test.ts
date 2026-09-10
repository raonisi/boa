import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { drizzle } from "drizzle-orm/mysql-proxy";
import {
  getCustomers,
  getCustomerQuickCounts,
  getCustomerSegmentCounts,
} from "./db";

const state = vi.hoisted(() => ({
  db: null as unknown,
  statements: [] as Array<{ sql: string; params: unknown[] }>,
  failed: false,
}));
// No MySQL connection can be constructed in this suite.
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => state.db }));

beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "synthetic-query-driver");
  state.db = drizzle(async (sql, params) => {
    state.statements.push({ sql, params });
    if (state.failed) throw new Error("synthetic query failure");
    if (sql.startsWith("select count(distinct"))
      return { rows: [[123, 17, 83, 43, 73, 33, 13, 7]] };
    return { rows: [] };
  });
});
beforeEach(() => {
  state.statements = [];
  state.failed = false;
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("P2-02 scoped SQL aggregation (query construction, not a live MySQL test)", () => {
  it("B01/B02: aggregates in SQL, independent of page, size and order", async () => {
    for (const pageSize of [20, 50])
      for (const page of [1, 3]) {
        const result = await getCustomerSegmentCounts({
          agentId: 4,
          page,
          pageSize,
          sort: "name",
        });
        expect(result).toEqual({ all: 123, contracted: 17, database: 106 });
      }
    expect(state.statements).toHaveLength(4);
    expect(new Set(state.statements.map(s => JSON.stringify(s))).size).toBe(1);
    expect(state.statements[0].sql).toContain("count(distinct");
    expect(state.statements[0].sql).not.toMatch(/order by|limit|offset/i);
    expect(state.statements[0].params).toContain(4);
  });

  it.each(["uncontacted", "sla_overdue", "no_next_action"] as const)(
    "B03/B04: list and count share %s predicates before pagination",
    async workflowFilter => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-08T00:00:00Z"));
      const filter = {
        agentIds: [4, 5],
        workflowFilter,
        status: "미상담",
        priority: "A",
        region: "합성지역",
        tag: "가족",
        customerIds: [92001, 92002],
      };
      await getCustomers({ ...filter, page: 3, pageSize: 50, sort: "name" });
      await getCustomerSegmentCounts(filter);
      const [list, count] = state.statements;
      expect(
        list.sql.slice(list.sql.lastIndexOf(" where ")).split(" order by ")[0]
      ).toBe(count.sql.slice(count.sql.lastIndexOf(" where ")));
      expect(list.params.slice(0, -2)).toEqual(count.params);
      expect(list.params.slice(-2)).toEqual([50, 100]);
      vi.useRealTimers();
    }
  );

  it.each([
    ["recent", "`customers`.`createdAt` desc"],
    ["name", "`customers`.`name` asc"],
    ["next_contact", "select min("],
    ["contract_value", "select coalesce(sum("],
  ] as const)(
    "B05: %s keeps existing server sort",
    async (sort, expression) => {
      await getCustomers({ agentId: 4, sort, page: 2, pageSize: 20 });
      expect(state.statements).toHaveLength(1);
      expect(state.statements[0].sql).toContain(expression);
      expect(state.statements[0].sql).toContain("limit ? offset ?");
    }
  );

  it("B06: query failure rejects instead of returning zero", async () => {
    state.failed = true;
    await expect(
      getCustomerSegmentCounts({ agentId: 4 })
    ).rejects.toMatchObject({ cause: new Error("synthetic query failure") });
  });

  it("B08/B09: empty authorized IDs cannot become an unrestricted aggregate", async () => {
    await getCustomerSegmentCounts({ agentIds: [] });
    expect(state.statements[0].sql).toContain("false");
  });

  it.each([
    [{ teamId: 10 }, "`customers`.`assignedTeamId` = ?", 10],
    [{ subBranchAdminId: 2 }, "`customers`.`subBranchAdminId` = ?", 2],
    [{ agentId: 4 }, "`customers`.`agentId` = ?", 4],
    [{ agentIds: [4] }, "`customers`.`agentId` = ?", 4],
    [{ agentIds: [] }, "false", undefined],
  ] as const)(
    "F01: %j remains ANDed with unassigned in all shared query consumers",
    async (scope, predicate, id) => {
      const filter = { ...scope, unassigned: true };
      await getCustomers({ ...filter, page: 1, pageSize: 20 });
      await getCustomerSegmentCounts(filter);
      // Direct helper coverage, distinct from the quickCounts router's normal input.
      await getCustomerQuickCounts(filter, {
        newDbFrom: new Date("2026-09-01"),
        newDbTo: new Date("2026-09-08"),
      });
      const customerQueries = state.statements.filter(query =>
        query.sql.includes("from `customers`")
      );
      expect(customerQueries).toHaveLength(3);
      for (const query of customerQueries) {
        expect(query.sql).toContain(predicate);
        expect(query.sql).toContain("`customers`.`agentId` is null");
        expect(query.sql).toContain(" and ");
        if (id !== undefined) expect(query.params).toContain(id);
      }
    }
  );

  it("B10: quick counts use a single distinct aggregate, bounded candidate IDs and contract EXISTS", async () => {
    const counts = await getCustomerQuickCounts(
      { agentId: 4, segment: "contracted" },
      {
        recommendationIds: [92001, 92001, 92002],
        urgentIds: [92002],
        mineAgentId: 4,
        newDbFrom: new Date("2026-09-01"),
        newDbTo: new Date("2026-09-08"),
      }
    );
    expect(counts.all).toBe(123);
    expect(state.statements).toHaveLength(1);
    const query = state.statements[0];
    expect(query.sql.match(/count\(distinct/g)).toHaveLength(8);
    expect(query.sql).toContain("exists (");
    expect(query.sql).toContain("'철회', '해지'");
    expect(query.sql).toContain("'실효', '해지'");
    expect(query.sql).not.toMatch(/join|limit|offset|order by/i);
    expect(query.params).toContain(4);
  });

  it("B10: unavailable recommendation data remains unknown", async () => {
    const counts = await getCustomerQuickCounts(
      { agentId: 4 },
      { newDbFrom: new Date("2026-09-01"), newDbTo: new Date("2026-09-08") }
    );
    expect(counts.today_contact).toBeNull();
    expect(counts.urgent).toBeNull();
  });
});
