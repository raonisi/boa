export type SanitizedAuthError = {
  name: string;
  code?: string;
  status?: number;
  isAxiosError: boolean;
  message: string;
};

/** Safe auth failure log payload — never includes tokens, headers, or raw Axios bodies. */
export function sanitizeAuthError(error: unknown): SanitizedAuthError {
  if (error == null || typeof error !== "object") {
    return {
      name: "AuthError",
      isAxiosError: false,
      message: "Mobile Google login failed",
    };
  }

  const maybeError = error as {
    name?: unknown;
    code?: unknown;
    isAxiosError?: unknown;
    response?: { status?: unknown };
  };

  const status =
    typeof maybeError.response?.status === "number"
      ? maybeError.response.status
      : undefined;

  return {
    name: typeof maybeError.name === "string" ? maybeError.name : "AuthError",
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
    status,
    isAxiosError: maybeError.isAxiosError === true,
    message: "Mobile Google login failed",
  };
}
