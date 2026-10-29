import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  onboardingTemplates, onboardingTemplateItems,
  userOnboardingAssignments, userOnboardingItemProgress,
} from "../drizzle/schema";
import * as db from "./db";

const transport = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("drizzle-orm/mysql2", async importOriginal => {
  const real = await importOriginal<typeof import("drizzle-orm/mysql2")>();
  return {
    ...real,
    // Keep actual Drizzle SQL generation, encoders, session and result mapping.
    // Only the network transport is replaced; no MySQL socket is created.
    drizzle: () => real.drizzle({ client: transport as any }),
  };
});

type Query = { sql: string; params: unknown[] };
let executed: Query[];
let replies: unknown[][][];
function row(table: any, values: Record<string, unknown>) {
  return Object.values(getTableColumns(table)).map((column: any) => values[column.name] ?? null);
}
function where(query: Query) {
  return query.sql.split(" where ")[1]?.split(" order by ")[0] ?? "";
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://synthetic.invalid/onboarding-unit-only");
  executed = [];
  replies = [];
  transport.query.mockReset().mockImplementation(async (query, params) => {
    executed.push({ sql: query.sql, params });
    return /^select /i.test(query.sql)
      ? [replies.shift() ?? [], []]
      : [{ insertId: 700, affectedRows: 1 }, []];
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("actual onboarding persistence query and payload contracts", () => {
  it("lists only active, unarchived templates by default and supports the admin archive view", async () => {
    replies.push([row(onboardingTemplates, { id: 10, name: "[TEST] template", isActive: 1, targetRole: "member" })]);
    expect(await db.getOnboardingTemplates()).toMatchObject([{ id: 10, isActive: true }]);
    expect(where(executed[0])).toContain("`isActive` = ?");
    expect(where(executed[0])).toContain("`archivedAt` is null");
    expect(executed[0].params).toEqual([true]);
    await db.getOnboardingTemplates(true);
    expect(where(executed[1])).toBe("");
  });

  it("looks up a template by ID and distinguishes missing rows", async () => {
    replies.push([row(onboardingTemplates, { id: 10, name: "[TEST] template", targetRole: "member" })], []);
    expect(await db.getOnboardingTemplateById(10)).toMatchObject({ id: 10 });
    expect(executed[0].params).toEqual([10, 1]);
    expect(await db.getOnboardingTemplateById(999)).toBeUndefined();
  });

  it("keeps item reads on the selected template and excludes inactive items unless requested", async () => {
    await db.getOnboardingTemplateItems(10);
    expect(executed[0].params).toEqual([10, true]);
    expect(where(executed[0])).toContain("`templateId` = ?");
    expect(where(executed[0])).toContain("`isActive` = ?");
    await db.getOnboardingTemplateItems(10, true);
    expect(executed[1].params).toEqual([10]);
    expect(where(executed[1])).not.toContain("`isActive`");
  });

  it("links newly created template items to the returned template ID", async () => {
    replies.push([row(onboardingTemplates, { id: 700, name: "[TEST] template", targetRole: "member" })]);
    const result = await db.createOnboardingTemplate(
      { name: "[TEST] template", targetRole: "member", createdBy: 3 },
      [{ title: "[TEST] practice", category: "security", required: true }]
    );
    expect(result?.id).toBe(700);
    expect(executed[0].sql).toMatch(/^insert into `onboarding_templates`/);
    expect(executed[0].params).toContain("[TEST] template");
    expect(executed[2].sql).toMatch(/^insert into `onboarding_template_items`/);
    expect(executed[2].params).toContain(700);
    expect(executed[2].params).toContain("[TEST] practice");
  });

  it("does not create orphan items when no created template is returned", async () => {
    expect(await db.createOnboardingTemplate({ name: "[TEST] absent", targetRole: "member" }, [
      { title: "[TEST] orphan", category: "security" },
    ])).toBeNull();
    expect(executed).toHaveLength(2);
  });

  it("updates and archives the requested template only", async () => {
    await db.updateOnboardingTemplate(10, { isActive: false, archivedBy: 3 });
    expect(executed[0].sql).toMatch(/^update `onboarding_templates`/);
    expect(where(executed[0])).toContain("`id` = ?");
    expect(executed[0].params.at(-1)).toBe(10);
    expect(executed[0].params).toContain(false);
    expect(executed[0].params).toContain(3);
  });

  it("updates an existing item or returns the new item's ID", async () => {
    const value = { templateId: 10, title: "[TEST] practice", category: "security" };
    expect(await db.upsertOnboardingTemplateItem(101, value)).toBe(101);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toMatch(/^update `onboarding_template_items`/);
    expect(executed[0].params.at(-1)).toBe(101);
    replies.push([row(onboardingTemplateItems, { id: 102, ...value })]);
    expect(await db.upsertOnboardingTemplateItem(null, value)).toBe(102);
    expect(executed[1].sql).toMatch(/^insert into `onboarding_template_items`/);
  });

  it("applies authorized IDs, assigner, status and archive restrictions together", async () => {
    await db.getOnboardingAssignments({ targetUserIds: [4, 7], assignedBy: 3, status: "in_progress" });
    expect(executed[0].params).toEqual([4, 7, 3, "in_progress"]);
    expect(where(executed[0])).toContain("`targetUserId` in (?, ?)");
    expect(where(executed[0])).toContain("`archivedAt` is null");
    expect(where(executed[0])).toContain("`assignedBy` = ?");
    expect(where(executed[0])).toContain("`status` = ?");
  });

  it("fails closed for an empty authorized-ID set without issuing an unrestricted select", async () => {
    expect(await db.getOnboardingAssignments({ targetUserIds: [] })).toEqual([]);
    expect(transport.query).not.toHaveBeenCalled();
  });

  it("keeps personal history on its target even when archived rows are included", async () => {
    await db.getOnboardingAssignments({ targetUserId: 4, includeArchived: true });
    expect(executed[0].params).toEqual([4]);
    expect(where(executed[0])).toContain("`targetUserId` = ?");
    expect(where(executed[0])).not.toContain("`archivedAt`");
  });

  it("maps a single assignment and progress row by their requested IDs", async () => {
    replies.push(
      [row(userOnboardingAssignments, { id: 900, targetUserId: 4, templateId: 10, status: "assigned" })],
      [row(userOnboardingItemProgress, { id: 1000, assignmentId: 900, itemId: 100, status: "pending" })]
    );
    expect(await db.getOnboardingAssignmentById(900)).toMatchObject({ id: 900, targetUserId: 4 });
    expect(await db.getOnboardingItemProgressById(1000)).toMatchObject({ id: 1000, assignmentId: 900 });
    expect(executed.map(query => query.params)).toEqual([[900, 1], [1000, 1]]);
  });

  it("restricts progress rows to one assignment", async () => {
    replies.push([row(userOnboardingItemProgress, { id: 1000, assignmentId: 900, itemId: 100, status: "pending" })]);
    expect(await db.getOnboardingItemProgressByAssignment(900)).toMatchObject([{ assignmentId: 900 }]);
    expect(executed[0].params).toEqual([900]);
    expect(where(executed[0])).toContain("`assignmentId` = ?");
  });

  it("persists the assigner's exact target, trainer and date payload", async () => {
    const input = { targetUserId: 4, templateId: 10, assignedBy: 3, trainerUserId: 7,
      startedAt: new Date("2026-10-29T00:00:00Z"), dueAt: new Date("2026-11-05T00:00:00Z") };
    replies.push([row(userOnboardingAssignments, { id: 900, targetUserId: 4, templateId: 10, trainerUserId: 7, assignedBy: 3 })]);
    expect(await db.createOnboardingAssignment(input)).toMatchObject({ id: 900, targetUserId: 4, trainerUserId: 7, assignedBy: 3 });
    expect(executed[0].sql).toMatch(/^insert into `user_onboarding_assignments`/);
    expect(executed[0].params).toEqual(expect.arrayContaining([4, 10, 3, 7, "2026-10-29 00:00:00.000", "2026-11-05 00:00:00.000"]));
  });

  it("skips an empty progress batch and preserves assignment links in a real bulk insert", async () => {
    await db.createOnboardingItemProgressRows([]);
    expect(transport.query).not.toHaveBeenCalled();
    await db.createOnboardingItemProgressRows([
      { assignmentId: 900, itemId: 100, status: "pending" },
      { assignmentId: 900, itemId: 101, status: "pending" },
    ]);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toMatch(/^insert into `user_onboarding_item_progress`/);
    expect(executed[0].params.filter(value => value === 900)).toHaveLength(2);
    expect(executed[0].params).toEqual(expect.arrayContaining([100, 101, "pending"]));
  });

  it("writes assignment totals and item approval to their own row IDs", async () => {
    await db.updateOnboardingAssignment(900, { progressPercent: 100, status: "completed", requiredPendingCount: 0 });
    await db.updateOnboardingItemProgress(1000, { status: "approved", approvedBy: 3 });
    expect(executed[0].sql).toMatch(/^update `user_onboarding_assignments`/);
    expect(executed[0].params).toEqual(expect.arrayContaining([100, "completed", 0]));
    expect(executed[0].params.at(-1)).toBe(900);
    expect(executed[1].sql).toMatch(/^update `user_onboarding_item_progress`/);
    expect(executed[1].params).toEqual(expect.arrayContaining(["approved", 3]));
    expect(executed[1].params.at(-1)).toBe(1000);
  });

  it("keeps default template seeding idempotent across all four roles", async () => {
    const roles = new Set<string>();
    transport.query.mockImplementation(async (query, params) => {
      executed.push({ sql: query.sql, params });
      if (query.sql.includes("from `onboarding_templates`")) {
        roles.add(params[1]);
        return [[row(onboardingTemplates, { id: 10, name: params[0], targetRole: params[1] })], []];
      }
      if (query.sql.includes("from `onboarding_template_items`")) {
        return [[row(onboardingTemplateItems, { id: 100, templateId: params[0], title: params[1] })], []];
      }
      throw new Error("Existing defaults must not be rewritten");
    });
    expect(await db.ensureDefaultOnboardingTemplates(3)).toEqual({ createdTemplates: 0, createdItems: 0 });
    expect([...roles].sort()).toEqual(["branch_admin", "member", "sub_branch_admin", "team_leader"]);
    expect(executed.length).toBeGreaterThan(20);
    expect(executed.every(query => query.sql.startsWith("select "))).toBe(true);
  });
});
