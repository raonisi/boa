import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const RAILWAY_ID = "123e4567-e89b-42d3-a456-426614174000";

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

function successfulFetch() {
  return async url =>
    url.endsWith("/api/health")
      ? jsonResponse({
          ok: true,
          service: "boa-crm",
          version: { commitShort: SHA_A.slice(0, 7) },
        })
      : jsonResponse({
          ok: true,
          serviceName: "boa-crm",
          environmentLabel: "production",
          commitShort: SHA_A.slice(0, 7),
        });
}

test("health verification accepts HTTP 200 only when production and SHA match", async () => {
  const result = await verifyProductionHealthOnce({
    expectedSha: SHA_A,
    fetchImpl: successfulFetch(),
  });
  assert.deepEqual(result, {
    ok: true,
    commitShort: SHA_A.slice(0, 7),
    environment: "production",
  });
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
            version: { commitShort: SHA_B.slice(0, 7) },
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

test("production workflow keeps secrets behind exact-SHA and arming gates", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/production-deploy.yml", import.meta.url),
    "utf8"
  );
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \["Quality Gate"\]/);
  assert.match(workflow, /group: boa-production-deploy/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /vars\.PRODUCTION_DEPLOY_ENABLED/);
  assert.match(workflow, /secrets\.RAILWAY_TOKEN/);
  assert.equal(workflow.match(/secrets\.RAILWAY_TOKEN/g)?.length, 2);
  const deployJob = workflow.slice(workflow.indexOf("  deploy:"));
  const deployJobEnv = deployJob.slice(
    deployJob.indexOf("    env:"),
    deployJob.indexOf("    steps:")
  );
  assert.doesNotMatch(deployJobEnv, /RAILWAY_TOKEN/);
  assert.match(workflow, /@railway\/cli@5\.28\.0/);
  assert.match(workflow, /railway up --ci/);
  assert.match(workflow, /verify-production-health\.mjs/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.doesNotMatch(workflow, /\|\| true/);
  assert.doesNotMatch(workflow, /pnpm db:migrate/);
});
