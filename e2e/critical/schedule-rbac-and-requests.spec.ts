import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  CRITICAL_E2E_IDS,
  criticalE2EStorageState,
  type CriticalE2ERole,
} from "./fixtures";
import { seedCriticalE2E } from "../../scripts/seed-e2e-critical";

type TrpcResult =
  | { ok: true; data: any }
  | { ok: false; code: string | undefined; message: string | undefined };

const openContexts = new Set<BrowserContext>();

async function openRolePage(
  browser: Browser,
  role: CriticalE2ERole,
  path = "/api/health"
) {
  const context = await browser.newContext({
    storageState: criticalE2EStorageState(role),
  });
  openContexts.add(context);
  context.on("close", () => openContexts.delete(context));
  const page = await context.newPage();
  await page.goto(path);
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

async function organizationSchedules(page: Page) {
  return expectTrpcSuccess(
    await trpcCall(
      page,
      "schedules.list",
      { viewMode: "organization" },
      "query"
    )
  ).schedules as Array<Record<string, any>>;
}

test.describe("critical schedule RBAC and approval flow", () => {
  test.beforeEach(async () => {
    await seedCriticalE2E();
  });

  test.afterEach(async () => {
    await Promise.allSettled(
      [...openContexts].map(async context => context.close())
    );
    openContexts.clear();
  });

  test("E2E-01 all active roles can view organization schedules and approved shared details", async ({
    browser,
  }) => {
    for (const role of [
      "branchAdmin",
      "subBranchAdmin",
      "teamLeader",
      "member",
    ] as const) {
      const { context, page } = await openRolePage(browser, role, "/calendar");
      await expect(
        page.getByRole("heading", { name: "일정관리" })
      ).toBeVisible();
      await page.getByRole("button", { name: "전체 일정" }).click();
      await expect(
        page.getByText("[TEST] 팀원 고객 일정", { exact: true }).first()
      ).toBeVisible();
      await page
        .getByText("[TEST] 팀원 고객 일정", { exact: true })
        .first()
        .click();
      const detailDialog = page.getByRole("dialog");
      await expect(
        detailDialog.getByText("[TEST] E2E 고객 A", { exact: true })
      ).toBeVisible();
      await expect(
        detailDialog.getByText("[TEST] 합성 상담내용", { exact: true })
      ).toBeVisible();
      await context.close();
    }
  });

  test("E2E-02 non-admin can view but cannot directly update or delete another user's schedule", async ({
    browser,
  }) => {
    const { context, page } = await openRolePage(
      browser,
      "teamLeader",
      "/calendar"
    );
    await page.getByRole("button", { name: "전체 일정" }).click();
    await page
      .getByText("[TEST] 팀원 고객 일정", { exact: true })
      .first()
      .click();
    const detailDialog = page.getByRole("dialog");
    await expect(
      detailDialog.getByText("조회 전용", { exact: true })
    ).toBeVisible();
    await expect(
      detailDialog.getByRole("button", { name: "수정", exact: true })
    ).toHaveCount(0);
    await expect(
      detailDialog.getByRole("button", { name: "삭제", exact: true })
    ).toHaveCount(0);
    await expect(
      detailDialog.getByRole("button", { name: "변경 요청", exact: true })
    ).toBeVisible();

    expectTrpcError(
      await trpcCall(
        page,
        "schedules.update",
        { id: CRITICAL_E2E_IDS.schedules.member, title: "[TEST] 우회 수정" },
        "mutation"
      ),
      "FORBIDDEN"
    );
    expectTrpcError(
      await trpcCall(
        page,
        "schedules.delete",
        { id: CRITICAL_E2E_IDS.schedules.member },
        "mutation"
      ),
      "FORBIDDEN"
    );
    await context.close();
  });

  test("E2E-03 sub-branch admin request stays pending and does not immediately change the source schedule", async ({
    browser,
  }) => {
    const { context, page } = await openRolePage(browser, "subBranchAdmin");
    const result = expectTrpcSuccess(
      await trpcCall(
        page,
        "scheduleChangeRequests.requestUpdate",
        {
          scheduleId: CRITICAL_E2E_IDS.schedules.teamLeader,
          reason: "[TEST] 부지점장 변경 요청",
          payload: { title: "[TEST] 팀장 일정 요청안" },
        },
        "mutation"
      )
    );
    expect(result.requestId).toBeGreaterThan(0);

    const requests = expectTrpcSuccess(
      await trpcCall(page, "scheduleChangeRequests.listMy", {}, "query")
    );
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: result.requestId, status: "pending" }),
      ])
    );
    const schedules = await organizationSchedules(page);
    expect(
      schedules.find(item => item.id === CRITICAL_E2E_IDS.schedules.teamLeader)
        ?.title
    ).toBe("[TEST] 팀장 일정");
    await context.close();
  });

  test("E2E-04 team leader can request for a subordinate member but not another team member", async ({
    browser,
  }) => {
    const { context, page } = await openRolePage(browser, "teamLeader");
    const allowed = expectTrpcSuccess(
      await trpcCall(
        page,
        "scheduleChangeRequests.requestUpdate",
        {
          scheduleId: CRITICAL_E2E_IDS.schedules.member,
          reason: "[TEST] 팀장 산하 일정 요청",
          payload: { title: "[TEST] 팀원 일정 요청안" },
        },
        "mutation"
      )
    );
    expect(allowed.requestId).toBeGreaterThan(0);

    expectTrpcError(
      await trpcCall(
        page,
        "scheduleChangeRequests.requestUpdate",
        {
          scheduleId: CRITICAL_E2E_IDS.schedules.otherMember,
          reason: "[TEST] 타팀 우회 요청",
          payload: { title: "[TEST] 허용되면 안 됨" },
        },
        "mutation"
      ),
      "FORBIDDEN"
    );
    await context.close();
  });

  test("E2E-05 member has no request UI and direct request API is forbidden", async ({
    browser,
  }) => {
    const { context, page } = await openRolePage(
      browser,
      "member",
      "/calendar"
    );
    await page.getByRole("button", { name: "전체 일정" }).click();
    await page.getByText("[TEST] 팀장 일정", { exact: true }).first().click();
    const detailDialog = page.getByRole("dialog");
    await expect(
      detailDialog.getByText("조회 전용", { exact: true })
    ).toBeVisible();
    await expect(
      detailDialog.getByRole("button", { name: "변경 요청", exact: true })
    ).toHaveCount(0);
    await expect(
      detailDialog.getByRole("button", { name: "삭제 요청", exact: true })
    ).toHaveCount(0);

    expectTrpcError(
      await trpcCall(
        page,
        "scheduleChangeRequests.requestUpdate",
        {
          scheduleId: CRITICAL_E2E_IDS.schedules.teamLeader,
          reason: "[TEST] 팀원 우회 요청",
          payload: { title: "[TEST] 허용되면 안 됨" },
        },
        "mutation"
      ),
      "FORBIDDEN"
    );
    await context.close();
  });

  test("E2E-06 branch admin approval through UI applies the pending request", async ({
    browser,
  }) => {
    const requester = await openRolePage(browser, "subBranchAdmin");
    const reason = "[TEST] 승인 자동반영 요청";
    const requestedTitle = "[TEST] 승인 반영 완료 일정";
    const created = expectTrpcSuccess(
      await trpcCall(
        requester.page,
        "scheduleChangeRequests.requestUpdate",
        {
          scheduleId: CRITICAL_E2E_IDS.schedules.approval,
          reason,
          payload: { title: requestedTitle },
        },
        "mutation"
      )
    );
    const approvedRequestId = created.requestId;
    await requester.context.close();

    const admin = await openRolePage(
      browser,
      "branchAdmin",
      "/schedule-change-requests"
    );
    const row = admin.page
      .getByText(reason, { exact: true })
      .locator("xpath=ancestor::tr");
    await row.getByRole("button", { name: "상세" }).click();
    await expect(
      admin.page.getByRole("heading", { name: "일정 변경 요청 상세" })
    ).toBeVisible();
    await admin.page.getByRole("button", { name: "승인 및 반영" }).click();
    await expect(
      admin.page.getByRole("heading", { name: "요청을 승인할까요?" })
    ).toBeVisible();
    await admin.page.getByRole("button", { name: "승인 및 반영" }).click();
    await expect(
      admin.page.getByText("일정 요청을 승인하고 반영했습니다.")
    ).toBeVisible();

    const detail = expectTrpcSuccess(
      await trpcCall(
        admin.page,
        "scheduleChangeRequests.getDetail",
        { id: approvedRequestId },
        "query"
      )
    );
    expect(detail.status).toBe("approved");
    const schedules = await organizationSchedules(admin.page);
    expect(
      schedules.find(item => item.id === CRITICAL_E2E_IDS.schedules.approval)
        ?.title
    ).toBe(requestedTitle);
    await admin.context.close();
  });

  test("E2E-07 a processed request cannot be approved twice", async ({
    browser,
  }) => {
    const requester = await openRolePage(browser, "subBranchAdmin");
    const created = expectTrpcSuccess(
      await trpcCall(
        requester.page,
        "scheduleChangeRequests.requestUpdate",
        {
          scheduleId: CRITICAL_E2E_IDS.schedules.approval,
          reason: "[TEST] 재승인 차단 요청",
          payload: { title: "[TEST] 최초 승인 결과" },
        },
        "mutation"
      )
    );
    await requester.context.close();

    const { context, page } = await openRolePage(browser, "branchAdmin");
    expectTrpcSuccess(
      await trpcCall(
        page,
        "scheduleChangeRequests.approve",
        { id: created.requestId },
        "mutation"
      )
    );
    expectTrpcError(
      await trpcCall(
        page,
        "scheduleChangeRequests.approve",
        { id: created.requestId },
        "mutation"
      ),
      "CONFLICT"
    );
    const schedules = await organizationSchedules(page);
    expect(
      schedules.find(item => item.id === CRITICAL_E2E_IDS.schedules.approval)
        ?.title
    ).toBe("[TEST] 최초 승인 결과");
    await context.close();
  });

  test("E2E-08 source changes cause approval conflict without overwriting the schedule", async ({
    browser,
  }) => {
    const requester = await openRolePage(browser, "subBranchAdmin");
    const created = expectTrpcSuccess(
      await trpcCall(
        requester.page,
        "scheduleChangeRequests.requestUpdate",
        {
          scheduleId: CRITICAL_E2E_IDS.schedules.conflict,
          reason: "[TEST] 충돌 감지 요청",
          payload: { title: "[TEST] 충돌 요청안" },
        },
        "mutation"
      )
    );
    await requester.context.close();

    const admin = await openRolePage(browser, "branchAdmin");
    expectTrpcSuccess(
      await trpcCall(
        admin.page,
        "schedules.update",
        {
          id: CRITICAL_E2E_IDS.schedules.conflict,
          title: "[TEST] 지점장 최신 수정",
        },
        "mutation"
      )
    );
    const approval = expectTrpcSuccess(
      await trpcCall(
        admin.page,
        "scheduleChangeRequests.approve",
        { id: created.requestId },
        "mutation"
      )
    );
    expect(approval.status).toBe("conflict");

    const detail = expectTrpcSuccess(
      await trpcCall(
        admin.page,
        "scheduleChangeRequests.getDetail",
        { id: created.requestId },
        "query"
      )
    );
    expect(detail.status).toBe("conflict");
    const schedules = await organizationSchedules(admin.page);
    expect(
      schedules.find(item => item.id === CRITICAL_E2E_IDS.schedules.conflict)
        ?.title
    ).toBe("[TEST] 지점장 최신 수정");
    await admin.context.close();
  });
});
