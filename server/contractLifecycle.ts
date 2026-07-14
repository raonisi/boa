import { eq } from "drizzle-orm";
import {
  contractLifecycleEvents,
  contracts,
  type ContractLifecycleEvent,
} from "../drizzle/schema";

export const CONTRACT_LIFECYCLE_EVENT_TYPES = [
  "created",
  "updated",
  "deletion_requested",
  "deletion_rejected",
  "deleted",
  "restored",
] as const;

export const CONTRACT_LIFECYCLE_SOURCE_TYPES = [
  "contract",
  "delete_request",
  "restore_action",
] as const;

export type ContractLifecycleEventType =
  (typeof CONTRACT_LIFECYCLE_EVENT_TYPES)[number];
export type ContractLifecycleSourceType =
  (typeof CONTRACT_LIFECYCLE_SOURCE_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(CONTRACT_LIFECYCLE_EVENT_TYPES);
const SOURCE_TYPE_SET = new Set<string>(CONTRACT_LIFECYCLE_SOURCE_TYPES);
const METADATA_KEYS = new Set([
  "changedFields",
  "contractStatus",
  "paymentStatus",
  "requestStatus",
  "expectedImpact",
  "previousDeletedAt",
]);

type LifecycleMetadataValue = string | number | boolean | null | string[];
type LifecycleMetadata = Record<string, LifecycleMetadataValue>;

export type RecordContractLifecycleEventInput = {
  contractId: number;
  actorId: number;
  eventType: ContractLifecycleEventType;
  effectiveAt?: Date;
  reason?: string | null;
  sourceType: ContractLifecycleSourceType;
  sourceId?: number | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ContractLifecycleDb = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
};

function sanitizeMetadata(
  metadata?: Record<string, unknown> | null
): LifecycleMetadata | null {
  if (!metadata) return null;
  const safeEntries = Object.entries(metadata).filter(([key, value]) => {
    if (!METADATA_KEYS.has(key)) return false;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      return true;
    return Array.isArray(value) && value.every(item => typeof item === "string");
  });
  return safeEntries.length > 0
    ? (Object.fromEntries(safeEntries) as LifecycleMetadata)
    : null;
}

export async function recordContractLifecycleEvent(
  db: ContractLifecycleDb,
  input: RecordContractLifecycleEventInput
): Promise<ContractLifecycleEvent> {
  if (!Number.isInteger(input.contractId) || input.contractId <= 0)
    throw new Error("A valid contractId is required");
  if (!Number.isInteger(input.actorId) || input.actorId <= 0)
    throw new Error("A valid actorId is required");
  if (!EVENT_TYPE_SET.has(input.eventType))
    throw new Error("Unsupported contract lifecycle event type");
  if (!SOURCE_TYPE_SET.has(input.sourceType))
    throw new Error("Unsupported contract lifecycle source type");

  const contractRows = await db
    .select({
      id: contracts.id,
      customerId: contracts.customerId,
      monthlyPremium: contracts.monthlyPremium,
    })
    .from(contracts)
    .where(eq(contracts.id, input.contractId))
    .limit(1);
  const contract = contractRows[0];
  if (!contract) throw new Error("Contract not found for lifecycle event");

  const values = {
    contractId: contract.id,
    customerId: contract.customerId,
    eventType: input.eventType,
    effectiveAt: input.effectiveAt ?? new Date(),
    reason: input.reason?.trim() || null,
    monthlyPremiumSnapshot: contract.monthlyPremium ?? null,
    actorId: input.actorId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    metadata: sanitizeMetadata(input.metadata),
  };
  const result = await db.insert(contractLifecycleEvents).values(values);

  return {
    id: Number(result?.[0]?.insertId ?? 0),
    ...values,
    createdAt: new Date(),
  } as ContractLifecycleEvent;
}
