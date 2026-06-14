/**
 * Shared BOA admin / operations surface tokens.
 * Prefer semantic Tailwind + BOA palette over slate/rose/hex drift.
 */
export const adminPage = {
  card: "border-border/80 bg-card shadow-sm",
  heroCard:
    "border-border/80 bg-gradient-to-br from-accent/40 via-card to-boa-gray/30 shadow-sm",
  elevatedCard: "crm-elevated-card",
  eyebrow:
    "text-xs font-semibold uppercase tracking-[0.18em] text-boa-amber",
  title: "text-2xl font-bold text-foreground",
  subtitle: "text-sm leading-relaxed text-muted-foreground",
  sectionTitle: "text-sm font-semibold text-foreground",
  metricLabel: "text-xs font-medium text-muted-foreground",
  metricValue: "text-2xl font-bold tabular-nums text-boa-navy",
  iconWrap:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/50 text-boa-navy",
  iconWrapSolid:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-boa-navy/10 bg-boa-navy text-primary-foreground",
  input: "rounded-xl bg-muted/50",
  surface: "rounded-xl border border-border bg-muted/30",
  surfaceMuted: "rounded-xl border border-border bg-muted/40",
  filterBar:
    "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2",
  tableHeader: "bg-muted/40",
  skeleton: "animate-pulse rounded-xl border border-border/80 bg-muted/30",
  linkCard:
    "min-h-[88px] rounded-2xl border border-border/80 bg-card p-4 text-left shadow-sm transition-colors hover:border-boa-navy/20 hover:bg-accent/30",
  tabsList:
    "h-auto min-w-max flex-nowrap justify-start gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm sm:w-full sm:min-w-0 sm:flex-wrap",
} as const;

export const adminPanel = {
  success: "border-boa-green/25 bg-boa-green/8 text-boa-green",
  successSoft: "border-boa-green/20 bg-boa-green/5 text-foreground",
  warning: "border-boa-amber/25 bg-boa-amber/12 text-amber-900",
  warningSoft: "border-boa-amber/20 bg-boa-amber/8",
  danger: "border-destructive/25 bg-destructive/8 text-destructive",
  dangerSoft: "border-destructive/20 bg-destructive/5",
  neutral: "border-border bg-muted/30 text-muted-foreground",
} as const;

export const adminRiskBadgeClasses = {
  normal: "border-border bg-muted/50 text-muted-foreground",
  caution: "border-boa-amber/25 bg-boa-amber/16 text-amber-800",
  high: "border-destructive/20 bg-destructive/10 text-destructive",
  branch_admin_only: "border-boa-amber/30 bg-accent text-amber-900",
} as const;

export const adminStatusBadgeClasses = {
  available: "border-boa-green/25 bg-boa-green/12 text-boa-green",
  beta: "border-primary/20 bg-primary/8 text-boa-navy",
  coming_soon: "border-border bg-muted/50 text-muted-foreground",
  branch_admin_only: "border-boa-amber/30 bg-accent text-amber-900",
  production_ready: "border-boa-green/25 bg-boa-green/10 text-boa-green",
} as const;

export const adminPushStatusClasses: Record<string, string> = {
  sent: "bg-boa-green/12 text-boa-green",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground",
  pending: "bg-boa-amber/16 text-amber-800",
  skipped_disabled: "bg-muted text-muted-foreground",
};
