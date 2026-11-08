import { test as base, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export interface ProductionAsset {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ProductionStatic {
  origin: string;
  root: string;
  assets: { customerDetail: ProductionAsset; moreSheet: ProductionAsset };
  requests(): readonly { method: string; path: string; status: number; bytes: number; sha256: string }[];
}

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2",
};
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export const test = base.extend<{}, { production: ProductionStatic }>({
  production: [async ({}, use, workerInfo) => {
    const root = fs.realpathSync(path.resolve(process.cwd(), "dist/public"));
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".vite/manifest.json"), "utf8"));
    function asset(source: string): ProductionAsset {
      const file = manifest[source]?.file;
      if (typeof file !== "string" || !/^assets\/[\w-]+\.js$/.test(file)) {
        throw new Error("Missing production module in Vite manifest: " + source);
      }
      const bytes = fs.readFileSync(path.join(root, file));
      return { path: "/" + file, bytes: bytes.length, sha256: hash(bytes) };
    }
    const assets = {
      customerDetail: asset("src/pages/CustomerDetail.tsx"),
      moreSheet: asset("src/components/MobileMoreSheet.tsx"),
    };
    const requests: ReturnType<ProductionStatic["requests"]>[number][] = [];
    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const method = request.method ?? "GET";
      let status = 200;
      let bytes: Buffer;
      let contentType = "text/plain; charset=utf-8";
      if (method !== "GET" && method !== "HEAD") {
        status = 405; bytes = Buffer.from("Static production probe does not accept writes");
      } else if (url.pathname.startsWith("/api/")) {
        status = 404; bytes = Buffer.from("API must be explicitly mocked");
      } else {
        const filename = path.resolve(root, "." + decodeURIComponent(url.pathname));
        const contained = filename.startsWith(root + path.sep);
        const exists = contained && fs.existsSync(filename) && fs.statSync(filename).isFile();
        if (!exists && url.pathname.startsWith("/assets/")) {
          status = 404; bytes = Buffer.from("Missing production asset");
        } else {
          const selected = exists ? filename : path.join(root, "index.html");
          bytes = fs.readFileSync(selected);
          contentType = mime[path.extname(selected)] ?? "application/octet-stream";
        }
      }
      requests.push({ method, path: url.pathname + url.search, status, bytes: bytes.length, sha256: hash(bytes) });
      response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
      response.end(method === "HEAD" ? undefined : bytes);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No production static TCP address");
    console.info("[ag08-production-static]", JSON.stringify({ event: "listening", project: workerInfo.project.name, workerIndex: workerInfo.workerIndex, port: address.port, root }));
    try {
      await use({ origin: "http://127.0.0.1:" + address.port, root, assets, requests: () => requests.slice() });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      console.info("[ag08-production-static]", JSON.stringify({ event: "closed", project: workerInfo.project.name, workerIndex: workerInfo.workerIndex, port: address.port, listening: server.listening }));
    }
  }, { scope: "worker" }],
  baseURL: async ({ production }, use) => { await use(production.origin); },
});

export { expect };
