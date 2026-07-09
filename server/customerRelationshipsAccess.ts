import { TRPCError } from "@trpc/server";
import type { Customer } from "../drizzle/schema";
import { getCustomerById, getUserById } from "./db";

export type CustomerRelationshipUser = {
  id: number;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
};

function isSoftDeleted(row: {
  isActive?: boolean | null;
  deletedAt?: Date | null;
}) {
  return row.isActive === false || row.deletedAt != null;
}

export function matchesCustomerScope(
  user: CustomerRelationshipUser,
  customer: Customer
) {
  if (isSoftDeleted(customer)) return false;
  if (user.role === "branch_admin") return true;
  if (user.role === "sub_branch_admin") {
    return customer.subBranchAdminId === user.id || customer.agentId === user.id;
  }
  if (user.role === "team_leader") {
    if (customer.assignedTeamId && customer.assignedTeamId === user.teamId) {
      return true;
    }
    return false;
  }
  return customer.agentId === user.id;
}

export async function filterCustomerIdsInScope(
  user: CustomerRelationshipUser,
  customerIds: number[]
): Promise<number[]> {
  if (customerIds.length === 0) return [];
  const { getDb } = await import("./db");
  const { customers } = await import("../drizzle/schema");
  const { inArray } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(customers)
    .where(inArray(customers.id, customerIds));
  const scoped: number[] = [];
  for (const row of rows) {
    if (user.role === "sub_branch_admin" || user.role === "team_leader") {
      try {
        await assertCustomerAccessible(user, row.id);
        scoped.push(row.id);
      } catch {
        // skip
      }
      continue;
    }
    if (matchesCustomerScope(user, row)) scoped.push(row.id);
  }
  return scoped;
}

export function assertActiveAccount(user: CustomerRelationshipUser) {
  if (user.accountStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "비활성 계정은 접근할 수 없습니다.",
    });
  }
}

export async function assertCustomerAccessible(
  user: CustomerRelationshipUser,
  customerId: number
): Promise<Customer> {
  assertActiveAccount(user);
  const customer = await getCustomerById(customerId);
  if (!customer || isSoftDeleted(customer)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }
  if (user.role === "branch_admin") return customer;
  if (user.role === "sub_branch_admin") {
    if (customer.subBranchAdminId === user.id || customer.agentId === user.id) {
      return customer;
    }
    const agent = customer.agentId ? await getUserById(customer.agentId) : null;
    if (!agent || agent.subBranchAdminId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 산하 고객만 접근 가능합니다.",
      });
    }
    return customer;
  }
  if (user.role === "team_leader") {
    if (customer.agentId === user.id) return customer;
    if (customer.assignedTeamId && customer.assignedTeamId === user.teamId) {
      return customer;
    }
    const agent = customer.agentId ? await getUserById(customer.agentId) : null;
    if (!agent || agent.teamId !== user.teamId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 팀 고객만 접근 가능합니다.",
      });
    }
    return customer;
  }
  if (customer.agentId !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 고객만 접근 가능합니다.",
    });
  }
  return customer;
}

export async function assertBothCustomersAccessible(
  user: CustomerRelationshipUser,
  customerA: number,
  customerB: number
) {
  await assertCustomerAccessible(user, customerA);
  await assertCustomerAccessible(user, customerB);
}

export function canMutateRelationshipForMember(
  user: CustomerRelationshipUser,
  anchorCustomerId: number,
  anchorCustomer: Customer
) {
  if (user.role !== "member") return;
  if (anchorCustomer.agentId !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 담당 고객 기준으로만 관계를 관리할 수 있습니다.",
    });
  }
  if (anchorCustomerId !== anchorCustomer.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인 담당 고객 기준으로만 관계를 관리할 수 있습니다.",
    });
  }
}
