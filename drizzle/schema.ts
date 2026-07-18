import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  date,
  index,
  unique,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", [
    "branch_admin",
    "sub_branch_admin",
    "team_leader",
    "member",
  ])
    .default("member")
    .notNull(),
  accountStatus: mysqlEnum("accountStatus", ["active", "inactive", "resigned"])
    .default("active")
    .notNull(),
  loginStatus: mysqlEnum("loginStatus", ["invited", "linked"]).default(
    "linked"
  ),
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

export const userPermissions = mysqlTable(
  "user_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    permission: varchar("permission", { length: 100 }).notNull(),
    grantedBy: int("grantedBy"),
    grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  },
  table => ({
    uniqueUserPermission: unique("uq_user_permissions_user_permission").on(
      table.userId,
      table.permission
    ),
  })
);
export type UserPermission = typeof userPermissions.$inferSelect;

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
  dbCompany: varchar("dbCompany", { length: 100 }),
  agentId: int("agentId"),
  assignedTeamId: int("assignedTeamId"),
  assignedAt: timestamp("assignedAt"),
  subBranchAdminId: int("subBranchAdminId"),
  assignmentStatus: mysqlEnum("assignmentStatus", [
    "unassigned",
    "assigned_to_sub_branch",
    "assigned_to_agent",
  ])
    .default("unassigned")
    .notNull(),
  importBatchId: varchar("importBatchId", { length: 100 }),
  importedBy: int("importedBy"),
  importedAt: timestamp("importedAt"),
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
  ])
    .default("미상담")
    .notNull(),
  priority: mysqlEnum("priority", ["A", "B", "C", "D", "unclassified"])
    .default("unclassified")
    .notNull(),
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

