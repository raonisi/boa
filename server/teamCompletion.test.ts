import { afterEach, describe, expect, it, vi } from "vitest";

import * as db from "./db";
import { buildTeamCompletionInsights } from "./teamCompletion";

function mockTeamCompletionDb(
  notificationRows: any[],
  followUpRows: any[] = []
) {
  let queryIndex = 0;
  vi.spyOn(db, "getDb").mockResolvedValue({
    select: () => ({
      from: () => ({
        where: async () =>
          queryIndex++ === 0 ? notificationRows : followUpRows,
      }),
    }),
  } as any);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("team completion action-level policy", () => {
  const actor = { id: 3, role: "team_leader" };
  const visibleUsers = [
    { id: 4, name: "[TEST] Member", role: "member", teamId: 10 },
  ];
  const visibleTeams = [{ id: 10, name: "[TEST] Team" }];

  it("does not turn a large informational count into a numeric risk tier", async () => {
    mockTeamCompletionDb(
      Array.from({ length: 1001 }, (_, index) => ({
        id: index + 1,
        userId: 4,
        type: "general",
        processStatus: "미확인",
        isRead: false,
        dueAt: null,
        createdAt: new Date(),
      }))
    );

    const result = await buildTeamCompletionInsights(
      actor,
      visibleUsers,
      visibleTeams
    );

    expect(result?.users[0].actionLevel).toBe("informational");
    expect(result?.attentionUsers).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/riskScore|점수/);
  });

  it.each(["uncontacted_3days", "long_unmanaged_90", "reconsult"])(
    "classifies unfinished %s work as action required without a score",
    async type => {
      mockTeamCompletionDb([
        {
          id: 1,
          userId: 4,
          type,
          processStatus: "미확인",
          isRead: false,
          dueAt: null,
          createdAt: new Date(),
        },
      ]);

      const result = await buildTeamCompletionInsights(
        actor,
        visibleUsers,
        visibleTeams
      );

      expect(result?.users[0].actionLevel).toBe("action_required");
      expect(result?.attentionUsers[0].userId).toBe(4);
      expect(JSON.stringify(result)).not.toMatch(/riskScore|점수/);
    }
  );

  it("returns an empty factual summary when the resolved scope has no users", async () => {
    mockTeamCompletionDb([]);

    const result = await buildTeamCompletionInsights(actor, [], visibleTeams);

    expect(result?.summary.actionRequiredUserCount).toBe(0);
    expect(result?.users).toEqual([]);
    expect(result?.attentionUsers).toEqual([]);
  });

  it("covers completed, future, overdue, and informational work without weighted promotion", async () => {
    const now = Date.now();
    mockTeamCompletionDb(
      [
        {
          id: 1,
          userId: 4,
          type: "reconsult",
          processStatus: "미확인",
          isRead: false,
          dueAt: new Date(now - 60_000),
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: 2,
          userId: 4,
          type: "general",
          processStatus: "처리완료",
          isRead: true,
          dueAt: null,
          createdAt: new Date(),
        },
        {
          id: 3,
          userId: 4,
          type: "unpaid_lapse",
          processStatus: "미확인",
          isRead: false,
          dueAt: new Date(now + 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
        {
          id: 4,
          userId: 5,
          type: "general",
          processStatus: "미확인",
          isRead: false,
          dueAt: null,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
      ],
      [
        {
          id: 10,
          assignedAgentId: 4,
          status: "scheduled",
          nextContactDate: new Date(now - 4 * 24 * 60 * 60 * 1000),
        },
        {
          id: 11,
          assignedAgentId: 4,
          status: "completed",
          nextContactDate: new Date(now - 60_000),
        },
        {
          id: 12,
          assignedAgentId: 4,
          status: "cancelled",
          nextContactDate: new Date(now - 60_000),
        },
        {
          id: 13,
          assignedAgentId: 5,
          status: "scheduled",
          nextContactDate: new Date(now + 60_000),
        },
      ]
    );

    const result = await buildTeamCompletionInsights(
      actor,
      [
        ...visibleUsers,
        { id: 5, name: "[TEST] Other", role: "member", teamId: null },
      ],
      visibleTeams,
      new Date(now - 7 * 24 * 60 * 60 * 1000),
      new Date(now + 7 * 24 * 60 * 60 * 1000)
    );

    expect(result?.users.map(item => item.userId)).toEqual([4, 5]);
    expect(result?.users[0].metrics.overdueOver3DaysCount).toBe(1);
    expect(result?.users[0].metrics.actionRequiredNotificationCount).toBe(1);
    expect(result?.users[0].reasons).toEqual(
      expect.arrayContaining([
        "미확인 알림 2건",
        "24시간 이상 미확인 1건",
        "처리 필요 알림 1건",
        "지연 후속관리 1건",
        "3일 이상 지연 1건",
      ])
    );
    expect(result?.users[1].actionLevel).toBe("informational");
    expect(result?.summary.actionRequiredUserCount).toBe(1);
  });
});
