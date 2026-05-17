import { expect, test } from "@playwright/test";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasOverflow).toBe(false);
}

test.describe("BOA CRM core smoke", () => {
  test("branch_admin can render dashboard, customer, analytics, and operation-risk screens", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/");
    await expect(page.getByText("BOA", { exact: false }).first()).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-desktop.png", { fullPage: true });

    await page.goto("/customers");
    await expect(page.getByText("[E2E] Customer Alpha")).toBeVisible();
    await expect(page).toHaveScreenshot("customer-list-desktop.png", { fullPage: true });

    await page.goto("/customers/101");
    await expect(page.getByRole("heading", { name: "[E2E] Customer Alpha" })).toBeVisible();
    await expect(page.getByText("010-1000-2000").or(page.getByText("010-****-2000"))).toBeVisible();

    await page.goto("/analytics");
    await expect(page.getByText("전체 조직")).toBeVisible();

    await page.goto("/operation-risk");
    await expect(page.getByText("운영 리스크", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("다운로드 점검")).toBeVisible();
  });

  test("member sees permission state for branch-admin-only operation risk", async ({ page }) => {
    await mockBoaTrpc(page, "member");

    await page.goto("/operation-risk");
    await expect(page.getByText(/권한|Permission|required|접근/).first()).toBeVisible();
    await expect(page.getByText("[E2E] Customer Alpha")).toHaveCount(0);
    await expect(page.getByText("010-1000-2000")).toHaveCount(0);
  });

  test("mobile dashboard and bottom navigation render without horizontal overflow", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/");
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot("dashboard-mobile.png", { fullPage: true });

    await page.locator("nav button").nth(1).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByText("[E2E] Customer Alpha")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("empty state is visible when the customer list fixture has no rows", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.route("**/api/trpc/customers.list**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: { data: { json: [] } } }]),
      });
    });

    await page.goto("/customers");
    await expect(page.getByText(/고객이 없습니다|조건에 맞는 고객/).first()).toBeVisible();
  });
});
