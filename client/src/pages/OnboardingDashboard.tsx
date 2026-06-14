import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  getUserFacingErrorMessage,
  USER_FACING_ERRORS,
} from "@/lib/userFacingMessages";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function safeDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("ko-KR");
}

export default function OnboardingDashboard() {
  const { user } = useAuth();
  const isManager =
    user?.role === "branch_admin" ||
    user?.role === "sub_branch_admin" ||
    user?.role === "team_leader";
  const [targetUserId, setTargetUserId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [trainerUserId, setTrainerUserId] = useState("");
  const [startedAt, setStartedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueAt, setDueAt] = useState(
    new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );

  const templatesQuery = trpc.onboardingTemplates.list.useQuery();
  const summaryQuery = trpc.onboardingAssignments.summary.useQuery(undefined, {
    enabled: !!isManager,
  });
  const assignmentsQuery = trpc.onboardingAssignments.list.useQuery(undefined, {
    enabled: !!isManager,
  });
  const mineQuery = trpc.onboardingAssignments.getMine.useQuery(undefined, {
    enabled: !!user,
  });

  const seedDefaultsMutation =
    trpc.onboardingTemplates.seedDefaults.useMutation({
      onSuccess: async () => {
        toast.success("기본 온보딩 템플릿을 준비했습니다.");
        await templatesQuery.refetch();
      },
      onError: error =>
        toast.error(
          getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed)
        ),
    });

  const assignMutation = trpc.onboardingAssignments.assign.useMutation({
    onSuccess: async () => {
      toast.success("온보딩 체크리스트 배정을 완료했습니다.");
      await Promise.all([
        assignmentsQuery.refetch(),
        mineQuery.refetch(),
        summaryQuery.refetch(),
      ]);
    },
    onError: error =>
      toast.error(
        getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed)
      ),
  });

  const updateItemMutation =
    trpc.onboardingAssignments.updateItemProgress.useMutation({
      onSuccess: async () => {
        toast.success("항목 완료 상태를 반영했습니다.");
        await mineQuery.refetch();
      },
      onError: error =>
        toast.error(
          getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed)
        ),
    });

  const approveItemMutation =
    trpc.onboardingAssignments.approveItem.useMutation({
      onSuccess: async () => {
        toast.success("승인 처리가 완료되었습니다.");
        await Promise.all([
          assignmentsQuery.refetch(),
          summaryQuery.refetch(),
          mineQuery.refetch(),
        ]);
      },
      onError: error =>
        toast.error(
          getUserFacingErrorMessage(error, USER_FACING_ERRORS.saveFailed)
        ),
    });

  const mineAssignments = mineQuery.data ?? [];
  const managerAssignments = assignmentsQuery.data?.filter(Boolean) ?? [];
  const pendingApprovals = useMemo(
    () =>
      managerAssignments.flatMap((assignment: any) =>
        (assignment.items ?? [])
          .filter((item: any) => item.progress?.status === "needs_approval")
          .map((item: any) => ({
            assignmentId: assignment.id,
            progressId: item.progress.id,
            userName:
              assignment.targetUser?.name ??
              `사용자#${assignment.targetUserId}`,
            itemTitle: item.title,
          }))
      ),
    [managerAssignments]
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isManager ? "온보딩·교육 체크리스트" : "내 교육 체크리스트"}
            </h1>
            <p className="text-sm text-muted-foreground">
              실제 고객정보가 아닌 [TEST] 기준 실습으로 온보딩을 진행합니다.
            </p>
          </div>
          {user?.role === "branch_admin" ? (
            <Button
              onClick={() => seedDefaultsMutation.mutate()}
              disabled={seedDefaultsMutation.isPending}
            >
              기본 템플릿 준비
            </Button>
          ) : null}
        </div>

        {isManager && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">
                    전체 교육 대상
                  </p>
                  <p className="text-xl font-bold">
                    {summaryQuery.data?.total ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">진행 중</p>
                  <p className="text-xl font-bold">
                    {summaryQuery.data?.inProgress ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">완료</p>
                  <p className="text-xl font-bold">
                    {summaryQuery.data?.completed ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">지연</p>
                  <p className="text-xl font-bold text-amber-600">
                    {summaryQuery.data?.overdue ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">승인 대기</p>
                  <p className="text-xl font-bold">
                    {summaryQuery.data?.approvalPending ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">필수 미완료</p>
                  <p className="text-xl font-bold text-red-600">
                    {summaryQuery.data?.requiredIncomplete ?? 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>체크리스트 배정</CardTitle>
                <CardDescription>
                  대상 사용자 ID를 입력해 템플릿을 배정합니다.
                  inactive/resigned는 배정할 수 없습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <div>
                  <Label>대상 직원 ID</Label>
                  <Input
                    value={targetUserId}
                    onChange={e => setTargetUserId(e.target.value)}
                    placeholder="예: 101"
                  />
                </div>
                <div>
                  <Label>템플릿</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="템플릿 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {(templatesQuery.data ?? []).map((template: any) => (
                        <SelectItem
                          key={template.id}
                          value={String(template.id)}
                        >
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>교육자 ID</Label>
                  <Input
                    value={trainerUserId}
                    onChange={e => setTrainerUserId(e.target.value)}
                    placeholder="선택"
                  />
                </div>
                <div>
                  <Label>시작일</Label>
                  <Input
                    type="date"
                    value={startedAt}
                    onChange={e => setStartedAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label>목표 완료일</Label>
                  <Input
                    type="date"
                    value={dueAt}
                    onChange={e => setDueAt(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardContent>
                <Button
                  className="min-h-10"
                  disabled={
                    !targetUserId || !templateId || assignMutation.isPending
                  }
                  onClick={() =>
                    assignMutation.mutate({
                      targetUserId: Number(targetUserId),
                      templateId: Number(templateId),
                      trainerUserId: trainerUserId
                        ? Number(trainerUserId)
                        : undefined,
                      startedAt: new Date(startedAt).toISOString(),
                      dueAt: new Date(dueAt).toISOString(),
                    })
                  }
                >
                  체크리스트 배정
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>승인 대기 항목</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingApprovals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    승인 대기 항목이 없습니다.
                  </p>
                ) : null}
                {pendingApprovals.map(item => (
                  <div
                    key={item.progressId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <p className="text-sm">
                      {item.userName} · {item.itemTitle}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="min-h-10"
                        onClick={() =>
                          approveItemMutation.mutate({
                            progressId: item.progressId,
                            decision: "approved",
                          })
                        }
                      >
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10"
                        onClick={() =>
                          approveItemMutation.mutate({
                            progressId: item.progressId,
                            decision: "rejected",
                          })
                        }
                      >
                        반려
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {isManager ? "대상자별 진행 현황" : "내 진행 현황"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(isManager ? managerAssignments : mineAssignments).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                배정된 온보딩이 없습니다.
              </p>
            ) : null}
            {(isManager ? managerAssignments : mineAssignments).map(
              (assignment: any) => (
                <div key={assignment.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {assignment.targetUser?.name ??
                          `사용자#${assignment.targetUserId}`}{" "}
                        · {assignment.template?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        진행률 {assignment.progressPercent}% · 필수 미완료{" "}
                        {assignment.requiredPendingCount} · 승인 대기{" "}
                        {assignment.approvalPendingCount}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          assignment.status === "overdue"
                            ? "destructive"
                            : assignment.status === "completed"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {assignment.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        목표일 {safeDate(assignment.dueAt)}
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={assignment.progressPercent ?? 0}
                    className="mt-2"
                  />
                  <div className="mt-3 space-y-2">
                    {(assignment.items ?? []).map((item: any) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.description ||
                              item.completionCriteria ||
                              "교육 설명 없음"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.required ? (
                              <Badge
                                variant="destructive"
                                className="bg-red-100 text-red-700"
                              >
                                필수
                              </Badge>
                            ) : null}
                            {item.practiceRequired ? (
                              <Badge variant="outline">실습</Badge>
                            ) : null}
                            {item.requiresManagerApproval ? (
                              <Badge variant="outline">관리자 승인 필요</Badge>
                            ) : null}
                            <Badge variant="secondary">
                              {item.progress?.status ?? "pending"}
                            </Badge>
                          </div>
                        </div>
                        {user?.id === assignment.targetUserId ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" className="min-h-10">
                                완료 체크
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>항목 완료 처리</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                실습은 [TEST] 고객 기준으로 진행하고, 실제
                                고객정보를 사용하지 마세요.
                              </p>
                              <DialogFooter>
                                <Button
                                  onClick={() =>
                                    updateItemMutation.mutate({
                                      assignmentId: assignment.id,
                                      itemId: item.id,
                                    })
                                  }
                                  disabled={updateItemMutation.isPending}
                                >
                                  완료 체크
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {templatesQuery.isLoading ||
        summaryQuery.isLoading ||
        assignmentsQuery.isLoading ||
        mineQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            온보딩 데이터를 불러오는 중입니다.
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
