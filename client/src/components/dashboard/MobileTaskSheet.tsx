import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle2, XCircle } from "lucide-react";

export type DashboardTaskType = "followUp" | "schedule" | "notification" | "customer";
export type PostponeMode = "quick" | "custom";
export type ConfirmAction = "cancelFollowUp" | null;

export interface DashboardMobileTask extends Record<string, any> {
  id: number;
  taskType: DashboardTaskType;
  priorityLabel: string;
}

export interface MobileTaskSheetProps {
  selectedTask: DashboardMobileTask | null;
  taskTitle: string;
  isTaskBusy: boolean;
  postponeMode: PostponeMode;
  customPostponeDate: string;
  confirmAction: ConfirmAction;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onPostponeModeChange: (mode: PostponeMode) => void;
  onCustomPostponeDateChange: (value: string) => void;
  onConfirmActionChange: (action: ConfirmAction) => void;
  onFollowUpComplete: (task: DashboardMobileTask) => void;
  onFollowUpCancel: (task: DashboardMobileTask) => void;
  onFollowUpQuickPostpone: (task: DashboardMobileTask, days: number) => void;
  onFollowUpCustomPostpone: (task: DashboardMobileTask) => void;
  onScheduleComplete: (task: DashboardMobileTask) => void;
  onNotificationConfirm: (task: DashboardMobileTask) => void;
  onNotificationComplete: (task: DashboardMobileTask) => void;
  onCustomerContactDone: (task: DashboardMobileTask) => void;
  onCustomerAbsent: (task: DashboardMobileTask) => void;
}

export function MobileTaskSheet({
  selectedTask,
  taskTitle,
  isTaskBusy,
  postponeMode,
  customPostponeDate,
  confirmAction,
  onClose,
  onNavigate,
  onPostponeModeChange,
  onCustomPostponeDateChange,
  onConfirmActionChange,
  onFollowUpComplete,
  onFollowUpCancel,
  onFollowUpQuickPostpone,
  onFollowUpCustomPostpone,
  onScheduleComplete,
  onNotificationConfirm,
  onNotificationComplete,
  onCustomerContactDone,
  onCustomerAbsent,
}: MobileTaskSheetProps) {
  return (
<Sheet open={Boolean(selectedTask)} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="bottom" className="max-h-[min(90vh,42rem)] overflow-y-auto overscroll-contain rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] md:hidden">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="break-words text-base leading-6">{taskTitle}</SheetTitle>
            <SheetDescription>
              카드 선택 → 빠른 처리 → 저장 흐름으로 고객 상세 이동 없이 업무를 마칩니다.
            </SheetDescription>
          </SheetHeader>
          {selectedTask && (
            <div className="mt-4 space-y-3">
              {selectedTask.taskType === "followUp" && (
                <>
                  {confirmAction === "cancelFollowUp" && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
                      <p className="font-semibold">후속관리를 취소할까요?</p>
                      <p className="mt-1 text-xs leading-5">취소된 후속관리는 오늘 할 일에서 제외됩니다.</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" className="min-h-12 bg-white" onClick={() => onConfirmActionChange(null)} disabled={isTaskBusy}>
                          돌아가기
                        </Button>
                        <Button
                          type="button"
                          className="min-h-12 bg-red-700 font-semibold text-white hover:bg-red-800"
                          disabled={isTaskBusy}
                          onClick={() => onFollowUpCancel(selectedTask)}
                        >
                          취소 확정
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      className="min-h-12 font-semibold"
                      disabled={isTaskBusy}
                      onClick={() => onFollowUpComplete(selectedTask)}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" /> 완료
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12"
                      disabled={isTaskBusy}
                      onClick={() => onNavigate(`/customers/${selectedTask.customerId}?action=consult`)}
                    >
                      상담기록
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12"
                      disabled={isTaskBusy}
                      onClick={() => onNavigate(`/customers/${selectedTask.customerId}`)}
                    >
                      고객상세
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 text-red-700"
                      disabled={isTaskBusy}
                      onClick={() => onConfirmActionChange("cancelFollowUp")}
                    >
                      <XCircle className="mr-1 h-4 w-4" /> 취소
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/25 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">연기</p>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {[{ label: "오늘", days: 0 }, { label: "내일", days: 1 }, { label: "3일 후", days: 3 }, { label: "1주 후", days: 7 }].map((item) => (
                        <Button
                          key={item.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-12"
                          disabled={isTaskBusy}
                          onClick={() => onFollowUpQuickPostpone(selectedTask, item.days)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label className="text-xs">직접 선택</Label>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input className="min-h-12" type="datetime-local" value={customPostponeDate} onChange={(event) => { onPostponeModeChange("custom"); onCustomPostponeDateChange(event.target.value); }} />
                        <Button
                          type="button"
                          className="min-h-12"
                          disabled={isTaskBusy || postponeMode !== "custom" || !customPostponeDate}
                          onClick={() => onFollowUpCustomPostpone(selectedTask)}
                        >
                          저장
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {selectedTask.taskType === "schedule" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => onScheduleComplete(selectedTask)}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> 완료
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => onNavigate("/calendar")}>일정 보기</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => onNavigate("/customers")}>상담기록</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={onClose}>닫기</Button>
                </div>
              )}
              {selectedTask.taskType === "notification" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => onNotificationConfirm(selectedTask)}
                  >
                    확인
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => onNotificationComplete(selectedTask)}
                  >
                    처리완료
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => onNavigate("/notifications")}>알림센터</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={onClose}>닫기</Button>
                </div>
              )}
              {selectedTask.taskType === "customer" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => onCustomerContactDone(selectedTask)}
                  >
                    연락완료
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12"
                    disabled={isTaskBusy}
                    onClick={() => onCustomerAbsent(selectedTask)}
                  >
                    부재
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => onNavigate(`/customers/${selectedTask.id}?action=consult`)}>상담기록</Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => onNavigate(`/customers/${selectedTask.id}`)}>고객상세</Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
  );
}
