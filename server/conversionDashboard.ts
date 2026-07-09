import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  assignmentHistory,
  consultations,
  customers,
  type AssignmentHistory,
  type Consultation,
  type Contract,
  type Customer,
  type FollowUp,
  type Team,
  type User,
} from "../drizzle/schema";
import {
  getAllContracts,
  getAllTeams,
  getAllUsers,
  getCustomers,
  getDb,
  getFollowUps,
} from "./db";

export type ConversionPeriodPreset = "month" | "last7" | "last30" | "custom";

export type ConversionDashboardInput = {
  preset?: ConversionPeriodPreset;
  dateFrom?: string;
  dateTo?: string;
  agentIdFilter?: number;
  teamIdFilter?: number;
};

export type ConversionDashboardRateSet = {
  dbToConsultRate: number;
  dbToContractRate: number;
  consultToContractRate: number;
  premiumPerAssignedDb: number;
};

export type ConversionDashboardSummary = ConversionDashboardRateSet & {
  assignedDbCount: number;
  progressedDbCount: number;
  contractedCustomerCount: number;
  newContractCount: number;
  monthlyPremiumTotal: number;
  averageDaysToContract: number | null;
};

export type ConversionDashboardAgentRow = ConversionDashboardSummary & {
  agentId: number;
  agentName: string;
  role: string;
  teamId: number | null;
  uncontactedDbCount: number;
  stale14Count: number;
  stale30Count: number;
  overdueFollowUpCount: number;
};

export type ConversionDashboardResult = {
  period: {
    preset: ConversionPeriodPreset;
    dateFrom: string;
    dateTo: string;
  };
  scope: {
    agentIds: number[];
    agentIdFilter: number | null;
    teamIdFilter: number | null;
  };
  summary: ConversionDashboardSummary;
  funnel: Array<{
    key: "assigned" | "progressed" | "contracted";
    label: string;
    count: number;
    rateFromAssigned: number;
  }>;
  byAgent: ConversionDashboardAgentRow[];
  staleDb: {
    uncontactedDbCount: number;
    stale14Count: number;
    stale30Count: number;
    overdueFollowUpCount: number;
  };
};

