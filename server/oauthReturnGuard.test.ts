import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGoogleLoginOAuthAuthorizeUrl,
  registerOAuthRoutes,
  safeAuthRedirectUrl,
  safePublicReturnTo,
} from "./_core/oauth";
import { ENV } from "./_core/env";

function captureOAuthGetHandlers() {
  const handlers = new Map<string, (...args: any[]) => unknown>();
  registerOAuthRoutes({
    get: (path: string, handler: (...args: any[]) => unknown) => {
      handlers.set(path, handler);
    },
  } as any);
  return handlers;
}

function decodeOAuthState(url: string) {
  const state = new URL(url).searchParams.get("state");
  if (!state) throw new Error("missing OAuth state");
  return JSON.parse(Buffer.from(state, "base64").toString("utf8")) as {
    redirectUri: string;
    returnTo: string;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OAuth callback return path guard", () => {
  it.each([
    ["/", "/"],
    ["/directory", "/directory"],
    ["/work-tools", "/work-tools"],
    ["/claim-documents", "/claim-documents"],
    ["/disclosure-links", "/disclosure-links"],
    ["/knowledge", "/knowledge"],
    ["/message-templates", "/message-templates"],
    ["/search", "/search"],
    ["/search?q=test", "/search?q=test"],
    ["/directory?query=일성", "/directory?query=%EC%9D%BC%EC%84%B1"],
  ])("keeps allowed public callback path %s", (input, expected) => {
    expect(safePublicReturnTo(input)).toBe(expected);
  });

  it.each([
    "/admin",
    "/admin/",
    "/admin/users",
    "/admin/insurers",
    "https://evil.test",
    "http://evil.test",
    "//evil.test",
    "javascript:alert(1)",
    "data:text/html,test",
    "ftp://evil.test",
    "%2Fadmin",
    "%2Fadmin%2Fusers",
    "https%3A%2F%2Fevil.test",
    "not a path",
    "%",
  ])("falls back for unsafe callback path %s", input => {
    expect(safePublicReturnTo(input)).toBe("/");
  });

  it.each([
    ["/directory", "https://plannerdesk.test/directory"],
    ["/search?q=test", "https://plannerdesk.test/search?q=test"],
    ["/admin", "https://plannerdesk.test/"],
    ["/admin/users", "https://plannerdesk.test/"],
    ["https://evil.test", "https://plannerdesk.test/"],
    ["//evil.test", "https://plannerdesk.test/"],
    ["javascript:alert(1)", "https://plannerdesk.test/"],
    ["data:text/html,test", "https://plannerdesk.test/"],
  ])("builds safe auth redirect URL for %s", (url, expected) => {
    expect(safeAuthRedirectUrl(url, "https://plannerdesk.test")).toBe(expected);
  });

  it("stores only sanitized public callback paths in the login OAuth state", () => {
    const unsafeUrl = buildGoogleLoginOAuthAuthorizeUrl({
      clientId: "google-client-id",
      redirectUri: "https://boa.test/api/oauth/callback",
      returnTo: "/admin/users",
    });
    expect(decodeOAuthState(unsafeUrl)).toEqual({
      redirectUri: "https://boa.test/api/oauth/callback",
      returnTo: "/",
    });

    const safeUrl = buildGoogleLoginOAuthAuthorizeUrl({
      clientId: "google-client-id",
      redirectUri: "https://boa.test/api/oauth/callback",
      returnTo: "/directory",
    });
    expect(decodeOAuthState(safeUrl)).toEqual({
      redirectUri: "https://boa.test/api/oauth/callback",
      returnTo: "/directory",
    });
  });

  it("normalizes direct /api/auth/signin callbackUrl before redirecting to Google", async () => {
    const originalClientId = ENV.googleClientId;
    const originalRedirectUri = ENV.googleRedirectUri;
    ENV.googleClientId = "google-client-id";
    ENV.googleRedirectUri = "";
    try {
      const handlers = captureOAuthGetHandlers();
      const signin = handlers.get("/api/auth/signin");
      if (!signin) throw new Error("signin route was not registered");
      const redirect = vi.fn();

      await signin(
        {
          query: { callbackUrl: "%2Fadmin%2Fusers" },
          protocol: "https",
          headers: { host: "boa.test" },
        },
        {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
          redirect,
        }
      );

      expect(redirect).toHaveBeenCalledWith(302, expect.any(String));
      const googleUrl = redirect.mock.calls[0][1] as string;
      expect(new URL(googleUrl).origin).toBe("https://accounts.google.com");
      expect(decodeOAuthState(googleUrl)).toEqual({
        redirectUri: "https://boa.test/api/oauth/callback",
        returnTo: "/",
      });
    } finally {
      ENV.googleClientId = originalClientId;
      ENV.googleRedirectUri = originalRedirectUri;
    }
  });
});
