import { TRPCError } from "@trpc/server";

export const ACTION_PLAN_SENSITIVE_ERROR =
  "실행계획과 대표 보고서에는 고객 식별정보를 입력할 수 없습니다.";

/** 라벨 뒤 일반 업무 표현(이름 아님) — 과차단 방지 */
const LABEL_FOLLOWING_NON_NAME_TOKENS = new Set([
  "보호",
  "기준",
  "설명",
  "관점",
  "중심",
  "대상",
  "확보",
  "유지",
  "관리",
  "교육",
  "지원",
  "협력",
  "접촉",
  "상담",
  "영업",
  "성향",
  "배정",
  "문의",
  "응대",
  "전략",
  "검토",
  "확인",
  "변경",
  "선정",
  "대응",
  "조치",
  "개선",
  "강화",
  "추진",
  "집중",
  "육성",
  "강화",
  "분류",
  "구분",
  "이관",
  "이전",
  "현황",
  "파악",
  "분석",
]);

const CUSTOMER_ID_LABEL_PATTERN =
  /(?:고객명|고객\s*이름|고객성명|고객\s*성명|계약자명|피보험자명|수익자명|가입자명|상담\s*고객|대상\s*고객|대상고객|보험대상자|계약자|피보험자|수익자|가입자|청약자|민원인|보호자)\s*[:：\-]?\s*([가-힣]{2,5})/g;

const SENSITIVE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "phone", pattern: /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/ },
  { name: "phone_compact", pattern: /\b010\d{8}\b/ },
  { name: "landline", pattern: /\b0[2-9][-\s.]?\d{3,4}[-\s.]?\d{4}\b/ },
  { name: "rrn", pattern: /\b\d{6}[-\s]?\d{7}\b/ },
  {
    name: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  { name: "account", pattern: /\b\d{10,}\b/ },
  { name: "disease", pattern: /(질병|병력|진단명|암세포|당뇨병|고혈압)/ },
  {
    name: "insurance_product",
    pattern: /(보험상품|종신보험|실손보험|암보험|연금보험|보험증권)/,
  },
  {
    name: "premium_detail",
    pattern: /(월납보험료|납입보험료|보험료)\s*[:：]?\s*[\d,]+/,
  },
  {
    name: "contract_detail",
    pattern: /(증권번호|계약번호)/,
  },
];

function findCustomerLabelNamePattern(text: string): string | null {
  CUSTOMER_ID_LABEL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CUSTOMER_ID_LABEL_PATTERN.exec(text)) !== null) {
    const token = match[1];
    if (!LABEL_FOLLOWING_NON_NAME_TOKENS.has(token)) {
      return "customer_label_name";
    }
  }
  return null;
}
function collectStrings(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(
      collectStrings
    );
  }
  return [];
}

export function findSensitiveActionPlanPattern(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const labelHit = findCustomerLabelNamePattern(normalized);
  if (labelHit) return labelHit;
  for (const item of SENSITIVE_PATTERNS) {
    if (item.pattern.test(normalized)) return item.name;
  }
  return null;
}
export function assertNoSensitiveActionPlanText(
  value: string | null | undefined,
  _fieldName?: string
) {
  if (!value?.trim()) return;
  const hit = findSensitiveActionPlanPattern(value);
  if (hit) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: ACTION_PLAN_SENSITIVE_ERROR,
    });
  }
}

export function assertNoSensitiveActionPlanFields(
  fields: Record<string, string | null | undefined>
) {
  for (const value of Object.values(fields)) {
    assertNoSensitiveActionPlanText(value);
  }
}

export function assertNoSensitiveMonthlyPlanInput(input: {
  focusCustomerGroup?: string | null;
  monthlyStrategy?: string | null;
  preparationMemo?: string | null;
  expectedRisk?: string | null;
  supportRequest?: string | null;
  managerComment?: string | null;
}) {
  assertNoSensitiveActionPlanFields({
    focusCustomerGroup: input.focusCustomerGroup,
    monthlyStrategy: input.monthlyStrategy,
    preparationMemo: input.preparationMemo,
    expectedRisk: input.expectedRisk,
    supportRequest: input.supportRequest,
    managerComment: input.managerComment,
  });
}

