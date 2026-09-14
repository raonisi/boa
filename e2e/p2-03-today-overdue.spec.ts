import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import SuperJSON from "superjson";
import { writeFile } from "node:fs/promises";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const now = new Date("2026-09-14T03:00:00Z");
const past = {
  id: 701,
  title: "[P203] 과거 일정 A",
  type: "고객상담",
  status: "예정",
  startTime: new Date("2026-05-21T14:00:00+09:00"),
  endTime: new Date("2026-05-21T15:00:00+09:00"),
  customerId: 101,
};
const today = {
  id: 702,
  title: "[P203] 오늘 일정 B",
  type: "고객상담",
  status: "예정",
  startTime: new Date("2026-09-14T14:00:00+09:00"),
  customerId: 101,
};
const overlap = {
  id: 703,
  title: "[P203] 오늘 미완료 C",
  type: "고객상담",
  status: "예정",
  startTime: new Date("2026-09-14T09:00:00+09:00"),
  endTime: new Date("2026-09-14T10:00:00+09:00"),
  customerId: 101,
};

for (const role of [
  "branch_admin",
  "sub_branch_admin",
  "team_leader",
  "member",
] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    test(`P203 ${role} ${viewport.width}: separate dates/counts, keyboard, layout and actions`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.clock.setFixedTime(now);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const writes: string[] = [];
      page.on("request", request => {
        if (request.method() === "POST" && request.url().includes("/api/trpc/"))
          writes.push(request.url().split("/api/trpc/")[1].split("?")[0]);
      });
      await mockBoaTrpc(page, role, {
        transformResponse: (procedure, response) => {
          if (procedure !== "dashboard.todayWork") return response;
          const envelope = response as {
            result: { data: ReturnType<typeof SuperJSON.serialize> };
          };
          const original = SuperJSON.deserialize(
            envelope.result.data
          ) as Record<string, unknown>;
          return {
            result: {
              data: SuperJSON.serialize({
                ...original,
                cards: {
                  ...(original.cards as object),
                  todayScheduleCount: 2,
                  incompleteScheduleCount: 2,
                },
                todaySchedules: [today, overlap],
                incompleteSchedules: [past, overlap],
                todayFollowUps: [],
                overdueFollowUps: [],
                pendingNotifications: [],
                longUnmanagedCustomers: [],
              }),
            },
          };
        },
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const queue = page.getByTestId("dashboard-mobile-followup-queue");
      const all = queue.getByRole("button", {
        name: "오늘 업무 필터: 전체 3건",
        exact: true,
      });
      const todayFilter = queue.getByRole("button", {
        name: "오늘 업무 필터: 오늘 예정 2건",
        exact: true,
      });
      const overdueFilter = queue.getByRole("button", {
        name: "오늘 업무 필터: 기한 경과 1건",
        exact: true,
      });
      const filters = queue.getByRole("button", { name: /^오늘 업무 필터:/ });
      await expect(all).toBeVisible();
      await expect(filters).toHaveCount(5);
      await expect(all).toHaveAttribute("aria-pressed", "true");
      for (const item of [past, today, overlap])
        await expect(
          queue.getByRole("button", { name: item.title, exact: true })
        ).toHaveCount(1);

      await all.focus();
      await page.keyboard.press("Tab");
      await expect(todayFilter).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(todayFilter).toHaveAttribute("aria-pressed", "true");
      await expect(todayFilter).toBeFocused();
      await expect(all).toHaveAttribute("aria-pressed", "false");
      await expect(
        queue.getByRole("button", { name: past.title, exact: true })
      ).toHaveCount(0);
      for (const item of [today, overlap])
        await expect(
          queue.getByRole("button", { name: item.title, exact: true })
        ).toHaveCount(1);
      await expect(queue).not.toContainText("원래 예정");
      await expect(queue).not.toContainText("일 지연");
      if (viewport.width < 640)
        await expect(
          queue.getByTestId("mobile-followup-today-chip")
        ).toHaveText("오늘 예정 2건");
      await page.keyboard.press("Tab");
      await expect(overdueFilter).toBeFocused();
      await page.keyboard.press("Space");
      await expect(overdueFilter).toHaveAttribute("aria-pressed", "true");
      await expect(overdueFilter).toBeFocused();
      await expect(todayFilter).toHaveAttribute("aria-pressed", "false");
      await expect(
        queue.getByRole("button", { name: past.title, exact: true })
      ).toHaveCount(1);
      for (const item of [today, overlap])
        await expect(
          queue.getByRole("button", { name: item.title, exact: true })
        ).toHaveCount(0);
      const dateCopy = queue.getByText(
        "원래 예정 2026-05-21 14:00 · 116일 지연",
        { exact: true }
      );
      await expect(dateCopy).toBeVisible();
      for (const name of ["완료", "고객상세 보기", "후속 등록", "바로 처리"])
        await expect(
          queue.getByRole("button", { name, exact: true })
        ).toBeVisible();
      const layout = await queue.evaluate((element, width) => {
        const bounds = (node: Element) => {
          const rect = node.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            scrollWidth: node.scrollWidth,
            clientWidth: node.clientWidth,
          };
        };
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewport: width,
          filters: Array.from(
            element.querySelectorAll('button[aria-label^="오늘 업무 필터:"]')
          ).map(bounds),
          copy: Array.from(element.querySelectorAll("p"))
            .filter(node => node.textContent?.includes("원래 예정"))
            .map(node => ({
              ...bounds(node),
              scrollHeight: node.scrollHeight,
              clientHeight: node.clientHeight,
            })),
        };
      }, viewport.width);
      expect(layout.documentWidth).toBeLessThanOrEqual(viewport.width);
      for (const button of layout.filters) {
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(viewport.width);
        expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
        if (viewport.width < 640)
          expect(button.height).toBeGreaterThanOrEqual(44);
      }
      expect(layout.copy).toHaveLength(1);
      for (const copy of layout.copy) {
        expect(copy.scrollWidth).toBeLessThanOrEqual(copy.clientWidth);
        expect(copy.scrollHeight).toBeLessThanOrEqual(copy.clientHeight);
      }
      await testInfo.attach("layout.json", {
        body: JSON.stringify(layout, null, 2),
        contentType: "application/json",
      });
      await writeFile(
        testInfo.outputPath("layout.json"),
        JSON.stringify(layout, null, 2)
      );
      if (role === "branch_admin") {
        await queue.screenshot({
          path: testInfo.outputPath(`queue-${viewport.width}.png`),
        });
        const accessibility = await new AxeBuilder({ page })
          .include('[data-testid="dashboard-mobile-followup-queue"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        await testInfo.attach("queue-axe.json", {
          body: JSON.stringify(accessibility.violations, null, 2),
          contentType: "application/json",
        });
        await writeFile(
          testInfo.outputPath("queue-axe.json"),
          JSON.stringify(accessibility.violations, null, 2)
        );
        expect(accessibility.violations).toEqual([]);
        await dateCopy.evaluate(element =>
          element.scrollIntoView({ block: "center" })
        );
        await page.screenshot({
          path: testInfo.outputPath(`viewport-${viewport.width}.png`),
        });
      }
      await queue
        .getByRole("button", { name: "바로 처리", exact: true })
        .click();
      await expect(page).toHaveURL(/\/calendar$/);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
