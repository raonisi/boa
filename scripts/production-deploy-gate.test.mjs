import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import {
  REQUIRED_QUALITY_JOBS,
  evaluateProductionDeployEligibility,
  validateDeploymentConfiguration,
} from "./verify-production-deploy-eligibility.mjs";
import {
  ProductionHealthError,
  pollProductionHealth,
  verifyProductionHealthOnce,
} from "./verify-production-health.mjs";
import {
  ReleaseIdentityError,
  renderReleaseIdentity,
  stampReleaseIdentity,
  validateReleaseSha,
  verifyReleaseIdentity,
} from "./stamp-release-identity.mjs";
import {
  buildRailwayDeploymentListArgs,
  buildRailwayUploadArgs,
  classifyRailwayCliFailure,
  createDeploymentSnapshot,
  createRailwayDeploymentState,
  createRailwayFailureDiagnostic,
  executeRailwayCliDeploymentGate,
  executeRailwayDeploymentGate,
  listDeploymentsFromCli,
  pollTrackedDeployment,
  RAILWAY_PRODUCTION_COMMANDS,
  RailwayDeploymentError,
  resolveNewDeployment,
  runRailwayCliCommand,
  shouldSkipDeployment,
  validateRailwayAuthenticationEnvironment,
  verifyRailwayCliHelpContract,
  writeRailwayFailureDiagnostic,
} from "./verify-railway-deployment.mjs";
import {
  ProductionWorkflowRatchetError,
  validateProductionWorkflowActions,
  validateProductionWorkflowRatchets,
  validateProductionWorkflowTriggers,
} from "./verify-production-workflow-ratchets.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_SAME_PREFIX = `${"a".repeat(7)}${"c".repeat(33)}`;
const RAILWAY_ID = "123e4567-e89b-42d3-a456-426614174000";
const SERVICE_ID = "223e4567-e89b-42d3-a456-426614174000";
const ENVIRONMENT_ID = "323e4567-e89b-42d3-a456-426614174000";
const DEPLOYMENT_A = "423e4567-e89b-42d3-a456-426614174000";
const DEPLOYMENT_B = "523e4567-e89b-42d3-a456-426614174000";
const DEPLOYMENT_C = "623e4567-e89b-42d3-a456-426614174000";
const RAILWAY_CONTEXT = Object.freeze({
  projectId: RAILWAY_ID,
  serviceId: SERVICE_ID,
  environmentId: ENVIRONMENT_ID,
});
const PINNED_ACTION = `owner/action@${SHA_A}`;

function validateRailwayCommandStructure({ args, source, kind = "args" }) {
  const allowed = new Set(
    Object.values(RAILWAY_PRODUCTION_COMMANDS).map(command =>
      command.subcommands.join(" ")
    )
  );
  const validate = signature => {
    if (!allowed.has(signature)) {
      throw new ProductionWorkflowRatchetError(
        "UNSUPPORTED_RAILWAY_COMMAND",
        `Railway command is not allowlisted: ${signature || "<empty>"}`
      );
    }
    return signature;
  };
  const signatureFor = commandArgs =>
    commandArgs[0] === "deployment"
      ? commandArgs.slice(0, 2).join(" ")
      : (commandArgs[0] ?? "");

  if (kind === "args") {
    return validate(signatureFor(args ?? []));
  }

  if (typeof source !== "string") {
    throw new ProductionWorkflowRatchetError(
      "INVALID_RAILWAY_COMMAND_SOURCE",
      "Railway command source must be a string."
    );
  }

  if (kind === "workflow") {
    const signatures = [];
    let blockIndent = null;
    for (const rawLine of source.split(/\r?\n/)) {
      if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
      const indent = rawLine.length - rawLine.trimStart().length;
      const trimmed = rawLine.trim();
      if (blockIndent !== null && indent > blockIndent) {
        const command = trimmed.match(/^railway\s+(\S+)(?:\s+(\S+))?/);
        if (command) {
          signatures.push(
            command[1] === "deployment"
              ? `${command[1]} ${command[2] ?? ""}`.trim()
              : command[1]
          );
        }
        continue;
      }
      blockIndent = null;
      const run = trimmed.match(/^-?\s*run:\s*(.*)$/);
      if (!run) continue;
      if (/^[|>][+-]?$/.test(run[1])) {
        blockIndent = indent;
        continue;
      }
      const command = run[1].match(/^railway\s+(\S+)(?:\s+(\S+))?/);
      if (command) {
        signatures.push(
          command[1] === "deployment"
            ? `${command[1]} ${command[2] ?? ""}`.trim()
            : command[1]
        );
      }
    }
    return signatures.map(validate);
  }

  if (kind !== "javascript") {
    throw new ProductionWorkflowRatchetError(
      "INVALID_RAILWAY_COMMAND_SOURCE_KIND",
      `Unsupported Railway source kind: ${kind}`
    );
  }

  const syntaxTree = ts.createSourceFile(
    "railway-command-fixture.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const signatures = [];
  const runners = new Set(["execFile", "execFileAsync", "spawn"]);
  const visit = node => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      !runners.has(node.expression.text)
    ) {
      ts.forEachChild(node, visit);
      return;
    }
    const [executable, commandArguments] = node.arguments;
    if (
      !(
        (ts.isStringLiteral(executable) && executable.text === "railway") ||
        (ts.isIdentifier(executable) &&
          executable.text === "RAILWAY_CLI_EXECUTABLE")
      )
    ) {
      ts.forEachChild(node, visit);
      return;
    }
    if (
      ts.isCallExpression(commandArguments) &&
      ts.isIdentifier(commandArguments.expression) &&
      commandArguments.expression.text === "buildRailwayUploadArgs"
    ) {
      signatures.push(validate("up"));
    } else if (ts.isArrayLiteralExpression(commandArguments)) {
      const commandArgs = commandArguments.elements
        .filter(ts.isStringLiteral)
        .map(element => element.text);
      signatures.push(validate(signatureFor(commandArgs)));
    }
    ts.forEachChild(node, visit);
  };
  visit(syntaxTree);
  return signatures;
}

function workflowWithTrigger(trigger) {
  return `name: Fixture\n${trigger}\npermissions: {}\njobs: {}`;
}

function workflowWithUses(uses, { jobLevel = false } = {}) {
  return jobLevel
    ? `name: Fixture\non: push\njobs:\n  call:\n    uses: ${uses}`
    : `name: Fixture\non: push\njobs:\n  test:\n    steps:\n      - uses: ${uses}`;
}

const SAFE_WORKFLOW_RUN_TRIGGER = `on:
  workflow_run:
    workflows: ["Quality Gate"]
    types: [completed]`;

function successfulJobs() {
  return REQUIRED_QUALITY_JOBS.map(name => ({
    name,
    status: "completed",
    conclusion: "success",
  }));
}

function eligibleInput(overrides = {}) {
  return {
    armingSwitch: "true",
    workflowName: "Quality Gate",
    conclusion: "success",
    event: "push",
    headBranch: "main",
    repository: "raonisi/boa",
    headRepository: "raonisi/boa",
    runId: "12345",
    candidateSha: SHA_A,
    currentMainSha: SHA_A,
    checkoutSha: SHA_A,
    jobs: successfulJobs(),
    ...overrides,
  };
}

