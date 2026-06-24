import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  buildQuickPresets,
  detectActiveQuickPreset,
  newDbDateRange,
  type QuickPresetId,
} from "@/components/customers/customerListQuickPresets";
import {
  buildCustomerListPresetPath,
  customerMatchesUrlPreset,
  getCustomerListUrlPresetMeta,
  parseCustomerListUrlPreset,
  quickPresetToUrlPreset,
  type CustomerListUrlPresetId,
} from "@/components/customers/customerListUrlPresets";
import { parseCustomerDetailAction } from "@/lib/customerDetailActions";
import { CustomerListDesktopWorkspace } from "@/components/customers/CustomerListDesktopWorkspace";
import {
  buildListExecution,
  executionBadges,
  maskPhone,
  nextExecutionAction,
} from "@/components/customers/customerListExecutionHelpers";
import { StatusBadge, CONSULT_STATUSES, CUSTOMER_PRIORITIES, getPriorityLabel, PriorityBadge, ExecutionBadge } from "@/components/StatusBadge";
import { adminPanel, statusSemantic } from "@/lib/adminDesignTokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, renderMetricValue } from "@/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import {
  formatReassignmentSuccessMessage,
  summarizeCurrentAssignees,
  WORKFLOW_COPY,
} from "@/lib/assignmentWorkflowCopy";
import {
  getUserFacingErrorMessage,
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { formatUserWithRole } from "@/lib/userRole";
import {
  expectedPremiumStoredWonFromManwonInput,
  formatExpectedPremiumManwon,
} from "@shared/expectedPremium";
import { hasCustomerBulkImportAccess } from "@shared/permissions";
import type { DetailedFollowUpSeed } from "@shared/followupQuickCreate";
import { useIsMobile } from "@/hooks/useMobile";
import {
  AlertTriangle,
  Phone,
  Plus,
  Search,
  UserPlus,
  Filter,
  X,
  Trash2,
  Upload,
  LayoutGrid,
  MoreHorizontal,
  Eye,
  MessageSquare,
  CalendarPlus,
  Undo2,
  UserCog,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { QuickConsultationModal } from "@/components/consultations/QuickConsultationModal";
import FollowupQuickCreateDialog from "@/components/followups/FollowupQuickCreateDialog";
import FollowUpModal from "@/components/followups/FollowUpModal";
import { useLocation } from "wouter";
import { toast } from "sonner";

type WorkspaceFilter =
  | "all"
  | "priority"
  | "warning"
  | "no_next_action"
  | "uncontacted"
  | "sla_overdue";

const CUSTOMER_TAGS = [
  "가격민감형",
  "보장불안형",
  "가족책임형",
  "무관심형",
  "해지위험",
  "리밸런싱필요",
  "사후관리필요",
  "소개가능성",
  "고액계약가능성",
  "장기관리",
] as const;
const CUSTOMER_NEXT_ACTIONS = [
  "재연락",
  "설계안 발송",
  "보장분석 진행",
  "계약 진행",
  "추가 자료 요청",
  "가족과 상의",
  "보류",
  "거절",
  "장기관리",
  "사후관리",
] as const;

export default function CustomerList() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
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
  const [recommendationFilter, setRecommendationFilter] =
    useState<string>("all");
  const [workspaceFilter, setWorkspaceFilter] =
    useState<WorkspaceFilter>("all");
  const [assignedDateFrom, setAssignedDateFrom] = useState("");
  const [assignedDateTo, setAssignedDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null);
  const [reclaimCustomerId, setReclaimCustomerId] = useState<number | null>(
    null
  );
  const [bulkReclaimOpen, setBulkReclaimOpen] = useState(false);
  const [bulkAssigneeOpen, setBulkAssigneeOpen] = useState(false);
  const [bulkAssigneeConfirmOpen, setBulkAssigneeConfirmOpen] = useState(false);
  const [reclaimReason, setReclaimReason] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkAssigneeReason, setBulkAssigneeReason] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [selectedQuickConsultCustomer, setSelectedQuickConsultCustomer] =
    useState<any>(null);
  const [showFollowUpQuickModal, setShowFollowUpQuickModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDetailedSeed, setFollowUpDetailedSeed] =
    useState<DetailedFollowUpSeed | null>(null);
  const [followUpCustomerId, setFollowUpCustomerId] = useState<number | null>(
    null
  );
  const [activeUrlPreset, setActiveUrlPreset] =
    useState<CustomerListUrlPresetId | null>(null);
  const lastUrlPresetRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  const presetInUrl = useMemo(() => {
    const query = location.split("?")[1]?.split("#")[0];
    return parseCustomerListUrlPreset(
      new URLSearchParams(query ?? "").get("preset")
    );
  }, [location]);
  const effectiveUrlPreset =
    activeUrlPreset ??
    (presetInUrl && presetInUrl !== "invalid" ? presetInUrl : null);
  const needsTodayFollowUps = effectiveUrlPreset === "today-follow-up";
  const needsOverdueFollowUps = effectiveUrlPreset === "overdue-follow-up";

  const { data: todayFollowUps } = trpc.followUps.listToday.useQuery(
    {},
    { enabled: needsTodayFollowUps }
  );
  const { data: overdueFollowUps } = trpc.followUps.listOverdue.useQuery(
    {},
    { enabled: needsOverdueFollowUps }
  );

  const followUpTodayCustomerIds = useMemo(
    () => new Set((todayFollowUps ?? []).map(followUp => followUp.customerId)),
    [todayFollowUps]
  );
  const followUpOverdueCustomerIds = useMemo(
    () =>
      new Set((overdueFollowUps ?? []).map(followUp => followUp.customerId)),
    [overdueFollowUps]
  );

  const applyUrlPreset = (presetId: CustomerListUrlPresetId) => {
    const meta = getCustomerListUrlPresetMeta(presetId);
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

    if (meta.kind.type === "quick") {
      switch (meta.kind.quickPresetId) {
        case "today_contact":
          setWorkspaceFilter("priority");
          break;
        case "urgent":
          setRecommendationFilter("high");
          break;
        case "uncontacted":
          setWorkspaceFilter("uncontacted");
          break;
        case "sla_overdue":
          setWorkspaceFilter("sla_overdue");
          break;
        case "no_next_action":
          setWorkspaceFilter("no_next_action");
          break;
        default:
          break;
      }
    }
    setActiveUrlPreset(presetId);
  };

  const syncUrlPreset = (presetId: CustomerListUrlPresetId | null) => {
    const query = location.split("?")[1]?.split("#")[0] ?? "";
    const params = new URLSearchParams(query);
    if (presetId) {
      params.set("preset", presetId);
    } else {
      params.delete("preset");
    }
    const nextQuery = params.toString();
    const nextPath = nextQuery ? `/customers?${nextQuery}` : "/customers";
    if (nextPath !== location) setLocation(nextPath);
  };

  const clearUrlPreset = () => {
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
    setActiveUrlPreset(null);
    lastUrlPresetRef.current = null;
    syncUrlPreset(null);
  };

  useEffect(() => {
    const query = location.split("?")[1]?.split("#")[0];
    const params = new URLSearchParams(query ?? "");
    const action = parseCustomerDetailAction(params.get("action"));
    if (action === "invalid") {
      toast.error("지원하지 않는 실행 작업입니다.");
      return;
    }
    if (action === "quick-followup" || action === "followup") {
      setShowFollowUpQuickModal(true);
    }

    const presetRaw = params.get("preset");
    const parsedPreset = parseCustomerListUrlPreset(presetRaw);

    if (parsedPreset === "invalid") {
      if (lastUrlPresetRef.current !== presetRaw) {
        toast.error("지원하지 않는 업무 보기입니다.");
        lastUrlPresetRef.current = presetRaw;
      }
      setActiveUrlPreset(null);
      if (presetRaw) syncUrlPreset(null);
      return;
    }

    if (parsedPreset && parsedPreset !== lastUrlPresetRef.current) {
      lastUrlPresetRef.current = parsedPreset;
      applyUrlPreset(parsedPreset);
      return;
    }

    if (!parsedPreset && lastUrlPresetRef.current) {
      lastUrlPresetRef.current = null;
      setActiveUrlPreset(null);
    }
  }, [location]);

  const utils = trpc.useUtils();
  const {
    data: customers,
    refetch,
    isLoading: isCustomersLoading,
    isError: isCustomersError,
  } = trpc.customers.list.useQuery({
    search: search.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : (priorityFilter as any),
    tag: tagFilter === "all" ? undefined : (tagFilter as any),
    nextAction:
      nextActionFilter === "all" ? undefined : (nextActionFilter as any),
    agentIdFilter:
      agentFilter !== "all" && agentFilter !== "unassigned"
        ? Number(agentFilter)
        : undefined,
    unassigned: agentFilter === "unassigned" ? true : undefined,
    assignmentStatus: agentFilter === "unassigned" ? "unassigned" : undefined,
    assignedDateFrom: assignedDateFrom || undefined,
    assignedDateTo: assignedDateTo || undefined,
    scope: user?.role === "branch_admin" ? scopeFilter : undefined,
  });
  const { data: allUsers } = trpc.users.list.useQuery({ activeOnly: true });
  const { data: priorityContacts } =
    trpc.recommendations.priorityContacts.useQuery({
      limit: 50,
      includeWarnings: true,
    });
  const listCustomerIds = useMemo(
    () => (customers ?? []).map(customer => customer.id).slice(0, 200),
    [customers]
  );
  const { data: relationFlags } =
    trpc.customerRelationships.relationFlags.useQuery(
      { customerIds: listCustomerIds },
      { enabled: listCustomerIds.length > 0 }
    );

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("고객이 등록되었습니다.");
      setShowCreate(false);
      refetch();
    },
    onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
  });

  const createFollowUpMutation = trpc.followUps.create.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(
        variables.calendarSchedule
          ? "후속관리를 등록했습니다. 캘린더 일정도 함께 등록되었습니다."
          : "후속관리를 등록했습니다."
      );
      setShowFollowUpQuickModal(false);
      setShowFollowUpModal(false);
      setFollowUpDetailedSeed(null);
      setFollowUpCustomerId(null);
      utils.dashboard.todayWork.invalidate();
      utils.followUps.listToday.invalidate();
      utils.followUps.listOverdue.invalidate();
      if (variables.calendarSchedule) utils.schedules.list.invalidate();
    },
    onError: err =>
      toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
  });

  const openDetailedFollowUp = (
    seed: DetailedFollowUpSeed,
    customerId: number
  ) => {
    setFollowUpCustomerId(customerId);
    setFollowUpDetailedSeed(seed);
    setShowFollowUpQuickModal(false);
    setShowFollowUpModal(true);
  };

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success("상태가 변경되었습니다.");
      utils.customers.list.invalidate();
    },
  });

  const deactivateMutation = trpc.customers.deactivate.useMutation({
    onSuccess: () => {
      toast.success("고객이 삭제(비활성 처리)되었습니다.");
      setDeleteCustomerId(null);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
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
    onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
  });

  const reclaimBulkMutation = trpc.customers.reclaimBulk.useMutation({
    onSuccess: result => {
      toast.success(
        `${result.count}건의 고객 DB를 미배정 상태로 회수했습니다.`
      );
      closeReclaimDialog();
      setSelectedCustomerIds([]);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: err => toastUserFacingError(err, USER_FACING_ERRORS.saveFailed),
  });

  const bulkChangeAgentMutation = trpc.customers.bulkChangeAgent.useMutation({
    onSuccess: result => {
      toast.success(
        formatReassignmentSuccessMessage({
          changedCount: result.changedCount,
          newAssigneeLabel: selectedBulkAssignee
            ? formatUserWithRole(selectedBulkAssignee)
            : "새 담당자",
          skippedCount: result.skippedCount,
        })
      );
      setBulkAssigneeOpen(false);
      setBulkAssigneeConfirmOpen(false);
      setBulkAssigneeId("");
      setBulkAssigneeReason("");
      setSelectedCustomerIds([]);
      utils.customers.list.invalidate();
      utils.customers.assignmentHistory.invalidate();
      refetch();
    },
    onError: err =>
      toast.error(
        getUserFacingErrorMessage(
          err,
          USER_FACING_ERRORS.saveFailed
        )
      ),
  });

  const agents = (allUsers ?? []).filter(
    u => (u as any).accountStatus === "active"
  );
  const agentById = new Map((allUsers ?? []).map(u => [u.id, u]));
  const canDeactivateCustomer = user?.role === "branch_admin";
  const canReclaimCustomer = user?.role === "branch_admin";
  const canBulkChangeAssignee = Boolean(
    user &&
      ["branch_admin", "sub_branch_admin", "team_leader"].includes(user.role)
  );
  const canCreateCustomer = Boolean(
    user &&
      ["branch_admin", "sub_branch_admin", "team_leader", "member"].includes(
        user.role
      )
  );
  const canBulkImportCustomers = hasCustomerBulkImportAccess(user);
  const canFilterByAgent = Boolean(
    user &&
      ["branch_admin", "sub_branch_admin", "team_leader"].includes(user.role)
  );
  const agentFilterOptions = agents.filter(agent => {
    if (!user) return false;
    if (user.role === "branch_admin") {
      return (
        agent.role === "branch_admin" ||
        agent.role === "sub_branch_admin" ||
        agent.role === "team_leader" ||
        agent.role === "member"
      );
    }
    if (user.role === "sub_branch_admin") {
      return agent.role === "team_leader" || agent.role === "member";
    }
    if (user.role === "team_leader") {
      return agent.role === "member";
    }
    return false;
  });
  const recommendationByCustomerId = new Map(
    (priorityContacts ?? []).map(item => [item.customerId, item])
  );
  const deleteTargetCustomer = (customers ?? []).find(
    c => c.id === deleteCustomerId
  );
  const reclaimTargetCustomer = (customers ?? []).find(
    c => c.id === reclaimCustomerId
  );

  const filtered = (customers ?? []).filter(c => {
    const matchRegion =
      !regionFilter || (c.region ?? "").includes(regionFilter);
    const matchSource =
      !sourceFilter || (c.source ?? "").includes(sourceFilter);
    const matchAgent =
      agentFilter === "all" ||
      (agentFilter === "unassigned"
        ? c.agentId == null && c.assignmentStatus === "unassigned"
        : String(c.agentId) === agentFilter);
    const recommendation = recommendationByCustomerId.get(c.id);
    const matchRecommendation =
      recommendationFilter === "all" ||
      (recommendationFilter === "recommended" && Boolean(recommendation)) ||
      (recommendationFilter === "warning" &&
        Boolean(recommendation?.warnings?.length)) ||
      (recommendationFilter === "high" && recommendation?.urgency === "high");
    return matchRegion && matchSource && matchAgent && matchRecommendation;
  });

  const workspaceStats = {
    priority: filtered.filter(c => recommendationByCustomerId.has(c.id)).length,
    warning: filtered.filter(c =>
      Boolean(recommendationByCustomerId.get(c.id)?.warnings?.length)
    ).length,
    urgent: filtered.filter(
      c => recommendationByCustomerId.get(c.id)?.urgency === "high"
    ).length,
    noNextAction: filtered.filter(c => !(c as any).nextAction).length,
    uncontacted: filtered.filter(c => c.consultStatus === "미상담").length,
    slaOverdue: filtered.filter(
      c =>
        c.consultStatus === "미상담" &&
        c.agentId &&
        c.assignedAt &&
        Date.now() - new Date(c.assignedAt).getTime() > 24 * 60 * 60 * 1000
    ).length,
    newDb: filtered.filter(c => {
      if (!c.assignedAt) return false;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(c.assignedAt).getTime() >= weekAgo;
    }).length,
    mine:
      user?.role === "branch_admin"
        ? filtered.filter(c => c.agentId === user.id).length
        : 0,
  };
  const workspaceCustomers = filtered
    .filter(c => {
      const recommendation = recommendationByCustomerId.get(c.id);
      if (effectiveUrlPreset) {
        return customerMatchesUrlPreset({
          preset: effectiveUrlPreset,
          customerId: c.id,
          consultStatus: c.consultStatus,
          nextAction: (c as any).nextAction,
          agentId: c.agentId,
          assignedAt: c.assignedAt,
          followUpTodayCustomerIds,
          followUpOverdueCustomerIds,
          recommendation,
        });
      }
      if (workspaceFilter === "priority") return Boolean(recommendation);
      if (workspaceFilter === "warning")
        return Boolean(recommendation?.warnings?.length);
      if (workspaceFilter === "no_next_action") return !(c as any).nextAction;
      if (workspaceFilter === "uncontacted")
        return c.consultStatus === "미상담";
      if (workspaceFilter === "sla_overdue")
        return (
          c.consultStatus === "미상담" &&
          c.agentId &&
          c.assignedAt &&
          Date.now() - new Date(c.assignedAt).getTime() > 24 * 60 * 60 * 1000
        );
      return true;
    })
    .slice()
    .sort((a, b) => {
      const aExecution = buildListExecution(
        a,
        recommendationByCustomerId.get(a.id)
      );
      const bExecution = buildListExecution(
        b,
        recommendationByCustomerId.get(b.id)
      );
      return bExecution.score - aExecution.score;
    });

  const isCustomerReclaimable = (customer: any) =>
    canReclaimCustomer &&
    customer.isActive !== false &&
    (Boolean(customer.agentId) || customer.assignmentStatus !== "unassigned");
  const isCustomerAssignable = (customer: any) =>
    canBulkChangeAssignee && customer.isActive !== false;
  const reclaimableFilteredIds = workspaceCustomers
    .filter(isCustomerReclaimable)
    .map(customer => customer.id);
  const assignableFilteredIds = workspaceCustomers
    .filter(isCustomerAssignable)
    .map(customer => customer.id);
  const selectableFilteredIds = Array.from(
    new Set([...reclaimableFilteredIds, ...assignableFilteredIds])
  );
  const selectedReclaimableIds = selectedCustomerIds.filter(customerId =>
    reclaimableFilteredIds.includes(customerId)
  );
  const selectedAssignableIds = selectedCustomerIds.filter(customerId =>
    assignableFilteredIds.includes(customerId)
  );
  const allVisibleSelectableSelected =
    selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every(customerId =>
      selectedCustomerIds.includes(customerId)
    );
  const reclaimDialogOpen = reclaimCustomerId !== null || bulkReclaimOpen;
  const isReclaiming =
    reclaimMutation.isPending || reclaimBulkMutation.isPending;
  const isBulkChangingAssignee = bulkChangeAgentMutation.isPending;
  const bulkAssignableUsers = agents.filter(agent => {
    if (!user) return false;
    if (user.role === "branch_admin") return true;
    if (user.role === "sub_branch_admin")
      return (
        (agent.role === "team_leader" || agent.role === "member") &&
        (agent as any).subBranchAdminId === user.id
      );
    if (user.role === "team_leader")
      return agent.role === "member" && agent.teamId === user.teamId;
    return false;
  });
  const selectedBulkAssignee = bulkAssignableUsers.find(
    agent => String(agent.id) === bulkAssigneeId
  );
  const reassignmentCurrentAssigneeSummary = summarizeCurrentAssignees(
    selectedAssignableIds,
    customers ?? [],
    agentId => formatUserWithRole(agentById.get(agentId))
  );

  const activeFilterChips = [
    search.trim()
      ? {
          key: "search",
          label: `검색어: ${search.trim()}`,
          clear: () => setSearch(""),
        }
      : null,
    user?.role === "branch_admin" && scopeFilter !== "all"
      ? {
          key: "scope",
          label: "DB 범위: 내 DB",
          clear: () => setScopeFilter("all"),
        }
      : null,
    statusFilter !== "all"
      ? {
          key: "status",
          label: `상담상태: ${statusFilter}`,
          clear: () => setStatusFilter("all"),
        }
      : null,
    regionFilter
      ? {
          key: "region",
          label: `지역: ${regionFilter}`,
          clear: () => setRegionFilter(""),
        }
      : null,
    sourceFilter
      ? {
          key: "source",
          label: `유입경로: ${sourceFilter}`,
          clear: () => setSourceFilter(""),
        }
      : null,
    priorityFilter !== "all"
      ? {
          key: "priority",
          label: `우선순위: ${getPriorityLabel(priorityFilter)}`,
          clear: () => setPriorityFilter("all"),
        }
      : null,
    tagFilter !== "all"
      ? {
          key: "tag",
          label: `성향 태그: ${tagFilter}`,
          clear: () => setTagFilter("all"),
        }
      : null,
    nextActionFilter !== "all"
      ? {
          key: "nextAction",
          label: `다음 액션: ${nextActionFilter}`,
          clear: () => setNextActionFilter("all"),
        }
      : null,
    recommendationFilter !== "all"
      ? {
          key: "recommendation",
          label: `추천/경고: ${recommendationFilter === "recommended" ? "우선 연락 추천" : recommendationFilter === "warning" ? "경고 있음" : "긴급"}`,
          clear: () => setRecommendationFilter("all"),
        }
      : null,
    workspaceFilter !== "all"
      ? {
          key: "workspace",
          label: `빠른 필터: ${
            workspaceFilter === "priority"
              ? "오늘 연락"
              : workspaceFilter === "warning"
                ? "경고 고객"
                : workspaceFilter === "no_next_action"
                  ? "다음 액션 없음"
                  : workspaceFilter === "sla_overdue"
                    ? "지연"
                    : "미상담"
          }`,
          clear: () => setWorkspaceFilter("all"),
        }
      : null,
    assignedDateFrom
      ? {
          key: "assignedDateFrom",
          label: `배정 시작: ${assignedDateFrom}`,
          clear: () => setAssignedDateFrom(""),
        }
      : null,
    assignedDateTo
      ? {
          key: "assignedDateTo",
          label: `배정 종료: ${assignedDateTo}`,
          clear: () => setAssignedDateTo(""),
        }
      : null,
    agentFilter !== "all"
      ? {
          key: "agent",
          label: `담당자: ${agentFilter === "unassigned" ? "담당자 없음" : formatUserWithRole(agentById.get(Number(agentFilter)))}`,
          clear: () => setAgentFilter("all"),
        }
      : null,
  ].filter((chip): chip is { key: string; label: string; clear: () => void } =>
    Boolean(chip)
  );
  const hasActiveFilters = activeFilterChips.length > 0;

  const hasExtraFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    Boolean(regionFilter) ||
    Boolean(sourceFilter) ||
    priorityFilter !== "all" ||
    tagFilter !== "all" ||
    nextActionFilter !== "all" ||
    agentFilter !== "all";

  const activeQuickPreset = detectActiveQuickPreset({
    workspaceFilter,
    recommendationFilter,
    scopeFilter,
    assignedDateFrom,
    assignedDateTo,
    hasExtraFilters,
  });

  const quickPresets = buildQuickPresets(user?.role);
  const quickPresetCounts: Record<QuickPresetId, number> = {
    all: filtered.length,
    today_contact: workspaceStats.priority,
    urgent: workspaceStats.urgent,
    uncontacted: workspaceStats.uncontacted,
    sla_overdue: workspaceStats.slaOverdue,
    no_next_action: workspaceStats.noNextAction,
    mine: workspaceStats.mine,
    new_db: workspaceStats.newDb,
  };

  const applyQuickPreset = (presetId: QuickPresetId) => {
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

    switch (presetId) {
      case "all":
        setActiveUrlPreset(null);
        lastUrlPresetRef.current = null;
        syncUrlPreset(null);
        break;
      case "today_contact":
        setWorkspaceFilter("priority");
        break;
      case "urgent":
        setRecommendationFilter("high");
        break;
      case "uncontacted":
        setWorkspaceFilter("uncontacted");
        break;
      case "sla_overdue":
        setWorkspaceFilter("sla_overdue");
        break;
      case "no_next_action":
        setWorkspaceFilter("no_next_action");
        break;
      case "mine":
        setScopeFilter("mine");
        break;
      case "new_db": {
        const { from, to } = newDbDateRange();
        setAssignedDateFrom(from);
        setAssignedDateTo(to);
        break;
      }
    }

    const mappedUrlPreset = quickPresetToUrlPreset(presetId);
    if (mappedUrlPreset) {
      setActiveUrlPreset(mappedUrlPreset);
      lastUrlPresetRef.current = mappedUrlPreset;
      syncUrlPreset(mappedUrlPreset);
      return;
    }

    if (presetId !== "all") {
      setActiveUrlPreset(null);
      lastUrlPresetRef.current = null;
      syncUrlPreset(null);
    }
  };

  const clearFilters = () => {
    clearUrlPreset();
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
    setSelectedCustomerIds(prev =>
      checked
        ? Array.from(new Set([...prev, id]))
        : prev.filter(customerId => customerId !== id)
    );
  };

  const handleToggleAllVisibleSelectable = (checked: boolean) => {
    setSelectedCustomerIds(prev => {
      if (!checked)
        return prev.filter(
          customerId => !selectableFilteredIds.includes(customerId)
        );
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

  const handleOpenBulkAssigneeConfirm = () => {
    if (!bulkAssigneeId) {
      toast.error("새 담당자를 선택해주세요.");
      return;
    }
    if (selectedAssignableIds.length === 0) {
      toast.error("재지정할 고객을 선택해주세요.");
      return;
    }
    setBulkAssigneeConfirmOpen(true);
  };

  const handleSubmitBulkAssignee = () => {
    bulkChangeAgentMutation.mutate({
      customerIds: selectedAssignableIds,
      newAgentId: Number(bulkAssigneeId),
      reason: bulkAssigneeReason.trim() || undefined,
    });
  };

  const hasBulkSelection = selectedCustomerIds.length > 0;
  const roleListDescription =
    user?.role === "sub_branch_admin"
      ? "부지점장 산하 고객을 오늘 바로 조치할 순서대로 확인합니다."
      : user?.role === "team_leader"
        ? "팀 고객 중 지금 연락·상담·후속이 필요한 고객부터 실행합니다."
        : user?.role === "member"
          ? "내 담당 고객과 오늘 연락할 고객을 빠르게 찾습니다."
          : "지점 고객을 실행 점수순으로 보고 오늘 조치할 고객부터 관리합니다.";

  const advancedFilterFields = (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
      {user?.role === "branch_admin" && (
        <Select
          value={scopeFilter}
          onValueChange={value => setScopeFilter(value as "all" | "mine")}
        >
          <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9">
            <SelectValue placeholder="DB 범위" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 DB</SelectItem>
            <SelectItem value="mine">내 DB</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9">
          <SelectValue placeholder="상담상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          {CONSULT_STATUSES.map(s => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="지역 필터"
        value={regionFilter}
        onChange={e => setRegionFilter(e.target.value)}
        className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"
      />
      <Input
        placeholder="유입경로 필터"
        value={sourceFilter}
        onChange={e => setSourceFilter(e.target.value)}
        className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"
      />
      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
        <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9">
          <SelectValue placeholder="우선순위" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 우선순위</SelectItem>
          {CUSTOMER_PRIORITIES.map(p => (
            <SelectItem key={p} value={p}>
              {getPriorityLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={tagFilter} onValueChange={setTagFilter}>
        <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9">
          <SelectValue placeholder="성향 태그" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 태그</SelectItem>
          {CUSTOMER_TAGS.map(tag => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={nextActionFilter} onValueChange={setNextActionFilter}>
        <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9">
          <SelectValue placeholder="다음 액션" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 액션</SelectItem>
          {CUSTOMER_NEXT_ACTIONS.map(action => (
            <SelectItem key={action} value={action}>
              {action}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={recommendationFilter}
        onValueChange={setRecommendationFilter}
      >
        <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9">
          <SelectValue placeholder="추천/경고" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 추천</SelectItem>
          <SelectItem value="recommended">우선 연락 추천</SelectItem>
          <SelectItem value="warning">경고 있음</SelectItem>
          <SelectItem value="high">긴급 추천</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={assignedDateFrom}
        onChange={e => setAssignedDateFrom(e.target.value)}
        className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"
        title="배정일 시작"
      />
      <Input
        type="date"
        value={assignedDateTo}
        onChange={e => setAssignedDateTo(e.target.value)}
        className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9"
        title="배정일 종료"
      />
      {canFilterByAgent && (
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="min-h-12 rounded-xl bg-white text-xs md:h-9 md:min-h-9">
            <SelectValue placeholder="담당자" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 담당자</SelectItem>
            <SelectItem value="unassigned">담당자 없음</SelectItem>
            {agentFilterOptions.map(a => (
              <SelectItem key={a.id} value={String(a.id)}>
                {formatUserWithRole(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className={`space-y-4 ${hasBulkSelection ? "pb-28" : ""}`}>
        <Card className="overflow-hidden border-border shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  고객 관리
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {roleListDescription}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  표시 고객{" "}
                  {renderMetricValue(workspaceCustomers.length, {
                    isLoading: isCustomersLoading,
                    isError: isCustomersError,
                  })}
                  명 · 실행 점수순
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => setLocation("/sales-pipeline")}
                >
                  <LayoutGrid className="mr-1 h-4 w-4" /> 파이프라인
                </Button>
                {user?.role === "branch_admin" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setLocation("/customers/assign")}
                  >
                    <UserPlus className="mr-1 h-4 w-4" /> DB 배정
                  </Button>
                )}
                {canBulkImportCustomers && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setLocation("/customers/bulk-import")}
                  >
                    <Upload className="mr-1 h-4 w-4" /> 엑셀 일괄 등록
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  onClick={() => setShowFollowUpQuickModal(true)}
                >
                  <CalendarPlus className="mr-1 h-4 w-4" /> 빠른 후속 등록
                </Button>
                {canCreateCustomer && (
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" /> 신규 고객 등록
                  </Button>
                )}
              </div>
            </div>

            {effectiveUrlPreset ? (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {getCustomerListUrlPresetMeta(effectiveUrlPreset).title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {getCustomerListUrlPresetMeta(effectiveUrlPreset).description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0"
                    onClick={clearUrlPreset}
                  >
                    전체 고객 보기
                  </Button>
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                오늘 처리할 고객
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {quickPresets.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyQuickPreset(preset.id)}
                    className={`min-h-11 shrink-0 rounded-full border px-3 py-2 text-left transition hover:shadow-sm ${activeQuickPreset === preset.id ? "ring-2 ring-primary/35" : ""} ${preset.tone}`}
                  >
                    <span className="block text-xs font-medium text-muted-foreground">
                      {preset.label}
                    </span>
                    <span className="mt-0.5 block text-lg font-bold tabular-nums leading-none text-foreground">
                      {renderMetricValue(quickPresetCounts[preset.id], {
                        isLoading: isCustomersLoading,
                        isError: isCustomersError,
                      })}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="고객명, 연락처를 검색하세요"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="min-h-12 rounded-lg border-border bg-background pl-10 shadow-sm focus-visible:shadow-sm md:h-11 md:min-h-11"
                />
              </div>
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                className="min-h-12 shrink-0 rounded-lg md:h-11 md:min-h-11"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-1 h-4 w-4" />
                고급 필터{hasActiveFilters ? " ●" : ""}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-12 rounded-lg md:h-11 md:min-h-11"
                  onClick={clearFilters}
                >
                  필터 초기화
                </Button>
              )}
            </div>

            {!isMobile && showFilters && (
              <div className={statusSemantic.filterPanel}>
                {advancedFilterFields}
              </div>
            )}

            {hasActiveFilters && (
              <div className={statusSemantic.filterChipPanel}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    적용된 필터
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={clearFilters}
                  >
                    필터 초기화
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterChips.map(chip => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.clear}
                      className={statusSemantic.filterChip}
                      aria-label={`${chip.label} 필터 해제`}
                    >
                      <span className="min-w-0 whitespace-normal break-words leading-snug">
                        {chip.label}
                      </span>
                      <X className="h-3 w-3 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Sheet open={isMobile && showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>고급 필터</SheetTitle>
              <SheetDescription>
                상담상태, 담당자, 배정일 등 세부 조건을 설정합니다.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3 pb-6">{advancedFilterFields}</div>
            <div className="flex gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                onClick={clearFilters}
              >
                필터 초기화
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1"
                onClick={() => setShowFilters(false)}
              >
                적용
              </Button>
            </div>
          </SheetContent>
        </Sheet>

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
                    title={
                      hasActiveFilters
                        ? "현재 필터에 맞는 고객이 없습니다."
                        : "표시할 고객이 없습니다."
                    }
                    description={
                      hasActiveFilters
                        ? "필터를 초기화해 다시 확인해 보세요."
                        : "권한 범위 안에서 확인할 수 있는 고객이 없습니다."
                    }
                    className="border-0 bg-transparent py-8"
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        {hasActiveFilters ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-12 md:min-h-8"
                            onClick={clearFilters}
                          >
                            필터 초기화
                          </Button>
                        ) : null}
                        {canCreateCustomer ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-12 md:min-h-8"
                            onClick={() => setShowCreate(true)}
                          >
                            신규 고객 등록
                          </Button>
                        ) : null}
                      </div>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                {workspaceCustomers.map(c => {
                  const recommendation = recommendationByCustomerId.get(c.id);
                  const badges = executionBadges(c, recommendation);
                  const execution = buildListExecution(c, recommendation);
                  return (
                    <Card
                      key={c.id}
                      className="cursor-pointer overflow-hidden border-border bg-card shadow-sm transition hover:bg-muted/30 active:bg-muted/45"
                      onClick={() => setLocation(`/customers/${c.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          {(canReclaimCustomer || canBulkChangeAssignee) && (
                            <Checkbox
                              checked={selectedCustomerIds.includes(c.id)}
                              disabled={!selectableFilteredIds.includes(c.id)}
                              onClick={e => e.stopPropagation()}
                              onCheckedChange={checked =>
                                toggleCustomerSelection(c.id, checked === true)
                              }
                              aria-label={`${c.name} 고객 선택`}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="min-w-0 truncate text-base font-semibold text-foreground">
                                {c.name}
                              </span>
                              <StatusBadge status={c.consultStatus} />
                              {(c as any).priority && (
                                <PriorityBadge priority={(c as any).priority} />
                              )}
                              {relationFlags?.[c.id] ? (
                                <ExecutionBadge label="연결" />
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              다음:{" "}
                              {(c as any).nextAction ||
                                execution.actionTitle ||
                                "확인 필요"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              담당{" "}
                              {formatUserWithRole(
                                agentById.get(c.agentId ?? 0)
                              )}
                              {recommendation?.warnings?.[0]
                                ? ` · ${recommendation.warnings[0].message}`
                                : ""}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {badges.slice(0, 2).map(badge => (
                                <ExecutionBadge
                                  key={badge.label}
                                  label={badge.label}
                                  urgency={badge.urgency}
                                />
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {c.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {maskPhone(c.phone)}
                                </span>
                              )}
                              {c.region && <span>{c.region}</span>}
                              {c.expectedPremium != null && (
                                <span className="font-semibold text-foreground">
                                  {formatExpectedPremiumManwon(c.expectedPremium)}
                                </span>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-12 min-h-12 w-12 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={e => e.stopPropagation()}
                                aria-label="고객 작업 메뉴"
                              >
                                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44"
                              onClick={e => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onClick={() =>
                                  setLocation(`/customers/${c.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" /> 상세 보기
                              </DropdownMenuItem>
                              {c.phone ? (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`tel:${c.phone}`}
                                    className="flex items-center"
                                  >
                                    <Phone className="mr-2 h-4 w-4" /> 전화 걸기
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onClick={() =>
                                  setLocation(
                                    `/customers/${c.id}?action=consult`
                                  )
                                }
                              >
                                상담기록 / 메모
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setSelectedQuickConsultCustomer(c)
                                }
                                className="text-blue-600 font-medium"
                              >
                                <Zap className="mr-2 h-4 w-4" /> 퀵 상담 기록
                              </DropdownMenuItem>
                              {isCustomerReclaimable(c) && (
                                <DropdownMenuItem
                                  onClick={e =>
                                    handleOpenReclaimCustomer(c.id, e as any)
                                  }
                                >
                                  <Undo2 className="mr-2 h-4 w-4" /> DB 회수
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div
                          className="mt-3 flex gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          {c.phone ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-12 flex-1 rounded-lg px-3 text-xs"
                              asChild
                            >
                              <a
                                href={`tel:${c.phone}`}
                                aria-label={`${c.name} 전화`}
                              >
                                <Phone className="mr-1 h-3.5 w-3.5" /> 전화
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() =>
                              setLocation(`/customers/${c.id}?action=consult`)
                            }
                            className="min-h-12 flex-1 rounded-lg px-3 text-xs"
                          >
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            상담 기록
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          <CustomerListDesktopWorkspace
            customers={workspaceCustomers}
            recommendationByCustomerId={recommendationByCustomerId}
            agentById={agentById}
            isLoading={isCustomersLoading}
            isError={isCustomersError}
            hasActiveFilters={hasActiveFilters}
            canCreateCustomer={canCreateCustomer}
            canDeactivateCustomer={canDeactivateCustomer}
            canReclaimCustomer={canReclaimCustomer}
            canBulkChangeAssignee={canBulkChangeAssignee}
            selectableFilteredIds={selectableFilteredIds}
            selectedCustomerIds={selectedCustomerIds}
            allVisibleSelectableSelected={allVisibleSelectableSelected}
            onRetry={() => void refetch()}
            onClearFilters={clearFilters}
            onCreateCustomer={() => setShowCreate(true)}
            onNavigate={setLocation}
            onToggleAllVisibleSelectable={handleToggleAllVisibleSelectable}
            onToggleCustomerSelection={toggleCustomerSelection}
            onOpenReclaimCustomer={handleOpenReclaimCustomer}
            onDeactivateCustomer={handleDeactivateCustomer}
            onQuickConsult={setSelectedQuickConsultCustomer}
            isCustomerReclaimable={isCustomerReclaimable}
            relationFlags={relationFlags}
          />
        )}
      </div>

      {hasBulkSelection &&
        (canBulkChangeAssignee || canReclaimCustomer) && (
          <div className="fixed inset-x-0 bottom-[68px] md:bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  선택한 고객 {selectedCustomerIds.length}명
                </p>
                <p className="text-xs text-muted-foreground">
                  {canBulkChangeAssignee && selectedAssignableIds.length > 0
                    ? `담당자 재지정 가능 ${selectedAssignableIds.length}명`
                    : ""}
                  {canReclaimCustomer && selectedReclaimableIds.length > 0
                    ? `${canBulkChangeAssignee && selectedAssignableIds.length > 0 ? " · " : ""}DB 회수 가능 ${selectedReclaimableIds.length}명`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(canReclaimCustomer || canBulkChangeAssignee) && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={() => handleToggleAllVisibleSelectable(true)}
                      disabled={
                        selectableFilteredIds.length === 0 ||
                        allVisibleSelectableSelected
                      }
                    >
                      전체 선택
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={() => setSelectedCustomerIds([])}
                    >
                      선택 해제
                    </Button>
                  </>
                )}
                {canBulkChangeAssignee && selectedAssignableIds.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    onClick={() => {
                      setBulkAssigneeOpen(true);
                      setBulkAssigneeId("");
                      setBulkAssigneeReason("");
                    }}
                  >
                    <UserCog className="mr-1 h-4 w-4" />
                    담당자 재지정 {selectedAssignableIds.length}
                  </Button>
                )}
                {canReclaimCustomer && selectedReclaimableIds.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    onClick={() => {
                      setReclaimCustomerId(null);
                      setBulkReclaimOpen(true);
                      setReclaimReason("");
                    }}
                  >
                    <Undo2 className="mr-1 h-4 w-4" />
                    DB 회수 {selectedReclaimableIds.length}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

      {/* 고객 등록 모달 */}
      <CreateCustomerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={data => createMutation.mutate(data)}
        loading={createMutation.isPending}
        currentUser={user}
        agents={agents}
      />

      <Dialog
        open={deleteCustomerId !== null}
        onOpenChange={open => {
          if (!open) setDeleteCustomerId(null);
        }}
      >
        <DialogContent className="flex max-h-[min(85dvh,38rem)] max-w-md flex-col overflow-hidden rounded-2xl border-destructive/20 p-0">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> 고객 삭제 확인
            </DialogTitle>
            <DialogDescription>
              {deleteTargetCustomer
                ? `${deleteTargetCustomer.name} 고객을 비활성 처리합니다.`
                : "선택한 고객을 비활성 처리합니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
            <div className={cn("rounded-xl border p-3 text-sm", adminPanel.danger)}>
              완전 삭제가 아니며 활성 계약이나 진행 중 일정이 있으면 삭제할 수
              없습니다. 이 작업은 활동 로그에 기록됩니다.
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteCustomerId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteCustomerId || deactivateMutation.isPending}
              onClick={() =>
                deleteCustomerId &&
                deactivateMutation.mutate({ id: deleteCustomerId })
              }
            >
              고객 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkAssigneeOpen}
        onOpenChange={open => {
          setBulkAssigneeOpen(open);
          if (!open) {
            setBulkAssigneeId("");
            setBulkAssigneeReason("");
            setBulkAssigneeConfirmOpen(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[min(85dvh,42rem)] max-w-lg flex-col overflow-hidden rounded-2xl border-emerald-100 p-0">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <UserCog className="h-5 w-5" /> {WORKFLOW_COPY.reassignment.title}
            </DialogTitle>
            <DialogDescription>
              {WORKFLOW_COPY.reassignment.description}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className={cn("rounded-xl border p-3", adminPanel.neutral)}>
                <p className="text-xs text-muted-foreground">선택 고객</p>
                <p className="mt-1 text-lg font-bold">
                  {selectedCustomerIds.length}
                </p>
              </div>
              <div className={cn("rounded-xl border p-3", adminPanel.success)}>
                <p className="text-xs">변경 가능</p>
                <p className="mt-1 text-lg font-bold">
                  {selectedAssignableIds.length}
                </p>
              </div>
              <div className={cn("rounded-xl border p-3", adminPanel.warning)}>
                <p className="text-xs">제외 예상</p>
                <p className="mt-1 text-lg font-bold">
                  {Math.max(
                    0,
                    selectedCustomerIds.length - selectedAssignableIds.length
                  )}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-xs",
                adminPanel.neutral
              )}
            >
              삭제/비활성 고객, 권한 범위 밖 고객, 이미 같은 담당자인 고객은
              변경 대상에서 제외됩니다.
            </div>
            <div>
              <Label className="text-xs">새 담당자 *</Label>
              <Select value={bulkAssigneeId} onValueChange={setBulkAssigneeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="새 담당자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {bulkAssignableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      선택 가능한 담당자가 없습니다
                    </SelectItem>
                  ) : (
                    bulkAssignableUsers.map(agent => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {formatUserWithRole(agent)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedBulkAssignee && (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  총 {selectedCustomerIds.length}명의 고객 중{" "}
                  {selectedAssignableIds.length}명의 담당자를{" "}
                  {formatUserWithRole(selectedBulkAssignee)}(으)로 변경합니다.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">변경 사유</Label>
              <Textarea
                value={bulkAssigneeReason}
                onChange={e => setBulkAssigneeReason(e.target.value)}
                className="mt-1 min-h-[80px]"
                maxLength={300}
                placeholder="예: 담당자 업무 조정, 지점 운영 배분, 산하 조직 재정리"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {bulkAssigneeReason.length}/300
              </p>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setBulkAssigneeOpen(false);
                setBulkAssigneeId("");
                setBulkAssigneeReason("");
              }}
              disabled={isBulkChangingAssignee}
            >
              취소
            </Button>
            <Button
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={
                !bulkAssigneeId ||
                selectedAssignableIds.length === 0 ||
                isBulkChangingAssignee
              }
              onClick={handleOpenBulkAssigneeConfirm}
            >
              재지정 검토
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkAssigneeConfirmOpen}
        onOpenChange={open => {
          setBulkAssigneeConfirmOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[min(85dvh,42rem)] max-w-lg flex-col overflow-hidden rounded-2xl border-emerald-100 p-0">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <UserCog className="h-5 w-5" /> {WORKFLOW_COPY.reassignment.confirmTitle}
            </DialogTitle>
            <DialogDescription>
              {WORKFLOW_COPY.reassignment.confirmDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            <div className={cn("space-y-2 rounded-xl border p-3 text-sm", adminPanel.neutral)}>
              <p>
                고객 수:{" "}
                <span className="font-semibold">
                  {selectedAssignableIds.length}건
                </span>
              </p>
              <p>
                현재 담당자:{" "}
                <span className="font-semibold">
                  {reassignmentCurrentAssigneeSummary}
                </span>
              </p>
              <p>
                새 담당자:{" "}
                <span className="font-semibold">
                  {selectedBulkAssignee
                    ? formatUserWithRole(selectedBulkAssignee)
                    : "-"}
                </span>
              </p>
              <p>
                변경 후 책임자:{" "}
                <span className="font-semibold">
                  {selectedBulkAssignee
                    ? formatUserWithRole(selectedBulkAssignee)
                    : "-"}
                </span>
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {WORKFLOW_COPY.reassignment.historyNote}{" "}
                {WORKFLOW_COPY.reassignment.accessNote}
              </p>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setBulkAssigneeConfirmOpen(false)}
              disabled={isBulkChangingAssignee}
            >
              {WORKFLOW_COPY.reassignment.cancelButton}
            </Button>
            <Button
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={
                !bulkAssigneeId ||
                selectedAssignableIds.length === 0 ||
                isBulkChangingAssignee
              }
              onClick={handleSubmitBulkAssignee}
            >
              {isBulkChangingAssignee
                ? "처리 중..."
                : WORKFLOW_COPY.reassignment.confirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reclaimDialogOpen}
        onOpenChange={open => {
          if (!open) closeReclaimDialog();
        }}
      >
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
            <div className={cn("rounded-xl border px-3 py-2 text-xs", adminPanel.warning)}>
              고객, 상담기록, 계약, 후속관리, 일정은 삭제하지 않습니다. 담당자
              배정만 해제되며 회수 기록은 배정이력과 활동 로그에 남습니다.
            </div>
            <div>
              <Label className="text-xs">회수 사유 *</Label>
              <Textarea
                value={reclaimReason}
                onChange={e => setReclaimReason(e.target.value)}
                className="mt-1 min-h-[96px]"
                maxLength={300}
                placeholder="예: 담당자 퇴사/휴직, 지점장 재분배 검토, 미배정 풀 재정리"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {reclaimReason.length}/300
              </p>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:justify-end">
            <Button
              variant="outline"
              onClick={closeReclaimDialog}
              disabled={isReclaiming}
            >
              취소
            </Button>
            <Button
              className="bg-amber-700 text-white hover:bg-amber-800"
              disabled={
                !reclaimReason.trim() ||
                isReclaiming ||
                (reclaimCustomerId === null &&
                  selectedReclaimableIds.length === 0)
              }
              onClick={handleSubmitReclaim}
            >
              {isReclaiming ? "회수 중..." : "DB 회수"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedQuickConsultCustomer && (
        <QuickConsultationModal
          open={!!selectedQuickConsultCustomer}
          onOpenChange={open => !open && setSelectedQuickConsultCustomer(null)}
          customerId={selectedQuickConsultCustomer.id}
          customerName={selectedQuickConsultCustomer.name}
          currentStatus={selectedQuickConsultCustomer.consultStatus}
          currentNextAction={
            selectedQuickConsultCustomer.nextAction || undefined
          }
          onSuccess={() => refetch()}
        />
      )}

      <FollowupQuickCreateDialog
        open={showFollowUpQuickModal}
        onClose={() => setShowFollowUpQuickModal(false)}
        onSubmit={data => {
          setFollowUpCustomerId(data.customerId);
          createFollowUpMutation.mutate(data);
        }}
        onOpenDetailed={openDetailedFollowUp}
        loading={createFollowUpMutation.isPending}
      />

      <FollowUpModal
        open={showFollowUpModal}
        onClose={() => {
          setShowFollowUpModal(false);
          setFollowUpDetailedSeed(null);
          setFollowUpCustomerId(null);
        }}
        seed={followUpDetailedSeed ?? undefined}
        onSubmit={data =>
          followUpCustomerId &&
          createFollowUpMutation.mutate({
            customerId: followUpCustomerId,
            ...data,
          })
        }
        loading={createFollowUpMutation.isPending}
      />
    </DashboardLayout>
  );
}

function CreateCustomerModal({
  open,
  onClose,
  onSubmit,
  loading,
  currentUser,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  currentUser: any;
  agents: any[];
}) {
  const { data: regionOptions } = trpc.settings.formOptions.useQuery({
    category: "region",
  });
  const { data: sourceOptions } = trpc.settings.formOptions.useQuery({
    category: "source",
  });
  const { data: consultStatusOptions } = trpc.settings.formOptions.useQuery({
    category: "consultStatus",
  });
  const regions = regionOptions?.map(item => item.value).filter(Boolean) ?? [];
  const sources = sourceOptions?.map(item => item.value).filter(Boolean) ?? [];
  const consultStatuses = consultStatusOptions?.length
    ? consultStatusOptions.map(item => item.value)
    : ["미상담"];
  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthDate: "",
    gender: "" as "male" | "female" | "other" | "",
    region: "",
    expectedPremium: "",
    availableTime: "",
    source: "",
    dbCompany: "",
    consultStatus: "미상담",
    privacyConsent: false,
    marketingConsent: false,
    memo: "",
    agentId: "self",
  });
  const canSelectAgent = currentUser?.role === "branch_admin";
  const selectableAgents = agents.filter(agent =>
    ["branch_admin", "sub_branch_admin", "team_leader", "member"].includes(
      agent.role
    )
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSubmit({
      name: form.name,
      phone: form.phone || undefined,
      birthDate: form.birthDate || undefined,
      gender: (form.gender as any) || undefined,
      region: form.region || undefined,
      expectedPremium: form.expectedPremium
        ? expectedPremiumStoredWonFromManwonInput(form.expectedPremium)
        : undefined,
      availableTime: form.availableTime || undefined,
      source: form.source || undefined,
      dbCompany: form.dbCompany || undefined,
      consultStatus: form.consultStatus || undefined,
      privacyConsent: form.privacyConsent,
      marketingConsent: form.marketingConsent,
      memo: form.memo || undefined,
      ...(canSelectAgent && form.agentId !== "self"
        ? { agentId: Number(form.agentId) }
        : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>고객 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">이름 *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-8 mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs">연락처</Label>
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="h-8 mt-1"
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <Label className="text-xs">생년월일</Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={e => setForm({ ...form, birthDate: e.target.value })}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">성별</Label>
              <Select
                value={form.gender || "none"}
                onValueChange={v =>
                  setForm({ ...form, gender: v === "none" ? "" : (v as any) })
                }
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안함</SelectItem>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">지역</Label>
              <Input
                list="customer-region-options"
                value={form.region}
                onChange={e => setForm({ ...form, region: e.target.value })}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">예상보험료 (만원)</Label>
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                value={form.expectedPremium}
                onChange={e =>
                  setForm({ ...form, expectedPremium: e.target.value })
                }
                className="h-8 mt-1"
                placeholder="예: 50"
              />
            </div>
            <div>
              <Label className="text-xs">통화가능시간</Label>
              <Input
                value={form.availableTime}
                onChange={e =>
                  setForm({ ...form, availableTime: e.target.value })
                }
                className="h-8 mt-1"
                placeholder="예: 오후 2~5시"
              />
            </div>
            <div>
              <Label className="text-xs">유입경로</Label>
              <Input
                list="customer-source-options"
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value })}
                className="h-8 mt-1"
                placeholder="예: 지인소개, SNS"
              />
            </div>
            <div>
              <Label className="text-xs">DB 업체명</Label>
              <Input
                value={form.dbCompany}
                onChange={e => setForm({ ...form, dbCompany: e.target.value })}
                className="h-8 mt-1"
                placeholder="예: 렌선, 실버"
              />
            </div>
            <div>
              <Label className="text-xs">상담상태</Label>
              <Select
                value={form.consultStatus}
                onValueChange={v => setForm({ ...form, consultStatus: v })}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {consultStatuses.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canSelectAgent && (
              <div>
                <Label className="text-xs">담당자</Label>
                <Select
                  value={form.agentId}
                  onValueChange={v => setForm({ ...form, agentId: v })}
                >
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue placeholder="담당자 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">내 고객으로 등록</SelectItem>
                    {selectableAgents.map(agent => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {formatUserWithRole(agent)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {!canSelectAgent && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              고객 등록 시 담당자는 본인으로 자동 배정됩니다. 타인 배정은 기존
              DB 배정 메뉴에서 권한에 따라 처리됩니다.
            </div>
          )}
          <datalist id="customer-region-options">
            {regions.map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="customer-source-options">
            {sources.map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <div>
            <Label className="text-xs">메모</Label>
            <textarea
              value={form.memo}
              onChange={e => setForm({ ...form, memo: e.target.value })}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
            />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.privacyConsent}
                onChange={e =>
                  setForm({ ...form, privacyConsent: e.target.checked })
                }
              />
              개인정보 동의
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={e =>
                  setForm({ ...form, marketingConsent: e.target.checked })
                }
              />
              마케팅 수신 동의
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "등록 중..." : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
