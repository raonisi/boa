import { expect, test, type Page } from "@playwright/test";

import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  collectPageErrors,
  expectClickCenterReachable,
  expectMinimumHitTarget,
  expectNoHorizontalOverflow,
  expectStablePageShell,
  RESPONSIVE_VIEWPORTS,
  setResponsiveViewport,
} from "./helpers/layout-metrics";
import {
  CORE_RESPONSIVE_ROUTES,
  INACTIVE_ROUTE_CHECKS,
  ROLE_ROUTE_MATRIX,
  type SmokeRole,
} from "./helpers/role-routes";

const MOBILE_VIEWPORT_KEYS = [
  "mobile390",
  "mobile375",
  "mobile360",
] as const satisfies ReadonlyArray<keyof typeof RESPONSIVE_VIEWPORTS>;

const DESKTOP_VIEWPORT_KEYS = [
  "desktop1440",
  "desktop1280",
] as const satisfies ReadonlyArray<keyof typeof RESPONSIVE_VIEWPORTS>;

async function expectForbiddenState(page: Page) {
  await expect(page.getByText("접근 권한이 없습니다").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "대시보드로 이동" })).toBeVisible();
}

async function expectSensitiveUnavailableState(page: Page) {
  await expect(page.getByText("정보를 확인할 수 없습니다").first()).toBeVisible();
  await expect(
    page.getByText("데이터가 없거나 접근할 수 없습니다.")
  ).toBeVisible();
  await expect(page.getByText("접근 권한이 없습니다")).toHaveCount(0);
}

