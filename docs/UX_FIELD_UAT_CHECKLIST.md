# BOA CRM UI/UX Field UAT Checklist

## Scope
- Web dashboard + notification center
- Mobile home + mobile notification tab
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

## Web UAT Steps
1. Open dashboard and verify "field immediate queue" appears.
2. Toggle filter chips (all/urgent/today/general) and verify list updates.
3. Confirm unread items appear first inside same priority.
4. Execute "read" and "complete" actions and verify UI refresh.
5. Open notification center and verify:
   - priority cards count correctly,
   - filter + sort behavior matches dashboard,
   - unread badge changes after mark-read.

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
