import { z } from "zod";
import { SCHEDULE_CALENDAR_CATEGORIES } from "./scheduleCalendarCategory";

export const SCHEDULE_CHANGE_REQUEST_TYPES = [
  "create",
  "update",
  "delete",
] as const;

export const SCHEDULE_CHANGE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "conflict",
  "failed",
] as const;

export const SCHEDULE_REQUEST_SCHEDULE_TYPES = [
  "고객상담",
  "재통화",
  "계약예정",
  "보장분석",
  "해지방어",
  "팀회의",
  "교육",
  "외근",
  "휴무",
  "기타",
] as const;

export const SCHEDULE_REQUEST_SCHEDULE_STATUSES = [
  "예정",
  "완료",
  "취소",
  "변경",
  "노쇼",
  "보류",
] as const;

export const SCHEDULE_REQUEST_REMINDER_OFFSETS = [
  -1,
  0,
  30,
  60,
  120,
  180,
  1440,
] as const;

const nullableText = (max: number) => z.string().max(max).nullable().optional();
const reminderOffsetSchema = z.union(
  SCHEDULE_REQUEST_REMINDER_OFFSETS.map(value => z.literal(value)) as [
    z.ZodLiteral<-1>,
    z.ZodLiteral<0>,
    z.ZodLiteral<30>,
    z.ZodLiteral<60>,
    z.ZodLiteral<120>,
    z.ZodLiteral<180>,
    z.ZodLiteral<1440>,
  ]
);

export const scheduleCreateRequestPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(SCHEDULE_REQUEST_SCHEDULE_TYPES),
    status: z.enum(SCHEDULE_REQUEST_SCHEDULE_STATUSES).optional(),
    startTime: z.string().min(1),
    endTime: z.string().nullable().optional(),
    memo: nullableText(2000),
    description: nullableText(2000),
    location: nullableText(200),
    reminderOffsetMinutes: reminderOffsetSchema.optional(),
    customerId: z.number().int().positive().nullable().optional(),
    calendarCategory: z.enum(SCHEDULE_CALENDAR_CATEGORIES).optional(),
  })
  .strict();

export const scheduleUpdateRequestPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    type: z.enum(SCHEDULE_REQUEST_SCHEDULE_TYPES).optional(),
    status: z.enum(SCHEDULE_REQUEST_SCHEDULE_STATUSES).optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().nullable().optional(),
    memo: nullableText(2000),
    description: nullableText(2000),
    location: nullableText(200),
    reminderOffsetMinutes: reminderOffsetSchema.optional(),
    customerId: z.number().int().positive().nullable().optional(),
    calendarCategory: z.enum(SCHEDULE_CALENDAR_CATEGORIES).optional(),
  })
  .strict()
  .refine(value => Object.keys(value).length > 0, {
    message: "변경할 일정 정보가 필요합니다.",
  });

export const scheduleChangeRequestReasonSchema = z
  .string()
  .trim()
  .min(1, "요청 사유를 입력해 주세요.")
  .max(500);

export type ScheduleChangeRequestType =
  (typeof SCHEDULE_CHANGE_REQUEST_TYPES)[number];
export type ScheduleChangeRequestStatus =
  (typeof SCHEDULE_CHANGE_REQUEST_STATUSES)[number];
export type ScheduleCreateRequestPayload = z.infer<
  typeof scheduleCreateRequestPayloadSchema
>;
export type ScheduleUpdateRequestPayload = z.infer<
  typeof scheduleUpdateRequestPayloadSchema
>;

export const SCHEDULE_CHANGE_REQUEST_TYPE_LABELS: Record<
  ScheduleChangeRequestType,
  string
> = {
  create: "신규 일정",
  update: "일정 변경",
  delete: "일정 삭제",
};

export const SCHEDULE_CHANGE_REQUEST_STATUS_LABELS: Record<
  ScheduleChangeRequestStatus,
  string
> = {
  pending: "승인 대기",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
  conflict: "충돌",
  failed: "반영 실패",
};
