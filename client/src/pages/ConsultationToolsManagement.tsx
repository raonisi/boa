import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getActiveLabel } from "@/lib/userRole";
import { ClipboardCheck, Edit3, MessageSquareText, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isBranchAdmin = user?.role === "branch_admin";
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
  const [editingScript, setEditingScript] = useState<any | null>(null);
  const [editScriptTitle, setEditScriptTitle] = useState("");
  const [editScriptCategory, setEditScriptCategory] = useState<(typeof scriptCategories)[number]>("first_call");
  const [editScriptBody, setEditScriptBody] = useState("");
  const [editScriptNote, setEditScriptNote] = useState("");
  const [editScriptTags, setEditScriptTags] = useState("");
  const [deleteScript, setDeleteScript] = useState<any | null>(null);
  const [editingChecklist, setEditingChecklist] = useState<any | null>(null);
  const [editCheckTitle, setEditCheckTitle] = useState("");
  const [editCheckDescription, setEditCheckDescription] = useState("");
  const [editCheckPhase, setEditCheckPhase] = useState<(typeof phases)[number]["value"]>("before");
  const [editCheckCategory, setEditCheckCategory] = useState<(typeof categories)[number]>("basic");
  const [editCheckRequired, setEditCheckRequired] = useState(false);
  const [editCheckSort, setEditCheckSort] = useState(0);
  const [deleteChecklist, setDeleteChecklist] = useState<any | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [editTemplateTitle, setEditTemplateTitle] = useState("");
  const [editTemplateSituation, setEditTemplateSituation] = useState<(typeof situations)[number]>("missed_call");
  const [editTemplateChannel, setEditTemplateChannel] = useState<(typeof channels)[number]>("both");
  const [editTemplateBody, setEditTemplateBody] = useState("");
  const [editTemplateNote, setEditTemplateNote] = useState("");
  const [deleteTemplate, setDeleteTemplate] = useState<any | null>(null);

  const { data: checklists } = trpc.consultationTools.listChecklists.useQuery({ includeInactive: false });
  const { data: templates } = trpc.consultationTools.listMessageTemplates.useQuery({ includeInactive: false });
  const { data: scripts } = trpc.consultationScripts.list.useQuery({ includeInactive: false });

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
    onSuccess: (_, variables) => {
      toast.success(variables.isActive === false ? "체크리스트를 삭제했습니다." : "체크리스트를 수정했습니다.");
      setEditingChecklist(null);
      setDeleteChecklist(null);
      utils.consultationTools.listChecklists.invalidate();
    },
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
    onSuccess: (_, variables) => {
      toast.success(variables.isActive === false ? "문구 템플릿을 삭제했습니다." : "문구 템플릿을 수정했습니다.");
      setEditingTemplate(null);
      setDeleteTemplate(null);
      utils.consultationTools.listMessageTemplates.invalidate();
    },
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
    onSuccess: (_, variables) => {
      toast.success(variables.isActive === false ? "상담 스크립트를 삭제했습니다." : "상담 스크립트를 수정했습니다.");
      setEditingScript(null);
      setDeleteScript(null);
      utils.consultationScripts.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const openScriptEdit = (item: any) => {
    setEditingScript(item);
    setEditScriptTitle(item.title ?? "");
    setEditScriptCategory(item.category ?? "first_call");
    setEditScriptBody(item.scriptBody ?? "");
    setEditScriptNote(item.complianceNote ?? "");
    setEditScriptTags(item.tags ?? "");
  };

  const submitScriptEdit = () => {
    if (!editingScript) return;
    updateScript.mutate({
      id: editingScript.id,
      title: editScriptTitle,
      category: editScriptCategory,
      scriptBody: editScriptBody,
      complianceNote: editScriptNote || null,
      tags: editScriptTags || null,
    });
  };

  const openChecklistEdit = (item: any) => {
    setEditingChecklist(item);
    setEditCheckTitle(item.title ?? "");
    setEditCheckDescription(item.description ?? "");
    setEditCheckPhase(item.phase ?? "before");
    setEditCheckCategory(item.category ?? "basic");
    setEditCheckRequired(item.isRequired === true);
    setEditCheckSort(Number(item.sortOrder ?? 0));
  };

  const submitChecklistEdit = () => {
    if (!editingChecklist) return;
    updateChecklist.mutate({
      id: editingChecklist.id,
      title: editCheckTitle,
      description: editCheckDescription || null,
      phase: editCheckPhase,
      category: editCheckCategory,
      sortOrder: editCheckSort,
      isRequired: editCheckRequired,
    });
  };

  const openTemplateEdit = (item: any) => {
    setEditingTemplate(item);
    setEditTemplateTitle(item.title ?? "");
    setEditTemplateSituation(item.situation ?? "missed_call");
    setEditTemplateChannel(item.channel ?? "both");
    setEditTemplateBody(item.body ?? "");
    setEditTemplateNote(item.complianceNote ?? "");
  };

  const submitTemplateEdit = () => {
    if (!editingTemplate) return;
    updateTemplate.mutate({
      id: editingTemplate.id,
      title: editTemplateTitle,
      situation: editTemplateSituation,
      channel: editTemplateChannel,
      body: editTemplateBody,
      complianceNote: editTemplateNote || null,
    });
  };

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
          <CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-amber-900">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>사용 가능한 placeholder는 고객명, 담당자명, 다음연락일, 상담주제입니다. 템플릿 본문 전문은 활동 로그에 저장하지 않습니다.</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="checklists" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-3">
            <TabsTrigger value="checklists" className="min-h-12 whitespace-normal px-3 text-center leading-5 sm:min-h-9">상담 체크리스트</TabsTrigger>
            <TabsTrigger value="templates" className="min-h-12 whitespace-normal px-3 text-center leading-5 sm:min-h-9">후속 문구 템플릿</TabsTrigger>
            <TabsTrigger value="scripts" className="min-h-12 whitespace-normal px-3 text-center leading-5 sm:min-h-9">상담 스크립트</TabsTrigger>
          </TabsList>

          <TabsContent value="checklists" className="space-y-4">
            {isBranchAdmin ? (
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">체크리스트 항목 추가</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <div className="md:col-span-6 flex justify-end">
                  <Button variant="outline" className="min-h-12 w-full rounded-xl md:w-auto md:min-h-10" onClick={() => seedChecklists.mutate()} disabled={seedChecklists.isPending}><RefreshCw className="h-4 w-4 mr-1" />기본 체크리스트 확인</Button>
                </div>
                <div className="md:col-span-2"><Label>제목</Label><Input className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9" value={checkTitle} onChange={(event) => setCheckTitle(event.target.value)} /></div>
                <div><Label>단계</Label><Select value={checkPhase} onValueChange={(value) => setCheckPhase(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{phases.map((phase) => <SelectItem key={phase.value} value={phase.value}>{phase.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>카테고리</Label><Select value={checkCategory} onValueChange={(value) => setCheckCategory(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>정렬</Label><Input className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9" type="number" value={checkSort} onChange={(event) => setCheckSort(Number(event.target.value))} /></div>
                <div className="flex min-h-12 items-center gap-2 md:min-h-9"><Checkbox checked={checkRequired} onCheckedChange={(checked) => setCheckRequired(checked === true)} /><span className="text-sm">필수</span></div>
                <div className="md:col-span-6"><Label>설명</Label><Textarea className="min-h-24 rounded-xl bg-slate-50" value={checkDescription} onChange={(event) => setCheckDescription(event.target.value)} /></div>
                <div className="md:col-span-6 flex justify-end"><Button className="min-h-12 w-full md:w-auto md:min-h-10" onClick={() => createChecklist.mutate({ title: checkTitle, description: checkDescription || undefined, phase: checkPhase, category: checkCategory, sortOrder: checkSort, isRequired: checkRequired })}><Plus className="h-4 w-4 mr-1" />추가</Button></div>
              </CardContent>
            </Card>
            ) : null}
            {editingChecklist ? (
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">상담 체크리스트 수정</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">체크리스트 상세 설명 전문은 활동 로그에 저장하지 않습니다.</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditingChecklist(null)} disabled={updateChecklist.isPending} aria-label="수정 취소">
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2"><Label>제목</Label><Input className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9" value={editCheckTitle} onChange={(event) => setEditCheckTitle(event.target.value)} /></div>
                  <div><Label>단계</Label><Select value={editCheckPhase} onValueChange={(value) => setEditCheckPhase(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{phases.map((phase) => <SelectItem key={phase.value} value={phase.value}>{phase.label}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>카테고리</Label><Select value={editCheckCategory} onValueChange={(value) => setEditCheckCategory(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>정렬</Label><Input className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9" type="number" value={editCheckSort} onChange={(event) => setEditCheckSort(Number(event.target.value))} /></div>
                  <div className="flex min-h-12 items-center gap-2 md:min-h-9"><Checkbox checked={editCheckRequired} onCheckedChange={(checked) => setEditCheckRequired(checked === true)} /><span className="text-sm">필수</span></div>
                  <div className="md:col-span-6"><Label>설명</Label><Textarea className="min-h-24 rounded-xl bg-white" value={editCheckDescription} onChange={(event) => setEditCheckDescription(event.target.value)} /></div>
                  <div className="md:col-span-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button variant="outline" className="min-h-12 md:min-h-10" onClick={() => setEditingChecklist(null)} disabled={updateChecklist.isPending}>취소</Button>
                    <Button className="min-h-12 md:min-h-10" onClick={submitChecklistEdit} disabled={updateChecklist.isPending}>{updateChecklist.isPending ? "저장 중..." : "저장"}</Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <div className="grid gap-3">
              {(checklists ?? []).map((item: any) => (
                <Card key={item.id} className="border-slate-200/80 bg-white/95 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium leading-6">{item.title} {item.isRequired ? <span className="text-xs text-primary">필수</span> : null}</p>
                      <p className="text-xs text-muted-foreground">{item.phase} / {item.category} / 정렬 {item.sortOrder} / {getActiveLabel(item.isActive)}</p>
                      {item.description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
                    </div>
                    {isBranchAdmin ? (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex md:flex-col lg:flex-row">
                        <Button size="sm" variant="outline" className="min-h-12 md:min-h-8" onClick={() => openChecklistEdit(item)} disabled={updateChecklist.isPending}>
                          <Edit3 className="mr-1 h-4 w-4" />수정
                        </Button>
                        <Button size="sm" variant="destructive" className="min-h-12 md:min-h-8" onClick={() => setDeleteChecklist(item)} disabled={updateChecklist.isPending}>
                          <Trash2 className="mr-1 h-4 w-4" />삭제
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            {isBranchAdmin ? (
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">후속 문구 템플릿 추가</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div><Label>제목</Label><Input className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9" value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} /></div>
                <div><Label>상황</Label><Select value={templateSituation} onValueChange={(value) => setTemplateSituation(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{situations.map((situation) => <SelectItem key={situation} value={situation}>{situation}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>채널</Label><Select value={templateChannel} onValueChange={(value) => setTemplateChannel(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{channels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-end justify-end"><Button variant="outline" className="min-h-12 w-full rounded-xl md:w-auto md:min-h-10" onClick={() => seedTemplates.mutate()}><RefreshCw className="h-4 w-4 mr-1" />기본 10개 확인</Button></div>
                <div className="md:col-span-4"><Label>본문</Label><Textarea className="min-h-40 rounded-xl bg-slate-50" rows={7} value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="{고객명}, {담당자명}, {다음연락일}, {상담주제}만 사용할 수 있습니다." /></div>
                <div className="md:col-span-4"><Label>준법/주의 메모</Label><Textarea className="min-h-24 rounded-xl bg-slate-50" value={templateNote} onChange={(event) => setTemplateNote(event.target.value)} /></div>
                <div className="md:col-span-4 flex justify-end"><Button className="min-h-12 w-full md:w-auto md:min-h-10" onClick={() => createTemplate.mutate({ title: templateTitle, situation: templateSituation, channel: templateChannel, body: templateBody, complianceNote: templateNote || undefined })}><MessageSquareText className="h-4 w-4 mr-1" />템플릿 추가</Button></div>
              </CardContent>
            </Card>
            ) : null}
            {editingTemplate ? (
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">후속 문구 템플릿 수정</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">템플릿 본문 전문은 활동 로그에 저장하지 않습니다.</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditingTemplate(null)} disabled={updateTemplate.isPending} aria-label="수정 취소">
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div><Label>제목</Label><Input className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9" value={editTemplateTitle} onChange={(event) => setEditTemplateTitle(event.target.value)} /></div>
                  <div><Label>상황</Label><Select value={editTemplateSituation} onValueChange={(value) => setEditTemplateSituation(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{situations.map((situation) => <SelectItem key={situation} value={situation}>{situation}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>채널</Label><Select value={editTemplateChannel} onValueChange={(value) => setEditTemplateChannel(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{channels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></div>
                  <div className="md:col-span-4"><Label>본문</Label><Textarea className="min-h-40 rounded-xl bg-white" rows={7} value={editTemplateBody} onChange={(event) => setEditTemplateBody(event.target.value)} placeholder="{고객명}, {담당자명}, {다음연락일}, {상담주제}만 사용할 수 있습니다." /></div>
                  <div className="md:col-span-4"><Label>준법/주의 메모</Label><Textarea className="min-h-24 rounded-xl bg-white" value={editTemplateNote} onChange={(event) => setEditTemplateNote(event.target.value)} /></div>
                  <div className="md:col-span-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button variant="outline" className="min-h-12 md:min-h-10" onClick={() => setEditingTemplate(null)} disabled={updateTemplate.isPending}>취소</Button>
                    <Button className="min-h-12 md:min-h-10" onClick={submitTemplateEdit} disabled={updateTemplate.isPending}>{updateTemplate.isPending ? "저장 중..." : "저장"}</Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <div className="grid gap-3">
              {(templates ?? []).map((item: any) => (
                <Card key={item.id} className="border-slate-200/80 bg-white/95 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium leading-6">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.situation} / {item.channel} / {getActiveLabel(item.isActive)}</p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p>
                    </div>
                    {isBranchAdmin ? (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex md:flex-col lg:flex-row">
                        <Button size="sm" variant="outline" className="min-h-12 md:min-h-8" onClick={() => openTemplateEdit(item)} disabled={updateTemplate.isPending}>
                          <Edit3 className="mr-1 h-4 w-4" />수정
                        </Button>
                        <Button size="sm" variant="destructive" className="min-h-12 md:min-h-8" onClick={() => setDeleteTemplate(item)} disabled={updateTemplate.isPending}>
                          <Trash2 className="mr-1 h-4 w-4" />삭제
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scripts" className="space-y-4">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">상담 스크립트 추가</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div><Label>제목</Label><Input className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9" value={scriptTitle} onChange={(event) => setScriptTitle(event.target.value)} /></div>
                <div><Label>카테고리</Label><Select value={scriptCategory} onValueChange={(value) => setScriptCategory(value as any)}><SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"><SelectValue /></SelectTrigger><SelectContent>{scriptCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>태그</Label><Input className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9" value={scriptTags} onChange={(event) => setScriptTags(event.target.value)} placeholder="쉼표로 구분" /></div>
                <div className="flex items-end justify-end"><Button variant="outline" className="min-h-12 w-full rounded-xl md:w-auto md:min-h-10" onClick={() => seedScripts.mutate()}><RefreshCw className="h-4 w-4 mr-1" />기본 10개 확인</Button></div>
                <div className="md:col-span-4"><Label>본문</Label><Textarea className="min-h-40 rounded-xl bg-slate-50" rows={8} value={scriptBody} onChange={(event) => setScriptBody(event.target.value)} placeholder="가입 강요, 공포마케팅, 확정 표현은 입력하지 마세요." /></div>
                <div className="md:col-span-4"><Label>준법/주의 메모</Label><Textarea className="min-h-24 rounded-xl bg-slate-50" value={scriptNote} onChange={(event) => setScriptNote(event.target.value)} /></div>
                <div className="md:col-span-4 flex justify-end"><Button className="min-h-12 w-full md:w-auto md:min-h-10" onClick={() => createScript.mutate({ title: scriptTitle, category: scriptCategory, scriptBody, complianceNote: scriptNote || undefined, tags: scriptTags || undefined })}><MessageSquareText className="h-4 w-4 mr-1" />스크립트 추가</Button></div>
              </CardContent>
            </Card>
            {editingScript ? (
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">상담 스크립트 수정</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">수정한 본문 전문은 활동 로그에 저장하지 않습니다.</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditingScript(null)} disabled={updateScript.isPending} aria-label="수정 취소">
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  <div>
                    <Label>제목</Label>
                    <Input className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9" value={editScriptTitle} onChange={(event) => setEditScriptTitle(event.target.value)} />
                  </div>
                  <div>
                    <Label>카테고리</Label>
                    <Select value={editScriptCategory} onValueChange={(value) => setEditScriptCategory(value as any)}>
                      <SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{scriptCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>태그</Label>
                    <Input className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9" value={editScriptTags} onChange={(event) => setEditScriptTags(event.target.value)} />
                  </div>
                  <div className="md:col-span-4">
                    <Label>본문</Label>
                    <Textarea className="min-h-40 rounded-xl bg-white" rows={8} value={editScriptBody} onChange={(event) => setEditScriptBody(event.target.value)} />
                  </div>
                  <div className="md:col-span-4">
                    <Label>준법 주의 메모</Label>
                    <Textarea className="min-h-24 rounded-xl bg-white" value={editScriptNote} onChange={(event) => setEditScriptNote(event.target.value)} />
                  </div>
                  <div className="md:col-span-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button variant="outline" className="min-h-12 md:min-h-10" onClick={() => setEditingScript(null)} disabled={updateScript.isPending}>취소</Button>
                    <Button className="min-h-12 md:min-h-10" onClick={submitScriptEdit} disabled={updateScript.isPending}>
                      {updateScript.isPending ? "저장 중..." : "저장"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <div className="grid gap-3">
              {(scripts ?? []).length === 0 ? (
                <Card className="border-dashed border-slate-200 bg-white/80">
                  <CardContent className="p-6 text-sm text-muted-foreground">등록된 상담 스크립트가 없습니다.</CardContent>
                </Card>
              ) : null}
              {(scripts ?? []).map((item: any) => (
                <Card key={item.id} className="border-slate-200/80 bg-white/95 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium leading-6">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.category} / {item.tags ?? "태그 없음"} / {getActiveLabel(item.isActive)}</p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.scriptBody}</p>
                    </div>
                    {isBranchAdmin ? (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex md:flex-col lg:flex-row">
                        <Button size="sm" variant="outline" className="min-h-12 md:min-h-8" onClick={() => openScriptEdit(item)} disabled={updateScript.isPending}>
                          <Edit3 className="mr-1 h-4 w-4" />수정
                        </Button>
                        <Button size="sm" variant="destructive" className="min-h-12 md:min-h-8" onClick={() => setDeleteScript(item)} disabled={updateScript.isPending}>
                          <Trash2 className="mr-1 h-4 w-4" />삭제
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        <AlertDialog open={!!deleteChecklist} onOpenChange={(open) => !open && setDeleteChecklist(null)}>
          <AlertDialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AlertDialogHeader>
              <AlertDialogTitle>상담 체크리스트를 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                삭제 후 목록에서 보이지 않습니다. 실제 상담 체크 결과는 삭제하지 않고 체크리스트 정의만 비활성화합니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-12 md:min-h-10" disabled={updateChecklist.isPending}>취소</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 md:min-h-10"
                disabled={updateChecklist.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (!deleteChecklist) return;
                  updateChecklist.mutate({ id: deleteChecklist.id, isActive: false });
                }}
              >
                {updateChecklist.isPending ? "삭제 중..." : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
          <AlertDialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AlertDialogHeader>
              <AlertDialogTitle>후속 문구 템플릿을 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                삭제 후 목록에서 보이지 않습니다. 템플릿 본문 전문은 활동 로그에 저장하지 않습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-12 md:min-h-10" disabled={updateTemplate.isPending}>취소</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 md:min-h-10"
                disabled={updateTemplate.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (!deleteTemplate) return;
                  updateTemplate.mutate({ id: deleteTemplate.id, isActive: false });
                }}
              >
                {updateTemplate.isPending ? "삭제 중..." : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteScript} onOpenChange={(open) => !open && setDeleteScript(null)}>
          <AlertDialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AlertDialogHeader>
              <AlertDialogTitle>이 상담 스크립트를 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                삭제 후 목록에서 보이지 않습니다. 실제 데이터는 hard delete하지 않고 비활성화 상태로 전환됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-12 md:min-h-10" disabled={updateScript.isPending}>취소</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 md:min-h-10"
                disabled={updateScript.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  if (!deleteScript) return;
                  updateScript.mutate({ id: deleteScript.id, isActive: false });
                }}
              >
                {updateScript.isPending ? "삭제 중..." : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
