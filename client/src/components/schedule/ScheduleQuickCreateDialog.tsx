import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ScheduleCustomerLinkPicker from "@/components/schedule/ScheduleCustomerLinkPicker";
import { cn } from "@/lib/utils";
import {
  buildQuickSchedulePayload,
  QUICK_DATE_CHIP_LABELS,
  QUICK_TIME_CHIP_LABELS,
  SCHEDULE_QUICK_PRESETS,
  type QuickDateChip,
  type QuickTimeChip,
  type ScheduleQuickPresetId,
} from "@shared/scheduleQuickCreate";
import type { ScheduleCalendarCategory } from "@shared/scheduleCalendarCategory";
import { formatKstLocalDate } from "@shared/timePolicy";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

export type DetailedScheduleSeed = {
  title?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  memo?: string;
  customerId?: number;
  calendarCategory?: ScheduleCalendarCategory;
};

type ScheduleQuickCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date | null;
  defaultCustomerId?: number;
  onSubmit: (data: ReturnType<typeof buildQuickSchedulePayload>) => void;
  onOpenDetailed: (seed: DetailedScheduleSeed) => void;
  loading: boolean;
};

function QuickChip({
  selected,
  children,
  onClick,
  className,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      className={cn("min-h-11 rounded-full px-3 text-xs md:min-h-9", className)}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export default function ScheduleQuickCreateDialog({
  open,
  onClose,
  defaultDate,
  defaultCustomerId,
  onSubmit,
  onOpenDetailed,
  loading,
}: ScheduleQuickCreateDialogProps) {
  const [presetId, setPresetId] =
    useState<ScheduleQuickPresetId>("phone_consultation");
  const [dateChip, setDateChip] = useState<QuickDateChip>("today");
  const [timeChip, setTimeChip] = useState<QuickTimeChip>("morning");
  const [customDateKey, setCustomDateKey] = useState(
    formatKstLocalDate(new Date())
  );
  const [customDateTime, setCustomDateTime] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(
    defaultCustomerId ?? null
  );
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [showMemo, setShowMemo] = useState(false);
  const [timeModified, setTimeModified] = useState(false);

  const preset = useMemo(
    () => SCHEDULE_QUICK_PRESETS.find(item => item.id === presetId)!,
    [presetId]
  );

  useEffect(() => {
    if (!open) return;
    const defaultKey = defaultDate
      ? formatKstLocalDate(defaultDate)
      : formatKstLocalDate(new Date());
    const todayKey = formatKstLocalDate(new Date());
    setPresetId("phone_consultation");
    setDateChip(defaultKey === todayKey ? "today" : "custom");
    setTimeChip("morning");
    setCustomDateKey(defaultKey);
    setCustomDateTime("");
    setCustomerId(defaultCustomerId ?? null);
    setTitle("");
    setMemo("");
    setShowMemo(false);
    setTimeModified(false);
  }, [defaultDate, defaultCustomerId, open]);

  useEffect(() => {
    if (!open) return;
    setTitle(preset.title);
  }, [open, preset.title, presetId]);

  const payload = buildQuickSchedulePayload({
    presetId,
    dateChip,
    timeChip,
    title,
    memo,
    customerId,
    customDateKey,
    customDateTime: timeChip === "custom" ? customDateTime : undefined,
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(payload);
  };

  const handleOpenDetailed = () => {
    onOpenDetailed({
      title: title.trim() || preset.title,
      type: preset.scheduleType,
      startTime: timeModified ? payload.startTime : undefined,
      endTime: timeModified ? payload.endTime : undefined,
      memo: memo.trim() || undefined,
      customerId: customerId ?? undefined,
      calendarCategory: payload.calendarCategory,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[min(92vh,44rem)] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>빠른 일정 등록</DialogTitle>
          <p className="text-xs text-muted-foreground">
            상담 직후 다음 일정을 빠르게 남길 수 있습니다.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <Label className="text-xs font-semibold">어떤 일정인가요?</Label>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_QUICK_PRESETS.map(item => (
                <QuickChip
                  key={item.id}
                  selected={presetId === item.id}
                  onClick={() => setPresetId(item.id)}
                >
                  {item.label}
                </QuickChip>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <ScheduleCustomerLinkPicker
              value={customerId}
              onChange={setCustomerId}
              disabled={loading}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs font-semibold">언제 진행할까요?</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(QUICK_DATE_CHIP_LABELS) as QuickDateChip[]).map(
                chip => (
                  <QuickChip
                    key={chip}
                    selected={dateChip === chip}
                    onClick={() => {
                      setDateChip(chip);
                      setTimeModified(true);
                    }}
                  >
                    {QUICK_DATE_CHIP_LABELS[chip]}
                  </QuickChip>
                )
              )}
            </div>
            {dateChip === "custom" ? (
              <Input
                type="date"
                value={customDateKey}
                onChange={e => {
                  setCustomDateKey(e.target.value);
                  setTimeModified(true);
                }}
                className="h-11 md:h-9"
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(QUICK_TIME_CHIP_LABELS) as QuickTimeChip[]).map(
                chip => (
                  <QuickChip
                    key={chip}
                    selected={timeChip === chip}
                    onClick={() => {
                      setTimeChip(chip);
                      setTimeModified(true);
                    }}
                  >
                    {QUICK_TIME_CHIP_LABELS[chip]}
                  </QuickChip>
                )
              )}
            </div>
            {timeChip === "custom" ? (
              <Input
                type="datetime-local"
                value={customDateTime}
                onChange={e => {
                  setCustomDateTime(e.target.value);
                  setTimeModified(true);
                }}
                className="h-11 md:h-9"
              />
            ) : (
              <p className="text-2xs text-muted-foreground">
                예정 시각: {payload.startTime.replace("T", " ")}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <Label className="text-xs">제목</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="min-h-11 md:min-h-9"
            />
            {showMemo ? (
              <div className="space-y-1">
                <Label className="text-xs">메모</Label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder={preset.memoPlaceholder}
                  className="h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-2xs text-muted-foreground">
                  메모를 남겨두면 다음 상담이 쉬워집니다.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-0 text-xs text-primary"
                onClick={() => setShowMemo(true)}
              >
                메모 추가
              </Button>
            )}
          </section>

          <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background pt-3">
            <Button
              className="min-h-12 md:min-h-10"
              disabled={loading || !title.trim()}
              onClick={handleSubmit}
            >
              {loading ? "저장 중..." : "일정 등록"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 md:min-h-9"
              onClick={handleOpenDetailed}
            >
              상세 입력
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
