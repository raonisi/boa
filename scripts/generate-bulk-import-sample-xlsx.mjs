/**
 * samples/bulk-import-sample.csv → samples/bulk-import-sample.xlsx
 * (고객등록양식 시트 + 작성안내 시트). CSV를 수정한 뒤 이 스크립트를 다시 실행하세요.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const csvPath = path.join(root, "samples", "bulk-import-sample.csv");
const outPath = path.join(root, "samples", "bulk-import-sample.xlsx");

const csvText = fs.readFileSync(csvPath, "utf8");
const { data, errors } = Papa.parse(csvText, { header: false, skipEmptyLines: "greedy" });
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
const rows = data.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));

const guideRows = [
  ["구분", "내용"],
  ["필수 컬럼", "이름, 생년월일, 연락처"],
  ["선택 컬럼", "성별, 지역, 예상보험료(만원), 통화가능시간, 유입경로, 상담상태, 메모"],
  ["예상보험료", "만원 단위 숫자(소수 가능). 열 이름은 예상보험료(만원) 또는 예상보험료 모두 가능합니다."],
  ["상담상태", "선택값입니다. 미입력 시 미상담으로 등록됩니다."],
  ["주의", "실제 고객정보 테스트는 금지됩니다. 검수에는 [TEST] 데이터만 사용하세요."],
  ["동기화", "이 파일은 scripts/generate-bulk-import-sample-xlsx.mjs 로 CSV에서 생성합니다."],
];

const workbook = XLSX.utils.book_new();
const formSheet = XLSX.utils.aoa_to_sheet(rows);
const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
XLSX.utils.book_append_sheet(workbook, formSheet, "고객등록양식");
XLSX.utils.book_append_sheet(workbook, guideSheet, "작성안내");
XLSX.writeFile(workbook, outPath);
console.log(`Wrote ${path.relative(root, outPath)} (${rows.length} data rows)`);
