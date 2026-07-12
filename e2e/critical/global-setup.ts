import { mkdir, writeFile } from "node:fs/promises";
import type { FullConfig } from "@playwright/test";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "../../server/_core/sdk";
import {
  assertCriticalE2EEnvironment,
  CRITICAL_E2E_AUTH_DIR,
  CRITICAL_E2E_USERS,
  criticalE2EStorageState,
} from "./fixtures";

export default async function globalSetup(config: FullConfig) {
  assertCriticalE2EEnvironment();
  if (!process.env.JWT_SECRET || !process.env.VITE_APP_ID) {
    throw new Error("Synthetic JWT_SECRET and VITE_APP_ID are required");
  }

  const baseURL = String(config.projects[0]?.use.baseURL ?? "");
  const origin = new URL(baseURL).origin;
  await mkdir(CRITICAL_E2E_AUTH_DIR, { recursive: true });

  for (const [role, user] of Object.entries(CRITICAL_E2E_USERS)) {
    const token = await sdk.createSessionToken(user.openId, {
      expiresInMs: 30 * 60 * 1000,
      name: user.name,
    });
    const state = {
      cookies: [
        {
          name: COOKIE_NAME,
          value: token,
          url: origin,
          expires: Math.floor(Date.now() / 1000) + 30 * 60,
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
        },
      ],
      origins: [],
    };
    await writeFile(
      criticalE2EStorageState(role as keyof typeof CRITICAL_E2E_USERS),
      JSON.stringify(state),
      { encoding: "utf8", mode: 0o600 }
    );
  }
}
