import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerInternalPushSchedulerRoutes } from "./internalPushSchedulerRoutes";
import * as db from "./db";
import * as pushNotifications from "./pushNotifications";

async function withInternalSchedulerServer<T>(handler: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(express.json());
  registerInternalPushSchedulerRoutes(app);
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

describe("internal push scheduler HTTP route", () => {
  it("returns a safe summary for an authorized scheduler trigger", async () => {
    const previousSecret = process.env.PUSH_SCHEDULER_SECRET;
    process.env.PUSH_SCHEDULER_SECRET = "test-scheduler-secret";
    const engineSpy = vi.spyOn(pushNotifications, "runPushReminderEngines").mockResolvedValue({
      success: true,
      targetCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failureCount: 0,
      duplicateSkippedCount: 0,
      summary: {
        checkedAt: "2026-05-22T00:00:00.000Z",
        candidateCount: 0,
        sendAttemptCount: 0,
        sentCount: 0,
        skippedCount: 0,
        failureCount: 0,
        duplicateSkippedCount: 0,
        quietHoursSkippedCount: 0,
        disabledSkippedCount: 0,
        noTokenSkippedCount: 0,
        missingConfigSkippedCount: 0,
        invalidTokenDeactivatedCount: 0,
        logExpectation: "no_candidates_no_push_logs",
      },
      schedule: {
        success: true,
        targetCount: 0,
        reminderTargetCount: 0,
        incompleteTargetCount: 0,
        sentCount: 0,
        skippedCount: 0,
        failureCount: 0,
        duplicateSkippedCount: 0,
        results: [],
        summary: {
          checkedAt: "2026-05-22T00:00:00.000Z",
          candidateCount: 0,
          sendAttemptCount: 0,
          sentCount: 0,
          skippedCount: 0,
          failureCount: 0,
          duplicateSkippedCount: 0,
          quietHoursSkippedCount: 0,
          disabledSkippedCount: 0,
          noTokenSkippedCount: 0,
          missingConfigSkippedCount: 0,
          invalidTokenDeactivatedCount: 0,
          logExpectation: "no_candidates_no_push_logs",
          lookbackMinutes: 10,
        },
      },
      business: {
        success: true,
        targetCount: 0,
        birthdayTargetCount: 0,
        contract90TargetCount: 0,
        contract365TargetCount: 0,
        longUnmanagedTargetCount: 0,
        sentCount: 0,
        skippedCount: 0,
        failureCount: 0,
        duplicateSkippedCount: 0,
        results: [],
        summary: {
          checkedAt: "2026-05-22T00:00:00.000Z",
          candidateCount: 0,
          sendAttemptCount: 0,
          sentCount: 0,
          skippedCount: 0,
          failureCount: 0,
          duplicateSkippedCount: 0,
          quietHoursSkippedCount: 0,
          disabledSkippedCount: 0,
          noTokenSkippedCount: 0,
          missingConfigSkippedCount: 0,
          invalidTokenDeactivatedCount: 0,
          logExpectation: "no_candidates_no_push_logs",
        },
      },
    } as any);

    await withInternalSchedulerServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/internal/push-reminders/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-push-scheduler-secret": "test-scheduler-secret",
        },
        body: JSON.stringify({ now: "2026-05-22T09:00:00", lookbackMinutes: 10 }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(engineSpy).toHaveBeenCalledWith({
        now: expect.any(Date),
        lookbackMinutes: 10,
      });
      expect(body.summary).toMatchObject({
        candidateCount: 0,
        logExpectation: "no_candidates_no_push_logs",
      });
      expect(JSON.stringify(body)).not.toMatch(/results|010|birthDate|productName|monthlyPremium|raw-token/i);
    });

    process.env.PUSH_SCHEDULER_SECRET = previousSecret;
  });

  it("rejects missing or mismatched secrets without creating push logs", async () => {
    const previousSecret = process.env.PUSH_SCHEDULER_SECRET;
    process.env.PUSH_SCHEDULER_SECRET = "test-scheduler-secret";
    const logSpy = vi.spyOn(db, "createPushNotificationLog");

    await withInternalSchedulerServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/internal/push-reminders/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: "wrong-scheduler-secret" }),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ success: false, error: "UNAUTHORIZED" });
      expect(logSpy).not.toHaveBeenCalled();
    });

    process.env.PUSH_SCHEDULER_SECRET = previousSecret;
  });
});
