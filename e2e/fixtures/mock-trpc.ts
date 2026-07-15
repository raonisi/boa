import type { Page, Route } from "@playwright/test";
import SuperJSON from "superjson";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
type MockOptions = {
  permissions?: string[];
  accountStatus?: "active" | "inactive" | "resigned";
  customerDetailDenied?: boolean;
};

const fixtureToday = new Date();
const now = new Date(
  fixtureToday.getFullYear(),
  fixtureToday.getMonth(),
  fixtureToday.getDate(),
  9,
  0,
  0
).toISOString();
const oneHourAfterNow = new Date(
  fixtureToday.getFullYear(),
  fixtureToday.getMonth(),
  fixtureToday.getDate(),
  10,
  0,
  0
).toISOString();

function userFor(role: Role, options?: MockOptions) {
  const accountStatus = options?.accountStatus ?? "active";
  const profileByRole: Record<
    Role,
    { id: number; name: string; teamId: number | null; subBranchAdminId: number | null; parentUserId: number | null }
  > = {
    branch_admin: {
      id: 1,
      name: "[E2E] Branch Admin",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: null,
    },
    sub_branch_admin: {
      id: 2,
      name: "[E2E] Sub Admin",
      teamId: null,
      subBranchAdminId: null,
      parentUserId: 1,
    },
    team_leader: {
      id: 3,
      name: "[E2E] Team Leader",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 2,
    },
    member: {
      id: 4,
      name: "[E2E] Member",
      teamId: 10,
      subBranchAdminId: 2,
      parentUserId: 3,
    },
  };
  const profile = profileByRole[role];
  return {
    id: profile.id,
    openId: `e2e-${role}`,
    email: `${role}@e2e.test`,
    name: profile.name,
    role,
    accountStatus,
    teamId: profile.teamId,
    subBranchAdminId: profile.subBranchAdminId,
    parentUserId: profile.parentUserId,
    sessionInvalidatedAt: null,
    permissions: options?.permissions,
  };
}

const users = [
  userFor("branch_admin"),
  userFor("sub_branch_admin"),
  userFor("team_leader"),
  userFor("member"),
  {
    ...userFor("member"),
    id: 6,
    name: "[TEST] UI Inactive User",
    accountStatus: "inactive" as const,
  },
  {
    ...userFor("member"),
    id: 7,
    name: "[TEST] UI Resigned User",
    accountStatus: "resigned" as const,
  },
];

const customer = {
  id: 101,
  name: "[E2E] Customer Alpha",
  phone: "010-1000-2000",
  birthDate: "1985-05-18",
  gender: "female",
  region: "Seoul",
  source: "E2E Fixture",
  consultStatus: "상담중",
  priority: "A",
  expectedPremium: 120000,
  agentId: 4,
  subBranchAdminId: 2,
  assignmentStatus: "assigned",
  isActive: true,
  createdAt: now,
  assignedAt: now,
  nextAction: "상담기록 추가",
  customerTags: JSON.stringify(["E2E", "smoke"]),
  customerSegment: "database" as const,
  contractCount: 0,
  monthlyPremiumTotal: 0,
  recentContractDate: null,
  consultationCount: 1,
  recentConsultationAt: now,
  followUpCount: 1,
  nextFollowUpAt: oneHourAfterNow,
  activityCount: 1,
  recentActivityAt: now,
};

const activeContract = {
  id: 601,
  customerId: customer.id,
  agentId: 4,
  company: "[E2E] Insurance",
  productName: "[E2E] Active Plan",
  contractStatus: "유지",
  paymentStatus: "정상",
  monthlyPremium: 120000,
  isActive: true,
  deletedAt: null,
  createdAt: now,
};

const pastContract = {
  ...activeContract,
  id: 602,
  productName: "[TEST] Past Plan",
  contractStatus: "해지",
  paymentStatus: "해지",
  isActive: false,
  deletedAt: now,
};

