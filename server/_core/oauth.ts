import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { GOOGLE_CALENDAR_OAUTH_SCOPES } from "@shared/googleCalendar";
import type { User } from "../../drizzle/schema";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import {
  GoogleLoginError,
  completeGoogleLoginWithUserInfo,
} from "./googleLoginFlow";
import { exchangeGoogleCalendarAuthCode } from "../googleCalendarClient";
import { storeGoogleCalendarRefreshToken } from "../googleCalendarSync";
import { sdk } from "./sdk";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_AUTH_RETURN_PATH = "/";
const PUBLIC_AUTH_RETURN_PATHS = new Set([
  "/",
  "/directory",
  "/work-tools",
  "/claim-documents",
  "/disclosure-links",
  "/knowledge",
  "/message-templates",
  "/search",
]);

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "[masked-email]";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function sanitizeLogMetadata(metadata: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key.toLowerCase().includes("email") && typeof value === "string") {
      safe[key === "email" ? "maskedEmail" : key] = maskEmail(value);
      continue;
    }
    if (["phone", "memo", "password"].includes(key.toLowerCase())) continue;
    safe[key] = value;
  }
  return safe;
}

function oauthLogDetails(data: {
  actor?: number | string | null;
  targetId?: number | string | null;
  targetType?: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  return JSON.stringify({
    actor: data.actor ?? null,
    targetId: data.targetId ?? null,
    targetType: data.targetType ?? "user",
    beforeValue: data.beforeValue ?? null,
    afterValue: data.afterValue ?? null,
    metadata: sanitizeLogMetadata(data.metadata),
  });
}

function decodeState(state: string): string | null {
  try {
    return Buffer.from(state, "base64").toString("utf8");
  } catch {
    return null;
  }
}

type LoginOAuthState = {
  redirectUri: string;
  returnTo: string;
};

function encodeLoginOAuthState(state: LoginOAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64");
}

function decodeLoginOAuthState(state: string): LoginOAuthState | null {
  const decoded = decodeState(state);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as Partial<LoginOAuthState>;
    if (typeof parsed.redirectUri !== "string") return null;
    return {
      redirectUri: parsed.redirectUri,
      returnTo: safePublicReturnTo(parsed.returnTo),
    };
  } catch {
    return {
      redirectUri: decoded,
      returnTo: DEFAULT_AUTH_RETURN_PATH,
    };
  }
}

