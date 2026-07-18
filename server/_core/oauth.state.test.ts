import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "../db";
import * as calendarClient from "../googleCalendarClient";
import * as calendarSync from "../googleCalendarSync";
import { ENV } from "./env";
import {
  buildGoogleCalendarOAuthAuthorizeUrl,
  registerOAuthRoutes,
} from "./oauth";
import { issueOAuthState, OAUTH_STATE_TTL_MS } from "./oauthState";
import { sdk } from "./sdk";

const ORIGINAL_ENV = { ...ENV };
const STATE_COOKIE = "boa_oauth_state_login";
const CALENDAR_STATE_COOKIE = "boa_oauth_state_google_calendar";

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

    const app = express();
    app.get("/test/calendar-oauth/start", (req, res) => {
      const state = issueOAuthState(req, res, "google_calendar");
      res.redirect(302, buildGoogleCalendarOAuthAuthorizeUrl(baseUrl, state));
    });
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

  async function request(path: string, jar: HttpCookieJar, updateJar = true) {
    const cookie = jar.header();
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
      flow.jar
    );
    expect(replay.status).toBe(403);
    expect(sdk.exchangeGoogleCodeForToken).toHaveBeenCalledOnce();
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
    const branchAdmin = {
      id: 9001,
      role: "branch_admin",
      accountStatus: "active",
    } as any;
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(branchAdmin);
    const exchangeSpy = vi
      .spyOn(calendarClient, "exchangeGoogleCalendarAuthCode")
      .mockResolvedValue({
        refreshToken: "stub-calendar-refresh-token",
        scope: "calendar.events",
      } as any);
    vi.spyOn(calendarSync, "storeGoogleCalendarRefreshToken").mockResolvedValue(
      undefined
    );

    const flow = await request(
      "/test/calendar-oauth/start",
      new HttpCookieJar()
    );
    const jar = new HttpCookieJar();
    jar.update(flow);
    const state = new URL(flow.headers.get("location")!).searchParams.get(
      "state"
    )!;
    expect(jar.get(CALENDAR_STATE_COOKIE)).toBeTruthy();

    const wrongBrowser = await request(
      `/api/oauth/google-calendar/callback?code=code&state=${state}`,
      new HttpCookieJar()
    );
    expect(wrongBrowser.status).toBe(403);
    expect(exchangeSpy).not.toHaveBeenCalled();

    const success = await request(
      `/api/oauth/google-calendar/callback?code=code&state=${state}`,
      jar
    );
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toBe(
      "/google-calendar-integration?connected=1"
    );
    expect(jar.get(CALENDAR_STATE_COOKIE)).toBeUndefined();
    expect(exchangeSpy).toHaveBeenCalledOnce();
  });
});
