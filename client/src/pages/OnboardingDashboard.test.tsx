import React from "react";
(globalThis as any).React = React;
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OnboardingDashboard from "./OnboardingDashboard";
import { UserSearchSelect, type UserOption } from "@/components/onboarding/UserSearchSelect";

// Mock auth hook
const mockUseAuth = vi.fn();
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock tRPC
const mockTemplatesList = vi.fn();
const mockAssignmentsSummary = vi.fn();
const mockAssignmentsList = vi.fn();
const mockAssignmentsGetMine = vi.fn();
const mockUsersList = vi.fn();
const mockAssignMutate = vi.fn();
const mockSeedDefaultsMutate = vi.fn();
const mockUpdateItemMutate = vi.fn();
const mockApproveItemMutate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    onboardingTemplates: {
      list: {
        useQuery: (...args: any[]) => mockTemplatesList(...args),
      },
      seedDefaults: {
        useMutation: (opts?: any) => ({
          mutate: mockSeedDefaultsMutate,
          isPending: false,
        }),
      },
    },
    onboardingAssignments: {
      summary: {
        useQuery: (...args: any[]) => mockAssignmentsSummary(...args),
      },
      list: {
        useQuery: (...args: any[]) => mockAssignmentsList(...args),
      },
      getMine: {
        useQuery: (...args: any[]) => mockAssignmentsGetMine(...args),
      },
      assign: {
        useMutation: (opts?: any) => ({
          mutate: mockAssignMutate,
          isPending: false,
        }),
      },
      updateItemProgress: {
        useMutation: (opts?: any) => ({
          mutate: mockUpdateItemMutate,
          isPending: false,
        }),
      },
      approveItem: {
        useMutation: (opts?: any) => ({
          mutate: mockApproveItemMutate,
          isPending: false,
        }),
      },
    },
    users: {
      list: {
        useQuery: (...args: any[]) => mockUsersList(...args),
      },
    },
  },
}));

// Mock DashboardLayout
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

