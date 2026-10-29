import { expect, test } from "@playwright/test";
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

const mockUsers = [
  { id: 101, name: "김철수", role: "member", accountStatus: "active", teamId: 1, subBranchAdminId: null },
  { id: 102, name: "김영희", role: "member", accountStatus: "active", teamId: 1, subBranchAdminId: null },
  { id: 103, name: "김영희", role: "team_leader", accountStatus: "active", teamId: 2, subBranchAdminId: null },
  { id: 104, name: "박지점", role: "branch_admin", accountStatus: "active", teamId: null, subBranchAdminId: null },
  { id: 105, name: "이퇴사", role: "member", accountStatus: "resigned", teamId: 1, subBranchAdminId: null },
  { id: 106, name: "최비활", role: "member", accountStatus: "inactive", teamId: 1, subBranchAdminId: null },
  { id: 107, name: "검수전용이름이매우긴직원가나다라마바사아자차카타파하", role: "member", accountStatus: "active", teamId: 1, subBranchAdminId: null },
];

const mockTemplates = [
  {
    id: 1,
    name: "신입 팀원 온보딩 30일 코스",
    targetRole: "member",
    isActive: true,
    archivedAt: null,
  },
];

test.describe("BOA-CRM-AG03 Onboarding User Name Search & Select", () => {
  test("Desktop (1440px): branch_admin searches by name, differentiates duplicate names, selects target & trainer, and assigns", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    let assignPayload: any = null;

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse, input) => {
        if (procedure === "users.list") {
          return serializeTrpc(mockUsers);
        }
        if (procedure === "onboardingTemplates.list") {
          return serializeTrpc(mockTemplates);
        }
        if (procedure === "onboardingAssignments.summary") {
          return serializeTrpc({
            total: 3,
            inProgress: 2,
            completed: 1,
            overdue: 0,
            approvalPending: 0,
            requiredIncomplete: 1,
          });
        }
        if (procedure === "onboardingAssignments.list") {
          return serializeTrpc([]);
        }
        if (procedure === "onboardingAssignments.getMine") {
          return serializeTrpc([]);
        }
        if (procedure === "onboardingAssignments.assign") {
          assignPayload = input;
          return serializeTrpc({
            id: 901,
            targetUserId: input?.targetUserId ?? 101,
            templateId: input?.templateId ?? 1,
            trainerUserId: input?.trainerUserId,
            status: "assigned",
          });
        }
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    // 1. Verify Header & Description
    await expect(page.getByRole("heading", { name: "온보딩·교육 체크리스트" })).toBeVisible();
    await expect(page.getByText("대상 직원을 선택해 템플릿을 배정합니다.")).toBeVisible();

    // 2. Initial Screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-desktop-1440-initial.png"),
      fullPage: false,
    });

    // 3. Verify Target User Select trigger exists and raw ID input is NOT present
    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await expect(targetTrigger).toBeVisible();
    await expect(targetTrigger).toContainText("대상 직원 선택");

    // 4. Verify assign button is initially disabled
    const assignBtn = page.locator('[data-testid="assign-onboarding-btn"]');
    await expect(assignBtn).toBeVisible();
    await expect(assignBtn).toBeDisabled();

    // 5. Open Target User Select Popover
    await targetTrigger.click();

    const searchInput = page.locator('[data-testid="target-user-search-input"]');
    await expect(searchInput).toBeVisible();

    // Inactive/resigned users must NOT be in the option list
    await expect(page.locator('[data-testid="target-user-option-105"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="target-user-option-106"]')).toHaveCount(0);

    // 6. Test duplicate name search: Search "김영희"
    await searchInput.fill("김영희");

    const option102 = page.locator('[data-testid="target-user-option-102"]');
    const option103 = page.locator('[data-testid="target-user-option-103"]');
    await expect(option102).toBeVisible();
    await expect(option103).toBeVisible();

    // Verify role badges and IDs differentiate duplicate names
    await expect(option102).toContainText("김영희");
    await expect(option102).toContainText("팀원");
    await expect(option102).toContainText("#102");
    await expect(option102).toContainText("동명이인");

    await expect(option103).toContainText("김영희");
    await expect(option103).toContainText("팀장");
    await expect(option103).toContainText("#103");
    await expect(option103).toContainText("동명이인");

    // Capture Duplicate Name Search Screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-desktop-target-search-duplicates.png"),
      fullPage: false,
    });

    // 7. Select option 102
    await option102.click();

    // Verify popover closed and trigger shows selected user details
    await expect(targetTrigger).toContainText("김영희");
    await expect(targetTrigger).toContainText("팀원");
    await expect(targetTrigger).toContainText("#102");

    // 8. Test Clear / Reset Button
    const clearBtn = page.locator('[data-testid="target-user-clear-btn"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(targetTrigger).toContainText("대상 직원 선택");

    // 9. Now select "김철수" (#101)
    await targetTrigger.click();
    await searchInput.fill("김철수");
    const option101 = page.locator('[data-testid="target-user-option-101"]');
    await expect(option101).toBeVisible();
    await option101.click();
    await expect(targetTrigger).toContainText("김철수");

    // 10. Select Template
    const templateTrigger = page.locator('[data-testid="template-select-trigger"]');
    await templateTrigger.click();
    const templateOption = page.locator('[data-testid="template-option-1"]');
    await expect(templateOption).toBeVisible();
    await templateOption.click();

    // 11. Select Trainer: Search "박지점" (#104)
    const trainerTrigger = page.locator('[data-testid="trainer-user-trigger"]');
    await expect(trainerTrigger).toBeVisible();
    await trainerTrigger.click();

    const trainerSearchInput = page.locator('[data-testid="trainer-user-search-input"]');
    await expect(trainerSearchInput).toBeVisible();
    await trainerSearchInput.fill("박지점");

    const trainerOption104 = page.locator('[data-testid="trainer-user-option-104"]');
    await expect(trainerOption104).toBeVisible();
    await trainerOption104.click();

    await expect(trainerTrigger).toContainText("박지점");
    await expect(trainerTrigger).toContainText("지점장");

    // Capture Filled Form Screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-desktop-form-ready.png"),
      fullPage: false,
    });

    // 12. Verify Assign Button is now enabled
    await expect(assignBtn).toBeEnabled();

    // 13. Click Assign
    await assignBtn.click();

    // 14. Verify success toast and form reset
    await expect(page.getByText("온보딩 체크리스트 배정을 완료했습니다.")).toBeVisible();
    await expect(targetTrigger).toContainText("대상 직원 선택");

    // 15. Verify payload sent
    expect(assignPayload).not.toBeNull();
    expect(assignPayload.targetUserId).toBe(101);
    expect(assignPayload.templateId).toBe(1);
    expect(assignPayload.trainerUserId).toBe(104);
  });

  test("Optional Trainer & Clear: Submits without trainerUserId when cleared", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    let assignPayload: any = null;

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse, input) => {
        if (procedure === "users.list") return serializeTrpc(mockUsers);
        if (procedure === "onboardingTemplates.list") return serializeTrpc(mockTemplates);
        if (procedure === "onboardingAssignments.summary") {
          return serializeTrpc({
            total: 1,
            inProgress: 1,
            completed: 0,
            overdue: 0,
            approvalPending: 0,
            requiredIncomplete: 1,
          });
        }
        if (procedure === "onboardingAssignments.list") return serializeTrpc([]);
        if (procedure === "onboardingAssignments.getMine") return serializeTrpc([]);
        if (procedure === "onboardingAssignments.assign") {
          assignPayload = input;
          return serializeTrpc({
            id: 902,
            targetUserId: input?.targetUserId,
            templateId: input?.templateId,
            status: "assigned",
          });
        }
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    // Select target user
    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await targetTrigger.click();
    await page.locator('[data-testid="target-user-search-input"]').fill("김철수");
    await page.locator('[data-testid="target-user-option-101"]').click();

    // Select template
    await page.locator('[data-testid="template-select-trigger"]').click();
    await page.locator('[data-testid="template-option-1"]').click();

    // Select trainer, then clear trainer
    const trainerTrigger = page.locator('[data-testid="trainer-user-trigger"]');
    await trainerTrigger.click();
    await page.locator('[data-testid="trainer-user-option-104"]').click();
    await expect(trainerTrigger).toContainText("박지점");

    // Click trainer clear button
    const trainerClearBtn = page.locator('[data-testid="trainer-user-clear-btn"]');
    await expect(trainerClearBtn).toBeVisible();
    await trainerClearBtn.click();
    await expect(trainerTrigger).toContainText("선택 (선택사항)");

    // Assign
    const assignBtn = page.locator('[data-testid="assign-onboarding-btn"]');
    await expect(assignBtn).toBeEnabled();
    await assignBtn.click();

    await expect(page.getByText("온보딩 체크리스트 배정을 완료했습니다.")).toBeVisible();

    expect(assignPayload).not.toBeNull();
    expect(assignPayload.targetUserId).toBe(101);
    expect(assignPayload.templateId).toBe(1);
    expect(assignPayload.trainerUserId).toBeUndefined();
  });

  test("Empty Search Results: Shows guidance message when search matches 0 candidates", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "users.list") return serializeTrpc(mockUsers);
        if (procedure === "onboardingTemplates.list") return serializeTrpc(mockTemplates);
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await targetTrigger.click();

    const searchInput = page.locator('[data-testid="target-user-search-input"]');
    await searchInput.fill("전혀없는사람");

    const emptyMsg = page.locator('[data-testid="target-user-empty"]');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toContainText("배정 가능한 직원이 없습니다.");

    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-desktop-1280-empty-search.png"),
      fullPage: false,
    });
  });

  test("Role Scoping: team_leader sees only members as candidate targets", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await mockBoaTrpc(page, "team_leader", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "users.list") return serializeTrpc(mockUsers);
        if (procedure === "onboardingTemplates.list") return serializeTrpc(mockTemplates);
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await targetTrigger.click();

    // Members 101, 102 should be visible
    await expect(page.locator('[data-testid="target-user-option-101"]')).toBeVisible();
    await expect(page.locator('[data-testid="target-user-option-102"]')).toBeVisible();

    // team_leader (103) and branch_admin (104) must NOT be options for team_leader target
    await expect(page.locator('[data-testid="target-user-option-103"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="target-user-option-104"]')).toHaveCount(0);

    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-team-leader-role-scoping.png"),
      fullPage: false,
    });
  });

  test("Role Isolation: member does NOT see checklist assignment section", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await mockBoaTrpc(page, "member", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "onboardingAssignments.getMine") return serializeTrpc([]);
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    // Verify member sees own checklist heading
    await expect(page.getByRole("heading", { name: "내 교육 체크리스트" })).toBeVisible();

    // Assignment section must NOT exist
    await expect(page.getByText("체크리스트 배정")).toHaveCount(0);
    await expect(page.locator('[data-testid="target-user-trigger"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="assign-onboarding-btn"]')).toHaveCount(0);

    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-member-no-assignment-ui.png"),
      fullPage: false,
    });
  });

  test("Tablet Viewport (768px): Touch & search works without layout breaks, center tap opens combobox and does not hit clear button", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "users.list") return serializeTrpc(mockUsers);
        if (procedure === "onboardingTemplates.list") return serializeTrpc(mockTemplates);
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await expect(targetTrigger).toBeVisible();
    await targetTrigger.click();

    // Select the long name user
    const searchInput = page.locator('[data-testid="target-user-search-input"]');
    await searchInput.fill("매우긴직원");
    const option107 = page.locator('[data-testid="target-user-option-107"]');
    await expect(option107).toBeVisible();
    await option107.click();

    // Verify long name is selected
    await expect(targetTrigger).toContainText("#107");

    // Verify trigger width at 768px (should be >= 180px with 2-column layout, not compressed to 80px)
    const triggerBox = await targetTrigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.width).toBeGreaterThanOrEqual(180);

    // Hit test at trigger horizontal center
    const centerHit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return {
          tag: el?.tagName,
          testId: el?.getAttribute("data-testid"),
          closestTestId: el?.closest("[data-testid]")?.getAttribute("data-testid"),
        };
      },
      { x: triggerBox!.x + triggerBox!.width / 2, y: triggerBox!.y + triggerBox!.height / 2 }
    );

    // Must NOT hit the clear button at trigger center!
    expect(centerHit.testId).not.toBe("target-user-clear-btn");
    expect(centerHit.closestTestId).toBe("target-user-trigger");

    // Center click opens the combobox popover
    await page.mouse.click(
      triggerBox!.x + triggerBox!.width / 2,
      triggerBox!.y + triggerBox!.height / 2
    );
    await expect(searchInput).toBeVisible();
    await expect(targetTrigger).toHaveAttribute("aria-expanded", "true");

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(targetTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(targetTrigger).toContainText("#107");

    // Direct click on clear button resets selection
    const clearBtn = page.locator('[data-testid="target-user-clear-btn"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(targetTrigger).toContainText("대상 직원 선택");

    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-tablet-768-selected.png"),
      fullPage: false,
    });
  });

  test("Mobile Viewports (390px & 360px): Accessible touch targets, no horizontal overflow with long names, no element interception", async ({
    page,
  }) => {
    let assignPayload: any = null;

    // 1. Mobile 390px (iPhone 12/13/14)
    await page.setViewportSize({ width: 390, height: 844 });

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse, input) => {
        if (procedure === "users.list") return serializeTrpc(mockUsers);
        if (procedure === "onboardingTemplates.list") return serializeTrpc(mockTemplates);
        if (procedure === "onboardingAssignments.summary") {
          return serializeTrpc({
            total: 1,
            inProgress: 1,
            completed: 0,
            overdue: 0,
            approvalPending: 0,
            requiredIncomplete: 1,
          });
        }
        if (procedure === "onboardingAssignments.list") return serializeTrpc([]);
        if (procedure === "onboardingAssignments.getMine") return serializeTrpc([]);
        if (procedure === "onboardingAssignments.assign") {
          assignPayload = input;
          return serializeTrpc({
            id: 903,
            targetUserId: input?.targetUserId,
            templateId: input?.templateId,
            status: "assigned",
          });
        }
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await expect(targetTrigger).toBeVisible();

    // Check trigger touch target height >= 40px
    const triggerBox = await targetTrigger.boundingBox();
    expect(triggerBox?.height).toBeGreaterThanOrEqual(40);

    // Select long name user as target
    await targetTrigger.click();
    const searchInput = page.locator('[data-testid="target-user-search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("매우긴직원");
    const option107 = page.locator('[data-testid="target-user-option-107"]');
    await expect(option107).toBeVisible();
    await option107.click();
    await expect(targetTrigger).toContainText("#107");

    // Select template
    const templateTrigger = page.locator('[data-testid="template-select-trigger"]');
    await templateTrigger.click();
    await page.locator('[data-testid="template-option-1"]').click();

    // Select long name user as trainer too
    const trainerTrigger = page.locator('[data-testid="trainer-user-trigger"]');
    await trainerTrigger.click();
    const trainerSearchInput = page.locator('[data-testid="trainer-user-search-input"]');
    await trainerSearchInput.fill("매우긴직원");
    const trainerOption107 = page.locator('[data-testid="trainer-user-option-107"]');
    await expect(trainerOption107).toBeVisible();
    await trainerOption107.click();
    await expect(trainerTrigger).toContainText("#107");

    // CRITICAL ASSERTION: Zero horizontal overflow on 390px viewport
    const overflow390 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow390).toBe(0);

    // CRITICAL ASSERTION: Assignment button is NOT intercepted by any label or grid element
    const assignBtn = page.locator('[data-testid="assign-onboarding-btn"]');
    await expect(assignBtn).toBeEnabled();
    await assignBtn.click();
    await expect(page.getByText("온보딩 체크리스트 배정을 완료했습니다.")).toBeVisible();

    expect(assignPayload).not.toBeNull();
    expect(assignPayload.targetUserId).toBe(107);
    expect(assignPayload.trainerUserId).toBe(107);

    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-mobile-390-user-selected.png"),
      fullPage: false,
    });

    // 2. Mobile 360px (Galaxy S compact)
    await page.setViewportSize({ width: 360, height: 740 });
    await targetTrigger.click();
    await expect(searchInput).toBeVisible();

    // Verify popover does not exceed viewport width
    const popoverList = page.locator('[data-testid="target-user-list"]');
    const listBoundingBox = await popoverList.boundingBox();
    expect(listBoundingBox?.width).toBeLessThanOrEqual(360);

    // Select long name at 360px
    await searchInput.fill("매우긴직원");
    await option107.click();
    await expect(targetTrigger).toContainText("#107");

    // CRITICAL ASSERTION: Zero horizontal overflow on 360px viewport
    const overflow360 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow360).toBe(0);

    await page.screenshot({
      path: path.join(screenshotsDir, "ag03-mobile-360-search-open.png"),
      fullPage: false,
    });
  });

  test("Keyboard Navigation: Arrow keys navigate candidate list and Enter selects option", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "users.list") return serializeTrpc(mockUsers);
        if (procedure === "onboardingTemplates.list") return serializeTrpc(mockTemplates);
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await targetTrigger.click();

    const searchInput = page.locator('[data-testid="target-user-search-input"]');
    await expect(searchInput).toBeVisible();

    // Search "김" which returns 3 candidates: 101 (김철수), 102 (김영희), 103 (김영희)
    await searchInput.fill("김");
    await expect(page.locator('[data-testid="target-user-option-101"]')).toBeVisible();
    await expect(page.locator('[data-testid="target-user-option-102"]')).toBeVisible();
    await expect(page.locator('[data-testid="target-user-option-103"]')).toBeVisible();

    // Navigate with arrow keys
    await searchInput.press("ArrowDown");
    const firstActive = await searchInput.getAttribute("aria-activedescendant");
    expect(firstActive).not.toBeNull();

    // Press ArrowDown to move to next candidate
    await searchInput.press("ArrowDown");
    const secondActive = await searchInput.getAttribute("aria-activedescendant");
    expect(secondActive).not.toBeNull();

    // Press Enter to select
    await searchInput.press("Enter");

    // Popover closes and target is selected
    await expect(targetTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(targetTrigger).not.toContainText("대상 직원 선택");
  });

  test("Stale Selection Guard: Prevents submission when selected user becomes inactive or removed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    let currentUsers = [...mockUsers];

    await mockBoaTrpc(page, "branch_admin", {
      transformResponse: (procedure, defaultResponse) => {
        if (procedure === "users.list") return serializeTrpc(currentUsers);
        if (procedure === "onboardingTemplates.list") return serializeTrpc(mockTemplates);
        return defaultResponse;
      },
    });

    await page.goto("/onboarding-checklists", { waitUntil: "networkidle" });

    // Select target user 101
    const targetTrigger = page.locator('[data-testid="target-user-trigger"]');
    await targetTrigger.click();
    await page.locator('[data-testid="target-user-search-input"]').fill("김철수");
    await page.locator('[data-testid="target-user-option-101"]').click();

    // Select template
    await page.locator('[data-testid="template-select-trigger"]').click();
    await page.locator('[data-testid="template-option-1"]').click();

    // Assign button is initially enabled
    const assignBtn = page.locator('[data-testid="assign-onboarding-btn"]');
    await expect(assignBtn).toBeEnabled();

    // Now simulate user 101 becoming inactive / removed in subsequent refetch
    currentUsers = currentUsers.filter(u => u.id !== 101);

    // Trigger TanStack Query refetch via offline/online toggle
    await page.context().setOffline(true);
    await page.waitForTimeout(150);
    await page.context().setOffline(false);

    // Verify assign button becomes disabled once invalid target is detected
    await expect(assignBtn).toBeDisabled();
  });
});
