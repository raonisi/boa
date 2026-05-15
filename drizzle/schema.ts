import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  date,
  unique,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["branch_admin", "sub_branch_admin", "team_leader", "member"]).default("member").notNull(),
  accountStatus: mysqlEnum("accountStatus", ["active", "inactive", "resigned"]).default("active").notNull(),
  loginStatus: mysqlEnum("loginStatus", ["invited", "linked"]).default("linked"),
  phone: varchar("phone", { length: 20 }),
  memo: text("memo"),
  parentUserId: int("parentUserId"),
  teamId: int("teamId"),
  subBranchAdminId: int("subBranchAdminId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  sessionInvalidatedAt: timestamp("sessionInvalidatedAt"),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Teams ───────────────────────────────────────────────────────────────────
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  managerId: int("managerId"),
  subBranchAdminId: int("subBranchAdminId"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Team = typeof teams.$inferSelect;

// ─── Settings (마스터 데이터) ─────────────────────────────────────────────────
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 50 }).notNull(),
  value: varchar("value", { length: 200 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

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
  assignedTeamId: int("assignedTeamId"),
  assignedAt: timestamp("assignedAt"),
  subBranchAdminId: int("subBranchAdminId"),
  assignmentStatus: mysqlEnum("assignmentStatus", ["unassigned", "assigned_to_sub_branch", "assigned_to_agent"]).default("unassigned").notNull(),
  importBatchId: varchar("importBatchId", { length: 100 }),
  importedBy: int("importedBy"),
  importedAt: timestamp("importedAt"),
  consultStatus: mysqlEnum("consultStatus", [
    "미상담", "부재", "통화완료", "상담예정", "설계중",
    "계약", "보류", "거절", "해지관리", "재상담필요",
  ]).default("미상담").notNull(),
  priority: mysqlEnum("priority", ["A", "B", "C", "D", "unclassified"]).default("unclassified").notNull(),
  customerTags: text("customerTags"),
  nextAction: varchar("nextAction", { length: 100 }),
  memo: text("memo"),
  privacyConsent: boolean("privacyConsent").default(false),
  marketingConsent: boolean("marketingConsent").default(false),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  mergedIntoCustomerId: int("mergedIntoCustomerId"),
  mergedAt: timestamp("mergedAt"),
  mergedBy: int("mergedBy"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Status History ───────────────────────────────────────────────────────────
export const statusHistory = mysqlTable("status_history", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  changedBy: int("changedBy").notNull(),
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StatusHistory = typeof statusHistory.$inferSelect;
export type InsertStatusHistory = typeof statusHistory.$inferInsert;

// ─── Consent Logs ─────────────────────────────────────────────────────────────
export const consentLogs = mysqlTable("consent_logs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  changedBy: int("changedBy").notNull(),
  consentType: mysqlEnum("consentType", ["privacy", "marketing"]).notNull(),
  previousValue: boolean("previousValue"),
  newValue: boolean("newValue").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ConsentLog = typeof consentLogs.$inferSelect;
export type InsertConsentLog = typeof consentLogs.$inferInsert;

// ─── Consultations ────────────────────────────────────────────────────────────
export const consultations = mysqlTable("consultations", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  agentId: int("agentId").notNull(),
  status: mysqlEnum("status", [
    "미상담", "부재", "통화완료", "상담예정", "설계중",
    "계약", "보류", "거절", "해지관리", "재상담필요",
  ]).notNull(),
  consultationType: varchar("consultationType", { length: 100 }),
  customerNeed: varchar("customerNeed", { length: 100 }),
  nextAction: varchar("nextAction", { length: 100 }),
  summary: varchar("summary", { length: 200 }),
  content: text("content"),
  nextContactAt: timestamp("nextContactAt"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;

export const consultationChecklists = mysqlTable("consultation_checklists", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  phase: mysqlEnum("phase", ["before", "during", "after"]).notNull(),
  category: mysqlEnum("category", ["basic", "needs", "coverage", "premium", "family", "follow_up", "compliance"]).default("basic").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isRequired: boolean("isRequired").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ConsultationChecklist = typeof consultationChecklists.$inferSelect;
export type InsertConsultationChecklist = typeof consultationChecklists.$inferInsert;

export const consultationCheckResults = mysqlTable("consultation_check_results", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  checklistId: int("checklistId").notNull(),
  consultationId: int("consultationId"),
  checked: boolean("checked").default(false).notNull(),
  checkedAt: timestamp("checkedAt"),
  checkedBy: int("checkedBy"),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ConsultationCheckResult = typeof consultationCheckResults.$inferSelect;
export type InsertConsultationCheckResult = typeof consultationCheckResults.$inferInsert;

export const messageTemplates = mysqlTable("message_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  situation: mysqlEnum("situation", [
    "missed_call", "proposal_follow_up", "pre_contract_check", "post_contract_care", "long_unmanaged",
    "birthday", "follow_up_schedule", "document_request", "after_consultation", "general_check",
  ]).notNull(),
  channel: mysqlEnum("channel", ["kakao", "sms", "both"]).default("both").notNull(),
  body: text("body").notNull(),
  complianceNote: text("complianceNote"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

export const customerHandoffNotes = mysqlTable("customer_handoff_notes", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  noteType: mysqlEnum("noteType", ["handoff", "caution", "approach", "avoid", "relationship", "next_action"]).default("handoff").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  visibility: mysqlEnum("visibility", ["internal"]).default("internal").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustomerHandoffNote = typeof customerHandoffNotes.$inferSelect;
export type InsertCustomerHandoffNote = typeof customerHandoffNotes.$inferInsert;

export const consultationScripts = mysqlTable("consultation_scripts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  category: mysqlEnum("category", [
    "first_call", "missed_call", "premium_burden", "coverage_concern", "family_responsibility",
    "surrender_risk", "proposal_follow_up", "post_contract_care", "long_unmanaged", "general_check",
  ]).notNull(),
  scriptBody: text("scriptBody").notNull(),
  complianceNote: text("complianceNote"),
  tags: text("tags"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ConsultationScript = typeof consultationScripts.$inferSelect;
export type InsertConsultationScript = typeof consultationScripts.$inferInsert;

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
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

export const importBatches = mysqlTable("import_batches", {
  id: int("id").autoincrement().primaryKey(),
  importBatchId: varchar("importBatchId", { length: 100 }).notNull().unique(),
  fileName: varchar("fileName", { length: 255 }),
  uploadedBy: int("uploadedBy").notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  successRows: int("successRows").default(0).notNull(),
  failedRows: int("failedRows").default(0).notNull(),
  duplicateRows: int("duplicateRows").default(0).notNull(),
  blockedForbiddenColumn: boolean("blockedForbiddenColumn").default(false).notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "partially_cancelled", "failed"]).default("active").notNull(),
  cancelledBy: int("cancelledBy"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ImportBatch = typeof importBatches.$inferSelect;
export type InsertImportBatch = typeof importBatches.$inferInsert;

export const deleteRequests = mysqlTable("delete_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestType: mysqlEnum("requestType", ["contract_delete"]).default("contract_delete").notNull(),
  targetType: mysqlEnum("targetType", ["contract"]).default("contract").notNull(),
  targetId: int("targetId").notNull(),
  customerId: int("customerId").notNull(),
  requestedBy: int("requestedBy").notNull(),
  requestReason: varchar("requestReason", { length: 100 }).notNull(),
  requestMemo: text("requestMemo"),
  expectedImpact: mysqlEnum("expectedImpact", ["performance_exclusion"]).default("performance_exclusion").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewComment: text("reviewComment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DeleteRequest = typeof deleteRequests.$inferSelect;
export type InsertDeleteRequest = typeof deleteRequests.$inferInsert;

// ─── Schedules ────────────────────────────────────────────────────────────────
export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  assignedAgentId: int("assignedAgentId"),
  teamId: int("teamId"),
  subBranchAdminId: int("subBranchAdminId"),
  nextContactDate: timestamp("nextContactDate").notNull(),
  reason: varchar("reason", { length: 200 }).notNull(),
  nextAction: mysqlEnum("nextAction", ["전화", "카톡", "문자", "방문", "설계안 발송", "계약 확인", "보장분석", "사후관리", "기타"]).default("전화").notNull(),
  status: mysqlEnum("status", ["scheduled", "completed", "postponed", "cancelled"]).default("scheduled").notNull(),
  memo: text("memo"),
  completedAt: timestamp("completedAt"),
  completedBy: int("completedBy"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});
export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;

export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  teamId: int("teamId"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", [
    "고객상담", "재통화", "계약예정", "보장분석", "해지방어",
    "팀회의", "교육", "외근", "휴무", "기타",
  ]).default("기타").notNull(),
  status: mysqlEnum("status", ["예정", "완료", "취소", "변경", "노쇼", "보류"]).default("예정").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  completedAt: timestamp("completedAt"),
  memo: text("memo"),
  reminderDayBefore: boolean("reminderDayBefore").default(true),
  reminderSameDay: boolean("reminderSameDay").default(true),
  reminderOneHourBefore: boolean("reminderOneHourBefore").default(true),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

// ─── Reminders ────────────────────────────────────────────────────────────────
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "contract_90", "contract_180", "contract_365",
    "birthday",
    "uncontacted_3days", "long_unmanaged_90",
    "reconsult", "unpaid_lapse",
    "schedule_1day", "schedule_today", "schedule_1hour", "schedule_incomplete",
  ]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  relatedType: varchar("relatedType", { length: 50 }),
  relatedId: int("relatedId"),
  dueAt: timestamp("dueAt"),
  isRead: boolean("isRead").default(false).notNull(),
  isSent: boolean("isSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(table) => ({
  uniqueReminder: unique("uq_reminder").on(table.userId, table.type, table.relatedType, table.relatedId, table.dueAt),
}));
export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "contract_90", "contract_180", "contract_365",
    "birthday",
    "uncontacted_3days", "long_unmanaged_90",
    "reconsult", "unpaid_lapse",
    "schedule_1day", "schedule_today", "schedule_1hour", "schedule_incomplete",
    "customer_assigned", "general",
  ]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  relatedType: varchar("relatedType", { length: 50 }),
  relatedId: int("relatedId"),
  dueAt: timestamp("dueAt"),
  isRead: boolean("isRead").default(false).notNull(),
  processStatus: mysqlEnum("processStatus", ["미확인", "확인", "처리완료", "보류"]).default("미확인").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(table) => ({
  uniqueNotif: unique("uq_notification").on(table.userId, table.type, table.relatedType, table.relatedId, table.dueAt),
}));
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Assignment History ───────────────────────────────────────────────────────
export const assignmentHistory = mysqlTable("assignment_history", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  previousSubBranchAdminId: int("previousSubBranchAdminId"),
  newSubBranchAdminId: int("newSubBranchAdminId"),
  previousTeamId: int("previousTeamId"),
  newTeamId: int("newTeamId"),
  previousAgentId: int("previousAgentId"),
  newAgentId: int("newAgentId"),
  assignedBy: int("assignedBy").notNull(),
  assignmentType: mysqlEnum("assignmentType", [
    "branch_to_sub_branch", "sub_branch_to_agent", "branch_to_agent", "reassignment",
  ]),
  assignmentReason: varchar("assignmentReason", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AssignmentHistory = typeof assignmentHistory.$inferSelect;
export type InsertAssignmentHistory = typeof assignmentHistory.$inferInsert;

export const handoffHistories = mysqlTable("handoff_histories", {
  id: int("id").autoincrement().primaryKey(),
  sourceUserId: int("sourceUserId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  executedBy: int("executedBy").notNull(),
  reason: varchar("reason", { length: 300 }).notNull(),
  transferredCustomerCount: int("transferredCustomerCount").default(0).notNull(),
  transferredContractCount: int("transferredContractCount").default(0).notNull(),
  transferredFollowUpCount: int("transferredFollowUpCount").default(0).notNull(),
  transferredScheduleCount: int("transferredScheduleCount").default(0).notNull(),
  transferredNotificationCount: int("transferredNotificationCount").default(0).notNull(),
  sourceAccountStatusBefore: mysqlEnum("sourceAccountStatusBefore", ["active", "inactive", "resigned"]).notNull(),
  sourceAccountStatusAfter: mysqlEnum("sourceAccountStatusAfter", ["active", "inactive", "resigned"]).notNull(),
  forceLogoutSource: boolean("forceLogoutSource").default(false).notNull(),
  resetOAuthSource: boolean("resetOAuthSource").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HandoffHistory = typeof handoffHistories.$inferSelect;
export type InsertHandoffHistory = typeof handoffHistories.$inferInsert;

export const performanceGoals = mysqlTable("performance_goals", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  targetType: mysqlEnum("targetType", ["branch", "sub_branch", "team", "user"]).notNull(),
  targetId: int("targetId"),
  contractCountGoal: int("contractCountGoal").default(0).notNull(),
  monthlyPremiumGoal: int("monthlyPremiumGoal").default(0).notNull(),
  consultationGoal: int("consultationGoal").default(0).notNull(),
  followUpGoal: int("followUpGoal").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PerformanceGoal = typeof performanceGoals.$inferSelect;
export type InsertPerformanceGoal = typeof performanceGoals.$inferInsert;

// ─── Contract History ─────────────────────────────────────────────────────────
export const contractHistory = mysqlTable("contract_history", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  changedBy: int("changedBy").notNull(),
  fieldName: varchar("fieldName", { length: 100 }).notNull(),
  beforeValue: text("beforeValue"),
  afterValue: text("afterValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContractHistory = typeof contractHistory.$inferSelect;
export type InsertContractHistory = typeof contractHistory.$inferInsert;

// ─── Activity Logs ────────────────────────────────────────────────────────────
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  userAgent: varchar("userAgent", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ─── Activity Log Archives ───────────────────────────────────────────────────
export const activityLogArchives = mysqlTable("activity_log_archives", {
  id: int("id").autoincrement().primaryKey(),
  archiveMonth: varchar("archiveMonth", { length: 7 }).notNull(),
  totalLogs: int("totalLogs").notNull(),
  archivedBy: int("archivedBy").notNull(),
  archiveType: mysqlEnum("archiveType", ["monthly", "manual"]).default("manual").notNull(),
  dateFrom: timestamp("dateFrom").notNull(),
  dateTo: timestamp("dateTo").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  status: mysqlEnum("status", ["completed", "failed"]).default("completed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ActivityLogArchive = typeof activityLogArchives.$inferSelect;
export type InsertActivityLogArchive = typeof activityLogArchives.$inferInsert;

// ─── Device Tokens (FCM 준비) ────────────────────────────────────────────────
export const userDeviceTokens = mysqlTable("user_device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  platform: mysqlEnum("platform", ["android"]).default("android").notNull(),
  token: varchar("token", { length: 512 }).notNull(),
  deviceId: varchar("deviceId", { length: 128 }),
  appVersion: varchar("appVersion", { length: 50 }),
  deviceModel: varchar("deviceModel", { length: 200 }),
  osVersion: varchar("osVersion", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  revokedAt: timestamp("revokedAt"),
},
(table) => ({
  uniqueUserToken: unique("uq_user_device_token").on(table.userId, table.token),
}));
export type UserDeviceToken = typeof userDeviceTokens.$inferSelect;
export type InsertUserDeviceToken = typeof userDeviceTokens.$inferInsert;

export const pushNotificationLogs = mysqlTable("push_notification_logs", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 80 }).notNull(),
  userId: int("userId").notNull(),
  sourceType: varchar("sourceType", { length: 50 }),
  sourceId: int("sourceId"),
  dedupeKey: varchar("dedupeKey", { length: 200 }).notNull(),
  status: mysqlEnum("status", [
    "sent",
    "skipped",
    "failed",
    "skipped_no_token",
    "skipped_disabled",
    "skipped_quiet_hours",
    "skipped_missing_config",
    "duplicate_skipped",
    "invalid_token_deactivated",
  ]).default("skipped").notNull(),
  errorCode: varchar("errorCode", { length: 100 }),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(table) => ({
  uniquePushDedupe: unique("uq_push_notification_dedupe").on(table.dedupeKey),
}));
export type PushNotificationLog = typeof pushNotificationLogs.$inferSelect;
export type InsertPushNotificationLog = typeof pushNotificationLogs.$inferInsert;

export const pushNotificationPreferences = mysqlTable("push_notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  followUpTodayEnabled: boolean("followUpTodayEnabled").default(true).notNull(),
  scheduleReminderEnabled: boolean("scheduleReminderEnabled").default(true).notNull(),
  deleteRequestEnabled: boolean("deleteRequestEnabled").default(true).notNull(),
  testNotificationEnabled: boolean("testNotificationEnabled").default(true).notNull(),
  quietHoursEnabled: boolean("quietHoursEnabled").default(true).notNull(),
  quietHoursStart: varchar("quietHoursStart", { length: 5 }).default("21:00").notNull(),
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }).default("08:00").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Seoul").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(table) => ({
  uniquePushPreferenceUser: unique("uq_push_notification_preferences_user").on(table.userId),
}));
export type PushNotificationPreference = typeof pushNotificationPreferences.$inferSelect;
export type InsertPushNotificationPreference = typeof pushNotificationPreferences.$inferInsert;
