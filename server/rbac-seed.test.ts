import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import {
  createBirthdayReminder,
  createContractReminders,
  createScheduleIncompleteReminder,
  refreshLongUnmanagedReminder,
} from "./notifications";
import { registerOAuthRoutes } from "./_core/oauth";
import { sdk } from "./_core/sdk";
import { buildGoogleAuthorizeUrl } from "../client/src/const";

type Role = "branch_admin" | "sub_branch_admin" | "team_leader" | "member";

const users = [
  { id: 1, openId: "seed-branch", name: "[TEST] Branch", email: "branch@test.local", role: "branch_admin", accountStatus: "active", teamId: null, subBranchAdminId: null },
  { id: 21, openId: "seed-sub-a", name: "[TEST] Sub A", email: "sub-a@test.local", role: "sub_branch_admin", accountStatus: "active", teamId: null, subBranchAdminId: null },
  { id: 22, openId: "seed-sub-b", name: "[TEST] Sub B", email: "sub-b@test.local", role: "sub_branch_admin", accountStatus: "active", teamId: null, subBranchAdminId: null },
  { id: 31, openId: "seed-leader-a", name: "[TEST] Leader A", email: "leader-a@test.local", role: "team_leader", accountStatus: "active", teamId: 101, subBranchAdminId: 21 },
  { id: 32, openId: "seed-leader-b", name: "[TEST] Leader B", email: "leader-b@test.local", role: "team_leader", accountStatus: "active", teamId: 102, subBranchAdminId: 22 },
  { id: 41, openId: "seed-member-a1", name: "[TEST] Member A1", email: "member-a1@test.local", role: "member", accountStatus: "active", teamId: 101, subBranchAdminId: 21 },
  { id: 42, openId: "seed-member-a2", name: "[TEST] Member A2", email: "member-a2@test.local", role: "member", accountStatus: "active", teamId: 101, subBranchAdminId: 21 },
  { id: 43, openId: "seed-member-b1", name: "[TEST] Member B1", email: "member-b1@test.local", role: "member", accountStatus: "active", teamId: 102, subBranchAdminId: 22 },
  { id: 98, openId: "seed-resigned", name: "[TEST] Resigned", email: "resigned@test.local", role: "member", accountStatus: "resigned", teamId: 101, subBranchAdminId: 21 },
  { id: 99, openId: "seed-inactive", name: "[TEST] Inactive", email: "inactive@test.local", role: "member", accountStatus: "inactive", teamId: 101, subBranchAdminId: 21 },
] as any[];

const teams = [
  { id: 101, name: "[TEST] Team A", managerId: 31, subBranchAdminId: 21, isActive: true },
  { id: 102, name: "[TEST] Team B", managerId: 32, subBranchAdminId: 22, isActive: true },
] as any[];

const customers = [
  { id: 1001, name: "[TEST] Customer A1", agentId: 41, assignedTeamId: 101, subBranchAdminId: 21, assignmentStatus: "assigned_to_agent", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 1002, name: "[TEST] Customer A2", agentId: 42, assignedTeamId: 101, subBranchAdminId: 21, assignmentStatus: "assigned_to_agent", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 2001, name: "[TEST] Customer B1", agentId: 43, assignedTeamId: 102, subBranchAdminId: 22, assignmentStatus: "assigned_to_agent", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 3001, name: "[TEST] Unassigned", agentId: null, assignedTeamId: null, subBranchAdminId: null, assignmentStatus: "unassigned", isActive: true, createdAt: new Date(), updatedAt: new Date() },
] as any[];

const contracts = [
  { id: 501, customerId: 1001, agentId: 41, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 502, customerId: 2001, agentId: 43, isActive: true, createdAt: new Date(), updatedAt: new Date() },
] as any[];

