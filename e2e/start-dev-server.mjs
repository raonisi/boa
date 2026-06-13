import { spawn } from "node:child_process";
import net from "node:net";

const port = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3187);

async function assertPortFree(targetPort) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => {
      reject(
        new Error(
          `E2E dev server port ${targetPort} is already in use. Stop the stale server or set E2E_PORT.`
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
    NODE_ENV: "development",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
