export const RETENTION_RISK_REASONS = [
  "premium_burden",
  "coverage_dissatisfaction",
  "competitor_offer",
  "cash_need",
  "duplicate_coverage",
  "trust_issue",
  "claim_dissatisfaction",
  "family_opposition",
  "low_priority",
  "no_response",
  "other",
] as const;

export type RetentionRiskReason = (typeof RETENTION_RISK_REASONS)[number];

export const RETENTION_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type RetentionRiskLevel = (typeof RETENTION_RISK_LEVELS)[number];

export const RETENTION_STATUSES = [
  "detected",
  "contacted",
  "explanation_provided",
  "adjustment_review",
  "waiting_customer",
  "retained",
  "adjusted",
  "surrendered",
  "closed",
] as const;

export type RetentionStatus = (typeof RETENTION_STATUSES)[number];

export const RESPONSE_STRATEGIES = [
  "explain_existing_value",
  "reduce_premium_review",
  "coverage_gap_review",
  "partial_adjustment",
  "payment_method_review",
  "wait_and_followup",
  "no_retention_needed",
  "other",
] as const;

export type ResponseStrategy = (typeof RESPONSE_STRATEGIES)[number];

export const CUSTOMER_SENTIMENTS = [
  "calm",
  "worried",
  "dissatisfied",
  "price_sensitive",
  "distrustful",
  "undecided",
  "no_response",
] as const;

export type CustomerSentiment = (typeof CUSTOMER_SENTIMENTS)[number];

export const FINANCIAL_PRESSURE_LEVELS = ["low", "medium", "high"] as const;

export type FinancialPressureLevel = (typeof FINANCIAL_PRESSURE_LEVELS)[number];

export const RESOLUTION_RESULTS = [
  "retained",
  "adjusted",
  "surrendered",
  "transferred_to_followup",
  "no_action",
  "unknown",
] as const;

export type ResolutionResult = (typeof RESOLUTION_RESULTS)[number];

export const RETENTION_RISK_MEMO_MAX_LENGTH = 500;

export const RETENTION_RISK_SENSITIVE_MEMO_ERROR =
  "해지위험 메모에는 주민등록번호, 질병명, 병력, 계약번호, 보험료 원문, 고객 불만 전문 등 민감정보를 입력할 수 없습니다.";

export const RETENTION_RISK_FORBIDDEN_SCHEMA_FIELDS = [
  "diagnosis",
  "disease",
  "illness",
  "hospital",
  "accountNumber",
  "residentRegistration",
  "policyNumber",
  "certificateNumber",
  "premium",
  "phone",
  "address",
  "complaintText",
  "blame",
] as const;

export const TERMINAL_RETENTION_STATUSES: RetentionStatus[] = [
  "retained",
  "adjusted",
  "surrendered",
  "closed",
];

const SENSITIVE_MEMO_PATTERNS = [
  /\d{6}-\d{7}/,
  /주민(?:등록)?(?:번호)?/i,
  /(?:질병|병력|진단|수술|암|당뇨|고혈압|병원|검사)/i,
  /(?:증권|계약|증명)\s*번호/i,
  /(?:보험료|납입|월납)\s*\d/i,
  /(?:계좌|통장|은행)/i,
  /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/,
  /(?:바보|멍청|거짓말|사기)/i,
];

export function assertRetentionRiskMemoSafe(memo?: string | null) {
  const trimmed = memo?.trim();
  if (!trimmed) return;
  if (trimmed.length > RETENTION_RISK_MEMO_MAX_LENGTH) {
    throw new Error(
      `해지위험 메모는 ${RETENTION_RISK_MEMO_MAX_LENGTH}자 이내로 입력해 주세요.`
    );
  }
  if (SENSITIVE_MEMO_PATTERNS.some(pattern => pattern.test(trimmed))) {
    throw new Error(RETENTION_RISK_SENSITIVE_MEMO_ERROR);
  }
}

export function isRetentionRiskOpenStatus(status: RetentionStatus) {
  return !TERMINAL_RETENTION_STATUSES.includes(status);
}

export function mapResolutionToRetentionStatus(
  result: ResolutionResult
): RetentionStatus | null {
  if (result === "retained") return "retained";
  if (result === "adjusted") return "adjusted";
  if (result === "surrendered") return "surrendered";
  if (result === "no_action" || result === "unknown") return "closed";
  return null;
}