// ─── Customer Relationships ───────────────────────────────────────────────────
export const customerRelationships = mysqlTable(
  "customer_relationships",
  {
    id: int("id").autoincrement().primaryKey(),
    primaryCustomerId: int("primaryCustomerId").notNull(),
    relatedCustomerId: int("relatedCustomerId").notNull(),
    relationshipType: mysqlEnum("relationshipType", [
      "family_spouse",
      "family_child",
      "family_parent",
      "family_sibling",
      "referral",
      "coworker",
      "corporate_representative",
      "corporate_employee",
      "friend",
      "other",
    ]).notNull(),
    relationshipLabel: varchar("relationshipLabel", { length: 50 }).notNull(),
    direction: mysqlEnum("direction", ["outbound", "inbound", "mutual"])
      .default("mutual")
      .notNull(),
    note: varchar("note", { length: 500 }),
    status: mysqlEnum("status", ["active", "inactive"])
      .default("active")
      .notNull(),
    createdBy: int("createdBy").notNull(),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => ({
    uniquePairType: unique("uq_customer_relationship_pair_type").on(
      table.primaryCustomerId,
      table.relatedCustomerId,
      table.relationshipType
    ),
  })
);
export type CustomerRelationship = typeof customerRelationships.$inferSelect;
export type InsertCustomerRelationship =
  typeof customerRelationships.$inferInsert;

// ─── Customer Referrals (PR21) ────────────────────────────────────────────────
export const customerReferrals = mysqlTable(
  "customer_referrals",
  {
    id: int("id").autoincrement().primaryKey(),
    relationshipId: int("relationshipId").notNull(),
    referrerCustomerId: int("referrerCustomerId").notNull(),
    referredCustomerId: int("referredCustomerId").notNull(),
    referralStage: mysqlEnum("referralStage", [
      "introduced",
      "contact_ready",
      "contacted",
      "consultation_scheduled",
      "consultation_completed",
      "proposal_made",
      "contracted",
      "deferred",
      "declined",
      "closed",
    ])
      .default("introduced")
      .notNull(),
    referralSourceType: mysqlEnum("referralSourceType", [
      "customer_referral",
      "family_referral",
      "coworker_referral",
      "corporate_referral",
      "friend_referral",
      "other",
    ]).notNull(),
    introductionMethod: mysqlEnum("introductionMethod", [
      "phone",
      "kakao",
      "sms",
      "in_person",
      "group_chat",
      "other",
    ]),
    thankYouStatus: mysqlEnum("thankYouStatus", [
      "not_required",
      "pending",
      "completed",
    ])
      .default("pending")
      .notNull(),
    thankYouCompletedAt: timestamp("thankYouCompletedAt"),
    firstContactedAt: timestamp("firstContactedAt"),
    consultationStartedAt: timestamp("consultationStartedAt"),
    proposalMadeAt: timestamp("proposalMadeAt"),
    contractedAt: timestamp("contractedAt"),
    declinedAt: timestamp("declinedAt"),
    deferredUntil: timestamp("deferredUntil"),
    resultStatus: mysqlEnum("resultStatus", [
      "in_progress",
      "contracted",
      "deferred",
      "declined",
      "closed",
    ])
      .default("in_progress")
      .notNull(),
    memo: varchar("memo", { length: 500 }),
    createdBy: int("createdBy").notNull(),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  table => ({
    uniqueRelationship: unique("uq_customer_referral_relationship").on(
      table.relationshipId
    ),
    uniqueReferrerPair: unique("uq_customer_referral_pair").on(
      table.referrerCustomerId,
      table.referredCustomerId
    ),
  })
);
export type CustomerReferral = typeof customerReferrals.$inferSelect;
export type InsertCustomerReferral = typeof customerReferrals.$inferInsert;

// ─── Claim Guidance Cases (PR22) ──────────────────────────────────────────────
export const claimGuidanceCases = mysqlTable("claim_guidance_cases", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  contractId: int("contractId"),
  guidanceType: mysqlEnum("guidanceType", [
    "process_guidance",
    "required_documents",
    "additional_documents",
    "submission_status",
    "result_followup",
    "other",
  ]).notNull(),
  guidanceStatus: mysqlEnum("guidanceStatus", [
    "guidance_needed",
    "guidance_provided",
    "waiting_customer",
    "documents_preparing",
    "submitted_by_customer",
    "additional_guidance_needed",
    "completed",
    "not_applicable",
    "closed",
  ])
    .default("guidance_needed")
    .notNull(),
  documentGuideStatus: mysqlEnum("documentGuideStatus", [
    "not_started",
    "guide_sent",
    "customer_checking",
    "completed",
    "not_applicable",
  ])
    .default("not_started")
    .notNull(),
  customerActionStatus: mysqlEnum("customerActionStatus", [
    "no_action",
    "preparing",
    "submitted",
    "waiting_result",
    "completed",
    "stopped",
  ])
    .default("no_action")
    .notNull(),
  followUpId: int("followUpId"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  closedAt: timestamp("closedAt"),
  closedReason: mysqlEnum("closedReason", [
    "customer_completed",
    "customer_declined",
    "not_claimable_by_customer_report",
    "duplicate",
    "outdated",
    "other",
  ]),
  memo: varchar("memo", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});
export type ClaimGuidanceCase = typeof claimGuidanceCases.$inferSelect;
export type InsertClaimGuidanceCase = typeof claimGuidanceCases.$inferInsert;

// ─── Retention Risk Cases (PR23) ──────────────────────────────────────────────
export const retentionRiskCases = mysqlTable("retention_risk_cases", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  contractId: int("contractId"),
  riskReason: mysqlEnum("riskReason", [
    "premium_burden",
    "coverage_dissatisfaction",
    "competitor_offer",
    "cash_need",
    "duplicate_coverage",
    "trust_issue",
    "claim_dissatisfaction",
    "family_opposition",
    "low_priority",
    "no_response",
    "other",
  ]).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"])
    .default("medium")
    .notNull(),
  retentionStatus: mysqlEnum("retentionStatus", [
    "detected",
    "contacted",
    "explanation_provided",
    "adjustment_review",
    "waiting_customer",
    "retained",
    "adjusted",
    "surrendered",
    "closed",
  ])
    .default("detected")
    .notNull(),
  responseStrategy: mysqlEnum("responseStrategy", [
    "explain_existing_value",
    "reduce_premium_review",
    "coverage_gap_review",
    "partial_adjustment",
    "payment_method_review",
    "wait_and_followup",
    "no_retention_needed",
    "other",
  ])
    .default("wait_and_followup")
    .notNull(),
  customerSentiment: mysqlEnum("customerSentiment", [
    "calm",
    "worried",
    "dissatisfied",
    "price_sensitive",
    "distrustful",
    "undecided",
    "no_response",
  ])
    .default("undecided")
    .notNull(),
  financialPressureLevel: mysqlEnum("financialPressureLevel", [
    "low",
    "medium",
    "high",
  ]),
  competitorMentioned: boolean("competitorMentioned").default(false).notNull(),
  followUpId: int("followUpId"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  resolvedAt: timestamp("resolvedAt"),
  resolutionResult: mysqlEnum("resolutionResult", [
    "retained",
    "adjusted",
    "surrendered",
    "transferred_to_followup",
    "no_action",
    "unknown",
  ]),
  memo: varchar("memo", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});
export type RetentionRiskCase = typeof retentionRiskCases.$inferSelect;
export type InsertRetentionRiskCase = typeof retentionRiskCases.$inferInsert;

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
  category: mysqlEnum("category", [
    "basic",
    "needs",
    "coverage",
    "premium",
    "family",
    "follow_up",
    "compliance",
  ])
    .default("basic")
    .notNull(),
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
export type InsertConsultationChecklist =
  typeof consultationChecklists.$inferInsert;

export const consultationCheckResults = mysqlTable(
  "consultation_check_results",
  {
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
  }
);
export type ConsultationCheckResult =
  typeof consultationCheckResults.$inferSelect;
export type InsertConsultationCheckResult =
  typeof consultationCheckResults.$inferInsert;

export const messageTemplates = mysqlTable("message_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  situation: mysqlEnum("situation", [
    "missed_call",
    "proposal_follow_up",
    "pre_contract_check",
    "post_contract_care",
    "long_unmanaged",
    "birthday",
    "follow_up_schedule",
    "document_request",
    "after_consultation",
    "general_check",
  ]).notNull(),
  channel: mysqlEnum("channel", ["kakao", "sms", "both"])
    .default("both")
    .notNull(),
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
  noteType: mysqlEnum("noteType", [
    "handoff",
    "caution",
    "approach",
    "avoid",
    "relationship",
    "next_action",
  ])
    .default("handoff")
    .notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  visibility: mysqlEnum("visibility", ["internal"])
    .default("internal")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustomerHandoffNote = typeof customerHandoffNotes.$inferSelect;
export type InsertCustomerHandoffNote =
  typeof customerHandoffNotes.$inferInsert;

export const consultationScripts = mysqlTable("consultation_scripts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  category: mysqlEnum("category", [
    "first_call",
    "missed_call",
    "premium_burden",
    "coverage_concern",
    "family_responsibility",
    "surrender_risk",
    "proposal_follow_up",
    "post_contract_care",
    "long_unmanaged",
    "general_check",
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
  paymentStatus: mysqlEnum("paymentStatus", [
    "정상",
    "미납",
    "실효",
    "해지",
  ]).default("정상"),
  contractStatus: mysqlEnum("contractStatus", [
    "청약",
    "성립",
    "철회",
    "유지",
    "해지",
  ]).default("청약"),
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
  blockedForbiddenColumn: boolean("blockedForbiddenColumn")
    .default(false)
    .notNull(),
  status: mysqlEnum("status", [
    "active",
    "cancelled",
    "partially_cancelled",
    "failed",
  ])
    .default("active")
    .notNull(),
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
  requestType: mysqlEnum("requestType", ["contract_delete"])
    .default("contract_delete")
    .notNull(),
  targetType: mysqlEnum("targetType", ["contract"])
    .default("contract")
    .notNull(),
  targetId: int("targetId").notNull(),
  customerId: int("customerId").notNull(),
  requestedBy: int("requestedBy").notNull(),
  requestReason: varchar("requestReason", { length: 100 }).notNull(),
  requestMemo: text("requestMemo"),
  expectedImpact: mysqlEnum("expectedImpact", ["performance_exclusion"])
    .default("performance_exclusion")
    .notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"])
    .default("pending")
    .notNull(),
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
  nextAction: mysqlEnum("nextAction", [
    "전화",
    "카톡",
    "문자",
    "방문",
    "설계안 발송",
    "계약 확인",
    "보장분석",
    "사후관리",
    "기타",
  ])
    .default("전화")
    .notNull(),
  status: mysqlEnum("status", [
    "scheduled",
    "completed",
    "postponed",
    "cancelled",
  ])
    .default("scheduled")
    .notNull(),
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
  customerId: int("customerId"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 200 }),
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
  ])
    .default("기타")
    .notNull(),
  status: mysqlEnum("status", ["예정", "완료", "취소", "변경", "노쇼", "보류"])
    .default("예정")
    .notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  completedAt: timestamp("completedAt"),
  memo: text("memo"),
  calendarCategory: mysqlEnum("calendarCategory", [
    "branch_common",
    "consultation_followup",
    "admin",
  ]),
  reminderDayBefore: boolean("reminderDayBefore").default(true),
  reminderSameDay: boolean("reminderSameDay").default(true),
  reminderOneHourBefore: boolean("reminderOneHourBefore").default(true),
  reminderOffsetMinutes: int("reminderOffsetMinutes").default(30).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

export const scheduleChangeRequests = mysqlTable(
  "schedule_change_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    requestType: mysqlEnum("requestType", ["create", "update", "delete"])
      .notNull(),
    scheduleId: int("scheduleId"),
    requesterId: int("requesterId").notNull(),
    targetUserId: int("targetUserId").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "approved",
      "rejected",
      "cancelled",
      "conflict",
      "failed",
    ])
      .default("pending")
      .notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    requestedPayload: json("requestedPayload").notNull(),
    beforeSnapshot: json("beforeSnapshot"),
    baseScheduleUpdatedAt: timestamp("baseScheduleUpdatedAt"),
    pendingKey: varchar("pendingKey", { length: 100 }),
    reviewedBy: int("reviewedBy"),
    reviewedAt: timestamp("reviewedAt"),
    reviewComment: varchar("reviewComment", { length: 500 }),
    appliedAt: timestamp("appliedAt"),
    cancelledAt: timestamp("cancelledAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniquePendingKey: unique("uq_schedule_change_requests_pending_key").on(
      table.pendingKey
    ),
    statusCreatedIndex: index("idx_scr_status_created").on(
      table.status,
      table.createdAt
    ),
    requesterStatusIndex: index("idx_scr_requester_status").on(
      table.requesterId,
      table.status
    ),
    targetStatusIndex: index("idx_scr_target_status").on(
      table.targetUserId,
      table.status
    ),
    scheduleStatusIndex: index("idx_scr_schedule_status").on(
      table.scheduleId,
      table.status
    ),
    reviewerReviewedIndex: index("idx_scr_reviewer_reviewed").on(
      table.reviewedBy,
      table.reviewedAt
    ),
  })
);
export type ScheduleChangeRequest = typeof scheduleChangeRequests.$inferSelect;
export type InsertScheduleChangeRequest =
  typeof scheduleChangeRequests.$inferInsert;

