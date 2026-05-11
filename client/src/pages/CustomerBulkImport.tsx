import { useState, useRef } from "react";
import { useLocation } from "wouter";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Download, Upload, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ParsedRow {
  [key: string]: string;
}

interface ValidationResult {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
}

export default function CustomerBulkImport() {
  const [location, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [stage, setStage] = useState<"upload" | "preview" | "result">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [importBatchId, setImportBatchId] = useState<string>("");

  const downloadTemplateQuery = trpc.customers.downloadImportTemplate.useQuery();
  const previewImportMutation = trpc.customers.previewImport.useMutation();
  const bulkImportMutation = trpc.customers.bulkImport.useMutation();

  const handleDownloadTemplate = async () => {
    try {
      if (!downloadTemplateQuery.data) {
        alert("양식을 로드할 수 없습니다.");
        return;
      }
      const result = downloadTemplateQuery.data;
      const csv = result.csvContent + "\n예시,010-1234-5678,1990-01-15,남,서울,5000,09:00-18:00,지인,미상담,메모,부지점장명,팀명,담당자명";
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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

    if (!file.name.endsWith(".csv")) {
      alert("CSV 파일만 지원합니다.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const rows = results.data as ParsedRow[];
        setParsedRows(rows);
        handlePreview(rows);
      },
      error: (error: any) => {
        alert(`파일 파싱 오류: ${error.message}`);
      },
    });
  };

  const handlePreview = async (rows: ParsedRow[]) => {
    if (rows.length === 0) {
      alert("파일에 데이터가 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await previewImportMutation.mutateAsync({ rows });
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
          <p className="text-muted-foreground">CSV 파일을 통해 여러 고객을 한 번에 등록할 수 있습니다.</p>
        </div>

        {/* Stage: Upload */}
        {stage === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>1단계: 파일 선택</CardTitle>
              <CardDescription>CSV 파일을 선택하여 업로드하세요. (최대 5MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-3">📋 먼저 양식을 다운로드하여 데이터를 준비하세요.</p>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  disabled={downloadTemplateQuery.isLoading}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  CSV 양식 다운로드
                </Button>
              </div>

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
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">파일을 여기에 드래그하거나 클릭하여 선택</p>
                <p className="text-sm text-muted-foreground">CSV 파일만 지원합니다</p>
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
