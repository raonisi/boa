import { defineConfig, devices } from "@playwright/test";
import criticalConfig from "./playwright.critical.config";

const inheritedWebServer = Array.isArray(criticalConfig.webServer)
  ? criticalConfig.webServer[0]
  : criticalConfig.webServer;

export default defineConfig({
  ...criticalConfig,
  testDir: "./e2e/accessibility",
  outputDir: "test-results/accessibility",
  globalSetup: "./e2e/accessibility/global-setup.ts",
  reporter: process.env.CI
    ? [
        ["list"],
        [
          "html",
          { open: "never", outputFolder: "playwright-report/accessibility" },
        ],
      ]
    : "list",
  webServer: {
    ...(inheritedWebServer ?? {}),
    env: {
      ...(inheritedWebServer?.env ?? {}),
      VITE_GOOGLE_CLIENT_ID: "boa-e2e-synthetic-client",
    },
  },
  projects: [
    {
      name: "accessibility-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "accessibility-mobile390",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
