import ScheduleCustomerLinkPicker from "@/components/schedule/ScheduleCustomerLinkPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  buildDetailedFollowUpSeedFromQuick,
  buildFollowupQuickContactDate,
  buildQuickFollowUpPayload,
  FOLLOWUP_PRIORITY_CHIP_LABELS,
  FOLLOWUP_PRIORITY_CHIP_ORDER,
  FOLLOWUP_PRIORITY_DEFAULT_DATE_CHIP,
  FOLLOWUP_QUICK_DATE_CHIP_LABELS,
  FOLLOWUP_QUICK_DATE_CHIP_ORDER,
  FOLLOWUP_QUICK_PRESETS,
  getFollowupPresetById,
  type DetailedFollowUpSeed,
  type FollowupQuickDateChip,
  type FollowupQuickPresetId,
  type FollowupQuickPriorityChip,
} from "@shared/followupQuickCreate";
import { formatKstLocalDate } from "@shared/timePolicy";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type FollowupQuickCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultCustomerId?: number;
  onSubmit: (
    data: Omit<ReturnType<typeof buildQuickFollowUpPayload>, "presetLabel">
  ) => void;
  onOpenDetailed: (seed: DetailedFollowUpSeed, customerId: number) => void;
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

export default function FollowupQuickCreateDialog({
  open,
  onClose,
  defaultCustomerId,
  onSubmit,
  onOpenDetailed,
  loading,
}: FollowupQuickCreateDialogProps) {
  const [presetId, setPresetId] =
    useState<FollowupQuickPresetId>("callback");
  const [dateChip, setDateChip] = useState<FollowupQuickDateChip>("tomorrow");
  const [priorityChip, setPriorityChip] =
    useState<FollowupQuickPriorityChip>("normal");
  const [customDateKey, setCustomDateKey] = useState(
    formatKstLocalDate(new Date())
  );
  const [customerId, setCustomerId] = useState<number | null>(
    defaultCustomerId ?? null
  );
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [showMemo, setShowMemo] = useState(false);

  const preset = useMemo(
    () => getFollowupPresetById(presetId),
    [presetId]
  );

  useEffect(() => {
    if (!open) return;
    setPresetId("callback");
    setDateChip("tomorrow");
    setPriorityChip("normal");
    setCustomDateKey(formatKstLocalDate(new Date()));
    setCustomerId(defaultCustomerId ?? null);
    setReason("");
    setMemo("");
    setShowMemo(false);
  }, [defaultCustomerId, open]);

  useEffect(() => {
    if (!open) return;
    setReason(preset.reason);
    setDateChip(preset.defaultDateChip);
  }, [open, preset.reason, preset.defaultDateChip, presetId]);

  const nextContactPreview = buildFollowupQuickContactDate({
    dateChip,
    customDateKey,
  });

  const handleSubmit = () => {
    if (!customerId || !reason.trim()) return;
    const { presetLabel: _presetLabel, ...payload } = buildQuickFollowUpPayload({
      presetId,
      dateChip,
      reason,
      memo,
      customerId,
      customDateKey,
    });
    onSubmit(payload);
  };

  const handleOpenDetailed = () => {
    if (!customerId) return;
    onOpenDetailed(
      buildDetailedFollowUpSeedFromQuick({
        presetId,
        dateChip,
        reason,
        memo,
        customDateKey,
      }),
      customerId
    );
  };

  const handlePrioritySelect = (chip: FollowupQuickPriorityChip) => {
    setPriorityChip(chip);
    setDateChip(FOLLOWUP_PRIORITY_DEFAULT_DATE_CHIP[chip]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[min(92vh,44rem)] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>빠른 후속 등록</DialogTitle>
          <p className="text-xs text-muted-foreground">
            상담 직후 다음 연락과 확인 사항을 빠르게 남길 수 있습니다.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <Label className="text-xs font-semibold">
              어떤 후속관리인가요?
            </Label>
            <div className="flex flex-wrap gap-2">
              {FOLLOWUP_QUICK_PRESETS.map(item => (
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
            <Label className="text-xs font-semibold">고객 연결</Label>
            <ScheduleCustomerLinkPicker
              value={customerId}
              onChange={setCustomerId}
              disabled={loading || defaultCustomerId != null}
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs font-semibold">
              중요도를 선택해 주세요.
            </Label>
            <div className="flex flex-wrap gap-2">
              {FOLLOWUP_PRIORITY_CHIP_ORDER.map(chip => (
                <QuickChip
                  key={chip}
                  selected={priorityChip === chip}
                  onClick={() => handlePrioritySelect(chip)}
                >
                  {FOLLOWUP_PRIORITY_CHIP_LABELS[chip]}
                </QuickChip>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs font-semibold">
              언제까지 확인할까요?
            </Label>
            <div className="flex flex-wrap gap-2">
              {FOLLOWUP_QUICK_DATE_CHIP_ORDER.map(chip => (
                <QuickChip
                  key={chip}
                  selected={dateChip === chip}
                  onClick={() => setDateChip(chip)}
                >
                  {FOLLOWUP_QUICK_DATE_CHIP_LABELS[chip]}
                </QuickChip>
              ))}
            </div>
            {dateChip === "custom" ? (
              <Input
                type="date"
                value={customDateKey}
                onChange={e => setCustomDateKey(e.target.value)}
                className="h-11 md:h-9"
              />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                다음 연락 예정: {nextContactPreview.replace("T", " ")}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <Label className="text-xs">후속 제목</Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
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
                <p className="text-[11px] text-muted-foreground">
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
              disabled={loading || !customerId || !reason.trim()}
              onClick={handleSubmit}
            >
              {loading ? "저장 중..." : "후속 등록"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 md:min-h-10"
              disabled={!customerId}
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
