import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  CUSTOMER_RELATIONSHIP_DIRECTIONS,
  CUSTOMER_RELATIONSHIP_STATUSES,
  CUSTOMER_RELATIONSHIP_TYPES,
  assertRelationshipNoteSafe,
  resolveDefaultDirection,
  resolveRelationshipLabel,
  type CustomerRelationshipType,
} from "@shared/customerRelationships";
import { activeUserProcedure } from "./_core/procedures";
import { router } from "./_core/trpc";
import { createActivityLog } from "./db";
import {
  assertBothCustomersAccessible,
  assertCustomerAccessible,
  canMutateRelationshipForMember,
  filterCustomerIdsInScope,
} from "./customerRelationshipsAccess";
import {
  buildRelationshipActivityMetadata,
  createCustomerRelationship,
  findActiveRelationshipDuplicate,
  getCustomerRelationFlags,
  getCustomerRelationshipById,
  listCustomerRelationships,
  searchCustomersForRelationship,
  softDeleteCustomerRelationship,
  updateCustomerRelationship,
} from "./customerRelationshipsDb";

const relationshipTypeSchema = z.enum(CUSTOMER_RELATIONSHIP_TYPES);
const relationshipDirectionSchema = z.enum(CUSTOMER_RELATIONSHIP_DIRECTIONS);
const relationshipStatusSchema = z.enum(CUSTOMER_RELATIONSHIP_STATUSES);

const createInputSchema = z.object({
  customerId: z.number().int().positive(),
  relatedCustomerId: z.number().int().positive(),
  relationshipType: relationshipTypeSchema,
  direction: relationshipDirectionSchema.optional(),
  note: z.string().max(500).optional(),
  status: relationshipStatusSchema.default("active"),
});

const updateInputSchema = z.object({
  id: z.number().int().positive(),
  customerId: z.number().int().positive(),
  relationshipType: relationshipTypeSchema.optional(),
  direction: relationshipDirectionSchema.optional(),
  note: z.string().max(500).nullable().optional(),
  status: relationshipStatusSchema.optional(),
});

