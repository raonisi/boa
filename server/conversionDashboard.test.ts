import { describe, expect, it } from "vitest";
import { buildConversionDashboardResult } from "./conversionDashboard";

const baseUsers = [
  {
    id: 4,
    name: "Test Member",
    role: "member",
    accountStatus: "active",
    teamId: 10,
  },
  {
    id: 5,
    name: "Other Member",
    role: "member",
    accountStatus: "active",
    teamId: 10,
  },
] as any;

function customer(id: number, agentId: number, assignedAt: string, extra = {}) {
  return {
    id,
    name: `[TEST] customer ${id}`,
    agentId,
    assignedAt: new Date(assignedAt),
    createdAt: new Date(assignedAt),
    consultStatus: "미상담",
    nextAction: null,
    isActive: true,
    deletedAt: null,
    ...extra,
  } as any;
}

function contract(
  id: number,
  customerId: number,
  agentId: number,
  contractDate: string,
  monthlyPremium: number,
  extra = {}
) {
  return {
    id,
    customerId,
    agentId,
    contractDate: new Date(contractDate),
    monthlyPremium,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(contractDate),
    ...extra,
  } as any;
}

describe("conversion dashboard aggregation", () => {
  it("calculates assignment, progress, contracts, rates, premium, and stale DB safely", () => {
    const result = buildConversionDashboardResult(
      {
        now: new Date("2026-06-30T12:00:00.000Z"),
        users: baseUsers,
        teams: [{ id: 10, name: "Test Team" }] as any,
        customers: [
          customer(101, 4, "2026-06-01T00:00:00.000Z"),
          customer(102, 4, "2026-06-02T00:00:00.000Z", {
            nextAction: "재연락",
          }),
          customer(103, 4, "2026-06-03T00:00:00.000Z"),
          customer(104, 5, "2026-06-04T00:00:00.000Z"),
        ],
        contracts: [
          contract(201, 103, 4, "2026-06-10", 100000),
          contract(202, 104, 5, "2026-06-12", 500000, {
            deletedAt: new Date("2026-06-13T00:00:00.000Z"),
          }),
        ],
        consultations: [
          {
            id: 301,
            customerId: 102,
            agentId: 4,
            isActive: true,
            deletedAt: null,
            createdAt: new Date("2026-06-05T00:00:00.000Z"),
          },
        ] as any,
        followUps: [
          {
            id: 401,
            customerId: 102,
            assignedAgentId: 4,
            status: "scheduled",
            nextContactDate: new Date("2026-06-20T00:00:00.000Z"),
            deletedAt: null,
          },
        ] as any,
        assignmentHistory: [
          {
            id: 501,
            customerId: 103,
            newAgentId: 4,
            assignedBy: 1,
            createdAt: new Date("2026-06-03T00:00:00.000Z"),
          },
        ] as any,
      },
      {
        preset: "custom",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      }
    );

    expect(result.summary.assignedDbCount).toBe(4);
    expect(result.summary.progressedDbCount).toBe(1);
    expect(result.summary.contractedCustomerCount).toBe(1);
    expect(result.summary.newContractCount).toBe(1);
    expect(result.summary.monthlyPremiumTotal).toBe(100000);
    expect(result.summary.dbToConsultRate).toBe(25);
    expect(result.summary.dbToContractRate).toBe(25);
    expect(result.summary.consultToContractRate).toBe(100);
    expect(result.summary.premiumPerAssignedDb).toBe(25000);
    expect(result.staleDb.stale14Count).toBe(3);
    expect(result.staleDb.stale30Count).toBe(0);
    expect(result.staleDb.uncontactedDbCount).toBe(2);
    expect(result.staleDb.overdueFollowUpCount).toBe(1);
  });

  it("reflects contract restore by including active non-deleted contracts", () => {
    const result = buildConversionDashboardResult(
      {
        now: new Date("2026-06-30T12:00:00.000Z"),
        users: baseUsers,
        teams: [] as any,
        customers: [customer(104, 5, "2026-06-04T00:00:00.000Z")],
        contracts: [contract(202, 104, 5, "2026-06-12", 500000)],
        consultations: [] as any,
        followUps: [] as any,
        assignmentHistory: [] as any,
      },
      { preset: "custom", dateFrom: "2026-06-01", dateTo: "2026-06-30" }
    );

    expect(result.summary.contractedCustomerCount).toBe(1);
    expect(result.summary.newContractCount).toBe(1);
    expect(result.summary.monthlyPremiumTotal).toBe(500000);
  });

  it("keeps rates and premium per DB safe when there is no assigned DB", () => {
    const result = buildConversionDashboardResult(
      {
        now: new Date("2026-06-30T12:00:00.000Z"),
        users: baseUsers,
        teams: [] as any,
        customers: [],
        contracts: [],
        consultations: [] as any,
        followUps: [] as any,
        assignmentHistory: [] as any,
      },
      { preset: "custom", dateFrom: "2026-06-01", dateTo: "2026-06-30" }
    );

    expect(result.summary.assignedDbCount).toBe(0);
    expect(result.summary.dbToConsultRate).toBe(0);
    expect(result.summary.dbToContractRate).toBe(0);
    expect(result.summary.consultToContractRate).toBe(0);
    expect(result.summary.premiumPerAssignedDb).toBe(0);
  });
});
