import { TRPCError } from "@trpc/server";
import type { ClaimGuidanceCase } from "../drizzle/schema";
import {
  assertCustomerAccessible,
  type CustomerRelationshipUser,
} from "./customerRelationshipsAccess";
import { getContractById, getFollowUpById } from "./db";

export type { CustomerRelationshipUser };

export async function assertClaimGuidanceCustomerAccessible(
  user: CustomerRelationshipUser,
  customerId: number
) {
  return assertCustomerAccessible(user, customerId);
}

export async function assertClaimGuidanceMutable(
  user: CustomerRelationshipUser,
  customerId: number
) {
  await assertClaimGuidanceCustomerAccessible(user, customerId);
}

export async function assertClaimGuidanceCaseAccessible(
  user: CustomerRelationshipUser,
  claimCase: Pick<ClaimGuidanceCase, "customerId" | "deletedAt">
) {
  if (claimCase.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "청구 안내를 찾을 수 없습니다.",
    });
  }
  await assertClaimGuidanceCustomerAccessible(user, claimCase.customerId);
}

export async function assertContractBelongsToCustomer(
  user: CustomerRelationshipUser,
  contractId: number,
  customerId: number
) {
  const contract = await getContractById(contractId);
  if (!contract || contract.deletedAt || contract.isActive === false) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "계약을 찾을 수 없습니다.",
    });
  }
  if (contract.customerId !== customerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "계약이 해당 고객과 일치하지 않습니다.",
    });
  }
  await assertClaimGuidanceCustomerAccessible(user, contract.customerId);
}

export async function assertFollowUpBelongsToCustomer(
  user: CustomerRelationshipUser,
  followUpId: number,
  customerId: number
) {
  const followUp = await getFollowUpById(followUpId);
  if (!followUp || followUp.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "후속관리를 찾을 수 없습니다.",
    });
  }
  if (followUp.customerId !== customerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "후속관리가 해당 고객과 일치하지 않습니다.",
    });
  }
  await assertClaimGuidanceCustomerAccessible(user, followUp.customerId);
}

export function buildClaimGuidanceActivityMetadata(
  claimCase: Pick<
    ClaimGuidanceCase,
    | "id"
    | "customerId"
    | "contractId"
    | "guidanceType"
    | "guidanceStatus"
    | "documentGuideStatus"
    | "customerActionStatus"
    | "closedReason"
    | "followUpId"
  >,
  extra?: Record<string, unknown>
) {
  return {
    claimGuidanceCaseId: claimCase.id,
    customerId: claimCase.customerId,
    contractId: claimCase.contractId ?? null,
    guidanceType: claimCase.guidanceType,
    guidanceStatus: claimCase.guidanceStatus,
    documentGuideStatus: claimCase.documentGuideStatus,
    customerActionStatus: claimCase.customerActionStatus,
    closedReason: claimCase.closedReason ?? null,
    followUpId: claimCase.followUpId ?? null,
    ...extra,
  };
}
