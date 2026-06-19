export const REFERRAL_STAGES = [
  "introduced",
  "contact_ready",
  "contacted",
  "consultation_scheduled",
  "consultation_completed",
  "proposal_made",
  "contracted",
  "deferred",
  "declined",
  "closed",
] as const;

export type ReferralStage = (typeof REFERRAL_STAGES)[number];

export const REFERRAL_SOURCE_TYPES = [
  "customer_referral",
  "family_referral",
  "coworker_referral",
  "corporate_referral",
  "friend_referral",
  "other",
] as const;

export type ReferralSourceType = (typeof REFERRAL_SOURCE_TYPES)[number];

export const INTRODUCTION_METHODS = [
  "phone",
  "kakao",
  "sms",
  "in_person",
  "group_chat",
  "other",
] as const;

export type IntroductionMethod = (typeof INTRODUCTION_METHODS)[number];

export const THANK_YOU_STATUSES = [
  "not_required",
  "pending",
  "completed",
] as const;

export type ThankYouStatus = (typeof THANK_YOU_STATUSES)[number];

export const REFERRAL_RESULT_STATUSES = [
  "in_progress",
  "contracted",
  "deferred",
  "declined",
  "closed",
] as const;

export type ReferralResultStatus = (typeof REFERRAL_RESULT_STATUSES)[number];

export const REFERRAL_MEMO_MAX_LENGTH = 500;

export const REFERRAL_SENSITIVE_MEMO_ERROR =
  "소개 메모에는 주민등록번호, 질병명, 병력, 계약번호 등 민감정보를 입력할 수 없습니다.";

/** PR20 relationship types eligible for referral flow tracking */
export const REFERRAL_ELIGIBLE_RELATIONSHIP_TYPES = [
  "referral",
  "friend",
  "coworker",
  "family_sibling",
  "corporate_representative",
  "corporate_employee",
] as const;

export type ReferralEligibleRelationshipType =
  (typeof REFERRAL_ELIGIBLE_RELATIONSHIP_TYPES)[number];

const SENSITIVE_MEMO_PATTERNS = [
  /\d{6}-\d{7}/,
  /주민(?:등록)?(?:번호)?/i,
  /(?:질병|병력|진단|수술|암|당뇨|고혈압)/i,
  /(?:증권|계약|증명)\s*번호/i,
  /(?:보험료|납입|월납)\s*\d/i,
  /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/,
];

export function assertReferralMemoSafe(memo?: string | null) {
  const trimmed = memo?.trim();
  if (!trimmed) return;
  if (trimmed.length > REFERRAL_MEMO_MAX_LENGTH) {
    throw new Error(
      `소개 메모는 ${REFERRAL_MEMO_MAX_LENGTH}자 이내로 입력해 주세요.`
    );
  }
  if (SENSITIVE_MEMO_PATTERNS.some(pattern => pattern.test(trimmed))) {
    throw new Error(REFERRAL_SENSITIVE_MEMO_ERROR);
  }
}

export function defaultResultStatusForStage(
  stage: ReferralStage
): ReferralResultStatus {
  if (stage === "contracted") return "contracted";
  if (stage === "declined") return "declined";
  if (stage === "deferred") return "deferred";
  if (stage === "closed") return "closed";
  return "in_progress";
}

export function stageTimestampField(
  stage: ReferralStage
):
  | "firstContactedAt"
  | "consultationStartedAt"
  | "proposalMadeAt"
  | "contractedAt"
  | "declinedAt"
  | null {
  switch (stage) {
    case "contacted":
      return "firstContactedAt";
    case "consultation_scheduled":
    case "consultation_completed":
      return "consultationStartedAt";
    case "proposal_made":
      return "proposalMadeAt";
    case "contracted":
      return "contractedAt";
    case "declined":
      return "declinedAt";
    default:
      return null;
  }
}
