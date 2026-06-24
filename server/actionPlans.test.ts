import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as actionPlansDb from "./actionPlansDb";
import * as routers from "./routers";
import * as executiveReport from "./executiveActionPlanReport";
import { ACTION_PLAN_SENSITIVE_ERROR } from "./actionPlanSensitiveGuard";

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

const sampleMonthly = {
  id: 100,
  userId: 4,
  targetMonth: "2026-06",
  monthlyContractTarget: 2,
  monthlyPremiumTarget: 100000,
  monthlyConsultationTarget: 10,
  monthlyCallTarget: 50,
  monthlyMessageTarget: 30,
  monthlyFollowUpTarget: 5,
  focusCustomerGroup: "신규 DB",
  monthlyStrategy: "상담 집중",
  preparationMemo: "자료 준비",
  expectedRisk: "일정 지연",
  supportRequest: "교육 지원",
  privacyMinimizedConfirmed: true,
  monthlyRevenueTarget: 0,
  monthlyNewConsultationTarget: 0,
  monthlyContactTarget: 0,
  monthlyAnalysisTarget: 0,
  monthlyProposalTarget: 0,
  monthlyIntroductionRequestTarget: 0,
  primaryCustomerSegment: null,
  monthlyPreparationStatus: null,
  complianceCheckMemo: null,
  managerComment: null,
  status: "draft" as const,
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleWeekly = {
  id: 200,
  monthlyPlanId: 100,
  userId: 4,
  weekStartDate: new Date("2026-06-01"),
  weekEndDate: new Date("2026-06-07"),
  weekLabel: "1주차",
  weeklyContractTarget: 1,
  weeklyPremiumTarget: 50000,
  weeklyConsultationTarget: 5,
  weeklyCallTarget: 20,
  weeklyMessageTarget: 10,
  weeklyVisitTarget: 2,
  weeklyProposalTarget: 1,
  weeklyFollowUpTarget: 3,
  focusCustomerGroup: "신규 DB",
  weeklyActionPlan: "상담 집중",
  preparationMemo: "",
  expectedRisk: "",
  supportRequest: "",
  privacyMinimizedConfirmed: true,
  targetMonth: "2026-06",
  weekNumber: 1,
  targetCustomerSegment: null,
  targetCustomerReference: null,
  customerStage: null,
  proposedProductCategory: null,
  proposedCoverageArea: null,
  proposalPurpose: null,
  preparationMaterials: null,
  weeklyRevenueTarget: 0,
  weeklyAnalysisTarget: 0,
  weeklyIntroductionRequestTarget: 0,
  weeklyReconnectTarget: 0,
  complianceRiskCheck: null,
  weeklyReviewMemo: null,
  nextWeekImprovement: null,
  coachingRequest: null,
  managerComment: null,
  status: "draft" as const,
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleDaily = {
  id: 300,
  weeklyPlanId: 200,
  userId: 4,
  planDate: new Date("2026-06-02"),
  callTarget: 10,
  messageTarget: 5,
  consultationTarget: 2,
  visitTarget: 1,
  proposalTarget: 1,
  followUpTarget: 2,
  todayPriority: "신규 DB 콜",
  preparationMemo: "",
  actualCallCount: 8,
  actualMessageCount: 4,
  actualConsultationCount: 1,
  actualVisitCount: 0,
  actualProposalCount: 0,
  actualFollowUpCount: 1,
  actualResultMemo: "양호",
  nextDayMemo: "방문 추가",
  privacyMinimizedConfirmed: true,
  targetMonth: "2026-06",
  weekNumber: 1,
  targetCustomerSegment: null,
  targetCustomerReference: null,
  customerStage: null,
  proposedProductCategory: null,
  proposedCoverageArea: null,
  proposalPurpose: null,
  preparationMaterials: null,
  dailyRevenueTarget: 0,
  newContactTarget: 0,
  analysisTarget: 0,
  introductionRequestTarget: 0,
  reconnectTarget: 0,
  contractTarget: 0,
  actualNewContactCount: 0,
  actualAnalysisCount: 0,
  actualIntroductionRequestCount: 0,
  actualReconnectCount: 0,
  actualContractCount: 0,
  complianceRiskCheck: null,
  managerComment: null,
  status: "draft" as const,
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("actionPlans RBAC", () => {
  it("allows member to create own monthly plan", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanByUserMonth").mockResolvedValue(
      undefined
    );
    vi.spyOn(actionPlansDb, "createBranchActionPlan").mockResolvedValue({
      ...sampleMonthly,
      userId: 4,
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.createMonthlyPlan({
        targetMonth: "2026-06",
        monthlyContractTarget: 1,
        monthlyPremiumTarget: 50000,
        monthlyConsultationTarget: 5,
        monthlyCallTarget: 20,
        monthlyMessageTarget: 10,
        monthlyFollowUpTarget: 2,
        focusCustomerGroup: "신규 DB",
        preparationMemo: "준비",
        expectedRisk: "리스크",
        supportRequest: "지원",
      });
    expect(result?.userId).toBe(4);
  });

  it("persists all monthly text fields on update", async () => {
    const updateSpy = vi
      .spyOn(actionPlansDb, "updateBranchActionPlan")
      .mockResolvedValue(sampleMonthly as any);
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue({
      ...sampleMonthly,
      userId: 4,
      status: "draft",
    } as any);

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.updateMonthlyPlan({
        id: 100,
        targetMonth: "2026-06",
        monthlyContractTarget: 3,
        monthlyPremiumTarget: 120000,
        monthlyConsultationTarget: 12,
        monthlyCallTarget: 40,
        monthlyMessageTarget: 25,
        monthlyFollowUpTarget: 8,
        focusCustomerGroup: "재접촉 DB",
        monthlyStrategy: "상담 확대",
        preparationMemo: "자료 업데이트",
        expectedRisk: "일정 충돌",
        supportRequest: "교육 요청",
      });

    expect(updateSpy).toHaveBeenCalledWith(
      100,
      expect.objectContaining({
        monthlyMessageTarget: 25,
        monthlyFollowUpTarget: 8,
        focusCustomerGroup: "재접촉 DB",
        preparationMemo: "자료 업데이트",
      })
    );
  });

  it("blocks member from viewing another user monthly plan", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .actionPlans.getMonthlyPlan({ userId: 99, targetMonth: "2026-06" })
    ).rejects.toThrow();
  });

  it("blocks member from updating after submit", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue({
      ...sampleMonthly,
      userId: 4,
      status: "submitted",
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .actionPlans.updateMonthlyPlan({
          id: 100,
          targetMonth: "2026-06",
          monthlyContractTarget: 3,
          monthlyPremiumTarget: 0,
          monthlyConsultationTarget: 0,
          monthlyCallTarget: 0,
          monthlyMessageTarget: 0,
          monthlyFollowUpTarget: 0,
        })
    ).rejects.toThrow();
  });

  it("allows member to update when revision_requested", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue({
      ...sampleMonthly,
      userId: 4,
      status: "revision_requested",
    } as any);
    vi.spyOn(actionPlansDb, "updateBranchActionPlan").mockResolvedValue({
      ...sampleMonthly,
      status: "revision_requested",
    } as any);
    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.updateMonthlyPlan({
        id: 100,
        targetMonth: "2026-06",
        monthlyContractTarget: 3,
        monthlyPremiumTarget: 0,
        monthlyConsultationTarget: 0,
        monthlyCallTarget: 0,
        monthlyMessageTarget: 0,
        monthlyFollowUpTarget: 0,
      });
    expect(result?.status).toBe("revision_requested");
  });

  it("allows team_leader to view scoped user plan", async () => {
    vi.spyOn(routers, "getHierarchyScopeUserIds").mockResolvedValue([3, 4]);
    vi.spyOn(actionPlansDb, "getBranchActionPlanByUserMonth").mockResolvedValue(
      sampleMonthly as any
    );
    const result = await appRouter
      .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
      .actionPlans.getMonthlyPlan({ userId: 4, targetMonth: "2026-06" });
    expect(result?.userId).toBe(4);
  });

  it("blocks team_leader from out-of-scope plan", async () => {
    vi.spyOn(routers, "getHierarchyScopeUserIds").mockResolvedValue([3, 4]);
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3, teamId: 10 }))
        .actionPlans.getMonthlyPlan({ userId: 99, targetMonth: "2026-06" })
    ).rejects.toThrow();
  });

  it("allows sub_branch_admin to view scoped user plan", async () => {
    vi.spyOn(routers, "getHierarchyScopeUserIds").mockResolvedValue([2, 4]);
    vi.spyOn(actionPlansDb, "getBranchActionPlanByUserMonth").mockResolvedValue(
      sampleMonthly as any
    );
    const result = await appRouter
      .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
      .actionPlans.getMonthlyPlan({ userId: 4, targetMonth: "2026-06" });
    expect(result?.userId).toBe(4);
  });

  it("blocks sub_branch_admin from out-of-scope plan", async () => {
    vi.spyOn(routers, "getHierarchyScopeUserIds").mockResolvedValue([2, 4]);
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .actionPlans.getMonthlyPlan({ userId: 99, targetMonth: "2026-06" })
    ).rejects.toThrow();
  });

  it("blocks member from viewing another user weekly/daily plan", async () => {
    vi.spyOn(actionPlansDb, "getWeeklyActionPlanById").mockResolvedValue({
      ...sampleWeekly,
      userId: 4,
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 99 }))
        .actionPlans.getDailyPlans({ weeklyPlanId: 200 })
    ).rejects.toThrow();
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue({
      ...sampleMonthly,
      userId: 4,
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 99 }))
        .actionPlans.getWeeklyPlans({ monthlyPlanId: 100 })
    ).rejects.toThrow();
  });

  it("blocks sub_branch_admin from executive download", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("sub_branch_admin", { userId: 2 }))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 회의",
        })
    ).rejects.toThrow();
  });

  it("blocks team_leader from executive download", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("team_leader", { userId: 3 }))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 회의",
        })
    ).rejects.toThrow();
  });

  it("blocks member from executive download", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 회의",
        })
    ).rejects.toThrow();
  });

  it("blocks inactive users", async () => {
    const ctx: TrpcContext = {
      ...createCtx("member"),
      user: { ...createCtx("member").user!, accountStatus: "inactive" } as any,
    };
    await expect(
      appRouter.createCaller(ctx).actionPlans.getMyMonthlyPlans()
    ).rejects.toThrow();
  });

  it("blocks download without reason", async () => {
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "짧음",
        })
    ).rejects.toThrow();
  });

  it("allows branch_admin executive preview", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active", name: "지점장" },
      { id: 4, role: "member", accountStatus: "active", name: "팀원A" },
    ] as any);
    vi.spyOn(actionPlansDb, "getBranchActionPlansByUserIds").mockResolvedValue([
      sampleMonthly,
    ] as any);
    vi.spyOn(
      actionPlansDb,
      "getWeeklyPlansForMonthByUserIds"
    ).mockResolvedValue([]);
    vi.spyOn(actionPlansDb, "getDailyPlansForWeeklyIds").mockResolvedValue([]);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .actionPlans.getExecutiveReportPreview({
        reportMonth: "2026-06",
        reportWeekLabel: "1주차",
      });
    expect(result.userCount).toBeGreaterThan(0);
  });

  it("records activity log on executive download", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active", name: "지점장" },
    ] as any);
    vi.spyOn(actionPlansDb, "getBranchActionPlansByUserIds").mockResolvedValue(
      []
    );
    vi.spyOn(
      actionPlansDb,
      "getWeeklyPlansForMonthByUserIds"
    ).mockResolvedValue([]);
    vi.spyOn(actionPlansDb, "getDailyPlansForWeeklyIds").mockResolvedValue([]);
    vi.spyOn(
      actionPlansDb,
      "createExecutiveActionPlanReport"
    ).mockResolvedValue({ id: 501 } as any);
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);

    await appRouter
      .createCaller(createCtx("branch_admin"))
      .actionPlans.downloadExecutiveReportXlsx({
        reportMonth: "2026-06",
        reportWeekLabel: "1주차",
        downloadReason: "월간 대표 보고 회의 자료",
      });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXECUTIVE_ACTION_PLAN_REPORT_DOWNLOADED",
      })
    );
    const details = JSON.parse(
      String(logSpy.mock.calls[0]?.[0]?.details ?? "{}")
    );
    expect(details.reason).toBeUndefined();
    expect(details.downloadReason).toBeUndefined();
  });

  it("shows unsubmitted users in submission status", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active", name: "지점장" },
      { id: 4, role: "member", accountStatus: "active", name: "미제출" },
    ] as any);
    vi.spyOn(actionPlansDb, "getBranchActionPlansByUserIds").mockResolvedValue(
      []
    );
    vi.spyOn(
      actionPlansDb,
      "getWeeklyPlansForMonthByUserIds"
    ).mockResolvedValue([]);
    vi.spyOn(actionPlansDb, "getDailyPlansForWeeklyIds").mockResolvedValue([]);

    const result = await appRouter
      .createCaller(createCtx("branch_admin"))
      .actionPlans.getSubmissionStatus({ targetMonth: "2026-06" });
    expect(result.notSubmitted.some(u => u.id === 4)).toBe(true);
  });
});