function decodeOnce(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeCandidateReturnTo(value: string) {
  let candidate = value.trim();
  for (let i = 0; i < 2; i += 1) {
    const decoded = decodeOnce(candidate);
    if (!decoded || decoded === candidate) break;
    candidate = decoded.trim();
  }
  return candidate;
}

export function safePublicReturnTo(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AUTH_RETURN_PATH;
  const candidate = normalizeCandidateReturnTo(value);
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  let url: URL;
  try {
    url = new URL(candidate, "https://boa.local");
  } catch {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  if (url.origin !== "https://boa.local") return DEFAULT_AUTH_RETURN_PATH;
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    return DEFAULT_AUTH_RETURN_PATH;
  }
  if (!PUBLIC_AUTH_RETURN_PATHS.has(url.pathname)) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  return `${url.pathname}${url.search}`;
}

export function safeAuthRedirectUrl(url: string, baseUrl: string) {
  let origin: URL;
  try {
    origin = new URL(baseUrl);
  } catch {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  let candidate = url.trim();
  const decoded = decodeOnce(candidate);
  if (decoded) candidate = decoded.trim();

  if (!candidate || candidate.startsWith("//")) {
    return `${origin.origin}${DEFAULT_AUTH_RETURN_PATH}`;
  }

  try {
    const parsed = new URL(candidate, origin.origin);
    if (parsed.origin !== origin.origin) {
      return `${origin.origin}${DEFAULT_AUTH_RETURN_PATH}`;
    }
    return `${origin.origin}${safePublicReturnTo(`${parsed.pathname}${parsed.search}`)}`;
  } catch {
    return `${origin.origin}${DEFAULT_AUTH_RETURN_PATH}`;
  }
}

function getRequestOrigin(req: Request) {
  const forwardedProto = (
    req.headers["x-forwarded-proto"] as string | undefined
  )
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const proto = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.headers.host;

  return host ? `${proto}://${host}` : null;
}

function getExpectedRedirectUri(req: Request) {
  if (ENV.googleRedirectUri) return ENV.googleRedirectUri.trim();
  const origin = getRequestOrigin(req);
  return origin ? `${origin}/api/oauth/callback` : null;
}

function getCalendarRedirectUri(req: Request) {
  const origin = getRequestOrigin(req);
  return origin ? `${origin}/api/oauth/google-calendar/callback` : null;
}

function encodeCalendarOAuthState(redirectUri: string) {
  return `calendar:${Buffer.from(redirectUri, "utf8").toString("base64")}`;
}

function decodeCalendarOAuthState(state: string): string | null {
  if (!state.startsWith("calendar:")) return null;
  try {
    return Buffer.from(state.slice("calendar:".length), "base64").toString(
      "utf8"
    );
  } catch {
    return null;
  }
}

export function buildGoogleCalendarOAuthAuthorizeUrl(origin: string) {
  if (!ENV.googleClientId) {
    throw new Error("Google OAuth Client ID is not configured");
  }
  const redirectUri = `${origin.replace(/\/$/, "")}/api/oauth/google-calendar/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", ENV.googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    ["openid", "email", ...GOOGLE_CALENDAR_OAUTH_SCOPES].join(" ")
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", encodeCalendarOAuthState(redirectUri));
  return url.toString();
}

export function buildGoogleLoginOAuthAuthorizeUrl({
  clientId,
  redirectUri,
  returnTo,
}: {
  clientId: string;
  redirectUri: string;
  returnTo?: string;
}) {
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) {
    throw new Error("Google OAuth Client ID is not configured");
  }

  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", normalizedClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set(
    "state",
    encodeLoginOAuthState({
      redirectUri,
      returnTo: safePublicReturnTo(returnTo),
    })
  );
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function logOAuthEvent({
  action,
  targetId = 0,
  actor = null,
  metadata,
  beforeValue,
  afterValue,
  req,
}: {
  action: string;
  targetId?: number;
  actor?: number | string | null;
  metadata?: Record<string, unknown>;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  req: Request;
}) {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]
      ?.trim() ??
    req.socket?.remoteAddress ??
    undefined;
  const userAgent = req.headers["user-agent"] ?? undefined;

  await db.createActivityLog({
    userId: targetId,
    action,
    targetType: "user",
    targetId,
    details: oauthLogDetails({
      actor,
      targetId,
      beforeValue,
      afterValue,
      metadata,
    }),
    ipAddress,
    userAgent,
  });
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/signin", (req: Request, res: Response) => {
    const expectedRedirectUri = getExpectedRedirectUri(req);
    if (!expectedRedirectUri) {
      res.status(400).json({ error: "OAuth redirect URI is unavailable" });
      return;
    }

    try {
      const callbackUrl =
        getQueryParam(req, "callbackUrl") ?? getQueryParam(req, "returnTo");
      res.redirect(
        302,
        buildGoogleLoginOAuthAuthorizeUrl({
          clientId: ENV.googleClientId,
          redirectUri: expectedRedirectUri,
          returnTo: callbackUrl,
        })
      );
    } catch {
      res.status(503).json({ error: "Google OAuth is not configured" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const expectedRedirectUri = getExpectedRedirectUri(req);
    const loginState = state ? decodeLoginOAuthState(state) : null;

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    if (!expectedRedirectUri || loginState?.redirectUri !== expectedRedirectUri) {
      await logOAuthEvent({
        action: "LOGIN_BLOCKED",
        metadata: { reason: "state_mismatch" },
        req,
      });
      res.status(403).json({ error: "OAuth state validation failed" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeGoogleCodeForToken(
        code,
        expectedRedirectUri
      );
      const userInfo = await sdk.getGoogleUserInfo(tokenResponse.access_token);

      let sessionToken: string;
      let loggedInUser: User;
      try {
        const result = await completeGoogleLoginWithUserInfo(userInfo, req);
        sessionToken = result.sessionToken;
        loggedInUser = result.user;
      } catch (e) {
        if (e instanceof GoogleLoginError) {
          await logOAuthEvent({
            action: "LOGIN_BLOCKED",
            metadata: { reason: "google_login_flow", message: e.message },
            req,
          });
          res.status(e.statusCode).json({ error: e.message });
          return;
        }
        throw e;
      }

      const normalizedEmail = normalizeEmail(userInfo.email!);

      await logOAuthEvent({
        action: "USER_LOGIN",
        targetId: loggedInUser.id,
        actor: loggedInUser.id,
        metadata: {
          email: normalizedEmail,
          loginMethod: "google",
        },
        req,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(302, loginState.returnTo);
    } catch (error) {
      await logOAuthEvent({
        action: "LOGIN_BLOCKED",
        metadata: { reason: "google_oauth_failed" },
        req,
      });
      console.error("[OAuth] Google callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });

  app.get(
    "/api/oauth/google-calendar/callback",
    async (req: Request, res: Response) => {
      const code = getQueryParam(req, "code");
      const state = getQueryParam(req, "state");
      const expectedRedirectUri = getCalendarRedirectUri(req);
      const stateRedirectUri = state ? decodeCalendarOAuthState(state) : null;

      if (!code || !state || !expectedRedirectUri) {
        res.status(400).json({ error: "code and state are required" });
        return;
      }

      if (stateRedirectUri !== expectedRedirectUri) {
        res.status(403).json({ error: "OAuth state validation failed" });
        return;
      }

      try {
        let user: User;
        try {
          user = await sdk.authenticateRequest(req);
        } catch (error) {
          res.status(401).json({ error: "Login required" });
          return;
        }

        if (user.role !== "branch_admin" || user.accountStatus !== "active") {
          res.status(403).json({ error: "Branch admin access required" });
          return;
        }

        const tokenResponse = await exchangeGoogleCalendarAuthCode(
          code,
          expectedRedirectUri
        );
        if (!tokenResponse.refreshToken) {
          res.status(400).json({
            error:
              "Google refresh token was not issued. Reconnect with consent prompt.",
          });
          return;
        }

        await storeGoogleCalendarRefreshToken(
          tokenResponse.refreshToken,
          user.id,
          tokenResponse.scope
        );

        await db.createActivityLog({
          userId: user.id,
          action: "GOOGLE_CALENDAR_OAUTH_CONNECTED",
          targetType: "google_calendar",
          details: JSON.stringify({
            actor: user.id,
            metadata: { connectedBy: user.id },
          }),
        });

        res.redirect(302, "/google-calendar-integration?connected=1");
      } catch (error) {
        console.error("[OAuth] Google Calendar callback failed", error);
        res
          .status(500)
          .json({ error: "Google Calendar OAuth callback failed" });
      }
    }
  );
}
