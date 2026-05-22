# BOA CRM CodeGraph 기반 RBAC 2차 정밀 분석

이 문서는 `C:\work\boa-main`의 CodeGraph 인덱스를 기준으로 작성한 BOA CRM RBAC 운영용 2차 분석 문서다. 목적은 권한, 고객 접근, 배정, 일정, 후속관리, 알림, export/delete, 모바일 API 변경 전에 반드시 확인해야 할 구조와 위험 지점을 빠르게 찾는 것이다.

## 1. 최종 요약

- BOA CRM의 RBAC 핵심은 `server/_core/procedures.ts`의 procedure guard, `server/routers.ts`의 도메인별 scope helper, `server/db.ts`의 scoped query, 그리고 클라이언트의 UX용 guard가 분리된 구조다.
- 가장 중요한 permission gate는 `protectedProcedure`, `activeUserProcedure`, `branchAdminProcedure`, `teamLeaderOrAboveProcedure`, `subBranchAdminOrAboveProcedure`, `customerBulkImportProcedure`, `verifyCustomerAccess`, `verifyTargetUserAccess`, `getHierarchyScopeUserIds`, `getAccessibleSchedules`, `verifyFollowUpAccess`, `verifyNotificationAccess`다.
- 최고위험 수정 구역은 auth/session core, server procedure guards, `verifyCustomerAccess`, 고객 배정/인수인계, export/download/permanent delete, DB schema/migration, push token/log privacy다.
- 이 RBAC 맵은 future Codex 작업의 시작점으로 충분하다. 단, 실제 구현 전에는 해당 도메인의 router/query/test를 다시 좁혀 확인해야 한다.

## 2. CodeGraph 사용 결과

- CodeGraph status: 정상, index up to date.
- Indexed files: `238`.
- Nodes: `3,361`.
- Edges: `6,817`.
- DB size: `7.57 MB`.
- Tools used: `codegraph_context`, `codegraph_explore`, `codegraph_impact`, plus CLI `codegraph status`.
- Symbols inspected:
  - `verifyCustomerAccess`
  - `verifyTargetUserAccess`
  - `verifyFollowUpAccess`
  - `verifyNotificationAccess`
  - `getHierarchyScopeUserIds`
  - `getAccessibleSchedules`
  - `getFollowUpScope`
  - `activeUserProcedure`
  - `protectedProcedure`
  - `branchAdminProcedure`
  - `teamLeaderOrAboveProcedure`
  - `subBranchAdminOrAboveProcedure`
  - `hasCustomerBulkImportAccess`
  - `sendPushToUsers`
- Impact/caller/callee summary:
  - `verifyCustomerAccess` affects `verifyCustomerDeleteAccess`, `verifyContractDeleteAccess`, `verifyContractDeleteRequestAccess`, `verifyFollowUpAccess`.
  - `getHierarchyScopeUserIds` affects performance scope, phone duplicate scope, schedule scope, dashboard data, follow-up scope, sales/work rhythm reports.
  - `getAccessibleSchedules` affects dashboard, operation-risk summary, sales report, recommendation items, work rhythm report.
  - `sendPushToUsers` affects notification bridge, contract delete request push, schedule push engine, business push engine, and combined push reminder engines.
- Native read/grep was still needed:
  - To confirm exact tRPC router property names in `server/routers.ts`.
  - To list exact mobile REST paths in `server/mobileRoutes.ts`.
  - To identify existing test candidates by filename.

## 3. 역할별 권한 구조

| Role | Intended authority | Main allowed areas | Main restricted areas | Verification needed |
| --- | --- | --- | --- | --- |
| `branch_admin` | 지점 최종 관리자 | 전체 고객/계약/사용자/팀/다운로드/삭제/푸시 운영 | destructive action은 확인/감사/사유 필요 | admin-only APIs, export/delete, push ops, audit logs |
| `sub_branch_admin` | 산하 조직/DB 범위 관리자 | 산하 고객, 산하 사용자, 배정/관리 범위 | 타 부지점/타 팀/무관 사용자 데이터 | subordinate scope, customer assignment, aggregate filters |
| `team_leader` | 자기 팀 범위 리더 | 팀 고객, 팀원 업무, 팀 집계 | 타 팀, 부지점 전체, 지점 전체 관리 | team scope, `teamId`, descendant user ids |
| `member` | 본인 업무 사용자 | 본인 고객, 본인 일정/후속관리/알림 | 타 사용자 고객/계약/일정/알림 | owned customer vs unowned customer negative tests |