// ─── Reminders ────────────────────────────────────────────────────────────────
export const reminders = mysqlTable(
  "reminders",
  {
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
    dueAt: timestamp("dueAt"),
    isRead: boolean("isRead").default(false).notNull(),
    isSent: boolean("isSent").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    uniqueReminder: unique("uq_reminder").on(
      table.userId,
      table.type,
      table.relatedType,
      table.relatedId,
      table.dueAt
    ),
  })
);
export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable(
  "notifications",
  {
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
      "customer_assigned",
      "general",
    ]).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    relatedType: varchar("relatedType", { length: 50 }),
    relatedId: int("relatedId"),
    dueAt: timestamp("dueAt"),
    isRead: boolean("isRead").default(false).notNull(),
    processStatus: mysqlEnum("processStatus", [
      "미확인",
      "확인",
      "처리완료",
      "보류",
    ])
      .default("미확인")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    uniqueNotif: unique("uq_notification").on(
      table.userId,
      table.type,
      table.relatedType,
      table.relatedId,
      table.dueAt
    ),
  })
);
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
    "branch_to_sub_branch",
    "sub_branch_to_agent",
    "branch_to_agent",
    "reassignment",
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
  transferredCustomerCount: int("transferredCustomerCount")
    .default(0)
    .notNull(),
  transferredContractCount: int("transferredContractCount")
    .default(0)
    .notNull(),
  transferredFollowUpCount: int("transferredFollowUpCount")
    .default(0)
    .notNull(),
  transferredScheduleCount: int("transferredScheduleCount")
    .default(0)
    .notNull(),
  transferredNotificationCount: int("transferredNotificationCount")
    .default(0)
    .notNull(),
  sourceAccountStatusBefore: mysqlEnum("sourceAccountStatusBefore", [
    "active",
    "inactive",
    "resigned",
  ]).notNull(),
  sourceAccountStatusAfter: mysqlEnum("sourceAccountStatusAfter", [
    "active",
    "inactive",
    "resigned",
  ]).notNull(),
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
  targetType: mysqlEnum("targetType", [
    "branch",
    "sub_branch",
    "team",
    "user",
  ]).notNull(),
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

