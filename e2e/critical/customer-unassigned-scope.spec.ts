import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { seedCriticalE2E } from "../../scripts/seed-e2e-critical";
import {
  CRITICAL_E2E_IDS,
  criticalE2EStorageState,
  type CriticalE2ERole,
} from "./fixtures";

type TrpcResult =
  | { ok: true; data: any }
  | { ok: false; code: string | undefined; message: string | undefined };

const openContexts = new Set<BrowserContext>();

async function openRolePage(browser: Browser, role: CriticalE2ERole) {
  const context = await browser.newContext({
    storageState: criticalE2EStorageState(role),
  });
  openContexts.add(context);
  context.on("close", () => openContexts.delete(context));
  const page = await context.newPage();
  await page.goto("/api/health");
  return { context, page };
}

async function trpcQuery(
  page: Page,
  path: string,
  input: Record<string, unknown>
): Promise<TrpcResult> {
  return page.evaluate(
    async ({ procedurePath, procedureInput }) => {
      const envelope = { "0": { json: procedureInput } };
      const query = new URLSearchParams({
        batch: "1",
        input: JSON.stringify(envelope),
      });
      const response = await fetch(
        `/api/trpc/${procedurePath}?${query.toString()}`,
        { credentials: "include" }
      );
      const body = await response.json();
      const item = Array.isArray(body) ? body[0] : body;
      if (item?.error) {
        const error = item.error.json ?? item.error;
        return {
          ok: false as const,
          code: error.data?.code,
          message: error.message,
        };
      }
      return { ok: true as const, data: item?.result?.data?.json };
    },
    { procedurePath: path, procedureInput: input }
  );
}

function success(result: TrpcResult) {
  expect(result.ok, result.ok ? undefined : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message ?? "tRPC request failed");
  return result.data;
}

function forbidden(result: TrpcResult) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected tRPC request to fail");
  expect(result.code).toBe("FORBIDDEN");
}

function unauthorized(result: TrpcResult) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected tRPC request to fail");
  expect(result.code).toBe("UNAUTHORIZED");
}

function rowIds(rows: Array<{ id: number }>) {
  return rows.map(row => row.id).sort((left, right) => left - right);
}

const a1BulkIds = Array.from(
  { length: 10 },
  (_, index) => CRITICAL_E2E_IDS.customers.unassignedTeamA1BulkStart + index
);
const a1DatabaseIds = [
  CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
  ...a1BulkIds,
].sort((left, right) => left - right);
const a1UnassignedIds = [
  ...a1DatabaseIds,
  CRITICAL_E2E_IDS.customers.unassignedTeamA1Contracted,
].sort((left, right) => left - right);
const subBranchAUnassignedIds = [
  ...a1UnassignedIds,
  CRITICAL_E2E_IDS.customers.unassignedTeamA2,
].sort((left, right) => left - right);

async function customerList(page: Page, input: Record<string, unknown>) {
  return success(await trpcQuery(page, "customers.list", input));
}

async function segmentCounts(page: Page, input: Record<string, unknown>) {
  return success(await trpcQuery(page, "customers.segmentCounts", input));
}

