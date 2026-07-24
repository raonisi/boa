import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
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
  createDeploymentSnapshot,
  executeRailwayDeploymentGate,
  pollTrackedDeployment,
  RailwayDeploymentError,
  resolveNewDeployment,
  shouldSkipDeployment,
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
        resolveNewDeployment({ before, after, deploymentStartedAt: START_TIME }),
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
    const after = snapshot([deployment(DEPLOYMENT_B, "BUILDING")], AFTER_TIME, context);
    assert.throws(
      () =>
        resolveNewDeployment({ before, after, deploymentStartedAt: START_TIME }),
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
        snapshot(
          [deployment(DEPLOYMENT_B, "SUCCESS")],
          AFTER_TIME,
          { ...RAILWAY_CONTEXT, serviceId: DEPLOYMENT_A }
        ),
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

test("deployment or migration failure prevents health verification", async () => {
  let stableHealthCalled = false;
  const snapshots = [
    snapshot([], BEFORE_TIME),
    snapshot([deployment(DEPLOYMENT_B, "FAILED")]),
    snapshot([deployment(DEPLOYMENT_B, "FAILED")]),
  ];
  await assert.rejects(
    executeRailwayDeploymentGate({
      candidateSha: SHA_A,
      fetchSnapshot: async () => snapshots.shift(),
      upload: async () => ({ exitCode: 1 }),
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
      error.code === "DEPLOYMENT_TERMINAL_FAILURE:FAILED"
  );
  assert.equal(stableHealthCalled, false);
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
  assert.equal(result.externalActions.length, 4);
  assert.deepEqual(
    [...new Set(result.externalActions.map(action => action.action))].sort(),
    ["actions/checkout", "actions/setup-node"]
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
  const ratchets = validateProductionWorkflowRatchets(workflow);
  assert.deepEqual(ratchets.triggers.triggerKeys, ["workflow_run"]);
  assert.deepEqual(ratchets.triggers.workflowRun.workflows, ["Quality Gate"]);
  assert.deepEqual(ratchets.triggers.workflowRun.types, ["completed"]);
  assert.equal(ratchets.actions.externalActions.length, 4);
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
  assert.doesNotMatch(workflow, /railway up --ci|railway up --json/);
  assert.doesNotMatch(workflow, /railway variable set/);
  assert.doesNotMatch(railwayHelper, /"up"[\s\S]{0,300}"--ci"/);
  assert.doesNotMatch(railwayHelper, /"up"[\s\S]{0,300}"--json"/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /\|\| true/);
  assert.doesNotMatch(workflow, /pnpm db:migrate/);
});
