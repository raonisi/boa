import * as XLSX from "xlsx";
import {
  ACTION_PLAN_STATUS_LABELS,
  type ActionPlanStatus,
} from "@shared/actionPlans";
import { assertNoSensitiveActionPlanReportData } from "./actionPlanSensitiveGuard";
import type {
  BranchActionPlan,
  DailyActionPlan,
  WeeklyActionPlan,
} from "../drizzle/schema";

type ReportUser = {
  id: number;
  name: string | null;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  branch_admin: "지점장",
  sub_branch_admin: "부지점장",
  team_leader: "팀장",
  member: "팀원",
};

export type ExecutiveReportInput = {
  reportMonth: string;
  reportWeekLabel: string;
  branchName: string;
  generatedByName: string;
  generatedAt: Date;
  branchSummary?: string;
  branchStrategy?: string;
  keyRisks?: string;
  supportRequest?: string;
  executiveMessage?: string;
  monthlyDirection?: string;
  weeklyFocus?: string;
  growthMembers?: string;
  coachingMembers?: string;
  orgIssues?: string;
};

export type ExecutiveReportData = {
  input: ExecutiveReportInput;
  users: ReportUser[];
  monthlyPlans: BranchActionPlan[];
  weeklyPlans: WeeklyActionPlan[];
  dailyPlans: DailyActionPlan[];
};

function statusLabel(status: string) {
  return ACTION_PLAN_STATUS_LABELS[status as ActionPlanStatus] ?? status;
}

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function sumMonthly(plans: BranchActionPlan[], field: keyof BranchActionPlan) {
  return plans.reduce((acc, p) => acc + Number(p[field] ?? 0), 0);
}

function userName(users: ReportUser[], userId: number) {
  return users.find(u => u.id === userId)?.name ?? `사용자 #${userId}`;
}

function userRole(users: ReportUser[], userId: number) {
  const role = users.find(u => u.id === userId)?.role ?? "member";
  return roleLabel(role);
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map(wch => ({ wch }));
}