## 4. 서버 RBAC 진입점

| Guard / Procedure | File | Purpose | Risk if changed | Required tests |
| --- | --- | --- | --- | --- |
| `protectedProcedure` | `server/_core/trpc.ts` | 로그인된 tRPC 사용자 경계 | 전체 API 인증 우회 | unauthenticated negative tests |
| `activeUserProcedure` | `server/_core/procedures.ts` | `accountStatus=active` 사용자만 허용 | inactive/resigned 접근 허용 | active vs inactive/resigned tests |
| `branchAdminProcedure` | `server/_core/procedures.ts` | 지점장 전용 mutation/query | admin-only 작업 노출 | member/team/sub-branch forbidden tests |
| `subBranchAdminOrAboveProcedure` | `server/_core/procedures.ts` | branch/sub-branch 이상 | 팀/멤버가 상위 관리 기능 접근 | role matrix tests |
| `teamLeaderOrAboveProcedure` | `server/_core/procedures.ts` | branch/sub-branch/team leader 이상 | member가 관리/집계 접근 | member negative tests |
| `customerBulkImportProcedure` | `server/_core/procedures.ts`, `shared/permissions.ts` | 고객 일괄 등록 권한 | 대량 고객정보 import 노출 | permission flag positive/negative tests |
| `managerAnalyticsProcedure` | `server/_core/procedures.ts` | 관리자/팀장 분석 API | member analytics leakage | aggregate scope tests |
| `createContext` | `server/_core/context.ts` | tRPC request user 전달 | 잘못된 user context로 권한 오판 | session/auth integration tests |

## 5. 고객 접근권한 맵

| Flow | Roles involved | Key files | Access rule | Risk | Required verification |
| --- | --- | --- | --- | --- | --- |
| Customer list | all active roles | `server/routers.ts`, `server/db.ts`, `client/src/pages/CustomerList.tsx` | role별 filter/scope 적용 | 타 조직 고객 목록 노출 | role-scoped list tests |
| Customer detail | all active roles | `server/routers.ts`, `server/db.ts`, `client/src/pages/CustomerDetail.tsx` | `verifyCustomerAccess` | 직접 URL/API로 타 고객 접근 | owned/unowned customer tests |
| Customer create | active roles with route rules | `server/routers.ts` | 생성자/assignee 정책 적용 | 잘못된 owner/sub-branch/team 지정 | create with agent/sub-branch variations |
| Customer update | scoped active roles | `server/routers.ts` | 기존 고객 접근권한 필요 | 무관 고객 수정 | update forbidden tests |
| Customer deactivate | branch/sub-branch paths | `server/routers.ts` | delete access and active contract blockers | 부적절한 soft delete | role and blocker tests |
| Assignment/reassignment | branch_admin, sub_branch_admin, team_leader | `server/routers.ts` | `assertCanAssignCustomerToUser`, target user scope | 잘못된 담당자/팀 배정 | assignment history and target scope tests |
| Reclaim | manager roles | `server/routers.ts` | reclaimable state and reason required | 고객 회수 권한 오남용 | reason, scope, batch limits |
| Merge/import | branch_admin or bulk-import permission | `server/routers.ts`, `shared/permissions.ts` | admin/permissioned bulk flow | 대량 고객정보 노출/변형 | import permission, merge preview/execute tests |

## 6. 조직 계층 범위 맵

| Scope type | Who can see | Who cannot see | Key function/file | Risk |
| --- | --- | --- | --- | --- |
| Branch scope | `branch_admin` | lower roles | `branchAdminProcedure`, `verifyTargetUserAccess` | 전체 데이터가 하위 role에 열림 |
| Sub-branch scope | `sub_branch_admin`, branch_admin | unrelated sub-branch/team/member | `getHierarchyScopeUserIds`, `ensureOrgUsers`, `descendantUserIdsFrom` | 산하 범위 계산 오류 |
| Team scope | `team_leader`, upper roles | other teams | `getHierarchyScopeUserIds`, `verifyTeamFilterAccess` | 팀 aggregate/customer leakage |
| Member scope | own user only | all other users by default | `verifyCustomerAccess`, `getFollowUpScope`, `getAccessibleSchedules` | direct API unowned access |
| Bulk import permission scope | branch_admin or permissioned lower role | users without explicit permission | `hasCustomerBulkImportAccess`, `customerBulkImportProcedure` | 고객 대량 등록 권한 과다 부여 |

