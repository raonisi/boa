---
name: boa-crm-full-build
description: Use this skill for the BOA insurance-sales internal CRM: requirements audit, implementation planning, role-based authorization, customer DB assignment, bulk import, contracts, performance, schedules, notifications, user/org management, security checks, and final production-readiness review. Trigger when working on raonis/boa or raonisi/boa.
---

# BOA CRM Full Build Skill

## 0. Operating mode

You are working on an internal insurance-sales CRM for a Korean branch team.

Before any code edit:

1. Inspect the current code.
2. Confirm the actual repository name: `raonis/boa` or `raonisi/boa`.
3. Summarize current implementation.
4. List gaps against this skill.
5. Propose a prioritized plan.
6. Wait for explicit approval if the user asked for planning first.

Never rebuild the project from scratch. Preserve existing structure and make focused changes.

---

## 1. Product scope

The CRM must support:

- Customer DB management
- Team-member DB assignment
- Branch manager → deputy manager DB distribution
- Deputy manager → subordinate team leader/member DB assignment
- Customer consultation status management
- Consultation records
- Contract management
- Automatic performance aggregation from contracts
- Internal schedule/calendar management
- Notification center
- User management
- Organization/team management
- Settings/master data management
- Data download
- Customer DB bulk upload
- Role-based data isolation
- Operational audit logs
- PC and mobile usage

Initial scale: about 5 users.
Target scale: about 20 users.

---

## 2. Required role model

Use exactly this conceptual access model.

### `branch_admin`

Branch manager and final administrator.

Must be able to:

- View/create/update/deactivate all customers.
- Register, assign, reassign all DB.
- Distribute DB to `sub_branch_admin`.
- Directly assign DB to `team_leader` or `member`.
- View/create/update/deactivate all contracts.
- View all performance.
- View/create/update/complete/cancel all schedules.
- View/process all notifications.
- View all logs.
- Create users.
- Deactivate/resign users.
- Assign deputy managers, team leaders, and members.
- Create/update/deactivate teams.
- Download data.
- Bulk upload customer DB.
- Manage Settings/master data.

### `sub_branch_admin`

Deputy branch manager.

May only access:

- DB distributed to them by `branch_admin`.
- Customers, contracts, consultations, performance, and notifications for subordinate users.
- Organization-wide active-user schedule visibility, with direct mutation limited to own schedules.
- DB assignment from their assigned pool to their subordinate team leaders/members.

Must not:

- Access another deputy manager’s data.
- Create users.
- Move organization members.
- Create/update teams.
- Download branch-wide data.
- Bulk upload DB.
- Access Settings.

### `team_leader`

Team leader.

May only access:

- Own team’s customers, contracts, consultations, performance, notifications.
- Organization-wide active-user schedule visibility, with direct mutation limited to own schedules.
- Contract input for own/team-member customers when allowed by existing policy.

Must not:

- Access other teams.
- Assign DB.
- Create users.
- Move org members.
- Download data.
- Bulk upload DB.
- Access Settings.

### `member`

Team member.

May only access:

- Own assigned customers.
- Own customer consultation records.
- Own customer contract input.
- Organization-wide active-user schedule visibility.
- Create, update, complete, cancel, and delete own schedules only.
- Own performance.
- Own notifications.

Must not:

- Access other members’ data.
- Assign DB.
- Create users.
- Move org members.
- Download data.
- Bulk upload DB.

### `inactive` / `resigned`

These are account states, not normal working roles.

- Login must be blocked.
- Protected API access must be blocked.
- Direct URL/API attempts must fail.

---

## 3. Security and privacy hard rules

Do not add or allow:

- Korean resident registration number fields.
- Insurance policy/certificate number fields.
- ID-card upload.
- Detailed illness/medical history fields.
- Bank account number upload/import.
- Card number upload/import.
- Plaintext password storage.
- Service role keys or secrets in frontend code.
- Real `.env` in git.
- Hard delete of customers, contracts, consultations, schedules, or logs.

