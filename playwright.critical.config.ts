import { defineConfig, devices } from "@playwright/test";
import baseConfig, { E2E_DEFAULT_PORT } from "./playwright.config";

const port = Number(process.env.E2E_PORT ?? E2E_DEFAULT_PORT);
const baseURL = `http://127.0.0.1:${port}`;
const inheritedWebServer = Array.isArray(baseConfig.webServer)
  ? baseConfig.webServer[0]
  : baseConfig.webServer;

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e/critical",
  testIgnore: [],
  outputDir: "test-results/critical",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  globalSetup: "./e2e/critical/global-setup.ts",
  globalTeardown: "./e2e/critical/global-teardown.ts",
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report/critical" }],
      ]
    : "list",
  use: {
    ...(baseConfig.use ?? {}),
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    ...(inheritedWebServer ?? {}),
    url: `${baseURL}/api/health`,
    env: {
      ...(inheritedWebServer?.env ?? {}),
      ...process.env,
      E2E_PORT: String(port),
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "development",
      RAILWAY_ENVIRONMENT: "e2e",
      E2E_TEST_MODE: "true",
      PUSH_REMINDER_SCHEDULER_ENABLED: "false",
      VITE_OAUTH_PORTAL_URL: `${baseURL}/__e2e__/oauth-disabled`,
      VITE_APP_ID: "boa-e2e",
      VITE_MANUS_DEBUG_COLLECTOR: "0",
    },
  },
  projects: [
    {
      name: "critical-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
