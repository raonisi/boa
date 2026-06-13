/**
 * Local dev entry: avoids PowerShell `pnpm.ps1` sometimes failing to resolve `node`
 * for nested tools. Uses the same Node binary as this process (`process.execPath`).
 *
 * Usage:
 *   node scripts/run-dev.mjs          # watch mode (default)
 *   node scripts/run-dev.mjs once     # single run (smoke test)
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const serverEntry = path.join(root, "server", "_core", "index.ts");

const once = process.argv.includes("once");
const childArgs = once ? [tsxCli, serverEntry] : [tsxCli, "watch", serverEntry];

const child = spawn(process.execPath, childArgs, {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, NODE_ENV: "development" },
});

child.on("exit", code => process.exit(code ?? 0));
