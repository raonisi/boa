import { expect, test } from "@playwright/test";

import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  collectPageErrors,
  expectClickCenterReachable,
  expectLocatorWithinViewport,
  expectMinimumHitTarget,
  expectMinimumVerticalGapBetween,
  expectNoHorizontalOverflow,
  expectNoOverlapBetween,
  RESPONSIVE_VIEWPORTS,
  setResponsiveViewport,
} from "./helpers/layout-metrics";

test.describe("CustomerDetail mobile action bar", () => {
  const viewports = ["mobile390", "mobile375", "mobile360"] as const;

  for (const viewport of viewports) {
    test(`renders without overlapping MobileNav at ${viewport}`, async ({
      page,
    }) => {
      const errors = collectPageErrors(page);

      // Set viewport before navigating so isMobile hook triggers
      await setResponsiveViewport(page, viewport);

      // Setup mock
      await mockBoaTrpc(page, "member");
      await page.goto("/customers/101");

      // Wait for the page to load
      await page.waitForSelector("text=상담", { state: "visible" });

      const summaryCard = page.getByTestId("customer-360-summary-card");
      await expect(summaryCard).toBeVisible();
      await expect(page.getByTestId("customer-360-summary-title")).toHaveText(
        "고객 360 요약"
      );
      await expect(page.getByTestId("customer-360-priority-section")).toContainText(
        "오늘 먼저 확인할 것"
      );
      await expect(page.getByTestId("customer-360-followup-chip")).toContainText(
        /미처리 후속/
      );
      await expect(page.getByTestId("customer-360-schedule-chip")).toContainText(
        /오늘 일정/
      );
      await expect(
        page.getByTestId("customer-360-consultation-chip")
      ).toContainText(/최근 상담|상담기록 없음/);
      await expect(page.getByTestId("customer-360-actions")).toContainText(
        "다음 행동"
      );
      await expect(page.getByTestId("customer-360-action-consultation")).toHaveText(
        "상담기록 보기"
      );
      await expect(page.getByTestId("customer-360-action-followup")).toHaveText(
        "후속 확인"
      );
      await expect(page.getByTestId("customer-360-action-calendar")).toHaveText(
        "일정 보기"
      );

      // Verify no horizontal overflow
      await expectNoHorizontalOverflow(page);

      const summaryConsultationAction = page.getByTestId(
        "customer-360-action-consultation"
      );
      await summaryConsultationAction.scrollIntoViewIfNeeded();
      await expectMinimumHitTarget(summaryConsultationAction, 44);
      await expectClickCenterReachable(summaryConsultationAction);

      // Locate MobileNav and Action bar
      const mobileNav = page.locator("nav.fixed.bottom-0").first();
      // Use the button container as the action bar identifier
      const actionBar = page.locator("button:has-text('상담')").locator("xpath=ancestor::div[contains(@class, 'fixed inset-x-0')][1]");

      await expectLocatorWithinViewport(page, mobileNav);
      await expectLocatorWithinViewport(page, actionBar);

      // Check gap and overlap
      await expectNoOverlapBetween(page, actionBar, mobileNav);
      await expectMinimumVerticalGapBetween(actionBar, mobileNav);

      // Verify CTA click center is reachable
      const consultButton = page.getByRole("button", { name: "상담", exact: true });
      await expectMinimumHitTarget(consultButton, 44);
      await expectClickCenterReachable(consultButton);

      expect(errors).toEqual([]);
    });
  }

  test("keeps customer 360 calendar CTA on the existing calendar route", async ({
    page,
  }) => {
    await setResponsiveViewport(page, "mobile390");
    await mockBoaTrpc(page, "member");
    await page.goto("/customers/101");

    await page.getByTestId("customer-360-action-calendar").click();
    await expect(page).toHaveURL(/\/calendar\?customerId=101&action=quick-create/);
  });
});
