import type {
  CustomerSentiment,
  ResolutionResult,
  ResponseStrategy,
  RetentionRiskLevel,
  RetentionRiskReason,
  RetentionStatus,
} from "@shared/retentionRisk";
import { RETENTION_RISK_SENSITIVE_MEMO_ERROR } from "@shared/retentionRisk";

export const RETENTION_RISK_SENSITIVE_MEMO_NOTICE = RETENTION_RISK_SENSITIVE_MEMO_ERROR;

export const RETENTION_RISK_REASON_LABELS: Record<RetentionRiskReason, string> =
  {
    premium_burden: "보험료 부담",
    coverage_dissatisfaction: "보장 불만",
    competitor_offer: "타사 제안 비교",
    cash_need: "현금 필요",
    duplicate_coverage: "중복 보장 의심",
    trust_issue: "신뢰 이슈",
    claim_dissatisfaction: "청구 불만",
    family_opposition: "가족 반대",
    low_priority: "우선순위 낮음",
    no_response: "연락 회피",
    other: "기타",
  };

export const RETENTION_RISK_LEVEL_LABELS: Record<RetentionRiskLevel, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "긴급",
};

export const RETENTION_STATUS_LABELS: Record<RetentionStatus, string> = {
  detected: "위험 감지",
  contacted: "연락 완료",
  explanation_provided: "설명 완료",
  adjustment_review: "조정 검토",
  waiting_customer: "고객 고민 중",
  retained: "유지",
  adjusted: "조정",
  surrendered: "해지",
  closed: "종료",
};

export const RESPONSE_STRATEGY_LABELS: Record<ResponseStrategy, string> = {
  explain_existing_value: "기존 보장 가치 설명",
  reduce_premium_review: "보험료 절감 검토",
  coverage_gap_review: "보장 공백 점검",
  partial_adjustment: "일부 조정 검토",
  payment_method_review: "납입 방식 검토",
  wait_and_followup: "재확인 예정",
  no_retention_needed: "유지 권유 불필요",
  other: "기타",
};

export const CUSTOMER_SENTIMENT_LABELS: Record<CustomerSentiment, string> = {
  calm: "차분함",
  worried: "불안함",
  dissatisfied: "불만 있음",
  price_sensitive: "가격 민감",
  distrustful: "신뢰 낮음",
  undecided: "결정 보류",
  no_response: "무응답",
};

export const RESOLUTION_RESULT_LABELS: Record<ResolutionResult, string> = {
  retained: "유지",
  adjusted: "조정",
  surrendered: "해지",
  transferred_to_followup: "후속관리 이관",
  no_action: "조치 없음",
  unknown: "미확인",
};

export const RETENTION_RISK_LEVEL_BADGE_CLASSES: Record<
  RetentionRiskLevel,
  string
> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-50 text-sky-700",
  high: "bg-amber-50 text-amber-800",
  critical: "bg-orange-50 text-orange-800",
};

export const RETENTION_STATUS_BADGE_CLASSES: Record<RetentionStatus, string> = {
  detected: "bg-orange-50 text-orange-700",
  contacted: "bg-sky-50 text-sky-700",
  explanation_provided: "bg-indigo-50 text-indigo-700",
  adjustment_review: "bg-violet-50 text-violet-700",
  waiting_customer: "bg-amber-50 text-amber-800",
  retained: "bg-emerald-50 text-emerald-700",
  adjusted: "bg-teal-50 text-teal-700",
  surrendered: "bg-slate-100 text-slate-600",
  closed: "bg-slate-100 text-slate-600",
};

export const RETENTION_RISK_REASON_OPTIONS = Object.entries(
  RETENTION_RISK_REASON_LABELS
).map(([value, label]) => ({
  value: value as RetentionRiskReason,
  label,
}));

export const RETENTION_RISK_LEVEL_OPTIONS = Object.entries(
  RETENTION_RISK_LEVEL_LABELS
).map(([value, label]) => ({
  value: value as RetentionRiskLevel,
  label,
}));

export const RETENTION_STATUS_OPTIONS = Object.entries(
  RETENTION_STATUS_LABELS
).map(([value, label]) => ({
  value: value as RetentionStatus,
  label,
}));

export const RESPONSE_STRATEGY_OPTIONS = Object.entries(
  RESPONSE_STRATEGY_LABELS
).map(([value, label]) => ({
  value: value as ResponseStrategy,
  label,
}));

export const CUSTOMER_SENTIMENT_OPTIONS = Object.entries(
  CUSTOMER_SENTIMENT_LABELS
).map(([value, label]) => ({
  value: value as CustomerSentiment,
  label,
}));

export const RESOLUTION_RESULT_OPTIONS = Object.entries(
  RESOLUTION_RESULT_LABELS
).map(([value, label]) => ({
  value: value as ResolutionResult,
  label,
}));
