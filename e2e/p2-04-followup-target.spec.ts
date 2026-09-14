import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";

const names: Record<number, string> = {
  101: "[TEST] Customer A 합성고객긴이름가나다라마바사아자차카타파하",
  102: "[TEST] Customer B",
};
const selected = (id: number) => ({
  id,
  name: names[id],
  maskedPhone: "010-****-5678",
  statusLabel: "미상담",
  priorityLabel: "A",
  assignedUserName: "[TEST] 긴담당자이름가나다라마바사아자차카타파하",
  lastContactedAt: null,
  lastConsultedAt: null,
});
const envelope = (value: unknown) => ({
  result: { data: SuperJSON.serialize(value) },
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}
async function fixture(page: Page) {
  const state = {
    mode: "success",
    gate: null as ReturnType<typeof deferred> | null,
    lookup: [] as any[],
    writes: [] as string[],
    payloads: [] as any[],
    mutationGate: null as ReturnType<typeof deferred> | null,
  };
  page.on("request", request => {
    if (["POST", "PATCH", "DELETE"].includes(request.method()))
      state.writes.push(
        request.method() + " " + new URL(request.url()).pathname
      );
  });
  await mockBoaTrpc(page, "branch_admin", {
    transformResponse: async (procedure, response, input) => {
      if (procedure === "customers.get") {
        const original = SuperJSON.deserialize(
          (response as any).result.data
        ) as any;
        return envelope({ ...original, id: input.id, name: names[input.id] });
      }
      if (procedure === "customers.searchForSchedulePicker") {
        state.lookup.push(input);
        const mode = state.mode;
        const gate = state.gate;
        if (gate) await gate.promise;
        if (mode === "error")
          return {
            error: {
              json: {
                message: "Synthetic lookup failure",
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: 500,
                  path: procedure,
                },
              },
            },
          };
        const target =
          mode === "null"
            ? null
            : input.selectedCustomerId
              ? selected(input.selectedCustomerId)
              : null;
        return envelope({
          selectedCustomer: target,
          items: input.search
            ? [selected(101), selected(102)]
            : target
              ? [target]
              : [],
          searchRequired: !input.search,
          tooManyResults: Boolean(input.search),
          hint: "고객명 또는 연락처 2글자 이상으로 검색해 주세요.",
        });
      }
      if (procedure === "followUps.create") {
        state.payloads.push(input);
        if (state.mutationGate) await state.mutationGate.promise;
        return envelope({ id: 9001 });
      }
      return response;
    },
  });
  return state;
}
async function openDetail(page: Page, id = 101) {
  await page.goto(`/customers/${id}`, { waitUntil: "domcontentloaded" });
  await openQuick(page);
  return page.getByRole("dialog", { name: "빠른 후속 등록" });
}

