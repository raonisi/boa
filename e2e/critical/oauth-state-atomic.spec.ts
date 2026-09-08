import { expect, test } from "@playwright/test";
import { criticalE2EStorageState } from "./fixtures";

const LOGIN_COOKIE = "boa_oauth_state_login";
const CALENDAR_COOKIE = "boa_oauth_state_google_calendar";

function cookiePair(response: Response, name: string) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));
  if (!match) throw new Error(`Missing ${name} cookie`);
  return `${name}=${match[1]}`;
}

async function startLogin(baseURL: string) {
  const response = await fetch(`${baseURL}/api/oauth/start`, {
    redirect: "manual",
  });
  expect(response.status).toBe(302);
  const authorizeUrl = new URL(response.headers.get("location")!);
  const state = authorizeUrl.searchParams.get("state");
  expect(state).toBeTruthy();
  return {
    state: state!,
    cookie: cookiePair(response, LOGIN_COOKIE),
  };
}

async function callback(
  baseURL: string,
  path: string,
  state: string,
  cookie: string
) {
  return fetch(`${baseURL}${path}?state=${encodeURIComponent(state)}`, {
    redirect: "manual",
    headers: { cookie },
  });
}

test.describe("OAuth state atomic MySQL boundary", () => {
  test("rejects sequential replay with the preserved original Cookie header", async ({
    baseURL,
  }) => {
    const flow = await startLogin(baseURL!);
    const first = await callback(
      baseURL!,
      "/api/oauth/callback",
      flow.state,
      flow.cookie
    );
    const replay = await callback(
      baseURL!,
      "/api/oauth/callback",
      flow.state,
      flow.cookie
    );

    expect(first.status).toBe(400);
    expect(replay.status).toBe(403);
  });

  test("allows exactly one concurrent callback to consume the MySQL nonce", async ({
    baseURL,
  }) => {
    const flow = await startLogin(baseURL!);
    const responses = await Promise.all([
      callback(baseURL!, "/api/oauth/callback", flow.state, flow.cookie),
      callback(baseURL!, "/api/oauth/callback", flow.state, flow.cookie),
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([
      400, 403,
    ]);
    const replay = await callback(
      baseURL!,
      "/api/oauth/callback",
      flow.state,
      flow.cookie
    );
    expect(replay.status).toBe(403);
  });

  test("uses the real Calendar start procedure and isolates both purposes", async ({
    baseURL,
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: criticalE2EStorageState("branchAdmin"),
    });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/api/health`);
      const calendarUrl = await page.evaluate(async () => {
        const query = new URLSearchParams({
          batch: "1",
          input: JSON.stringify({ "0": { json: null } }),
        });
        const response = await fetch(
          `/api/trpc/googleCalendar.getOAuthConnectUrl?${query.toString()}`,
          { credentials: "include" }
        );
        const body = await response.json();
        const item = Array.isArray(body) ? body[0] : body;
        if (!response.ok || !item?.result?.data?.json?.url) {
          throw new Error("Calendar OAuth start failed");
        }
        return item.result.data.json.url as string;
      });
      const calendarState = new URL(calendarUrl).searchParams.get("state")!;
      const calendarCookie = (await context.cookies()).find(
        cookie => cookie.name === CALENDAR_COOKIE
      );
      expect(calendarCookie).toBeTruthy();
      const calendarCookiePair = `${CALENDAR_COOKIE}=${calendarCookie!.value}`;

      const login = await startLogin(baseURL!);
      const loginAtCalendar = await callback(
        baseURL!,
        "/api/oauth/google-calendar/callback",
        login.state,
        login.cookie
      );
      const calendarAtLogin = await callback(
        baseURL!,
        "/api/oauth/callback",
        calendarState,
        calendarCookiePair
      );
      expect(loginAtCalendar.status).toBe(403);
      expect(calendarAtLogin.status).toBe(403);

      const loginCorrect = await callback(
        baseURL!,
        "/api/oauth/callback",
        login.state,
        login.cookie
      );
      const calendarCorrect = await callback(
        baseURL!,
        "/api/oauth/google-calendar/callback",
        calendarState,
        calendarCookiePair
      );
      expect(loginCorrect.status).toBe(400);
      expect(calendarCorrect.status).toBe(400);

      const calendarReplay = await callback(
        baseURL!,
        "/api/oauth/google-calendar/callback",
        calendarState,
        calendarCookiePair
      );
      expect(calendarReplay.status).toBe(403);
    } finally {
      await context.close();
    }
  });
});
