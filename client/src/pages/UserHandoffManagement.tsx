import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatUserWithRole } from "@/lib/userRole";
import { ArrowRightLeft, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const roleLabel: Record<string, string> = {
  branch_admin: "지점장",
  sub_branch_admin: "부지점장",
  team_leader: "팀장",
  member: "팀원",
};

const statusLabel: Record<string, string> = {
  active: "active",
  inactive: "inactive",
  resigned: "resigned",
};

export default function UserHandoffManagement() {
  const utils = trpc.useUtils();
  const [sourceUserId, setSourceUserId] = useState<number | null>(null);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [transferCustomers, setTransferCustomers] = useState(true);
  const [transferFollowUps, setTransferFollowUps] = useState(true);
  const [transferSchedules, setTransferSchedules] = useState(true);
  const [transferNotifications, setTransferNotifications] = useState(true);
  const [updateSourceAccountStatus, setUpdateSourceAccountStatus] = useState<"keep" | "inactive" | "resigned">("inactive");
  const [forceLogoutSource, setForceLogoutSource] = useState(true);
  const [resetOAuthSource, setResetOAuthSource] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: users } = trpc.adminHandoff.listUsers.useQuery();
  const { data: preview } = trpc.adminHandoff.preview.useQuery(
    { sourceUserId: sourceUserId ?? 0 },
    { enabled: !!sourceUserId },
  );
  const { data: histories } = trpc.adminHandoff.history.useQuery({ limit: 20 });

  const sourceUsers = users ?? [];
  const targetUsers = useMemo(
    () => sourceUsers.filter((user: any) => user.accountStatus === "active" && (user.role === "member" || user.role === "team_leader") && user.id !== sourceUserId),
    [sourceUsers, sourceUserId],
  );

  const executeMutation = trpc.adminHandoff.execute.useMutation({
    onSuccess: () => {
      toast.success("인수인계가 완료되었습니다.");
      setConfirmOpen(false);
      setConfirmText("");
      utils.adminHandoff.preview.invalidate();
      utils.adminHandoff.history.invalidate();
      utils.adminHandoff.listUsers.invalidate();
      utils.customers.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedSource = sourceUsers.find((user: any) => user.id === sourceUserId);
  const selectedTarget = targetUsers.find((user: any) => user.id === targetUserId);

  const canSubmit = !!sourceUserId && !!targetUserId && reason.trim().length >= 5;

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">인수인계 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            퇴사자 또는 조직 이동 대상자의 고객, 후속관리, 미완료 일정, 미확인 알림을 새 담당자에게 안전하게 이관합니다.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4" /> 인수인계 마법사
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>대상 사용자</Label>
                  <Select value={sourceUserId ? String(sourceUserId) : ""} onValueChange={(value) => { setSourceUserId(Number(value)); setTargetUserId(null); }}>
                    <SelectTrigger><SelectValue placeholder="이관할 사용자를 선택" /></SelectTrigger>
                    <SelectContent>
                      {sourceUsers.map((user: any) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {formatUserWithRole(user)} · {statusLabel[user.accountStatus] ?? user.accountStatus}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>새 담당자</Label>
                  <Select value={targetUserId ? String(targetUserId) : ""} onValueChange={(value) => setTargetUserId(Number(value))}>
                    <SelectTrigger><SelectValue placeholder="active 팀장/팀원 선택" /></SelectTrigger>
                    <SelectContent>
                      {targetUsers.map((user: any) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {formatUserWithRole(user)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {preview && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["activeCustomers", "active 고객"],
                    ["activeContracts", "active 계약"],
                    ["pendingFollowUps", "미완료 후속관리"],
                    ["pendingSchedules", "미완료 일정"],
                    ["pendingNotifications", "미확인 알림"],
                    ["consultations", "상담기록"],
                    ["softDeletedCustomers", "비활성 고객"],
                    ["recentActivityLogs", "최근 30일 로그"],
                  ].map(([key, label]) => (
                    <Card key={key}>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-bold">{preview.counts?.[key as keyof typeof preview.counts] ?? 0}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="rounded-md border p-3">
                <p className="mb-3 text-sm font-medium">이관 범위</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    [transferCustomers, setTransferCustomers, "고객 및 active 계약 담당자"],
                    [transferFollowUps, setTransferFollowUps, "scheduled/postponed 후속관리"],
                    [transferSchedules, setTransferSchedules, "미완료 일정"],
                    [transferNotifications, setTransferNotifications, "미확인 알림"],
                  ].map(([checked, setter, label]) => (
                    <label key={String(label)} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={Boolean(checked)} onCheckedChange={(value) => (setter as (next: boolean) => void)(Boolean(value))} />
                      {label as string}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>대상 계정 처리</Label>
                  <Select value={updateSourceAccountStatus} onValueChange={(value) => setUpdateSourceAccountStatus(value as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">상태 유지</SelectItem>
                      <SelectItem value="inactive">inactive 전환</SelectItem>
                      <SelectItem value="resigned">resigned 전환</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <Checkbox checked={forceLogoutSource} onCheckedChange={(value) => setForceLogoutSource(Boolean(value))} />
                  강제 로그아웃
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <Checkbox checked={resetOAuthSource} onCheckedChange={(value) => setResetOAuthSource(Boolean(value))} />
                  OAuth 초기화
                </label>
              </div>

              <div className="space-y-2">
                <Label>인수인계 사유</Label>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="예: 퇴사 처리로 인한 담당 고객 및 미완료 업무 이관"
                  rows={3}
                />
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                기존 상담기록과 활동 로그는 감사 추적을 위해 변경하지 않습니다. 실행 후 되돌리려면 별도 재이관이 필요합니다.
              </div>

              <div className="flex justify-end">
                <Button disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
                  인수인계 실행
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">선택 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">대상 사용자</p>
                <p className="font-medium">{selectedSource ? formatUserWithRole(selectedSource) : "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">새 담당자</p>
                <p className="font-medium">{selectedTarget ? formatUserWithRole(selectedTarget) : "-"}</p>
              </div>
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                새 담당자는 active 상태의 team_leader/member만 허용됩니다. 고객의 팀과 부지점장 범위는 새 담당자 기준으로 동기화됩니다.
              </div>
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                고객별 인수인계 메모는 고객 상세 화면의 인수인계 메모 카드에서 작성할 수 있습니다. 민감정보는 메모에 입력하지 마세요.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 인수인계 이력</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일시</TableHead>
                  <TableHead>source</TableHead>
                  <TableHead>target</TableHead>
                  <TableHead>고객/후속/일정/알림</TableHead>
                  <TableHead>상태 변경</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(histories ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">인수인계 이력이 없습니다.</TableCell></TableRow>
                ) : histories?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(item.createdAt).toLocaleString("ko-KR")}</TableCell>
                    <TableCell>#{item.sourceUserId}</TableCell>
                    <TableCell>#{item.targetUserId}</TableCell>
                    <TableCell>{item.transferredCustomerCount}/{item.transferredFollowUpCount}/{item.transferredScheduleCount}/{item.transferredNotificationCount}</TableCell>
                    <TableCell>{item.sourceAccountStatusBefore} → {item.sourceAccountStatusAfter}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> 인수인계 최종 확인
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p>이 작업은 고객 담당자와 미완료 업무 담당자를 변경합니다. 기존 상담기록과 활동 로그는 변경하지 않습니다.</p>
              <p className="text-muted-foreground">진행하려면 아래 입력창에 “인수인계”를 입력하세요.</p>
              <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="인수인계" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>취소</Button>
                <Button
                  disabled={confirmText !== "인수인계" || executeMutation.isPending || !sourceUserId || !targetUserId}
                  onClick={() => sourceUserId && targetUserId && executeMutation.mutate({
                    sourceUserId,
                    targetUserId,
                    transferCustomers,
                    transferFollowUps,
                    transferSchedules,
                    transferNotifications,
                    updateSourceAccountStatus,
                    forceLogoutSource,
                    resetOAuthSource,
                    reason: reason.trim(),
                    confirmText,
                  })}
                >
                  실행
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
