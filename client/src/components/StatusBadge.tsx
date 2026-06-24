import { cn } from "@/lib/utils";
import React from "react";
import {
  getCoachingPriorityPresentation,
  getExecutionBadgePresentation,
  getPriorityPresentation,
  getStatusPresentation,
  getStatusVariantClasses,
  getUrgencyPresentation,
  STATUS_BADGE_BASE,
  type StatusPresentation,
  type StatusVariant,
} from "@/lib/statusPresentation";

export {
  getCoachingPriorityPresentation,
  getExecutionBadgePresentation,
  getPriorityLabel,
  getPriorityPresentation,
  getPriorityVariant,
  getStatusLabel,
  getStatusPresentation,
  getStatusVariant,
  getStatusVariantClasses,
  getUrgencyPresentation,
  type StatusPresentation,
  type StatusVariant,
} from "@/lib/statusPresentation";

export function getStatusToneClass(status: string | null | undefined) {
  return getStatusVariantClasses(getStatusPresentation(status).variant);
}

export function getPriorityToneClass(priority?: string | null) {
  return getStatusVariantClasses(getPriorityPresentation(priority).variant);
}

export function getCoachingPriorityLabel(priority?: string | null) {
  return getCoachingPriorityPresentation(priority).label;
}

export function getCoachingPriorityToneClass(priority?: string | null) {
  return getStatusVariantClasses(
    getCoachingPriorityPresentation(priority).variant
  );
}

type SemanticBadgeProps = {
  presentation: StatusPresentation;
  className?: string;
  title?: string;
  "aria-label"?: string;
};

function SemanticBadge({
  presentation,
  className,
  title,
  "aria-label": ariaLabel,
}: SemanticBadgeProps) {
  return (
    <span
      className={cn(
        STATUS_BADGE_BASE,
        getStatusVariantClasses(presentation.variant),
        className
      )}
      title={title ?? presentation.label}
      aria-label={ariaLabel ?? presentation.label}
    >
      {presentation.label}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const presentation = getStatusPresentation(status);
  return <SemanticBadge presentation={presentation} className={className} />;
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority?: string | null;
  className?: string;
}) {
  const presentation = getPriorityPresentation(priority);
  return (
    <SemanticBadge
      presentation={presentation}
      className={className}
      title={`우선순위 ${presentation.label}`}
      aria-label={`우선순위 ${presentation.label}`}
    />
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
  const presentation = getCoachingPriorityPresentation(priority);
  return (
    <SemanticBadge
      presentation={presentation}
      className={className}
      title={`중요도 ${presentation.label}`}
      aria-label={`중요도 ${presentation.label}`}
    />
  );
}

export function ExecutionBadge({
  label,
  urgency,
  variant,
  className,
}: {
  label: string;
  urgency?: string | null;
  variant?: StatusVariant;
  className?: string;
}) {
  const presentation =
    variant != null
      ? { label, variant }
      : getExecutionBadgePresentation(label, { urgency });
  return <SemanticBadge presentation={presentation} className={className} />;
}

export function UrgencyBadge({
  urgency,
  className,
}: {
  urgency?: string | null;
  className?: string;
}) {
  const presentation = getUrgencyPresentation(urgency);
  return <SemanticBadge presentation={presentation} className={className} />;
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
