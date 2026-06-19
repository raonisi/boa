import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  CLAIM_CUSTOMER_ACTION_STATUSES,
  CLAIM_DOCUMENT_GUIDE_STATUSES,
  CLAIM_GUIDANCE_CLOSED_REASONS,
  CLAIM_GUIDANCE_STATUSES,
  CLAIM_GUIDANCE_TYPES,
  assertClaimGuidanceMemoSafe,
} from "@shared/claimGuidance";
import { activeUserProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import { createActivityLog } from "./db";
import {
  assertClaimGuidanceCaseAccessible,
  assertClaimGuidanceCustomerAccessible,
  assertClaimGuidanceMutable,
  assertContractBelongsToCustomer,
  assertFollowUpBelongsToCustomer,
  buildClaimGuidanceActivityMetadata,
} from "./claimGuidanceAccess";
import {
  createClaimGuidanceCase,
  getClaimGuidanceCaseById,
  getClaimGuidanceSummary,
  listClaimGuidanceCases,
  listClaimGuidanceCasesByCustomerId,
  softDeleteClaimGuidanceCase,
  updateClaimGuidanceCase,
} from "./claimGuidanceDb";

const guidanceTypeSchema = z.enum(CLAIM_GUIDANCE_TYPES);
const guidanceStatusSchema = z.enum(CLAIM_GUIDANCE_STATUSES);
const documentGuideStatusSchema = z.enum(CLAIM_DOCUMENT_GUIDE_STATUSES);
const customerActionStatusSchema = z.enum(CLAIM_CUSTOMER_ACTION_STATUSES);
const closedReasonSchema = z.enum(CLAIM_GUIDANCE_CLOSED_REASONS);

const createInputSchema = z.object({
  customerId: z.number().int().positive(),
  contractId: z.number().int().positive().optional(),
  guidanceType: guidanceTypeSchema,
  guidanceStatus: guidanceStatusSchema.default("guidance_needed"),
  documentGuideStatus: documentGuideStatusSchema.default("not_started"),
  customerActionStatus: customerActionStatusSchema.default("no_action"),
  followUpId: z.number().int().positive().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
  memo: z.string().max(500).optional(),
});

const updateInputSchema = z.object({
  id: z.number().int().positive(),
  contractId: z.number().int().positive().nullable().optional(),
  guidanceType: guidanceTypeSchema.optional(),
  documentGuideStatus: documentGuideStatusSchema.optional(),
  customerActionStatus: customerActionStatusSchema.optional(),
  followUpId: z.number().int().positive().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  memo: z.string().max(500).nullable().optional(),
});

async function logClaimGuidanceActivity(
  userId: number,
  action: string,
  customerId: number,
  metadata: Record<string, unknown>
) {
  await createActivityLog({
    userId,
    action,
    targetType: "customer",
    targetId: customerId,
    details: JSON.stringify({
      actor: userId,
      targetType: "customer",
      targetId: customerId,
      metadata,
    }),
  });
}

async function loadClaimGuidanceOrThrow(id: number) {
  const existing = await getClaimGuidanceCaseById(id);
  if (!existing || existing.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "청구 안내를 찾을 수 없습니다.",
    });
  }
  return existing;
}

