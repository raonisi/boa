import type { Express, Request, Response } from "express";
import axios from "axios";
import { z } from "zod";
import { HttpError } from "@shared/_core/errors";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { GoogleLoginError, completeGoogleLoginWithUserInfo } from "./_core/googleLoginFlow";
import { sdk, type GoogleUserInfo } from "./_core/sdk";
import { createActivityLog, upsertUserDeviceToken } from "./db";
import { hashDeviceToken, maskDeviceToken } from "./deviceTokenUtil";

const googleIdTokenBody = z.object({
  idToken: z.string().min(10),
});

const deviceRegisterBody = z.object({
  token: z.string().min(20).max(512),
  platform: z.enum(["android"]).default("android"),
  deviceId: z.string().max(128).optional(),
  appVersion: z.string().max(50).optional(),
  deviceModel: z.string().max(200).optional(),
  osVersion: z.string().max(100).optional(),
});

function serializePublicUser(user: {
  id: number;
  name: string | null;
  email: string | null;
  role: string | null;
  accountStatus: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
  };
}

async function getAuthenticatedUser(req: Request) {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

/**
 * Flutter 등 네이티브 클라이언트용 JSON API (쿠키 또는 `Authorization: Bearer` 세션).
 * tRPC/superjson 없이 동일 서버 로직을 재사용합니다.
 */
export function registerMobileRoutes(app: Express) {
  app.post("/api/mobile/auth/google", async (req: Request, res: Response) => {
    const parsed = googleIdTokenBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }
    const { idToken } = parsed.data;
    try {
      const { data } = await axios.get<Record<string, unknown>>(
        "https://oauth2.googleapis.com/tokeninfo",
        { params: { id_token: idToken }, timeout: 10_000 }
      );
      const aud = typeof data.aud === "string" ? data.aud : "";
      if (!ENV.googleClientId || aud !== ENV.googleClientId.trim()) {
        res.status(403).json({ error: "Invalid id_token audience" });
        return;
      }
      const userInfo: GoogleUserInfo = {
        sub: String(data.sub ?? ""),
        name: typeof data.name === "string" ? data.name : undefined,
        email: typeof data.email === "string" ? data.email : undefined,
        email_verified: data.email_verified === true || data.email_verified === "true",
      };
      const { sessionToken, user } = await completeGoogleLoginWithUserInfo(userInfo, req);
      res.json({
        sessionToken,
        user: serializePublicUser(user),
      });
    } catch (e) {
      if (e instanceof GoogleLoginError) {
        res.status(e.statusCode).json({ error: e.message });
        return;
      }
      console.error("[mobile] Google id_token login failed", e);
      res.status(500).json({ error: "Google login failed" });
    }
  });

  app.get("/api/mobile/auth/me", async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ user: serializePublicUser(user) });
  });

  app.post("/api/mobile/device-tokens/register", async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user || user.accountStatus !== "active") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = deviceRegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const input = parsed.data;
    const saved = await upsertUserDeviceToken({
      userId: user.id,
      platform: "android",
      token: input.token,
      deviceId: input.deviceId ?? null,
      appVersion: input.appVersion ?? null,
      deviceModel: input.deviceModel ?? null,
      osVersion: input.osVersion ?? null,
      isActive: true,
      lastSeenAt: new Date(),
    });
    const tokenHash = hashDeviceToken(input.token);
    await createActivityLog({
      userId: user.id,
      action: "DEVICE_TOKEN_REGISTERED",
      targetType: "user_device_token",
      targetId: saved?.id,
      details: JSON.stringify({
        actor: user.id,
        targetId: saved?.id ?? null,
        targetType: "user_device_token",
        beforeValue: null,
        afterValue: null,
        metadata: {
          platform: "android",
          tokenHash,
          tokenMasked: maskDeviceToken(input.token),
          deviceId: input.deviceId ?? null,
          appVersion: input.appVersion ?? null,
        },
      }),
    });
    res.json({ success: true, id: saved?.id ?? null, tokenMasked: maskDeviceToken(input.token) });
  });

  app.get("/api/mobile/customers", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (e) {
      if (e instanceof HttpError && e.statusCode === 403) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      throw e;
    }
    const ctx: TrpcContext = { req, res, user };
    const caller = appRouter.createCaller(ctx);
    try {
      const items = await caller.customers.list({});
      res.json({ items });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to list customers";
      res.status(400).json({ error: msg });
    }
  });
}
