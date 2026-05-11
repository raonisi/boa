/**
 * 알림 자동 생성 서비스
 * - 중복 방지: notifications 테이블의 uq_notification unique 제약 활용
 * - INSERT IGNORE 패턴으로 중복 시 에러 없이 스킵
 */
import { addDays, addMonths, addYears, setMonth, setDate, startOfDay } from "date-fns";
import { getDb } from "./db";
import { notifications, customers, contracts, schedules, users } from "../drizzle/schema";
import { eq, and, lt, isNull, lte } from "drizzle-orm";

type NotifType = typeof notifications.$inferInsert["type"];

/**
 * 알림을 중복 없이 생성한다.
 * uq_notification 제약이 있으므로 INSERT IGNORE를 사용한다.
 */
export async function createNotificationSafe(data: {
  userId: number;
  type: NotifType;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: number;
  dueAt?: Date;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Drizzle doesn't support INSERT IGNORE natively, use raw SQL
    const conn = (db as any).session?.client ?? (db as any)._client;
    if (conn) {
      await conn.execute(
        `INSERT IGNORE INTO notifications (userId, type, title, message, relatedType, relatedId, dueAt, isRead, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, false, NOW())`,
        [
          data.userId,
          data.type,
          data.title,
          data.message,
          data.relatedType ?? null,
          data.relatedId ?? null,
          data.dueAt ?? null,
        ]
      );
    } else {
      // Fallback: use drizzle insert (may throw on duplicate)
      await db.insert(notifications).values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedType: data.relatedType,
        relatedId: data.relatedId,
        dueAt: data.dueAt,
      });
    }
    return true;
  } catch (err: any) {
    // Duplicate entry → silently skip
    if (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062) return false;
    console.error("[Notification] Failed to create:", err);
    return false;
  }
}

/**
 * 계약 생성 시 → 90/180/365일 점검 알림 자동 생성
 */
export async function createContractReminders(
  contractId: number,
  agentId: number,
  contractDate: Date,
  customerName: string
): Promise<void> {
  const milestones: Array<{ days: number; type: NotifType; label: string }> = [
    { days: 90, type: "contract_90", label: "진단비 효력 점검" },
    { days: 180, type: "contract_180", label: "계약 점검" },
    { days: 365, type: "contract_365", label: "보장조건 점검" },
  ];

  for (const m of milestones) {
    const dueAt = addDays(contractDate, m.days);
    await createNotificationSafe({
      userId: agentId,
      type: m.type,
      title: `[${m.label}] ${customerName}`,
      message: `계약일로부터 ${m.days}일이 경과했습니다. ${m.label}을 진행해 주세요.`,
      relatedType: "contract",
      relatedId: contractId,
      dueAt,
    });
  }
}

/**
 * 고객 배정 시 → 생일 알림 자동 생성
 */
export async function createBirthdayReminder(
  customerId: number,
  agentId: number,
  birthDate: Date,
  customerName: string
): Promise<void> {
  const now = new Date();
  // 올해 생일
  let nextBirthday = setDate(setMonth(now, birthDate.getMonth()), birthDate.getDate());
  if (nextBirthday <= now) {
    nextBirthday = addYears(nextBirthday, 1);
  }

  await createNotificationSafe({
    userId: agentId,
    type: "birthday",
    title: `[생일] ${customerName}`,
    message: `${customerName} 고객의 생일입니다. 생일 축하 연락을 드려보세요.`,
    relatedType: "customer",
    relatedId: customerId,
    dueAt: startOfDay(nextBirthday),
  });
}

/**
 * 재상담 예정일 입력 시 → 재상담 알림 생성
 */
export async function createReconsultReminder(
  customerId: number,
  agentId: number,
  nextContactAt: Date,
  customerName: string
): Promise<void> {
  await createNotificationSafe({
    userId: agentId,
    type: "reconsult",
    title: `[재상담] ${customerName}`,
    message: `${customerName} 고객과의 재상담 예정일입니다.`,
    relatedType: "customer",
    relatedId: customerId,
    dueAt: nextContactAt,
  });
}

/**
 * 납입상태 변경 시 → 미납/실효/해지 알림 생성
 */
export async function createPaymentStatusReminder(
  contractId: number,
  agentId: number,
  status: string,
  customerName: string
): Promise<void> {
  if (!["미납", "실효", "해지"].includes(status)) return;

  await createNotificationSafe({
    userId: agentId,
    type: "unpaid_lapse",
    title: `[${status}] ${customerName}`,
    message: `${customerName} 고객의 계약이 ${status} 상태로 변경되었습니다. 관리가 필요합니다.`,
    relatedType: "contract",
    relatedId: contractId,
    dueAt: new Date(),
  });
}

/**
 * 일정 등록 시 → 하루 전/당일/1시간 전 알림 생성
 */
export async function createScheduleReminders(
  scheduleId: number,
  userId: number,
  startTime: Date,
  title: string,
  reminderDayBefore: boolean,
  reminderSameDay: boolean,
  reminderOneHourBefore: boolean
): Promise<void> {
  if (reminderDayBefore) {
    const dueAt = addDays(startTime, -1);
    if (dueAt > new Date()) {
      await createNotificationSafe({
        userId,
        type: "schedule_1day",
        title: `[일정 D-1] ${title}`,
        message: `내일 일정이 있습니다: ${title}`,
        relatedType: "schedule",
        relatedId: scheduleId,
        dueAt,
      });
    }
  }

  if (reminderSameDay) {
    const dueAt = startOfDay(startTime);
    if (dueAt > new Date()) {
      await createNotificationSafe({
        userId,
        type: "schedule_today",
        title: `[오늘 일정] ${title}`,
        message: `오늘 일정이 있습니다: ${title}`,
        relatedType: "schedule",
        relatedId: scheduleId,
        dueAt,
      });
    }
  }

  if (reminderOneHourBefore) {
    const dueAt = new Date(startTime.getTime() - 60 * 60 * 1000);
    if (dueAt > new Date()) {
      await createNotificationSafe({
        userId,
        type: "schedule_1hour",
        title: `[1시간 전] ${title}`,
        message: `1시간 후 일정이 있습니다: ${title}`,
        relatedType: "schedule",
        relatedId: scheduleId,
        dueAt,
      });
    }
  }
}

/**
 * 배정 후 3일 미상담 알림 (서버 사이드 체크용)
 * 배정 시 즉시 3일 후 알림을 예약한다.
 */
export async function createUncontactedReminder(
  customerId: number,
  agentId: number,
  assignedAt: Date,
  customerName: string
): Promise<void> {
  const dueAt = addDays(assignedAt, 3);
  await createNotificationSafe({
    userId: agentId,
    type: "uncontacted_3days",
    title: `[미상담 3일] ${customerName}`,
    message: `${customerName} 고객이 배정된 지 3일이 경과했습니다. 첫 상담을 진행해 주세요.`,
    relatedType: "customer",
    relatedId: customerId,
    dueAt,
  });
}
