import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import SuperJSON from "superjson";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const branchName = "[TEST] 지점장";
const longName = "[TEST] 이름이 긴 조직원 표시와 들여쓰기 확인용 합성 팀원";
const nodes = [
  {
    id: 1,
    name: branchName,
    role: "branch_admin",
    accountStatus: "active",
    parentUserId: null,
    directReportCount: 3,
    descendantCount: 6,
    customerCount: 1234,
  },
  {
    id: 2,
    name: "[TEST] 부지점장",
    role: "sub_branch_admin",
    accountStatus: "active",
    parentUserId: 1,
    directReportCount: 1,
    descendantCount: 2,
    customerCount: 234,
  },
  {
    id: 3,
    name: "[TEST] 직할 팀장",
    role: "team_leader",
    accountStatus: "active",
    parentUserId: 1,
    directReportCount: 0,
    descendantCount: 0,
    customerCount: 12,
  },
  {
    id: 4,
    name: "[TEST] 산하 팀장",
    role: "team_leader",
    accountStatus: "active",
    parentUserId: 2,
    directReportCount: 1,
    descendantCount: 1,
    customerCount: 34,
  },
  {
    id: 5,
    name: longName,
    role: "member",
    accountStatus: "active",
    parentUserId: 4,
    directReportCount: 0,
    descendantCount: 0,
    customerCount: 7,
  },
  {
    id: 6,
    name: "[TEST] 비활성 팀원",
    role: "member",
    accountStatus: "inactive",
    parentUserId: 1,
    directReportCount: 0,
    descendantCount: 0,
    customerCount: 0,
  },
  {
    id: 7,
    name: "[TEST] 퇴사 팀원",
    role: "member",
    accountStatus: "resigned",
    parentUserId: 2,
    directReportCount: 0,
    descendantCount: 0,
    customerCount: 0,
  },
].map(node => ({ ...node, explicitParentUserId: node.parentUserId }));
const summary = {
  subBranchAdminCount: 1,
  directTeamLeaderCount: 1,
  teamLeaderCount: 2,
  memberCount: 3,
  unassignedUserCount: 0,
  totalUserCount: 7,
};

async function setup(
  page: Page,
  theme: string,
  status = "active",
  realTime = false
) {
  const writes: string[] = [];
  if (!realTime)
    await page.clock.install({ time: new Date("2026-09-20T00:00:00Z") });
  await page.addInitScript(
    value => localStorage.setItem("theme", value),
    theme
  );
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  page.on("request", request => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      writes.push(new URL(request.url()).pathname);
  });
  await mockBoaTrpc(page, "branch_admin", {
    transformResponse: (procedure, response) =>
      procedure === "users.organizationTree"
        ? {
            result: {
              data: SuperJSON.serialize({
                nodes: nodes.map(node =>
                  node.id === 1 ? { ...node, accountStatus: status } : node
                ),
                summary,
              }),
            },
          }
        : response,
  });
  await page.goto("/organization");
  await expect(
    page.getByRole("heading", { name: branchName, exact: true })
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(
    theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/
  );
  return writes;
}

function card(page: Page, name: string) {
  return page
    .getByRole("heading", { name, exact: true })
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
}

