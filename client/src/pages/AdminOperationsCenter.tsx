import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  ADMIN_OPERATION_SECTIONS,
  CARD_STATUS_LABELS,
  COMING_SOON_NOTICE,
  HIGH_RISK_NOTICE,
  NO_VISIBLE_CARDS_DESCRIPTION,
  NO_VISIBLE_CARDS_TITLE,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  PERMISSION_DENIED_DESCRIPTION,
  PERMISSION_DENIED_TITLE,
  type AdminOperationCard,
  type ManagerRole,
  RISK_LEVEL_LABELS,
  ROLE_SCOPE_HINTS,
  canAccessAdminOperationsCenter,
  filterAdminOperationCards,
  getVisibleAdminOperationCards,
  groupAdminOperationCards,
  isHighRiskCard,
} from "@/lib/adminOperationsCenter";
import { getRoleLabel } from "@/lib/userRole";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const riskBadgeClasses: Record<AdminOperationCard["riskLevel"], string> = {
  normal: "border-slate-200 bg-slate-50 text-slate-600",
  caution: "border-amber-200/80 bg-amber-50 text-amber-900",
  high: "border-rose-200/80 bg-rose-50 text-rose-900",
  branch_admin_only: "border-[#b99b5f]/30 bg-[#f8f4ea] text-[#7a6535]",
};

const statusBadgeClasses: Record<AdminOperationCard["status"], string> = {
  available: "border-emerald-200/80 bg-emerald-50 text-emerald-800",
  coming_soon: "border-slate-200 bg-slate-50 text-slate-600",
  branch_admin_only: "border-[#b99b5f]/30 bg-[#f8f4ea] text-[#7a6535]",
};

function SummarySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-white/80" />
      ))}
    </div>
  );
}

