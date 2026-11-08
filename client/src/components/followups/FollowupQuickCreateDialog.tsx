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
import { useEffect, useMemo, useRef, useState } from "react";

type FollowupQuickCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultCustomerId?: number;
  onSubmit: (
    data: Omit<ReturnType<typeof buildQuickFollowUpPayload>, "presetLabel">
  ) => void;
  onOpenDetailed: (seed: DetailedFollowUpSeed, customerId: number) => void;
  loading: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
  focusFallbackRef?: React.RefObject<HTMLElement | null>;
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
  triggerRef,
  focusFallbackRef,
}: FollowupQuickCreateDialogProps) {
  const openedForCustomerRef = useRef(defaultCustomerId);
  const wasOpenRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const wasSavingRef = useRef(false);
  useEffect(() => {
    const finished = wasSavingRef.current && !loading;
    wasSavingRef.current = loading;
    if (!finished || !open || (!triggerRef && !focusFallbackRef)) return;
    // A disabled focused submit can blur to BODY. On a failed save the
    // still-open form must offer a real, enabled retry target after commit.
    const frame = requestAnimationFrame(() => {
      const content = contentRef.current;
      const active = document.activeElement;
      if (!content?.isConnected || content.contains(active)) return;
      if (active?.closest('[role="dialog"][data-state="open"]')) return;
      const submit = submitRef.current;
      if (submit?.isConnected && !submit.disabled && submit.getClientRects().length &&
          !submit.closest('[aria-hidden="true"], [inert]')) submit.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, open, triggerRef, focusFallbackRef]);
  useEffect(() => {
    if (open && !wasOpenRef.current) openedForCustomerRef.current = defaultCustomerId;
    wasOpenRef.current = open;
  }, [defaultCustomerId, open]);

  const restoreCloseFocus = () => {
    // Wait for Radix to remove its aria-hidden layer. A newer dialog keeps its trap.
    let frames = 0;
    const restore = () => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const usable = (element: HTMLElement | null | undefined): element is HTMLElement =>
        Boolean(element?.isConnected && !element.closest('[aria-hidden="true"], [inert]') &&
          !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true' &&
          element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      const original = openedForCustomerRef.current === defaultCustomerId ? triggerRef?.current : null;
      const currentNavigation = focusFallbackRef ? Array.from(document.querySelectorAll<HTMLElement>(
        '[data-testid="mobile-nav-active-item"], [data-sidebar="menu-button"][data-active="true"], #main-content[tabindex]'
      )).find(usable) : undefined;
      const target = [original, focusFallbackRef?.current, currentNavigation].find(usable);
      if (target) target.focus();
      else if (++frames < 2) requestAnimationFrame(restore);
    };
    requestAnimationFrame(restore);
  };

  const [presetId, setPresetId] = useState<FollowupQuickPresetId>("callback");
  const [dateChip, setDateChip] = useState<FollowupQuickDateChip>("tomorrow");
  const [priorityChip, setPriorityChip] =
    useState<FollowupQuickPriorityChip>("normal");
  const [customDateKey, setCustomDateKey] = useState(
    formatKstLocalDate(new Date())
  );
  const [customerId, setCustomerId] = useState<number | null>(
    defaultCustomerId ?? null
  );
  const [verifiedCustomerId, setVerifiedCustomerId] = useState<number | null>(
    null
  );
  // Use the current route target immediately, before the form reset effect runs.
  const targetCustomerId = defaultCustomerId ?? customerId;
  const targetReady =
    defaultCustomerId == null || verifiedCustomerId === defaultCustomerId;
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [showMemo, setShowMemo] = useState(false);

  const preset = useMemo(() => getFollowupPresetById(presetId), [presetId]);

  useEffect(() => {
    if (!open) setVerifiedCustomerId(null);
  }, [open]);

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
    if (loading || !targetReady || !targetCustomerId || !reason.trim()) return;
    const { presetLabel: _presetLabel, ...payload } = buildQuickFollowUpPayload(
      {
        presetId,
        dateChip,
        reason,
        memo,
        customerId: targetCustomerId,
        customDateKey,
      }
    );
    onSubmit(payload);
  };

  const handleOpenDetailed = () => {
    if (loading || !targetReady || !targetCustomerId) return;
    onOpenDetailed(
      buildDetailedFollowUpSeedFromQuick({
        presetId,
        dateChip,
        reason,
        memo,
        customDateKey,
      }),
      targetCustomerId
    );
  };

  const handlePrioritySelect = (chip: FollowupQuickPriorityChip) => {
    setPriorityChip(chip);
    setDateChip(FOLLOWUP_PRIORITY_DEFAULT_DATE_CHIP[chip]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        ref={contentRef}
        onCloseAutoFocus={e => {
          if (!triggerRef && !focusFallbackRef) return;
          e.preventDefault();
          restoreCloseFocus();
        }}
        className="max-h-[min(92vh,44rem)] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
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
            <ScheduleCustomerLinkPicker
              value={targetCustomerId}
              onChange={setCustomerId}
              disabled={loading}
              selectionLocked={defaultCustomerId != null}
              helperText={
                defaultCustomerId != null
                  ? "이 고객에게 후속관리를 등록합니다."
                  : undefined
              }
              onSelectedCustomerVerified={setVerifiedCustomerId}
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
              <p className="text-2xs text-muted-foreground">
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
              ref={submitRef}
              className="min-h-12 md:min-h-10"
              disabled={
                loading || !targetReady || !targetCustomerId || !reason.trim()
              }
              onClick={handleSubmit}
            >
              {loading ? "저장 중..." : "후속 등록"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 md:min-h-10"
              disabled={loading || !targetReady || !targetCustomerId}
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
