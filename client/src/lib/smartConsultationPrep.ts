export type ConsultationPrepGoal =
  | "첫 접촉"
  | "니즈 확인"
  | "설계 준비"
  | "재상담"
  | "보장 점검"
  | "해지위험 확인"
  | "청구 안내 확인"
  | "소개 흐름 확인"
  | "사후관리"
  | "기타";

export const CONSULTATION_PREP_FORBIDDEN_PHRASES = [
  "무조건 바꾸셔야 합니다",
  "이건 손해입니다",
  "오늘 안 하면 늦습니다",
  "무조건 유지하세요",
  "보험금 받을 수 있습니다",
  "수익 확정",
] as const;

export const APPROACH_BY_PERSONALITY_TAG: Record<string, string> = {
  가격민감형: "보험료를 줄이는 말보다 유지할 기준과 줄일 기준을 나눠 설명",
  보장불안형: "빠진 보장보다 현재 보장 구조부터 정리",
  무관심형: "긴 설명보다 오늘 확인할 1가지만 제시",
  가족책임형: "본인보다 가족 생활비와 역할 기준으로 설명",
  해지위험: "유지 권유보다 해지 전 확인할 손실과 공백을 차분히 설명",
  고액계약가능성: "현금흐름, 목적, 기간 기준으로 설명",
  리밸런싱필요: "현금흐름, 목적, 기간 기준으로 설명",
};

export type SmartConsultationPrepInput = {
  customer: {
    consultStatus?: string | null;
    priority?: string | null;
    nextAction?: string | null;
  };
  customerTags: string[];
  agentName: string;
  latestConsult?: {
    summary?: string | null;
    content?: string | null;
    consultationDate?: string | Date | null;
    createdAt?: string | Date | null;
  } | null;
  latestConsultDate?: string | Date | null;
  nextFollowUp?: {
    reason?: string | null;
    nextContactDate?: string | Date | null;
  } | null;
  contactReasons?: {
    warnings?: Array<{ warningType?: string; message?: string }>;
    reasons?: Array<{
      reasonType?: string;
      title?: string;
      description?: string;
    }>;
  } | null;
  handoffNotes?: Array<{
    noteType?: string;
    title?: string;
    body?: string;
  }> | null;
  hasOpenRetentionRisk?: boolean;
  hasOpenClaimGuidance?: boolean;
  hasReferralFlows?: boolean;
  hasRelationships?: boolean;
};