function OperationCard({
  card,
  onNavigate,
}: {
  card: AdminOperationCard;
  onNavigate: (route: string) => void;
}) {
  const isDisabled = card.isComingSoon || !card.route;
  const showHighRiskNotice = isHighRiskCard(card) && !isDisabled;
  const Icon = card.icon;

  return (
    <Card
      className={cn(
        "flex h-full flex-col border-slate-200/80 bg-white/95 shadow-sm transition-colors",
        isHighRiskCard(card) && "ring-1 ring-rose-100",
        card.riskLevel === "branch_admin_only" && "ring-1 ring-[#d9c99f]/40",
      )}
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-[#1f3b57]">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-slate-950">{card.title}</CardTitle>
              <CardDescription className="mt-1 text-sm leading-relaxed text-slate-500">
                {card.description}
              </CardDescription>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={cn("text-[11px] font-medium", riskBadgeClasses[card.riskLevel])}>
            {RISK_LEVEL_LABELS[card.riskLevel]}
          </Badge>
          <Badge variant="outline" className={cn("text-[11px] font-medium", statusBadgeClasses[card.status])}>
            {CARD_STATUS_LABELS[card.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="mt-auto space-y-3 pt-0">
        {card.isComingSoon ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-600">
            {COMING_SOON_NOTICE.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        {showHighRiskNotice ? (
          <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-xs leading-relaxed text-rose-900">
            {HIGH_RISK_NOTICE.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        <Button
          type="button"
          variant={isDisabled ? "outline" : isHighRiskCard(card) ? "destructive" : "default"}
          className={cn(
            "min-h-10 w-full justify-between",
            !isDisabled && !isHighRiskCard(card) && "bg-[#1f3b57] text-white hover:bg-[#173049]",
          )}
          disabled={isDisabled}
          onClick={() => card.route && onNavigate(card.route)}
        >
          {isDisabled ? "준비 중" : "이동"}
          {!isDisabled ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminOperationsCenter() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_OPERATION_SECTIONS.map((section) => [section.id, true])),
  );

  const role = user?.role as ManagerRole | undefined;
  const isBranchAdmin = role === "branch_admin";

  const visibleCards = useMemo(() => getVisibleAdminOperationCards(user), [user]);
  const filteredCards = useMemo(() => filterAdminOperationCards(visibleCards, search), [visibleCards, search]);
  const groupedSections = useMemo(() => groupAdminOperationCards(filteredCards), [filteredCards]);

  const {
    data: branchRisk,
    isLoading: branchRiskLoading,
    isError: branchRiskError,
    refetch: refetchBranchRisk,
  } = trpc.operationRisk.summary.useQuery({ period: "7d" }, { enabled: isBranchAdmin });

  const {
    data: scopedRisk,
    isLoading: scopedRiskLoading,
    isError: scopedRiskError,
    refetch: refetchScopedRisk,
  } = trpc.operationRisk.scopedSummary.useQuery({ period: "7d" }, { enabled: !!role && !isBranchAdmin });

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: canAccessAdminOperationsCenter(user),
  });

  const { data: pushSummary, isLoading: pushSummaryLoading } = trpc.pushNotifications.operationSummary.useQuery(undefined, {
    enabled: isBranchAdmin,
  });

  const summaryLoading = isBranchAdmin ? branchRiskLoading : scopedRiskLoading;
  const summaryError = isBranchAdmin ? branchRiskError : scopedRiskError;
  const refetchSummary = () => (isBranchAdmin ? refetchBranchRisk() : refetchScopedRisk());

  const summaryLinks = useMemo(() => {
    const links: Array<{ label: string; value: string | number; route: string; roles: ManagerRole[] }> = [];

    if (isBranchAdmin && branchRisk) {
      const issueCount = branchRisk.riskCards?.filter((item) => item.level !== "normal").length ?? 0;
      links.push({
        label: "오늘 확인할 운영 이슈",
        value: issueCount,
        route: "/operation-risk",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      });
    } else if (scopedRisk) {
      const issueCount = scopedRisk.cards?.reduce((sum, card) => sum + (card.count > 0 ? 1 : 0), 0) ?? 0;
      links.push({
        label: "오늘 확인할 운영 이슈",
        value: issueCount,
        route: "/operation-risk",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      });
      const followUpDelay = scopedRisk.cards?.find((card) => card.title.includes("후속관리"))?.count ?? 0;
      if (followUpDelay > 0) {
        links.push({
          label: "후속관리 지연",
          value: followUpDelay,
          route: "/admin/team-completion",
          roles: ["branch_admin", "sub_branch_admin", "team_leader"],
        });
      }
      const longUnmanaged = scopedRisk.cards?.find((card) => card.title.includes("장기 미관리"))?.count ?? 0;
      if (longUnmanaged > 0) {
        links.push({
          label: "장기 미관리 고객",
          value: longUnmanaged,
          route: "/aftercare-campaigns",
          roles: ["branch_admin", "sub_branch_admin", "team_leader"],
        });
      }
    }

    if ((unreadCount ?? 0) > 0) {
      links.push({
        label: "미확인 운영 알림",
        value: unreadCount ?? 0,
        route: "/notifications",
        roles: ["branch_admin", "sub_branch_admin", "team_leader"],
      });
    }

    if (isBranchAdmin) {
      const pushIssues = (pushSummary?.failed ?? 0) + (pushSummary?.skipped ?? 0);
      links.push({
        label: "푸시 오류/스킵",
        value: pushSummaryLoading ? "-" : pushIssues,
        route: "/push-notifications",
        roles: ["branch_admin"],
      });
      links.push({
        label: "인수인계 필요",
        value: "확인",
        route: "/users/handoff",
        roles: ["branch_admin"],
      });
      links.push({
        label: "미처리 삭제 요청",
        value: "확인",
        route: "/deleted-data",
        roles: ["branch_admin"],
      });
    }

    return links.filter((link) => role && link.roles.includes(role));
  }, [branchRisk, isBranchAdmin, pushSummary, pushSummaryLoading, role, scopedRisk, unreadCount]);

  if (!canAccessAdminOperationsCenter(user)) {
    return (
      <DashboardLayout>
        <EmptyState
          variant="forbidden"
          title={PERMISSION_DENIED_TITLE}
          description={PERMISSION_DENIED_DESCRIPTION}
          actionLabel="대시보드로 이동"
          onAction={() => setLocation("/")}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-8">
        <Card className="border-slate-200/80 bg-gradient-to-br from-[#f8f6f1] via-white to-[#eef4f1] shadow-sm">
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Admin Operations Center</p>
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1f3b57]/10 bg-[#1f3b57] text-white">
                    <LayoutDashboard className="h-5 w-5" />
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight text-[#1f3b57]">{PAGE_TITLE}</h1>
                </div>
                <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{PAGE_DESCRIPTION}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <Badge variant="outline" className="border-[#1f3b57]/15 bg-white text-[#1f3b57]">
                    {getRoleLabel(role)}
                  </Badge>
                  <span>{ROLE_SCOPE_HINTS[role!]}</span>
                </div>
              </div>
              <Button type="button" variant="outline" className="min-h-10 shrink-0" onClick={() => refetchSummary()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                요약 새로고침
              </Button>
            </div>

            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="관리자 기능 검색"
                className="min-h-10 rounded-xl border-slate-200 bg-white pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#1f3b57]" />
            <h2 className="text-sm font-semibold text-slate-900">오늘 확인할 운영 요약</h2>
          </div>

          {summaryError ? (
            <ErrorState
              title="운영 요약을 불러오지 못했습니다"
              description="네트워크 상태를 확인한 뒤 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요."
              retryLabel="다시 시도"
              onRetry={() => refetchSummary()}
            />
          ) : summaryLoading ? (
            <SummarySkeleton />
          ) : summaryLinks.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setLocation(item.route)}
                  className="min-h-[88px] rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-[#1f3b57]/20 hover:bg-[#f8f6f1]"
                >
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[#1f3b57]">{item.value}</p>
                </button>
              ))}
            </div>
          ) : (
            <Card className="border-slate-200/80 bg-white/95">
              <CardContent className="p-4 text-sm text-slate-500">
                현재 강조할 운영 이슈가 없습니다. 아래 카드에서 필요한 관리 기능으로 이동하세요.
              </CardContent>
            </Card>
          )}
        </section>

        {groupedSections.length === 0 ? (
          <Card className="border-slate-200/80 bg-white/95">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">{NO_VISIBLE_CARDS_TITLE}</p>
              <p className="text-sm text-slate-500">{NO_VISIBLE_CARDS_DESCRIPTION}</p>
            </CardContent>
          </Card>
        ) : (
          groupedSections.map((section) => (
            <Collapsible
              key={section.id}
              open={openSections[section.id] ?? true}
              onOpenChange={(open) => setOpenSections((current) => ({ ...current, [section.id]: open }))}
            >
              <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full min-h-10 items-start justify-between gap-3 text-left"
                    >
                      <div>
                        <CardTitle className="text-lg text-[#1f3b57]">{section.title}</CardTitle>
                        <CardDescription className="mt-1 text-sm">{section.description}</CardDescription>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform",
                          openSections[section.id] && "rotate-180",
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="grid gap-4 pb-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {section.cards.map((card) => (
                      <OperationCard key={card.id} card={card} onNavigate={setLocation} />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}

        {summaryLoading && groupedSections.length > 0 ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            운영 요약을 갱신하는 중입니다.
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
