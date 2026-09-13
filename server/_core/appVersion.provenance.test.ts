import express from "express";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const release = vi.hoisted(() => ({ sha: "development" }));
vi.mock("../generated/releaseIdentity", () => ({
  get RELEASE_SHA() {
    return release.sha;
  },
}));

import { getSafeAppVersionMetadata } from "./appVersion";
import { registerAppVersionRoutes } from "./appVersionRoutes";

const SHA_A = "a".repeat(40);
const SHA_B = `${"a".repeat(7)}${"b".repeat(33)}`;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { NODE_ENV: "production" };
  release.sha = SHA_A;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  release.sha = "development";
});

async function expectIdentity(status: number, commitSha: string | null) {
  const app = express();
  registerAppVersionRoutes(app);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test port");
    const base = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${base}/api/health`);
    const version = await fetch(`${base}/api/version`);
    const healthJson = await health.json();
    const versionJson = await version.json();
    expect(health.status).toBe(status);
    expect(healthJson).toEqual({
      ok: status === 200,
      service: "boa-crm",
      version: {
        appVersion: "1.0.0",
        commitSha,
        commitShort: commitSha?.slice(0, 7) ?? null,
        environmentLabel: "production",
      },
    });
    expect(version.status).toBe(200);
    expect(versionJson).toEqual({
      ok: true,
      serviceName: "boa-crm",
      appVersion: "1.0.0",
      commitSha,
      commitShort: commitSha?.slice(0, 7) ?? null,
      buildTime: null,
      environmentLabel: "production",
      serverStartTime: expect.any(String),
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

describe("production release provenance", () => {
  it("I06 accepts the direct-upload stamp without a Railway runtime SHA", async () => {
    await expectIdentity(200, SHA_A);
  });

  it("I07 accepts a matching native build/runtime SHA", async () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = SHA_A;
    await expectIdentity(200, SHA_A);
  });

  it("I08 fails health closed for a stale artifact even with the same short SHA", async () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = SHA_B;
    await expectIdentity(503, null);
  });

  it("I09 never uses a production env SHA as a substitute for a stamp", async () => {
    release.sha = "development";
    process.env.RAILWAY_GIT_COMMIT_SHA = SHA_A;
    process.env.APP_COMMIT_SHA = SHA_A;
    await expectIdentity(503, null);
  });

  it("I10 preserves non-production fallback and stamped precedence", () => {
    process.env.NODE_ENV = "test";
    process.env.RAILWAY_GIT_COMMIT_SHA = SHA_B;
    expect(getSafeAppVersionMetadata().commitSha).toBe(SHA_A);
    release.sha = "development";
    expect(getSafeAppVersionMetadata().commitSha).toBe(SHA_B);
    process.env.APP_COMMIT_SHA = SHA_A;
    expect(getSafeAppVersionMetadata().commitSha).toBe(SHA_A);
  });

  it("does not expose invalid runtime text or use it as a release source", async () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "synthetic-sensitive-value";
    await expectIdentity(200, SHA_A);
    expect(JSON.stringify(getSafeAppVersionMetadata())).not.toContain(
      "synthetic-sensitive-value"
    );
  });
});
