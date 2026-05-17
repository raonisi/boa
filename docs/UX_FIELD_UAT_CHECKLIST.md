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

## Core Acceptance Criteria
- Priority labels are consistent across web and mobile.
- Sorting order is consistent across web and mobile.
- Quick actions are reachable within two taps/clicks.
- Read/process actions reflect immediately after mutation.
- No role can access out-of-scope operational data.
- Consultation script edit/delete actions are branch_admin-only and refresh the list after mutation.
- Login, sidebar, and mobile branding show the BOA logo without checkerboard background or stretched proportions.

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


### Actual Sales Pipeline My Customer Scope Hotfix
1. Log in as branch_admin and open `/sales-pipeline`.
2. Switch between the managed-scope option and my-customer option; the actual drag-and-drop pipeline columns and customer counts must refetch and change.
3. Confirm my-customer scope includes only customers whose direct assignee is the current user and excludes subordinate users' customers.
4. Repeat as sub_branch_admin and team_leader; managed scope may include subordinate customers, while my-customer scope must not.
5. Log in as member and confirm the pipeline is fixed to my-customer scope with no managed-scope toggle.
6. Confirm the my-customer empty state appears and no stale managed cards remain after switching.
7. Drag a card after switching scope and confirm the saved status remains server-authorized and the scoped list invalidates.

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
4. Confirm branch_admin can navigate from the mobile more menu to "운영 리스크".

### Android APK
1. Open the Android internal build and navigate to `/operation-risk`.
2. Confirm WebView route access, card scrolling, and action buttons are stable.
3. Confirm no APK/AAB/JKS/keystore/google-services.json/local.properties files are included in the PR.

### Role Accounts
1. branch_admin: `/operation-risk` loads.
2. sub_branch_admin: direct URL/API access blocked.
3. team_leader: direct URL/API access blocked.
4. member: direct URL/API access blocked.
5. inactive/resigned: access blocked.

### Regression
1. `/analytics` remains sales funnel/performance only.
2. `/admin-audit`, `/logs`, `/deleted-data`, `/users/handoff`, and `/push-notifications` still load.
3. No download/export feature is added by PR6.
4. No automatic account status, role, assignee, handoff, deletion, or push sending policy change occurs.

## Role Boundary UAT (Safety)
- branch_admin: full visibility in allowed pages.
- sub_branch_admin: only subordinate scope data appears.
- team_leader: only own team scope data appears.
- member: only own scope data appears.
- Verify no cross-scope data leaks through direct navigation.

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
