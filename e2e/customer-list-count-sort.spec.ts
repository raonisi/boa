import { expect, test, type Page } from "@playwright/test";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  setupCountFixture,
  expectedQuick,
} from "./fixtures/customer-list-counts";
import { expectClickCenterReachable, expectNoHorizontalOverflow } from "./helpers/layout-metrics";

const badge = (page: Page, label: string) =>
  page
    .getByTestId("customer-list-mobile-filter-row")
    .getByRole("button", { name: new RegExp(`^${label} `) });
const total = (page: Page) =>
  page.locator("p").filter({ hasText: /^조건에 맞는 고객/ });
// Same breakpoint as useIsMobile; choose the expected UI, never an optional locator.
const usesCustomerCards = (page: Page) => page.viewportSize()!.width < 768;
const customerResults = (page: Page) =>
  usesCustomerCards(page)
    ? page.getByTestId("customer-list-result-card")
    : page.locator('[role="row"][data-customer-id]');
const labels = {
  all: "전체",
  today_contact: "오늘 연락",
  urgent: "긴급",
  uncontacted: "미상담",
  sla_overdue: "지연",
  no_next_action: "다음 액션 없음",
  mine: "내 담당",
  new_db: "신규 DB",
};

test("B02: page sizes 20/50 and page numbers preserve business totals", async ({
  page,
}) => {
  const state = await setupCountFixture(page);
  await page.goto("/customers?segment=all&page=3&pageSize=50");
  await expect(total(page)).toHaveText("조건에 맞는 고객 123명");
  await expect(badge(page, "전체")).toHaveText("전체123");
  await expect(page.getByText("123명 중 101-123명")).toBeVisible();
  await page.getByRole("combobox", { name: "페이지당 고객 수" }).click();
  await page.getByRole("option", { name: "20명씩", exact: true }).click();
  await expect(page.getByText("123명 중 1-20명")).toBeVisible();
  await page.getByRole("button", { name: "다음 페이지", exact: true }).click();
  await expect(page.getByText("123명 중 21-40명")).toBeVisible();
  await expect(badge(page, "전체")).toHaveText("전체123");
  expect(
    state.requests
      .filter(r => r.procedure === "customers.segmentCounts")
      .every(r => !r.input.page && !r.input.pageSize && !r.input.sort)
  ).toBe(true);
});

test("B03: every quick badge equals its selected total; reselect and all preserve behavior", async ({
  page,
}) => {
  await setupCountFixture(page);
  await page.goto("/customers?segment=all");
  for (const [id, label] of Object.entries(labels)) {
    await badge(page, "전체").click();
    const count = expectedQuick[id as keyof typeof expectedQuick];
    await expect(badge(page, label)).toHaveText(label + count);
    await badge(page, label).click();
    await expect(total(page)).toHaveText(`조건에 맞는 고객 ${count}명`);
    await expect(badge(page, label)).toHaveAttribute("aria-pressed", "true");
    await badge(page, label).click();
    await expect(total(page)).toHaveText(`조건에 맞는 고객 ${count}명`);
  }
});

test("B04: applied search, general filters, reset and out-of-range page", async ({
  page,
}) => {
  const state = await setupCountFixture(page);
  await page.goto(
    "/customers?segment=database&page=8&search=" +
      encodeURIComponent("고객001") +
      "&priority=A"
  );
  await expect(total(page)).toHaveText("조건에 맞는 고객 1명");
  await expect(page.getByText("1명 중 1-1명")).toBeVisible();
  await page
    .getByRole("textbox", { name: "고객 통합 검색" })
    .fill("not-applied");
  await expect(total(page)).toHaveText("조건에 맞는 고객 1명");
  await expect(badge(page, "미상담")).toHaveText("미상담83");
  await badge(page, "미상담").click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 83명");
  await expect(
    page.getByRole("textbox", { name: "고객 통합 검색" })
  ).toHaveValue("");
  expect(
    state.requests.filter(r => r.procedure === "customers.list").at(-1)?.input
  ).toMatchObject({
    segment: "database",
    workflowFilter: "uncontacted",
    page: 1,
  });
  await badge(page, "전체").click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 103명");
});

