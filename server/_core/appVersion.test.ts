import express from "express";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  getSafeAppVersionMetadata,
  toCommitSha,
  toCommitShort,
} from "./appVersion";
import { registerAppVersionRoutes } from "./appVersionRoutes";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("safe app version metadata", () => {
  it("returns only whitelisted deployment fields with a full commit SHA", () => {
    process.env.APP_VERSION = "1.2.3";
    process.env.RAILWAY_GIT_COMMIT_SHA =
      "abcdef1234567890abcdef1234567890abcdef12";
    process.env.APP_BUILD_TIME = "2026-07-08T00:00:00.000Z";
    process.env.DATABASE_URL = "mysql://secret";
    process.env.OAUTH_CLIENT_SECRET = "oauth-secret";
    process.env.SESSION_SECRET = "session-secret";

    const metadata = getSafeAppVersionMetadata();
    const serialized = JSON.stringify(metadata);

    expect(metadata).toMatchObject({
      ok: true,
      serviceName: "boa-crm",
      appVersion: "1.2.3",
      commitSha: "abcdef1234567890abcdef1234567890abcdef12",
      commitShort: "abcdef1",
      buildTime: "2026-07-08T00:00:00.000Z",
    });
    expect(serialized).not.toContain("mysql://secret");
    expect(serialized).not.toContain("oauth-secret");
    expect(serialized).not.toContain("session-secret");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("OAUTH_CLIENT_SECRET");
    expect(serialized).not.toContain("SESSION_SECRET");
  });

  it("rejects non-commit values instead of exposing arbitrary env text", () => {
    expect(toCommitSha("1234567890abcdef1234567890abcdef12345678")).toBe(
      "1234567890abcdef1234567890abcdef12345678"
    );
    expect(toCommitSha("ABCDEF1234567890abcdef1234567890abcdef12")).toBeNull();
    expect(toCommitShort("refs/heads/main")).toBeNull();
    expect(toCommitShort("not-a-sha-secret-value")).toBeNull();
    expect(toCommitShort("1234567890abcdef")).toBeNull();
  });

  it("keeps health compatible while exposing a safe version summary", async () => {
    process.env.APP_VERSION = "1.0.0";
    process.env.GIT_COMMIT_SHA = "1234567890abcdef1234567890abcdef12345678";

    const app = express();
    registerAppVersionRoutes(app);
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("test server did not bind to a port");
    }

    try {
      const health = await fetch(
        `http://127.0.0.1:${address.port}/api/health`
      );
      const healthJson = await health.json();
      const version = await fetch(
        `http://127.0.0.1:${address.port}/api/version`
      );
      const versionJson = await version.json();

      expect(health.status).toBe(200);
      expect(healthJson.ok).toBe(true);
      expect(healthJson.service).toBe("boa-crm");
      expect(healthJson.version).toEqual({
        appVersion: "1.0.0",
        commitSha: "1234567890abcdef1234567890abcdef12345678",
        commitShort: "1234567",
        environmentLabel: "test",
      });
      expect(version.status).toBe(200);
      expect(versionJson.commitSha).toBe(
        "1234567890abcdef1234567890abcdef12345678"
      );
      expect(versionJson.commitShort).toBe("1234567");
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it("fails health closed in production when the stamped identity is absent", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_COMMIT_SHA =
      "1234567890abcdef1234567890abcdef12345678";

    const app = express();
    registerAppVersionRoutes(app);
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("test server did not bind to a port");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/health`
      );
      const payload = await response.json();
      expect(response.status).toBe(503);
      expect(payload.ok).toBe(false);
      expect(payload.version.commitSha).toBeNull();
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
