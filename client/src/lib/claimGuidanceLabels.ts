import type {
  ClaimCustomerActionStatus,
  ClaimDocumentGuideStatus,
  ClaimGuidanceClosedReason,
  ClaimGuidanceStatus,
  ClaimGuidanceType,
} from "@shared/claimGuidance";

export const CLAIM_GUIDANCE_TYPE_LABELS: Record<ClaimGuidanceType, string> = {
  process_guidance: "청구 절차 안내",
  required_documents: "필요서류 안내",
  additional_documents: "추가서류 안내",
  submission_status: "접수 상태 확인",
  result_followup: "결과 후속 안내",
  other: "기타",
};

export const CLAIM_GUIDANCE_STATUS_LABELS: Record<ClaimGuidanceStatus, string> =
  {
    guidance_needed: "안내 필요",
    guidance_provided: "안내 완료",
    waiting_customer: "고객 준비 중",
    documents_preparing: "서류 준비 중",
    submitted_by_customer: "고객 접수 완료",
    additional_guidance_needed: "추가 안내 필요",
    completed: "완료",
    not_applicable: "해당 없음",
    closed: "종료",
  };

export const CLAIM_DOCUMENT_GUIDE_STATUS_LABELS: Record<
  ClaimDocumentGuideStatus,
  string
> = {
  not_started: "미시작",
  guide_sent: "안내 발송",
  customer_checking: "고객 확인 중",
  completed: "완료",
  not_applicable: "해당 없음",
};

export const CLAIM_CUSTOMER_ACTION_STATUS_LABELS: Record<
  ClaimCustomerActionStatus,
  string
> = {
  no_action: "조치 없음",
  preparing: "준비 중",
  submitted: "접수함",
  waiting_result: "결과 대기",
  completed: "완료",
  stopped: "중단",
};

export const CLAIM_GUIDANCE_CLOSED_REASON_LABELS: Record<
  ClaimGuidanceClosedReason,
  string
> = {
  customer_completed: "고객 처리 완료",
  customer_declined: "고객 거절",
  not_claimable_by_customer_report: "고객 신고상 청구 불가",
  duplicate: "중복",
  outdated: "기한 경과",
  other: "기타",
};

export const CLAIM_GUIDANCE_STATUS_BADGE_CLASSES: Record<
  ClaimGuidanceStatus,
  string
> = {
  guidance_needed: "bg-orange-50 text-orange-700",
  guidance_provided: "bg-sky-50 text-sky-700",
  waiting_customer: "bg-amber-50 text-amber-800",
  documents_preparing: "bg-violet-50 text-violet-700",
  submitted_by_customer: "bg-indigo-50 text-indigo-700",
  additional_guidance_needed: "bg-rose-50 text-rose-700",
  completed: "bg-emerald-50 text-emerald-700",
  not_applicable: "bg-slate-100 text-slate-600",
  closed: "bg-slate-100 text-slate-600",
};

export const CLAIM_GUIDANCE_SENSITIVE_MEMO_NOTICE =
  "청구 안내 메모에는 질병명, 진단명, 병력, 주민등록번호, 계좌번호, 병원명 상세, 계약번호, 보험료 등 민감정보를 입력하지 마세요.";

export const CLAIM_GUIDANCE_STATUS_OPTIONS = (
  Object.keys(CLAIM_GUIDANCE_STATUS_LABELS) as ClaimGuidanceStatus[]
).map(value => ({
  value,
  label: CLAIM_GUIDANCE_STATUS_LABELS[value],
}));

export const CLAIM_GUIDANCE_TYPE_OPTIONS = (
  Object.keys(CLAIM_GUIDANCE_TYPE_LABELS) as ClaimGuidanceType[]
).map(value => ({
  value,
  label: CLAIM_GUIDANCE_TYPE_LABELS[value],
}));

export const CLAIM_DOCUMENT_GUIDE_STATUS_OPTIONS = (
  Object.keys(CLAIM_DOCUMENT_GUIDE_STATUS_LABELS) as ClaimDocumentGuideStatus[]
).map(value => ({
  value,
  label: CLAIM_DOCUMENT_GUIDE_STATUS_LABELS[value],
}));

export const CLAIM_CUSTOMER_ACTION_STATUS_OPTIONS = (
  Object.keys(
    CLAIM_CUSTOMER_ACTION_STATUS_LABELS
  ) as ClaimCustomerActionStatus[]
).map(value => ({
  value,
  label: CLAIM_CUSTOMER_ACTION_STATUS_LABELS[value],
}));

export const CLAIM_GUIDANCE_CLOSED_REASON_OPTIONS = (
  Object.keys(
    CLAIM_GUIDANCE_CLOSED_REASON_LABELS
  ) as ClaimGuidanceClosedReason[]
).map(value => ({
  value,
  label: CLAIM_GUIDANCE_CLOSED_REASON_LABELS[value],
}));
