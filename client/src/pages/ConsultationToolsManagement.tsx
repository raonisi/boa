import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, MessageSquareText, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const phases = [
  { value: "before", label: "상담 전" },
  { value: "during", label: "상담 중" },
  { value: "after", label: "상담 후" },
] as const;

const categories = ["basic", "needs", "coverage", "premium", "family", "follow_up", "compliance"] as const;

const situations = [
  "missed_call",
  "proposal_follow_up",
  "pre_contract_check",
  "post_contract_care",
  "long_unmanaged",
  "birthday",
  "follow_up_schedule",
  "document_request",
  "after_consultation",
  "general_check",
] as const;

const scriptCategories = [
  "first_call",
  "missed_call",
  "premium_burden",
  "coverage_concern",
  "family_responsibility",
  "surrender_risk",
  "proposal_follow_up",
  "post_contract_care",
  "long_unmanaged",
  "general_check",
] as const;

const channels = ["kakao", "sms", "both"] as const;

export default function ConsultationToolsManagement() {
  const utils = trpc.useUtils();
  const [checkTitle, setCheckTitle] = useState("");
  const [checkDescription, setCheckDescription] = useState("");
  const [checkPhase, setCheckPhase] = useState<(typeof phases)[number]["value"]>("before");
  const [checkCategory, setCheckCategory] = useState<(typeof categories)[number]>("basic");
  const [checkRequired, setCheckRequired] = useState(false);
  const [checkSort, setCheckSort] = useState(0);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSituation, setTemplateSituation] = useState<(typeof situations)[number]>("missed_call");
  const [templateChannel, setTemplateChannel] = useState<(typeof channels)[number]>("both");
  const [templateBody, setTemplateBody] = useState("");
  const [templateNote, setTemplateNote] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptCategory, setScriptCategory] = useState<(typeof scriptCategories)[number]>("first_call");
  const [scriptBody, setScriptBody] = useState("");
  const [scriptNote, setScriptNote] = useState("");
  const [scriptTags, setScriptTags] = useState("");

  const { data: checklists } = trpc.consultationTools.listChecklists.useQuery({ includeInactive: true });
  const { data: templates } = trpc.consultationTools.listMessageTemplates.useQuery({ includeInactive: true });
  const { data: scripts } = trpc.consultationScripts.list.useQuery({ includeInactive: true });

  const createChecklist = trpc.consultationTools.createChecklist.useMutation({
    onSuccess: () => {
      toast.success("체크리스트 항목을 추가했습니다.");
      setCheckTitle("");
      setCheckDescription("");
      utils.consultationTools.listChecklists.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateChecklist = trpc.consultationTools.updateChecklist.useMutation({
    onSuccess: () => utils.consultationTools.listChecklists.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const seedChecklists = trpc.consultationTools.seedDefaultChecklists.useMutation({
    onSuccess: (result) => {
      toast.success(`기본 체크리스트 ${result.createdCount}건 생성, ${result.reactivatedCount}건 재활성 확인`);
      utils.consultationTools.listChecklists.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const seedTemplates = trpc.consultationTools.seedDefaultMessageTemplates.useMutation({
    onSuccess: (result) => {
      toast.success(`기본 템플릿 ${result.createdCount}건을 확인했습니다.`);
      utils.consultationTools.listMessageTemplates.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const createTemplate = trpc.consultationTools.createMessageTemplate.useMutation({
    onSuccess: () => {
      toast.success("문구 템플릿을 추가했습니다.");
      setTemplateTitle("");
      setTemplateBody("");
      setTemplateNote("");
      utils.consultationTools.listMessageTemplates.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateTemplate = trpc.consultationTools.updateMessageTemplate.useMutation({
    onSuccess: () => utils.consultationTools.listMessageTemplates.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const seedScripts = trpc.consultationScripts.seedDefaults.useMutation({
    onSuccess: (result) => {
      toast.success(`기본 상담 스크립트 ${result.createdCount}건을 확인했습니다.`);
      utils.consultationScripts.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const createScript = trpc.consultationScripts.create.useMutation({
    onSuccess: () => {
      toast.success("상담 스크립트를 추가했습니다.");
      setScriptTitle("");
      setScriptBody("");
      setScriptNote("");
      setScriptTags("");
      utils.consultationScripts.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateScript = trpc.consultationScripts.update.useMutation({
    onSuccess: () => utils.consultationScripts.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Consultation Tools</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">상담 도구 관리</h1>
            <p className="mt-1 text-sm text-slate-500">
              상담 체크리스트, 후속 문구, 상담 스크립트를 관리합니다. 민감정보, 가입 강요, 공포마케팅, 확정 표현은 입력하지 마세요.
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/60 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>사용 가능한 placeholder는 고객명, 담당자명, 다음연락일, 상담주제입니다. 템플릿 본문 전문은 활동 로그에 저장하지 않습니다.</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="checklists" className="space-y-4">
          <TabsList className="h-auto flex-wrap rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger value="checklists">상담 체크리스트</TabsTrigger>
            <TabsTrigger value="templates">후속 문구 템플릿</TabsTrigger>
            <TabsTrigger value="scripts">상담 스크립트</TabsTrigger>
          </TabsList>

          <TabsContent value="checklists" className="space-y-4">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">체크리스트 항목 추가</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <div className="md:col-span-6 flex justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => seedChecklists.mutate()} disabled={seedChecklists.isPending}><RefreshCw className="h-4 w-4 mr-1" />기본 체크리스트 확인</Button>
                </div>
                <div className="md:col-span-2"><Label>제목</Label><Input className="rounded-xl bg-slate-50" value={checkTitle} onChange={(event) => setCheckTitle(event.target.value)} /></div>
                <div><Label>단계</Label><Select value={checkPhase} onValueChange={(value) => setCheckPhase(value as any)}><SelectTrigger className="rounded-xl bg-slate-50"><SelectValue /></SelectTrigger><SelectContent>{phases.map((phase) => <SelectItem key={phase.value} value={phase.value}>{phase.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>카테고리</Label><Select value={checkCategory} onValueChange={(value) => setCheckCategory(value as any)}><SelectTrigger className="rounded-xl bg-slate-50"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>정렬</Label><Input className="rounded-xl bg-slate-50" type="number" value={checkSort} onChange={(event) => setCheckSort(Number(event.target.value))} /></div>
                <div className="flex items-end gap-2"><Checkbox checked={checkRequired} onCheckedChange={(checked) => setCheckRequired(checked === true)} /><span className="text-sm">필수</span></div>
                <div className="md:col-span-6"><Label>설명</Label><Textarea className="rounded-xl bg-slate-50" value={checkDescription} onChange={(event) => setCheckDescription(event.target.value)} /></div>
                <div className="md:col-span-6 flex justify-end"><Button onClick={() => createChecklist.mutate({ title: checkTitle, description: checkDescription || undefined, phase: checkPhase, category: checkCategory, sortOrder: checkSort, isRequired: checkRequired })}><Plus className="h-4 w-4 mr-1" />추가</Button></div>
              </CardContent>
            </Card>
            <div className="grid gap-3">
              {(checklists ?? []).map((item: any) => (
                <Card key={item.id} className="border-slate-200/80 bg-white/95 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{item.title} {item.isRequired ? <span className="text-xs text-primary">필수</span> : null}</p>
                      <p className="text-xs text-muted-foreground">{item.phase} / {item.category} / 정렬 {item.sortOrder} / {item.isActive ? "active" : "inactive"}</p>
                      {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => updateChecklist.mutate({ id: item.id, isActive: !item.isActive })}>
                      {item.isActive ? "비활성" : "재활성"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">후속 문구 템플릿 추가</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div><Label>제목</Label><Input className="rounded-xl bg-slate-50" value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} /></div>
                <div><Label>상황</Label><Select value={templateSituation} onValueChange={(value) => setTemplateSituation(value as any)}><SelectTrigger className="rounded-xl bg-slate-50"><SelectValue /></SelectTrigger><SelectContent>{situations.map((situation) => <SelectItem key={situation} value={situation}>{situation}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>채널</Label><Select value={templateChannel} onValueChange={(value) => setTemplateChannel(value as any)}><SelectTrigger className="rounded-xl bg-slate-50"><SelectValue /></SelectTrigger><SelectContent>{channels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-end justify-end"><Button variant="outline" className="rounded-xl" onClick={() => seedTemplates.mutate()}><RefreshCw className="h-4 w-4 mr-1" />기본 10개 확인</Button></div>
                <div className="md:col-span-4"><Label>본문</Label><Textarea className="rounded-xl bg-slate-50" rows={7} value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="{고객명}, {담당자명}, {다음연락일}, {상담주제}만 사용할 수 있습니다." /></div>
                <div className="md:col-span-4"><Label>준법/주의 메모</Label><Textarea className="rounded-xl bg-slate-50" value={templateNote} onChange={(event) => setTemplateNote(event.target.value)} /></div>
                <div className="md:col-span-4 flex justify-end"><Button onClick={() => createTemplate.mutate({ title: templateTitle, situation: templateSituation, channel: templateChannel, body: templateBody, complianceNote: templateNote || undefined })}><MessageSquareText className="h-4 w-4 mr-1" />템플릿 추가</Button></div>
              </CardContent>
            </Card>
            <div className="grid gap-3">
              {(templates ?? []).map((item: any) => (
                <Card key={item.id} className="border-slate-200/80 bg-white/95 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.situation} / {item.channel} / {item.isActive ? "active" : "inactive"}</p>
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => updateTemplate.mutate({ id: item.id, isActive: !item.isActive })}>
                      {item.isActive ? "비활성" : "재활성"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scripts" className="space-y-4">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">상담 스크립트 추가</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div><Label>제목</Label><Input className="rounded-xl bg-slate-50" value={scriptTitle} onChange={(event) => setScriptTitle(event.target.value)} /></div>
                <div><Label>카테고리</Label><Select value={scriptCategory} onValueChange={(value) => setScriptCategory(value as any)}><SelectTrigger className="rounded-xl bg-slate-50"><SelectValue /></SelectTrigger><SelectContent>{scriptCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>태그</Label><Input className="rounded-xl bg-slate-50" value={scriptTags} onChange={(event) => setScriptTags(event.target.value)} placeholder="쉼표로 구분" /></div>
                <div className="flex items-end justify-end"><Button variant="outline" className="rounded-xl" onClick={() => seedScripts.mutate()}><RefreshCw className="h-4 w-4 mr-1" />기본 10개 확인</Button></div>
                <div className="md:col-span-4"><Label>본문</Label><Textarea className="rounded-xl bg-slate-50" rows={8} value={scriptBody} onChange={(event) => setScriptBody(event.target.value)} placeholder="가입 강요, 공포마케팅, 확정 표현은 입력하지 마세요." /></div>
                <div className="md:col-span-4"><Label>준법/주의 메모</Label><Textarea className="rounded-xl bg-slate-50" value={scriptNote} onChange={(event) => setScriptNote(event.target.value)} /></div>
                <div className="md:col-span-4 flex justify-end"><Button onClick={() => createScript.mutate({ title: scriptTitle, category: scriptCategory, scriptBody, complianceNote: scriptNote || undefined, tags: scriptTags || undefined })}><MessageSquareText className="h-4 w-4 mr-1" />스크립트 추가</Button></div>
              </CardContent>
            </Card>
            <div className="grid gap-3">
              {(scripts ?? []).map((item: any) => (
                <Card key={item.id} className="border-slate-200/80 bg-white/95 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.category} / {item.tags ?? "태그 없음"} / {item.isActive ? "active" : "inactive"}</p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.scriptBody}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => updateScript.mutate({ id: item.id, isActive: !item.isActive })}>
                      {item.isActive ? "비활성" : "재활성"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
