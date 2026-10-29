import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

const users = [
  { id: 1, role: "branch_admin", teamId: null, subBranchAdminId: null },
  { id: 2, role: "sub_branch_admin", teamId: null, subBranchAdminId: null },
  { id: 3, role: "team_leader", teamId: 30, subBranchAdminId: 2 },
  { id: 4, role: "member", teamId: 30, subBranchAdminId: 2 },
  { id: 5, role: "member", teamId: 30, subBranchAdminId: 2, accountStatus: "inactive" },
  { id: 6, role: "member", teamId: 30, subBranchAdminId: 2, accountStatus: "resigned" },
  { id: 20, role: "sub_branch_admin", teamId: null, subBranchAdminId: null },
  { id: 40, role: "team_leader", teamId: 40, subBranchAdminId: 20 },
  { id: 41, role: "member", teamId: 40, subBranchAdminId: 20 },
].map(user => ({
  name: `[TEST] user ${user.id}`,
  accountStatus: "active",
  parentUserId: null,
  email: "must-not-leak@example.invalid",
  phone: "must-not-leak",
  memo: "must-not-leak",
  openId: "must-not-leak",
  ...user,
}));

function context(id: number, overrides: Record<string, unknown> = {}): TrpcContext {
  return {
    user: { ...users.find(user => user.id === id), ...overrides } as any,
    req: { protocol: "https", headers: {} } as any,
    res: {} as any,
  };
}

const assignmentInput = {
  targetUserId: 4,
  templateId: 10,
  startedAt: "2026-10-29T00:00:00.000Z",
  dueAt: "2026-11-05T00:00:00.000Z",
};
const items = [
  { id: 100, templateId: 10, title: "[TEST] review", required: true, isActive: true, requiresManagerApproval: true },
  { id: 101, templateId: 10, title: "[TEST] practice", required: false, isActive: true, requiresManagerApproval: false },
];
const assignment = {
  id: 900, targetUserId: 4, templateId: 10, assignedBy: 3, trainerUserId: 4,
  dueAt: new Date("2026-11-05T00:00:00.000Z"), status: "assigned",
};
let progress: any[];

beforeEach(() => {
  vi.spyOn(db, "getAllUsers").mockResolvedValue(users as any);
  vi.spyOn(db, "getAllTeams").mockResolvedValue([
    { id: 30, managerId: null, subBranchAdminId: 2 },
    { id: 40, managerId: 40, subBranchAdminId: 20 },
  ] as any);
  vi.spyOn(db, "getUsersByTeamId").mockImplementation(async teamId =>
    users.filter(user => user.teamId === teamId) as any);
  vi.spyOn(db, "getUsersBySubBranchAdminId").mockImplementation(async id =>
    users.filter(user => user.subBranchAdminId === id) as any);
  vi.spyOn(db, "getUserById").mockImplementation(async id => users.find(user => user.id === id) as any);
  vi.spyOn(db, "getOnboardingTemplateById").mockResolvedValue({
    id: 10, name: "[TEST] template", targetRole: "member", isActive: true, archivedAt: null,
  } as any);
  vi.spyOn(db, "getOnboardingTemplateItems").mockResolvedValue(items as any);
  vi.spyOn(db, "createOnboardingAssignment").mockResolvedValue({ id: 900 } as any);
  vi.spyOn(db, "createOnboardingItemProgressRows").mockResolvedValue(undefined);
  vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined as any);
  vi.spyOn(db, "getOnboardingAssignments").mockResolvedValue([assignment] as any);
  vi.spyOn(db, "getOnboardingAssignmentById").mockResolvedValue(assignment as any);
  vi.spyOn(db, "updateOnboardingAssignment").mockResolvedValue(undefined);
  progress = [
    { id: 1000, assignmentId: 900, itemId: 100, status: "pending" },
    { id: 1001, assignmentId: 900, itemId: 101, status: "skipped" },
  ];
  vi.spyOn(db, "getOnboardingItemProgressByAssignment").mockImplementation(async () => progress as any);
  vi.spyOn(db, "getOnboardingItemProgressById").mockImplementation(async id => progress.find(row => row.id === id));
  vi.spyOn(db, "updateOnboardingItemProgress").mockImplementation(async (id, changes) => {
    Object.assign(progress.find(row => row.id === id)!, changes);
  });
});
afterEach(() => vi.restoreAllMocks());