const contractLifecycleEvents = [
  {
    id: 703,
    contractId: activeContract.id,
    customerId: customer.id,
    eventType: "restored",
    effectiveAt: now,
    reason: null,
    monthlyPremiumSnapshot: 120000,
    actorId: 1,
    actorName: "[E2E] Branch Admin",
    actorRole: "branch_admin",
    sourceType: "restore_action",
    sourceId: activeContract.id,
    dedupeKey: "contract-restored:601:test",
    metadata: { previousDeletedAt: "2026-06-30T09:00:00.000Z" },
    createdAt: now,
    deleteRequestStatus: null,
  },
  {
    id: 702,
    contractId: activeContract.id,
    customerId: customer.id,
    eventType: "deleted",
    effectiveAt: "2026-06-30T09:00:00.000Z",
    reason: "[E2E] 입력 정정",
    monthlyPremiumSnapshot: 120000,
    actorId: 1,
    actorName: "[E2E] Branch Admin",
    actorRole: "branch_admin",
    sourceType: "contract",
    sourceId: activeContract.id,
    dedupeKey: "contract-deactivated:601:test",
    metadata: null,
    createdAt: "2026-06-30T09:00:00.000Z",
    deleteRequestStatus: null,
  },
  {
    id: 701,
    contractId: pastContract.id,
    customerId: customer.id,
    eventType: "deleted",
    effectiveAt: now,
    reason: "[TEST] 중복 입력",
    monthlyPremiumSnapshot: 120000,
    actorId: 1,
    actorName: "[E2E] Branch Admin",
    actorRole: "branch_admin",
    sourceType: "delete_request",
    sourceId: 801,
    dedupeKey: "contract-delete-approved:801",
    metadata: { requestStatus: "approved" },
    createdAt: now,
    deleteRequestStatus: "approved",
  },
];

const contractedCustomer = {
  ...customer,
  id: 102,
  name: "[E2E] Contracted Customer",
  customerSegment: "contracted" as const,
  contractCount: 1,
  monthlyPremiumTotal: 120000,
  recentContractDate: now,
};

const todayWork = {
  cards: {
    todayFollowUpCount: 1,
    overdueFollowUpCount: 0,
    todayScheduleCount: 1,
    incompleteScheduleCount: 0,
    pendingNotificationCount: 1,
    monthlyContractCount: 1,
    monthlyPremiumSum: 120000,
    longUnmanagedCustomerCount: 0,
  },
  todayFollowUps: [
    {
      id: 201,
      customerId: customer.id,
      customerName: customer.name,
      nextContactDate: now,
      status: "scheduled",
      note: "[E2E] follow-up",
    },
  ],
  overdueFollowUps: [],
  todaySchedules: [
    {
      id: 301,
      title: "[E2E] 상담 예약",
      startTime: now,
      endTime: oneHourAfterNow,
      status: "예정",
      customerId: customer.id,
      customerName: customer.name,
    },
  ],
  incompleteSchedules: [],
  pendingNotifications: [
    {
      id: 401,
      title: "[E2E] 알림",
      message: "테스트 알림입니다.",
      isRead: false,
      processStatus: "미확인",
      createdAt: now,
      relatedType: "customer",
      relatedId: customer.id,
    },
  ],
  longUnmanagedCustomers: [],
};

const notificationsList = {
  items: [
    {
      id: 401,
      userId: 1,
      type: "schedule_today",
      title: "[E2E] Today notification",
      message: "[E2E] Bulk action target",
      isRead: false,
      processStatus: "미확인",
      dueAt: now,
      createdAt: now,
      relatedType: "schedule",
      relatedId: 301,
    },
    {
      id: 402,
      userId: 1,
      type: "general",
      title: "[E2E] General notification",
      message: "[E2E] Secondary bulk target",
      isRead: true,
      processStatus: "확인",
      dueAt: null,
      createdAt: oneHourAfterNow,
      relatedType: "customer",
      relatedId: customer.id,
    },
  ],
  totalCount: 2,
  hasMore: false,
};

