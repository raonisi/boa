import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  getStatusLabel,
  StatusBadge,
  SCHEDULE_TYPES,
  SCHEDULE_STATUSES,
} from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ScheduleCustomerLinkPicker from "@/components/schedule/ScheduleCustomerLinkPicker";
import ScheduleQuickCreateDialog, {
  type DetailedScheduleSeed,
} from "@/components/schedule/ScheduleQuickCreateDialog";
import { trpc } from "@/lib/trpc";
import {
  getUserFacingErrorMessage,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { useIsMobile } from "@/hooks/useMobile";
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
  isWithinInterval,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Trash2,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  UserRound,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { formatUserWithRole } from "@/lib/userRole";
import { cn } from "@/lib/utils";
import {
  formatKstLocalDateTime,
  formatKstLocalDateTimeForInput,
  isSameKstDate,
  parseKstLocalDateTime,
} from "@shared/timePolicy";
import {
  recommendScheduleCalendarCategory,
  SCHEDULE_CALENDAR_CATEGORIES,
  SCHEDULE_CALENDAR_CATEGORY_CARDS,
  SCHEDULE_CALENDAR_CATEGORY_LABELS,
  type ScheduleCalendarCategory,
} from "@shared/scheduleCalendarCategory";

type ViewMode = "month" | "week" | "day";
type MobileRange = "today" | "week" | "month" | "all" | "custom";
type ScheduleOwnerViewMode = "mine" | "user" | "team" | "organization";
type CalendarSchedule = {
  id: number;
  userId: number;
  ownerUserId: number;
  ownerName?: string;
  title: string;
  type: string;
  status: string;
  startTime: string | Date;
  endTime?: string | Date | null;
  memo?: string | null;
  reminderOffsetMinutes?: number;
  customerId?: number | null;
  customerDisplayName?: string | null;
  canViewCustomerDetail?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  calendarCategory?: ScheduleCalendarCategory;
  calendarCategoryLabel?: string;
};

function CalendarCategoryFilterBar({
  value,
  onChange,
}: {
  value: ScheduleCalendarCategory | "all";
  onChange: (value: ScheduleCalendarCategory | "all") => void;
}) {
  const items: Array<{
    value: ScheduleCalendarCategory | "all";
    label: string;
  }> = [
    { value: "all", label: "전체" },
    ...SCHEDULE_CALENDAR_CATEGORIES.map(category => ({
      value: category,
      label: SCHEDULE_CALENDAR_CATEGORY_LABELS[category],
    })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <Button
          key={item.value}
          type="button"
          size="sm"
          variant={value === item.value ? "default" : "outline"}
          className="min-h-9"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

function CalendarCategoryBadge({
  category,
  label,
}: {
  category?: ScheduleCalendarCategory;
  label?: string;
}) {
  if (!category && !label) return null;
  const tone =
    category === "consultation_followup"
      ? "bg-sky-50 text-sky-800"
      : category === "admin"
        ? "bg-violet-50 text-violet-800"
        : "bg-emerald-50 text-emerald-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {label ?? (category ? SCHEDULE_CALENDAR_CATEGORY_LABELS[category] : "")}
    </span>
  );
}

function CalendarCategoryCardPicker({
  value,
  userRole,
  onChange,
}: {
  value: ScheduleCalendarCategory;
  userRole?: string;
  onChange: (value: ScheduleCalendarCategory) => void;
}) {
  const isMember = userRole === "member";

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium" id="calendar-category-label">
          캘린더 분류
        </Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          이 일정이 Google Calendar의 어느 공유 캘린더에 표시될지 선택하세요.
          자동 추천보다 직접 선택한 값이 우선 적용됩니다.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="calendar-category-label"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SCHEDULE_CALENDAR_CATEGORY_CARDS.map(card => {
          const selected = value === card.value;
          const disabled = isMember && card.value === "admin";
          return (
            <button
              key={card.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(card.value);
              }}
              className={cn(
                "relative flex min-h-[8.5rem] w-full flex-col rounded-xl border p-3.5 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                disabled &&
                  "cursor-not-allowed opacity-50 hover:border-slate-200 hover:bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-700">
                    {card.summary}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-300 bg-white text-transparent"
                  )}
                  aria-hidden="true"
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {card.helper}
              </p>
              {disabled ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  팀원 계정에서는 선택할 수 없습니다.
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const typeColors: Record<string, string> = {
  고객상담: "bg-blue-500",
  재통화: "bg-cyan-500",
  계약예정: "bg-green-500",
  보장분석: "bg-indigo-500",
  해지방어: "bg-rose-500",
  팀회의: "bg-purple-500",
  교육: "bg-yellow-500",
  외근: "bg-orange-500",
  휴무: "bg-gray-400",
  기타: "bg-slate-400",
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
  return parseKstLocalDateTime(
    formatKstLocalDateTime(value, { seconds: false })
  );
}

function scheduleReminderOffset(schedule: any) {
  return String(schedule?.reminderOffsetMinutes ?? 30);
}

function scheduleReminderText(schedule: any) {
  return reminderOffsetLabels[scheduleReminderOffset(schedule)] ?? "30분 전";
}

export function buildCalendarDayA11yLabel(input: {
  day: Date;
  isToday: boolean;
  isSelected: boolean;
  scheduleCount: number;
}) {
  const parts = [format(input.day, "yyyy년 M월 d일", { locale: ko })];
  if (input.isToday) parts.push("오늘");
  if (input.isSelected) parts.push("선택됨");
  if (input.scheduleCount > 0) parts.push(`일정 ${input.scheduleCount}건`);
  return parts.join(", ");
}

function scheduleDefaultReminderOffset(schedule: any) {
  return scheduleReminderOffset(schedule);
}

function ScheduleEmptyState({
  title,
  description,
  onCreate,
}: {
  title: string;
  description: string;
  onCreate: () => void;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      actionLabel="일정 추가"
      onAction={onCreate}
      compact
    />
  );
}

function ScheduleWorkItem({
  schedule,
  customerName,
  ownerName,
  showOwnerName = false,
  readOnly = false,
  onClick,
  onCustomerClick,
}: {
  schedule: CalendarSchedule;
  customerName?: string;
  ownerName?: string;
  showOwnerName?: boolean;
  readOnly?: boolean;
  onClick: () => void;
  onCustomerClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="min-h-12 flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-left transition hover:bg-slate-50"
      onClick={onClick}
    >
      <div
        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${typeColors[schedule.type] ?? "bg-slate-400"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 text-sm font-semibold leading-5 text-slate-950">
            {schedule.title}
          </p>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
            {formatScheduleTime(schedule.startTime)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{schedule.type}</span>
          <StatusBadge status={schedule.status} />
          <CalendarCategoryBadge
            category={schedule.calendarCategory}
            label={schedule.calendarCategoryLabel}
          />
          {readOnly ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              조회 전용
            </span>
          ) : null}
          {showOwnerName && ownerName ? (
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
              {ownerName}
            </span>
          ) : null}
          {customerName ? (
            <span
              role={onCustomerClick ? "button" : undefined}
              tabIndex={onCustomerClick ? 0 : undefined}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${onCustomerClick ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              onClick={e => {
                if (!onCustomerClick) return;
                e.stopPropagation();
                onCustomerClick();
              }}
              onKeyDown={e => {
                if (!onCustomerClick || (e.key !== "Enter" && e.key !== " "))
                  return;
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
        {schedule.memo && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {schedule.memo}
          </p>
        )}
      </div>
    </button>
  );
}

function ScheduleOwnerFilter({
  ownerViewMode,
  selectedOwnerUserId,
  selectedTeamId,
  ownerSearch,
  scheduleViewUsers,
  scheduleViewTeams,
  organizationViewWarning,
  onOwnerViewModeChange,
  onSelectedOwnerUserIdChange,
  onSelectedTeamIdChange,
  onOwnerSearchChange,
}: {
  ownerViewMode: ScheduleOwnerViewMode;
  selectedOwnerUserId: string;
  selectedTeamId: string;
  ownerSearch: string;
  scheduleViewUsers: Array<{
    userId: number;
    name: string | null;
    role: string;
    teamName: string | null;
  }>;
  scheduleViewTeams: Array<{ teamId: number; name: string }>;
  organizationViewWarning?: string;
  onOwnerViewModeChange: (value: ScheduleOwnerViewMode) => void;
  onSelectedOwnerUserIdChange: (value: string) => void;
  onSelectedTeamIdChange: (value: string) => void;
  onOwnerSearchChange: (value: string) => void;
}) {
  const filteredUsers = scheduleViewUsers.filter(user => {
    const label = `${user.name ?? ""} ${user.teamName ?? ""}`.toLowerCase();
    return label.includes(ownerSearch.trim().toLowerCase());
  });

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-sm">
      <CardContent className="space-y-3 p-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">일정 보기</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            기본값은 내 일정입니다. 다른 조직원 일정은 조회만 가능합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["mine", "내 일정"],
              ["user", "직원 선택"],
              ["team", "팀 일정"],
              ["organization", "전체 일정"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={ownerViewMode === value ? "default" : "outline"}
              className="min-h-12 w-full"
              onClick={() => onOwnerViewModeChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {ownerViewMode === "user" ? (
          <div className="space-y-2">
            <Input
              value={ownerSearch}
              onChange={event => onOwnerSearchChange(event.target.value)}
              placeholder="이름 또는 팀 검색"
              className="min-h-12"
            />
            <Select
              value={selectedOwnerUserId}
              onValueChange={onSelectedOwnerUserIdChange}
            >
              <SelectTrigger className="min-h-12">
                <SelectValue placeholder="조회할 직원 선택" />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map(user => (
                  <SelectItem key={user.userId} value={String(user.userId)}>
                    {formatUserWithRole({
                      id: user.userId,
                      name: user.name,
                      role: user.role,
                    })}
                    {user.teamName ? ` · ${user.teamName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {ownerViewMode === "team" ? (
          <Select value={selectedTeamId} onValueChange={onSelectedTeamIdChange}>
            <SelectTrigger className="min-h-12">
              <SelectValue placeholder="조회할 팀 선택" />
            </SelectTrigger>
            <SelectContent>
              {scheduleViewTeams.map(team => (
                <SelectItem key={team.teamId} value={String(team.teamId)}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {organizationViewWarning ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            {organizationViewWarning}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showModal, setShowModal] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [detailedSeed, setDetailedSeed] = useState<DetailedScheduleSeed | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] =
    useState<CalendarSchedule | null>(null);
  const [mobileRange, setMobileRange] = useState<MobileRange>("today");
  const [ownerViewMode, setOwnerViewMode] =
    useState<ScheduleOwnerViewMode>("mine");
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [customStartDate, setCustomStartDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [customEndDate, setCustomEndDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [location, setLocation] = useLocation();
  const [initialCustomerApplied, setInitialCustomerApplied] = useState(false);
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<
    ScheduleCalendarCategory | "all"
  >("all");
  const { user } = useAuth();
  const userRole = user?.role ?? "member";

  const utils = trpc.useUtils();
  const scheduleListInput = useMemo(() => {
    if (ownerViewMode === "user" && !selectedOwnerUserId)
      return { viewMode: "mine" as const };
    if (ownerViewMode === "team" && !selectedTeamId)
      return { viewMode: "mine" as const };
    return {
      viewMode: ownerViewMode,
      ...(calendarCategoryFilter !== "all"
        ? { calendarCategory: calendarCategoryFilter }
        : {}),
      ...(ownerViewMode === "user" && selectedOwnerUserId
        ? { ownerUserId: Number(selectedOwnerUserId) }
        : {}),
      ...(ownerViewMode === "team" && selectedTeamId
        ? { teamId: Number(selectedTeamId) }
        : {}),
    };
  }, [
    ownerViewMode,
    selectedOwnerUserId,
    selectedTeamId,
    calendarCategoryFilter,
  ]);
  const isMobile = useIsMobile();
  const {
    data: scheduleListData,
    isLoading: isSchedulesLoading,
    isError: isSchedulesError,
    refetch: refetchSchedules,
  } = trpc.schedules.list.useQuery(scheduleListInput);
  const schedules = (scheduleListData?.schedules ?? []) as CalendarSchedule[];
  const scheduleViewUsers = scheduleListData?.users ?? [];
  const scheduleViewTeams = scheduleListData?.teams ?? [];
  const organizationViewWarning = scheduleListData?.organizationViewWarning;
  const showOwnerName = ownerViewMode !== "mine";
  const { data: users } = trpc.users.list.useQuery({ activeOnly: true });
  const browserSearch =
    typeof window !== "undefined" ? window.location.search : "";
  const query = location.includes("?")
    ? location.slice(location.indexOf("?") + 1)
    : browserSearch.replace(/^\?/, "");
  const queryParams = new URLSearchParams(query);
  const queryAction = queryParams.get("action");
  const queryCustomerId = Number(queryParams.get("customerId"));
  const defaultCustomerId =
    Number.isFinite(queryCustomerId) && queryCustomerId > 0
      ? queryCustomerId
      : undefined;
  const getScheduleCustomerLabel = (schedule: CalendarSchedule) =>
    schedule.customerDisplayName ?? null;
  const canOpenCustomerDetail = (schedule: CalendarSchedule) =>
    schedule.canViewCustomerDetail ?? false;
  const openCustomerDetail = (schedule: CalendarSchedule) => {
    if (canOpenCustomerDetail(schedule) && schedule.customerId)
      setLocation(`/customers/${schedule.customerId}`);
  };
  const handleOwnerViewModeChange = (value: ScheduleOwnerViewMode) => {
    setOwnerViewMode(value);
    if (value !== "user") setSelectedOwnerUserId("");
    if (value !== "team") setSelectedTeamId("");
  };

  const openQuickCreate = (date: Date | null = new Date()) => {
    setSelectedDate(date);
    setShowQuickModal(true);
  };

  const openDetailedCreate = (seed: DetailedScheduleSeed | null = null) => {
    setDetailedSeed(seed);
    setShowQuickModal(false);
    setShowModal(true);
  };

  useEffect(() => {
    if (initialCustomerApplied) return;
    if (!defaultCustomerId) return;
    if (queryAction !== "create" && queryAction !== "quick-create") return;
    setSelectedDate(new Date());
    if (queryAction === "create" && queryParams.get("mode") === "full") {
      setShowModal(true);
    } else {
      setShowQuickModal(true);
    }
    setInitialCustomerApplied(true);
  }, [defaultCustomerId, initialCustomerApplied, queryAction, queryParams]);

  const createMutation = trpc.schedules.create.useMutation({
    onSuccess: () => {
      toast.success("일정을 등록했습니다.");
      setShowModal(false);
      setShowQuickModal(false);
      setDetailedSeed(null);
      utils.schedules.list.invalidate();
      utils.notifications.list.invalidate();
    },
  });
  const deleteMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => {
      toast.success("일정이 삭제되었습니다.");
      setSelectedSchedule(null);
      utils.schedules.list.invalidate();
      utils.notifications.list.invalidate();
    },
  });
  const updateMutation = trpc.schedules.update.useMutation({
    onSuccess: () => {
      toast.success("일정이 수정되었습니다.");
      setSelectedSchedule(null);
      utils.schedules.list.invalidate();
      utils.notifications.list.invalidate();
    },
    onError: error =>
      toast.error(
        getUserFacingErrorMessage(
          error,
          "일정 수정에 실패했습니다. 다시 시도해 주세요."
        )
      ),
  });

  const getSchedulesForDay = (day: Date) =>
    (schedules ?? []).filter(s => isSameKstDate(s.startTime, day));

  const navigate = (dir: 1 | -1) => {
    if (viewMode === "month")
      setCurrentDate(
        dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1)
      );
    else if (viewMode === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const headerTitle =
    viewMode === "month"
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
  const incompleteSchedules = (schedules ?? []).filter(s => {
    if (s.status !== "예정" && s.status !== "보류") return false;
    if (!s.endTime) return false;
    return scheduleDate(s.endTime) < today;
  });
  const thisWeekSchedules = (schedules ?? [])
    .filter(s => {
      const d = scheduleDate(s.startTime);
      const wStart = startOfWeek(today, { weekStartsOn: 1 });
      const wEnd = endOfWeek(today, { weekStartsOn: 1 });
      return d >= wStart && d <= wEnd;
    })
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  const mobileList = (schedules ?? [])
    .filter(s => {
      const d = scheduleDate(s.startTime);
      if (mobileRange === "all") return true;
      if (mobileRange === "today") return isSameDay(d, today);
      if (mobileRange === "week")
        return (
          d >= startOfWeek(today, { weekStartsOn: 1 }) &&
          d <= endOfWeek(today, { weekStartsOn: 1 })
        );
      if (mobileRange === "custom") {
        const start = new Date(`${customStartDate}T00:00:00`);
        const end = new Date(`${customEndDate}T23:59:59`);
        return d >= start && d <= end;
      }
      return isWithinInterval(d, {
        start: startOfMonth(today),
        end: endOfMonth(today),
      });
    })
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  const reminderSchedules = (schedules ?? []).filter(s => {
    if (!["예정", "변경", "보류"].includes(s.status)) return false;
    if ((s.reminderOffsetMinutes ?? 30) < 0) return false;
    return scheduleDate(s.startTime) >= today;
  });
  const selectedDay = selectedDate ?? currentDate;
  const selectedDaySchedules = getSchedulesForDay(selectedDay).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  const summaryCards = [
    {
      label: "오늘 일정",
      value: todaySchedules.length,
      helper: "오늘 처리할 상담·업무",
      icon: CalendarDays,
      tone: "text-slate-700",
    },
    {
      label: "이번주 일정",
      value: thisWeekSchedules.length,
      helper: "이번주 업무 흐름",
      icon: Clock3,
      tone: "text-emerald-700",
    },
    {
      label: "미완료 일정",
      value: incompleteSchedules.length,
      helper: "종료 시각 경과",
      icon: AlertTriangle,
      tone: "text-amber-700",
    },
    {
      label: "알림 예정",
      value: reminderSchedules.length,
      helper: "설정된 시각에 노출",
      icon: BellRing,
      tone: "text-blue-700",
    },
  ];
  const scheduleStatePanel = isSchedulesLoading ? (
    <LoadingState
      title="일정을 불러오는 중입니다."
      description="선택한 범위의 일정을 확인하고 있습니다."
      fullPage
    />
  ) : isSchedulesError ? (
    <ErrorState
      title="일정을 불러오지 못했습니다."
      description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      retryLabel="새로고침"
      onRetry={() => refetchSchedules()}
      fullPage
    />
  ) : null;

  if (isMobile) {
    return (
      <DashboardLayout>
        {scheduleStatePanel ? (
          scheduleStatePanel
        ) : (
          <div className="space-y-4 pb-[max(5rem,env(safe-area-inset-bottom))]">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
                    Schedule
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-950">
                    일정관리
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">
                    오늘과 이번주 업무 흐름을 먼저 확인합니다.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="min-h-12 shrink-0"
                  onClick={() => openQuickCreate()}
                >
                  <Plus className="h-4 w-4 mr-1" /> 일정 추가
                </Button>
              </CardContent>
            </Card>

            <ScheduleOwnerFilter
              ownerViewMode={ownerViewMode}
              selectedOwnerUserId={selectedOwnerUserId}
              selectedTeamId={selectedTeamId}
              ownerSearch={ownerSearch}
              scheduleViewUsers={scheduleViewUsers}
              scheduleViewTeams={scheduleViewTeams}
              organizationViewWarning={organizationViewWarning}
              onOwnerViewModeChange={handleOwnerViewModeChange}
              onSelectedOwnerUserIdChange={setSelectedOwnerUserId}
              onSelectedTeamIdChange={setSelectedTeamId}
              onOwnerSearchChange={setOwnerSearch}
            />

            <CalendarCategoryFilterBar
              value={calendarCategoryFilter}
              onChange={setCalendarCategoryFilter}
            />

            <div className="grid grid-cols-2 gap-2">
              {summaryCards.map(item => (
                <Card
                  key={item.label}
                  className="border-slate-200/80 bg-white/95 shadow-sm"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <item.icon className={`h-4 w-4 ${item.tone}`} />
                    </div>
                    <p className="mt-1 text-2xl font-bold text-slate-950">
                      {item.value}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.helper}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 오늘 일정 */}
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-[#b99b5f]" /> 오늘 일정
                  ({todaySchedules.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {todaySchedules.length === 0 ? (
                  <ScheduleEmptyState
                    title="오늘 일정이 없습니다."
                    description="상담 예약이나 후속관리 일정을 등록해보세요."
                    onCreate={() => openQuickCreate()}
                  />
                ) : (
                  todaySchedules.map(s => (
                    <div
                      key={s.id}
                      className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl p-3.5 text-white shadow-sm ${typeColors[s.type] ?? "bg-slate-400"}`}
                      onClick={() => setSelectedSchedule(s)}
                    >
                      <div className="text-xs font-bold w-10 shrink-0">
                        {formatScheduleTime(s.startTime)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-5">
                          {s.title}
                        </p>
                        <p className="text-xs font-medium opacity-90">
                          {showOwnerName && s.ownerName
                            ? `${s.ownerName} · `
                            : ""}
                          {getScheduleCustomerLabel(s) ?? "연결 고객 없음"}
                        </p>
                        <p className="mt-1 text-xs leading-5 opacity-80">
                          {s.type} · {getStatusLabel(s.status)} · 알림{" "}
                          {scheduleReminderText(s)}
                        </p>
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
                  <CardTitle className="text-sm text-orange-700">
                    ⚠️ 미완료 일정 ({incompleteSchedules.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {incompleteSchedules.map(s => (
                    <div
                      key={s.id}
                      className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-orange-200 bg-white p-3.5 hover:bg-orange-50"
                      onClick={() => setSelectedSchedule(s)}
                    >
                      <div
                        className={`h-2 w-2 rounded-full shrink-0 ${typeColors[s.type] ?? "bg-slate-400"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-sm font-medium leading-5">
                          {s.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {showOwnerName && s.ownerName
                            ? `${s.ownerName} · `
                            : ""}
                          {getScheduleCustomerLabel(s) ?? "연결 고객 없음"}
                        </p>
                        <p className="text-xs text-orange-600">
                          종료:{" "}
                          {s.endTime
                            ? format(scheduleDate(s.endTime), "M/d HH:mm", {
                                locale: ko,
                              })
                            : "-"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-orange-600">
                        {getStatusLabel(s.status)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 이번 주 일정 */}
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="grid grid-cols-2 gap-2 p-3 sm:flex sm:flex-wrap">
                {["today", "week", "month", "all", "custom"].map(r => (
                  <Button
                    key={r}
                    className="min-h-12"
                    variant={mobileRange === r ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMobileRange(r as MobileRange)}
                  >
                    {r === "today"
                      ? "오늘"
                      : r === "week"
                        ? "이번주"
                        : r === "month"
                          ? "이번달"
                          : r === "all"
                            ? "전체"
                            : "직접선택"}
                  </Button>
                ))}
                {mobileRange === "custom" && (
                  <div className="col-span-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">
                        시작일
                      </span>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="min-h-12 w-full"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">
                        종료일
                      </span>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="min-h-12 w-full"
                      />
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock3 className="h-4 w-4 text-[#b99b5f]" /> 조회 일정 (
                  {mobileList.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mobileList.length === 0 ? (
                  <ScheduleEmptyState
                    title="선택한 조건에 해당하는 일정이 없습니다."
                    description="보기 필터를 바꾸거나 상담·계약·후속관리 일정을 등록하세요."
                    onCreate={() => openQuickCreate()}
                  />
                ) : (
                  mobileList.map(s => (
                    <div
                      key={s.id}
                      className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3.5 hover:bg-slate-50"
                      onClick={() => setSelectedSchedule(s)}
                    >
                      <div
                        className={`h-2 w-2 rounded-full shrink-0 ${typeColors[s.type] ?? "bg-slate-400"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-sm font-medium leading-5">
                          {s.title}
                        </p>
                        {showOwnerName && s.ownerName ? (
                          <p className="text-xs font-medium text-violet-700">
                            {s.ownerName}
                          </p>
                        ) : null}
                        <p className="text-xs text-emerald-700">
                          {getScheduleCustomerLabel(s) ?? "연결 고객 없음"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(
                            scheduleDate(s.startTime),
                            "M/d (EEE) HH:mm",
                            {
                              locale: ko,
                            }
                          )}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={s.status} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 모달들 */}
        <ScheduleQuickCreateDialog
          open={showQuickModal}
          onClose={() => setShowQuickModal(false)}
          defaultDate={selectedDate}
          defaultCustomerId={defaultCustomerId}
          onSubmit={data => {
            const { presetLabel: _presetLabel, ...payload } = data;
            createMutation.mutate(payload);
          }}
          onOpenDetailed={openDetailedCreate}
          loading={createMutation.isPending}
        />
        <ScheduleModal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setDetailedSeed(null);
          }}
          defaultDate={selectedDate}
          defaultCustomerId={defaultCustomerId}
          seed={detailedSeed}
          onSubmit={data => createMutation.mutate(data)}
          loading={createMutation.isPending}
          users={users}
          userRole={userRole}
        />
        {selectedSchedule && (
          <ScheduleDetailModal
            schedule={selectedSchedule}
            customerName={getScheduleCustomerLabel(selectedSchedule)}
            canEdit={selectedSchedule.canEdit ?? true}
            canDelete={selectedSchedule.canDelete ?? true}
            canViewCustomerDetail={canOpenCustomerDetail(selectedSchedule)}
            userRole={userRole}
            onViewCustomer={() => openCustomerDetail(selectedSchedule)}
            onClose={() => setSelectedSchedule(null)}
            onDelete={() => deleteMutation.mutate({ id: selectedSchedule.id })}
            onUpdate={data =>
              updateMutation.mutate({ id: selectedSchedule.id, ...data })
            }
            loading={deleteMutation.isPending || updateMutation.isPending}
          />
        )}
      </DashboardLayout>
    );
  }

  // PC 뷰
  return (
    <DashboardLayout>
      {scheduleStatePanel ? (
        scheduleStatePanel
      ) : (
        <div className="space-y-5">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
                  Schedule
                </p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950">
                  일정관리
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  상담·계약·후속관리 일정을 업무 흐름으로 확인합니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border overflow-hidden">
                  {(["month", "week", "day"] as ViewMode[]).map(v => (
                    <button
                      key={v}
                      onClick={() => setViewMode(v)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {v === "month" ? "월" : v === "week" ? "주" : "일"}
                    </button>
                  ))}
                </div>
                <Button size="sm" onClick={() => openQuickCreate()}>
                  <Plus className="h-4 w-4 mr-1" /> 상담·계약·후속관리 일정 등록
                </Button>
              </div>
            </CardContent>
          </Card>

          <ScheduleOwnerFilter
            ownerViewMode={ownerViewMode}
            selectedOwnerUserId={selectedOwnerUserId}
            selectedTeamId={selectedTeamId}
            ownerSearch={ownerSearch}
            scheduleViewUsers={scheduleViewUsers}
            scheduleViewTeams={scheduleViewTeams}
            organizationViewWarning={organizationViewWarning}
            onOwnerViewModeChange={handleOwnerViewModeChange}
            onSelectedOwnerUserIdChange={setSelectedOwnerUserId}
            onSelectedTeamIdChange={setSelectedTeamId}
            onOwnerSearchChange={setOwnerSearch}
          />

          <CalendarCategoryFilterBar
            value={calendarCategoryFilter}
            onChange={setCalendarCategoryFilter}
          />

          <div className="grid gap-3 md:grid-cols-4">
            {summaryCards.map(item => (
              <Card
                key={item.label}
                className="border-slate-200/80 bg-white/95 shadow-sm"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500">
                      {item.label}
                    </p>
                    <item.icon className={`h-4 w-4 ${item.tone}`} />
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.helper}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    aria-label={
                      viewMode === "month"
                        ? "이전 달 보기"
                        : viewMode === "week"
                          ? "이전 주 보기"
                          : "이전 날 보기"
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-base font-semibold">{headerTitle}</h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate(1)}>
                    <span className="sr-only">
                      {viewMode === "month"
                        ? "다음 달 보기"
                        : viewMode === "week"
                          ? "다음 주 보기"
                          : "다음 날 보기"}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {viewMode === "month" && (
                  <div>
                    <div className="grid grid-cols-7 mb-1">
                      {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                        <div
                          key={d}
                          className="text-center text-xs font-medium text-muted-foreground py-1"
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                      {calDays.map(day => {
                        const daySchedules = getSchedulesForDay(day);
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isSelectedDay = isSameDay(day, selectedDay);
                        return (
                          <div
                            key={day.toISOString()}
                            className={`group bg-background min-h-[92px] p-1.5 cursor-pointer hover:bg-muted/50 ${!isCurrentMonth ? "opacity-40" : ""} ${isToday ? "ring-2 ring-primary ring-inset" : ""} ${isSelectedDay ? "bg-primary/5" : ""}`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-1">
                              <button
                                type="button"
                                aria-label={buildCalendarDayA11yLabel({
                                  day,
                                  isToday,
                                  isSelected: isSelectedDay,
                                  scheduleCount: daySchedules.length,
                                })}
                                aria-current={isToday ? "date" : undefined}
                                data-selected={isSelectedDay}
                                className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground shadow-sm" : isSelectedDay ? "bg-slate-900 text-white" : ""}`}
                                onClick={() => {
                                  setSelectedDate(day);
                                  setCurrentDate(day);
                                }}
                              >
                                {format(day, "d")}
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 transition group-hover:opacity-100 focus-visible:opacity-100 ${isSelectedDay ? "opacity-100" : "opacity-0"}`}
                                aria-label="일정 추가"
                                onClick={e => {
                                  e.stopPropagation();
                                  openQuickCreate(day);
                                }}
                              >
                                <Plus
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>
                            <div className="space-y-0.5">
                              {daySchedules.slice(0, 3).map(s => (
                                <div
                                  key={s.id}
                                  className={`text-xs text-white rounded px-1 py-0.5 truncate ${typeColors[s.type] ?? "bg-slate-400"}`}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedSchedule(s);
                                  }}
                                >
                                  {formatScheduleTime(s.startTime)}{" "}
                                  {showOwnerName && s.ownerName
                                    ? `[${s.ownerName}] `
                                    : ""}
                                  {s.title}
                                </div>
                              ))}
                              {daySchedules.length > 3 && (
                                <div className="text-xs text-muted-foreground pl-1">
                                  +{daySchedules.length - 3}개
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {viewMode === "week" && (
                  <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                    {weekDays.map(day => {
                      const daySchedules = getSchedulesForDay(day);
                      const isToday = isSameDay(day, new Date());
                      const isSelectedDay = isSameDay(day, selectedDay);
                      return (
                        <div
                          key={day.toISOString()}
                          className={`group bg-background ${isSelectedDay ? "ring-2 ring-primary/30 ring-inset" : ""}`}
                        >
                          <div
                            className={`py-2 text-xs font-medium ${isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                          >
                            <div className="flex items-start justify-between px-2">
                              <button
                                type="button"
                                className="text-left"
                                aria-label={buildCalendarDayA11yLabel({
                                  day,
                                  isToday,
                                  isSelected: isSelectedDay,
                                  scheduleCount: daySchedules.length,
                                })}
                                aria-current={isToday ? "date" : undefined}
                                data-selected={isSelectedDay}
                                onClick={() => {
                                  setSelectedDate(day);
                                  setCurrentDate(day);
                                }}
                              >
                                <span className="block">
                                  {format(day, "EEE", { locale: ko })}
                                </span>
                                <span
                                  className={`block text-base font-bold ${isToday ? "text-primary" : ""}`}
                                >
                                  {format(day, "d")}
                                </span>
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 transition group-hover:opacity-100 focus-visible:opacity-100 ${isSelectedDay ? "opacity-100" : "opacity-0"}`}
                                aria-label="일정 추가"
                                onClick={e => {
                                  e.stopPropagation();
                                  openQuickCreate(day);
                                }}
                              >
                                <Plus
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>
                          </div>
                          <div
                            className="p-1 min-h-[200px] space-y-1 cursor-pointer"
                            onClick={() => {
                              setSelectedDate(day);
                              setCurrentDate(day);
                            }}
                          >
                            {daySchedules.map(s => (
                              <div
                                key={s.id}
                                className={`text-xs text-white rounded px-1.5 py-1 ${typeColors[s.type] ?? "bg-slate-400"}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedSchedule(s);
                                }}
                              >
                                <div className="font-medium truncate">
                                  {showOwnerName && s.ownerName
                                    ? `[${s.ownerName}] `
                                    : ""}
                                  {s.title}
                                </div>
                                <div className="opacity-80">
                                  {formatScheduleTime(s.startTime)}
                                </div>
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
                        onCreate={() => openQuickCreate(currentDate)}
                      />
                    ) : (
                      getSchedulesForDay(currentDate).map(s => (
                        <ScheduleWorkItem
                          key={s.id}
                          schedule={s}
                          customerName={
                            getScheduleCustomerLabel(s) ?? undefined
                          }
                          ownerName={s.ownerName}
                          showOwnerName={showOwnerName}
                          readOnly={!(s.canEdit ?? true)}
                          onCustomerClick={
                            canOpenCustomerDetail(s)
                              ? () => openCustomerDetail(s)
                              : undefined
                          }
                          onClick={() => setSelectedSchedule(s)}
                        />
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => openQuickCreate(selectedDay)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">선택 날짜</p>
                  <p className="text-sm font-semibold text-slate-950">
                    {format(selectedDay, "yyyy년 M월 d일 (EEE)", {
                      locale: ko,
                    })}
                  </p>
                </div>
                {selectedDaySchedules.length === 0 ? (
                  <ScheduleEmptyState
                    title="선택한 날짜에 일정이 없습니다."
                    description="상담·계약·후속관리 일정을 등록하세요."
                    onCreate={() => openQuickCreate(selectedDay)}
                  />
                ) : (
                  <div className="space-y-2">
                    {selectedDaySchedules.map(s => (
                      <ScheduleWorkItem
                        key={s.id}
                        schedule={s}
                        customerName={getScheduleCustomerLabel(s) ?? undefined}
                        ownerName={s.ownerName}
                        showOwnerName={showOwnerName}
                        readOnly={!(s.canEdit ?? true)}
                        onCustomerClick={
                          canOpenCustomerDetail(s)
                            ? () => openCustomerDetail(s)
                            : undefined
                        }
                        onClick={() => setSelectedSchedule(s)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ScheduleQuickCreateDialog
        open={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        defaultDate={selectedDate}
        defaultCustomerId={defaultCustomerId}
        onSubmit={data => {
          const { presetLabel: _presetLabel, ...payload } = data;
          createMutation.mutate(payload);
        }}
        onOpenDetailed={openDetailedCreate}
        loading={createMutation.isPending}
      />
      <ScheduleModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setDetailedSeed(null);
        }}
        defaultDate={selectedDate}
        defaultCustomerId={defaultCustomerId}
        seed={detailedSeed}
        onSubmit={data => createMutation.mutate(data)}
        loading={createMutation.isPending}
        users={users}
        userRole={userRole}
      />
      {selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          customerName={getScheduleCustomerLabel(selectedSchedule)}
          canEdit={selectedSchedule.canEdit ?? true}
          canDelete={selectedSchedule.canDelete ?? true}
          canViewCustomerDetail={canOpenCustomerDetail(selectedSchedule)}
          userRole={userRole}
          onViewCustomer={() => openCustomerDetail(selectedSchedule)}
          onClose={() => setSelectedSchedule(null)}
          onDelete={() => deleteMutation.mutate({ id: selectedSchedule.id })}
          onUpdate={data =>
            updateMutation.mutate({ id: selectedSchedule.id, ...data })
          }
          loading={deleteMutation.isPending || updateMutation.isPending}
        />
      )}
    </DashboardLayout>
  );
}

function ScheduleModal({
  open,
  onClose,
  defaultDate,
  defaultCustomerId,
  seed,
  onSubmit,
  loading,
  users,
  userRole,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: Date | null;
  defaultCustomerId?: number;
  seed?: DetailedScheduleSeed | null;
  onSubmit: (data: any) => void;
  loading: boolean;
  users: any[] | undefined;
  userRole?: string;
}) {
  const { data: scheduleTypeOptions } = trpc.settings.formOptions.useQuery({
    category: "scheduleType",
  });
  const scheduleTypes = scheduleTypeOptions?.length
    ? scheduleTypeOptions.map(item => item.value)
    : SCHEDULE_TYPES;
  const defaultStart = defaultDate
    ? format(defaultDate, "yyyy-MM-dd'T'09:00")
    : format(new Date(), "yyyy-MM-dd'T'09:00");
  const [form, setForm] = useState({
    title: "",
    type: "기타" as string,
    status: "예정" as string,
    startTime: defaultStart,
    endTime: "",
    memo: "",
    targetUserId: "self",
    reminderOffsetMinutes: "30",
    customerId: defaultCustomerId ? String(defaultCustomerId) : "none",
  });
  const [calendarCategory, setCalendarCategory] =
    useState<ScheduleCalendarCategory>("branch_common");
  const [categoryTouched, setCategoryTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoryTouched(Boolean(seed?.calendarCategory));
    const initialType = seed?.type ?? "기타";
    const initialCustomerId = seed?.customerId ?? defaultCustomerId ?? null;
    setCalendarCategory(
      seed?.calendarCategory ??
        recommendScheduleCalendarCategory({
          scheduleType: initialType,
          customerId: initialCustomerId,
        })
    );
    setForm({
      title: seed?.title ?? "",
      type: initialType,
      status: "예정",
      startTime: seed?.startTime ?? defaultStart,
      endTime: seed?.endTime ?? "",
      memo: seed?.memo ?? "",
      targetUserId: "self",
      reminderOffsetMinutes: "30",
      customerId: initialCustomerId ? String(initialCustomerId) : "none",
    });
  }, [defaultCustomerId, defaultStart, open, seed]);

  useEffect(() => {
    if (!open || categoryTouched) return;
    setCalendarCategory(
      recommendScheduleCalendarCategory({
        scheduleType: form.type,
        customerId: form.customerId !== "none" ? Number(form.customerId) : null,
      })
    );
  }, [form.type, form.customerId, categoryTouched, open]);

  const handleSubmit = () => {
    if (
      form.endTime &&
      parseKstLocalDateTime(form.endTime).getTime() <=
        parseKstLocalDateTime(form.startTime).getTime()
    ) {
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
      targetUserId:
        form.targetUserId && form.targetUserId !== "self"
          ? Number(form.targetUserId)
          : undefined,
      customerId:
        form.customerId !== "none" ? Number(form.customerId) : undefined,
      calendarCategory,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>일정 추가</DialogTitle>
          <p className="text-xs text-muted-foreground">상세 입력 모드</p>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">제목 *</Label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="mt-1 min-h-12 md:min-h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">유형</Label>
              <Select
                value={form.type}
                onValueChange={v => setForm({ ...form, type: v })}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scheduleTypes.map(t => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">상태</Label>
              <Select
                value={form.status}
                onValueChange={v => setForm({ ...form, status: v })}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CalendarCategoryCardPicker
            value={calendarCategory}
            userRole={userRole}
            onChange={value => {
              setCategoryTouched(true);
              setCalendarCategory(value);
            }}
          />
          <div>
            <Label className="text-xs">알림 시간</Label>
            <Select
              value={form.reminderOffsetMinutes}
              onValueChange={v =>
                setForm({ ...form, reminderOffsetMinutes: v })
              }
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(reminderOffsetLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              미래 dueAt 알림은 설정한 시각이 도래하면 알림센터에 표시됩니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">시작 시간</Label>
              <Input
                type="datetime-local"
                value={form.startTime}
                onChange={e => setForm({ ...form, startTime: e.target.value })}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">종료 시간</Label>
              <Input
                type="datetime-local"
                value={form.endTime}
                onChange={e => setForm({ ...form, endTime: e.target.value })}
                className="h-9 mt-1"
              />
            </div>
          </div>
          {users && users.length > 0 && (
            <div>
              <Label className="text-xs">대상 (팀원 지정 시)</Label>
              <Select
                value={form.targetUserId}
                onValueChange={v => setForm({ ...form, targetUserId: v })}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="본인 일정" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">본인 일정</SelectItem>
                  {users
                    .filter(u => u.accountStatus === "active")
                    .map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <ScheduleCustomerLinkPicker
            value={form.customerId === "none" ? null : Number(form.customerId)}
            onChange={customerId =>
              setForm({
                ...form,
                customerId: customerId == null ? "none" : String(customerId),
              })
            }
            disabled={loading}
          />
          <div>
            <Label className="text-xs">메모</Label>
            <textarea
              value={form.memo}
              onChange={e => setForm({ ...form, memo: e.target.value })}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-12 md:min-h-8"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              size="sm"
              className="min-h-12 md:min-h-8"
              disabled={loading || !form.title || !form.startTime}
              onClick={handleSubmit}
            >
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDetailModal({
  schedule,
  customerName,
  canEdit,
  canDelete,
  canViewCustomerDetail,
  userRole,
  onViewCustomer,
  onClose,
  onDelete,
  onUpdate,
  loading,
}: {
  schedule: CalendarSchedule;
  customerName?: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canViewCustomerDetail: boolean;
  userRole?: string;
  onViewCustomer: () => void;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (data: any) => void;
  loading: boolean;
}) {
  const syncSummaryQuery = trpc.googleCalendar.getScheduleSyncSummary.useQuery({
    scheduleId: schedule.id,
  });
  const { data: scheduleTypeOptions } = trpc.settings.formOptions.useQuery({
    category: "scheduleType",
  });
  const scheduleTypes = scheduleTypeOptions?.length
    ? scheduleTypeOptions.map(item => item.value)
    : SCHEDULE_TYPES;
  const [editing, setEditing] = useState(false);
  const initialCategory =
    schedule.calendarCategory ??
    recommendScheduleCalendarCategory({
      scheduleType: schedule.type,
      customerId: schedule.customerId,
    });
  const [calendarCategory, setCalendarCategory] =
    useState<ScheduleCalendarCategory>(initialCategory);
  const [categoryTouched, setCategoryTouched] = useState(false);
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
    setCategoryTouched(false);
    setCalendarCategory(
      schedule.calendarCategory ??
        recommendScheduleCalendarCategory({
          scheduleType: schedule.type,
          customerId: schedule.customerId,
        })
    );
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

  useEffect(() => {
    if (!editing || categoryTouched) return;
    setCalendarCategory(
      recommendScheduleCalendarCategory({
        scheduleType: form.type,
        customerId: form.customerId !== "none" ? Number(form.customerId) : null,
      })
    );
  }, [form.type, form.customerId, categoryTouched, editing]);

  const handleUpdate = () => {
    if (
      form.endTime &&
      parseKstLocalDateTime(form.endTime).getTime() <=
        parseKstLocalDateTime(form.startTime).getTime()
    ) {
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
      calendarCategory,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>{schedule.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${typeColors[schedule.type] ?? "bg-slate-400"}`}
            />
            <span>{schedule.type}</span>
            <StatusBadge status={schedule.status} />
            <CalendarCategoryBadge
              category={schedule.calendarCategory}
              label={schedule.calendarCategoryLabel}
            />
            {schedule.ownerName ? (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                담당: {schedule.ownerName}
              </span>
            ) : null}
            {!canEdit ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                조회 전용
              </span>
            ) : null}
          </div>
          {!canEdit ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              이 일정은 조회만 가능합니다.
            </p>
          ) : null}
          <div>
            <p className="text-xs text-muted-foreground">시작</p>
            <p>
              {formatKstLocalDateTime(schedule.startTime, {
                seconds: false,
              }).replace("T", " ")}
            </p>
          </div>
          {schedule.endTime && (
            <div>
              <p className="text-xs text-muted-foreground">종료</p>
              <p>
                {formatKstLocalDateTime(schedule.endTime, {
                  seconds: false,
                }).replace("T", " ")}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">알림 설정</p>
            <p className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              <BellRing className="h-3 w-3" /> {scheduleReminderText(schedule)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs text-muted-foreground">
              Google Calendar 동기화
            </p>
            {syncSummaryQuery.isLoading ? (
              <p className="mt-1 text-sm text-slate-500">확인 중...</p>
            ) : syncSummaryQuery.data?.googleCalendarLabel ? (
              <p className="mt-1 text-sm font-medium text-slate-900">
                {schedule.calendarCategoryLabel ?? "일정"} ·{" "}
                {syncSummaryQuery.data.googleCalendarLabel}
                {syncSummaryQuery.data.syncStatus
                  ? ` · ${syncSummaryQuery.data.syncStatus}`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">동기화 정보 없음</p>
            )}
            {syncSummaryQuery.data?.lastErrorMessageSafe ? (
              <p className="mt-1 text-xs text-destructive">
                {syncSummaryQuery.data.lastErrorMessageSafe}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs text-muted-foreground">연결 고객</p>
            {customerName ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-slate-950">
                  {customerName}
                </p>
                {canViewCustomerDetail ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-12 shrink-0 md:h-8 md:min-h-8"
                    onClick={onViewCustomer}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> 고객 상세 보기
                  </Button>
                ) : (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    고객 상세는 담당 권한이 있는 사용자만 볼 수 있습니다.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                연결된 고객이 없습니다
              </p>
            )}
          </div>
          {canEdit && editing ? (
            <>
              <div>
                <Label className="text-xs">제목</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">유형</Label>
                <Select
                  value={form.type}
                  onValueChange={v => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleTypes.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <CalendarCategoryCardPicker
                value={calendarCategory}
                userRole={userRole}
                onChange={value => {
                  setCategoryTouched(true);
                  setCalendarCategory(value);
                }}
              />
              <div>
                <Label className="text-xs">상태 변경</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">시작 시간</Label>
                  <Input
                    type="datetime-local"
                    value={form.startTime}
                    onChange={e =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                    className="h-9 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">종료 시간</Label>
                  <Input
                    type="datetime-local"
                    value={form.endTime}
                    onChange={e =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                    className="h-9 mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">알림 시간</Label>
                <Select
                  value={form.reminderOffsetMinutes}
                  onValueChange={v =>
                    setForm({ ...form, reminderOffsetMinutes: v })
                  }
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(reminderOffsetLabels).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  저장 시 기존 알림 정책에 따라 설정한 시각에 알림이 표시됩니다.
                </p>
              </div>
              <ScheduleCustomerLinkPicker
                value={
                  form.customerId === "none" ? null : Number(form.customerId)
                }
                onChange={customerId =>
                  setForm({
                    ...form,
                    customerId:
                      customerId == null ? "none" : String(customerId),
                  })
                }
                disabled={loading}
              />
              <div>
                <Label className="text-xs">메모</Label>
                <textarea
                  value={form.memo}
                  onChange={e => setForm({ ...form, memo: e.target.value })}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
                />
              </div>
              <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-background pt-2">
                <Button
                  className="min-h-12 md:min-h-10"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  취소
                </Button>
                <Button
                  className="min-h-12 md:min-h-10"
                  size="sm"
                  disabled={loading || !form.title || !form.startTime}
                  onClick={handleUpdate}
                >
                  저장
                </Button>
              </div>
            </>
          ) : (
            <>
              {schedule.memo && (
                <p className="text-xs text-muted-foreground">{schedule.memo}</p>
              )}
              {canEdit ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    {schedule.status !== "완료" && (
                      <Button
                        size="sm"
                        className="min-h-12 md:min-h-10"
                        onClick={() => onUpdate({ status: "완료" })}
                        disabled={loading}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 완료
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="min-h-12 md:min-h-10"
                      onClick={() => setEditing(true)}
                    >
                      수정
                    </Button>
                  </div>
                  {canDelete ? (
                    <div className="rounded-xl border border-red-100 bg-red-50/70 p-2 sm:flex sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-12 w-full border-red-200 bg-white text-destructive hover:bg-red-50 md:min-h-10 sm:w-auto"
                        onClick={onDelete}
                        disabled={loading}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> 삭제
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
