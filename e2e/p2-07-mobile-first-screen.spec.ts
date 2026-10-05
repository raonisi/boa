import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const sizes = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 320, height: 740 },
  { width: 1440, height: 900 },
];
const evidenceDir = process.env.P207_EVIDENCE_DIR;
async function rect(locator: Locator) {
  return (await locator.count()) ? locator.first().boundingBox() : null;
}
async function prepare(
  page: Page,
  path: string,
  width = 390,
  height = 844,
  role:
    | "branch_admin"
    | "sub_branch_admin"
    | "team_leader"
    | "member" = "branch_admin"
) {
  await page.setViewportSize({ width, height });
  await mockBoaTrpc(page, role);
  await page.goto(path);
  await expect(page.locator("#main-content")).toBeVisible();
  if (path === "/customers")
    await expect(
      page.getByTestId("customer-list-result-card").first()
    ).toBeVisible();
  else if (path.startsWith("/customers/"))
    await expect(
      page.locator("h1").filter({ hasText: "[E2E] Customer Alpha" })
    ).toBeVisible();
  else
    await expect(
      page.getByTestId("notifications-mobile-notification-card").first()
    ).toBeVisible();
}
async function geometry(page: Page, path: string) {
  const viewport = page.viewportSize()!;
  const nav = await rect(page.locator("nav.fixed.bottom-0:visible"));
  const common = {
    viewport,
    scrollY: await page.evaluate(() => window.scrollY),
    bottomNavTop: nav?.y ?? viewport.height,
    documentHeight: await page.evaluate(
      () => document.documentElement.scrollHeight
    ),
  };
  if (path === "/customers") {
    const card = page.getByTestId("customer-list-result-card").first();
    return {
      ...common,
      header: await rect(page.locator('main [data-slot="card"]').first()),
      search: await rect(page.getByLabel("고객 통합 검색")),
      firstCard: await rect(card),
      firstTitle: await rect(
        card.getByTestId("customer-list-result-card-title")
      ),
      nextAction: await rect(card.getByText(/^다음:/)),
      detail: await rect(
        card.getByRole("button", { name: "상세", exact: true })
      ),
      consultation: await rect(
        card.getByRole("button", { name: "상담 기록", exact: true })
      ),
    };
  }
  if (path === "/notifications")
    return {
      ...common,
      firstNotification: await rect(
        page.getByTestId("notifications-mobile-notification-card").first()
      ),
      category: await rect(
        page
          .locator("section")
          .filter({
            has: page.getByRole("heading", { name: "업무 분류", exact: true }),
          })
      ),
      priority: await rect(page.getByTestId("notifications-priority-section")),
    };
  return {
    ...common,
    title: await rect(
      page.getByRole("heading", { name: "[E2E] Customer Alpha", exact: true })
    ),
    primary: await rect(page.locator("p").filter({ hasText: /^지금 할 일 ·/ }).first()),
    summary360: await rect(page.getByTestId("customer-360-summary-card")),
    nextAction: await rect(page.getByTestId("customer-quick-action-hub")),
    executionSummary: await rect(
      page.getByText("상담 실행 요약", { exact: true })
    ),
    firstTabContent: await rect(page.getByRole("tabpanel")),
    bottomQuickAction: await rect(
      page
        .locator("div.fixed.inset-x-0")
        .filter({
          has: page.getByRole("button", { name: "상담", exact: true }),
        })
        .first()
    ),
    duplicateHeadings: await page
      .getByText(/^(지금 할 일|다음 행동|상담 실행 요약)$/)
      .allTextContents(),
  };
}
for (const size of sizes)
  for (const path of ["/customers", "/customers/101", "/notifications"]) {
    test(
      "geometry capture " + path + " " + size.width,
      async ({ page }, info) => {
        await prepare(page, path, size.width, size.height);
        const data = await geometry(page, path);
        expect(data.scrollY).toBe(0);
        await info.attach("geometry", {
          body: JSON.stringify(data, null, 2),
          contentType: "application/json",
        });
        if (evidenceDir) {
          await mkdir(evidenceDir, { recursive: true });
          const slug =
            (process.env.P207_PHASE ?? "POST") +
            "-" +
            path.replaceAll("/", "_") +
            "-" +
            size.width +
            "-" +
            info.project.name;
          await writeFile(
            join(evidenceDir, slug + ".json"),
            JSON.stringify(data, null, 2)
          );
          await page.screenshot({
            path: join(evidenceDir, slug + ".png"),
            fullPage: false,
          });
        }
      }
    );
  }

