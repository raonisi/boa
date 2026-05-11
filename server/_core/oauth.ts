import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
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

      // 조건 3: 이메일 기반 사전 등록 사용자 매핑
      // 사전 등록된 invited 레코드가 있으면 해당 레코드에 openId를 직접 연결
      if (userInfo.email) {
        const existingByEmail = await db.getUserByEmail(userInfo.email);
        if (
          existingByEmail &&
          existingByEmail.openId.startsWith("invited_") && // 사전 등록 레코드 (가짜 openId)
          existingByEmail.accountStatus === "active" &&
          existingByEmail.loginStatus === "invited"
        ) {
          // 동일 openId가 이미 다른 레코드에 연결되어 있는지 확인
          const alreadyLinked = await db.getUserByOpenId(userInfo.openId);
          if (!alreadyLinked) {
            // 안전하게 기존 invited 레코드에 openId 직접 연결
            await db.linkUserOpenId(existingByEmail.id, userInfo.openId);
            await db.createActivityLog({
              userId: existingByEmail.id,
              action: "USER_OAUTH_LINKED",
              targetType: "user",
              targetId: existingByEmail.id,
              details: JSON.stringify({ email: userInfo.email }),
              ipAddress,
              userAgent,
            });
          }
        }
      }

      // 기존 upsertUser (신규 사용자 또는 기존 OAuth 사용자 업데이트)
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
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
            details: JSON.stringify({
              email: userInfo.email,
              reason: "account_inactive",
              loginMethod: userInfo.loginMethod ?? userInfo.platform ?? "unknown",
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
          details: JSON.stringify({
            email: userInfo.email,
            loginMethod: userInfo.loginMethod ?? userInfo.platform ?? "unknown",
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
