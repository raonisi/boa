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
const RAILWAY_CLI_EXECUTABLE =
  process.platform === "win32" && process.env.APPDATA
    ? join(
        process.env.APPDATA,
        "npm",
        "node_modules",
        "@railway",
        "cli",
        "bin",
        "railway.exe"
      )
    : "railway";
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;
const RAILWAY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RAILWAY_PRODUCTION_COMMANDS = Object.freeze({
  deploymentList: Object.freeze({
    command: "railway",
    subcommands: Object.freeze(["deployment", "list"]),
  }),
  upload: Object.freeze({
    command: "railway",
    subcommands: Object.freeze(["up"]),
  }),
});

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

const AUTH_FAILURE_PATTERNS = [
  /\bunauthorized\b/i,
  /not auth(?:enticated|orized)/i,
  /authentication failed/i,
  /invalid (?:api )?token/i,
  /token (?:is )?(?:invalid|expired)/i,
];

const FORBIDDEN_FAILURE_PATTERNS = [
  /\bforbidden\b/i,
  /permission denied/i,
  /insufficient permissions?/i,
];

const CONTEXT_NOT_FOUND_PATTERNS = [
  /(?:project|environment|service).{0,40}not found/i,
  /unknown (?:project|environment|service)/i,
];

const COMMAND_CONTRACT_FAILURE_PATTERNS = [
  /unexpected argument/i,
  /unknown (?:argument|option)/i,
  /wasn['’]t expected/i,
];

const DEPLOYMENT_REGISTRATION_STATES = new Set([
  "not_attempted",
  "not_observed",
  "observed",
  "ambiguous",
  "unknown",
]);

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
  timedOut = false,
}) {
  const safeStage = ["preflight-list", "post-upload-list", "upload"].includes(
    stage
  )
    ? stage
    : "railway-cli";
  const text = safeErrorText(stderr);
  let code = "RAILWAY_CLI_UNKNOWN_FAILURE";
  if (safeStage === "preflight-list") {
    if (timedOut) {
      code = "RAILWAY_DEPLOYMENT_LIST_TIMEOUT";
    } else if (AUTH_FAILURE_PATTERNS.some(pattern => pattern.test(text))) {
      code = "RAILWAY_PREFLIGHT_AUTH_FAILED";
    } else if (FORBIDDEN_FAILURE_PATTERNS.some(pattern => pattern.test(text))) {
      code = "RAILWAY_PREFLIGHT_FORBIDDEN";
    } else if (CONTEXT_NOT_FOUND_PATTERNS.some(pattern => pattern.test(text))) {
      code = "RAILWAY_PREFLIGHT_CONTEXT_NOT_FOUND";
    } else if (
      COMMAND_CONTRACT_FAILURE_PATTERNS.some(pattern => pattern.test(text))
    ) {
      code = "RAILWAY_DEPLOYMENT_LIST_COMMAND_FAILED";
    }
  } else if (safeStage === "post-upload-list") {
    if (
      timedOut ||
      AUTH_FAILURE_PATTERNS.some(pattern => pattern.test(text)) ||
      FORBIDDEN_FAILURE_PATTERNS.some(pattern => pattern.test(text)) ||
      CONTEXT_NOT_FOUND_PATTERNS.some(pattern => pattern.test(text)) ||
      COMMAND_CONTRACT_FAILURE_PATTERNS.some(pattern => pattern.test(text))
    ) {
      code = "RAILWAY_POST_UPLOAD_LIST_FAILED";
    }
  } else if (safeStage === "upload") {
    if (
      timedOut ||
      AUTH_FAILURE_PATTERNS.some(pattern => pattern.test(text)) ||
      FORBIDDEN_FAILURE_PATTERNS.some(pattern => pattern.test(text)) ||
      CONTEXT_NOT_FOUND_PATTERNS.some(pattern => pattern.test(text)) ||
      COMMAND_CONTRACT_FAILURE_PATTERNS.some(pattern => pattern.test(text))
    ) {
      code = "RAILWAY_UPLOAD_COMMAND_FAILED";
    }
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

export function buildRailwayDeploymentListArgs(context) {
  const validated = validateRailwayContext(context);
  return [
    ...RAILWAY_PRODUCTION_COMMANDS.deploymentList.subcommands,
    "--project",
    validated.projectId,
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
    ...RAILWAY_PRODUCTION_COMMANDS.upload.subcommands,
    "--project",
    validated.projectId,
    "--service",
    validated.serviceId,
    "--environment",
    validated.environmentId,
  ];
}

export async function runRailwayCliCommand({
  args,
  stage,
  timeoutMs = 30_000,
  execFileImpl = execFileAsync,
}) {
  try {
    const { stdout = "" } = await execFileImpl(RAILWAY_CLI_EXECUTABLE, args, {
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
      timedOut:
        error?.code === "ETIMEDOUT" ||
        (error?.killed === true && error?.signal === "SIGTERM"),
    });
  }
}

export async function verifyRailwayCliHelpContract({
  execFileImpl = execFileAsync,
} = {}) {
  const runHelp = async args => {
    try {
      const { stdout = "" } = await execFileImpl(RAILWAY_CLI_EXECUTABLE, args, {
        encoding: "utf8",
        env: process.env,
        maxBuffer: 2 * 1024 * 1024,
        shell: false,
        timeout: 30_000,
        windowsHide: true,
      });
      return stdout;
    } catch (error) {
      throw new RailwayDeploymentError("RAILWAY_CLI_CONTRACT_UNAVAILABLE", {
        stage: "cli-contract",
        command: args[0] ?? "version",
        exitCode: error?.code,
      });
    }
  };

  const [versionOutput, deploymentListHelp, uploadHelp] = await Promise.all([
    runHelp(["--version"]),
    runHelp(["deployment", "list", "--help"]),
    runHelp(["up", "--help"]),
  ]);
  const versionMatches = /^railway 5\.28\.0\s*$/m.test(versionOutput);
  const listOptionsPresent = [
    "--project",
    "--service",
    "--environment",
    "--limit",
    "--json",
  ].every(option => deploymentListHelp.includes(option));
  const uploadOptionsPresent = [
    "--project",
    "--service",
    "--environment",
  ].every(option => uploadHelp.includes(option));
  if (!versionMatches || !listOptionsPresent || !uploadOptionsPresent) {
    throw new RailwayDeploymentError("RAILWAY_CLI_CONTRACT_MISMATCH", {
      stage: "cli-contract",
    });
  }
  return { version: "5.28.0", listOptionsPresent, uploadOptionsPresent };
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

export function createRailwayDeploymentState() {
  return {
    uploadAttempted: false,
    uploadCommandCompleted: false,
    uploadExitCodeKnown: false,
    deploymentRegistration: "not_attempted",
    trackedDeploymentIdPresent: false,
  };
}

function setDeploymentRegistration(state, value) {
  if (!DEPLOYMENT_REGISTRATION_STATES.has(value)) {
    throw new RailwayDeploymentError("INVALID_DEPLOYMENT_REGISTRATION_STATE");
  }
  state.deploymentRegistration = value;
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
    const snapshot = await fetchSnapshot("post-upload");
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
  deploymentState = createRailwayDeploymentState(),
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
  const before = await fetchSnapshot("preflight");
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
  deploymentState.uploadAttempted = true;
  setDeploymentRegistration(deploymentState, "unknown");
  let uploadResult;
  try {
    uploadResult = await upload();
    deploymentState.uploadCommandCompleted = true;
    deploymentState.uploadExitCodeKnown = Number.isInteger(
      uploadResult?.exitCode
    );
  } catch (error) {
    if (Number.isInteger(error?.exitCode)) {
      deploymentState.uploadCommandCompleted = true;
      deploymentState.uploadExitCodeKnown = true;
    }
    throw error;
  }
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
    setDeploymentRegistration(deploymentState, "unknown");
    const after = await fetchSnapshot("post-upload");
    try {
      resolved = resolveNewDeployment({ before, after, deploymentStartedAt });
      setDeploymentRegistration(deploymentState, "observed");
      deploymentState.trackedDeploymentIdPresent = true;
      break;
    } catch (error) {
      if (
        error instanceof RailwayDeploymentError &&
        error.code === "NEW_DEPLOYMENT_NOT_FOUND"
      ) {
        setDeploymentRegistration(deploymentState, "not_observed");
        lastResolutionError = new RailwayDeploymentError(
          "RAILWAY_POST_UPLOAD_REGISTRATION_UNKNOWN",
          { stage: "post-upload-registration", command: "deployment" }
        );
        if (attempt < registrationAttempts && registrationIntervalMs > 0) {
          await sleep(registrationIntervalMs);
        }
        continue;
      } else if (
        error instanceof RailwayDeploymentError &&
        error.code === "AMBIGUOUS_NEW_DEPLOYMENTS"
      ) {
        setDeploymentRegistration(deploymentState, "ambiguous");
        throw new RailwayDeploymentError(
          "RAILWAY_POST_UPLOAD_REGISTRATION_UNKNOWN",
          { stage: "post-upload-registration", command: "deployment" }
        );
      } else {
        throw error;
      }
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
  await verifyStableHealth(candidateSha);
  return {
    outcome: "deployed",
    deploymentId: tracked.deployment.id,
    status: tracked.deployment.status,
  };
}

export async function listDeploymentsFromCli(
  context,
  {
    phase = "preflight",
    runCommand = runRailwayCliCommand,
    capturedAt = new Date().toISOString(),
  } = {}
) {
  const isPreflight = phase === "preflight";
  if (!isPreflight && phase !== "post-upload") {
    throw new RailwayDeploymentError("INVALID_DEPLOYMENT_LIST_PHASE");
  }
  const stage = isPreflight ? "preflight-list" : "post-upload-list";
  const stdout = await runCommand({
    args: buildRailwayDeploymentListArgs(context),
    stage,
  });
  let deployments;
  try {
    deployments = JSON.parse(stdout);
  } catch {
    throw new RailwayDeploymentError(
      isPreflight
        ? "RAILWAY_DEPLOYMENT_LIST_INVALID_JSON"
        : "RAILWAY_POST_UPLOAD_LIST_FAILED",
      {
        stage,
        command: "deployment",
      }
    );
  }
  try {
    return createDeploymentSnapshot({
      deployments,
      context,
      capturedAt,
    });
  } catch (error) {
    throw new RailwayDeploymentError(
      isPreflight
        ? "RAILWAY_DEPLOYMENT_LIST_INVALID_SCHEMA"
        : "RAILWAY_POST_UPLOAD_LIST_FAILED",
      {
        stage,
        command: "deployment",
        exitCode: error?.exitCode,
      }
    );
  }
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
      const child = spawn(
        RAILWAY_CLI_EXECUTABLE,
        buildRailwayUploadArgs(context),
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
  fetchSnapshot,
  upload,
  checkCandidateHealth,
  verifyStableHealth,
  deploymentState,
  ...options
}) {
  const expectedContext = validateRailwayContext(context);
  return executeRailwayDeploymentGate({
    candidateSha,
    fetchSnapshot: phase => fetchSnapshot(expectedContext, phase),
    upload: () => upload(expectedContext),
    checkCandidateHealth,
    verifyStableHealth,
    deploymentState,
    ...options,
  });
}

export function createRailwayFailureDiagnostic({
  error,
  candidateSha,
  deploymentState = createRailwayDeploymentState(),
}) {
  const registration = DEPLOYMENT_REGISTRATION_STATES.has(
    deploymentState?.deploymentRegistration
  )
    ? deploymentState.deploymentRegistration
    : "unknown";
  return {
    stage: typeof error?.stage === "string" ? error.stage : "deployment-gate",
    code:
      error instanceof RailwayDeploymentError ||
      error instanceof ProductionHealthError
        ? error.code
        : "RAILWAY_CLI_UNKNOWN_FAILURE",
    exitCode: Number.isInteger(error?.exitCode) ? error.exitCode : null,
    candidateSha: FULL_SHA_PATTERN.test(candidateSha) ? candidateSha : null,
    uploadAttempted: deploymentState?.uploadAttempted === true,
    uploadCommandCompleted: deploymentState?.uploadCommandCompleted === true,
    uploadExitCodeKnown: deploymentState?.uploadExitCodeKnown === true,
    deploymentRegistration: registration,
    trackedDeploymentIdPresent:
      deploymentState?.trackedDeploymentIdPresent === true,
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
  const deploymentState = createRailwayDeploymentState();
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
      deploymentState,
      fetchSnapshot: (expectedContext, phase) =>
        listDeploymentsFromCli(expectedContext, { phase }),
      upload: expectedContext => uploadExactCheckout(expectedContext),
      checkCandidateHealth: expectedSha =>
        verifyProductionHealthOnce({ expectedSha }),
      verifyStableHealth: expectedSha => pollProductionHealth({ expectedSha }),
      sleep: delay => new Promise(resolve => setTimeout(resolve, delay)),
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    const diagnostic = createRailwayFailureDiagnostic({
      error,
      candidateSha,
      deploymentState,
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
