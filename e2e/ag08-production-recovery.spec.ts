import { test, expect, type ProductionStatic, type ProductionAsset } from "./fixtures/production-static";
import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

type ModuleRow = { url: string; resourceType: string; status?: number; mime?: string; bytes?: number; sha256?: string; error?: string };
type Observation = {
  documents: string[]; requests: ModuleRow[]; responses: ModuleRow[]; failed: ModuleRow[];
  pageErrors: string[]; consoleErrors: string[]; notes: Record<string, unknown>; flush(): Promise<void>;
};
const names: Record<number, string> = { 101: "[TEST] Production Customer A101", 102: "[TEST] Production Customer B102" };
const observations = new WeakMap<Page, Observation>();
const serverStart = new WeakMap<Page, number>();
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const envelope = (value: unknown) => ({ result: { data: SuperJSON.serialize(value) } });

function watch(page: Page, production: ProductionStatic): Observation {
  const paths = new Set([production.assets.customerDetail.path, production.assets.moreSheet.path]);
  const pending: Promise<void>[] = [];
  const result: Observation = {
    documents: [], requests: [], responses: [], failed: [], pageErrors: [], consoleErrors: [], notes: {},
    async flush() { await Promise.allSettled(pending); },
  };
  page.on("request", request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) result.documents.push(request.url());
    if (paths.has(new URL(request.url()).pathname)) result.requests.push({ url: request.url(), resourceType: request.resourceType() });
  });
  page.on("requestfailed", request => {
    if (paths.has(new URL(request.url()).pathname)) result.failed.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText });
  });
  page.on("response", response => {
    if (!paths.has(new URL(response.url()).pathname)) return;
    pending.push((async () => {
      const row: ModuleRow = { url: response.url(), resourceType: response.request().resourceType(), status: response.status(), mime: response.headers()["content-type"] };
      try { const bytes = await response.body(); row.bytes = bytes.length; row.sha256 = hash(bytes); }
      catch (error) { row.error = String(error); }
      result.responses.push(row);
    })());
  });
  page.on("pageerror", error => result.pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  return result;
}
function scriptRequests(observation: Observation, asset: ProductionAsset) {
  return observation.requests.filter(row => row.resourceType === "script" && new URL(row.url).pathname === asset.path);
}
function validModuleResponse(observation: Observation, asset: ProductionAsset) {
  return observation.responses.find(row => row.resourceType === "script" && new URL(row.url).pathname === asset.path && row.status === 200 && /(?:java|ecma)script/i.test(row.mime ?? "") && row.bytes === asset.bytes && row.sha256 === asset.sha256);
}
async function detail(page: Page, id: number) {
  await expect(page.getByRole("heading", { name: names[id], exact: true }).first()).toBeVisible();
}
async function customers(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByTestId("mobile-nav").getByRole("button", { name: "내 고객", exact: true }).click();
  else await page.getByRole("button", { name: "고객 관리", exact: true }).first().click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.locator("#main-content")).toBeVisible();
}
async function home(page: Page) {
  const recoveryHome = page.getByRole("button", { name: "홈으로 이동", exact: true });
  if (await recoveryHome.isVisible()) await recoveryHome.click();
  else if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByTestId("mobile-nav").getByRole("button", { name: "오늘 업무", exact: true }).click();
  else await page.getByRole("button", { name: "오늘 업무", exact: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("dashboard-action-cockpit")).toBeVisible();
}
async function customerFromList(page: Page, id: number) {
  const cards = page.getByRole("button", { name: "카드 보기", exact: true });
  if (await cards.isVisible()) await cards.click();
  const card = page.getByTestId("customer-list-result-card").filter({ hasText: names[id] });
  await expect(card).toBeVisible();
  await card.getByTestId("customer-list-result-card-detail").click();
  await detail(page, id);
}

test.beforeEach(async ({ page, production }) => {
  if ((page.viewportSize()?.width ?? 1440) < 768) await page.setViewportSize({ width: 390, height: 844 });
  const observation = watch(page, production);
  observations.set(page, observation); serverStart.set(page, production.requests().length);
  await mockBoaTrpc(page, "branch_admin", {
    transformResponse(procedure, response: any, input: any) {
      if (procedure === "customers.get") {
        const customer: Record<string, unknown> = SuperJSON.deserialize(response.result.data);
        return envelope({ ...customer, id: input.id, name: names[input.id], consultStatus: "미상담" });
      }
      if (procedure === "customers.list") {
        const rows: Record<string, unknown>[] = SuperJSON.deserialize(response.result.data);
        return envelope([101, 102].map(id => ({ ...rows[0], id, name: names[id] })));
      }
      return response;
    },
  });
});

test.afterEach(async ({ page, production }, info) => {
  const observation = observations.get(page)!;
  await observation.flush();
  const final = await page.evaluate(() => ({ url: location.href, timeOrigin: performance.timeOrigin, headings: [...document.querySelectorAll("h1,h2")].map(e => e.textContent?.trim()) })).catch(error => ({ error: String(error) }));
  await info.attach("production-module-network-and-document", {
    contentType: "application/json",
    body: JSON.stringify({ production: { origin: production.origin, root: production.root, assets: production.assets }, viewport: page.viewportSize(), ...observation, final, serverRequests: production.requests().slice(serverStart.get(page)) }, null, 2),
  });
  await info.attach("production-recovery-screen", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  expect(observation.requests.every(row => new URL(row.url).origin === production.origin)).toBe(true);
});

test("AG08 production cold route split and real customer SPA history", async ({ page, production }) => {
  const observation = observations.get(page)!;
  await page.goto("/");
  await expect(page.getByTestId("dashboard-action-cockpit")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(scriptRequests(observation, production.assets.customerDetail)).toHaveLength(0);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await customers(page); await customerFromList(page, 101);
  await customers(page); await customerFromList(page, 102);
  await page.goBack(); await expect(page).toHaveURL(/\/customers$/);
  await page.goBack(); await detail(page, 101);
  await page.goForward(); await expect(page).toHaveURL(/\/customers$/);
  await page.goForward(); await detail(page, 102);
  await home(page);
  await observation.flush();
  expect(scriptRequests(observation, production.assets.customerDetail)).toHaveLength(1);
  expect(validModuleResponse(observation, production.assets.customerDetail)).toBeTruthy();
  expect(observation.documents).toHaveLength(1);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  expect(observation.pageErrors).toEqual([]);
});

test("AG08 production slow CustomerDetail chunk completes without duplicate import", async ({ page, production }) => {
  const observation = observations.get(page)!;
  let release: (() => void) | undefined;
  await page.route("**/assets/CustomerDetail-*.js*", async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.continue();
  });
  try {
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    await expect.poll(() => Boolean(release)).toBe(true);
    await expect(page.getByRole("status").first()).toBeVisible();
    observation.notes.slowLoading = {
      mainCount: await page.locator("#main-content").count(),
      navigationCount: await page.getByRole("navigation").count(),
      visibleNavigationCount: await page.getByRole("navigation").evaluateAll(nodes => nodes.filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).length),
    };
    await expect(page.locator("#main-content")).toBeVisible();
    expect((observation.notes.slowLoading as { visibleNavigationCount: number }).visibleNavigationCount).toBeGreaterThan(0);
    await test.info().attach("slow-loading-navigation", { body: await page.screenshot(), contentType: "image/png" });
    release!(); await detail(page, 101);
    await observation.flush();
    expect(scriptRequests(observation, production.assets.customerDetail)).toHaveLength(1);
    expect(validModuleResponse(observation, production.assets.customerDetail)).toBeTruthy();
    expect(observation.pageErrors).toEqual([]);
  } finally { release?.(); await page.unroute("**/assets/CustomerDetail-*.js*"); }
});

test("AG08 production pending chunk navigation remains current after late success", async ({ page, production }) => {
  const observation = observations.get(page)!;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/assets/CustomerDetail-*.js*", async route => { await gate; await route.continue(); });
  try {
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    await expect.poll(() => scriptRequests(observation, production.assets.customerDetail).length).toBe(1);
    await expect(page.getByRole("status").first()).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
    expect(await page.getByRole("navigation").count()).toBeGreaterThan(0);
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    await test.info().attach("pending-chunk-with-operable-navigation", { body: await page.screenshot(), contentType: "image/png" });
    await home(page);
    release();
    await expect.poll(() => Boolean(validModuleResponse(observation, production.assets.customerDetail))).toBe(true);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("dashboard-action-cockpit")).toBeVisible();
    await expect(page.getByRole("heading", { name: names[101], exact: true })).toHaveCount(0);
    observation.notes.pendingNavigation = { timeOrigin, documents: observation.documents.length, scriptRequests: scriptRequests(observation, production.assets.customerDetail).length, currentPath: new URL(page.url()).pathname };
    await customers(page); await customerFromList(page, 101);
    expect(scriptRequests(observation, production.assets.customerDetail)).toHaveLength(1);
    expect(observation.documents).toHaveLength(1);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    expect(observation.pageErrors).toEqual([]);
  } finally { release(); await page.unroute("**/assets/CustomerDetail-*.js*"); }
});

