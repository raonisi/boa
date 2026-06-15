import {
  DEFAULT_GOOGLE_CALENDAR_DESCRIPTION,
  GOOGLE_CALENDAR_TYPE_LABELS,
  type BoaGoogleEventType,
  type GoogleCalendarType,
} from "@shared/googleCalendar";

export type SafeCalendarTitleInput = {
  scheduleType?: string;
  boaEventType?: BoaGoogleEventType;
  customerReference?: string | null;
  segmentLabel?: string | null;
  actionLabel?: string | null;
  rawTitle?: string | null;
};

export type SafeCalendarEventPayload = {
  title: string;
  description: string;
  location?: string;
};

const PHONE_PATTERN = /(?:01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})|(?:\d{2,3}[-\s.]?\d{3,4}[-\s.]?\d{4})/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const RRN_PATTERN = /\d{6}[-\s]?\d{7}/;
const PREMIUM_PATTERN =
  /(?:월\s*)?(?:보험료|납입료)\s*\d+[\d,]*\s*(?:원|만원)?|\d+[\d,]*\s*(?:원|만원)\s*(?:보험료|납입료)/i;
const POLICY_NUMBER_PATTERN =
  /(?:증권|계약)\s*(?:번호|no\.?)?\s*[:：]?\s*[A-Za-z0-9-]{6,}/i;

const SENSITIVE_NAME_PATTERNS: RegExp[] = [
  /고객\s*홍길동/i,
  /홍길동\s*고객/i,
  /홍길동/,
  /계약자\s*김철수/i,
  /김철수\s*계약자/i,
  /김철수/,
  /피보험자\s*이영희/i,
  /이영희\s*피보험자/i,
  /이영희/,
];

const DISEASE_KEYWORDS = [
  "암",
  "당뇨",
  "고혈압",
  "질병",
  "진단",
  "입원",
  "수술",
  "암보험",
  "질병명",
  "피보험자",
];

const PRODUCT_COMBINED_PATTERN =
  /(?:보험|상품).{0,20}(?:고객|계약자|피보험자)|(?:고객|계약자|피보험자).{0,20}(?:보험|상품)/i;

const ALLOWED_REFERENCE_PATTERN =
  /^(?:A-\d{2,4}|K고객|\d{0,2}0대\s*기혼\s*DB|기존계약자군|신규\s*DB|소개고객군)$/i;

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  고객상담: "상담 예정",
  재통화: "재연락",
  계약예정: "계약 예정",
  보장분석: "보장점검",
  해지방어: "해지 방어",
  팀회의: "회의",
  교육: "교육",
  외근: "방문 일정",
  휴무: "휴무",
  기타: "일정",
};

const BOA_EVENT_TYPE_LABELS: Record<BoaGoogleEventType, string> = {
  calendar_event: "일정",
  follow_up: "후속관리",
  consultation: "상담 예정",
  meeting: "회의",
  education: "교육",
  admin: "관리자 회의",
};

export function findSensitiveCalendarPattern(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) return null;
  const value = text.trim();

  for (const pattern of SENSITIVE_NAME_PATTERNS) {
    if (pattern.test(value)) return "customer_name";
  }
  if (PHONE_PATTERN.test(value)) return "phone_number";
  if (EMAIL_PATTERN.test(value)) return "email";
  if (RRN_PATTERN.test(value)) return "resident_id_like";
  if (PREMIUM_PATTERN.test(value)) return "premium_amount";
  if (POLICY_NUMBER_PATTERN.test(value)) return "policy_number";
  if (PRODUCT_COMBINED_PATTERN.test(value)) return "product_with_customer";
  for (const keyword of DISEASE_KEYWORDS) {
    if (value.includes(keyword)) return "disease_or_medical";
  }
  return null;
}

export function assertSafeGoogleCalendarEventPayload(
  payload: SafeCalendarEventPayload
): void {
  const fields: Array<[string, string | undefined]> = [
    ["title", payload.title],
    ["description", payload.description],
    ["location", payload.location],
  ];
  for (const [field, value] of fields) {
    const reason = findSensitiveCalendarPattern(value);
    if (reason) {
      throw new Error(
        `Google Calendar ${field} contains sensitive data (${reason})`
      );
    }
  }
}

function normalizeReference(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!ALLOWED_REFERENCE_PATTERN.test(trimmed)) {
    const reason = findSensitiveCalendarPattern(trimmed);
    if (reason) {
      throw new Error(`Customer reference is not allowed (${reason})`);
    }
  }
  return trimmed;
}

export function buildSafeGoogleCalendarTitle(
  input: SafeCalendarTitleInput
): string {
  if (input.rawTitle) {
    const blocked = findSensitiveCalendarPattern(input.rawTitle);
    if (blocked) {
      throw new Error(`Schedule title contains sensitive data (${blocked})`);
    }
  }

  const typeLabel =
    (input.scheduleType && SCHEDULE_TYPE_LABELS[input.scheduleType]) ||
    (input.boaEventType && BOA_EVENT_TYPE_LABELS[input.boaEventType]) ||
    "일정";

  const reference = normalizeReference(input.customerReference);
  const segment = normalizeReference(input.segmentLabel);
  const action = input.actionLabel?.trim();

  const parts = [typeLabel];
  if (reference) parts.push(reference);
  if (segment) parts.push(segment);
  else if (action) parts.push(action);

  const title = `[BOA] ${parts.join(" · ")}`;
  assertSafeGoogleCalendarEventPayload({ title, description: "" });
  return title;
}

export function buildSafeGoogleCalendarDescription(): string {
  return DEFAULT_GOOGLE_CALENDAR_DESCRIPTION;
}

export type ScheduleCalendarMappingInput = {
  scheduleType: string;
  customerId?: number | null;
  ownerRole?: string | null;
  status?: string | null;
};

export function mapBoaScheduleToGoogleCalendarType(
  schedule: ScheduleCalendarMappingInput
): GoogleCalendarType | "skipped" {
  if (schedule.status === "취소" || schedule.scheduleType === "휴무") {
    return "skipped";
  }

  const consultationTypes = new Set([
    "고객상담",
    "재통화",
    "계약예정",
    "보장분석",
    "해지방어",
  ]);

  if (consultationTypes.has(schedule.scheduleType)) {
    return "consultation_followup";
  }

  if (schedule.scheduleType === "교육") {
    return "branch_common";
  }

  if (schedule.scheduleType === "팀회의") {
    const adminRoles = new Set([
      "branch_admin",
      "sub_branch_admin",
      "team_leader",
    ]);
    if (
      adminRoles.has(schedule.ownerRole ?? "") &&
      (schedule.customerId == null || schedule.customerId === 0)
    ) {
      return "admin";
    }
    return "branch_common";
  }

  if (schedule.scheduleType === "외근") {
    return schedule.customerId ? "consultation_followup" : "branch_common";
  }

  return "branch_common";
}

export function mapFollowUpToGoogleCalendarType(): GoogleCalendarType {
  return "consultation_followup";
}

export function getCalendarDisplayName(calendarType: GoogleCalendarType): string {
  return GOOGLE_CALENDAR_TYPE_LABELS[calendarType];
}

export function mapScheduleTypeToBoaEventType(
  scheduleType: string,
  calendarType: GoogleCalendarType
): BoaGoogleEventType {
  if (calendarType === "admin") return "admin";
  if (scheduleType === "교육") return "education";
  if (scheduleType === "팀회의") return "meeting";
  return "calendar_event";
}
