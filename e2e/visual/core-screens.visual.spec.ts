import { expect, test, type Locator, type Page } from "@playwright/test";

import { mockBoaTrpc } from "../fixtures/mock-trpc";
import {
  collectPageErrors,
  expectClickCenterReachable,
  expectMinimumVerticalGapBetween,
  RESPONSIVE_VIEWPORTS,
  setResponsiveViewport,
} from "../helpers/layout-metrics";

type VisualViewportKey = "desktop1440" | "mobile390" | "mobile360";

type ScreenConfig = {
  slug: string;
  path: string;
  ready: (page: Page) => Locator;
  prepare?: (page: Page, viewport: VisualViewportKey) => Promise<void>;
};

const VIEWPORTS = [
  { key: "desktop1440", tag: "@desktop" },
  { key: "mobile390", tag: "@mobile" },
  { key: "mobile360", tag: "@mobile" },
] as const satisfies ReadonlyArray<{
  key: VisualViewportKey;
  tag: "@desktop" | "@mobile";
}>;

const INTERNAL_SCROLL_ALLOW_LIST = [
  {
    selector: '[data-testid="operation-risk-tab-scroll"]',
    reason: "Operation risk tabs intentionally scroll inside their tab row.",
  },
  {
    selector: '[data-testid="notifications-bulk-actions"]',
    reason: "Notification bulk actions may scroll within their toolbar.",
  },
  {
    selector: '[class*="overflow-x-auto"]',
    reason: "Table/filter regions may use a bounded horizontal scroll container.",
  },
  {
    selector: '[class*="overflow-auto"]',
    reason: "Bounded tool panels may use their own internal scroll container.",
  },
  {
    selector: "[data-radix-scroll-area-viewport]",
    reason: "Radix scroll areas own their internal overflow.",
  },
] as const;

const CORE_SCREENS: ScreenConfig[] = [
  {
    slug: "dashboard",
    path: "/",
    ready: page => page.getByText("[E2E] Customer Alpha").first(),
  },
  {
    slug: "customer-list",
    path: "/customers",
    ready: page => page.getByText("[E2E] Customer Alpha").first(),
  },
  {
    slug: "customer-detail",
    path: "/customers/101",
    ready: page => page.getByText("[E2E] Customer Alpha").first(),
    prepare: async (page, viewport) => {
      if (!viewport.startsWith("mobile")) return;
      await expectCustomerDetailMobileActionBarClearance(page);
    },
  },
  {
    slug: "customer-assign",
    path: "/customers/assign",
    ready: page => page.getByText("[E2E] Customer Alpha").first(),
    prepare: async (page, viewport) => {
      if (!viewport.startsWith("mobile")) return;
      const checkbox = page.getByRole("checkbox").first();
      await checkbox.check();
      const actionBar = page
        .getByRole("region")
        .filter({ has: page.getByRole("button") })
        .last();
      const mobileNav = page.locator("nav.fixed").first();
      await expect(actionBar).toBeVisible();
      await expectMinimumVerticalGapBetween(actionBar, mobileNav, 8);
      await expectClickCenterReachable(actionBar.getByRole("button").first());
    },
  },
  {
    slug: "bulk-import",
    path: "/customers/bulk-import",
    ready: page => page.getByRole("button").filter({ hasText: /CSV|양식|다운로드/ }).first(),
  },
  {
    slug: "calendar",
    path: "/calendar",
    ready: page => page.getByText("[E2E] Customer Alpha").first(),
  },
  {
    slug: "notifications",
    path: "/notifications",
    ready: page => page.getByTestId("notifications-bulk-actions"),
  },
  {
    slug: "download",
    path: "/download",
    ready: page => page.getByRole("button", { name: /CSV|다운로드/ }).first(),
  },
  {
    slug: "operation-risk",
    path: "/operation-risk",
    ready: page => page.getByTestId("operation-risk-tab-scroll"),
    prepare: async page => {
      const tabScroll = page.getByTestId("operation-risk-tab-scroll");
      const tabMetrics = await tabScroll.evaluate(container => {
        const list = container.querySelector('[data-slot="tabs-list"]');
        const children = list ? Array.from(list.children) : [];
        const topValues = new Set(
          children.map(child => Math.round(child.getBoundingClientRect().top))
        );
        return {
          topCount: topValues.size,
          containerScrollWidth: container.scrollWidth,
          containerClientWidth: container.clientWidth,
        };
      });
      expect(tabMetrics.topCount).toBe(1);
      expect(tabMetrics.containerScrollWidth).toBeGreaterThanOrEqual(
        tabMetrics.containerClientWidth
      );
    },
  },
];

test.use({ screenshot: "off", trace: "off", video: "off" });