// Resolve actual CSS Color 4/OKLCH to sRGB through the browser, then composite
// each background and group opacity from the text element out to the canvas.
// Test targets have solid surfaces; gradients are rejected, never guessed.
async function measure(scope: Locator) {
  return scope.evaluate(root => {
    type Color = [number, number, number, number];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    function color(css: string): Color {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      return [pixel[0], pixel[1], pixel[2], pixel[3] / 255];
    }
    function over(front: Color, back: Color): Color {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [0, 1, 2]
        .map(
          i =>
            (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha
        )
        .concat(alpha) as Color;
    }
    const opacity = (c: Color, value: number): Color => [
      c[0],
      c[1],
      c[2],
      c[3] * value,
    ];
    function luminance(c: Color) {
      const linear = c.slice(0, 3).map(value => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    return Array.from(
      root.querySelectorAll<HTMLElement>("p, h3, [data-slot=badge], button")
    ).map(element => {
      const style = getComputedStyle(element);
      let bg = color(style.backgroundColor);
      let fg = over(color(style.color), bg);
      let ancestor: HTMLElement | null = element;
      const layers = [];
      while (ancestor) {
        const current = getComputedStyle(ancestor);
        // An opaque card occludes gradients outside it. A visible gradient
        // would require pixel sampling and must not be treated as a solid fill.
        if (current.backgroundImage !== "none" && (bg[3] < 1 || fg[3] < 1))
          throw new Error(
            `Visible non-solid background: ${ancestor.tagName}.${ancestor.className}`
          );
        layers.push({
          background: current.backgroundColor,
          image: current.backgroundImage,
          opacity: current.opacity,
        });
        bg = opacity(bg, Number(current.opacity));
        fg = opacity(fg, Number(current.opacity));
        ancestor = ancestor.parentElement;
        if (ancestor) {
          const back = color(getComputedStyle(ancestor).backgroundColor);
          bg = over(bg, back);
          fg = over(fg, back);
        }
      }
      bg = over(bg, [255, 255, 255, 1]);
      fg = over(fg, [255, 255, 255, 1]);
      const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent?.trim(),
        tag: element.tagName,
        classes: element.className,
        cssColor: style.color,
        cssBackground: style.backgroundColor,
        transitionProperty: style.transitionProperty,
        foreground: fg.slice(0, 3),
        background: bg.slice(0, 3),
        ratio: (a + 0.05) / (b + 0.05),
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        layers,
        clipped: element.scrollWidth > element.clientWidth,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
  });
}

function evidence(name: string, value: unknown) {
  if (!process.env.P206_EVIDENCE) return;
  mkdirSync(process.env.P206_EVIDENCE, { recursive: true });
  writeFileSync(
    join(process.env.P206_EVIDENCE, `${name}.json`),
    JSON.stringify(value, null, 2)
  );
}

for (const theme of ["light", "dark"]) {
  test(`P206 contrast, layout, semantics and read-only actions — ${theme}`, async ({
    page,
  }, info) => {
    const viewport =
      info.project.name === "desktop-chromium"
        ? { width: 1440, height: 900 }
        : info.project.name === "desktop-1280"
          ? { width: 320, height: 740 }
          : { width: 390, height: 844 };
    await page.setViewportSize(viewport);
    const writes = await setup(page, theme);
    const branch = card(page, branchName);
    const measurements = await measure(branch);
    const otherCards = [];
    for (const node of nodes.slice(1)) {
      const target = card(page, node.name);
      otherCards.push({
        id: node.id,
        role: node.role,
        status: node.accountStatus,
        cardClass: await target.getAttribute("class"),
        measurements: await measure(target),
      });
    }
    const key = `${theme}-${viewport.width}`;
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    evidence(key, {
      phase: process.env.P206_PHASE,
      theme,
      viewport,
      measurements,
      otherCards,
      layout,
      writes,
    });
    await info.attach(`${key}-computed-contrast`, {
      body: JSON.stringify({ measurements, otherCards, layout }, null, 2),
      contentType: "application/json",
    });
    await page.screenshot({
      path: info.outputPath(`${key}-page.png`),
      fullPage: true,
    });
    await branch.screenshot({ path: info.outputPath(`${key}-branch.png`) });
    for (const title of ["지점장 직할", "부지점장 조직"]) {
      const section = page
        .locator('[data-slot="collapsible"]')
        .filter({ has: page.getByText(title, { exact: true }) });
      await section.screenshot({
        path: info.outputPath(`${key}-${title}.png`),
      });
    }
    // Assert every label, metric, name, parent and badge conservatively at 4.5.
    // Soft assertions retain all failing PRE measurements in a single run.
    for (const item of measurements)
      expect
        .soft(item.ratio, `${key}: ${item.text}`)
        .toBeGreaterThanOrEqual(4.5);
    expect(layout.document).toBeLessThanOrEqual(viewport.width);
    expect(measurements.filter(item => item.clipped)).toEqual([]);
    for (const item of measurements) {
      expect(item.rect.x).toBeGreaterThanOrEqual(0);
      expect(item.rect.x + item.rect.width).toBeLessThanOrEqual(viewport.width);
    }
    for (const other of otherCards) {
      const buttons = other.measurements.filter(item => item.tag === "BUTTON");
      expect(buttons.filter(item => item.clipped)).toEqual([]);
      if (buttons.length === 2) {
        const [a, b] = buttons.map(item => item.rect);
        expect(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y
        ).toBe(true);
      }
    }
    await expect(branch.getByText("상위: 없음", { exact: true })).toBeVisible();
    for (const [label, value] of [
      ["직속", "3"],
      ["산하", "6"],
      ["고객", "1234"],
    ]) {
      const box = branch.getByText(label, { exact: true }).locator("..");
      await expect(box.getByText(value, { exact: true })).toBeVisible();
    }
    await expect(branch.getByText("지점장", { exact: true })).toBeVisible();
    await expect(branch.getByText("활성", { exact: true })).toBeVisible();
    await expect(
      branch.getByRole("button", { name: "상위자 변경" })
    ).toHaveCount(0);
    const action = card(page, longName).getByRole("button", {
      name: "상위자 변경",
    });
    await action.scrollIntoViewIfNeeded();
    await action.focus();
    await expect(action).toBeFocused();
    const focus = await action.evaluate(el => ({
      outline: getComputedStyle(el).outlineStyle,
      shadow: getComputedStyle(el).boxShadow,
    }));
    expect(focus.outline !== "none" || focus.shadow !== "none").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
    await expect(
      page.getByRole("dialog").getByText(`${longName}(팀원)`, { exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const unlink = card(page, longName).getByRole("button", {
      name: "산하 해제",
    });
    await unlink.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    const axe = await new AxeBuilder({ page })
      .include('[data-slot="card"].bg-boa-navy')
      .withRules([
        "color-contrast",
        "button-name",
        "aria-valid-attr",
        "aria-valid-attr-value",
        "aria-roles",
        "aria-allowed-role",
      ])
      .analyze();
    const pageAxe = await new AxeBuilder({ page })
      .include('[data-slot="card"]')
      .withRules([
        "color-contrast",
        "button-name",
        "aria-valid-attr",
        "aria-valid-attr-value",
        "aria-roles",
        "aria-allowed-role",
      ])
      .analyze();
    evidence(`${key}-axe`, {
      violations: axe.violations,
      incomplete: axe.incomplete,
      pageViolations: pageAxe.violations,
      pageIncomplete: pageAxe.incomplete,
      writes,
    });
    expect.soft(axe.violations).toEqual([]);
    expect(writes).toEqual([]);
  });

  test(`P206 branch status badges preserve semantics and contrast — ${theme}`, async ({
    page,
  }, info) => {
    for (const status of ["inactive", "resigned"]) {
      const writes = await setup(page, theme, status);
      const target = card(page, branchName);
      const measurements = await measure(target);
      evidence(`${theme}-${info.project.name}-${status}`, {
        measurements,
        writes,
      });
      const badge = target.getByText(
        status === "inactive" ? "비활성" : "퇴사자",
        { exact: true }
      );
      await expect(badge).toBeVisible();
      for (const item of measurements)
        expect
          .soft(item.ratio, `${theme}/${status}: ${item.text}`)
          .toBeGreaterThanOrEqual(4.5);
      expect(writes).toEqual([]);
    }
  });
}

// Arm the sampler BEFORE clicking the real ThemeProvider control. The html
// class observer captures the first changed style, then every rendered frame.
// This test deliberately uses the real clock and default browser motion.
async function armTransition(scope: Locator) {
  await scope.evaluate(root => {
    type Color = [number, number, number, number];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const color = (css: string): Color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      return [pixel[0], pixel[1], pixel[2], pixel[3] / 255];
    };
    const over = (front: Color, back: Color): Color => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [
        ...[0, 1, 2].map(
          i =>
            (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha
        ),
        alpha,
      ] as Color;
    };
    const luminance = (c: Color) => {
      const linear = c.slice(0, 3).map(value => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>("p, h3, [data-slot=badge], button")
    );
    const read = () =>
      elements.map(element => {
        const style = getComputedStyle(element);
        let bg = color(style.backgroundColor);
        let fg = over(color(style.color), bg);
        const layers = [];
        for (let ancestor: HTMLElement | null = element; ancestor; ) {
          const current = getComputedStyle(ancestor);
          if (current.backgroundImage !== "none" && (bg[3] < 1 || fg[3] < 1))
            throw new Error(
              "Visible non-solid background in transition sample"
            );
          layers.push({
            background: current.backgroundColor,
            image: current.backgroundImage,
            opacity: current.opacity,
          });
          bg[3] *= Number(current.opacity);
          fg[3] *= Number(current.opacity);
          ancestor = ancestor.parentElement;
          if (ancestor) {
            const back = color(getComputedStyle(ancestor).backgroundColor);
            bg = over(bg, back);
            fg = over(fg, back);
          }
        }
        bg = over(bg, [255, 255, 255, 1]);
        fg = over(fg, [255, 255, 255, 1]);
        const a = luminance(fg),
          b = luminance(bg);
        return {
          text: element.textContent?.trim(),
          tag: element.tagName,
          classes: element.className,
          cssColor: style.color,
          cssBackground: style.backgroundColor,
          foreground: fg,
          effectiveBackground: bg,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          transitionProperty: style.transitionProperty,
          transitionDuration: style.transitionDuration,
          layers,
        };
      });
    const state = {
      done: false,
      started: 0,
      initial: read(),
      frames: [] as {
        ms: number;
        theme: string | null;
        items: ReturnType<typeof read>;
      }[],
    };
    (window as any).__p206Transition = state;
    const initialDark = document.documentElement.classList.contains("dark");
    const sample = () =>
      state.frames.push({
        ms: performance.now() - state.started,
        theme: localStorage.getItem("theme"),
        items: read(),
      });
    const next = () => {
      sample();
      if (state.frames.at(-1)!.ms < 300) requestAnimationFrame(next);
      else state.done = true;
    };
    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains("dark") === initialDark)
        return;
      observer.disconnect();
      state.started = performance.now();
      sample();
      requestAnimationFrame(next);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  });
}

for (const status of ["active", "inactive", "resigned"]) {
  test(
    "P206 theme transition frames preserve contrast — " + status,
    async ({ page }, info) => {
      const viewport =
        info.project.name === "desktop-chromium"
          ? { width: 1440, height: 900 }
          : info.project.name === "desktop-1280"
            ? { width: 320, height: 740 }
            : { width: 390, height: 844 };
      await page.setViewportSize(viewport);
      const writes = await setup(page, "light", status, true);
      expect(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches
        )
      ).toBe(false);
      const target = card(page, branchName);
      for (const direction of ["light-to-dark", "dark-to-light"]) {
        await armTransition(target);
        await page
          .getByRole("button", {
            name:
              direction === "light-to-dark"
                ? "다크 모드로 전환"
                : "라이트 모드로 전환",
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () => (window as any).__p206Transition?.done
        );
        const samples = await page.evaluate(
          () => (window as any).__p206Transition
        );
        const key =
          "transition-" + viewport.width + "-" + status + "-" + direction;
        evidence(key, {
          viewport,
          status,
          direction,
          defaultMotion: true,
          samples,
          writes,
        });
        await info.attach(key, {
          body: JSON.stringify(samples, null, 2),
          contentType: "application/json",
        });
        expect(samples.frames.length).toBeGreaterThan(1);
        expect(samples.frames[0].ms).toBeLessThan(25);
        expect(samples.frames.at(-1).ms).toBeGreaterThanOrEqual(300);
        expect(
          samples.frames.some((frame: any) => frame.ms > 0 && frame.ms < 150)
        ).toBe(true);
        expect(
          samples.frames.every(
            (frame: any) =>
              frame.theme === (direction === "light-to-dark" ? "dark" : "light")
          )
        ).toBe(true);
        const all = [
          samples.initial,
          ...samples.frames.map((frame: any) => frame.items),
        ];
        for (const items of all) {
          for (const item of items) {
            expect
              .soft(item.ratio, key + ": " + item.text)
              .toBeGreaterThanOrEqual(4.5);
            if (item.tag === "SPAN") {
              expect(
                item.transitionProperty.split(",").map((p: string) => p.trim())
              ).toEqual(["box-shadow"]);
            }
          }
        }
        for (const node of nodes.slice(1)) {
          const properties = await card(page, node.name)
            .locator("[data-slot=badge]")
            .evaluateAll(badges =>
              badges.map(badge => getComputedStyle(badge).transitionProperty)
            );
          for (const property of properties)
            expect(property.split(",").map(p => p.trim())).toEqual([
              "color",
              "box-shadow",
            ]);
        }
        expect(writes).toEqual([]);
      }
    }
  );
}
