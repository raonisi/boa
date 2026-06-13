export type CustomerExecutionCustomer = {
  consultStatus?: string | null;
  priority?: string | null;
  customerTags?: string | string[] | null;
  expectedPremium?: number | null;
  nextAction?: string | null;
};

export type CustomerExecutionRecommendation = {
  totalScore?: number | null;
  recommendedAction?: string | null;
  contactReason?: { title?: string | null; description?: string | null } | null;
  reasons?: Array<
    string | { title?: string | null; description?: string | null }
  > | null;
  warnings?: Array<{
    warningType?: string | null;
    message?: string | null;
    severity?: string | null;
  }> | null;
};

export type CustomerExecutionInput = {
  customer: CustomerExecutionCustomer;
  recommendation?: CustomerExecutionRecommendation | null;
  latestConsult?: unknown | null;
  nextFollowUp?: unknown | null;
  isLongUnmanaged?: boolean;
  hasOpenFollowUp?: boolean;
};

export type CustomerExecutionScore = {
  score: number;
  grade: "최우선 관리" | "우선 관리" | "일반 관리" | "저강도 관리";
  gradeClassName: string;
  actionTitle: string;
  actionDescription: string;
  actionNext: string;
  reasons: Array<{ label: string; points: number }>;
};

function parseTags(value?: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value))
    return value.filter((tag): tag is string => typeof tag === "string");
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    // Fall back to comma-separated legacy values.
  }
  return value
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

function hasTag(tags: string[], keywords: string[]) {
  return tags.some(tag => keywords.some(keyword => tag.includes(keyword)));
}

