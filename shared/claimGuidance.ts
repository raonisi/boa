export const CLAIM_GUIDANCE_TYPES = [
  "process_guidance",
  "required_documents",
  "additional_documents",
  "submission_status",
  "result_followup",
  "other",
] as const;

export type ClaimGuidanceType = (typeof CLAIM_GUIDANCE_TYPES)[number];

export const CLAIM_GUIDANCE_STATUSES = [
  "guidance_needed",
  "guidance_provided",
  "waiting_customer",
  "documents_preparing",
  "submitted_by_customer",
  "additional_guidance_needed",
  "completed",
  "not_applicable",
  "closed",
] as const;

export type ClaimGuidanceStatus = (typeof CLAIM_GUIDANCE_STATUSES)[number];

export const CLAIM_DOCUMENT_GUIDE_STATUSES = [
  "not_started",
  "guide_sent",
  "customer_checking",
  "completed",
  "not_applicable",
] as const;

export type ClaimDocumentGuideStatus =
  (typeof CLAIM_DOCUMENT_GUIDE_STATUSES)[number];

export const CLAIM_CUSTOMER_ACTION_STATUSES = [
  "no_action",
  "preparing",
  "submitted",
  "waiting_result",
  "completed",
  "stopped",
] as const;

export type ClaimCustomerActionStatus =
  (typeof CLAIM_CUSTOMER_ACTION_STATUSES)[number];

export const CLAIM_GUIDANCE_CLOSED_REASONS = [
  "customer_completed",
  "customer_declined",
  "not_claimable_by_customer_report",
  "duplicate",
  "outdated",
  "other",
] as const;

export type ClaimGuidanceClosedReason =
  (typeof CLAIM_GUIDANCE_CLOSED_REASONS)[number];

export const CLAIM_GUIDANCE_MEMO_MAX_LENGTH = 500;

export const CLAIM_GUIDANCE_SENSITIVE_MEMO_ERROR =
  "청구 안내 메모에는 주민등록번호, 질병명, 병력, 계약번호, 계좌번호, 병원명 등 민감정보를 입력할 수 없습니다.";

/** Fields that must never appear on claim_guidance_cases */
export const CLAIM_GUIDANCE_FORBIDDEN_SCHEMA_FIELDS = [
  "diagnosis",
  "disease",
  "illness",
  "hospital",
  "accountNumber",
  "residentRegistration",
  "policyNumber",
  "certificateNumber",
  "claimAmount",
  "premium",
  "phone",
  "address",
  "receiptImage",
  "diagnosisDocument",
] as const;

const SENSITIVE_MEMO_PATTERNS = [
  /\d{6}-\d{7}/,
  /주민(?:등록)?(?:번호)?/i,
  /(?:질병|병력|진단|수술|암|당뇨|고혈압|병원|검사)/i,
  /(?:증권|계약|증명)\s*번호/i,
  /(?:보험료|납입|월납|지급액|보험금)\s*\d/i,
  /(?:계좌|통장|은행)/i,
  /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/,
];

export function assertClaimGuidanceMemoSafe(memo?: string | null) {
  const trimmed = memo?.trim();
  if (!trimmed) return;
  if (trimmed.length > CLAIM_GUIDANCE_MEMO_MAX_LENGTH) {
    throw new Error(
      `청구 안내 메모는 ${CLAIM_GUIDANCE_MEMO_MAX_LENGTH}자 이내로 입력해 주세요.`
    );
  }
  if (SENSITIVE_MEMO_PATTERNS.some(pattern => pattern.test(trimmed))) {
    throw new Error(CLAIM_GUIDANCE_SENSITIVE_MEMO_ERROR);
  }
}

export function isClaimGuidanceOpenStatus(status: ClaimGuidanceStatus) {
  return (
    status !== "completed" && status !== "not_applicable" && status !== "closed"
  );
}
