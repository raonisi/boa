import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  adminPage,
  adminPanel,
  adminRiskBadgeClasses,
  adminStatusBadgeClasses,
} from "@/lib/adminDesignTokens";
import {
  ADMIN_OPERATION_SECTIONS,
  CARD_STATUS_LABELS,
  HIGH_RISK_NOTICE,
  NO_VISIBLE_CARDS_DESCRIPTION,
  NO_VISIBLE_CARDS_TITLE,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  type AdminOperationCard,
  type ManagerRole,
  RISK_LEVEL_LABELS,
  ROLE_SCOPE_HINTS,
  canAccessAdminOperationsCenter,
  filterAdminOperationCards,
  getCardStatusNotice,
  getVisibleAdminOperationCards,
  groupAdminOperationCards,
  isCardNavigable,
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

const riskBadgeClasses = adminRiskBadgeClasses;
const statusBadgeClasses = adminStatusBadgeClasses;

function SummarySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map(item => (
        <div key={item} className={cn("h-24", adminPage.skeleton)} />
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
  const isDisabled = !isCardNavigable(card);
  const showHighRiskNotice = isHighRiskCard(card) && !isDisabled;
  const statusNotice = getCardStatusNotice(card);
  const showStatusNotice = card.status !== "available" || card.isComingSoon;
  const Icon = card.icon;

  return (
    <Card
      className={cn(
        "flex h-full flex-col transition-colors",
        adminPage.card,
        isHighRiskCard(card) && "ring-1 ring-destructive/10",
        card.riskLevel === "branch_admin_only" && "ring-1 ring-boa-amber/30"
      )}
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={adminPage.iconWrap}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-foreground">
                {card.title}
              </CardTitle>
              <CardDescription className={cn("mt-1", adminPage.subtitle)}>
                {card.description}
              </CardDescription>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              riskBadgeClasses[card.riskLevel]
            )}
          >
            {RISK_LEVEL_LABELS[card.riskLevel]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              statusBadgeClasses[card.status]
            )}
          >
            {CARD_STATUS_LABELS[card.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="mt-auto space-y-3 pt-0">
        {showStatusNotice ? (
          <div
            className={cn(
              "rounded-xl border p-3 text-xs leading-relaxed",
              card.status === "coming_soon" && adminPanel.neutral,
              card.status === "beta" && adminPanel.warningSoft,
              card.status === "production_ready" && adminPanel.successSoft,
              card.status === "branch_admin_only" && adminPanel.warning
            )}
          >
            {statusNotice.map(line => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        {showHighRiskNotice ? (
          <div
            className={cn(
              "rounded-xl border p-3 text-xs leading-relaxed",
              adminPanel.danger
            )}
          >
            {HIGH_RISK_NOTICE.map(line => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        <Button
          type="button"
          variant={
            isDisabled
              ? "outline"
              : isHighRiskCard(card)
                ? "destructive"
                : "default"
          }
          className={cn(
            "min-h-10 w-full justify-between",
            !isDisabled &&
              !isHighRiskCard(card) &&
              "bg-boa-navy text-primary-foreground hover:bg-boa-navy/90"
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        ADMIN_OPERATION_SECTIONS.map(section => [section.id, true])
      )
  );

  const role = user?.role as ManagerRole | undefined;
  const isBranchAdmin = role === "branch_admin";

  const visibleCards = useMemo(
    () => getVisibleAdminOperationCards(user),
    [user]
  );
  const filteredCards = useMemo(
    () => filterAdminOperationCards(visibleCards, search),
    [visibleCards, search]
  );
  const groupedSections = useMemo(
    () => groupAdminOperationCards(filteredCards),
    [filteredCards]
  );

  const {
    data: branchRisk,
    isLoading: branchRiskLoading,
    isError: branchRiskError,
    refetch: refetchBranchRisk,
  } = trpc.operationRisk.summary.useQuery(
    { period: "7d" },
    { enabled: isBranchAdmin }
  );

  const { data: unreadCount } = trpc.notifications.myUnreadCount.useQuery(
    undefined,
    {
      enabled: canAccessAdminOperationsCenter(user),
    }
  );

  const { data: pushSummary, isLoading: pushSummaryLoading } =
    trpc.pushNotifications.operationSummary.useQuery(undefined, {
      enabled: isBranchAdmin,
    });

  const summaryLoading = isBranchAdmin && branchRiskLoading;
  const summaryError = isBranchAdmin && branchRiskError;
  const refetchSummary = () => refetchBranchRisk();

  const summaryLinks = useMemo(() => {
    const links: Array<{
      label: string;
      value: string | number;
      route: string;
      roles: ManagerRole[];
    }> = [];

    if (isBranchAdmin && branchRisk) {
      const issueCount =
        branchRisk.riskCards?.filter(
          item => item.actionLevel !== "informational"
        ).length ?? 0;
      links.push({
        label: "오늘 확인할 운영 이슈",
        value: issueCount,
        route: "/operation-risk",
        roles: ["branch_admin"],
      });
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
      const pushIssues =
        (pushSummary?.failed ?? 0) + (pushSummary?.skipped ?? 0);
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

    return links.filter(link => role && link.roles.includes(role));
  }, [
    branchRisk,
    isBranchAdmin,
    pushSummary,
    pushSummaryLoading,
    role,
    unreadCount,
  ]);

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-8">
        <Card className={adminPage.heroCard}>
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className={adminPage.eyebrow}>관리자 운영</p>
                <div className="flex items-center gap-2">
                  <span className={adminPage.iconWrapSolid}>
                    <LayoutDashboard className="h-5 w-5" />
                  </span>
                  <h1
                    className={cn(
                      adminPage.title,
                      "tracking-tight text-boa-navy"
                    )}
                  >
                    {PAGE_TITLE}
                  </h1>
                </div>
                <p className={cn("max-w-3xl", adminPage.subtitle)}>
                  {PAGE_DESCRIPTION}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="border-boa-navy/15 bg-card text-boa-navy"
                  >
                    {getRoleLabel(role)}
                  </Badge>
                  <span>{ROLE_SCOPE_HINTS[role!]}</span>
                </div>
              </div>
              {isBranchAdmin ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 shrink-0"
                  onClick={() => refetchSummary()}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  요약 새로고침
                </Button>
              ) : null}
            </div>

            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="관리자 기능 검색"
                className={cn("min-h-10 pl-9", adminPage.input)}
              />
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-boa-navy" />
            <h2 className={adminPage.sectionTitle}>오늘 확인 필요</h2>
          </div>

          {summaryError ? (
            <ErrorState
              title="정보를 다시 불러오지 못했습니다."
              description="네트워크 상태를 확인한 뒤 다시 시도해 주세요. 권한 범위 안에서 확인할 수 있는 정보만 표시됩니다."
              retryLabel="다시 시도"
              onRetry={() => refetchSummary()}
            />
          ) : summaryLoading ? (
            <SummarySkeleton />
          ) : summaryLinks.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryLinks.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setLocation(item.route)}
                  className={adminPage.linkCard}
                >
                  <p className={adminPage.metricLabel}>{item.label}</p>
                  <p className={cn("mt-2", adminPage.metricValue)}>
                    {item.value}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <Card className={cn("border", adminPanel.successSoft)}>
              <CardContent className="p-4 text-sm text-boa-green">
                확인할 항목이 없습니다. 아래 카드에서 필요한 관리 기능으로
                이동하세요.
              </CardContent>
            </Card>
          )}
        </section>

        {groupedSections.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title={NO_VISIBLE_CARDS_TITLE}
            description={NO_VISIBLE_CARDS_DESCRIPTION}
            className="border-solid bg-card shadow-sm"
          />
        ) : (
          groupedSections.map(section => (
            <Collapsible
              key={section.id}
              open={openSections[section.id] ?? true}
              onOpenChange={open =>
                setOpenSections(current => ({ ...current, [section.id]: open }))
              }
            >
              <Card className={adminPage.card}>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full min-h-10 items-start justify-between gap-3 text-left"
                    >
                      <div>
                        <CardTitle className="text-lg text-boa-navy">
                          {section.title}
                        </CardTitle>
                        <CardDescription className="mt-1 text-sm">
                          {section.description}
                        </CardDescription>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                          openSections[section.id] && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="grid gap-4 pb-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {section.cards.map(card => (
                      <OperationCard
                        key={card.id}
                        card={card}
                        onNavigate={setLocation}
                      />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}

        {summaryLoading && groupedSections.length > 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            운영 요약을 갱신하는 중입니다.
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