describe("onboarding assignment candidates use the assignment API's real hierarchy scope", () => {
  it("restores a team member when teamId exists but teams.managerId is unset", async () => {
    const caller = appRouter.createCaller(context(3));
    // Reproduce why the former general users.list source was insufficient.
    expect((await caller.users.list({ activeOnly: true })).map(user => user.id)).toEqual([3]);
    await expect(caller.onboardingAssignments.assign(assignmentInput)).resolves.toEqual({ assignmentId: 900 });
    const candidates = await (caller.onboardingAssignments as any).assignmentCandidates();
    expect(candidates.map((user: any) => user.id)).toEqual([4]);
    expect(db.getUsersByTeamId).toHaveBeenCalledWith(30);
  });

  it.each([
    [1, [1, 2, 3, 4, 20, 40, 41]],
    [2, [2, 3, 4]],
    [3, [4]],
    [20, [20, 40, 41]],
    [40, [41]],
  ])("keeps actor %i inside the existing scope", async (id, expected) => {
    const rows = await (appRouter.createCaller(context(id)).onboardingAssignments as any).assignmentCandidates();
    expect(rows.map((row: any) => row.id)).toEqual(expected);
    expect(rows.every((row: any) => row.accountStatus === "active")).toBe(true);
    expect(rows.map((row: any) => row.id)).not.toContain(5);
    expect(rows.map((row: any) => row.id)).not.toContain(6);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["accountStatus", "id", "name", "role", "subBranchAdminId", "teamId"]);
      expect(JSON.stringify(row)).not.toContain("must-not-leak");
    }
  });

  it("uses parent hierarchy when it exists instead of widening to all same-team users", async () => {
    vi.mocked(db.getAllTeams).mockResolvedValue([{ id: 30, managerId: 3, subBranchAdminId: 2 }] as any);
    const rows = await (appRouter.createCaller(context(3)).onboardingAssignments as any).assignmentCandidates();
    expect(rows.map((row: any) => row.id)).toEqual([4]);
    expect(db.getUsersByTeamId).not.toHaveBeenCalled();
  });

  it.each([4, 5, 6])("rejects member/inactive/resigned actor %i before reading candidates", async id => {
    const call = (appRouter.createCaller(context(id)).onboardingAssignments as any).assignmentCandidates();
    await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getAllUsers).not.toHaveBeenCalled();
  });

  it.each(["inactive", "resigned"])("rejects an %s manager", async accountStatus => {
    await expect((appRouter.createCaller(context(3, { accountStatus })).onboardingAssignments as any).assignmentCandidates())
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getAllUsers).not.toHaveBeenCalled();
  });

  it("rejects an anonymous direct API call", async () => {
    await expect((appRouter.createCaller({ ...context(3), user: null }).onboardingAssignments as any).assignmentCandidates())
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each([5, 6, 41, 3])("does not weaken the assign guard for target %i", async targetUserId => {
    await expect(appRouter.createCaller(context(3)).onboardingAssignments.assign({ ...assignmentInput, targetUserId }))
      .rejects.toMatchObject({ code: [5, 6].includes(targetUserId) ? "BAD_REQUEST" : "FORBIDDEN" });
    expect(db.createOnboardingAssignment).not.toHaveBeenCalled();
  });

  it("preserves optional trainer authorization and the real assignment payload", async () => {
    const caller = appRouter.createCaller(context(3));
    await expect(caller.onboardingAssignments.assign({ ...assignmentInput, trainerUserId: 41 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createOnboardingAssignment).not.toHaveBeenCalled();
    await caller.onboardingAssignments.assign({ ...assignmentInput, trainerUserId: 4 });
    expect(db.createOnboardingAssignment).toHaveBeenCalledWith(expect.objectContaining({
      targetUserId: 4, trainerUserId: 4, assignedBy: 3, templateId: 10,
      startedAt: new Date(assignmentInput.startedAt), dueAt: new Date(assignmentInput.dueAt),
      requiredPendingCount: 1,
    }));
    expect(db.createOnboardingItemProgressRows).toHaveBeenCalledWith([
      { assignmentId: 900, itemId: 100, status: "pending" },
      { assignmentId: 900, itemId: 101, status: "pending" },
    ]);
  });

  it("rejects a foreign sub-branch target and invalid assignment dates without writing", async () => {
    await expect(appRouter.createCaller(context(2)).onboardingAssignments.assign({ ...assignmentInput, targetUserId: 41 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context(3)).onboardingAssignments.assign({ ...assignmentInput, dueAt: "2026-10-01" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createOnboardingAssignment).not.toHaveBeenCalled();
  });
});

describe("onboarding scope, progress and read regressions", () => {
  it("builds actual assignment details and confines list queries to actor scope", async () => {
    const rows = await appRouter.createCaller(context(3)).onboardingAssignments.list();
    expect(db.getOnboardingAssignments).toHaveBeenCalledWith({ targetUserIds: [3, 4], includeArchived: false, status: undefined });
    expect(rows[0]).toMatchObject({ id: 900, targetUser: { id: 4 }, trainer: { id: 4 }, items: [{ id: 100 }, { id: 101 }] });
    expect(rows[0]?.targetUser).not.toHaveProperty("email");
    expect(rows[0]?.trainer).not.toHaveProperty("phone");
  });

  it("allows an owner to request approval and recalculates pending counts", async () => {
    const result = await appRouter.createCaller(context(4)).onboardingAssignments.updateItemProgress({ assignmentId: 900, itemId: 100, note: "[TEST] practiced" });
    expect(result).toEqual({ success: true, status: "needs_approval" });
    expect(db.updateOnboardingAssignment).toHaveBeenLastCalledWith(900, expect.objectContaining({
      progressPercent: 50, requiredPendingCount: 1, approvalPendingCount: 1, status: "in_progress", completedAt: null,
    }));
    expect(db.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ONBOARDING_ITEM_COMPLETED", userId: 4 }));
  });

  it("prevents a different member from completing another user's item", async () => {
    await expect(appRouter.createCaller(context(41)).onboardingAssignments.updateItemProgress({ assignmentId: 900, itemId: 100 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateOnboardingItemProgress).not.toHaveBeenCalled();
  });

  it("lets the fallback manager approve, completes the assignment and preserves audit attribution", async () => {
    progress[0].status = "needs_approval";
    await appRouter.createCaller(context(3)).onboardingAssignments.approveItem({ progressId: 1000, decision: "approved" });
    expect(db.updateOnboardingItemProgress).toHaveBeenCalledWith(1000, expect.objectContaining({ status: "approved", approvedBy: 3 }));
    expect(db.updateOnboardingAssignment).toHaveBeenLastCalledWith(900, expect.objectContaining({
      progressPercent: 100, requiredPendingCount: 0, approvalPendingCount: 0, status: "completed", completedAt: expect.any(Date),
    }));
    expect(db.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ONBOARDING_ITEM_APPROVED", userId: 3 }));
  });

  it("forbids a foreign manager from approving an assignment", async () => {
    progress[0].status = "needs_approval";
    await expect(appRouter.createCaller(context(40)).onboardingAssignments.approveItem({ progressId: 1000, decision: "approved" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateOnboardingItemProgress).not.toHaveBeenCalled();
  });
});
