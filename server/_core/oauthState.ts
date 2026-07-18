import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { parse as parseCookie } from "cookie";
import type { CookieOptions, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

export const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

export type OAuthStatePurpose = "login" | "google_calendar";

type OAuthStatePayload = {
  purpose: OAuthStatePurpose;
  nonce: string;
  expiresAt: number;
};

type OAuthStateValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_state"
        | "missing_cookie"
        | "invalid_cookie"
        | "expired_state"
        | "state_mismatch"
        | "state_consumed"
        | "state_store_unavailable";
    };

const STATE_COOKIE_CONFIG: Record<
  OAuthStatePurpose,
  { name: string; path: string }
> = {
  login: {
    name: "boa_oauth_state_login",
    path: "/api/oauth/callback",
  },
  google_calendar: {
    name: "boa_oauth_state_google_calendar",
    path: "/api/oauth/google-calendar/callback",
  },
};

function getSigningSecret() {
  const secret = ENV.cookieSecret.trim();
  if (!secret) throw new Error("OAuth state signing is not configured");
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function digestNonce(nonce: string) {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

function encodePayload(payload: OAuthStatePayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decodePayload(value: string): OAuthStatePayload | null {
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex <= 0) return null;

  const encodedPayload = value.slice(0, separatorIndex);
  const providedSignature = value.slice(separatorIndex + 1);
  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return null;
  }
  if (!safeEqual(providedSignature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<OAuthStatePayload>;
    if (
      (parsed.purpose !== "login" && parsed.purpose !== "google_calendar") ||
      typeof parsed.nonce !== "string" ||
      parsed.nonce.length < 22 ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }
    return parsed as OAuthStatePayload;
  } catch {
    return null;
  }
}

function getCookieOptions(
  req: Request,
  purpose: OAuthStatePurpose
): CookieOptions {
  const sessionOptions = getSessionCookieOptions(req);
  return {
    ...sessionOptions,
    path: STATE_COOKIE_CONFIG[purpose].path,
    secure: ENV.isProduction ? true : sessionOptions.secure,
    maxAge: OAUTH_STATE_TTL_MS,
  };
}

function clearStateCookie(
  req: Request,
  res: Response,
  purpose: OAuthStatePurpose
) {
  const { maxAge: _maxAge, ...clearOptions } = getCookieOptions(req, purpose);
  res.clearCookie(STATE_COOKIE_CONFIG[purpose].name, clearOptions);
}

function readStateCookie(req: Request, purpose: OAuthStatePurpose) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  return parseCookie(cookieHeader)[STATE_COOKIE_CONFIG[purpose].name];
}

export async function issueOAuthState(
  req: Request,
  res: Response,
  purpose: OAuthStatePurpose,
  now = Date.now()
) {
  const nonce = randomBytes(32).toString("base64url");
  const expiresAt = now + OAUTH_STATE_TTL_MS;
  const cookieValue = encodePayload({
    purpose,
    nonce,
    expiresAt,
  });
  try {
    await db.insertOAuthStateNonce({
      nonceDigest: digestNonce(nonce),
      purpose,
      expiresAt: new Date(expiresAt),
    });
  } catch (error) {
    clearStateCookie(req, res, purpose);
    throw error;
  }
  res.cookie(
    STATE_COOKIE_CONFIG[purpose].name,
    cookieValue,
    getCookieOptions(req, purpose)
  );
  return nonce;
}

export async function consumeOAuthState(
  req: Request,
  res: Response,
  purpose: OAuthStatePurpose,
  presentedState: string | undefined,
  now = Date.now()
): Promise<OAuthStateValidationResult> {
  try {
    const cookieValue = readStateCookie(req, purpose);
    if (!presentedState) return { ok: false, reason: "missing_state" };
    if (!cookieValue) return { ok: false, reason: "missing_cookie" };

    const payload = decodePayload(cookieValue);
    if (!payload || payload.purpose !== purpose) {
      return { ok: false, reason: "invalid_cookie" };
    }
    if (payload.expiresAt <= now) {
      return { ok: false, reason: "expired_state" };
    }
    if (!safeEqual(payload.nonce, presentedState)) {
      return { ok: false, reason: "state_mismatch" };
    }

    try {
      const consumed = await db.consumeOAuthStateNonce({
        nonceDigest: digestNonce(payload.nonce),
        purpose,
      });
      return consumed ? { ok: true } : { ok: false, reason: "state_consumed" };
    } catch {
      return { ok: false, reason: "state_store_unavailable" };
    }
  } finally {
    clearStateCookie(req, res, purpose);
  }
}