async function aboveNav(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const nav = await rect(page.locator("nav.fixed.bottom-0:visible"));
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    nav?.y ?? page.viewportSize()!.height
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBe(0);
}
test("P207-01 390 first customer name and next action visible", async ({
  page,
}) => {
  await prepare(page, "/customers");
  const card = page.getByTestId("customer-list-result-card").first();
  await aboveNav(page, card.getByTestId("customer-list-result-card-title"));
  await aboveNav(page, card.getByText(/^다음:/));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
test("P207-02 390 primary action is above bottom navigation", async ({
  page,
}) => {
  await prepare(page, "/customers");
  const button = page.getByTestId("customer-list-result-card-detail").first();
  await aboveNav(page, button);
  expect(
    await button.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      );
    })
  ).toBe(true);
});
test("P207-03 320 first customer body enters initial viewport", async ({
  page,
}) => {
  await prepare(page, "/customers", 320, 740);
  const card = page.getByTestId("customer-list-result-card").first();
  await aboveNav(page, card.getByTestId("customer-list-result-card-title"));
  await aboveNav(page, card.getByText(/^다음:/));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
test("P207-04 secondary management Sheet supports keyboard and focus trap", async ({
  page,
}) => {
  await prepare(page, "/customers");
  const trigger = page.getByRole("button", {
    name: "고객 관리 작업",
    exact: true,
    includeHidden: true,
  });
  await trigger.focus();
  await trigger.press("Enter");
  const sheet = page.getByRole("dialog", {
    name: "고객 관리 작업",
    exact: true,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  for (const name of [
    "파이프라인",
    "DB 배정",
    "엑셀 일괄 등록",
    "빠른 후속 등록",
  ])
    await expect(
      sheet.getByRole("button", { name, exact: true })
    ).toBeVisible();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate(el => el.contains(document.activeElement))
    ).toBe(true);
  }
  expect(
    await page.evaluate(() => {
      const e = document.activeElement!;
      const s = getComputedStyle(e);
      return s.boxShadow !== "none" || s.outlineStyle !== "none";
    })
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press("Space");
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
});
test("P207-05 search segment quick presets sort and advanced filters preserve URL inputs", async ({
  page,
}) => {
  const { setupCountFixture } = await import("./fixtures/customer-list-counts");
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setupCountFixture(page);
  await page.goto("/customers?segment=all");
  await page.getByLabel("고객 통합 검색").fill("고객001");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect
    .poll(
      () =>
        state.requests.filter(r => r.procedure === "customers.list").at(-1)
          ?.input.search
    )
    .toBe("고객001");
  await page.getByLabel("검색어 지우기").click();
  await page.getByRole("tab", { name: /DB 배분 고객/ }).click();
  await expect(page).toHaveURL(/segment=database/);
  await page.getByLabel("고객 정렬", { exact: true }).click();
  await page.getByRole("option", { name: "고객명순", exact: true }).click();
  await expect(page).toHaveURL(/sort=name/);
  await page
    .getByTestId("customer-list-mobile-filter-chip")
    .filter({ hasText: "미상담" })
    .click();
  await expect
    .poll(
      () =>
        state.requests.filter(r => r.procedure === "customers.list").at(-1)
          ?.input.workflowFilter
    )
    .toBe("uncontacted");
  await page.getByLabel("고급 필터", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "고급 필터", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
});
test("P207-06 secondary actions preserve all four role gates", async ({
  page,
}) => {
  for (const role of [
    "branch_admin",
    "sub_branch_admin",
    "team_leader",
    "member",
  ] as const) {
    await page.unrouteAll();
    await prepare(page, "/customers", 390, 844, role);
    await page
      .getByRole("button", { name: "고객 관리 작업", exact: true })
      .click();
    const sheet = page.getByRole("dialog", {
      name: "고객 관리 작업",
      exact: true,
    });
    await expect(
      sheet.getByRole("button", { name: "DB 배정", exact: true })
    ).toHaveCount(role === "branch_admin" ? 1 : 0);
    await expect(
      sheet.getByRole("button", { name: "엑셀 일괄 등록", exact: true })
    ).toHaveCount(role === "branch_admin" ? 1 : 0);
    await expect(
      sheet.getByRole("button", { name: "파이프라인", exact: true })
    ).toBeVisible();
    await expect(
      sheet.getByRole("button", { name: "빠른 후속 등록", exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  }
});
test("P207-07 CustomerList has no horizontal overflow at 390 320 1440", async ({
  page,
}) => {
  for (const s of sizes) {
    await page.unrouteAll();
    await prepare(page, "/customers", s.width, s.height);
    await noOverflow(page);
  }
});
test("P207-08 detail name primary next action and core context stay visible", async ({
  page,
}) => {
  for (const s of sizes.filter(s => s.width < 768)) {
    await page.unrouteAll();
    await prepare(page, "/customers/101", s.width, s.height);
    await aboveNav(
      page,
      page.getByRole("heading", { name: "[E2E] Customer Alpha", exact: true })
    );
    await aboveNav(
      page,
      page
        .locator("p")
        .filter({ hasText: /^지금 할 일 ·/ })
        .first()
    );
    await expect(page.getByText(/담당 ·/)).toBeVisible();
    await expect(page.getByText(/최근 상담 ·/)).toBeVisible();
    await expect(page.getByText(/다음 연락 ·/)).toBeVisible();
  }
});
test("P207-09 mobile duplicate next action headings are reduced", async ({
  page,
}) => {
  await prepare(page, "/customers/101");
  await expect(page.getByText("상담 실행 요약", { exact: true })).toBeHidden();
  await expect(page.getByText("지금 할 일", { exact: true })).toBeHidden();
  await expect(page.getByText("다음 행동", { exact: true })).toHaveCount(2);
  const tab = await page
    .getByRole("tab", { name: "요약", exact: true })
    .boundingBox();
  const secondary = await page
    .getByTestId("customer-360-summary-card")
    .boundingBox();
  expect(tab!.y).toBeLessThan(secondary!.y);
});
test("P207-10 secondary summary expands and collapses with core info retained", async ({
  page,
}) => {
  await prepare(page, "/customers/101");
  const trigger = page.getByRole("button", {
    name: "상담 실행 정보",
    exact: true,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.focus();
  await trigger.press("Space");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("상담 실행 요약", { exact: true })).toBeVisible();
  await expect(page.getByText("지금 할 일", { exact: true })).toBeVisible();
  await trigger.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("상담 실행 요약", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "[E2E] Customer Alpha", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "상담", exact: true })
  ).toBeVisible();
});
test("P207-11 bottom quick action bar remains usable above navigation", async ({
  page,
}) => {
  for (const s of sizes.filter(s => s.width < 768)) {
    await page.unrouteAll();
    await prepare(page, "/customers/101", s.width, s.height);
    const b = page.getByRole("button", { name: "상담", exact: true });
    await aboveNav(page, b);
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await b.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        );
      })
    ).toBe(true);
  }
});
test("P207-12 detail query tab and action deep link keep original semantics", async ({
  page,
}) => {
  await prepare(page, "/customers/101?tab=contracts&action=consult");
  const dialog = page.getByRole("dialog", {
    name: "상담기록 추가",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: /계약/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await page.getByRole("tab", { name: /상담·후속관리/ }).click();
  await expect(page).toHaveURL(/tab=consultation/);
  await expect(dialog).toBeHidden();
});
test("P207-13 detail desktop rich summary and task tabs preserved", async ({
  page,
}) => {
  await prepare(page, "/customers/101", 1440, 900);
  await expect(page.getByText("상담 실행 요약", { exact: true })).toBeVisible();
  await expect(page.getByText("지금 할 일", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "상담 실행 정보", exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "상담 기록", exact: true })
  ).toBeVisible();
});
test("P207-14 390 first notification title visible on initial viewport", async ({
  page,
}) => {
  await prepare(page, "/notifications");
  const card = page
    .getByTestId("notifications-mobile-notification-card")
    .first();
  await aboveNav(
    page,
    card.getByText("[E2E] Today notification", { exact: true })
  );
  expect((await card.boundingBox())!.y).toBeLessThan(844 / 2);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
test("P207-15 320 first notification enters top half of viewport", async ({
  page,
}) => {
  await prepare(page, "/notifications", 320, 740);
  const card = page
    .getByTestId("notifications-mobile-notification-card")
    .first();
  expect((await card.boundingBox())!.y).toBeLessThan(740 / 2);
  await aboveNav(
    page,
    card.getByText("[E2E] Today notification", { exact: true })
  );
});
test("P207-16 mobile Sheet retains every notification filter and keyboard trap", async ({
  page,
}) => {
  await prepare(page, "/notifications", 320, 740);
  const trigger = page.getByRole("button", { name: /알림 필터/ });
  await trigger.focus();
  await trigger.press("Enter");
  const sheet = page.getByRole("dialog", { name: "알림 필터", exact: true });
  for (const name of [
    "알림 업무 분류",
    "알림 우선순위",
    "업무 처리 필요 여부",
    "알림 기록 상태",
    "알림 읽음 상태",
    "알림 유형",
  ])
    await expect(
      sheet.getByRole("combobox", { name, exact: true })
    ).toBeVisible();
  for (const name of ["알림 조회 시작일", "알림 조회 종료일"])
    await expect(sheet.getByLabel(name, { exact: true })).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "전체 초기화", exact: true })
  ).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate(el => el.contains(document.activeElement))
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
test("P207-17 category priority active chips clear and URL input semantics", async ({
  page,
}) => {
  await prepare(page, "/notifications");
  await page.getByRole("button", { name: /알림 필터/ }).click();
  const sheet = page.getByRole("dialog", { name: "알림 필터", exact: true });
  await sheet.getByLabel("알림 업무 분류", { exact: true }).click();
  await page.getByRole("option", { name: "일정", exact: true }).click();
  await sheet.getByLabel("알림 우선순위", { exact: true }).click();
  await page.getByRole("option", { name: "오늘 처리", exact: true }).click();
  await sheet.getByRole("button", { name: "결과 보기", exact: true }).click();
  await expect(page).toHaveURL(/category=schedule/);
  await expect(page).toHaveURL(/priority=today/);
  await expect(
    page.getByRole("button", { name: "분류: 일정 필터 해제", exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "분류: 일정 필터 해제", exact: true })
    .click();
  await expect(page).not.toHaveURL(/category=schedule/);
  await page.getByRole("button", { name: /알림 필터/ }).click();
  await sheet.getByRole("button", { name: "전체 초기화", exact: true }).click();
  await sheet.getByRole("button", { name: "결과 보기", exact: true }).click();
  await expect(page).not.toHaveURL(/priority=today/);
});
test("P207-18 notification selection mark read complete and navigation retained", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", r => {
    if (r.method() === "POST" && r.url().includes("/api/trpc/"))
      posts.push(r.url());
  });
  await prepare(page, "/notifications");
  const card = page
    .getByTestId("notifications-mobile-notification-card")
    .first();
  await card.getByRole("checkbox").check();
  await expect(page.getByTestId("bulk-mark-read")).toBeEnabled();
  await expect(page.getByTestId("bulk-complete")).toBeEnabled();
  await card
    .getByRole("button", { name: /일정 보기|업무 보기|일정 확인/ })
    .click();
  await expect(page).toHaveURL(/\/calendar/);
  await expect
    .poll(() => posts.filter(x => x.includes("notifications.markRead")).length)
    .toBe(1);
});
test("P207-19 detail and notifications have no horizontal overflow", async ({
  page,
}) => {
  for (const path of ["/customers/101", "/notifications"])
    for (const s of sizes) {
      await page.unrouteAll();
      await prepare(page, path, s.width, s.height);
      await noOverflow(page);
    }
});
test("P207-20 targeted axe on modified mobile hierarchy and Sheets", async ({
  page,
}) => {
  for (const [path, selector] of [
    ["/customers", '#main-content > div > [data-slot="card"]:first-child'],
    ["/customers/101", '[data-testid="customer-detail-mobile-tabs"]'],
    ["/notifications", '[data-testid="notifications-priority-section"]'],
  ]) {
    await page.unrouteAll();
    await prepare(page, path);
    const result = await new AxeBuilder({ page })
      .include(selector)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  for (const [path, name] of [
    ["/customers", "고객 관리 작업"],
    ["/notifications", "알림 필터"],
  ]) {
    await page.unrouteAll();
    await prepare(page, path);
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const result = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.keyboard.press("Escape");
  }
});
test("P207-21 read only geometry smoke performs zero mutations", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", r => {
    if (r.method() === "POST" && r.url().includes("/api/trpc/"))
      posts.push(r.url());
  });
  for (const path of ["/customers", "/customers/101", "/notifications"]) {
    await page.unrouteAll();
    await prepare(page, path);
    await geometry(page, path);
    await noOverflow(page);
  }
  expect(posts).toEqual([]);
});


