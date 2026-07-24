import { RELEASE_SHA } from "../generated/releaseIdentity";

export type SafeAppVersionMetadata = {
  ok: true;
  serviceName: "boa-crm";
  appVersion: string;
  commitSha: string | null;
  commitShort: string | null;
  buildTime: string | null;
  environmentLabel: "production" | "development" | "test";
  serverStartTime: string;
};

const SERVER_START_TIME = new Date().toISOString();
const FALLBACK_APP_VERSION = "1.0.0";
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;

const COMMIT_ENV_KEYS = [
  "APP_COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "RAILWAY_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "SOURCE_VERSION",
] as const;

const BUILD_TIME_ENV_KEYS = [
  "APP_BUILD_TIME",
  "BUILD_TIME",
  "VITE_BUILD_TIME",
  "RAILWAY_DEPLOYMENT_STARTED_AT",
  "SOURCE_DATE_EPOCH",
] as const;

function firstEnvValue(keys: readonly string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function safeAppVersion(value: string | undefined) {
  const candidate = value?.trim() || FALLBACK_APP_VERSION;
  if (/^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$/.test(candidate)) return candidate;
  return FALLBACK_APP_VERSION;
}

export function toCommitSha(value: string | null | undefined) {
  return typeof value === "string" && FULL_SHA_PATTERN.test(value)
    ? value
    : null;
}

export function toCommitShort(value: string | null | undefined) {
  return toCommitSha(value)?.slice(0, 7) ?? null;
}

function toIsoTime(value: string | null) {
  if (!value) return null;
  const numericEpoch = /^\d+$/.test(value) ? Number(value) : null;
  const date =
    numericEpoch !== null
      ? new Date(numericEpoch > 9_999_999_999 ? numericEpoch : numericEpoch * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getEnvironmentLabel(): SafeAppVersionMetadata["environmentLabel"] {
  if (process.env.NODE_ENV === "test") return "test";
  if (
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_SERVICE_ID
  ) {
    return "production";
  }
  if (
    process.env.E2E_TEST_MODE === "true" &&
    process.env.RAILWAY_ENVIRONMENT === "e2e"
  ) {
    return "test";
  }
  if (process.env.RAILWAY_ENVIRONMENT === "production") return "production";
  return "development";
}

export function getSafeAppVersionMetadata(): SafeAppVersionMetadata {
  const environmentLabel = getEnvironmentLabel();
  const stampedCommitSha = toCommitSha(RELEASE_SHA);
  const commitSha =
    stampedCommitSha ??
    (environmentLabel === "production"
      ? null
      : toCommitSha(firstEnvValue(COMMIT_ENV_KEYS)));
  return {
    ok: true,
    serviceName: "boa-crm",
    appVersion: safeAppVersion(
      process.env.APP_VERSION ?? process.env.npm_package_version
    ),
    commitSha,
    commitShort: toCommitShort(commitSha),
    buildTime: toIsoTime(firstEnvValue(BUILD_TIME_ENV_KEYS)),
    environmentLabel,
    serverStartTime: SERVER_START_TIME,
  };
}

export function getHealthVersionSummary() {
  const metadata = getSafeAppVersionMetadata();
  return {
    appVersion: metadata.appVersion,
    commitSha: metadata.commitSha,
    commitShort: metadata.commitShort,
    environmentLabel: metadata.environmentLabel,
  };
}
