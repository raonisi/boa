import { Bell, CalendarDays, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CustomerDetailSchedulePanelProps = {
  todayScheduleCount: number;
  totalScheduleCount: number;
  nextScheduleAt?: string | Date | null;
  onOpenCalendar: () => void;
  onCreateSchedule: () => void;
  onOpenNotifications: () => void;
};

export function CustomerDetailSchedulePanel({
  todayScheduleCount,
  totalScheduleCount,
  nextScheduleAt,
  onOpenCalendar,
  onCreateSchedule,
  onOpenNotifications,
}: CustomerDetailSchedulePanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-blue-50 p-2 text-blue-700">
              <CalendarDays aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-950">고객 연결 일정</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                이 고객과 연결된 일정을 확인하고 다음 접점을 준비합니다.
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <dt className="text-xs text-muted-foreground">오늘 일정</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                {todayScheduleCount}건
              </dd>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <dt className="text-xs text-muted-foreground">연결 일정</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                {totalScheduleCount}건
              </dd>
            </div>
          </dl>
          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">
              다음 일정
            </p>
            <p className="mt-1 font-medium text-slate-950">
              {nextScheduleAt
                ? new Date(nextScheduleAt).toLocaleString("ko-KR")
                : "예정된 일정이 없습니다."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button className="min-h-11" onClick={onCreateSchedule}>
              <CalendarPlus aria-hidden="true" className="h-4 w-4" />
              일정 등록
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={onOpenCalendar}
            >
              전체 일정 보기
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-amber-50 p-2 text-amber-700">
              <Bell aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-950">업무 알림</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                고객 관련 후속 작업과 일정 알림은 알림함에서 확인합니다.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={onOpenNotifications}
          >
            <Bell aria-hidden="true" className="h-4 w-4" />
            알림 확인
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
