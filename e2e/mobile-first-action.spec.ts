import { expect, test, type Page } from "@playwright/test";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  collectPageErrors,
  expectClickCenterReachable,
  expectMinimumHitTarget,
  expectNoHorizontalOverflow,
  getLocatorRect,
} from "./helpers/layout-metrics";

function serializeTrpc(data: unknown) {
  return { result: { data: SuperJSON.serialize(data) } };
}

test.describe("BOA-CRM-AG04 Mobile First-Action UX", () => {
  const MOBILE_VIEWPORTS = [
    { name: "mobile360", width: 360, height: 800 },
    { name: "mobile390", width: 390, height: 844 },
  ];

  for (const vp of MOBILE_VIEWPORTS) {
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
      expect(navTopY - (btnBox!.y + btnBox!.height)).toBeGreaterThanOrEqual(16);

      // 6. Touch target size meets minimum requirement (>= 44px)
      await expectMinimumHitTarget(primaryBtn, 44);

      // 7. Click center is reachable (not intercepted by MobileNav or other overlay)
      await expectClickCenterReachable(primaryBtn);

      // 8. Lower edge touch point hits primary button directly, not MobileNav
      const lowerPoint = { x: btnBox!.x + btnBox!.width / 2, y: btnBox!.y + btnBox!.height - 4 };
      const hitInside = await page.evaluate(({ x, y }) => {
        const h = document.elementFromPoint(x, y);
        return h?.closest('button')?.textContent?.includes('완료') || h?.closest('[data-testid="dashboard-mobile-followup-queue"]') !== null;
      }, lowerPoint);
      expect(hitInside).toBe(true);

      // 9. Direct click without force succeeds and opens completion flow
      await primaryBtn.click({ force: false });
      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible();
      await expect(alertDialog.getByRole("heading")).toContainText("후속관리를 완료할까요?");
      await alertDialog.getByRole("button", { name: "취소" }).click();
      await expect(alertDialog).toBeHidden();

      // 10. Zero horizontal overflow
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

      const initialScrollY = await page.evaluate(() => window.scrollY);
      expect(initialScrollY).toBe(0);

      const mobileNav = page.getByTestId("mobile-nav");
      await expect(mobileNav).toBeVisible();
      const mobileNavBox = await mobileNav.boundingBox();
      expect(mobileNavBox).not.toBeNull();
      const navTopY = mobileNavBox!.y;

      const queue = page.getByTestId("dashboard-mobile-followup-queue");
      await expect(queue).toBeVisible();

      // Empty state text
      const emptyState = queue.getByText("오늘 처리할 업무가 없습니다. 모두 확인했습니다.");
      await expect(emptyState).toBeVisible();
      const emptyBox = await emptyState.boundingBox();
      expect(emptyBox).not.toBeNull();
      expect(emptyBox!.y).toBeGreaterThan(0);
      expect(emptyBox!.y + emptyBox!.height).toBeLessThan(navTopY);

      await expectNoHorizontalOverflow(page);
    });
  }

  test("long Korean content does not cause horizontal overflow at 360px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const longName = "대한민국최장고객명테스트홍길동이순신세종대왕김유신강감찬";
    const longTitle = "[긴급안내] 2026년도 하반기 특별 보장 분석 및 만기 환급형 계약 갱신 검토 요청 건";
    const now = new Date().toISOString();

    await mockBoaTrpc(page, "member", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "dashboard.todayWork") {
          return serializeTrpc({
            cards: {
              todayFollowUpCount: 1,
              overdueFollowUpCount: 0,
              todayScheduleCount: 0,
              incompleteScheduleCount: 0,
              pendingNotificationCount: 0,
              monthlyContractCount: 0,
              monthlyPremiumSum: 0,
              longUnmanagedCustomerCount: 0,
            },
            todayFollowUps: [
              {
                id: 888,
                customerId: 101,
                customerName: longName,
                nextContactDate: now,
                status: "scheduled",
                note: longTitle,
              },
            ],
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

    const queue = page.getByTestId("dashboard-mobile-followup-queue");
    await expect(queue).toBeVisible();

    const titleEl = queue.locator("button.line-clamp-2").first();
    await expect(titleEl).toBeVisible();
    await expect(titleEl).toContainText(longName);

    await expectNoHorizontalOverflow(page);
  });

  test("queue filters and summary chips update filter state correctly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockBoaTrpc(page, "member");

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const queue = page.getByTestId("dashboard-mobile-followup-queue");
    await expect(queue).toBeVisible();

    // Summary chip click switches filter
    const pendingChip = page.getByTestId("mobile-followup-pending-chip");
    await expect(pendingChip).toBeVisible();
    await pendingChip.click();

    // Filter button for followup is now active
    const followupFilterBtn = queue.getByRole("button", { name: /오늘 업무 필터: 후속관리/ });
    await expect(followupFilterBtn).toHaveAttribute("aria-pressed", "true");

    // Click schedule summary chip
    const scheduleChip = page.getByTestId("mobile-followup-today-chip");
    await scheduleChip.click();
    const scheduleFilterBtn = queue.getByRole("button", { name: /오늘 업무 필터: 오늘 예정/ });
    await expect(scheduleFilterBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("remediation stress: 360x800 with 2-line manager greeting, 2-line task title, and 2-digit counts preserves clearance and avoids calendar routing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
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

    // 1. Initial scroll must be 0
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // 2. Mobile nav boundary
    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible();
    const navBox = await mobileNav.boundingBox();
    expect(navBox).not.toBeNull();

    // 3. Queue and first action button
    const queue = page.getByTestId("dashboard-mobile-followup-queue");
    await expect(queue).toBeVisible();
    const primaryBtn = queue.getByRole("button", { name: "완료", exact: true }).first();
    await expect(primaryBtn).toBeVisible();
    const btnBox = await primaryBtn.boundingBox();
    expect(btnBox).not.toBeNull();

    // 4. Primary button bottom must be above MobileNav with >= 16px safety clearance
    const clearance = navBox!.y - (btnBox!.y + btnBox!.height);
    expect(clearance).toBeGreaterThanOrEqual(16);

    // 5. Summary chips must display full 2-digit counts
    const pendingChip = page.getByTestId("mobile-followup-pending-chip");
    const todayChip = page.getByTestId("mobile-followup-today-chip");
    const recentChip = page.getByTestId("mobile-followup-recent-chip");

    await expect(pendingChip).toContainText("12건");
    await expect(todayChip).toContainText("23건");
    await expect(recentChip).toContainText("최근 후속");

    // 6. Lower edge touch point (4px from bottom edge) must hit the button, NOT MobileNav
    const lowerPoint = { x: btnBox!.x + btnBox!.width / 2, y: btnBox!.y + btnBox!.height - 4 };
    const hitInside = await page.evaluate(({ x, y }) => {
      const h = document.elementFromPoint(x, y);
      return h?.closest('button')?.textContent?.includes('완료') || h?.closest('[data-testid="dashboard-mobile-followup-queue"]') !== null;
    }, lowerPoint);
    expect(hitInside).toBe(true);

    // 7. Touch lower edge: must open dialog and NOT navigate to /calendar
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

    // 8. Zero horizontal overflow
    await expectNoHorizontalOverflow(page);
  });

  const ROLES = ["branch_admin", "sub_branch_admin", "team_leader", "member"] as const;

  for (const role of ROLES) {
    test(`role operational isolation: ${role} preserves correct cockpit actions and KPIs on mobile`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await mockBoaTrpc(page, role);

      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("dashboard-action-cockpit")).toBeVisible();
      await expect(page.getByTestId("dashboard-priority-actions")).toBeVisible();
      await expect(page.getByTestId("dashboard-quick-actions")).toBeVisible();
      await expect(page.getByTestId("dashboard-mobile-kpis")).toBeVisible();
      await expect(page.getByTestId("dashboard-core-kpis")).toBeHidden();
      await expect(page.getByTestId("dashboard-mobile-followup-queue")).toBeVisible();

      // Quick action hit targets >= 44px
      const quickBtns = page.getByTestId("dashboard-quick-actions").getByRole("button");
      await expect(quickBtns).toHaveCount(4);
      for (let i = 0; i < 4; i++) {
        await expectMinimumHitTarget(quickBtns.nth(i), 44);
        await expectClickCenterReachable(quickBtns.nth(i));
      }

      if (role === "branch_admin") {
        await expect(page.getByTestId("dashboard-admin-attention")).toBeVisible();
        await expect(page.getByTestId("dashboard-quick-action-assign-database")).toBeVisible();
        await expect(page.getByTestId("dashboard-quick-action-schedule-approvals")).toBeVisible();
      } else {
        await expect(page.getByTestId("dashboard-admin-attention")).toHaveCount(0);
      }

      await expectNoHorizontalOverflow(page);
    });
  }

  test("branch_admin contract delete navigation preserves AG-02 behavior", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const contractDeleteCard = page
      .getByTestId("dashboard-admin-attention")
      .locator(".crm-dashboard-card")
      .filter({ hasText: "계약 삭제 승인" });
    await expect(contractDeleteCard).toBeVisible();

    const reviewBtn = contractDeleteCard.getByRole("button", { name: "검토" });
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    await page.waitForURL("**/deleted-data**");
    expect(page.url()).toContain("/deleted-data");
  });

  const RESPONSIVE_VIEWPORTS = [
    { name: "tablet768", width: 768, height: 1024, isDesktop: true },
    { name: "desktop1280", width: 1280, height: 800, isDesktop: true },
    { name: "desktop1440", width: 1440, height: 900, isDesktop: true },
  ];

  for (const vp of RESPONSIVE_VIEWPORTS) {
    test(`responsive layout consistency across larger viewports: ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockBoaTrpc(page, "branch_admin");

      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("dashboard-action-cockpit")).toBeVisible();
      await expect(page.getByTestId("dashboard-mobile-followup-queue")).toBeVisible();

      if (vp.isDesktop) {
        await expect(page.getByTestId("dashboard-core-kpis")).toBeVisible();
        await expect(page.getByTestId("dashboard-mobile-kpis")).toBeHidden();
      }

      await expectNoHorizontalOverflow(page);
    });
  }
});
