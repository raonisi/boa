import { TRPCError } from "@trpc/server";
import type { RetentionRiskCase } from "../drizzle/schema";
import {
  assertCustomerAccessible,
  type CustomerRelationshipUser,
} from "./customerRelationshipsAccess";
import {
  assertContractBelongsToCustomer,
  assertFollowUpBelongsToCustomer,
} from "./claimGuidanceAccess";

export type { CustomerRelationshipUser };

export async function assertRetentionRiskCustomerAccessible(
  user: CustomerRelationshipUser,
  customerId: number
) {
  return assertCustomerAccessible(user, customerId);
}

export async function assertRetentionRiskMutable(
  user: CustomerRelationshipUser,
  customerId: number
) {
  await assertRetentionRiskCustomerAccessible(user, customerId);
}

export async function assertRetentionRiskCaseAccessible(
  user: CustomerRelationshipUser,
  riskCase: Pick<RetentionRiskCase, "customerId" | "deletedAt">
) {
  if (riskCase.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "해지위험 case를 찾을 수 없습니다.",
    });
  }
  await assertRetentionRiskCustomerAccessible(user, riskCase.customerId);
}

export async function validateRetentionRiskLinks(
  user: CustomerRelationshipUser,
  customerId: number,
  contractId?: number | null,
  followUpId?: number | null
) {
  if (contractId) {
    await assertContractBelongsToCustomer(user, contractId, customerId);
  }
  if (followUpId) {
    await assertFollowUpBelongsToCustomer(user, followUpId, customerId);
  }
}

export function buildRetentionRiskActivityMetadata(
  riskCase: Pick<
    RetentionRiskCase,
    | "id"
    | "customerId"
    | "contractId"
    | "riskReason"
    | "riskLevel"
    | "retentionStatus"
    | "responseStrategy"
    | "customerSentiment"
    | "resolutionResult"
    | "followUpId"
  >,
  extra?: Record<string, unknown>
) {
  return {
    retentionRiskCaseId: riskCase.id,
    customerId: riskCase.customerId,
    contractId: riskCase.contractId ?? null,
    riskReason: riskCase.riskReason,
    riskLevel: riskCase.riskLevel,
    retentionStatus: riskCase.retentionStatus,
    responseStrategy: riskCase.responseStrategy,
    customerSentiment: riskCase.customerSentiment,
    resolutionResult: riskCase.resolutionResult ?? null,
    followUpId: riskCase.followUpId ?? null,
    ...extra,
  };
}
