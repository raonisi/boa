import { rm } from "node:fs/promises";
import { CRITICAL_E2E_AUTH_DIR } from "./fixtures";

export default async function globalTeardown() {
  await rm(CRITICAL_E2E_AUTH_DIR, { recursive: true, force: true });
}
