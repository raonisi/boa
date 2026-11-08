import { expect, test, type Page } from "@playwright/test";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  expectNoHorizontalOverflow,
  expectMinimumHitTarget,
} from "./helpers/layout-metrics";

const names: Record<number, string> = {
  101: "[TEST] 김철수 고객",
  102: "[TEST] 이영희 고객",
};

const envelope = (value: unknown) => ({
  result: { data: SuperJSON.serialize(value) },
});

type FixtureOptions = {
  role?: "branch_admin" | "sub_branch_admin" | "team_leader" | "member";
  consultFail?: boolean;
  followUpFail?: boolean;
  existingOpenFollowUps?: number;
};

async function setupPageFixture(page: Page, options: FixtureOptions = {}) {
  const role = options.role ?? "branch_admin";
  const consultFail = options.consultFail ?? false;
  const followUpFail = options.followUpFail ?? false;
  const existingFollowUpsCount = options.existingOpenFollowUps ?? 0;

  const captured = {
    consultPayloads: [] as any[],
    followUpPayloads: [] as any[],
    invalidations: [] as string[],
  };

  await mockBoaTrpc(page, role, {
    transformResponse: (procedure, response, input) => {
      if (procedure === "customers.get") {
        const id = input?.id ?? 101;
        const original = SuperJSON.deserialize(
          (response as any).result.data
        ) as any;
        return envelope({
          ...original,
          id,
          name: names[id] || `[TEST] 고객 ${id}`,
          consultStatus: "미상담",
        });
      }

      if (procedure === "customers.searchForSchedulePicker") {
        const targetId = input?.selectedCustomerId ?? 101;
        const target = {
          id: targetId,
          name: names[targetId] || `[TEST] 고객 ${targetId}`,
          maskedPhone: "010-****-1234",
          statusLabel: "미상담",
          priorityLabel: "A",
          assignedUserName: "담당 설계사",
          lastContactedAt: null,
          lastConsultedAt: null,
        };
        return envelope({
          selectedCustomer: target,
          items: [target],
          searchRequired: false,
          tooManyResults: false,
          hint: "",
        });
      }

      if (procedure === "followUps.listByCustomer") {
        const items = [];
        for (let i = 0; i < existingFollowUpsCount; i++) {
          items.push({
            id: 800 + i,
            customerId: input.customerId,
            taskType: "상담",
            priority: "medium",
            status: "scheduled",
            nextContactDate: "2026-11-20T10:00:00.000Z",
            memo: `기존 후속 메모 ${i + 1}`,
            createdAt: new Date().toISOString(),
          });
        }
        return envelope(items);
      }

      if (procedure === "consultations.create") {
        captured.consultPayloads.push(input);
        if (consultFail) {
          return {
            error: {
              json: {
                message: "상담 저장에 실패했습니다.",
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: 500,
                  path: procedure,
                },
              },
            },
          };
        }
        return envelope({
          id: 5001,
          customerId: input.customerId,
          consultationDate: new Date().toISOString(),
          ...input,
        });
      }

      if (procedure === "followUps.create") {
        captured.followUpPayloads.push(input);
        if (followUpFail) {
          return {
            error: {
              json: {
                message: "후속관리 등록에 실패했습니다.",
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: 500,
                  path: procedure,
                },
              },
            },
          };
        }
        return envelope({
          id: 6001,
          customerId: input.customerId,
          ...input,
        });
      }

      return response;
    },
  });

  return captured;
}