Required:

- Use server-side authorization in tRPC/routers/helpers.
- Do not rely only on front-end menu hiding.
- Direct ID access outside authorized scope must return `FORBIDDEN` or `BAD_REQUEST`.
- Use soft delete such as `isActive=false` or `deletedAt`.
- Log important create/update/assignment/deactivation/download/import actions.

---

## 4. Core database concepts to verify

Confirm actual names in `drizzle/schema.ts` before editing.

Expected concepts:

- `users.role`
- `users.accountStatus`
- `users.openId`
- `users.email`
- `users.teamId`
- `users.subBranchAdminId`
- `users.phone`
- `users.memo`
- `teams.subBranchAdminId`
- `customers.agentId` or equivalent assigned agent field
- `customers.teamId`
- `customers.subBranchAdminId`
- `customers.assignmentStatus`
- `customers.isActive` / `deletedAt`
- `contracts.agentId`
- `notifications.userId`
- logs/audit table
- assignment history table

Expected `assignmentStatus` values:

- `unassigned`
- `assigned_to_sub_branch`
- `assigned_to_agent`

If the actual code uses different names, map them explicitly and do not invent new names without need.

---

## 5. User management requirements

Must support:

- `UserManagement` page.
- `branch_admin` only access.
- Add new user.
- Input name, email, role, accountStatus, phone, memo.
- Assign sub-branch manager and team where relevant.
- Update user.
- Deactivate/resign user.
- Change role.
- Change team.
- Change subBranchAdminId.
- Show login/onboarding state: invited/pending login/linked/active, as implemented.
- Show active/inactive/resigned state.

OAuth pre-registration:

- A user may be pre-created in `users`.
- On first OAuth login, match normalized email and link `openId`.
- Match only when exactly one active pre-registered user exists.
- Never overwrite an existing `openId`.
- Block inactive/resigned users.
- Prevent duplicate email creation.
- Normalize email with `trim().toLowerCase()` in create, lookup, OAuth mapping.

Required logs:

- `USER_CREATED`
- `USER_LOGIN`
- `LOGIN_BLOCKED`
- `USER_OAUTH_LINKED`
- `USER_OAUTH_LINK_CONFLICT`
- `USER_ROLE_CHANGED`
- `USER_DEACTIVATED` or documented equivalent

---

## 6. Organization and TeamManagement requirements

Must support:

- `TeamManagement` page.
- `branch_admin` only access.
- Deputy manager → team → team leader → members hierarchy.
- Unassigned team leaders/members section.
- Create team.
- Edit team name/description.
- Deactivate team.
- Assign/change team leader.
- Assign/move team members.
- Move team leaders/members under another deputy manager.
- Team/member movement logs.

Data consistency:

- If a user has `teamId`, user’s `subBranchAdminId` must match the team’s `subBranchAdminId`.
- When a team’s `subBranchAdminId` changes, team users must sync or the operation must be blocked.
- Server must prevent inconsistent direct API writes.

Required logs:

- `TEAM_CREATED`
- `TEAM_UPDATED`
- `TEAM_DEACTIVATED`
- `TEAM_LEADER_ASSIGNED`
- `MEMBER_ASSIGNED_TO_TEAM`
- `USER_MOVED_TO_ANOTHER_TEAM`
- `USER_MOVED_TO_ANOTHER_SUB_BRANCH`
- `USER_ROLE_CHANGED`

---

## 7. Customer management requirements

Customer fields:

- Name
- Phone
- Birth date
- Gender
- Region
- Expected premium
- Available call time
- Lead source
- Consultation status
- Memo
- Assigned agent
- Sub-branch manager
- Team
- Assignment status
- Active/deleted status

Must not include:

- Resident registration number
- Policy/certificate number
- ID-card upload
- Detailed illness/medical history field

Consultation statuses:

- 미상담
- 부재
- 통화완료
- 상담예정
- 설계중
- 계약
- 보류
- 거절
- 해지관리

