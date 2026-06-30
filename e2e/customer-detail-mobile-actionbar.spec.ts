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

      // Verify no horizontal overflow
      await expectNoHorizontalOverflow(page);

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
});