function buildSummarySheet(data: ExecutiveReportData) {
  const { input, monthlyPlans, users } = data;
  const branchAdminPlan = monthlyPlans.find(
    p => users.find(u => u.id === p.userId)?.role === "branch_admin"
  );
  const rows: (string | number)[][] = [
    ["대표 보고 요약"],
    [],
    ["보고월", input.reportMonth],
    ["보고 주차", input.reportWeekLabel],
    ["지점명", input.branchName],
    ["보고자", input.generatedByName],
    ["작성일", input.generatedAt.toLocaleDateString("ko-KR")],
    [],
    [
      "지점 총 월간 신규 계약 목표",
      sumMonthly(monthlyPlans, "monthlyContractTarget"),
    ],
    [
      "지점 총 월납보험료 목표",
      sumMonthly(monthlyPlans, "monthlyPremiumTarget"),
    ],
    [
      "지점 총 상담 목표",
      sumMonthly(monthlyPlans, "monthlyConsultationTarget"),
    ],
    [],
    ["지점장 본인 계획", branchAdminPlan?.monthlyStrategy ?? ""],
    ["지점 핵심 전략", input.branchStrategy ?? ""],
    ["주요 리스크", input.keyRisks ?? ""],
    ["대표 요청사항", input.supportRequest ?? ""],
    ["지점장 종합 의견", input.executiveMessage ?? ""],
    ["지점 운영 요약", input.branchSummary ?? ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [28, 60]);
  return ws;
}

function buildMonthlySheet(data: ExecutiveReportData) {
  const { users, monthlyPlans } = data;
  const header = [
    "작성자",
    "역할",
    "월 목표 매출",
    "월 목표 신규 계약",
    "월 목표 신규상담",
    "월 목표 접촉 수",
    "월 목표 보장분석 수",
    "월 목표 제안 수",
    "주력 고객군",
    "핵심 전략",
    "준비상태",
    "지원 요청",
    "제출상태",
  ];
  const rows: (string | number)[][] = [header];
  for (const user of users) {
    const plan = monthlyPlans.find(p => p.userId === user.id);
    rows.push([
      user.name ?? `사용자 #${user.id}`,
      roleLabel(user.role),
      plan?.monthlyRevenueTarget ?? plan?.monthlyPremiumTarget ?? 0,
      plan?.monthlyContractTarget ?? 0,
      plan?.monthlyNewConsultationTarget ??
        plan?.monthlyConsultationTarget ??
        0,
      plan?.monthlyContactTarget ?? plan?.monthlyCallTarget ?? 0,
      plan?.monthlyAnalysisTarget ?? 0,
      plan?.monthlyProposalTarget ?? 0,
      plan?.primaryCustomerSegment ?? plan?.focusCustomerGroup ?? "",
      plan?.monthlyStrategy ?? "",
      plan?.monthlyPreparationStatus ?? plan?.preparationMemo ?? "",
      plan?.supportRequest ?? "",
      plan ? statusLabel(plan.status) : "미작성",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(
    ws,
    [12, 10, 14, 16, 12, 10, 10, 12, 18, 24, 18, 18, 18, 12, 14]
  );
  return ws;
}

function buildWeeklySheet(data: ExecutiveReportData) {
  const { users, weeklyPlans } = data;
  const header = [
    "작성자",
    "역할",
    "기준월",
    "기준주차",
    "주간 목표 매출",
    "주간 목표 신규 계약",
    "주간 목표 상담",
    "이번 주 만날 고객군",
    "핵심 고객/DB",
    "고객 단계",
    "제안 준비 상품군",
    "제안 준비 보장영역",
    "예상 장애요인",
    "지원 요청",
  ];
  const rows: (string | number)[][] = [header];
  for (const plan of weeklyPlans) {
    rows.push([
      userName(users, plan.userId),
      userRole(users, plan.userId),
      plan.targetMonth ?? "",
      plan.weekLabel,
      plan.weeklyRevenueTarget ?? plan.weeklyPremiumTarget ?? 0,
      plan.weeklyContractTarget,
      plan.weeklyConsultationTarget,
      plan.targetCustomerSegment ?? plan.focusCustomerGroup ?? "",
      plan.targetCustomerReference ?? "",
      plan.customerStage ?? "",
      plan.proposedProductCategory ?? "",
      plan.proposedCoverageArea ?? "",
      plan.expectedRisk ?? "",
      plan.supportRequest ?? "",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(
    ws,
    [12, 10, 10, 14, 16, 12, 10, 10, 10, 10, 12, 24, 18, 18, 18]
  );
  return ws;
}

function buildDailySheet(data: ExecutiveReportData) {
  const { users, dailyPlans } = data;
  const header = [
    "날짜",
    "이름",
    "역할",
    "전화 목표",
    "카톡 목표",
    "상담 목표",
    "방문 목표",
    "제안서 목표",
    "후속관리 목표",
    "오늘 우선순위",
    "마감 회고",
    "다음날 보완점",
  ];
  const rows: (string | number)[][] = [header];
  for (const plan of dailyPlans) {
    const dateStr =
      plan.planDate instanceof Date
        ? plan.planDate.toISOString().slice(0, 10)
        : String(plan.planDate).slice(0, 10);
    rows.push([
      dateStr,
      userName(users, plan.userId),
      userRole(users, plan.userId),
      plan.callTarget,
      plan.messageTarget,
      plan.consultationTarget,
      plan.visitTarget,
      plan.proposalTarget,
      plan.followUpTarget,
      plan.todayPriority ?? "",
      plan.actualResultMemo ?? "",
      plan.nextDayMemo ?? "",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [12, 12, 10, 10, 10, 10, 10, 10, 12, 24, 24, 24]);
  return ws;
}

function buildExecutiveSheet(data: ExecutiveReportData) {
  const { input } = data;
  const rows: (string | number)[][] = [
    ["지점장 종합 보고"],
    [],
    [
      "이번 달 지점 운영 방향",
      input.monthlyDirection ?? input.branchSummary ?? "",
    ],
    ["이번 주 집중 과제", input.weeklyFocus ?? ""],
    ["성장 가능 인원", input.growthMembers ?? ""],
    ["집중 코칭 필요 인원", input.coachingMembers ?? ""],
    ["조직 운영 이슈", input.orgIssues ?? ""],
    ["대표님께 보고할 핵심 메시지", input.executiveMessage ?? ""],
    ["지원 요청사항", input.supportRequest ?? ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [28, 60]);
  return ws;
}

function buildSubmissionSheet(data: ExecutiveReportData) {
  const { users, monthlyPlans, weeklyPlans, dailyPlans, input } = data;
  const header = [
    "이름",
    "역할",
    "월간 계획 제출 여부",
    "주간 계획 제출 여부",
    "일일 계획 제출 여부",
    "마지막 제출일",
    "상태",
    "조치 필요 여부",
  ];
  const rows: (string | number)[][] = [header];
  const weekPlans = weeklyPlans.filter(
    p => p.weekLabel === input.reportWeekLabel
  );

  for (const user of users) {
    const monthly = monthlyPlans.find(p => p.userId === user.id);
    const weekly = weekPlans.find(p => p.userId === user.id);
    const userDaily = dailyPlans.filter(p => p.userId === user.id);
    const dailySubmitted = userDaily.some(
      p => p.status === "submitted" || p.status === "reviewed"
    );
    const monthlySubmitted =
      monthly?.status === "submitted" ||
      monthly?.status === "reviewed" ||
      monthly?.status === "revision_requested";
    const weeklySubmitted =
      weekly?.status === "submitted" ||
      weekly?.status === "reviewed" ||
      weekly?.status === "revision_requested";

    const lastSubmitted = [
      monthly?.submittedAt,
      weekly?.submittedAt,
      ...userDaily.map(d => d.submittedAt),
    ]
      .filter(Boolean)
      .map(d => new Date(d as Date).getTime())
      .sort((a, b) => b - a)[0];

    const needsAction =
      !monthlySubmitted ||
      !weeklySubmitted ||
      !dailySubmitted ||
      monthly?.status === "revision_requested" ||
      weekly?.status === "revision_requested";

    rows.push([
      user.name ?? `사용자 #${user.id}`,
      roleLabel(user.role),
      monthlySubmitted ? "제출" : "미제출",
      weeklySubmitted ? "제출" : "미제출",
      dailySubmitted ? "제출" : "미제출",
      lastSubmitted ? new Date(lastSubmitted).toLocaleDateString("ko-KR") : "-",
      monthly ? statusLabel(monthly.status) : "미작성",
      needsAction ? "필요" : "없음",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [12, 10, 14, 14, 14, 14, 12, 12]);
  return ws;
}

export function buildExecutiveActionPlanWorkbook(data: ExecutiveReportData) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), "대표 보고 요약");
  XLSX.utils.book_append_sheet(
    wb,
    buildMonthlySheet(data),
    "지점원별 월간 목표"
  );
  XLSX.utils.book_append_sheet(wb, buildWeeklySheet(data), "주간 계획");
  XLSX.utils.book_append_sheet(wb, buildDailySheet(data), "일일 계획·결과");
  XLSX.utils.book_append_sheet(
    wb,
    buildExecutiveSheet(data),
    "지점장 종합 보고"
  );
  XLSX.utils.book_append_sheet(wb, buildSubmissionSheet(data), "코칭·주의신호");
  return wb;
}

export function buildExecutiveActionPlanXlsxBuffer(data: ExecutiveReportData) {
  const wb = buildExecutiveActionPlanWorkbook(data);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function executiveReportFilename(
  reportMonth: string,
  reportWeekLabel: string
) {
  const weekPart = reportWeekLabel.replace(/\s+/g, "");
  return `BOA_대표보고_실행계획_${reportMonth}_${weekPart}.xlsx`;
}

/** @deprecated use assertNoSensitiveActionPlanReportData */
export function assertReportHasNoSensitiveData(data: ExecutiveReportData) {
  assertNoSensitiveActionPlanReportData({
    monthlyPlans: data.monthlyPlans as unknown as Record<string, unknown>[],
    weeklyPlans: data.weeklyPlans as unknown as Record<string, unknown>[],
    dailyPlans: data.dailyPlans as unknown as Record<string, unknown>[],
    executive: data.input,
  });
}
