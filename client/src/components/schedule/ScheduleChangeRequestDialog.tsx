import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Send, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ScheduleCustomerLinkPicker from "./ScheduleCustomerLinkPicker";
import {
  SCHEDULE_REQUEST_REMINDER_OFFSETS,
  SCHEDULE_REQUEST_SCHEDULE_STATUSES,
  SCHEDULE_REQUEST_SCHEDULE_TYPES,
  type ScheduleCreateRequestPayload,
  type ScheduleUpdateRequestPayload,
} from "@shared/scheduleChangeRequest";
import {
  recommendScheduleCalendarCategory,
  SCHEDULE_CALENDAR_CATEGORIES,
  SCHEDULE_CALENDAR_CATEGORY_LABELS,
  type ScheduleCalendarCategory,
} from "@shared/scheduleCalendarCategory";

export type ScheduleRequestableUser = {
  userId: number;
  name: string | null;
  role: string;
  teamName?: string | null;
};

export type RequestableCalendarSchedule = {
  id: number;
  ownerUserId: number;
  ownerName: string;
  title: string;
  type: string;
  status: string;
  startTime: Date | string;
  endTime?: Date | string | null;
  customerId?: number | null;
  memo?: string | null;
  description?: string | null;
  location?: string | null;
  reminderOffsetMinutes?: number | null;
  calendarCategory?: ScheduleCalendarCategory;
};

const reminderLabels: Record<number, string> = {
  [-1]: "알림 없음",
  0: "일정 시각",
  30: "30분 전",
  60: "1시간 전",
  120: "2시간 전",
  180: "3시간 전",
  1440: "1일 전",
};

function toDateTimeLocal(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : format(date, "yyyy-MM-dd'T'HH:mm");
}

type ScheduleFields = {
  title: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  customerId: number | null;
  memo: string;
  description: string;
  location: string;
  reminderOffsetMinutes: number;
  calendarCategory: ScheduleCalendarCategory;
};

function emptyScheduleFields(): ScheduleFields {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return {
    title: "",
    type: "기타",
    status: "예정",
    startTime: format(start, "yyyy-MM-dd'T'HH:mm"),
    endTime: "",
    customerId: null,
    memo: "",
    description: "",
    location: "",
    reminderOffsetMinutes: 30,
    calendarCategory: "branch_common",
  };
}

function fieldsFromSchedule(schedule: RequestableCalendarSchedule): ScheduleFields {
  return {
    title: schedule.title,
    type: schedule.type,
    status: schedule.status,
    startTime: toDateTimeLocal(schedule.startTime),
    endTime: toDateTimeLocal(schedule.endTime),
    customerId: schedule.customerId ?? null,
    memo: schedule.memo ?? "",
    description: schedule.description ?? "",
    location: schedule.location ?? "",
    reminderOffsetMinutes: schedule.reminderOffsetMinutes ?? 30,
    calendarCategory:
      schedule.calendarCategory ??
      recommendScheduleCalendarCategory({
        scheduleType: schedule.type,
        customerId: schedule.customerId,
      }),
  };
}

