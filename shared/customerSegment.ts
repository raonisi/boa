export const CUSTOMER_SEGMENTS = [
  "all",
  "db_only",
  "in_progress_db",
  "contracted",
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];
export type ConcreteCustomerSegment = Exclude<CustomerSegment, "all">;

export type CustomerSegmentStatsInput = {
  contractCount?: number | null;
  consultationCount?: number | null;
  followUpCount?: number | null;
  activityCount?: number | null;
  nextAction?: string | null;
};

export type CustomerSegmentCounts = Record<CustomerSegment, number>;

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  all: "전체",
  db_only: "배분 DB",
  in_progress_db: "상담 진행 DB",
  contracted: "계약 고객",
};

export function getConcreteCustomerSegment(
  input: CustomerSegmentStatsInput
): ConcreteCustomerSegment {
  if (Number(input.contractCount ?? 0) > 0) return "contracted";
  if (
    Number(input.consultationCount ?? 0) > 0 ||
    Number(input.followUpCount ?? 0) > 0 ||
    Number(input.activityCount ?? 0) > 0 ||
    Boolean(input.nextAction?.trim())
  ) {
    return "in_progress_db";
  }
  return "db_only";
}

export function emptyCustomerSegmentCounts(): CustomerSegmentCounts {
  return {
    all: 0,
    db_only: 0,
    in_progress_db: 0,
    contracted: 0,
  };
}
