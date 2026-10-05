# P2-07 targeted overlap / keyboard fix handoff

P2-07 TARGETED OVERLAP/KEYBOARD FIX CANDIDATE: PASS
A24 ORIGINAL: FAIL — VISUAL BASELINES NOT YET REFRESHED
VISUAL BASELINES MODIFIED: NO
INDEPENDENT VISUAL REAUDIT REQUIRED: YES
Final Quality Gate: NOT YET

## Identity and scope

- Repository: raonisi/boa.
- Worktree: C:/Users/이도현/.codex/worktrees/p2-07-mobile-first-screen/boa-main
- Branch: codex/p2-07-mobile-first-screen.
- BASE / HEAD / freshly checked origin/main: fef08b653facf701baa117a8183085569096fad9
- Previous frozen candidate: P207-592462bb4a09e51502d7c9aa.
- New candidate: P207FIX-858c0f6d4ddebe21f4f3f9ee
- External evidence: C:\work\boa-p207-overlap-fix-20261003-1791008813220
- Instruction: BOA_P2-07_Targeted_Overlap_Keyboard_Fix_20261003.md (copied as instruction-master.md).
- Only the three page files, existing P2-07 E2E, and this handoff are changed. No staged files or commits.

## Actual defects and implementation

F01: old first CustomerList CTA y680–728 at360, nav top714:14px overlap. Secondary recent activity, assignee, execution chips and metadata now render after the primary CTA on mobile; every original information item and route remains. The customer name, essential status and next action remain before the CTA. Desktop renders the same original content order.

F02/F04: old CustomerDetail tab trigger y597–641 at390 overlaps quick bar top623 by18px; at360 y617–661 is entirely covered by the bar at579–706 (44px intersection). Mobile now renders core summary, task navigation and active panel before contact/management details and secondary execution/360/action panels in actual DOM order. A shared local secondaryPanels fragment renders at the original desktop position. CSS order-based task reordering was removed. Mobile core typography/spacing is compact, and contact/management details remain accessible afterward. All tab values, URL/history handlers, quick calendar URL and fixed quick-action bar are unchanged. No positive tabindex.

F03: old notification primary CTA y697–745 at360, nav top714:31px overlap and blocked center. Mobile places the original primary navigation action before the status/read controls and moves message/timing metadata after actions. Type, priority, record status, title and action state remain above actions. Desktop uses the original visible order; original handlers/payloads are reused.

## Geometry and hit testing

Real Chromium DOMRect and elementFromPoint measurements at initial scrollY=0. Target center and98%-height point must both hit the target; task-list outer border is also checked. No force click, z-index/pointer-events bypass, scaling, global offset or MobileNav change.

| Target | Viewport width | Top–bottom px | Blocker top px | Clearance px | Touch height px | Hit |
|---|---:|---:|---:|---:|---:|---|
| CustomerList primary CTA | 320 | 570–618 | 654 | 36 | 48 | PASS |
| CustomerList primary CTA | 360 | 546–594 | 714 | 120 | 48 | PASS |
| CustomerList primary CTA | 390 | 546–594 | 758 | 164 | 48 | PASS |
| Detail task trigger | 320 | 405–449 | 519 | 70 | 44 | PASS |
| Detail task trigger | 360 | 377–421 | 579 | 158 | 44 | PASS |
| Detail task trigger | 390 | 357–401 | 623 | 222 | 44 | PASS |
| Notification primary CTA | 320 | 585–633 | 654 | 21 | 48 | PASS |
| Notification primary CTA | 360 | 561–609 | 714 | 105 | 48 | PASS |
| Notification primary CTA | 390 | 561–609 | 758 | 149 | 48 | PASS |

Full tablist clearance including padding/border is217px at390,153px at360 and65px at320. All affected mobile touch targets are at least44px high and wide. CustomerList/notification first-card y remains423/366 at390 and320, preserving prior gains. Detail panel starts430/450/478 at390/360/320. See geometry-summary.json and geometry-comparison.json for every OLD/NEW measure.

1440×900: all three OLD/NEW full-page screenshots are pixel-identical, including full document dimensions1002/2849/1580. The action hit-test after normal scroll also passes. Existing desktop target sizes (32px list,28px notification) remain unchanged; mobile targets are48/44/48px.

## Actual keyboard and accessibility

390/360 actual Tab traversal: task tab moves from visit16 to visit3; old secondary-before-task count9 becomes0 and severe document-order inversions2 become0. Evidence stores label, viewport y, document y and DOM index. Fixed bottom controls are classified separately from normal document flow. ArrowRight/ArrowLeft, selected tab, URL, Back/Forward, focus-visible, Sheet trap/Escape/focus return and Collapsible aria-expanded/Enter/Space pass.

