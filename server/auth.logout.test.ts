import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import * as db from "./db";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

afterEach(() => {
  vi.restoreAllMocks();
});

function createAuthContext(): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("session cookie options", () => {
  it("uses a non-secure lax cookie for local development over HTTP", () => {
    const options = getSessionCookieOptions({
      protocol: "http",
      hostname: "127.0.0.1",
      headers: { host: "127.0.0.1:3000" },
    } as TrpcContext["req"]);

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
    expect(options.domain).toBeUndefined();
  });

  it("keeps secure cookies for production HTTPS requests", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const options = getSessionCookieOptions({
        protocol: "https",
        hostname: "crm.example.com",
        headers: { host: "crm.example.com" },
      } as TrpcContext["req"]);

      expect(options).toMatchObject({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: true,
      });
      expect(options.domain).toBeUndefined();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

describe("session invalidation", () => {
  const sessionUser = (
    accountStatus: "active" | "inactive" | "resigned" = "active"
  ) => ({
    id: 1,
    openId: "google-sub",
    email: "admin@test.local",
    name: "[TEST] Admin",
    loginMethod: "google",
    role: "branch_admin",
    accountStatus,
    loginStatus: "linked",
    teamId: null,
    subBranchAdminId: null,
    sessionInvalidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  });

  it("rejects a session issued before the user's invalidation timestamp", async () => {
    ENV.cookieSecret = "test-session-secret";
    ENV.appId = "test-app";
    const token = await sdk.createSessionToken("google-sub", {
      name: "[TEST] Admin",
    });
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue({
      ...sessionUser("active"),
      sessionInvalidatedAt: new Date(Date.now() + 1000),
    } as any);

    await expect(
      sdk.authenticateRequest({
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      } as any)
    ).rejects.toThrow("Session has been invalidated");
  });

  it("rejects inactive and resigned stale sessions before returning a user", async () => {
    ENV.cookieSecret = "test-session-secret";
    ENV.appId = "test-app";
    const token = await sdk.createSessionToken("google-sub", {
      name: "[TEST] Admin",
    });
    const upsertSpy = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);

    for (const accountStatus of ["inactive", "resigned"] as const) {
      vi.spyOn(db, "getUserByOpenId").mockResolvedValueOnce(
        sessionUser(accountStatus) as any
      );
      await expect(
        sdk.authenticateRequest({
          headers: { cookie: `${COOKIE_NAME}=${token}` },
        } as any)
      ).rejects.toThrow("Account is inactive");
    }

    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
