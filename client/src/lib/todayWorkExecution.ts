import {
  classifyNotificationPriority,
  type NotificationPriority,
} from "@/lib/notificationPriority";
import { getKstDayRange, parseKstLocalDateTime } from "@shared/timePolicy";

export type TodayWorkTaskType =
  | "followUp"
  | "schedule"
  | "notification"
  | "customer";

export type TodayWorkItemType =
  | "schedule"
  | "followup"
  | "notification"
  | "customer";

export type TodayWorkQueueFilter =
  | "all"
  | "schedule"
  | "overdueSchedule"
  | "followup"
  | "notification";

export type TodayWorkDashboardSlice = {
  overdueFollowUps?: Array<{
    id: number;
    customerId: number;
    customerName?: string | null;
    nextContactDate: string | Date;
    reason?: string | null;
    nextAction?: string | null;
    status?: string | null;
  }>;
  todayFollowUps?: Array<{
    id: number;
    customerId: number;
    customerName?: string | null;
    nextContactDate: string | Date;
    reason?: string | null;
    nextAction?: string | null;
    status?: string | null;
  }>;
  todaySchedules?: Array<{
    id: number;
    title: string;
    type?: string | null;
    status?: string | null;
    startTime: string | Date;
    endTime?: string | Date | null;
    customerId?: number | null;
  }>;
  incompleteSchedules?: Array<{
    id: number;
    title: string;
    type?: string | null;
    status?: string | null;
    startTime: string | Date;
    endTime?: string | Date | null;
    customerId?: number | null;
  }>;
  pendingNotifications?: Array<{
    id: number;
    title: string;
    type: string;
    processStatus?: string | null;
    isRead?: boolean | number | null;
    createdAt: string | Date;
    relatedType?: string | null;
    relatedId?: number | null;
    customerName?: string | null;
    dueAt?: string | Date | null;
  }>;
  longUnmanagedCustomers?: Array<{
    id: number;
    name: string;
    consultStatus?: string | null;
    createdAt?: string | Date;
  } | null>;
};

export type TodayWorkItem = {
  key: string;
  type: TodayWorkItemType;
  id: number;
  customerId?: number | null;
  customerName?: string | null;
  title: string;
  description: string;
  dueAt: string | Date;
  scheduleBucket?: "today" | "overdue";
  originalScheduledAt?: Date;
  overdueDays?: number;
  priorityRank: number;
  priorityLabel: string;
  status?: string | null;
  route: string;
  primaryActionLabel: string;
  taskType: TodayWorkTaskType;
  source: Record<string, unknown>;
};

const PRIORITY_LABELS = {
  overdueFollowUp: "지연 후속",
  todayFollowUp: "오늘 연락",
  incompleteSchedule: "미완료 일정",
  soonSchedule: "곧 시작",
  todaySchedule: "오늘 예정",
  urgentNotification: "긴급 알림",
  todayNotification: "오늘 알림",
  generalNotification: "알림",
  longUnmanaged: "장기 미관리",
} as const;

function notificationPriorityRank(priority: NotificationPriority): number {
  if (priority === "urgent") return 50;
  if (priority === "today") return 70;
  return 80;
}

function notificationPriorityLabel(priority: NotificationPriority): string {
  if (priority === "urgent") return PRIORITY_LABELS.urgentNotification;
  if (priority === "today") return PRIORITY_LABELS.todayNotification;
  return PRIORITY_LABELS.generalNotification;
}

function schedulePriority(
  startTime: string | Date,
  now: Date,
  incomplete: boolean
): { rank: number; label: string } {
  if (incomplete) {
    return { rank: 30, label: PRIORITY_LABELS.incompleteSchedule };
  }
  const start = new Date(startTime);
  const hoursUntil = (start.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hoursUntil >= 0 && hoursUntil <= 2) {
    return { rank: 40, label: PRIORITY_LABELS.soonSchedule };
  }
  return { rank: 60, label: PRIORITY_LABELS.todaySchedule };
}