export const contractLifecycleEvents = mysqlTable(
  "contract_lifecycle_events",
  {
    id: int("id").autoincrement().primaryKey(),
    contractId: int("contractId").notNull(),
    customerId: int("customerId").notNull(),
    eventType: mysqlEnum("eventType", [
      "created",
      "updated",
      "deletion_requested",
      "deletion_rejected",
      "deleted",
      "restored",
    ]).notNull(),
    effectiveAt: timestamp("effectiveAt").notNull(),
    reason: text("reason"),
    monthlyPremiumSnapshot: int("monthlyPremiumSnapshot"),
    actorId: int("actorId").notNull(),
    sourceType: mysqlEnum("sourceType", [
      "contract",
      "delete_request",
      "restore_action",
    ]).notNull(),
    sourceId: int("sourceId"),
    dedupeKey: varchar("dedupeKey", { length: 191 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    contractEffectiveIndex: index("idx_contract_lifecycle_contract_effective").on(
      table.contractId,
      table.effectiveAt
    ),
    customerEffectiveIndex: index("idx_contract_lifecycle_customer_effective").on(
      table.customerId,
      table.effectiveAt
    ),
    uniqueDedupe: unique("uq_contract_lifecycle_dedupe").on(table.dedupeKey),
  })
);
export type ContractLifecycleEvent =
  typeof contractLifecycleEvents.$inferSelect;
export type InsertContractLifecycleEvent =
  typeof contractLifecycleEvents.$inferInsert;

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

// ─── Device Tokens (FCM 준비) ────────────────────────────────────────────────
export const userDeviceTokens = mysqlTable(
  "user_device_tokens",
  {
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
  table => ({
    uniqueUserToken: unique("uq_user_device_token").on(
      table.userId,
      table.token
    ),
  })
);
export type UserDeviceToken = typeof userDeviceTokens.$inferSelect;
export type InsertUserDeviceToken = typeof userDeviceTokens.$inferInsert;

export const pushNotificationLogs = mysqlTable(
  "push_notification_logs",
  {
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
    ])
      .default("skipped")
      .notNull(),
    errorCode: varchar("errorCode", { length: 100 }),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    uniquePushDedupe: unique("uq_push_notification_dedupe").on(table.dedupeKey),
  })
);
export type PushNotificationLog = typeof pushNotificationLogs.$inferSelect;
export type InsertPushNotificationLog =
  typeof pushNotificationLogs.$inferInsert;

export const pushNotificationPreferences = mysqlTable(
  "push_notification_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    followUpTodayEnabled: boolean("followUpTodayEnabled")
      .default(true)
      .notNull(),
    scheduleReminderEnabled: boolean("scheduleReminderEnabled")
      .default(true)
      .notNull(),
    deleteRequestEnabled: boolean("deleteRequestEnabled")
      .default(true)
      .notNull(),
    testNotificationEnabled: boolean("testNotificationEnabled")
      .default(true)
      .notNull(),
    quietHoursEnabled: boolean("quietHoursEnabled").default(true).notNull(),
    quietHoursStart: varchar("quietHoursStart", { length: 5 })
      .default("21:00")
      .notNull(),
    quietHoursEnd: varchar("quietHoursEnd", { length: 5 })
      .default("08:00")
      .notNull(),
    timezone: varchar("timezone", { length: 64 })
      .default("Asia/Seoul")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniquePushPreferenceUser: unique(
      "uq_push_notification_preferences_user"
    ).on(table.userId),
  })
);
export type PushNotificationPreference =
  typeof pushNotificationPreferences.$inferSelect;
export type InsertPushNotificationPreference =
  typeof pushNotificationPreferences.$inferInsert;

// ─── Onboarding Checklists ───────────────────────────────────────────────────
export const onboardingTemplates = mysqlTable("onboarding_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  targetRole: mysqlEnum("targetRole", [
    "branch_admin",
    "sub_branch_admin",
    "team_leader",
    "member",
  ]).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
});
export type OnboardingTemplate = typeof onboardingTemplates.$inferSelect;
export type InsertOnboardingTemplate = typeof onboardingTemplates.$inferInsert;

