export const ACTION_PLAN_STATUSES = [
  "draft",
  "submitted",
  "reviewed",
  "revision_requested",
  "closed",
] as const;

export type ActionPlanStatus = (typeof ACTION_PLAN_STATUSES)[number];

export const ACTION_PLAN_STATUS_LABELS: Record<ActionPlanStatus, string> = {
  draft: "작성 중",
  submitted: "제출 완료",
  reviewed: "리뷰 완료",
  revision_requested: "수정 요청",
  closed: "마감",
};

export const ACTION_PLAN_SENSITIVE_INPUT_NOTICE =
  "고객명, 연락처, 계약자명, 피보험자명, 질병명, 상품명, 보험료 등 고객 식별정보는 입력하지 마세요.";

export function isActionPlanEditable(status: ActionPlanStatus) {
  return status === "draft" || status === "revision_requested";
}

export function formatActionPlanMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getWeekDateRange(targetMonth: string, weekLabel: string) {
  const [year, month] = targetMonth.split("-").map(Number);
  const weekNum = Number.parseInt(weekLabel.replace(/\D/g, ""), 10) || 1;
  const startDay = (weekNum - 1) * 7 + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const endDay = Math.min(startDay + 6, lastDay);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    weekStartDate: `${year}-${pad(month)}-${pad(startDay)}`,
    weekEndDate: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}