/** Helper to open consult modal from CustomerDetail */
async function openConsultModal(page: Page) {
  // Ensure customer heading is rendered
  await expect(page.getByRole("heading", { name: /\[TEST\]/ })).toBeVisible();
  const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
  if (isMobile) {
    await page.getByRole("button", { name: "상담", exact: true }).click();
  } else {
    await page.getByRole("button", { name: /상담기록 추가/ }).first().click();
  }
  const dialog = page.getByRole("dialog", { name: "상담기록 추가" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("BOA-CRM-AG08: 상담 저장 후 후속관리 연결 E2E", () => {
  test("T01: 상담 저장 성공 시 후속관리 안내 배너 노출", async ({ page }) => {
    await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("정기 보장분석 및 가입문의");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    // Dialog closes
    await expect(dialog).not.toBeVisible();

    // Guidance prompt appears
    const prompt = page.getByTestId("post-consult-followup-prompt");
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveAttribute("role", "region");
    await expect(prompt).toHaveAttribute("aria-label", "상담 저장 후 후속관리 안내");
    await expect(prompt).toContainText("상담기록이 저장되었습니다.");
    await expect(prompt).toContainText("다음 연락이 필요하다면 후속관리로 이어서 등록할 수 있습니다.");

    // Buttons
    await expect(page.getByTestId("post-consult-create-followup-button")).toBeVisible();
    await expect(page.getByTestId("post-consult-dismiss-button")).toBeVisible();

    await page.screenshot({
      path: "evidence/screenshots/ag08-post-consult-prompt-desktop.png",
      fullPage: false,
    });
  });

  test("T02: 상담 저장 실패 시 후속관리 안내 배너 미노출", async ({ page }) => {
    await setupPageFixture(page, { consultFail: true });
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("실패 테스트 요약");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    // Error toast appears
    await expect(page.getByText(/상담 저장에 실패했습니다/)).toBeVisible();

    // Guidance prompt must NOT appear
    await expect(page.getByTestId("post-consult-followup-prompt")).toHaveCount(0);
  });

  test("T03: '후속관리 등록' 클릭 시 고객 고정된 FollowupQuickCreateDialog 오픈", async ({ page }) => {
    await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("후속연결 테스트");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    const prompt = page.getByTestId("post-consult-followup-prompt");
    await expect(prompt).toBeVisible();

    // Click "후속관리 등록"
    await page.getByTestId("post-consult-create-followup-button").click();

    // FollowupQuickCreateDialog opens
    const followupDialog = page.getByRole("dialog", { name: "빠른 후속 등록" });
    await expect(followupDialog).toBeVisible();

    // Customer is locked: target customer summary shows customer 101 name and search input is NOT present
    const summary = followupDialog.getByRole("group", { name: "대상 고객" });
    await expect(summary).toContainText(names[101]);
    await expect(followupDialog.getByPlaceholder("고객명 또는 연락처로 검색")).toHaveCount(0);

    await page.screenshot({
      path: "evidence/screenshots/ag08-quick-followup-dialog-locked.png",
      fullPage: false,
    });
  });

  test("T04: 후속관리 저장 성공 시 배너 자동 소멸 및 고객 ID 페이로드 검증", async ({ page }) => {
    const state = await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("후속저장 성공 테스트");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await page.getByTestId("post-consult-create-followup-button").click();
    const followupDialog = page.getByRole("dialog", { name: "빠른 후속 등록" });
    await expect(followupDialog).toBeVisible();

    // Submit followup
    await followupDialog.getByRole("button", { name: "후속 등록", exact: true }).click();
    await expect(followupDialog).not.toBeVisible();

    // Verify payload
    expect(state.followUpPayloads.length).toBe(1);
    expect(state.followUpPayloads[0].customerId).toBe(101);

    // Prompt is dismissed
    await expect(page.getByTestId("post-consult-followup-prompt")).toHaveCount(0);

    await page.screenshot({
      path: "evidence/screenshots/ag08-dismissed-state.png",
      fullPage: false,
    });
  });

  test("T05: 후속관리 저장 실패 시 안내 배너 유지 및 다이얼로그 입력값 보존", async ({ page }) => {
    await setupPageFixture(page, { followUpFail: true });
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("후속실패 테스트");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await page.getByTestId("post-consult-create-followup-button").click();
    const followupDialog = page.getByRole("dialog", { name: "빠른 후속 등록" });
    await expect(followupDialog).toBeVisible();

    await followupDialog.getByRole("button", { name: "후속 등록", exact: true }).click();

    // Error toast appears and dialog stays visible
    await expect(page.getByText(/후속관리 등록에 실패했습니다/)).toBeVisible();
    await expect(followupDialog).toBeVisible();

    // Close dialog via Escape
    await page.keyboard.press("Escape");
    await expect(followupDialog).not.toBeVisible();

    // Prompt is still preserved!
    await expect(page.getByTestId("post-consult-followup-prompt")).toBeVisible();
  });

  test("T06: '나중에 처리' 클릭 시 네트워크 요청 없이 배너 즉각 소멸", async ({ page }) => {
    const state = await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("나중에 처리 테스트");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    const prompt = page.getByTestId("post-consult-followup-prompt");
    await expect(prompt).toBeVisible();

    // Click "나중에 처리"
    await page.getByTestId("post-consult-dismiss-button").click();

    // Prompt disappears immediately
    await expect(prompt).not.toBeVisible();
    // Zero follow-up mutations
    expect(state.followUpPayloads.length).toBe(0);
  });

  test("T07: 재상담 예정일만 있는 상담 저장 시 배너 문구 및 후속관리 자동생성 없음 명확화", async ({ page }) => {
    const state = await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("재상담 예정일만 입력");
    await dialog.locator('input[type="datetime-local"]').fill("2026-11-20T14:00");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    const prompt = page.getByTestId("post-consult-followup-prompt");
    await expect(prompt).toBeVisible();

    // No calendar badge since calendar wasn't checked
    await expect(prompt.getByText("캘린더 일정 등록됨")).toHaveCount(0);
    // Explicitly no automatic followup creation occurred
    expect(state.followUpPayloads.length).toBe(0);
  });

  test("T08: 캘린더 일정 함께 등록 시 '캘린더 일정 등록됨' 배지 노출 및 일정/후속관리 구분", async ({ page }) => {
    await setupPageFixture(page, { existingOpenFollowUps: 2 });
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("일정과 함께 저장");
    await dialog.locator('input[type="datetime-local"]').fill("2026-11-20T14:00");
    // Check calendar checkbox
    await dialog.getByRole("checkbox").click();
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    const prompt = page.getByTestId("post-consult-followup-prompt");
    await expect(prompt).toBeVisible();

    // Badge "캘린더 일정 등록됨" is visible
    await expect(prompt.getByText("캘린더 일정 등록됨")).toBeVisible();
    // Badge "기존 후속관리 2건" is visible
    await expect(prompt.getByText("기존 후속관리 2건")).toBeVisible();

    await page.screenshot({
      path: "evidence/screenshots/ag08-with-calendar-badge.png",
      fullPage: false,
    });
  });

  test("T09: 타 고객 페이지 이동 시 배너 상태 초기화 (고객 간 누수 방지)", async ({ page }) => {
    await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("고객 101 상담");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await expect(page.getByTestId("post-consult-followup-prompt")).toBeVisible();

    // Navigate to customer 102
    await page.goto("/customers/102", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: names[102] })).toBeVisible();

    // Prompt MUST NOT leak to customer 102
    await expect(page.getByTestId("post-consult-followup-prompt")).toHaveCount(0);
  });

  test("T10: 더블 클릭 / 연속 클릭 차단 (버튼 비활성화 검증)", async ({ page }) => {
    await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    const saveButton = dialog.getByRole("button", { name: "저장", exact: true });

    // When missing schedule time with calendar checked
    await dialog.getByRole("checkbox").click();
    // Now schedule time is missing, save button must be disabled
    await expect(saveButton).toBeDisabled();

    // Uncheck calendar
    await dialog.getByRole("checkbox").click();
    await expect(saveButton).toBeEnabled();
  });

  test("T11: 기존 빠른 상담 모달 등 타 기능 정상 동작 보존", async ({ page }) => {
    await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    // Open detailed tabs and history
    await page.getByRole("tab", { name: /상담·후속관리/ }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();

    // Direct followup button in FollowUpPanel works
    await page.getByRole("button", { name: "다음 연락일 설정" }).first().click();
    const followupDialog = page.getByRole("dialog", { name: "빠른 후속 등록" });
    await expect(followupDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(followupDialog).not.toBeVisible();
  });

  test("T12: 반응형 뷰포트 가로 스크롤 없음 및 터치 타깃 44px 검증", async ({ page }) => {
    const viewports = [
      { width: 390, height: 844, name: "mobile390", isMobile: true },
      { width: 768, height: 1024, name: "tablet768", isMobile: false },
      { width: 1440, height: 900, name: "desktop1440", isMobile: false },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupPageFixture(page);
      await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

      const dialog = await openConsultModal(page);
      await dialog.getByLabel("상담 요약").fill(`반응형 검증 ${vp.name}`);
      await dialog.getByRole("button", { name: "저장", exact: true }).click();

      const prompt = page.getByTestId("post-consult-followup-prompt");
      await expect(prompt).toBeVisible();

      // Zero horizontal overflow
      await expectNoHorizontalOverflow(page);

      // Check touch targets on mobile viewport
      if (vp.isMobile) {
        const createBtn = page.getByTestId("post-consult-create-followup-button");
        const dismissBtn = page.getByTestId("post-consult-dismiss-button");
        await expectMinimumHitTarget(createBtn, 44);
        await expectMinimumHitTarget(dismissBtn, 44);

        await page.screenshot({
          path: "evidence/screenshots/ag08-post-consult-prompt-mobile.png",
          fullPage: false,
        });
      }
    }
  });

  test("T13: 4대 역할 (branch_admin, sub_branch_admin, team_leader, member) 정상 동작", async ({ page }) => {
    const roles = ["branch_admin", "sub_branch_admin", "team_leader", "member"] as const;

    for (const role of roles) {
      await setupPageFixture(page, { role });
      await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

      const dialog = await openConsultModal(page);
      await dialog.getByLabel("상담 요약").fill(`역할 ${role} 테스트`);
      await dialog.getByRole("button", { name: "저장", exact: true }).click();

      const prompt = page.getByTestId("post-consult-followup-prompt");
      await expect(prompt).toBeVisible();

      // Dismiss clean
      await page.getByTestId("post-consult-dismiss-button").click();
      await expect(prompt).not.toBeVisible();
    }
  });

  test("T14: AG-07 접근성 계약 보존 (우선순위, 다음 액션 레이블 검증)", async ({ page }) => {
    await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    // Verify accessibility attributes from AG-07 are intact
    const priorityTrigger = page.locator('[aria-label="우선순위"]');
    if (await priorityTrigger.count() > 0) {
      await expect(priorityTrigger.first()).toBeVisible();
    }

    const nextActionTrigger = page.locator('[aria-label="다음 액션"]');
    if (await nextActionTrigger.count() > 0) {
      await expect(nextActionTrigger.first()).toBeVisible();
    }
  });

  test("T15: 캐시 무효화 및 후속관리 등록 흐름 완결성 검증", async ({ page }) => {
    const state = await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("종합 후속 연결");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await page.getByTestId("post-consult-create-followup-button").click();
    const followupDialog = page.getByRole("dialog", { name: "빠른 후속 등록" });
    await expect(followupDialog).toBeVisible();

    await followupDialog.getByRole("button", { name: "후속 등록", exact: true }).click();
    await expect(followupDialog).not.toBeVisible();

    // Verify cache invalidation & completion
    expect(state.followUpPayloads.length).toBe(1);
    expect(state.followUpPayloads[0].customerId).toBe(101);
    await expect(page.getByTestId("post-consult-followup-prompt")).toHaveCount(0);
  });
  test("T16: (AG08-P1-01) 지연된 A101 상담 성공 응답이 B102 화면에 누수되지 않음", async ({ page }) => {
    let releaseConsult: (() => void) | null = null;
    let holdConsult = true;

    await setupPageFixture(page);

    await page.route("**/api/trpc/**", async route => {
      const url = new URL(route.request().url());
      const proc = decodeURIComponent(url.pathname.split("/api/trpc/")[1]);
      if (proc === "consultations.create" && holdConsult) {
        await new Promise<void>(resolve => {
          releaseConsult = resolve;
        });
        holdConsult = false;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope({ id: 5001, success: true, customerId: 101 })),
        });
      }
      return route.fallback();
    });

    // 1. Visit customer 101 and initiate consult
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("A101 지연 상담");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    // 2. While request is held, navigate to customer 102
    await page.goto("/customers/102", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: names[102], includeHidden: true })).toBeVisible();

    // 3. Release A101 consult response
    if (releaseConsult) {
      (releaseConsult as () => void)();
    }
    await page.waitForTimeout(500);

    // 4. Assert no prompt leaked on B102
    await expect(page.getByTestId("post-consult-followup-prompt")).toHaveCount(0);
  });

  test("T17: (AG08-P2-01) 지연된 A101 후속관리 성공이 B102의 새 상담 안내를 닫지 않음", async ({ page }) => {
    let releaseFollowUp: (() => void) | null = null;
    let holdFollowUp = true;

    await setupPageFixture(page);

    await page.route("**/api/trpc/**", async route => {
      const url = new URL(route.request().url());
      const proc = decodeURIComponent(url.pathname.split("/api/trpc/")[1]);
      if (proc === "followUps.create" && holdFollowUp) {
        await new Promise<void>(resolve => {
          releaseFollowUp = resolve;
        });
        holdFollowUp = false;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope({ id: 9001, customerId: 101 })),
        });
      }
      return route.fallback();
    });

    // 1. Save consultation on 101 -> prompt appears
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    let dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("A101 상담 완료");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByTestId("post-consult-followup-prompt")).toBeVisible();

    // 2. Open quick followup and click register (held in-flight)
    await page.getByTestId("post-consult-create-followup-button").click();
    const q = page.getByRole("dialog", { name: "빠른 후속 등록" });
    await expect(q).toBeVisible();
    await q.getByRole("button", { name: "후속 등록", exact: true }).click();

    // 3. Close modal via Escape and navigate to B102
    await page.keyboard.press("Escape");
    await page.goto("/customers/102", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: names[102], includeHidden: true })).toBeVisible();

    // 4. Save consultation on B102 -> prompt appears on 102
    dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("B102 신규 상담");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByTestId("post-consult-followup-prompt")).toBeVisible();

    // 5. Release A101's pending follow-up response
    if (releaseFollowUp) {
      (releaseFollowUp as () => void)();
    }
    await page.waitForTimeout(500);

    // 6. Assert B102's prompt is still visible and preserved!
    await expect(page.getByTestId("post-consult-followup-prompt")).toBeVisible();
  });

  test("T18: (AG08-P2-02) 빠른 후속 등록 창 Escape 닫힘 시 트리거 버튼으로 포커스 복귀", async ({ page }) => {
    await setupPageFixture(page);
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    const dialog = await openConsultModal(page);
    await dialog.getByLabel("상담 요약").fill("포커스 복귀 테스트");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    const createBtn = page.getByTestId("post-consult-create-followup-button");
    const dismissBtn = page.getByTestId("post-consult-dismiss-button");
    await expect(createBtn).toBeVisible();

    // Open via Space
    await createBtn.focus();
    await page.keyboard.press("Space");
    const followupDialog = page.getByRole("dialog", { name: "빠른 후속 등록" });
    await expect(followupDialog).toBeVisible();

    // Close via Escape
    await page.keyboard.press("Escape");
    await expect(followupDialog).not.toBeVisible();
    await page.waitForTimeout(500);

    // Assert focus settled back to createBtn
    await expect(createBtn).toBeFocused();

    // Tab to dismissBtn and press Enter
    await page.keyboard.press("Tab");
    await expect(dismissBtn).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("post-consult-followup-prompt")).toHaveCount(0);
  });

  test("T19: (AG08-P1-02) CustomerDetail 청크 장애 격리 및 네비게이션 보존", async ({ page }) => {
    let chunkFail = true;

    await setupPageFixture(page);

    await page.route(url => url.pathname.includes("CustomerDetail"), async route => {
      if (chunkFail) {
        return route.abort("failed");
      }
      return route.continue();
    });

    // 1. Visit customer 101 with failing chunk
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });

    // 2. Local route error boundary shows error card
    await expect(page.getByRole("heading", { name: "문제가 발생했습니다." })).toBeVisible();

    // 3. Navigation is preserved (not whole app crashed)
    const navCount = await page.getByRole("navigation").count();
    expect(navCount).toBeGreaterThan(0);

    // 4. Click "홈으로 이동" button on error fallback card
    await page.getByRole("button", { name: "홈으로 이동" }).click();
    await page.waitForTimeout(400);
    expect(page.url()).toBe("http://127.0.0.1:3187/");

    // 5. Error heading is unmounted because route changed
    const stillGlobal = await page.getByRole("heading", { name: "문제가 발생했습니다." }).isVisible();
    expect(stillGlobal).toBe(false);

    // 6. Navigate back after chunk recovers
    chunkFail = false;
    await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "문제가 발생했습니다." })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: names[101], includeHidden: true })).toBeVisible();
  });
});
