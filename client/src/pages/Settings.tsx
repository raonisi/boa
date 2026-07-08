import DashboardLayout from "@/components/DashboardLayout";
import { AppVersionCard } from "@/components/app/AppVersionCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type SettingCategory =
  | "productGroup"
  | "insurer"
  | "source"
  | "region"
  | "consultStatus"
  | "scheduleType"
  | "paymentStatus"
  | "contractStatus";

const categoryLabels: Record<SettingCategory, string> = {
  productGroup: "상품군",
  insurer: "보험사",
  source: "유입경로",
  region: "지역",
  consultStatus: "상담상태",
  scheduleType: "일정유형",
  paymentStatus: "납입상태",
  contractStatus: "계약상태",
};

export default function Settings() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<SettingCategory>("productGroup");
  const [showAdd, setShowAdd] = useState(false);
  const [newValue, setNewValue] = useState("");

  const {
    data: settings,
    isLoading: isSettingsLoading,
    isError: isSettingsError,
    refetch: refetchSettings,
  } = trpc.settings.list.useQuery({
    category: activeTab,
  });

  const createMutation = trpc.settings.create.useMutation({
    onSuccess: () => {
      toast.success("항목이 추가되었습니다.");
      setShowAdd(false);
      setNewValue("");
      utils.settings.list.invalidate();
    },
    onError: () => toast.error("추가에 실패했습니다."),
  });

  const toggleMutation = trpc.settings.toggle.useMutation({
    onSuccess: () => {
      utils.settings.list.invalidate();
    },
    onError: () => toast.error("상태 변경에 실패했습니다."),
  });

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("수정되었습니다.");
      utils.settings.list.invalidate();
      setEditItem(null);
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const [editItem, setEditItem] = useState<{
    id: number;
    value: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <SettingsIcon className="h-6 w-6" /> 설정 관리
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              지점장 전용 — 마스터 데이터를 관리합니다.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> 항목 추가
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={v => setActiveTab(v as SettingCategory)}
        >
          <TabsList className="flex-wrap h-auto gap-1">
            {(Object.keys(categoryLabels) as SettingCategory[]).map(cat => (
              <TabsTrigger key={cat} value={cat}>
                {categoryLabels[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(categoryLabels) as SettingCategory[]).map(cat => (
            <TabsContent key={cat} value={cat}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {categoryLabels[cat]} 목록
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isSettingsLoading ? (
                    <div className="p-4">
                      <LoadingState
                        title="설정을 불러오는 중입니다."
                        description="설정 항목을 준비하고 있습니다."
                        compact
                      />
                    </div>
                  ) : isSettingsError ? (
                    <div className="p-4">
                      <ErrorState
                        title="설정을 불러오지 못했습니다."
                        description="잠시 후 다시 시도해 주세요."
                        retryLabel="새로고침"
                        onRetry={() => refetchSettings()}
                        compact
                      />
                    </div>
                  ) : (settings ?? []).length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        title="등록된 설정이 없습니다."
                        description="새 항목을 추가하면 이 화면에서 바로 관리할 수 있습니다."
                        actionLabel="항목 추가"
                        onAction={() => setShowAdd(true)}
                        compact
                      />
                    </div>
                  ) : (
                    <div className="divide-y">
                      {(settings ?? []).map(s => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-2 w-2 rounded-full ${s.isActive ? "bg-green-500" : "bg-gray-300"}`}
                            />
                            <span
                              className={`text-sm ${!s.isActive ? "text-muted-foreground line-through" : ""}`}
                            >
                              {s.value}
                            </span>
                            {!s.isActive && (
                              <span className="text-xs text-muted-foreground">
                                (비활성)
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600"
                              onClick={() => {
                                setEditItem({ id: s.id, value: s.value });
                                setEditValue(s.value);
                              }}
                            >
                              수정
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 text-xs ${s.isActive ? "text-muted-foreground" : "text-green-600"}`}
                              onClick={() =>
                                toggleMutation.mutate({
                                  id: s.id,
                                  isActive: !s.isActive,
                                })
                              }
                            >
                              {s.isActive ? "비활성화" : "활성화"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <AppVersionCard />
      </div>

      {/* 항목 수정 모달 */}
      {editItem && (
        <Dialog open={true} onOpenChange={() => setEditItem(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{categoryLabels[activeTab]} 항목 수정</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">항목 이름</Label>
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="h-9 mt-1"
                  onKeyDown={e => {
                    if (e.key === "Enter" && editValue && editItem)
                      updateMutation.mutate({
                        id: editItem.id,
                        value: editValue,
                      });
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditItem(null)}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  disabled={!editValue || updateMutation.isPending}
                  onClick={() =>
                    editItem &&
                    updateMutation.mutate({ id: editItem.id, value: editValue })
                  }
                >
                  {updateMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 항목 추가 모달 */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{categoryLabels[activeTab]} 항목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">항목 이름</Label>
              <Input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="h-9 mt-1"
                placeholder={`예: ${activeTab === "productGroup" ? "종신보험" : activeTab === "insurer" ? "삼성생명" : "새 항목"}`}
                onKeyDown={e => {
                  if (e.key === "Enter" && newValue)
                    createMutation.mutate({
                      category: activeTab,
                      value: newValue,
                    });
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdd(false)}
              >
                취소
              </Button>
              <Button
                size="sm"
                disabled={!newValue || createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    category: activeTab,
                    value: newValue,
                  })
                }
              >
                {createMutation.isPending ? "추가 중..." : "추가"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
