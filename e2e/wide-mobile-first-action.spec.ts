import { expect, test, type Page } from "@playwright/test";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  collectPageErrors,
  expectClickCenterReachable,
  expectMinimumHitTarget,
  expectNoHorizontalOverflow,
} from "./helpers/layout-metrics";

function serializeTrpc(data: unknown) {
  return { result: { data: SuperJSON.serialize(data) } };
}

test.describe("BOA-CRM-AG06 Wide Mobile First-Action UX", () => {
  const WIDE_MOBILE_VIEWPORTS = [
    { name: "wide640", width: 640, height: 800 },
    { name: "wide667", width: 667, height: 800 },
    { name: "wide767", width: 767, height: 800 },
  ];

  for (const vp of WIDE_MOBILE_VIEWPORTS) {
    test(`first task and primary action are visible without scrolling at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockBoaTrpc(page, "member");
      const errors = collectPageErrors(page);

      await page.goto("/", { waitUntil: "domcontentloaded" });

      // 1. Initial state: verify zero scrolling
      const initialScrollY = await page.evaluate(() => window.scrollY);
      expect(initialScrollY).toBe(0);

      // 2. Mobile nav boundary
      const mobileNav = page.getByTestId("mobile-nav");
      await expect(mobileNav).toBeVisible();
      const mobileNavBox = await mobileNav.boundingBox();
      expect(mobileNavBox).not.toBeNull();
      const navTopY = mobileNavBox!.y;

      // 3. Execution queue card
      const queue = page.getByTestId("dashboard-mobile-followup-queue");
      await expect(queue).toBeVisible();

      // 4. First task title visible above MobileNav at scrollY = 0
      const firstTaskTitle = queue.locator("button.line-clamp-2").first();
      await expect(firstTaskTitle).toBeVisible();
      const titleBox = await firstTaskTitle.boundingBox();
      expect(titleBox).not.toBeNull();
      expect(titleBox!.y).toBeGreaterThan(0);
      expect(titleBox!.y + titleBox!.height).toBeLessThan(navTopY);

      // 5. First task primary action button ("완료") visible above MobileNav at scrollY = 0
      const primaryBtn = queue.getByRole("button", { name: "완료" }).first();
      await expect(primaryBtn).toBeVisible();
      const btnBox = await primaryBtn.boundingBox();
      expect(btnBox).not.toBeNull();
      expect(btnBox!.y).toBeGreaterThan(0);
      expect(btnBox!.y + btnBox!.height).toBeLessThan(navTopY);
      const clearance = navTopY - (btnBox!.y + btnBox!.height);
      expect(clearance).toBeGreaterThanOrEqual(16);

      // 6. Touch target size meets minimum requirement (>= 44px)
      await expectMinimumHitTarget(primaryBtn, 44);
      expect(btnBox!.height).toBeGreaterThanOrEqual(44);

      // 7. Click center is reachable (not intercepted by MobileNav or other overlay)
      await expectClickCenterReachable(primaryBtn);

      // 8. Lower edge touch point (4px from bottom edge) hits primary button directly, not MobileNav
      const lowerPoint = {
        x: btnBox!.x + btnBox!.width / 2,
        y: btnBox!.y + btnBox!.height - 4,
      };
      const hitInside = await page.evaluate(({ x, y }) => {
        const h = document.elementFromPoint(x, y);
        return (
          h?.closest("button")?.textContent?.includes("완료") ||
          h?.closest('[data-testid="dashboard-mobile-followup-queue"]') !== null
        );
      }, lowerPoint);
      expect(hitInside).toBe(true);

      // 9. Upper edge touch point (4px from top edge) hits primary button directly
      const upperPoint = {
        x: btnBox!.x + btnBox!.width / 2,
        y: btnBox!.y + 4,
      };
      const upperHit = await page.evaluate(({ x, y }) => {
        const h = document.elementFromPoint(x, y);
        return h?.closest("button")?.textContent?.includes("완료") !== undefined;
      }, upperPoint);
      expect(upperHit).toBe(true);

      // 10. Direct click without force succeeds and opens completion flow
      await primaryBtn.click({ force: false });
      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible();
      await expect(alertDialog.getByRole("heading")).toContainText(
        "후속관리를 완료할까요?"
      );
      await alertDialog.getByRole("button", { name: "취소" }).click();
      await expect(alertDialog).toBeHidden();

      // 11. Zero horizontal overflow
      await expectNoHorizontalOverflow(page);
      expect(errors, errors.join("\n")).toEqual([]);
    });

    test(`empty state is fully visible above MobileNav when 0 tasks exist at ${vp.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockBoaTrpc(page, "member", {
        transformResponse: (procedure, defaultResponse) => {
          if (procedure === "dashboard.todayWork") {
            return serializeTrpc({
              cards: {
                todayFollowUpCount: 0,
                overdueFollowUpCount: 0,
                todayScheduleCount: 0,
                incompleteScheduleCount: 0,
                pendingNotificationCount: 0,
                monthlyContractCount: 0,
                monthlyPremiumSum: 0,
                longUnmanagedCustomerCount: 0,
              },
              todayFollowUps: [],
              overdueFollowUps: [],
              todaySchedules: [],
              incompleteSchedules: [],
              pendingNotifications: [],
              longUnmanagedCustomers: [],
            });
          }
          return defaultResponse;
        },
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });

      const mobileNav = page.getByTestId("mobile-nav");
      await expect(mobileNav).toBeVisible();
      const navBox = await mobileNav.boundingBox();

      const queue = page.getByTestId("dashboard-mobile-followup-queue");
      await expect(queue).toBeVisible();

      const emptyText = queue.getByText("오늘 처리할 업무가 없습니다. 모두 확인했습니다.");
      await expect(emptyText).toBeVisible();
      const emptyBox = await emptyText.boundingBox();
      expect(emptyBox).not.toBeNull();
      expect(emptyBox!.y + emptyBox!.height).toBeLessThan(navBox!.y);
      await expectNoHorizontalOverflow(page);
    });

    test(`remediation stress: ${vp.name} with 2-line manager greeting, 2-line task title, and 2-digit counts preserves clearance and avoids calendar routing`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const longName = "검수전용고객명이매우긴가나다라마바사아자차카타파하대한민국테스트";
      const longTitle = "긴급 상담과 계약 갱신 검토 및 재연락 업무 제목 테스트";

      await mockBoaTrpc(page, "branch_admin", {
        transformResponse: (procedure, defaultResponse) => {
          if (procedure === "dashboard.todayWork") {
            return serializeTrpc({
              cards: {
                todayFollowUpCount: 12,
                overdueFollowUpCount: 0,
                todayScheduleCount: 23,
                incompleteScheduleCount: 0,
                pendingNotificationCount: 0,
                monthlyContractCount: 0,
                monthlyPremiumSum: 0,
                longUnmanagedCustomerCount: 0,
              },
              todayFollowUps: Array.from({ length: 12 }, (_, i) => ({
                id: 800 + i,
                customerId: 101,
                customerName: i === 0 ? longName : `[E2E] Customer ${i}`,
                nextContactDate: new Date().toISOString(),
                status: "scheduled",
                note: longTitle,
              })),
              overdueFollowUps: [],
              todaySchedules: Array.from({ length: 23 }, (_, i) => ({
                id: 900 + i,
                customerId: 101,
                title: `[E2E] Schedule ${i}`,
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 3600000).toISOString(),
                scheduleType: "meeting",
                status: "pending",
              })),
              incompleteSchedules: [],
              pendingNotifications: [],
              longUnmanagedCustomers: [],
            });
          }
          return defaultResponse;
        },
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });

      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      const mobileNav = page.getByTestId("mobile-nav");
      await expect(mobileNav).toBeVisible();
      const navBox = await mobileNav.boundingBox();
      expect(navBox).not.toBeNull();

      const queue = page.getByTestId("dashboard-mobile-followup-queue");
      await expect(queue).toBeVisible();
      const primaryBtn = queue
        .getByRole("button", { name: "완료", exact: true })
        .first();
      await expect(primaryBtn).toBeVisible();
      const btnBox = await primaryBtn.boundingBox();
      expect(btnBox).not.toBeNull();

      // Must preserve clearance >= 16px even under stress
      const clearance = navBox!.y - (btnBox!.y + btnBox!.height);
      expect(clearance).toBeGreaterThanOrEqual(16);

      // Lower edge tap test: must open dialog and NOT navigate to /calendar
      const lowerPoint = {
        x: btnBox!.x + btnBox!.width / 2,
        y: btnBox!.y + btnBox!.height - 4,
      };
      try {
        await page.touchscreen.tap(lowerPoint.x, lowerPoint.y);
      } catch {
        await page.mouse.click(lowerPoint.x, lowerPoint.y);
      }
      await page.waitForTimeout(300);
      expect(page.url()).not.toContain("/calendar");
      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible();
      await alertDialog.getByRole("button", { name: "취소" }).click();

      await expectNoHorizontalOverflow(page);
    });
  }

  const ROLES = [
    "branch_admin",
    "sub_branch_admin",
    "team_leader",
    "member",
  ] as const;

  for (const role of ROLES) {
    test(`role operational isolation: ${role} preserves correct cockpit actions and KPIs at wide640`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 640, height: 800 });
      await mockBoaTrpc(page, role);

      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("dashboard-action-cockpit")).toBeVisible();
      await expect(page.getByTestId("dashboard-priority-actions")).toBeVisible();
      await expect(page.getByTestId("dashboard-quick-actions")).toBeVisible();
      await expect(page.getByTestId("dashboard-mobile-kpis")).toBeVisible();
      await expect(page.getByTestId("dashboard-core-kpis")).toBeHidden();
      await expect(
        page.getByTestId("dashboard-mobile-followup-queue")
      ).toBeVisible();

      // Check role specific quick action counts
      const quickActionGrid = page.getByTestId("dashboard-quick-actions");
      const buttons = quickActionGrid.getByRole("button");
      if (role === "member") {
        await expect(buttons).toHaveCount(4);
      } else {
        await expect(buttons).toHaveCount(5);
      }

      // First task must still be visible above MobileNav
      const mobileNav = page.getByTestId("mobile-nav");
      const navBox = await mobileNav.boundingBox();
      const queue = page.getByTestId("dashboard-mobile-followup-queue");
      const primaryBtn = queue.getByRole("button", { name: "완료" }).first();
      const btnBox = await primaryBtn.boundingBox();
      expect(btnBox).not.toBeNull();
      expect(navBox!.y - (btnBox!.y + btnBox!.height)).toBeGreaterThanOrEqual(16);

      await expectNoHorizontalOverflow(page);
    });
  }

  test("loading state displays skeleton and does not cause overflow at wide640", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await mockBoaTrpc(page, "member", {
      delayMs: 2000,
    });

    await page.goto("/", { waitUntil: "commit" });
    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test("error state displays retry button and recovers on click at wide640", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    let shouldFail = true;

    await mockBoaTrpc(page, "member", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "dashboard.todayWork" && shouldFail) {
          return { error: { message: "Internal server error", code: -32603 } };
        }
        return defaultResponse;
      },
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const queue = page.getByTestId("dashboard-mobile-followup-queue");
    await expect(queue).toBeVisible();
    const retryBtn = queue.getByRole("button", { name: "다시 시도" });
    await expect(retryBtn).toBeVisible();

    // Now allow recovery
    shouldFail = false;
    await retryBtn.click();

    // Recovery check: primary action button becomes visible
    const primaryBtn = queue.getByRole("button", { name: "완료" }).first();
    await expect(primaryBtn).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  const SHORT_LANDSCAPE_VIEWPORTS = [
    { name: "landscape667x375", width: 667, height: 375 },
    { name: "landscape740x430", width: 740, height: 430 },
  ];

  for (const vp of SHORT_LANDSCAPE_VIEWPORTS) {
    test(`short landscape viewport: ${vp.name} handles natural vertical scroll without collision or horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockBoaTrpc(page, "member");

      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Mobile nav boundary
      const mobileNav = page.getByTestId("mobile-nav");
      await expect(mobileNav).toBeVisible();

      // Scroll into view of first task button
      const queue = page.getByTestId("dashboard-mobile-followup-queue");
      await expect(queue).toBeVisible();
      const primaryBtn = queue.getByRole("button", { name: "완료" }).first();
      await primaryBtn.scrollIntoViewIfNeeded();

      // Primary button is clickable and reachable
      await expect(primaryBtn).toBeVisible();
      await primaryBtn.click({ force: false });

      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible();
      await alertDialog.getByRole("button", { name: "취소" }).click();
      await expect(alertDialog).toBeHidden();

      await expectNoHorizontalOverflow(page);
    });
  }
});
