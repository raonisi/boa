import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge, CONSULT_STATUSES } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Phone, Plus, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CustomerList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: customers, refetch } = trpc.customers.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("고객이 등록되었습니다.");
      setShowCreate(false);
      refetch();
    },
  });

  const filtered = customers?.filter((c) =>
    c.name.includes(search) || (c.phone ?? "").includes(search)
  ) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">고객 DB 관리</h1>
            <p className="text-sm text-muted-foreground mt-0.5">총 {filtered.length}명</p>
          </div>
          <div className="flex gap-2">
            {user?.role === "admin" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setLocation("/customers/assign")}>
                  <UserPlus className="h-4 w-4 mr-1" /> DB 배정
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 고객 등록
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름 또는 연락처 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36 h-9">
                  <SelectValue placeholder="상담상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {CONSULT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead>지역</TableHead>
                    <TableHead>유입경로</TableHead>
                    <TableHead>상담상태</TableHead>
                    <TableHead>배정일</TableHead>
                    <TableHead>예상보험료</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        고객 데이터가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(`/customers/${c.id}`)}
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${c.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              {c.phone ?? "-"}
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>{c.region ?? "-"}</TableCell>
                        <TableCell>{c.source ?? "-"}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.consultStatus} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.assignedAt ? new Date(c.assignedAt).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.expectedPremium ? `${c.expectedPremium.toLocaleString()}원` : "-"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            상세
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Customer Modal */}
      <CreateCustomerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />
    </DashboardLayout>
  );
}

function CreateCustomerModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthDate: "",
    gender: "" as "male" | "female" | "other" | "",
    region: "",
    expectedPremium: "",
    availableTime: "",
    source: "",
    privacyConsent: false,
    marketingConsent: false,
    memo: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSubmit({
      name: form.name,
      phone: form.phone || undefined,
      birthDate: form.birthDate || undefined,
      gender: (form.gender as any) || undefined,
      region: form.region || undefined,
      expectedPremium: form.expectedPremium ? Number(form.expectedPremium) : undefined,
      availableTime: form.availableTime || undefined,
      source: form.source || undefined,
      privacyConsent: form.privacyConsent,
      marketingConsent: form.marketingConsent,
      memo: form.memo || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>고객 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">이름 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 mt-1" required />
            </div>
            <div>
              <Label className="text-xs">연락처</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 mt-1" placeholder="010-0000-0000" />
            </div>
            <div>
              <Label className="text-xs">생년월일</Label>
              <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="h-8 mt-1" />
            </div>
            <div>
              <Label className="text-xs">성별</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as any })}>
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">지역</Label>
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="h-8 mt-1" />
            </div>
            <div>
              <Label className="text-xs">예상보험료 (원)</Label>
              <Input type="number" value={form.expectedPremium} onChange={(e) => setForm({ ...form, expectedPremium: e.target.value })} className="h-8 mt-1" />
            </div>
            <div>
              <Label className="text-xs">통화가능시간</Label>
              <Input value={form.availableTime} onChange={(e) => setForm({ ...form, availableTime: e.target.value })} className="h-8 mt-1" placeholder="예: 오후 2~5시" />
            </div>
            <div>
              <Label className="text-xs">유입경로</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="h-8 mt-1" placeholder="예: 지인소개, SNS" />
            </div>
          </div>
          <div>
            <Label className="text-xs">메모</Label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
            />
          </div>
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
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "등록 중..." : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