export type SmartConsultationPrepViewModel = {
  consultStatus: string;
  priorityLabel: string;
  customerTags: string[];
  agentName: string;
  nextAction: string;
  lastConsultLabel: string;
  nextContactLabel: string;
  recentConsultSummary: string;
  recentFollowUpSummary: string;
  warningSummaries: string[];
  handoffSummary: string;
  consultationGoal: ConsultationPrepGoal | "정보 부족";
  approachDirections: string[];
  forbiddenPhrases: readonly string[];
  hasRecentConsult: boolean;
  hasFollowUp: boolean;
};

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}…`;
}

function hasTag(tags: string[], keywords: string[]) {
  return tags.some(tag => keywords.some(keyword => tag.includes(keyword)));
}

export function deriveConsultationGoal(
  input: SmartConsultationPrepInput
): ConsultationPrepGoal | "정보 부족" {
  const status = input.customer.consultStatus ?? "";
  const tags = input.customerTags;

  if (input.hasOpenRetentionRisk || hasTag(tags, ["해지위험", "해지"])) {
    return "해지위험 확인";
  }
  if (status.includes("해지")) return "해지위험 확인";
  if (input.hasOpenClaimGuidance) return "청구 안내 확인";
  if (input.hasReferralFlows) return "소개 흐름 확인";
  if (hasTag(tags, ["사후관리"])) return "사후관리";
  if (!input.latestConsult && (status === "미상담" || !status)) {
    return "첫 접촉";
  }
  if (status.includes("설계")) return "설계 준비";
  if (status === "계약" || status.includes("계약")) return "보장 점검";
  if (input.customer.nextAction === "재연락") return "재상담";
  if (!input.latestConsult) return "니즈 확인";
  if (input.customer.nextAction === "보장분석 진행") return "보장 점검";
  if (input.customer.nextAction === "설계안 발송") return "설계 준비";
  if (input.customer.nextAction === "사후관리") return "사후관리";
  return "기타";
}

export function deriveApproachDirections(input: SmartConsultationPrepInput) {
  const directions = new Set<string>();

  for (const tag of input.customerTags) {
    const mapped = APPROACH_BY_PERSONALITY_TAG[tag];
    if (mapped) directions.add(mapped);
  }

  if (
    input.customer.consultStatus?.includes("해지") ||
    input.hasOpenRetentionRisk
  ) {
    directions.add(APPROACH_BY_PERSONALITY_TAG.해지위험);
  }

  for (const note of input.handoffNotes ?? []) {
    if (note.noteType === "approach" && note.body?.trim()) {
      directions.add(truncateText(note.body, 120));
    }
  }

  const reason = input.contactReasons?.reasons?.[0];
  if (reason?.description?.trim()) {
    directions.add(truncateText(reason.description, 120));
  }

  if (directions.size === 0) {
    directions.add("오늘 확인할 1가지를 먼저 정리하고 차분히 설명");
  }

  return Array.from(directions).slice(0, 4);
}

export function buildHandoffSummary(
  handoffNotes?: SmartConsultationPrepInput["handoffNotes"]
) {
  if (!handoffNotes?.length) return "최근 인수인계 메모 없음";

  const prioritized = [...handoffNotes].sort((a, b) => {
    const weight = (type?: string) =>
      type === "caution" || type === "avoid" ? 0 : type === "approach" ? 1 : 2;
    return weight(a.noteType) - weight(b.noteType);
  });

  const note = prioritized[0];
  const parts = [note.title, note.body].filter(Boolean).join(" · ");
  return truncateText(parts || "인수인계 메모 있음", 140);
}

export function buildSmartConsultationPrepViewModel(
  input: SmartConsultationPrepInput,
  options?: { priorityLabel?: (value?: string | null) => string }
): SmartConsultationPrepViewModel {
  const priorityLabelFn =
    options?.priorityLabel ??
    ((value?: string | null) =>
      !value || value === "unclassified" ? "미분류" : value);

  const recentConsultSummary =
    input.latestConsult?.summary?.trim() ||
    input.latestConsult?.content?.trim() ||
    "최근 상담기록 없음";

  const recentFollowUpSummary = input.nextFollowUp?.reason?.trim()
    ? truncateText(
        `${input.nextFollowUp.reason}${
          input.nextFollowUp.nextContactDate
            ? ` · 다음 ${String(input.nextFollowUp.nextContactDate).slice(0, 10)}`
            : ""
        }`,
        140
      )
    : "예정된 후속관리 없음";

  const warningSummaries = (input.contactReasons?.warnings ?? [])
    .map(w => w.message?.trim())
    .filter((message): message is string => Boolean(message))
    .slice(0, 3);

  return {
    consultStatus: input.customer.consultStatus?.trim() || "정보 부족",
    priorityLabel: priorityLabelFn(input.customer.priority),
    customerTags: input.customerTags,
    agentName: input.agentName || "담당 미지정",
    nextAction: input.customer.nextAction?.trim() || "설정 필요",
    lastConsultLabel: input.latestConsultDate
      ? String(input.latestConsultDate).slice(0, 10)
      : "최근 기록 없음",
    nextContactLabel: input.nextFollowUp?.nextContactDate
      ? String(input.nextFollowUp.nextContactDate).slice(0, 10)
      : "설정 없음",
    recentConsultSummary: truncateText(recentConsultSummary, 160),
    recentFollowUpSummary,
    warningSummaries,
    handoffSummary: buildHandoffSummary(input.handoffNotes),
    consultationGoal: deriveConsultationGoal(input),
    approachDirections: deriveApproachDirections(input),
    forbiddenPhrases: CONSULTATION_PREP_FORBIDDEN_PHRASES,
    hasRecentConsult: Boolean(
      input.latestConsult?.summary?.trim() ||
        input.latestConsult?.content?.trim()
    ),
    hasFollowUp: Boolean(input.nextFollowUp),
  };
}

export function buildMobilePrepSummaryLines(
  view: SmartConsultationPrepViewModel
) {
  return [
    `상담 목표 · ${view.consultationGoal}`,
    `최근 이슈 · ${
      view.warningSummaries[0] ??
      (view.hasRecentConsult ? view.recentConsultSummary : "최근 기록 없음")
    }`,
    `다음 액션 · ${view.nextAction}`,
  ];
}
