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

  const [forms, setForms] = useState<Record<string, string>>({});
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewType, setPreviewType] = useState("고객상담");
  const previewQuery = trpc.googleCalendar.previewSafeEventPayload.useQuery(
    {
      rawTitle: previewTitle || undefined,
      scheduleType: previewType as any,
      customerReference: "A-102",
      segmentLabel: "보장점검",
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
              Google Calendar에는 고객 실명, 연락처, 질병명, 증권번호, 보험상품명,
              보험료를 표시하지 않습니다. 상세 내용은 BOA CRM에서만 확인하세요.
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
                      <TableHead>유형</TableHead>
                      <TableHead>BOA ID</TableHead>
                      <TableHead>캘린더</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>마지막 동기화</TableHead>
                      <TableHead>실패 사유</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(syncQuery.data ?? []).map(row => (
                      <TableRow key={row.id}>
                        <TableCell>{row.boaEventType}</TableCell>
                        <TableCell>{row.boaEventId}</TableCell>
                        <TableCell>{calendarTypeLabels[row.calendarType]}</TableCell>
                        <TableCell>{syncStatusLabels[row.syncStatus] ?? row.syncStatus}</TableCell>
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
                  4. 고객 실명·연락처·질병명·증권번호·보험상품명·보험료는 외부
                  캘린더에 기록하지 마세요.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
