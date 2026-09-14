import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodayWorkExecutionQueue } from "@/components/dashboard/TodayWorkExecutionQueue";
import {
  buildTodayWorkItems,
  countTodayWorkItemsByFilter,
  filterTodayWorkItems,
  type TodayWorkDashboardSlice,
  type TodayWorkQueueFilter,
} from "@/lib/todayWorkExecution";

const NOW = new Date("2026-06-15T03:00:00.000Z");

describe("todayWorkExecution", () => {
  it("prioritizes overdue follow-ups before today follow-ups and schedules", () => {
    const items = buildTodayWorkItems(
      {
        overdueFollowUps: [
          {
            id: 1,
            customerId: 10,
            customerName: "김고객",
            nextContactDate: "2026-06-14T10:00",
            reason: "재연락",
            nextAction: "전화",
          },
        ],
        todayFollowUps: [
          {
            id: 2,
            customerId: 11,
            customerName: "이고객",
            nextContactDate: "2026-06-15T14:00",
            reason: "서류 확인",
            nextAction: "카톡",
          },
        ],
        todaySchedules: [
          {
            id: 3,
            title: "방문 상담",
            type: "고객상담",
            startTime: "2026-06-15T05:00:00.000Z",
          },
        ],
        pendingNotifications: [
          {
            id: 4,
            title: "오늘 일정 알림",
            type: "schedule_today",
            createdAt: "2026-06-15T01:00:00.000Z",
          },
        ],
      },
      NOW
    );

    expect(items[0]?.type).toBe("followup");
    expect(items[0]?.id).toBe(1);
    expect(items[0]?.priorityLabel).toBe("지연 후속");
    expect(items[1]?.type).toBe("followup");
    expect(items[1]?.id).toBe(2);
    expect(items.map(item => item.type)).toContain("schedule");
    expect(items.map(item => item.type)).toContain("notification");
  });

  it("filters items by schedule, followup, and notification tabs", () => {
    const items = buildTodayWorkItems(
      {
        overdueFollowUps: [
          {
            id: 1,
            customerId: 10,
            nextContactDate: "2026-06-14T10:00",
          },
        ],
        todaySchedules: [
          {
            id: 2,
            title: "전화 상담",
            startTime: "2026-06-15T10:00",
          },
        ],
        pendingNotifications: [
          {
            id: 3,
            title: "미납 알림",
            type: "unpaid_lapse",
            createdAt: "2026-06-15T01:00:00.000Z",
          },
        ],
      },
      NOW
    );

    expect(filterTodayWorkItems(items, "followup")).toHaveLength(1);
    expect(filterTodayWorkItems(items, "schedule")).toHaveLength(1);
    expect(filterTodayWorkItems(items, "notification")).toHaveLength(1);
    expect(countTodayWorkItemsByFilter(items).all).toBe(3);
  });

  it("deduplicates schedules listed as incomplete and today", () => {
    const items = buildTodayWorkItems(
      {
        incompleteSchedules: [
          {
            id: 7,
            title: "미완료 상담",
            startTime: "2026-06-14T10:00",
          },
        ],
        todaySchedules: [
          {
            id: 7,
            title: "미완료 상담",
            startTime: "2026-06-15T10:00",
          },
          {
            id: 8,
            title: "오늘 상담",
            startTime: "2026-06-15T11:00",
          },
        ],
      },
      NOW
    );

    expect(items.filter(item => item.type === "schedule")).toHaveLength(2);
    expect(items.find(item => item.id === 7)?.priorityLabel).toBe(
      "미완료 일정"
    );
  });

  it("routes follow-up items to quick follow-up create", () => {
    const items = buildTodayWorkItems(
      {
        todayFollowUps: [
          {
            id: 5,
            customerId: 42,
            customerName: "박고객",
            nextContactDate: "2026-06-15T10:00",
          },
        ],
      },
      NOW
    );

    expect(items[0]?.route).toBe("/customers/42?action=quick-followup");
    expect(items[0]?.primaryActionLabel).toBe("완료");
  });

  it("renders mobile command queue filters and touch actions with accessible labels", () => {
    const items = buildTodayWorkItems(
      {
        todayFollowUps: [
          {
            id: 5,
            customerId: 42,
            customerName: "박고객",
            nextContactDate: "2026-06-15T10:00",
          },
        ],
      },
      NOW
    );

    const html = renderToStaticMarkup(
      <TodayWorkExecutionQueue
        items={items}
        filter="all"
        onFilterChange={() => undefined}
        isLoading={false}
        isError={false}
        onRetry={() => undefined}
        onSelectItem={() => undefined}
        onPrimaryAction={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain('aria-label="오늘 업무 필터: 전체 1건"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("오늘 업무 실행");
    expect(html).toContain('data-testid="dashboard-mobile-followup-queue"');
    expect(html).toContain('data-testid="mobile-followup-summary"');
    expect(html).toContain("미처리 후속 1건");
    expect(html).toContain("고객상세 보기");
    expect(html).toContain("일정 보기");
    expect(html).toContain("바로 처리");
  });

  it("summarizes follow-up reasons without exposing the full memo", () => {
    const items = buildTodayWorkItems(
      {
        todayFollowUps: [
          {
            id: 6,
            customerId: 43,
            customerName: "최고객",
            nextContactDate: "2026-06-15T11:00",
            nextAction: "전화",
            reason: "고객이 긴 상담 메모를 남긴 상태",
          },
        ],
      },
      NOW
    );

    expect(items[0]?.description).toContain("후속 사유 기록 있음");
    expect(items[0]?.description).not.toContain("긴 상담 메모");
  });
});

describe("P2-03 today versus overdue schedules", () => {
  const now = new Date("2026-09-14T03:00:00Z");
  const past = {
    id: 101,
    title: "[TEST] 과거 일정",
    startTime: "2026-05-21T14:00:00+09:00",
    endTime: "2026-05-21T15:00:00+09:00",
    customerId: 42,
  };
  const today = {
    id: 102,
    title: "[TEST] 오늘 일정",
    startTime: "2026-09-14T14:00:00+09:00",
    customerId: 43,
  };
  const overlap = {
    id: 103,
    title: "[TEST] 오늘 미완료",
    startTime: "2026-09-14T09:00:00+09:00",
    endTime: "2026-09-14T10:00:00+09:00",
    customerId: 44,
  };
  const fixture: TodayWorkDashboardSlice = {
    incompleteSchedules: [past, overlap],
    todaySchedules: [today, overlap],
  };
  const build = () => buildTodayWorkItems(fixture, now);
  const renderQueue = (
    data: TodayWorkDashboardSlice,
    filter: TodayWorkQueueFilter
  ) =>
    renderToStaticMarkup(
      <TodayWorkExecutionQueue
        items={buildTodayWorkItems(data, now)}
        filter={filter}
        onFilterChange={() => undefined}
        isLoading={false}
        isError={false}
        onRetry={() => undefined}
        onSelectItem={() => undefined}
        onPrimaryAction={() => undefined}
        onNavigate={() => undefined}
      />
    );

  it("T01 separates one today and one past schedule in counts", () => {
    const items = buildTodayWorkItems(
      { incompleteSchedules: [past], todaySchedules: [today] },
      now
    );
    expect(countTodayWorkItemsByFilter(items)).toEqual({
      all: 2,
      schedule: 1,
      overdueSchedule: 1,
      followup: 0,
      notification: 0,
    });
  });
  it("T02 today filter excludes all past IDs", () => {
    expect(
      filterTodayWorkItems(build(), "schedule").map(item => item.id)
    ).toEqual([103, 102]);
  });
  it("T03 overdue filter excludes all today IDs", () => {
    expect(
      filterTodayWorkItems(build(), "overdueSchedule").map(item => item.id)
    ).toEqual([101]);
  });
  it("T04 overlapping and repeated source IDs appear once, with today taking precedence", () => {
    const items = buildTodayWorkItems(
      {
        incompleteSchedules: [overlap, overlap],
        todaySchedules: [overlap, overlap],
      },
      now
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 103,
      scheduleBucket: "today",
      priorityRank: 30,
      priorityLabel: "미완료 일정",
      route: "/calendar",
      primaryActionLabel: "완료",
    });
    expect(filterTodayWorkItems(items, "overdueSchedule")).toEqual([]);
  });
  it("T05 overdue metadata uses original start rather than end, preserving priority and actions", () => {
    expect(build()[0]).toMatchObject({
      id: 101,
      scheduleBucket: "overdue",
      originalScheduledAt: new Date(past.startTime),
      priorityRank: 30,
      priorityLabel: "기한 경과",
      dueAt: past.endTime,
      taskType: "schedule",
      route: "/calendar",
      primaryActionLabel: "완료",
    });
  });
  it("T06 yesterday means one calendar day overdue", () => {
    const items = buildTodayWorkItems(
      {
        incompleteSchedules: [
          { ...past, startTime: "2026-09-13T14:00:00+09:00" },
        ],
      },
      now
    );
    expect(items[0]).toMatchObject({
      scheduleBucket: "overdue",
      overdueDays: 1,
    });
  });
  it("T07 month boundaries retain the exact calendar-day delay", () => {
    expect(build()[0].overdueDays).toBe(116);
  });
  it("T08 KST midnight changes day even when only one hour elapsed", () => {
    const items = buildTodayWorkItems(
      {
        incompleteSchedules: [
          { ...past, startTime: "2026-09-13T23:30:00+09:00" },
        ],
      },
      new Date("2026-09-14T00:30:00+09:00")
    );
    expect(items[0]).toMatchObject({
      scheduleBucket: "overdue",
      overdueDays: 1,
    });
  });
  it.each([
    ["2026-09-13T15:01:00Z", "today"],
    ["2026-09-13T14:59:00Z", "overdue"],
    ["2026-09-14T00:01", "today"],
    [new Date("2026-09-13T15:01:00Z"), "today"],
  ] as const)("T09 KST classification for %s is %s", (startTime, bucket) => {
    const items = buildTodayWorkItems(
      { incompleteSchedules: [{ ...past, startTime }] },
      new Date("2026-09-14T00:30:00+09:00")
    );
    expect(items[0].scheduleBucket).toBe(bucket);
  });
  it("T10 today item content has no overdue wording, including same-day incomplete items", () => {
    for (const item of filterTodayWorkItems(build(), "schedule")) {
      expect(item.overdueDays).toBeUndefined();
      expect(`${item.description} ${item.priorityLabel}`).not.toMatch(
        /기한 경과|지연|원래 예정/
      );
    }
    const html = renderQueue({ todaySchedules: [today] }, "schedule");
    expect(html).not.toContain("원래 예정");
    expect(html).not.toContain("일 지연");
  });
  it("T11 all five badge counts equal their filter results without dropping other work", () => {
    const items = buildTodayWorkItems(
      {
        ...fixture,
        todayFollowUps: [{ id: 104, customerId: 42, nextContactDate: now }],
        pendingNotifications: [
          { id: 105, title: "[TEST] 알림", type: "general", createdAt: now },
        ],
        longUnmanagedCustomers: [{ id: 106, name: "[TEST] 미관리" }],
      },
      now
    );
    const counts = countTodayWorkItemsByFilter(items);
    expect(counts).toEqual({
      all: 6,
      schedule: 2,
      overdueSchedule: 1,
      followup: 1,
      notification: 2,
    });
    for (const filter of Object.keys(counts) as TodayWorkQueueFilter[])
      expect(filterTodayWorkItems(items, filter)).toHaveLength(counts[filter]);
    expect(filterTodayWorkItems(items, "all")).toBe(items);
  });
  it("T12 follow-up and notification priorities/routes/actions are unchanged", () => {
    const items = buildTodayWorkItems(
      {
        ...fixture,
        overdueFollowUps: [
          {
            id: 104,
            customerId: 42,
            nextContactDate: "2026-09-13T09:00:00+09:00",
          },
        ],
        todayFollowUps: [{ id: 105, customerId: 43, nextContactDate: now }],
        pendingNotifications: [
          {
            id: 106,
            title: "[TEST] 알림",
            type: "general",
            createdAt: now,
            relatedType: "customer",
            relatedId: 44,
          },
        ],
      },
      now
    );
    expect(items.map(item => item.id)).toEqual([104, 105, 101, 103, 102, 106]);
    expect(items[0]).toMatchObject({
      priorityRank: 10,
      priorityLabel: "지연 후속",
      route: "/customers/42?action=quick-followup",
      primaryActionLabel: "완료",
    });
    expect(items[1]).toMatchObject({
      priorityRank: 20,
      priorityLabel: "오늘 연락",
      route: "/customers/43?action=quick-followup",
    });
    expect(items[5]).toMatchObject({
      priorityRank: 80,
      priorityLabel: "알림",
      route: "/customers/44",
      primaryActionLabel: "읽음",
    });
    expect(items[4].route).toBe("/calendar?customerId=43&action=quick-create");
  });
  it("uses start date for multi-day schedules, preserving server candidate eligibility", () => {
    const items = buildTodayWorkItems(
      {
        incompleteSchedules: [
          {
            ...past,
            startTime: "2026-09-13T14:00:00+09:00",
            endTime: "2026-09-14T10:00:00+09:00",
          },
        ],
        todaySchedules: [{ ...today, endTime: "2026-09-15T14:00:00+09:00" }],
      },
      now
    );
    expect(items.map(item => [item.id, item.scheduleBucket])).toEqual([
      [101, "overdue"],
      [102, "today"],
    ]);
  });
  it("keeps defensive future source items in all without calling them today or overdue", () => {
    const items = buildTodayWorkItems(
      {
        todaySchedules: [{ ...today, startTime: "2026-09-15T14:00:00+09:00" }],
      },
      now
    );
    expect(countTodayWorkItemsByFilter(items)).toEqual({
      all: 1,
      schedule: 0,
      overdueSchedule: 0,
      followup: 0,
      notification: 0,
    });
    expect(items[0].priorityLabel).not.toContain("오늘");
  });
  it.each(["schedule", "overdueSchedule"] as const)(
    "renders %s accessible count, selected state and mobile chip",
    filter => {
      const html = renderQueue(fixture, filter);
      expect(html).toMatch(
        /aria-label="오늘 업무 필터: 오늘 예정 2건" aria-pressed="(true|false)"/
      );
      expect(html).toMatch(
        /aria-label="오늘 업무 필터: 기한 경과 1건" aria-pressed="(true|false)"/
      );
      const selected =
        filter === "schedule" ? "오늘 예정 2건" : "기한 경과 1건";
      expect(html).toContain(
        `aria-label="오늘 업무 필터: ${selected}" aria-pressed="true"`
      );
      expect(html).toContain("오늘 예정 2건");
      expect(html).toContain("고객상세 보기");
      expect(html).toContain("후속 등록");
      expect(html).toContain("바로 처리");
      if (filter === "overdueSchedule")
        expect(html).toContain("원래 예정 2026-05-21 14:00 · 116일 지연");
      else {
        expect(html).not.toContain("원래 예정");
        expect(html).not.toContain("일 지연");
      }
    }
  );
  it.each([
    ["schedule", "오늘 예정된 일정이 없습니다."],
    ["overdueSchedule", "기한이 지난 미완료 일정이 없습니다."],
  ] as const)("renders the correct %s empty state", (filter, message) => {
    expect(renderQueue({}, filter)).toContain(message);
  });
});
