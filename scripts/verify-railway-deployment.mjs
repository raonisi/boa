import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { open, unlink, writeFile } from "node:fs/promises";
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

const RAILWAY_CLI_STAGE_FAILURE_CODES = Object.freeze({
  "context-link": "RAILWAY_CONTEXT_LINK_FAILED",
  "context-status": "RAILWAY_CONTEXT_STATUS_FAILED",
  "deployment-list": "RAILWAY_DEPLOYMENT_LIST_FAILED",
  upload: "RAILWAY_UPLOAD_COMMAND_FAILED",
});

const AUTH_FAILURE_PATTERNS = [
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /not auth(?:enticated|orized)/i,
  /authentication failed/i,
  /invalid (?:api )?token/i,
  /token (?:is )?(?:invalid|expired)/i,
];

const KNOWN_CLI_FAILURE_PATTERNS = [
  /unexpected argument/i,
  /unknown (?:argument|option)/i,
  /wasn['’]t expected/i,
  /not linked/i,
  /no linked project/i,
  /(?:project|environment|service|workspace).{0,40}not found/i,
  /all environments.{0,20}restricted/i,
  /no projects/i,
];

export class RailwayDeploymentError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "RailwayDeploymentError";
    this.code = code;
    this.stage = details.stage;
    this.command = details.command;
    this.exitCode = Number.isInteger(details.exitCode)
      ? details.exitCode
      : null;
    this.deploymentCreated = details.deploymentCreated === true;
  }
}

function safeErrorText(value) {
  if (typeof value === "string") return value.slice(0, 32_768);
  if (Buffer.isBuffer(value)) return value.toString("utf8", 0, 32_768);
  return "";
}

async function readBoundedFileTail(path, maximumBytes = 32_768) {
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, maximumBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, size - length));
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

export function classifyRailwayCliFailure({
  stage,
  command,
  exitCode,
  stderr,
}) {
  const safeStage = Object.hasOwn(RAILWAY_CLI_STAGE_FAILURE_CODES, stage)
    ? stage
    : "railway-cli";
  const text = safeErrorText(stderr);
  let code = "RAILWAY_CLI_UNKNOWN_FAILURE";
  if (AUTH_FAILURE_PATTERNS.some(pattern => pattern.test(text))) {
    code = "RAILWAY_AUTH_FAILED";
  } else if (KNOWN_CLI_FAILURE_PATTERNS.some(pattern => pattern.test(text))) {
    code =
      RAILWAY_CLI_STAGE_FAILURE_CODES[safeStage] ??
      "RAILWAY_CLI_UNKNOWN_FAILURE";
  }
  return new RailwayDeploymentError(code, {
    stage: safeStage,
    command,
    exitCode,
  });
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

export function buildRailwayLinkArgs(context) {
  const validated = validateRailwayContext(context);
  return [
    "link",
    "--project",
    validated.projectId,
    "--environment",
    validated.environmentId,
    "--service",
    validated.serviceId,
    "--json",
  ];
}

export function buildRailwayStatusArgs(context) {
  validateRailwayContext(context);
  return ["status", "--json"];
}

export function buildRailwayDeploymentListArgs(context) {
  const validated = validateRailwayContext(context);
  return [
    "deployment",
    "list",
    "--service",
    validated.serviceId,
    "--environment",
    validated.environmentId,
    "--limit",
    "100",
    "--json",
  ];
}

export function buildRailwayUploadArgs(context) {
  const validated = validateRailwayContext(context);
  return [
    "up",
    "--project",
    validated.projectId,
    "--service",
    validated.serviceId,
    "--environment",
    validated.environmentId,
  ];
}

function parseRailwayJson(stdout, { code, stage, command }) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new RailwayDeploymentError(code, { stage, command });
  }
}

function contextMatches(actual, expected) {
  return (
    actual.projectId === expected.projectId &&
    actual.environmentId === expected.environmentId &&
    actual.serviceId === expected.serviceId
  );
}

export function validateRailwayLinkOutput(stdout, context) {
  const expected = validateRailwayContext(context);
  const payload = parseRailwayJson(stdout, {
    code: "RAILWAY_CONTEXT_LINK_FAILED",
    stage: "context-link",
    command: "link",
  });
  const actual = {
    projectId: payload?.projectId?.toLowerCase?.(),
    environmentId: payload?.environmentId?.toLowerCase?.(),
    serviceId: payload?.serviceId?.toLowerCase?.(),
  };
  if (!contextMatches(actual, expected)) {
    throw new RailwayDeploymentError("RAILWAY_CONTEXT_MISMATCH", {
      stage: "context-link",
      command: "link",
    });
  }
  return expected;
}

function edgeNodes(value) {
  return Array.isArray(value?.edges)
    ? value.edges.map(edge => edge?.node).filter(Boolean)
    : [];
}

