import {
  DEFAULT_GOOGLE_CALENDAR_DESCRIPTION,
  DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY,
  DEFAULT_GOOGLE_SHARED_CALENDAR_DESCRIPTION,
  GOOGLE_CALENDAR_TYPE_LABELS,
  type BoaGoogleEventType,
  type GoogleCalendarPayloadPolicy,
  type GoogleCalendarType,
  type GoogleSyncTargetType,
} from "@shared/googleCalendar";
import type { ScheduleCalendarCategory } from "@shared/scheduleCalendarCategory";

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

export type SafeCalendarDescriptionOptions = {
  targetType: GoogleSyncTargetType | "branch_common" | "admin";
  includeCustomerContact?: boolean;
  customerContact?: string | null;
  viewerUserId?: number;
  createdBy?: number | null;
  ownerUserId?: number | null;
};

export type AssertSafePayloadOptions = SafeCalendarDescriptionOptions;

export type GoogleCalendarTitleInput = SafeCalendarTitleInput & {
  title?: string | null;
};

export type GoogleCalendarDescriptionInput = {
  description?: string | null;
  memo?: string | null;
  targetType?: GoogleSyncTargetType | "branch_common" | "admin";
  includeCustomerContact?: boolean;
  customerContact?: string | null;
  viewerUserId?: number;
  createdBy?: number | null;
  ownerUserId?: number | null;
};

const FORBIDDEN_SECRET_PATTERNS: RegExp[] = [
  /\brefresh[_-]?token\b/i,
  /\baccess[_-]?token\b/i,
  /\bid[_-]?token\b/i,
  /\bapi[_-]?key\b/i,
  /\bclient[_-]?secret\b/i,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /\bDATABASE_URL\b/i,
  /\bJWT_SECRET\b/i,
  /firebase[_-]?admin/i,
  /google[_-]?client[_-]?secret/i,
];

const FORBIDDEN_LOG_METADATA_KEYS = new Set([
  "title",
  "description",
  "rawTitle",
  "rawDescription",
  "customerName",
  "customerContact",
  "phone",
  "customerPhone",
  "googleEventId",
  "refreshToken",
  "accessToken",
]);

export function orgSettingsToPayloadPolicy(
  settings?: Partial<{
    syncRawTitleToGoogleCalendar: boolean;
    syncRawDescriptionToGoogleCalendar: boolean;
    allowCustomerNameInGoogleCalendar: boolean;
    allowCustomerContactInGoogleCalendar: boolean;
  }> | null
): GoogleCalendarPayloadPolicy {
  return {
    syncRawTitleToGoogleCalendar:
      settings?.syncRawTitleToGoogleCalendar ?? false,
    syncRawDescriptionToGoogleCalendar:
      settings?.syncRawDescriptionToGoogleCalendar ?? false,
    allowCustomerNameInGoogleCalendar:
      settings?.allowCustomerNameInGoogleCalendar ?? false,
    allowCustomerContactInGoogleCalendar:
      settings?.allowCustomerContactInGoogleCalendar ?? false,
  };
}

export function isRawPiiAllowed(
  policy: GoogleCalendarPayloadPolicy = DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY
): boolean {
  return (
    policy.syncRawTitleToGoogleCalendar ||
    policy.syncRawDescriptionToGoogleCalendar ||
    policy.allowCustomerNameInGoogleCalendar ||
    policy.allowCustomerContactInGoogleCalendar
  );
}

export function syncMetadataFlagsFromPolicy(
  policy: GoogleCalendarPayloadPolicy
) {
  return {
    rawTitleSynced: policy.syncRawTitleToGoogleCalendar,
    rawDescriptionSynced: policy.syncRawDescriptionToGoogleCalendar,
    customerNameAllowed: policy.allowCustomerNameInGoogleCalendar,
    customerContactAllowed: policy.allowCustomerContactInGoogleCalendar,
  };
}

export function findForbiddenSecretPattern(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) return null;
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(text)) return "forbidden_secret";
  }
  return null;
}

export function sanitizeGoogleCalendarLogMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_LOG_METADATA_KEYS.has(key)) continue;
    if (typeof value === "string") {
      let scrubbed = value.replace(PHONE_PATTERN, "[연락처]");
      for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
        scrubbed = scrubbed.replace(pattern, "[secret]");
      }
      safe[key] = scrubbed.slice(0, 500);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

export function assertGoogleCalendarPayloadPolicy(
  payload: SafeCalendarEventPayload,
  policy: GoogleCalendarPayloadPolicy = DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY,
  options?: AssertSafePayloadOptions
): void {
  for (const [field, value] of [
    ["title", payload.title],
    ["description", payload.description],
    ["location", payload.location],
  ] as const) {
    const secret = findForbiddenSecretPattern(value);
    if (secret) {
      throw new Error(
        `Google Calendar ${field} contains forbidden secret (${secret})`
      );
    }
  }
  if (isRawPiiAllowed(policy)) return;
  assertSafeGoogleCalendarEventPayload(payload, options);
}

