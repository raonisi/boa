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
  title: (subject: string) => `조건에 맞는 ${subject}이 없습니다.`,
  description: (subject: string) =>
    `필요하면 조건을 조정한 뒤 다시 확인해 주세요.`,
  filteredTitle: (subject: string) => `현재 필터에 맞는 ${subject}이 없습니다.`,
  filteredDescription: "필터를 초기화해 다시 확인해 보세요.",
  filterResetLabel: "필터 초기화",
  viewAllLabel: "전체 보기",
} as const;

export const ERROR_UX = {
  loadTitle: "정보를 불러오지 못했습니다.",
  loadDescription: "잠시 후 다시 시도해 주세요.",
  scopedLoadTitle: (subject: string) => `${subject}을(를) 불러오지 못했습니다.`,
  scopedLoadDescription: "잠시 후 다시 확인해 주세요.",
  mutationTitle: "변경사항을 저장하지 못했습니다.",
  mutationDescription: "입력 내용을 확인한 뒤 다시 시도해 주세요.",
  retryLabel: "다시 시도",
  refreshLabel: "새로고침",
} as const;

export const MOBILE_STATE_UX = {
  dashboard: {
    todayWorkEmpty: "오늘 바로 처리할 업무가 없습니다.",
    notificationEmpty:
      "확인할 알림이 없습니다. 오늘 일정과 후속관리만 확인하면 됩니다.",
    priorityNotificationEmpty:
      "선택한 우선순위 알림이 없습니다. 다른 우선순위 큐를 확인해 주세요.",
    priorityContactEmpty:
      "오늘 우선 연락 추천 고객이 없습니다. 고객 DB에서 다음 행동이 필요한 대상을 확인해 주세요.",
    scheduleEmpty:
      "오늘 예정된 일정이 없습니다. 상담 예약이나 후속관리 일정을 등록해 보세요.",
    longUnmanagedEmpty: "장기 미관리로 표시할 고객이 없습니다.",
    todayFollowUpEmpty: "오늘 연락할 고객이 없습니다.",
    workLoadErrorDescription:
      "잠시 후 다시 확인해 주세요. 수치를 0건으로 표시하지 않습니다.",
  },
  customerList: {
    loadingDescription: "고객 목록을 확인하고 있습니다.",
    loadErrorDescription:
      "목록이 없는 상태와 구분해 표시하고 있습니다. 잠시 후 다시 확인해 주세요.",
    emptyTitle: "조건에 맞는 고객이 없습니다.",
    emptyDescription: "필요하면 검색어나 필터를 조정해 주세요.",
  },
  customerDetail: {
    consultationEmptyTitle: "아직 확인한 상담기록이 없습니다.",
    consultationEmptyDescription:
      "통화, 메시지, 방문 상담 내용을 기록하면 다음 행동을 더 정확히 판단할 수 있습니다.",
    timelineEmptyTitle: "아직 확인할 히스토리가 없습니다.",
    timelineEmptyDescription:
      "상담, 계약, 후속관리, 배정 변경이 생기면 시간순으로 표시됩니다.",
    nextContactEmptyTitle: "등록된 다음 연락일이 없습니다.",
    nextContactEmptyDescription:
      "다음 연락일을 정하면 모바일 대시보드와 알림 흐름에서 바로 확인할 수 있습니다.",
  },
  calendar: {
    todayEmptyTitle: "오늘 예정된 일정이 없습니다.",
    todayEmptyDescription: "상담 예약이나 후속관리 일정을 등록해 보세요.",
    filteredEmptyTitle: "선택한 조건에 해당하는 일정이 없습니다.",
    filteredEmptyDescription:
      "보기 조건을 바꾸거나 상담·계약·후속관리 일정을 등록해 보세요.",
    dayEmptyTitle: "이 날 일정이 없습니다.",
    selectedDayEmptyTitle: "선택한 날짜에 일정이 없습니다.",
    loadErrorDescription: "연결 상태를 확인한 뒤 다시 시도해 주세요.",
  },
  notifications: {
    emptyTitle: "확인할 알림이 없습니다.",
    unreadEmptyTitle: "읽지 않은 알림이 없습니다.",
    filteredEmptyTitle: "조건에 맞는 알림이 없습니다.",
    actionEmptyTitle: "처리할 알림이 없습니다.",
    emptyDescription:
      "일정 알림은 설정한 시각에 표시됩니다. 알림 설정을 확인해 주세요.",
    filteredEmptyDescription: "필터를 조정하거나 초기화해 보세요.",
    loadErrorDescription: "잠시 후 다시 확인해 주세요.",
  },
  customerAssign: {
    emptyTitle: "배정할 고객이 없습니다.",
    emptyDescription:
      "배정 가능한 고객 DB가 생기면 이곳에서 담당자에게 배정할 수 있습니다.",
  },
  downloads: {
    loadErrorDescription:
      "잠시 후 다시 확인해 주세요. 다운로드 실행 전 대상 건수 확인이 필요합니다.",
  },
} as const;

/**
 * 민감 고객 데이터 접근 실패 안내.
 * 존재 여부·권한·담당 여부를 드러내지 않고, 다음 행동만 안내한다.
 * (권한/존재 노출 금지 — Forbidden 상태와 분리 유지)
 */
export const SENSITIVE_ACCESS_UX = {
  title: "세부 정보를 표시할 수 없습니다.",
  description:
    "목록으로 돌아가 다시 선택해 주세요. 필요한 경우 새로고침 후 다시 확인해 주세요.",
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
