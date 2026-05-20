import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Download as DownloadIcon, FileText, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DownloadType = "customers" | "contracts" | "schedules" | "performance";

const itemMeta: Record<DownloadType, { label: string; desc: string; icon: typeof FileText }> = {
  customers: {
    label: "고객 DB",
    desc: "고객 기본정보, 상담상태, 유입경로 등 고객 관리 데이터를 다운로드합니다.",
    icon: Users,
  },
  contracts: {
    label: "계약정보",
    desc: "보험사, 상품명, 월납보험료, 계약상태 등 계약 데이터를 다운로드합니다.",
    icon: FileText,
  },
  schedules: {
    label: "일정정보",
    desc: "일정 제목, 유형, 상태, 시작시간 등 일정 데이터를 다운로드합니다.",
    icon: FileText,
  },
  performance: {
    label: "실적정보",
    desc: "신규 계약, 월납보험료, 상담 수, 목표 달성률 등 집계 데이터를 다운로드합니다.",
    icon: FileText,
  },
};

export function neutralizeSpreadsheetFormula(raw: unknown): string {
  const value = raw === null || raw === undefined ? "" : String(raw);
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(raw: unknown): string {
  const value = neutralizeSpreadsheetFormula(raw);
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    toast.error("다운로드할 데이터가 없습니다.");
    return;
  }
  const keys = Object.keys(data[0]);
  const header = keys.join(",");
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k];
      return escapeCsvCell(val);
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} 다운로드 완료`);
}

export default function Download() {
  const [downloading, setDownloading] = useState<DownloadType | null>(null);
  const [pendingType, setPendingType] = useState<DownloadType | null>(null);
  const [downloadReason, setDownloadReason] = useState("");
  const [maskedDownload, setMaskedDownload] = useState(true);
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [rawExportConfirmed, setRawExportConfirmed] = useState(false);

  const utils = trpc.useUtils();
  const previewQuery = trpc.download.preview.useQuery();

  const openDownloadDialog = (type: DownloadType) => {
    setPendingType(type);
    setDownloadReason("");
    setMaskedDownload(true);
    setFinalConfirmed(false);
    setRawExportConfirmed(false);
  };

  const handleDownload = async (type: DownloadType, reason: string, masked: boolean, rawConfirmed: boolean) => {
    setDownloading(type);
    try {
      let data: any[] = [];
      const now = new Date().toISOString().slice(0, 10);
      const request = { reason, masked, rawConfirm: !masked && rawConfirmed };
      if (type === "customers") {
        data = await utils.download.customers.fetch(request);
        downloadCSV(data, `고객DB_${now}${masked ? "_마스킹" : ""}.csv`);
      } else if (type === "contracts") {
        data = await utils.download.contracts.fetch(request);
        downloadCSV(data, `계약정보_${now}${masked ? "_마스킹" : ""}.csv`);
      } else if (type === "schedules") {
        data = await utils.download.schedules.fetch(request);
        downloadCSV(data, `일정정보_${now}${masked ? "_마스킹" : ""}.csv`);
      } else if (type === "performance") {
        const stats = await utils.download.performance.fetch(request);
        downloadCSV(stats ? [stats] : [], `실적정보_${now}${masked ? "_마스킹" : ""}.csv`);
      }
      setPendingType(null);
      setDownloadReason("");
      setFinalConfirmed(false);
      setRawExportConfirmed(false);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    } finally {
      setDownloading(null);
    }
  };

  const pendingMeta = pendingType ? itemMeta[pendingType] : null;
  const pendingPreview = pendingType ? previewQuery.data?.[pendingType] : null;
  const canExecute = Boolean(pendingType)
    && downloadReason.trim().length >= 5
    && finalConfirmed
    && (maskedDownload || rawExportConfirmed)
    && downloading === null
    && !previewQuery.isLoading;

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">데이터 다운로드</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">지점장 전용 CSV 다운로드입니다. 실행 전 범위와 민감정보 포함 여부를 확인합니다.</p>
        </div>

        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="mb-1 font-semibold text-destructive">개인정보 취급 주의</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>다운로드 파일에는 고객명, 연락처, 생년월일, 상품명, 보험료 등 민감정보가 포함될 수 있습니다.</li>
                  <li>파일은 업무 목적에 한해 사용하고 안전한 저장소에 보관해 주세요.</li>
                  <li>모든 다운로드 이력은 DATA_DOWNLOAD 로그로 기록됩니다.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {(Object.keys(itemMeta) as DownloadType[]).map((type) => {
            const meta = itemMeta[type];
            const Icon = meta.icon;
            const preview = previewQuery.data?.[type];
            return (
              <Card key={type}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="rounded-lg bg-muted p-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{meta.desc}</p>
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        예상 건수: {previewQuery.isLoading ? "확인 중" : `${preview?.rowCount ?? 0}건`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloading === type || previewQuery.isLoading}
                    onClick={() => openDownloadDialog(type)}
                    className="min-h-11 w-full shrink-0 sm:w-auto"
                  >
                    <DownloadIcon className="mr-1 h-4 w-4" />
                    {downloading === type ? "다운로드 중..." : "CSV 다운로드"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          * 다운로드 사유, 건수, 마스킹 여부는 DATA_DOWNLOAD 로그 metadata에 기록됩니다.
        </p>
      </div>

      <Dialog open={pendingType !== null} onOpenChange={(open) => !open && setPendingType(null)}>
        <DialogContent className="flex max-h-[min(85dvh,42rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>다운로드 범위를 확인해 주세요.</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2 sm:px-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-950">{pendingMeta?.label ?? "데이터"} 다운로드</p>
              <p className="mt-1 text-xs text-muted-foreground">
                총 {previewQuery.isLoading ? "확인 중" : `${pendingPreview?.rowCount ?? 0}건`}이 다운로드됩니다.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700">포함 필드</p>
              <div className="flex flex-wrap gap-2">
                {(pendingPreview?.fields ?? []).map((field) => (
                  <Badge key={field.key} variant={field.sensitive ? "destructive" : "secondary"} className="rounded-full">
                    {field.label}{field.sensitive ? " · 민감" : ""}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              민감정보가 포함될 수 있습니다. 외부 파일 생성 후 보관과 공유에 주의해 주세요.
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={maskedDownload}
                onChange={(event) => {
                  setMaskedDownload(event.target.checked);
                  setRawExportConfirmed(false);
                }}
                className="mt-1"
              />
              <span>
                <span className="flex items-center gap-1 font-medium"><ShieldCheck className="h-4 w-4" /> 마스킹된 파일로 다운로드</span>
                <span className="mt-1 block text-xs text-muted-foreground">이름, 연락처, 생년월일, 상품명, 보험료 등 민감 필드를 서버에서 마스킹한 뒤 CSV를 생성합니다.</span>
              </span>
            </label>

            {!maskedDownload && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950">
                <input
                  type="checkbox"
                  checked={rawExportConfirmed}
                  onChange={(event) => setRawExportConfirmed(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    원본 데이터 export를 승인합니다
                  </span>
                  <span className="mt-1 block text-xs">
                    마스킹 없이 외부 CSV 파일이 생성됩니다. 업무상 필요한 경우에만 사유를 남기고 실행하세요.
                  </span>
                </span>
              </label>
            )}

            <div>
              <Label htmlFor="download-reason" className="text-xs">다운로드 사유 *</Label>
              <Textarea
                id="download-reason"
                value={downloadReason}
                onChange={(e) => setDownloadReason(e.target.value)}
                rows={4}
                maxLength={300}
                className="mt-1"
                placeholder="예: 파일럿 운영 전 고객 DB 정합성 점검"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">5자 이상 300자 이하로 입력해 주세요.</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={finalConfirmed}
                onChange={(event) => setFinalConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>다운로드 범위와 외부 파일 생성 주의사항을 확인했습니다.</span>
            </label>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={() => setPendingType(null)}>취소</Button>
            <Button
              size="sm"
              className="min-h-11 sm:min-h-9"
              disabled={!canExecute}
              onClick={() => pendingType && handleDownload(pendingType, downloadReason.trim(), maskedDownload, rawExportConfirmed)}
            >
              다운로드 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
