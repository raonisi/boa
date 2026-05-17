# BOA CRM UI/UX Field UAT Checklist

## Scope
- Web dashboard + notification center
- Mobile home + mobile notification tab
- Mobile three-touch task completion: see `docs/MOBILE_THREE_TOUCH_TASK_UX.md`
- Sales funnel and performance report: see `docs/SALES_FUNNEL_PERFORMANCE_REPORT.md`
- New roadmap PR6 operation risk center: see `docs/OPERATION_RISK_CENTER.md`
- Consultation script edit/delete hotfix in consultation tools management
- BOA logo and premium login branding hotfix
- Customer detail quick actions
- Priority rules: urgent -> today -> general
- Unread-first sorting within each priority

## Test Accounts
- branch_admin
- sub_branch_admin
- team_leader
- member

## Device/Environment
- Desktop browser (Chrome, Edge)
- Mobile Android app (internal build)
- Normal network + temporarily degraded network

## Android Canonical Web Route UAT
1. Confirm Capacitor Android uses the production web origin `https://raonisis.kr` and does not define a separate native route map.
2. In the Android internal build or mobile WebView, verify canonical route entry for `/dashboard` redirects safely to the dashboard.
3. Verify `/customers`, `/calendar`, `/notifications`, `/analytics`, and `/operation-risk` load their intended screens.
4. Verify `/operation-risk` remains branch_admin-only; sub_branch_admin, team_leader, member, inactive, and resigned users cannot bypass the guard by direct URL.
5. Verify deprecated `/admin-audit` does not 404 and redirects to `/operation-risk?tab=logs` only after branch_admin authorization.
6. Verify MobileNav and DashboardLayout use the same canonical route targets for customers, calendar, notifications, analytics, and operation risk.
7. After `pnpm.cmd exec cap sync android`, confirm generated Android files are not committed unless the PR intentionally changes native configuration.
8. Confirm no APK/AAB/JKS/keystore/google-services.json/local.properties files are included in the PR.

## Core Acceptance Criteria
- Priority labels are consistent across web and mobile.
- Sorting order is consistent across web and mobile.
- Quick actions are reachable within two taps/clicks.
- Read/process actions reflect immediately after mutation.
- No role can access out-of-scope operational data.
- Consultation script edit/delete actions are branch_admin-only and refresh the list after mutation.
- Login, sidebar, and mobile branding show the BOA logo without checkerboard background or stretched proportions.
- Permanent delete is retained but hardened: records with linked operational history are not removed, blocked attempts are auditable, and only branch_admin can execute the final action.

## Error / Forbidden / Empty State UAT Steps
1. In a production build, trigger a client error path and confirm the user screen does not show stack traces, internal file paths, tokens, or raw technical details.
2. Confirm the error screen shows "문제가 발생했습니다.", "다시 시도", and "홈으로 이동" actions with mobile-friendly touch targets.
3. In development mode, confirm error details are available only inside a collapsed developer disclosure.
4. Directly open a route outside the current role scope and confirm the screen explains that access is unavailable for the current permission instead of silently redirecting.
5. Confirm branch_admin, sub_branch_admin, team_leader, member, inactive, and resigned authorization outcomes remain unchanged on protected routes and APIs.
6. Confirm empty list/report states explain that there is no data and provide a next action or filter-change hint when the page supports one.
7. Confirm error, forbidden, and empty states stay within the mobile viewport without horizontal scroll or bottom navigation overlap.
8. Confirm customer contact information and birth date display policies are unchanged in authorized customer work screens.

## Web UAT Steps
1. Open dashboard and verify "field immediate queue" appears.
2. Toggle filter chips (all/urgent/today/general) and verify list updates.
3. Confirm unread items appear first inside same priority.
4. Execute "read" and "complete" actions and verify UI refresh.
5. Open notification center and verify:
   - priority cards count correctly,
   - filter + sort behavior matches dashboard,
   - unread badge changes after mark-read.

## Branding / Login UAT Steps

1. Open a signed-out browser session and verify the BOA Best of All logo appears on the login screen without a checkerboard background.
2. Confirm the login copy reads as a premium internal financial CRM screen and the CTA remains the Google login entry point.
3. Click the login CTA and confirm the existing Google OAuth flow starts.
4. In a signed-in desktop session, verify the sidebar top logo is visible, not stretched, and still works in collapsed mode.
5. In mobile web, open the bottom "더보기" sheet and verify the BOA logo is visible without crowding menu actions.
6. Confirm route/menu visibility by role is unchanged.
7. Confirm Android app icon was not changed in this PR.
8. Confirm no `.env`, `google-services.json`, APK/AAB/JKS/keystore, or `local.properties` files are included.