export function applyGoogleCalendarPiiPolicyToText(
  text: string,
  policy: GoogleCalendarPayloadPolicy,
  field: "title" | "description"
): string {
  let result = text.trim();
  if (
    !policy.allowCustomerContactInGoogleCalendar &&
    containsPhoneNumber(result)
  ) {
    result = result
      .replace(PHONE_PATTERN, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  if (!policy.allowCustomerNameInGoogleCalendar) {
    const nameReason = findSensitiveCalendarPattern(result, { field });
    if (nameReason === "customer_name" || nameReason === "name_with_contact") {
      throw new Error(`customer_name_not_allowed (${nameReason})`);
    }
  }
  if (!result) {
    throw new Error("empty_after_pii_policy");
  }
  return result;
}

export function buildGoogleCalendarTitle(
  input: GoogleCalendarTitleInput,
  policy: GoogleCalendarPayloadPolicy = DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY
): string {
  const rawTitle = input.title?.trim() || input.rawTitle?.trim() || "";
  if (policy.syncRawTitleToGoogleCalendar && rawTitle) {
    try {
      const title = applyGoogleCalendarPiiPolicyToText(
        rawTitle,
        policy,
        "title"
      );
      assertGoogleCalendarPayloadPolicy({ title, description: "" }, policy);
      return title;
    } catch {
      return buildSafeGoogleCalendarTitle({
        scheduleType: input.scheduleType,
        boaEventType: input.boaEventType,
        customerReference: input.customerReference,
        segmentLabel: input.segmentLabel,
        actionLabel: input.actionLabel,
      });
    }
  }
  return buildSafeGoogleCalendarTitle({
    scheduleType: input.scheduleType,
    boaEventType: input.boaEventType,
    customerReference: input.customerReference,
    segmentLabel: input.segmentLabel,
    actionLabel: input.actionLabel,
  });
}

export function buildGoogleCalendarDescription(
  input: GoogleCalendarDescriptionInput,
  policy: GoogleCalendarPayloadPolicy = DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY
): string {
  const rawText = input.description?.trim() || input.memo?.trim() || "";
  if (policy.syncRawDescriptionToGoogleCalendar && rawText) {
    try {
      const description = applyGoogleCalendarPiiPolicyToText(
        rawText,
        policy,
        "description"
      );
      assertGoogleCalendarPayloadPolicy(
        { title: "[BOA]", description },
        policy,
        {
          targetType: input.targetType ?? "shared_calendar",
          includeCustomerContact: input.includeCustomerContact,
          customerContact: input.customerContact,
          viewerUserId: input.viewerUserId,
          createdBy: input.createdBy,
          ownerUserId: input.ownerUserId,
        }
      );
      return description;
    } catch {
      return buildSafeGoogleCalendarDescription({
        targetType: input.targetType ?? "shared_calendar",
        includeCustomerContact: input.includeCustomerContact,
        customerContact: input.customerContact,
        viewerUserId: input.viewerUserId,
        createdBy: input.createdBy,
        ownerUserId: input.ownerUserId,
      });
    }
  }
  return buildSafeGoogleCalendarDescription({
    targetType: input.targetType ?? "shared_calendar",
    includeCustomerContact: input.includeCustomerContact,
    customerContact: input.customerContact,
    viewerUserId: input.viewerUserId,
    createdBy: input.createdBy,
    ownerUserId: input.ownerUserId,
  });
}

const PHONE_PATTERN =
  /(?:01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})|(?:\d{2,3}[-\s.]?\d{3,4}[-\s.]?\d{4})/;
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

const NAME_CONTACT_COMBINED_PATTERN =
  /(?:홍길동|김철수|이영희).{0,30}(?:01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})|(?:01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}).{0,30}(?:홍길동|김철수|이영희)/;

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

export function containsPhoneNumber(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return PHONE_PATTERN.test(text.trim());
}

