import type { Page, Route } from "@playwright/test";
import SuperJSON from "superjson";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
type MockOptions = {
  permissions?: string[];
};

const now = "2026-05-18T09:00:00.000Z";

function userFor(role: Role, options?: MockOptions) {
  return {
    id: role === "member" ? 4 : 1,
    openId: `e2e-${role}`,
    email: `${role}@e2e.test`,
    name: role === "member" ? "[E2E] Member" : "[E2E] Branch Admin",
    role,
    accountStatus: "active",
    teamId: role === "member" ? 10 : null,
    subBranchAdminId: role === "member" ? 2 : null,
    parentUserId: role === "member" ? 3 : null,
    sessionInvalidatedAt: null,
    permissions: options?.permissions,
  };
}

const users = [
  userFor("branch_admin"),
  { ...userFor("sub_branch_admin"), id: 2, name: "[E2E] Sub Admin", parentUserId: 1 },
  { ...userFor("team_leader"), id: 3, name: "[E2E] Team Leader", teamId: 10, subBranchAdminId: 2, parentUserId: 2 },
  userFor("member"),
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
    { id: 201, customerId: customer.id, customerName: customer.name, nextContactDate: now, status: "scheduled", note: "[E2E] follow-up" },
  ],
  overdueFollowUps: [],
  todaySchedules: [
    { id: 301, title: "[E2E] 상담 예약", startTime: now, endTime: "2026-05-18T10:00:00.000Z", status: "예정", customerId: customer.id, customerName: customer.name },
  ],
  incompleteSchedules: [],
  pendingNotifications: [
    { id: 401, title: "[E2E] 알림", message: "테스트 알림입니다.", isRead: false, processStatus: "미확인", createdAt: now, relatedType: "customer", relatedId: customer.id },
  ],
  longUnmanagedCustomers: [],
};

const schedules = [
  {
    id: 301,
    userId: 4,
    customerId: customer.id,
    title: "[E2E] 고객 상담 일정",
    type: "고객상담",
    status: "예정",
    startTime: now,
    endTime: "2026-05-18T10:00:00.000Z",
    memo: "[E2E] calendar customer context",
    reminderOffsetMinutes: 30,
    isActive: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  },
];

const salesReport = {
  period: { dateFrom: "2026-05-01", dateTo: "2026-05-18", label: "E2E 기간" },
  scope: { label: "전체 조직", ownershipScope: "managed", canViewRanking: true },
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
  ranking: [{ userId: 4, name: "[E2E] Member", role: "member", contractCount: 1, monthlyPremiumTotal: 120000 }],
  bottleneck: { stage: "consult", label: "상담 전환", message: "상담 전환율을 확인하세요." },
};

const operationRisk = {
  period: { dateFrom: "2026-05-12", dateTo: "2026-05-18", label: "최근 7일" },
  overall: { score: 18, level: "caution", message: "주의가 필요한 운영 이벤트가 있습니다." },
  riskCards: [
    { category: "download", title: "다운로드 점검", count: 1, score: 8, level: "caution", description: "사유 확인 필요" },
    { category: "handoff", title: "인수인계 점검", count: 0, score: 0, level: "normal", description: "정상" },
  ],
  downloadRisk: { total: 1, repeatedUserCount: 0, shortReasonCount: 0 },
  handoffRisk: { unresolvedCount: 0, inactiveCustomerCount: 0, inactiveFollowUpCount: 0, inactiveScheduleCount: 0 },
  pushRisk: { failed: 0, skipped: 0, inactiveTokens: 0 },
  recentRiskEvents: [{ id: "risk-1", level: "low", category: "download", message: "[E2E] 다운로드 사유 확인", createdAt: now }],
  guides: [{ title: "다운로드 사유 점검", description: "사유와 대상 범위를 확인하세요.", category: "download" }],
};