const schedules = [
  { id: 601, userId: 41, teamId: 101, isActive: true, startTime: new Date(), title: "[TEST] A schedule" },
  { id: 602, userId: 43, teamId: 102, isActive: true, startTime: new Date(), title: "[TEST] B schedule" },
] as any[];

const notifications = [
  { id: 701, userId: 41, type: "general", isRead: false, processStatus: "미확인", createdAt: new Date() },
  { id: 702, userId: 43, type: "general", isRead: false, processStatus: "미확인", createdAt: new Date() },
] as any[];

function ctx(userId: number): TrpcContext {
  const user = users.find((u) => u.id === userId);
  if (!user) throw new Error(`missing seed user ${userId}`);
  return {
    user: { ...user, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function setupSeedDb() {
  vi.spyOn(db, "getAllUsers").mockResolvedValue(users);
  vi.spyOn(db, "getUserByEmail").mockResolvedValue(null);
  vi.spyOn(db, "createUser").mockResolvedValue({ ...users[6], id: 100, email: "new.user@test.local", name: "[TEST] New User" } as any);
  vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => users.find((u) => u.id === id) ?? null);
  vi.spyOn(db, "getUsersBySubBranchAdminId").mockImplementation(async (id: number) => users.filter((u) => u.subBranchAdminId === id));
  vi.spyOn(db, "getUsersByTeamId").mockImplementation(async (id: number) => users.filter((u) => u.teamId === id));
  vi.spyOn(db, "getAllTeams").mockResolvedValue(teams);
  vi.spyOn(db, "getTeamById").mockImplementation(async (id: number) => teams.find((t) => t.id === id) ?? null);
  vi.spyOn(db, "getCustomers").mockImplementation(async (filter: any = {}) => customers.filter((c) =>
    c.isActive &&
    (filter.subBranchAdminId === undefined || c.subBranchAdminId === filter.subBranchAdminId) &&
    (filter.teamId === undefined || c.assignedTeamId === filter.teamId) &&
    (filter.agentIds === undefined || filter.agentIds.includes(c.agentId)) &&
    (filter.agentId === undefined || c.agentId === filter.agentId)
  ));
  vi.spyOn(db, "getCustomerById").mockImplementation(async (id: number) => customers.find((c) => c.id === id) ?? null);
  vi.spyOn(db, "getAllContracts").mockImplementation(async (filter: any = {}) => contracts.filter((contract) => {
    const customer = customers.find((c) => c.id === contract.customerId);
    return contract.isActive &&
      (filter.subBranchAdminId === undefined || customer?.subBranchAdminId === filter.subBranchAdminId) &&
      (filter.teamId === undefined || customer?.assignedTeamId === filter.teamId) &&
      (filter.agentIds === undefined || filter.agentIds.includes(contract.agentId)) &&
      (filter.agentId === undefined || contract.agentId === filter.agentId);
  }));
  vi.spyOn(db, "getContractById").mockImplementation(async (id: number) => contracts.find((c) => c.id === id) ?? null);
  vi.spyOn(db, "getContractHistory").mockResolvedValue([]);
  vi.spyOn(db, "getSchedules").mockImplementation(async (filter: any = {}) => schedules.filter((s) =>
    s.isActive &&
    (filter.subBranchAdminId === undefined || users.find((u) => u.id === s.userId)?.subBranchAdminId === filter.subBranchAdminId) &&
    (filter.teamId === undefined || s.teamId === filter.teamId) &&
    (filter.userIds === undefined || filter.userIds.includes(s.userId)) &&
    (filter.userId === undefined || s.userId === filter.userId)
  ));
  vi.spyOn(db, "getPerformanceStats").mockResolvedValue({ totalCustomers: 0, totalContracts: 0 } as any);
  vi.spyOn(db, "getNotificationById").mockImplementation(async (id: number) => notifications.find((n) => n.id === id) ?? null);
  vi.spyOn(db, "markNotificationRead").mockResolvedValue(undefined);
  vi.spyOn(db, "updateNotificationProcessStatus").mockResolvedValue(undefined);
  vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
}

afterEach(() => vi.restoreAllMocks());

describe("seed-backed RBAC integration", () => {
  it("scopes list queries by seeded organization hierarchy", async () => {
    setupSeedDb();
    await expect(appRouter.createCaller(ctx(1)).customers.list({})).resolves.toHaveLength(4);
    await expect(appRouter.createCaller(ctx(21)).customers.list({})).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: 1001 }), expect.objectContaining({ id: 1002 })]));
    await expect(appRouter.createCaller(ctx(31)).customers.list({})).resolves.toHaveLength(2);
    await expect(appRouter.createCaller(ctx(41)).customers.list({})).resolves.toEqual([expect.objectContaining({ id: 1001 })]);
    await expect(appRouter.createCaller(ctx(99)).customers.list({})).rejects.toThrow();
  });

  it("blocks direct customer and contract access outside the actor scope", async () => {
    setupSeedDb();
    await expect(appRouter.createCaller(ctx(41)).customers.get({ id: 1002 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(21)).customers.get({ id: 2001 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(21)).contracts.contractHistory({ contractId: 502 })).rejects.toThrow();
  });

  it("blocks cross-scope performance, notification, schedule, and assignment mutations", async () => {
    setupSeedDb();
    await expect(appRouter.createCaller(ctx(31)).performance.stats({ teamIdFilter: 102 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(41)).performance.agentStats({ agentId: 42 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(31)).schedules.create({
      title: "[TEST] blocked schedule",
      type: "고객상담" as any,
      startTime: new Date().toISOString(),
      targetUserId: 43,
    })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(41)).notifications.markRead({ id: 702 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(31)).notifications.updateProcessStatus({ id: 702, processStatus: "확인" as any })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(31)).customers.assign({ customerId: 1001, agentId: 43 })).rejects.toThrow();
  });

  it("returns role-scoped organization trees and blocks member organization access", async () => {
    setupSeedDb();
    const branchTree = await appRouter.createCaller(ctx(1)).users.organizationTree();
    expect(branchTree.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([21, 22, 31, 41, 43]));

    const subTree = await appRouter.createCaller(ctx(21)).users.organizationTree();
    expect(subTree.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([21, 31, 41, 42]));
    expect(subTree.nodes.map((node) => node.id)).not.toContain(43);

    const leaderTree = await appRouter.createCaller(ctx(31)).users.organizationTree();
    expect(leaderTree.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([31, 41, 42]));
    expect(leaderTree.nodes.map((node) => node.id)).not.toContain(43);

    await expect(appRouter.createCaller(ctx(41)).users.organizationTree()).rejects.toThrow();
  });

  it("allows branch_admin to update supported hierarchy parent shapes", async () => {
    setupSeedDb();
    const updateSpy = vi.spyOn(db, "updateUserOrganization").mockResolvedValue(undefined);
    const logSpy = vi.mocked(db.createActivityLog);

    await appRouter.createCaller(ctx(1)).users.updateParent({ userId: 31, parentUserId: 1 });
    expect(updateSpy).toHaveBeenCalledWith(31, expect.objectContaining({ parentUserId: 1 }));

    await appRouter.createCaller(ctx(1)).users.updateParent({ userId: 41, parentUserId: 1 });
    expect(updateSpy).toHaveBeenCalledWith(41, expect.objectContaining({ parentUserId: 1 }));

    await appRouter.createCaller(ctx(1)).users.updateParent({ userId: 31, parentUserId: 21 });
    expect(updateSpy).toHaveBeenCalledWith(31, expect.objectContaining({ parentUserId: 21 }));

    await appRouter.createCaller(ctx(1)).users.updateParent({ userId: 42, parentUserId: 21 });
    expect(updateSpy).toHaveBeenCalledWith(42, expect.objectContaining({ parentUserId: 21 }));

    await appRouter.createCaller(ctx(1)).users.updateParent({ userId: 42, parentUserId: 31 });
    expect(updateSpy).toHaveBeenCalledWith(42, expect.objectContaining({ parentUserId: 31 }));

    expect(logSpy.mock.calls.at(-1)?.[0]).toMatchObject({ action: "USER_ORG_PARENT_CHANGED" });
  });

  it("blocks invalid, inactive, resigned, and circular hierarchy parent assignments", async () => {
    setupSeedDb();

    await expect(appRouter.createCaller(ctx(1)).users.updateParent({ userId: 31, parentUserId: 31 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(41)).users.updateParent({ userId: 31, parentUserId: 1 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(1)).users.updateParent({ userId: 31, parentUserId: 41 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(1)).users.updateParent({ userId: 31, parentUserId: 98 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(1)).users.updateParent({ userId: 31, parentUserId: 99 })).rejects.toThrow();

    const cyclicUsers = users.map((user) => {
      if (user.id === 31) return { ...user, parentUserId: 21 };
      if (user.id === 41) return { ...user, parentUserId: 31 };
      return { ...user };
    });
    vi.spyOn(db, "getAllUsers").mockResolvedValue(cyclicUsers);
    vi.spyOn(db, "getUserById").mockImplementation(async (id: number) => cyclicUsers.find((u) => u.id === id) ?? null);
    await expect(appRouter.createCaller(ctx(1)).users.updateParent({ userId: 31, parentUserId: 41 })).rejects.toThrow();
  });

  it("allows sub_branch_admin to assign only to descendant users", async () => {
    setupSeedDb();
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback({}));
    const assignSpy = vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    vi.spyOn(db, "createAssignmentHistory").mockResolvedValue(undefined);
    vi.spyOn(db, "createNotification").mockResolvedValue(undefined);

    await appRouter.createCaller(ctx(21)).customers.assign({ customerId: 1002, agentId: 31 });
    expect(assignSpy).toHaveBeenCalledWith(1002, 31, 101, 21, {});

    await appRouter.createCaller(ctx(21)).customers.assign({ customerId: 1002, agentId: 41 });
    expect(assignSpy).toHaveBeenCalledWith(1002, 41, 101, 21, {});

    await expect(appRouter.createCaller(ctx(21)).customers.assign({ customerId: 1002, agentId: 43 })).rejects.toThrow();
  });

  it("allows team_leader to assign customers only to descendant members", async () => {
    setupSeedDb();
    vi.spyOn(db, "runDbTransaction").mockImplementation(async (callback: any) => callback({}));
    const assignSpy = vi.spyOn(db, "assignCustomer").mockResolvedValue(undefined);
    const logSpy = vi.mocked(db.createActivityLog);
    vi.spyOn(db, "createAssignmentHistory").mockResolvedValue(undefined);
    vi.spyOn(db, "createNotification").mockResolvedValue(undefined);

    await appRouter.createCaller(ctx(31)).customers.assign({ customerId: 1002, agentId: 41 });
    expect(assignSpy).toHaveBeenCalledWith(1002, 41, 101, 21, {});
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "DB_ASSIGNED_BY_TEAM_LEADER" }), {});

    await expect(appRouter.createCaller(ctx(31)).customers.assign({ customerId: 1001, agentId: 43 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(41)).customers.assign({ customerId: 1001, agentId: 42 })).rejects.toThrow();
  });

  it("blocks non-admin bulk import and non-csv or oversized payloads", async () => {
    setupSeedDb();
    await expect(appRouter.createCaller(ctx(41)).customers.bulkImport({ rows: [], fileName: "customers.csv" })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(1)).customers.previewImport({ rows: [], fileName: "customers.xlsx" })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(1)).customers.previewImport({ rows: [], fileName: "customers.csv", fileSize: 6 * 1024 * 1024 })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx(1)).customers.previewImport({ rows: [], fileName: "customers.csv", mimeType: "application/zip" })).rejects.toThrow();
  });

  it("standardizes and sanitizes activity log details", async () => {
    setupSeedDb();
    const logSpy = vi.mocked(db.createActivityLog);
    await appRouter.createCaller(ctx(1)).users.create({
      name: "[TEST] New User",
      email: "new.user@test.local",
      role: "member",
      accountStatus: "active",
      phone: "010-1234-5678",
      memo: "do not log",
    });
    const details = JSON.parse(logSpy.mock.calls.at(-1)?.[0].details ?? "{}");
    expect(details).toMatchObject({ actor: 1, targetType: "user" });
    expect(JSON.stringify(details)).not.toContain("new.user@test.local");
    expect(JSON.stringify(details)).not.toContain("do not log");
  });
});

