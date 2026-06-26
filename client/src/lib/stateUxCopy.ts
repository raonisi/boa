import {
  CUSTOMER_ACCESS_UX,
  FORBIDDEN_UX,
  USER_FACING_ERRORS,
  type UserFacingErrorContext,
} from "@/lib/userFacingMessages";

/** BOA shared page-state copy — Loading / Empty / Error / Forbidden / sensitive access */
export const LOADING_UX = {
  defaultTitle: "정보를 불러오는 중입니다.",
  defaultDescription: "잠시만 기다려 주세요.",
  scopedTitle: (subject: string) => `${subject}을(를) 불러오는 중입니다.`,
  scopedDescription: (subject: string) =>
    `현재 조건의 ${subject}을(를) 확인하고 있습니다.`,
} as const;

export const EMPTY_UX = {
  title: (subject: string) => `표시할 ${subject}이 없습니다`,
  description: (subject: string) =>
    `현재 조건에서 확인할 ${subject}이 없습니다.`,
  filteredTitle: (subject: string) => `현재 필터에 맞는 ${subject}이 없습니다.`,
  filteredDescription: "필터를 초기화해 다시 확인해 보세요.",
  filterResetLabel: "필터 초기화",
  viewAllLabel: "전체 보기",
} as const;

export const ERROR_UX = {
  loadTitle: "정보를 불러오지 못했습니다.",
  loadDescription: "잠시 후 다시 시도해 주세요.",
  scopedLoadTitle: (subject: string) => `${subject}을(를) 불러오지 못했습니다.`,
  scopedLoadDescription: "조회에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  mutationTitle: "변경사항을 저장하지 못했습니다.",
  mutationDescription: "입력 내용을 확인한 뒤 다시 시도해 주세요.",
  retryLabel: "다시 시도",
  refreshLabel: "새로고침",
} as const;

/**
 * 민감 고객 데이터 접근 실패 안내.
 * 존재 여부·권한·담당 여부를 드러내지 않고, 다음 행동만 안내한다.
 * (권한/존재 노출 금지 — Forbidden 상태와 분리 유지)
 */
export const SENSITIVE_ACCESS_UX = {
  title: "고객 정보를 불러올 수 없습니다.",
  description:
    "선택한 고객 정보를 현재 화면에서 확인할 수 없습니다. 접근 가능한 고객 목록에서 다시 선택해 주세요.",
  listActionLabel: CUSTOMER_ACCESS_UX.listActionLabel,
  backLabel: FORBIDDEN_UX.backLabel,
} as const;

export const FORBIDDEN_STATE_UX = FORBIDDEN_UX;

export function getQueryErrorDescription(
  context: UserFacingErrorContext = "default"
): string {
  switch (context) {
    case "mutation":
      return ERROR_UX.mutationDescription;
    case "network":
      return USER_FACING_ERRORS.network;
    default:
      return ERROR_UX.loadDescription;
  }
}

export function getEmptyCopy(
  subject: string,
  options?: { hasActiveFilters?: boolean }
) {
  if (options?.hasActiveFilters) {
    return {
      title: EMPTY_UX.filteredTitle(subject),
      description: EMPTY_UX.filteredDescription,
    };
  }
  return {
    title: EMPTY_UX.title(subject),
    description: EMPTY_UX.description(subject),
  };
}

export function getLoadErrorCopy(subject?: string) {
  if (subject) {
    return {
      title: ERROR_UX.scopedLoadTitle(subject),
      description: ERROR_UX.scopedLoadDescription,
    };
  }
  return {
    title: ERROR_UX.loadTitle,
    description: ERROR_UX.loadDescription,
  };
}

export function getLoadingCopy(subject?: string) {
  if (subject) {
    return {
      title: LOADING_UX.scopedTitle(subject),
      description: LOADING_UX.scopedDescription(subject),
    };
  }
  return {
    title: LOADING_UX.defaultTitle,
    description: LOADING_UX.defaultDescription,
  };
}

/** Blocked calendar preview and similar — never show raw server message in UI */
export function getSafeBlockedMessage(
  message?: string | null,
  fallback = "현재 조건에서는 미리보기를 표시할 수 없습니다."
): string {
  if (!message) return fallback;
  const trimmed = message.trim();
  if (!trimmed) return fallback;
  if (/[a-z]{4,}/i.test(trimmed) && !/[가-힣]/.test(trimmed)) return fallback;
  if (trimmed.length > 120) return fallback;
  return trimmed;
}
