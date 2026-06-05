import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { addDays, startOfDay, format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = ["미상담", "부재", "통화완료", "상담예정", "설계중", "계약", "보류", "거절", "해지관리", "재상담필요"] as const;
const NEXT_ACTION_OPTIONS = ["재연락", "설계안 발송", "보장분석 진행", "계약 진행", "추가 자료 요청", "가족과 상의", "보류", "거절", "장기관리", "사후관리"] as const;

const formSchema = z.object({
  status: z.enum(STATUS_OPTIONS),
  nextAction: z.enum(NEXT_ACTION_OPTIONS).optional(),
  summary: z.string().max(200).optional(),
  followUpPreset: z.enum(["none", "today", "tomorrow", "3days", "1week"]).optional(),
  createSchedule: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface QuickConsultationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  customerName: string;
  currentStatus?: string;
  currentNextAction?: string;
  onSuccess?: () => void;
}

export function QuickConsultationModal({
  open,
  onOpenChange,
  customerId,
  customerName,
  currentStatus,
  currentNextAction,
  onSuccess
}: QuickConsultationModalProps) {
  const trpcContext = trpc.useContext();
  const createMutation = trpc.consultations.create.useMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: (STATUS_OPTIONS.includes(currentStatus as any) ? currentStatus : "미상담") as any,
      nextAction: (NEXT_ACTION_OPTIONS.includes(currentNextAction as any) ? currentNextAction : undefined) as any,
      summary: "",
      followUpPreset: "none",
      createSchedule: false,
    },
  });

  // Reset form when modal opens with new data
  useEffect(() => {
    if (open) {
      form.reset({
        status: (STATUS_OPTIONS.includes(currentStatus as any) ? currentStatus : "미상담") as any,
        nextAction: (NEXT_ACTION_OPTIONS.includes(currentNextAction as any) ? currentNextAction : undefined) as any,
        summary: "",
        followUpPreset: "none",
        createSchedule: false,
      });
    }
  }, [open, currentStatus, currentNextAction, form]);

  const onSubmit = async (values: FormValues) => {
    let nextContactAt: string | undefined = undefined;
    if (values.followUpPreset !== "none") {
      const now = startOfDay(new Date());
      switch (values.followUpPreset) {
        case "today": nextContactAt = format(now, "yyyy-MM-dd"); break;
        case "tomorrow": nextContactAt = format(addDays(now, 1), "yyyy-MM-dd"); break;
        case "3days": nextContactAt = format(addDays(now, 3), "yyyy-MM-dd"); break;
        case "1week": nextContactAt = format(addDays(now, 7), "yyyy-MM-dd"); break;
      }
    }

    const calendarSchedule = values.createSchedule ? {
      title: `${customerName} 퀵 상담 후속 일정`,
      type: "고객상담" as const,
      memo: values.summary || "퀵 상담에서 생성된 일정입니다.",
      reminderOffsetMinutes: 30 as const,
    } : undefined;

    try {
      await createMutation.mutateAsync({
        customerId,
        status: values.status,
        nextAction: values.nextAction,
        summary: values.summary,
        nextContactAt,
        calendarSchedule,
      });

      toast.success("퀵 상담 기록이 저장되었습니다.");
      
      // Invalidate relevant queries
      trpcContext.customers.get.invalidate({ id: customerId });
      trpcContext.consultations.list.invalidate({ customerId });
      trpcContext.dashboard.todayWork.invalidate();
      
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "상담 기록 저장에 실패했습니다.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] p-4 sm:p-6 mx-auto rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-lg font-bold">⚡ 퀵 상담 기록 ({customerName})</DialogTitle>
          <DialogDescription className="text-sm">
            30초 안에 핵심 기록과 다음 액션을 빠르게 남기세요.
          </DialogDescription>
        </DialogHeader>

        <Form {...(form as any)}>
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-5">
            {/* 1. 상담 상태 */}
            <FormField
              control={form.control as any}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="font-semibold text-gray-700">상담상태 변경</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((status) => (
                        <div
                          key={status}
                          onClick={() => field.onChange(status)}
                          className={`px-3 py-1.5 text-sm rounded-full cursor-pointer transition-colors border select-none
                            ${field.value === status ? "bg-primary text-primary-foreground border-primary font-medium" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                        >
                          {status}
                        </div>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 2. 짧은 메모 */}
            <FormField
              control={form.control as any}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-gray-700">상담 메모 (선택)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="상담 핵심만 짧게 남겨주세요. 예: 다음 주 재통화, 가족 보장 확인 필요" 
                      className="resize-none h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 3. 다음 액션 */}
            <FormField
              control={form.control as any}
              name="nextAction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-gray-700">다음 액션</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="다음 액션을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NEXT_ACTION_OPTIONS.map((action) => (
                        <SelectItem key={action} value={action}>{action}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 4. 후속 관리 및 일정 */}
            <div className="space-y-4 pt-2 border-t">
              <FormField
                control={form.control as any}
                name="followUpPreset"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="font-semibold text-gray-700">후속관리 자동 등록</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: "none", label: "안함" },
                          { value: "today", label: "오늘" },
                          { value: "tomorrow", label: "내일" },
                          { value: "3days", label: "3일 후" },
                          { value: "1week", label: "1주 후" }
                        ].map((preset) => (
                          <div
                            key={preset.value}
                            onClick={() => field.onChange(preset.value)}
                            className={`px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors border select-none
                              ${field.value === preset.value ? "bg-blue-50 text-blue-700 border-blue-200 font-medium" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                          >
                            {preset.label}
                          </div>
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("followUpPreset") !== "none" && (
                <FormField
                  control={form.control as any}
                  name="createSchedule"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-gray-50/50">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="cursor-pointer font-medium text-gray-700">
                          선택한 날짜에 캘린더 일정 동시 등록
                        </FormLabel>
                        <p className="text-xs text-gray-500">
                          체크 시 후속관리와 함께 일정도 자동 생성됩니다.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="pt-4 flex gap-2 w-full">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" className="flex-1 font-bold" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                30초 기록 저장
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