async function clearance(target: Locator, blocker: Locator) {
  const targetRect = await target.boundingBox();
  const tabListRect = await target.evaluate(el => {
    const list = el.closest('[data-testid="customer-detail-mobile-tabs"]');
    const r = list?.getBoundingClientRect();
    return r ? { y: r.y, bottom: r.bottom, height: r.height } : null;
  });
  const blockerRect = await rect(blocker);
  const hits = await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    return [0.5, 0.98].map(fraction => {
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height * fraction);
      return { fraction, target: !!hit && el.contains(hit), blocker: hit?.closest("nav")?.getAttribute("aria-label") ?? hit?.tagName };
    });
  });
  return { target: targetRect!, tabList: tabListRect, blocker: blockerRect, clearance: blockerRect ? blockerRect.y - targetRect!.y - targetRect!.height : null, hits };
}
async function fixGeometry(page: Page, path: string) {
  const nav = page.locator("nav.fixed.bottom-0:visible");
  if (path === "/customers") return clearance(page.getByTestId("customer-list-result-card-detail").first(), nav);
  if (path === "/notifications") return clearance(
    page.getByTestId("notifications-mobile-notification-card").first().getByRole("button", { name: /일정 보기|업무 보기|일정 확인/ }), nav);
  return clearance(page.getByRole("tab", { name: "요약", exact: true }),
    page.locator("div.fixed.inset-x-0").filter({ has: page.getByRole("button", { name: "상담", exact: true }) }));
}
async function recordEvidence(name: string, data: unknown) {
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(join(evidenceDir, (process.env.P207_PHASE ?? "NEW") + "-" + name + ".json"), JSON.stringify(data, null, 2));
  }
}
async function focusTraversal(page: Page) {
  const sequence: Array<{ label: string; y: number; documentY: number; domIndex: number; task: boolean; secondary: boolean; fixed: boolean }> = [];
  await page.getByRole("button", { name: "목록", exact: true }).focus();
  for (let step = 0; step < 60; step++) {
    const entry = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const r = el.getBoundingClientRect();
      const all = [...document.querySelectorAll("*")];
      const label = el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName;
      let fixed = false;
      for (let p: Element | null = el; p; p = p.parentElement) if (getComputedStyle(p).position === "fixed") fixed = true;
      return { label, y: r.y, documentY: r.y + scrollY, domIndex: all.indexOf(el),
        task: !!el.closest('[data-testid="customer-detail-mobile-tabs"]'),
        secondary: label === "상담 실행 정보" || label === "빠른 일정 등록" || !!el.closest('[data-testid="customer-360-summary-card"],[data-testid="customer-quick-action-hub"]'), fixed };
    });
    sequence.push(entry);
    if (sequence.length > 1 && entry.fixed && entry.label === "상담") break;
    await page.keyboard.press("Tab");
  }
  return sequence;
}
for (const size of sizes) {
  for (const path of ["/customers", "/customers/101", "/notifications"]) {
    test("fix evidence " + path + " " + size.width, async ({ page }) => {
      await prepare(page, path, size.width, size.height);
      await recordEvidence("clearance-" + path.replaceAll("/", "_") + "-" + size.width, await fixGeometry(page, path));
    });
    if (size.width < 768) test("P207-F clearance " + path + " " + size.width, async ({ page }) => {
      await prepare(page, path, size.width, size.height);
      const measurement = await fixGeometry(page, path);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(measurement.clearance).toBeGreaterThanOrEqual(8);
      if (measurement.tabList) expect(measurement.blocker!.y - measurement.tabList.bottom).toBeGreaterThanOrEqual(8);
      expect(measurement.target.height).toBeGreaterThanOrEqual(44);
      expect(measurement.target.width).toBeGreaterThanOrEqual(44);
      expect(measurement.hits.every(hit => hit.target)).toBe(true);
      await noOverflow(page);
    });
  }
}
for (const width of [390, 360]) {
  test("fix keyboard evidence " + width, async ({ page }) => {
    await prepare(page, "/customers/101", width, width === 390 ? 844 : 800);
    await recordEvidence("focus-" + width, await focusTraversal(page));
  });
  test("P207-F keyboard order and arrow URL history " + width, async ({ page }) => {
    await prepare(page, "/customers/101", width, width === 390 ? 844 : 800);
    const sequence = await focusTraversal(page);
    const taskIndex = sequence.findIndex(entry => entry.task);
    const secondary = sequence.map((entry, index) => ({ ...entry, index })).filter(entry => entry.secondary);
    expect(taskIndex).toBeGreaterThanOrEqual(0);
    expect(secondary.length).toBeGreaterThan(0);
    for (const entry of secondary) expect(entry.index).toBeGreaterThan(taskIndex);
    const flow = sequence.filter(entry => !entry.fixed);
    expect(flow.filter((entry, i) => i > 0 && flow[i - 1].documentY - entry.documentY > 100)).toEqual([]);
    const summary = page.getByRole("tab", { name: "요약", exact: true });
    await summary.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /상담·후속관리/ })).toBeFocused();
    await expect(page).toHaveURL(/tab=consultation/);
    await page.keyboard.press("ArrowLeft");
    await expect(summary).toBeFocused();
    await expect(summary).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /계약/ }).click();
    await expect(page).toHaveURL(/tab=contracts/);
    await page.goBack();
    await expect(summary).toHaveAttribute("aria-selected", "true");
    await page.goForward();
    await expect(page.getByRole("tab", { name: /계약/ })).toHaveAttribute("aria-selected", "true");
  });
}

