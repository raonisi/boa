import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  date,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "manager", "agent", "inactive"]).default("agent").notNull(),
  teamId: int("teamId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Teams ───────────────────────────────────────────────────────────────────
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  managerId: int("managerId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Team = typeof teams.$inferSelect;

// ─── Customers ───────────────────────────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  birthDate: date("birthDate"),
  gender: mysqlEnum("gender", ["male", "female", "other"]),
  region: varchar("region", { length: 100 }),
  expectedPremium: int("expectedPremium"),
  availableTime: varchar("availableTime", { length: 100 }),
  source: varchar("source", { length: 100 }),
  agentId: int("agentId"),
  assignedAt: timestamp("assignedAt"),
  privacyConsent: boolean("privacyConsent").default(false),
  marketingConsent: boolean("marketingConsent").default(false),
  memo: text("memo"),
  consultStatus: mysqlEnum("consultStatus", [
    "미상담",
    "부재",
    "통화완료",
    "상담예정",
    "설계중",
    "계약",
    "보류",
    "거절",
    "해지관리",
    "재상담필요",
  ]).default("미상담").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Consultations ────────────────────────────────────────────────────────────
export const consultations = mysqlTable("consultations", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  agentId: int("agentId").notNull(),
  status: mysqlEnum("status", [
    "미상담",
    "부재",
    "통화완료",
    "상담예정",
    "설계중",
    "계약",
    "보류",
    "거절",
    "해지관리",
    "재상담필요",
  ]).notNull(),
  content: text("content"),
  nextContactAt: timestamp("nextContactAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;

// ─── Contracts ────────────────────────────────────────────────────────────────
export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  agentId: int("agentId").notNull(),
  company: varchar("company", { length: 100 }),
  productName: varchar("productName", { length: 200 }),
  productGroup: varchar("productGroup", { length: 100 }),
  contractDate: date("contractDate"),
  monthlyPremium: int("monthlyPremium"),
  paymentStatus: mysqlEnum("paymentStatus", ["정상", "미납", "실효", "해지"]).default("정상"),
  contractStatus: mysqlEnum("contractStatus", ["청약", "성립", "철회", "유지", "해지"]).default("청약"),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── Schedules ────────────────────────────────────────────────────────────────
export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  type: mysqlEnum("type", [
    "고객상담",
    "재통화",
    "계약예정",
    "보장분석",
    "해지방어",
    "팀회의",
    "교육",
    "외근",
    "휴무",
    "기타",
  ]).default("기타").notNull(),
  status: mysqlEnum("status", ["예정", "완료", "취소", "변경", "노쇼", "보류"]).default("예정").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "contract_90",
    "contract_180",
    "contract_365",
    "birthday",
    "uncontacted_3days",
    "long_unmanaged_90",
    "reconsult",
    "unpaid_lapse",
    "schedule_1day",
    "schedule_today",
    "schedule_1hour",
    "schedule_incomplete",
  ]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  relatedType: varchar("relatedType", { length: 50 }),
  relatedId: int("relatedId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Activity Logs ────────────────────────────────────────────────────────────
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;
