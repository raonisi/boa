export const CUSTOMER_RELATIONSHIP_TYPES = [
  "family_spouse",
  "family_child",
  "family_parent",
  "family_sibling",
  "referral",
  "coworker",
  "corporate_representative",
  "corporate_employee",
  "friend",
  "other",
] as const;

export type CustomerRelationshipType =
  (typeof CUSTOMER_RELATIONSHIP_TYPES)[number];

export const CUSTOMER_RELATIONSHIP_DIRECTIONS = [
  "outbound",
  "inbound",
  "mutual",
] as const;

export type CustomerRelationshipDirection =
  (typeof CUSTOMER_RELATIONSHIP_DIRECTIONS)[number];

export const CUSTOMER_RELATIONSHIP_STATUSES = ["active", "inactive"] as const;

export type CustomerRelationshipStatus =
  (typeof CUSTOMER_RELATIONSHIP_STATUSES)[number];

type RelationshipLabelMap = {
  outbound?: string;
  inbound?: string;
  mutual?: string;
};

export const CUSTOMER_RELATIONSHIP_TYPE_CONFIG: Record<
  CustomerRelationshipType,
  {
    defaultDirection: CustomerRelationshipDirection;
    labels: RelationshipLabelMap;
  }
> = {
  family_spouse: { defaultDirection: "mutual", labels: { mutual: "배우자" } },
  family_child: {
    defaultDirection: "outbound",
    labels: { outbound: "자녀", inbound: "부모" },
  },
  family_parent: {
    defaultDirection: "outbound",
    labels: { outbound: "부모", inbound: "자녀" },
  },
  family_sibling: {
    defaultDirection: "mutual",
    labels: { mutual: "형제자매" },
  },
  referral: {
    defaultDirection: "outbound",
    labels: { outbound: "소개자", inbound: "피소개자" },
  },
  coworker: { defaultDirection: "mutual", labels: { mutual: "직장동료" } },
  corporate_representative: {
    defaultDirection: "outbound",
    labels: { outbound: "법인 대표", inbound: "법인 임직원" },
  },
  corporate_employee: {
    defaultDirection: "outbound",
    labels: { outbound: "법인 임직원", inbound: "법인 대표" },
  },
  friend: { defaultDirection: "mutual", labels: { mutual: "지인" } },
  other: { defaultDirection: "mutual", labels: { mutual: "기타" } },
};

export const CUSTOMER_RELATIONSHIP_NOTE_MAX_LENGTH = 500;

export const CUSTOMER_RELATIONSHIP_SENSITIVE_NOTE_ERROR =
  "관계 메모에는 주민등록번호, 질병명, 병력, 계약번호 등 민감정보를 입력할 수 없습니다.";

const SENSITIVE_NOTE_PATTERNS = [
  /\d{6}-\d{7}/,
  /주민(?:등록)?(?:번호)?/i,
  /(?:질병|병력|진단|수술|암|당뇨|고혈압)/i,
  /(?:증권|계약|증명)\s*번호/i,
  /(?:보험료|납입|월납)\s*\d/i,
];

export function resolveRelationshipLabel(
  relationshipType: CustomerRelationshipType,
  direction: CustomerRelationshipDirection
): string {
  const config = CUSTOMER_RELATIONSHIP_TYPE_CONFIG[relationshipType];
  if (direction === "mutual") {
    return config.labels.mutual ?? config.labels.outbound ?? "기타";
  }
  if (direction === "outbound") {
    return config.labels.outbound ?? config.labels.mutual ?? "기타";
  }
  return config.labels.inbound ?? config.labels.outbound ?? "기타";
}

export function resolveDefaultDirection(
  relationshipType: CustomerRelationshipType
): CustomerRelationshipDirection {
  return CUSTOMER_RELATIONSHIP_TYPE_CONFIG[relationshipType].defaultDirection;
}

export function displayRelationshipLabelForViewer(
  relationshipType: CustomerRelationshipType,
  direction: CustomerRelationshipDirection,
  storedLabel: string,
  viewingCustomerId: number,
  primaryCustomerId: number
): string {
  if (viewingCustomerId === primaryCustomerId) return storedLabel;
  const config = CUSTOMER_RELATIONSHIP_TYPE_CONFIG[relationshipType];
  if (direction === "mutual") return storedLabel;
  if (direction === "outbound") {
    return config.labels.inbound ?? storedLabel;
  }
  if (direction === "inbound") {
    return config.labels.outbound ?? storedLabel;
  }
  return storedLabel;
}

export function assertRelationshipNoteSafe(note?: string | null) {
  const trimmed = note?.trim();
  if (!trimmed) return;
  if (trimmed.length > CUSTOMER_RELATIONSHIP_NOTE_MAX_LENGTH) {
    throw new Error(
      `관계 메모는 ${CUSTOMER_RELATIONSHIP_NOTE_MAX_LENGTH}자 이내로 입력해 주세요.`
    );
  }
  if (SENSITIVE_NOTE_PATTERNS.some(pattern => pattern.test(trimmed))) {
    throw new Error(CUSTOMER_RELATIONSHIP_SENSITIVE_NOTE_ERROR);
  }
}

export function normalizeCustomerPair(
  customerA: number,
  customerB: number
): [number, number] {
  return customerA < customerB
    ? [customerA, customerB]
    : [customerB, customerA];
}
