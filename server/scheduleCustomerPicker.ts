import { TRPCError } from "@trpc/server";
import type { Customer } from "../drizzle/schema";
import { getAllUsers, getCustomerById, getCustomers, getUserById } from "./db";

function isSoftDeleted(row: {
  isActive?: boolean | null;
  deletedAt?: Date | null;
}) {
  return row.isActive === false || row.deletedAt != null;
}

const MIN_SEARCH_LENGTH = 2;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;

export type ScheduleCustomerPickerUser = {
  id: number;
  role: string;
  teamId: number | null;
  subBranchAdminId: number | null;
  accountStatus: string;
};

export type ScheduleCustomerPickerItem = {
  id: number;
  name: string;
  maskedPhone: string | null;
  statusLabel: string;
  priorityLabel: string;
  assignedUserName: string | null;
  lastContactedAt: string | null;
  lastConsultedAt: string | null;
};

export type ScheduleCustomerPickerResult = {
  items: ScheduleCustomerPickerItem[];
  selectedCustomer: ScheduleCustomerPickerItem | null;
  searchRequired: boolean;
  tooManyResults: boolean;
  hint: string | null;
};

function maskPhoneForPicker(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "연락처 등록";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function priorityLabel(priority?: string | null): string {
  if (!priority || priority === "unclassified") return "미분류";
  if (
    priority === "A" ||
    priority === "B" ||
    priority === "C" ||
    priority === "D"
  ) {
    return priority;
  }
  return "확인 필요";
}

function toPickerItem(
  customer: Customer,
  assignedUserName: string | null
): ScheduleCustomerPickerItem {
  return {
    id: customer.id,
    name: customer.name,
    maskedPhone: maskPhoneForPicker(customer.phone),
    statusLabel: customer.consultStatus ?? "미상담",
    priorityLabel: priorityLabel(customer.priority),
    assignedUserName,
    lastContactedAt: null,
    lastConsultedAt: null,
  };
}

async function assertCustomerAccessible(
  user: ScheduleCustomerPickerUser,
  customerId: number
): Promise<Customer> {
  const customer = await getCustomerById(customerId);
  if (!customer || isSoftDeleted(customer)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }
  if (user.role === "branch_admin") return customer;
  if (user.role === "sub_branch_admin") {
    if (customer.subBranchAdminId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "본인 산하 고객만 접근 가능합니다.",
      });
    }
    return customer;
  }
  if (user.role === "team_leader") {
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

async function buildScopedCustomerQuery(
  user: ScheduleCustomerPickerUser,
  search: string,
  limit: number
) {
  const trimmed = search.trim();
  const baseFilter = {
    search: trimmed,
    limit: limit + 1,
  };

  if (user.role === "branch_admin") {
    return getCustomers(baseFilter);
  }
  if (user.role === "sub_branch_admin") {
    return getCustomers({ ...baseFilter, subBranchAdminId: user.id });
  }
  if (user.role === "team_leader" && user.teamId) {
    return getCustomers({ ...baseFilter, teamId: user.teamId });
  }
  if (user.role === "team_leader") {
    const { getHierarchyScopeUserIds } = await import("./routers");
    const agentIds = await getHierarchyScopeUserIds(user);
    return getCustomers({ ...baseFilter, agentIds: agentIds ?? [user.id] });
  }
  return getCustomers({ ...baseFilter, agentId: user.id });
}

async function searchByAssignedUserName(
  user: ScheduleCustomerPickerUser,
  search: string,
  limit: number
): Promise<Customer[]> {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return [];

  const allUsers = await getAllUsers();
  let candidateAgentIds: number[] = [];

  if (user.role === "branch_admin") {
    candidateAgentIds = allUsers
      .filter(
        u =>
          u.accountStatus === "active" &&
          (u.name ?? "").toLowerCase().includes(normalized)
      )
      .map(u => u.id);
  } else if (user.role === "sub_branch_admin") {
    candidateAgentIds = allUsers
      .filter(
        u =>
          u.accountStatus === "active" &&
          u.subBranchAdminId === user.id &&
          (u.name ?? "").toLowerCase().includes(normalized)
      )
      .map(u => u.id);
  } else if (user.role === "team_leader") {
    candidateAgentIds = allUsers
      .filter(
        u =>
          u.accountStatus === "active" &&
          u.teamId === user.teamId &&
          (u.name ?? "").toLowerCase().includes(normalized)
      )
      .map(u => u.id);
  } else {
    if (user.id && allUsers.some(u => u.id === user.id)) {
      const self = allUsers.find(u => u.id === user.id);
      if ((self?.name ?? "").toLowerCase().includes(normalized)) {
        candidateAgentIds = [user.id];
      }
    }
  }

  if (candidateAgentIds.length === 0) return [];
  return getCustomers({
    agentIds: candidateAgentIds,
    limit: limit + 1,
  });
}

async function mapCustomersToPickerItems(
  rows: Customer[]
): Promise<ScheduleCustomerPickerItem[]> {
  const userNameCache = new Map<number, string | null>();
  const items: ScheduleCustomerPickerItem[] = [];
  for (const customer of rows) {
    let assignedUserName: string | null = null;
    if (customer.agentId) {
      if (!userNameCache.has(customer.agentId)) {
        const agent = await getUserById(customer.agentId);
        userNameCache.set(customer.agentId, agent?.name ?? null);
      }
      assignedUserName = userNameCache.get(customer.agentId) ?? null;
    }
    items.push(toPickerItem(customer, assignedUserName));
  }
  return items;
}

export async function searchCustomersForSchedulePicker(
  user: ScheduleCustomerPickerUser,
  input: {
    search?: string;
    limit?: number;
    selectedCustomerId?: number;
  }
): Promise<ScheduleCustomerPickerResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const search = input.search?.trim() ?? "";
  let selectedCustomer: ScheduleCustomerPickerItem | null = null;

  if (input.selectedCustomerId) {
    try {
      const customer = await assertCustomerAccessible(
        user,
        input.selectedCustomerId
      );
      const agent = customer.agentId
        ? await getUserById(customer.agentId)
        : null;
      selectedCustomer = toPickerItem(customer, agent?.name ?? null);
    } catch {
      selectedCustomer = null;
    }
  }

  if (search.length < MIN_SEARCH_LENGTH) {
    return {
      items: selectedCustomer ? [selectedCustomer] : [],
      selectedCustomer,
      searchRequired: true,
      tooManyResults: false,
      hint: "고객명 또는 연락처 2글자 이상으로 검색해 주세요.",
    };
  }

  const [textMatches, agentMatches] = await Promise.all([
    buildScopedCustomerQuery(user, search, limit),
    searchByAssignedUserName(user, search, limit),
  ]);

  const merged = new Map<number, Customer>();
  for (const row of [...textMatches, ...agentMatches]) {
    merged.set(row.id, row);
  }
  const combined = Array.from(merged.values());
  const tooManyResults = combined.length > limit;
  const sliced = combined.slice(0, limit);
  const items = await mapCustomersToPickerItems(sliced);

  if (
    selectedCustomer &&
    !items.some(item => item.id === selectedCustomer!.id)
  ) {
    items.unshift(selectedCustomer);
  }

  return {
    items,
    selectedCustomer,
    searchRequired: false,
    tooManyResults,
    hint: tooManyResults
      ? "검색 결과가 많습니다. 검색어를 더 입력해 주세요."
      : items.length === 0
        ? "검색 결과가 없습니다. 검색어를 조금 바꿔보세요."
        : null,
  };
}
