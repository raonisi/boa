import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerMobileRoutes } from "./mobileRoutes";
import { sdk } from "./_core/sdk";

function testUser(accountStatus: "active" | "inactive" | "resigned" = "active") {
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
  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    return await handler(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mobile push preferences", () => {
  it("requires authentication for preference reads", async () => {
    await withMobileServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/mobile/push-preferences`);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized" });
    });
  });
});

describe("mobile contract create", () => {
  it("rejects invalid customer id before auth", async () => {
    await withMobileServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/mobile/customers/not-a-number/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: "[TEST] insurer" }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "Invalid customer id" });
    });
  });
});

describe("mobile auth.me", () => {
  it("returns a serialized active user", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(testUser("active"));

    await withMobileServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/mobile/auth/me`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user).toEqual(expect.objectContaining({
        id: 7,
        role: "member",
        accountStatus: "active",
      }));
    });
  });

  it("does not return user payloads when stale inactive or resigned sessions are rejected", async () => {
    for (const accountStatus of ["inactive", "resigned"] as const) {
      vi.spyOn(sdk, "authenticateRequest").mockRejectedValueOnce(new Error("Account is inactive"));

      await withMobileServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/mobile/auth/me`);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: "Unauthorized" });
        expect(JSON.stringify(body)).not.toContain(accountStatus);
      });
    }
  });
});