## 7. 계약·상담·후속관리 RBAC 맵

| Domain | RBAC dependency | Key files | Risk | Required tests |
| --- | --- | --- | --- | --- |
| Contract list by customer | `verifyCustomerAccess` through customer scope | `server/routers.ts`, `server/db.ts`, `client/src/pages/ContractList.tsx` | 타 고객 계약 노출 | listByCustomer positive/negative |
| Contract create/update | customer scope and target agent rules | `server/routers.ts`, `server/db.ts` | 계약 담당자/고객 mismatch | create/update role tests |
| Contract delete request | non-branch active users with customer access | `server/routers.ts`, `server/pushNotifications.ts` | 무관 계약 삭제 요청 | request forbidden tests |
| Contract admin delete/approval | `branchAdminProcedure` | `server/routers.ts` | P0 destructive action | branch_admin-only and audit tests |
| Consultation list/create/update | customer access | `server/routers.ts`, `server/db.ts`, `client/src/pages/CustomerDetail.tsx` | 상담 내용 노출 | unowned customer negative tests |
| Follow-up list/today/overdue | `getFollowUpScope` | `server/routers.ts`, `server/db.ts` | 다른 담당자 업무 노출 | scope/date/status tests |
| Follow-up complete/postpone/cancel | `verifyFollowUpAccess` -> `verifyCustomerAccess` | `server/routers.ts`, `server/mobileRoutes.ts` | 타 사용자 업무 처리 | direct API forbidden tests |

## 8. 일정·알림·푸시 RBAC 맵

| Flow | RBAC gate | Data touched | Risk | Verification needed |
| --- | --- | --- | --- | --- |
| `schedules.list` | `activeUserProcedure`, `getAccessibleSchedules` | schedule title/time/customerId | 타 사용자 일정 노출 | branch/sub/team/member list tests |
| `schedules.create` | active user plus target user validation | schedule owner/team/customer context | 다른 사용자에게 일정 생성 | targetUserId and inactive target tests |
| `schedules.update/delete` | active user plus schedule scope | status/completedAt/deletedAt | 타 사용자 일정 변경 | update/delete forbidden tests |
| `notifications.list` | active user and scoped filters | notification title/message/relatedId | 하위/무관 알림 노출 | list filters per role |
| `notifications.markRead/updateProcessStatus` | `verifyNotificationAccess` | notification read/process status | 무관 알림 상태 변경 | direct API forbidden tests |
| Push preferences | `activeUserProcedure` | preference/quiet hours | 다른 사용자 preference 변경 | self-only tests |
| Push logs/operations | branch_admin for operation/test engines | push log metadata/status | token/log exposure or mass push | branch_admin-only, payload privacy |
| `sendPushToUsers` | internal function, active token/preference/quiet/dedupe | FCM tokens, push logs | customer data/token leakage | no raw token/customer data assertions |

## 9. 관리자 고위험 작업 맵

| Admin action | Required role | Key files | P-level | Stop condition |
| --- | --- | --- | --- | --- |
| User management | `branch_admin` | `server/routers.ts`, `client/src/pages/UserManagement.tsx` | P0 | role/status/session invalidation uncertainty |
| User handoff | `branch_admin` | `server/db.ts`, `server/routers.ts`, `client/src/pages/UserHandoffManagement.tsx` | P0 | active customer/work transfer ambiguity |
| Customer merge | `branch_admin` | `server/db.ts`, `server/routers.ts`, `client/src/pages/CustomerMergeManagement.tsx` | P0 | duplicate merge preview/rollback unknown |
| Deleted data restore | `branch_admin` | `server/routers.ts`, `client/src/pages/DeletedDataManagement.tsx` | P1 | restore scope or audit missing |
| Permanent delete | `branch_admin` | `server/routers.ts`, `server/db.ts` | P0 | production delete without explicit approval |
| Operation risk center | manager roles | `server/routers.ts`, `client/src/pages/OperationRiskCenter.tsx` | P1 | aggregate/log scope unclear |
| Download/export | `branch_admin` | `server/routers.ts`, `client/src/pages/Download.tsx` | P0 | customer data export without audit/approval |
| Import batches | `branch_admin` / bulk permission | `server/routers.ts`, `client/src/pages/CustomerBulkImport.tsx` | P1 | production CSV/customer data risk |
| Push operations | `branch_admin` | `server/routers.ts`, `server/pushNotifications.ts` | P1 | mass push or token/privacy issue |

