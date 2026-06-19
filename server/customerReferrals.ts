import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  INTRODUCTION_METHODS,
  REFERRAL_RESULT_STATUSES,
  REFERRAL_SOURCE_TYPES,
  REFERRAL_STAGES,
  THANK_YOU_STATUSES,
  assertReferralMemoSafe,
  defaultResultStatusForStage,
} from "@shared/customerReferrals";
import { activeUserProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import { createActivityLog } from "./db";
import {
  assertReferralFlowMutable,
  assertReferralRelationshipAccessible,
  assertReferrerReferredMatchRelationship,
  assertReferrerReferredPair,
  buildReferralActivityMetadata,
} from "./customerReferralsAccess";
import {
  buildStageUpdatePayload,
  createCustomerReferral,
  findActiveReferralDuplicate,
  getCustomerReferralById,
  getReferralPerformanceSummary,
  listCustomerReferrals,
  listCustomerReferralsByCustomerId,
  searchCustomersForReferral,
  softDeleteCustomerReferral,
  updateCustomerReferral,
} from "./customerReferralsDb";

const referralStageSchema = z.enum(REFERRAL_STAGES);
const referralSourceTypeSchema = z.enum(REFERRAL_SOURCE_TYPES);
const introductionMethodSchema = z.enum(INTRODUCTION_METHODS);
const thankYouStatusSchema = z.enum(THANK_YOU_STATUSES);
const resultStatusSchema = z.enum(REFERRAL_RESULT_STATUSES);

const createInputSchema = z.object({
  relationshipId: z.number().int().positive(),
  referrerCustomerId: z.number().int().positive(),
  referredCustomerId: z.number().int().positive(),
  anchorCustomerId: z.number().int().positive(),
  referralSourceType: referralSourceTypeSchema,
  introductionMethod: introductionMethodSchema.optional(),
  referralStage: referralStageSchema.default("introduced"),
  thankYouStatus: thankYouStatusSchema.default("pending"),
  memo: z.string().max(500).optional(),
});

const updateInputSchema = z.object({
  id: z.number().int().positive(),
  anchorCustomerId: z.number().int().positive(),
  referralSourceType: referralSourceTypeSchema.optional(),
  introductionMethod: introductionMethodSchema.nullable().optional(),
  thankYouStatus: thankYouStatusSchema.optional(),
  resultStatus: resultStatusSchema.optional(),
  memo: z.string().max(500).nullable().optional(),
  deferredUntil: z.string().datetime().nullable().optional(),
});

async function logReferralActivity(
  userId: number,
  action: string,
  anchorCustomerId: number,
  metadata: Record<string, unknown>
) {
  await createActivityLog({
    userId,
    action,
    targetType: "customer",
    targetId: anchorCustomerId,
    details: JSON.stringify({
      actor: userId,
      targetType: "customer",
      targetId: anchorCustomerId,
      metadata,
    }),
  });
}

async function loadReferralOrThrow(id: number) {
  const existing = await getCustomerReferralById(id);
  if (!existing || existing.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "소개 흐름을 찾을 수 없습니다.",
    });
  }
  return existing;
}