test("only an exact current main Quality Gate run with seven successful jobs is eligible", () => {
  const result = evaluateProductionDeployEligibility(eligibleInput());
  assert.equal(result.eligible, true);
  assert.deepEqual(
    Object.values(result.requiredJobs),
    Array(7).fill("success")
  );
});

for (const [name, override, reason] of [
  ["failed gate", { conclusion: "failure" }, "UNSUCCESSFUL_GATE"],
  ["cancelled gate", { conclusion: "cancelled" }, "UNSUCCESSFUL_GATE"],
  ["PR event", { event: "pull_request" }, "UNTRUSTED_EVENT"],
  ["wrong branch", { headBranch: "feature/pr" }, "WRONG_BRANCH"],
  ["fork", { headRepository: "attacker/boa" }, "UNTRUSTED_HEAD_REPOSITORY"],
  ["wrong repository", { repository: "attacker/boa" }, "WRONG_REPOSITORY"],
  ["stale SHA", { currentMainSha: SHA_B }, "STALE_SHA"],
  ["checkout mismatch", { checkoutSha: SHA_B }, "CHECKOUT_SHA_MISMATCH"],
  ["arming switch false", { armingSwitch: "false" }, "ARMING_SWITCH_DISABLED"],
  [
    "arming switch missing",
    { armingSwitch: undefined },
    "ARMING_SWITCH_DISABLED",
  ],
]) {
  test(`${name} is blocked`, () => {
    const result = evaluateProductionDeployEligibility(eligibleInput(override));
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes(reason));
  });
}

test("a skipped required job is blocked", () => {
  const jobs = successfulJobs();
  jobs[3] = { name: "build", status: "completed", conclusion: "skipped" };
  const result = evaluateProductionDeployEligibility(eligibleInput({ jobs }));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("REQUIRED_JOB_NOT_SUCCESS:build"));
});

test("missing and duplicate required jobs fail closed", () => {
  const missing = successfulJobs().filter(job => job.name !== "coverage");
  const duplicate = [...successfulJobs(), successfulJobs()[0]];
  assert.ok(
    evaluateProductionDeployEligibility(
      eligibleInput({ jobs: missing })
    ).reasons.includes("REQUIRED_JOB_MISSING:coverage")
  );
  assert.ok(
    evaluateProductionDeployEligibility(
      eligibleInput({ jobs: duplicate })
    ).reasons.includes("REQUIRED_JOB_DUPLICATE:check")
  );
});

test("queued A becomes stale when B is main and only B remains eligible", () => {
  const queuedA = evaluateProductionDeployEligibility(
    eligibleInput({
      candidateSha: SHA_A,
      checkoutSha: SHA_A,
      currentMainSha: SHA_B,
    })
  );
  const currentB = evaluateProductionDeployEligibility(
    eligibleInput({
      candidateSha: SHA_B,
      checkoutSha: SHA_B,
      currentMainSha: SHA_B,
    })
  );
  assert.equal(queuedA.eligible, false);
  assert.equal(currentB.eligible, true);
});

test("deployment configuration requires all protected settings without exposing values", () => {
  const valid = validateDeploymentConfiguration({
    armingSwitch: "true",
    preDeployVerified: "true",
    hasRailwayToken: true,
    projectId: RAILWAY_ID,
    serviceId: RAILWAY_ID,
    environmentId: RAILWAY_ID,
  });
  assert.equal(valid.valid, true);

  const invalid = validateDeploymentConfiguration({
    armingSwitch: "TRUE",
    preDeployVerified: "false",
    hasRailwayToken: false,
    projectId: "$(malicious)",
    serviceId: "",
    environmentId: undefined,
  });
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.reasons, [
    "ARMING_SWITCH_DISABLED",
    "PRE_DEPLOY_NOT_VERIFIED",
    "RAILWAY_TOKEN_MISSING",
    "RAILWAY_PROJECT_ID_INVALID",
    "RAILWAY_SERVICE_ID_INVALID",
    "RAILWAY_ENVIRONMENT_ID_INVALID",
  ]);
});

