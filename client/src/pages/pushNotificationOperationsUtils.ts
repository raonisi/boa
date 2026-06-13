export const pushStatusLabels: Record<string, string> = {
  sent: "성공",
  failed: "실패",
  skipped: "스킵",
  skipped_no_token: "토큰 없음",
  skipped_disabled: "설정 꺼짐",
  skipped_quiet_hours: "조용한 시간",
  skipped_missing_config: "설정 누락",
  duplicate_skipped: "중복 차단",
  invalid_token_deactivated: "토큰 비활성",
};

export const pushTypeLabels: Record<string, string> = {
  today_follow_up: "오늘 연락 대상",
  schedule_30min: "일정 30분 전",
  schedule_reminder: "일정 알림",
  schedule_incomplete: "일정 미완료",
  customer_birthday: "고객 기념일",
  contract_90: "계약 90일 점검",
  contract_180: "계약 180일 점검",
  contract_365: "계약 365일 점검",
  long_unmanaged_90: "장기 미관리 고객",
  contract_delete_request: "계약 삭제 요청",
  test: "테스트",
};

export const pushSourceTypeLabels: Record<string, string> = {
  notification: "알림",
  schedule: "일정",
  follow_up: "후속관리",
  contract: "계약",
  customer: "고객",
  test: "테스트",
};

export type PushLogListItem = {
  id: number;
  type: string;
  status: string;
  userId: number;
  userName?: string | null;
  userRole?: string | null;
  sourceType?: string | null;
  sourceId?: number | null;
  errorCode?: string | null;
  createdAt: string | Date;
  sentAt?: string | Date | null;
};

/** Push operations UI must never surface device token plaintext. */
export function assertNoDeviceTokenInPushLogRow(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== "string") continue;
    const lower = key.toLowerCase();
    if (
      lower.includes("token") &&
      value.length > 12 &&
      !lower.includes("inactive")
    ) {
      throw new Error(`Unexpected token-like field in push log row: ${key}`);
    }
  }
}

export function formatPushLogUserLabel(
  log: Pick<PushLogListItem, "userName" | "userId" | "userRole">
) {
  const name = log.userName?.trim();
  const role = log.userRole?.trim();
  if (name && role) return `${name} (${role})`;
  if (name) return name;
  return `#${log.userId}`;
}

export function buildPushLogsQuery(input: {
  status: string;
  type: string;
  sourceType: string;
  dateFrom: string;
  dateTo: string;
  userId?: number;
  limit?: number;
}) {
  return {
    status: input.status === "all" ? undefined : input.status,
    type: input.type === "all" ? undefined : input.type,
    sourceType: input.sourceType.trim() || undefined,
    dateFrom: input.dateFrom.trim() || undefined,
    dateTo: input.dateTo.trim() || undefined,
    userId: input.userId,
    limit: input.limit ?? 100,
  };
}
