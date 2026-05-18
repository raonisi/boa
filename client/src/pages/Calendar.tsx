import DashboardLayout from "@/components/DashboardLayout";
import { getStatusLabel, StatusBadge, SCHEDULE_TYPES, SCHEDULE_STATUSES } from "@/components/StatusBadge";
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
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Trash2, BellRing, CheckCircle2, AlertTriangle, ExternalLink, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  formatKstLocalDateTime,
  formatKstLocalDateTimeForInput,
  isSameKstDate,
  parseKstLocalDateTime,
} from "@shared/timePolicy";

type ViewMode = "month" | "week" | "day";
type MobileRange = "today" | "week" | "month" | "all" | "custom";
type CustomerOption = { id: number; name: string };

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

const reminderOffsetLabels: Record<string, string> = {
  "-1": "알림 없음",
  "0": "일정 시각",
  "30": "30분 전",
  "60": "1시간 전",
  "120": "2시간 전",
  "180": "3시간 전",
  "1440": "1일 전",
};

function formatDateTimeLocal(value?: string | Date | null) {
  return value ? formatKstLocalDateTimeForInput(value) : "";
}

function formatScheduleTime(value: string | Date) {
  return formatKstLocalDateTime(value, { seconds: false }).slice(11, 16);
}

function scheduleDate(value: string | Date) {
  return parseKstLocalDateTime(formatKstLocalDateTime(value, { seconds: false }));
}

function scheduleReminderOffset(schedule: any) {
  return String(schedule?.reminderOffsetMinutes ?? 30);
}

function scheduleReminderText(schedule: any) {
  return reminderOffsetLabels[scheduleReminderOffset(schedule)] ?? "30분 전";
}

function scheduleDefaultReminderOffset(schedule: any) {
  return scheduleReminderOffset(schedule);
}

function ScheduleEmptyState({ title, description, onCreate }: { title: string; description: string; onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <div className="mt-3 flex justify-center gap-2">
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1" /> 일정 추가
        </Button>
      </div>
    </div>
  );
}

