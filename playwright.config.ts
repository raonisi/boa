import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3187);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Worker concurrency.
 * Tests are independent (per-page tRPC mocking, no shared DB/global state, no
 * storageState), so they parallelize safely against the single dev server.
 * Serial execution (the previous workers:1 / fullyParallel:false) was the sole
 * cause of the full `test:e2e` run exceeding the 300s window — not a feature
 * defect. Override with E2E_WORKERS when a machine needs a different budget.
 */
const workers = process.env.E2E_WORKERS
  ? Number(process.env.E2E_WORKERS)
  : process.env.CI
    ? 2
    : "50%";

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  timeout: 30_000,
  workers,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: {
    timeout: 10_000,
  },
  webServer: {
    command: "node e2e/start-dev-server.mjs",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      E2E_PORT: String(PORT),
      PORT: String(PORT),
      HOST: "127.0.0.1",
      NODE_ENV: "development",
      VITE_OAUTH_PORTAL_URL: "http://127.0.0.1:3187/__e2e__/oauth",
      VITE_APP_ID: "boa-e2e",
      VITE_MANUS_DEBUG_COLLECTOR: "0",
    },
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-1280",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
