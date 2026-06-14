import {
  buildCustomerExecutionScore,
  type CustomerExecutionRecommendation,
} from "@shared/customerExecution";

export function parseCustomerTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return value
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }
}

export function executionBadges(customer: any, recommendation?: any) {
  const badges: { label: string; className: string }[] = [];
  if (
    customer.assignmentStatus === "unassigned" ||
    (!customer.agentId && !customer.subBranchAdminId)
  )
    badges.push({ label: "미배정", className: "bg-slate-200 text-slate-700" });
  if (customer.consultStatus === "미상담")
    badges.push({ label: "미상담", className: "bg-slate-100 text-slate-700" });
  if (
    customer.consultStatus === "미상담" &&
    customer.agentId &&
    customer.assignedAt &&
    Date.now() - new Date(customer.assignedAt).getTime() > 24 * 60 * 60 * 1000
  ) {
    badges.push({
      label: "배정 후 연락 필요",
      className:
        "bg-destructive/10 text-destructive border-destructive/20 border",
    });
  }
  if (
    recommendation?.warnings?.some(
      (warning: any) =>
        String(warning.message).includes("장기") ||
        String(warning.warningType).includes("long")
    )
  ) {
    badges.push({
      label: "장기 미관리",
      className: "bg-amber-100 text-amber-800",
    });
  }
  if (recommendation)
    badges.push({
      label: "우선 연락",
      className:
        recommendation.urgency === "high"
          ? "bg-red-100 text-red-700"
          : "bg-emerald-50 text-emerald-700",
    });
  if (!customer.priority || customer.priority === "unclassified")
    badges.push({
      label: "우선순위 미분류",
      className: "bg-red-50 text-red-700",
    });
  return badges;
}

export function nextExecutionAction(customer: any, recommendation?: any) {
  const firstReason =
    recommendation?.reasons?.[0]?.title ??
    recommendation?.warnings?.[0]?.message;
  return (
    customer.nextAction ??
    firstReason ??
    (customer.consultStatus === "미상담" ? "첫 상담 연결" : "다음 행동 설정")
  );
}

export function buildListExecution(
  customer: any,
  recommendation?: CustomerExecutionRecommendation | null
) {
  const hasKnownConsultation =
    Boolean((recommendation as any)?.lastConsultationDate) ||
    customer.consultStatus !== "미상담";
  const hasRecommendationContext = Boolean(recommendation);
  return buildCustomerExecutionScore({
    customer,
    recommendation,
    latestConsult: hasKnownConsultation ? {} : null,
    nextFollowUp: (recommendation as any)?.nextContactDate
      ? {}
      : hasRecommendationContext
        ? null
        : undefined,
    hasOpenFollowUp:
      Number((recommendation as any)?.openFollowUpCount ?? 0) > 0,
    isLongUnmanaged: recommendation?.warnings?.some(
      warning =>
        String(warning.warningType).includes("long") ||
        String(warning.message).includes("장기")
    ),
  });
}

export function maskPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "연락처 등록";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function formatActivityDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
}

export function formatCustomerRecentActivity(
  customer: any,
  recommendation?: any
) {
  const parts: string[] = [];
  const lastConsult = formatActivityDate(
    (recommendation as any)?.lastConsultationDate
  );
  if (lastConsult) {
    parts.push(`최근 상담 ${lastConsult}`);
  } else if (customer.consultStatus === "미상담") {
    parts.push("아직 상담 기록 없음");
  }

  const nextContact = formatActivityDate(
    (recommendation as any)?.nextContactDate
  );
  if (nextContact) parts.push(`다음 연락 ${nextContact}`);

  const assigned = formatActivityDate(customer.assignedAt);
  if (assigned) parts.push(`배정 ${assigned}`);

  if (customer.source) parts.push(String(customer.source));

  return parts.slice(0, 3).join(" · ") || "최근 활동 정보 없음";
}
