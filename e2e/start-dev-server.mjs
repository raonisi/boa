import { spawn } from "node:child_process";
import net from "node:net";

/** Fixed E2E port — must match playwright.config.ts baseURL (no fallback). */
const E2E_DEFAULT_PORT = 3187;
const port = Number(process.env.E2E_PORT ?? E2E_DEFAULT_PORT);

async function assertPortFree(targetPort) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => {
      reject(
        new Error(
          `E2E dev server port ${targetPort} is already in use. ` +
            `Stop the stale process (e.g. another Playwright run) or set E2E_PORT to a free port. ` +
            `Do not rely on automatic port fallback — baseURL and webServer must stay aligned.`
        )
      );
    });
    server.listen(targetPort, "127.0.0.1", () => {
      server.close(resolve);
    });
  });
}

await assertPortFree(port);

const command =
  process.platform === "win32" ? "node scripts/run-dev.mjs once" : "node";
const args =
  process.platform === "win32" ? [] : ["scripts/run-dev.mjs", "once"];
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    E2E_PORT: String(port),
    NODE_ENV: "development",
    /**
     * Reuse existing strict-port gate in server/_core/index.ts (E2E-only).
     * Prevents findAvailablePort() from silently binding 3188 when 3187 is busy.
     */
    RAILWAY_ENVIRONMENT: "e2e",
    PUSH_REMINDER_SCHEDULER_ENABLED: "false",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