async function logRelationshipActivity(
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

export const customerRelationshipsRouter = router({
  list: activeUserProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertCustomerAccessible(ctx.user, input.customerId);
      return listCustomerRelationships(input.customerId);
    }),

  relationFlags: activeUserProcedure
    .input(
      z.object({
        customerIds: z.array(z.number().int().positive()).max(200),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.customerIds.length === 0) return {};
      const scopedIds = await filterCustomerIdsInScope(
        ctx.user,
        input.customerIds
      );
      return getCustomerRelationFlags(scopedIds);
    }),

  searchCustomers: activeUserProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        search: z.string().max(100),
        limit: z.number().int().min(1).max(20).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertCustomerAccessible(ctx.user, input.customerId);
      return searchCustomersForRelationship(
        ctx.user,
        input.search,
        input.limit,
        input.customerId
      );
    }),

  create: activeUserProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.customerId === input.relatedCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "동일 고객끼리는 관계를 연결할 수 없습니다.",
        });
      }

      const anchorCustomer = await assertCustomerAccessible(
        ctx.user,
        input.customerId
      );
      await assertBothCustomersAccessible(
        ctx.user,
        input.customerId,
        input.relatedCustomerId
      );
      canMutateRelationshipForMember(ctx.user, input.customerId, anchorCustomer);

      try {
        assertRelationshipNoteSafe(input.note);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "관계 메모를 확인해 주세요.",
        });
      }

      const duplicate = await findActiveRelationshipDuplicate(
        input.customerId,
        input.relatedCustomerId,
        input.relationshipType
      );
      if (duplicate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "동일한 고객 관계가 이미 등록되어 있습니다.",
        });
      }

      const direction =
        input.direction ?? resolveDefaultDirection(input.relationshipType);
      const relationshipLabel = resolveRelationshipLabel(
        input.relationshipType,
        direction
      );

      const created = await createCustomerRelationship({
        primaryCustomerId: input.customerId,
        relatedCustomerId: input.relatedCustomerId,
        relationshipType: input.relationshipType,
        relationshipLabel,
        direction,
        note: input.note?.trim() || null,
        status: input.status,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "관계 생성에 실패했습니다.",
        });
      }

      await logRelationshipActivity(
        ctx.user.id,
        "CUSTOMER_RELATIONSHIP_CREATED",
        input.customerId,
        buildRelationshipActivityMetadata(created)
      );

      return { id: created.id };
    }),

  update: activeUserProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await getCustomerRelationshipById(input.id);
      if (!existing || existing.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "관계를 찾을 수 없습니다.",
        });
      }

      const involvesCustomer =
        existing.primaryCustomerId === input.customerId ||
        existing.relatedCustomerId === input.customerId;
      if (!involvesCustomer) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "고객과 연결된 관계만 수정할 수 있습니다.",
        });
      }

      const anchorCustomer = await assertCustomerAccessible(
        ctx.user,
        input.customerId
      );
      await assertBothCustomersAccessible(
        ctx.user,
        existing.primaryCustomerId,
        existing.relatedCustomerId
      );
      canMutateRelationshipForMember(ctx.user, input.customerId, anchorCustomer);

      if (input.note !== undefined) {
        try {
          assertRelationshipNoteSafe(input.note ?? undefined);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "관계 메모를 확인해 주세요.",
          });
        }
      }

      const nextType = (input.relationshipType ??
        existing.relationshipType) as CustomerRelationshipType;
      const nextDirection =
        input.direction ??
        (input.relationshipType
          ? resolveDefaultDirection(input.relationshipType)
          : existing.direction);
      const shouldRefreshLabel = Boolean(
        input.relationshipType || input.direction
      );
      const nextLabel = shouldRefreshLabel
        ? resolveRelationshipLabel(nextType, nextDirection)
        : undefined;

      if (
        input.relationshipType &&
        input.relationshipType !== existing.relationshipType
      ) {
        const duplicate = await findActiveRelationshipDuplicate(
          existing.primaryCustomerId,
          existing.relatedCustomerId,
          input.relationshipType,
          existing.id
        );
        if (duplicate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "동일한 고객 관계가 이미 등록되어 있습니다.",
          });
        }
      }

      const updated = await updateCustomerRelationship(input.id, {
        relationshipType: input.relationshipType,
        relationshipLabel: nextLabel,
        direction:
          input.direction ??
          (input.relationshipType ? nextDirection : undefined),
        note:
          input.note === undefined
            ? undefined
            : input.note?.trim()
              ? input.note.trim()
              : null,
        status: input.status,
        updatedBy: ctx.user.id,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "관계 수정에 실패했습니다.",
        });
      }

      await logRelationshipActivity(
        ctx.user.id,
        "CUSTOMER_RELATIONSHIP_UPDATED",
        input.customerId,
        buildRelationshipActivityMetadata(updated)
      );

      return { success: true };
    }),

  delete: activeUserProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        customerId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getCustomerRelationshipById(input.id);
      if (!existing || existing.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "관계를 찾을 수 없습니다.",
        });
      }

      const involvesCustomer =
        existing.primaryCustomerId === input.customerId ||
        existing.relatedCustomerId === input.customerId;
      if (!involvesCustomer) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "고객과 연결된 관계만 삭제할 수 있습니다.",
        });
      }

      const anchorCustomer = await assertCustomerAccessible(
        ctx.user,
        input.customerId
      );
      await assertBothCustomersAccessible(
        ctx.user,
        existing.primaryCustomerId,
        existing.relatedCustomerId
      );
      canMutateRelationshipForMember(ctx.user, input.customerId, anchorCustomer);

      const deleted = await softDeleteCustomerRelationship(
        input.id,
        ctx.user.id
      );
      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "관계 삭제에 실패했습니다.",
        });
      }

      await logRelationshipActivity(
        ctx.user.id,
        "CUSTOMER_RELATIONSHIP_DELETED",
        input.customerId,
        buildRelationshipActivityMetadata(deleted)
      );

      return { success: true };
    }),
});