for (const path of ["/customers", "/customers/101", "/notifications"]) {
  test("P207-F desktop action hit-test " + path, async ({ page }) => {
    await prepare(page, path, 1440, 900);
    const target = path === "/customers"
      ? page.getByTestId("customer-list-result-card-detail").first()
      : path === "/customers/101"
        ? page.getByRole("tab", { name: "요약", exact: true })
        : page.getByTestId("notifications-mobile-notification-card").first().getByRole("button", { name: /일정 보기|업무 보기|일정 확인/ });
    await target.scrollIntoViewIfNeeded();
    const data = await fixGeometry(page, path);
    expect(data.blocker).toBeNull();
    expect(data.hits.every(hit => hit.target)).toBe(true);
    await recordEvidence("desktop-hit-" + path.replaceAll("/", "_"), data);
  });
}


test("P207-22 desktop sticky actions remain reachable through deep scroll", async ({
  page,
}, info) => {
  await prepare(page, "/customers/101", 1440, 900);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const card = page.locator('[data-slot="card"]').filter({
    has: page.getByRole("button", { name: "퀵 상담", exact: true }),
  });
  await expect(card).toHaveCount(1);
  await expect(page.locator("header:visible")).toHaveCount(1);
  const controls = card.locator("button, a[href]");
  await expect(controls).toHaveCount(7);
  const labels = [
    "전화하기", "상담 기록", "후속 등록", "일정 등록",
    "계약 등록", "퀵 상담", "메시지 문구",
  ];
  for (const scrollY of [1400, 1600, 1750, 1900]) {
    await page.evaluate(async y => {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    }, scrollY);
    const data = await card.evaluate(el => {
      const rect = (node: Element) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
      };
      const header = document.querySelector("header")!;
      const style = getComputedStyle(el);
      return {
        scrollY: window.scrollY,
        viewport: { width: innerWidth, height: innerHeight },
        header: rect(header),
        card: rect(el),
        position: style.position,
        stickyTop: parseFloat(style.top),
        controls: [...el.querySelectorAll("button, a[href]")].map(control => {
          const r = control.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { label: control.textContent?.trim(), rect: rect(control), centerHit: !!hit && control.contains(hit) };
        }),
      };
    });
    await info.attach("desktop sticky " + scrollY, {
      body: JSON.stringify(data, null, 2),
      contentType: "application/json",
    });
    await recordEvidence("sticky-" + info.project.name + "-" + scrollY, data);
    expect(data.scrollY).toBe(scrollY);
    expect(data.position).toBe("sticky");
    expect(Number.isFinite(data.stickyTop)).toBe(true);
    expect(data.stickyTop).toBeGreaterThanOrEqual(data.header.bottom);
    expect(data.stickyTop - data.header.bottom).toBeLessThanOrEqual(data.header.height / 4);
    expect(data.card.y).toBeGreaterThanOrEqual(data.header.bottom);
    expect(data.card.bottom).toBeLessThanOrEqual(data.viewport.height);
    if (scrollY >= 1600)
      expect(Math.abs(data.card.y - data.stickyTop)).toBeLessThanOrEqual(1);
    expect(data.controls.map(control => control.label)).toEqual(labels);
    for (const [index, control] of data.controls.entries()) {
      await expect(controls.nth(index)).toBeVisible();
      await expect(controls.nth(index)).toBeEnabled();
      expect(control.rect.width).toBeGreaterThanOrEqual(44);
      expect(control.rect.height).toBeGreaterThanOrEqual(44);
      expect(control.rect.x).toBeGreaterThanOrEqual(0);
      expect(control.rect.right).toBeLessThanOrEqual(data.viewport.width);
      expect(control.rect.y).toBeGreaterThanOrEqual(data.header.bottom);
      expect(control.rect.bottom).toBeLessThanOrEqual(data.viewport.height);
      expect(control.centerHit).toBe(true);
    }
  }
});