## Mobile UAT Steps
1. Open home tab and verify:
   - immediate notification section is shown,
   - priority pills (all/urgent/today/general) work,
   - unread-first sorting is applied.
2. Open notifications tab and verify:
   - urgent/today/general counters are correct,
   - priority filter toggles correctly,
   - unread-first sorting is applied.
3. Tap notification item to mark read and verify:
   - unread count decreases,
   - dashboard and notifications tab remain in sync after refresh.

## Customer Detail UAT Steps
1. Open customer detail and confirm sticky quick action bar appears.
2. Validate quick actions:
   - add consultation record,
   - set next follow-up date,
   - add contract,
   - open message template tools.
3. Scroll long page and verify sticky behavior remains usable.

## Customer Sales Workspace UAT Steps
1. Open `/customers` and confirm the first visible section answers which customers to contact today.
2. Confirm priority, warning, no-next-action, and uncontacted filters keep role scope unchanged.
3. Confirm sales actions are visually separated from DB assignment, bulk reassignment, reclaim, and import actions.
4. Open customer detail and confirm Next Best Action appears before history-heavy sections.
5. Complete the flow from consultation preparation to consultation record, follow-up, and contract entry without leaving the workspace.
6. In mobile width, confirm the bottom customer CTA does not overlap MobileNav and all dialogs stay within the viewport.

## Deleted Data Permanent Delete Safeguard UAT

Customer/contract permanent delete is retained as a controlled branch_admin-only operation. It is not an archive-only replacement.

1. Log in as branch_admin and open `/deleted-data`.
2. Confirm only soft-deleted customers/contracts are listed as permanent-delete candidates.
3. Open a customer permanent-delete dialog and verify the target type, target ID, target name, irreversible warning, linked data count, reason field, and exact `완전삭제` confirmation field are shown.
4. Confirm the final delete button stays disabled until a reason is entered and `완전삭제` is typed exactly.
5. Confirm pending state prevents duplicate clicks.
6. Try a record with linked operational history and confirm the server blocks permanent delete while keeping the record inactive.
7. Confirm blocked attempts create an auditable `PERMANENT_DELETE_BLOCKED` activity log without storing full phone numbers, tokens, secrets, consultation body text, disease names, product names, or premium detail text.
8. Confirm eligible soft-deleted customer/contract records can still be permanently deleted by branch_admin after reason and confirmation.
9. Confirm sub_branch_admin, team_leader, member, inactive, and resigned users do not see usable permanent-delete controls and direct API calls are blocked.
10. Confirm customer list, contract list, analytics, performance, operation-risk, and activity log screens remain safe after permanent delete.

## Consultation Tools Management UAT Steps

This hotfix is separate from PR5 `/analytics`, PR6 `/operation-risk`, and PR19-4 notification preference work.

1. Open the consultation tools management page as branch_admin.
2. In the consultation script tab, create a test script with safe placeholder text only.
3. Click "수정", change title/category/body/compliance note/tags, save, and verify the list reflects the edited values.
4. Click "삭제", confirm the dialog, and verify the script disappears from the list.
5. Confirm delete is a soft deactivation (`isActive=false` / `deletedAt`), not a hard delete.
6. Confirm default seed scripts use the same soft-deactivate path because the current schema has no seed marker.
7. Confirm sub_branch_admin, team_leader, and member do not see edit/delete controls and direct API mutation is blocked.
8. Confirm inactive/resigned accounts cannot call consultation script mutations.
9. Confirm activity logs do not store full consultation script body text.
10. Confirm PR5 `/analytics` and PR6 `/operation-risk` screens are unchanged.

## Consultation Checklist / Message Template CRUD Hotfix UAT

This hotfix completes the consultation-tools CRUD pattern for checklist definitions and follow-up message templates. It is separate from consultation script CRUD, PR5 analytics, PR6 operation-risk, and push notification work.

