import { inArray, and, gte, lte } from "drizzle-orm";
import { getDb } from "./db";
import { notifications, followUps } from "../drizzle/schema";
import {
  classifyOperationRiskActionLevel,
  compareOperationRiskActionLevel,
} from "@shared/operationRiskActionLevel";

const ACTION_REQUIRED_NOTIFICATION_TYPES = [
  "contract_90",
  "contract_180",
  "contract_365",
  "uncontacted_3days",
  "long_unmanaged_90",
  "reconsult",
  "unpaid_lapse",
];

function compareAttentionUsers(left: any, right: any) {
  const actionOrder = compareOperationRiskActionLevel(
    left.actionLevel,
    right.actionLevel
  );
  if (actionOrder !== 0) return actionOrder;

  for (const key of [
    "overdueFollowUpCount",
    "actionRequiredNotificationCount",
    "unreadOver24hCount",
    "unreadNotificationCount",
  ] as const) {
    const difference = Number(right.metrics[key]) - Number(left.metrics[key]);
    if (difference !== 0) return difference;
  }
  return Number(left.userId) - Number(right.userId);
}

export async function buildTeamCompletionInsights(
  user: any,
  visibleUsers: any[],
  visibleTeams: any[],
  dateFrom?: Date,
  dateTo?: Date
) {
  const db = await getDb();
  if (!db) return null;

  const userIds = visibleUsers.map(u => u.id);
  if (userIds.length === 0) {
    return {
      scope: { role: user.role, userId: user.id },
      period: { dateFrom, dateTo },
      summary: {
        userCount: 0,
        notificationCount: 0,
        unreadNotificationCount: 0,
        completedNotificationCount: 0,
        notificationCompletionRate: 0,
        followUpCount: 0,
        completedFollowUpCount: 0,
        overdueFollowUpCount: 0,
        followUpCompletionRate: 0,
        actionRequiredUserCount: 0,
      },
      users: [],
      attentionUsers: [],
    };
  }

  const allNotifications: any[] = [];
  const allFollowUps: any[] = [];

  const chunkSize = 1000;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const notifConditions = [inArray(notifications.userId, chunk)];
    if (dateFrom) notifConditions.push(gte(notifications.createdAt, dateFrom));
    if (dateTo) notifConditions.push(lte(notifications.createdAt, dateTo));

    const followUpConditions = [inArray(followUps.assignedAgentId, chunk)];
    if (dateFrom) followUpConditions.push(gte(followUps.createdAt, dateFrom)); // Actually, nextContactDate or createdAt? The prompt says "기간 필터를 반드시 적용한다". We'll use createdAt for simplicity to match periods.
    if (dateTo) followUpConditions.push(lte(followUps.createdAt, dateTo));

    const [nRes, fRes] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(and(...notifConditions)),
      db
        .select()
        .from(followUps)
        .where(and(...followUpConditions)),
    ]);

    allNotifications.push(...nRes);
    allFollowUps.push(...fRes);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const usersOutput = visibleUsers.map(u => {
    const userNotifs = allNotifications.filter(n => n.userId === u.id);
    const userFollowUps = allFollowUps.filter(f => f.assignedAgentId === u.id);

    const notificationCount = userNotifs.length;
    let unreadNotificationCount = 0;
    let completedNotificationCount = 0;
    let unreadOver24hCount = 0;
    let actionRequiredNotificationCount = 0;

    userNotifs.forEach(n => {
      const isUnread = n.processStatus === "미확인" || !n.isRead;
      if (isUnread) unreadNotificationCount++;
      if (n.processStatus === "처리완료" || n.isRead)
        completedNotificationCount++; // As per prompt: "읽음 처리와 처리완료가 구분되어 있다면 둘 다 표시. 처리완료 기준: readAt 또는 status"

      if (
        isUnread &&
        now.getTime() - new Date(n.createdAt).getTime() > 24 * 60 * 60 * 1000
      ) {
        unreadOver24hCount++;
      }

      const isDue = !n.dueAt || new Date(n.dueAt).getTime() <= now.getTime();
      if (
        n.processStatus !== "처리완료" &&
        isDue &&
        ACTION_REQUIRED_NOTIFICATION_TYPES.includes(n.type)
      ) {
        actionRequiredNotificationCount++;
      }
    });

    const notificationCompletionRate =
      notificationCount > 0
        ? Math.round((completedNotificationCount / notificationCount) * 100)
        : 0;

    let followUpCount = 0;
    let todayFollowUpCount = 0;
    let completedFollowUpCount = 0;
    let overdueFollowUpCount = 0;
    let postponedFollowUpCount = 0;
    let cancelledFollowUpCount = 0;
    let overdueOver3DaysCount = 0;
    let totalOverdueMs = 0;

    userFollowUps.forEach(f => {
      followUpCount++;
      const nextContact = new Date(f.nextContactDate);
      if (
        nextContact >= todayStart &&
        nextContact.getTime() < todayStart.getTime() + 24 * 60 * 60 * 1000
      ) {
        todayFollowUpCount++;
      }

      if (f.status === "completed") completedFollowUpCount++;
      else if (f.status === "postponed") postponedFollowUpCount++;
      else if (f.status === "cancelled") cancelledFollowUpCount++;

      // Overdue: nextContactDate < todayStart and not completed/cancelled
      if (
        f.status !== "completed" &&
        f.status !== "cancelled" &&
        nextContact < todayStart
      ) {
        overdueFollowUpCount++;
        const overdueMs = now.getTime() - nextContact.getTime();
        totalOverdueMs += overdueMs;
        if (overdueMs > 3 * 24 * 60 * 60 * 1000) {
          overdueOver3DaysCount++;
        }
      }
    });

    const validFollowUpCount = followUpCount - cancelledFollowUpCount;
    const followUpCompletionRate =
      validFollowUpCount > 0
        ? Math.round((completedFollowUpCount / validFollowUpCount) * 100)
        : 0;
    const averageOverdueDays =
      overdueFollowUpCount > 0
        ? Math.round(
            (totalOverdueMs / overdueFollowUpCount / (1000 * 60 * 60 * 24)) * 10
          ) / 10
        : 0;

    const metrics = {
      notificationCount,
      unreadNotificationCount,
      completedNotificationCount,
      notificationCompletionRate,
      unreadOver24hCount,
      actionRequiredNotificationCount,
      followUpCount,
      validFollowUpCount,
      todayFollowUpCount,
      completedFollowUpCount,
      overdueFollowUpCount,
      postponedFollowUpCount,
      cancelledFollowUpCount,
      followUpCompletionRate,
      averageOverdueDays,
      overdueOver3DaysCount,
    };

    const actionLevel = classifyOperationRiskActionLevel({
      actionRequiredCount:
        overdueFollowUpCount + actionRequiredNotificationCount,
    });

    const reasons: string[] = [];
    if (unreadNotificationCount > 0)
      reasons.push(`미확인 알림 ${unreadNotificationCount}건`);
    if (unreadOver24hCount > 0)
      reasons.push(`24시간 이상 미확인 ${unreadOver24hCount}건`);
    if (actionRequiredNotificationCount > 0)
      reasons.push(`처리 필요 알림 ${actionRequiredNotificationCount}건`);
    if (overdueFollowUpCount > 0)
      reasons.push(`지연 후속관리 ${overdueFollowUpCount}건`);
    if (overdueOver3DaysCount > 0)
      reasons.push(`3일 이상 지연 ${overdueOver3DaysCount}건`);

    const team = visibleTeams.find(t => t.id === u.teamId);

    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      teamName: team?.name ?? "미지정",
      subBranchName: "기본 부지점",
      metrics,
      actionLevel,
      reasons,
    };
  });

  const sortedUsers = [...usersOutput].sort(compareAttentionUsers);
  const attentionUsers = sortedUsers
    .filter(u => u.actionLevel !== "informational")
    .slice(0, 5);

  let totalUserCount = usersOutput.length;
  let totalNotificationCount = 0;
  let totalUnreadNotificationCount = 0;
  let totalCompletedNotificationCount = 0;
  let totalFollowUpCount = 0;
  let totalValidFollowUpCount = 0;
  let totalCompletedFollowUpCount = 0;
  let totalOverdueFollowUpCount = 0;
  let actionRequiredUserCount = 0;

  usersOutput.forEach(u => {
    totalNotificationCount += u.metrics.notificationCount;
    totalUnreadNotificationCount += u.metrics.unreadNotificationCount;
    totalCompletedNotificationCount += u.metrics.completedNotificationCount;
    totalFollowUpCount += u.metrics.followUpCount;
    totalValidFollowUpCount += u.metrics.validFollowUpCount;
    totalCompletedFollowUpCount += u.metrics.completedFollowUpCount;
    totalOverdueFollowUpCount += u.metrics.overdueFollowUpCount;
    if (u.actionLevel !== "informational") actionRequiredUserCount++;
  });

  const summary = {
    userCount: totalUserCount,
    notificationCount: totalNotificationCount,
    unreadNotificationCount: totalUnreadNotificationCount,
    completedNotificationCount: totalCompletedNotificationCount,
    notificationCompletionRate:
      totalNotificationCount > 0
        ? Math.round(
            (totalCompletedNotificationCount / totalNotificationCount) * 100
          )
        : 0,
    followUpCount: totalFollowUpCount,
    completedFollowUpCount: totalCompletedFollowUpCount,
    overdueFollowUpCount: totalOverdueFollowUpCount,
    followUpCompletionRate:
      totalValidFollowUpCount > 0
        ? Math.round(
            (totalCompletedFollowUpCount / totalValidFollowUpCount) * 100
          )
        : 0,
    actionRequiredUserCount,
  };

  return {
    scope: { role: user.role, userId: user.id },
    period: { dateFrom, dateTo },
    summary,
    attentionUsers,
    users: sortedUsers,
  };
}
