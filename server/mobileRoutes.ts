import type { Express, Request, Response } from "express";
import axios from "axios";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { HttpError } from "@shared/_core/errors";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import {
  GoogleLoginError,
  completeGoogleLoginWithUserInfo,
} from "./_core/googleLoginFlow";
import { sdk, type GoogleUserInfo } from "./_core/sdk";
import { createActivityLog, upsertUserDeviceToken } from "./db";
import { hashDeviceToken, maskDeviceToken } from "./deviceTokenUtil";
import {
  filterMobileContracts,
  paginateMobileList,
  parseMobileSearchQuery,
} from "./mobileSearchFilters";
import { sanitizeAuthError } from "./authErrorSanitizer";

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

const followUpPostponeBody = z.object({
  nextContactDate: z.string().min(1),
  reason: z.string().optional(),
});

const followUpCreateBody = z.object({
  nextContactDate: z.string().min(1),
  reason: z.string().min(1),
  nextAction: z
    .enum([
      "전화",
      "카톡",
      "문자",
      "방문",
      "설계안 발송",
      "계약 확인",
      "보장분석",
      "사후관리",
      "기타",
    ])
    .optional(),
  memo: z.string().optional(),
});

const contractCreateBody = z.object({
  company: z.string().max(200).optional(),
  productName: z.string().max(200).optional(),
  productGroup: z.string().max(100).optional(),
  contractDate: z.string().optional(),
  monthlyPremium: z.coerce.number().int().nonnegative().optional(),
  paymentStatus: z.enum(["정상", "미납", "실효", "해지"]).optional(),
  contractStatus: z.enum(["청약", "성립", "철회", "유지", "해지"]).optional(),
  memo: z.string().max(2000).optional(),
  agentIdOverride: z.coerce.number().int().positive().optional(),
});

const scheduleCreateBody = z.object({
  title: z.string().min(1),
  type: z.enum([
    "고객상담",
    "재통화",
    "계약예정",
    "보장분석",
    "해지방어",
    "팀회의",
    "교육",
    "외근",
    "휴무",
    "기타",
  ]),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  memo: z.string().optional(),
  description: z.string().optional(),
  reminderDayBefore: z.boolean().optional(),
  reminderSameDay: z.boolean().optional(),
  reminderOneHourBefore: z.boolean().optional(),
  reminderOffsetMinutes: z
    .union([
      z.literal(-1),
      z.literal(0),
      z.literal(30),
      z.literal(60),
      z.literal(120),
      z.literal(180),
      z.literal(1440),
    ])
    .optional(),
});

const pushPrefsPatchBody = z.object({
  followUpTodayEnabled: z.boolean().optional(),
  scheduleReminderEnabled: z.boolean().optional(),
  deleteRequestEnabled: z.boolean().optional(),
  testNotificationEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  timezone: z.string().max(64).optional(),
});

const performanceStatsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  agentIdFilter: z.coerce.number().int().optional(),
  teamIdFilter: z.coerce.number().int().optional(),
  productGroup: z.string().optional(),
  company: z.string().optional(),
  region: z.string().optional(),
  source: z.string().optional(),
  scope: z.enum(["all", "mine"]).optional(),
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

/** 모바일 라우트용: 세션이 없으면 401 응답 후 `null`. */
function getBearerSessionToken(req: Request) {
  const auth = req.headers.authorization;
  if (typeof auth !== "string" || !auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}

function getSafeWebRedirect(req: Request) {
  const raw =
    typeof req.query.redirect === "string" ? req.query.redirect.trim() : "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/";
  }
  return raw;
}

