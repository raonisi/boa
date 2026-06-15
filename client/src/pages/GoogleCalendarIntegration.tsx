import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { adminPage } from "@/lib/adminDesignTokens";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Link2, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const calendarTypeLabels: Record<string, string> = {
  branch_common: "BOA 지점 공통 일정",
  consultation_followup: "BOA 상담·후속관리 일정",
  admin: "BOA 관리자 일정",
};

const syncStatusLabels: Record<string, string> = {
  pending: "대기",
  synced: "동기화됨",
  failed: "실패",
  deleted: "삭제됨",
  skipped: "건너뜀",
};

export default function GoogleCalendarIntegration() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.googleCalendar.getSettings.useQuery();
  const syncQuery = trpc.googleCalendar.listSyncStatus.useQuery({ limit: 100 });
  const failedQuery = trpc.googleCalendar.listFailedSyncs.useQuery(undefined, {
    enabled: settingsQuery.data?.canManage ?? false,
  });
  const oauthUrlQuery = trpc.googleCalendar.getOAuthConnectUrl.useQuery(
    undefined,
    { enabled: false }
  );

  const upsertMutation = trpc.googleCalendar.upsertCalendarIntegration.useMutation({
    onSuccess: async () => {
      toast.success("캘린더 설정이 저장되었습니다.");
      await utils.googleCalendar.getSettings.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const testMutation = trpc.googleCalendar.testCalendarAccess.useMutation({
    onSuccess: async result => {
      toast[result.ok ? "success" : "error"](
        result.ok ? "캘린더 연결 테스트에 성공했습니다." : result.errorMessageSafe
      );
      await utils.googleCalendar.getSettings.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const retryMutation = trpc.googleCalendar.retryFailedSync.useMutation({
    onSuccess: async result => {
      toast[result.success ? "success" : "error"](
        result.success ? "재시도에 성공했습니다." : "재시도에 실패했습니다."
      );
      await Promise.all([
        utils.googleCalendar.listSyncStatus.invalidate(),
        utils.googleCalendar.listFailedSyncs.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message),
  });
  const syncPolicyMutation = trpc.googleCalendar.updateSyncPolicy.useMutation({
    onSuccess: async () => {
      toast.success("Google Calendar 동기화 정책이 저장되었습니다.");
      await utils.googleCalendar.getSettings.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const contactPolicyMutation =
    trpc.googleCalendar.updateContactPolicy.useMutation({
      onSuccess: async () => {
        toast.success("연락처 표시 정책이 저장되었습니다.");
        await utils.googleCalendar.getSettings.invalidate();
      },
      onError: e => toast.error(e.message),
    });
  const personalSettingsMutation =
    trpc.googleCalendar.upsertPersonalSettings.useMutation({
      onSuccess: async () => {
        toast.success("개인 캘린더 설정이 저장되었습니다.");
        await utils.googleCalendar.getSettings.invalidate();
      },
      onError: e => toast.error(e.message),
    });

  const [forms, setForms] = useState<Record<string, string>>({});
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewType, setPreviewType] = useState("고객상담");
  const [previewTargetType, setPreviewTargetType] = useState<
    "shared_calendar" | "actor_personal_calendar"
  >("shared_calendar");
  const [personalCalendarId, setPersonalCalendarId] = useState("");
  const [contactDisplayConsent, setContactDisplayConsent] = useState(false);
  const previewQuery = trpc.googleCalendar.previewSafeEventPayload.useQuery(
    {
      rawTitle: previewTitle || undefined,
      scheduleType: previewType as any,
      customerReference: "A-102",
      segmentLabel: "보장점검",
      previewTargetType,
      includeCustomerContact:
        previewTargetType === "actor_personal_calendar" &&
        (settingsQuery.data?.includeCustomerContactForActorCalendar ?? false),
      customerContactPreview: "010-****-5678",
      viewerUserId: undefined,
    },
    { enabled: previewTitle.length > 0 }
  );

  const canManage = settingsQuery.data?.canManage ?? false;

  const integrationMap = useMemo(() => {
    const integrations = settingsQuery.data?.integrations ?? [];
    const map = new Map<string, (typeof integrations)[number]>();
    for (const row of integrations) {
      map.set(row.calendarType, row);
    }
    return map;
  }, [settingsQuery.data?.integrations]);

  const handleConnectOAuth = async () => {
    const result = await oauthUrlQuery.refetch();
    const url = result.data?.url;
    if (!url) {
      toast.error("Google OAuth 연결 URL을 가져오지 못했습니다.");
      return;
    }
    window.location.href = url;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Google Calendar 연동 관리
            </h1>
            <p className="text-sm text-muted-foreground">
              기본값은 안전 제목 모드입니다. 지점장이 원문 동기화를 켜면 Google
              Calendar에 입력한 제목·설명과 고객 정보가 표시될 수 있습니다.
              activity_logs에는 원문 개인정보를 저장하지 않습니다.
            </p>
          </div>
          {canManage ? (
            <Button onClick={handleConnectOAuth} variant="outline">
              <Link2 className="mr-2 h-4 w-4" />
              Google Calendar OAuth 연결
            </Button>
          ) : null}
        </div>

        <Tabs defaultValue="settings" className="mt-6">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="settings">캘린더 설정</TabsTrigger>
            <TabsTrigger value="status">동기화 상태</TabsTrigger>
            <TabsTrigger value="retry">실패 재시도</TabsTrigger>
            <TabsTrigger value="preview">안전 제목 미리보기</TabsTrigger>
            <TabsTrigger value="guide">지점원 안내</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <Card className={adminPage.card}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5" />
                  OAuth / 캘린더 연결 상태
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>OAuth 연결</span>
                  <Badge variant={settingsQuery.data?.oauthConnected ? "default" : "secondary"}>
                    {settingsQuery.data?.oauthConnected ? "연결됨" : "미연결"}
                  </Badge>
                </div>
                {settingsQuery.data?.oauthLastTestErrorSafe ? (
                  <p className="text-destructive">
                    {settingsQuery.data.oauthLastTestErrorSafe}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {canManage ? (
              <Card className={adminPage.card}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    Google Calendar 원문 동기화 정책
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    이 설정을 켜면 Google Calendar 공유 대상에게 고객 이름과
                    연락처가 보일 수 있습니다. 공유 대상과 권한을 확인한 뒤
                    사용하세요.
                  </p>
                  {(
                    [
                      {
                        key: "syncRawTitleToGoogleCalendar" as const,
                        label: "Google Calendar에 원문 제목 표시",
                        description:
                          "이 설정을 켜면 BOA CRM에 입력한 일정 제목이 Google Calendar에 그대로 표시됩니다.",
                      },
                      {
                        key: "syncRawDescriptionToGoogleCalendar" as const,
                        label: "Google Calendar에 원문 설명 표시",
                        description:
                          "이 설정을 켜면 BOA CRM에 입력한 일정 설명이 Google Calendar에 그대로 표시됩니다.",
                      },
                      {
                        key: "allowCustomerNameInGoogleCalendar" as const,
                        label: "Google Calendar에 고객 이름 표시 허용",
                        description:
                          "이 설정을 켜면 Google Calendar 일정 제목과 설명에 고객 이름이 표시될 수 있습니다.",
                      },
                      {
                        key: "allowCustomerContactInGoogleCalendar" as const,
                        label: "Google Calendar에 고객 연락처 표시 허용",
                        description:
                          "이 설정을 켜면 Google Calendar 일정 제목과 설명에 고객 연락처가 표시될 수 있습니다.",
                      },
                    ] as const
                  ).map(item => (
                    <div key={item.key} className="space-y-2 border-b pb-4 last:border-0">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={settingsQuery.data?.[item.key] ?? false}
                          onCheckedChange={checked =>
                            syncPolicyMutation.mutate({ [item.key]: checked })
                          }
                          disabled={syncPolicyMutation.isPending}
                        />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <p className="text-muted-foreground pl-11">{item.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {canManage ? (
              <Card className={adminPage.card}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    등록자·담당자 개인 캘린더에 연락처 표시 (레거시)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    원문 동기화 정책이 꺼져 있을 때, 상담·후속관리 일정의 등록자 또는
                    담당자 개인 Google Calendar 설명란에만 고객 연락처를 조건부로
                    표시합니다. 원문 동기화 정책을 사용하는 경우 이 설정은 적용되지
                    않습니다.
                  </p>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={
                        settingsQuery.data?.includeCustomerContactForActorCalendar ??
                        false
                      }
                      onCheckedChange={checked =>
                        contactPolicyMutation.mutate({
                          includeCustomerContactForActorCalendar: checked,
                        })
                      }
                      disabled={contactPolicyMutation.isPending}
                    />
                    <span>지점 전체 정책 (기본값: 꺼짐)</span>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className={adminPage.card}>
              <CardHeader>
                <CardTitle className="text-lg">내 개인 Google Calendar 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="personal-calendar-id">개인 calendarId</Label>
                  <Input
                    id="personal-calendar-id"
                    placeholder="primary 또는 example@gmail.com"
                    defaultValue={
                      settingsQuery.data?.personalSettings.personalCalendarIdMasked ??
                      ""
                    }
                    onChange={e => setPersonalCalendarId(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={
                      contactDisplayConsent ||
                      settingsQuery.data?.personalSettings.contactDisplayConsent
                    }
                    onCheckedChange={setContactDisplayConsent}
                  />
                  <span className="text-sm">개인 캘린더 설명란 연락처 표시 동의</span>
                </div>
                <Button
                  variant="outline"
                  disabled={personalSettingsMutation.isPending}
                  onClick={() =>
                    personalSettingsMutation.mutate({
                      personalCalendarId: personalCalendarId || undefined,
                      contactDisplayConsent,
                      isActive: true,
                    })
                  }
                >
                  내 설정 저장
                </Button>
              </CardContent>
            </Card>

            {(["branch_common", "consultation_followup", "admin"] as const).map(
              type => {
                const row = integrationMap.get(type);
                return (
                  <Card key={type} className={adminPage.card}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {calendarTypeLabels[type]}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`calendar-${type}`}>calendarId</Label>
                        <Input
                          id={`calendar-${type}`}
                          disabled={!canManage}
                          placeholder="example@group.calendar.google.com"
                          defaultValue={row?.googleCalendarIdMasked ?? ""}
                          onChange={e =>
                            setForms(prev => ({ ...prev, [type]: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={row?.isActive ?? false} disabled />
                          <span className="text-sm">활성</span>
                        </div>
                        {row?.lastTestResult ? (
                          <Badge
                            variant={
                              row.lastTestResult === "success"
                                ? "default"
                                : "destructive"
                            }
                          >
                            테스트 {row.lastTestResult}
                          </Badge>
                        ) : null}
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={upsertMutation.isPending}
                            onClick={() =>
                              upsertMutation.mutate({
                                calendarType: type,
                                googleCalendarId:
                                  forms[type] ??
                                  row?.googleCalendarIdMasked ??
                                  "",
                                isActive: true,
                              })
                            }
                          >
                            저장
                          </Button>
                          <Button
                            variant="outline"
                            disabled={testMutation.isPending}
                            onClick={() =>
                              testMutation.mutate({
                                calendarType: type,
                                googleCalendarId: forms[type],
                              })
                            }
                          >
                            연결 테스트
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          calendarId 등록은 지점장만 가능합니다.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              }
            )}
          </TabsContent>

          <TabsContent value="status">
            <Card className={adminPage.card}>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>대상</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>BOA ID</TableHead>
                      <TableHead>캘린더</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>마지막 동기화</TableHead>
                      <TableHead>실패 사유</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(syncQuery.data ?? []).map(row => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.syncTargetType === "actor_personal_calendar"
                            ? `개인 #${row.targetUserId}`
                            : "공유"}
                        </TableCell>
                        <TableCell>{row.boaEventType}</TableCell>
                        <TableCell>{row.boaEventId}</TableCell>
                        <TableCell>{calendarTypeLabels[row.calendarType]}</TableCell>
                        <TableCell>{syncStatusLabels[row.syncStatus] ?? row.syncStatus}</TableCell>
                        <TableCell>{row.contactIncluded ? "포함" : "미포함"}</TableCell>
                        <TableCell>
                          {row.lastSyncedAt
                            ? new Date(row.lastSyncedAt).toLocaleString("ko-KR")
                            : "-"}
                        </TableCell>
                        <TableCell>{row.lastErrorMessageSafe ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retry">
            <Card className={adminPage.card}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  실패 재시도
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!canManage ? (
                  <p className="text-sm text-muted-foreground">
                    실패 재시도는 지점장만 실행할 수 있습니다.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>BOA 일정</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>재시도</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(failedQuery.data ?? []).map(row => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {row.boaEventType} #{row.boaEventId}
                          </TableCell>
                          <TableCell>{row.lastErrorMessageSafe ?? "-"}</TableCell>
                          <TableCell>{row.retryCount}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={retryMutation.isPending}
                              onClick={() =>
                                retryMutation.mutate({ syncId: row.id })
                              }
                            >
                              재시도
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card className={adminPage.card}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  안전 제목 미리보기
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>내부 일정 제목</Label>
                  <Input
                    value={previewTitle}
                    onChange={e => setPreviewTitle(e.target.value)}
                    placeholder="예: A-102 보장점검 상담"
                  />
                </div>
                <div className="space-y-2">
                  <Label>미리보기 대상</Label>
                  <Select
                    value={previewTargetType}
                    onValueChange={v =>
                      setPreviewTargetType(
                        v as "shared_calendar" | "actor_personal_calendar"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared_calendar">공유 캘린더</SelectItem>
                      <SelectItem value="actor_personal_calendar">
                        등록자·담당자 개인 캘린더
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>일정 유형</Label>
                  <Select value={previewType} onValueChange={setPreviewType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "고객상담",
                        "재통화",
                        "계약예정",
                        "보장분석",
                        "팀회의",
                        "교육",
                      ].map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {previewQuery.data?.blocked ? (
                  <p className="text-sm text-destructive">
                    {previewQuery.data.message}
                  </p>
                ) : previewQuery.data && !previewQuery.data.blocked ? (
                  <Textarea
                    readOnly
                    value={`제목: ${previewQuery.data.title}\n\n설명:\n${previewQuery.data.description}`}
                  />
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guide" className="space-y-4">
            <Card className={adminPage.card}>
              <CardContent className="space-y-4 pt-6 text-sm leading-6">
                <p>
                  1. Google Calendar에서 공유 캘린더 3개를 수동으로 생성합니다.
                </p>
                <p>
                  2. 지점장이 BOA CRM 설정 화면에서 각 calendarId를 등록하고 연결
                  테스트를 수행합니다.
                </p>
                <p>
                  3. 지점원은 Google Calendar 공유 초대를 수락한 뒤, TimeTree에서는
                  외부 캘린더(Google) 구독으로 표시할 수 있습니다.
                </p>
                <p>
                  4. 공유 캘린더에는 고객 연락처가 표시되지 않습니다. 연락처는 일정
                  등록자 또는 담당자의 개인 캘린더 설명란에만 조건부 표시됩니다.
                </p>
                <p>
                  5. 고객 실명·연락처·질병명·증권번호·보험상품명·보험료는 외부
                  캘린더 제목/위치/활동 로그에 기록하지 마세요.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