export function buildTodayWorkItems(
  data: TodayWorkDashboardSlice | undefined,
  now = new Date()
): TodayWorkItem[] {
  const items: TodayWorkItem[] = [];
  const seenFollowUpIds = new Set<number>();

  for (const followUp of data?.overdueFollowUps ?? []) {
    seenFollowUpIds.add(followUp.id);
    items.push({
      key: `followup-${followUp.id}`,
      type: "followup",
      id: followUp.id,
      customerId: followUp.customerId,
      customerName: followUp.customerName,
      title: followUp.customerName ?? `고객 #${followUp.customerId}`,
      description: `${followUp.nextAction ?? "연락"} · ${
        followUp.reason ? "후속 사유 기록 있음" : "후속관리"
      }`,
      dueAt: followUp.nextContactDate,
      priorityRank: 10,
      priorityLabel: PRIORITY_LABELS.overdueFollowUp,
      status: followUp.status,
      route: `/customers/${followUp.customerId}?action=quick-followup`,
      primaryActionLabel: "완료",
      taskType: "followUp",
      source: { ...followUp, priorityLabel: PRIORITY_LABELS.overdueFollowUp },
    });
  }

  for (const followUp of data?.todayFollowUps ?? []) {
    if (seenFollowUpIds.has(followUp.id)) continue;
    seenFollowUpIds.add(followUp.id);
    items.push({
      key: `followup-${followUp.id}`,
      type: "followup",
      id: followUp.id,
      customerId: followUp.customerId,
      customerName: followUp.customerName,
      title: followUp.customerName ?? `고객 #${followUp.customerId}`,
      description: `${followUp.nextAction ?? "연락"} · ${
        followUp.reason ? "후속 사유 기록 있음" : "후속관리"
      }`,
      dueAt: followUp.nextContactDate,
      priorityRank: 20,
      priorityLabel: PRIORITY_LABELS.todayFollowUp,
      status: followUp.status,
      route: `/customers/${followUp.customerId}?action=quick-followup`,
      primaryActionLabel: "완료",
      taskType: "followUp",
      source: { ...followUp, priorityLabel: PRIORITY_LABELS.todayFollowUp },
    });
  }

  const incompleteIds = new Set(
    data?.incompleteSchedules?.map(item => item.id)
  );
  const schedules = new Map(
    data?.incompleteSchedules?.map(schedule => [schedule.id, schedule])
  );
  // A same-day incomplete schedule can occur in both server arrays.
  // Prefer today's copy, while retaining its existing incomplete priority/actions.
  for (const schedule of data?.todaySchedules ?? []) {
    schedules.set(schedule.id, schedule);
  }
  const todayStart = getKstDayRange(now).start.getTime();
  for (const schedule of Array.from(schedules.values())) {
    const start =
      typeof schedule.startTime === "string"
        ? parseKstLocalDateTime(schedule.startTime)
        : schedule.startTime;
    const scheduleDayStart = getKstDayRange(start).start.getTime();
    const scheduleBucket =
      scheduleDayStart === todayStart
        ? "today"
        : scheduleDayStart < todayStart
          ? "overdue"
          : undefined;
    // Subtract KST calendar midnights, not elapsed time since the appointment.
    const overdueDays =
      scheduleBucket === "overdue"
        ? Math.max(1, Math.round((todayStart - scheduleDayStart) / 86_400_000))
        : undefined;
    const incomplete = incompleteIds.has(schedule.id);
    const priority = schedulePriority(start, now, incomplete);
    const rank = scheduleBucket === "overdue" ? 30 : priority.rank;
    const label =
      scheduleBucket === "overdue"
        ? "기한 경과"
        : scheduleBucket === "today"
          ? priority.label
          : "일정";
    items.push({
      key: `schedule-${schedule.id}`,
      type: "schedule",
      id: schedule.id,
      customerId: schedule.customerId,
      title: schedule.title,
      description: `${schedule.type ?? "일정"}${incomplete ? " · 미완료" : ""}`,
      dueAt: incomplete
        ? (schedule.endTime ?? schedule.startTime)
        : schedule.startTime,
      scheduleBucket,
      originalScheduledAt: start,
      overdueDays,
      priorityRank: rank,
      priorityLabel: label,
      status: schedule.status,
      route:
        !incomplete && schedule.customerId
          ? `/calendar?customerId=${schedule.customerId}&action=quick-create`
          : "/calendar",
      primaryActionLabel: "완료",
      taskType: "schedule",
      source: { ...schedule, priorityLabel: label },
    });
  }

  for (const notification of data?.pendingNotifications ?? []) {
    const priority = classifyNotificationPriority(notification);
    items.push({
      key: `notification-${notification.id}`,
      type: "notification",
      id: notification.id,
      customerId:
        notification.relatedType === "customer"
          ? notification.relatedId
          : undefined,
      customerName: notification.customerName,
      title: notification.title,
      description: notification.customerName
        ? `${notification.customerName} · ${notification.type}`
        : notification.type,
      dueAt: notification.dueAt ?? notification.createdAt,
      priorityRank: notificationPriorityRank(priority),
      priorityLabel: notificationPriorityLabel(priority),
      status: notification.processStatus,
      route:
        notification.relatedType === "customer" && notification.relatedId
          ? `/customers/${notification.relatedId}`
          : "/notifications",
      primaryActionLabel: "읽음",
      taskType: "notification",
      source: {
        ...notification,
        priorityLabel: notificationPriorityLabel(priority),
      },
    });
  }

  for (const customer of data?.longUnmanagedCustomers ?? []) {
    if (!customer) continue;
    items.push({
      key: `customer-${customer.id}`,
      type: "customer",
      id: customer.id,
      customerId: customer.id,
      customerName: customer.name,
      title: customer.name,
      description: `${customer.consultStatus ?? "고객"} · 장기 미관리 점검`,
      dueAt: customer.createdAt ?? now,
      priorityRank: 90,
      priorityLabel: PRIORITY_LABELS.longUnmanaged,
      status: customer.consultStatus,
      route: `/customers/${customer.id}?action=consult`,
      primaryActionLabel: "연락완료",
      taskType: "customer",
      source: {
        ...customer,
        priorityLabel: PRIORITY_LABELS.longUnmanaged,
      },
    });
  }

  return items.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export function filterTodayWorkItems(
  items: TodayWorkItem[],
  filter: TodayWorkQueueFilter
): TodayWorkItem[] {
  if (filter === "all") return items;
  if (filter === "schedule") {
    return items.filter(
      item => item.type === "schedule" && item.scheduleBucket === "today"
    );
  }
  if (filter === "overdueSchedule") {
    return items.filter(
      item => item.type === "schedule" && item.scheduleBucket === "overdue"
    );
  }
  if (filter === "followup") {
    return items.filter(item => item.type === "followup");
  }
  return items.filter(
    item => item.type === "notification" || item.type === "customer"
  );
}

export function countTodayWorkItemsByFilter(
  items: TodayWorkItem[]
): Record<TodayWorkQueueFilter, number> {
  return {
    all: items.length,
    schedule: filterTodayWorkItems(items, "schedule").length,
    overdueSchedule: filterTodayWorkItems(items, "overdueSchedule").length,
    followup: items.filter(item => item.type === "followup").length,
    notification: items.filter(
      item => item.type === "notification" || item.type === "customer"
    ).length,
  };
}
