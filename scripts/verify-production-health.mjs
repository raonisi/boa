import { pathToFileURL } from "node:url";

export const PRODUCTION_HEALTH_URL = "https://raonisis.kr/api/health";
export const PRODUCTION_VERSION_URL = "https://raonisis.kr/api/version";

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export class ProductionHealthError extends Error {
  constructor(code) {
    super(code);
    this.name = "ProductionHealthError";
    this.code = code;
  }
}

function expectedShortSha(value) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!FULL_SHA_PATTERN.test(candidate)) {
    throw new ProductionHealthError("INVALID_EXPECTED_SHA");
  }
  return candidate.slice(0, 7);
}

async function fetchJson(fetchImpl, url, requestTimeoutMs) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch {
    throw new ProductionHealthError("HTTP_REQUEST_FAILED");
  }
  if (response.status !== 200) throw new ProductionHealthError("HTTP_NOT_200");
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ProductionHealthError("NON_JSON_RESPONSE");
  }
  try {
    return await response.json();
  } catch {
    throw new ProductionHealthError("MALFORMED_JSON");
  }
}

export async function verifyProductionHealthOnce({
  expectedSha,
  fetchImpl = fetch,
  requestTimeoutMs = 8_000,
}) {
  const commitShort = expectedShortSha(expectedSha);
  const health = await fetchJson(
    fetchImpl,
    PRODUCTION_HEALTH_URL,
    requestTimeoutMs
  );
  if (
    health?.ok !== true ||
    health?.service !== "boa-crm" ||
    health?.version?.commitShort !== commitShort
  ) {
    throw new ProductionHealthError("HEALTH_PAYLOAD_MISMATCH");
  }

  const version = await fetchJson(
    fetchImpl,
    PRODUCTION_VERSION_URL,
    requestTimeoutMs
  );
  if (
    version?.ok !== true ||
    version?.serviceName !== "boa-crm" ||
    version?.environmentLabel !== "production" ||
    version?.commitShort !== commitShort
  ) {
    throw new ProductionHealthError("VERSION_PAYLOAD_MISMATCH");
  }

  return { ok: true, commitShort, environment: "production" };
}

export async function pollProductionHealth({
  expectedSha,
  fetchImpl = fetch,
  attempts = 12,
  intervalMs = 10_000,
  requiredConsecutiveSuccesses = 3,
  requestTimeoutMs = 8_000,
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 30) {
    throw new ProductionHealthError("INVALID_ATTEMPT_COUNT");
  }
  if (
    !Number.isInteger(requiredConsecutiveSuccesses) ||
    requiredConsecutiveSuccesses < 1 ||
    requiredConsecutiveSuccesses > attempts
  ) {
    throw new ProductionHealthError("INVALID_STABILITY_COUNT");
  }

  let consecutiveSuccesses = 0;
  let lastError = "HEALTH_NOT_READY";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await verifyProductionHealthOnce({
        expectedSha,
        fetchImpl,
        requestTimeoutMs,
      });
      consecutiveSuccesses += 1;
      if (consecutiveSuccesses >= requiredConsecutiveSuccesses) {
        return { ...result, attemptsUsed: attempt };
      }
    } catch (error) {
      consecutiveSuccesses = 0;
      lastError =
        error instanceof ProductionHealthError
          ? error.code
          : "HEALTH_CHECK_FAILED";
    }
    if (attempt < attempts && intervalMs > 0) await sleep(intervalMs);
  }
  throw new ProductionHealthError(`HEALTH_TIMEOUT:${lastError}`);
}

async function runCli() {
  const expectedSha = process.env.EXPECTED_COMMIT_SHA;
  const result = await pollProductionHealth({ expectedSha });
  console.log(JSON.stringify(result));
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runCli().catch(error => {
    const code =
      error instanceof ProductionHealthError
        ? error.code
        : "HEALTH_CHECK_FAILED";
    console.error(JSON.stringify({ ok: false, code }));
    process.exitCode = 1;
  });
}