async function validateOptionalLinks(
  user: Parameters<typeof assertClaimGuidanceMutable>[0],
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

function memoError(error: unknown) {
  return new TRPCError({
    code: "BAD_REQUEST",
    message:
      error instanceof Error ? error.message : "청구 안내 메모를 확인해 주세요.",
  });
}

export const claimGuidanceRouter = router({
  list: activeUserProcedure
    .input(
      z
        .object({
          guidanceType: guidanceTypeSchema.optional(),
          guidanceStatus: guidanceStatusSchema.optional(),
          documentGuideStatus: documentGuideStatusSchema.optional(),
          customerActionStatus: customerActionStatusSchema.optional(),
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) =>
      listClaimGuidanceCases(ctx.user, input ?? {})
    ),

  listByCustomer: activeUserProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertClaimGuidanceCustomerAccessible(ctx.user, input.customerId);
      return listClaimGuidanceCasesByCustomerId(ctx.user, input.customerId);
    }),

  summary: activeUserProcedure.query(async ({ ctx }) =>
    getClaimGuidanceSummary(ctx.user)
  ),

  create: activeUserProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertClaimGuidanceMutable(ctx.user, input.customerId);
      await validateOptionalLinks(
        ctx.user,
        input.customerId,
        input.contractId,
        input.followUpId
      );

      try {
        assertClaimGuidanceMemoSafe(input.memo);
      } catch (error) {
        throw memoError(error);
      }

      const created = await createClaimGuidanceCase({
        customerId: input.customerId,
        contractId: input.contractId ?? null,
        guidanceType: input.guidanceType,
        guidanceStatus: input.guidanceStatus,
        documentGuideStatus: input.documentGuideStatus,
        customerActionStatus: input.customerActionStatus,
        followUpId: input.followUpId ?? null,
        nextFollowUpAt: input.nextFollowUpAt
          ? new Date(input.nextFollowUpAt)
          : null,
        memo: input.memo?.trim() || null,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "청구 안내 생성에 실패했습니다.",
        });
      }

      await logClaimGuidanceActivity(
        ctx.user.id,
        "CLAIM_GUIDANCE_CREATED",
        input.customerId,
        buildClaimGuidanceActivityMetadata(created)
      );

      return { id: created.id };
    }),

  update: activeUserProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await loadClaimGuidanceOrThrow(input.id);
      await assertClaimGuidanceCaseAccessible(ctx.user, existing);
      await assertClaimGuidanceMutable(ctx.user, existing.customerId);

      const contractId =
        input.contractId === undefined ? undefined : input.contractId;
      const followUpId =
        input.followUpId === undefined ? undefined : input.followUpId;
      await validateOptionalLinks(
        ctx.user,
        existing.customerId,
        contractId,
        followUpId
      );

      if (input.memo !== undefined) {
        try {
          assertClaimGuidanceMemoSafe(input.memo ?? undefined);
        } catch (error) {
          throw memoError(error);
        }
      }

      const updated = await updateClaimGuidanceCase(input.id, {
        contractId: input.contractId,
        guidanceType: input.guidanceType,
        documentGuideStatus: input.documentGuideStatus,
        customerActionStatus: input.customerActionStatus,
        followUpId: input.followUpId,
        nextFollowUpAt:
          input.nextFollowUpAt === undefined
            ? undefined
            : input.nextFollowUpAt
              ? new Date(input.nextFollowUpAt)
              : null,
        memo:
          input.memo === undefined
            ? undefined
            : input.memo?.trim()
              ? input.memo.trim()
              : null,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "청구 안내 수정에 실패했습니다.",
        });
      }

      await logClaimGuidanceActivity(
        ctx.user.id,
        "CLAIM_GUIDANCE_UPDATED",
        existing.customerId,
        buildClaimGuidanceActivityMetadata(updated)
      );

      return { success: true };
    }),

  changeStatus: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        guidanceStatus: guidanceStatusSchema,
        documentGuideStatus: documentGuideStatusSchema.optional(),
        customerActionStatus: customerActionStatusSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadClaimGuidanceOrThrow(input.id);
      await assertClaimGuidanceCaseAccessible(ctx.user, existing);
      await assertClaimGuidanceMutable(ctx.user, existing.customerId);

      const updated = await updateClaimGuidanceCase(input.id, {
        guidanceStatus: input.guidanceStatus,
        documentGuideStatus: input.documentGuideStatus,
        customerActionStatus: input.customerActionStatus,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "청구 안내 상태 변경에 실패했습니다.",
        });
      }

      await logClaimGuidanceActivity(
        ctx.user.id,
        "CLAIM_GUIDANCE_STATUS_CHANGED",
        existing.customerId,
        buildClaimGuidanceActivityMetadata(updated, {
          previousGuidanceStatus: existing.guidanceStatus,
          nextGuidanceStatus: input.guidanceStatus,
        })
      );

      return { success: true };
    }),

  close: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        closedReason: closedReasonSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadClaimGuidanceOrThrow(input.id);
      await assertClaimGuidanceCaseAccessible(ctx.user, existing);
      await assertClaimGuidanceMutable(ctx.user, existing.customerId);

      const updated = await updateClaimGuidanceCase(input.id, {
        guidanceStatus: "closed",
        closedAt: new Date(),
        closedReason: input.closedReason,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "청구 안내 종료 처리에 실패했습니다.",
        });
      }

      await logClaimGuidanceActivity(
        ctx.user.id,
        "CLAIM_GUIDANCE_CLOSED",
        existing.customerId,
        buildClaimGuidanceActivityMetadata(updated)
      );

      return { success: true };
    }),

  delete: activeUserProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await loadClaimGuidanceOrThrow(input.id);
      await assertClaimGuidanceCaseAccessible(ctx.user, existing);
      await assertClaimGuidanceMutable(ctx.user, existing.customerId);

      const deleted = await softDeleteClaimGuidanceCase(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "청구 안내 삭제에 실패했습니다.",
        });
      }

      await logClaimGuidanceActivity(
        ctx.user.id,
        "CLAIM_GUIDANCE_DELETED",
        existing.customerId,
        buildClaimGuidanceActivityMetadata(deleted)
      );

      return { success: true };
    }),
});
