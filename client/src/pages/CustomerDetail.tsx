import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, CONSULT_STATUSES, getPriorityLabel, PriorityBadge } from "@/components/StatusBadge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState, ForbiddenInlineState } from "@/components/ui/empty-state";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole, getRoleLabel } from "@/lib/userRole";
import {
  getCustomerTimelineEventLabel,
  getCustomerTimelineSummary,
  shouldHideTimelineEvent,
} from "@/lib/customerTimelineLabels";
import {
  expectedPremiumManwonFormStringFromStoredWon,
  expectedPremiumStoredWonFromManwonInput,
  formatExpectedPremiumManwon,
} from "@shared/expectedPremium";
import FollowupQuickCreateDialog from "@/components/followups/FollowupQuickCreateDialog";
import FollowUpModal from "@/components/followups/FollowUpModal";
import { CustomerRelationshipsPanel } from "@/components/customers/CustomerRelationshipsPanel";
import { CustomerReferralFlowsPanel } from "@/components/referrals/CustomerReferralFlowsPanel";
import { CustomerClaimGuidancePanel } from "@/components/claimGuidance/CustomerClaimGuidancePanel";
import { CustomerRetentionRiskPanel } from "@/components/retentionRisk/CustomerRetentionRiskPanel";
import { SmartConsultationPrepCard } from "@/components/customer/SmartConsultationPrepCard";
import { buildCustomerExecutionScore } from "@shared/customerExecution";
import type { DetailedFollowUpSeed } from "@shared/followupQuickCreate";
import {
  AlertTriangle,
  ArrowLeft,
  Phone,
  Plus,
  UserCog,
  Edit2,
  Trash2,
  History,
  Copy,
  CalendarPlus,
  MessageSquare,
  FilePlus2,
  MoreHorizontal,
  Undo2,
  ChevronDown,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QuickConsultationModal } from "@/components/consultations/QuickConsultationModal";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  formatKstLocalDateTime,
  getKstLocalDateTimeAfter,
} from "@shared/timePolicy";

const followUpStatusLabels: Record<string, string> = {
  scheduled: "예정",
  postponed: "연기",
  completed: "완료",
  cancelled: "취소",
};

const contactUrgencyLabels: Record<string, string> = {
  high: "긴급",
  medium: "주의",
  low: "보통",
};