### Checklist Definitions
1. Log in as branch_admin and open the consultation tools checklist tab.
2. Confirm checklist create still works.
3. Click "수정", change title/phase/category/sort/required/description, save, and verify the list refreshes.
4. Click "삭제", confirm the dialog, and verify the checklist disappears from the normal list.
5. Confirm delete is a soft deactivation (`isActive=false` / `deletedAt`) and existing consultation check results are not deleted.
6. Confirm sub_branch_admin, team_leader, and member do not see edit/delete controls and direct API mutation is blocked.
7. Confirm inactive/resigned accounts cannot call checklist management mutations.
8. Confirm activity logs do not store full checklist description text.

### Message Templates
1. Log in as branch_admin and open the follow-up message template tab.
2. Confirm template create still works.
3. Click "수정", change title/situation/channel/body/compliance note, save, and verify the list refreshes.
4. Confirm banned phrases and unsupported placeholders are still rejected.
5. Click "삭제", confirm the dialog, and verify the template disappears from the normal list.
6. Confirm delete is a soft deactivation (`isActive=false` / `deletedAt`).
7. Confirm sub_branch_admin, team_leader, and member can still view/copy usable templates but cannot edit/delete.
8. Confirm `MESSAGE_TEMPLATE_COPIED` still records copy activity without storing full message body text.

## Sales Funnel / Performance Report UAT Steps

### Desktop
1. Open `/analytics` as branch_admin and verify the sales funnel, KPI cards, conversion rates, member ranking, and bottleneck diagnosis render.
2. Change the period filter:
   - today,
   - last 7 days,
   - this month,
   - last month,
   - custom range.
3. Change organization filters:
   - all,
   - sub branch,
   - team,
   - individual,
   - my DB.
4. Confirm member role can open `/analytics` but only sees their own report and no other member ranking.
5. Confirm empty ranges show a helpful empty state instead of broken charts or NaN/Infinity rates.
6. Confirm PR6 operation-risk content, download risk, or audit monitoring is not mixed into this report.

### Mobile Web
1. Open `/analytics` in a narrow viewport and confirm the funnel switches into vertical cards without horizontal scroll.
2. Verify KPI cards, bottleneck diagnosis, and ranking table remain readable.
3. Verify long team/user names and large monthly premium numbers do not break the card layout.

### Android APK
1. Open the Android internal build and navigate to `/analytics`.
2. Confirm WebView route access, vertical funnel cards, and page scroll are stable.
3. Confirm no APK/AAB/JKS/keystore/google-services.json/local.properties files are included in the PR.

### Role Accounts
1. branch_admin: all, sub branch, team, individual, and my DB scopes.
2. sub_branch_admin: subordinate scope only; outside team/user blocked.
3. team_leader: own team/member scope only; other team blocked.
4. member: own report only; no team/all ranking.
5. inactive/resigned: access blocked.

### My Customer Pipeline Scope
1. Log in as branch_admin and open `/analytics`.
2. Compare `산하 전체` with `내 담당 고객`; the managed view may include subordinate customers, while the mine view must include only customers where the branch admin is the direct assignee.
3. Repeat as sub_branch_admin and team_leader; subordinate team/customer data must disappear in `내 담당 고객`.
4. Log in as member and confirm the scope is fixed to `내 담당 고객` with no team ranking.
5. Confirm empty mine-scope data shows the dedicated empty state and no NaN/Infinity values.
6. Confirm mobile filter controls do not overflow.


### Sales Pipeline Member-Specific Scope UAT
1. Log in as branch_admin and open `/analytics`.
2. Select the member-specific scope option and choose an active organization member.
3. Confirm KPI cards, funnel stages, conversion rows, bottleneck diagnosis, and premium totals are recalculated from only that selected user's assigned customers.
4. Confirm member ranking is hidden and the page explains that member-specific scope is a single-assignee report.
5. Repeat as sub_branch_admin and confirm only subordinate users can be selected.
6. Repeat as team_leader and confirm only accessible team users can be selected.
7. Log in as member and confirm the member-specific scope option is not shown.
8. Confirm selecting no member shows the choose-member empty state and does not reuse stale managed-scope data.
9. Confirm mobile layout keeps the three scope buttons and member selector readable.

