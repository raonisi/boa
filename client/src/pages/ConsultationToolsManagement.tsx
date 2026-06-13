import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getActiveLabel } from "@/lib/userRole";
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Edit3,
  Eye,
  MessageSquareText,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const phases = [
  { value: "before", label: "상담 전" },
  { value: "during", label: "상담 중" },
  { value: "after", label: "상담 후" },
] as const;

const categories = [
  "basic",
  "needs",
  "coverage",
  "premium",
  "family",
  "follow_up",
  "compliance",
] as const;

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

function ToolPreviewPanel({
  eyebrow,
  title,
  meta,
  body,
  note,
  emptyText,
  onCopy,
}: {
  eyebrow: string;
  title?: string | null;
  meta?: string | null;
  body?: string | null;
  note?: string | null;
  emptyText: string;
  onCopy?: () => void;
}) {
  const hasContent = Boolean(title || body || note);

  return (
    <Card className="flex max-h-[calc(100dvh-6rem)] min-h-[22rem] flex-col overflow-hidden border-slate-200/80 bg-white/95 shadow-sm xl:sticky xl:top-20">
      <CardHeader className="shrink-0 border-b border-slate-100 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b99b5f]">
              {eyebrow}
            </p>
            <CardTitle className="mt-1 line-clamp-2 text-base">
              {title || "미리보기"}
            </CardTitle>
            {meta ? (
              <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
            ) : null}
          </div>
          <Eye className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {hasContent ? (
            <div className="space-y-3">
              {body ? (
                <div className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {body}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-muted-foreground">
                  {emptyText}
                </p>
              )}
              {note ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  {note}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
              {emptyText}
            </p>
          )}
        </div>
        <div className="shrink-0 border-t bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <Button
            className="min-h-12 w-full md:min-h-10"
            variant="outline"
            disabled={!body}
            onClick={onCopy}
          >
            <Copy className="mr-2 h-4 w-4" /> 미리보기 복사
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConsultationToolsManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isBranchAdmin = user?.role === "branch_admin";
  const [activeTab, setActiveTab] = useState("checklists");
  const [checkTitle, setCheckTitle] = useState("");
  const [checkDescription, setCheckDescription] = useState("");
  const [checkPhase, setCheckPhase] =
    useState<(typeof phases)[number]["value"]>("before");
  const [checkCategory, setCheckCategory] =
    useState<(typeof categories)[number]>("basic");
  const [checkRequired, setCheckRequired] = useState(false);
  const [checkSort, setCheckSort] = useState(0);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSituation, setTemplateSituation] =
    useState<(typeof situations)[number]>("missed_call");
  const [templateChannel, setTemplateChannel] =
    useState<(typeof channels)[number]>("both");
  const [templateBody, setTemplateBody] = useState("");
  const [templateNote, setTemplateNote] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptCategory, setScriptCategory] =
    useState<(typeof scriptCategories)[number]>("first_call");
  const [scriptBody, setScriptBody] = useState("");
  const [scriptNote, setScriptNote] = useState("");
  const [scriptTags, setScriptTags] = useState("");
  const [editingScript, setEditingScript] = useState<any | null>(null);
  const [editScriptTitle, setEditScriptTitle] = useState("");
  const [editScriptCategory, setEditScriptCategory] =
    useState<(typeof scriptCategories)[number]>("first_call");
  const [editScriptBody, setEditScriptBody] = useState("");
  const [editScriptNote, setEditScriptNote] = useState("");
  const [editScriptTags, setEditScriptTags] = useState("");
  const [deleteScript, setDeleteScript] = useState<any | null>(null);
  const [editingChecklist, setEditingChecklist] = useState<any | null>(null);
  const [editCheckTitle, setEditCheckTitle] = useState("");
  const [editCheckDescription, setEditCheckDescription] = useState("");
  const [editCheckPhase, setEditCheckPhase] =
    useState<(typeof phases)[number]["value"]>("before");
  const [editCheckCategory, setEditCheckCategory] =
    useState<(typeof categories)[number]>("basic");
  const [editCheckRequired, setEditCheckRequired] = useState(false);
  const [editCheckSort, setEditCheckSort] = useState(0);
  const [deleteChecklist, setDeleteChecklist] = useState<any | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [editTemplateTitle, setEditTemplateTitle] = useState("");
  const [editTemplateSituation, setEditTemplateSituation] =
    useState<(typeof situations)[number]>("missed_call");
  const [editTemplateChannel, setEditTemplateChannel] =
    useState<(typeof channels)[number]>("both");
  const [editTemplateBody, setEditTemplateBody] = useState("");
  const [editTemplateNote, setEditTemplateNote] = useState("");
  const [deleteTemplate, setDeleteTemplate] = useState<any | null>(null);
  const [selectedChecklistId, setSelectedChecklistId] = useState<number | null>(
    null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null
  );
  const [selectedScriptId, setSelectedScriptId] = useState<number | null>(null);

  const { data: checklists } = trpc.consultationTools.listChecklists.useQuery({
    includeInactive: false,
  });
  const { data: templates } =
    trpc.consultationTools.listMessageTemplates.useQuery({
      includeInactive: false,
    });
  const { data: scripts } = trpc.consultationScripts.list.useQuery({
    includeInactive: false,
  });
  const checklistItems = checklists ?? [];
  const templateItems = templates ?? [];
  const scriptItems = scripts ?? [];
  const selectedChecklist =
    checklistItems.find((item: any) => item.id === selectedChecklistId) ??
    checklistItems[0];
  const selectedTemplate =
    templateItems.find((item: any) => item.id === selectedTemplateId) ??
    templateItems[0];
  const selectedScript =
    scriptItems.find((item: any) => item.id === selectedScriptId) ??
    scriptItems[0];

  const copyPreviewText = async (text?: string | null, label = "미리보기") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}를 복사했습니다.`);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const createChecklist = trpc.consultationTools.createChecklist.useMutation({
    onSuccess: () => {
      toast.success("체크리스트 항목을 추가했습니다.");
      setCheckTitle("");
      setCheckDescription("");
      utils.consultationTools.listChecklists.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateChecklist = trpc.consultationTools.updateChecklist.useMutation({
    onSuccess: (_, variables) => {
      toast.success(
        variables.isActive === false
          ? "체크리스트를 삭제했습니다."
          : "체크리스트를 수정했습니다."
      );
      setEditingChecklist(null);
      setDeleteChecklist(null);
      utils.consultationTools.listChecklists.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const seedChecklists =
    trpc.consultationTools.seedDefaultChecklists.useMutation({
      onSuccess: result => {
        toast.success(
          `기본 체크리스트 ${result.createdCount}건 생성, ${result.reactivatedCount}건 재활성 확인`
        );
        utils.consultationTools.listChecklists.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const seedTemplates =
    trpc.consultationTools.seedDefaultMessageTemplates.useMutation({
      onSuccess: result => {
        toast.success(`기본 템플릿 ${result.createdCount}건을 확인했습니다.`);
        utils.consultationTools.listMessageTemplates.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const createTemplate =
    trpc.consultationTools.createMessageTemplate.useMutation({
      onSuccess: () => {
        toast.success("문구 템플릿을 추가했습니다.");
        setTemplateTitle("");
        setTemplateBody("");
        setTemplateNote("");
        utils.consultationTools.listMessageTemplates.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const updateTemplate =
    trpc.consultationTools.updateMessageTemplate.useMutation({
      onSuccess: (_, variables) => {
        toast.success(
          variables.isActive === false
            ? "문구 템플릿을 삭제했습니다."
            : "문구 템플릿을 수정했습니다."
        );
        setEditingTemplate(null);
        setDeleteTemplate(null);
        utils.consultationTools.listMessageTemplates.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const seedScripts = trpc.consultationScripts.seedDefaults.useMutation({
    onSuccess: result => {
      toast.success(
        `기본 상담 스크립트 ${result.createdCount}건을 확인했습니다.`
      );
      utils.consultationScripts.list.invalidate();
    },
    onError: error => toast.error(error.message),
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
    onError: error => toast.error(error.message),
  });
  const updateScript = trpc.consultationScripts.update.useMutation({
    onSuccess: (_, variables) => {
      toast.success(
        variables.isActive === false
          ? "상담 스크립트를 삭제했습니다."
          : "상담 스크립트를 수정했습니다."
      );
      setEditingScript(null);
      setDeleteScript(null);
      utils.consultationScripts.list.invalidate();
    },
    onError: error => toast.error(error.message),
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
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">
                Consultation Tools
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                상담 도구 관리
              </h1>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                체크리스트, 후속 문구, 상담 스크립트를 빠르게 찾고 복사합니다.
                민감정보와 확정 표현은 입력하지 마세요.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                상담 전
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                상담 중
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                상담 후
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/60 shadow-sm">
          <CardContent className="flex items-start gap-3 p-3 text-xs leading-5 text-amber-900 sm:p-4 sm:text-sm sm:leading-6">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              사용 가능한 placeholder: 고객명, 담당자명, 다음연락일, 상담주제.
              템플릿 본문 전문은 활동 로그에 저장하지 않습니다.
            </p>
          </CardContent>
        </Card>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger
              value="checklists"
              className="min-h-11 whitespace-normal px-2 text-center text-xs leading-5 sm:min-h-9 sm:text-sm"
            >
              <span className="sm:hidden">체크</span>
              <span className="hidden sm:inline">상담 체크리스트</span>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="min-h-11 whitespace-normal px-2 text-center text-xs leading-5 sm:min-h-9 sm:text-sm"
            >
              <span className="sm:hidden">문구</span>
              <span className="hidden sm:inline">후속 문구 템플릿</span>
            </TabsTrigger>
            <TabsTrigger
              value="scripts"
              className="min-h-11 whitespace-normal px-2 text-center text-xs leading-5 sm:min-h-9 sm:text-sm"
            >
              <span className="sm:hidden">스크립트</span>
              <span className="hidden sm:inline">상담 스크립트</span>
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold",
                activeTab === "checklists"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              체크 {checklistItems.length}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold",
                activeTab === "templates"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              문구 {templateItems.length}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold",
                activeTab === "scripts"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              스크립트 {scriptItems.length}
            </span>
          </div>

          <TabsContent value="checklists" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
              <div className="min-w-0 space-y-4">
                {isBranchAdmin ? (
                  <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">
                        체크리스트 항목 추가
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-6">
                      <div className="md:col-span-6 flex justify-end">
                        <Button
                          variant="outline"
                          className="min-h-12 w-full rounded-xl md:w-auto md:min-h-10"
                          onClick={() => seedChecklists.mutate()}
                          disabled={seedChecklists.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          기본 체크리스트 확인
                        </Button>
                      </div>
                      <div className="md:col-span-2">
                        <Label>제목</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                          value={checkTitle}
                          onChange={event => setCheckTitle(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label>단계</Label>
                        <Select
                          value={checkPhase}
                          onValueChange={value => setCheckPhase(value as any)}
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {phases.map(phase => (
                              <SelectItem key={phase.value} value={phase.value}>
                                {phase.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>카테고리</Label>
                        <Select
                          value={checkCategory}
                          onValueChange={value =>
                            setCheckCategory(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>정렬</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                          type="number"
                          value={checkSort}
                          onChange={event =>
                            setCheckSort(Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="flex min-h-12 items-center gap-2 md:min-h-9">
                        <Checkbox
                          checked={checkRequired}
                          onCheckedChange={checked =>
                            setCheckRequired(checked === true)
                          }
                        />
                        <span className="text-sm">필수</span>
                      </div>
                      <div className="md:col-span-6">
                        <Label>설명</Label>
                        <Textarea
                          className="min-h-24 rounded-xl bg-slate-50"
                          value={checkDescription}
                          onChange={event =>
                            setCheckDescription(event.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-6 flex justify-end">
                        <Button
                          className="min-h-12 w-full md:w-auto md:min-h-10"
                          onClick={() =>
                            createChecklist.mutate({
                              title: checkTitle,
                              description: checkDescription || undefined,
                              phase: checkPhase,
                              category: checkCategory,
                              sortOrder: checkSort,
                              isRequired: checkRequired,
                            })
                          }
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          추가
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                {editingChecklist ? (
                  <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          상담 체크리스트 수정
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          체크리스트 상세 설명 전문은 활동 로그에 저장하지
                          않습니다.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setEditingChecklist(null)}
                        disabled={updateChecklist.isPending}
                        aria-label="수정 취소"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-6">
                      <div className="md:col-span-2">
                        <Label>제목</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"
                          value={editCheckTitle}
                          onChange={event =>
                            setEditCheckTitle(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>단계</Label>
                        <Select
                          value={editCheckPhase}
                          onValueChange={value =>
                            setEditCheckPhase(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {phases.map(phase => (
                              <SelectItem key={phase.value} value={phase.value}>
                                {phase.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>카테고리</Label>
                        <Select
                          value={editCheckCategory}
                          onValueChange={value =>
                            setEditCheckCategory(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>정렬</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"
                          type="number"
                          value={editCheckSort}
                          onChange={event =>
                            setEditCheckSort(Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="flex min-h-12 items-center gap-2 md:min-h-9">
                        <Checkbox
                          checked={editCheckRequired}
                          onCheckedChange={checked =>
                            setEditCheckRequired(checked === true)
                          }
                        />
                        <span className="text-sm">필수</span>
                      </div>
                      <div className="md:col-span-6">
                        <Label>설명</Label>
                        <Textarea
                          className="min-h-24 rounded-xl bg-white"
                          value={editCheckDescription}
                          onChange={event =>
                            setEditCheckDescription(event.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                        <Button
                          variant="outline"
                          className="min-h-12 md:min-h-10"
                          onClick={() => setEditingChecklist(null)}
                          disabled={updateChecklist.isPending}
                        >
                          취소
                        </Button>
                        <Button
                          className="min-h-12 md:min-h-10"
                          onClick={submitChecklistEdit}
                          disabled={updateChecklist.isPending}
                        >
                          {updateChecklist.isPending ? "저장 중..." : "저장"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <div className="grid gap-3">
                  {checklistItems.length === 0 ? (
                    <Card className="border-dashed border-slate-200 bg-white/80">
                      <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
                        <p className="font-semibold text-slate-900">
                          등록된 체크리스트가 없습니다.
                        </p>
                        <p>
                          {isBranchAdmin
                            ? "상단 입력 영역에서 기본 체크리스트를 확인하거나 새 항목을 추가하세요."
                            : "지점장에게 상담 체크리스트 등록을 요청하세요."}
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                  {checklistItems.map((item: any) => (
                    <Card
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-slate-200/80 bg-white/95 shadow-sm transition hover:border-primary/30",
                        selectedChecklist?.id === item.id &&
                          "border-primary/40 ring-1 ring-primary/20"
                      )}
                      onClick={() => setSelectedChecklistId(item.id)}
                    >
                      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-semibold leading-6 text-slate-950">
                                {item.title}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  {item.phase}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  {item.category}
                                </span>
                                {item.isRequired ? (
                                  <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                                    필수
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                                  {getActiveLabel(item.isActive)}
                                </span>
                              </div>
                            </div>
                            {selectedChecklist?.id === item.id ? (
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </div>
                          {item.description ? (
                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground md:line-clamp-3">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        {isBranchAdmin ? (
                          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex md:flex-col lg:flex-row">
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-12 md:min-h-8"
                              onClick={() => openChecklistEdit(item)}
                              disabled={updateChecklist.isPending}
                            >
                              <Edit3 className="mr-1 h-4 w-4" />
                              수정
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="min-h-12 md:min-h-8"
                              onClick={() => setDeleteChecklist(item)}
                              disabled={updateChecklist.isPending}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              삭제
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <ToolPreviewPanel
                  eyebrow="체크리스트 미리보기"
                  title={selectedChecklist?.title}
                  meta={
                    selectedChecklist
                      ? `${selectedChecklist.phase} / ${selectedChecklist.category} / ${getActiveLabel(selectedChecklist.isActive)}`
                      : null
                  }
                  body={selectedChecklist?.description}
                  emptyText="체크리스트를 선택하면 긴 설명과 복사 버튼을 가까이에서 확인할 수 있습니다."
                  onCopy={() => copyPreviewText(selectedChecklist?.description)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
              <div className="min-w-0 space-y-4">
                {isBranchAdmin ? (
                  <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">
                        후속 문구 템플릿 추가
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-4">
                      <div>
                        <Label>제목</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                          value={templateTitle}
                          onChange={event =>
                            setTemplateTitle(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>상황</Label>
                        <Select
                          value={templateSituation}
                          onValueChange={value =>
                            setTemplateSituation(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {situations.map(situation => (
                              <SelectItem key={situation} value={situation}>
                                {situation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>채널</Label>
                        <Select
                          value={templateChannel}
                          onValueChange={value =>
                            setTemplateChannel(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {channels.map(channel => (
                              <SelectItem key={channel} value={channel}>
                                {channel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          variant="outline"
                          className="min-h-12 w-full rounded-xl md:w-auto md:min-h-10"
                          onClick={() => seedTemplates.mutate()}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          기본 10개 확인
                        </Button>
                      </div>
                      <div className="md:col-span-4">
                        <Label>본문</Label>
                        <Textarea
                          className="min-h-40 rounded-xl bg-slate-50"
                          rows={7}
                          value={templateBody}
                          onChange={event =>
                            setTemplateBody(event.target.value)
                          }
                          placeholder="{고객명}, {담당자명}, {다음연락일}, {상담주제}만 사용할 수 있습니다."
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label>준법/주의 메모</Label>
                        <Textarea
                          className="min-h-24 rounded-xl bg-slate-50"
                          value={templateNote}
                          onChange={event =>
                            setTemplateNote(event.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <Button
                          className="min-h-12 w-full md:w-auto md:min-h-10"
                          onClick={() =>
                            createTemplate.mutate({
                              title: templateTitle,
                              situation: templateSituation,
                              channel: templateChannel,
                              body: templateBody,
                              complianceNote: templateNote || undefined,
                            })
                          }
                        >
                          <MessageSquareText className="h-4 w-4 mr-1" />
                          템플릿 추가
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                {editingTemplate ? (
                  <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          후속 문구 템플릿 수정
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          템플릿 본문 전문은 활동 로그에 저장하지 않습니다.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setEditingTemplate(null)}
                        disabled={updateTemplate.isPending}
                        aria-label="수정 취소"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-4">
                      <div>
                        <Label>제목</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"
                          value={editTemplateTitle}
                          onChange={event =>
                            setEditTemplateTitle(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>상황</Label>
                        <Select
                          value={editTemplateSituation}
                          onValueChange={value =>
                            setEditTemplateSituation(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {situations.map(situation => (
                              <SelectItem key={situation} value={situation}>
                                {situation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>채널</Label>
                        <Select
                          value={editTemplateChannel}
                          onValueChange={value =>
                            setEditTemplateChannel(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {channels.map(channel => (
                              <SelectItem key={channel} value={channel}>
                                {channel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-4">
                        <Label>본문</Label>
                        <Textarea
                          className="min-h-40 rounded-xl bg-white"
                          rows={7}
                          value={editTemplateBody}
                          onChange={event =>
                            setEditTemplateBody(event.target.value)
                          }
                          placeholder="{고객명}, {담당자명}, {다음연락일}, {상담주제}만 사용할 수 있습니다."
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label>준법/주의 메모</Label>
                        <Textarea
                          className="min-h-24 rounded-xl bg-white"
                          value={editTemplateNote}
                          onChange={event =>
                            setEditTemplateNote(event.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                        <Button
                          variant="outline"
                          className="min-h-12 md:min-h-10"
                          onClick={() => setEditingTemplate(null)}
                          disabled={updateTemplate.isPending}
                        >
                          취소
                        </Button>
                        <Button
                          className="min-h-12 md:min-h-10"
                          onClick={submitTemplateEdit}
                          disabled={updateTemplate.isPending}
                        >
                          {updateTemplate.isPending ? "저장 중..." : "저장"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <div className="grid gap-3">
                  {templateItems.length === 0 ? (
                    <Card className="border-dashed border-slate-200 bg-white/80">
                      <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
                        <p className="font-semibold text-slate-900">
                          등록된 문구 템플릿이 없습니다.
                        </p>
                        <p>
                          {isBranchAdmin
                            ? "상단 입력 영역에서 기본 템플릿을 확인하거나 새 문구를 추가하세요."
                            : "지점장에게 후속 문구 템플릿 등록을 요청하세요."}
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                  {templateItems.map((item: any) => (
                    <Card
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-slate-200/80 bg-white/95 shadow-sm transition hover:border-primary/30",
                        selectedTemplate?.id === item.id &&
                          "border-primary/40 ring-1 ring-primary/20"
                      )}
                      onClick={() => setSelectedTemplateId(item.id)}
                    >
                      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-semibold leading-6 text-slate-950">
                                {item.title}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  {item.situation}
                                </span>
                                <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                                  {item.channel}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                                  {getActiveLabel(item.isActive)}
                                </span>
                              </div>
                            </div>
                            {selectedTemplate?.id === item.id ? (
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </div>
                          <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                            {item.body}
                          </p>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-3 min-h-11 w-full md:hidden"
                            onClick={event => {
                              event.stopPropagation();
                              copyPreviewText(item.body, "문구");
                            }}
                          >
                            <Copy className="mr-1 h-4 w-4" /> 문구 복사
                          </Button>
                        </div>
                        {isBranchAdmin ? (
                          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex md:flex-col lg:flex-row">
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-12 md:min-h-8"
                              onClick={() => openTemplateEdit(item)}
                              disabled={updateTemplate.isPending}
                            >
                              <Edit3 className="mr-1 h-4 w-4" />
                              수정
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="min-h-12 md:min-h-8"
                              onClick={() => setDeleteTemplate(item)}
                              disabled={updateTemplate.isPending}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              삭제
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <ToolPreviewPanel
                  eyebrow="문구 미리보기"
                  title={selectedTemplate?.title}
                  meta={
                    selectedTemplate
                      ? `${selectedTemplate.situation} / ${selectedTemplate.channel} / ${getActiveLabel(selectedTemplate.isActive)}`
                      : null
                  }
                  body={selectedTemplate?.body}
                  note={selectedTemplate?.complianceNote}
                  emptyText="문구 템플릿을 선택하면 긴 본문만 내부에서 스크롤됩니다."
                  onCopy={() => copyPreviewText(selectedTemplate?.body, "문구")}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scripts" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
              <div className="min-w-0 space-y-4">
                <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      상담 스크립트 추가
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-4">
                    <div>
                      <Label>제목</Label>
                      <Input
                        className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                        value={scriptTitle}
                        onChange={event => setScriptTitle(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label>카테고리</Label>
                      <Select
                        value={scriptCategory}
                        onValueChange={value => setScriptCategory(value as any)}
                      >
                        <SelectTrigger className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {scriptCategories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>태그</Label>
                      <Input
                        className="min-h-12 rounded-xl bg-slate-50 md:h-9 md:min-h-9"
                        value={scriptTags}
                        onChange={event => setScriptTags(event.target.value)}
                        placeholder="쉼표로 구분"
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button
                        variant="outline"
                        className="min-h-12 w-full rounded-xl md:w-auto md:min-h-10"
                        onClick={() => seedScripts.mutate()}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        기본 10개 확인
                      </Button>
                    </div>
                    <div className="md:col-span-4">
                      <Label>본문</Label>
                      <Textarea
                        className="min-h-40 rounded-xl bg-slate-50"
                        rows={8}
                        value={scriptBody}
                        onChange={event => setScriptBody(event.target.value)}
                        placeholder="가입 강요, 공포마케팅, 확정 표현은 입력하지 마세요."
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label>준법/주의 메모</Label>
                      <Textarea
                        className="min-h-24 rounded-xl bg-slate-50"
                        value={scriptNote}
                        onChange={event => setScriptNote(event.target.value)}
                      />
                    </div>
                    <div className="md:col-span-4 flex justify-end">
                      <Button
                        className="min-h-12 w-full md:w-auto md:min-h-10"
                        onClick={() =>
                          createScript.mutate({
                            title: scriptTitle,
                            category: scriptCategory,
                            scriptBody,
                            complianceNote: scriptNote || undefined,
                            tags: scriptTags || undefined,
                          })
                        }
                      >
                        <MessageSquareText className="h-4 w-4 mr-1" />
                        스크립트 추가
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                {editingScript ? (
                  <Card className="border-primary/20 bg-primary/5 shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          상담 스크립트 수정
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          수정한 본문 전문은 활동 로그에 저장하지 않습니다.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setEditingScript(null)}
                        disabled={updateScript.isPending}
                        aria-label="수정 취소"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-4">
                      <div>
                        <Label>제목</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"
                          value={editScriptTitle}
                          onChange={event =>
                            setEditScriptTitle(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>카테고리</Label>
                        <Select
                          value={editScriptCategory}
                          onValueChange={value =>
                            setEditScriptCategory(value as any)
                          }
                        >
                          <SelectTrigger className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {scriptCategories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label>태그</Label>
                        <Input
                          className="min-h-12 rounded-xl bg-white md:h-9 md:min-h-9"
                          value={editScriptTags}
                          onChange={event =>
                            setEditScriptTags(event.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label>본문</Label>
                        <Textarea
                          className="min-h-40 rounded-xl bg-white"
                          rows={8}
                          value={editScriptBody}
                          onChange={event =>
                            setEditScriptBody(event.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label>준법 주의 메모</Label>
                        <Textarea
                          className="min-h-24 rounded-xl bg-white"
                          value={editScriptNote}
                          onChange={event =>
                            setEditScriptNote(event.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                        <Button
                          variant="outline"
                          className="min-h-12 md:min-h-10"
                          onClick={() => setEditingScript(null)}
                          disabled={updateScript.isPending}
                        >
                          취소
                        </Button>
                        <Button
                          className="min-h-12 md:min-h-10"
                          onClick={submitScriptEdit}
                          disabled={updateScript.isPending}
                        >
                          {updateScript.isPending ? "저장 중..." : "저장"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <div className="grid gap-3">
                  {scriptItems.length === 0 ? (
                    <Card className="border-dashed border-slate-200 bg-white/80">
                      <CardContent className="space-y-2 p-5 text-sm text-muted-foreground">
                        <p className="font-semibold text-slate-900">
                          등록된 상담 스크립트가 없습니다.
                        </p>
                        <p>
                          {isBranchAdmin
                            ? "상단 입력 영역에서 기본 스크립트를 확인하거나 새 스크립트를 추가하세요."
                            : "지점장에게 상담 스크립트 등록을 요청하세요."}
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                  {scriptItems.map((item: any) => (
                    <Card
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-slate-200/80 bg-white/95 shadow-sm transition hover:border-primary/30",
                        selectedScript?.id === item.id &&
                          "border-primary/40 ring-1 ring-primary/20"
                      )}
                      onClick={() => setSelectedScriptId(item.id)}
                    >
                      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-semibold leading-6 text-slate-950">
                                {item.title}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  {item.category}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                                  {item.tags ?? "태그 없음"}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                                  {getActiveLabel(item.isActive)}
                                </span>
                              </div>
                            </div>
                            {selectedScript?.id === item.id ? (
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </div>
                          <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                            {item.scriptBody}
                          </p>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-3 min-h-11 w-full md:hidden"
                            onClick={event => {
                              event.stopPropagation();
                              copyPreviewText(item.scriptBody, "스크립트");
                            }}
                          >
                            <Copy className="mr-1 h-4 w-4" /> 스크립트 복사
                          </Button>
                        </div>
                        {isBranchAdmin ? (
                          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex md:flex-col lg:flex-row">
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-12 md:min-h-8"
                              onClick={() => openScriptEdit(item)}
                              disabled={updateScript.isPending}
                            >
                              <Edit3 className="mr-1 h-4 w-4" />
                              수정
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="min-h-12 md:min-h-8"
                              onClick={() => setDeleteScript(item)}
                              disabled={updateScript.isPending}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              삭제
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <ToolPreviewPanel
                  eyebrow="스크립트 미리보기"
                  title={selectedScript?.title}
                  meta={
                    selectedScript
                      ? `${selectedScript.category} / ${selectedScript.tags ?? "태그 없음"} / ${getActiveLabel(selectedScript.isActive)}`
                      : null
                  }
                  body={selectedScript?.scriptBody}
                  note={selectedScript?.complianceNote}
                  emptyText="상담 스크립트를 선택하면 긴 본문만 미리보기 안에서 스크롤됩니다."
                  onCopy={() =>
                    copyPreviewText(selectedScript?.scriptBody, "스크립트")
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <AlertDialog
          open={!!deleteChecklist}
          onOpenChange={open => !open && setDeleteChecklist(null)}
        >
          <AlertDialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AlertDialogHeader>
              <AlertDialogTitle>
                상담 체크리스트를 삭제하시겠습니까?
              </AlertDialogTitle>
              <AlertDialogDescription>
                삭제 후 목록에서 보이지 않습니다. 실제 상담 체크 결과는 삭제하지
                않고 체크리스트 정의만 비활성화합니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="min-h-12 md:min-h-10"
                disabled={updateChecklist.isPending}
              >
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 md:min-h-10"
                disabled={updateChecklist.isPending}
                onClick={event => {
                  event.preventDefault();
                  if (!deleteChecklist) return;
                  updateChecklist.mutate({
                    id: deleteChecklist.id,
                    isActive: false,
                  });
                }}
              >
                {updateChecklist.isPending ? "삭제 중..." : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={!!deleteTemplate}
          onOpenChange={open => !open && setDeleteTemplate(null)}
        >
          <AlertDialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AlertDialogHeader>
              <AlertDialogTitle>
                후속 문구 템플릿을 삭제하시겠습니까?
              </AlertDialogTitle>
              <AlertDialogDescription>
                삭제 후 목록에서 보이지 않습니다. 템플릿 본문 전문은 활동 로그에
                저장하지 않습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="min-h-12 md:min-h-10"
                disabled={updateTemplate.isPending}
              >
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 md:min-h-10"
                disabled={updateTemplate.isPending}
                onClick={event => {
                  event.preventDefault();
                  if (!deleteTemplate) return;
                  updateTemplate.mutate({
                    id: deleteTemplate.id,
                    isActive: false,
                  });
                }}
              >
                {updateTemplate.isPending ? "삭제 중..." : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={!!deleteScript}
          onOpenChange={open => !open && setDeleteScript(null)}
        >
          <AlertDialogContent className="max-h-[min(90vh,42rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AlertDialogHeader>
              <AlertDialogTitle>
                이 상담 스크립트를 삭제하시겠습니까?
              </AlertDialogTitle>
              <AlertDialogDescription>
                삭제 후 목록에서 보이지 않습니다. 실제 데이터는 hard delete하지
                않고 비활성화 상태로 전환됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="min-h-12 md:min-h-10"
                disabled={updateScript.isPending}
              >
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 md:min-h-10"
                disabled={updateScript.isPending}
                onClick={event => {
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