const scopedOperationRisk = {
  scope: { role: "team_leader", label: "팀 리스크" },
  period: { dateFrom: "2026-05-12T00:00:00.000Z", dateTo: "2026-05-18T23:59:59.999Z", label: "최근 7일" },
  overall: { score: 16, level: "caution", message: "주의가 필요한 팀 리스크가 있습니다." },
  cards: [
    { category: "unresolved", title: "미처리 후속관리", count: 1, score: 8, level: "caution", description: "권한 범위 안의 예정/연기 후속관리 중 기한이 지난 항목입니다.", actionLabel: "알림에서 확인", href: "/notifications" },
    { category: "unresolved", title: "오래된 미완료 일정", count: 1, score: 10, level: "caution", description: "완료 또는 취소되지 않은 오래된 일정입니다.", actionLabel: "캘린더 확인", href: "/calendar" },
    { category: "unresolved", title: "장기 미관리 고객", count: 0, score: 0, level: "normal", description: "최근 관리 이력이 오래된 산하 고객입니다.", actionLabel: "고객 DB 확인", href: "/customers" },
    { category: "unresolved", title: "미확인 알림", count: 1, score: 3, level: "normal", description: "읽지 않았거나 처리 완료되지 않은 산하 업무 알림입니다.", actionLabel: "알림센터 확인", href: "/notifications" },
    { category: "handoff", title: "배정/인수인계 확인 필요", count: 0, score: 0, level: "normal", description: "권한 범위 안에서 담당자 배정 확인이 필요한 고객입니다.", actionLabel: "DB 배정 확인", href: "/customers/assign" },
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
  contracts: { rowCount: 0, fields: [{ key: "productName", label: "상품명", sensitive: true }] },
  schedules: { rowCount: 1, fields: [{ key: "title", label: "일정 제목", sensitive: true }] },
  performance: { rowCount: 1, fields: [{ key: "monthlyPremiumTotal", label: "월납보험료 합계", sensitive: true }] },
};

const defaults: Record<string, unknown> = {
  "auth.me": userFor("branch_admin"),
  "notifications.unreadCount": 1,
  "dashboard.todayWork": todayWork,
  "recommendations.dashboardSummary": { priorityContactCount: 1, highUrgencyCount: 0, warningCount: 1, topContacts: [] },
  "performanceGoals.dashboard": { items: [] },
  "workRhythm.summary": { consultationCount: 3, followUpCompletionRate: 50, overdueFollowUpCount: 0, recommendedTodayActions: { suggestedConsultationCount: 1 }, remaining: { contractCount: 1, monthlyPremium: 120000 }, dailyRequired: { contractCount: 1 }, insights: ["[E2E] 오늘 상담을 먼저 처리하세요."] },
  "performance.stats": { assigned: 1, contracts: 1, monthlyPremium: 120000 },
  "customers.list": [customer],
  "customers.get": customer,
  "schedules.list": schedules,
  "customers.downloadImportTemplate": {
    headers: ["name", "birthDate", "phone", "gender", "region", "expectedPremium", "availableTime", "source", "consultStatus", "memo", "agent"],
    csvContent: "name,birthDate,phone,gender,region,expectedPremium,availableTime,source,consultStatus,memo,agent",
    requiredHeaders: ["name", "birthDate", "phone"],
    optionalHeaders: ["gender", "region", "expectedPremium", "availableTime", "source", "consultStatus", "memo", "agent"],
    assigneeHeaderEnabled: true,
  },
  "recommendations.priorityContacts": [{ customerId: customer.id, urgency: "medium", warnings: [{ warningType: "no_next_action", message: "[E2E] 다음 행동 확인" }], reasons: [{ title: "상담 필요", label: "상담", points: 10 }] }],
  "users.list": users,
  "settings.formOptions": [],
  "consultations.list": [{ id: 501, customerId: customer.id, content: "[E2E] 상담 메모", status: "진행", createdAt: now, consultationDate: now }],
  "contracts.list": [],
  "contracts.listByCustomer": [],
  "customers.statusHistory": [],
  "customers.consentLogs": [],
  "customers.assignmentHistory": [],
  "customers.timeline": { items: [], totalCount: 0 },
  "followUps.listByCustomer": [],
  "consultationTools.listCustomerChecks": { templates: [], results: [] },
  "consultationTools.listMessageTemplates": [],
  "consultationTools.renderMessageTemplate": null,
  "consultationScripts.list": [],
  "customerHandoffNotes.listByCustomer": [],
  "recommendations.customerContactReasons": { recommendedAction: "상담기록 추가", reasons: [], warnings: [] },
  "salesReports.filterOptions": { subBranches: [{ id: 2, name: "[E2E] Sub" }], teams: [{ id: 10, name: "[E2E] Team" }], users },
  "salesReports.summary": salesReport,
  "operationRisk.summary": operationRisk,
  "operationRisk.scopedSummary": scopedOperationRisk,
  "adminAudit.summary": { cards: { total: 1, risky: 1, downloads: 1, deletes: 0, users: 0, customers: 0 } },
  "adminAudit.logSearch": { items: [{ id: 701, action: "DATA_DOWNLOAD", actorName: "[E2E] Branch Admin", targetType: "customer", reason: "[E2E] audit reason", summary: "[E2E] safe summary", createdAt: now }], total: 1 },
  "download.preview": downloadPreview,
};

function responseFor(procedure: string, role: Role, options?: MockOptions) {
  if (procedure === "auth.me") return userFor(role, options);
  return defaults[procedure] ?? null;
}

function serialize(data: unknown) {
  return { result: { data: SuperJSON.serialize(data) } };
}

async function fulfillTrpc(route: Route, role: Role, options?: MockOptions) {
  const url = new URL(route.request().url());
  const rawPath = decodeURIComponent(url.pathname.replace(/^\/api\/trpc\/?/, ""));
  const procedures = rawPath.split(",").filter(Boolean);
  const body = procedures.map((procedure) => serialize(responseFor(procedure, role, options)));

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(url.searchParams.get("batch") === "1" ? body : body[0]),
  });
}

export async function mockBoaTrpc(page: Page, role: Role = "branch_admin", options?: MockOptions) {
  await page.route("**/api/trpc/**", (route) => fulfillTrpc(route, role, options));
}
