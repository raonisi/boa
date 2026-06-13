import "dotenv/config";
import mysql from "mysql2/promise";
import {
  sanitizeActivityLogDetailsForStorage,
  sanitizeActivityLogText,
} from "../server/activityLogRedaction";

type ActivityLogRow = {
  id: number;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

function readNumberArg(name: string, fallback: number) {
  const prefix = `--${name}=`;
  const raw = process.argv
    .find(arg => arg.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name} value`);
  }
  return Math.floor(parsed);
}

const writeMode = process.argv.includes("--write");
const batchSize = readNumberArg("batch-size", 250);
const maxRows = readNumberArg("limit", Number.MAX_SAFE_INTEGER);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

if (writeMode && process.env.CONFIRM_REDACT_ACTIVITY_LOGS !== "1") {
  throw new Error(
    "Refusing to update rows. Set CONFIRM_REDACT_ACTIVITY_LOGS=1 and pass --write."
  );
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

let lastId = 0;
let scanned = 0;
let changed = 0;
let updated = 0;

try {
  while (scanned < maxRows) {
    const remaining = Math.min(batchSize, maxRows - scanned);
    const [rows] = await connection.execute(
      "select id, details, ipAddress, userAgent from activity_logs where id > ? order by id asc limit ?",
      [lastId, remaining]
    );
    const entries = rows as ActivityLogRow[];
    if (entries.length === 0) break;

    for (const row of entries) {
      lastId = Math.max(lastId, row.id);
      scanned += 1;

      const nextDetails = sanitizeActivityLogDetailsForStorage(row.details);
      const nextIpAddress = row.ipAddress ? "[REDACTED]" : row.ipAddress;
      const nextUserAgent = row.userAgent
        ? sanitizeActivityLogText(row.userAgent, 80)
        : row.userAgent;

      const needsUpdate =
        nextDetails !== row.details ||
        nextIpAddress !== row.ipAddress ||
        nextUserAgent !== row.userAgent;

      if (!needsUpdate) continue;
      changed += 1;

      if (writeMode) {
        await connection.execute(
          "update activity_logs set details = ?, ipAddress = ?, userAgent = ? where id = ?",
          [nextDetails, nextIpAddress, nextUserAgent, row.id]
        );
        updated += 1;
      }
    }
  }
} finally {
  await connection.end();
}

console.log(
  JSON.stringify({
    mode: writeMode ? "write" : "dry-run",
    scanned,
    rowsNeedingRedaction: changed,
    updated,
  })
);