const calendarSchedules = [
  {
    id: 301,
    userId: 4,
    ownerUserId: 4,
    ownerName: "[E2E] Member",
    customerId: customer.id,
    customerDisplayName: customer.name,
    canViewCustomerDetail: true,
    canEdit: true,
    canDelete: true,
    title: "[E2E] 고객 상담 일정",
    type: "고객상담",
    status: "예정",
    startTime: now,
    endTime: oneHourAfterNow,
    memo: "[E2E] calendar customer context",
    reminderOffsetMinutes: 30,
  },
];

const scheduleListResponse = {
  schedules: calendarSchedules,
  users: users.map(user => ({
    userId: user.id,
    name: user.name,
    role: user.role,
    teamId: user.teamId ?? null,
    teamName: user.teamId === 10 ? "[E2E] Team" : null,
    isActive: true as const,
  })),
  teams: [{ teamId: 10, name: "[E2E] Team" }],
};

const salesReport = {
  period: { dateFrom: "2026-05-01", dateTo: "2026-05-18", label: "E2E 기간" },
  scope: {
    label: "전체 조직",
    ownershipScope: "managed",
    canViewRanking: true,
  },
  performance: {
    newContractCount: 1,
    monthlyPremiumTotal: 120000,
    consultationCount: 3,
    goalAchievementRate: 70,
    followUpCreatedCount: 2,
    followUpCompletedCount: 1,
    followUpCompletionRate: 50,
    pendingFollowUpCount: 1,
    longUnmanagedCustomerCount: 0,
    dbToConsultRate: 60,
    consultToContractRate: 33,
    followUpCompleteToContractRate: 20,
  },
  funnel: {
    stages: [
      { key: "db", label: "DB", count: 5, conversionRate: 100 },
      { key: "consult", label: "상담", count: 3, conversionRate: 60 },
      { key: "contract", label: "계약", count: 1, conversionRate: 33 },
    ],
  },
  ranking: [
    {
      userId: 4,
      name: "[E2E] Member",
      role: "member",
      contractCount: 1,
      monthlyPremiumTotal: 120000,
    },
  ],
  bottleneck: {
    stage: "consult",
    label: "상담 전환",
    message: "상담 전환율을 확인하세요.",
  },
};

const operationRisk = {
  period: { dateFrom: "2026-05-12", dateTo: "2026-05-18", label: "최근 7일" },
  overall: {
    score: 18,
    level: "caution",
    message: "주의가 필요한 운영 이벤트가 있습니다.",
  },
  riskCards: [
    {
      category: "download",
      title: "다운로드 점검",
      count: 1,
      score: 8,
      level: "caution",
      description: "사유 확인 필요",
    },
    {
      category: "handoff",
      title: "인수인계 점검",
      count: 0,
      score: 0,
      level: "normal",
      description: "정상",
    },
  ],
  downloadRisk: { total: 1, repeatedUserCount: 0, shortReasonCount: 0 },
  handoffRisk: {
    unresolvedCount: 0,
    inactiveCustomerCount: 0,
    inactiveFollowUpCount: 0,
    inactiveScheduleCount: 0,
  },
  pushRisk: { failed: 0, skipped: 0, inactiveTokens: 0 },
  recentRiskEvents: [
    {
      id: "risk-1",
      level: "low",
      category: "download",
      message: "[E2E] 다운로드 사유 확인",
      createdAt: now,
    },
  ],
  guides: [
    {
      title: "다운로드 사유 점검",
      description: "사유와 대상 범위를 확인하세요.",
      category: "download",
    },
  ],
};

