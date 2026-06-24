export const UNREAD_BADGE_MAX_DISPLAY = 99;

export type UnreadBadgeInput = {
  count?: number | null;
  isLoading?: boolean;
  isError?: boolean;
};

export function formatUnreadBadgeCount(
  count: number,
  maxDisplay = UNREAD_BADGE_MAX_DISPLAY
): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count > maxDisplay) return `${maxDisplay}+`;
  return String(count);
}

export function shouldShowUnreadBadge(input: UnreadBadgeInput): boolean {
  if (input.isLoading || input.isError) return false;
  return (input.count ?? 0) > 0;
}

export function getUnreadBadgeLabel(input: UnreadBadgeInput): string | null {
  if (!shouldShowUnreadBadge(input)) return null;
  return formatUnreadBadgeCount(input.count ?? 0);
}

export function getUnreadBadgeAriaLabel(input: UnreadBadgeInput): string {
  if (input.isLoading) return "읽지 않은 알림 불러오는 중";
  if (input.isError) return "읽지 않은 알림 수를 불러오지 못했습니다";
  const count = input.count ?? 0;
  if (count <= 0) return "읽지 않은 알림 없음";
  if (count > UNREAD_BADGE_MAX_DISPLAY) {
    return `읽지 않은 알림 ${UNREAD_BADGE_MAX_DISPLAY}건 이상`;
  }
  return `읽지 않은 알림 ${count}건`;
}
