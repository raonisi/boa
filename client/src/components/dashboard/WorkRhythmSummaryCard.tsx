import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

function formatWon(value: number | undefined) {
  return `${(value ?? 0).toLocaleString()}원`;
}

export function WorkRhythmSummaryCard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.workRhythm.summary.useQuery({ period: "week" });

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <BarChart3 className="h-4 w-4" />
          </span>
          업무 리듬 리포트
        </CardTitle>
        <button type="button" onClick={() => setLocation("/performance/goals")} className="text-xs font-semibold text-primary hover:underline">
          목표관리
        </button>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">이번 주 상담기록</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.consultationCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">후속관리 완료율</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{data?.followUpCompletionRate ?? "-"}%</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">미처리 후속관리</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.overdueFollowUpCount ?? 0}</p>
          </div>
          <div className="boa-soft-card p-3">
            <p className="text-xs text-muted-foreground">오늘 필요 상담</p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{isLoading ? "-" : data?.recommendedTodayActions?.suggestedConsultationCount ?? 0}</p>
          </div>
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">목표까지 부족 신규 계약</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{data?.remaining?.contractCount ?? 0}건</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">목표까지 부족 월납보험료</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{formatWon(data?.remaining?.monthlyPremium)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-muted-foreground">일평균 필요 신규 계약</p>
            <p className="mt-1 font-bold tabular-nums tracking-tight text-foreground">{data?.dailyRequired?.contractCount ?? 0}건</p>
          </div>
        </div>
        {(data?.insights ?? []).length > 0 ? (
          <div className="space-y-1 rounded-lg border border-border/80 bg-muted/35 p-3 text-xs text-foreground">
            {data?.insights.slice(0, 3).map((item) => <p key={item}>· {item}</p>)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