function jsonResponse(
  body,
  { status = 200, contentType = "application/json" } = {}
) {
  return {
    status,
    headers: {
      get: name => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    json: async () => body,
  };
}

function successfulFetch({
  healthSha = SHA_A,
  versionSha = healthSha,
  environment = "production",
  healthCommitSha = true,
  versionCommitSha = true,
} = {}) {
  return async url =>
    url.endsWith("/api/health")
      ? jsonResponse({
          ok: true,
          service: "boa-crm",
          version: {
            environmentLabel: environment,
            ...(healthCommitSha ? { commitSha: healthSha } : {}),
            commitShort: healthSha.slice(0, 7),
          },
        })
      : jsonResponse({
          ok: true,
          serviceName: "boa-crm",
          environmentLabel: environment,
          ...(versionCommitSha ? { commitSha: versionSha } : {}),
          commitShort: versionSha.slice(0, 7),
        });
}

test("health verification accepts HTTP 200 only when production and SHA match", async () => {
  const result = await verifyProductionHealthOnce({
    expectedSha: SHA_A,
    fetchImpl: successfulFetch(),
  });
  assert.deepEqual(result, {
    ok: true,
    commitSha: SHA_A,
    commitShort: SHA_A.slice(0, 7),
    environment: "production",
  });
});

for (const invalidSha of [
  "a".repeat(39),
  "a".repeat(41),
  "A".repeat(40),
  `${"a".repeat(39)}g`,
  "development",
]) {
  test(`health verification rejects malformed expected SHA: ${invalidSha.length}`, async () => {
    await assert.rejects(
      verifyProductionHealthOnce({
        expectedSha: invalidSha,
        fetchImpl: successfulFetch(),
      }),
      error =>
        error instanceof ProductionHealthError &&
        error.code === "INVALID_EXPECTED_SHA"
    );
  });
}

test("health verification rejects a different full SHA with the same seven-character prefix", async () => {
  await assert.rejects(
    verifyProductionHealthOnce({
      expectedSha: SHA_A,
      fetchImpl: successfulFetch({ healthSha: SHA_SAME_PREFIX }),
    }),
    error =>
      error instanceof ProductionHealthError &&
      error.code === "HEALTH_PAYLOAD_MISMATCH"
  );
});

test("health verification rejects missing full SHA and short-only payloads", async () => {
  await assert.rejects(
    verifyProductionHealthOnce({
      expectedSha: SHA_A,
      fetchImpl: successfulFetch({ healthCommitSha: false }),
    }),
    error =>
      error instanceof ProductionHealthError &&
      error.code === "HEALTH_PAYLOAD_MISMATCH"
  );
  await assert.rejects(
    verifyProductionHealthOnce({
      expectedSha: SHA_A,
      fetchImpl: successfulFetch({ versionCommitSha: false }),
    }),
    error =>
      error instanceof ProductionHealthError &&
      error.code === "VERSION_PAYLOAD_MISMATCH"
  );
});

test("health verification rejects development and endpoint SHA disagreement", async () => {
  await assert.rejects(
    verifyProductionHealthOnce({
      expectedSha: SHA_A,
      fetchImpl: successfulFetch({ environment: "development" }),
    }),
    error =>
      error instanceof ProductionHealthError &&
      error.code === "HEALTH_PAYLOAD_MISMATCH"
  );
  await assert.rejects(
    verifyProductionHealthOnce({
      expectedSha: SHA_A,
      fetchImpl: successfulFetch({ versionSha: SHA_B }),
    }),
    error =>
      error instanceof ProductionHealthError &&
      error.code === "VERSION_PAYLOAD_MISMATCH"
  );
});

for (const [name, fetchImpl, code] of [
  ["HTTP 500", async () => jsonResponse({}, { status: 500 }), "HTTP_NOT_200"],
  [
    "HTML 200",
    async () => jsonResponse({}, { contentType: "text/html" }),
    "NON_JSON_RESPONSE",
  ],
  [
    "SHA mismatch",
    async url =>
      url.endsWith("/api/health")
        ? jsonResponse({
            ok: true,
            service: "boa-crm",
            version: {
              environmentLabel: "production",
              commitSha: SHA_B,
              commitShort: SHA_B.slice(0, 7),
            },
          })
        : jsonResponse({}),
    "HEALTH_PAYLOAD_MISMATCH",
  ],
  [
    "network timeout",
    async () => Promise.reject(new Error("timeout")),
    "HTTP_REQUEST_FAILED",
  ],
]) {
  test(`health verification rejects ${name}`, async () => {
    await assert.rejects(
      verifyProductionHealthOnce({ expectedSha: SHA_A, fetchImpl }),
      error => error instanceof ProductionHealthError && error.code === code
    );
  });
}

test("polling requires consecutive stable responses and times out fail-closed", async () => {
  let request = 0;
  const unstableFetch = async url => {
    request += 1;
    if (request <= 2) return successfulFetch()(url);
    throw new Error("not ready");
  };
  await assert.rejects(
    pollProductionHealth({
      expectedSha: SHA_A,
      fetchImpl: unstableFetch,
      attempts: 3,
      intervalMs: 0,
      requiredConsecutiveSuccesses: 2,
    }),
    error =>
      error instanceof ProductionHealthError &&
      error.code.startsWith("HEALTH_TIMEOUT:")
  );

  const stable = await pollProductionHealth({
    expectedSha: SHA_A,
    fetchImpl: successfulFetch(),
    attempts: 3,
    intervalMs: 0,
    requiredConsecutiveSuccesses: 2,
  });
  assert.equal(stable.attemptsUsed, 2);
});

test("release identity accepts only an exact lowercase full SHA", () => {
  assert.equal(validateReleaseSha(SHA_A), SHA_A);
  for (const invalid of [
    "a".repeat(39),
    "a".repeat(41),
    "A".repeat(40),
    `${"a".repeat(39)}g`,
    ` ${SHA_A}`,
  ]) {
    assert.throws(
      () => validateReleaseSha(invalid),
      error =>
        error instanceof ReleaseIdentityError &&
        error.code === "INVALID_RELEASE_SHA"
    );
  }
});

test("release identity rendering serializes only the validated candidate", () => {
  const rendered = renderReleaseIdentity(SHA_A);
  assert.match(rendered, new RegExp(SHA_A));
  assert.doesNotMatch(rendered, /token|secret|branch|pull_request/i);
});

test("release identity stamp is verified byte-for-byte and rejects stale source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "boa-release-identity-"));
  const outputPath = join(directory, "releaseIdentity.ts");
  try {
    await stampReleaseIdentity({ releaseSha: SHA_A, outputPath });
    await verifyReleaseIdentity({ releaseSha: SHA_A, outputPath });
    await writeFile(outputPath, renderReleaseIdentity(SHA_B), "utf8");
    await assert.rejects(
      verifyReleaseIdentity({ releaseSha: SHA_A, outputPath }),
      error =>
        error instanceof ReleaseIdentityError &&
        error.code === "RELEASE_IDENTITY_MISMATCH"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const OLD_TIME = "2026-07-23T23:59:00.000Z";
const BEFORE_TIME = "2026-07-24T00:00:00.000Z";
const START_TIME = "2026-07-24T00:00:01.000Z";
const NEW_TIME = "2026-07-24T00:00:02.000Z";
const AFTER_TIME = "2026-07-24T00:00:03.000Z";

function deployment(id, status, createdAt = NEW_TIME) {
  return { id, status, createdAt };
}

function snapshot(
  deployments,
  capturedAt = AFTER_TIME,
  context = RAILWAY_CONTEXT
) {
  return createDeploymentSnapshot({ deployments, capturedAt, context });
}

test("Railway CLI argument contracts keep one allowlisted context", () => {
  assert.deepEqual(
    Object.values(RAILWAY_PRODUCTION_COMMANDS).map(command => ({
      command: command.command,
      signature: command.subcommands.join(" "),
    })),
    [
      { command: "railway", signature: "deployment list" },
      { command: "railway", signature: "up" },
    ]
  );
  const listArgs = buildRailwayDeploymentListArgs(RAILWAY_CONTEXT);
  assert.deepEqual(listArgs, [
    "deployment",
    "list",
    "--project",
    RAILWAY_ID,
    "--service",
    SERVICE_ID,
    "--environment",
    ENVIRONMENT_ID,
    "--limit",
    "100",
    "--json",
  ]);
  assert.deepEqual(buildRailwayUploadArgs(RAILWAY_CONTEXT), [
    "up",
    "--project",
    RAILWAY_ID,
    "--service",
    SERVICE_ID,
    "--environment",
    ENVIRONMENT_ID,
  ]);
  assert.equal(
    validateRailwayCommandStructure({ args: listArgs }),
    "deployment list"
  );
  assert.equal(
    validateRailwayCommandStructure({
      args: buildRailwayUploadArgs(RAILWAY_CONTEXT),
    }),
    "up"
  );
});

for (const [name, args] of [
  ["link args", ["link", "--project", RAILWAY_ID]],
  ["status args", ["status", "--json"]],
  ["login args", ["login"]],
  ["variables args", ["variables"]],
  ["run args", ["run"]],
  ["shell args", ["shell"]],
  ["connect args", ["connect"]],
]) {
  test(`Railway command ratchet rejects ${name}`, () => {
    assert.throws(
      () => validateRailwayCommandStructure({ args }),
      error =>
        error instanceof ProductionWorkflowRatchetError &&
        error.code === "UNSUPPORTED_RAILWAY_COMMAND"
    );
  });
}

for (const [name, source] of [
  ["spawn link", 'spawn("railway", ["link"])'],
  ["execFile status", 'execFile("railway", ["status", "--json"])'],
]) {
  test(`Railway process invocation ratchet rejects ${name}`, () => {
    assert.throws(
      () => validateRailwayCommandStructure({ source, kind: "javascript" }),
      error =>
        error instanceof ProductionWorkflowRatchetError &&
        error.code === "UNSUPPORTED_RAILWAY_COMMAND"
    );
  });
}

test("Railway process invocation ratchet accepts only explicit allowed commands", () => {
  assert.deepEqual(
    validateRailwayCommandStructure({
      source:
        'execFile("railway", ["deployment", "list"]); spawn("railway", ["up"]);',
      kind: "javascript",
    }),
    ["deployment list", "up"]
  );
});

for (const [name, source] of [
  ["single-line link", "steps:\n  - run: railway link --project project-id"],
  ["block status", "steps:\n  - run: |\n      railway status --json"],
]) {
  test(`Railway workflow ratchet rejects ${name}`, () => {
    assert.throws(
      () => validateRailwayCommandStructure({ source, kind: "workflow" }),
      error =>
        error instanceof ProductionWorkflowRatchetError &&
        error.code === "UNSUPPORTED_RAILWAY_COMMAND"
    );
  });
}

test("Railway workflow ratchet accepts explicit allowed commands", () => {
  assert.deepEqual(
    validateRailwayCommandStructure({
      source:
        "steps:\n  - run: railway deployment list --project project-id\n  - run: |\n      railway up --project project-id",
      kind: "workflow",
    }),
    ["deployment list", "up"]
  );
});

test("Railway command ratchet ignores comments, documentation, and fixture strings", () => {
  assert.deepEqual(
    validateRailwayCommandStructure({
      source: `
        // spawn("railway", ["link"])
        /* execFile("railway", ["status"]) */
        const documentation = 'railway link --project example';
        const fixture = 'spawn("railway", ["status"])';
      `,
      kind: "javascript",
    }),
    []
  );
  assert.deepEqual(
    validateRailwayCommandStructure({
      source: `
        # run: railway link --project example
        steps:
          - run: echo "railway status is forbidden"
      `,
      kind: "workflow",
    }),
    []
  );
});

test("installed Railway CLI 5.28.0 exposes the explicit-ID contract", async () => {
  assert.deepEqual(await verifyRailwayCliHelpContract(), {
    version: "5.28.0",
    listOptionsPresent: true,
    uploadOptionsPresent: true,
  });
});

test("Railway CLI commands use argument arrays with shell disabled", async () => {
  let invocation;
  const args = buildRailwayDeploymentListArgs(RAILWAY_CONTEXT);
  const stdout = await runRailwayCliCommand({
    args,
    stage: "preflight-list",
    execFileImpl: async (file, receivedArgs, options) => {
      invocation = { file, receivedArgs, options };
      return { stdout: "[]" };
    },
  });
  assert.equal(stdout, "[]");
  assert.match(invocation.file, /railway(?:\.exe)?$/);
  assert.deepEqual(invocation.receivedArgs, args);
  assert.equal(invocation.options.shell, false);
  assert.equal(
    invocation.receivedArgs.some(value => /token/i.test(value)),
    false
  );
});

test("Railway authentication requires only the project token", () => {
  assert.doesNotThrow(() =>
    validateRailwayAuthenticationEnvironment({ RAILWAY_TOKEN: "present" })
  );
  assert.throws(
    () => validateRailwayAuthenticationEnvironment({}),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "RAILWAY_TOKEN_MISSING"
  );
  assert.throws(
    () =>
      validateRailwayAuthenticationEnvironment({
        RAILWAY_TOKEN: "present",
        RAILWAY_API_TOKEN: "also-present",
      }),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "RAILWAY_AUTH_FAILED"
  );
});

test("Railway CLI failure classification emits only bounded preflight codes", () => {
  const secret = "railway-secret-value";
  for (const [stderr, timedOut, code] of [
    [`Unauthorized: token ${secret}`, false, "RAILWAY_PREFLIGHT_AUTH_FAILED"],
    ["Forbidden", false, "RAILWAY_PREFLIGHT_FORBIDDEN"],
    ["Project not found", false, "RAILWAY_PREFLIGHT_CONTEXT_NOT_FOUND"],
    [
      "unexpected argument '--project'",
      false,
      "RAILWAY_DEPLOYMENT_LIST_COMMAND_FAILED",
    ],
    ["", true, "RAILWAY_DEPLOYMENT_LIST_TIMEOUT"],
  ]) {
    const error = classifyRailwayCliFailure({
      stage: "preflight-list",
      command: "deployment",
      exitCode: 1,
      stderr,
      timedOut,
    });
    assert.equal(error.code, code);
    assert.doesNotMatch(JSON.stringify(error), new RegExp(secret));
  }
  const unknown = classifyRailwayCliFailure({
    stage: "preflight-list",
    command: "deployment",
    exitCode: 1,
    stderr: `opaque failure ${secret}`,
  });
  assert.equal(unknown.code, "RAILWAY_CLI_UNKNOWN_FAILURE");
  assert.doesNotMatch(JSON.stringify(unknown), new RegExp(secret));
});

test("deployment list accepts normal and empty JSON but rejects malformed or invalid schema", async () => {
  const populated = await listDeploymentsFromCli(RAILWAY_CONTEXT, {
    runCommand: async () =>
      JSON.stringify([deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME)]),
  });
  assert.equal(populated.deployments.length, 1);
  const empty = await listDeploymentsFromCli(RAILWAY_CONTEXT, {
    runCommand: async () => "[]",
  });
  assert.deepEqual(empty.deployments, []);
  await assert.rejects(
    listDeploymentsFromCli(RAILWAY_CONTEXT, {
      runCommand: async () => "not-json",
    }),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "RAILWAY_DEPLOYMENT_LIST_INVALID_JSON"
  );
  await assert.rejects(
    listDeploymentsFromCli(RAILWAY_CONTEXT, {
      runCommand: async () => JSON.stringify([{ id: "invalid" }]),
    }),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "RAILWAY_DEPLOYMENT_LIST_INVALID_SCHEMA"
  );
});

for (const [name, code, preflight] of [
  [
    "command failure",
    "RAILWAY_DEPLOYMENT_LIST_COMMAND_FAILED",
    async context =>
      listDeploymentsFromCli(context, {
        runCommand: async () => {
          throw new RailwayDeploymentError(
            "RAILWAY_DEPLOYMENT_LIST_COMMAND_FAILED",
            { stage: "preflight-list", exitCode: 2 }
          );
        },
      }),
  ],
  [
    "malformed JSON",
    "RAILWAY_DEPLOYMENT_LIST_INVALID_JSON",
    async context =>
      listDeploymentsFromCli(context, {
        runCommand: async () => "not-json",
      }),
  ],
  [
    "invalid schema",
    "RAILWAY_DEPLOYMENT_LIST_INVALID_SCHEMA",
    async context =>
      listDeploymentsFromCli(context, {
        runCommand: async () => JSON.stringify([{ id: "invalid" }]),
      }),
  ],
  [
    "authentication failure",
    "RAILWAY_PREFLIGHT_AUTH_FAILED",
    async context =>
      listDeploymentsFromCli(context, {
        runCommand: async () => {
          throw classifyRailwayCliFailure({
            stage: "preflight-list",
            command: "deployment",
            exitCode: 1,
            stderr: "Unauthorized",
          });
        },
      }),
  ],
  [
    "context not found",
    "RAILWAY_PREFLIGHT_CONTEXT_NOT_FOUND",
    async context =>
      listDeploymentsFromCli(context, {
        runCommand: async () => {
          throw classifyRailwayCliFailure({
            stage: "preflight-list",
            command: "deployment",
            exitCode: 1,
            stderr: "Service not found",
          });
        },
      }),
  ],
  [
    "timeout",
    "RAILWAY_DEPLOYMENT_LIST_TIMEOUT",
    async context =>
      listDeploymentsFromCli(context, {
        runCommand: async () => {
          throw classifyRailwayCliFailure({
            stage: "preflight-list",
            command: "deployment",
            exitCode: null,
            stderr: "",
            timedOut: true,
          });
        },
      }),
  ],
]) {
  test(`initial ${name} prevents upload at the high-level gate`, async () => {
    let uploadCount = 0;
    const deploymentState = createRailwayDeploymentState();
    await assert.rejects(
      executeRailwayCliDeploymentGate({
        context: RAILWAY_CONTEXT,
        candidateSha: SHA_A,
        deploymentState,
        fetchSnapshot: async (context, phase) => {
          assert.equal(phase, "preflight");
          return preflight(context);
        },
        upload: async () => {
          uploadCount += 1;
          return { exitCode: 0 };
        },
        checkCandidateHealth: async () => {},
        verifyStableHealth: async () => {},
      }),
      error => error instanceof RailwayDeploymentError && error.code === code
    );
    assert.equal(uploadCount, 0);
    assert.deepEqual(deploymentState, createRailwayDeploymentState());
  });
}

test("initial forbidden preflight fails closed before every production side effect", async () => {
  const tokenMarker = "railway-token-marker";
  const deploymentState = createRailwayDeploymentState();
  let fetchCount = 0;
  let postUploadListCount = 0;
  let uploadCount = 0;
  let healthCount = 0;
  let caughtError;

  await assert.rejects(
    executeRailwayCliDeploymentGate({
      context: RAILWAY_CONTEXT,
      candidateSha: SHA_A,
      deploymentState,
      fetchSnapshot: async (context, phase) => {
        fetchCount += 1;
        if (phase === "post-upload") postUploadListCount += 1;
        assert.equal(phase, "preflight");
        return listDeploymentsFromCli(context, {
          runCommand: async () => {
            throw classifyRailwayCliFailure({
              stage: "preflight-list",
              command: "deployment",
              exitCode: 1,
              stderr: `permission denied ${tokenMarker}`,
            });
          },
        });
      },
      upload: async () => {
        uploadCount += 1;
        return { exitCode: 0 };
      },
      checkCandidateHealth: async () => {
        healthCount += 1;
      },
      verifyStableHealth: async () => {
        healthCount += 1;
      },
    }),
    error => {
      caughtError = error;
      return (
        error instanceof RailwayDeploymentError &&
        error.code === "RAILWAY_PREFLIGHT_FORBIDDEN"
      );
    }
  );

  assert.equal(fetchCount, 1);
  assert.equal(postUploadListCount, 0);
  assert.equal(uploadCount, 0);
  assert.equal(healthCount, 0);
  assert.deepEqual(deploymentState, {
    uploadAttempted: false,
    uploadCommandCompleted: false,
    uploadExitCodeKnown: false,
    deploymentRegistration: "not_attempted",
    trackedDeploymentIdPresent: false,
  });
  const diagnostic = JSON.stringify(
    createRailwayFailureDiagnostic({
      error: caughtError,
      candidateSha: SHA_A,
      deploymentState,
    })
  );
  assert.match(diagnostic, /RAILWAY_PREFLIGHT_FORBIDDEN/);
  assert.doesNotMatch(diagnostic, /RAILWAY_CLI_UNKNOWN_FAILURE/);
  assert.doesNotMatch(diagnostic, /permission denied/i);
  assert.doesNotMatch(diagnostic, new RegExp(tokenMarker));
  assert.doesNotMatch(diagnostic, /stderr/i);
});

for (const [name, postUploadList] of [
  [
    "command failure",
    async context =>
      listDeploymentsFromCli(context, {
        phase: "post-upload",
        runCommand: async () => {
          throw new RailwayDeploymentError("RAILWAY_POST_UPLOAD_LIST_FAILED", {
            stage: "post-upload-list",
            exitCode: 1,
          });
        },
      }),
  ],
  [
    "malformed JSON",
    async context =>
      listDeploymentsFromCli(context, {
        phase: "post-upload",
        runCommand: async () => "not-json",
      }),
  ],
]) {
  test(`post-upload ${name} records unknown registration without retrying upload`, async () => {
    let fetchCount = 0;
    let uploadCount = 0;
    const deploymentState = createRailwayDeploymentState();
    await assert.rejects(
      executeRailwayCliDeploymentGate({
        context: RAILWAY_CONTEXT,
        candidateSha: SHA_A,
        deploymentState,
        fetchSnapshot: async (context, phase) => {
          fetchCount += 1;
          return fetchCount === 1
            ? snapshot([], BEFORE_TIME, context)
            : postUploadList(context, phase);
        },
        upload: async () => {
          uploadCount += 1;
          return { exitCode: 0 };
        },
        checkCandidateHealth: async () => {
          throw new Error("not live");
        },
        verifyStableHealth: async () => {},
        now: () => START_TIME,
        registrationIntervalMs: 0,
      }),
      error =>
        error instanceof RailwayDeploymentError &&
        error.code === "RAILWAY_POST_UPLOAD_LIST_FAILED"
    );
    assert.equal(uploadCount, 1);
    assert.deepEqual(deploymentState, {
      uploadAttempted: true,
      uploadCommandCompleted: true,
      uploadExitCodeKnown: true,
      deploymentRegistration: "unknown",
      trackedDeploymentIdPresent: false,
    });
  });
}

for (const [name, afterDeployments, registration] of [
  ["zero new IDs", [], "not_observed"],
  [
    "two new IDs",
    [deployment(DEPLOYMENT_B, "BUILDING"), deployment(DEPLOYMENT_C, "QUEUED")],
    "ambiguous",
  ],
]) {
  test(`${name} produces an explicit registration state`, async () => {
    let fetchCount = 0;
    let uploadCount = 0;
    const deploymentState = createRailwayDeploymentState();
    await assert.rejects(
      executeRailwayCliDeploymentGate({
        context: RAILWAY_CONTEXT,
        candidateSha: SHA_A,
        deploymentState,
        fetchSnapshot: async (context, phase) => {
          fetchCount += 1;
          assert.equal(phase, fetchCount === 1 ? "preflight" : "post-upload");
          return snapshot(
            fetchCount === 1 ? [] : afterDeployments,
            fetchCount === 1 ? BEFORE_TIME : AFTER_TIME,
            context
          );
        },
        upload: async () => {
          uploadCount += 1;
          return { exitCode: 0 };
        },
        checkCandidateHealth: async () => {
          throw new Error("not live");
        },
        verifyStableHealth: async () => {},
        now: () => START_TIME,
        registrationAttempts: 1,
        registrationIntervalMs: 0,
      }),
      error =>
        error instanceof RailwayDeploymentError &&
        error.code === "RAILWAY_POST_UPLOAD_REGISTRATION_UNKNOWN"
    );
    assert.equal(uploadCount, 1);
    assert.equal(deploymentState.deploymentRegistration, registration);
    assert.equal(deploymentState.trackedDeploymentIdPresent, false);
  });
}

test("one new ID is observed and tracked exactly", async () => {
  const snapshots = [
    snapshot([], BEFORE_TIME),
    snapshot([deployment(DEPLOYMENT_B, "BUILDING")]),
    snapshot([deployment(DEPLOYMENT_B, "SUCCESS")]),
  ];
  const deploymentState = createRailwayDeploymentState();
  const result = await executeRailwayCliDeploymentGate({
    context: RAILWAY_CONTEXT,
    candidateSha: SHA_A,
    deploymentState,
    fetchSnapshot: async () => snapshots.shift(),
    upload: async () => ({ exitCode: 0 }),
    checkCandidateHealth: async () => {
      throw new Error("not live");
    },
    verifyStableHealth: async () => {},
    now: () => START_TIME,
    registrationIntervalMs: 0,
    statusIntervalMs: 0,
  });
  assert.equal(result.deploymentId, DEPLOYMENT_B);
  assert.equal(deploymentState.deploymentRegistration, "observed");
  assert.equal(deploymentState.trackedDeploymentIdPresent, true);
});

test("sanitized diagnostics separate upload and registration state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "boa-railway-diagnostic-"));
  const outputPath = join(directory, "diagnostic.json");
  const secret = "railway-secret-value";
  try {
    const error = classifyRailwayCliFailure({
      stage: "preflight-list",
      command: "deployment",
      exitCode: 1,
      stderr: `Forbidden ${secret}`,
    });
    const deploymentState = createRailwayDeploymentState();
    const diagnostic = createRailwayFailureDiagnostic({
      error,
      candidateSha: SHA_A,
      deploymentState,
    });
    await writeRailwayFailureDiagnostic(outputPath, diagnostic);
    const serialized = await readFile(outputPath, "utf8");
    assert.deepEqual(JSON.parse(serialized), {
      stage: "preflight-list",
      code: "RAILWAY_PREFLIGHT_FORBIDDEN",
      exitCode: 1,
      candidateSha: SHA_A,
      uploadAttempted: false,
      uploadCommandCompleted: false,
      uploadExitCodeKnown: false,
      deploymentRegistration: "not_attempted",
      trackedDeploymentIdPresent: false,
    });
    assert.doesNotMatch(serialized, new RegExp(secret));
    assert.doesNotMatch(serialized, /Forbidden/);
    assert.doesNotMatch(serialized, /stderr/);
    assert.doesNotMatch(serialized, /deploymentCreated/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("deployment resolver selects exactly one new scoped deployment", () => {
  const before = snapshot(
    [deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME)],
    BEFORE_TIME
  );
  const after = snapshot([
    deployment(DEPLOYMENT_B, "BUILDING"),
    deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME),
  ]);
  assert.equal(
    resolveNewDeployment({ before, after, deploymentStartedAt: START_TIME }).id,
    DEPLOYMENT_B
  );
});

for (const [name, afterDeployments, code] of [
  [
    "zero new deployments",
    [deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME)],
    "NEW_DEPLOYMENT_NOT_FOUND",
  ],
  [
    "two new deployments",
    [
      deployment(DEPLOYMENT_B, "BUILDING"),
      deployment(DEPLOYMENT_C, "QUEUED"),
      deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME),
    ],
    "AMBIGUOUS_NEW_DEPLOYMENTS",
  ],
  [
    "only a removed new deployment",
    [
      deployment(DEPLOYMENT_B, "REMOVED"),
      deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME),
    ],
    "NEW_DEPLOYMENT_NOT_FOUND",
  ],
]) {
  test(`deployment resolver fails closed for ${name}`, () => {
    const before = snapshot(
      [deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME)],
      BEFORE_TIME
    );
    const after = snapshot(afterDeployments);
    assert.throws(
      () =>
        resolveNewDeployment({
          before,
          after,
          deploymentStartedAt: START_TIME,
        }),
      error => error instanceof RailwayDeploymentError && error.code === code
    );
  });
}

