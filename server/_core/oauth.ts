import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { User } from "../../drizzle/schema";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { GoogleLoginError, completeGoogleLoginWithUserInfo } from "./googleLoginFlow";
import { sdk } from "./sdk";

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

function getRequestOrigin(req: Request) {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.headers.host;

  return host ? `${proto}://${host}` : null;
}

function getExpectedRedirectUri(req: Request) {
  if (ENV.googleRedirectUri) return ENV.googleRedirectUri.trim();
  const origin = getRequestOrigin(req);
  return origin ? `${origin}/api/oauth/callback` : null;
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
  const ipAddress = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? undefined;
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
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const expectedRedirectUri = getExpectedRedirectUri(req);
    const stateRedirectUri = state ? decodeState(state) : null;

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    if (!expectedRedirectUri || stateRedirectUri !== expectedRedirectUri) {
      await logOAuthEvent({
        action: "LOGIN_BLOCKED",
        metadata: { reason: "state_mismatch" },
        req,
      });
      res.status(403).json({ error: "OAuth state validation failed" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeGoogleCodeForToken(code, expectedRedirectUri);
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
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
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
}
