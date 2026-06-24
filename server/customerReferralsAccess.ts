import { TRPCError } from "@trpc/server";
import type { Customer, CustomerRelationship } from "../drizzle/schema";
import {
  REFERRAL_ELIGIBLE_RELATIONSHIP_TYPES,
  type ReferralEligibleRelationshipType,
} from "@shared/customerReferrals";
import {
  assertBothCustomersAccessible,
  assertCustomerAccessible,
  type CustomerRelationshipUser,
} from "./customerRelationshipsAccess";
import { getCustomerById } from "./db";
import { getCustomerRelationshipById } from "./customerRelationshipsDb";

export type { CustomerRelationshipUser };

export async function assertReferralRelationshipAccessible(
  user: CustomerRelationshipUser,
  relationshipId: number
): Promise<CustomerRelationship> {
  const relationship = await getCustomerRelationshipById(relationshipId);
  if (
    !relationship ||
    relationship.deletedAt ||
    relationship.status !== "active"
  ) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "고객 관계를 찾을 수 없습니다.",
    });
  }

  await assertBothCustomersAccessible(
    user,
    relationship.primaryCustomerId,
    relationship.relatedCustomerId
  );

  if (
    !REFERRAL_ELIGIBLE_RELATIONSHIP_TYPES.includes(
      relationship.relationshipType as ReferralEligibleRelationshipType
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "소개 흐름으로 연결할 수 없는 관계 유형입니다.",
    });
  }

  return relationship;
}

export function assertReferrerReferredPair(
  referrerCustomerId: number,
  referredCustomerId: number
) {
  if (referrerCustomerId === referredCustomerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "소개자와 피소개자는 동일할 수 없습니다.",
    });
  }
}

export function assertReferrerReferredMatchRelationship(
  relationship: CustomerRelationship,
  referrerCustomerId: number,
  referredCustomerId: number
) {
  assertReferrerReferredPair(referrerCustomerId, referredCustomerId);

  const pair = new Set([
    relationship.primaryCustomerId,
    relationship.relatedCustomerId,
  ]);
  if (
    !pair.has(referrerCustomerId) ||
    !pair.has(referredCustomerId) ||
    pair.size !== 2
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "relationshipId와 소개자/피소개자 고객이 일치하지 않습니다.",
    });
  }

  if (relationship.relationshipType !== "referral") return;

  if (relationship.direction === "outbound") {
    if (
      relationship.primaryCustomerId !== referrerCustomerId ||
      relationship.relatedCustomerId !== referredCustomerId
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "소개 관계 방향과 소개자/피소개자가 일치하지 않습니다.",
      });
    }
  } else if (relationship.direction === "inbound") {
    if (
      relationship.primaryCustomerId !== referredCustomerId ||
      relationship.relatedCustomerId !== referrerCustomerId
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "소개 관계 방향과 소개자/피소개자가 일치하지 않습니다.",
      });
    }
  }
}

export async function assertReferralFlowAccessible(
  user: CustomerRelationshipUser,
  referrerCustomerId: number,
  referredCustomerId: number
) {
  assertReferrerReferredPair(referrerCustomerId, referredCustomerId);
  await assertBothCustomersAccessible(
    user,
    referrerCustomerId,
    referredCustomerId
  );

  if (user.role !== "member") return;

  const [referrer, referred] = await Promise.all([
    getCustomerById(referrerCustomerId),
    getCustomerById(referredCustomerId),
  ]);
  const ownsReferrer = referrer?.agentId === user.id;
  const ownsReferred = referred?.agentId === user.id;
  if (!ownsReferrer && !ownsReferred) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 담당 고객과 연결된 소개 흐름만 조회할 수 있습니다.",
    });
  }
}

export async function assertReferralFlowMutable(
  user: CustomerRelationshipUser,
  anchorCustomerId: number,
  referrerCustomerId: number,
  referredCustomerId: number
) {
  await assertReferralFlowAccessible(
    user,
    referrerCustomerId,
    referredCustomerId
  );

  if (
    anchorCustomerId !== referrerCustomerId &&
    anchorCustomerId !== referredCustomerId
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "소개자 또는 피소개자 고객 기준으로만 관리할 수 있습니다.",
    });
  }

  if (user.role !== "member") return;

  const anchorCustomer = await assertCustomerAccessible(user, anchorCustomerId);
  canMutateReferralForMember(user, anchorCustomerId, anchorCustomer);
}

function canMutateReferralForMember(
  user: CustomerRelationshipUser,
  anchorCustomerId: number,
  anchorCustomer: Customer
) {
  if (anchorCustomer.agentId !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 담당 고객 기준으로만 소개 흐름을 관리할 수 있습니다.",
    });
  }
  if (anchorCustomerId !== anchorCustomer.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 담당 고객 기준으로만 소개 흐름을 관리할 수 있습니다.",
    });
  }
}

export function buildReferralActivityMetadata(
  referral: Pick<
    import("../drizzle/schema").CustomerReferral,
    | "id"
    | "relationshipId"
    | "referralStage"
    | "referralSourceType"
    | "thankYouStatus"
    | "resultStatus"
  >,
  extra?: Record<string, unknown>
) {
  return {
    referralId: referral.id,
    relationshipId: referral.relationshipId,
    referralStage: referral.referralStage,
    referralSourceType: referral.referralSourceType,
    thankYouStatus: referral.thankYouStatus,
    resultStatus: referral.resultStatus,
    ...extra,
  };
}
