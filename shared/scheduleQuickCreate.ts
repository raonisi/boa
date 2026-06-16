import {
  formatKstLocalDate,
  formatKstLocalDateTime,
  getKstLocalDateTimeAfter,
  mergeLocalDateAndTime,
  parseKstLocalDateTime,
} from "./timePolicy";
import { recommendScheduleCalendarCategory } from "./scheduleCalendarCategory";

export const SCHEDULE_QUICK_PRESET_IDS = [
  "phone_consultation",
  "visit_consultation",
  "coverage_analysis",
  "document_request",
  "contract_check",
  "claim_guidance",
  "renewal_check",
  "other",
] as const;

export type ScheduleQuickPresetId = (typeof SCHEDULE_QUICK_PRESET_IDS)[number];

export type QuickDateChip =
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_week"
  | "custom";

export type QuickTimeChip = "morning" | "afternoon" | "before_leave" | "custom";

export type QuickScheduleType =
  | "고객상담"
  | "재통화"
  | "계약예정"
  | "보장분석"
  | "해지방어"
  | "팀회의"
  | "교육"
  | "외근"
  | "휴무"
  | "기타";

export type ScheduleQuickPreset = {
  id: ScheduleQuickPresetId;
  label: string;
  scheduleType: QuickScheduleType;
  title: string;
  memoPlaceholder: string;
  durationMinutes: number;
};

export const SCHEDULE_QUICK_PRESETS: ScheduleQuickPreset[] = [
  {
    id: "phone_consultation",
    label: "전화 상담",
    scheduleType: "고객상담",
    title: "전화 상담",
    memoPlaceholder: "통화 요약, 확인할 내용을 적어주세요.",
    durationMinutes: 30,
  },
  {
    id: "visit_consultation",
    label: "방문 상담",
    scheduleType: "외근",
    title: "방문 상담",
    memoPlaceholder: "방문 장소, 준비물을 적어주세요.",
    durationMinutes: 60,
  },
  {
    id: "coverage_analysis",
    label: "보장분석",
    scheduleType: "보장분석",
    title: "보장분석 안내",
    memoPlaceholder: "분석 포인트, 공유 자료를 적어주세요.",
    durationMinutes: 60,
  },
  {
    id: "document_request",
    label: "서류 요청",
    scheduleType: "재통화",
    title: "서류 요청 확인",
    memoPlaceholder: "요청 서류, 제출 방법을 적어주세요.",
    durationMinutes: 30,
  },
  {
    id: "contract_check",
    label: "계약 확인",
    scheduleType: "계약예정",
    title: "계약 내용 확인",
    memoPlaceholder: "확인할 특약, 서명 일정을 적어주세요.",
    durationMinutes: 45,
  },
  {
    id: "claim_guidance",
    label: "보험금 청구 안내",
    scheduleType: "고객상담",
    title: "보험금 청구 안내",
    memoPlaceholder: "청구 서류, 진행 단계를 적어주세요.",
    durationMinutes: 30,
  },
  {
    id: "renewal_check",
    label: "갱신/납입 확인",
    scheduleType: "재통화",
    title: "갱신·납입 확인",
    memoPlaceholder: "갱신 시점, 납입 방법을 적어주세요.",
    durationMinutes: 30,
  },
  {
    id: "other",
    label: "기타 일정",
    scheduleType: "기타",
    title: "기타 일정",
    memoPlaceholder: "메모를 남겨두면 다음 상담이 쉬워집니다.",
    durationMinutes: 30,
  },
];

export const QUICK_DATE_CHIP_LABELS: Record<QuickDateChip, string> = {
  today: "오늘",
  tomorrow: "내일",
  this_week: "이번 주",
  next_week: "다음 주",
  custom: "직접 선택",
};

export const QUICK_TIME_CHIP_LABELS: Record<QuickTimeChip, string> = {
  morning: "오전",
  afternoon: "오후",
  before_leave: "퇴근 전",
  custom: "직접 입력",
};

export const QUICK_TIME_DEFAULTS: Record<
  Exclude<QuickTimeChip, "custom">,
  string
