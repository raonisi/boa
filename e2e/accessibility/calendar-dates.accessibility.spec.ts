import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { mockBoaTrpc } from "../fixtures/mock-trpc";
import { writeFile } from "node:fs/promises";

const MONTHS = [
  {
    now: "2026-09-07T03:00:00.000Z",
    title: "2026년 9월",
    outside: ["2026년 8월 30일", "2026년 8월 31일", "2026년 10월 1일"],
  },
  {
    now: "2027-01-07T03:00:00.000Z",
    title: "2027년 1월",
    outside: ["2026년 12월 31일", "2027년 2월 1일"],
  },
  {
    now: "2028-03-07T03:00:00.000Z",
    title: "2028년 3월",
    outside: ["2028년 2월 29일", "2028년 4월 1일"],
  },
] as const;

async function assertContrast(
  page: Page,
  targets: Locator,
  name: string,
  info: TestInfo
) {
  await targets.first().scrollIntoViewIfNeeded();
  await page.evaluate(async () => document.fonts.ready);
  await page.locator("[data-calendar-contrast-check]").evaluateAll(elements => {
    for (const element of elements)
      element.removeAttribute("data-calendar-contrast-check");
  });
  await targets.evaluateAll(elements => {
    for (const element of elements)
      element.setAttribute("data-calendar-contrast-check", "true");
  });
  const result = await new AxeBuilder({ page })
    .include("[data-calendar-contrast-check]")
    .withRules(["color-contrast"])
    .analyze();
  const measurements = [
    ...result.passes,
    ...result.violations,
    ...result.incomplete,
  ].flatMap(rule =>
    rule.nodes.map(node => ({
      target: node.target,
      checks: [...node.any, ...node.all, ...node.none].map(check => ({
        id: check.id,
        data: check.data,
      })),
    }))
  );
  const evidencePath = info.outputPath(`${name}-contrast.json`);
  await writeFile(evidencePath, JSON.stringify(measurements, null, 2));
  await info.attach(`${name}-contrast`, {
    path: evidencePath,
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
  });
  // Date controls have no baseline allowance, even if an old selector hash matches.
  expect(result.violations, name).toEqual([]);
  expect(result.incomplete, `${name}: contrast must be measurable`).toEqual([]);
  expect(
    result.passes.flatMap(rule => rule.nodes).length
  ).toBeGreaterThanOrEqual(await targets.count());
}

test.describe("calendar date contrast (fixed browser dates, synthetic queries)", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    timezoneId: "Asia/Seoul",
  });

  for (const theme of ["light", "dark"] as const) {
    test(`calendar dates remain readable in ${theme}`, async ({
      page,
    }, info) => {
      test.setTimeout(120_000);
      const mobile = (page.viewportSize()?.width ?? 1440) < 768;
      let fixtureNow: string = MONTHS[0].now;
      const writes: string[] = [];
      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
      });
      page.on("request", request => {
        if (
          /\/api\/trpc\/.*(?:create|update|delete|assign)/i.test(request.url())
        )
          writes.push(request.url());
      });
      await page.addInitScript(
        value => localStorage.setItem("theme", value),
        theme
      );
      await mockBoaTrpc(page, "branch_admin", {
        transformResponse(procedure, response) {
          if (procedure !== "schedules.list") return response;
          const payload = structuredClone(response) as {
            result: {
              data: { json: { schedules: Record<string, unknown>[] } };
            };
          };
          payload.result.data.json.schedules =
            payload.result.data.json.schedules.map(schedule => ({
              ...schedule,
              title: "[TEST] Calendar contrast",
              startTime: fixtureNow,
              endTime: new Date(
                new Date(fixtureNow).getTime() + 3_600_000
              ).toISOString(),
            }));
          return payload;
        },
      });
      const openCalendar = async (now: string) => {
        fixtureNow = now;
        await page.clock.setFixedTime(new Date(now));
        await page.goto("/calendar");
        await expect(
          page.getByRole("heading", { name: "일정관리" })
        ).toBeVisible();
        await expect(page.locator("html")).toHaveClass(
          theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/
        );
        await expect(
          page.getByText("[TEST] Calendar contrast", { exact: false }).first()
        ).toBeVisible();
      };

      if (mobile) {
        for (const viewport of [
          { width: 390, height: 844 },
          { width: 320, height: 740 },
          { width: 720, height: 450 },
        ]) {
          // 720x450 exercises the CSS viewport of a 1440x900 window at 200% zoom.
          await page.setViewportSize(viewport);
          await openCalendar(MONTHS[0].now);
          const month = page.getByRole("button", {
            name: "이번달",
            exact: true,
          });
          const today = page.getByRole("button", { name: "오늘", exact: true });
          const week = page.getByRole("button", {
            name: "이번주",
            exact: true,
          });
          await today.focus();
          await page.keyboard.press("Tab");
          await expect(week).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(month).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(
            page.getByTestId("calendar-mobile-agenda-item").first()
          ).toContainText("[TEST] Calendar contrast");
          await assertContrast(
            page,
            today.or(week).or(month),
            `${theme}-${viewport.width}`,
            info
          );
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <= window.innerWidth + 1
            )
          ).toBe(true);
        }
      } else {
        for (const month of MONTHS) {
          await openCalendar(month.now);
          await expect(
            page.getByRole("heading", { name: month.title, exact: true })
          ).toBeVisible();
          for (const date of month.outside) {
            await expect(
              page.getByRole("button", {
                name: `${date}, 현재 달이 아님`,
                exact: true,
              })
            ).toBeVisible();
          }
          await expect(page.locator('button[aria-current="date"]')).toHaveCount(
            1
          );
          await assertContrast(
            page,
            page.locator("button[data-selected]"),
            `${theme}-${month.now.slice(0, 7)}`,
            info
          );
        }
        await openCalendar(MONTHS[0].now);
        const previous = page.getByRole("button", { name: "이전 달 보기" });
        const next = page.getByRole("button", { name: "다음 달 보기" });
        const outside = page.getByRole("button", {
          name: "2026년 8월 30일, 현재 달이 아님",
          exact: true,
        });
        await outside.hover();
        await assertContrast(page, outside, `${theme}-outside-hover`, info);
        await previous.focus();
        await page.keyboard.press("Tab");
        await expect(next).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(outside).toBeFocused();
        expect(
          await outside.evaluate(element => getComputedStyle(element).boxShadow)
        ).not.toBe("none");
        await page.keyboard.press("Enter");
        await expect(
          page.getByRole("heading", { name: "2026년 8월", exact: true })
        ).toBeVisible();
        await expect(page.locator('button[data-selected="true"]')).toHaveText(
          "30"
        );
        await next.click();
        await expect(
          page.getByRole("heading", { name: "2026년 9월", exact: true })
        ).toBeVisible();
        await expect(page.locator('button[data-selected="true"]')).toHaveText(
          "30"
        );
        await assertContrast(
          page,
          page.locator("button[data-selected]"),
          `${theme}-selected-outside`,
          info
        );
      }
      expect(writes).toEqual([]);
    });
  }
});
