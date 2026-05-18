import { expect, test, type Page } from "@playwright/test";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const routeAliases: Record<string, string> = {
  "/dashboard": "/",
  "/admin-audit": "/operation-risk",
};

const smokeRoutes = [
  "/dashboard",
  "/customers",
  "/customers/bulk-import",
  "/contracts",
  "/calendar",
  "/notifications",
  "/analytics",
  "/operation-risk",
  "/admin-audit",
  "/download",
];

const ignoredConsoleErrors = [
  /Each child in a list should have a unique "key" prop/i,
];

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasOverflow).toBe(false);
}

function isExpectedDevConsoleNoise(text: string) {
  return ignoredConsoleErrors.some((pattern) => pattern.test(text));
}

test.describe("BOA CRM e2e smoke", () => {
  test("serves Vite entry as JavaScript instead of SPA fallback HTML", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/src/main.tsx`);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("javascript");
    await expect(await response.text()).resolves.not.toMatch(/<!doctype html/i);
  });

  for (const requestedPath of smokeRoutes) {
    test(`route smoke: ${requestedPath}`, async ({ page }) => {
      await mockBoaTrpc(page, "branch_admin");

      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !isExpectedDevConsoleNoise(message.text())) {
          errors.push(message.text());
        }
      });

      const canonicalPath = routeAliases[requestedPath] ?? requestedPath;
      await page.goto(requestedPath, { waitUntil: "domcontentloaded" });

      await expect(page.locator("#root")).not.toBeEmpty();
      await expect(page.locator("body")).not.toHaveText(/login required|not found/i);
      await expect(page).toHaveURL(new RegExp(`${canonicalPath.replace("/", "\\/")}(\\?.*)?$`));
      await expectNoHorizontalOverflow(page);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("member sees permission state for branch-admin-only operation risk", async ({ page }) => {
    await mockBoaTrpc(page, "member");

    await page.goto("/operation-risk");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/권한|Permission|required|접근/).first()).toBeVisible();
    await expect(page.getByText("[E2E] Customer Alpha")).toHaveCount(0);
    await expect(page.getByText("010-1000-2000")).toHaveCount(0);
  });

  test("member sees permission state for restricted bulk import route", async ({ page }) => {
    await mockBoaTrpc(page, "member");

    await page.goto("/customers/bulk-import");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.locator('[role="status"]').first()).toBeVisible();
    await expect(page.getByText("[E2E] Customer Alpha")).toHaveCount(0);
    await expect(page.getByText("010-1000-2000")).toHaveCount(0);
  });

  test("team_leader with bulk import permission can open bulk import route", async ({ page }) => {
    await mockBoaTrpc(page, "team_leader", { permissions: ["customers.bulk_import"] });

    await page.goto("/customers/bulk-import");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.locator('[role="status"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/customers\/bulk-import$/);
  });

  test("download confirmation requires reason and second confirmation", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/download");
    await page.getByRole("button", { name: /CSV 다운로드/ }).first().click();

    await expect(page.getByText("다운로드 범위를 확인해 주세요.")).toBeVisible();
    await expect(page.getByText(/총 1건이 다운로드됩니다/)).toBeVisible();
    await expect(page.getByText(/연락처 · 민감/)).toBeVisible();

    const execute = page.getByRole("button", { name: "다운로드 실행" });
    await expect(execute).toBeDisabled();
    await page.getByLabel("다운로드 사유 *").fill("[E2E] export safety check");
    await expect(execute).toBeDisabled();
    await page.getByLabel("다운로드 범위와 외부 파일 생성 주의사항을 확인했습니다.").check();
    await expect(execute).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });
});