## 10. 모바일 API RBAC 맵

| Mobile flow | Server route/file | Auth/RBAC check | Risk | Verification needed |
| --- | --- | --- | --- | --- |
| Mobile Google login | `/api/mobile/auth/google`, `server/mobileRoutes.ts` | Google token audience + login flow | wrong user/session | OAuth env/live login tests |
| Mobile web session bridge | `/api/mobile/web-session` | bearer session + active account | inactive/resigned web session | inactive negative test |
| Device token register | `/api/mobile/device-tokens/register` | authenticated active user | token tied to wrong user | active user and token hash/log tests |
| Mobile customers | `/api/mobile/customers`, `/customers/:id` | tRPC caller with user context | customer leakage | role-scoped mobile tests |
| Mobile customer contracts/follow-ups | `/customers/:id/contracts`, `/follow-ups` | tRPC domain routers | related data leakage | unowned customer negative |
| Mobile schedules | `/api/mobile/schedules` | tRPC schedules router | schedule scope bypass | list/create/complete tests |
| Mobile follow-ups | `/api/mobile/follow-ups/*` | tRPC followUps router | complete/postpone/cancel unowned work | direct route negative tests |
| Mobile notifications | `/api/mobile/notifications*` | tRPC notifications router | unrelated notification read | list/read/read-all tests |
| Mobile dashboard/performance | `/dashboard/today-work`, `/performance/stats`, `/performance-goals/dashboard` | tRPC scoped dashboard/performance | aggregate leakage | branch/team/member fixtures |
| Mobile push preferences | `/api/mobile/push-preferences` | tRPC push preference router | other-user preference mutation | self-only tests |

## 11. 클라이언트 가드와 서버 권한의 차이

- `client/src/App.tsx`의 `AuthGuard`, `AdminGuard`, `BulkImportGuard`, `ManagerGuard`, `SubBranchAdminOrAboveGuard`는 UX 편의와 화면 진입 제어다.
- `client/src/components/DashboardLayout.tsx`와 `client/src/components/MobileNav.tsx`의 role-based nav hiding은 메뉴 표시 제어일 뿐 보안 경계가 아니다.
- 실제 보안 경계는 `server/_core/procedures.ts`, `server/routers.ts`, `server/mobileRoutes.ts`, `server/db.ts`의 서버 권한/스코프 검증이다.
- UI guard를 바꿀 때 반드시 확인할 것:
  - 같은 route의 tRPC procedure가 동일하거나 더 강한 서버 권한을 갖는지.
  - 숨긴 메뉴를 직접 URL/API로 호출해도 `FORBIDDEN`, `UNAUTHORIZED`, `BAD_REQUEST`가 나오는지.
  - mobile route가 web route와 같은 server caller/scope를 쓰는지.
  - client-only 조건 추가가 server authorization 대체로 오해되지 않는지.

Key files:
- `client/src/App.tsx`
- `client/src/components/DashboardLayout.tsx`
- `client/src/components/MobileNav.tsx`
- `server/_core/procedures.ts`
- `server/routers.ts`

## 12. P0/P1/P2/P3 위험 구역

P0:
- auth/session core
- server procedure guards
- `verifyCustomerAccess`
- customer assignment ownership
- DB schema/migration affecting ownership/scope
- export/download/permanent delete
- push token/log payload privacy

P1:
- `server/routers.ts` RBAC domain routers
- `server/db.ts` scoped queries
- schedules/follow-ups/notifications scope
- mobile REST RBAC
- dashboard/performance aggregates

P2:
- role-based UI visibility
- admin UI actions
- customer/contract/consultation UI forms
- mobile screens/providers

P3:
- docs
- copy
- isolated layout polish
- non-sensitive UI-only changes