type DashboardData = {
  customers: Customer[];
  contracts: Contract[];
  consultations: Consultation[];
  followUps: FollowUp[];
  assignmentHistory: AssignmentHistory[];
  users: User[];
  teams: Team[];
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function resolveConversionPeriod(
  input: ConversionDashboardInput = {},
  now = new Date()
) {
  const preset = input.preset ?? (input.dateFrom || input.dateTo ? "custom" : "month");
  if (preset === "last7") {
    const dateTo = endOfDay(now);
    const dateFrom = startOfDay(new Date(dateTo.getTime() - 6 * DAY_MS));
    return { preset, dateFrom, dateTo };
  }
  if (preset === "last30") {
    const dateTo = endOfDay(now);
    const dateFrom = startOfDay(new Date(dateTo.getTime() - 29 * DAY_MS));
    return { preset, dateFrom, dateTo };
  }
  if (preset === "custom") {
    const dateFrom = input.dateFrom
      ? startOfDay(new Date(input.dateFrom))
      : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const dateTo = input.dateTo ? endOfDay(new Date(input.dateTo)) : endOfDay(now);
    return { preset, dateFrom, dateTo };
  }
  return {
    preset: "month" as const,
    dateFrom: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    dateTo: endOfDay(now),
  };
}

function isActiveCustomer(customer: Customer) {
  return customer.isActive !== false && !customer.deletedAt && customer.agentId != null;
}

function isActiveContract(contract: Contract) {
  return contract.isActive !== false && !contract.deletedAt;
}

function isActiveConsultation(consultation: Consultation) {
  return consultation.isActive !== false && !consultation.deletedAt;
}

function isActiveFollowUp(followUp: FollowUp) {
  return !followUp.deletedAt;
}

function isInPeriod(value: Date | string | null | undefined, dateFrom: Date, dateTo: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= dateFrom && date <= dateTo;
}

function safeRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function contractDateOf(contract: Contract) {
  // Prefer the contract date; legacy rows can still fall back to creation time.
  return contract.contractDate ?? contract.createdAt;
}

function getAssignedAt(customer: Customer, histories: AssignmentHistory[]) {
  // Prefer assignment_history, then fall back to customer.assignedAt/createdAt.
  const agentMatched = histories
    .filter(item => item.customerId === customer.id && item.newAgentId === customer.agentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  const firstHistory = histories
    .filter(item => item.customerId === customer.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  return agentMatched?.createdAt ?? firstHistory?.createdAt ?? customer.assignedAt ?? customer.createdAt;
}

function buildAgentSummary(
  agentId: number,
  data: DashboardData,
  dateFrom: Date,
  dateTo: Date
): ConversionDashboardAgentRow {
  const now = data.now ?? new Date();
  const agent = data.users.find(user => user.id === agentId);
  const cohortCustomers = data.customers.filter(customer => {
    if (customer.agentId !== agentId || !isActiveCustomer(customer)) return false;
    return isInPeriod(getAssignedAt(customer, data.assignmentHistory), dateFrom, dateTo);
  });
  const cohortIds = new Set(cohortCustomers.map(customer => customer.id));
  const activeContracts = data.contracts.filter(
    contract => isActiveContract(contract) && cohortIds.has(contract.customerId)
  );
  const activeConsultations = data.consultations.filter(
    consultation => isActiveConsultation(consultation) && cohortIds.has(consultation.customerId)
  );
  const activeFollowUps = data.followUps.filter(
    followUp => isActiveFollowUp(followUp) && cohortIds.has(followUp.customerId)
  );
  const contractCustomerIds = new Set(activeContracts.map(contract => contract.customerId));
  const consultationCustomerIds = new Set(
    activeConsultations.map(consultation => consultation.customerId)
  );
  const followUpCustomerIds = new Set(activeFollowUps.map(followUp => followUp.customerId));
  const progressedCustomerIds = new Set<number>();

  for (const customer of cohortCustomers) {
    if (
      consultationCustomerIds.has(customer.id) ||
      followUpCustomerIds.has(customer.id) ||
      Boolean(customer.nextAction?.trim()) ||
      customer.consultStatus !== "미상담"
    ) {
      progressedCustomerIds.add(customer.id);
    }
  }

  const contractsInPeriod = activeContracts.filter(contract =>
    isInPeriod(contractDateOf(contract), dateFrom, dateTo)
  );
  const monthlyPremiumTotal = contractsInPeriod.reduce(
    (sum, contract) => sum + Number(contract.monthlyPremium ?? 0),
    0
  );

  const daysToContract = cohortCustomers
    .map(customer => {
      const firstContract = activeContracts
        .filter(contract => contract.customerId === customer.id)
        .sort(
          (a, b) =>
            new Date(contractDateOf(a)).getTime() - new Date(contractDateOf(b)).getTime()
        )[0];
      if (!firstContract) return null;
      return Math.max(
        0,
        Math.round(
          (new Date(contractDateOf(firstContract)).getTime() -
            new Date(getAssignedAt(customer, data.assignmentHistory)).getTime()) /
            DAY_MS
        )
      );
    })
    .filter((value): value is number => value != null && Number.isFinite(value));

  const noContractCustomers = cohortCustomers.filter(
    customer => !contractCustomerIds.has(customer.id)
  );
  const stale14Count = noContractCustomers.filter(customer => {
    const days = (now.getTime() - new Date(getAssignedAt(customer, data.assignmentHistory)).getTime()) / DAY_MS;
    return days >= 14;
  }).length;
  const stale30Count = noContractCustomers.filter(customer => {
    const days = (now.getTime() - new Date(getAssignedAt(customer, data.assignmentHistory)).getTime()) / DAY_MS;
    return days >= 30;
  }).length;
  const uncontactedDbCount = noContractCustomers.filter(
    customer => !consultationCustomerIds.has(customer.id) && !followUpCustomerIds.has(customer.id)
  ).length;
  const overdueFollowUpCount = activeFollowUps.filter(
    followUp =>
      followUp.status !== "completed" &&
      followUp.status !== "cancelled" &&
      new Date(followUp.nextContactDate).getTime() < now.getTime()
  ).length;

  const assignedDbCount = cohortCustomers.length;
  const progressedDbCount = progressedCustomerIds.size;
  const contractedCustomerCount = contractCustomerIds.size;
  const newContractCount = contractsInPeriod.length;

  return {
    agentId,
    agentName: agent?.name ?? `사용자 #${agentId}`,
    role: agent?.role ?? "member",
    teamId: agent?.teamId ?? null,
    assignedDbCount,
    progressedDbCount,
    contractedCustomerCount,
    newContractCount,
    monthlyPremiumTotal,
    averageDaysToContract:
      daysToContract.length > 0
        ? Math.round((daysToContract.reduce((sum, value) => sum + value, 0) / daysToContract.length) * 10) / 10
        : null,
    dbToConsultRate: safeRate(progressedDbCount, assignedDbCount),
    dbToContractRate: safeRate(contractedCustomerCount, assignedDbCount),
    consultToContractRate: safeRate(contractedCustomerCount, progressedDbCount),
    premiumPerAssignedDb: assignedDbCount
      ? Math.round(monthlyPremiumTotal / assignedDbCount)
      : 0,
    uncontactedDbCount,
    stale14Count,
    stale30Count,
    overdueFollowUpCount,
  };
}

function sumAgentRows(rows: ConversionDashboardAgentRow[]): ConversionDashboardSummary {
  const assignedDbCount = rows.reduce((sum, row) => sum + row.assignedDbCount, 0);
  const progressedDbCount = rows.reduce((sum, row) => sum + row.progressedDbCount, 0);
  const contractedCustomerCount = rows.reduce(
    (sum, row) => sum + row.contractedCustomerCount,
    0
  );
  const newContractCount = rows.reduce((sum, row) => sum + row.newContractCount, 0);
  const monthlyPremiumTotal = rows.reduce(
    (sum, row) => sum + row.monthlyPremiumTotal,
    0
  );
  const dayRows = rows.filter(row => row.averageDaysToContract != null);
  return {
    assignedDbCount,
    progressedDbCount,
    contractedCustomerCount,
    newContractCount,
    monthlyPremiumTotal,
    averageDaysToContract:
      dayRows.length > 0
        ? Math.round(
            (dayRows.reduce((sum, row) => sum + Number(row.averageDaysToContract), 0) /
              dayRows.length) *
              10
          ) / 10
        : null,
    dbToConsultRate: safeRate(progressedDbCount, assignedDbCount),
    dbToContractRate: safeRate(contractedCustomerCount, assignedDbCount),
    consultToContractRate: safeRate(contractedCustomerCount, progressedDbCount),
    premiumPerAssignedDb: assignedDbCount
      ? Math.round(monthlyPremiumTotal / assignedDbCount)
      : 0,
  };
}

export function buildConversionDashboardResult(
  data: DashboardData,
  input: ConversionDashboardInput = {}
): ConversionDashboardResult {
  const { preset, dateFrom, dateTo } = resolveConversionPeriod(input, data.now);
  const scopedAgentIds = Array.from(
    new Set(data.users.map(user => user.id).filter(id => Number.isFinite(id)))
  );
  const byAgent = scopedAgentIds
    .map(agentId => buildAgentSummary(agentId, data, dateFrom, dateTo))
    .filter(row => row.assignedDbCount > 0 || row.newContractCount > 0)
    .sort((a, b) => b.dbToContractRate - a.dbToContractRate || b.monthlyPremiumTotal - a.monthlyPremiumTotal);
  const summary = sumAgentRows(byAgent);
  const staleDb = {
    uncontactedDbCount: byAgent.reduce((sum, row) => sum + row.uncontactedDbCount, 0),
    stale14Count: byAgent.reduce((sum, row) => sum + row.stale14Count, 0),
    stale30Count: byAgent.reduce((sum, row) => sum + row.stale30Count, 0),
    overdueFollowUpCount: byAgent.reduce((sum, row) => sum + row.overdueFollowUpCount, 0),
  };

  return {
    period: {
      preset,
      dateFrom: toDateOnlyString(dateFrom),
      dateTo: toDateOnlyString(dateTo),
    },
    scope: {
      agentIds: scopedAgentIds,
      agentIdFilter: input.agentIdFilter ?? null,
      teamIdFilter: input.teamIdFilter ?? null,
    },
    summary,
    funnel: [
      {
        key: "assigned",
        label: "배분 DB",
        count: summary.assignedDbCount,
        rateFromAssigned: 100,
      },
      {
        key: "progressed",
        label: "상담 진행",
        count: summary.progressedDbCount,
        rateFromAssigned: summary.dbToConsultRate,
      },
      {
        key: "contracted",
        label: "계약 고객",
        count: summary.contractedCustomerCount,
        rateFromAssigned: summary.dbToContractRate,
      },
    ],
    byAgent,
    staleDb,
  };
}

export async function getConversionDashboardDataForAgentIds(
  agentIds: number[],
  input: ConversionDashboardInput = {}
): Promise<ConversionDashboardResult> {
  const db = await getDb();
  const [users, teams, customerRows, contractRows, followUpRows] = await Promise.all([
    getAllUsers(),
    getAllTeams(),
    getCustomers({ agentIds }),
    getAllContracts({ agentIds }),
    getFollowUps({ agentIds }),
  ]);
  const customerIds = customerRows.map(customer => customer.id);
  const [consultationRows, assignmentRows] =
    db && customerIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(consultations)
            .where(
              and(
                inArray(consultations.customerId, customerIds),
                eq(consultations.isActive, true),
                isNull(consultations.deletedAt)
              )
            ),
          db
            .select()
            .from(assignmentHistory)
            .where(inArray(assignmentHistory.customerId, customerIds)),
        ])
      : [[], []];

  const activeUserIds = new Set(agentIds);
  return buildConversionDashboardResult(
    {
      customers: customerRows.filter(customer => activeUserIds.has(customer.agentId ?? -1)),
      contracts: contractRows.filter(contract => !contract.deletedAt),
      consultations: consultationRows,
      followUps: followUpRows,
      assignmentHistory: assignmentRows,
      users: (users as User[]).filter(user => activeUserIds.has(user.id)),
      teams: teams as Team[],
    },
    input
  );
}
