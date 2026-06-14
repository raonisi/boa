import { cn } from "@/lib/utils";
import React from "react";

/** English / internal enum → Korean display label */
const statusLabels: Record<string, string> = {
  active: "활성",
  inactive: "비활성",
  resigned: "퇴사자",
  scheduled: "예정",
  postponed: "연기",
  completed: "완료",
  cancelled: "취소",
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  failed: "실패",
  success: "성공",
  sent: "성공",
  skipped: "스킵",
  resolved: "해결됨",
  open: "진행 중",
  high: "높음",
  medium: "보통",
  low: "낮음",
  unclassified: "미분류",
};

/** Semantic badge tone classes — BOA premium tokens */
const badgeTones: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground ring-1 ring-border/70",
  info: "bg-primary/10 text-primary ring-1 ring-primary/15",
  success: "bg-boa-green/12 text-boa-green ring-1 ring-boa-green/20",
  warning: "bg-boa-amber/16 text-amber-800 ring-1 ring-boa-amber/25 dark:text-amber-200",
  danger: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
  muted: "bg-muted/80 text-muted-foreground ring-1 ring-border/60",
};

const statusToneKeys: Record<string, keyof typeof badgeTones> = {
  미상담: "neutral",
  부재: "warning",
  통화완료: "info",
  상담예정: "info",
  설계중: "info",
  계약: "success",
  보류: "warning",
  거절: "danger",
  해지관리: "danger",
  재상담필요: "success",
  청약: "info",
  성립: "success",
  철회: "warning",
  유지: "success",
  해지: "danger",
  정상: "success",
  미납: "warning",
  실효: "danger",
  예정: "info",
  완료: "success",
  취소: "muted",
  변경: "warning",
  노쇼: "danger",
  active: "success",
  inactive: "muted",
  resigned: "danger",
  scheduled: "info",
  postponed: "warning",
  completed: "success",
  cancelled: "muted",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  failed: "danger",
  success: "success",
  sent: "success",
  skipped: "muted",
  resolved: "success",
  open: "info",
  high: "danger",
  medium: "info",
  low: "muted",
};

const priorityToneKeys: Record<string, keyof typeof badgeTones> = {
  A: "danger",
  B: "warning",
  C: "info",
  D: "muted",
  unclassified: "neutral",
};

const BADGE_BASE =
  "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-none";

function isRawEnglishEnum(value: string) {
  return /^[a-z][a-z0-9_:-]*$/i.test(value);
}

export function getStatusLabel(status: string | null | undefined) {
  if (!status) return "상태 미지정";
  if (statusLabels[status]) return statusLabels[status];
  return isRawEnglishEnum(status) ? "기타 상태" : status;
}

export function getStatusToneClass(status: string | null | undefined) {
  if (!status) return badgeTones.neutral;
  const toneKey =
    statusToneKeys[status] ??
    statusToneKeys[getStatusLabel(status)] ??
    "neutral";
  return badgeTones[toneKey];
}

export function getPriorityLabel(priority?: string | null) {
  if (!priority || priority === "unclassified") return "미분류";
  if (priorityLabels[priority]) return priorityLabels[priority];
  return isRawEnglishEnum(priority) ? "미분류" : priority;
}

const priorityLabels: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  unclassified: "미분류",
};

export function getPriorityToneClass(priority?: string | null) {
  const key = priority && priority !== "unclassified" ? priority : "unclassified";
  const toneKey = priorityToneKeys[key] ?? "neutral";
  return badgeTones[toneKey];
}

export function getCoachingPriorityLabel(priority?: string | null) {
  if (!priority) return "보통";
  const normalized = priority.toLowerCase();
  return statusLabels[normalized] ?? (isRawEnglishEnum(priority) ? "보통" : priority);
}

export function getCoachingPriorityToneClass(priority?: string | null) {
  const normalized = (priority ?? "medium").toLowerCase();
  const toneKey = statusToneKeys[normalized] ?? "info";
  return badgeTones[toneKey];
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(BADGE_BASE, getStatusToneClass(status), className)}
      title={getStatusLabel(status)}
    >
      {getStatusLabel(status)}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority?: string | null;
  className?: string;
}) {
  const label = getPriorityLabel(priority);
  return (
    <span
      className={cn(BADGE_BASE, getPriorityToneClass(priority), className)}
      title={`우선순위 ${label}`}
    >
      {label}
    </span>
  );
}

export function ScheduleBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return <StatusBadge status={status} className={className} />;
}

export function ContractBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return <StatusBadge status={status} className={className} />;
}

export function CoachingPriorityBadge({
  priority,
  className,
}: {
  priority?: string | null;
  className?: string;
}) {
  const label = getCoachingPriorityLabel(priority);
  return (
    <span
      className={cn(BADGE_BASE, getCoachingPriorityToneClass(priority), className)}
      title={`중요도 ${label}`}
    >
      {label}
    </span>
  );
}

export const CONSULT_STATUSES = [
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
] as const;

export const SCHEDULE_TYPES = [
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
] as const;

export const SCHEDULE_STATUSES = [
  "예정",
  "완료",
  "취소",
  "변경",
  "노쇼",
  "보류",
] as const;

export const CUSTOMER_PRIORITIES = ["A", "B", "C", "D", "unclassified"] as const;
