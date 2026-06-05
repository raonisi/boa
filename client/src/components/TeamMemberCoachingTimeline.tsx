import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CoachingNoteDialog } from "./CoachingNoteDialog";
import { Loader2, Calendar, Target, CheckCircle2, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

export function TeamMemberCoachingTimeline({ targetUserId }: { targetUserId: number }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: notes, isLoading } = trpc.teamCoaching.list.useQuery({
    targetUserId,
  });

  const resolveMutation = trpc.teamCoaching.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("코칭 상태가 업데이트되었습니다.");
      utils.teamCoaching.list.invalidate();
      utils.teamCoaching.summary.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "상태 변경 중 오류가 발생했습니다.");
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      praise: "칭찬",
      improvement: "개선 필요",
      follow_up_delay: "후속관리 지연",
      notification_unread: "알림 미처리",
      customer_care_gap: "고객관리 공백",
      goal_gap: "목표 미달",
      training: "교육 필요",
      one_on_one: "1:1 면담",
      general: "일반"
    };
    return map[cat] || cat;
  };

  const getVisibilityLabel = (vis: string) => {
    if (vis === "private_admin") return "나만 보기";
    if (vis === "member_visible") return "팀원 공유됨";
    return "관리자 공유";
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">코칭 타임라인</h3>
        <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> 코칭 추가
        </Button>
      </div>

      {(!notes || notes.length === 0) ? (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mb-4 text-slate-300" />
            <p>아직 기록된 코칭 메모가 없습니다.</p>
            <p className="text-sm mt-1">팀원의 행동 습관과 성장 포인트를 기록해보세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note: any) => (
            <Card key={note.id} className={note.status === "resolved" ? "bg-slate-50 opacity-80" : ""}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{getCategoryLabel(note.category)}</Badge>
                      <Badge variant={getPriorityColor(note.priority)}>{note.priority.toUpperCase()}</Badge>
                      {note.status === "resolved" && (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">해결됨</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{note.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span>작성자: {note.authorName}</span>
                      <span>•</span>
                      <span>{format(new Date(note.createdAt), "yyyy.MM.dd HH:mm")}</span>
                      <span>•</span>
                      <span className="text-xs text-slate-400">{getVisibilityLabel(note.visibility)}</span>
                    </CardDescription>
                  </div>
                  {note.status === "open" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => resolveMutation.mutate({ id: note.id, status: "resolved" })}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" /> 해결 처리
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-100/50 p-4 rounded-md text-sm whitespace-pre-wrap text-slate-700">
                  {note.note}
                </div>
                
                {(note.actionItems || note.nextReviewAt) && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center text-sm bg-blue-50/50 p-3 rounded-md border border-blue-100">
                    {note.actionItems && (
                      <div className="flex-1">
                        <span className="font-semibold text-blue-900 flex items-center gap-1">
                          <Target className="h-4 w-4" /> 다음 행동:
                        </span>
                        <span className="text-blue-800 ml-5">{note.actionItems}</span>
                      </div>
                    )}
                    {note.nextReviewAt && (
                      <div className="flex items-center gap-1 font-medium text-orange-700 whitespace-nowrap">
                        <Calendar className="h-4 w-4" /> 확인일: {format(new Date(note.nextReviewAt), "yyyy-MM-dd")}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <CoachingNoteDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen} 
          defaultTargetUserId={targetUserId}
        />
      )}
    </div>
  );
}
