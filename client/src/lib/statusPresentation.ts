/**
 * BOA CRM semantic status presentation — shared label + variant + token classes.
 * Unknown / unmapped values always fall back to neutral (never success/danger guess).
 */

export type StatusVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "inactive";

export type StatusPresentation = {
  label: string;
  variant: StatusVariant;
};

export const STATUS_BADGE_BASE =
  "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-none";

/** Badge tones — BOA oklch tokens (StatusBadge, ExecutionBadge) */
export const statusVariantClasses: Record<StatusVariant, string> = {
  neutral: "bg-muted text-muted-foreground ring-1 ring-border/70",
  info: "bg-primary/10 text-primary ring-1 ring-primary/15",
  success: "bg-boa-green/12 text-boa-green ring-1 ring-boa-green/20",
  warning:
    "bg-boa-amber/16 text-amber-800 ring-1 ring-boa-amber/25 dark:text-amber-200",
  danger: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
  inactive: "bg-muted/70 text-muted-foreground ring-1 ring-border/60",
};

/** Bordered surfaces for panels, timeline rows, callouts */
export const statusSurfaceClasses: Record<StatusVariant, string> = {
  neutral: "border-border bg-muted/30 text-muted-foreground",
  info: "border-primary/20 bg-primary/8 text-primary",
  success: "border-boa-green/25 bg-boa-green/8 text-boa-green",
  warning: "border-boa-amber/25 bg-boa-amber/12 text-amber-900",
  danger: "border-destructive/25 bg-destructive/8 text-destructive",
  inactive: "border-border bg-muted/40 text-muted-foreground",
};

export function getStatusVariantClasses(variant: StatusVariant): string {
  return statusVariantClasses[variant];
}

export function getStatusSurfaceClasses(variant: StatusVariant): string {
  return statusSurfaceClasses[variant];
}

const executionBadgeVariants: Record<string, StatusVariant> = {
  미배정: "neutral",
  미상담: "neutral",
  비활성: "inactive",
  "배정 후 연락 필요": "danger",
  "장기 미관리": "warning",
  "우선순위 미분류": "warning",
  연결: "info",
};

export function getExecutionBadgePresentation(
  label: string,
  options?: { urgency?: string | null }
): StatusPresentation {
  if (label === "우선 연락") {
    const urgency = (options?.urgency ?? "").toLowerCase();
    return {
      label,
      variant: urgency === "high" ? "danger" : "success",
    };
  }
  return {
    label,
    variant: executionBadgeVariants[label] ?? "neutral",
  };
}

const urgencyLabels: Record<string, string> = {
  high: "긴급",
  medium: "확인 필요",
  low: "보통",
};

const urgencyVariants: Record<string, StatusVariant> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export function getUrgencyPresentation(
  urgency?: string | null
): StatusPresentation {
  const key = (urgency ?? "low").toLowerCase();
  if (urgencyLabels[key]) {
    return { label: urgencyLabels[key], variant: urgencyVariants[key] };
  }
  return { label: "보통", variant: "neutral" };
}

const severityKeys: Record<string, StatusVariant> = {
  normal: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
};

export function getSeverityVariant(severity?: string | null): StatusVariant {
  if (!severity) return "neutral";
  return severityKeys[severity.toLowerCase()] ?? "neutral";
}

export function getSeveritySurfaceClasses(severity?: string | null): string {
  return getStatusSurfaceClasses(getSeverityVariant(severity));
}

function isRawEnglishEnum(value: string) {
  return /^[a-z][a-z0-9_:-]*$/i.test(value);
}

/** English / internal enum → Korean display label */
export const statusLabels: Record<string, string> = {
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
  미배정: "미배정",
  비활성: "비활성",
  연결: "연결",
};

const statusVariantByKey: Record<string, StatusVariant> = {
  미상담: "neutral",
  부재: "warning",
  통화완료: "info",
  상담예정: "info",
  설계중: "info",
  계약: "success",
  보류: "warning",
  거절: "danger",
  해지관리: "danger",
  재상담필요: "warning",
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
  취소: "inactive",
  변경: "warning",
  노쇼: "danger",
  active: "success",
  inactive: "inactive",
  resigned: "inactive",
  scheduled: "info",
  postponed: "warning",
  completed: "success",
  cancelled: "inactive",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  failed: "danger",
  success: "success",
  sent: "success",
  skipped: "inactive",
  resolved: "success",
  open: "info",
  high: "danger",
  medium: "info",
  low: "neutral",
  unclassified: "neutral",
  미배정: "neutral",
  비활성: "inactive",
  연결: "info",
};

const priorityVariantByKey: Record<string, StatusVariant> = {
  A: "danger",
  B: "warning",
  C: "info",
  D: "neutral",
  unclassified: "neutral",
};

const priorityLabels: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  unclassified: "미분류",
};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return "상태 미지정";
  if (statusLabels[status]) return statusLabels[status];
  return isRawEnglishEnum(status) ? "기타 상태" : status;
}

export function getStatusVariant(
  status: string | null | undefined
): StatusVariant {
  if (!status) return "neutral";
  const variant =
    statusVariantByKey[status] ?? statusVariantByKey[getStatusLabel(status)];
  return variant ?? "neutral";
}

export function getStatusPresentation(
  status: string | null | undefined
): StatusPresentation {
  return {
    label: getStatusLabel(status),
    variant: getStatusVariant(status),
  };
}

export function getPriorityLabel(priority?: string | null): string {
  if (!priority || priority === "unclassified") return "미분류";
  if (priorityLabels[priority]) return priorityLabels[priority];
  return isRawEnglishEnum(priority) ? "미분류" : priority;
}

export function getPriorityVariant(priority?: string | null): StatusVariant {
  const key =
    priority && priority !== "unclassified" ? priority : "unclassified";
  return priorityVariantByKey[key] ?? "neutral";
}

export function getPriorityPresentation(
  priority?: string | null
): StatusPresentation {
  return {
    label: getPriorityLabel(priority),
    variant: getPriorityVariant(priority),
  };
}

export function getCoachingPriorityPresentation(
  priority?: string | null
): StatusPresentation {
  if (!priority) return { label: "보통", variant: "info" };
  const normalized = priority.toLowerCase();
  const label =
    statusLabels[normalized] ??
    (isRawEnglishEnum(priority) ? "보통" : priority);
  const variant = statusVariantByKey[normalized] ?? "info";
  return { label, variant };
}