### Actual Sales Pipeline My Customer Scope Hotfix
1. Log in as branch_admin and open `/sales-pipeline`.
2. Switch between the managed-scope option and my-customer option; the actual drag-and-drop pipeline columns and customer counts must refetch and change.
3. Confirm my-customer scope includes only customers whose direct assignee is the current user and excludes subordinate users' customers.
4. Select the member-specific scope option, choose an active organization member, and confirm the actual drag-and-drop pipeline columns show only that selected user's assigned customers.
5. Repeat as sub_branch_admin and team_leader; managed scope may include subordinate customers, while my-customer and member-specific scopes must not include outside-scope users.
6. Log in as member and confirm the pipeline is fixed to my-customer scope with no managed/member-specific toggle.
7. Confirm the my-customer and member-specific empty states appear and no stale managed cards remain after switching.
8. Drag a card after switching scope and confirm the saved status remains server-authorized and the scoped list invalidates.

## PR6 Operation Risk Center UAT Steps

This PR6 means the new roadmap "Operation Risk Center", not the older mobile quick-work PR6. It is also separate from PR5 `/analytics` sales funnel reports and PR19-4 notification preference work.

### Desktop
1. Open `/operation-risk` as branch_admin.
2. Verify the risk grade, risk score, data download, deletion/restore, account, handoff, push, and unresolved-work cards render.
3. Change the period filter:
   - today,
   - last 7 days,
   - last 30 days,
   - this month,
   - custom range.
4. Click each card action and confirm it routes to the expected operational page:
   - activity logs,
   - deleted data,
   - user management,
   - user handoff,
   - push operations,
   - notifications.
5. Confirm recent high-risk logs show operator-safe summaries, not raw JSON.
6. Confirm token values, phone numbers, customer memo bodies, illness details, product names, and premium details are not displayed.

### Mobile Web
1. Open `/operation-risk` in a narrow viewport.
2. Confirm risk cards stack vertically without horizontal scroll.
3. Confirm long action names, team/user labels, and empty states do not break the layout.
4. Confirm branch_admin can navigate from the mobile more menu to "운영 리스크 센터".

### Android APK
1. Open the Android internal build and navigate to `/operation-risk`.
2. Confirm WebView route access, card scrolling, and action buttons are stable.
3. Confirm no APK/AAB/JKS/keystore/google-services.json/local.properties files are included in the PR.

## P2-1 Analytics / Operation UX Polish UAT Steps
1. Open `/analytics` and confirm the current scope card clearly shows managed, mine, or member-specific scope.
2. Select member-specific scope and confirm the selected member name is visible and member ranking is hidden.
3. Confirm bottleneck diagnosis includes a concrete action sequence, not only a rate.
4. Open `/operation-risk` as branch_admin and confirm each risk card shows owner, deadline, next action, and a clear action CTA.
5. Confirm `/operation-risk` remains unavailable to sub_branch_admin, team_leader, member, inactive, and resigned users by direct URL and API.
6. In operation-risk logs, test period, category, target, action, search, riskOnly, and reset controls.
7. Open `/logs` and confirm period, user, category, risk, search, and reset controls are usable on mobile without horizontal page overflow.
8. Confirm DATA_DOWNLOAD entries show safe reason/summary text and do not expose raw tokens, full phone numbers, customer memo bodies, illness details, product names, or premium details.
9. Confirm `/logs` role scope is unchanged: branch_admin all, sub_branch_admin subordinate scope, team_leader team scope, member denied.
10. Confirm customer contact and birth date display policies are unchanged in customer work screens.

### Role Accounts
1. branch_admin: `/operation-risk` loads.
2. sub_branch_admin: direct URL/API access blocked.
3. team_leader: direct URL/API access blocked.
4. member: direct URL/API access blocked.
5. inactive/resigned: access blocked.

### Regression
1. `/analytics` remains sales funnel/performance only.
2. `/admin-audit` redirects to `/operation-risk?tab=logs` for branch_admin.
3. `/logs` still loads as the retained activity log screen with its existing permissions.
4. `/deleted-data`, `/users/handoff`, and `/push-notifications` still load.
5. No download/export feature is added by PR6.
6. No DB schema, activity log structure, DATA_DOWNLOAD policy, automatic account status, role, assignee, handoff, deletion, or push sending policy change occurs.

## Role Boundary UAT (Safety)
- branch_admin: full visibility in allowed pages.
- sub_branch_admin: only subordinate scope data appears.
- team_leader: only own team scope data appears.
- member: only own scope data appears.
- Verify no cross-scope data leaks through direct navigation.

