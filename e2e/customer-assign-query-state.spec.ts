import { expect, test, type Page } from "@playwright/test";
import SuperJSON from "superjson";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  expectClickCenterReachable,
  expectNoHorizontalOverflow,
} from "./helpers/layout-metrics";

const rows = [
  {
    id: 91001,
    name: "[TEST] 배정가",
    phone: "010-0000-0001",
    region: "합성지역",
    source: "소개",
    consultStatus: "미상담",
    assignmentStatus: "assigned_to_sub_branch",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 91002,
    name: "[TEST] 배정나",
    phone: "010-0000-0002",
    region: "합성지역",
    source: "온라인",
    consultStatus: "부재",
    assignmentStatus: "unassigned",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];
const success = (data: unknown) => ({
  result: { data: SuperJSON.serialize(data) },
});
const failure = (
  code = "INTERNAL_SERVER_ERROR",
  message = "Failed to fetch"
) => ({
  error: SuperJSON.serialize({
    message,
    code:
      code === "UNAUTHORIZED" ? -32001 : code === "FORBIDDEN" ? -32003 : -32603,
    data: {
      code,
      httpStatus:
        code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 500,
    },
  }),
});
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(resolveValue => {
    resolve = resolveValue;
  });
  return { promise, resolve };
}
type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
async function setup(page: Page, role: Role = "branch_admin") {
  let response: unknown = success(rows);
  let usersResponse: unknown;
  let authPatch: Record<string, unknown> = {};
  let listCalls = 0;
  const mutationCalls: string[] = [];
  const listInputs: unknown[] = [];
  // No external request or real mutation can leave this synthetic test context.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  page.on("request", request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/trpc/")) return;
    const procedures = decodeURIComponent(
      url.pathname.split("/api/trpc/")[1]
    ).split(",");
    if (request.method() === "POST") mutationCalls.push(...procedures);
    const inputs = JSON.parse(url.searchParams.get("input") ?? "{}");
    procedures.forEach((procedure, index) => {
      if (procedure === "customers.list")
        listInputs.push(inputs[String(index)]);
    });
  });
  await mockBoaTrpc(page, role, {
    transformResponse: (procedure, original) => {
      if (procedure === "customers.list") {
        listCalls++;
        return typeof response === "function" ? response() : response;
      }
      if (procedure === "users.list" && usersResponse !== undefined)
        return usersResponse;
      if (procedure === "auth.me") {
        const user = SuperJSON.deserialize(
          (original as any).result.data
        ) as object;
        return success({ ...user, ...authPatch });
      }
      return original;
    },
  });
  return {
    setResponse(value: unknown) {
      response = value;
    },
    setUsersResponse(value: unknown) {
      usersResponse = value;
    },
    setAuth(value: Record<string, unknown>) {
      authPatch = value;
    },
    get listCalls() {
      return listCalls;
    },
    mutationCalls,
    listInputs,
  };
}
async function refresh(page: Page, reconnect = false) {
  await page.evaluate(reconnect => {
    if (reconnect) {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    } else window.dispatchEvent(new Event("visibilitychange"));
  }, reconnect);
}
async function selectTargetAndCustomer(page: Page, distribution = false) {
  await page.getByRole("combobox").first().click();
  await page
    .getByRole("option", {
      name: distribution ? /\[E2E\] Sub Admin/ : /\[E2E\] Member/,
    })
    .click();
  await page
    .getByRole("checkbox", {
      name: "현재 페이지 배정 대상 고객 1번 행 선택",
      exact: true,
    })
    .check();
}