Must support:

- Single customer create.
- Customer update.
- Customer deactivate.
- Customer detail view.
- Customer list/search/filter.
- Region/source/agent/assignment-date/status filters.
- Consultation status update.
- Consultation record create/update.
- Next consultation date.
- Assignment history tab.
- Change assigned agent.
- Phone duplicate check with normalization.

Phone normalization:
Treat these as same:

- `010-1234-5678`
- `01012345678`
- `010 1234 5678`

Required logs:

- `CUSTOMER_CREATED`
- `CUSTOMER_UPDATED`
- `CUSTOMER_REASSIGNED`
- `CUSTOMER_TRANSFERRED`
- `CUSTOMER_DEACTIVATED`
- `ASSIGNMENT_HISTORY_CREATED`

---

## 8. DB assignment requirements

### Branch admin

- Register all DB.
- View all DB.
- Assign/reassign all DB.
- Distribute unassigned DB to deputy managers.
- Assign directly to team leaders/members.
- View all assignment history.

### Deputy manager

- View only DB distributed to them.
- Assign only their distributed DB to subordinate team leaders/members.
- Cannot assign to another deputy’s organization.

### Team leader/member

- No DB assignment.
- DB assignment screen/API blocked.

Server checks:

- `customers.assign`
- `customers.assignToSubBranch`
- `customers.changeAgent`

Validate target user:

- `accountStatus='active'`
- Valid role
- Organization scope
- team/subBranch consistency

Required logs:

- `DB_ASSIGNED_TO_SUB_BRANCH_ADMIN`
- `DB_ASSIGNED_BY_BRANCH_ADMIN`
- `DB_ASSIGNED_BY_SUB_BRANCH_ADMIN`
- `CUSTOMER_REASSIGNED`
- `CUSTOMER_TRANSFERRED`
- `ASSIGNMENT_HISTORY_CREATED`

---

## 9. Customer DB bulk import requirements

Feature display name:

- `DB 일괄 등록` or `고객 DB 일괄 업로드`

Access:

- `branch_admin` only.
- Other roles and inactive/resigned users must be blocked at UI and server router level.

Expected routes:

- `customers.previewImport`
- `customers.bulkImport`
- `customers.downloadImportTemplate`

Workflow:

1. Select file.
2. Parse file.
3. Preview.
4. Validate columns.
5. Validate rows.
6. Check duplicate phones.
7. Confirm final registration.
8. Save to DB.
9. Write import logs.

Never save on file selection alone.

Supported:

- CSV required.
- XLSX optional. If XLSX exists, define first-sheet/s formula/hidden-sheet/merged-cell policy.

Required Korean headers:

- 이름
- 연락처
- 생년월일
- 성별
- 지역
- 예상보험료
- 통화가능시간
- 유입경로
- 상담상태
- 메모
- 부지점장
- 팀
- 담당자

Required columns:

- 이름
- 연락처
- 생년월일
- 성별
- 지역
- 예상보험료
- 통화가능시간
- 유입경로

Optional columns:

- 상담상태
- 메모
- 부지점장
- 팀
- 담당자

Forbidden columns:

- 주민등록번호
- 주민번호
- 증권번호
- 신분증
- 병력상세
- 계좌번호
- 카드번호

Server revalidation is mandatory:

- Do not trust preview results.
- Re-check forbidden columns.
- Re-check row validity.
- Re-check phone duplicates.
- Re-check organization mapping.
- Re-check target active status.
- Recompute assignmentStatus.

Phone duplicate check:

- Normalize phone before comparing file internal duplicates and DB duplicates.

Assignment rules:

- No assignee/deputy: `assignmentStatus='unassigned'`.
- Deputy only: `assigned_to_sub_branch`, `subBranchAdminId` set, `agentId=null`.
- Agent assigned: `assigned_to_agent`, `agentId` set, organization derived/validated from agent.

Name mapping:

- If deputy/team/agent name maps to multiple records, row error.
- If team names can duplicate, use deputy+team combination.
- Agent must be active and role `team_leader` or `member`.
- Deputy must be active and role `sub_branch_admin`.

Batch tracking:

- Generate `importBatchId` or `batchKey`.
- Include it in import logs.
- Prefer including it in customer creation logs.

Required logs:

- `CUSTOMER_BULK_IMPORT_PREVIEWED`
- `CUSTOMER_BULK_IMPORTED`
- `CUSTOMER_BULK_IMPORT_FAILED`
- `DATA_IMPORT`
- Prefer per-customer `CUSTOMER_CREATED`.

---

## 10. Contract management requirements

Contract fields:

- Customer
- Assigned agent
- Insurance company
- Product name
- Product group
- Contract date
- Monthly premium
- Payment status
- Contract status
- Memo

Must not include:

- Policy/certificate number field.

Permissions:

- `branch_admin`: all contracts.
- `sub_branch_admin`: subordinate contracts.
- `team_leader`: own team contracts.
- `member`: own customer contracts.

Must support:

- Contract input in customer detail.
- Contract input in contract management.
- Assigned agent selection according to role.
- Contract owner change.
- Contract deactivate.
- Contract history.
- Contract-history access authorization.

Required logs:

- `CONTRACT_CREATED`
- `CONTRACT_UPDATED`
- `CONTRACT_OWNER_CHANGED`
- `CONTRACT_DEACTIVATED`

---

## 11. Performance requirements

Automatic aggregation from contracts only.

Do not implement:

- Manual performance entry.
- Converted performance.
- Commission calculation.

Must aggregate:

- Contract count
- Monthly premium sum
- Active contract count
- Cancelled/lapsed count
- Consultation rate
- Contract rate

Filters:

- Period
- Month
- Team
- Team member
- Product group
- Insurance company
- Region
- Lead source

Permissions:

- `branch_admin`: all
- `sub_branch_admin`: subordinate organization
- `team_leader`: own team
- `member`: own performance

Critical:

- `performance.agentStats` must verify agentId is in current user’s authorized scope.

---

## 12. Schedule/calendar requirements

Must support:

- Self schedule registration for every active role.
- `branch_admin` schedule registration for any active user.
- Internal calendar.
- No customer link required.
- Internal notifications.
- Completion/cancel/no-show.
- Incomplete schedule notification.
- Mobile-friendly schedule view.

Visibility:

- Every active role may view schedules owned by all active users in the organization.
- Schedule visibility does not grant mutation permission.

Mutation permissions:

- `branch_admin`: create for any active user and update/delete every schedule.
- `sub_branch_admin`, `team_leader`, `member`: create/update/delete schedules only when `schedules.userId` equals the actor id.
- `schedules.userId` is the ownership field. `createdBy` is audit metadata only.
- One BOA CRM production database and Railway environment serves one independent organization.

Critical:

- `schedules.create targetUserId` allows another user only for `branch_admin`.
- Update/delete must require `branch_admin` or `schedules.userId === actor.id`.
- Cannot schedule for inactive/resigned users.
- Out-of-scope targetUserId returns `FORBIDDEN`.

---

## 13. Notification center requirements

Notification types include:

- Customer birthday
- 90 days after contract start: diagnosis benefit effective notification
- 1 year after contract start: 100% benefit availability notification
- 90-day long-unmanaged customer
- Incomplete schedule
- Contract-related notifications
- Customer-management notifications

Process statuses:

- 미확인
- 확인
- 처리완료
- 보류

Permissions:

- `branch_admin`: all notifications.
- `sub_branch_admin`: self + subordinate users.
- `team_leader`: self + own team.
- `member`: self only.
- inactive/resigned: blocked.

Server filters:

- processStatus
- isRead/readStatus
- notification type
- period/date
- limit
- offset/cursor
- totalCount/hasMore

Critical mutations:

- `notifications.markRead`
- `notifications.updateProcessStatus`
- `markAllRead`

