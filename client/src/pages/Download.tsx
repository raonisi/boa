import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Download as DownloadIcon, FileText, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DownloadType = "customers" | "contracts" | "schedules" | "performance";

function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) { toast.error("다운로드할 데이터가 없습니다."); return; }
  const keys = Object.keys(data[0]);
  const header = keys.join(",");
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k];
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} 다운로드 완료`);
}

export default function Download() {
  const [downloading, setDownloading] = useState<DownloadType | null>(null);

  const utils = trpc.useUtils();

  const handleDownload = async (type: DownloadType) => {
    setDownloading(type);
    try {
      let data: any[] = [];
      const now = new Date().toISOString().slice(0, 10);
      if (type === "customers") {
        data = await utils.download.customers.fetch();
        downloadCSV(data, `고객DB_${now}.csv`);
      } else if (type === "contracts") {
        data = await utils.download.contracts.fetch();
        downloadCSV(data, `계약정보_${now}.csv`);
      } else if (type === "schedules") {
        data = await utils.download.schedules.fetch();
        downloadCSV(data, `일정정보_${now}.csv`);
      } else if (type === "performance") {
        const stats = await utils.download.performance.fetch();
        downloadCSV(stats ? [stats] : [], `실적정보_${now}.csv`);
      }
    } catch (e) {
      toast.error("다운로드에 실패했습니다.");
    } finally {
      setDownloading(null);
    }
  };

  const items = [
    { type: "customers" as DownloadType, label: "고객 DB", desc: "전체 고객 정보 (이름, 연락처, 지역, 유입경로, 상담상태 등)", icon: Users },
    { type: "contracts" as DownloadType, label: "계약정보", desc: "전체 계약 정보 (보험사, 상품명, 월보험료, 계약상태 등)", icon: FileText },
    { type: "schedules" as DownloadType, label: "일정정보", desc: "전체 일정 정보 (제목, 유형, 상태, 시작시간 등)", icon: FileText },
    { type: "performance" as DownloadType, label: "실적정보", desc: "전체 실적 집계 (계약건수, 월납보험료, 상담률, 계약률 등)", icon: FileText },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">데이터 다운로드</h1>
          <p className="text-sm text-muted-foreground mt-0.5">지점장 전용 — 전체 데이터를 CSV 형식으로 다운로드합니다.</p>
        </div>

        {/* 개인정보 취급 주의 문구 */}
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive mb-1">⚠️ 개인정보 취급 주의</p>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li>• 다운로드된 파일에는 고객 개인정보(이름, 연락처, 생년월일 등)가 포함됩니다.</li>
                  <li>• 개인정보보호법에 따라 업무 목적 외 사용을 금지합니다.</li>
                  <li>• 파일은 안전한 장소에 보관하고, 사용 후 즉시 삭제해주세요.</li>
                  <li>• 모든 다운로드 이력은 시스템에 기록됩니다.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 다운로드 항목 */}
        <div className="space-y-3">
          {items.map(({ type, label, desc, icon: Icon }) => (
            <Card key={type}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloading === type}
                    onClick={() => handleDownload(type)}
                    className="shrink-0"
                  >
                    <DownloadIcon className="h-4 w-4 mr-1" />
                    {downloading === type ? "다운로드 중..." : "CSV 다운로드"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          * 다운로드 시 DATA_DOWNLOAD 로그가 기록됩니다. 활동 로그에서 확인할 수 있습니다.
        </p>
      </div>
    </DashboardLayout>
  );
}
