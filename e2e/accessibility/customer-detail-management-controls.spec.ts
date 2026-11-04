import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import {
  assertCriticalE2EEnvironment,
  CRITICAL_E2E_IDS,
  criticalE2EStorageState,
} from "../critical/fixtures";

test.use({ storageState: criticalE2EStorageState("branchAdmin") });
test.beforeAll(() => assertCriticalE2EEnvironment());

async function openManagementControls(page: Page) {
  await page.goto(`/customers/${CRITICAL_E2E_IDS.customers.primary}`);
  await expect(page.getByText("고객 상세", { exact: true })).toBeVisible();
  const card = page.locator('[data-slot="card"]').filter({
    has: page.getByText("관리 상태", { exact: true }),
  });
  const expand = card.getByRole("button", { name: "펼치기", exact: true });
  if (await expand.isVisible()) await expand.click();
  const priority = card.getByRole("combobox", { name: "우선순위", exact: true, includeHidden: true });
  const nextAction = card.getByRole("combobox", { name: "다음 액션", exact: true, includeHidden: true });
  await expect(priority).toBeVisible();
  await expect(nextAction).toBeVisible();
  return { priority, nextAction };
}

async function activate(target: Locator, touch: boolean) {
  if (touch) await target.tap();
  else await target.click();
}

test("management controls have distinct field names and no button-name violations", async ({ page }, info) => {
  const { priority, nextAction } = await openManagementControls(page);
  await expect(page.getByLabel("우선순위", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("다음 액션", { exact: true })).toHaveCount(1);
  await expect(priority).toHaveAccessibleName("우선순위");
  await expect(nextAction).toHaveAccessibleName("다음 액션");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await writeFile(info.outputPath("expanded-axe.json"), JSON.stringify(result, null, 2));
  await writeFile(info.outputPath("named-controls.json"), JSON.stringify({
    priority: { html: await priority.evaluate(el => el.outerHTML), tree: await priority.ariaSnapshot() },
    nextAction: { html: await nextAction.evaluate(el => el.outerHTML), tree: await nextAction.ariaSnapshot() },
  }, null, 2));
  expect(result.violations.filter(violation => violation.id === "button-name")).toEqual([]);
});

test("Enter and Space open both controls, Escape returns focus, and Tab follows field order", async ({ page }) => {
  const { priority, nextAction } = await openManagementControls(page);
  for (const control of [priority, nextAction]) {
    for (const key of ["Enter", "Space"]) {
      await control.focus();
      await control.press(key);
      await expect(page.getByRole("listbox")).toBeVisible();
      await expect(control).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("listbox")).toBeHidden();
      await expect(control).toBeFocused();
    }
  }
  await priority.focus();
  await page.keyboard.press("Tab");
  await expect(nextAction).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(priority).toBeFocused();
});

test("mouse or touch selection preserves management mutation payloads and saved values", async ({ page, isMobile }, info) => {
  const { priority, nextAction } = await openManagementControls(page);
  const requests: unknown[] = [];
  async function choose(control: Locator, option: string, expected: Record<string, unknown>) {
    await activate(control, isMobile);
    const requestPromise = page.waitForRequest(request =>
      request.method() === "POST" && request.url().includes("customers.updateManagementMeta")
    );
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().includes("customers.updateManagementMeta")
    );
    await activate(page.getByRole("option", { name: option, exact: true }), isMobile);
    const request = await requestPromise;
    const response = await responsePromise;
    const body = request.postDataJSON();
    const payload = (body["0"] ?? body).json;
    expect(payload).toEqual({ customerId: CRITICAL_E2E_IDS.customers.primary, ...expected });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect((Array.isArray(result) ? result : [result]).every(row => row.result && !row.error)).toBe(true);
    await expect(control).toHaveText(option);
    await expect(page.getByRole("listbox")).toBeHidden();
    requests.push({ payload, status: response.status() });
  }
  await expect(priority).toHaveText("B");
  await expect(nextAction).toHaveText("선택 안 함 · 설정 필요");
  await choose(priority, "A", { priority: "A" });
  await choose(priority, "B", { priority: "B" });
  await choose(nextAction, "재연락", { nextAction: "재연락" });
  await choose(nextAction, "선택 안 함 · 설정 필요", { nextAction: null });
  await writeFile(info.outputPath("selection-payloads.json"), JSON.stringify({ input: isMobile ? "touch" : "mouse", requests }, null, 2));
  const restored = await openManagementControls(page);
  await expect(restored.priority).toHaveText("B");
  await expect(restored.nextAction).toHaveText("선택 안 함 · 설정 필요");
});
