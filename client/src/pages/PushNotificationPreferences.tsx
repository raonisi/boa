import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Bell, Moon } from "lucide-react";
import { toast } from "sonner";

type PreferenceKey =
  | "followUpTodayEnabled"
  | "scheduleReminderEnabled"
  | "deleteRequestEnabled"
  | "testNotificationEnabled";

const notificationRows: Array<{
  key: PreferenceKey;
  title: string;
  description: string;
}> = [
  {
    key: "followUpTodayEnabled",
    title: "오늘 연락 대상 알림",
    description: "오늘 확인해야 할 후속관리 알림을 받습니다.",
  },
  {
    key: "scheduleReminderEnabled",
    title: "일정 알림",
    description: "일정별 알림 시간과 미완료 일정 알림을 받습니다.",
  },
  {
    key: "deleteRequestEnabled",
    title: "계약 삭제 요청 알림",
    description: "처리할 계약 삭제 요청 알림을 받습니다.",
  },
  {
    key: "testNotificationEnabled",
    title: "테스트 알림",
    description: "기기 등록 상태 확인용 테스트 알림을 받습니다.",
  },
];

export default function PushNotificationPreferences() {
  const utils = trpc.useUtils();
  const { data: preferences, isLoading } =
    trpc.pushNotifications.getPreferences.useQuery();
  const updateMutation = trpc.pushNotifications.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("앱 알림 설정이 저장되었습니다.");
      utils.pushNotifications.getPreferences.invalidate();
    },
    onError: () => toast.error("앱 알림 설정 저장에 실패했습니다."),
  });

  const update = (patch: Record<string, unknown>) => {
    updateMutation.mutate(patch as any);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
                  Push Preferences
                </p>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950">
                  <Bell className="h-6 w-6 text-slate-700" /> 앱 알림 설정
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  알림을 꺼도 BOA CRM 앱과 웹 사용에는 영향이 없습니다. 잠금화면
                  알림에는 고객명, 전화번호, 보험정보가 표시되지 않습니다.
                </p>
              </div>
              <Badge className="w-fit bg-slate-100 text-slate-700">
                Asia/Seoul
              </Badge>
            </div>
          </CardContent>
        </Card>

        {isLoading || !preferences ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              알림 설정을 불러오는 중입니다.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">알림 종류</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 p-0">
                {notificationRows.map(row => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{row.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {row.description}
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(preferences[row.key])}
                      onCheckedChange={checked =>
                        update({ [row.key]: checked })
                      }
                      disabled={updateMutation.isPending}
                      aria-label={row.title}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Moon className="h-4 w-4 text-slate-700" /> 조용한 시간대
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      조용한 시간대 사용
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      기본값은 21:00부터 08:00까지입니다.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.quietHoursEnabled}
                    onCheckedChange={checked =>
                      update({ quietHoursEnabled: checked })
                    }
                    disabled={updateMutation.isPending}
                    aria-label="조용한 시간대 사용"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs text-slate-500">시작</Label>
                    <Input
                      type="time"
                      value={preferences.quietHoursStart}
                      onChange={event =>
                        update({ quietHoursStart: event.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">종료</Label>
                    <Input
                      type="time"
                      value={preferences.quietHoursEnd}
                      onChange={event =>
                        update({ quietHoursEnd: event.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">시간대</Label>
                    <Input
                      value={preferences.timezone}
                      onChange={event =>
                        update({ timezone: event.target.value || "Asia/Seoul" })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-blue-100 bg-blue-50/80">
          <CardContent className="p-4 text-sm text-blue-800">
            업무 알림은 고객정보를 잠금화면에 표시하지 않는 고정 문구로만
            발송됩니다. 알림 설정은 본인 계정에만 적용됩니다.
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
