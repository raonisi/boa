import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  pollProductionHealth,
  ProductionHealthError,
  verifyProductionHealthOnce,
} from "./verify-production-health.mjs";

const execFileAsync = promisify(execFile);
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;
const RAILWAY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PROGRESS_DEPLOYMENT_STATUSES = Object.freeze([
  "INITIALIZING",
  "QUEUED",
  "BUILDING",
  "WAITING",
  "DEPLOYING",
]);
export const FAILURE_DEPLOYMENT_STATUSES = Object.freeze([
  "FAILED",
  "CRASHED",
  "REMOVED",
  "REMOVING",
  "SKIPPED",
]);

const KNOWN_STATUSES = new Set([
  ...PROGRESS_DEPLOYMENT_STATUSES,
  ...FAILURE_DEPLOYMENT_STATUSES,
  "SUCCESS",
]);

export class RailwayDeploymentError extends Error {
  constructor(code) {
    super(code);
    this.name = "RailwayDeploymentError";
    this.code = code;
  }
}

function parseIsoTime(value, code) {
  if (typeof value !== "string") throw new RailwayDeploymentError(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new RailwayDeploymentError(code);
  return { value, milliseconds };
}

export function validateRailwayContext(context) {
  const normalized = {};
  for (const [key, value] of [
    ["projectId", context?.projectId],
    ["serviceId", context?.serviceId],
    ["environmentId", context?.environmentId],
  ]) {
    if (typeof value !== "string" || !RAILWAY_ID_PATTERN.test(value)) {
      throw new RailwayDeploymentError("INVALID_RAILWAY_CONTEXT");
    }
    normalized[key] = value.toLowerCase();
  }
  return normalized;
}

function sameContext(left, right) {
  return (
    left.projectId === right.projectId &&
    left.serviceId === right.serviceId &&
    left.environmentId === right.environmentId
  );
}

export function createDeploymentSnapshot({
  deployments,
  context,
  capturedAt,
}) {
  const normalizedContext = validateRailwayContext(context);
  const capture = parseIsoTime(capturedAt, "INVALID_CAPTURE_TIME");
  if (!Array.isArray(deployments)) {
    throw new RailwayDeploymentError("INVALID_DEPLOYMENT_LIST");
  }

  const ids = new Set();
  const normalizedDeployments = deployments.map(item => {
    if (typeof item?.id !== "string" || !RAILWAY_ID_PATTERN.test(item.id)) {
      throw new RailwayDeploymentError("INVALID_DEPLOYMENT_ID");
    }
    const id = item.id.toLowerCase();
    if (ids.has(id)) throw new RailwayDeploymentError("DUPLICATE_DEPLOYMENT_ID");
    ids.add(id);
    if (typeof item?.status !== "string" || !KNOWN_STATUSES.has(item.status)) {
      throw new RailwayDeploymentError("UNKNOWN_DEPLOYMENT_STATUS");
    }
    const createdAt = parseIsoTime(
      item.createdAt,
      "INVALID_DEPLOYMENT_CREATED_AT"
    );
    return {
      id,
      status: item.status,
      createdAt: createdAt.value,
      createdAtMs: createdAt.milliseconds,
    };
  });

  normalizedDeployments.sort((left, right) => right.createdAtMs - left.createdAtMs);
  return {
    context: normalizedContext,
    capturedAt: capture.value,
    capturedAtMs: capture.milliseconds,
    deployments: normalizedDeployments,
  };
}

export function resolveNewDeployment({
  before,
  after,
  deploymentStartedAt,
}) {
  if (!sameContext(before?.context ?? {}, after?.context ?? {})) {
    throw new RailwayDeploymentError("DEPLOYMENT_CONTEXT_MISMATCH");
  }
  const started = parseIsoTime(
    deploymentStartedAt,
    "INVALID_DEPLOYMENT_START_TIME"
  );
  const beforeIds = new Set(before.deployments.map(item => item.id));
  const candidates = after.deployments.filter(
    item =>
      !beforeIds.has(item.id) &&
      item.createdAtMs >= started.milliseconds &&
      !["REMOVED", "REMOVING"].includes(item.status)
  );
  if (candidates.length === 0) {
    throw new RailwayDeploymentError("NEW_DEPLOYMENT_NOT_FOUND");
  }
  if (candidates.length !== 1) {
    throw new RailwayDeploymentError("AMBIGUOUS_NEW_DEPLOYMENTS");
  }
  return candidates[0];
}

export function getTrackedDeployment(snapshot, deploymentId) {
  if (typeof deploymentId !== "string" || !RAILWAY_ID_PATTERN.test(deploymentId)) {
    throw new RailwayDeploymentError("INVALID_DEPLOYMENT_ID");
  }
  const matches = snapshot.deployments.filter(
    item => item.id === deploymentId.toLowerCase()
  );
  if (matches.length !== 1) {
    throw new RailwayDeploymentError("TRACKED_DEPLOYMENT_NOT_FOUND");
  }
  return matches[0];
}

export function shouldSkipDeployment({ before, candidateHealthMatches }) {
  return (
    candidateHealthMatches === true &&
    before.deployments[0]?.status === "SUCCESS"
  );
}

export async function pollTrackedDeployment({
  deploymentId,
  expectedContext,
  fetchSnapshot,
  attempts = 60,
  intervalMs = 10_000,
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 120) {
    throw new RailwayDeploymentError("INVALID_POLL_ATTEMPTS");
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const snapshot = await fetchSnapshot();
    if (
      expectedContext &&
      !sameContext(validateRailwayContext(expectedContext), snapshot.context)
    ) {
      throw new RailwayDeploymentError("DEPLOYMENT_CONTEXT_MISMATCH");
    }
    const deployment = getTrackedDeployment(snapshot, deploymentId);
    if (deployment.status === "SUCCESS") {
      return { deployment, attemptsUsed: attempt };
    }
    if (FAILURE_DEPLOYMENT_STATUSES.includes(deployment.status)) {
      throw new RailwayDeploymentError(
        `DEPLOYMENT_TERMINAL_FAILURE:${deployment.status}`
      );
    }
    if (!PROGRESS_DEPLOYMENT_STATUSES.includes(deployment.status)) {
      throw new RailwayDeploymentError("UNKNOWN_DEPLOYMENT_STATUS");
    }
    if (attempt < attempts && intervalMs > 0) await sleep(intervalMs);
  }
  throw new RailwayDeploymentError("DEPLOYMENT_STATUS_TIMEOUT");
}

export async function executeRailwayDeploymentGate({
  candidateSha,
  fetchSnapshot,
  upload,
  checkCandidateHealth,
  verifyStableHealth,
  now = () => new Date().toISOString(),
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
  registrationAttempts = 6,
  registrationIntervalMs = 2_000,
  statusAttempts = 60,
  statusIntervalMs = 10_000,
}) {
  if (typeof candidateSha !== "string" || !FULL_SHA_PATTERN.test(candidateSha)) {
    throw new RailwayDeploymentError("INVALID_CANDIDATE_SHA");
  }
  const before = await fetchSnapshot();
  let candidateHealthMatches = false;
  try {
    await checkCandidateHealth(candidateSha);
    candidateHealthMatches = true;
  } catch {
    candidateHealthMatches = false;
  }
  if (shouldSkipDeployment({ before, candidateHealthMatches })) {
    return { outcome: "already-deployed", deploymentId: before.deployments[0].id };
  }
  if (PROGRESS_DEPLOYMENT_STATUSES.includes(before.deployments[0]?.status)) {
    throw new RailwayDeploymentError("DEPLOYMENT_ALREADY_IN_PROGRESS");
  }

  const deploymentStartedAt = now();
  const uploadResult = await upload();
  let resolved;
  let lastResolutionError;
  for (let attempt = 1; attempt <= registrationAttempts; attempt += 1) {
    const after = await fetchSnapshot();
    try {
      resolved = resolveNewDeployment({ before, after, deploymentStartedAt });
      break;
    } catch (error) {
      lastResolutionError = error;
      if (
        !(error instanceof RailwayDeploymentError) ||
        error.code !== "NEW_DEPLOYMENT_NOT_FOUND" ||
        attempt === registrationAttempts
      ) {
        throw error;
      }
      if (registrationIntervalMs > 0) await sleep(registrationIntervalMs);
    }
  }
  if (!resolved) throw lastResolutionError;

  const tracked = await pollTrackedDeployment({
    deploymentId: resolved.id,
    expectedContext: before.context,
    fetchSnapshot,
    attempts: statusAttempts,
    intervalMs: statusIntervalMs,
    sleep,
  });
  if (uploadResult?.exitCode !== 0) {
    throw new RailwayDeploymentError("RAILWAY_UPLOAD_COMMAND_FAILED");
  }
  await verifyStableHealth(candidateSha);
  return {
    outcome: "deployed",
    deploymentId: tracked.deployment.id,
    status: tracked.deployment.status,
  };
}

async function listDeploymentsFromCli(context) {
  const { stdout } = await execFileAsync(
    "railway",
    [
      "deployment",
      "list",
      "--project",
      context.projectId,
      "--service",
      context.serviceId,
      "--environment",
      context.environmentId,
      "--limit",
      "100",
      "--json",
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 30_000 }
  );
  let deployments;
  try {
    deployments = JSON.parse(stdout);
  } catch {
    throw new RailwayDeploymentError("INVALID_DEPLOYMENT_LIST_JSON");
  }
  return createDeploymentSnapshot({
    deployments,
    context,
    capturedAt: new Date().toISOString(),
  });
}

async function uploadExactCheckout(context) {
  const suffix = `${process.pid}-${Date.now()}`;
  const stdoutPath = join(tmpdir(), `boa-railway-up-${suffix}.log`);
  const stderrPath = join(tmpdir(), `boa-railway-up-${suffix}.err.log`);
  const stdout = createWriteStream(stdoutPath, { flags: "wx" });
  const stderr = createWriteStream(stderrPath, { flags: "wx" });
  try {
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(
        "railway",
        [
          "up",
          "--project",
          context.projectId,
          "--service",
          context.serviceId,
          "--environment",
          context.environmentId,
        ],
        {
          env: process.env,
          shell: false,
          stdio: ["ignore", stdout, stderr],
          timeout: 20 * 60 * 1000,
        }
      );
      child.once("error", reject);
      child.once("close", code => resolve(code));
    });
    return { exitCode };
  } finally {
    stdout.end();
    stderr.end();
    await Promise.allSettled([unlink(stdoutPath), unlink(stderrPath)]);
  }
}

