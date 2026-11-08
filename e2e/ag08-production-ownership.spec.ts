
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/production-static';
import { mockBoaTrpc } from './fixtures/mock-trpc';
import SuperJSON from 'superjson';
const names:any={101:'[TEST] Gate2 A101',102:'[TEST] Gate2 B102'};
const envelope=(v:any)=>({result:{data:SuperJSON.serialize(v)}});
let wire:any[],queries:any[],observations:any,activeState:any;
let productionRequestStart=0,documentRequests:any[]=[],runtimeErrors:string[]=[],consoleErrors:string[]=[];
// Fiber/cache inspection below observes actual product ownership only; it never writes hook state, enables controls, remounts components, or forces focus.
async function snapshot(page:Page){
 return page.evaluate(()=>{
  const w:any=window;w.__gate2FiberIds??=new WeakMap();w.__gate2NextFiber??=1;
  const element=document.querySelector('[data-testid="post-consult-followup-prompt"]')||document.querySelector('h1')||document.querySelector('#main-content');
  const key=element&&Object.keys(element).find(k=>k.startsWith('__reactFiber$'));
  let f:any=key?(element as any)[key]:null,owner:any=null,client:any=null,prompt:any=null,ownerHooks:any[]=[],ownerIdentity:any=null;
  for(let cur=f;cur;cur=cur.return){
   const props=cur.memoizedProps||{};
   if(props.prompt?.token)prompt=props.prompt;
   const possible=[props.client,props.value,props.queryClient];
   for(const x of possible)if(x&&typeof x.getMutationCache==='function'&&typeof x.getQueryCache==='function')client=x;
   if(typeof props.id==='number'&&cur.memoizedState){let hooks:any[]=[],h=cur.memoizedState;for(let i=0;h&&i<400;i++,h=h.next)hooks.push(h);if(hooks.length>30){owner={id:props.id,type:cur.type?.name,hookCount:hooks.length};ownerHooks=hooks;let id=w.__gate2FiberIds.get(cur)||w.__gate2FiberIds.get(cur.alternate);if(!id)id=w.__gate2NextFiber++;w.__gate2FiberIds.set(cur,id);if(cur.alternate)w.__gate2FiberIds.set(cur.alternate,id);ownerIdentity=id}}
  }
  const isRef=(h:any)=>h?.memoizedState&&typeof h.memoizedState==='object'&&Object.prototype.hasOwnProperty.call(h.memoizedState,'current');
  let refs:any=null;
  for(let i=1;i+4<ownerHooks.length;i++)if(isRef(ownerHooks[i])&&isRef(ownerHooks[i+1])&&typeof ownerHooks[i].memoizedState.current==='number'&&typeof ownerHooks[i+1].memoizedState.current==='number'&&isRef(ownerHooks[i+2])&&isRef(ownerHooks[i+3])&&isRef(ownerHooks[i+4])){
   const a=ownerHooks[i+2].memoizedState.current,b=ownerHooks[i+3].memoizedState.current,t=ownerHooks[i+4].memoizedState.current;
   if((a==null||typeof a==='string')&&(b==null||typeof b==='string')&&(t==null||t instanceof HTMLElement)){refs={screenGeneration:ownerHooks[i].memoizedState.current,promptCounter:ownerHooks[i+1].memoizedState.current,activePromptToken:a,initiatingPromptToken:b,triggerConnected:!!t?.isConnected};break}
  }
  if(client&&!w.__gate2QueryEvents){w.__gate2QueryEvents=[];client.getQueryCache().subscribe((e:any)=>{if(e.type==='updated')w.__gate2QueryEvents.push({at:Date.now(),key:e.query?.queryKey,action:e.action?.type})})}
  return {url:location.href,timeOrigin:performance.timeOrigin,owner,ownerIdentity,refs,prompt,mutations:client?client.getMutationCache().getAll().map((m:any)=>({id:m.mutationId,key:m.options.mutationKey,variables:m.state.variables,context:m.state.context,status:m.state.status,contextFrozen:!!m.state.context&&Object.isFrozen(m.state.context)})):[],queryEvents:w.__gate2QueryEvents||[],active:{tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,100),testid:document.activeElement?.getAttribute('data-testid'),hidden:!!document.activeElement?.closest('[aria-hidden=true]'),visible:!!document.activeElement&&!!(document.activeElement as HTMLElement).getClientRects().length&&getComputedStyle(document.activeElement).visibility!=='hidden'&&getComputedStyle(document.activeElement).display!=='none',focusable:(document.activeElement as HTMLElement)?.tabIndex>=0}};
 });
}
async function fixture(page:Page,opts:any={}){
 const state:any={mode:'success',followMode:'success',pending:[],statuses:opts.statuses||[],added:{}};
 await mockBoaTrpc(page,'branch_admin',{transformResponse:async(proc:string,res:any,input:any)=>{
  queries.push({procedure:proc,input,at:Date.now()});
  if(proc==='customers.get'){const old:any=SuperJSON.deserialize(res.result.data);return envelope({...old,id:input.id,name:names[input.id],consultStatus:'미상담'})}
  if(proc==='customers.searchForSchedulePicker'){const id=input?.selectedCustomerId||101,target={id,name:names[id],maskedPhone:'010-****-1234',statusLabel:'미상담',priorityLabel:'A',assignedUserName:'Synthetic',lastContactedAt:null,lastConsultedAt:null};return envelope({selectedCustomer:target,items:[target],searchRequired:false,tooManyResults:false,hint:''})}
  if(proc==='followUps.listByCustomer'){const statuses=state.added[input.customerId]?[...state.statuses,'scheduled']:state.statuses;return envelope(statuses.map((status:string,i:number)=>({id:800+i,customerId:input.customerId,status,taskType:'상담',priority:'medium',nextContactDate:'2026-11-20T10:00:00.000Z',memo:'SYNTHETIC_FOLLOWUP_'+i,createdAt:new Date().toISOString()})))}
  return res;
 }});
 await page.route('**/api/trpc/**',async route=>{
  const u=new URL(route.request().url()),procs=decodeURIComponent(u.pathname.split('/api/trpc/')[1]).split(',');
  if(!procs.every(p=>['consultations.create','followUps.create'].includes(p)))return route.fallback();
  const body=route.request().postDataJSON(),isBatch=u.searchParams.get('batch')==='1',httpRequestId='http-'+Date.now()+'-'+wire.length;
  const results=await Promise.all(procs.map(async(proc,i)=>{
   const input:any=SuperJSON.deserialize(isBatch?body[String(i)]:body),mode=proc==='consultations.create'?state.mode:state.followMode;
   const row:any={httpRequestId,url:u.href,procedure:proc,input,at:Date.now(),trigger:state.trigger||'UI'};
   wire.push(row);row.clientAtRequest=await snapshot(page);
   if(mode==='hold')await new Promise(ok=>state.pending.push({procedure:proc,row,release:(finalMode='success')=>{row.finalMode=finalMode;ok(null)}}));
   const resultMode=row.finalMode||mode;row.responseAt=Date.now();row.response=resultMode;
   if(resultMode==='network')return{abort:true};
   if(['api','auth','http'].includes(resultMode))return{error:{json:{message:'Synthetic '+resultMode+' error',code:-32603,data:{code:resultMode==='auth'?'FORBIDDEN':'INTERNAL_SERVER_ERROR',httpStatus:resultMode==='auth'?403:500,path:proc}}}};
   if(proc==='followUps.create')state.added[input.customerId]=true;
   return envelope(proc==='consultations.create'?{success:true}:{id:9001,customerId:input.customerId});
  }));
  if(results.some(x=>x.abort))return route.abort('failed');
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(isBatch?results:results[0])});
 });
 activeState=state;return state;
}
test.beforeEach(async({page,production},info)=>{
 wire=[];queries=[];observations={steps:[]};activeState=null;
 productionRequestStart=production.requests().length;documentRequests=[];runtimeErrors=[];consoleErrors=[];
 if(info.project.name==='mobile-chromium')await page.setViewportSize({width:390,height:844});
 page.on('request',request=>{if(request.resourceType()==='document'&&request.isNavigationRequest())documentRequests.push({url:request.url(),method:request.method()})});
 page.on('pageerror',error=>runtimeErrors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
});
test.afterEach(async({page,production},info)=>{
 observations.final=await snapshot(page).catch(()=>null);
 observations.production={origin:production.origin,assets:production.assets,requests:production.requests().slice(productionRequestStart),documentRequests};
 observations.runtime={pageErrors:runtimeErrors,consoleErrors};
 await info.attach('raw-wire-context-token-dom',{body:JSON.stringify({wire,queries,observations},null,2),contentType:'application/json'});
 await page.screenshot({path:info.outputPath('final.png')}).catch(()=>{});
 for(const pending of activeState?.pending||[])if(!pending.row.responseAt)pending.release('network');
});
async function open(page:Page,id=101){await page.goto('/customers/'+id);await expect(page.getByRole('heading',{name:names[id],includeHidden:true})).toBeVisible();return snapshot(page)}
async function spa(page:Page,id:number|null){await page.evaluate(id=>{history.pushState(null,'',id?'/customers/'+id:'/customers');dispatchEvent(new PopStateEvent('popstate'))},id);if(id)await expect(page.getByRole('heading',{name:names[id],includeHidden:true})).toBeVisible();return snapshot(page)}
async function consult(page:Page,summary='VALID_GATE2'){
 const mobile=(page.viewportSize()?.width||1440)<768;await page.getByRole('button',{name:mobile?'상담':/상담기록 추가/,exact:mobile}).first().click();
 const d=page.getByRole('dialog',{name:'상담기록 추가'});await expect(d).toBeVisible();await d.getByLabel('상담 요약').fill(summary);return d;
}
const prompt=(page:Page)=>page.getByTestId('post-consult-followup-prompt');
async function saved(page:Page,summary='VALID_GATE2',previousToken?:string){const d=await consult(page,summary);await d.getByRole('button',{name:'저장',exact:true}).click();await expect(prompt(page)).toBeVisible();if(previousToken)await expect.poll(async()=>{const token=(await snapshot(page)).prompt?.token;return typeof token==='string'&&token!==previousToken}, {message:'Wait for the genuinely newer consultation prompt token before observing it'}).toBe(true);return snapshot(page)}
async function quick(page:Page){await page.getByTestId('post-consult-create-followup-button').click();const d=page.getByRole('dialog',{name:'빠른 후속 등록'});await expect(d).toBeVisible();await expect(d.getByRole('button',{name:'후속 등록',exact:true})).toBeEnabled();return d}
async function stressSubmit(page:Page,data:any,state:any){
 state.trigger='Actual ConsultModal onSubmit callback stress; valid UI-generated payload; no remount/DOM enable/state replacement';
 const before=wire.length;const copy={...data};delete copy.customerId;
 await page.getByRole('dialog',{name:'상담기록 추가'}).evaluate((el,data)=>{
  const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let f:any=key?(el as any)[key]:null;
  for(;f;f=f.return){const p=f.memoizedProps;if(p&&typeof p.onSubmit==='function'&&typeof p.onClose==='function'&&typeof p.loading==='boolean'){p.onSubmit(data);return}}
  throw Error('Actual ConsultModal callback not found');
 },copy);
 await expect.poll(()=>wire.length).toBeGreaterThan(before);state.trigger=null;
}
async function tabTo(page:Page,locator:any,max=100){for(let i=0;i<max;i++){if(await locator.evaluate((e:any)=>e===document.activeElement))return i;await page.keyboard.press('Tab')}throw Error('Real Tab sequence did not reach expected target')}

test('R01 normal consult and matching followup target/token/caches',async({page})=>{
 const s=await fixture(page);await page.goto('/');await expect.poll(()=>queries.some(x=>x.procedure==='dashboard.todayWork')).toBe(true);await spa(page,101);
 const a=await saved(page,'NORMAL_REQUEST');observations.saved=a;expect(a.prompt.customerId).toBe(101);expect(wire.filter(x=>x.procedure==='followUps.create')).toHaveLength(0);
 const q=await quick(page);const before=await snapshot(page);await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect(q).not.toBeVisible();await expect(prompt(page)).toHaveCount(0);
 observations.after=await snapshot(page);const follow=wire.find(x=>x.procedure==='followUps.create');expect(follow.input.customerId).toBe(101);
 const mutation=observations.after.mutations.find((x:any)=>x.key?.[0]?.join('.')==='followUps.create');
 expect(mutation.context.initiatingPromptToken).toBe(a.prompt.token);
 expect(observations.after.queryEvents.some((x:any)=>x.action==='invalidate'&&JSON.stringify(x.key).includes('todayWork'))).toBe(true);
 expect(queries.filter(x=>x.procedure==='followUps.listByCustomer').length).toBeGreaterThan(1);
});
test('R02 held A success after B SPA is discarded in same instance',async({page})=>{
 const s=await fixture(page);s.mode='hold';const a=await open(page);const d=await consult(page,'A_HELD');await d.getByRole('button',{name:'저장',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);
 const b=await spa(page,102);expect(b.ownerIdentity).toBe(a.ownerIdentity);observations.steps.push(a,b);s.pending[0].release();await expect.poll(()=>wire[0].response).toBe('success');await expect(d.getByRole('button',{name:'저장',exact:true})).toBeEnabled();await expect(prompt(page)).toHaveCount(0);expect(wire.filter(x=>x.procedure==='followUps.create')).toHaveLength(0);
});
for(const response of ['success','api'])test('R03/R05 B current success/modal survives old A '+response,async({page})=>{
 const s=await fixture(page);s.mode='hold';const a=await open(page);const d=await consult(page,'OLD_A');await d.getByRole('button',{name:'저장',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);const b=await spa(page,102);expect(b.ownerIdentity).toBe(a.ownerIdentity);
 observations.uiSecondSaveDisabled=await d.getByRole('button',{name:'저장 중...'}).isDisabled();
 await stressSubmit(page,{...wire[0].input,summary:'CURRENT_B'},s);await expect.poll(()=>s.pending.length).toBe(2);s.pending[1].release();await expect(prompt(page)).toBeVisible();const current=await snapshot(page);observations.beforeOld=current;
 if(response==='api'){const bd=await consult(page,'B_INPUT_MUST_REMAIN');s.pending[0].release('api');await expect.poll(()=>wire[0].response).toBe('api');await expect(bd.getByLabel('상담 요약')).toHaveValue('B_INPUT_MUST_REMAIN');await expect(bd).toBeVisible();await expect(prompt(page)).toBeVisible();observations.afterOld=await snapshot(page);expect(observations.afterOld.prompt.token).toBe(current.prompt.token);}
 else{s.pending[0].release();await expect.poll(()=>wire[0].response).toBe('success');observations.afterOld=await snapshot(page);expect(observations.afterOld.prompt.token).toBe(current.prompt.token);expect(observations.afterOld.prompt.customerId).toBe(102);s.followMode='success';const q=await quick(page);await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect(q).not.toBeVisible();expect(wire.at(-1).input.customerId).toBe(102);}
 expect(wire.filter(x=>x.procedure==='followUps.create'&&x.input.customerId!==102)).toHaveLength(0);
});
test('R04 A-B-A generation rejects old A response without remount',async({page})=>{
 const s=await fixture(page);s.mode='hold';const first=await open(page);const d=await consult(page,'OLD_A_GENERATION');await d.getByRole('button',{name:'저장',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);const b=await spa(page,102),again=await spa(page,101);observations.steps.push(first,b,again);expect(first.ownerIdentity).toBe(again.ownerIdentity);expect(again.refs.screenGeneration).toBeGreaterThan(first.refs.screenGeneration);s.pending[0].release();await expect.poll(()=>wire[0].response).toBe('success');await expect(prompt(page)).toHaveCount(0);
});
test('R06 same-customer reverse responses must preserve newest request prompt',async({page})=>{
 const s=await fixture(page);s.mode='hold';await open(page);const d=await consult(page,'OLDER_SAME_CUSTOMER');await d.locator('input[type=datetime-local]').fill('2026-11-20T14:00');await d.getByRole('checkbox').click();await d.getByRole('button',{name:'저장',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);
 const second={...wire[0].input,summary:'NEWER_SAME_CUSTOMER'};delete second.calendarSchedule;await stressSubmit(page,second,s);await expect.poll(()=>s.pending.length).toBe(2);s.pending[1].release();await expect(prompt(page)).toBeVisible();const newer=await snapshot(page);expect(newer.prompt.hasCalendarSchedule).toBe(false);observations.newestBeforeOld=newer;s.pending[0].release();await expect.poll(()=>wire[0].response).toBe('success');await page.waitForTimeout(300);observations.afterOld=await snapshot(page);expect(observations.afterOld.prompt.token,'Older request must not replace newer same-customer prompt').toBe(newer.prompt.token);
});
for(const kind of ['consult','followup'])for(const delay of [0,20])test('D01 valid '+kind+' rapid double-click delay '+delay+'ms issues one mutation',async({page})=>{
 const s=await fixture(page);await open(page);let d:any,b:any,proc:string;
 if(kind==='consult'){s.mode='hold';d=await consult(page,'VALID_DOUBLE_CLICK');b=d.getByRole('button',{name:'저장',exact:true});proc='consultations.create'}
 else{await saved(page);s.followMode='hold';d=await quick(page);b=d.getByRole('button',{name:'후속 등록',exact:true});proc='followUps.create'}
 await expect(b).toBeEnabled();const box=await b.boundingBox();await page.mouse.dblclick(box!.x+box!.width/2,box!.y+box!.height/2,{delay});await expect.poll(()=>wire.filter(x=>x.procedure===proc).length).toBeGreaterThan(0);await page.waitForTimeout(150);observations.mutationOperations=wire.filter(x=>x.procedure===proc).length;observations.httpRequests=new Set(wire.filter(x=>x.procedure===proc).map(x=>x.httpRequestId)).size;expect(observations.mutationOperations).toBe(1);s.pending.find((x:any)=>x.procedure===proc).release();if(kind==='consult')await expect(prompt(page)).toBeVisible();else{await expect(d).not.toBeVisible();await expect(prompt(page)).toHaveCount(0)}
});
for(const scope of ['different-customer','same-customer'])test('F02/F03 old followup success preserves '+scope+' newer prompt token',async({page})=>{
 const s=await fixture(page);await open(page);const old=await saved(page,'OLD_PROMPT');s.followMode='hold';const q=await quick(page);await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);await page.keyboard.press('Escape');await expect(q).not.toBeVisible();if(scope==='different-customer')await spa(page,102);const newer=await saved(page,'NEW_PROMPT',old.prompt.token);observations.tokens={old:old.prompt,newer:newer.prompt};expect(newer.prompt.token).not.toBe(old.prompt.token);s.pending[0].release();await expect.poll(()=>wire.find(x=>x.procedure==='followUps.create').response).toBe('success');await expect(prompt(page)).toBeVisible();const after=await snapshot(page);observations.after=after;expect(after.prompt.token).toBe(newer.prompt.token);const ctx=after.mutations.find((x:any)=>x.key?.[0]?.join('.')==='followUps.create').context;expect(ctx.initiatingPromptToken).toBe(old.prompt.token);
});
test('F04 other-customer late followup error preserves current prompt',async({page})=>{
 const s=await fixture(page);await open(page);await saved(page);s.followMode='hold';const q=await quick(page);await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);await page.keyboard.press('Escape');await spa(page,102);const b=await saved(page,'B_CURRENT');s.pending[0].release('api');await expect.poll(()=>wire.find(x=>x.procedure==='followUps.create').response).toBe('api');await expect(prompt(page)).toBeVisible();expect((await snapshot(page)).prompt.token).toBe(b.prompt.token);
});
test('F05 failed followup keeps input/token and explicit retry succeeds',async({page})=>{
 const s=await fixture(page);await open(page);const before=await saved(page);const q=await quick(page);await q.locator('input:not([type=date])').last().fill('RETAIN_REASON');s.followMode='api';await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect(q.getByRole('button',{name:'후속 등록',exact:true})).toBeEnabled();await expect(q.locator('input:not([type=date])').last()).toHaveValue('RETAIN_REASON');expect((await snapshot(page)).prompt.token).toBe(before.prompt.token);await expect.poll(()=>q.evaluate(el=>el.contains(document.activeElement)),{message:'A failed save must keep keyboard focus inside the open dialog'}).toBe(true);observations.saveErrorFocus=await snapshot(page);s.followMode='success';await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect(q).not.toBeVisible();await expect(prompt(page)).toHaveCount(0);expect(wire.filter(x=>x.procedure==='followUps.create')).toHaveLength(2);
});
test('F08 successive consultations have distinct actual tokens',async({page})=>{
 await fixture(page);await open(page);const tokens:string[]=[];for(let i=0;i<3;i++){const snap=await saved(page,'TOKEN_'+i);tokens.push(snap.prompt.token);await page.getByTestId('post-consult-dismiss-button').click()}observations.tokens=tokens;expect(new Set(tokens).size).toBe(3);expect(wire.filter(x=>x.procedure==='followUps.create')).toHaveLength(0);
});

for(const key of ['Enter','Space'])test('K01 real Tab '+key+' initial focus trap Escape return',async({page})=>{
 await fixture(page);await open(page);await saved(page);const create=page.getByTestId('post-consult-create-followup-button'),dismiss=page.getByTestId('post-consult-dismiss-button');observations.tabSteps=await tabTo(page,create);await page.keyboard.press(key);const q=page.getByRole('dialog',{name:'빠른 후속 등록'});await expect(q).toBeVisible();
 await expect.poll(()=>q.evaluate(el=>el.contains(document.activeElement))).toBe(true);observations.initial=await snapshot(page);
 const count=await q.locator('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]').count();const trace:any[]=[];
 for(const direction of ['Tab','Shift+Tab'])for(let i=0;i<count+2;i++){await page.keyboard.press(direction);const v=await q.evaluate(el=>({inside:el.contains(document.activeElement),tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,40),hidden:!!document.activeElement?.closest('[aria-hidden=true]')}));trace.push(v);expect(v.inside).toBe(true);expect(v.hidden).toBe(false)}
 observations.trap=trace;await page.keyboard.press('Escape');await expect(q).not.toBeVisible();await expect(create).toBeFocused();observations.returned=await snapshot(page);await page.keyboard.press('Tab');await expect(dismiss).toBeFocused();
});
test('K02 close control returns focus to actual prompt trigger',async({page})=>{
 await fixture(page);await open(page);await saved(page);const create=page.getByTestId('post-consult-create-followup-button');await tabTo(page,create);await page.keyboard.press('Enter');const q=page.getByRole('dialog',{name:'빠른 후속 등록'});await expect(q).toBeVisible();observations.cancelControl=await q.getByRole('button',{name:'닫기',exact:true}).count();await q.getByRole('button',{name:'닫기',exact:true}).click();await expect(q).not.toBeVisible();await expect(create).toBeFocused();
});
test('K03 successful save unmounts trigger and must leave safe visible focus',async({page})=>{
 await fixture(page);await open(page);await saved(page);const create=page.getByTestId('post-consult-create-followup-button');await tabTo(page,create);await page.keyboard.press('Enter');const q=page.getByRole('dialog',{name:'빠른 후속 등록'});await expect(q).toBeVisible();await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect(q).not.toBeVisible();await expect(prompt(page)).toHaveCount(0);await page.waitForTimeout(600);observations.afterSave=await snapshot(page);expect(observations.afterSave.active.tag,'Unmounted trigger requires a safe focus fallback').not.toBe('BODY');expect(observations.afterSave.active.hidden).toBe(false);
});
test('K04 route change while dialog open needs safe close focus on current customer',async({page})=>{
 await fixture(page);await open(page);await saved(page);const q=await quick(page);await spa(page,102);await expect(q.getByRole('group',{name:'대상 고객'})).toContainText(names[102]);await page.keyboard.press('Escape');await expect(q).not.toBeVisible();await page.waitForTimeout(600);observations.afterNavigationClose=await snapshot(page);expect(observations.afterNavigationClose.active.tag,'Old trigger is gone after route change').not.toBe('BODY');expect(observations.afterNavigationClose.active.hidden).toBe(false);
});

test('F03-null old non-prompt followup cannot dismiss a later same-customer consultation prompt',async({page})=>{
 const s=await fixture(page);const initial=await open(page);await expect(prompt(page)).toHaveCount(0);
 await page.getByRole('tab',{name:/상담·후속관리/}).click();await page.getByRole('button',{name:'다음 연락일 설정',exact:true}).first().click();
 const q=page.getByRole('dialog',{name:'빠른 후속 등록'});await expect(q.getByRole('group',{name:'대상 고객'})).toContainText(names[101]);await expect(q.getByRole('button',{name:'후속 등록',exact:true})).toBeEnabled();
 s.followMode='hold';await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);observations.pending=await snapshot(page);
 const ctx=observations.pending.mutations.find((x:any)=>x.key?.[0]?.join('.')==='followUps.create').context;expect(ctx.initiatingPromptToken).toBeNull();
 await page.keyboard.press('Escape');await expect(q).not.toBeVisible();const newer=await saved(page,'LATER_CONSULTATION_AFTER_OLD_FOLLOWUP');expect(newer.ownerIdentity).toBe(initial.ownerIdentity);observations.newer=newer;
 s.pending[0].release();await expect.poll(()=>wire.find(x=>x.procedure==='followUps.create').response).toBe('success');await page.waitForTimeout(400);observations.after=await snapshot(page);expect(observations.after.prompt?.token,'A request without a prompt owner cannot clear a future prompt').toBe(newer.prompt.token);
});

// These three cases retain the real ConsultModal callback stress used by R06.
// The second payload comes from valid first-request UI data plus the current UI input.
// Controls stay disabled as the product dictates; no hook state, DOM enablement, remount, or focus is injected.
function wireContext(row:any){
 const mutation=row.clientAtRequest.mutations.filter((m:any)=>m.key?.[0]?.join('.')===row.procedure&&m.variables?.customerId===row.input.customerId&&(!row.input.summary||m.variables.summary===row.input.summary)&&(!row.input.reason||m.variables.reason===row.input.reason)).at(-1);
 expect(mutation,'Actual mutation cache entry must exist at transport time').toBeTruthy();
 expect(mutation.context,'Actual onMutate ownership context must be captured').toBeTruthy();
 expect(mutation.contextFrozen,'Product request ownership context must be immutable').toBe(true);
 return Object.freeze({...mutation.context});
}
async function settledMutation(page:Page,row:any,status:string){
 const context=wireContext(row);
 await expect.poll(async()=>{const current=await snapshot(page);return current.mutations.find((m:any)=>m.context?.requestIdentity===context.requestIdentity&&m.context?.kind===context.kind)?.status},{message:'Wait for the actual mutation callback and settlement'}).toBe(status);
 return snapshot(page);
}
for(const outcomes of [
 {older:'api',newer:'success',title:'older error after newer success'},
 {older:'success',newer:'api',title:'older success after newer error'},
])test('R07 same-customer reverse '+outcomes.title+' preserves latest prompt and input',async({page})=>{
 const s=await fixture(page);await open(page);
 const baseline=outcomes.newer==='api'?await saved(page,'BASELINE_BEFORE_NEWER_ERROR'):null;
 s.mode='hold';const d=await consult(page,'OLDER_ORDERED_REQUEST');
 await d.getByRole('button',{name:'저장',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);
 const oldRow=s.pending[0].row;await d.getByLabel('상담 요약').fill('NEWER_ORDERED_UI_INPUT');
 const second={...oldRow.input,summary:await d.getByLabel('상담 요약').inputValue()};
 await stressSubmit(page,second,s);await expect.poll(()=>s.pending.length).toBe(2);
 const newRow=s.pending[1].row,oldContext=wireContext(oldRow),newContext=wireContext(newRow);
 expect(oldContext.requestCustomerId).toBe(101);expect(newContext.requestCustomerId).toBe(101);
 expect(newContext.requestGeneration).toBe(oldContext.requestGeneration);
 expect(newContext.requestIdentity).toBeGreaterThan(oldContext.requestIdentity);
 observations.actualRequestContexts={older:oldContext,newer:newContext,outcomes};
 s.pending[1].release(outcomes.newer);await settledMutation(page,newRow,outcomes.newer==='api'?'error':'success');
 let currentDialog:any=d,currentToken:string;
 if(outcomes.newer==='success'){
  await expect(prompt(page)).toBeVisible();currentToken=(await snapshot(page)).prompt.token;
  currentDialog=await consult(page,'CURRENT_INPUT_AFTER_NEWER_SUCCESS');
 }else{
  await expect(d).toBeVisible();await expect(d.getByLabel('상담 요약')).toHaveValue('NEWER_ORDERED_UI_INPUT');
  currentToken=baseline!.prompt.token;expect((await snapshot(page)).prompt.token).toBe(currentToken);
 }
 observations.beforeOlder=await snapshot(page);const expectedInput=await currentDialog.getByLabel('상담 요약').inputValue();
 s.pending[0].release(outcomes.older);await settledMutation(page,oldRow,outcomes.older==='api'?'error':'success');
 await expect(currentDialog).toBeVisible();await expect(currentDialog.getByLabel('상담 요약')).toHaveValue(expectedInput);
 await expect(prompt(page)).toBeVisible();observations.afterOlder=await snapshot(page);
 expect(observations.afterOlder.prompt.token).toBe(currentToken);
 expect(observations.afterOlder.prompt.customerId).toBe(101);
 expect(wire.filter(x=>x.procedure==='followUps.create')).toHaveLength(0);
});
test('F09 same-customer old followup error after cancel/reopen preserves new input and prompt',async({page})=>{
 const s=await fixture(page);await open(page);const old=await saved(page,'OLD_PROMPT_BEFORE_CANCEL');
 const q=await quick(page);await q.locator('input:not([type=date])').last().fill('OLD_PENDING_REASON');
 s.followMode='hold';await q.getByRole('button',{name:'후속 등록',exact:true}).click();await expect.poll(()=>s.pending.length).toBe(1);
 const oldRow=s.pending[0].row,context=wireContext(oldRow);expect(context.initiatingPromptToken).toBe(old.prompt.token);
 await page.keyboard.press('Escape');await expect(q).not.toBeVisible();
 const newer=await saved(page,'NEW_PROMPT_AFTER_CANCEL',old.prompt.token);
 await page.getByTestId('post-consult-create-followup-button').click();
 const reopened=page.getByRole('dialog',{name:'빠른 후속 등록'});await expect(reopened).toBeVisible();
 await expect(reopened.getByRole('group',{name:'대상 고객'})).toContainText(names[101]);
 await reopened.locator('input:not([type=date])').last().fill('NEW_SESSION_INPUT_MUST_REMAIN');
 observations.beforeOldError=await snapshot(page);observations.oldContext=context;
 s.pending[0].release('api');await settledMutation(page,oldRow,'error');
 await expect(reopened).toBeVisible();await expect(reopened.locator('input:not([type=date])').last()).toHaveValue('NEW_SESSION_INPUT_MUST_REMAIN');
 await expect(reopened.getByRole('button',{name:'후속 등록',exact:true})).toBeEnabled();
 await expect.poll(()=>reopened.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 observations.afterOldError=await snapshot(page);expect(observations.afterOldError.prompt.token).toBe(newer.prompt.token);
 expect(observations.afterOldError.prompt.customerId).toBe(101);
 expect(wire.filter(x=>x.procedure==='followUps.create')).toHaveLength(1);
});


async function toastSnapshot(page:Page){return page.locator('[data-sonner-toast]').evaluateAll(elements=>elements.map(e=>({text:e.textContent||'',type:e.getAttribute('data-type')})))}
for(const kind of ['consultation','followup'])for(const response of ['success','api'])test('U01 fully unmounted A '+kind+' late '+response+' cannot contaminate current B UI',async({page})=>{
 const s=await fixture(page),first=await open(page);let d:any;
 if(kind==='consultation'){s.mode='hold';d=await consult(page,'UNMOUNTED_A_CONSULT');await d.getByRole('button',{name:'저장',exact:true}).click()}
 else{await saved(page,'SETUP_A_PROMPT');s.followMode='hold';d=await quick(page);await d.locator('input:not([type=date])').last().fill('UNMOUNTED_A_FOLLOWUP');await d.getByRole('button',{name:'후속 등록',exact:true}).click()}
 await expect.poll(()=>s.pending.length).toBe(1);const held=s.pending[0],context=wireContext(held.row);observations.oldContext=context;
 expect(context.requestCustomerId).toBe(101);expect(context.kind).toBe(kind);expect(context.requestGeneration).toBe(first.refs.screenGeneration);expect(context.requestIdentity).toBeGreaterThan(0);
 expect(context.initiatingPromptToken).toBe(kind==='followup'?held.row.clientAtRequest.prompt.token:null);
 await page.keyboard.press('Escape');await expect(d).not.toBeVisible();
 // Actual visible list control unmounts CustomerDetail. Only re-entry uses the disclosed history SPA helper.
 await page.getByTestId('customer-detail-focus-fallback').click();await expect(page).toHaveURL(/\/customers$/);
 await expect(page.getByRole('heading',{name:'고객 관리',exact:true})).toBeVisible();
 const list=await snapshot(page);observations.listUnmounted=list;expect(list.ownerIdentity).toBeNull();
 const second=await spa(page,102);observations.ownerLifecycle={before:first.ownerIdentity,list:list.ownerIdentity,after:second.ownerIdentity};expect(second.ownerIdentity).not.toBe(first.ownerIdentity);expect(second.owner?.id).toBe(102);expect(second.timeOrigin).toBe(first.timeOrigin);
 const currentPrompt=kind==='followup'?await saved(page,'CURRENT_B_AFTER_FULL_UNMOUNT'):null;
 const beforeToasts=await toastSnapshot(page);observations.beforeRelease={snapshot:await snapshot(page),toasts:beforeToasts};
 held.release(response);await settledMutation(page,held.row,response==='api'?'error':'success');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForTimeout(250);
 const afterToasts=await toastSnapshot(page),counts=new Map<string,number>();for(const toast of beforeToasts)counts.set(toast.text,(counts.get(toast.text)||0)+1);
 const added=afterToasts.filter(toast=>{const count=counts.get(toast.text)||0;if(count){counts.set(toast.text,count-1);return false}return true});
 observations.afterRelease={snapshot:await snapshot(page),toasts:afterToasts,newToasts:added};
 if(currentPrompt){await expect(prompt(page)).toBeVisible();expect(observations.afterRelease.snapshot.prompt.token).toBe(currentPrompt.prompt.token)}else await expect(prompt(page)).toHaveCount(0);
 const lateInvalidations=observations.afterRelease.snapshot.queryEvents.slice(observations.beforeRelease.snapshot.queryEvents.length).filter((event:any)=>event.action==='invalidate');
 observations.afterRelease.lateInvalidations=lateInvalidations;
 if(response==='success'){
  const procedure=kind==='consultation'?'consultations.list':'followUps.listByCustomer';
  expect(lateInvalidations.some((event:any)=>event.key?.[0]?.join('.')===procedure&&event.key?.[1]?.input?.customerId===101),'The successfully stored A result must still invalidate A cache').toBe(true);
  if(kind==='consultation')expect(lateInvalidations.some((event:any)=>event.key?.[0]?.join('.')==='customers.get'&&event.key?.[1]?.input?.id===101)).toBe(true);
 }
 expect(added,'A fully unmounted customer must not emit late success/error UI on current B').toHaveLength(0);
});