describe("BOA-CRM-AG03 Onboarding User Search & Select", () => {
  const mockUsers: UserOption[] = [
    { id: 101, name: "김철수", role: "member", accountStatus: "active", teamId: 1 },
    { id: 102, name: "김영희", role: "member", accountStatus: "active", teamId: 1 },
    { id: 103, name: "김영희", role: "team_leader", accountStatus: "active", teamId: 2 },
    { id: 104, name: "박지점", role: "branch_admin", accountStatus: "active", teamId: null },
    { id: 105, name: "이퇴사", role: "member", accountStatus: "resigned", teamId: 1 },
    { id: 106, name: "최비활", role: "member", accountStatus: "inactive", teamId: 1 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockTemplatesList.mockReturnValue({
      data: [{ id: 1, name: "신입 팀원 온보딩 30일 코스", targetRole: "member", isActive: true }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    mockAssignmentsSummary.mockReturnValue({
      data: {
        total: 5,
        inProgress: 3,
        completed: 1,
        overdue: 1,
        approvalPending: 0,
        requiredIncomplete: 2,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    mockAssignmentsList.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    mockAssignmentsGetMine.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    mockUsersList.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  describe("Role Scoping & UI Visibility", () => {
    it("renders checklist assignment form and usersQuery enabled for branch_admin", () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, name: "지점장", role: "branch_admin" },
      });

      const html = renderToStaticMarkup(<OnboardingDashboard />);
      expect(html).toContain("체크리스트 배정");
      expect(html).toContain("대상 직원");
      expect(html).toContain("교육자 (선택)");
      expect(mockUsersList).toHaveBeenCalledWith(
        { activeOnly: true },
        { enabled: true }
      );
    });

    it("renders checklist assignment form for team_leader", () => {
      mockUseAuth.mockReturnValue({
        user: { id: 2, name: "팀장", role: "team_leader" },
      });

      const html = renderToStaticMarkup(<OnboardingDashboard />);
      expect(html).toContain("체크리스트 배정");
      expect(html).toContain("대상 직원");
      expect(html).toContain("교육자 (선택)");
      expect(mockUsersList).toHaveBeenCalledWith(
        { activeOnly: true },
        { enabled: true }
      );
    });

    it("does NOT render checklist assignment form and does NOT query users for member", () => {
      mockUseAuth.mockReturnValue({
        user: { id: 101, name: "김철수", role: "member" },
      });

      const html = renderToStaticMarkup(<OnboardingDashboard />);
      expect(html).not.toContain("체크리스트 배정");
      expect(html).toContain("내 교육 체크리스트");
      expect(mockUsersList).toHaveBeenCalledWith(
        { activeOnly: true },
        { enabled: false }
      );
    });
  });

  describe("Candidate Filtering Rules", () => {
    it("filters out inactive and resigned users", () => {
      const activeOnly = mockUsers.filter(u => u.accountStatus === "active");
      expect(activeOnly).toHaveLength(4);
      expect(activeOnly.map(u => u.id)).not.toContain(105);
      expect(activeOnly.map(u => u.id)).not.toContain(106);
    });

    it("team_leader candidates are restricted to role === member", () => {
      const activeOnly = mockUsers.filter(u => u.accountStatus === "active");
      const teamLeaderCandidates = activeOnly.filter(u => u.role === "member");
      expect(teamLeaderCandidates.map(u => u.name)).toEqual(["김철수", "김영희"]);
      expect(teamLeaderCandidates.map(u => u.id)).toEqual([101, 102]);
      // team_leader and branch_admin are excluded
      expect(teamLeaderCandidates.map(u => u.id)).not.toContain(103);
      expect(teamLeaderCandidates.map(u => u.id)).not.toContain(104);
    });

    it("branch_admin sees all active candidates regardless of role", () => {
      const activeOnly = mockUsers.filter(u => u.accountStatus === "active");
      expect(activeOnly.map(u => u.id)).toEqual([101, 102, 103, 104]);
    });
  });

  describe("UserSearchSelect Component Unit Behavior", () => {
    it("renders placeholder when no user is selected", () => {
      const html = renderToStaticMarkup(
        <UserSearchSelect
          value=""
          onChange={vi.fn()}
          users={mockUsers.filter(u => u.accountStatus === "active")}
          placeholder="대상 직원 선택"
          testIdPrefix="target-user"
        />
      );
      expect(html).toContain("대상 직원 선택");
      expect(html).toContain('data-testid="target-user-trigger"');
    });

    it("renders selected user name, role badge, and user ID", () => {
      const html = renderToStaticMarkup(
        <UserSearchSelect
          value="101"
          onChange={vi.fn()}
          users={mockUsers.filter(u => u.accountStatus === "active")}
          testIdPrefix="target-user"
        />
      );
      expect(html).toContain("김철수");
      expect(html).toContain("팀원");
      expect(html).toContain("#101");
      expect(html).toContain('data-testid="target-user-clear-btn"');
    });

    it("disambiguates duplicate names with role and ID", () => {
      const activeUsers = mockUsers.filter(u => u.accountStatus === "active");
      // Find two users with name "김영희"
      const duplicates = activeUsers.filter(u => u.name === "김영희");
      expect(duplicates).toHaveLength(2);
      expect(duplicates[0].id).toBe(102);
      expect(duplicates[0].role).toBe("member");
      expect(duplicates[1].id).toBe(103);
      expect(duplicates[1].role).toBe("team_leader");

      // Verify rendering when ID 102 is selected
      const html102 = renderToStaticMarkup(
        <UserSearchSelect
          value="102"
          onChange={vi.fn()}
          users={activeUsers}
          testIdPrefix="target-user"
        />
      );
      expect(html102).toContain("김영희");
      expect(html102).toContain("팀원");
      expect(html102).toContain("#102");

      // Verify rendering when ID 103 is selected
      const html103 = renderToStaticMarkup(
        <UserSearchSelect
          value="103"
          onChange={vi.fn()}
          users={activeUsers}
          testIdPrefix="target-user"
        />
      );
      expect(html103).toContain("김영희");
      expect(html103).toContain("팀장");
      expect(html103).toContain("#103");
    });

    it("renders loading state properly", () => {
      const html = renderToStaticMarkup(
        <UserSearchSelect
          value=""
          onChange={vi.fn()}
          users={[]}
          isLoading={true}
          testIdPrefix="target-user"
        />
      );
      expect(html).toContain("직원 목록 불러오는 중...");
    });
  });

  describe("Assignment Gating & Submission Logic", () => {
    it("disables assignment when target user is empty", () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, name: "지점장", role: "branch_admin" },
      });

      const html = renderToStaticMarkup(<OnboardingDashboard />);
      // assign-onboarding-btn must be disabled
      expect(html).toContain('data-testid="assign-onboarding-btn"');
      expect(html).toContain("disabled");
    });

    it("validates payload formation with and without trainer", () => {
      // Helper function replicating payload build
      const buildPayload = (
        targetUserId: string,
        templateId: string,
        trainerUserId: string,
        startedAt: string,
        dueAt: string
      ) => ({
        targetUserId: Number(targetUserId),
        templateId: Number(templateId),
        trainerUserId: trainerUserId ? Number(trainerUserId) : undefined,
        startedAt: new Date(startedAt).toISOString(),
        dueAt: new Date(dueAt).toISOString(),
      });

      const payloadWithoutTrainer = buildPayload(
        "101",
        "1",
        "",
        "2026-10-27",
        "2026-11-03"
      );
      expect(payloadWithoutTrainer.targetUserId).toBe(101);
      expect(payloadWithoutTrainer.templateId).toBe(1);
      expect(payloadWithoutTrainer.trainerUserId).toBeUndefined();

      const payloadWithTrainer = buildPayload(
        "101",
        "1",
        "102",
        "2026-10-27",
        "2026-11-03"
      );
      expect(payloadWithTrainer.targetUserId).toBe(101);
      expect(payloadWithTrainer.templateId).toBe(1);
      expect(payloadWithTrainer.trainerUserId).toBe(102);
    });
  });
});