const scopedOperationRisk = {
  scope: { role: "team_leader", label: "팀 리스크" },
  period: {
    dateFrom: "2026-05-12T00:00:00.000Z",
    dateTo: "2026-05-18T23:59:59.999Z",
    label: "최근 7일",
  },
  overall: {
    score: 16,
    level: "caution",
    message: "주의가 필요한 팀 리스크가 있습니다.",
  },
  cards: [
    {
      category: "unresolved",
      title: "미처리 후속관리",
      count: 1,
      score: 8,
      level: "caution",
      description:
        "권한 범위 안의 예정/연기 후속관리 중 기한이 지난 항목입니다.",
      actionLabel: "알림에서 확인",
      href: "/notifications",
    },
    {
      category: "unresolved",
      title: "오래된 미완료 일정",
      count: 1,
      score: 10,
      level: "caution",
      description: "완료 또는 취소되지 않은 오래된 일정입니다.",
      actionLabel: "캘린더 확인",
      href: "/calendar",
    },
    {
      category: "unresolved",
      title: "장기 미관리 고객",
      count: 0,
      score: 0,
      level: "normal",
      description: "최근 관리 이력이 오래된 산하 고객입니다.",
      actionLabel: "고객 DB 확인",
      href: "/customers",
    },
    {
      category: "unresolved",
      title: "미확인 알림",
      count: 1,
      score: 3,
      level: "normal",
      description: "읽지 않았거나 처리 완료되지 않은 산하 업무 알림입니다.",
      actionLabel: "알림센터 확인",
      href: "/notifications",
    },
    {
      category: "handoff",
      title: "배정/인수인계 확인 필요",
      count: 0,
      score: 0,
      level: "normal",
      description: "권한 범위 안에서 담당자 배정 확인이 필요한 고객입니다.",
      actionLabel: "DB 배정 확인",
      href: "/customers/assign",
    },
  ],
};

const downloadPreview = {
  customers: {
    rowCount: 1,
    fields: [
      { key: "name", label: "이름", sensitive: true },
      { key: "birthDate", label: "생년월일", sensitive: true },
      { key: "phone", label: "연락처", sensitive: true },
      { key: "consultStatus", label: "상담상태", sensitive: false },
    ],
  },
  contracts: {
    rowCount: 0,
    fields: [{ key: "productName", label: "상품명", sensitive: true }],
  },
  schedules: {
    rowCount: 1,
    fields: [{ key: "title", label: "일정 제목", sensitive: true }],
  },
  performance: {
    rowCount: 1,
    fields: [
      { key: "monthlyPremiumTotal", label: "월납보험료 합계", sensitive: true },
    ],
  },
};

