import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";
import {
  getUserFacingErrorMessage,
  toastUserFacingError,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { getRoleLabel } from "@/lib/userRole";
import {
  ACTION_PLAN_SENSITIVE_INPUT_NOTICE,
  ACTION_PLAN_STATUS_LABELS,
  getWeekDateRange,
  isActionPlanEditable,
} from "@shared/actionPlans";
import {
  ACTION_PLAN_PR21_NOTICE,
  weekLabelToNumber,
} from "@shared/actionPlanDirectUpload";
import {
  NumberField,
  PR21_SELECT_OPTIONS,
  PrivacyConfirmField,
  SelectField,
  TextAreaField,
} from "@/components/actionPlans/ActionPlanPr21Fields";
import { ClipboardList, Download, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(status?: string | null) {
  if (!status) return <Badge variant="outline">미작성</Badge>;
  const label =
    ACTION_PLAN_STATUS_LABELS[status as keyof typeof ACTION_PLAN_STATUS_LABELS] ??
    status;
  const className =
    status === "submitted"
      ? "bg-blue-100 text-blue-700"
      : status === "reviewed"
        ? "bg-emerald-100 text-emerald-700"
        : status === "revision_requested"
          ? "bg-amber-100 text-amber-800"
          : status === "closed"
            ? "bg-slate-100 text-slate-600"
            : "bg-slate-100 text-slate-700";
  return <Badge className={className}>{label}</Badge>;
}

const defaultMonthlyForm = {
  monthlyContractTarget: 0,
  monthlyPremiumTarget: 0,
  monthlyConsultationTarget: 0,
  monthlyCallTarget: 0,
  monthlyMessageTarget: 0,
  monthlyFollowUpTarget: 0,
  monthlyRevenueTarget: 0,
  monthlyNewConsultationTarget: 0,
  monthlyContactTarget: 0,
  monthlyAnalysisTarget: 0,
  monthlyProposalTarget: 0,
  monthlyIntroductionRequestTarget: 0,
  focusCustomerGroup: "",
  primaryCustomerSegment: "",
  monthlyStrategy: "",
  preparationMemo: "",
  monthlyPreparationStatus: "",
  expectedRisk: "",
  supportRequest: "없음",
  complianceCheckMemo: "",
  privacyMinimizedConfirmed: false,
};

const defaultWeeklyForm = {
  weeklyContractTarget: 0,
  weeklyPremiumTarget: 0,
  weeklyConsultationTarget: 0,
  weeklyCallTarget: 0,
  weeklyMessageTarget: 0,
  weeklyVisitTarget: 0,
  weeklyProposalTarget: 0,
  weeklyFollowUpTarget: 0,
  weeklyRevenueTarget: 0,
  weeklyAnalysisTarget: 0,
  weeklyIntroductionRequestTarget: 0,
  weeklyReconnectTarget: 0,
  focusCustomerGroup: "",
  targetCustomerSegment: "",
  targetCustomerReference: "",
  customerStage: "",
  proposedProductCategory: "",
  proposedCoverageArea: "",
  proposalPurpose: "",
  preparationMaterials: "",
  weeklyActionPlan: "",
  preparationMemo: "",
  expectedRisk: "",
  supportRequest: "없음",
  complianceRiskCheck: "",
  weeklyReviewMemo: "",
  nextWeekImprovement: "",
  coachingRequest: "",
  privacyMinimizedConfirmed: false,
};

const defaultDailyForm = {
  callTarget: 0,
  messageTarget: 0,
  consultationTarget: 0,
  visitTarget: 0,
  proposalTarget: 0,
  followUpTarget: 0,
  dailyRevenueTarget: 0,
  newContactTarget: 0,
  analysisTarget: 0,
  introductionRequestTarget: 0,
  reconnectTarget: 0,
  contractTarget: 0,
  targetCustomerSegment: "",
  targetCustomerReference: "",
  customerStage: "",
  proposedProductCategory: "",
  proposedCoverageArea: "",
  proposalPurpose: "",
  preparationMaterials: "",
  todayPriority: "",
  preparationMemo: "",
  actualCallCount: 0,
  actualMessageCount: 0,
  actualConsultationCount: 0,
  actualVisitCount: 0,
  actualProposalCount: 0,
  actualFollowUpCount: 0,
  actualNewContactCount: 0,
  actualAnalysisCount: 0,
  actualIntroductionRequestCount: 0,
  actualReconnectCount: 0,
  actualContractCount: 0,
  actualResultMemo: "",
  nextDayMemo: "",
  complianceRiskCheck: "",
  privacyMinimizedConfirmed: false,
};

export default function ActionPlanManagement() {
  const { user } = useAuth();
  const isManager =
    user?.role === "branch_admin" ||
    user?.role === "sub_branch_admin" ||
    user?.role === "team_leader";
  const isBranchAdmin = user?.role === "branch_admin";

  const [targetMonth, setTargetMonth] = useState(currentMonth());
  const [weekLabel, setWeekLabel] = useState("1주차");
  const [planDate, setPlanDate] = useState(todayDate());
  const [activeTab, setActiveTab] = useState("mine");
  const [downloadReason, setDownloadReason] = useState("");
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const weekRange = useMemo(
    () => getWeekDateRange(targetMonth, weekLabel),
    [targetMonth, weekLabel]
  );

  const monthlyQuery = trpc.actionPlans.getMonthlyPlan.useQuery({
    targetMonth,
  });
  const weeklyQuery = trpc.actionPlans.getWeeklyPlans.useQuery(
    { monthlyPlanId: monthlyQuery.data?.id },
    { enabled: !!monthlyQuery.data?.id }
  );
  const weeklyPlan = useMemo(
    () => {
      const n = weekLabelToNumber(weekLabel);
      return weeklyQuery.data?.find(
        p => p.weekLabel === weekLabel || p.weekNumber === n
      );
    },
    [weeklyQuery.data, weekLabel]
  );
  const dailyQuery = trpc.actionPlans.getDailyPlans.useQuery(
    { weeklyPlanId: weeklyPlan?.id, planDate },
    { enabled: !!weeklyPlan?.id }
  );
  const dailyPlan = dailyQuery.data?.[0];

  const teamSummaryQuery = trpc.actionPlans.getTeamPlanSummary.useQuery(
    { targetMonth, weekLabel },
    { enabled: !!isManager && activeTab !== "mine" }
  );
  const submissionQuery = trpc.actionPlans.getSubmissionStatus.useQuery(
    { targetMonth, weekLabel, todayDate: planDate },
    { enabled: !!isManager && activeTab === "submission" }
  );
  const previewQuery = trpc.actionPlans.getExecutiveReportPreview.useQuery(
    {
      reportMonth: targetMonth,
      reportWeekLabel: weekLabel,
      branchSummary: "",
      branchStrategy: "",
      keyRisks: "",
      supportRequest: "",
      executiveMessage: "",
    },
    { enabled: !!isBranchAdmin && activeTab === "executive" }
  );

  const [monthlyForm, setMonthlyForm] = useState(defaultMonthlyForm);
  const [weeklyForm, setWeeklyForm] = useState(defaultWeeklyForm);
  const [dailyForm, setDailyForm] = useState(defaultDailyForm);
  const [executiveForm, setExecutiveForm] = useState({
    branchSummary: "",
    branchStrategy: "",
    keyRisks: "",
    supportRequest: "",
    executiveMessage: "",
    monthlyDirection: "",
    weeklyFocus: "",
    growthMembers: "",
    coachingMembers: "",
    orgIssues: "",
  });

  useEffect(() => {
    if (!monthlyQuery.data) {
      setMonthlyForm(defaultMonthlyForm);
      return;
    }
    const m = monthlyQuery.data;
    setMonthlyForm({
      monthlyContractTarget: m.monthlyContractTarget ?? 0,
      monthlyPremiumTarget: m.monthlyPremiumTarget ?? 0,
      monthlyConsultationTarget: m.monthlyConsultationTarget ?? 0,
      monthlyCallTarget: m.monthlyCallTarget ?? 0,
      monthlyMessageTarget: m.monthlyMessageTarget ?? 0,
      monthlyFollowUpTarget: m.monthlyFollowUpTarget ?? 0,
      monthlyRevenueTarget: m.monthlyRevenueTarget ?? m.monthlyPremiumTarget ?? 0,
      monthlyNewConsultationTarget: m.monthlyNewConsultationTarget ?? 0,
      monthlyContactTarget: m.monthlyContactTarget ?? m.monthlyCallTarget ?? 0,
      monthlyAnalysisTarget: m.monthlyAnalysisTarget ?? 0,
      monthlyProposalTarget: m.monthlyProposalTarget ?? 0,
      monthlyIntroductionRequestTarget: m.monthlyIntroductionRequestTarget ?? 0,
      focusCustomerGroup: m.focusCustomerGroup ?? "",
      primaryCustomerSegment: m.primaryCustomerSegment ?? m.focusCustomerGroup ?? "",
      monthlyStrategy: m.monthlyStrategy ?? "",
      preparationMemo: m.preparationMemo ?? "",
      monthlyPreparationStatus: m.monthlyPreparationStatus ?? "",
      expectedRisk: m.expectedRisk ?? "",
      supportRequest: m.supportRequest ?? "없음",
      complianceCheckMemo: m.complianceCheckMemo ?? "",
      privacyMinimizedConfirmed: m.privacyMinimizedConfirmed ?? false,
    });
  }, [monthlyQuery.data]);

  useEffect(() => {
    if (!weeklyPlan) {
      setWeeklyForm(defaultWeeklyForm);
      return;
    }
    setWeeklyForm({
      weeklyContractTarget: weeklyPlan.weeklyContractTarget ?? 0,
      weeklyPremiumTarget: weeklyPlan.weeklyPremiumTarget ?? 0,
      weeklyConsultationTarget: weeklyPlan.weeklyConsultationTarget ?? 0,
      weeklyCallTarget: weeklyPlan.weeklyCallTarget ?? 0,
      weeklyMessageTarget: weeklyPlan.weeklyMessageTarget ?? 0,
      weeklyVisitTarget: weeklyPlan.weeklyVisitTarget ?? 0,
      weeklyProposalTarget: weeklyPlan.weeklyProposalTarget ?? 0,
      weeklyFollowUpTarget: weeklyPlan.weeklyFollowUpTarget ?? 0,
      weeklyRevenueTarget: weeklyPlan.weeklyRevenueTarget ?? weeklyPlan.weeklyPremiumTarget ?? 0,
      weeklyAnalysisTarget: weeklyPlan.weeklyAnalysisTarget ?? 0,
      weeklyIntroductionRequestTarget: weeklyPlan.weeklyIntroductionRequestTarget ?? 0,
      weeklyReconnectTarget: weeklyPlan.weeklyReconnectTarget ?? 0,
      focusCustomerGroup: weeklyPlan.focusCustomerGroup ?? "",
      targetCustomerSegment: weeklyPlan.targetCustomerSegment ?? weeklyPlan.focusCustomerGroup ?? "",
      targetCustomerReference: weeklyPlan.targetCustomerReference ?? "",
      customerStage: weeklyPlan.customerStage ?? "",
      proposedProductCategory: weeklyPlan.proposedProductCategory ?? "",
      proposedCoverageArea: weeklyPlan.proposedCoverageArea ?? "",
      proposalPurpose: weeklyPlan.proposalPurpose ?? "",
      preparationMaterials: weeklyPlan.preparationMaterials ?? "",
      weeklyActionPlan: weeklyPlan.weeklyActionPlan ?? "",
      preparationMemo: weeklyPlan.preparationMemo ?? "",
      expectedRisk: weeklyPlan.expectedRisk ?? "",
      supportRequest: weeklyPlan.supportRequest ?? "없음",
      complianceRiskCheck: weeklyPlan.complianceRiskCheck ?? "",
      weeklyReviewMemo: weeklyPlan.weeklyReviewMemo ?? "",
      nextWeekImprovement: weeklyPlan.nextWeekImprovement ?? "",
      coachingRequest: weeklyPlan.coachingRequest ?? "",
      privacyMinimizedConfirmed: weeklyPlan.privacyMinimizedConfirmed ?? false,
    });
  }, [weeklyPlan]);

  useEffect(() => {
    if (!dailyPlan) {
      setDailyForm(defaultDailyForm);
      return;
    }
    setDailyForm({
      callTarget: dailyPlan.callTarget ?? 0,
      messageTarget: dailyPlan.messageTarget ?? 0,
      consultationTarget: dailyPlan.consultationTarget ?? 0,
      visitTarget: dailyPlan.visitTarget ?? 0,
      proposalTarget: dailyPlan.proposalTarget ?? 0,
      followUpTarget: dailyPlan.followUpTarget ?? 0,
      dailyRevenueTarget: dailyPlan.dailyRevenueTarget ?? 0,
      newContactTarget: dailyPlan.newContactTarget ?? dailyPlan.callTarget ?? 0,
      analysisTarget: dailyPlan.analysisTarget ?? 0,
      introductionRequestTarget: dailyPlan.introductionRequestTarget ?? 0,
      reconnectTarget: dailyPlan.reconnectTarget ?? dailyPlan.followUpTarget ?? 0,
      contractTarget: dailyPlan.contractTarget ?? 0,
      targetCustomerSegment: dailyPlan.targetCustomerSegment ?? "",
      targetCustomerReference: dailyPlan.targetCustomerReference ?? "",
      customerStage: dailyPlan.customerStage ?? "",
      proposedProductCategory: dailyPlan.proposedProductCategory ?? "",
      proposedCoverageArea: dailyPlan.proposedCoverageArea ?? "",
      proposalPurpose: dailyPlan.proposalPurpose ?? "",
      preparationMaterials: dailyPlan.preparationMaterials ?? "",
      todayPriority: dailyPlan.todayPriority ?? "",
      preparationMemo: dailyPlan.preparationMemo ?? "",
      actualCallCount: dailyPlan.actualCallCount ?? 0,
      actualMessageCount: dailyPlan.actualMessageCount ?? 0,
      actualConsultationCount: dailyPlan.actualConsultationCount ?? 0,
      actualVisitCount: dailyPlan.actualVisitCount ?? 0,
      actualProposalCount: dailyPlan.actualProposalCount ?? 0,
      actualFollowUpCount: dailyPlan.actualFollowUpCount ?? 0,
      actualNewContactCount: dailyPlan.actualNewContactCount ?? dailyPlan.actualCallCount ?? 0,
      actualAnalysisCount: dailyPlan.actualAnalysisCount ?? 0,
      actualIntroductionRequestCount: dailyPlan.actualIntroductionRequestCount ?? 0,
      actualReconnectCount: dailyPlan.actualReconnectCount ?? dailyPlan.actualFollowUpCount ?? 0,
      actualContractCount: dailyPlan.actualContractCount ?? 0,
      actualResultMemo: dailyPlan.actualResultMemo ?? "",
      nextDayMemo: dailyPlan.nextDayMemo ?? "",
      complianceRiskCheck: dailyPlan.complianceRiskCheck ?? "",
      privacyMinimizedConfirmed: dailyPlan.privacyMinimizedConfirmed ?? false,
    });
  }, [dailyPlan]);

  const monthlyEditable =
    !monthlyQuery.data ||
    isActionPlanEditable(monthlyQuery.data.status as any);
  const weeklyEditable =
    !weeklyPlan || isActionPlanEditable(weeklyPlan.status as any);
  const dailyEditable =
    !dailyPlan || isActionPlanEditable(dailyPlan.status as any);

  const refetchMine = async () => {
    await monthlyQuery.refetch();
    await weeklyQuery.refetch();
    await dailyQuery.refetch();
  };

  const onError = (e: unknown) =>
    toastUserFacingError(e, USER_FACING_ERRORS.saveFailed);

  const createMonthly = trpc.actionPlans.createMonthlyPlan.useMutation({
    onSuccess: async () => {
      toast.success("월간 계획을 저장했습니다.");
      await refetchMine();
    },
    onError,
  });
  const updateMonthly = trpc.actionPlans.updateMonthlyPlan.useMutation({
    onSuccess: async () => {
      toast.success("월간 계획을 수정했습니다.");
      await refetchMine();
    },
    onError,
  });
  const submitMonthly = trpc.actionPlans.submitMonthlyPlan.useMutation({
    onSuccess: async () => {
      toast.success("월간 계획을 제출했습니다.");
      await refetchMine();
    },
    onError,
  });
  const createWeekly = trpc.actionPlans.createWeeklyPlan.useMutation({
    onSuccess: async () => {
      toast.success("주간 계획을 저장했습니다.");
      await refetchMine();
    },
    onError,
  });
  const updateWeekly = trpc.actionPlans.updateWeeklyPlan.useMutation({
    onSuccess: async () => {
      toast.success("주간 계획을 수정했습니다.");
      await refetchMine();
    },
    onError,
  });
  const submitWeekly = trpc.actionPlans.submitWeeklyPlan.useMutation({
    onSuccess: async () => {
      toast.success("주간 계획을 제출했습니다.");
      await refetchMine();
    },
    onError,
  });
  const createDaily = trpc.actionPlans.createDailyPlan.useMutation({
    onSuccess: async () => {
      toast.success("일일 계획을 저장했습니다.");
      await refetchMine();
    },
    onError,
  });
  const updateDaily = trpc.actionPlans.updateDailyPlan.useMutation({
    onSuccess: async () => {
      toast.success("일일 계획을 수정했습니다.");
      await refetchMine();
    },
    onError,
  });
  const submitDaily = trpc.actionPlans.submitDailyPlan.useMutation({
    onSuccess: async () => {
      toast.success("일일 계획을 제출했습니다.");
      await refetchMine();
    },
    onError,
  });
  const reviewMonthly = trpc.actionPlans.reviewMonthlyPlan.useMutation({
    onSuccess: async () => {
      toast.success("리뷰를 완료했습니다.");
      setSelectedPlanId(null);
      setFeedbackComment("");
      await teamSummaryQuery.refetch();
    },
    onError,
  });
  const revisionMonthly = trpc.actionPlans.requestMonthlyRevision.useMutation({
    onSuccess: async () => {
      toast.success("수정 요청을 전달했습니다.");
      setSelectedPlanId(null);
      setFeedbackComment("");
      await teamSummaryQuery.refetch();
    },
    onError,
  });
  const downloadReport = trpc.actionPlans.downloadExecutiveReportXlsx.useMutation({
    onSuccess: result => {
      const blob = Uint8Array.from(atob(result.contentBase64), c =>
        c.charCodeAt(0)
      );
      const url = URL.createObjectURL(
        new Blob([blob], { type: result.mimeType })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("대표 보고서를 다운로드했습니다.");
      setShowDownloadDialog(false);
      setDownloadReason("");
    },
    onError,
  });

  const saveMonthly = () => {
    const payload = { targetMonth, ...monthlyForm };
    if (monthlyQuery.data?.id) {
      updateMonthly.mutate({ id: monthlyQuery.data.id, ...payload });
    } else {
      createMonthly.mutate(payload);
    }
  };

  const saveWeekly = () => {
    if (!monthlyQuery.data?.id) {
      toast.error("먼저 월간 계획을 저장해 주세요.");
      return;
    }
    const payload = {
      monthlyPlanId: monthlyQuery.data.id,
      weekNumber: weekLabelToNumber(weekLabel),
      weekLabel,
      weekStartDate: weekRange.weekStartDate,
      weekEndDate: weekRange.weekEndDate,
      ...weeklyForm,
    };
    if (weeklyPlan?.id) {
      updateWeekly.mutate({ id: weeklyPlan.id, ...payload });
    } else {
      createWeekly.mutate(payload);
    }
  };

  const saveDaily = () => {
    if (!weeklyPlan?.id) {
      toast.error("먼저 주간 계획을 저장해 주세요.");
      return;
    }
    const payload = { weeklyPlanId: weeklyPlan.id, planDate, ...dailyForm };
    if (dailyPlan?.id) {
      updateDaily.mutate({ id: dailyPlan.id, ...payload });
    } else {
      createDaily.mutate(payload);
    }
  };

  const teamRows = useMemo(
    () => teamSummaryQuery.data ?? [],
    [teamSummaryQuery.data]
  );

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold md:text-2xl">
              지점원 실행계획 관리
            </h1>
            <p className="text-sm text-muted-foreground">
              월간·주간·일일 실행계획 작성, 취합, 피드백, 대표 보고
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="month"
              value={targetMonth}
              onChange={e => setTargetMonth(e.target.value)}
              className="w-[160px] min-h-11"
            />
            <Select value={weekLabel} onValueChange={setWeekLabel}>
              <SelectTrigger className="w-[120px] min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1주차", "2주차", "3주차", "4주차", "5주차"].map(w => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="mine">내 실행계획</TabsTrigger>
            {isManager && (
              <TabsTrigger value="team">팀원 계획 취합</TabsTrigger>
            )}
            {isManager && (
              <TabsTrigger value="submission">제출 현황</TabsTrigger>
            )}
            {isManager && (
              <TabsTrigger value="feedback">지점장 피드백</TabsTrigger>
            )}
            {isBranchAdmin && (
              <TabsTrigger value="executive">대표 보고서 생성</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mine" className="space-y-4">
            <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
              {ACTION_PLAN_PR21_NOTICE}
            </p>
            <Accordion
              type="multiple"
              defaultValue={["monthly", "weekly", "daily"]}
              className="space-y-3"
            >
              <AccordionItem value="monthly" className="border rounded-lg px-3">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                    <span className="flex items-center gap-2 font-medium">
                      <ClipboardList className="h-4 w-4" />
                      월간 실행계획 · {targetMonth}
                    </span>
                    {statusBadge(monthlyQuery.data?.status)}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {monthlyQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground md:col-span-2">
                        불러오는 중…
                      </p>
                    ) : (
                      <>
                        <NumberField
                          label="신규 계약 목표"
                          value={monthlyForm.monthlyContractTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({
                              ...f,
                              monthlyContractTarget: v,
                            }))
                          }
                        />
                        <NumberField
                          label="월납보험료 목표(원)"
                          value={monthlyForm.monthlyPremiumTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({
                              ...f,
                              monthlyPremiumTarget: v,
                            }))
                          }
                        />
                        <NumberField
                          label="상담 목표"
                          value={monthlyForm.monthlyConsultationTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({
                              ...f,
                              monthlyConsultationTarget: v,
                            }))
                          }
                        />
                        <NumberField
                          label="전화 목표"
                          value={monthlyForm.monthlyCallTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({ ...f, monthlyCallTarget: v }))
                          }
                        />
                        <NumberField
                          label="카톡 목표"
                          value={monthlyForm.monthlyMessageTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({
                              ...f,
                              monthlyMessageTarget: v,
                            }))
                          }
                        />
                        <NumberField
                          label="후속관리 목표"
                          value={monthlyForm.monthlyFollowUpTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({
                              ...f,
                              monthlyFollowUpTarget: v,
                            }))
                          }
                        />
                        <div className="md:col-span-2">
                          <TextAreaField
                            label="주력 고객군"
                            placeholder="예: 신규 DB, 기존 고객 재접촉"
                            value={monthlyForm.focusCustomerGroup}
                            disabled={!monthlyEditable}
                            onChange={v =>
                              setMonthlyForm(f => ({
                                ...f,
                                focusCustomerGroup: v,
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <TextAreaField
                            label="핵심 활동전략"
                            value={monthlyForm.monthlyStrategy}
                            disabled={!monthlyEditable}
                            onChange={v =>
                              setMonthlyForm(f => ({
                                ...f,
                                monthlyStrategy: v,
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <TextAreaField
                            label="준비사항"
                            value={monthlyForm.preparationMemo}
                            disabled={!monthlyEditable}
                            onChange={v =>
                              setMonthlyForm(f => ({
                                ...f,
                                preparationMemo: v,
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <TextAreaField
                            label="예상 리스크"
                            value={monthlyForm.expectedRisk}
                            disabled={!monthlyEditable}
                            onChange={v =>
                              setMonthlyForm(f => ({ ...f, expectedRisk: v }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <SelectField
                            label="지점장 지원 요청"
                            options={PR21_SELECT_OPTIONS.supportRequest}
                            value={monthlyForm.supportRequest}
                            disabled={!monthlyEditable}
                            onChange={v =>
                              setMonthlyForm(f => ({ ...f, supportRequest: v }))
                            }
                          />
                        </div>
                        <NumberField
                          label="월 목표 매출(원)"
                          value={monthlyForm.monthlyRevenueTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({ ...f, monthlyRevenueTarget: v }))
                          }
                        />
                        <NumberField
                          label="월 목표 보장분석"
                          value={monthlyForm.monthlyAnalysisTarget}
                          disabled={!monthlyEditable}
                          onChange={v =>
                            setMonthlyForm(f => ({ ...f, monthlyAnalysisTarget: v }))
                          }
                        />
                        <div className="md:col-span-2">
                          <TextAreaField
                            label="이번 달 주력 고객군"
                            value={monthlyForm.primaryCustomerSegment}
                            disabled={!monthlyEditable}
                            onChange={v =>
                              setMonthlyForm(f => ({
                                ...f,
                                primaryCustomerSegment: v,
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <PrivacyConfirmField
                            checked={monthlyForm.privacyMinimizedConfirmed}
                            disabled={!monthlyEditable}
                            onChange={v =>
                              setMonthlyForm(f => ({
                                ...f,
                                privacyMinimizedConfirmed: v,
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2 flex flex-wrap gap-2">
                          <Button
                            className="min-h-11"
                            onClick={saveMonthly}
                            disabled={
                              !monthlyEditable ||
                              createMonthly.isPending ||
                              updateMonthly.isPending
                            }
                          >
                            {monthlyQuery.data ? "임시저장" : "작성 시작"}
                          </Button>
                          {monthlyQuery.data && monthlyEditable && (
                            <Button
                              className="min-h-11"
                              onClick={() =>
                                submitMonthly.mutate({
                                  id: monthlyQuery.data!.id,
                                })
                              }
                              disabled={submitMonthly.isPending}
                            >
                              제출
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="weekly" className="border rounded-lg px-3">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                    <span className="font-medium">
                      주간 실행계획 · {weekLabel}
                    </span>
                    {statusBadge(weeklyPlan?.status)}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    기간: {weekRange.weekStartDate} ~ {weekRange.weekEndDate}
                  </p>
                  {!monthlyQuery.data?.id ? (
                    <p className="text-sm text-amber-700">
                      월간 계획을 먼저 저장해 주세요.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="주간 신규 계약 목표"
                        value={weeklyForm.weeklyContractTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            weeklyContractTarget: v,
                          }))
                        }
                      />
                      <NumberField
                        label="주간 월납보험료 목표(원)"
                        value={weeklyForm.weeklyPremiumTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            weeklyPremiumTarget: v,
                          }))
                        }
                      />
                      <NumberField
                        label="상담 예정 수"
                        value={weeklyForm.weeklyConsultationTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            weeklyConsultationTarget: v,
                          }))
                        }
                      />
                      <NumberField
                        label="전화 목표"
                        value={weeklyForm.weeklyCallTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({ ...f, weeklyCallTarget: v }))
                        }
                      />
                      <NumberField
                        label="카톡 목표"
                        value={weeklyForm.weeklyMessageTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            weeklyMessageTarget: v,
                          }))
                        }
                      />
                      <NumberField
                        label="방문 목표"
                        value={weeklyForm.weeklyVisitTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({ ...f, weeklyVisitTarget: v }))
                        }
                      />
                      <NumberField
                        label="제안서 목표"
                        value={weeklyForm.weeklyProposalTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            weeklyProposalTarget: v,
                          }))
                        }
                      />
                      <NumberField
                        label="후속관리 목표"
                        value={weeklyForm.weeklyFollowUpTarget}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            weeklyFollowUpTarget: v,
                          }))
                        }
                      />
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="주력 고객군"
                          value={weeklyForm.focusCustomerGroup}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              focusCustomerGroup: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="핵심 실행계획"
                          value={weeklyForm.weeklyActionPlan}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              weeklyActionPlan: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="준비사항"
                          value={weeklyForm.preparationMemo}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              preparationMemo: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="이번 주 만날 고객군"
                          value={weeklyForm.targetCustomerSegment}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              targetCustomerSegment: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="핵심 고객/DB (코드·이니셜·고객군)"
                          placeholder="예: A-102, K고객"
                          value={weeklyForm.targetCustomerReference}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              targetCustomerReference: v,
                            }))
                          }
                        />
                      </div>
                      <SelectField
                        label="고객 단계"
                        options={PR21_SELECT_OPTIONS.customerStage}
                        value={weeklyForm.customerStage}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({ ...f, customerStage: v }))
                        }
                      />
                      <SelectField
                        label="제안 준비 상품군"
                        options={PR21_SELECT_OPTIONS.productCategory}
                        value={weeklyForm.proposedProductCategory}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            proposedProductCategory: v,
                          }))
                        }
                      />
                      <SelectField
                        label="제안 준비 보장영역"
                        options={PR21_SELECT_OPTIONS.coverageArea}
                        value={weeklyForm.proposedCoverageArea}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({
                            ...f,
                            proposedCoverageArea: v,
                          }))
                        }
                      />
                      <SelectField
                        label="예상 장애요인"
                        options={PR21_SELECT_OPTIONS.expectedBarrier}
                        value={weeklyForm.expectedRisk}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({ ...f, expectedRisk: v }))
                        }
                      />
                      <SelectField
                        label="지점장 지원 요청"
                        options={PR21_SELECT_OPTIONS.supportRequest}
                        value={weeklyForm.supportRequest}
                        disabled={!weeklyEditable}
                        onChange={v =>
                          setWeeklyForm(f => ({ ...f, supportRequest: v }))
                        }
                      />
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="주간 복기"
                          value={weeklyForm.weeklyReviewMemo}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              weeklyReviewMemo: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="코칭 요청"
                          value={weeklyForm.coachingRequest}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              coachingRequest: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <PrivacyConfirmField
                          checked={weeklyForm.privacyMinimizedConfirmed}
                          disabled={!weeklyEditable}
                          onChange={v =>
                            setWeeklyForm(f => ({
                              ...f,
                              privacyMinimizedConfirmed: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex flex-wrap gap-2">
                        <Button
                          className="min-h-11"
                          onClick={saveWeekly}
                          disabled={
                            !weeklyEditable ||
                            createWeekly.isPending ||
                            updateWeekly.isPending
                          }
                        >
                          {weeklyPlan ? "임시저장" : "주간 계획 작성"}
                        </Button>
                        {weeklyPlan && weeklyEditable && (
                          <Button
                            className="min-h-11"
                            onClick={() =>
                              submitWeekly.mutate({ id: weeklyPlan.id })
                            }
                            disabled={submitWeekly.isPending}
                          >
                            제출
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="daily" className="border rounded-lg px-3">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                    <span className="font-medium">일일 활동계획</span>
                    {statusBadge(dailyPlan?.status)}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-4">
                  <div className="space-y-1">
                    <Label>계획 날짜</Label>
                    <Input
                      type="date"
                      className="min-h-11 max-w-xs"
                      value={planDate}
                      min={weekRange.weekStartDate}
                      max={weekRange.weekEndDate}
                      onChange={e => setPlanDate(e.target.value)}
                    />
                  </div>
                  {!weeklyPlan?.id ? (
                    <p className="text-sm text-amber-700">
                      주간 계획을 먼저 저장해 주세요.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="전화 목표"
                        value={dailyForm.callTarget}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({ ...f, callTarget: v }))
                        }
                      />
                      <NumberField
                        label="카톡 목표"
                        value={dailyForm.messageTarget}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({ ...f, messageTarget: v }))
                        }
                      />
                      <NumberField
                        label="상담 목표"
                        value={dailyForm.consultationTarget}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({
                            ...f,
                            consultationTarget: v,
                          }))
                        }
                      />
                      <NumberField
                        label="방문 목표"
                        value={dailyForm.visitTarget}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({ ...f, visitTarget: v }))
                        }
                      />
                      <NumberField
                        label="제안서 목표"
                        value={dailyForm.proposalTarget}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({ ...f, proposalTarget: v }))
                        }
                      />
                      <NumberField
                        label="후속관리 목표"
                        value={dailyForm.followUpTarget}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({ ...f, followUpTarget: v }))
                        }
                      />
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="오늘 우선순위"
                          value={dailyForm.todayPriority}
                          disabled={!dailyEditable}
                          onChange={v =>
                            setDailyForm(f => ({ ...f, todayPriority: v }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="준비사항"
                          value={dailyForm.preparationMemo}
                          disabled={!dailyEditable}
                          onChange={v =>
                            setDailyForm(f => ({
                              ...f,
                              preparationMemo: v,
                            }))
                          }
                        />
                      </div>
                      <p className="md:col-span-2 text-sm font-medium text-muted-foreground">
                        마감 회고 (실적)
                      </p>
                      <NumberField
                        label="실제 전화"
                        value={dailyForm.actualCallCount}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({ ...f, actualCallCount: v }))
                        }
                      />
                      <NumberField
                        label="실제 카톡"
                        value={dailyForm.actualMessageCount}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({
                            ...f,
                            actualMessageCount: v,
                          }))
                        }
                      />
                      <NumberField
                        label="실제 상담"
                        value={dailyForm.actualConsultationCount}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({
                            ...f,
                            actualConsultationCount: v,
                          }))
                        }
                      />
                      <NumberField
                        label="실제 방문"
                        value={dailyForm.actualVisitCount}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({ ...f, actualVisitCount: v }))
                        }
                      />
                      <NumberField
                        label="실제 제안서"
                        value={dailyForm.actualProposalCount}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({
                            ...f,
                            actualProposalCount: v,
                          }))
                        }
                      />
                      <NumberField
                        label="실제 후속관리"
                        value={dailyForm.actualFollowUpCount}
                        disabled={!dailyEditable}
                        onChange={v =>
                          setDailyForm(f => ({
                            ...f,
                            actualFollowUpCount: v,
                          }))
                        }
                      />
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="오늘 결과/복기"
                          value={dailyForm.actualResultMemo}
                          disabled={!dailyEditable}
                          onChange={v =>
                            setDailyForm(f => ({
                              ...f,
                              actualResultMemo: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="내일 이어갈 일"
                          value={dailyForm.nextDayMemo}
                          disabled={!dailyEditable}
                          onChange={v =>
                            setDailyForm(f => ({ ...f, nextDayMemo: v }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <PrivacyConfirmField
                          checked={dailyForm.privacyMinimizedConfirmed}
                          disabled={!dailyEditable}
                          onChange={v =>
                            setDailyForm(f => ({
                              ...f,
                              privacyMinimizedConfirmed: v,
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex flex-wrap gap-2">
                        <Button
                          className="min-h-11"
                          onClick={saveDaily}
                          disabled={
                            !dailyEditable ||
                            createDaily.isPending ||
                            updateDaily.isPending
                          }
                        >
                          {dailyPlan ? "임시저장" : "일일 계획 작성"}
                        </Button>
                        {dailyPlan && dailyEditable && (
                          <Button
                            className="min-h-11"
                            onClick={() =>
                              submitDaily.mutate({ id: dailyPlan.id })
                            }
                            disabled={submitDaily.isPending}
                          >
                            제출
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {isManager && (
            <TabsContent value="team" className="space-y-3">
              {teamSummaryQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">불러오는 중…</p>
              ) : teamRows.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="표시할 계획이 없습니다"
                  description="해당 월·주차에 제출된 계획이 없습니다."
                />
              ) : (
                teamRows.map((row: any) => (
                  <Card key={row.user.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          {row.user.name} · {getRoleLabel(row.user.role)}
                        </CardTitle>
                        {statusBadge(row.monthly?.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p>
                        계약 목표: {row.monthly?.monthlyContractTarget ?? 0} ·
                        상담 목표: {row.monthly?.monthlyConsultationTarget ?? 0}
                      </p>
                      <p className="text-muted-foreground line-clamp-2">
                        {row.monthly?.monthlyStrategy || "전략 미입력"}
                      </p>
                      <p className="text-muted-foreground">
                        도움 요청: {row.monthly?.supportRequest || "-"}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          )}

          {isManager && (
            <TabsContent value="submission">
              {submissionQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">불러오는 중…</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">월간 제출률</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {submissionQuery.data?.totals.monthlySubmittedRate ?? 0}%
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">주간 제출률</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {submissionQuery.data?.totals.weeklySubmittedRate ?? 0}%
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        오늘 일일 제출률
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {submissionQuery.data?.totals.dailySubmittedRateToday ?? 0}
                      %
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-3">
                    <CardHeader>
                      <CardTitle className="text-base">목표 미등록자</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {(
                        submissionQuery.data?.dashboard?.goalNotRegistered ?? []
                      ).map(u => (
                        <Badge key={u.id} variant="destructive">
                          {u.name}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-3">
                    <CardHeader>
                      <CardTitle className="text-base">
                        오늘 계획/결과 누락 · 코칭 요청
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>
                        계획 누락:{" "}
                        {(
                          submissionQuery.data?.dashboard?.todayPlanMissing ?? []
                        )
                          .map(u => u.name)
                          .join(", ") || "없음"}
                      </p>
                      <p>
                        결과 누락:{" "}
                        {(
                          submissionQuery.data?.dashboard?.todayResultMissing ??
                          []
                        )
                          .map(u => u.name)
                          .join(", ") || "없음"}
                      </p>
                      <p>
                        코칭 요청:{" "}
                        {(
                          submissionQuery.data?.dashboard?.coachingRequestUsers ??
                          []
                        )
                          .map(u => u.name)
                          .join(", ") || "없음"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-3">
                    <CardHeader>
                      <CardTitle className="text-base">미제출자</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {(submissionQuery.data?.notSubmitted ?? []).map(u => (
                        <Badge key={u.id} variant="outline">
                          {u.name} ({getRoleLabel(u.role)})
                        </Badge>
                      ))}
                      {(submissionQuery.data?.notSubmitted ?? []).length ===
                        0 && (
                        <span className="text-sm text-muted-foreground">
                          없음
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          )}

          {isManager && (
            <TabsContent value="feedback" className="space-y-3">
              {teamRows.map((row: any) => (
                <Card key={row.user.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {row.user.name} · {getRoleLabel(row.user.role)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {row.monthly?.monthlyStrategy || "계획 없음"}
                    </p>
                    {row.monthly?.id && (
                      <>
                        <Textarea
                          placeholder="피드백 코멘트"
                          value={
                            selectedPlanId === row.monthly.id
                              ? feedbackComment
                              : ""
                          }
                          onFocus={() => {
                            setSelectedPlanId(row.monthly.id);
                            setFeedbackComment(row.monthly.managerComment ?? "");
                          }}
                          onChange={e => setFeedbackComment(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="min-h-10"
                            onClick={() =>
                              reviewMonthly.mutate({
                                id: row.monthly.id,
                                managerComment: feedbackComment,
                              })
                            }
                          >
                            리뷰 완료
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-10"
                            onClick={() =>
                              revisionMonthly.mutate({
                                id: row.monthly.id,
                                managerComment: feedbackComment,
                              })
                            }
                          >
                            수정 요청
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}

          {isBranchAdmin && (
            <TabsContent value="executive" className="space-y-4">
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="pt-4 text-sm text-amber-900">
                  {ACTION_PLAN_SENSITIVE_INPUT_NOTICE}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>지점장 종합 의견</CardTitle>
                  <CardDescription>
                    대표 보고용 XLSX에 반영됩니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <TextAreaField
                    label="지점 운영 방향"
                    value={executiveForm.branchSummary}
                    onChange={v =>
                      setExecutiveForm(f => ({ ...f, branchSummary: v }))
                    }
                  />
                  <TextAreaField
                    label="핵심 전략"
                    value={executiveForm.branchStrategy}
                    onChange={v =>
                      setExecutiveForm(f => ({ ...f, branchStrategy: v }))
                    }
                  />
                  <TextAreaField
                    label="주요 리스크"
                    value={executiveForm.keyRisks}
                    onChange={v =>
                      setExecutiveForm(f => ({ ...f, keyRisks: v }))
                    }
                  />
                  <TextAreaField
                    label="대표 요청사항"
                    value={executiveForm.supportRequest}
                    onChange={v =>
                      setExecutiveForm(f => ({ ...f, supportRequest: v }))
                    }
                  />
                  <TextAreaField
                    label="종합 메시지"
                    value={executiveForm.executiveMessage}
                    onChange={v =>
                      setExecutiveForm(f => ({ ...f, executiveMessage: v }))
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>미리보기</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {previewQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">불러오는 중…</p>
                  ) : (
                    <>
                      <p>대상 인원: {previewQuery.data?.userCount ?? 0}명</p>
                      <p>
                        월간 계획: {previewQuery.data?.monthlyPlanCount ?? 0}건
                      </p>
                      <p>
                        주간 계획: {previewQuery.data?.weeklyPlanCount ?? 0}건
                      </p>
                      <p>
                        일일 계획: {previewQuery.data?.dailyPlanCount ?? 0}건
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Button className="min-h-11" onClick={() => setShowDownloadDialog(true)}>
                <Download className="mr-2 h-4 w-4" />
                XLSX 다운로드
              </Button>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>다운로드 사유 입력</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            사유에 고객 식별정보(이름, 연락처, 질병, 상품명 등)를 포함하지
            마세요.
          </p>
          <div className="space-y-2">
            <Label>사유 (5자 이상 필수)</Label>
            <Textarea
              value={downloadReason}
              onChange={e => setDownloadReason(e.target.value)}
              placeholder="대표 보고 목적, 회의 일정 등"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setShowDownloadDialog(false)}
            >
              취소
            </Button>
            <Button
              className="min-h-11"
              disabled={
                downloadReason.trim().length < 5 || downloadReport.isPending
              }
              onClick={() =>
                downloadReport.mutate({
                  reportMonth: targetMonth,
                  reportWeekLabel: weekLabel,
                  downloadReason: downloadReason.trim(),
                  ...executiveForm,
                })
              }
            >
              {downloadReport.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              다운로드
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