## 13. 테스트 전략

| Area | Required positive tests | Required negative tests | Existing test candidates | Missing tests |
| --- | --- | --- | --- | --- |
| Auth active gate | active user can access protected API | inactive/resigned blocked | `server/auth.logout.test.ts`, `server/rbac-seed.test.ts` | full inactive matrix per domain |
| Procedure guards | branch/sub/team/member allowed paths | lower role forbidden paths | `server/rbac-seed.test.ts`, `server/analytics-rbac.test.ts` | guard-specific direct tests |
| Customer access | owned/scoped customer list/detail | unowned/other team/other sub-branch denied | `server/crm.test.ts`, `server/rbac-seed.test.ts` | direct API negative per route |
| Assignment | allowed manager assigns valid target | unrelated target or inactive target rejected | `server/crm.test.ts` | subordinate/team edge cases |
| Contract | scoped list/create/update works | unowned contract/customer denied | `server/crm.test.ts`, `client/src/pages/ContractList.test.tsx` | delete request role matrix |
| Consultation | scoped customer consultation works | unowned customer consultation denied | `server/crm.test.ts` | consultation tools permissions |
| Follow-up | today/overdue/complete own scope | unowned follow-up action denied | `server/mobileRoutes.test.ts`, `server/crm.test.ts` | full status transition matrix |
| Schedule | scoped list/create/update works | unowned schedule mutation denied | `server/mobileRoutes.test.ts`, `server/crm.test.ts` | completed/cancelled/no-show edge cases |
| Notification | own/subordinate allowed by role | unrelated notification denied | `server/crm.test.ts`, notification tests | markRead/processStatus role matrix |
| Push | branch_admin test/ops and self preferences | lower role push ops denied | `server/internalPushSchedulerRoutes.test.ts`, `server/crm.test.ts` | payload/log privacy by type |
| Mobile API | mobile caller follows server scope | mobile direct route bypass denied | `server/mobileRoutes.test.ts` | per-role mobile fixtures |
| Export/delete | branch_admin action audited | non-admin forbidden | `server/crm.test.ts`, UI tests | production-safe hard delete/export smoke |

Required role/data dimensions:
- `branch_admin`
- `sub_branch_admin`
- `team_leader`
- `member`
- active vs inactive user
- same branch vs other branch
- same team vs other team
- owned customer vs unowned customer
- subordinate vs unrelated user

## 14. 앞으로 Codex가 RBAC 작업 전 반드시 해야 할 절차

1. Run `codegraph status`.
2. Identify changed symbols and target domain.
3. Run CodeGraph impact analysis on affected RBAC helpers.
4. Read only narrowed file sections from router/procedure/db/UI files.
5. Check `docs/ops/rbac-safety-checklist.md`.
6. Run relevant tests for positive and negative role cases.
7. Verify no customer data leakage in UI, API response, logs, push payloads, or metadata.
8. Report P0/P1 risks before editing if the change touches auth, procedure guards, customer scope, DB ownership fields, export/delete, or push token/log privacy.

## 15. 정보 부족 / Needs verification

- Live production role data.
- Live DB migration state.
- Railway variables and environment-specific auth/push settings.
- Real user hierarchy data.
- Real device/mobile auth behavior.
- Browser-level forbidden state UX.
- Whether every UI route has an equivalent or stronger server-side authorization check.
- Whether production seed/fixture data matches local test assumptions.

## 16. 최종 판정

이 RBAC 맵은 향후 안전한 작업을 시작하기 위한 기준으로 충분하다. 특히 어떤 심볼을 먼저 보고, 어떤 변경이 P0/P1인지 판단하는 데 사용할 수 있다.

단, 다음 도메인은 수정 전 더 깊은 3차 분석이 필요하다:
- 고객 배정/인수인계/회수
- export/download/permanent delete
- notification/push token/log privacy
- dashboard/performance aggregate scope
- mobile REST direct access
- DB schema/migration affecting ownership or scope

명시적 승인 없이 구현하면 안 되는 변경:
- auth/session core 변경
- procedure guard 완화
- `verifyCustomerAccess` 또는 hierarchy scope 완화
- production data hard delete/export 경로 변경
- DB ownership/scope column migration
- push token 원문 노출 또는 고객정보 push payload 추가