test("B05: each selected server sort determines actual table or card order and explanation", async ({
  page,
}) => {
  const state = await setupCountFixture(page);
  await page.goto("/customers?segment=all&view=table");
  await badge(page, "미상담").click();
  const results = customerResults(page);
  if (usesCustomerCards(page)) {
    await expect(page).not.toHaveURL(/view=table/);
    await expect(page.getByRole("table", { name: "고객 표 보기" })).toHaveCount(
      0
    );
  } else {
    await expect(
      page.getByRole("table", { name: "고객 표 보기" })
    ).toBeVisible();
  }
  // Independent fixed IDs: uncontacted customers 93001–93083. The zero-premium
  // tie uses createdAt DESC; next-contact dates increase with these fixture IDs.
  for (const [sort, label, name, firstId, step] of [
    ["recent", "최근 등록순", "고객083", 93083, -1],
    ["name", "고객명순", "고객001", 93001, 1],
    ["next_contact", "다음 연락순", "고객001", 93001, 1],
    ["contract_value", "월납보험료순", "고객083", 93083, -1],
  ] as const) {
    await page.getByRole("combobox", { name: "고객 정렬" }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(
      page.locator("p").filter({ hasText: /^현재 페이지/ })
    ).toContainText(label);
    await expect(results.first()).toContainText(name);
    await expect
      .poll(() =>
        results.evaluateAll(elements =>
          elements.map(element =>
            Number(element.getAttribute("data-customer-id"))
          )
        )
      )
      .toEqual(
        Array.from({ length: 20 }, (_, index) => firstId + index * step)
      );
    await expect(total(page)).toHaveText("조건에 맞는 고객 83명");
    expect(
      state.requests.filter(r => r.procedure === "customers.list").at(-1)?.input
        .sort
    ).toBe(sort);
  }
});

test("B06: loading, failure, retry, successful zero and stale refresh failure", async ({
  page,
}) => {
  const state = await setupCountFixture(page);
  state.delaySearch = "slow";
  state.delayMs = 1500;
  await page.goto("/customers?segment=all&search=slow");
  await expect(total(page)).toContainText("조회 중");
  await expect(badge(page, "전체")).not.toHaveText("전체0");
  await expect(total(page)).toHaveText("조건에 맞는 고객 0명");
  state.fail = true;
  await page.getByRole("textbox", { name: "고객 통합 검색" }).fill("고객");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByRole("alert", { name: "고객 조회 상태" })).toBeVisible(
    { timeout: 15000 }
  );
  await expect(total(page)).toContainText("확인 불가");
  state.fail = false;
  await page
    .getByRole("button", { name: "다시 불러오기", exact: true })
    .click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 123명");
  await expect(
    page.getByRole("textbox", { name: "고객 통합 검색" })
  ).toHaveValue("고객");
  await expect(page.getByRole("alert", { name: "고객 조회 상태" })).toHaveCount(
    0
  );
  state.fail = true;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
  });
  await expect(
    page.getByRole("alert", { name: "고객 조회 상태" })
  ).toContainText("최신 상태 확인 실패", { timeout: 15000 });
  await expect(total(page)).toContainText("확인 불가");
});

