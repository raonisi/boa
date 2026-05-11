import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, CONSULT_STATUSES } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Phone, Plus } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CustomerDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  const { data: customer, refetch: refetchCustomer } = trpc.customers.get.useQuery({ id });
  const { data: consultations, refetch: refetchConsult } = trpc.consultations.list.useQuery({ customerId: id });
  const { data: contracts, refetch: refetchContracts } = trpc.contracts.listByCustomer.useQuery({ customerId: id });
  const { data: users } = trpc.users.list.useQuery();

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); refetchCustomer(); },
  });

  const createConsultMutation = trpc.consultations.create.useMutation({
    onSuccess: () => { toast.success("상담기록이 저장되었습니다."); setShowConsultModal(false); refetchConsult(); refetchCustomer(); },
  });

  const createContractMutation = trpc.contracts.create.useMutation({
    onSuccess: () => { toast.success("계약이 등록되었습니다."); setShowContractModal(false); refetchContracts(); },
  });

  if (!customer) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground">로딩 중...</div>
    </DashboardLayout>
  );

  const agentName = users?.find((u) => u.id === customer.agentId)?.name ?? "-";
  const genderLabel = customer.gender === "male" ? "남성" : customer.gender === "female" ? "여성" : customer.gender ? "기타" : "-";

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/customers")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 목록
          </Button>
          <div>
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={customer.consultStatus} />
              <span className="text-xs text-muted-foreground">담당: {agentName}</span>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            {customer.phone && (
              <a href={`tel:${customer.phone}`}>
                <Button variant="outline" size="sm">
                  <Phone className="h-4 w-4 mr-1" /> 전화
                </Button>
              </a>
            )}
          </div>
        </div>

        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">기본정보</TabsTrigger>
            <TabsTrigger value="consult">상담기록 ({consultations?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="contract">계약정보 ({contracts?.length ?? 0})</TabsTrigger>
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
                    { label: "개인정보 동의", value: customer.privacyConsent ? "동의" : "미동의" },
                    { label: "마케팅 수신 동의", value: customer.marketingConsent ? "동의" : "미동의" },
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
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.createdAt).toLocaleString("ko-KR")}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{c.content ?? "(내용 없음)"}</p>
                          {c.nextContactAt && (
                            <p className="text-xs text-primary mt-2">
                              재상담 예정: {new Date(c.nextContactAt).toLocaleString("ko-KR")}
                            </p>
                          )}
                        </div>
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
        </Tabs>
      </div>

      {/* 상담기록 모달 */}
      <ConsultModal
        open={showConsultModal}
        onClose={() => setShowConsultModal(false)}
        onSubmit={(data) => createConsultMutation.mutate({ ...data, customerId: id })}
        loading={createConsultMutation.isPending}
        currentStatus={customer.consultStatus}
      />

      {/* 계약 등록 모달 */}
      <ContractModal
        open={showContractModal}
        onClose={() => setShowContractModal(false)}
        onSubmit={(data) => createContractMutation.mutate({ ...data, customerId: id })}
        loading={createContractMutation.isPending}
      />
    </DashboardLayout>
  );
}

function ConsultModal({ open, onClose, onSubmit, loading, currentStatus }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: any) => void; loading: boolean; currentStatus: string;
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
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONSULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">상담내용</Label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-24"
              placeholder="상담 내용을 입력하세요..."
            />
          </div>
          <div>
            <Label className="text-xs">재상담 예정일</Label>
            <Input type="datetime-local" value={form.nextContactAt} onChange={(e) => setForm({ ...form, nextContactAt: e.target.value })} className="h-9 mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" disabled={loading} onClick={() => onSubmit(form)}>
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
                <SelectContent>
                  {["정상","미납","실효","해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">계약상태</Label>
              <Select value={form.contractStatus} onValueChange={(v) => setForm({ ...form, contractStatus: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["청약","성립","철회","유지","해지"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
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
