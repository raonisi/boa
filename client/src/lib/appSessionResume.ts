import { TRPCClientError } from "@trpc/client";

import { UNAUTHED_ERR_MSG } from "@shared/const";

export const APP_SESSION_COPY = {
  checkingTitle: "세션을 확인하고 있습니다",
  checkingDescription: "로그인 상태를 다시 확인하고 있습니다.",
  expiredTitle: "다시 로그인이 필요합니다",
  expiredDescription: "보안을 위해 다시 로그인이 필요합니다.",
  networkTitle: "연결 상태를 확인해 주세요",
  networkDescription: "네트워크 연결이 안정되면 다시 시도해 주세요.",
  loginButton: "다시 로그인",
  retryButton: "다시 시도",
} as const;

export type AppSessionResumeStatus = "idle" | "checking" | "expired" | "network";

declare global {
  interface Window {
    __boaHandleAppResume?: () => void;
    __boaSuppressAuthRedirect?: boolean;
  }
}

export function setAppSessionResumeRedirectSuppressed(isSuppressed: boolean) {
  if (typeof window === "undefined") return;

  if (isSuppressed) {
    window.__boaSuppressAuthRedirect = true;
    return;
  }

  delete window.__boaSuppressAuthRedirect;
}

export function isAppSessionResumeRedirectSuppressed() {
  if (typeof window === "undefined") return false;
  return window.__boaSuppressAuthRedirect === true;
}

export function isUnauthorizedSessionError(error: unknown) {
  if (error instanceof TRPCClientError) {
    return error.data?.code === "UNAUTHORIZED" || error.message === UNAUTHED_ERR_MSG;
  }

  if (error instanceof Error) {
    return error.message === UNAUTHED_ERR_MSG;
  }

  return false;
}

export function isNetworkSessionError(error: unknown) {
  if (error instanceof TRPCClientError) {
    const code = error.data?.code;
    if (code === "TIMEOUT" || code === "CLIENT_CLOSED_REQUEST") return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network") ||
    normalized.includes("fetch failed")
  );
}
