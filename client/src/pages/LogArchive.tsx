import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Archive, Calendar, Download, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LogArchive() {
  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: months, isLoading: monthsLoading } = trpc.logs.archiveMonths.useQuery();
  const { data: history } = trpc.logs.archiveHistory.useQuery();

  const archiveMutation = trpc.logs.createArchive.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.archiveMonth} 아카이빙 완료 (${result.totalLogs}건)`);
      utils.logs.archiveHistory.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const exportMutation = trpc.logs.getArchiveData.useMutation({
    onSuccess: (result) => {
      const headers = ["id", "날짜", "사용자", "작업", "대상유형", "대상ID", "상세", "IP"];
      const csvContent = [
        headers.join(","),
        ...result.logs.map((row: any) =>
          headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `activity_logs_${exporting}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${result.totalCount}건 CSV 다운로드 완료`);
      setExporting(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setExporting(null);
    },
  });

  const handleExport = (month: string) => {
    const [year, m] = month.split("-").map(Number);
    const dateFrom = new Date(year, m - 1, 1).toISOString();
    const dateTo = new Date(year, m, 0).toISOString();
    setExporting(month);
    exportMutation.mutate({ dateFrom, dateTo });
  };

  const handleArchive = (month: string) => {
    if (!confirm(`${month} 로그를 아카이빙하시겠습니까? 아카이빙 이력이 기록됩니다.`)) return;
    archiveMutation.mutate({ archiveMonth: month });
  };

  const archivedMonths = new Set((history ?? []).map((h: any) => h.archiveMonth));
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b99b5f]">Log Archive</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">로그 아카이빙</h1>
            <p className="mt-1 text-sm text-slate-500">
              월별 활동 로그를 CSV로 내보내고 아카이빙 이력을 관리합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              월별 로그 현황
            </CardTitle>
            <CardDescription>과거 월의 로그를 내보내기하고 아카이빙 처리할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                로딩 중...
              </div>
            ) : (months ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                <Archive className="w-8 h-8 opacity-30" />
                <p className="text-sm">활동 로그가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>월</TableHead>
                      <TableHead className="text-right">로그 수</TableHead>
                      <TableHead>기간</TableHead>
                      <TableHead>아카이빙 상태</TableHead>
                      <TableHead className="text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(months ?? []).map((m: any) => {
                      const isArchived = archivedMonths.has(m.month);
                      const isCurrent = m.month === currentMonth;
                      return (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell className="text-right tabular-nums">{m.count.toLocaleString()}건</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.minDate ? new Date(m.minDate).toLocaleDateString("ko-KR") : "-"} ~{" "}
                            {m.maxDate ? new Date(m.maxDate).toLocaleDateString("ko-KR") : "-"}
                          </TableCell>
                          <TableCell>
                            {isArchived ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                완료
                              </span>
                            ) : isCurrent ? (
                              <span className="text-xs text-muted-foreground">진행 중</span>
                            ) : (
                              <span className="text-xs text-amber-600">미처리</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExport(m.month)}
                                disabled={exporting === m.month}
                              >
                                {exporting === m.month ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 mr-1" />
                                )}
                                CSV 내보내기
                              </Button>
                              {!isCurrent && !isArchived && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleArchive(m.month)}
                                  disabled={archiveMutation.isPending}
                                >
                                  <Archive className="h-3.5 w-3.5 mr-1" />
                                  아카이빙
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {exporting && (
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-sm">{exporting} 로그 데이터를 내보내는 중...</span>
                </div>
                <Progress value={exportMutation.isPending ? 60 : 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {(history ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Archive className="w-4 h-4" />
                아카이빙 이력
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>아카이빙 월</TableHead>
                      <TableHead className="text-right">로그 수</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>파일명</TableHead>
                      <TableHead>처리일</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(history ?? []).map((h: any) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.archiveMonth}</TableCell>
                        <TableCell className="text-right tabular-nums">{h.totalLogs.toLocaleString()}건</TableCell>
                        <TableCell className="text-xs">{h.archiveType === "monthly" ? "자동" : "수동"}</TableCell>
                        <TableCell className="font-mono text-xs">{h.fileName ?? "-"}</TableCell>
                        <TableCell className="text-xs">{h.createdAt ? new Date(h.createdAt).toLocaleString("ko-KR") : "-"}</TableCell>
                        <TableCell>
                          <span className={`text-xs ${h.status === "completed" ? "text-emerald-600" : "text-destructive"}`}>
                            {h.status === "completed" ? "완료" : "실패"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