const defaults: Record<string, unknown> = {
  "auth.me": userFor("branch_admin"),
  "notifications.unreadCount": 1,
  "notifications.list": notificationsList,
  "dashboard.todayWork": todayWork,
  "recommendations.dashboardSummary": {
    priorityContactCount: 1,
    highUrgencyCount: 0,
    warningCount: 1,
    topContacts: [],
  },
  "performanceGoals.dashboard": { items: [] },
  "workRhythm.summary": {
    consultationCount: 3,
    followUpCompletionRate: 50,
    overdueFollowUpCount: 0,
    recommendedTodayActions: { suggestedConsultationCount: 1 },
    remaining: { contractCount: 1, monthlyPremium: 120000 },
    dailyRequired: { contractCount: 1 },
    insights: ["[E2E] 오늘 상담을 먼저 처리하세요."],
  },
  "performance.stats": { assigned: 1, contracts: 1, monthlyPremium: 120000 },
  "customers.list": [customer],
  "customers.segmentCounts": { all: 2, database: 1, contracted: 1 },
  "scheduleChangeRequests.summary": {
    pending: 2,
    today: 2,
    conflict: 0,
    monthApproved: 1,
    monthRejected: 0,
  },
  "customers.get": customer,
  "schedules.list": scheduleListResponse,
  "customers.downloadImportTemplate": {
    headers: [
      "name",
      "birthDate",
      "phone",
      "gender",
      "region",
      "expectedPremium",
      "availableTime",
      "source",
      "consultStatus",
      "memo",
      "agent",
    ],
    csvContent:
      "name,birthDate,phone,gender,region,expectedPremium,availableTime,source,consultStatus,memo,agent",
    requiredHeaders: ["name", "birthDate", "phone"],
    optionalHeaders: [
      "gender",
      "region",
      "expectedPremium",
      "availableTime",
      "source",
      "consultStatus",
      "memo",
      "agent",
    ],
    assigneeHeaderEnabled: true,
  },
  "recommendations.priorityContacts": [
    {
      customerId: customer.id,
      urgency: "medium",
      warnings: [
        { warningType: "no_next_action", message: "[E2E] 다음 행동 확인" },
      ],
      reasons: [{ title: "상담 필요", label: "상담", points: 10 }],
    },
  ],
  "users.list": users,
  "settings.formOptions": [],
  "consultations.list": [
    {
      id: 501,
      customerId: customer.id,
      content: "[E2E] 상담 메모",
      status: "진행",
      createdAt: now,
      consultationDate: now,
    },
  ],
  "contracts.list": [],
  "contracts.listByCustomer": [activeContract],
  "contracts.historyByCustomer": [activeContract, pastContract],
  "contracts.lifecycleByCustomer": contractLifecycleEvents,
  "customers.statusHistory": [],
  "customers.consentLogs": [],
  "customers.assignmentHistory": [],
  "customers.timeline": { items: [], totalCount: 0 },
  "customerRelationships.list": [],
  "customerRelationships.relationFlags": {},
  "customerRelationships.searchCustomers": {
    items: [],
    searchRequired: true,
    hint: "2자 이상 입력해 주세요.",
  },
  "followUps.listByCustomer": [],
  "consultationTools.listCustomerChecks": { templates: [], results: [] },
  "consultationTools.listMessageTemplates": [],
  "consultationTools.renderMessageTemplate": null,
  "consultationScripts.list": [],
  "customerHandoffNotes.listByCustomer": [],
  "recommendations.customerContactReasons": {
    recommendedAction: "상담기록 추가",
    reasons: [],
    warnings: [],
  },
  "salesReports.filterOptions": {
    subBranches: [{ id: 2, name: "[E2E] Sub" }],
    teams: [{ id: 10, name: "[E2E] Team" }],
    users,
  },
  "salesReports.summary": salesReport,
  "operationRisk.summary": operationRisk,
  "operationRisk.scopedSummary": scopedOperationRisk,
  "pushNotifications.operationSummary": {
    total: 2,
    sent: 1,
    failed: 0,
    skipped: 1,
    inactiveTokens: 0,
  },
  "managementReports.filterOptions": {
    reportTypes: ["daily", "weekly", "monthly", "team", "sub_branch"],
    subBranches: [{ id: 2, name: "[E2E] Sub Admin" }],
    teams: [{ id: 10, name: "[E2E] Team", subBranchAdminId: 2 }],
    users,
  },
  "customerDataQuality.filterOptions": {
    issueTypes: [
      { type: "missing_phone", label: "전화번호 누락", severity: "high" },
    ],
    qualityLevels: [{ value: "good", label: "양호" }],
    assignees: [
      {
        id: 4,
        name: "[E2E] Member",
        role: "member",
        teamId: 10,
        subBranchAdminId: 2,
      },
    ],
    teams: [{ id: 10, name: "[E2E] Team" }],
    subBranches: [{ id: 2, name: "[E2E] Sub Admin" }],
    canViewAssigneeBreakdown: true,
    memberViewLabel: "고객 데이터 품질 점검",
  },
  "customerDataQuality.dashboard": {
    scope: {
      role: "branch_admin",
      userId: 1,
      teamId: null,
      subBranchAdminId: null,
      canViewAssigneeBreakdown: true,
    },
    summary: {
      customerCount: 1,
      cleanCustomerCount: 0,
      issueCustomerCount: 1,
      averageQualityScore: 75,
      missingPhoneCount: 0,
      missingBirthDateCount: 0,
      missingStatusCount: 0,
      unassignedCustomerCount: 0,
      noFollowUpCount: 1,
      longUnmanagedCount: 0,
      duplicateCandidateCount: 0,
      excessiveTagCount: 0,
      contractWithoutConsultationCount: 0,
      delayedFollowUpOrScheduleCount: 0,
      criticalCustomerCount: 0,
    },
    issueTypes: [
      {
        type: "no_follow_up",
        label: "후속관리 없음",
        count: 1,
        severity: "medium",
        description:
          "상담기록은 있으나 다음 연락 또는 후속관리 계획이 없습니다.",
        recommendedAction: "다음 연락일을 등록하세요.",
      },
    ],
    assignees: [
      {
        userId: 4,
        name: "[E2E] Member",
        role: "member",
        teamName: "[E2E] Team",
        subBranchName: "[E2E] Sub Admin",
        customerCount: 1,
        issueCustomerCount: 1,
        averageQualityScore: 75,
        priorityIssueCount: 0,
        missingPhoneCount: 0,
        missingStatusCount: 0,
        noFollowUpCount: 1,
        longUnmanagedCount: 0,
        duplicateCandidateCount: 0,
      },
    ],
    customers: [
      {
        customerId: customer.id,
        customerDisplayName: "[E2E] C*****a",
        assignedUserId: 4,
        assignedUserName: "[E2E] Member",
        status: "상담중",
        qualityScore: 75,
        qualityLevel: "needs_improvement",
        qualityLevelLabel: "보완 필요",
        issueTypes: ["no_follow_up"],
        issueLabels: ["후속관리 없음"],
        lastManagedAt: now,
        recommendedAction: "다음 연락일을 등록하세요.",
        links: {
          customerDetail: `/customers/${customer.id}`,
          customerList: "/customers",
          followUp: `/customers/${customer.id}`,
          merge: "/customers/merge",
          assign: "/customers/assign",
        },
      },
    ],
    pagination: { total: 1, limit: 25, offset: 0 },
  },
  "managementReports.generate": {
    reportMeta: {
      reportType: "weekly",
      periodType: "week",
      dateFrom: now,
      dateTo: oneHourAfterNow,
      generatedAt: now,
      generatedBy: { id: 1, name: "[E2E] Branch Admin", role: "branch_admin" },
      scope: {
        type: "all",
        label: "전체 조직",
        targetTeamId: null,
        targetSubBranchId: null,
        targetUserId: null,
      },
    },
    summary: {
      activeUserCount: 2,
      customerCount: 1,
      consultationCount: 1,
      followUpCount: 1,
      completedFollowUpCount: 1,
      overdueFollowUpCount: 0,
      incompleteScheduleCount: 0,
      unreadNotificationCount: 1,
      newContractCount: 1,
      longUnmanagedCustomerCount: 0,
      goalAchievementRate: 70,
      followUpCompletionRate: 100,
      todayFollowUpCount: 1,
      todayCompletedFollowUpCount: 1,
      newCustomerCount: 0,
      priorityAManagementRate: 100,
      firstContactSlaDelayCount: 0,
    },
    topIssues: [
      {
        type: "unread_notification",
        label: "미확인 알림",
        count: 1,
        severity: "medium",
        recommendation: "미확인 알림을 차례로 처리해 주세요.",
      },
    ],
    users: [
      {
        userId: 4,
        name: "[E2E] Member",
        role: "member",
        teamName: "[E2E] Team",
        subBranchName: "기본 부지점",
        metrics: {
          consultationCount: 1,
          followUpCount: 1,
          completedFollowUpCount: 1,
          followUpCompletionRate: 100,
          overdueFollowUpCount: 0,
          todayFollowUpCount: 1,
          incompleteScheduleCount: 0,
          unreadNotificationCount: 1,
          newContractCount: 1,
          unconsultedDbCount: 0,
          longUnmanagedCustomerCount: 0,
          priorityACount: 0,
          priorityAManagedCount: 0,
          priorityAManagementRate: null,
          newCustomerCount: 0,
        },
        riskLevel: "low",
        coachingPoint:
          "현재 흐름을 유지하되, 오늘 예정 업무를 먼저 마무리해 주세요.",
      },
    ],
    narrativeSummary:
      "이번 주 주간 운영 보고서 기준으로 전체 조직 운영 현황을 정리했습니다.",
    copyableSummary:
      "이번 주 주간 운영 보고서 요약입니다.\n\n• 후속관리 지연: 0건",
    empty: false,
  },
  "adminAudit.summary": {
    cards: {
      total: 1,
      risky: 1,
      downloads: 1,
      deletes: 0,
      users: 0,
      customers: 0,
    },
  },
  "adminAudit.logSearch": {
    items: [
      {
        id: 701,
        action: "DATA_DOWNLOAD",
        actorName: "[E2E] Branch Admin",
        targetType: "customer",
        reason: "[E2E] audit reason",
        summary: "[E2E] safe summary",
        createdAt: now,
      },
    ],
    total: 1,
  },
  "download.preview": downloadPreview,
  "deletedData.listTeams": [],
  "deletedData.listCustomers": [
    {
      id: 901,
      name: "[TEST] Deleted Customer",
      deletedAt: now,
      createdAt: now,
    },
  ],
  "deletedData.listContracts": [],
  "deletedData.permanentDeletePreview": {
    canDelete: true,
    linkedCount: 0,
    blockers: {},
  },
  "deleteRequests.listAllRequestsForAdmin": [],
};

