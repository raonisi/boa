import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const fixedTime = new Date("2026-09-20T00:00:00Z");
const envelope = (value: unknown) => ({
  result: { data: SuperJSON.serialize(value) },
});
const consult = {
  id: 501,
  customerId: 101,
  status: "미상담",
  consultationType: "전화",
  customerNeed: "기타",
  nextAction: "재연락",
  summary: "[TEST] 상담 요약",
  content: "[TEST] 상세 메모",
  nextContactAt: null,
  createdAt: fixedTime,
};
const contract = {
  id: 601,
  customerId: 101,
  agentId: 4,
  company: "[TEST] 보험사",
  productName: "[TEST] 상품",
  productGroup: "[TEST] 상품군",
  contractDate: "2026-09-10",
  monthlyPremium: 120000,
  paymentStatus: "정상",
  contractStatus: "유지",
  memo: "[TEST] 계약 메모",
  isActive: true,
  deletedAt: null,
  createdAt: fixedTime,
};
type Mode =
  | "consult-create"
  | "consult-edit"
  | "contract-create"
  | "contract-edit";
const titles: Record<Mode, string> = {
  "consult-create": "상담기록 추가",
  "consult-edit": "상담기록 수정",
  "contract-create": "계약 등록",
  "contract-edit": "계약 수정",
};
const consultSelects = ["상담상태", "상담유형", "고객 니즈", "다음 액션"];
const consultNative = ["상담 요약", "상세 메모", "재상담 예정일"];
const contractNative = [
  "보험사",
  "상품명",
  "상품군",
  "계약일",
  "월보험료 (원)",
  "메모",
];
const contractSelects = ["납입상태", "계약상태", "담당 설계사"];

async function fixture(page: Page, unassigned = false) {
  const state = {
    writes: [] as string[],
    payloads: [] as { procedure: string; input: any }[],
  };
  await page.clock.install({ time: fixedTime });
  // All application data is synthetic. No non-local request may escape the test.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  page.on("request", request => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      state.writes.push(new URL(request.url()).pathname);
  });
  await mockBoaTrpc(page, "branch_admin", {
    transformResponse: (procedure, response, input) => {
      if (
        [
          "consultations.create",
          "consultations.update",
          "contracts.create",
          "contracts.update",
        ].includes(procedure)
      ) {
        state.payloads.push({ procedure, input });
        return envelope({
          id: procedure.startsWith("consultations") ? 501 : 601,
          success: true,
        });
      }
      if (procedure === "customers.get") {
        const original = SuperJSON.deserialize(
          (response as any).result.data
        ) as any;
        return envelope({
          ...original,
          name: "[TEST] 접근성 고객",
          consultStatus: "미상담",
          agentId: unassigned ? null : 4,
        });
      }
      if (procedure === "consultations.list") return envelope([consult]);
      if (
        ["contracts.listByCustomer", "contracts.historyByCustomer"].includes(
          procedure
        )
      )
        return envelope([contract]);
      if (procedure === "contracts.lifecycleByCustomer") return envelope([]);
      if (procedure === "settings.formOptions") return response;
      return response;
    },
  });
  return state;
}

