import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, CONSULT_STATUSES } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole } from "@/lib/userRole";
import {
  expectedPremiumStoredWonFromManwonInput,
  formatExpectedPremiumManwon,
} from "@shared/expectedPremium";
import { buildCustomerExecutionScore, type CustomerExecutionRecommendation } from "@shared/customerExecution";
import { hasCustomerBulkImportAccess } from "@shared/permissions";
import { useIsMobile } from "@/hooks/useMobile";
import { AlertTriangle, Phone, Plus, Search, UserPlus, Filter, X, Trash2, Upload, LayoutGrid, MoreHorizontal, Eye, MessageSquare, CalendarPlus, Undo2, UserCog } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type WorkspaceFilter = "all" | "priority" | "warning" | "no_next_action" | "uncontacted";

const CUSTOMER_PRIORITIES = ["A", "B", "C", "D", "unclassified"] as const;
const CUSTOMER_TAGS = ["가격민감형", "보장불안형", "가족책임형", "무관심형", "해지위험", "리밸런싱필요", "사후관리필요", "소개가능성", "고액계약가능성", "장기관리"] as const;
const CUSTOMER_NEXT_ACTIONS = ["재연락", "설계안 발송", "보장분석 진행", "계약 진행", "추가 자료 요청", "가족과 상의", "보류", "거절", "장기관리", "사후관리"] as const;

function parseCustomerTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
}

function priorityLabel(priority?: string | null) {
  return priority && priority !== "unclassified" ? priority : "미분류";
}

