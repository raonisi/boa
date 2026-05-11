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
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Phone, Plus, UserCog, AlertTriangle, Edit2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CustomerDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showChangeAgentModal, setShowChangeAgentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConsultId, setEditingConsultId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: customer, refetch: refetchCustomer } = trpc.customers.get.useQuery({ id });
  const { data: consultations, refetch: refetchConsult } = trpc.consultations.list.useQuery({ customerId: id });
  const { data: contracts, refetch: refetchContracts } = trpc.contracts.listByCustomer.useQuery({ customerId: id });
  const { data: statusHistoryData } = trpc.customers.statusHistory.useQuery({ customerId: id });
  const { data: consentLogsData } = trpc.customers.consentLogs.useQuery({ customerId: id });
  const { data: assignmentHistoryData } = trpc.customers.assignmentHistory.useQuery({ customerId: id });
  const { data: users } = trpc.users.list.useQuery();

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => { toast.success("고객 정보가 수정되었습니다."); setShowEditModal(false); refetchCustomer(); },
    onError: () => toast.error("수정에 실패했습니다."),
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

  const changeAgentMutation = trpc.customers.changeAgent.useMutation({
    onSuccess: () => { toast.success("담당자가 변경되었습니다."); setShowChangeAgentModal(false); refetchCustomer(); },
  });

  const deactivateMutation = trpc.customers.deactivate.useMutation({
    onSuccess: () => { toast.success("고객이 비활성화되었습니다."); setLocation("/customers"); },
    onError: () => toast.error("비활성화에 실패했습니다."),
  });

  if (!customer) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground">로딩 중...</div>
    </DashboardLayout>
  );

  const agentName = users?.find((u) => u.id === customer.agentId)?.name ?? "-";
  const genderLabel = customer.gender === "male" ? "남성" : customer.gender === "female" ? "여성" : customer.gender ? "기타" : "-";
  const canChangeAgent = user?.role === "branch_admin" || user?.role === "team_leader";
  const editingConsult = consultations?.find((c) => c.id === editingConsultId);

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
            {canChangeAgent && customer.isActive && (
              <Button
                variant="outline" size="sm" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { if (confirm("이 고객을 비활성화하시겠습니까? 데이터는 보존됩니다.")) deactivateMutation.mutate({ id }); }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" /> 비활성화
              </Button>
            )}
          </div>
        </div>

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
                            <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString("ko-KR")}</span>
                          </div>
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
      />

      {/* 담당자 변경 모달 */}
      {showChangeAgentModal && (
        <Dialog open={true} onOpenChange={() => setShowChangeAgentModal(false)}>
          <DialogContent className="max-w-sm">
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
function EditCustomerModal({ customer, onClose, onSubmit, loading }: {
  customer: any; onClose: () => void; onSubmit: (data: any) => void; loading: boolean;
}) {
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div><Label className="text-xs">지역</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">예상보험료 (원)</Label><Input type="number" value={form.expectedPremium} onChange={(e) => setForm({ ...form, expectedPremium: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">통화가능시간</Label><Input value={form.availableTime} onChange={(e) => setForm({ ...form, availableTime: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">유입경로</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="h-8 mt-1" /></div>
          </div>
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
  const [form, setForm] = useState({ status: currentStatus, content: "", nextContactAt: "" });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>상담기록 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">상담상태</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CONSULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">상담내용</Label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-24" placeholder="상담 내용을 입력하세요..." />
          </div>
          <div>
            <Label className="text-xs">재상담 예정일</Label>
            <Input type="datetime-local" value={form.nextContactAt} onChange={(e) => setForm({ ...form, nextContactAt: e.target.value })} className="h-9 mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading} onClick={() => onSubmit(form)}>{loading ? "저장 중..." : "저장"}</Button>
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
    content: consult.content ?? "",
    nextContactAt: consult.nextContactAt ? new Date(consult.nextContactAt).toISOString().slice(0, 16) : "",
  });
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>상담기록 수정</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">상담상태</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CONSULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">상담내용</Label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-24" />
          </div>
          <div>
            <Label className="text-xs">재상담 예정일</Label>
            <Input type="datetime-local" value={form.nextContactAt} onChange={(e) => setForm({ ...form, nextContactAt: e.target.value })} className="h-9 mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading} onClick={() => onSubmit({ status: form.status, content: form.content || undefined, nextContactAt: form.nextContactAt || null })}>
              {loading ? "저장 중..." : "수정 저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 계약 등록 모달 ───────────────────────────────────────────────────────────
function ContractModal({ open, onClose, onSubmit, loading }: {
  open: boolean; onClose: () => void; onSubmit: (data: any) => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    company: "", productName: "", productGroup: "", contractDate: "",
    monthlyPremium: "", paymentStatus: "정상", contractStatus: "청약", memo: "",
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>계약 등록</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">보험사</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">상품명</Label><Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">상품군</Label><Input value={form.productGroup} onChange={(e) => setForm({ ...form, productGroup: e.target.value })} className="h-8 mt-1" placeholder="예: 종신, 실손" /></div>
            <div><Label className="text-xs">계약일</Label><Input type="date" value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">월보험료 (원)</Label><Input type="number" value={form.monthlyPremium} onChange={(e) => setForm({ ...form, monthlyPremium: e.target.value })} className="h-8 mt-1" /></div>
            <div>
              <Label className="text-xs">납입상태</Label>
              <Select value={form.paymentStatus} onValueChange={(v) => setForm({ ...form, paymentStatus: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["정상","미납","실효","해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">계약상태</Label>
              <Select value={form.contractStatus} onValueChange={(v) => setForm({ ...form, contractStatus: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["청약","성립","철회","유지","해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">메모</Label><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading} onClick={() => onSubmit({ ...form, monthlyPremium: form.monthlyPremium ? Number(form.monthlyPremium) : undefined })}>
              {loading ? "저장 중..." : "등록"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