export function findSensitiveCalendarPattern(
  text: string | null | undefined,
  opts?: {
    field?: "title" | "description" | "location";
    allowCustomerContactInDescription?: boolean;
  }
): string | null {
  if (!text?.trim()) return null;
  const value = text.trim();
  const field = opts?.field ?? "title";

  if (NAME_CONTACT_COMBINED_PATTERN.test(value)) {
    return "name_with_contact";
  }

  for (const pattern of SENSITIVE_NAME_PATTERNS) {
    if (pattern.test(value)) return "customer_name";
  }

  if (field === "description" && opts?.allowCustomerContactInDescription) {
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

export function canIncludeContactInPersonalDescription(
  options: SafeCalendarDescriptionOptions
): boolean {
  if (options.targetType !== "actor_personal_calendar") return false;
  if (!options.includeCustomerContact) return false;
  if (!options.customerContact?.trim()) return false;
  if (options.viewerUserId == null) return false;
  const allowedActors = new Set(
    [options.createdBy, options.ownerUserId].filter(
      (id): id is number => id != null && id > 0
    )
  );
  return allowedActors.has(options.viewerUserId);
}

export function assertSafeGoogleCalendarEventPayload(
  payload: SafeCalendarEventPayload,
  options?: AssertSafePayloadOptions
): void {
  const allowContact =
    options != null &&
    canIncludeContactInPersonalDescription({
      ...options,
      includeCustomerContact: options.includeCustomerContact ?? false,
    });

  const titleReason = findSensitiveCalendarPattern(payload.title, {
    field: "title",
  });
  if (titleReason) {
    throw new Error(
      `Google Calendar title contains sensitive data (${titleReason})`
    );
  }

  const locationReason = findSensitiveCalendarPattern(payload.location, {
    field: "location",
  });
  if (locationReason) {
    throw new Error(
      `Google Calendar location contains sensitive data (${locationReason})`
    );
  }

  const descriptionReason = findSensitiveCalendarPattern(payload.description, {
    field: "description",
    allowCustomerContactInDescription: allowContact,
  });
  if (descriptionReason) {
    throw new Error(
      `Google Calendar description contains sensitive data (${descriptionReason})`
    );
  }
}

function normalizeReference(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!ALLOWED_REFERENCE_PATTERN.test(trimmed)) {
    const reason = findSensitiveCalendarPattern(trimmed, { field: "title" });
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
    const blocked = findSensitiveCalendarPattern(input.rawTitle, {
      field: "title",
    });
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

export function buildSafeGoogleCalendarLocation(
  location?: string | null
): string | undefined {
  if (!location?.trim()) return undefined;
  const reason = findSensitiveCalendarPattern(location, { field: "location" });
  if (reason) {
    throw new Error(
      `Google Calendar location contains sensitive data (${reason})`
    );
  }
  return location.trim();
}

export function buildSafeGoogleCalendarDescription(
  options?: SafeCalendarDescriptionOptions
): string {
  const targetType = options?.targetType ?? "shared_calendar";

  if (targetType === "shared_calendar") {
    return DEFAULT_GOOGLE_SHARED_CALENDAR_DESCRIPTION;
  }

  if (
    targetType === "branch_common" ||
    targetType === "admin" ||
    !canIncludeContactInPersonalDescription({
      targetType: "actor_personal_calendar",
      includeCustomerContact: options?.includeCustomerContact ?? false,
      customerContact: options?.customerContact,
      viewerUserId: options?.viewerUserId,
      createdBy: options?.createdBy,
      ownerUserId: options?.ownerUserId,
    })
  ) {
    return DEFAULT_GOOGLE_CALENDAR_DESCRIPTION;
  }

  const contact = options!.customerContact!.trim();
  const description = [
    "BOA CRM에서 생성된 일정입니다.",
    `담당자 확인용 연락처: ${contact}`,
    "상세 내용은 BOA CRM에서 확인하세요.",
  ].join("\n");

  assertSafeGoogleCalendarEventPayload(
    { title: "[BOA] 일정", description },
    {
      targetType: "actor_personal_calendar",
      includeCustomerContact: true,
      customerContact: contact,
      viewerUserId: options?.viewerUserId,
      createdBy: options?.createdBy,
      ownerUserId: options?.ownerUserId,
    }
  );

  return description;
}

export type ScheduleCalendarMappingInput = {
  scheduleType: string;
  customerId?: number | null;
  ownerRole?: string | null;
  status?: string | null;
  calendarCategory?: ScheduleCalendarCategory | null;
  explicitCalendarType?: GoogleCalendarType | null;
};

export function resolveScheduleGoogleCalendarType(
  schedule: ScheduleCalendarMappingInput
): GoogleCalendarType | "skipped" {
  if (schedule.status === "취소" || schedule.scheduleType === "휴무") {
    return "skipped";
  }
  if (schedule.calendarCategory) {
    return schedule.calendarCategory;
  }
  if (schedule.explicitCalendarType) {
    return schedule.explicitCalendarType;
  }
  return mapBoaScheduleToGoogleCalendarType(schedule);
}

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

export function getCalendarDisplayName(
  calendarType: GoogleCalendarType
): string {
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

export function resolvePersonalCalendarActorUserIds(input: {
  createdBy?: number | null;
  ownerUserId?: number | null;
  ownerOnly?: boolean;
}): number[] {
  if (input.ownerOnly) {
    return input.ownerUserId != null && input.ownerUserId > 0
      ? [input.ownerUserId]
      : [];
  }
  const ids = [input.createdBy, input.ownerUserId].filter(
    (id): id is number => id != null && id > 0
  );
  return Array.from(new Set(ids));
}
