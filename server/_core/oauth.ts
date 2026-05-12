import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
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

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? undefined;
      const userAgent = req.headers["user-agent"] ?? undefined;

      if (!userInfo.email) {
        await db.createActivityLog({
          userId: 0,
          action: "LOGIN_BLOCKED",
          targetType: "user",
          targetId: 0,
          details: oauthLogDetails({ metadata: { reason: "missing_email" } }),
          ipAddress,
          userAgent,
        });
        res.status(403).json({ error: "사전 등록된 이메일 계정만 로그인할 수 있습니다." });
        return;
      }

      const normalizedEmail = normalizeEmail(userInfo.email);
      const matchingUsers = await db.getAllUsersByEmail(normalizedEmail);

      if (matchingUsers.length !== 1) {
        if (matchingUsers.length > 1) {
          await db.createActivityLog({
            userId: 0,
            action: "USER_OAUTH_LINK_CONFLICT",
            targetType: "user",
            targetId: 0,
            details: oauthLogDetails({
              metadata: { email: normalizedEmail, conflictCount: matchingUsers.length, reason: "duplicate_email_records" },
            }),
            ipAddress,
            userAgent,
          });
        }
        await db.createActivityLog({
          userId: 0,
          action: "LOGIN_BLOCKED",
          targetType: "user",
          targetId: 0,
          details: oauthLogDetails({
            metadata: { email: normalizedEmail, reason: matchingUsers.length === 0 ? "not_pre_registered" : "duplicate_email_records" },
          }),
          ipAddress,
          userAgent,
        });
        res.status(403).json({ error: "사전 등록된 활성 사용자만 로그인할 수 있습니다." });
        return;
      }

      const preRegisteredUser = matchingUsers[0];
      if (preRegisteredUser.accountStatus !== "active") {
        await db.createActivityLog({
          userId: preRegisteredUser.id,
          action: "LOGIN_BLOCKED",
          targetType: "user",
          targetId: preRegisteredUser.id,
          details: oauthLogDetails({
            actor: preRegisteredUser.id,
            targetId: preRegisteredUser.id,
            metadata: { email: normalizedEmail, reason: "account_inactive", accountStatus: preRegisteredUser.accountStatus },
          }),
          ipAddress,
          userAgent,
        });
        res.status(403).json({ error: "계정이 비활성화되어 로그인할 수 없습니다. 관리자에게 문의하세요." });
        return;
      }

      const isInvited = preRegisteredUser.openId.startsWith("invited_") && preRegisteredUser.loginStatus === "invited";
      const isAlreadyLinkedToThisOpenId = preRegisteredUser.openId === userInfo.openId;

      if (!isInvited && !isAlreadyLinkedToThisOpenId) {
        await db.createActivityLog({
          userId: preRegisteredUser.id,
          action: "USER_OAUTH_LINK_CONFLICT",
          targetType: "user",
          targetId: preRegisteredUser.id,
          details: oauthLogDetails({
            actor: preRegisteredUser.id,
            targetId: preRegisteredUser.id,
            metadata: { email: normalizedEmail, reason: "open_id_already_linked" },
          }),
          ipAddress,
          userAgent,
        });
        res.status(403).json({ error: "이미 다른 OAuth 계정과 연결된 사용자입니다." });
        return;
      }

      if (isInvited) {
        const alreadyLinked = await db.getUserByOpenId(userInfo.openId);
        if (alreadyLinked && alreadyLinked.id !== preRegisteredUser.id) {
          await db.createActivityLog({
            userId: preRegisteredUser.id,
            action: "USER_OAUTH_LINK_CONFLICT",
            targetType: "user",
            targetId: preRegisteredUser.id,
            details: oauthLogDetails({
              actor: preRegisteredUser.id,
              targetId: preRegisteredUser.id,
              metadata: { email: normalizedEmail, reason: "open_id_used_by_another_user" },
            }),
            ipAddress,
            userAgent,
          });
          res.status(403).json({ error: "이미 다른 사용자와 연결된 OAuth 계정입니다." });
          return;
        }

        await db.linkUserOpenId(preRegisteredUser.id, userInfo.openId);
        await db.createActivityLog({
          userId: preRegisteredUser.id,
          action: "USER_OAUTH_LINKED",
          targetType: "user",
          targetId: preRegisteredUser.id,
          details: oauthLogDetails({
            actor: preRegisteredUser.id,
            targetId: preRegisteredUser.id,
            beforeValue: { loginStatus: preRegisteredUser.loginStatus },
            afterValue: { loginStatus: "linked" },
            metadata: { email: normalizedEmail },
          }),
          ipAddress,
          userAgent,
        });
      }

      // 사전 등록 및 연결 검증을 통과한 사용자만 최신 로그인 정보를 갱신한다.
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: normalizedEmail,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // 로그인 활동 로그 기록 및 퇴사자 서버 레벨 차단
      const loggedInUser = await db.getUserByOpenId(userInfo.openId);

      if (loggedInUser) {
        // 퇴사자(비활성) 서버 레벨 차단
        if (loggedInUser.accountStatus !== "active") {
        await db.createActivityLog({
          userId: loggedInUser.id,
          action: "LOGIN_BLOCKED",
          targetType: "user",
          targetId: loggedInUser.id,
          details: oauthLogDetails({
            actor: loggedInUser.id,
            targetId: loggedInUser.id,
            metadata: {
              email: normalizedEmail,
              reason: "account_inactive",
              loginMethod: userInfo.loginMethod ?? userInfo.platform ?? "unknown",
            },
          }),
          ipAddress,
          userAgent,
        });
          res.status(403).json({ error: "계정이 비활성화되어 로그인할 수 없습니다. 관리자에게 문의하세요." });
          return;
        }

        // 정상 로그인 로그 기록
        await db.createActivityLog({
          userId: loggedInUser.id,
          action: "USER_LOGIN",
          targetType: "user",
          targetId: loggedInUser.id,
          details: oauthLogDetails({
            actor: loggedInUser.id,
            targetId: loggedInUser.id,
            metadata: {
              email: normalizedEmail,
              loginMethod: userInfo.loginMethod ?? userInfo.platform ?? "unknown",
            },
          }),
          ipAddress,
          userAgent,
        });
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