function ScheduleWorkItem({
  schedule,
  customerName,
  onClick,
  onCustomerClick,
}: {
  schedule: any;
  customerName?: string;
  onClick: () => void;
  onCustomerClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50"
      onClick={onClick}
    >
      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${typeColors[schedule.type] ?? "bg-slate-400"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">{schedule.title}</p>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">{formatScheduleTime(schedule.startTime)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{schedule.type}</span>
          <StatusBadge status={schedule.status} />
          {customerName ? (
            <span
              role={onCustomerClick ? "button" : undefined}
              tabIndex={onCustomerClick ? 0 : undefined}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"
              onClick={(e) => {
                if (!onCustomerClick) return;
                e.stopPropagation();
                onCustomerClick();
              }}
              onKeyDown={(e) => {
                if (!onCustomerClick || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                e.stopPropagation();
                onCustomerClick();
              }}
            >
              <UserRound className="h-3 w-3" /> {customerName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
              <UserRound className="h-3 w-3" /> 연결 고객 없음
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            <BellRing className="h-3 w-3" /> {scheduleReminderText(schedule)}
          </span>
        </div>
        {schedule.memo && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{schedule.memo}</p>}
      </div>
    </button>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [mobileRange, setMobileRange] = useState<MobileRange>("today");
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [location, setLocation] = useLocation();
  const [initialCustomerApplied, setInitialCustomerApplied] = useState(false);
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();
  const { data: schedules } = trpc.schedules.list.useQuery();
  const { data: users } = trpc.users.list.useQuery({ activeOnly: true });
  const { data: customers } = trpc.customers.list.useQuery({});
  const customerOptions = (customers ?? []) as CustomerOption[];
  const customerMap = new Map(customerOptions.map((customer) => [customer.id, customer]));
  const browserSearch = typeof window !== "undefined" ? window.location.search : "";
  const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : browserSearch.replace(/^\?/, "");
  const queryParams = new URLSearchParams(query);
  const queryAction = queryParams.get("action");
  const queryCustomerId = Number(queryParams.get("customerId"));
  const defaultCustomerId = Number.isFinite(queryCustomerId) && queryCustomerId > 0 ? queryCustomerId : undefined;
  const getScheduleCustomer = (schedule: any) => schedule?.customerId ? customerMap.get(Number(schedule.customerId)) : undefined;
  const openCustomerDetail = (customerId?: number | null) => {
    if (customerId) setLocation(`/customers/${customerId}`);
  };

  useEffect(() => {
    if (initialCustomerApplied || queryAction !== "create" || !defaultCustomerId) return;
    setSelectedDate(new Date());
    setShowModal(true);
    setInitialCustomerApplied(true);
  }, [defaultCustomerId, initialCustomerApplied, queryAction]);

  const createMutation = trpc.schedules.create.useMutation({
    onSuccess: () => { toast.success("일정이 저장되었습니다. 알림은 설정한 시간에 표시됩니다."); setShowModal(false); utils.schedules.list.invalidate(); utils.notifications.list.invalidate(); },
  });
  const deleteMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => { toast.success("일정이 삭제되었습니다."); setSelectedSchedule(null); utils.schedules.list.invalidate(); utils.notifications.list.invalidate(); },
  });
  const updateMutation = trpc.schedules.update.useMutation({
    onSuccess: () => { toast.success("일정이 수정되었습니다."); setSelectedSchedule(null); utils.schedules.list.invalidate(); utils.notifications.list.invalidate(); },
    onError: (error) => toast.error(error.message || "일정 수정에 실패했습니다."),
  });

  const getSchedulesForDay = (day: Date) =>
    (schedules ?? []).filter((s) => isSameKstDate(s.startTime, day));

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
    return scheduleDate(s.endTime) < today;
  });
  const thisWeekSchedules = (schedules ?? []).filter((s) => {
    const d = scheduleDate(s.startTime);
    const wStart = startOfWeek(today, { weekStartsOn: 1 });
    const wEnd = endOfWeek(today, { weekStartsOn: 1 });
    return d >= wStart && d <= wEnd;
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const mobileList = (schedules ?? []).filter((s) => {
    const d = scheduleDate(s.startTime);
    if (mobileRange === "all") return true;
    if (mobileRange === "today") return isSameDay(d, today);
    if (mobileRange === "week") return d >= startOfWeek(today, { weekStartsOn: 1 }) && d <= endOfWeek(today, { weekStartsOn: 1 });
    if (mobileRange === "custom") {
      const start = new Date(`${customStartDate}T00:00:00`);
      const end = new Date(`${customEndDate}T23:59:59`);
      return d >= start && d <= end;
    }
    return isWithinInterval(d, { start: startOfMonth(today), end: endOfMonth(today) });
  }).sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());
  const reminderSchedules = (schedules ?? []).filter((s) => {
    if (!["예정", "변경", "보류"].includes(s.status)) return false;
    if ((s.reminderOffsetMinutes ?? 30) < 0) return false;
    return scheduleDate(s.startTime) >= today;
  });
  const selectedDay = selectedDate ?? currentDate;
  const selectedDaySchedules = getSchedulesForDay(selectedDay).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const summaryCards = [
    { label: "오늘 일정", value: todaySchedules.length, helper: "오늘 처리할 상담·업무", icon: CalendarDays, tone: "text-slate-700" },
    { label: "이번주 일정", value: thisWeekSchedules.length, helper: "이번주 업무 흐름", icon: Clock3, tone: "text-emerald-700" },
    { label: "미완료 일정", value: incompleteSchedules.length, helper: "종료 시각 경과", icon: AlertTriangle, tone: "text-amber-700" },
    { label: "알림 예정", value: reminderSchedules.length, helper: "설정된 시각에 노출", icon: BellRing, tone: "text-blue-700" },
  ];

  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="space-y-4 pb-[max(5rem,env(safe-area-inset-bottom))]">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Schedule</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950">일정관리</h1>
                <p className="mt-1 text-xs text-slate-500">오늘과 이번주 업무 흐름을 먼저 확인합니다.</p>
              </div>
            <Button size="sm" className="min-h-11 shrink-0" onClick={() => { setSelectedDate(new Date()); setShowModal(true); }}>
              <Plus className="h-4 w-4 mr-1" /> 일정 추가
            </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {summaryCards.map((item) => (
              <Card key={item.label} className="border-slate-200/80 bg-white/95 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <item.icon className={`h-4 w-4 ${item.tone}`} />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{item.value}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{item.helper}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 오늘 일정 */}
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-[#b99b5f]" /> 오늘 일정 ({todaySchedules.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todaySchedules.length === 0 ? (
                <ScheduleEmptyState
                  title="오늘 일정이 없습니다."
                  description="상담 예약이나 후속관리 일정을 등록해보세요."
                  onCreate={() => { setSelectedDate(new Date()); setShowModal(true); }}
                />
              ) : (
                todaySchedules.map((s) => (
                  <div
                    key={s.id}
                    className={`flex min-h-14 cursor-pointer items-start gap-2 rounded-2xl p-3 text-white shadow-sm ${typeColors[s.type] ?? "bg-slate-400"}`}
                    onClick={() => setSelectedSchedule(s)}
                  >
                    <div className="text-xs font-bold w-10 shrink-0">{formatScheduleTime(s.startTime)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.title}</p>
                      <p className="text-xs font-medium opacity-90">{getScheduleCustomer(s)?.name ?? "연결 고객 없음"}</p>
                      <p className="text-xs opacity-80">{s.type} · {getStatusLabel(s.status)} · 알림 {scheduleReminderText(s)}</p>
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
                  <div key={s.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-orange-200 bg-white p-3 hover:bg-orange-50" onClick={() => setSelectedSchedule(s)}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${typeColors[s.type] ?? "bg-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-slate-500">{getScheduleCustomer(s)?.name ?? "연결 고객 없음"}</p>
                      <p className="text-xs text-orange-600">종료: {s.endTime ? format(scheduleDate(s.endTime), "M/d HH:mm", { locale: ko }) : "-"}</p>
                    </div>
                    <span className="text-xs text-orange-600 font-medium">{getStatusLabel(s.status)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 이번 주 일정 */}
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="grid grid-cols-2 gap-2 p-3 sm:flex sm:flex-wrap">
              {["today","week","month","all","custom"].map((r) => <Button key={r} className="min-h-10" variant={mobileRange===r?"default":"outline"} size="sm" onClick={()=>setMobileRange(r as MobileRange)}>{r==="today"?"오늘":r==="week"?"이번주":r==="month"?"이번달":r==="all"?"전체":"직접선택"}</Button>)}
              {mobileRange === "custom" && (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-9" />
                  <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-9" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-[#b99b5f]" /> 조회 일정 ({mobileList.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mobileList.length === 0 ? (
                <ScheduleEmptyState
                  title="조회 조건에 맞는 일정이 없습니다."
                  description="필터를 바꾸거나 상담·계약·후속관리 일정을 등록하세요."
                  onCreate={() => { setSelectedDate(new Date()); setShowModal(true); }}
                />
              ) : (
                mobileList.map((s) => (
                  <div
                    key={s.id}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50"
                    onClick={() => setSelectedSchedule(s)}
                  >
                    <div className={`h-2 w-2 rounded-full shrink-0 ${typeColors[s.type] ?? "bg-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-emerald-700">{getScheduleCustomer(s)?.name ?? "연결 고객 없음"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(scheduleDate(s.startTime), "M/d (EEE) HH:mm", { locale: ko })}
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
        <ScheduleModal open={showModal} onClose={() => setShowModal(false)} defaultDate={selectedDate} defaultCustomerId={defaultCustomerId} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} users={users} customers={customerOptions} />
        {selectedSchedule && (
          <ScheduleDetailModal schedule={selectedSchedule} customer={getScheduleCustomer(selectedSchedule)} customers={customerOptions} onViewCustomer={() => openCustomerDetail(selectedSchedule.customerId)} onClose={() => setSelectedSchedule(null)} onDelete={() => deleteMutation.mutate({ id: selectedSchedule.id })} onUpdate={(data) => updateMutation.mutate({ id: selectedSchedule.id, ...data })} loading={deleteMutation.isPending || updateMutation.isPending} />
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
              <p className="mt-1 text-sm text-slate-500">상담·계약·후속관리 일정을 업무 흐름으로 확인합니다.</p>
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
              <Plus className="h-4 w-4 mr-1" /> 상담·계약·후속관리 일정 등록
            </Button>
          </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          {summaryCards.map((item) => (
            <Card key={item.label} className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <item.icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-950">{item.value}</p>
                <p className="mt-1 text-xs text-slate-500">{item.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                    const isSelectedDay = isSameDay(day, selectedDay);
                    return (
                      <div key={day.toISOString()} className={`group bg-background min-h-[92px] p-1.5 cursor-pointer hover:bg-muted/50 ${!isCurrentMonth ? "opacity-40" : ""} ${isToday ? "ring-2 ring-primary ring-inset" : ""} ${isSelectedDay ? "bg-primary/5" : ""}`} onClick={() => { setSelectedDate(day); setCurrentDate(day); }}>
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <div className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground shadow-sm" : isSelectedDay ? "bg-slate-900 text-white" : ""}`}>
                            {format(day, "d")}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 transition group-hover:opacity-100 focus-visible:opacity-100 ${isSelectedDay ? "opacity-100" : "opacity-0"}`}
                            title="일정 추가"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day);
                              setShowModal(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="space-y-0.5">
                          {daySchedules.slice(0, 3).map((s) => (
                            <div key={s.id} className={`text-[10px] text-white rounded px-1 py-0.5 truncate ${typeColors[s.type] ?? "bg-slate-400"}`} onClick={(e) => { e.stopPropagation(); setSelectedSchedule(s); }}>
                              {formatScheduleTime(s.startTime)} {s.title}
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
                  const isSelectedDay = isSameDay(day, selectedDay);
                  return (
                    <div key={day.toISOString()} className={`group bg-background ${isSelectedDay ? "ring-2 ring-primary/30 ring-inset" : ""}`}>
                      <div className={`py-2 text-xs font-medium ${isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                        <div className="flex items-start justify-between px-2">
                          <span className="text-left">
                            <span className="block">{format(day, "EEE", { locale: ko })}</span>
                            <span className={`block text-base font-bold ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 transition group-hover:opacity-100 focus-visible:opacity-100 ${isSelectedDay ? "opacity-100" : "opacity-0"}`}
                            title="일정 추가"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day);
                              setShowModal(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-1 min-h-[200px] space-y-1 cursor-pointer" onClick={() => { setSelectedDate(day); setCurrentDate(day); }}>
                        {daySchedules.map((s) => (
                          <div key={s.id} className={`text-[11px] text-white rounded px-1.5 py-1 ${typeColors[s.type] ?? "bg-slate-400"}`} onClick={(e) => { e.stopPropagation(); setSelectedSchedule(s); }}>
                            <div className="font-medium truncate">{s.title}</div>
                            <div className="opacity-80">{formatScheduleTime(s.startTime)}</div>
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
                  <ScheduleEmptyState
                    title="이 날 일정이 없습니다."
                    description="상담 예약이나 후속관리 일정을 등록해보세요."
                    onCreate={() => { setSelectedDate(currentDate); setShowModal(true); }}
                  />
                ) : (
                  getSchedulesForDay(currentDate).map((s) => (
                    <ScheduleWorkItem key={s.id} schedule={s} customerName={getScheduleCustomer(s)?.name} onCustomerClick={() => openCustomerDetail(s.customerId)} onClick={() => setSelectedSchedule(s)} />
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                선택 날짜 업무
              </CardTitle>
              <Button size="sm" variant="outline" className="h-8" onClick={() => { setSelectedDate(selectedDay); setShowModal(true); }}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">선택 날짜</p>
              <p className="text-sm font-semibold text-slate-950">{format(selectedDay, "yyyy년 M월 d일 (EEE)", { locale: ko })}</p>
            </div>
            {selectedDaySchedules.length === 0 ? (
              <ScheduleEmptyState
                title="선택한 날짜에 일정이 없습니다."
                description="상담·계약·후속관리 일정을 등록하세요."
                onCreate={() => { setSelectedDate(selectedDay); setShowModal(true); }}
              />
            ) : (
              <div className="space-y-2">
                {selectedDaySchedules.map((s) => (
                  <ScheduleWorkItem key={s.id} schedule={s} customerName={getScheduleCustomer(s)?.name} onCustomerClick={() => openCustomerDetail(s.customerId)} onClick={() => setSelectedSchedule(s)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      <ScheduleModal open={showModal} onClose={() => setShowModal(false)} defaultDate={selectedDate} defaultCustomerId={defaultCustomerId} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} users={users} customers={customerOptions} />
      {selectedSchedule && (
        <ScheduleDetailModal schedule={selectedSchedule} customer={getScheduleCustomer(selectedSchedule)} customers={customerOptions} onViewCustomer={() => openCustomerDetail(selectedSchedule.customerId)} onClose={() => setSelectedSchedule(null)} onDelete={() => deleteMutation.mutate({ id: selectedSchedule.id })} onUpdate={(data) => updateMutation.mutate({ id: selectedSchedule.id, ...data })} loading={deleteMutation.isPending || updateMutation.isPending} />
      )}
    </DashboardLayout>
  );
}

function ScheduleModal({ open, onClose, defaultDate, defaultCustomerId, onSubmit, loading, users, customers }: {
  open: boolean; onClose: () => void; defaultDate: Date | null; defaultCustomerId?: number;
  onSubmit: (data: any) => void; loading: boolean; users: any[] | undefined; customers: CustomerOption[];
}) {
  const { data: scheduleTypeOptions } = trpc.settings.formOptions.useQuery({ category: "scheduleType" });
  const scheduleTypes = scheduleTypeOptions?.length ? scheduleTypeOptions.map((item) => item.value) : SCHEDULE_TYPES;
  const defaultStart = defaultDate ? format(defaultDate, "yyyy-MM-dd'T'09:00") : format(new Date(), "yyyy-MM-dd'T'09:00");
  const [form, setForm] = useState({
    title: "", type: "기타" as string, status: "예정" as string,
    startTime: defaultStart, endTime: "", memo: "", targetUserId: "self", reminderOffsetMinutes: "30", customerId: defaultCustomerId ? String(defaultCustomerId) : "none",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: "",
      type: "기타",
      status: "예정",
      startTime: defaultStart,
      endTime: "",
      memo: "",
      targetUserId: "self",
      reminderOffsetMinutes: "30",
      customerId: defaultCustomerId ? String(defaultCustomerId) : "none",
    });
  }, [defaultCustomerId, defaultStart, open]);

  const handleSubmit = () => {
    if (form.endTime && parseKstLocalDateTime(form.endTime).getTime() <= parseKstLocalDateTime(form.startTime).getTime()) {
      toast.error("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    onSubmit({
      title: form.title,
      type: form.type,
      status: form.status,
      startTime: form.startTime,
      endTime: form.endTime || undefined,
      memo: form.memo || undefined,
      reminderOffsetMinutes: Number(form.reminderOffsetMinutes),
      targetUserId: form.targetUserId && form.targetUserId !== "self" ? Number(form.targetUserId) : undefined,
      customerId: form.customerId !== "none" ? Number(form.customerId) : undefined,
    });
  };

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
                {Object.entries(reminderOffsetLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">미래 dueAt 알림은 설정한 시각이 도래하면 알림센터에 표시됩니다.</p>
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
                  {users.filter((u) => u.accountStatus === "active").map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">연결 고객</Label>
            <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="고객을 선택하세요" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">연결 고객 없음</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">권한 범위 내 고객만 선택할 수 있습니다.</p>
          </div>
          <div><Label className="text-xs">메모</Label><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading || !form.title || !form.startTime} onClick={handleSubmit}>
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDetailModal({ schedule, customer, customers, onViewCustomer, onClose, onDelete, onUpdate, loading }: {
  schedule: any; customer?: CustomerOption; customers: CustomerOption[]; onViewCustomer: () => void; onClose: () => void; onDelete: () => void; onUpdate: (data: any) => void; loading: boolean;
}) {
  const { data: scheduleTypeOptions } = trpc.settings.formOptions.useQuery({ category: "scheduleType" });
  const scheduleTypes = scheduleTypeOptions?.length ? scheduleTypeOptions.map((item) => item.value) : SCHEDULE_TYPES;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: schedule.title,
    type: schedule.type,
    status: schedule.status,
    startTime: formatDateTimeLocal(schedule.startTime),
    endTime: formatDateTimeLocal(schedule.endTime),
    memo: schedule.memo ?? "",
    reminderOffsetMinutes: scheduleDefaultReminderOffset(schedule),
    customerId: schedule.customerId ? String(schedule.customerId) : "none",
  });

  useEffect(() => {
    setEditing(false);
    setForm({
      title: schedule.title,
      type: schedule.type,
      status: schedule.status,
      startTime: formatDateTimeLocal(schedule.startTime),
      endTime: formatDateTimeLocal(schedule.endTime),
      memo: schedule.memo ?? "",
      reminderOffsetMinutes: scheduleDefaultReminderOffset(schedule),
      customerId: schedule.customerId ? String(schedule.customerId) : "none",
    });
  }, [schedule]);

  const handleUpdate = () => {
    if (form.endTime && parseKstLocalDateTime(form.endTime).getTime() <= parseKstLocalDateTime(form.startTime).getTime()) {
      toast.error("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    onUpdate({
      title: form.title,
      type: form.type,
      status: form.status,
      startTime: form.startTime,
      endTime: form.endTime || null,
      memo: form.memo,
      reminderOffsetMinutes: Number(form.reminderOffsetMinutes),
      customerId: form.customerId === "none" ? null : Number(form.customerId),
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>{schedule.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${typeColors[schedule.type] ?? "bg-slate-400"}`} />
            <span>{schedule.type}</span>
            <StatusBadge status={schedule.status} />
          </div>
          <div><p className="text-xs text-muted-foreground">시작</p><p>{formatKstLocalDateTime(schedule.startTime, { seconds: false }).replace("T", " ")}</p></div>
          {schedule.endTime && <div><p className="text-xs text-muted-foreground">종료</p><p>{formatKstLocalDateTime(schedule.endTime, { seconds: false }).replace("T", " ")}</p></div>}
          <div>
            <p className="text-xs text-muted-foreground">알림 설정</p>
            <p className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              <BellRing className="h-3 w-3" /> {scheduleReminderText(schedule)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs text-muted-foreground">연결 고객</p>
            {customer ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-slate-950">{customer.name}</p>
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={onViewCustomer}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> 고객 상세 보기
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">연결된 고객이 없습니다</p>
            )}
          </div>
          {editing ? (
            <>
              <div>
                <Label className="text-xs">제목</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 mt-1" />
              </div>
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
              <div>
                <Label className="text-xs">알림 시간</Label>
                <Select value={form.reminderOffsetMinutes} onValueChange={(v) => setForm({ ...form, reminderOffsetMinutes: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(reminderOffsetLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">저장 시 기존 알림 정책에 따라 설정한 시각에 알림이 표시됩니다.</p>
              </div>
              <div>
                <Label className="text-xs">연결 고객</Label>
                <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="고객을 선택하세요" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">연결 고객 없음</SelectItem>
                    {customers.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">권한 범위 내 고객만 선택할 수 있습니다.</p>
              </div>
              <div><Label className="text-xs">메모</Label><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" /></div>
              <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-background pt-2">
                <Button className="min-h-10" variant="outline" size="sm" onClick={() => setEditing(false)}>취소</Button>
                <Button className="min-h-10" size="sm" disabled={loading || !form.title || !form.startTime} onClick={handleUpdate}>저장</Button>
              </div>
            </>
          ) : (
            <>
              {schedule.memo && <p className="text-xs text-muted-foreground">{schedule.memo}</p>}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                {schedule.status !== "완료" && (
                  <Button size="sm" className="min-h-10" onClick={() => onUpdate({ status: "완료" })} disabled={loading}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 완료
                  </Button>
                )}
                <Button variant="outline" size="sm" className="min-h-10 text-destructive" onClick={onDelete} disabled={loading}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> 삭제
                </Button>
                <Button size="sm" className="min-h-10" onClick={() => setEditing(true)}>수정</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
