import { defineConfig, devices } from "@playwright/test";

/** Fixed default — webServer, baseURL, and VITE_OAUTH_PORTAL_URL must all use this port. */
export const E2E_DEFAULT_PORT = 3187;
const PORT = Number(process.env.E2E_PORT ?? E2E_DEFAULT_PORT);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Default worker budget: stable single-worker execution.
 * Override with E2E_WORKERS (e.g. full suite / CI shard). Smoke/roles scripts
 * also pass --workers=1 explicitly for Codex/Antigravity gate commands.
 */
const workers = process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 1;

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  timeout: 30_000,
  workers,
  fullyParallel: false,
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
      RAILWAY_ENVIRONMENT: "e2e",
      VITE_OAUTH_PORTAL_URL: `${baseURL}/__e2e__/oauth`,
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