These must verify ownership/organization scope server-side.
Out-of-scope notification IDs must fail.

---

## 14. Data download requirements

`branch_admin` only.

Download categories:

- Customer DB
- Contract information
- Performance information
- Schedule information

Required:

- Download screen.
- API protected from other roles.
- Data privacy warning.
- `DATA_DOWNLOAD` log with download type.

---

## 15. Settings/master data requirements

`branch_admin` only.

Manage:

- Product groups
- Insurance companies
- Lead sources
- Regions
- Consultation statuses
- Schedule types
- Payment statuses
- Contract statuses

Must support:

- Create
- Update
- Deactivate
- No hard delete
- `isActive=false`

Check whether Settings are actually wired into:

- Customer create/edit forms
- Contract create/edit forms
- Schedule forms
- Consultation status selectors

---

## 16. Audit log requirements

Verify these logs or documented equivalents:

- USER_LOGIN
- LOGIN_BLOCKED
- USER_CREATED
- USER_OAUTH_LINKED
- USER_OAUTH_LINK_CONFLICT
- USER_ROLE_CHANGED
- USER_DEACTIVATED
- CUSTOMER_CREATED
- CUSTOMER_UPDATED
- CUSTOMER_REASSIGNED
- CUSTOMER_TRANSFERRED
- CUSTOMER_DEACTIVATED
- DB_ASSIGNED_TO_SUB_BRANCH_ADMIN
- DB_ASSIGNED_BY_BRANCH_ADMIN
- DB_ASSIGNED_BY_SUB_BRANCH_ADMIN
- ASSIGNMENT_HISTORY_CREATED
- CUSTOMER_BULK_IMPORT_PREVIEWED
- CUSTOMER_BULK_IMPORTED
- CUSTOMER_BULK_IMPORT_FAILED
- DATA_IMPORT
- DATA_DOWNLOAD
- CONSULTATION_UPDATED
- CONTRACT_CREATED
- CONTRACT_UPDATED
- CONTRACT_OWNER_CHANGED
- CONTRACT_DEACTIVATED
- TEAM_CREATED
- TEAM_UPDATED
- TEAM_DEACTIVATED
- TEAM_LEADER_ASSIGNED
- MEMBER_ASSIGNED_TO_TEAM
- USER_MOVED_TO_ANOTHER_TEAM
- USER_MOVED_TO_ANOTHER_SUB_BRANCH

For each log, check:

- actor
- target id
- beforeValue where relevant
- afterValue where relevant
- createdAt

---

## 17. Testing requirements

After edits, prefer running:

- `pnpm install`
- `pnpm build`
- `pnpm test`
- type checks or lint if scripts exist

If not runnable, explain why and perform static checks.

Test scenarios:

1. Branch admin creates user.
2. Active invited user performs first OAuth login.
3. Inactive user login blocked.
4. Branch admin bulk imports valid CSV.
5. Forbidden column CSV is blocked.
6. Duplicate phone CSV is blocked.
7. Deputy manager cannot bulk import.
8. Team leader/member cannot bulk import.
9. Deputy A cannot access deputy B data.
10. Team leader A cannot access team B data.
11. Member A cannot access member B data.
12. Notification mutation scope is enforced.
13. Schedule targetUserId scope is enforced.
14. Contract history scope is enforced.
15. Performance agentId scope is enforced.

---

## 18. Required output format when auditing

Return:

1. Repository confirmation
2. Overall implementation percentage
3. Production readiness judgment
4. Critical issues
5. High-priority issues
6. Medium-priority issues
7. Role authorization table
8. Feature implementation table
9. Bulk import audit table
10. Notification audit table
11. User/OAuth audit table
12. Security/privacy audit table
13. Logs audit table
14. Test/build result
15. Recommended fix order
16. Files to change
17. Routers to change
18. DB schema changes needed or not
19. Next Codex prompt draft

Use:

- 완료
- 일부 완료
- 누락
- 확인 불가

Do not guess.