async function openMode(page: Page, mode: Mode) {
  await page.goto("/customers/101", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "[TEST] 접근성 고객", exact: true })
  ).toBeVisible();
  await page
    .getByRole("tab", {
      name: mode.startsWith("consult") ? /상담·후속관리/ : /^계약/,
    })
    .click();
  const panel = page.getByRole("tabpanel");
  if (mode.endsWith("edit")) {
    const area =
      mode === "consult-edit"
        ? page.getByRole("region", { name: "상담 기록", exact: true })
        : panel;
    await area
      .getByRole("button", { name: "수정", exact: true })
      .first()
      .click();
  } else {
    await panel
      .getByRole("button", { name: titles[mode], exact: true })
      .first()
      .click();
  }
  const dialog = page.getByRole("dialog", { name: titles[mode], exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

// These same assertions intentionally fail on clean BASE before the fix.
for (const [id, mode, field] of [
  ["PRE01", "consult-create", "상담상태"],
  ["PRE02", "consult-create", "재상담 예정일"],
  ["PRE03", "contract-create", "상품명"],
  ["PRE04", "contract-create", "계약일"],
] as const) {
  test(`${id} original accessible-name regression: ${field}`, async ({
    page,
  }) => {
    const state = await fixture(page);
    const dialog = await openMode(page, mode);
    // Inspect the existing control even when getByLabel cannot find it on BASE.
    const control =
      field === "상담상태"
        ? dialog.getByRole("combobox").first()
        : field === "재상담 예정일"
          ? dialog.locator('input[type="datetime-local"]')
          : field === "계약일"
            ? dialog.locator('input[type="date"]')
            : dialog.locator("input").nth(1);
    await expect(control).toHaveAccessibleName(field);
    expect(state.writes).toEqual([]);
  });
}

async function assertNames(dialog: Locator, mode: Mode) {
  const native = mode.startsWith("consult") ? consultNative : contractNative;
  const selects = mode.startsWith("consult") ? consultSelects : contractSelects;
  for (const name of native) {
    const control = dialog.getByLabel(name, { exact: true });
    await expect(control).toHaveCount(1);
    await expect(control).toHaveAccessibleName(name);
  }
  for (const name of selects) {
    await expect(
      dialog.getByRole("combobox", { name, exact: true })
    ).toHaveCount(1);
  }
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  for (const mode of Object.keys(titles) as Mode[]) {
    test(`P205-01..07/10 T01-T20 ${mode} ${viewport.width}: names, layout, read-only`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      const state = await fixture(page);
      const dialog = await openMode(page, mode);
      await assertNames(dialog, mode);
      if (mode === "consult-create") {
        await dialog.getByRole("checkbox").check();
        await expect(
          dialog.getByLabel("일정 제목", { exact: true })
        ).toHaveAccessibleName("일정 제목");
        await expect(
          dialog.getByRole("combobox", { name: "알림", exact: true })
        ).toHaveCount(1);
      }
      const layout = await dialog.evaluate(el => {
        const box = el.getBoundingClientRect();
        return {
          overflow: el.scrollWidth - el.clientWidth,
          left: box.left,
          right: box.right,
          width: innerWidth,
          clippedLabels: [...el.querySelectorAll("label")].filter(
            label => label.scrollWidth > label.clientWidth + 1
          ).length,
        };
      });
      await info.attach("layout.json", {
        body: JSON.stringify(layout),
        contentType: "application/json",
      });
      expect(layout.overflow).toBeLessThanOrEqual(1);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(layout.width);
      expect(layout.clippedLabels).toBe(0);
      const duplicates = await page.locator("[id]").evaluateAll(els => {
        const ids = els.map(el => el.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      expect(duplicates).toEqual([]);
      expect(
        await dialog
          .locator("[tabindex]")
          .evaluateAll(
            els =>
              els.filter(el => Number(el.getAttribute("tabindex")) > 0).length
          )
      ).toBe(0);
      const date = dialog.getByLabel(
        mode.startsWith("consult") ? "재상담 예정일" : "계약일",
        { exact: true }
      );
      await date.fill(
        mode.startsWith("consult") ? "2026-09-23T14:30" : "2026-09-23"
      );
      await expect(date).toHaveValue(
        mode.startsWith("consult") ? "2026-09-23T14:30" : "2026-09-23"
      );
      const last = dialog.getByLabel(
        mode.startsWith("consult") ? "재상담 예정일" : "메모",
        { exact: true }
      );
      await last.scrollIntoViewIfNeeded();
      const cancel = dialog.getByRole("button", { name: "취소", exact: true });
      await cancel.scrollIntoViewIfNeeded();
      const boxes = {
        field: await last.boundingBox(),
        action: await cancel.boundingBox(),
      };
      expect(boxes.field!.y + boxes.field!.height).toBeLessThanOrEqual(
        boxes.action!.y
      );
      await info.attach(`${mode}-${viewport.width}.png`, {
        body: await dialog.screenshot(),
        contentType: "image/png",
      });
      await cancel.click();
      await expect(dialog).toBeHidden();
      expect(state.writes).toEqual([]);
    });
  }
}

async function assertErrorLayout(dialog: Locator, control: Locator) {
  const errorId = await control.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  const error = dialog.locator(`[id="${errorId}"]`);
  await error.scrollIntoViewIfNeeded();
  const fieldBox = await control.boundingBox(),
    errorBox = await error.boundingBox();
  expect(fieldBox!.y + fieldBox!.height).toBeLessThanOrEqual(errorBox!.y);
  expect(
    await error.evaluate(el => el.scrollWidth - el.clientWidth)
  ).toBeLessThanOrEqual(1);
  expect(
    await dialog.evaluate(el => el.scrollWidth - el.clientWidth)
  ).toBeLessThanOrEqual(1);
}

for (const width of [1440, 390, 320]) {
  test(`P205-09 E01-E06 conditional required/error association and recovery ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width,
      height: width === 1440 ? 900 : width === 390 ? 844 : 740,
    });
    const state = await fixture(page, true);
    let dialog = await openMode(page, "consult-create");
    const date = dialog.getByLabel("재상담 예정일", { exact: true });
    await expect(date).not.toHaveAttribute("aria-invalid", "true");
    await expect(date).not.toHaveAttribute("aria-required", "true");
    await dialog.getByRole("checkbox").check();
    await expect(date).toHaveAttribute("aria-required", "true");
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await expect(date).toHaveAccessibleDescription(
      "캘린더 일정 등록을 위해 재상담 예정일을 입력해주세요."
    );
    await expect(
      dialog.getByRole("button", { name: "저장", exact: true })
    ).toBeDisabled();
    await assertErrorLayout(dialog, date);
    await info.attach(`consult-error-${width}.png`, {
      body: await dialog.screenshot(),
      contentType: "image/png",
    });
    await date.fill("2026-09-23T14:30");
    await expect(date).not.toHaveAttribute("aria-invalid", "true");
    await expect(date).not.toHaveAttribute("aria-describedby");
    await expect(
      dialog.getByRole("button", { name: "저장", exact: true })
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    dialog = await openMode(page, "contract-create");
    const agent = dialog.getByRole("combobox", {
      name: "담당 설계사",
      exact: true,
    });
    await expect(agent).toHaveAttribute("aria-required", "true");
    await expect(agent).toHaveAttribute("aria-invalid", "true");
    await expect(agent).toHaveAccessibleDescription(
      "계약 담당 설계사를 선택해야 합니다."
    );
    await assertErrorLayout(dialog, agent);
    await info.attach(`agent-error-${width}.png`, {
      body: await dialog.screenshot(),
      contentType: "image/png",
    });
    await dialog.getByRole("button", { name: "등록", exact: true }).click();
    expect(state.payloads).toEqual([]);
    await agent.click();
    await page.getByRole("option", { name: /\[E2E\] Member/ }).click();
    await expect(agent).not.toHaveAttribute("aria-invalid", "true");
    await expect(agent).not.toHaveAttribute("aria-describedby");
    await expect(
      dialog.getByText("계약 담당 설계사를 선택해야 합니다.")
    ).toHaveCount(0);
    expect(state.writes).toEqual([]);
  });
}

test("QuickConsultationModal existing native/Select label regression", async ({
  page,
}) => {
  // This existing entry point is desktop-only; P2-05's four target modal modes
  // are separately exercised at all three mobile/desktop widths above.
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await fixture(page);
  await page.goto("/customers/101");
  await page.getByRole("button", { name: "퀵 상담", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /퀵 상담 기록/ });
  await expect(
    dialog.getByRole("textbox", { name: "상담 메모 (선택)", exact: true })
  ).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "다음 액션", exact: true })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  expect(state.writes).toEqual([]);
});

for (const width of [1440, 390, 320]) {
  for (const mode of Object.keys(titles) as Mode[]) {
    test(`P205-08 keyboard ${mode} ${width}: order, trap, select and Escape`, async ({
      page,
    }, info) => {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 900 : width === 390 ? 844 : 740,
      });
      const state = await fixture(page);
      const dialog = await openMode(page, mode);
      await expect
        .poll(() => dialog.evaluate(el => el.contains(document.activeElement)))
        .toBe(true);
      if (mode === "consult-create") {
        await dialog.getByRole("checkbox").check();
        await dialog
          .getByLabel("재상담 예정일", { exact: true })
          .fill("2026-09-23T14:30");
      }
      // Native date inputs expose several internal Tab stops on Chromium. Collapse
      // repeated stops on the same control, but require every distinct control.
      const controls = dialog.locator(
        'input:not([type="hidden"]), textarea, button'
      );
      const expected = await controls.evaluateAll(els =>
        els
          .filter(el => {
            const input = el as HTMLInputElement;
            return (
              !input.disabled &&
              input.tabIndex >= 0 &&
              el.getBoundingClientRect().width > 0
            );
          })
          .map(
            el =>
              el.id ||
              el.getAttribute("aria-label") ||
              el.textContent?.trim() ||
              el.getAttribute("role")
          )
      );
      const first = controls.first();
      await first.focus();
      const current = () =>
        dialog.evaluate(el => {
          const active = document.activeElement!;
          return {
            inside: el.contains(active),
            key:
              active.id ||
              active.getAttribute("aria-label") ||
              active.textContent?.trim() ||
              active.getAttribute("role"),
          };
        });
      const seen = [(await current()).key];
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press("Tab");
        const active = await current();
        expect(active.inside).toBe(true);
        if (active.key === seen.at(-1)) continue;
        if (active.key === seen[0]) break;
        seen.push(active.key);
      }
      expect(seen).toEqual(expected);
      const reverse: (string | null | undefined)[] = [];
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press("Shift+Tab");
        const active = await current();
        expect(active.inside).toBe(true);
        if (active.key === reverse.at(-1)) continue;
        if (active.key === seen[0]) break;
        reverse.push(active.key);
      }
      expect(reverse).toEqual([...expected.slice(1)].reverse());
      const trigger = dialog.getByRole("combobox", {
        name: mode.startsWith("consult") ? "상담상태" : "담당 설계사",
        exact: true,
      });
      await trigger.focus();
      const style = await trigger.evaluate(el => {
        const css = getComputedStyle(el);
        return {
          shadow: css.boxShadow,
          outline: css.outlineWidth,
          focusVisible: el.matches(":focus-visible"),
        };
      });
      expect(style.focusVisible).toBe(true);
      expect(style.shadow !== "none" || style.outline !== "0px").toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("Home");
      await expect(page.getByRole("option").first()).toBeFocused();
      await page.keyboard.press("ArrowDown");
      const option = page.getByRole("option").nth(1);
      await expect(option).toBeFocused();
      const selected = await option.innerText();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("listbox")).toBeHidden();
      await expect(trigger).toContainText(selected);
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Space");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("listbox")).toBeHidden();
      await expect(dialog).toBeVisible();
      await expect(trigger).toBeFocused();
      await info.attach("keyboard.json", {
        body: JSON.stringify({ expected, seen, reverse, style }),
        contentType: "application/json",
      });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      expect(state.writes).toEqual([]);
    });
  }
}

for (const mode of Object.keys(titles) as Mode[]) {
  test(`P205 axe ${mode}: visible-label, ARIA and control-name rules`, async ({
    page,
  }, info) => {
    const state = await fixture(page, true);
    const dialog = await openMode(page, mode);
    if (mode === "consult-create") await dialog.getByRole("checkbox").check();
    // This is a focused P2-05 audit, not a replacement for the repository's
    // full-page contrast/viewport accessibility suite or its unchanged baseline.
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withRules([
        "label",
        "select-name",
        "button-name",
        "aria-input-field-name",
        "aria-required-attr",
        "aria-valid-attr",
        "aria-valid-attr-value",
        "aria-allowed-attr",
        "aria-required-children",
        "aria-required-parent",
        "duplicate-id-aria",
        "label-content-name-mismatch",
      ])
      .analyze();
    await info.attach("axe-p205.json", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
    expect(results.violations).toEqual([]);
    expect(state.writes).toEqual([]);
  });

  test(`payload ${mode}: synthetic intercepted mutation contract`, async ({
    page,
  }) => {
    const state = await fixture(page);
    const dialog = await openMode(page, mode);
    const isConsult = mode.startsWith("consult"),
      isEdit = mode.endsWith("edit");
    if (isConsult) {
      await dialog
        .getByLabel("상담 요약", { exact: true })
        .fill("[TEST] 저장 요약");
      await dialog
        .getByLabel("상세 메모", { exact: true })
        .fill("[TEST] 저장 메모");
      await dialog
        .getByLabel("재상담 예정일", { exact: true })
        .fill("2026-09-23T14:30");
    } else {
      for (const [label, value] of [
        ["보험사", "[TEST] 보험사"],
        ["상품명", "[TEST] 상품"],
        ["상품군", "[TEST] 상품군"],
        ["계약일", "2026-09-10"],
        ["월보험료 (원)", "120000"],
        ["메모", "[TEST] 계약 메모"],
      ]) {
        await dialog.getByLabel(label, { exact: true }).fill(value);
      }
    }
    await dialog
      .getByRole("button", {
        name: isConsult
          ? isEdit
            ? "수정 저장"
            : "저장"
          : isEdit
            ? "수정"
            : "등록",
        exact: true,
      })
      .click();
    const procedure = `${isConsult ? "consultations" : "contracts"}.${isEdit ? "update" : "create"}`;
    await expect.poll(() => state.payloads.length).toBe(1);
    expect(state.payloads[0].procedure).toBe(procedure);
    expect(state.payloads[0].input).toEqual(
      isConsult
        ? {
            ...(isEdit
              ? { id: 501 }
              : { customerId: 101, calendarSchedule: undefined }),
            status: "미상담",
            consultationType: "전화",
            customerNeed: "기타",
            nextAction: "재연락",
            summary: "[TEST] 저장 요약",
            content: "[TEST] 저장 메모",
            nextContactAt: "2026-09-23T14:30",
          }
        : {
            ...(isEdit
              ? { id: 601, newAgentId: 4 }
              : { customerId: 101, agentIdOverride: 4 }),
            company: "[TEST] 보험사",
            productName: "[TEST] 상품",
            productGroup: "[TEST] 상품군",
            contractDate: "2026-09-10",
            monthlyPremium: 120000,
            paymentStatus: "정상",
            contractStatus: isEdit ? "유지" : "청약",
            memo: "[TEST] 계약 메모",
          }
    );
    await expect(dialog).toBeHidden();
  });
}