export const onboardingTemplateItems = mysqlTable("onboarding_template_items", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  required: boolean("required").default(true).notNull(),
  requiresManagerApproval: boolean("requiresManagerApproval")
    .default(false)
    .notNull(),
  practiceRequired: boolean("practiceRequired").default(false).notNull(),
  relatedMenu: varchar("relatedMenu", { length: 200 }),
  completionCriteria: text("completionCriteria"),
  estimatedMinutes: int("estimatedMinutes").default(10).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OnboardingTemplateItem =
  typeof onboardingTemplateItems.$inferSelect;
export type InsertOnboardingTemplateItem =
  typeof onboardingTemplateItems.$inferInsert;

export const userOnboardingAssignments = mysqlTable(
  "user_onboarding_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    targetUserId: int("targetUserId").notNull(),
    templateId: int("templateId").notNull(),
    assignedBy: int("assignedBy").notNull(),
    trainerUserId: int("trainerUserId"),
    startedAt: timestamp("startedAt").notNull(),
    dueAt: timestamp("dueAt").notNull(),
    completedAt: timestamp("completedAt"),
    status: mysqlEnum("status", [
      "assigned",
      "in_progress",
      "completed",
      "overdue",
      "archived",
    ])
      .default("assigned")
      .notNull(),
    progressPercent: int("progressPercent").default(0).notNull(),
    requiredPendingCount: int("requiredPendingCount").default(0).notNull(),
    approvalPendingCount: int("approvalPendingCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
    archivedBy: int("archivedBy"),
  }
);
export type UserOnboardingAssignment =
  typeof userOnboardingAssignments.$inferSelect;
export type InsertUserOnboardingAssignment =
  typeof userOnboardingAssignments.$inferInsert;

export const userOnboardingItemProgress = mysqlTable(
  "user_onboarding_item_progress",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull(),
    itemId: int("itemId").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "needs_approval",
      "approved",
      "rejected",
      "skipped",
    ])
      .default("pending")
      .notNull(),
    completedAt: timestamp("completedAt"),
    completedBy: int("completedBy"),
    approvedAt: timestamp("approvedAt"),
    approvedBy: int("approvedBy"),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueAssignmentItemProgress: unique("uq_onboarding_assignment_item").on(
      table.assignmentId,
      table.itemId
    ),
  })
);
export type UserOnboardingItemProgress =
  typeof userOnboardingItemProgress.$inferSelect;
export type InsertUserOnboardingItemProgress =
  typeof userOnboardingItemProgress.$inferInsert;

// ─── Coaching Notes ──────────────────────────────────────────────────────────
export const teamMemberCoachingNotes = mysqlTable(
  "team_member_coaching_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    targetUserId: int("targetUserId").notNull(),
    authorUserId: int("authorUserId").notNull(),
    category: mysqlEnum("category", [
      "praise",
      "improvement",
      "follow_up_delay",
      "notification_unread",
      "customer_care_gap",
      "goal_gap",
      "training",
      "one_on_one",
      "general",
    ])
      .default("general")
      .notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    note: text("note").notNull(),
    actionItems: text("actionItems"),
    priority: mysqlEnum("priority", ["low", "medium", "high"])
      .default("medium")
      .notNull(),
    status: mysqlEnum("status", ["open", "resolved", "archived"])
      .default("open")
      .notNull(),
    visibility: mysqlEnum("visibility", [
      "private_admin",
      "manager_visible",
      "member_visible",
    ])
      .default("manager_visible")
      .notNull(),
    nextReviewAt: timestamp("nextReviewAt"),
    linkedMetricType: varchar("linkedMetricType", { length: 100 }),
    linkedMetricSnapshotJson: json("linkedMetricSnapshotJson"),
    isArchived: boolean("isArchived").default(false).notNull(),
    archivedAt: timestamp("archivedAt"),
    archivedBy: int("archivedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  }
);
export type TeamMemberCoachingNote =
  typeof teamMemberCoachingNotes.$inferSelect;
export type InsertTeamMemberCoachingNote =
  typeof teamMemberCoachingNotes.$inferInsert;

// ─── Action Plans (지점원 실행계획) ───────────────────────────────────────────
export const actionPlanStatusEnum = [
  "draft",
  "submitted",
  "reviewed",
  "revision_requested",
  "closed",
] as const;

export const branchActionPlans = mysqlTable(
  "branch_action_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    targetMonth: varchar("targetMonth", { length: 7 }).notNull(),
    monthlyContractTarget: int("monthlyContractTarget").default(0).notNull(),
    monthlyPremiumTarget: int("monthlyPremiumTarget").default(0).notNull(),
    monthlyConsultationTarget: int("monthlyConsultationTarget")
      .default(0)
      .notNull(),
    monthlyCallTarget: int("monthlyCallTarget").default(0).notNull(),
    monthlyMessageTarget: int("monthlyMessageTarget").default(0).notNull(),
    monthlyFollowUpTarget: int("monthlyFollowUpTarget").default(0).notNull(),
    focusCustomerGroup: text("focusCustomerGroup"),
    monthlyStrategy: text("monthlyStrategy"),
    preparationMemo: text("preparationMemo"),
    expectedRisk: text("expectedRisk"),
    supportRequest: text("supportRequest"),
    monthlyRevenueTarget: int("monthlyRevenueTarget").default(0).notNull(),
    monthlyNewConsultationTarget: int("monthlyNewConsultationTarget")
      .default(0)
      .notNull(),
    monthlyContactTarget: int("monthlyContactTarget").default(0).notNull(),
    monthlyAnalysisTarget: int("monthlyAnalysisTarget").default(0).notNull(),
    monthlyProposalTarget: int("monthlyProposalTarget").default(0).notNull(),
    monthlyIntroductionRequestTarget: int("monthlyIntroductionRequestTarget")
      .default(0)
      .notNull(),
    primaryCustomerSegment: text("primaryCustomerSegment"),
    monthlyPreparationStatus: text("monthlyPreparationStatus"),
    complianceCheckMemo: text("complianceCheckMemo"),
    privacyMinimizedConfirmed: boolean("privacyMinimizedConfirmed")
      .default(false)
      .notNull(),
    managerComment: text("managerComment"),
    status: mysqlEnum("status", actionPlanStatusEnum)
      .default("draft")
      .notNull(),
    submittedAt: timestamp("submittedAt"),
    reviewedBy: int("reviewedBy"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueUserMonth: unique("uq_branch_action_plan_user_month").on(
      table.userId,
      table.targetMonth
    ),
  })
);
export type BranchActionPlan = typeof branchActionPlans.$inferSelect;
export type InsertBranchActionPlan = typeof branchActionPlans.$inferInsert;

