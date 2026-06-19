import type {
  IntroductionMethod,
  ReferralResultStatus,
  ReferralSourceType,
  ReferralStage,
  ThankYouStatus,
} from "@shared/customerReferrals";

export const REFERRAL_STAGE_LABELS: Record<ReferralStage, string> = {
  introduced: "소개 받음",
  contact_ready: "연락 준비",
  contacted: "연락 완료",
  consultation_scheduled: "상담 예정",
  consultation_completed: "상담 완료",
  proposal_made: "제안 완료",
  contracted: "계약 완료",
  deferred: "보류",
  declined: "거절",
  closed: "종료",
};

export const REFERRAL_SOURCE_TYPE_LABELS: Record<ReferralSourceType, string> = {
  customer_referral: "고객 소개",
  family_referral: "가족 소개",
  coworker_referral: "직장 소개",
  corporate_referral: "법인 소개",
  friend_referral: "지인 소개",
  other: "기타",
};

export const INTRODUCTION_METHOD_LABELS: Record<IntroductionMethod, string> = {
  phone: "전화",
  kakao: "카톡",
  sms: "문자",
  in_person: "대면",
  group_chat: "단톡/그룹",
  other: "기타",
};

export const THANK_YOU_STATUS_LABELS: Record<ThankYouStatus, string> = {
  not_required: "불필요",
  pending: "대기",
  completed: "완료",
};

export const REFERRAL_RESULT_STATUS_LABELS: Record<
  ReferralResultStatus,
  string
> = {
  in_progress: "진행 중",
  contracted: "계약",
  deferred: "보류",
  declined: "거절",
  closed: "종료",
};

export const REFERRAL_STAGE_BADGE_CLASSES: Record<ReferralStage, string> = {
  introduced: "bg-indigo-50 text-indigo-700",
  contact_ready: "bg-sky-50 text-sky-700",
  contacted: "bg-cyan-50 text-cyan-800",
  consultation_scheduled: "bg-violet-50 text-violet-700",
  consultation_completed: "bg-purple-50 text-purple-700",
  proposal_made: "bg-fuchsia-50 text-fuchsia-700",
  contracted: "bg-emerald-50 text-emerald-700",
  deferred: "bg-amber-50 text-amber-800",
  declined: "bg-rose-50 text-rose-700",
  closed: "bg-slate-100 text-slate-600",
};

export const REFERRAL_RESULT_BADGE_CLASSES: Record<
  ReferralResultStatus,
  string
> = {
  in_progress: "bg-blue-50 text-blue-700",
  contracted: "bg-emerald-50 text-emerald-700",
  deferred: "bg-amber-50 text-amber-800",
  declined: "bg-rose-50 text-rose-700",
  closed: "bg-slate-100 text-slate-600",
};

export const REFERRAL_THANK_YOU_BADGE_CLASSES: Record<ThankYouStatus, string> =
  {
    not_required: "bg-slate-100 text-slate-600",
    pending: "bg-orange-50 text-orange-700",
    completed: "bg-emerald-50 text-emerald-700",
  };

export const REFERRAL_SENSITIVE_MEMO_NOTICE =
  "소개 메모에는 주민등록번호, 질병명, 병력, 계약번호, 보험료 등 민감정보를 입력하지 마세요.";

export const REFERRAL_STAGE_OPTIONS = (
  Object.keys(REFERRAL_STAGE_LABELS) as ReferralStage[]
).map(value => ({
  value,
  label: REFERRAL_STAGE_LABELS[value],
}));
