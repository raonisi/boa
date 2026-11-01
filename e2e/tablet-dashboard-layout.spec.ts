import { expect, test, type Page } from "@playwright/test";
import SuperJSON from "superjson";
import { mockBoaTrpc } from "./fixtures/mock-trpc";
import {
  collectPageErrors,
  expectClickCenterReachable,
  expectMinimumHitTarget,
  expectNoHorizontalOverflow,
} from "./helpers/layout-metrics";

test.describe("BOA-CRM-AG05 Tablet Dashboard Responsive UX", () => {
  const TABLET_VIEWPORTS = [
    { name: "tablet768", width: 768, height: 1024 },
    { name: "tablet820", width: 820, height: 1180 },
    { name: "tablet912", width: 912, height: 1368 },
    { name: "tablet1024", width: 1024, height: 768 },
  ];

  const ROLES = [
    "branch_admin",
    "sub_branch_admin",
    "team_leader",
    "member",
  ] as const;

  for (const vp of TABLET_VIEWPORTS) {
    for (const role of ROLES) {
      test(`tablet layout adapts gracefully at ${vp.name} (${vp.width}x${vp.height}) for ${role}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await mockBoaTrpc(page, role);
        const errors = collectPageErrors(page);

        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-testid="dashboard-action-cockpit"]');

        // 1. Zero document overflow
        await expectNoHorizontalOverflow(page);

        // 2. Cockpit and quick actions container visible
        const quickActionsSection = page.getByTestId("dashboard-quick-actions");
        await expect(quickActionsSection).toBeVisible();

        // 3. Quick action buttons visible on tablet (5 for management roles, 4 for member)
        const expectedQuickActionCount = role === "member" ? 4 : 5;
        const quickBtns = quickActionsSection.getByRole("button");
        await expect(quickBtns).toHaveCount(expectedQuickActionCount);

        // 4. Each button meets touch target >= 44px, width >= 90px, and center reachable
        for (let i = 0; i < expectedQuickActionCount; i++) {
          const btn = quickBtns.nth(i);
          await expectMinimumHitTarget(btn, 44);
          await expectClickCenterReachable(btn);

          const box = await btn.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThanOrEqual(90);

          // Verify text is not truncated
          const labelEl = btn.locator("span.min-w-0 > span").first();
          await expect(labelEl).toBeVisible();
          const isTruncated = await labelEl.evaluate(
            el => el.scrollWidth > el.clientWidth + 1
          );
          expect(isTruncated).toBe(false);
        }

        // 5. Core KPIs are displayed on tablet (not hidden like on mobile)
        const coreKpis = page.getByTestId("dashboard-core-kpis");
        await expect(coreKpis).toBeVisible();
        const kpiCards = coreKpis.locator(".crm-dashboard-card");
        await expect(kpiCards).toHaveCount(5);

        for (let i = 0; i < 5; i++) {
          const card = kpiCards.nth(i);
          const box = await card.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThanOrEqual(180);

          // Card titles are not truncated
          const titleEl = card.locator("p").first();
          await expect(titleEl).toBeVisible();
          if (await titleEl.isVisible()) {
            const titleTruncated = await titleEl.evaluate(
              el => el.scrollWidth > el.clientWidth + 1
            );
            expect(titleTruncated).toBe(false);
          }
        }

        // 6. Role-specific section checks
        if (role === "branch_admin") {
          const adminAttention = page.getByTestId("dashboard-admin-attention");
          await expect(adminAttention).toBeVisible();
          const attentionCards = adminAttention.locator(".crm-dashboard-card");
          await expect(attentionCards).toHaveCount(3);
          for (let i = 0; i < 3; i++) {
            const cardBox = await attentionCards.nth(i).boundingBox();
            expect(cardBox).not.toBeNull();
            expect(cardBox!.width).toBeGreaterThanOrEqual(200);
          }
        } else if (role === "sub_branch_admin" || role === "team_leader") {
          const managerSection = page.getByTestId("dashboard-manager-support");
          await expect(managerSection).toBeVisible();
        }

        // 7. Zero runtime page errors
        expect(errors, errors.join("\n")).toEqual([]);
      });
    }
  }

  test("quick action navigation works smoothly on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="dashboard-action-cockpit"]');

    const customerSearchBtn = page.getByTestId("dashboard-quick-action-customer-search");
    await expect(customerSearchBtn).toBeVisible();
    await customerSearchBtn.click({ force: false });

    await page.waitForURL("**/customers**");
    expect(page.url()).toContain("/customers");
  });

  test("tablet 768px with sidebar expanded to max (300px) preserves 0 overflow and >= 90px buttons", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.addInitScript(() => {
      localStorage.setItem("crm-sidebar-width", "300");
    });
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="dashboard-action-cockpit"]');

    await expectNoHorizontalOverflow(page);

    const quickBtns = page.getByTestId("dashboard-quick-actions").getByRole("button");
    await expect(quickBtns).toHaveCount(5);

    for (let i = 0; i < 5; i++) {
      const btn = quickBtns.nth(i);
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(90);
      await expectClickCenterReachable(btn);
    }
  });

  test("tablet 768px with sidebar collapsed expands smoothly with 0 overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockBoaTrpc(page, "branch_admin");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="dashboard-action-cockpit"]');

    // Click sidebar trigger to collapse
    const trigger = page.locator("header button").first();
    await trigger.click();

    await page.waitForTimeout(300);
    await expectNoHorizontalOverflow(page);

    const quickBtns = page.getByTestId("dashboard-quick-actions").getByRole("button");
    await expect(quickBtns).toHaveCount(5);

    for (let i = 0; i < 5; i++) {
      const btn = quickBtns.nth(i);
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(120);
      await expectClickCenterReachable(btn);
    }
  });

  test("desktop 1280px and 1440px KPI cards occupy single row with all 5 cards at same Y", async ({
    page,
  }) => {
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await mockBoaTrpc(page, "branch_admin");

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="dashboard-action-cockpit"]');

      const kpiContainer = page.getByTestId("dashboard-core-kpis");
      await expect(kpiContainer).toBeVisible();

      const { columnCount, distinctYCount, fifthCardGridColumn } = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="dashboard-core-kpis"]') as HTMLElement;
        const cards = Array.from(grid?.querySelectorAll(".crm-dashboard-card") || []) as HTMLElement[];
        const style = window.getComputedStyle(grid);
        const cols = style.gridTemplateColumns.trim().split(/\s+/);
        const distinctY = Array.from(new Set(cards.map(c => Math.round(c.getBoundingClientRect().y))));
        const fifthCardStyle = cards[4] ? window.getComputedStyle(cards[4]) : null;

        return {
          columnCount: cols.length,
          distinctYCount: distinctY.length,
          fifthCardGridColumn: fifthCardStyle?.gridColumn || "",
        };
      });

      expect(columnCount, `At ${width}px, grid must have 5 columns`).toBe(5);
      expect(distinctYCount, `At ${width}px, all 5 cards must occupy one row`).toBe(1);
      expect(fifthCardGridColumn).toContain("span 1");
    }
  });

  test("KPI breakpoint cascade: 899px 2-column vs 900px and 1024px 3-column with 5th card span reset", async ({
    page,
  }) => {
    for (const width of [899, 900, 912, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      await mockBoaTrpc(page, "branch_admin");

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="dashboard-action-cockpit"]');

      const { columnCount, fifthCardGridColumn } = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="dashboard-core-kpis"]') as HTMLElement;
        const cards = Array.from(grid?.querySelectorAll(".crm-dashboard-card") || []) as HTMLElement[];
        const style = window.getComputedStyle(grid);
        const cols = style.gridTemplateColumns.trim().split(/\s+/);
        const fifthCardStyle = cards[4] ? window.getComputedStyle(cards[4]) : null;

        return {
          columnCount: cols.length,
          fifthCardGridColumn: fifthCardStyle?.gridColumn || "",
        };
      });

      if (width < 900) {
        expect(columnCount, `At ${width}px, grid must have 2 columns`).toBe(2);
        expect(fifthCardGridColumn).toContain("span 2");
      } else {
        expect(columnCount, `At ${width}px, grid must have 3 columns`).toBe(3);
        expect(fifthCardGridColumn).toContain("span 1");
      }
    }
  });

  test("quick actions 640px and 767px occupy single row with 0 vertical regression", async ({
    page,
  }) => {
    for (const width of [640, 767]) {
      await page.setViewportSize({ width, height: 800 });
      await mockBoaTrpc(page, "branch_admin");

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="dashboard-action-cockpit"]');

      const quickBtns = page.getByTestId("dashboard-quick-actions").getByRole("button");
      await expect(quickBtns).toHaveCount(5);

      const rowsCount = await page.evaluate(() => {
        const container = document.querySelector('[data-testid="dashboard-quick-actions"]');
        const btns = Array.from(container?.querySelectorAll("button") || []) as HTMLButtonElement[];
        const yCoords = btns.map(b => Math.round(b.getBoundingClientRect().y));
        return new Set(yCoords).size;
      });

      expect(rowsCount, `Quick actions at ${width}px must occupy exactly 1 row`).toBe(1);
    }
  });
});


// Measured BASE 98b9a5b with unchanged synthetic fixtures and Pretendard:
// 640/767px row=56, first title=760, complete=827..867.
// AG05_BASELINE_URL enables an additional live, same-font BASE comparison.
const TAKEOVER_ROLES = ["branch_admin", "sub_branch_admin", "team_leader", "member"] as const;
async function takeoverGeometry(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const rect = (e: Element | null | undefined) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
    };
    const q=document.querySelector('[data-testid="dashboard-quick-actions"]');
    const queue=document.querySelector('[data-testid="dashboard-mobile-followup-queue"]');
    const buttons=[...(q?.querySelectorAll("button")??[])].filter(b=>b.getBoundingClientRect().height>0);
    return {viewport:{width:innerWidth,height:innerHeight},scrollY,
      quick:rect(q?.querySelector(".grid")), rows:new Set(buttons.map(b=>b.getBoundingClientRect().y)).size,
      title:rect(queue?.querySelector("button.line-clamp-2")),
      complete:rect([...(queue?.querySelectorAll("button")??[])].find(b=>b.textContent?.trim()==="완료")),
      nav:rect(document.querySelector('[data-testid="mobile-nav"]')),
      font:getComputedStyle(document.body).fontFamily,pretendardReady:document.fonts.check("14px Pretendard")};
  });
}
async function takeoverLabels(page: Page, count: number) {
  const buttons=page.getByTestId("dashboard-quick-actions").getByRole("button");
  await expect(buttons).toHaveCount(count);
  for(let i=0;i<count;i++){
    await expectMinimumHitTarget(buttons.nth(i),44);
    const label=buttons.nth(i).locator("span.min-w-0 > span").first();
    const g=await label.evaluate(e=>{
      const range=document.createRange();range.selectNodeContents(e);const b=e.getBoundingClientRect();
      return {client:e.clientWidth,scroll:e.scrollWidth,box:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},
        ranges:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}))};
    });
    expect(g.scroll).toBeLessThanOrEqual(g.client+1);
    for(const t of g.ranges){
      expect(t.left).toBeGreaterThanOrEqual(g.box.left-1);expect(t.right).toBeLessThanOrEqual(g.box.right+1);
      expect(t.top).toBeGreaterThanOrEqual(g.box.top-1);expect(t.bottom).toBeLessThanOrEqual(g.box.bottom+1);
    }
  }
  const boxes=await buttons.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const x=Math.max(0,Math.min(boxes[i].right,boxes[j].right)-Math.max(boxes[i].left,boxes[j].left));
    const y=Math.max(0,Math.min(boxes[i].bottom,boxes[j].bottom)-Math.max(boxes[i].top,boxes[j].top));
    expect(x*y).toBe(0);
  }
}
test.describe("AG05 takeover structural regressions",()=>{
  for(const [width,height]of [[390,844],[639,800],[640,800],[767,800],[768,1024],[820,1180]])for(const role of TAKEOVER_ROLES){
    test("boundary coordinates "+width+"x"+height+" "+role,async({page,context},info)=>{
      await page.setViewportSize({width,height});await mockBoaTrpc(page,role);
      const errors=collectPageErrors(page);await page.goto("/",{waitUntil:"domcontentloaded"});
      await expect(page.getByTestId("dashboard-mobile-followup-queue")).toBeVisible();
      const actual=await takeoverGeometry(page);let baseline=null;
      await takeoverLabels(page,width<640||role==="member"?4:5);await expectNoHorizontalOverflow(page);
      expect(actual.scrollY).toBe(0);expect(actual.title).not.toBeNull();expect(actual.complete).not.toBeNull();
      if(width===640||width===767){
        expect(actual.rows).toBe(1);expect(actual.quick!.height).toBeLessThanOrEqual(56);
        expect(actual.title!.y).toBeLessThanOrEqual(760);expect(actual.complete!.y).toBeLessThanOrEqual(827);
        expect(actual.complete!.bottom).toBeLessThanOrEqual(867);
        if(process.env.AG05_BASELINE_URL){
          const u=new URL(process.env.AG05_BASELINE_URL);expect(["127.0.0.1","localhost"]).toContain(u.hostname);
          const bp=await context.newPage();
          try{
            await bp.setViewportSize({width,height});await mockBoaTrpc(bp,role);
            await bp.goto(u.href,{waitUntil:"domcontentloaded"});await expect(bp.getByTestId("dashboard-mobile-followup-queue")).toBeVisible();
            baseline=await takeoverGeometry(bp);
            expect(actual.quick!.height).toBeLessThanOrEqual(baseline.quick!.height);
            expect(actual.title!.y).toBeLessThanOrEqual(baseline.title!.y);
            expect(actual.complete!.y).toBeLessThanOrEqual(baseline.complete!.y);
            expect(actual.complete!.bottom).toBeLessThanOrEqual(baseline.complete!.bottom);
          }finally{await bp.close()}
        }
      }
      if(width===390){
        expect(actual.complete!.bottom).toBeLessThanOrEqual(actual.nav!.y-16);
        await expectClickCenterReachable(page.getByTestId("dashboard-mobile-followup-queue").getByRole("button",{name:"완료",exact:true}).first());
      }
      if(width>=768){expect(actual.quick!.width).toBeGreaterThan(420);expect(actual.rows).toBe(2)}
      await info.attach("boundary-geometry",{body:JSON.stringify({role,actual,baseline}),contentType:"application/json"});
      await info.attach("boundary-screen",{body:await page.screenshot({fullPage:false}),contentType:"image/png"});
      expect(errors,errors.join("\n")).toEqual([]);
    });
  }
  for(const width of [1280,1440])for(const state of [0,120000,1234567,123456789,"loading","error"]as const){
    test("currency content and icon separation "+width+" "+state,async({page},info)=>{
      await page.setViewportSize({width,height:900});let release=()=>{};
      const loading=new Promise<void>(resolve=>{release=resolve});
      await mockBoaTrpc(page,"branch_admin",{transformResponse:async(procedure,response)=>{
        if(procedure!=="dashboard.todayWork")return response;if(state==="loading")await loading;
        if(state==="error")return {error:{json:{message:"[TEST] synthetic dashboard failure",code:-32603,data:{code:"INTERNAL_SERVER_ERROR",httpStatus:500,path:procedure}}}};
        const data=SuperJSON.deserialize((response as {result:{data:Parameters<typeof SuperJSON.deserialize>[0]}}).result.data)as{cards:{monthlyPremiumSum:number}};
        return {result:{data:SuperJSON.serialize({...data,cards:{...data.cards,monthlyPremiumSum:typeof state==="number"?state:120000}})}};
      }});
      await page.goto("/",{waitUntil:"domcontentloaded"});
      const grid=page.getByTestId("dashboard-core-kpis"),cards=grid.locator(".crm-dashboard-card"),card=cards.nth(4),value=card.getByTestId("premium-stat-value");
      try{
        await expect(grid).toBeVisible();await expect(cards).toHaveCount(5);
        if(state==="loading")await expect(value.getByRole("status",{name:"불러오는 중"})).toBeVisible();
        else if(state==="error"){await expect(value).toHaveText("불러오기 실패");await expect(card.getByRole("button",{name:"다시 시도",exact:true})).toBeVisible()}
        else await expect(value).toHaveText(new RegExp("^"+state.toLocaleString("en-US")+"\\s*원$"));
        await page.evaluate(()=>document.fonts.ready);
        const g=await card.evaluate(el=>{
          const box=(e:Element)=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
          const v=el.querySelector('[data-testid="premium-stat-value"]')!,icon=el.querySelector("div.h-11.w-11")!,r=document.createRange();r.selectNodeContents(v);
          const i=box(icon),ranges=[...r.getClientRects()].map(t=>({left:t.left,right:t.right,top:t.top,bottom:t.bottom}));
          return {card:box(el),icon:i,value:v.textContent,ranges,children:[el.querySelector("p")!,icon,v,...v.querySelectorAll("span")].map(e=>({box:box(e),client:e.clientWidth,scroll:e.scrollWidth})),
            intersections:ranges.map(t=>Math.max(0,Math.min(t.right,i.right)-Math.max(t.left,i.left))*Math.max(0,Math.min(t.bottom,i.bottom)-Math.max(t.top,i.top))),
            rows:[...el.parentElement!.querySelectorAll(".crm-dashboard-card")].map(c=>c.getBoundingClientRect().y),
            columns:getComputedStyle(el.parentElement!).gridTemplateColumns.split(/\s+/).length,
            amountFontSize:getComputedStyle(v.querySelector("span")!).fontSize};
        });
        expect(g.columns).toBe(5);expect(new Set(g.rows).size).toBe(1);expect(g.intersections.every(a=>a===0)).toBe(true);
        for(const c of g.children){expect(c.box.left).toBeGreaterThanOrEqual(g.card.left);expect(c.box.right).toBeLessThanOrEqual(g.card.right);expect(c.box.top).toBeGreaterThanOrEqual(g.card.top);expect(c.box.bottom).toBeLessThanOrEqual(g.card.bottom);expect(c.scroll).toBeLessThanOrEqual(c.client+1)}
        if(typeof state==="number"){expect(g.value?.replace(/\s/g,"")).toBe(state.toLocaleString("en-US")+"원");expect(parseFloat(g.amountFontSize)).toBeGreaterThanOrEqual(20);await expectClickCenterReachable(card)}
        await info.attach("currency-range-geometry",{body:JSON.stringify({width,state,geometry:g}),contentType:"application/json"});
        await info.attach("currency-screen",{body:await page.screenshot({fullPage:false}),contentType:"image/png"});
        if(state===120000){await card.click({force:false});await expect(page).toHaveURL(u=>u.pathname==="/performance")}
      }finally{release()}
    });
  }
  for(const sidebar of [180,220,300])for(const role of TAKEOVER_ROLES){
    test("narrow content labels and navigation sidebar"+sidebar+" "+role,async({page},info)=>{
      await page.setViewportSize({width:768,height:1024});await page.addInitScript(w=>localStorage.setItem("crm-sidebar-width",String(w)),sidebar);
      await mockBoaTrpc(page,role);await page.goto("/",{waitUntil:"domcontentloaded"});await expect(page.getByTestId("dashboard-quick-actions")).toBeVisible();
      await takeoverLabels(page,role==="member"?4:5);const g=await takeoverGeometry(page);
      expect(g.rows).toBe(Math.ceil((role==="member"?4:5)/(sidebar===300?2:3)));await expectNoHorizontalOverflow(page);
      await info.attach("sidebar-geometry",{body:JSON.stringify({sidebar,role,geometry:g}),contentType:"application/json"});
      await info.attach("sidebar-screen",{body:await page.screenshot({fullPage:false}),contentType:"image/png"});
      const b=page.getByTestId("dashboard-quick-action-customer-search");await expectClickCenterReachable(b);
      if(info.project.use.hasTouch){const r=await b.boundingBox();await page.touchscreen.tap(r!.x+r!.width/2,r!.y+r!.height/2)}else await b.click({force:false});
      await expect(page).toHaveURL(u=>u.pathname==="/customers");
    });
  }
  test("sidebar300 quick actions remain keyboard reachable",async({page})=>{
    await page.setViewportSize({width:768,height:1024});await page.addInitScript(()=>localStorage.setItem("crm-sidebar-width","300"));await mockBoaTrpc(page,"branch_admin");
    await page.goto("/",{waitUntil:"domcontentloaded"});const b=page.getByTestId("dashboard-quick-action-customer-search");await expect(b).toBeVisible();
    for(let i=0;i<80;i++){await page.keyboard.press("Tab");if(await b.evaluate(e=>e===document.activeElement))break}
    await expect(b).toBeFocused();await page.keyboard.press("Enter");await expect(page).toHaveURL(u=>u.pathname==="/customers");
  });
});