function ScheduleFieldsForm({
  value,
  onChange,
  disabled,
}: {
  value: ScheduleFields;
  onChange: (value: ScheduleFields) => void;
  disabled?: boolean;
}) {
  const update = <K extends keyof ScheduleFields>(
    key: K,
    nextValue: ScheduleFields[K]
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="schedule-request-title">일정 제목</Label>
        <Input
          id="schedule-request-title"
          value={value.title}
          onChange={event => update("title", event.target.value)}
          disabled={disabled}
          className="mt-1 min-h-11"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>일정 유형</Label>
          <Select
            value={value.type}
            onValueChange={next => {
              onChange({
                ...value,
                type: next,
                calendarCategory: recommendScheduleCalendarCategory({
                  scheduleType: next,
                  customerId: value.customerId,
                }),
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="mt-1 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_REQUEST_SCHEDULE_TYPES.map(item => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>상태</Label>
          <Select
            value={value.status}
            onValueChange={next => update("status", next)}
            disabled={disabled}
          >
            <SelectTrigger className="mt-1 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_REQUEST_SCHEDULE_STATUSES.map(item => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="schedule-request-start">시작 시간</Label>
          <Input
            id="schedule-request-start"
            type="datetime-local"
            value={value.startTime}
            onChange={event => update("startTime", event.target.value)}
            disabled={disabled}
            className="mt-1 min-h-11"
          />
        </div>
        <div>
          <Label htmlFor="schedule-request-end">종료 시간</Label>
          <Input
            id="schedule-request-end"
            type="datetime-local"
            value={value.endTime}
            onChange={event => update("endTime", event.target.value)}
            disabled={disabled}
            className="mt-1 min-h-11"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>캘린더 분류</Label>
          <Select
            value={value.calendarCategory}
            onValueChange={next =>
              update("calendarCategory", next as ScheduleCalendarCategory)
            }
            disabled={disabled}
          >
            <SelectTrigger className="mt-1 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_CALENDAR_CATEGORIES.map(item => (
                <SelectItem key={item} value={item}>
                  {SCHEDULE_CALENDAR_CATEGORY_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>알림</Label>
          <Select
            value={String(value.reminderOffsetMinutes)}
            onValueChange={next =>
              update("reminderOffsetMinutes", Number(next))
            }
            disabled={disabled}
          >
            <SelectTrigger className="mt-1 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_REQUEST_REMINDER_OFFSETS.map(item => (
                <SelectItem key={item} value={String(item)}>
                  {reminderLabels[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScheduleCustomerLinkPicker
        value={value.customerId}
        onChange={customerId => {
          onChange({
            ...value,
            customerId,
            calendarCategory: recommendScheduleCalendarCategory({
              scheduleType: value.type,
              customerId,
            }),
          });
        }}
        disabled={disabled}
      />
      <div>
        <Label htmlFor="schedule-request-location">장소</Label>
        <Input
          id="schedule-request-location"
          value={value.location}
          onChange={event => update("location", event.target.value)}
          disabled={disabled}
          className="mt-1 min-h-11"
        />
      </div>
      <div>
        <Label htmlFor="schedule-request-description">상담내용·설명</Label>
        <Textarea
          id="schedule-request-description"
          value={value.description}
          onChange={event => update("description", event.target.value)}
          disabled={disabled}
          className="mt-1 min-h-20 resize-y"
        />
      </div>
      <div>
        <Label htmlFor="schedule-request-memo">메모</Label>
        <Textarea
          id="schedule-request-memo"
          value={value.memo}
          onChange={event => update("memo", event.target.value)}
          disabled={disabled}
          className="mt-1 min-h-20 resize-y"
        />
      </div>
    </div>
  );
}

function toCreatePayload(fields: ScheduleFields): ScheduleCreateRequestPayload {
  return {
    title: fields.title,
    type: fields.type as ScheduleCreateRequestPayload["type"],
    status: fields.status as ScheduleCreateRequestPayload["status"],
    startTime: fields.startTime,
    endTime: fields.endTime || null,
    customerId: fields.customerId,
    memo: fields.memo || null,
    description: fields.description || null,
    location: fields.location || null,
    reminderOffsetMinutes:
      fields.reminderOffsetMinutes as ScheduleCreateRequestPayload["reminderOffsetMinutes"],
    calendarCategory: fields.calendarCategory,
  };
}

export function ScheduleCreateRequestDialog({
  open,
  users,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  users: ScheduleRequestableUser[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: {
    targetUserId: number;
    reason: string;
    payload: ScheduleCreateRequestPayload;
  }) => void;
}) {
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState(emptyScheduleFields);

  useEffect(() => {
    if (!open) return;
    setTargetUserId(users[0] ? String(users[0].userId) : "");
    setReason("");
    setFields(emptyScheduleFields());
  }, [open, users]);

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="max-h-[min(92vh,50rem)] w-[calc(100vw-1.25rem)] max-w-2xl overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> 신규 일정 요청
          </DialogTitle>
          <DialogDescription>
            산하 직원 일정은 지점장 승인 후 자동 등록됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>대상 직원</Label>
            <Select
              value={targetUserId}
              onValueChange={setTargetUserId}
              disabled={loading}
            >
              <SelectTrigger className="mt-1 min-h-11">
                <SelectValue placeholder="대상 직원을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.userId} value={String(user.userId)}>
                    {user.name ?? `사용자 #${user.userId}`}
                    {user.teamName ? ` · ${user.teamName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScheduleFieldsForm
            value={fields}
            onChange={setFields}
            disabled={loading}
          />
          <div>
            <Label htmlFor="schedule-create-request-reason">요청 사유</Label>
            <Textarea
              id="schedule-create-request-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              className="mt-1 min-h-20 resize-y"
              placeholder="지점장이 확인할 요청 사유를 입력하세요"
              disabled={loading}
            />
          </div>
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-background pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              onClick={onClose}
              disabled={loading}
            >
              취소
            </Button>
            <Button
              type="button"
              className="min-h-12"
              disabled={
                loading ||
                !targetUserId ||
                !reason.trim() ||
                !fields.title.trim() ||
                !fields.startTime
              }
              onClick={() =>
                onSubmit({
                  targetUserId: Number(targetUserId),
                  reason: reason.trim(),
                  payload: toCreatePayload(fields),
                })
              }
            >
              <Send className="mr-1 h-4 w-4" /> 승인 요청
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleExistingChangeRequestDialog({
  open,
  mode,
  schedule,
  loading,
  onClose,
  onSubmitUpdate,
  onSubmitDelete,
}: {
  open: boolean;
  mode: "update" | "delete";
  schedule: RequestableCalendarSchedule | null;
  loading: boolean;
  onClose: () => void;
  onSubmitUpdate: (input: {
    scheduleId: number;
    reason: string;
    payload: ScheduleUpdateRequestPayload;
  }) => void;
  onSubmitDelete: (input: { scheduleId: number; reason: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<ScheduleFields>(emptyScheduleFields);

  useEffect(() => {
    if (!open || !schedule) return;
    setReason("");
    setFields(fieldsFromSchedule(schedule));
  }, [open, schedule, mode]);

  if (!schedule) return null;
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="max-h-[min(92vh,50rem)] w-[calc(100vw-1.25rem)] max-w-2xl overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "delete" ? (
              <Trash2 className="h-5 w-5 text-destructive" />
            ) : (
              <CalendarClock className="h-5 w-5" />
            )}
            {mode === "delete" ? "일정 삭제 요청" : "일정 변경 요청"}
          </DialogTitle>
          <DialogDescription>
            {schedule.ownerName} 담당 일정 · {schedule.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {mode === "update" ? (
            <ScheduleFieldsForm
              value={fields}
              onChange={setFields}
              disabled={loading}
            />
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              승인 전까지 원본 일정은 유지됩니다. 승인되면 기존 soft delete
              정책으로 처리됩니다.
            </div>
          )}
          <div>
            <Label htmlFor="schedule-existing-request-reason">요청 사유</Label>
            <Textarea
              id="schedule-existing-request-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              className="mt-1 min-h-24 resize-y"
              placeholder="지점장이 확인할 요청 사유를 입력하세요"
              disabled={loading}
            />
          </div>
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-background pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              onClick={onClose}
              disabled={loading}
            >
              취소
            </Button>
            <Button
              type="button"
              variant={mode === "delete" ? "destructive" : "default"}
              className="min-h-12"
              disabled={loading || !reason.trim()}
              onClick={() => {
                if (mode === "delete") {
                  onSubmitDelete({
                    scheduleId: schedule.id,
                    reason: reason.trim(),
                  });
                } else {
                  onSubmitUpdate({
                    scheduleId: schedule.id,
                    reason: reason.trim(),
                    payload: toCreatePayload(
                      fields
                    ) as ScheduleUpdateRequestPayload,
                  });
                }
              }}
            >
              <Send className="mr-1 h-4 w-4" /> 요청 보내기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
