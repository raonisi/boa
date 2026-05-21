import type { Express, Request } from "express";
import { parseKstLocalDateTime } from "@shared/timePolicy";
import * as pushNotifications from "./pushNotifications";

function readSchedulerSecret(req: Request) {
  const headerSecret = req.header("x-push-scheduler-secret");
  if (headerSecret) return headerSecret;

  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();

  const bodySecret = typeof req.body?.secret === "string" ? req.body.secret : null;
  return bodySecret;
}

function parseLookbackMinutes(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 30) return null;
  return numberValue;
}

function safeEngineResult(result: Awaited<ReturnType<typeof pushNotifications.runPushReminderEngines>>) {
  return {
    success: result.success,
    targetCount: result.targetCount,
    sentCount: result.sentCount,
    skippedCount: result.skippedCount,
    failureCount: result.failureCount,
    duplicateSkippedCount: result.duplicateSkippedCount,
    summary: result.summary,
    schedule: {
      targetCount: result.schedule.targetCount,
      reminderTargetCount: result.schedule.reminderTargetCount,
      incompleteTargetCount: result.schedule.incompleteTargetCount,
      sentCount: result.schedule.sentCount,
      skippedCount: result.schedule.skippedCount,
      failureCount: result.schedule.failureCount,
      duplicateSkippedCount: result.schedule.duplicateSkippedCount,
      summary: result.schedule.summary,
    },
    business: {
      targetCount: result.business.targetCount,
      birthdayTargetCount: result.business.birthdayTargetCount,
      contract90TargetCount: result.business.contract90TargetCount,
      contract180TargetCount: result.business.contract180TargetCount,
      contract365TargetCount: result.business.contract365TargetCount,
      longUnmanagedTargetCount: result.business.longUnmanagedTargetCount,
      sentCount: result.business.sentCount,
      skippedCount: result.business.skippedCount,
      failureCount: result.business.failureCount,
      duplicateSkippedCount: result.business.duplicateSkippedCount,
      summary: result.business.summary,
    },
  };
}

export function registerInternalPushSchedulerRoutes(app: Express) {
  app.post("/api/internal/push-reminders/run", async (req, res) => {
    const expectedSecret = process.env.PUSH_SCHEDULER_SECRET;
    const providedSecret = readSchedulerSecret(req);
    if (!expectedSecret || providedSecret !== expectedSecret) {
      console.warn("[push-scheduler] HTTP trigger unauthorized", {
        reason: expectedSecret ? "secret_mismatch" : "secret_missing",
      });
      res.status(401).json({ success: false, error: "UNAUTHORIZED" });
      return;
    }

    const lookbackMinutes = parseLookbackMinutes(req.body?.lookbackMinutes);
    if (lookbackMinutes === null) {
      res.status(400).json({ success: false, error: "INVALID_LOOKBACK_MINUTES" });
      return;
    }

    const now = typeof req.body?.now === "string" ? parseKstLocalDateTime(req.body.now) : new Date();
    if (Number.isNaN(now.getTime())) {
      res.status(400).json({ success: false, error: "INVALID_NOW" });
      return;
    }

    try {
      const result = await pushNotifications.runPushReminderEngines({ now, lookbackMinutes });
      res.status(200).json(safeEngineResult(result));
    } catch (error) {
      console.error("[push-scheduler] HTTP trigger failed", {
        error: error instanceof Error ? error.message : "unknown_error",
      });
      res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
    }
  });
}
