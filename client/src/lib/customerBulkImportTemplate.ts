export const BULK_IMPORT_TEMPLATE_BRANCH_ADMIN_SAMPLE_ROW = [
  "홍길동",
  "1990-01-15",
  "010-1234-5678",
  "남",
  "서울",
  "5",
  "09:00-18:00",
  "지인",
  "렌선",
  "미상담",
  "상담 전 확인 필요",
  "부재",
  "2026-06-25 10:00",
  "초기 통화 연결되지 않음",
  "2026-06-27 11:00",
  "김담당",
] as const;

export const BULK_IMPORT_TEMPLATE_NON_ADMIN_SAMPLE_ROW = [
  "홍길동",
  "1990-01-15",
  "010-1234-5678",
  "남",
  "서울",
  "5",
  "09:00-18:00",
  "지인",
  "렌선",
  "미상담",
  "상담 전 확인 필요",
  "부재",
  "2026-06-25 10:00",
  "초기 통화 연결되지 않음",
  "2026-06-27 11:00",
] as const;

export function buildBulkImportTemplateGuideRows(canSelectAssignee: boolean) {
  const optionalColumns =
    "성별, 지역, 예상보험료(만원), 통화가능시간, 유입경로, DB 업체명, 상담상태, 메모, 상담기록, 상담일시, 상담메모, 다음연락일" +
    (canSelectAssignee ? ", 담당자" : "");

  return [
    ["구분", "내용"],
    ["필수 컬럼", "이름, 생년월일, 연락처"],
    ["선택 컬럼", optionalColumns],
    [
      "상담기록",
      "전화끊음, 입원중, 부재, 거절, 상담예정 중 하나. 별칭(예: 부재중, 통화거절)도 허용됩니다.",
    ],
    [
      "예상보험료",
      "만원 단위 숫자(소수 가능). 예: 50 → 50만원(저장: 500,000원). 열 이름은 예상보험료(만원) 또는 예상보험료 모두 가능합니다.",
    ],
    ["상담상태", "선택값입니다. 미입력 시 미상담으로 등록됩니다."],
    canSelectAssignee
      ? [
          "지점장 배정",
          "담당자 컬럼을 입력하면 해당 담당자에게 배정할 수 있습니다. 미입력 시 기존 정책을 따릅니다.",
        ]
      : [
          "비관리자 배정",
          "담당자 컬럼은 사용하지 않으며 업로드한 고객은 내 고객으로 등록됩니다.",
        ],
    [
      "주의",
      "실제 고객정보 테스트는 금지됩니다. 검수에는 [TEST] 데이터만 사용하세요.",
    ],
  ];
}

export function getBulkImportTemplateSampleRow(canSelectAssignee: boolean) {
  return canSelectAssignee
    ? [...BULK_IMPORT_TEMPLATE_BRANCH_ADMIN_SAMPLE_ROW]
    : [...BULK_IMPORT_TEMPLATE_NON_ADMIN_SAMPLE_ROW];
}