async function openQuick(page: Page) {
  await page
    .getByRole("button", {
      name:
        (page.viewportSize()?.width ?? 1440) >= 768 ? "빠른 후속 등록" : "후속",
      exact: true,
    })
    .click();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`P204-01/02/03/04/08 T01-T08 cache-empty, layout, keyboard and reopen ${viewport.width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    const state = await fixture(page);
    state.gate = deferred();
    const dialog = await openDetail(page);
    await expect(dialog.getByRole("status")).toHaveText(
      "대상 고객을 확인하고 있습니다."
    );
    await expect(
      dialog.getByRole("button", { name: "후속 등록", exact: true })
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "상세 입력" })
    ).toBeDisabled();
    expect(state.lookup).toEqual([{ selectedCustomerId: 101, limit: 20 }]);
    state.gate.resolve();
    const summary = dialog.getByRole("group", { name: "대상 고객" });
    await expect(summary).toContainText(names[101]);
    await expect(summary).toContainText("010-****-5678");
    await expect(summary).not.toContainText("01012345678");
    await expect(
      dialog.getByPlaceholder("고객명 또는 연락처로 검색")
    ).toHaveCount(0);
    await expect(dialog.getByText(/2글자/)).toHaveCount(0);
    await expect(
      dialog.getByRole("button").filter({ hasText: names[101] })
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button").filter({ hasText: names[102] })
    ).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "연결 해제" })).toHaveCount(
      0
    );
    await expect(
      dialog.getByRole("button", { name: "후속 등록", exact: true })
    ).toBeEnabled();
    await summary.scrollIntoViewIfNeeded();
    const layout = await dialog.evaluate(el => {
      const summary = el.querySelector('[role="group"]')!;
      const box = summary.getBoundingClientRect();
      const modal = el.getBoundingClientRect();
      const submit = [...el.querySelectorAll("button")]
        .find(b => b.textContent === "후속 등록")!
        .getBoundingClientRect();
      return {
        overflow: el.scrollWidth - el.clientWidth,
        summaryOverflow: summary.scrollWidth - summary.clientWidth,
        left: modal.left,
        right: modal.right,
        viewport: innerWidth,
        summaryBottom: box.bottom,
        submitTop: submit.top,
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.summaryOverflow).toBeLessThanOrEqual(1);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.summaryBottom).toBeLessThanOrEqual(layout.submitTop);
    if (viewport.width < 768) {
      for (const name of ["후속 등록", "상세 입력", "닫기"]) {
        const box = await dialog
          .getByRole("button", { name, exact: true })
          .boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="group"][aria-label="대상 고객"]')
          .analyze()
      ).violations
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`target-${viewport.width}.png`),
    });
    await info.attach("layout", {
      body: JSON.stringify(layout),
      contentType: "application/json",
    });
    await dialog.getByRole("button", { name: "닫기", exact: true }).focus();
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate(el => el.contains(document.activeElement))
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await openQuick(page);
    await expect(summary).toContainText(names[101]);
    await expect(
      dialog.getByRole("button", { name: "후속 등록", exact: true })
    ).toBeEnabled();
    expect(state.writes).toEqual([]);
  });
}

test("P204-05 T16 R01/R02 A lookup late after close and B navigation cannot replace B", async ({
  page,
}) => {
  const state = await fixture(page);
  state.gate = deferred();
  const aGate = state.gate;
  const dialog = await openDetail(page);
  await expect(dialog.getByRole("status")).toBeVisible();
  await page.keyboard.press("Escape");
  state.gate = null;
  // Client navigation retains the query cache while the A request is pending.
  await page.evaluate(() => {
    history.pushState(null, "", "/customers/102");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await openQuick(page);
  await expect(dialog.getByRole("group", { name: "대상 고객" })).toContainText(
    names[102]
  );
  const lateA = page.waitForResponse(response => {
    const url = new URL(response.url());
    return (
      url.pathname.includes("customers.searchForSchedulePicker") &&
      (url.searchParams.get("input") ?? "").includes('"selectedCustomerId":101')
    );
  });
  aGate.resolve();
  await (await lateA).finished();
  await page.evaluate(
    () =>
      new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  await expect
    .poll(() => state.lookup.map(q => q.selectedCustomerId))
    .toContain(102);
  await expect(dialog).not.toContainText(names[101]);
  await expect(
    dialog.getByRole("button", { name: "후속 등록", exact: true })
  ).toBeEnabled();
  expect(state.writes).toEqual([]);
});

for (const mode of ["error", "null"]) {
  test(`P204-06 T12/T13 ${mode} fails closed and keyboard read-only retry recovers`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.mode = mode;
    const dialog = await openDetail(page);
    await expect(dialog.getByRole("alert")).toContainText(
      "대상 고객을 확인할 수 없습니다."
    );
    await expect(dialog.getByRole("group", { name: "대상 고객" })).toHaveCount(
      0
    );
    await expect(
      dialog.getByRole("button", { name: "후속 등록", exact: true })
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "상세 입력" })
    ).toBeDisabled();
    state.mode = "success";
    await dialog.getByRole("button", { name: "대상 고객 다시 확인" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      dialog.getByRole("group", { name: "대상 고객" })
    ).toContainText(names[101]);
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "후속 등록", exact: true })
    ).toBeEnabled();
    expect(
      state.lookup.every(q => q.selectedCustomerId === 101 && !q.search)
    ).toBe(true);
    expect(state.writes).toEqual([]);
  });
}

test("T14 R03 explicit synthetic submit preserves payload target and summary while saving", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mutationGate = deferred();
  const dialog = await openDetail(page);
  await expect(dialog.getByRole("group", { name: "대상 고객" })).toContainText(
    names[101]
  );
  await dialog.getByRole("button", { name: "후속 등록", exact: true }).click();
  await expect.poll(() => state.payloads.length).toBe(1);
  expect(state.payloads[0].customerId).toBe(101);
  expect(state.payloads[0].reason).toBeTruthy();
  await expect(
    dialog.getByRole("button", { name: "저장 중..." })
  ).toBeDisabled();
  await expect(dialog.getByRole("group", { name: "대상 고객" })).toContainText(
    names[101]
  );
  await expect(
    dialog.getByRole("button", { name: "상세 입력" })
  ).toBeDisabled();
  state.mutationGate.resolve();
  await expect(dialog).toBeHidden();
  expect(state.writes).toEqual(["POST /api/trpc/followUps.create"]);
});

test("T15 detailed transition keeps the confirmed route target in synthetic payload", async ({
  page,
}) => {
  const state = await fixture(page);
  const quick = await openDetail(page, 102);
  await expect(quick.getByRole("group", { name: "대상 고객" })).toContainText(
    names[102]
  );
  await quick.getByRole("button", { name: "상세 입력" }).click();
  const detailed = page.getByRole("dialog", { name: "다음 연락일 설정" });
  await expect(detailed).toBeVisible();
  await detailed.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => state.payloads.length).toBe(1);
  expect(state.payloads[0].customerId).toBe(102);
  expect(state.writes).toEqual(["POST /api/trpc/followUps.create"]);
});

for (const route of ["/calendar", "/customers?action=quick-followup"]) {
  test(`P204-07 T09/T10/T11 editable search, selection and unlink ${route}`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.clock.install();
    await page.goto(route);
    if (route === "/calendar")
      await page
        .getByRole("button", {
          name: "상담·계약·후속관리 일정 등록",
          exact: true,
        })
        .click();
    const dialog = page.getByRole("dialog");
    const search = dialog.getByPlaceholder("고객명 또는 연락처로 검색");
    await expect(search).toBeVisible();
    await expect(dialog.getByText(/2글자/)).toBeVisible();
    await search.fill("A");
    await page.clock.runFor(350);
    await expect(dialog.getByText(/2글자/)).toBeVisible();
    expect(state.lookup).toHaveLength(0);
    await search.fill("고객");
    const result = dialog.getByRole("button").filter({ hasText: names[101] });
    await expect(result).toBeVisible();
    await expect(
      dialog.getByText("검색 결과가 많습니다. 검색어를 더 입력해 주세요.")
    ).toBeVisible();
    await result.click();
    await expect(
      dialog.getByRole("group", { name: "선택 고객" })
    ).toContainText(names[101]);
    await dialog.getByRole("button", { name: "연결 해제" }).click();
    await expect(dialog.getByRole("group", { name: "선택 고객" })).toHaveCount(
      0
    );
    expect(state.writes).toEqual([]);
  });
}
