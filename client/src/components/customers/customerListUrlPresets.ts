import type { QuickPresetId } from "./customerListQuickPresets";

export const CUSTOMER_LIST_URL_PRESET_IDS = [
  "today-follow-up",
  "overdue-follow-up",
  "priority-contact",
  "priority-urgent",
  "long-unmanaged",
  "uncontacted",
  "sla-overdue",
  "no-next-action",
] as const;

export type CustomerListUrlPresetId =
  (typeof CUSTOMER_LIST_URL_PRESET_IDS)[number];

export type CustomerListUrlPresetKind =
  | { type: "follow_up_today" }
  | { type: "follow_up_overdue" }
  | { type: "warning"; warningType: string }
  | { type: "quick"; quickPresetId: QuickPresetId };

export type CustomerListUrlPresetMeta = {
  id: CustomerListUrlPresetId;
  title: string;
  description: string;
  kind: CustomerListUrlPresetKind;
};

export const CUSTOMER_LIST_URL_PRESET_META: Record<
  CustomerListUrlPresetId,
  CustomerListUrlPresetMeta
> = {
  "today-follow-up": {
    id: "today-follow-up",
    title: "오늘 연락할 고객",
    description: "오늘 안에 연락이 필요한 후속관리 고객을 모아봤습니다.",
    kind: { type: "follow_up_today" },
  },
  "overdue-follow-up": {
    id: "overdue-follow-up",
    title: "기한이 지난 후속관리",
    description: "예정일이 지난 후속관리 고객을 확인하세요.",
    kind: { type: "follow_up_overdue" },
  },
  "priority-contact": {
    id: "priority-contact",
    title: "우선 연락 고객",
    description: "우선순위와 관리 상태를 기준으로 확인이 필요한 고객입니다.",
    kind: { type: "quick", quickPresetId: "today_contact" },
  },
  "priority-urgent": {
    id: "priority-urgent",
    title: "긴급 연락 고객",
    description: "긴급도가 높은 고객을 우선 확인하세요.",
    kind: { type: "quick", quickPresetId: "urgent" },
  },
  "long-unmanaged": {
    id: "long-unmanaged",
    title: "장기 미관리 고객",
    description: "장기간 관리 공백이 있는 고객을 점검하세요.",
    kind: { type: "warning", warningType: "long_unmanaged" },
  },
  uncontacted: {
    id: "uncontacted",
    title: "미상담 고객",
    description: "아직 상담이 진행되지 않은 고객입니다.",
    kind: { type: "quick", quickPresetId: "uncontacted" },
  },
  "sla-overdue": {
    id: "sla-overdue",
    title: "상담 지연 고객",
    description: "배정 후 24시간이 지났지만 아직 미상담인 고객입니다.",
    kind: { type: "quick", quickPresetId: "sla_overdue" },
  },
  "no-next-action": {
    id: "no-next-action",
    title: "다음 액션 없음",
    description: "다음 액션이 비어 있는 고객을 확인하세요.",
    kind: { type: "quick", quickPresetId: "no_next_action" },
  },
};

const QUICK_PRESET_TO_URL: Partial<Record<QuickPresetId, CustomerListUrlPresetId>> =
  {
    today_contact: "priority-contact",
    urgent: "priority-urgent",
    uncontacted: "uncontacted",
    sla_overdue: "sla-overdue",
    no_next_action: "no-next-action",
  };

export function buildCustomerListPresetPath(
  preset: CustomerListUrlPresetId
): string {
  return `/customers?preset=${preset}`;
}

export function parseCustomerListUrlPreset(
  raw: string | null | undefined
): CustomerListUrlPresetId | "invalid" | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/_/g, "-");
  if (
    CUSTOMER_LIST_URL_PRESET_IDS.includes(normalized as CustomerListUrlPresetId)
  ) {
    return normalized as CustomerListUrlPresetId;
  }
  return "invalid";
}

export function getCustomerListUrlPresetMeta(
  preset: CustomerListUrlPresetId
): CustomerListUrlPresetMeta {
  return CUSTOMER_LIST_URL_PRESET_META[preset];
}

export function quickPresetToUrlPreset(
  quickPresetId: QuickPresetId
): CustomerListUrlPresetId | null {
  return QUICK_PRESET_TO_URL[quickPresetId] ?? null;
}

export function urlPresetMatchesQuickPreset(
  urlPreset: CustomerListUrlPresetId,
  quickPresetId: QuickPresetId
): boolean {
  const meta = CUSTOMER_LIST_URL_PRESET_META[urlPreset];
  return meta.kind.type === "quick" && meta.kind.quickPresetId === quickPresetId;
}

export function customerMatchesUrlPreset(input: {
  preset: CustomerListUrlPresetId;
  customerId: number;
  consultStatus?: string | null;
  nextAction?: string | null;
  agentId?: number | null;
  assignedAt?: string | Date | null;
  followUpTodayCustomerIds: ReadonlySet<number>;
  followUpOverdueCustomerIds: ReadonlySet<number>;
  recommendation?: {
    urgency?: string | null;
    warnings?: Array<{ warningType?: string | null }>;
  } | null;
}): boolean {
  const meta = CUSTOMER_LIST_URL_PRESET_META[input.preset];

  if (meta.kind.type === "follow_up_today") {
    return input.followUpTodayCustomerIds.has(input.customerId);
  }
  if (meta.kind.type === "follow_up_overdue") {
    return input.followUpOverdueCustomerIds.has(input.customerId);
  }
  if (meta.kind.type === "warning") {
    const warningType = meta.kind.warningType;
    return Boolean(
      input.recommendation?.warnings?.some(
        warning => warning.warningType === warningType
      )
    );
  }

  switch (meta.kind.quickPresetId) {
    case "today_contact":
      return Boolean(input.recommendation);
    case "urgent":
      return input.recommendation?.urgency === "high";
    case "uncontacted":
      return input.consultStatus === "미상담";
    case "sla_overdue":
      return (
        input.consultStatus === "미상담" &&
        Boolean(input.agentId) &&
        Boolean(input.assignedAt) &&
        Date.now() - new Date(input.assignedAt as string | Date).getTime() >
          24 * 60 * 60 * 1000
      );
    case "no_next_action":
      return !input.nextAction;
    default:
      return true;
  }
}