async function expectBlockedState(page: Page) {
  await expect(page.getByText("접근이 차단되었습니다")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
}

test.describe("PR-QA-MAINT-11 role-based responsive UI smoke", () => {
  for (const viewportKey of DESKTOP_VIEWPORT_KEYS) {
    test(`desktop ${RESPONSIVE_VIEWPORTS[viewportKey].width}px core routes avoid horizontal overflow`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(90_000);
      test.skip(
        !testInfo.project.name.includes("desktop"),
        "desktop viewport matrix"
      );
      await setResponsiveViewport(page, viewportKey);
      await mockBoaTrpc(page, "branch_admin");
      const errors = collectPageErrors(page);

      for (const route of CORE_RESPONSIVE_ROUTES) {
        await page.goto(route.path, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await expectStablePageShell(page, errors);
      }
    });
  }

  for (const viewportKey of MOBILE_VIEWPORT_KEYS) {
    test(`mobile ${RESPONSIVE_VIEWPORTS[viewportKey].width}px core routes avoid horizontal overflow`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(90_000);
      test.skip(
        !testInfo.project.name.includes("mobile"),
        "mobile viewport matrix"
      );
      await setResponsiveViewport(page, viewportKey);
      await mockBoaTrpc(page, "branch_admin");
      const errors = collectPageErrors(page);

      for (const route of CORE_RESPONSIVE_ROUTES) {
        await page.goto(route.path, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await expectStablePageShell(page, errors);
      }
    });
  }

  for (const role of Object.keys(ROLE_ROUTE_MATRIX) as SmokeRole[]) {
    test(`role route matrix: ${role}`, async ({ page }) => {
      await mockBoaTrpc(page, role);

      for (const route of ROLE_ROUTE_MATRIX[role]) {
        const errors = collectPageErrors(page);
        await page.goto(route.path, { waitUntil: "domcontentloaded" });

        if (route.expectForbidden) {
          await expectForbiddenState(page);
          await expect(page.getByText("[E2E] Customer Alpha")).toHaveCount(0);
          expect(errors, `${route.path}\n${errors.join("\n")}`).toEqual([]);
          continue;
        }

        if (route.expectSensitiveUnavailable) {
          await expectSensitiveUnavailableState(page);
          expect(errors, `${route.path}\n${errors.join("\n")}`).toEqual([]);
          continue;
        }

        await expect(page.locator("#root")).not.toBeEmpty();
        await expectNoHorizontalOverflow(page);
        expect(errors, `${route.path}\n${errors.join("\n")}`).toEqual([]);
      }
    });
  }

  test("inactive account is blocked across direct URLs", async ({ page }) => {
    await mockBoaTrpc(page, "member", { accountStatus: "inactive" });

    for (const route of INACTIVE_ROUTE_CHECKS) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expectBlockedState(page);
      await expect(page.getByText("[E2E] Customer Alpha")).toHaveCount(0);
    }
  });

  test("resigned account is blocked across direct URLs", async ({ page }) => {
    await mockBoaTrpc(page, "member", { accountStatus: "resigned" });

    for (const route of INACTIVE_ROUTE_CHECKS) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expectBlockedState(page);
    }
  });

  test("skip navigation links to main content landmark", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const skipLink = page.getByRole("link", { name: "본문으로 바로가기" });
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("customer list preset context stays user-facing", async ({ page }) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.goto("/customers", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /오늘 연락/ }).click();
    await expect(page).toHaveURL(/preset=priority-contact/);
    await expect(
      page.getByText("현재 보기: 우선 연락 고객").first()
    ).toBeVisible();
    await expect(page.getByText("priority-contact")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "전체 고객 보기" })
    ).toBeVisible();
    await page
      .getByPlaceholder("고객명, 연락처를 검색하세요")
      .fill("[TEST]");
    await expect(page.getByText("검색어: [TEST]").first()).toBeVisible();
    await expect(
      page.getByText("현재 보기: 우선 연락 고객").first()
    ).toBeVisible();
    await page.getByRole("button", { name: "전체 고객 보기" }).click();
    await expect(page.getByText("현재 보기: 우선 연락 고객")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("unknown customer list preset is handled safely", async ({ page }) => {
    await mockBoaTrpc(page, "member");
    await page.goto("/customers?preset=agent-scope-hack", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("agent-scope-hack")).toHaveCount(0);
    await expect(page.getByText("우선 연락 고객")).toHaveCount(0);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("member sees sensitive unavailable state for denied customer detail", async ({
    page,
  }) => {
    await mockBoaTrpc(page, "member", { customerDetailDenied: true });
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    await expectSensitiveUnavailableState(page);
    await expect(page.getByText("[E2E] Customer Alpha")).toHaveCount(0);
    await expect(page.getByText("010-1000-2000")).toHaveCount(0);
  });

  test("customer assign shows inactive and resigned disabled reasons", async ({
    page,
  }) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.goto("/customers/assign", { waitUntil: "domcontentloaded" });
    await page.getByRole("combobox").first().click();
    await expect(
      page.getByRole("option", { name: /\[TEST\] UI Inactive User.*비활성 계정입니다/ })
    ).toBeVisible();
    await expect(
      page.getByRole("option", {
        name: /\[TEST\] UI Resigned User.*퇴사 처리된 사용자입니다/,
      })
    ).toBeVisible();
  });

  test("mobile customer assign action bar does not overlap bottom navigation", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "mobile-only CTA collision smoke"
    );
    await setResponsiveViewport(page, "mobile360");
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/customers/assign", { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(/고객명|연락처|지역|유입/).fill("[E2E]");
    await page.getByRole("checkbox", { name: "고객 선택" }).check();
    const actionBar = page.getByRole("region", { name: "선택 고객 일괄 작업" });
    const clearSelection = actionBar.getByRole("button", { name: "선택 해제" });
    const mobileNav = page.locator("nav.fixed");
    await expect(actionBar).toBeVisible();
    await expectLocatorPairWithinViewport(page, actionBar, mobileNav);
    await expectClickCenterReachable(clearSelection);
    await expectStablePageShell(page, errors);
  });

  test("mobile notifications bulk checkbox exposes 44px touch target", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "mobile-only checkbox smoke"
    );
    await setResponsiveViewport(page, "mobile375");
    await mockBoaTrpc(page, "branch_admin");
    await page.goto("/notifications", { waitUntil: "domcontentloaded" });
    const notificationRow = page
      .getByText("[E2E] Today notification")
      .locator("xpath=ancestor::*[contains(@class,'crm-elevated-card')][1]");
    const checkbox = notificationRow.getByRole("checkbox", {
      name: "알림 선택",
    });
    await expectMinimumHitTarget(checkbox, 44);
    await checkbox.check();
    await expect(page.getByTestId("bulk-mark-read")).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });

  test("calendar day buttons expose accessible names without sensitive titles", async ({
    page,
  }, testInfo) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.goto("/calendar", { waitUntil: "domcontentloaded" });

    if (testInfo.project.name.includes("mobile")) {
      await expect(page.getByText("[E2E] 고객 상담 일정").first()).toBeVisible();
      await expect(page.getByText("010-")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      return;
    }

    const dayButtons = page.locator('button[aria-label*="일"]');
    await expect(dayButtons.first()).toBeVisible();
    const labels = await dayButtons.evaluateAll(buttons =>
      buttons.map(button => button.getAttribute("aria-label") ?? "")
    );
    expect(labels.some(label => label.includes("오늘") || label.length > 0)).toBe(
      true
    );
    expect(labels.join(" ")).not.toContain("010-");
    await expectNoHorizontalOverflow(page);
  });

});

async function expectLocatorPairWithinViewport(
  page: Page,
  first: ReturnType<Page["getByRole"]>,
  second: ReturnType<Page["locator"]>
) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing viewport size");

  for (const locator of [first, second]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}
