/** PR21 — 지점원 직접 목표등록형 실행계획 옵션·헬퍼 */

export const ACTION_PLAN_WEEK_NUMBERS = [1, 2, 3, 4, 5] as const;
export type ActionPlanWeekNumber = (typeof ACTION_PLAN_WEEK_NUMBERS)[number];

export const ACTION_PLAN_PR21_NOTICE =
  "고객명, 연락처, 계약자명, 피보험자명, 질병명, 증권번호, 상품명과 결합된 고객별 상담 내용은 입력하지 마세요. 고객코드, 이니셜, 고객군, 진행 단계 중심으로 작성하세요.";

export const CUSTOMER_STAGE_OPTIONS = [
  "연락전",
  "연락완료",
  "니즈확인",
  "보장분석",
  "제안완료",
  "고민중",
  "계약예정",
  "계약완료",
  "소개요청",
  "유지관리",
] as const;

export const PRODUCT_CATEGORY_OPTIONS = [
  "건강보험",
  "종합보험",
  "실손",
  "운전자",
  "간병",
  "수술비",
  "암",
  "뇌심",
  "어린이",
  "화재",
  "배상책임",
  "연금",
  "저축",
  "기타",
] as const;

export const COVERAGE_AREA_OPTIONS = [
  "암 보장",
  "뇌혈관·심혈관",
  "수술비",
  "입원비",
  "통원비",
  "간병",
  "실손",
  "운전자",
  "배상책임",
  "사망",
  "후유장해",
  "노후자금",
  "저축성",
  "기타",
] as const;

export const SUPPORT_REQUEST_OPTIONS = [
  "없음",
  "동행상담",
  "설계검토",
  "멘트코칭",
  "상품비교",
  "해지방어",
  "보장분석 지원",
  "자료준비 지원",
] as const;

export const EXPECTED_BARRIER_OPTIONS = [
  "보험료 부담",
  "가족 반대",
  "비교 문의",
  "연락 지연",
  "필요성 부족",
  "기존 보험 불신",
  "결정 지연",
  "기타",
] as const;

export const COMPLIANCE_RISK_OPTIONS = [
  "과장표현 없음",
  "공포조장 없음",
  "불리한 조건 설명",
  "근거자료 확인",
  "개인정보 최소화",
] as const;

export function weekNumberToLabel(weekNumber: number) {
  return `${weekNumber}주차`;
}

export function weekLabelToNumber(weekLabel: string): ActionPlanWeekNumber {
  const n = Number.parseInt(weekLabel.replace(/\D/g, ""), 10);
  if (n >= 1 && n <= 5) return n as ActionPlanWeekNumber;
  return 1;
}

export function isSubmittedPlanStatus(status?: string | null) {
  return (
    status === "submitted" ||
    status === "reviewed" ||
    status === "revision_requested"
  );
}
