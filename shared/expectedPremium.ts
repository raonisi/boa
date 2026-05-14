/** DB `customers.expectedPremium`는 원(원화 정수) 단위로 저장합니다. UI·엑셀은 만원 단위 입력을 사용합니다. */
export const EXPECTED_PREMIUM_WON_PER_MANWON = 10_000;

function normalizeManwonInput(raw: string): string {
  return raw.trim().replace(/,/g, "");
}

/** 만원 입력 문자열을 저장용 원 단위 정수로 변환합니다. 빈 문자열은 undefined입니다. */
export function expectedPremiumStoredWonFromManwonInput(raw: string): number | undefined {
  const t = normalizeManwonInput(raw);
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * EXPECTED_PREMIUM_WON_PER_MANWON);
}

/** 저장된 원 단위 값을 수정 폼용 만원 문자열로 변환합니다. */
export function expectedPremiumManwonFormStringFromStoredWon(won: number): string {
  const man = won / EXPECTED_PREMIUM_WON_PER_MANWON;
  if (Number.isInteger(man)) return String(man);
  const rounded = Math.round(man * 100) / 100;
  return String(rounded);
}

/** 목록·상세 표시용 (예: 12만원, 12.5만원) */
export function formatExpectedPremiumManwon(won: number): string {
  const man = won / EXPECTED_PREMIUM_WON_PER_MANWON;
  const formatted = Number.isInteger(man)
    ? man.toLocaleString("ko-KR")
    : man.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return `${formatted}만원`;
}
