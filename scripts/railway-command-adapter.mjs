import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const RAILWAY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

export const RAILWAY_COMMAND_MANIFEST = Object.freeze({
  "deployment-list": Object.freeze({
    signature: Object.freeze(["deployment", "list"]),
  }),
  upload: Object.freeze({
    signature: Object.freeze(["up"]),
  }),
});

export class RailwayCommandAdapterError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "RailwayCommandAdapterError";
    this.code = code;
    this.command = details.command;
    this.exitCode = Number.isInteger(details.exitCode)
      ? details.exitCode
      : null;
    this.timedOut = details.timedOut === true;
    Object.defineProperty(this, "stderr", {
      enumerable: false,
      value: safeErrorText(details.stderr),
    });
  }
}

export function isRailwayId(value) {
  return typeof value === "string" && RAILWAY_ID_PATTERN.test(value);
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

export function normalizeRailwayContext(context) {
  const normalized = {};
  for (const [key, value] of [
    ["projectId", context?.projectId],
    ["serviceId", context?.serviceId],
    ["environmentId", context?.environmentId],
  ]) {
    if (!isRailwayId(value)) {
      throw new RailwayCommandAdapterError("INVALID_RAILWAY_CONTEXT");
    }
    normalized[key] = value.toLowerCase();
  }
  return normalized;
}

export function buildRailwayCommand(input = {}) {
  const inputKeys =
    input && typeof input === "object" && !Array.isArray(input)
      ? Object.keys(input)
      : [];
  if (
    inputKeys.length !== 2 ||
    !inputKeys.includes("operation") ||
    !inputKeys.includes("context")
  ) {
    throw new RailwayCommandAdapterError("UNSUPPORTED_RAILWAY_OPERATION");
  }
  const { operation, context } = input;
  if (!Object.hasOwn(RAILWAY_COMMAND_MANIFEST, operation)) {
    throw new RailwayCommandAdapterError("UNSUPPORTED_RAILWAY_OPERATION");
  }
  const normalized = normalizeRailwayContext(context);
  const signature = RAILWAY_COMMAND_MANIFEST[operation].signature;
  const args = [
    ...signature,
    "--project",
    normalized.projectId,
    "--service",
    normalized.serviceId,
    "--environment",
    normalized.environmentId,
  ];
  if (operation === "deployment-list") {
    args.push("--limit", "100", "--json");
  }
  return Object.freeze({
    args: Object.freeze(args),
    executable: RAILWAY_CLI_EXECUTABLE,
    operation,
  });
}

export function buildRailwayDeploymentListArgs(context) {
  return buildRailwayCommand({ operation: "deployment-list", context }).args;
}

export function buildRailwayUploadArgs(context) {
  return buildRailwayCommand({ operation: "upload", context }).args;
}

function executeRailwayFile(executable, args, options) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout ??= stdout;
        error.stderr ??= stderr;
        reject(error);
        return;
      }
      resolve({ stderr, stdout });
    });
  });
}

export async function executeRailwayDeploymentList({
  context,
  timeoutMs = 30_000,
  execFileImpl = executeRailwayFile,
}) {
  try {
    const { stdout = "" } = await execFileImpl(
      RAILWAY_CLI_EXECUTABLE,
      buildRailwayDeploymentListArgs(context),
      {
        encoding: "utf8",
        env: process.env,
        maxBuffer: 2 * 1024 * 1024,
        shell: false,
        timeout: timeoutMs,
        windowsHide: true,
      }
    );
    return stdout;
  } catch (error) {
    throw new RailwayCommandAdapterError("RAILWAY_PROCESS_FAILED", {
      command: "deployment",
      exitCode: error?.code,
      stderr: error?.stderr,
      timedOut:
        error?.code === "ETIMEDOUT" ||
        (error?.killed === true && error?.signal === "SIGTERM"),
    });
  }
}

export async function verifyRailwayCliHelpContract({
  execFileImpl = executeRailwayFile,
} = {}) {
  const readHelp = async (command, invocation) => {
    try {
      const { stdout = "" } = await invocation;
      return stdout;
    } catch (error) {
      throw new RailwayCommandAdapterError(
        "RAILWAY_CLI_CONTRACT_UNAVAILABLE",
        { command, exitCode: error?.code }
      );
    }
  };
  const options = {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 2 * 1024 * 1024,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  };
  const [versionOutput, deploymentListHelp, uploadHelp] = await Promise.all([
    readHelp(
      "version",
      execFileImpl(RAILWAY_CLI_EXECUTABLE, ["--version"], options)
    ),
    readHelp(
      "deployment",
      execFileImpl(
        RAILWAY_CLI_EXECUTABLE,
        ["deployment", "list", "--help"],
        options
      )
    ),
    readHelp(
      "up",
      execFileImpl(RAILWAY_CLI_EXECUTABLE, ["up", "--help"], options)
    ),
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
    throw new RailwayCommandAdapterError("RAILWAY_CLI_CONTRACT_MISMATCH");
  }
  return { version: "5.28.0", listOptionsPresent, uploadOptionsPresent };
}

export async function executeRailwayUpload(context) {
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
    if (spawnError || exitCode !== 0) {
      throw new RailwayCommandAdapterError("RAILWAY_PROCESS_FAILED", {
        command: "up",
        exitCode: spawnError?.code ?? exitCode,
        stderr: spawnError?.stderr ?? stderrText,
      });
    }
    return { exitCode };
  } finally {
    await Promise.allSettled([unlink(stdoutPath), unlink(stderrPath)]);
  }
}
