import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, SCHEDULE_TYPES, SCHEDULE_STATUSES } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths, isWithinInterval,
} from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ViewMode = "month" | "week" | "day";
type MobileRange = "today" | "week" | "month" | "all";

const typeColors: Record<string, string> = {
  "고객상담": "bg-blue-500",
  "재통화": "bg-cyan-500",
  "계약예정": "bg-green-500",
  "보장분석": "bg-indigo-500",
  "해지방어": "bg-rose-500",
  "팀회의": "bg-purple-500",
  "교육": "bg-yellow-500",
  "외근": "bg-orange-500",
  "휴무": "bg-gray-400",
  "기타": "bg-slate-400",
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [mobileRange, setMobileRange] = useState<MobileRange>("today");
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const createMutation = trpc.schedules.create.useMutation({
    onSuccess: () => { toast.success("일정이 저장되었습니다. 알림은 설정한 시간에 표시됩니다."); setShowModal(false); utils.schedules.list.invalidate(); },
  });
  const deleteMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => { toast.success("일정이 삭제되었습니다."); setSelectedSchedule(null); utils.schedules.list.invalidate(); },
  });
  const updateMutation = trpc.schedules.update.useMutation({
    onSuccess: () => { toast.success("일정이 수정되었습니다."); setSelectedSchedule(null); utils.schedules.list.invalidate(); },
  });

  const getSchedulesForDay = (day: Date) =>
    (schedules ?? []).filter((s) => isSameDay(new Date(s.startTime), day));

  const navigate = (dir: 1 | -1) => {
    if (viewMode === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const headerTitle = viewMode === "month"
    ? format(currentDate, "yyyy년 M월", { locale: ko })
    : viewMode === "week"
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "M월 d일")} ~ ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "M월 d일")}`
    : format(currentDate, "yyyy년 M월 d일 (EEE)", { locale: ko });

  const monthStart = startOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // 모바일: 오늘 일정 + 이번 주 일정 + 미완료 일정
  const today = new Date();
  const todaySchedules = getSchedulesForDay(today);
  const incompleteSchedules = (schedules ?? []).filter((s) => {
    if (s.status !== "예정" && s.status !== "보류") return false;
    if (!s.endTime) return false;
    return new Date(s.endTime) < today;
  });
  const thisWeekSchedules = (schedules ?? []).filter((s) => {
    const d = new Date(s.startTime);
    const wStart = startOfWeek(today, { weekStartsOn: 1 });
    const wEnd = endOfWeek(today, { weekStartsOn: 1 });
    return d >= wStart && d <= wEnd;
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const mobileList = (schedules ?? []).filter((s) => {
    const d = new Date(s.startTime);
    if (mobileRange === "all") return true;
    if (mobileRange === "today") return isSameDay(d, today);
    if (mobileRange === "week") return d >= startOfWeek(today, { weekStartsOn: 1 }) && d <= endOfWeek(today, { weekStartsOn: 1 });
    return isWithinInterval(d, { start: startOfMonth(today), end: endOfMonth(today) });
  }).sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());

  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Schedule</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950">일정관리</h1>
              </div>
            <Button size="sm" onClick={() => { setSelectedDate(new Date()); setShowModal(true); }}>
              <Plus className="h-4 w-4 mr-1" /> 일정 추가
            </Button>
            </CardContent>
          </Card>

          {/* 오늘 일정 */}
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-[#b99b5f]" /> 오늘 일정 ({todaySchedules.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todaySchedules.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">오늘 일정이 없습니다.</p>
              ) : (
                todaySchedules.map((s) => (
                  <div
                    key={s.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-2xl p-3 text-white shadow-sm ${typeColors[s.type] ?? "bg-slate-400"}`}
                    onClick={() => setSelectedSchedule(s)}
                  >
                    <div className="text-xs font-bold w-10 shrink-0">{format(new Date(s.startTime), "HH:mm")}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.title}</p>
                      <p className="text-xs opacity-80">{s.type} · {s.status}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* 미완료 일정 */}
          {incompleteSchedules.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-700">⚠️ 미완료 일정 ({incompleteSchedules.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {incompleteSchedules.map((s) => (
                  <div key={s.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-orange-200 bg-white p-3 hover:bg-orange-50" onClick={() => setSelectedSchedule(s)}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${typeColors[s.type] ?? "bg-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-orange-600">종료: {s.endTime ? format(new Date(s.endTime), "M/d HH:mm", { locale: ko }) : "-"}</p>
                    </div>
                    <span className="text-xs text-orange-600 font-medium">{s.status}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 이번 주 일정 */}
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-3 flex gap-2 flex-wrap">
              {["today","week","month","all"].map((r) => <Button key={r} variant={mobileRange===r?"default":"outline"} size="sm" onClick={()=>setMobileRange(r as MobileRange)}>{r==="today"?"오늘":r==="week"?"이번주":r==="month"?"이번달":"전체"}</Button>)}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-[#b99b5f]" /> 조회 일정 ({mobileList.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mobileList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">이번 주 일정이 없습니다.</p>
              ) : (
                mobileList.map((s) => (
                  <div
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50"
                    onClick={() => setSelectedSchedule(s)}
                  >
                    <div className={`h-2 w-2 rounded-full shrink-0 ${typeColors[s.type] ?? "bg-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.startTime), "M/d (EEE) HH:mm", { locale: ko })}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* 모달들 */}
        <ScheduleModal open={showModal} onClose={() => setShowModal(false)} defaultDate={selectedDate} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} users={users} />
        {selectedSchedule && (
          <ScheduleDetailModal schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} onDelete={() => deleteMutation.mutate({ id: selectedSchedule.id })} onUpdate={(data) => updateMutation.mutate({ id: selectedSchedule.id, ...data })} loading={deleteMutation.isPending || updateMutation.isPending} />
        )}
      </DashboardLayout>
    );
  }

  // PC 뷰
  return (
    <DashboardLayout>
        <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Schedule</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">일정관리</h1>
              <p className="mt-1 text-sm text-slate-500">오늘 일정과 미완료 일정을 시간순으로 확인합니다.</p>
            </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {v === "month" ? "월" : v === "week" ? "주" : "일"}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => { setSelectedDate(new Date()); setShowModal(true); }}>
              <Plus className="h-4 w-4 mr-1" /> 일정 추가
            </Button>
          </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-base font-semibold">{headerTitle}</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            {viewMode === "month" && (
              <div>
                <div className="grid grid-cols-7 mb-1">
                  {["일","월","화","수","목","금","토"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {calDays.map((day) => {
                    const daySchedules = getSchedulesForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    return (
                      <div key={day.toISOString()} className={`bg-background min-h-[80px] p-1 cursor-pointer hover:bg-muted/50 ${!isCurrentMonth ? "opacity-40" : ""}`} onClick={() => { setSelectedDate(day); setShowModal(true); }}>
                        <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {daySchedules.slice(0, 3).map((s) => (
                            <div key={s.id} className={`text-[10px] text-white rounded px-1 py-0.5 truncate ${typeColors[s.type] ?? "bg-slate-400"}`} onClick={(e) => { e.stopPropagation(); setSelectedSchedule(s); }}>
                              {s.title}
                            </div>
                          ))}
                          {daySchedules.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{daySchedules.length - 3}개</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === "week" && (
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {weekDays.map((day) => {
                  const daySchedules = getSchedulesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={day.toISOString()} className="bg-background">
                      <div className={`text-center py-2 text-xs font-medium ${isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                        <div>{format(day, "EEE", { locale: ko })}</div>
                        <div className={`text-base font-bold ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</div>
                      </div>
                      <div className="p-1 min-h-[200px] space-y-1 cursor-pointer" onClick={() => { setSelectedDate(day); setShowModal(true); }}>
                        {daySchedules.map((s) => (
                          <div key={s.id} className={`text-[11px] text-white rounded px-1.5 py-1 ${typeColors[s.type] ?? "bg-slate-400"}`} onClick={(e) => { e.stopPropagation(); setSelectedSchedule(s); }}>
                            <div className="font-medium truncate">{s.title}</div>
                            <div className="opacity-80">{format(new Date(s.startTime), "HH:mm")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode === "day" && (
              <div className="space-y-2">
                {getSchedulesForDay(currentDate).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    이 날 일정이 없습니다.
                    <br />
                    <button className="text-primary hover:underline mt-2 text-xs" onClick={() => { setSelectedDate(currentDate); setShowModal(true); }}>일정 추가하기</button>
                  </div>
                ) : (
                  getSchedulesForDay(currentDate).map((s) => (
                    <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg text-white cursor-pointer ${typeColors[s.type] ?? "bg-slate-400"}`} onClick={() => setSelectedSchedule(s)}>
                      <div className="text-sm font-bold">{format(new Date(s.startTime), "HH:mm")}</div>
                      <div className="flex-1">
                        <p className="font-semibold">{s.title}</p>
                        <p className="text-xs opacity-80">{s.type} · {s.status}</p>
                        {s.memo && <p className="text-xs opacity-70 mt-1">{s.memo}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ScheduleModal open={showModal} onClose={() => setShowModal(false)} defaultDate={selectedDate} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} users={users} />
      {selectedSchedule && (
        <ScheduleDetailModal schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} onDelete={() => deleteMutation.mutate({ id: selectedSchedule.id })} onUpdate={(data) => updateMutation.mutate({ id: selectedSchedule.id, ...data })} loading={deleteMutation.isPending || updateMutation.isPending} />
      )}
    </DashboardLayout>
  );
}

function ScheduleModal({ open, onClose, defaultDate, onSubmit, loading, users }: {
  open: boolean; onClose: () => void; defaultDate: Date | null;
  onSubmit: (data: any) => void; loading: boolean; users: any[] | undefined;
}) {
  const { data: scheduleTypeOptions } = trpc.settings.formOptions.useQuery({ category: "scheduleType" });
  const scheduleTypes = scheduleTypeOptions?.length ? scheduleTypeOptions.map((item) => item.value) : SCHEDULE_TYPES;
  const defaultStart = defaultDate ? format(defaultDate, "yyyy-MM-dd'T'09:00") : format(new Date(), "yyyy-MM-dd'T'09:00");
  const [form, setForm] = useState({
    title: "", type: "기타" as string, status: "예정" as string,
    startTime: defaultStart, endTime: "", memo: "", targetUserId: "self", reminderOffsetMinutes: "30",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>일정 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">제목 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">유형</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{scheduleTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SCHEDULE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">알림 시간</Label>
            <Select value={form.reminderOffsetMinutes} onValueChange={(v) => setForm({ ...form, reminderOffsetMinutes: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">알림 없음</SelectItem><SelectItem value="0">일정 시각</SelectItem><SelectItem value="30">30분 전</SelectItem><SelectItem value="60">1시간 전</SelectItem><SelectItem value="120">2시간 전</SelectItem><SelectItem value="180">3시간 전</SelectItem><SelectItem value="1440">1일 전</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">시작 시간</Label><Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">종료 시간</Label><Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-9 mt-1" /></div>
          </div>
          {users && users.length > 0 && (
            <div>
              <Label className="text-xs">대상 (팀원 지정 시)</Label>
              <Select value={form.targetUserId} onValueChange={(v) => setForm({ ...form, targetUserId: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="본인 일정" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">본인 일정</SelectItem>
                  {users.filter((u) => u.role !== "inactive").map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label className="text-xs">메모</Label><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading || !form.title} onClick={() => onSubmit({
              title: form.title, type: form.type, status: form.status,
              startTime: form.startTime, endTime: form.endTime || undefined,
              memo: form.memo || undefined,
              reminderOffsetMinutes: Number(form.reminderOffsetMinutes),
              targetUserId: form.targetUserId && form.targetUserId !== "self" ? Number(form.targetUserId) : undefined,
            })}>
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDetailModal({ schedule, onClose, onDelete, onUpdate, loading }: {
  schedule: any; onClose: () => void; onDelete: () => void; onUpdate: (data: any) => void; loading: boolean;
}) {
  const { data: scheduleTypeOptions } = trpc.settings.formOptions.useQuery({ category: "scheduleType" });
  const scheduleTypes = scheduleTypeOptions?.length ? scheduleTypeOptions.map((item) => item.value) : SCHEDULE_TYPES;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ type: schedule.type, status: schedule.status, memo: schedule.memo ?? "" });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>{schedule.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${typeColors[schedule.type] ?? "bg-slate-400"}`} />
            <span>{schedule.type}</span>
            <StatusBadge status={schedule.status} />
          </div>
          <div><p className="text-xs text-muted-foreground">시작</p><p>{new Date(schedule.startTime).toLocaleString("ko-KR")}</p></div>
          {schedule.endTime && <div><p className="text-xs text-muted-foreground">종료</p><p>{new Date(schedule.endTime).toLocaleString("ko-KR")}</p></div>}
          {editing ? (
            <>
              <div>
                <Label className="text-xs">유형</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{scheduleTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">상태 변경</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SCHEDULE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">메모</Label><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>취소</Button>
                <Button size="sm" disabled={loading} onClick={() => onUpdate(form)}>저장</Button>
              </div>
            </>
          ) : (
            <>
              {schedule.memo && <p className="text-xs text-muted-foreground">{schedule.memo}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete} disabled={loading}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> 삭제
                </Button>
                <Button size="sm" onClick={() => setEditing(true)}>수정</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
