import { expect, test, type Page } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const distDir = path.resolve(process.cwd(), "dist/public");

const VIEWPORTS = [
  { name: "desktop-wide", width: 1440, height: 900 },
  { name: "desktop-standard", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile-standard", width: 390, height: 844 },
  { name: "mobile-compact", width: 360, height: 740 },
];

const ROLES = ["branch_admin", "sub_branch_admin", "team_leader", "member"] as const;

let server: http.Server;
let productionBaseURL: string;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let reqPath = new URL(req.url!, productionBaseURL).pathname;
    let filePath = path.resolve(distDir, "." + reqPath);
    if (!filePath.startsWith(distDir + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
    }
    const ext = path.extname(filePath);
    const contentType = ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : ext === ".json" ? "application/json" : "text/html";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Production test server did not receive a TCP address");
  }
  productionBaseURL = `http://127.0.0.1:${address.port}`;
  console.info("[production-boot-server]", JSON.stringify({
    event: "listening", project: test.info().project.name,
    workerIndex: test.info().workerIndex, port: address.port,
  }));
});

test.afterAll(async () => {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  console.info("[production-boot-server]", JSON.stringify({
    event: "closed", project: test.info().project.name,
    workerIndex: test.info().workerIndex, baseURL: productionBaseURL,
  }));
});

test.describe("Production Bundle Startup & Runtime Boot Verification (Finding P1)", () => {
  test("Production App Boots with Zero Circular Init / createContext Errors", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", err => pageErrors.push(err.message));
    page.on("console", msg => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await mockBoaTrpc(page, "branch_admin");
    await page.goto(`${productionBaseURL}/google-calendar-integration`, { waitUntil: "networkidle" });

    // Assert zero createContext errors
    const hasCreateContextError = pageErrors.some(e => e.includes("createContext"));
    expect(hasCreateContextError).toBe(false);
    expect(pageErrors.length).toBe(0);

    // Root must have rendered
    const heading = page.getByRole("heading", { name: "Google Calendar 연동 관리" });
    await expect(heading).toBeVisible();
  });

  for (const vp of VIEWPORTS) {
    for (const route of ["/google-calendar-integration", "/customers", "/"]) {
      test(`Production Multi-Route & Responsive Boot Matrix ${vp.name} ${route}`, async ({ page }, info) => {
        const pageErrors: string[] = [];
        page.on("pageerror", e => pageErrors.push(e.message));

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await mockBoaTrpc(page, "branch_admin");
        await page.goto(`${productionBaseURL}${route}`, { waitUntil: "networkidle" });

        const rootHTML = await page.locator("#root").innerHTML();
        const bootSuccess = rootHTML.length > 0 && pageErrors.length === 0;
        expect(bootSuccess).toBe(true);

        // Each pair has the unchanged test budget and its own project-safe artifacts.
        const shotName = `prod-${route.replace(/\//g, "_") || "root"}-${vp.width}x${vp.height}.png`;
        const shotPath = info.outputPath(shotName);
        await page.screenshot({ path: shotPath, fullPage: true });

        const matrixPath = info.outputPath("09-production-boot-matrix.json");
        fs.writeFileSync(
          matrixPath,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            project: info.project.name,
            results: [{
              viewport: vp.name,
              width: vp.width,
              height: vp.height,
              route,
              pageErrors: pageErrors.length,
              bootSuccess,
              screenshot: shotPath,
            }],
            verdict: "PROD_ROUTE_BOOTED_SUCCESSFULLY",
          }, null, 2),
          "utf8"
        );
        await info.attach("production-boot-matrix", {
          path: matrixPath, contentType: "application/json",
        });
        await info.attach("production-boot-screenshot", {
          path: shotPath, contentType: "image/png",
        });
      });
    }
  }

  test("Production 4-Role UI Isolation & Safety", async ({ page }) => {
    for (const role of ROLES) {
      const pageErrors: string[] = [];
      page.on("pageerror", e => pageErrors.push(e.message));

      await mockBoaTrpc(page, role);
      await page.goto(`${productionBaseURL}/google-calendar-integration`, { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: "Google Calendar 연동 관리" })).toBeVisible();

      const hasAdminSync = await page.getByText("Google Calendar 원문 동기화 정책").isVisible().catch(() => false);
      const hasPersonal = await page.getByText("내 개인 Google Calendar 설정").isVisible().catch(() => false);

      if (role === "branch_admin") {
        expect(hasAdminSync).toBe(true);
      } else {
        expect(hasAdminSync).toBe(false);
      }
      expect(hasPersonal).toBe(true);
      expect(pageErrors.length).toBe(0);
    }
  });
});
