/**
 * Sales pipeline Kanban ↔ DB `customers.consultStatus` mapping.
 * DB enum: 미상담, 부재, 통화완료, 상담예정, 설계중, 계약, 보류, 거절, 해지관리, 재상담필요
 */

export const CONSULT_STATUSES = [
  "미상담",
  "부재",
  "통화완료",
  "상담예정",
  "설계중",
  "계약",
  "보류",
  "거절",
  "해지관리",
  "재상담필요",
] as const;

export type ConsultStatus = (typeof CONSULT_STATUSES)[number];

export const SALES_PIPELINE_COLUMNS = [
  {
    id: "new",
    title: "신규 접수",
    subtitle: "미상담 · 부재",
    consultStatuses: ["미상담", "부재"],
  },
  {
    id: "ta",
    title: "TA / 전화연결",
    subtitle: "통화완료",
    consultStatuses: ["통화완료"],
  },
  {
    id: "ap",
    title: "AP / 대면상담",
    subtitle: "상담예정",
    consultStatuses: ["상담예정"],
  },
  {
    id: "proposal",
    title: "가입설계",
    subtitle: "설계중",
    consultStatuses: ["설계중"],
  },
  {
    id: "subscribed",
    title: "청약완료",
    subtitle: "계약",
    consultStatuses: ["계약"],
  },
] as const;

export type SalesPipelineColumnId =
  | (typeof SALES_PIPELINE_COLUMNS)[number]["id"]
  | "other";

const STATUS_TO_COLUMN = new Map<string, SalesPipelineColumnId>();
for (const col of SALES_PIPELINE_COLUMNS) {
  for (const s of col.consultStatuses) {
    STATUS_TO_COLUMN.set(s, col.id);
  }
}

/** Map DB status → Kanban column (unmapped → `other`). */
export function consultStatusToPipelineColumn(
  status: string | null | undefined
): SalesPipelineColumnId {
  if (!status) return "new";
  return STATUS_TO_COLUMN.get(status) ?? "other";
}

/** Primary DB status when a card is dropped on a pipeline column. */
export function pipelineColumnToConsultStatus(
  columnId: SalesPipelineColumnId
): ConsultStatus {
  switch (columnId) {
    case "new":
      return "미상담";
    case "ta":
      return "통화완료";
    case "ap":
      return "상담예정";
    case "proposal":
      return "설계중";
    case "subscribed":
      return "계약";
    case "other":
    default:
      return "보류";
  }
}

export const OTHER_PIPELINE_COLUMN = {
  id: "other" as const,
  title: "기타 단계",
  subtitle: "보류 · 거절 · 해지관리 · 재상담필요",
} as const;
