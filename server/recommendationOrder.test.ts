import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareRecommendationPriority } from "./recommendationOrder";
import * as db from "./db";
import { appRouter } from "./routers";
import { actors, NOW } from "../tests/integration/recommendation-query.fixture";
import type { TrpcContext } from "./_core/context";

const dates = new Map([
  [2, new Date("2026-09-01T00:00:00Z")],
  [10, new Date("2026-09-01T00:00:00Z")],
  [20, new Date("2026-09-02T00:00:00Z")],
  [30, new Date("2026-08-01T00:00:00Z")],
]);
const row = (customerId: number, totalScore: number) => ({
  customerId,
  totalScore,
});
describe("RF02 C01-C04 pure total order", () => {
  it.each([
    [row(2, 25), row(20, 15), -1],
    [row(20, 15), row(2, 25), 1],
    [row(20, 15), row(2, 15), -1],
    [row(2, 15), row(20, 15), 1],
    [row(2, 15), row(10, 15), -1],
    [row(10, 15), row(2, 15), 1],
    [row(2, 15), row(2, 15), 0],
  ])("compares %j and %j", (a, b, direction) => {
    expect(Math.sign(compareRecommendationPriority(a, b, dates))).toBe(
      direction
    );
  });
  it("T01/T02 uses score first, then registration date, then numeric ID", () => {
    const values = [row(10, 15), row(20, 15), row(2, 15), row(30, 25)];
    expect(
      [...values]
        .sort((a, b) => compareRecommendationPriority(a, b, dates))
        .map(r => r.customerId)
    ).toEqual([30, 20, 2, 10]);
    expect(values.map(r => r.customerId)).toEqual([10, 20, 2, 30]);
  });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function caller() {
  return appRouter.createCaller({
    user: actors[1],
    req: { protocol: "http", headers: {} },
    res: { clearCookie() {} },
  } as TrpcContext);
}
const ids = Array.from({ length: 64 }, (_, i) => i + 1);
function facts(order: number[], raw = false) {
  return {
    customerList: order.map(id => ({
      id,
      name: `[TEST] tie ${id}`,
      priority: "B" as const,
      customerTags: null,
      consultStatus: "미상담" as const,
      nextAction: null,
      createdAt: new Date("2026-09-08T00:00:00Z"),
      assignedAt: new Date(NOW),
      isActive: true,
      deletedAt: null,
      ...(raw ? { phone: "synthetic-unused", memo: "synthetic-unused" } : {}),
    })),
    consultationStats: [],
    contractList: [],
    followUpList: [],
    notifications: [],
  };
}
describe("RF02 C04-C07 route cutoff and input independence", () => {
  it.each([1, 10, 25, 50])(
    "T03/T04 orders 64 complete ties before limit %s",
    async limit => {
      vi.spyOn(db, "getRecommendationData").mockResolvedValue(
        facts([...ids].reverse())
      );
      const result = await caller().recommendations.priorityContacts({
        date: NOW,
        limit,
      });
      expect(result.map(r => r.customerId)).toEqual(ids.slice(0, limit));
      expect(result.every(r => r.totalScore === 15)).toBe(true);
      expect(Object.keys(result[0])).not.toContain("createdAt");
      expect(Object.keys(result[0])).not.toContain("customerCreatedAt");
    }
  );
  it("T05/T07 full-row and minimal projections with different order produce identical API responses", async () => {
    const spy = vi.spyOn(db, "getRecommendationData");
    spy.mockResolvedValue(facts([...ids].reverse(), true));
    const raw = await caller().recommendations.priorityContacts({
      date: NOW,
      limit: 50,
    });
    spy.mockResolvedValue(facts([...ids.slice(23), ...ids.slice(0, 23)]));
    const minimal = await caller().recommendations.priorityContacts({
      date: NOW,
      limit: 50,
    });
    expect(minimal).toEqual(raw);
    expect(minimal.map(r => r.customerId)).toEqual(ids.slice(0, 50));
    expect(JSON.stringify(minimal)).not.toContain("synthetic-unused");
  });
  it("T08 remains identical over 10 shuffled supplies and shares the policy with dashboard top 5", async () => {
    const spy = vi.spyOn(db, "getRecommendationData");
    for (let n = 0; n < 10; n++) {
      const rotate = (n * 7) % 64;
      spy.mockResolvedValue(
        facts([...ids.slice(rotate), ...ids.slice(0, rotate)].reverse())
      );
      const result = await caller().recommendations.priorityContacts({
        date: NOW,
        limit: 50,
        includeWarnings: false,
      });
      expect(result.map(r => r.customerId)).toEqual(ids.slice(0, 50));
      const summary = await caller().recommendations.dashboardSummary({
        date: NOW,
      });
      expect(summary.topContacts.map(r => r.customerId)).toEqual([
        1, 2, 3, 4, 5,
      ]);
      expect(summary.priorityContactCount).toBe(64);
    }
  });
  it("retains positive score / urgency filters before limit and does not rank by urgency separately", async () => {
    const f = facts([2, 10, 20, 30]);
    f.customerList[0].priority = "unclassified" as any;
    f.customerList[1].priority = "A" as any;
    f.customerList[1].customerTags = '["해지위험","사후관리"]' as any;
    vi.spyOn(db, "getRecommendationData").mockResolvedValue(f);
    const api = caller().recommendations;
    expect(
      (await api.priorityContacts({ date: NOW, limit: 1, urgency: "low" })).map(
        r => r.customerId
      )
    ).toEqual([20]);
    expect(
      (
        await api.priorityContacts({ date: NOW, limit: 1, urgency: "high" })
      ).map(r => r.customerId)
    ).toEqual([10]);
    expect(
      (await api.priorityContacts({ date: NOW, limit: 50 })).map(
        r => r.customerId
      )
    ).toEqual([10, 20, 30]);
    await expect(api.priorityContacts({ limit: 51 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
