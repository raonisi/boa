import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk, type GoogleUserInfo } from "./sdk";

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

function getGoogleOpenId(userInfo: GoogleUserInfo) {
  return userInfo.sub;
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
      const googleOpenId = getGoogleOpenId(userInfo);

      if (!googleOpenId) {
        res.status(400).json({ error: "Google user id missing from user info" });
        return;
      }

      if (!userInfo.email) {
        await logOAuthEvent({
          action: "LOGIN_BLOCKED",
          metadata: { reason: "missing_email" },
          req,
        });
        res.status(403).json({ error: "사전 등록된 이메일 계정만 로그인할 수 있습니다." });
        return;
      }

      const normalizedEmail = normalizeEmail(userInfo.email);

      if (userInfo.email_verified !== true) {
        await logOAuthEvent({
          action: "LOGIN_BLOCKED",
          metadata: { email: normalizedEmail, reason: "google_email_not_verified" },
          req,
        });
        res.status(403).json({ error: "Google 이메일 인증이 완료된 계정만 로그인할 수 있습니다." });
        return;
      }

      const matchingUsers = await db.getAllUsersByEmail(normalizedEmail);

      if (matchingUsers.length !== 1) {
        if (matchingUsers.length > 1) {
          await logOAuthEvent({
            action: "USER_OAUTH_LINK_CONFLICT",
            metadata: { email: normalizedEmail, conflictCount: matchingUsers.length, reason: "duplicate_email_records" },
            req,
          });
        }
        await logOAuthEvent({
          action: "LOGIN_BLOCKED",
          metadata: { email: normalizedEmail, reason: matchingUsers.length === 0 ? "not_pre_registered" : "duplicate_email_records" },
          req,
        });
        res.status(403).json({ error: "사전 등록된 활성 사용자만 로그인할 수 있습니다." });
        return;
      }

      const preRegisteredUser = matchingUsers[0];
      if (preRegisteredUser.accountStatus !== "active") {
        await logOAuthEvent({
          action: "LOGIN_BLOCKED",
          targetId: preRegisteredUser.id,
          actor: preRegisteredUser.id,
          metadata: { email: normalizedEmail, reason: "account_inactive", accountStatus: preRegisteredUser.accountStatus },
          req,
        });
        res.status(403).json({ error: "계정이 비활성화되어 로그인할 수 없습니다. 관리자에게 문의하세요." });
        return;
      }

      const isInvited =
        preRegisteredUser.loginStatus === "invited" &&
        (!preRegisteredUser.openId || preRegisteredUser.openId.startsWith("invited_"));
      const isAlreadyLinkedToThisOpenId = preRegisteredUser.openId === googleOpenId;

      if (!isInvited && !isAlreadyLinkedToThisOpenId) {
        await logOAuthEvent({
          action: "USER_OAUTH_LINK_CONFLICT",
          targetId: preRegisteredUser.id,
          actor: preRegisteredUser.id,
          metadata: { email: normalizedEmail, reason: "open_id_already_linked" },
          req,
        });
        res.status(403).json({ error: "이미 다른 Google 계정과 연결된 사용자입니다." });
        return;
      }

      if (isInvited) {
        const alreadyLinked = await db.getUserByOpenId(googleOpenId);
        if (alreadyLinked && alreadyLinked.id !== preRegisteredUser.id) {
          await logOAuthEvent({
            action: "USER_OAUTH_LINK_CONFLICT",
            targetId: preRegisteredUser.id,
            actor: preRegisteredUser.id,
            metadata: { email: normalizedEmail, reason: "open_id_used_by_another_user" },
            req,
          });
          res.status(403).json({ error: "이미 다른 사용자와 연결된 Google 계정입니다." });
          return;
        }

        await db.linkUserOpenId(preRegisteredUser.id, googleOpenId);
        await logOAuthEvent({
          action: "USER_OAUTH_LINKED",
          targetId: preRegisteredUser.id,
          actor: preRegisteredUser.id,
          beforeValue: { loginStatus: preRegisteredUser.loginStatus },
          afterValue: { loginStatus: "linked" },
          metadata: { email: normalizedEmail, provider: "google" },
          req,
        });
      }

      await db.upsertUser({
        openId: googleOpenId,
        name: userInfo.name || preRegisteredUser.name || null,
        email: normalizedEmail,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const loggedInUser = await db.getUserByOpenId(googleOpenId);

      if (!loggedInUser || loggedInUser.accountStatus !== "active") {
        await logOAuthEvent({
          action: "LOGIN_BLOCKED",
          targetId: loggedInUser?.id ?? preRegisteredUser.id,
          actor: loggedInUser?.id ?? preRegisteredUser.id,
          metadata: {
            email: normalizedEmail,
            reason: "account_inactive",
            loginMethod: "google",
          },
          req,
        });
        res.status(403).json({ error: "계정이 비활성화되어 로그인할 수 없습니다. 관리자에게 문의하세요." });
        return;
      }

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

      const sessionToken = await sdk.createSessionToken(googleOpenId, {
        name: userInfo.name || loggedInUser.name || "",
        expiresInMs: ONE_YEAR_MS,
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