test("deployment resolver rejects another service or environment context", () => {
  const before = snapshot([], BEFORE_TIME);
  for (const context of [
    { ...RAILWAY_CONTEXT, serviceId: DEPLOYMENT_A },
    { ...RAILWAY_CONTEXT, environmentId: DEPLOYMENT_A },
  ]) {
    const after = snapshot(
      [deployment(DEPLOYMENT_B, "BUILDING")],
      AFTER_TIME,
      context
    );
    assert.throws(
      () =>
        resolveNewDeployment({
          before,
          after,
          deploymentStartedAt: START_TIME,
        }),
      error =>
        error instanceof RailwayDeploymentError &&
        error.code === "DEPLOYMENT_CONTEXT_MISMATCH"
    );
  }
});

test("deployment snapshot rejects unknown status fail-closed", () => {
  assert.throws(
    () => snapshot([deployment(DEPLOYMENT_A, "SLEEPING")]),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "UNKNOWN_DEPLOYMENT_STATUS"
  );
});

test("deployment polling follows one immutable ID through SUCCESS", async () => {
  const states = ["BUILDING", "DEPLOYING", "SUCCESS"];
  let index = 0;
  const result = await pollTrackedDeployment({
    deploymentId: DEPLOYMENT_B,
    expectedContext: RAILWAY_CONTEXT,
    fetchSnapshot: async () =>
      snapshot([
        deployment(DEPLOYMENT_C, "SUCCESS"),
        deployment(DEPLOYMENT_B, states[index++]),
      ]),
    attempts: 3,
    intervalMs: 0,
  });
  assert.equal(result.deployment.id, DEPLOYMENT_B);
  assert.equal(result.deployment.status, "SUCCESS");
  assert.equal(result.attemptsUsed, 3);
});

