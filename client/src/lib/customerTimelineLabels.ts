const EVENT_TYPE_LABELS: Record<string, string> = {
  customer_viewed: "고객 상세 조회",
  consultation_created: "상담기록 등록",
  consultation_updated: "상담기록 수정",
  customer_created: "고객 등록",
  customer_updated: "고객 정보 수정",
  customer_assigned: "담당자 지정",
  customer_assignee_changed: "담당자 변경",
  customer_assignee_changed_by_bulk: "담당자 일괄 변경",
  assignment_changed: "담당자 변경",
  db_assigned: "DB 배정",
  db_reclaimed: "DB 회수",
  contract_created: "계약 등록",
  contract_updated: "계약 수정",
  contract_deleted: "계약 삭제",
  contract_delete_requested: "계약 삭제 요청",
  contract_delete_approved: "계약 삭제 승인",
  contract_delete_rejected: "계약 삭제 반려",
  delete_request_created: "삭제 요청 접수",
  delete_request_approved: "삭제 요청 승인",
  delete_request_rejected: "삭제 요청 반려",
  follow_up_created: "후속관리 등록",
  follow_up_completed: "후속관리 완료",
  follow_up_postponed: "후속관리 연기",
  follow_up_cancelled: "후속관리 취소",
  notification_created: "알림 생성",
  notification_status_changed: "알림 상태 변경",
  reassignment: "담당자 변경",
  bulk_assignee_change: "담당자 일괄 변경",
};

const SOURCE_LABELS: Record<string, string> = {
  activity_logs: "활동 기록",
  consultation_records: "상담기록",
  consultations: "상담기록",
  follow_ups: "후속관리",
  schedules: "일정",
  contracts: "계약",
  contract_history: "계약",
  notifications: "알림",
  import_batches: "일괄 등록",
  assignment_history: "담당자 변경 이력",
};

const RAW_TEXT_PATTERN = /^[a-z0-9_]+$/i;

export function getCustomerTimelineEventLabel(eventType?: string | null) {
  const key = eventType?.toLowerCase();
  if (!key) return "활동 기록";
  return EVENT_TYPE_LABELS[key] ?? "활동 기록";
}

export function shouldHideTimelineEvent(eventType?: string | null) {
  return eventType?.toLowerCase() === "customer_viewed";
}

export function getCustomerTimelineSourceLabel(source?: string | null) {
  const key = source?.toLowerCase();
  if (!key) return undefined;
  return SOURCE_LABELS[key];
}

export function getCustomerTimelineSummary(
  eventType?: string | null,
  summary?: string | null
) {
  const label = getCustomerTimelineEventLabel(eventType);
  if (!summary) return label;
  return RAW_TEXT_PATTERN.test(summary.trim()) ? label : summary;
}