describe("actionPlans weekly/daily workflow", () => {
  it("creates weekly plan", async () => {
    vi.spyOn(actionPlansDb, "getBranchActionPlanById").mockResolvedValue({
      ...sampleMonthly,
      userId: 4,
    } as any);
    vi.spyOn(actionPlansDb, "createWeeklyActionPlan").mockResolvedValue(
      sampleWeekly as any
    );
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.createWeeklyPlan({
        monthlyPlanId: 100,
        weekLabel: "1주차",
        weekStartDate: "2026-06-01",
        weekEndDate: "2026-06-07",
        weeklyContractTarget: 1,
        weeklyPremiumTarget: 50000,
        weeklyConsultationTarget: 5,
        weeklyCallTarget: 20,
        weeklyMessageTarget: 10,
        weeklyVisitTarget: 2,
        weeklyProposalTarget: 1,
        weeklyFollowUpTarget: 3,
      });
    expect(result?.id).toBe(200);
  });

  it("updates weekly plan", async () => {
    vi.spyOn(actionPlansDb, "getWeeklyActionPlanById").mockResolvedValue({
      ...sampleWeekly,
      userId: 4,
      status: "draft",
    } as any);
    vi.spyOn(actionPlansDb, "updateWeeklyActionPlan").mockResolvedValue(
      sampleWeekly as any
    );

    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.updateWeeklyPlan({
        id: 200,
        monthlyPlanId: 100,
        weekLabel: "1주차",
        weekStartDate: "2026-06-01",
        weekEndDate: "2026-06-07",
        weeklyContractTarget: 2,
        weeklyPremiumTarget: 60000,
        weeklyConsultationTarget: 6,
        weeklyCallTarget: 25,
        weeklyMessageTarget: 12,
        weeklyVisitTarget: 3,
        weeklyProposalTarget: 2,
        weeklyFollowUpTarget: 4,
      });
    expect(actionPlansDb.updateWeeklyActionPlan).toHaveBeenCalled();
  });

  it("submits weekly plan", async () => {
    vi.spyOn(actionPlansDb, "getWeeklyActionPlanById").mockResolvedValue({
      ...sampleWeekly,
      userId: 4,
      status: "draft",
    } as any);
    vi.spyOn(actionPlansDb, "updateWeeklyActionPlan").mockResolvedValue({
      ...sampleWeekly,
      status: "submitted",
    } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.submitWeeklyPlan({ id: 200 });
    expect(result?.status).toBe("submitted");
  });

  it("blocks weekly update after submit", async () => {
    vi.spyOn(actionPlansDb, "getWeeklyActionPlanById").mockResolvedValue({
      ...sampleWeekly,
      userId: 4,
      status: "submitted",
    } as any);
    await expect(
      appRouter
        .createCaller(createCtx("member", { userId: 4 }))
        .actionPlans.updateWeeklyPlan({
          id: 200,
          monthlyPlanId: 100,
          weekLabel: "1주차",
          weekStartDate: "2026-06-01",
          weekEndDate: "2026-06-07",
          weeklyContractTarget: 2,
          weeklyPremiumTarget: 0,
          weeklyConsultationTarget: 0,
          weeklyCallTarget: 0,
          weeklyMessageTarget: 0,
          weeklyVisitTarget: 0,
          weeklyProposalTarget: 0,
          weeklyFollowUpTarget: 0,
        })
    ).rejects.toThrow();
  });

  it("creates daily plan", async () => {
    vi.spyOn(actionPlansDb, "getWeeklyActionPlanById").mockResolvedValue({
      ...sampleWeekly,
      userId: 4,
    } as any);
    vi.spyOn(actionPlansDb, "createDailyActionPlan").mockResolvedValue(
      sampleDaily as any
    );
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const result = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.createDailyPlan({
        weeklyPlanId: 200,
        planDate: "2026-06-02",
        callTarget: 10,
        messageTarget: 5,
        consultationTarget: 2,
        visitTarget: 1,
        proposalTarget: 1,
        followUpTarget: 2,
      });
    expect(result?.id).toBe(300);
  });

  it("updates and submits daily plan", async () => {
    vi.spyOn(actionPlansDb, "getDailyActionPlanById").mockResolvedValue({
      ...sampleDaily,
      userId: 4,
      status: "revision_requested",
    } as any);
    vi.spyOn(actionPlansDb, "updateDailyActionPlan").mockResolvedValue(
      sampleDaily as any
    );
    await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.updateDailyPlan({
        id: 300,
        weeklyPlanId: 200,
        planDate: "2026-06-02",
        callTarget: 12,
        messageTarget: 6,
        consultationTarget: 3,
        visitTarget: 1,
        proposalTarget: 1,
        followUpTarget: 2,
      });
    vi.spyOn(actionPlansDb, "getDailyActionPlanById").mockResolvedValue({
      ...sampleDaily,
      userId: 4,
      status: "draft",
    } as any);
    vi.spyOn(actionPlansDb, "updateDailyActionPlan").mockResolvedValue({
      ...sampleDaily,
      status: "submitted",
    } as any);
    const submitted = await appRouter
      .createCaller(createCtx("member", { userId: 4 }))
      .actionPlans.submitDailyPlan({ id: 300 });
    expect(submitted?.status).toBe("submitted");
  });
});

describe("executive report sensitive data guard", () => {
  function mockReportData() {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active", name: "지점장" },
    ] as any);
    vi.spyOn(actionPlansDb, "getBranchActionPlansByUserIds").mockResolvedValue(
      []
    );
    vi.spyOn(
      actionPlansDb,
      "getWeeklyPlansForMonthByUserIds"
    ).mockResolvedValue([]);
    vi.spyOn(actionPlansDb, "getDailyPlansForWeeklyIds").mockResolvedValue([]);
  }

  it("rejects keyRisks with phone number", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          keyRisks: "담당 010-1234-5678 확인",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("rejects supportRequest with disease/product/premium wording", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          supportRequest: "실손보험 월납보험료 120000 원 조정",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("rejects executiveMessage with email or rrn-like pattern", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          executiveMessage: "연락 admin@test.com 또는 900101-1234567",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("rejects downloadReason with sensitive data", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "고객 01099998888 자료 출력",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("rejects keyRisks with customer label name", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          keyRisks: "고객명 홍길동 관련 리스크",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("rejects supportRequest with contractor label name", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          supportRequest: "계약자 김철수 건 지원 요청",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("rejects executiveMessage with insured label name", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          executiveMessage: "피보험자 이영희 건 확인 필요",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("rejects downloadReason with customer label name", async () => {
    mockReportData();
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "고객명 홍길동 보고용",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
  });

  it("does not save executive report when sensitive data detected", async () => {
    mockReportData();
    const saveSpy = vi
      .spyOn(actionPlansDb, "createExecutiveActionPlanReport")
      .mockResolvedValue({ id: 999 } as any);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          keyRisks: "01012345678",
        })
    ).rejects.toThrow();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("does not generate XLSX when customer label name detected", async () => {
    mockReportData();
    const xlsxSpy = vi.spyOn(
      executiveReport,
      "buildExecutiveActionPlanXlsxBuffer"
    );
    const saveSpy = vi.spyOn(actionPlansDb, "createExecutiveActionPlanReport");
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
          executiveMessage: "계약자 홍길동",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
    expect(xlsxSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("does not store sensitive text in activity log on label block", async () => {
    mockReportData();
    const logSpy = vi
      .spyOn(db, "createActivityLog")
      .mockResolvedValue(undefined);
    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "고객명 홍길동 보고",
        })
    ).rejects.toThrow();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("rejects report with phone patterns in stored plan text", async () => {
    vi.spyOn(db, "getAllUsers").mockResolvedValue([
      { id: 1, role: "branch_admin", accountStatus: "active", name: "지점장" },
      { id: 4, role: "member", accountStatus: "active", name: "팀원" },
    ] as any);
    vi.spyOn(actionPlansDb, "getBranchActionPlansByUserIds").mockResolvedValue([
      {
        ...sampleMonthly,
        monthlyStrategy: "연락 010-1234-5678",
      },
    ] as any);
    vi.spyOn(
      actionPlansDb,
      "getWeeklyPlansForMonthByUserIds"
    ).mockResolvedValue([]);
    vi.spyOn(actionPlansDb, "getDailyPlansForWeeklyIds").mockResolvedValue([]);
    const saveSpy = vi.spyOn(actionPlansDb, "createExecutiveActionPlanReport");

    await expect(
      appRouter
        .createCaller(createCtx("branch_admin"))
        .actionPlans.downloadExecutiveReportXlsx({
          reportMonth: "2026-06",
          reportWeekLabel: "1주차",
          downloadReason: "대표 보고 자료 생성",
        })
    ).rejects.toThrow(ACTION_PLAN_SENSITIVE_ERROR);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