export const weeklyActionPlans = mysqlTable(
  "weekly_action_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    monthlyPlanId: int("monthlyPlanId").notNull(),
    userId: int("userId").notNull(),
    weekStartDate: date("weekStartDate").notNull(),
    weekEndDate: date("weekEndDate").notNull(),
    weekLabel: varchar("weekLabel", { length: 50 }).notNull(),
    weeklyContractTarget: int("weeklyContractTarget").default(0).notNull(),
    weeklyPremiumTarget: int("weeklyPremiumTarget").default(0).notNull(),
    weeklyConsultationTarget: int("weeklyConsultationTarget")
      .default(0)
      .notNull(),
    weeklyCallTarget: int("weeklyCallTarget").default(0).notNull(),
    weeklyMessageTarget: int("weeklyMessageTarget").default(0).notNull(),
    weeklyVisitTarget: int("weeklyVisitTarget").default(0).notNull(),
    weeklyProposalTarget: int("weeklyProposalTarget").default(0).notNull(),
    weeklyFollowUpTarget: int("weeklyFollowUpTarget").default(0).notNull(),
    focusCustomerGroup: text("focusCustomerGroup"),
    weeklyActionPlan: text("weeklyActionPlan"),
    preparationMemo: text("preparationMemo"),
    expectedRisk: text("expectedRisk"),
    supportRequest: text("supportRequest"),
    targetMonth: varchar("targetMonth", { length: 7 }),
    weekNumber: int("weekNumber"),
    targetCustomerSegment: text("targetCustomerSegment"),
    targetCustomerReference: text("targetCustomerReference"),
    customerStage: varchar("customerStage", { length: 50 }),
    proposedProductCategory: varchar("proposedProductCategory", {
      length: 100,
    }),
    proposedCoverageArea: varchar("proposedCoverageArea", { length: 100 }),
    proposalPurpose: text("proposalPurpose"),
    preparationMaterials: text("preparationMaterials"),
    weeklyRevenueTarget: int("weeklyRevenueTarget").default(0).notNull(),
    weeklyAnalysisTarget: int("weeklyAnalysisTarget").default(0).notNull(),
    weeklyIntroductionRequestTarget: int("weeklyIntroductionRequestTarget")
      .default(0)
      .notNull(),
    weeklyReconnectTarget: int("weeklyReconnectTarget").default(0).notNull(),
    complianceRiskCheck: text("complianceRiskCheck"),
    privacyMinimizedConfirmed: boolean("privacyMinimizedConfirmed")
      .default(false)
      .notNull(),
    weeklyReviewMemo: text("weeklyReviewMemo"),
    nextWeekImprovement: text("nextWeekImprovement"),
    coachingRequest: text("coachingRequest"),
    managerComment: text("managerComment"),
    status: mysqlEnum("status", actionPlanStatusEnum)
      .default("draft")
      .notNull(),
    submittedAt: timestamp("submittedAt"),
    reviewedBy: int("reviewedBy"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueMonthlyWeek: unique("uq_weekly_action_plan_month_week").on(
      table.monthlyPlanId,
      table.weekStartDate
    ),
    uniqueUserMonthWeek: unique("uq_weekly_user_month_weeknum").on(
      table.userId,
      table.targetMonth,
      table.weekNumber
    ),
  })
);
export type WeeklyActionPlan = typeof weeklyActionPlans.$inferSelect;
export type InsertWeeklyActionPlan = typeof weeklyActionPlans.$inferInsert;

