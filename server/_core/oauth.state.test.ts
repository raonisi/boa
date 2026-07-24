import express from "express";
import type { Server } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "../db";
import * as calendarClient from "../googleCalendarClient";
import * as calendarSync from "../googleCalendarSync";
import { googleCalendarRouter } from "../googleCalendar";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { OAUTH_STATE_TTL_MS } from "./oauthState";
import { sdk } from "./sdk";
import { router } from "./trpc";

const ORIGINAL_ENV = { ...ENV };
const STATE_COOKIE = "boa_oauth_state_login";
const CALENDAR_STATE_COOKIE = "boa_oauth_state_google_calendar";
const oauthTestRouter = router({ googleCalendar: googleCalendarRouter });
const BRANCH_ADMIN = {
  id: 9001,
  openId: "e2e_branch_admin",
  role: "branch_admin",
  accountStatus: "active",
} as any;

class HttpCookieJar {
  private readonly values = new Map<string, string>();

  update(response: Response) {
    const headersWithCookies = response.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const rawCookies = headersWithCookies.getSetCookie?.() ?? [
      response.headers.get("set-cookie") ?? "",
    ];
    const setCookies = rawCookies.flatMap(value =>
      value.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/)
    );

    for (const setCookie of setCookies) {
      const [pair] = setCookie.trim().split(";");
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/max-age=0/i.test(setCookie) || value === "") {
        this.values.delete(name);
      } else {
        this.values.set(name, value);
      }
    }
  }

  header() {
    return [...this.values.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get(name: string) {
    return this.values.get(name);
  }

  set(name: string, value: string) {
    this.values.set(name, value);
  }
}

describe("browser-bound OAuth state", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    ENV.googleClientId = "test-google-client-id";
    ENV.googleClientSecret = "test-google-client-secret";
    ENV.googleRedirectUri = "";
    ENV.cookieSecret = "test-oauth-cookie-secret-at-least-32-bytes";
    ENV.isProduction = false;

    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const nonceRows = new Map<
      string,
      { purpose: "login" | "google_calendar"; expiresAt: Date }
    >();
    vi.spyOn(db, "insertOAuthStateNonce").mockImplementation(async input => {
      if (nonceRows.has(input.nonceDigest)) {
        throw new Error("duplicate nonce digest");
      }
      nonceRows.set(input.nonceDigest, {
        purpose: input.purpose,
        expiresAt: input.expiresAt,
      });
    });
    vi.spyOn(db, "consumeOAuthStateNonce").mockImplementation(async input => {
      const row = nonceRows.get(input.nonceDigest);
      if (!row || row.purpose !== input.purpose) {
        return false;
      }
      return nonceRows.delete(input.nonceDigest);
    });

    const app = express();
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: oauthTestRouter,
        createContext: ({ req, res }) => ({ req, res, user: BRANCH_ADMIN }),
      })
    );
    registerOAuthRoutes(app);
    server = await new Promise<Server>(resolve => {
      const listeningServer = app.listen(0, "127.0.0.1", () =>
        resolve(listeningServer)
      );
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind to a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    Object.assign(ENV, ORIGINAL_ENV);
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      );
    }
  });

  async function request(
    path: string,
    jar: HttpCookieJar,
    updateJar = true,
    cookieOverride?: string
  ) {
    const cookie = cookieOverride ?? jar.header();
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      headers: cookie ? { cookie } : undefined,
    });
    if (updateJar) jar.update(response);
    return response;
  }

  async function startLogin(jar = new HttpCookieJar(), suffix = "") {
    const response = await request(`/api/oauth/start${suffix}`, jar);
    const authorizeUrl = new URL(response.headers.get("location")!);
    return {
      jar,
      response,
      authorizeUrl,
      state: authorizeUrl.searchParams.get("state")!,
    };
  }

  async function startCalendar(jar = new HttpCookieJar()) {
    const query = new URLSearchParams({
      batch: "1",
      input: JSON.stringify({ "0": { json: null } }),
    });
    const response = await request(
      `/api/trpc/googleCalendar.getOAuthConnectUrl?${query.toString()}`,
      jar
    );
    const body = (await response.json()) as any;
    const item = Array.isArray(body) ? body[0] : body;
    const authorizeUrl = new URL(item.result.data.json.url);
    return {
      jar,
      response,
      authorizeUrl,
      state: authorizeUrl.searchParams.get("state")!,
    };
  }

  function mockLoginUser(
    accountStatus: "active" | "inactive" | "resigned" = "active"
  ) {
    const user = {
      id: 9004,
      openId: "google-member-open-id",
      name: "[TEST] OAuth Member",
      email: "oauth-member@test.local",
      role: "member",
      accountStatus,
      loginStatus: "linked",
      teamId: 9101,
      subBranchAdminId: 9002,
    } as any;
    vi.spyOn(sdk, "exchangeGoogleCodeForToken").mockResolvedValue({
      access_token: "stub-access-token",
    } as any);
    vi.spyOn(sdk, "getGoogleUserInfo").mockResolvedValue({
      sub: user.openId,
      email: user.email,
      email_verified: true,
      name: user.name,
    } as any);
    vi.spyOn(db, "getAllUsersByEmail").mockResolvedValue([user]);
    vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(user);
    vi.spyOn(sdk, "createSessionToken").mockResolvedValue("stub-session-token");
    return user;
  }

  it("creates a unique 256-bit state and a short-lived development cookie", async () => {
    const first = await startLogin();
    const second = await startLogin();

    expect(first.response.status).toBe(302);
    expect(first.state).not.toBe(second.state);
    expect(Buffer.from(first.state, "base64url")).toHaveLength(32);
    expect(first.authorizeUrl.searchParams.get("redirect_uri")).toBe(
      `${baseUrl}/api/oauth/callback`
    );
    expect(first.state).not.toContain("callback");

    const stored = vi.mocked(db.insertOAuthStateNonce).mock.calls[0][0];
    expect(stored.nonceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.nonceDigest).not.toContain(first.state);
    expect(stored.purpose).toBe("login");

    const setCookie = first.response.headers.get("set-cookie")!;
    expect(setCookie).toContain(`${STATE_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/api/oauth/callback");
    expect(setCookie).toContain("Max-Age=300");
    expect(setCookie).not.toContain("Secure");
  });

  it("always marks the OAuth state cookie Secure in production", async () => {
    ENV.isProduction = true;
    const flow = await startLogin();
    expect(flow.response.headers.get("set-cookie")).toContain("Secure");
  });

  it("accepts the matching browser state, issues a session, and consumes state", async () => {
    mockLoginUser();
    const flow = await startLogin();
    const preservedCookie = flow.jar.header();
    const response = await request(
      `/api/oauth/callback?code=valid-code&state=${encodeURIComponent(flow.state)}`,
      flow.jar
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(sdk.exchangeGoogleCodeForToken).toHaveBeenCalledOnce();
    expect(sdk.createSessionToken).toHaveBeenCalledOnce();
    expect(flow.jar.get(STATE_COOKIE)).toBeUndefined();
    expect(flow.jar.get("app_session_id")).toBe("stub-session-token");

    const replay = await request(
      `/api/oauth/callback?code=replay-code&state=${encodeURIComponent(flow.state)}`,
      new HttpCookieJar(),
      false,
      preservedCookie
    );
    expect(replay.status).toBe(403);
    expect(sdk.exchangeGoogleCodeForToken).toHaveBeenCalledOnce();
  });

  it("allows exactly one of two concurrent callbacks with the same preserved cookie", async () => {
    mockLoginUser();
    const flow = await startLogin();
    const preservedCookie = flow.jar.header();
    const callback = `/api/oauth/callback?code=concurrent-code&state=${encodeURIComponent(flow.state)}`;

    const responses = await Promise.all([
      request(callback, new HttpCookieJar(), false, preservedCookie),
      request(callback, new HttpCookieJar(), false, preservedCookie),
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([
      302, 403,
    ]);
    expect(sdk.exchangeGoogleCodeForToken).toHaveBeenCalledOnce();
    expect(sdk.createSessionToken).toHaveBeenCalledOnce();
    expect(db.consumeOAuthStateNonce).toHaveBeenCalledTimes(2);
  });

  it("fails closed when nonce registration or atomic consumption is unavailable", async () => {
    vi.mocked(db.insertOAuthStateNonce).mockRejectedValueOnce(
      new Error("state store unavailable")
    );
    const failedStart = await request("/api/oauth/start", new HttpCookieJar());
    expect(failedStart.status).toBe(503);
    expect(failedStart.headers.get("location")).toBeNull();

    mockLoginUser();
    const flow = await startLogin();
    vi.mocked(db.consumeOAuthStateNonce).mockRejectedValueOnce(
      new Error("state store unavailable")
    );
    const failedCallback = await request(
      `/api/oauth/callback?code=code&state=${flow.state}`,
      flow.jar
    );
    expect(failedCallback.status).toBe(403);
    expect(flow.jar.get(STATE_COOKIE)).toBeUndefined();
    expect(sdk.exchangeGoogleCodeForToken).not.toHaveBeenCalled();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects missing, mismatched, tampered, and cross-browser state before exchange", async () => {
    mockLoginUser();
    const exchangeSpy = vi.mocked(sdk.exchangeGoogleCodeForToken);

    const missingState = await startLogin();
    expect(
      (await request("/api/oauth/callback?code=code-only", missingState.jar))
        .status
    ).toBe(400);
    expect(missingState.jar.get(STATE_COOKIE)).toBeUndefined();

    const missingCookie = await startLogin();
    expect(
      (
        await request(
          `/api/oauth/callback?code=code&state=${missingCookie.state}`,
          new HttpCookieJar()
        )
      ).status
    ).toBe(403);

    const mismatch = await startLogin();
    expect(
      (
        await request(
          "/api/oauth/callback?code=code&state=attacker-state",
          mismatch.jar
        )
      ).status
    ).toBe(403);
    expect(mismatch.jar.get(STATE_COOKIE)).toBeUndefined();

    const tampered = await startLogin();
    tampered.jar.set(STATE_COOKIE, `${tampered.jar.get(STATE_COOKIE)}tampered`);
    expect(
      (
        await request(
          `/api/oauth/callback?code=code&state=${tampered.state}`,
          tampered.jar
        )
      ).status
    ).toBe(403);

    const attacker = await startLogin();
    const victim = await startLogin();
    expect(
      (
        await request(
          `/api/oauth/callback?code=attacker-code&state=${attacker.state}`,
          victim.jar
        )
      ).status
    ).toBe(403);

    expect(
      (
        await request(
          "/api/oauth/callback?code=authorization-code-only",
          new HttpCookieJar()
        )
      ).status
    ).toBe(400);
    expect(exchangeSpy).not.toHaveBeenCalled();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects an expired state and clears it", async () => {
    mockLoginUser();
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const flow = await startLogin();
    clock.mockReturnValue(now + OAUTH_STATE_TTL_MS + 1);

    const response = await request(
      `/api/oauth/callback?code=late-code&state=${flow.state}`,
      flow.jar
    );
    expect(response.status).toBe(403);
    expect(flow.jar.get(STATE_COOKIE)).toBeUndefined();
    expect(sdk.exchangeGoogleCodeForToken).not.toHaveBeenCalled();
  });

  it("consumes a valid state when the authorization code is missing", async () => {
    mockLoginUser();
    const flow = await startLogin();
    const missingCode = await request(
      `/api/oauth/callback?state=${flow.state}`,
      flow.jar
    );

    expect(missingCode.status).toBe(400);
    expect(flow.jar.get(STATE_COOKIE)).toBeUndefined();
    expect(sdk.exchangeGoogleCodeForToken).not.toHaveBeenCalled();

    const replay = await request(
      `/api/oauth/callback?code=late-code&state=${flow.state}`,
      flow.jar
    );
    expect(replay.status).toBe(403);
    expect(sdk.exchangeGoogleCodeForToken).not.toHaveBeenCalled();
  });

  it("uses fixed internal redirects and ignores supplied redirect destinations", async () => {
    mockLoginUser();
    for (const destination of [
      "https://evil.test/capture",
      "//evil.test/capture",
      "javascript:alert(1)",
      "://malformed",
      "/customers",
    ]) {
      const flow = await startLogin(
        new HttpCookieJar(),
        `?redirect=${encodeURIComponent(destination)}`
      );
      expect(flow.authorizeUrl.searchParams.get("redirect_uri")).toBe(
        `${baseUrl}/api/oauth/callback`
      );
      const response = await request(
        `/api/oauth/callback?code=valid-code&state=${flow.state}&redirect=${encodeURIComponent(destination)}`,
        flow.jar
      );
      expect(response.headers.get("location")).toBe("/");
    }
  });

  it.each(["inactive", "resigned"] as const)(
    "does not issue a session for a %s user",
    async accountStatus => {
      mockLoginUser(accountStatus);
      const flow = await startLogin();
      const response = await request(
        `/api/oauth/callback?code=valid-code&state=${flow.state}`,
        flow.jar
      );
      expect(response.status).toBe(403);
      expect(sdk.createSessionToken).not.toHaveBeenCalled();
      expect(flow.jar.get(STATE_COOKIE)).toBeUndefined();
    }
  );

  it("does not log authorization codes, state values, tokens, or provider errors", async () => {
    const sensitiveCode = "sensitive-authorization-code";
    const sensitiveToken = "sensitive-provider-token";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exchangeSpy = vi
      .spyOn(sdk, "exchangeGoogleCodeForToken")
      .mockRejectedValue(
        new Error(`${sensitiveToken}: provider rejected request`)
      );
    const flow = await startLogin();
    const response = await request(
      `/api/oauth/callback?code=${sensitiveCode}&state=${flow.state}`,
      flow.jar
    );

    expect(response.status).toBe(500);
    expect(flow.jar.get(STATE_COOKIE)).toBeUndefined();
    const replay = await request(
      `/api/oauth/callback?code=${sensitiveCode}&state=${flow.state}`,
      flow.jar
    );
    expect(replay.status).toBe(403);
    expect(exchangeSpy).toHaveBeenCalledOnce();
    const logged = JSON.stringify([
      ...consoleSpy.mock.calls,
      ...vi.mocked(db.createActivityLog).mock.calls,
    ]);
    expect(logged).not.toContain(sensitiveCode);
    expect(logged).not.toContain(flow.state);
    expect(logged).not.toContain(sensitiveToken);
  });

  it("binds the Google Calendar callback to its own browser state", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(BRANCH_ADMIN);
    const exchangeSpy = vi
      .spyOn(calendarClient, "exchangeGoogleCalendarAuthCode")
      .mockResolvedValue({
        refreshToken: "stub-calendar-refresh-token",
        scope: "calendar.events",
      } as any);
    vi.spyOn(calendarSync, "storeGoogleCalendarRefreshToken").mockResolvedValue(
      undefined
    );

    const flow = await startCalendar();
    expect(flow.response.status).toBe(200);
    expect(flow.jar.get(CALENDAR_STATE_COOKIE)).toBeTruthy();

    const wrongBrowser = await request(
      `/api/oauth/google-calendar/callback?code=code&state=${flow.state}`,
      new HttpCookieJar()
    );
    expect(wrongBrowser.status).toBe(403);
    expect(exchangeSpy).not.toHaveBeenCalled();

    const success = await request(
      `/api/oauth/google-calendar/callback?code=code&state=${flow.state}`,
      flow.jar
    );
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toBe(
      "/google-calendar-integration?connected=1"
    );
    expect(flow.jar.get(CALENDAR_STATE_COOKIE)).toBeUndefined();
    expect(exchangeSpy).toHaveBeenCalledOnce();
  });

  it("isolates login and Calendar states, cookies, and atomic records", async () => {
    const firstBrowser = new HttpCookieJar();
    const login = await startLogin(firstBrowser);
    const calendar = await startCalendar(firstBrowser);

    const wrongCalendar = await request(
      `/api/oauth/google-calendar/callback?state=${login.state}`,
      firstBrowser
    );
    expect(wrongCalendar.status).toBe(403);
    expect(firstBrowser.get(STATE_COOKIE)).toBeTruthy();
    expect(firstBrowser.get(CALENDAR_STATE_COOKIE)).toBeUndefined();

    const validLogin = await request(
      `/api/oauth/callback?state=${login.state}`,
      firstBrowser
    );
    expect(validLogin.status).toBe(400);

    const secondBrowser = new HttpCookieJar();
    const secondLogin = await startLogin(secondBrowser);
    const secondCalendar = await startCalendar(secondBrowser);
    const wrongLogin = await request(
      `/api/oauth/callback?state=${secondCalendar.state}`,
      secondBrowser
    );
    expect(wrongLogin.status).toBe(403);
    expect(secondBrowser.get(STATE_COOKIE)).toBeUndefined();
    expect(secondBrowser.get(CALENDAR_STATE_COOKIE)).toBeTruthy();

    const validCalendar = await request(
      `/api/oauth/google-calendar/callback?state=${secondCalendar.state}`,
      secondBrowser
    );
    expect(validCalendar.status).toBe(400);

    const loginOnly = await startLogin();
    const loginCookieAtCalendar = await request(
      `/api/oauth/google-calendar/callback?state=${loginOnly.state}`,
      loginOnly.jar
    );
    expect(loginCookieAtCalendar.status).toBe(403);
    expect(loginOnly.jar.get(STATE_COOKIE)).toBeTruthy();

    const calendarOnly = await startCalendar();
    const calendarCookieAtLogin = await request(
      `/api/oauth/callback?state=${calendarOnly.state}`,
      calendarOnly.jar
    );
    expect(calendarCookieAtLogin.status).toBe(403);
    expect(calendarOnly.jar.get(CALENDAR_STATE_COOKIE)).toBeTruthy();

    expect(secondLogin.state).not.toBe(secondCalendar.state);
  });
});