const outOfScopeCustomer = {
  ...customer,
  id: 202,
  name: "[TEST] UI Out of Scope",
  agentId: 99,
};

function responseFor(procedure: string, role: Role, options?: MockOptions) {
  if (procedure === "auth.me") return userFor(role, options);
  if (procedure === "customers.list") return [customer, contractedCustomer];
  return defaults[procedure] ?? null;
}

function serialize(data: unknown) {
  return { result: { data: SuperJSON.serialize(data) } };
}

function extractCustomerIdFromRequest(route: Route, url: URL): number | null {
  const blob = `${url.search}\n${route.request().postData() ?? ""}`;
  const explicit = blob.match(/"id"\s*:\s*(\d+)/);
  if (explicit) return Number(explicit[1]);
  if (url.pathname.includes("customers.get") && /\b202\b/.test(blob)) {
    return outOfScopeCustomer.id;
  }
  return null;
}

async function fulfillTrpc(route: Route, role: Role, options?: MockOptions) {
  const url = new URL(route.request().url());
  const rawPath = decodeURIComponent(
    url.pathname.replace(/^\/api\/trpc\/?/, "")
  );
  const procedures = rawPath.split(",").filter(Boolean);

  const body = procedures.map(procedure => {
    if (procedure === "customers.get") {
      const payload = `${url.search}\n${route.request().postData() ?? ""}`;
      const requestedId = extractCustomerIdFromRequest(route, url);
      if (
        options?.customerDetailDenied ||
        requestedId === outOfScopeCustomer.id ||
        /:\s*202\b/.test(payload)
      ) {
        return serialize(null);
      }
      return serialize(customer);
    }
    if (procedure === "customers.list") {
      const payload = decodeURIComponent(
        `${url.search}\n${route.request().postData() ?? ""}`
      );
      if (/"segment"\s*:\s*"database"/.test(payload)) {
        return serialize([customer]);
      }
      if (/"segment"\s*:\s*"contracted"/.test(payload)) {
        return serialize([contractedCustomer]);
      }
    }
    return serialize(responseFor(procedure, role, options));
  });

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(
      url.searchParams.get("batch") === "1" ? body : body[0]
    ),
  });
}

export async function mockBoaTrpc(
  page: Page,
  role: Role = "branch_admin",
  options?: MockOptions
) {
  await page.route("**/api/trpc/**", route =>
    fulfillTrpc(route, role, options)
  );
}
