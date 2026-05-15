import { describe, expect, it } from "vitest";
import { classifyNotificationPriority, priorityWeight, sortNotificationsForQueue } from "@/lib/notificationPriority";

describe("notification priority UI utils", () => {
  it("classifies urgent types first", () => {
    expect(classifyNotificationPriority({ type: "schedule_incomplete" })).toBe("urgent");
    expect(classifyNotificationPriority({ type: "reconsult" })).toBe("urgent");
  });

  it("classifies today types and overdue dueAt as today", () => {
    expect(classifyNotificationPriority({ type: "schedule_today" })).toBe("today");
    expect(classifyNotificationPriority({ type: "birthday" })).toBe("today");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(classifyNotificationPriority({ type: "general", dueAt: yesterday.toISOString() })).toBe("today");
  });

  it("falls back to general when no urgent/today conditions", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(classifyNotificationPriority({ type: "general", dueAt: tomorrow.toISOString() })).toBe("general");
    expect(classifyNotificationPriority({ type: "customer_assigned" })).toBe("general");
  });

  it("returns stable priority weights", () => {
    expect(priorityWeight("urgent")).toBeLessThan(priorityWeight("today"));
    expect(priorityWeight("today")).toBeLessThan(priorityWeight("general"));
  });

  it("sorts by priority, unread first, then recency", () => {
    const now = new Date("2026-05-15T10:00:00.000Z");
    const items = [
      { id: 1, type: "general", createdAt: new Date(now.getTime() - 5 * 60000).toISOString(), isRead: false },
      { id: 2, type: "schedule_incomplete", createdAt: new Date(now.getTime() - 20 * 60000).toISOString(), isRead: true },
      { id: 3, type: "schedule_incomplete", createdAt: new Date(now.getTime() - 10 * 60000).toISOString(), isRead: false },
      { id: 4, type: "schedule_today", createdAt: new Date(now.getTime() - 2 * 60000).toISOString(), isRead: false },
      { id: 5, type: "schedule_today", createdAt: new Date(now.getTime() - 1 * 60000).toISOString(), isRead: true },
      { id: 6, type: "general", createdAt: now.toISOString(), isRead: false },
    ];

    const sorted = sortNotificationsForQueue(items);
    expect(sorted.map((n) => n.id)).toEqual([3, 2, 4, 5, 6, 1]);
  });
});
