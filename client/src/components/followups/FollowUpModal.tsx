import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  FOLLOWUP_QUICK_PRESETS,
  type DetailedFollowUpSeed,
} from "@shared/followupQuickCreate";
import { getKstLocalDateTimeAfter } from "@shared/timePolicy";
import { useEffect, useState } from "react";

const linkedScheduleReminderOptions = [
  { value: "-1", label: "알림 없음" },
  { value: "0", label: "시작 시각" },
  { value: "30", label: "30분 전" },
  { value: "60", label: "1시간 전" },
  { value: "120", label: "2시간 전" },
  { value: "1440", label: "하루 전" },
] as const;

export type FollowUpSubmitData = {
  nextContactDate: string;
  reason: string;
  nextAction:
    | "전화"
    | "카톡"
    | "문자"
    | "방문"
    | "설계안 발송"
    | "계약 확인"
    | "보장분석"
    | "사후관리"
    | "기타";
  memo?: string;
  calendarSchedule?: {
    title?: string;
    startTime: string;
    type?: "고객상담" | "재통화";
    memo?: string;
    reminderOffsetMinutes: -1 | 0 | 30 | 60 | 120 | 1440;
  };
};

export default function FollowUpModal({
  open,
  onClose,
  onSubmit,
  loading,
  mode = "create",
  seed,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FollowUpSubmitData) => void;
  loading: boolean;
  mode?: "create" | "postpone";
  seed?: DetailedFollowUpSeed;
}) {
  const [nextContactDate, setNextContactDate] = useState("");
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] =
    useState<FollowUpSubmitData["nextAction"]>("전화");
  const [memo, setMemo] = useState("");
  const [createCalendarSchedule, setCreateCalendarSchedule] = useState(
    mode === "create"
  );
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleReminderOffset, setScheduleReminderOffset] = useState("30");

  useEffect(() => {
    if (!open) return;
    const fallbackDate = getKstLocalDateTimeAfter(new Date(), {
      days: 1,
      defaultHour: 10,
    });
    if (seed) {
      setNextContactDate(seed.nextContactDate ?? fallbackDate);
      setReason(seed.reason ?? "");
      setNextAction(seed.nextAction ?? "전화");
      setMemo(seed.memo ?? "");
    } else {
      setNextContactDate(fallbackDate);
      setReason("");
      setNextAction("전화");
      setMemo("");
    }
    setCreateCalendarSchedule(mode === "create");
    setScheduleTitle("");
    setScheduleReminderOffset("30");
  }, [mode, open, seed]);

  const actions = [
    "전화",
    "카톡",
    "문자",
    "방문",
    "설계안 발송",
    "계약 확인",
    "보장분석",
    "사후관리",
    "기타",
  ] as const;
  const reasons = [
    ...FOLLOWUP_QUICK_PRESETS.map(item => item.reason),
    "설계안 전달 후 재상담",
    "보험료 조정 상담",
    "보장분석 후속 연락",
    "계약 전 확인",
    "계약 후 사후관리",
    "생일/기념일 관리",
    "장기 미관리 고객 재접촉",
    "기타",
  ].filter((item, index, items) => items.indexOf(item) === index);
  const canCreateSchedule = mode === "create";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "postpone" ? "연락일 연기" : "다음 연락일 설정"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            고객과 다시 연락할 날짜와 후속 사유를 기록합니다. 주민등록번호,
            증권번호, 계좌번호, 병력상세 등 민감정보는 입력하지 마세요.
          </p>
          <div>
            <Label>다음 연락일 *</Label>
            <Input
              type="datetime-local"
              value={nextContactDate}
              onChange={e => setNextContactDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>후속관리 사유 *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="사유 선택" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map(item => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>다음 액션</Label>
            <Select
              value={nextAction}
              onValueChange={value => setNextAction(value as typeof nextAction)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actions.map(item => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>메모</Label>
            <Textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="mt-1"
              placeholder="민감정보 입력 금지"
            />
          </div>
          {canCreateSchedule && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-blue-950">
                <input
                  type="checkbox"
                  checked={createCalendarSchedule}
                  onChange={e => setCreateCalendarSchedule(e.target.checked)}
                />
                캘린더 일정도 함께 등록
              </label>
              {createCalendarSchedule && (
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="text-xs">일정 제목</Label>
                    <Input
                      value={scheduleTitle}
                      onChange={e => setScheduleTitle(e.target.value)}
                      className="mt-1"
                      placeholder="비우면 후속관리 일정"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">일정 알림</Label>
                    <Select
                      value={scheduleReminderOffset}
                      onValueChange={setScheduleReminderOffset}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {linkedScheduleReminderOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-blue-800">
                    다음 연락일과 같은 시각에 고객 연결 일정이 생성됩니다.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-background pt-2">
            <Button
              className="min-h-12 md:min-h-11"
              variant="outline"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              className="min-h-12 md:min-h-11"
              disabled={!nextContactDate || !reason || loading}
              onClick={() =>
                onSubmit({
                  nextContactDate,
                  reason,
                  nextAction,
                  memo: memo || undefined,
                  calendarSchedule:
                    canCreateSchedule && createCalendarSchedule
                      ? {
                          title: scheduleTitle || undefined,
                          startTime: nextContactDate,
                          type: nextAction === "방문" ? "고객상담" : "재통화",
                          memo: memo || reason,
                          reminderOffsetMinutes: Number(
                            scheduleReminderOffset
                          ) as -1 | 0 | 30 | 60 | 120 | 1440,
                        }
                      : undefined,
                })
              }
            >
              {mode === "postpone" ? "연기" : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
