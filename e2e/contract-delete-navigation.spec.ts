import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const screenshotsDir = path.resolve(process.cwd(), "evidence/screenshots");

function serializeTrpc(data: unknown) {
  return { result: { data: SuperJSON.serialize(data) } };
}

test.beforeAll(() => {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
});

test.describe("BOA-CRM-AG02 Contract Delete Approval Navigation & Role Isolation", () => {
  test("Desktop: branch_admin clicks contract delete approval and arrives at /deleted-data requests tab", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "deleteRequests.listAllRequestsForAdmin") {
          return serializeTrpc([
            {
              id: 991,
              targetType: "contract",
              targetId: 501,
              customerId: 201,
              requestedBy: 3,
              status: "pending",
              requestReason: "고객 단순 변심 및 타사 전환 요청",
              reviewComment: null,
              reviewedBy: null,
              reviewedAt: null,
              createdAt: new Date().toISOString(),
              customer: { id: 201, name: "홍길동" },
              contract: {
                id: 501,
                productName: "무배당 프리미엄 건강보험",
                monthlyPremium: 125000,
              },
              requester: { id: 3, name: "이팀장" },
            },
          ]);
        }
        return defaultResponse;
      },
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // 1. Verify AdminAttentionSection exists
    const attentionSection = page.locator('[data-testid="dashboard-admin-attention"]');
    await expect(attentionSection).toBeVisible();

    // 2. Capture Dashboard Before Click
    await page.screenshot({
      path: path.join(screenshotsDir, "ag02-desktop-dashboard-before-click.png"),
      fullPage: false,
    });

    // 3. Find Contract Delete Approval Card
    const contractDeleteCard = attentionSection
      .locator(".crm-dashboard-card")
      .filter({ hasText: "계약 삭제 승인" });
    await expect(contractDeleteCard).toBeVisible();
    await expect(contractDeleteCard).toContainText("처리 대기 중인 계약 요청");
    await expect(contractDeleteCard).toContainText("1");

    // 4. Click Review Button
    const reviewBtn = contractDeleteCard.getByRole("button", { name: "검토" });
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // 5. Assert URL is /deleted-data
    await page.waitForURL("**/deleted-data");
    expect(page.url()).toContain("/deleted-data");

    // 6. Verify Deleted Data Management page and active tab
    await expect(page.getByRole("heading", { name: "삭제 데이터 관리" })).toBeVisible();
    const requestsTab = page.getByRole("tab", { name: "삭제 요청" });
    await expect(requestsTab).toBeVisible();
    await expect(requestsTab).toHaveAttribute("data-state", "active");

    // 7. Verify pending request item is displayed and visible
    await expect(page.locator("text=홍길동").locator("visible=true")).toBeVisible();
    await expect(page.locator("text=무배당 프리미엄 건강보험").locator("visible=true")).toBeVisible();
    await expect(page.locator("text=고객 단순 변심 및 타사 전환 요청").locator("visible=true")).toBeVisible();

    // 8. Capture Destination Screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "ag02-desktop-deleted-data-requests-tab.png"),
      fullPage: false,
    });

    expect(consoleErrors.length).toBe(0);
  });

  test("Mobile: branch_admin clicks contract delete approval and quick action", async ({
    page,
  }) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.goto("/", { waitUntil: "networkidle" });

    // 1. Test AdminAttentionSection card
    const attentionSection = page.locator('[data-testid="dashboard-admin-attention"]');
    await expect(attentionSection).toBeVisible();
    const contractDeleteCard = attentionSection
      .locator(".crm-dashboard-card")
      .filter({ hasText: "계약 삭제 승인" });
    await expect(contractDeleteCard).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "ag02-mobile-dashboard-before-click.png"),
      fullPage: false,
    });

    const reviewBtn = contractDeleteCard.getByRole("button", { name: "검토" });
    await reviewBtn.click();

    await page.waitForURL("**/deleted-data");
    expect(page.url()).toContain("/deleted-data");
    await expect(page.getByRole("heading", { name: "삭제 데이터 관리" })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "ag02-mobile-deleted-data-destination.png"),
      fullPage: false,
    });

    // 2. Go back to Dashboard and test Quick Action button
    await page.goto("/", { waitUntil: "networkidle" });
    const quickActionBtn = page.getByRole("button", { name: /계약 요청/i });
    await expect(quickActionBtn).toBeVisible();
    await quickActionBtn.click();

    await page.waitForURL("**/deleted-data");
    expect(page.url()).toContain("/deleted-data");
    await expect(page.getByRole("heading", { name: "삭제 데이터 관리" })).toBeVisible();
  });

  test("Empty state displays correctly when pending requests = 0", async ({
    page,
  }) => {
    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "deleteRequests.listAllRequestsForAdmin") {
          return serializeTrpc([]);
        }
        return defaultResponse;
      },
    });

    await page.goto("/deleted-data", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "삭제 데이터 관리" })).toBeVisible();
    await expect(page.locator("text=대기 중인 요청이 없습니다.").locator("visible=true")).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, "ag02-empty-state.png"),
      fullPage: false,
    });
  });

  test("Other dashboard attention and quick links remain intact", async ({
    page,
  }) => {
    await mockBoaTrpc(page, "branch_admin");
    await page.goto("/", { waitUntil: "networkidle" });

    const attentionSection = page.locator('[data-testid="dashboard-admin-attention"]');

    // 1. Schedule approvals navigation
    const scheduleCard = attentionSection
      .locator(".crm-dashboard-card")
      .filter({ hasText: "일정 변경 승인" });
    await scheduleCard.getByRole("button", { name: "검토" }).click();
    await page.waitForURL("**/schedule-change-requests");
    expect(page.url()).toContain("/schedule-change-requests");

    // 2. Operation risk navigation
    await page.goto("/", { waitUntil: "networkidle" });
    const riskCard = page
      .locator('[data-testid="dashboard-admin-attention"]')
      .locator(".crm-dashboard-card")
      .filter({ hasText: "운영 위험 신호" });
    await riskCard.getByRole("button", { name: "검토" }).click();
    await page.waitForURL("**/operation-risk");
    expect(page.url()).toContain("/operation-risk");
  });

  test("Role Isolation: non-branch_admin roles do NOT see admin attention or contract deletion quick actions", async ({
    page,
  }) => {
    const roles = ["sub_branch_admin", "team_leader", "member"] as const;

    for (const role of roles) {
      await mockBoaTrpc(page, role);
      await page.goto("/", { waitUntil: "networkidle" });

      // Admin attention section must NOT exist
      const attentionSection = page.locator('[data-testid="dashboard-admin-attention"]');
      await expect(attentionSection).toHaveCount(0);

      // Contract deletion approval button must NOT exist
      await expect(page.getByText("계약 삭제 승인")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /계약 요청/i })).toHaveCount(0);

      // Direct URL navigation check: non-branch_admin accessing /deleted-data must be denied by RouteAccessGuard
      await page.goto("/deleted-data", { waitUntil: "networkidle" });
      const forbiddenOrDenied =
        (await page.getByText("접근 권한이 없습니다").count()) > 0 ||
        (await page.getByRole("heading", { name: "삭제 데이터 관리" }).count()) === 0;
      expect(forbiddenOrDenied).toBe(true);
    }
  });
});
