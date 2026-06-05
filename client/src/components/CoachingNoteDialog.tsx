import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const coachingFormSchema = z.object({
  targetUserId: z.coerce.number().min(1, "대상 팀원을 선택해주세요."),
  category: z.enum(["praise", "improvement", "follow_up_delay", "notification_unread", "customer_care_gap", "goal_gap", "training", "one_on_one", "general"]),
  title: z.string().min(1, "제목을 입력해주세요.").max(200),
  note: z.string().min(1, "코칭 메모를 입력해주세요."),
  actionItems: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  visibility: z.enum(["private_admin", "manager_visible", "member_visible"]),
  nextReviewAt: z.string().optional(),
});

type CoachingFormValues = z.infer<typeof coachingFormSchema>;

export function CoachingNoteDialog({ 
  open, 
  onOpenChange, 
  defaultTargetUserId = undefined 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  defaultTargetUserId?: number;
}) {
  const utils = trpc.useUtils();
  const { data: users } = trpc.users.list.useQuery();

  const form = useForm<CoachingFormValues>({
    resolver: zodResolver(coachingFormSchema) as any,
    defaultValues: {
      targetUserId: defaultTargetUserId ?? 0,
      category: "general",
      title: "",
      note: "",
      actionItems: "",
      priority: "medium",
      visibility: "manager_visible",
      nextReviewAt: "",
    },
  });

  const createMutation = trpc.teamCoaching.create.useMutation({
    onSuccess: () => {
      toast.success("코칭 메모가 저장되었습니다.");
      utils.teamCoaching.list.invalidate();
      utils.teamCoaching.summary.invalidate();
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "저장 중 오류가 발생했습니다.");
    },
  });

  function onSubmit(data: CoachingFormValues) {
    // Basic validation to warn users
    const sensitivePattern = /(\d{6}[-]?\d{7})|(010[-]?\d{4}[-]?\d{4})|(암|당뇨|뇌졸중)/;
    if (sensitivePattern.test(data.note)) {
      if (!confirm("코칭 메모에 고객 전화번호, 주민번호, 또는 특정 질병명으로 의심되는 패턴이 포함되어 있습니다. 민감 정보를 저장하면 보안 리스크가 발생할 수 있습니다. 정말 저장하시겠습니까?")) {
        return;
      }
    }
    
    createMutation.mutate({
      ...data,
      nextReviewAt: data.nextReviewAt || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>팀원 코칭 메모 작성</DialogTitle>
          <DialogDescription>
            팀원의 성장 관리를 위한 코칭 메모를 남깁니다. 고객의 민감한 개인정보(주민번호, 병력 등)는 입력하지 마세요.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="targetUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>대상 팀원</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger disabled={!!defaultTargetUserId}>
                          <SelectValue placeholder="팀원 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.filter(u => u.accountStatus === 'active').map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>코칭 유형</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="유형 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="praise">잘한 점 칭찬</SelectItem>
                        <SelectItem value="improvement">개선 필요</SelectItem>
                        <SelectItem value="follow_up_delay">후속관리 지연</SelectItem>
                        <SelectItem value="notification_unread">알림 미처리</SelectItem>
                        <SelectItem value="customer_care_gap">고객관리 공백</SelectItem>
                        <SelectItem value="goal_gap">목표 대비 부족</SelectItem>
                        <SelectItem value="training">교육 필요</SelectItem>
                        <SelectItem value="one_on_one">1:1 면담</SelectItem>
                        <SelectItem value="general">일반 메모</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제목</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 고객 상담기록 품질 개선 요청" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>코칭 메모</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="구체적인 상황이나 관찰 내용을 적어주세요. (개인정보 기입 주의)" 
                      className="resize-none h-24"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="actionItems"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>개선/다음 행동 (Action Item)</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 오늘 중으로 지연된 후속관리 완료하기" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>우선순위</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">낮음</SelectItem>
                        <SelectItem value="medium">보통</SelectItem>
                        <SelectItem value="high">높음(집중)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>공개 범위</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="private_admin">나만 보기</SelectItem>
                        <SelectItem value="manager_visible">관리자 공유</SelectItem>
                        <SelectItem value="member_visible">팀원에게도 공유</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nextReviewAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>다음 확인일</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                저장하기
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
