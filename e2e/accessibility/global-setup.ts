import { mkdir, rm } from "node:fs/promises";
import type { FullConfig } from "@playwright/test";
import criticalGlobalSetup from "../critical/global-setup";

export default async function globalSetup(config: FullConfig) {
  await criticalGlobalSetup(config);
  await rm("quality-results/accessibility", { recursive: true, force: true });
  await mkdir("quality-results/accessibility", { recursive: true });
}
