export type SafeFcmRegistrationErrorSummary = {
  name?: string;
  code?: string;
  status?: number;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

/** Safe FCM registration failure summary — no tokens, headers, or raw bodies. */
export function safeFcmRegistrationErrorSummary(
  error: unknown
): SafeFcmRegistrationErrorSummary {
  if (error == null) {
    return { reason: "unknown_registration_error" };
  }

  if (typeof error === "string") {
    return { reason: classifyReasonFromText(error) };
  }

  if (!isRecord(error)) {
    return { reason: "unknown_registration_error" };
  }

  const name = typeof error.name === "string" ? error.name : undefined;
  const code = typeof error.code === "string" ? error.code : undefined;
  const status = extractStatus(error);
  const message = typeof error.message === "string" ? error.message : undefined;

  const reason = classifyReason({
    name,
    code,
    status,
    message,
  });

  return { name, code, status, reason };
}

function extractStatus(error: Record<string, unknown>): number | undefined {
  const data = error.data;
  if (isRecord(data) && typeof data.httpStatus === "number") {
    return data.httpStatus;
  }

  const response = error.response;
  if (isRecord(response) && typeof response.status === "number") {
    return response.status;
  }

  return undefined;
}

function classifyReason(input: {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}): string {
  const status = input.status;
  if (status === 401 || status === 403) return "auth_required";
  if (status != null && status >= 500) return "server_error";
  if (status != null && status >= 400) return "client_error";

  const haystack = [input.code, input.name, input.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return classifyReasonFromText(haystack);
}

function classifyReasonFromText(text: string): string {
  const lower = text.toLowerCase();

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout")
  ) {
    return "timeout";
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("offline")
  ) {
    return "network_error";
  }

  if (
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("authorization") ||
    lower.includes("bearer") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "auth_required";
  }

  if (lower.includes("500") || lower.includes("502") || lower.includes("503")) {
    return "server_error";
  }

  return "unknown_registration_error";
}

export function logFcmRegistrationFailure(context: string, error: unknown) {
  console.warn(`[FCM] ${context}`, safeFcmRegistrationErrorSummary(error));
}