const CUSTOMER_PRIORITIES = ["A", "B", "C", "D", "unclassified"] as const;
const CONSULTATION_TYPES = [
  "전화",
  "카톡",
  "문자",
  "방문",
  "소개",
  "보장분석",
  "계약상담",
  "사후관리",
  "기타",
] as const;
const CUSTOMER_NEEDS = [
  "보험료 부담",
  "보장 불안",
  "가족 보장",
  "실손/의료비",
  "암/뇌/심장 보장",
  "운전자보험",
  "해지 고민",
  "리밸런싱",
  "자녀 보장",
  "노후/간병",
  "기타",
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
const linkedScheduleReminderOptions = [
  { value: "-1", label: "알림 없음" },
  { value: "0", label: "시작 시각" },
  { value: "30", label: "30분 전" },
  { value: "60", label: "1시간 전" },
  { value: "120", label: "2시간 전" },
  { value: "1440", label: "하루 전" },
] as const;

const TIMELINE_FILTERS = [
  { value: "all", label: "전체", eventTypes: [] },
  {
    value: "consult",
    label: "상담",
    eventTypes: [
      "consultations",
      "consultation_created",
      "consultation_updated",
    ],
  },
  {
    value: "contract",
    label: "계약",
    eventTypes: [
      "contracts",
      "contract_history",
      "contract_created",
      "contract_updated",
      "contract_deleted",
    ],
  },
  {
    value: "follow_up",
    label: "후속관리",
    eventTypes: [
      "follow_ups",
      "follow_up_created",
      "follow_up_completed",
      "follow_up_cancelled",
    ],
  },
  {
    value: "notification",
    label: "알림",
    eventTypes: [
      "notifications",
      "notification_created",
      "notification_status_changed",
    ],
  },
  {
    value: "assignment",
    label: "배정",
    eventTypes: ["assignment_history", "assignment_changed"],
  },
  {
    value: "delete",
    label: "삭제/복구",
    eventTypes: [
      "delete_requests",
      "delete_request_created",
      "delete_request_approved",
      "delete_request_rejected",
      "contract_deleted",
    ],
  },
  { value: "audit", label: "운영로그", eventTypes: ["activity_logs"] },
] as const;

function parseCustomerTags(value?: string | null): string[] {
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

function formatDate(value?: string | Date | null) {
  return value
    ? formatKstLocalDateTime(value, { seconds: false }).slice(0, 10)
    : "-";
}

function daysSince(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export default function CustomerDetail({ id }: { id: number }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [showQuickConsultModal, setShowQuickConsultModal] = useState(false);
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showChangeAgentModal, setShowChangeAgentModal] = useState(false);
  const [selectedNewAgentId, setSelectedNewAgentId] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConsultId, setEditingConsultId] = useState<number | null>(null);
  const [editingContractId, setEditingContractId] = useState<number | null>(
    null
  );
  const [deleteContractId, setDeleteContractId] = useState<number | null>(null);
  const [requestContractId, setRequestContractId] = useState<number | null>(
    null
  );
  const [requestReason, setRequestReason] = useState("");
  const [requestMemo, setRequestMemo] = useState("");
  const [showFollowUpQuickModal, setShowFollowUpQuickModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDetailedSeed, setFollowUpDetailedSeed] =
    useState<DetailedFollowUpSeed | null>(null);
  const [postponeFollowUpId, setPostponeFollowUpId] = useState<number | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("consult");
  const isMobile = useIsMobile();
  const [timelineFilter, setTimelineFilter] =
    useState<(typeof TIMELINE_FILTERS)[number]["value"]>("all");
  const [timelineRange, setTimelineRange] = useState<"all" | "30" | "90">(
    "all"
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [messageNextContactDate, setMessageNextContactDate] = useState("");
  const [messageTopic, setMessageTopic] = useState("");
  const [handoffNoteTitle, setHandoffNoteTitle] = useState("");
  const [handoffNoteType, setHandoffNoteType] = useState<
    | "handoff"
    | "caution"
    | "approach"
    | "avoid"
    | "relationship"
    | "next_action"
  >("handoff");
  const [handoffNoteBody, setHandoffNoteBody] = useState("");
  const [showHandoffNoteModal, setShowHandoffNoteModal] = useState(false);
  const [showCustomerDeleteDialog, setShowCustomerDeleteDialog] =
    useState(false);
  const [showReclaimDialog, setShowReclaimDialog] = useState(false);
  const [reclaimReason, setReclaimReason] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");

  useEffect(() => {
    const query = location.split("?")[1]?.split("#")[0];
    if (!query) return;

    const action = new URLSearchParams(query).get("action");
    if (action === "consult") setShowConsultModal(true);
    if (action === "followup" || action === "quick-followup") {
      setShowFollowUpQuickModal(true);
    }
    if (action === "contract") setShowContractModal(true);
    if (action === "message") setActiveTab("tools");
  }, [location]);

  const utils = trpc.useUtils();
  const {
    data: customer,
    refetch: refetchCustomer,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
  } = trpc.customers.get.useQuery({ id });
  const { data: consultations, refetch: refetchConsult } =
    trpc.consultations.list.useQuery({ customerId: id });
  const { data: contracts, refetch: refetchContracts } =
    trpc.contracts.listByCustomer.useQuery({ customerId: id });
  const { data: statusHistoryData } = trpc.customers.statusHistory.useQuery({
    customerId: id,
  });
  const { data: consentLogsData } = trpc.customers.consentLogs.useQuery({
    customerId: id,
  });
  const { data: assignmentHistoryData } =
    trpc.customers.assignmentHistory.useQuery({ customerId: id });
  const { data: followUps, refetch: refetchFollowUps } =
    trpc.followUps.listByCustomer.useQuery({ customerId: id });
  const { data: customerRelationships } =
    trpc.customerRelationships.list.useQuery({ customerId: id });
  const { data: customerReferrals } =
    trpc.customerReferrals.listByCustomer.useQuery({ customerId: id });
  const { data: claimGuidanceCases } =
    trpc.claimGuidance.listByCustomer.useQuery({ customerId: id });
  const { data: retentionRiskCases } =
    trpc.retentionRisk.listByCustomer.useQuery({ customerId: id });
  const { data: users } = trpc.users.list.useQuery();
  const { data: consultationTools } =
    trpc.consultationTools.listCustomerChecks.useQuery({ customerId: id });
  const { data: messageTemplates } =
    trpc.consultationTools.listMessageTemplates.useQuery({});
  const { data: handoffNotes } =
    trpc.customerHandoffNotes.listByCustomer.useQuery({ customerId: id });
  const { data: consultationScripts } = trpc.consultationScripts.list.useQuery(
    {}
  );
  const renderedMessageInput = {
    templateId: selectedTemplateId ? Number(selectedTemplateId) : 0,
    customerId: id,
    nextContactDate: messageNextContactDate || undefined,
    consultationTopic: messageTopic || undefined,
  };
  const { data: renderedMessage } =
    trpc.consultationTools.renderMessageTemplate.useQuery(
      renderedMessageInput,
      {
        enabled: Boolean(selectedTemplateId),
      }
    );
  const { data: contactReasons } =
    trpc.recommendations.customerContactReasons.useQuery({ customerId: id });
  const timelineInput = useMemo(() => {
    const selected = TIMELINE_FILTERS.find(
      filter => filter.value === timelineFilter
    );
    const since =
      timelineRange === "all"
        ? undefined
        : new Date(
            Date.now() - Number(timelineRange) * 24 * 60 * 60 * 1000
          ).toISOString();
    return {
      customerId: id,
      eventTypes: selected?.eventTypes.length
        ? [...selected.eventTypes]
        : undefined,
      dateFrom: since,
      limit: 80,
    };
  }, [id, timelineFilter, timelineRange]);
  const { data: timelineData } =
    trpc.customers.timeline.useQuery(timelineInput);

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success("고객 정보가 수정되었습니다.");
      setShowEditModal(false);
      refetchCustomer();
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const updateMetaMutation = trpc.customers.updateManagementMeta.useMutation({
    onSuccess: () => {
      toast.success("고객 관리 정보가 저장되었습니다.");
      refetchCustomer();
      utils.customers.list.invalidate();
    },
    onError: err =>
      toast.error(err.message || "고객 관리 정보 저장에 실패했습니다."),
  });

  const createConsultMutation = trpc.consultations.create.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(
        variables.calendarSchedule
          ? "상담기록과 캘린더 일정이 저장되었습니다."
          : "상담기록이 저장되었습니다."
      );
      setShowConsultModal(false);
      refetchConsult();
      refetchCustomer();
      if (variables.calendarSchedule) {
        utils.schedules.list.invalidate();
        utils.dashboard.todayWork.invalidate();
      }
    },
  });

  const updateConsultMutation = trpc.consultations.update.useMutation({
    onSuccess: () => {
      toast.success("상담기록이 수정되었습니다.");
      setEditingConsultId(null);
      refetchConsult();
      refetchCustomer();
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const createContractMutation = trpc.contracts.create.useMutation({
    onSuccess: () => {
      toast.success("계약이 등록되었습니다.");
      setShowContractModal(false);
      refetchContracts();
    },
  });

  const updateContractMutation = trpc.contracts.update.useMutation({
    onSuccess: () => {
      toast.success("계약이 수정되었습니다.");
      setEditingContractId(null);
      refetchContracts();
    },
    onError: () => toast.error("계약 수정에 실패했습니다."),
  });

  const deactivateContractMutation = trpc.contracts.deactivate.useMutation({
    onSuccess: () => {
      toast.success("계약이 삭제(비활성 처리)되었습니다.");
      setDeleteContractId(null);
      refetchContracts();
    },
    onError: err => toast.error(err.message || "계약 삭제에 실패했습니다."),
  });

  const requestDeleteMutation =
    trpc.deleteRequests.createContractDeleteRequest.useMutation({
      onSuccess: () => {
        toast.success("삭제 요청이 관리자에게 전달되었습니다.");
        setRequestContractId(null);
        setRequestReason("");
        setRequestMemo("");
        refetchContracts();
        utils.deleteRequests.listMyRequests.invalidate();
      },
      onError: err => toast.error(err.message || "삭제 요청에 실패했습니다."),
    });

  const changeAgentMutation = trpc.customers.changeAgent.useMutation({
    onSuccess: () => {
      toast.success("담당자가 변경되었습니다.");
      setSelectedNewAgentId("");
      setShowChangeAgentModal(false);
      refetchCustomer();
    },
    onError: err => toast.error(err.message || "담당자 변경에 실패했습니다."),
  });

  const reclaimMutation = trpc.customers.reclaim.useMutation({
    onSuccess: () => {
      toast.success("고객 DB를 미배정 상태로 회수했습니다.");
      setShowReclaimDialog(false);
      setReclaimReason("");
      refetchCustomer();
      utils.customers.list.invalidate();
      utils.customers.assignmentHistory.invalidate({ customerId: id });
      utils.customers.timeline.invalidate({ customerId: id });
    },
    onError: err => toast.error(err.message || "DB 회수에 실패했습니다."),
  });

  const deactivateMutation = trpc.customers.deactivate.useMutation({
    onSuccess: () => {
      toast.success("고객이 비활성화되었습니다.");
      setLocation("/customers");
    },
    onError: () => toast.error("비활성화에 실패했습니다."),
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
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
      utils.followUps.listToday.invalidate();
      utils.followUps.listOverdue.invalidate();
      if (variables.calendarSchedule) utils.schedules.list.invalidate();
    },
    onError: err =>
      toast.error(err.message || "후속관리 등록에 실패했습니다."),
  });

  const openDetailedFollowUp = (
    seed: DetailedFollowUpSeed,
    _customerId: number
  ) => {
    setFollowUpDetailedSeed(seed);
    setShowFollowUpQuickModal(false);
    setShowFollowUpModal(true);
  };

  const completeFollowUpMutation = trpc.followUps.complete.useMutation({
    onSuccess: () => {
      toast.success("후속관리가 완료 처리되었습니다.");
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
    },
    onError: err =>
      toast.error(err.message || "후속관리 완료 처리에 실패했습니다."),
  });

  const postponeFollowUpMutation = trpc.followUps.postpone.useMutation({
    onSuccess: () => {
      toast.success("연락일이 연기되었습니다.");
      setPostponeFollowUpId(null);
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
    },
    onError: err => toast.error(err.message || "연락일 연기에 실패했습니다."),
  });

  const cancelFollowUpMutation = trpc.followUps.cancel.useMutation({
    onSuccess: () => {
      toast.success("후속관리가 취소되었습니다.");
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
    },
    onError: err => toast.error(err.message || "후속관리 취소에 실패했습니다."),
  });

  const updateChecklistResultMutation =
    trpc.consultationTools.updateCheckResult.useMutation({
      onSuccess: () => {
        utils.consultationTools.listCustomerChecks.invalidate({
          customerId: id,
        });
        toast.success("체크리스트가 저장되었습니다.");
      },
      onError: err =>
        toast.error(err.message || "체크리스트 저장에 실패했습니다."),
    });

  const logMessageCopyMutation =
    trpc.consultationTools.logMessageCopy.useMutation({
      onSuccess: () => toast.success("문구 복사 이력을 기록했습니다."),
      onError: err =>
        toast.error(err.message || "문구 복사 이력 기록에 실패했습니다."),
    });

  const createHandoffNoteMutation =
    trpc.customerHandoffNotes.create.useMutation({
      onSuccess: () => {
        toast.success("인수인계 메모를 추가했습니다.");
        setHandoffNoteTitle("");
        setHandoffNoteBody("");
        setShowHandoffNoteModal(false);
        utils.customerHandoffNotes.listByCustomer.invalidate({
          customerId: id,
        });
      },
      onError: err =>
        toast.error(err.message || "인수인계 메모 저장에 실패했습니다."),
    });

  const updateHandoffNoteMutation =
    trpc.customerHandoffNotes.update.useMutation({
      onSuccess: () => {
        toast.success("인수인계 메모를 변경했습니다.");
        utils.customerHandoffNotes.listByCustomer.invalidate({
          customerId: id,
        });
      },
      onError: err =>
        toast.error(err.message || "인수인계 메모 변경에 실패했습니다."),
    });

  const logScriptCopyMutation = trpc.consultationScripts.logCopy.useMutation({
    onSuccess: () => toast.success("상담 스크립트 복사 이력을 기록했습니다."),
    onError: err =>
      toast.error(
        err.message || "상담 스크립트 복사 이력 기록에 실패했습니다."
      ),
  });

  const checklistTemplates = consultationTools?.templates ?? [];
  const checklistResultsById = new Map(
    (consultationTools?.results ?? []).map(result => [
      result.checklistId,
      result,
    ])
  );
  const checklistPhaseLabels = {
    before: "상담 전",
    during: "상담 중",
    after: "상담 후",
  } as const;
  const selectedTemplate = messageTemplates?.find(
    template => template.id === Number(selectedTemplateId)
  );
  const selectedScript = consultationScripts?.find(
    script => script.id === Number(selectedScriptId)
  );
  const handoffNoteTypeLabels = {
    handoff: "인수인계",
    caution: "주의사항",
    approach: "추천 접근",
    avoid: "피해야 할 말",
    relationship: "관계관리",
    next_action: "다음 액션",
  } as const;

  if (isCustomerLoading)
    return (
      <DashboardLayout>
        <EmptyState
          variant="loading"
          title="고객 정보를 불러오는 중입니다."
          description="상담 이력과 후속관리 정보를 확인하고 있습니다."
          className="min-h-64 border-0 bg-transparent"
        />
      </DashboardLayout>
    );

  if (isCustomerError || !customer)
    return (
      <DashboardLayout>
        <ForbiddenInlineState
          title="고객 정보를 표시할 수 없습니다."
          description="데이터가 없거나 현재 권한으로 접근할 수 없습니다. 고객 정보 존재 여부는 표시하지 않습니다."
          className="min-h-64"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/customers")}
              >
                고객 DB로 이동
              </Button>
              {isCustomerError ? (
                <Button type="button" onClick={() => refetchCustomer()}>
                  다시 시도
                </Button>
              ) : null}
            </div>
          }
        />

        <Dialog
          open={requestContractId !== null}
          onOpenChange={open => {
            if (!open) setRequestContractId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>계약 삭제 요청</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                이 계약의 삭제를 관리자에게 요청합니다. 승인되면 해당 계약은
                비활성 처리되며, 실적 집계에서 제외됩니다.
              </p>
              <div>
                <Label>요청 사유 *</Label>
                <Select value={requestReason} onValueChange={setRequestReason}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="사유 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "중복 입력",
                      "오입력",
                      "계약 취소",
                      "테스트 입력",
                      "기타",
                    ].map(reason => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>상세 메모</Label>
                <Textarea
                  value={requestMemo}
                  onChange={e => setRequestMemo(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRequestContractId(null)}
                >
                  취소
                </Button>
                <Button
                  disabled={!requestReason || requestDeleteMutation.isPending}
                  onClick={() =>
                    requestContractId &&
                    requestDeleteMutation.mutate({
                      contractId: requestContractId,
                      requestReason,
                      requestMemo: requestMemo || undefined,
                    })
                  }
                >
                  삭제 요청 보내기
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );

  const agentName = formatUserWithRole(
    users?.find(u => u.id === customer.agentId)
  );
  const genderLabel =
    customer.gender === "male"
      ? "남성"
      : customer.gender === "female"
        ? "여성"
        : customer.gender
          ? "기타"
          : "-";
  const canChangeAgent =
    user?.role === "branch_admin" || user?.role === "team_leader";
  const canDeactivateCustomer = user?.role === "branch_admin";
  const canReclaimCustomer =
    user?.role === "branch_admin" &&
    customer.isActive !== false &&
    (Boolean(customer.agentId) || customer.assignmentStatus !== "unassigned");
  const canDeactivateContract = user?.role === "branch_admin";
  const canRequestContractDelete =
    user?.role === "sub_branch_admin" ||
    user?.role === "team_leader" ||
    user?.role === "member";
  const canManageRelationships =
    user?.accountStatus === "active" &&
    (user?.role !== "member" || customer.agentId === user.id);
  const editingConsult = consultations?.find(c => c.id === editingConsultId);
  const editingContract = contracts?.find(c => c.id === editingContractId);
  const deleteTargetContract = contracts?.find(c => c.id === deleteContractId);
  const customerTags = parseCustomerTags((customer as any).customerTags);
  const latestConsult = (consultations ?? [])[0] as any;
  const openFollowUps = (followUps ?? []).filter(
    (item: any) => item.status === "scheduled" || item.status === "postponed"
  );
  const nextFollowUp = openFollowUps
    .slice()
    .sort(
      (a: any, b: any) =>
        new Date(a.nextContactDate).getTime() -
        new Date(b.nextContactDate).getTime()
    )[0];
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const dueTodayFollowUpCount = openFollowUps.filter((item: any) => {
    const due = new Date(item.nextContactDate).getTime();
    return due >= todayStart.getTime() && due <= todayEnd.getTime();
  }).length;
  const overdueFollowUpCount = openFollowUps.filter(
    (item: any) => new Date(item.nextContactDate).getTime() < todayStart.getTime()
  ).length;
  const latestConsultDate =
    latestConsult?.consultationDate ??
    latestConsult?.createdAt ??
    latestConsult?.updatedAt;
  const managementStartDate = customer.assignedAt ?? customer.createdAt;
  const daysFromManagementStart = daysSince(managementStartDate);
  const daysFromLatestConsult = daysSince(latestConsultDate);
  const isLongUnmanaged = latestConsultDate
    ? (daysFromLatestConsult ?? 0) >= 90
    : (daysFromManagementStart ?? 0) >= 90;
  const execution = buildCustomerExecutionScore({
    customer,
    recommendation: {
      recommendedAction: contactReasons?.recommendedAction,
      contactReason: contactReasons?.reasons?.[0],
      reasons: contactReasons?.reasons,
      warnings: contactReasons?.warnings,
    },
    latestConsult,
    nextFollowUp: nextFollowUp ?? null,
    hasOpenFollowUp: openFollowUps.length > 0,
    isLongUnmanaged,
  });
  const recommendedAction = {
    title: execution.actionTitle,
    description: execution.actionDescription,
    next: execution.actionNext,
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-[max(5.5rem,env(safe-area-inset-bottom))] md:pb-0">
        {/* Customer execution summary */}
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 shrink-0"
                  onClick={() => setLocation("/customers")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> 목록
                </Button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary/80">
                    고객 상세
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-950">
                      {customer.name}
                    </h1>
                    <StatusBadge status={customer.consultStatus} />
                    <PriorityBadge priority={(customer as any).priority} />
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${execution.gradeClassName}`}
                    >
                      관리점수 {execution.score}
                    </span>
                    {isLongUnmanaged && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        장기 미관리
                      </span>
                    )}
                    {(customer.assignmentStatus === "unassigned" ||
                      (!customer.agentId && !customer.subBranchAdminId)) && (
                      <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        미배정
                      </span>
                    )}
                    {!customer.isActive && (
                      <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        비활성
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">지금 할 일 · </span>
                    {recommendedAction.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>담당 · {agentName}</span>
                    <span>
                      최근 상담 ·{" "}
                      {latestConsultDate
                        ? formatDate(latestConsultDate)
                        : "없음"}
                    </span>
                    <span>
                      다음 연락 ·{" "}
                      {nextFollowUp
                        ? formatDate(nextFollowUp.nextContactDate)
                        : "설정 없음"}
                    </span>
                  </div>
                  {isMobile && (
                    <Collapsible className="mt-3">
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full justify-between"
                        >
                          연락·기본 정보
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 grid gap-2">
                        {[
                          { label: "연락처", value: customer.phone ?? "-" },
                          {
                            label: "생년월일",
                            value: customer.birthDate
                              ? new Date(customer.birthDate).toLocaleDateString(
                                  "ko-KR"
                                )
                              : "-",
                          },
                          {
                            label: "다음 액션",
                            value: (customer as any).nextAction ?? "설정 필요",
                          },
                        ].map(item => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-500">{item.label}</span>
                            <span className="truncate font-semibold text-slate-900">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-fit">
                    <MoreHorizontal className="h-4 w-4 mr-1" /> 더보기
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                    <Edit2 className="h-4 w-4" /> 정보 수정
                  </DropdownMenuItem>
                  {canChangeAgent && (
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedNewAgentId("");
                        setShowChangeAgentModal(true);
                      }}
                    >
                      <UserCog className="h-4 w-4" /> 담당자 변경
                    </DropdownMenuItem>
                  )}
                  {canReclaimCustomer && (
                    <DropdownMenuItem
                      onClick={() => {
                        setReclaimReason("");
                        setShowReclaimDialog(true);
                      }}
                    >
                      <Undo2 className="h-4 w-4" /> DB 회수
                    </DropdownMenuItem>
                  )}
                  {canDeactivateCustomer && customer.isActive && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setShowCustomerDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4" /> 고객 삭제
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isMobile ? (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 w-full justify-between text-muted-foreground"
                  >
                    관리 지표·유입 정보
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: "담당자", value: agentName },
                      {
                        label: "예상보험료",
                        value:
                          customer.expectedPremium != null
                            ? formatExpectedPremiumManwon(customer.expectedPremium)
                            : "-",
                      },
                      {
                        label: "마지막 상담일",
                        value: latestConsultDate
                          ? formatDate(latestConsultDate)
                          : "상담 없음",
                      },
                      {
                        label: "다음 연락일",
                        value: nextFollowUp
                          ? formatDate(nextFollowUp.nextContactDate)
                          : "설정 없음",
                      },
                      { label: "유입경로", value: customer.source ?? "-" },
                      {
                        label: "DB 업체명",
                        value: (customer as any).dbCompany ?? "-",
                      },
                      { label: "지역", value: customer.region ?? "-" },
                    ].map(item => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
                      >
                        <p className="text-[11px] font-medium text-slate-500">
                          {item.label}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                {[
                  { label: "담당자", value: agentName },
                  {
                    label: "예상보험료",
                    value:
                      customer.expectedPremium != null
                        ? formatExpectedPremiumManwon(customer.expectedPremium)
                        : "-",
                  },
                  {
                    label: "마지막 상담일",
                    value: latestConsultDate
                      ? formatDate(latestConsultDate)
                      : "상담 없음",
                  },
                  {
                    label: "다음 연락일",
                    value: nextFollowUp
                      ? formatDate(nextFollowUp.nextContactDate)
                      : "설정 없음",
                  },
                  { label: "유입경로", value: customer.source ?? "-" },
                  {
                    label: "DB 업체명",
                    value: (customer as any).dbCompany ?? "-",
                  },
                  { label: "지역", value: customer.region ?? "-" },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
                  >
                    <p className="text-[11px] font-medium text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-amber-800">
                      지금 할 일
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      판단
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${execution.gradeClassName}`}
                    >
                      {execution.grade}
                    </span>
                  </div>
                  <h2 className="mt-1 text-base font-bold text-slate-950">
                    {recommendedAction.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-700">
                    {recommendedAction.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(execution.reasons.length > 0
                      ? execution.reasons
                      : [{ label: "정기 관리 흐름 유지", points: 0 }]
                    )
                      .slice(0, 5)
                      .map(reason => (
                        <span
                          key={reason.label}
                          className="rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {reason.points > 0
                            ? `${reason.label} +${reason.points}`
                            : reason.label}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-gradient-to-br from-blue-50/70 to-white shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">상담 실행 요약</p>
                <p className="text-xs text-muted-foreground">
                  오늘 확인할 일과 다음 행동을 먼저 보고 바로 실행하세요.
                </p>
              </div>
              <span className="w-fit rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-800">
                다음 행동 · {recommendedAction.next}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] text-slate-500">최근 상담</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {latestConsultDate ? formatDate(latestConsultDate) : "상담 없음"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] text-slate-500">다음 연락일</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {nextFollowUp ? formatDate(nextFollowUp.nextContactDate) : "설정 필요"}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
                <p className="text-[11px] text-amber-700">오늘 확인할 후속</p>
                <p className="mt-0.5 text-sm font-semibold text-amber-900">
                  {dueTodayFollowUpCount}건
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2">
                <p className="text-[11px] text-red-700">지연된 후속관리</p>
                <p className="mt-0.5 text-sm font-semibold text-red-900">
                  {overdueFollowUpCount}건
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowConsultModal(true)}>
                <MessageSquare className="mr-1 h-4 w-4" /> 상담기록 추가
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFollowUpQuickModal(true)}
              >
                <CalendarPlus className="mr-1 h-4 w-4" /> 빠른 후속 등록
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setLocation(`/calendar?customerId=${customer.id}&action=quick-create`)
                }
              >
                <CalendarPlus className="mr-1 h-4 w-4" /> 빠른 일정 등록
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowEditModal(true)}>
                <Edit2 className="mr-1 h-4 w-4" /> 고객 정보 수정
              </Button>
            </div>
          </CardContent>
        </Card>

        <SmartConsultationPrepCard
          isMobile={isMobile}
          customer={{
            consultStatus: customer.consultStatus,
            priority: (customer as any).priority,
            nextAction: (customer as any).nextAction,
          }}
          customerTags={customerTags}
          agentName={agentName}
          latestConsult={latestConsult}
          latestConsultDate={latestConsultDate}
          nextFollowUp={nextFollowUp}
          contactReasons={contactReasons}
          handoffNotes={handoffNotes as any}
          hasOpenRetentionRisk={(retentionRiskCases ?? []).some(
            row =>
              !row.resolvedAt &&
              !["retained", "adjusted", "surrendered", "closed"].includes(
                row.retentionStatus
              )
          )}
          hasOpenClaimGuidance={(claimGuidanceCases ?? []).some(
            row =>
              !row.closedAt &&
              !["completed", "closed", "not_applicable"].includes(
                row.guidanceStatus
              )
          )}
          hasReferralFlows={(customerReferrals ?? []).length > 0}
          hasRelationships={(customerRelationships ?? []).length > 0}
          onConsultRecord={() => setShowConsultModal(true)}
          onFollowUpCreate={() => setShowFollowUpQuickModal(true)}
          onOpenTemplates={() => setActiveTab("tools")}
          onOpenChecklist={() => setActiveTab("tools")}
          onOpenTimeline={() => setActiveTab("timeline")}
          onOpenHandoff={() => setActiveTab("consult")}
          onOpenRelationships={() => setActiveTab("relationships")}
          onOpenReferrals={() => setActiveTab("referrals")}
        />

        <Card className="border-primary/15 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90 md:sticky md:top-[4.6rem] md:z-20">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">
                  바로 실행
                </p>
                <p className="text-[11px] font-medium text-primary/70">
                  행동
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {recommendedAction.next}
                </p>
              </div>
              {nextFollowUp && (
                <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                  다음 연락 {formatDate(nextFollowUp.nextContactDate)}
                </span>
              )}
            </div>
            <div
              className={`space-y-2 md:grid md:grid-cols-6 md:gap-2 md:space-y-0 ${isMobile ? "hidden" : ""}`}
            >
              <div className="grid grid-cols-2 gap-2 md:contents">
                {customer.phone ? (
                  <Button
                    variant="default"
                    className="min-h-12 flex-col justify-center gap-1 bg-blue-600 px-2 text-xs hover:bg-blue-700 md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                    asChild
                  >
                    <a href={`tel:${customer.phone}`}>
                      <Phone className="h-4 w-4" /> 전화하기
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-12 flex-col justify-center gap-1 px-2 text-xs md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                    disabled
                  >
                    <Phone className="h-4 w-4" /> 전화하기
                  </Button>
                )}
                <Button
                  variant="default"
                  className="min-h-12 flex-col justify-center gap-1 px-2 text-xs md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                  onClick={() => setShowConsultModal(true)}
                >
                  <MessageSquare className="h-4 w-4" /> 상담 기록
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-12 flex-col justify-center gap-1 bg-amber-100 px-2 text-xs text-amber-900 hover:bg-amber-200 md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                  onClick={() => setShowFollowUpQuickModal(true)}
                >
                  <CalendarPlus className="h-4 w-4" /> 후속 등록
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:contents">
                <Button
                  variant="outline"
                  className="min-h-12 flex-col justify-center gap-1 px-2 text-xs md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                  onClick={() =>
                    setLocation(
                      `/calendar?customerId=${customer.id}&action=quick-create`
                    )
                  }
                >
                  <CalendarPlus className="h-4 w-4" /> 일정 등록
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-12 flex-col justify-center gap-1 bg-emerald-700 px-2 text-xs text-white hover:bg-emerald-800 md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                  onClick={() => setShowContractModal(true)}
                >
                  <FilePlus2 className="h-4 w-4" /> 계약 등록
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 md:contents md:border-t-0 md:pt-0">
                <Button
                  variant="outline"
                  className="min-h-12 flex-col justify-center gap-1 px-2 text-xs md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                  onClick={() => setShowQuickConsultModal(true)}
                >
                  <Zap className="h-4 w-4" /> 퀵 상담
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-12 flex-col justify-center gap-1 px-2 text-xs md:h-11 md:min-h-11 md:flex-row md:justify-start md:text-sm"
                  onClick={() => setActiveTab("tools")}
                >
                  <Copy className="h-4 w-4" /> 메시지 문구
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Collapsible defaultOpen={!isMobile}>
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">관리 상태</p>
                    <span className="text-[11px] text-muted-foreground">
                      상태
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    우선순위·다음 액션·성향 태그를 확인하고 필요할 때만
                    수정합니다.
                  </p>
                </div>
                {!isMobile ? null : (
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 shrink-0"
                    >
                      {isMobile ? "펼치기" : "접기"}
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
              <CollapsibleContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={(customer as any).priority} />
                  <span
                    className={`rounded-full border px-2 py-1 text-xs ${(customer as any).nextAction ? "border-slate-200 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                  >
                    다음 액션: {(customer as any).nextAction ?? "설정 필요"}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs">우선순위</Label>
                <Select
                  value={(customer as any).priority ?? "unclassified"}
                  onValueChange={priority =>
                    updateMetaMutation.mutate({
                      customerId: id,
                      priority: priority as any,
                    })
                  }
                >
                  <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_PRIORITIES.map(priority => (
                      <SelectItem key={priority} value={priority}>
                        {getPriorityLabel(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">다음 액션</Label>
                <Select
                  value={(customer as any).nextAction ?? "none"}
                  onValueChange={nextAction =>
                    updateMetaMutation.mutate({
                      customerId: id,
                      nextAction:
                        nextAction === "none"
                          ? (null as any)
                          : (nextAction as any),
                    })
                  }
                >
                  <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안 함 · 설정 필요</SelectItem>
                    {CUSTOMER_NEXT_ACTIONS.map(action => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">최근 상담 요약</Label>
                <p className="text-sm mt-2 line-clamp-2">
                  {latestConsult?.summary ??
                    latestConsult?.content ??
                    "최근 상담 없음"}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-xs">상담 성향</Label>
              <p className="mb-2 text-[11px] text-muted-foreground">
                주요 태그만 빠르게 선택합니다. 전체 목록은 아래에서 확인하세요.
              </p>
              <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1 md:max-h-none">
                {CUSTOMER_TAGS.map(tag => {
                  const selected = customerTags.includes(tag);
                  const nextTags = selected
                    ? customerTags.filter(item => item !== tag)
                    : [...customerTags, tag];
                  return (
                    <Button
                      key={tag}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      className="min-h-12 text-xs md:h-7 md:min-h-7"
                      disabled={updateMetaMutation.isPending}
                      onClick={() =>
                        updateMetaMutation.mutate({
                          customerId: id,
                          customerTags: nextTags as any,
                        })
                      }
                    >
                      {tag}
                    </Button>
                  );
                })}
              </div>
            </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>

        <Collapsible defaultOpen={!isMobile}>
        <Card className="border-emerald-100 bg-white/95 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">상담 명분 추천</h3>
                <p className="text-xs text-muted-foreground">
                  추천 사유를 확인하고 상담 기록·후속 등록으로 이어갑니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
              <span
                className={`w-fit rounded-full px-2 py-0.5 text-xs ${contactReasons?.urgency === "high" ? "bg-red-100 text-red-700" : contactReasons?.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}
              >
                {contactUrgencyLabels[contactReasons?.urgency ?? "low"] ??
                  "보통"}
              </span>
              {isMobile && (
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="min-h-11">
                    더보기
                  </Button>
                </CollapsibleTrigger>
              )}
              </div>
            </div>
            <CollapsibleContent className="space-y-3">
            {(contactReasons?.warnings ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {contactReasons?.warnings.slice(0, 3).map(warning => (
                  <span
                    key={warning.warningType}
                    className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                  >
                    {warning.message}
                  </span>
                ))}
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-2">
              {(contactReasons?.reasons ?? []).slice(0, 4).map(reason => (
                <div
                  key={reason.reasonType}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <div className="text-sm font-medium">{reason.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reason.description}
                  </p>
                  {reason.situation && (
                    <p className="mt-2 text-[11px] text-primary">
                      추천 문구 상황: {reason.situation}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("tools")}
              >
                <Copy className="h-4 w-4 mr-1" /> 문자 문구 만들기
              </Button>
              <Button size="sm" onClick={() => setShowConsultModal(true)}>
                <MessageSquare className="h-4 w-4 mr-1" /> 상담 기록 추가
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFollowUpQuickModal(true)}
              >
                <CalendarPlus className="h-4 w-4 mr-1" /> 후속 등록
              </Button>
            </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
        </Collapsible>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground">
              상담 흐름
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              오늘 확인 → 상담 기록 → 진행 관리 → 계약·보장 → 상세 정보
            </p>
          </div>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm md:flex-wrap">
            <TabsTrigger value="consult">
              상담 기록 ({consultations?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="tools">상담 도구</TabsTrigger>
            <TabsTrigger value="timeline">
              활동 ({timelineData?.totalCount ?? 0})
            </TabsTrigger>
            <TabsTrigger value="contract">
              계약·보장 ({contracts?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="info">상세 정보</TabsTrigger>
            <TabsTrigger value="relationships">
              연결 고객 ({customerRelationships?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="referrals">
              소개 흐름 ({customerReferrals?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="claim-guidance">
              청구 안내 ({claimGuidanceCases?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="retention-risk">
              해지위험 ({retentionRiskCases?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="history">
              상태이력 ({statusHistoryData?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="consent">동의이력</TabsTrigger>
            <TabsTrigger value="assign_history">
              배정이력 ({assignmentHistoryData?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* 기본정보 */}
          <TabsContent value="info">
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { label: "이름", value: customer.name },
                    { label: "연락처", value: customer.phone ?? "-" },
                    {
                      label: "생년월일",
                      value: customer.birthDate
                        ? new Date(customer.birthDate).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-",
                    },
                    { label: "성별", value: genderLabel },
                    { label: "지역", value: customer.region ?? "-" },
                    {
                      label: "예상보험료",
                      value:
                        customer.expectedPremium != null
                          ? formatExpectedPremiumManwon(
                              customer.expectedPremium
                            )
                          : "-",
                    },
                    {
                      label: "통화가능시간",
                      value: customer.availableTime ?? "-",
                    },
                    { label: "유입경로", value: customer.source ?? "-" },
                    {
                      label: "DB 업체명",
                      value: (customer as any).dbCompany ?? "-",
                    },
                    {
                      label: "배정일",
                      value: customer.assignedAt
                        ? new Date(customer.assignedAt).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-",
                    },
                    {
                      label: "개인정보 동의",
                      value: customer.privacyConsent ? "✓ 동의" : "✗ 미동의",
                    },
                    {
                      label: "마케팅 수신 동의",
                      value: customer.marketingConsent ? "✓ 동의" : "✗ 미동의",
                    },
                    { label: "담당자", value: agentName },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      {label.includes("동의") ? (
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${String(value).includes("동의") && !String(value).includes("미동의") ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {value}
                        </span>
                      ) : (
                        <p className="font-medium mt-0.5">{value}</p>
                      )}
                    </div>
                  ))}
                </div>
                {customer.memo && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">메모</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {customer.memo}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            <FollowUpPanel
              followUps={followUps ?? []}
              onCreate={() => setShowFollowUpQuickModal(true)}
              onComplete={followUpId =>
                completeFollowUpMutation.mutate({ id: followUpId })
              }
              onPostpone={followUpId => setPostponeFollowUpId(followUpId)}
              onCancel={followUpId =>
                cancelFollowUpMutation.mutate({ id: followUpId })
              }
              loading={
                completeFollowUpMutation.isPending ||
                postponeFollowUpMutation.isPending ||
                cancelFollowUpMutation.isPending
              }
            />
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">인수인계 메모</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      고객 성향, 주의사항, 피해야 할 말, 추천 접근 방식을
                      내부용으로 남깁니다. 주민등록번호, 계좌번호, 증권번호,
                      병력상세 등 민감정보는 입력하지 마세요.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="md:hidden"
                    onClick={() => setShowHandoffNoteModal(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> 메모 추가
                  </Button>
                </div>
                <div className="hidden gap-2 md:grid md:grid-cols-5">
                  <div>
                    <Label className="text-xs">유형</Label>
                    <Select
                      value={handoffNoteType}
                      onValueChange={value => setHandoffNoteType(value as any)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(handoffNoteTypeLabels).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">제목</Label>
                    <Input
                      className="mt-1"
                      value={handoffNoteTitle}
                      onChange={event =>
                        setHandoffNoteTitle(event.target.value)
                      }
                      placeholder="예: 추천 접근 방식"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end justify-end">
                    <Button
                      type="button"
                      disabled={
                        !handoffNoteTitle.trim() ||
                        !handoffNoteBody.trim() ||
                        createHandoffNoteMutation.isPending
                      }
                      onClick={() =>
                        createHandoffNoteMutation.mutate({
                          customerId: id,
                          noteType: handoffNoteType,
                          title: handoffNoteTitle,
                          body: handoffNoteBody,
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      메모 추가
                    </Button>
                  </div>
                  <div className="md:col-span-5">
                    <Label className="text-xs">내용</Label>
                    <Textarea
                      className="mt-1"
                      rows={3}
                      value={handoffNoteBody}
                      onChange={event => setHandoffNoteBody(event.target.value)}
                      placeholder="고객 응대에 필요한 최소 정보만 기록하세요."
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  {(handoffNotes ?? []).length === 0 ? (
                    <EmptyState
                      title="등록된 인수인계 메모가 없습니다."
                      description="담당자 변경이나 장기 관리가 필요한 고객은 내부 메모를 남겨 주세요."
                      action={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowHandoffNoteModal(true)}
                        >
                          메모 추가
                        </Button>
                      }
                      className="py-6"
                    />
                  ) : (
                    (handoffNotes ?? []).map((note: any) => (
                      <div key={note.id} className="rounded-md border p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-medium">{note.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {handoffNoteTypeLabels[
                                note.noteType as keyof typeof handoffNoteTypeLabels
                              ] ?? note.noteType}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                              {note.body}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              updateHandoffNoteMutation.mutate({
                                id: note.id,
                                isActive: false,
                              })
                            }
                          >
                            비활성
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 상담기록 */}
          <TabsContent value="consult">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  총 {consultations?.length ?? 0}건
                </p>
                <Button size="sm" onClick={() => setShowConsultModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 상담기록 추가
                </Button>
              </div>
              {(consultations ?? []).length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="상담기록이 없습니다."
                  description="통화, 메시지, 방문 상담 내용을 기록하면 다음 행동을 더 정확히 판단할 수 있습니다."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowConsultModal(true)}
                    >
                      상담기록 추가
                    </Button>
                  }
                />
              ) : (
                (consultations ?? []).map(c => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={c.status} />
                            {(c as any).consultationType && (
                              <span className="text-[10px] rounded-full border px-2 py-0.5">
                                {(c as any).consultationType}
                              </span>
                            )}
                            {(c as any).customerNeed && (
                              <span className="text-[10px] rounded-full bg-secondary px-2 py-0.5">
                                {(c as any).customerNeed}
                              </span>
                            )}
                            {(c as any).nextAction && (
                              <span className="text-[10px] rounded-full border px-2 py-0.5">
                                다음: {(c as any).nextAction}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.createdAt).toLocaleString("ko-KR")}
                            </span>
                          </div>
                          {(c as any).summary && (
                            <p className="text-sm font-medium mb-1">
                              {(c as any).summary}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">
                            {c.content ?? "(내용 없음)"}
                          </p>
                          {c.nextContactAt && (
                            <p className="text-xs text-primary mt-2">
                              재상담 예정:{" "}
                              {new Date(c.nextContactAt).toLocaleString(
                                "ko-KR"
                              )}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() => setEditingConsultId(c.id)}
                        >
                          <Edit2 className="h-3 w-3 mr-1" /> 수정
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* 계약정보 */}
          <TabsContent value="contract">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  총 {contracts?.length ?? 0}건
                </p>
                <Button size="sm" onClick={() => setShowContractModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 계약 등록
                </Button>
              </div>
              {(contracts ?? []).length === 0 ? (
                <EmptyState
                  icon={FilePlus2}
                  title="계약 정보가 없습니다."
                  description="상담이 계약으로 이어졌다면 계약 정보를 등록해 실적과 후속관리를 연결하세요."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowContractModal(true)}
                    >
                      계약 등록
                    </Button>
                  }
                />
              ) : (
                (contracts ?? []).map(c => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            보험사
                          </p>
                          <p className="font-medium">{c.company ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            상품명
                          </p>
                          <p className="font-medium">{c.productName ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            상품군
                          </p>
                          <p className="font-medium">{c.productGroup ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            계약일
                          </p>
                          <p className="font-medium">
                            {c.contractDate
                              ? new Date(c.contractDate).toLocaleDateString(
                                  "ko-KR"
                                )
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            월보험료
                          </p>
                          <p className="font-medium">
                            {c.monthlyPremium
                              ? `${c.monthlyPremium.toLocaleString()}원`
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            납입상태
                          </p>
                          <StatusBadge status={c.paymentStatus ?? "정상"} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            계약상태
                          </p>
                          <StatusBadge status={c.contractStatus ?? "청약"} />
                        </div>
                      </div>
                      {c.memo && (
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          {c.memo}
                        </p>
                      )}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setEditingContractId(c.id)}
                        >
                          <Edit2 className="h-3 w-3 mr-1" /> 수정
                        </Button>
                        {canDeactivateContract && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => setDeleteContractId(c.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> 계약 삭제
                          </Button>
                        )}
                        {canRequestContractDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setRequestContractId(c.id)}
                          >
                            삭제 요청
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold">상담 체크리스트</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      상담 전/중/후 확인 항목을 체크하고 필요한 메모만 남깁니다.
                    </p>
                  </div>
                  {(["before", "during", "after"] as const).map(phase => {
                    const templates = checklistTemplates.filter(
                      template => template.phase === phase
                    );
                    return (
                      <div key={phase} className="space-y-2">
                        <div className="text-sm font-medium">
                          {checklistPhaseLabels[phase]}
                        </div>
                        {templates.length === 0 ? (
                          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                            등록된 항목이 없습니다.
                          </div>
                        ) : (
                          templates.map(template => {
                            const result = checklistResultsById.get(
                              template.id
                            );
                            return (
                              <div
                                key={template.id}
                                className="rounded-md border p-3 space-y-2"
                              >
                                <label className="flex items-start gap-2 text-sm">
                                  <Checkbox
                                    checked={Boolean(result?.checked)}
                                    disabled={
                                      updateChecklistResultMutation.isPending
                                    }
                                    onCheckedChange={checked =>
                                      updateChecklistResultMutation.mutate({
                                        checklistId: template.id,
                                        customerId: id,
                                        checked: checked === true,
                                        memo: result?.memo ?? undefined,
                                      })
                                    }
                                  />
                                  <span>
                                    <span className="font-medium">
                                      {template.title}
                                    </span>
                                    {template.isRequired ? (
                                      <span className="ml-1 text-xs text-red-500">
                                        필수
                                      </span>
                                    ) : null}
                                    {template.description ? (
                                      <span className="block text-xs text-muted-foreground mt-1">
                                        {template.description}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                                <Input
                                  value={result?.memo ?? ""}
                                  placeholder="체크 메모"
                                  className="h-8 text-xs"
                                  disabled={
                                    updateChecklistResultMutation.isPending
                                  }
                                  onChange={event =>
                                    updateChecklistResultMutation.mutate({
                                      checklistId: template.id,
                                      customerId: id,
                                      checked: Boolean(result?.checked),
                                      memo: event.target.value,
                                    })
                                  }
                                />
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold">카톡·문자 후속 문구</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      민감정보, 확정 표현, 가입 강요 표현은 문구에 넣지 마세요.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">문구 템플릿</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="상황별 문구 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {(messageTemplates ?? []).map(template => (
                          <SelectItem
                            key={template.id}
                            value={String(template.id)}
                          >
                            {template.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">다음 연락일</Label>
                      <Input
                        type="date"
                        value={messageNextContactDate}
                        onChange={event =>
                          setMessageNextContactDate(event.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">상담주제</Label>
                      <Input
                        value={messageTopic}
                        onChange={event => setMessageTopic(event.target.value)}
                        placeholder="예: 보장 점검"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">미리보기</Label>
                    <Textarea
                      readOnly
                      value={renderedMessage?.body ?? ""}
                      placeholder="템플릿을 선택하면 고객명과 담당자명이 반영된 문구를 확인할 수 있습니다."
                      className="mt-1 min-h-48 text-sm"
                    />
                  </div>
                  {selectedTemplate?.complianceNote ? (
                    <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                      {selectedTemplate.complianceNote}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    disabled={!renderedMessage?.body}
                    onClick={async () => {
                      if (!renderedMessage?.body) return;
                      await navigator.clipboard.writeText(renderedMessage.body);
                      logMessageCopyMutation.mutate({
                        templateId: Number(selectedTemplateId),
                        customerId: id,
                        channel: renderedMessage.channel as any,
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" /> 문구 복사
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold">상담 스크립트</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      통화와 상담 흐름을 참고할 수 있는 내부용 스크립트입니다.
                      고객 상황에 맞게 조정해서 사용하세요.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">스크립트 선택</Label>
                    <Select
                      value={selectedScriptId}
                      onValueChange={setSelectedScriptId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="상황별 상담 스크립트 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {(consultationScripts ?? []).map(script => (
                          <SelectItem key={script.id} value={String(script.id)}>
                            {script.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">미리보기</Label>
                    <Textarea
                      readOnly
                      value={selectedScript?.scriptBody ?? ""}
                      placeholder="스크립트를 선택하면 상담 흐름을 확인할 수 있습니다."
                      className="mt-1 min-h-48 text-sm"
                    />
                  </div>
                  {selectedScript?.complianceNote ? (
                    <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                      {selectedScript.complianceNote}
                    </div>
                  ) : (
                    <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                      가입 강요, 공포마케팅, 확정 표현은 사용하지 마세요. 고객
                      상황 확인과 기준 정리 중심으로 활용하세요.
                    </div>
                  )}
                  <Button
                    type="button"
                    disabled={!selectedScript?.scriptBody}
                    onClick={async () => {
                      if (!selectedScript?.scriptBody) return;
                      await navigator.clipboard.writeText(
                        selectedScript.scriptBody
                      );
                      logScriptCopyMutation.mutate({
                        scriptId: Number(selectedScriptId),
                        customerId: id,
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" /> 스크립트 복사
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <CustomerTimelinePanel
              timeline={timelineData}
              filter={timelineFilter}
              range={timelineRange}
              onFilterChange={setTimelineFilter}
              onRangeChange={setTimelineRange}
            />
          </TabsContent>

          <TabsContent value="relationships">
            <Card>
              <CardContent className="p-4">
                <CustomerRelationshipsPanel
                  customerId={id}
                  canManage={canManageRelationships}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card>
              <CardContent className="p-4">
                <CustomerReferralFlowsPanel
                  customerId={id}
                  pageCustomer={{
                    id: customer.id,
                    agentId: customer.agentId,
                  }}
                  user={user}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claim-guidance">
            <Card>
              <CardContent className="p-4">
                <CustomerClaimGuidancePanel
                  customerId={id}
                  pageCustomer={{
                    id: customer.id,
                    agentId: customer.agentId,
                  }}
                  user={user}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention-risk">
            <Card>
              <CardContent className="p-4">
                <CustomerRetentionRiskPanel
                  customerId={id}
                  pageCustomer={{
                    id: customer.id,
                    agentId: customer.agentId,
                  }}
                  user={user}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 상태 변경 이력 */}
          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                {(statusHistoryData ?? []).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    상태 변경 이력이 없습니다.
                  </div>
                ) : (
                  <div className="divide-y">
                    {(statusHistoryData ?? []).map(h => {
                      const changedByName =
                        users?.find(u => u.id === h.changedBy)?.name ??
                        `#${h.changedBy}`;
                      return (
                        <div
                          key={h.id}
                          className="flex items-center gap-3 p-3 text-sm"
                        >
                          <div className="text-xs text-muted-foreground w-32 shrink-0">
                            {new Date(h.createdAt).toLocaleString("ko-KR")}
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            {h.previousStatus && (
                              <StatusBadge status={h.previousStatus} />
                            )}
                            <span className="text-muted-foreground">→</span>
                            <StatusBadge status={h.newStatus} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {changedByName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 배정 이력 */}
          <TabsContent value="assign_history">
            <Card>
              <CardContent className="p-0">
                {(assignmentHistoryData ?? []).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    배정 이력이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left p-3">배정일시</th>
                          <th className="text-left p-3">배정유형</th>
                          <th className="text-left p-3">이전 부지점장</th>
                          <th className="text-left p-3">새 부지점장</th>
                          <th className="text-left p-3">이전 담당자</th>
                          <th className="text-left p-3">새 담당자</th>
                          <th className="text-left p-3">배정자</th>
                          <th className="text-left p-3">사유</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(assignmentHistoryData ?? []).map(h => {
                          const typeLabels: Record<string, string> = {
                            branch_to_sub_branch: "지점장 → 부지점장 배분",
                            sub_branch_to_agent: "부지점장 → 산하 조직원 배정",
                            branch_to_agent: "지점장 직접 배정",
                            reassignment: "담당자 재배정",
                          };
                          const prevSubAdmin =
                            users?.find(
                              u => u.id === h.previousSubBranchAdminId
                            )?.name ?? "-";
                          const newSubAdmin =
                            users?.find(
                              u => u.id === (h as any).newSubBranchAdminId
                            )?.name ?? "-";
                          const prevAgent = formatUserWithRole(
                            users?.find(u => u.id === h.previousAgentId)
                          );
                          const newAgent = formatUserWithRole(
                            users?.find(u => u.id === h.newAgentId)
                          );
                          const assignedByName = formatUserWithRole(
                            users?.find(u => u.id === h.assignedBy)
                          );
                          return (
                            <tr key={h.id}>
                              <td className="p-3 text-xs text-muted-foreground">
                                {new Date(h.createdAt).toLocaleString("ko-KR")}
                              </td>
                              <td className="p-3">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                  {typeLabels[
                                    (h as any).assignmentType ?? ""
                                  ] ?? "기타 배정"}
                                </span>
                              </td>
                              <td className="p-3 text-xs">{prevSubAdmin}</td>
                              <td className="p-3 text-xs">{newSubAdmin}</td>
                              <td className="p-3 text-xs">{prevAgent}</td>
                              <td className="p-3 text-xs font-medium">
                                {newAgent}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {assignedByName}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {(h as any).assignmentReason ?? "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 동의 이력 */}
          <TabsContent value="consent">
            <Card>
              <CardContent className="p-0">
                {(consentLogsData ?? []).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    동의 변경 이력이 없습니다.
                  </div>
                ) : (
                  <div className="divide-y">
                    {(consentLogsData ?? []).map(l => {
                      const changedByName =
                        users?.find(u => u.id === l.changedBy)?.name ??
                        `#${l.changedBy}`;
                      return (
                        <div
                          key={l.id}
                          className="flex items-center gap-3 p-3 text-sm"
                        >
                          <div className="text-xs text-muted-foreground w-32 shrink-0">
                            {new Date(l.createdAt).toLocaleString("ko-KR")}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">
                              {l.consentType === "privacy"
                                ? "개인정보 동의"
                                : "마케팅 수신 동의"}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {l.previousValue ? "동의" : "미동의"} →{" "}
                              {l.newValue ? "동의" : "미동의"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {changedByName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {isMobile && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-2">
            {customer.phone ? (
              <Button
                variant="default"
                className="min-h-12 flex-col gap-0.5 bg-blue-600 px-1 text-[11px] hover:bg-blue-700"
                asChild
              >
                <a href={`tel:${customer.phone}`}>
                  <Phone className="h-4 w-4" />
                  전화
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                className="min-h-12 flex-col gap-0.5 px-1 text-[11px]"
                disabled
              >
                <Phone className="h-4 w-4" />
                전화
              </Button>
            )}
            <Button
              variant="default"
              className="min-h-12 flex-col gap-0.5 px-1 text-[11px]"
              onClick={() => setShowConsultModal(true)}
            >
              <MessageSquare className="h-4 w-4" />
              상담
            </Button>
            <Button
              variant="secondary"
              className="min-h-12 flex-col gap-0.5 bg-amber-100 px-1 text-[11px] text-amber-900 hover:bg-amber-200"
              onClick={() => setShowFollowUpQuickModal(true)}
            >
              <CalendarPlus className="h-4 w-4" />
              후속
            </Button>
            <Button
              variant="outline"
              className="min-h-12 flex-col gap-0.5 px-1 text-[11px]"
              onClick={() =>
                setLocation(
                  `/calendar?customerId=${customer.id}&action=quick-create`
                )
              }
            >
              <CalendarPlus className="h-4 w-4" />
              일정
            </Button>
          </div>
        </div>
      )}

      {/* 고객 정보 수정 모달 */}
      {showEditModal && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSubmit={data => updateMutation.mutate({ id, ...data })}
          loading={updateMutation.isPending}
        />
      )}

      {/* 상담기록 추가 모달 */}
      <ConsultModal
        open={showConsultModal}
        onClose={() => setShowConsultModal(false)}
        onSubmit={data =>
          createConsultMutation.mutate({ ...data, customerId: id })
        }
        loading={createConsultMutation.isPending}
        currentStatus={customer.consultStatus}
      />

      {/* 상담기록 수정 모달 */}
      {editingConsultId && editingConsult && (
        <EditConsultModal
          consult={editingConsult}
          onClose={() => setEditingConsultId(null)}
          onSubmit={data =>
            updateConsultMutation.mutate({ id: editingConsultId, ...data })
          }
          loading={updateConsultMutation.isPending}
        />
      )}

      {/* 계약 등록 모달 */}
      <ContractModal
        open={showContractModal}
        onClose={() => setShowContractModal(false)}
        onSubmit={data =>
          createContractMutation.mutate({ ...data, customerId: id })
        }
        loading={createContractMutation.isPending}
        customerAgentId={customer.agentId}
        currentUserRole={user?.role}
      />

      {editingContractId && editingContract && (
        <ContractModal
          open={true}
          contract={editingContract}
          onClose={() => setEditingContractId(null)}
          onSubmit={data =>
            updateContractMutation.mutate({ id: editingContractId, ...data })
          }
          loading={updateContractMutation.isPending}
          customerAgentId={customer.agentId}
          currentUserRole={user?.role}
        />
      )}

      {/* 담당자 변경 모달 */}
      <FollowupQuickCreateDialog
        open={showFollowUpQuickModal}
        onClose={() => setShowFollowUpQuickModal(false)}
        defaultCustomerId={id}
        onSubmit={data => createFollowUpMutation.mutate(data)}
        onOpenDetailed={openDetailedFollowUp}
        loading={createFollowUpMutation.isPending}
      />

      <FollowUpModal
        open={showFollowUpModal}
        onClose={() => {
          setShowFollowUpModal(false);
          setFollowUpDetailedSeed(null);
        }}
        seed={followUpDetailedSeed ?? undefined}
        onSubmit={data =>
          createFollowUpMutation.mutate({ customerId: id, ...data })
        }
        loading={createFollowUpMutation.isPending}
      />

      <FollowUpModal
        open={postponeFollowUpId !== null}
        mode="postpone"
        onClose={() => setPostponeFollowUpId(null)}
        onSubmit={data =>
          postponeFollowUpId &&
          postponeFollowUpMutation.mutate({
            id: postponeFollowUpId,
            nextContactDate: data.nextContactDate,
            reason: data.reason,
          })
        }
        loading={postponeFollowUpMutation.isPending}
      />

      <QuickConsultationModal
        open={showQuickConsultModal}
        onOpenChange={setShowQuickConsultModal}
        customerId={customer.id}
        customerName={customer.name}
        currentStatus={customer.consultStatus}
        currentNextAction={customer.nextAction || undefined}
        onSuccess={() => refetchCustomer()}
      />
      <Dialog
        open={showCustomerDeleteDialog}
        onOpenChange={setShowCustomerDeleteDialog}
      >
        <DialogContent className="max-w-md rounded-2xl border-red-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> 고객 삭제 확인
            </DialogTitle>
            <DialogDescription>
              고객 삭제는 완전 삭제가 아니라 비활성 처리이며, 기존 권한과 삭제
              정책을 그대로 따릅니다.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
            활성 계약이나 진행 중 일정이 있으면 삭제할 수 없습니다. 이 작업은
            활동 로그에 기록됩니다.
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowCustomerDeleteDialog(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate({ id })}
            >
              고객 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showReclaimDialog}
        onOpenChange={open => {
          setShowReclaimDialog(open);
          if (!open) setReclaimReason("");
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-amber-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <Undo2 className="h-5 w-5" /> DB 회수 확인
            </DialogTitle>
            <DialogDescription>
              {customer.name} DB를 담당자에서 미배정 상태로 회수합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              고객 데이터와 상담기록, 계약, 후속관리, 일정은 삭제하지 않습니다.
              회수 기록은 배정이력과 활동 로그에 남습니다.
            </div>
            <div>
              <Label className="text-xs">현재 담당자</Label>
              <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {agentName}
              </p>
            </div>
            <div>
              <Label className="text-xs">회수 사유 *</Label>
              <Textarea
                className="mt-1 min-h-[96px]"
                value={reclaimReason}
                onChange={event => setReclaimReason(event.target.value)}
                maxLength={300}
                placeholder="예: 담당자 퇴사/휴직, 지점장 재분배 검토, 미배정 풀 재정리"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {reclaimReason.length}/300
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowReclaimDialog(false);
                setReclaimReason("");
              }}
              disabled={reclaimMutation.isPending}
            >
              취소
            </Button>
            <Button
              className="bg-amber-700 text-white hover:bg-amber-800"
              disabled={!reclaimReason.trim() || reclaimMutation.isPending}
              onClick={() =>
                reclaimMutation.mutate({
                  customerId: id,
                  reason: reclaimReason.trim(),
                })
              }
            >
              {reclaimMutation.isPending ? "회수 중..." : "DB 회수"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteContractId !== null}
        onOpenChange={open => {
          if (!open) setDeleteContractId(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-red-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> 계약 삭제 확인
            </DialogTitle>
            <DialogDescription>
              {deleteTargetContract
                ? `${deleteTargetContract.company ?? "선택한"} 계약을 비활성 처리합니다.`
                : "선택한 계약을 비활성 처리합니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
            완전 삭제가 아니며 기본 계약 목록과 실적 집계에서 제외됩니다. 이
            작업은 활동 로그에 기록됩니다.
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteContractId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={
                !deleteContractId || deactivateContractMutation.isPending
              }
              onClick={() =>
                deleteContractId &&
                deactivateContractMutation.mutate({ id: deleteContractId })
              }
            >
              계약 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showHandoffNoteModal}
        onOpenChange={setShowHandoffNoteModal}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>인수인계 메모 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              민감정보는 입력하지 말고, 다음 상담자가 바로 참고할 행동 정보만
              남기세요.
            </p>
            <div>
              <Label className="text-xs">유형</Label>
              <Select
                value={handoffNoteType}
                onValueChange={value => setHandoffNoteType(value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(handoffNoteTypeLabels).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">제목</Label>
              <Input
                className="mt-1"
                value={handoffNoteTitle}
                onChange={event => setHandoffNoteTitle(event.target.value)}
                placeholder="예: 추천 접근 방식"
              />
            </div>
            <div>
              <Label className="text-xs">내용</Label>
              <Textarea
                className="mt-1"
                rows={4}
                value={handoffNoteBody}
                onChange={event => setHandoffNoteBody(event.target.value)}
                placeholder="고객 응대에 필요한 최소 정보만 기록하세요."
              />
            </div>
            <div className="sticky bottom-0 flex gap-2 bg-background pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowHandoffNoteModal(false)}
              >
                취소
              </Button>
              <Button
                className="flex-1"
                disabled={
                  !handoffNoteTitle.trim() ||
                  !handoffNoteBody.trim() ||
                  createHandoffNoteMutation.isPending
                }
                onClick={() =>
                  createHandoffNoteMutation.mutate({
                    customerId: id,
                    noteType: handoffNoteType,
                    title: handoffNoteTitle,
                    body: handoffNoteBody,
                  })
                }
              >
                메모 추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showChangeAgentModal && (
        <Dialog
          open={true}
          onOpenChange={() => {
            setSelectedNewAgentId("");
            setShowChangeAgentModal(false);
          }}
        >
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>담당자 변경 - {customer.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                현재 담당자: <strong>{agentName}</strong>
              </p>
              <Select
                value={selectedNewAgentId}
                onValueChange={setSelectedNewAgentId}
              >
                <SelectTrigger className="h-10 rounded-xl bg-slate-50">
                  <SelectValue placeholder="새 담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? [])
                    .filter(
                      u =>
                        (u as any).accountStatus === "active" &&
                        u.id !== customer.agentId
                    )
                    .map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {formatUserWithRole(u)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="sticky bottom-0 flex gap-2 bg-background pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedNewAgentId("");
                    setShowChangeAgentModal(false);
                  }}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={
                    !selectedNewAgentId ||
                    Number(selectedNewAgentId) === customer.agentId ||
                    changeAgentMutation.isPending
                  }
                  onClick={() =>
                    changeAgentMutation.mutate({
                      customerId: id,
                      newAgentId: Number(selectedNewAgentId),
                    })
                  }
                >
                  {changeAgentMutation.isPending ? "변경 중..." : "변경 확정"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

// ─── 고객 정보 수정 모달 ──────────────────────────────────────────────────────
function CustomerTimelinePanel({
  timeline,
  filter,
  range,
  onFilterChange,
  onRangeChange,
}: {
  timeline?: { items: any[]; totalCount: number };
  filter: (typeof TIMELINE_FILTERS)[number]["value"];
  range: "all" | "30" | "90";
  onFilterChange: (value: (typeof TIMELINE_FILTERS)[number]["value"]) => void;
  onRangeChange: (value: "all" | "30" | "90") => void;
}) {
  const items = timeline?.items ?? [];
  const visibleItems = items.filter(
    item => !shouldHideTimelineEvent(item.eventType)
  );
  const hiddenViewedCount = items.length - visibleItems.length;
  const latestConsult = visibleItems.find(item => item.source === "consultations");
  const latestContract = visibleItems.find(
    item => item.source === "contracts" || item.source === "contract_history"
  );
  const latestFollowUp = visibleItems.find(item => item.source === "follow_ups");
  const latestAssignment = visibleItems.find(
    item => item.source === "assignment_history"
  );
  const severityClass: Record<string, string> = {
    normal: "bg-gray-100 text-gray-700 border-gray-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">고객 히스토리</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                고객과 관련된 상담, 계약, 후속관리, 알림, 배정, 삭제 요청 이력을
                시간순으로 확인합니다.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              총 {visibleItems.length}건
            </div>
          </div>
          {hiddenViewedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              조회 기록 {hiddenViewedCount}건은 기본 화면에서 숨기고 중요한 업무
              기록을 우선 표시합니다.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              {
                label: "최근 상담",
                value: latestConsult
                  ? new Date(latestConsult.occurredAt).toLocaleDateString(
                      "ko-KR"
                    )
                  : "-",
              },
              {
                label: "최근 계약",
                value: latestContract
                  ? new Date(latestContract.occurredAt).toLocaleDateString(
                      "ko-KR"
                    )
                  : "-",
              },
              {
                label: "최근 후속관리",
                value: latestFollowUp
                  ? new Date(latestFollowUp.occurredAt).toLocaleDateString(
                      "ko-KR"
                    )
                  : "-",
              },
              {
                label: "최근 담당 변경",
                value: latestAssignment
                  ? new Date(latestAssignment.occurredAt).toLocaleDateString(
                      "ko-KR"
                    )
                  : "-",
              },
            ].map(item => (
              <div key={item.label} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-medium mt-1">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {TIMELINE_FILTERS.map(item => (
              <Button
                key={item.value}
                variant={filter === item.value ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => onFilterChange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">기간</Label>
            <Select
              value={range}
              onValueChange={value =>
                onRangeChange(value as "all" | "30" | "90")
              }
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="30">최근 30일</SelectItem>
                <SelectItem value="90">최근 90일</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {visibleItems.length === 0 ? (
        <EmptyState
          icon={History}
          title="아직 표시할 히스토리가 없습니다."
          description="상담, 계약, 후속관리, 배정 변경이 발생하면 이곳에 시간순으로 표시됩니다."
        />
      ) : (
        <div className="space-y-3">
          {visibleItems.map(event => {
            const eventLabel = getCustomerTimelineEventLabel(event.eventType);
            const eventSummary = getCustomerTimelineSummary(
              event.eventType,
              event.summary
            );
            return (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="mt-1 h-9 w-9 rounded-full border flex items-center justify-center shrink-0 bg-background">
                      <History className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${severityClass[event.severity] ?? severityClass.normal}`}
                        >
                          {eventLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.occurredAt).toLocaleString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-2 line-clamp-2">
                        {eventSummary}
                      </p>
                      {event.detail && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {event.detail}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>
                          {event.actorName
                            ? `처리자: ${event.actorName}`
                            : "처리자: -"}
                        </span>
                        {event.actorRole && (
                          <span>역할: {getRoleLabel(event.actorRole)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FollowUpPanel({
  followUps,
  onCreate,
  onComplete,
  onPostpone,
  onCancel,
  loading,
}: {
  followUps: any[];
  onCreate: () => void;
  onComplete: (id: number) => void;
  onPostpone: (id: number) => void;
  onCancel: (id: number) => void;
  loading: boolean;
}) {
  const openItems = followUps.filter(
    item => item.status === "scheduled" || item.status === "postponed"
  );
  return (
    <Card className="mt-4 border-slate-200/80 bg-white/95 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">다음 연락일 / 후속관리</p>
            <p className="text-xs text-muted-foreground">
              민감정보는 후속관리 메모에 입력하지 마세요.
            </p>
          </div>
          <Button
            size="sm"
            className="min-h-12 rounded-xl md:min-h-8"
            onClick={onCreate}
          >
            다음 연락일 설정
          </Button>
        </div>
        {openItems.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="등록된 다음 연락일이 없습니다."
            description="다음 연락일을 정하면 모바일 대시보드와 알림 흐름에서 바로 확인할 수 있습니다."
            action={
              <Button
                type="button"
                size="sm"
                className="min-h-12 md:min-h-8"
                onClick={onCreate}
              >
                후속관리 등록
              </Button>
            }
            className="py-6"
          />
        ) : (
          <div className="space-y-2">
            {openItems.slice(0, 5).map(item => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {formatKstLocalDateTime(item.nextContactDate, {
                        seconds: false,
                      }).replace("T", " ")}{" "}
                      · {item.nextAction}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.reason}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                    {followUpStatusLabels[item.status] ?? "기타 상태"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    size="sm"
                    className="min-h-12 md:min-h-10"
                    variant="outline"
                    disabled={loading}
                    onClick={() => onComplete(item.id)}
                  >
                    후속관리 완료
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-12 md:min-h-10"
                    variant="outline"
                    disabled={loading}
                    onClick={() => onPostpone(item.id)}
                  >
                    연락일 연기
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-12 md:min-h-10"
                    variant="outline"
                    disabled={loading}
                    onClick={() => onCancel(item.id)}
                  >
                    후속관리 취소
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onSubmit,
  loading,
}: {
  customer: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const { data: regionOptions } = trpc.settings.formOptions.useQuery({
    category: "region",
  });
  const { data: sourceOptions } = trpc.settings.formOptions.useQuery({
    category: "source",
  });
  const regions = regionOptions?.map(item => item.value).filter(Boolean) ?? [];
  const sources = sourceOptions?.map(item => item.value).filter(Boolean) ?? [];
  const [form, setForm] = useState({
    name: customer.name ?? "",
    phone: customer.phone ?? "",
    birthDate: customer.birthDate
      ? new Date(customer.birthDate).toISOString().split("T")[0]
      : "",
    gender: customer.gender ?? "none",
    region: customer.region ?? "",
    expectedPremium:
      customer.expectedPremium != null
        ? expectedPremiumManwonFormStringFromStoredWon(customer.expectedPremium)
        : "",
    availableTime: customer.availableTime ?? "",
    source: customer.source ?? "",
    dbCompany: customer.dbCompany ?? "",
    memo: customer.memo ?? "",
    privacyConsent: customer.privacyConsent ?? false,
    marketingConsent: customer.marketingConsent ?? false,
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>고객 정보 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">이름 *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">연락처</Label>
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="h-8 mt-1"
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
                value={form.gender}
                onValueChange={v => setForm({ ...form, gender: v })}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue />
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
                list="edit-customer-region-options"
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
              />
            </div>
            <div>
              <Label className="text-xs">유입경로</Label>
              <Input
                list="edit-customer-source-options"
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value })}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">DB 업체명</Label>
              <Input
                value={form.dbCompany}
                onChange={e => setForm({ ...form, dbCompany: e.target.value })}
                className="h-8 mt-1"
              />
            </div>
          </div>
          <datalist id="edit-customer-region-options">
            {regions.map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="edit-customer-source-options">
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              size="sm"
              disabled={loading || !form.name}
              onClick={() =>
                onSubmit({
                  name: form.name,
                  phone: form.phone || undefined,
                  birthDate: form.birthDate || undefined,
                  gender:
                    form.gender === "none" ? undefined : (form.gender as any),
                  region: form.region || undefined,
                  expectedPremium: form.expectedPremium
                    ? expectedPremiumStoredWonFromManwonInput(
                        form.expectedPremium
                      )
                    : undefined,
                  availableTime: form.availableTime || undefined,
                  source: form.source || undefined,
                  dbCompany: form.dbCompany || undefined,
                  memo: form.memo || undefined,
                  privacyConsent: form.privacyConsent,
                  marketingConsent: form.marketingConsent,
                })
              }
            >
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 상담기록 추가 모달 ───────────────────────────────────────────────────────
function ConsultModal({
  open,
  onClose,
  onSubmit,
  loading,
  currentStatus,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  currentStatus: string;
}) {
  const { data: consultStatusOptions } = trpc.settings.formOptions.useQuery({
    category: "consultStatus",
  });
  const consultStatuses = consultStatusOptions?.length
    ? consultStatusOptions.map(item => item.value)
    : CONSULT_STATUSES;
  const [form, setForm] = useState({
    status: currentStatus,
    consultationType: "전화",
    customerNeed: "기타",
    nextAction: "재연락",
    summary: "",
    content: "",
    nextContactAt: "",
  });
  const [createCalendarSchedule, setCreateCalendarSchedule] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleReminderOffset, setScheduleReminderOffset] = useState("30");
  const missingScheduleTime = createCalendarSchedule && !form.nextContactAt;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>상담기록 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">상담상태</Label>
            <Select
              value={form.status}
              onValueChange={v => setForm({ ...form, status: v })}
            >
              <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">상담유형</Label>
              <Select
                value={form.consultationType}
                onValueChange={v => setForm({ ...form, consultationType: v })}
              >
                <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSULTATION_TYPES.map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">고객 니즈</Label>
              <Select
                value={form.customerNeed}
                onValueChange={v => setForm({ ...form, customerNeed: v })}
              >
                <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_NEEDS.map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">다음 액션</Label>
            <Select
              value={form.nextAction}
              onValueChange={v => setForm({ ...form, nextAction: v })}
            >
              <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_NEXT_ACTIONS.map(item => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">상담 요약</Label>
            <Input
              value={form.summary}
              maxLength={200}
              onChange={e => setForm({ ...form, summary: e.target.value })}
              className="mt-1 min-h-12 md:h-9 md:min-h-9"
              placeholder="한 줄 요약"
            />
          </div>
          <div>
            <Label className="text-xs">상세 메모</Label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              className="mt-1 min-h-28 w-full resize-none rounded-md border border-input bg-background px-3 py-3 text-sm leading-6"
              placeholder="상담 내용을 입력하세요..."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              주민등록번호, 증권번호, 계좌번호, 병력상세 등 민감정보는 입력하지
              마세요.
            </p>
          </div>
          <div>
            <Label className="text-xs">재상담 예정일</Label>
            <Input
              type="datetime-local"
              value={form.nextContactAt}
              onChange={e =>
                setForm({ ...form, nextContactAt: e.target.value })
              }
              className="mt-1 min-h-12 md:h-9 md:min-h-9"
            />
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={createCalendarSchedule}
                onCheckedChange={checked =>
                  setCreateCalendarSchedule(checked === true)
                }
              />
              <span>
                <span className="font-medium">캘린더 일정도 함께 등록</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  재상담 예정일과 같은 시각에 고객 연결 일정이 생성됩니다.
                </span>
              </span>
            </label>
            {createCalendarSchedule && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">일정 제목</Label>
                  <Input
                    value={scheduleTitle}
                    maxLength={100}
                    onChange={e => setScheduleTitle(e.target.value)}
                    className="mt-1 min-h-12 md:h-9 md:min-h-9"
                    placeholder="재상담 일정"
                  />
                </div>
                <div>
                  <Label className="text-xs">알림</Label>
                  <Select
                    value={scheduleReminderOffset}
                    onValueChange={setScheduleReminderOffset}
                  >
                    <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {linkedScheduleReminderOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {missingScheduleTime && (
                  <p className="text-xs text-destructive sm:col-span-2">
                    캘린더 일정 등록을 위해 재상담 예정일을 입력해주세요.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              size="sm"
              disabled={loading || missingScheduleTime}
              onClick={() =>
                onSubmit({
                  ...form,
                  summary: form.summary || undefined,
                  content: form.content || undefined,
                  nextContactAt: form.nextContactAt || undefined,
                  calendarSchedule: createCalendarSchedule
                    ? {
                        title: scheduleTitle || undefined,
                        startTime: form.nextContactAt,
                        type:
                          form.consultationType === "방문"
                            ? "고객상담"
                            : "재통화",
                        memo: form.summary || form.content || undefined,
                        reminderOffsetMinutes: Number(
                          scheduleReminderOffset
                        ) as -1 | 0 | 30 | 60 | 120 | 1440,
                      }
                    : undefined,
                })
              }
            >
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 상담기록 수정 모달 ───────────────────────────────────────────────────────
function EditConsultModal({
  consult,
  onClose,
  onSubmit,
  loading,
}: {
  consult: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    status: consult.status,
    consultationType: consult.consultationType ?? "전화",
    customerNeed: consult.customerNeed ?? "기타",
    nextAction: consult.nextAction ?? "재연락",
    summary: consult.summary ?? "",
    content: consult.content ?? "",
    nextContactAt: consult.nextContactAt
      ? formatKstLocalDateTime(consult.nextContactAt, { seconds: false })
      : "",
  });
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>상담기록 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">상담상태</Label>
            <Select
              value={form.status}
              onValueChange={v => setForm({ ...form, status: v })}
            >
              <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONSULT_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">상담유형</Label>
              <Select
                value={form.consultationType}
                onValueChange={v => setForm({ ...form, consultationType: v })}
              >
                <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSULTATION_TYPES.map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">고객 니즈</Label>
              <Select
                value={form.customerNeed}
                onValueChange={v => setForm({ ...form, customerNeed: v })}
              >
                <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_NEEDS.map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">다음 액션</Label>
            <Select
              value={form.nextAction}
              onValueChange={v => setForm({ ...form, nextAction: v })}
            >
              <SelectTrigger className="mt-1 min-h-12 md:h-9 md:min-h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_NEXT_ACTIONS.map(item => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">상담 요약</Label>
            <Input
              value={form.summary}
              maxLength={200}
              onChange={e => setForm({ ...form, summary: e.target.value })}
              className="mt-1 min-h-12 md:h-9 md:min-h-9"
            />
          </div>
          <div>
            <Label className="text-xs">상세 메모</Label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              className="mt-1 min-h-28 w-full resize-none rounded-md border border-input bg-background px-3 py-3 text-sm leading-6"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              주민등록번호, 증권번호, 계좌번호, 병력상세 등 민감정보는 입력하지
              마세요.
            </p>
          </div>
          <div>
            <Label className="text-xs">재상담 예정일</Label>
            <Input
              type="datetime-local"
              value={form.nextContactAt}
              onChange={e =>
                setForm({ ...form, nextContactAt: e.target.value })
              }
              className="mt-1 min-h-12 md:h-9 md:min-h-9"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              size="sm"
              disabled={loading}
              onClick={() =>
                onSubmit({
                  status: form.status,
                  consultationType: form.consultationType,
                  customerNeed: form.customerNeed,
                  nextAction: form.nextAction,
                  summary: form.summary || undefined,
                  content: form.content || undefined,
                  nextContactAt: form.nextContactAt || null,
                })
              }
            >
              {loading ? "저장 중..." : "수정 저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 계약 등록 모달 ───────────────────────────────────────────────────────────
function ContractModal({
  open,
  onClose,
  onSubmit,
  loading,
  contract,
  customerAgentId,
  currentUserRole,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  contract?: any;
  customerAgentId?: number | null;
  currentUserRole?: string;
}) {
  const [form, setForm] = useState({
    company: contract?.company ?? "",
    productName: contract?.productName ?? "",
    productGroup: contract?.productGroup ?? "",
    contractDate: contract?.contractDate
      ? new Date(contract.contractDate).toISOString().split("T")[0]
      : "",
    monthlyPremium: contract?.monthlyPremium
      ? String(contract.monthlyPremium)
      : "",
    paymentStatus: contract?.paymentStatus ?? "정상",
    contractStatus: contract?.contractStatus ?? "청약",
    memo: contract?.memo ?? "",
    agentId: contract?.agentId
      ? String(contract.agentId)
      : customerAgentId
        ? String(customerAgentId)
        : "default",
  });
  const { data: users } = trpc.users.list.useQuery();
  const { data: insurerOptions } = trpc.settings.formOptions.useQuery({
    category: "insurer",
  });
  const { data: productGroupOptions } = trpc.settings.formOptions.useQuery({
    category: "productGroup",
  });
  const { data: paymentStatusOptions } = trpc.settings.formOptions.useQuery({
    category: "paymentStatus",
  });
  const { data: contractStatusOptions } = trpc.settings.formOptions.useQuery({
    category: "contractStatus",
  });
  const insurers =
    insurerOptions?.map(item => item.value).filter(Boolean) ?? [];
  const productGroups =
    productGroupOptions?.map(item => item.value).filter(Boolean) ?? [];
  const paymentStatuses = paymentStatusOptions?.length
    ? paymentStatusOptions.map(item => item.value)
    : [form.paymentStatus];
  const contractStatuses = contractStatusOptions?.length
    ? contractStatusOptions.map(item => item.value)
    : [form.contractStatus];
  const agentOptions = (users ?? []).filter(
    u =>
      (u as any).accountStatus === "active" &&
      (u.role === "branch_admin" ||
        u.role === "team_leader" ||
        u.role === "member")
  );
  const requiresAgentSelection =
    !contract && !customerAgentId && currentUserRole !== "member";
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contract ? "계약 수정" : "계약 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">보험사</Label>
              <Input
                list="contract-insurer-options"
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">상품명</Label>
              <Input
                value={form.productName}
                onChange={e =>
                  setForm({ ...form, productName: e.target.value })
                }
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">상품군</Label>
              <Input
                list="contract-product-group-options"
                value={form.productGroup}
                onChange={e =>
                  setForm({ ...form, productGroup: e.target.value })
                }
                className="h-8 mt-1"
                placeholder="예: 종신, 실손"
              />
            </div>
            <div>
              <Label className="text-xs">계약일</Label>
              <Input
                type="date"
                value={form.contractDate}
                onChange={e =>
                  setForm({ ...form, contractDate: e.target.value })
                }
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">월보험료 (원)</Label>
              <Input
                type="number"
                value={form.monthlyPremium}
                onChange={e =>
                  setForm({ ...form, monthlyPremium: e.target.value })
                }
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">납입상태</Label>
              <Select
                value={form.paymentStatus}
                onValueChange={v => setForm({ ...form, paymentStatus: v })}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">계약상태</Label>
              <Select
                value={form.contractStatus}
                onValueChange={v => setForm({ ...form, contractStatus: v })}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contractStatuses.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">담당 설계사</Label>
              <Select
                value={form.agentId}
                onValueChange={v => setForm({ ...form, agentId: v })}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="기본 담당자" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">기본 담당자</SelectItem>
                  {agentOptions.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {formatUserWithRole(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requiresAgentSelection && (
                <p className="text-xs text-destructive mt-1">
                  계약 담당 설계사를 선택해야 합니다.
                </p>
              )}
            </div>
          </div>
          <datalist id="contract-insurer-options">
            {insurers.map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="contract-product-group-options">
            {productGroups.map(v => (
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              size="sm"
              disabled={loading}
              onClick={() => {
                if (requiresAgentSelection && form.agentId === "default") {
                  toast.error("계약 담당 설계사를 선택해야 합니다.");
                  return;
                }
                const { agentId, ...payload } = form;
                onSubmit({
                  ...payload,
                  monthlyPremium: form.monthlyPremium
                    ? Number(form.monthlyPremium)
                    : undefined,
                  ...(agentId !== "default"
                    ? contract
                      ? { newAgentId: Number(agentId) }
                      : { agentIdOverride: Number(agentId) }
                    : {}),
                });
              }}
            >
              {loading ? "저장 중..." : contract ? "수정" : "등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
