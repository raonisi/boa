import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CRITICAL_E2E_IDS,
  criticalE2EStorageState,
} from "../critical/fixtures";

const REPORT_DIR = path.resolve("quality-results/accessibility");
const BASELINE_PATH = path.resolve("quality/accessibility-baseline.json");
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

type ViolationSignature = {
  rule: string;
  impact: string;
  target: string;
};

type AccessibilityBaseline = {
  scenarios: Record<string, ViolationSignature[]>;
};

const authenticatedScenarios = [
  {
    name: "dashboard",
    path: "/",
    ready: (page: Page) =>
      page.getByRole("heading", { name: /먼저 처리할 일부터 보세요/ }).first(),
  },
  {
    name: "customer-list",
    path: "/customers",
    ready: (page: Page) =>
      page.getByRole("heading", { name: "고객 관리" }),
  },
  {
    name: "customer-detail",
    path: `/customers/${CRITICAL_E2E_IDS.customers.primary}`,
    ready: (page: Page) => page.getByText("고객 상세", { exact: true }),
  },
  {
    name: "calendar",
    path: "/calendar",
    ready: (page: Page) =>
      page.getByRole("heading", { name: "일정관리" }),
  },
  {
    name: "schedule-change-requests",
    path: "/schedule-change-requests",
    ready: (page: Page) =>
      page.getByRole("heading", { name: "일정 변경 요청" }),
  },
] as const;

function sanitizeTarget(target: unknown[]) {
  const raw = target.map(String).join(" > ");
  const redacted = raw
    .replace(/(aria-label|title|value)=(["']).*?\2/gi, '$1="<redacted>"')
    .replace(/:has-text\((['"]).*?\1\)/gi, ':has-text("<redacted>")');
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  return `${redacted}#${digest}`;
}

function sortSignatures(signatures: ViolationSignature[]) {
  return signatures.sort((a, b) =>
    `${a.rule}|${a.impact}|${a.target}`.localeCompare(
      `${b.rule}|${b.impact}|${b.target}`
    )
  );
}

async function readBaseline(): Promise<AccessibilityBaseline> {
  return JSON.parse(await readFile(BASELINE_PATH, "utf8"));
}

async function scanStablePage(page: Page, scenario: string, project: string) {
  await page
    .locator("[data-loading='true']")
    .waitFor({ state: "detached" })
    .catch(() => {});
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}",
  });
  await page.evaluate(async () => document.fonts.ready);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = results.violations.map(violation => ({
    rule: violation.id,
    impact: violation.impact ?? "unknown",
    description: violation.description,
    targets: violation.nodes.map(node => sanitizeTarget(node.target)),
  }));
  const blocking = sortSignatures(
    violations.flatMap(violation =>
      BLOCKING_IMPACTS.has(violation.impact)
        ? violation.targets.map(target => ({
            rule: violation.rule,
            impact: violation.impact,
            target,
          }))
        : []
    )
  );

  await writeFile(
    path.join(REPORT_DIR, `${project}-${scenario}.json`),
    JSON.stringify({ scenario, project, violations, blocking }, null, 2),
    "utf8"
  );

  if (process.env.UPDATE_ACCESSIBILITY_BASELINE !== "true") {
    const baseline = await readBaseline();
    const key = `${project}:${scenario}`;
    expect(blocking, `Accessibility baseline changed for ${key}`).toEqual(
      baseline.scenarios[key]
    );
  }
}

test.describe("public login accessibility", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.__boaSuppressAuthRedirect = true;
    });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Google 계정으로 로그인" })
    ).toBeVisible();
    await scanStablePage(page, "login", testInfo.project.name);
  });
});

test.describe("authenticated core page accessibility", () => {
  test.use({ storageState: criticalE2EStorageState("branchAdmin") });

  for (const scenario of authenticatedScenarios) {
    test(scenario.name, async ({ page }, testInfo) => {
      await page.goto(scenario.path);
      await expect(scenario.ready(page)).toBeVisible();
      await scanStablePage(page, scenario.name, testInfo.project.name);
    });
  }
});