test("B07: delayed old search cannot overwrite new conditions; account scope clears selections and totals", async ({
  page,
}) => {
  const state = await setupCountFixture(page);
  await page.goto("/customers?segment=all&view=table");
  await expect(total(page)).toHaveText("조건에 맞는 고객 123명");
  state.delaySearch = "고객001";
  state.delayMs = 1800;
  await page.getByRole("textbox", { name: "고객 통합 검색" }).fill("고객001");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByRole("textbox", { name: "고객 통합 검색" }).fill("고객12");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 4명");
  await page.waitForTimeout(2000);
  await expect(total(page)).toHaveText("조건에 맞는 고객 4명");
  await badge(page, "전체").click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 123명");
  // Customer 93001 belongs to the previous actor and must disappear after switching.
  await page.getByRole("combobox", { name: "고객 정렬" }).click();
  await page.getByRole("option", { name: "고객명순", exact: true }).click();
  const priorCustomer = customerResults(page).filter({
    hasText: "[TEST] 고객001",
  });
  await expect(priorCustomer).toHaveAttribute("data-customer-id", "93001");
  const selectedCount = usesCustomerCards(page) ? 1 : 20;
  if (usesCustomerCards(page)) {
    await priorCustomer
      .getByRole("checkbox", { name: "고객 선택", exact: true })
      .check();
    await expect(
      priorCustomer.getByRole("checkbox", { name: "고객 선택", exact: true })
    ).toBeChecked();
  } else {
    await page
      .getByRole("checkbox", { name: "화면에 보이는 고객 전체 선택" })
      .check();
    await expect(
      page.getByRole("checkbox", { name: "화면에 보이는 고객 전체 선택" })
    ).toBeChecked();
  }
  await expect(
    page.getByText(`선택한 고객 ${selectedCount}명`, { exact: true })
  ).toBeVisible();
  state.actor = 4;
  state.role = "member";
  state.version++;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
  });
  // The existing default classification for a member is database (40 of the 60 authorized IDs).
  await expect(total(page)).toHaveText("조건에 맞는 고객 40명", {
    timeout: 15000,
  });
  await expect(badge(page, "전체")).toHaveText("전체40");
  await expect(page.getByText(/^선택한 고객 \d+명$/)).toHaveCount(0);
  await expect(page.locator('[data-customer-id="93001"]')).toHaveCount(0);
  await expect(page.getByText("[TEST] 고객001", { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expect(customerResults(page)).toHaveCount(20);
  const visibleIds = await customerResults(page).evaluateAll(elements =>
    elements.map(element => Number(element.getAttribute("data-customer-id")))
  );
  expect(visibleIds.every(id => id >= 93064 && id <= 93103)).toBe(true);
  await expect(badge(page, "내 담당")).toHaveCount(0);
  await page.getByRole("tab", { name: /실제 계약 고객/ }).click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 20명");
  await expect(page.locator('[data-customer-id="93001"]')).toHaveCount(0);
  await expect(page.getByText(/^선택한 고객 \d+명$/)).toHaveCount(0);
});

test("B07: existing create invalidation refreshes current list and both aggregates (mock only)", async ({
  page,
}) => {
  const state = await setupCountFixture(page);
  await page.goto("/customers?segment=database");
  await badge(page, "미상담").click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 83명");
  const priorCounts = state.requests.filter(
    r => r.procedure === "customers.segmentCounts"
  ).length;
  const priorQuick = state.requests.filter(
    r => r.procedure === "customers.quickCounts"
  ).length;
  await page.getByRole("button", { name: "신규 고객 등록", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "고객 등록", exact: true });
  await dialog.locator("input[required]").fill("[TEST] 신규");
  await dialog.locator('button[type="submit"]').click();
  await expect(total(page)).toHaveText("조건에 맞는 고객 84명");
  await expect(badge(page, "전체")).toHaveText("전체104");
  expect(
    state.requests.filter(r => r.procedure === "customers.segmentCounts").length
  ).toBeGreaterThan(priorCounts);
  expect(
    state.requests.filter(r => r.procedure === "customers.quickCounts").length
  ).toBeGreaterThan(priorQuick);
  expect(state.mutations).toHaveLength(1);
  expect(state.mutations[0]).toContain("customers.create");
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`B11: count, sort and keyboard controls at ${viewport.width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await setupCountFixture(page);
    await page.goto("/customers?segment=all&sort=name");
    await expect(total(page)).toHaveText("조건에 맞는 고객 123명");
    await expect(
      page.locator("p").filter({ hasText: /^현재 페이지/ })
    ).toContainText("고객명순");
    await expectNoHorizontalOverflow(page);
    await badge(page, "미상담").focus();
    await page.keyboard.press("Enter");
    await expect(total(page)).toHaveText("조건에 맞는 고객 83명");
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`counts-${viewport.width}.png`),
      fullPage: true,
    });
    await page.screenshot({
      path: testInfo.outputPath(`viewport-${viewport.width}.png`),
      fullPage: false,
    });
    const sort = page.getByRole("combobox", { name: "고객 정렬" });
    await sort.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await expectClickCenterReachable(sort);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`count-sort-controls-${viewport.width}.png`) });
  });
}

const success = (data: unknown) => ({
  result: { data: SuperJSON.serialize(data) },
});

test("B01: quick all badge uses the result total, not this page", async ({
  page,
}) => {
  await page.route("**/*", route =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort()
  );
  await mockBoaTrpc(page, "branch_admin", {
    transformResponse(procedure, original) {
      if (procedure === "customers.list") {
        return success(
          Array.from({ length: 20 }, (_, i) => ({
            id: 92001 + i,
            name: `[TEST] 고객 ${i + 1}`,
            phone: "010-0000-0000",
            agentId: 1,
            isActive: true,
            consultStatus: "미상담",
            priority: "C",
            createdAt: "2026-09-01T00:00:00.000Z",
            customerSegment: "database",
          }))
        );
      }
      if (procedure === "customers.segmentCounts")
        return success({ all: 123, database: 123, contracted: 0 });
      if (procedure === "customers.quickCounts")
        return success({
          all: 123,
          mine: 63,
          uncontacted: 83,
          sla_overdue: 43,
          no_next_action: 73,
          new_db: 33,
          today_contact: 0,
          urgent: 0,
        });
      return original;
    },
  });
  await page.goto("/customers?segment=all");
  await expect(page.getByRole("heading", { name: "고객 관리" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "전체 123", exact: true })
  ).toBeVisible();
});