export function validateRailwayStatusOutput(stdout, context) {
  const expected = validateRailwayContext(context);
  const payload = parseRailwayJson(stdout, {
    code: "RAILWAY_CONTEXT_STATUS_FAILED",
    stage: "context-status",
    command: "status",
  });
  const projectId = payload?.id?.toLowerCase?.();
  const environments = edgeNodes(payload?.environments);
  const services = edgeNodes(payload?.services);
  if (!projectId || environments.length === 0 || services.length === 0) {
    throw new RailwayDeploymentError("RAILWAY_CONTEXT_STATUS_FAILED", {
      stage: "context-status",
      command: "status",
    });
  }
  const environment = environments.find(
    item => item?.id?.toLowerCase?.() === expected.environmentId
  );
  const projectHasService = services.some(
    item => item?.id?.toLowerCase?.() === expected.serviceId
  );
  const environmentHasService = edgeNodes(environment?.serviceInstances).some(
    item =>
      (
        item?.serviceId ??
        item?.service_id ??
        item?.service?.id
      )?.toLowerCase?.() === expected.serviceId
  );
  const actual = {
    projectId,
    environmentId: environment?.id?.toLowerCase?.(),
    serviceId:
      projectHasService && environmentHasService
        ? expected.serviceId
        : undefined,
  };
  if (!contextMatches(actual, expected)) {
    throw new RailwayDeploymentError("RAILWAY_CONTEXT_MISMATCH", {
      stage: "context-status",
      command: "status",
    });
  }
  return expected;
}

