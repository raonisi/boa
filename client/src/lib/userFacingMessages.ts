import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

import { UNAUTHED_ERR_MSG } from "@shared/const";

const HANGUL = /[가-힣]/;

const TECHNICAL_PATTERNS =
  /^(Failed|Unauthorized|Forbidden|Unknown|Error|TRPC|Network|fetch|Unexpected|Internal server)/i;

export type UserFacingErrorContext =
  | "auth"
  | "customer"
  | "admin"
  | "mutation"
  | "network"
  | "route"
  | "default";

export const USER_FACING_ERRORS = {
  sessionExpired: "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
  permission: "현재 권한으로는 이 기능을 사용할 수 없습니다.",
  customerNotFound: "데이터가 없거나 접근할 수 없습니다.",
  validation: "입력 내용을 확인해 주세요.",
  saveFailed: "변경사항을 저장하지 못했습니다. 다시 시도해 주세요.",
  loadFailed: "정보를 불러오지 못했습니다. 다시 시도해 주세요.",
  network: "연결 상태를 확인한 뒤 다시 시도해 주세요.",
  unsupportedRoute: "요청한 화면을 표시할 수 없습니다.",
  unknown: "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export const FORBIDDEN_UX = {
  title: "접근 권한이 없습니다",
  description: USER_FACING_ERRORS.permission,
  dashboardLabel: "대시보드로 이동",
  backLabel: "이전 화면으로",
} as const;

export const CUSTOMER_ACCESS_UX = {
  title: "정보를 확인할 수 없습니다",
  description: USER_FACING_ERRORS.customerNotFound,
  listActionLabel: "고객 목록으로 이동",
  backLabel: FORBIDDEN_UX.backLabel,
} as const;

function getTrpcErrorCode(error: unknown): string | undefined {
  if (!(error instanceof TRPCClientError)) return undefined;
  return error.data?.code;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  return "";
}

function isTechnicalMessage(message: string): boolean {
  return (
    message.includes(" at ") ||
    message.includes("stack") ||
    message.length > 160 ||
    TECHNICAL_PATTERNS.test(message)
  );
}

function isSafeKoreanUserMessage(message: string): boolean {
  return Boolean(message) && HANGUL.test(message) && !isTechnicalMessage(message);
}

function defaultFallbackForContext(context: UserFacingErrorContext): string {
  switch (context) {
    case "auth":
      return USER_FACING_ERRORS.sessionExpired;
    case "customer":
      return USER_FACING_ERRORS.customerNotFound;
    case "admin":
      return USER_FACING_ERRORS.permission;
    case "mutation":
      return USER_FACING_ERRORS.saveFailed;
    case "network":
      return USER_FACING_ERRORS.network;
    case "route":
      return USER_FACING_ERRORS.unsupportedRoute;
    default:
      return USER_FACING_ERRORS.unknown;
  }
}

/** 사용자 화면용 — raw exception·영어·tRPC 내부 메시지는 안전한 한국어로 대체 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback?: string,
  context: UserFacingErrorContext = "default"
): string {
  const safeFallback = fallback ?? defaultFallbackForContext(context);
  const code = getTrpcErrorCode(error);
  const message = getErrorMessage(error);

  if (code === "UNAUTHORIZED" || message === UNAUTHED_ERR_MSG) {
    return USER_FACING_ERRORS.sessionExpired;
  }

  if (code === "FORBIDDEN") {
    return context === "customer"
      ? USER_FACING_ERRORS.customerNotFound
      : USER_FACING_ERRORS.permission;
  }

  if (code === "NOT_FOUND") {
    return context === "customer"
      ? USER_FACING_ERRORS.customerNotFound
      : safeFallback;
  }

  if (code === "BAD_REQUEST") {
    if (isSafeKoreanUserMessage(message)) return message;
    return USER_FACING_ERRORS.validation;
  }

  if (
    code === "TIMEOUT" ||
    code === "CLIENT_CLOSED_REQUEST" ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.toLowerCase().includes("network")
  ) {
    return USER_FACING_ERRORS.network;
  }

  if (!message) return safeFallback;
  if (isTechnicalMessage(message)) return safeFallback;
  if (HANGUL.test(message)) return message;
  return safeFallback;
}

export function toastUserFacingError(
  error: unknown,
  fallback?: string,
  context: UserFacingErrorContext = "mutation"
) {
  toast.error(getUserFacingErrorMessage(error, fallback, context));
}
