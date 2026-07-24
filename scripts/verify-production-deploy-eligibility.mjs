import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_QUALITY_JOBS = Object.freeze([
  "check",
  "unit-test",
  "coverage",
  "build",
  "bundle-budget",
  "e2e-critical",
  "accessibility",
]);

const EXPECTED_REPOSITORY = "raonisi/boa";
const EXPECTED_WORKFLOW = "Quality Gate";
const EXPECTED_BRANCH = "main";
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const RAILWAY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeSha(value) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return FULL_SHA_PATTERN.test(candidate) ? candidate : null;
}

function isPositiveRunId(value) {
  return /^\d+$/.test(String(value ?? "")) && Number(value) > 0;
}

function safeJobs(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.jobs)) return value.jobs;
  return [];
}

export function evaluateProductionDeployEligibility(input) {
  const reasons = [];
  const candidateSha = normalizeSha(input?.candidateSha);
  const currentMainSha = normalizeSha(input?.currentMainSha);
  const checkoutSha = normalizeSha(input?.checkoutSha);

  if (input?.armingSwitch !== "true") reasons.push("ARMING_SWITCH_DISABLED");
  if (input?.workflowName !== EXPECTED_WORKFLOW) reasons.push("WRONG_WORKFLOW");
  if (input?.conclusion !== "success") reasons.push("UNSUCCESSFUL_GATE");
  if (input?.event !== "push") reasons.push("UNTRUSTED_EVENT");
  if (input?.headBranch !== EXPECTED_BRANCH) reasons.push("WRONG_BRANCH");
  if (input?.repository !== EXPECTED_REPOSITORY)
    reasons.push("WRONG_REPOSITORY");
  if (input?.headRepository !== EXPECTED_REPOSITORY) {
    reasons.push("UNTRUSTED_HEAD_REPOSITORY");
  }
  if (!isPositiveRunId(input?.runId)) reasons.push("INVALID_RUN_ID");
  if (!candidateSha) reasons.push("INVALID_CANDIDATE_SHA");
  if (!currentMainSha) reasons.push("INVALID_MAIN_SHA");
  if (!checkoutSha) reasons.push("INVALID_CHECKOUT_SHA");
  if (candidateSha && currentMainSha && candidateSha !== currentMainSha) {
    reasons.push("STALE_SHA");
  }
  if (candidateSha && checkoutSha && candidateSha !== checkoutSha) {
    reasons.push("CHECKOUT_SHA_MISMATCH");
  }

  const jobs = safeJobs(input?.jobs);
  const requiredJobs = {};
  for (const requiredName of REQUIRED_QUALITY_JOBS) {
    const matches = jobs.filter(job => job?.name === requiredName);
    if (matches.length === 0) {
      requiredJobs[requiredName] = "missing";
      reasons.push(`REQUIRED_JOB_MISSING:${requiredName}`);
      continue;
    }
    if (matches.length !== 1) {
      requiredJobs[requiredName] = "duplicate";
      reasons.push(`REQUIRED_JOB_DUPLICATE:${requiredName}`);
      continue;
    }
    const [job] = matches;
    const succeeded =
      job.status === "completed" && job.conclusion === "success";
    requiredJobs[requiredName] = succeeded ? "success" : "not-success";
    if (!succeeded) reasons.push(`REQUIRED_JOB_NOT_SUCCESS:${requiredName}`);
  }

  return {
    eligible: reasons.length === 0,
    candidateSha,
    runId: isPositiveRunId(input?.runId) ? String(input.runId) : null,
    requiredJobs,
    reasons,
  };
}

export function validateDeploymentConfiguration(input) {
  const reasons = [];
  if (input?.armingSwitch !== "true") reasons.push("ARMING_SWITCH_DISABLED");
  if (input?.preDeployVerified !== "true") {
    reasons.push("PRE_DEPLOY_NOT_VERIFIED");
  }
  if (input?.hasRailwayToken !== true) reasons.push("RAILWAY_TOKEN_MISSING");
  for (const [key, value] of [
    ["RAILWAY_PROJECT_ID", input?.projectId],
    ["RAILWAY_SERVICE_ID", input?.serviceId],
    ["RAILWAY_ENVIRONMENT_ID", input?.environmentId],
  ]) {
    if (typeof value !== "string" || !RAILWAY_ID_PATTERN.test(value.trim())) {
      reasons.push(`${key}_INVALID`);
    }
  }
  return { valid: reasons.length === 0, reasons };
}

async function writeGitHubOutputs(path, result) {
  if (!path) return;
  const lines = [
    `eligible=${result.eligible ? "true" : "false"}`,
    `candidate_sha=${result.candidateSha ?? ""}`,
    `gate_run_id=${result.runId ?? ""}`,
  ];
  await appendFile(path, `${lines.join("\n")}\n`, "utf8");
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args[0] === "--validate-config") {
    const result = validateDeploymentConfiguration({
      armingSwitch: process.env.PRODUCTION_DEPLOY_ENABLED,
      preDeployVerified: process.env.RAILWAY_PRE_DEPLOY_VERIFIED,
      hasRailwayToken: Boolean(process.env.RAILWAY_TOKEN?.trim()),
      projectId: process.env.RAILWAY_PROJECT_ID,
      serviceId: process.env.RAILWAY_SERVICE_ID,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
    });
    console.log(JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
    return;
  }

  const inputPath = args[0];
  if (!inputPath) throw new Error("Eligibility input path is required");
  const strict = args.includes("--strict");
  const outputIndex = args.indexOf("--github-output");
  const githubOutput = outputIndex >= 0 ? args[outputIndex + 1] : null;
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const result = evaluateProductionDeployEligibility(input);
  await writeGitHubOutputs(githubOutput, result);
  console.log(JSON.stringify(result));
  if (strict && !result.eligible) process.exitCode = 1;
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runCli().catch(error => {
    console.error(
      error instanceof SyntaxError ? "INVALID_GATE_INPUT" : "GATE_CHECK_FAILED"
    );
    process.exitCode = 1;
  });
}
