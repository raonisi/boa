import {
  NOTIFICATION_TODAY_TYPES,
  NOTIFICATION_URGENT_TYPES,
  type NotificationPriority,
} from "@shared/notificationActionCenter";

export type { NotificationPriority } from "@shared/notificationActionCenter";

const urgentTypes = new Set<string>(NOTIFICATION_URGENT_TYPES);
const todayTypes = new Set<string>(NOTIFICATION_TODAY_TYPES);

export function classifyNotificationPriority(notification: {
  type: string;
  dueAt?: string | Date | null;
}): NotificationPriority {
  if (urgentTypes.has(notification.type)) return "urgent";
  if (todayTypes.has(notification.type)) return "today";

  if (notification.dueAt) {
    const due = new Date(notification.dueAt);
    if (!Number.isNaN(due.getTime())) {
      const now = new Date();
      const dueDateOnly = new Date(
        due.getFullYear(),
        due.getMonth(),
        due.getDate()
      );
      const todayOnly = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      if (dueDateOnly.getTime() <= todayOnly.getTime()) return "today";
    }
  }
  return "general";
}

export function priorityWeight(priority: NotificationPriority): number {
  if (priority === "urgent") return 0;
  if (priority === "today") return 1;
  return 2;
}

export type SortableNotification = {
  type: string;
  dueAt?: string | Date | null;
  createdAt: string | Date;
  isRead?: boolean | number | null;
};

export function sortNotificationsForQueue<T extends SortableNotification>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const pa = classifyNotificationPriority(a);
    const pb = classifyNotificationPriority(b);
    const weightDiff = priorityWeight(pa) - priorityWeight(pb);
    if (weightDiff !== 0) return weightDiff;

    const unreadDiff = Number(Boolean(a.isRead)) - Number(Boolean(b.isRead));
    if (unreadDiff !== 0) return unreadDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