## Korean Role/Status Display UAT
1. 사용자 관리, 조직 구조, 팀 관리, 인수인계 관리에서 역할이 지점장/부지점장/팀장/팀원으로 표시되는지 확인한다.
2. 사용자 관리와 조직 구조에서 계정 상태가 활성/비활성/퇴사자로 표시되는지 확인한다.
3. 고객 DB 담당자 선택, DB 배정, 세일즈 파이프라인 조직원 선택에서 `member`, `team_leader`, `branch_admin` 같은 내부 enum이 보이지 않는지 확인한다.
4. `/analytics`와 `/sales-pipeline` 범위 UI가 산하 전체/내 담당 고객/조직원별로 표시되는지 확인한다.
5. 활동 로그와 운영 리스크 센터의 대상 유형이 사용자/고객/계약/팀처럼 표시되고, raw target type이 주요 화면에 노출되지 않는지 확인한다.
6. 직접 API payload, DB enum, 권한 조건, activity log action code가 한글 값으로 바뀌지 않았는지 회귀 테스트로 확인한다.

## Activity Log Redaction UAT
1. `/logs`, `/admin-audit`, and `/operation-risk?tab=logs` show action, actor, target, reason, row count, and safe summaries without raw `details` JSON.
2. Activity log details do not expose raw token, device token, password, secret, API key, `DATABASE_URL`, authorization header, cookie, or session value.
3. Activity log details partially mask phone numbers, birth dates, resident-number-like patterns, and emails.
4. DATA_DOWNLOAD reason remains visible for audit context, but phone/token/secret patterns inside the reason are redacted.
5. Consultation body, customer memo, message template body, consultation script body, illness/product names, and premium detail text are summarized rather than shown in full.
6. Searching activity logs cannot reveal raw token/secret/phone strings that are hidden from display.
7. Customer DB, Customer Detail, follow-up, schedule, mobile customer card, and assigned-member customer views still show authorized customer phone/birth-date information for real work.
8. Run `pnpm.cmd activity-logs:redact` without `--write` in a safe environment and confirm it reports only counts, not log details.
9. Controlled write mode requires both `CONFIRM_REDACT_ACTIVITY_LOGS=1` and `--write`; without both safeguards the command must refuse to update rows.

## P2-2 Empty / Error / Forbidden State UAT
1. CustomerList with no data shows an empty state that explains whether filters are active and offers filter reset or customer registration when allowed.
2. CustomerDetail loading state does not show stale or partial customer data.
3. CustomerDetail forbidden/not-found state does not expose customer name, phone, birth date, or whether the protected customer exists.
4. CustomerDetail empty sections for consultations, contracts, handoff notes, history, and follow-ups show a next action when one is appropriate.
5. Analytics and OperationRisk error states show recovery guidance and do not render raw server error messages, stack traces, token values, or internal paths.
6. App route guards still show a permission state instead of redirect-only behavior.
7. member direct navigation to another customer's detail remains blocked by server RBAC and the UI does not reveal customer information.
8. inactive/resigned users remain blocked from authenticated screens and protected APIs.
9. Mobile viewport shows empty/error/permission states without horizontal scroll and with 44px+ CTA targets.

## P2-3 Playwright Smoke + Visual QA
1. Run `pnpm.cmd test:e2e:install` once per machine or CI cache miss, then run `pnpm.cmd test:e2e`.
2. The Playwright suite must use mocked tRPC fixtures only; do not use Google OAuth accounts, production DBs, or real customer data.
3. Smoke coverage must include Dashboard, CustomerList, CustomerDetail, Analytics, OperationRisk branch_admin access, and OperationRisk member forbidden access.
4. Mobile smoke must include Dashboard and MobileNav navigation to CustomerList with no horizontal overflow.
5. Visual QA is intentionally limited to Dashboard desktop, CustomerList desktop, and Dashboard mobile screenshots.
6. Screenshots must contain only `[E2E]` fake data or masked values.
7. If visual snapshots change, review the diff before updating baselines.
8. Server RBAC remains covered by unit/integration tests; Playwright role switching is a fixture-level UI smoke, not a replacement for server authorization tests.

## Android Route / Generated Files UAT
1. Android/WebView canonical routes are `/dashboard`, `/customers`, `/calendar`, `/notifications`, `/analytics`, and `/operation-risk`.
2. Operations/audit drawer key `ops` resolves to `/operation-risk?tab=logs`; `/admin-audit` remains a web redirect only, not the Android canonical target.
3. `/operation-risk` remains protected by branch_admin UI/server authorization and route cleanup does not widen access.
4. Run `pnpm.cmd exec cap sync android` and verify generated Android assets/config are not staged for commit.
5. Run `cd android && gradlew.bat assembleDebug` when the Android SDK/JDK is available.
6. `git ls-files` must not include `android/.gradle/**`, copied web assets under `android/app/src/main/assets/public/**`, generated Capacitor config/plugin JSON, APK/AAB/JKS/keystore files, `google-services.json`, or `local.properties`.

