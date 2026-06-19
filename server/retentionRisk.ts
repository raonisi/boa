import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  CUSTOMER_SENTIMENTS,
  FINANCIAL_PRESSURE_LEVELS,
  RESOLUTION_RESULTS,
  RESPONSE_STRATEGIES,
  RETENTION_RISK_LEVELS,
  RETENTION_RISK_REASONS,
  RETENTION_STATUSES,
  assertRetentionRiskMemoSafe,
  mapResolutionToRetentionStatus,
} from "@shared/retentionRisk";
import { activeUserProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import { createActivityLog } from "./db";
import {
  assertRetentionRiskCaseAccessible,
  assertRetentionRiskCustomerAccessible,
  assertRetentionRiskMutable,
  buildRetentionRiskActivityMetadata,
  validateRetentionRiskLinks,
} from "./retentionRiskAccess";
import {
  createRetentionRiskCase,
  findActiveRetentionRiskCase,
  getRetentionRiskCaseById,
  getRetentionRiskSummary,
  listRetentionRiskCases,
  listRetentionRiskCasesByCustomerId,
  softDeleteRetentionRiskCase,
  updateRetentionRiskCase,
} from "./retentionRiskDb";

const riskReasonSchema = z.enum(RETENTION_RISK_REASONS);
const riskLevelSchema = z.enum(RETENTION_RISK_LEVELS);
const retentionStatusSchema = z.enum(RETENTION_STATUSES);
const responseStrategySchema = z.enum(RESPONSE_STRATEGIES);
const customerSentimentSchema = z.enum(CUSTOMER_SENTIMENTS);
const financialPressureSchema = z.enum(FINANCIAL_PRESSURE_LEVELS);
const resolutionResultSchema = z.enum(RESOLUTION_RESULTS);

const createInputSchema = z.object({
  customerId: z.number().int().positive(),
  contractId: z.number().int().positive().optional(),
  riskReason: riskReasonSchema,
  riskLevel: riskLevelSchema.default("medium"),
  retentionStatus: retentionStatusSchema.default("detected"),
  responseStrategy: responseStrategySchema.default("wait_and_followup"),
  customerSentiment: customerSentimentSchema.default("undecided"),
  financialPressureLevel: financialPressureSchema.optional(),
  competitorMentioned: z.boolean().default(false),
  followUpId: z.number().int().positive().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
  memo: z.string().max(500).optional(),
});

const updateInputSchema = z.object({
  id: z.number().int().positive(),
  contractId: z.number().int().positive().nullable().optional(),
  riskReason: riskReasonSchema.optional(),
  responseStrategy: responseStrategySchema.optional(),
  customerSentiment: customerSentimentSchema.optional(),
  financialPressureLevel: financialPressureSchema.nullable().optional(),
  competitorMentioned: z.boolean().optional(),
  followUpId: z.number().int().positive().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  memo: z.string().max(500).nullable().optional(),
});

async function logRetentionRiskActivity(
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

async function loadRetentionRiskOrThrow(id: number) {
  const existing = await getRetentionRiskCaseById(id);
  if (!existing || existing.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "해지위험 case를 찾을 수 없습니다.",
    });
  }
  return existing;
}

function memoError(error: unknown) {
  return new TRPCError({
    code: "BAD_REQUEST",
    message:
      error instanceof Error ? error.message : "해지위험 메모를 확인해 주세요.",
  });
}

export const retentionRiskRouter = router({
  list: activeUserProcedure
    .input(
      z
        .object({
          riskReason: riskReasonSchema.optional(),
          riskLevel: riskLevelSchema.optional(),
          retentionStatus: retentionStatusSchema.optional(),
          responseStrategy: responseStrategySchema.optional(),
          customerSentiment: customerSentimentSchema.optional(),
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) =>
      listRetentionRiskCases(ctx.user, input ?? {})
    ),

  listByCustomer: activeUserProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertRetentionRiskCustomerAccessible(ctx.user, input.customerId);
      return listRetentionRiskCasesByCustomerId(ctx.user, input.customerId);
    }),

  summary: activeUserProcedure.query(async ({ ctx }) =>
    getRetentionRiskSummary(ctx.user)
  ),

  create: activeUserProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertRetentionRiskMutable(ctx.user, input.customerId);
      await validateRetentionRiskLinks(
        ctx.user,
        input.customerId,
        input.contractId,
        input.followUpId
      );

      try {
        assertRetentionRiskMemoSafe(input.memo);
      } catch (error) {
        throw memoError(error);
      }

      const duplicate = await findActiveRetentionRiskCase(input.customerId);
      if (duplicate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "이미 진행 중인 해지위험 case가 있습니다. 기존 case를 종료한 뒤 추가하세요.",
        });
      }

      const created = await createRetentionRiskCase({
        customerId: input.customerId,
        contractId: input.contractId ?? null,
        riskReason: input.riskReason,
        riskLevel: input.riskLevel,
        retentionStatus: input.retentionStatus,
        responseStrategy: input.responseStrategy,
        customerSentiment: input.customerSentiment,
        financialPressureLevel: input.financialPressureLevel ?? null,
        competitorMentioned: input.competitorMentioned,
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
          message: "해지위험 case 생성에 실패했습니다.",
        });
      }

      await logRetentionRiskActivity(
        ctx.user.id,
        "RETENTION_RISK_CREATED",
        input.customerId,
        buildRetentionRiskActivityMetadata(created)
      );

      return { id: created.id };
    }),

  update: activeUserProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await loadRetentionRiskOrThrow(input.id);
      await assertRetentionRiskCaseAccessible(ctx.user, existing);
      await assertRetentionRiskMutable(ctx.user, existing.customerId);

      const contractId =
        input.contractId === undefined ? undefined : input.contractId;
      const followUpId =
        input.followUpId === undefined ? undefined : input.followUpId;
      await validateRetentionRiskLinks(
        ctx.user,
        existing.customerId,
        contractId,
        followUpId
      );

      if (input.memo !== undefined) {
        try {
          assertRetentionRiskMemoSafe(input.memo ?? undefined);
        } catch (error) {
          throw memoError(error);
        }
      }

      const updated = await updateRetentionRiskCase(input.id, {
        contractId: input.contractId,
        riskReason: input.riskReason,
        responseStrategy: input.responseStrategy,
        customerSentiment: input.customerSentiment,
        financialPressureLevel: input.financialPressureLevel,
        competitorMentioned: input.competitorMentioned,
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
          message: "해지위험 case 수정에 실패했습니다.",
        });
      }

      await logRetentionRiskActivity(
        ctx.user.id,
        "RETENTION_RISK_UPDATED",
        existing.customerId,
        buildRetentionRiskActivityMetadata(updated)
      );

      return { success: true };
    }),

  changeRiskLevel: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        riskLevel: riskLevelSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadRetentionRiskOrThrow(input.id);
      await assertRetentionRiskCaseAccessible(ctx.user, existing);
      await assertRetentionRiskMutable(ctx.user, existing.customerId);

      const updated = await updateRetentionRiskCase(input.id, {
        riskLevel: input.riskLevel,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "위험 단계 변경에 실패했습니다.",
        });
      }

      await logRetentionRiskActivity(
        ctx.user.id,
        "RETENTION_RISK_LEVEL_CHANGED",
        existing.customerId,
        buildRetentionRiskActivityMetadata(updated, {
          previousRiskLevel: existing.riskLevel,
          nextRiskLevel: input.riskLevel,
        })
      );

      return { success: true };
    }),

  changeRetentionStatus: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        retentionStatus: retentionStatusSchema,
        responseStrategy: responseStrategySchema.optional(),
        customerSentiment: customerSentimentSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadRetentionRiskOrThrow(input.id);
      await assertRetentionRiskCaseAccessible(ctx.user, existing);
      await assertRetentionRiskMutable(ctx.user, existing.customerId);

      const updated = await updateRetentionRiskCase(input.id, {
        retentionStatus: input.retentionStatus,
        responseStrategy: input.responseStrategy,
        customerSentiment: input.customerSentiment,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "대응 상태 변경에 실패했습니다.",
        });
      }

      await logRetentionRiskActivity(
        ctx.user.id,
        "RETENTION_RISK_STATUS_CHANGED",
        existing.customerId,
        buildRetentionRiskActivityMetadata(updated, {
          previousRetentionStatus: existing.retentionStatus,
          nextRetentionStatus: input.retentionStatus,
        })
      );

      return { success: true };
    }),

  resolve: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        resolutionResult: resolutionResultSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await loadRetentionRiskOrThrow(input.id);
      await assertRetentionRiskCaseAccessible(ctx.user, existing);
      await assertRetentionRiskMutable(ctx.user, existing.customerId);

      const mappedStatus = mapResolutionToRetentionStatus(input.resolutionResult);
      const updated = await updateRetentionRiskCase(input.id, {
        resolutionResult: input.resolutionResult,
        resolvedAt: new Date(),
        retentionStatus: mappedStatus ?? existing.retentionStatus,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "해지위험 종료 처리에 실패했습니다.",
        });
      }

      await logRetentionRiskActivity(
        ctx.user.id,
        "RETENTION_RISK_RESOLVED",
        existing.customerId,
        buildRetentionRiskActivityMetadata(updated)
      );

      return { success: true };
    }),

  delete: activeUserProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await loadRetentionRiskOrThrow(input.id);
      await assertRetentionRiskCaseAccessible(ctx.user, existing);
      await assertRetentionRiskMutable(ctx.user, existing.customerId);

      const deleted = await softDeleteRetentionRiskCase(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "해지위험 case 삭제에 실패했습니다.",
        });
      }

      await logRetentionRiskActivity(
        ctx.user.id,
        "RETENTION_RISK_DELETED",
        existing.customerId,
        buildRetentionRiskActivityMetadata(deleted)
      );

      return { success: true };
    }),
});
