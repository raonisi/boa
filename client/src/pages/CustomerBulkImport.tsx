import { useState, useRef } from "react";
import { useLocation } from "wouter";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Download, Upload, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatUserWithRole } from "@/lib/userRole";

interface ParsedRow {
  [key: string]: string;
}

interface ValidationResult {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
}

export default function CustomerBulkImport() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [mimeType, setMimeType] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [stage, setStage] = useState<"upload" | "preview" | "result">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [importBatchId, setImportBatchId] = useState<string>("");
  const [assignmentMode, setAssignmentMode] = useState<string>("csv");

  const downloadTemplateQuery = trpc.customers.downloadImportTemplate.useQuery();
  const previewImportMutation = trpc.customers.previewImport.useMutation();
  const bulkImportMutation = trpc.customers.bulkImport.useMutation();
  const canSelectAssignee = user?.role === "branch_admin";
  const { data: allUsers } = trpc.users.list.useQuery(undefined, { enabled: canSelectAssignee });
  const selectableAgents = (allUsers ?? []).filter((agent) =>
    (agent as any).accountStatus === "active" &&
    agent.id !== user?.id &&
    ["branch_admin", "sub_branch_admin", "team_leader", "member"].includes(agent.role)
  );
  const selectedAgentId =
    canSelectAssignee && assignmentMode !== "csv"
      ? Number(assignmentMode)
      : undefined;

  const templateHeaders = downloadTemplateQuery.data?.headers ?? [];
  const sampleRow = canSelectAssignee
    ? ["홍길동", "1990-01-15", "010-1234-5678", "남", "서울", "5", "09:00-18:00", "지인", "미상담", "상담 전 확인 필요", "김담당"]
    : ["홍길동", "1990-01-15", "010-1234-5678", "남", "서울", "5", "09:00-18:00", "지인", "미상담", "상담 전 확인 필요"];

  const templateGuideRows = [
    ["구분", "내용"],
    ["필수 컬럼", "이름, 생년월일, 연락처"],
    ["선택 컬럼", "성별, 지역, 예상보험료(만원), 통화가능시간, 유입경로, 상담상태, 메모"],
    ["예상보험료", "만원 단위 숫자(소수 가능). 예: 50 → 50만원(저장: 500,000원). 열 이름은 예상보험료(만원) 또는 예상보험료 모두 가능합니다."],
    ["상담상태", "선택값입니다. 미입력 시 미상담으로 등록됩니다."],
    ["비관리자 배정", "업로드한 고객은 내 고객으로 자동 등록됩니다. 담당자 컬럼은 사용하지 않습니다."],
    ["지점장 배정", "담당자 컬럼을 입력하면 해당 담당자에게 배정할 수 있습니다. 미입력 시 기존 정책을 따릅니다."],
    ["주의", "실제 고객정보 테스트는 금지됩니다. 검수에는 [TEST] 데이터만 사용하세요."],
  ];

  const handleDownloadXlsxTemplate = async () => {
    try {
      if (!downloadTemplateQuery.data) {
        alert("양식을 로드할 수 없습니다.");
        return;
      }
      const workbook = XLSX.utils.book_new();
      const formSheet = XLSX.utils.aoa_to_sheet([templateHeaders, sampleRow]);
      const guideSheet = XLSX.utils.aoa_to_sheet(templateGuideRows);
      XLSX.utils.book_append_sheet(workbook, formSheet, "고객등록양식");
      XLSX.utils.book_append_sheet(workbook, guideSheet, "작성안내");
      XLSX.writeFile(workbook, canSelectAssignee ? "고객_일괄_등록_양식_지점장.xlsx" : "고객_일괄_등록_양식.xlsx");
    } catch (error) {
      alert("엑셀 양식 다운로드에 실패했습니다.");
    }
  };

  const handleDownloadCsvTemplate = async () => {
    try {
      if (!downloadTemplateQuery.data) {
        alert("양식을 로드할 수 없습니다.");
        return;
      }
      const csv = `${templateHeaders.join(",")}\n${sampleRow.join(",")}`;
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "고객_일괄_업로드_양식.csv";
      link.click();
    } catch (error) {
      alert("양식 다운로드에 실패했습니다.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx");
    if (!isCsv && !isXlsx) {
      alert("CSV 또는 XLSX 파일만 지원합니다.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    const nextMimeType = file.type || (isXlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv");
    setMimeType(nextMimeType);

    if (isXlsx) {
      file.arrayBuffer()
        .then((buffer) => {
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
          setParsedRows(rows);
          handlePreview(rows, file.name, file.size, nextMimeType);
        })
        .catch((error: any) => {
          alert(`파일 파싱 오류: ${error.message}`);
        });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const rows = results.data as ParsedRow[];
        setParsedRows(rows);
        handlePreview(rows, file.name, file.size, nextMimeType);
      },
      error: (error: any) => {
        alert(`파일 파싱 오류: ${error.message}`);
      },
    });
  };

  const handlePreview = async (rows: ParsedRow[], selectedFileName = fileName, selectedFileSize = fileSize, selectedMimeType = mimeType) => {
    if (rows.length === 0) {
      alert("파일에 데이터가 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await previewImportMutation.mutateAsync({ rows, fileName: selectedFileName, fileSize: selectedFileSize, mimeType: selectedMimeType, agentId: selectedAgentId });
      setValidationResults(result.validationResults);
      setStage("preview");
    } catch (error: any) {
      alert(`검증 오류: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!confirm("정상 행만 등록합니다. 계속하시겠습니까?")) return;

    setIsLoading(true);
    try {
      const result = await bulkImportMutation.mutateAsync({
        rows: parsedRows,
        fileName,
        fileSize,
        mimeType,
        agentId: selectedAgentId,
      });
      setImportBatchId(result.importBatchId);
      setValidationResults(result.validationResults);
      setStage("result");
    } catch (error: any) {
      alert(`등록 오류: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const successCount = validationResults.filter((r) => r.isValid).length;
  const errorCount = validationResults.filter((r) => !r.isValid).length;
  const duplicateCount = validationResults.filter((r) =>
    r.errors.some((e) => e.includes("기존 DB에 존재"))
  ).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">고객 DB 일괄 등록</h1>
          <p className="text-muted-foreground">
            엑셀 또는 CSV 파일을 통해 여러 고객을 한 번에 등록할 수 있습니다.
            {canSelectAssignee ? " 담당자 지정 방식은 아래에서 선택하세요." : " 등록된 고객은 내 고객으로 자동 배정됩니다."}
          </p>
        </div>

        {/* Stage: Upload */}
        {stage === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>1단계: 파일 선택</CardTitle>
              <CardDescription>XLSX 또는 CSV 파일을 선택하여 업로드하세요. (최대 5MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-3">📋 먼저 엑셀 양식을 다운로드하여 데이터를 준비하세요. CSV는 보조 옵션으로 제공합니다.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleDownloadXlsxTemplate}
                    disabled={downloadTemplateQuery.isLoading}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Excel 양식 다운로드
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadCsvTemplate}
                    disabled={downloadTemplateQuery.isLoading}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    CSV 양식 다운로드
                  </Button>
                </div>
                <div className="mt-3 space-y-1 text-xs text-blue-900">
                  <p>필수 컬럼은 이름, 생년월일, 연락처입니다.</p>
                  <p>상담상태는 선택값이며, 미입력 시 미상담으로 등록됩니다.</p>
                  {canSelectAssignee ? (
                    <p>담당자 컬럼을 입력하면 해당 담당자에게 고객이 배정됩니다. 부지점장/팀 컬럼은 사용하지 않습니다.</p>
                  ) : (
                    <p>업로드한 고객은 내 고객으로 자동 등록됩니다. 담당자 컬럼은 사용하지 않습니다.</p>
                  )}
                  <p>실제 고객정보 테스트는 금지됩니다.</p>
                </div>
              </div>

              {canSelectAssignee ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-medium text-slate-900">담당자 지정 방식</p>
                  <Select value={assignmentMode} onValueChange={setAssignmentMode}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="담당자 지정 방식 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">파일의 담당자 컬럼 사용</SelectItem>
                      {user && <SelectItem value={String(user.id)}>내 고객으로 일괄 등록</SelectItem>}
                      {selectableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>{formatUserWithRole(agent)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-slate-500">
                    특정 담당자를 선택하면 파일의 담당자 컬럼보다 선택한 담당자 기준으로 등록됩니다.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                  비관리자 일괄 등록 고객은 모두 내 고객으로 자동 배정됩니다. 타인 DB 배분은 기존 DB 배정 권한 흐름을 사용합니다.
                </div>
              )}

              {/* File Upload */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const event = {
                      target: { files: [file] },
                    } as any;
                    handleFileSelect(event);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">파일을 여기에 드래그하거나 클릭하여 선택</p>
                <p className="text-sm text-muted-foreground">XLSX 또는 CSV 파일을 지원합니다</p>
              </div>

              {/* File Name Display */}
              {fileName && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-900">{fileName} 선택됨</span>
                </div>
              )}

              {/* Security Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900 font-medium mb-2">⚠️ 보안 주의사항</p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>주민등록번호, 증권번호 등 민감정보는 절대 포함하지 마세요</li>
                  <li>파일에 포함된 데이터는 서버에서 재검증됩니다</li>
                  <li>중복된 연락처는 자동으로 제외됩니다</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stage: Preview */}
        {stage === "preview" && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">{parsedRows.length}</p>
                    <p className="text-sm text-muted-foreground">총 행 수</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{successCount}</p>
                    <p className="text-sm text-muted-foreground">정상</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-600">{errorCount}</p>
                    <p className="text-sm text-muted-foreground">오류</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-600">{duplicateCount}</p>
                    <p className="text-sm text-muted-foreground">중복</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview Table */}
            <Card>
              <CardHeader>
                <CardTitle>2단계: 검증 결과</CardTitle>
                <CardDescription>빨간색으로 표시된 행에 오류가 있습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 px-2 font-medium">행</th>
                        <th className="text-left py-2 px-2 font-medium">이름</th>
                        <th className="text-left py-2 px-2 font-medium">연락처</th>
                        <th className="text-left py-2 px-2 font-medium">상태</th>
                        <th className="text-left py-2 px-2 font-medium">오류 메시지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResults.map((result) => {
                        const row = parsedRows[result.rowIndex];
                        return (
                          <tr
                            key={result.rowIndex}
                            className={`border-b ${
                              result.isValid ? "bg-white" : "bg-red-50"
                            }`}
                          >
                            <td className="py-2 px-2">{result.rowIndex + 1}</td>
                            <td className="py-2 px-2">{row.이름 || "-"}</td>
                            <td className="py-2 px-2">{row.연락처 || "-"}</td>
                            <td className="py-2 px-2">
                              {result.isValid ? (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="w-4 h-4" />
                                  정상
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <AlertCircle className="w-4 h-4" />
                                  오류
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {result.errors.length > 0 ? (
                                <div className="text-xs text-red-600 space-y-1">
                                  {result.errors.map((err, i) => (
                                    <div key={i}>• {err}</div>
                                  ))}
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStage("upload");
                  setFileName("");
                  setParsedRows([]);
                  setValidationResults([]);
                }}
              >
                다시 선택
              </Button>
              <Button
                onClick={handleBulkImport}
                disabled={isLoading || successCount === 0}
              >
                {isLoading ? "처리 중..." : `정상 행 ${successCount}건 등록`}
              </Button>
            </div>
          </div>
        )}

        {/* Stage: Result */}
        {stage === "result" && (
          <div className="space-y-6">
            {/* Success Summary */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                  <div>
                    <p className="text-lg font-bold text-green-900">등록 완료</p>
                    <p className="text-sm text-green-800">
                      배치 ID: <span className="font-mono">{importBatchId}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Result Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">{parsedRows.length}</p>
                    <p className="text-sm text-muted-foreground">총 행 수</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{successCount}</p>
                    <p className="text-sm text-muted-foreground">성공</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-600">{errorCount}</p>
                    <p className="text-sm text-muted-foreground">실패</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-600">{duplicateCount}</p>
                    <p className="text-sm text-muted-foreground">중복 제외</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error List */}
            {errorCount > 0 && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    오류 행 목록
                  </CardTitle>
                  <CardDescription>다음 행들을 수정하여 다시 업로드하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-2 font-medium">행</th>
                          <th className="text-left py-2 px-2 font-medium">이름</th>
                          <th className="text-left py-2 px-2 font-medium">연락처</th>
                          <th className="text-left py-2 px-2 font-medium">오류 사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResults
                          .filter((r) => !r.isValid)
                          .map((result) => {
                            const row = parsedRows[result.rowIndex];
                            return (
                              <tr key={result.rowIndex} className="border-b">
                                <td className="py-2 px-2">{result.rowIndex + 1}</td>
                                <td className="py-2 px-2">{row.이름 || "-"}</td>
                                <td className="py-2 px-2">{row.연락처 || "-"}</td>
                                <td className="py-2 px-2">
                                  <div className="text-xs text-red-600 space-y-1">
                                    {result.errors.map((err, i) => (
                                      <div key={i}>• {err}</div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <Button
                variant="outline"
                onClick={() => navigate("/customers")}
              >
                고객 목록으로
              </Button>
              <Button
                onClick={() => {
                  setStage("upload");
                  setFileName("");
                  setParsedRows([]);
                  setValidationResults([]);
                  setImportBatchId("");
                }}
              >
                다시 업로드
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
