import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { randomUUID } from "node:crypto";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerInternalPushSchedulerRoutes } from "../internalPushSchedulerRoutes";
import { registerMobileRoutes } from "../mobileRoutes";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

/** tRPC JSON batches (e.g. customers.bulkImport up to 5000 rows) need a higher cap than default API traffic. */
const TRPC_JSON_LIMIT = "24mb";
const DEFAULT_JSON_LIMIT = "1mb";

function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000, host: string): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort} (host=${host})`);
}

async function startServer() {
  console.log("[boot] BOA CRM server starting…");
  if (process.env.NODE_ENV !== "development") {
    console.warn(
      `[boot] NODE_ENV="${process.env.NODE_ENV ?? "(unset)"}" — Vite 개발 모드가 아닙니다. 프론트 개발은 package.json의 pnpm dev(cross-env)로 실행하세요.`
    );
  }
  const app = express();
  const server = createServer(app);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "boa-crm" });
  });

  app.use((req, res, next) => {
    const incoming = req.headers["x-request-id"];
    const id =
      typeof incoming === "string"
        ? incoming.split(",")[0]?.trim() || randomUUID()
        : Array.isArray(incoming)
          ? incoming[0]?.split(",")[0]?.trim() || randomUUID()
          : randomUUID();
    res.setHeader("X-Request-Id", id);
    next();
  });

  app.use(
    "/api/trpc",
    express.json({ limit: TRPC_JSON_LIMIT }),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.use(express.json({ limit: DEFAULT_JSON_LIMIT }));
  app.use(express.urlencoded({ limit: DEFAULT_JSON_LIMIT, extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerInternalPushSchedulerRoutes(app);
  registerMobileRoutes(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    try {
      await setupVite(app, server);
    } catch (err) {
      console.error("[boot] Vite / dev middleware failed to start:", err);
      throw err;
    }
  } else {
    serveStatic(app);
  }

  const host = process.env.HOST ?? "0.0.0.0";
  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort, host);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("[server] listen error:", err.message);
    if (err.code === "EADDRINUSE") {
      console.error(`[server] Port ${port} is already in use. Try PORT=3001 pnpm dev or close the other process.`);
    }
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    console.log(`[boot] NODE_ENV=${process.env.NODE_ENV ?? "(unset)"} host=${host} port=${port}`);
    console.log(`Server running on http://127.0.0.1:${port}/`);
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Health check: http://127.0.0.1:${port}/api/health`);
  });
}

startServer().catch((err) => {
  console.error("[boot] fatal:", err);
  process.exit(1);
});
