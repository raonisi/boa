import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, CONSULT_STATUSES } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole } from "@/lib/userRole";
import { useIsMobile } from "@/hooks/useMobile";
import { Phone, Plus, Search, UserPlus, ChevronRight, Filter, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

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
  const [assignedDateFrom, setAssignedDateFrom] = useState("");
  const [assignedDateTo, setAssignedDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();
  const { data: customers, refetch } = trpc.customers.list.useQuery({
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
    onSuccess: () => { toast.success("고객이 삭제(비활성 처리)되었습니다."); utils.customers.list.invalidate(); refetch(); },
    onError: (err) => toast.error(err.message || "고객 삭제에 실패했습니다."),
  });

  const agents = (allUsers ?? []).filter((u) => ((u as any).accountStatus === "active"));
  const agentById = new Map((allUsers ?? []).map((u) => [u.id, u]));
  const canDeactivateCustomer = user?.role === "branch_admin";
  const recommendationByCustomerId = new Map((priorityContacts ?? []).map((item) => [item.customerId, item]));

  const filtered = (customers ?? []).filter((c) => {
    const matchSearch = !search || c.name.includes(search) || (c.phone ?? "").includes(search);
    const matchRegion = !regionFilter || (c.region ?? "").includes(regionFilter);
    const matchSource = !sourceFilter || (c.source ?? "").includes(sourceFilter);
    const matchAgent = agentFilter === "all" || String(c.agentId) === agentFilter;
    const recommendation = recommendationByCustomerId.get(c.id);
    const matchRecommendation =
      recommendationFilter === "all" ||
      (recommendationFilter === "recommended" && Boolean(recommendation)) ||
      (recommendationFilter === "warning" && Boolean(recommendation?.warnings?.length)) ||
      (recommendationFilter === "high" && recommendation?.urgency === "high");
    return matchSearch && matchRegion && matchSource && matchAgent && matchRecommendation;
  });

  const hasActiveFilters = statusFilter !== "all" || regionFilter || sourceFilter || priorityFilter !== "all" || tagFilter !== "all" || nextActionFilter !== "all" || agentFilter !== "all" || recommendationFilter !== "all" || (user?.role === "branch_admin" && scopeFilter !== "all");

  const clearFilters = () => {
    setStatusFilter("all");
    setRegionFilter("");
    setSourceFilter("");
    setPriorityFilter("all");
    setTagFilter("all");
    setNextActionFilter("all");
    setAgentFilter("all");
    setScopeFilter("all");
    setRecommendationFilter("all");
    setAssignedDateFrom("");
    setAssignedDateTo("");
  };

  const handleDeactivateCustomer = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("이 고객을 삭제하시겠습니까?\n완전 삭제가 아니라 비활성 처리됩니다.\n활성 계약이나 진행 중 일정이 있으면 삭제할 수 없습니다.\n이 작업은 활동 로그에 기록됩니다.")) {
      deactivateMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Customer Database</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">고객 DB</h1>
              <p className="mt-1 text-sm text-slate-500">
              {user?.role === "sub_branch_admin" ? "부지점장 산하 고객 관리" :
               user?.role === "team_leader" ? "본인 팀 고객 관리" :
               user?.role === "member" ? "내 고객 관리" : "전체 고객 관리"}
              {" · "}표시 고객 {filtered.length}명
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
            {user?.role === "branch_admin" && (
              <>
                <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={() => setLocation("/customers/assign")}>
                  <UserPlus className="h-4 w-4 mr-1" /> DB 배정
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 신규 고객 등록
                </Button>
              </>
            )}
            </div>
          </CardContent>
        </Card>

        {/* 검색 및 필터 */}
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="고객 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-8" />
              </div>
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                className="h-10 shrink-0 rounded-xl"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                필터{hasActiveFilters ? " ●" : ""}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-10 rounded-xl" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-4">
                {user?.role === "branch_admin" && (
                  <Select value={scopeFilter} onValueChange={(value) => setScopeFilter(value as "all" | "mine")}>
                    <SelectTrigger className="h-9 rounded-xl bg-white text-xs"><SelectValue placeholder="DB 범위" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 DB</SelectItem>
                      <SelectItem value="mine">내 DB</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 rounded-xl bg-white text-xs"><SelectValue placeholder="상담상태" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    {CONSULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="지역 필터" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="h-9 rounded-xl bg-white text-xs" />
                <Input placeholder="유입경로 필터" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 rounded-xl bg-white text-xs" />
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9 rounded-xl bg-white text-xs"><SelectValue placeholder="우선순위" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 우선순위</SelectItem>
                    {CUSTOMER_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{priorityLabel(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="h-9 rounded-xl bg-white text-xs"><SelectValue placeholder="성향 태그" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 태그</SelectItem>
                    {CUSTOMER_TAGS.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={nextActionFilter} onValueChange={setNextActionFilter}>
                  <SelectTrigger className="h-9 rounded-xl bg-white text-xs"><SelectValue placeholder="다음 액션" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 액션</SelectItem>
                    {CUSTOMER_NEXT_ACTIONS.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={recommendationFilter} onValueChange={setRecommendationFilter}>
                  <SelectTrigger className="h-9 rounded-xl bg-white text-xs"><SelectValue placeholder="추천/경고" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 추천</SelectItem>
                    <SelectItem value="recommended">우선 연락 추천</SelectItem>
                    <SelectItem value="warning">경고 있음</SelectItem>
                    <SelectItem value="high">긴급 추천</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={assignedDateFrom} onChange={(e) => setAssignedDateFrom(e.target.value)} className="h-9 rounded-xl bg-white text-xs" title="배정일 시작" />
                <Input type="date" value={assignedDateTo} onChange={(e) => setAssignedDateTo(e.target.value)} className="h-9 rounded-xl bg-white text-xs" title="배정일 종료" />
                {(user?.role === "branch_admin" || user?.role === "team_leader") && (
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="h-9 rounded-xl bg-white text-xs"><SelectValue placeholder="담당자" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 담당자</SelectItem>
                      {agents.map((a) => <SelectItem key={a.id} value={String(a.id)}>{formatUserWithRole(a)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 모바일 카드 뷰 */}
        {isMobile ? (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <Card className="border-dashed border-slate-200 bg-white/90"><CardContent className="py-10 text-center text-sm text-slate-500">표시할 고객이 없습니다.</CardContent></Card>
            ) : (
              filtered.map((c) => {
                const recommendation = recommendationByCustomerId.get(c.id);
                return (
                <Card key={c.id} className="cursor-pointer border-slate-200/80 bg-white/95 shadow-sm transition active:bg-slate-50" onClick={() => setLocation(`/customers/${c.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-950">{c.name}</span>
                          <StatusBadge status={c.consultStatus} />
                          <span className="text-[10px] rounded-full border px-2 py-0.5 bg-muted">{priorityLabel((c as any).priority)}</span>
                          {recommendation && <span className={`text-[10px] rounded-full px-2 py-0.5 ${recommendation.urgency === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>우선 연락</span>}
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {parseCustomerTags((c as any).customerTags).slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{tag}</span>
                          ))}
                          {(c as any).nextAction && <span className="rounded-full border border-[#d9c99f] bg-[#fff8e8] px-2 py-0.5 text-[10px] text-[#7a5d1d]">다음: {(c as any).nextAction}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {recommendation?.warnings?.slice(0, 1).map((warning) => (
                            <span key={warning.warningType} className="text-xs text-red-600">{warning.message}</span>
                          ))}
                          {c.phone && (
                            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <Phone className="h-3 w-3" /> {maskPhone(c.phone)}
                            </span>
                          )}
                          {c.region && <span className="text-xs text-muted-foreground">{c.region}</span>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">담당: {formatUserWithRole(agentById.get(c.agentId ?? 0))}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {["부재", "통화완료", "상담예정"].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateMutation.mutate({ id: c.id, consultStatus: s as any })}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${c.consultStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                        >
                          {s}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setLocation(`/customers/${c.id}`)}
                        className="min-h-8 rounded-full border px-3 text-[11px] font-medium hover:bg-muted"
                      >
                        상담기록
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocation(`/customers/${c.id}`)}
                        className="min-h-8 rounded-full border px-3 text-[11px] font-medium hover:bg-muted"
                      >
                        다음 연락일
                      </button>
                    </div>
                  </CardContent>
                </Card>
                );
              })
            )}
          </div>
        ) : (
          /* 데스크톱 테이블 뷰 */
          <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>지역</TableHead>
                      <TableHead>유입경로</TableHead>
                      <TableHead>상담상태</TableHead>
                      <TableHead>우선순위</TableHead>
                      <TableHead>성향/다음 액션</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>배정일</TableHead>
                      <TableHead>예상보험료</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-10 text-center text-sm text-slate-500">표시할 고객이 없습니다.</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((c) => {
                        const recommendation = recommendationByCustomerId.get(c.id);
                        return (
                        <TableRow key={c.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => setLocation(`/customers/${c.id}`)}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <span>{c.name}</span>
                              {recommendation && <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] ${recommendation.urgency === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>우선 연락 · {recommendation.totalScore}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline flex items-center gap-1">
                              <Phone className="h-3 w-3" />{c.phone ?? "-"}
                            </a>
                          </TableCell>
                          <TableCell>{c.region ?? "-"}</TableCell>
                          <TableCell>{c.source ?? "-"}</TableCell>
                          <TableCell><StatusBadge status={c.consultStatus} /></TableCell>
                          <TableCell><span className="text-xs rounded-full border px-2 py-0.5 bg-muted">{priorityLabel((c as any).priority)}</span></TableCell>
                          <TableCell className="max-w-[220px]">
                            <div className="flex gap-1 flex-wrap">
                              {parseCustomerTags((c as any).customerTags).slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{tag}</span>
                              ))}
                              {(c as any).nextAction && <span className="rounded-full border border-[#d9c99f] bg-[#fff8e8] px-2 py-0.5 text-[10px] text-[#7a5d1d]">다음: {(c as any).nextAction}</span>}
                              {parseCustomerTags((c as any).customerTags).length === 0 && !(c as any).nextAction && <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatUserWithRole(agentById.get(c.agentId ?? 0))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {recommendation?.warnings?.[0] ? (
                              <span className="text-red-600">{recommendation.warnings[0].message}</span>
                            ) : (
                              c.assignedAt ? new Date(c.assignedAt).toLocaleDateString("ko-KR") : "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {c.expectedPremium ? `${c.expectedPremium.toLocaleString()}원` : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs">상세</Button>
                              {canDeactivateCustomer && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => handleDeactivateCustomer(c.id, e)}
                                  title="고객 삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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
      />
    </DashboardLayout>
  );
}

function CreateCustomerModal({ open, onClose, onSubmit, loading }: {
  open: boolean; onClose: () => void; onSubmit: (data: any) => void; loading: boolean;
}) {
  const { data: regionOptions } = trpc.settings.formOptions.useQuery({ category: "region" });
  const { data: sourceOptions } = trpc.settings.formOptions.useQuery({ category: "source" });
  const { data: consultStatusOptions } = trpc.settings.formOptions.useQuery({ category: "consultStatus" });
  const regions = regionOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const sources = sourceOptions?.map((item) => item.value).filter(Boolean) ?? [];
  const consultStatuses = consultStatusOptions?.length ? consultStatusOptions.map((item) => item.value) : ["미상담"];
  const [form, setForm] = useState({
    name: "", phone: "", birthDate: "", gender: "" as "male" | "female" | "other" | "",
    region: "", expectedPremium: "", availableTime: "", source: "",
    consultStatus: "미상담", privacyConsent: false, marketingConsent: false, memo: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSubmit({
      name: form.name, phone: form.phone || undefined,
      birthDate: form.birthDate || undefined, gender: (form.gender as any) || undefined,
      region: form.region || undefined,
      expectedPremium: form.expectedPremium ? Number(form.expectedPremium) : undefined,
      availableTime: form.availableTime || undefined, source: form.source || undefined,
      consultStatus: form.consultStatus || undefined,
      privacyConsent: form.privacyConsent, marketingConsent: form.marketingConsent,
      memo: form.memo || undefined,
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
            <div><Label className="text-xs">예상보험료 (원)</Label><Input type="number" value={form.expectedPremium} onChange={(e) => setForm({ ...form, expectedPremium: e.target.value })} className="h-8 mt-1" /></div>
            <div><Label className="text-xs">통화가능시간</Label><Input value={form.availableTime} onChange={(e) => setForm({ ...form, availableTime: e.target.value })} className="h-8 mt-1" placeholder="예: 오후 2~5시" /></div>
            <div><Label className="text-xs">유입경로</Label><Input list="customer-source-options" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="h-8 mt-1" placeholder="예: 지인소개, SNS" /></div>
            <div>
              <Label className="text-xs">상담상태</Label>
              <Select value={form.consultStatus} onValueChange={(v) => setForm({ ...form, consultStatus: v })}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{consultStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
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
