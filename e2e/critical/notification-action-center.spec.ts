import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  CRITICAL_E2E_BULK_NOTIFICATION_COUNT,
  CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS,
  CRITICAL_E2E_IDS,
  criticalE2EStorageState,
  type CriticalE2ERole,
} from "./fixtures";
import { seedCriticalE2E } from "../../scripts/seed-e2e-critical";

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

async function trpcCall(
  page: Page,
  path: string,
  input: unknown,
  kind: "query" | "mutation"
): Promise<TrpcResult> {
  return page.evaluate(
    async ({ procedurePath, procedureInput, procedureKind }) => {
      const envelope = { "0": { json: procedureInput } };
      const query = new URLSearchParams({
        batch: "1",
        ...(procedureKind === "query"
          ? { input: JSON.stringify(envelope) }
          : {}),
      });
      const response = await fetch(
        `/api/trpc/${procedurePath}?${query.toString()}`,
        procedureKind === "mutation"
          ? {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(envelope),
            }
          : { credentials: "include" }
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
    { procedurePath: path, procedureInput: input, procedureKind: kind }
  );
}

function expectTrpcSuccess(result: TrpcResult) {
  expect(result.ok, result.ok ? undefined : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message ?? "tRPC request failed");
  return result.data;
}

function expectTrpcError(result: TrpcResult, code: string) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected tRPC request to fail");
  expect(result.code).toBe(code);
}

async function notificationList(page: Page, input: Record<string, unknown>) {
  return expectTrpcSuccess(
    await trpcCall(page, "notifications.list", input, "query")
  );
}

test.describe("critical notification action center and operation risk", () => {
  test.beforeEach(async () => {
    await seedCriticalE2E();
  });

  test.afterEach(async () => {
    await Promise.allSettled(
      Array.from(openContexts).map(async context => context.close())
    );
    openContexts.clear();
  });

  test("E2E-N01 list, scoped unread count, and personal badge share the documented role policy", async ({
    browser,
  }) => {
    const cases = [
      {
        role: "branchAdmin",
        total: CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.branchTotal,
        scopedUnread: CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.branchUnread,
        myUnread: 1,
      },
      {
        role: "subBranchAdmin",
        total: CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.subBranchScopedTotal,
        scopedUnread:
          CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.subBranchScopedUnread,
        myUnread: 1,
      },
      {
        role: "teamLeader",
        total: CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.teamLeaderScopedTotal,
        scopedUnread:
          CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.teamLeaderScopedUnread,
        myUnread: 1,
      },
      {
        role: "member",
        total: CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.memberTotal,
        scopedUnread: CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.memberUnread,
        myUnread: CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.memberUnread,
      },
    ] as const;

    for (const item of cases) {
      const { context, page } = await openRolePage(browser, item.role);
      const list = await notificationList(page, { limit: 200, offset: 0 });
      const scopedUnread = expectTrpcSuccess(
        await trpcCall(page, "notifications.unreadCount", null, "query")
      );
      const myUnread = expectTrpcSuccess(
        await trpcCall(page, "notifications.myUnreadCount", null, "query")
      );

      expect(list.totalCount).toBe(item.total);
      expect(scopedUnread).toBe(item.scopedUnread);
      expect(myUnread).toBe(item.myUnread);
      await context.close();
    }
  });

  test("E2E-N02 action-required classification, source availability, facets, and pagination use actual joined rows", async ({
    browser,
  }) => {
    const { context, page } = await openRolePage(browser, "member");
    const list = await notificationList(page, { limit: 100, offset: 0 });
    const byId = new Map(
      list.items.map((item: Record<string, any>) => [item.id, item])
    );

    for (const id of [
      CRITICAL_E2E_IDS.notifications.activeUncontacted,
      CRITICAL_E2E_IDS.notifications.activeLongUnmanaged,
      CRITICAL_E2E_IDS.notifications.activeReconsult,
      CRITICAL_E2E_IDS.notifications.activeContract,
      CRITICAL_E2E_IDS.notifications.activeSchedule,
      CRITICAL_E2E_IDS.notifications.activeFollowUp,
    ]) {
      expect(byId.get(id)?.actionRequired).toBe(true);
      expect(byId.get(id)?.sourceAvailable).toBe(true);
    }

    expect(
      byId.get(CRITICAL_E2E_IDS.notifications.completedReconsult)
        ?.actionRequired
    ).toBe(false);
    for (const id of [
      CRITICAL_E2E_IDS.notifications.deletedCustomer,
      CRITICAL_E2E_IDS.notifications.mergedCustomer,
      CRITICAL_E2E_IDS.notifications.deletedContract,
      CRITICAL_E2E_IDS.notifications.deletedSchedule,
      CRITICAL_E2E_IDS.notifications.deletedFollowUp,
      CRITICAL_E2E_IDS.notifications.missingSource,
      CRITICAL_E2E_IDS.notifications.outsideSource,
      CRITICAL_E2E_IDS.notifications.inactiveCustomer,
    ]) {
      expect(byId.get(id)?.actionRequired).toBe(false);
      expect(byId.get(id)?.sourceAvailable).toBe(false);
      expect(byId.get(id)?.targetAvailable).toBe(false);
    }

    expect(list.counts.actionRequired).toBe(
      CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.memberActionRequired
    );
    expect(
      list.items.filter((item: Record<string, any>) => item.sourceAvailable)
    ).toHaveLength(
      CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.memberSourceAvailable
    );
    expect(list.counts.byCategory).toEqual({
      schedule: 2,
      customer_follow_up: 13,
      approval_admin: 0,
      system: 0,
    });
    expect(list.counts.byPriority).toEqual({
      urgent: 10,
      today: 0,
      general: 4,
      done: 1,
    });

    const actionPage = await notificationList(page, {
      actionRequired: true,
      limit: 2,
      offset: 0,
    });
    expect(actionPage.items).toHaveLength(2);
    expect(actionPage.totalCount).toBe(
      CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.memberActionRequired
    );
    expect(actionPage.hasMore).toBe(true);
    expect(actionPage.nextOffset).toBe(2);
    await context.close();
  });

  test("E2E-N03 individual mutation scope is enforced and mark-all remains personal", async ({
    browser,
  }) => {
    const leader = await openRolePage(browser, "teamLeader");
    expectTrpcError(
      await trpcCall(
        leader.page,
        "notifications.markRead",
        { id: CRITICAL_E2E_IDS.notifications.otherMember },
        "mutation"
      ),
      "FORBIDDEN"
    );
    expectTrpcError(
      await trpcCall(
        leader.page,
        "notifications.updateProcessStatus",
        {
          id: CRITICAL_E2E_IDS.notifications.otherMember,
          processStatus: "처리완료",
        },
        "mutation"
      ),
      "FORBIDDEN"
    );

    expectTrpcSuccess(
      await trpcCall(leader.page, "notifications.markAllRead", null, "mutation")
    );
    expect(
      expectTrpcSuccess(
        await trpcCall(
          leader.page,
          "notifications.myUnreadCount",
          null,
          "query"
        )
      )
    ).toBe(0);
    expect(
      expectTrpcSuccess(
        await trpcCall(leader.page, "notifications.unreadCount", null, "query")
      )
    ).toBe(
      CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.teamLeaderScopedUnread - 1
    );

    const member = await openRolePage(browser, "member");
    expect(
      expectTrpcSuccess(
        await trpcCall(
          member.page,
          "notifications.myUnreadCount",
          null,
          "query"
        )
      )
    ).toBe(CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.memberUnread);
    await leader.context.close();
    await member.context.close();
  });

  test("E2E-N04 operation risk aggregates beyond 1000 rows and does not double-count a pending delete request", async ({
    browser,
  }) => {
    const { context, page } = await openRolePage(browser, "branchAdmin");
    const report = expectTrpcSuccess(
      await trpcCall(page, "operationRisk.summary", { period: "7d" }, "query")
    );
    const deletionCard = report.riskCards.find(
      (card: Record<string, any>) => card.category === "deletion"
    );

    expect(report.unresolvedWorkRisk.unreadNotificationCount).toBe(
      CRITICAL_E2E_EXPECTED_NOTIFICATION_COUNTS.branchUnread
    );
    expect(report.handoffRisk.inactiveNotificationCount).toBe(
      CRITICAL_E2E_BULK_NOTIFICATION_COUNT + 1
    );
    expect(report.deletionRisk.total).toBe(1);
    expect(report.deletionRisk.pendingDeleteRequestCount).toBe(1);
    expect(deletionCard.count).toBe(1);
    expect(deletionCard.actionRequiredCount).toBeUndefined();
    expect(deletionCard.actionLevel).toBe("action_required");
    await context.close();
  });
});