export function assertNoSensitiveWeeklyPlanInput(input: {
  focusCustomerGroup?: string | null;
  weeklyActionPlan?: string | null;
  preparationMemo?: string | null;
  expectedRisk?: string | null;
  supportRequest?: string | null;
  managerComment?: string | null;
}) {
  assertNoSensitiveActionPlanFields({
    focusCustomerGroup: input.focusCustomerGroup,
    weeklyActionPlan: input.weeklyActionPlan,
    preparationMemo: input.preparationMemo,
    expectedRisk: input.expectedRisk,
    supportRequest: input.supportRequest,
    managerComment: input.managerComment,
  });
}

export function assertNoSensitiveDailyPlanInput(input: {
  todayPriority?: string | null;
  preparationMemo?: string | null;
  actualResultMemo?: string | null;
  nextDayMemo?: string | null;
  managerComment?: string | null;
}) {
  assertNoSensitiveActionPlanFields({
    todayPriority: input.todayPriority,
    preparationMemo: input.preparationMemo,
    actualResultMemo: input.actualResultMemo,
    nextDayMemo: input.nextDayMemo,
    managerComment: input.managerComment,
  });
}

export function assertNoSensitiveExecutiveInput(input: {
  branchSummary?: string | null;
  branchStrategy?: string | null;
  keyRisks?: string | null;
  supportRequest?: string | null;
  executiveMessage?: string | null;
  monthlyDirection?: string | null;
  weeklyFocus?: string | null;
  growthMembers?: string | null;
  coachingMembers?: string | null;
  orgIssues?: string | null;
  downloadReason?: string | null;
}) {
  assertNoSensitiveActionPlanFields({
    branchSummary: input.branchSummary,
    branchStrategy: input.branchStrategy,
    keyRisks: input.keyRisks,
    supportRequest: input.supportRequest,
    executiveMessage: input.executiveMessage,
    monthlyDirection: input.monthlyDirection,
    weeklyFocus: input.weeklyFocus,
    growthMembers: input.growthMembers,
    coachingMembers: input.coachingMembers,
    orgIssues: input.orgIssues,
    downloadReason: input.downloadReason,
  });
}

export function assertNoSensitiveActionPlanReportData(input: {
  monthlyPlans?: Array<Record<string, unknown>>;
  weeklyPlans?: Array<Record<string, unknown>>;
  dailyPlans?: Array<Record<string, unknown>>;
  executive?: Record<string, unknown>;
}) {
  const texts = [
    ...collectStrings(input.monthlyPlans ?? []),
    ...collectStrings(input.weeklyPlans ?? []),
    ...collectStrings(input.dailyPlans ?? []),
    ...collectStrings(input.executive ?? {}),
  ];
  for (const text of texts) {
    assertNoSensitiveActionPlanText(text);
  }
}

const SAFE_LOG_KEYS = new Set([
  "planType",
  "targetMonth",
  "reportMonth",
  "reportWeekLabel",
  "generatedBy",
  "status",
  "userCount",
  "reportId",
]);

export function sanitizeActionPlanLogMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  if (!metadata) return {};
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_LOG_KEYS.has(key)) continue;
    if (typeof value === "string") {
      safe[key] = value.length > 0 ? "[redacted-text]" : value;
      if (key === "reportMonth" || key === "reportWeekLabel" || key === "planType") {
        safe[key] = value;
      }
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
    }
  }
  if (metadata.reportMonth) safe.reportMonth = metadata.reportMonth;
  if (metadata.reportWeekLabel) safe.reportWeekLabel = metadata.reportWeekLabel;
  if (metadata.planType) safe.planType = metadata.planType;
  if (metadata.generatedBy != null) safe.generatedBy = metadata.generatedBy;
  if (metadata.userCount != null) safe.userCount = metadata.userCount;
  if (metadata.status) safe.status = metadata.status;
  return safe;
}
