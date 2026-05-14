import { ONE_YEAR_MS } from "@shared/const";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { sdk, type GoogleUserInfo } from "./sdk";

export class GoogleLoginError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "GoogleLoginError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getGoogleOpenId(userInfo: GoogleUserInfo) {
  return userInfo.sub;
}

/**
 * 웹 OAuth 콜백과 동일한 규칙으로 Google 사용자 정보를 검증하고 세션 JWT를 발급합니다.
 * 모바일 `id_token` 로그인에서도 재사용합니다.
 */
export async function completeGoogleLoginWithUserInfo(
  userInfo: GoogleUserInfo,
  req?: Request
): Promise<{ sessionToken: string; user: User }> {
  const googleOpenId = getGoogleOpenId(userInfo);

  if (!googleOpenId) {
    throw new GoogleLoginError(400, "Google user id missing from user info");
  }

  if (!userInfo.email) {
    throw new GoogleLoginError(403, "사전 등록된 이메일 계정만 로그인할 수 있습니다.");
  }

  const normalizedEmail = normalizeEmail(userInfo.email);

  if (userInfo.email_verified !== true) {
    throw new GoogleLoginError(403, "Google 이메일 인증이 완료된 계정만 로그인할 수 있습니다.");
  }

  const matchingUsers = await db.getAllUsersByEmail(normalizedEmail);

  if (matchingUsers.length !== 1) {
    throw new GoogleLoginError(
      403,
      "사전 등록된 활성 사용자만 로그인할 수 있습니다."
    );
  }

  const preRegisteredUser = matchingUsers[0];
  if (preRegisteredUser.accountStatus !== "active") {
    throw new GoogleLoginError(403, "계정이 비활성화되어 로그인할 수 없습니다. 관리자에게 문의하세요.");
  }

  const isInvited =
    preRegisteredUser.loginStatus === "invited" &&
    (!preRegisteredUser.openId || preRegisteredUser.openId.startsWith("invited_"));
  const isAlreadyLinkedToThisOpenId = preRegisteredUser.openId === googleOpenId;

  if (!isInvited && !isAlreadyLinkedToThisOpenId) {
    throw new GoogleLoginError(403, "이미 다른 Google 계정과 연결된 사용자입니다.");
  }

  if (isInvited) {
    const alreadyLinked = await db.getUserByOpenId(googleOpenId);
    if (alreadyLinked && alreadyLinked.id !== preRegisteredUser.id) {
      throw new GoogleLoginError(403, "이미 다른 사용자와 연결된 Google 계정입니다.");
    }

    await db.linkUserOpenId(preRegisteredUser.id, googleOpenId);
    if (req) {
      const ipAddress =
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        req.socket?.remoteAddress ??
        undefined;
      const userAgent = req.headers["user-agent"] as string | undefined;
      await db.createActivityLog({
        userId: preRegisteredUser.id,
        action: "USER_OAUTH_LINKED",
        targetType: "user",
        targetId: preRegisteredUser.id,
        details: JSON.stringify({
          actor: preRegisteredUser.id,
          targetId: preRegisteredUser.id,
          targetType: "user",
          beforeValue: { loginStatus: preRegisteredUser.loginStatus },
          afterValue: { loginStatus: "linked" },
          metadata: { email: normalizedEmail, provider: "google" },
        }),
        ipAddress,
        userAgent,
      });
    }
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
    throw new GoogleLoginError(403, "계정이 비활성화되어 로그인할 수 없습니다. 관리자에게 문의하세요.");
  }

  const sessionToken = await sdk.createSessionToken(googleOpenId, {
    name: userInfo.name || loggedInUser.name || "",
    expiresInMs: ONE_YEAR_MS,
  });

  return { sessionToken, user: loggedInUser };
}
