import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, SCHEDULE_TYPES, SCHEDULE_STATUSES } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ViewMode = "month" | "week" | "day";

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

  const utils = trpc.useUtils();
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const createMutation = trpc.schedules.create.useMutation({
    onSuccess: () => { toast.success("일정이 등록되었습니다."); setShowModal(false); utils.schedules.list.invalidate(); },
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

  // Month view days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Week view days
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">일정 캘린더</h1>
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
        </div>

        <Card>
          <CardContent className="p-3">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-base font-semibold">{headerTitle}</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            {/* Month View */}
            {viewMode === "month" && (
              <div>
                <div className="grid grid-cols-7 mb-1">
                  {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {calDays.map((day) => {
                    const daySchedules = getSchedulesForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`bg-background min-h-[80px] p-1 cursor-pointer hover:bg-muted/50 transition-colors ${!isCurrentMonth ? "opacity-40" : ""}`}
                        onClick={() => { setSelectedDate(day); setShowModal(true); }}
                      >
                        <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {daySchedules.slice(0, 3).map((s) => (
                            <div
                              key={s.id}
                              className={`text-[10px] text-white rounded px-1 py-0.5 truncate ${typeColors[s.type] ?? "bg-slate-400"}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedSchedule(s); }}
                            >
                              {s.title}
                            </div>
                          ))}
                          {daySchedules.length > 3 && (
                            <div className="text-[10px] text-muted-foreground pl-1">+{daySchedules.length - 3}개</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Week View */}
            {viewMode === "week" && (
              <div>
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
                            <div
                              key={s.id}
                              className={`text-[11px] text-white rounded px-1.5 py-1 ${typeColors[s.type] ?? "bg-slate-400"}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedSchedule(s); }}
                            >
                              <div className="font-medium truncate">{s.title}</div>
                              <div className="opacity-80">{format(new Date(s.startTime), "HH:mm")}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day View */}
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
                    <div
                      key={s.id}
                      className={`flex items-start gap-3 p-3 rounded-lg text-white cursor-pointer ${typeColors[s.type] ?? "bg-slate-400"}`}
                      onClick={() => setSelectedSchedule(s)}
                    >
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

      {/* 일정 추가 모달 */}
      <ScheduleModal
        open={showModal}
        onClose={() => setShowModal(false)}
        defaultDate={selectedDate}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        users={users}
      />

      {/* 일정 상세/수정 모달 */}
      {selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
          onDelete={() => deleteMutation.mutate({ id: selectedSchedule.id })}
          onUpdate={(data) => updateMutation.mutate({ id: selectedSchedule.id, ...data })}
          loading={deleteMutation.isPending || updateMutation.isPending}
        />
      )}
    </DashboardLayout>
  );
}

function ScheduleModal({ open, onClose, defaultDate, onSubmit, loading, users }: {
  open: boolean; onClose: () => void; defaultDate: Date | null;
  onSubmit: (data: any) => void; loading: boolean; users: any[] | undefined;
}) {
  const defaultStart = defaultDate ? format(defaultDate, "yyyy-MM-dd'T'09:00") : format(new Date(), "yyyy-MM-dd'T'09:00");
  const [form, setForm] = useState({
    title: "", type: "기타" as string, status: "예정" as string,
    startTime: defaultStart, endTime: "", memo: "", targetUserId: "",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>일정 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">제목 *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">유형</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SCHEDULE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">시작 시간</Label>
              <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">종료 시간</Label>
              <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-9 mt-1" />
            </div>
          </div>
          {users && users.length > 0 && (
            <div>
              <Label className="text-xs">대상 (팀원 지정 시)</Label>
              <Select value={form.targetUserId} onValueChange={(v) => setForm({ ...form, targetUserId: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="본인 일정" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">본인 일정</SelectItem>
                  {users.filter((u) => u.role !== "inactive").map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">메모</Label>
            <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading || !form.title} onClick={() => onSubmit({
              title: form.title, type: form.type, status: form.status,
              startTime: form.startTime, endTime: form.endTime || undefined,
              memo: form.memo || undefined,
              targetUserId: form.targetUserId ? Number(form.targetUserId) : undefined,
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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: schedule.status,
    memo: schedule.memo ?? "",
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{schedule.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${typeColors[schedule.type] ?? "bg-slate-400"}`} />
            <span>{schedule.type}</span>
            <StatusBadge status={schedule.status} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">시작</p>
            <p>{new Date(schedule.startTime).toLocaleString("ko-KR")}</p>
          </div>
          {schedule.endTime && (
            <div>
              <p className="text-xs text-muted-foreground">종료</p>
              <p>{new Date(schedule.endTime).toLocaleString("ko-KR")}</p>
            </div>
          )}
          {editing ? (
            <>
              <div>
                <Label className="text-xs">상태 변경</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SCHEDULE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">메모</Label>
                <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" />
              </div>
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
