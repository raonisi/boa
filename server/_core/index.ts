import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { randomUUID } from "node:crypto";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

/** tRPC JSON batches (e.g. customers.bulkImport up to 5000 rows) need a higher cap than default API traffic. */
const TRPC_JSON_LIMIT = "24mb";
const DEFAULT_JSON_LIMIT = "1mb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
