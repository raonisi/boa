import { expect, test, type Page } from "@playwright/test";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const routeAliases: Record<string, string> = {
  "/dashboard": "/",
  "/admin-audit": "/operation-risk",
};

const smokeRoutes = [
  "/dashboard",
  "/customers",
  "/customers/assign",
  "/customers/bulk-import",
  "/contracts",
  "/calendar",
  "/notifications",
  "/analytics",
  "/operation-risk",
  "/admin/operations-center",
  "/management-reports",
  "/customer-data-quality",
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

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !isExpectedDevConsoleNoise(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function expectStablePageShell(page: Page, errors: string[]) {
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText(/login required|not found/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(errors, errors.join("\n")).toEqual([]);
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

      const errors = collectPageErrors(page);

      const canonicalPath = routeAliases[requestedPath] ?? requestedPath;
      await page.goto(requestedPath, { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(new RegExp(`${canonicalPath.replace("/", "\\/")}(\\?.*)?$`));
      await expectStablePageShell(page, errors);
    });
  }

  test("desktop visual smoke: dashboard and customer list render core work surfaces", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "desktop-only visual smoke");
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator('text="[E2E] Customer Alpha" >> visible=true').first()).toBeVisible();
    await expect(page.locator('text="[E2E] Branch Admin" >> visible=true').first()).toBeVisible();
    await expectStablePageShell(page, errors);

    await page.goto("/customers", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("[E2E] Customer Alpha").first()).toBeVisible();
    await expect(page.locator('input[type="text"], input[type="search"], input:not([type])').first()).toBeVisible();
    await expect(page.getByRole("button").filter({ hasText: /DB|배정|등록|일괄/ }).first()).toBeVisible();
    await expectStablePageShell(page, errors);
  });

  test("mobile visual smoke: dashboard, customer list, and bottom nav flow stay usable", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only visual smoke");
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);
    const mobileNavButtons = page.locator("nav.fixed button");

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("[E2E] Customer Alpha").first()).toBeVisible();
    await expect(mobileNavButtons).toHaveCount(5);
    await expectStablePageShell(page, errors);

    await mobileNavButtons.nth(1).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByText("[E2E] Customer Alpha").first()).toBeVisible();
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
    await page.locator('input[type="text"], input[type="search"], input:not([type])').first().fill("[E2E]");
    await expect(page.getByText("검색어: [E2E]").first()).toBeVisible();
    await page.getByRole("button", { name: /검색어: \[E2E\] 필터 해제/ }).click();
    await expect(page.getByText("검색어: [E2E]")).toHaveCount(0);
    await expectStablePageShell(page, errors);

    await mobileNavButtons.nth(2).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expectStablePageShell(page, errors);

    await mobileNavButtons.nth(3).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByTestId("notifications-bulk-actions")).toBeVisible();
    await page.getByLabel("[E2E] Today notification 선택").click();
    await expect(page.getByTestId("bulk-mark-read")).toBeEnabled();
    await expect(page.getByTestId("bulk-complete")).toBeEnabled();
    await page.getByRole("button", { name: /긴급/ }).first().click();
    await expect(page.getByText("우선순위: 긴급").first()).toBeVisible();
    await page.getByRole("button", { name: /우선순위: 긴급 필터 해제/ }).click();
    await expect(page.getByText("우선순위: 긴급")).toHaveCount(0);
    await expectStablePageShell(page, errors);

    await mobileNavButtons.nth(4).click();
    const moreDialog = page.locator('[role="dialog"]');
    await expect(moreDialog).toBeVisible();
    await expect(moreDialog.getByRole("button", { name: "세일즈 파이프라인" })).toBeVisible();
    await expect(moreDialog.getByRole("button", { name: "고객 일괄 등록" })).toBeVisible();
    await expect(moreDialog.getByRole("button", { name: "데이터 다운로드" })).toBeVisible();
    const moreSheetMetrics = await moreDialog.getByTestId("mobile-more-menu-item").evaluateAll((buttons) =>
      buttons.map((button) => {
        const label = button.querySelector("span:last-child");
        const labelStyle = label ? window.getComputedStyle(label) : null;
        return {
          height: Math.round(button.getBoundingClientRect().height),
          textOverflow: labelStyle?.textOverflow ?? "",
          whiteSpace: labelStyle?.whiteSpace ?? "",
        };
      })
    );
    expect(Math.min(...moreSheetMetrics.map((item) => item.height))).toBeGreaterThanOrEqual(44);
    expect(moreSheetMetrics.every((item) => item.textOverflow !== "ellipsis" && item.whiteSpace !== "nowrap")).toBe(true);
    await moreDialog.getByRole("button", { name: "영업 분석" }).click();
    await expect(page).toHaveURL(/\/analytics$/);
    await expectStablePageShell(page, errors);
  });

  test("mobile customer detail quick actions render without overflow", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only customer detail quick action smoke");
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("[E2E] Customer Alpha").first()).toBeVisible();
    await expect(page.getByText("고객 실행 패널").first()).toBeVisible();
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: /상담기록/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /후속관리/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /일정 추가/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /계약 등록/ }).first()).toBeVisible();
    await expect(page.locator('div.fixed button:has-text("상담")')).toHaveCount(0);
    await expectStablePageShell(page, errors);
  });

  test("mobile operation risk tabs stay on one scrollable row at 360px", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only operation risk tab smoke");
    await page.setViewportSize({ width: 360, height: 760 });
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/operation-risk", { waitUntil: "domcontentloaded" });
    const tabScroll = page.getByTestId("operation-risk-tab-scroll");
    const operationRiskTabs = tabScroll.locator('[data-slot="tabs-list"]').first();
    const tabMetrics = await tabScroll.evaluate((container) => {
      const list = container.querySelector('[data-slot="tabs-list"]');
      const children = list ? Array.from(list.children) : [];
      const topValues = new Set(children.map((child) => Math.round(child.getBoundingClientRect().top)));
      return {
        topCount: topValues.size,
        containerScrollWidth: container.scrollWidth,
        containerClientWidth: container.clientWidth,
        childWidths: children.map((child) => Math.round(child.getBoundingClientRect().width)),
      };
    });

    await expect(operationRiskTabs).toBeVisible();
    expect(tabMetrics.topCount).toBe(1);
    expect(tabMetrics.containerScrollWidth).toBeGreaterThan(tabMetrics.containerClientWidth);
    expect(Math.min(...tabMetrics.childWidths)).toBeGreaterThanOrEqual(44);
    await expectStablePageShell(page, errors);
  });

  test("operation risk and analytics visual shells do not leak customer contact data", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/operation-risk", { waitUntil: "domcontentloaded" });
    const operationRiskTabs = page.locator('[data-slot="tabs-list"]').first();
    const tabMetrics = await operationRiskTabs.evaluate((element) => {
      const children = Array.from(element.children);
      const topValues = new Set(children.map((child) => Math.round(child.getBoundingClientRect().top)));
      return {
        topCount: topValues.size,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        childWidths: children.map((child) => Math.round(child.getBoundingClientRect().width)),
      };
    });
    expect(tabMetrics.topCount).toBe(1);
    expect(tabMetrics.scrollWidth).toBeGreaterThanOrEqual(tabMetrics.clientWidth);
    expect(Math.min(...tabMetrics.childWidths)).toBeGreaterThanOrEqual(44);
    await expect(page.getByText("010-1000-2000")).toHaveCount(0);
    await expectStablePageShell(page, errors);

    await page.goto("/analytics", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).not.toBeEmpty();
    await expectStablePageShell(page, errors);
  });

  test("mobile manager opens scoped operation risk from more menu", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only manager scoped risk smoke");
    await mockBoaTrpc(page, "team_leader");
    const errors = collectPageErrors(page);
    const mobileNavButtons = page.locator("nav.fixed button");

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(mobileNavButtons).toHaveCount(5);
    await mobileNavButtons.nth(4).click();

    const moreDialog = page.locator('[role="dialog"]');
    await expect(moreDialog).toBeVisible();
    await moreDialog.getByRole("button", { name: "운영 리스크" }).click();

    await expect(page).toHaveURL(/\/operation-risk$/);
    await expect(page.getByRole("heading", { name: "팀 리스크" })).toBeVisible();
    await expect(page.getByText("미처리 후속관리")).toBeVisible();
    await expect(page.getByText("DATA_DOWNLOAD")).toHaveCount(0);
    await expect(page.getByText("완전삭제")).toHaveCount(0);
    await expect(page.getByText("OAuth")).toHaveCount(0);
    await expect(page.getByText("010-1000-2000")).toHaveCount(0);
    await expectStablePageShell(page, errors);
  });

  test("member sees permission state for management reports", async ({ page }) => {
    await mockBoaTrpc(page, "member");

    await page.goto("/management-reports");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/권한|Permission|required|접근/).first()).toBeVisible();
    await expect(page.getByText("관리자 보고서")).toHaveCount(0);
  });

  test("member sees permission state for admin operations center", async ({ page }) => {
    await mockBoaTrpc(page, "member");

    await page.goto("/admin/operations-center");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/권한|Permission|required|접근/).first()).toBeVisible();
    await expect(page.getByText("관리자 운영센터")).toHaveCount(0);
  });

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
    const dialogMetrics = await page.locator('[data-slot="dialog-content"]').first().evaluate((dialog) => {
      const footer = dialog.querySelector('[data-slot="dialog-footer"]');
      const dialogRect = dialog.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      return {
        dialogWithinViewport: dialogRect.top >= 0 && dialogRect.bottom <= window.innerHeight,
        footerVisible: Boolean(footerRect && footerRect.top < window.innerHeight && footerRect.bottom <= window.innerHeight),
        footerWidth: footerRect?.width ?? 0,
      };
    });
    expect(dialogMetrics.dialogWithinViewport).toBe(true);
    expect(dialogMetrics.footerVisible).toBe(true);
    expect(dialogMetrics.footerWidth).toBeGreaterThan(240);

    const execute = page.getByRole("button", { name: "다운로드 실행" });
    await expect(execute).toBeDisabled();
    await page.getByLabel("다운로드 사유 *").fill("[E2E] export safety check");
    await expect(execute).toBeDisabled();
    await page.getByLabel("다운로드 범위와 외부 파일 생성 주의사항을 확인했습니다.").check();
    await expect(execute).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });

  test("calendar shows linked customer context and detail CTA", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/calendar");
    await expect(page.getByText("[E2E] Customer Alpha").first()).toBeVisible();
    await page.getByText("[E2E] 고객 상담 일정").first().click();
    await expect(page.getByRole("button", { name: /고객 상세 보기/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("customer detail can start a customer-linked calendar schedule", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/customers/101");
    await page.getByRole("button", { name: /이 고객 일정 추가|일정 추가/ }).first().click();
    await expect(page).toHaveURL(/\/calendar\?customerId=101&action=create$/);
    await expect(page.getByText("연결 고객")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("customer assignment page shows filters, selection summary, and confirmation", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/customers/assign");
    await expect(page.getByPlaceholder(/고객명|연락처/)).toBeVisible();
    await page.getByPlaceholder(/고객명|연락처/).fill("[E2E]");
    await page.locator('input[type="checkbox"]').nth(1).check();
    await expect(page.getByText(/선택 1건/)).toBeVisible();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /\[E2E\] Member/ }).click();
    await page.getByRole("button", { name: /1.*배정/ }).click();
    await expect(page.getByText("DB 배정 확인")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