export const dailyActionPlans = mysqlTable(
  "daily_action_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    weeklyPlanId: int("weeklyPlanId").notNull(),
    userId: int("userId").notNull(),
    planDate: date("planDate").notNull(),
    callTarget: int("callTarget").default(0).notNull(),
    messageTarget: int("messageTarget").default(0).notNull(),
    consultationTarget: int("consultationTarget").default(0).notNull(),
    visitTarget: int("visitTarget").default(0).notNull(),
    proposalTarget: int("proposalTarget").default(0).notNull(),
    followUpTarget: int("followUpTarget").default(0).notNull(),
    todayPriority: text("todayPriority"),
    preparationMemo: text("preparationMemo"),
    actualCallCount: int("actualCallCount").default(0).notNull(),
    actualMessageCount: int("actualMessageCount").default(0).notNull(),
    actualConsultationCount: int("actualConsultationCount")
      .default(0)
      .notNull(),
    actualVisitCount: int("actualVisitCount").default(0).notNull(),
    actualProposalCount: int("actualProposalCount").default(0).notNull(),
    actualFollowUpCount: int("actualFollowUpCount").default(0).notNull(),
    actualResultMemo: text("actualResultMemo"),
    nextDayMemo: text("nextDayMemo"),
    targetMonth: varchar("targetMonth", { length: 7 }),
    weekNumber: int("weekNumber"),
    targetCustomerSegment: text("targetCustomerSegment"),
    targetCustomerReference: text("targetCustomerReference"),
    customerStage: varchar("customerStage", { length: 50 }),
    proposedProductCategory: varchar("proposedProductCategory", {
      length: 100,
    }),
    proposedCoverageArea: varchar("proposedCoverageArea", { length: 100 }),
    proposalPurpose: text("proposalPurpose"),
    preparationMaterials: text("preparationMaterials"),
    dailyRevenueTarget: int("dailyRevenueTarget").default(0).notNull(),
    newContactTarget: int("newContactTarget").default(0).notNull(),
    analysisTarget: int("analysisTarget").default(0).notNull(),
    introductionRequestTarget: int("introductionRequestTarget")
      .default(0)
      .notNull(),
    reconnectTarget: int("reconnectTarget").default(0).notNull(),
    contractTarget: int("contractTarget").default(0).notNull(),
    actualNewContactCount: int("actualNewContactCount").default(0).notNull(),
    actualAnalysisCount: int("actualAnalysisCount").default(0).notNull(),
    actualIntroductionRequestCount: int("actualIntroductionRequestCount")
      .default(0)
      .notNull(),
    actualReconnectCount: int("actualReconnectCount").default(0).notNull(),
    actualContractCount: int("actualContractCount").default(0).notNull(),
    complianceRiskCheck: text("complianceRiskCheck"),
    privacyMinimizedConfirmed: boolean("privacyMinimizedConfirmed")
      .default(false)
      .notNull(),
    managerComment: text("managerComment"),
    status: mysqlEnum("status", actionPlanStatusEnum)
      .default("draft")
      .notNull(),
    submittedAt: timestamp("submittedAt"),
    reviewedBy: int("reviewedBy"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueWeeklyDate: unique("uq_daily_action_plan_week_date").on(
      table.weeklyPlanId,
      table.planDate
    ),
  })
);
export type DailyActionPlan = typeof dailyActionPlans.$inferSelect;
export type InsertDailyActionPlan = typeof dailyActionPlans.$inferInsert;

export const executiveActionPlanReports = mysqlTable(
  "executive_action_plan_reports",
  {
    id: int("id").autoincrement().primaryKey(),
    reportMonth: varchar("reportMonth", { length: 7 }).notNull(),
    reportWeekLabel: varchar("reportWeekLabel", { length: 50 }).notNull(),
    generatedBy: int("generatedBy").notNull(),
    reportTitle: varchar("reportTitle", { length: 200 }).notNull(),
    branchSummary: text("branchSummary"),
    branchStrategy: text("branchStrategy"),
    keyRisks: text("keyRisks"),
    supportRequest: text("supportRequest"),
    executiveMessage: text("executiveMessage"),
    downloadReason: text("downloadReason").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  }
);
export type ExecutiveActionPlanReport =
  typeof executiveActionPlanReports.$inferSelect;
export type InsertExecutiveActionPlanReport =
  typeof executiveActionPlanReports.$inferInsert;

// ─── Google Calendar Integration ─────────────────────────────────────────────
export const googleCalendarOauthCredentials = mysqlTable(
  "google_calendar_oauth_credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationScope: int("organizationScope").default(1).notNull(),
    provider: varchar("provider", { length: 32 })
      .default("google_calendar")
      .notNull(),
    refreshTokenEnc: text("refreshTokenEnc").notNull(),
    tokenScope: varchar("tokenScope", { length: 500 }),
    connectedBy: int("connectedBy").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastTestedAt: timestamp("lastTestedAt"),
    lastTestResult: varchar("lastTestResult", { length: 32 }),
    lastTestErrorSafe: varchar("lastTestErrorSafe", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueOrgProvider: unique("uq_google_calendar_oauth_org").on(
      table.organizationScope,
      table.provider
    ),
  })
);
export type GoogleCalendarOauthCredential =
  typeof googleCalendarOauthCredentials.$inferSelect;

export const googleCalendarIntegrations = mysqlTable(
  "google_calendar_integrations",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationScope: int("organizationScope").default(1).notNull(),
    provider: varchar("provider", { length: 32 })
      .default("google_calendar")
      .notNull(),
    calendarType: mysqlEnum("calendarType", [
      "branch_common",
      "consultation_followup",
      "admin",
    ]).notNull(),
    googleCalendarId: varchar("googleCalendarId", { length: 255 }).notNull(),
    displayName: varchar("displayName", { length: 200 }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastTestedAt: timestamp("lastTestedAt"),
    lastTestResult: varchar("lastTestResult", { length: 32 }),
    lastTestErrorSafe: varchar("lastTestErrorSafe", { length: 500 }),
    createdBy: int("createdBy").notNull(),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueOrgCalendarType: unique("uq_google_calendar_integration_type").on(
      table.organizationScope,
      table.calendarType
    ),
  })
);
export type GoogleCalendarIntegration =
  typeof googleCalendarIntegrations.$inferSelect;
