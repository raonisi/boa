import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodayWorkExecutionQueue } from "@/components/dashboard/TodayWorkExecutionQueue";
import {
  buildTodayWorkItems,
  countTodayWorkItemsByFilter,
  filterTodayWorkItems,
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
