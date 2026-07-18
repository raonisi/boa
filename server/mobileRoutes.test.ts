import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerMobileRoutes } from "./mobileRoutes";
import { sdk } from "./_core/sdk";
import { appRouter } from "./routers";

function testUser(
  accountStatus: "active" | "inactive" | "resigned" = "active"
) {
  return {
    id: 7,
    openId: `test-${accountStatus}`,
    email: `${accountStatus}@test.local`,
    name: `[TEST] ${accountStatus}`,
    loginMethod: "google",
    role: "member",
    accountStatus,
    teamId: 10,
    subBranchAdminId: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    sessionInvalidatedAt: null,
  } as any;
}

async function withMobileServer<T>(handler: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(express.json());
  registerMobileRoutes(app);
  const server: Server = await new Promise(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server address");
    return await handler(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mobile push preferences", () => {
  it("requires authentication for preference reads", async () => {
    await withMobileServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/mobile/push-preferences`);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized" });
    });
  });
});

describe("mobile contract create", () => {
  it("rejects invalid customer id before auth", async () => {
    await withMobileServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/mobile/customers/not-a-number/contracts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: "[TEST] insurer" }),
        }
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "Invalid customer id" });
    });
  });
});

describe("mobile customers search", () => {
  it("forwards search query to scoped customers.list", async () => {
    const listMock = vi
      .fn()
      .mockResolvedValue([
        { id: 101, name: "[TEST] Alpha", consultStatus: "미상담" },
      ]);
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));
    vi.spyOn(appRouter, "createCaller").mockReturnValue({
      customers: { list: listMock },
    } as ReturnType<typeof appRouter.createCaller>);

    await withMobileServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/mobile/customers?search=${encodeURIComponent("[TEST] Alpha")}&limit=10`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listMock).toHaveBeenCalledWith({ search: "[TEST] Alpha" });
      expect(body.items).toHaveLength(1);
    });
  });

  it("rejects overlong search query", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));

    await withMobileServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/mobile/customers?search=${"x".repeat(101)}`
      );
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "Invalid search query" });
    });
  });
});

describe("mobile contracts search", () => {
  it("filters scoped contracts before pagination", async () => {
    const listMock = vi.fn().mockResolvedValue([
      {
        id: 1,
        productName: "[TEST] Alpha Plan",
        company: "Insurer A",
        contractStatus: "유지",
      },
      {
        id: 2,
        productName: "[TEST] Beta Plan",
        company: "Insurer B",
        contractStatus: "유지",
      },
    ]);
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));
    vi.spyOn(appRouter, "createCaller").mockReturnValue({
      contracts: { list: listMock },
    } as ReturnType<typeof appRouter.createCaller>);

    await withMobileServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/mobile/contracts?search=beta&limit=10`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listMock).toHaveBeenCalledWith({});
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(2);
    });
  });
});

describe("mobile schedules scope", () => {
  it("forwards viewMode query params to schedules.list", async () => {
    const listMock = vi.fn().mockResolvedValue({
      schedules: [{ id: 1, title: "[TEST] Schedule", userId: 7 }],
      users: [],
      teams: [],
    });
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));
    vi.spyOn(appRouter, "createCaller").mockReturnValue({
      schedules: { list: listMock },
    } as ReturnType<typeof appRouter.createCaller>);

    await withMobileServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/mobile/schedules?viewMode=user&ownerUserId=12`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listMock).toHaveBeenCalledWith({
        viewMode: "user",
        ownerUserId: 12,
      });
      expect(body.items).toHaveLength(1);
      expect(body.users).toEqual([]);
    });
  });

  it("defaults to mine when query is omitted", async () => {
    const listMock = vi.fn().mockResolvedValue({
      schedules: [],
      users: [],
      teams: [],
    });
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));
    vi.spyOn(appRouter, "createCaller").mockReturnValue({
      schedules: { list: listMock },
    } as ReturnType<typeof appRouter.createCaller>);

    await withMobileServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/mobile/schedules`);
      expect(response.status).toBe(200);
      expect(listMock).toHaveBeenCalledWith({ viewMode: "mine" });
    });
  });
});

describe("mobile notification action center", () => {
  it("returns the flat scoped page and forwards action filters", async () => {
    const listMock = vi.fn().mockResolvedValue({
      items: [
        {
          id: 91,
          type: "schedule_incomplete",
          category: "schedule",
          actionRequired: true,
        },
      ],
      totalCount: 1,
      hasMore: false,
      nextOffset: null,
      counts: {
        all: 1,
        unread: 1,
        actionRequired: 1,
        byCategory: {
          schedule: 1,
          customer_follow_up: 0,
          approval_admin: 0,
          system: 0,
        },
        byPriority: {
          urgent: 1,
          today: 0,
          general: 0,
          done: 0,
        },
      },
    });
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));
    vi.spyOn(appRouter, "createCaller").mockReturnValue({
      notifications: { list: listMock },
    } as ReturnType<typeof appRouter.createCaller>);

    await withMobileServer(async baseUrl => {
      const response = await fetch(
        `${baseUrl}/api/mobile/notifications?category=schedule&priority=urgent&actionRequired=true&targetType=schedule&limit=20`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "schedule",
          priority: "urgent",
          actionRequired: true,
          targetType: "schedule",
          limit: 20,
        })
      );
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items[0].id).toBe(91);
      expect(body.counts.actionRequired).toBe(1);
    });
  });
});

describe("mobile auth.me", () => {
  it("returns a serialized active user", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));

    await withMobileServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/mobile/auth/me`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user).toEqual(
        expect.objectContaining({
          id: 7,
          role: "member",
          accountStatus: "active",
        })
      );
    });
  });

  it("does not return user payloads when stale inactive or resigned sessions are rejected", async () => {
    for (const accountStatus of ["inactive", "resigned"] as const) {
      vi.spyOn(sdk, "authenticateRequest").mockRejectedValueOnce(
        new Error("Account is inactive")
      );

      await withMobileServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/api/mobile/auth/me`);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: "Unauthorized" });
        expect(JSON.stringify(body)).not.toContain(accountStatus);
      });
    }
  });
});
