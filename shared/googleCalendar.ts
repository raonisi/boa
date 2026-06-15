export const GOOGLE_CALENDAR_TYPES = [
  "branch_common",
  "consultation_followup",
  "admin",
] as const;

export type GoogleCalendarType = (typeof GOOGLE_CALENDAR_TYPES)[number];

export const GOOGLE_CALENDAR_TYPE_LABELS: Record<GoogleCalendarType, string> = {
  branch_common: "BOA 지점 공통 일정",
  consultation_followup: "BOA 상담·후속관리 일정",
  admin: "BOA 관리자 일정",
};

export const BOA_GOOGLE_EVENT_TYPES = [
  "calendar_event",
  "follow_up",
  "consultation",
  "meeting",
  "education",
  "admin",
] as const;

export type BoaGoogleEventType = (typeof BOA_GOOGLE_EVENT_TYPES)[number];

export const GOOGLE_SYNC_STATUSES = [
  "pending",
  "synced",
  "failed",
  "deleted",
  "skipped",
] as const;

export type GoogleSyncStatus = (typeof GOOGLE_SYNC_STATUSES)[number];

export const GOOGLE_SYNC_TARGET_TYPES = [
  "shared_calendar",
  "actor_personal_calendar",
] as const;

export type GoogleSyncTargetType = (typeof GOOGLE_SYNC_TARGET_TYPES)[number];

/** shared_calendar sync rows use targetUserId=0 */
export const GOOGLE_CALENDAR_SHARED_TARGET_USER_ID = 0;

export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export const DEFAULT_GOOGLE_CALENDAR_DESCRIPTION =
  "BOA CRM에서 생성된 일정입니다.\n고객 식별정보는 외부 캘린더에 표시하지 않습니다.\n상세 내용은 BOA CRM에서 확인하세요.";

export const DEFAULT_GOOGLE_SHARED_CALENDAR_DESCRIPTION =
  "BOA CRM에서 생성된 일정입니다.\n고객 식별정보는 공유 캘린더에 표시하지 않습니다.\n상세 내용은 BOA CRM에서 확인하세요.";

export const SKIPPED_NO_PERSONAL_CALENDAR_CODE = "SKIPPED_NO_PERSONAL_CALENDAR";

export const ORGANIZATION_SCOPE_DEFAULT = 1;

export type GoogleCalendarPayloadPolicy = {
  syncRawTitleToGoogleCalendar: boolean;
  syncRawDescriptionToGoogleCalendar: boolean;
  allowCustomerNameInGoogleCalendar: boolean;
  allowCustomerContactInGoogleCalendar: boolean;
};

export const DEFAULT_GOOGLE_CALENDAR_PAYLOAD_POLICY: GoogleCalendarPayloadPolicy =
  {
    syncRawTitleToGoogleCalendar: false,
    syncRawDescriptionToGoogleCalendar: false,
    allowCustomerNameInGoogleCalendar: false,
    allowCustomerContactInGoogleCalendar: false,
  };

export const MISCLASSIFIED_RESYNC_CONFIRMATION_TEXT = "상담일정 재동기화";

export const MISCLASSIFIED_RESYNC_RESULTS = [
  "resync_dry_run",
  "resync_moved",
  "resync_recreated",
  "resync_failed",
  "skipped_missing_calendar",
  "needs_manual_review",
] as const;

export type MisclassifiedResyncResult =
  (typeof MISCLASSIFIED_RESYNC_RESULTS)[number];