## Core Screen Error State UAT
1. Dashboard `dashboard.todayWork` failure shows ErrorState in today-work sections and does not display failed counts as `0`.
2. Dashboard priority-contact summary failure shows ErrorState and does not imply there are no recommended customers.
3. CustomerList `customers.list` loading, empty, and error states are visually distinct on desktop and mobile.
4. CustomerList query failure shows retry guidance and does not show "no customers" messaging.
5. ActivityLog `logs.list` loading, empty, and error states are visually distinct.
6. ActivityLog query failure shows retry guidance and does not show "no logs" messaging.
7. Error states do not render raw API errors, stack traces, tokens, secrets, or customer details.

## Mobile Customer Search UAT
1. Mobile CustomerList search input sends the search term to `customers.list` and refreshes results while typing.
2. Search results remain limited to the signed-in user's existing customer scope: branch_admin, sub_branch_admin, team_leader, and member.
3. member search does not reveal customers assigned to another member, team, sub-branch, or branch.
4. team_leader search does not reveal customers outside the leader's team scope.
5. Search result zero state uses EmptyState and API failure uses ErrorState.
6. Authorized customer phone and birth-date display policy remains unchanged in mobile customer cards and details.

## Phone Duplicate Scope UAT
1. branch_admin 고객 등록/일괄 등록 중복 확인은 전체 active 고객 기준으로 동작한다.
2. sub_branch_admin 중복 확인은 산하 고객 범위 안에서만 `duplicate=true`가 된다.
3. team_leader 중복 확인은 본인 팀/산하 고객 범위 안에서만 `duplicate=true`가 된다.
4. member 중복 확인은 본인 담당 고객 범위 안에서만 `duplicate=true`가 된다.
5. 권한 밖 고객과만 전화번호가 중복될 때 고객명, 담당자, 팀명, customerId 또는 권한 밖 존재 여부가 표시되지 않는다.
6. CustomerList, CustomerDetail, 후속관리, 일정, 모바일 고객 카드의 권한 있는 연락처 표시는 유지된다.
7. 전역 중복 정리는 branch_admin 전용 `중복 고객 관리` 화면에서 수행하고, sub_branch_admin/team_leader/member는 해당 화면/API에 접근할 수 없는지 확인한다.

## Team Leader DB Assignment UAT
1. team_leader로 `/customers/assign`에 접속했을 때 DB 배정 화면이 비어 있지 않고 표시되는지 확인한다.
2. 고객 선택 목록에는 team_leader 본인 팀 권한 범위의 고객만 표시되는지 확인한다.
3. 배정 대상 선택에는 active 상태의 본인 산하 팀원만 표시되고, 산하 밖 사용자/inactive/resigned 사용자는 표시되지 않는지 확인한다.
4. 본인 팀 고객을 산하 팀원에게 배정하면 고객 담당자가 해당 팀원으로 변경되는지 확인한다.
5. 배정 후 고객 목록 또는 고객 상세에서 새 담당자와 연락처가 정상 표시되는지 확인한다.
6. 산하 밖 고객 또는 산하 밖 사용자를 직접 API로 지정하면 서버에서 차단되는지 확인한다.
7. member는 `/customers/assign` 배정 UI와 배정 API를 사용할 수 없는지 확인한다.
8. branch_admin/sub_branch_admin의 기존 DB 배정 흐름이 동일하게 유지되는지 확인한다.
9. assignment_history와 activity_logs가 기존 정책대로 기록되는지 확인한다.

## Regression Checks
- Existing notification mutations still work:
  - markRead
  - markAllRead
  - updateProcessStatus
- Existing dashboard widgets render without crash.
- Existing mobile refresh flow still updates dashboard/notification providers.

## Pass/Fail Rule
- PASS: all core acceptance criteria + no critical or high issues.
- FAIL: any RBAC breach, stale read/process state, broken sorting rule, or crash.

## Notes Template
- Date:
- Tester:
- Role:
- Device:
- Network condition:
- Result:
- Issues:
- Repro steps:
