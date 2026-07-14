export const CUSTOMER_SEGMENTS = [
  "all",
  "database",
  "contracted",
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];
export type ConcreteCustomerSegment = Exclude<CustomerSegment, "all">;

export type CustomerSegmentStatsInput = {
  contractCount?: number | null;
};

export type CustomerContractStateInput = {
  isActive?: boolean | null;
  deletedAt?: Date | string | null;
  contractStatus?: string | null;
  paymentStatus?: string | null;
};

export type CustomerSegmentCounts = Record<CustomerSegment, number>;

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  all: "전체",
  database: "DB 배분 고객",
  contracted: "실제 계약 고객",
};

const INACTIVE_CONTRACT_STATUSES = new Set(["철회", "해지"]);
const INACTIVE_PAYMENT_STATUSES = new Set(["실효", "해지"]);

export function isActiveCustomerContract(
  input: CustomerContractStateInput
): boolean {
  return (
    input.isActive !== false &&
    input.deletedAt == null &&
    !INACTIVE_CONTRACT_STATUSES.has(input.contractStatus ?? "") &&
    !INACTIVE_PAYMENT_STATUSES.has(input.paymentStatus ?? "")
  );
}

export function getConcreteCustomerSegment(
  input: CustomerSegmentStatsInput
): ConcreteCustomerSegment {
  if (Number(input.contractCount ?? 0) > 0) return "contracted";
  return "database";
}

export function emptyCustomerSegmentCounts(): CustomerSegmentCounts {
  return {
    all: 0,
    database: 0,
    contracted: 0,
  };
}