export type InsertGoogleCalendarIntegration =
  typeof googleCalendarIntegrations.$inferInsert;

export const googleCalendarOrgSettings = mysqlTable(
  "google_calendar_org_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationScope: int("organizationScope").default(1).notNull(),
    includeCustomerContactForActorCalendar: boolean(
      "includeCustomerContactForActorCalendar"
    )
      .default(false)
      .notNull(),
    syncRawTitleToGoogleCalendar: boolean("syncRawTitleToGoogleCalendar")
      .default(false)
      .notNull(),
    syncRawDescriptionToGoogleCalendar: boolean(
      "syncRawDescriptionToGoogleCalendar"
    )
      .default(false)
      .notNull(),
    allowCustomerNameInGoogleCalendar: boolean(
      "allowCustomerNameInGoogleCalendar"
    )
      .default(false)
      .notNull(),
    allowCustomerContactInGoogleCalendar: boolean(
      "allowCustomerContactInGoogleCalendar"
    )
      .default(false)
      .notNull(),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueOrgScope: unique("uq_google_calendar_org_settings_scope").on(
      table.organizationScope
    ),
  })
);
export type GoogleCalendarOrgSettings =
  typeof googleCalendarOrgSettings.$inferSelect;

export const googleCalendarPersonalSettings = mysqlTable(
  "google_calendar_personal_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    personalCalendarId: varchar("personalCalendarId", { length: 255 }),
    contactDisplayConsent: boolean("contactDisplayConsent")
      .default(false)
      .notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueUser: unique("uq_google_calendar_personal_settings_user").on(
      table.userId
    ),
  })
);
export type GoogleCalendarPersonalSettings =
  typeof googleCalendarPersonalSettings.$inferSelect;
export type InsertGoogleCalendarPersonalSettings =
  typeof googleCalendarPersonalSettings.$inferInsert;

export const googleCalendarEventSyncs = mysqlTable(
  "google_calendar_event_syncs",
  {
    id: int("id").autoincrement().primaryKey(),
    boaEventType: mysqlEnum("boaEventType", [
      "calendar_event",
      "follow_up",
      "consultation",
      "meeting",
      "education",
      "admin",
    ]).notNull(),
    boaEventId: int("boaEventId").notNull(),
    syncTargetType: mysqlEnum("syncTargetType", [
      "shared_calendar",
      "actor_personal_calendar",
    ])
      .default("shared_calendar")
      .notNull(),
    targetUserId: int("targetUserId").default(0).notNull(),
    googleCalendarId: varchar("googleCalendarId", { length: 255 }).notNull(),
    googleEventId: varchar("googleEventId", { length: 255 }),
    calendarType: mysqlEnum("calendarType", [
      "branch_common",
      "consultation_followup",
      "admin",
    ]).notNull(),
    syncStatus: mysqlEnum("syncStatus", [
      "pending",
      "synced",
      "failed",
      "deleted",
      "skipped",
    ])
      .default("pending")
      .notNull(),
    includeContactInDescription: boolean("includeContactInDescription")
      .default(false)
      .notNull(),
    contactIncluded: boolean("contactIncluded").default(false).notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    lastErrorCode: varchar("lastErrorCode", { length: 64 }),
    lastErrorMessageSafe: varchar("lastErrorMessageSafe", { length: 500 }),
    retryCount: int("retryCount").default(0).notNull(),
    ownerUserId: int("ownerUserId"),
    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueBoaEventTarget: unique("uq_google_calendar_event_sync_target").on(
      table.boaEventType,
      table.boaEventId,
      table.syncTargetType,
      table.targetUserId
    ),
  })
);
export type GoogleCalendarEventSync =
  typeof googleCalendarEventSyncs.$inferSelect;
export type InsertGoogleCalendarEventSync =
  typeof googleCalendarEventSyncs.$inferInsert;

export const googleCalendarMisclassifiedResyncRuns = mysqlTable(
  "google_calendar_misclassified_resync_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    executeToken: varchar("executeToken", { length: 64 }).notNull(),
    status: mysqlEnum("status", [
      "dry_run",
      "executing",
      "completed",
      "expired",
    ])
      .default("dry_run")
      .notNull(),
    fromCalendarType: mysqlEnum("fromCalendarType", [
      "branch_common",
      "consultation_followup",
      "admin",
    ]).notNull(),
    toCalendarType: mysqlEnum("toCalendarType", [
      "branch_common",
      "consultation_followup",
      "admin",
    ]).notNull(),
    summaryJson: text("summaryJson").notNull(),
    candidateIdsJson: text("candidateIdsJson").notNull(),
    resultJson: text("resultJson"),
    actorId: int("actorId").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    executedAt: timestamp("executedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueToken: unique("uq_google_calendar_misclassified_resync_token").on(
      table.executeToken
    ),
  })
);
export type GoogleCalendarMisclassifiedResyncRun =
  typeof googleCalendarMisclassifiedResyncRuns.$inferSelect;
export type InsertGoogleCalendarMisclassifiedResyncRun =
  typeof googleCalendarMisclassifiedResyncRuns.$inferInsert;

export const oauthStateNonces = mysqlTable(
  "oauth_state_nonces",
  {
    nonceDigest: varchar("nonceDigest", { length: 64 }).primaryKey(),
    purpose: mysqlEnum("purpose", ["login", "google_calendar"]).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    expiresAtIdx: index("idx_oauth_state_nonces_expires_at").on(
      table.expiresAt
    ),
  })
);