for (const status of ["FAILED", "CRASHED", "REMOVED", "REMOVING", "SKIPPED"]) {
  test(`deployment polling rejects terminal ${status}`, async () => {
    await assert.rejects(
      pollTrackedDeployment({
        deploymentId: DEPLOYMENT_B,
        expectedContext: RAILWAY_CONTEXT,
        fetchSnapshot: async () => snapshot([deployment(DEPLOYMENT_B, status)]),
        attempts: 1,
        intervalMs: 0,
      }),
      error =>
        error instanceof RailwayDeploymentError &&
        error.code === `DEPLOYMENT_TERMINAL_FAILURE:${status}`
    );
  });
}

test("deployment polling times out and revalidates context", async () => {
  await assert.rejects(
    pollTrackedDeployment({
      deploymentId: DEPLOYMENT_B,
      expectedContext: RAILWAY_CONTEXT,
      fetchSnapshot: async () =>
        snapshot([deployment(DEPLOYMENT_B, "BUILDING")]),
      attempts: 2,
      intervalMs: 0,
    }),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "DEPLOYMENT_STATUS_TIMEOUT"
  );
  await assert.rejects(
    pollTrackedDeployment({
      deploymentId: DEPLOYMENT_B,
      expectedContext: RAILWAY_CONTEXT,
      fetchSnapshot: async () =>
        snapshot([deployment(DEPLOYMENT_B, "SUCCESS")], AFTER_TIME, {
          ...RAILWAY_CONTEXT,
          serviceId: DEPLOYMENT_A,
        }),
      attempts: 1,
      intervalMs: 0,
    }),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "DEPLOYMENT_CONTEXT_MISMATCH"
  );
});

