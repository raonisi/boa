export type QuickPresetId =
  | "all"
  | "today_contact"
  | "urgent"
  | "uncontacted"
  | "sla_overdue"
  | "no_next_action"
  | "mine"
  | "new_db";

export type QuickPresetItem = {
  id: QuickPresetId;
  label: string;
  tone: string;
};

export function buildQuickPresets(role?: string | null): QuickPresetItem[] {
  const items: QuickPresetItem[] = [
    {
      id: "all",
      label: "전체",
      tone: "border-border bg-card",
    },
    {
      id: "today_contact",
      label: "오늘 연락",
      tone: "border-boa-green/25 bg-boa-green/8",
    },
    {
      id: "urgent",
      label: "긴급",
      tone: "border-destructive/25 bg-destructive/10",
    },
    {
      id: "uncontacted",
      label: "미상담",
      tone: "border-border bg-muted/40",
    },
    {
      id: "sla_overdue",
      label: "지연",
      tone: "border-destructive/20 bg-destructive/8",
    },
    {
      id: "no_next_action",
      label: "다음 액션 없음",
      tone: "border-boa-amber/25 bg-boa-amber/10",
    },
  ];

  if (role === "branch_admin") {
    items.push({
      id: "mine",
      label: "내 담당",
      tone: "border-primary/20 bg-primary/5",
    });
  }

  items.push({
    id: "new_db",
    label: "신규 DB",
    tone: "border-sky-200 bg-sky-50",
  });

  return items;
}

export function detectActiveQuickPreset(input: {
  workspaceFilter: string;
  recommendationFilter: string;
  scopeFilter: "all" | "mine";
  assignedDateFrom: string;
  assignedDateTo: string;
  hasExtraFilters: boolean;
}): QuickPresetId {
  if (input.hasExtraFilters) return "all";

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const isNewDbPreset =
    input.assignedDateFrom === weekAgo && input.assignedDateTo === today;

  if (isNewDbPreset) return "new_db";
  if (input.scopeFilter === "mine") return "mine";
  if (input.recommendationFilter === "high") return "urgent";
  if (input.workspaceFilter === "priority") return "today_contact";
  if (input.workspaceFilter === "uncontacted") return "uncontacted";
  if (input.workspaceFilter === "sla_overdue") return "sla_overdue";
  if (input.workspaceFilter === "no_next_action") return "no_next_action";

  return "all";
}

export function newDbDateRange() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}