function hasWarning(
  recommendation: CustomerExecutionRecommendation | null | undefined,
  keywords: string[]
) {
  return (recommendation?.warnings ?? []).some(warning => {
    const text = `${warning.warningType ?? ""} ${warning.message ?? ""}`;
    return keywords.some(keyword => text.includes(keyword));
  });
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function scoreGrade(
  score: number
): Pick<CustomerExecutionScore, "grade" | "gradeClassName"> {
  if (score >= 80)
    return {
      grade: "최우선 관리",
      gradeClassName: "bg-red-50 text-red-700 border-red-200",
    };
  if (score >= 60)
    return {
      grade: "우선 관리",
      gradeClassName: "bg-amber-50 text-amber-800 border-amber-200",
    };
  if (score >= 40)
    return {
      grade: "일반 관리",
      gradeClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  return {
    grade: "저강도 관리",
    gradeClassName: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

function firstRecommendationTitle(
  recommendation?: CustomerExecutionRecommendation | null
) {
  const reason = recommendation?.reasons?.[0];
  if (typeof reason === "string") return reason;
  return (
    reason?.title ??
    recommendation?.recommendedAction ??
    recommendation?.contactReason?.title ??
    null
  );
}

export function buildCustomerExecutionScore(
  input: CustomerExecutionInput
): CustomerExecutionScore {
  const {
    customer,
    recommendation,
    latestConsult,
    nextFollowUp,
    isLongUnmanaged,
    hasOpenFollowUp,
  } = input;
  const tags = parseTags(customer.customerTags);
  const reasons: Array<{ label: string; points: number }> = [];
  let score = 0;

  const longUnmanaged =
    Boolean(isLongUnmanaged) ||
    hasWarning(recommendation, ["장기", "long_unmanaged"]);
  const noConsult =
    !latestConsult &&
    (customer.consultStatus === "미상담" ||
      hasWarning(recommendation, ["상담기록", "no_consultation"]));
  const noNextFollowUp = nextFollowUp === null;
  const unclassifiedPriority =
    !customer.priority || customer.priority === "unclassified";
  const retentionRisk =
    hasTag(tags, ["해지위험", "해지"]) ||
    hasWarning(recommendation, ["해지", "retention"]);
  const rebalancingNeeded = hasTag(tags, ["리밸런싱필요", "리밸런싱"]);
  const postCareNeeded =
    hasTag(tags, ["사후관리필요", "사후관리"]) ||
    hasWarning(recommendation, ["사후관리", "post_contract"]);
  const highPremium = (customer.expectedPremium ?? 0) >= 100000;
  const pendingFollowUp =
    Boolean(hasOpenFollowUp) ||
    hasWarning(recommendation, ["후속관리", "follow_up"]);

  if (longUnmanaged) {
    score += 25;
    reasons.push({ label: "장기 미관리", points: 25 });
  }
  if (noConsult) {
    score += 20;
    reasons.push({ label: "미상담", points: 20 });
  }
  if (noNextFollowUp) {
    score += 15;
    reasons.push({ label: "다음 연락일 없음", points: 15 });
  }
  if (unclassifiedPriority) {
    score += 10;
    reasons.push({ label: "우선순위 미분류", points: 10 });
  }
  if (retentionRisk) {
    score += 20;
    reasons.push({ label: "해지위험 태그", points: 20 });
  }
  if (rebalancingNeeded) {
    score += 15;
    reasons.push({ label: "리밸런싱필요", points: 15 });
  }
  if (postCareNeeded) {
    score += 15;
    reasons.push({ label: "사후관리필요", points: 15 });
  }
  if (highPremium) {
    score += 10;
    reasons.push({ label: "예상보험료 높음", points: 10 });
  }
  if (pendingFollowUp) {
    score += 15;
    reasons.push({ label: "후속관리 처리 필요", points: 15 });
  }

  const nextTitle = firstRecommendationTitle(recommendation);
  let actionTitle = nextTitle ?? customer.nextAction ?? "정기 관리 대상";
  let actionDescription =
    recommendation?.contactReason?.description ??
    "현재 고객 상태를 확인하고 다음 상담 흐름을 이어가세요.";
  let actionNext = customer.nextAction ?? actionTitle;

  if (longUnmanaged) {
    actionTitle = "기존 기준 점검 연락 필요";
    actionDescription =
      "장기 미관리 고객입니다. 최근 상황 변화 여부와 기존 보장 기준을 점검할 명분이 있습니다.";
    actionNext = "기존 기준 점검";
  } else if (noConsult) {
    actionTitle = "첫 상담 연결 필요";
    actionDescription =
      "아직 상담기록이 없습니다. 유입 경로와 관심 보장 기준을 바탕으로 첫 상담을 시작하세요.";
    actionNext = "첫 상담 연결";
  } else if (noNextFollowUp) {
    actionTitle = "다음 연락일 설정 필요";
    actionDescription =
      "상담 흐름이 끊기지 않도록 다음 연락일을 먼저 설정하세요.";
    actionNext = "다음 연락일 설정";
  } else if (highPremium) {
    actionTitle = "보장 설계 우선 검토";
    actionDescription =
      "예상보험료가 높은 고객입니다. 보장 니즈와 납입 여력을 함께 확인하세요.";
    actionNext = "보장 설계 검토";
  } else if (retentionRisk) {
    actionTitle = "유지 관리 우선 필요";
    actionDescription =
      "해지위험 태그가 있는 고객입니다. 불만 요인과 보장 만족도를 먼저 확인하세요.";
    actionNext = "유지 관리 상담";
  } else if (unclassifiedPriority) {
    actionTitle = "우선순위 설정 필요";
    actionDescription =
      "고객 관리 기준을 명확히 하기 위해 우선순위를 설정하세요.";
    actionNext = "우선순위 설정";
  } else if (pendingFollowUp) {
    actionTitle = "후속관리 처리 필요";
    actionDescription =
      "예정된 후속관리 흐름을 확인하고 상담 결과를 기록하세요.";
    actionNext = "후속관리 처리";
  }

  const scoreFromRules = clampScore(score);
  const scoreFromRecommendation =
    typeof recommendation?.totalScore === "number"
      ? clampScore(recommendation.totalScore)
      : 0;
  const finalScore = Math.max(scoreFromRules, scoreFromRecommendation);

  return {
    score: finalScore,
    ...scoreGrade(finalScore),
    actionTitle,
    actionDescription,
    actionNext,
    reasons: reasons.slice(0, 5),
  };
}