test("deployment completion calls health only after the tracked ID succeeds", async () => {
  const events = [];
  const snapshots = [
    snapshot([deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME)], BEFORE_TIME),
    snapshot([
      deployment(DEPLOYMENT_B, "BUILDING"),
      deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME),
    ]),
    snapshot([deployment(DEPLOYMENT_B, "DEPLOYING")]),
    snapshot([deployment(DEPLOYMENT_B, "SUCCESS")]),
  ];
  const result = await executeRailwayDeploymentGate({
    candidateSha: SHA_A,
    fetchSnapshot: async () => {
      events.push("list");
      return snapshots.shift();
    },
    upload: async () => {
      events.push("upload");
      return { exitCode: 0 };
    },
    checkCandidateHealth: async () => {
      events.push("pre-health-miss");
      throw new Error("not live");
    },
    verifyStableHealth: async () => events.push("stable-health"),
    now: () => START_TIME,
    sleep: async () => {},
    registrationIntervalMs: 0,
    statusIntervalMs: 0,
  });
  assert.equal(result.outcome, "deployed");
  assert.equal(result.deploymentId, DEPLOYMENT_B);
  assert.equal(result.status, "SUCCESS");
  assert.equal(events.at(-1), "stable-health");
});

for (const name of [
  "candidate already live",
  "same Gate rerun",
  "serialized concurrent second workflow",
]) {
  test(`${name} is an idempotent no-op`, async () => {
    let uploaded = false;
    let stableHealthCalled = false;
    const before = snapshot([deployment(DEPLOYMENT_A, "SUCCESS", OLD_TIME)]);
    assert.equal(
      shouldSkipDeployment({ before, candidateHealthMatches: true }),
      true
    );
    const result = await executeRailwayDeploymentGate({
      candidateSha: SHA_A,
      fetchSnapshot: async () => before,
      upload: async () => {
        uploaded = true;
        return { exitCode: 0 };
      },
      checkCandidateHealth: async () => {},
      verifyStableHealth: async () => {
        stableHealthCalled = true;
      },
    });
    assert.equal(result.outcome, "already-deployed");
    assert.equal(uploaded, false);
    assert.equal(stableHealthCalled, false);
  });
}