async function runCli() {
  if (process.env.RAILWAY_PRE_DEPLOY_VERIFIED !== "true") {
    throw new RailwayDeploymentError("PRE_DEPLOY_NOT_VERIFIED");
  }
  if (!process.env.RAILWAY_TOKEN) {
    throw new RailwayDeploymentError("RAILWAY_TOKEN_MISSING");
  }
  const context = validateRailwayContext({
    projectId: process.env.RAILWAY_PROJECT_ID,
    serviceId: process.env.RAILWAY_SERVICE_ID,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
  });
  const candidateSha = process.env.EXPECTED_COMMIT_SHA;
  const result = await executeRailwayDeploymentGate({
    candidateSha,
    fetchSnapshot: () => listDeploymentsFromCli(context),
    upload: () => uploadExactCheckout(context),
    checkCandidateHealth: expectedSha =>
      verifyProductionHealthOnce({ expectedSha }),
    verifyStableHealth: expectedSha =>
      pollProductionHealth({ expectedSha }),
    sleep: delay => new Promise(resolve => setTimeout(resolve, delay)),
  });
  console.log(JSON.stringify({ ok: true, ...result }));
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runCli().catch(error => {
    const code =
      error instanceof RailwayDeploymentError ||
      error instanceof ProductionHealthError
        ? error.code
        : "RAILWAY_DEPLOYMENT_GATE_FAILED";
    console.error(JSON.stringify({ ok: false, code }));
    process.exitCode = 1;
  });
}