test.describe("QA-VISUAL-BASELINE-01 mock visual baselines", () => {
  for (const viewport of VIEWPORTS) {
    for (const screen of CORE_SCREENS) {
      test(`${screen.slug} ${viewport.key} visual baseline ${viewport.tag}`, async ({
        page,
      }, testInfo) => {
        const isDesktopViewport = viewport.tag === "@desktop";
        const isMobileViewport = viewport.tag === "@mobile";
        test.skip(
          (isDesktopViewport && testInfo.project.name !== "desktop-chromium") ||
            (isMobileViewport && testInfo.project.name !== "mobile-chromium") ||
            testInfo.project.name === "desktop-1280",
          "visual baselines run only on their matching desktop/mobile project"
        );

        await setResponsiveViewport(page, viewport.key);
        await mockBoaTrpc(page, "branch_admin");
        const errors = collectPageErrors(page);

        await test.step(`open ${screen.path}`, async () => {
          await page.goto(screen.path, { waitUntil: "domcontentloaded" });
          await waitForVisualReady(page, screen);
        });

        await test.step("layout assertions", async () => {
          await screen.prepare?.(page, viewport.key);
          await expectVisualStablePageShell(page, errors);
          await expectAllowedInternalScrollOnly(page, screen.path);
          await expectPrimaryActionInViewportWhenPresent(page);
        });

        await test.step("privacy assertions", async () => {
          await expectNoProductionLikeSensitiveStrings(page);
        });

        await test.step("screenshot baseline", async () => {
          await expect(page).toHaveScreenshot(
            `${screen.slug}-${viewport.key}.png`,
            {
              animations: "disabled",
              caret: "hide",
              fullPage: viewport.tag === "@desktop",
              mask: maskSensitiveAreas(page),
              maskColor: "#e5e7eb",
              maxDiffPixelRatio: 0.01,
              timeout: 20_000,
            }
          );
        });
      });
    }
  }
});

async function waitForVisualReady(page: Page, screen: ScreenConfig) {
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("main, #main-content").first()).toBeVisible();
  await expect(screen.ready(page)).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.waitForTimeout(150);
}

async function expectVisualStablePageShell(page: Page, errors: string[]) {
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText(/login required|not found/i)).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);
  expect(errors, errors.join("\n")).toEqual([]);
}

async function expectNoPageHorizontalOverflow(page: Page, tolerancePx = 8) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth - metrics.clientWidth).toBeLessThanOrEqual(
    tolerancePx
  );
}

function maskSensitiveAreas(page: Page) {
  return [
    page.getByText(/\[E2E\]|\[TEST\]|010-|1985-05-18|e2e\.test/i),
    page.locator('a[href^="tel:"]'),
    page.locator('[title*="[E2E]"], [aria-label*="[E2E]"]'),
  ];
}

async function expectNoProductionLikeSensitiveStrings(page: Page) {
  const text = (await page.locator("body").innerText()).replaceAll(
    "010-1000-2000",
    ""
  );
  expect(text).not.toMatch(/\b\d{6}-\d{7}\b/);
  expect(text).not.toMatch(/\b01[016789]-\d{3,4}-\d{4}\b/);
  expect(text).not.toMatch(/[A-Z0-9._%+-]+@(?!e2e\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}/i);
}

async function expectAllowedInternalScrollOnly(page: Page, route: string) {
  await expectNoPageHorizontalOverflow(page);
  const offenders = await page.evaluate(allowList => {
    function isVisible(element: Element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }

    return Array.from(document.querySelectorAll("body *"))
      .filter(element => isVisible(element))
      .filter(element => {
        if (element.classList.contains("sr-only")) return false;
        const style = window.getComputedStyle(element);
        const ownsHorizontalScroll =
          style.overflowX === "auto" || style.overflowX === "scroll";
        return (
          ownsHorizontalScroll && element.scrollWidth > element.clientWidth + 1
        );
      })
      .map(element => {
        const matched = allowList.find(item =>
          Boolean(element.closest(item.selector))
        );
        return {
          tag: element.tagName.toLowerCase(),
          className:
            typeof element.getAttribute("class") === "string"
              ? element.getAttribute("class")
              : "",
          testId: element.getAttribute("data-testid"),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          allowedBy: matched?.selector ?? null,
        };
      })
      .filter(item => !item.allowedBy);
  }, INTERNAL_SCROLL_ALLOW_LIST);

  expect(
    offenders,
    `${route} has unallowlisted internal horizontal overflow:\n${JSON.stringify(
      offenders,
      null,
      2
    )}`
  ).toEqual([]);
}

async function expectPrimaryActionInViewportWhenPresent(page: Page) {
  const action = page
    .locator('main button:visible, main a[href]:visible, [role="main"] button:visible')
    .first();
  if ((await action.count()) === 0) return;
  const box = await action.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return;
  expect(box.x + box.width).toBeGreaterThanOrEqual(0);
  expect(box.x).toBeLessThanOrEqual(viewport.width);
  expect(box.y + Math.min(box.height, 44)).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThanOrEqual(viewport.height);
}

async function expectCustomerDetailMobileActionBarClearance(page: Page) {
  const mobileNav = page.locator("nav.fixed.bottom-0").first();
  const actionBar = page
    .locator("div.fixed.inset-x-0")
    .filter({ has: page.locator("button") })
    .first();
  await expect(mobileNav).toBeVisible();
  await expect(actionBar).toBeVisible();
  await expectMinimumVerticalGapBetween(actionBar, mobileNav, 8);
  await expectClickCenterReachable(actionBar.getByRole("button").first());
}