test("an existing in-progress deployment blocks a competing upload", async () => {
  let uploaded = false;
  await assert.rejects(
    executeRailwayDeploymentGate({
      candidateSha: SHA_A,
      fetchSnapshot: async () =>
        snapshot([deployment(DEPLOYMENT_A, "DEPLOYING", OLD_TIME)]),
      upload: async () => {
        uploaded = true;
        return { exitCode: 0 };
      },
      checkCandidateHealth: async () => {},
      verifyStableHealth: async () => {},
    }),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "DEPLOYMENT_ALREADY_IN_PROGRESS"
  );
  assert.equal(uploaded, false);
});

test("a failed previous deployment with candidate not live allows one retry", async () => {
  let uploadCount = 0;
  const snapshots = [
    snapshot([deployment(DEPLOYMENT_A, "FAILED", OLD_TIME)], BEFORE_TIME),
    snapshot([deployment(DEPLOYMENT_B, "SUCCESS")]),
    snapshot([deployment(DEPLOYMENT_B, "SUCCESS")]),
  ];
  const result = await executeRailwayDeploymentGate({
    candidateSha: SHA_A,
    fetchSnapshot: async () => snapshots.shift(),
    upload: async () => ({ exitCode: (uploadCount += 1) - 1 }),
    checkCandidateHealth: async () => {
      throw new Error("candidate not live");
    },
    verifyStableHealth: async () => {},
    now: () => START_TIME,
    sleep: async () => {},
    registrationIntervalMs: 0,
    statusIntervalMs: 0,
  });
  assert.equal(result.outcome, "deployed");
  assert.equal(uploadCount, 1);
});

test("upload command failure prevents deployment polling and health verification", async () => {
  let stableHealthCalled = false;
  const snapshots = [snapshot([], BEFORE_TIME)];
  const deploymentState = createRailwayDeploymentState();
  await assert.rejects(
    executeRailwayDeploymentGate({
      candidateSha: SHA_A,
      deploymentState,
      fetchSnapshot: async () => snapshots.shift(),
      upload: async () => {
        throw new RailwayDeploymentError("RAILWAY_UPLOAD_COMMAND_FAILED", {
          stage: "upload",
          exitCode: 1,
        });
      },
      checkCandidateHealth: async () => {
        throw new Error("not live");
      },
      verifyStableHealth: async () => {
        stableHealthCalled = true;
      },
      now: () => START_TIME,
      sleep: async () => {},
      registrationIntervalMs: 0,
      statusIntervalMs: 0,
    }),
    error =>
      error instanceof RailwayDeploymentError &&
      error.code === "RAILWAY_UPLOAD_COMMAND_FAILED"
  );
  assert.equal(snapshots.length, 0);
  assert.equal(stableHealthCalled, false);
  assert.deepEqual(deploymentState, {
    uploadAttempted: true,
    uploadCommandCompleted: true,
    uploadExitCodeKnown: true,
    deploymentRegistration: "unknown",
    trackedDeploymentIdPresent: false,
  });
});

test("workflow_run with the exact Quality Gate completion policy passes", () => {
  const result = validateProductionWorkflowTriggers(
    workflowWithTrigger(SAFE_WORKFLOW_RUN_TRIGGER)
  );
  assert.deepEqual(result.triggerKeys, ["workflow_run"]);
  assert.deepEqual(result.workflowRun.workflows, ["Quality Gate"]);
  assert.deepEqual(result.workflowRun.types, ["completed"]);
});

for (const [name, trigger, code] of [
  ["scalar push", "on: push", "UNSAFE_TRIGGER_SET"],
  ["flow-sequence push", "on: [push]", "UNSAFE_TRIGGER_SET"],
  ["block-sequence push", "on:\n  - push", "UNSAFE_TRIGGER_SET"],
  [
    "workflow_run plus push",
    `${SAFE_WORKFLOW_RUN_TRIGGER}\n  push:\n    branches: [main]`,
    "UNSAFE_TRIGGER_SET",
  ],
  [
    "workflow_run plus workflow_dispatch",
    `${SAFE_WORKFLOW_RUN_TRIGGER}\n  workflow_dispatch:`,
    "UNSAFE_TRIGGER_SET",
  ],
  ["pull_request", "on: pull_request", "UNSAFE_TRIGGER_SET"],
  ["pull_request_target", "on: pull_request_target", "UNSAFE_TRIGGER_SET"],
  ["schedule", "on: schedule", "UNSAFE_TRIGGER_SET"],
  ["repository_dispatch", "on: repository_dispatch", "UNSAFE_TRIGGER_SET"],
  [
    "wrong workflow name",
    `on:\n  workflow_run:\n    workflows: ["Other Gate"]\n    types: [completed]`,
    "INVALID_WORKFLOW_RUN_WORKFLOWS",
  ],
  [
    "additional workflow name",
    `on:\n  workflow_run:\n    workflows: ["Quality Gate", "Other Gate"]\n    types: [completed]`,
    "INVALID_WORKFLOW_RUN_WORKFLOWS",
  ],
  [
    "wrong workflow_run type",
    `on:\n  workflow_run:\n    workflows: ["Quality Gate"]\n    types: [requested]`,
    "INVALID_WORKFLOW_RUN_TYPES",
  ],
  [
    "additional workflow_run type",
    `on:\n  workflow_run:\n    workflows: ["Quality Gate"]\n    types: [completed, requested]`,
    "INVALID_WORKFLOW_RUN_TYPES",
  ],
]) {
  test(`${name} production trigger fails closed`, () => {
    assert.throws(
      () => validateProductionWorkflowTriggers(workflowWithTrigger(trigger)),
      error =>
        error instanceof ProductionWorkflowRatchetError && error.code === code
    );
  });
}

