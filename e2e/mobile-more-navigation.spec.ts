import { expect, test } from "@playwright/test";
import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  collectPageErrors,
  expectClickCenterReachable,
  expectMinimumHitTarget,
  expectNoHorizontalOverflow,
} from "./helpers/layout-metrics";

test.describe("BOA-CRM-AG07 Mobile More Navigation UX", () => {
  const VIEWPORTS = [
    { name: "mobile320", width: 320, height: 700 },
    { name: "mobile360", width: 360, height: 800 },
    { name: "mobile390", width: 390, height: 844 },
    { name: "mobile430", width: 430, height: 932 },
    { name: "wide640", width: 640, height: 800 },
    { name: "wide767", width: 767, height: 800 },
  ];

  for (const vp of VIEWPORTS) {
    test(`opens more sheet without horizontal overflow across viewport ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockBoaTrpc(page, "branch_admin");
      const errors = collectPageErrors(page);

      await page.goto("/", { waitUntil: "domcontentloaded" });

      const moreNavBtn = page
        .getByTestId("mobile-nav-item")
        .filter({ hasText: "더보기" });
      await expect(moreNavBtn).toBeVisible();
      await moreNavBtn.click();

      const moreDialog = page.getByRole("dialog");
      await expect(moreDialog).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Verify initial focus is INSIDE dialog on a non-input element (P2-001)
      const activeInfo = await page.evaluate(() => {
        const active = document.activeElement;
        const dialog = document.querySelector('[role="dialog"]');
        const insideDialog = Boolean(dialog && dialog.contains(active));
        const ariaHiddenAncestor = Boolean(active?.closest('[aria-hidden="true"]'));
        return {
          tagName: active?.tagName,
          insideDialog,
          ariaHiddenAncestor,
        };
      });
      expect(activeInfo.insideDialog).toBe(true);
      expect(activeInfo.ariaHiddenAncestor).toBe(false);
      expect(activeInfo.tagName).not.toBe("INPUT");

      // Verify search input is NOT auto-focused
      const searchInput = moreDialog.getByRole("searchbox", {
        name: "업무 메뉴 검색",
      });
      await expect(searchInput).toBeVisible();
      await expect(searchInput).not.toBeFocused();

      // Verify Logout button is visible at bottom
      const logoutBtn = moreDialog.getByRole("button", { name: "로그아웃" });
      await expect(logoutBtn).toBeVisible();
      await expectMinimumHitTarget(logoutBtn, 44);

      // Close dialog via Escape and verify focus returns to More trigger (P2-001)
      await page.keyboard.press("Escape");
      await expect(moreDialog).not.toBeVisible();
      await expect(moreNavBtn).toBeFocused();

      expect(errors).toEqual([]);
    });
  }

  test("quick links 2-column grid layout and touch targets for branch_admin", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" })
      .click();
    const moreDialog = page.getByRole("dialog");
    await expect(moreDialog).toBeVisible();
    // Wait for slide-in transition to settle
    await page.waitForTimeout(400);

    // Branch admin has 5 quick links
    const quickLinksSection = moreDialog.locator("section", {
      hasText: "오늘 바로가기",
    });
    await expect(quickLinksSection).toBeVisible();

    const quickButtons = quickLinksSection.getByTestId("mobile-more-menu-item");
    await expect(quickButtons).toHaveCount(5);

    // Verify all 5 quick links have minimum hit target >= 44px
    for (let i = 0; i < 5; i++) {
      const btn = quickButtons.nth(i);
      await expectMinimumHitTarget(btn, 44);
      await expectClickCenterReachable(btn);
    }

    // Measure boxes atomically to verify 2-column grid layout
    const boxes = await quickButtons.evaluateAll(buttons =>
      buttons.map(b => {
        const r = b.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })
    );

    // Items 1 and 2 are side-by-side in 2 columns in the same row
    expect(boxes[0].y).toBeCloseTo(boxes[1].y, -1);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);

    // Item 5 is wider than item 1 (spans both columns)
    expect(boxes[4].width).toBeGreaterThan(boxes[0].width * 1.5);

    expect(errors).toEqual([]);
  });

  test("collapsible groups default state, expansion/collapse toggles, and count badges", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" })
      .click();
    const moreDialog = page.getByRole("dialog");
    await expect(moreDialog).toBeVisible();

    // Group toggles
    const groupToggles = moreDialog.getByTestId("mobile-more-group-toggle");
    await expect(groupToggles).toHaveCount(4);

    // 1. "고객·계약" toggle must start expanded (aria-expanded="true") for core-smoke preservation
    const customerContractToggle = groupToggles.filter({ hasText: "고객·계약" });
    await expect(customerContractToggle).toHaveAttribute("aria-expanded", "true");
    await expect(customerContractToggle.getByText(/\d+/)).toBeVisible();

    // Items in "고객·계약" must be visible
    await expect(
      moreDialog.getByRole("button", { name: "세일즈 파이프라인" })
    ).toBeVisible();
    await expect(
      moreDialog.getByRole("button", { name: "고객 일괄 등록" })
    ).toBeVisible();
    await expect(
      moreDialog.getByRole("button", { name: "영업 분석" })
    ).toBeVisible();

    // 2. Other groups ("조직 운영", "운영·감사", "설정·연동") start collapsed
    const orgToggle = groupToggles.filter({ hasText: "조직 운영" });
    await expect(orgToggle).toHaveAttribute("aria-expanded", "false");

    const auditToggle = groupToggles.filter({ hasText: "운영·감사" });
    await expect(auditToggle).toHaveAttribute("aria-expanded", "false");

    const settingsToggle = groupToggles.filter({ hasText: "설정·연동" });
    await expect(settingsToggle).toHaveAttribute("aria-expanded", "false");

    // 3. Click "운영·감사" to expand it
    await auditToggle.click();
    await expect(auditToggle).toHaveAttribute("aria-expanded", "true");

    // 4. Click again to collapse it
    await auditToggle.click();
    await expect(auditToggle).toHaveAttribute("aria-expanded", "false");

    expect(errors).toEqual([]);
  });

  test("fast client-side search matches items, displays count badge, and selection navigates", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" })
      .click();
    const moreDialog = page.getByRole("dialog");
    await expect(moreDialog).toBeVisible();

    const searchInput = moreDialog.getByRole("searchbox", {
      name: "업무 메뉴 검색",
    });

    // 1. Search for "계약"
    await searchInput.fill("계약");
    await expect(moreDialog.getByText(/검색 결과/)).toBeVisible();
    const contractResult = moreDialog
      .getByTestId("mobile-more-menu-item")
      .filter({ hasText: "계약관리" });
    await expect(contractResult).toBeVisible();

    // 2. Search for "Google Calendar"
    await searchInput.fill("Google Calendar");
    const gcalResult = moreDialog
      .getByTestId("mobile-more-menu-item")
      .filter({ hasText: "Google Calendar 연동" });
    await expect(gcalResult).toBeVisible();

    // 3. Search with non-matching query displays empty message
    await searchInput.fill("존재하지않는기능명");
    await expect(
      moreDialog.getByText("일치하는 업무 메뉴가 없습니다.")
    ).toBeVisible();

    // 4. Clear button restores normal view and satisfies 44px hit target (P2-003)
    const clearBtn = moreDialog.getByRole("button", { name: "검색어 지우기" });
    await expect(clearBtn).toBeVisible();
    const clearBox = await clearBtn.boundingBox();
    expect(clearBox?.width).toBeGreaterThanOrEqual(44);
    expect(clearBox?.height).toBeGreaterThanOrEqual(44);
    await clearBtn.click();
    await expect(searchInput).toHaveValue("");
    await expect(
      moreDialog.locator("section", { hasText: "오늘 바로가기" })
    ).toBeVisible();

    // 5. Selecting a search result navigates, closes sheet, and clears query
    await searchInput.fill("온보딩");
    const onboardingItem = moreDialog
      .getByTestId("mobile-more-menu-item")
      .filter({ hasText: "온보딩 체크리스트" });
    await expect(onboardingItem).toBeVisible();
    await onboardingItem.click();

    // Sheet closes and URL navigates to /onboarding-checklists
    await expect(moreDialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/onboarding-checklists$/);

    // Re-opening more sheet shows cleared search input
    await page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" })
      .click();
    await expect(moreDialog).toBeVisible();
    const reopenedSearchInput = moreDialog.getByRole("searchbox", {
      name: "업무 메뉴 검색",
    });
    await expect(reopenedSearchInput).toHaveValue("");

    expect(errors).toEqual([]);
  });

  test("auto-expands active group when navigating to a page within that group", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockBoaTrpc(page, "branch_admin");
    const errors = collectPageErrors(page);

    // Navigate directly to /schedule-change-requests (which belongs to "운영·감사")
    await page.goto("/schedule-change-requests", { waitUntil: "domcontentloaded" });

    await page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" })
      .click();
    const moreDialog = page.getByRole("dialog");
    await expect(moreDialog).toBeVisible();

    // Both "고객·계약" and "운영·감사" should be expanded
    const customerContractToggle = moreDialog
      .getByTestId("mobile-more-group-toggle")
      .filter({ hasText: "고객·계약" });
    await expect(customerContractToggle).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    const auditToggle = moreDialog
      .getByTestId("mobile-more-group-toggle")
      .filter({ hasText: "운영·감사" });
    await expect(auditToggle).toHaveAttribute("aria-expanded", "true");

    expect(errors).toEqual([]);
  });

  test("strict role isolation: member cannot see or search admin-only items", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockBoaTrpc(page, "member");
    const errors = collectPageErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" })
      .click();
    const moreDialog = page.getByRole("dialog");
    await expect(moreDialog).toBeVisible();

    // Member quick links: only 2 items (파이프라인, 계약관리)
    const quickButtons = moreDialog
      .locator("section", { hasText: "오늘 바로가기" })
      .getByTestId("mobile-more-menu-item");
    await expect(quickButtons).toHaveCount(2);

    // Admin exclusive features must not be in DOM
    await expect(
      moreDialog.getByRole("button", { name: "운영 리스크" })
    ).toHaveCount(0);
    await expect(
      moreDialog.getByRole("button", { name: "DB 배정" })
    ).toHaveCount(0);
    await expect(
      moreDialog.getByRole("button", { name: "데이터 다운로드" })
    ).toHaveCount(0);
    await expect(
      moreDialog.getByRole("button", { name: "설정 관리" })
    ).toHaveCount(0);

    // Search for admin-only item returns 0 results
    const searchInput = moreDialog.getByRole("searchbox", {
      name: "업무 메뉴 검색",
    });
    await searchInput.fill("다운로드");
    await expect(
      moreDialog.getByText("일치하는 업무 메뉴가 없습니다.")
    ).toBeVisible();
    await expect(
      moreDialog.getByRole("button", { name: "데이터 다운로드" })
    ).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("captures visual evidence screenshots across viewports and search states", async ({
    page,
  }) => {
    const screenshotViewports = [
      { name: "320", width: 320, height: 700 },
      { name: "360", width: 360, height: 800 },
      { name: "390", width: 390, height: 844 },
      { name: "430", width: 430, height: 932 },
      { name: "640", width: 640, height: 800 },
      { name: "767", width: 767, height: 800 },
    ];

    for (const vp of screenshotViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockBoaTrpc(page, "branch_admin");
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const moreNavBtn = page
        .getByTestId("mobile-nav-item")
        .filter({ hasText: "더보기" });
      await moreNavBtn.click();
      const moreDialog = page.getByRole("dialog");
      await expect(moreDialog).toBeVisible();
      await page.waitForTimeout(400); // wait for sheet transition

      // 1. Default sheet state
      await page.screenshot({
        path: `evidence/screenshots/ag07-mobile-${vp.name}-default.png`,
      });

      // 2. Search match state
      const searchInput = moreDialog.getByRole("searchbox", {
        name: "업무 메뉴 검색",
      });
      await searchInput.fill("계약");
      await page.waitForTimeout(100);
      await page.screenshot({
        path: `evidence/screenshots/ag07-mobile-${vp.name}-search-match.png`,
      });

      // 3. Search empty state
      await searchInput.fill("없는메뉴xyz");
      await page.waitForTimeout(100);
      await page.screenshot({
        path: `evidence/screenshots/ag07-mobile-${vp.name}-search-empty.png`,
      });
    }

    // 4. Role isolation: member view at 360
    await page.setViewportSize({ width: 360, height: 800 });
    await mockBoaTrpc(page, "member");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const memberMoreBtn = page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" });
    await memberMoreBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "evidence/screenshots/ag07-member-360-restricted.png",
    });
  });

  test("P1 Remediation: chunk failure stays bounded without triggering global ErrorBoundary", async ({
    page,
  }) => {
    // 1. Desktop 1440px: chunk aborted before opening More must not crash dashboard
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockBoaTrpc(page, "branch_admin");
    await page.route(/MobileMoreSheet/, route => route.abort());

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator('[data-testid="error-fallback"]')).toHaveCount(0);

    // 2. Mobile 390px: chunk aborted before opening More must not crash dashboard
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByTestId("mobile-nav")).toBeVisible();
    await expect(page.locator('[data-testid="error-fallback"]')).toHaveCount(0);

    // 3. Clicking More with aborted chunk shows local retry banner, not global ErrorBoundary
    const moreBtn = page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" });
    await moreBtn.click();

    // Local error banner appears
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("더보기 메뉴를 불러오지 못했습니다.")).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();

    // Global dashboard & mobile nav remain fully intact
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByTestId("mobile-nav")).toBeVisible();
    await expect(page.locator('[data-testid="error-fallback"]')).toHaveCount(0);
  });

  test("P2 Remediation: slow chunk loading shows aria-busy, ignores repeat clicks, and cancels on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockBoaTrpc(page, "branch_admin");

    // Intercept chunk with delay
    let fulfillChunk: (() => void) | null = null;
    await page.route(/MobileMoreSheet/, async route => {
      await new Promise<void>(resolve => {
        fulfillChunk = resolve;
      });
      await route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const moreBtn = page
      .getByTestId("mobile-nav-item")
      .filter({ hasText: "더보기" });
    await moreBtn.click();

    // Verify aria-busy and status text
    await expect(moreBtn).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status")).toHaveText("더보기 메뉴 불러오는 중...");

    // Repeated clicks while pending do nothing
    await moreBtn.click();
    await moreBtn.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // User cancels via Escape key while pending
    await page.keyboard.press("Escape");
    await expect(moreBtn).not.toHaveAttribute("aria-busy", "true");
    await expect(moreBtn).toContainText("더보기");

    // Release chunk response
    if (fulfillChunk) fulfillChunk();
    await page.waitForTimeout(300);

    // Dialog must NOT appear after cancelled
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Unroute and click More again: opens cleanly
    await page.unroute(/MobileMoreSheet/);
    await moreBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("P2 Remediation: 4-role keyboard Enter/Space initial focus inside dialog and return focus to More trigger", async ({
    page,
  }) => {
    const roles = ["branch_admin", "sub_branch_admin", "team_leader", "member"] as const;

    for (const role of roles) {
      await page.setViewportSize({ width: 390, height: 844 });
      await mockBoaTrpc(page, role);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const moreBtn = page
        .getByTestId("mobile-nav-item")
        .filter({ hasText: "더보기" });
      await moreBtn.focus();
      await expect(moreBtn).toBeFocused();

      // Open via Enter key
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(300);

      // Verify activeElement is inside dialog and NOT aria-hidden
      const activeInfo = await page.evaluate(() => {
        const active = document.activeElement;
        const dlg = document.querySelector('[role="dialog"]');
        const insideDialog = Boolean(dlg && dlg.contains(active));
        const ariaHiddenAncestor = Boolean(active?.closest('[aria-hidden="true"]'));
        return {
          tagName: active?.tagName,
          insideDialog,
          ariaHiddenAncestor,
        };
      });

      expect(activeInfo.insideDialog).toBe(true);
      expect(activeInfo.ariaHiddenAncestor).toBe(false);
      expect(activeInfo.tagName).not.toBe("INPUT");

      // Close via Escape key
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      // Focus returns to More trigger
      await expect(moreBtn).toBeFocused();
    }
  });
});
