import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, CONSULT_STATUSES } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Phone, Plus, UserCog, AlertTriangle, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CUSTOMER_PRIORITIES = ["A", "B", "C", "D", "unclassified"] as const;
const CONSULTATION_TYPES = ["전화", "카톡", "문자", "방문", "소개", "보장분석", "계약상담", "사후관리", "기타"] as const;
const CUSTOMER_NEEDS = ["보험료 부담", "보장 불안", "가족 보장", "실손/의료비", "암/뇌/심장 보장", "운전자보험", "해지 고민", "리밸런싱", "자녀 보장", "노후/간병", "기타"] as const;
const CUSTOMER_NEXT_ACTIONS = ["재연락", "설계안 발송", "보장분석 진행", "계약 진행", "추가 자료 요청", "가족과 상의", "보류", "거절", "장기관리", "사후관리"] as const;
const CUSTOMER_TAGS = ["가격민감형", "보장불안형", "가족책임형", "무관심형", "해지위험", "리밸런싱필요", "사후관리필요", "소개가능성", "고액계약가능성", "장기관리"] as const;

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

export default function CustomerDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showChangeAgentModal, setShowChangeAgentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConsultId, setEditingConsultId] = useState<number | null>(null);
  const [editingContractId, setEditingContractId] = useState<number | null>(null);
  const [requestContractId, setRequestContractId] = useState<number | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestMemo, setRequestMemo] = useState("");
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [postponeFollowUpId, setPostponeFollowUpId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: customer, refetch: refetchCustomer } = trpc.customers.get.useQuery({ id });
  const { data: consultations, refetch: refetchConsult } = trpc.consultations.list.useQuery({ customerId: id });
  const { data: contracts, refetch: refetchContracts } = trpc.contracts.listByCustomer.useQuery({ customerId: id });
  const { data: statusHistoryData } = trpc.customers.statusHistory.useQuery({ customerId: id });
  const { data: consentLogsData } = trpc.customers.consentLogs.useQuery({ customerId: id });
  const { data: assignmentHistoryData } = trpc.customers.assignmentHistory.useQuery({ customerId: id });
  const { data: followUps, refetch: refetchFollowUps } = trpc.followUps.listByCustomer.useQuery({ customerId: id });
  const { data: users } = trpc.users.list.useQuery();

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => { toast.success("고객 정보가 수정되었습니다."); setShowEditModal(false); refetchCustomer(); },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const updateMetaMutation = trpc.customers.updateManagementMeta.useMutation({
    onSuccess: () => { toast.success("고객 관리 정보가 저장되었습니다."); refetchCustomer(); utils.customers.list.invalidate(); },
    onError: (err) => toast.error(err.message || "고객 관리 정보 저장에 실패했습니다."),
  });

  const createConsultMutation = trpc.consultations.create.useMutation({
    onSuccess: () => { toast.success("상담기록이 저장되었습니다."); setShowConsultModal(false); refetchConsult(); refetchCustomer(); },
  });

  const updateConsultMutation = trpc.consultations.update.useMutation({
    onSuccess: () => { toast.success("상담기록이 수정되었습니다."); setEditingConsultId(null); refetchConsult(); refetchCustomer(); },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const createContractMutation = trpc.contracts.create.useMutation({
    onSuccess: () => { toast.success("계약이 등록되었습니다."); setShowContractModal(false); refetchContracts(); },
  });

  const updateContractMutation = trpc.contracts.update.useMutation({
    onSuccess: () => { toast.success("계약이 수정되었습니다."); setEditingContractId(null); refetchContracts(); },
    onError: () => toast.error("계약 수정에 실패했습니다."),
  });

  const deactivateContractMutation = trpc.contracts.deactivate.useMutation({
    onSuccess: () => { toast.success("계약이 삭제(비활성 처리)되었습니다."); refetchContracts(); },
    onError: (err) => toast.error(err.message || "계약 삭제에 실패했습니다."),
  });

  const requestDeleteMutation = trpc.deleteRequests.createContractDeleteRequest.useMutation({
    onSuccess: () => {
      toast.success("삭제 요청이 관리자에게 전달되었습니다.");
      setRequestContractId(null);
      setRequestReason("");
      setRequestMemo("");
      refetchContracts();
      utils.deleteRequests.listMyRequests.invalidate();
    },
    onError: (err) => toast.error(err.message || "삭제 요청에 실패했습니다."),
  });

  const changeAgentMutation = trpc.customers.changeAgent.useMutation({
    onSuccess: () => { toast.success("담당자가 변경되었습니다."); setShowChangeAgentModal(false); refetchCustomer(); },
  });

  const deactivateMutation = trpc.customers.deactivate.useMutation({
    onSuccess: () => { toast.success("고객이 비활성화되었습니다."); setLocation("/customers"); },
    onError: () => toast.error("비활성화에 실패했습니다."),
  });

  const createFollowUpMutation = trpc.followUps.create.useMutation({
    onSuccess: () => {
      toast.success("다음 연락일이 설정되었습니다.");
      setShowFollowUpModal(false);
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
    },
    onError: (err) => toast.error(err.message || "다음 연락일 설정에 실패했습니다."),
  });

  const completeFollowUpMutation = trpc.followUps.complete.useMutation({
    onSuccess: () => {
      toast.success("후속관리가 완료 처리되었습니다.");
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
    },
    onError: (err) => toast.error(err.message || "후속관리 완료 처리에 실패했습니다."),
  });

  const postponeFollowUpMutation = trpc.followUps.postpone.useMutation({
    onSuccess: () => {
      toast.success("연락일이 연기되었습니다.");
      setPostponeFollowUpId(null);
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
    },
    onError: (err) => toast.error(err.message || "연락일 연기에 실패했습니다."),
  });

  const cancelFollowUpMutation = trpc.followUps.cancel.useMutation({
    onSuccess: () => {
      toast.success("후속관리가 취소되었습니다.");
      refetchFollowUps();
      utils.dashboard.todayWork.invalidate();
    },
    onError: (err) => toast.error(err.message || "후속관리 취소에 실패했습니다."),
  });

  if (!customer) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground">로딩 중...</div>


      <Dialog open={requestContractId !== null} onOpenChange={(open) => { if (!open) setRequestContractId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>계약 삭제 요청</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              이 계약의 삭제를 관리자에게 요청합니다. 승인되면 해당 계약은 비활성 처리되며, 실적 집계에서 제외됩니다.
            </p>
            <div>
              <Label>요청 사유 *</Label>
              <Select value={requestReason} onValueChange={setRequestReason}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="사유 선택" /></SelectTrigger>
                <SelectContent>
                  {["중복 입력", "오입력", "계약 취소", "테스트 입력", "기타"].map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>상세 메모</Label>
              <Textarea value={requestMemo} onChange={(e) => setRequestMemo(e.target.value)} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRequestContractId(null)}>취소</Button>
              <Button disabled={!requestReason || requestDeleteMutation.isPending} onClick={() => requestContractId && requestDeleteMutation.mutate({ contractId: requestContractId, requestReason, requestMemo: requestMemo || undefined })}>
                삭제 요청 보내기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );

  const agentName = users?.find((u) => u.id === customer.agentId)?.name ?? "-";
  const genderLabel = customer.gender === "male" ? "남성" : customer.gender === "female" ? "여성" : customer.gender ? "기타" : "-";
  const canChangeAgent = user?.role === "branch_admin" || user?.role === "team_leader";
  const canDeactivateCustomer = user?.role === "branch_admin";
  const canDeactivateContract = user?.role === "branch_admin";
  const canRequestContractDelete = user?.role === "sub_branch_admin" || user?.role === "team_leader" || user?.role === "member";
  const editingConsult = consultations?.find((c) => c.id === editingConsultId);
  const editingContract = contracts?.find((c) => c.id === editingContractId);
  const customerTags = parseCustomerTags((customer as any).customerTags);
  const latestConsult = (consultations ?? [])[0] as any;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/customers")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 목록
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{customer.name}</h1>
              <StatusBadge status={customer.consultStatus} />
              {!customer.isActive && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">비활성</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">담당: {agentName}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {customer.phone && (
              <a href={`tel:${customer.phone}`}>
                <Button variant="outline" size="sm" className="h-8">
                  <Phone className="h-3.5 w-3.5 mr-1" /> 전화
                </Button>
              </a>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowEditModal(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-1" /> 정보 수정
            </Button>
            {canChangeAgent && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setShowChangeAgentModal(true)}>
                <UserCog className="h-3.5 w-3.5 mr-1" /> 담당자 변경
              </Button>
            )}
            {canDeactivateCustomer && customer.isActive && (
              <Button
                variant="outline" size="sm" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { if (confirm("이 고객을 삭제하시겠습니까?\n완전 삭제가 아니라 비활성 처리됩니다.\n활성 계약이나 진행 중 일정이 있으면 삭제할 수 없습니다.\n이 작업은 활동 로그에 기록됩니다.")) deactivateMutation.mutate({ id }); }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" /> 고객 삭제
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold">고객 관리 정보</p>
                <p className="text-xs text-muted-foreground">우선순위, 성향 태그, 다음 액션은 권한 범위 내에서만 수정됩니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs rounded-full border px-2 py-1 bg-muted">우선순위 {priorityLabel((customer as any).priority)}</span>
                {(customer as any).nextAction && <span className="text-xs rounded-full border px-2 py-1">다음: {(customer as any).nextAction}</span>}
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">우선순위</Label>
                <Select
                  value={(customer as any).priority ?? "unclassified"}
                  onValueChange={(priority) => updateMetaMutation.mutate({ customerId: id, priority: priority as any })}
                >
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priorityLabel(priority)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">다음 액션</Label>
                <Select
                  value={(customer as any).nextAction ?? "none"}
                  onValueChange={(nextAction) => updateMetaMutation.mutate({ customerId: id, nextAction: nextAction === "none" ? null as any : nextAction as any })}
                >
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안 함</SelectItem>
                    {CUSTOMER_NEXT_ACTIONS.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">최근 상담 요약</Label>
                <p className="text-sm mt-2 line-clamp-2">{latestConsult?.summary ?? latestConsult?.content ?? "등록된 상담 요약이 없습니다."}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs">고객 성향 태그</Label>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {CUSTOMER_TAGS.map((tag) => {
                  const selected = customerTags.includes(tag);
                  const nextTags = selected ? customerTags.filter((item) => item !== tag) : [...customerTags, tag];
                  return (
                    <Button
                      key={tag}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      disabled={updateMetaMutation.isPending}
                      onClick={() => updateMetaMutation.mutate({ customerId: id, customerTags: nextTags as any })}
                    >
                      {tag}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="info">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="info">기본정보</TabsTrigger>
            <TabsTrigger value="consult">상담기록 ({consultations?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="contract">계약정보 ({contracts?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="history">상태이력 ({statusHistoryData?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="consent">동의이력</TabsTrigger>
            <TabsTrigger value="assign_history">배정이력 ({assignmentHistoryData?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* 기본정보 */}
          <TabsContent value="info">
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { label: "이름", value: customer.name },
                    { label: "연락처", value: customer.phone ?? "-" },
                    { label: "생년월일", value: customer.birthDate ? new Date(customer.birthDate).toLocaleDateString("ko-KR") : "-" },
                    { label: "성별", value: genderLabel },
                    { label: "지역", value: customer.region ?? "-" },
                    { label: "예상보험료", value: customer.expectedPremium ? `${customer.expectedPremium.toLocaleString()}원` : "-" },
                    { label: "통화가능시간", value: customer.availableTime ?? "-" },
                    { label: "유입경로", value: customer.source ?? "-" },
                    { label: "배정일", value: customer.assignedAt ? new Date(customer.assignedAt).toLocaleDateString("ko-KR") : "-" },
                    { label: "개인정보 동의", value: customer.privacyConsent ? "✓ 동의" : "✗ 미동의" },
                    { label: "마케팅 수신 동의", value: customer.marketingConsent ? "✓ 동의" : "✗ 미동의" },
                    { label: "담당자", value: agentName },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {customer.memo && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">메모</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{customer.memo}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <FollowUpPanel
              followUps={followUps ?? []}
              onCreate={() => setShowFollowUpModal(true)}
              onComplete={(followUpId) => completeFollowUpMutation.mutate({ id: followUpId })}
              onPostpone={(followUpId) => setPostponeFollowUpId(followUpId)}
              onCancel={(followUpId) => cancelFollowUpMutation.mutate({ id: followUpId })}
              loading={completeFollowUpMutation.isPending || postponeFollowUpMutation.isPending || cancelFollowUpMutation.isPending}
            />
          </TabsContent>

          {/* 상담기록 */}
          <TabsContent value="consult">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">총 {consultations?.length ?? 0}건</p>
                <Button size="sm" onClick={() => setShowConsultModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 상담기록 추가
                </Button>
              </div>
              {(consultations ?? []).length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">상담기록이 없습니다.</CardContent></Card>
              ) : (
                (consultations ?? []).map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={c.status} />
                            {(c as any).consultationType && <span className="text-[10px] rounded-full border px-2 py-0.5">{(c as any).consultationType}</span>}
                            {(c as any).customerNeed && <span className="text-[10px] rounded-full bg-secondary px-2 py-0.5">{(c as any).customerNeed}</span>}
                            {(c as any).nextAction && <span className="text-[10px] rounded-full border px-2 py-0.5">다음: {(c as any).nextAction}</span>}
                            <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString("ko-KR")}</span>
                          </div>
                          {(c as any).summary && <p className="text-sm font-medium mb-1">{(c as any).summary}</p>}
                          <p className="text-sm whitespace-pre-wrap">{c.content ?? "(내용 없음)"}</p>
                          {c.nextContactAt && (
                            <p className="text-xs text-primary mt-2">재상담 예정: {new Date(c.nextContactAt).toLocaleString("ko-KR")}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setEditingConsultId(c.id)}>
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
                <p className="text-sm text-muted-foreground">총 {contracts?.length ?? 0}건</p>
                <Button size="sm" onClick={() => setShowContractModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 계약 등록
                </Button>
              </div>
              {(contracts ?? []).length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">계약 정보가 없습니다.</CardContent></Card>
              ) : (
                (contracts ?? []).map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><p className="text-xs text-muted-foreground">보험사</p><p className="font-medium">{c.company ?? "-"}</p></div>
                        <div><p className="text-xs text-muted-foreground">상품명</p><p className="font-medium">{c.productName ?? "-"}</p></div>
                        <div><p className="text-xs text-muted-foreground">상품군</p><p className="font-medium">{c.productGroup ?? "-"}</p></div>
                        <div><p className="text-xs text-muted-foreground">계약일</p><p className="font-medium">{c.contractDate ? new Date(c.contractDate).toLocaleDateString("ko-KR") : "-"}</p></div>
                        <div><p className="text-xs text-muted-foreground">월보험료</p><p className="font-medium">{c.monthlyPremium ? `${c.monthlyPremium.toLocaleString()}원` : "-"}</p></div>
                        <div><p className="text-xs text-muted-foreground">납입상태</p><StatusBadge status={c.paymentStatus ?? "정상"} /></div>
                        <div><p className="text-xs text-muted-foreground">계약상태</p><StatusBadge status={c.contractStatus ?? "청약"} /></div>
                      </div>
                      {c.memo && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">{c.memo}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingContractId(c.id)}>
                          <Edit2 className="h-3 w-3 mr-1" /> 수정
                        </Button>
                        {canDeactivateContract && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm("이 계약을 삭제하시겠습니까?\n완전 삭제가 아니라 비활성 처리됩니다.\n삭제된 계약은 기본 계약 목록과 실적 집계에서 제외됩니다.\n이 작업은 활동 로그에 기록됩니다.")) deactivateContractMutation.mutate({ id: c.id });
                            }}
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

          {/* 상태 변경 이력 */}
          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                {(statusHistoryData ?? []).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">상태 변경 이력이 없습니다.</div>
                ) : (
                  <div className="divide-y">
                    {(statusHistoryData ?? []).map((h) => {
                      const changedByName = users?.find((u) => u.id === h.changedBy)?.name ?? `#${h.changedBy}`;
                      return (
                        <div key={h.id} className="flex items-center gap-3 p-3 text-sm">
                          <div className="text-xs text-muted-foreground w-32 shrink-0">{new Date(h.createdAt).toLocaleString("ko-KR")}</div>
                          <div className="flex items-center gap-2 flex-1">
                            {h.previousStatus && <StatusBadge status={h.previousStatus} />}
                            <span className="text-muted-foreground">→</span>
                            <StatusBadge status={h.newStatus} />
                          </div>
                          <div className="text-xs text-muted-foreground">{changedByName}</div>
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
                  <div className="py-8 text-center text-muted-foreground text-sm">배정 이력이 없습니다.</div>
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
                        {(assignmentHistoryData ?? []).map((h) => {
                          const typeLabels: Record<string, string> = {
                            branch_to_sub_branch: "지점장 → 부지점장 배분",
                            sub_branch_to_agent: "부지점장 → 산하 조직원 배정",
                            branch_to_agent: "지점장 직접 배정",
                            reassignment: "담당자 재배정",
                          };
                          const prevSubAdmin = users?.find((u) => u.id === h.previousSubBranchAdminId)?.name ?? "-";
                          const newSubAdmin = users?.find((u) => u.id === (h as any).newSubBranchAdminId)?.name ?? "-";
                          const prevAgent = users?.find((u) => u.id === h.previousAgentId)?.name ?? "-";
                          const newAgent = users?.find((u) => u.id === h.newAgentId)?.name ?? "-";
                          const assignedByName = users?.find((u) => u.id === h.assignedBy)?.name ?? "-";
                          return (
                            <tr key={h.id}>
                              <td className="p-3 text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("ko-KR")}</td>
                              <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{typeLabels[(h as any).assignmentType ?? ""] ?? (h as any).assignmentType ?? "-"}</span></td>
                              <td className="p-3 text-xs">{prevSubAdmin}</td>
                              <td className="p-3 text-xs">{newSubAdmin}</td>
                              <td className="p-3 text-xs">{prevAgent}</td>
                              <td className="p-3 text-xs font-medium">{newAgent}</td>
                              <td className="p-3 text-xs text-muted-foreground">{assignedByName}</td>
                              <td className="p-3 text-xs text-muted-foreground">{(h as any).assignmentReason ?? "-"}</td>
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
                  <div className="py-8 text-center text-muted-foreground text-sm">동의 변경 이력이 없습니다.</div>
                ) : (
                  <div className="divide-y">
                    {(consentLogsData ?? []).map((l) => {
                      const changedByName = users?.find((u) => u.id === l.changedBy)?.name ?? `#${l.changedBy}`;
                      return (
                        <div key={l.id} className="flex items-center gap-3 p-3 text-sm">
                          <div className="text-xs text-muted-foreground w-32 shrink-0">{new Date(l.createdAt).toLocaleString("ko-KR")}</div>
                          <div className="flex-1">
                            <span className="font-medium">{l.consentType === "privacy" ? "개인정보 동의" : "마케팅 수신 동의"}</span>
                            <span className="text-muted-foreground ml-2">{l.previousValue ? "동의" : "미동의"} → {l.newValue ? "동의" : "미동의"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{changedByName}</div>
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

      {/* 고객 정보 수정 모달 */}
      {showEditModal && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSubmit={(data) => updateMutation.mutate({ id, ...data })}
          loading={updateMutation.isPending}
        />
      )}

      {/* 상담기록 추가 모달 */}
      <ConsultModal
        open={showConsultModal}
        onClose={() => setShowConsultModal(false)}
        onSubmit={(data) => createConsultMutation.mutate({ ...data, customerId: id })}
        loading={createConsultMutation.isPending}
        currentStatus={customer.consultStatus}
      />

      {/* 상담기록 수정 모달 */}
      {editingConsultId && editingConsult && (
        <EditConsultModal
          consult={editingConsult}
          onClose={() => setEditingConsultId(null)}
          onSubmit={(data) => updateConsultMutation.mutate({ id: editingConsultId, ...data })}
          loading={updateConsultMutation.isPending}
        />
      )}

      {/* 계약 등록 모달 */}
      <ContractModal
        open={showContractModal}
        onClose={() => setShowContractModal(false)}
        onSubmit={(data) => createContractMutation.mutate({ ...data, customerId: id })}
        loading={createContractMutation.isPending}
        customerAgentId={customer.agentId}
        currentUserRole={user?.role}
      />

      {editingContractId && editingContract && (
        <ContractModal
          open={true}
          contract={editingContract}
          onClose={() => setEditingContractId(null)}
          onSubmit={(data) => updateContractMutation.mutate({ id: editingContractId, ...data })}
          loading={updateContractMutation.isPending}
          customerAgentId={customer.agentId}
          currentUserRole={user?.role}
        />
      )}

      {/* 담당자 변경 모달 */}
      <FollowUpModal
        open={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        onSubmit={(data) => createFollowUpMutation.mutate({ customerId: id, ...data })}
        loading={createFollowUpMutation.isPending}
      />

      <FollowUpModal
        open={postponeFollowUpId !== null}
        mode="postpone"
        onClose={() => setPostponeFollowUpId(null)}
        onSubmit={(data) => postponeFollowUpId && postponeFollowUpMutation.mutate({ id: postponeFollowUpId, nextContactDate: data.nextContactDate, reason: data.reason })}
        loading={postponeFollowUpMutation.isPending}
      />

      {showChangeAgentModal && (
        <Dialog open={true} onOpenChange={() => setShowChangeAgentModal(false)}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto">
            <DialogHeader><DialogTitle>담당자 변경 - {customer.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">현재 담당자: <strong>{agentName}</strong></p>
              <Select onValueChange={(v) => changeAgentMutation.mutate({ customerId: id, newAgentId: Number(v) })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="새 담당자 선택" /></SelectTrigger>
                <SelectContent>
                  {(users ?? []).filter((u) => ((u as any).accountStatus === "active") && u.id !== customer.agentId).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.role === "team_leader" ? "팀장" : "팀원"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowChangeAgentModal(false)}>취소</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

// ─── 고객 정보 수정 모달 ──────────────────────────────────────────────────────
function FollowUpPanel({ followUps, onCreate, onComplete, onPostpone, onCancel, loading }: {
  followUps: any[];
  onCreate: () => void;
  onComplete: (id: number) => void;
  onPostpone: (id: number) => void;
  onCancel: (id: number) => void;
  loading: boolean;
}) {
  const openItems = followUps.filter((item) => item.status === "scheduled" || item.status === "postponed");
  return (
    <Card className="mt-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">다음 연락일 / 후속관리</p>
            <p className="text-xs text-muted-foreground">민감정보는 후속관리 메모에 입력하지 마세요.</p>
          </div>
          <Button size="sm" onClick={onCreate}>다음 연락일 설정</Button>
        </div>
        {openItems.length === 0 ? (
          <div className="py-5 text-center text-sm text-muted-foreground">등록된 다음 연락일이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {openItems.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{new Date(item.nextContactDate).toLocaleString("ko-KR")} · {item.nextAction}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                  </div>
                  <span className="text-xs rounded-full bg-muted px-2 py-1">{item.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => onComplete(item.id)}>후속관리 완료</Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => onPostpone(item.id)}>연락일 연기</Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => onCancel(item.id)}>후속관리 취소</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FollowUpModal({ open, onClose, onSubmit, loading, mode = "create" }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { nextContactDate: string; reason: string; nextAction: "전화" | "카톡" | "문자" | "방문" | "설계안 발송" | "계약 확인" | "보장분석" | "사후관리" | "기타"; memo?: string }) => void;
  loading: boolean;
  mode?: "create" | "postpone";
}) {
  const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [nextContactDate, setNextContactDate] = useState(defaultDate);
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] = useState<"전화" | "카톡" | "문자" | "방문" | "설계안 발송" | "계약 확인" | "보장분석" | "사후관리" | "기타">("전화");
  const [memo, setMemo] = useState("");
  const actions = ["전화", "카톡", "문자", "방문", "설계안 발송", "계약 확인", "보장분석", "사후관리", "기타"] as const;
  const reasons = ["설계안 전달 후 재상담", "보험료 조정 상담", "보장분석 후속 연락", "계약 전 확인", "계약 후 사후관리", "생일/기념일 관리", "장기 미관리 고객 재접촉", "기타"];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "postpone" ? "연락일 연기" : "다음 연락일 설정"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">고객과 다시 연락할 날짜와 후속 사유를 기록합니다. 주민등록번호, 증권번호, 계좌번호, 병력상세 등 민감정보는 입력하지 마세요.</p>
          <div>
            <Label>다음 연락일 *</Label>
            <Input type="datetime-local" value={nextContactDate} onChange={(e) => setNextContactDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>후속관리 사유 *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="사유 선택" /></SelectTrigger>
              <SelectContent>{reasons.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>다음 액션</Label>
            <Select value={nextAction} onValueChange={(value) => setNextAction(value as typeof nextAction)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{actions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>메모</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="mt-1" placeholder="민감정보 입력 금지" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button disabled={!nextContactDate || !reason || loading} onClick={() => onSubmit({ nextContactDate, reason, nextAction, memo: memo || undefined })}>
              {mode === "postpone" ? "연기" : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditCustomerModal({ customer, onClose, onSubmit, loading }: {
  customer: any; onClose: () => void; onSubmit: (data: any) => void; loading: boolean;
}) {
  const { data: regionOptions } = trpc.settings.formOptions.useQuery({ category: "region" });
  const { data: sourceOptions } = trpc.settings.formOptions.useQuery({ category: "source" });
  const regions = regionOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const sources = sourceOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const [form, setForm] = useState({
    name: customer.name ?? "",
    phone: customer.phone ?? "",
    birthDate: customer.birthDate ? new Date(customer.birthDate).toISOString().split("T")[0] : "",
    gender: customer.gender ?? "none",
    region: customer.region ?? "",
    expectedPremium: customer.expectedPremium ? String(customer.expectedPremium) : "",
    availableTime: customer.availableTime ?? "",
    source: customer.source ?? "",
    memo: customer.memo ?? "",
    privacyConsent: customer.privacyConsent ?? false,
    marketingConsent: customer.marketingConsent ?? false,
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>고객 정보 수정</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">이름 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">연락처</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">생년월일</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="h-8 mt-1" /></div>
            <div>
              <Label className="text-xs">성별</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안함</SelectItem>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">지역</Label><Input list="edit-customer-region-options" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">예상보험료 (원)</Label><Input type="number" value={form.expectedPremium} onChange={(e) => setForm({ ...form, expectedPremium: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">통화가능시간</Label><Input value={form.availableTime} onChange={(e) => setForm({ ...form, availableTime: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">유입경로</Label><Input list="edit-customer-source-options" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="h-8 mt-1" /></div>
          </div>
          <datalist id="edit-customer-region-options">{regions.map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="edit-customer-source-options">{sources.map((v) => <option key={v} value={v} />)}</datalist>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading || !form.name} onClick={() => onSubmit({
              name: form.name, phone: form.phone || undefined,
              birthDate: form.birthDate || undefined,
              gender: form.gender === "none" ? undefined : form.gender as any,
              region: form.region || undefined,
              expectedPremium: form.expectedPremium ? Number(form.expectedPremium) : undefined,
              availableTime: form.availableTime || undefined,
              source: form.source || undefined,
              memo: form.memo || undefined,
              privacyConsent: form.privacyConsent,
              marketingConsent: form.marketingConsent,
            })}>
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 상담기록 추가 모달 ───────────────────────────────────────────────────────
function ConsultModal({ open, onClose, onSubmit, loading, currentStatus }: {
  open: boolean; onClose: () => void; onSubmit: (data: any) => void; loading: boolean; currentStatus: string;
}) {
  const { data: consultStatusOptions } = trpc.settings.formOptions.useQuery({ category: "consultStatus" });
  const consultStatuses = consultStatusOptions?.length ? consultStatusOptions.map((item) => item.value) : CONSULT_STATUSES;
  const [form, setForm] = useState({
    status: currentStatus,
    consultationType: "전화",
    customerNeed: "기타",
    nextAction: "재연락",
    summary: "",
    content: "",
    nextContactAt: "",
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>상담기록 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">상담상태</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{consultStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">상담유형</Label>
              <Select value={form.consultationType} onValueChange={(v) => setForm({ ...form, consultationType: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CONSULTATION_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">고객 니즈</Label>
              <Select value={form.customerNeed} onValueChange={(v) => setForm({ ...form, customerNeed: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CUSTOMER_NEEDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">다음 액션</Label>
            <Select value={form.nextAction} onValueChange={(v) => setForm({ ...form, nextAction: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CUSTOMER_NEXT_ACTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">상담 요약</Label>
            <Input value={form.summary} maxLength={200} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="h-9 mt-1" placeholder="한 줄 요약" />
          </div>
          <div>
            <Label className="text-xs">상세 메모</Label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-24" placeholder="상담 내용을 입력하세요..." />
            <p className="text-[11px] text-muted-foreground mt-1">주민등록번호, 증권번호, 계좌번호, 병력상세 등 민감정보는 입력하지 마세요.</p>
          </div>
          <div>
            <Label className="text-xs">재상담 예정일</Label>
            <Input type="datetime-local" value={form.nextContactAt} onChange={(e) => setForm({ ...form, nextContactAt: e.target.value })} className="h-9 mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading} onClick={() => onSubmit({ ...form, summary: form.summary || undefined, content: form.content || undefined, nextContactAt: form.nextContactAt || undefined })}>{loading ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 상담기록 수정 모달 ───────────────────────────────────────────────────────
function EditConsultModal({ consult, onClose, onSubmit, loading }: {
  consult: any; onClose: () => void; onSubmit: (data: any) => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    status: consult.status,
    consultationType: consult.consultationType ?? "전화",
    customerNeed: consult.customerNeed ?? "기타",
    nextAction: consult.nextAction ?? "재연락",
    summary: consult.summary ?? "",
    content: consult.content ?? "",
    nextContactAt: consult.nextContactAt ? new Date(consult.nextContactAt).toISOString().slice(0, 16) : "",
  });
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>상담기록 수정</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">상담상태</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CONSULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">상담유형</Label>
              <Select value={form.consultationType} onValueChange={(v) => setForm({ ...form, consultationType: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CONSULTATION_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">고객 니즈</Label>
              <Select value={form.customerNeed} onValueChange={(v) => setForm({ ...form, customerNeed: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CUSTOMER_NEEDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">다음 액션</Label>
            <Select value={form.nextAction} onValueChange={(v) => setForm({ ...form, nextAction: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CUSTOMER_NEXT_ACTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">상담 요약</Label>
            <Input value={form.summary} maxLength={200} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">상세 메모</Label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-24" />
            <p className="text-[11px] text-muted-foreground mt-1">주민등록번호, 증권번호, 계좌번호, 병력상세 등 민감정보는 입력하지 마세요.</p>
          </div>
          <div>
            <Label className="text-xs">재상담 예정일</Label>
            <Input type="datetime-local" value={form.nextContactAt} onChange={(e) => setForm({ ...form, nextContactAt: e.target.value })} className="h-9 mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading} onClick={() => onSubmit({ status: form.status, consultationType: form.consultationType, customerNeed: form.customerNeed, nextAction: form.nextAction, summary: form.summary || undefined, content: form.content || undefined, nextContactAt: form.nextContactAt || null })}>
              {loading ? "저장 중..." : "수정 저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 계약 등록 모달 ───────────────────────────────────────────────────────────
function ContractModal({ open, onClose, onSubmit, loading, contract, customerAgentId, currentUserRole }: {
  open: boolean; onClose: () => void; onSubmit: (data: any) => void; loading: boolean; contract?: any; customerAgentId?: number | null; currentUserRole?: string;
}) {
  const [form, setForm] = useState({
    company: contract?.company ?? "", productName: contract?.productName ?? "", productGroup: contract?.productGroup ?? "", contractDate: contract?.contractDate ? new Date(contract.contractDate).toISOString().split("T")[0] : "",
    monthlyPremium: contract?.monthlyPremium ? String(contract.monthlyPremium) : "", paymentStatus: contract?.paymentStatus ?? "정상", contractStatus: contract?.contractStatus ?? "청약", memo: contract?.memo ?? "",
    agentId: contract?.agentId ? String(contract.agentId) : customerAgentId ? String(customerAgentId) : "default",
  });
  const { data: users } = trpc.users.list.useQuery();
  const { data: insurerOptions } = trpc.settings.formOptions.useQuery({ category: "insurer" });
  const { data: productGroupOptions } = trpc.settings.formOptions.useQuery({ category: "productGroup" });
  const { data: paymentStatusOptions } = trpc.settings.formOptions.useQuery({ category: "paymentStatus" });
  const { data: contractStatusOptions } = trpc.settings.formOptions.useQuery({ category: "contractStatus" });
  const insurers = insurerOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const productGroups = productGroupOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const paymentStatuses = paymentStatusOptions?.length ? paymentStatusOptions.map((item) => item.value) : [form.paymentStatus];
  const contractStatuses = contractStatusOptions?.length ? contractStatusOptions.map((item) => item.value) : [form.contractStatus];
  const agentOptions = (users ?? []).filter((u) => (u as any).accountStatus === "active" && (u.role === "team_leader" || u.role === "member"));
  const requiresAgentSelection = !contract && !customerAgentId && currentUserRole !== "member";
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{contract ? "계약 수정" : "계약 등록"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">보험사</Label><Input list="contract-insurer-options" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">상품명</Label><Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">상품군</Label><Input list="contract-product-group-options" value={form.productGroup} onChange={(e) => setForm({ ...form, productGroup: e.target.value })} className="h-8 mt-1" placeholder="예: 종신, 실손" /></div>
            <div><Label className="text-xs">계약일</Label><Input type="date" value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">월보험료 (원)</Label><Input type="number" value={form.monthlyPremium} onChange={(e) => setForm({ ...form, monthlyPremium: e.target.value })} className="h-8 mt-1" /></div>
            <div>
              <Label className="text-xs">납입상태</Label>
              <Select value={form.paymentStatus} onValueChange={(v) => setForm({ ...form, paymentStatus: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{paymentStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">계약상태</Label>
              <Select value={form.contractStatus} onValueChange={(v) => setForm({ ...form, contractStatus: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{contractStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">담당 설계사</Label>
              <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="기본 담당자" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">기본 담당자</SelectItem>
                  {agentOptions.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {requiresAgentSelection && (
                <p className="text-xs text-destructive mt-1">계약 담당 설계사를 선택해야 합니다.</p>
              )}
            </div>
          </div>
          <datalist id="contract-insurer-options">{insurers.map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="contract-product-group-options">{productGroups.map((v) => <option key={v} value={v} />)}</datalist>
          <div><Label className="text-xs">메모</Label><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading} onClick={() => {
              if (requiresAgentSelection && form.agentId === "default") {
                toast.error("계약 담당 설계사를 선택해야 합니다.");
                return;
              }
              const { agentId, ...payload } = form;
              onSubmit({
                ...payload,
                monthlyPremium: form.monthlyPremium ? Number(form.monthlyPremium) : undefined,
                ...(agentId !== "default" ? (contract ? { newAgentId: Number(agentId) } : { agentIdOverride: Number(agentId) }) : {}),
              });
            }}>
              {loading ? "저장 중..." : contract ? "수정" : "등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