test.describe("critical unassigned customer organization scope", () => {
  test.beforeEach(async () => {
    await seedCriticalE2E();
  });

  test.afterEach(async () => {
    await Promise.allSettled(
      Array.from(openContexts).map(async context => context.close())
    );
    openContexts.clear();
  });

  test("branch admin sees the branch pool while sub-branch A excludes B and unowned rows", async ({
    browser,
  }) => {
    const branch = await openRolePage(browser, "branchAdmin");
    const branchRows = await customerList(branch.page, {
      unassigned: true,
      page: 1,
      pageSize: 100,
    });
    expect(branchRows).toHaveLength(15);
    expect(rowIds(branchRows)).toEqual(
      expect.arrayContaining([
        CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
        CRITICAL_E2E_IDS.customers.unassignedTeamA1Contracted,
        CRITICAL_E2E_IDS.customers.unassignedTeamA2,
        CRITICAL_E2E_IDS.customers.unassignedTeamB1,
        CRITICAL_E2E_IDS.customers.unassignedNoOrganization,
      ])
    );

    const subBranch = await openRolePage(browser, "subBranchAdmin");
    const subRows = await customerList(subBranch.page, {
      unassigned: true,
      page: 1,
      pageSize: 100,
    });
    expect(rowIds(subRows)).toEqual(subBranchAUnassignedIds);
    expect(rowIds(subRows)).not.toContain(
      CRITICAL_E2E_IDS.customers.unassignedTeamB1
    );
    expect(rowIds(subRows)).not.toContain(
      CRITICAL_E2E_IDS.customers.unassignedNoOrganization
    );

    const counts = await segmentCounts(subBranch.page, { unassigned: true });
    expect(counts).toEqual({ all: 13, database: 12, contracted: 1 });

    await branch.context.close();
    await subBranch.context.close();
  });

  test("team A1 applies scope before pagination and combines search, status, and segment filters", async ({
    browser,
  }) => {
    const { context, page } = await openRolePage(browser, "teamLeader");
    const firstPage = await customerList(page, {
      unassigned: true,
      page: 1,
      pageSize: 10,
      sort: "recent",
    });
    const secondPage = await customerList(page, {
      unassigned: true,
      page: 2,
      pageSize: 10,
      sort: "recent",
    });
    const thirdPage = await customerList(page, {
      unassigned: true,
      page: 3,
      pageSize: 10,
      sort: "recent",
    });
    expect(firstPage).toHaveLength(10);
    expect(secondPage).toHaveLength(2);
    expect(thirdPage).toEqual([]);
    expect(rowIds([...firstPage, ...secondPage])).toEqual(a1UnassignedIds);
    expect(await segmentCounts(page, { unassigned: true })).toEqual({
      all: 12,
      database: 11,
      contracted: 1,
    });

    const searched = await customerList(page, {
      unassigned: true,
      search: "Shared Scope Token",
    });
    expect(rowIds(searched)).toEqual([
      CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
    ]);

    const statusFiltered = await customerList(page, {
      unassigned: true,
      status: "상담예정",
    });
    expect(rowIds(statusFiltered)).toEqual([
      CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
      CRITICAL_E2E_IDS.customers.unassignedTeamA1Contracted,
    ]);

    expect(
      rowIds(
        await customerList(page, {
          unassigned: true,
          segment: "database",
        })
      )
    ).toEqual(a1DatabaseIds);
    expect(
      rowIds(
        await customerList(page, {
          unassigned: true,
          segment: "contracted",
        })
      )
    ).toEqual([CRITICAL_E2E_IDS.customers.unassignedTeamA1Contracted]);
    await context.close();
  });

  test("client-supplied organization ids cannot widen team or sub-branch scope", async ({
    browser,
  }) => {
    const team = await openRolePage(browser, "teamLeader");
    const injectedTeam = await customerList(team.page, {
      unassigned: true,
      teamId: CRITICAL_E2E_IDS.teams.branchB,
      subBranchAdminId: CRITICAL_E2E_IDS.users.subBranchAdminB,
    });
    expect(rowIds(injectedTeam)).toEqual(a1UnassignedIds);
    forbidden(
      await trpcQuery(team.page, "customers.list", {
        unassigned: true,
        agentIdFilter: CRITICAL_E2E_IDS.users.memberB,
      })
    );

    const subBranch = await openRolePage(browser, "subBranchAdmin");
    const injectedSubBranch = await customerList(subBranch.page, {
      unassigned: true,
      teamId: CRITICAL_E2E_IDS.teams.branchB,
      subBranchAdminId: CRITICAL_E2E_IDS.users.subBranchAdminB,
    });
    expect(rowIds(injectedSubBranch)).toEqual(subBranchAUnassignedIds);
    expect(
      success(
        await trpcQuery(subBranch.page, "customers.get", {
          id: CRITICAL_E2E_IDS.customers.unassignedTeamA2,
        })
      )
    ).toMatchObject({
      id: CRITICAL_E2E_IDS.customers.unassignedTeamA2,
    });
    forbidden(
      await trpcQuery(subBranch.page, "customers.get", {
        id: CRITICAL_E2E_IDS.customers.unassignedTeamB1,
      })
    );

    await team.context.close();
    await subBranch.context.close();
  });

  test("direct customer access enforces the authenticated organization scope", async ({
    browser,
  }) => {
    const cases: Array<{
      role: CriticalE2ERole;
      allowedIds: number[];
      forbiddenIds: number[];
    }> = [
      {
        role: "branchAdmin",
        allowedIds: [
          CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
          CRITICAL_E2E_IDS.customers.unassignedTeamB1,
          CRITICAL_E2E_IDS.customers.unassignedNoOrganization,
        ],
        forbiddenIds: [],
      },
      {
        role: "teamLeader",
        allowedIds: [CRITICAL_E2E_IDS.customers.unassignedTeamA1Database],
        forbiddenIds: [
          CRITICAL_E2E_IDS.customers.unassignedTeamA2,
          CRITICAL_E2E_IDS.customers.unassignedTeamB1,
        ],
      },
      {
        role: "otherTeamLeader",
        allowedIds: [CRITICAL_E2E_IDS.customers.unassignedTeamA2],
        forbiddenIds: [
          CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
          CRITICAL_E2E_IDS.customers.unassignedTeamB1,
        ],
      },
      {
        role: "subBranchAdminB",
        allowedIds: [CRITICAL_E2E_IDS.customers.unassignedTeamB1],
        forbiddenIds: [CRITICAL_E2E_IDS.customers.unassignedTeamA1Database],
      },
      {
        role: "teamLeaderB",
        allowedIds: [CRITICAL_E2E_IDS.customers.unassignedTeamB1],
        forbiddenIds: [CRITICAL_E2E_IDS.customers.unassignedTeamA1Database],
      },
    ];

    for (const { role, allowedIds, forbiddenIds } of cases) {
      const actor = await openRolePage(browser, role);
      for (const id of allowedIds) {
        expect(
          success(await trpcQuery(actor.page, "customers.get", { id }))
        ).toMatchObject({ id });
      }
      for (const id of forbiddenIds) {
        forbidden(await trpcQuery(actor.page, "customers.get", { id }));
      }
      await actor.context.close();
    }

    const member = await openRolePage(browser, "member");
    forbidden(
      await trpcQuery(member.page, "customers.get", {
        id: CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
      })
    );
    await member.context.close();
  });

  test("member gets an empty unassigned result and inactive or resigned users are blocked", async ({
    browser,
  }) => {
    const member = await openRolePage(browser, "member");
    expect(await customerList(member.page, { unassigned: true })).toEqual([]);
    expect(await segmentCounts(member.page, { unassigned: true })).toEqual({
      all: 0,
      database: 0,
      contracted: 0,
    });

    for (const role of ["inactive", "resigned"] as const) {
      const actor = await openRolePage(browser, role);
      unauthorized(
        await trpcQuery(actor.page, "customers.list", { unassigned: true })
      );
      unauthorized(
        await trpcQuery(actor.page, "customers.segmentCounts", {
          unassigned: true,
        })
      );
      unauthorized(
        await trpcQuery(actor.page, "customers.get", {
          id: CRITICAL_E2E_IDS.customers.unassignedTeamA1Database,
        })
      );
      await actor.context.close();
    }
    await member.context.close();
  });

  test("the same fixture produces different results solely from the authenticated role", async ({
    browser,
  }) => {
    const expectedCounts: Record<CriticalE2ERole, number> = {
      branchAdmin: 15,
      subBranchAdmin: 13,
      subBranchAdminB: 1,
      teamLeader: 12,
      otherTeamLeader: 1,
      teamLeaderB: 1,
      member: 0,
      inactive: 0,
      resigned: 0,
    };
    for (const role of [
      "branchAdmin",
      "subBranchAdmin",
      "subBranchAdminB",
      "teamLeader",
      "otherTeamLeader",
      "teamLeaderB",
      "member",
    ] as const) {
      const actor = await openRolePage(browser, role);
      expect(
        await segmentCounts(actor.page, { unassigned: true })
      ).toMatchObject({ all: expectedCounts[role] });
      await actor.context.close();
    }
  });
});
