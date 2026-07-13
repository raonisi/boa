import AxeBuilder from "@axe-core/playwright";
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
      await expect(
        page.getByTestId("customer-detail-followup-summary")
      ).toBeVisible();
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

      const quickActionHub = page.getByTestId("customer-quick-action-hub");
      await expect(quickActionHub).toBeVisible();
      await expect(page.getByTestId("customer-quick-action-title")).toHaveText(
        "다음 행동"
      );
      await expect(quickActionHub).toContainText(
        "상담, 후속, 일정을 빠르게 확인하세요"
      );
      await expect(
        page.getByTestId("customer-quick-action-consultation")
      ).toHaveText("상담기록 보기");
      await expect(page.getByTestId("customer-quick-action-followup")).toHaveText(
        "후속 확인"
      );
      await expect(page.getByTestId("customer-quick-action-calendar")).toHaveText(
        "일정 보기"
      );
      await expect(
        page.getByTestId("customer-quick-action-notifications")
      ).toHaveText("알림 확인");
      await expect(quickActionHub).not.toContainText("전화");
      await expect(quickActionHub).not.toContainText("문자");

      // Verify no horizontal overflow
      await expectNoHorizontalOverflow(page);

      const summaryConsultationAction = page.getByTestId(
        "customer-360-action-consultation"
      );
      await summaryConsultationAction.scrollIntoViewIfNeeded();
      await expectMinimumHitTarget(summaryConsultationAction, 44);
      await expectClickCenterReachable(summaryConsultationAction);

      for (const testId of [
        "customer-quick-action-consultation",
        "customer-quick-action-followup",
        "customer-quick-action-calendar",
        "customer-quick-action-notifications",
      ]) {
        const quickAction = page.getByTestId(testId);
        await quickAction.evaluate(element =>
          element.scrollIntoView({ block: "center", inline: "nearest" })
        );
        await expectMinimumHitTarget(quickAction, 44);
      }

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

  test("keeps quick action hub on existing routes", async ({ page }) => {
    await setResponsiveViewport(page, "mobile360");
    await mockBoaTrpc(page, "member");
    await page.goto("/customers/101");

    await page.getByTestId("customer-quick-action-consultation").click();
    await expect(page).toHaveURL(/\/customers\/101/);

    await page.getByTestId("customer-quick-action-followup").click();
    await expect(page).toHaveURL(/\/customers\/101/);

    await page.getByTestId("customer-quick-action-calendar").click();
    await expect(page).toHaveURL(/\/calendar\?customerId=101&action=quick-create/);

    await page.goto("/customers/101");
    await page.getByTestId("customer-quick-action-notifications").click();
    await expect(page).toHaveURL(/\/notifications/);
  });

  test("keeps five task tabs in URL state across reload and browser history", async ({
    page,
  }) => {
    await setResponsiveViewport(page, "mobile390");
    await mockBoaTrpc(page, "member");
    await page.goto("/customers/101");

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    await expect(page.getByRole("tab", { name: "요약", exact: true })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: /상담·후속관리/ }).click();
    await expect(page).toHaveURL(/\/customers\/101\?tab=consultation/);
    await expect(page.getByRole("tab", { name: /상담·후속관리/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.reload();
    await expect(page.getByRole("tab", { name: /상담·후속관리/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: /계약/ }).click();
    await expect(page).toHaveURL(/\/customers\/101\?tab=contracts/);
    await page.goBack();
    await expect(page.getByRole("tab", { name: /상담·후속관리/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("falls back to summary for invalid tabs and supports keyboard navigation", async ({
    page,
  }) => {
    await setResponsiveViewport(page, "mobile360");
    await mockBoaTrpc(page, "member");
    await page.goto("/customers/101?tab=not-a-real-tab");

    const summaryTab = page.getByRole("tab", { name: "요약", exact: true });
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");
    await summaryTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /상담·후속관리/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page).toHaveURL(/tab=consultation/);
    await expectNoHorizontalOverflow(page);
  });

  test("does not repeat a handled quick action when the user changes tabs", async ({
    page,
  }) => {
    await setResponsiveViewport(page, "mobile390");
    await mockBoaTrpc(page, "member");
    await page.goto("/customers/101?action=consult");

    const dialog = page.getByRole("dialog", { name: "상담기록 추가" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("tab", { name: /계약/ }).click();
    await expect(page).toHaveURL(/action=consult.*tab=contracts/);
    await expect(dialog).toBeHidden();
  });

  test("opens schedule and notification workspaces from the schedule tab", async ({
    page,
  }) => {
    await setResponsiveViewport(page, "mobile390");
    await mockBoaTrpc(page, "member");
    await page.goto("/customers/101?tab=schedule");

    await expect(page.getByRole("heading", { name: "고객 연결 일정" })).toBeVisible();
    await page
      .getByRole("tabpanel")
      .getByRole("button", { name: "일정 등록", exact: true })
      .click();
    await expect(page).toHaveURL(/\/calendar\?customerId=101&action=quick-create/);

    await page.goto("/customers/101?tab=schedule");
    await page
      .getByRole("tabpanel")
      .getByRole("button", { name: "알림 확인", exact: true })
      .click();
    await expect(page).toHaveURL(/\/notifications/);
  });

  test("keeps every task tab free of critical and serious accessibility violations", async ({
    page,
  }) => {
    await setResponsiveViewport(page, "mobile390");
    await mockBoaTrpc(page, "member");
    await page.goto("/customers/101");

    for (const tabName of [
      "요약",
      "상담·후속관리",
      "계약",
      "일정·알림",
      "히스토리·인수인계",
    ]) {
      await page.getByRole("tab", { name: new RegExp(tabName) }).click();
      const panelId = await page.getByRole("tabpanel").getAttribute("id");
      expect(panelId).toBeTruthy();
      const results = await new AxeBuilder({ page })
        .include('[data-testid="customer-detail-mobile-tabs"]')
        .include(`#${panelId}`)
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations.filter(violation =>
        ["critical", "serious"].includes(violation.impact ?? "")
      );
      expect(blocking, `${tabName} accessibility violations`).toEqual([]);
    }
  });
});