test.describe("P2-01 assignment query states (synthetic only)", () => {
  test("A01 pending never looks like zero", async ({ page }) => {
    const mock = await setup(page);
    const pending = deferred();
    mock.setResponse(pending.promise);
    await page.goto("/customers/assign");
    await expect(
      page.getByText("고객 목록을 불러오는 중입니다", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("미배정 고객 DB가 없습니다.", { exact: true })
    ).toHaveCount(0);
    await expect(page.getByText("전체 0건", { exact: true })).toHaveCount(0);
    pending.resolve(success(rows));
  });

  test("A02 initial network failure has retry and unavailable counts", async ({
    page,
  }) => {
    const mock = await setup(page);
    mock.setResponse(failure());
    await page.goto("/customers/assign");
    await expect(
      page.getByText("고객 목록을 불러오지 못했습니다", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "다시 불러오기", exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("전체 확인 불가", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("필터 결과 확인 불가", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("미배정 고객 DB가 없습니다.", { exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "배정하기",
        exact: true,
        includeHidden: true,
      })
    ).toBeDisabled();
  });

  test("A03 only successful zero shows normal empty state", async ({
    page,
  }) => {
    const mock = await setup(page);
    mock.setResponse(success([]));
    await page.goto("/customers/assign");
    await expect(
      page.getByText("미배정 고객 DB가 없습니다.", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("전체 0건", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "다시 불러오기", exact: true })
    ).toHaveCount(0);
  });

  for (const role of [
    "branch_admin",
    "sub_branch_admin",
    "team_leader",
  ] as const) {
    test(`A04 successful list and confirmation remain available for ${role}`, async ({
      page,
    }) => {
      const mock = await setup(page, role);
      await page.goto("/customers/assign");
      await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
      await selectTargetAndCustomer(page);
      await page.getByRole("button", { name: "1명 배정", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "배정 확정", exact: true })
      ).toBeEnabled();
      await page.keyboard.press("Escape");
      expect(mock.mutationCalls).toEqual([]);
    });
  }

  test("A05 filter-only zero has its own message and reset", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/customers/assign");
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
    await page
      .getByPlaceholder("고객명, 지역, 유입경로 검색")
      .fill("존재하지않는합성검색");
    await expect(
      page.getByText("검색·필터 조건에 맞는 고객이 없습니다", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("전체 2건", { exact: true })).toBeVisible();
    await expect(
      page.getByText("필터 결과 0건", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("미배정 고객 DB가 없습니다.", { exact: true })
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "필터 초기화", exact: true })
      .click();
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
  });

  test("A06 retry preserves search, both filters and query input", async ({
    page,
  }) => {
    const mock = await setup(page);
    await page.goto("/customers/assign");
    const search = page.getByPlaceholder("고객명, 지역, 유입경로 검색");
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
    await search.fill("배정가");
    if ((page.viewportSize()?.width ?? 1440) < 768)
      await page.getByRole("button", { name: /^필터/ }).first().click();
    const filters =
      (page.viewportSize()?.width ?? 1440) < 768
        ? page.getByRole("dialog").getByRole("combobox")
        : page.getByRole("combobox");
    await filters
      .nth((page.viewportSize()?.width ?? 1440) < 768 ? 0 : 1)
      .click();
    await page.getByRole("option", { name: "미상담", exact: true }).click();
    await filters
      .nth((page.viewportSize()?.width ?? 1440) < 768 ? 1 : 2)
      .click();
    await page.getByRole("option", { name: "소개", exact: true }).click();
    if ((page.viewportSize()?.width ?? 1440) < 768)
      await page.getByRole("button", { name: "적용", exact: true }).click();
    mock.setResponse(failure());
    await refresh(page);
    const retry = page.getByRole("button", {
      name: "다시 불러오기",
      exact: true,
    });
    await expect(retry).toBeVisible();
    const lastInput = mock.listInputs.at(-1);
    mock.setResponse(success(rows));
    await retry.click();
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
    await expect(page.getByText(rows[1].name, { exact: true })).toHaveCount(0);
    await expect(search).toHaveValue("배정가");
    await expect(
      page.getByText("필터 결과 1건", { exact: true })
    ).toBeVisible();
    await expect(retry).toHaveCount(0);
    expect(mock.listInputs.at(-1)).toEqual(lastInput);
  });

  for (const distribution of [false, true]) {
    test(`A07 refresh failure blocks an already open ${distribution ? "distribution" : "assignment"} confirmation`, async ({
      page,
    }) => {
      const mock = await setup(page);
      await page.goto("/customers/assign");
      if (distribution)
        await page.getByRole("tab", { name: "부지점장에게 배분" }).click();
      await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
      await selectTargetAndCustomer(page, distribution);
      await page
        .getByRole("button", {
          name: distribution ? "1명 배분" : "1명 배정",
          exact: true,
        })
        .click();
      mock.setResponse(failure());
      await refresh(page);
      const confirm = page
        .getByRole("dialog")
        .getByRole("button", {
          name: distribution ? "배분 확정" : "배정 확정",
          exact: true,
        });
      await expect(confirm).toBeDisabled();
      // A synthetic click on the disabled control must not produce a mutation request.
      await confirm.dispatchEvent("click");
      await page.keyboard.press("Escape");
      await expect(
        page.getByText("최신 상태 확인 실패", { exact: true })
      ).toBeVisible();
      await expect(page.getByText(/마지막 조회 자료/)).toBeVisible();
      await expect(
        page.getByText("전체 확인 불가", { exact: true })
      ).toBeVisible();
      await expect(page.getByText(rows[0].name, { exact: true })).toHaveCount(
        0
      );
      expect(mock.mutationCalls).toEqual([]);
    });
  }

  for (const change of [
    { id: 99, name: "[TEST] 전환계정" },
    {
      teamId: 99,
      subBranchAdminId: 88,
      parentUserId: 88,
      name: "[TEST] 전환조직",
    },
    { role: "sub_branch_admin", id: 2, name: "[TEST] 전환역할" },
  ]) {
    test(`A08 scope switch resets cached list and selection: ${change.name}`, async ({
      page,
    }) => {
      const mock = await setup(page);
      await page.goto("/customers/assign");
      await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
      await selectTargetAndCustomer(page);
      const nextScope = deferred();
      let oldScopeRefetch = true;
      mock.setAuth(change);
      mock.setResponse(() => {
        if (oldScopeRefetch) {
          oldScopeRefetch = false;
          return success(rows);
        }
        return nextScope.promise;
      });
      await refresh(page, true);
      await expect(
        page.getByText("고객 목록을 불러오는 중입니다", { exact: true })
      ).toBeVisible();
      await expect(page.getByText(rows[0].name, { exact: true })).toHaveCount(
        0
      );
      await expect(page.getByText("전체 2건", { exact: true })).toHaveCount(0);
      await expect(page.getByText("선택 1건", { exact: true })).toHaveCount(0);
      nextScope.resolve(success([]));
      await expect(page.getByText("선택 0건", { exact: true })).toBeVisible();
      await expect(page.getByText("전체 0건", { exact: true })).toBeVisible();
      expect(mock.mutationCalls).toEqual([]);
    });
  }

  test("A09 forbidden refresh hides cached customer data and counts", async ({
    page,
  }) => {
    const mock = await setup(page);
    await page.goto("/customers/assign");
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
    mock.setResponse(failure("FORBIDDEN", "Forbidden"));
    await refresh(page);
    await expect(
      page.getByText("접근 권한이 없습니다", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(rows[0].name, { exact: true })).toHaveCount(0);
    await expect(page.getByText("전체 2건", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("고객 목록을 불러오지 못했습니다", { exact: true })
    ).toHaveCount(0);
  });

  test("A09 session expiration preserves existing login redirect", async ({
    page,
  }) => {
    // Google navigation is fulfilled locally; no OAuth request leaves this browser.
    const mock = await setup(page);
    await page.goto("/customers/assign");
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
    await page.route("https://accounts.google.com/**", route =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Synthetic login</title><p>[TEST] Login redirect reached</p>",
      })
    );
    const loginConfigured = await page.evaluate(async () => {
      const modulePath = "/src/const.ts";
      return (await import(/* @vite-ignore */ modulePath)).getLoginUrlResult()
        .ok as boolean;
    });
    const authErrors: string[] = [];
    page.on("console", message => {
      if (message.text().includes("[Auth] Login URL configuration error:"))
        authErrors.push("configuration error");
    });
    mock.setResponse(failure("UNAUTHORIZED", UNAUTHED_ERR_MSG));
    await refresh(page);
    if (loginConfigured) {
      await expect(page).toHaveURL(
        /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/
      );
      await expect(
        page.getByText("[TEST] Login redirect reached", { exact: true })
      ).toBeVisible();
    } else {
      // Existing unconfigured-login behavior also must preserve the auth error path.
      await expect(
        page.getByText("다시 로그인이 필요합니다", { exact: true })
      ).toBeVisible();
      await expect.poll(() => authErrors.length).toBeGreaterThan(0);
    }
    await expect(page.getByText(rows[0].name, { exact: true })).toHaveCount(0);
  });

  test("users query failure blocks assignment but preserves the successful customer list", async ({
    page,
  }) => {
    const mock = await setup(page);
    mock.setUsersResponse(failure());
    await page.goto("/customers/assign");
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
    await expect(
      page.getByText("배정 대상자를 불러오지 못했습니다", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "배정하기",
        exact: true,
        includeHidden: true,
      })
    ).toBeDisabled();
    await expect(page.getByText("전체 2건", { exact: true })).toBeVisible();
  });

  for (const width of [1440, 390, 320]) {
    test(`A10 ${width}px retry is visible, reachable and keyboard operable`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      const mock = await setup(page);
      mock.setResponse(failure());
      await page.goto("/customers/assign");
      const retry = page.getByRole("button", {
        name: "다시 불러오기",
        exact: true,
      });
      await expect(retry).toBeVisible();
      await retry.evaluate(element =>
        element.scrollIntoView({ block: "center", behavior: "instant" })
      );
      await expectNoHorizontalOverflow(page);
      await expectClickCenterReachable(retry);
      await page.screenshot({
        path: testInfo.outputPath(`assignment-error-${width}.png`),
        fullPage: true,
      });
      await retry.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(retry).toBeFocused();
      mock.setResponse(success(rows));
      await page.keyboard.press("Enter");
      await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
      await expect(retry).toHaveCount(0);
    });
  }

  test("A07 paused refresh cannot execute a cached selection", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/customers/assign");
    await expect(page.getByText(rows[0].name, { exact: true })).toBeVisible();
    await selectTargetAndCustomer(page);
    await page.getByRole("button", { name: "1명 배정", exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await refresh(page);
    const confirm = page.getByRole("dialog").getByRole("button", { name: "배정 확정", exact: true });
    await expect(confirm).toBeDisabled();
    await confirm.dispatchEvent("click");
    expect(mock.mutationCalls).toEqual([]);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(confirm).toBeEnabled();
    await page.keyboard.press("Escape");
  });

  test("A02 actual browser network abort cannot become a successful zero", async ({
    page,
  }) => {
    const mock = await setup(page);
    await page.route("**/api/trpc/**", route =>
      decodeURIComponent(new URL(route.request().url()).pathname).includes(
        "customers.list"
      )
        ? route.abort("internetdisconnected")
        : route.fallback()
    );
    await page.goto("/customers/assign");
    await expect(
      page.getByText("고객 목록을 불러오지 못했습니다", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("전체 확인 불가", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("미배정 고객 DB가 없습니다.", { exact: true })
    ).toHaveCount(0);
    expect(mock.mutationCalls).toEqual([]);
  });
});
