import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, CalendarX, UserMinus, ShieldAlert } from "lucide-react";

interface InsightCardsProps {
  summary: {
    totalUnconsultedDb: number;
    totalOverdueFollowUps: number;
    totalTodayFollowUps: number;
    totalIncompleteSchedules: number;
    totalPriorityAUnmanaged: number;
  };
}

export default function InsightCards({ summary }: InsightCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">미상담 DB</CardTitle>
          <UserMinus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalUnconsultedDb}건</div>
          <p className="text-xs text-muted-foreground">배정 후 미진행 고객</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-destructive">지연된 후속관리</CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{summary.totalOverdueFollowUps}건</div>
          <p className="text-xs text-muted-foreground">조치가 시급합니다</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">오늘 후속관리</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalTodayFollowUps}건</div>
          <p className="text-xs text-muted-foreground">오늘 예정된 연락</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">미완료 일정</CardTitle>
          <CalendarX className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalIncompleteSchedules}건</div>
          <p className="text-xs text-muted-foreground">오늘 남은 방문/일정</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">A등급 장기 미관리</CardTitle>
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalPriorityAUnmanaged}명</div>
          <p className="text-xs text-muted-foreground">14일 이상 기록 없음</p>
        </CardContent>
      </Card>
    </div>
  );
}