for (const fault of ["abort", "404", "410", "html"] as const) {
  test("AG08 production " + fault + " uses real retry script and same document recovery", async ({ page, production }) => {
    const observation = observations.get(page)!;
    let restored = false;
    const injected: Record<string, unknown>[] = [];
    await page.route("**/assets/CustomerDetail-*.js*", async route => {
      if (restored) return route.continue();
      const body = fault === "html" ? "<!DOCTYPE html><html>synthetic stale module fallback</html>" : "module unavailable";
      injected.push({ url: route.request().url(), resourceType: route.request().resourceType(), fault, status: fault === "abort" ? null : fault === "html" ? 200 : Number(fault), sha256: fault === "abort" ? null : hash(Buffer.from(body)) });
      if (fault === "abort") return route.abort("failed");
      return route.fulfill({ status: fault === "html" ? 200 : Number(fault), contentType: fault === "html" ? "text/html" : "text/javascript", body });
    });
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    const error = page.getByRole("heading", { name: "문제가 발생했습니다.", exact: true });
    await expect(error).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
    expect(await page.getByRole("navigation").count()).toBeGreaterThan(0);
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    expect(scriptRequests(observation, production.assets.customerDetail)).toHaveLength(1);
    if (fault !== "abort") await expect(page.getByRole("button", { name: "페이지 새로고침", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect.poll(() => scriptRequests(observation, production.assets.customerDetail).length).toBe(2);
    await expect(error).toBeVisible();
    restored = true;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await detail(page, 101);
    await observation.flush();
    const scripts = scriptRequests(observation, production.assets.customerDetail);
    expect(scripts).toHaveLength(3);
    expect(new Set(scripts.map(row => row.url)).size).toBe(3);
    expect(scripts.slice(1).every(row => new URL(row.url).searchParams.has("customer-detail-retry"))).toBe(true);
    expect(validModuleResponse(observation, production.assets.customerDetail)).toBeTruthy();
    expect(observation.documents).toHaveLength(1);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    observation.notes.sameDocumentRecovery = { timeOrigin, documents: observation.documents.length, scriptRequests: scripts.length };
    observation.notes.injected = injected;
    await home(page); await customers(page); await customerFromList(page, 102);
    await page.goBack(); await expect(page).toHaveURL(/\/customers$/);
    await page.goBack(); await expect(page).toHaveURL(/\/$/);
    await page.goForward(); await expect(page).toHaveURL(/\/customers$/);
    await page.goForward(); await detail(page, 102);
    expect(scriptRequests(observation, production.assets.customerDetail)).toHaveLength(3);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    await page.reload(); await detail(page, 102);
    expect(observation.documents).toHaveLength(2);
    expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(timeOrigin);
    observation.notes.explicitReloadAfterRecovery = { documents: observation.documents.length, timeOrigin: await page.evaluate(() => performance.timeOrigin), distinction: "Same build reloaded only after same-document recovery was already proven" };
    expect(observation.consoleErrors.some(message => message.includes("[ErrorBoundary]") || message.includes("createContext"))).toBe(false);
  });
}

test("AG08 production repeated failure is bounded and fast retry does not duplicate imports", async ({ page, production }) => {
  const observation = observations.get(page)!;
  await page.route("**/assets/CustomerDetail-*.js*", route => route.abort("failed"));
  await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
  const error = page.getByRole("heading", { name: "문제가 발생했습니다.", exact: true });
  await expect(error).toBeVisible();
  await page.getByRole("button", { name: "다시 시도", exact: true }).dblclick({ delay: 0 });
  await expect.poll(() => scriptRequests(observation, production.assets.customerDetail).length).toBe(2);
  await expect(error).toBeVisible();
  for (const count of [3, 4]) {
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect.poll(() => scriptRequests(observation, production.assets.customerDetail).length).toBe(count);
    await expect(error).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "페이지 새로고침", exact: true })).toBeVisible();
  await home(page); await customers(page); await customerFromListError(page, 101);
  expect(scriptRequests(observation, production.assets.customerDetail)).toHaveLength(4);
  expect(new Set(scriptRequests(observation, production.assets.customerDetail).map(row => row.url)).size).toBe(4);
  expect(observation.documents).toHaveLength(1);
});
async function customerFromListError(page: Page, id: number) {
  const cards = page.getByRole("button", { name: "카드 보기", exact: true });
  if (await cards.isVisible()) await cards.click();
  await page.getByTestId("customer-list-result-card").filter({ hasText: names[id] }).getByTestId("customer-list-result-card-detail").click();
  await expect(page.getByRole("heading", { name: "문제가 발생했습니다.", exact: true })).toBeVisible();
}

test("AG08 production preserves AG07 More Sheet real chunk retry and focus return", async ({ page, production }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const observation = observations.get(page)!;
  let restored = false;
  await page.route("**/assets/MobileMoreSheet-*.js*", route => restored ? route.continue() : route.abort("failed"));
  await page.goto("/");
  await expect(page.getByTestId("dashboard-action-cockpit")).toBeVisible();
  const more = page.getByTestId("mobile-nav").getByRole("button", { name: "더보기", exact: true });
  await more.click();
  await expect(page.getByRole("alert")).toContainText("더보기 메뉴를 불러오지 못했습니다.");
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  restored = true;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await observation.flush();
  expect(scriptRequests(observation, production.assets.moreSheet)).toHaveLength(2);
  expect(validModuleResponse(observation, production.assets.moreSheet)).toBeTruthy();
  expect(observation.documents).toHaveLength(1);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  expect(observation.pageErrors).toEqual([]);
});