> = {
  morning: "10:00",
  afternoon: "14:00",
  before_leave: "17:00",
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKstParts(now = new Date()) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return {
    weekday: kst.getUTCDay(),
  };
}

function addKstDays(base: Date, days: number) {
  return getKstLocalDateTimeAfter(base, { days }).slice(0, 10);
}

/** Upcoming Friday in the current KST week, or today if already Fri–Sun. */
export function resolveQuickDateChip(
  chip: QuickDateChip,
  customDateKey?: string,
  now = new Date()
): string {
  if (chip === "custom" && customDateKey) return customDateKey;
  if (chip === "today") return formatKstLocalDate(now);
  if (chip === "tomorrow") return addKstDays(now, 1);

  const { weekday } = getKstParts(now);
  if (chip === "this_week") {
    if (weekday >= 1 && weekday <= 4) {
      return addKstDays(now, 5 - weekday);
    }
    return formatKstLocalDate(now);
  }

  if (chip === "next_week") {
    const daysUntilNextMonday = weekday === 0 ? 1 : 8 - weekday;
    return addKstDays(now, daysUntilNextMonday);
  }

  return formatKstLocalDate(now);
}

export function resolveQuickTimeValue(
  chip: QuickTimeChip,
  customDateTime?: string
): string {
  if (chip === "custom" && customDateTime) {
    return customDateTime.slice(11, 16);
  }
  if (chip === "custom") return QUICK_TIME_DEFAULTS.afternoon;
  return QUICK_TIME_DEFAULTS[chip];
}

export function buildQuickScheduleStartTime(input: {
  dateChip: QuickDateChip;
  timeChip: QuickTimeChip;
  customDateKey?: string;
  customDateTime?: string;
  now?: Date;
}): string {
  if (input.timeChip === "custom" && input.customDateTime) {
    return input.customDateTime;
  }
  const dateKey = resolveQuickDateChip(
    input.dateChip,
    input.customDateKey,
    input.now
  );
  const timeValue = resolveQuickTimeValue(input.timeChip, input.customDateTime);
  const merged = mergeLocalDateAndTime(dateKey, timeValue);
  if (!merged) {
    return getKstLocalDateTimeAfter(input.now ?? new Date(), {
      defaultHour: 10,
    });
  }
  return merged.slice(0, 16);
}

export function buildQuickScheduleEndTimeFromStart(
  startTime: string,
  durationMinutes: number
): string {
  const start = parseKstLocalDateTime(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return formatKstLocalDateTime(end, { seconds: false }).slice(0, 16);
}

export function buildQuickSchedulePayload(input: {
  presetId: ScheduleQuickPresetId;
  dateChip: QuickDateChip;
  timeChip: QuickTimeChip;
  title?: string;
  memo?: string;
  customerId?: number | null;
  customDateKey?: string;
  customDateTime?: string;
  now?: Date;
}) {
  const preset =
    SCHEDULE_QUICK_PRESETS.find(item => item.id === input.presetId) ??
    SCHEDULE_QUICK_PRESETS[SCHEDULE_QUICK_PRESETS.length - 1]!;
  const startTime = buildQuickScheduleStartTime({
    dateChip: input.dateChip,
    timeChip: input.timeChip,
    customDateKey: input.customDateKey,
    customDateTime: input.customDateTime,
    now: input.now,
  });
  const endTime = buildQuickScheduleEndTimeFromStart(
    startTime,
    preset.durationMinutes
  );
  const title = input.title?.trim() || preset.title;
  const calendarCategory = recommendScheduleCalendarCategory({
    scheduleType: preset.scheduleType,
    customerId: input.customerId ?? null,
  });

  return {
    title,
    type: preset.scheduleType,
    status: "예정" as const,
    startTime,
    endTime,
    memo: input.memo?.trim() || undefined,
    reminderOffsetMinutes: 30 as const,
    customerId: input.customerId ?? undefined,
    calendarCategory,
    presetLabel: preset.label,
  };
}

export function getPresetById(id: ScheduleQuickPresetId) {
  return (
    SCHEDULE_QUICK_PRESETS.find(item => item.id === id) ??
    SCHEDULE_QUICK_PRESETS[SCHEDULE_QUICK_PRESETS.length - 1]!
  );
}
