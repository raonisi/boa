import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as actionPlansDb from "./actionPlansDb";
import * as routers from "./routers";
import { buildExecutiveActionPlanXlsxBuffer } from "./executiveActionPlanReport";
import { buildManagerDashboard } from "./actionPlanDashboard";
import {
  assertNoSensitiveDailyPlanInput,
  assertNoSensitiveWeeklyPlanInput,
  findSensitiveActionPlanPattern,
} from "./actionPlanSensitiveGuard";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";

function createCtx(
  role: Role,
  opts?: { userId?: number; teamId?: number; subBranchAdminId?: number }
): TrpcContext {
  const id =
    opts?.userId ??
    (role === "branch_admin"
      ? 1
      : role === "sub_branch_admin"
        ? 2
        : role === "team_leader"
          ? 3
          : 4);
  return {
    user: {
      id,
      openId: `test-${role}`,
      name: `Test ${role}`,
      email: `${role}@test.com`,
      loginMethod: "manus",
      role,
      accountStatus: "active",
      teamId: opts?.teamId ?? (role === "team_leader" ? 10 : null),
      subBranchAdminId: opts?.subBranchAdminId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const baseMonthly = {
  id: 100,
  userId: 4,
  targetMonth: "2026-06",
  monthlyContractTarget: 2,
  monthlyPremiumTarget: 100000,
  monthlyConsultationTarget: 10,
  monthlyCallTarget: 50,
  monthlyMessageTarget: 30,
  monthlyFollowUpTarget: 5,
  monthlyRevenueTarget: 100000,
  monthlyNewConsultationTarget: 8,
  monthlyContactTarget: 40,
  monthlyAnalysisTarget: 6,
  monthlyProposalTarget: 4,
  monthlyIntroductionRequestTarget: 3,
  focusCustomerGroup: "신규 DB",
  primaryCustomerSegment: "30대 기혼 DB",
  monthlyStrategy: "상담 집중",
  preparationMemo: "자료 준비",
  monthlyPreparationStatus: "준비중",
  expectedRisk: "일정 지연",
  supportRequest: "없음",
  complianceCheckMemo: "",
  privacyMinimizedConfirmed: true,
  managerComment: null,
  status: "draft" as const,
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function weeklyWithWeek(weekNumber: number) {
  return {
    id: 200 + weekNumber,
    monthlyPlanId: 100,
    userId: 4,
    targetMonth: "2026-06",
    weekNumber,
    weekStartDate: new Date(`2026-06-0${(weekNumber - 1) * 7 + 1}`),
    weekEndDate: new Date(`2026-06-0${Math.min((weekNumber - 1) * 7 + 7, 30)}`),
    weekLabel: `${weekNumber}주차`,
    weeklyContractTarget: 1,
    weeklyPremiumTarget: 50000,
    weeklyConsultationTarget: 5,
    weeklyCallTarget: 20,
    weeklyMessageTarget: 10,
    weeklyVisitTarget: 2,
    weeklyProposalTarget: 1,
    weeklyFollowUpTarget: 3,
    weeklyRevenueTarget: 50000,
    weeklyAnalysisTarget: 2,
    weeklyIntroductionRequestTarget: 1,
    weeklyReconnectTarget: 2,
    focusCustomerGroup: "신규 DB",
    targetCustomerSegment: "신규 DB",
    targetCustomerReference: "A-102",
    customerStage: "니즈확인",
    proposedProductCategory: "건강보험",
    proposedCoverageArea: "암 보장",
    proposalPurpose: "보장 점검",
    preparationMaterials: "건강보험 리밸런싱",
    weeklyActionPlan: "상담 집중",
    preparationMemo: "",
    expectedRisk: "보험료 부담",
    supportRequest: "없음",
    complianceRiskCheck: "과장표현 없음",
    privacyMinimizedConfirmed: true,
    weeklyReviewMemo: "",
    nextWeekImprovement: "",
    coachingRequest: "",
    managerComment: null,
    status: "draft" as const,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PR21 direct upload week selection", () => {
  it("allows member to create week 1 weekly plan with weekNumber", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue(
      baseMonthly as any
    );
    vi.spyOn(
      actionPlansDb,
      "getWeeklyActionPlanByUserMonthWeek"
    ).mockResolvedValue(undefined);
    vi.spyOn(actionPlansDb, "createWeeklyActionPlan").mockResolvedValue(
      weeklyWithWeek(1) as any
    );
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.createWeeklyPlan({
        monthlyPlanId: 100,
        weekNumber: 1,
        weeklyContractTarget: 1,
        weeklyPremiumTarget: 50000,
        weeklyConsultationTarget: 5,
        weeklyCallTarget: 20,
        weeklyMessageTarget: 10,
        weeklyVisitTarget: 2,
        weeklyProposalTarget: 1,
        weeklyFollowUpTarget: 3,
      });

    expect(result?.weekNumber).toBe(1);
  });

  it("allows member to create week 3 weekly plan (skip weeks)", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue(
      baseMonthly as any
    );
    vi.spyOn(
      actionPlansDb,
      "getWeeklyActionPlanByUserMonthWeek"
    ).mockResolvedValue(undefined);
    vi.spyOn(actionPlansDb, "createWeeklyActionPlan").mockResolvedValue(
      weeklyWithWeek(3) as any
    );
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.createWeeklyPlan({
        monthlyPlanId: 100,
        weekNumber: 3,
        weeklyContractTarget: 1,
        weeklyPremiumTarget: 50000,
        weeklyConsultationTarget: 5,
        weeklyCallTarget: 20,
        weeklyMessageTarget: 10,
        weeklyVisitTarget: 2,
        weeklyProposalTarget: 1,
        weeklyFollowUpTarget: 3,
      });

    expect(result?.weekNumber).toBe(3);
  });

  it("updates existing plan when same month/week resubmitted", async () => {
    const existing = weeklyWithWeek(1);
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue(
      baseMonthly as any
    );
    vi.spyOn(
      actionPlansDb,
      "getWeeklyActionPlanByUserMonthWeek"
    ).mockResolvedValue(existing as any);
    vi.spyOn(actionPlansDb, "updateWeeklyActionPlan").mockResolvedValue({
      ...existing,
      weeklyContractTarget: 2,
    } as any);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.createWeeklyPlan({
        monthlyPlanId: 100,
        weekNumber: 1,
        weeklyContractTarget: 2,
        weeklyPremiumTarget: 50000,
        weeklyConsultationTarget: 5,
        weeklyCallTarget: 20,
        weeklyMessageTarget: 10,
        weeklyVisitTarget: 2,
        weeklyProposalTarget: 1,
        weeklyFollowUpTarget: 3,
      });

    expect(result?.weeklyContractTarget).toBe(2);
    expect(actionPlansDb.updateWeeklyActionPlan).toHaveBeenCalled();
  });

  it("blocks manager from creating plan for another user", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue({
      ...baseMonthly,
      userId: 4,
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3 }))
        .actionPlans.createWeeklyPlan({
          monthlyPlanId: 100,
          weekNumber: 1,
          weeklyContractTarget: 1,
          weeklyPremiumTarget: 0,
          weeklyConsultationTarget: 0,
          weeklyCallTarget: 0,
          weeklyMessageTarget: 0,
          weeklyVisitTarget: 0,
          weeklyProposalTarget: 0,
          weeklyFollowUpTarget: 0,
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows branch_admin to create own monthly plan", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanByUserMonth").mockResolvedValue(
      undefined
    );
    vi.spyOn(actionPlansDb, "createBranchActionPlan").mockResolvedValue({
      ...baseMonthly,
      userId: 1,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("branch_admin", { userId: 1 }))
      .actionPlans.createMonthlyPlan({
        targetMonth: "2026-06",
        monthlyContractTarget: 1,
        monthlyPremiumTarget: 0,
        monthlyConsultationTarget: 0,
        monthlyCallTarget: 0,
        monthlyMessageTarget: 0,
        monthlyFollowUpTarget: 0,
        privacyMinimizedConfirmed: true,
      });

    expect(result?.userId).toBe(1);
  });

  it("blocks submit without privacy confirmation", async () => {
    vi.spyOn(actionPlansDb, "getWeeklyActionPlanById").mockResolvedValue({
      ...weeklyWithWeek(1),
      privacyMinimizedConfirmed: false,
    } as any);

    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .actionPlans.submitWeeklyPlan({ id: 201 })
    ).rejects.toMatchObject({
      message: "개인정보 최소화 확인이 필요합니다.",
    });
  });
});

describe("PR21 sensitive guard allow/block", () => {
  it("allows customer code A-102", () => {
    expect(
      findSensitiveActionPlanPattern("A-102", "targetCustomerReference")
    ).toBeNull();
  });

  it("allows K고객", () => {
    expect(
      findSensitiveActionPlanPattern("K고객", "targetCustomerReference")
    ).toBeNull();
  });

  it("blocks 고객명 홍길동", () => {
    expect(findSensitiveActionPlanPattern("고객명 홍길동")).toBeTruthy();
  });

  it("blocks 계약자 김철수", () => {
    expect(findSensitiveActionPlanPattern("계약자 김철수")).toBeTruthy();
  });

  it("allows 건강보험 리밸런싱 in preparationMaterials", () => {
    expect(() =>
      assertNoSensitiveWeeklyPlanInput({
        preparationMaterials: "건강보험 리밸런싱",
      })
    ).not.toThrow();
  });

  it("allows 암·뇌심 보장 점검 in coverage area", () => {
    expect(() =>
      assertNoSensitiveWeeklyPlanInput({
        proposedCoverageArea: "암·뇌심 보장 점검",
      })
    ).not.toThrow();
  });

  it("blocks phone in preparationMaterials", () => {
    expect(() =>
      assertNoSensitiveWeeklyPlanInput({
        preparationMaterials: "01012345678",
      })
    ).toThrow();
  });

  it("blocks 피보험자 이영희 in daily memo", () => {
    expect(() =>
      assertNoSensitiveDailyPlanInput({
        actualResultMemo: "피보험자 이영희",
      })
    ).toThrow();
  });
});

describe("PR21 manager dashboard", () => {
  it("shows goal not registered users", () => {
    const users = [
      { id: 4, name: "Member", role: "member", teamId: 10 },
      { id: 5, name: "Member2", role: "member", teamId: 10 },
    ];
    const monthly = [{ ...baseMonthly, userId: 4, status: "submitted" as const }];
    const result = buildManagerDashboard(users, monthly as any, [], [], {
      targetMonth: "2026-06",
      todayDate: "2026-06-02",
    });
    expect(result.goalNotRegistered).toHaveLength(1);
    expect(result.goalNotRegistered[0].id).toBe(5);
  });

  it("shows coaching request users", () => {
    const users = [{ id: 4, name: "Member", role: "member", teamId: 10 }];
    const weekly = [
      {
        ...weeklyWithWeek(1),
        coachingRequest: "멘트코칭 요청",
        status: "submitted" as const,
      },
    ];
    const result = buildManagerDashboard(users, [baseMonthly] as any, weekly as any, [], {
      targetMonth: "2026-06",
      weekNumber: 1,
      todayDate: "2026-06-02",
    });
    expect(result.coachingRequestUsers).toHaveLength(1);
  });
});

describe("PR21 executive XLSX", () => {
  it("includes month/week/segment fields without customer PII", () => {
    const users = [{ id: 4, name: "Member", role: "member" }];
    const buffer = buildExecutiveActionPlanXlsxBuffer({
      input: {
        reportMonth: "2026-06",
        reportWeekLabel: "1주차",
        branchName: "BOA",
        generatedByName: "지점장",
        generatedAt: new Date(),
      },
      users,
      monthlyPlans: [baseMonthly] as any,
      weeklyPlans: [weeklyWithWeek(1)] as any,
      dailyPlans: [],
    });
    const text = buffer.toString("utf8");
    expect(buffer.length).toBeGreaterThan(100);
    expect(text).not.toContain("홍길동");
    expect(text).not.toContain("010");
  });
});

describe("PR21 RBAC preserved", () => {
  it("blocks member viewing another user plan", async () => {
    vi.spyOn(routers, "getHierarchyScopeUserIds").mockResolvedValue([4]);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .actionPlans.getMonthlyPlan({ userId: 99, targetMonth: "2026-06" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks team_leader out of scope", async () => {
    vi.spyOn(routers, "getHierarchyScopeUserIds").mockResolvedValue([3]);
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3 }))
        .actionPlans.getMonthlyPlan({ userId: 99, targetMonth: "2026-06" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks sub_branch_admin out of scope", async () => {
    vi.spyOn(routers, "getHierarchyScopeUserIds").mockResolvedValue([2]);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .actionPlans.getMonthlyPlan({ userId: 99, targetMonth: "2026-06" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