function executionBadges(customer: any, recommendation?: any) {
  const badges: { label: string; className: string }[] = [];
  if (customer.assignmentStatus === "unassigned" || (!customer.agentId && !customer.subBranchAdminId)) badges.push({ label: "미배정", className: "bg-slate-200 text-slate-700" });
  if (customer.consultStatus === "미상담") badges.push({ label: "미상담", className: "bg-slate-100 text-slate-700" });
  if (recommendation?.warnings?.some((warning: any) => String(warning.message).includes("장기") || String(warning.warningType).includes("long"))) {
    badges.push({ label: "장기 미관리", className: "bg-amber-100 text-amber-800" });
  }
  if (recommendation) badges.push({ label: "우선 연락", className: recommendation.urgency === "high" ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700" });
  if (!customer.priority || customer.priority === "unclassified") badges.push({ label: "우선순위 미분류", className: "bg-red-50 text-red-700" });
  return badges;
}

function nextExecutionAction(customer: any, recommendation?: any) {
  const firstReason = recommendation?.reasons?.[0]?.title ?? recommendation?.warnings?.[0]?.message;
  return customer.nextAction ?? firstReason ?? (customer.consultStatus === "미상담" ? "첫 상담 연결" : "다음 행동 설정");
}

function buildListExecution(customer: any, recommendation?: CustomerExecutionRecommendation | null) {
  const hasKnownConsultation = Boolean((recommendation as any)?.lastConsultationDate) || customer.consultStatus !== "미상담";
  const hasRecommendationContext = Boolean(recommendation);
  return buildCustomerExecutionScore({
    customer,
    recommendation,
    latestConsult: hasKnownConsultation ? {} : null,
    nextFollowUp: (recommendation as any)?.nextContactDate ? {} : hasRecommendationContext ? null : undefined,
    hasOpenFollowUp: Number((recommendation as any)?.openFollowUpCount ?? 0) > 0,
    isLongUnmanaged: recommendation?.warnings?.some((warning) => String(warning.warningType).includes("long") || String(warning.message).includes("장기")),
  });
}

function maskPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "연락처 등록";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export default function CustomerList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [nextActionFilter, setNextActionFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine">("all");
  const [recommendationFilter, setRecommendationFilter] = useState<string>("all");
  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilter>("all");
  const [assignedDateFrom, setAssignedDateFrom] = useState("");
  const [assignedDateTo, setAssignedDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null);
  const [reclaimCustomerId, setReclaimCustomerId] = useState<number | null>(null);
  const [bulkReclaimOpen, setBulkReclaimOpen] = useState(false);
  const [bulkAssigneeOpen, setBulkAssigneeOpen] = useState(false);
  const [reclaimReason, setReclaimReason] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkAssigneeReason, setBulkAssigneeReason] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();
  const { data: customers, refetch, isLoading: isCustomersLoading, isError: isCustomersError } = trpc.customers.list.useQuery({
    search: search.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter as any,
    tag: tagFilter === "all" ? undefined : tagFilter as any,
    nextAction: nextActionFilter === "all" ? undefined : nextActionFilter as any,
    assignedDateFrom: assignedDateFrom || undefined,
    assignedDateTo: assignedDateTo || undefined,
    scope: user?.role === "branch_admin" ? scopeFilter : undefined,
  });
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: priorityContacts } = trpc.recommendations.priorityContacts.useQuery({ limit: 50, includeWarnings: true });

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => { toast.success("고객이 등록되었습니다."); setShowCreate(false); refetch(); },
    onError: (err) => toast.error(err.message || "등록에 실패했습니다."),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => { toast.success("상태가 변경되었습니다."); utils.customers.list.invalidate(); },
  });

  const deactivateMutation = trpc.customers.deactivate.useMutation({
    onSuccess: () => { toast.success("고객이 삭제(비활성 처리)되었습니다."); setDeleteCustomerId(null); utils.customers.list.invalidate(); refetch(); },
    onError: (err) => toast.error(err.message || "고객 삭제에 실패했습니다."),
  });

  const closeReclaimDialog = () => {
    setReclaimCustomerId(null);
    setBulkReclaimOpen(false);
    setReclaimReason("");
  };

  const reclaimMutation = trpc.customers.reclaim.useMutation({
    onSuccess: () => {
      toast.success("고객 DB를 미배정 상태로 회수했습니다.");
      closeReclaimDialog();
      setSelectedCustomerIds([]);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: (err) => toast.error(err.message || "DB 회수에 실패했습니다."),
  });

  const reclaimBulkMutation = trpc.customers.reclaimBulk.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count}건의 고객 DB를 미배정 상태로 회수했습니다.`);
      closeReclaimDialog();
      setSelectedCustomerIds([]);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: (err) => toast.error(err.message || "선택 DB 회수에 실패했습니다."),
  });

  const bulkChangeAgentMutation = trpc.customers.bulkChangeAgent.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.changedCount}명의 담당자를 변경했습니다.${result.skippedCount ? ` (${result.skippedCount}건 제외)` : ""}`);
      setBulkAssigneeOpen(false);
      setBulkAssigneeId("");
      setBulkAssigneeReason("");
      setSelectedCustomerIds([]);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: (err) => toast.error(err.message || "담당자 일괄 지정에 실패했습니다."),
  });

  const agents = (allUsers ?? []).filter((u) => ((u as any).accountStatus === "active"));
  const agentById = new Map((allUsers ?? []).map((u) => [u.id, u]));
  const canDeactivateCustomer = user?.role === "branch_admin";
  const canReclaimCustomer = user?.role === "branch_admin";
  const canBulkChangeAssignee = Boolean(user && ["branch_admin", "sub_branch_admin", "team_leader"].includes(user.role));
  const canCreateCustomer = Boolean(user && ["branch_admin", "sub_branch_admin", "team_leader", "member"].includes(user.role));
  const canBulkImportCustomers = hasCustomerBulkImportAccess(user);
  const recommendationByCustomerId = new Map((priorityContacts ?? []).map((item) => [item.customerId, item]));
  const deleteTargetCustomer = (customers ?? []).find((c) => c.id === deleteCustomerId);
  const reclaimTargetCustomer = (customers ?? []).find((c) => c.id === reclaimCustomerId);

  const filtered = (customers ?? []).filter((c) => {
    const matchRegion = !regionFilter || (c.region ?? "").includes(regionFilter);
    const matchSource = !sourceFilter || (c.source ?? "").includes(sourceFilter);
    const matchAgent = agentFilter === "all" || String(c.agentId) === agentFilter;
    const recommendation = recommendationByCustomerId.get(c.id);
    const matchRecommendation =
      recommendationFilter === "all" ||
      (recommendationFilter === "recommended" && Boolean(recommendation)) ||
      (recommendationFilter === "warning" && Boolean(recommendation?.warnings?.length)) ||
      (recommendationFilter === "high" && recommendation?.urgency === "high");
    return matchRegion && matchSource && matchAgent && matchRecommendation;
  });

  const workspaceStats = {
    priority: filtered.filter((c) => recommendationByCustomerId.has(c.id)).length,
    warning: filtered.filter((c) => Boolean(recommendationByCustomerId.get(c.id)?.warnings?.length)).length,
    noNextAction: filtered.filter((c) => !(c as any).nextAction).length,
    uncontacted: filtered.filter((c) => c.consultStatus === "미상담").length,
  };
  const workspaceCustomers = filtered
    .filter((c) => {
      const recommendation = recommendationByCustomerId.get(c.id);
      if (workspaceFilter === "priority") return Boolean(recommendation);
      if (workspaceFilter === "warning") return Boolean(recommendation?.warnings?.length);
      if (workspaceFilter === "no_next_action") return !(c as any).nextAction;
      if (workspaceFilter === "uncontacted") return c.consultStatus === "미상담";
      return true;
    })
    .slice()
    .sort((a, b) => {
      const aExecution = buildListExecution(a, recommendationByCustomerId.get(a.id));
      const bExecution = buildListExecution(b, recommendationByCustomerId.get(b.id));
      return bExecution.score - aExecution.score;
    });

  const isCustomerReclaimable = (customer: any) =>
    canReclaimCustomer && customer.isActive !== false && (Boolean(customer.agentId) || customer.assignmentStatus !== "unassigned");
  const isCustomerAssignable = (customer: any) => canBulkChangeAssignee && customer.isActive !== false;
  const reclaimableFilteredIds = workspaceCustomers.filter(isCustomerReclaimable).map((customer) => customer.id);
  const assignableFilteredIds = workspaceCustomers.filter(isCustomerAssignable).map((customer) => customer.id);
  const selectableFilteredIds = Array.from(new Set([...reclaimableFilteredIds, ...assignableFilteredIds]));
  const selectedReclaimableIds = selectedCustomerIds.filter((customerId) => reclaimableFilteredIds.includes(customerId));
  const selectedAssignableIds = selectedCustomerIds.filter((customerId) => assignableFilteredIds.includes(customerId));
  const allVisibleSelectableSelected = selectableFilteredIds.length > 0 && selectableFilteredIds.every((customerId) => selectedCustomerIds.includes(customerId));
  const reclaimDialogOpen = reclaimCustomerId !== null || bulkReclaimOpen;
  const isReclaiming = reclaimMutation.isPending || reclaimBulkMutation.isPending;
  const isBulkChangingAssignee = bulkChangeAgentMutation.isPending;
  const bulkAssignableUsers = agents.filter((agent) => {
    if (!user) return false;
    if (user.role === "branch_admin") return true;
    if (user.role === "sub_branch_admin") return (agent.role === "team_leader" || agent.role === "member") && (agent as any).subBranchAdminId === user.id;
    if (user.role === "team_leader") return agent.role === "member" && agent.teamId === user.teamId;
    return false;
  });
  const selectedBulkAssignee = bulkAssignableUsers.find((agent) => String(agent.id) === bulkAssigneeId);

  const activeFilterChips = [
    search.trim() ? { key: "search", label: `검색어: ${search.trim()}`, clear: () => setSearch("") } : null,
    user?.role === "branch_admin" && scopeFilter !== "all" ? { key: "scope", label: "DB 범위: 내 DB", clear: () => setScopeFilter("all") } : null,
    statusFilter !== "all" ? { key: "status", label: `상담상태: ${statusFilter}`, clear: () => setStatusFilter("all") } : null,
    regionFilter ? { key: "region", label: `지역: ${regionFilter}`, clear: () => setRegionFilter("") } : null,
    sourceFilter ? { key: "source", label: `유입경로: ${sourceFilter}`, clear: () => setSourceFilter("") } : null,
    priorityFilter !== "all" ? { key: "priority", label: `우선순위: ${priorityLabel(priorityFilter)}`, clear: () => setPriorityFilter("all") } : null,
    tagFilter !== "all" ? { key: "tag", label: `성향 태그: ${tagFilter}`, clear: () => setTagFilter("all") } : null,
    nextActionFilter !== "all" ? { key: "nextAction", label: `다음 액션: ${nextActionFilter}`, clear: () => setNextActionFilter("all") } : null,
    recommendationFilter !== "all" ? {
      key: "recommendation",
      label: `추천/경고: ${recommendationFilter === "recommended" ? "우선 연락 추천" : recommendationFilter === "warning" ? "경고 있음" : "긴급 추천"}`,
      clear: () => setRecommendationFilter("all"),
    } : null,
    workspaceFilter !== "all" ? {
      key: "workspace",
      label: `작업공간: ${workspaceFilter === "priority" ? "우선 연락" : workspaceFilter === "warning" ? "경고" : workspaceFilter === "no_next_action" ? "다음 액션 없음" : "미상담"}`,
      clear: () => setWorkspaceFilter("all"),
    } : null,
    assignedDateFrom ? { key: "assignedDateFrom", label: `배정 시작: ${assignedDateFrom}`, clear: () => setAssignedDateFrom("") } : null,
    assignedDateTo ? { key: "assignedDateTo", label: `배정 종료: ${assignedDateTo}`, clear: () => setAssignedDateTo("") } : null,
    agentFilter !== "all" ? { key: "agent", label: `담당자: ${formatUserWithRole(agentById.get(Number(agentFilter)))}`, clear: () => setAgentFilter("all") } : null,
  ].filter((chip): chip is { key: string; label: string; clear: () => void } => Boolean(chip));
  const hasActiveFilters = activeFilterChips.length > 0;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRegionFilter("");
    setSourceFilter("");
    setPriorityFilter("all");
    setTagFilter("all");
    setNextActionFilter("all");
    setAgentFilter("all");
    setScopeFilter("all");
    setRecommendationFilter("all");
    setWorkspaceFilter("all");
    setAssignedDateFrom("");
    setAssignedDateTo("");
  };

  const handleDeactivateCustomer = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteCustomerId(id);
  };

  const handleOpenReclaimCustomer = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBulkReclaimOpen(false);
    setReclaimCustomerId(id);
    setReclaimReason("");
  };

  const toggleCustomerSelection = (id: number, checked: boolean) => {
    setSelectedCustomerIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter((customerId) => customerId !== id));
  };

  const handleToggleAllVisibleSelectable = (checked: boolean) => {
    setSelectedCustomerIds((prev) => {
      if (!checked) return prev.filter((customerId) => !selectableFilteredIds.includes(customerId));
      return Array.from(new Set([...prev, ...selectableFilteredIds]));
    });
  };

  const handleSubmitReclaim = () => {
    const reason = reclaimReason.trim();
    if (!reason) {
      toast.error("DB 회수 사유를 입력해주세요.");
      return;
    }
    if (reclaimCustomerId !== null) {
      reclaimMutation.mutate({ customerId: reclaimCustomerId, reason });
      return;
    }
    if (selectedReclaimableIds.length === 0) {
      toast.error("회수할 고객 DB를 선택해주세요.");
      return;
    }
    reclaimBulkMutation.mutate({ customerIds: selectedReclaimableIds, reason });
  };

  const handleSubmitBulkAssignee = () => {
    if (!bulkAssigneeId) {
      toast.error("담당자를 선택해주세요.");
      return;
    }
    if (selectedAssignableIds.length === 0) {
      toast.error("담당자를 지정할 고객을 선택해주세요.");
      return;
    }
    bulkChangeAgentMutation.mutate({
      customerIds: selectedAssignableIds,
      newAgentId: Number(bulkAssigneeId),
      reason: bulkAssigneeReason.trim() || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customer Database</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">고객 DB</h1>
              <p className="mt-1 text-sm text-muted-foreground">
              {user?.role === "sub_branch_admin" ? "부지점장 산하 고객 관리" :
               user?.role === "team_leader" ? "본인 팀 고객 관리" :
               user?.role === "member" ? "내 고객 관리" : "전체 고객 관리"}
              {" · "}표시 고객 {isCustomersLoading || isCustomersError ? "-" : filtered.length}명
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 검색 및 필터 */}
        <Card className="border-border bg-white/95 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6d2f]">Sales Workspace</p>
                <h2 className="text-lg font-bold text-slate-950">오늘 볼 고객</h2>
                <p className="text-xs text-muted-foreground">권한 범위 안의 고객만 실행 점수순으로 정렬됩니다.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation("/sales-pipeline")}>
                <LayoutGrid className="h-4 w-4 mr-1" /> 파이프라인
              </Button>
              {canCreateCustomer && (
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 신규 고객 등록
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              {[
                { key: "all" as const, label: "전체", value: isCustomersLoading || isCustomersError ? "-" : filtered.length, tone: "border-slate-200 bg-white" },
                { key: "priority" as const, label: "우선 연락", value: isCustomersLoading || isCustomersError ? "-" : workspaceStats.priority, tone: "border-emerald-200 bg-emerald-50" },
                { key: "warning" as const, label: "주의 필요", value: isCustomersLoading || isCustomersError ? "-" : workspaceStats.warning, tone: "border-red-200 bg-red-50" },
                { key: "no_next_action" as const, label: "다음 액션 없음", value: isCustomersLoading || isCustomersError ? "-" : workspaceStats.noNextAction, tone: "border-amber-200 bg-amber-50" },
                { key: "uncontacted" as const, label: "미상담", value: isCustomersLoading || isCustomersError ? "-" : workspaceStats.uncontacted, tone: "border-slate-200 bg-slate-50" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setWorkspaceFilter(item.key)}
                  className={`min-h-12 rounded-lg border p-3 text-left transition hover:shadow-sm ${workspaceFilter === item.key ? "ring-2 ring-primary/30" : ""} ${item.tone}`}
                >
                  <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                  <span className="mt-1 block text-2xl font-bold tabular-nums text-slate-950">{item.value}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {(canBulkChangeAssignee || canReclaimCustomer || canCreateCustomer) && (
          <Card className="border-slate-200 bg-slate-50/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">DB 관리 작업</p>
                <p className="text-xs text-muted-foreground">영업 실행 버튼과 배정/회수/일괄 등록 작업을 분리했습니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canBulkChangeAssignee && selectedAssignableIds.length > 0 && (
                  <Button variant="outline" size="sm" className="min-h-12 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 md:min-h-8" onClick={() => { setBulkAssigneeOpen(true); setBulkAssigneeId(""); setBulkAssigneeReason(""); }}>
                    <UserCog className="h-4 w-4 mr-1" /> 담당자 일괄 지정 {selectedAssignableIds.length}
                  </Button>
                )}
                {canReclaimCustomer && selectedReclaimableIds.length > 0 && (
                  <Button variant="outline" size="sm" className="min-h-12 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 md:min-h-8" onClick={() => { setReclaimCustomerId(null); setBulkReclaimOpen(true); setReclaimReason(""); }}>
                    <Undo2 className="h-4 w-4 mr-1" /> 선택 DB 회수 {selectedReclaimableIds.length}
                  </Button>
                )}
                {user?.role === "branch_admin" && (
                  <Button variant="outline" size="sm" className="min-h-12 md:min-h-8" onClick={() => setLocation("/customers/assign")}>
                    <UserPlus className="h-4 w-4 mr-1" /> DB 배정
                  </Button>
                )}
                {canBulkImportCustomers && (
                  <Button variant="outline" size="sm" className="min-h-12 md:min-h-8" onClick={() => setLocation("/customers/bulk-import")}>
                    <Upload className="h-4 w-4 mr-1" /> 엑셀 일괄 등록
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="이름 또는 연락처로 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-h-12 rounded-lg border-border bg-background pl-10 shadow-sm focus-visible:shadow-sm md:h-11 md:min-h-11"
                />
              </div>
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                className="min-h-12 shrink-0 rounded-lg md:h-11 md:min-h-11"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                필터{hasActiveFilters ? " ●" : ""}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="min-h-12 rounded-lg md:h-11 md:min-h-11" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2 md:grid-cols-4">
                {user?.role === "branch_admin" && (
                  <Select value={scopeFilter} onValueChange={(value) => setScopeFilter(value as "all" | "mine")}>
                    <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"><SelectValue placeholder="DB 범위" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 DB</SelectItem>
                      <SelectItem value="mine">내 DB</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"><SelectValue placeholder="상담상태" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    {CONSULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="지역 필터" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9" />
                <Input placeholder="유입경로 필터" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9" />
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"><SelectValue placeholder="우선순위" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 우선순위</SelectItem>
                    {CUSTOMER_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{priorityLabel(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"><SelectValue placeholder="성향 태그" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 태그</SelectItem>
                    {CUSTOMER_TAGS.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={nextActionFilter} onValueChange={setNextActionFilter}>
                  <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"><SelectValue placeholder="다음 액션" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 액션</SelectItem>
                    {CUSTOMER_NEXT_ACTIONS.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={recommendationFilter} onValueChange={setRecommendationFilter}>
                  <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"><SelectValue placeholder="추천/경고" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 추천</SelectItem>
                    <SelectItem value="recommended">우선 연락 추천</SelectItem>
                    <SelectItem value="warning">경고 있음</SelectItem>
                    <SelectItem value="high">긴급 추천</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={assignedDateFrom} onChange={(e) => setAssignedDateFrom(e.target.value)} className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9" title="배정일 시작" />
                <Input type="date" value={assignedDateTo} onChange={(e) => setAssignedDateTo(e.target.value)} className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9" title="배정일 종료" />
                {(user?.role === "branch_admin" || user?.role === "team_leader") && (
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"><SelectValue placeholder="담당자" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 담당자</SelectItem>
                      {agents.map((a) => <SelectItem key={a.id} value={String(a.id)}>{formatUserWithRole(a)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {hasActiveFilters && (
              <div className="rounded-2xl border border-slate-100 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600">적용된 필터</p>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                    필터 전체 해제
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      aria-label={`${chip.label} 필터 해제`}
                    >
                      <span className="min-w-0 whitespace-normal break-words leading-snug">{chip.label}</span>
                      <X className="h-3 w-3 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 모바일 카드 뷰 */}
        {isMobile ? (
          <div className="space-y-3">
            {isCustomersLoading ? (
              <Card className="border-dashed border-border bg-muted/20 shadow-sm">
                <CardContent className="py-4">
                  <EmptyState
                    variant="loading"
                    title="고객 목록을 불러오는 중입니다."
                    description="권한 범위 안의 고객 데이터를 확인하고 있습니다."
                    className="border-0 bg-transparent py-8"
                  />
                </CardContent>
              </Card>
            ) : isCustomersError ? (
              <Card className="border-dashed border-border bg-muted/20 shadow-sm">
                <CardContent className="py-4">
                  <ErrorState
                    title="고객 목록을 불러오지 못했습니다."
                    description="고객이 없는 상태와 구분해 표시하고 있습니다. 잠시 후 다시 시도해 주세요."
                    retryLabel="다시 시도"
                    onRetry={() => void refetch()}
                    className="border-0 bg-transparent py-8"
                  />
                </CardContent>
              </Card>
            ) : workspaceCustomers.length === 0 ? (
              <Card className="border-dashed border-border bg-muted/20 shadow-sm">
                <CardContent className="py-4">
                  <EmptyState
                    icon={hasActiveFilters ? Search : UserPlus}
                    title={hasActiveFilters ? "조건에 맞는 고객이 없습니다." : "등록된 고객이 없습니다."}
                    description={hasActiveFilters ? "검색어나 필터를 조정하거나 초기화해 보세요." : "권한 범위 안의 고객을 등록하면 상담과 후속관리를 시작할 수 있습니다."}
                    className="border-0 bg-transparent py-8"
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        {hasActiveFilters ? (
                          <Button type="button" variant="outline" size="sm" className="min-h-12 md:min-h-8" onClick={clearFilters}>
                            필터 초기화
                          </Button>
                        ) : null}
                        {canCreateCustomer ? (
                          <Button type="button" size="sm" className="min-h-12 md:min-h-8" onClick={() => setShowCreate(true)}>
                            신규 고객 등록
                          </Button>
                        ) : null}
                      </div>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              workspaceCustomers.map((c) => {
                const recommendation = recommendationByCustomerId.get(c.id);
                const badges = executionBadges(c, recommendation);
                const execution = buildListExecution(c, recommendation);
                return (
                <Card key={c.id} className="cursor-pointer overflow-hidden border-border bg-card shadow-sm transition hover:bg-muted/30 active:bg-muted/45" onClick={() => setLocation(`/customers/${c.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      {(canReclaimCustomer || canBulkChangeAssignee) && (
                        <Checkbox
                          checked={selectedCustomerIds.includes(c.id)}
                          disabled={!selectableFilteredIds.includes(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(checked) => toggleCustomerSelection(c.id, checked === true)}
                          aria-label={`${c.name} 고객 선택`}
                          className="mt-1"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate text-base font-semibold text-foreground">{c.name}</span>
                          <StatusBadge status={c.consultStatus} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${execution.gradeClassName}`}>관리점수 {execution.score}</span>
                          {badges.map((badge) => (
                            <span key={badge.label} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.label}</span>
                          ))}
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {parseCustomerTags((c as any).customerTags).slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{tag}</span>
                          ))}
                          {(c as any).nextAction && <span className="rounded-full border border-[#d9c99f] bg-[#fff8e8] px-2 py-0.5 text-[10px] text-[#7a5d1d]">다음: {(c as any).nextAction}</span>}
                        </div>
                        <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
                          {recommendation?.warnings?.slice(0, 1).map((warning) => (
                            <span key={warning.warningType} className="font-medium text-red-600">{warning.message}</span>
                          ))}
                          <div className="flex flex-wrap items-center gap-2">
                            {c.phone && (
                              <span className="flex items-center gap-1 font-medium">
                                <Phone className="h-3 w-3" /> {maskPhone(c.phone)}
                              </span>
                            )}
                            {c.region && <span>{c.region}</span>}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                          <p className="text-xs text-muted-foreground">담당자 {formatUserWithRole(agentById.get(c.agentId ?? 0))}</p>
                          <p className="text-sm font-bold tabular-nums text-slate-950">{c.expectedPremium != null ? formatExpectedPremiumManwon(c.expectedPremium) : "보험료 -"}</p>
                        </div>
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-xs font-semibold text-slate-800">추천 행동: {execution.actionTitle}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                            {execution.reasons.length > 0 ? execution.reasons.map((reason) => `${reason.label} +${reason.points}`).join(" · ") : "정기 관리 흐름 유지"}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-12 min-h-12 w-12 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="고객 작업 메뉴"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => setLocation(`/customers/${c.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> 상세 보기
                          </DropdownMenuItem>
                          {c.phone ? (
                            <DropdownMenuItem asChild>
                              <a href={`tel:${c.phone}`} className="flex items-center">
                                <Phone className="mr-2 h-4 w-4" /> 전화 걸기
                              </a>
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => setLocation(`/customers/${c.id}?action=consult`)}>상담기록 / 메모</DropdownMenuItem>
                          {isCustomerReclaimable(c) && (
                            <DropdownMenuItem onClick={(e) => handleOpenReclaimCustomer(c.id, e as any)}>
                              <Undo2 className="mr-2 h-4 w-4" /> DB 회수
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                      {c.phone ? (
                        <Button variant="outline" size="sm" className="min-h-12 rounded-lg px-3 text-xs" asChild>
                          <a href={`tel:${c.phone}`} aria-label={`${c.name} 전화`}>
                            <Phone className="mr-1 h-3.5 w-3.5" /> 전화
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/customers/${c.id}?action=consult`)}
                        className="min-h-12 rounded-lg px-3 text-xs"
                      >
                        <MessageSquare className="mr-1 h-3.5 w-3.5" /> 상담기록
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/customers/${c.id}?action=followup`)}
                        className="min-h-12 rounded-lg px-3 text-xs"
                      >
                        <CalendarPlus className="mr-1 h-3.5 w-3.5" /> 다음 연락일
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/customers/${c.id}`)}
                        className="min-h-12 rounded-lg px-3 text-xs"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> 상세
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })
            )}
          </div>
        ) : (
          /* 데스크톱 테이블 뷰 */
          <Card className="overflow-hidden border-border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      {(canReclaimCustomer || canBulkChangeAssignee) && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allVisibleSelectableSelected}
                            disabled={selectableFilteredIds.length === 0}
                            onCheckedChange={(checked) => handleToggleAllVisibleSelectable(checked === true)}
                            aria-label="화면에 보이는 고객 전체 선택"
                          />
                        </TableHead>
                      )}
                      <TableHead>고객 / 상태</TableHead>
                      <TableHead>우선 연락</TableHead>
                      <TableHead>다음 액션</TableHead>
                      <TableHead>상담상태</TableHead>
                      <TableHead>우선순위</TableHead>
                      <TableHead>성향</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>지역/유입</TableHead>
                      <TableHead>예상보험료</TableHead>
                      <TableHead className="w-36">빠른 액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isCustomersLoading ? (
                      <TableRow>
                        <TableCell colSpan={(canReclaimCustomer || canBulkChangeAssignee) ? 12 : 11} className="py-14 text-center align-middle">
                          <EmptyState
                            variant="loading"
                            title="고객 목록을 불러오는 중입니다."
                            description="권한 범위 안의 고객 데이터를 확인하고 있습니다."
                            className="mx-auto max-w-md border-0 bg-transparent py-0"
                          />
                        </TableCell>
                      </TableRow>
                    ) : isCustomersError ? (
                      <TableRow>
                        <TableCell colSpan={(canReclaimCustomer || canBulkChangeAssignee) ? 12 : 11} className="py-14 text-center align-middle">
                          <ErrorState
                            title="고객 목록을 불러오지 못했습니다."
                            description="고객이 없는 상태와 구분해 표시하고 있습니다. 잠시 후 다시 시도해 주세요."
                            retryLabel="다시 시도"
                            onRetry={() => void refetch()}
                            className="mx-auto max-w-md border-0 bg-transparent py-0"
                          />
                        </TableCell>
                      </TableRow>
                    ) : workspaceCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(canReclaimCustomer || canBulkChangeAssignee) ? 12 : 11} className="py-14 text-center align-middle">
                          <EmptyState
                            icon={hasActiveFilters ? Search : UserPlus}
                            title={hasActiveFilters ? "조건에 맞는 고객이 없습니다." : "등록된 고객이 없습니다."}
                            description={hasActiveFilters ? "검색어나 필터를 조정하거나 초기화해 보세요." : "권한 범위 안의 고객을 등록하면 상담과 후속관리를 시작할 수 있습니다."}
                            className="mx-auto max-w-md border-0 bg-transparent py-0"
                            action={
                              <div className="flex flex-wrap justify-center gap-2">
                                {hasActiveFilters ? (
                                  <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                                    필터 초기화
                                  </Button>
                                ) : null}
                                {canCreateCustomer ? (
                                  <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
                                    신규 고객 등록
                                  </Button>
                                ) : null}
                              </div>
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      workspaceCustomers.map((c) => {
                        const recommendation = recommendationByCustomerId.get(c.id);
                        const badges = executionBadges(c, recommendation);
                        const execution = buildListExecution(c, recommendation);
                        return (
                        <TableRow
                          key={c.id}
                          className="group cursor-pointer transition-colors hover:bg-muted/35"
                          onClick={() => setLocation(`/customers/${c.id}`)}
                        >
                          {(canReclaimCustomer || canBulkChangeAssignee) && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedCustomerIds.includes(c.id)}
                                disabled={!selectableFilteredIds.includes(c.id)}
                                onCheckedChange={(checked) => toggleCustomerSelection(c.id, checked === true)}
                                aria-label={`${c.name} 고객 선택`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium text-foreground">
                            <div className="flex flex-col gap-1">
                              <span>{c.name}</span>
                              <div className="flex flex-wrap gap-1">
                                {badges.map((badge) => (
                                  <span key={badge.label} className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.label}</span>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-1">
                              <span className={`w-fit rounded-full border px-2 py-0.5 font-semibold ${execution.gradeClassName}`}>관리점수 {execution.score}</span>
                              <span className="text-[11px] text-muted-foreground">{execution.grade}</span>
                              {recommendation?.warnings?.[0] && <span className="text-red-600">{recommendation.warnings[0].message}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <span className="line-clamp-2 text-sm font-medium text-slate-800">{execution.actionTitle || nextExecutionAction(c, recommendation)}</span>
                            {execution.reasons[0] && <p className="mt-1 text-[11px] text-muted-foreground">{execution.reasons[0].label} +{execution.reasons[0].points}</p>}
                          </TableCell>
                          <TableCell><StatusBadge status={c.consultStatus} /></TableCell>
                          <TableCell><span className="text-xs rounded-full border px-2 py-0.5 bg-muted">{priorityLabel((c as any).priority)}</span></TableCell>
                          <TableCell className="max-w-[220px]">
                            <div className="flex gap-1 flex-wrap">
                              {parseCustomerTags((c as any).customerTags).slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{tag}</span>
                              ))}
                              {parseCustomerTags((c as any).customerTags).length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatUserWithRole(agentById.get(c.agentId ?? 0))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{c.region ?? "-"}</span>
                              <span>{c.source ?? "-"}</span>
                              {(c as any).dbCompany && <span>DB 업체: {(c as any).dbCompany}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-base font-bold text-slate-950">
                            {c.expectedPremium != null ? formatExpectedPremiumManwon(c.expectedPremium) : "-"}
                          </TableCell>
                          <TableCell className="w-[148px] text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              {c.phone ? (
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild title="전화">
                                  <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()}>
                                    <Phone className="h-4 w-4" />
                                  </a>
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" disabled title="연락처 없음">
                                  <Phone className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                title="상담기록"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/customers/${c.id}?action=consult`);
                                }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                title="다음 연락"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/customers/${c.id}?action=followup`);
                                }}
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                title="상세"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/customers/${c.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canDeactivateCustomer && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="더보기">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {isCustomerReclaimable(c) && (
                                      <DropdownMenuItem onClick={(e) => handleOpenReclaimCustomer(c.id, e as any)}>
                                        <Undo2 className="h-4 w-4" /> DB 회수
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem variant="destructive" onClick={(e) => handleDeactivateCustomer(c.id, e as any)}>
                                      <Trash2 className="h-4 w-4" /> 고객 삭제
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 고객 등록 모달 */}
      <CreateCustomerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
        currentUser={user}
        agents={agents}
      />

      <Dialog open={deleteCustomerId !== null} onOpenChange={(open) => { if (!open) setDeleteCustomerId(null); }}>
        <DialogContent className="flex max-h-[min(85dvh,38rem)] max-w-md flex-col overflow-hidden rounded-2xl border-red-100 p-0">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> 고객 삭제 확인
            </DialogTitle>
            <DialogDescription>
              {deleteTargetCustomer ? `${deleteTargetCustomer.name} 고객을 비활성 처리합니다.` : "선택한 고객을 비활성 처리합니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
            완전 삭제가 아니며 활성 계약이나 진행 중 일정이 있으면 삭제할 수 없습니다. 이 작업은 활동 로그에 기록됩니다.
          </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteCustomerId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteCustomerId || deactivateMutation.isPending}
              onClick={() => deleteCustomerId && deactivateMutation.mutate({ id: deleteCustomerId })}
            >
              고객 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAssigneeOpen} onOpenChange={(open) => { setBulkAssigneeOpen(open); if (!open) { setBulkAssigneeId(""); setBulkAssigneeReason(""); } }}>
        <DialogContent className="flex max-h-[min(85dvh,42rem)] max-w-lg flex-col overflow-hidden rounded-2xl border-emerald-100 p-0">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <UserCog className="h-5 w-5" /> 담당자 일괄 지정
            </DialogTitle>
            <DialogDescription>
              선택한 고객의 담당자를 한 번에 변경합니다. 권한 범위 밖 고객은 서버에서 제외됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">선택 고객</p>
                <p className="mt-1 text-lg font-bold">{selectedCustomerIds.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-800">
                <p className="text-xs">변경 가능</p>
                <p className="mt-1 text-lg font-bold">{selectedAssignableIds.length}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-800">
                <p className="text-xs">제외 예상</p>
                <p className="mt-1 text-lg font-bold">{Math.max(0, selectedCustomerIds.length - selectedAssignableIds.length)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              삭제/비활성 고객, 권한 범위 밖 고객, 이미 같은 담당자인 고객은 변경 대상에서 제외됩니다.
            </div>
            <div>
              <Label className="text-xs">담당자 선택 *</Label>
              <Select value={bulkAssigneeId} onValueChange={setBulkAssigneeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="새 담당자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {bulkAssignableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>선택 가능한 담당자가 없습니다</SelectItem>
                  ) : (
                    bulkAssignableUsers.map((agent) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>{formatUserWithRole(agent)}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedBulkAssignee && (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  총 {selectedCustomerIds.length}명의 고객 중 {selectedAssignableIds.length}명의 담당자를 {formatUserWithRole(selectedBulkAssignee)}(으)로 변경합니다.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">변경 사유</Label>
              <Textarea
                value={bulkAssigneeReason}
                onChange={(e) => setBulkAssigneeReason(e.target.value)}
                className="mt-1 min-h-[80px]"
                maxLength={300}
                placeholder="예: 담당자 업무 조정, 지점 운영 배분, 산하 조직 재정리"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{bulkAssigneeReason.length}/300</p>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:justify-end">
            <Button variant="outline" onClick={() => { setBulkAssigneeOpen(false); setBulkAssigneeId(""); setBulkAssigneeReason(""); }} disabled={isBulkChangingAssignee}>
              취소
            </Button>
            <Button
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={!bulkAssigneeId || selectedAssignableIds.length === 0 || isBulkChangingAssignee}
              onClick={handleSubmitBulkAssignee}
            >
              {isBulkChangingAssignee ? "변경 중..." : "변경 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reclaimDialogOpen} onOpenChange={(open) => { if (!open) closeReclaimDialog(); }}>
        <DialogContent className="flex max-h-[min(85dvh,40rem)] max-w-md flex-col overflow-hidden rounded-2xl border-amber-100 p-0">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <Undo2 className="h-5 w-5" /> DB 회수 확인
            </DialogTitle>
            <DialogDescription>
              {reclaimCustomerId !== null
                ? `${reclaimTargetCustomer?.name ?? "선택 고객"} DB를 담당자에서 미배정 상태로 회수합니다.`
                : `선택한 ${selectedReclaimableIds.length}건의 고객 DB를 미배정 상태로 회수합니다.`}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              고객, 상담기록, 계약, 후속관리, 일정은 삭제하지 않습니다. 담당자 배정만 해제되며 회수 기록은 배정이력과 활동 로그에 남습니다.
            </div>
            <div>
              <Label className="text-xs">회수 사유 *</Label>
              <Textarea
                value={reclaimReason}
                onChange={(e) => setReclaimReason(e.target.value)}
                className="mt-1 min-h-[96px]"
                maxLength={300}
                placeholder="예: 담당자 퇴사/휴직, 지점장 재분배 검토, 미배정 풀 재정리"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{reclaimReason.length}/300</p>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:justify-end">
            <Button variant="outline" onClick={closeReclaimDialog} disabled={isReclaiming}>
              취소
            </Button>
            <Button
              className="bg-amber-700 text-white hover:bg-amber-800"
              disabled={!reclaimReason.trim() || isReclaiming || (reclaimCustomerId === null && selectedReclaimableIds.length === 0)}
              onClick={handleSubmitReclaim}
            >
              {isReclaiming ? "회수 중..." : "DB 회수"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CreateCustomerModal({ open, onClose, onSubmit, loading, currentUser, agents }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  currentUser: any;
  agents: any[];
}) {
  const { data: regionOptions } = trpc.settings.formOptions.useQuery({ category: "region" });
  const { data: sourceOptions } = trpc.settings.formOptions.useQuery({ category: "source" });
  const { data: consultStatusOptions } = trpc.settings.formOptions.useQuery({ category: "consultStatus" });
  const regions = regionOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const sources = sourceOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const consultStatuses = consultStatusOptions?.length ? consultStatusOptions.map((item) => item.value) : ["미상담"];
  const [form, setForm] = useState({
    name: "", phone: "", birthDate: "", gender: "" as "male" | "female" | "other" | "",
    region: "", expectedPremium: "", availableTime: "", source: "", dbCompany: "",
    consultStatus: "미상담", privacyConsent: false, marketingConsent: false, memo: "",
    agentId: "self",
  });
  const canSelectAgent = currentUser?.role === "branch_admin";
  const selectableAgents = agents.filter((agent) =>
    ["branch_admin", "sub_branch_admin", "team_leader", "member"].includes(agent.role)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSubmit({
      name: form.name, phone: form.phone || undefined,
      birthDate: form.birthDate || undefined, gender: (form.gender as any) || undefined,
      region: form.region || undefined,
      expectedPremium: form.expectedPremium
        ? expectedPremiumStoredWonFromManwonInput(form.expectedPremium)
        : undefined,
      availableTime: form.availableTime || undefined, source: form.source || undefined,
      dbCompany: form.dbCompany || undefined,
      consultStatus: form.consultStatus || undefined,
      privacyConsent: form.privacyConsent, marketingConsent: form.marketingConsent,
      memo: form.memo || undefined,
      ...(canSelectAgent && form.agentId !== "self" ? { agentId: Number(form.agentId) } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>고객 등록</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">이름 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 mt-1" required /></div>
            <div><Label className="text-xs">연락처</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 mt-1" placeholder="010-0000-0000" /></div>
            <div><Label className="text-xs">생년월일</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="h-8 mt-1" /></div>
            <div>
              <Label className="text-xs">성별</Label>
              <Select value={form.gender || "none"} onValueChange={(v) => setForm({ ...form, gender: v === "none" ? "" : v as any })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안함</SelectItem>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">지역</Label><Input list="customer-region-options" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="h-8 mt-1" /></div>
            <div>
              <Label className="text-xs">예상보험료 (만원)</Label>
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                value={form.expectedPremium}
                onChange={(e) => setForm({ ...form, expectedPremium: e.target.value })}
                className="h-8 mt-1"
                placeholder="예: 50"
              />
            </div>
            <div><Label className="text-xs">통화가능시간</Label><Input value={form.availableTime} onChange={(e) => setForm({ ...form, availableTime: e.target.value })} className="h-8 mt-1" placeholder="예: 오후 2~5시" /></div>
            <div><Label className="text-xs">유입경로</Label><Input list="customer-source-options" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="h-8 mt-1" placeholder="예: 지인소개, SNS" /></div>
            <div><Label className="text-xs">DB 업체명</Label><Input value={form.dbCompany} onChange={(e) => setForm({ ...form, dbCompany: e.target.value })} className="h-8 mt-1" placeholder="예: 렌선, 실버" /></div>
            <div>
              <Label className="text-xs">상담상태</Label>
              <Select value={form.consultStatus} onValueChange={(v) => setForm({ ...form, consultStatus: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{consultStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {canSelectAgent && (
              <div>
                <Label className="text-xs">담당자</Label>
                <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="담당자 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">내 고객으로 등록</SelectItem>
                    {selectableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>{formatUserWithRole(agent)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {!canSelectAgent && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              고객 등록 시 담당자는 본인으로 자동 배정됩니다. 타인 배정은 기존 DB 배정 메뉴에서 권한에 따라 처리됩니다.
            </div>
          )}
          <datalist id="customer-region-options">{regions.map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="customer-source-options">{sources.map((v) => <option key={v} value={v} />)}</datalist>
          <div><Label className="text-xs">메모</Label><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" /></div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.privacyConsent} onChange={(e) => setForm({ ...form, privacyConsent: e.target.checked })} />
              개인정보 동의
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} />
              마케팅 수신 동의
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button type="submit" size="sm" disabled={loading}>{loading ? "등록 중..." : "등록"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
