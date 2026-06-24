import type { GoogleCalendarType } from "./googleCalendar";

export const SCHEDULE_CALENDAR_CATEGORIES = [
  "branch_common",
  "consultation_followup",
  "admin",
] as const;

export type ScheduleCalendarCategory =
  (typeof SCHEDULE_CALENDAR_CATEGORIES)[number];

export const SCHEDULE_CALENDAR_CATEGORY_LABELS: Record<
  ScheduleCalendarCategory,
  string
> = {
  branch_common: "공통일정",
  consultation_followup: "상담일정",
  admin: "관리자일정",
};

export const SCHEDULE_CALENDAR_CATEGORY_DESCRIPTIONS: Record<
  ScheduleCalendarCategory,
  string
> = {
  branch_common: "회의, 교육, 마감, 지점 행사 등 전체 공유 일정",
  consultation_followup: "고객 상담, 후속관리, 재연락, 보장점검, 방문 일정",
  admin: "지점장 면담, 팀장 회의, 조직 운영, 인수인계",
};

export const SCHEDULE_CALENDAR_CATEGORY_CARDS: Array<{
  value: ScheduleCalendarCategory;
  label: string;
  summary: string;
  helper: string;
}> = [
  {
    value: "branch_common",
    label: "공통일정",
    summary: "회의 · 교육 · 마감 · 지점 행사",
    helper:
      "전체 지점원이 함께 확인하는 일정입니다. 고객 상담 일정은 이곳에 넣지 않는 것을 권장합니다.",
  },
  {
    value: "consultation_followup",
    label: "상담일정",
    summary: "고객 상담 · 후속관리 · 재연락 · 보장점검",
    helper:
      "고객과 만나는 일정입니다. Google Calendar 원문 표시 설정이 켜져 있으면 고객 이름과 연락처가 표시될 수 있습니다.",
  },
  {
    value: "admin",
    label: "관리자일정",
    summary: "면담 · 팀장회의 · 조직운영 · 인수인계",
    helper: "관리자용 내부 일정입니다. 팀원 계정에서는 선택할 수 없습니다.",
  },
];

export type RecommendScheduleCalendarCategoryInput = {
  scheduleType: string;
  customerId?: number | null;
  ownerRole?: string | null;
};

export function recommendScheduleCalendarCategory(
  input: RecommendScheduleCalendarCategoryInput
): ScheduleCalendarCategory {
  const consultationTypes = new Set([
    "고객상담",
    "재통화",
    "계약예정",
    "보장분석",
    "해지방어",
  ]);

  if (consultationTypes.has(input.scheduleType)) {
    return "consultation_followup";
  }

  if (input.scheduleType === "외근") {
    return input.customerId ? "consultation_followup" : "branch_common";
  }

  if (input.scheduleType === "교육") {
    return "branch_common";
  }

  if (input.scheduleType === "팀회의") {
    const adminRoles = new Set([
      "branch_admin",
      "sub_branch_admin",
      "team_leader",
    ]);
    if (
      adminRoles.has(input.ownerRole ?? "") &&
      (input.customerId == null || input.customerId === 0)
    ) {
      return "admin";
    }
    return "branch_common";
  }

  return "branch_common";
}

export function isScheduleCalendarCategory(
  value: unknown
): value is ScheduleCalendarCategory {
  return (
    typeof value === "string" &&
    (SCHEDULE_CALENDAR_CATEGORIES as readonly string[]).includes(value)
  );
}

export function toGoogleCalendarType(
  category: ScheduleCalendarCategory
): GoogleCalendarType {
  return category;
}
