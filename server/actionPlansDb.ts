import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  branchActionPlans,
  dailyActionPlans,
  executiveActionPlanReports,
  InsertBranchActionPlan,
  InsertDailyActionPlan,
  InsertExecutiveActionPlanReport,
  InsertWeeklyActionPlan,
  weeklyActionPlans,
} from "../drizzle/schema";
import { getDb } from "./db";

export async function getBranchActionPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(branchActionPlans)
    .where(eq(branchActionPlans.id, id))
    .limit(1);
  return rows[0];
}

export async function getBranchActionPlanByUserMonth(
  userId: number,
  targetMonth: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(branchActionPlans)
    .where(
      and(
        eq(branchActionPlans.userId, userId),
        eq(branchActionPlans.targetMonth, targetMonth)
      )
    )
    .limit(1);
  return rows[0];
}

export async function getBranchActionPlansByUserIds(
  userIds: number[],
  targetMonth: string
) {
  const db = await getDb();
  if (!db || userIds.length === 0) return [];
  return db
    .select()
    .from(branchActionPlans)
    .where(
      and(
        inArray(branchActionPlans.userId, userIds),
        eq(branchActionPlans.targetMonth, targetMonth)
      )
    );
}

export async function getBranchActionPlansByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(branchActionPlans)
    .where(eq(branchActionPlans.userId, userId))
    .orderBy(desc(branchActionPlans.targetMonth));
}

export async function createBranchActionPlan(data: InsertBranchActionPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(branchActionPlans).values(data);
  const id = Number(result[0].insertId);
  return getBranchActionPlanById(id);
}

export async function updateBranchActionPlan(
  id: number,
  data: Partial<InsertBranchActionPlan>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(branchActionPlans)
    .set(data)
    .where(eq(branchActionPlans.id, id));
  return getBranchActionPlanById(id);
}

export async function getWeeklyActionPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(weeklyActionPlans)
    .where(eq(weeklyActionPlans.id, id))
    .limit(1);
  return rows[0];
}

export async function getWeeklyActionPlansByMonthlyPlanId(monthlyPlanId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(weeklyActionPlans)
    .where(eq(weeklyActionPlans.monthlyPlanId, monthlyPlanId))
    .orderBy(weeklyActionPlans.weekStartDate);
}

export async function getWeeklyActionPlansByUserIds(
  userIds: number[],
  targetMonth: string
) {
  const db = await getDb();
  if (!db || userIds.length === 0) return [];
  return db
    .select({
      plan: weeklyActionPlans,
      monthlyPlanId: branchActionPlans.id,
      targetMonth: branchActionPlans.targetMonth,
    })
    .from(weeklyActionPlans)
    .innerJoin(
      branchActionPlans,
      eq(weeklyActionPlans.monthlyPlanId, branchActionPlans.id)
    )
    .where(
      and(
        inArray(weeklyActionPlans.userId, userIds),
        eq(branchActionPlans.targetMonth, targetMonth)
      )
    )
    .orderBy(weeklyActionPlans.weekStartDate);
}

export async function getWeeklyActionPlanByUserMonthWeek(
  userId: number,
  targetMonth: string,
  weekNumber: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(weeklyActionPlans)
    .where(
      and(
        eq(weeklyActionPlans.userId, userId),
        eq(weeklyActionPlans.targetMonth, targetMonth),
        eq(weeklyActionPlans.weekNumber, weekNumber)
      )
    )
    .limit(1);
  return rows[0];
}

export async function getDailyActionPlanByWeeklyDate(
  weeklyPlanId: number,
  planDate: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(dailyActionPlans)
    .where(
      and(
        eq(dailyActionPlans.weeklyPlanId, weeklyPlanId),
        eq(dailyActionPlans.planDate, sql`${planDate}`)
      )
    )
    .limit(1);
  return rows[0];
}

export async function createWeeklyActionPlan(data: InsertWeeklyActionPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(weeklyActionPlans).values(data);
  const id = Number(result[0].insertId);
  return getWeeklyActionPlanById(id);
}

export async function updateWeeklyActionPlan(
  id: number,
  data: Partial<InsertWeeklyActionPlan>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(weeklyActionPlans)
    .set(data)
    .where(eq(weeklyActionPlans.id, id));
  return getWeeklyActionPlanById(id);
}

export async function getDailyActionPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(dailyActionPlans)
    .where(eq(dailyActionPlans.id, id))
    .limit(1);
  return rows[0];
}

export async function getDailyActionPlansByWeeklyPlanId(weeklyPlanId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyActionPlans)
    .where(eq(dailyActionPlans.weeklyPlanId, weeklyPlanId))
    .orderBy(dailyActionPlans.planDate);
}

export async function getDailyActionPlansByUserIdsInRange(
  userIds: number[],
  dateFrom: string,
  dateTo: string
) {
  const db = await getDb();
  if (!db || userIds.length === 0) return [];
  return db
    .select({ plan: dailyActionPlans })
    .from(dailyActionPlans)
    .where(
      and(
        inArray(dailyActionPlans.userId, userIds),
        gte(dailyActionPlans.planDate, sql`${dateFrom}`),
        lte(dailyActionPlans.planDate, sql`${dateTo}`)
      )
    )
    .orderBy(dailyActionPlans.planDate);
}

export async function createDailyActionPlan(data: InsertDailyActionPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(dailyActionPlans).values(data);
  const id = Number(result[0].insertId);
  return getDailyActionPlanById(id);
}

export async function updateDailyActionPlan(
  id: number,
  data: Partial<InsertDailyActionPlan>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(dailyActionPlans)
    .set(data)
    .where(eq(dailyActionPlans.id, id));
  return getDailyActionPlanById(id);
}

export async function createExecutiveActionPlanReport(
  data: InsertExecutiveActionPlanReport
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(executiveActionPlanReports).values(data);
  const id = Number(result[0].insertId);
  const rows = await db
    .select()
    .from(executiveActionPlanReports)
    .where(eq(executiveActionPlanReports.id, id))
    .limit(1);
  return rows[0];
}

export async function getWeeklyPlansForMonthByUserIds(
  userIds: number[],
  targetMonth: string
) {
  const monthlyPlans = await getBranchActionPlansByUserIds(userIds, targetMonth);
  if (monthlyPlans.length === 0) return [];
  const monthlyIds = monthlyPlans.map(p => p.id);
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(weeklyActionPlans)
    .where(inArray(weeklyActionPlans.monthlyPlanId, monthlyIds))
    .orderBy(weeklyActionPlans.weekStartDate);
}

export async function getDailyPlansForWeeklyIds(weeklyPlanIds: number[]) {
  const db = await getDb();
  if (!db || weeklyPlanIds.length === 0) return [];
  return db
    .select()
    .from(dailyActionPlans)
    .where(inArray(dailyActionPlans.weeklyPlanId, weeklyPlanIds))
    .orderBy(dailyActionPlans.planDate);
}
