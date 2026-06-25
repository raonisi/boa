import { expect, type Locator, type Page } from "@playwright/test";

import {
  documentHasHorizontalOverflow,
  meetsMinimumHitTarget,
  rectWithinViewport,
  rectsOverlap,
  RESPONSIVE_VIEWPORTS,
  verticalGapBetweenRects,
  type RectLike,
} from "../../client/src/lib/layoutMetrics";
import { MOBILE_FIXED_ABOVE_NAV_GAP_PX } from "../../client/src/lib/mobileLayout";

export { RESPONSIVE_VIEWPORTS };

export async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    documentHasHorizontalOverflow(metrics.scrollWidth, metrics.clientWidth)
  ).toBe(false);
}

export async function getLocatorRect(locator: Locator): Promise<RectLike> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Expected locator to have a bounding box");
  }
  return {
    top: box.y,
    left: box.x,
    bottom: box.y + box.height,
    right: box.x + box.width,
    width: box.width,
    height: box.height,
  };
}

export async function expectLocatorWithinViewport(page: Page, locator: Locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing viewport size");
  const rect = await getLocatorRect(locator);
  expect(rectWithinViewport(rect, viewport.width, viewport.height)).toBe(true);
}

export async function expectNoOverlapBetween(
  page: Page,
  first: Locator,
  second: Locator
) {
  const [a, b] = await Promise.all([
    getLocatorRect(first),
    getLocatorRect(second),
  ]);
  expect(rectsOverlap(a, b)).toBe(false);
}

export async function expectMinimumHitTarget(
  locator: Locator,
  minSize: number
) {
  const rect = await getLocatorRect(locator);
  expect(meetsMinimumHitTarget(rect, minSize)).toBe(true);
}

/** Verifies the element center is not covered by another fixed layer (e.g. MobileNav). */
export async function expectClickCenterReachable(locator: Locator) {
  const reachable = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return false;
    return element === hit || element.contains(hit);
  });
  expect(reachable).toBe(true);
}

export async function expectMinimumVerticalGapBetween(
  upper: Locator,
  lower: Locator,
  minGap = MOBILE_FIXED_ABOVE_NAV_GAP_PX,
  tolerance = 1
) {
  const [upperRect, lowerRect] = await Promise.all([
    getLocatorRect(upper),
    getLocatorRect(lower),
  ]);
  expect(verticalGapBetweenRects(upperRect, lowerRect)).toBeGreaterThanOrEqual(
    minGap - tolerance
  );
}

export async function setResponsiveViewport(
  page: Page,
  key: keyof typeof RESPONSIVE_VIEWPORTS
) {
  const viewport = RESPONSIVE_VIEWPORTS[key];
  await page.setViewportSize(viewport);
}

const ignoredConsoleErrors = [
  /Each child in a list should have a unique "key" prop/i,
];

export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (
      message.type() === "error" &&
      !ignoredConsoleErrors.some(pattern => pattern.test(message.text()))
    ) {
      errors.push(message.text());
    }
  });
  return errors;
}

export async function expectStablePageShell(page: Page, errors: string[]) {
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText(/login required|not found/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(errors, errors.join("\n")).toEqual([]);
}