describe("notification generation paths", () => {
  it("creates contract, birthday, incomplete schedule, and long-unmanaged reminders with unique insert path", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(db, "getDb").mockResolvedValue({ insert: () => ({ values }) } as any);

    await createContractReminders(501, 41, new Date("2026-01-01T00:00:00Z"), "[TEST] Customer");
    await createBirthdayReminder(1001, 41, new Date("1990-05-20T00:00:00Z"), "[TEST] Customer");
    await createScheduleIncompleteReminder(601, 41, new Date(Date.now() + 60 * 60 * 1000), "[TEST] Schedule");
    await refreshLongUnmanagedReminder(1001, 41, new Date(Date.now() + 24 * 60 * 60 * 1000), "[TEST] Customer");

    const insertedTypes = values.mock.calls.map((call) => call[0].type);
    expect(insertedTypes).toEqual(expect.arrayContaining(["contract_90", "contract_365", "birthday", "schedule_incomplete", "long_unmanaged_90"]));
  });
});

describe("OAuth pre-registration guard", () => {
  it("builds a Google authorize URL with the CRM callback redirect URI", () => {
    const url = new URL(buildGoogleAuthorizeUrl({
      clientId: "google-client-id",
      origin: "http://127.0.0.1:3000",
    }));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3000/api/oauth/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("rejects empty Google client IDs before building the authorize URL", () => {
    expect(() => buildGoogleAuthorizeUrl({ clientId: "", origin: "http://127.0.0.1:3000" })).toThrow();
  });

  it("does not auto-create an active member for an unregistered OAuth email", async () => {
    let callback: any;
    registerOAuthRoutes({ get: (_path: string, handler: any) => { callback = handler; } } as any);
    vi.spyOn(sdk, "exchangeGoogleCodeForToken").mockResolvedValue({ access_token: "token" } as any);
    vi.spyOn(sdk, "getGoogleUserInfo").mockResolvedValue({ sub: "unregistered-open-id", email: "New.User@Test.Local", email_verified: true, name: "[TEST] OAuth" } as any);
    vi.spyOn(db, "getAllUsersByEmail").mockResolvedValue([]);
    const upsertSpy = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    const redirectUri = "http://127.0.0.1:3000/api/oauth/callback";
    await callback(
      { query: { code: "code", state: Buffer.from(redirectUri).toString("base64") }, protocol: "http", headers: { host: "127.0.0.1:3000" }, socket: {} },
      { status, json, cookie: vi.fn(), redirect: vi.fn() }
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("blocks callback state mismatch before exchanging a Google code", async () => {
    let callback: any;
    registerOAuthRoutes({ get: (_path: string, handler: any) => { callback = handler; } } as any);
    const exchangeSpy = vi.spyOn(sdk, "exchangeGoogleCodeForToken").mockResolvedValue({ access_token: "token" } as any);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    await callback(
      { query: { code: "code", state: Buffer.from("http://evil.test/api/oauth/callback").toString("base64") }, protocol: "http", headers: { host: "127.0.0.1:3000" }, socket: {} },
      { status, json, cookie: vi.fn(), redirect: vi.fn() }
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(exchangeSpy).not.toHaveBeenCalled();
  });

  it("blocks Google accounts when email is not verified", async () => {
    let callback: any;
    registerOAuthRoutes({ get: (_path: string, handler: any) => { callback = handler; } } as any);
    vi.spyOn(sdk, "exchangeGoogleCodeForToken").mockResolvedValue({ access_token: "token" } as any);
    vi.spyOn(sdk, "getGoogleUserInfo").mockResolvedValue({ sub: "google-sub", email: "member-a1@test.local", email_verified: false, name: "[TEST] OAuth" } as any);
    const upsertSpy = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    const redirectUri = "http://127.0.0.1:3000/api/oauth/callback";
    await callback(
      { query: { code: "code", state: Buffer.from(redirectUri).toString("base64") }, protocol: "http", headers: { host: "127.0.0.1:3000" }, socket: {} },
      { status, json, cookie: vi.fn(), redirect: vi.fn() }
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("links an invited pre-registered user to a Google sub on first login", async () => {
    let callback: any;
    registerOAuthRoutes({ get: (_path: string, handler: any) => { callback = handler; } } as any);
    vi.spyOn(sdk, "exchangeGoogleCodeForToken").mockResolvedValue({ access_token: "token" } as any);
    vi.spyOn(sdk, "getGoogleUserInfo").mockResolvedValue({ sub: "google-member-a1", email: "member-a1@test.local", email_verified: true, name: "[TEST] Member A1" } as any);
    vi.spyOn(db, "getAllUsersByEmail").mockResolvedValue([{ ...users[5], openId: "invited_member_a1", loginStatus: "invited" }] as any);
    vi.spyOn(db, "getUserByOpenId").mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ...users[5], openId: "google-member-a1", loginStatus: "linked" } as any);
    const linkSpy = vi.spyOn(db, "linkUserOpenId").mockResolvedValue(undefined);
    const upsertSpy = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);
    vi.spyOn(sdk, "createSessionToken").mockResolvedValue("session-token");

    const redirect = vi.fn();
    const cookie = vi.fn();
    const redirectUri = "http://127.0.0.1:3000/api/oauth/callback";
    await callback(
      { query: { code: "code", state: Buffer.from(redirectUri).toString("base64") }, protocol: "http", headers: { host: "127.0.0.1:3000" }, socket: {} },
      { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), cookie, redirect }
    );

    expect(linkSpy).toHaveBeenCalledWith(users[5].id, "google-member-a1");
    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ openId: "google-member-a1", loginMethod: "google" }));
    expect(cookie).toHaveBeenCalledWith("app_session_id", "session-token", expect.objectContaining({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    }));
    expect(redirect).toHaveBeenCalledWith(302, "/");
  });

  it("blocks overwriting an already linked openId", async () => {
    let callback: any;
    registerOAuthRoutes({ get: (_path: string, handler: any) => { callback = handler; } } as any);
    vi.spyOn(sdk, "exchangeGoogleCodeForToken").mockResolvedValue({ access_token: "token" } as any);
    vi.spyOn(sdk, "getGoogleUserInfo").mockResolvedValue({ sub: "different-google-sub", email: "member-a1@test.local", email_verified: true, name: "[TEST] Member A1" } as any);
    vi.spyOn(db, "getAllUsersByEmail").mockResolvedValue([{ ...users[5], openId: "existing-google-sub", loginStatus: "linked" }] as any);
    const upsertSpy = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    vi.spyOn(db, "createActivityLog").mockResolvedValue(undefined);

    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    const redirectUri = "http://127.0.0.1:3000/api/oauth/callback";
    await callback(
      { query: { code: "code", state: Buffer.from(redirectUri).toString("base64") }, protocol: "http", headers: { host: "127.0.0.1:3000" }, socket: {} },
      { status, json, cookie: vi.fn(), redirect: vi.fn() }
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