Targeted axe passes. Existing accessibility suite16PASS and critical suite12PASS. These use isolated loopback MySQL23327, verified datadir under the external evidence directory, synthetic seeds and normal shutdown. No production DB access or writes.

## OLD negative control

Old product bytes were first checked against all five frozen raw/canonical identities and manifest SHA7ba8bf6eaf3fa4dd2923677c0b3f75d93c5363e1d74acb099800dc7c4b17fa46. Preserved originals are in old-source/. Separate Git-archive runtime snapshots contain exact OLD/NEW product bytes and the new measurement oracle.

Old capture26PASS is evidence collection only. The strengthened OLD negative control has9expected failures and5passes: seven geometry failures (detail390; all three pages360/320) and keyboard390/360 failures. The NEW candidate passes these assertions. Snapshot comparison instrumentation only changes screenshot capture to fullPage; it is external and does not update expected PNGs.

## Semantics and protection

TypeScript AST-printer multiset comparison against the frozen OLD source confirms107API/mutation calls,14permission declarations,11effects,1query-input declaration and41navigation/tab-selection calls unchanged. Behavioral suites verify search/filter/sort/segments/pagination, role gates, management Sheet actions, task/deep links, notification filters/selection/bulk/action semantics. No server, API, DB, schema, shared/global components, token/theme/CSS, package/lock or workflows changed.

Protected identities:44files including30baseline PNGs unchanged in raw bytes and canonical Git content. Shared Badge, P2-06 organization implementation/tests, DashboardLayout, package/lock and quality baselines remain untouched.

## Executed quality gates

- pnpm check:PASS.
- pnpm test:116files /1252tests PASS.
- Focused unit:CustomerList.presetQuery, CustomerDetail.accessibility, Notifications:3files /42tests PASS.
- NODE_ENV=production pnpm build:PASS.
- pnpm bundle:check:PASS; entry172.6/174.1KiB, largest232.8/244.4, JS794.5/826.0, CSS32.8/34.1gzip.
- P2-07 targeted:61PASS.
- Separate overlap/hit subset:12PASS.
- Separate keyboard/arrow/URL/history subset:2PASS.
- Existing P2-01–P2-06/customer detail actionbar/CustomerList count-sort regression:111PASS.
- Critical:12PASS; accessibility:16PASS.
- Standard pnpm test:e2e (unchanged workers2):713PASS /102existing SKIP /7FAIL /0flaky.
- Targeted V01–V06 visual compare:6FAIL at unchanged screenshot assertion; no functional assertion failures in these cases.

All native command arguments, timestamps, exits and logs are in command-results.json. No new skips, timeout increases, weakened assertions or snapshot updates. Original test timeout30s/expect10s and all existing baselines remain.

## Full E2E classification and acceptance

Observed B01 failures in this full run:1. B01 is the existing P204-07 mobile/calendar timeout, independently reproduced on BASE in prior evidence. V01–V06 are customer-list/detail/notifications at390/360. Legacy B02/B03 are the two customer-list visual IDs within this six; the other four were introduced by the original P2-07 layout and remain visual-baseline adjudication work. They are not relabeled as pre-existing.

Current targeted-fix instruction explicitly permits B01 plus these six mismatches while preserving original A24 as FAIL. New nonvisual full-E2E failures:0. All F01–F16:PASS. This is targeted defect acceptance, and does not claim the repository full E2E or Final Quality Gate is clean.

## New freeze and independent re-audit

candidate-manifest.json and candidate-freeze-receipt.json record new manifest SHA-256, each file rawSHA256/canonicalBlob, product.patch/tests.patch/full.patch hashes, evidence hashes and post-freeze drift0. Patches are against BASE; the full patch is checked with git apply --check --cached on a clean BASE checkout without staging. The ID derives from BASE plus ordered three product files and E2E identities; this handoff is added afterward to avoid a circular hash.

First experimental results under first-* are superseded by final fix-* runs after reducing the amount of moved JSX. All accepted executions use source-validation-identity.json values. The original frozen evidence remains intact.

Rollback is recoverable from preserved old-source/ and prior candidate patches; no rollback action was performed. Next work is independent read-only visual re-audit and baseline adjudication. Publishing is not authorized.

## Known backlog and prohibited actions

B01–B03; V01–V06 adjudication; A11Y-DIALOG-FOCUS-01; P2-05 DialogDescription warnings; existing non-branch contrast axe nodes; N04 timezone; nullable teamId; OBS02-R01 remain separate. P2-06 stays closed. None is claimed fixed by this work.

P2-07 targeted defect fix: PASS
Actual overlap/clipping defects: 0
Keyboard severe inversion: 0
Baseline files modified: NO
Next: independent visual re-audit / baseline adjudication
Final Quality Gate: NOT YET
P2-08: 미착수

commit0 / push0 / PR0 / merge0 / deploy0 / snapshot-update0 / Railway0 / production DB0 / P2-080