export async function runRailwayCliCommand({
  args,
  stage,
  timeoutMs = 30_000,
  execFileImpl = execFileAsync,
}) {
  try {
    const { stdout = "" } = await execFileImpl("railway", args, {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
      timeout: timeoutMs,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    throw classifyRailwayCliFailure({
      stage,
      command: args[0],
      exitCode: error?.code,
      stderr: error?.stderr,
    });
  }
}

export async function prepareRailwayCliContext(
  context,
  { runCommand = runRailwayCliCommand } = {}
) {
  const expected = validateRailwayContext(context);
  const linkOutput = await runCommand({
    args: buildRailwayLinkArgs(expected),
    stage: "context-link",
  });
  validateRailwayLinkOutput(linkOutput, expected);
  const statusOutput = await runCommand({
    args: buildRailwayStatusArgs(expected),
    stage: "context-status",
  });
  validateRailwayStatusOutput(statusOutput, expected);
  return expected;
}

function sameContext(left, right) {
  return (
    left.projectId === right.projectId &&
    left.serviceId === right.serviceId &&
    left.environmentId === right.environmentId
  );
}

export function createDeploymentSnapshot({ deployments, context, capturedAt }) {
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
    if (ids.has(id))
      throw new RailwayDeploymentError("DUPLICATE_DEPLOYMENT_ID");
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

  normalizedDeployments.sort(
    (left, right) => right.createdAtMs - left.createdAtMs
  );
  return {
    context: normalizedContext,
    capturedAt: capture.value,
    capturedAtMs: capture.milliseconds,
    deployments: normalizedDeployments,
  };
}

export function resolveNewDeployment({ before, after, deploymentStartedAt }) {
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
  if (
    typeof deploymentId !== "string" ||
    !RAILWAY_ID_PATTERN.test(deploymentId)
  ) {
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
  onDeploymentTracked = () => {},
  now = () => new Date().toISOString(),
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
  registrationAttempts = 6,
  registrationIntervalMs = 2_000,
  statusAttempts = 60,
  statusIntervalMs = 10_000,
}) {
  if (
    typeof candidateSha !== "string" ||
    !FULL_SHA_PATTERN.test(candidateSha)
  ) {
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
    return {
      outcome: "already-deployed",
      deploymentId: before.deployments[0].id,
    };
  }
  if (PROGRESS_DEPLOYMENT_STATUSES.includes(before.deployments[0]?.status)) {
    throw new RailwayDeploymentError("DEPLOYMENT_ALREADY_IN_PROGRESS");
  }

  const deploymentStartedAt = now();
  const uploadResult = await upload();
  if (uploadResult?.exitCode !== 0) {
    throw new RailwayDeploymentError("RAILWAY_UPLOAD_COMMAND_FAILED", {
      stage: "upload",
      command: "up",
      exitCode: uploadResult?.exitCode,
    });
  }
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
  onDeploymentTracked(resolved.id);

  const tracked = await pollTrackedDeployment({
    deploymentId: resolved.id,
    expectedContext: before.context,
    fetchSnapshot,
    attempts: statusAttempts,
    intervalMs: statusIntervalMs,
    sleep,
  });
  await verifyStableHealth(candidateSha);
  return {
    outcome: "deployed",
    deploymentId: tracked.deployment.id,
    status: tracked.deployment.status,
  };
}

export async function listDeploymentsFromCli(
  context,
  { runCommand = runRailwayCliCommand } = {}
) {
  const stdout = await runCommand({
    args: buildRailwayDeploymentListArgs(context),
    stage: "deployment-list",
  });
  let deployments;
  try {
    deployments = JSON.parse(stdout);
  } catch {
    throw new RailwayDeploymentError("RAILWAY_DEPLOYMENT_LIST_INVALID_JSON", {
      stage: "deployment-list",
      command: "deployment",
    });
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
  let exitCode = null;
  let spawnError;
  try {
    exitCode = await new Promise((resolve, reject) => {
      const child = spawn("railway", buildRailwayUploadArgs(context), {
        env: process.env,
        shell: false,
        stdio: ["ignore", stdout, stderr],
        timeout: 20 * 60 * 1000,
      });
      child.once("error", reject);
      child.once("close", code => resolve(code));
    });
  } catch (error) {
    spawnError = error;
  } finally {
    await Promise.all([
      new Promise(resolve => stdout.end(resolve)),
      new Promise(resolve => stderr.end(resolve)),
    ]);
  }
  try {
    const stderrText = await readBoundedFileTail(stderrPath).catch(() => "");
    if (spawnError) {
      throw classifyRailwayCliFailure({
        stage: "upload",
        command: "up",
        exitCode: spawnError?.code,
        stderr: spawnError?.stderr ?? stderrText,
      });
    }
    if (exitCode !== 0) {
      const classified = classifyRailwayCliFailure({
        stage: "upload",
        command: "up",
        exitCode,
        stderr: stderrText,
      });
      if (classified.code === "RAILWAY_CLI_UNKNOWN_FAILURE") {
        throw new RailwayDeploymentError("RAILWAY_UPLOAD_COMMAND_FAILED", {
          stage: "upload",
          command: "up",
          exitCode,
        });
      }
      throw classified;
    }
    return { exitCode };
  } finally {
    await Promise.allSettled([unlink(stdoutPath), unlink(stderrPath)]);
  }
}

export function validateRailwayAuthenticationEnvironment(environment) {
  if (!environment?.RAILWAY_TOKEN) {
    throw new RailwayDeploymentError("RAILWAY_TOKEN_MISSING", {
      stage: "configuration",
    });
  }
  if (environment?.RAILWAY_API_TOKEN) {
    throw new RailwayDeploymentError("RAILWAY_AUTH_FAILED", {
      stage: "configuration",
    });
  }
}

export async function executeRailwayCliDeploymentGate({
  context,
  candidateSha,
  prepareContext = prepareRailwayCliContext,
  fetchSnapshot,
  upload,
  checkCandidateHealth,
  verifyStableHealth,
  onDeploymentTracked,
  ...options
}) {
  const expectedContext = await prepareContext(context);
  return executeRailwayDeploymentGate({
    candidateSha,
    fetchSnapshot: () => fetchSnapshot(expectedContext),
    upload: () => upload(expectedContext),
    checkCandidateHealth,
    verifyStableHealth,
    onDeploymentTracked,
    ...options,
  });
}

export function createRailwayFailureDiagnostic({
  error,
  candidateSha,
  deploymentCreated = false,
}) {
  return {
    stage: typeof error?.stage === "string" ? error.stage : "deployment-gate",
    code:
      error instanceof RailwayDeploymentError ||
      error instanceof ProductionHealthError
        ? error.code
        : "RAILWAY_CLI_UNKNOWN_FAILURE",
    exitCode: Number.isInteger(error?.exitCode) ? error.exitCode : null,
    candidateSha: FULL_SHA_PATTERN.test(candidateSha) ? candidateSha : null,
    deploymentCreated:
      deploymentCreated === true || error?.deploymentCreated === true,
  };
}

export async function writeRailwayFailureDiagnostic(path, diagnostic) {
  if (typeof path !== "string" || path.length === 0) return false;
  await writeFile(path, `${JSON.stringify(diagnostic)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return true;
}

async function runCli() {
  const candidateSha = process.env.EXPECTED_COMMIT_SHA;
  let deploymentCreated = false;
  try {
    if (process.env.RAILWAY_PRE_DEPLOY_VERIFIED !== "true") {
      throw new RailwayDeploymentError("PRE_DEPLOY_NOT_VERIFIED", {
        stage: "configuration",
      });
    }
    validateRailwayAuthenticationEnvironment(process.env);
    const context = validateRailwayContext({
      projectId: process.env.RAILWAY_PROJECT_ID,
      serviceId: process.env.RAILWAY_SERVICE_ID,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
    });
    const result = await executeRailwayCliDeploymentGate({
      context,
      candidateSha,
      fetchSnapshot: expectedContext => listDeploymentsFromCli(expectedContext),
      upload: expectedContext => uploadExactCheckout(expectedContext),
      checkCandidateHealth: expectedSha =>
        verifyProductionHealthOnce({ expectedSha }),
      verifyStableHealth: expectedSha => pollProductionHealth({ expectedSha }),
      onDeploymentTracked: () => {
        deploymentCreated = true;
      },
      sleep: delay => new Promise(resolve => setTimeout(resolve, delay)),
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    const diagnostic = createRailwayFailureDiagnostic({
      error,
      candidateSha,
      deploymentCreated,
    });
    await writeRailwayFailureDiagnostic(
      process.env.RAILWAY_DEPLOY_DIAGNOSTIC_PATH,
      diagnostic
    ).catch(() => false);
    console.error(JSON.stringify({ ok: false, ...diagnostic }));
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runCli();
}
