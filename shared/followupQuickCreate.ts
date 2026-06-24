import {
  resolveQuickDateChip,
  type QuickDateChip,
} from "./scheduleQuickCreate";
import {
  formatKstLocalDate,
  getKstLocalDateTimeAfter,
  mergeLocalDateAndTime,
} from "./timePolicy";

export const FOLLOWUP_QUICK_PRESET_IDS = [
  "callback",
  "document_check",
  "coverage_guidance",
  "claim_guidance",
  "contract_review",
  "payment_renewal",
  "family_consult",
  "other",
] as const;

export type FollowupQuickPresetId = (typeof FOLLOWUP_QUICK_PRESET_IDS)[number];

export type FollowupQuickDateChip = QuickDateChip | "in_3_days";

export type FollowupNextAction =
  | "전화"
  | "카톡"
  | "문자"
  | "방문"
  | "설계안 발송"
  | "계약 확인"
  | "보장분석"
  | "사후관리"
  | "기타";

export type FollowupQuickPreset = {
  id: FollowupQuickPresetId;
  label: string;
  reason: string;
  nextAction: FollowupNextAction;
  memoPlaceholder: string;
  defaultDateChip: FollowupQuickDateChip;
};

export const FOLLOWUP_QUICK_PRESETS: FollowupQuickPreset[] = [
  {
    id: "callback",
    label: "다시 연락",
    reason: "다시 연락하기",
    nextAction: "전화",
    memoPlaceholder: "통화 요약, 확인할 내용을 적어주세요.",
    defaultDateChip: "tomorrow",
  },
  {
    id: "document_check",
    label: "서류 확인",
    reason: "서류 확인하기",
    nextAction: "카톡",
    memoPlaceholder: "받을 서류, 전달 방법을 적어주세요.",
    defaultDateChip: "in_3_days",
  },
  {
    id: "coverage_guidance",
    label: "보장분석 안내",
    reason: "보장분석 결과 안내",
    nextAction: "보장분석",
    memoPlaceholder: "분석 포인트, 공유 자료를 적어주세요.",
    defaultDateChip: "this_week",
  },
  {
    id: "claim_guidance",
    label: "보험금 청구 안내",
    reason: "보험금 청구 서류 안내",
    nextAction: "기타",
    memoPlaceholder: "필요 서류, 진행 단계를 적어주세요.",
    defaultDateChip: "in_3_days",
  },
  {
    id: "contract_review",
    label: "계약 내용 확인",
    reason: "계약 내용 확인",
    nextAction: "계약 확인",
    memoPlaceholder: "확인할 특약, 변경 사항을 적어주세요.",
    defaultDateChip: "this_week",
  },
  {
    id: "payment_renewal",
    label: "납입/갱신 확인",
    reason: "납입/갱신 확인",
    nextAction: "사후관리",
    memoPlaceholder: "납입 상태, 갱신 일정을 적어주세요.",
    defaultDateChip: "this_week",
  },
  {
    id: "family_consult",
    label: "가족 상담 확인",
    reason: "가족 상담 확인",
    nextAction: "방문",
    memoPlaceholder: "가족 구성, 상담 포인트를 적어주세요.",
    defaultDateChip: "next_week",
  },
  {
    id: "other",
    label: "기타 후속",
    reason: "후속 확인",
    nextAction: "기타",
    memoPlaceholder: "메모를 남겨두면 다음 상담이 쉬워집니다.",
    defaultDateChip: "tomorrow",
  },
];

export const FOLLOWUP_QUICK_DATE_CHIP_LABELS: Record<
  FollowupQuickDateChip,
  string
> = {
  today: "오늘",
  tomorrow: "내일",
  in_3_days: "3일 후",
  this_week: "이번 주",
  next_week: "다음 주",
  custom: "직접 선택",
};

export const FOLLOWUP_QUICK_DATE_CHIP_ORDER: FollowupQuickDateChip[] = [
  "today",
  "tomorrow",
  "in_3_days",
  "this_week",
  "next_week",
  "custom",
];

export type FollowupQuickPriorityChip = "urgent" | "high" | "normal" | "low";

export const FOLLOWUP_PRIORITY_CHIP_LABELS: Record<
  FollowupQuickPriorityChip,
  string
> = {
  urgent: "긴급",
  high: "높음",
  normal: "보통",
  low: "낮음",
};

export const FOLLOWUP_PRIORITY_CHIP_ORDER: FollowupQuickPriorityChip[] = [
  "urgent",
  "high",
  "normal",
  "low",
];

export const FOLLOWUP_PRIORITY_DEFAULT_DATE_CHIP: Record<
  FollowupQuickPriorityChip,
  FollowupQuickDateChip
> = {
  urgent: "today",
  high: "tomorrow",
  normal: "in_3_days",
  low: "this_week",
};

export function resolveFollowupQuickDateChip(
  chip: FollowupQuickDateChip,
  customDateKey?: string,
  now = new Date()
): string {
  if (chip === "in_3_days") {
    return getKstLocalDateTimeAfter(now, { days: 3 }).slice(0, 10);
  }
  return resolveQuickDateChip(chip, customDateKey, now);
}

export function buildFollowupQuickContactDate(input: {
  dateChip: FollowupQuickDateChip;
  customDateKey?: string;
  now?: Date;
}): string {
  const dateKey = resolveFollowupQuickDateChip(
    input.dateChip,
    input.customDateKey,
    input.now
  );
  const merged = mergeLocalDateAndTime(dateKey, "10:00");
  if (!merged) {
    return getKstLocalDateTimeAfter(input.now ?? new Date(), {
      defaultHour: 10,
    }).slice(0, 16);
  }
  return merged.slice(0, 16);
}

export function getFollowupPresetById(id: FollowupQuickPresetId) {
  return (
    FOLLOWUP_QUICK_PRESETS.find(item => item.id === id) ??
    FOLLOWUP_QUICK_PRESETS[FOLLOWUP_QUICK_PRESETS.length - 1]!
  );
}

export function buildQuickFollowUpPayload(input: {
  presetId: FollowupQuickPresetId;
  dateChip: FollowupQuickDateChip;
  reason?: string;
  memo?: string;
  customerId: number;
  customDateKey?: string;
  now?: Date;
}) {
  const preset = getFollowupPresetById(input.presetId);
  const nextContactDate = buildFollowupQuickContactDate({
    dateChip: input.dateChip,
    customDateKey: input.customDateKey,
    now: input.now,
  });
  const reason = input.reason?.trim() || preset.reason;
  const memo = input.memo?.trim() || undefined;
  const nextAction = preset.nextAction;

  return {
    customerId: input.customerId,
    nextContactDate,
    reason,
    nextAction,
    memo,
    presetLabel: preset.label,
  };
}

export type DetailedFollowUpSeed = {
  nextContactDate?: string;
  reason?: string;
  nextAction?: FollowupNextAction;
  memo?: string;
};

export function buildDetailedFollowUpSeedFromQuick(input: {
  presetId: FollowupQuickPresetId;
  dateChip: FollowupQuickDateChip;
  reason?: string;
  memo?: string;
  customDateKey?: string;
  now?: Date;
}): DetailedFollowUpSeed {
  const preset = getFollowupPresetById(input.presetId);
  return {
    nextContactDate: buildFollowupQuickContactDate({
      dateChip: input.dateChip,
      customDateKey: input.customDateKey,
      now: input.now,
    }),
    reason: input.reason?.trim() || preset.reason,
    nextAction: preset.nextAction,
    memo: input.memo?.trim() || undefined,
  };
}