async function getMobileCaller(req: Request, res: Response) {
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (e) {
    if (e instanceof HttpError && e.statusCode === 403) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    throw e;
  }
  const ctx: TrpcContext = { req, res, user };
  return appRouter.createCaller(ctx);
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
        email_verified:
          data.email_verified === true || data.email_verified === "true",
      };
      const { sessionToken, user } = await completeGoogleLoginWithUserInfo(
        userInfo,
        req
      );
      res.json({
        sessionToken,
        user: serializePublicUser(user),
      });
    } catch (e) {
      if (e instanceof GoogleLoginError) {
        res.status(e.statusCode).json({ error: e.message });
        return;
      }
      console.error("[mobile] Google id_token login failed", sanitizeAuthError(e));
      res.status(500).json({ error: "Google login failed" });
    }
  });

  app.get("/api/mobile/web-session", async (req: Request, res: Response) => {
    const sessionToken = getBearerSessionToken(req);
    if (!sessionToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await getAuthenticatedUser(req);
    if (!user || user.accountStatus !== "active") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });
    res.redirect(302, getSafeWebRedirect(req));
  });

  app.get("/api/mobile/auth/me", async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ user: serializePublicUser(user) });
  });

  app.post(
    "/api/mobile/device-tokens/register",
    async (req: Request, res: Response) => {
      const user = await getAuthenticatedUser(req);
      if (!user || user.accountStatus !== "active") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const parsed = deviceRegisterBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.flatten() });
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
      res.json({
        success: true,
        id: saved?.id ?? null,
        tokenMasked: maskDeviceToken(input.token),
      });
    }
  );

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
      const parsedSearch = parseMobileSearchQuery(req.query.search);
      if (!parsedSearch.ok) {
        res.status(400).json({ error: "Invalid search query" });
        return;
      }
      const q = parsedSearch.value;
      const pageSizeParsed =
        req.query.limit === undefined
          ? { success: true as const, data: 50 }
          : z.coerce.number().int().min(1).max(100).safeParse(req.query.limit);
      const offsetParsed =
        req.query.offset === undefined
          ? { success: true as const, data: 0 }
          : z.coerce
              .number()
              .int()
              .min(0)
              .max(500_000)
              .safeParse(req.query.offset);
      if (!pageSizeParsed.success || !offsetParsed.success) {
        res.status(400).json({ error: "Invalid limit or offset" });
        return;
      }
      const pageSize = pageSizeParsed.data;
      const offset = offsetParsed.data;
      const rows = await caller.customers.list(
        q !== undefined ? { search: q } : {}
      );
      const page = paginateMobileList(rows, offset, pageSize);
      res.json({
        items: page.items,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to list customers";
      res.status(400).json({ error: msg });
    }
  });

  /** `/customers/:id` 보다 구체적인 경로이므로 먼저 등록합니다. */
  app.get(
    "/api/mobile/customers/:customerId/contracts",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.customerId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer id" });
        return;
      }
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
        const items = await caller.contracts.listByCustomer({
          customerId: parsedId.data,
        });
        res.json({ items });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to list contracts";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/mobile/customers/:customerId/contracts",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.customerId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer id" });
        return;
      }
      const bodyParsed = contractCreateBody.safeParse(req.body);
      if (!bodyParsed.success) {
        res
          .status(400)
          .json({ error: "Invalid body", details: bodyParsed.error.flatten() });
        return;
      }
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      const d = bodyParsed.data;
      try {
        await caller.contracts.create({
          customerId: parsedId.data,
          company: d.company,
          productName: d.productName,
          productGroup: d.productGroup,
          contractDate: d.contractDate,
          monthlyPremium: d.monthlyPremium,
          paymentStatus: d.paymentStatus ?? "정상",
          contractStatus: d.contractStatus ?? "청약",
          memo: d.memo,
          agentIdOverride: d.agentIdOverride,
        });
        res.json({ success: true });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to create contract";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/users/assignable-agents",
    async (req: Request, res: Response) => {
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
        const users = await caller.users.list({ activeOnly: true });
        const items = users
          .filter(
            u =>
              u.accountStatus === "active" &&
              (u.role === "branch_admin" ||
                u.role === "team_leader" ||
                u.role === "member")
          )
          .map(u => ({
            id: u.id,
            name: u.name,
            role: u.role,
          }));
        res.json({ items });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to list assignable agents";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/customers/:customerId/follow-ups",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.customerId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer id" });
        return;
      }
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
        const items = await caller.followUps.listByCustomer({
          customerId: parsedId.data,
        });
        res.json({ items });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to list follow-ups";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/mobile/customers/:customerId/follow-ups",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.customerId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer id" });
        return;
      }
      const bodyParsed = followUpCreateBody.safeParse(req.body);
      if (!bodyParsed.success) {
        res
          .status(400)
          .json({ error: "nextContactDate and reason are required" });
        return;
      }
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        await caller.followUps.create({
          customerId: parsedId.data,
          nextContactDate: bodyParsed.data.nextContactDate,
          reason: bodyParsed.data.reason,
          nextAction: bodyParsed.data.nextAction ?? "전화",
          memo: bodyParsed.data.memo,
        });
        res.json({ success: true });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to create follow-up";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/customers/:customerId",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.customerId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer id" });
        return;
      }
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
        const customer = await caller.customers.get({ id: parsedId.data });
        res.json({ customer });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load customer";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/dashboard/today-work",
    async (req: Request, res: Response) => {
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
      const dateRaw =
        typeof req.query.date === "string" ? req.query.date.trim() : "";
      try {
        const payload = await caller.dashboard.todayWork(
          dateRaw.length > 0 ? { date: dateRaw } : {}
        );
        res.json(payload);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load dashboard";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get("/api/mobile/contracts", async (req: Request, res: Response) => {
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
    const scopeParsed = z
      .enum(["all", "mine"])
      .optional()
      .safeParse(req.query.scope);
    const parsedSearch = parseMobileSearchQuery(req.query.search);
    if (!parsedSearch.ok) {
      res.status(400).json({ error: "Invalid search query" });
      return;
    }
    const search = parsedSearch.value;
    const pageSizeParsed =
      req.query.limit === undefined
        ? { success: true as const, data: 50 }
        : z.coerce.number().int().min(1).max(100).safeParse(req.query.limit);
    const offsetParsed =
      req.query.offset === undefined
        ? { success: true as const, data: 0 }
        : z.coerce
            .number()
            .int()
            .min(0)
            .max(500_000)
            .safeParse(req.query.offset);
    if (!pageSizeParsed.success || !offsetParsed.success) {
      res.status(400).json({ error: "Invalid limit or offset" });
      return;
    }
    const pageSize = pageSizeParsed.data;
    const offset = offsetParsed.data;
    const listInput = {
      ...(scopeParsed.success && scopeParsed.data !== undefined
        ? { scope: scopeParsed.data }
        : {}),
    };
    try {
      let rows = await caller.contracts.list(listInput);
      if (search !== undefined) {
        rows = filterMobileContracts(rows, search);
      }
      const page = paginateMobileList(rows, offset, pageSize);
      res.json({
        items: page.items,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to list contracts";
      res.status(400).json({ error: msg });
    }
  });

  app.get(
    "/api/mobile/notifications/unread-count",
    async (req: Request, res: Response) => {
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
        const count = await caller.notifications.unreadCount();
        res.json({ count });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to read unread count";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get("/api/mobile/notifications", async (req: Request, res: Response) => {
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
    const limitParsed = z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .safeParse(req.query.limit);
    const offsetParsed = z.coerce
      .number()
      .int()
      .min(0)
      .safeParse(req.query.offset);
    const listInput = {
      limit: limitParsed.success ? limitParsed.data : 50,
      offset: offsetParsed.success ? offsetParsed.data : 0,
      isRead:
        req.query.isRead === "true"
          ? true
          : req.query.isRead === "false"
            ? false
            : undefined,
    };
    try {
      const items = await caller.notifications.list(listInput);
      res.json({ items });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to list notifications";
      res.status(400).json({ error: msg });
    }
  });

  app.post(
    "/api/mobile/notifications/:notificationId/read",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.notificationId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid notification id" });
        return;
      }
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
        await caller.notifications.markRead({ id: parsedId.data });
        res.json({ success: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to mark read";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get("/api/mobile/schedules", async (req: Request, res: Response) => {
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
    const scheduleListQuery = z.object({
      viewMode: z
        .enum(["mine", "user", "team", "organization"])
        .default("mine"),
      ownerUserId: z.coerce.number().int().positive().optional(),
      teamId: z.coerce.number().int().positive().optional(),
    });
    const parsedQuery = scheduleListQuery.safeParse(req.query);
    if (!parsedQuery.success) {
      res
        .status(400)
        .json({ error: "Invalid query", details: parsedQuery.error.flatten() });
      return;
    }
    const ctx: TrpcContext = { req, res, user };
    const caller = appRouter.createCaller(ctx);
    try {
      const q = parsedQuery.data;
      const result = await caller.schedules.list({
        viewMode: q.viewMode,
        ...(q.ownerUserId != null ? { ownerUserId: q.ownerUserId } : {}),
        ...(q.teamId != null ? { teamId: q.teamId } : {}),
      });
      res.json({
        items: result.schedules,
        users: result.users,
        teams: result.teams,
        organizationViewWarning: result.organizationViewWarning ?? null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to list schedules";
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/mobile/schedules", async (req: Request, res: Response) => {
    const bodyParsed = scheduleCreateBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", details: bodyParsed.error.flatten() });
      return;
    }
    const caller = await getMobileCaller(req, res);
    if (!caller) return;
    const d = bodyParsed.data;
    try {
      await caller.schedules.create({
        title: d.title,
        type: d.type,
        startTime: d.startTime,
        endTime: d.endTime,
        memo: d.memo,
        description: d.description,
        reminderDayBefore: d.reminderDayBefore ?? true,
        reminderSameDay: d.reminderSameDay ?? true,
        reminderOneHourBefore: d.reminderOneHourBefore ?? true,
        reminderOffsetMinutes: d.reminderOffsetMinutes ?? 30,
      });
      res.json({ success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create schedule";
      res.status(400).json({ error: msg });
    }
  });

  app.get(
    "/api/mobile/follow-ups/today",
    async (req: Request, res: Response) => {
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
      const dateRaw =
        typeof req.query.date === "string" ? req.query.date.trim() : "";
      try {
        const items = await caller.followUps.listToday(
          dateRaw.length > 0 ? { date: dateRaw } : {}
        );
        res.json({ items });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to list today follow-ups";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/follow-ups/overdue",
    async (req: Request, res: Response) => {
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
      const dateRaw =
        typeof req.query.date === "string" ? req.query.date.trim() : "";
      try {
        const items = await caller.followUps.listOverdue(
          dateRaw.length > 0 ? { date: dateRaw } : {}
        );
        res.json({ items });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to list overdue follow-ups";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/mobile/follow-ups/:followUpId/complete",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.followUpId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid follow-up id" });
        return;
      }
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        await caller.followUps.complete({ id: parsedId.data });
        res.json({ success: true });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to complete follow-up";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/mobile/follow-ups/:followUpId/postpone",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.followUpId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid follow-up id" });
        return;
      }
      const bodyParsed = followUpPostponeBody.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({ error: "nextContactDate is required" });
        return;
      }
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        await caller.followUps.postpone({
          id: parsedId.data,
          nextContactDate: bodyParsed.data.nextContactDate,
          reason: bodyParsed.data.reason,
        });
        res.json({ success: true });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to postpone follow-up";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/mobile/follow-ups/:followUpId/cancel",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.followUpId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid follow-up id" });
        return;
      }
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        await caller.followUps.cancel({ id: parsedId.data });
        res.json({ success: true });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to cancel follow-up";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/mobile/schedules/:scheduleId/complete",
    async (req: Request, res: Response) => {
      const parsedId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.scheduleId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid schedule id" });
        return;
      }
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        await caller.schedules.update({ id: parsedId.data, status: "완료" });
        res.json({ success: true });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to complete schedule";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/performance/stats",
    async (req: Request, res: Response) => {
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      const q = performanceStatsQuerySchema.safeParse(req.query);
      const input =
        q.success && Object.values(q.data).some(v => v !== undefined)
          ? q.data
          : undefined;
      try {
        const stats = await caller.performance.stats(input);
        res.json(stats);
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to load performance stats";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/performance-goals/dashboard",
    async (req: Request, res: Response) => {
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      const yearParsed = z.coerce
        .number()
        .int()
        .min(2000)
        .max(2100)
        .safeParse(req.query.year);
      const monthParsed = z.coerce
        .number()
        .int()
        .min(1)
        .max(12)
        .safeParse(req.query.month);
      const input =
        yearParsed.success || monthParsed.success
          ? {
              ...(yearParsed.success ? { year: yearParsed.data } : {}),
              ...(monthParsed.success ? { month: monthParsed.data } : {}),
            }
          : undefined;
      try {
        const dashboard = await caller.performanceGoals.dashboard(input);
        res.json(dashboard);
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to load goals dashboard";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/mobile/push-preferences",
    async (req: Request, res: Response) => {
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        const prefs = await caller.pushNotifications.getPreferences();
        res.json(prefs);
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to load push preferences";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.patch(
    "/api/mobile/push-preferences",
    async (req: Request, res: Response) => {
      const bodyParsed = pushPrefsPatchBody.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        const updated = await caller.pushNotifications.updatePreferences(
          bodyParsed.data
        );
        res.json(updated);
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to update push preferences";
        res.status(400).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/mobile/notifications/read-all",
    async (req: Request, res: Response) => {
      const caller = await getMobileCaller(req, res);
      if (!caller) return;
      try {
        await caller.notifications.markAllRead();
        res.json({ success: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to mark all read";
        res.status(400).json({ error: msg });
      }
    }
  );
}
