import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CAMPAIGN_TYPES = [
  { value: "contract_30", label: "계약 30일" },
  { value: "contract_90", label: "계약 90일" },
  { value: "contract_180", label: "계약 180일" },
  { value: "contract_365", label: "계약 365일" },
  { value: "birthday", label: "생일" },
  { value: "long_unmanaged", label: "장기 미관리" },
  { value: "incomplete_schedule", label: "미완료 일정" },
  { value: "claim_guide", label: "청구 안내" },
] as const;

type CampaignType = (typeof CAMPAIGN_TYPES)[number]["value"];

function statusLabel(status: string) {
  if (status === "completed") return "처리완료";
  if (status === "overdue") return "지연";
  return "미처리";
}

export default function AftercareCampaigns() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [campaignType, setCampaignType] = useState<CampaignType>("contract_30");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "completed" | "overdue"
  >("all");
  const utils = trpc.useUtils();

  const isMember = user?.role === "member";
  const scopeTitle = isMember ? "내 사후관리 대상" : "사후관리 캠페인";

  const summaryQuery = trpc.aftercareCampaigns.summary.useQuery({
    statusFilter,
  });
  const detailQuery = trpc.aftercareCampaigns.detail.useQuery({
    campaignType,
    statusFilter,
  });

  const createFollowUpMutation =
    trpc.aftercareCampaigns.createFollowUpForTarget.useMutation({
      onSuccess: async () => {
        toast.success("후속관리 생성이 완료되었습니다.");
        await Promise.all([summaryQuery.refetch(), detailQuery.refetch()]);
      },
      onError: error => toast.error(error.message),
    });
  const logMessageCopyMutation =
    trpc.consultationTools.logMessageCopy.useMutation();

  const recommendedTemplatesQuery =
    trpc.aftercareCampaigns.getRecommendedTemplates.useQuery({ campaignType });

  const campaignCards = summaryQuery.data?.campaigns ?? [];
  const selectedCampaign = detailQuery.data;
  const topSummary = summaryQuery.data?.summary;

  const templateGuideText = useMemo(() => {
    const items = recommendedTemplatesQuery.data ?? [];
    if (items.length === 0) return "추천 템플릿이 없습니다.";
    return items
      .slice(0, 3)
      .map(item => item.title)
      .join(" / ");
  }, [recommendedTemplatesQuery.data]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{scopeTitle}</h1>
            <p className="text-sm text-muted-foreground">
              자동 발송 없이 대상자를 추출하고 후속관리·상담기록으로 연결하는
              운영 화면입니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Select
              value={campaignType}
              onValueChange={(value: CampaignType) => setCampaignType(value)}
            >
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="캠페인 유형" />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(
                value: "all" | "pending" | "completed" | "overdue"
              ) => setStatusFilter(value)}
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="pending">미처리</SelectItem>
                <SelectItem value="completed">처리완료</SelectItem>
                <SelectItem value="overdue">지연</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">전체 대상</p>
              <p className="text-xl font-bold">
                {topSummary?.targetCount ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">미처리</p>
              <p className="text-xl font-bold">
                {topSummary?.pendingCount ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">처리완료</p>
              <p className="text-xl font-bold">
                {topSummary?.completedCount ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">지연</p>
              <p className="text-xl font-bold text-amber-600">
                {topSummary?.overdueCount ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">고위험</p>
              <p className="text-xl font-bold text-red-600">
                {topSummary?.highRiskCount ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {campaignCards.map(item => (
            <button
              type="button"
              key={item.campaignType}
              onClick={() => setCampaignType(item.campaignType as CampaignType)}
              className={`rounded-xl border p-3 text-left transition ${item.campaignType === campaignType ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <p className="text-sm font-semibold">
                {
                  CAMPAIGN_TYPES.find(type => type.value === item.campaignType)
                    ?.label
                }
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.policy}
              </p>
              <p className="mt-2 text-lg font-bold">
                {item.summary.targetCount}명
              </p>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedCampaign?.policy ?? "캠페인 상세"}</CardTitle>
            <CardDescription>추천 템플릿: {templateGuideText}</CardDescription>
          </CardHeader>
          <CardContent>
            {detailQuery.isLoading ? (
              <div className="flex h-28 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                대상자를 계산하는 중입니다.
              </div>
            ) : (
              <div className="space-y-3">
                {(selectedCampaign?.targets ?? []).length === 0 && (
                  <div className="rounded-lg border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    현재 조건의 대상자가 없습니다.
                  </div>
                )}
                {(selectedCampaign?.targets ?? []).map(target => (
                  <div
                    key={`${target.customerId}-${target.reason}`}
                    className="rounded-xl border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {target.customerDisplayName}
                      </p>
                      <Badge
                        variant={
                          target.status === "overdue"
                            ? "destructive"
                            : target.status === "completed"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {statusLabel(target.status)}
                      </Badge>
                      {target.highRisk ? (
                        <Badge
                          variant="destructive"
                          className="bg-red-100 text-red-700"
                        >
                          고위험
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      담당자: {target.assignedUserName}
                    </p>
                    <p className="mt-1 text-sm">{target.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      추천 액션: {target.recommendedAction}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Button
                        className="min-h-10"
                        onClick={() =>
                          createFollowUpMutation.mutate({
                            campaignType,
                            customerId: target.customerId,
                            reason: target.reason,
                            dueDate: new Date(target.dueDate).toISOString(),
                            memo: target.recommendedAction,
                          })
                        }
                        disabled={createFollowUpMutation.isPending}
                      >
                        후속관리 생성
                      </Button>
                      <Button
                        className="min-h-10"
                        variant="outline"
                        onClick={() =>
                          setLocation(target.links.customerDetailPath)
                        }
                      >
                        고객 상세 이동
                      </Button>
                      <Button
                        className="min-h-10"
                        variant="outline"
                        onClick={async () => {
                          const firstTemplateId =
                            target.recommendedTemplateIds?.[0];
                          if (!firstTemplateId) {
                            toast.info("추천 템플릿이 없습니다.");
                            return;
                          }
                          const rendered =
                            await utils.consultationTools.renderMessageTemplate.fetch(
                              {
                                templateId: firstTemplateId,
                                customerId: target.customerId,
                              }
                            );
                          await navigator.clipboard.writeText(rendered.body);
                          await logMessageCopyMutation.mutateAsync({
                            templateId: firstTemplateId,
                            customerId: target.customerId,
                            channel: rendered.channel as any,
                          });
                          toast.success("문구가 클립보드에 복사되었습니다.");
                        }}
                      >
                        문구 템플릿 복사
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