test("external action pinned to a lowercase full commit SHA passes", () => {
  const result = validateProductionWorkflowActions(
    workflowWithUses(PINNED_ACTION)
  );
  assert.deepEqual(
    result.externalActions.map(action => ({
      action: action.action,
      ref: action.ref,
    })),
    [{ action: "owner/action", ref: SHA_A }]
  );
});

test("repository-local action passes without an external ref", () => {
  const result = validateProductionWorkflowActions(
    workflowWithUses("./.github/actions/local")
  );
  assert.equal(result.localActions.length, 1);
  assert.equal(result.externalActions.length, 0);
});

for (const [name, uses, options] of [
  ["version tag", "actions/checkout@v4"],
  ["branch", "actions/setup-node@main"],
  ["short SHA", "owner/action@abc1234"],
  ["uppercase SHA", `owner/action@${"A".repeat(40)}`],
  ["expression ref", "owner/action@${{ inputs.ref }}"],
  [
    "job-level reusable workflow",
    "owner/repo/.github/workflows/deploy.yml@main",
    { jobLevel: true },
  ],
  ["new arbitrary mutable action", "other/action@v1"],
]) {
  test(`${name} action ref fails closed`, () => {
    assert.throws(
      () => validateProductionWorkflowActions(workflowWithUses(uses, options)),
      error => error instanceof ProductionWorkflowRatchetError
    );
  });
}

test("flow-map uses syntax cannot bypass action collection", () => {
  for (const key of ["uses", '"uses"', "'uses'"]) {
    const workflow = `name: Fixture\non: push\njobs: { test: { steps: [{ ${key}: other/action@main }] } }`;
    assert.throws(
      () => validateProductionWorkflowActions(workflow),
      error =>
        error instanceof ProductionWorkflowRatchetError &&
        error.code === "UNSUPPORTED_USES_SYNTAX"
    );
  }
});

test("all current production workflow external actions use immutable refs", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/production-deploy.yml", import.meta.url),
    "utf8"
  );
  const result = validateProductionWorkflowActions(workflow);
  assert.equal(result.externalActions.length, 5);
  assert.deepEqual(
    [...new Set(result.externalActions.map(action => action.action))].sort(),
    ["actions/checkout", "actions/setup-node", "actions/upload-artifact"]
  );
  assert.ok(
    result.externalActions.every(action => /^[0-9a-f]{40}$/.test(action.ref))
  );
});

test("production workflow keeps secrets behind exact-SHA and arming gates", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/production-deploy.yml", import.meta.url),
    "utf8"
  );
  const railwayHelper = await readFile(
    new URL("./verify-railway-deployment.mjs", import.meta.url),
    "utf8"
  );
  assert.deepEqual(
    validateRailwayCommandStructure({
      source: railwayHelper,
      kind: "javascript",
    }),
    ["up"]
  );
  assert.deepEqual(
    validateRailwayCommandStructure({ source: workflow, kind: "workflow" }),
    []
  );
  assert.equal(
    railwayHelper.match(/\bexecFileImpl\s*\(\s*RAILWAY_CLI_EXECUTABLE\s*,/g)
      ?.length,
    2
  );
  assert.equal(railwayHelper.match(/\bspawn\s*\(/g)?.length, 1);
  assert.match(
    railwayHelper,
    /\bspawn\s*\(\s*RAILWAY_CLI_EXECUTABLE\s*,\s*buildRailwayUploadArgs\s*\(context\)/
  );
  assert.doesNotMatch(railwayHelper, /\b(?:execFile|execFileAsync)\s*\(/);
  const ratchets = validateProductionWorkflowRatchets(workflow);
  assert.deepEqual(ratchets.triggers.triggerKeys, ["workflow_run"]);
  assert.deepEqual(ratchets.triggers.workflowRun.workflows, ["Quality Gate"]);
  assert.deepEqual(ratchets.triggers.workflowRun.types, ["completed"]);
  assert.equal(ratchets.actions.externalActions.length, 5);
  assert.match(workflow, /group: boa-production-deploy/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /vars\.PRODUCTION_DEPLOY_ENABLED/);
  assert.match(workflow, /secrets\.RAILWAY_TOKEN/);
  assert.equal(workflow.match(/secrets\.RAILWAY_TOKEN/g)?.length, 2);
  const eligibilityJob = workflow.slice(0, workflow.indexOf("  deploy:"));
  assert.doesNotMatch(eligibilityJob, /RAILWAY_TOKEN/);
  const deployJob = workflow.slice(workflow.indexOf("  deploy:"));
  const deployJobEnv = deployJob.slice(
    deployJob.indexOf("    env:"),
    deployJob.indexOf("    steps:")
  );
  assert.doesNotMatch(deployJobEnv, /RAILWAY_TOKEN/);
  assert.match(workflow, /@railway\/cli@5\.28\.0/);
  assert.match(workflow, /stamp-release-identity\.mjs/);
  assert.match(workflow, /verify-railway-deployment\.mjs/);
  assert.match(workflow, /railway-deploy-diagnostic\.json/);
  assert.match(workflow, /retention-days: 1/);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/);
  assert.doesNotMatch(workflow, /railway up --ci|railway up --json/);
  assert.doesNotMatch(workflow, /railway variable set/);
  const deploymentListBuilder = railwayHelper.slice(
    railwayHelper.indexOf("export function buildRailwayDeploymentListArgs"),
    railwayHelper.indexOf("export function buildRailwayUploadArgs")
  );
  assert.match(
    deploymentListBuilder,
    /RAILWAY_PRODUCTION_COMMANDS\.deploymentList\.subcommands/
  );
  assert.match(deploymentListBuilder, /"--project"/);
  const uploadBuilder = railwayHelper.slice(
    railwayHelper.indexOf("export function buildRailwayUploadArgs"),
    railwayHelper.indexOf("export async function runRailwayCliCommand")
  );
  assert.match(
    uploadBuilder,
    /RAILWAY_PRODUCTION_COMMANDS\.upload\.subcommands/
  );
  assert.doesNotMatch(uploadBuilder, /"--ci"|"--json"/);
  assert.doesNotMatch(
    railwayHelper,
    /buildRailwayLinkArgs|prepareRailwayCliContext/
  );
  assert.match(railwayHelper, /shell: false/);
  assert.doesNotMatch(railwayHelper, /console\.(?:error|log)\([^\n]*stderr/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /\|\| true/);
  assert.doesNotMatch(workflow, /pnpm db:migrate/);
});