export const customerReferralsRouter = router({
  list: activeUserProcedure
    .input(
      z
        .object({
          referralStage: referralStageSchema.optional(),
          resultStatus: resultStatusSchema.optional(),
          thankYouStatus: thankYouStatusSchema.optional(),
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) =>
      listCustomerReferrals(ctx.user, input ?? {})
    ),

  listByCustomer: activeUserProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { assertCustomerAccessible } = await import(
        "./customerRelationshipsAccess"
      );
      await assertCustomerAccessible(ctx.user, input.customerId);
      return listCustomerReferralsByCustomerId(ctx.user, input.customerId);
    }),

  summary: activeUserProcedure.query(async ({ ctx }) =>
    getReferralPerformanceSummary(ctx.user)
  ),

  searchCustomers: activeUserProcedure
    .input(
      z.object({
        anchorCustomerId: z.number().int().positive(),
        search: z.string().max(100),
        limit: z.number().int().min(1).max(20).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { assertCustomerAccessible } = await import(
        "./customerRelationshipsAccess"
      );
      await assertCustomerAccessible(ctx.user, input.anchorCustomerId);
      return searchCustomersForReferral(
        ctx.user,
        input.search,
        input.limit,
        input.anchorCustomerId
      );
    }),

  create: activeUserProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertReferrerReferredPair(
        input.referrerCustomerId,
        input.referredCustomerId
      );

      const relationship = await assertReferralRelationshipAccessible(
        ctx.user,
        input.relationshipId
      );
      assertReferrerReferredMatchRelationship(
        relationship,
        input.referrerCustomerId,
        input.referredCustomerId
      );
      await assertReferralFlowMutable(
        ctx.user,
        input.anchorCustomerId,
        input.referrerCustomerId,
        input.referredCustomerId
      );

      try {
        assertReferralMemoSafe(input.memo);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "소개 메모를 확인해 주세요.",
        });
      }

      const duplicate = await findActiveReferralDuplicate(
        input.relationshipId,
        input.referrerCustomerId,
        input.referredCustomerId
      );
      if (duplicate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "동일한 소개 흐름이 이미 등록되어 있습니다.",
        });
      }

      const created = await createCustomerReferral({
        relationshipId: input.relationshipId,
        referrerCustomerId: input.referrerCustomerId,
        referredCustomerId: input.referredCustomerId,
        referralStage: input.referralStage,
        referralSourceType: input.referralSourceType,
        introductionMethod: input.introductionMethod ?? null,
        thankYouStatus: input.thankYouStatus,
        resultStatus: defaultResultStatusForStage(input.referralStage),
        memo: input.memo?.trim() || null,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "소개 흐름 생성에 실패했습니다.",
        });
      }

      await logReferralActivity(
        ctx.user.id,
        "REFERRAL_CREATED",
        input.anchorCustomerId,
        buildReferralActivityMetadata(created)
      );

      return { id: created.id };
    }),

  update: activeUserProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await loadReferralOrThrow(input.id);
      await assertReferralFlowMutable(
        ctx.user,
        input.anchorCustomerId,
        existing.referrerCustomerId,
        existing.referredCustomerId
      );

      if (input.memo !== undefined) {
        try {
          assertReferralMemoSafe(input.memo ?? undefined);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error ? error.message : "소개 메모를 확인해 주세요.",
          });
        }
      }

      const updated = await updateCustomerReferral(input.id, {
        referralSourceType: input.referralSourceType,
        introductionMethod:
          input.introductionMethod === undefined
            ? undefined
            : input.introductionMethod,
        thankYouStatus: input.thankYouStatus,
        resultStatus: input.resultStatus,
        memo:
          input.memo === undefined
            ? undefined
            : input.memo?.trim()
              ? input.memo.trim()
              : null,
        deferredUntil:
          input.deferredUntil === undefined
            ? undefined
            : input.deferredUntil
              ? new Date(input.deferredUntil)
              : null,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "소개 흐름 수정에 실패했습니다.",
        });
      }

      await logReferralActivity(
        ctx.user.id,
        "REFERRAL_UPDATED",
        input.anchorCustomerId,
        buildReferralActivityMetadata(updated)
      );

      return { success: true };
    }),

  changeStage: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        anchorCustomerId: z.number().int().positive(),
        referralStage: referralStageSchema,
        deferredUntil: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadReferralOrThrow(input.id);
      await assertReferralFlowMutable(
        ctx.user,
        input.anchorCustomerId,
        existing.referrerCustomerId,
        existing.referredCustomerId
      );

      const stagePayload = buildStageUpdatePayload(
        input.referralStage,
        existing,
        input.deferredUntil ? new Date(input.deferredUntil) : undefined
      );

      const updated = await updateCustomerReferral(input.id, {
        ...stagePayload,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "소개 단계 변경에 실패했습니다.",
        });
      }

      await logReferralActivity(
        ctx.user.id,
        "REFERRAL_STAGE_CHANGED",
        input.anchorCustomerId,
        buildReferralActivityMetadata(updated, {
          previousStage: existing.referralStage,
          nextStage: input.referralStage,
        })
      );

      return { success: true };
    }),

  completeThankYou: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        anchorCustomerId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadReferralOrThrow(input.id);
      await assertReferralFlowMutable(
        ctx.user,
        input.anchorCustomerId,
        existing.referrerCustomerId,
        existing.referredCustomerId
      );

      const updated = await updateCustomerReferral(input.id, {
        thankYouStatus: "completed",
        thankYouCompletedAt: new Date(),
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "감사 연락 완료 처리에 실패했습니다.",
        });
      }

      await logReferralActivity(
        ctx.user.id,
        "REFERRAL_THANK_YOU_COMPLETED",
        input.anchorCustomerId,
        buildReferralActivityMetadata(updated)
      );

      return { success: true };
    }),

  delete: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        anchorCustomerId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadReferralOrThrow(input.id);
      await assertReferralFlowMutable(
        ctx.user,
        input.anchorCustomerId,
        existing.referrerCustomerId,
        existing.referredCustomerId
      );

      const deleted = await softDeleteCustomerReferral(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "소개 흐름 삭제에 실패했습니다.",
        });
      }

      await logReferralActivity(
        ctx.user.id,
        "REFERRAL_DELETED",
        input.anchorCustomerId,
        buildReferralActivityMetadata(deleted)
      );

      return { success: true };
    }),
});
