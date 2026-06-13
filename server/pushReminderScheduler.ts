import { runPushReminderEngines } from "./pushNotifications";

let schedulerStarted = false;
let inFlight = false;
let intervalTimer: NodeJS.Timeout | null = null;
let initialTimer: NodeJS.Timeout | null = null;

function toBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function runAutomaticPushReminderTick(lookbackMinutes: number) {
  if (inFlight) {
    console.info("[push-scheduler] automatic tick skipped", {
      reason: "in_flight",
    });
    return;
  }
  inFlight = true;
  try {
    const result = await runPushReminderEngines({ lookbackMinutes });
    console.info("[push-scheduler] automatic tick completed", {
      targetCount: result.targetCount,
      sentCount: result.sentCount,
      skippedCount: result.skippedCount,
      failureCount: result.failureCount,
      duplicateSkippedCount: result.duplicateSkippedCount,
      logExpectation: result.summary.logExpectation,
    });
  } catch (error) {
    console.error("[push-scheduler] automatic tick failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
  } finally {
    inFlight = false;
  }
}

export function startPushReminderScheduler() {
  if (schedulerStarted || process.env.NODE_ENV === "test") return;
  if (process.env.PUSH_REMINDER_SCHEDULER_ENABLED === "false") {
    console.info("[push-scheduler] automatic scheduler disabled", {
      reason: "env_disabled",
    });
    return;
  }

  schedulerStarted = true;
  const intervalMs = toBoundedInteger(
    process.env.PUSH_REMINDER_SCHEDULER_INTERVAL_MS,
    5 * 60 * 1000,
    60 * 1000,
    30 * 60 * 1000
  );
  const initialDelayMs = toBoundedInteger(
    process.env.PUSH_REMINDER_SCHEDULER_INITIAL_DELAY_MS,
    15 * 1000,
    1 * 1000,
    intervalMs
  );
  const lookbackMinutes = toBoundedInteger(
    process.env.PUSH_REMINDER_LOOKBACK_MINUTES,
    10,
    1,
    30
  );

  console.info("[push-scheduler] automatic scheduler started", {
    intervalMs,
    initialDelayMs,
    lookbackMinutes,
  });

  initialTimer = setTimeout(() => {
    void runAutomaticPushReminderTick(lookbackMinutes);
  }, initialDelayMs);
  intervalTimer = setInterval(() => {
    void runAutomaticPushReminderTick(lookbackMinutes);
  }, intervalMs);
  initialTimer.unref?.();
  intervalTimer.unref?.();
}

export function stopPushReminderSchedulerForTests() {
  if (initialTimer) clearTimeout(initialTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  initialTimer = null;
  intervalTimer = null;
  schedulerStarted = false;
  inFlight = false;
}
