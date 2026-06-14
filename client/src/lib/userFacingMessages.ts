const HANGUL = /[가-힣]/;

const TECHNICAL_PATTERNS =
  /^(Failed|Unauthorized|Forbidden|Unknown|Error|TRPC|Network|fetch|Unexpected|Internal server)/i;

/** 사용자 화면용 — raw exception·영어 개발자 메시지는 fallback으로 대체 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const trimmed = message.trim();
  if (!trimmed) return fallback;

  if (
    trimmed.includes(" at ") ||
    trimmed.includes("stack") ||
    trimmed.length > 160 ||
    TECHNICAL_PATTERNS.test(trimmed)
  ) {
    return fallback;
  }

  if (HANGUL.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

export const USER_FACING_ERRORS = {
  saveFailed: "정보를 저장하지 못했습니다. 다시 시도해 주세요.",
  loadFailed: "정보를 불러오지 못했습니다. 다시 시도해 주세요.",
  network: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
  permission:
    "권한 범위 안에서 처리할 수 있는 항목만 표시됩니다.",
} as const;
